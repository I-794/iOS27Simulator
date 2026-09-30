import { useRef, useLayoutEffect, useState, type ReactNode, type CSSProperties, forwardRef } from 'react'
import { Search, X, Mic } from 'lucide-react'
import { screenScale } from '../os/hooks'
import { contactById, initials } from '../os/data/people'

export function Glass({ className = '', variant = 'medium', as: Tag = 'div', children, style, ...rest }: {
  className?: string
  variant?: 'clear' | 'light' | 'medium' | 'heavy' | 'dark'
  as?: 'div' | 'button' | 'section' | 'nav' | 'header' | 'footer'
  children?: ReactNode
  style?: CSSProperties
} & React.HTMLAttributes<HTMLElement> & { onClick?: (e: React.MouseEvent) => void; type?: string; 'aria-label'?: string; disabled?: boolean }) {
  const v = variant === 'medium' ? '' : variant === 'dark' ? 'dark-glass' : variant
  const T = Tag as 'div'
  return (
    <T className={`glass ${v} ${className}`} style={style} {...rest}>
      {children}
    </T>
  )
}

export function Switch({ checked, onChange, disabled, label, color }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; label?: string; color?: string }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      className="ios-switch"
      style={color ? ({ '--switch-on': color } as CSSProperties) : undefined}
      onClick={(e) => {
        e.stopPropagation()
        onChange(!checked)
      }}
    >
      <span className="knob" />
    </button>
  )
}

export function Slider({ value, onChange, min = 0, max = 1, step, left, right, color, label, onCommit, style }: {
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
  step?: number
  left?: ReactNode
  right?: ReactNode
  color?: string
  label?: string
  onCommit?: (v: number) => void
  style?: CSSProperties
}) {
  const track = useRef<HTMLDivElement>(null)
  const pct = ((value - min) / (max - min)) * 100
  const setFrom = (clientX: number) => {
    const r = track.current!.getBoundingClientRect()
    let v = min + Math.min(1, Math.max(0, (clientX - r.left) / r.width)) * (max - min)
    if (step) v = Math.round(v / step) * step
    onChange(+v.toFixed(4))
    return v
  }
  return (
    <div
      className="ios-slider"
      style={{ ...style, ...(color ? ({ '--slider-color': color } as CSSProperties) : {}) }}
      role="slider"
      aria-label={label}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      tabIndex={0}
      onKeyDown={(e) => {
        const s = step ?? (max - min) / 20
        if (e.key === 'ArrowRight' || e.key === 'ArrowUp') onChange(Math.min(max, value + s))
        if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') onChange(Math.max(min, value - s))
      }}
      onPointerDown={(e) => {
        e.stopPropagation()
        let last = setFrom(e.clientX)
        const move = (ev: PointerEvent) => (last = setFrom(ev.clientX))
        const up = () => {
          window.removeEventListener('pointermove', move)
          window.removeEventListener('pointerup', up)
          onCommit?.(last)
        }
        window.addEventListener('pointermove', move)
        window.addEventListener('pointerup', up)
      }}
    >
      {left && <span className="cap" style={{ marginRight: 10 }}>{left}</span>}
      <div className="track" ref={track} style={{ overflow: 'visible' }}>
        <div className="fill" style={{ width: `${pct}%` }} />
        <div className="thumb" style={{ left: `${pct}%` }} />
      </div>
      {right && <span className="cap" style={{ marginLeft: 10 }}>{right}</span>}
    </div>
  )
}

