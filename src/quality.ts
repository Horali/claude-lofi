// Picks the stream quality from how full the player's buffer is. ffplay
// reports its audio queue ("aq=40KB", about a second of music) many times a
// second; when it runs dry the sound cuts out. A couple of cut-outs in a
// minute, or one long one, drops to the lighter stream. After a while it
// tries full quality again, and waits longer each time that goes badly.

export type Quality = 'full' | 'light'

const FILLED_KB = 5
const EMPTY_KB = 2
/** A dry buffer counts as a cut-out once it lasts this long. */
const CUT_MS = 400
const LONG_CUT_MS = 3000
const WINDOW_MS = 60_000
const CUTS_TO_DROP = 2
const FIRST_WAIT_MS = 5 * 60_000
const MAX_WAIT_MS = 30 * 60_000
/** Going back up counts as a failure if it cuts out again this soon. */
const SHAKY_MS = 2 * 60_000

export class QualityGuard {
  quality: Quality = 'full'
  private filled = false
  private dryAt?: number
  private counted = false
  private cuts: number[] = []
  private retryAt = 0
  private wait = FIRST_WAIT_MS
  private raisedAt?: number

  constructor(private now: () => number = Date.now) {}

  /** Back to full quality for a fresh start of the radio. */
  reset() {
    this.quality = 'full'
    this.wait = FIRST_WAIT_MS
    this.raisedAt = undefined
    this.restart()
  }

  /** A new player is starting: its first fill is not a cut-out. */
  restart() {
    this.filled = false
    this.dryAt = undefined
    this.counted = false
    this.cuts = []
  }

  /** One buffer reading in KB. Returns the quality to switch to, if it should change. */
  feed(queueKB: number): Quality | undefined {
    const t = this.now()
    if (this.quality === 'light' && t >= this.retryAt) {
      this.quality = 'full'
      this.raisedAt = t
      return 'full'
    }
    if (this.raisedAt !== undefined && t - this.raisedAt > 2 * SHAKY_MS) {
      this.wait = FIRST_WAIT_MS
      this.raisedAt = undefined
    }
    if (queueKB >= FILLED_KB) {
      this.filled = true
      this.dryAt = undefined
      this.counted = false
      return undefined
    }
    if (!this.filled || queueKB > EMPTY_KB) return undefined
    this.dryAt ??= t
    const dry = t - this.dryAt
    if (dry >= CUT_MS && !this.counted) {
      this.counted = true
      this.cuts.push(t)
    }
    this.cuts = this.cuts.filter(c => t - c < WINDOW_MS)
    if (this.quality === 'full' && (this.cuts.length >= CUTS_TO_DROP || dry >= LONG_CUT_MS)) {
      if (this.raisedAt !== undefined && t - this.raisedAt < SHAKY_MS) this.wait = Math.min(this.wait * 2, MAX_WAIT_MS)
      this.raisedAt = undefined
      this.quality = 'light'
      this.retryAt = t + this.wait
      return 'light'
    }
    return undefined
  }
}

/** The last buffer size in a piece of ffplay's status output, in KB. */
export function lastQueueKB(text: string): number | undefined {
  let kb: number | undefined
  for (const m of text.matchAll(/aq=\s*(\d+)KB/g)) kb = Number(m[1])
  return kb
}
