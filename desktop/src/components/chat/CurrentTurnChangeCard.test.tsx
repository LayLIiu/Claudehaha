import '@testing-library/jest-dom'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'

// ──────────────────────────────────────────────────────────────────────────────
// Hoisted mocks (vi.hoisted runs before module evaluation)
// ──────────────────────────────────────────────────────────────────────────────
const { openPreviewSpy, browserOpenSpy, openTargetSpy, ensureTargetsMock } = vi.hoisted(() => {
  const openPreviewSpy = vi.fn().mockResolvedValue(undefined)
  const browserOpenSpy = vi.fn()
  const openTargetSpy = vi.fn().mockResolvedValue(undefined)
  const ensureTargetsMock = vi.fn().mockResolvedValue(undefined)
  return { openPreviewSpy, browserOpenSpy, openTargetSpy, ensureTargetsMock }
})

// Mock openTargetStore
vi.mock('../../stores/openTargetStore', () => ({
  useOpenTargetStore: Object.assign(
    // Selector hook form: useOpenTargetStore((s) => s.xxx)
    (selector: (s: { targets: unknown[]; ensureTargets: () => Promise<void>; openTarget: () => Promise<void> }) => unknown) =>
      selector({
        targets: [{ id: 'code', kind: 'ide', label: 'VS Code', icon: '', platform: 'darwin' }],
        ensureTargets: ensureTargetsMock,
        openTarget: openTargetSpy,
      }),
    {
      // Static .getState() access
      getState: vi.fn(() => ({
        targets: [{ id: 'code', kind: 'ide', label: 'VS Code', icon: '', platform: 'darwin' }],
        ensureTargets: ensureTargetsMock,
        openTarget: openTargetSpy,
      })),
    },
  ),
}))

// Mock browserPanelStore
vi.mock('../../stores/browserPanelStore', () => ({
  useBrowserPanelStore: Object.assign(
    (selector: (s: { open: () => void }) => unknown) =>
      selector({ open: browserOpenSpy }),
    {
      getState: vi.fn(() => ({ open: browserOpenSpy })),
    },
  ),
}))

// Mock workspacePanelStore
vi.mock('../../stores/workspacePanelStore', () => ({
  useWorkspacePanelStore: Object.assign(
    (selector: (s: { openPreview: () => Promise<void> }) => unknown) =>
      selector({ openPreview: openPreviewSpy }),
    {
      getState: vi.fn(() => ({ openPreview: openPreviewSpy })),
    },
  ),
}))

// Mock @tauri-apps/plugin-shell
vi.mock('@tauri-apps/plugin-shell', () => ({
  open: vi.fn().mockResolvedValue(undefined),
}))

// Mock desktopRuntime.getServerBaseUrl
vi.mock('../../lib/desktopRuntime', () => ({
  getServerBaseUrl: vi.fn(() => 'http://127.0.0.1:4321'),
}))

// Mock useTranslation: returns identity-ish t function
vi.mock('../../i18n', () => ({
  useTranslation: () => (key: string, params?: Record<string, string | number>) => {
    if (params) {
      return Object.entries(params).reduce<string>(
        (acc, [k, v]) => acc.replace(`{${k}}`, String(v)),
        key,
      )
    }
    return key
  },
}))

// ──────────────────────────────────────────────────────────────────────────────
// Import after mocks
// ──────────────────────────────────────────────────────────────────────────────
import { CurrentTurnChangeCard } from './CurrentTurnChangeCard'
import { localFileUrl } from '../../lib/handlePreviewLink'
import type { SessionTurnCheckpoint } from '../../api/sessions'

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────
function makeCheckpoint(
  filesChanged: string[],
  fileStats: Array<{ path: string; insertions: number; deletions: number }> = [],
): SessionTurnCheckpoint {
  return {
    code: {
      available: true,
      filesChanged,
      insertions: fileStats.length > 0
        ? fileStats.reduce((total, item) => total + item.insertions, 0)
        : 10,
      deletions: fileStats.reduce((total, item) => total + item.deletions, 0),
      fileStats,
    },
    target: {
      targetUserMessageId: 'msg-1',
      userMessageIndex: 0,
      userMessageCount: 1,
    },
    conversation: {
      messagesRemoved: 0,
    },
  }
}

