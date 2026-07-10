import { memo, useMemo, useRef, useState } from 'react'
import { BookMarked, ChevronDown, ChevronRight, Settings, FilePenLine, Bot, CircleStop, Clock } from 'lucide-react'
import { ToolCallBlock } from './ToolCallBlock'
import { MarkdownRenderer } from '../markdown/MarkdownRenderer'
import { Modal } from '../shared/Modal'
import { Collapse } from './Collapse'
import { CadencedShimmerText } from './StreamingIndicator'
import { RollingDiffStats } from './RollingDiffStats'
import type { DiffStats } from './diffStats'
import {
  aggregateToolEditStats,
  extractToolEditStats as extractEditStats,
  summarizeToolEditFiles,
  type ToolEditStats,
} from './toolEditSummary'
import { extractPartialJsonStringField } from './extractPartialJsonStringField'
import { useTranslation } from '../../i18n'
import type { TranslationKey } from '../../i18n'
import { SETTINGS_TAB_ID, useTabStore } from '../../stores/tabStore'
import { useUIStore } from '../../stores/uiStore'
import type { AgentTaskNotification, UIMessage } from '../../types/chat'
import { AGENT_LIFECYCLE_TYPES } from '../../types/team'

type ToolCall = Extract<UIMessage, { type: 'tool_use' }>
type ToolResult = Extract<UIMessage, { type: 'tool_result' }>
type MemoryToolAction = 'saved' | 'referenced'

/** Chinese action labels: [进行中, 已完成] — mirrors ToolCallBlock.tsx */
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

type MemoryToolFile = {
  path: string
  label: string
  action: MemoryToolAction
  lineHint?: string
  preview?: string
}

type MemoryToolActivity = {
  action: MemoryToolAction
  files: MemoryToolFile[]
}

type Props = {
  toolCalls: ToolCall[]
  resultMap: Map<string, ToolResult>
  childToolCallsByParent: Map<string, ToolCall[]>
  agentTaskNotifications: Record<string, AgentTaskNotification>
  /** When true, the last tool is still executing — show expanded */
  isStreaming?: boolean
}

/** Stats for Codex-style structured tool activity summary */
type ToolActivityCounts = {
  createdFileCount: number
  editedFileCount: number
  deletedFileCount: number
  commandCount: number
  exploredFileCount: number
  searchCount: number
  webSearchCount: number
  agentCount: number
  otherToolCount: number
}

function computeActivityCounts(toolCalls: ToolCall[]): ToolActivityCounts {
  const counts: ToolActivityCounts = {
    createdFileCount: 0,
    editedFileCount: 0,
    deletedFileCount: 0,
    commandCount: 0,
    exploredFileCount: 0,
    searchCount: 0,
    webSearchCount: 0,
    agentCount: 0,
    otherToolCount: 0,
  }
  for (const tc of toolCalls) {
    switch (tc.toolName) {
      case 'Write':
        counts.createdFileCount += 1
        break
      case 'Edit':
      case 'MultiEdit':
        counts.editedFileCount += 1
        break
      case 'Bash':
        counts.commandCount += 1
        break
      case 'Read':
        counts.exploredFileCount += 1
        break
      case 'Glob':
      case 'Grep':
        counts.searchCount += 1
        break
      case 'WebSearch':
      case 'WebFetch':
        counts.webSearchCount += 1
        break
      case 'Agent':
        counts.agentCount += 1
        break
      default:
        counts.otherToolCount += 1
        break
    }
  }
  return counts
}

/**
 * Codex-style structured tool activity summary.
 * Generates natural language like "Created 2 files, edited 3 files, ran 5 commands"
 * First action is capitalized (sentence case), subsequent use lowercase connectors.
 */
export function generateToolActivitySummary(
  toolCalls: ToolCall[],
  t: (key: TranslationKey, params?: Record<string, string | number>) => string,
): string {
  const counts = computeActivityCounts(toolCalls)
  const parts: string[] = []

  const addItem = (count: number, oneKey: string, manyKey: string) => {
    if (count === 0) return
    parts.push(count === 1 ? t(oneKey as TranslationKey) : t(manyKey as TranslationKey, { count }))
  }

  // Codex ordering: Created → Edited → Deleted → Explored → Searched → Commands → Web → Agent → Tools
  addItem(counts.createdFileCount, 'toolActivity.createdOne', 'toolActivity.createdMany')
  addItem(counts.editedFileCount, 'toolActivity.editedOne', 'toolActivity.editedMany')
  addItem(counts.deletedFileCount, 'toolActivity.deletedOne', 'toolActivity.deletedMany')
  addItem(counts.exploredFileCount, 'toolActivity.exploredOne', 'toolActivity.exploredMany')
  if (counts.searchCount > 0) {
    parts.push(counts.searchCount === 1
      ? t('toolActivity.searchedOne')
      : t('toolActivity.searchedMany', { count: counts.searchCount }))
  }
  addItem(counts.commandCount, 'toolActivity.ranOne', 'toolActivity.ranMany')
  if (counts.webSearchCount > 0) {
    parts.push(parts.length === 0
      ? t('toolActivity.webSearched')
      : t('toolActivity.webSearchedLower'))
  }
  addItem(counts.agentCount, 'toolActivity.agentOne', 'toolActivity.agentMany')
  addItem(counts.otherToolCount, 'toolActivity.toolOne', 'toolActivity.toolMany')

  return parts.length === 0 ? t('toolActivity.fallback') : parts.join(', ')
}

/** Generate a live detail string for the currently executing tool (file name, command, pattern, etc.).
 *  Returns only the detail part — the verb prefix is added by RunningToolTitle. */
