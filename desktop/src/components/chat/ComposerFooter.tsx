/**
 * ComposerFooter — Composer 底部工具栏
 *
 * 从 ChatInput 中提取，对应官方 Codex 的 composer-footer 组件。
 * 包含：+菜单、权限模式、上下文用量、模型选择、发送/停止按钮。
 *
 * 支持 container query 响应式隐藏标签（匹配官方 Codex 的 @container 行为）。
 */
import { useRef, useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { PermissionModeSelector } from '../controls/PermissionModeSelector'
import { ModelSelector } from '../controls/ModelSelector'
import { ContextUsageIndicator } from './ContextUsageIndicator'
import { useTranslation } from '../../i18n'
import type { ChatState } from '../../types/chat'

export interface ComposerFooterProps {
  /** 当前 tab ID */
  activeTabId: string | null
  /** 是否为成员会话（只读/受限） */
  isMemberSession: boolean
  /** 是否正在运行 */
  isActive: boolean
  /** 是否可以提交 */
  canSubmit: boolean
  /** 是否使用紧凑控件 */
  compact: boolean
  /** 是否移动端 */
  isMobileComposer: boolean
  /** 聊天状态 */
  chatState: ChatState
  /** 消息计数 */
  messageCount: number
  /** runtime selection key */
  runtimeSelectionKey: string | undefined
  /** runtime model label */
  runtimeModelLabel: string
  /** compact count (用于刷新上下文用量) */
  compactCount: number
  /** 打开附件选择器 */
  onOpenAttachmentPicker: () => void
  /** 插入斜杠命令 */
  onInsertSlashCommand: () => void
  /** 提交 */
  onSubmit: () => void
  /** 停止生成 */
  onStopGeneration: (sessionId: string) => void
  /** hero 模式 */
  isHeroComposer: boolean
}

export function ComposerFooter({
  activeTabId,
  isMemberSession,
  isActive,
  canSubmit,
  compact: useCompactControls,
  isMobileComposer,
  chatState,
  messageCount,
  runtimeSelectionKey,
  runtimeModelLabel,
  compactCount,
  onOpenAttachmentPicker,
  onInsertSlashCommand,
  onSubmit,
  onStopGeneration,
  isHeroComposer,
}: ComposerFooterProps) {
  const t = useTranslation()
  const [plusMenuOpen, setPlusMenuOpen] = useState(false)
  const plusMenuBtnRef = useRef<HTMLButtonElement>(null)
  const plusMenuPortalRef = useRef<HTMLDivElement>(null)
  const [plusMenuPos, setPlusMenuPos] = useState<{ bottom: number; left: number } | null>(null)

  useEffect(() => {
    if (plusMenuOpen && plusMenuBtnRef.current) {
      const rect = plusMenuBtnRef.current.getBoundingClientRect()
      setPlusMenuPos({ bottom: window.innerHeight - rect.top + 4, left: rect.left })
    } else {
      setPlusMenuPos(null)
    }
  }, [plusMenuOpen])

  useEffect(() => {
    if (!plusMenuOpen) return
    const handler = (e: MouseEvent) => {
      if (
        plusMenuPortalRef.current &&
        !plusMenuPortalRef.current.contains(e.target as Node) &&
        plusMenuBtnRef.current &&
        !plusMenuBtnRef.current.contains(e.target as Node)
      ) {
        setPlusMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [plusMenuOpen])

  const addFilesLabel = 'Add files'
  const slashCommandsLabel = 'Slash commands'

  return (
    <div
      data-testid="chat-input-toolbar"
      className={`composer-footer ${isHeroComposer
        ? 'flex items-center justify-between pt-2'
        : `mt-1 flex items-center justify-between ${
          useCompactControls ? '-mx-3 -mb-3 gap-2 px-2.5 py-2' : '-mx-4 -mb-3 px-3 py-2'
        }`}`}
    >
      {/* 左侧：+ 菜单 + 权限模式 */}
      <div className="flex min-w-0 items-center gap-2">
        {!isMemberSession && (
          <>
            <div className="relative">
              <button
                ref={plusMenuBtnRef}
                onClick={() => setPlusMenuOpen((value) => !value)}
                aria-label="Open composer tools"
                className={`text-[var(--color-token-text-secondary)] transition-colors hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-token-foreground)] ${isMobileComposer ? 'inline-flex h-11 w-11 items-center justify-center rounded-xl' : 'rounded-[var(--radius-sm)] p-1.5'}`}
              >
                <span className="material-symbols-outlined icon-md">add</span>
              </button>

              {plusMenuOpen && plusMenuPos && createPortal(
                <div
                  ref={plusMenuPortalRef}
                  className="liquid-glass glass-panel fixed z-[80] w-[240px] overflow-hidden rounded-[var(--radius-2xl)] p-1.5 shadow-[var(--shadow-dropdown)]"
                  style={{ bottom: plusMenuPos.bottom, left: plusMenuPos.left }}
                >
                  <button
                    onClick={() => { onOpenAttachmentPicker(); setPlusMenuOpen(false) }}
                    className="sidebar-codex-menu-item w-full rounded-[var(--radius-md)]"
                  >
                    <span className="material-symbols-outlined icon-md text-[var(--color-token-text-secondary)]">attach_file</span>
                    <span className="text-sm text-[var(--color-token-foreground)]">{addFilesLabel}</span>
                  </button>
                  <button
                    onClick={() => { onInsertSlashCommand(); setPlusMenuOpen(false) }}
                    className="sidebar-codex-menu-item w-full rounded-[var(--radius-md)]"
                  >
                    <span className="w-[24px] text-center text-[18px] font-bold text-[var(--color-token-text-secondary)]">/</span>
                    <span className="text-sm text-[var(--color-token-foreground)]">{slashCommandsLabel}</span>
                  </button>
                </div>,
                document.body,
              )}
            </div>

            <PermissionModeSelector compact={useCompactControls} />
          </>
        )}
      </div>

      {/* 右侧：上下文用量 + 模型选择 + 发送按钮 */}
      <div className="flex min-w-0 items-center gap-2">
        {!isMemberSession && activeTabId && (
          <ContextUsageIndicator
            sessionId={activeTabId}
            chatState={chatState}
            messageCount={messageCount}
            runtimeSelectionKey={runtimeSelectionKey}
            fallbackModelLabel={runtimeModelLabel}
            compact={useCompactControls}
            refreshNonce={compactCount}
          />
        )}
        {!isMemberSession && activeTabId && (
          <ModelSelector runtimeKey={activeTabId} disabled={isActive} compact={useCompactControls} />
        )}
        <button
          onClick={!isMemberSession && isActive ? () => activeTabId && onStopGeneration(activeTabId) : onSubmit}
          disabled={!isMemberSession && isActive ? false : !canSubmit}
          aria-label={!isMemberSession && isActive ? t('common.stop') : isMemberSession ? t('common.send') : t('common.run')}
          className={`flex shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-all hover:scale-[1.04] disabled:opacity-35 ${
            isMobileComposer ? 'h-12 w-12' : 'h-11 w-11'
          } ${
            !isMemberSession && isActive
              ? 'bg-[var(--color-brand)] text-[var(--color-token-main-surface-primary)] hover:brightness-110'
              : 'bg-[var(--color-token-input-placeholder-foreground)] text-[var(--color-token-main-surface-primary)] hover:brightness-110'
          }`}
        >
          <span className="material-symbols-outlined icon-sm">
            {!isMemberSession && isActive ? 'stop' : 'arrow_upward'}
          </span>
        </button>
      </div>
    </div>
  )
}
