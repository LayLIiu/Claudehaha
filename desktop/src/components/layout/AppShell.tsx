import { useCallback, useEffect, useMemo, useRef, useState, type HTMLAttributes } from 'react'
import { Sidebar } from './Sidebar'
import { ContentRouter } from './ContentRouter'
import { WindowControls } from './WindowControls'
import { ToastContainer } from '../shared/Toast'
import { UpdateChecker } from '../shared/UpdateChecker'
import { useSettingsStore } from '../../stores/settingsStore'
import { useUIStore, type SettingsTab } from '../../stores/uiStore'
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts'
import { useElectronWindowDragRegions } from '../../hooks/useElectronWindowDragRegions'
import { useGlobalSessionSync } from '../../hooks/useGlobalSessionSync'
import {
  H5ConnectionRequiredError,
  initializeDesktopServerUrl,
  isDesktopRuntime,
  isH5ConnectionRequiredError,
} from '../../lib/desktopRuntime'
import { getDesktopHost } from '../../lib/desktopHost'
import { StartupErrorView } from './StartupErrorView'
import { useTabStore, SETTINGS_TAB_ID } from '../../stores/tabStore'
import { useChatStore } from '../../stores/chatStore'
import { useSessionStore } from '../../stores/sessionStore'
import { useTranslation } from '../../i18n'
import { H5ConnectionView } from './H5ConnectionView'
import { useMobileViewport } from '../../hooks/useMobileViewport'
import { OpenProjectMenu } from './OpenProjectMenu'
import type { Tab } from '../../stores/tabStore'
import { MessageSquare, PanelLeftClose, PanelLeftOpen, Sun, Moon, Settings } from 'lucide-react'
import { getTraceLaunchRequest } from '../../lib/traceLaunch'
import { TraceList } from '../../pages/TraceList'
import { TraceSession } from '../../pages/TraceSession'
import { CommandPalette } from '../chat/CommandPalette'
import { useCommandPaletteStore } from '../../stores/commandPaletteStore'

function isChatTab(tab: Tab | undefined) {
  return tab?.type === 'session'
}

