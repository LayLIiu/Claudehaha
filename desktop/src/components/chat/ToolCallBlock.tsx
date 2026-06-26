import { memo, useMemo, useState } from 'react'
import { CircleStop, LoaderCircle } from 'lucide-react'
import { CodeViewer } from './CodeViewer'
import { DiffViewer } from './DiffViewer'
import { TerminalChrome } from './TerminalChrome'
import { CopyButton } from '../shared/CopyButton'
import { useTranslation } from '../../i18n'
import type { TranslationKey } from '../../i18n'
import { InlineImageGallery } from './InlineImageGallery'
import type { AgentTaskNotification } from '../../types/chat'
import { PlanPreviewCard, extractPlanPreview, isExitPlanModeTool } from './PlanModePreview'
import { extractPartialJsonStringField } from './extractPartialJsonStringField'
import { RollingDiffStats } from './RollingDiffStats'
import type { DiffStats } from './diffStats'

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

const TOOL_ICONS: Record<string, string> = {
  Bash: 'terminal',
  Read: 'description',
  Write: 'edit_document',
  Edit: 'edit_note',
  Glob: 'search',
  Grep: 'find_in_page',
  Agent: 'smart_toy',
  WebSearch: 'travel_explore',
  WebFetch: 'cloud_download',
  NotebookEdit: 'note',
  Skill: 'auto_awesome',
}

/* Chinese action labels: [进行中, 已完成] */
const TOOL_ACTION_LABEL: Record<string, [string, string]> = {
  Bash: ['正在运行', '已运行'],
  Read: ['正在读取', '已读取'],
  Write: ['正在写入', '已写入'],
  Edit: ['正在编辑', '已编辑'],
  Glob: ['正在搜索', '已搜索'],
  Grep: ['正在搜索', '已搜索'],
  Agent: ['正在派发', '已派发'],
  WebSearch: ['正在搜索', '已搜索'],
  WebFetch: ['正在获取', '已获取'],
  NotebookEdit: ['正在编辑', '已编辑'],
  Skill: ['正在执行', '已执行'],
}

const WRITER_PREVIEW_MAX_LINES = 120
const WRITER_PREVIEW_MAX_CHARS = 30000

type ContentStats = {
  lines: number
  chars: number
  visibleLines?: number
  windowed?: boolean
}

