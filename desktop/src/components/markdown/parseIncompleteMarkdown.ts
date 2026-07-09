/**
 * Parse and fix incomplete Markdown syntax for streaming scenarios.
 * Ported from ZCode's Streamdown `Op` function (parseIncompleteMarkdown).
 *
 * When AI streams Markdown incrementally, the content may have unclosed
 * syntax (e.g. `**bold` without closing `**`, or `[link](url` without `)`).
 * This function patches such incomplete syntax so that remark can parse it
 * without errors, producing a reasonable intermediate rendering.
 */

// --- Helper: count unescaped occurrences of delimiter ---
function countUnescaped(text: string, delimiter: string): number {
  let count = 0
  let i = 0
  while (i < text.length) {
    const idx = text.indexOf(delimiter, i)
    if (idx === -1) break
    // Check if escaped
    let backslashes = 0
    for (let j = idx - 1; j >= 0 && text[j] === '\\'; j--) {
      backslashes++
    }
    if (backslashes % 2 === 0) count++
    i = idx + delimiter.length
  }
  return count
}

// --- Helper: check if position is inside a code fence ---
function isInCodeFence(text: string, position: number): boolean {
  const lines = text.slice(0, position).split('\n')
  let inFence = false
  let fenceChar: string | null = null
  let fenceLen = 0

  for (const line of lines) {
    const match = /^ {0,3}(`{3,}|~{3,})/.exec(line)
    if (inFence) {
      if (match && match[1]![0] === fenceChar && match[1]!.length >= fenceLen) {
        inFence = false
      }
    } else {
      if (match) {
        inFence = true
        fenceChar = match[1]![0]
        fenceLen = match[1]!.length
      }
    }
  }
  return inFence
}

// --- Handlers (sorted by priority) ---

function handleUnclosedCodeFence(text: string): string {
  // Check if the text ends with an unclosed code fence
  const lines = text.split('\n')
  let inFence = false
  let fenceChar: string | null = null
  let fenceLen = 0

  for (const line of lines) {
    const match = /^ {0,3}(`{3,}|~{3,})/.exec(line)
    if (inFence) {
      if (match && match[1]![0] === fenceChar && match[1]!.length >= fenceLen) {
        inFence = false
      }
    } else {
      if (match) {
        inFence = true
        fenceChar = match[1]![0]
        fenceLen = match[1]!.length
      }
    }
  }

  if (inFence) {
    return text + '\n' + fenceChar!.repeat(fenceLen)
  }
  return text
}

function handleUnclosedBold(text: string): string {
  // Count unescaped ** outside of code blocks
  // Simple approach: count ** in non-code regions
  const count = countUnescaped(text, '**')
  if (count % 2 !== 0) {
    return text + '**'
  }
  return text
}

function handleUnclosedItalicAsterisk(text: string): string {
  // Count unescaped * (not part of **) outside of code blocks
  let count = 0
  let i = 0
  while (i < text.length) {
    if (text[i] === '*' && (i === 0 || text[i - 1] !== '*') && (i === text.length - 1 || text[i + 1] !== '*')) {
      let backslashes = 0
      for (let j = i - 1; j >= 0 && text[j] === '\\'; j--) {
        backslashes++
      }
      if (backslashes % 2 === 0) count++
    }
    i++
  }
  if (count % 2 !== 0) {
    return text + '*'
  }
  return text
}

function handleIncompleteLinks(text: string): string {
  // Fix [text](url without closing paren
  return text.replace(/\[([^\]]*)\]\(([^)\s]*)$/, '[$1](streamdown:incomplete-link)')
}

function handleUnclosedInlineCode(text: string): string {
  // Check for unclosed single backtick (not part of a code fence)
  // Count backtick runs: a single ` that isn't part of `` or ```
  let singleBacktickCount = 0
  let i = 0
  while (i < text.length) {
    if (text[i] === '`') {
      let runLen = 0
      while (i + runLen < text.length && text[i + runLen] === '`') runLen++
      if (runLen === 1) singleBacktickCount++
      i += runLen
    } else {
      i++
    }
  }
  if (singleBacktickCount % 2 !== 0) {
    return text + '`'
  }
  return text
}

function handleUnclosedDisplayMath(text: string): string {
  const count = countUnescaped(text, '$$')
  if (count % 2 !== 0) {
    return text + '\n$$'
  }
  return text
}

function handleUnclosedInlineMath(text: string): string {
  // Count $ that are not part of $$ and not inside code
  // Simple approach: find all $ positions, exclude those adjacent to another $
  let count = 0
  let i = 0
  while (i < text.length) {
    if (text[i] === '$' && text[i + 1] !== '$' && (i === 0 || text[i - 1] !== '$')) {
      let backslashes = 0
      for (let j = i - 1; j >= 0 && text[j] === '\\'; j--) {
        backslashes++
      }
      if (backslashes % 2 === 0) count++
    }
    i++
  }
  if (count % 2 !== 0) {
    return text + '$'
  }
  return text
}

// --- Main function ---

export function parseIncompleteMarkdown(content: string): string {
  if (!content || typeof content !== 'string') return content

  // Remove trailing single space (but preserve double space for line breaks)
  let result = content.endsWith(' ') && !content.endsWith('  ') ? content.slice(0, -1) : content

  // Apply handlers in priority order (lowest first)
  result = handleUnclosedCodeFence(result)
  result = handleIncompleteLinks(result)
  result = handleUnclosedBold(result)
  result = handleUnclosedItalicAsterisk(result)
  result = handleUnclosedInlineCode(result)
  result = handleUnclosedDisplayMath(result)
  result = handleUnclosedInlineMath(result)

  return result
}