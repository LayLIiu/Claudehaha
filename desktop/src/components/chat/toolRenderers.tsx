/**
 * Family-specific content renderers for tool call blocks.
 * Each renderer provides the expanded content area for a specific tool family.
 * Mirrors ZCode's approach where each family has a dedicated renderer.
 */
import { memo } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  SquareTerminal,
  Search,
  FileText,
  FilePenLine,
  FilePlus2,
  WandSparkles,
  Wrench,
  Bot,
  BookOpen,
  LayoutList,
  HelpCircle,
  Target,
  ArrowRightLeft,
  BookMarked,
  CircleDot,
} from 'lucide-react'
import { CodeViewer } from './CodeViewer'
import { DiffViewer } from './DiffViewer'
import { TerminalChrome } from './TerminalChrome'
import { CopyButton } from '../shared/CopyButton'
import { InlineImageGallery } from './InlineImageGallery'
import type { DiffStats } from './diffStats'
import { extractPartialJsonStringField } from './extractPartialJsonStringField'
import type { ToolFamily } from './toolFamily'

// ── Icon mapping per tool family ──

const FAMILY_ICONS: Record<ToolFamily, LucideIcon> = {
  'file-read': FileText,
  'file-write': FilePenLine,
  shell: SquareTerminal,
  search: Search,
  explore: BookOpen,
  skill: WandSparkles,
  mcp: Wrench,
  agent: Bot,
  'plan-guidance': LayoutList,
  todo: CircleDot,
  'ask-user-question': HelpCircle,
  'session-context': BookMarked,
  'switch-mode': ArrowRightLeft,
  goal: Target,
  fallback: Wrench,
}

/** Special icons for specific tool names that override the family icon */
const TOOL_NAME_ICONS: Record<string, LucideIcon> = {
  Write: FilePlus2,
  Edit: FilePenLine,
  MultiEdit: FilePenLine,
  NotebookEdit: FilePenLine,
}

export function getToolIcon(toolName: string, family: ToolFamily): LucideIcon {
  return TOOL_NAME_ICONS[toolName] ?? FAMILY_ICONS[family]
}

// ── Shared types ──

type RendererProps = {
  toolName: string
  input: Record<string, unknown>
  result?: { content: unknown; isError: boolean } | null
  isPending?: boolean
  status?: 'stopped'
  partialInput?: string
  diffStats?: DiffStats | null
  compact?: boolean
}

// ── Shell renderer (Bash, command execution) ──

const ShellRenderer = memo(function ShellRenderer({
  input,
  result,
  isPending,
  partialInput,
}: RendererProps) {
  // Handle pending partial input (streaming JSON)
  if (isPending && partialInput) {
    return renderPartialInput(partialInput)
  }

  const command = typeof input.command === 'string' ? input.command : ''
  const filePath = typeof input.file_path === 'string' ? input.file_path : ''
  const resultText = result ? extractTextContent(result.content) : null

  return (
    <>
      <TerminalChrome title={typeof input.description === 'string' ? input.description : filePath}>
        <div className="px-3 py-2.5 font-[var(--font-mono)] text-[11px] leading-[1.3] text-[var(--color-terminal-fg)]">
          <span className="text-[var(--color-terminal-accent)]">$</span> {command}
        </div>
      </TerminalChrome>
      {resultText && result && result.isError && renderResultOutput(result, resultText)}
    </>
  )
})

// ── Search renderer (Glob, Grep, WebSearch, WebFetch) ──

const SearchRenderer = memo(function SearchRenderer({
  result,
}: RendererProps) {
  const resultText = result ? extractTextContent(result.content) : null
  if (!resultText || !result) return null
  return renderResultOutput(result, resultText)
})

// ── File Read renderer ──

