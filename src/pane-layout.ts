// How big to draw the card and the scene for a pane of a given size.
// The app reports the pane in text columns and rows; these are the CSS
// pixels one column and one row take in the desktop app (measured from a
// screenshot of a 62x39 pane).

import { CARD_H, cardWidth } from './card-svg'

export const COL_PX = 7.8
export const ROW_PX = 21

export type PaneLayout = {
  compact: boolean
  /** Card size in CSS pixels. */
  cardW: number
  cardH: number
  /** Scene size in CSS pixels. */
  sceneW: number
  sceneH: number
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))

export function paneLayout(cols: number, rows: number): PaneLayout {
  const avail = Math.max(180, Math.floor(cols * COL_PX) - 8)
  // Below this the full card's small text gets too small to read.
  const compact = avail < 330
  // Past this the card only gets bigger, not better.
  const cardW = Math.min(avail, 560)
  const cardH = Math.round(CARD_H * (cardW / cardWidth(compact)))
  const sceneW = avail
  // The scene takes the height left under the card and the button row (one
  // row each, plus gaps), and crops its picture to fill, within limits so
  // the character and the moon stay in view.
  const room = rows * ROW_PX - cardH - 3 * ROW_PX - 8
  const sceneH = Math.round(clamp(room, sceneW * 0.8, sceneW * 1.35))
  return { compact, cardW, cardH, sceneW, sceneH }
}
