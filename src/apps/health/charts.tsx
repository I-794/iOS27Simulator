import { useRef, useState } from 'react'

export type Range = 'D' | 'W' | 'M' | '6M' | 'Y'
export const RANGES: Range[] = ['D', 'W', 'M', '6M', 'Y']

export function seeded(seed: number) {
  let s = seed >>> 0
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296)
}

export interface Bar { label: string; v: number; lo?: number; hi?: number; tick?: boolean }

/** Bar chart with touch scrubbing (select nearest bar while dragging). */
export function BarChart({ bars, color, unit, fmt, avgLabel, rangeBars, goal, height = 200 }: { bars: Bar[]; color: string; unit: string; fmt: (n: number) => string; avgLabel: string; rangeBars?: boolean; goal?: number; height?: number }) {
  const [sel, setSel] = useState<number | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const max = Math.max(...bars.map((b) => (rangeBars ? b.hi ?? b.v : b.v)), goal ?? 0) * 1.12 || 1
  const min = rangeBars ? Math.min(...bars.map((b) => b.lo ?? b.v)) * 0.85 : 0
  const valid = bars.filter((b) => b.v > 0)
  const avg = valid.reduce((a, b) => a + b.v, 0) / (valid.length || 1)
  const pick = (x: number) => {
    const r = ref.current!.getBoundingClientRect()
    const i = Math.floor(((x - r.left) / r.width) * bars.length)
    setSel(Math.max(0, Math.min(bars.length - 1, i)))
  }
  const y = (v: number) => height - ((v - min) / (max - min)) * height
  const shown = sel !== null ? bars[sel] : null
  return (
    <div className="hl-chart">
      <div className="hl-chart-head">
        <span className="hl-chart-k">{shown ? (rangeBars ? 'RANGE' : 'TOTAL') : avgLabel}</span>
        <span className="hl-chart-v">{shown ? (rangeBars ? `${fmt(shown.lo ?? 0)}–${fmt(shown.hi ?? 0)}` : fmt(shown.v)) : rangeBars ? `${fmt(Math.min(...bars.map((b) => b.lo ?? b.v)))}–${fmt(Math.max(...bars.map((b) => b.hi ?? b.v)))}` : fmt(avg)} <small>{unit}</small></span>
        <span className="hl-chart-d">{shown ? shown.label : 'Tap or drag on the chart'}</span>
      </div>
      <div
        ref={ref}
        className="hl-chart-area"
        style={{ height }}
        role="slider"
        aria-label="Chart scrubber"
        aria-valuemin={0}
        aria-valuemax={bars.length - 1}
        aria-valuenow={sel ?? 0}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight') setSel((s) => Math.min(bars.length - 1, (s ?? -1) + 1))
          if (e.key === 'ArrowLeft') setSel((s) => Math.max(0, (s ?? bars.length) - 1))
          if (e.key === 'Escape') setSel(null)
        }}
        onPointerDown={(e) => {
          e.stopPropagation()
          pick(e.clientX)
          const move = (ev: PointerEvent) => pick(ev.clientX)
          const up = () => {
            window.removeEventListener('pointermove', move)
            window.removeEventListener('pointerup', up)
          }
          window.addEventListener('pointermove', move)
          window.addEventListener('pointerup', up)
        }}
      >
        <svg width="100%" height={height} preserveAspectRatio="none" viewBox={`0 0 ${bars.length * 10} ${height}`}>
          {[0.25, 0.5, 0.75].map((f) => <line key={f} x1="0" x2={bars.length * 10} y1={height * f} y2={height * f} stroke="var(--separator)" strokeWidth="0.5" vectorEffect="non-scaling-stroke" strokeDasharray="2 3" />)}
          {goal && <line x1="0" x2={bars.length * 10} y1={y(goal)} y2={y(goal)} stroke={color} strokeOpacity=".6" strokeWidth="1" vectorEffect="non-scaling-stroke" strokeDasharray="4 3" />}
          {!rangeBars && <line x1="0" x2={bars.length * 10} y1={y(avg)} y2={y(avg)} stroke="var(--label-tertiary)" strokeWidth="1" vectorEffect="non-scaling-stroke" />}
          {bars.map((b, i) => {
            const w = bars.length > 40 ? 6 : 6.4
            const x = i * 10 + (10 - w) / 2
            const top = rangeBars ? y(b.hi ?? b.v) : y(b.v)
            const bot = rangeBars ? y(b.lo ?? b.v) : height
            return <rect key={i} x={x} y={top} width={w} height={Math.max(rangeBars ? 3 : 0, bot - top)} rx={Math.min(3, w / 2)} fill={color} opacity={sel === null || sel === i ? 1 : 0.35} style={{ transition: 'opacity .15s, y .4s, height .4s' }} />
          })}
        </svg>
        {sel !== null && <div className="hl-chart-cursor" style={{ left: `${((sel + 0.5) / bars.length) * 100}%` }} />}
      </div>
      <div className="hl-chart-x">
        {bars.map((b, i) => (b.tick ? <span key={i} style={{ left: `${((i + 0.5) / bars.length) * 100}%` }}>{b.label.split(' ')[0]}</span> : null))}
      </div>
    </div>
  )
}

