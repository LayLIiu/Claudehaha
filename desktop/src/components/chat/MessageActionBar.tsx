import { Check, Copy, GitFork } from 'lucide-react'
import { useTranslation } from '../../i18n'
import { useSettingsStore } from '../../stores/settingsStore'
import { formatExactMessageTimestamp, formatMessageTimestamp } from '../../lib/formatMessageTimestamp'
import { CopyButton } from '../shared/CopyButton'

export type MessageBranchAction = {
  label: string
  loading?: boolean
  onBranch: () => void
}

type Props = {
  copyText?: string
  copyLabel: string
  branchAction?: MessageBranchAction
  align?: 'start' | 'end'
  timestamp?: number
}

export function MessageActionBar({
  copyText,
  copyLabel,
  branchAction,
  align = 'start',
  timestamp,
}: Props) {
  const t = useTranslation()
  const locale = useSettingsStore((state) => state.locale)
  const hasCopy = Boolean(copyText?.trim())
  const timeLabel = typeof timestamp === 'number'
    ? formatMessageTimestamp(timestamp, t, locale)
    : ''
  const exactTimeLabel = typeof timestamp === 'number'
    ? formatExactMessageTimestamp(timestamp, locale)
    : ''

  if (!hasCopy && !branchAction) return null

  return (
    <div
      data-message-actions
      data-align={align}
      className={`pointer-events-none mt-2 flex h-7 w-full translate-y-0.5 opacity-0 transition-[opacity,transform] duration-200 ease-out group-hover/message:pointer-events-auto group-hover/message:translate-y-0 group-hover/message:opacity-100 group-focus-within/message:pointer-events-auto group-focus-within/message:translate-y-0 group-focus-within/message:opacity-100 ${
        align === 'end' ? 'justify-end' : 'justify-start'
      }`}
    >
      <div className="flex min-h-7 items-center gap-1 rounded-full border border-transparent bg-transparent px-0.5">
        {hasCopy ? (
          <CopyButton
            text={copyText!}
            label={copyLabel}
            displayLabel={<Copy size={13} strokeWidth={2.2} aria-hidden="true" />}
            displayCopiedLabel={<Check size={13} strokeWidth={2.4} aria-hidden="true" />}
            onPointerUp={(event) => event.currentTarget.blur()}
            className="inline-flex h-[26px] w-[26px] items-center justify-center rounded-[9px] border border-transparent bg-transparent text-[var(--color-text-tertiary)] transition-[color,background-color,border-color] duration-150 hover:border-[var(--color-border)] hover:bg-[var(--color-surface-container-low)]/80 hover:text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand)]/30"
          />
        ) : null}
        {branchAction ? (
          <button
            type="button"
            onClick={branchAction.onBranch}
            disabled={branchAction.loading}
            aria-label={branchAction.label}
            title={branchAction.label}
            onPointerUp={(event) => event.currentTarget.blur()}
            className="inline-flex h-[26px] w-[26px] items-center justify-center rounded-[9px] border border-transparent bg-transparent text-[var(--color-text-tertiary)] transition-[color,background-color,border-color] duration-150 hover:border-[var(--color-border)] hover:bg-[var(--color-surface-container-low)]/80 hover:text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand)]/30 disabled:cursor-wait disabled:opacity-60"
          >
            <GitFork size={13} strokeWidth={2.2} aria-hidden="true" />
          </button>
        ) : null}
        {timeLabel ? (
          <span
            className={`inline-flex items-center text-[10.5px] font-medium tabular-nums text-[var(--color-text-tertiary)]/85 ${align === 'end' ? 'mr-0.5 ml-1.5' : 'ml-1 mr-0.5'}`}
            title={exactTimeLabel || timeLabel}
          >
            {timeLabel}
          </span>
        ) : null}
      </div>
    </div>
  )
}
