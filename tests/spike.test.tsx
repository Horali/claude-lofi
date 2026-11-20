import { expect, test } from 'claude-code/testing'

// Spike: draw the pane at the width the desktop app docked it (31 columns)
// and at a wider 56, and print the rows so the frames can be looked at.
for (const bodyColumns of [31, 56]) {
  test(`the pane draws ${bodyColumns} columns of rows`, async ($, on) => {
    on('clock.now', () => ({ value: 1_795_209_000_000 }))
    const ui = await $.ui.mount({
      plugin: 'lofi-desk',
      component: 'Pane',
      requestId: 'lofi',
      surface: 'desktop',
      props: {
        title: 'lofi',
        isFocused: false,
        bodyColumns,
        placement: 'dock',
        scroll: { offset: 0, bodyRows: 16 },
        view: {},
      },
    })
    const rows = await ui.findAll({ type: 'Text' })
    console.log(`\n--- ${bodyColumns} columns ---\n` + rows.map(r => r.text).join('\n'))
    expect(rows.length).toBeGreaterThan(5)
    for (const row of rows.slice(0, -1)) expect([...(row.text ?? '')].length).toBe(bodyColumns)
    await ui.unmount()
  })
}
