import { act, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useGlobalSessionSync } from './useGlobalSessionSync'
import type { ServerMessage } from '../types/chat'

const mocks = vi.hoisted(() => ({
  connectGlobal: vi.fn(),
  onGlobalMessage: vi.fn(),
  offGlobalMessage: vi.fn(),
  globalHandler: null as ((message: ServerMessage) => void) | null,
  openTab: vi.fn(),
  updateTabTitle: vi.fn(),
  updateTabStatus: vi.fn(),
  connectToSession: vi.fn(),
  loadHistory: vi.fn(),
  handleServerMessage: vi.fn(),
  setActiveSession: vi.fn(),
  fetchSessions: vi.fn(),
  updateSessionTitle: vi.fn(),
  chatSessions: {} as Record<string, unknown>,
  sessions: [] as Array<{ id: string; title: string }>,
}))

vi.mock('../api/websocket', () => ({
  wsManager: {
    connectGlobal: mocks.connectGlobal,
    onGlobalMessage: mocks.onGlobalMessage,
  },
}))

vi.mock('../stores/tabStore', () => ({
  useTabStore: {
    getState: () => ({
      openTab: mocks.openTab,
      updateTabTitle: mocks.updateTabTitle,
      updateTabStatus: mocks.updateTabStatus,
    }),
  },
}))

vi.mock('../stores/chatStore', () => ({
  useChatStore: {
    getState: () => ({
      sessions: mocks.chatSessions,
      connectToSession: mocks.connectToSession,
      loadHistory: mocks.loadHistory,
      handleServerMessage: mocks.handleServerMessage,
    }),
  },
}))

vi.mock('../stores/sessionStore', () => ({
  useSessionStore: {
    getState: () => ({
      sessions: mocks.sessions,
      setActiveSession: mocks.setActiveSession,
      fetchSessions: mocks.fetchSessions,
      updateSessionTitle: mocks.updateSessionTitle,
    }),
  },
}))

function Harness() {
  useGlobalSessionSync()
  return null
}

function DisabledHarness() {
  useGlobalSessionSync(false)
  return null
}

describe('useGlobalSessionSync', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.globalHandler = null
    mocks.sessions = []
    mocks.chatSessions = { 'phone-session-1': {} }
    mocks.fetchSessions.mockResolvedValue(undefined)
    mocks.loadHistory.mockResolvedValue(undefined)
    mocks.onGlobalMessage.mockImplementation((handler: (message: ServerMessage) => void) => {
      mocks.globalHandler = handler
      return mocks.offGlobalMessage
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('opens, activates, connects, and hydrates a remote session activation', async () => {
    render(<Harness />)

    expect(mocks.connectGlobal).toHaveBeenCalledTimes(1)
    expect(mocks.onGlobalMessage).toHaveBeenCalledTimes(1)

    await act(async () => {
      mocks.globalHandler?.({
        type: 'session_activated',
        sessionId: 'phone-session-1',
        title: '手机发来的任务',
      })
      await Promise.resolve()
    })

    expect(mocks.openTab).toHaveBeenCalledWith('phone-session-1', '手机发来的任务')
    expect(mocks.setActiveSession).toHaveBeenCalledWith('phone-session-1')
    expect(mocks.connectToSession).toHaveBeenCalledWith('phone-session-1')
    expect(mocks.loadHistory).toHaveBeenCalledWith('phone-session-1')
    expect(mocks.fetchSessions).toHaveBeenCalled()
  })

  it('does not connect before desktop bootstrap enables the hook', () => {
    render(<DisabledHarness />)

    expect(mocks.connectGlobal).not.toHaveBeenCalled()
    expect(mocks.onGlobalMessage).not.toHaveBeenCalled()
  })

  it('updates tab title and status from global session broadcasts', async () => {
    render(<Harness />)

    await act(async () => {
      mocks.globalHandler?.({
        type: 'session_broadcast',
        sessionId: 'phone-session-1',
        event: {
          type: 'session_title_updated',
          sessionId: 'phone-session-1',
          title: '新标题',
        },
      })
      mocks.globalHandler?.({
        type: 'session_broadcast',
        sessionId: 'phone-session-1',
        event: { type: 'status', state: 'thinking', verb: 'Thinking' },
      })
      await Promise.resolve()
    })

    expect(mocks.updateSessionTitle).toHaveBeenCalledWith('phone-session-1', '新标题')
    expect(mocks.updateTabTitle).toHaveBeenCalledWith('phone-session-1', '新标题')
    expect(mocks.updateTabStatus).toHaveBeenCalledWith('phone-session-1', 'running')
  })
})
