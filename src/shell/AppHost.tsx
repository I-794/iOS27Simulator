import { Suspense, useEffect, useLayoutEffect, useRef, useState, memo } from 'react'
import { useOS, type Rect } from '../os/store'
import type { AppId } from '../os/types'
import { APP_COMPONENTS } from '../apps/registry'
import { AppIconArt, ICONS } from '../icons/AppIconArt'
import { springs, animateSpring, reducedMotion } from '../os/spring'
import { screenScale } from '../os/hooks'
import { useShell } from './shellState'

const MAX_MOUNTED = 5

function findIconRect(app: AppId): Rect | null {
  const screen = document.querySelector('.screen') as HTMLElement | null
  if (!screen) return null
  const candidates = Array.from(screen.querySelectorAll(`.home .app-icon-art[data-app="${app}"]`)) as HTMLElement[]
  const sr = screen.getBoundingClientRect()
  const s = screenScale()
  for (const el of candidates) {
    const r = el.getBoundingClientRect()
    const x = (r.left - sr.left) / s
    if (x >= -1 && x < screen.offsetWidth - 10 && r.width > 0) return { x, y: (r.top - sr.top) / s, w: r.width / s, h: r.height / s }
  }
  return null
}

export function AppHost() {
  const openApp = useOS((s) => s.openApp)
  const overlay = useOS((s) => s.overlay)
  const locked = useOS((s) => s.locked)
  const [mounted, setMounted] = useState<AppId[]>([])
  const [closing, setClosing] = useState<AppId | null>(null)

  useEffect(() => {
    if (!openApp) return
    setMounted((m) => [openApp, ...m.filter((a) => a !== openApp)].slice(0, MAX_MOUNTED))
  }, [openApp])

  // when going home, keep the last app rendered during its close animation
  const prevOpen = useRef<AppId | null>(null)
  useEffect(() => {
    if (prevOpen.current && !openApp) setClosing(prevOpen.current)
    prevOpen.current = openApp
  }, [openApp])

  // unmount apps that were force-quit from the switcher
  const recents = useOS((s) => s.recents)
  useEffect(() => {
    setMounted((m) => m.filter((a) => recents.includes(a)))
  }, [recents])

  useEffect(() => {
    if (locked) setMounted((m) => m)
  }, [locked])

  return (
    <>
      <div className="app-layer">
        {mounted.map((app) => (
          <AppWindow key={app} app={app} active={app === openApp} closing={closing === app} onClosed={() => setClosing(null)} />
        ))}
      </div>
      {overlay === 'switcher' && <AppSwitcher />}
      {!locked && <HomeIndicatorGesture />}
    </>
  )
}

