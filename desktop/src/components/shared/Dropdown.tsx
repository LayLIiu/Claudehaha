import { useState, useRef, useEffect, useLayoutEffect, type CSSProperties, type ReactNode } from 'react'
import { useGlassPanelAnimation } from '../../hooks/useGlassPanelAnimation'

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
  const [popupPos, setPopupPos] = useState<CSSProperties | null>(null)
  const triggerRef = useRef<HTMLDivElement>(null)
  const popupRef = useRef<HTMLDivElement>(null)
  const { animatingOut, requestClose } = useGlassPanelAnimation(() => setOpen(false))

  // Compute fixed position so the popup is never clipped by ancestor overflow:hidden
  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    // When width is a percentage, resolve it against the trigger width
    const resolvedWidth = typeof width === 'string' && width.endsWith('%')
      ? rect.width
      : width
    const pos: CSSProperties = {
      position: 'fixed',
      top: rect.bottom + 6, // matches original mt-1.5
      width: resolvedWidth,
      maxHeight,
      zIndex: 50,
    }
    if (align === 'right') {
      pos.right = window.innerWidth - rect.right
    } else {
      pos.left = rect.left
    }
    setPopupPos(pos)
  }, [open, width, maxHeight, align])

  // Flip upward if the popup would overflow the viewport bottom
  useLayoutEffect(() => {
    if (!open || !popupRef.current || !popupPos) return
    const popupRect = popupRef.current.getBoundingClientRect()
    if (popupRect.bottom > window.innerHeight) {
      const triggerRect = triggerRef.current!.getBoundingClientRect()
      const newTop = triggerRect.top - popupRect.height - 6
      setPopupPos((prev) => prev ? { ...prev, top: Math.max(8, newTop) } : prev)
    }
  }, [open, popupPos])

  // Close on outside click or Escape
  useEffect(() => {
    if (!open) return
    const handleClick = (e: MouseEvent) => {
      if (
        triggerRef.current && !triggerRef.current.contains(e.target as Node) &&
        popupRef.current && !popupRef.current.contains(e.target as Node)
      ) {
        requestClose()
      }
    }
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') requestClose()
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleEsc)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleEsc)
    }
  }, [open, requestClose])

  return (
    <div ref={triggerRef} className={className || 'inline-block'}>
      <div onClick={() => { if (open) requestClose(); else setOpen(true) }} className="cursor-pointer">
        {trigger}
      </div>

      {open && popupPos && (
        <div
          ref={popupRef}
          className={`
            liquid-glass glass-panel overflow-hidden rounded-[var(--radius-2xl)] p-1.5
            shadow-[var(--shadow-dropdown)]
            ${animatingOut ? 'glass-animate-exit' : ''}
            ${maxHeight ? 'overflow-y-auto' : ''}
          `}
          style={popupPos}
        >
          {items.map((item) => (
            <button
              key={item.value}
              onClick={() => { onChange(item.value); requestClose() }}
              className={`
                w-full flex items-center gap-3 px-3.5 py-2.5 text-left rounded-[var(--radius-lg)] transition-colors
                hover:bg-[rgba(255,255,255,0.04)] focus-visible:outline-none focus-visible:bg-[rgba(255,255,255,0.04)]
                ${item.value === value ? 'bg-white/[0.085]' : ''}
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