const FileReadRenderer = memo(function FileReadRenderer({
  input,
  result,
}: RendererProps) {
  const resultText = result ? extractTextContent(result.content) : null

  // For non-error results, show the input JSON with "Tool Input" header
  if (result && !result.isError) {
    const inputJson = JSON.stringify(input, null, 2)
    return (
      <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-token-border)] bg-[var(--color-surface)]">
        <div className="flex items-center justify-between border-b border-[var(--color-token-border)] px-3 py-2 text-[10px] uppercase tracking-[0.18em] text-[var(--color-outline)]">
          <span>Tool Input</span>
          <CopyButton
            text={inputJson}
            className="rounded-[var(--radius-md)] border border-[var(--color-token-border)] px-2 py-1 text-[10px] normal-case tracking-normal text-[var(--color-token-text-secondary)] transition-colors hover:text-[var(--color-token-foreground)]"
          />
        </div>
        <CodeViewer code={inputJson} language="json" maxLines={18} />
      </div>
    )
  }

  // For errors, show result output
  if (resultText && result) {
    return renderResultOutput(result, resultText)
  }

  return null
})

// ── File Write renderer (Write, Edit, MultiEdit) ──

const FileWriteRenderer = memo(function FileWriteRenderer({
  toolName,
  input,
  result,
  isPending,
  partialInput,
}: RendererProps) {
  const filePath = typeof input.file_path === 'string' ? input.file_path : 'file'
  const resultText = result ? getVisibleResultText(toolName, result) : null
  const resultOutput = result && resultText ? renderResultOutput(result, resultText) : null

  // Edit tool: show diff
  if (toolName === 'Edit' && typeof input.old_string === 'string' && typeof input.new_string === 'string') {
    return (
      <>
        <DiffViewer filePath={filePath} oldString={input.old_string} newString={input.new_string} />
        {resultOutput}
      </>
    )
  }

  // Write tool: show creation diff
  if (toolName === 'Write' && typeof input.content === 'string') {
    return (
      <>
        <DiffViewer filePath={filePath} oldString="" newString={input.content} />
        {resultOutput}
      </>
    )
  }

  // Streaming write preview
  if (isPending && partialInput && toolName === 'Write') {
    const writerContent = extractPartialJsonStringField(partialInput, 'content')
    if (writerContent !== null) {
      return renderWriterPreview(writerContent)
    }
    return renderPartialInput(partialInput)
  }

  if (isPending && partialInput) {
    return renderPartialInput(partialInput)
  }

  // Default: show result output
  return resultOutput ?? null
})

// ── Skill renderer ──

const SkillRenderer = memo(function SkillRenderer({
  result,
}: RendererProps) {
  const resultText = result ? extractTextContent(result.content) : null
  if (!resultText || !result) return null
  return renderResultOutput(result, resultText)
})

// ── Fallback renderer ──

const FallbackRenderer = memo(function FallbackRenderer({
  input,
  result,
  partialInput,
}: RendererProps) {
  if (partialInput) {
    return renderPartialInput(partialInput)
  }

  const resultText = result ? extractTextContent(result.content) : null
  const inputJson = JSON.stringify(input, null, 2)

  return (
    <>
      {resultText && result && renderResultOutput(result, resultText)}
      <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-token-border)] bg-[var(--color-surface)]">
        <div className="flex items-center justify-between border-b border-[var(--color-token-border)] px-3 py-2 text-[10px] uppercase tracking-[0.18em] text-[var(--color-outline)]">
          <span>Tool Input</span>
          <CopyButton
            text={inputJson}
            className="rounded-[var(--radius-md)] border border-[var(--color-token-border)] px-2 py-1 text-[10px] normal-case tracking-normal text-[var(--color-token-text-secondary)] transition-colors hover:text-[var(--color-token-foreground)]"
          />
        </div>
        <CodeViewer code={inputJson} language="json" maxLines={18} />
      </div>
    </>
  )
})

// ── Renderer selector ──

export function getToolRenderer(family: ToolFamily) {
  switch (family) {
    case 'shell':
      return ShellRenderer
    case 'search':
    case 'explore':
      return SearchRenderer
    case 'file-read':
      return FileReadRenderer
    case 'file-write':
      return FileWriteRenderer
    case 'skill':
      return SkillRenderer
    default:
      return FallbackRenderer
  }
}

// ── Summary helpers ──

