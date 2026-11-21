import { expect, test } from 'claude-code/testing'

import { parseHistory, pickItunesLength, pickLength } from '../src/nowplaying'

test('reads the station feed, newest song first', async () => {
  const json = JSON.stringify({
    size: 2,
    items: [
      { start: '2026-11-21T06:24:38.029Z', track: { title: 'The Entrance', artistCredits: '12Vince' } },
      { start: '2026-11-21T06:26:54.536Z', track: { title: 'Grey To Pink', artistCredits: 'Jelly Soul' } },
      { start: 'nonsense', track: { title: 'Broken' } },
    ],
  })
  const h = parseHistory(json)
  expect(h).toHaveLength(2)
  expect(h[0]!.title).toBe('Grey To Pink')
  expect(h[0]!.startMs).toBe(Date.parse('2026-11-21T06:26:54.536Z'))
})

test('takes the length of the matching recording only', async () => {
  const json = JSON.stringify({
    recordings: [
      { title: 'The Entrance', length: 999000, 'artist-credit': [{ name: 'Someone Else' }] },
      { title: 'Entrance (Remix)', length: 200000, 'artist-credit': [{ name: '12Vince' }] },
      { title: 'The Entrance', length: 140000, 'artist-credit': [{ name: '12Vince' }] },
    ],
  })
  expect(pickLength(json, '12Vince', 'The Entrance')).toBe(140)
  expect(pickLength(json, 'Nobody', 'Nothing')).toBe(undefined)
  expect(pickLength(JSON.stringify({ recordings: [{ title: 'Drop Top Chevy', length: 163000, 'artist-credit': [{ name: 'Brenk Sinatra' }, { name: 'Wun Two' }] }] }), 'Brenk Sinatra & Wun Two', 'Drop Top Chevy')).toBe(163)
})

test('reads lengths from iTunes, allowing extras like (instrumental)', async () => {
  const json = JSON.stringify({
    results: [
      { artistName: 'Funky DL', trackName: 'Better Off On My Own', trackTimeMillis: 204333 },
      { artistName: 'Àbáse', trackName: 'Caminhos (For Catoni)', trackTimeMillis: 111289 },
    ],
  })
  expect(pickItunesLength(json, 'Funky DL', 'Better Off on My Own (instrumental)')).toBe(204)
  expect(pickItunesLength(json, 'Àbáse', 'Caminhos (for Catoni)')).toBe(111)
  expect(pickItunesLength(json, 'Jokabi & GameChops', 'Save Your Game')).toBe(undefined)
})