export function AppShell() {
  const fetchSettings = useSettingsStore((s) => s.fetchAll)
  const sidebarOpen = useUIStore((s) => s.sidebarOpen)
  const toggleSidebar = useUIStore((s) => s.toggleSidebar)
  const setSidebarOpen = useUIStore((s) => s.setSidebarOpen)
  const [ready, setReady] = useState(false)
  const [startupError, setStartupError] = useState<string | null>(null)
  const [h5StartupError, setH5StartupError] = useState<H5ConnectionRequiredError | null>(null)
  const [bootstrapNonce, setBootstrapNonce] = useState(0)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [envPanelOpen, setEnvPanelOpen] = useState(false)
  const mobileEnvPanelAnchorRef = useRef<HTMLButtonElement>(null)
  const swipeStartX = useRef(0)
  const swipeStartY = useRef(0)
  const swipeDragging = useRef(false)
  const t = useTranslation()
  const traceLaunch = useMemo(() => getTraceLaunchRequest(), [])
  const desktopRuntime = isDesktopRuntime()
  const isMobileShell = useMobileViewport() && !desktopRuntime
  const tabs = useTabStore((s) => s.tabs)
  const activeTabId = useTabStore((s) => s.activeTabId)
  const setActiveTab = useTabStore((s) => s.setActiveTab)
  const activeSession = useSessionStore((s) =>
    activeTabId ? s.sessions.find((session) => session.id === activeTabId) ?? null : null,
  )
  const wasMobileShellRef = useRef(false)
  const effectiveSidebarOpen = isMobileShell ? mobileSidebarOpen : sidebarOpen
  const activeTab = tabs.find((tab) => tab.sessionId === activeTabId)
  const isActiveChatTab = isChatTab(activeTab)
  const isSettingsTab = activeTabId === SETTINGS_TAB_ID || activeTab?.type === 'settings'
  const showDesktopSidebar = !isMobileShell && !isSettingsTab
  const mobileSessionTitle = activeSession?.title || activeTab?.title || t('session.untitled')
  const mobileSessionUpdated = (() => {
    if (!activeSession?.modifiedAt) return ''
    const diff = Date.now() - new Date(activeSession.modifiedAt).getTime()
    if (diff < 60000) return t('session.timeJustNow')
    if (diff < 3600000) return t('session.timeMinutes', { n: Math.floor(diff / 60000) })
    if (diff < 86400000) return t('session.timeHours', { n: Math.floor(diff / 3600000) })
    return t('session.timeDays', { n: Math.floor(diff / 86400000) })
  })()
  const sidebarHiddenProps: HTMLAttributes<HTMLDivElement> & { inert?: '' } =
    isMobileShell && !effectiveSidebarOpen
      ? { 'aria-hidden': true, inert: '' }
      : {}

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (!isMobileShell) return
    const touch = e.touches[0]!
    swipeStartX.current = touch.clientX
    swipeStartY.current = touch.clientY
    swipeDragging.current = false
  }, [isMobileShell])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isMobileShell) return
    const touch = e.touches[0]!
    const dx = touch.clientX - swipeStartX.current
    const dy = touch.clientY - swipeStartY.current
    // Only activate if starting from left edge (< 30px) and swiping right
    if (!swipeDragging.current && swipeStartX.current < 30 && dx > 10 && Math.abs(dx) > Math.abs(dy)) {
      swipeDragging.current = true
    }
  }, [isMobileShell])

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!isMobileShell || !swipeDragging.current) return
    const touch = e.changedTouches[0]!
    const dx = touch.clientX - swipeStartX.current
    // If swiped more than 60px to the right, open sidebar
    if (dx > 60) {
      setEffectiveSidebarOpen(true)
    }
    swipeDragging.current = false
  }, [isMobileShell])

  useEffect(() => {
    let cancelled = false

    const bootstrap = async () => {
      if (!cancelled) {
        setReady(false)
        setStartupError(null)
        setH5StartupError(null)
      }

      try {
        await initializeDesktopServerUrl()
        await fetchSettings()

        if (!cancelled) {
          setReady(true)
        }

        void (async () => {
          if (traceLaunch.windowMode) return

          await useTabStore.getState().restoreTabs()
          if (cancelled) return
          if (traceLaunch.sessionId) {
            useTabStore.getState().openTraceTab(
              traceLaunch.sessionId,
              `Trace: ${traceLaunch.sessionId.slice(0, 8)}`,
            )
            return
          }
          const { activeTabId: activeId, tabs } = useTabStore.getState()
          const activeTab = tabs.find((tab) => tab.sessionId === activeId)
          if (activeId && activeTab?.type === 'session') {
            useChatStore.getState().connectToSession(activeId)
          }
        })().catch(() => {})
      } catch (error) {
        if (!cancelled) {
          if (!desktopRuntime && isH5ConnectionRequiredError(error)) {
            setH5StartupError(error)
            setStartupError(null)
          } else {
            setStartupError(error instanceof Error ? error.message : String(error))
            setH5StartupError(null)
          }
          setReady(false)
        }
      }
    }

    void bootstrap()

    return () => {
      cancelled = true
    }
  }, [bootstrapNonce, fetchSettings, desktopRuntime, traceLaunch])

  // Listen for macOS native menu navigation events (About / Settings)
  useEffect(() => {
    const host = getDesktopHost()
    if (!host.isDesktop) return
    let unlisten: (() => void) | undefined
    host.window.onNativeMenuNavigate((target) => {
      const destination = target as SettingsTab | 'settings'
      if (destination === 'about') {
        useUIStore.getState().setPendingSettingsTab('about')
      }
      useTabStore.getState().openTab(SETTINGS_TAB_ID, 'Settings', 'settings')
    })
      .then((fn) => { unlisten = fn })
      .catch(() => {})
    return () => { unlisten?.() }
  }, [])

  useKeyboardShortcuts()
  useElectronWindowDragRegions()
  useGlobalSessionSync(ready && !traceLaunch.windowMode)

  useEffect(() => {
    if (isMobileShell && !wasMobileShellRef.current) {
      setMobileSidebarOpen(false)
      setSidebarOpen(false)
    }
    if (!isMobileShell && wasMobileShellRef.current) {
      setMobileSidebarOpen(false)
    }
    wasMobileShellRef.current = isMobileShell
  }, [isMobileShell, setSidebarOpen])

  useEffect(() => {
    if (!ready || !isMobileShell) return
    if (isChatTab(activeTab) || (!activeTab && !activeTabId)) return
    const nextChatTab = tabs.find(isChatTab)
    if (nextChatTab) {
      setActiveTab(nextChatTab.sessionId)
      return
    }
    useTabStore.setState({ activeTabId: null })
  }, [activeTab, activeTabId, isMobileShell, ready, setActiveTab, tabs])

  const setEffectiveSidebarOpen = (open: boolean) => {
    if (isMobileShell) {
      setMobileSidebarOpen(open)
      setSidebarOpen(open)
      return
    }
    setSidebarOpen(open)
  }

  const toggleEffectiveSidebar = () => {
    if (isMobileShell) {
      setEffectiveSidebarOpen(!mobileSidebarOpen)
      return
    }
    toggleSidebar()
  }

  if (!desktopRuntime && h5StartupError) {
    return (
      <H5ConnectionView
        initialServerUrl={h5StartupError.serverUrl}
        error={h5StartupError.message}
        onConnected={() => setBootstrapNonce((value) => value + 1)}
      />
    )
  }

  if (startupError) {
    return <StartupErrorView error={startupError} />
  }

  if (!ready) {
    return (
      <div className="app-shell-viewport flex items-center justify-center bg-[var(--color-surface)] text-[var(--color-token-text-secondary)]">
        {t('app.launching')}
      </div>
    )
  }

  if (traceLaunch.windowMode) {
    return (
      <div className="app-shell-viewport flex overflow-hidden bg-[var(--color-surface)] text-[var(--color-token-foreground)]">
        {traceLaunch.sessionId ? (
          <TraceSession sessionId={traceLaunch.sessionId} standalone />
        ) : (
          <TraceList />
        )}
        <ToastContainer />
      </div>
    )
  }

  return (
    <div
      className={`app-shell app-shell-viewport flex overflow-hidden bg-[var(--color-surface-sidebar)]${isMobileShell ? ' app-shell--mobile' : ''}`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {isMobileShell && effectiveSidebarOpen ? (
        <button
          type="button"
          data-testid="sidebar-backdrop"
          className="app-shell-backdrop fixed inset-0 z-40 border-0 p-0"
          aria-label={t('sidebar.collapse')}
          onClick={() => setEffectiveSidebarOpen(false)}
        />
      ) : null}
      {(showDesktopSidebar || isMobileShell) ? (
        <div
          id="sidebar-shell"
          data-testid="sidebar-shell"
          data-state={effectiveSidebarOpen ? 'open' : 'closed'}
          data-mobile={isMobileShell ? 'true' : 'false'}
          className={`sidebar-shell${isMobileShell ? ' sidebar-shell--mobile' : ''}`}
          {...sidebarHiddenProps}
        >
          {!isMobileShell || effectiveSidebarOpen ? (
            <Sidebar isMobile={isMobileShell} onRequestClose={() => setEffectiveSidebarOpen(false)} />
          ) : null}
        </div>
      ) : null}
      <main
        id="content-area"
        data-sidebar-state={showDesktopSidebar && effectiveSidebarOpen ? 'open' : 'closed'}
        className={`app-shell-main min-w-0 flex-1 flex flex-col overflow-hidden bg-[var(--color-surface)] relative${isSettingsTab ? ' app-shell-main--settings' : ''}${isMobileShell ? ' app-shell-main--mobile' : ''}`}
      >
        {isMobileShell ? (
          <div
            data-testid="mobile-session-header"
            className="flex shrink-0 items-center gap-3 border-b border-[var(--color-token-border)] bg-[var(--color-surface)] px-3 pb-2 pt-[max(env(safe-area-inset-top,0px),44px)]"
          >
            <button
              type="button"
              data-testid="mobile-sidebar-toggle"
              aria-controls="sidebar-shell"
              aria-expanded={effectiveSidebarOpen}
              aria-label={effectiveSidebarOpen ? t('sidebar.collapse') : t('sidebar.expand')}
              onClick={toggleEffectiveSidebar}
	              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-[var(--color-token-foreground)] transition-colors hover:bg-[var(--color-surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-token-focus-border,var(--color-border-focus))]"
            >
              <span className="material-symbols-outlined icon-md">
                {effectiveSidebarOpen ? 'close' : 'menu'}
              </span>
            </button>
            {isActiveChatTab ? (
              <div className="min-w-0 flex-1">
                <h1 className="truncate text-[15px] font-bold leading-tight text-[var(--color-token-foreground)]">
                  {mobileSessionTitle}
                </h1>
                <div className="mt-0.5 flex min-w-0 items-center gap-1.5 overflow-hidden whitespace-nowrap text-[10px] font-medium text-[var(--color-token-text-secondary)]">
                  {activeTab?.status === 'running' ? (
                    <span className="flex shrink-0 items-center gap-1 text-[var(--color-token-text-secondary)]">
                      <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-success)] animate-pulse-dot" />
                      {t('session.active')}
                    </span>
                  ) : null}
                  {activeSession?.messageCount !== undefined && activeSession.messageCount > 0 ? (
                    <>
                      {activeTab?.status === 'running' ? <span aria-hidden="true">·</span> : null}
                      <span>{t('session.messages', { count: activeSession.messageCount })}</span>
                    </>
                  ) : null}
                  {mobileSessionUpdated ? (
                    <>
                      {(activeTab?.status === 'running') || ((activeSession?.messageCount ?? 0) > 0) ? <span aria-hidden="true">·</span> : null}
                      <span className="truncate">{t('session.lastUpdated', { time: mobileSessionUpdated })}</span>
                    </>
                  ) : null}
                </div>
              </div>
            ) : null}
            {isActiveChatTab && (
              <div className="relative flex shrink-0 items-center gap-1">
                <OpenProjectMenu
                  path={activeSession?.workDir || ''}
                  sessionId={activeTabId}
                  variant="environment"
                  externalOpen={envPanelOpen}
                  onExternalClose={() => setEnvPanelOpen(false)}
                  hideTrigger
                  anchorElement={mobileEnvPanelAnchorRef.current}
                />
                <button
                  ref={mobileEnvPanelAnchorRef}
                  type="button"
                  aria-label={t('tasks.toggleSummary')}
                  title={t('tasks.toggleSummary')}
                  onClick={() => setEnvPanelOpen((v) => !v)}
                  data-active={envPanelOpen ? 'true' : 'false'}
                  className={`inline-flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-token-focus-border,var(--color-border-focus))] spring-bounce-btn ${
                    envPanelOpen
                      ? 'bg-[var(--color-surface-hover)] text-[var(--color-token-foreground)] shadow-[0_8px_18px_rgba(0,0,0,0.12)]'
                      : 'text-[var(--color-token-text-secondary)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-token-foreground)]'
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px]">checklist</span>
                </button>
              </div>
            )}
          </div>
        ) : null}

        <ContentRouter />
      </main>
      {!isMobileShell && <WindowControls />}
      <ToastContainer />
      <UpdateChecker />
      <CommandPaletteHost />
    </div>
  )
}

function CommandPaletteHost() {
  const open = useCommandPaletteStore((s) => s.open)
  const close = useCommandPaletteStore((s) => s.closePalette)
  const t = useTranslation()
  const setSidebarOpen = useUIStore((s) => s.setSidebarOpen)
  const sidebarOpen = useUIStore((s) => s.sidebarOpen)
  const toggleTheme = useUIStore((s) => s.toggleTheme)
  const isDark = useUIStore((s) => s.theme) === 'dark'

  const commands = useMemo(() => [
    {
      id: 'new-task',
      label: t('commandPalette.newTask'),
      icon: <MessageSquare size={16} />,
      section: 'suggested' as const,
      keywords: ['new', 'task', 'session'],
      run: () => useSessionStore.getState().setActiveSession(null),
    },
    {
      id: 'toggle-sidebar',
      label: sidebarOpen ? t('commandPalette.hideSidebar') : t('commandPalette.showSidebar'),
      icon: sidebarOpen ? <PanelLeftClose size={16} /> : <PanelLeftOpen size={16} />,
      section: 'panels' as const,
      keywords: ['sidebar', 'panel', 'toggle'],
      run: () => setSidebarOpen(!sidebarOpen),
    },
    {
      id: 'toggle-theme',
      label: isDark ? t('commandPalette.switchLight') : t('commandPalette.switchDark'),
      icon: isDark ? <Sun size={16} /> : <Moon size={16} />,
      section: 'configure' as const,
      keywords: ['theme', 'dark', 'light', 'mode'],
      run: () => toggleTheme(),
    },
    {
      id: 'settings',
      label: t('commandPalette.settings'),
      icon: <Settings size={16} />,
      section: 'configure' as const,
      keywords: ['settings', 'preferences', 'config'],
      run: () => useTabStore.getState().openTab(SETTINGS_TAB_ID, 'Settings', 'settings'),
    },
  ], [t, sidebarOpen, isDark, setSidebarOpen, toggleTheme])

  return <CommandPalette open={open} onClose={close} commands={commands} />
}