const AppWindow = memo(function AppWindow({ app, active, closing, onClosed }: { app: AppId; active: boolean; closing: boolean; onClosed: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const iconRef = useRef<HTMLDivElement>(null)
  const Comp = APP_COMPONENTS[app]
  const wasActive = useRef(false)
  const theme = useOS((s) => s.theme)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const screen = el.closest('.screen') as HTMLElement
    const W = screen.offsetWidth
    const H = screen.offsetHeight
    const icon = iconRef.current!
    if (active && !wasActive.current) {
      wasActive.current = true
      const st = useOS.getState()
      const rect = st.launchRect ?? findIconRect(app)
      el.style.visibility = 'visible'
      el.style.pointerEvents = 'auto'
      if (rect && !reducedMotion()) {
        const sx = rect.w / W
        const sy = rect.h / H
        const from = `translate(${rect.x}px, ${rect.y}px) scale(${sx}, ${sy})`
        useShell.getState().set({ appLaunching: true })
        const a = animateSpring(el, [{ transform: from, borderRadius: `${14 / sx}px ${14 / sy}px` }, { transform: 'translate(0,0) scale(1,1)', borderRadius: 'var(--screen-radius)' }], springs.appOpen(), { fill: 'none' })
        icon.style.opacity = '1'
        icon.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 180, delay: 60, fill: 'forwards', easing: 'ease-out' })
        a.onfinish = () => useShell.getState().set({ appLaunching: false })
      } else {
        el.animate([{ opacity: 0, transform: 'scale(.94)' }, { opacity: 1, transform: 'scale(1)' }], { duration: 260, easing: 'cubic-bezier(.2,.9,.3,1)' })
        icon.style.opacity = '0'
      }
      return
    }
    if (!active && wasActive.current) {
      wasActive.current = false
      if (!closing) {
        // switching to another app: hide immediately
        el.style.visibility = 'hidden'
        el.style.pointerEvents = 'none'
        return
      }
      const rect = findIconRect(app)
      const current = el.style.transform || 'translate(0,0) scale(1,1)'
      if (rect && !reducedMotion()) {
        const sx = rect.w / W
        const sy = rect.h / H
        const to = `translate(${rect.x}px, ${rect.y}px) scale(${sx}, ${sy})`
        const a = animateSpring(el, [{ transform: current, borderRadius: 'var(--screen-radius)' }, { transform: to, borderRadius: `${14 / sx}px ${14 / sy}px` }], springs.appClose(), { fill: 'forwards' })
        icon.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 220, delay: 40, fill: 'forwards' })
        a.onfinish = () => {
          el.style.visibility = 'hidden'
          el.style.pointerEvents = 'none'
          el.style.transform = ''
          a.cancel()
          icon.getAnimations().forEach((x) => x.cancel())
          icon.style.opacity = '0'
          onClosed()
        }
      } else {
        const a = el.animate([{ opacity: 1, transform: current }, { opacity: 0, transform: 'scale(.85)' }], { duration: 220, easing: 'ease-in' })
        a.onfinish = () => {
          el.style.visibility = 'hidden'
          el.style.pointerEvents = 'none'
          el.style.transform = ''
          onClosed()
        }
      }
    }
  }, [active, closing, app, onClosed])

  return (
    <div
      ref={ref}
      className={`app-window ${active ? 'active' : ''}`}
      data-app={app}
      style={{ visibility: 'hidden', pointerEvents: 'none' }}
      aria-hidden={!active}
      role="application"
      aria-label={ICONS[app].name}
      inert={!active ? true : undefined}
    >
      <Suspense fallback={<div className="app-root launch-screen" data-theme={theme} />}>
        <Comp />
      </Suspense>
      <div className="launch-icon" ref={iconRef} style={{ opacity: 0 }}>
        <AppIconArt app={app} size={120} />
      </div>
    </div>
  )
})

/** Bottom home indicator: swipe up to go home, pause for App Switcher, swipe sideways to switch apps. */
function HomeIndicatorGesture() {
  const openApp = useOS((s) => s.openApp)
  const overlay = useOS((s) => s.overlay)
  const theme = useOS((s) => s.theme)
  const override = useShell((s) => s.statusOverride)
  const keyboard = useOS((s) => s.keyboardOpen)
  if (overlay === 'cc' || overlay === 'nc' || overlay === 'switcher') return null
  const light = !openApp ? true : override ? override === 'light' : theme === 'dark'

  const onDown = (e: React.PointerEvent) => {
    const st = useOS.getState()
    const app = st.openApp
    const scale = screenScale()
    const x0 = e.clientX
    const y0 = e.clientY
    const t0 = performance.now()
    const win = app ? (document.querySelector(`.app-window[data-app="${app}"]`) as HTMLElement | null) : null
    let lastMove = t0
    let lastY = 0
    const move = (ev: PointerEvent) => {
      const dx = (ev.clientX - x0) / scale
      const dy = Math.min(0, (ev.clientY - y0) / scale)
      if (Math.abs(dy - lastY) > 2) lastMove = performance.now()
      lastY = dy
      if (win) {
        const s = Math.max(0.45, 1 + dy / 900)
        win.style.transform = `translate(${dx * 0.6}px, ${dy * 0.55}px) scale(${s})`
        win.style.borderRadius = '48px'
      }
    }
    const up = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      const dx = (ev.clientX - x0) / scale
      const dy = (ev.clientY - y0) / scale
      const dt = performance.now() - t0
      const paused = performance.now() - lastMove > 220
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5 && app) {
        // quick app switch along the bottom edge
        const rec = st.recents.filter((a) => a !== app)
        if (win) {
          win.style.transform = ''
          win.style.borderRadius = ''
        }
        if (rec[0]) st.launch(dx > 0 ? rec[0] : rec[rec.length - 1] ?? rec[0])
        return
      }
      if (dy < -40 && paused && dy > -400) {
        if (win) {
          win.style.transform = ''
          win.style.borderRadius = ''
        }
        st.setOverlay('switcher')
        return
      }
      if (dy < -40 || (dy < -15 && dt < 250) || Math.abs(dy) < 4) {
        if (!app && Math.abs(dy) < 4) return
        st.goHome()
        return
      }
      if (win) {
        const cur = win.style.transform
        win.style.transform = ''
        win.style.borderRadius = ''
        animateSpring(win, [{ transform: cur }, { transform: 'none' }], springs.snappy(), { fill: 'none' })
      }
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  if (keyboard) return null
  return (
    <div className="home-indicator-zone" onPointerDown={onDown} role="button" aria-label="Home indicator — swipe up to go home" tabIndex={-1}>
      <div className="home-indicator" style={{ background: light ? 'rgb(255 255 255 / .9)' : 'rgb(0 0 0 / .85)' }} />
    </div>
  )
}

