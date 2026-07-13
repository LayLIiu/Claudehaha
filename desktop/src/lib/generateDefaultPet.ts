/**
 * Procedural default pet generator — "Sprout" 🌱
 *
 * Generates a complete V2-compatible spritesheet (8×11, 192×208 cells)
 * entirely at runtime using Canvas 2D drawing. No external assets needed.
 *
 * The pet is a small round cat-like creature with:
 * - Round body, pointed ears, big eyes, tiny mouth
 * - A small leaf/sprout on its head
 * - Simple pixel-art-adjacent style with clean edges
 *
 * Design goals:
 * - Readable at 192×208 display size
 * - Clean silhouette for chroma extraction (transparent bg)
 * - Distinct silhouettes per animation state
 * - Recognizable look directions via eye/head movement
 */

import {
  ATLAS_WIDTH,
  ATLAS_HEIGHT,
  CELL_WIDTH,
  CELL_HEIGHT,
  PET_STATE_FRAMES,
  LOOK_DEGREES,
  type PetState,
} from '../types/pet'

// ── Color palette ────────────────────────────────────────────

const COLORS = {
  body: '#6C8EBF',       // soft blue
  bodyDark: '#4A6FA5',   // darker blue for shading
  bodyLight: '#8FAFD4',  // lighter blue for highlights
  ear: '#E8A0BF',        // pink inner ear
  eye: '#2D3748',        // dark eye
  eyeWhite: '#FFFFFF',   // eye white/sclera
  eyeShine: '#FFFFFF',   // eye highlight dot
  nose: '#E8A0BF',       // pink nose
  mouth: '#4A6FA5',      // mouth line
  sprout: '#68D391',     // green leaf
  sproutStem: '#48BB78', // darker green stem
  blush: '#FEB2B2',      // cheek blush (semi-transparent)
  paw: '#8FAFD4',        // paw pad
  tail: '#6C8EBF',       // tail (same as body)
} as const

// ── Drawing helpers ──────────────────────────────────────────

type Ctx = CanvasRenderingContext2D

function drawEllipse(
  ctx: Ctx,
  cx: number, cy: number,
  rx: number, ry: number,
  fill: string,
) {
  ctx.beginPath()
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2)
  ctx.fillStyle = fill
  ctx.fill()
}

function drawCircle(ctx: Ctx, cx: number, cy: number, r: number, fill: string) {
  drawEllipse(ctx, cx, cy, r, r, fill)
}

/** Draw the cat body (shared across all frames) */
function drawBody(ctx: Ctx, cx: number, cy: number, opts: {
  bodyOffsetY?: number
  squish?: number   // vertical squish (1 = normal, <1 = compressed)
  lean?: number     // horizontal lean offset
  tailAngle?: number // tail rotation in radians
}) {
  const { bodyOffsetY = 0, squish = 1, lean = 0, tailAngle = 0 } = opts
  const bodyY = cy + bodyOffsetY

  // Tail
  ctx.save()
  ctx.translate(cx - 28 + lean, bodyY + 10)
  ctx.rotate(tailAngle)
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.quadraticCurveTo(-18, -20, -10, -35)
  ctx.quadraticCurveTo(-5, -40, 0, -35)
  ctx.quadraticCurveTo(-8, -18, 5, 0)
  ctx.fillStyle = COLORS.body
  ctx.fill()
  ctx.restore()

  // Body
  const bodyRx = 30
  const bodyRy = 26 * squish
  drawEllipse(ctx, cx + lean, bodyY, bodyRx, bodyRy, COLORS.body)

  // Body highlight
  drawEllipse(ctx, cx + lean - 5, bodyY - 8, bodyRx * 0.6, bodyRy * 0.5, COLORS.bodyLight)

  // Paws (front two)
  drawEllipse(ctx, cx + lean - 16, bodyY + 20, 8, 6, COLORS.paw)
  drawEllipse(ctx, cx + lean + 16, bodyY + 20, 8, 6, COLORS.paw)
}

