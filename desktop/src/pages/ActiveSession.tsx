import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Archive, Folder, FolderOpen, GitBranch, LoaderCircle, MoreHorizontal, Pencil, Pin, PinOff, SquareTerminal, Target } from 'lucide-react'
import {
  SCHEDULED_TAB_ID,
  SETTINGS_TAB_ID,
  TERMINAL_TAB_PREFIX,
  TRACE_TAB_PREFIX,
  WORKBENCH_TAB_PREFIX,
  useTabStore,
  type TabType,
} from '../stores/tabStore'
import { useSessionStore } from '../stores/sessionStore'
import { useChatStore } from '../stores/chatStore'
import { useCLITaskStore } from '../stores/cliTaskStore'
import { useTeamStore } from '../stores/teamStore'
import { useWorkspacePanelStore } from '../stores/workspacePanelStore'
import { usePinnedSessionStore } from '../stores/pinnedSessionStore'
import { useUIStore } from '../stores/uiStore'
import {
  TERMINAL_PANEL_DEFAULT_HEIGHT,
  TERMINAL_PANEL_MAX_HEIGHT,
  TERMINAL_PANEL_MIN_HEIGHT,
  useTerminalPanelStore,
} from '../stores/terminalPanelStore'
import { useTranslation } from '../i18n'
import { MessageList } from '../components/chat/MessageList'
import { ChatInput } from '../components/chat/ChatInput'
import { StickyThinkingIndicator } from '../components/chat/StreamingIndicator'
import { ComputerUsePermissionModal } from '../components/chat/ComputerUsePermissionModal'
import { SessionTaskBar } from '../components/chat/SessionTaskBar'
import { ConfirmDialog } from '../components/shared/ConfirmDialog'
import { WorkbenchPanel } from '../components/workbench/WorkbenchPanel'
import { TeamStatusBar } from '../components/teams/TeamStatusBar'
import { TerminalSettings } from './TerminalSettings'
import { OpenProjectMenu } from '../components/layout/OpenProjectMenu'
import type { SessionListItem } from '../types/session'
import type { ActiveGoalState, UIMessage } from '../types/chat'
import { useMobileViewport } from '../hooks/useMobileViewport'
import { isDesktopRuntime } from '../lib/desktopRuntime'

const TASK_POLL_INTERVAL_MS = 1000
const WORKSPACE_RESIZE_STEP = 32
const TERMINAL_RESIZE_STEP = 24
const CHAT_COLUMN_WITH_WORKSPACE_CLASS =
  'min-w-[320px] flex-1 bg-[var(--color-surface)]'

function getPathLeaf(path: string | null | undefined) {
  if (!path) return null
  const normalized = path.replace(/\\/g, '/').replace(/\/+$/, '')
  const parts = normalized.split('/').filter(Boolean)
  return parts[parts.length - 1] ?? normalized
}

function isSessionTabState(activeTabId: string | null, activeTabType: TabType | null | undefined) {
  if (!activeTabId) return false
  if (activeTabType === 'session') return true
  if (activeTabType) return false
  return activeTabId !== SETTINGS_TAB_ID &&
    activeTabId !== SCHEDULED_TAB_ID &&
    !activeTabId.startsWith(TERMINAL_TAB_PREFIX) &&
    !activeTabId.startsWith(TRACE_TAB_PREFIX) &&
    !activeTabId.startsWith(WORKBENCH_TAB_PREFIX)
}

function getSessionTerminalCwd(session: SessionListItem | undefined) {
  if (!session) return undefined
  if (session.workDir && session.workDirExists !== false) return session.workDir
  return session.projectPath || undefined
}

function ActiveGoalStrip({
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
        'mt-2 flex max-w-full items-center gap-2 rounded-[8px] border border-[var(--color-memory-border)] bg-[var(--color-memory-surface)] px-2.5 py-1.5',
        compact ? 'text-[11px]' : 'text-[12px]',
      ].join(' ')}
    >
      <Target size={compact ? 13 : 14} className="shrink-0 text-[var(--color-memory-accent)]" strokeWidth={2.25} aria-hidden="true" />
      <span className="shrink-0 font-semibold text-[var(--color-text-primary)]">
        {t('chat.activeGoal.title')}
      </span>
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-memory-accent)]" aria-hidden="true" />
      <span className="shrink-0 text-[var(--color-text-tertiary)]">{statusLabel}</span>
      <span className="min-w-0 flex-1 truncate font-medium text-[var(--color-text-primary)]" title={objective}>
        {objective}
      </span>
      {meta.length > 0 ? (
        <span className="hidden shrink-0 items-center gap-1.5 text-[11px] text-[var(--color-text-tertiary)] lg:flex">
          {meta.map((item) => (
            <span key={item} className="max-w-[140px] truncate">{item}</span>
          ))}
        </span>
      ) : null}
    </div>
  )
}

