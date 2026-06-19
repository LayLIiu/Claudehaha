import { forwardRef, useState, useEffect, useRef, useCallback, useImperativeHandle } from 'react'
import { ApiError } from '../../api/client'
import { filesystemApi } from '../../api/filesystem'
import { useTranslation } from '../../i18n'
import type { TranslationKey } from '../../i18n'

type DirEntry = {
  name: string
  path: string
  isDirectory: boolean
  relativePath?: string
}

export type FileSearchMenuHandle = {
  handleKeyDown: (e: KeyboardEvent) => void
}

type Props = {
  cwd: string
  filter?: string
  compact?: boolean
  onSelect: (path: string, relativePath: string, isDirectory: boolean) => void
  onNavigate?: (relativePath: string) => void
}

export const FileSearchMenu = forwardRef<FileSearchMenuHandle, Props>(({ cwd, filter = '', compact = false, onSelect, onNavigate }, ref) => {
  const t = useTranslation()
  const [entries, setEntries] = useState<DirEntry[]>([])
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [errorKey, setErrorKey] = useState<TranslationKey | null>(null)
  const [currentPath, setCurrentPath] = useState(cwd)
  const [isSearchMode, setIsSearchMode] = useState(false)
  const [loading, setLoading] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [rootPath, setRootPath] = useState(cwd)
  const listRef = useRef<HTMLDivElement>(null)
  const currentPathRef = useRef(cwd)
  const rootPathRef = useRef(cwd)

  const getErrorState = (error: unknown): { errorKey: TranslationKey | null; errorMessage: string | null } => {
    if (error instanceof ApiError) {
      if (error.status === 403) {
        return { errorKey: 'fileSearch.accessDenied', errorMessage: null }
      }

      const apiMessage =
        typeof error.body === 'string'
          ? error.body
          : typeof error.body === 'object' &&
              error.body !== null &&
              'error' in error.body &&
              typeof error.body.error === 'string'
            ? error.body.error
            : null

      if (apiMessage) {
        return { errorKey: null, errorMessage: apiMessage }
      }
    }

    return { errorKey: 'fileSearch.loadFailed', errorMessage: null }
  }

  const getRelativePath = useCallback((entry: DirEntry) => {
    const basePath = (cwd || rootPath).replace(/\/+$/, '')
    if (entry.path.startsWith(`${basePath}/`)) return entry.path.slice(basePath.length + 1)
    if (entry.relativePath) return entry.relativePath
    return entry.name
  }, [cwd, rootPath])

  const getDisplayPath = useCallback((entry: DirEntry) => {
    const relativePath = getRelativePath(entry).replace(/\\/g, '/')
    if (!entry.isDirectory) return relativePath
    return `${relativePath.replace(/\/+$/, '')}/`
  }, [getRelativePath])

  const selectEntry = useCallback((entry: DirEntry) => {
    onSelect(entry.path, getRelativePath(entry), entry.isDirectory)
  }, [getRelativePath, onSelect])

  const parseFilter = (rawFilter: string): { navigateTo: string; searchQuery: string } => {
    const trimmed = rawFilter.trim()
    const basePath = (cwd || rootPathRef.current).replace(/\/+$/, '')
    if (!trimmed) return { navigateTo: basePath, searchQuery: '' }
    if (trimmed.endsWith('/')) {
      if (!basePath) return { navigateTo: '', searchQuery: trimmed.replace(/\/+$/, '') }
      return { navigateTo: `${basePath}/${trimmed.replace(/\/+$/, '')}`, searchQuery: '' }
    }
    return { navigateTo: basePath, searchQuery: trimmed }
  }

  // Load directory entries
  const loadDir = useCallback(async (dirPath: string, searchQuery: string) => {
    setLoading(true)
    setErrorMessage(null)
    setErrorKey(null)
    // Only update currentPath if actually navigating to a different directory
    if (dirPath !== currentPathRef.current) {
      setCurrentPath(dirPath)
      currentPathRef.current = dirPath
    }
    try {
      if (searchQuery) {
        setIsSearchMode(true)
        const result = await filesystemApi.search(searchQuery, dirPath)
        setCurrentPath(result.currentPath)
        currentPathRef.current = result.currentPath
        if (!cwd) {
          setRootPath(result.currentPath)
          rootPathRef.current = result.currentPath
        }
        setEntries(result.entries)
      } else {
        setIsSearchMode(false)
        const result = await filesystemApi.browse(dirPath, { includeFiles: true })
        setCurrentPath(result.currentPath)
        currentPathRef.current = result.currentPath
        if (!cwd) {
          setRootPath(result.currentPath)
          rootPathRef.current = result.currentPath
        }
        setEntries(result.entries)
      }
      setSelectedIndex(0)
    } catch (error) {
      setEntries([])
      const nextError = getErrorState(error)
      setErrorKey(nextError.errorKey)
      setErrorMessage(nextError.errorMessage)
    }
    setLoading(false)
  }, [cwd])

  const navigateEntry = useCallback((entry: DirEntry) => {
    if (!entry.isDirectory) return
    const relativePath = `${getRelativePath(entry).replace(/\/+$/, '')}/`
    void loadDir(entry.path, '')
    onNavigate?.(relativePath)
  }, [getRelativePath, loadDir, onNavigate])

  // Keep the explicit workspace root stable when the host session changes.
  useEffect(() => {
    currentPathRef.current = cwd
    rootPathRef.current = cwd
    setRootPath(cwd)
    setCurrentPath(cwd)
  }, [cwd])

  // Initial load: parse filter path and navigate accordingly
  useEffect(() => {
    const { navigateTo, searchQuery } = parseFilter(filter)
    void loadDir(navigateTo, searchQuery)
  }, [cwd, filter, loadDir])

  // Keyboard navigation handler exposed via ref
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((prev) => Math.min(prev + 1, entries.length - 1))
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((prev) => Math.max(prev - 1, 0))
      return
    }
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault()
      const selected = entries[selectedIndex]
      if (selected) {
        selectEntry(selected)
      }
      return
    }
    if (e.key === 'ArrowRight') {
      const selected = entries[selectedIndex]
      if (selected?.isDirectory) {
        e.preventDefault()
        navigateEntry(selected)
      }
      return
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries, selectedIndex, selectEntry, navigateEntry])

  useImperativeHandle(ref, () => ({ handleKeyDown }), [handleKeyDown])

  // Scroll selected into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-index="${selectedIndex}"]`) as HTMLButtonElement | null
    el?.scrollIntoView({ block: 'nearest' })
  }, [selectedIndex])

  // Build breadcrumb segments from current path relative to cwd
  const breadcrumbs: string[] = []
  if (currentPath !== cwd && currentPath.startsWith(cwd)) {
    const rel = currentPath.slice(cwd.length).replace(/^\//, '')
    if (rel) breadcrumbs.push(...rel.split('/'))
  }

  const renderEntry = (entry: DirEntry, index: number) => {
    const relativePath = getRelativePath(entry)
    const displayPath = getDisplayPath(entry)
    const parentPath = relativePath.split('/').slice(0, -1).join('/')
    const selected = selectedIndex === index
    return (
      <div
        key={entry.path}
        data-index={index}
        className="group flex items-stretch px-0.5 py-0.5"
        onMouseEnter={() => setSelectedIndex(index)}
      >
        <button
          type="button"
          onClick={() => selectEntry(entry)}
          className={`flex min-w-0 flex-1 items-center rounded-[var(--radius-lg)] px-2.5 text-left transition-colors hover:bg-[rgba(255,255,255,0.04)] focus-visible:bg-[rgba(255,255,255,0.04)] focus-visible:outline-none ${
            isSearchMode ? 'gap-2.5 py-1.5' : 'gap-2.5 py-1.5'
          } ${selected ? 'bg-white/[0.085]' : ''}`}
          role="option"
          aria-selected={selected}
        >
          <span className={`material-symbols-outlined shrink-0 text-[17px] ${entry.isDirectory ? 'text-[var(--color-brand)]' : 'text-[var(--color-token-text-secondary)]'}`}>
            {entry.isDirectory ? 'folder' : 'description'}
          </span>
          <span className="min-w-0 flex-1">
            {isSearchMode ? (
              <span
                className="block truncate font-[var(--font-mono)] text-sm text-[var(--color-token-foreground)]"
                title={displayPath}
              >
                {displayPath}
              </span>
            ) : (
              <>
                <span className="block truncate text-sm font-medium text-[var(--color-token-foreground)]">{entry.name}</span>
                <span className="block truncate font-[var(--font-mono)] text-[11px] text-[var(--color-token-text-secondary)]">
                  {parentPath || (entry.isDirectory ? t('fileSearch.directory') : t('fileSearch.currentDirectory'))}
                </span>
              </>
            )}
          </span>
          {!isSearchMode ? (
            <span className="shrink-0 rounded-md border border-[var(--color-token-border)] px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.02em] text-[var(--color-token-text-secondary)]">
              {entry.isDirectory ? t('fileSearch.folderTag') : t('fileSearch.fileTag')}
            </span>
          ) : null}
        </button>
        {entry.isDirectory ? (
          <button
            type="button"
            aria-label={t('fileSearch.openFolder')}
            title={t('fileSearch.openFolder')}
            onClick={(event) => {
              event.stopPropagation()
              navigateEntry(entry)
            }}
            className="my-0.5 flex w-8 shrink-0 items-center justify-center rounded-[var(--radius-md)] text-[var(--color-token-text-secondary)] opacity-70 transition hover:bg-white/[0.085] hover:text-[var(--color-token-foreground)] focus-visible:outline-none group-hover:opacity-100"
          >
            <span className="material-symbols-outlined icon-sm">chevron_right</span>
          </button>
        ) : null}
      </div>
    )
  }

  return (
    <div
      id="file-search-menu"
      className={`sidebar-codex-menu liquid-glass glass-panel absolute bottom-full mb-2 z-50 w-full overflow-hidden rounded-[var(--radius-2xl)] p-1.5 shadow-[var(--shadow-dropdown)] ${
        compact ? 'left-0 right-0 min-w-0 max-w-[calc(100vw-32px)]' : 'left-0 min-w-[480px]'
      }`}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* Header with path */}
      <div className="flex items-center gap-1.5 px-2 py-1.5 text-[11px]">
        <span className="material-symbols-outlined icon-xs text-[var(--color-token-text-secondary)]">folder_open</span>
        <span className="text-[var(--color-token-text-secondary)] font-mono">{cwd.split('/').pop() || cwd}</span>
        {breadcrumbs.map((seg, i) => (
          <span key={i} className="flex items-center gap-1">
            <span className="text-[var(--color-token-text-secondary)]">/</span>
            <span className="text-[var(--color-token-foreground)] font-mono">{seg}</span>
          </span>
        ))}
        {isSearchMode && filter ? (
          <span className="ml-auto truncate font-mono text-[11px] text-[var(--color-token-text-secondary)]">@{filter}</span>
        ) : null}
        {loading && (
          <span className="material-symbols-outlined icon-2xs text-[var(--color-token-text-secondary)] animate-spin ml-1">progress_activity</span>
        )}
      </div>

      {/* File list */}
      <div className="sidebar-codex-menu-divider" />
      <div ref={listRef} className="max-h-[300px] overflow-y-auto py-0.5">
        {loading && entries.length === 0 ? (
          <div className="px-4 py-6 text-center text-xs text-[var(--color-token-text-secondary)]">{t('fileSearch.searching')}</div>
        ) : (errorKey || errorMessage) ? (
          <div className="px-4 py-6 text-center text-xs text-[var(--color-error)]">
            {errorKey ? t(errorKey) : errorMessage}
          </div>
        ) : entries.length === 0 ? (
          <div className="px-4 py-6 text-center text-xs text-[var(--color-token-text-secondary)]">
            {filter ? t('fileSearch.noMatch') : t('fileSearch.noFiles')}
          </div>
        ) : (
          <>
            {entries.map(renderEntry)}
          </>
        )}
      </div>

      {/* Footer hint */}
      {!compact ? (
        <>
          <div className="sidebar-codex-menu-divider" />
          <div className="flex items-center gap-1.5 px-2 py-1 text-[10px] text-[var(--color-token-text-secondary)]">
          <kbd className="rounded border border-[var(--color-token-border)] bg-[var(--color-surface-container-low)] px-1 py-0.5 font-mono">↑↓</kbd>
          <span>{t('fileSearch.navigate')}</span>
          <kbd className="ml-2 rounded border border-[var(--color-token-border)] bg-[var(--color-surface-container-low)] px-1 py-0.5 font-mono">Enter</kbd>
          <span>{t('fileSearch.select')}</span>
          <kbd className="ml-2 rounded border border-[var(--color-token-border)] bg-[var(--color-surface-container-low)] px-1 py-0.5 font-mono">→</kbd>
          <span>{t('fileSearch.open')}</span>
          <kbd className="ml-2 rounded border border-[var(--color-token-border)] bg-[var(--color-surface-container-low)] px-1 py-0.5 font-mono">Esc</kbd>
            <span>{t('fileSearch.close')}</span>
          </div>
        </>
      ) : null}
    </div>
  )
})

FileSearchMenu.displayName = 'FileSearchMenu'
