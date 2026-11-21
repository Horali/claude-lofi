import { expect, test } from 'claude-code/testing'

const props = (bodyColumns: number) => ({
  title: 'lofi',
  isFocused: false,
  bodyColumns,
  placement: 'dock',
  scroll: { offset: 0, bodyRows: 39 },
  view: {},
})

test('the desktop pane draws the card and the scene with two buttons', async $ => {
  const ui = await $.ui.mount({ plugin: 'lofi-desk', component: 'Pane', requestId: 'lofi', surface: 'desktop', props: props(62) })
  expect(await ui.findAll({ type: 'Svg' })).toHaveLength(2)
  expect(await ui.findAll({ type: 'Button' })).toHaveLength(2)
  await ui.unmount()
})

test('the terminal gets a text version of the pane', async $ => {
  const ui = await $.ui.mount({ plugin: 'lofi-desk', component: 'Pane', requestId: 'lofi', surface: 'terminal', props: props(40) })
  const texts = (await ui.findAll({ type: 'Text' })).map(t => t.text ?? '').join('\n')
  expect(texts.includes('lofi radio')).toBe(true)
  expect(await ui.findAll({ type: 'Button' })).toHaveLength(2)
  await ui.unmount()
})

test('next scene moves to the ocean', async $ => {
  const ui = await $.ui.mount({ plugin: 'lofi-desk', component: 'Pane', requestId: 'lofi', surface: 'terminal', props: props(40) })
  await ui.press({ key: 'next' })
  const texts = (await ui.findAll({ type: 'Text' })).map(t => t.text ?? '').join('\n')
  expect(texts.includes('Ocean boat')).toBe(true)
  await ui.unmount()
})

test('/music with an unknown word explains the commands', async $ => {
  const { text } = await $.command.run({ command: 'music', args: 'dance' })
  expect(text.includes('/music next')).toBe(true)
})

test('the lofi tool reports its status', async $ => {
  const r = (await $.tool.call({ tool: 'mcp__lofi-desk__lofi', action: 'status' } as never)) as { text?: string }
  expect(JSON.stringify(r).includes('Rainy city')).toBe(true)
})
