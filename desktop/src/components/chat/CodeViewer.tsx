import { useEffect, useRef, useState, type ComponentType, type CSSProperties } from 'react'
import { Check, Copy } from 'lucide-react'
import { Highlight, type PrismTheme } from 'prism-react-renderer'
import { CopyButton } from '../shared/CopyButton'

type Props = {
  code: string
  language?: string
  maxLines?: number
  showLineNumbers?: boolean
  wrapLongLines?: boolean
}

const warmPrismTheme: PrismTheme = {
  plain: {
    color: '#f2f2f2',
    backgroundColor: 'transparent',
  },
  styles: [
    { types: ['comment', 'prolog', 'doctype', 'cdata'], style: { color: '#a6a6a6', fontStyle: 'italic' as const } },
    { types: ['builtin'], style: { color: '#ff9f0a' } },
    { types: ['keyword', 'selector', 'important', 'atrule'], style: { color: '#ff9f0a' } },
    { types: ['string', 'attr-value', 'template-string'], style: { color: '#f2f2f2' } },
    { types: ['function', 'tag', 'number', 'boolean', 'operator', 'punctuation', 'variable', 'parameter', 'property', 'attr-name', 'class-name', 'constant', 'symbol'], style: { color: '#f2f2f2' } },
    { types: ['regex'], style: { color: '#f2f2f2' } },
    { types: ['inserted'], style: { color: '#30d158' } },
    { types: ['deleted'], style: { color: '#ff6961' } },
  ],
}

const warmShikiTheme = {
  name: 'warm-code',
  type: 'dark' as const,
  fg: '#f2f2f2',
  bg: 'transparent',
  tokenColors: [
    { scope: ['comment', 'punctuation.definition.comment'], settings: { foreground: '#a6a6a6', fontStyle: 'italic' } },
    { scope: ['support.function.builtin.shell', 'keyword', 'keyword.control', 'storage', 'storage.type', 'storage.modifier'], settings: { foreground: '#ff9f0a' } },
    { scope: ['string', 'string.quoted', 'string.template', 'string.other.link', 'string.regexp'], settings: { foreground: '#f2f2f2' } },
    { scope: ['keyword.operator', 'entity.name.function', 'support.function', 'entity.name.type', 'support.type', 'support.class', 'entity.name.class', 'entity.other.inherited-class', 'entity.name.type.parameter', 'variable', 'variable.other', 'variable.other.readwrite', 'variable.parameter', 'variable.other.property', 'support.type.property-name', 'meta.object-literal.key', 'variable.other.constant', 'variable.other.enummember', 'constant.numeric', 'constant.language', 'punctuation', 'meta.brace', 'meta.bracket', 'entity.name.tag', 'punctuation.definition.tag', 'entity.other.attribute-name', 'meta.decorator', 'punctuation.decorator'], settings: { foreground: '#f2f2f2' } },
    { scope: ['markup.inserted', 'punctuation.definition.inserted'], settings: { foreground: '#30d158' } },
    { scope: ['markup.deleted', 'punctuation.definition.deleted'], settings: { foreground: '#ff6961' } },
    { scope: ['markup.heading', 'entity.name.section'], settings: { foreground: '#f2f2f2', fontStyle: 'bold' } },
    { scope: ['markup.bold'], settings: { fontStyle: 'bold' } },
    { scope: ['markup.italic'], settings: { fontStyle: 'italic' } },
  ],
}

const CODE_AREA_PADDING = '0.55rem 1.05rem 1rem'
const CODE_LINE_HEIGHT = 1.48
const CODE_FONT_FAMILY = 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace'

type ShikiHighlighterProps = {
  language: string
  theme: typeof warmShikiTheme
  engine: unknown
  showLineNumbers: boolean
  showLanguage: boolean
  addDefaultStyles: boolean
  style: CSSProperties
  children: string
}

type ReactShikiModule = {
  ShikiHighlighter: ComponentType<any>
  createJavaScriptRegexEngine: (options: { forgiving: boolean }) => unknown
}

type ShikiRuntime = {
  Highlighter: ComponentType<ShikiHighlighterProps>
  engine: unknown
}

let shikiRuntimePromise: Promise<ShikiRuntime | null> | null = null

function canUseShikiRuntime(): boolean {
  if (import.meta.env.MODE === 'test') return false
  if (typeof window === 'undefined') return false

  try {
    new RegExp('(?<name>a)')
    new RegExp('(?<=a)b')
  } catch {
    return false
  }

  const ua = window.navigator.userAgent
  const chromiumLike = /\b(Chrome|Chromium|CriOS|Edg|OPR|Firefox)\b/.test(ua)
  const safariVersion = /\bVersion\/(\d+)(?:\.\d+)?\b.*\bSafari\//.exec(ua)
  if (!chromiumLike && safariVersion && Number(safariVersion[1]) <= 15) {
    return false
  }

  return true
}

function loadShikiRuntime(): Promise<ShikiRuntime | null> {
  if (!canUseShikiRuntime()) return Promise.resolve(null)
  shikiRuntimePromise ??= import('react-shiki')
    .then((mod) => {
      const shiki = mod as unknown as ReactShikiModule
      return {
        Highlighter: shiki.ShikiHighlighter as ComponentType<ShikiHighlighterProps>,
        engine: shiki.createJavaScriptRegexEngine({ forgiving: true }),
      }
    })
    .catch(() => null)
  return shikiRuntimePromise
}

