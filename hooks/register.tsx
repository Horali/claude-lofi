import type { EngineInterface, Register } from 'claude-code'

import { openInBrowser, Radio } from '../src/audio'
import { cardSvg } from '../src/card-svg'
import type { Mood } from '../src/character'
import type { Host } from '../src/host'
import { readStreamTitle, splitTitle } from '../src/icy'
import { fetchHistory, lookUpLength, type Played } from '../src/nowplaying'
import { paneLayout } from '../src/pane-layout'
import { sceneAt } from '../src/scenes'
import { timeOfDay } from '../src/sky'
import { setClock, setMotion, type Motion } from '../src/svg-kit'

// lofi-desk: /music plays lofi radio and opens a pane with a now-playing card
// and an animated scene. The little character reacts to tool calls.

const NAME = 'lofi-desk'
const PANE = 'lofi'
const STATION = 'ChillHop'
const STATION_LABEL = 'ChillHop · FluxFM'
const STREAM = 'https://channels.fluxfm.de/chillhop/externalembedflxhp/stream.mp3'
/** FluxFM's own 64 kbit/s AAC copy, played while the connection can't keep up with 320 kbit/s. */
const STREAM_LIGHT = 'https://channels.fluxfm.de/chillhop/externalembedflxhp/stream.aac'
const FM_URL = 'https://www.youtube.com/live/tRsQsTMvPNg'
const OWN_TOOL = `mcp__${NAME}__lofi`

const TICK_MS = 1000
const SCENE_MS = 3 * 60_000
/** How often to ask what's playing. */
const SONG_MS = 20_000
const DOZE_MS = 2 * 60_000
/** A tool call must run this long before the character switches to work. */
const WORK_AFTER_MS = 1500
/** And it keeps working this long after the last call, so it doesn't flicker. */
const WORK_LINGER_MS = 5000
/** The list slides up once when a song changes; a rebuild later doesn't slide again. */
const SLIDE_MS = 4000
/** How often a playing session checks it is still the one meant to play. */
const CLAIM_MS = 2000

// ---------- state (module variables reset when the mod reloads) ----------

let redraw = () => {}
const radio = new Radio(() => redraw())

let paneOpen = false
let ticker: { cancel: () => void } | undefined
let sceneIndex = 0
let sceneStartedAt = Date.now()

let current: (Played & { lengthSec?: number }) | undefined
let previous: Played | undefined
let songChangedAt = 0
let pausedAt = 0
let checkingSong = false
let lastSongCheck = 0

let busy = 0
let busySince = 0
let lastToolAt = Date.now()
let mood: Mood = 'vibing'
let tod = timeOfDay(new Date().getHours())

// One radio for the whole computer: every session runs its own copy of this
// mod, so the session that starts the music writes its name in the shared
// store, and a playing session that finds another name there stops.
type Claim = { owner: string; at: number }
const ME = Math.random().toString(36).slice(2, 10)
/** Stopped because another session took over the radio. */
let elsewhere = false
let lastClaimCheck = 0

/** Read from the store on first draw; 'light' trades some motion for less redrawing. */
let motion: Motion | undefined

async function loadMotion($: EngineInterface): Promise<Motion> {
  if (!motion) motion = ((await $.store.get('motion').catch(() => undefined)) as Motion | undefined) ?? 'full'
  return motion
}

let cardCache: { key: string; svg: string } | undefined
let sceneCache: { key: string; svg: string } | undefined

// ---------- helpers ----------

/** The host functions the audio and song code use, built from the engine. */
function hostOf($: EngineInterface): Host {
  return {
    run: async (argv, timeoutMs) => {
      const r = await $.process.run(argv, { timeoutMs })
      return { exitCode: r.exitCode, stdout: r.stdout }
    },
    spawn: argv => $.process.spawn({ argv }),
    fetch: async (url, headers) => {
      const r = await $.http.fetch(url, { headers })
      return { ok: r.ok, status: r.status, text: r.text }
    },
    platform: async () => (await $.session.info().catch(() => undefined))?.platform,
    after: (ms, fn) => void $.clock.after(ms, fn),
    playEngine: (url, signal) => $.audio.play({ url }, { shouldLoop: true, signal }),
  }
}

function moodAt(now: number): Mood {
  if (busy > 0 && now - busySince > WORK_AFTER_MS) return 'working'
  if (mood === 'working' && now - lastToolAt < WORK_LINGER_MS) return 'working'
  if (now - lastToolAt > DOZE_MS) return 'dozing'
  return 'vibing'
}

