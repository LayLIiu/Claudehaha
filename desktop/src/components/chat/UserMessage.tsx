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
    <div className="codex-task-stream-item flex justify-end">
      <div
        data-message-shell="user"
        data-local-conversation-user-anchor=""
        className="group/message relative flex min-w-0 max-w-[77%] flex-col items-end"
      >
        <div className="flex max-w-full flex-col items-end gap-2">
          {attachments && attachments.length > 0 && (
            <AttachmentGallery attachments={attachments} variant="message" />
          )}

          {hasText && (
            <div
              data-user-message-bubble={true}
              className="user-message-bubble min-w-0 max-w-full rounded-[var(--radius-2xl)] bg-[var(--color-surface-container-high)] px-3 py-2 text-[var(--text-size-chat)] leading-[calc(var(--text-size-chat)_+_8px)] text-[var(--color-token-foreground)] whitespace-pre-wrap break-words"
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
