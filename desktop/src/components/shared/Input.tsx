import type { InputHTMLAttributes } from 'react'

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string
  error?: string
  required?: boolean
}

export function Input({ label, error, required, className = '', id, ...props }: InputProps) {
  const inputId = id || label?.toLowerCase().replace(/\s+/g, '-')
  return (
    <div className="settings-field-group flex flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className="text-[12px] font-semibold tracking-[0.01em] text-[var(--color-token-text-secondary)]">
          {label}
          {required && <span className="text-[var(--color-error)] ml-0.5">*</span>}
        </label>
      )}
      <input
        id={inputId}
        className={`
          settings-input h-10 px-3 rounded-[var(--radius-lg)] border text-sm
          bg-[var(--color-surface)] text-[var(--color-token-foreground)]
          placeholder:text-[var(--color-token-text-secondary)]
          transition-[border-color,background-color,box-shadow] duration-150
          ${error
            ? 'border-[var(--color-error)] focus:shadow-[var(--shadow-error-ring)]'
            : 'border-[var(--color-token-border)] focus:border-[var(--color-token-focus-border,var(--color-border-focus))] focus:shadow-[var(--shadow-focus-ring)]'
          }
          outline-none
          ${className}
        `}
        {...props}
      />
      {error && <p className="text-[11px] leading-5 text-[var(--color-error)]">{error}</p>}
    </div>
  )
}
