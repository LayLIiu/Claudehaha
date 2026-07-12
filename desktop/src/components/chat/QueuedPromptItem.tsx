/**
 * QueuedPromptItem — 单条排队提示项
 *
 * 参考 ZCode 的 fit 组件 + 我们现有的 pending-user-message 样式。
 * 功能：
 * - dnd-kit useSortable 拖拽重排
 * - 内容预览 + 点击编辑（Cmd/Ctrl+Enter 保存）
 * - 状态 badge（submitting / queued / guided）
 * - 立即发送 / 删除 按钮
 */
import { useState } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, SendHorizontal, Pencil, X } from 'lucide-react'
import { useTranslation } from '../../i18n'
import type { QueuedUserMessage } from '../../stores/chatStore'

type QueuedPromptStatus = 'queued' | 'submitting' | 'guided'

function deriveStatus(): QueuedPromptStatus {
  // 后续可扩展：第一条变为 "submitting"，带引导消息为 "guided"
  return 'queued'
}

function getStatusLabel(status: QueuedPromptStatus, t: ReturnType<typeof useTranslation>): string {
  if (status === 'submitting') return t('chat.queuedPromptSubmitting')
  if (status === 'guided') return t('chat.queuedPromptGuided')
  return t('chat.queuedPromptQueued')
}

function getStatusBadgeClass(status: QueuedPromptStatus): string {
  if (status === 'submitting') return 'bg-[var(--color-brand)]/15 text-[var(--color-brand)]'
  if (status === 'guided') return 'bg-[var(--color-warning)]/15 text-[var(--color-warning)]'
  return 'bg-[var(--color-token-bg-subtle,rgba(255,255,255,0.06))] text-[var(--color-token-text-secondary)]'
}

export type QueuedPromptItemProps = {
  message: QueuedUserMessage
  isActive: boolean
  onSendNow: (id: string) => void
  onUpdate: (id: string, content: string) => void
  onRemove: (id: string) => void
}

export function QueuedPromptItem({
  message,
  isActive,
  onSendNow,
  onUpdate,
  onRemove,
}: QueuedPromptItemProps) {
  const t = useTranslation()
  const [isEditing, setIsEditing] = useState(false)
  const [draft, setDraft] = useState(message.displayContent)

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: message.id,
    disabled: isEditing,
  })

  const style = {
    transform: CSS.Transform.toString({ x: transform?.x ?? 0, y: transform?.y ?? 0, scaleX: 1, scaleY: 1 }),
    transition,
    zIndex: isDragging ? 10 : undefined,
    opacity: isDragging ? 0.85 : 1,
  }

  const status = deriveStatus()
  const statusLabel = getStatusLabel(status, t)
  const badgeClass = getStatusBadgeClass(status)

  function saveEdit() {
    const trimmed = draft.trim()
    if (trimmed && trimmed !== message.displayContent) {
      onUpdate(message.id, trimmed)
    }
    setIsEditing(false)
  }

  function cancelEdit() {
    setDraft(message.displayContent)
    setIsEditing(false)
  }

  return (
    <li
      ref={setNodeRef}
      data-testid="queued-prompt-item"
      style={style}
      className={[
        'flex items-center gap-2 rounded-xl px-1.5 pr-1 py-1 transition-colors',
        isDragging
          ? 'bg-[var(--color-selected,rgba(10,10,10,0.1))] shadow-xs'
          : 'hover:bg-[var(--color-surface-hover,rgba(10,10,10,0.05))]',
      ].join(' ')}
    >
      {/* 拖拽手柄 */}
      <button
        {...attributes}
        {...listeners}
        type="button"
        aria-label={t('chat.queuedPromptDragHandle')}
        title={t('chat.queuedPromptDragHandle')}
        className="flex h-7 w-7 shrink-0 cursor-grab items-center justify-center rounded-[var(--radius-2xs)] text-[var(--color-token-text-secondary)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-token-foreground)] active:cursor-grabbing"
      >
        <GripVertical size={14} strokeWidth={2} />
      </button>

      {/* 内容区 */}
      {isEditing ? (
        <div className="flex min-w-0 flex-1 items-center gap-1.5">
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
                event.preventDefault()
                saveEdit()
              }
              if (event.key === 'Escape') {
                event.preventDefault()
                cancelEdit()
              }
            }}
            aria-label={t('chat.queuedPromptEditInput')}
            className="min-w-0 flex-1 rounded-[var(--radius-2xs)] border border-[var(--color-token-border)] bg-[var(--color-token-bg-subtle,rgba(255,255,255,0.04))] px-2 py-1 text-xs text-[var(--color-token-foreground)] outline-none focus:border-[var(--color-token-focus-border,var(--color-border-focus))]"
            autoFocus
          />
          <button
            type="button"
            onClick={saveEdit}
            disabled={!draft.trim()}
            className="shrink-0 rounded-[var(--radius-2xs)] px-2 py-1 font-semibold text-[var(--color-brand)] hover:bg-[var(--color-surface-hover)] disabled:opacity-40"
          >
            {t('common.save')}
          </button>
          <button
            type="button"
            onClick={cancelEdit}
            className="shrink-0 rounded-[var(--radius-2xs)] px-2 py-1 font-medium text-[var(--color-token-text-secondary)] hover:bg-[var(--color-surface-hover)]"
          >
            {t('common.cancel')}
          </button>
        </div>
      ) : (
        <>
          {/* 状态 badge */}
          <span
            className={[
              'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold',
              badgeClass,
            ].join(' ')}
          >
            {statusLabel}
          </span>
          {/* 内容预览 */}
          <span
            className="min-w-0 flex-1 truncate text-[13px] text-[var(--color-token-foreground)]"
            title={message.displayContent}
          >
            {message.displayContent}
          </span>
          {/* 操作 */}
          <button
            type="button"
            onClick={() => onSendNow(message.id)}
            disabled={isActive}
            aria-label={t('chat.queuedPromptSendNow')}
            title={t('chat.queuedPromptSendNow')}
            className="inline-flex h-7 shrink-0 items-center gap-1 rounded-[var(--radius-2xs)] px-2 font-semibold text-[var(--color-token-text-secondary)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-token-foreground)] disabled:opacity-40"
          >
            <SendHorizontal size={14} strokeWidth={2} />
            <span className="text-[11px]">{t('chat.queuedPromptSendNow')}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setDraft(message.displayContent)
              setIsEditing(true)
            }}
            aria-label={t('chat.queuedPromptEdit')}
            title={t('chat.queuedPromptEdit')}
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--radius-2xs)] text-[var(--color-token-text-secondary)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-token-foreground)]"
          >
            <Pencil size={14} strokeWidth={2} />
          </button>
          <button
            type="button"
            onClick={() => onRemove(message.id)}
            aria-label={t('chat.queuedPromptDelete')}
            title={t('chat.queuedPromptDelete')}
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--radius-2xs)] text-[var(--color-token-text-secondary)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-error)]"
          >
            <X size={14} strokeWidth={2} />
          </button>
        </>
      )}
    </li>
  )
}
