import { useCLITaskStore } from '../../stores/cliTaskStore'
import { useTranslation } from '../../i18n'
import type { CLITask } from '../../types/cliTask'
import { ClipboardList } from 'lucide-react'

const statusConfig = {
  pending: {
    icon: 'radio_button_unchecked',
    color: 'var(--color-token-text-secondary)',
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
    <div className={isPopover ? 'absolute right-0 top-[calc(100%+6px)] z-[330] w-[min(280px,calc(100vw-48px))]' : 'shrink-0 px-8'}>
      <div className={isPopover
        ? 'glass-panel overflow-hidden rounded-[var(--radius-lg)] shadow-[var(--shadow-dropdown)]'
        : 'glass-panel mx-auto mb-2 max-w-[860px] overflow-hidden rounded-[var(--radius-xl)] transition-colors'}
      >
        <div className={isPopover ? 'px-2.5 py-2' : 'px-4 pb-2 pt-3'}>
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className={isPopover ? 'text-[11px] font-semibold text-[var(--color-token-text-secondary)]' : 'text-[12px] font-semibold text-[var(--color-token-text-secondary)]'}>
                {t('tasks.title')}
              </div>
              {hasTasks ? (
                <div className="mt-1 flex items-center gap-1.5">
                  <div className="h-0.5 w-14 overflow-hidden rounded-full bg-[rgba(255,255,255,0.08)]">
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
                  <span className="text-[9px] tabular-nums text-[var(--color-token-text-secondary)]">
                    {completedCount}/{totalCount}
                  </span>
                </div>
              ) : null}
            </div>

            <div className="flex items-center gap-0.5">
              {allCompleted && (
                <button
                  type="button"
                  aria-label={t('tasks.dismissCompleted')}
                  onClick={() => { void resetCompletedTasks() }}
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-[var(--radius-2xs)] text-[var(--color-token-text-secondary)] transition-colors hover:bg-[var(--color-surface-container-low)] hover:text-[var(--color-token-foreground)]"
                >
                  <span className="material-symbols-outlined icon-2xs">close</span>
                </button>
              )}
            </div>
          </div>

          <div className={isPopover ? 'mt-1.5 space-y-px' : 'mt-3 space-y-1'}>
            {hasTasks ? (
              tasks.map((task) => (
                <TaskItem key={task.id} task={task} compact />
              ))
            ) : (
              <div className={isPopover
                ? 'rounded-[var(--radius-xs)] bg-[rgba(255,255,255,0.02)] px-2 py-1.5 text-[10px] text-[var(--color-token-text-secondary)]'
                : 'flex items-center justify-center py-4 text-[11px] text-[var(--color-token-text-secondary)]'}
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
      ? 'flex items-center gap-1.5 rounded-[var(--radius-xs)] px-1 py-1'
      : 'flex items-start gap-3 rounded-[var(--radius-xl)] px-3 py-2.5 transition-colors hover:bg-[rgba(255,255,255,0.03)]'}
    >
      <span className={compact
        ? 'material-symbols-outlined shrink-0 text-[13px]'
        : 'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-lg)] bg-[rgba(255,255,255,0.04)] text-[var(--color-token-text-secondary)]'}
        style={compact ? { color: config.color, fontVariationSettings: "'FILL' 1" } : undefined}
      >
        {compact ? config.icon : <ClipboardList size={16} strokeWidth={1.9} />}
      </span>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] font-mono text-[var(--color-token-text-secondary)]">
            #{task.id}
          </span>
          <span className={`${compact ? 'text-[11px]' : 'text-[15px]'} ${
            task.status === 'completed'
              ? 'text-[var(--color-token-text-secondary)] line-through'
              : 'text-[var(--color-token-foreground)]'
          }`}>
            {task.subject}
          </span>
        </div>

        {task.status === 'in_progress' && task.activeForm && (
          <div className="mt-0.5 flex items-center gap-1">
            <span className="w-1 h-1 rounded-full bg-[var(--color-warning)] animate-pulse" />
            <span className={`${compact ? 'text-[9px]' : 'text-[12px]'} text-[var(--color-warning)]`}>
              {task.activeForm}
            </span>
          </div>
        )}

        {task.owner && (
          <span className={`${compact ? 'text-[9px]' : 'text-[11px]'} mt-0.5 inline-flex items-center gap-0.5 text-[var(--color-token-text-secondary)]`}>
            <span className="material-symbols-outlined text-[9px]">person</span>
            {task.owner}
          </span>
        )}
      </div>
    </div>
  )
}
