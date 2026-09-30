import { createContext, useContext, useLayoutEffect, useRef, useState, useCallback, type ReactNode, type CSSProperties, useEffect } from 'react'
import { ChevronLeft, Search } from 'lucide-react'
import { springs, animateSpring, reducedMotion } from '../os/spring'
import { useDrag } from '../os/hooks'

// ======================= Navigation stack =======================

interface NavApi {
  push: (el: ReactNode, key?: string) => void
  pop: () => void
  popToRoot: () => void
  replaceTop: (el: ReactNode) => void
  depth: number
  isTop: boolean
}
const NavCtx = createContext<NavApi>({ push: () => {}, pop: () => {}, popToRoot: () => {}, replaceTop: () => {}, depth: 0, isTop: true })
export const useNav = () => useContext(NavCtx)

interface Entry {
  key: string
  el: ReactNode
  status: 'enter' | 'idle' | 'exit'
}

let navKey = 0

export function NavStack({ root, grouped, onDepthChange }: { root: ReactNode; grouped?: boolean; onDepthChange?: (d: number) => void }) {
  const [stack, setStack] = useState<Entry[]>([{ key: 'root', el: null, status: 'idle' }])
  const live = stack.filter((e) => e.status !== 'exit')
  const depth = live.length - 1

  useEffect(() => onDepthChange?.(depth), [depth, onDepthChange])

  const push = useCallback((el: ReactNode, key?: string) => {
    setStack((s) => [...s, { key: key ?? `nav-${++navKey}`, el, status: 'enter' }])
  }, [])
  const pop = useCallback(() => {
    setStack((s) => {
      const liveIdx = s.map((e, i) => (e.status !== 'exit' ? i : -1)).filter((i) => i > 0)
      const last = liveIdx[liveIdx.length - 1]
      if (last === undefined) return s
      return s.map((e, i) => (i === last ? { ...e, status: 'exit' } : e))
    })
  }, [])
  const popToRoot = useCallback(() => setStack((s) => s.map((e, i) => (i === 0 ? e : { ...e, status: 'exit' }))), [])
  const replaceTop = useCallback((el: ReactNode) => setStack((s) => (s.length === 1 ? s : [...s.slice(0, -1), { ...s[s.length - 1], el }])), [])
  const remove = useCallback((key: string) => setStack((s) => s.filter((e) => e.key !== key)), [])

  // Escape / hardware "back" pops the stack of the foreground app
  const rootRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const onBack = (e: Event) => {
      if (e.defaultPrevented || depth === 0) return
      const el = rootRef.current
      if (!el || !el.closest('.app-window.active')) return
      // only the innermost visible stack handles it
      if (el.querySelector('.nav-stack .nav-page:not([aria-hidden="true"]) .nav-stack')) return
      e.preventDefault()
      pop()
    }
    window.addEventListener('ios-back', onBack)
    return () => window.removeEventListener('ios-back', onBack)
  }, [depth, pop])


  return (
    <div className="nav-stack" ref={rootRef}>
      {stack.map((entry, i) => {
        const liveIndex = live.indexOf(entry)
        const covered = entry.status !== 'exit' && liveIndex < live.length - 1
        const api: NavApi = { push, pop, popToRoot, replaceTop, depth: Math.max(0, liveIndex), isTop: liveIndex === live.length - 1 }
        return (
          <NavCtx.Provider key={entry.key} value={api}>
            <NavPage entry={entry} index={i} covered={covered} onExited={() => remove(entry.key)} onSwipeBack={pop} grouped={grouped} canSwipe={liveIndex > 0}>
              {i === 0 ? root : entry.el}
            </NavPage>
          </NavCtx.Provider>
        )
      })}
    </div>
  )
}