/** Seconds into the current song: live while playing, frozen while paused. */
function elapsedSec(now: number): number {
  if (!current) return 0
  const at = radio.state.isPlaying || !pausedAt ? now : pausedAt
  return Math.max(0, Math.floor((at - current.startMs) / 1000))
}

const sameSong = (a?: Played, b?: Played) => !!a && !!b && a.title === b.title && a.artist === b.artist

/** Asks the station what's playing; falls back to the stream's own title. */
async function checkSong(host: Host) {
  if (checkingSong) return
  checkingSong = true
  lastSongCheck = Date.now()
  try {
    const history = await fetchHistory(host)
    let now: Played | undefined = history?.[0]
    let before: Played | undefined = history?.[1]
    if (!now) {
      const s = splitTitle(await readStreamTitle(host, STREAM), STATION)
      if (s) {
        now = sameSong(current, { ...s, startMs: 0 }) ? current : { ...s, startMs: Date.now() }
        before = sameSong(current, now) ? previous : current
      }
    }
    if (!now) return
    if (!sameSong(current, now)) {
      previous = before
      current = { ...now }
      songChangedAt = Date.now()
      redraw()
    }
    // Asked again on every check until found: a busy service shouldn't leave it blank.
    const song = current
    if (!song || song.lengthSec !== undefined) return
    const len = await lookUpLength(host, song.artist, song.title)
    if (len && current === song) {
      song.lengthSec = len
      redraw()
    }
  } finally {
    checkingSong = false
  }
}

/** One timer while the pane is open or music plays: mood, scene, sky, songs. */
function ensureTicker($: EngineInterface) {
  redraw = () => void $.ui.invalidate('ui.render')
  if (ticker) return
  ticker = $.clock.every(TICK_MS, () => {
    const now = Date.now()
    if (!paneOpen && !radio.state.isPlaying) {
      ticker?.cancel()
      ticker = undefined
      return
    }
    let changed = false
    const m = moodAt(now)
    if (m !== mood) {
      mood = m
      changed = true
    }
    if (now - sceneStartedAt > SCENE_MS) {
      sceneIndex++
      sceneStartedAt = now
      changed = true
    }
    const t = timeOfDay(new Date(now).getHours())
    if (t !== tod) {
      tod = t
      changed = true
    }
    if (now - lastSongCheck > SONG_MS) void checkSong(hostOf($))
    if (radio.state.isPlaying && now - lastClaimCheck > CLAIM_MS) {
      lastClaimCheck = now
      void $.store.get('radio').then(
        value => {
          const claim = value as Claim | undefined
          if (claim && claim.owner !== ME && radio.state.isPlaying) {
            radio.stop()
            pausedAt = Date.now()
            elsewhere = true
            redraw()
          }
        },
        () => undefined,
      )
    }
    if (changed && paneOpen) redraw()
  })
}

async function play($: EngineInterface) {
  ensureTicker($)
  pausedAt = 0
  elsewhere = false
  // Claim first, so a session already playing stops within a couple of seconds.
  await $.store.set('radio', { owner: ME, at: Date.now() } satisfies Claim).catch(() => undefined)
  lastClaimCheck = Date.now()
  const s = await radio.start(hostOf($), { full: STREAM, light: STREAM_LIGHT })
  if (s.isPlaying) void checkSong(hostOf($))
  return s
}

async function pause($: EngineInterface) {
  pausedAt = Date.now()
  radio.stop()
  await releaseClaim($)
}

async function releaseClaim($: EngineInterface) {
  const claim = (await $.store.get('radio').catch(() => undefined)) as Claim | undefined
  if (claim?.owner === ME) await $.store.delete('radio').catch(() => undefined)
}

// The Context Gauge's Music button (like its Live and Mods buttons) leaves an
// empty file ~/.claude/mods/.open-lofi-desk-<session>. Seeing it opens the pane
// and starts the radio in this chat.
const OPEN_MS = 700
const homeOf = ($: EngineInterface) => $.plugin.root.split('\\').join('/').split('/.claude/')[0] ?? ''
let openRequest = ''