export const ToolCallBlock = memo(function ToolCallBlock({ toolName, input, result, compact = false, isPending = false, status, partialInput, diffStats }: Props) {
  const isPlanTool = isExitPlanModeTool(toolName)
  const [expanded, setExpanded] = useState(isPlanTool)
  const t = useTranslation()
  const obj = input && typeof input === 'object' ? (input as Record<string, unknown>) : {}
  const icon = TOOL_ICONS[toolName] || 'build'
  const filePath = typeof obj.file_path === 'string' ? obj.file_path : ''
  const summary = getToolSummary(toolName, obj, t)
  const outputSummary = getToolResultSummary(
    toolName,
    result?.content,
    result?.isError ?? false,
    t,
  )
  const pendingSummary = isPending && !result
    ? getPendingSummary(toolName, t)
    : ''
  const stoppedSummary = status === 'stopped' && !result
    ? t('tool.stopped')
    : ''
  const liveStats = useMemo(
    () => getToolContentStats(toolName, obj, isPending ? partialInput : undefined),
    [isPending, obj, partialInput, toolName],
  )
  const liveStatsSummary = liveStats ? formatContentStats(liveStats, t) : ''

  const preview = useMemo(() => renderPreview(toolName, obj, result, t), [obj, result, toolName, t])
  const details = useMemo(() => renderDetails(toolName, obj, t, isPending ? partialInput : undefined), [isPending, obj, partialInput, toolName, t])
  const hasResultDetails = Boolean(result && extractTextContent(result.content))
  const hasEditPreview = toolName === 'Edit' && typeof obj.old_string === 'string' && typeof obj.new_string === 'string'
  const hasWritePreview = toolName === 'Write' && typeof obj.content === 'string'
  const expandable = hasEditPreview || hasWritePreview || hasResultDetails || Boolean(isPending && partialInput)

  if (isPlanTool) {
    return (
      <PlanToolCallBlock
        input={input}
        result={result}
        compact={compact}
        isPending={isPending}
        expanded={expanded}
        onToggle={() => setExpanded((value) => !value)}
      />
    )
  }

  return (
    <div className={`tool-call-row codex-execution-row ${
      compact ? 'mb-0' : 'mb-[3px]'
    }`}>
      <button
        type="button"
        onClick={() => {
          if (expandable) {
            setExpanded((value) => !value)
          }
        }}
        className="codex-execution-row-header flex w-full items-center gap-2 rounded-[var(--radius-sm)] px-2 py-1.5 text-left transition-colors"
      >
        <span className="codex-execution-icon material-symbols-outlined icon-xs text-[var(--color-outline)]">{icon}</span>
          <span className="text-[11px] font-semibold tracking-[0.03em] text-[var(--color-token-text-secondary)]">
            {!result ? (TOOL_ACTION_LABEL[toolName]?.[0] || '正在执行') : (TOOL_ACTION_LABEL[toolName]?.[1] || '已执行')} {toolName}
          </span>
        {filePath ? (
          <span className="flex min-w-0 flex-1 items-center gap-1.5">
            <span className="min-w-0 truncate font-[var(--font-mono)] text-[11px] text-[var(--color-token-text-secondary)]">
              {filePath.split('/').pop()}
            </span>
            {diffStats ? (
              <RollingDiffStats stats={diffStats} variant="inline" className="text-[13px] font-medium" />
            ) : null}
          </span>
        ) : summary ? (
          <span className="flex min-w-0 flex-1 items-center gap-1.5">
            <span className="min-w-0 truncate font-[var(--font-mono)] text-[11px] text-[var(--color-token-text-secondary)]">
              {summary}
            </span>
            {diffStats ? (
              <RollingDiffStats stats={diffStats} variant="inline" className="text-[13px] font-medium" />
            ) : null}
          </span>
        ) : (
          <span className="flex-1" />
        )}
        {pendingSummary ? (
          <span
            className="inline-flex min-w-0 max-w-[58%] shrink-0 items-center gap-1 text-[10px] text-[var(--color-outline)]"
            title={liveStatsSummary ? `${pendingSummary} · ${liveStatsSummary}` : pendingSummary}
          >
            <LoaderCircle size={12} strokeWidth={2.4} className="animate-spin" aria-hidden="true" />
            <span className="truncate">{pendingSummary}</span>
            {liveStatsSummary ? (
              <>
                <span className="shrink-0 text-[var(--color-token-text-secondary)]">·</span>
                <span className="shrink-0 font-[var(--font-mono)] tabular-nums text-[var(--color-token-text-secondary)]">
                  {liveStatsSummary}
                </span>
              </>
            ) : null}
          </span>
        ) : stoppedSummary ? (
          <span className="inline-flex shrink-0 items-center gap-1 text-[10px] text-[var(--color-outline)]">
            <CircleStop size={12} strokeWidth={2.25} aria-hidden="true" />
            {stoppedSummary}
          </span>
        ) : result && outputSummary ? (
          <span
            className={`shrink-0 text-[10px] ${
              result.isError
                ? 'text-[var(--color-error)]'
                : 'text-[var(--color-outline)]'
            }`}
          >
            {outputSummary}
          </span>
        ) : liveStatsSummary ? (
          <span className="shrink-0 font-[var(--font-mono)] text-[10px] tabular-nums text-[var(--color-outline)]">
            {liveStatsSummary}
          </span>
        ) : null}
        {result?.isError && (
          <span className="material-symbols-outlined shrink-0 text-[14px] text-[var(--color-error)]">error</span>
        )}
        {expandable && (
          <span className="material-symbols-outlined icon-xs text-[var(--color-outline)]">
            {expanded ? 'expand_less' : 'expand_more'}
          </span>
        )}
      </button>

      {expandable && expanded && (
        <div className="ml-3 mt-1.5 space-y-2.5 border-l border-[var(--color-token-border)]/38 pl-3">
          {preview}
          {details}
        </div>
      )}
    </div>
  )
})

