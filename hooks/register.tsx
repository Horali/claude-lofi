import type { EngineInterface, Register } from 'claude-code'

// SPIKE: throwaway code that answers two questions before the real build.
// 1. Does $.audio.play({ url }) make sound in the desktop app on Windows?
//    If not, does a background player (ffplay, or Windows Media Player via
//    PowerShell) start and stop cleanly?
// 2. Does a pane open and redraw smoothly at about 8 frames a second?

const NAME = 'lofi-desk'
const PANE = 'lofi'
const STREAM = 'https://channels.fluxfm.de/chillhop/externalembedflxhp/stream.mp3'
const SPIKE_TOOL = `mcp__${NAME}__spike`
const FRAME_MS = 125

type AudioMode = 'off' | 'engine' | 'ffplay' | 'wmp'
type AudioDiag = {
  mode: AudioMode
  startedAt: number
  outcome: string
  output: string[]
  isStopped: boolean
}

let ticker: { cancel: () => void } | undefined
let renders: number[] = []
let seat = 'not drawn yet'
let audio: AudioDiag = { mode: 'off', startedAt: 0, outcome: 'idle', output: [], isStopped: true }
let engineStop: AbortController | undefined
let child: AsyncGenerator<unknown, unknown> | undefined
let busy = 0
let lastToolAt = 0

// ---------- drawing ----------

function hash(n: number): number {
  let x = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b)
  x ^= x >>> 13
  x = Math.imul(x, 0xc2b2ae35)
  x ^= x >>> 16
  return (x >>> 0) / 4294967296
}

function skyline(g: string[][], w: number, h: number, offset: number, width: number, maxH: number, ch: string, seed: number) {
  for (let x = 0; x < w; x++) {
    const wx = Math.floor(x + offset)
    const b = Math.floor(wx / width)
    const bh = Math.floor(1 + hash(b * 31 + seed) * maxH)
    for (let y = Math.max(0, h - bh); y < h; y++) {
      const isWindow = wx % width !== 0 && (y + b) % 2 === 0 && hash(wx * 7 + y * 13 + seed) < 0.35
      g[y]![x] = isWindow ? '·' : ch
    }
  }
}

function drawScene(w: number, h: number, now: number, mood: string): string[] {
  const t = now / 1000
  const g: string[][] = Array.from({ length: h }, () => Array<string>(w).fill(' '))
  for (let y = 0; y < Math.floor(h / 2); y++) {
    for (let x = 0; x < w; x++) {
      const r = hash(x * 131 + y * 977)
      if (r < 0.03) g[y]![x] = Math.sin(t * 2 + r * 1000) > 0.5 ? '*' : '.'
    }
  }
  skyline(g, w, h, t * 0.7, 7, Math.floor(h * 0.55), '░', 11)
  skyline(g, w, h, t * 2, 5, Math.floor(h * 0.35), '▓', 23)
  const drops = Math.floor((w * h) / 22)
  for (let i = 0; i < drops; i++) {
    const speed = 9 + hash(i * 7) * 7
    const y = (hash(i * 17) * h + t * speed) % h
    const x = Math.floor((hash(i * 13) * w - y * 0.5 + w * 4) % w)
    const yi = Math.floor(y)
    if (g[yi]![x] === ' ') g[yi]![x] = '/'
  }
  const beat = Math.floor(t * 2) % 2
  const face = mood === 'working' ? (beat ? '(•_•)' : '(•ᴗ•)') : mood === 'dozing' ? '(-_-)' : beat ? '(^‿^)' : '(^ᴗ^)'
  const sprite = [' ╭───╮ ', `${beat && mood !== 'dozing' ? '♪' : ' '}${face}${mood === 'dozing' ? 'z' : ' '}`, ' ╰┬─┬╯ ']
  sprite.forEach((line, i) => {
    const y = h - sprite.length + i
    for (let j = 0; j < line.length && j + 2 < w; j++) g[y]![j + 2] = line[j]!
  })
  return g.map(row => row.join(''))
}

function moodAt(now: number): string {
  if (busy > 0) return 'working'
  if (lastToolAt > 0 && now - lastToolAt > 120_000) return 'dozing'
  return 'vibing'
}

function smoothness(now: number) {
  const recent = renders.filter(t => now - t < 5000)
  let maxGap = 0
  for (let i = 1; i < recent.length; i++) maxGap = Math.max(maxGap, recent[i]! - recent[i - 1]!)
  return { fps: Math.round((recent.length / 5) * 10) / 10, maxGapMs: maxGap }
}

// ---------- audio ----------

const wmpScript = (url: string) =>
  [
    "$ErrorActionPreference = 'Stop'",
    '$p = New-Object -ComObject WMPlayer.OCX',
    '$p.settings.volume = 60',
    `$p.URL = '${url}'`,
    '$p.controls.play()',
    'Write-Output "pid $PID"',
    'while ($true) { Start-Sleep -Milliseconds 1000; Write-Output "state $($p.playState)" }',
  ].join('; ')

function stopAll() {
  engineStop?.abort()
  engineStop = undefined
  if (child) {
    const c = child
    child = undefined
    void c.return(undefined).catch(() => undefined)
  }
  audio.isStopped = true
}