/** Draw the cat head (shared across all frames) */
function drawHead(ctx: Ctx, cx: number, cy: number, opts: {
  headOffsetY?: number
  headOffsetX?: number
  eyeOffsetX?: number
  eyeOffsetY?: number
  leftEyeLookX?: number
  leftEyeLookY?: number
  rightEyeLookX?: number
  rightEyeLookY?: number
  mouthState?: 'neutral' | 'smile' | 'sad' | 'open'
  earFold?: number  // 0 = normal, 1 = fully folded
  blinkAmount?: number  // 0 = open, 1 = closed
  headTilt?: number  // rotation in radians
}) {
  const {
    headOffsetY = 0, headOffsetX = 0,
    eyeOffsetX = 0, eyeOffsetY = 0,
    leftEyeLookX = 0, leftEyeLookY = 0,
    rightEyeLookX = 0, rightEyeLookY = 0,
    mouthState = 'neutral',
    earFold = 0,
    blinkAmount = 0,
    headTilt = 0,
  } = opts

  const headX = cx + headOffsetX
  const headY = cy + headOffsetY

  ctx.save()
  ctx.translate(headX, headY)
  ctx.rotate(headTilt)

  // Ears
  const earFoldOffset = earFold * 8
  // Left ear
  ctx.beginPath()
  ctx.moveTo(-22, -18)
  ctx.lineTo(-12 + earFoldOffset, -42)
  ctx.lineTo(-2, -18)
  ctx.fillStyle = COLORS.body
  ctx.fill()
  // Left ear inner
  ctx.beginPath()
  ctx.moveTo(-18, -20)
  ctx.lineTo(-12 + earFoldOffset, -36)
  ctx.lineTo(-6, -20)
  ctx.fillStyle = COLORS.ear
  ctx.fill()
  // Right ear
  ctx.beginPath()
  ctx.moveTo(2, -18)
  ctx.lineTo(12 - earFoldOffset, -42)
  ctx.lineTo(22, -18)
  ctx.fillStyle = COLORS.body
  ctx.fill()
  // Right ear inner
  ctx.beginPath()
  ctx.moveTo(6, -20)
  ctx.lineTo(12 - earFoldOffset, -36)
  ctx.lineTo(18, -20)
  ctx.fillStyle = COLORS.ear
  ctx.fill()

  // Head
  drawCircle(ctx, 0, 0, 26, COLORS.body)
  // Head highlight
  drawEllipse(ctx, -6, -10, 16, 12, COLORS.bodyLight)

  // Eyes
  const eyeY = -4 + eyeOffsetY
  const leftEyeX = -10 + eyeOffsetX
  const rightEyeX = 10 + eyeOffsetX

  if (blinkAmount >= 0.8) {
    // Closed eyes - draw lines
    ctx.beginPath()
    ctx.moveTo(leftEyeX - 5, eyeY)
    ctx.lineTo(leftEyeX + 5, eyeY)
    ctx.strokeStyle = COLORS.eye
    ctx.lineWidth = 2
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(rightEyeX - 5, eyeY)
    ctx.lineTo(rightEyeX + 5, eyeY)
    ctx.stroke()
  } else {
    // Open eyes
    const eyeH = 7 * (1 - blinkAmount * 0.5)
    // Left eye
    drawEllipse(ctx, leftEyeX, eyeY, 6, eyeH, COLORS.eyeWhite)
    drawCircle(ctx, leftEyeX + leftEyeLookX, eyeY + leftEyeLookY, 3.5, COLORS.eye)
    drawCircle(ctx, leftEyeX + leftEyeLookX - 1, eyeY + leftEyeLookY - 1.5, 1.2, COLORS.eyeShine)
    // Right eye
    drawEllipse(ctx, rightEyeX, eyeY, 6, eyeH, COLORS.eyeWhite)
    drawCircle(ctx, rightEyeX + rightEyeLookX, eyeY + rightEyeLookY, 3.5, COLORS.eye)
    drawCircle(ctx, rightEyeX + rightEyeLookX - 1, eyeY + rightEyeLookY - 1.5, 1.2, COLORS.eyeShine)
  }

  // Nose
  ctx.beginPath()
  ctx.moveTo(0, 5)
  ctx.lineTo(-3, 3)
  ctx.lineTo(3, 3)
  ctx.fillStyle = COLORS.nose
  ctx.fill()

  // Mouth
  ctx.beginPath()
  ctx.strokeStyle = COLORS.mouth
  ctx.lineWidth = 1.5
  ctx.lineCap = 'round'
  if (mouthState === 'smile') {
    ctx.moveTo(-6, 8)
    ctx.quadraticCurveTo(0, 14, 6, 8)
  } else if (mouthState === 'sad') {
    ctx.moveTo(-5, 10)
    ctx.quadraticCurveTo(0, 6, 5, 10)
  } else if (mouthState === 'open') {
    drawEllipse(ctx, 0, 9, 4, 3, COLORS.bodyDark)
  } else {
    ctx.moveTo(-4, 8)
    ctx.lineTo(0, 9)
    ctx.lineTo(4, 8)
  }
  ctx.stroke()

  // Blush
  ctx.globalAlpha = 0.3
  drawCircle(ctx, -16, 4, 5, COLORS.blush)
  drawCircle(ctx, 16, 4, 5, COLORS.blush)
  ctx.globalAlpha = 1

  // Sprout on head
  ctx.beginPath()
  ctx.moveTo(0, -25)
  ctx.lineTo(0, -38)
  ctx.strokeStyle = COLORS.sproutStem
  ctx.lineWidth = 2
  ctx.stroke()
  // Left leaf
  ctx.beginPath()
  ctx.moveTo(0, -36)
  ctx.quadraticCurveTo(-10, -42, -8, -34)
  ctx.quadraticCurveTo(-4, -34, 0, -36)
  ctx.fillStyle = COLORS.sprout
  ctx.fill()
  // Right leaf
  ctx.beginPath()
  ctx.moveTo(0, -33)
  ctx.quadraticCurveTo(8, -40, 6, -31)
  ctx.quadraticCurveTo(3, -31, 0, -33)
  ctx.fillStyle = COLORS.sprout
  ctx.fill()

  ctx.restore()
}

