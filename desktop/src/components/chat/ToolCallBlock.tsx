import { memo, useMemo, useState } from 'react'
import { CircleStop, LoaderCircle } from 'lucide-react'
import type { AgentTaskNotification } from '../../types/chat'
import { PlanPreviewCard, extractPlanPreview, isExitPlanModeTool } from './PlanModePreview'
import { RollingDiffStats } from './RollingDiffStats'
import type { DiffStats } from './diffStats'
import { ToolLayout } from './ToolLayout'
import { classifyToolFamily, getFamilyActionLabel } from './toolFamily'
import {
  getToolIcon,
  getToolRenderer,
  getToolKindDetail,
  getToolResultSummary,
  getToolContentStats,
  extractTextContent,
} from './toolRenderers'
import { useTranslation } from '../../i18n'

type Props = {
  toolName: string
  input: unknown
  result?: { content: unknown; isError: boolean } | null
  agentTaskNotification?: AgentTaskNotification
  compact?: boolean
  isPending?: boolean
  status?: 'stopped'
  partialInput?: string
  diffStats?: DiffStats | null
}

export const ToolCallBlock = memo(function ToolCallBlock({ toolName, input, result, compact = false, isPending = false, status, partialInput, diffStats }: Props) {
  const isPlanTool = isExitPlanModeTool(toolName)
  const t = useTranslation()
  const obj = input && typeof input === 'object' ? (input as Record<string, unknown>) : {}
  const family = classifyToolFamily(toolName)
  const [runningLabel, completedLabel] = getFamilyActionLabel(family)
  const Icon = getToolIcon(toolName, family)
  const Renderer = getToolRenderer(family)

  // Kind detail: file name, command, etc.
  const kindDetail = getToolKindDetail(toolName, obj)

  // Result summary
  const outputSummary = result
    ? getToolResultSummary(toolName, result.content, result.isError)
    : ''

  // Live stats
  const liveStats = useMemo(
    () => getToolContentStats(toolName, obj, isPending ? partialInput : undefined),
    [isPending, obj, partialInput, toolName],
  )
  const liveStatsSummary = liveStats ? `${liveStats.lines} lines · ${liveStats.chars} chars` : ''

  // Determine running state
  const isRunning = !result && !isPlanTool
  const isError = !!result?.isError

  // Status label
  let statusLabel: React.ReactNode = null
  if (isPending && !result) {
    statusLabel = (
      <span className="inline-flex min-w-0 max-w-[58%] shrink-0 items-center gap-1 text-[10px] text-[var(--color-outline)]">
        <LoaderCircle size={12} strokeWidth={2.4} className="animate-spin" aria-hidden="true" />
        <span className="truncate">
          {toolName === 'Write' ? t('tool.generatingContent') : toolName === 'Edit' || toolName === 'MultiEdit' ? t('tool.preparingEdit') : t('tool.preparingTool')}
        </span>
        {liveStatsSummary && (
          <>
            <span className="shrink-0 text-[var(--color-token-text-secondary)]">·</span>
            <span className="shrink-0 font-[var(--font-mono)] tabular-nums text-[var(--color-token-text-secondary)]">
              {liveStatsSummary}
            </span>
          </>
        )}
      </span>
    )
  } else if (status === 'stopped' && !result) {
    statusLabel = (
      <span className="inline-flex shrink-0 items-center gap-1 text-[10px] text-[var(--color-outline)]">
        <CircleStop size={12} strokeWidth={2.25} aria-hidden="true" />
        {t('tool.stopped')}
      </span>
    )
  } else if (result && outputSummary) {
    statusLabel = (
      <span className={`shrink-0 text-[10px] ${isError ? 'text-[var(--color-error)]' : 'text-[var(--color-outline)]'}`}>
        {outputSummary}
      </span>
    )
  } else if (liveStatsSummary) {
    statusLabel = (
      <span className="shrink-0 font-[var(--font-mono)] text-[10px] tabular-nums text-[var(--color-outline)]">
        {liveStatsSummary}
      </span>
    )
  }

  // Error icon
  if (isError) {
    statusLabel = (
      <span className="inline-flex items-center gap-1">
        {statusLabel}
        <span className="text-[var(--color-error)]">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>
        </span>
      </span>
    )
  }

  // Primary text: diff stats for file operations
  const primaryText = diffStats ? (
    <RollingDiffStats stats={diffStats} variant="inline" className="text-[13px] font-medium" />
  ) : undefined

  // Whether expandable content exists
  const hasContent = Boolean(
    result && extractTextContent(result.content)
    || (toolName === 'Edit' && typeof obj.old_string === 'string' && typeof obj.new_string === 'string')
    || (toolName === 'Write' && typeof obj.content === 'string')
    || (toolName === 'Bash' && typeof obj.command === 'string')
    || (isPending && partialInput)
    || (family === 'fallback' || family === 'mcp' || family === 'todo' || family === 'session-context'),
  )

  // Plan mode special rendering
  if (isPlanTool) {
    return (
      <PlanToolCallBlock
        input={input}
        result={result}
        compact={compact}
        isPending={isPending}
      />
    )
  }

  return (
    <ToolLayout
      toolId={`${toolName}-${kindDetail}`}
      icon={Icon}
      kindLabel={`${isRunning ? runningLabel : completedLabel} ${toolName}`}
      kindDetail={kindDetail || undefined}
      primaryText={primaryText}
      statusLabel={statusLabel}
      isRunning={isRunning}
      showFailureStatus={isError}
      canToggle={hasContent}
      autoCollapseOnComplete={family === 'shell' || family === 'file-write'}
      animate={isRunning}
      dataToolName={toolName}
      dataStatus={isRunning ? 'in_progress' : isError ? 'failed' : 'completed'}
      compact={compact}
      renderContent={hasContent ? () => (
        <Renderer
          toolName={toolName}
          input={obj}
          result={result}
          isPending={isPending}
          status={status}
          partialInput={partialInput}
          diffStats={diffStats}
          compact={compact}
        />
      ) : undefined}
    />
  )
})

