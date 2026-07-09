import { createContext, useContext, useEffect, useState, useMemo, type ReactNode } from 'react'
import type { createJavaScriptRegexEngine } from 'react-shiki'

type ShikiEngine = ReturnType<typeof createJavaScriptRegexEngine>

/**
 * Shared highlighter state stored in context.
 * The highlighter is lazily loaded so all code blocks reuse a single instance.
 */
type ShikiContextValue = {
  engine: ShikiEngine | null
  themes: string[]
  loading: boolean
}

const ShikiContext = createContext<ShikiContextValue>({
  engine: null,
  themes: ['github-dark'],
  loading: true,
})

export function useShikiHighlighter() {
  return useContext(ShikiContext).engine
}

export function useShikiTheme() {
  return useContext(ShikiContext).themes
}

export function useShikiLoading() {
  return useContext(ShikiContext).loading
}

type ShikiProviderProps = {
  children: ReactNode
  themes?: string[]
}

export function ShikiProvider({ children, themes = ['github-dark'] }: ShikiProviderProps) {
  const [engine, setEngine] = useState<ShikiEngine | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    import('react-shiki').then((mod) => {
      if (cancelled) return
      // createJavaScriptRegexEngine uses JS regex for oniguruma-less highlighting
      const jsEngine = mod.createJavaScriptRegexEngine({ forgiving: true })
      setEngine(jsEngine)
      setLoading(false)
    }).catch(() => {
      if (!cancelled) setLoading(false)
    })
    return () => { cancelled = true }
  }, [])

  const value = useMemo(() => ({ engine, themes, loading }), [engine, themes, loading])

  return <ShikiContext.Provider value={value}>{children}</ShikiContext.Provider>
}