// ── State-specific drawing functions ─────────────────────────

/** Center of the pet in a cell */
const CX = CELL_WIDTH / 2    // 96
const CY = CELL_HEIGHT / 2 + 10  // 114 (slightly below center)

function drawIdleFrame(ctx: Ctx, frameIndex: number) {
  const breathe = Math.sin(frameIndex * Math.PI / 3) * 2
  const blink = frameIndex === 2 ? 1 : 0  // blink on frame 2

  drawBody(ctx, CX, CY, {
    bodyOffsetY: breathe * 0.5,
    squish: 1 + breathe * 0.01,
    tailAngle: Math.sin(frameIndex * 0.5) * 0.1,
  })
  drawHead(ctx, CX, CY - 30, {
    headOffsetY: breathe,
    blinkAmount: blink,
  })
}

function drawRunningRightFrame(ctx: Ctx, frameIndex: number) {
  const bounce = [0, -4, -6, -4, 0, -3, -5, -2][frameIndex] ?? 0
  const lean = [2, 4, 3, 2, 1, 3, 4, 2][frameIndex] ?? 2

  drawBody(ctx, CX, CY, {
    bodyOffsetY: bounce,
    lean: lean,
    squish: bounce < -3 ? 1.03 : 0.98,
    tailAngle: -0.3 + Math.sin(frameIndex * 0.8) * 0.15,
  })
  drawHead(ctx, CX, CY - 30, {
    headOffsetY: bounce - 2,
    headOffsetX: lean + 2,
    mouthState: 'open',
  })
}

