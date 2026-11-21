// The now-playing card as one SVG: a cassette with turning reels, the song,
// a slider showing where we are in it (length from MusicBrainz), and a
// three-row list: the song before, the song now, and "· · ·" for the one
// still to come. When the song changes, the rows slide up one place.
// Everything moves by CSS alone, pinned to the clock (see svg-kit).

import { anim, smilBegin } from './svg-kit'
import { FONT_STACK, PALETTE_CSS } from './theme-css'

export type Song = { artist: string; title: string }
export type CardInput = {
  title: string
  artist: string
  station: string
  /** Seconds into the song. */
  elapsedSec: number
  /** The song's length in seconds, when known. */
  lengthSec?: number
  isPlaying: boolean
  /** The song before this one, for the list. */
  previous?: Song
  /** True right after the song changed: the list slides up once. */
  justChanged?: boolean
}
export type CardLayout = {
  /** Narrow panes: no cassette, a 140-wide card so the text stays readable. */
  compact: boolean
}

/** Width of the card's drawing space for a layout. */
export const cardWidth = (compact: boolean) => (compact ? 140 : 200)
/** Height of the card's drawing space. */
export const CARD_H = 116

// Set at the start of each cardSvg call (drawing is synchronous).
let W = 200
const H = CARD_H

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const cut = (s: string, n: number) => ([...s].length > n ? [...s].slice(0, n - 1).join('') + '…' : s)
const mmss = (sec: number) => `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(Math.floor(sec % 60)).padStart(2, '0')}`

// One digit: a strip of numerals behind a small window. CSS steps the strip,
// so the counter ticks without the pane redrawing.
function digit(x: number, y: number, period: number, count: number, elapsed: number): string {
  const strip = Array.from({ length: count }, (_, i) => `<tspan x="0" dy="${i === 0 ? 0 : 9}">${i}</tspan>`).join('')
  return (
    `<svg x="${x}" y="${y - 6.2}" width="4.2" height="8" overflow="hidden">` +
    `<text y="6.2" class="ink digits roll${count}" style="animation-duration:${period}s;animation-delay:-${elapsed}s">${strip}</text>` +
    `</svg>`
  )
}

function counter(x: number, y: number, e: number): string {
  return (
    digit(x, y, 6000, 6, e) +
    digit(x + 4, y, 600, 10, e) +
    `<text x="${x + 8}" y="${y}" class="ink3 digits">:</text>` +
    digit(x + 11.4, y, 60, 6, e) +
    digit(x + 15.4, y, 10, 10, e)
  )
}

function reel(cx: number, cy: number): string {
  return (
    `<g class="reel" style="transform-origin:${cx}px ${cy}px;${anim(2.6, cx)}">` +
    `<circle cx="${cx}" cy="${cy}" r="5" class="paper"/>` +
    `<rect x="${cx - 0.6}" y="${cy - 4.5}" width="1.2" height="9" class="ink2"/>` +
    `<rect x="${cx - 4.5}" y="${cy - 0.6}" width="9" height="1.2" class="ink2"/>` +
    `</g>`
  )
}

function cassette(x: number, y: number): string {
  return (
    `<g shape-rendering="crispEdges">` +
    `<rect x="${x}" y="${y}" width="44" height="28" rx="2" class="ink4"/>` +
    `<rect x="${x + 3}" y="${y + 3}" width="38" height="5" class="paper"/>` +
    `<rect x="${x + 5}" y="${y + 4.6}" width="16" height="1.6" class="accent"/>` +
    `<rect x="${x + 7}" y="${y + 9}" width="30" height="10" rx="1" class="ink3"/>` +
    `<rect x="${x + 12}" y="${y + 22}" width="20" height="4" class="ink3"/>` +
    `</g>` +
    reel(x + 14, y + 14) +
    reel(x + 30, y + 14)
  )
}

/** A tiny three-bar "playing" sign beside NOW PLAYING. */
function eq(x: number, y: number): string {
  return [0, 1, 2]
    .map(i => `<rect x="${x + i * 2}" y="${y - 4}" width="1.3" height="4" class="accent eqbar" style="${anim(0.7 + i * 0.23, i * 0.4)}"/>`)
    .join('')
}

