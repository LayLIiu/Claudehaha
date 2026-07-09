import { memo, useMemo, useCallback } from 'react'
import type { MouseEvent as ReactMouseEvent } from 'react'
import DOMPurify from 'dompurify'
import katex from 'katex'
import 'katex/dist/katex.min.css'
import { marked, type Tokens } from 'marked'
import { CodeViewer } from '../chat/CodeViewer'
import { MermaidRenderer } from '../chat/MermaidRenderer'
import { copyTextToClipboard } from '../chat/clipboard'

type Props = {
  content: string
  variant?: 'default' | 'document' | 'compact'
  className?: string
  cache?: boolean
  streaming?: boolean
  onLinkClick?: (href: string, event: ReactMouseEvent<HTMLDivElement>) => boolean | void
}

type CodeBlock = {
  id: string
  code: string
  language: string | undefined
}

type MathBlock = {
  id: string
  tex: string
  displayMode: boolean
}

type HtmlPart = { type: 'html'; content: string }
type CodePart = { type: 'code'; block: CodeBlock }
type MarkdownPart = HtmlPart | CodePart

const MERMAID_LANGUAGE = 'mermaid'
const PLAINTEXT_LANGUAGES = new Set(['', 'text', 'plaintext', 'plain'])
const MERMAID_DIAGRAM_START = /^(graph|flowchart|sequenceDiagram|classDiagram|stateDiagram(?:-v2)?|erDiagram|journey|gantt|pie|gitGraph|mindmap|timeline|requirementDiagram|quadrantChart|xychart-beta|sankey-beta|block-beta|packet-beta|architecture|kanban)\b/i
const CODE_FENCE_START = /^ {0,3}(`{3,}|~{3,})/
const MATH_RENDER_CACHE_LIMIT = 200
const mathRenderCache = new Map<string, string>()
const MARKDOWN_SANITIZE_CONFIG = {
  ADD_TAGS: ['use'],
  ADD_ATTR: ['xlink:href'],
  FORBID_TAGS: ['style'],
  FORBID_ATTR: ['style'],
}

function normalizeCodeLanguage(language: string | undefined): string | undefined {
  const normalized = language?.trim().split(/\s+/)[0]?.toLowerCase()
  return normalized || undefined
}

function looksLikeMermaid(code: string): boolean {
  const firstMeaningfulLine = code
    .split('\n')
    .map((line) => line.trim())
    .find(Boolean)

  return firstMeaningfulLine ? MERMAID_DIAGRAM_START.test(firstMeaningfulLine) : false
}

function shouldRenderAsMermaid(block: CodeBlock): boolean {
  const normalizedLanguage = normalizeCodeLanguage(block.language)

  if (normalizedLanguage === MERMAID_LANGUAGE) {
    return true
  }

  if (!PLAINTEXT_LANGUAGES.has(normalizedLanguage ?? '')) {
    return false
  }

  return looksLikeMermaid(block.code)
}

function MermaidStreamingPlaceholder() {
  return (
    <div
      data-testid="mermaid-streaming-placeholder"
      className="my-4 flex items-center justify-center rounded-[var(--radius-lg)] border border-[var(--color-token-border-light)]/50 bg-[var(--color-token-bg-subtle,rgba(255,255,255,0.04))] py-8"
    >
      <div className="flex items-center gap-2 text-[11px] text-[var(--color-token-text-secondary)]">
        <span className="material-symbols-outlined icon-sm animate-spin">progress_activity</span>
        Generating diagram...
      </div>
    </div>
  )
}

const renderer = new marked.Renderer()

let pendingCodeBlocks: CodeBlock[] = []

renderer.code = function ({ text, lang }: Tokens.Code) {
  const id = `cb-${pendingCodeBlocks.length}`
  pendingCodeBlocks.push({
    id,
    code: text,
    language: normalizeCodeLanguage(lang || undefined),
  })
  return `<div data-codeblock-id="${id}"></div>`
}

marked.setOptions({
  breaks: true,
  gfm: true,
})
marked.use({ renderer })

function findUnescapedDelimiter(text: string, delimiter: string, fromIndex: number): number {
  let index = text.indexOf(delimiter, fromIndex)
  while (index !== -1) {
    let backslashCount = 0
    for (let i = index - 1; i >= 0 && text[i] === '\\'; i--) {
      backslashCount += 1
    }
    if (backslashCount % 2 === 0) return index
    index = text.indexOf(delimiter, index + delimiter.length)
  }
  return -1
}

function consumeMath(
  content: string,
  mathBlocks: MathBlock[],
  start: number,
  open: string,
  close: string,
  displayMode: boolean,
): { replacement: string; end: number } | null {
  const contentStart = start + open.length
  const end = findUnescapedDelimiter(content, close, contentStart)
  if (end === -1) return null

  const tex = content.slice(contentStart, end)
  if (!tex.trim()) return null
  if (!displayMode && /[\n\r]/.test(tex)) return null
  if (open === '$' && (/\s/.test(content[contentStart] ?? '') || /\s/.test(content[end - 1] ?? ''))) {
    return null
  }

  const id = `math-${mathBlocks.length}`
  mathBlocks.push({ id, tex, displayMode })
  const tag = displayMode ? 'div' : 'span'
  const spacing = displayMode ? '\n\n' : ''
  return {
    replacement: `${spacing}<${tag} data-math-id="${id}"></${tag}>${spacing}`,
    end: end + close.length,
  }
}

function extractMathFromSegment(segment: string, mathBlocks: MathBlock[]): string {
  let output = ''
  let index = 0

  while (index < segment.length) {
    if (segment[index] === '`') {
      const match = /^`+/.exec(segment.slice(index))
      const ticks = match?.[0] ?? '`'
      const end = segment.indexOf(ticks, index + ticks.length)
      if (end !== -1) {
        output += segment.slice(index, end + ticks.length)
        index = end + ticks.length
        continue
      }
    }

    const displayDollar = segment.startsWith('$$', index)
      ? consumeMath(segment, mathBlocks, index, '$$', '$$', true)
      : null
    if (displayDollar) {
      output += displayDollar.replacement
      index = displayDollar.end
      continue
    }

    const displayBracket = segment.startsWith('\\[', index)
      ? consumeMath(segment, mathBlocks, index, '\\[', '\\]', true)
      : null
    if (displayBracket) {
      output += displayBracket.replacement
      index = displayBracket.end
      continue
    }

    const inlineParen = segment.startsWith('\\(', index)
      ? consumeMath(segment, mathBlocks, index, '\\(', '\\)', false)
      : null
    if (inlineParen) {
      output += inlineParen.replacement
      index = inlineParen.end
      continue
    }

    const inlineDollar = segment[index] === '$' && segment[index + 1] !== '$'
      ? consumeMath(segment, mathBlocks, index, '$', '$', false)
      : null
    if (inlineDollar) {
      output += inlineDollar.replacement
      index = inlineDollar.end
      continue
    }

    output += segment[index]
    index += 1
  }

  return output
}

