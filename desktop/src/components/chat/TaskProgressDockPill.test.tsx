import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { TaskProgressDockPill } from './TaskProgressDockPill'
import { useCLITaskStore } from '../../stores/cliTaskStore'

vi.mock('../../api/cliTasks', () => ({
  cliTasksApi: {
    getTasksForList: vi.fn(),
    resetTaskList: vi.fn(async () => ({ ok: true })),
  },
}))

vi.mock('../../i18n', () => ({
  useTranslation: () => (key: string) => {
    const translations: Record<string, string> = {
      'tasks.title': '任务',
      'tasks.dismissCompleted': '隐藏已完成任务',
      'tasks.empty': '暂无任务',
    }

    return translations[key] ?? key
  },
}))

describe('TaskProgressDockPill', () => {
  beforeEach(() => {
    useCLITaskStore.setState({
      sessionId: 'session-1',
      tasks: [],
      taskBarOpen: false,
      tasksExplicitlySet: false,
      completedAndDismissed: false,
      dismissedCompletionKey: null,
      resetting: false,
      expanded: false,
    })
  })

  afterEach(() => {
    cleanup()
    useCLITaskStore.getState().clearTasks()
  })

  it('falls back to the change pill when there are no visible tasks', () => {
    render(
      <TaskProgressDockPill
        changeSummary={{ fileCount: 1, additions: 38, deletions: 15 }}
      />,
    )

    expect(screen.getByTestId('current-turn-live-change-pill')).toHaveTextContent('1 个文件已更改')
    expect(screen.queryByTestId('task-progress-dock-pill')).toBeNull()
  })

  it('shows the current task step and opens the task list', () => {
    act(() => {
      useCLITaskStore.getState().setTasksFromTodos([
        { content: '已完成的 Token/组件拆分工作', status: 'completed' },
        { content: 'Sidebar 底部增加 Account/Theme 按钮', status: 'in_progress', activeForm: '正在调整底部按钮' },
        { content: 'Sidebar nav items 增加快捷键提示', status: 'pending' },
      ])
    })

    render(<TaskProgressDockPill changeSummary={null} />)

    const pill = screen.getByTestId('task-progress-dock-pill')
    expect(pill).toHaveTextContent('第 2 / 3 步')
    expect(screen.queryByText('Sidebar 底部增加 Account/Theme 按钮')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: '查看任务列表' }))

    expect(screen.getByText('任务')).toBeInTheDocument()
    expect(screen.getByText('Sidebar 底部增加 Account/Theme 按钮')).toBeInTheDocument()
  })

  it('merges task progress with live changes and keeps the change segment clickable', () => {
    const onOpenChanges = vi.fn()
    act(() => {
      useCLITaskStore.getState().setTasksFromTodos([
        { content: 'first', status: 'completed' },
        { content: 'second', status: 'in_progress' },
      ])
    })

    render(
      <TaskProgressDockPill
        changeSummary={{ fileCount: 2, additions: 38, deletions: 15 }}
        onOpenChanges={onOpenChanges}
      />,
    )

    const pill = screen.getByTestId('task-progress-dock-pill')
    expect(pill).toHaveTextContent('第 2 / 2 步')
    expect(pill).toHaveTextContent('2 个文件已更改')

    fireEvent.click(screen.getByTestId('task-progress-change-segment'))

    expect(onOpenChanges).toHaveBeenCalledTimes(1)
    expect(screen.queryByText('任务')).toBeNull()
  })
})
