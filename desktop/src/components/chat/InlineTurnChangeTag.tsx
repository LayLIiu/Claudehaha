/**
 * InlineTurnChangeTag — 内联每轮变更折叠标签
 *
 * 参考 ZCode 的 MessageChangeSummaryPanel：在每轮 assistant 消息后，
 * 紧凑的 Chevron 标签，默认折叠显示变更计数，展开后显示文件列表。
 * 数据使用客户端实时计算的 liveTurnChangeSummary（无需后端 checkpoint）。
 */
import { useState } from 'react'
import { ChevronDown, ChevronRight, FileDiff } from 'lucide-react'
import type { LiveTurnChangeSummary } from './turnLiveChangeSummary'
import { RollingDiffStats } from './RollingDiffStats'
import { relativizeWorkspacePath } from './CurrentTurnChangeCard'
import { useTranslation } from '../../i18n'
import { useWorkspacePanelStore } from '../../stores/workspacePanelStore'
import { isAbsoluteLocalPath, localFileUrl } from '../../lib/handlePreviewLink'
import { shouldOfferStaticHtmlPreview } from '../../lib/htmlPreviewPolicy'
import { getServerBaseUrl } from '../../lib/desktopRuntime'
import { useBrowserPanelStore } from '../../stores/browserPanelStore'

type InlineTurnChangeTagProps = {
  summary: LiveTurnChangeSummary
  workDir?: string | null
  sessionId?: string
  files: Array<{ path: string; additions: number; deletions: number }>
}

export function InlineTurnChangeTag({ summary, workDir, sessionId, files }: InlineTurnChangeTagProps) {
  const t = useTranslation()
  const [expanded, setExpanded] = useState(false)

  function openFile(file: { path: string }) {
    if (!sessionId) return
    const displayPath = relativizeWorkspacePath(file.path, workDir ?? null)
    if (isAbsoluteLocalPath(displayPath)) {
      if (shouldOfferStaticHtmlPreview(displayPath, { siblingFiles: files.map((f) => f.path) })) {
        useBrowserPanelStore.getState().open(sessionId, localFileUrl(getServerBaseUrl(), file.path))
        return
      }
      void useWorkspacePanelStore.getState().openPreview(sessionId, displayPath, 'file')
      return
    }
    void useWorkspacePanelStore.getState().openPreview(sessionId, displayPath, 'diff')
  }

  return (
    <div
      data-testid="inline-turn-change-tag"
      className="mt-1 overflow-hidden rounded-xl border border-[var(--color-token-border)] bg-[var(--color-card,#fff)] shadow-none"
    >
      {/* Header — always visible */}
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        aria-expanded={expanded}
        className="flex h-10 w-full items-center justify-between gap-3 px-2 text-left transition-colors hover:bg-[var(--color-surface-hover,rgba(10,10,10,0.05))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-brand)]/30"
      >
        <span className="flex min-w-0 items-center gap-2">
          {expanded ? (
            <ChevronDown size={14} className="shrink-0 text-[var(--color-token-text-secondary)]" />
          ) : (
            <ChevronRight size={14} className="shrink-0 text-[var(--color-token-text-secondary)]" />
          )}
          <FileDiff size={14} className="shrink-0 text-[var(--color-token-text-secondary)]" />
          <span className="min-w-0 truncate text-[13px] font-medium text-[var(--color-token-foreground)]">
            {t('chat.turnChangesInlineTitle', { count: String(summary.fileCount) })}
          </span>
        </span>
        <RollingDiffStats
          stats={summary}
          variant="inline"
          className="shrink-0 font-mono text-[13px] font-medium"
        />
      </button>

      {/* Expanded file list */}
      {expanded && (
        <div className="divide-y divide-[var(--color-token-border)] border-t border-[var(--color-token-border)]">
          {files.map((file) => {
            const displayPath = relativizeWorkspacePath(file.path, workDir ?? null)
            return (
              <button
                key={file.path}
                type="button"
                onClick={() => openFile(file)}
                title={displayPath}
                className="flex min-h-[38px] w-full items-center justify-between gap-3 px-3 text-left transition-colors hover:bg-[var(--color-surface-hover,rgba(10,10,10,0.05))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-brand)]/30"
              >
                <span className="min-w-0 flex-1 truncate text-[13px] text-[var(--color-token-foreground)]">
                  {displayPath}
                </span>
                <span className="flex shrink-0 items-baseline gap-1 font-mono text-[13px] font-medium">
                  <span className="text-[var(--color-diff-added,oklch(62.7% .194 149.214))]">+{file.additions}</span>
                  <span className="text-[var(--color-diff-removed,oklch(57.7% .245 27.325))]">-{file.deletions}</span>
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