function WorkspaceResizeHandle() {
  const t = useTranslation()
  const width = useWorkspacePanelStore((state) => state.width)
  const setWidth = useWorkspacePanelStore((state) => state.setWidth)
  const [dragState, setDragState] = useState<{ startX: number; startWidth: number } | null>(null)
  const dragStateRef = useRef(dragState)

  useEffect(() => {
    dragStateRef.current = dragState
  }, [dragState])

  useEffect(() => {
    if (!dragState) return

    const handlePointerMove = (event: PointerEvent) => {
      const current = dragStateRef.current
      if (!current) return
      setWidth(current.startWidth + current.startX - event.clientX)
    }

    const handlePointerUp = () => {
      setDragState(null)
    }

    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    window.addEventListener('pointercancel', handlePointerUp)

    return () => {
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      window.removeEventListener('pointercancel', handlePointerUp)
    }
  }, [dragState, setWidth])

  return (
    <div
      role="separator"
      aria-label={t('workspace.resizePanel')}
      aria-orientation="vertical"
      aria-valuenow={width}
      tabIndex={0}
      data-testid="workspace-resize-handle"
      onPointerDown={(event) => {
        if (event.button !== 0) return
        event.preventDefault()
        setDragState({ startX: event.clientX, startWidth: width })
      }}
      onKeyDown={(event) => {
        if (event.key === 'ArrowLeft') {
          event.preventDefault()
          setWidth(width + WORKSPACE_RESIZE_STEP)
        }
        if (event.key === 'ArrowRight') {
          event.preventDefault()
          setWidth(width - WORKSPACE_RESIZE_STEP)
        }
      }}
      className="group relative z-10 flex w-2 shrink-0 cursor-col-resize items-stretch justify-center outline-none"
    >
      <div className="my-3 w-px rounded-full bg-[var(--color-border)] transition-colors group-hover:bg-[var(--color-border-focus)] group-focus-visible:bg-[var(--color-border-focus)]" />
    </div>
  )
}

function TerminalResizeHandle() {
  const t = useTranslation()
  const height = useTerminalPanelStore((state) => state.height)
  const setHeight = useTerminalPanelStore((state) => state.setHeight)
  const [dragState, setDragState] = useState<{ startY: number; startHeight: number } | null>(null)
  const dragStateRef = useRef(dragState)

  useEffect(() => {
    dragStateRef.current = dragState
  }, [dragState])

  useEffect(() => {
    if (!dragState) return

    const handlePointerMove = (event: PointerEvent) => {
      const current = dragStateRef.current
      if (!current) return
      setHeight(current.startHeight + current.startY - event.clientY)
    }

    const handlePointerUp = () => {
      setDragState(null)
    }

    document.body.style.cursor = 'row-resize'
    document.body.style.userSelect = 'none'
    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    window.addEventListener('pointercancel', handlePointerUp)

    return () => {
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      window.removeEventListener('pointercancel', handlePointerUp)
    }
  }, [dragState, setHeight])

  return (
    <div
      role="separator"
      aria-label={t('terminal.resizePanel')}
      aria-orientation="horizontal"
      aria-valuemin={TERMINAL_PANEL_MIN_HEIGHT}
      aria-valuemax={TERMINAL_PANEL_MAX_HEIGHT}
      aria-valuenow={height}
      tabIndex={0}
      data-testid="terminal-resize-handle"
      onPointerDown={(event) => {
        if (event.button !== 0) return
        event.preventDefault()
        setDragState({ startY: event.clientY, startHeight: height })
      }}
      onKeyDown={(event) => {
        if (event.key === 'ArrowUp') {
          event.preventDefault()
          setHeight(height + TERMINAL_RESIZE_STEP)
        }
        if (event.key === 'ArrowDown') {
          event.preventDefault()
          setHeight(height - TERMINAL_RESIZE_STEP)
        }
        if (event.key === 'Home') {
          event.preventDefault()
          setHeight(TERMINAL_PANEL_MIN_HEIGHT)
        }
        if (event.key === 'End') {
          event.preventDefault()
          setHeight(TERMINAL_PANEL_MAX_HEIGHT)
        }
      }}
      onDoubleClick={() => setHeight(TERMINAL_PANEL_DEFAULT_HEIGHT)}
      className="group flex h-2.5 shrink-0 cursor-row-resize items-center bg-[var(--color-surface)] outline-none focus-visible:bg-[var(--color-surface-container)]"
    >
      <div className="mx-3 h-px flex-1 rounded-full bg-[var(--color-border)] transition-colors group-hover:bg-[var(--color-border-focus)] group-focus-visible:bg-[var(--color-border-focus)]" />
    </div>
  )
}

