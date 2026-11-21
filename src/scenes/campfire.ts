// A forest clearing: two rows of pines drifting slowly, a tent, a campfire
// whose flames flicker through three shapes, sparks, and fireflies.

import { character, CHARACTER_CSS } from '../character'
import { sky } from '../sky'
import { anim, band, COLS, f1, H, hash, LH, noise, rows, sceneDoc, W } from '../svg-kit'
import type { Scene } from './types'

const GROUND = 160

function pines(height: number, spacing: number, seed: number, dur: number, ink: string): string {
  const top = GROUND - height * LH
  const lines = band(height, (x, y) => {
    const t = Math.floor(x / spacing)
    const centre = t * spacing + Math.floor(spacing / 2)
    const tall = Math.floor(height * (0.55 + hash(t * 13 + seed) * 0.45))
    const tip = height - tall
    if (y < tip) return ' '
    const dx = x - centre
    if (y >= height - 1) return dx === 0 ? '|' : hash(x + seed) < 0.3 ? '.' : ' '
    const half = Math.floor((y - tip) * 0.55)
    if (Math.abs(dx) > half) return ' '
    if (dx === -half) return '/'
    if (dx === half) return '\\'
    return y === tip ? '^' : hash(x * 7 + y * 3 + seed) < 0.4 ? ':' : ' '
  })
  return `<g class="drift a" style="${anim(dur, seed)}">${rows(lines, 0, top, ink)}</g>`
}

function ground(): string {
  const ramp = ' .,:;i*#'
  const lines: string[] = []
  const height = Math.ceil((H - GROUND) / LH)
  for (let y = 0; y < height; y++) {
    let line = ''
    for (let x = 0; x < COLS; x++) {
      const n = noise(x / 4, y * 19 + 8) * 0.45 + (y / height) * 0.5
      line += y === 0 ? (hash(x) < 0.25 ? ',' : '_') : ramp[Math.min(ramp.length - 1, Math.floor(n * ramp.length))]
    }
    lines.push(line)
  }
  return rows(lines, 0, GROUND, 'ink3')
}

function tent(x: number): string {
  return rows(['    /\\    ', '   /  \\   ', '  / /\\ \\  ', ' / /  \\ \\ ', '/_/____\\_\\'], x, GROUND - 5 * LH + 1, 'ink2')
}

function fire(x: number): string {
  const y = GROUND - 4 * LH
  // Three flame shapes shown in turn: a flicker without redrawing.
  const shapes = [
    ['  (  ', ' ) ( ', '( )  ', ' )() '],
    [' )   ', '  ( )', ' ( ) ', '(  ) '],
    ['   ) ', ' (   ', ' )( )', ' ( ()'],
  ]
  const flames = shapes
    .map((s, i) => `<g class="frame3 a" style="${anim(0.9, i * 0.3)}">${rows(s, x, y, 'accent')}</g>`)
    .join('')
  let sparks = ''
  for (let i = 0; i < 6; i++) {
    sparks += `<text x="${f1(x + 3 + hash(i * 5) * 9)}" y="${f1(y - 2)}" class="accent spark a" style="${anim(1.7 + hash(i) * 1.5, hash(i * 9) * 3)}">.</text>`
  }
  const glow = `<circle cx="${x + 7}" cy="${GROUND - 6}" r="22" class="accent glowpulse a" style="${anim(2.3)}"/>`
  return glow + flames + sparks + rows(['=\\_/=', '/==\\\\'], x, GROUND - 0.4 * LH, 'ink2')
}

function fireflies(): string {
  let out = ''
  for (let i = 0; i < 9; i++) {
    const x = 10 + hash(i * 17) * (W - 20)
    const y = 95 + hash(i * 23) * 50
    out += `<circle cx="${f1(x)}" cy="${f1(y)}" r="0.8" class="ink firefly a" style="${anim(7 + hash(i) * 9, hash(i * 3) * 10)}"/>`
  }
  return out
}

export const campfire: Scene = {
  id: 'campfire',
  name: 'Forest campfire',
  alt: ({ tod }) => `A forest campfire (${tod}) by a tent, the pixel character in headphones at a laptop beside it`,
  build: ({ tod, mood }) =>
    sceneDoc(
      sky(tod) +
        pines(20, 9, 31, 380, 'ink4') +
        pines(14, 13, 8, 170, 'ink3') +
        ground() +
        tent(12) +
        (tod === 'day' ? '' : fireflies()) +
        fire(132) +
        character(70, GROUND - 31, 3, mood, { outfit: 'beanie', prop: 'stick' }),
      CHARACTER_CSS +
        `.frame3{opacity:0;animation-name:frame3;animation-timing-function:steps(1)}
@keyframes frame3{0%{opacity:1}33.3%{opacity:0}}
.spark{animation-name:spark;animation-timing-function:ease-out;opacity:0}
@keyframes spark{0%{transform:translate(0,0);opacity:1}100%{transform:translate(3px,-22px);opacity:0}}
.glowpulse{animation-name:glowpulse;animation-timing-function:ease-in-out}
@keyframes glowpulse{0%,100%{opacity:.08}50%{opacity:.16}}
.firefly{animation-name:fly;animation-timing-function:ease-in-out;opacity:0}
@keyframes fly{0%{transform:translate(0,0);opacity:0}20%{opacity:.9}50%{transform:translate(6px,-5px);opacity:.3}80%{opacity:.9}100%{transform:translate(-3px,2px);opacity:0}}`,
    ),
}
