// Playing the stream. The engine's own player ($.audio.play) gave up after
// 3 ms on Windows in the spike, so outside Windows we try it first and
// otherwise run a small player in the background: ffplay, mpv, VLC, or on
// Windows the Media Player that ships with it, driven by PowerShell.
// Leaving the read loop (or the module unloading) kills the player, so
// music is never left playing after the mod stops.

import type { Host } from './host'
import { lastQueueKB, type Quality, QualityGuard } from './quality'

/** The same station at two qualities; the lighter one is used while the connection struggles. */
export type Stream = { full: string; light: string }

export type PlayerName = 'engine' | 'ffplay' | 'mpv' | 'vlc' | 'wmp'

export type RadioState = {
  isPlaying: boolean
  player?: PlayerName
  /** Which stream plays; 'light' while the connection is too slow for full quality. */
  quality?: Quality
  /** Why the last start failed, for the pane and the command's reply. */
  problem?: string
}

const wmpScript = (url: string, volume: number) =>
  [
    "$ErrorActionPreference = 'Stop'",
    'Add-Type -AssemblyName System.Windows.Forms',
    '$p = New-Object -ComObject WMPlayer.OCX',
    `$p.settings.volume = ${volume}`,
    `$p.URL = '${url.replace(/'/g, "''")}'`,
    '$p.controls.play()',
    // WMP only moves on while window messages are pumped: without DoEvents a stream stays in state 9.
    'while ($true) { [System.Windows.Forms.Application]::DoEvents(); Start-Sleep -Milliseconds 100 }',
  ].join('; ')

function argvFor(player: PlayerName, url: string, volume: number): string[] {
  switch (player) {
    case 'ffplay':
      // -stats prints the buffer size, which tells us when the sound is cutting out.
      return ['ffplay', '-nodisp', '-hide_banner', '-loglevel', 'error', '-stats', '-volume', String(volume), url]
    case 'mpv':
      return ['mpv', '--no-video', '--really-quiet', `--volume=${volume}`, url]
    case 'vlc':
      return ['vlc', '-I', 'dummy', '--no-video', '--gain', String(volume / 100), url]
    default:
      return ['powershell.exe', '-NoProfile', '-NonInteractive', '-Command', wmpScript(url, volume)]
  }
}

async function has(host: Host, exe: string, windows: boolean): Promise<boolean> {
  try {
    const r = await host.run(windows ? ['where.exe', exe] : ['which', exe], 5000)
    return r.exitCode === 0
  } catch {
    return false
  }
}

export class Radio {
  state: RadioState = { isPlaying: false }
  private stopEngine?: AbortController
  private child?: AsyncGenerator<unknown, unknown>
  private players?: PlayerName[]
  private generation = 0
  private guard = new QualityGuard()

  constructor(private onChange: () => void) {}

  /** Which background players this machine has, best first. */
  private async available(host: Host, windows: boolean): Promise<PlayerName[]> {
    if (!this.players) {
      const found: PlayerName[] = []
      for (const p of ['ffplay', 'mpv', 'vlc'] as const) if (await has(host, p, windows)) found.push(p)
      if (windows) found.push('wmp')
      this.players = found
    }
    return this.players
  }

  async start(host: Host, stream: Stream, volume = 60): Promise<RadioState> {
    this.stop()
    const gen = ++this.generation
    this.guard.reset()
    const url = stream.full
    const windows = (await host.platform()) === 'windows'
    if (!windows && (await this.tryEngine(host, url, gen))) return this.state
    const players = await this.available(host, windows)
    if (gen !== this.generation) return this.state
    if (players.length === 0) {
      this.state = { isPlaying: false, problem: 'No audio player found. Install ffmpeg (ffplay), mpv or VLC.' }
      this.onChange()
      return this.state
    }
    this.spawn(host, players, 0, stream, volume, gen)
    return this.state
  }

  /** The engine's player: counts as working if it is still going after 3 s. */
  private async tryEngine(host: Host, url: string, gen: number): Promise<boolean> {
    const ctl = new AbortController()
    this.stopEngine = ctl
    let settled = false
    void host.playEngine(url, ctl.signal).then(
      () => (settled = true),
      () => (settled = true),
    )
    await new Promise<void>(resolve => {
      host.after(3000, resolve)
    })
    if (gen !== this.generation) return true
    if (settled) {
      this.stopEngine = undefined
      return false
    }
    this.state = { isPlaying: true, player: 'engine' }
    this.onChange()
    return true
  }

  private spawn(host: Host, players: PlayerName[], i: number, stream: Stream, volume: number, gen: number) {
    const player = players[i]
    if (!player) {
      this.state = { isPlaying: false, problem: 'Every audio player stopped right away. Is the network up?' }
      this.onChange()
      return
    }
    const startedAt = Date.now()
    const quality = this.guard.quality
    const child = host.spawn(argvFor(player, stream[quality], volume))
    this.child = child as unknown as AsyncGenerator<unknown, unknown>
    this.guard.restart()
    this.state = { isPlaying: true, player, quality }
    this.onChange()
    void (async () => {
      let change: Quality | undefined
      try {
        for await (const piece of child) {
          if (gen !== this.generation) break
          const text = (piece as { text?: string }).text
          const kb = player === 'ffplay' && text ? lastQueueKB(text) : undefined
          change = kb === undefined ? undefined : this.guard.feed(kb)
          if (change) break
        }
      } catch {
        // could not start: fall through to the next player
      }
      if (gen !== this.generation) return
      // Too slow (or better again): the same player on the other stream.
      if (change) {
        this.child = undefined
        this.spawn(host, players, i, stream, volume, gen)
        return
      }
      // The player ended on its own. Quickly means it could not play: try the next.
      this.child = undefined
      if (Date.now() - startedAt < 4000) this.spawn(host, players, i + 1, stream, volume, gen)
      else {
        this.state = { isPlaying: false, problem: `${player} stopped.` }
        this.onChange()
      }
    })()
  }

  stop() {
    this.generation++
    this.stopEngine?.abort()
    this.stopEngine = undefined
    if (this.child) {
      const c = this.child
      this.child = undefined
      void c.return(undefined).catch(() => undefined)
    }
    if (this.state.isPlaying) {
      this.state = { isPlaying: false }
      this.onChange()
    }
  }
}

/** Opens a web page in the person's browser with the system's own opener. */
export async function openInBrowser(host: Host, url: string): Promise<boolean> {
  const platform = await host.platform()
  const argv =
    platform === 'windows'
      ? ['cmd.exe', '/c', 'start', '""', url]
      : platform === 'macos'
        ? ['open', url]
        : ['xdg-open', url]
  try {
    const r = await host.run(argv, 10000)
    return r.exitCode === 0
  } catch {
    return false
  }
}
