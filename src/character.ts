// The character: an original 16x11 pixel sprite with headphones. It is the
// only coloured thing in each scene, and it dresses for where it is.
//   working: the laptop comes out; it nods fast and the screen glow flickers
//   vibing:  no laptop; it bobs to the music with its scene's prop, notes float up
//   dozing:  eyes shut, slow breathing, z z z

import { anim, f1 } from './svg-kit'

export type Mood = 'working' | 'vibing' | 'dozing'
export type Outfit = 'none' | 'raincoat' | 'sailor' | 'beanie' | 'helmet' | 'hoodie'
export type Prop = 'none' | 'umbrella' | 'rod' | 'stick' | 'float' | 'mug'

// The head: H band, C ear cups, O face, E eyes, M mouth.
const HEAD = [
  '.....HHHHHH.....',
  '....H......H....',
  '...HOOOOOOOOH...',
  '..CCOOOOOOOOCC..',
  '..CCOEOOOOEOCC..',
  '..CCOOOOOOOOCC..',
  '...OOOOMMOOOO...',
  '...OOOOOOOOOO...',
]
// Below the head: a laptop while working (L lid, G glow), or shoulders (S).
const LAPTOP = ['..LLLLLLLLLLLL..', '..LLLLLGGLLLLL..', '..LLLLLLLLLLLL..']
const SHOULDERS = ['....SSSSSSSS....', '..SSSSSSSSSSSS..', '..SSSSSSSSSSSS..']

// Hats and hoods drawn over the head, as [first row, rows]. Y yellow coat,
// W white cap, N navy band, B beanie, b its fold, P pompom, D hoodie.
const HATS: Partial<Record<Outfit, [number, string[]]>> = {
  raincoat: [-1, ['....YYYYYYYY....', '...YYYYYYYYYY...', '..Y..........Y..', '.Y............Y.', '.Y............Y.', '.Y............Y.', '.Y............Y.', '..Y..........Y..']],
  sailor: [-2, ['.....WWWWWW.....', '....WWWWWWWW....', '...NNNNNNNNNN...', '..WWWWWWWWWWWW..']],
  beanie: [-3, ['.......PP.......', '.....BBBBBB.....', '....BBBBBBBB....', '...BBBBBBBBBB...', '...bbbbbbbbbb...']],
  hoodie: [-1, ['....DDDDDDDD....', '...DDDDDDDDDD...', '..D..........D..', '.D............D.', '.D............D.', '.D............D.', '.D............D.', '..D..........D..']],
}
const KEY: Record<string, string> = {
  H: 'band', C: 'cup', O: 'body', E: 'eye', M: 'mouth', L: 'lid', G: 'glow',
  Y: 'coat', W: 'cap', N: 'navy', B: 'knit', b: 'knit2', P: 'pom', D: 'hood',
}
const SHIRT: Record<Outfit, string> = { none: 'shirt', raincoat: 'coat', sailor: 'navy', beanie: 'knit2', helmet: 'suit', hoodie: 'hood' }

export type CharacterOptions = {
  outfit?: Outfit
  prop?: Prop
}