function TitleMenuItem({
  icon,
  label,
  shortcut,
  disabled = false,
  onClick,
}: {
  icon: ReactNode
  label: string
  shortcut?: string
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      disabled={disabled}
      className="flex w-full items-center gap-3 rounded-[12px] px-3 py-2.5 text-left text-[14px] font-semibold text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-surface-hover)] focus-visible:outline-none focus-visible:bg-[var(--color-surface-hover)] disabled:cursor-not-allowed disabled:text-[var(--color-text-tertiary)] disabled:opacity-55 disabled:hover:bg-transparent"
    >
      <span className="flex h-5 w-5 shrink-0 items-center justify-center text-[var(--color-text-secondary)]">
        {icon}
      </span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {shortcut ? (
        <span className="shrink-0 font-[var(--font-mono)] text-[12px] font-medium text-[var(--color-text-tertiary)]">
          {shortcut}
        </span>
      ) : null}
    </button>
  )
}

function isBranchTurnResponseMessage(message: UIMessage) {
  return (
    message.type === 'assistant_text' ||
    message.type === 'tool_use' ||
    message.type === 'tool_result' ||
    message.type === 'background_task' ||
    message.type === 'error' ||
    message.type === 'task_summary'
  )
}

function getLatestBranchTarget(messages: UIMessage[]): { uiMessageId: string; transcriptMessageId: string } | null {
  let currentTurnCandidates: Array<Extract<UIMessage, { type: 'user_text' | 'assistant_text' }>> = []
  let hasResponseForCurrentTurn = false
  let latestTarget: { uiMessageId: string; transcriptMessageId: string } | null = null

  const markCurrentTurnBranchable = () => {
    if (!hasResponseForCurrentTurn) return
    for (const candidate of currentTurnCandidates) {
      if (!candidate.transcriptMessageId) continue
      latestTarget = {
        uiMessageId: candidate.id,
        transcriptMessageId: candidate.transcriptMessageId,
      }
    }
  }

  for (const message of messages) {
    if (message.type === 'user_text') {
      markCurrentTurnBranchable()
      currentTurnCandidates = []
      hasResponseForCurrentTurn = false
      if (!message.pending && message.transcriptMessageId) {
        currentTurnCandidates = [message]
      }
      continue
    }

    if (currentTurnCandidates.length === 0) continue

    if (isBranchTurnResponseMessage(message)) {
      hasResponseForCurrentTurn = true
    }

    if (message.type === 'assistant_text' && message.transcriptMessageId) {
      currentTurnCandidates.push(message)
    }
  }

  markCurrentTurnBranchable()
  return latestTarget
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) return error.message
  return '操作失败'
}

