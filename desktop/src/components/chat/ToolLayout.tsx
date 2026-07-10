/**
 * ToolLayout — unified card wrapper for all tool call types.
 * Mirrors ZCode's ToolLayout (tQ) component with:
 * - Icon + label + detail + status badge
 * - Expand/collapse with localStorage persistence
 * - autoCollapseOnComplete
 * - Streaming entrance animation
 */
import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { ChevronDown, type LucideIcon } from 'lucide-react'

type ToolLayoutProps = {
  /** Unique tool call ID — used for localStorage key */
  toolId: string
  /** Icon component */
  icon: LucideIcon
  /** Whether to show the icon */
  showIcon?: boolean
  /** Primary label (e.g. "正在运行 Bash") */
  kindLabel: React.ReactNode
  /** Secondary detail text (e.g. file name, command) */
  kindDetail?: React.ReactNode
  /** Summary content on the right side */
  primaryText?: React.ReactNode
  /** Status badge text */
  statusLabel?: React.ReactNode
  /** Whether the tool is currently running */
  isRunning?: boolean
  /** Whether to show failure status styling */
  showFailureStatus?: boolean
  /** Whether the card can be expanded/collapsed */
  canToggle?: boolean
  /** Force the card to always be open */
  forceOpen?: boolean
  /** Auto-open on mount */
  autoOpen?: boolean
  /** Auto-collapse when the tool completes */
  autoCollapseOnComplete?: boolean
  /** Streaming entrance animation */
  animate?: boolean
  /** Data attributes for testing/debugging */
  dataToolName?: string
  dataStatus?: string
  /** Render function for expanded content */
  renderContent?: () => React.ReactNode
  /** Compact mode */
  compact?: boolean
}

const STORAGE_PREFIX = 'tool-layout-open:'

function getStoredOpen(toolId: string): boolean | null {
  try {
    const value = localStorage.getItem(`${STORAGE_PREFIX}${toolId}`)
    return value === null ? null : value === 'true'
  } catch {
    return null
  }
}

function storeOpen(toolId: string, isOpen: boolean): void {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${toolId}`, String(isOpen))
  } catch {
    // localStorage may be unavailable
  }
}

export const ToolLayout = memo(function ToolLayout({
  toolId,
  icon: Icon,
  showIcon = true,
  kindLabel,
  kindDetail,
  primaryText,
  statusLabel,
  isRunning = false,
  showFailureStatus = false,
  canToggle = true,
  forceOpen = false,
  autoOpen = false,
  autoCollapseOnComplete = false,
  animate = false,
  dataToolName,
  dataStatus,
  renderContent,
  compact = false,
}: ToolLayoutProps) {
  const hasContent = Boolean(renderContent)
  const effectiveCanToggle = canToggle && hasContent && !forceOpen

  // Use a unique instance key so localStorage doesn't collide across
  // different ToolLayout instances that happen to share the same toolId
  const [instanceKey] = useState(() => `${toolId}-${Math.random().toString(36).slice(2, 8)}`)

  // Initialize open state
  const [isOpen, setIsOpen] = useState(() => {
    if (forceOpen) return true
    if (autoOpen) return true
    const stored = getStoredOpen(instanceKey)
    return stored ?? false
  })

  // Track running state for autoCollapseOnComplete
  const wasRunningRef = useRef(isRunning)

  useEffect(() => {
    // Auto-collapse when transitioning from running to not running
    if (autoCollapseOnComplete && wasRunningRef.current && !isRunning) {
      setIsOpen(false)
      storeOpen(instanceKey, false)
    }
    wasRunningRef.current = isRunning
  }, [autoCollapseOnComplete, isRunning, instanceKey])

  const handleToggle = useCallback(() => {
    if (!effectiveCanToggle) return
    setIsOpen((prev) => {
      const next = !prev
      storeOpen(instanceKey, next)
      return next
    })
  }, [effectiveCanToggle, instanceKey])

  const shouldShowContent = (forceOpen || isOpen) && hasContent

  return (
    <div
      className={`tool-call-row ${compact ? 'mb-0' : 'mb-[2px]'} ${animate ? 'tool-stream-animate' : ''}`}
      data-tool-call-id={toolId}
      data-tool-name={dataToolName}
      data-status={dataStatus}
    >
      <button
        type="button"
        onClick={handleToggle}
        className={`group/tool-summary inline-flex max-w-full items-center gap-1.5 self-start text-left text-[13px] transition-colors hover:opacity-80 ${
          effectiveCanToggle ? 'cursor-pointer' : 'cursor-default'
        }`}
      >
        {/* Icon */}
        {showIcon && (
          <Icon
            size={16}
            className={`shrink-0 ${
              showFailureStatus
                ? 'text-[var(--color-error)]'
                : 'text-[var(--color-token-icon-foreground)]'
            }`}
            aria-hidden="true"
          />
        )}

        {/* Kind label */}
        <span
          className={`font-medium whitespace-nowrap shrink-0 text-[12px] ${
            isRunning ? 'animated-tool-label' : 'text-[var(--color-token-text-secondary)]'
          }`}
        >
          {kindLabel}
        </span>

        {/* Kind detail */}
        {kindDetail && (
          <span className="min-w-0 truncate font-[var(--font-mono)] text-[12px] text-[var(--color-token-text-tertiary)]">
            {kindDetail}
          </span>
        )}

        {/* Primary text / spacer */}
        {primaryText ? (
          <span className="flex min-w-0 flex-1 items-center gap-1.5">
            {primaryText}
          </span>
        ) : (
          <span className="flex-1" />
        )}

        {/* Status label */}
        {statusLabel && (
          <span className="shrink-0">{statusLabel}</span>
        )}

        {/* Expand/collapse chevron */}
        {effectiveCanToggle && (
          <ChevronDown
            size={14}
            className={`shrink-0 text-[var(--color-token-icon-foreground)] transition-transform duration-200 ${
              shouldShowContent ? 'rotate-180' : ''
            }`}
            aria-hidden="true"
          />
        )}
      </button>

      {/* Expanded content */}
      {shouldShowContent && (
        <div className="ml-2 mt-0.5 space-y-2 border-l border-[var(--color-token-border-default)] pl-3.5 text-[var(--color-token-foreground)] outline-none">
          {renderContent?.()}
        </div>
      )}
    </div>
  )
})
