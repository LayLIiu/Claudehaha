import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type React from 'react'
import { sessionsApi } from '../../api/sessions'
import { useUIStore } from '../../stores/uiStore'
import { useWorkspacePanelStore } from '../../stores/workspacePanelStore'

type GitDialogView = 'menu' | 'commit' | 'push' | 'branch'

type GitActionsDialogProps = {
  sessionId: string
  anchorRect: DOMRect
  onClose: () => void
  branch: string
  changeCount: number
  totalAdditions: number
  totalDeletions: number
  initialView?: GitDialogView
}

export function GitActionsDialog({
  sessionId,
  anchorRect,
  onClose,
  branch,
  changeCount,
  totalAdditions,
  totalDeletions,
  initialView = 'menu',
}: GitActionsDialogProps) {
  const [view, setView] = useState<GitDialogView>(initialView)
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

  useEffect(() => {
    const handleMouseDown = (event: MouseEvent) => {
      if (dialogRef.current?.contains(event.target as Node)) return
      onClose()
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (view !== 'menu' && initialView === 'menu') {
        setView('menu')
        return
      }
      onClose()
    }
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleMouseDown)
      document.addEventListener('keydown', handleKeyDown)
    }, 0)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('mousedown', handleMouseDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [initialView, onClose, view])

  useEffect(() => {
    if (view !== 'push' || syncStatus) return
    setLoadingSync(true)
    sessionsApi.gitSyncStatus(sessionId)
      .then(setSyncStatus)
      .catch(() => {})
      .finally(() => setLoadingSync(false))
  }, [sessionId, syncStatus, view])

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
  }, [addToast, commitMessage, loadStatus, onClose, sessionId])

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
  }, [addToast, sessionId])

  const handleCreateBranch = useCallback(async () => {
    if (!branchName.trim()) return
    setCreatingBranch(true)
    try {
      const nextBranch = branchName.trim()
      const result = await sessionsApi.gitCreateBranch(sessionId, nextBranch)
      if (result.success) {
        addToast({ type: 'success', message: `已创建并切换到分支 ${nextBranch}` })
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
  }, [addToast, branchName, loadStatus, onClose, sessionId])

  const menuStyle = {
    top: anchorRect.bottom + 6,
    left: Math.max(12, anchorRect.left - 104),
  }

  const closeOrBack = () => {
    if (initialView === 'menu') {
      setView('menu')
      return
    }
    onClose()
  }

  const renderMenu = () => (
    <div
      ref={dialogRef}
      role="dialog"
      aria-label="Git 操作"
      className="liquid-glass glass-panel fixed z-[360] w-[min(220px,calc(100vw-32px))] overflow-hidden rounded-[14px] border border-[rgba(255,255,255,0.1)] bg-[rgba(28,28,30,0.92)] p-1.5 shadow-[0_16px_48px_rgba(0,0,0,0.34)] backdrop-blur-xl"
      style={menuStyle}
    >
      <div className="px-2 pb-1.5 pt-2 text-[13px] font-semibold text-[rgba(255,255,255,0.44)]">
        Git 操作
      </div>
      <div className="space-y-1">
        <MenuButton icon="commit" label="提交" onClick={() => setView('commit')} />
        <MenuButton icon="upload" label="推送" onClick={() => setView('push')} />
        <MenuButton icon="call_split" label="创建分支" onClick={() => setView('branch')} />
      </div>
    </div>
  )

  const renderCommit = () => (
    <ModalFrame frameRef={dialogRef} title="提交更改" onBack={initialView === 'menu' ? closeOrBack : undefined} onClose={onClose}>
      <p className="text-[12px] leading-5 text-[rgba(255,255,255,0.56)]">
        将当前 workspace 内的未提交更改保存为一次提交。
      </p>

      <div className="overflow-hidden rounded-[10px] border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.045)]">
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
        <label className="mb-1.5 block text-[12px] font-semibold text-[rgba(255,255,255,0.64)]">
          提交消息
        </label>
        <textarea
          value={commitMessage}
          onChange={(event) => setCommitMessage(event.target.value)}
          placeholder="留空以自动生成提交消息"
          rows={4}
          className="w-full resize-none rounded-[10px] border border-[rgba(255,255,255,0.1)] bg-[rgba(0,0,0,0.22)] px-2.5 py-2 text-[12px] leading-5 text-[rgba(255,255,255,0.92)] placeholder:text-[rgba(255,255,255,0.34)] focus:outline-none focus:ring-1 focus:ring-[rgba(255,255,255,0.2)]"
          onKeyDown={(event) => {
            if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
              event.preventDefault()
              if (!committing) void handleCommit()
            }
          }}
        />
        <p className="mt-1.5 text-[11px] text-[rgba(255,255,255,0.4)]">
          留空时会使用当前模型生成 Conventional Commit 提交消息。
        </p>
      </div>

      <ModalActions>
        <SecondaryButton onClick={onClose}>取消</SecondaryButton>
        <PrimaryButton disabled={committing || changeCount === 0} onClick={() => void handleCommit()}>
          {committing ? '提交中…' : '生成并提交'}
        </PrimaryButton>
      </ModalActions>
    </ModalFrame>
  )

  const renderPush = () => (
    <ModalFrame frameRef={dialogRef} title="推送更改" onBack={initialView === 'menu' ? closeOrBack : undefined} onClose={onClose}>
      <p className="text-[12px] leading-5 text-[rgba(255,255,255,0.56)]">
        首次推送会把当前分支发布到远程并设置 upstream。
      </p>

      <div className="overflow-hidden rounded-[10px] border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.045)]">
        <InfoRow label="分支" value={branch || '—'} />
        <InfoRow
          label="远程分支"
          value={loadingSync ? '加载中…' : syncStatus?.remoteBranch ?? '首次推送会自动建立上游分支'}
        />
        <InfoRow
          label="同步状态"
          value={loadingSync ? '加载中…' : syncStatus ? `领先 ${syncStatus.ahead} / 落后 ${syncStatus.behind}` : '—'}
        />
      </div>

      <ModalActions>
        <SecondaryButton onClick={onClose}>取消</SecondaryButton>
        <PrimaryButton disabled={pushing} onClick={() => void handlePush()}>
          {pushing ? '推送中…' : '推送'}
        </PrimaryButton>
      </ModalActions>
    </ModalFrame>
  )

  const renderBranch = () => (
    <ModalFrame frameRef={dialogRef} title="创建并检出新分支" onBack={initialView === 'menu' ? closeOrBack : undefined} onClose={onClose}>
      <p className="text-[12px] leading-5 text-[rgba(255,255,255,0.56)]">
        基于当前 HEAD 创建一个新的本地分支，并在创建成功后立即切换过去。
      </p>

      <div className="overflow-hidden rounded-[10px] border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.045)]">
        <InfoRow label="当前分支" value={branch || '—'} />
      </div>

      <div>
        <label className="mb-1.5 block text-[12px] font-semibold text-[rgba(255,255,255,0.64)]">
          分支名
        </label>
        <input
          type="text"
          value={branchName}
          onChange={(event) => setBranchName(event.target.value)}
          placeholder="例如 feature/git-panel"
          className="h-9 w-full rounded-[10px] border border-[rgba(255,255,255,0.1)] bg-[rgba(0,0,0,0.22)] px-2.5 text-[12px] text-[rgba(255,255,255,0.92)] placeholder:text-[rgba(255,255,255,0.34)] focus:outline-none focus:ring-1 focus:ring-[rgba(255,255,255,0.2)]"
          onKeyDown={(event) => {
            if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
              event.preventDefault()
              if (branchName.trim() && !creatingBranch) void handleCreateBranch()
            }
          }}
        />
      </div>

      <ModalActions>
        <SecondaryButton onClick={onClose}>取消</SecondaryButton>
        <PrimaryButton disabled={!branchName.trim() || creatingBranch} onClick={() => void handleCreateBranch()}>
          {creatingBranch ? '创建中…' : '创建并切换'}
        </PrimaryButton>
      </ModalActions>
    </ModalFrame>
  )

  if (view === 'menu') {
    return createPortal(renderMenu(), document.body)
  }

  return createPortal(
    <div className="fixed inset-0 z-[360] flex items-center justify-center bg-[rgba(0,0,0,0.42)] px-4 backdrop-blur-[14px]">
      {view === 'commit' && renderCommit()}
      {view === 'push' && renderPush()}
      {view === 'branch' && renderBranch()}
    </div>,
    document.body,
  )
}

