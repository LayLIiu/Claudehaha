import type { ReactNode } from 'react'

/**
 * SettingsCard — ZCode-style grouped settings container.
 * Wraps multiple SettingsRow items in a rounded card with border.
 *
 * Usage:
 *   <SettingsCard>
 *     <SettingsRow label="Theme" description="Choose your appearance">
 *       <select ... />
 *     </SettingsRow>
 *     <SettingsRow label="Language" description="Interface language">
 *       <select ... />
 *     </SettingsRow>
 *   </SettingsCard>
 */
export function SettingsCard({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={`settings-card ${className ?? ''}`}>
      {children}
    </div>
  )
}

/**
 * SettingsRow — ZCode-style settings row with label/description on left and control on right.
 * Uses CSS grid: `grid-cols-[minmax(0,1fr)_auto]` so controls size naturally.
 *
 * For toggle/checkbox rows where the control is a switch on the right:
 *   <SettingsRow label="..." description="...">
 *     <ToggleSwitch ... />
 *   </SettingsRow>
 *
 * For full-width content rows (e.g. a segmented control that spans the whole width):
 *   <SettingsRow label="..." description="..." full>
 *     <SegmentedControl ... />
 *   </SettingsRow>
 */
export function SettingsRow({
  label,
  description,
  children,
  full,
  className,
}: {
  label?: ReactNode
  description?: ReactNode
  children: ReactNode
  /** When true, children span the full width below the label (no right-aligned grid) */
  full?: boolean
  className?: string
}) {
  if (full) {
    return (
      <div className={`settings-row ${className ?? ''}`}>
        {label && <div className="settings-row-label">{label}</div>}
        {description && <div className="settings-row-description">{description}</div>}
        <div className="mt-3">
          {children}
        </div>
      </div>
    )
  }

  return (
    <div className={`settings-row grid items-center gap-4 grid-cols-[minmax(0,1fr)_auto] ${className ?? ''}`}>
      <div className="min-w-0">
        {label && <div className="settings-row-label">{label}</div>}
        {description && <div className="settings-row-description">{description}</div>}
      </div>
      <div className="settings-row-control">
        {children}
      </div>
    </div>
  )
}
