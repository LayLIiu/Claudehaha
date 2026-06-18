/**
 * Server message types — mirrors the server's ServerMessage union
 *
 * These types match the protocol defined in src/server/ws/events.ts
 * on the desktop server. They are NOT JSON-RPC — they are custom
 * ClientMessage/ServerMessage protocol.
 */

// ============================================================================
// Client → Server
// ============================================================================

export type ClientMessage =
  | { type: 'prewarm_session' }
  | { type: 'user_message'; content: string; attachments?: AttachmentRef[] }
  | {
      type: 'permission_response'
      requestId: string
      allowed: boolean
      rule?: string
      updatedInput?: Record<string, unknown>
      denyMessage?: string
      permissionUpdates?: unknown[]
    }
  | { type: 'set_permission_mode'; mode: string }
  | { type: 'set_runtime_config'; providerId: string | null; modelId: string; effortLevel?: string }
  | { type: 'stop_generation' }
  | { type: 'ping' }

export type AttachmentRef = {
  type: 'file' | 'image'
  name?: string
  path?: string
  data?: string
  mimeType?: string
  isDirectory?: boolean
}

// ============================================================================
// Server → Client
// ============================================================================

export type ChatState = 'idle' | 'thinking' | 'compacting' | 'tool_executing' | 'streaming' | 'permission_pending'

export type ServerMessage =
  | { type: 'connected'; sessionId: string }
  | { type: 'content_start'; blockType: 'text' | 'tool_use'; toolName?: string; toolUseId?: string; parentToolUseId?: string }
  | { type: 'content_delta'; text?: string; toolInput?: string }
  | { type: 'tool_use_complete'; toolName: string; toolUseId: string; input: unknown; parentToolUseId?: string }
  | { type: 'tool_result'; toolUseId: string; content: unknown; isError: boolean; parentToolUseId?: string }
  | { type: 'permission_request'; requestId: string; toolName: string; toolUseId?: string; input: unknown; description?: string }
  | { type: 'user_message_replay'; content: string }
  | { type: 'message_complete'; usage: TokenUsage }
  | { type: 'thinking'; text: string }
  | { type: 'status'; state: ChatState; verb?: string }
  | { type: 'permission_mode_changed'; mode: string }
  | { type: 'streaming_fallback'; cause: string }
  | { type: 'error'; message: string; code: string; retryable?: boolean; businessErrorCode?: string }
  | { type: 'system_notification'; subtype: string; message?: string; data?: unknown }
  | { type: 'pong' }
  | { type: 'session_title_updated'; sessionId: string; title: string }
  // Global channel messages
  | { type: 'session_broadcast'; sessionId: string; event: ServerMessage }
  | { type: 'session_activated'; sessionId: string; title?: string }
  | { type: 'session_status_changed'; sessionId: string; state: ChatState }
  | { type: 'sessions_updated'; sessions: SessionSummary[] }

export type TokenUsage = {
  input_tokens: number
  output_tokens: number
  cache_read_tokens?: number
  cache_creation_tokens?: number
}

export type SessionSummary = {
  sessionId: string
  title?: string
  state: ChatState
  updatedAt: number
}
