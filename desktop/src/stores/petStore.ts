import { create } from 'zustand'
import {
  type PetState,
  type PetManifest,
  type LookDegree,
  PET_STATE_DURATIONS,
  PET_STATE_FRAMES,
  PET_STATE_ROW,
  CELL_WIDTH,
  CELL_HEIGHT,
  LOOK_DEGREES,
} from '../types/pet'

const PET_STORE_KEY = 'cc-haha-pet-settings'

// ── Persistence helpers ──────────────────────────────────────

type PetSettings = {
  enabled: boolean
  activePetId: string | null
  scale: number
  position: 'bottom-right' | 'bottom-left' | 'bottom-center'
  showLookDirection: boolean
}

function loadSettings(): PetSettings {
  try {
    const raw = localStorage.getItem(PET_STORE_KEY)
    if (raw) return { ...defaultSettings, ...JSON.parse(raw) }
  } catch { /* noop */ }
  return defaultSettings
}

function saveSettings(settings: PetSettings) {
  try { localStorage.setItem(PET_STORE_KEY, JSON.stringify(settings)) } catch { /* noop */ }
}

const defaultSettings: PetSettings = {
  enabled: true,
  activePetId: 'sprout',
  scale: 1,
  position: 'bottom-right',
  showLookDirection: true,
}

// ── Animation frame tracker ──────────────────────────────────

type AnimationState = {
  state: PetState
  frameIndex: number
  elapsed: number       // ms since frame started
  totalElapsed: number  // ms since animation started
}

// ── Store definition ─────────────────────────────────────────

type PetStore = {
  // Settings (persisted)
  enabled: boolean
  activePetId: string | null
  scale: number
  position: 'bottom-right' | 'bottom-left' | 'bottom-center'
  showLookDirection: boolean

  // Runtime state (not persisted)
  animation: AnimationState
  lookDegree: LookDegree | null  // null = neutral/front (falls back to idle)
  loadedPets: Map<string, PetManifest>
  spritesheetUrls: Map<string, string>  // petId -> object URL
  isSpritesheetLoaded: boolean
  visible: boolean  // pet visibility in current view

  // Actions
  setEnabled: (enabled: boolean) => void
  setActivePet: (petId: string | null) => void
  setScale: (scale: number) => void
  setPosition: (position: PetSettings['position']) => void
  setShowLookDirection: (show: boolean) => void
  setPetState: (state: PetState) => void
  setLookDegree: (degree: LookDegree | null) => void
  registerPet: (manifest: PetManifest, spritesheetUrl: string) => void
  unregisterPet: (petId: string) => void
  markSpritesheetLoaded: () => void
  setVisible: (visible: boolean) => void
  tick: (deltaMs: number) => void
  toggleEnabled: () => void
}

function createInitialAnimation(): AnimationState {
  return {
    state: 'idle',
    frameIndex: 0,
    elapsed: 0,
    totalElapsed: 0,
  }
}

export const usePetStore = create<PetStore>((set, get) => {
  const saved = loadSettings()

  return {
    // Persisted settings
    enabled: saved.enabled,
    activePetId: saved.activePetId,
    scale: saved.scale,
    position: saved.position,
    showLookDirection: saved.showLookDirection,

    // Runtime state
    animation: createInitialAnimation(),
    lookDegree: null,
    loadedPets: new Map(),
    spritesheetUrls: new Map(),
    isSpritesheetLoaded: false,
    visible: true,

    // ── Actions ──────────────────────────────────────────────

    setEnabled: (enabled) => {
      set({ enabled })
      saveSettings({ ...get(), enabled })
    },

    setActivePet: (petId) => {
      set({ activePetId: petId, isSpritesheetLoaded: false })
      saveSettings({ ...get(), activePetId: petId })
    },

    setScale: (scale) => {
      set({ scale: Math.max(0.5, Math.min(2, scale)) })
      saveSettings({ ...get(), scale: get().scale })
    },

    setPosition: (position) => {
      set({ position })
      saveSettings({ ...get(), position })
    },

    setShowLookDirection: (showLookDirection) => {
      set({ showLookDirection })
      saveSettings({ ...get(), showLookDirection })
    },

    setPetState: (state) => {
      const current = get().animation
      if (current.state === state) return
      set({
        animation: {
          state,
          frameIndex: 0,
          elapsed: 0,
          totalElapsed: 0,
        },
      })
    },

    setLookDegree: (degree) => {
      set({ lookDegree: degree })
    },

    registerPet: (manifest, spritesheetUrl) => {
      const pets = new Map(get().loadedPets)
      const urls = new Map(get().spritesheetUrls)
      pets.set(manifest.id, manifest)
      urls.set(manifest.id, spritesheetUrl)
      set({ loadedPets: pets, spritesheetUrls: urls })
    },

    unregisterPet: (petId) => {
      const pets = new Map(get().loadedPets)
      const urls = new Map(get().spritesheetUrls)
      const url = urls.get(petId)
      if (url) URL.revokeObjectURL(url)
      pets.delete(petId)
      urls.delete(petId)
      set({ loadedPets: pets, spritesheetUrls: urls })
    },

    markSpritesheetLoaded: () => set({ isSpritesheetLoaded: true }),

    setVisible: (visible) => set({ visible }),

    tick: (deltaMs) => {
      const { animation } = get()
      const { state, frameIndex, elapsed, totalElapsed } = animation
      const durations = PET_STATE_DURATIONS[state]
      const maxFrames = PET_STATE_FRAMES[state]
      const newElapsed = elapsed + deltaMs
      const newTotal = totalElapsed + deltaMs

      const currentDuration = durations[frameIndex] ?? durations[durations.length - 1] ?? 200

      if (newElapsed >= currentDuration) {
        // Advance to next frame
        const nextFrame = (frameIndex + 1) % maxFrames
        set({
          animation: {
            state,
            frameIndex: nextFrame,
            elapsed: newElapsed - currentDuration,
            totalElapsed: newTotal,
          },
        })
      } else {
        set({
          animation: {
            state,
            frameIndex,
            elapsed: newElapsed,
            totalElapsed: newTotal,
          },
        })
      }
    },

    toggleEnabled: () => {
      const next = !get().enabled
      set({ enabled: next })
      saveSettings({ ...get(), enabled: next })
    },
  }
})

// ── Selector helpers ─────────────────────────────────────────

/**
 * Get the sprite position in the atlas for the current animation frame
 * or the look direction cell.
 */
export function getSpritePosition(
  state: PetState,
  frameIndex: number,
  lookDegree: LookDegree | null,
): { x: number; y: number } {
  // If we have a look direction and the state is idle, show the look cell
  if (lookDegree !== null && state === 'idle') {
    const lookIndex = LOOK_DEGREES.indexOf(lookDegree)
    if (lookIndex >= 0) {
      const row = lookIndex < 8 ? 9 : 10
      const col = lookIndex % 8
      return { x: col * CELL_WIDTH, y: row * CELL_HEIGHT }
    }
  }

  const row = PET_STATE_ROW[state]
  return { x: frameIndex * CELL_WIDTH, y: row * CELL_HEIGHT }
}
