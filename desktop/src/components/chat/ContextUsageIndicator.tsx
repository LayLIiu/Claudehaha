import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { sessionsApi, type SessionContextSnapshot } from '../../api/sessions'
import { useTranslation } from '../../i18n'
import type { ChatState } from '../../types/chat'
import { MobileBottomSheet } from '../shared/MobileBottomSheet'

type Props = {
  sessionId?: string
  chatState: ChatState
  messageCount: number
  runtimeSelectionKey?: string
  fallbackModelLabel?: string
  draft?: boolean
  compact?: boolean
  /**
   * Bump to force an immediate refresh that bypasses the auto-refresh
   * throttle and any in-flight (possibly pre-compact) request. Used after
   * context compaction so the meter recovers right away (#743).
   */
  refreshNonce?: number
}

const ACTIVE_REFRESH_MS = 30_000
const CONTEXT_REQUEST_TIMEOUT_MS = 20_000
const AUTO_REFRESH_MIN_INTERVAL_MS = 10_000
// After a compaction the CLI may still be busy finishing the turn.  Wait a
// short beat before the first forced request so the server has time to update
// its internal context accounting, then retry up to three more times with
// increasing back-off if the response still looks stale (#743).
const FORCED_REFRESH_INITIAL_DELAY_MS = 2_000
const FORCED_REFRESH_RETRY_DELAYS_MS = [3_000, 6_000, 10_000]
// Once a compact session goes idle the 30 s polling interval stops.  If the
// forced refreshes above all resolved with stale data (or all failed) the
// pre-compact percentage would remain on screen forever.  Schedule a one-shot
// safety-net refresh a little later as a last resort.
const IDLE_SAFETY_NET_DELAY_MS = 15_000

function formatNumber(value: number | undefined) {
  return new Intl.NumberFormat().format(value ?? 0)
}

function formatPercent(value: number | undefined) {
  const percent = Math.max(0, Math.min(100, value ?? 0))
  return `${percent.toFixed(percent >= 10 || Number.isInteger(percent) ? 0 : 1)}%`
}

function formatUpdatedAt(timestamp: number | null, t: ReturnType<typeof useTranslation>) {
  if (!timestamp) return t('contextIndicator.updatedUnknown')
  const elapsedMs = Date.now() - timestamp
  if (elapsedMs < 60_000) return t('contextIndicator.updatedNow')
  const minutes = Math.max(1, Math.floor(elapsedMs / 60_000))
  return t('contextIndicator.updatedMinutes', { count: minutes })
}

function pickUsedContextCategory(context: SessionContextSnapshot) {
  const ignored = new Set(['free space', 'autocompact buffer'])
  return context.categories
    .filter((category) => category.tokens > 0 && !category.isDeferred && !ignored.has(category.name.toLowerCase()))
    .sort((a, b) => b.tokens - a.tokens)
    .slice(0, 4)
}

function firstNonEmpty(...values: Array<string | undefined | null>) {
  return values.find((value) => typeof value === 'string' && value.trim().length > 0)?.trim()
}

function isCliNotRunningError(error: string | null) {
  return error?.toLowerCase().includes('cli session is not running') ?? false
}

function isDocumentVisible() {
  return typeof document === 'undefined' || document.visibilityState !== 'hidden'
}

function shouldFetchContext(sessionId: string | undefined, draft: boolean) {
  return Boolean(sessionId) && !draft
}