/** The character with its head's top-left corner at (x0, y0); px is one sprite pixel. */
export function character(x0: number, y0: number, px: number, mood: Mood, opts: CharacterOptions = {}): string {
  const outfit = opts.outfit ?? 'none'
  const prop = opts.prop ?? 'none'
  const cell = (x: number, y: number, cls: string, h = px, dy = 0, style = '') =>
    `<rect x="${f1(x0 + x * px)}" y="${f1(y0 + y * px + dy)}" width="${f1(px)}" height="${f1(h)}" class="${cls}"${style ? ` style="${style}"` : ''}/>`
  const paint = (rows: readonly string[], y0row: number, override?: Record<string, string>) => {
    let out = ''
    rows.forEach((row, i) => {
      for (let x = 0; x < row.length; x++) {
        const k = row[x]!
        if (k === '.') continue
        out += cell(x, y0row + i, override?.[k] ?? KEY[k]!)
      }
    })
    return out
  }

  // Head, with shut eyes while dozing and a blink otherwise.
  let head = ''
  let lids = ''
  HEAD.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const k = row[x]!
      if (k === '.') continue
      if (k === 'E' && mood === 'dozing') {
        head += cell(x, y, 'body') + cell(x, y, 'eye', px * 0.3, px * 0.55)
        continue
      }
      head += cell(x, y, KEY[k]!)
      if (k === 'E') lids += cell(x, y, 'body')
    }
  })
  const hat = HATS[outfit]
  if (hat) head += paint(hat[1], hat[0])
  if (outfit === 'helmet') {
    head += `<circle cx="${f1(x0 + 8 * px)}" cy="${f1(y0 + 4 * px)}" r="${f1(7.6 * px)}" class="glass"/>`
  }

  // Below the head: the laptop while working, otherwise shoulders in the outfit's colour.
  let below = ''
  if (mood === 'working') {
    LAPTOP.forEach((row, i) => {
      for (let x = 0; x < row.length; x++) {
        const k = row[x]!
        if (k === '.') continue
        below += k === 'G' ? cell(x, 8 + i, 'glow typing a', px, 0, anim(0.45, x * 0.2)) : cell(x, 8 + i, 'lid')
      }
    })
  } else {
    below = paint(SHOULDERS, 8, { S: SHIRT[outfit] })
  }

  const motion = mood === 'working' ? ['nod', 0.6] : mood === 'dozing' ? ['breathe', 4.2] : ['bob', 1.5]
  const blink = mood === 'dozing' ? '' : `<g class="lids a" style="${anim(6.3, 2)}">${lids}</g>`
  const body =
    `<g shape-rendering="crispEdges"><g class="${motion[0]} a" style="${anim(motion[1] as number)}">${head}${blink}</g>` + `${below}</g>`

  return (prop === 'umbrella' ? umbrella(x0, y0, px) : '') + (prop === 'float' ? `<g class="floaty a" style="${anim(6.5)}">${body}${extras(x0, y0, px, mood, prop)}</g>` : body + extras(x0, y0, px, mood, prop))
}

function umbrella(x0: number, y0: number, px: number): string {
  // Held over the head on the right, so the face stays clear.
  const canopy = ['.......UUUUUUUU.......', '....UUUUUUUUUUUUUU....', '..UUUUUUUUUUUUUUUUUU..', '..U...U...U...U...U..']
  let out = ''
  canopy.forEach((row, i) => {
    for (let x = 0; x < row.length; x++) {
      if (row[x] === 'U') out += `<rect x="${f1(x0 + (x - 1) * px)}" y="${f1(y0 + (i - 10) * px)}" width="${f1(px)}" height="${f1(px)}" class="umb"/>`
    }
  })
  const hx = x0 + 9.8 * px
  return (
    `<g shape-rendering="crispEdges" class="sway a" style="${anim(5.1)}">${out}` +
    `<rect x="${f1(hx)}" y="${f1(y0 - 7 * px)}" width="${f1(px * 0.4)}" height="${f1(px * 5.6)}" class="handle"/></g>`
  )
}

function extras(x0: number, y0: number, px: number, mood: Mood, prop: Prop): string {
  let out = ''
  if (prop === 'mug') {
    out +=
      `<rect x="${f1(x0 + 16 * px)}" y="${f1(y0 + 8 * px)}" width="${f1(px * 2)}" height="${f1(px * 3)}" class="paper2"/>` +
      `<rect x="${f1(x0 + 18 * px)}" y="${f1(y0 + 9 * px)}" width="${f1(px * 0.8)}" height="${f1(px)}" class="paper2"/>`
    for (let i = 0; i < 3; i++) {
      out += `<text x="${f1(x0 + 16.4 * px + i * 2)}" y="${f1(y0 + 7.6 * px)}" class="ink3 rise a" style="${anim(3.3, i * 1.1)}">~</text>`
    }
  }
  if (mood !== 'working') {
    if (prop === 'rod') {
      // A fishing rod over the side, the line dipping into the water, the float bobbing.
      const hx = x0 + 14 * px
      const hy = y0 + 9 * px
      const tx = x0 + 26 * px
      const ty = y0 - 1 * px
      out +=
        `<line x1="${f1(hx)}" y1="${f1(hy)}" x2="${f1(tx)}" y2="${f1(ty)}" class="rod"/>` +
        `<line x1="${f1(tx)}" y1="${f1(ty)}" x2="${f1(tx)}" y2="${f1(y0 + 15 * px)}" class="fishline"/>` +
        `<circle cx="${f1(tx)}" cy="${f1(y0 + 15 * px)}" r="${f1(px * 0.5)}" class="coat sway a" style="${anim(2.2)}"/>`
    }
    if (prop === 'stick') {
      // Toasting a marshmallow towards the fire on the right; it glows now and then.
      const hx = x0 + 14 * px
      const hy = y0 + 9 * px
      const tx = x0 + 22 * px
      const ty = y0 + 6.5 * px
      out +=
        `<line x1="${f1(hx)}" y1="${f1(hy)}" x2="${f1(tx)}" y2="${f1(ty)}" class="rod"/>` +
        `<rect x="${f1(tx)}" y="${f1(ty - px * 0.7)}" width="${f1(px * 1.4)}" height="${f1(px * 1.2)}" class="paper2 toast a" style="${anim(9)}"/>`
    }
  }
  if (mood === 'vibing') {
    out +=
      `<text x="${f1(x0 + 16.5 * px)}" y="${f1(y0 + 1.5 * px)}" class="accent note a" style="${anim(3)}">♪</text>` +
      `<text x="${f1(x0 - 2.5 * px)}" y="${f1(y0 + 2.5 * px)}" class="accent note a" style="${anim(3.7, 1.6)}">♫</text>`
  } else if (mood === 'dozing') {
    ;['z', 'z', 'Z'].forEach((z, i) => {
      out += `<text x="${f1(x0 + (14 + i * 1.4) * px)}" y="${f1(y0 + (1.5 - i * 0.6) * px)}" class="ink2 zz a" style="${anim(4.5, i * 1.5)}">${z}</text>`
    })
  } else {
    for (let i = 0; i < 3; i++) {
      out += `<text x="${f1(x0 + (5 + i * 3) * px)}" y="${f1(y0 + 7.8 * px)}" class="ink3 rise a" style="${anim(1.3, i * 0.45)}">'</text>`
    }
  }
  return out
}