async function checkOpenRequest($: EngineInterface) {
  if (!openRequest) openRequest = `${homeOf($)}/.claude/mods/.open-lofi-desk-${await $.session.id()}`
  if (!(await $.fs.exists(openRequest).catch(() => false))) return
  const windows = (await hostOf($).platform()) === 'windows'
  const path = windows ? openRequest.split('/').join('\\') : openRequest
  await hostOf($).run(windows ? ['cmd', '/d', '/c', 'del', '/f', '/q', path] : ['rm', '-f', path], 5000).catch(() => undefined)
  await openPane($)
  if (!radio.state.isPlaying) await play($)
}

async function openPane($: EngineInterface) {
  paneOpen = true
  ensureTicker($)
  await $.ui.open({ id: PANE, title: 'lofi' })
}

function nextScene() {
  sceneIndex++
  sceneStartedAt = Date.now()
  redraw()
}

function nowLine(): string {
  if (!current) return radio.state.isPlaying ? `${STATION_LABEL}, live` : 'Radio off'
  return current.artist ? `${current.title} by ${current.artist}` : current.title
}

const mmss = (sec: number) => `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(Math.floor(sec % 60)).padStart(2, '0')}`

// ---------- wiring ----------

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'music',
      description: 'Lofi radio with an animated scene. /music toggles it, /music next changes the scene, /music fm opens Claude FM',
      argumentHint: '[next | fm]',
    })
    await $.tool.register({
      name: 'lofi',
      description:
        'Control the lofi-desk pane and radio when the user asks. action: open (show the pane), close, play, stop, next (next scene), status.',
      inputSchema: {
        type: 'object',
        properties: { action: { type: 'string', enum: ['open', 'close', 'play', 'stop', 'next', 'status'] } },
        required: ['action'],
      },
      isDeferred: true,
    })
    $.clock.every(OPEN_MS, () => {
      void checkOpenRequest($).catch(() => undefined)
    })
    return next(e)
  })

  on('session.end', async ($, e, next) => {
    radio.stop()
    await releaseClaim($)
    ticker?.cancel()
    ticker = undefined
    return next(e)
  })

  on('command.run', { command: 'music' }, async ($, e) => {
    const arg = e.args.trim().toLowerCase()
    if (arg === 'next') {
      nextScene()
      if (!paneOpen) await openPane($)
      return { text: `Scene: ${sceneAt(sceneIndex).name}.` }
    }
    if (arg === 'fm') {
      await pause($)
      const opened = await openInBrowser(hostOf($), FM_URL)
      return {
        text: opened ? 'Stopped the radio and opened Claude FM in your browser.' : `Stopped the radio. Open Claude FM here: ${FM_URL}`,
      }
    }
    if (arg === 'light' || arg === 'full') {
      motion = arg
      await $.store.set('motion', arg).catch(() => undefined)
      sceneCache = undefined
      redraw()
      return {
        text:
          arg === 'light'
            ? 'Light motion on: the scenes keep their rain, stars and drifting sky but skip the shimmer and swaying ground, so the app redraws less. /music full to switch back.'
            : 'Full motion on. /music light uses less of your computer.',
      }
    }
    if (arg !== '') return { text: 'Use /music to start or stop, /music next for the next scene, /music fm for Claude FM, /music light or /music full for how much the scenes move.' }
    if (radio.state.isPlaying) {
      await pause($)
      await $.ui.close({ id: PANE }).catch(() => undefined)
      paneOpen = false
      return { text: 'Music stopped.' }
    }
    await openPane($)
    const s = await play($)
    return {
      text: s.isPlaying
        ? `Playing ${STATION_LABEL}. /music again to stop, /music next for another scene.`
        : `The pane is open, but the radio could not start: ${s.problem ?? 'no player'}`,
    }
  })

  on('ui.close', async ($, e, next) => {
    if (e.id === PANE) paneOpen = false
    return next(e)
  })

  // Counts every tool call (for the character's mood) and answers our own.
  on('tool.call', async ($, e, next) => {
    if ((e.tool as string) === OWN_TOOL) {
      const action = (e as unknown as { action?: string }).action ?? 'status'
      if (action === 'open') await openPane($)
      else if (action === 'close') await $.ui.close({ id: PANE }).catch(() => undefined)
      else if (action === 'play') await play($)
      else if (action === 'stop') await pause($)
      else if (action === 'next') nextScene()
      const report = {
        pane: paneOpen ? 'open' : 'closed',
        radio: radio.state,
        nowPlaying: nowLine(),
        position: current ? `${mmss(elapsedSec(Date.now()))} of ${current.lengthSec ? mmss(current.lengthSec) : 'unknown'}` : undefined,
        previous: previous ? `${previous.title} by ${previous.artist}` : undefined,
        scene: sceneAt(sceneIndex).name,
        mood,
        timeOfDay: tod,
      }
      return { result: JSON.stringify(report, null, 1) } as never
    }
    const now = Date.now()
    if (busy++ === 0) busySince = now
    lastToolAt = now
    try {
      return await next(e)
    } finally {
      busy = Math.max(0, busy - 1)
      lastToolAt = Date.now()
    }
  })

  on('ui.render', { component: 'Pane' }, async ($, e, next) => {
    if (e.requestId !== PANE) return next(e)
    paneOpen = true
    ensureTicker($)
    const now = Date.now()
    if (!current && now - lastSongCheck > 5000) void checkSong(hostOf($))
    const isPlaying = radio.state.isPlaying
    const scene = sceneAt(sceneIndex)
    const toggle = async () => {
      if (radio.state.isPlaying) await pause($)
      else await play($)
      redraw()
    }
    const title = current?.title ?? (isPlaying ? `${STATION} live` : 'lofi radio')
    const artist = current?.artist ?? (isPlaying ? 'finding the song…' : (elsewhere ? 'playing in another session · ▶ to play here' : radio.state.problem ?? 'press ▶ play to start'))

    if (e.surface !== 'desktop') {
      // Surfaces without Svg (the terminal): a short text version.
      const { Box, Text, Button } = $.ui.resolve(e)
      const pos = `${mmss(elapsedSec(now))}${current?.lengthSec ? ` / ${mmss(current.lengthSec)}` : ''}`
      return (
        <Box flexDirection="column" paddingX={1}>
          <Text color="claude">{`♪ ${title}`}</Text>
          <Text dimColor>{`${artist} · ${STATION_LABEL} · ${pos}`}</Text>
          <Box flexDirection="row" gap={1}>
            <Button key="play" label={isPlaying ? 'pause' : 'play'} variant="primary" onPress={toggle} />
            <Button key="next" label="next scene" onPress={nextScene} />
          </Box>
          <Text dimColor>{`${scene.name} · ${mood}${previous ? ` · before: ${previous.title}` : ''}`}</Text>
        </Box>
      )
    }

    const { Box, Text, Button, Svg } = $.ui.resolve(e)
    const p = e.props as { bodyColumns: number; scroll?: { bodyRows: number } }
    // In its frame an Svg keeps its own size, so both are sized to the pane.
    const L = paneLayout(p.bodyColumns, p.scroll?.bodyRows ?? 39)
    // Rebuild an SVG only when what it shows changes; animations are pinned
    // to the clock, so a rebuilt one carries on where it was.
    setClock(now / 1000)
    const light = isPlaying && radio.state.quality === 'light'
    const cardKey = [isPlaying, light, L.compact, title, artist, current?.startMs, current?.lengthSec, previous?.title].join('¦')
    if (cardCache?.key !== cardKey) {
      cardCache = {
        key: cardKey,
        svg: cardSvg(
          {
            title,
            artist,
            station: light ? `${STATION_LABEL} · lighter stream` : STATION_LABEL,
            elapsedSec: elapsedSec(now),
            lengthSec: current?.lengthSec,
            isPlaying,
            previous,
            justChanged: now - songChangedAt < SLIDE_MS,
          },
          { compact: L.compact },
        ),
      }
    }
    const ctx = { tod, mood }
    const level = await loadMotion($)
    setMotion(level)
    const sceneKey = `${scene.id}¦${tod}¦${mood}¦${level}`
    if (sceneCache?.key !== sceneKey) sceneCache = { key: sceneKey, svg: scene.build(ctx) }
    return (
      <Box flexDirection="column" alignItems="center" gap={1}>
        <Svg isInteractive width={L.cardW} height={L.cardH} source={cardCache.svg} alt={`Now playing: ${nowLine()}`} />
        <Box flexDirection="row" gap={3}>
          <Button key="play" plain onPress={toggle}>
            <Text mono color="claude">{isPlaying ? '❚❚ pause' : '▶ play'}</Text>
          </Button>
          <Button key="next" plain onPress={nextScene}>
            <Text mono dimColor>» next scene</Text>
          </Button>
        </Box>
        <Svg isInteractive width={L.sceneW} height={L.sceneH} source={sceneCache.svg} alt={scene.alt(ctx)} />
      </Box>
    )
  })
}
