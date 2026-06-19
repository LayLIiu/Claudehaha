import { useState } from 'react'
import { useChatStore } from '../../stores/chatStore'
import { useTabStore } from '../../stores/tabStore'
import { useTranslation } from '../../i18n'
import type { TranslationKey } from '../../i18n'
import { Button } from '../shared/Button'
import { DiffViewer } from './DiffViewer'
import {
  PlanPreviewCard,
  buildPromptPermissionUpdates,
  extractPlanPreview,
  isExitPlanModeTool,
} from './PlanModePreview'

type Props = {
  sessionId?: string | null
  requestId: string
  toolName: string
  input: unknown
  description?: string
  variant?: 'inline' | 'floating'
}

/**
 * Icons for known tool types.
 * Uses Material Symbols Outlined names.
 */
const TOOL_META: Record<string, { icon: string; label: string; color: string }> = {
  Bash: { icon: 'terminal', label: 'Bash', color: 'var(--color-warning)' },
  Edit: { icon: 'edit_note', label: 'Edit File', color: 'var(--color-brand)' },
  Write: { icon: 'edit_document', label: 'Write File', color: 'var(--color-success)' },
  Read: { icon: 'description', label: 'Read File', color: 'var(--color-secondary)' },
  Glob: { icon: 'search', label: 'Glob Search', color: 'var(--color-secondary)' },
  Grep: { icon: 'find_in_page', label: 'Grep Search', color: 'var(--color-secondary)' },
  Agent: { icon: 'smart_toy', label: 'Agent', color: 'var(--color-tertiary)' },
  WebSearch: { icon: 'travel_explore', label: 'Web Search', color: 'var(--color-secondary)' },
  WebFetch: { icon: 'cloud_download', label: 'Web Fetch', color: 'var(--color-secondary)' },
  NotebookEdit: { icon: 'note', label: 'Notebook Edit', color: 'var(--color-brand)' },
  Skill: { icon: 'auto_awesome', label: 'Skill', color: 'var(--color-tertiary)' },
}

/**
 * Extract human-readable detail lines from tool input.
 */
function extractToolDetails(toolName: string, input: unknown, t: (key: TranslationKey, params?: Record<string, string | number>) => string): { primary: string; secondary?: string } {
  const obj = (input && typeof input === 'object') ? input as Record<string, unknown> : {}

  switch (toolName) {
    case 'Bash': {
      const cmd = typeof obj.command === 'string' ? obj.command : ''
      const desc = typeof obj.description === 'string' ? obj.description : undefined
      return { primary: cmd, secondary: desc }
    }
    case 'Edit': {
      const filePath = typeof obj.file_path === 'string' ? obj.file_path : ''
      return { primary: filePath, secondary: obj.old_string ? t('permission.replacingContent') : undefined }
    }
    case 'Write': {
      const filePath = typeof obj.file_path === 'string' ? obj.file_path : ''
      return { primary: filePath }
    }
    case 'Read': {
      const filePath = typeof obj.file_path === 'string' ? obj.file_path : ''
      return { primary: filePath }
    }
    case 'Glob':
      return { primary: typeof obj.pattern === 'string' ? obj.pattern : '' }
    case 'Grep':
      return { primary: typeof obj.pattern === 'string' ? obj.pattern : '' }
    case 'Agent':
      return { primary: typeof obj.description === 'string' ? obj.description : '' }
    case 'WebSearch':
      return { primary: typeof obj.query === 'string' ? obj.query : '' }
    case 'WebFetch':
      return { primary: typeof obj.url === 'string' ? obj.url : '' }
    default:
      return { primary: typeof input === 'string' ? input : JSON.stringify(input, null, 2) }
  }
}

function getPermissionTitle(toolName: string, input: unknown, t: (key: TranslationKey, params?: Record<string, string | number>) => string) {
  const obj = (input && typeof input === 'object') ? input as Record<string, unknown> : {}
  const filePath = typeof obj.file_path === 'string' ? obj.file_path : ''
  const fileName = filePath ? filePath.split('/').pop() || filePath : ''

  switch (toolName) {
    case 'Edit':
    case 'Write':
      return fileName ? t('permission.allowEditFile', { toolName, fileName }) : t('permission.allowEditFileGeneric', { toolName: toolName.toLowerCase() })
    case 'Bash':
      return t('permission.allowBash')
    default:
      return t('permission.allowTool', { toolName })
  }
}

