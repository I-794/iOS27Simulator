import { useEffect, useRef, useState, useSyncExternalStore, useCallback } from 'react'
import { useOS } from './store'
import type { AppId } from './types'

// ---------- shared clock (one interval for the whole OS) ----------
const listeners = new Set<() => void>()
let tick = Date.now()
let clockTimer: number | undefined
function ensureClock() {
  if (clockTimer) return
  clockTimer = window.setInterval(() => {
    tick = Date.now()
    listeners.forEach((l) => l())
  }, 1000)
}

/** Current time, re-rendering at most every `granularity` ms (default 1 minute). */
export function useNow(granularity = 60_000): number {
  ensureClock()
  const bucket = useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => Math.floor(tick / granularity),
  )
  return granularity <= 1000 ? tick : bucket * granularity + (tick % granularity)
}

/** Deep link route requested for an app (via notifications, Siri, Spotlight). */
export function useAppRoute(app: AppId, onRoute: (route: string) => void) {
  const route = useOS((s) => s.appRoutes[app])
  const nonce = useOS((s) => s.routeNonce)
  const cb = useRef(onRoute)
  cb.current = onRoute
  useEffect(() => {
    if (route) {
      cb.current(route)
      const st = useOS.getState()
      const next = { ...st.appRoutes }
      delete next[app]
      useOS.setState({ appRoutes: next })
    }
  }, [route, nonce, app])
}

/** Report what's on screen so Siri can use onscreen awareness. */
export function useOnscreen(app: AppId, context: string | undefined, entity?: Record<string, string>) {
  const key = JSON.stringify(entity ?? {})
  useEffect(() => {
    useOS.setState({ siriOnscreen: { app, context, entity } })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [app, context, key])
}

export interface LongPressHandlers {
  onPointerDown: (e: React.PointerEvent) => void
  onPointerUp: (e: React.PointerEvent) => void
  onPointerLeave: (e: React.PointerEvent) => void
  onPointerMove: (e: React.PointerEvent) => void
  onContextMenu: (e: React.MouseEvent) => void
  onClickCapture: (e: React.MouseEvent) => void
}

/** Long press (touch-and-hold) that also maps right-click to the same action. */
export function useLongPress(onLong: (el: HTMLElement, e: { x: number; y: number }) => void, ms = 450): LongPressHandlers {
  const timer = useRef<number | undefined>(undefined)
  const fired = useRef(false)
  const start = useRef<{ x: number; y: number } | null>(null)
  const clear = () => {
    window.clearTimeout(timer.current)
    timer.current = undefined
  }
  return {
    onPointerDown: (e) => {
      if (e.button !== 0) return
      fired.current = false
      start.current = { x: e.clientX, y: e.clientY }
      const el = e.currentTarget as HTMLElement
      clear()
      timer.current = window.setTimeout(() => {
        fired.current = true
        onLong(el, { x: e.clientX, y: e.clientY })
      }, ms)
    },
    onPointerUp: clear,
    onPointerLeave: clear,
    onPointerMove: (e) => {
      if (start.current && Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y) > 8) clear()
    },
    onContextMenu: (e) => {
      e.preventDefault()
      clear()
      fired.current = true
      onLong(e.currentTarget as HTMLElement, { x: e.clientX, y: e.clientY })
    },
    onClickCapture: (e) => {
      if (fired.current) {
        e.preventDefault()
        e.stopPropagation()
        fired.current = false
      }
    },
  }
}

/** Scale factor of the device stage (screen is transformed to fit the window). */
export function screenScale(): number {
  const el = document.querySelector('.screen') as HTMLElement | null
  if (!el) return 1
  return el.getBoundingClientRect().width / el.offsetWidth || 1
}

/** Pointer-drag helper that reports deltas in screen (unscaled) pixels. */
export function useDrag(handlers: {
  onStart?: (e: PointerEvent) => boolean | void
  onMove: (dx: number, dy: number, e: PointerEvent) => void
  onEnd: (dx: number, dy: number, vx: number, vy: number, e: PointerEvent) => void
}) {
  const h = useRef(handlers)
  h.current = handlers
  return useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return
    if (h.current.onStart && h.current.onStart(e.nativeEvent) === false) return
    const scale = screenScale()
    const x0 = e.clientX
    const y0 = e.clientY
    let lastX = x0
    let lastY = y0
    let lastT = performance.now()
    let vx = 0
    let vy = 0
    const move = (ev: PointerEvent) => {
      const now = performance.now()
      const dt = Math.max(1, now - lastT)
      vx = ((ev.clientX - lastX) / dt / scale) * 1000
      vy = ((ev.clientY - lastY) / dt / scale) * 1000
      lastX = ev.clientX
      lastY = ev.clientY
      lastT = now
      h.current.onMove((ev.clientX - x0) / scale, (ev.clientY - y0) / scale, ev)
    }
    const up = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      if (performance.now() - lastT > 80) {
        vx = 0
        vy = 0
      }
      h.current.onEnd((ev.clientX - x0) / scale, (ev.clientY - y0) / scale, vx, vy, ev)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
  }, [])
}

export function useDebounced<T>(value: T, ms = 150): T {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = window.setTimeout(() => setV(value), ms)
    return () => window.clearTimeout(t)
  }, [value, ms])
  return v
}

/** Simulated async work (e.g. "Apple Intelligence thinking") with a cancellable delay. */
export function useDelayed<T>(fn: () => T, deps: unknown[], ms = 600): { loading: boolean; value: T | undefined } {
  const [state, setState] = useState<{ loading: boolean; value: T | undefined }>({ loading: true, value: undefined })
  useEffect(() => {
    setState((s) => ({ ...s, loading: true }))
    const t = window.setTimeout(() => setState({ loading: false, value: fn() }), ms)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  return state
}