export function getToolKindDetail(
  toolName: string,
  input: Record<string, unknown>,
): string {
  const getString = (key: string) => {
    const val = input[key]
    return typeof val === 'string' ? val : ''
  }

  switch (toolName) {
    case 'Bash':
      return getString('command')
    case 'Read':
    case 'Write':
    case 'Edit':
    case 'MultiEdit': {
      const path = getString('file_path')
      return path ? path.split('/').pop() || '' : ''
    }
    case 'Glob':
    case 'Grep':
      return getString('pattern')
    case 'Agent':
      return getString('description')
    case 'WebSearch':
      return getString('query')
    case 'WebFetch':
      return getString('url')
    case 'Skill':
      return getString('name') || getString('skill')
    default:
      return ''
  }
}

export function getToolResultSummary(
  toolName: string,
  content: unknown,
  isError: boolean,
): string {
  const text = extractTextContent(content)
  if (!text) return ''

  if (isError) {
    const firstLine = text
      .split('\n')
      .map((line) => stripAnsi(line).replace(/\s+/g, ' ').trim())
      .find(Boolean)
    if (!firstLine) return 'Error'
    return firstLine.length <= 72 ? firstLine : `${firstLine.slice(0, 72)}…`
  }

  if (toolName === 'Bash') return ''

  const lineCount = text.split('\n').length
  if (lineCount > 1) return `${lineCount} lines`

  const compact = text.replace(/\s+/g, ' ').trim()
  if (!compact) return ''
  if (compact.length <= 36) return compact
  return `${compact.slice(0, 36)}…`
}

// ── Shared render helpers ──

function renderResultOutput(
  result: { content: unknown; isError: boolean },
  text: string,
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
          <span>{result.isError ? 'Error Output' : 'Tool Output'}</span>
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

function renderWriterPreview(content: string) {
  const lines = content.length === 0 ? [] : content.split('\n')
  const totalLines = lines.length
  const maxLines = 120
  const maxChars = 30000
  const visibleLines = lines.length > maxLines ? lines.slice(-maxLines) : lines
  let visibleContent = visibleLines.join('\n')
  const charTruncated = visibleContent.length > maxChars
  if (charTruncated) visibleContent = visibleContent.slice(-maxChars)
  const visibleLineCount = visibleContent.length === 0 ? 0 : visibleContent.split('\n').length
  const isWindowed = totalLines > visibleLines.length || charTruncated
  const statsSummary = isWindowed
    ? `latest ${visibleLineCount} / ${totalLines} lines · ${content.length} chars`
    : `${totalLines} lines · ${content.length} chars`

  return (
    <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-token-border)] bg-[var(--color-surface)]">
      <div className="flex items-center justify-between border-b border-[var(--color-token-border)] px-3 py-2 text-[10px] uppercase tracking-[0.18em] text-[var(--color-outline)]">
        <span>Writer</span>
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

function renderPartialInput(partialInput: string) {
  const formatted = formatPartialJsonInput(partialInput)
  return (
    <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-token-border)] bg-[var(--color-surface)]">
      <div className="border-b border-[var(--color-token-border)] px-3 py-2 text-[10px] uppercase tracking-[0.18em] text-[var(--color-outline)]">
        Partial input
      </div>
      <CodeViewer code={formatted} language="json" maxLines={8} wrapLongLines />
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
      if (escaping) escaping = false
      else if (char === '\\') escaping = true
      else if (char === '"') inString = false
      continue
    }
    if (skipWhitespace && /\s/.test(char)) continue
    skipWhitespace = false
    if (char === '"') { inString = true; output += char; continue }
    if (char === '{' || char === '[') { output += char; indent += 1; newline(); continue }
    if (char === '}' || char === ']') { indent = Math.max(0, indent - 1); if (!output.endsWith('\n')) newline(); output += char; continue }
    if (char === ',') { output += char; newline(); continue }
    if (char === ':') { output += ': '; skipWhitespace = true; continue }
    output += char
  }
  return output.trimEnd()
}

function stripAnsi(value: string): string {
  return value.replace(/\x1B\[[0-9;]*m/g, '')
}

export function extractTextContent(content: unknown): string | null {
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

export function getToolContentStats(
  toolName: string,
  obj: Record<string, unknown>,
  partialInput?: string,
): { lines: number; chars: number } | null {
  const content = getToolContentForStats(toolName, obj, partialInput)
  if (content === null) return null
  return { lines: content.length === 0 ? 0 : content.split('\n').length, chars: content.length }
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
