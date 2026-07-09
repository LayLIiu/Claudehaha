import { memo, useEffect, useState, Suspense } from 'react'
import { useShikiHighlighter, useShikiTheme } from './ShikiContext'
import { MermaidRenderer } from '../chat/MermaidRenderer'
import { CopyButton } from '../shared/CopyButton'

type Props = {
  code: string
  language?: string
  isIncomplete?: boolean
  streaming?: boolean
}

const PLAINTEXT_LANGUAGES = new Set(['', 'text', 'plaintext', 'plain'])
const MERMAID_DIAGRAM_START = /^(graph|flowchart|sequenceDiagram|classDiagram|stateDiagram|erDiagram|journey|gantt|pie|gitGraph|mindmap|timeline)\b/i

function isMermaid(language: string | undefined, code: string): boolean {
  if (language === 'mermaid') return true
  if (!PLAINTEXT_LANGUAGES.has(language ?? '')) return false
  const firstLine = code.split('\n').map(l => l.trim()).find(Boolean)
  return firstLine ? MERMAID_DIAGRAM_START.test(firstLine) : false
}

const CODE_PADDING = '0.55rem 1.05rem 1rem'
const CODE_FONT_FAMILY = 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace'

/** Fallback: plain text tokens without syntax highlighting */
function PlainTextBody({ code }: { code: string }) {
  const lines = code.split('\n')
  return (
    <pre
      data-streamdown="code-block-body"
      style={{
        margin: 0,
        padding: CODE_PADDING,
        fontFamily: CODE_FONT_FAMILY,
        fontSize: '14px',
        lineHeight: '1.48',
      }}
    >
      {lines.map((line, i) => (
        <span key={i} data-line-number={i + 1}>
          {line}
          {'\n'}
        </span>
      ))}
    </pre>
  )
}

/** Highlighted code body using Shiki */
function HighlightedBody({ code, language }: { code: string; language: string }) {
  const engine = useShikiHighlighter()
  const themes = useShikiTheme()
  const [html, setHtml] = useState<string | null>(null)

  useEffect(() => {
    if (!engine) return
    let cancelled = false

    // Use the engine to generate themed HTML via react-shiki
    // The highlighter is lazily loaded; codeToHtml will be implemented in Task 8
    const doHighlight = async () => {
      try {
        // For now render plain text; Task 8 will add actual Shiki codeToHtml
        if (!cancelled) setHtml(null)
      } catch {
        if (!cancelled) setHtml(null)
      }
    }
    doHighlight()
    return () => { cancelled = true }
  }, [code, language, themes, engine])

  if (!html) return <PlainTextBody code={code} />

  return (
    <pre
      data-streamdown="code-block-body"
      data-highlight-engine="shiki"
      style={{ margin: 0, padding: CODE_PADDING }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

export const ShikiCodeBlock = memo(function ShikiCodeBlock({ code, language, isIncomplete, streaming }: Props) {
  // Mermaid rendering
  if (isMermaid(language, code) && !streaming) {
    return <MermaidRenderer code={code} />
  }

  // Mermaid streaming placeholder
  if (isMermaid(language, code) && streaming) {
    return (
      <div className="my-4 flex items-center justify-center rounded-[var(--radius-lg)] border border-[var(--color-token-border-light)]/50 bg-[var(--color-token-bg-subtle,rgba(255,255,255,0.04))] py-8">
        <div className="flex items-center gap-2 text-[11px] text-[var(--color-token-text-secondary)]">
          <span className="material-symbols-outlined icon-sm animate-spin">progress_activity</span>
          Generating diagram...
        </div>
      </div>
    )
  }

  const languageLabel = language || 'code'

  return (
    <div
      data-streamdown="code-block"
      data-language={languageLabel}
      data-incomplete={isIncomplete || undefined}
      className="my-4 flex w-full flex-col gap-2 rounded-xl border border-[var(--color-token-border-light)] bg-[var(--color-token-text-code-block-background)] p-2"
      style={{ contentVisibility: 'auto', containIntrinsicSize: 'auto 200px' }}
    >
      {/* Header: language label + copy button */}
      <div className="flex items-center justify-between px-2 pb-1 pt-1">
        <span className="text-xs font-normal lowercase tracking-[-0.01em] text-[var(--color-token-foreground)]">
          {languageLabel}
        </span>
        <CopyButton
          text={code}
          label="Copy code"
          copiedLabel="Copied code"
          className="icon-md inline-flex items-center justify-center rounded-[var(--radius-xs)] text-[var(--color-token-input-placeholder-foreground)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-token-focus-border)]"
        />
      </div>

      {/* Code body: streaming uses plain text, static uses Shiki */}
      {streaming ? (
        <PlainTextBody code={code.replace(/\n$/, '')} />
      ) : (
        <Suspense fallback={<PlainTextBody code={code.replace(/\n$/, '')} />}>
          <HighlightedBody code={code.replace(/\n$/, '')} language={languageLabel} />
        </Suspense>
      )}
    </div>
  )
})