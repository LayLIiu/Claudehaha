import { useEffect, useRef } from 'react'
import { useReducedMotion } from '../../hooks/useReducedMotion'

const VERTEX_SOURCE = `#version 300 es
in vec2 a_position;
out vec2 v_uv;
uniform vec2 u_resolution;
void main() {
  v_uv = (a_position * 0.5 + 0.5) * u_resolution;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`

const FRAGMENT_SOURCE = `#version 300 es
precision highp float;
uniform vec2 u_resolution;
uniform float u_time;
uniform vec4 u_color;
in vec2 v_uv;
out vec4 fragColor;

const float GAP   = 22.0;
const float DOT_R = 1.6;
const float R_MIN = 1.0;
const float ARMS  = 2.0;
const float PITCH = 0.08;
const float SPIN  = 0.25;
const float DRIFT = 0.035;
const float WIDTH = 0.55;
const float GAMMA = 2.2;
const float RIPPLE_AMP  = 3.0;
const float RIPPLE_FREQ = 0.020;
const float RIPPLE_VEL  = 0.12;
const float RIPPLE_TURN = 0.015;

void main() {
  vec2 cell = floor(v_uv / GAP);
  float h = u_time * RIPPLE_TURN;
  vec2 k1 = vec2(cos(h), sin(h));
  vec2 k2 = vec2(cos(h + 1.05), sin(h + 1.05));
  float s1 = sin(dot(cell, k1) * RIPPLE_FREQ * 6.2831853 - u_time * RIPPLE_VEL);
  float s2 = sin(dot(cell, k2) * RIPPLE_FREQ * 6.2831853 - u_time * RIPPLE_VEL * 0.8);
  vec2 disp = (k1 * s1 + k2 * s2) * RIPPLE_AMP * 0.5;
  vec2 local = v_uv - (cell + 0.5) * GAP - disp;
  float dist = length(local);
  vec2 gridSize = u_resolution / GAP;
  vec2 origin = gridSize * 0.5 + gridSize * 0.35 * vec2(
    sin(u_time * DRIFT * 3.0),
    cos(u_time * DRIFT * 2.0)
  );
  vec2 d = cell - origin;
  float rad = length(d);
  float ang = atan(d.y, d.x);
  float phase = ang * ARMS + rad * PITCH - u_time * SPIN;
  float dArm = acos(cos(phase)) / 3.14159265;
  float t = max(1.0 - dArm / WIDTH, 0.0);
  float a = pow(t, GAMMA);
  float r = mix(R_MIN, DOT_R, t);
  float aa = fwidth(dist);
  float mask = 1.0 - smoothstep(r - aa, r + aa, dist);
  fragColor = u_color * (a * mask);
}
`

const MAX_PIXELS = 4_147_200
const QUAD_VERTICES = new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1])

function compileShader(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type)
  if (!shader) return null
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return shader
  console.warn('[DotGridShader] compile:', gl.getShaderInfoLog(shader))
  gl.deleteShader(shader)
  return null
}

function linkProgram(gl: WebGL2RenderingContext, vertSrc: string, fragSrc: string): WebGLProgram | null {
  const vert = compileShader(gl, gl.VERTEX_SHADER, vertSrc)
  const frag = compileShader(gl, gl.FRAGMENT_SHADER, fragSrc)
  if (!vert || !frag) return null
  const program = gl.createProgram()
  if (!program) return null
  gl.attachShader(program, vert)
  gl.attachShader(program, frag)
  gl.linkProgram(program)
  gl.deleteShader(vert)
  gl.deleteShader(frag)
  if (gl.getProgramParameter(program, gl.LINK_STATUS)) return program
  console.warn('[DotGridShader] link:', gl.getProgramInfoLog(program))
  gl.deleteProgram(program)
  return null
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  if (s === 0) return [l, l, l]
  const hue2rgb = (p: number, q: number, t: number) => {
    let tt = t
    if (tt < 0) tt += 1
    if (tt > 1) tt -= 1
    if (tt < 1 / 6) return p + 6 * (q - p) * tt
    if (tt < 0.5) return q
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6
    return p
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  return [hue2rgb(p, q, h + 1 / 3), hue2rgb(p, q, h), hue2rgb(p, q, h - 1 / 3)]
}

function parseColor(color: string): [number, number, number, number] {
  const trimmed = color.trim()

  const hsla = trimmed.match(
    /^hsla?\(\s*([\d.]+)\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%\s*(?:,\s*([\d.]+))?\s*\)$/i,
  )
  if (hsla) {
    const h = parseFloat(hsla[1]!) / 360
    const s = parseFloat(hsla[2]!) / 100
    const l = parseFloat(hsla[3]!) / 100
    const a = hsla[4] !== undefined ? parseFloat(hsla[4]!) : 1
    const [r, g, b] = hslToRgb(h, s, l)
    return [r, g, b, a]
  }

  const rgba = trimmed.match(
    /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+))?\s*\)$/i,
  )
  if (rgba) {
    return [
      parseFloat(rgba[1]!) / 255,
      parseFloat(rgba[2]!) / 255,
      parseFloat(rgba[3]!) / 255,
      rgba[4] !== undefined ? parseFloat(rgba[4]!) : 1,
    ]
  }

  const hex = trimmed.match(/^#([0-9a-f]{6})([0-9a-f]{2})?$/i)
  if (hex) {
    const n = parseInt(hex[1]!, 16)
    return [
      ((n >> 16) & 255) / 255,
      ((n >> 8) & 255) / 255,
      (n & 255) / 255,
      hex[2] ? parseInt(hex[2], 16) / 255 : 1,
    ]
  }

  return [0.5, 0.5, 0.5, 0.5]
}