export function ContextUsageIndicator({
  sessionId,
  chatState,
  messageCount,
  runtimeSelectionKey = '',
  fallbackModelLabel,
  draft = false,
  compact = false,
  refreshNonce = 0,
}: Props) {
  const t = useTranslation()
  const [context, setContext] = useState<SessionContextSnapshot | null>(null)
  const [contextSource, setContextSource] = useState<'live' | 'estimate' | null>(null)
  const [loading, setLoading] = useState(() => shouldFetchContext(sessionId, draft))
  const [error, setError] = useState<string | null>(null)
  const [updatedAt, setUpdatedAt] = useState<number | null>(null)
  const [inspectionModel, setInspectionModel] = useState<string | null>(null)
  const [mobileDetailsOpen, setMobileDetailsOpen] = useState(false)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const detailsRef = useRef<HTMLDivElement>(null)
  const requestSeq = useRef(0)
  const contextIdentityRef = useRef('')
  const inFlightRequestRef = useRef<Promise<SessionContextSnapshot | null> | null>(null)
  const inFlightIdentityRef = useRef<string | null>(null)
  const lastAutoRefreshAtRef = useRef(0)

  const refresh = useCallback(async (mode: 'auto' | 'manual' | 'force' = 'manual'): Promise<SessionContextSnapshot | null> => {
    if (!sessionId || draft) {
      setLoading(false)
      return null
    }
    if (mode === 'auto' && !isDocumentVisible()) {
      setLoading(false)
      return null
    }
    if (mode === 'auto' && Date.now() - lastAutoRefreshAtRef.current < AUTO_REFRESH_MIN_INTERVAL_MS) {
      return inFlightRequestRef.current ?? null
    }
    if (typeof sessionsApi.getInspection !== 'function') {
      setLoading(false)
      return null
    }
    const activeSessionId = sessionId
    const activeContextIdentity = `${activeSessionId}:${runtimeSelectionKey}`
    // 'force' must not reuse an in-flight request: one started just before a
    // compact boundary would resolve with the pre-compact context.
    if (mode !== 'force' && inFlightRequestRef.current && inFlightIdentityRef.current === activeContextIdentity) {
      return inFlightRequestRef.current
    }
    const seq = requestSeq.current + 1
    requestSeq.current = seq
    if (mode === 'auto') lastAutoRefreshAtRef.current = Date.now()
    setLoading(true)
    setError(null)
    const request = sessionsApi.getInspection(activeSessionId, {
      includeContext: true,
      contextOnly: true,
      timeout: CONTEXT_REQUEST_TIMEOUT_MS,
    })
      .then((inspection) => {
        if (seq !== requestSeq.current || activeContextIdentity !== contextIdentityRef.current) return null
        const nextContext = inspection.context ?? inspection.contextEstimate ?? null
        const nextSource = inspection.context ? 'live' : inspection.contextEstimate ? 'estimate' : null
        const usageModel = inspection.usage?.models.find((model) => firstNonEmpty(model.displayName, model.model)) ?? null
        setContext(nextContext)
        setContextSource(nextSource)
        setInspectionModel(firstNonEmpty(
          inspection.context?.model,
          inspection.contextEstimate?.model,
          inspection.status?.model,
          usageModel?.displayName,
          usageModel?.model,
        ) ?? null)
        setError(nextContext ? null : inspection.errors?.context ?? null)
        setUpdatedAt(Date.now())
        return nextContext
      })
      .catch((err) => {
        if (seq !== requestSeq.current || activeContextIdentity !== contextIdentityRef.current) return null
        setError(err instanceof Error ? err.message : String(err))
        return null
      })
      .finally(() => {
        if (inFlightRequestRef.current === request) {
          inFlightRequestRef.current = null
          inFlightIdentityRef.current = null
        }
        if (seq === requestSeq.current) setLoading(false)
      })
    inFlightRequestRef.current = request
    inFlightIdentityRef.current = activeContextIdentity
    return request
  }, [draft, runtimeSelectionKey, sessionId])

  // After a compaction the context shrinks server-side but nothing else
  // re-reads it promptly (auto refreshes are throttled and stop once the
  // session goes idle), leaving the pre-compact percentage on screen (#743).
  // Force a fresh request after a short delay (so the CLI has time to finish
  // its internal accounting), then retry with increasing back-off if the
  // response still contains pre-compact token counts.
  const lastRefreshNonceRef = useRef(refreshNonce)
  const preCompactTokensRef = useRef<number | null>(null)
  useEffect(() => {
    if (refreshNonce === lastRefreshNonceRef.current) return
    lastRefreshNonceRef.current = refreshNonce
    // Snapshot the current token count so we can detect stale responses.
    preCompactTokensRef.current = context?.totalTokens ?? null
    let cancelled = false
    const timers: Array<ReturnType<typeof setTimeout>> = []

    const attemptForceRefresh = (attempt: number) => {
      if (cancelled) return
      void refresh('force').then((snapshot) => {
        if (cancelled) return
        // If we got a valid snapshot, check whether the token count actually
        // dropped — if not, the CLI likely hasn't finished compacting yet and
        // we should retry.
        if (snapshot) {
          const preTokens = preCompactTokensRef.current
          if (preTokens !== null && snapshot.totalTokens >= preTokens) {
            // Stale — treat as failure and retry.
          } else {
            return // Success — token count dropped (or no baseline to compare)
          }
        }
        const retryDelay = attempt < FORCED_REFRESH_RETRY_DELAYS_MS.length
          ? FORCED_REFRESH_RETRY_DELAYS_MS[attempt]
          : FORCED_REFRESH_RETRY_DELAYS_MS[FORCED_REFRESH_RETRY_DELAYS_MS.length - 1]
        const timer = setTimeout(() => attemptForceRefresh(attempt + 1), retryDelay)
        timers.push(timer)
      })
    }

    // Small initial delay so the CLI can finish its compact bookkeeping
    // before we query it.
    const initialTimer = setTimeout(() => attemptForceRefresh(0), FORCED_REFRESH_INITIAL_DELAY_MS)
    timers.push(initialTimer)

    return () => {
      cancelled = true
      for (const timer of timers) clearTimeout(timer)
    }
  }, [context?.totalTokens, refresh, refreshNonce])

  useEffect(() => {
    const contextIdentity = `${sessionId}:${runtimeSelectionKey}`
    const identityChanged = contextIdentityRef.current !== contextIdentity
    contextIdentityRef.current = contextIdentity
    if (identityChanged) {
      requestSeq.current += 1
      lastAutoRefreshAtRef.current = 0
      setContext(null)
      setContextSource(null)
      setError(null)
      setUpdatedAt(null)
      setInspectionModel(null)
    }
    void refresh('auto')
  }, [messageCount, refresh, runtimeSelectionKey, sessionId])

  useEffect(() => {
    if (typeof document === 'undefined') return
    const refreshIfVisible = () => {
      if (!isDocumentVisible()) return
      void refresh('auto')
    }
    document.addEventListener('visibilitychange', refreshIfVisible)
    return () => document.removeEventListener('visibilitychange', refreshIfVisible)
  }, [refresh])

  useEffect(() => {
    if (chatState === 'idle') return
    const timer = setInterval(() => {
      void refresh('auto')
    }, ACTIVE_REFRESH_MS)
    return () => clearInterval(timer)
  }, [chatState, messageCount, refresh])

  // Safety-net: after a compaction the session eventually goes idle which
  // stops the 30 s polling above.  If the forced refreshes all returned stale
  // data (or all failed), the pre-compact percentage stays on screen forever.
  // Schedule a one-shot delayed refresh when we transition to idle right after
  // a compaction.
  const lastCompactToIdleRef = useRef(false)
  useEffect(() => {
    const justCompacted = refreshNonce > 0 && lastRefreshNonceRef.current === refreshNonce
    if (chatState === 'idle' && justCompacted && !lastCompactToIdleRef.current) {
      lastCompactToIdleRef.current = true
      let cancelled = false
      const timer = setTimeout(() => {
        if (!cancelled) void refresh('force')
      }, IDLE_SAFETY_NET_DELAY_MS)
      return () => {
        cancelled = true
        clearTimeout(timer)
      }
    }
    if (chatState !== 'idle') {
      lastCompactToIdleRef.current = false
    }
  }, [chatState, refresh, refreshNonce])

  // Close details popup on outside click
  useEffect(() => {
    if (!detailsOpen) return
    const handleClick = (e: MouseEvent) => {
      if (detailsRef.current && !detailsRef.current.contains(e.target as Node)) {
        setDetailsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [detailsOpen])

  const details = useMemo(() => {
    if (!context) return []
    return pickUsedContextCategory(context)
  }, [context])

  const displayContext = context
  const hasPlaceholderContext = !displayContext && (
    draft || (!loading && messageCount === 0 && (!error || isCliNotRunningError(error)))
  )
  const isPendingContext = hasPlaceholderContext && !displayContext
  const percentage = displayContext ? Math.max(0, Math.min(100, displayContext.percentage)) : 0
  const usedTokens = displayContext?.totalTokens ?? 0
  const maxTokens = displayContext?.rawMaxTokens ?? 0
  const freeTokens = Math.max(0, maxTokens - usedTokens)
  const strokeColor = percentage >= 90
    ? 'var(--color-error)'
    : 'var(--color-token-text-secondary)'
  const trackColor = 'rgba(255,255,255,0.1)'
  const ringStyle = {
    background: displayContext
      ? `conic-gradient(${strokeColor} ${percentage * 3.6}deg, ${trackColor} 0deg)`
      : trackColor,
  }
  const displayModel = firstNonEmpty(context?.model, inspectionModel, fallbackModelLabel)
  const ariaLabel = displayContext
    ? t('contextIndicator.ariaLabel', { percent: formatPercent(percentage) })
    : isPendingContext
      ? t('contextIndicator.pendingAria')
    : loading
      ? t('contextIndicator.loadingAria')
      : t('contextIndicator.unavailableAria')

  return (
    <div className="relative pointer-events-auto">
      <button
        type="button"
        aria-label={ariaLabel}
        onClick={() => {
          if (compact) {
            setMobileDetailsOpen(true)
          } else {
            setDetailsOpen((prev) => !prev)
          }
          void refresh('manual')
        }}
        title={t('contextIndicator.title')}
        data-testid="context-usage-indicator"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-transparent text-[var(--color-token-text-secondary)] transition-colors hover:bg-white/[0.055] hover:text-[var(--color-token-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20"
      >
        <span className="relative grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full">
          {loading && !displayContext ? (
            <span className="absolute inset-[2px] rounded-full border-2 border-[var(--color-token-text-secondary)] border-t-transparent motion-safe:animate-spin" />
          ) : (
            <span
              className="relative grid h-[18px] w-[18px] place-items-center rounded-full opacity-90"
              style={ringStyle}
            >
              <span className="absolute inset-[4px] rounded-full bg-[var(--color-surface-glass)]" />
            </span>
          )}
        </span>
      </button>

      {!compact && detailsOpen && (
        <div
          ref={detailsRef}
          className="sidebar-codex-menu liquid-glass glass-panel pointer-events-auto absolute bottom-full right-0 z-40 mb-2 w-[300px] max-w-[calc(100vw-2rem)] rounded-[var(--radius-2xl)] p-3 text-left"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[var(--color-token-text-secondary)]">
                {t('contextIndicator.title')}
              </div>
              <div className="mt-0.5 truncate text-[13px] font-semibold text-[var(--color-token-foreground)]">
                {displayModel ?? t('contextIndicator.modelUnknown')}
              </div>
            </div>
            <div className="shrink-0 font-mono text-lg font-semibold text-[var(--color-token-foreground)]">
              {displayContext ? formatPercent(percentage) : '--'}
            </div>
          </div>

          {displayContext ? (
            <>
              <div className="mt-2.5 grid grid-cols-2 gap-2 font-mono text-[13px] leading-5">
                <div>
                  <div className="text-[12px] text-[var(--color-token-text-secondary)]">{t('contextIndicator.used')}</div>
                  <div className="text-[var(--color-token-foreground)]">{formatNumber(usedTokens)}</div>
                </div>
                <div>
                  <div className="text-[12px] text-[var(--color-token-text-secondary)]">{t('contextIndicator.free')}</div>
                  <div className="text-[var(--color-token-foreground)]">{formatNumber(freeTokens)}</div>
                </div>
                <div className="col-span-2">
                  <div className="text-[12px] text-[var(--color-token-text-secondary)]">{t('contextIndicator.window')}</div>
                  <div className="text-[var(--color-token-foreground)]">{maxTokens > 0 ? formatNumber(maxTokens) : '--'}</div>
                </div>
              </div>
              {details.length > 0 && (
                <div className="mt-2.5 space-y-1.5">
                  {details.map((category) => {
                    const percent = maxTokens > 0 ? Math.max(0.5, Math.min(100, (category.tokens / maxTokens) * 100)) : 0
                    return (
                      <div key={category.name}>
                        <div className="flex items-center justify-between gap-3 text-[12px] leading-5">
                          <span className="min-w-0 truncate text-[var(--color-token-text-secondary)]">{category.name}</span>
                          <span className="shrink-0 font-mono text-[var(--color-token-text-secondary)]">{formatNumber(category.tokens)}</span>
                        </div>
                        <div className="mt-0.5 h-1 overflow-hidden rounded-full bg-[var(--color-surface-container)]">
                          <div className="h-full rounded-full" style={{ width: `${percent}%`, backgroundColor: category.color }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
              <div className="mt-2.5 text-[12px] leading-5 text-[var(--color-token-text-secondary)]">
                {formatUpdatedAt(updatedAt, t)}
                {contextSource === 'estimate' && (
                  <span className="ml-2 inline-flex rounded-full border border-[var(--color-token-border)] px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.06em]">
                    {t('contextIndicator.estimate')}
                  </span>
                )}
              </div>
            </>
          ) : isPendingContext ? (
            <div className="mt-3 text-[13px] leading-5 text-[var(--color-token-text-secondary)]">
              {t('contextIndicator.pendingDetail')}
            </div>
          ) : (
            <div className="mt-3 text-[13px] leading-5 text-[var(--color-token-text-secondary)]">
              {loading ? t('contextIndicator.loading') : t('contextIndicator.unavailableDetail')}
            </div>
          )}
        </div>
      )}

      {compact && (
        <MobileBottomSheet
          open={mobileDetailsOpen}
          onClose={() => setMobileDetailsOpen(false)}
          title={t('contextIndicator.title')}
          closeLabel={t('tabs.close')}
          ariaLabel={t('contextIndicator.title')}
          headerExtra={(
            <div className="truncate text-base font-semibold text-[var(--color-token-foreground)]">
              {displayModel ?? t('contextIndicator.modelUnknown')}
            </div>
          )}
          contentClassName="p-4"
        >
          <div className="flex items-end justify-between gap-4">
            <div className="font-mono text-4xl font-semibold text-[var(--color-token-foreground)]">
              {displayContext ? formatPercent(percentage) : '--'}
            </div>
            {contextSource === 'estimate' && (
              <span className="mb-1 rounded-full border border-[var(--color-token-border)] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--color-token-text-secondary)]">
                {t('contextIndicator.estimate')}
              </span>
            )}
          </div>

          {displayContext ? (
            <div className="mt-5">
              <div className="grid grid-cols-3 gap-2 font-mono text-xs">
                <div className="rounded-xl bg-[var(--color-surface-container)] p-3">
                  <div className="text-[var(--color-token-text-secondary)]">{t('contextIndicator.used')}</div>
                  <div className="mt-1 text-[var(--color-token-foreground)]">{formatNumber(usedTokens)}</div>
                </div>
                <div className="rounded-xl bg-[var(--color-surface-container)] p-3">
                  <div className="text-[var(--color-token-text-secondary)]">{t('contextIndicator.free')}</div>
                  <div className="mt-1 text-[var(--color-token-foreground)]">{formatNumber(freeTokens)}</div>
                </div>
                <div className="rounded-xl bg-[var(--color-surface-container)] p-3">
                  <div className="text-[var(--color-token-text-secondary)]">{t('contextIndicator.window')}</div>
                  <div className="mt-1 text-[var(--color-token-foreground)]">{maxTokens > 0 ? formatNumber(maxTokens) : '--'}</div>
                </div>
              </div>
              {details.length > 0 && (
                <div className="mt-5 space-y-3">
                  {details.map((category) => {
                    const percent = maxTokens > 0 ? Math.max(0.5, Math.min(100, (category.tokens / maxTokens) * 100)) : 0
                    return (
                      <div key={category.name}>
                        <div className="flex items-center justify-between gap-3 text-xs">
                          <span className="min-w-0 truncate text-[var(--color-token-text-secondary)]">{category.name}</span>
                          <span className="shrink-0 font-mono text-[var(--color-token-text-secondary)]">{formatNumber(category.tokens)}</span>
                        </div>
                        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--color-surface-container)]">
                          <div className="h-full rounded-full" style={{ width: `${percent}%`, backgroundColor: category.color }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
              <div className="mt-3 text-[11px] text-[var(--color-token-text-secondary)]">
                {formatUpdatedAt(updatedAt, t)}
              </div>
            </div>
          ) : (
            <div className="mt-5 rounded-xl bg-[var(--color-surface-container)] p-4 text-sm leading-6 text-[var(--color-token-text-secondary)]">
              {isPendingContext
                ? t('contextIndicator.pendingDetail')
                : loading
                  ? t('contextIndicator.loading')
                  : t('contextIndicator.unavailableDetail')}
            </div>
          )}
        </MobileBottomSheet>
      )}
    </div>
  )
}
