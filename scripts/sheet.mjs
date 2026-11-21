// A contact sheet: every scene at night and by day, as static images.
// node scripts/sheet.mjs [mood]   (writes .preview/sheet.html)
import fs from 'node:fs'
import { registerHooks } from 'node:module'

registerHooks({
  resolve(s, c, next) {
    try {
      return next(s, c)
    } catch (err) {
      if (s.startsWith('.') && !/\.[cm]?[jt]s$/.test(s)) return next(s + '.ts', c)
      throw err
    }
  },
})

const { SCENES } = await import('../src/scenes/index.ts')
const { setClock } = await import('../src/svg-kit.ts')
setClock(Date.now() / 1000)
const mood = process.argv[2] ?? 'vibing'
fs.mkdirSync('.preview', { recursive: true })
let cells = ''
for (const s of SCENES) {
  for (const tod of ['night', 'day']) {
    const name = `${s.id}-${tod}.svg`
    fs.writeFileSync(`.preview/${name}`, s.build({ tod, mood }))
    cells += `<div><div style="font:11px system-ui;color:#999">${s.name} · ${tod}</div><img src="${name}?${Date.now()}" width="180" height="180"></div>`
  }
}
fs.writeFileSync('.preview/sheet.html', `<html><body style="margin:6px;background:#262624;display:grid;grid-template-columns:repeat(4,184px);gap:6px">${cells}</body></html>`)
console.log('wrote .preview/sheet.html')
