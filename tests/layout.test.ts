import { expect, test } from 'claude-code/testing'

import { COL_PX, paneLayout } from '../src/pane-layout'

for (const cols of [31, 45, 62, 96]) {
  test(`the layout fits a ${cols}-column pane`, async () => {
    const L = paneLayout(cols, 39)
    const room = cols * COL_PX
    expect(L.cardW).toBeLessThanOrEqual(room)
    expect(L.sceneW).toBeLessThanOrEqual(room)
    expect(L.cardW).toBeLessThanOrEqual(560)
    expect(L.sceneH).toBeGreaterThanOrEqual(Math.floor(L.sceneW * 0.8))
    expect(L.sceneH).toBeLessThanOrEqual(Math.ceil(L.sceneW * 1.35))
    expect(L.buttonsLeft).toBeGreaterThanOrEqual(1)
    // The button strip is one text row tall at the card's scale.
    expect(L.stripUnits).toBeGreaterThan(0)
  })
}

test('narrow panes get the compact card, wide ones the full card', async () => {
  expect(paneLayout(31, 39).compact).toBe(true)
  expect(paneLayout(62, 39).compact).toBe(false)
})
