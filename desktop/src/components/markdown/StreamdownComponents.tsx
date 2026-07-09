import type { ReactNode, MouseEvent as ReactMouseEvent } from 'react'
import type { Components } from 'react-markdown'
import { ShikiCodeBlock } from './ShikiCodeBlock'
import { isIncompleteLink, IncompleteLinkButton } from './IncompleteLinkButton'

/**
 * Component overrides for react-markdown, matching ZCode Streamdown's Qy.
 * Each Markdown element is rendered as a React component instead of raw HTML.
 *
 * @param onLinkClick - Optional callback invoked when a link is clicked.
 *   Return `true` to prevent default navigation (handled).
 */
export function createStreamdownComponents(
  onLinkClick?: (href: string, event: ReactMouseEvent) => boolean | void,
): Components {
  return {
    // ── Code: distinguish inline code vs code blocks ──
    code({ className, children, ...props }) {
      const isBlock = 'data-block' in props || (className && /language-/.test(className))
      if (isBlock) {
        const language = className?.replace(/language-/, '').trim()
        const code = String(children).replace(/\n$/, '')
        return <ShikiCodeBlock code={code} language={language} />
      }
      // Inline code
      return (
        <code className={className} {...props}>
          {children}
        </code>
      )
    },

    // ── Pre: transparent pass-through for code blocks ──
    pre({ children }) {
      return <>{children}</>
    },

    // ── Links: handle clicks and detect incomplete links ──
    a({ href, children, ...props }) {
      if (href && isIncompleteLink(href)) {
        return <IncompleteLinkButton>{children}</IncompleteLinkButton>
      }
      return (
        <a
          href={href}
          target="_blank"
          rel="noreferrer noopener"
          onClick={(e) => {
            if (onLinkClick) {
              const handled = onLinkClick(href ?? '', e)
              if (handled) e.preventDefault()
            }
          }}
          {...props}
        >
          {children}
        </a>
      )
    },

    // ── Table: wrap in scrollable container ──
    table({ children }) {
      return (
        <div className="md-table-wrap my-5 overflow-x-auto rounded-[var(--radius-2xl)] border border-[var(--color-token-border)] bg-[var(--color-token-dropdown-background,var(--color-token-bg-subtle,rgba(255,255,255,0.04)))]">
          <table className="w-full table-auto text-[14px] border-separate border-spacing-0">
            {children}
          </table>
        </div>
      )
    },

    thead({ children }) {
      return <thead className="bg-muted/80">{children as ReactNode}</thead>
    },

    tbody({ children }) {
      return <tbody className="divide-y divide-border">{children}</tbody>
    },

    th({ children }) {
      return <th className="whitespace-nowrap px-4 py-2 text-left font-semibold text-sm">{children}</th>
    },

    td({ children }) {
      return <td className="px-4 py-2 text-sm">{children}</td>
    },

    // ── Blockquote ──
    blockquote({ children }) {
      return (
        <blockquote className="my-4 border-l-4 border-muted-foreground/30 pl-4 text-muted-foreground italic">
          {children}
        </blockquote>
      )
    },

    // ── Headings with data-streamdown attribute ──
    h1({ children }) {
      return <h1 data-streamdown="heading-1" className="mt-6 mb-2 font-semibold text-3xl">{children}</h1>
    },
    h2({ children }) {
      return <h2 data-streamdown="heading-2" className="mt-6 mb-2 font-semibold text-2xl">{children}</h2>
    },
    h3({ children }) {
      return <h3 data-streamdown="heading-3" className="mt-6 mb-2 font-semibold text-xl">{children}</h3>
    },
    h4({ children }) {
      return <h4 data-streamdown="heading-4" className="mt-6 mb-2 font-semibold text-lg">{children}</h4>
    },
    h5({ children }) {
      return <h5 data-streamdown="heading-5" className="mt-6 mb-2 font-semibold text-base">{children}</h5>
    },
    h6({ children }) {
      return <h6 data-streamdown="heading-6" className="mt-6 mb-2 font-semibold text-sm">{children}</h6>
    },

    // ── Lists ──
    ul({ children }) {
      return <ul className="list-inside list-disc whitespace-normal">{children}</ul>
    },
    ol({ children }) {
      return <ol className="list-inside list-decimal whitespace-normal">{children}</ol>
    },
    li({ children }) {
      return <li className="py-1 [&>p]:inline">{children}</li>
    },

    // ── Horizontal rule ──
    hr() {
      return <hr className="my-6 border-border" />
    },

    // ── Strong ──
    strong({ children }) {
      return <strong className="font-semibold">{children}</strong>
    },
  }
}