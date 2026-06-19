import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import '@testing-library/jest-dom'

vi.mock('../../i18n', () => ({
  useTranslation: () => (key: string, params?: Record<string, string | number>) => {
    const template = {
      'openProject.openIn': 'Open in {target}',
      'openProject.openProject': 'Open project',
      'openProject.openFailed': 'Could not open project',
    }[key] ?? key

    if (!params) return template
    return Object.entries(params).reduce(
      (text, [name, value]) => text.replaceAll(`{${name}}`, String(value)),
      template,
    )
  },
}))

const storeMocks = vi.hoisted(() => ({
  ensureTargets: vi.fn(),
  openTarget: vi.fn(),
  loadStatus: vi.fn(),
  openPanel: vi.fn(),
  setMode: vi.fn(),
  setActiveView: vi.fn(),
  resetCompletedTasks: vi.fn(),
  getRepositoryContext: vi.fn(),
  gitLog: vi.fn(),
  state: {
    targets: [] as Array<{
      id: string
      kind: 'ide' | 'file_manager'
      label: string
      icon: string
      iconUrl?: string
      platform: string
    }>,
    primaryTargetId: null as string | null,
    loading: false,
    error: null as string | null,
  },
  workspaceState: {
    statusBySession: {} as Record<string, {
      branch: string | null
      changedFiles: Array<{ path: string; status: string; additions: number; deletions: number }>
    }>,
  },
  taskState: {
    tasks: [] as Array<{ id: string; subject: string; status: 'pending' | 'in_progress' | 'completed'; activeForm?: string }>,
  },
}))

vi.mock('../../stores/openTargetStore', () => ({
  useOpenTargetStore: (
    selector: (state: typeof storeMocks.state & {
      ensureTargets: typeof storeMocks.ensureTargets
      openTarget: typeof storeMocks.openTarget
    }) => unknown,
  ) => selector({
    ...storeMocks.state,
    ensureTargets: storeMocks.ensureTargets,
    openTarget: storeMocks.openTarget,
  }),
}))

vi.mock('../../stores/workspacePanelStore', () => ({
  useWorkspacePanelStore: (
    selector: (state: typeof storeMocks.workspaceState & {
      loadStatus: typeof storeMocks.loadStatus
      openPanel: typeof storeMocks.openPanel
      setMode: typeof storeMocks.setMode
      setActiveView: typeof storeMocks.setActiveView
    }) => unknown,
  ) => selector({
    ...storeMocks.workspaceState,
    loadStatus: storeMocks.loadStatus,
    openPanel: storeMocks.openPanel,
    setMode: storeMocks.setMode,
    setActiveView: storeMocks.setActiveView,
  }),
}))

vi.mock('../../stores/cliTaskStore', () => ({
  useCLITaskStore: (
    selector: (state: typeof storeMocks.taskState & {
      resetCompletedTasks: typeof storeMocks.resetCompletedTasks
    }) => unknown,
  ) => selector({
    ...storeMocks.taskState,
    resetCompletedTasks: storeMocks.resetCompletedTasks,
  }),
}))

vi.mock('../../hooks/useGlassPanelAnimation', () => ({
  useGlassPanelAnimation: (onClosed: () => void) => ({
    animatingOut: false,
    requestClose: onClosed,
  }),
}))

vi.mock('../../api/sessions', () => ({
  sessionsApi: {
    getRepositoryContext: storeMocks.getRepositoryContext,
    gitLog: storeMocks.gitLog,
    gitSyncStatus: vi.fn(),
    gitCommit: vi.fn(),
    gitPush: vi.fn(),
    gitCreateBranch: vi.fn(),
  },
}))

import { OpenProjectMenu } from './OpenProjectMenu'