function generateActiveTitle(toolCall: ToolCall | null): string {
  if (!toolCall) return ''
  const obj = toolCall.input && typeof toolCall.input === 'object' ? (toolCall.input as Record<string, unknown>) : {}
  const partialInput = typeof toolCall.partialInput === 'string' ? toolCall.partialInput : ''

  const getStringField = (field: string) => {
    const fromInput = typeof obj[field] === 'string' ? obj[field] as string : ''
    if (fromInput) return fromInput
    return extractPartialJsonStringField(partialInput, field) ?? ''
  }

  switch (toolCall.toolName) {
    case 'Bash': {
      const cmd = getStringField('command')
      return cmd || ''
    }
    case 'Read': {
      const filePath = getStringField('file_path')
      return filePath ? filePath.split('/').pop() || '' : ''
    }
    case 'Write': {
      const filePath = getStringField('file_path')
      return filePath ? filePath.split('/').pop() || '' : ''
    }
    case 'Edit': {
      const filePath = getStringField('file_path')
      return filePath ? filePath.split('/').pop() || '' : ''
    }
    case 'MultiEdit': {
      const filePath = getStringField('file_path')
      return filePath ? filePath.split('/').pop() || '' : ''
    }
    case 'Glob': {
      const pat = getStringField('pattern')
      return pat || ''
    }
    case 'Grep': {
      const pat = getStringField('pattern')
      return pat || ''
    }
    case 'Agent': {
      const desc = getStringField('description')
      return desc || ''
    }
    case 'WebSearch': {
      const q = getStringField('query')
      return q || ''
    }
    case 'WebFetch': {
      const url = getStringField('url')
      return url || ''
    }
    default:
      return toolCall.toolName
  }
}

function getSummaryKey(toolCalls: ToolCall[]): string {
  return toolCalls
    .map((toolCall) => `${toolCall.toolUseId}:${toolCall.status ?? ''}:${toolCall.toolName}`)
    .join('|')
}

function ActiveEditTitle({
  toolName,
  stats,
}: {
  toolName: string
  stats: ToolEditStats
}) {
  const verb = toolName === 'Write'
    ? '正在写入'
    : toolName === 'MultiEdit'
      ? '正在批量编辑'
      : '正在编辑'

  return (
    <span className="flex min-w-0 items-center gap-1.5">
      <span className="truncate">{verb} {stats.label}</span>
      <span className="shrink-0 text-[11px] text-[rgba(255,255,255,0.46)]">·</span>
      <RollingDiffStats stats={stats} variant="inline" className="text-[13px] font-medium" />
    </span>
  )
}

/** Shimmer only on the verb prefix (e.g. "正在运行"), not on the detail (file name / command). */
function RunningToolTitle({ toolName, detail }: { toolName: string; detail: string }) {
  const verb = TOOL_ACTION_LABEL[toolName]?.[0] || '正在执行'
  return (
    <span className="flex min-w-0 items-center gap-1">
      <CadencedShimmerText>
        <span>{verb}</span>
      </CadencedShimmerText>
      {detail && (
        <span className="min-w-0 truncate font-[var(--font-mono)] text-[11px] text-[var(--color-token-text-secondary)]">
          {detail}
        </span>
      )}
    </span>
  )
}

function ToolEditFileSummaryRows({
  files,
}: {
  files: ReturnType<typeof summarizeToolEditFiles>
}) {
  if (files.length === 0) return null

  return (
    <div className="mb-1 space-y-0.5" data-testid="tool-edit-file-summaries">
      {files.map((file) => (
        <div
          key={file.path}
          className="flex min-h-7 items-center gap-2 rounded-[var(--radius-xs)] px-2 py-1 text-[12px] text-[var(--color-token-conversation-summary-trailing)]"
          title={file.path}
        >
          <FilePenLine size={14} className="shrink-0 text-[var(--color-token-input-placeholder-foreground)]" aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate font-[var(--font-mono)]">{file.label}</span>
          {file.editCount > 1 ? (
            <span className="shrink-0 text-[10px] text-[var(--color-token-text-secondary)]">×{file.editCount}</span>
          ) : null}
          <RollingDiffStats stats={file} variant="inline" className="text-[13px] font-medium" />
        </div>
      ))}
    </div>
  )
}

function getLastUnresolvedToolCall(
  toolCalls: ToolCall[],
  resultMap: Map<string, ToolResult>,
  childToolCallsByParent: Map<string, ToolCall[]>,
): ToolCall | null {
  for (let index = toolCalls.length - 1; index >= 0; index -= 1) {
    const toolCall = toolCalls[index]
    if (!toolCall) continue
    if (!isToolCallResolved(toolCall, resultMap, childToolCallsByParent)) {
      return toolCall
    }
  }
  return null
}

function getActiveOrLatestToolCall(
  toolCalls: ToolCall[],
  resultMap: Map<string, ToolResult>,
  childToolCallsByParent: Map<string, ToolCall[]>,
  isStreaming?: boolean,
): ToolCall | null {
  const unresolvedToolCall = getLastUnresolvedToolCall(toolCalls, resultMap, childToolCallsByParent)
  if (unresolvedToolCall) return unresolvedToolCall
  if (isStreaming) return toolCalls[toolCalls.length - 1] ?? null
  return null
}

function getLatestConcreteRunningDisplay(
  toolCalls: ToolCall[],
  resultMap: Map<string, ToolResult>,
  childToolCallsByParent: Map<string, ToolCall[]>,
  isStreaming?: boolean,
): {
  toolCall: ToolCall
  title: string
  editStats: ToolEditStats | null
} | null {
  const activeToolCall = getActiveOrLatestToolCall(toolCalls, resultMap, childToolCallsByParent, isStreaming)
  const orderedToolCalls = activeToolCall
    ? [activeToolCall, ...toolCalls.filter((toolCall) => toolCall.id !== activeToolCall.id).reverse()]
    : [...toolCalls].reverse()

  for (const toolCall of orderedToolCalls) {
    const editStats = extractEditStats(toolCall)
    if (editStats?.label) {
      return {
        toolCall,
        title: '',
        editStats,
      }
    }

    const title = generateActiveTitle(toolCall)
    if (title) {
      return {
        toolCall,
        title,
        editStats: null,
      }
    }
  }

  return null
}

