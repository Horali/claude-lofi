// Shared helpers for every scene SVG: a 200x200 drawing space, a small
// monospace grid for ASCII art, seeded noise, and clock-pinned animations.

import { FONT_STACK, PALETTE_CSS } from './theme-css'

export const W = 200
export const H = 200
export const FONT = 4.6
/** Width and line height of one ASCII cell. */
export const CW = FONT * 0.6
export const LH = FONT * 1.12
export const COLS = Math.ceil(W / CW)

export function hash(n: number): number {
  let x = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b)
  x ^= x >>> 13
  x = Math.imul(x, 0xc2b2ae35)
  x ^= x >>> 16
  return (x >>> 0) / 4294967296
}

/** Smooth 1-D value noise in 0..1. */
export function noise(x: number, seed: number): number {
  const i = Math.floor(x)
  const f = x - i
  const a = hash(i * 7919 + seed)
  const b = hash((i + 1) * 7919 + seed)
  const s = f * f * (3 - 2 * f)
  return a + (b - a) * s
}

export const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
export const f1 = (n: number) => n.toFixed(1)

/** Lines of ASCII art, one <text> per line. */
export function rows(lines: readonly string[], x: number, y0: number, cls: string, style = ''): string {
  const st = style ? ` style="${style}"` : ''
  return lines.map((r, i) => `<text x="${f1(x)}" y="${f1(y0 + i * LH)}" class="${cls}"${st}>${esc(r)}</text>`).join('')
}

/** A band twice the view's width, so sliding it left by one width loops. */
export function band(height: number, cell: (x: number, y: number) => string): string[] {
  const out: string[] = []
  for (let y = 0; y < height; y++) {
    let line = ''
    for (let x = 0; x < COLS * 2; x++) line += cell(x % COLS, y)
    out.push(line)
  }
  return out
}

// ---------- clock-pinned animation ----------
//
// Every animation gets its duration and phase inline. The phase is offset by
// the real clock when the SVG is built, so a rebuilt SVG (new mood, new song)
// picks up each loop where it would have been instead of starting over.

let clockSec = 0

/** Pin animations to this moment (seconds). Call before building an SVG. */
export function setClock(sec: number) {
  clockSec = sec
}

export function anim(dur: number, phase = 0): string {
  const at = (((phase + clockSec) % dur) + dur) % dur
  return `animation-duration:${dur}s;animation-delay:-${at.toFixed(2)}s`
}

/** The same for a SMIL element: a negative begin. */
export function smilBegin(dur: number, phase = 0): string {
  const at = (((phase + clockSec) % dur) + dur) % dur
  return `-${at.toFixed(2)}s`
}

// Keyframes shared by the scenes. Durations and delays come from anim().
const BASE_CSS = `
text{font-family:${FONT_STACK};font-size:${FONT}px;white-space:pre}
.a{animation-iteration-count:infinite}
.tw{animation-name:tw;animation-timing-function:ease-in-out}
.drift{animation-name:drift;animation-timing-function:linear}
.fall{animation-name:fall;animation-timing-function:linear}
.rise{animation-name:rise;animation-timing-function:ease-out;opacity:0}
.win{opacity:0;animation-name:win;animation-timing-function:steps(1)}
.flick{animation-name:flick;animation-timing-function:steps(1)}
.sway{animation-name:sway;animation-timing-function:ease-in-out;animation-direction:alternate}
.shoot{opacity:0;animation-name:shoot;animation-timing-function:linear}
.cross{animation-name:cross;animation-timing-function:linear}
.halo{opacity:.35}
@keyframes tw{0%,100%{opacity:1}50%{opacity:.2}}
@keyframes drift{to{transform:translateX(-${f1(COLS * CW)}px)}}
@keyframes fall{from{transform:translate(0,-8px)}to{transform:translate(-55px,${H + 8}px)}}
@keyframes rise{0%{transform:translateY(0);opacity:0}25%{opacity:.8}100%{transform:translateY(-12px);opacity:0}}
@keyframes win{0%{opacity:0}30%{opacity:.9}55%{opacity:0}70%{opacity:.6}90%{opacity:0}}
@keyframes flick{0%{opacity:.3}91%{opacity:.08}92%{opacity:.3}94%{opacity:.1}95%{opacity:.3}}
@keyframes sway{from{transform:translateY(-1px)}to{transform:translateY(1.5px)}}
@keyframes shoot{0%{opacity:0;transform:translate(10px,4px)}1%{opacity:1}5%{opacity:0;transform:translate(90px,32px)}100%{opacity:0}}
@keyframes cross{from{transform:translateX(${W + 20}px)}to{transform:translateX(-40px)}}
`

/** A whole scene document: fills its frame, crops to fill, clips at the edges. */
export function sceneDoc(body: string, css: string): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="100%" height="100%" preserveAspectRatio="xMidYMax slice" overflow="hidden" style="display:block;overflow:hidden">` +
    `<style>${BASE_CSS}${css}${PALETTE_CSS}</style>` +
    `<rect x="0" y="0" width="${W}" height="${H}" rx="6" class="bg"/>` +
    body +
    `</svg>`
  )
}
