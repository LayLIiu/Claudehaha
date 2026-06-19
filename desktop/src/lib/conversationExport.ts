import type { UIMessage } from '../types/chat'

export function conversationToMarkdown(
  messages: UIMessage[],
  sessionTitle?: string,
): string {
  const parts: string[] = []
  if (sessionTitle) {
    parts.push('# ' + sessionTitle)
    parts.push('')
  }
  const resultMap = new Map<string, Extract<UIMessage, { type: 'tool_result' }>>()
  for (const msg of messages) {
    if (msg.type === 'tool_result') {
      resultMap.set(msg.toolUseId, msg)
    }
  }
  for (const msg of messages) {
    switch (msg.type) {
      case 'user_text': {
        const ts = fmtTs(msg.timestamp)
        parts.push('## User')
        if (ts) parts.push('*' + ts + '*')
        parts.push('')
        parts.push(msg.content)
        parts.push('')
        break
      }
      case 'assistant_text': {
        const ts = fmtTs(msg.timestamp)
        parts.push('## Assistant')
        if (ts) parts.push('*' + ts + '*')
        if (msg.model) parts.push('*Model: ' + msg.model + '*')
        parts.push('')
        parts.push(msg.content)
        parts.push('')
        break
      }
      case 'thinking': {
        parts.push('<details>')
        parts.push('<summary>Thinking</summary>')
        parts.push('')
        parts.push(msg.content)
        parts.push('')
        parts.push('</details>')
        parts.push('')
        break
      }
      case 'tool_use': {
        const result = resultMap.get(msg.toolUseId)
        const ts = fmtTs(msg.timestamp)
        parts.push('<details>')
        parts.push('<summary>' + msg.toolName + (ts ? ' - ' + ts : '') + '</summary>')
        parts.push('')
        if (msg.input != null) {
          parts.push('**Input:**')
          parts.push('```')
          parts.push(fmtInput(msg.input))
          parts.push('```')
          parts.push('')
        }
        if (result) {
          parts.push(result.isError ? '**Error:**' : '**Result:**')
          parts.push('```')
          parts.push(fmtContent(result.content))
          parts.push('```')
        } else if (msg.status === 'stopped') {
          parts.push('*Stopped*')
        }
        parts.push('')
        parts.push('</details>')
        parts.push('')
        break
      }
      case 'system': {
        parts.push('> ' + msg.content)
        parts.push('')
        break
      }
      case 'compact_summary': {
        parts.push('<details>')
        parts.push('<summary>' + (msg.title || 'Compact Summary') + '</summary>')
        parts.push('')
        if (msg.summary) parts.push(msg.summary)
        parts.push('')
        parts.push('</details>')
        parts.push('')
        break
      }
      case 'error': {
        parts.push('> **Error:** ' + msg.message)
        parts.push('')
        break
      }
      case 'tool_result':
      case 'permission_request':
      case 'background_task':
      case 'goal_event':
      case 'memory_event':
      case 'task_summary':
        break
    }
  }
  return parts.join('\n')
}

function fmtTs(ts: number): string {
  try { return new Date(ts).toLocaleString() } catch { return '' }
}

function fmtInput(input: unknown): string {
  if (typeof input === 'string') return input
  try { return JSON.stringify(input, null, 2) } catch { return String(input) }
}

function fmtContent(content: unknown): string {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content
      .map((item) => {
        if (typeof item === 'string') return item
        if (item && typeof item === 'object' && 'text' in item) return (item as { text: string }).text
        try { return JSON.stringify(item) } catch { return String(item) }
      })
      .join('\n')
  }
  try { return JSON.stringify(content, null, 2) } catch { return String(content) }
}

export function downloadMarkdownFile(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.style.display = 'none'
  document.body.appendChild(anchor)
  anchor.click()
  setTimeout(() => {
    URL.revokeObjectURL(url)
    document.body.removeChild(anchor)
  }, 100)
}
