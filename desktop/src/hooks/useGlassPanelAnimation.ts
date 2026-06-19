import { useCallback, useRef, useState } from 'react'

/**
 * useGlassPanelAnimation — manages enter/exit CSS animations for liquid-glass panels.
 *
 * Inspired by Codex's dropdown-9F1MU8ql.css animation system.
 * Returns `animatingOut` and `requestClose` so the parent can keep the DOM
 * mounted while the exit animation plays, then unmount after it finishes.
 *
 * Usage:
 *   const { animatingOut, requestClose } = useGlassPanelAnimation(onClose)
 *   // In JSX:
 *   <div className={`liquid-glass ${animatingOut ? 'glass-animate-exit' : 'glass-animate-enter'}`}>
 */
export function useGlassPanelAnimation(
  onClose: () => void,
  exitDuration = 100,
) {
  const [animatingOut, setAnimatingOut] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const requestClose = useCallback(() => {
    // Start exit animation
    setAnimatingOut(true)
    // After the exit animation finishes, actually close
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      setAnimatingOut(false)
      onClose()
    }, exitDuration)
  }, [onClose, exitDuration])

  return { animatingOut, requestClose }
}
