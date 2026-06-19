import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { sessionsApi } from '../../api/sessions'
import { useUIStore } from '../../stores/uiStore'
import { useWorkspacePanelStore } from '../../stores/workspacePanelStore'

type GitDialogView = 'menu' | 'commit' | 'push' | 'branch'

type GitActionsDialogProps = {
  sessionId: string
  anchorRect: DOMRect
  onClose: () => void
  /** Current branch name from repo context. */
  branch: string
  /** Changed file count. */
  changeCount: number
  /** Total additions across all changed files. */
  totalAdditions: number
  /** Total deletions across all changed files. */
  totalDeletions: number
}

export function GitActionsDialog({
  sessionId,
  anchorRect,
  onClose,
  branch,
  changeCount,
  totalAdditions,
  totalDeletions,
}: GitActionsDialogProps) {
  const [view, setView] = useState<GitDialogView>('menu')
  const [commitMessage, setCommitMessage] = useState('')
  const [committing, setCommitting] = useState(false)
  const [pushing, setPushing] = useState(false)
  const [branchName, setBranchName] = useState('')
  const [creatingBranch, setCreatingBranch] = useState(false)
  const [syncStatus, setSyncStatus] = useState<{
    branch: string | null
    remoteBranch: string | null
    ahead: number
    behind: number
  } | null>(null)
  const [loadingSync, setLoadingSync] = useState(false)
  const dialogRef = useRef<HTMLDivElement>(null)
  const loadStatus = useWorkspacePanelStore((state) => state.loadStatus)
  const addToast = useUIStore((state) => state.addToast)

  // Close on click-away / Escape
  useEffect(() => {
    const handleMouseDown = (event: MouseEvent) => {
      if (dialogRef.current?.contains(event.target as Node)) return
      onClose()
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (view !== 'menu') {
          setView('menu')
        } else {
          onClose()
        }
      }
    }
    // Delay to avoid the same click that opened the dialog
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleMouseDown)
      document.addEventListener('keydown', handleKeyDown)
    }, 0)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('mousedown', handleMouseDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose, view])

  // Fetch sync status when push view is opened
  useEffect(() => {
    if (view !== 'push') return
    if (syncStatus) return
    setLoadingSync(true)
    sessionsApi.gitSyncStatus(sessionId)
      .then(setSyncStatus)
      .catch(() => {})
      .finally(() => setLoadingSync(false))
  }, [view, sessionId, syncStatus])

  const handleCommit = useCallback(async () => {
    setCommitting(true)
    try {
      const result = await sessionsApi.gitCommit(sessionId, commitMessage.trim() || undefined)
      if (result.success) {
        addToast({ type: 'success', message: result.hash ? `已提交 ${result.hash}` : '提交成功' })
        void loadStatus(sessionId)
        onClose()
      } else {
        addToast({ type: 'error', message: result.error ?? '提交失败' })
      }
    } catch (error) {
      addToast({ type: 'error', message: error instanceof Error ? error.message : '提交失败' })
    } finally {
      setCommitting(false)
    }
  }, [commitMessage, sessionId, loadStatus, onClose, addToast])

  const handlePush = useCallback(async () => {
    setPushing(true)
    try {
      const result = await sessionsApi.gitPush(sessionId)
      if (result.success) {
        addToast({ type: 'success', message: '推送成功' })
      } else {
        addToast({ type: 'error', message: result.error ?? '推送失败' })
      }
    } catch (error) {
      addToast({ type: 'error', message: error instanceof Error ? error.message : '推送失败' })
    } finally {
      setPushing(false)
    }
  }, [sessionId, addToast])

  const handleCreateBranch = useCallback(async () => {
    if (!branchName.trim()) return
    setCreatingBranch(true)
    try {
      const result = await sessionsApi.gitCreateBranch(sessionId, branchName.trim())
      if (result.success) {
        addToast({ type: 'success', message: `已创建并切换到分支 ${branchName.trim()}` })
        void loadStatus(sessionId)
        onClose()
      } else {
        addToast({ type: 'error', message: result.error ?? '创建分支失败' })
      }
    } catch (error) {
      addToast({ type: 'error', message: error instanceof Error ? error.message : '创建分支失败' })
    } finally {
      setCreatingBranch(false)
    }
  }, [branchName, sessionId, loadStatus, onClose, addToast])

  const dialogStyle = {
    top: anchorRect.bottom + 6,
    right: Math.max(12, window.innerWidth - anchorRect.right),
  }

  const renderMenu = () => (
    <>
      <div className="px-3 py-2.5 text-[12px] font-semibold text-[rgba(255,255,255,0.88)]">
        Git 操作
      </div>
      <div className="px-1.5 pb-1.5 space-y-0.5">
        <button
          type="button"
          onClick={() => setView('commit')}
          className="flex w-full items-center gap-2.5 rounded-[var(--radius-sm)] px-2.5 py-2 text-left transition-colors hover:bg-[rgba(255,255,255,0.06)]"
        >
          <span className="material-symbols-outlined text-[16px] text-[rgba(255,255,255,0.7)]">commit</span>
          <div className="min-w-0 flex-1">
            <div className="text-[12px] font-medium text-[rgba(255,255,255,0.92)]">提交更改</div>
            <div className="text-[10px] text-[rgba(255,255,255,0.5)]">将未提交的更改保存为一次提交</div>
          </div>
          <span className="material-symbols-outlined text-[14px] text-[rgba(255,255,255,0.3)]">chevron_right</span>
        </button>
        <button
          type="button"
          onClick={() => setView('push')}
          className="flex w-full items-center gap-2.5 rounded-[var(--radius-sm)] px-2.5 py-2 text-left transition-colors hover:bg-[rgba(255,255,255,0.06)]"
        >
          <span className="material-symbols-outlined text-[16px] text-[rgba(255,255,255,0.7)]">upload</span>
          <div className="min-w-0 flex-1">
            <div className="text-[12px] font-medium text-[rgba(255,255,255,0.92)]">推送更改</div>
            <div className="text-[10px] text-[rgba(255,255,255,0.5)]">将本地提交推送到远程仓库</div>
          </div>
          <span className="material-symbols-outlined text-[14px] text-[rgba(255,255,255,0.3)]">chevron_right</span>
        </button>
        <button
          type="button"
          onClick={() => setView('branch')}
          className="flex w-full items-center gap-2.5 rounded-[var(--radius-sm)] px-2.5 py-2 text-left transition-colors hover:bg-[rgba(255,255,255,0.06)]"
        >
          <span className="material-symbols-outlined text-[16px] text-[rgba(255,255,255,0.7)]">call_split</span>
          <div className="min-w-0 flex-1">
            <div className="text-[12px] font-medium text-[rgba(255,255,255,0.92)]">创建分支</div>
            <div className="text-[10px] text-[rgba(255,255,255,0.5)]">基于当前 HEAD 创建并切换到新分支</div>
          </div>
          <span className="material-symbols-outlined text-[14px] text-[rgba(255,255,255,0.3)]">chevron_right</span>
        </button>
      </div>
    </>
  )

  const renderCommit = () => (
    <>
      <div className="flex items-center gap-2 px-3 py-2.5">
        <button
          type="button"
          onClick={() => setView('menu')}
          className="flex h-5 w-5 items-center justify-center rounded-[var(--radius-2xs)] text-[rgba(255,255,255,0.6)] transition-colors hover:bg-[rgba(255,255,255,0.06)] hover:text-[rgba(255,255,255,0.9)]"
        >
          <span className="material-symbols-outlined text-[14px]">arrow_back</span>
        </button>
        <div className="text-[12px] font-semibold text-[rgba(255,255,255,0.88)]">提交更改</div>
      </div>
      <div className="px-3 pb-3 space-y-3">
        <p className="text-[10px] leading-4 text-[rgba(255,255,255,0.5)]">
          将当前 workspace 内的未提交更改保存为一次提交。
        </p>

        <div className="space-y-1.5">
          <InfoRow label="当前分支" value={branch || '—'} />
          <InfoRow
            label="更改"
            value={
              changeCount > 0
                ? `${changeCount} 个文件  +${totalAdditions.toLocaleString()}  -${totalDeletions.toLocaleString()}`
                : '无变更'
            }
          />
        </div>

        <div>
          <label className="mb-1 block text-[10px] font-medium text-[rgba(255,255,255,0.65)]">
            提交消息
          </label>
          <textarea
            value={commitMessage}
            onChange={(event) => setCommitMessage(event.target.value)}
            placeholder="留空以自动生成提交消息"
            rows={3}
            className="w-full resize-none rounded-[var(--radius-xs)] border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.04)] px-2.5 py-1.5 text-[11px] leading-4 text-[rgba(255,255,255,0.92)] placeholder:text-[rgba(255,255,255,0.3)] focus:outline-none focus:ring-1 focus:ring-[rgba(255,255,255,0.18)]"
            onKeyDown={(event) => {
              if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
                event.preventDefault()
                if (!committing) void handleCommit()
              }
            }}
          />
          <p className="mt-1 text-[9px] text-[rgba(255,255,255,0.35)]">
            留空时会使用当前模型生成 Conventional Commit 提交消息。
          </p>
        </div>

        <button
          type="button"
          disabled={committing || changeCount === 0}
          onClick={() => void handleCommit()}
          className="flex h-7 w-full items-center justify-center gap-1.5 rounded-[var(--radius-sm)] bg-[rgba(255,255,255,0.12)] text-[11px] font-semibold text-[rgba(255,255,255,0.92)] transition-colors hover:bg-[rgba(255,255,255,0.18)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {committing ? (
            <span className="material-symbols-outlined text-[13px] animate-spin">progress_activity</span>
          ) : (
            <span className="material-symbols-outlined text-[13px]">check</span>
          )}
          提交
        </button>
      </div>
    </>
  )

  const renderPush = () => (
    <>
      <div className="flex items-center gap-2 px-3 py-2.5">
        <button
          type="button"
          onClick={() => setView('menu')}
          className="flex h-5 w-5 items-center justify-center rounded-[var(--radius-2xs)] text-[rgba(255,255,255,0.6)] transition-colors hover:bg-[rgba(255,255,255,0.06)] hover:text-[rgba(255,255,255,0.9)]"
        >
          <span className="material-symbols-outlined text-[14px]">arrow_back</span>
        </button>
        <div className="text-[12px] font-semibold text-[rgba(255,255,255,0.88)]">推送更改</div>
      </div>
      <div className="px-3 pb-3 space-y-3">
        <p className="text-[10px] leading-4 text-[rgba(255,255,255,0.5)]">
          首次推送会把当前分支发布到远程并设置 upstream。
        </p>

        <div className="space-y-1.5">
          <InfoRow label="分支" value={branch || '—'} />
          <InfoRow
            label="远程分支"
            value={loadingSync ? '加载中…' : syncStatus?.remoteBranch ?? '首次推送会自动为当前分支建立上游分支。'}
          />
          <InfoRow
            label="同步状态"
            value={
              loadingSync
                ? '加载中…'
                : syncStatus
                  ? `领先 ${syncStatus.ahead} / 落后 ${syncStatus.behind}`
                  : '—'
            }
          />
        </div>

        <button
          type="button"
          disabled={pushing}
          onClick={() => void handlePush()}
          className="flex h-7 w-full items-center justify-center gap-1.5 rounded-[var(--radius-sm)] bg-[rgba(255,255,255,0.12)] text-[11px] font-semibold text-[rgba(255,255,255,0.92)] transition-colors hover:bg-[rgba(255,255,255,0.18)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pushing ? (
            <span className="material-symbols-outlined text-[13px] animate-spin">progress_activity</span>
          ) : (
            <span className="material-symbols-outlined text-[13px]">upload</span>
          )}
          推送
        </button>
      </div>
    </>
  )

  const renderBranch = () => (
    <>
      <div className="flex items-center gap-2 px-3 py-2.5">
        <button
          type="button"
          onClick={() => setView('menu')}
          className="flex h-5 w-5 items-center justify-center rounded-[var(--radius-2xs)] text-[rgba(255,255,255,0.6)] transition-colors hover:bg-[rgba(255,255,255,0.06)] hover:text-[rgba(255,255,255,0.9)]"
        >
          <span className="material-symbols-outlined text-[14px]">arrow_back</span>
        </button>
        <div className="text-[12px] font-semibold text-[rgba(255,255,255,0.88)]">创建并检出新分支</div>
      </div>
      <div className="px-3 pb-3 space-y-3">
        <p className="text-[10px] leading-4 text-[rgba(255,255,255,0.5)]">
          基于当前 HEAD 创建一个新的本地分支，并在创建成功后立即切换过去。
        </p>

        <div>
          <label className="mb-1 block text-[10px] font-medium text-[rgba(255,255,255,0.65)]">
            分支名
          </label>
          <input
            type="text"
            value={branchName}
            onChange={(event) => setBranchName(event.target.value)}
            placeholder="例如 feature/git-branch-switcher"
            className="w-full rounded-[var(--radius-xs)] border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.04)] px-2.5 py-1.5 text-[11px] text-[rgba(255,255,255,0.92)] placeholder:text-[rgba(255,255,255,0.3)] focus:outline-none focus:ring-1 focus:ring-[rgba(255,255,255,0.18)]"
            onKeyDown={(event) => {
              if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
                event.preventDefault()
                if (branchName.trim() && !creatingBranch) void handleCreateBranch()
              }
            }}
          />
          <p className="mt-1 text-[9px] text-[rgba(255,255,255,0.35)]">
            首版只支持基于当前 HEAD 创建并切换。
          </p>
        </div>

        <button
          type="button"
          disabled={!branchName.trim() || creatingBranch}
          onClick={() => void handleCreateBranch()}
          className="flex h-7 w-full items-center justify-center gap-1.5 rounded-[var(--radius-sm)] bg-[rgba(255,255,255,0.12)] text-[11px] font-semibold text-[rgba(255,255,255,0.92)] transition-colors hover:bg-[rgba(255,255,255,0.18)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {creatingBranch ? (
            <span className="material-symbols-outlined text-[13px] animate-spin">progress_activity</span>
          ) : (
            <span className="material-symbols-outlined text-[13px]">call_split</span>
          )}
          创建并切换
        </button>
      </div>
    </>
  )

  return createPortal(
    <div
      ref={dialogRef}
      role="dialog"
      aria-label="Git 操作"
      className="fixed z-[350] w-[min(320px,calc(100vw-32px))] overflow-hidden rounded-[var(--radius-lg)] border border-[rgba(255,255,255,0.1)] bg-[rgba(48,48,50,0.94)] shadow-[0_12px_36px_rgba(0,0,0,0.4)] backdrop-blur-[24px]"
      style={dialogStyle}
    >
      {view === 'menu' && renderMenu()}
      {view === 'commit' && renderCommit()}
      {view === 'push' && renderPush()}
      {view === 'branch' && renderBranch()}
    </div>,
    document.body,
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="shrink-0 text-[10px] text-[rgba(255,255,255,0.5)]">{label}</span>
      <span className="min-w-0 truncate text-[10px] font-medium text-[rgba(255,255,255,0.82)]">{value}</span>
    </div>
  )
}
