import { beforeAll } from 'vitest'

// Vitest 3.x + jsdom 25 has a known issue where window.localStorage is a
// plain object without Storage methods (clear, getItem, setItem, etc.).
// Replace it with a fully-functional in-memory Storage polyfill.
beforeAll(() => {
  if (typeof window !== 'undefined') {
    const hasClear = typeof window.localStorage?.clear === 'function'
    const hasGetItem = typeof window.localStorage?.getItem === 'function'
    if (!hasClear || !hasGetItem) {
      const store = new Map<string, string>()
      const storage: Storage = {
        getItem(key: string) { return store.get(key) ?? null },
        setItem(key: string, value: string) { store.set(key, String(value)) },
        removeItem(key: string) { store.delete(key) },
        clear() { store.clear() },
        key(index: number) {
          const keys = Array.from(store.keys())
          return keys[index] ?? null
        },
        get length() { return store.size },
      }
      Object.defineProperty(window, 'localStorage', { value: storage, writable: true, configurable: true })
    }
  }
})

// jsdom does not implement HTMLCanvasElement.prototype.getContext.
// For '2d': return a minimal CanvasRenderingContext2D stub.
// For 'webgl'/'webgl2'/'experimental-webgl': return null so components
// fall back to their non-WebGL rendering paths (e.g. CSS-only shaders).
if (typeof HTMLCanvasElement !== 'undefined') {
  HTMLCanvasElement.prototype.getContext = function (contextId: string, ..._args: unknown[]): RenderingContext | CanvasRenderingContext2D | null {
    if (contextId === '2d') {
      return {
        fillRect: () => {},
        clearRect: () => {},
        getImageData: (_x: number, _y: number, _w: number, _h: number) => ({ data: new Uint8ClampedArray(0) }),
        putImageData: () => {},
        createImageData: () => ({ data: new Uint8ClampedArray(0) }),
        setTransform: () => {},
        drawImage: () => {},
        save: () => {},
        fillText: () => {},
        restore: () => {},
        beginPath: () => {},
        moveTo: () => {},
        lineTo: () => {},
        closePath: () => {},
        stroke: () => {},
        translate: () => {},
        scale: () => {},
        rotate: () => {},
        arc: () => {},
        fill: () => {},
        measureText: () => ({ width: 0 }),
        transform: () => {},
        rect: () => {},
        clip: () => {},
        quadraticCurveTo: () => {},
        bezierCurveTo: () => {},
        createLinearGradient: () => ({ addColorStop: () => {} }),
        createRadialGradient: () => ({ addColorStop: () => {} }),
        canvas: { width: 0, height: 0 },
      } as unknown as CanvasRenderingContext2D
    }
    // WebGL contexts: return null so the component uses its CSS fallback path
    return null
  }
}

// jsdom does not implement window.matchMedia.
// Stub it so components that check media queries (e.g. prefers-color-scheme) don't crash.
if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
  Object.defineProperty(window, 'matchMedia', {
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
    writable: true,
    configurable: true,
  })
}