function renderCard(
  filesChanged: string[],
  fileStats: Array<{ path: string; insertions: number; deletions: number }> = [],
) {
  const checkpoint = makeCheckpoint(filesChanged, fileStats)
  return render(
    <CurrentTurnChangeCard
      sessionId="s1"
      checkpoint={checkpoint}
      workDir="/w/proj"
      error={null}
      isUndoing={false}
      isLatest={true}
      onUndo={vi.fn()}
    />,
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────────────────────────────────────
afterEach(() => {
  cleanup()
})

describe('CurrentTurnChangeCard – Codex-style file rows', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ensureTargetsMock.mockResolvedValue(undefined)
    openPreviewSpy.mockResolvedValue(undefined)
  })

  it('renders workdir-relative paths for each file', () => {
    renderCard(['/w/proj/README.md', '/w/proj/src/index.ts'])
    expect(screen.getByText('README.md')).toBeInTheDocument()
    expect(screen.getByText('src/index.ts')).toBeInTheDocument()
  })



  it('renders per-file insertion and deletion stats when checkpoint data includes them', () => {
    renderCard(
      ['/w/proj/src/App.tsx', '/w/proj/src/index.ts'],
      [
        { path: '/w/proj/src/App.tsx', insertions: 21, deletions: 3 },
        { path: '/w/proj/src/index.ts', insertions: 4, deletions: 0 },
      ],
    )

    expect(screen.getByText('+21')).toBeInTheDocument()
    expect(screen.getAllByText('-3').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('+4')).toBeInTheDocument()
    expect(screen.getByText('-0')).toBeInTheDocument()
  })

  it('sorts previewable changed files before source-only files', () => {
    renderCard([
      '/w/proj/package.json',
      '/w/proj/preview.md',
      '/w/proj/src/main.ts',
      '/w/proj/index.html',
      '/w/proj/style.css',
    ])

    const rows = screen.getAllByRole('button', { name: /turnChangesOpenInWorkspaceAria/ })
    expect(rows.map((row) => row.textContent)).toEqual([
      expect.stringContaining('preview.md'),
      expect.stringContaining('index.html'),
      expect.stringContaining('package.json'),
      expect.stringContaining('main.ts'),
      expect.stringContaining('style.css'),
    ])
  })

})

