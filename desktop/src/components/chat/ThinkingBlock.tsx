import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useTranslation } from '../../i18n'
import { MarkdownRenderer } from '../markdown/MarkdownRenderer'
import { CadencedShimmerText } from './StreamingIndicator'
import { Collapse } from './Collapse'

// ── Thinking Disclosure Parser ──
// Detects **bold title** lines in thinking text and splits into collapsible sections.

type ThinkingDisclosureSection = {
  id: string
  title: string
  detail: string
}

type ThinkingDisclosureContent = {
  /** Leading text before any section header */
  preamble: string
  sections: ThinkingDisclosureSection[]
}

function parseThinkingDisclosure(rawText: string): ThinkingDisclosureContent | null {
  const lines = rawText.split('\n')
  const sections: ThinkingDisclosureSection[] = []
  let preamble = ''
  let currentTitle: string | null = null
  let currentDetail: string[] = []
  let sectionIndex = 0
  let foundSection = false

  // Detect lines starting with **bold** as section headers
  const boldHeaderRegex = /^\*\*(.+?)\*\*\s*:?\s*$/

  const flushSection = () => {
    if (currentTitle !== null) {
      sections.push({
        id: `section-${sectionIndex++}`,
        title: currentTitle,
        detail: currentDetail.join('\n').trim(),
      })
    }
    currentTitle = null
    currentDetail = []
  }

  for (const line of lines) {
    const match = line.match(boldHeaderRegex)
    if (match) {
      if (!foundSection) {
        // First section found — everything before was preamble
        foundSection = true
      } else {
        flushSection()
      }
      currentTitle = match[1]!.trim()
    } else if (currentTitle !== null) {
      currentDetail.push(line)
    } else if (!foundSection) {
      preamble += (preamble ? '\n' : '') + line
    }
  }
  flushSection()

  if (sections.length === 0) return null
  return { preamble: preamble.trim(), sections }
}