function PlanToolCallBlock({
  input,
  result,
  compact,
  isPending,
  expanded,
  onToggle,
}: {
  input: unknown
  result?: { content: unknown; isError: boolean } | null
  compact: boolean
  isPending: boolean
  expanded: boolean
  onToggle: () => void
}) {
  const t = useTranslation()
  const preview = extractPlanPreview(input, result?.content)
  const title = result?.isError
    ? t('permission.planRejected')
    : result
      ? t('permission.planApproved')
      : t('permission.planReadyTitle')
  const hasRawResult = Boolean(result && extractTextContent(result.content))

  return (
    <div className={`overflow-hidden rounded-[var(--radius-xl)] border border-[var(--color-brand)]/28 bg-[var(--color-surface-container-low)]/74 backdrop-blur-[10px] ${
      compact ? 'mb-0' : 'mb-[3px]'
    }`}>
      <button
        type="button"
        onClick={onToggle}
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
            renderResultOutput(result, extractTextContent(result.content) ?? '', t)
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

function renderPreview(
  toolName: string,
  obj: Record<string, unknown>,
  result?: { content: unknown; isError: boolean } | null,
  t?: (key: TranslationKey, params?: Record<string, string | number>) => string,
) {
  const filePath = typeof obj.file_path === 'string' ? obj.file_path : 'file'
  const resultText = getVisibleResultText(toolName, result)
  const resultOutput = result && resultText ? renderResultOutput(result, resultText, t) : null

  if (toolName === 'Edit' && typeof obj.old_string === 'string' && typeof obj.new_string === 'string') {
    return (
      <>
        <DiffViewer filePath={filePath} oldString={obj.old_string} newString={obj.new_string} />
        {resultOutput}
      </>
    )
  }

  if (toolName === 'Write' && typeof obj.content === 'string') {
    return (
      <>
        <DiffViewer filePath={filePath} oldString="" newString={obj.content} />
        {resultOutput}
      </>
    )
  }

  if (toolName === 'Bash' && typeof obj.command === 'string') {
    return (
      <>
        <TerminalChrome title={typeof obj.description === 'string' ? obj.description : filePath}>
          <div className="px-3 py-2.5 font-[var(--font-mono)] text-[11px] leading-[1.3] text-[var(--color-terminal-fg)]">
            <span className="text-[var(--color-terminal-accent)]">$</span> {obj.command}
          </div>
        </TerminalChrome>
        {resultOutput}
      </>
    )
  }

  if (toolName === 'Read') {
    return resultOutput
  }

  if (resultOutput) return resultOutput

  return null
}

function getVisibleResultText(
  toolName: string,
  result?: { content: unknown; isError: boolean } | null,
): string | null {
  if (!result) return null
  const text = extractTextContent(result.content)
  if (!text) return null

  if (result.isError) return text
  if (toolName === 'Bash' || toolName === 'Read' || toolName === 'Edit' || toolName === 'Write') return null
  return text
}

function renderResultOutput(
  result: { content: unknown; isError: boolean },
  text: string,
  t?: (key: TranslationKey, params?: Record<string, string | number>) => string,
) {
  return (
    <>
      <InlineImageGallery text={text} />
      <div className={`overflow-hidden rounded-[var(--radius-lg)] border ${
        result.isError
          ? 'border-[var(--color-error)]/20 bg-[var(--color-error-container)]/60'
          : 'border-[var(--color-token-border)] bg-[var(--color-surface)]'
      }`}>
        <div className="flex items-center justify-between border-b border-[var(--color-token-border)]/60 px-3 py-2 text-[10px] uppercase tracking-[0.18em] text-[var(--color-outline)]">
          <span>{result.isError ? t?.('tool.errorOutput') ?? 'Error Output' : t?.('tool.toolOutput') ?? 'Tool Output'}</span>
          <CopyButton
            text={text}
            className="rounded-[var(--radius-md)] border border-[var(--color-token-border)] px-2 py-1 text-[10px] normal-case tracking-normal text-[var(--color-token-text-secondary)] transition-colors hover:text-[var(--color-token-foreground)]"
          />
        </div>
        {result.isError ? (
          <pre className="max-h-[420px] overflow-auto whitespace-pre-wrap break-words bg-[var(--color-code-bg)] px-3 py-2 font-[var(--font-mono)] text-[12px] leading-[1.45] text-[var(--color-error)]">
            {text}
          </pre>
        ) : (
          <CodeViewer code={text} language="plaintext" maxLines={18} />
        )}
      </div>
    </>
  )
}

function renderDetails(
  toolName: string,
  obj: Record<string, unknown>,
  t?: (key: TranslationKey, params?: Record<string, string | number>) => string,
  partialInput?: string,
) {
  if (partialInput) {
    if (toolName === 'Write') {
      const writerContent = extractPartialJsonStringField(partialInput, 'content')
      if (writerContent !== null) {
        return renderWriterPreview(writerContent, t)
      }
    }
    return renderPartialInput(partialInput, t)
  }

  if (toolName === 'Edit' || toolName === 'Write') {
    return null
  }

  const text = JSON.stringify(obj, null, 2)
  return (
    <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-token-border)] bg-[var(--color-surface)]">
      <div className="flex items-center justify-between border-b border-[var(--color-token-border)] px-3 py-2 text-[10px] uppercase tracking-[0.18em] text-[var(--color-outline)]">
        <span>{t?.('tool.toolInput') ?? 'Tool Input'}</span>
        <CopyButton
          text={text}
          className="rounded-[var(--radius-md)] border border-[var(--color-token-border)] px-2 py-1 text-[10px] normal-case tracking-normal text-[var(--color-token-text-secondary)] transition-colors hover:text-[var(--color-token-foreground)]"
        />
      </div>
      <CodeViewer code={text} language="json" maxLines={18} />
    </div>
  )
}