export const CHARACTER_CSS = `
.body{fill:#d9774b}.mouth{fill:#a9532f}.eye{fill:#1d1b18}.band{fill:#2f2d29}.cup{fill:#55534c}
.lid{fill:#6b6960}.glow{fill:#f4f1e8}.paper2{fill:#e9e6dc}.shirt{fill:#6b6960}
.coat{fill:#e3b341}.cap{fill:#f3f0e8}.navy{fill:#3b4a6b}.knit{fill:#4f8a8b}.knit2{fill:#3d6e6f}.pom{fill:#f3f0e8}
.hood{fill:#7a6a8c}.umb{fill:#b8564f}.suit{fill:#c9c6bd}.handle{fill:#8f8c82}
.glass{fill:#9ec5d8;fill-opacity:.12;stroke:#9ec5d8;stroke-opacity:.7;stroke-width:.8}
.rod{stroke:#8f8c82;stroke-width:.7}.fishline{stroke:#8f8c82;stroke-width:.25}
@media (prefers-color-scheme: dark){.band{fill:#e6e3d9}.cup{fill:#a9a69c}.eye{fill:#151513}.lid{fill:#8d8a80}.glow{fill:#fff8e6}.paper2{fill:#cfccc2}.shirt{fill:#8d8a80}.handle{fill:#b3b0a6}.rod{stroke:#b3b0a6}.fishline{stroke:#77746b}}
.typing{animation-name:tw;animation-timing-function:steps(2)}
.note{font-size:7px;animation-name:notefloat;animation-timing-function:ease-in-out}
.zz{font-size:6px;opacity:0;animation-name:zfloat;animation-timing-function:ease-out}
.bob{animation-name:bob;animation-timing-function:steps(1)}
.nod{animation-name:nod;animation-timing-function:ease-in-out}
.breathe{animation-name:breathe;animation-timing-function:ease-in-out}
.floaty{animation-name:floaty;animation-timing-function:ease-in-out}
.toast{animation-name:toast;animation-timing-function:ease-in-out}
.lids{opacity:0;animation-name:blink;animation-timing-function:steps(1)}
@keyframes notefloat{0%,100%{transform:translateY(0);opacity:.2}50%{transform:translateY(-3px);opacity:1}}
@keyframes zfloat{0%{transform:translate(0,0);opacity:0}20%{opacity:.9}100%{transform:translate(4px,-10px);opacity:0}}
@keyframes bob{0%{transform:translateY(0)}50%{transform:translateY(1px)}}
@keyframes nod{0%,100%{transform:translateY(0)}50%{transform:translateY(1.2px)}}
@keyframes breathe{0%,100%{transform:translateY(0)}50%{transform:translateY(.6px)}}
@keyframes floaty{0%,100%{transform:translate(0,0)}50%{transform:translate(1.5px,-4px)}}
@keyframes toast{0%,60%,100%{fill:#e9e6dc}80%{fill:#e0a060}}
@keyframes blink{0%{opacity:0}97%{opacity:1}}
`