const DOW = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function makeSeries(metric: 'steps' | 'hr' | 'sleep' | 'energy', range: Range, week: number[]): Bar[] {
  const rnd = seeded(metric.length * 97 + range.length * 13 + range.charCodeAt(0))
  const now = new Date()
  const base = metric === 'steps' ? 8200 : metric === 'hr' ? 74 : metric === 'sleep' ? 7.3 : 430
  const spread = metric === 'steps' ? 3800 : metric === 'hr' ? 10 : metric === 'sleep' ? 1.2 : 120
  const mk = (label: string, factor = 1, tick = false): Bar => {
    const v = Math.max(0, base + (rnd() - 0.5) * 2 * spread) * factor
    if (metric === 'hr') {
      const lo = Math.round(v - 12 - rnd() * 8)
      const hi = Math.round(v + 20 + rnd() * 50)
      return { label, v: Math.round(v), lo, hi, tick }
    }
    return { label, v: metric === 'sleep' ? +v.toFixed(1) : Math.round(v), tick }
  }
  switch (range) {
    case 'D':
      return Array.from({ length: 24 }, (_, h) => {
        const active = h >= 7 && h <= 22
        const label = `${h % 12 || 12} ${h < 12 ? 'AM' : 'PM'}`
        if (metric === 'steps') {
          const v = h > now.getHours() ? 0 : active ? Math.round(rnd() * (h === 7 || h === 15 || h === 17 ? 1600 : 700)) : Math.round(rnd() * 30)
          return { label, v, tick: h % 6 === 0 }
        }
        if (metric === 'hr') {
          const b = active ? 70 + rnd() * 15 : 56 + rnd() * 6
          return { label, v: Math.round(b), lo: Math.round(b - 8), hi: Math.round(b + (h === 7 ? 80 : 18)), tick: h % 6 === 0 }
        }
        return { label, v: Math.round(rnd() * 40), tick: h % 6 === 0 }
      })
    case 'W': {
      const today = now.getDay()
      return Array.from({ length: 7 }, (_, i) => {
        const d = (today - 6 + i + 7) % 7
        if (metric === 'steps') return { label: `${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d]}`, v: week[i] ?? 0, tick: true }
        const b = mk(DOW[d], 1, true)
        return { ...b, label: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d] }
      })
    }
    case 'M':
      return Array.from({ length: 30 }, (_, i) => {
        const d = new Date(now.getTime() - (29 - i) * 86400000)
        return mk(`${MON[d.getMonth()]} ${d.getDate()}`, 1, i % 7 === 0)
      })
    case '6M':
      return Array.from({ length: 26 }, (_, i) => {
        const d = new Date(now.getTime() - (25 - i) * 7 * 86400000)
        return mk(`Week of ${MON[d.getMonth()]} ${d.getDate()}`, 1, d.getDate() <= 7)
      })
    case 'Y':
      return Array.from({ length: 12 }, (_, i) => {
        const m = (now.getMonth() - 11 + i + 12) % 12
        return mk(MON[m], 1, true)
      })
  }
}
