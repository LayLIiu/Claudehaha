import { useCallback, useMemo, useState } from 'react'
import { ChevronDown, ChevronUp, FileDiff, RotateCcw } from 'lucide-react'
import type { SessionTurnCheckpoint } from '../../api/sessions'
import { useTranslation } from '../../i18n'
import { isPreviewableChangedFile } from '../../lib/openWithItems'
import { isAbsoluteLocalPath, localFileUrl } from '../../lib/handlePreviewLink'
import { shouldOfferStaticHtmlPreview } from '../../lib/htmlPreviewPolicy'
import { getServerBaseUrl } from '../../lib/desktopRuntime'
import { useBrowserPanelStore } from '../../stores/browserPanelStore'
import { useWorkspacePanelStore } from '../../stores/workspacePanelStore'

type CurrentTurnChangeCardProps = {
  sessionId: string
  checkpoint: SessionTurnCheckpoint
  workDir: string | null
  error: string | null
  isUndoing: boolean
  isLatest: boolean
  onUndo: () => void
}

type ChangedFileEntry = {
  apiPath: string
  displayPath: string
  insertions: number | null
  deletions: number | null
}

const COLLAPSED_COUNT = 5

export function CurrentTurnChangeCard({
  sessionId,
  checkpoint,
  workDir,
  error,
  isUndoing,
  isLatest,
  onUndo,
}: CurrentTurnChangeCardProps) {
  const t = useTranslation()
  const [showAllFiles, setShowAllFiles] = useState(false)

  const fileStatsByPath = useMemo(() => {
    const stats = new Map<string, { insertions: number; deletions: number }>()
    for (const item of checkpoint.code.fileStats ?? []) {
      stats.set(normalizeStatsPath(item.path), {
        insertions: item.insertions,
        deletions: item.deletions,
      })
      stats.set(normalizeStatsPath(relativizeWorkspacePath(item.path, workDir)), {
        insertions: item.insertions,
        deletions: item.deletions,
      })
    }
    return stats
  }, [checkpoint.code.fileStats, workDir])

  const files = useMemo<ChangedFileEntry[]>(
    () => checkpoint.code.filesChanged
      .map((filePath) => {
        const displayPath = relativizeWorkspacePath(filePath, workDir)
        const stats = fileStatsByPath.get(normalizeStatsPath(filePath))
          ?? fileStatsByPath.get(normalizeStatsPath(displayPath))
        return {
          apiPath: filePath,
          displayPath,
          insertions: stats?.insertions ?? null,
          deletions: stats?.deletions ?? null,
        }
      })
      .sort((a, b) => Number(isPreviewableChangedFile(b.displayPath)) - Number(isPreviewableChangedFile(a.displayPath))),
    [checkpoint.code.filesChanged, fileStatsByPath, workDir],
  )

  const canCollapse = files.length > COLLAPSED_COUNT
  const visibleFiles = canCollapse && !showAllFiles
    ? files.slice(0, COLLAPSED_COUNT)
    : files

  const openChangedFile = useCallback((fileEntry: ChangedFileEntry) => {
    // A changed file outside the workdir (absolute displayPath — e.g. another
    // drive) has no checkpoint baseline, so a diff is meaningless. Render html in
    // the in-app browser and everything else as a file preview (served by its
    // absolute path). In-workdir files keep the diff view.
    if (isAbsoluteLocalPath(fileEntry.displayPath)) {
      if (shouldOfferStaticHtmlPreview(fileEntry.displayPath, { siblingFiles: files.map((entry) => entry.displayPath) })) {
        useBrowserPanelStore.getState().open(sessionId, localFileUrl(getServerBaseUrl(), fileEntry.apiPath))
        return
      }
      void useWorkspacePanelStore.getState().openPreview(sessionId, fileEntry.displayPath, 'file')
      return
    }
    // Jump to the right-side workspace and open a diff tab. We pass the workDir-relative
    // path (same format the workspace file tree passes to openPreview), so the diff tab
    // is keyed/fetched identically to the tree-driven one.
    void useWorkspacePanelStore.getState().openPreview(sessionId, fileEntry.displayPath, 'diff')
  }, [sessionId, files])

  const cardLabel = isLatest
    ? t('chat.turnChangesLatestCardLabel')
    : t('chat.turnChangesHistoricalCardLabel')
  const undoAria = isLatest
    ? t('chat.turnChangesLatestUndoAria')
    : t('chat.turnChangesHistoricalUndoAria')

  const handleReview = useCallback(() => {
    const firstFile = files[0]
    if (firstFile) openChangedFile(firstFile)
  }, [files, openChangedFile])

  return (
    <section
      className="mx-auto mb-4 w-full max-w-[860px] overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-surface-glass-border)] bg-[var(--color-surface-container-low)] shadow-[var(--shadow-lg)]"
      aria-label={cardLabel}
    >
      <div className="flex min-h-[74px] items-center justify-between gap-3 border-b border-[var(--color-surface-glass-border)] px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-surface-glass-border)] bg-[var(--color-surface)] text-[var(--color-token-text-secondary)]">
            <FileDiff size={20} strokeWidth={2.2} />
          </div>
          <div className="min-w-0">
            <div className="truncate text-[16px] font-semibold leading-5 tracking-[-0.02em] text-[var(--color-token-foreground)]">
              {t('chat.turnChangesTitle', { count: files.length })}
            </div>
            <div className="mt-0.5 flex items-center gap-1.5 font-mono text-[14px] font-medium leading-5">
              <span className="text-[#2fd47e]">+{checkpoint.code.insertions}</span>
              <span className="text-[#ff5a57]">-{checkpoint.code.deletions}</span>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={onUndo}
            disabled={isUndoing}
            aria-label={undoAria}
            className="inline-flex h-8 items-center gap-1.5 rounded-[var(--radius-md)] px-2 text-[14px] font-semibold text-[var(--color-token-foreground)] transition-colors hover:bg-[var(--color-surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand)]/35 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isUndoing ? t('chat.turnChangesUndoing') : t('chat.turnChangesUndo')}
            <RotateCcw size={16} strokeWidth={2.2} />
          </button>
          <button
            type="button"
            onClick={handleReview}
            disabled={files.length === 0}
            className="inline-flex h-9 items-center rounded-[var(--radius-md)] border border-[var(--color-surface-glass-border)] bg-[var(--color-surface-container-high)] px-3 text-[14px] font-semibold text-[var(--color-token-foreground)] transition-colors hover:border-[var(--color-brand)]/35 hover:bg-[var(--color-surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand)]/35 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t('chat.turnChangesReview')}
          </button>
        </div>
      </div>

      <div className="divide-y divide-[var(--color-surface-glass-border)]">
        {visibleFiles.map((fileEntry) => (
          <button
            key={fileEntry.apiPath}
            type="button"
            onClick={() => openChangedFile(fileEntry)}
            aria-label={t('chat.turnChangesOpenInWorkspaceAria', { path: fileEntry.displayPath })}
            title={fileEntry.displayPath}
            className="flex min-h-[46px] w-full min-w-0 items-center justify-between gap-4 px-4 text-left transition-colors hover:bg-[var(--color-surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-brand)]/35"
          >
            <span className="min-w-0 flex-1 truncate text-[15px] font-normal leading-5 tracking-[-0.01em] text-[var(--color-token-foreground)]">
              {fileEntry.displayPath}
            </span>
            {fileEntry.insertions !== null || fileEntry.deletions !== null ? (
              <span className="flex shrink-0 items-baseline gap-1.5 font-mono text-[15px] font-medium leading-5">
                <span className="text-[#2fd47e]">+{fileEntry.insertions ?? 0}</span>
                <span className="text-[#ff5a57]">-{fileEntry.deletions ?? 0}</span>
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {canCollapse && (
        <button
          type="button"
          onClick={() => setShowAllFiles((current) => !current)}
          className="flex w-full items-center justify-center gap-1 border-t border-[var(--color-token-border)] px-4 py-2 text-xs text-[var(--color-token-text-secondary)] transition-colors hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-token-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-brand)]/35"
        >
          {showAllFiles ? (
            <>
              {t('chat.turnChangesShowLess')}
              <ChevronUp size={14} strokeWidth={1.9} />
            </>
          ) : (
            <>
              {t('chat.turnChangesShowMore', { count: String(files.length - COLLAPSED_COUNT) })}
              <ChevronDown size={14} strokeWidth={1.9} />
            </>
          )}
        </button>
      )}

      {error && (
        <div className="border-t border-[var(--color-error)]/20 bg-[var(--color-error-container)]/18 px-4 py-3 text-xs text-[var(--color-error)]">
          {error}
        </div>
      )}
    </section>
  )
}

export function relativizeWorkspacePath(filePath: string, workDir: string | null): string {
  const normalizedPath = filePath.replace(/\\/g, '/')
  const isAbsolute = normalizedPath.startsWith('/') || /^[a-zA-Z]:\//.test(normalizedPath)
  if (!workDir || !isAbsolute) return normalizedPath

  const normalizedWorkDir = workDir.replace(/\\/g, '/').replace(/\/+$/, '')
  const comparablePath = normalizedPath.toLowerCase()
  const comparableWorkDir = normalizedWorkDir.toLowerCase()
  if (comparablePath === comparableWorkDir) return ''
  if (comparablePath.startsWith(`${comparableWorkDir}/`)) {
    return normalizedPath.slice(normalizedWorkDir.length + 1)
  }
  return normalizedPath
}

function normalizeStatsPath(filePath: string): string {
  return filePath.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase()
}
