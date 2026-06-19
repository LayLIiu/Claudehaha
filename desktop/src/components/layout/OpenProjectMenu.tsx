import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  ChevronDown,
  FolderGit2,
  FolderOpen,
  GitBranch,
  GitCommitHorizontal,
  Github,
  Plus,
  SquarePen,
} from 'lucide-react'
import { sessionsApi, type RepositoryContextResult } from '../../api/sessions'
import { useTranslation } from '../../i18n'
import { getDesktopHost } from '../../lib/desktopHost'
import { useOpenTargetStore } from '../../stores/openTargetStore'
import { useWorkspaceChatContextStore } from '../../stores/workspaceChatContextStore'
import { useWorkspacePanelStore } from '../../stores/workspacePanelStore'
import { useCLITaskStore } from '../../stores/cliTaskStore'
import { useChatStore } from '../../stores/chatStore'
import { TargetIcon } from '../common/TargetIcon'
import { GitActionsDialog } from './GitActionsDialog'

type Props = {
  path: string | null | undefined
  sessionId?: string | null
  variant?: 'simple' | 'environment'
  /** When true, forces the environment panel open (controlled by external button). */
  externalOpen?: boolean
  /** Called when the panel closes itself (click-away, Escape). Use to sync external state. */
  onExternalClose?: () => void
}

function getPathLeaf(path: string | null | undefined) {
  if (!path) return ''
  return path.replace(/\\/g, '/').split('/').filter(Boolean).pop() || path
}

function formatReferenceLocation(path: string, lineStart?: number, lineEnd?: number) {
  if (!lineStart) return path
  if (lineEnd && lineEnd !== lineStart) return `${path}:L${lineStart}-L${lineEnd}`
  return `${path}:L${lineStart}`
}