/** Tall Control Center style slider (fills from the bottom). */
export function BigSlider({ value, onChange, icon, label, width = 70, height = 150, radius = 30, className = '' }: {
  value: number
  onChange: (v: number) => void
  icon: ReactNode
  label: string
  width?: number
  height?: number
  radius?: number
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(false)
  return (
    <div
      ref={ref}
      className={`big-slider glass clear ${className}`}
      role="slider"
      aria-label={label}
      aria-valuenow={Math.round(value * 100)}
      tabIndex={0}
      style={{ width, height, borderRadius: radius, transform: active ? 'scale(1.04)' : undefined }}
      onKeyDown={(e) => {
        if (e.key === 'ArrowUp') onChange(Math.min(1, value + 0.05))
        if (e.key === 'ArrowDown') onChange(Math.max(0, value - 0.05))
      }}
      onPointerDown={(e) => {
        e.stopPropagation()
        setActive(true)
        const scale = screenScale()
        const y0 = e.clientY
        const v0 = value
        const h = ref.current!.offsetHeight
        const move = (ev: PointerEvent) => onChange(Math.min(1, Math.max(0, v0 - (ev.clientY - y0) / scale / h)))
        const up = () => {
          setActive(false)
          window.removeEventListener('pointermove', move)
          window.removeEventListener('pointerup', up)
        }
        window.addEventListener('pointermove', move)
        window.addEventListener('pointerup', up)
      }}
    >
      <div className="big-slider-fill" style={{ height: `${value * 100}%` }} />
      <div className="big-slider-icon" style={{ color: value > 0.18 ? '#1c1c1e' : '#fff' }}>{icon}</div>
    </div>
  )
}

export function Segmented<T extends string>({ options, value, onChange, labels, style }: { options: readonly T[]; value: T; onChange: (v: T) => void; labels?: Partial<Record<T, ReactNode>>; style?: CSSProperties }) {
  const ref = useRef<HTMLDivElement>(null)
  const [thumb, setThumb] = useState({ x: 0, w: 0 })
  const idx = Math.max(0, options.indexOf(value))
  useLayoutEffect(() => {
    const el = ref.current?.children[idx + 1] as HTMLElement | undefined
    if (el) setThumb({ x: el.offsetLeft, w: el.offsetWidth })
  }, [idx, options.length])
  return (
    <div className="segmented" ref={ref} role="tablist" style={style}>
      <div className="seg-thumb" style={{ width: thumb.w, transform: `translateX(${thumb.x}px)`, left: 0 }} />
      {options.map((o) => (
        <button key={o} role="tab" aria-pressed={o === value} aria-selected={o === value} onClick={() => onChange(o)}>
          {labels?.[o] ?? o}
        </button>
      ))}
    </div>
  )
}

export const SearchField = forwardRef<HTMLInputElement, { value: string; onChange: (v: string) => void; placeholder?: string; autoFocus?: boolean; onSubmit?: () => void; mic?: boolean; onFocus?: () => void; style?: CSSProperties; className?: string }>(
  function SearchField({ value, onChange, placeholder = 'Search', autoFocus, onSubmit, mic = true, onFocus, style, className = '' }, ref) {
    return (
      <label className={`search-field ${className}`} style={style}>
        <Search size={17} strokeWidth={2.4} />
        <input
          ref={ref}
          value={value}
          placeholder={placeholder}
          autoFocus={autoFocus}
          onFocus={onFocus}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onSubmit?.()}
          aria-label={placeholder}
          enterKeyHint="search"
        />
        {value ? (
          <button aria-label="Clear" onClick={() => onChange('')} style={{ display: 'grid', placeItems: 'center', width: 18, height: 18, borderRadius: 9, background: 'var(--label-tertiary)', color: 'var(--system-background)' }}>
            <X size={12} strokeWidth={3} />
          </button>
        ) : mic ? <Mic size={18} strokeWidth={2.2} /> : null}
      </label>
    )
  },
)

export function Button({ children, variant = 'filled', size, block, onClick, disabled, style, className = '', label }: {
  children: ReactNode
  variant?: 'filled' | 'tinted' | 'gray' | 'plain' | 'destructive' | 'glass'
  size?: 'small' | 'medium'
  block?: boolean
  onClick?: (e: React.MouseEvent) => void
  disabled?: boolean
  style?: CSSProperties
  className?: string
  label?: string
}) {
  const v = variant === 'glass' ? 'glass interactive' : variant
  return (
    <button className={`btn ${v} ${size ?? ''} ${block ? 'block' : ''} ${className}`} onClick={onClick} disabled={disabled} style={style} aria-label={label}>
      {children}
    </button>
  )
}

export function Avatar({ id, size = 40, name, color, style }: { id?: string; size?: number; name?: string; color?: string; style?: CSSProperties }) {
  const c = id ? contactById(id) : undefined
  const bg = color ?? c?.color ?? '#8e8e93'
  const text = id === 'me' ? 'JP' : c ? initials(c.id) : (name ?? '?').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
  return (
    <div
      className="avatar"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.4,
        background: `linear-gradient(180deg, color-mix(in srgb, ${bg} 70%, #fff), ${bg})`,
        ...style,
      }}
      aria-hidden
    >
      {text}
    </div>
  )
}

export function Badge({ n }: { n: number }) {
  if (!n) return null
  return <span className="badge">{n > 99 ? '99+' : n}</span>
}

export function Chip({ children, active, onClick, style }: { children: ReactNode; active?: boolean; onClick?: () => void; style?: CSSProperties }) {
  return (
    <button className={`chip ${active ? 'active' : ''}`} onClick={onClick} style={style} aria-pressed={active}>
      {children}
    </button>
  )
}

export function Spinner({ size = 20 }: { size?: number }) {
  return <span className="spinner" style={{ width: size, height: size }} role="progressbar" aria-label="Loading" />
}

/** Apple Intelligence sparkle mark (original drawing). */
export function AISparkle({ size = 18, color }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <defs>
        <linearGradient id="ais" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ff9f0a" />
          <stop offset=".45" stopColor="#ff375f" />
          <stop offset="1" stopColor="#5e5ce6" />
        </linearGradient>
      </defs>
      <path d="M12 2c.5 4.8 2.7 7 7.5 7.5v1C14.7 11 12.5 13.2 12 18h-1c-.5-4.8-2.7-7-7.5-7.5v-1C8.3 9 10.5 6.8 11 2z" fill={color ?? 'url(#ais)'} />
      <path d="M19 14c.2 2.2 1.1 3.1 3.3 3.3v.6c-2.2.2-3.1 1.1-3.3 3.3h-.6c-.2-2.2-1.1-3.1-3.3-3.3v-.6c2.2-.2 3.1-1.1 3.3-3.3z" fill={color ?? 'url(#ais)'} />
    </svg>
  )
}
