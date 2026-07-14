import { FolderOpen, Globe, Maximize2, PanelRightClose } from 'lucide-react'
import { useTranslation } from '../../i18n'
import { useWorkspacePanelStore, type WorkbenchMode } from '../../stores/workspacePanelStore'
import { useBrowserPanelStore } from '../../stores/browserPanelStore'
import { BrowserSurface } from '../browser/BrowserSurface'
import { WorkspacePanel } from '../workspace/WorkspacePanel'

type WorkbenchPanelProps = {
  sessionId: string
  variant?: 'panel' | 'tab'
  onClose?: () => void
}

type ModeItem = {
  mode: WorkbenchMode
  labelKey: string
  Icon: typeof FolderOpen
}

const MODE_ITEMS: ModeItem[] = [
  { mode: 'workspace', labelKey: 'workbench.modeWorkspace', Icon: FolderOpen },
  { mode: 'browser', labelKey: 'workbench.modeBrowser', Icon: Globe },
]

export function WorkbenchPanel({ sessionId, variant = 'panel', onClose }: WorkbenchPanelProps) {
  const t = useTranslation()
  const mode = useWorkspacePanelStore((state) => state.getMode(sessionId))
  const setMode = useWorkspacePanelStore((state) => state.setMode)
  const closePanel = useWorkspacePanelStore((state) => state.closePanel)
  const ensureBlankBrowser = useBrowserPanelStore((state) => state.ensureBlank)
  const isTabVariant = variant === 'tab'

  const handleModeSelect = (nextMode: WorkbenchMode) => {
    if (nextMode === 'browser') {
      ensureBlankBrowser(sessionId)
    }
    setMode(sessionId, nextMode)
  }

  const handleExpand = () => {
    if (mode !== 'browser') {
      setMode(sessionId, 'browser')
    }
    ensureBlankBrowser(sessionId)
  }

  const handleClose = () => {
    if (onClose) {
      onClose()
      return
    }
    closePanel(sessionId)
  }

  return (
    <div className="relative flex h-full min-h-0 w-full flex-col rounded-2xl bg-[var(--color-surface)]">
      <button
        type="button"
        aria-label={t('workbench.close')}
        onClick={handleClose}
        className="absolute right-4 top-[9px] z-10 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-sm)] text-[var(--color-token-text-secondary)] transition-colors hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-token-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand)]/35"
      >
        <PanelRightClose size={15} strokeWidth={1.9} aria-hidden="true" />
      </button>
      <div className="flex h-[50px] shrink-0 items-center gap-2 border-b border-[var(--color-token-border)] bg-[var(--color-surface)] pl-2.5 pr-12">
        <div
          role="tablist"
          aria-label={t('workbench.modeSwitch')}
          className="inline-flex min-w-0 shrink items-center gap-0.5 rounded-[var(--radius-sm)] border border-[var(--color-token-border)] bg-[var(--color-surface)] p-0.5 overflow-hidden"
        >
          {MODE_ITEMS.map(({ mode: itemMode, labelKey, Icon }) => {
            const isActive = mode === itemMode
            return (
              <button
                key={itemMode}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => handleModeSelect(itemMode)}
                className={`inline-flex h-7 items-center gap-1.5 rounded-[var(--radius-xs)] px-2.5 text-[12px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand)]/35 ${
                  isActive
                    ? 'bg-[var(--color-surface-selected)] text-[var(--color-token-foreground)] shadow-[inset_0_0_0_1px_var(--color-token-focus-border,var(--color-border-focus))]'
                    : 'text-[var(--color-token-text-secondary)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-token-foreground)]'
                }`}
              >
                <Icon size={15} strokeWidth={2} aria-hidden="true" className="shrink-0" />
                <span>{t(labelKey)}</span>
              </button>
            )
          })}
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-1">
          {!isTabVariant && (
            <button
              type="button"
              aria-label={t('workbench.expand')}
              title={t('workbench.expand')}
              onClick={handleExpand}
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-sm)] text-[var(--color-token-text-secondary)] transition-colors hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-token-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand)]/35"
            >
              <Maximize2 size={15} strokeWidth={2} aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col bg-[var(--color-surface)] overflow-hidden">
        {mode === 'browser' ? (
          <BrowserSurface sessionId={sessionId} />
        ) : (
          <WorkspacePanel sessionId={sessionId} embedded forceVisible={isTabVariant} />
        )}
      </div>
    </div>
  )
}
