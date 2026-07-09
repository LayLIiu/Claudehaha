import { memo, useMemo, useTransition, useState, useEffect } from 'react'
import type { MouseEvent as ReactMouseEvent } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import rehypeRaw from 'rehype-raw'
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize'
import 'katex/dist/katex.min.css'
import { parseIncompleteMarkdown } from './parseIncompleteMarkdown'
import { parseMarkdownIntoBlocks } from './parseMarkdownIntoBlocks'
import { createStreamdownComponents } from './StreamdownComponents'

export type StreamdownRendererProps = {
  content: string
  variant?: 'default' | 'document' | 'compact'
  className?: string
  cache?: boolean
  streaming?: boolean
  onLinkClick?: (href: string, event: ReactMouseEvent<HTMLDivElement>) => boolean | void
}

type Props = StreamdownRendererProps

// Sanitize schema: extend defaults to allow math + code attributes
const sanitizeSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    code: [...(defaultSchema.attributes?.code ?? []), 'className', 'metastring'],
    span: [...(defaultSchema.attributes?.span ?? []), 'className', 'style'],
    div: [...(defaultSchema.attributes?.div ?? []), 'className', 'style', 'data-*'],
  },
  tagNames: [...(defaultSchema.tagNames ?? []), 'use', 'svg', 'path', 'circle', 'line', 'rect', 'polygon', 'polyline', 'ellipse', 'g', 'text', 'foreignObject'],
}

// ── Prose classes (copied verbatim from MarkdownRenderer.legacy.tsx) ──
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

const remarkPlugins = [remarkGfm, remarkMath]
const rehypePlugins = [rehypeRaw, [rehypeSanitize, sanitizeSchema], rehypeKatex]

/** Single markdown block rendered with react-markdown */
const MarkdownBlock = memo(function MarkdownBlock({
  content,
  remarkPlugins,
  rehypePlugins,
  components,
  isIncomplete,
}: {
  content: string
  remarkPlugins: any[]
  rehypePlugins: any[]
  components: any
  isIncomplete: boolean
}) {
  void isIncomplete // reserved for future cursor/loading indicator
  return (
    <ReactMarkdown
      remarkPlugins={remarkPlugins}
      rehypePlugins={rehypePlugins}
      components={components}
    >
      {content}
    </ReactMarkdown>
  )
})

export const StreamdownRenderer = memo(function StreamdownRenderer({ content, variant = 'default', className, streaming = false, onLinkClick }: Props) {
  // 1. Fix incomplete markdown in streaming mode
  const processedContent = useMemo(() => {
    if (!streaming) return content
    return parseIncompleteMarkdown(content)
  }, [content, streaming])

  // 2. Split into blocks for incremental rendering
  const blocks = useMemo(() => parseMarkdownIntoBlocks(processedContent), [processedContent])

  // 3. Use transition for non-blocking updates in streaming mode
  const [, startTransition] = useTransition()
  const [displayBlocks, setDisplayBlocks] = useState(blocks)

  useEffect(() => {
    if (streaming) {
      startTransition(() => { setDisplayBlocks(blocks) })
    } else {
      setDisplayBlocks(blocks)
    }
  }, [blocks, streaming])

  const effectiveBlocks = streaming ? displayBlocks : blocks

  // 4. Create component overrides (memoized)
  const components = useMemo(
    () => createStreamdownComponents(onLinkClick as Parameters<typeof createStreamdownComponents>[0]),
    [onLinkClick],
  )

  // 5. Prose classes
  const proseClasses = useMemo(() => getProseClasses(variant, streaming, className), [variant, streaming, className])

  return (
    <div className={proseClasses}>
      {effectiveBlocks.map((block, index) => (
        <MarkdownBlock
          key={`${index}-${block.slice(0, 40)}`}
          content={block}
          remarkPlugins={remarkPlugins}
          rehypePlugins={rehypePlugins}
          components={components}
          isIncomplete={streaming && index === effectiveBlocks.length - 1}
        />
      ))}
    </div>
  )
})

// ── Stub: exported for backward compatibility with MarkdownRenderer tests ──
// The new StreamdownRenderer no longer uses the legacy cache, but the test
// imports __markdownParseCacheInternals. This stub provides a dummy API so
// the test module resolves. Task 11 will update tests to remove cache dependency.
export const __markdownParseCacheInternals = {
  finalizedSize: () => 0,
  streamingSize: () => 0,
  finalizedChars: () => 0,
  hasFinalized: (_content: string) => false,
  hasStreaming: (_content: string) => false,
  reset: () => {},
}