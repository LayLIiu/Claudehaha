import { useEffect, useRef, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { useChatStore } from '../../stores/chatStore'
import { useTabStore } from '../../stores/tabStore'
import { useTranslation, type TranslationKey } from '../../i18n'
import { formatTokenCount } from '../../lib/formatTokenCount'

function formatElapsed(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}m ${s}s`
}

function translateServerVerb(
  t: (key: TranslationKey) => string,
  verb: string,
): string {
  const key = `serverVerb.${verb}` as TranslationKey
  const translated = t(key)
  return translated === key ? verb : translated
}

function formatRetrySeconds(ms: number): number {
  return Math.max(0, Math.ceil(ms / 1000))
}

function formatErrorType(errorType: string | undefined): string | null {
  if (!errorType) return null
  return errorType
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Cadenced shimmer — stepped sweep highlight every 4s, mirrors Codex ThinkingShimmer.
 *  A bright band sweeps left→right across dim text on a 4s cadence
 *  (600ms initial delay → 1s step animation → ~3s pause).
 *  Falls back to the old ShimmerText when `active` is explicitly false
 *  (e.g. for static placeholders that should shimmer continuously). */
export function CadencedShimmerText({
  children,
  active = true,
  className,
}: {
  children: React.ReactNode
  /** When true (default), use cadenced sweep. When false, fall back to continuous shimmer. */
  active?: boolean
  className?: string
}) {
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!active) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const el = ref.current
    if (!el) return

    const SWEEP_DURATION_MS = 1000
    const CADENCE_INTERVAL_MS = 4000
    const INITIAL_DELAY_MS = 600

    let timeout: ReturnType<typeof setTimeout> | undefined
    let interval: ReturnType<typeof setInterval> | undefined

    const triggerSweep = () => {
      if (timeout != null) {
        clearTimeout(timeout)
        timeout = undefined
      }
      el.classList.add('cadenced-shimmer-active')
      timeout = setTimeout(() => {
        el.classList.remove('cadenced-shimmer-active')
        timeout = undefined
      }, SWEEP_DURATION_MS)
    }

    const initialDelay = setTimeout(() => {
      triggerSweep()
      interval = setInterval(triggerSweep, CADENCE_INTERVAL_MS)
    }, INITIAL_DELAY_MS)

    return () => {
      clearTimeout(initialDelay)
      if (timeout != null) clearTimeout(timeout)
      if (interval != null) clearInterval(interval)
      el.classList.remove('cadenced-shimmer-active')
    }
  }, [active])

  // Fallback: continuous shimmer for non-cadenced use
  if (!active) {
    return <span className={`shimmer-sweep-text ${className ?? ''}`}>{children}</span>
  }

  return (
    <span ref={ref} className={`cadenced-shimmer ${className ?? ''}`}>
      {children}
    </span>
  )
}

export function StreamingIndicator() {
  const t = useTranslation()
  const [now, setNow] = useState(() => Date.now())
  const activeTabId = useTabStore((s) => s.activeTabId)
  const sessionState = useChatStore((s) => activeTabId ? s.sessions[activeTabId] : undefined)
  const chatState = sessionState?.chatState ?? 'idle'
  const statusVerb = sessionState?.statusVerb ?? ''
  const apiRetry = sessionState?.apiRetry ?? null
  const streamingFallback = sessionState?.streamingFallback ?? null
  const elapsedSeconds = sessionState?.elapsedSeconds ?? 0
  // chars ÷ 4 estimates output tokens for this turn, mirroring the CLI spinner.
  const streamingTokens = Math.round((sessionState?.streamingResponseChars ?? 0) / 4)

  useEffect(() => {
    if (!apiRetry) return undefined
    setNow(Date.now())
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [apiRetry?.receivedAt, apiRetry?.retryDelayMs])

  if (apiRetry) {
    const remainingMs = Math.max(0, apiRetry.retryDelayMs - (now - apiRetry.receivedAt))
    const statusText = apiRetry.errorStatus !== null
      ? t('chat.retry.httpStatus', { status: apiRetry.errorStatus })
      : formatErrorType(apiRetry.errorType) ?? t('chat.retry.networkError')
    const detailText = apiRetry.errorMessage?.trim()

    return (
      <div
        data-testid="api-retry-indicator"
        role="status"
        aria-live="polite"
        className="mb-2 flex w-full max-w-[min(720px,100%)] flex-wrap items-center gap-2 rounded-md border border-amber-500/35 bg-amber-50/80 px-3 py-2 text-xs text-amber-950 shadow-sm dark:border-amber-400/25 dark:bg-amber-950/30 dark:text-amber-100"
      >
        <RefreshCw size={14} strokeWidth={2.2} className="shrink-0 animate-spin text-amber-700 dark:text-amber-300" aria-hidden="true" />
        <span className="font-medium">{t('chat.retry.title')}</span>
        <span className="rounded-[var(--radius-2xs)] border border-amber-700/20 bg-white/70 px-1.5 py-0.5 font-mono text-[11px] leading-none text-amber-900 dark:border-amber-300/20 dark:bg-black/15 dark:text-amber-100">
          {t('chat.retry.attempt', { attempt: apiRetry.attempt, max: apiRetry.maxRetries })}
        </span>
        <span className="rounded-[var(--radius-2xs)] border border-amber-700/20 bg-white/70 px-1.5 py-0.5 font-mono text-[11px] leading-none text-amber-900 dark:border-amber-300/20 dark:bg-black/15 dark:text-amber-100">
          {statusText}
        </span>
        <span className="text-amber-800 dark:text-amber-200">
          {remainingMs > 0
            ? t('chat.retry.waiting', { seconds: formatRetrySeconds(remainingMs) })
            : t('chat.retry.retrying')}
        </span>
        {detailText && (
          <span className="min-w-0 max-w-full truncate text-amber-700 dark:text-amber-200" title={detailText}>
            {detailText}
          </span>
        )}
      </div>
    )
  }

  if (streamingFallback) {
    return (
      <div
        data-testid="streaming-fallback-indicator"
        role="status"
        aria-live="polite"
        className="mb-2 flex w-fit items-center gap-2 rounded-full border border-[var(--color-token-border)]/40 bg-[var(--color-surface-container-low)] px-3 py-1"
      >
        <RefreshCw size={12} strokeWidth={2.2} className="shrink-0 animate-spin text-[var(--color-token-text-secondary)]" aria-hidden="true" />
        <span className="text-xs font-medium text-[var(--color-token-text-secondary)]">
          {t('chat.fallback.title')}
        </span>
        <span className="text-[10px] text-[var(--color-token-text-secondary)]">
          {t('chat.fallback.detail')}
        </span>
        {elapsedSeconds > 0 && (
          <span className="text-[10px] text-[var(--color-token-text-secondary)]">
            {formatElapsed(elapsedSeconds)}
          </span>
        )}
      </div>
    )
  }

  let verb: string
  if (statusVerb) {
    verb = translateServerVerb(t, statusVerb)
  } else {
    verb = chatState === 'thinking'
      ? t('serverVerb.Thinking')
      : chatState === 'compacting'
        ? t('serverVerb.Compacting conversation')
        : chatState === 'tool_executing'
          ? t('serverVerb.Running')
          : t('serverVerb.Working')
  }

  return (
    <div className="mb-2 flex w-fit items-center gap-2 rounded-full border border-[var(--color-token-border)]/40 bg-[var(--color-surface-container-low)] px-3 py-1">
      <span className="text-[var(--color-brand)] animate-shimmer text-sm">✦</span>
      <CadencedShimmerText>
        <span className="text-xs font-medium text-[var(--color-token-text-secondary)]">{verb}...</span>
      </CadencedShimmerText>
      {elapsedSeconds > 0 && (
        <span className="text-[10px] text-[var(--color-token-text-secondary)]">
          {formatElapsed(elapsedSeconds)}
        </span>
      )}
      {streamingTokens > 0 && (
        <span className="text-[10px] text-[var(--color-token-text-secondary)]">
          · ↓ {t('common.tokens', { count: formatTokenCount(streamingTokens) })}
        </span>
      )}
    </div>
  )
}

/**
 * StickyThinkingIndicator — sits above the chat input, aligned to the
 * assistant message content area. Shows thinking verb with shimmer sweep.
 * Mirrors iOS's StickyPendingAssistantIndicatorRow + ShimmerText.
 */
export function StickyThinkingIndicator({ visible, compact }: { visible: boolean; compact?: boolean }) {
  const t = useTranslation()
  const activeTabId = useTabStore((s) => s.activeTabId)
  const sessionState = useChatStore((s) => activeTabId ? s.sessions[activeTabId] : undefined)
  const chatState = sessionState?.chatState ?? 'idle'
  const statusVerb = sessionState?.statusVerb ?? ''
  const elapsedSeconds = sessionState?.elapsedSeconds ?? 0

  if (!visible) return null

  let verb: string
  if (statusVerb) {
    verb = translateServerVerb(t, statusVerb)
  } else {
    verb = chatState === 'thinking'
      ? t('serverVerb.Thinking')
      : chatState === 'compacting'
        ? t('serverVerb.Compacting conversation')
        : chatState === 'tool_executing'
          ? t('serverVerb.Running')
          : t('serverVerb.Working')
  }

  return (
    <div className={`sticky-thinking-indicator ${visible ? 'sticky-thinking-indicator--visible' : 'sticky-thinking-indicator--hidden'}`}>
      <div className={compact ? 'mx-auto max-w-full' : 'mx-auto max-w-[800px]'}>
        <div className="flex items-center gap-2.5 px-3.5 py-2">
          <span className="text-[var(--color-brand)] animate-shimmer text-sm">✦</span>
          <CadencedShimmerText>
            <span className="text-[14px] font-medium text-[var(--color-token-text-secondary)]">{verb}...</span>
          </CadencedShimmerText>
          {elapsedSeconds > 0 && (
            <span className="text-[12px] text-[var(--color-token-text-secondary)] font-mono tabular-nums">
              {formatElapsed(elapsedSeconds)}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
