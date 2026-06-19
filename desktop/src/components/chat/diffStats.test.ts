import { describe, expect, it } from 'vitest'
import { calculateDiffStats } from './diffStats'

describe('calculateDiffStats', () => {
  it('uses the same index-based line math as the diff header', () => {
    const oldString = ['try {', '  callA()', '} catch {', '  // ignore', '}'].join('\n')
    const newString = ['try {', '  callA()', '  callB()', '} catch (error) {', '  report(error)', '}'].join('\n')

    expect(calculateDiffStats(oldString, newString)).toEqual({
      additions: 4,
      deletions: 3,
    })
  })

  it('counts created file content the same way DiffViewer does', () => {
    expect(calculateDiffStats('', 'one\ntwo\n')).toEqual({ additions: 3, deletions: 1 })
  })
})
