/**
 * ForkPreviewModal — Fork 预览弹窗
 *
 * 参考 ZCode 的两步 fork：先预览目标 turn 的文件变更，确认后再创建分支。
 * 展示 rewind 预览结果：files changed, insertions/deletions。
 */
import { useEffect, useState } from 'react'
import { GitBranch, FileDiff, Loader2, AlertTriangle } from 'lucide-react'
import { sessionsApi } from '../../api/sessions'
import { useTranslation } from '../../i18n'
import type { SessionRewindResponse } from '../../api/sessions'

type ForkPreviewModalProps = {
  sessionId: string
  targetTurnIndex: number
  onConfirm: () => void
  onCancel: () => void
}

export function ForkPreviewModal({
  sessionId,
  targetTurnIndex,
  onConfirm,
  onCancel,
}: ForkPreviewModalProps) {
  const t = useTranslation()
  const [preview, setPreview] = useState<SessionRewindResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    sessionsApi
      .rewind(sessionId, { userMessageIndex: targetTurnIndex, dryRun: true })
      .then((res: any) => {
        setPreview(res.data || res)
        setLoading(false)
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Preview unavailable')
        setLoading(false)
      })
  }, [sessionId, targetTurnIndex])

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center">
      <div className="absolute inset-0 bg-[var(--color-overlay-scrim)]" onClick={onCancel} />
      <div className="liquid-glass glass-panel relative w-[min(480px,calc(100vw-48px))] rounded-[var(--radius-2xl)] p-6 shadow-[var(--shadow-xl)]">
        <div className="flex items-center gap-3">
          <GitBranch size={20} className="text-[var(--color-brand)]" />
          <h2 className="text-[16px] font-semibold text-[var(--color-token-foreground)]">
            Fork Preview
          </h2>
        </div>

        {loading && (
          <div className="flex items-center gap-2 py-8 text-[13px] text-[var(--color-token-text-secondary)]">
            <Loader2 size={16} className="animate-spin" />
            <span>Loading preview…</span>
          </div>
        )}

        {error && (
          <div className="mt-4 flex items-center gap-2 text-[13px] text-[var(--color-error)]">
            <AlertTriangle size={14} />
            <span>{error}</span>
          </div>
        )}

        {preview && (
          <div className="mt-4 space-y-3">
            <div className="flex items-center gap-2 text-[13px] text-[var(--color-token-foreground)]">
              <FileDiff size={14} />
              <span>
                {String(preview.code?.filesChanged?.length ?? 0)} files changed, +{String(preview.code?.insertions ?? 0)}/-{String(preview.code?.deletions ?? 0)}
              </span>
            </div>
            {preview.code?.fileStats && preview.code.fileStats.length > 0 && (
              <div className="rounded-[var(--radius-md)] border border-[var(--color-warning)]/30 bg-[var(--color-warning)]/10 px-3 py-2 text-[12px] text-[var(--color-warning)]">
                {String(preview.code?.filesChanged?.length ?? 0)} files changed, +{String(preview.code?.insertions ?? 0)}/-{String(preview.code?.deletions ?? 0)}
              </div>
            )}
          </div>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex h-9 items-center rounded-[var(--radius-sm)] border border-[var(--color-token-border)] px-4 text-[13px] text-[var(--color-token-foreground)] transition-colors hover:bg-[var(--color-surface-hover)]"
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading || !!error}
            className="inline-flex h-9 items-center rounded-[var(--radius-sm)] bg-[var(--color-brand)] px-4 text-[13px] font-semibold text-white transition-colors hover:opacity-90 disabled:opacity-50"
          >
            Fork
          </button>
        </div>
      </div>
    </div>
  )
}
