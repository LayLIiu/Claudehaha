import { useState, useCallback } from 'react'

const BASE = import.meta.env.BASE_URL

/**
 * Clawd the Crab persona – pixel-art GIF pair, click to toggle.
 *
 * Two GIFs are stacked; clicking toggles between them.
 * When two *different* GIF files are used the switch is visible.
 * Currently both point to the same local GIF, so replace the files
 * in public/images/clawd/persona/ for distinct animations.
 */
export function ClawdPersona({
  width,
  height,
  className,
}: {
  width: number
  height: number
  className?: string
}) {
  const [showSecond, setShowSecond] = useState(false)

  const toggle = useCallback(() => setShowSecond(v => !v), [])

  return (
    <div
      className={className}
      aria-hidden="true"
      onClick={toggle}
      style={{ cursor: 'pointer' }}
    >
      <div className="relative [&_img]:[image-rendering:pixelated]">
        <img
          src={`${BASE}images/clawd/persona/ac0fa108.gif`}
          alt=""
          width={width}
          height={height}
          className={showSecond ? 'invisible' : undefined}
          style={{ imageRendering: 'pixelated' }}
        />
        <img
          src={`${BASE}images/clawd/persona/7bbe5052.gif`}
          alt=""
          width={width}
          height={height}
          className={`absolute inset-0 ${showSecond ? '' : 'invisible'}`}
          style={{ imageRendering: 'pixelated' }}
        />
      </div>
    </div>
  )
}
