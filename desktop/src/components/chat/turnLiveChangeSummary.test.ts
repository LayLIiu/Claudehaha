import { describe, expect, it } from 'vitest'
import type { UIMessage } from '../../types/chat'
import { getCurrentTurnLiveChangeSummary } from './turnLiveChangeSummary'

const baseTool = {
  id: 'tool-1',
  type: 'tool_use' as const,
  timestamp: 2,
  toolUseId: 'tu-1',
}

describe('getCurrentTurnLiveChangeSummary', () => {
  it('summarizes changed files only for the latest active turn', () => {
    const messages: UIMessage[] = [
      { id: 'u1', type: 'user_text', content: 'old', timestamp: 1 },
      {
        ...baseTool,
        id: 'old-edit',
        toolUseId: 'old-edit',
        toolName: 'Edit',
        input: { file_path: '/repo/old.ts', old_string: 'a', new_string: 'b' },
      },
      { id: 'u2', type: 'user_text', content: 'new', timestamp: 3 },
      {
        ...baseTool,
        id: 'edit-1',
        toolUseId: 'edit-1',
        toolName: 'Edit',
        input: { file_path: '/repo/a.ts', old_string: 'one\ntwo', new_string: 'one\nthree\nfour' },
      },
      {
        ...baseTool,
        id: 'write-1',
        toolUseId: 'write-1',
        toolName: 'Write',
        input: { file_path: '/repo/b.ts', content: 'alpha\nbeta' },
      },
    ]

    expect(getCurrentTurnLiveChangeSummary(messages)).toEqual({
      fileCount: 2,
      additions: 4,
      deletions: 2,
    })
  })

  it('keeps one file counted once while summing repeated edits', () => {
    const messages: UIMessage[] = [
      { id: 'u1', type: 'user_text', content: 'new', timestamp: 1 },
      {
        ...baseTool,
        id: 'edit-1',
        toolUseId: 'edit-1',
        toolName: 'Edit',
        input: { file_path: '/repo/a.ts', old_string: 'a', new_string: 'b' },
      },
      {
        ...baseTool,
        id: 'edit-2',
        toolUseId: 'edit-2',
        toolName: 'Edit',
        input: { file_path: '/repo/a.ts', old_string: 'c', new_string: 'd\ne' },
      },
    ]

    expect(getCurrentTurnLiveChangeSummary(messages)).toEqual({
      fileCount: 1,
      additions: 3,
      deletions: 2,
    })
  })
})