function getToolContentStats(
  toolName: string,
  obj: Record<string, unknown>,
  partialInput?: string,
): ContentStats | null {
  const content = getToolContentForStats(toolName, obj, partialInput)
  return content === null ? null : countContentStats(content)
}

function getToolContentForStats(
  toolName: string,
  obj: Record<string, unknown>,
  partialInput?: string,
): string | null {
  if (toolName === 'Write') {
    if (typeof obj.content === 'string') return obj.content
    return partialInput ? extractPartialJsonStringField(partialInput, 'content') : null
  }

  if (toolName === 'Edit') {
    if (typeof obj.new_string === 'string') return obj.new_string
    return partialInput ? extractPartialJsonStringField(partialInput, 'new_string') : null
  }

  if (toolName === 'MultiEdit' && Array.isArray(obj.edits)) {
    const replacements = obj.edits
      .map((edit) => (
        edit && typeof edit === 'object' && typeof (edit as Record<string, unknown>).new_string === 'string'
          ? (edit as Record<string, string>).new_string
          : ''
      ))
      .filter(Boolean)
    return replacements.length > 0 ? replacements.join('\n') : null
  }

  return null
}

function countContentStats(content: string): ContentStats {
  return {
    lines: content.length === 0 ? 0 : content.split('\n').length,
    chars: content.length,
  }
}

function formatContentStats(
  stats: ContentStats,
  t?: (key: TranslationKey, params?: Record<string, string | number>) => string,
): string {
  const chars = formatCharCount(stats.chars, t)
  if (stats.windowed && typeof stats.visibleLines === 'number' && stats.visibleLines < stats.lines) {
    return t?.('tool.contentStatsLatest', {
      visible: formatCount(stats.visibleLines),
      total: formatCount(stats.lines),
      chars,
    }) ?? `Latest ${formatCount(stats.visibleLines)} / ${formatCount(stats.lines)} lines · ${chars}`
  }

  return t?.('tool.contentStats', {
    lines: formatLineCount(stats.lines, t),
    chars,
  }) ?? `${formatLineCount(stats.lines, t)} · ${chars}`
}

