/**
 * ThreadChrome — 对话窗口的标题栏/工具栏区域
 *
 * 从 ActiveSession 中提取，对应官方 Codex 的 thread-chrome 组件。
 * 包含：会话标题、菜单、环境信息、工具按钮（终端/工作区/任务摘要）。
 */
import { useRef, useState, useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Archive, Download, Folder, FolderOpen, GitBranch, LoaderCircle, MoreHorizontal, Pencil, Pin, PinOff, SquareTerminal } from 'lucide-react'
import { useGlassPanelAnimation } from '../../hooks/useGlassPanelAnimation'
import { EnvTypeIcon } from '../common/EnvTypeIcon'




import { useWorkspacePanelStore } from '../../stores/workspacePanelStore'
import { useTerminalPanelStore } from '../../stores/terminalPanelStore'

import { useTranslation } from '../../i18n'
import { OpenProjectMenu } from '../layout/OpenProjectMenu'
import { ActiveGoalStrip } from './ActiveGoalStrip'
import { HistoryStatePill } from './HistoryStatePill'
import type { SessionListItem } from '../../types/session'
import type { ActiveGoalState } from '../../types/chat'
import { useChatStore } from '../../stores/chatStore'
import { isDesktopRuntime } from '../../lib/desktopRuntime'
import { conversationToMarkdown, downloadMarkdownFile } from '../../lib/conversationExport'
import type { UIMessage } from '../../types/chat'

/* ── TitleMenuItem (internal) ──────────────────────────── */

function TitleMenuItem({
  icon,
  label,
  shortcut,
  disabled,
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
      disabled={disabled}
      onClick={onClick}
      className="sidebar-codex-menu-item"
    >
      <span className="shrink-0">{icon}</span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {shortcut && (
        <span className="shrink-0 text-[11px] text-[var(--color-token-text-secondary)] opacity-70">
          {shortcut}
        </span>
      )}
    </button>
  )
}

/* ── ThreadChrome ──────────────────────────────────────── */

export interface ThreadChromeProps {
  session: SessionListItem | null
  activeTabId: string | null
  isActive: boolean
  showRightPanel: boolean
  envPanelOpen: boolean
  setEnvPanelOpen: (v: boolean | ((prev: boolean) => boolean)) => void
  showTerminalPanel: boolean
  showWorkbench: boolean
  messages: UIMessage[]
  activeGoal: ActiveGoalState | null
  isBranchingSession: boolean
  latestBranchTarget: string | null
  isArchivingSession: boolean
  onRename: () => void
  onBranch: () => void
  onArchive: () => void
  onTogglePinned: () => void
  isSessionPinned: boolean
  isViewingForkedTurn?: boolean
  viewingTurnIndex?: number
  onJumpToParent?: () => void
}