function AppSwitcher() {
  const recents = useOS((s) => s.recents)
  const openApp = useOS((s) => s.openApp)
  const [removed, setRemoved] = useState<string[]>([])
  const ref = useRef<HTMLDivElement>(null)
  const list = recents.filter((a) => !removed.includes(a))
  useEffect(() => {
    if (ref.current) animateSpring(ref.current, [{ opacity: 0, transform: 'scale(1.1)' }, { opacity: 1, transform: 'scale(1)' }], springs.snappy(), { fill: 'none' })
  }, [])
  const close = (app: AppId) => {
    setRemoved((r) => [...r, app])
    const st = useOS.getState()
    window.setTimeout(() => st.set({ recents: st.recents.filter((a) => a !== app), openApp: st.openApp === app ? null : st.openApp }), 250)
  }
  return (
    <div className="switcher" onClick={() => useOS.getState().set({ overlay: null, openApp: openApp })} role="dialog" aria-label="App Switcher">
      <div className="switcher-track scroll" ref={ref} onClick={(e) => e.stopPropagation()}>
        {list.length === 0 && <div className="switcher-empty">No Recent Apps</div>}
        {list.map((app, i) => (
          <SwitcherCard key={app} app={app} index={i} onOpen={() => useOS.getState().launch(app)} onClose={() => close(app)} />
        ))}
      </div>
    </div>
  )
}

function SwitcherCard({ app, index, onOpen, onClose }: { app: AppId; index: number; onOpen: () => void; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const onDown = (e: React.PointerEvent) => {
    const scale = screenScale()
    const y0 = e.clientY
    let dy = 0
    const move = (ev: PointerEvent) => {
      dy = Math.min(0, (ev.clientY - y0) / scale)
      if (ref.current) ref.current.style.transform = `translateY(${dy}px)`
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      if (dy < -120) {
        if (ref.current) animateSpring(ref.current, [{ transform: `translateY(${dy}px)` }, { transform: 'translateY(-900px)' }], springs.snappy())
        onClose()
      } else if (Math.abs(dy) < 5) {
        onOpen()
      } else if (ref.current) {
        ref.current.style.transform = ''
      }
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }
  return (
    <div className="switcher-card-wrap" style={{ zIndex: 100 - index }}>
      <div className="switcher-label"><AppIconArt app={app} size={28} /> {ICONS[app].name}</div>
      <div className="switcher-card" ref={ref} onPointerDown={onDown} role="button" aria-label={`Open ${ICONS[app].name}. Swipe up to close.`} tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') onOpen(); if (e.key === 'Delete' || e.key === 'Backspace') onClose() }}>
        <SwitcherPreview app={app} />
      </div>
    </div>
  )
}

/** Live-ish snapshot: clone of the mounted app window if present, else its icon on a system background. */
function SwitcherPreview({ app }: { app: AppId }) {
  const ref = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const src = document.querySelector(`.app-window[data-app="${app}"]`) as HTMLElement | null
    if (src && ref.current) {
      const clone = src.cloneNode(true) as HTMLElement
      clone.style.visibility = 'visible'
      clone.style.transform = 'none'
      clone.style.pointerEvents = 'none'
      clone.removeAttribute('inert')
      clone.querySelectorAll('input, textarea, button, [tabindex]').forEach((n) => n.setAttribute('tabindex', '-1'))
      clone.querySelector('.launch-icon')?.remove()
      ref.current.appendChild(clone)
    }
  }, [app])
  return (
    <div className="switcher-preview" ref={ref}>
      <div className="switcher-fallback"><AppIconArt app={app} size={80} /></div>
    </div>
  )
}