function frame(): string {
  const corner = (x: number, y: number, ch: string, delay: number) =>
    `<text x="${x}" y="${y}" class="ink3 corner" style="${anim(3.4, delay)}">${ch}</text>`
  const path = `M8,3 H${W - 8} Q${W - 3},3 ${W - 3},8 V${H - 8} Q${W - 3},${H - 3} ${W - 8},${H - 3} H8 Q3,${H - 3} 3,${H - 8} V8 Q3,3 8,3 Z`
  return (
    `<path d="${path}" class="frame" stroke-width="0.6" stroke-dasharray="1.2 2.4"/>` +
    corner(0.8, 6.8, '✦', 0) +
    corner(W - 6.2, 6.8, '✧', 1.3) +
    corner(0.8, H - 0.8, '✧', 2.1) +
    corner(W - 6.2, H - 0.8, '✦', 0.7) +
    `<circle r="1.1" class="accent"><animateMotion dur="16s" begin="${smilBegin(16)}" repeatCount="indefinite" path="${path}"/></circle>`
  )
}

/**
 * The slider: played part, a soft wave over it, and a knob. With a known
 * length these run once from where the song is now to its end; the CSS
 * clock does the rest.
 */
function slider(x0: number, x1: number, y: number, c: CardInput): string {
  const len = x1 - x0
  if (!c.lengthSec) {
    return (
      `<line x1="${x0}" y1="${y}" x2="${x1}" y2="${y}" class="track" stroke-dasharray="1 1.6"/>` +
      `<rect x="${x0}" y="${y - 0.6}" width="10" height="1.2" rx="0.6" class="accent sweep a" style="${anim(7)}"/>`
    )
  }
  const total = c.lengthSec
  const at = Math.min(c.elapsedSec, total)
  const run = `animation-duration:${total}s;animation-delay:-${at}s`
  let wave = `M${x0},${y}`
  for (let x = x0; x <= x1; x += 1) wave += ` L${x.toFixed(1)},${(y - 1.6 - Math.sin((x - x0) / 2.2) * 1.1).toFixed(2)}`
  return (
    `<defs><clipPath id="played"><rect x="${x0}" y="${y - 5}" width="${len}" height="7" class="grow" style="${run}"/></clipPath></defs>` +
    `<line x1="${x0}" y1="${y}" x2="${x1}" y2="${y}" class="track"/>` +
    `<g clip-path="url(#played)">` +
    `<rect x="${x0}" y="${y - 0.6}" width="${len}" height="1.2" rx="0.6" class="accent"/>` +
    `<path d="${wave}" class="wave"/>` +
    `</g>` +
    `<circle cx="${x0}" cy="${y}" r="1.9" class="accent knob" style="--len:${len}px;${run}"/>` +
    `<text x="${W - 14}" y="${y + 2}" class="ink3 digits" text-anchor="end">${mmss(total)}</text>`
  )
}

/** The three rows: before, now, still to come. */
function list(x: number, y: number, c: CardInput, compact: boolean): string {
  const n = compact ? 24 : 38
  const line = (s: Song) => cut(s.artist ? `${s.title} — ${s.artist}` : s.title, n)
  const rows =
    (c.previous ? `<text x="${x + 7}" y="${y}" class="ink3 small">${esc(line(c.previous))}</text>` : '') +
    `<text x="${x}" y="${y + 10}" class="accent small">♪</text>` +
    `<text x="${x + 7}" y="${y + 10}" class="ink small strong">${esc(line({ title: c.title, artist: c.artist }))}</text>` +
    `<text x="${x + 7}" y="${y + 20}" class="ink3 small tw a" style="${anim(2.4)}">·  ·  ·</text>`
  return `<g class="${c.justChanged ? 'slide' : ''}">${rows}</g>`
}