export function DotGridShader() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const prefersReduced = useReducedMotion()

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const gl = canvas.getContext('webgl2', {
      alpha: true,
      antialias: false,
      depth: false,
      stencil: false,
      premultipliedAlpha: true,
    })
    if (!gl) return

    const program = linkProgram(gl, VERTEX_SOURCE, FRAGMENT_SOURCE)
    if (!program) return

    gl.useProgram(program)

    const buffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(gl.ARRAY_BUFFER, QUAD_VERTICES, gl.STATIC_DRAW)

    const aPosition = gl.getAttribLocation(program, 'a_position')
    gl.enableVertexAttribArray(aPosition)
    gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, 0, 0)

    const uTime = gl.getUniformLocation(program, 'u_time')
    const uResolution = gl.getUniformLocation(program, 'u_resolution')
    const uColor = gl.getUniformLocation(program, 'u_color')

    gl.enable(gl.BLEND)
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
    gl.clearColor(0, 0, 0, 0)

    let viewportDirty = true
    let animSpeed = prefersReduced ? 0 : 1
    let timeOffset = 1e6 * Math.random()
    let lastTs = performance.now()
    let running = false
    let frameId = 0

    function setCanvasSize(width: number, height: number, dpr: number) {
      let w = Math.max(1, Math.round(width * dpr))
      let h = Math.max(1, Math.round(height * dpr))
      if (w * h > MAX_PIXELS) {
        const scale = Math.sqrt(MAX_PIXELS / (w * h))
        w = Math.max(1, Math.round(w * scale))
        h = Math.max(1, Math.round(h * scale))
      }
      if (canvas!.width !== w || canvas!.height !== h) {
        canvas!.width = w
        canvas!.height = h
        viewportDirty = true
      }
    }

    const ro = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      const cb = entry.devicePixelContentBoxSize?.[0]
      if (cb) {
        setCanvasSize(cb.inlineSize, cb.blockSize, 1)
      } else {
        const box = entry.borderBoxSize?.[0] ?? entry.contentBoxSize?.[0]
        const w = box?.inlineSize ?? canvas!.clientWidth
        const h = box?.blockSize ?? canvas!.clientHeight
        setCanvasSize(w, h, window.devicePixelRatio || 1)
      }
      render()
    })
    ro.observe(canvas)

    function updateColor() {
      const cssColor =
        getComputedStyle(canvas!).getPropertyValue('--color-dot-grid').trim() ||
        'hsla(0, 0%, 50%, 0.5)'
      const [r, g, b, a] = parseColor(cssColor)
      gl!.uniform4f(uColor, r * a, g * a, b * a, a)
    }

    updateColor()

    const modeObs = new MutationObserver(() => {
      requestAnimationFrame(() => {
        updateColor()
        render()
      })
    })
    modeObs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-mode'],
    })

    function render() {
      if (viewportDirty) {
        gl!.viewport(0, 0, canvas!.width, canvas!.height)
        gl!.uniform2f(uResolution, canvas!.width, canvas!.height)
        viewportDirty = false
      }
      gl!.uniform1f(uTime, 0.001 * timeOffset)
      gl!.clear(gl!.COLOR_BUFFER_BIT)
      gl!.drawArrays(gl!.TRIANGLES, 0, 6)
    }

    function tick(ts: number) {
      timeOffset += (ts - lastTs) * animSpeed
      lastTs = ts
      render()
      frameId = requestAnimationFrame(tick)
    }

    function start() {
      if (running || animSpeed === 0) return
      running = true
      lastTs = performance.now()
      frameId = requestAnimationFrame(tick)
    }

    function stop() {
      if (!running) return
      running = false
      cancelAnimationFrame(frameId)
    }

    function setAnimSpeed(reduced: boolean) {
      animSpeed = reduced ? 0 : 1
      if (animSpeed === 0) {
        stop()
        render()
      } else if (!document.hidden) {
        start()
      }
    }

    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onMotionChange = (e: MediaQueryListEvent) => setAnimSpeed(e.matches)
    if (typeof motionQuery.addEventListener === 'function') {
      motionQuery.addEventListener('change', onMotionChange)
    } else {
      motionQuery.addListener(onMotionChange)
    }

    function onVisibility() {
      if (document.hidden) {
        stop()
      } else {
        start()
      }
    }

    document.addEventListener('visibilitychange', onVisibility)

    setCanvasSize(canvas.clientWidth || 1, canvas.clientHeight || 1, window.devicePixelRatio || 1)
    render()
    if (!document.hidden && animSpeed !== 0) start()

    return () => {
      stop()
      ro.disconnect()
      modeObs.disconnect()
      if (typeof motionQuery.removeEventListener === 'function') {
        motionQuery.removeEventListener('change', onMotionChange)
      } else {
        motionQuery.removeListener(onMotionChange)
      }
      document.removeEventListener('visibilitychange', onVisibility)
      gl.deleteProgram(program)
      gl.deleteBuffer(buffer)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 h-full w-full"
      style={{ zIndex: 0 }}
      aria-hidden
    />
  )
}
