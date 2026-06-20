import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

type ModalProps = {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  width?: number
  footer?: ReactNode
}

export function Modal({ open, onClose, title, children, width = 560, footer }: ModalProps) {
  useEffect(() => {
    if (!open) return
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleEsc)
    return () => document.removeEventListener('keydown', handleEsc)
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-[var(--color-overlay-scrim)] transition-opacity duration-200"
        onClick={onClose}
      />

      {/* Modal content — Codex-style: rounded-3xl + 0.5px ring + backdrop-blur */}
	      <div
		        className="liquid-glass glass-panel relative rounded-[var(--radius-3xl)] max-h-[85vh] flex flex-col overflow-hidden"
	        style={{ width, maxWidth: 'calc(100vw - 48px)' }}
	        role="dialog"
	        aria-modal="true"
	        aria-label={title}
	      >
	        {title && (
	          <div className="flex items-start justify-between gap-4 px-5 pt-5 pb-0">
	            <h2 className="text-lg font-semibold text-[var(--color-token-foreground)]">{title}</h2>
	            <button
	              type="button"
	              onClick={onClose}
	              aria-label="Close dialog"
	              className="absolute top-4 right-4 flex h-8 w-8 shrink-0 items-center justify-center rounded p-1 text-[var(--color-token-text-secondary)]/80 transition-colors hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-token-foreground)]"
	            >
	              <span className="material-symbols-outlined icon-md">close</span>
	            </button>
	          </div>
	        )}

	        <div className="px-5 py-5 overflow-y-auto flex-1">
	          {children}
	        </div>

	        {footer && (
	          <div className="px-5 pb-5 pt-0 flex items-center justify-end gap-3">
	            {footer}
	          </div>
	        )}
      </div>
    </div>,
    document.body,
  )
}
