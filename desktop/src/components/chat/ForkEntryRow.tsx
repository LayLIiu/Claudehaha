import { useState } from 'react'
import { GitFork } from 'lucide-react'
import { useTranslation } from '../../i18n'
import { ForkPreviewModal } from './ForkPreviewModal'

type ForkEntryRowProps = {
  loading?: boolean
  disabled?: boolean
  sessionId: string
  turnIndex: number
  onForkBefore: () => void
  onForkAfter: () => void
}

export function ForkEntryRow({
  loading,
  disabled,
  sessionId,
  turnIndex,
  onForkBefore,
  onForkAfter,
}: ForkEntryRowProps) {
  const t = useTranslation()
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewTurnIndex, setPreviewTurnIndex] = useState<number>(0)
  const [confirmAction, setConfirmAction] = useState<(() => void) | null>(null)

  function handleForkBefore() {
    setPreviewTurnIndex(turnIndex - 1)
    setConfirmAction(() => onForkBefore)
    setPreviewOpen(true)
  }
  function handleForkAfter() {
    setPreviewTurnIndex(turnIndex)
    setConfirmAction(() => onForkAfter)
    setPreviewOpen(true)
  }

  if (loading) {
    return (
      <div className="flex h-7 items-center gap-2 px-2 text-[11px] text-[var(--color-token-text-secondary)]">
        <span className="material-symbols-outlined icon-sm animate-spin">progress_activity</span>
        <span>{t('chat.forkCreating')}</span>
      </div>
    )
  }

  return (
    <>
      <div className="flex items-center gap-1 opacity-0 transition-opacity duration-150 group-hover/message:pointer-events-auto group-hover/message:opacity-100 focus-within:opacity-100">
        <button
          type="button"
          onClick={handleForkBefore}
          disabled={disabled}
          aria-label={t('chat.forkBeforeTurn')}
          title={t('chat.forkBeforeTurn')}
          className="inline-flex h-[26px] items-center gap-1 rounded-[var(--radius-sm)] px-2 text-[11px] font-medium text-[var(--color-token-text-secondary)] hover:bg-[var(--color-surface-container-low)]/80 hover:text-[var(--color-token-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand)]/30 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <GitFork size={12} strokeWidth={2.2} aria-hidden="true" />
          <span>{t('chat.forkBeforeTurn')}</span>
        </button>
        <button
          type="button"
          onClick={handleForkAfter}
          disabled={disabled}
          aria-label={t('chat.forkAfterTurn')}
          title={t('chat.forkAfterTurn')}
          className="inline-flex h-[26px] items-center gap-1 rounded-[var(--radius-sm)] px-2 text-[11px] font-medium text-[var(--color-token-text-secondary)] hover:bg-[var(--color-surface-container-low)]/80 hover:text-[var(--color-token-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand)]/30 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <GitFork size={12} strokeWidth={2.2} aria-hidden="true" className="rotate-180" />
          <span>{t('chat.forkAfterTurn')}</span>
        </button>
      </div>
      {previewOpen && (
        <ForkPreviewModal
          sessionId={sessionId}
          targetTurnIndex={previewTurnIndex}
          onConfirm={() => { confirmAction?.(); setPreviewOpen(false); }}
          onCancel={() => setPreviewOpen(false)}
        />
      )}
    </>
  )
}
