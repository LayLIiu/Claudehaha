import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type React from 'react'
import {
  CheckCircle2,
  ChevronDown,
  Circle,
  Ellipsis,
  Expand,
  GitBranch,
  GitCommitHorizontal,
  GitGraph,
  Plus,
  RefreshCw,
  Search,
  SquarePen,
  X,
} from 'lucide-react'
import { sessionsApi, type GitLogEntry, type RepositoryContextResult } from '../../api/sessions'
import { useTranslation } from '../../i18n'
import { useOpenTargetStore, type OpenTarget } from '../../stores/openTargetStore'
import { useWorkspacePanelStore } from '../../stores/workspacePanelStore'
import { useCLITaskStore } from '../../stores/cliTaskStore'
import { useGlassPanelAnimation } from '../../hooks/useGlassPanelAnimation'
import { TargetIcon } from '../common/TargetIcon'
import { GitActionsDialog } from './GitActionsDialog'

type Props = {
  path: string | null | undefined
  sessionId?: string | null
  variant?: 'simple' | 'environment'
  externalOpen?: boolean
  onExternalClose?: () => void
  hideTrigger?: boolean
  anchorElement?: HTMLElement | null
  simpleTargetIds?: string[]
}

type GitDialogInitialView = 'menu' | 'commit' | 'push' | 'branch'
const SIMPLE_TARGET_ORDER = ['finder', 'terminal', 'xcode']
const SIMPLE_TARGET_FALLBACKS: Record<string, Omit<OpenTarget, 'platform'>> = {
  finder: {
    id: 'finder',
    kind: 'file_manager',
    label: 'Finder',
    icon: 'finder',
  },
  terminal: {
    id: 'terminal',
    kind: 'ide',
    label: 'Terminal',
    icon: 'terminal',
  },
  xcode: {
    id: 'xcode',
    kind: 'ide',
    label: 'Xcode',
    icon: 'xcode',
  },
}

