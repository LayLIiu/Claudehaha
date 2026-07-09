import ReactDiffViewer, { DiffMethod } from 'react-diff-viewer-continued'
import { CopyButton } from '../shared/CopyButton'
import { useUIStore } from '../../stores/uiStore'
import { calculateDiffStats } from './diffStats'

type Props = {
  filePath: string
  oldString: string
  newString: string
  monochrome?: boolean
}

/** Render plain text code for diff view (prism-react-renderer removed) */
function highlightSyntax(str: string) {
  return <span style={{ whiteSpace: 'pre-wrap', fontFamily: 'var(--font-mono)' }}>{str}</span>
}

const diffStyles = {
  variables: {
    light: {
      diffViewerBackground: 'var(--color-code-bg)',
      diffViewerColor: 'var(--color-code-fg)',
      addedBackground: 'var(--color-diff-added-bg)',
      addedColor: 'var(--color-code-fg)',
      removedBackground: 'var(--color-diff-removed-bg)',
      removedColor: 'var(--color-code-fg)',
      wordAddedBackground: 'var(--color-diff-added-word)',
      wordRemovedBackground: 'var(--color-diff-removed-word)',
      addedGutterBackground: 'var(--color-diff-added-gutter)',
      removedGutterBackground: 'var(--color-diff-removed-gutter)',
      gutterBackground: 'var(--color-surface-container-low)',
      gutterBackgroundDark: 'var(--color-surface-container)',
      highlightBackground: 'var(--color-diff-highlight-bg)',
      highlightGutterBackground: 'var(--color-diff-highlight-gutter)',
      codeFoldGutterBackground: 'var(--color-surface-container-high)',
      codeFoldBackground: 'var(--color-surface-container-highest)',
      emptyLineBackground: 'var(--color-surface-container-low)',
      gutterColor: 'var(--color-token-text-secondary)',
      addedGutterColor: 'var(--color-diff-added-text)',
      removedGutterColor: 'var(--color-diff-removed-text)',
      codeFoldContentColor: 'var(--color-token-text-secondary)',
      diffViewerTitleBackground: 'var(--color-diff-title-bg)',
      diffViewerTitleColor: 'var(--color-diff-title-color)',
      diffViewerTitleBorderColor: 'var(--color-diff-title-border)',
    },
  },
  diffContainer: {
    borderRadius: '0',
    fontSize: '12px',
    lineHeight: '1.45',
    fontFamily: 'var(--font-mono)',
  },
  line: {
    padding: '1px 0',
  },
  gutter: {
    padding: '1px 8px',
    minWidth: '40px',
    fontSize: '11px',
  },
  wordDiff: {
    padding: '1px 2px',
    borderRadius: 'var(--radius-2xs)',
  },
}

const monochromeDiffStyles = {
  variables: {
    light: {
      diffViewerBackground: 'rgba(255,255,255,0.02)',
      diffViewerColor: 'rgba(255,255,255,0.78)',
      addedBackground: 'rgba(255,255,255,0.03)',
      addedColor: 'rgba(255,255,255,0.78)',
      removedBackground: 'rgba(255,255,255,0.025)',
      removedColor: 'rgba(255,255,255,0.72)',
      wordAddedBackground: 'rgba(255,255,255,0.055)',
      wordRemovedBackground: 'rgba(255,255,255,0.05)',
      addedGutterBackground: 'rgba(255,255,255,0.03)',
      removedGutterBackground: 'rgba(255,255,255,0.025)',
      gutterBackground: 'rgba(255,255,255,0.02)',
      gutterBackgroundDark: 'rgba(255,255,255,0.02)',
      highlightBackground: 'rgba(255,255,255,0.04)',
      highlightGutterBackground: 'rgba(255,255,255,0.035)',
      codeFoldGutterBackground: 'rgba(255,255,255,0.02)',
      codeFoldBackground: 'rgba(255,255,255,0.02)',
      emptyLineBackground: 'rgba(255,255,255,0.02)',
      gutterColor: 'rgba(255,255,255,0.32)',
      addedGutterColor: 'rgba(255,255,255,0.48)',
      removedGutterColor: 'rgba(255,255,255,0.42)',
      codeFoldContentColor: 'rgba(255,255,255,0.42)',
      diffViewerTitleBackground: 'rgba(255,255,255,0.02)',
      diffViewerTitleColor: 'rgba(255,255,255,0.5)',
      diffViewerTitleBorderColor: 'rgba(255,255,255,0.08)',
    },
    dark: {
      diffViewerBackground: 'rgba(255,255,255,0.02)',
      diffViewerColor: 'rgba(255,255,255,0.78)',
      addedBackground: 'rgba(255,255,255,0.03)',
      addedColor: 'rgba(255,255,255,0.78)',
      removedBackground: 'rgba(255,255,255,0.025)',
      removedColor: 'rgba(255,255,255,0.72)',
      wordAddedBackground: 'rgba(255,255,255,0.055)',
      wordRemovedBackground: 'rgba(255,255,255,0.05)',
      addedGutterBackground: 'rgba(255,255,255,0.03)',
      removedGutterBackground: 'rgba(255,255,255,0.025)',
      gutterBackground: 'rgba(255,255,255,0.02)',
      gutterBackgroundDark: 'rgba(255,255,255,0.02)',
      highlightBackground: 'rgba(255,255,255,0.04)',
      highlightGutterBackground: 'rgba(255,255,255,0.035)',
      codeFoldGutterBackground: 'rgba(255,255,255,0.02)',
      codeFoldBackground: 'rgba(255,255,255,0.02)',
      emptyLineBackground: 'rgba(255,255,255,0.02)',
      gutterColor: 'rgba(255,255,255,0.32)',
      addedGutterColor: 'rgba(255,255,255,0.48)',
      removedGutterColor: 'rgba(255,255,255,0.42)',
      codeFoldContentColor: 'rgba(255,255,255,0.42)',
      diffViewerTitleBackground: 'rgba(255,255,255,0.02)',
      diffViewerTitleColor: 'rgba(255,255,255,0.5)',
      diffViewerTitleBorderColor: 'rgba(255,255,255,0.08)',
    },
  },
  diffContainer: diffStyles.diffContainer,
  line: diffStyles.line,
  gutter: diffStyles.gutter,
  wordDiff: diffStyles.wordDiff,
}

