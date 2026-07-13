/**
 * HistoryStatePill — 历史状态标记
 *
 * 参考 ZCode 的 assistantHistoryDisplay：在 fork/rewind 后显示 "Viewing turn X" pill，
 * 点击可跳转回原始 turn。
 */
import { GitBranch, RotateCcw } from 'lucide-react'
import { useTranslation } from '../../i18n'

type HistoryStatePillProps = {
  turnIndex: number
  onJumpToParent: () => void
}

export function HistoryStatePill({ turnIndex, onJumpToParent }: HistoryStatePillProps) {
  const t = useTranslation()
  return (
    <div className="inline-flex h-8 items-center gap-2 rounded-full border border-[var(--color-token-border)] bg-[var(--color-surface)] px-3 text-[12px] text-[var(--color-token-text-secondary)]">
      <GitBranch size={13} className="text-[var(--color-brand)]" />
      <span>{t('chat.viewingTurn', { turn: String(turnIndex) })}</span>
      <button
        type="button"
        onClick={onJumpToParent}
        className="inline-flex items-center gap-1 rounded-[var(--radius-sm)] px-1.5 text-[11px] font-medium text-[var(--color-token-foreground)] transition-colors hover:bg-[var(--color-surface-hover)]"
      >
        <RotateCcw size={11} />
        <span>{t('chat.jumpBack')}</span>
      </button>
    </div>
  )
}
