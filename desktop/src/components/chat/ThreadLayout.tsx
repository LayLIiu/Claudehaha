/**
 * ThreadLayout — 对话线程的布局容器
 *
 * 从 ActiveSession 中提取，对应官方 Codex 的 thread-layout + thread-scroll-layout。
 * 负责：整体两栏布局（聊天列 + 工作区面板）、终端面板、确认对话框。
 */
import type { ReactNode } from 'react'

export interface ThreadLayoutProps {
  /** 聊天列内容（标题栏、消息列表、输入区） */
  chatColumn: ReactNode
  /** 工作区面板（右侧） */
  workbenchPanel: ReactNode | null
  /** 是否显示工作区面板 */
  showRightPanel: boolean
  /** 是否显示终端面板 */
  showTerminalPanel: boolean
  /** 终端面板内容 */
  terminalPanel: ReactNode
  /** 终端面板高度 */
  terminalPanelHeight: number
  /** 确认对话框 */
  confirmDialog: ReactNode
  /** ComputerUse 权限弹窗 */
  computerUseModal: ReactNode
  /** 工作区调整手柄 */
  workspaceResizeHandle: ReactNode
  /** 终端调整手柄 */
  terminalResizeHandle: ReactNode
  /** 是否移动端布局 */
  isMobileLayout: boolean
}

const CHAT_COLUMN_WITH_WORKSPACE_CLASS = 'min-w-[320px] flex-1'

export function ThreadLayout({
  chatColumn,
  workbenchPanel,
  showRightPanel,
  confirmDialog,
  computerUseModal,
  workspaceResizeHandle,
}: ThreadLayoutProps) {
  return (
    <div className="flex-1 flex relative overflow-hidden text-on-surface">
      {/* 聊天列 */}
      <div
        data-testid="active-session-chat-column"
        className={`relative flex min-h-0 flex-col ${showRightPanel ? CHAT_COLUMN_WITH_WORKSPACE_CLASS : 'min-w-[360px] flex-1'}`}
      >
        {chatColumn}
      </div>

      {/* 工作区面板 */}
      {workbenchPanel && (
        <>
          {workspaceResizeHandle}
          {workbenchPanel}
        </>
      )}

      {confirmDialog}
      {computerUseModal}
    </div>
  )
}
