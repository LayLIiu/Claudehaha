import { describe, expect, it, beforeEach } from 'vitest'
import { act } from 'react'
import { useChatStore } from '../../stores/chatStore'

const sessionId = 'test-session'

function setupSession(queue: Array<{ id: string; content: string; displayContent: string }>, isAutoRunPaused = false) {
  useChatStore.setState({
    sessions: {
      [sessionId]: {
        messages: [],
        chatState: 'streaming',
        connectionState: 'connected',
        streamingText: '',
        streamingToolInput: '',
        activeToolUseId: null,
        activeToolName: null,
        activeThinkingId: null,
        pendingPermission: null,
        pendingComputerUsePermission: null,
        tokenUsage: { input_tokens: 0, output_tokens: 0 },
        streamingResponseChars: 0,
        elapsedSeconds: 0,
        statusVerb: '',
        slashCommands: [],
        agentTaskNotifications: {},
        elapsedTimer: null,
        queuedUserMessages: queue.map((q) => ({
          id: q.id,
          content: q.content,
          displayContent: q.displayContent,
          createdAt: Date.now(),
        })),
        isQueuedPromptAutoRunPaused: isAutoRunPaused,
      },
    },
  })
}

describe('QueuedPrompts store integration', () => {
  beforeEach(() => {
    useChatStore.setState({ sessions: {} })
  })

  it('starts with empty queue', () => {
    expect(useChatStore.getState().sessions[sessionId]?.queuedUserMessages ?? []).toEqual([])
  })

  it('queues a new user message with generated id and timestamp', () => {
    const id = useChatStore.getState().queueUserMessage(sessionId, {
      content: 'hello world',
      displayContent: 'hello world',
    })
    expect(id).toBeTruthy()
    const queued = useChatStore.getState().sessions[sessionId]?.queuedUserMessages ?? []
    expect(queued).toHaveLength(1)
    expect(queued[0]?.content).toBe('hello world')
    expect(queued[0]?.createdAt).toBeGreaterThan(0)
  })

  it('reorders queued messages correctly', () => {
    setupSession([
      { id: 'a', content: 'a', displayContent: 'a' },
      { id: 'b', content: 'b', displayContent: 'b' },
      { id: 'c', content: 'c', displayContent: 'c' },
    ])
    act(() => {
      useChatStore.getState().reorderQueuedUserMessages(sessionId, 0, 2)
    })
    const ids = useChatStore.getState().sessions[sessionId]?.queuedUserMessages?.map((m) => m.id)
    expect(ids).toEqual(['b', 'c', 'a'])
  })

  it('no-op reorder for out-of-bounds indices', () => {
    setupSession([
      { id: 'a', content: 'a', displayContent: 'a' },
      { id: 'b', content: 'b', displayContent: 'b' },
    ])
    act(() => {
      useChatStore.getState().reorderQueuedUserMessages(sessionId, 0, 5)
    })
    const ids = useChatStore.getState().sessions[sessionId]?.queuedUserMessages?.map((m) => m.id)
    expect(ids).toEqual(['a', 'b'])
  })

  it('toggles auto-run paused state', () => {
    setupSession([{ id: 'msg-1', content: 'hi', displayContent: 'hi' }])
    expect(useChatStore.getState().sessions[sessionId]?.isQueuedPromptAutoRunPaused).toBe(false)
    act(() => {
      useChatStore.getState().setQueuedPromptAutoRunPaused(sessionId, true)
    })
    expect(useChatStore.getState().sessions[sessionId]?.isQueuedPromptAutoRunPaused).toBe(true)
  })

  it('updates queued message content', () => {
    setupSession([{ id: 'msg-1', content: 'draft', displayContent: 'draft' }])
    act(() => {
      useChatStore.getState().updateQueuedUserMessage(sessionId, 'msg-1', 'revised')
    })
    expect(useChatStore.getState().sessions[sessionId]?.queuedUserMessages?.[0]?.displayContent).toBe('revised')
  })

  it('removes a queued message by id', () => {
    setupSession([
      { id: 'a', content: 'a', displayContent: 'a' },
      { id: 'b', content: 'b', displayContent: 'b' },
    ])
    act(() => {
      useChatStore.getState().removeQueuedUserMessage(sessionId, 'a')
    })
    const ids = useChatStore.getState().sessions[sessionId]?.queuedUserMessages?.map((m) => m.id)
    expect(ids).toEqual(['b'])
  })

  it('sends queued message and removes it from queue when idle', () => {
    setupSession([{ id: 'msg-1', content: 'hello', displayContent: 'hello' }])
    // Set chatState to idle so it sends immediately
    act(() => {
      useChatStore.setState((s) => ({
        sessions: {
          ...s.sessions,
          [sessionId]: { ...s.sessions[sessionId]!, chatState: 'idle' },
        },
      }))
    })
    act(() => {
      useChatStore.getState().sendQueuedUserMessage(sessionId, 'msg-1')
    })
    const queued = useChatStore.getState().sessions[sessionId]?.queuedUserMessages ?? []
    expect(queued).toHaveLength(0)
  })
})
