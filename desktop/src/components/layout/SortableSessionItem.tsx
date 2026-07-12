/**
 * SortableSessionItem — 可拖拽的侧边栏会话行
 *
 * 参考 ZCode 的 SortableWorkspaceSidebarItem：用 @dnd-kit 的 useSortable，
 * 在 group 内支持拖拽重排。拖拽手柄 (GripVertical) 出现在 hover 态，
 * 拖拽中调整 opacity / z-index。
 */
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Pin } from 'lucide-react'
import type { SessionListItem } from '../../types/session'
import type { FC } from 'react'

type SortableSessionItemProps = {
  session: SessionListItem
  isActive: boolean
  isSelected: boolean
  isPinned: boolean
  isRunning: boolean
  isUnread: boolean
  isBatchMode: boolean
  needsApproval: boolean
  missingDir?: string | null
  onClick: (event: React.MouseEvent) => void
  onContextMenu: (event: React.MouseEvent) => void
  onFinishRename?: () => void
  renaming?: boolean
  renameValue?: string
  onRenameChange?: (value: string) => void
  onRenameKeyDown?: (event: React.KeyboardEvent) => void
  onRenameBlur?: () => void
}

export const SortableSessionItem: FC<SortableSessionItemProps> = ({
  session,
  isPinned,
  isRunning,
  isUnread,
  isBatchMode,
  needsApproval,
  missingDir,
  onClick,
  onContextMenu,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: session.id })

  const style = {
    transform: CSS.Transform.toString({ x: transform?.x ?? 0, y: transform?.y ?? 0, scaleX: 1, scaleY: 1 }),
    transition,
    zIndex: isDragging ? 10 : undefined,
    opacity: isDragging ? 0.85 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={[
        'relative mb-0 last:mb-0 group/drag',
        isDragging ? 'bg-[var(--color-selected,rgba(10,10,10,0.1))] rounded-[var(--radius-md)]' : '',
      ].join(' ')}
    >
      <button
        type="button"
        onClick={onClick}
        onContextMenu={onContextMenu}
        className="relative flex w-full items-center gap-2 rounded-[var(--radius-md)] px-2 py-[5px] text-left text-[13px] transition-colors hover:bg-[var(--color-surface-hover)]"
      >
        {/* Drag handle */}
        <span
          {...attributes}
          {...listeners}
          aria-label="Drag to reorder"
          className="flex h-6 w-6 shrink-0 cursor-grab items-center justify-center rounded text-[var(--color-token-text-secondary)] opacity-0 group-hover/drag:opacity-100 active:cursor-grabbing"
        >
          <GripVertical size={12} strokeWidth={2} />
        </span>

        {isUnread && !isRunning && !isBatchMode && (
          <span
            className="absolute left-[22px] top-1/2 -translate-y-1/2 inline-block h-[7px] w-[7px] rounded-full bg-[#5B9BF5] shadow-[0_0_4px_rgba(91,155,245,0.6)]"
            aria-label="Unread"
          />
        )}

        <span className="min-w-0 flex-1 truncate font-medium tracking-normal">
          {needsApproval && (
            <span className="mr-1.5 inline-flex items-center gap-0.5 rounded-[var(--radius-2xs)] bg-[var(--color-warning)]/15 px-1.5 py-0.5 text-[10px] font-semibold text-[var(--color-warning)]">
              approve
            </span>
          )}
          {session.title || 'Untitled'}
        </span>

        {isPinned && !isBatchMode && (
          <Pin className="icon-xs shrink-0 text-[var(--color-token-text-secondary)]" strokeWidth={1.8} />
        )}
        {missingDir && (
          <span className="shrink-0 text-[10px] text-[var(--color-warning)]">!</span>
        )}
        {isRunning && (
          <span className="h-2 w-2 shrink-0 rounded-full bg-[var(--color-success)] animate-pulse-dot" />
        )}
      </button>
    </div>
  )
}