function renderPermissionPreview(toolName: string, input: unknown) {
  const obj = (input && typeof input === 'object') ? input as Record<string, unknown> : {}
  const filePath = typeof obj.file_path === 'string' ? obj.file_path : 'file'

  if (toolName === 'Edit' && typeof obj.old_string === 'string' && typeof obj.new_string === 'string') {
    return <DiffViewer filePath={filePath} oldString={obj.old_string} newString={obj.new_string} monochrome />
  }

  if (toolName === 'Write' && typeof obj.content === 'string') {
    return <DiffViewer filePath={filePath} oldString="" newString={obj.content} monochrome />
  }

  if (toolName === 'Bash' && typeof obj.command === 'string') {
    return (
      <div className="overflow-x-auto rounded-[var(--radius-xl)] border border-white/8 bg-[rgba(255,255,255,0.02)] px-3 py-3">
        <pre className="font-[var(--font-mono)] text-[11px] leading-[1.3] text-[var(--color-terminal-fg)] whitespace-pre-wrap break-words">
          <span className="text-[var(--color-terminal-accent)] select-none">$ </span>{obj.command}
        </pre>
      </div>
    )
  }

  return null
}

export function PermissionDialog({ sessionId, requestId, toolName, input, description, variant = 'inline' }: Props) {
  const { respondToPermission } = useChatStore()
  const activeTabId = useTabStore((s) => s.activeTabId)
  const targetSessionId = sessionId ?? activeTabId
  const pendingPermission = useChatStore((s) => targetSessionId ? s.sessions[targetSessionId]?.pendingPermission : undefined)
  const t = useTranslation()
  const isPending = pendingPermission?.requestId === requestId
  const [showRaw, setShowRaw] = useState(false)
  const [expanded, setExpanded] = useState(variant !== 'floating')

  if (isExitPlanModeTool(toolName)) {
    return (
      <ExitPlanModePermissionDialog
        sessionId={targetSessionId}
        requestId={requestId}
        input={input}
        description={description}
        isPending={isPending}
      />
    )
  }

  const meta = TOOL_META[toolName] || { icon: 'shield', label: toolName, color: 'var(--color-token-text-secondary)' }
  const details = extractToolDetails(toolName, input, t)
  const rawInput = typeof input === 'string' ? input : JSON.stringify(input, null, 2)
  const preview = renderPermissionPreview(toolName, input)
  const title = getPermissionTitle(toolName, input, t)
  const allowRawToggle = !preview
  const isFloating = variant === 'floating'
  const containerClassName = isFloating
    ? `overflow-hidden rounded-[var(--radius-3xl)] border ${
        isPending
          ? 'border-white/10 bg-[rgba(42,42,42,0.96)] shadow-[0_28px_90px_rgba(0,0,0,0.52)] backdrop-blur-[18px]'
          : 'border-white/7 bg-[rgba(42,42,42,0.9)] opacity-85 backdrop-blur-[18px]'
      }`
    : `mb-4 overflow-hidden rounded-[var(--radius-lg)] border ${
        isPending
          ? 'border-[var(--color-warning)] bg-[var(--color-token-bg-subtle,rgba(255,255,255,0.04))]'
          : 'border-[var(--color-outline-variant)]/40 bg-[var(--color-surface-container-low)] opacity-70'
      }`
  const headerClassName = isFloating
    ? `flex items-center gap-3 px-4 py-3.5 ${
        isPending ? 'bg-white/[0.035]' : 'bg-white/[0.02]'
      }`
    : `flex items-center gap-3 px-4 py-3 ${
        isPending
          ? 'bg-[var(--color-surface-container)]'
          : 'bg-[var(--color-surface-container-low)]'
      }`
  const bodyClassName = isFloating
    ? 'border-t border-white/8 px-4 py-3.5'
    : 'border-t border-[var(--color-outline-variant)]/20 px-4 py-3'
  const actionClassName = isFloating
    ? 'flex items-center gap-2 border-t border-white/8 bg-white/[0.02] px-4 py-3.5'
    : 'flex items-center gap-2 border-t border-[var(--color-outline-variant)]/20 bg-[var(--color-surface-container-low)] px-4 py-3'
  const detailChipClassName = isFloating
    ? 'flex items-center gap-2 rounded-[var(--radius-xl)] border border-white/8 bg-[rgba(255,255,255,0.025)] px-3 py-2 text-xs font-[var(--font-mono)] text-[rgba(255,255,255,0.62)]'
    : 'flex items-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-surface-container)] px-3 py-2 text-xs font-[var(--font-mono)] text-[var(--color-token-text-secondary)]'
  const floatingActionButtonClassName = 'inline-flex h-12 w-full items-center justify-start gap-2 rounded-[var(--radius-xl)] border px-4 text-[14px] font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/15'
  const floatingSecondaryButtonClassName = `${floatingActionButtonClassName} border-white/8 bg-[rgba(255,255,255,0.025)] text-[rgba(255,255,255,0.82)] hover:bg-[rgba(255,255,255,0.05)]`
  const floatingPrimaryButtonClassName = `${floatingActionButtonClassName} border-white/10 bg-[rgba(255,255,255,0.08)] text-white hover:bg-[rgba(255,255,255,0.12)]`
  const floatingDangerButtonClassName = `${floatingActionButtonClassName} border-white/8 bg-[rgba(255,255,255,0.025)] text-[rgba(255,255,255,0.82)] hover:bg-[rgba(255,255,255,0.05)]`
  const rawPreviewClassName = isFloating
    ? 'mt-2 max-h-[220px] overflow-y-auto overflow-x-auto rounded-[var(--radius-xl)] border border-white/8 bg-[rgba(255,255,255,0.02)] px-3 py-3 font-[var(--font-mono)] text-[11px] leading-[1.3] text-[rgba(255,255,255,0.76)] whitespace-pre-wrap break-words'
    : 'mt-2 max-h-[220px] overflow-y-auto overflow-x-auto rounded-[var(--radius-md)] bg-[var(--color-terminal-bg)] px-3 py-2.5 font-[var(--font-mono)] text-[11px] leading-[1.3] text-[var(--color-terminal-fg)] whitespace-pre-wrap break-words'
  const summaryText = details.primary || details.secondary || description || meta.label

  return (
    <div className={containerClassName}>
      {/* Header */}
      <div className={headerClassName}>
        <div
          className={isFloating
            ? 'flex h-10 w-10 items-center justify-center rounded-[var(--radius-xl)] border border-white/8 bg-[rgba(255,255,255,0.02)]'
            : 'flex items-center justify-center w-8 h-8 rounded-[var(--radius-md)]'}
          style={isFloating ? undefined : { backgroundColor: `${meta.color}18` }}
        >
          <span
            className={`material-symbols-outlined ${isFloating ? 'text-[20px]' : 'text-[18px]'}`}
            style={{ color: meta.color }}
          >
            {meta.icon}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5">
            <span className={isFloating ? 'text-[15px] font-semibold text-white' : 'text-sm font-semibold text-[var(--color-token-foreground)]'}>
              {title}
            </span>
            {isPending && (
              <span className={isFloating
                ? 'inline-flex items-center gap-1 rounded-full border border-white/8 bg-[rgba(255,255,255,0.045)] px-2 py-0.5 text-[10px] font-medium tracking-[0.01em] text-[rgba(255,255,255,0.72)]'
                : 'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[var(--color-warning)]/15 text-[var(--color-warning)]'}>
                <span className={`w-1.5 h-1.5 rounded-full ${isFloating ? 'bg-[rgba(255,255,255,0.6)]' : 'bg-[var(--color-warning)] animate-pulse-dot'}`} />
                {t('permission.awaitingApproval')}
              </span>
            )}
            {!isPending && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[var(--color-surface-container-high)] text-[var(--color-token-text-secondary)]">
                {t('permission.responded')}
              </span>
            )}
          </div>
          <p className={`mt-0.5 truncate ${isFloating ? 'text-[12px] text-[rgba(255,255,255,0.44)]' : 'text-xs text-[var(--color-token-text-secondary)]'}`}>
            {description || `${meta.label} · 等待你确认后继续执行`}
          </p>
        </div>
        {isFloating ? (
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            className="inline-flex h-9 shrink-0 items-center gap-1 rounded-[var(--radius-lg)] border border-white/8 bg-[rgba(255,255,255,0.02)] px-3 text-[12px] text-[rgba(255,255,255,0.62)] transition-colors hover:bg-[rgba(255,255,255,0.05)] hover:text-white"
          >
            <span className="material-symbols-outlined icon-sm">
              {expanded ? 'expand_less' : 'expand_more'}
            </span>
            {expanded ? '收起详情' : '展开详情'}
          </button>
        ) : null}
      </div>

      {/* Tool details */}
      <div className={bodyClassName}>
        {!expanded && isFloating ? (
          <div className="space-y-2">
            {summaryText ? (
              <div className={detailChipClassName}>
                <span className="material-symbols-outlined icon-xs text-[var(--color-outline)] flex-shrink-0">
                  {toolName === 'Glob' || toolName === 'Grep' ? 'search' : toolName === 'Bash' ? 'terminal' : 'folder_open'}
                </span>
                <span className="truncate">{summaryText}</span>
              </div>
            ) : null}
            <p className="text-[12px] text-[rgba(255,255,255,0.38)]">
              点击“展开详情”后查看完整审批内容
            </p>
          </div>
        ) : (
          <>
            {preview ? (
              <div className="space-y-2">
                {details.primary && toolName !== 'Bash' ? (
                  <div className={detailChipClassName}>
                    <span className="material-symbols-outlined icon-xs text-[var(--color-outline)] flex-shrink-0">
                      folder_open
                    </span>
                    <span className="truncate">{details.primary}</span>
                  </div>
                ) : null}
                {preview}
              </div>
            ) : details.primary ? (
              <div className="mb-2">
                <div className={detailChipClassName}>
                  <span className="material-symbols-outlined icon-xs text-[var(--color-outline)] flex-shrink-0">
                    {toolName === 'Glob' || toolName === 'Grep' ? 'search' : 'folder_open'}
                  </span>
                  <span className="truncate">{details.primary}</span>
                </div>
              </div>
            ) : null}

            {details.secondary && (
              <p className={`mt-2 ${isFloating ? 'text-[12px] text-[rgba(255,255,255,0.42)]' : 'text-xs text-[var(--color-token-text-secondary)]'}`}>{details.secondary}</p>
            )}

            {allowRawToggle && (
              <button
                onClick={() => setShowRaw(!showRaw)}
                className={isFloating
                  ? 'mt-3 flex cursor-pointer items-center gap-1 rounded-[var(--radius-md)] px-2 py-1 text-[11px] text-[rgba(255,255,255,0.52)] transition-colors hover:bg-white/[0.04] hover:text-white'
                  : 'mt-2 flex cursor-pointer items-center gap-1 text-[11px] text-[var(--color-text-accent)] hover:underline'}
              >
                <span className="material-symbols-outlined icon-xs">
                  {showRaw ? 'expand_less' : 'expand_more'}
                </span>
                {showRaw ? t('permission.hideDetails') : t('permission.showFullInput')}
              </button>
            )}

            {allowRawToggle && showRaw && (
              <pre className={rawPreviewClassName}>
                {rawInput}
              </pre>
            )}
          </>
        )}
      </div>

      {/* Action buttons */}
      {isPending && (
        <div className={actionClassName}>
          {isFloating ? (
            <div className="flex w-full flex-col gap-2">
              <button
                type="button"
                onClick={() => targetSessionId && respondToPermission(targetSessionId, requestId, true)}
                className={floatingPrimaryButtonClassName}
              >
                <span className="material-symbols-outlined icon-sm">check</span>
                {t('permission.allow')}
              </button>
              <button
                type="button"
                onClick={() => targetSessionId && respondToPermission(targetSessionId, requestId, true, { rule: 'always' })}
                className={floatingSecondaryButtonClassName}
              >
                <span className="material-symbols-outlined icon-sm">verified</span>
                {t('permission.allowForSession')}
              </button>
              <button
                type="button"
                onClick={() => targetSessionId && respondToPermission(targetSessionId, requestId, false)}
                className={floatingDangerButtonClassName}
              >
                <span className="material-symbols-outlined icon-sm">close</span>
                {t('permission.deny')}
              </button>
            </div>
          ) : (
            <>
              <Button
                variant="primary"
                size="sm"
                onClick={() => targetSessionId && respondToPermission(targetSessionId, requestId, true)}
                icon={
                  <span className="material-symbols-outlined icon-xs">check</span>
                }
              >
                {t('permission.allow')}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => targetSessionId && respondToPermission(targetSessionId, requestId, true, { rule: 'always' })}
                icon={
                  <span className="material-symbols-outlined icon-xs">verified</span>
                }
              >
                {t('permission.allowForSession')}
              </Button>
              <div className="flex-1" />
              <Button
                variant="danger"
                size="sm"
                onClick={() => targetSessionId && respondToPermission(targetSessionId, requestId, false)}
                icon={
                  <span className="material-symbols-outlined icon-xs">close</span>
                }
              >
                {t('permission.deny')}
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  )
}

function ExitPlanModePermissionDialog({
  sessionId,
  requestId,
  input,
  description,
  isPending,
}: {
  sessionId?: string | null
  requestId: string
  input: unknown
  description?: string
  isPending: boolean
}) {
  const { respondToPermission } = useChatStore()
  const t = useTranslation()
  const [feedback, setFeedback] = useState('')
  const preview = extractPlanPreview(input)
  const permissionUpdates = buildPromptPermissionUpdates(preview.allowedPrompts)
  const trimmedFeedback = feedback.trim()

  return (
    <div className={`mb-4 overflow-hidden rounded-[var(--radius-lg)] border ${
      isPending
        ? 'border-[var(--color-brand)]/60 bg-[var(--color-token-bg-subtle,rgba(255,255,255,0.04))]'
        : 'border-[var(--color-outline-variant)]/40 bg-[var(--color-surface-container-low)] opacity-70'
    }`}>
      <div className={`flex items-center gap-3 px-4 py-3 ${
        isPending
          ? 'bg-[var(--color-surface-container)]'
          : 'bg-[var(--color-surface-container-low)]'
      }`}>
        <div className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-brand)]/15">
          <span className="material-symbols-outlined icon-md text-[var(--color-brand)]">architecture</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-[var(--color-token-foreground)]">
              {t('permission.planReadyTitle')}
            </span>
            {isPending ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-brand)]/15 px-2 py-0.5 text-[10px] font-bold uppercase text-[var(--color-brand)]">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-brand)] animate-pulse-dot" />
                {t('permission.awaitingApproval')}
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full bg-[var(--color-surface-container-high)] px-2 py-0.5 text-[10px] font-bold uppercase text-[var(--color-token-text-secondary)]">
                {t('permission.responded')}
              </span>
            )}
          </div>
          {description ? (
            <p className="mt-0.5 truncate text-xs text-[var(--color-token-text-secondary)]">{description}</p>
          ) : null}
        </div>
      </div>

      <div className="space-y-3 border-t border-[var(--color-outline-variant)]/20 px-4 py-3">
        <PlanPreviewCard
          title={t('permission.planPreviewTitle')}
          plan={preview.plan}
          filePath={preview.filePath}
          allowedPrompts={preview.allowedPrompts}
          requestedPermissionsTitle={t('permission.planRequestedPermissions')}
          emptyLabel={t('permission.planEmpty')}
        />
        {isPending ? (
          <textarea
            value={feedback}
            onChange={(event) => setFeedback(event.target.value)}
            placeholder={t('permission.planFeedbackPlaceholder')}
            rows={3}
            className="min-h-[72px] w-full resize-y rounded-[var(--radius-md)] border border-[var(--color-token-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-token-foreground)] outline-none transition-colors placeholder:text-[var(--color-token-text-secondary)] focus:border-[var(--color-brand)]/60 focus:ring-2 focus:ring-[var(--color-brand)]/15"
          />
        ) : null}
      </div>

      {isPending ? (
        <div className="flex items-center gap-2 border-t border-[var(--color-outline-variant)]/20 bg-[var(--color-surface-container-low)] px-4 py-3">
          <Button
            variant="primary"
            size="sm"
            onClick={() => sessionId && respondToPermission(sessionId, requestId, true, permissionUpdates.length ? { permissionUpdates } : undefined)}
            icon={<span aria-hidden="true" className="material-symbols-outlined icon-xs">check</span>}
          >
            {t('permission.planApprove')}
          </Button>
          <div className="flex-1" />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => sessionId && respondToPermission(sessionId, requestId, false, trimmedFeedback ? { denyMessage: trimmedFeedback } : undefined)}
            icon={<span aria-hidden="true" className="material-symbols-outlined icon-xs">edit_note</span>}
          >
            {t('permission.planKeepPlanning')}
          </Button>
        </div>
      ) : null}
    </div>
  )
}
