// The sky follows the real clock: stars and a moon at night, a low sun and
// fewer stars at dawn and dusk, a sun and more clouds by day.

import { anim, band, COLS, CW, f1, hash, LH, noise, rows, W } from './svg-kit'

export type TimeOfDay = 'night' | 'dawn' | 'day' | 'dusk'

export function timeOfDay(hour: number): TimeOfDay {
  if (hour >= 5 && hour < 7) return 'dawn'
  if (hour >= 7 && hour < 17) return 'day'
  if (hour >= 17 && hour < 20) return 'dusk'
  return 'night'
}

/** Twinkling stars in the top `lines` rows; density 0..1. */
export function stars(lines: number, density: number, seed = 3): string {
  let out = ''
  for (let y = 0; y < lines; y++) {
    for (let x = 0; x < COLS; x++) {
      const r = hash(x * 131 + y * 977 + seed)
      if (r > 0.04 * density) continue
      const ch = r < 0.006 ? '+' : r < 0.014 ? '*' : '.'
      out += `<text x="${f1(x * CW)}" y="${f1(6 + y * LH)}" class="${r < 0.014 ? 'ink2' : 'ink3'} tw a" style="${anim(3 + hash(x + y * 31) * 6, hash(x * 7 + y) * 9)}">${ch}</text>`
    }
  }
  return out
}

export function moon(x: number, y: number): string {
  return (
    `<circle cx="${x + 11}" cy="${y + 8}" r="17" class="ink4 halo"/>` +
    rows(['  .--.  ', ' (::::) ', '(::::::)', ' (::::) ', "  '--'  "], x, y, 'ink')
  )
}

/** A sun with slowly turning rays; low and warm-edged at dawn and dusk. */
export function sun(x: number, y: number, low: boolean): string {
  const rays = ['\\  |  /', ' .---. ', '( ::: )', " '---' ", '/  |  \\']
  return (
    `<circle cx="${x + 9.5}" cy="${y + 7.5}" r="${low ? 20 : 16}" class="${low ? 'accent' : 'ink4'} halo" style="opacity:${low ? 0.12 : 0.35}"/>` +
    rows(rays, x, y, low ? 'ink2' : 'ink')
  )
}

export function clouds(top: number, seed: number, dur: number, scale: number, ink = 'ink3', opacity = 1): string {
  const lines = band(6, (x, y) => {
    const n = noise(x / (8 * scale), seed) + noise(x / 3, seed + 9) * 0.3
    const shape = n - Math.abs(y - 2.5) * 0.14
    return shape > 0.78 ? (shape > 0.9 ? ':' : '.') : ' '
  })
  return `<g class="drift a" style="${anim(dur, seed)};opacity:${opacity}">${rows(lines, 0, top, ink)}</g>`
}

export function plane(y: number): string {
  return (
    `<g class="cross a" style="${anim(57, 20)}"><g transform="translate(0,${y})">` +
    `<rect x="0" y="0" width="2" height="0.6" class="ink3"/><circle cx="1" cy="0.3" r="0.6" class="accent tw a" style="${anim(1.1)}"/></g></g>`
  )
}

export function shootingStar(): string {
  return (
    `<g class="shoot a" style="${anim(23, 9)}"><rect x="0" y="0" width="16" height="0.5" class="ink2" transform="rotate(18)"/>` +
    `<circle cx="15.5" cy="5" r="0.8" class="ink"/></g>`
  )
}

/** Birds by day: small v shapes crossing slowly. */
export function birds(y: number): string {
  return [0, 1, 2]
    .map(i => `<g class="cross a" style="${anim(41 + i * 7, i * 13)}"><text x="${i * 6}" y="${y + i * 3}" class="ink2">v</text></g>`)
    .join('')
}

/** The whole sky for an outdoor scene. */
export function sky(tod: TimeOfDay, opts: { starLines?: number; sunX?: number } = {}): string {
  const lines = opts.starLines ?? 14
  const x = opts.sunX ?? W - 52
  if (tod === 'night') {
    return stars(lines, 1) + moon(x, 14) + plane(30) + shootingStar() + clouds(34, 40, 290, 1.4, 'ink3', 0.7)
  }
  if (tod === 'day') {
    return sun(x, 10, false) + clouds(22, 40, 230, 1.4, 'ink3') + clouds(44, 11, 150, 1, 'ink2', 0.8) + birds(40)
  }
  // Dawn and dusk: a low sun near the horizon line, the last (or first) stars.
  return stars(Math.ceil(lines / 2), 0.4) + sun(dawnDuskX(tod), 46, true) + clouds(30, 40, 260, 1.4, 'ink3', 0.8) + plane(24)
}

const dawnDuskX = (tod: TimeOfDay) => (tod === 'dawn' ? 22 : W - 50)
