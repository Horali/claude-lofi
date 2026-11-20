import { expect, test } from 'claude-code/testing'

// Spike: draw the pane at two widths and print the full rows, so the
// frames can be looked at without the app.
for (const bodyColumns of [30, 46]) {
  test(`the pane draws rows ${bodyColumns} columns wide`, async ($, on) => {
    on('clock.now', () => ({ value: 1_795_209_000_000 }))
    const ui = await $.ui.mount({
      plugin: 'lofi-desk',
      component: 'Pane',
      requestId: 'lofi-mini',
      surface: 'desktop',
      props: {
        title: 'lofi',
        isFocused: false,
        bodyColumns,
        placement: 'dock',
        scroll: { offset: 0, bodyRows: 13 },
        view: {},
      },
    })
    const found = await ui.findAll({ type: 'Text' })
    const rows = found.map(r => r.text ?? '').filter(t => [...t].length === bodyColumns)
    console.log(`\n--- ${bodyColumns} columns ---\n` + rows.join('\n'))
    expect(rows.length).toBeGreaterThan(5)
    await ui.unmount()
  })
}
