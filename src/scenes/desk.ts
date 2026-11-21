// A desk by a window at home: the window shows the sky for the time of day
// with rain on the glass, a shelf of books, a desk lamp, a plant and a cat
// that flicks its tail.

import { character, CHARACTER_CSS } from '../character'
import { clouds, moon, stars, sun, type TimeOfDay } from '../sky'
import { anim, COLS, f1, H, hash, LH, noise, rows, sceneDoc, W } from '../svg-kit'
import type { Scene } from './types'

const DESK = 150
const WIN = { x: 104, y: 22, w: 84, h: 92 }

function wall(): string {
  // A faint texture so the wall is not empty.
  let out = ''
  for (let i = 0; i < 40; i++) {
    out += `<text x="${f1(hash(i * 3) * W)}" y="${f1(8 + hash(i * 5) * (DESK - 16))}" class="ink4">${i % 3 ? '.' : ':'}</text>`
  }
  return out
}

function windowView(tod: TimeOfDay): string {
  const { x, y, w, h } = WIN
  const clip = `<clipPath id="win"><rect x="${x}" y="${y}" width="${w}" height="${h}"/></clipPath>`
  const view =
    tod === 'night' ? stars(9, 1.4, 17) + moon(x + 50, y + 10) : tod === 'day' ? sun(x + 52, y + 8, false) : sun(x + 10, y + 52, true) + stars(4, 0.5, 17)
  let rain = ''
  for (let i = 0; i < 16; i++) {
    rain += `<rect x="${f1(x + hash(i * 7) * w)}" y="${f1(y)}" width="0.4" height="3" class="ink3 drip a" style="${anim(2.6 + hash(i) * 2.2, hash(i * 9) * 4)}"/>`
  }
  const frame =
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" class="frame" stroke-width="1.6"/>` +
    `<rect x="${x + w / 2 - 0.6}" y="${y}" width="1.2" height="${h}" class="ink3"/>` +
    `<rect x="${x}" y="${y + h / 2 - 0.6}" width="${w}" height="1.2" class="ink3"/>` +
    `<rect x="${x - 4}" y="${y + h}" width="${w + 8}" height="2.5" class="ink3"/>`
  return `${clip}<g clip-path="url(#win)">${view}${clouds(y + 26, 40, 210, 1.2, 'ink3', 0.8)}${rain}</g>${frame}`
}

function shelf(): string {
  const books = ['|#|', '|:|', '||', '|=|', '|:|', '/ /']
  let x = 10
  let out = `<rect x="6" y="56" width="70" height="1.5" class="ink3"/>`
  books.forEach((b, i) => {
    const tall = 3 + Math.floor(hash(i * 13) * 2)
    out += rows(Array.from({ length: tall }, () => b), x, 56 - tall * LH + 3, i % 2 ? 'ink2' : 'ink3')
    x += b.length * 2.8 + 1.5
  })
  return out + rows(['  _  ', ' (_) '], 56, 56 - 2 * LH + 3, 'ink3')
}

function lamp(): string {
  return (
    `<circle cx="27" cy="${DESK - 26}" r="20" class="ink4 lampglow a" style="${anim(31)}"/>` +
    rows(['  ____  ', ' /    \\ ', '/______\\', '   ||   ', '   ||   ', '  _||_  '], 14, DESK - 6 * LH, 'ink2')
  )
}

function deskTop(): string {
  const lines: string[] = []
  const height = Math.ceil((H - DESK) / LH)
  for (let y = 0; y < height; y++) {
    let line = ''
    for (let x = 0; x < COLS; x++) {
      line += y === 0 ? '=' : y === 1 ? '-' : noise(x / 7, y * 3) > 0.6 ? '-' : ' '
    }
    lines.push(line)
  }
  return rows(lines, 0, DESK, 'ink2')
}

function cat(x: number): string {
  return (
    rows([' /\\_/\\ ', '( -.- )', ' (   ) '], x, DESK - 3 * LH + 1, 'ink2') +
    `<g class="tail a" style="transform-origin:${x + 19}px ${DESK - 2}px;${anim(5.5)}">${rows([' ~'], x + 15, DESK - 1, 'ink2')}</g>`
  )
}

export const desk: Scene = {
  id: 'desk',
  name: 'Desk by a window',
  alt: ({ tod }) => `A desk by a rainy window (${tod}) with books, a lamp and a cat, the pixel character in headphones at a laptop`,
  build: ({ tod, mood }) =>
    sceneDoc(
      wall() +
        windowView(tod) +
        shelf() +
        lamp() +
        deskTop() +
        cat(150) +
        rows([' \\|/ ', ' [_] '], 34, DESK - 2 * LH + 1, 'ink3') +
        character(58, DESK - 31, 3, mood, { outfit: 'hoodie', prop: 'mug' }),
      CHARACTER_CSS +
        `.drip{animation-name:drip;animation-timing-function:linear}
@keyframes drip{from{transform:translateY(-4px)}to{transform:translateY(${WIN.h + 4}px)}}
.lampglow{opacity:.25;animation-name:lampglow;animation-timing-function:ease-in-out}
@keyframes lampglow{0%,100%{opacity:.25}50%{opacity:.18}}
.tail{animation-name:tail;animation-timing-function:ease-in-out}
@keyframes tail{0%,100%{transform:rotate(0)}10%{transform:rotate(-14deg)}20%{transform:rotate(6deg)}30%{transform:rotate(0)}}`,
    ),
}
