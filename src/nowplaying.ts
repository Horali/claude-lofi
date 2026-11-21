// What's playing, from the service FluxFM's own website uses. The stream's
// ICY title only says "ChillHop", but this feed lists the last songs with
// the time each one started (newest first, so the first is playing now).
// Song lengths come from MusicBrainz, a free public music database; only
// the artist and title are sent there.

import type { Host } from './host'

export const FEED = 'https://fluxmusic.api.radiosphere.io/channels/chillhop/track-history'
const MB = 'https://musicbrainz.org/ws/2/recording'

export type Played = { artist: string; title: string; startMs: number }

/** The feed's JSON into songs, newest first. */
export function parseHistory(json: string): Played[] {
  const data = JSON.parse(json) as { items?: { start?: string; track?: { title?: string; artistCredits?: string } }[] }
  const out: Played[] = []
  for (const it of data.items ?? []) {
    const startMs = Date.parse(it.start ?? '')
    const title = it.track?.title?.trim()
    if (!title || Number.isNaN(startMs)) continue
    out.push({ title, artist: it.track?.artistCredits?.trim() ?? '', startMs })
  }
  return out.sort((a, b) => b.startMs - a.startMs)
}

export async function fetchHistory(host: Host): Promise<Played[] | undefined> {
  try {
    const r = await host.fetch(FEED, { Accept: 'application/json' })
    return r.ok ? parseHistory(r.text) : undefined
  } catch {
    return undefined
  }
}

const norm = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, ' ').trim()

/** Picks the length (seconds) of the best-matching recording in a MusicBrainz answer. */
export function pickLength(json: string, artist: string, title: string): number | undefined {
  const data = JSON.parse(json) as { recordings?: { title?: string; length?: number; 'artist-credit'?: { name?: string }[] }[] }
  const a = norm(artist.split(/,|&| feat\.? | x /i)[0] ?? '')
  const t = norm(title)
  for (const r of data.recordings ?? []) {
    if (!r.length || r.length < 30_000 || r.length > 20 * 60_000) continue
    const credits = norm((r['artist-credit'] ?? []).map(c => c.name ?? '').join(' '))
    if (norm(r.title ?? '') === t && (!a || credits.includes(a))) return Math.round(r.length / 1000)
  }
  return undefined
}

const lengths = new Map<string, number | null>()

/** The song's length in seconds, looked up once and remembered; undefined when unknown. */
export async function lookUpLength(host: Host, artist: string, title: string): Promise<number | undefined> {
  const key = `${norm(artist)}|${norm(title)}`
  if (lengths.has(key)) return lengths.get(key) ?? undefined
  const q = `recording:"${title.replace(/"/g, '')}"` + (artist ? ` AND artist:"${artist.replace(/"/g, '')}"` : '')
  try {
    // MusicBrainz asks clients to name themselves; a generic name, no contact details.
    const r = await host.fetch(`${MB}?query=${encodeURIComponent(q)}&fmt=json&limit=8`, {
      Accept: 'application/json',
      'User-Agent': 'lofi-desk/0.3 (a Claude Code mod)',
    })
    const len = r.ok ? pickLength(r.text, artist, title) : undefined
    lengths.set(key, len ?? null)
    return len
  } catch {
    return undefined
  }
}
