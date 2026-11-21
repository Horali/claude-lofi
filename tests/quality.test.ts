import { expect, test } from 'claude-code/testing'

import { lastQueueKB, QualityGuard } from '../src/quality'

function guard() {
  let t = 0
  const g = new QualityGuard(() => t)
  /** Feeds one reading every 30 ms for `ms`. Returns every switch it asked for. */
  const run = (kb: number, ms: number) => {
    const out: string[] = []
    for (let end = t + ms; t < end; t += 30) {
      const q = g.feed(kb)
      if (q) out.push(q)
    }
    return out
  }
  return { g, run }
}

{
  test('reads the buffer size from ffplay status lines', () => {
    expect(lastQueueKB('   0.28 M-A: -0.000 fd=   0 aq=   40KB vq=    0KB\r   0.75 M-A:  0.000 fd=   0 aq=   3KB vq=0KB')).toBe(3)
    expect(lastQueueKB('nothing here')).toBeUndefined()
  })

  test('the first fill while connecting is not a cut-out', () => {
    const { run } = guard()
    expect(run(0, 5000)).toEqual([])
  })

  test('one short cut-out keeps full quality', () => {
    const { run } = guard()
    run(40, 2000)
    expect(run(0, 600)).toEqual([])
    expect(run(40, 10_000)).toEqual([])
  })

  test('two cut-outs in a minute drop to light, then it tries full again', () => {
    const { g, run } = guard()
    run(40, 2000)
    run(0, 600)
    run(40, 5000)
    expect(run(0, 600)).toEqual(['light'])
    g.restart()
    run(30, 4 * 60_000)
    expect(g.quality).toBe('light')
    expect(run(30, 2 * 60_000)).toEqual(['full'])
  })

  test('one long cut-out drops at once', () => {
    const { run } = guard()
    run(40, 2000)
    expect(run(0, 3500)).toEqual(['light'])
  })

  test('failing again soon after going back up waits longer next time', () => {
    const { g, run } = guard()
    run(40, 2000)
    run(0, 3500) // light, retry in 5 min
    g.restart()
    expect(run(30, 5 * 60_000 + 100)).toContain('full')
    g.restart()
    run(40, 2000)
    expect(run(0, 3500)).toEqual(['light']) // shaky: next wait 10 min
    g.restart()
    expect(run(30, 9 * 60_000)).toEqual([])
    expect(run(30, 2 * 60_000)).toEqual(['full'])
  })
}