function isToolCallResolved(
  toolCall: ToolCall,
  resultMap: Map<string, ToolResult>,
  childToolCallsByParent: Map<string, ToolCall[]>,
): boolean {
  if (toolCall.status === 'stopped') return true
  if (!resultMap.has(toolCall.toolUseId)) return false

  return (childToolCallsByParent.get(toolCall.toolUseId) ?? []).every((childToolCall) =>
    isToolCallResolved(childToolCall, resultMap, childToolCallsByParent),
  )
}

export function hasUnresolvedToolCalls(
  toolCalls: ToolCall[],
  resultMap: Map<string, ToolResult>,
  childToolCallsByParent: Map<string, ToolCall[]>,
): boolean {
  return toolCalls.some((toolCall) =>
    !isToolCallResolved(toolCall, resultMap, childToolCallsByParent),
  )
}

export const ToolCallGroup = memo(function ToolCallGroup({
  toolCalls,
  resultMap,
  childToolCallsByParent,
  agentTaskNotifications,
  isStreaming,
}: Props) {
  const memoryActivity = getMemoryToolActivity(toolCalls, resultMap)
  if (memoryActivity) {
    const memoryToolCalls = toolCalls.filter(isMemoryToolCall)
    const regularToolCalls = toolCalls.filter((toolCall) => !isMemoryToolCall(toolCall))
    if (regularToolCalls.length > 0) {
      return (
        <div className="mb-2 space-y-2">
          <MemoryToolActivityGroup
            activity={memoryActivity}
            toolCalls={memoryToolCalls}
            resultMap={resultMap}
            childToolCallsByParent={childToolCallsByParent}
            isStreaming={isStreaming}
          />
          <ToolCallGroupContent
            toolCalls={regularToolCalls}
            resultMap={resultMap}
            childToolCallsByParent={childToolCallsByParent}
            agentTaskNotifications={agentTaskNotifications}
            isStreaming={isStreaming}
          />
        </div>
      )
    }
    return (
      <MemoryToolActivityGroup
        activity={memoryActivity}
        toolCalls={memoryToolCalls}
        resultMap={resultMap}
        childToolCallsByParent={childToolCallsByParent}
        isStreaming={isStreaming}
      />
    )
  }

  return (
    <ToolCallGroupContent
      toolCalls={toolCalls}
      resultMap={resultMap}
      childToolCallsByParent={childToolCallsByParent}
      agentTaskNotifications={agentTaskNotifications}
      isStreaming={isStreaming}
    />
  )
})

function ToolCallGroupContent({
  toolCalls,
  resultMap,
  childToolCallsByParent,
  agentTaskNotifications,
  isStreaming,
}: Props) {
  const allAgents = toolCalls.every((toolCall) => toolCall.toolName === 'Agent')

  if (allAgents) {
    return (
      <AgentToolGroup
        toolCalls={toolCalls}
        resultMap={resultMap}
        childToolCallsByParent={childToolCallsByParent}
        agentTaskNotifications={agentTaskNotifications}
        isStreaming={isStreaming}
      />
    )
  }

  return (
    <ToolCallGroupMulti
      toolCalls={toolCalls}
      resultMap={resultMap}
      childToolCallsByParent={childToolCallsByParent}
      agentTaskNotifications={agentTaskNotifications}
      isStreaming={isStreaming}
    />
  )
}

function MemoryToolActivityGroup({
  activity,
  toolCalls,
  resultMap,
  childToolCallsByParent,
  isStreaming,
}: {
  activity: MemoryToolActivity
  toolCalls: ToolCall[]
  resultMap: Map<string, ToolResult>
  childToolCallsByParent: Map<string, ToolCall[]>
  isStreaming?: boolean
}) {
  const [expanded, setExpanded] = useState(activity.action === 'saved')
  const [detailsExpanded, setDetailsExpanded] = useState(false)
  const t = useTranslation()
  const titleKey = activity.action === 'saved'
    ? 'chat.memorySavedFromToolsTitle'
    : 'chat.memoryReferencedTitle'
  const visibleFiles = activity.files.slice(0, 4)
  const hiddenCount = Math.max(0, activity.files.length - visibleFiles.length)

  /* collapsed by default — user clicks to expand */

  return (
    <div className="mb-[3px]">
      <div
        data-testid="memory-tool-activity-card"
        className="overflow-hidden rounded-[var(--radius-xl)] border border-[var(--color-memory-border)] bg-[var(--color-memory-surface)]"
      >
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors"
        >
          {expanded ? (
            <ChevronDown size={15} className="shrink-0 text-[var(--color-token-text-secondary)]" aria-hidden="true" />
          ) : (
            <ChevronRight size={15} className="shrink-0 text-[var(--color-token-text-secondary)]" aria-hidden="true" />
          )}
          <BookMarked size={15} className="shrink-0 text-[var(--color-memory-accent)]" aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-[var(--color-token-foreground)]">
            {t(titleKey, { count: activity.files.length })}
          </span>
          {isStreaming ? (
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-memory-accent)] animate-pulse-dot" />
          ) : null}
        </button>

        <Collapse open={expanded}>
          <div className="border-t border-[var(--color-token-border)]/55 px-3 py-2.5">
            <div className="space-y-1.5">
              {visibleFiles.map((file) => (
                <button
                  key={file.path}
                  type="button"
                  title={file.path}
                  onClick={() => openMemorySettings(file.path)}
                  className="group flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left transition-colors focus:outline-none focus-visible:shadow-[var(--shadow-focus-ring)]"
                >
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-sm border border-[var(--color-memory-border)] bg-[var(--color-memory-icon-bg)] text-[var(--color-token-text-secondary)] group-hover:text-[var(--color-memory-accent)]">
                    <Settings size={12} aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
                      <span className="truncate text-[13px] font-medium text-[var(--color-token-foreground)]">
                        {file.label}
                      </span>
                      {file.lineHint ? (
                        <span className="shrink-0 text-[12px] text-[var(--color-token-text-secondary)]">
                          {file.lineHint}
                        </span>
                      ) : null}
                    </span>
                    {file.preview ? (
                      <span className="mt-0.5 line-clamp-2 text-[12px] leading-5 text-[var(--color-token-text-secondary)]">
                        {file.preview}
                      </span>
                    ) : null}
                  </span>
                </button>
              ))}
              {hiddenCount > 0 ? (
                <div className="px-2 py-1 text-[12px] text-[var(--color-token-text-secondary)]">
                  {t('chat.memoryMoreFiles', { count: hiddenCount })}
                </div>
              ) : null}
            </div>

            <button
              type="button"
              onClick={() => setDetailsExpanded((value) => !value)}
              className="mt-2 inline-flex h-7 items-center gap-1.5 rounded-md border border-[var(--color-token-border)] px-2 text-[11px] font-medium text-[var(--color-token-text-secondary)] transition-colors hover:text-[var(--color-token-foreground)]"
            >
              {detailsExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
              {t('chat.memoryTechnicalDetails')}
            </button>

            {detailsExpanded ? (
              <div className="mt-2 space-y-1">
                {toolCalls.map((toolCall) => (
                  <ToolCallTree
                    key={toolCall.id}
                    toolCall={toolCall}
                    resultMap={resultMap}
                    childToolCallsByParent={childToolCallsByParent}
                    compact
                  />
                ))}
              </div>
            ) : null}
          </div>
        </Collapse>
      </div>
    </div>
  )
}

