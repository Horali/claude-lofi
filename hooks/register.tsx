import type { EngineInterface, Register } from 'claude-code'

import { openInBrowser, Radio } from '../src/audio'
import { cardSvg, type Track } from '../src/card-svg'
import type { Mood } from '../src/character'
import type { Host } from '../src/host'
import { readStreamTitle, splitTitle, type Song } from '../src/icy'
import { paneLayout } from '../src/pane-layout'
import { sceneAt } from '../src/scenes'
import { timeOfDay } from '../src/sky'
import { setClock } from '../src/svg-kit'

// lofi-desk: /music plays lofi radio and opens a pane with a now-playing card
// and an animated scene. The little character reacts to tool calls.

const NAME = 'lofi-desk'
const PANE = 'lofi'
const STATION = 'ChillHop'
const STATION_LABEL = 'ChillHop · FluxFM'
const STREAM = 'https://channels.fluxfm.de/chillhop/externalembedflxhp/stream.mp3'
const FM_URL = 'https://www.youtube.com/live/tRsQsTMvPNg'
const OWN_TOOL = `mcp__${NAME}__lofi`

const TICK_MS = 1000
const SCENE_MS = 4 * 60_000
const TITLE_MS = 30_000
const DOZE_MS = 2 * 60_000
/** A tool call must run this long before the character switches to work. */
const WORK_AFTER_MS = 1500
/** And it keeps working this long after the last call, so it doesn't flicker. */
const WORK_LINGER_MS = 5000

// ---------- state (module variables reset when the mod reloads) ----------

let redraw = () => {}
const radio = new Radio(() => redraw())

let paneOpen = false
let ticker: { cancel: () => void } | undefined
let sceneIndex = 0
let sceneStartedAt = Date.now()

let song: Song | undefined
let songStartedAt = Date.now()
let pausedElapsed = 0
let recent: Track[] = []
let checkingTitle = false
let lastTitleCheck = 0

let busy = 0
let busySince = 0
let lastToolAt = Date.now()
let mood: Mood = 'vibing'
let tod = timeOfDay(new Date().getHours())

let cardCache: { key: string; svg: string } | undefined
let sceneCache: { key: string; svg: string } | undefined

// ---------- helpers ----------

const hhmm = (ms: number) => {
  const d = new Date(ms)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
const mmss = (sec: number) => `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(Math.floor(sec % 60)).padStart(2, '0')}`

/** The host functions the audio and title code use, built from the engine. */
function hostOf($: EngineInterface): Host {
  return {
    run: async (argv, timeoutMs) => {
      const r = await $.process.run(argv, { timeoutMs })
      return { exitCode: r.exitCode, stdout: r.stdout }
    },
    spawn: argv => $.process.spawn({ argv }),
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

function elapsedSec(now: number): number {
  return radio.state.isPlaying ? Math.max(0, Math.floor((now - songStartedAt) / 1000)) : pausedElapsed
}

async function checkTitle($: EngineInterface) {
  if (checkingTitle) return
  checkingTitle = true
  lastTitleCheck = Date.now()
  try {
    const next = splitTitle(await readStreamTitle(hostOf($), STREAM), STATION)
    if (next && (!song || next.title !== song.title || next.artist !== song.artist)) {
      if (song) recent = [{ at: hhmm(songStartedAt), ...song }, ...recent].slice(0, 3)
      song = next
      songStartedAt = Date.now()
      redraw()
    }
  } finally {
    checkingTitle = false
  }
}

/** One timer while the pane is open or music plays: mood, scene, sky, titles. */
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
    if (radio.state.isPlaying && now - lastTitleCheck > TITLE_MS) void checkTitle($)
    if (changed && paneOpen) redraw()
  })
}

async function play($: EngineInterface) {
  ensureTicker($)
  songStartedAt = Date.now() - pausedElapsed * 1000
  const s = await radio.start(hostOf($), STREAM)
  if (s.isPlaying) {
    lastTitleCheck = 0
    void checkTitle($)
  }
  return s
}