export function DiffViewer({ filePath, oldString, newString, monochrome = false }: Props) {
  const theme = useUIStore((state) => state.theme)

  const { additions, deletions } = calculateDiffStats(oldString, newString)

  return (
    <div className={monochrome
      ? 'overflow-hidden rounded-[var(--radius-2xl)] border border-[var(--color-token-border)] bg-[rgba(255,255,255,0.02)]'
      : 'overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-token-border)] bg-[var(--color-token-dropdown-background)]'}>
      {/* Header */}
      <div className={monochrome
        ? 'flex items-center justify-between border-b border-[var(--color-token-border)] bg-[rgba(255,255,255,0.02)] px-3 py-1.5'
        : 'flex items-center justify-between border-b border-[var(--color-token-border)] bg-[var(--color-token-dropdown-background)] px-3 py-1.5'}>
        <div className="min-w-0">
          <div className={monochrome
            ? 'truncate font-[var(--font-mono)] text-[11px] text-[rgba(255,255,255,0.38)]'
            : 'truncate font-[var(--font-mono)] text-[11px] text-[var(--color-token-description-foreground)]'}>
            {filePath}
          </div>
          <div className="mt-1 flex items-center gap-2 text-[10px] uppercase tracking-[0.14em]">
            <span className={monochrome
              ? 'rounded-full border border-white/8 bg-[rgba(255,255,255,0.03)] px-2 py-0.5 text-[rgba(255,255,255,0.5)]'
              : 'rounded-full bg-[var(--color-diff-added-bg)] px-2 py-0.5 text-[var(--color-diff-added-text)]'}>+{additions}</span>
            <span className={monochrome
              ? 'rounded-full border border-white/8 bg-[rgba(255,255,255,0.03)] px-2 py-0.5 text-[rgba(255,255,255,0.5)]'
              : 'rounded-full bg-[var(--color-diff-removed-bg)] px-2 py-0.5 text-[var(--color-diff-removed-text)]'}>-{deletions}</span>
          </div>
        </div>
        <CopyButton
          text={`--- ${filePath}\n+++ ${filePath}`}
          label="Copy path"
          className={monochrome
            ? 'rounded-md border border-[var(--color-token-border)] bg-[rgba(255,255,255,0.02)] px-2 py-1 text-[11px] text-[rgba(255,255,255,0.42)] transition-colors hover:bg-[rgba(255,255,255,0.05)] hover:text-[rgba(255,255,255,0.78)]'
            : 'rounded-md border border-[var(--color-token-border)] bg-[var(--color-token-editor-background)] px-2 py-1 text-[11px] text-[var(--color-token-description-foreground)] transition-colors hover:bg-[var(--color-token-bg-secondary)] hover:text-[var(--color-token-foreground)]'}
        />
      </div>

      {/* Diff area */}
      <div className="max-h-[400px] overflow-auto">
        <ReactDiffViewer
          oldValue={oldString}
          newValue={newString}
          splitView={false}
          compareMethod={DiffMethod.WORDS}
          renderContent={(str) => highlightSyntax(str)}
          hideLineNumbers={false}
          styles={monochrome ? monochromeDiffStyles : diffStyles}
          useDarkTheme={monochrome ? false : theme === 'dark'}
        />
      </div>
    </div>
  )
}
