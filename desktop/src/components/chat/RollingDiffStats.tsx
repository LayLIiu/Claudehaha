import type { DiffStats } from './diffStats'

export function RollingDiffStats({
  stats,
  variant = 'default',
  className = '',
}: {
  stats: DiffStats
  variant?: 'default' | 'inline'
  className?: string
}) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 tabular-nums tracking-tight ${className}`}
      data-thread-find-skip
    >
      <span className="codex-diff-stat-added flex shrink-0 items-center">
        +<RollingNumber value={stats.additions} variant={variant} />
      </span>
      <span className="codex-diff-stat-deleted flex shrink-0 items-center">
        -<RollingNumber value={stats.deletions} variant={variant} />
      </span>
    </span>
  )
}

function RollingNumber({ value, variant = 'default' }: { value: number; variant?: 'default' | 'inline' }) {
  const digits = Math.max(0, value).toLocaleString('en-US', { useGrouping: false }).split('')
  let digitIndex = digits.filter(isDigit).length

  return (
    <span className="codex-diff-stat-rolling-number" aria-label={String(value)}>
      {digits.map((char, index) => {
        if (!isDigit(char)) {
          return (
            <span key={`separator-${index}`} aria-hidden="true" className="codex-diff-stat-number-separator">
              {char}
            </span>
          )
        }
        digitIndex -= 1
        return <RollingDigit key={`digit-${digitIndex}`} digit={char} variant={variant} />
      })}
    </span>
  )
}

function RollingDigit({ digit, variant }: { digit: string; variant: 'default' | 'inline' }) {
  return (
    <span
      aria-hidden="true"
      className={`codex-diff-stat-digit-column ${
        variant === 'inline' ? 'codex-diff-stat-digit-column-inline' : ''
      }`}
    >
      <span className="codex-diff-stat-digit-clip">
        <span className={`codex-diff-stat-digit-stack codex-diff-stat-digit-stack-${digit}`}>
          {'0123456789'.split('').map((number) => (
            <span key={number}>{number}</span>
          ))}
        </span>
      </span>
    </span>
  )
}

function isDigit(value: string): boolean {
  return value >= '0' && value <= '9'
}
