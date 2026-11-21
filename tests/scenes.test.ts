import { expect, test } from 'claude-code/testing'

import { cardSvg } from '../src/card-svg'
import type { Mood } from '../src/character'
import { SCENES, sceneAt } from '../src/scenes'
import type { TimeOfDay } from '../src/sky'
import { timeOfDay } from '../src/sky'
import { setClock } from '../src/svg-kit'

const MAX = 131072
const tods: TimeOfDay[] = ['night', 'dawn', 'day', 'dusk']
const moods: Mood[] = ['working', 'vibing', 'dozing']

for (const scene of SCENES) {
  test(`${scene.name} builds for every time of day and mood`, async () => {
    for (const tod of tods) {
      for (const mood of moods) {
        const svg = scene.build({ tod, mood })
        expect(svg.startsWith('<svg')).toBe(true)
        expect(svg.endsWith('</svg>')).toBe(true)
        expect(svg.length).toBeLessThan(MAX)
        expect(svg.includes('<script')).toBe(false)
        expect(svg.includes('NaN')).toBe(false)
        expect(scene.alt({ tod, mood }).length).toBeGreaterThan(10)
      }
    }
  })
}

test('the character changes with its mood', async () => {
  const city = SCENES[0]!
  const working = city.build({ tod: 'night', mood: 'working' })
  const dozing = city.build({ tod: 'night', mood: 'dozing' })
  expect(dozing.includes('>Z<')).toBe(true)
  expect(working.includes('typing')).toBe(true)
  expect(working.includes('>Z<')).toBe(false)
})

test('rebuilding later carries the animations on, not from the start', async () => {
  setClock(1000)
  const a = SCENES[1]!.build({ tod: 'day', mood: 'vibing' })
  setClock(1007)
  const b = SCENES[1]!.build({ tod: 'day', mood: 'vibing' })
  expect(a).not.toBe(b)
})

test('scenes rotate in a loop', async () => {
  expect(sceneAt(SCENES.length).id).toBe(SCENES[0]!.id)
  expect(sceneAt(-1).id).toBe(SCENES[SCENES.length - 1]!.id)
})

test('the sky follows the clock', async () => {
  expect(timeOfDay(23)).toBe('night')
  expect(timeOfDay(6)).toBe('dawn')
  expect(timeOfDay(12)).toBe('day')
  expect(timeOfDay(18)).toBe('dusk')
})

test('the card shows the song, the counter and recent songs', async () => {
  const svg = cardSvg(
    {
      title: 'Basement Tape',
      artist: 'Sample Artist',
      station: 'ChillHop · FluxFM',
      elapsedSec: 125,
      isPlaying: true,
      recent: [{ at: '04:31', artist: 'Sample Artist', title: 'Rainy Window' }],
    },
    { compact: false, stripUnits: 10.5 },
  )
  expect(svg.includes('Basement Tape')).toBe(true)
  expect(svg.includes('Rainy Window')).toBe(true)
  expect(svg.includes('animation-delay:-125s')).toBe(true)
  expect(svg.length).toBeLessThan(MAX)
  const compact = cardSvg(
    { title: 'A', artist: 'B', station: 'S', elapsedSec: 0, isPlaying: false, recent: [] },
    { compact: true, stripUnits: 15 },
  )
  expect(compact.includes('LOFI RADIO')).toBe(false)
  expect(compact.includes('paused')).toBe(true)
})
