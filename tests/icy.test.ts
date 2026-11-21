import { expect, test } from 'claude-code/testing'

import { parseStreamTitle, splitTitle } from '../src/icy'

test('finds the title in raw stream bytes', async () => {
  const raw = `\u0000ÿ junk StreamTitle='Cookin Soul - BASEMENT';StreamUrl='';\u0000 more`
  expect(parseStreamTitle(raw)).toBe('Cookin Soul - BASEMENT')
  expect(parseStreamTitle('no metadata here')).toBe(undefined)
})

test('splits artist and title', async () => {
  expect(splitTitle('Cookin Soul - BASEMENT', 'ChillHop')).toEqual({ artist: 'Cookin Soul', title: 'BASEMENT' })
  expect(splitTitle('Just A Title', 'ChillHop')).toEqual({ artist: '', title: 'Just A Title' })
})

test('the station name alone is no song', async () => {
  expect(splitTitle('ChillHop', 'ChillHop')).toBe(undefined)
  expect(splitTitle('  ', 'ChillHop')).toBe(undefined)
  expect(splitTitle(undefined, 'ChillHop')).toBe(undefined)
})