function drawRunningLeftFrame(ctx: Ctx, frameIndex: number) {
  const bounce = [0, -4, -6, -4, 0, -3, -5, -2][frameIndex] ?? 0
  const lean = [-2, -4, -3, -2, -1, -3, -4, -2][frameIndex] ?? -2

  drawBody(ctx, CX, CY, {
    bodyOffsetY: bounce,
    lean: lean,
    squish: bounce < -3 ? 1.03 : 0.98,
    tailAngle: 0.3 + Math.sin(frameIndex * 0.8) * 0.15,
  })
  drawHead(ctx, CX, CY - 30, {
    headOffsetY: bounce - 2,
    headOffsetX: lean - 2,
    mouthState: 'open',
  })
}

function drawWavingFrame(ctx: Ctx, frameIndex: number) {
  // Simple wave: paw up, wave, paw down
  const wavePhase = [0, 1, 2, 1][frameIndex] ?? 0

  drawBody(ctx, CX, CY, { tailAngle: 0.2 })
  drawHead(ctx, CX, CY - 30, {
    mouthState: 'smile',
    headTilt: wavePhase * 0.05,
  })

  // Waving paw (right)
  const pawX = CX + 28
  const pawY = CY - 10 - wavePhase * 15
  const waveX = pawX + Math.sin(wavePhase * Math.PI) * 5
  drawEllipse(ctx, waveX, pawY, 7, 6, COLORS.paw)
}

function drawJumpingFrame(ctx: Ctx, frameIndex: number) {
  // 5 frames: crouch, launch, peak, descend, land
  const jumpY = [4, -8, -18, -10, 3][frameIndex] ?? 0
  const squish = [0.9, 1.05, 1.1, 1.05, 0.92][frameIndex] ?? 1

  drawBody(ctx, CX, CY, {
    bodyOffsetY: jumpY,
    squish: squish,
    tailAngle: jumpY < -10 ? -0.4 : 0,
  })
  drawHead(ctx, CX, CY - 30, {
    headOffsetY: jumpY - 3,
    mouthState: frameIndex === 2 ? 'open' : 'smile',
    earFold: jumpY < -12 ? 0.3 : 0,
  })
}

function drawFailedFrame(ctx: Ctx, frameIndex: number) {
  // Sad wobble
  const wobble = Math.sin(frameIndex * Math.PI / 3) * 1.5
  const droop = Math.min(frameIndex * 0.5, 2)

  drawBody(ctx, CX, CY, {
    bodyOffsetY: droop,
    lean: wobble,
    squish: 0.97,
    tailAngle: -0.3,
  })
  drawHead(ctx, CX, CY - 30, {
    headOffsetY: droop,
    headOffsetX: wobble,
    mouthState: 'sad',
    blinkAmount: frameIndex % 4 === 0 ? 0.6 : 0,
    earFold: 0.3,
  })
}

function drawWaitingFrame(ctx: Ctx, frameIndex: number) {
  const bob = Math.sin(frameIndex * Math.PI / 2.5) * 2

  drawBody(ctx, CX, CY, {
    bodyOffsetY: bob,
    tailAngle: Math.sin(frameIndex * 0.6) * 0.15,
  })
  drawHead(ctx, CX, CY - 30, {
    headOffsetY: bob,
    headTilt: Math.sin(frameIndex * 0.5) * 0.06,
    mouthState: 'neutral',
  })
}

function drawRunningFrame(ctx: Ctx, frameIndex: number) {
  // "Working/processing" — not running feet, more like focused bob
  const bob = [0, -2, -3, -2, 0, -1][frameIndex] ?? 0
  const think = frameIndex % 3 === 0

  drawBody(ctx, CX, CY, {
    bodyOffsetY: bob,
    squish: 1 + bob * 0.003,
    tailAngle: Math.sin(frameIndex * 0.7) * 0.1,
  })
  drawHead(ctx, CX, CY - 30, {
    headOffsetY: bob - 1,
    blinkAmount: think ? 0.5 : 0,
    mouthState: 'neutral',
  })
}

