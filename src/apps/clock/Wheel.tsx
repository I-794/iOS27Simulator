import { useEffect, useLayoutEffect, useRef, type ReactNode, type CSSProperties } from 'react'
import { screenScale } from '../../os/hooks'
import './wheel.css'

/**
 * iOS-style picker wheel (UIPickerView). Drag, scroll-wheel, click or arrow keys.
 * Rendering is driven imperatively so dragging never re-renders React.
 */
export interface WheelItem<T> { value: T; label: string }

const ITEM = 32
const VISIBLE = 7
const H = ITEM * VISIBLE
const STEP = 20
const R = ITEM / ((STEP * Math.PI) / 180)

export function Wheel<T extends string | number>({ items, value, onChange, width = 64, align = 'center', loop = false, label, suffix }: {
  items: WheelItem<T>[]
  value: T
  onChange: (v: T) => void
  width?: number
  align?: 'left' | 'center' | 'right'
  loop?: boolean
  label?: string
  /** fixed unit label shown beside the selected row ("hours", "min") */
  suffix?: string
}) {
  const reps = loop ? 9 : 1
  const n = items.length
  const mid = loop ? Math.floor(reps / 2) * n : 0
  const idxOf = (v: T) => Math.max(0, items.findIndex((i) => i.value === v))
  const pos = useRef(mid + idxOf(value))
  const inner = useRef<HTMLDivElement>(null)
  const root = useRef<HTMLDivElement>(null)
  const raf = useRef(0)
  const settleT = useRef<number | undefined>(undefined)
  const cb = useRef(onChange)
  cb.current = onChange
  const lastEmitted = useRef<T>(value)

  const apply = () => {
    const el = inner.current
    if (!el) return
    const p = pos.current
    const kids = el.children
    const lo = Math.floor(p - 5)
    const hi = Math.ceil(p + 5)
    for (let i = 0; i < kids.length; i++) {
      const k = kids[i] as HTMLElement
      if (i < lo || i > hi) {
        if (k.style.visibility !== 'hidden') k.style.visibility = 'hidden'
        continue
      }
      const a = (i - p) * STEP
      if (Math.abs(a) > 88) {
        k.style.visibility = 'hidden'
        continue
      }
      k.style.visibility = ''
      k.style.transform = `translateZ(${-R}px) rotateX(${-a}deg) translateZ(${R}px)`
      k.style.opacity = String(Math.max(0.15, Math.cos((a * Math.PI) / 180)))
      k.classList.toggle('sel', Math.abs(a) < STEP / 2)
    }
  }

  const clampPos = (p: number) => (loop ? p : Math.max(0, Math.min(n - 1, p)))

  const settle = (target: number) => {
    cancelAnimationFrame(raf.current)
    target = clampPos(Math.round(target))
    const step = () => {
      const d = target - pos.current
      if (Math.abs(d) < 0.004) {
        pos.current = target
        apply()
        // re-center loop wheels silently
        if (loop) {
          const norm = ((target % n) + n) % n
          pos.current = mid + norm
          apply()
        }
        const v = items[((target % n) + n) % n].value
        if (v !== lastEmitted.current) {
          lastEmitted.current = v
          cb.current(v)
        }
        return
      }
      pos.current += d * 0.22
      apply()
      raf.current = requestAnimationFrame(step)
    }
    raf.current = requestAnimationFrame(step)
  }

  useLayoutEffect(apply)
  useEffect(() => () => cancelAnimationFrame(raf.current), [])

  // follow external value changes
  useEffect(() => {
    const cur = ((Math.round(pos.current) % n) + n) % n
    const want = idxOf(value)
    lastEmitted.current = value
    if (cur !== want) {
      let target = Math.round(pos.current) + (want - cur)
      if (loop && Math.abs(want - cur) > n / 2) target += want > cur ? -n : n
      settle(target)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, n])

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return
    e.stopPropagation()
    cancelAnimationFrame(raf.current)
    const scale = screenScale()
    const y0 = e.clientY
    const p0 = pos.current
    let lastY = y0
    let lastT = performance.now()
    let v = 0
    let moved = false
    const move = (ev: PointerEvent) => {
      const now = performance.now()
      const dy = (ev.clientY - y0) / scale
      if (Math.abs(dy) > 3) moved = true
      v = (((ev.clientY - lastY) / scale) / Math.max(1, now - lastT)) * 1000
      lastY = ev.clientY
      lastT = now
      let p = p0 - dy / ITEM
      if (!loop) {
        if (p < 0) p = p * 0.35
        if (p > n - 1) p = n - 1 + (p - n + 1) * 0.35
      }
      pos.current = p
      apply()
    }
    const up = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      if (!moved) {
        // tap a row → select it
        const rect = root.current?.getBoundingClientRect()
        if (rect) {
          const dyc = (ev.clientY - (rect.top + rect.height / 2)) / scale
          settle(pos.current + Math.round(dyc / ITEM))
          return
        }
      }
      if (performance.now() - lastT > 90) v = 0
      settle(pos.current - (v / ITEM) * 0.22)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
  }

  const onWheel = (e: React.WheelEvent) => {
    e.stopPropagation()
    cancelAnimationFrame(raf.current)
    pos.current = clampPos(pos.current + e.deltaY / ITEM / 2.2)
    apply()
    window.clearTimeout(settleT.current)
    settleT.current = window.setTimeout(() => settle(pos.current), 110)
  }

  const all: WheelItem<T>[] = loop ? Array.from({ length: reps }, () => items).flat() : items
  return (
    <div
      ref={root}
      className={`clk-wheel align-${align} ${suffix ? "has-suffix" : ""}`}
      style={{ width, height: H }}
      onPointerDown={onPointerDown}
      onWheel={onWheel}
      role="listbox"
      aria-label={label}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'ArrowDown') { e.preventDefault(); settle(Math.round(pos.current) + 1) }
        if (e.key === 'ArrowUp') { e.preventDefault(); settle(Math.round(pos.current) - 1) }
      }}
    >
      <div className="clk-wheel-inner" ref={inner}>
        {all.map((it, i) => (
          <div key={i} className="clk-wheel-item" role="option" aria-selected={it.value === value && (!loop || Math.floor(i / n) === Math.floor(reps / 2))}>
            {it.label}
          </div>
        ))}
      </div>
      {suffix && <div className="clk-wheel-suffix">{suffix}</div>}
    </div>
  )
}

