import { useRef, useEffect, type ReactNode } from 'react'

type CollapseProps = {
  /** Whether content is visible */
  open: boolean
  children: ReactNode
  /** Duration in ms (default 360) */
  duration?: number
  /** Easing curve (default Codex-style spring) */
  easing?: string
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
  duration = 360,
  easing = 'cubic-bezier(0.2, 1.12, 0.24, 1)',
}: CollapseProps) {
  const ref = useRef<HTMLDivElement>(null)
  const isFirstRender = useRef(true)

  useEffect(() => {
    // Skip animation on first render — just use the initial inline styles
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }

    const el = ref.current
    if (!el) return

    // Clean up any lingering transitionend listener from a previous animation
    const controller = new AbortController()

    if (open) {
      // Opening: snap to 0, reflow, then animate to target height
      const targetHeight = el.scrollHeight
      if (targetHeight <= 0) return

      el.style.transition = 'none'
      el.style.height = '0px'
      el.style.opacity = '0'
      // eslint-disable-next-line no-unused-expressions
      el.offsetHeight // force reflow so browser paints height:0 first

      el.style.transition = `height ${duration}ms ${easing}, opacity ${Math.round(duration * 0.6)}ms ease-out`
      el.style.height = `${targetHeight}px`
      el.style.opacity = '1'

      el.addEventListener('transitionend', () => {
        el.style.height = 'auto' // free-form sizing after animation
      }, { once: true, signal: controller.signal })
    } else {
      // Closing: snap to current measured height, reflow, then animate to 0
      const currentHeight = el.scrollHeight
      if (currentHeight <= 0) return

      el.style.transition = 'none'
      el.style.height = `${currentHeight}px`
      // eslint-disable-next-line no-unused-expressions
      el.offsetHeight // force reflow

      el.style.transition = `height ${duration}ms ${easing}, opacity ${Math.round(duration * 0.6)}ms ease-out`
      el.style.height = '0px'
      el.style.opacity = '0'
    }

    return () => controller.abort()
  }, [open, duration, easing])

  return (
    <div
      ref={ref}
      style={{
        overflow: 'hidden',
        height: open ? 'auto' : '0px',
        opacity: open ? 1 : 0,
      }}
    >
      {children}
    </div>
  )
}
