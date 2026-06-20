import { useUIStore, type Toast as ToastType } from '../../stores/uiStore'

const typeDotColor: Record<ToastType['type'], string> = {
  success: 'bg-[var(--color-success)]',
  error: 'bg-[var(--color-error)]',
  warning: 'bg-[var(--color-warning)]',
  info: 'bg-[var(--color-text-accent)]',
}

function ToastItem({ toast }: { toast: ToastType }) {
  const removeToast = useUIStore((s) => s.removeToast)

  return (
    <div
      className={`
        flex items-start gap-2.5
        bg-[var(--color-surface-container-low)] rounded-[var(--radius-lg)] shadow-[var(--shadow-codex-toast)]
        px-4 py-3 text-sm text-[var(--color-token-foreground)]
        animate-in slide-in-from-right fade-in duration-200
      `}
    >
      <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${typeDotColor[toast.type]}`} aria-hidden="true" />
      <span className="min-w-0 flex-1">{toast.message}</span>
      <button
        onClick={() => removeToast(toast.id)}
        className="shrink-0 text-[var(--color-token-text-secondary)] hover:text-[var(--color-token-foreground)] text-lg leading-none transition-colors"
      >
        ×
      </button>
    </div>
  )
}

export function ToastContainer() {
  const toasts = useUIStore((s) => s.toasts)

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </div>
  )
}
