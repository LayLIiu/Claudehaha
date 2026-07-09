import type { ReactNode } from 'react'

/**
 * Check if a link href signals an incomplete (still-streaming) link.
 */
export function isIncompleteLink(href: string): boolean {
  return href === 'streamdown:incomplete-link'
}

type Props = {
  children: ReactNode
}

/**
 * Renders an incomplete link as a disabled button.
 * Used during streaming when the link target has not yet been resolved.
 */
export function IncompleteLinkButton({ children }: Props) {
  return (
    <button
      className="text-[var(--color-text-accent)] cursor-default opacity-60"
      disabled
      aria-label="Incomplete link"
    >
      {children}
    </button>
  )
}