/**
 * ActiveGoalStrip — 活跃目标指示条
 *
 * 从 ActiveSession 中提取，对应官方 Codex 的 goal-strip 组件。
 * 显示当前活跃的 goal 状态：运行中/暂停/活跃。
 */

import { Target } from 'lucide-react'
import { useTranslation } from '../../i18n'
import type { ActiveGoalState } from '../../types/chat'

export function ActiveGoalStrip({
  goal,
  isRunning,
  compact,
}: {
  goal: ActiveGoalState | null | undefined
  isRunning: boolean
  compact: boolean
}) {
  const t = useTranslation()
  if (!goal || goal.action === 'completed') return null

  const objective = goal.objective ?? goal.message
  if (!objective) return null

  const statusLabel = isRunning
    ? t('chat.activeGoal.running')
    : goal.status === 'paused'
      ? t('chat.activeGoal.paused')
      : t('chat.activeGoal.active')
  const meta = [
    goal.budget ? t('chat.activeGoal.budget', { value: goal.budget }) : null,
    goal.elapsed ? t('chat.activeGoal.elapsed', { value: goal.elapsed }) : null,
    goal.continuations ? t('chat.activeGoal.continuations', { value: goal.continuations }) : null,
  ].filter((value): value is string => value !== null)

  return (
    <div
      data-testid="active-goal-strip"
      className={[
        'mt-2 flex max-w-full items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--color-memory-border)] bg-[var(--color-memory-surface)] px-2.5 py-1.5',
        compact ? 'text-[11px]' : 'text-[12px]',
      ].join(' ')}
    >
      <Target size={compact ? 13 : 14} className="shrink-0 text-[var(--color-memory-accent)]" strokeWidth={2.25} aria-hidden="true" />
      <span className="shrink-0 font-semibold text-[var(--color-token-foreground)]">
        {t('chat.activeGoal.title')}
      </span>
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-memory-accent)]" aria-hidden="true" />
      <span className="shrink-0 text-[var(--color-token-text-secondary)]">{statusLabel}</span>
      <span className="min-w-0 flex-1 truncate font-medium text-[var(--color-token-foreground)]" title={objective}>
        {objective}
      </span>
      {meta.length > 0 ? (
        <span className="hidden shrink-0 items-center gap-1.5 text-[11px] text-[var(--color-token-text-secondary)] lg:flex">
          {meta.map((item) => (
            <span key={item} className="max-w-[140px] truncate">{item}</span>
          ))}
        </span>
      ) : null}
    </div>
  )
}
