// How big to draw the card and the scene for a pane of a given size.
// The app reports the pane in text columns and rows; these are the CSS
// pixels one column and one row take in the desktop app (measured from a
// screenshot of a 62x39 pane).

import { cardHeight, cardWidth } from './card-svg'

export const COL_PX = 7.8
export const ROW_PX = 21

export type PaneLayout = {
  compact: boolean
  /** Card size in CSS pixels. */
  cardW: number
  cardH: number
  /** Button strip height in card units. */
  stripUnits: number
  /** Where the buttons start, in columns from the card's left edge. */
  buttonsLeft: number
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
  const scale = cardW / cardWidth(compact)
  // One text row plus a little air, so the buttons sit inside the strip.
  const stripUnits = Math.round(((ROW_PX + 4) / scale) * 10) / 10
  const cardH = Math.round(cardHeight({ compact, stripUnits }) * scale)
  const buttonsLeft = Math.max(1, Math.round((14 * scale) / COL_PX))
  const sceneW = avail
  // The scene takes the height left under the card (one row of gap), and
  // crops its picture to fill, within limits so the character and the
  // moon stay in view.
  const room = rows * ROW_PX - cardH - ROW_PX - 8
  const sceneH = Math.round(clamp(room, sceneW * 0.8, sceneW * 1.35))
  return { compact, cardW, cardH, stripUnits, buttonsLeft, sceneW, sceneH }
}