export function ThinkingBlock({ content, isActive = false }: { content: string; isActive?: boolean }) {
  const t = useTranslation()
  const [expanded, setExpanded] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)
  const displayContent = useMemo(() => content.replace(/\r\n?/g, '\n').trimEnd(), [content])
  const hasDisplayContent = displayContent.trim().length > 0
  const [expandedSectionIds, setExpandedSectionIds] = useState<Set<string>>(new Set())

  // Reset disclosure state when content changes identity
  useEffect(() => {
    setExpandedSectionIds(new Set())
  }, [content])

  // Try to parse disclosure sections from thinking content
  const disclosure = useMemo(() => {
    if (isActive || !hasDisplayContent) return null
    return parseThinkingDisclosure(displayContent)
  }, [displayContent, hasDisplayContent, isActive])

  const toggleSection = useCallback((sectionId: string) => {
    setExpandedSectionIds(prev => {
      const next = new Set(prev)
      if (next.has(sectionId)) next.delete(sectionId)
      else next.add(sectionId)
      return next
    })
  }, [])

  useEffect(() => {
    if (expanded && isActive && contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight
    }
  }, [displayContent, expanded, isActive])

  // When actively thinking, show the normal (non-disclosure) view
  if (isActive || !disclosure) {
    return (
      <div className="mb-1">
        <style>{thinkingStyles}</style>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="flex w-full items-center gap-1.5 rounded-md px-1 py-0.5 text-left text-[var(--text-size-chat)] text-[var(--color-token-description-foreground)] transition-colors hover:text-[var(--color-token-foreground)]"
        >
          <span className="icon-2xs text-[var(--color-token-input-placeholder-foreground)] transition-transform duration-300">
            {expanded ? '\u25BE' : '\u25B8'}
          </span>
          <span className="shrink-0 font-medium italic">
            <CadencedShimmerText>
              {isActive ? t('thinking.label') : t('thinking.labelDone')}
            </CadencedShimmerText>
            {isActive && <span className="thinking-dots" />}
          </span>
        </button>
        {hasDisplayContent && (
          <Collapse open={expanded}>
            <div
              ref={contentRef}
              data-thinking-content="expanded"
              className="relative mt-1 max-h-[300px] overflow-y-auto rounded-[var(--radius-lg)] border border-[var(--color-token-border-light)] bg-[var(--color-token-editor-background)] p-2.5 text-[11px] text-[var(--color-token-description-foreground)]/80 [&_*]:text-[var(--color-token-non-assistant-body-descendant)]"
            >
              <MarkdownRenderer
                content={displayContent}
                variant="compact"
                cache={!isActive}
                streaming={isActive}
                className="thinking-markdown text-[var(--color-token-non-assistant-body-descendant)]"
              />
              {isActive && <span className="thinking-cursor" />}
            </div>
          </Collapse>
        )}
      </div>
    )
  }

  // ── Disclosure view: collapsible sections with bold titles ──
  return (
    <div className="mb-1">
      <style>{thinkingStyles}</style>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="flex w-full items-center gap-1.5 rounded-md px-1 py-0.5 text-left text-[12px] text-[var(--color-token-text-secondary)] transition-colors hover:text-[var(--color-token-text-secondary)]"
      >
        <span className="text-[10px] text-[var(--color-outline)]">
          {expanded ? '\u25BE' : '\u25B8'}
        </span>
        <span className="shrink-0 font-medium italic">
          {t('thinking.labelDone')}
        </span>
      </button>
      {expanded && (
        <div className="mt-1 rounded-[var(--radius-lg)] border border-[var(--color-token-border-light)] bg-[var(--color-token-editor-background)] p-2.5">
          {/* Preamble text before any section */}
          {disclosure.preamble && (
            <div className="mb-2 text-[11px] text-[var(--color-token-description-foreground)]/80">
              <MarkdownRenderer
                content={disclosure.preamble}
                variant="compact"
                cache
                className="thinking-markdown text-[var(--color-token-non-assistant-body-descendant)]"
              />
            </div>
          )}
          {/* Disclosure sections */}
          {disclosure.sections.map((section) => {
            const isSectionExpanded = expandedSectionIds.has(section.id)
            const hasDetail = section.detail.length > 0
            return (
              <div key={section.id} className="mb-1 last:mb-0">
                <button
                  type="button"
                  onClick={hasDetail ? () => toggleSection(section.id) : undefined}
                  className={`flex items-center gap-2 w-full text-left text-[11px] ${
                    hasDetail
                      ? 'text-[var(--color-token-description-foreground)] hover:text-[var(--color-token-foreground)] cursor-pointer'
                      : 'text-[var(--color-token-description-foreground)] cursor-default'
                  } transition-colors`}
                >
                  <span
                    className="turn-chevron icon-2xs text-[var(--color-token-input-placeholder-foreground)]"
                    data-rotated={isSectionExpanded ? 'true' : 'false'}
                  >
                    {'▸'}
                  </span>
                  <span className="font-semibold text-[var(--color-token-foreground)]">{section.title}</span>
                </button>
                {hasDetail && (
                  <Collapse open={isSectionExpanded} duration={300} easing="cubic-bezier(0.34, 1.56, 0.64, 1)">
                    <div className="pl-5 pt-1 text-[11px] text-[var(--color-token-description-foreground)]/80">
                      <MarkdownRenderer
                        content={section.detail}
                        variant="compact"
                        cache
                        className="thinking-markdown text-[var(--color-token-non-assistant-body-descendant)]"
                      />
                    </div>
                  </Collapse>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

const thinkingStyles = `
@keyframes thinking-cursor-blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}
@keyframes thinking-dots {
  0%, 20% { content: ''; }
  40% { content: '.'; }
  60% { content: '..'; }
  80%, 100% { content: '...'; }
}
.thinking-cursor {
  display: inline-block;
  width: 2px;
  height: 1em;
  background: var(--color-token-text-secondary);
  vertical-align: middle;
  margin-left: 1px;
  animation: thinking-cursor-blink 1s step-end infinite;
}
.thinking-dots::after {
  content: '';
  animation: thinking-dots 1.4s steps(1, end) infinite;
}
.thinking-markdown > :first-child,
.thinking-markdown > :first-child > :first-child {
  margin-top: 0;
}
.thinking-markdown > :last-child,
.thinking-markdown > :last-child > :last-child {
  margin-bottom: 0;
}
`