function NavPage({ entry, index, covered, onExited, onSwipeBack, grouped, canSwipe, children }: { entry: Entry; index: number; covered: boolean; onExited: () => void; onSwipeBack: () => void; grouped?: boolean; canSwipe: boolean; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const shade = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)

  useLayoutEffect(() => {
    const el = ref.current!
    if (entry.status === 'enter' && index > 0) {
      animateSpring(el, [{ transform: 'translateX(100%)' }, { transform: 'translateX(0)' }], springs.push(), { fill: 'none' })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useLayoutEffect(() => {
    if (entry.status !== 'exit') return
    const el = ref.current!
    const from = getComputedStyle(el).transform
    const a = animateSpring(el, [{ transform: from === 'none' ? 'translateX(0)' : from }, { transform: 'translateX(100%)' }], springs.push())
    a.onfinish = onExited
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entry.status])

  const first = useRef(true)
  useLayoutEffect(() => {
    const el = ref.current!
    if (dragging.current) return
    if (first.current) {
      first.current = false
      return
    }
    const target = covered ? 'translateX(-30%)' : 'translateX(0)'
    const cur = getComputedStyle(el).transform
    el.style.transform = target
    if (!reducedMotion()) animateSpring(el, [{ transform: cur === 'none' ? 'translateX(0)' : cur }, { transform: target }], springs.push(), { fill: 'none' })
    if (shade.current) shade.current.style.opacity = covered ? '0.12' : '0'
  }, [covered])

  const onDown = useDrag({
    onStart: (e) => {
      if (!canSwipe) return false
      const r = ref.current!.getBoundingClientRect()
      if (e.clientX - r.left > 28) return false
      dragging.current = true
      return true
    },
    onMove: (dx) => {
      const el = ref.current!
      const x = Math.max(0, dx)
      el.style.transform = `translateX(${x}px)`
      const prev = el.previousElementSibling as HTMLElement | null
      if (prev) prev.style.transform = `translateX(calc(-30% + ${x * 0.3}px))`
    },
    onEnd: (dx, _dy, vx) => {
      dragging.current = false
      const el = ref.current!
      const w = el.offsetWidth
      const prev = el.previousElementSibling as HTMLElement | null
      if (dx > w * 0.35 || vx > 600) {
        if (prev) {
          const from = prev.style.transform
          prev.style.transform = 'translateX(0)'
          animateSpring(prev, [{ transform: from }, { transform: 'translateX(0)' }], springs.push(), { fill: 'none' })
        }
        onSwipeBack()
      } else {
        el.style.transform = 'translateX(0)'
        animateSpring(el, [{ transform: `translateX(${Math.max(0, dx)}px)` }, { transform: 'translateX(0)' }], springs.push(), { fill: 'none' })
        if (prev) {
          const from = prev.style.transform
          prev.style.transform = 'translateX(-30%)'
          animateSpring(prev, [{ transform: from }, { transform: 'translateX(-30%)' }], springs.push(), { fill: 'none' })
        }
      }
    },
  })

  return (
    <div ref={ref} className={`nav-page ${grouped ? 'grouped' : ''}`} onPointerDown={onDown} aria-hidden={covered || entry.status === 'exit'} inert={covered || entry.status === 'exit' ? true : undefined}>
      {children}
      <div className="page-shade" ref={shade} />
    </div>
  )
}

// ======================= Page with nav bar =======================

export function Page({
  title,
  large = true,
  back,
  onBack,
  leading,
  trailing,
  children,
  grouped,
  bottomExtra = 0,
  header,
  noNav,
  inlineTitle,
  subtitle,
  onScroll,
  scrollRef,
  className = '',
  style,
  bg,
  footer,
}: {
  title?: ReactNode
  large?: boolean
  back?: ReactNode | false
  onBack?: () => void
  leading?: ReactNode
  trailing?: ReactNode
  children: ReactNode
  grouped?: boolean
  bottomExtra?: number
  header?: ReactNode
  noNav?: boolean
  inlineTitle?: ReactNode
  subtitle?: ReactNode
  onScroll?: (top: number) => void
  scrollRef?: React.RefObject<HTMLDivElement | null>
  className?: string
  style?: CSSProperties
  bg?: string
  footer?: ReactNode
}) {
  const nav = useNav()
  const [scrolled, setScrolled] = useState(false)
  const showBack = back !== false && (nav.depth > 0 || !!onBack)
  const pageBg = bg ?? (grouped ? 'var(--grouped-background)' : 'var(--system-background)')
  return (
    <div className={`page ${className}`} style={{ ...style, background: pageBg, ['--page-bg' as string]: pageBg, ['--page-bottom-extra' as string]: `${bottomExtra}px` }}>
      {!noNav && (
        <div className={`navbar ${scrolled ? 'scrolled' : ''} ${!large ? 'always-inline' : ''}`}>
          <div className="edge" />
          {showBack && (
            <button className="bar-btn icon glass interactive" aria-label="Back" onClick={onBack ?? nav.pop}>
              <ChevronLeft size={26} strokeWidth={2.4} style={{ marginLeft: -2 }} />
            </button>
          )}
          {leading}
          <div className="inline-title">{inlineTitle ?? title}</div>
          <div className="spacer" />
          {trailing}
        </div>
      )}
      <div
        ref={scrollRef}
        className={`page-scroll scroll ${noNav ? 'no-nav' : ''}`}
        onScroll={(e) => {
          const top = (e.target as HTMLDivElement).scrollTop
          setScrolled(top > (large ? 38 : 4))
          onScroll?.(top)
        }}
      >
        {large && title && (
          <h1 className={`large-title ${subtitle ? 'with-sub' : ''}`} style={{ margin: 0 }}>
            {title}
          </h1>
        )}
        {large && subtitle && <div className="large-subtitle">{subtitle}</div>}
        {header}
        {children}
      </div>
      {footer}
    </div>
  )
}

export function BarButton({ children, onClick, label, tinted, prominent, style, disabled }: { children: ReactNode; onClick?: () => void; label: string; tinted?: boolean; prominent?: boolean; style?: CSSProperties; disabled?: boolean }) {
  const iconOnly = typeof children !== 'string'
  return (
    <button
      className={`bar-btn ${iconOnly ? 'icon' : ''} ${tinted ? 'tinted' : ''} ${prominent ? 'prominent' : 'glass interactive'}`}
      onClick={onClick}
      aria-label={label}
      style={style}
      disabled={disabled}
    >
      {children}
    </button>
  )
}

export function BarGroup({ children }: { children: ReactNode }) {
  return <div className="bar-group glass">{children}</div>
}

// ======================= Tab bar =======================

export interface TabDef<T extends string> {
  id: T
  label: string
  icon: ReactNode
}

export function TabBar<T extends string>({ tabs, value, onChange, onSearch, minimized, accessory, searchActive }: { tabs: TabDef<T>[]; value: T; onChange: (t: T) => void; onSearch?: () => void; minimized?: boolean; accessory?: ReactNode; searchActive?: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  const [pill, setPill] = useState({ x: 0, w: 0 })
  const idx = tabs.findIndex((t) => t.id === value)
  const visibleTabs = minimized ? tabs.filter((t) => t.id === value) : tabs
  useLayoutEffect(() => {
    const btns = ref.current?.querySelectorAll('button')
    const b = btns?.[minimized ? 0 : idx] as HTMLElement | undefined
    if (b) setPill({ x: b.offsetLeft, w: b.offsetWidth })
  }, [idx, minimized, tabs.length])
  return (
    <div className="tabbar-wrap">
      <div className={`tabbar glass ${minimized ? 'min' : ''}`} ref={ref} role="tablist">
        {!searchActive && <div className="tab-pill" style={{ width: pill.w, transform: `translateX(${pill.x - 4}px)`, left: 4 }} />}
        {visibleTabs.map((t) => (
          <button key={t.id} role="tab" aria-selected={t.id === value && !searchActive} onClick={() => onChange(t.id)} aria-label={t.label}>
            {t.icon}
            {!minimized && <span>{t.label}</span>}
          </button>
        ))}
      </div>
      {accessory}
      {onSearch && (
        <button className="tab-search glass interactive" onClick={onSearch} aria-label="Search" style={searchActive ? { color: 'var(--accent)' } : undefined}>
          <Search size={24} strokeWidth={2.3} />
        </button>
      )}
    </div>
  )
}
