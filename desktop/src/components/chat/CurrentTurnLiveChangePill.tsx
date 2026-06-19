import { RollingDiffStats } from './RollingDiffStats'
import type { LiveTurnChangeSummary } from './turnLiveChangeSummary'

export function CurrentTurnLiveChangePill({
  summary,
  compact = false,
  onOpenChanges,
}: {
  summary: LiveTurnChangeSummary | null
  compact?: boolean
  onOpenChanges?: () => void
}) {
  if (!summary || summary.fileCount <= 0) return null

  const content = (
    <>
      <span className="current-turn-live-change-pill__label">
        {summary.fileCount} 个文件已更改
      </span>
      <RollingDiffStats stats={summary} variant="inline" className="text-[15px] font-semibold leading-5" />
    </>
  )

  return (
    <div className="current-turn-live-change-pill-wrap" aria-live="polite">
      {onOpenChanges ? (
        <button
          type="button"
          className={`current-turn-live-change-pill current-turn-live-change-pill--button ${compact ? 'current-turn-live-change-pill--compact' : ''}`}
          data-testid="current-turn-live-change-pill"
          onClick={onOpenChanges}
          title="查看本轮文件变更"
          aria-label={`查看本轮 ${summary.fileCount} 个文件变更`}
        >
          {content}
        </button>
      ) : (
        <div
          className={`current-turn-live-change-pill ${compact ? 'current-turn-live-change-pill--compact' : ''}`}
          data-testid="current-turn-live-change-pill"
        >
          {content}
        </div>
      )}
    </div>
  )
}
