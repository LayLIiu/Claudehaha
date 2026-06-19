import { useCLITaskStore } from '../../stores/cliTaskStore'
import { useTranslation } from '../../i18n'
import type { CLITask } from '../../types/cliTask'
import { ClipboardList, Plus } from 'lucide-react'

const statusConfig = {
  pending: {
    icon: 'radio_button_unchecked',
    color: 'var(--color-text-tertiary)',
    label: 'pending',
  },
  in_progress: {
    icon: 'pending',
    color: 'var(--color-warning)',
    label: 'active',
  },
  completed: {
    icon: 'check_circle',
    color: 'var(--color-success)',
    label: 'done',
  },
} as const

export function SessionTaskBar({
  variant = 'dock',
}: {
  variant?: 'dock' | 'popover'
}) {
  const {
    tasks,
    completedAndDismissed,
    resetCompletedTasks,
    taskBarOpen,
    tasksExplicitlySet,
  } = useCLITaskStore()
  const t = useTranslation()

  // Only show when: manually toggled open, or AI explicitly created tasks
  const hasTasks = tasks.length > 0
  const shouldShow = taskBarOpen || tasksExplicitlySet
  if (!shouldShow) return null
  if (!taskBarOpen && !hasTasks) return null

  // Don't show sticky bar if tasks were completed and the user already continued chatting
  const allCompleted = hasTasks && tasks.every((tk) => tk.status === 'completed')
  if (!taskBarOpen && allCompleted && completedAndDismissed) return null

  const completedCount = tasks.filter((tk) => tk.status === 'completed').length
  const totalCount = tasks.length
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0
  const isPopover = variant === 'popover'

  return (
    <div className={isPopover ? 'absolute right-0 top-[calc(100%+10px)] z-[330] w-[min(420px,calc(100vw-48px))]' : 'shrink-0 px-8'}>
      <div className={isPopover
        ? 'overflow-hidden rounded-[26px] border border-[rgba(255,255,255,0.1)] bg-[rgba(44,44,46,0.92)] shadow-[0_24px_80px_rgba(0,0,0,0.42)] backdrop-blur-[22px]'
        : 'glass-panel mx-auto mb-2 max-w-[860px] overflow-hidden rounded-[16px] transition-colors'}
      >
        <div className={isPopover ? 'px-5 pb-4 pt-5' : 'px-4 pb-2 pt-3'}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className={isPopover ? 'text-[14px] font-semibold text-[var(--color-text-secondary)]' : 'text-[12px] font-semibold text-[var(--color-text-secondary)]'}>
                {t('tasks.title')}
              </div>
              {hasTasks ? (
                <div className="mt-2 flex items-center gap-2">
                  <div className="h-1.5 w-24 overflow-hidden rounded-full bg-[rgba(255,255,255,0.08)]">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${progressPercent}%`,
                        backgroundColor: completedCount === totalCount
                          ? 'var(--color-success)'
                          : 'rgba(255,255,255,0.78)',
                      }}
                    />
                  </div>
                  <span className="text-[11px] tabular-nums text-[var(--color-text-tertiary)]">
                    {completedCount}/{totalCount}
                  </span>
                </div>
              ) : null}
            </div>

            <div className="flex items-center gap-1">
              {isPopover ? (
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-[12px] text-[var(--color-text-tertiary)]">
                  <Plus size={18} />
                </span>
              ) : null}
              {allCompleted && (
                <button
                  type="button"
                  aria-label={t('tasks.dismissCompleted')}
                  onClick={() => { void resetCompletedTasks() }}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[12px] text-[var(--color-text-tertiary)] transition-colors hover:bg-[var(--color-surface-container-low)] hover:text-[var(--color-text-primary)]"
                >
                  <span className="material-symbols-outlined text-[16px]">close</span>
                </button>
              )}
            </div>
          </div>

          <div className={isPopover ? 'mt-4 space-y-1.5' : 'mt-3 space-y-1'}>
            {hasTasks ? (
              tasks.map((task) => (
                <TaskItem key={task.id} task={task} compact={!isPopover} />
              ))
            ) : (
              <div className={isPopover
                ? 'rounded-[16px] border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] px-3 py-3 text-[12px] text-[var(--color-text-tertiary)]'
                : 'flex items-center justify-center py-4 text-[11px] text-[var(--color-text-tertiary)]'}
              >
                {t('tasks.empty')}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function TaskItem({ task, compact = false }: { task: CLITask; compact?: boolean }) {
  const config = statusConfig[task.status]

  return (
    <div className={compact
      ? 'flex items-start gap-2 rounded-[10px] px-1 py-1.5'
      : 'flex items-start gap-3 rounded-[14px] px-3 py-2.5 transition-colors hover:bg-[rgba(255,255,255,0.03)]'}
    >
      <span className={compact
        ? 'material-symbols-outlined mt-px shrink-0 text-[16px]'
        : 'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[12px] bg-[rgba(255,255,255,0.04)] text-[var(--color-text-secondary)]'}
        style={compact ? { color: config.color, fontVariationSettings: "'FILL' 1" } : undefined}
      >
        {compact ? config.icon : <ClipboardList size={16} strokeWidth={1.9} />}
      </span>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-[var(--color-text-tertiary)]">
            #{task.id}
          </span>
          <span className={`${compact ? 'text-xs' : 'text-[15px]'} ${
            task.status === 'completed'
              ? 'text-[var(--color-text-tertiary)] line-through'
              : 'text-[var(--color-text-primary)]'
          }`}>
            {task.subject}
          </span>
        </div>

        {task.status === 'in_progress' && task.activeForm && (
          <div className="mt-1 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-warning)] animate-pulse" />
            <span className={`${compact ? 'text-[10px]' : 'text-[12px]'} text-[var(--color-warning)]`}>
              {task.activeForm}
            </span>
          </div>
        )}

        {task.owner && (
          <span className={`${compact ? 'text-[10px]' : 'text-[11px]'} mt-1 inline-flex items-center gap-0.5 text-[var(--color-text-tertiary)]`}>
            <span className="material-symbols-outlined text-[10px]">person</span>
            {task.owner}
          </span>
        )}
      </div>
    </div>
  )
}