/** Container that draws the shared selection band behind a row of wheels. */
export function WheelGroup({ children, style, className = '' }: { children: ReactNode; style?: CSSProperties; className?: string }) {
  return (
    <div className={`clk-wheel-group ${className}`} style={style}>
      <div className="clk-wheel-band" />
      {children}
    </div>
  )
}

export const range = (a: number, b: number, pad = false, stepN = 1): WheelItem<number>[] => {
  const out: WheelItem<number>[] = []
  for (let i = a; i <= b; i += stepN) out.push({ value: i, label: pad ? String(i).padStart(2, '0') : String(i) })
  return out
}

/** Hour/minute(/AM-PM) wheels bound to a 24h hour + minute. */
export function TimeWheels({ hour, minute, onChange, h24, minuteStep = 1 }: { hour: number; minute: number; onChange: (h: number, m: number) => void; h24?: boolean; minuteStep?: number }) {
  const pm = hour >= 12
  const h12 = hour % 12 || 12
  return (
    <WheelGroup>
      {h24 ? (
        <Wheel label="Hour" items={range(0, 23, true)} value={hour} onChange={(h) => onChange(h, minute)} loop width={70} align="right" />
      ) : (
        <Wheel label="Hour" items={range(1, 12)} value={h12} onChange={(h) => onChange((h % 12) + (pm ? 12 : 0), minute)} loop width={70} align="right" />
      )}
      <Wheel label="Minute" items={range(0, 59, true, minuteStep)} value={minute - (minute % minuteStep)} onChange={(m) => onChange(hour, m)} loop width={70} align="left" />
      {!h24 && (
        <Wheel label="AM or PM" items={[{ value: 'AM', label: 'AM' }, { value: 'PM', label: 'PM' }]} value={pm ? 'PM' : 'AM'} onChange={(v) => onChange((hour % 12) + (v === 'PM' ? 12 : 0), minute)} width={64} align="left" />
      )}
    </WheelGroup>
  )
}