function formatLineCount(
  count: number,
  t?: (key: TranslationKey, params?: Record<string, string | number>) => string,
): string {
  return count === 1
    ? (t?.('tool.lineCountSingular', { count: formatCount(count) }) ?? `${formatCount(count)} line`)
    : (t?.('tool.lineCountPlural', { count: formatCount(count) }) ?? `${formatCount(count)} lines`)
}

function formatCharCount(
  count: number,
  t?: (key: TranslationKey, params?: Record<string, string | number>) => string,
): string {
  return count === 1
    ? (t?.('tool.charCountSingular', { count: formatCount(count) }) ?? `${formatCount(count)} char`)
    : (t?.('tool.charCountPlural', { count: formatCount(count) }) ?? `${formatCount(count)} chars`)
}

function formatCount(count: number): string {
  return new Intl.NumberFormat().format(count)
}

function renderWriterPreview(
  content: string,
  t?: (key: TranslationKey, params?: Record<string, string | number>) => string,
) {
  const contentStats = countContentStats(content)
  const lines = content.length === 0 ? [] : content.split('\n')
  const totalLines = contentStats.lines
  const visibleLines = lines.length > WRITER_PREVIEW_MAX_LINES
    ? lines.slice(-WRITER_PREVIEW_MAX_LINES)
    : lines
  let visibleContent = visibleLines.join('\n')
  const charTruncated = visibleContent.length > WRITER_PREVIEW_MAX_CHARS
  if (charTruncated) {
    visibleContent = visibleContent.slice(-WRITER_PREVIEW_MAX_CHARS)
  }
  const lineWindowed = totalLines > visibleLines.length
  const isWindowed = lineWindowed || charTruncated
  const visibleLineCount = visibleContent.length === 0 ? 0 : visibleContent.split('\n').length
  const statsSummary = formatContentStats({
    lines: totalLines,
    chars: contentStats.chars,
    visibleLines: visibleLineCount,
    windowed: isWindowed,
  }, t)

  return (
    <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-token-border)] bg-[var(--color-surface)]">
      <div className="flex items-center justify-between border-b border-[var(--color-token-border)] px-3 py-2 text-[10px] uppercase tracking-[0.18em] text-[var(--color-outline)]">
        <span>{t?.('tool.writerPreview') ?? 'Writer'}</span>
        <span className="font-[var(--font-mono)] normal-case tracking-normal tabular-nums">
          {statsSummary}
        </span>
      </div>
      <pre className="max-h-[420px] overflow-auto whitespace-pre-wrap break-words bg-[var(--color-code-bg)] px-3 py-2 font-[var(--font-mono)] text-[12px] leading-[1.45] text-[var(--color-code-fg)]">
        {visibleContent}
      </pre>
    </div>
  )
}

function renderPartialInput(
  partialInput: string,
  t?: (key: TranslationKey, params?: Record<string, string | number>) => string,
) {
  const formattedInput = formatPartialJsonInput(partialInput)

  return (
    <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-token-border)] bg-[var(--color-surface)]">
      <div className="border-b border-[var(--color-token-border)] px-3 py-2 text-[10px] uppercase tracking-[0.18em] text-[var(--color-outline)]">
        {t?.('tool.partialInput') ?? 'Partial input'}
      </div>
      <CodeViewer code={formattedInput} language="json" maxLines={8} wrapLongLines />
    </div>
  )
}

function formatPartialJsonInput(source: string): string {
  const trimmed = source.trim()
  if (!trimmed) return source

  try {
    return JSON.stringify(JSON.parse(trimmed), null, 2)
  } catch {
    return formatJsonLikeInput(trimmed)
  }
}

function formatJsonLikeInput(source: string): string {
  let output = ''
  let indent = 0
  let inString = false
  let escaping = false
  let skipWhitespace = false

  const newline = () => {
    output = output.trimEnd()
    output += `\n${'  '.repeat(indent)}`
    skipWhitespace = true
  }

  for (const char of source) {
    if (inString) {
      output += char
      if (escaping) {
        escaping = false
      } else if (char === '\\') {
        escaping = true
      } else if (char === '"') {
        inString = false
      }
      continue
    }

    if (skipWhitespace && /\s/.test(char)) continue
    skipWhitespace = false

    if (char === '"') {
      inString = true
      output += char
      continue
    }

    if (char === '{' || char === '[') {
      output += char
      indent += 1
      newline()
      continue
    }

    if (char === '}' || char === ']') {
      indent = Math.max(0, indent - 1)
      if (!output.endsWith('\n')) newline()
      output += char
      continue
    }

    if (char === ',') {
      output += char
      newline()
      continue
    }

    if (char === ':') {
      output += ': '
      skipWhitespace = true
      continue
    }

    output += char
  }

  return output.trimEnd()
}

