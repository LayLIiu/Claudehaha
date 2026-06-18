/**
 * ClaudeService — Central state container and WebSocket manager
 *
 * Manages connections to the desktop Claude server, handles the
 * ClientMessage/ServerMessage protocol (NOT JSON-RPC), and provides
 * reactive state updates to the UI layer.
 *
 * Architecture mirrors CodexMobile's CodexService but adapted to
 * our custom protocol and H5 Token auth system.
 */

import { MMKV } from 'react-native-mmkv'
import type {
  ServerMessage,
  ClientMessage,
  ChatState,
  SessionSummary,
} from '../models/ServerMessage'
import type {
  PairedDevice,
  DiscoveredDevice,
  ConnectionStatus,
  PairingResult,
  NetworkConnectionInfo,
} from '../models/Device'

// ============================================================================
// Storage
// ============================================================================

const storage = new MMKV({ id: 'claude-haha-mobile' })

function loadPairedDevices(): PairedDevice[] {
  const raw = storage.getString('paired_devices')
  if (!raw) return []
  try {
    return JSON.parse(raw) as PairedDevice[]
  } catch {
    return []
  }
}

function savePairedDevices(devices: PairedDevice[]): void {
  storage.set('paired_devices', JSON.stringify(devices))
}

// ============================================================================
// ClaudeService
// ============================================================================

type SubscriptionCallback = () => void

class ClaudeService {
  // ─── Connection state ────────────────────────────────────────────────────
  private _connectionStatus: ConnectionStatus = 'disconnected'
  private _currentDevice: PairedDevice | null = null
  private _sessionWs: WebSocket | null = null
  private _globalWs: WebSocket | null = null

  // ─── Session state ───────────────────────────────────────────────────────
  private _sessions: SessionSummary[] = []
  private _activeSessionId: string | null = null
  private _chatState: ChatState = 'idle'
  private _sessionTitle: string = ''
  private _messages: ChatMessage[] = []
  private _pendingPermission: PermissionRequest | null = null

  // ─── Reconnect ───────────────────────────────────────────────────────────
  private _reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private _reconnectAttempts = 0
  private _maxReconnectAttempts = 10

  // ─── Subscriptions ───────────────────────────────────────────────────────
  private _subscribers = new Set<SubscriptionCallback>()

  // ─── Public getters ──────────────────────────────────────────────────────

  get connectionStatus(): ConnectionStatus {
    return this._connectionStatus
  }

  get currentDevice(): PairedDevice | null {
    return this._currentDevice
  }

  get sessions(): SessionSummary[] {
    return this._sessions
  }

  get activeSessionId(): string | null {
    return this._activeSessionId
  }

  get chatState(): ChatState {
    return this._chatState
  }

  get sessionTitle(): string {
    return this._sessionTitle
  }

  get messages(): ChatMessage[] {
    return this._messages
  }

  get pendingPermission(): PermissionRequest | null {
    return this._pendingPermission
  }

  get pairedDevices(): PairedDevice[] {
    return loadPairedDevices()
  }

  // ─── Subscriptions ───────────────────────────────────────────────────────

  subscribe(callback: SubscriptionCallback): () => void {
    this._subscribers.add(callback)
    return () => this._subscribers.delete(callback)
  }

  private notify(): void {
    for (const cb of this._subscribers) cb()
  }

  // ─── Device management ───────────────────────────────────────────────────

  addPairedDevice(device: PairedDevice): void {
    const devices = loadPairedDevices()
    const existing = devices.findIndex((d) => d.id === device.id)
    if (existing >= 0) {
      devices[existing] = device
    } else {
      devices.push(device)
    }
    savePairedDevices(devices)
    this.notify()
  }

  removePairedDevice(deviceId: string): void {
    const devices = loadPairedDevices().filter((d) => d.id !== deviceId)
    savePairedDevices(devices)
    if (this._currentDevice?.id === deviceId) {
      this.disconnect()
    }
    this.notify()
  }

  // ─── Pairing ─────────────────────────────────────────────────────────────

