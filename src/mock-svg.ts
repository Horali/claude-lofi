// MOCK: the scene as one SVG. A black-and-white ASCII city at night, seen
// from a rooftop, with one coloured pixel character. Every moving part has
// its own loop length (3 s to 4 min), so the whole picture rarely repeats.

import { FONT_STACK, PALETTE_CSS } from './theme-css'

const W = 200
const H = 200
const FONT = 4.6
const CW = FONT * 0.6
const LH = FONT * 1.12
const COLS = Math.ceil(W / CW)
const ROOF = 158 // y of the rooftop ledge

function hash(n: number): number {
  let x = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b)
  x ^= x >>> 13
  x = Math.imul(x, 0xc2b2ae35)
  x ^= x >>> 16
  return (x >>> 0) / 4294967296
}

function noise(x: number, seed: number): number {
  const i = Math.floor(x)
  const f = x - i
  const a = hash(i * 7919 + seed)
  const b = hash((i + 1) * 7919 + seed)
  const s = f * f * (3 - 2 * f)
  return a + (b - a) * s
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const f1 = (n: number) => n.toFixed(1)

function rows(lines: string[], x: number, y0: number, cls: string): string {
  return lines.map((r, i) => `<text x="${f1(x)}" y="${f1(y0 + i * LH)}" class="${cls}">${esc(r)}</text>`).join('')
}

// A band twice the view's width, so sliding it left by one width loops.
function band(height: number, cell: (x: number, y: number) => string): string[] {
  const out: string[] = []
  for (let y = 0; y < height; y++) {
    let line = ''
    for (let x = 0; x < COLS * 2; x++) line += cell(x % COLS, y)
    out.push(line)
  }
  return out
}

function stars(): string {
  let out = ''
  for (let y = 0; y < 14; y++) {
    for (let x = 0; x < COLS; x++) {
      const r = hash(x * 131 + y * 977 + 3)
      if (r > 0.04) continue
      const ch = r < 0.006 ? '+' : r < 0.014 ? '*' : '.'
      const dur = (3 + hash(x + y * 31) * 6).toFixed(1)
      const delay = (hash(x * 7 + y) * 9).toFixed(1)
      out += `<text x="${f1(x * CW)}" y="${f1(6 + y * LH)}" class="${r < 0.014 ? 'ink2' : 'ink3'} star" style="animation-duration:${dur}s;animation-delay:-${delay}s">${ch}</text>`
    }
  }
  return out
}

function moon(): string {
  const x = W - 52
  return (
    `<circle cx="${x + 11}" cy="22" r="17" class="ink4 halo"/>` +
    rows(['  .--.  ', ' (::::) ', '(::::::)', ' (::::) ', "  '--'  "], x, 14, 'ink moon')
  )
}

function shootingStar(): string {
  return (
    `<g class="shoot"><rect x="0" y="0" width="16" height="0.5" class="ink2" transform="rotate(18)"/>` +
    `<circle cx="15.5" cy="5" r="0.8" class="ink"/></g>`
  )
}

function plane(): string {
  return `<g class="plane"><rect x="0" y="0" width="2" height="0.6" class="ink3"/><circle cx="1" cy="0.3" r="0.6" class="accent blink"/></g>`
}

function clouds(top: number, seed: number, cls: string, scale: number): string {
  const lines = band(6, (x, y) => {
    const n = noise(x / (8 * scale), seed) + noise(x / 3, seed + 9) * 0.3
    const shape = n - Math.abs(y - 2.5) * 0.14
    return shape > 0.78 ? (shape > 0.9 ? ':' : '.') : ' '
  })
  return `<g class="${cls}">${rows(lines, 0, top, 'ink3')}</g>`
}

function towerHeight(b: number, seed: number, height: number): number {
  return Math.floor(height * 0.3) + Math.floor(hash(b * 31 + seed) * height * 0.7)
}

function skyline(top: number, height: number, width: number, seed: number, cls: string, ink: string, lit: boolean): string {
  const lines = band(height, (x, y) => {
    const b = Math.floor(x / width)
    const local = x % width
    const roof = height - towerHeight(b, seed, height)
    if (local === width - 1 || y < roof) return ' '
    if (y === roof) return '_'
    if (!lit) return hash(x * 17 + y * 3 + seed) < 0.55 ? ':' : '.'
    if (local === 0 || local === width - 2) return '|'
    return hash(x * 17 + y * 3 + seed) < 0.3 ? ':' : ' '
  })
  // A few windows that switch on and off on their own slow timers.
  let windows = ''
  if (lit) {
    for (let i = 0; i < 18; i++) {
      const x = Math.floor(hash(i * 41 + seed) * COLS)
      const local = x % width
      if (local === 0 || local >= width - 2) continue
      const tall = towerHeight(Math.floor(x / width), seed, height)
      const y = height - 1 - Math.floor(hash(i * 3 + seed) * (tall - 1))
      for (const copy of [0, COLS]) {
        windows += `<rect x="${f1((x + copy) * CW)}" y="${f1(top + y * LH - FONT * 0.75)}" width="${f1(CW * 0.9)}" height="${f1(FONT * 0.7)}" class="ink2 window" style="animation-duration:${(9 + hash(i) * 22).toFixed(1)}s;animation-delay:-${(hash(i * 5) * 30).toFixed(1)}s"/>`
      }
    }
  }
  return `<g class="${cls}">${rows(lines, 0, top, ink)}${windows}</g>`
}

function rain(): string {
  let out = ''
  for (let i = 0; i < 42; i++) {
    const x = f1(hash(i * 13) * (W + 60))
    const dur = (1.8 + hash(i * 7) * 1.6).toFixed(2)
    const delay = (hash(i * 11) * 4).toFixed(2)
    const cls = hash(i * 3) < 0.3 ? 'ink3' : 'ink4'
    out += `<text x="${x}" y="0" class="${cls} drop" style="animation-duration:${dur}s;animation-delay:-${delay}s">/</text>`
  }
  return out
}

function rooftop(): string {
  const ramp = ' .:-=+*#'
  const lines: string[] = []
  const height = Math.ceil((H - ROOF) / LH)
  for (let y = 0; y < height; y++) {
    let line = ''
    for (let x = 0; x < COLS; x++) {
      if (y === 0) {
        line += '='
        continue
      }
      const n = noise(x / 5, y * 13 + 4) * 0.4 + (y / height) * 0.55
      line += ramp[Math.min(ramp.length - 1, Math.floor(n * ramp.length))]
    }
    lines.push(line)
  }
  let puddles = ''
  for (let i = 0; i < 6; i++) {
    const x = f1(20 + hash(i * 9) * (W - 40))
    const y = f1(ROOF + 8 + hash(i * 4) * 22)
    puddles += `<text x="${x}" y="${y}" class="ink2 shimmer" style="animation-delay:-${(hash(i) * 5).toFixed(1)}s">~~~</text>`
  }
  return rows(lines, 0, ROOF, 'ink2') + puddles
}

function lamp(x: number): string {
  return (
    `<circle cx="${x + 4}" cy="${ROOF - 44}" r="14" class="ink4 lampglow"/>` +
    rows([' ___ ', '(_o_)', '  |  ', '  |  ', '  |  ', '  |  ', '  |  ', '  |  ', ' _|_ '], x, ROOF - 46, 'ink2')
  )
}

function plant(x: number): string {
  return rows([' \\|/ ', '--+--', ' /|\\ ', ' [_] '], x, ROOF - 18, 'ink3')
}

// The character: an original pixel sprite. H band, C ear cups, O body,
// E eyes, M mouth, L laptop lid, G screen glow on the lid.
const SPRITE = [
  '.....HHHHHH.....',
  '....H......H....',
  '...HOOOOOOOOH...',
  '..CCOOOOOOOOCC..',
  '..CCOEOOOOEOCC..',
  '..CCOOOOOOOOCC..',
  '...OOOOMMOOOO...',
  '...OOOOOOOOOO...',
  '..LLLLLLLLLLLL..',
  '..LLLLLGGLLLLL..',
  '..LLLLLLLLLLLL..',
]
const PART: Record<string, string> = { H: 'band', C: 'cup', O: 'body', E: 'eye', M: 'mouth', L: 'lid', G: 'glow' }

function character(x0: number, y0: number, px: number): string {
  const head: string[] = []
  const desk: string[] = []
  let lids = ''
  SPRITE.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const k = row[x]!
      if (k === '.') continue
      const rect = `<rect x="${x0 + x * px}" y="${y0 + y * px}" width="${px}" height="${px}" class="${PART[k]}"/>`
      if (y < 8) head.push(rect)
      else desk.push(rect)
      if (k === 'E') lids += `<rect x="${x0 + x * px}" y="${y0 + y * px}" width="${px}" height="${px}" class="body"/>`
    }
  })
  const mug =
    `<rect x="${x0 + 16 * px}" y="${y0 + 8 * px}" width="${px * 2}" height="${px * 3}" class="paper2"/>` +
    `<rect x="${x0 + 18 * px}" y="${y0 + 9 * px}" width="${px * 0.8}" height="${px}" class="paper2"/>`
  const steam = [0, 1, 2]
    .map(i => `<text x="${x0 + 16.4 * px + i * 2}" y="${y0 + 7.6 * px}" class="ink3 steam" style="animation-delay:-${i * 1.1}s">~</text>`)
    .join('')
  const note = `<text x="${x0 + 17 * px}" y="${y0 + 1.5 * px}" class="accent note">♪</text>`
  return (
    `<g class="bob" shape-rendering="crispEdges">${head.join('')}<g class="lids">${lids}</g></g>` +
    `<g shape-rendering="crispEdges">${desk.join('')}${mug}</g>` +
    steam +
    note
  )
}

