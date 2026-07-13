/**
 * Pet system types — compatible with Codex V2 sprite contract.
 *
 * V2 spritesheet layout: 8 columns × 11 rows, each cell 192×208 px.
 * Total atlas: 1536 × 2288 px.
 *
 * Rows 0-8: standard animation states
 * Rows 9-10: 16 clockwise look directions (22.5° steps)
 */

// ── Animation states (rows 0-8) ──────────────────────────────

export const PET_STATES = [
  'idle',
  'running-right',
  'running-left',
  'waving',
  'jumping',
  'failed',
  'waiting',
  'running',
  'review',
] as const

export type PetState = (typeof PET_STATES)[number]

// Frame counts per state (matches Codex V2 contract)
export const PET_STATE_FRAMES: Record<PetState, number> = {
  idle: 6,
  'running-right': 8,
  'running-left': 8,
  waving: 4,
  jumping: 5,
  failed: 8,
  waiting: 6,
  running: 6,
  review: 6,
}

// Frame durations in ms (matches Codex V2 contract, last frame is the settle frame)
export const PET_STATE_DURATIONS: Record<PetState, number[]> = {
  idle: [280, 110, 110, 140, 140, 320],
  'running-right': [120, 120, 120, 120, 120, 120, 120, 220],
  'running-left': [120, 120, 120, 120, 120, 120, 120, 220],
  waving: [140, 140, 140, 280],
  jumping: [140, 140, 140, 140, 280],
  failed: [140, 140, 140, 140, 140, 140, 140, 240],
  waiting: [150, 150, 150, 150, 150, 260],
  running: [120, 120, 120, 120, 120, 220],
  review: [150, 150, 150, 150, 150, 280],
}

// Row index in the atlas for each state
export const PET_STATE_ROW: Record<PetState, number> = {
  idle: 0,
  'running-right': 1,
  'running-left': 2,
  waving: 3,
  jumping: 4,
  failed: 5,
  waiting: 6,
  running: 7,
  review: 8,
}

// ── Look directions (rows 9-10) ──────────────────────────────

export const LOOK_DEGREES = [
  0, 22.5, 45, 67.5, 90, 112.5, 135, 157.5,
  180, 202.5, 225, 247.5, 270, 292.5, 315, 337.5,
] as const

export type LookDegree = (typeof LOOK_DEGREES)[number]

// ── Sprite atlas geometry ────────────────────────────────────

export const ATLAS_COLUMNS = 8
export const ATLAS_ROWS = 11
export const CELL_WIDTH = 192
export const CELL_HEIGHT = 208
export const ATLAS_WIDTH = ATLAS_COLUMNS * CELL_WIDTH   // 1536
export const ATLAS_HEIGHT = ATLAS_ROWS * CELL_HEIGHT     // 2288

// ── Pet configuration ────────────────────────────────────────

export type PetManifest = {
  id: string
  displayName: string
  description: string
  spriteVersionNumber: 2
  spritesheetPath: string
}

export type PetMood = 'happy' | 'neutral' | 'sad' | 'excited'

// Map chat state to pet animation state
export function chatStateToPetState(chatState: string): PetState {
  switch (chatState) {
    case 'idle':
      return 'idle'
    case 'thinking':
    case 'streaming':
    case 'tool_executing':
      return 'running'
    case 'waiting_permission':
      return 'waiting'
    case 'completed':
      return 'review'
    case 'error':
      return 'failed'
    default:
      return 'idle'
  }
}
