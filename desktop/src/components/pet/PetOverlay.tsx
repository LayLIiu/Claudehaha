import { useEffect, useRef, useCallback, useState } from 'react'
import { usePetStore, getSpritePosition } from '../../stores/petStore'
import { generateDefaultPetSpritesheet } from '../../lib/generateDefaultPet'
import {
  CELL_WIDTH,
  CELL_HEIGHT,
  LOOK_DEGREES,
  type LookDegree,
  type PetManifest,
} from '../../types/pet'

// Display scale for the pet in the UI (pixels on screen)
const PET_DISPLAY_WIDTH = 72   // 192 * 0.375
const PET_DISPLAY_HEIGHT = 78  // 208 * 0.375

// Timeout for click-triggered wave animation
const WAVE_DURATION_MS = 1500

/**
 * PetOverlay renders the animated pet sprite on top of the session view.
 *
 * Architecture:
 * - A <canvas> element draws the current sprite frame by slicing from the
 *   full spritesheet image. This avoids creating dozens of DOM elements.
 * - Animation is driven by requestAnimationFrame + the petStore tick().
 * - Mouse tracking updates the look direction (16-way, 22.5° steps).
 * - The pet's state is automatically derived from the chat session state.
 * - Clicking the pet triggers a wave animation.
 * - Supports loading Codex V2 format custom pets from ~/.codex/pets/.
 */
export function PetOverlay() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const spritesheetRef = useRef<HTMLImageElement | null>(null)
  const rafRef = useRef<number>(0)
  const lastTimeRef = useRef<number>(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const waveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Store selectors
  const enabled = usePetStore((s) => s.enabled)
  const visible = usePetStore((s) => s.visible)
  const scale = usePetStore((s) => s.scale)
  const position = usePetStore((s) => s.position)
  const animation = usePetStore((s) => s.animation)
  const lookDegree = usePetStore((s) => s.lookDegree)
  const showLookDirection = usePetStore((s) => s.showLookDirection)
  const isSpritesheetLoaded = usePetStore((s) => s.isSpritesheetLoaded)
  const activePetId = usePetStore((s) => s.activePetId)
  const loadedPets = usePetStore((s) => s.loadedPets)
  const spritesheetUrls = usePetStore((s) => s.spritesheetUrls)
  const registerPet = usePetStore((s) => s.registerPet)
  const markSpritesheetLoaded = usePetStore((s) => s.markSpritesheetLoaded)
  const tick = usePetStore((s) => s.tick)
  const setLookDegree = usePetStore((s) => s.setLookDegree)
  const setPetState = usePetStore((s) => s.setPetState)

  const [isHovering, setIsHovering] = useState(false)
  const [isWaving, setIsWaving] = useState(false)

  // ── Generate and load default spritesheet ──────────────────

  useEffect(() => {
    const dataUrl = generateDefaultPetSpritesheet()
    const img = new Image()
    img.onload = () => {
      // Only set as active spritesheet if no custom pet is active
      if (!activePetId || activePetId === 'sprout') {
        spritesheetRef.current = img
      }
      registerPet(
        {
          id: 'sprout',
          displayName: 'Sprout',
          description: '一只头顶嫩芽的圆脸小猫伙伴',
          spriteVersionNumber: 2,
          spritesheetPath: '__generated__',
        },
        dataUrl,
      )
      markSpritesheetLoaded()
    }
    img.src = dataUrl
  }, [registerPet, markSpritesheetLoaded, activePetId])

  // ── Load custom pet spritesheet when activePetId changes ───

  useEffect(() => {
    if (!activePetId || activePetId === 'sprout') {
      // Use default pet
      const defaultUrl = spritesheetUrls.get('sprout')
      if (defaultUrl) {
        const img = new Image()
        img.onload = () => {
          spritesheetRef.current = img
          markSpritesheetLoaded()
        }
        img.src = defaultUrl
      }
      return
    }

    // Try to load from registered pets
    const registeredUrl = spritesheetUrls.get(activePetId)
    if (registeredUrl) {
      const img = new Image()
      img.onload = () => {
        spritesheetRef.current = img
        markSpritesheetLoaded()
      }
      img.src = registeredUrl
      return
    }

    // Try to load from Codex pets directory via Electron API
    loadCodexPet(activePetId)
  }, [activePetId, spritesheetUrls, markSpritesheetLoaded])

  // ── Animation loop ─────────────────────────────────────────

  useEffect(() => {
    if (!enabled || !visible || !isSpritesheetLoaded) return

    const animate = (timestamp: number) => {
      if (lastTimeRef.current === 0) {
        lastTimeRef.current = timestamp
      }
      const delta = Math.min(timestamp - lastTimeRef.current, 100) // cap at 100ms
      lastTimeRef.current = timestamp

      tick(delta)
      drawFrame()

      rafRef.current = requestAnimationFrame(animate)
    }

    rafRef.current = requestAnimationFrame(animate)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      lastTimeRef.current = 0
    }
  }, [enabled, visible, isSpritesheetLoaded, tick])

  // ── Draw current frame ─────────────────────────────────────

  const drawFrame = useCallback(() => {
    const canvas = canvasRef.current
    const spritesheet = spritesheetRef.current
    if (!canvas || !spritesheet) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)

    const { state, frameIndex } = animation
    const effectiveLook = (showLookDirection && lookDegree !== null && state === 'idle')
      ? lookDegree
      : null

    const pos = getSpritePosition(state, frameIndex, effectiveLook)

    ctx.drawImage(
      spritesheet,
      pos.x, pos.y, CELL_WIDTH, CELL_HEIGHT,   // source rect
      0, 0, canvas.width, canvas.height,         // dest rect
    )
  }, [animation, lookDegree, showLookDirection])

  // ── Mouse tracking for look direction ──────────────────────

  useEffect(() => {
    if (!enabled || !showLookDirection) return

    const handleMouseMove = (e: MouseEvent) => {
      const container = containerRef.current
      if (!container) return

      const rect = container.getBoundingClientRect()
      const petCx = rect.left + rect.width / 2
      const petCy = rect.top + rect.height / 2

      const dx = e.clientX - petCx
      const dy = e.clientY - petCy

      // If mouse is very close, go neutral
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist < 20) {
        setLookDegree(null)
        return
      }

      // Calculate angle: 0 = up, clockwise
      // In screen coords: up is -Y, right is +X
      let angleDeg = Math.atan2(dx, -dy) * 180 / Math.PI
      if (angleDeg < 0) angleDeg += 360

      // Snap to nearest 22.5° step
      const nearestDegree = findNearestLookDegree(angleDeg)
      setLookDegree(nearestDegree)
    }

    window.addEventListener('mousemove', handleMouseMove)
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [enabled, showLookDirection, setLookDegree])

  // ── Click to wave ──────────────────────────────────────────

  const handlePetClick = useCallback(() => {
    if (isWaving) return
    setIsWaving(true)
    setPetState('waving')

    if (waveTimeoutRef.current) clearTimeout(waveTimeoutRef.current)
    waveTimeoutRef.current = setTimeout(() => {
      setIsWaving(false)
      setPetState('idle')
    }, WAVE_DURATION_MS)
  }, [isWaving, setPetState])

  // Cleanup wave timeout on unmount
  useEffect(() => {
    return () => {
      if (waveTimeoutRef.current) clearTimeout(waveTimeoutRef.current)
    }
  }, [])

  // ── Position classes ───────────────────────────────────────

  const positionClasses: Record<string, string> = {
    'bottom-right': 'bottom-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'bottom-center': 'bottom-4 left-1/2 -translate-x-1/2',
  }

  if (!enabled || !visible || !isSpritesheetLoaded) return null

  const displayW = PET_DISPLAY_WIDTH * scale
  const displayH = PET_DISPLAY_HEIGHT * scale
  const activePet = activePetId ? loadedPets.get(activePetId) : loadedPets.get('sprout')

  return (
    <div
      ref={containerRef}
      className={`pet-overlay fixed z-[35] pointer-events-auto ${positionClasses[position] ?? 'bottom-4 right-4'}`}
      style={{
        width: displayW,
        height: displayH,
      }}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      onClick={handlePetClick}
      title={activePet?.displayName ?? 'Sprout'}
    >
      <canvas
        ref={canvasRef}
        width={CELL_WIDTH}
        height={CELL_HEIGHT}
        className="w-full h-full cursor-pointer"
        style={{
          imageRendering: 'pixelated',
          filter: isHovering ? 'brightness(1.1)' : undefined,
          transition: 'filter 0.2s ease',
        }}
      />
      {/* Pet shadow */}
      <div
        className="pet-shadow absolute bottom-0 left-1/2 -translate-x-1/2 rounded-full bg-black/10"
        style={{
          width: displayW * 0.6,
          height: 4 * scale,
          filter: 'blur(3px)',
        }}
      />
      {/* Pet name tooltip on hover */}
      {isHovering && activePet && (
        <div className="absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-[var(--color-surface)] px-2 py-0.5 text-[10px] font-medium text-[var(--color-token-foreground)] shadow-md border border-[var(--color-token-border)]/40">
          {activePet.displayName}
        </div>
      )}
    </div>
  )
}