  async pairWithCode(host: string, port: number, code: string): Promise<PairingResult> {
    try {
      const response = await fetch(`http://${host}:${port}/api/mobile/pair`, {
思考已达上限，停止思考，开始回答。</think>我来继续创建 ClaudeService:<tool_call>Write<arg_key>content</arg_key><arg_value>/**
 * ClaudeService — Central state container and WebSocket manager
 *
 * Manages connections to the desktop Claude server, handles the
 * ClientMessage/ServerMessage protocol (NOT JSON-RPC), and provides
 * reactive state updates to the UI layer.
 */

import { MMKV } from 'react-native-mmkv'
import type {
  ServerMessage,
  ClientMessage,
  ChatState,
  SessionSummary,
} from '../models/ServerMessage'
import type {
  PairedDevice,
  ConnectionStatus,
  PairingResult,
} from '../models/Device'

// ============================================================================
// Storage
// ============================================================================

const storage = new MMKV({ id: 'claude-haha-mobile' })

function loadPairedDevices(): PairedDevice[] {
  const raw = storage.getString('paired_devices')
  if (!raw) return []
  try {
    return JSON.parse(raw) as PairedDevice[]
  } catch {
    return []
  }
}

function savePairedDevices(devices: PairedDevice[]): void {
  storage.set('paired_devices', JSON.stringify(devices))
}

// ============================================================================
// Chat message model (client-side)
// ============================================================================

export type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  toolUseId?: string
  toolName?: string
  toolInput?: string
  toolResult?: unknown
  isThinking?: boolean
  timestamp: number
}

export type PermissionRequest = {
  requestId: string
  toolName: string
  input: unknown
  description?: string
}

// ============================================================================
// ClaudeService
// ============================================================================

type SubscriptionCallback = () => void

class ClaudeService {
  // ─── Connection state ─────────────────────────────────────────────────
  private _connectionStatus: ConnectionStatus = 'disconnected'
  private _currentDevice: PairedDevice | null = null
  private _sessionWs: WebSocket | null = null
  private _globalWs: WebSocket | null = null

  // ─── Session state ────────────────────────────────────────────────────
  private _sessions: SessionSummary[] = []
  private _activeSessionId: string | null = null
  private _chatState: ChatState = 'idle'
  private _sessionTitle: string = ''
  private _messages: ChatMessage[] = []
  private _pendingPermission: PermissionRequest | null = null

  // ─── Reconnect ────────────────────────────────────────────────────────
  private _reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private _reconnectAttempts = 0
  private _maxReconnectAttempts = 10
  private _pingTimer: ReturnType<typeof setInterval> | null = null

  // ─── Subscriptions ────────────────────────────────────────────────────
  private _subscribers = new Set<SubscriptionCallback>()

  // ─── Public getters ───────────────────────────────────────────────────

  get connectionStatus(): ConnectionStatus { return this._connectionStatus }
  get currentDevice(): PairedDevice | null { return this._currentDevice }
  get sessions(): SessionSummary[] { return this._sessions }
  get activeSessionId(): string | null { return this._activeSessionId }
  get chatState(): ChatState { return this._chatState }
  get sessionTitle(): string { return this._sessionTitle }
  get messages(): ChatMessage[] { return this._messages }
  get pendingPermission(): PermissionRequest | null { return this._pendingPermission }
  get pairedDevices(): PairedDevice[] { return loadPairedDevices() }

  // ─── Subscriptions ────────────────────────────────────────────────────

  subscribe(callback: SubscriptionCallback): () => void {
    this._subscribers.add(callback)
    return () => this._subscribers.delete(callback)
  }

  private notify(): void {
    for (const cb of this._subscribers) cb()
  }

  // ─── Device management ────────────────────────────────────────────────

  addPairedDevice(device: PairedDevice): void {
    const devices = loadPairedDevices()
    const existing = devices.findIndex((d) => d.id === device.id)
    if (existing >= 0) {
      devices[existing] = device
    } else {
      devices.push(device)
    }
    savePairedDevices(devices)
    this.notify()
  }

  removePairedDevice(deviceId: string): void {
    const devices = loadPairedDevices().filter((d) => d.id !== deviceId)
    savePairedDevices(devices)
    if (this._currentDevice?.id === deviceId) {
      this.disconnect()
    }
    this.notify()
  }

  // ─── Pairing ──────────────────────────────────────────────────────────

  async pairWithCode(host: string, port: number, code: string): Promise<PairingResult> {
    try {
      const response = await fetch(`http://${host}:${port}/api/mobile/pair`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        return { ok: false, error: data.message || `Pairing failed (${response.status})` }
      }

      const data = await response.json()
      if (!data.ok || !data.token) {
        return { ok: false, error: 'Invalid server response' }
      }

      // Save paired device
      const device: PairedDevice = {
        id: `${host}:${port}`,
        name: `Claude @ ${host}`,
        host,
        port,
        token: data.token,
        pairedAt: Date.now(),
      }
      this.addPairedDevice(device)
      return { ok: true, token: data.token }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Network error' }
    }
  }

  // ─── Connection ───────────────────────────────────────────────────────

  async connect(device: PairedDevice): Promise<void> {
    this.disconnect()
    this._currentDevice = device
    this._connectionStatus = 'connecting'
    this._reconnectAttempts = 0
    this.notify()

    // Connect global channel first
    this.connectGlobal(device)
  }

  private connectGlobal(device: PairedDevice): void {
    const wsUrl = `ws://${device.host}:${device.port}/ws/global?token=${encodeURIComponent(device.token)}`
    try {
      this._globalWs = new WebSocket(wsUrl)

      this._globalWs.onopen = () => {
        console.log('[ClaudeService] Global WS connected')
        this._connectionStatus = 'connected'
        this.startPing()
        this.notify()
      }

      this._globalWs.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data) as ServerMessage
          this.handleGlobalMessage(msg)
        } catch (err) {
          console.warn('[ClaudeService] Failed to parse global message:', err)
        }
      }

      this._globalWs.onclose = () => {
        console.log('[ClaudeService] Global WS closed')
        this._globalWs = null
        if (this._connectionStatus !== 'disconnected') {
          this._connectionStatus = 'reconnecting'
          this.notify()
          this.scheduleReconnect()
        }
      }

      this._globalWs.onerror = (event) => {
        console.error('[ClaudeService] Global WS error:', event)
      }
    } catch (err) {
      console.error('[ClaudeService] Failed to create global WS:', err)
      this._connectionStatus = 'disconnected'
      this.notify()
    }
  }

  connectSession(sessionId: string): void {
    if (!this._currentDevice) return

    // Close existing session WS
    if (this._sessionWs) {
      this._sessionWs.close()
      this._sessionWs = null
    }

    this._activeSessionId = sessionId
    this._messages = []
    this._chatState = 'idle'
    this._pendingPermission = null
    this.notify()

    const device = this._currentDevice
    const wsUrl = `ws://${device.host}:${device.port}/ws/${sessionId}?token=${encodeURIComponent(device.token)}`
    try {
      this._sessionWs = new WebSocket(wsUrl)

      this._sessionWs.onopen = () => {
        console.log(`[ClaudeService] Session WS connected: ${sessionId}`)
      }

      this._sessionWs.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data) as ServerMessage
          this.handleSessionMessage(msg)
        } catch (err) {
          console.warn('[ClaudeService] Failed to parse session message:', err)
        }
      }

