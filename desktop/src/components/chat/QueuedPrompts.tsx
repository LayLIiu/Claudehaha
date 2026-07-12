/**
 * QueuedPrompts — 排队提示队列面板
 *
 * 参考 ZCode 的 pit 组件：DndContext + SortableContext 包裹，
 * 单条 QueuedPromptItem 可拖拽重排、编辑、立即发送、删除。
 */
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { Pause, Play, MessageSquareText } from 'lucide-react'
import { useChatStore } from '../../stores/chatStore'
import { useTranslation } from '../../i18n'
import { QueuedPromptItem } from './QueuedPromptItem'

type QueuedPromptsProps = {
  sessionId: string
  isActive: boolean
}

export function QueuedPrompts({ sessionId, isActive }: QueuedPromptsProps) {
  const t = useTranslation()
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  )

  const queue = useChatStore((s) => s.sessions[sessionId]?.queuedUserMessages ?? [])
  const isAutoRunPaused = useChatStore((s) => s.sessions[sessionId]?.isQueuedPromptAutoRunPaused ?? false)
  const reorder = useChatStore((s) => s.reorderQueuedUserMessages)
  const setPaused = useChatStore((s) => s.setQueuedPromptAutoRunPaused)
  const sendNow = useChatStore((s) => s.sendQueuedUserMessage)
  const updateMessage = useChatStore((s) => s.updateQueuedUserMessage)
  const removeMessage = useChatStore((s) => s.removeQueuedUserMessage)

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const fromIndex = queue.findIndex((m) => m.id === active.id)
    const toIndex = queue.findIndex((m) => m.id === over.id)
    if (fromIndex === -1 || toIndex === -1) return
    reorder(sessionId, fromIndex, toIndex)
  }

  if (queue.length === 0) return null

  return (
    <div
      data-testid="queued-prompts-panel"
      className="relative w-full overflow-hidden rounded-t-2xl border border-[var(--color-token-border)] bg-[var(--color-surface,rgba(10,10,10,0.03))] backdrop-blur-md"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-3 py-2">
        <div className="flex items-center gap-2">
          <MessageSquareText size={14} className="text-[var(--color-token-text-secondary)]" />
          <span className="text-[12px] font-semibold text-[var(--color-token-foreground)]">
            {t('chat.queuedPromptTitle')}
          </span>
          <span className="rounded-full bg-[var(--color-token-bg-subtle,rgba(255,255,255,0.06))] px-2 py-0.5 text-[10px] font-semibold text-[var(--color-token-text-secondary)]">
            {queue.length}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setPaused(sessionId, !isAutoRunPaused)}
          className={[
            'inline-flex h-7 items-center gap-1 rounded-[var(--radius-2xs)] px-2 text-[11px] font-semibold transition-colors',
            isAutoRunPaused
              ? 'bg-[var(--color-brand)]/15 text-[var(--color-brand)] hover:bg-[var(--color-brand)]/25'
              : 'text-[var(--color-token-text-secondary)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-token-foreground)]',
          ].join(' ')}
        >
          {isAutoRunPaused ? <Pause size={12} /> : <Play size={12} />}
          <span>{isAutoRunPaused ? t('chat.queuedPromptAutoRunPaused') : t('chat.queuedPromptAutoRun')}</span>
        </button>
      </div>

      {/* Queue list (draggable) */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={queue.map((m) => m.id)}
          strategy={verticalListSortingStrategy}
        >
          <ul className="space-y-0.5 px-1 pb-1">
            {queue.map((message) => (
              <QueuedPromptItem
                key={message.id}
                message={message}
                isActive={isActive}
                onSendNow={(id) => sendNow(sessionId, id)}
                onUpdate={(id, content) => updateMessage(sessionId, id, content)}
                onRemove={(id) => removeMessage(sessionId, id)}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
    </div>
  )
}
