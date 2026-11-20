// MOCK: the "now playing" card as one SVG. A cassette with turning reels,
// the song, a minutes-played counter that ticks by CSS alone, level bars,
// a live dot, a spark running round the frame, and recently played.

import { FONT_STACK, PALETTE_CSS } from './theme-css'

export type Track = { at: string; artist: string; title: string }
export type CardInput = {
  title: string
  artist: string
  station: string
  elapsedSec: number
  isPlaying: boolean
  recent: readonly Track[]
}

const W = 200
const H = 140
// Room at the top for the play and next buttons, which the pane lays over the card.
const TOP = 12

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const cut = (s: string, n: number) => ([...s].length > n ? [...s].slice(0, n - 1).join('') + '…' : s)

// One digit: a strip of numerals behind a small window. CSS steps the strip,
// so the counter ticks without the pane redrawing.
function digit(x: number, y: number, period: number, count: number, elapsed: number): string {
  const strip = Array.from({ length: count }, (_, i) => `<tspan x="0" dy="${i === 0 ? 0 : 9}">${i}</tspan>`).join('')
  return (
    `<svg x="${x}" y="${y - 7.5}" width="5" height="9" overflow="hidden">` +
    `<text y="7.5" class="ink digits roll${count}" style="animation-duration:${period}s;animation-delay:-${elapsed}s">${strip}</text>` +
    `</svg>`
  )
}

function counter(x: number, y: number, e: number): string {
  return (
    digit(x, y, 6000, 6, e) +
    digit(x + 5, y, 600, 10, e) +
    `<text x="${x + 10}" y="${y}" class="ink3 digits">:</text>` +
    digit(x + 14, y, 60, 6, e) +
    digit(x + 19, y, 10, 10, e)
  )
}

function reel(cx: number, cy: number): string {
  return (
    `<g class="reel" style="transform-origin:${cx}px ${cy}px">` +
    `<circle cx="${cx}" cy="${cy}" r="5" class="paper"/>` +
    `<rect x="${cx - 0.6}" y="${cy - 4.5}" width="1.2" height="9" class="ink2"/>` +
    `<rect x="${cx - 4.5}" y="${cy - 0.6}" width="9" height="1.2" class="ink2"/>` +
    `</g>`
  )
}

function cassette(x: number, y: number): string {
  return (
    `<g shape-rendering="crispEdges">` +
    `<rect x="${x}" y="${y}" width="44" height="28" rx="2" class="ink4"/>` +
    `<rect x="${x + 3}" y="${y + 3}" width="38" height="5" class="paper"/>` +
    `<rect x="${x + 5}" y="${y + 4.6}" width="16" height="1.6" class="accent"/>` +
    `<rect x="${x + 7}" y="${y + 9}" width="30" height="10" rx="1" class="ink3"/>` +
    `<rect x="${x + 12}" y="${y + 22}" width="20" height="4" class="ink3"/>` +
    `</g>` +
    reel(x + 14, y + 14) +
    reel(x + 30, y + 14)
  )
}

function bars(x: number, y: number, n: number, w: number, h: number): string {
  let out = ''
  for (let i = 0; i < n; i++) {
    const d = (0.55 + ((i * 37) % 23) / 30).toFixed(2)
    const delay = (((i * 53) % 17) / 10).toFixed(2)
    out += `<rect x="${(x + i * (w + 1.2)).toFixed(1)}" y="${y - h}" width="${w}" height="${h}" class="accent bar" style="animation-duration:${d}s;animation-delay:-${delay}s"/>`
  }
  return `<g shape-rendering="crispEdges">${out}</g>`
}

function frame(): string {
  const corner = (x: number, y: number, ch: string, delay: number) =>
    `<text x="${x}" y="${y}" class="ink3 corner" style="animation-delay:-${delay}s">${ch}</text>`
  const path = `M8,3 H${W - 8} Q${W - 3},3 ${W - 3},8 V${H - 8} Q${W - 3},${H - 3} ${W - 8},${H - 3} H8 Q3,${H - 3} 3,${H - 8} V8 Q3,3 8,3 Z`
  return (
    `<path d="${path}" class="frame" stroke-width="0.6" stroke-dasharray="1.2 2.4"/>` +
    corner(0.8, 6.8, '✦', 0) +
    corner(W - 6.2, 6.8, '✧', 1.3) +
    corner(0.8, H - 0.8, '✧', 2.1) +
    corner(W - 6.2, H - 0.8, '✦', 0.7) +
    `<circle r="1.1" class="accent"><animateMotion dur="16s" repeatCount="indefinite" path="${path}"/></circle>`
  )
}

