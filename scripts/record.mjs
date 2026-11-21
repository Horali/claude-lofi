// Records a preview page into a GIF for the README, using a headless
// Chrome or Edge over the DevTools protocol and ffmpeg.
//
//   node scripts/preview.mjs pane 57x39 desk night vibing
//   node scripts/record.mjs <out.gif> [selector] [seconds] [fps] [width] [viewportW]
//
// Serves .preview/ itself on a spare port, so nothing else needs to run.

import { spawn, execFileSync } from 'node:child_process'
import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'

const [out = 'docs/pane.gif', selector = 'body > div > div:nth-child(2)', secs = '6', fps = '8', width = '480', vw = '1000'] = process.argv.slice(2)

const BROWSERS = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
]
const browser = BROWSERS.find(p => fs.existsSync(p))
if (!browser) throw new Error('No Chrome or Edge found')

// A tiny static server for .preview/.
const server = http.createServer((req, res) => {
  const file = path.join('.preview', decodeURIComponent(new URL(req.url, 'http://x').pathname))
  fs.readFile(file, (err, data) => {
    res.writeHead(err ? 404 : 200, { 'content-type': 'text/html; charset=utf-8' })
    res.end(err ? 'not found' : data)
  })
})
await new Promise(r => server.listen(0, '127.0.0.1', r))
const pagePort = server.address().port

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'lofi-rec-'))
const debugPort = 9300 + Math.floor(Math.random() * 500)
const proc = spawn(browser, [
  '--headless=new',
  `--remote-debugging-port=${debugPort}`,
  `--user-data-dir=${profile}`,
  '--hide-scrollbars',
  '--force-color-profile=srgb',
  'about:blank',
])

const sleep = ms => new Promise(r => setTimeout(r, ms))
let target
for (let i = 0; i < 50 && !target; i++) {
  await sleep(200)
  try {
    const list = await (await fetch(`http://127.0.0.1:${debugPort}/json`)).json()
    target = list.find(t => t.type === 'page')
  } catch {}
}
if (!target) throw new Error('Browser did not start')

const ws = new WebSocket(target.webSocketDebuggerUrl)
await new Promise(r => ws.addEventListener('open', r))
let id = 0
const waiting = new Map()
ws.addEventListener('message', ev => {
  const msg = JSON.parse(ev.data)
  if (msg.id && waiting.has(msg.id)) {
    waiting.get(msg.id)(msg)
    waiting.delete(msg.id)
  }
})
const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const n = ++id
    waiting.set(n, m => (m.error ? reject(new Error(m.error.message)) : resolve(m.result)))
    ws.send(JSON.stringify({ id: n, method, params }))
  })

const frames = path.join('.preview', 'frames')
fs.rmSync(frames, { recursive: true, force: true })
fs.mkdirSync(frames, { recursive: true })

try {
  await send('Emulation.setDeviceMetricsOverride', { width: Number(vw), height: 1100, deviceScaleFactor: 2, mobile: false })
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'dark' }] })
  await send('Page.enable')
  await send('Page.navigate', { url: `http://127.0.0.1:${pagePort}/preview.html` })
  await sleep(2500)
  const { result } = await send('Runtime.evaluate', {
    expression: `JSON.stringify((() => { const r = document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height } })())`,
    returnByValue: true,
  })
  const clip = { ...JSON.parse(result.value), scale: 1 }
  const count = Math.round(Number(secs) * Number(fps))
  const start = Date.now()
  for (let i = 0; i < count; i++) {
    const due = start + (i * 1000) / Number(fps)
    if (Date.now() < due) await sleep(due - Date.now())
    const shot = await send('Page.captureScreenshot', { format: 'png', clip, captureBeyondViewport: false })
    fs.writeFileSync(path.join(frames, `f${String(i).padStart(3, '0')}.png`), Buffer.from(shot.data, 'base64'))
  }
} finally {
  ws.close()
  proc.kill()
  server.close()
}

// Frames to a GIF with one shared palette (keeps the file small and steady).
fs.mkdirSync(path.dirname(out), { recursive: true })
const ff = process.env.FFMPEG ?? 'ffmpeg'
execFileSync(ff, [
  '-loglevel', 'error', '-y', '-framerate', fps, '-i', path.join(frames, 'f%03d.png'),
  '-vf', `scale=${width}:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=64:stats_mode=full[p];[b][p]paletteuse=dither=none`,
  '-loop', '0', out,
])
console.log(`wrote ${out} (${(fs.statSync(out).size / 1024).toFixed(0)} KB)`)
setTimeout(() => fs.rmSync(profile, { recursive: true, force: true }), 500)