export function OpenProjectMenu({
  path,
  sessionId = null,
  variant = 'simple',
  externalOpen,
  onExternalClose,
}: Props) {
  const t = useTranslation()
  const targets = useOpenTargetStore((state) => state.targets)
  const primaryTargetId = useOpenTargetStore((state) => state.primaryTargetId)
  const ensureTargets = useOpenTargetStore((state) => state.ensureTargets)
  const openTarget = useOpenTargetStore((state) => state.openTarget)
  const loadStatus = useWorkspacePanelStore((state) => state.loadStatus)
  const statusBySession = useWorkspacePanelStore((state) => state.statusBySession)
  const openWorkspacePanel = useWorkspacePanelStore((state) => state.openPanel)
  const setWorkspaceMode = useWorkspacePanelStore((state) => state.setMode)
  const setWorkspaceView = useWorkspacePanelStore((state) => state.setActiveView)
  const referencesBySession = useWorkspaceChatContextStore((state) => state.referencesBySession)
  const tasks = useCLITaskStore((state) => state.tasks)
  const resetCompletedTasks = useCLITaskStore((state) => state.resetCompletedTasks)
  const sessionState = useChatStore((state) => sessionId ? state.sessions[sessionId] : undefined)
  const stopGeneration = useChatStore((state) => state.stopGeneration)
  const activeGoal = sessionState?.activeGoal ?? null
  const backgroundTasks = sessionState?.backgroundAgentTasks ?? {}
  const [open, setOpen] = useState(false)
  const [branchesExpanded, setBranchesExpanded] = useState(false)
  const [gitDialogOpen, setGitDialogOpen] = useState(false)
  const [repoLoading, setRepoLoading] = useState(false)
  const [repoContext, setRepoContext] = useState<RepositoryContextResult | null>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  // External open control: when externalOpen becomes true, open the panel
  useEffect(() => {
    if (externalOpen) setOpen(true)
  }, [externalOpen])

  // Wrap setOpen to notify parent when panel closes
  const handleClose = useCallback(() => {
    setOpen(false)
    onExternalClose?.()
  }, [onExternalClose])

  useEffect(() => {
    if (!path) {
      setOpen(false)
      return
    }
    void ensureTargets()
  }, [ensureTargets, path])

  useEffect(() => {
    if (!open) return

    const handleDocumentMouseDown = (event: MouseEvent) => {
      const target = event.target as Node
      if (buttonRef.current?.contains(target) || menuRef.current?.contains(target)) return
      handleClose()
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') handleClose()
    }

    document.addEventListener('mousedown', handleDocumentMouseDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleDocumentMouseDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  useEffect(() => {
    if (!open || variant !== 'environment' || !path) return

    let cancelled = false
    setRepoLoading(true)
    sessionsApi.getRepositoryContext(path)
      .then((result) => {
        if (!cancelled) setRepoContext(result)
      })
      .catch(() => {
        if (!cancelled) setRepoContext(null)
      })
      .finally(() => {
        if (!cancelled) setRepoLoading(false)
      })

    if (sessionId) {
      void loadStatus(sessionId)
    }

    return () => {
      cancelled = true
    }
  }, [loadStatus, open, path, sessionId, variant])

  const primaryTarget = useMemo(
    () => targets.find((target) => target.id === primaryTargetId) ?? targets[0] ?? null,
    [primaryTargetId, targets],
  )
  const hasMenu = targets.length > 1

  const handleOpenTarget = async (targetId: string) => {
    if (!path) return
    try {
      await openTarget(targetId, path)
    } catch {
      // Store state already records the failure; keep the control responsive.
    } finally {
      if (variant === 'simple') handleClose()
    }
  }

  if (!path || !primaryTarget) return null

  const buttonLabel = hasMenu
    ? t('openProject.openProject')
    : t('openProject.openIn', { target: primaryTarget.label })

  const rect = buttonRef.current?.getBoundingClientRect()
  const workspaceStatus = sessionId ? statusBySession[sessionId] : undefined
  const changeCount = workspaceStatus?.changedFiles.length ?? 0
  const totalAdditions = workspaceStatus?.changedFiles.reduce((sum, f) => sum + f.additions, 0) ?? 0
  const totalDeletions = workspaceStatus?.changedFiles.reduce((sum, f) => sum + f.deletions, 0) ?? 0
  const branchLabel = repoContext?.currentBranch || workspaceStatus?.branch || '无分支'
  const localLabel = primaryTarget.label || '本地'
  const references = sessionId ? (referencesBySession[sessionId] ?? []) : []
  const sources = references.slice(0, 4)

  if (variant === 'simple') {
    return (
      <div className="relative flex items-center">
        <button
          ref={buttonRef}
          type="button"
          aria-label={buttonLabel}
          aria-haspopup={hasMenu ? 'menu' : undefined}
          aria-expanded={hasMenu ? open : undefined}
          title={buttonLabel}
          onClick={() => {
            if (hasMenu) {
              setOpen((value) => !value)
              return
            }
            void handleOpenTarget(primaryTarget.id)
          }}
          className={`inline-flex h-8 items-center justify-center gap-1 rounded-[var(--radius-md)] border border-[var(--color-token-border)] bg-[var(--color-token-bg-subtle,rgba(255,255,255,0.04))] text-[var(--color-token-text-secondary)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-token-focus-border,var(--color-border-focus))] ${
            hasMenu
              ? 'min-w-[2.75rem] px-2 hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-token-foreground)]'
              : 'w-8 hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-token-foreground)]'
          }`}
        >
          <TargetIcon target={primaryTarget} />
          {hasMenu && <ChevronDown size={14} strokeWidth={1.9} />}
        </button>

        {open && hasMenu && rect ? createPortal(
          <div
            ref={menuRef}
            role="menu"
            className="liquid-glass glass-panel fixed z-50 min-w-[220px] overflow-hidden rounded-[var(--radius-2xl)] p-1.5 shadow-[var(--shadow-dropdown)]"
            style={{ top: rect.bottom + 6, right: Math.max(12, window.innerWidth - rect.right) }}
          >
            {targets.map((target) => (
              <button
                key={target.id}
                type="button"
                role="menuitem"
                onClick={() => void handleOpenTarget(target.id)}
                className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm font-medium text-[var(--color-token-foreground)] transition-colors hover:bg-[rgba(255,255,255,0.04)] focus-visible:bg-[rgba(255,255,255,0.04)]"
              >
                <span className="flex h-7 w-7 items-center justify-center text-[var(--color-token-text-secondary)]">
                  <TargetIcon target={target} size={24} />
                </span>
                <span className="min-w-0 truncate">{target.label}</span>
              </button>
            ))}
          </div>,
          document.body,
        ) : null}
      </div>
    )
  }

  return (
    <div className="relative flex items-center">
      <button
        ref={buttonRef}
        type="button"
        aria-label={buttonLabel}
        aria-haspopup="dialog"
        aria-expanded={open}
        title={buttonLabel}
        onClick={() => setOpen((value) => !value)}
        className="inline-flex h-7 w-7 items-center justify-center rounded-[var(--radius-sm)] text-[var(--color-token-text-secondary)] transition-colors hover:bg-[var(--color-surface)] hover:text-[var(--color-token-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-token-focus-border,var(--color-border-focus))]"
      >
        <TargetIcon target={primaryTarget} size={17} />
      </button>

      {open && rect ? createPortal(
        <div
          ref={menuRef}
          role="dialog"
          aria-label="环境信息"
          className="liquid-glass glass-panel fixed z-[340] w-[min(280px,calc(100vw-32px))] overflow-hidden rounded-[var(--radius-lg)] p-1.5 shadow-[var(--shadow-dropdown)]"
          style={{
            top: rect.bottom + 6,
            right: Math.max(12, window.innerWidth - rect.right),
          }}
        >
          <div className="px-2.5 py-2">
            <div className="flex items-center justify-between gap-2">
              <div className="text-[11px] font-semibold text-[rgba(255,255,255,0.88)]">
                环境信息
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!sessionId) return
                  setWorkspaceMode(sessionId, 'workspace')
                  setWorkspaceView(sessionId, 'all')
                  openWorkspacePanel(sessionId)
                  void loadStatus(sessionId)
                  handleClose()
                }}
                className="inline-flex h-5 w-5 items-center justify-center rounded-[var(--radius-xs)] text-[rgba(255,255,255,0.7)] transition-colors hover:bg-[rgba(255,255,255,0.06)] hover:text-[rgba(255,255,255,0.95)]"
                title="打开工作区"
              >
                <Plus size={12} />
              </button>
            </div>

            <div className="mt-1.5 space-y-px">
              <button
                type="button"
                onClick={() => {
                  if (!sessionId) return
                  setWorkspaceMode(sessionId, 'workspace')
                  setWorkspaceView(sessionId, 'changed')
                  openWorkspacePanel(sessionId)
                  void loadStatus(sessionId)
                  handleClose()
                }}
                className="flex w-full items-center gap-1.5 rounded-[var(--radius-xs)] px-1.5 py-1 text-left transition-colors hover:bg-[rgba(255,255,255,0.04)]"
              >
                <SquarePen size={13} className="shrink-0 text-[rgba(255,255,255,0.9)]" />
                <span className="flex min-w-0 flex-1 items-center gap-1.5">
                  <span className="text-[11px] font-medium text-[rgba(255,255,255,0.96)]">变更</span>
                  <span className="rounded-full bg-[rgba(255,255,255,0.08)] px-1.5 py-px text-[9px] text-[rgba(255,255,255,0.68)]">
                    {changeCount}
                  </span>
                </span>
              </button>

              <div>
                <button
                  type="button"
                  onClick={() => {
                    if (path) void getDesktopHost().shell.openPath(path)
                    handleClose()
                  }}
                  className="flex w-full items-center gap-1.5 rounded-[var(--radius-xs)] px-1.5 py-1 text-left transition-colors hover:bg-[rgba(255,255,255,0.04)]"
                >
                  <FolderOpen size={13} className="shrink-0 text-[rgba(255,255,255,0.9)]" />
                  <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-[rgba(255,255,255,0.96)]">
                    {localLabel}
                  </span>
                </button>
              </div>

              <div>
                <button
                  type="button"
                  disabled={repoContext?.state !== 'ok' || (repoContext?.branches.length ?? 0) === 0}
                  onClick={() => setBranchesExpanded((value) => !value)}
                  className="flex w-full items-center gap-1.5 rounded-[var(--radius-xs)] px-1.5 py-1 text-left transition-colors hover:bg-[rgba(255,255,255,0.04)] disabled:cursor-default disabled:opacity-70 disabled:hover:bg-transparent"
                >
                  <GitBranch size={13} className="shrink-0 text-[rgba(255,255,255,0.9)]" />
                  <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-[rgba(255,255,255,0.96)]">
                    {repoLoading ? '加载分支中…' : branchLabel}
                  </span>
                  {(repoContext?.branches.length ?? 0) > 0 ? <ChevronDown size={12} className={`shrink-0 text-[rgba(255,255,255,0.7)] transition-transform ${branchesExpanded ? 'rotate-180' : ''}`} /> : null}
                </button>

                {branchesExpanded && repoContext?.state === 'ok' ? (
                  <div className="ml-5 mt-0.5 max-h-[120px] space-y-px overflow-y-auto">
                    {repoContext.branches.slice(0, 12).map((branch) => (
                      <div
                        key={branch.name}
                        className="flex items-center gap-1.5 rounded-[var(--radius-xs)] px-1.5 py-1"
                      >
                        <span className={`h-1 w-1 rounded-full ${branch.current ? 'bg-[rgba(255,255,255,0.86)]' : 'bg-[rgba(255,255,255,0.18)]'}`} />
                        <span className="min-w-0 flex-1 truncate text-[10px] text-[rgba(255,255,255,0.76)]">
                          {branch.name}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>

              <button
                type="button"
                disabled={!sessionId}
                onClick={() => setGitDialogOpen((v) => !v)}
                className="flex w-full items-center gap-1.5 rounded-[var(--radius-xs)] px-1.5 py-1 text-left transition-colors hover:bg-[rgba(255,255,255,0.04)] disabled:cursor-default disabled:opacity-70 disabled:hover:bg-transparent"
              >
                <GitCommitHorizontal size={13} className="shrink-0 text-[rgba(255,255,255,0.9)]" />
                <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-[rgba(255,255,255,0.96)]">
                  提交更改…
                </span>
                {changeCount > 0 && (
                  <span className="rounded-full bg-[rgba(255,255,255,0.08)] px-1.5 py-px text-[9px] text-[rgba(255,255,255,0.68)]">
                    {changeCount}
                  </span>
                )}
              </button>

              <div className="flex items-center gap-1.5 rounded-[var(--radius-xs)] px-1.5 py-1 opacity-80">
                <Github size={13} className="shrink-0 text-[rgba(255,255,255,0.6)]" />
                <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-[rgba(255,255,255,0.6)]">
                  GitHub CLI 不可用
                </span>
              </div>
            </div>

            <div className="my-2 h-px rounded-full bg-[rgba(255,255,255,0.08)]" />

            <div className="flex items-center justify-between gap-2">
              <div className="text-[10px] font-semibold text-[rgba(255,255,255,0.7)]">
                任务
              </div>
              {tasks.length > 0 && tasks.every((tk) => tk.status === 'completed') ? (
                <button
                  type="button"
                  onClick={() => { void resetCompletedTasks(sessionId ?? undefined) }}
                  className="flex h-4 w-4 shrink-0 items-center justify-center rounded-[var(--radius-2xs)] text-[rgba(255,255,255,0.5)] transition-colors hover:bg-[rgba(255,255,255,0.06)] hover:text-[rgba(255,255,255,0.8)]"
                >
                  <span className="material-symbols-outlined text-[10px]">close</span>
                </button>
              ) : null}
            </div>
            <div className="mt-1 space-y-px">
              {tasks.length > 0 ? tasks.map((task) => {
                const isCompleted = task.status === 'completed'
                const isActive = task.status === 'in_progress'
                const icon = isCompleted ? 'check_circle' : isActive ? 'pending' : 'radio_button_unchecked'
                const color = isCompleted ? 'var(--color-success)' : isActive ? 'var(--color-warning)' : 'rgba(255,255,255,0.5)'
                return (
                  <div key={task.id} className="flex items-center gap-1.5 rounded-[var(--radius-xs)] px-1.5 py-1">
                    <span
                      className="material-symbols-outlined shrink-0 text-[13px]"
                      style={{ color, fontVariationSettings: "'FILL' 1" }}
                    >
                      {icon}
                    </span>
                    <span className="text-[9px] font-mono text-[rgba(255,255,255,0.4)]">
                      #{task.id}
                    </span>
                    <span className={`text-[11px] ${
                      isCompleted
                        ? 'text-[rgba(255,255,255,0.5)] line-through'
                        : 'text-[rgba(255,255,255,0.92)]'
                    }`}>
                      {task.subject}
                    </span>
                    {isActive && task.activeForm && (
                      <span className="text-[9px] text-[var(--color-warning)] truncate">
                        {task.activeForm}
                      </span>
                    )}
                  </div>
                )
              }) : (
                <div className="text-[10px] text-[rgba(255,255,255,0.45)] px-1.5 py-1">
                  暂无任务
                </div>
              )}
            </div>

            {activeGoal && activeGoal.action !== 'completed' ? (
              <>
                <div className="my-2 h-px rounded-full bg-[rgba(255,255,255,0.08)]" />

                <div className="text-[10px] font-semibold text-[rgba(255,255,255,0.7)]">
                  目标
                </div>
                <div className="mt-1 space-y-px">
                  <div className="flex items-center gap-1.5 rounded-[var(--radius-xs)] px-1.5 py-1">
                    <span
                      className="material-symbols-outlined shrink-0 text-[13px]"
                      style={{
                        color: activeGoal.status === 'paused' ? 'var(--color-warning)' : 'var(--color-success)',
                        fontVariationSettings: "'FILL' 1",
                      }}
                    >
                      {activeGoal.status === 'paused' ? 'pause_circle' : 'target'}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-[rgba(255,255,255,0.92)]">
                      {activeGoal.objective ?? activeGoal.message ?? '—'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 px-1.5">
                    {activeGoal.status && (
                      <span className={`text-[9px] font-medium ${
                        activeGoal.status === 'paused' ? 'text-[var(--color-warning)]' : 'text-[var(--color-success)]'
                      }`}>
                        {activeGoal.status === 'paused' ? '已暂停' : activeGoal.status === 'running' ? '运行中' : activeGoal.status}
                      </span>
                    )}
                    {activeGoal.budget && (
                      <span className="text-[9px] text-[rgba(255,255,255,0.46)]">
                        预算 {activeGoal.budget}
                      </span>
                    )}
                    {activeGoal.elapsed && (
                      <span className="text-[9px] text-[rgba(255,255,255,0.46)]">
                        已用 {activeGoal.elapsed}
                      </span>
                    )}
                    {activeGoal.continuations && (
                      <span className="text-[9px] text-[rgba(255,255,255,0.46)]">
                        续轮 {activeGoal.continuations}
                      </span>
                    )}
                  </div>
                </div>
              </>
            ) : null}

            {Object.values(backgroundTasks).some((t) => t.status === 'running') ? (
              <>
                <div className="my-2 h-px rounded-full bg-[rgba(255,255,255,0.08)]" />

                <div className="text-[10px] font-semibold text-[rgba(255,255,255,0.7)]">
                  运行中
                </div>
                <div className="mt-1 space-y-px">
                  {Object.values(backgroundTasks)
                    .filter((t) => t.status === 'running')
                    .map((task) => {
                      const elapsedMs = Date.now() - task.startedAt
                      const elapsedStr = elapsedMs < 60000
                        ? `${Math.floor(elapsedMs / 1000)}秒`
                        : elapsedMs < 3600000
                          ? `${Math.floor(elapsedMs / 60000)}分${Math.floor((elapsedMs % 60000) / 1000)}秒`
                          : `${Math.floor(elapsedMs / 3600000)}时${Math.floor((elapsedMs % 3600000) / 60000)}分`
                      return (
                        <div key={task.taskId} className="flex items-center gap-1.5 rounded-[var(--radius-xs)] px-1.5 py-1">
                          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-success)] animate-pulse-dot" />
                          <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-[rgba(255,255,255,0.92)]">
                            {task.description ?? task.workflowName ?? task.taskId}
                          </span>
                          <span className="shrink-0 text-[9px] text-[rgba(255,255,255,0.46)] tabular-nums">
                            {elapsedStr}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              if (sessionId) stopGeneration(sessionId)
                            }}
                            className="flex h-4 w-4 shrink-0 items-center justify-center rounded-[var(--radius-2xs)] text-[rgba(255,255,255,0.5)] transition-colors hover:bg-[rgba(255,255,255,0.06)] hover:text-[rgba(255,255,255,0.8)]"
                            title="停止"
                          >
                            <span className="material-symbols-outlined text-[10px]">stop</span>
                          </button>
                        </div>
                      )
                    })}
                </div>
              </>
            ) : null}

            <div className="my-2 h-px rounded-full bg-[rgba(255,255,255,0.08)]" />

            <div className="text-[10px] font-semibold text-[rgba(255,255,255,0.7)]">
              来源
            </div>
            <div className="mt-1 space-y-px">
              {sources.length > 0 ? sources.map((reference) => (
                <div
                  key={reference.id}
                  className="rounded-[var(--radius-xs)] bg-[rgba(255,255,255,0.03)] px-2 py-1.5"
                >
                  <div className="truncate text-[11px] font-medium text-[rgba(255,255,255,0.86)]">
                    {reference.name}
                  </div>
                  <div className="mt-0.5 truncate text-[9px] text-[rgba(255,255,255,0.52)]">
                    {formatReferenceLocation(reference.path, reference.lineStart, reference.lineEnd)}
                  </div>
                </div>
              )) : (
                <div className="text-[10px] font-medium text-[rgba(255,255,255,0.6)]">
                  暂无来源
                </div>
              )}
              {sources.length < references.length ? (
                <div className="text-[9px] text-[rgba(255,255,255,0.46)]">
                  还有 {references.length - sources.length} 项未显示
                </div>
              ) : null}
              {workspaceStatus?.changedFiles.length ? (
                <div className="pt-0.5">
                  <div className="mb-0.5 text-[9px] text-[rgba(255,255,255,0.46)]">
                    最近变更
                  </div>
                  <div className="space-y-px">
                    {workspaceStatus.changedFiles.slice(0, 4).map((file) => (
                      <div
                        key={file.path}
                        className="flex items-center gap-1.5 rounded-[var(--radius-xs)] bg-[rgba(255,255,255,0.025)] px-2 py-1"
                      >
                        <FolderGit2 size={11} className="shrink-0 text-[rgba(255,255,255,0.6)]" />
                        <span className="min-w-0 flex-1 truncate text-[10px] text-[rgba(255,255,255,0.76)]">
                          {getPathLeaf(file.path)}
                        </span>
                        <span className="shrink-0 text-[9px] text-[rgba(255,255,255,0.52)] tabular-nums">
                          +{file.additions} -{file.deletions}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>,
        document.body,
      ) : null}

      {gitDialogOpen && sessionId && rect ? (
        <GitActionsDialog
          sessionId={sessionId}
          anchorRect={rect}
          onClose={() => setGitDialogOpen(false)}
          branch={branchLabel}
          changeCount={changeCount}
          totalAdditions={totalAdditions}
          totalDeletions={totalDeletions}
        />
      ) : null}
    </div>
  )
}