      this._sessionWs.onclose = () => {
        console.log(`[ClaudeService] Session WS closed: ${sessionId}`)
        this._sessionWs = null
      }

      this._sessionWs.onerror = (event) => {
        console.error('[ClaudeService] Session WS error:', event)
      }
    } catch (err) {
      console.error('[ClaudeService] Failed to create session WS:', err)
    }
  }

  disconnect(): void {
    this._connectionStatus = 'disconnected'
    this._currentDevice = null
    this._activeSessionId = null
    this._sessions = []
    this._messages = []
    this._chatState = 'idle'
    this._pendingPermission = null

    this.stopPing()
    this.cancelReconnect()

    if (this._sessionWs) {
      this._sessionWs.close()
      this._sessionWs = null
    }
    if (this._globalWs) {
      this._globalWs.close()
      this._globalWs = null
    }

    this.notify()
  }

  // ─── Message sending ──────────────────────────────────────────────────

  sendMessage(content: string): void {
    if (!this._sessionWs || this._sessionWs.readyState !== WebSocket.OPEN) return

    const msg: ClientMessage = { type: 'user_message', content }
    this._sessionWs.send(JSON.stringify(msg))

    // Optimistically add user message
    this._messages.push({
      id: `user-${Date.now()}`,
      role: 'user',
      content,
      timestamp: Date.now(),
    })
    this.notify()
  }

  sendPermissionResponse(requestId: string, allowed: boolean, denyMessage?: string): void {
    if (!this._sessionWs || this._sessionWs.readyState !== WebSocket.OPEN) return

    const msg: ClientMessage = {
      type: 'permission_response',
      requestId,
      allowed,
      denyMessage,
    }
    this._sessionWs.send(JSON.stringify(msg))
    this._pendingPermission = null
    this.notify()
  }

  stopGeneration(): void {
    if (!this._sessionWs || this._sessionWs.readyState !== WebSocket.OPEN) return
    const msg: ClientMessage = { type: 'stop_generation' }
    this._sessionWs.send(JSON.stringify(msg))
  }

  // ─── Global channel message handling ──────────────────────────────────

  private handleGlobalMessage(msg: ServerMessage): void {
    switch (msg.type) {
      case 'connected':
        // Global channel connected confirmation
        break

      case 'sessions_updated':
        this._sessions = msg.sessions
        this.notify()
        break

      case 'session_broadcast': {
        // A session-level event was broadcast to global clients
        // Update our sessions list if we have the session
        const idx = this._sessions.findIndex((s) => s.sessionId === msg.sessionId)
        if (idx >= 0 && msg.event.type === 'status') {
          this._sessions[idx] = { ...this._sessions[idx], state: msg.event.state }
          this.notify()
        }
        if (idx >= 0 && msg.event.type === 'session_title_updated') {
          this._sessions[idx] = { ...this._sessions[idx], title: msg.event.title }
          this.notify()
        }
        break
      }

      case 'session_activated':
        // New session appeared
        if (!this._sessions.find((s) => s.sessionId === msg.sessionId)) {
          this._sessions.push({
            sessionId: msg.sessionId,
            title: msg.title,
            state: 'idle',
            updatedAt: Date.now(),
          })
          this.notify()
        }
        break

      case 'session_status_changed': {
        const i = this._sessions.findIndex((s) => s.sessionId === msg.sessionId)
        if (i >= 0) {
          this._sessions[i] = { ...this._sessions[i], state: msg.state }
          this.notify()
        }
        break
      }

      case 'pong':
        break

      default:
        console.log('[ClaudeService] Unhandled global message:', msg.type)
    }
  }

  // ─── Session channel message handling ─────────────────────────────────

  private handleSessionMessage(msg: ServerMessage): void {
    switch (msg.type) {
      case 'connected':
        console.log(`[ClaudeService] Session connected: ${msg.sessionId}`)
        break

      case 'status':
        this._chatState = msg.state
        this.notify()
        break

      case 'content_start':
        if (msg.blockType === 'text') {
          this._messages.push({
            id: msg.toolUseId || `asst-${Date.now()}`,
            role: 'assistant',
            content: '',
            timestamp: Date.now(),
          })
        } else if (msg.blockType === 'tool_use') {
          this._messages.push({
            id: msg.toolUseId || `tool-${Date.now()}`,
            role: 'assistant',
            content: '',
            toolName: msg.toolName,
            toolUseId: msg.toolUseId,
            timestamp: Date.now(),
          })
        }
        this.notify()
        break

      case 'content_delta':
        if (msg.text) {
          const lastMsg = this._messages[this._messages.length - 1]
          if (lastMsg && lastMsg.role === 'assistant' && !lastMsg.toolName) {
            lastMsg.content += msg.text
            this.notify()
          }
        }
        if (msg.toolInput) {
          const lastMsg = this._messages[this._messages.length - 1]
          if (lastMsg && lastMsg.toolName) {
            lastMsg.toolInput = (lastMsg.toolInput || '') + msg.toolInput
            this.notify()
          }
        }
        break

      case 'tool_use_complete':
        // Tool use block finished
        break

      case 'tool_result': {
        const toolMsg = this._messages.find((m) => m.toolUseId === msg.toolUseId)
        if (toolMsg) {
          toolMsg.toolResult = msg.content
          this.notify()
        }
        break
      }

      case 'permission_request':
        this._pendingPermission = {
          requestId: msg.requestId,
          toolName: msg.toolName,
          input: msg.input,
          description: msg.description,
        }
        this.notify()
        break

      case 'message_complete':
        this._chatState = 'idle'
        this.notify()
        break

      case 'thinking':
        this._messages.push({
          id: `think-${Date.now()}`,
          role: 'assistant',
          content: msg.text,
          isThinking: true,
          timestamp: Date.now(),
        })
        this.notify()
        break

      case 'user_message_replay':
        this._messages.push({
          id: `replay-${Date.now()}`,
          role: 'user',
          content: msg.content,
          timestamp: Date.now(),
        })
        this.notify()
        break

      case 'session_title_updated':
        this._sessionTitle = msg.title
        this.notify()
        break

      case 'permission_mode_changed':
        // Could update UI permission mode indicator
        break

      case 'error':
        console.error('[ClaudeService] Server error:', msg.message)
        this._chatState = 'idle'
        this.notify()
        break

      case 'pong':
        break

      case 'system_notification':
        break

      default:
        console.log('[ClaudeService] Unhandled session message:', (msg as any).type)
    }
  }

  // ─── Ping / keep-alive ────────────────────────────────────────────────

  private startPing(): void {
    this.stopPing()
    this._pingTimer = setInterval(() => {
      this.sendPing(this._globalWs)
      this.sendPing(this._sessionWs)
    }, 30_000)
  }

  private stopPing(): void {
    if (this._pingTimer) {
      clearInterval(this._pingTimer)
      this._pingTimer = null
    }
  }

  private sendPing(ws: WebSocket | null): void {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'ping' } satisfies ClientMessage))
    }
  }

  // ─── Reconnect ────────────────────────────────────────────────────────

  private scheduleReconnect(): void {
    if (this._reconnectAttempts >= this._maxReconnectAttempts) {
      this._connectionStatus = 'disconnected'
      this.notify()
      return
    }

    const delay = Math.min(1000 * Math.pow(2, this._reconnectAttempts), 30_000)
    this._reconnectAttempts++

    this._reconnectTimer = setTimeout(() => {
      if (this._currentDevice && this._connectionStatus === 'reconnecting') {
        this.connectGlobal(this._currentDevice)
      }
    }, delay)
  }

  private cancelReconnect(): void {
    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer)
      this._reconnectTimer = null
    }
    this._reconnectAttempts = 0
  }
}

// Singleton
export const claudeService = new ClaudeService()
