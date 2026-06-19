import { calculateDiffStats, type DiffStats } from './diffStats'

export type ToolEditSummaryInput = {
  toolName: string
  input: unknown
  partialInput?: string
}

export type ToolEditStats = DiffStats & {
  path: string
  label: string
}

export type ToolEditFileSummary = ToolEditStats & {
  editCount: number
}

export function extractToolEditStats(toolCall: ToolEditSummaryInput): ToolEditStats | null {
  const filePath = extractStringField(toolCall.input, 'file_path')
  const label = filePath ? getPathLeaf(filePath) : ''

  if (toolCall.toolName === 'Write') {
    const content = extractStringField(toolCall.input, 'content')
      ?? (toolCall.partialInput ? extractPartialJsonStringField(toolCall.partialInput, 'content') : null)
    if (content === null) return filePath ? { path: filePath, label, additions: 0, deletions: 0 } : null
    const { additions, deletions } = calculateDiffStats('', content)
    return { path: filePath || label || '文件', label: label || '文件', additions, deletions }
  }

  if (toolCall.toolName === 'Edit') {
    const oldString = extractStringField(toolCall.input, 'old_string') ?? ''
    const newString = extractStringField(toolCall.input, 'new_string')
      ?? (toolCall.partialInput ? extractPartialJsonStringField(toolCall.partialInput, 'new_string') : null)
    if (newString === null) return filePath ? { path: filePath, label, additions: 0, deletions: 0 } : null
    const { additions, deletions } = calculateDiffStats(oldString, newString)
    return { path: filePath || label || '文件', label: label || '文件', additions, deletions }
  }

  if (toolCall.toolName === 'MultiEdit') {
    const edits = Array.isArray((toolCall.input as Record<string, unknown> | null)?.edits)
      ? ((toolCall.input as Record<string, unknown>).edits as Array<Record<string, unknown>>)
      : []
    let additions = 0
    let deletions = 0
    for (const edit of edits) {
      const oldString = typeof edit.old_string === 'string' ? edit.old_string : ''
      const newString = typeof edit.new_string === 'string' ? edit.new_string : ''
      const diff = calculateDiffStats(oldString, newString)
      additions += diff.additions
      deletions += diff.deletions
    }
    if (!filePath && edits.length === 0) return null
    return { path: filePath || label || '文件', label: label || '文件', additions, deletions }
  }

  return null
}

export function aggregateToolEditStats(toolCalls: ToolEditSummaryInput[]): DiffStats | null {
  let additions = 0
  let deletions = 0
  let hasStats = false

  for (const toolCall of toolCalls) {
    const stats = extractToolEditStats(toolCall)
    if (!stats) continue
    hasStats = true
    additions += stats.additions
    deletions += stats.deletions
  }

  if (!hasStats || (additions === 0 && deletions === 0)) return null
  return { additions, deletions }
}

export function summarizeToolEditFiles(toolCalls: ToolEditSummaryInput[]): ToolEditFileSummary[] {
  const files = new Map<string, ToolEditFileSummary>()

  for (const toolCall of toolCalls) {
    const stats = extractToolEditStats(toolCall)
    if (!stats) continue
    const key = normalizeStatsPath(stats.path)
    const previous = files.get(key)
    if (previous) {
      files.set(key, {
        ...previous,
        additions: previous.additions + stats.additions,
        deletions: previous.deletions + stats.deletions,
        editCount: previous.editCount + 1,
      })
    } else {
      files.set(key, { ...stats, editCount: 1 })
    }
  }

  return Array.from(files.values())
}

function getPathLeaf(path: string): string {
  return path.replace(/\\/g, '/').split('/').filter(Boolean).pop() || path
}

function extractStringField(input: unknown, key: string): string | null {
  if (!input || typeof input !== 'object') return null
  const value = (input as Record<string, unknown>)[key]
  return typeof value === 'string' ? value : null
}

function extractPartialJsonStringField(source: string, field: string): string | null {
  const key = `"${field}"`
  const keyIndex = source.indexOf(key)
  if (keyIndex < 0) return null
  const colonIndex = source.indexOf(':', keyIndex + key.length)
  if (colonIndex < 0) return null

  let index = colonIndex + 1
  while (index < source.length && /\s/.test(source[index] ?? '')) index += 1
  if (source[index] !== '"') return null
  index += 1

  let value = ''
  while (index < source.length) {
    const char = source[index]
    if (char === '"') return value
    if (char !== '\\') {
      value += char
      index += 1
      continue
    }

    const escaped = source[index + 1]
    if (escaped === undefined) break
    switch (escaped) {
      case 'n':
        value += '\n'
        index += 2
        break
      case 'r':
        value += '\r'
        index += 2
        break
      case 't':
        value += '\t'
        index += 2
        break
      case 'b':
        value += '\b'
        index += 2
        break
      case 'f':
        value += '\f'
        index += 2
        break
      case '"':
      case '\\':
      case '/':
        value += escaped
        index += 2
        break
      case 'u': {
        const hex = source.slice(index + 2, index + 6)
        if (/^[0-9a-fA-F]{4}$/.test(hex)) {
          value += String.fromCharCode(Number.parseInt(hex, 16))
          index += 6
        } else {
          index = source.length
        }
        break
      }
      default:
        value += escaped
        index += 2
        break
    }
  }
  return value
}

function normalizeStatsPath(filePath: string): string {
  return filePath.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase()
}
