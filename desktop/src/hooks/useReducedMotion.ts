import { useEffect, useState } from 'react'

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'

function getInitialReducedMotion() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return window.matchMedia(REDUCED_MOTION_QUERY).matches
}

export function useReducedMotion() {
  const [prefersReduced, setPrefersReduced] = useState(getInitialReducedMotion)

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return

    const mediaQuery = window.matchMedia(REDUCED_MOTION_QUERY)
    const handleChange = (event: MediaQueryListEvent) => {
      setPrefersReduced(event.matches)
    }

    setPrefersReduced(mediaQuery.matches)
    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', handleChange)
    } else {
      mediaQuery.addListener(handleChange)
    }

    return () => {
      if (typeof mediaQuery.removeEventListener === 'function') {
        mediaQuery.removeEventListener('change', handleChange)
      } else {
        mediaQuery.removeListener(handleChange)
      }
    }
  }, [])

  return prefersReduced
}
