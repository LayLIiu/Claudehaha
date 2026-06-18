import { memo } from 'react'
import type { UIAttachment } from '../../types/chat'
import { AttachmentGallery } from './AttachmentGallery'
import { MessageActionBar, type MessageBranchAction } from './MessageActionBar'

type Props = {
  content: string
  attachments?: UIAttachment[]
  branchAction?: MessageBranchAction
  timestamp?: number
  showActions?: boolean
}

export const UserMessage = memo(function UserMessage({ content, attachments, branchAction, timestamp, showActions = true }: Props) {
  const hasText = content.trim().length > 0

  return (
    <div className="codex-task-stream-item mb-[3px] flex justify-end">
      <div
        data-message-shell="user"
        className="group/message relative flex min-w-0 max-w-[88%] flex-col items-end sm:max-w-[82%] lg:max-w-[72%]"
      >
        <div className="flex max-w-full flex-col items-end gap-2">
          {attachments && attachments.length > 0 && (
            <AttachmentGallery attachments={attachments} variant="message" />
          )}

          {hasText && (
            <div
              className="user-message-bubble min-w-0 max-w-full rounded-[14px] border border-[var(--color-border)] bg-[var(--color-surface-container)] px-4 py-3 text-[14px] leading-7 text-[var(--color-text-primary)] whitespace-pre-wrap break-words"
              style={{
                overflowWrap: 'anywhere',
                wordBreak: 'break-word',
              }}
            >
              {content}
            </div>
          )}
        </div>

        {showActions && hasText && (
          <MessageActionBar
            copyText={content}
            copyLabel="Copy prompt"
            branchAction={branchAction}
            align="end"
            timestamp={timestamp}
          />
        )}
      </div>
    </div>
  )
})