function PrismCodeContent({
  code,
  language,
  showLineNumbers,
  wrapLongLines,
}: {
  code: string
  language?: string
  showLineNumbers: boolean
  wrapLongLines: boolean
}) {
  return (
    <Highlight
      theme={warmPrismTheme}
      code={code}
      language={language || 'text'}
    >
      {({ tokens, getLineProps, getTokenProps }) => (
        <pre
          data-code-viewer-content=""
          data-highlight-engine="prism"
          style={{
            margin: 0,
            padding: CODE_AREA_PADDING,
            fontFamily: CODE_FONT_FAMILY,
            fontSize: '16px',
            lineHeight: String(CODE_LINE_HEIGHT),
            whiteSpace: wrapLongLines ? 'pre-wrap' : 'pre',
            wordBreak: wrapLongLines ? 'break-word' : 'normal',
            color: '#f2f2f2',
          }}
        >
          {tokens.map((line, index) => (
            <span
              key={index}
              {...getLineProps({ line })}
              data-line-number={showLineNumbers ? index + 1 : undefined}
            >
              {showLineNumbers && (
                <span className="mr-3 inline-block min-w-[2.5ch] select-none text-right text-[var(--color-text-tertiary)]">
                  {index + 1}
                </span>
              )}
              {line.map((token, key) => (
                <span key={key} {...getTokenProps({ token })} />
              ))}
            </span>
          ))}
        </pre>
      )}
    </Highlight>
  )
}

function CodeArea({
  code,
  language,
  showLineNumbers,
  wrapLongLines,
}: {
  code: string
  language?: string
  showLineNumbers: boolean
  wrapLongLines: boolean
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [runtime, setRuntime] = useState<ShikiRuntime | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoaded(false)
    loadShikiRuntime().then((nextRuntime) => {
      if (!cancelled) setRuntime(nextRuntime)
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    setLoaded(false)
  }, [code, language])

  useEffect(() => {
    if (!runtime) return
    const el = containerRef.current
    if (!el) return
    const check = () => {
      const shikiContainer = el.querySelector('[data-testid="shiki-container"]')
      if (shikiContainer?.querySelector('code')) {
        setLoaded(true)
      }
    }
    check()
    const observer = new MutationObserver(check)
    observer.observe(el, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [runtime, code, language])

  const ShikiHighlighter = runtime?.Highlighter

  return (
    <div
      ref={containerRef}
      data-has-line-numbers={showLineNumbers ? 'true' : 'false'}
      className="code-viewer-area relative max-h-[420px] overflow-auto bg-transparent"
    >
      {(!ShikiHighlighter || !loaded) && (
        <PrismCodeContent
          code={code}
          language={language}
          showLineNumbers={showLineNumbers}
          wrapLongLines={wrapLongLines}
        />
      )}
      {ShikiHighlighter && (
        <div
          data-code-viewer-content=""
          data-highlight-engine="shiki"
          style={
            loaded
              ? { padding: CODE_AREA_PADDING }
              : {
                  position: 'absolute',
                  inset: 0,
                  opacity: 0,
                  pointerEvents: 'none',
                  padding: CODE_AREA_PADDING,
                }
          }
        >
          <ShikiHighlighter
            language={language || 'text'}
            theme={warmShikiTheme}
            engine={runtime.engine}
            showLineNumbers={showLineNumbers}
            showLanguage={false}
            addDefaultStyles={false}
            style={{
              margin: 0,
              fontFamily: CODE_FONT_FAMILY,
              fontSize: '16px',
              lineHeight: String(CODE_LINE_HEIGHT),
              whiteSpace: wrapLongLines ? 'pre-wrap' : 'pre',
              wordBreak: wrapLongLines ? 'break-word' : 'normal',
            }}
          >
            {code}
          </ShikiHighlighter>
        </div>
      )}
    </div>
  )
}

export function CodeViewer({ code, language, maxLines = 20, showLineNumbers = false, wrapLongLines = false }: Props) {
  const [expanded, setExpanded] = useState(false)

  const allLines = code.split('\n')
  const isTruncated = !expanded && allLines.length > maxLines
  const visibleCode = isTruncated ? allLines.slice(0, maxLines).join('\n') : code

  const effectiveShowLineNumbers = showLineNumbers && !!language && language !== 'text'
  const languageLabel = language || 'code'
  const showExpandToggle = allLines.length > maxLines

  return (
    <div className="code-viewer-shell overflow-hidden rounded-[15px] border border-white/[0.045] bg-[#2f2f2f] shadow-none">
      <div className="flex items-center justify-between px-4 pb-1.5 pt-3 text-[16px] leading-5 text-[#d6d6d6]">
        <span className="font-normal lowercase tracking-[-0.01em]">{languageLabel}</span>
        <CopyButton
          text={code}
          label="Copy code"
          copiedLabel="Copied code"
          displayLabel={<Copy size={18} strokeWidth={1.9} aria-hidden="true" />}
          displayCopiedLabel={<Check size={18} strokeWidth={2} aria-hidden="true" />}
          className="inline-flex h-7 w-7 items-center justify-center rounded-[8px] text-[#ababab] transition-colors  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20"
        />
      </div>

      <CodeArea
        code={visibleCode}
        language={language}
        showLineNumbers={effectiveShowLineNumbers}
        wrapLongLines={wrapLongLines}
      />

      {showExpandToggle && (
        <button
          onClick={() => setExpanded((value) => !value)}
          className="w-full border-t border-white/[0.07] bg-white/[0.025] py-2 text-[11px] font-medium text-[#b8b8b8] transition-colors "
        >
          {expanded ? 'Collapse' : `Show ${allLines.length - maxLines} more lines`}
        </button>
      )}
    </div>
  )
}
