import React, { useEffect, useRef, useState } from 'react'
import { Box, Text } from '../../ink.js'
import type { TurnProcessGroup } from '../../utils/turnCollapse.js'
import {
  formatTurnDuration,
  shouldForceHistoryOpen,
  historyOpenStateMap,
} from '../../utils/turnCollapse.js'
import { CtrlOToExpand } from '../CtrlOToExpand.js'
import { ToolUseLoader } from '../ToolUseLoader.js'

type Props = {
  message: TurnProcessGroup
  /** Whether the turn is actively streaming */
  isStreaming: boolean
  /** Whether the turn is settling (stream done but UI not committed) */
  settling?: boolean
  /** Whether a final answer (latest part) exists */
  hasLatestPart: boolean
  /** Render a process message in verbose mode */
  renderProcessMessage: (msg: TurnProcessGroup['processMessages'][number]) => React.ReactNode
}

/** ZCode-style collapsible history section for completed turn process items.
 *  Shows "Working 48s" / "Worked 48s" / "Processed" and auto-collapses
 *  when streaming ends and a final answer is present. */
export function TurnProcessContent({
  message,
  isStreaming,
  settling = false,
  hasLatestPart,
  renderProcessMessage,
}: Props): React.ReactNode {
  const stateKey = String(message.uuid)
  const forceOpen = shouldForceHistoryOpen(hasLatestPart, isStreaming, settling)
  const [isOpen, setIsOpen] = useState(() => historyOpenStateMap.get(stateKey) ?? forceOpen)
  const resolvedIsOpen = forceOpen ? true : isOpen

  // Live elapsed timer
  const startedAt = message.startTime ?? Date.now()
  const [liveElapsed, setLiveElapsed] = useState(() => Math.max(Date.now() - startedAt, 0))
  const wasStreamingRef = useRef(isStreaming)
  const frozenElapsedRef = useRef<number | null>(isStreaming ? null : Math.max(Date.now() - startedAt, 0))

  // Sync open state when forceOpen changes
  useEffect(() => {
    setIsOpen(historyOpenStateMap.get(stateKey) ?? shouldForceHistoryOpen(hasLatestPart, isStreaming, settling))
  }, [hasLatestPart, settling, stateKey, isStreaming])

  // Handle streaming → idle transition: freeze elapsed and auto-collapse
  useEffect(() => {
    if (isStreaming) {
      wasStreamingRef.current = true
      frozenElapsedRef.current = null
      setIsOpen(true)
      setLiveElapsed(Math.max(Date.now() - startedAt, 0))
      const interval = globalThis.setInterval(() => {
        setLiveElapsed(Math.max(Date.now() - startedAt, 0))
      }, 1000)
      return () => { globalThis.clearInterval(interval) }
    }
    if (settling) {
      setIsOpen(true)
      return
    }
    // Streaming just ended
    if (wasStreamingRef.current && frozenElapsedRef.current === null) {
      const frozen = Math.max(Date.now() - startedAt, 0)
      frozenElapsedRef.current = frozen
      setLiveElapsed(frozen)
      historyOpenStateMap.set(stateKey, false)
      setIsOpen(false)
    }
  }, [settling, startedAt, stateKey, isStreaming])

  // Compute display duration
  const computedDuration = wasStreamingRef.current ? (frozenElapsedRef.current ?? liveElapsed) : undefined
  const displayDuration = isStreaming ? liveElapsed : message.endTime != null && message.startTime != null
    ? message.endTime - message.startTime
    : computedDuration

  // Compute label text (English only — H5 CLI has no i18n)
  const isActivelyWorking = shouldForceHistoryOpen(hasLatestPart, isStreaming, settling)
  const durationStr = displayDuration != null ? formatTurnDuration(displayDuration) : null
  const label = isStreaming
    ? `Working ${durationStr ?? formatTurnDuration(liveElapsed)}`
    : durationStr
      ? `Worked ${durationStr}`
      : 'Processed'

  const handleToggle = () => {
    if (isActivelyWorking) return
    const next = !resolvedIsOpen
    historyOpenStateMap.set(stateKey, next)
    setIsOpen(next)
  }

  // Verbose (expanded) mode
  if (resolvedIsOpen && message.processMessages.length > 0) {
    return (
      <Box flexDirection="column">
        <Box flexDirection="row" marginTop={1}>
          {isStreaming ? <ToolUseLoader shouldAnimate isUnresolved /> : <Box minWidth={2} />}
          <Text dimColor>{label}</Text>
        </Box>
        {message.processMessages.map((msg, i) => (
          <Box key={`process-${i}`} flexDirection="column">
            {renderProcessMessage(msg)}
          </Box>
        ))}
      </Box>
    )
  }

  // Collapsed mode
  return (
    <Box flexDirection="column" marginTop={1}>
      <Box flexDirection="row">
        {isStreaming ? <ToolUseLoader shouldAnimate isUnresolved /> : <Box minWidth={2} />}
        <Text
          dimColor={!isActivelyWorking}
          bold={isActivelyWorking}
        >
          {label}
          {!isActivelyWorking && message.processMessages.length > 0 && (
            <> <CtrlOToExpand /></>
          )}
        </Text>
      </Box>
    </Box>
  )
}
