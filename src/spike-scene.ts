// SPIKE v2: a quick draft of the new look, to judge the widget.
// A black-and-white ASCII world; only the character is in colour.

export type Ink = 'faint' | 'subtle' | 'text' | 'body' | 'phones'
export type Run = { ink: Ink; text: string }
export type Mood = 'working' | 'vibing' | 'dozing'

function hash(n: number): number {
  let x = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b)
  x ^= x >>> 13
  x = Math.imul(x, 0xc2b2ae35)
  x ^= x >>> 16
  return (x >>> 0) / 4294967296
}

function noise(x: number, seed: number): number {
  const i = Math.floor(x)
  const f = x - i
  const a = hash(i * 7919 + seed)
  const b = hash((i + 1) * 7919 + seed)
  const s = f * f * (3 - 2 * f)
  return a + (b - a) * s
}

const FACES: Record<Mood, [string, string]> = {
  working: ['[| •   • |]', '[|   _   |]'],
  vibing: ['[| ^   ^ |]', '[|   ‿   |]'],
  dozing: ['[| -   - |]', '[|   o   |]'],
}

function sprite(mood: Mood): string[] {
  const [eyes, mouth] = FACES[mood]
  return ['  .-~~~-.  ', ' /       \ ', eyes, mouth, " `-------' "]
}

function inkOfSprite(ch: string, row: number, col: number, width: number): Ink {
  if (ch === '[' || ch === ']') return 'phones'
  if (ch === '|' && (col === 1 || col === width - 2) && (row === 2 || row === 3)) return 'phones'
  if ('•^‿_o-'.includes(ch) && (row === 2 || row === 3)) return 'text'
  return 'body'
}

/** Rows of runs: `rows` of scene, then the now-playing line. */
export function drawFrame(cols: number, rows: number, nowMs: number, mood: Mood, clock: string): Run[][] {
  const t = nowMs / 1000
  const chars: string[][] = Array.from({ length: rows }, () => Array<string>(cols).fill(' '))
  const inks: Ink[][] = Array.from({ length: rows }, () => Array<Ink>(cols).fill('faint'))
  const put = (y: number, x: number, ch: string, ink: Ink) => {
    if (y < 0 || y >= rows || x < 0 || x >= cols) return
    chars[y]![x] = ch
    inks[y]![x] = ink
  }
  const horizon = Math.max(3, Math.round(rows * 0.55))

  // sky: a few twinkling stars, and a moon
  for (let y = 0; y < horizon - 2; y++) {
    for (let x = 0; x < cols; x++) {
      const r = hash(x * 131 + y * 977)
      if (r < 0.035) {
        const on = Math.sin(t * 1.5 + r * 900) > -0.2
        put(y, x, on ? (r < 0.008 ? '*' : '.') : ' ', r < 0.008 ? 'text' : 'faint')
      }
    }
  }
  // far skyline: outlined towers with lit windows, drifting slowly left
  const drift = t * 0.6
  for (let x = 0; x < cols; x++) {
    const wx = Math.floor(x + drift)
    const b = Math.floor(wx / 6)
    const local = wx - b * 6
    const height = 1 + Math.floor(hash(b * 31 + 5) * (horizon - 1))
    const top = horizon - height
    if (local === 5) continue
    for (let y = top; y < horizon; y++) {
      if (y === top) put(y, x, local === 0 || local === 4 ? ' ' : '_', 'subtle')
      else if (local === 0 || local === 4) put(y, x, '|', 'subtle')
      else if (hash(wx * 17 + y * 3 + b) < 0.3) put(y, x, ':', 'text')
    }
  }

  const mx = cols - 9
  put(0, mx + 1, '.', 'text'); put(0, mx + 2, '-', 'text'); put(0, mx + 3, '.', 'text')
  put(1, mx, '(', 'text'); put(1, mx + 4, ')', 'text')
  put(2, mx + 1, '`', 'text'); put(2, mx + 2, '-', 'text'); put(2, mx + 3, "'", 'text')

  // ground: density rises toward the bottom, with slow-moving texture
  const ramp = ' .:-=+*#%'
  for (let y = horizon; y < rows; y++) {
    const depth = (y - horizon + 1) / (rows - horizon)
    for (let x = 0; x < cols; x++) {
      const n = noise((x + t * 1.6 * depth) / 5, y * 13) * 0.45 + depth * 0.4
      const i = Math.min(ramp.length - 1, Math.floor(n * ramp.length * 0.8))
      put(y, x, ramp[i]!, depth > 0.6 ? 'text' : 'subtle')
    }
  }

  // rain: a light slant, faint
  const drops = Math.floor((cols * rows) / 40)
  for (let i = 0; i < drops; i++) {
    const speed = 6 + hash(i * 7) * 4
    const y = Math.floor((hash(i * 17) * rows + t * speed) % rows)
    const x = Math.floor((hash(i * 13) * cols - y * 0.4 + cols * 4) % cols)
    if (chars[y]![x] === ' ') put(y, x, '/', 'faint')
  }

  // the character, lower left third, bobbing on the beat
  const beat = Math.floor(t / 0.75) % 2
  const bob = mood === 'dozing' ? 0 : beat
  const art = sprite(mood)
  const left = Math.max(1, Math.floor(cols * 0.18) - 5)
  const top = rows - art.length - 1 + bob
  art.forEach((line, r) => {
    for (let c = 0; c < line.length; c++) {
      const ch = line[c]!
      if (ch === ' ' && (r === 0 || r === 4)) continue
      if (c === 0) put(top + r, left - 1, ' ', 'faint')
      if (c === line.length - 1) put(top + r, left + line.length, ' ', 'faint')
      put(top + r, left + c, ch, ch === ' ' ? 'faint' : inkOfSprite(ch, r, c, line.length))
    }
  })
  if (mood === 'vibing' && beat) put(top, left + 11, '♪', 'text')
  if (mood === 'dozing') {
    const z = Math.floor(t) % 3
    put(top - z, left + 11 + z, 'z', 'text')
  }
  if (mood === 'working') {
    const keys = beat ? '_|=:=|_' : '_|:=:|_'
    for (let c = 0; c < keys.length; c++) put(rows - 1, left + 2 + c, keys[c]!, 'text')
  }

  const out: Run[][] = chars.map((row, y) => {
    const runs: Run[] = []
    row.forEach((ch, x) => {
      const ink = inks[y]![x]!
      const last = runs[runs.length - 1]
      if (last && last.ink === ink) last.text += ch
      else runs.push({ ink, text: ch })
    })
    return runs
  })
  const label = ' ♪ ChillHop · FluxFM'
  const right = `${clock} `
  const gap = Math.max(1, cols - [...label].length - right.length)
  out.push([{ ink: 'faint', text: (label + ' '.repeat(gap) + right).slice(0, cols) }])
  return out
}
