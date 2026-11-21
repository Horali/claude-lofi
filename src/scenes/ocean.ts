// The open sea: a far island with a lighthouse, waves drifting at three
// speeds, light glittering on the water, and a small boat rocking.

import { character, CHARACTER_CSS } from '../character'
import { sky } from '../sky'
import { anim, band, f1, H, hash, LH, noise, motes, rows, sceneDoc, W } from '../svg-kit'
import type { Scene } from './types'

const SEA = 112

function island(): string {
  const height = 7
  const lines = band(height, (x, y) => {
    const n = noise(x / 9, 21) * 1.1 - 0.35
    const top = height - Math.max(0, Math.round(n * height * 1.4))
    if (y < top) return ' '
    if (y === top) return n > 0.5 ? '^' : '_'
    return hash(x * 5 + y) < 0.5 ? ':' : '.'
  })
  return `<g class="drift a" style="${anim(420, 7)}">${rows(lines, 0, SEA - height * LH, 'ink4')}</g>`
}

function lighthouse(x: number, night: boolean): string {
  // At night the lamp turns: a soft glow that comes and goes.
  const beam = night ? `<circle cx="${x + 6}" cy="${SEA - 29}" r="5" class="ink2 beam a" style="${anim(4.2)}"/>` : ''
  return beam + rows(['  _  ', ' [#] ', ' | | ', ' |:| ', ' | | ', '_/_\\_', '/^^^^\\'], x, SEA - 30, 'ink3')
}

function waves(): string {
  let out = ''
  const lines = Math.ceil((H - SEA) / LH)
  for (let y = 0; y < lines; y++) {
    const depth = y / lines
    const row = band(1, x => {
      const n = noise(x / (3 + depth * 4), y * 17 + 3)
      if (n > 0.72 - depth * 0.25) return '~'
      if (n > 0.55 - depth * 0.2) return '-'
      return hash(x * 3 + y * 11) < 0.15 + depth * 0.25 ? '.' : ' '
    })
    const ink = depth < 0.3 ? 'ink4' : depth < 0.65 ? 'ink3' : 'ink2'
    // Nearer rows move faster: the parallax of the sea.
    out += `<g class="drift a" style="${anim(160 - depth * 120, y * 9)}">${rows(row, 0, SEA + y * LH, ink)}</g>`
  }
  return out
}

/** Light on the water under the moon or sun: short dashes that twinkle. */
function glitter(x: number): string {
  let out = ''
  for (let i = 0; i < 14; i++) {
    const y = SEA + 3 + i * 3.2
    const spread = 3 + i * 1.4
    const dx = (hash(i * 7) - 0.5) * spread * 2
    out += `<text x="${f1(x + dx)}" y="${f1(y)}" class="ink tw a" style="${anim(1.6 + hash(i) * 2.4, hash(i * 3) * 3)}">${i % 3 ? '-' : '='}</text>`
  }
  return out
}

function boat(mood: Parameters<typeof character>[3]): string {
  const x = 34
  const deck = 160
  const hull = rows(['_______________________________', '\\                             /', ' \\___________________________/'], x, deck, 'ink')
  const mast = rows(['|\\', '| \\', '|  \\', '|   \\', '|    \\', '|_____\\'], x + 66, deck - 6 * 4.6 * 1.12 + 1, 'ink2')
  return (
    `<g class="sway a" style="${anim(3.8)}">` +
    motes(8, 2, { x: 0, y: 30, w: 170, h: 60 }) +
    character(x + 14, deck - 31, 3, mood, { outfit: 'sailor', prop: 'rod' }) +
    mast +
    hull +
    `</g>`
  )
}

export const ocean: Scene = {
  id: 'ocean',
  name: 'Ocean boat',
  alt: ({ tod }) => `A small boat on the open sea (${tod}), the pixel character in headphones on deck with a laptop`,
  build: ({ tod, mood }) => {
    const night = tod === 'night' || tod === 'dusk'
    const lightX = tod === 'dawn' ? 30 : W - 42
    return sceneDoc(
      sky(tod) + island() + lighthouse(16, night) + waves() + glitter(lightX) + boat(mood),
      CHARACTER_CSS +
        `.beam{opacity:0;animation-name:beam;animation-timing-function:ease-in-out}
@keyframes beam{0%,100%{opacity:0}40%{opacity:.45}60%{opacity:.45}}`,
    )
  },
}