function AgentToolGroup({
  toolCalls,
  resultMap,
  childToolCallsByParent,
  agentTaskNotifications,
  isStreaming,
}: Props) {
  const [expanded, setExpanded] = useState(false)
  const t = useTranslation()
  const statuses = toolCalls.map((toolCall) =>
    getAgentStatus({
      hasResult: resultMap.has(toolCall.toolUseId),
      isError: !!resultMap.get(toolCall.toolUseId)?.isError,
      isLaunchResult: isAgentLaunchResult(resultMap.get(toolCall.toolUseId)?.content),
      isStreaming: !!isStreaming && !resultMap.has(toolCall.toolUseId),
      childCount: (childToolCallsByParent.get(toolCall.toolUseId) ?? []).length,
      taskStatus: agentTaskNotifications[toolCall.toolUseId]?.status,
    }),
  )
  const isAnyRunning = statuses.some((status) => status === 'running' || status === 'starting')
  const errorPresent = statuses.some((status) => status === 'failed')
  const allComplete = statuses.every((status) => status === 'done')
  const anyStopped = statuses.some((status) => status === 'stopped')
  const activeToolTitle = generateActiveTitle(
    getLastUnresolvedToolCall(toolCalls, resultMap, childToolCallsByParent),
  )

  // Flat mode: just the agent cards, no collapsible wrapper
  return (
    <div className="mb-[3px]">
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className="agent-card-glow flex w-full items-center gap-2 rounded-[var(--radius-2xl)] bg-[var(--color-surface-container-high)] px-3 py-2 text-left transition-colors"
      >
        <ChevronDown size={15} className={`shrink-0 text-[var(--color-token-foreground)] transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} aria-hidden="true" />
        <span className="flex-1 truncate text-[12px] text-[var(--color-token-text-secondary)]">
{isAnyRunning
            ? activeToolTitle || (toolCalls.length === 1 ? t('toolGroup.agentOne') : t('toolGroup.agentMany', { count: toolCalls.length }))
            : (toolCalls.length === 1 ? t('toolGroup.agentOne') : t('toolGroup.agentMany', { count: toolCalls.length }))}
        </span>
        {isAnyRunning && (
          <span className="rounded-full bg-[var(--color-warning)]/12 px-2 py-0.5 text-[10px] font-semibold text-[var(--color-warning)]">
            {t('agentStatus.running')}
          </span>
        )}
        {!isAnyRunning && !errorPresent && !allComplete && !anyStopped && (
          <Clock size={14} className="text-[var(--color-token-foreground)]" aria-hidden="true" />
        )}
        {!isAnyRunning && !errorPresent && !allComplete && anyStopped && (
          <CircleStop size={14} className="text-[var(--color-token-foreground)]" aria-hidden="true" />
        )}
      </button>

      <Collapse open={expanded}>
        <div className="relative mt-3 pl-5">
          <div className="absolute bottom-6 left-[11px] top-4 w-px rounded-full bg-[var(--color-token-border)]/45" />
          <div className="space-y-2">
            {toolCalls.map((toolCall) => (
              <div key={toolCall.id} className="relative pl-7">
                <div className="absolute left-0 top-1/2 -translate-y-1/2">
                  <div className="absolute left-[11px] top-1/2 h-px w-4 -translate-y-1/2 bg-[var(--color-token-border)]/45" />
                  <div className="absolute left-[8px] top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full border border-[var(--color-token-border)]/65 bg-[var(--color-token-bg-subtle,rgba(255,255,255,0.04))] shadow-[0_0_0_2px_var(--color-surface)]" />
                </div>
                <AgentCallCard
                  toolCall={toolCall}
                  resultMap={resultMap}
                  childToolCallsByParent={childToolCallsByParent}
                  agentTaskNotification={agentTaskNotifications[toolCall.toolUseId]}
                  isStreaming={isStreaming && !resultMap.has(toolCall.toolUseId)}
                />
              </div>
            ))}
          </div>
        </div>
      </Collapse>
    </div>
  )
}

/** Separated so the useState hook is never called conditionally. */
function ToolCallGroupMulti({ toolCalls, resultMap, childToolCallsByParent, isStreaming }: Props) {
  const [expanded, setExpanded] = useState(false)
  const t = useTranslation()
  const summary = generateToolActivitySummary(toolCalls, t)
  const hasUnresolvedTools = hasUnresolvedToolCalls(toolCalls, resultMap, childToolCallsByParent)
  // When isStreaming is false (assistant text already follows this group),
  // the tools are logically complete even if tool_result messages haven't
  // arrived yet — the AI wouldn't be replying if tools were still running.
  const isRunning = Boolean(isStreaming) || (isStreaming ? hasUnresolvedTools : false)

  const runningDisplay = useMemo(
    () => getLatestConcreteRunningDisplay(toolCalls, resultMap, childToolCallsByParent, isStreaming),
    [childToolCallsByParent, isStreaming, resultMap, toolCalls],
  )
  // Keep the last valid running display so the title stays visible when
  // a new tool starts but hasn't yielded a concrete name yet (e.g. the
  // partial JSON hasn't been parsed).  Resets when the turn ends.
  const lastRunningDisplayRef = useRef(runningDisplay)
  if (isRunning && runningDisplay) {
    lastRunningDisplayRef.current = runningDisplay
  }
  if (!isRunning) {
    lastRunningDisplayRef.current = null
  }
  const effectiveRunningDisplay = isRunning ? (runningDisplay ?? lastRunningDisplayRef.current) : null
  const completedEditStats = useMemo(() => aggregateToolEditStats(toolCalls), [toolCalls])
  const editFileSummaries = useMemo(() => summarizeToolEditFiles(toolCalls), [toolCalls])
  const summaryKey = useMemo(() => getSummaryKey(toolCalls), [toolCalls])
  const summaryContent = completedEditStats ? (
    <span className="flex min-w-0 items-center gap-1.5">
      <span className="min-w-0 truncate">{summary}</span>
      <span className="shrink-0 text-[11px] text-[rgba(255,255,255,0.42)]">·</span>
      <RollingDiffStats stats={completedEditStats} variant="inline" className="text-[13px] font-medium" />
    </span>
  ) : summary

  return (
    <div className="group/collapsed-tool-activity mb-[3px]" data-summary-key={summaryKey}>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-2 rounded-[var(--radius-xs)] px-2 py-1.5 text-left transition-colors"
      >
        <ChevronDown size={15} className={`shrink-0 text-[var(--color-token-input-placeholder-foreground)] transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} aria-hidden="true" />
        <span className="flex-1 truncate text-[var(--text-size-chat)] text-[var(--color-token-conversation-summary-trailing)] group-hover/collapsed-tool-activity:text-[var(--color-token-foreground)]">
          {isRunning ? (
            effectiveRunningDisplay?.editStats ? (
              <ActiveEditTitle toolName={effectiveRunningDisplay.toolCall.toolName} stats={effectiveRunningDisplay.editStats} />
            ) : effectiveRunningDisplay?.title ? (
              <RunningToolTitle toolName={effectiveRunningDisplay.toolCall.toolName} detail={effectiveRunningDisplay.title} />
            ) : null
          ) : summaryContent}
        </span>

        {isRunning && (
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-token-charts-green)] animate-pulse-dot" />
        )}
      </button>

      <Collapse open={expanded}>
        <div className="ml-3 mt-1 space-y-1 border-l border-[var(--color-token-border)]/38 pl-3">
          <ToolEditFileSummaryRows files={editFileSummaries} />
          {toolCalls.map((tc) => {
            return (
              <ToolCallTree
                key={tc.id}
                toolCall={tc}
                resultMap={resultMap}
                childToolCallsByParent={childToolCallsByParent}
                compact
                diffStats={extractEditStats(tc)}
              />
            )
          })}
        </div>
      </Collapse>
    </div>
  )
}

