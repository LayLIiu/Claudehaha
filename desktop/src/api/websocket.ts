import type { ClientMessage, ServerMessage } from '../types/chat'
import { getAuthToken, getBaseUrl } from './client'

type MessageHandler = (msg: ServerMessage) => void

type Connection = {
  ws: WebSocket
  handlers: Set<MessageHandler>
  reconnectTimer: ReturnType<typeof setTimeout> | null
  reconnectAttempt: number
  pingInterval: ReturnType<typeof setInterval> | null
  intentionalClose: boolean
  pendingMessages: ClientMessage[]
}

class WebSocketManager {
  private connections = new Map<string, Connection>()
  private globalConnection: Connection | null = null

  isConnected(sessionId: string): boolean {
    const conn = this.connections.get(sessionId)
    return conn?.ws.readyState === WebSocket.OPEN
  }

  getConnectedSessionIds(): string[] {
    return [...this.connections.keys()]
  }

  connect(sessionId: string) {
    const existing = this.connections.get(sessionId)
    if (
      existing &&
      !existing.intentionalClose &&
      (
        existing.ws.readyState === WebSocket.OPEN ||
        existing.ws.readyState === WebSocket.CONNECTING ||
        existing.reconnectTimer !== null
      )
    ) {
      return
    }

    const ws = new WebSocket(buildSessionWebSocketUrl(sessionId))

    const conn: Connection = {
      ws,
      handlers: existing?.handlers ?? new Set(),
      reconnectTimer: null,
      reconnectAttempt: existing?.reconnectAttempt ?? 0,
      pingInterval: null,
      intentionalClose: false,
      pendingMessages: existing?.pendingMessages ?? [],
    }
    this.connections.set(sessionId, conn)

    ws.onopen = () => {
      conn.reconnectAttempt = 0
      this.startPingLoop(sessionId)
      while (conn.pendingMessages.length > 0) {
        const msg = conn.pendingMessages.shift()!
        ws.send(JSON.stringify(msg))
      }
    }

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string) as ServerMessage
        for (const handler of conn.handlers) {
          handler(msg)
        }
      } catch {
        // Ignore malformed messages
      }
    }

    ws.onclose = () => {
      this.stopPingLoop(sessionId)
      if (!conn.intentionalClose && this.connections.get(sessionId) === conn) {
        this.scheduleReconnect(sessionId, conn)
      }
    }

    ws.onerror = () => {
      // onclose will fire after onerror
    }
  }

  disconnect(sessionId: string) {
    const conn = this.connections.get(sessionId)
    if (!conn) return

    conn.intentionalClose = true
    this.stopPingLoop(sessionId)
    if (conn.reconnectTimer) {
      clearTimeout(conn.reconnectTimer)
      conn.reconnectTimer = null
    }
    conn.pendingMessages = []

    conn.ws.close()
    this.connections.delete(sessionId)
  }

  disconnectAll() {
    for (const sessionId of [...this.connections.keys()]) {
      this.disconnect(sessionId)
    }
    this.disconnectGlobal()
  }

  send(sessionId: string, message: ClientMessage) {
    let conn = this.connections.get(sessionId)
    if (!conn) {
      this.connect(sessionId)
      conn = this.connections.get(sessionId)
      if (!conn) return
    }

    if (conn.ws.readyState === WebSocket.OPEN) {
      conn.ws.send(JSON.stringify(message))
      return
    }

    conn.pendingMessages.push(message)

    if (
      conn.ws.readyState === WebSocket.CLOSED ||
      conn.ws.readyState === WebSocket.CLOSING
    ) {
      if (!conn.intentionalClose && !conn.reconnectTimer) {
        this.scheduleReconnect(sessionId, conn)
      }
    }
  }

  onMessage(sessionId: string, handler: MessageHandler): () => void {
    const conn = this.connections.get(sessionId)
    if (!conn) return () => {}
    conn.handlers.add(handler)
    return () => { conn.handlers.delete(handler) }
  }

  clearHandlers(sessionId: string) {
    const conn = this.connections.get(sessionId)
    if (conn) conn.handlers.clear()
  }

  connectGlobal() {
    const existing = this.globalConnection
    if (
      existing &&
      !existing.intentionalClose &&
      (
        existing.ws.readyState === WebSocket.OPEN ||
        existing.ws.readyState === WebSocket.CONNECTING ||
        existing.reconnectTimer !== null
      )
    ) {
      return
    }

    const ws = new WebSocket(buildGlobalWebSocketUrl())
    const conn: Connection = {
      ws,
      handlers: existing?.handlers ?? new Set(),
      reconnectTimer: null,
      reconnectAttempt: existing?.reconnectAttempt ?? 0,
      pingInterval: null,
      intentionalClose: false,
      pendingMessages: [],
    }
    this.globalConnection = conn

    ws.onopen = () => {
      conn.reconnectAttempt = 0
      this.startGlobalPingLoop(conn)
    }

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string) as ServerMessage
        for (const handler of conn.handlers) {
          handler(msg)
        }
      } catch {
        // Ignore malformed messages
      }
    }

    ws.onclose = () => {
      this.stopGlobalPingLoop(conn)
      if (!conn.intentionalClose && this.globalConnection === conn) {
        this.scheduleGlobalReconnect(conn)
      }
    }

    ws.onerror = () => {
      // onclose will fire after onerror
    }
  }

  disconnectGlobal() {
    const conn = this.globalConnection
    if (!conn) return

    conn.intentionalClose = true
    this.stopGlobalPingLoop(conn)
    if (conn.reconnectTimer) {
      clearTimeout(conn.reconnectTimer)
      conn.reconnectTimer = null
    }

    conn.ws.close()
    this.globalConnection = null
  }

  onGlobalMessage(handler: MessageHandler): () => void {
    const conn = this.globalConnection
    if (!conn) return () => {}
    conn.handlers.add(handler)
    return () => { conn.handlers.delete(handler) }
  }

  private startPingLoop(sessionId: string) {
    this.stopPingLoop(sessionId)
    const conn = this.connections.get(sessionId)
    if (!conn) return
    conn.pingInterval = setInterval(() => {
      this.send(sessionId, { type: 'ping' })
    }, 30_000)
  }

  private stopPingLoop(sessionId: string) {
    const conn = this.connections.get(sessionId)
    if (conn?.pingInterval) {
      clearInterval(conn.pingInterval)
      conn.pingInterval = null
    }
  }

  private scheduleReconnect(sessionId: string, conn: Connection) {
    if (conn.reconnectTimer) {
      clearTimeout(conn.reconnectTimer)
    }

    const delay = Math.min(1000 * 2 ** conn.reconnectAttempt, 30_000)
    conn.reconnectAttempt++

    conn.reconnectTimer = setTimeout(() => {
      if (this.connections.get(sessionId) === conn && !conn.intentionalClose) {
        conn.reconnectTimer = null
        this.connect(sessionId)
      }
    }, delay)
  }

  private startGlobalPingLoop(conn: Connection) {
    this.stopGlobalPingLoop(conn)
    conn.pingInterval = setInterval(() => {
      if (conn.ws.readyState === WebSocket.OPEN) {
        conn.ws.send(JSON.stringify({ type: 'ping' } satisfies ClientMessage))
      }
    }, 30_000)
  }

  private stopGlobalPingLoop(conn: Connection) {
    if (conn.pingInterval) {
      clearInterval(conn.pingInterval)
      conn.pingInterval = null
    }
  }

  private scheduleGlobalReconnect(conn: Connection) {
    if (conn.reconnectTimer) {
      clearTimeout(conn.reconnectTimer)
    }

    const delay = Math.min(1000 * 2 ** conn.reconnectAttempt, 30_000)
    conn.reconnectAttempt++

    conn.reconnectTimer = setTimeout(() => {
      if (this.globalConnection === conn && !conn.intentionalClose) {
        conn.reconnectTimer = null
        this.connectGlobal()
      }
    }, delay)
  }
}

export function buildSessionWebSocketUrl(sessionId: string) {
  return buildWebSocketUrl(`/ws/${encodeURIComponent(sessionId)}`)
}

export function buildGlobalWebSocketUrl() {
  return buildWebSocketUrl('/ws/global')
}

function buildWebSocketUrl(path: string) {
  const url = new URL(getBaseUrl())
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
  const basePath = url.pathname === '/' ? '' : url.pathname.replace(/\/$/, '')
  url.pathname = `${basePath}${path}`

  const token = getAuthToken()
  if (token) {
    url.searchParams.set('token', token)
  } else {
    url.searchParams.delete('token')
  }

  return url.toString()
}

export const wsManager = new WebSocketManager()
