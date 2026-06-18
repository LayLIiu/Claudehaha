import { useState, useEffect } from 'react'
import { getDesktopHost } from '../../lib/desktopHost'
import type { DesktopHost } from '../../lib/desktopHost'
import { useUIStore } from '../../stores/uiStore'
import { useTabStore, SETTINGS_TAB_ID } from '../../stores/tabStore'
import { useChatStore } from '../../stores/chatStore'
import { useSessionStore } from '../../stores/sessionStore'

const isMacOS = typeof navigator !== 'undefined' && /Mac/.test(navigator.platform)
const isWindows = typeof navigator !== 'undefined' && /Win/.test(navigator.platform)
const desktopHost = getDesktopHost()
const isDesktopRuntime = desktopHost.isDesktop

/** Whether to render custom window controls */
export const showWindowControls = isDesktopRuntime && (isMacOS || (isWindows && desktopHost.capabilities.windowControls))

/* ── Main component ────────────────────────────────────────────── */

export function WindowControls() {
  const [maximized, setMaximized] = useState(false)
  const [win, setWin] = useState<DesktopHost['window'] | null>(null)

  // Hooks for macOS sidebar controls
  const sidebarOpen = useUIStore((s) => s.sidebarOpen)
  const toggleSidebar = useUIStore((s) => s.toggleSidebar)
  const setSidebarOpen = useUIStore((s) => s.setSidebarOpen)
  const activeTabId = useTabStore((s) => s.activeTabId)
  const createSession = useSessionStore((s) => s.createSession)

  useEffect(() => {
    if (!isDesktopRuntime) return
    let unlisten: (() => void) | undefined
    let cancelled = false

    const w = desktopHost.window
    if (!w) return

    setWin(w)
    void w.isMaximized()
      .then((nextMaximized) => {
        if (!cancelled) setMaximized(nextMaximized)
      })
      .catch(() => {})
    void w.onResized(() => {
      void w.isMaximized()
        .then((nextMaximized) => {
          if (!cancelled) setMaximized(nextMaximized)
        })
        .catch(() => {})
    })
      .then((fn) => { unlisten = fn })
      .catch(() => {})

    return () => {
      cancelled = true
      unlisten?.()
    }
  }, [])

  const runWindowAction = (action: () => Promise<void>) => {
    void action().catch((error) => {
      console.error('Window control action failed', error)
    })
  }

  if (!isDesktopRuntime) return null

  // ── macOS: native traffic lights from hiddenInset titleBar, only render sidebar controls ──
  if (isMacOS) {
    const isSettingsPage = activeTabId === SETTINGS_TAB_ID

    const handleSidebarToggle = () => {
      if (isSettingsPage && !sidebarOpen) {
        const prevSession = useUIStore.getState().settingsEntrySessionId
        useTabStore.getState().closeTab(SETTINGS_TAB_ID)
        if (prevSession) {
          useTabStore.getState().setActiveTab(prevSession)
          useChatStore.getState().connectToSession(prevSession)
        }
        setSidebarOpen(true)
      } else {
        toggleSidebar()
      }
    }

    return (
      <div
        data-testid="window-controls"
        className="window-traffic-light-zone fixed top-0 left-0 z-[110] flex items-center pl-[80px] h-[34px] pt-[3px]"
      >
        {/* Sidebar toggle: hidden on settings page (back button is in settings sidebar) */}
        {!isSettingsPage && (
          <button
            type="button"
            onClick={handleSidebarToggle}
            aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
            title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
            className="flex h-[26px] w-[26px] items-center justify-center rounded-md text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 0, 'wght' 300" }}>
              {sidebarOpen ? 'menu_open' : 'menu'}
            </span>
          </button>
        )}

        {/* New conversation: sidebar closed & not on settings page */}
        {!sidebarOpen && !isSettingsPage && (
          <button
            type="button"
            onClick={() => {
              createSession().then((id) => {
                useTabStore.getState().openTab(id, 'New Session')
                useChatStore.getState().connectToSession(id)
              }).catch(() => {})
            }}
            aria-label="New conversation"
            title="New conversation"
            className="flex h-[26px] w-[26px] items-center justify-center rounded-md text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
          </button>
        )}
      </div>
    )
  }

  // ── Windows window controls (existing) ────────────────────────
  if (!win) return null
  if (!isWindows || !desktopHost.capabilities.windowControls) return null

  return (
    <div
      data-testid="window-controls"
      className="window-traffic-light-zone fixed top-0 right-0 z-[110] flex h-[34px] items-stretch flex-shrink-0"
    >
      {/* Minimize */}
      <button
        onClick={() => runWindowAction(() => win.minimize())}
        aria-label="Minimize window"
        className="w-[46px] h-full flex items-center justify-center text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] transition-colors"
      >
        <svg width="10" height="1" viewBox="0 0 10 1">
          <rect width="10" height="1" fill="currentColor" />
        </svg>
      </button>

      {/* Maximize / Restore */}
      <button
        onClick={() => runWindowAction(() => win.toggleMaximize())}
        aria-label={maximized ? 'Restore window' : 'Maximize window'}
        className="w-[46px] h-full flex items-center justify-center text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] transition-colors"
      >
        {maximized ? (
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1">
            <rect x="0" y="3" width="7" height="7" />
            <polyline points="3,3 3,0 10,0 10,7 7,7" />
          </svg>
        ) : (
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1">
            <rect x="0.5" y="0.5" width="9" height="9" />
          </svg>
        )}
      </button>

      {/* Close */}
      <button
        onClick={() => runWindowAction(() => win.close())}
        aria-label="Close window"
        className="w-[46px] h-full flex items-center justify-center text-[var(--color-text-secondary)] hover:bg-[var(--color-window-close-hover)] hover:text-white transition-colors"
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.2">
          <line x1="0" y1="0" x2="10" y2="10" />
          <line x1="10" y1="0" x2="0" y2="10" />
        </svg>
      </button>
    </div>
  )
}