function PlanToolCallBlock({
  input,
  result,
  compact,
  isPending,
}: {
  input: unknown
  result?: { content: unknown; isError: boolean } | null
  compact: boolean
  isPending: boolean
}) {
  const t = useTranslation()
  const preview = extractPlanPreview(input, result?.content)
  const title = result?.isError
    ? t('permission.planRejected')
    : result
      ? t('permission.planApproved')
      : t('permission.planReadyTitle')
  const hasRawResult = Boolean(result && extractTextContent(result.content))
  const [expanded, setExpanded] = useState(true)

  return (
    <div className={`overflow-hidden rounded-[var(--radius-xl)] border border-[var(--color-brand)]/28 bg-[var(--color-surface-container-low)]/74 backdrop-blur-[10px] ${
      compact ? 'mb-0' : 'mb-[3px]'
    }`}>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors"
      >
        <span className="material-symbols-outlined icon-xs text-[var(--color-brand)]">architecture</span>
        <span className="min-w-0 flex-1 truncate text-[12px] font-semibold text-[var(--color-token-foreground)]">
          {title}
        </span>
        {preview.filePath ? (
          <span className="hidden max-w-[40%] truncate font-[var(--font-mono)] text-[11px] text-[var(--color-token-text-secondary)] sm:inline">
            {preview.filePath}
          </span>
        ) : null}
        {isPending ? (
          <span className="inline-flex shrink-0 items-center gap-1 text-[10px] text-[var(--color-outline)]">
            <LoaderCircle size={12} strokeWidth={2.4} className="animate-spin" aria-hidden="true" />
            {t('tool.preparingTool')}
          </span>
        ) : null}
        <span className="material-symbols-outlined icon-xs text-[var(--color-outline)]">
          {expanded ? 'expand_less' : 'expand_more'}
        </span>
      </button>

      {expanded ? (
        <div className="space-y-2.5 border-t border-[var(--color-token-border)]/60 px-3 py-3">
          <PlanPreviewCard
            title={t('permission.planPreviewTitle')}
            plan={preview.plan}
            filePath={preview.filePath}
            allowedPrompts={preview.allowedPrompts}
            requestedPermissionsTitle={t('permission.planRequestedPermissions')}
            emptyLabel={t('permission.planEmpty')}
          />
          {result?.isError && hasRawResult ? (
            <FallbackResultOutput result={result} />
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

function FallbackResultOutput({ result }: { result: { content: unknown; isError: boolean } }) {
  const text = extractTextContent(result.content) ?? ''
  if (!text) return null
  return (
    <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-error)]/20 bg-[var(--color-error-container)]/60">
      <pre className="max-h-[420px] overflow-auto whitespace-pre-wrap break-words bg-[var(--color-code-bg)] px-3 py-2 font-[var(--font-mono)] text-[12px] leading-[1.45] text-[var(--color-error)]">
        {text}
      </pre>
    </div>
  )
}

// Re-export for backward compatibility
export { extractTextContent } from './toolRenderers'
