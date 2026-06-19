import { useState, useRef, useEffect, type CSSProperties, type ReactNode } from 'react'

type DropdownItem<T extends string> = {
  value: T
  label: string
  description?: string
  icon?: ReactNode
}

type DropdownProps<T extends string> = {
  items: DropdownItem<T>[]
  value: T
  onChange: (value: T) => void
  trigger: ReactNode
  width?: CSSProperties['width']
  maxHeight?: CSSProperties['maxHeight']
  align?: 'left' | 'right'
  className?: string
}

export function Dropdown<T extends string>({
  items,
  value,
  onChange,
  trigger,
  width = 320,
  maxHeight,
  align = 'left',
  className = '',
}: DropdownProps<T>) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
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

  return (
    <div ref={ref} className={`relative ${className || 'inline-block'}`}>
      <div onClick={() => setOpen(!open)} className="cursor-pointer">
        {trigger}
      </div>

      {open && (
        <div
          className={`
            absolute z-50 mt-1.5 rounded-[var(--radius-xl)]
            bg-[var(--color-token-bg-subtle,rgba(255,255,255,0.04))] border border-[var(--color-token-border)]
            shadow-[var(--shadow-dropdown)] backdrop-blur-xl
            animate-in fade-in slide-in-from-top-1
            ${maxHeight ? 'overflow-y-auto' : 'overflow-hidden'}
            ${align === 'right' ? 'right-0' : 'left-0'}
          `}
          style={{ width, maxHeight }}
        >
          {items.map((item, i) => (
            <button
              key={item.value}
              onClick={() => { onChange(item.value); setOpen(false) }}
              className={`
                w-full flex items-center gap-3 px-3.5 py-3 text-left transition-colors
                hover:bg-[var(--color-surface-hover)] focus-visible:outline-none focus-visible:bg-[var(--color-surface-hover)]
                ${item.value === value ? 'bg-[var(--color-model-option-selected-bg)]' : ''}
                ${i > 0 ? 'border-t border-[var(--color-token-border)]' : ''}
              `}
            >
              {item.icon && <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center text-[var(--color-token-text-secondary)]">{item.icon}</span>}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-[var(--color-token-foreground)]">{item.label}</div>
                {item.description && (
                  <div className="text-xs text-[var(--color-token-text-secondary)] mt-0.5">{item.description}</div>
                )}
              </div>
              {item.value === value && (
                <span className="material-symbols-outlined icon-sm flex-shrink-0 text-[var(--color-brand)]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