function getPendingSummary(
  toolName: string,
  t?: (key: TranslationKey, params?: Record<string, string | number>) => string,
): string {
  if (toolName === 'Write') return t?.('tool.generatingContent') ?? 'Generating content'
  if (toolName === 'Edit' || toolName === 'MultiEdit') return t?.('tool.preparingEdit') ?? 'Preparing edit'
  return t?.('tool.preparingTool') ?? 'Preparing tool'
}

function getToolResultSummary(
  toolName: string,
  content: unknown,
  isError: boolean,
  t?: (key: TranslationKey, params?: Record<string, string | number>) => string,
): string {
  const text = extractTextContent(content)
  if (!text) return ''

  if (isError) {
    const firstLine = text
      .split('\n')
      .map((line) => stripAnsi(line).replace(/\s+/g, ' ').trim())
      .find(Boolean)

    if (!firstLine) {
      return t?.('tool.error') ?? 'Error'
    }

    return firstLine.length <= 72 ? firstLine : `${firstLine.slice(0, 72)}…`
  }

  if (toolName === 'Bash') return ''

  const lineCount = text.split('\n').length
  if (lineCount > 1) {
    return t?.('tool.linesOutput', { count: lineCount }) ?? `${lineCount} lines output`
  }

  const compact = text.replace(/\s+/g, ' ').trim()
  if (!compact) return ''
  if (compact.length <= 36) return compact
  return `${compact.slice(0, 36)}…`
}

function stripAnsi(value: string): string {
  return value.replace(/\x1B\[[0-9;]*m/g, '')
}

function getToolSummary(toolName: string, obj: Record<string, unknown>, t?: (key: TranslationKey, params?: Record<string, string | number>) => string): string {
  switch (toolName) {
    case 'Bash':
      return typeof obj.command === 'string' ? obj.command : ''
    case 'Read':
      return t?.('tool.readFileContents') ?? 'Read file contents'
    case 'Write':
      return typeof obj.content === 'string'
        ? (t?.('tool.linesCreated', { count: obj.content.split('\n').length }) ?? `${obj.content.split('\n').length} lines created`)
        : (t?.('tool.createFile') ?? 'Create file')
    case 'Edit':
      return typeof obj.old_string === 'string' && typeof obj.new_string === 'string'
        ? changedLineSummary(obj.old_string, obj.new_string, t)
        : (t?.('tool.updateFileContents') ?? 'Update file contents')
    case 'Glob':
      return typeof obj.pattern === 'string' ? obj.pattern : ''
    case 'Grep':
      return typeof obj.pattern === 'string' ? obj.pattern : ''
    case 'Agent':
      return typeof obj.description === 'string' ? obj.description : ''
    default:
      return ''
  }
}

function extractTextContent(content: unknown): string | null {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content
      .map((chunk: any) => (typeof chunk === 'string' ? chunk : chunk?.text || ''))
      .filter(Boolean)
      .join('\n')
  }
  if (content && typeof content === 'object') {
    return JSON.stringify(content, null, 2)
  }
  return null
}

function changedLineSummary(oldString: string, newString: string, t?: (key: TranslationKey, params?: Record<string, string | number>) => string): string {
  const oldLines = oldString.split('\n')
  const newLines = newString.split('\n')
  let changed = 0
  const max = Math.max(oldLines.length, newLines.length)

  for (let index = 0; index < max; index += 1) {
    if ((oldLines[index] ?? '') !== (newLines[index] ?? '')) {
      changed += 1
    }
  }

  return t?.('tool.linesChanged', { count: changed }) ?? `${changed} lines changed`
}
