// What's playing, from the service FluxFM's own website uses. The stream's
// ICY title only says "ChillHop", but this feed lists the last songs with
// the time each one started (newest first, so the first is playing now).
// Song lengths come from Apple's public iTunes search, then MusicBrainz, a
// free music database; only the artist and title are sent to either.

import type { Host } from './host'

export const FEED = 'https://fluxmusic.api.radiosphere.io/channels/chillhop/track-history'
const ITUNES = 'https://itunes.apple.com/search'
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

const norm = (s: string) =>
  s.normalize('NFKD').toLowerCase().replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()
/** Without bracketed extras like "(instrumental)" or "[live]". */
const loose = (s: string) => norm(s.replace(/\([^)]*\)|\[[^\]]*\]/g, ''))
/** The first credited artist: "A & B" -> "a". */
const firstArtist = (artist: string) => norm(artist.split(/,|&| feat\.? | x /i)[0] ?? '')

type Candidate = { artist: string; title: string; ms?: number }

/** The length (seconds) of the best match: exact title first, then without extras. */
function best(cands: Candidate[], artist: string, title: string): number | undefined {
  const a = firstArtist(artist)
  for (const same of [norm, loose]) {
    for (const c of cands) {
      if (!c.ms || c.ms < 30_000 || c.ms > 20 * 60_000) continue
      if (same(c.title) === same(title) && (!a || norm(c.artist).includes(a))) return Math.round(c.ms / 1000)
    }
  }
  return undefined
}

/** Picks the length from a MusicBrainz answer. */
export function pickLength(json: string, artist: string, title: string): number | undefined {
  const data = JSON.parse(json) as { recordings?: { title?: string; length?: number; 'artist-credit'?: { name?: string }[] }[] }
  const cands = (data.recordings ?? []).map(r => ({
    title: r.title ?? '',
    ms: r.length,
    artist: (r['artist-credit'] ?? []).map(c => c.name ?? '').join(' '),
  }))
  return best(cands, artist, title)
}

/** Picks the length from an iTunes search answer. */
export function pickItunesLength(json: string, artist: string, title: string): number | undefined {
  const data = JSON.parse(json) as { results?: { artistName?: string; trackName?: string; trackTimeMillis?: number }[] }
  const cands = (data.results ?? []).map(r => ({ title: r.trackName ?? '', artist: r.artistName ?? '', ms: r.trackTimeMillis }))
  return best(cands, artist, title)
}

/** A source's verdict: a length, "not there", or "couldn't ask" (busy, offline). */
type Verdict = number | 'none' | 'error'

async function ask(host: Host, url: string, pick: (json: string) => number | undefined): Promise<Verdict> {
  try {
    // MusicBrainz asks clients to name themselves; a generic name, no contact details.
    const r = await host.fetch(url, { Accept: 'application/json', 'User-Agent': 'lofi-desk/0.4 (a Claude Code mod)' })
    if (!r.ok) return 'error'
    return pick(r.text) ?? 'none'
  } catch {
    return 'error'
  }
}

const lengths = new Map<string, number | null>()
const retryAt = new Map<string, number>()
const RETRY_MS = 60_000

/**
 * The song's length in seconds, or undefined when unknown. A found length,
 * or every source saying "not there", is remembered; a busy source is asked
 * again after a minute.
 */
export async function lookUpLength(host: Host, artist: string, title: string): Promise<number | undefined> {
  const key = `${norm(artist)}|${norm(title)}`
  if (lengths.has(key)) return lengths.get(key) ?? undefined
  if ((retryAt.get(key) ?? 0) > Date.now()) return undefined
  const term = `${firstArtist(artist)} ${loose(title)}`.trim()
  const itunes = await ask(host, `${ITUNES}?term=${encodeURIComponent(term)}&entity=song&limit=10`, j =>
    pickItunesLength(j, artist, title),
  )
  if (typeof itunes === 'number') return remember(key, itunes)
  const q = `recording:"${loose(title)}"` + (artist ? ` AND artist:"${firstArtist(artist)}"` : '')
  const mb = await ask(host, `${MB}?query=${encodeURIComponent(q)}&fmt=json&limit=10`, j => pickLength(j, artist, title))
  if (typeof mb === 'number') return remember(key, mb)
  if (itunes === 'none' && mb === 'none') lengths.set(key, null)
  else retryAt.set(key, Date.now() + RETRY_MS)
  return undefined
}

function remember(key: string, len: number) {
  lengths.set(key, len)
  return len
}