function MenuButton({ icon, label, onClick }: { icon: string; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-9 w-full items-center gap-2 rounded-[9px] px-2.5 text-left transition-colors hover:bg-[rgba(255,255,255,0.065)]"
    >
      <span className="material-symbols-outlined text-[18px] text-[rgba(255,255,255,0.8)]">{icon}</span>
      <span className="min-w-0 flex-1 text-[13px] font-semibold text-[rgba(255,255,255,0.9)]">{label}</span>
    </button>
  )
}

function ModalFrame({
  title,
  children,
  frameRef,
  onBack,
  onClose,
}: {
  title: string
  children: React.ReactNode
  frameRef: React.Ref<HTMLDivElement>
  onBack?: () => void
  onClose: () => void
}) {
  return (
    <div
      ref={frameRef}
      role="dialog"
      aria-label={title}
      className="liquid-glass glass-panel w-[min(380px,calc(100vw-32px))] overflow-hidden rounded-[18px] border border-[rgba(255,255,255,0.11)] bg-[rgba(28,28,30,0.94)] p-4 shadow-[0_22px_64px_rgba(0,0,0,0.42)]"
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] text-[rgba(255,255,255,0.56)] transition-colors hover:bg-[rgba(255,255,255,0.07)] hover:text-[rgba(255,255,255,0.9)]"
            >
              <span className="material-symbols-outlined text-[16px]">arrow_back</span>
            </button>
          ) : null}
          <div className="truncate text-[15px] font-semibold leading-5 text-[rgba(255,255,255,0.92)]">{title}</div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] text-[rgba(255,255,255,0.56)] transition-colors hover:bg-[rgba(255,255,255,0.07)] hover:text-[rgba(255,255,255,0.9)]"
        >
          <span className="material-symbols-outlined text-[16px]">close</span>
        </button>
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  )
}

function ModalActions({ children }: { children: React.ReactNode }) {
  return <div className="flex justify-end gap-2 pt-1">{children}</div>
}

function SecondaryButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="h-8 rounded-[9px] bg-[rgba(255,255,255,0.07)] px-4 text-[12px] font-semibold text-[rgba(255,255,255,0.78)] transition-colors hover:bg-[rgba(255,255,255,0.11)]"
    >
      {children}
    </button>
  )
}

function PrimaryButton({
  children,
  disabled,
  onClick,
}: {
  children: React.ReactNode
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="h-8 rounded-[9px] bg-[rgba(255,255,255,0.82)] px-4 text-[12px] font-semibold text-[#1f1f1f] transition-colors hover:bg-[rgba(255,255,255,0.92)] disabled:cursor-not-allowed disabled:opacity-50"
    >
      {children}
    </button>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-[rgba(255,255,255,0.06)] px-2.5 py-2 last:border-b-0">
      <span className="shrink-0 text-[11px] text-[rgba(255,255,255,0.48)]">{label}</span>
      <span className="min-w-0 truncate text-right text-[11px] font-medium text-[rgba(255,255,255,0.82)]">{value}</span>
    </div>
  )
}
