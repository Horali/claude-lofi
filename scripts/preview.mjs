// Builds .preview/preview.html: a stand-in for the desktop pane, drawn the
// way the app draws it (each Svg in a script-less sandboxed frame, sized by
// src/pane-layout.ts), so layouts can be checked without the app.
//
//   node scripts/preview.mjs pane 31x39,62x39 [scene] [tod] [mood]
//   node scripts/preview.mjs gallery [tod] [mood]
//
// Serve it with the `preview` entry in .claude/launch.json (port 8790).
// Needs Node 22.18 or later (it runs the TypeScript sources directly).

import fs from 'node:fs'
import { registerHooks } from 'node:module'

// The sources import './x' without an extension; resolve those to x.ts.
registerHooks({
  resolve(specifier, context, next) {
    try {
      return next(specifier, context)
    } catch (err) {
      if (specifier.startsWith('.') && !/\.[cm]?[jt]s$/.test(specifier)) return next(specifier + '.ts', context)
      throw err
    }
  },
})

const { SCENES } = await import('../src/scenes/index.ts')
const { cardSvg } = await import('../src/card-svg.ts')
const { paneLayout, COL_PX, ROW_PX } = await import('../src/pane-layout.ts')
const { setClock } = await import('../src/svg-kit.ts')

const [mode = 'pane', a1, a2, a3, a4] = process.argv.slice(2)
setClock(Date.now() / 1000)

const input = {
  title: 'Basement Tape',
  artist: 'Sample Artist',
  station: 'ChillHop · FluxFM',
  elapsedSec: 70,
  lengthSec: 151,
  isPlaying: true,
  previous: { artist: 'Sample Artist', title: 'Rainy Window' },
  justChanged: true,
}

const doc = svg =>
  ('<meta charset=utf-8><style>html,body{margin:0;height:100%;overflow:hidden;background:transparent}</style>' + svg)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
const frame = (svg, w, h) => `<iframe sandbox="" width="${w}" height="${h}" style="border:0;display:block" srcdoc="${doc(svg)}"></iframe>`
const label = text => `<div style="font:12px system-ui;color:#999;margin:4px 0">${text}</div>`
const btn = 'font:13px system-ui;height:21px;line-height:21px;background:none;border:0;padding:0;cursor:pointer'

function pane(cols, rows, scene, ctx) {
  const L = paneLayout(cols, rows)
  const card = cardSvg(input, { compact: L.compact })
  return (
    `<div>${label(`${cols}×${rows}${L.compact ? ' compact' : ''} · ${scene.name} · ${ctx.tod} · ${ctx.mood}`)}` +
    `<div style="width:${cols * COL_PX}px;height:${rows * ROW_PX}px;overflow:hidden;outline:1px solid #444;background:#1f1e1d;color-scheme:dark;display:flex;flex-direction:column;align-items:center;gap:${ROW_PX}px">` +
    `${frame(card, L.cardW, L.cardH)}` +
    `<div style="display:flex;gap:${3 * COL_PX}px">` +
    `<button style="${btn};color:#e07a4c">❚❚ pause</button><button style="${btn};color:#8a887f">» next scene</button></div>` +
    `${frame(scene.build(ctx), L.sceneW, L.sceneH)}</div></div>`
  )
}

let body = ''
if (mode === 'gallery') {
  const ctx = { tod: a1 ?? 'night', mood: a2 ?? 'vibing' }
  body = SCENES.map(s => `<div>${label(`${s.name} · ${ctx.tod} · ${ctx.mood} · ${s.build(ctx).length} chars`)}${frame(s.build(ctx), 230, 230)}</div>`).join('')
} else {
  const sizes = (a1 ?? '31x39,62x39').split(',').map(s => s.split('x').map(Number))
  const scene = SCENES.find(s => s.id === a2) ?? SCENES[0]
  const ctx = { tod: a3 ?? 'night', mood: a4 ?? 'vibing' }
  body = sizes.map(([c, r]) => pane(c, r, scene, ctx)).join('')
}

fs.mkdirSync('.preview', { recursive: true })
fs.writeFileSync(
  '.preview/preview.html',
  `<html><head><meta charset=utf-8></head><body style="margin:8px;background:#262624;display:flex;flex-wrap:wrap;gap:16px;align-items:flex-start">${body}</body></html>`,
)
console.log(`wrote .preview/preview.html (${mode})`)