function pause() {
  pausedElapsed = elapsedSec(Date.now())
  radio.stop()
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
  if (!song) return radio.state.isPlaying ? `${STATION_LABEL}, live` : 'Radio off'
  return song.artist ? `${song.title} by ${song.artist}` : song.title
}

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
    return next(e)
  })

  on('session.end', async ($, e, next) => {
    radio.stop()
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
      pause()
      const opened = await openInBrowser(hostOf($), FM_URL)
      return {
        text: opened
          ? 'Stopped the radio and opened Claude FM in your browser.'
          : `Stopped the radio. Open Claude FM here: ${FM_URL}`,
      }
    }
    if (arg !== '') return { text: 'Use /music to start or stop, /music next for the next scene, /music fm for Claude FM.' }
    if (radio.state.isPlaying) {
      pause()
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
      else if (action === 'stop') pause()
      else if (action === 'next') nextScene()
      const report = {
        pane: paneOpen ? 'open' : 'closed',
        radio: radio.state,
        nowPlaying: nowLine(),
        recent,
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
    const isPlaying = radio.state.isPlaying
    const scene = sceneAt(sceneIndex)
    const toggle = async () => {
      if (radio.state.isPlaying) pause()
      else await play($)
      redraw()
    }
    const title = song?.title ?? (isPlaying ? `${STATION} live` : 'lofi radio')
    const artist = song?.artist ?? (isPlaying ? 'waiting for the song title…' : radio.state.problem ?? 'press ▶ play to start')

    if (e.surface !== 'desktop') {
      // Surfaces without Svg (the terminal): a short text version.
      const { Box, Text, Button } = $.ui.resolve(e)
      return (
        <Box flexDirection="column" paddingX={1}>
          <Text color="claude">{`♪ ${title}`}</Text>
          <Text dimColor>{`${artist} · ${STATION_LABEL} · ${mmss(elapsedSec(now))}`}</Text>
          <Box flexDirection="row" gap={1}>
            <Button key="play" label={isPlaying ? 'pause' : 'play'} variant="primary" onPress={toggle} />
            <Button key="next" label="next scene" onPress={nextScene} />
          </Box>
          <Text dimColor>{`${scene.name} · ${mood}${recent.length ? ` · before: ${recent[0]!.title}` : ''}`}</Text>
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
    const cardKey = [isPlaying, L.compact, L.stripUnits, title, artist, recent.map(r => r.title).join('|')].join('¦')
    if (cardCache?.key !== cardKey) {
      cardCache = {
        key: cardKey,
        svg: cardSvg(
          { title, artist, station: STATION_LABEL, elapsedSec: elapsedSec(now), isPlaying, recent },
          { compact: L.compact, stripUnits: L.stripUnits },
        ),
      }
    }
    const ctx = { tod, mood }
    const sceneKey = `${scene.id}¦${tod}¦${mood}`
    if (sceneCache?.key !== sceneKey) sceneCache = { key: sceneKey, svg: scene.build(ctx) }
    return (
      <Box flexDirection="column" alignItems="center" gap={1}>
        <Box position="relative" flexDirection="column">
          <Svg isInteractive width={L.cardW} height={L.cardH} source={cardCache.svg} alt={`Now playing: ${nowLine()}`} />
          <Box position="absolute" top={0} left={L.buttonsLeft} flexDirection="row" gap={2}>
            <Button key="play" plain onPress={toggle}>
              <Text mono size="caption" color="claude">{isPlaying ? '❚❚ pause' : '▶ play'}</Text>
            </Button>
            <Button key="next" plain onPress={nextScene}>
              <Text mono size="caption" dimColor>» next scene</Text>
            </Button>
          </Box>
        </Box>
        <Svg isInteractive width={L.sceneW} height={L.sceneH} source={sceneCache.svg} alt={scene.alt(ctx)} />
      </Box>
    )
  })
}

