/**
 * SidePaneContainer — 右侧多功能面板
 *
 * 用户在聊天区点击 Workspace/Git/Terminal 等按钮时打开此面板，
 * 面板直接显示对应视图内容，不需要重复的 tab 栏。
 */
import { memo } from 'react'
import { X } from 'lucide-react'
import { useSidePaneStore } from '../../stores/sidePaneStore'
import { useWorkspacePanelStore } from '../../stores/workspacePanelStore'
import { WorkbenchPanel } from '../workbench/WorkbenchPanel'
import { GitSideView } from './GitSideView'

type SidePaneContainerProps = {
  sessionId: string
  onClose: () => void
}

export const SidePaneContainer = memo(
  function SidePaneContainer({ sessionId, onClose }: SidePaneContainerProps) {
    const activeView = useSidePaneStore((s) => s.view)
    const setView = useSidePaneStore((s) => s.open)
    const closePanel = useWorkspacePanelStore((s) => s.closePanel)

    if (!activeView) return null

    function handleClose() {
      setView(null)
      closePanel(sessionId)
      onClose()
    }

    function WorkspaceView() {
      return <WorkbenchPanel sessionId={sessionId} />
    }

    function GitView() {
      return <GitSideView sessionId={sessionId} />
    }

    function TerminalView() {
      return (
        <div className="flex h-full items-center justify-center text-[13px] text-[var(--color-token-text-secondary)]">
          Terminal
        </div>
      )
    }

    function BrowserView() {
      return (
        <div className="flex h-full items-center justify-center text-[13px] text-[var(--color-token-text-secondary)]">
          Browser
        </div>
      )
    }

    function CodeView() {
      return (
        <div className="flex h-full items-center justify-center text-[13px] text-[var(--color-token-text-secondary)]">
          Code Viewer
        </div>
      )
    }

    return (
      <aside
        data-testid="side-pane-container"
        className="flex h-full w-full flex-col border-l border-[var(--color-token-border)] bg-[var(--color-surface)]"
      >
        {/* Header — 只保留关闭按钮 */}
        <div className="flex h-10 shrink-0 items-center border-b border-[var(--color-token-border)] px-2">
          <span className="text-[12px] font-medium text-[var(--color-token-text-secondary)]">
            {activeView === 'workspace' && 'Workspace'}
            {activeView === 'git' && 'Git'}
            {activeView === 'terminal' && 'Terminal'}
            {activeView === 'browser' && 'Browser'}
            {activeView === 'code-viewer' && 'Code Viewer'}
          </span>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close"
            className="ml-auto flex h-7 w-7 items-center justify-center rounded-[var(--radius-sm)] text-[var(--color-token-text-secondary)] transition-colors hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-token-foreground)]"
          >
            <X size={14} strokeWidth={2} />
          </button>
        </div>

        {/* Content area */}
        <div className="min-h-0 flex-1 overflow-hidden">
          {activeView === 'workspace' && <WorkspaceView />}
          {activeView === 'git' && <GitView />}
          {activeView === 'terminal' && <TerminalView />}
          {activeView === 'browser' && <BrowserView />}
          {activeView === 'code-viewer' && <CodeView />}
        </div>
      </aside>
    )
  },
)
