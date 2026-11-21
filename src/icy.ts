// Song titles from the stream. Internet radio sends them as ICY metadata:
// ask with the header `Icy-MetaData: 1`, and after every `icy-metaint`
// bytes of audio the server tucks in `StreamTitle='Artist - Title';`.
// $.http.fetch waits for the whole body, and a radio stream never ends, so
// we read 3 seconds of it with curl (built into Windows 10+, macOS, Linux).

import type { Host } from './host'

export type Song = { artist: string; title: string }

/** The first StreamTitle in a chunk of raw stream bytes. */
export function parseStreamTitle(raw: string): string | undefined {
  const m = /StreamTitle='(.*?)';/s.exec(raw)
  return m?.[1]?.trim() || undefined
}

/**
 * "Artist - Title" into its parts. A title that is only the station's name
 * (sent between songs) is no song at all.
 */
export function splitTitle(raw: string | undefined, station: string): Song | undefined {
  if (!raw) return undefined
  const clean = raw.replace(/\s+/g, ' ').trim()
  if (!clean || clean.toLowerCase() === station.toLowerCase()) return undefined
  const at = clean.indexOf(' - ')
  if (at < 0) return { artist: '', title: clean }
  return { artist: clean.slice(0, at).trim(), title: clean.slice(at + 3).trim() }
}

/** Reads the current title from the stream, or undefined when it can't. */
export async function readStreamTitle(host: Host, url: string): Promise<string | undefined> {
  try {
    const r = await host.run(['curl', '-s', '-L', '-H', 'Icy-MetaData: 1', '--max-time', '3', url], 8000)
    return parseStreamTitle(r.stdout)
  } catch {
    return undefined
  }
}
