import { RollingDiffStats } from './RollingDiffStats'
import type { LiveTurnChangeSummary } from './turnLiveChangeSummary'

export function CurrentTurnLiveChangePill({
  summary,
  compact = false,
}: {
  summary: LiveTurnChangeSummary | null
  compact?: boolean
}) {
  if (!summary || summary.fileCount <= 0) return null

  return (
    <div className="current-turn-live-change-pill-wrap" aria-live="polite">
      <div
        className={`current-turn-live-change-pill ${compact ? 'current-turn-live-change-pill--compact' : ''}`}
        data-testid="current-turn-live-change-pill"
      >
        <span className="current-turn-live-change-pill__label">
          {summary.fileCount} 个文件已更改
        </span>
        <RollingDiffStats stats={summary} variant="inline" className="text-[15px] font-semibold leading-5" />
      </div>
    </div>
  )
}
