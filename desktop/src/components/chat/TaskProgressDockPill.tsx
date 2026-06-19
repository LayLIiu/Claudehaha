import { useEffect, useMemo, useRef, useState } from 'react'
import { RollingDiffStats } from './RollingDiffStats'
import { SessionTaskBar } from './SessionTaskBar'
import { CurrentTurnLiveChangePill } from './CurrentTurnLiveChangePill'
import { useCLITaskStore } from '../../stores/cliTaskStore'
import type { LiveTurnChangeSummary } from './turnLiveChangeSummary'
import type { CLITask } from '../../types/cliTask'

export function TaskProgressDockPill({
  changeSummary,
  compact = false,
  onOpenChanges,
}: {
  changeSummary: LiveTurnChangeSummary | null
  compact?: boolean
  onOpenChanges?: () => void
}) {
  const { tasks, completedAndDismissed, taskBarOpen, tasksExplicitlySet } = useCLITaskStore()
  const [taskListOpen, setTaskListOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  const taskSummary = useMemo(() => buildTaskSummary(tasks), [tasks])
  const hasChanges = Boolean(changeSummary && changeSummary.fileCount > 0)
  const hasTasks = tasks.length > 0
  const allCompleted = hasTasks && tasks.every((task) => task.status === 'completed')
  const shouldShowTasks = (taskBarOpen || tasksExplicitlySet) &&
    (taskBarOpen || hasTasks) &&
    !(allCompleted && completedAndDismissed && !taskBarOpen)

  useEffect(() => {
    if (!taskListOpen) return

    const handlePointerDown = (event: MouseEvent) => {
      if (rootRef.current?.contains(event.target as Node)) return
      setTaskListOpen(false)
    }

    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [taskListOpen])

  useEffect(() => {
    if (!shouldShowTasks) {
      setTaskListOpen(false)
    }
  }, [shouldShowTasks])

  if (!shouldShowTasks) {
    return (
      <CurrentTurnLiveChangePill
        summary={changeSummary}
        compact={compact}
        onOpenChanges={onOpenChanges}
      />
    )
  }

  return (
    <div
      ref={rootRef}
      className="task-progress-dock-wrap"
      aria-live="polite"
    >
      {taskListOpen ? <SessionTaskBar variant="popover" placement="above" /> : null}
      <div
        className={`task-progress-dock-pill ${hasChanges ? 'task-progress-dock-pill--merged' : ''} ${compact ? 'task-progress-dock-pill--compact' : ''}`}
        data-testid="task-progress-dock-pill"
      >
        <button
          type="button"
          className="task-progress-dock-pill__task"
          onClick={() => setTaskListOpen((open) => !open)}
          aria-expanded={taskListOpen}
          aria-label="查看任务列表"
          title="查看任务列表"
        >
          <TaskProgressIcon status={taskSummary.status} />
          <span className="task-progress-dock-pill__label">{taskSummary.label}</span>
        </button>

        {hasChanges && changeSummary ? (
          <button
            type="button"
            className="task-progress-dock-pill__changes"
            data-testid="task-progress-change-segment"
            onClick={(event) => {
              event.stopPropagation()
              onOpenChanges?.()
            }}
            aria-label={`查看本轮 ${changeSummary.fileCount} 个文件变更`}
            title="查看本轮文件变更"
          >
            <span className="task-progress-dock-pill__change-label">
              {changeSummary.fileCount} 个文件已更改
            </span>
            <RollingDiffStats stats={changeSummary} variant="inline" className="text-[14px] font-semibold leading-5" />
          </button>
        ) : null}
      </div>
    </div>
  )
}

function buildTaskSummary(tasks: CLITask[]) {
  const total = tasks.length
  const completed = tasks.filter((task) => task.status === 'completed').length
  const activeIndex = tasks.findIndex((task) => task.status === 'in_progress')

  if (total === 0) {
    return {
      label: '暂无任务',
      status: 'pending' as const,
    }
  }

  if (completed === total) {
    return {
      label: `已完成 ${total} / ${total} 步`,
      status: 'completed' as const,
    }
  }

  const currentStep = activeIndex >= 0 ? activeIndex + 1 : Math.min(completed + 1, total)
  return {
    label: `第 ${currentStep} / ${total} 步`,
    status: activeIndex >= 0 ? 'in_progress' as const : 'pending' as const,
  }
}

function TaskProgressIcon({ status }: { status: 'pending' | 'in_progress' | 'completed' }) {
  if (status === 'completed') {
    return <span className="material-symbols-outlined task-progress-dock-pill__icon task-progress-dock-pill__icon--done">check_circle</span>
  }

  if (status === 'in_progress') {
    return <span className="material-symbols-outlined task-progress-dock-pill__icon task-progress-dock-pill__icon--running">progress_activity</span>
  }

  return <span className="material-symbols-outlined task-progress-dock-pill__icon">radio_button_unchecked</span>
}
