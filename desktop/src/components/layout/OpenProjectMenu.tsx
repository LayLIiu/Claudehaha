import { useEffect, useMemo, useRef, useState } from 'react'
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
import { useOpenTargetStore } from '../../stores/openTargetStore'
import { useTerminalPanelStore } from '../../stores/terminalPanelStore'
import { useWorkspaceChatContextStore } from '../../stores/workspaceChatContextStore'
import { useWorkspacePanelStore } from '../../stores/workspacePanelStore'
import { TargetIcon } from '../common/TargetIcon'

type Props = {
  path: string | null | undefined
  sessionId?: string | null
  variant?: 'simple' | 'environment'
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
  const [open, setOpen] = useState(false)
  const [targetsExpanded, setTargetsExpanded] = useState(false)
  const [branchesExpanded, setBranchesExpanded] = useState(false)
  const [repoLoading, setRepoLoading] = useState(false)
  const [repoContext, setRepoContext] = useState<RepositoryContextResult | null>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

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
      setOpen(false)
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
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
      if (variant === 'simple') setOpen(false)
    }
  }

  if (!path || !primaryTarget) return null

  const buttonLabel = hasMenu
    ? t('openProject.openProject')
    : t('openProject.openIn', { target: primaryTarget.label })

  const rect = buttonRef.current?.getBoundingClientRect()
  const workspaceStatus = sessionId ? statusBySession[sessionId] : undefined
  const changeCount = workspaceStatus?.changedFiles.length ?? 0
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
          className={`inline-flex h-8 items-center justify-center gap-1 rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface-container-lowest)] text-[var(--color-text-tertiary)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-border-focus)] ${
            hasMenu
              ? 'min-w-[2.75rem] px-2 hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]'
              : 'w-8 hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]'
          }`}
        >
          <TargetIcon target={primaryTarget} />
          {hasMenu && <ChevronDown size={14} strokeWidth={1.9} />}
        </button>

        {open && hasMenu && rect ? createPortal(
          <div
            ref={menuRef}
            role="menu"
            className="fixed z-50 min-w-[220px] overflow-hidden rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface)] py-1 shadow-[var(--shadow-dropdown)]"
            style={{ top: rect.bottom + 6, right: Math.max(12, window.innerWidth - rect.right) }}
          >
            {targets.map((target) => (
              <button
                key={target.id}
                type="button"
                role="menuitem"
                onClick={() => void handleOpenTarget(target.id)}
                className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm font-medium text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-surface-hover)] focus-visible:outline-none focus-visible:bg-[var(--color-surface-hover)]"
              >
                <span className="flex h-7 w-7 items-center justify-center text-[var(--color-text-secondary)]">
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
        className="inline-flex h-7 w-7 items-center justify-center rounded-[8px] text-[var(--color-text-tertiary)] transition-colors hover:bg-[var(--color-surface)] hover:text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-border-focus)]"
      >
        <TargetIcon target={primaryTarget} size={17} />
      </button>

      {open && rect ? createPortal(
        <div
          ref={menuRef}
          role="dialog"
          aria-label="环境信息"
          className="fixed z-[340] w-[min(630px,calc(100vw-32px))] overflow-hidden rounded-[32px] border border-[rgba(255,255,255,0.1)] bg-[rgba(48,48,50,0.94)] shadow-[0_26px_90px_rgba(0,0,0,0.45)] backdrop-blur-[24px]"
          style={{
            top: rect.bottom + 12,
            right: Math.max(16, window.innerWidth - rect.right),
          }}
        >
          <div className="px-8 pb-8 pt-8">
            <div className="flex items-start justify-between gap-3">
              <div className="text-[17px] font-semibold tracking-[-0.02em] text-[rgba(255,255,255,0.88)]">
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
                  setOpen(false)
                }}
                className="inline-flex h-8 w-8 items-center justify-center rounded-[12px] text-[rgba(255,255,255,0.7)] transition-colors hover:bg-[rgba(255,255,255,0.06)] hover:text-[rgba(255,255,255,0.95)]"
                title="打开工作区"
              >
                <Plus size={22} />
              </button>
            </div>

            <div className="mt-6 space-y-4">
              <button
                type="button"
                onClick={() => {
                  if (!sessionId) return
                  setWorkspaceMode(sessionId, 'workspace')
                  setWorkspaceView(sessionId, 'changed')
                  openWorkspacePanel(sessionId)
                  void loadStatus(sessionId)
                  setOpen(false)
                }}
                className="flex w-full items-center gap-4 rounded-[14px] px-2 py-1 text-left transition-colors hover:bg-[rgba(255,255,255,0.04)]"
              >
                <SquarePen size={28} className="shrink-0 text-[rgba(255,255,255,0.9)]" />
                <span className="flex min-w-0 flex-1 items-center gap-3">
                  <span className="text-[18px] font-semibold text-[rgba(255,255,255,0.96)]">变更</span>
                  <span className="rounded-full bg-[rgba(255,255,255,0.08)] px-2.5 py-0.5 text-[12px] text-[rgba(255,255,255,0.68)]">
                    {changeCount}
                  </span>
                </span>
              </button>

              <div>
                <button
                  type="button"
                  onClick={() => {
                    if (hasMenu) {
                      setTargetsExpanded((value) => !value)
                      return
                    }
                    void handleOpenTarget(primaryTarget.id)
                  }}
                  className="flex w-full items-center gap-4 rounded-[14px] px-2 py-1 text-left transition-colors hover:bg-[rgba(255,255,255,0.04)]"
                >
                  <FolderOpen size={28} className="shrink-0 text-[rgba(255,255,255,0.9)]" />
                  <span className="min-w-0 flex-1 truncate text-[18px] font-semibold text-[rgba(255,255,255,0.96)]">
                    {localLabel}
                  </span>
                  {hasMenu ? <ChevronDown size={18} className={`shrink-0 text-[rgba(255,255,255,0.7)] transition-transform ${targetsExpanded ? 'rotate-180' : ''}`} /> : null}
                </button>

                {targetsExpanded ? (
                  <div className="ml-11 mt-2 space-y-1">
                    {targets.map((target) => (
                      <button
                        key={target.id}
                        type="button"
                        onClick={() => void handleOpenTarget(target.id)}
                        className="flex w-full items-center gap-3 rounded-[12px] px-3 py-2 text-left transition-colors hover:bg-[rgba(255,255,255,0.04)]"
                      >
                        <span className="flex h-6 w-6 items-center justify-center text-[rgba(255,255,255,0.8)]">
                          <TargetIcon target={target} size={18} />
                        </span>
                        <span className="min-w-0 flex-1 truncate text-[14px] text-[rgba(255,255,255,0.76)]">
                          {target.label}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>

              <div>
                <button
                  type="button"
                  disabled={repoContext?.state !== 'ok' || (repoContext?.branches.length ?? 0) === 0}
                  onClick={() => setBranchesExpanded((value) => !value)}
                  className="flex w-full items-center gap-4 rounded-[14px] px-2 py-1 text-left transition-colors hover:bg-[rgba(255,255,255,0.04)] disabled:cursor-default disabled:opacity-70 disabled:hover:bg-transparent"
                >
                  <GitBranch size={28} className="shrink-0 text-[rgba(255,255,255,0.9)]" />
                  <span className="min-w-0 flex-1 truncate text-[18px] font-semibold text-[rgba(255,255,255,0.96)]">
                    {repoLoading ? '加载分支中…' : branchLabel}
                  </span>
                  {(repoContext?.branches.length ?? 0) > 0 ? <ChevronDown size={18} className={`shrink-0 text-[rgba(255,255,255,0.7)] transition-transform ${branchesExpanded ? 'rotate-180' : ''}`} /> : null}
                </button>

                {branchesExpanded && repoContext?.state === 'ok' ? (
                  <div className="ml-11 mt-2 max-h-[180px] space-y-1 overflow-y-auto">
                    {repoContext.branches.slice(0, 12).map((branch) => (
                      <div
                        key={branch.name}
                        className="flex items-center gap-3 rounded-[12px] px-3 py-2"
                      >
                        <span className={`h-2 w-2 rounded-full ${branch.current ? 'bg-[rgba(255,255,255,0.86)]' : 'bg-[rgba(255,255,255,0.18)]'}`} />
                        <span className="min-w-0 flex-1 truncate text-[14px] text-[rgba(255,255,255,0.76)]">
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
                onClick={() => {
                  if (!sessionId) return
                  useTerminalPanelStore.getState().openPanel(sessionId)
                  setOpen(false)
                }}
                className="flex w-full items-center gap-4 rounded-[14px] px-2 py-1 text-left transition-colors hover:bg-[rgba(255,255,255,0.04)] disabled:cursor-default disabled:opacity-70 disabled:hover:bg-transparent"
              >
                <GitCommitHorizontal size={28} className="shrink-0 text-[rgba(255,255,255,0.9)]" />
                <span className="min-w-0 flex-1 truncate text-[18px] font-semibold text-[rgba(255,255,255,0.96)]">
                  提交或推送
                </span>
              </button>

              <div className="flex items-center gap-4 rounded-[14px] px-2 py-1 opacity-80">
                <Github size={28} className="shrink-0 text-[rgba(255,255,255,0.6)]" />
                <span className="min-w-0 flex-1 truncate text-[18px] font-semibold text-[rgba(255,255,255,0.6)]">
                  GitHub CLI 不可用
                </span>
              </div>
            </div>

            <div className="my-7 h-px rounded-full bg-[rgba(255,255,255,0.08)]" />

            <div className="text-[17px] font-semibold tracking-[-0.02em] text-[rgba(255,255,255,0.7)]">
              来源
            </div>
            <div className="mt-4 space-y-2">
              {sources.length > 0 ? sources.map((reference) => (
                <div
                  key={reference.id}
                  className="rounded-[14px] bg-[rgba(255,255,255,0.03)] px-4 py-3"
                >
                  <div className="truncate text-[14px] font-medium text-[rgba(255,255,255,0.86)]">
                    {reference.name}
                  </div>
                  <div className="mt-1 truncate text-[12px] text-[rgba(255,255,255,0.52)]">
                    {formatReferenceLocation(reference.path, reference.lineStart, reference.lineEnd)}
                  </div>
                </div>
              )) : (
                <div className="text-[16px] font-medium text-[rgba(255,255,255,0.6)]">
                  暂无来源
                </div>
              )}
              {sources.length < references.length ? (
                <div className="text-[12px] text-[rgba(255,255,255,0.46)]">
                  还有 {references.length - sources.length} 项未显示
                </div>
              ) : null}
              {workspaceStatus?.changedFiles.length ? (
                <div className="pt-2">
                  <div className="mb-2 text-[12px] text-[rgba(255,255,255,0.46)]">
                    最近变更
                  </div>
                  <div className="space-y-1.5">
                    {workspaceStatus.changedFiles.slice(0, 4).map((file) => (
                      <div
                        key={file.path}
                        className="flex items-center gap-3 rounded-[12px] bg-[rgba(255,255,255,0.025)] px-3 py-2"
                      >
                        <FolderGit2 size={16} className="shrink-0 text-[rgba(255,255,255,0.6)]" />
                        <span className="min-w-0 flex-1 truncate text-[13px] text-[rgba(255,255,255,0.76)]">
                          {getPathLeaf(file.path)}
                        </span>
                        <span className="shrink-0 text-[12px] text-[rgba(255,255,255,0.52)] tabular-nums">
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
    </div>
  )
}