function extractMath(content: string): { markdown: string; mathBlocks: MathBlock[] } {
  const mathBlocks: MathBlock[] = []
  const lines = content.match(/[^\n]*\n|[^\n]+/g) ?? ['']
  let output = ''
  let pendingMarkdown = ''
  let inFence: string | null = null

  const flushPendingMarkdown = () => {
    if (!pendingMarkdown) return
    output += extractMathFromSegment(pendingMarkdown, mathBlocks)
    pendingMarkdown = ''
  }

  for (const line of lines) {
    const fenceMatch = CODE_FENCE_START.exec(line)
    if (fenceMatch) {
      const marker = fenceMatch[1]!.charAt(0)
      if (!inFence) {
        flushPendingMarkdown()
        inFence = marker
      } else if (inFence === marker) {
        inFence = null
      }
      output += line
      continue
    }

    if (inFence) {
      output += line
    } else {
      pendingMarkdown += line
    }
  }

  flushPendingMarkdown()

  return { markdown: output, mathBlocks }
}

function renderMath(block: MathBlock): string {
  const cacheKey = `${block.displayMode ? 'block' : 'inline'}\0${block.tex}`
  const cached = mathRenderCache.get(cacheKey)
  if (cached) return cached

  try {
    const rendered = katex.renderToString(block.tex, {
      displayMode: block.displayMode,
      output: 'html',
      throwOnError: false,
      strict: false,
      trust: false,
    })
    mathRenderCache.set(cacheKey, rendered)
    if (mathRenderCache.size > MATH_RENDER_CACHE_LIMIT) {
      const firstKey = mathRenderCache.keys().next().value
      if (firstKey) mathRenderCache.delete(firstKey)
    }
    return rendered
  } catch {
    return DOMPurify.sanitize(block.tex)
  }
}

