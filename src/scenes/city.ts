// A rainy city seen from a rooftop: two skylines drifting at different
// speeds, windows switching on and off, rain, puddles, a street lamp.

import { character, CHARACTER_CSS } from '../character'
import { sky } from '../sky'
import { anim, band, COLS, CW, f1, FONT, H, hash, LH, noise, rows, sceneDoc, W } from '../svg-kit'
import type { Scene } from './types'

const ROOF = 158

function towerHeight(b: number, seed: number, height: number): number {
  return Math.floor(height * 0.3) + Math.floor(hash(b * 31 + seed) * height * 0.7)
}

function skyline(height: number, width: number, seed: number, dur: number, ink: string, lit: boolean, lights: boolean): string {
  const top = ROOF - height * LH
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
  if (lit && lights) {
    for (let i = 0; i < 18; i++) {
      const x = Math.floor(hash(i * 41 + seed) * COLS)
      const local = x % width
      if (local === 0 || local >= width - 2) continue
      const tall = towerHeight(Math.floor(x / width), seed, height)
      const y = height - 1 - Math.floor(hash(i * 3 + seed) * (tall - 1))
      for (const copy of [0, COLS]) {
        windows += `<rect x="${f1((x + copy) * CW)}" y="${f1(top + y * LH - FONT * 0.75)}" width="${f1(CW * 0.9)}" height="${f1(FONT * 0.7)}" class="ink2 win a" style="${anim(9 + hash(i) * 22, hash(i * 5) * 30)}"/>`
      }
    }
  }
  return `<g class="drift a" style="${anim(dur, seed)}">${rows(lines, 0, top, ink)}${windows}</g>`
}

function rain(): string {
  let out = ''
  for (let i = 0; i < 42; i++) {
    const cls = hash(i * 3) < 0.3 ? 'ink3' : 'ink4'
    out += `<text x="${f1(hash(i * 13) * (W + 60))}" y="0" class="${cls} fall a" style="${anim(1.8 + hash(i * 7) * 1.6, hash(i * 11) * 4)}">/</text>`
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
    puddles += `<text x="${f1(20 + hash(i * 9) * (W - 40))}" y="${f1(ROOF + 8 + hash(i * 4) * 22)}" class="ink2 tw a" style="${anim(4.5, hash(i) * 5)}">~~~</text>`
  }
  return rows(lines, 0, ROOF, 'ink2') + puddles
}

function lamp(x: number): string {
  return (
    `<circle cx="${x + 4}" cy="${ROOF - 44}" r="14" class="ink4 flick a" style="opacity:.3;${anim(23)}"/>` +
    rows([' ___ ', '(_o_)', '  |  ', '  |  ', '  |  ', '  |  ', '  |  ', '  |  ', ' _|_ '], x, ROOF - 46, 'ink2')
  )
}

export const city: Scene = {
  id: 'city',
  name: 'Rainy city',
  alt: ({ tod }) => `A rainy city rooftop (${tod}), with the pixel character in headphones at a laptop`,
  build: ({ tod, mood }) => {
    const lights = tod !== 'day'
    return sceneDoc(
      sky(tod) +
        skyline(18, 6, 77, 240, 'ink4', false, false) +
        skyline(13, 8, 5, 110, 'ink3', true, lights) +
        rain() +
        rooftop() +
        lamp(W - 28) +
        rows([' \\|/ ', '--+--', ' /|\\ ', ' [_] '], 12, ROOF - 18, 'ink3') +
        character(44, ROOF - 33, 3, mood, { outfit: 'raincoat', prop: 'umbrella' }),
      CHARACTER_CSS,
    )
  },
}