describe('OpenProjectMenu', () => {
  beforeEach(() => {
    storeMocks.ensureTargets.mockReset()
    storeMocks.openTarget.mockReset()
    storeMocks.loadStatus.mockReset()
    storeMocks.openPanel.mockReset()
    storeMocks.setMode.mockReset()
    storeMocks.setActiveView.mockReset()
    storeMocks.resetCompletedTasks.mockReset()
    storeMocks.getRepositoryContext.mockReset()
    storeMocks.gitLog.mockReset()
    storeMocks.state = {
      targets: [],
      primaryTargetId: null,
      loading: false,
      error: null,
    }
    storeMocks.workspaceState = {
      statusBySession: {},
    }
    storeMocks.taskState = {
      tasks: [],
    }
  })

  it('renders a single Finder action when only file manager is detected', async () => {
    storeMocks.state.targets = [{ id: 'finder', kind: 'file_manager', label: 'Finder', icon: 'finder', platform: 'darwin' }]
    storeMocks.state.primaryTargetId = 'finder'
    storeMocks.openTarget.mockResolvedValue(undefined)

    render(<OpenProjectMenu path="/repo" />)

    await waitFor(() => expect(storeMocks.ensureTargets).toHaveBeenCalled())
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Open in Finder' }))
    })

    expect(storeMocks.openTarget).toHaveBeenCalledWith('finder', '/repo')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('renders a dropdown with detected IDEs and Finder', async () => {
    storeMocks.state.targets = [
      { id: 'vscode', kind: 'ide', label: 'VS Code', icon: 'vscode', iconUrl: '/api/open-targets/icons/vscode', platform: 'darwin' },
      { id: 'finder', kind: 'file_manager', label: 'Finder', icon: 'finder', iconUrl: '/api/open-targets/icons/finder', platform: 'darwin' },
    ]
    storeMocks.state.primaryTargetId = 'vscode'
    storeMocks.openTarget.mockResolvedValue(undefined)

    const { container } = render(<OpenProjectMenu path="/repo" />)

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Open project' }))
    })
    expect(screen.getByRole('menu')).toBeInTheDocument()
    expect([
      ...Array.from(container.querySelectorAll('img')),
      ...Array.from(document.body.querySelectorAll('[role="menu"] img')),
    ].map((img) => img.getAttribute('src'))).toContain('/api/open-targets/icons/vscode')
    await act(async () => {
      fireEvent.click(screen.getByRole('menuitem', { name: 'Finder' }))
    })

    expect(storeMocks.openTarget).toHaveBeenCalledWith('finder', '/repo')
  })

  it('can restrict the titlebar dropdown to Finder, Terminal, and Xcode', async () => {
    storeMocks.state.targets = [
      { id: 'vscode', kind: 'ide', label: 'VS Code', icon: 'vscode', platform: 'darwin' },
      { id: 'terminal', kind: 'ide', label: 'Terminal', icon: 'terminal', platform: 'darwin' },
      { id: 'xcode', kind: 'ide', label: 'Xcode', icon: 'xcode', platform: 'darwin' },
      { id: 'finder', kind: 'file_manager', label: 'Finder', icon: 'finder', platform: 'darwin' },
    ]
    storeMocks.state.primaryTargetId = 'vscode'
    storeMocks.openTarget.mockResolvedValue(undefined)

    render(
      <OpenProjectMenu
        path="/repo"
        simpleTargetIds={['finder', 'terminal', 'xcode']}
      />,
    )

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Open project' }))
    })

    const menuItems = screen.getAllByRole('menuitem').map((item) => item.textContent)
    expect(menuItems).toEqual(['Finder', 'Terminal', 'Xcode'])
    expect(screen.queryByRole('menuitem', { name: 'VS Code' })).not.toBeInTheDocument()
  })

  it('still shows the full titlebar menu when only Finder is detected', async () => {
    storeMocks.state.targets = [
      { id: 'finder', kind: 'file_manager', label: 'Finder', icon: 'finder', platform: 'darwin' },
    ]
    storeMocks.state.primaryTargetId = 'finder'

    render(
      <OpenProjectMenu
        path="/repo"
        simpleTargetIds={['finder', 'terminal', 'xcode']}
      />,
    )

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Open project' }))
    })

    expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual([
      'Finder',
      'Terminal',
      'Xcode',
    ])
  })

  it('uses the last selected fixed menu target for the left direct-open action', async () => {
    storeMocks.state.targets = [
      { id: 'finder', kind: 'file_manager', label: 'Finder', icon: 'finder', platform: 'darwin' },
      { id: 'terminal', kind: 'ide', label: 'Terminal', icon: 'terminal', platform: 'darwin' },
      { id: 'xcode', kind: 'ide', label: 'Xcode', icon: 'xcode', platform: 'darwin' },
    ]
    storeMocks.state.primaryTargetId = 'xcode'
    storeMocks.openTarget.mockResolvedValue(undefined)

    render(
      <OpenProjectMenu
        path="/repo"
        simpleTargetIds={['finder', 'terminal', 'xcode']}
      />,
    )

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Open in Xcode' }))
    })

    expect(storeMocks.openTarget).toHaveBeenCalledWith('xcode', '/repo')
  })

  it('does not render without a path', () => {
    const { container } = render(<OpenProjectMenu path={null} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders the environment Git card and opens changed files from the change row', async () => {
    storeMocks.state.targets = [{ id: 'finder', kind: 'file_manager', label: 'Finder', icon: 'finder', platform: 'darwin' }]
    storeMocks.state.primaryTargetId = 'finder'
    storeMocks.workspaceState.statusBySession = {
      session_1: {
        branch: 'main',
        changedFiles: [
          { path: 'src/app.ts', status: 'modified', additions: 2, deletions: 2 },
        ],
      },
    }
    storeMocks.taskState.tasks = [
      { id: '1', subject: '读取上下文', status: 'completed' },
      { id: '2', subject: '调整面板', status: 'in_progress', activeForm: '修改中' },
    ]
    storeMocks.getRepositoryContext.mockResolvedValue({
      state: 'ok',
      workDir: '/repo',
      repoRoot: '/repo',
      repoName: 'repo',
      currentBranch: 'main',
      defaultBranch: 'main',
      dirty: true,
      branches: [{ name: 'main', current: true, local: true, remote: true, checkedOut: true }],
      worktrees: [],
    })

    render(<OpenProjectMenu path="/repo" sessionId="session_1" variant="environment" externalOpen />)

    expect(await screen.findByRole('dialog', { name: 'Git 工具' })).toBeInTheDocument()
    expect(screen.getByText('更改')).toBeInTheDocument()
    expect(screen.getByText('+2 -2')).toBeInTheDocument()
    expect(screen.getByText('main')).toBeInTheDocument()
    expect(screen.getByText('进程 1/2')).toBeInTheDocument()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /更改/ }))
    })

    expect(storeMocks.setMode).toHaveBeenCalledWith('session_1', 'workspace')
    expect(storeMocks.setActiveView).toHaveBeenCalledWith('session_1', 'changed')
    expect(storeMocks.openPanel).toHaveBeenCalledWith('session_1')
    expect(storeMocks.loadStatus).toHaveBeenCalledWith('session_1')
  })

  it('loads and renders the Git graph from the environment panel', async () => {
    storeMocks.state.targets = [{ id: 'finder', kind: 'file_manager', label: 'Finder', icon: 'finder', platform: 'darwin' }]
    storeMocks.state.primaryTargetId = 'finder'
    storeMocks.workspaceState.statusBySession = {
      session_1: {
        branch: 'main',
        changedFiles: [],
      },
    }
    storeMocks.getRepositoryContext.mockResolvedValue({
      state: 'ok',
      workDir: '/repo',
      repoRoot: '/repo',
      repoName: 'repo',
      currentBranch: 'main',
      defaultBranch: 'main',
      dirty: false,
      branches: [{ name: 'main', current: true, local: true, remote: true, checkedOut: true }],
      worktrees: [],
    })
    storeMocks.gitLog.mockResolvedValue({
      commits: [{
        hash: 'abcdef123456',
        shortHash: 'abcdef1',
        subject: 'fix: align git panel',
        author: 'Codex',
        date: '06/19 00:10',
        refs: ['HEAD -> main'],
      }],
    })

    render(<OpenProjectMenu path="/repo" sessionId="session_1" variant="environment" externalOpen />)

    await screen.findByRole('dialog', { name: 'Git 工具' })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '打开 Git 图谱' }))
    })

    expect(storeMocks.gitLog).toHaveBeenCalledWith('session_1')
    expect(await screen.findByRole('dialog', { name: 'Git 图谱' })).toBeInTheDocument()
    expect(screen.getByText('fix: align git panel')).toBeInTheDocument()
    expect(screen.getByText('abcdef1')).toBeInTheDocument()
  })
})
