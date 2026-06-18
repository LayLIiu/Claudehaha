/**
 * useClaudeService — React hook for subscribing to ClaudeService state
 */

import { useState, useEffect, useCallback, useSyncExternalStore } from 'react'
import { claudeService } from '../services/ClaudeService'
import type { ConnectionStatus, PairedDevice } from '../models/Device'
import type { ChatState, SessionSummary } from '../models/ServerMessage'
import type { ChatMessage, PermissionRequest } from '../services/ClaudeService'

function useClaudeSnapshot() {
  return useSyncExternalStore(
    (callback) => claudeService.subscribe(callback),
    () => 0, // snapshot version — triggers re-render via subscribe
  )
}

export function useConnectionStatus(): ConnectionStatus {
  useClaudeSnapshot()
  return claudeService.connectionStatus
}

export function useCurrentDevice(): PairedDevice | null {
  useClaudeSnapshot()
  return claudeService.currentDevice
}

export function useSessions(): SessionSummary[] {
  useClaudeSnapshot()
  return claudeService.sessions
}

export function useActiveSessionId(): string | null {
  useClaudeSnapshot()
  return claudeService.activeSessionId
}

export function useChatState(): ChatState {
  useClaudeSnapshot()
  return claudeService.chatState
}

export function useMessages(): ChatMessage[] {
  useClaudeSnapshot()
  return claudeService.messages
}

export function usePendingPermission(): PermissionRequest | null {
  useClaudeSnapshot()
  return claudeService.pendingPermission
}

export function usePairedDevices(): PairedDevice[] {
  useClaudeSnapshot()
  return claudeService.pairedDevices
}

export function useSessionTitle(): string {
  useClaudeSnapshot()
  return claudeService.sessionTitle
}

export function useClaudeActions() {
  return {
    connect: useCallback((device: PairedDevice) => claudeService.connect(device), []),
    disconnect: useCallback(() => claudeService.disconnect(), []),
    connectSession: useCallback((sessionId: string) => claudeService.connectSession(sessionId), []),
    sendMessage: useCallback((content: string) => claudeService.sendMessage(content), []),
    sendPermissionResponse: useCallback(
      (requestId: string, allowed: boolean, denyMessage?: string) =>
        claudeService.sendPermissionResponse(requestId, allowed, denyMessage),
      [],
    ),
    stopGeneration: useCallback(() => claudeService.stopGeneration(), []),
    pairWithCode: useCallback(
      (host: string, port: number, code: string) =>
        claudeService.pairWithCode(host, port, code),
      [],
    ),
    removePairedDevice: useCallback((id: string) => claudeService.removePairedDevice(id), []),
  }
}
