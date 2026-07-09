import type { UUID } from 'crypto'
import type { RenderableMessage } from '../types/message.js'

// ─── Turn Process Group type ────────────────────────────────────────
// Mirrors the desktop's TurnProcessGroup — collects all intermediate
// messages (thinking, tool calls, non-final assistant text) between a
// user message and the final assistant answer, and folds them into a
// single collapsible "Worked 48s" / "Working 48s" / "Processed" row.

export type TurnProcessGroup = {
  type: 'turn_process'
  /** All intermediate messages that are folded into this group */
  processMessages: RenderableMessage[]
  /** User message ID that starts this turn */
  userMsgId: string
  /** Start timestamp (user message) */
  startTime: number | null
  /** End timestamp (last process item) */
  endTime: number | null
  /** UUID for React keying and virtual scroll */
  uuid: UUID
  /** Timestamp for MessageRow metadata display */
  timestamp?: Date
}

// ─── Duration formatting ────────────────────────────────────────────

const MS_PER_SECOND = 1000
const MS_PER_MINUTE = 60 * MS_PER_SECOND
const MS_PER_HOUR = 60 * MS_PER_MINUTE
const MS_PER_DAY = 24 * MS_PER_HOUR

/** Format duration as "48s", "2m 3s", "1h 2m 3s", "1d 2h" etc. */
export function formatTurnDuration(durationMs: number): string {
  const ms = Math.max(durationMs, 0)
  const days = Math.floor(ms / MS_PER_DAY)
  const hours = Math.floor((ms % MS_PER_DAY) / MS_PER_HOUR)
  const minutes = Math.floor((ms % MS_PER_HOUR) / MS_PER_MINUTE)
  const seconds = Math.floor((ms % MS_PER_MINUTE) / MS_PER_SECOND)
  const parts: string[] = []
  if (days > 0) parts.push(`${days}d`)
  if (hours > 0) parts.push(`${hours}h`)
  if (minutes > 0) parts.push(`${minutes}m`)
  if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`)
  return parts.join(' ')
}

// ─── shouldForceHistoryOpen ─────────────────────────────────────────
// Mirrors ZCode's R1: streaming / settling / no latest part → keep open

export function shouldForceHistoryOpen(
  hasLatestPart: boolean,
  streaming: boolean,
  settling: boolean,
): boolean {
  return streaming || settling || !hasLatestPart
}

// ─── Module-level state persistence ─────────────────────────────────
// Persists user's manual expand/collapse across re-renders (mirrors ZCode's N1 Map)

export const historyOpenStateMap = new Map<string, boolean>()

// ─── applyTurnCollapse ──────────────────────────────────────────────

/** Check if a message is a user text message */
function isUserTextMessage(msg: RenderableMessage): boolean {
  return msg.type === 'user' && msg.message.content.length > 0 && msg.message.content[0]?.type === 'text'
}

/** Check if a message is an assistant text message (not just tool_use/thinking) */
function isAssistantTextMessage(msg: RenderableMessage): boolean {
  if (msg.type !== 'assistant') return false
  // An assistant message is "final text" if it has a text content block
  return msg.message.content.some(
    (block: { type: string }) => block.type === 'text',
  )
}

/** Get timestamp from a RenderableMessage */
function getMessageTimestamp(msg: RenderableMessage): number | null {
  if (msg.timestamp instanceof Date) return msg.timestamp.getTime()
  if (typeof msg.timestamp === 'number') return msg.timestamp
  return null
}

/** Get UUID from a RenderableMessage */
function getMessageUuid(msg: RenderableMessage): UUID {
  return msg.uuid
}

/**
 * Collapse intermediate turn content into turn_process groups.
 * Mirrors the desktop's applyTurnCollapse: everything between a user
 * message and the final assistant_text is folded into a TurnProcessGroup.
 */
export function applyTurnCollapse(
  items: RenderableMessage[],
  hasStreamingAnswer?: boolean,
): RenderableMessage[] {
  const result: RenderableMessage[] = []
  let currentUserMsgId: string | null = null
  let currentUserMsgTimestamp: number | null = null
  let turnItems: RenderableMessage[] = []

  const flushCurrentTurn = (isLast: boolean) => {
    if (currentUserMsgId === null) return

    // Find the last assistant message that contains text — the final answer
    let lastAssistantIdx = -1
    for (let i = turnItems.length - 1; i >= 0; i--) {
      const ti = turnItems[i]!
      if (isAssistantTextMessage(ti)) {
        lastAssistantIdx = i
        break
      }
    }

    const hasFinalAnswer = lastAssistantIdx >= 0 || (isLast && hasStreamingAnswer)

    if (hasFinalAnswer) {
      const processItems = lastAssistantIdx >= 0
        ? turnItems.slice(0, lastAssistantIdx)
        : turnItems
      const finalAssistant = lastAssistantIdx >= 0 ? turnItems[lastAssistantIdx]! : null
      const afterItems = lastAssistantIdx >= 0 ? turnItems.slice(lastAssistantIdx + 1) : []

      if (processItems.length > 0) {
        // Derive endTime from the last process item
        let endTime: number | null = null
        for (let i = processItems.length - 1; i >= 0; i--) {
          const ts = getMessageTimestamp(processItems[i]!)
          if (ts != null) { endTime = ts; break }
        }

        const firstUuid = getMessageUuid(processItems[0]!)
        result.push({
          type: 'turn_process',
          processMessages: [...processItems],
          userMsgId: currentUserMsgId!,
          startTime: currentUserMsgTimestamp,
          endTime,
          uuid: `turn-${firstUuid}` as UUID,
          timestamp: processItems[0]?.timestamp,
        } as RenderableMessage)
      }

      if (finalAssistant) result.push(finalAssistant)
      for (const ai of afterItems) result.push(ai)
    } else {
      for (const ti of turnItems) result.push(ti)
    }
  }

  for (const item of items) {
    if (isUserTextMessage(item)) {
      flushCurrentTurn(false)
      currentUserMsgId = String(item.uuid)
      currentUserMsgTimestamp = getMessageTimestamp(item)
      turnItems = []
      result.push(item)
      continue
    }

    // background_task messages should not be collapsed into turn_process
    if (item.type === 'system' && item.message?.content?.[0]?.type === 'background_task') {
      flushCurrentTurn(false)
      result.push(item)
      continue
    }

    if (currentUserMsgId === null) {
      result.push(item)
      continue
    }

    turnItems.push(item)
  }

  flushCurrentTurn(true)
  return result
}
