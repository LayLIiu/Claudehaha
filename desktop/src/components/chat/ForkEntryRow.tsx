/**
 * ForkEntryRow — 行内「在此轮前/后分支」入口
 *
 * 参考 ZCode 的 inline fork selector：在每条 assistant 消息下方，
 * 轻量级横向按钮，hover 或 focus 时出现。
 * 与现有 branchAction 理念一致，但更显眼、支持 before/after 两种 fork。
 */
import { GitFork } from 'lucide-react'
import { useTranslation } from '../../i18n'

type ForkEntryRowProps = {
  loading?: boolean
  disabled?: boolean
  onForkBefore: () => void
  onForkAfter: () => void
}

export function ForkEntryRow({ loading, disabled, onForkBefore, onForkAfter }: ForkEntryRowProps) {
  const t = useTranslation()
  if (loading) {
    return (
      <div className="flex h-7 items-center gap-2 px-2 text-[11px] text-[var(--color-token-text-secondary)]">
        <span className="material-symbols-outlined icon-sm animate-spin">progress_activity</span>
        <span>{t('chat.forkCreating')}</span>
      </div>
    )
  }
  return (
    <div
      data-testid="fork-entry-row"
      className="flex items-center gap-1 opacity-0 transition-opacity duration-150 group-hover/message:pointer-events-auto group-hover/message:opacity-100 focus-within:opacity-100"
    >
      <button
        type="button"
        onClick={onForkBefore}
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
        onClick={onForkAfter}
        disabled={disabled}
        aria-label={t('chat.forkAfterTurn')}
        title={t('chat.forkAfterTurn')}
        className="inline-flex h-[26px] items-center gap-1 rounded-[var(--radius-sm)] px-2 text-[11px] font-medium text-[var(--color-token-text-secondary)] hover:bg-[var(--color-surface-container-low)]/80 hover:text-[var(--color-token-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand)]/30 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <GitFork size={12} strokeWidth={2.2} aria-hidden="true" className="rotate-180" />
        <span>{t('chat.forkAfterTurn')}</span>
      </button>
    </div>
  )
}