function AgentCallCard({
  toolCall,
  resultMap,
  childToolCallsByParent,
  agentTaskNotification,
  isStreaming = false,
}: {
  toolCall: ToolCall
  resultMap: Map<string, ToolResult>
  childToolCallsByParent: Map<string, ToolCall[]>
  agentTaskNotification?: AgentTaskNotification
  isStreaming?: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const t = useTranslation()
  const input = toolCall.input && typeof toolCall.input === 'object'
    ? toolCall.input as Record<string, unknown>
    : {}
  const result = resultMap.get(toolCall.toolUseId)
  const childToolCalls = childToolCallsByParent.get(toolCall.toolUseId) ?? []
  const isLaunchResult = isAgentLaunchResult(result?.content)
  const recentToolCalls = childToolCalls.slice(-2)
  const status = getAgentStatus({
    hasResult: !!result,
    isError: !!result?.isError,
    isLaunchResult,
    isStreaming,
    childCount: childToolCalls.length,
    taskStatus: agentTaskNotification?.status,
  })
  const statusClassName = getAgentStatusClassName(status)
  const statusLabel = getAgentStatusLabel(status, t)
  const taskSummary = agentTaskNotification?.summary?.trim() || ''
  const taskResult = agentTaskNotification?.result?.trim() || ''
  const errorText =
    status === 'failed'
      ? taskSummary || (result?.isError ? getAgentErrorSummary(result.content) : '')
      : result?.isError
        ? getAgentErrorSummary(result.content)
        : ''
  const fullOutputText =
    result && !result.isError && !isLaunchResult && !isAgentLifecycleResult(result.content)
      ? extractAgentDisplayText(result.content).trim()
      : ''
  const terminalTaskReport = status === 'done' || status === 'stopped' ? taskResult : ''
  const terminalTaskSummary = status === 'done' || status === 'stopped' ? taskSummary : ''
  const previewText = terminalTaskReport || fullOutputText || terminalTaskSummary
  const outputSummary = previewText ? getAgentOutputSummary(previewText) : ''
  const description = typeof input.description === 'string' ? input.description : ''

  return (
    <div className="agent-card-glow overflow-hidden rounded-[var(--radius-2xl)] bg-[var(--color-surface-container-high)]">
      <div className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors">
        <Bot size={18} className="text-[var(--color-outline)]" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-semibold text-[var(--color-token-foreground)]">Agent</span>
            {description && (
              <span className="truncate text-[12px] text-[var(--color-token-text-secondary)]">
                {description}
              </span>
            )}
          </div>
          {!expanded && outputSummary && (
            <div className="mt-1 line-clamp-2 text-[11px] text-[var(--color-token-text-secondary)]">
              {outputSummary}
            </div>
          )}
          {!expanded && !outputSummary && recentToolCalls.length > 0 && (
            <div className="mt-1 space-y-1">
              {recentToolCalls.map((recentToolCall) => (
                <div
                  key={recentToolCall.id}
                  className="truncate text-[11px] text-[var(--color-token-text-secondary)]"
                >
                  {formatRecentToolUseSummary(recentToolCall, resultMap)}
                </div>
              ))}
            </div>
          )}
          {!expanded && !outputSummary && !recentToolCalls.length && errorText && (
            <div className="mt-1 truncate text-[11px] text-[var(--color-error)]">
              {errorText}
            </div>
          )}
        </div>
        {outputSummary && (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              setPreviewOpen(true)
            }}
            className="shrink-0 rounded-md border border-[var(--color-token-border)] px-2.5 py-1 text-[11px] font-medium text-[var(--color-token-text-secondary)] transition-colors hover:text-[var(--color-token-foreground)]"
          >
            {t('agentStatus.viewResult')}
          </button>
        )}
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusClassName}`}>
          {statusLabel}
        </span>
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[var(--color-outline)] transition-colors"
          aria-label={expanded ? 'Collapse agent' : 'Expand agent'}
        >
          <ChevronDown size={16} className={`transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} aria-hidden="true" />
        </button>
      </div>

      {expanded && (
        <div className="border-t border-[var(--color-token-border)]/60 px-3 py-3">
          {errorText && (
            <div className="mb-3 rounded-lg border border-[var(--color-error)]/20 bg-[var(--color-error-container)]/60 px-3 py-2 text-[11px] text-[var(--color-error)]">
              {errorText}
            </div>
          )}
          {childToolCalls.length > 0 ? (
            <div className="space-y-1">
              {childToolCalls.map((childToolCall) => (
                <ToolCallTree
                  key={childToolCall.id}
                  toolCall={childToolCall}
                  resultMap={resultMap}
                  childToolCallsByParent={childToolCallsByParent}
                  compact
                />
              ))}
            </div>
          ) : outputSummary ? (
            <div className="text-[11px] text-[var(--color-token-text-secondary)]">
              {t('agentStatus.noActivity')}
            </div>
          ) : (
            <div className="text-[11px] text-[var(--color-token-text-secondary)]">
              {status === 'starting' ? t('agentStatus.starting') : t('agentStatus.noActivity')}
            </div>
          )}
        </div>
      )}
      <Modal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        title={description || t('agentStatus.resultTitle')}
        width={900}
      >
        <div className="max-h-[70vh] overflow-y-auto">
          <MarkdownRenderer content={previewText || errorText} />
        </div>
      </Modal>
    </div>
  )
}

