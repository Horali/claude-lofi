// MOCK: the pane's scene drawn as one SVG. A black-and-white ASCII world,
// one coloured pixel character, and motion done by CSS inside the picture
// (so it stays smooth without redrawing the pane).

const W = 200
const H = 230
const FONT = 5
const CW = FONT * 0.6
const LH = FONT * 1.15

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

function textRows(rows: string[], x: number, y0: number, cls: string): string {
  return rows
    .map((r, i) => `<text x="${x}" y="${(y0 + i * LH).toFixed(1)}" class="${cls}">${esc(r)}</text>`)
    .join('')
}

const COLS = Math.ceil(W / CW) // about 67 characters across

// A band of text twice as wide as the view, so it can slide and loop.
function band(rows: number, seed: number, cell: (x: number, y: number) => string): string[] {
  const out: string[] = []
  const wide = COLS * 2
  for (let y = 0; y < rows; y++) {
    let line = ''
    for (let x = 0; x < wide; x++) line += cell(x % COLS, y)
    out.push(line)
  }
  void seed
  return out
}

function stars(): string {
  const parts: string[] = []
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < COLS; x++) {
      const r = hash(x * 131 + y * 977 + 3)
      if (r < 0.03) {
        const ch = r < 0.006 ? '+' : r < 0.012 ? '*' : '.'
        const delay = (hash(x * 7 + y) * 4).toFixed(2)
        parts.push(
          `<text x="${(x * CW).toFixed(1)}" y="${(8 + y * LH).toFixed(1)}" class="star" style="animation-delay:-${delay}s">${ch}</text>`,
        )
      }
    }
  }
  return parts.join('')
}

function moon(): string {
  const rows = ['  .--.  ', ' (::::) ', '(::::::)', ' (::::) ', "  '--'  "]
  return textRows(rows, W - 46, 16, 'moon')
}

function clouds(): string {
  const rows = band(7, 11, (x, y) => {
    const n = noise(x / 9, 40 + y * 0) + noise(x / 4, 90) * 0.35
    const shape = n - Math.abs(y - 3) * 0.13
    return shape > 0.72 ? (shape > 0.85 ? ':' : '.') : ' '
  })
  return `<g class="drift-slow">${textRows(rows, 0, 40, 'cloud')}</g>`
}

function skyline(): string {
  const top = H - 9 * LH + 3 - 20 * LH
  const rows = band(20, 5, (x, y) => {
    const b = Math.floor(x / 5)
    const local = x % 5
    const height = 4 + Math.floor(hash(b * 31 + 5) * 15)
    const roof = 20 - height
    if (y < roof) return ' '
    if (y === roof) return local === 4 ? ' ' : '_'
    if (local === 4) return ' '
    if (local === 0 || local === 3) return '|'
    return hash(x * 17 + y * 3) < 0.28 ? '#' : ':'
  })
  return `<g class="drift-mid">${textRows(rows, 0, top, 'city')}</g>`
}

function ground(): string {
  const ramp = ' .:-=+*#%@'
  const rows: string[] = []
  for (let y = 0; y < 9; y++) {
    let line = ''
    const depth = (y + 1) / 9
    for (let x = 0; x < COLS * 2; x++) {
      const n = noise(x / 6, y * 13) * 0.35 + depth * 0.7
      line += ramp[Math.min(ramp.length - 1, Math.floor(n * ramp.length))]
    }
    rows.push(line)
  }
  return `<g class="drift-fast">${textRows(rows, 0, H - 9 * LH + 3, 'ground')}</g>`
}

function rain(): string {
  const drops: string[] = []
  for (let i = 0; i < 26; i++) {
    const x = (hash(i * 13) * W).toFixed(1)
    const d = (hash(i * 7) * 1.4).toFixed(2)
    drops.push(`<text x="${x}" y="0" class="drop" style="animation-delay:-${d}s">/</text>`)
  }
  return `<g>${drops.join('')}</g>`
}

// The character: an original pixel sprite. H band, C ear cups, O body,
// E eyes, M mouth, L laptop lid, G laptop glow.
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
const INK: Record<string, string> = { H: 'band', C: 'cup', O: 'body', E: 'eye', M: 'mouth', L: 'lid', G: 'glow' }

function character(x0: number, y0: number, px: number): string {
  const head: string[] = []
  const desk: string[] = []
  SPRITE.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const k = row[x]!
      if (k === '.') continue
      const rect = `<rect x="${x0 + x * px}" y="${y0 + y * px}" width="${px}" height="${px}" class="${INK[k]}"/>`
      ;(y < 8 ? head : desk).push(rect)
    }
  })
  const note = `<text x="${x0 + 17 * px}" y="${y0 + 2 * px}" class="note">♪</text>`
  return `<g class="bob" shape-rendering="crispEdges">${head.join('')}${note}</g><g shape-rendering="crispEdges">${desk.join('')}</g>`
}

const STYLE = `
text{font-family:ui-monospace,Consolas,'Cascadia Mono',monospace;font-size:${FONT}px;white-space:pre}
.bg{fill:#efede6}
.star{fill:#8a877d;animation:tw 4s ease-in-out infinite}
.moon{fill:#4a4842}
.cloud{fill:#b5b2a8}
.city{fill:#9a978d}
.ground{fill:#3d3b36}
.drop{fill:#a8a59b;animation:fall 1.4s linear infinite}
.body{fill:#d9774b}.mouth{fill:#a9532f}.eye{fill:#1d1b18}
.band{fill:#2f2d29}.cup{fill:#55534c}.lid{fill:#6b6960}.glow{fill:#f4f1e8}
.note{fill:#d9774b;font-size:8px;animation:tw 1.5s steps(2) infinite}
.bob{animation:bob 1.5s steps(1) infinite}
.drift-slow{animation:drift 120s linear infinite}
.drift-mid{animation:drift 60s linear infinite}
.drift-fast{animation:drift 30s linear infinite}
@keyframes drift{from{transform:translateX(0)}to{transform:translateX(-${(COLS * CW).toFixed(1)}px)}}
@keyframes tw{0%,100%{opacity:1}50%{opacity:.25}}
@keyframes fall{from{transform:translate(0,-10px)}to{transform:translate(-40px,${H}px)}}
@keyframes bob{0%{transform:translateY(0)}50%{transform:translateY(1px)}}
@media (prefers-color-scheme: dark){
.bg{fill:#151513}.star{fill:#8d8a80}.moon{fill:#d8d5cb}.cloud{fill:#4b4943}
.city{fill:#5f5c55}.ground{fill:#b9b6ac}.drop{fill:#55534c}
.band{fill:#e6e3d9}.cup{fill:#a9a69c}.eye{fill:#151513}.lid{fill:#8d8a80}.glow{fill:#fff8e6}}
`

export function sceneSvg(): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W * 2.4}" height="${H * 2.4}">` +
    `<style>${STYLE}</style>` +
    `<rect class="bg" shape-rendering="crispEdges" x="0" y="0" width="${W}" height="${H}" rx="4"/>` +
    stars() +
    moon() +
    clouds() +
    skyline() +
    ground() +
    rain() +
    character(W / 2 - 32, H - 9 * LH - 38, 4) +
    `</svg>`
  )
}