export function ThreadChrome({
  session,
  activeTabId,
  isActive,
  showRightPanel,
  envPanelOpen,
  setEnvPanelOpen,
  showTerminalPanel,
  showWorkbench,
  messages,
  activeGoal,
  isBranchingSession,
  latestBranchTarget,
  onRename,
  onBranch,
  onArchive,
  onTogglePinned,
  isSessionPinned,
}: ThreadChromeProps) {
  const t = useTranslation()
  const forkedFromTurn = useChatStore((s) => activeTabId ? s.sessions[activeTabId]?.forkedFromTurn : undefined)
  const viewingTurnIndex = useChatStore((s) => activeTabId ? s.sessions[activeTabId]?.forkingTurnIndex : null)
  const [titleMenuOpen, setTitleMenuOpen] = useState(false)
  const titleMenuBtnRef = useRef<HTMLButtonElement>(null)
  const titleMenuPortalRef = useRef<HTMLDivElement>(null)
  const envPanelAnchorRef = useRef<HTMLButtonElement>(null)
  const [titleMenuPos, setTitleMenuPos] = useState<{ top: number; right: number } | null>(null)
  const titleMenuAnim = useGlassPanelAnimation(() => setTitleMenuOpen(false))

  // Compute title menu position
  useEffect(() => {
    if (titleMenuOpen && titleMenuBtnRef.current) {
      const rect = titleMenuBtnRef.current.getBoundingClientRect()
      setTitleMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right })
    } else {
      setTitleMenuPos(null)
    }
  }, [titleMenuOpen])

  // Close on outside click
  useEffect(() => {
    if (!titleMenuOpen) return
    const handler = (e: MouseEvent) => {
      if (
        titleMenuPortalRef.current &&
        !titleMenuPortalRef.current.contains(e.target as Node) &&
        titleMenuBtnRef.current &&
        !titleMenuBtnRef.current.contains(e.target as Node)
      ) {
        titleMenuAnim.requestClose()
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [titleMenuOpen])

  const openProjectPath =
    session?.workDir && session.workDirExists !== false
      ? session.workDir
      : session?.projectPath || null

  return (
    <div
      data-desktop-drag-region={isDesktopRuntime() ? true : undefined}
      className="session-titlebar relative flex w-full items-center border-b border-[var(--color-token-border)]/65 px-4"
    >
      <div className="session-header-shell flex w-full items-center justify-between">
        <div className="min-w-0 flex-1 pr-3">
          <div className="flex min-w-0 items-center gap-2">
            <h1
              className={
                showRightPanel
                  ? 'min-w-0 max-w-[min(62vw,620px)] truncate text-[14px] font-semibold leading-5 tracking-[-0.015em] text-[var(--color-token-foreground)]'
                  : 'min-w-0 max-w-[min(68vw,760px)] truncate text-[14px] font-semibold leading-5 tracking-[-0.015em] text-[var(--color-token-foreground)]'
              }
            >
              {session?.title || t('session.untitled')}
            </h1>
            <div className="relative shrink-0">
              <button
                ref={titleMenuBtnRef}
                type="button"
                aria-label="更多"
                title="更多"
                aria-haspopup="menu"
                aria-expanded={titleMenuOpen}
                  onClick={(event) => {
                      event.stopPropagation()
                      if (titleMenuOpen) titleMenuAnim.requestClose(); else setTitleMenuOpen(true)
                    }}
                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--radius-sm)] text-[var(--color-token-text-secondary)] transition-colors hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-token-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-token-focus-border,var(--color-border-focus))] data-[state=open]:bg-[var(--color-surface-hover)] data-[state=open]:text-[var(--color-token-foreground)]"
                data-state={titleMenuOpen ? 'open' : 'closed'}
              >
                <MoreHorizontal size={16} strokeWidth={2} aria-hidden="true" />
              </button>
              {titleMenuOpen && titleMenuPos && createPortal(
                <div
                  ref={titleMenuPortalRef}
                  role="menu"
                  className={`session-title-menu liquid-glass glass-panel fixed z-[80] w-[250px] overflow-hidden rounded-[var(--radius-2xl)] p-1.5 shadow-[var(--shadow-dropdown)] ${titleMenuAnim.animatingOut ? 'glass-animate-exit' : ''}`}
                  style={{ top: titleMenuPos.top, right: titleMenuPos.right }}
                  onClick={(event) => event.stopPropagation()}
                >
                  <TitleMenuItem
                    icon={isSessionPinned ? <PinOff size={18} aria-hidden="true" /> : <Pin size={18} aria-hidden="true" />}
                    label={isSessionPinned ? '取消置顶对话' : '置顶对话'}
                    shortcut="⌥⌘P"
                    onClick={onTogglePinned}
                  />
                  <TitleMenuItem
                    icon={<Pencil size={18} aria-hidden="true" />}
                    label="重命名对话"
                    shortcut="⌥⌘R"
                    onClick={onRename}
                  />
                  <TitleMenuItem
                    icon={<Archive size={18} aria-hidden="true" />}
                    label="归档对话"
                    shortcut="⇧⌘A"
                    onClick={onArchive}
                  />
                  <TitleMenuItem
                    icon={<Download size={18} aria-hidden="true" />}
                    label={t('session.exportMarkdown')}
                    shortcut="⌥⌘E"
                    disabled={messages.length === 0}
                    onClick={() => {
                      titleMenuAnim.requestClose()
                      const md = conversationToMarkdown(messages, session?.title)
                      const safeName = (session?.title || 'conversation').replace(/[^a-zA-Z0-9_\-\u4e00-\u9fff]/g, '_').slice(0, 80)
                      downloadMarkdownFile(md, `${safeName}.md`)
                    }}
                  />
                  <div className="my-1.5 h-px bg-[rgba(255,255,255,0.08)]" />
                  <TitleMenuItem
                    icon={isBranchingSession ? <LoaderCircle size={18} className="animate-spin" aria-hidden="true" /> : <GitBranch size={18} aria-hidden="true" />}
                    label={isBranchingSession ? '正在创建分支…' : '分支'}
                    shortcut="⌥⌘B"
                    disabled={!latestBranchTarget || isActive || isBranchingSession}
                    onClick={onBranch}
                  />
                </div>, document.body)}
            </div>
            <EnvTypeIcon type="local" className="shrink-0" />
            {isActive && (
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-success)] animate-pulse-dot" aria-label={t('session.active')} />
            )}
          </div>
          {session?.workDirExists === false && (
            <div className="mt-2 inline-flex max-w-full items-center gap-2 rounded-lg border border-[var(--color-error)]/20 bg-[var(--color-error)]/8 px-3 py-1.5 text-[11px] text-[var(--color-error)]">
              <span className="material-symbols-outlined icon-xs">warning</span>
              <span className="truncate">
                {t('session.workspaceUnavailable', { dir: session.workDir || 'directory no longer exists' })}
              </span>
            </div>
          )}
          <ActiveGoalStrip goal={activeGoal} isRunning={isActive} compact />
        </div>
        {forkedFromTurn && viewingTurnIndex != null && (
          <div className="px-4 pb-2">
            <HistoryStatePill turnIndex={viewingTurnIndex} onJumpToParent={() => {}} />
          </div>
        )}
        <div className="session-header-actions relative flex shrink-0 items-center gap-1">
          <OpenProjectMenu
            path={openProjectPath}
            sessionId={activeTabId}
            simpleTargetIds={['finder', 'terminal', 'xcode']}
          />
          <OpenProjectMenu
            path={openProjectPath}
            sessionId={activeTabId}
            variant="environment"
            externalOpen={envPanelOpen}
            onExternalClose={() => setEnvPanelOpen(false)}
            hideTrigger
            anchorElement={envPanelAnchorRef.current}
          />
          <button
            ref={envPanelAnchorRef}
            type="button"
            aria-label={t('tasks.toggleSummary')}
            title={t('tasks.toggleSummary')}
            onClick={() => setEnvPanelOpen((v) => !v)}
            data-active={envPanelOpen ? 'true' : 'false'}
            className={`inline-flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-token-focus-border,var(--color-border-focus))] spring-bounce-btn ${
              envPanelOpen
                ? 'bg-[var(--color-surface)] text-[var(--color-token-foreground)] shadow-[0_8px_18px_rgba(0,0,0,0.12)]'
                : 'text-[var(--color-token-text-secondary)] hover:bg-[var(--color-surface)] hover:text-[var(--color-token-foreground)]'
            }`}
          >
            <span className="material-symbols-outlined text-[17px]">checklist</span>
          </button>
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
            className={`inline-flex h-7 w-7 items-center justify-center rounded-[var(--radius-sm)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-token-focus-border,var(--color-border-focus))] spring-bounce-btn ${
              showTerminalPanel
                ? 'bg-[var(--color-surface)] text-[var(--color-token-foreground)] shadow-[0_8px_18px_rgba(0,0,0,0.12)]'
                : 'text-[var(--color-token-text-secondary)] hover:bg-[var(--color-surface)] hover:text-[var(--color-token-foreground)]'
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
            className={`inline-flex h-7 w-7 items-center justify-center rounded-[var(--radius-sm)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-token-focus-border,var(--color-border-focus))] spring-bounce-btn ${
              showWorkbench
                ? 'bg-[var(--color-surface)] text-[var(--color-token-foreground)] shadow-[0_8px_18px_rgba(0,0,0,0.12)]'
                : 'text-[var(--color-token-text-secondary)] hover:bg-[var(--color-surface)] hover:text-[var(--color-token-foreground)]'
            }`}
          >
            {showWorkbench ? <FolderOpen size={15} strokeWidth={1.9} /> : <Folder size={15} strokeWidth={1.9} />}
          </button>
        </div>
      </div>
    </div>
  )
}