function enhanceMarkdownHtml(html: string, mathBlocks: MathBlock[]): string {
  const cleanHtml = DOMPurify.sanitize(html, MARKDOWN_SANITIZE_CONFIG)

  const needsDomEnhancement = mathBlocks.length > 0 || /<(?:a|table)\b/i.test(cleanHtml)
  if (!needsDomEnhancement) {
    return cleanHtml
  }

  if (typeof document === 'undefined') {
    return cleanHtml
  }

  const container = document.createElement('div')
  container.innerHTML = cleanHtml
  const mathById = new Map(mathBlocks.map((block) => [block.id, block]))

  container.querySelectorAll<HTMLElement>('[data-math-id]').forEach((placeholder) => {
    const block = mathById.get(placeholder.dataset.mathId ?? '')
    if (!block) return

    const rendered = document.createElement(block.displayMode ? 'div' : 'span')
    rendered.className = block.displayMode ? 'md-math-display' : 'md-math-inline'
    rendered.innerHTML = renderMath(block)
    placeholder.replaceWith(rendered)
  })

  container.querySelectorAll('table').forEach((table) => {
    if (table.parentElement?.classList.contains('md-table-wrap')) return
    const wrapper = document.createElement('div')
    wrapper.className = 'md-table-wrap'
    table.parentNode?.insertBefore(wrapper, table)
    wrapper.appendChild(table)
  })

  container.querySelectorAll('a[href]').forEach((link) => {
    link.setAttribute('target', '_blank')
    link.setAttribute('rel', 'noreferrer noopener')
  })

  return container.innerHTML
}

function parseMarkdown(content: string): { html: string; codeBlocks: CodeBlock[]; mathBlocks: MathBlock[] } {
  pendingCodeBlocks = []
  const { markdown, mathBlocks } = extractMath(content)
  const html = marked.parse(markdown) as string
  const codeBlocks = [...pendingCodeBlocks]
  pendingCodeBlocks = []
  return { html, codeBlocks, mathBlocks }
}

type MarkdownParseResult = ReturnType<typeof parseMarkdown>

type CacheEntry = {
  parsed: MarkdownParseResult
  chars: number
}

const FINALIZED_CACHE_MAX_ENTRIES = 200
const FINALIZED_CACHE_MAX_CHARS = 8_000_000
const STREAMING_CACHE_MAX_ENTRIES = 4

const finalizedMarkdownCache = new Map<string, CacheEntry>()
const streamingMarkdownCache = new Map<string, CacheEntry>()
let finalizedMarkdownCacheChars = 0

