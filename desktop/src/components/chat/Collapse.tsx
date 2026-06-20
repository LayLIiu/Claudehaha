import { useRef, useEffect, type ReactNode } from 'react'
import { useReducedMotion } from '../../hooks/useReducedMotion'

// Codex-aligned easing constants
export const CODEX_COLLAPSE_EASE = 'cubic-bezier(0.19, 1, 0.22, 1)' // easeOutExpo
export const CODEX_COLLAPSE_DURATION = 500

type CollapseProps = {
  /** Whether content is visible */
  open: boolean
  children: ReactNode
  /** Duration in ms (default 500, Codex-aligned) */
  duration?: number
  /** Easing curve (default Codex easeOutExpo) */
  easing?: string
  /** Optional class for the measured outer shell */
  className?: string
  /** Optional class for the inner content that receives the subtle y-motion */
  contentClassName?: string
  /** How far content slides upward while collapsing */
  collapsedOffset?: number
  testId?: string
}

/**
 * Lightweight collapse/expand animation — no external deps.
 * Uses imperative DOM manipulation instead of React state to avoid
 * race conditions on rapid clicks. Measures real content height and
 * animates via CSS transition, then switches to `height: auto` when
 * fully open so content can resize freely.
 */
export function Collapse({
  open,
  children,
  duration = CODEX_COLLAPSE_DURATION,
  easing = CODEX_COLLAPSE_EASE,
  className,
  contentClassName,
  collapsedOffset = 6,
  testId,
}: CollapseProps) {
  const ref = useRef<HTMLDivElement>(null)
  const isFirstRender = useRef(true)
  const prefersReducedMotion = useReducedMotion()

  useEffect(() => {
    // Skip animation on first render — just use the initial inline styles
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }

    const el = ref.current
    if (!el) return

    // When reduced motion is preferred, skip animation entirely
    if (prefersReducedMotion) {
      el.style.transition = 'none'
      if (open) {
        el.style.height = 'auto'
        el.style.opacity = '1'
        el.style.transform = 'translate3d(0, 0, 0)'
      } else {
        el.style.height = '0px'
        el.style.opacity = '0'
        el.style.transform = `translate3d(0, -${collapsedOffset}px, 0)`
      }
      return
    }

    // Clean up any lingering transitionend listener from a previous animation
    const controller = new AbortController()

    if (open) {
      // Opening: snap to 0, reflow, then animate to target height
      const targetHeight = el.scrollHeight
      if (targetHeight <= 0) return

      el.style.transition = 'none'
      el.style.height = '0px'
      el.style.opacity = '0'
      el.style.transform = `translate3d(0, -${collapsedOffset}px, 0)`
      // eslint-disable-next-line no-unused-expressions
      el.offsetHeight // force reflow so browser paints height:0 first

      el.style.transition = `height ${duration}ms ${easing}, opacity ${Math.round(duration * 0.55)}ms ease-out, transform ${duration}ms ${easing}`
      el.style.height = `${targetHeight}px`
      el.style.opacity = '1'
      el.style.transform = 'translate3d(0, 0, 0)'

      el.addEventListener('transitionend', () => {
        el.style.height = 'auto' // free-form sizing after animation
      }, { once: true, signal: controller.signal })
    } else {
      // Closing: snap to current measured height, reflow, then animate to 0
      const currentHeight = el.scrollHeight
      if (currentHeight <= 0) return

      el.style.transition = 'none'
      el.style.height = `${currentHeight}px`
      el.style.opacity = '1'
      el.style.transform = 'translate3d(0, 0, 0)'
      // eslint-disable-next-line no-unused-expressions
      el.offsetHeight // force reflow

      el.style.transition = `height ${duration}ms ${easing}, opacity ${Math.round(duration * 0.45)}ms ease-out, transform ${duration}ms ${easing}`
      el.style.height = '0px'
      el.style.opacity = '0'
      el.style.transform = `translate3d(0, -${collapsedOffset}px, 0)`
    }

    return () => controller.abort()
  }, [open, duration, easing, collapsedOffset, prefersReducedMotion])

  return (
    <div
      ref={ref}
      className={className}
      data-testid={testId}
      style={{
        overflow: 'hidden',
        height: open ? 'auto' : '0px',
        opacity: open ? 1 : 0,
        transform: open ? 'translate3d(0, 0, 0)' : `translate3d(0, -${collapsedOffset}px, 0)`,
        willChange: 'height, opacity, transform',
      }}
    >
      <div className={contentClassName}>
        {children}
      </div>
    </div>
  )
}
