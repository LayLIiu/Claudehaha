import { useEffect } from 'react'
import { wsManager } from '../api/websocket'
import { useChatStore } from '../stores/chatStore'
import { useSessionStore } from '../stores/sessionStore'
import { useTabStore } from '../stores/tabStore'
import type { ServerMessage } from '../types/chat'

export function useGlobalSessionSync(enabled = true) {
  useEffect(() => {
    if (!enabled) return

    wsManager.connectGlobal()
    const offMessage = wsManager.onGlobalMessage((message) => {
      void handleGlobalMessage(message)
    })

    return () => {
      offMessage()
    }
  }, [enabled])
}

async function handleGlobalMessage(message: ServerMessage): Promise<void> {
  switch (message.type) {
    case 'session_activated':
      await activateRemoteSession(message.sessionId, message.title)
      break

    case 'session_broadcast':
      handleSessionBroadcast(message.sessionId, message.event)
      break
  }
}

async function activateRemoteSession(sessionId: string, title?: string): Promise<void> {
  if (!sessionId || sessionId.startsWith('__')) return

  const sessionStore = useSessionStore.getState()
  const knownTitle = sessionStore.sessions.find((session) => session.id === sessionId)?.title
  const tabTitle = title?.trim() || knownTitle || 'New Session'

  useTabStore.getState().openTab(sessionId, tabTitle)
  sessionStore.setActiveSession(sessionId)

  const chatStore = useChatStore.getState()
  chatStore.connectToSession(sessionId)
  void chatStore.loadHistory(sessionId)
  void sessionStore.fetchSessions()
}

function handleSessionBroadcast(sessionId: string, event: ServerMessage): void {
  if (!sessionId || sessionId.startsWith('__')) return

  const chatStore = useChatStore.getState()
  if (!chatStore.sessions[sessionId]) {
    void activateRemoteSession(sessionId)
  }

  if (event.type === 'session_title_updated') {
    useSessionStore.getState().updateSessionTitle(sessionId, event.title)
    useTabStore.getState().updateTabTitle(sessionId, event.title)
  } else if (event.type === 'status') {
    useTabStore.getState().updateTabStatus(
      sessionId,
      event.state === 'idle' ? 'idle' : 'running',
    )
  }

  chatStore.handleServerMessage(sessionId, event)
}