export function OpenProjectMenu({
  path,
  sessionId = null,
  variant = 'simple',
  externalOpen,
  onExternalClose,
  hideTrigger = false,
  anchorElement = null,
  simpleTargetIds,
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
  const tasks = useCLITaskStore((state) => state.tasks)
  const resetCompletedTasks = useCLITaskStore((state) => state.resetCompletedTasks)
  const [open, setOpen] = useState(false)
  const [branchPopoverOpen, setBranchPopoverOpen] = useState(false)
  const [branchSearch, setBranchSearch] = useState('')
  const [gitDialogOpen, setGitDialogOpen] = useState(false)
  const [gitDialogInitialView, setGitDialogInitialView] = useState<GitDialogInitialView>('menu')
  const [graphOpen, setGraphOpen] = useState(false)
  const [gitCommits, setGitCommits] = useState<GitLogEntry[]>([])
  const [gitLogLoading, setGitLogLoading] = useState(false)
  const [gitLogError, setGitLogError] = useState<string | null>(null)
  const [repoLoading, setRepoLoading] = useState(false)
  const [repoContext, setRepoContext] = useState<RepositoryContextResult | null>(null)
  const buttonRef = useRef<HTMLElement | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const branchButtonRef = useRef<HTMLButtonElement>(null)
  const graphDialogRef = useRef<HTMLDivElement>(null)
  const { animatingOut, requestClose: requestAnimClose } = useGlassPanelAnimation(() => {
    setOpen(false)
    setBranchPopoverOpen(false)
    onExternalClose?.()
  })

  useEffect(() => {
    if (externalOpen) setOpen(true)
  }, [externalOpen])

  const handleClose = useCallback(() => {
    requestAnimClose()
  }, [requestAnimClose])

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
      if (
        buttonRef.current?.contains(target) ||
        anchorElement?.contains(target) ||
        menuRef.current?.contains(target) ||
        graphDialogRef.current?.contains(target)
      ) {
        return
      }
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
  }, [anchorElement, handleClose, open])

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
  const simpleTargets = useMemo(
    () => {
      const orderedTargets = [...targets].sort((a, b) => {
        const aIndex = SIMPLE_TARGET_ORDER.indexOf(a.id)
        const bIndex = SIMPLE_TARGET_ORDER.indexOf(b.id)
        if (aIndex !== -1 || bIndex !== -1) {
          return (aIndex === -1 ? SIMPLE_TARGET_ORDER.length : aIndex)
            - (bIndex === -1 ? SIMPLE_TARGET_ORDER.length : bIndex)
        }
        return 0
      })

      if (!simpleTargetIds?.length) return orderedTargets

      const targetById = new Map(orderedTargets.map((target) => [target.id, target]))
      const preferredTargets = simpleTargetIds
        .map((id) => targetById.get(id) ?? (
          SIMPLE_TARGET_FALLBACKS[id]
            ? { ...SIMPLE_TARGET_FALLBACKS[id], platform: 'darwin' }
            : undefined
        ))
        .filter((target): target is typeof orderedTargets[number] => Boolean(target))

      return preferredTargets.length > 0 ? preferredTargets : orderedTargets
    },
    [simpleTargetIds, targets],
  )
  const hasMenu = simpleTargets.length > 1

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

  const openWorkspaceChanged = () => {
    if (!sessionId) return
    setWorkspaceMode(sessionId, 'workspace')
    setWorkspaceView(sessionId, 'changed')
    openWorkspacePanel(sessionId)
    void loadStatus(sessionId)
    handleClose()
  }

  const openGitDialog = (initialView: GitDialogInitialView) => {
    if (!sessionId) return
    setGitDialogInitialView(initialView)
    setGitDialogOpen(true)
  }

  const loadGitLog = useCallback(async () => {
    if (!sessionId) return
    setGitLogLoading(true)
    setGitLogError(null)
    try {
      const result = await sessionsApi.gitLog(sessionId)
      setGitCommits(result.commits)
    } catch (error) {
      setGitLogError(error instanceof Error ? error.message : '加载 Git 图谱失败')
    } finally {
      setGitLogLoading(false)
    }
  }, [sessionId])

  const openGitGraph = () => {
    if (!sessionId) return
    setGraphOpen(true)
    setBranchPopoverOpen(false)
    void loadGitLog()
  }

  if (!path || !primaryTarget) return null
  const simplePrimaryTarget = simpleTargets.find((target) => target.id === primaryTargetId) ?? simpleTargets[0] ?? primaryTarget

  const buttonLabel = hasMenu
    ? t('openProject.openProject')
    : t('openProject.openIn', { target: primaryTarget.label })

  const rect = (hideTrigger && anchorElement ? anchorElement : buttonRef.current)?.getBoundingClientRect()
  const branchRect = branchButtonRef.current?.getBoundingClientRect()
  const workspaceStatus = sessionId ? statusBySession[sessionId] : undefined
  const changeCount = workspaceStatus?.changedFiles.length ?? 0
  const totalAdditions = workspaceStatus?.changedFiles.reduce((sum, file) => sum + file.additions, 0) ?? 0
  const totalDeletions = workspaceStatus?.changedFiles.reduce((sum, file) => sum + file.deletions, 0) ?? 0
  const branchLabel = repoContext?.currentBranch || workspaceStatus?.branch || '无分支'
  const completedTaskCount = tasks.filter((task) => task.status === 'completed').length
  const activeTask = tasks.find((task) => task.status === 'in_progress')
  const taskProgressLabel = tasks.length > 0
    ? `进程 ${completedTaskCount}/${tasks.length}`
    : '进程 0/0'
  const filteredBranches = repoContext?.branches
    .filter((branch) => !branchSearch || branch.name.toLowerCase().includes(branchSearch.toLowerCase()))
    .slice(0, 18) ?? []

  if (variant === 'simple') {
    const simpleButtonLabel = hasMenu
      ? t('openProject.openProject')
      : t('openProject.openIn', { target: simplePrimaryTarget.label })

    return (
      <div className="relative flex items-center">
        <div
          ref={(node) => { buttonRef.current = node }}
          className="inline-flex h-8 overflow-hidden rounded-[13px] border border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.075)] text-[rgba(255,255,255,0.78)] shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_5px_14px_rgba(0,0,0,0.18)] backdrop-blur-xl"
        >
          <button
            type="button"
            aria-label={t('openProject.openIn', { target: simplePrimaryTarget.label })}
            title={t('openProject.openIn', { target: simplePrimaryTarget.label })}
            onClick={() => void handleOpenTarget(simplePrimaryTarget.id)}
            className="inline-flex h-full w-[42px] items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-token-focus-border,var(--color-border-focus))]"
          >
            <span className="flex h-6 w-6 items-center justify-center overflow-hidden rounded-[6px] border border-[rgba(255,255,255,0.18)] bg-[rgba(0,0,0,0.34)] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
              <TargetIcon target={simplePrimaryTarget} size={18} />
            </span>
          </button>
          {hasMenu ? (
            <button
              type="button"
              aria-label={simpleButtonLabel}
              aria-haspopup="menu"
              aria-expanded={open}
              title={simpleButtonLabel}
              onClick={() => setOpen((value) => !value)}
              className="inline-flex h-full w-[34px] items-center justify-center border-l border-[rgba(255,255,255,0.08)] bg-[rgba(0,0,0,0.18)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-token-focus-border,var(--color-border-focus))]"
            >
              <ChevronDown size={16} strokeWidth={1.9} />
            </button>
          ) : null}
        </div>

        {open && hasMenu && rect ? createPortal(
          <div
            ref={menuRef}
            role="menu"
            className={`liquid-glass glass-panel fixed z-50 w-[min(260px,calc(100vw-32px))] overflow-hidden rounded-[14px] border border-[rgba(255,255,255,0.1)] bg-[rgba(32,32,32,0.93)] p-1.5 shadow-[0_14px_42px_rgba(0,0,0,0.36)] backdrop-blur-xl ${animatingOut ? 'glass-animate-exit' : ''}`}
            style={{ top: rect.bottom + 6, right: Math.max(12, window.innerWidth - rect.right) }}
          >
            {simpleTargets.map((target) => (
              <button
                key={target.id}
                type="button"
                role="menuitem"
                onClick={() => void handleOpenTarget(target.id)}
                className="flex h-9 w-full items-center gap-2.5 rounded-[8px] px-2.5 text-left text-[14px] font-medium leading-5 text-[rgba(255,255,255,0.9)] transition-colors hover:bg-[rgba(255,255,255,0.055)] focus-visible:bg-[rgba(255,255,255,0.055)]"
              >
                <span className="flex h-5 w-5 items-center justify-center text-[var(--color-token-text-secondary)]">
                  <TargetIcon target={target} size={18} />
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

  const trigger = hideTrigger ? null : (
    <button
      ref={(node) => { buttonRef.current = node }}
      type="button"
      aria-label={buttonLabel}
      aria-haspopup="dialog"
      aria-expanded={open}
      title={buttonLabel}
      onClick={() => setOpen((value) => !value)}
      className={`inline-flex h-7 w-7 items-center justify-center rounded-[var(--radius-sm)] transition-colors spring-bounce-btn focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-token-focus-border,var(--color-border-focus))] ${open ? 'bg-[var(--color-surface)] text-[var(--color-token-foreground)] shadow-[0_8px_18px_rgba(0,0,0,0.12)]' : 'text-[var(--color-token-text-secondary)] hover:bg-[var(--color-surface)] hover:text-[var(--color-token-foreground)]'}`}
    >
      <TargetIcon target={primaryTarget} size={17} />
    </button>
  )

  return (
    <div className={hideTrigger ? 'contents' : 'relative flex items-center'}>
      {trigger}

      {open && rect ? createPortal(
        <div
          ref={menuRef}
          role="dialog"
          aria-label="Git 工具"
          className={`liquid-glass glass-panel fixed z-[340] w-[min(320px,calc(100vw-32px))] overflow-hidden rounded-[18px] border border-[rgba(255,255,255,0.12)] bg-[rgba(28,28,30,0.93)] p-3 shadow-[0_18px_56px_rgba(0,0,0,0.36)] backdrop-blur-xl ${animatingOut ? 'glass-animate-exit' : ''}`}
          style={{
            top: rect.bottom + 8,
            right: 14,
          }}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0 text-[15px] font-semibold leading-5 text-[rgba(255,255,255,0.92)]">Git 工具</div>
            <div className="flex items-center gap-1">
              <IconButton label="Git 操作" onClick={() => openGitDialog('menu')}>
                <Ellipsis size={18} />
              </IconButton>
              <IconButton label="打开 Git 图谱" onClick={openGitGraph}>
                <Expand size={17} />
              </IconButton>
            </div>
          </div>

          <div className="mt-2.5 space-y-1">
            <ToolRow
              icon={<SquarePen size={15} />}
              label="更改"
              detail={changeCount > 0 ? <><span className="text-[#31d873]">+{totalAdditions.toLocaleString()}</span> <span className="text-[#ff4f57]">-{totalDeletions.toLocaleString()}</span></> : <span className="text-[rgba(255,255,255,0.48)]">无变更</span>}
              onClick={openWorkspaceChanged}
              disabled={!sessionId}
            />

            <button
              ref={branchButtonRef}
              type="button"
              disabled={repoContext?.state !== 'ok' || repoLoading}
              onClick={() => setBranchPopoverOpen((value) => !value)}
              className="flex h-9 w-full items-center gap-2 rounded-[10px] px-2 text-left transition-colors hover:bg-[rgba(255,255,255,0.06)] disabled:cursor-default disabled:opacity-70 disabled:hover:bg-transparent"
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center text-[rgba(255,255,255,0.82)]">
                <GitBranch size={15} />
              </span>
              <span className="min-w-0 flex-1 truncate text-[13px] font-semibold leading-5 text-[rgba(255,255,255,0.9)]">
                {repoLoading ? '加载分支中…' : branchLabel}
              </span>
              <ChevronDown size={14} className={`shrink-0 text-[rgba(255,255,255,0.52)] transition-transform ${branchPopoverOpen ? 'rotate-180' : ''}`} />
            </button>

            <div className="flex h-9 items-center gap-2 rounded-[10px] px-2 transition-colors hover:bg-[rgba(255,255,255,0.06)]">
              <button
                type="button"
                disabled={!sessionId}
                onClick={() => openGitDialog('commit')}
                className="flex min-w-0 flex-1 items-center gap-2 text-left disabled:cursor-default disabled:opacity-70"
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center text-[rgba(255,255,255,0.82)]">
                  <GitCommitHorizontal size={15} />
                </span>
                <span className="min-w-0 flex-1 truncate text-[13px] font-semibold leading-5 text-[rgba(255,255,255,0.9)]">提交</span>
              </button>
              <button
                type="button"
                disabled={!sessionId}
                onClick={() => openGitDialog('menu')}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] text-[rgba(255,255,255,0.56)] transition-colors hover:bg-[rgba(255,255,255,0.07)] hover:text-[rgba(255,255,255,0.9)] disabled:cursor-default disabled:opacity-45"
                aria-label="更多 Git 操作"
              >
                <Ellipsis size={15} />
              </button>
            </div>
          </div>

          <div className="my-2.5 h-px rounded-full bg-[rgba(255,255,255,0.09)]" />

          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-[13px] font-semibold leading-5 text-[rgba(255,255,255,0.86)]">{taskProgressLabel}</div>
              {activeTask ? (
                <div className="truncate text-[11px] leading-4 text-[rgba(255,255,255,0.42)]">
                  当前第 {tasks.findIndex((task) => task.id === activeTask.id) + 1} 步
                </div>
              ) : null}
            </div>
            {tasks.length > 0 && tasks.every((task) => task.status === 'completed') ? (
              <IconButton label="清空已完成任务" onClick={() => { void resetCompletedTasks(sessionId ?? undefined) }}>
                <X size={16} />
              </IconButton>
            ) : null}
          </div>

          <div className="mt-2 space-y-0.5">
            {tasks.length > 0 ? tasks.map((task, index) => {
              const isCompleted = task.status === 'completed'
              const isActive = task.status === 'in_progress'
              return (
                <div key={task.id} className="flex min-h-7 items-center gap-1.5 rounded-[8px] px-1.5 py-1">
                  {isCompleted ? (
                    <CheckCircle2 size={13} className="shrink-0 text-[var(--color-success)]" />
                  ) : (
                    <Circle size={13} className={`shrink-0 ${isActive ? 'text-[var(--color-warning)]' : 'text-[rgba(255,255,255,0.34)]'}`} />
                  )}
                  <span className="shrink-0 text-[11px] font-medium tabular-nums text-[rgba(255,255,255,0.38)]">
                    {index + 1}
                  </span>
                  <span className={`min-w-0 flex-1 truncate text-[11px] leading-4 ${isCompleted ? 'text-[rgba(255,255,255,0.44)] line-through' : 'text-[rgba(255,255,255,0.86)]'}`}>
                    {task.subject}
                  </span>
                  {isActive && task.activeForm ? (
                    <span className="max-w-[120px] truncate text-[11px] text-[var(--color-warning)]">
                      {task.activeForm}
                    </span>
                  ) : null}
                </div>
              )
            }) : (
              <div className="rounded-[8px] px-1.5 py-1.5 text-[11px] text-[rgba(255,255,255,0.42)]">暂无任务</div>
            )}
          </div>

        </div>,
        document.body,
      ) : null}

      {branchPopoverOpen && branchRect ? createPortal(
        <div
          className="liquid-glass glass-panel fixed z-[350] w-[min(280px,calc(100vw-32px))] overflow-hidden rounded-[16px] border border-[rgba(255,255,255,0.11)] bg-[rgba(28,28,30,0.94)] p-2.5 shadow-[0_18px_56px_rgba(0,0,0,0.38)] backdrop-blur-xl"
          style={{
            top: Math.max(12, branchRect.top - 22),
            left: Math.max(12, branchRect.left - 292),
          }}
        >
          <div className="flex h-8 items-center gap-2 rounded-[10px] border border-[rgba(255,255,255,0.08)] bg-[rgba(0,0,0,0.18)] px-2.5">
            <Search size={13} className="shrink-0 text-[rgba(255,255,255,0.42)]" />
            <input
              type="text"
              value={branchSearch}
              onChange={(event) => setBranchSearch(event.target.value)}
              placeholder="搜索"
              className="min-w-0 flex-1 bg-transparent text-[12px] text-[rgba(255,255,255,0.9)] placeholder:text-[rgba(255,255,255,0.36)] outline-none"
            />
          </div>

          <div className="mt-2 rounded-[12px] bg-[rgba(255,255,255,0.055)] p-2.5">
            <div className="flex items-center gap-2 text-[12px] font-semibold text-[rgba(255,255,255,0.9)]">
              <GitBranch size={14} />
              <span className="min-w-0 flex-1 truncate">{branchLabel}</span>
              <span className="rounded-full bg-[rgba(255,255,255,0.1)] px-1.5 py-0.5 text-[10px] text-[rgba(255,255,255,0.58)]">当前</span>
            </div>
          </div>

          <div className="mt-1.5 max-h-[180px] space-y-0.5 overflow-y-auto">
            {filteredBranches.map((branch) => (
              <div key={branch.name} className="flex h-7 items-center gap-2 rounded-[8px] px-2 text-[11px] text-[rgba(255,255,255,0.72)]">
                <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${branch.current ? 'bg-[var(--color-success)]' : 'bg-[rgba(255,255,255,0.24)]'}`} />
                <span className="min-w-0 flex-1 truncate">{branch.name}</span>
              </div>
            ))}
            {filteredBranches.length === 0 ? (
              <div className="px-2 py-2 text-[11px] text-[rgba(255,255,255,0.42)]">无匹配分支</div>
            ) : null}
          </div>

          <div className="mt-1.5 border-t border-[rgba(255,255,255,0.08)] pt-1.5">
            <BranchAction icon={<Plus size={14} />} label="创建并检出新分支" onClick={() => openGitDialog('branch')} />
            <BranchAction icon={<GitGraph size={14} />} label="Git 图谱" onClick={openGitGraph} />
          </div>
        </div>,
        document.body,
      ) : null}

      {graphOpen ? createPortal(
        <div className="fixed inset-0 z-[370] flex items-center justify-center bg-[rgba(0,0,0,0.42)] px-4 backdrop-blur-[14px]">
          <div
            ref={graphDialogRef}
            role="dialog"
            aria-label="Git 图谱"
            className="liquid-glass glass-panel w-[min(760px,calc(100vw-32px))] max-h-[min(560px,calc(100vh-48px))] overflow-hidden rounded-[18px] border border-[rgba(255,255,255,0.11)] bg-[rgba(28,28,30,0.94)] shadow-[0_24px_72px_rgba(0,0,0,0.46)]"
          >
            <div className="flex items-center justify-between gap-2 border-b border-[rgba(255,255,255,0.08)] px-4 py-3">
              <div className="text-[15px] font-semibold text-[rgba(255,255,255,0.92)]">Git 图谱</div>
              <div className="flex items-center gap-1">
                <IconButton label="刷新 Git 图谱" onClick={() => void loadGitLog()}>
                  <RefreshCw size={16} className={gitLogLoading ? 'animate-spin' : ''} />
                </IconButton>
                <IconButton label="关闭 Git 图谱" onClick={() => setGraphOpen(false)}>
                  <X size={17} />
                </IconButton>
              </div>
            </div>
            <div className="max-h-[488px] overflow-auto p-3">
              <div className="grid grid-cols-[44px_minmax(180px,1fr)_96px_104px_76px] gap-2 border-b border-[rgba(255,255,255,0.08)] px-2 pb-2 text-[11px] font-semibold text-[rgba(255,255,255,0.42)]">
                <span>图</span>
                <span>描述</span>
                <span>日期</span>
                <span>作者</span>
                <span>提交</span>
              </div>
              {gitLogLoading && gitCommits.length === 0 ? (
                <div className="px-2 py-6 text-center text-[12px] text-[rgba(255,255,255,0.46)]">加载中…</div>
              ) : gitLogError ? (
                <div className="px-2 py-6 text-center text-[12px] text-[var(--color-danger)]">{gitLogError}</div>
              ) : gitCommits.length > 0 ? (
                <div className="divide-y divide-[rgba(255,255,255,0.06)]">
                  {gitCommits.map((commit, index) => (
                    <div key={commit.hash} className="grid min-h-10 grid-cols-[44px_minmax(180px,1fr)_96px_104px_76px] items-center gap-2 px-2 text-[11px]">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-[var(--color-success)]" />
                        <span className="h-6 w-px bg-[rgba(255,255,255,0.16)]" style={{ opacity: index === gitCommits.length - 1 ? 0 : 1 }} />
                      </div>
                      <div className="min-w-0">
                        <div className="truncate font-medium text-[rgba(255,255,255,0.88)]">{commit.subject}</div>
                        {commit.refs.length > 0 ? (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {commit.refs.slice(0, 3).map((ref) => (
                              <span key={ref} className="rounded-full bg-[rgba(255,255,255,0.09)] px-1.5 py-0.5 text-[10px] text-[rgba(255,255,255,0.55)]">
                                {ref}
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </div>
                      <span className="truncate text-[rgba(255,255,255,0.55)]">{commit.date}</span>
                      <span className="truncate text-[rgba(255,255,255,0.68)]">{commit.author}</span>
                      <span className="font-mono text-[rgba(255,255,255,0.58)]">{commit.shortHash}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="px-2 py-6 text-center text-[12px] text-[rgba(255,255,255,0.46)]">暂无提交记录</div>
              )}
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
          initialView={gitDialogInitialView}
        />
      ) : null}
    </div>
  )
}

function IconButton({ label, children, onClick }: { label: string; children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] text-[rgba(255,255,255,0.56)] transition-colors hover:bg-[rgba(255,255,255,0.07)] hover:text-[rgba(255,255,255,0.9)]"
    >
      {children}
    </button>
  )
}

function ToolRow({
  icon,
  label,
  detail,
  disabled,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  detail: React.ReactNode
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="flex h-9 w-full items-center gap-2 rounded-[10px] px-2 text-left transition-colors hover:bg-[rgba(255,255,255,0.06)] disabled:cursor-default disabled:opacity-70 disabled:hover:bg-transparent"
    >
      <span className="flex h-6 w-6 shrink-0 items-center justify-center text-[rgba(255,255,255,0.82)]">{icon}</span>
      <span className="min-w-0 flex-1 truncate text-[13px] font-semibold leading-5 text-[rgba(255,255,255,0.9)]">{label}</span>
      <span className="shrink-0 text-[12px] font-medium tabular-nums">{detail}</span>
    </button>
  )
}

function BranchAction({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-8 w-full items-center gap-2 rounded-[9px] px-2 text-left text-[12px] font-semibold text-[rgba(255,255,255,0.84)] transition-colors hover:bg-[rgba(255,255,255,0.06)]"
    >
      <span className="flex h-5 w-5 shrink-0 items-center justify-center text-[rgba(255,255,255,0.68)]">{icon}</span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
    </button>
  )
}