function fnv1aHash(value: string): number {
  let hash = 2166136261 >>> 0
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function buildMarkdownCacheKey(content: string): string {
  return `${content.length}:${fnv1aHash(content).toString(36)}`
}

function evictFinalizedMarkdownEntries(): void {
  while (
    finalizedMarkdownCache.size > FINALIZED_CACHE_MAX_ENTRIES ||
    finalizedMarkdownCacheChars > FINALIZED_CACHE_MAX_CHARS
  ) {
    const oldestKey = finalizedMarkdownCache.keys().next().value
    if (typeof oldestKey !== 'string') break
    const entry = finalizedMarkdownCache.get(oldestKey)
    finalizedMarkdownCache.delete(oldestKey)
    if (entry) finalizedMarkdownCacheChars -= entry.chars
  }
}

function evictStreamingMarkdownEntries(): void {
  while (streamingMarkdownCache.size > STREAMING_CACHE_MAX_ENTRIES) {
    const oldestKey = streamingMarkdownCache.keys().next().value
    if (typeof oldestKey !== 'string') break
    streamingMarkdownCache.delete(oldestKey)
  }
}

function getCachedMarkdownParse(content: string, streaming: boolean): MarkdownParseResult {
  const cache = streaming ? streamingMarkdownCache : finalizedMarkdownCache
  const key = buildMarkdownCacheKey(content)
  const cached = cache.get(key)
  if (cached) {
    cache.delete(key)
    cache.set(key, cached)
    return cached.parsed
  }

  const parsed = parseMarkdown(content)
  const entry: CacheEntry = { parsed, chars: content.length }
  cache.set(key, entry)

  if (streaming) {
    evictStreamingMarkdownEntries()
  } else {
    finalizedMarkdownCacheChars += content.length
    evictFinalizedMarkdownEntries()
  }

  return parsed
}

export const __markdownParseCacheInternals = {
  finalizedSize: () => finalizedMarkdownCache.size,
  streamingSize: () => streamingMarkdownCache.size,
  finalizedChars: () => finalizedMarkdownCacheChars,
  hasFinalized: (content: string) => finalizedMarkdownCache.has(buildMarkdownCacheKey(content)),
  hasStreaming: (content: string) => streamingMarkdownCache.has(buildMarkdownCacheKey(content)),
  reset: () => {
    finalizedMarkdownCache.clear()
    streamingMarkdownCache.clear()
    finalizedMarkdownCacheChars = 0
  },
}

const BASE_PROSE_CLASSES = `markdown-prose min-w-0 max-w-none break-words [overflow-wrap:anywhere] text-[var(--color-token-text-primary)]
  [font-size:var(--markdown-font-size,var(--text-size-chat,14px))] [line-height:var(--markdown-line-height,calc(var(--markdown-font-size,var(--text-size-chat,14px))+8px))]
  prose-headings:text-[var(--color-token-text-primary)] prose-headings:font-semibold prose-headings:leading-[1.25]
  prose-h1:text-[24px] prose-h1:mt-[20px] prose-h1:mb-[10px]
  prose-h2:text-[20px] prose-h2:mt-[20px] prose-h2:mb-[10px]
  prose-h3:text-[17px] prose-h3:leading-[22px] prose-h3:mt-[20px] prose-h3:mb-[10px]
  prose-h4:text-[17px] prose-h4:leading-[22px] prose-h4:mt-[20px] prose-h4:mb-[10px]
  prose-h5:text-[15px] prose-h5:leading-[20px] prose-h5:mt-[20px] prose-h5:mb-[10px]
  prose-h6:text-[15px] prose-h6:leading-[20px] prose-h6:mt-[20px] prose-h6:mb-[10px]
  prose-p:m-[0_0_0.6875rem] prose-p:leading-[var(--markdown-line-height,calc(var(--markdown-font-size,var(--text-size-chat,14px))+8px))]
  prose-p:break-words prose-p:[overflow-wrap:anywhere]
  prose-code:text-[.92em] prose-code:text-[var(--color-token-foreground)] prose-code:font-[var(--font-mono)] prose-code:bg-[color-mix(in_srgb,var(--color-token-list-hover-background,rgba(255,255,255,0.06))_60%,var(--color-token-foreground)_6%)] prose-code:border-0 prose-code:px-[6px] prose-code:py-[1px] prose-code:rounded-[var(--radius-xs)] prose-code:before:hidden prose-code:after:hidden
  prose-pre:!bg-transparent prose-pre:!p-0 prose-pre:!shadow-none
  prose-a:font-medium prose-a:text-[var(--color-text-accent)] prose-a:no-underline prose-a:[overflow-wrap:anywhere] prose-a:decoration-[var(--color-token-focus-border,var(--color-border-focus))]/70 prose-a:underline-offset-[3px] hover:prose-a:underline
  prose-strong:text-[var(--color-token-foreground)]
  prose-ul:my-3 prose-ol:my-3 prose-ul:pl-[1.3125rem] prose-ol:pl-[1.3125rem] prose-ul:list-outside prose-ol:list-outside prose-ul:list-disc prose-ol:list-decimal
  prose-li:my-[0.5rem] prose-li:pl-[0.125rem] prose-li:text-[var(--color-token-foreground)]
  [&_ul_ul]:list-circle [&_ul_ul_ul]:list-square
  [&_ol>li::marker]:text-[var(--color-token-foreground)] [&_ul>li::marker]:text-[var(--color-token-foreground)]
  prose-blockquote:m-[0_0_8px] prose-blockquote:border-0 prose-blockquote:bg-transparent prose-blockquote:p-[8px_0_8px_24px] prose-blockquote:not-italic prose-blockquote:leading-[24px] prose-blockquote:relative prose-blockquote:text-[var(--color-token-foreground)]
  [&_blockquote::after]:content-[''] [&_blockquote::after]:absolute [&_blockquote::after]:left-0 [&_blockquote::after]:top-2 [&_blockquote::after]:bottom-2 [&_blockquote::after]:w-1 [&_blockquote::after]:rounded-[2px] [&_blockquote::after]:bg-[var(--color-token-border)]
  prose-hr:m-[28px_0] prose-hr:border-0 prose-hr:border-t prose-hr:border-[var(--color-token-border)]
  prose-table:my-0 prose-table:w-full prose-table:table-auto prose-table:text-[14px] prose-table:border-separate prose-table:border-spacing-0
  prose-th:px-3 prose-th:pt-2 prose-th:pb-2 prose-th:text-left prose-th:whitespace-normal prose-th:break-words prose-th:align-top prose-th:font-semibold prose-th:leading-[16px] prose-th:text-[var(--color-token-foreground)] prose-th:border-b prose-th:border-[var(--color-token-border)]
  prose-td:px-3 prose-td:pt-[10px] prose-td:pb-[10px] prose-td:border-b prose-td:border-[var(--color-token-border-light)] prose-td:whitespace-normal prose-td:break-words prose-td:align-top
  [&_.katex]:[white-space:nowrap] [&_.katex]:[overflow-wrap:normal] [&_.katex]:[word-break:normal]
  [&_.md-math-inline]:inline-flex [&_.md-math-inline]:max-w-full [&_.md-math-inline]:overflow-x-auto [&_.md-math-inline]:[vertical-align:-0.08em] [&_.md-math-inline_.katex]:text-[1.02em]
  [&_.md-math-display]:my-5 [&_.md-math-display]:flex [&_.md-math-display]:max-w-full [&_.md-math-display]:justify-center [&_.md-math-display]:overflow-x-auto [&_.md-math-display]:px-1 [&_.md-math-display]:py-2 [&_.md-math-display]:[scrollbar-width:thin]
  [&_.md-math-display_.katex-display]:m-0 [&_.md-math-display_.katex]:text-[1.14em] [&_.md-math-display_.katex-html]:min-w-max
  [&_.md-table-wrap]:my-5 [&_.md-table-wrap]:overflow-x-auto [&_.md-table-wrap]:rounded-[var(--radius-2xl)] [&_.md-table-wrap]:border [&_.md-table-wrap]:border-[var(--color-token-border)] [&_.md-table-wrap]:bg-[var(--color-token-dropdown-background,var(--color-token-bg-subtle,rgba(255,255,255,0.04)))]`

const DOCUMENT_PROSE_CLASSES = `
  prose-p:text-[15px] prose-p:leading-7 prose-p:text-[var(--color-token-foreground)]
  prose-headings:scroll-mt-6 prose-headings:tracking-[-0.014em]
  prose-h1:mb-4 prose-h1:text-[1.9rem] prose-h1:font-semibold prose-h1:leading-[1.18]
  prose-h2:mt-9 prose-h2:mb-3 prose-h2:border-b prose-h2:border-[var(--color-token-border)] prose-h2:pb-2 prose-h2:text-[1.28rem] prose-h2:font-semibold
  prose-h3:mt-7 prose-h3:mb-2.5 prose-h3:text-[1.02rem] prose-h3:font-semibold
  prose-h4:mt-5 prose-h4:mb-2 prose-h4:text-[0.95rem] prose-h4:font-semibold prose-h4:text-[var(--color-token-text-secondary)]
  prose-blockquote:my-5 prose-blockquote:rounded-[var(--radius-xl)] prose-blockquote:border-l-2 prose-blockquote:border-[var(--color-token-focus-border,var(--color-border-focus))] prose-blockquote:bg-[var(--color-token-bg-subtle,rgba(255,255,255,0.04))] prose-blockquote:px-4 prose-blockquote:py-3 prose-blockquote:not-italic prose-blockquote:text-[var(--color-token-text-secondary)]
  prose-hr:my-7 prose-hr:border-[var(--color-token-border)]
  prose-img:rounded-lg prose-img:border prose-img:border-[var(--color-token-border)]
  prose-kbd:rounded-[var(--radius-sm)] prose-kbd:border prose-kbd:border-[var(--color-token-border)] prose-kbd:bg-[var(--color-token-bg-subtle,rgba(255,255,255,0.04))] prose-kbd:px-1.5 prose-kbd:py-0.5 prose-kbd:font-[var(--font-mono)] prose-kbd:text-[12px] prose-kbd:font-normal prose-kbd:text-[var(--color-token-text-secondary)] prose-kbd:shadow-none
  prose-ul:pl-5 prose-ul:[&>li]:marker:text-[var(--color-token-foreground)]
  prose-ol:pl-5 prose-ol:[&>li]:marker:text-[var(--color-token-foreground)]
  prose-li:my-1.5 prose-li:text-[var(--color-token-foreground)]
  prose-table:my-0
  [&_.md-math-display]:my-6 [&_.md-math-display_.katex]:text-[1.18em]`

const COMPACT_PROSE_CLASSES = `
  prose-p:my-1 prose-p:text-xs prose-p:leading-5 prose-p:text-[var(--color-token-text-secondary)]
  prose-headings:mt-2 prose-headings:mb-1 prose-headings:leading-snug
  prose-h1:text-base prose-h2:text-sm prose-h3:text-xs prose-h4:text-xs
  prose-blockquote:my-2 prose-blockquote:border-l-2 prose-blockquote:border-[var(--color-token-border)] prose-blockquote:pl-3 prose-blockquote:text-[var(--color-token-text-secondary)]
  prose-code:text-[12px]
  prose-ul:my-1 prose-ol:my-1 prose-ul:pl-4 prose-ol:pl-4
  prose-li:my-0.5 prose-li:text-xs prose-li:leading-5 prose-li:text-[var(--color-token-text-secondary)]
  prose-table:text-xs
  [&_.md-math-display]:my-2 [&_.md-math-display]:py-1 [&_.md-math-display_.katex]:text-[1.04em]
  [&_.md-table-wrap]:my-2`

function getProseClasses(variant: 'default' | 'document' | 'compact', streaming: boolean, className?: string) {
  return [
    BASE_PROSE_CLASSES,
    !streaming ? 'markdown-fade-root' : '',
    variant === 'document' ? DOCUMENT_PROSE_CLASSES : '',
    variant === 'compact' ? COMPACT_PROSE_CLASSES : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ')
}

export const MarkdownRenderer = memo(function MarkdownRenderer({ content, variant = 'default', className, cache = true, streaming = false, onLinkClick }: Props) {
  const { html, codeBlocks, mathBlocks } = useMemo(
    () => cache ? getCachedMarkdownParse(content, streaming) : parseMarkdown(content),
    [cache, content, streaming],
  )
  const proseClasses = useMemo(
    () => getProseClasses(variant, streaming, className),
    [variant, streaming, className],
  )

  const parts = useMemo(() => {
    if (codeBlocks.length === 0) {
      return [{ type: 'html' as const, content: enhanceMarkdownHtml(html, mathBlocks) }]
    }

    const result: MarkdownPart[] = []
    let remaining = html

    for (const block of codeBlocks) {
      const marker = `<div data-codeblock-id="${block.id}"></div>`
      const idx = remaining.indexOf(marker)
      if (idx === -1) continue

      const before = remaining.slice(0, idx)
      if (before) {
        result.push({ type: 'html', content: enhanceMarkdownHtml(before, mathBlocks) })
      }
      result.push({ type: 'code', block })
      remaining = remaining.slice(idx + marker.length)
    }

    if (remaining) {
      result.push({ type: 'html', content: enhanceMarkdownHtml(remaining, mathBlocks) })
    }

    return result
  }, [html, codeBlocks, mathBlocks])

  const handleClick = useCallback(async (event: ReactMouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement | null
    const button = target?.closest<HTMLButtonElement>('[data-copy-code]')
    if (!button) {
      const link = target?.closest<HTMLAnchorElement>('a[href]')
      if (!link || !onLinkClick) return

      const handled = onLinkClick(link.getAttribute('href') ?? '', event)
      if (handled) {
        event.preventDefault()
        event.stopPropagation()
      }
      return
    }

    const text = button.getAttribute('data-copy-code')
    if (!text) return

    const copied = await copyTextToClipboard(text)
    if (!copied) return

    const original = button.textContent
    button.textContent = 'Copied'
    window.setTimeout(() => {
      button.textContent = original
    }, 1500)
  }, [onLinkClick])

  if (codeBlocks.length === 0) {
    return (
      <div
        className={proseClasses}
        dangerouslySetInnerHTML={{ __html: parts[0]?.type === 'html' ? parts[0].content : '' }}
        onClick={handleClick}
      />
    )
  }

  return (
    <div className={proseClasses} onClick={handleClick}>
      {parts.map((part, i) =>
        part.type === 'html' ? (
          <div key={i} dangerouslySetInnerHTML={{ __html: part.content }} />
        ) : shouldRenderAsMermaid(part.block) ? (
          streaming ? (
            <MermaidStreamingPlaceholder key={part.block.id} />
          ) : (
            <MermaidRenderer key={part.block.id} code={part.block.code} />
          )
        ) : (
          <div key={part.block.id} className="my-4">
            <CodeViewer
              code={part.block.code}
              language={part.block.language}
              showLineNumbers={false}
            />
          </div>
        )
      )}
    </div>
  )
})