function ToolCallTree({
  toolCall,
  resultMap,
  childToolCallsByParent,
  compact = false,
  diffStats,
}: {
  toolCall: ToolCall
  resultMap: Map<string, ToolResult>
  childToolCallsByParent: Map<string, ToolCall[]>
  compact?: boolean
  diffStats?: DiffStats | null
}) {
  const result = resultMap.get(toolCall.toolUseId)
  const childToolCalls = childToolCallsByParent.get(toolCall.toolUseId) ?? []
  const toolDiffStats = diffStats ?? extractEditStats(toolCall)

  return (
    <div className={compact ? 'space-y-0.5' : ''}>
      <ToolCallBlock
        toolName={toolCall.toolName}
        input={toolCall.input}
        result={result ? { content: result.content, isError: result.isError } : null}
        compact={compact}
        isPending={toolCall.isPending}
        status={toolCall.status}
        partialInput={toolCall.partialInput}
        diffStats={toolDiffStats}
      />
      {childToolCalls.length > 0 && (
        <div className={compact ? 'ml-3 border-l border-[var(--color-token-border)]/38 pl-3' : 'mb-1.5 ml-6 border-l border-[var(--color-token-border)]/38 pl-3'}>
          <div className="space-y-1">
            {childToolCalls.map((childToolCall) => (
              <ToolCallTree
                key={childToolCall.id}
                toolCall={childToolCall}
                resultMap={resultMap}
                childToolCallsByParent={childToolCallsByParent}
                compact
                diffStats={extractEditStats(childToolCall)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function openMemorySettings(path?: string) {
  const ui = useUIStore.getState()
  if (path) ui.setPendingMemoryPath(path)
  ui.setPendingSettingsTab('memory')
  useTabStore.getState().openTab(SETTINGS_TAB_ID, 'Settings', 'settings')
}

function getMemoryToolActivity(
  toolCalls: ToolCall[],
  resultMap: Map<string, ToolResult>,
): MemoryToolActivity | null {
  const filesByPath = new Map<string, MemoryToolFile>()
  let sawSave = false

  for (const toolCall of toolCalls) {
    if (toolCall.isPending) continue
    const path = getToolFilePath(toolCall.input)
    if (!path || !isMemoryMarkdownPath(path)) continue

    const isSave = isMemoryWriteTool(toolCall.toolName)
    const isReference = toolCall.toolName === 'Read'
    if (!isSave && !isReference) continue
    sawSave ||= isSave

    const result = resultMap.get(toolCall.toolUseId)
    const preview = extractMemoryPreview(result?.content)
    const current = filesByPath.get(path)
    filesByPath.set(path, {
      path,
      label: memoryFileLabel(path),
      action: isSave ? 'saved' : (current?.action ?? 'referenced'),
      lineHint: preview.lineHint || current?.lineHint,
      preview: preview.text || current?.preview,
    })
  }

  if (filesByPath.size === 0) return null
  return {
    action: sawSave ? 'saved' : 'referenced',
    files: [...filesByPath.values()],
  }
}

function isMemoryToolCall(toolCall: ToolCall): boolean {
  if (toolCall.isPending) return false
  const path = getToolFilePath(toolCall.input)
  if (!path || !isMemoryMarkdownPath(path)) return false
  return toolCall.toolName === 'Read' || isMemoryWriteTool(toolCall.toolName)
}

function isMemoryWriteTool(toolName: string): boolean {
  return toolName === 'Write' || toolName === 'Edit' || toolName === 'MultiEdit'
}

function getToolFilePath(input: unknown): string | null {
  if (!input || typeof input !== 'object') return null
  const record = input as Record<string, unknown>
  const filePath = record.file_path ?? record.path
  return typeof filePath === 'string' ? filePath : null
}

function isMemoryMarkdownPath(path: string): boolean {
  const normalized = path.replace(/\\/g, '/')
  return normalized.endsWith('.md') && normalized.includes('/memory/')
}

function memoryFileLabel(path: string): string {
  const normalized = path.replace(/\\/g, '/')
  return normalized.split('/').pop() || normalized
}

function extractMemoryPreview(content: unknown): { text?: string; lineHint?: string } {
  const raw = extractTextContent(content)
  if (!raw) return {}
  const lineHint = extractLineHint(raw)
  const lines = raw
    .replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, '')
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*\d+\s*/, '').trim())
    .filter(Boolean)

  let inFrontmatter = false
  for (const line of lines) {
    if (line === '---') {
      inFrontmatter = !inFrontmatter
      continue
    }
    if (inFrontmatter) continue
    const normalized = line.replace(/^#+\s*/, '').replace(/^[-*]\s*/, '').trim()
    if (!normalized || normalized === '---') continue
    if (/^(file|lines?|total)\b/i.test(normalized)) continue
    return {
      text: normalized.length > 140 ? `${normalized.slice(0, 140)}...` : normalized,
      lineHint,
    }
  }
  return { lineHint }
}

function extractLineHint(text: string): string | undefined {
  const match = text.match(/(\d+)\s+lines?\b/i) ?? text.match(/(\d+)\s+行/)
  return match?.[1] ? `${match[1]} lines` : undefined
}

type AgentStatus = 'starting' | 'running' | 'done' | 'failed' | 'stopped'
type AgentTaskStatus = AgentTaskNotification['status']

function getAgentStatus({
  hasResult,
  isError,
  isLaunchResult,
  isStreaming,
  childCount,
  taskStatus,
}: {
  hasResult: boolean
  isError: boolean
  isLaunchResult: boolean
  isStreaming: boolean
  childCount: number
  taskStatus?: AgentTaskStatus
}): AgentStatus {
  if (taskStatus === 'failed') return 'failed'
  if (taskStatus === 'stopped') return 'stopped'
  if (taskStatus === 'completed') return 'done'
  if (hasResult && isError && !isLaunchResult) return 'failed'
  if (hasResult && !isLaunchResult) return 'done'
  if (isStreaming || childCount > 0 || isLaunchResult) return 'running'
  return 'starting'
}

function getAgentStatusLabel(
  status: AgentStatus,
  t: (key: TranslationKey, params?: Record<string, string | number>) => string,
): string {
  switch (status) {
    case 'failed':
      return t('agentStatus.failed')
    case 'stopped':
      return t('agentStatus.stopped')
    case 'done':
      return t('agentStatus.done')
    case 'running':
      return t('agentStatus.running')
    case 'starting':
    default:
      return t('agentStatus.starting')
  }
}

function getAgentStatusClassName(status: AgentStatus): string {
  switch (status) {
    case 'failed':
      return 'bg-[var(--color-error)]/10 text-[var(--color-error)]'
    case 'stopped':
      return 'bg-[var(--color-surface-container-high)] text-[var(--color-token-text-secondary)]'
    case 'done':
      return 'bg-[var(--color-success)]/10 text-[var(--color-success)]'
    case 'running':
      return 'bg-[var(--color-warning)]/10 text-[var(--color-warning)]'
    case 'starting':
    default:
      return 'bg-[var(--color-surface-container-high)] text-[var(--color-token-text-secondary)]'
  }
}

function formatRecentToolUseSummary(
  toolCall: ToolCall,
  resultMap: Map<string, ToolResult>,
): string {
  const input = toolCall.input && typeof toolCall.input === 'object'
    ? toolCall.input as Record<string, unknown>
    : {}
  const result = resultMap.get(toolCall.toolUseId)
  const suffix = result?.isError ? ' • failed' : result ? ' • done' : ' • running'

  switch (toolCall.toolName) {
    case 'Bash':
      return `Bash · ${typeof input.command === 'string' ? input.command : ''}${suffix}`
    case 'Read':
      return `Read · ${typeof input.file_path === 'string' ? input.file_path.split('/').pop() : 'file'}${suffix}`
    case 'Glob':
      return `Glob · ${typeof input.pattern === 'string' ? input.pattern : ''}${suffix}`
    case 'Grep':
      return `Grep · ${typeof input.pattern === 'string' ? input.pattern : ''}${suffix}`
    case 'Agent':
      return `Agent · ${typeof input.description === 'string' ? input.description : ''}${suffix}`
    default:
      return `${toolCall.toolName}${suffix}`
  }
}

function getAgentErrorSummary(content: unknown): string {
  const text = extractTextContent(content).replace(/\s+/g, ' ').trim()
  if (!text) return ''
  if (text.includes(`Agent type 'Explore' not found`)) {
    return 'Explore agent unavailable in this session'
  }
  return text.length > 120 ? `${text.slice(0, 120)}...` : text
}

function getAgentOutputSummary(content: string): string {
  const text = content.replace(/\s+\n/g, '\n').trim()
  if (!text) return ''
  return text.length > 220 ? `${text.slice(0, 220)}...` : text
}

function extractAgentDisplayText(content: unknown): string {
  return stripAgentResultMetadata(formatAgentStructuredResult(content) || extractTextContent(content))
}

function formatAgentStructuredResult(content: unknown): string {
  const structured = parseStructuredAgentContent(content)
  if (!structured || Array.isArray(structured)) return ''

  const results = structured.results
  if (!Array.isArray(results) || results.length === 0) return ''

  const items = results
    .map((result, index) => formatAgentStructuredResultItem(result, index))
    .filter(Boolean)

  return items.join('\n')
}

function parseStructuredAgentContent(content: unknown): Record<string, unknown> | unknown[] | null {
  if (typeof content === 'string') {
    return parseStructuredAgentText(content)
  }

  if (Array.isArray(content)) {
    return parseStructuredAgentText(extractTextContent(content))
  }

  if (content && typeof content === 'object') {
    if ('results' in content) return content as Record<string, unknown>

    const extracted = extractTextContent(content)
    return extracted ? parseStructuredAgentText(extracted) : null
  }

  return null
}

function parseStructuredAgentText(text: string): Record<string, unknown> | unknown[] | null {
  const trimmed = text.trim()
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return null
  try {
    const parsed = JSON.parse(trimmed) as unknown
    return typeof parsed === 'object' && parsed !== null ? parsed as Record<string, unknown> | unknown[] : null
  } catch {
    return null
  }
}

function formatAgentStructuredResultItem(result: unknown, index: number): string {
  if (!result || typeof result !== 'object' || Array.isArray(result)) {
    const text = extractTextContent(result).trim()
    return text ? `${index + 1}. ${text}` : ''
  }

  const record = result as Record<string, unknown>
  const location = formatAgentResultLocation(record)
  const context = getStringField(record, 'context')
  const snippet = getStringField(record, 'snippet')
  const message = getStringField(record, 'message') || getStringField(record, 'text') || getStringField(record, 'summary')
  const nestedItems = Array.isArray(record.items) ? record.items : []

  if (nestedItems.length > 0) {
    const label = getStringField(record, 'risk') || getStringField(record, 'title') || message || 'Grouped results'
    const lines = [`${index + 1}. ${formatAgentGroupLabel(label)}`]
    if (context) lines.push(`   - ${context}`)
    if (snippet) lines.push(`   - ${snippet}`)

    nestedItems
      .map(formatAgentStructuredNestedItem)
      .filter(Boolean)
      .forEach((item) => {
        lines.push(
          item
            .split('\n')
            .map((line, lineIndex) => `${lineIndex === 0 ? '   - ' : '     '}${line}`)
            .join('\n'),
        )
      })

    return lines.join('\n')
  }

  const lines = [`${index + 1}. ${location ? formatInlineCode(location) : 'Result'}`]

  if (message) lines.push(`   - ${message}`)
  if (context) lines.push(`   - ${context}`)
  if (snippet) lines.push(`   - ${snippet}`)

  return lines.join('\n')
}

function formatAgentStructuredNestedItem(item: unknown): string {
  if (!item || typeof item !== 'object' || Array.isArray(item)) {
    return extractTextContent(item).trim()
  }

  const record = item as Record<string, unknown>
  const location = formatAgentResultLocation(record)
  const context = getStringField(record, 'context')
  const snippet = getStringField(record, 'snippet')
  const message = getStringField(record, 'message') || getStringField(record, 'text') || getStringField(record, 'summary')
  const headingParts = [location ? formatInlineCode(location) : '', message].filter(Boolean)
  const lines = [headingParts.join(' - ') || 'Result']

  if (context) lines.push(context)
  if (snippet) lines.push(snippet)

  return lines.join('\n')
}

function formatAgentGroupLabel(label: string): string {
  const normalized = label.trim()
  if (!normalized) return 'Grouped results'
  return `${normalized.charAt(0).toUpperCase()}${normalized.slice(1)}`
}

function formatAgentResultLocation(record: Record<string, unknown>): string {
  const file = getStringField(record, 'file')
  if (!file) return ''
  const line = typeof record.line === 'number' ? record.line : null
  return line !== null ? `${file}:${line}` : file
}

function getStringField(record: Record<string, unknown>, key: string): string {
  const value = record[key]
  return typeof value === 'string' ? value.trim() : ''
}

function formatInlineCode(value: string): string {
  return `\`${value.replace(/`/g, '\\`')}\``
}

function stripAgentResultMetadata(text: string): string {
  return text
    .replace(/^\s*agentId:.*(?:\r?\n)?/gm, '')
    .replace(/<usage>[\s\S]*?<\/usage>/g, '')
    .replace(/^\s*(?:total_tokens|tool_uses|duration_ms):\s*\d+\s*$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function isAgentLaunchResult(content: unknown): boolean {
  const text = extractTextContent(content).trim()
  if (!text) return false

  return (
    text.startsWith('Async agent launched successfully.') ||
    text.startsWith('Remote agent launched in CCR.') ||
    (text.startsWith('Spawned successfully.') &&
      text.includes('The agent is now running and will receive instructions via mailbox.')) ||
    text.includes('The agent is working in the background. You will be notified automatically when it completes.') ||
    text.includes('The agent is running remotely. You will be notified automatically when it completes.')
  )
}

/**
 * Check if agent result content is a lifecycle notification (shutdown, terminated, etc.)
 * rather than actual agent output. These should not be shown to the user as results.
 */
function isAgentLifecycleResult(content: unknown): boolean {
  const text = extractTextContent(content).trim()
  if (!text) return false
  // Detect JSON lifecycle messages: shutdown_approved, shutdown_rejected, teammate_terminated
  if (text.startsWith('{') && text.endsWith('}')) {
    try {
      const parsed = JSON.parse(text) as Record<string, unknown>
      if (typeof parsed.type === 'string' && AGENT_LIFECYCLE_TYPES.has(parsed.type)) {
        return true
      }
    } catch {
      // Not valid JSON, not a lifecycle message
    }
  }
  return false
}

function extractTextContent(content: unknown): string {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content
      .map((chunk) => {
        if (typeof chunk === 'string') return chunk
        if (chunk && typeof chunk === 'object' && 'text' in chunk) {
          return typeof chunk.text === 'string' ? chunk.text : ''
        }
        return ''
      })
      .filter(Boolean)
      .join('\n')
  }
  if (content && typeof content === 'object') {
    if (
      'status' in content &&
      (content as Record<string, unknown>).status === 'completed' &&
      Array.isArray((content as Record<string, unknown>).content)
    ) {
      return extractTextContent((content as Record<string, unknown>).content)
    }
    }
  if (content && typeof content === 'object') {
    return JSON.stringify(content)
  }
  return ''
}
