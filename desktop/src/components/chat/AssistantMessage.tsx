import { memo, useCallback, useMemo } from 'react'
import type { MouseEvent as ReactMouseEvent } from 'react'
import { MarkdownRenderer } from '../markdown/MarkdownRenderer'
import { MessageActionBar, type MessageBranchAction } from './MessageActionBar'
import { ForkEntryRow } from './ForkEntryRow'
import { InlineTurnChangeTag } from './InlineTurnChangeTag'
import { InlineImageGallery } from './InlineImageGallery'
import { InlineVideoGallery } from './InlineVideoGallery'
import { AssistantOutputTargetCard } from './AssistantOutputTargetCard'
import type { LiveTurnChangeSummary } from './turnLiveChangeSummary'
import { handlePreviewLink } from '../../lib/handlePreviewLink'
import { getServerBaseUrl } from '../../lib/desktopRuntime'
import { getDesktopHost } from '../../lib/desktopHost'
import { extractAssistantOutputTargets } from '../../lib/assistantOutputTargets'
import { useBrowserPanelStore } from '../../stores/browserPanelStore'
import { useWorkspacePanelStore } from '../../stores/workspacePanelStore'
import { useTranslation } from '../../i18n'

type Props = {
  content: string
  isStreaming?: boolean
  branchAction?: MessageBranchAction
  /** Inline fork entry (before/after buttons).  Replaces the small branch
   *  icon in MessageActionBar when present. */
  forkEntry?: {
    loading?: boolean
    disabled?: boolean
    onForkBefore: () => void
    onForkAfter: () => void
  }
  /** Per-turn change summary computed client-side (ZCode-style MessageChangeSummaryPanel) */
  turnChange?: {
    summary: LiveTurnChangeSummary
    files: Array<{ path: string; additions: number; deletions: number }>
  }
  sessionId?: string
  timestamp?: number
  showActions?: boolean
  /** This turn's real changed files (absolute), used to anchor output chips onto
   *  files that were actually written instead of guessing from the prose. */
  turnChangedFiles?: string[]
}

const MAX_CARDS = 3

export const AssistantMessage = memo(function AssistantMessage({ content, isStreaming, branchAction, forkEntry, turnChange, sessionId, timestamp, showActions = true, turnChangedFiles }: Props) {
  const t = useTranslation()
  const workDir = useWorkspacePanelStore((s) => (sessionId ? s.statusBySession[sessionId]?.workDir : undefined))

  const handleLinkClick = useCallback(
    (href: string, event: ReactMouseEvent<HTMLDivElement>): boolean => {
      if (!sessionId) return false
      const handled = handlePreviewLink(href, {
        sessionId,
        serverBaseUrl: getServerBaseUrl(),
        openBrowser: (id, url) => useBrowserPanelStore.getState().open(id, url),
        openFilePreview: (id, path) => {
          void useWorkspacePanelStore.getState().openPreview(id, path, 'file')
        },
        openExternal: (url) => {
          void getDesktopHost().shell.open(url)
            .catch(() => window.open(url, '_blank'))
        },
      })
      if (handled) event.preventDefault()
      return handled
    },
    [sessionId],
  )

  const outputTargets = useMemo(
    () =>
      isStreaming || !sessionId
        ? []
        : // Image/video targets render inline (InlineImageGallery/InlineVideoGallery); never also as a card.
          extractAssistantOutputTargets(content, { workDir, changedFiles: turnChangedFiles }).filter(
            (target) => target.kind !== 'image' && target.kind !== 'video',
          ),
    [content, isStreaming, sessionId, workDir, turnChangedFiles],
  )

  if (!content.trim()) return null

  const documentLayout = shouldUseDocumentLayout(content)

  return (
    <div className="codex-task-stream-item flex justify-start">
      <div
        data-message-shell="assistant"
        data-layout="document"
        data-local-conversation-final-assistant=""
        className="group/group group/message flex min-w-0 w-full max-w-[var(--thread-content-max-width)] flex-col"
      >
        <div className="w-full text-[var(--text-size-chat)] leading-[calc(var(--text-size-chat)_+_8px)] text-[var(--color-token-conversation-body)]">
          <MarkdownRenderer
            content={content}
            variant={documentLayout ? 'document' : 'default'}
            streaming={isStreaming}
            onLinkClick={sessionId ? handleLinkClick : undefined}
          />
          {!isStreaming && <InlineImageGallery text={content} sessionId={sessionId} workDir={workDir} />}
          {!isStreaming && <InlineVideoGallery text={content} sessionId={sessionId} workDir={workDir} />}
          {isStreaming && (
            <span className="ml-0.5 inline-block h-4 w-0.5 animate-shimmer bg-[var(--color-brand)] align-text-bottom" />
          )}
        </div>

        {!isStreaming && sessionId && outputTargets.length > 0 && (
          <div className="mt-3 flex w-full flex-col gap-2.5">
            {outputTargets.slice(0, MAX_CARDS).map((target) => (
              <AssistantOutputTargetCard key={target.id} target={target} sessionId={sessionId} workDir={workDir} />
            ))}
            {outputTargets.length > MAX_CARDS && (
              <div className="px-1 text-xs text-[var(--color-token-text-secondary)]">
                {t('assistantOutputs.moreOutputs', { count: String(outputTargets.length - MAX_CARDS) })}
              </div>
            )}
          </div>
        )}

        {showActions && (
          <MessageActionBar
            copyText={isStreaming ? undefined : content}
            copyLabel="Copy reply"
            branchAction={forkEntry ? undefined : branchAction}
            align="start"
            timestamp={timestamp}
          />
        )}

        {showActions && forkEntry && (
          <ForkEntryRow
            loading={forkEntry.loading}
            disabled={forkEntry.disabled}
            onForkBefore={forkEntry.onForkBefore}
            onForkAfter={forkEntry.onForkAfter}
          />
        )}

        {showActions && turnChange && !isStreaming && (
          <InlineTurnChangeTag
            summary={turnChange.summary}
            workDir={workDir ?? null}
            sessionId={sessionId}
            files={turnChange.files}
          />
        )}
      </div>
    </div>
  )
})

function shouldUseDocumentLayout(content: string) {
  const normalized = content.trim()
  if (!normalized) return false

  if (/```/.test(normalized)) return true
  if (/^\s{0,3}(#{1,6}\s|[-*+]\s|\d+\.\s|>\s|\|.+\|)/m.test(normalized)) return true

  const paragraphs = normalized
    .split(/\n\s*\n/)
    .map((chunk) => chunk.trim())
    .filter(Boolean)

  return paragraphs.length >= 2 || normalized.split('\n').filter((line) => line.trim()).length >= 8
}