const CSS = `
text{font-family:${FONT_STACK};font-size:${FONT}px;white-space:pre}
.body{fill:#d9774b}.mouth{fill:#a9532f}.eye{fill:#1d1b18}.band{fill:#2f2d29}.cup{fill:#55534c}
.lid{fill:#6b6960}.glow{fill:#f4f1e8}.paper2{fill:#e9e6dc}
@media (prefers-color-scheme: dark){.band{fill:#e6e3d9}.cup{fill:#a9a69c}.eye{fill:#151513}.lid{fill:#8d8a80}.glow{fill:#fff8e6}.paper2{fill:#cfccc2}}
.star{animation-name:tw;animation-iteration-count:infinite;animation-timing-function:ease-in-out}
.halo{opacity:.35}.lampglow{opacity:.3;animation:flick 23s steps(1) infinite}
.window{opacity:0;animation-name:win;animation-iteration-count:infinite;animation-timing-function:steps(1)}
.drop{animation-name:fall;animation-iteration-count:infinite;animation-timing-function:linear}
.shimmer{animation:tw 4.5s ease-in-out infinite}
.steam{animation:rise 3.3s ease-out infinite;opacity:0}
.note{font-size:7px;animation:notefloat 3s ease-in-out infinite}
.bob{animation:bob 1.5s steps(1) infinite}
.lids{opacity:0;animation:blink 6.3s steps(1) infinite}
.far{animation:drift 240s linear infinite}.mid{animation:drift 110s linear infinite}
.cloud1{animation:drift 170s linear infinite}.cloud2{animation:drift 290s linear infinite;opacity:.7}
.shoot{opacity:0;animation:shoot 23s linear infinite;animation-delay:-14s}
.plane{animation:plane 57s linear infinite;animation-delay:-20s}.blink{animation:tw 1.1s steps(2) infinite}
@keyframes drift{to{transform:translateX(-${f1(COLS * CW)}px)}}
@keyframes tw{0%,100%{opacity:1}50%{opacity:.2}}
@keyframes win{0%{opacity:0}30%{opacity:.9}55%{opacity:0}70%{opacity:.6}90%{opacity:0}}
@keyframes flick{0%{opacity:.3}91%{opacity:.08}92%{opacity:.3}94%{opacity:.1}95%{opacity:.3}}
@keyframes fall{from{transform:translate(0,-8px)}to{transform:translate(-55px,${H + 8}px)}}
@keyframes rise{0%{transform:translateY(0);opacity:0}25%{opacity:.8}100%{transform:translateY(-9px);opacity:0}}
@keyframes notefloat{0%,100%{transform:translateY(0);opacity:.2}50%{transform:translateY(-3px);opacity:1}}
@keyframes bob{0%{transform:translateY(0)}50%{transform:translateY(1px)}}
@keyframes blink{0%{opacity:0}97%{opacity:1}}
@keyframes shoot{0%{opacity:0;transform:translate(10px,4px)}1%{opacity:1}5%{opacity:0;transform:translate(90px,32px)}100%{opacity:0}}
@keyframes plane{from{transform:translate(${W + 10}px,30px)}to{transform:translate(-20px,12px)}}
${PALETTE_CSS}`

export function sceneSvg(): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" overflow="hidden" style="display:block;overflow:hidden">` +
    `<style>${CSS}</style>` +
    `<rect x="0" y="0" width="${W}" height="${H}" rx="6" class="bg"/>` +
    stars() +
    moon() +
    plane() +
    shootingStar() +
    clouds(34, 40, 'cloud2', 1.4) +
    skyline(ROOF - 18 * LH, 18, 6, 77, 'far', 'ink4', false) +
    clouds(52, 11, 'cloud1', 1) +
    skyline(ROOF - 13 * LH, 13, 8, 5, 'mid', 'ink3', true) +
    rain() +
    rooftop() +
    lamp(W - 28) +
    plant(12) +
    character(44, ROOF - 33, 3) +
    `</svg>`
  )
}