async function playEngine($: EngineInterface) {
  stopAll()
  const ctl = new AbortController()
  engineStop = ctl
  const a: AudioDiag = { mode: 'engine', startedAt: await $.clock.now(), outcome: 'pending: no answer yet', output: [], isStopped: false }
  audio = a
  $.audio.play({ url: STREAM }, { shouldLoop: true, signal: ctl.signal }).then(
    async () => {
      a.outcome = `resolved after ${(await $.clock.now()) - a.startedAt} ms`
    },
    async (err: unknown) => {
      a.outcome = `rejected after ${(await $.clock.now()) - a.startedAt} ms: ${String(err)}`
    },
  )
}

async function playProcess($: EngineInterface, mode: 'ffplay' | 'wmp') {
  stopAll()
  const argv =
    mode === 'ffplay'
      ? ['ffplay', '-nodisp', '-hide_banner', '-loglevel', 'error', '-stats', '-volume', '60', STREAM]
      : ['powershell.exe', '-NoProfile', '-NonInteractive', '-Command', wmpScript(STREAM)]
  const a: AudioDiag = { mode, startedAt: await $.clock.now(), outcome: 'starting', output: [], isStopped: false }
  audio = a
  const stream = $.process.spawn({ argv })
  child = stream as unknown as AsyncGenerator<unknown, unknown>
  void (async () => {
    try {
      for await (const chunk of stream) {
        const text = String((chunk as { text?: string }).text ?? '').replace(/\s+/g, ' ').trim()
        if (text) {
          a.output.push(text.slice(-120))
          if (a.output.length > 6) a.output.shift()
        }
        a.outcome = 'running'
        if (a.isStopped) break
      }
      a.outcome = `ended: ${JSON.stringify(await stream.result.catch((err: unknown) => String(err)))}`
    } catch (err) {
      a.outcome = `failed: ${String(err)}`
    }
  })()
}

// ---------- wiring ----------

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'music', description: 'Lofi radio and an animated scene (spike build)' })
    await $.tool.register({
      name: 'spike',
      description:
        'Development spike for the claude-lofi mod. action: open (open the pane), engine ($.audio.play with the stream URL), ' +
        'ffplay or wmp (background player), stop, status. Returns diagnostics as JSON.',
      inputSchema: {
        type: 'object',
        properties: { action: { type: 'string', enum: ['open', 'engine', 'ffplay', 'wmp', 'stop', 'status'] } },
        required: ['action'],
      },
      isDeferred: false,
    })
    return next(e)
  })

  on('session.end', async ($, e, next) => {
    stopAll()
    return next(e)
  })

  on('command.run', { command: 'music' }, async $ => {
    await $.ui.open({ id: PANE, title: 'lofi' })
    ticker ??= $.clock.every(FRAME_MS, () => $.ui.invalidate('ui.render'))
    if (!audio.isStopped) {
      stopAll()
      return { text: 'Music stopped.' }
    }
    await playEngine($)
    return { text: 'Spike: playing through the engine player ($.audio.play).' }
  })

  on('ui.close', async ($, e, next) => {
    if (e.id === PANE) {
      ticker?.cancel()
      ticker = undefined
    }
    return next(e)
  })

  // One unfiltered hook: it answers the spike tool and counts every other call.
  on('tool.call', async ($, e, next) => {
    if ((e.tool as string) !== SPIKE_TOOL) {
      busy++
      lastToolAt = await $.clock.now()
      try {
        return await next(e)
      } finally {
        busy = Math.max(0, busy - 1)
        lastToolAt = await $.clock.now()
      }
    }
    const action = (e as unknown as { action?: string }).action ?? 'status'
    let note = ''
    if (action === 'open') {
      const opened = await $.ui.open({ id: PANE, title: 'lofi' })
      ticker ??= $.clock.every(FRAME_MS, () => $.ui.invalidate('ui.render'))
      note = `opened: ${JSON.stringify(opened)}`
    } else if (action === 'engine') {
      await playEngine($)
    } else if (action === 'ffplay' || action === 'wmp') {
      await playProcess($, action)
    } else if (action === 'stop') {
      stopAll()
    }
    const now = await $.clock.now()
    const report = {
      note,
      pane: seat,
      isTicking: ticker !== undefined,
      renders: renders.length,
      last5s: smoothness(now),
      audio: { ...audio, ageMs: now - audio.startedAt },
      info: await $.session.info().then(i => ({ platform: i.platform, isHosted: i.isHosted })).catch((err: unknown) => String(err)),
    }
    return { result: JSON.stringify(report, null, 1) } as never
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    const now = await $.clock.now()
    renders.push(now)
    if (renders.length > 400) renders = renders.slice(-200)
    const p = e.props as { bodyColumns: number; placement: string; scroll?: { bodyRows: number } }
    seat = `${e.surface} ${p.placement} ${p.bodyColumns}x${p.scroll?.bodyRows ?? '?'}`
    const mood = moodAt(now)
    if (p.placement === 'widget') return <Text mono>{`(^ᴗ^)♪ ${audio.mode}`}</Text>
    // Not `h`: JSX compiles to the global `h`, which a local of that name would shadow.
    const cols = Math.max(16, Math.min(p.bodyColumns, 120))
    const rows = Math.max(6, Math.min((p.scroll?.bodyRows ?? 20) - 2, 22))
    const { fps, maxGapMs } = smoothness(now)
    return (
      <Box flexDirection="column">
        {drawScene(cols, rows, now, mood).map(row => (
          <Text mono wrap="clip">
            {row}
          </Text>
        ))}
        <Text mono dimColor wrap="clip">
          {`${fps} fps · max gap ${maxGapMs} ms · ${mood} · audio ${audio.mode}: ${audio.isStopped ? 'stopped' : audio.outcome}`}
        </Text>
      </Box>
    )
  })
}
