import { useEffect, useRef } from 'react'

function pseudoNoise(x: number, y: number, z: number) {
  const nx = x * 0.004
  const ny = y * 0.004
  const v = Math.sin(nx + Math.cos(ny + z)) * Math.cos(nx * 1.5 - z)
    + Math.sin(ny * 2.0 + z * 0.5)
    + Math.cos(Math.sqrt(nx * nx + ny * ny) - z)
  return (v + 2) / 4
}

const DOT_RADIUS = 1
const SPACING = 16
const DISPLACEMENT = 4
const TIME_SPEED = 0.018
const ROTATION_SPEED = 0.3

export function NoiseDotBackground() {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let time = 0
    let animId = 0
    const dpr = window.devicePixelRatio || 1

    function resize() {
      const rect = container!.getBoundingClientRect()
      canvas!.width = rect.width * dpr
      canvas!.height = rect.height * dpr
      canvas!.style.width = `${rect.width}px`
      canvas!.style.height = `${rect.height}px`
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    const ro = new ResizeObserver(resize)
    ro.observe(container)
    resize()

    function animate() {
      const rect = container!.getBoundingClientRect()
      const w = rect.width
      const h = rect.height
      if (w === 0 || h === 0) {
        animId = requestAnimationFrame(animate)
        return
      }

      ctx!.clearRect(0, 0, w, h)

      time += TIME_SPEED
      const cx = w / 2
      const cy = h / 2

      for (let gx = SPACING / 2; gx < w; gx += SPACING) {
        for (let gy = SPACING / 2; gy < h; gy += SPACING) {
          const dx = gx - cx
          const dy = gy - cy
          const angle = Math.atan2(dy, dx)
          const dist = Math.sqrt(dx * dx + dy * dy)
          const rotatedAngle = angle + time * ROTATION_SPEED
          const sx = cx + Math.cos(rotatedAngle) * dist
          const sy = cy + Math.sin(rotatedAngle) * dist

          const n = pseudoNoise(sx, sy, time)
          const opacity = 0.005 + n * 0.15

          const dx2 = pseudoNoise(sx + 100, sy, time) - 0.5
          const dy2 = pseudoNoise(sx, sy + 100, time + 50) - 0.5
          const px = gx + dx2 * DISPLACEMENT
          const py = gy + dy2 * DISPLACEMENT

          ctx!.beginPath()
          ctx!.arc(px, py, DOT_RADIUS, 0, Math.PI * 2)
          ctx!.fillStyle = `rgba(255,255,255,${opacity})`
          ctx!.fill()
        }
      }

      animId = requestAnimationFrame(animate)
    }

    animate()

    return () => {
      cancelAnimationFrame(animId)
      ro.disconnect()
    }
  }, [])

  return (
    <div ref={containerRef} className="pointer-events-none absolute inset-0 overflow-hidden">
      <canvas ref={canvasRef} className="absolute inset-0" />
    </div>
  )
}