const css = () => `
text{font-family:${FONT_STACK};white-space:pre}
.small{font-size:4.6px}.strong{font-weight:600}.mono{font-size:4.6px}.digits{font-size:5.6px}
.label{font-size:3.8px;letter-spacing:1.2px}.title{font-size:8.5px;font-weight:600}.artist{font-size:5.2px}
.a{animation-iteration-count:infinite}
.reel{animation-name:spin;animation-timing-function:linear;animation-iteration-count:infinite}
.eqbar{transform-box:fill-box;transform-origin:bottom;animation-name:eq;animation-iteration-count:infinite;animation-direction:alternate;animation-timing-function:ease-in-out}
.corner{font-size:5px;animation-name:tw;animation-timing-function:ease-in-out;animation-iteration-count:infinite}
.live{animation-name:tw;animation-timing-function:ease-in-out;animation-iteration-count:infinite}
.tw{animation-name:tw;animation-timing-function:ease-in-out}
.roll6{animation-name:roll6;animation-timing-function:steps(6);animation-iteration-count:infinite}
.roll10{animation-name:roll10;animation-timing-function:steps(10);animation-iteration-count:infinite}
.track{stroke-width:0.8;stroke-linecap:round}
.wave{fill:none;stroke-width:0.5;opacity:.75}
.grow{transform-box:fill-box;transform-origin:left center;animation-name:grow;animation-timing-function:linear;animation-fill-mode:both}
.knob{animation-name:knob;animation-timing-function:linear;animation-fill-mode:both}
.sweep{animation-name:sweep;animation-timing-function:ease-in-out}
.slide{animation:slide 1.4s ease-out both}
.paused .reel,.paused .eqbar,.paused .live,.paused .digits,.paused .grow,.paused .knob,.paused .sweep{animation-play-state:paused}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes eq{from{transform:scaleY(.25)}to{transform:scaleY(1)}}
@keyframes tw{0%,100%{opacity:1}50%{opacity:.2}}
@keyframes roll6{to{transform:translateY(-54px)}}
@keyframes roll10{to{transform:translateY(-90px)}}
@keyframes grow{from{transform:scaleX(0)}to{transform:scaleX(1)}}
@keyframes knob{from{transform:translateX(0)}to{transform:translateX(var(--len))}}
@keyframes sweep{0%{transform:translateX(0);opacity:0}15%,85%{opacity:1}100%{transform:translateX(${W - 90}px);opacity:0}}
@keyframes slide{from{transform:translateY(10px);opacity:.3}to{transform:translateY(0);opacity:1}}
.track{stroke:#bdbab0}.wave{stroke:#c96a3f}
@media (prefers-color-scheme: dark){.track{stroke:#46443e}.wave{stroke:#f0a27c}}
${PALETTE_CSS}`

export function cardSvg(c: CardInput, l: CardLayout = { compact: false }): string {
  W = cardWidth(l.compact)
  const X = l.compact ? 14 : 66
  const titleLen = l.compact ? 20 : 22
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" overflow="hidden" style="display:block;overflow:hidden" class="${c.isPlaying ? 'on' : 'paused'}">` +
    `<style>${css()}</style>` +
    `<rect x="0" y="0" width="${W}" height="${H}" rx="6" class="bg"/>` +
    frame() +
    (l.compact ? '' : cassette(13, 12)) +
    `<text x="${X}" y="16" class="ink3 label">NOW PLAYING</text>` +
    eq(X + 41, 16.4) +
    `<circle cx="${W - 31}" cy="14.6" r="1.4" class="accent live" style="${anim(1.6)}"/>` +
    `<text x="${W - 14}" y="16.2" class="ink3 label" text-anchor="end">${c.isPlaying ? 'LIVE' : 'PAUSED'}</text>` +
    `<text x="${X}" y="27" class="ink title">${esc(cut(c.title, titleLen))}</text>` +
    `<text x="${X}" y="35" class="ink2 artist">${esc(cut(c.artist, l.compact ? 26 : 30))}</text>` +
    `<text x="${X}" y="42" class="ink3 mono">${esc(c.station)}</text>` +
    counter(14, 58, Math.floor(c.elapsedSec)) +
    slider(38, W - 38, 56, c) +
    `<text x="14" y="74" class="ink3 label">PLAYLIST</text>` +
    list(14, 85, c, l.compact) +
    `</svg>`
  )
}
