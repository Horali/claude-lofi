// The character: an original 16x11 pixel sprite with headphones, sitting
// behind a laptop. It is the only coloured thing in each scene.
//   working: nods fast while a tool call runs; the laptop glow flickers
//   vibing:  bobs to the music; notes float up
//   dozing:  eyes shut, slow breathing, z z z

import { anim, f1 } from './svg-kit'

export type Mood = 'working' | 'vibing' | 'dozing'

// H band, C ear cups, O body, E eyes, M mouth, L laptop lid, G glow on the lid.
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

/** Size of the sprite in pixels (cells). */
export const SPRITE_W = 16
export const SPRITE_H = SPRITE.length

export type CharacterOptions = {
  /** A mug of something warm beside the laptop. */
  mug?: boolean
}

/** The character with its top-left corner at (x0, y0); px is one sprite pixel. */
export function character(x0: number, y0: number, px: number, mood: Mood, opts: CharacterOptions = {}): string {
  const cell = (x: number, y: number, cls: string, h = px, dy = 0) =>
    `<rect x="${f1(x0 + x * px)}" y="${f1(y0 + y * px + dy)}" width="${f1(px)}" height="${f1(h)}" class="${cls}"/>`
  const head: string[] = []
  const desk: string[] = []
  let lids = ''
  SPRITE.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const k = row[x]!
      if (k === '.') continue
      if (k === 'E' && mood === 'dozing') {
        // Shut eyes: skin with a thin dark line.
        head.push(cell(x, y, 'body'), cell(x, y, 'eye', px * 0.3, px * 0.55))
        continue
      }
      const glow = k === 'G' ? (mood === 'working' ? ' glow typing a' : mood === 'dozing' ? ' glow dim' : ' glow') : ''
      const r = k === 'G' ? cell(x, y, `${PART[k]}${glow}`).replace('/>', ` style="${mood === 'working' ? anim(0.45, x * 0.2) : ''}"/>`) : cell(x, y, PART[k]!)
      if (y < 8) head.push(r)
      else desk.push(r)
      if (k === 'E') lids += cell(x, y, 'body')
    }
  })

  const motion = mood === 'working' ? `nod a" style="${anim(0.6)}` : mood === 'dozing' ? `breathe a" style="${anim(4.2)}` : `bob a" style="${anim(1.5)}`
  const blink = mood === 'dozing' ? '' : `<g class="lids a" style="${anim(6.3, 2)}">${lids}</g>`

  let extra = ''
  if (opts.mug) {
    extra +=
      `<rect x="${f1(x0 + 16 * px)}" y="${f1(y0 + 8 * px)}" width="${f1(px * 2)}" height="${f1(px * 3)}" class="paper2"/>` +
      `<rect x="${f1(x0 + 18 * px)}" y="${f1(y0 + 9 * px)}" width="${f1(px * 0.8)}" height="${f1(px)}" class="paper2"/>`
    for (let i = 0; i < 3; i++) {
      extra += `<text x="${f1(x0 + 16.4 * px + i * 2)}" y="${f1(y0 + 7.6 * px)}" class="ink3 rise a" style="${anim(3.3, i * 1.1)}">~</text>`
    }
  }
  if (mood === 'vibing') {
    extra +=
      `<text x="${f1(x0 + 16.5 * px)}" y="${f1(y0 + 1.5 * px)}" class="accent note a" style="${anim(3)}">♪</text>` +
      `<text x="${f1(x0 - 2.5 * px)}" y="${f1(y0 + 2.5 * px)}" class="accent note a" style="${anim(3.7, 1.6)}">♫</text>`
  } else if (mood === 'dozing') {
    ;['z', 'z', 'Z'].forEach((z, i) => {
      extra += `<text x="${f1(x0 + (14 + i * 1.4) * px)}" y="${f1(y0 + (1.5 - i * 0.6) * px)}" class="ink2 zz a" style="${anim(4.5, i * 1.5)}">${z}</text>`
    })
  } else {
    for (let i = 0; i < 3; i++) {
      extra += `<text x="${f1(x0 + (5 + i * 3) * px)}" y="${f1(y0 + 7.8 * px)}" class="ink3 rise a" style="${anim(1.3, i * 0.45)}">'</text>`
    }
  }

  return (
    `<g shape-rendering="crispEdges"><g class="${motion}">${head.join('')}${blink}</g>` +
    `${desk.join('')}</g>` +
    extra
  )
}

export const CHARACTER_CSS = `
.body{fill:#d9774b}.mouth{fill:#a9532f}.eye{fill:#1d1b18}.band{fill:#2f2d29}.cup{fill:#55534c}
.lid{fill:#6b6960}.glow{fill:#f4f1e8}.paper2{fill:#e9e6dc}
@media (prefers-color-scheme: dark){.band{fill:#e6e3d9}.cup{fill:#a9a69c}.eye{fill:#151513}.lid{fill:#8d8a80}.glow{fill:#fff8e6}.paper2{fill:#cfccc2}}
.dim{opacity:.35}
.typing{animation-name:tw;animation-timing-function:steps(2)}
.note{font-size:7px;animation-name:notefloat;animation-timing-function:ease-in-out}
.zz{font-size:6px;opacity:0;animation-name:zfloat;animation-timing-function:ease-out}
.bob{animation-name:bob;animation-timing-function:steps(1)}
.nod{animation-name:nod;animation-timing-function:ease-in-out}
.breathe{animation-name:breathe;animation-timing-function:ease-in-out}
.lids{opacity:0;animation-name:blink;animation-timing-function:steps(1)}
@keyframes notefloat{0%,100%{transform:translateY(0);opacity:.2}50%{transform:translateY(-3px);opacity:1}}
@keyframes zfloat{0%{transform:translate(0,0);opacity:0}20%{opacity:.9}100%{transform:translate(4px,-10px);opacity:0}}
@keyframes bob{0%{transform:translateY(0)}50%{transform:translateY(1px)}}
@keyframes nod{0%,100%{transform:translateY(0)}50%{transform:translateY(1.2px)}}
@keyframes breathe{0%,100%{transform:translateY(0)}50%{transform:translateY(.6px)}}
@keyframes blink{0%{opacity:0}97%{opacity:1}}
`
