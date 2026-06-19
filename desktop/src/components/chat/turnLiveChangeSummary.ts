import type { UIMessage } from '../../types/chat'
import { calculateDiffStats, type DiffStats } from './diffStats'

export type LiveTurnChangeSummary = DiffStats & {
  fileCount: number
}

type ToolEditStats = DiffStats & {
  path: string
}

export function getCurrentTurnLiveChangeSummary(messages: UIMessage[]): LiveTurnChangeSummary | null {
  const latestUserIndex = findLatestUserMessageIndex(messages)
  if (latestUserIndex < 0) return null

  const fileStats = new Map<string, DiffStats>()
  for (const message of messages.slice(latestUserIndex + 1)) {
    if (message.type !== 'tool_use') continue
    const stats = extractToolEditStats(message)
    if (!stats) continue

    const key = normalizeStatsPath(stats.path)
    const previous = fileStats.get(key) ?? { additions: 0, deletions: 0 }
    fileStats.set(key, {
      additions: previous.additions + stats.additions,
      deletions: previous.deletions + stats.deletions,
    })
  }

  if (fileStats.size === 0) return null

  let additions = 0
  let deletions = 0
  for (const stats of fileStats.values()) {
    additions += stats.additions
    deletions += stats.deletions
  }

  return {
    fileCount: fileStats.size,
    additions,
    deletions,
  }
}

function findLatestUserMessageIndex(messages: UIMessage[]): number {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index]?.type === 'user_text') return index
  }
  return -1
}

function extractToolEditStats(message: Extract<UIMessage, { type: 'tool_use' }>): ToolEditStats | null {
  const filePath = extractStringField(message.input, 'file_path')
  if (!filePath) return null

  if (message.toolName === 'Write') {
    const content = extractStringField(message.input, 'content')
      ?? (message.partialInput ? extractPartialJsonStringField(message.partialInput, 'content') : null)
    if (content === null) return { path: filePath, additions: 0, deletions: 0 }
    return { path: filePath, ...calculateDiffStats('', content) }
  }

  if (message.toolName === 'Edit') {
    const oldString = extractStringField(message.input, 'old_string') ?? ''
    const newString = extractStringField(message.input, 'new_string')
      ?? (message.partialInput ? extractPartialJsonStringField(message.partialInput, 'new_string') : null)
    if (newString === null) return { path: filePath, additions: 0, deletions: 0 }
    return { path: filePath, ...calculateDiffStats(oldString, newString) }
  }

  if (message.toolName === 'MultiEdit') {
    const edits = Array.isArray((message.input as Record<string, unknown> | null)?.edits)
      ? ((message.input as Record<string, unknown>).edits as Array<Record<string, unknown>>)
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
    return { path: filePath, additions, deletions }
  }

  return null
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
