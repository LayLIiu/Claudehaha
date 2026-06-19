import { describe, expect, it } from 'vitest'
import { aggregateToolEditStats, summarizeToolEditFiles } from './toolEditSummary'

describe('toolEditSummary', () => {
  it('aggregates totals with the same diff math as DiffViewer', () => {
    expect(aggregateToolEditStats([
      {
        toolName: 'Edit',
        input: { file_path: '/repo/a.ts', old_string: 'one\ntwo', new_string: 'one\nthree\nfour' },
      },
      {
        toolName: 'Write',
        input: { file_path: '/repo/b.ts', content: 'alpha\nbeta' },
      },
    ])).toEqual({ additions: 4, deletions: 2 })
  })

  it('summarizes repeated edits by file path', () => {
    expect(summarizeToolEditFiles([
      {
        toolName: 'Edit',
        input: { file_path: '/repo/a.ts', old_string: 'a', new_string: 'b' },
      },
      {
        toolName: 'Edit',
        input: { file_path: '/repo/a.ts', old_string: 'c', new_string: 'd\ne' },
      },
      {
        toolName: 'Write',
        input: { file_path: '/repo/b.ts', content: 'x' },
      },
    ])).toEqual([
      { path: '/repo/a.ts', label: 'a.ts', additions: 3, deletions: 2, editCount: 2 },
      { path: '/repo/b.ts', label: 'b.ts', additions: 1, deletions: 1, editCount: 1 },
    ])
  })
})