function drawReviewFrame(ctx: Ctx, frameIndex: number) {
  const nod = [0, -1, -3, -2, 0, -1][frameIndex] ?? 0

  drawBody(ctx, CX, CY, {
    bodyOffsetY: 1,
    tailAngle: 0.15,
  })
  drawHead(ctx, CX, CY - 30, {
    headOffsetY: nod,
    headTilt: -0.08,
    blinkAmount: frameIndex === 3 ? 0.8 : 0,
    mouthState: 'smile',
  })
}

// ── Look direction drawing ───────────────────────────────────

function drawLookDirectionFrame(ctx: Ctx, degree: number) {
  // Convert degree to radians (0 = up, clockwise)
  const rad = (degree - 90) * Math.PI / 180
  const lookDist = 2.5  // how far pupils move
  const lookX = Math.cos(rad) * lookDist
  const lookY = -Math.sin(rad) * lookDist  // canvas Y is inverted

  // Head tilt toward direction
  const headTilt = Math.cos(rad) * 0.06
  // Slight head offset toward direction
  const headOffX = lookX * 1.5
  const headOffY = lookY * 0.8

  drawBody(ctx, CX, CY, {
    lean: headOffX * 0.5,
    tailAngle: -headOffX * 0.02,
  })
  drawHead(ctx, CX, CY - 30, {
    headOffsetX: headOffX,
    headOffsetY: headOffY,
    leftEyeLookX: lookX,
    leftEyeLookY: lookY,
    rightEyeLookX: lookX,
    rightEyeLookY: lookY,
    headTilt: headTilt,
  })
}

// ── State drawing dispatch ───────────────────────────────────

const STATE_DRAWERS: Record<PetState, (ctx: Ctx, frame: number) => void> = {
  idle: drawIdleFrame,
  'running-right': drawRunningRightFrame,
  'running-left': drawRunningLeftFrame,
  waving: drawWavingFrame,
  jumping: drawJumpingFrame,
  failed: drawFailedFrame,
  waiting: drawWaitingFrame,
  running: drawRunningFrame,
  review: drawReviewFrame,
}

// ── Main generator ───────────────────────────────────────────

/**
 * Generate the full V2 spritesheet as a Blob URL.
 * Returns the URL that can be used as an <img> or canvas source.
 */
export function generateDefaultPetSpritesheet(): string {
  const canvas = document.createElement('canvas')
  canvas.width = ATLAS_WIDTH
  canvas.height = ATLAS_HEIGHT
  const ctx = canvas.getContext('2d')!

  // Clear to transparent
  ctx.clearRect(0, 0, ATLAS_WIDTH, ATLAS_HEIGHT)

  // Draw rows 0-8 (standard animation states)
  const states: PetState[] = [
    'idle', 'running-right', 'running-left', 'waving',
    'jumping', 'failed', 'waiting', 'running', 'review',
  ]

  for (let rowIdx = 0; rowIdx < states.length; rowIdx++) {
    const state = states[rowIdx]!
    const frames = PET_STATE_FRAMES[state]
    const drawer = STATE_DRAWERS[state]

    for (let col = 0; col < frames; col++) {
      ctx.save()
      ctx.beginPath()
      ctx.rect(col * CELL_WIDTH, rowIdx * CELL_HEIGHT, CELL_WIDTH, CELL_HEIGHT)
      ctx.clip()

      drawer(ctx, col)

      ctx.restore()
    }
  }

  // Draw rows 9-10 (look directions)
  for (let i = 0; i < LOOK_DEGREES.length; i++) {
    const row = i < 8 ? 9 : 10
    const col = i % 8
    const degree = LOOK_DEGREES[i]!

    ctx.save()
    ctx.beginPath()
    ctx.rect(col * CELL_WIDTH, row * CELL_HEIGHT, CELL_WIDTH, CELL_HEIGHT)
    ctx.clip()

    drawLookDirectionFrame(ctx, degree)

    ctx.restore()
  }

  return canvas.toDataURL('image/png')
}