// ── Codex custom pet loader ─────────────────────────────────

async function loadCodexPet(petId: string) {
  // In Electron, we could read from ~/.codex/pets/<petId>/
  // For now, we attempt to load from a known path if the runtime supports it
  try {
    const codexHome = window.__CODEX_HOME__ ?? `${window.__HOME__ ?? ''}/.codex`
    const manifestUrl = `${codexHome}/pets/${petId}/pet.json`
    const response = await fetch(manifestUrl)
    if (!response.ok) return
    const manifest: PetManifest = await response.json()

    // Validate it's a V2 pet
    if (manifest.spriteVersionNumber !== 2) return

    const spritesheetUrl = `${codexHome}/pets/${petId}/${manifest.spritesheetPath}`
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const store = usePetStore.getState()
      store.registerPet(manifest, spritesheetUrl)
      // If this is still the active pet, update the spritesheet ref
      if (store.activePetId === petId) {
        store.markSpritesheetLoaded()
      }
    }
    img.src = spritesheetUrl
  } catch {
    // Custom pet not available — that's fine, default will be used
  }
}

// ── Type augmentation for window globals ─────────────────────

declare global {
  interface Window {
    __CODEX_HOME__?: string
    __HOME__?: string
  }
}

// ── Helper: snap angle to nearest look degree ────────────────

function findNearestLookDegree(angleDeg: number): LookDegree {
  let closest: LookDegree = LOOK_DEGREES[0]
  let minDiff = Infinity

  for (const deg of LOOK_DEGREES) {
    let diff = Math.abs(angleDeg - deg)
    if (diff > 180) diff = 360 - diff
    if (diff < minDiff) {
      minDiff = diff
      closest = deg
    }
  }

  return closest
}