describe('CurrentTurnChangeCard – row opens the workspace diff', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ensureTargetsMock.mockResolvedValue(undefined)
    openPreviewSpy.mockResolvedValue(undefined)
  })

  it('clicking a file row calls openPreview(sessionId, displayPath, "diff")', () => {
    renderCard(['/w/proj/src/main.ts'])
    const row = screen.getByRole('button', { name: /turnChangesOpenInWorkspaceAria/ })
    fireEvent.click(row)
    // displayPath is the workDir-relative path (matches the workspace file tree)
    expect(openPreviewSpy).toHaveBeenCalledWith('s1', 'src/main.ts', 'diff')
  })

  it('passes the workDir-relative displayPath (not the absolute path) to openPreview', () => {
    renderCard(['/w/proj/README.md'])
    const row = screen.getByRole('button', { name: /turnChangesOpenInWorkspaceAria/ })
    fireEvent.click(row)
    expect(openPreviewSpy).toHaveBeenCalledWith('s1', 'README.md', 'diff')
  })

  it('clicking an outside-workspace html changed file opens the in-app browser via local-file', () => {
    // The file lives outside the workdir (absolute displayPath) — no diff baseline,
    // so html renders directly in the in-app browser via the /local-file route.
    renderCard(['/other/place/todo.html'])
    const row = screen.getByRole('button', { name: /turnChangesOpenInWorkspaceAria/ })
    fireEvent.click(row)
    expect(browserOpenSpy).toHaveBeenCalledWith('s1', localFileUrl('http://127.0.0.1:4321', '/other/place/todo.html'))
    expect(openPreviewSpy).not.toHaveBeenCalled()
  })

  it('clicking an outside-workspace non-html changed file opens a file preview (not a diff)', () => {
    renderCard(['/other/place/notes.txt'])
    const row = screen.getByRole('button', { name: /turnChangesOpenInWorkspaceAria/ })
    fireEvent.click(row)
    expect(openPreviewSpy).toHaveBeenCalledWith('s1', '/other/place/notes.txt', 'file')
    expect(browserOpenSpy).not.toHaveBeenCalled()
  })

  it('does NOT render an inline diff surface after clicking a row', () => {
    renderCard(['/w/proj/src/main.ts'])
    const row = screen.getByRole('button', { name: /turnChangesOpenInWorkspaceAria/ })
    fireEvent.click(row)
    // No inline diff is rendered inside the card anymore — the diff opens in the
    // right-side workspace panel instead.
    expect(screen.queryByText('chat.turnChangesDiffLoading')).not.toBeInTheDocument()
    expect(screen.queryByText('chat.turnChangesDiffUnavailable')).not.toBeInTheDocument()
    // The CodeMirror diff surface (.cm-editor) is never mounted in the card.
    expect(document.querySelector('.cm-editor')).toBeNull()
  })

  it('each file row exposes a single "open in workspace" button (no expand/collapse toggle)', () => {
    renderCard(['/w/proj/README.md', '/w/proj/src/index.ts'])
    expect(screen.getAllByRole('button', { name: /turnChangesOpenInWorkspaceAria/ })).toHaveLength(2)
  })
})

describe('CurrentTurnChangeCard – collapse long file lists', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ensureTargetsMock.mockResolvedValue(undefined)
    openPreviewSpy.mockResolvedValue(undefined)
  })

  function makeFiles(count: number): string[] {
    return Array.from({ length: count }, (_, i) => `/w/proj/src/file${i + 1}.ts`)
  }

  it('does NOT render a show-more toggle with ≤5 files', () => {
    renderCard(makeFiles(5))
    expect(screen.getAllByRole('button', { name: /turnChangesOpenInWorkspaceAria/ })).toHaveLength(5)
    expect(screen.queryByText('chat.turnChangesShowMore')).not.toBeInTheDocument()
    expect(screen.queryByText('chat.turnChangesShowLess')).not.toBeInTheDocument()
  })

  it('with 8 files shows only 5 rows + a "show more" toggle (remaining = 3)', () => {
    renderCard(makeFiles(8))
    // only the first 5 workspace-open rows are rendered
    expect(screen.getAllByRole('button', { name: /turnChangesOpenInWorkspaceAria/ })).toHaveLength(5)
    // the show-more toggle is present (identity-mock key). The real key carries the
    // remaining count via '{count}'; with the placeholder-bearing real string this
    // renders as "再显示 3 个文件" (8 - COLLAPSED_COUNT(5) = 3).
    expect(screen.getByText('chat.turnChangesShowMore')).toBeInTheDocument()
    // …and it is the only toggle (no "show less" while collapsed)
    expect(screen.queryByText('chat.turnChangesShowLess')).not.toBeInTheDocument()
  })

  it('clicking "show more" reveals all 8 rows and shows "show less"; clicking again re-collapses', () => {
    renderCard(makeFiles(8))
    const showMore = screen.getByText('chat.turnChangesShowMore')

    fireEvent.click(showMore)
    expect(screen.getAllByRole('button', { name: /turnChangesOpenInWorkspaceAria/ })).toHaveLength(8)
    const showLess = screen.getByText('chat.turnChangesShowLess')
    expect(showLess).toBeInTheDocument()
    expect(screen.queryByText('chat.turnChangesShowMore')).not.toBeInTheDocument()

    fireEvent.click(showLess)
    expect(screen.getAllByRole('button', { name: /turnChangesOpenInWorkspaceAria/ })).toHaveLength(5)
    expect(screen.getByText('chat.turnChangesShowMore')).toBeInTheDocument()
  })
})