const CSS = `
text{font-family:${FONT_STACK};white-space:pre}
.mono{font-size:4.6px}.small{font-size:4.4px}.digits{font-size:7.5px}
.label{font-size:3.8px;letter-spacing:1.2px}.title{font-size:8.5px;font-weight:600}.artist{font-size:5.2px}
.reel{animation:spin 2.6s linear infinite}
.bar{transform-box:fill-box;transform-origin:bottom;animation-name:lvl;animation-iteration-count:infinite;animation-direction:alternate;animation-timing-function:ease-in-out}
.corner{font-size:5px;animation:tw 3.4s ease-in-out infinite}
.live{animation:tw 1.6s ease-in-out infinite}
.roll6{animation-name:roll6;animation-timing-function:steps(6);animation-iteration-count:infinite}
.roll10{animation-name:roll10;animation-timing-function:steps(10);animation-iteration-count:infinite}
.tape{animation:sweep 7s ease-in-out infinite}
.paused .reel,.paused .bar,.paused .live,.paused .digits,.paused .tape{animation-play-state:paused}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes lvl{0%{transform:scaleY(.15)}35%{transform:scaleY(.8)}70%{transform:scaleY(.35)}100%{transform:scaleY(1)}}
@keyframes tw{0%,100%{opacity:1}50%{opacity:.2}}
@keyframes roll6{to{transform:translateY(-54px)}}
@keyframes roll10{to{transform:translateY(-90px)}}
@keyframes sweep{0%{transform:translateX(0);opacity:0}15%{opacity:1}85%{opacity:1}100%{transform:translateX(${W - 56}px);opacity:0}}
${PALETTE_CSS}`

export function cardSvg(c: CardInput): string {
  const recent = c.recent
    .slice(0, 3)
    .map((t, i) => {
      const y = 97 + i * 9
      return (
        `<text x="14" y="${y}" class="accent small">♪</text>` +
        `<text x="21" y="${y}" class="ink2 small">${esc(cut(`${t.title} — ${t.artist}`, 34))}</text>` +
        `<text x="${W - 14}" y="${y}" class="ink3 small" text-anchor="end">${esc(t.at)}</text>`
      )
    })
    .join('')
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W * 2.4}" height="${H * 2.4}" class="${c.isPlaying ? 'on' : 'paused'}">` +
    `<style>${CSS}</style>` +
    `<rect x="0" y="0" width="${W}" height="${H}" rx="6" class="bg"/>` +
    frame() +
    `<text x="${W - 14}" y="10.5" class="ink3 label" text-anchor="end">LOFI RADIO</text>` +
    `<rect x="14" y="13.2" width="${W - 28}" height="0.4" class="ink4"/>` +
    `<g transform="translate(0,${TOP})">` +
    cassette(13, 14) +
    `<text x="66" y="19" class="ink3 label">NOW PLAYING</text>` +
    `<text x="66" y="30" class="ink title">${esc(cut(c.title, 22))}</text>` +
    `<text x="66" y="38" class="ink2 artist">${esc(cut(c.artist, 30))}</text>` +
    `<text x="66" y="45" class="ink3 mono">${esc(c.station)}</text>` +
    counter(14, 61, c.elapsedSec) +
    bars(42, 61, 27, 3.1, 9) +
    `<circle cx="${W - 32}" cy="57.8" r="1.6" class="accent live"/>` +
    `<text x="${W - 29}" y="59.6" class="ink2 mono">LIVE</text>` +
    `<rect x="14" y="66" width="${W - 28}" height="0.8" class="ink4"/>` +
    `<rect x="14" y="65.6" width="28" height="1.6" rx="0.8" class="accent tape"/>` +
    `<text x="14" y="84" class="ink3 label">RECENTLY PLAYED</text>` +
    recent +
    `</g>` +
    `</svg>`
  )
}
