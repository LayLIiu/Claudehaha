import { useUIStore } from '../../stores/uiStore'
import { useTranslation } from '../../i18n'

const isWindows = typeof navigator !== 'undefined' && /Win/i.test(navigator.platform || navigator.userAgent)

export function TitleBar() {
  const { activeView, setActiveView } = useUIStore()
  const t = useTranslation()

  return (
    <div
      className="h-[var(--titlebar-height)] flex items-center border-b border-[var(--color-token-border)] bg-[var(--color-surface)] select-none"
      data-desktop-drag-region
    >
      {/* Windows: window controls on left (138px); macOS: traffic light spacer (78px) */}
      <div className={`${isWindows ? 'w-[138px]' : 'w-[78px]'} flex-shrink-0`} data-desktop-drag-region />

      {/* Logo */}
      <div className="flex items-center gap-2 mr-4" data-desktop-drag-region>
        <span className="text-xs font-bold tracking-wider text-[var(--color-brand)] uppercase">Claude Code Companion</span>
      </div>

      {/* Navigation arrows */}
      <div className="flex items-center gap-1 mr-4">
        <button className="p-1 rounded-[var(--radius-md)] text-[var(--color-token-text-secondary)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-token-foreground)] transition-colors">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <button className="p-1 rounded-[var(--radius-md)] text-[var(--color-token-text-secondary)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-token-foreground)] transition-colors">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
      </div>

      {/* Center tabs */}
      <div className="flex-1 flex items-center justify-center gap-1" data-desktop-drag-region>
        <TabButton
          active={activeView === 'code'}
          onClick={() => setActiveView('code')}
          icon="code"
        >
          {t('titlebar.code')}
        </TabButton>
        <TabButton
          active={activeView === 'terminal'}
          onClick={() => setActiveView('terminal')}
          icon="terminal"
        >
          {t('titlebar.terminal')}
        </TabButton>
        <TabButton
          active={activeView === 'history'}
          onClick={() => setActiveView('history')}
          icon="history"
        >
          {t('titlebar.history')}
        </TabButton>
      </div>

      {/* Right: Settings */}
      <div className="flex items-center gap-2 mr-4">
        <button className="p-1.5 rounded-[var(--radius-md)] text-[var(--color-token-text-secondary)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-token-foreground)] transition-colors">
          <span className="material-symbols-outlined icon-md">settings</span>
        </button>
      </div>
    </div>
  )
}

function TabButton({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean
  onClick: () => void
  icon: string
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`
        flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-[var(--radius-md)] transition-colors duration-200
        ${active
          ? 'bg-[var(--color-surface-selected)] text-[var(--color-token-foreground)]'
          : 'text-[var(--color-token-text-secondary)] hover:text-[var(--color-token-foreground)]'
        }
      `}
    >
      <span className="material-symbols-outlined icon-sm">{icon}</span>
      {children}
    </button>
  )
}
