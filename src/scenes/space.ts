// Out in space: three layers of stars drifting at different speeds, a
// ringed planet, a blinking satellite, a comet now and then, and a small
// cratered moon where the character sits. Space has no time of day.

import { character, CHARACTER_CSS } from '../character'
import { anim, band, COLS, f1, H, hash, LH, noise, motes, ripple, rows, sceneDoc, W } from '../svg-kit'
import type { Scene } from './types'

const SURFACE = 162

function starLayer(seed: number, density: number, dur: number, ink: string, chars: string): string {
  const lines = band(Math.ceil(SURFACE / LH), (x, y) => {
    const r = hash(x * 97 + y * 389 + seed)
    return r < density ? chars[Math.floor((r / density) * chars.length)]! : ' '
  })
  return `<g class="drift a" style="${anim(dur, seed)}">${rows(lines, 0, 4, ink)}</g>`
}

function twinklers(): string {
  let out = ''
  for (let i = 0; i < 14; i++) {
    out += `<text x="${f1(hash(i * 31) * W)}" y="${f1(8 + hash(i * 37) * 120)}" class="ink tw a" style="${anim(2.5 + hash(i) * 5, hash(i * 2) * 6)}">${i % 4 ? '+' : '*'}</text>`
  }
  return out
}

function planet(x: number, y: number): string {
  return (
    `<circle cx="${x + 14}" cy="${y + 10}" r="22" class="ink4 halo"/>` +
    rows(
      ['      .-""-.      ', '    /:::::::\\    ', "--==|:::::::|==--", '    \\:::::::/    ', "      '-..-'      "],
      x - 10,
      y,
      'ink2',
    )
  )
}

function satellite(): string {
  return (
    `<g class="cross a" style="${anim(83, 30)}"><g transform="translate(0,58)">` +
    rows(['[=]-o-[=]'], 0, 0, 'ink3') +
    `<circle cx="13" cy="-1.6" r="0.7" class="accent tw a" style="${anim(1.3)}"/></g></g>`
  )
}

function comet(): string {
  return (
    `<g class="comet a" style="${anim(47, 12)}">` +
    `<rect x="-22" y="-0.3" width="22" height="0.6" class="ink3" transform="rotate(-12)"/>` +
    `<circle cx="0" cy="0" r="1.2" class="ink"/></g>`
  )
}

function surface(): string {
  const ramp = ' .:-=o'
  const lines: string[] = []
  const height = Math.ceil((H - SURFACE) / LH) + 1
  for (let y = 0; y < height; y++) {
    let line = ''
    for (let x = 0; x < COLS + 5; x++) {
      if (y === 0) {
        line += noise(x / 6, 5) > 0.7 ? '-' : '_'
        continue
      }
      const crater = noise(x / 3, y * 7 + 2)
      line += crater > 0.82 ? (y % 2 ? '(' : ')') : ramp[Math.min(ramp.length - 1, Math.floor((noise(x / 5, y * 11) * 0.5 + y / height / 2) * ramp.length))]
    }
    lines.push(line)
  }
  return ripple(lines, SURFACE, 'ink3', 9)
}

function flag(x: number): string {
  return rows(['|>>', '|  ', '|  ', '|  '], x, SURFACE - 4 * LH + 1, 'ink2')
}

export const space: Scene = {
  id: 'space',
  name: 'Space',
  alt: () => 'A tiny moon in deep space with a ringed planet, the pixel character in headphones at a laptop',
  build: ({ mood }) =>
    sceneDoc(
      starLayer(11, 0.012, 600, 'ink4', '..') +
        starLayer(23, 0.008, 300, 'ink3', '.*') +
        starLayer(37, 0.004, 140, 'ink2', '+*') +
        twinklers() +
        planet(130, 24) +
        satellite() +
        comet() +
        surface() +
        flag(160) +
        motes(12, 8, { x: 0, y: 20, w: 170, h: 110 }) +
        character(52, SURFACE - 31, 3, mood, { outfit: 'helmet', prop: 'float' }),
      CHARACTER_CSS +
        `.comet{opacity:0;animation-name:comet;animation-timing-function:linear}
@keyframes comet{0%{transform:translate(${W + 20}px,20px);opacity:0}2%{opacity:1}14%{transform:translate(-30px,70px);opacity:1}15%{opacity:0}100%{opacity:0}}`,
    ),
}