export function ActiveSession() {
  const isMobileLayout = useMobileViewport() && !isDesktopRuntime()
  const [composerDocked, setComposerDocked] = useState(false)
  const [titleMenuOpen, setTitleMenuOpen] = useState(false)
  const [archiveConfirmOpen, setArchiveConfirmOpen] = useState(false)
  const [isArchivingSession, setIsArchivingSession] = useState(false)
  const [isBranchingSession, setIsBranchingSession] = useState(false)
  const titleMenuRef = useRef<HTMLDivElement>(null)
  const activeTabId = useTabStore((s) => s.activeTabId)
  const activeTabType = useTabStore((s) => s.tabs.find((tab) => tab.sessionId === s.activeTabId)?.type ?? null)
  const closeTab = useTabStore((s) => s.closeTab)
  const updateTabTitle = useTabStore((s) => s.updateTabTitle)
  const sessions = useSessionStore((s) => s.sessions)
  const renameSession = useSessionStore((s) => s.renameSession)
  const branchSession = useSessionStore((s) => s.branchSession)
  const deleteSession = useSessionStore((s) => s.deleteSession)
  const connectToSession = useChatStore((s) => s.connectToSession)
  const disconnectSession = useChatStore((s) => s.disconnectSession)
  const addToast = useUIStore((s) => s.addToast)
  const pinnedSessionIds = usePinnedSessionStore((s) => s.pinnedSessionIds)
  const togglePinnedSession = usePinnedSessionStore((s) => s.togglePinned)
  const removePinnedSession = usePinnedSessionStore((s) => s.removePinned)
  const sessionState = useChatStore((s) => activeTabId ? s.sessions[activeTabId] : undefined)
  const pendingComputerUsePermission = sessionState?.pendingComputerUsePermission ?? null
  const fetchSessionTasks = useCLITaskStore((s) => s.fetchSessionTasks)
  const trackedTaskSessionId = useCLITaskStore((s) => s.sessionId)
  const hasIncompleteTasks = useCLITaskStore((s) => s.tasks.some((task) => task.status !== 'completed'))
  const hasRunningTasks = useCLITaskStore((s) => s.tasks.some((task) => task.status === 'in_progress'))
  const chatState = sessionState?.chatState ?? 'idle'
  const hasRunningBackgroundTasks = Object.values(sessionState?.backgroundAgentTasks ?? {})
    .some((task) => task.status === 'running')

  const session = sessions.find((s) => s.id === activeTabId)
  const isSessionPinned = activeTabId ? pinnedSessionIds.includes(activeTabId) : false
  const memberInfo = useTeamStore((s) => activeTabId ? s.getMemberBySessionId(activeTabId) : null)
  const activeTeam = useTeamStore((s) => s.activeTeam)
  const isMemberSession = !!memberInfo
  const showWorkbench = useWorkspacePanelStore((state) =>
    activeTabId && isSessionTabState(activeTabId, activeTabType) && !isMemberSession && !isMobileLayout
      ? state.isPanelOpen(activeTabId)
      : false,
  )
  const showRightPanel = showWorkbench
  const rightPanelWidth = useWorkspacePanelStore((state) => state.width)
  const showTerminalPanel = useTerminalPanelStore((state) =>
    activeTabId && isSessionTabState(activeTabId, activeTabType) && !isMemberSession && !isMobileLayout
      ? state.isPanelOpen(activeTabId)
      : false,
  )
  const terminalPanelHeight = useTerminalPanelStore((state) => state.height)
  const terminalPanelRuntimeId = useTerminalPanelStore((state) =>
    activeTabId && isSessionTabState(activeTabId, activeTabType) && !isMemberSession && !isMobileLayout
      ? state.panelBySession[activeTabId]?.runtimeId
      : undefined,
  )
  const messages = sessionState?.messages ?? []
  const latestBranchTarget = getLatestBranchTarget(messages)

  useEffect(() => {
    setTitleMenuOpen(false)
    setArchiveConfirmOpen(false)
  }, [activeTabId])

  useEffect(() => {
    if (!titleMenuOpen) return
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null
      if (target && titleMenuRef.current?.contains(target)) return
      setTitleMenuOpen(false)
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setTitleMenuOpen(false)
    }
    document.addEventListener('pointerdown', handlePointerDown, true)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [titleMenuOpen])

  const handleTogglePinnedSession = () => {
    if (!activeTabId) return
    const pinned = togglePinnedSession(activeTabId)
    setTitleMenuOpen(false)
    addToast({
      type: 'success',
      message: pinned ? '已置顶对话' : '已取消置顶',
    })
  }

  const handleRenameCurrentSession = async () => {
    if (!activeTabId || !session) return
    setTitleMenuOpen(false)
    const nextTitle = window.prompt('重命名对话', session.title || t('session.untitled'))?.trim()
    if (!nextTitle || nextTitle === session.title) return
    try {
      await renameSession(activeTabId, nextTitle)
      updateTabTitle(activeTabId, nextTitle)
      addToast({ type: 'success', message: '已重命名对话' })
    } catch (error) {
      addToast({
        type: 'error',
        message: error instanceof Error ? error.message : '重命名失败',
      })
    }
  }

  const handleArchiveCurrentSession = async () => {
    if (!activeTabId) return
    setIsArchivingSession(true)
    try {
      disconnectSession(activeTabId)
      await deleteSession(activeTabId)
      removePinnedSession(activeTabId)
      closeTab(activeTabId)
      setArchiveConfirmOpen(false)
      addToast({ type: 'success', message: '已归档对话' })
    } catch (error) {
      addToast({
        type: 'error',
        message: error instanceof Error ? error.message : '归档失败',
      })
    } finally {
      setIsArchivingSession(false)
    }
  }

  const handleBranchCurrentSession = async () => {
    if (!activeTabId || !latestBranchTarget || isBranchingSession) return
    setTitleMenuOpen(false)
    setIsBranchingSession(true)
    try {
      const result = await branchSession(activeTabId, latestBranchTarget.transcriptMessageId)
      const title = result.title.trim() || t('sidebar.newSession')
      useTabStore.getState().openTab(result.sessionId, title)
      useChatStore.getState().connectToSession(result.sessionId)
      addToast({ type: 'success', message: `已创建分支对话“${title}”` })
    } catch (error) {
      addToast({ type: 'error', message: `创建分支失败：${getErrorMessage(error)}` })
    } finally {
      setIsBranchingSession(false)
    }
  }

  useEffect(() => {
    if (activeTabId && !isMemberSession) {
      connectToSession(activeTabId)
    }
  }, [activeTabId, isMemberSession, connectToSession])

  useEffect(() => {
    if (!activeTabId || isMemberSession) return

    const shouldPollTasks =
      chatState !== 'idle' ||
      (trackedTaskSessionId === activeTabId && hasIncompleteTasks)

    if (!shouldPollTasks) return

    void fetchSessionTasks(activeTabId)

    const timer = setInterval(() => {
      void fetchSessionTasks(activeTabId)
    }, TASK_POLL_INTERVAL_MS)

    return () => clearInterval(timer)
  }, [
    activeTabId,
    isMemberSession,
    chatState,
    trackedTaskSessionId,
    hasIncompleteTasks,
    fetchSessionTasks,
  ])

  const t = useTranslation()
  const streamingText = sessionState?.streamingText ?? ''
  const activeGoal = sessionState?.activeGoal ?? null
  const isEmpty = messages.length === 0 && !streamingText && (session?.messageCount ?? 0) === 0
  const compactEmptyHero = isEmpty && showTerminalPanel
  const shouldFloatHeroComposer = isEmpty && !isMemberSession && !showRightPanel && !isMobileLayout
  const isHistoryLoading =
    !isMemberSession &&
    (session?.messageCount ?? 0) > 0 &&
    messages.length === 0 &&
    sessionState?.historyStatus === 'loading'
  const historyError =
    !isMemberSession &&
    (session?.messageCount ?? 0) > 0 &&
    messages.length === 0 &&
    sessionState?.historyStatus === 'error'
      ? sessionState.historyError || t('session.historyLoadFailed')
      : null
  const isActive = chatState !== 'idle' ||
    (trackedTaskSessionId === activeTabId && hasRunningTasks) ||
    hasRunningBackgroundTasks
  const openProjectPath = session?.workDir && session.workDirExists !== false
    ? session.workDir
    : session?.projectPath || null
  const projectLabel = getPathLeaf(openProjectPath)

  useEffect(() => {
    setComposerDocked(false)
  }, [activeTabId])

  if (!activeTabId) return null

  return (
    <div className="flex-1 flex relative overflow-hidden bg-[var(--color-surface)] text-on-surface">
      <div data-testid="active-session-content-row" className="flex min-h-0 min-w-0 flex-1">
        <div
          data-testid="active-session-chat-column"
          className={`relative flex min-h-0 flex-col ${showRightPanel ? CHAT_COLUMN_WITH_WORKSPACE_CLASS : isMobileLayout ? 'min-w-0 flex-1' : 'min-w-[360px] flex-1'}`}
        >
          {isMemberSession && (
            <div className="relative shrink-0 bg-[var(--color-surface-container)]">
              <div className="absolute left-3 right-3 bottom-0 h-px rounded-full bg-[rgba(255,255,255,0.08)]" />
              <div className="mx-auto max-w-[860px] flex items-center justify-between gap-4 px-8 py-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-3">
                    {memberInfo?.status === 'running' && (
                      <span className="flex h-2 w-2 rounded-full bg-[var(--color-warning)] animate-pulse-dot" />
                    )}
                    {memberInfo?.status === 'completed' && (
                      <span className="material-symbols-outlined text-[14px] text-[var(--color-success)]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                    )}
                    <span className="material-symbols-outlined text-[14px] text-[var(--color-text-tertiary)]">smart_toy</span>
                    <span className="text-sm font-semibold text-[var(--color-text-primary)]">
                      {memberInfo?.role}
                    </span>
                    {activeTeam && (
                      <span className="text-[10px] text-[var(--color-text-tertiary)]">
                        @ {activeTeam.name}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-[11px] text-[var(--color-text-tertiary)]">
                    {t('teams.memberSessionHint')}
                  </p>
                </div>
                <button
                  onClick={() => {
                    if (activeTeam?.leadSessionId) {
                      useTabStore.getState().openTab(
                        activeTeam.leadSessionId,
                        t('teams.leader'),
                        'session',
                      )
                    }
                  }}
                  disabled={!activeTeam?.leadSessionId}
                  className="flex shrink-0 items-center gap-1 text-xs font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors disabled:opacity-50 disabled:hover:text-[var(--color-text-secondary)]"
                >
                  <span className="material-symbols-outlined text-[14px]">arrow_back</span>
                  {t('teams.backToLeader')}
                </button>
              </div>
            </div>
          )}

          {isEmpty ? (
            <div
              data-testid="empty-session-hero"
              className={[
                'flex min-h-0 flex-1 flex-col items-center justify-center overflow-hidden px-8 pt-8',
                compactEmptyHero ? 'pb-6' : 'pb-32',
              ].join(' ')}
            >
              <div className="empty-session-hero-panel flex w-full max-w-[760px] flex-col items-center text-center">
                {isMemberSession ? (
                  <>
                    <span className={`material-symbols-outlined mb-4 text-[var(--color-text-tertiary)] ${compactEmptyHero ? 'text-[36px]' : 'text-[48px]'}`}>smart_toy</span>
                    <p className="text-[var(--color-text-secondary)]">
                      {memberInfo?.status === 'running'
                        ? `${memberInfo.role} ${t('teams.working')}`
                        : t('teams.noMessages')}
                    </p>
                  </>
                ) : (
                  <>
                    <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-surface-container-low)] px-3 py-1 text-[11px] font-medium text-[var(--color-text-secondary)]">
                      <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-brand)]" />
                      {projectLabel ?? t('empty.title')}
                    </div>
                    <h1 className={`${compactEmptyHero ? 'mb-2 text-[28px]' : 'mb-3 text-[34px]'} font-semibold tracking-[-0.03em] text-[var(--color-text-primary)]`}>
                      {t('empty.title')}
                    </h1>
                    <p className={`mx-auto max-w-[520px] text-[var(--color-text-secondary)] ${compactEmptyHero ? 'text-sm leading-6' : 'text-[15px] leading-7'}`}>
                      {t('empty.subtitle')}
                    </p>
                    <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
                      <span className="inline-flex items-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface-container-low)] px-3 py-1.5 text-[11px] font-medium text-[var(--color-text-secondary)]">
                        {t('chat.addFiles')}
                      </span>
                      <span className="inline-flex items-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface-container-low)] px-3 py-1.5 text-[11px] font-medium text-[var(--color-text-secondary)]">
                        {t('chat.slashCommands')}
                      </span>
                      <span className="inline-flex items-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface-container-low)] px-3 py-1.5 text-[11px] font-medium text-[var(--color-text-secondary)]">
                        {t('tabs.showWorkspace')}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>
          ) : (
            <>
              {!isMemberSession && !isMobileLayout && (
                <div
                  data-desktop-drag-region={isDesktopRuntime() ? true : undefined}
                  className="session-titlebar relative flex w-full items-center border-b border-[var(--color-border)]/65 px-4"
                >
                  <div className="session-header-shell flex w-full items-center justify-between">
                    <div className="min-w-0 flex-1 pr-3">
                      <div className="flex min-w-0 items-center gap-2">
                        <h1
                          className={
                            showRightPanel
                              ? 'min-w-0 max-w-[min(62vw,620px)] truncate text-[14px] font-semibold leading-5 tracking-[-0.015em] text-[var(--color-text-primary)]'
                              : 'min-w-0 max-w-[min(68vw,760px)] truncate text-[14px] font-semibold leading-5 tracking-[-0.015em] text-[var(--color-text-primary)]'
                          }
                        >
                          {session?.title || t('session.untitled')}
                        </h1>
                        <div ref={titleMenuRef} className="relative shrink-0">
                          <button
                            type="button"
                            aria-label="更多"
                            title="更多"
                            aria-haspopup="menu"
                            aria-expanded={titleMenuOpen}
                            onClick={(event) => {
                              event.stopPropagation()
                              setTitleMenuOpen((open) => !open)
                            }}
                            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] text-[var(--color-text-tertiary)] transition-colors hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-border-focus)] data-[state=open]:bg-[var(--color-surface-hover)] data-[state=open]:text-[var(--color-text-primary)]"
                            data-state={titleMenuOpen ? 'open' : 'closed'}
                          >
                            <MoreHorizontal size={16} strokeWidth={2} aria-hidden="true" />
                          </button>
                          {titleMenuOpen && (
                            <div
                              role="menu"
                              className="session-title-menu absolute left-0 top-[calc(100%+8px)] z-[320] w-[250px] overflow-hidden rounded-[18px] border border-[var(--color-border)] bg-[var(--color-surface-container-high)] p-1.5 shadow-[0_20px_60px_rgba(0,0,0,0.38)]"
                              onClick={(event) => event.stopPropagation()}
                            >
                              <TitleMenuItem
                                icon={isSessionPinned ? <PinOff size={18} aria-hidden="true" /> : <Pin size={18} aria-hidden="true" />}
                                label={isSessionPinned ? '取消置顶对话' : '置顶对话'}
                                shortcut="⌥⌘P"
                                onClick={handleTogglePinnedSession}
                              />
                              <TitleMenuItem
                                icon={<Pencil size={18} aria-hidden="true" />}
                                label="重命名对话"
                                shortcut="⌥⌘R"
                                onClick={() => { void handleRenameCurrentSession() }}
                              />
                              <TitleMenuItem
                                icon={<Archive size={18} aria-hidden="true" />}
                                label="归档对话"
                                shortcut="⇧⌘A"
                                onClick={() => {
                                  setTitleMenuOpen(false)
                                  setArchiveConfirmOpen(true)
                                }}
                              />
                              <div className="my-1.5 h-px bg-[var(--color-border)]/70" />
                              <TitleMenuItem
                                icon={isBranchingSession ? <LoaderCircle size={18} className="animate-spin" aria-hidden="true" /> : <GitBranch size={18} aria-hidden="true" />}
                                label={isBranchingSession ? '正在创建分支…' : '分支'}
                                shortcut="⌥⌘B"
                                disabled={!latestBranchTarget || isActive || isBranchingSession}
                                onClick={() => { void handleBranchCurrentSession() }}
                              />
                            </div>
                          )}
                        </div>
                        {isActive && (
                          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-success)] animate-pulse-dot" aria-label={t('session.active')} />
                        )}
                      </div>
                      {session?.workDirExists === false && (
                        <div className="mt-2 inline-flex max-w-full items-center gap-2 rounded-lg border border-[var(--color-error)]/20 bg-[var(--color-error)]/8 px-3 py-1.5 text-[11px] text-[var(--color-error)]">
                          <span className="material-symbols-outlined text-[14px]">warning</span>
                          <span className="truncate">
                            {t('session.workspaceUnavailable', { dir: session.workDir || 'directory no longer exists' })}
                          </span>
                        </div>
                      )}
                      <ActiveGoalStrip
                        goal={activeGoal}
                        isRunning={isActive}
                        compact
                      />
                    </div>
                    <div className="session-header-actions flex shrink-0 items-center gap-1">
                      <OpenProjectMenu path={openProjectPath} />
                      <button
                        type="button"
                        aria-label={t('tabs.openTerminal')}
                        title={t('tabs.openTerminal')}
                        onClick={() => {
                          if (activeTabId) {
                            useTerminalPanelStore.getState().togglePanel(activeTabId)
                          }
                        }}
                        data-active={showTerminalPanel ? 'true' : 'false'}
                        className={`inline-flex h-7 w-7 items-center justify-center rounded-[8px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-border-focus)] spring-bounce-btn ${
                          showTerminalPanel
                            ? 'bg-[var(--color-surface)] text-[var(--color-text-primary)] shadow-[0_8px_18px_rgba(0,0,0,0.12)]'
                            : 'text-[var(--color-text-tertiary)] hover:bg-[var(--color-surface)] hover:text-[var(--color-text-primary)]'
                        }`}
                      >
                        <SquareTerminal size={15} strokeWidth={1.9} />
                      </button>
                      <button
                        type="button"
                        aria-label={t('tabs.showWorkspace')}
                        title={t('tabs.showWorkspace')}
                        onClick={() => {
                          if (!activeTabId) return
                          const ws = useWorkspacePanelStore.getState()
                          if (ws.isPanelOpen(activeTabId) && ws.getMode(activeTabId) === 'workspace') {
                            ws.closePanel(activeTabId)
                          } else {
                            ws.setMode(activeTabId, 'workspace')
                            ws.openPanel(activeTabId)
                          }
                        }}
                        data-active={showWorkbench ? 'true' : 'false'}
                        className={`inline-flex h-7 w-7 items-center justify-center rounded-[8px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-border-focus)] spring-bounce-btn ${
                          showWorkbench
                            ? 'bg-[var(--color-surface)] text-[var(--color-text-primary)] shadow-[0_8px_18px_rgba(0,0,0,0.12)]'
                            : 'text-[var(--color-text-tertiary)] hover:bg-[var(--color-surface)] hover:text-[var(--color-text-primary)]'
                        }`}
                      >
                        {showWorkbench ? <FolderOpen size={15} strokeWidth={1.9} /> : <Folder size={15} strokeWidth={1.9} />}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {isHistoryLoading ? (
                <div role="status" className="flex flex-1 items-center justify-center p-8 text-sm text-[var(--color-text-secondary)]">
                  <span className="material-symbols-outlined mr-2 animate-spin text-[18px]">progress_activity</span>
                  {t('common.loading')}
                </div>
              ) : historyError ? (
                <div role="alert" className="flex flex-1 items-center justify-center p-8 text-sm text-[var(--color-error)]">
                  {historyError}
                </div>
              ) : (
                <MessageList compact={showRightPanel} bottomPadding={240} />
              )}
            </>
          )}

          <TeamStatusBar />

          <div
            data-testid="chat-input-dock-region"
            className={
              shouldFloatHeroComposer && !composerDocked
                ? 'chat-input-dock-region chat-input-dock-region--floating'
                : 'chat-input-dock-region'
            }
          >
            {!isMemberSession && <SessionTaskBar />}
            <StickyThinkingIndicator visible={chatState === 'tool_executing' || chatState === 'thinking' || chatState === 'streaming'} compact={showRightPanel} />
            <ChatInput
              variant={shouldFloatHeroComposer && !composerDocked ? 'hero' : 'default'}
              compact={showRightPanel}
              onSubmitStart={() => {
                if (shouldFloatHeroComposer) {
                  setComposerDocked(true)
                }
              }}
            />
          </div>

          <div
            className={`transition-all duration-[550ms] ease-[cubic-bezier(0.32,0.72,0,1)] ${showTerminalPanel && terminalPanelRuntimeId ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0 overflow-hidden'}`}
          >
          {terminalPanelRuntimeId && activeTabId ? (
            <div
              data-testid="session-terminal-panel"
              className="flex shrink-0 flex-col border-t border-[var(--color-border)] bg-[var(--color-surface-container-lowest)]"
              style={{ height: terminalPanelHeight }}
            >
              <TerminalResizeHandle />
              <TerminalSettings
                active={showTerminalPanel}
                docked
                cwd={getSessionTerminalCwd(session)}
                runtimeId={terminalPanelRuntimeId}
                preserveOnUnmount
                testId={`session-terminal-host-${activeTabId}`}
                onOpenInTab={() => {
                  useTerminalPanelStore.getState().closePanel(activeTabId)
                  useTabStore.getState().openTerminalTab(getSessionTerminalCwd(session), terminalPanelRuntimeId)
                  useTerminalPanelStore.getState().detachRuntime(activeTabId)
                }}
                onClose={() => useTerminalPanelStore.getState().closePanel(activeTabId)}
              />
            </div>
          ) : null}
          </div>
        </div>

        {showWorkbench ? (
          <>
            <WorkspaceResizeHandle />
            <aside
              data-testid="workbench-panel"
              className="flex h-full shrink-0 flex-col bg-[var(--color-surface)]"
              style={{ width: rightPanelWidth, maxWidth: '62%', minWidth: 'min(420px, 54%)' }}
            >
              <WorkbenchPanel sessionId={activeTabId} />
            </aside>
          </>
        ) : null}
      </div>

      {!isMemberSession && activeTabId ? (
        <ComputerUsePermissionModal
          sessionId={activeTabId}
          request={pendingComputerUsePermission?.request ?? null}
        />
      ) : null}

      <ConfirmDialog
        open={archiveConfirmOpen}
        onClose={() => {
          if (!isArchivingSession) setArchiveConfirmOpen(false)
        }}
        onConfirm={() => { void handleArchiveCurrentSession() }}
        title="归档对话"
        body={`确定要归档“${session?.title || t('session.untitled')}”吗？归档后它会从当前对话列表中移除。`}
        confirmLabel="归档"
        cancelLabel={t('common.cancel')}
        confirmVariant="danger"
        loading={isArchivingSession}
      />
    </div>
  )
}
