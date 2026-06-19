import { useState, useRef, useEffect } from 'react'
import DOMPurify from 'dompurify'
import { useSettingsStore } from '../../stores/settingsStore'
import { useChatStore } from '../../stores/chatStore'
import { useSessionStore } from '../../stores/sessionStore'
import { useTabStore } from '../../stores/tabStore'
import { useTranslation } from '../../i18n'
import type { PermissionMode } from '../../types/settings'
import { useMobileViewport } from '../../hooks/useMobileViewport'
import { isDesktopRuntime } from '../../lib/desktopRuntime'
import { MobileBottomSheet } from '../shared/MobileBottomSheet'
import { ActionDialog } from '../shared/ActionDialog'

const MODE_ICONS: Record<PermissionMode, string> = {
  default: 'verified_user',
  acceptEdits: 'bolt',
  plan: 'architecture',
  bypassPermissions: 'gavel',
  dontAsk: 'gavel',
}

type Props = {
  workDir?: string
  compact?: boolean
  /** Controlled mode: override current value */
  value?: PermissionMode
  /** Controlled mode: called on change instead of updating global store */
  onChange?: (mode: PermissionMode) => void
}

export function PermissionModeSelector({ workDir: workDirProp, compact = false, value, onChange }: Props = {}) {
  const t = useTranslation()
  const isMobile = useMobileViewport() && !isDesktopRuntime()
  const { permissionMode: storeMode } = useSettingsStore()
  const setSessionPermissionMode = useChatStore((s) => s.setSessionPermissionMode)
  const activeTabId = useTabStore((s) => s.activeTabId)
  const sessions = useSessionStore((s) => s.sessions)
  const [open, setOpen] = useState(false)
  const [confirmDialog, setConfirmDialog] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const isControlled = value !== undefined
  const PERMISSION_ITEMS: Array<{
    value: PermissionMode
    label: string
    description: string
    icon: string
    color?: string
  }> = [
    {
      value: 'default',
      label: t('permMode.askPermissions'),
      description: t('permMode.askPermDesc'),
      icon: 'verified_user',
    },
    {
      value: 'acceptEdits',
      label: t('permMode.autoAccept'),
      description: t('permMode.autoAcceptDesc'),
      icon: 'bolt',
    },
    {
      value: 'plan',
      label: t('permMode.planMode'),
      description: t('permMode.planModeDesc'),
      icon: 'architecture',
      color: 'text-[var(--color-token-text-secondary)]',
    },
    {
      value: 'bypassPermissions',
      label: t('permMode.bypass'),
      description: t('permMode.bypassDesc'),
      icon: 'gavel',
      color: 'text-[var(--color-error)]',
    },
  ]

  const MODE_LABELS: Record<PermissionMode, string> = {
    default: t('permMode.label.default'),
    acceptEdits: t('permMode.label.acceptEdits'),
    plan: t('permMode.label.plan'),
    bypassPermissions: t('permMode.label.bypassPermissions'),
    dontAsk: t('permMode.label.dontAsk'),
  }

  const activeSession = activeTabId
    ? sessions.find((s) => s.id === activeTabId)
    : null
  const currentMode = isControlled
    ? value
    : (activeSession?.permissionMode as PermissionMode | undefined) || storeMode
  const workDir = workDirProp || activeSession?.workDir || '~'
  const compactButtonClass = compact
    ? isMobile
      ? 'h-11 w-11 justify-center rounded-xl p-0'
      : 'h-8 w-8 justify-center rounded-full p-0'
    : 'gap-1.5 rounded-full px-1.5 py-1.5 text-xs'
  const menuId = 'permission-mode-menu'

  useEffect(() => {
    if (!open) return
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node
      if (
        ref.current &&
        !ref.current.contains(target) &&
        !menuRef.current?.contains(target)
      ) {
        setOpen(false)
      }
    }
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleEsc)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleEsc)
    }
  }, [open])

  const permissionOptions = (
    <div id={menuId} ref={menuRef} role="menu">
      {PERMISSION_ITEMS.map((item) => (
        <button
          key={item.value}
          role="menuitem"
          onClick={() => {
            if (item.value === 'bypassPermissions') {
              setOpen(false)
              setConfirmDialog(true)
              return
            }
            if (isControlled) {
              onChange?.(item.value)
            } else {
              if (activeTabId) setSessionPermissionMode(activeTabId, item.value)
            }
            setOpen(false)
          }}
          className={`
            sidebar-codex-menu-item items-start gap-2.5 rounded-[var(--radius-lg)] px-3 py-2
            ${item.value === currentMode ? 'bg-white/[0.085]' : ''}
          `}
        >
          <span className={`material-symbols-outlined mt-0.5 text-[20px] ${item.color || 'text-[var(--color-token-text-secondary)]'}`}>
            {item.icon}
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-[var(--color-token-foreground)]">{item.label}</div>
            <div className="mt-0.5 text-xs text-[var(--color-token-text-secondary)]">{item.description}</div>
          </div>
          {item.value === currentMode && (
            <span className="material-symbols-outlined icon-sm text-[var(--color-brand)]" style={{ fontVariationSettings: "'FILL' 1" }}>
              check_circle
            </span>
          )}
        </button>
      ))}
    </div>
  )

  const menuContent = (
    <>
      <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-[var(--color-token-text-secondary)]">
        {t('permMode.executionPermissions')}
      </div>
      {permissionOptions}
    </>
  )

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        aria-label={MODE_LABELS[currentMode]}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        title={compact ? MODE_LABELS[currentMode] : undefined}
        className={`flex items-center bg-transparent font-semibold text-[var(--color-token-text-secondary)] transition-colors hover:bg-white/[0.055] hover:text-[var(--color-token-foreground)] ${
          currentMode === 'bypassPermissions' ? 'text-[#ff8a4c] hover:text-[#ff9b66]' : ''
        } ${compactButtonClass}`}
      >
        <span className="material-symbols-outlined icon-sm">{MODE_ICONS[currentMode]}</span>
        {!compact && (
          <>
            <span>{MODE_LABELS[currentMode]}</span>
            <span className="material-symbols-outlined icon-2xs">expand_more</span>
          </>
        )}
      </button>

      {open && (
        isMobile ? (
          <MobileBottomSheet
            open={open}
            onClose={() => setOpen(false)}
            title={t('permMode.executionPermissions')}
            closeLabel={t('tabs.close')}
            ariaLabel={t('permMode.executionPermissions')}
            contentClassName="py-2"
          >
            {permissionOptions}
          </MobileBottomSheet>
        ) : (
          <div id={menuId} ref={menuRef} role="menu" className="sidebar-codex-menu glass-panel absolute bottom-full left-0 z-50 mb-2 w-[320px] rounded-[var(--radius-2xl)] p-1.5 shadow-[var(--shadow-dropdown)]">
            {menuContent}
          </div>
        )
      )}

      <ActionDialog
        open={confirmDialog}
        onClose={() => setConfirmDialog(false)}
        title={t('permMode.enableBypassTitle')}
        width={420}
        body={(
          <div className="space-y-3">
            <p className="text-xs font-medium text-[var(--color-error)]">
              {t('permMode.enableBypassSubtitle')}
            </p>
            <p
              className="text-xs leading-relaxed text-[var(--color-token-text-secondary)]"
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(t('permMode.enableBypassBody')) }}
            />
            <div className="flex items-center gap-2 rounded-lg border border-[var(--color-token-border)] bg-[var(--color-surface-container)] px-3 py-2" title={workDir}>
              <span className="material-symbols-outlined icon-sm text-[var(--color-token-text-secondary)]">folder</span>
              <code className="truncate text-xs font-[var(--font-mono)] text-[var(--color-token-foreground)]">{workDir}</code>
            </div>
            <ul className="space-y-1.5 text-xs text-[var(--color-token-text-secondary)]">
              <li className="flex items-start gap-2">
                <span className="material-symbols-outlined mt-0.5 text-[14px] text-[var(--color-error)]">check</span>
                {t('permMode.permReadWrite')}
              </li>
              <li className="flex items-start gap-2">
                <span className="material-symbols-outlined mt-0.5 text-[14px] text-[var(--color-error)]">check</span>
                {t('permMode.permShell')}
              </li>
              <li className="flex items-start gap-2">
                <span className="material-symbols-outlined mt-0.5 text-[14px] text-[var(--color-error)]">check</span>
                {t('permMode.permPackages')}
              </li>
            </ul>
          </div>
        )}
        actions={[
          {
            label: t('common.cancel'),
            onClick: () => setConfirmDialog(false),
            variant: 'secondary',
          },
          {
            label: t('permMode.enableBypassBtn'),
            onClick: () => {
              if (isControlled) {
                onChange?.('bypassPermissions')
              } else if (activeTabId) {
                setSessionPermissionMode(activeTabId, 'bypassPermissions')
              }
              setConfirmDialog(false)
            },
            variant: 'danger',
          },
        ]}
      />
    </div>
  )
}
