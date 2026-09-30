import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Flashlight, Camera, Play, Pause, SkipBack, SkipForward, X, Lock, CloudSun, Calendar as CalIcon, Timer, Navigation, Check, KeyRound } from 'lucide-react'
import { useOS, playbackPosition } from '../os/store'
import { useNow, screenScale } from '../os/hooks'
import { fmtClock, fmtDuration, WEEKDAYS, MONTHS, fmtTime } from '../os/time'
import { TRACKS } from '../os/data/media'
import { WEATHER } from '../os/data/world'
import { Wallpaper, WALLPAPERS } from '../art/Wallpaper'
import { AlbumArt } from './widgets/AlbumArt'
import { NotificationList, NotificationCard } from './Notifications'
import { springs, animateSpring } from '../os/spring'
import { Glass, AISparkle } from '../ui/controls'
import { Sheet } from '../ui/overlay'

export const LOCK_PROFILES = [
  { name: 'Default', wallpaper: 'sequoia', clockStyle: 'bold' as const, clockColor: '#ffffff', position: 'center' as const },
  { name: 'Biscuit', wallpaper: 'scene:dog-beach', clockStyle: 'rounded' as const, clockColor: '#fff4e0', position: 'top' as const },
  { name: 'Night Sky', wallpaper: 'scene:night-sky', clockStyle: 'serif' as const, clockColor: '#c9c3ff', position: 'center' as const },
  { name: 'Aurora', wallpaper: 'aurora', clockStyle: 'stencil' as const, clockColor: '#d4fff0', position: 'top' as const },
  { name: 'Sunrise', wallpaper: 'sunrise', clockStyle: 'bold' as const, clockColor: '#fff', position: 'center' as const },
]

const CLOCK_FONTS: Record<string, React.CSSProperties> = {
  bold: { fontFamily: 'var(--font-display)', fontWeight: 700, letterSpacing: '-3px' },
  rounded: { fontFamily: 'var(--font-rounded)', fontWeight: 600, letterSpacing: '-2px' },
  serif: { fontFamily: "'New York', 'Georgia', serif", fontWeight: 500, letterSpacing: '-2px' },
  stencil: { fontFamily: 'var(--font-display)', fontWeight: 200, letterSpacing: '-1px' },
}

export function LockScreen() {
  const locked = useOS((s) => s.locked)
  const overlay = useOS((s) => s.overlay)
  const nc = overlay === 'nc'
  const show = locked || nc
  const ref = useRef<HTMLDivElement>(null)
  const [render, setRender] = useState(show)
  const prev = useRef(show)

  useEffect(() => {
    if (show) setRender(true)
  }, [show])

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    if (show && !prev.current) {
      animateSpring(el, [{ transform: 'translateY(-100%)' }, { transform: 'translateY(0)' }], springs.sheet(), { fill: 'none' })
    } else if (!show && prev.current) {
      const a = animateSpring(el, [{ transform: el.style.transform || 'translateY(0)' }, { transform: 'translateY(-100%)' }], springs.sheet())
      a.onfinish = () => {
        setRender(false)
        el.style.transform = ''
      }
    }
    prev.current = show
  }, [show, render])

  if (!render && !show) return null
  return (
    <div className={`lock ${nc && !locked ? 'as-nc' : ''}`} ref={ref} role="region" aria-label={locked ? 'Lock Screen' : 'Notification Center'}>
      <LockContent locked={locked} />
    </div>
  )
}

function LockContent({ locked }: { locked: boolean }) {
  const st = useOS()
  const now = useNow(1000)
  const landscape = st.orientation === 'landscape'
  const [customizing, setCustomizing] = useState(false)
  const [dragY, setDragY] = useState(0)
  const [passwordHelp, setPasswordHelp] = useState(false)
  const [listMode, setListMode] = useState(false)
  const idle = useRef<number | undefined>(undefined)
  const d = new Date(now)
  const clockStyle = CLOCK_FONTS[st.lockClockStyle] ?? CLOCK_FONTS.bold
  const top = st.lockClockPosition === 'top'
  const notifications = st.notifications
  const np = st.nowPlaying
  const showNP = (np.playing || np.position > 0) && !np.dismissed
  const acts = st.activities.filter((a) => a.kind === 'timer' || a.kind === 'navigation' || a.kind === 'findmy' || a.kind === 'delivery')

  // auto-lock: display turns off after inactivity, but stays on while you interact / scroll notifications
  const resetIdle = () => {
    window.clearTimeout(idle.current)
    if (!locked) return
    idle.current = window.setTimeout(() => {
      const s = useOS.getState()
      if (s.locked && !s.siriActive && !s.nowPlaying.playing) s.set({ screenOn: false })
    }, 30_000)
  }
  useEffect(() => {
    resetIdle()
    return () => window.clearTimeout(idle.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locked, notifications.length])

  const onPointerDown = (e: React.PointerEvent) => {
    resetIdle()
    const t = e.target as HTMLElement
    if (t.closest('button, .notif, .np-platter, .lock-widget, .lock-scroll-area input')) return
    const scale = screenScale()
    const y0 = e.clientY
    const t0 = performance.now()
    let dy = 0
    const holdTimer = window.setTimeout(() => {
      if (Math.abs(dy) < 6 && locked) setCustomizing(true)
    }, 650)
    const move = (ev: PointerEvent) => {
      dy = Math.min(0, (ev.clientY - y0) / scale)
      if (Math.abs(dy) > 6) window.clearTimeout(holdTimer)
      setDragY(dy)
    }
    const up = () => {
      window.clearTimeout(holdTimer)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      const fast = performance.now() - t0 < 300 && dy < -40
      if (dy < -120 || fast) {
        if (locked) useOS.getState().unlock()
        else useOS.getState().setOverlay(null)
      }
      setDragY(0)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  return (
    <div className={`lock-inner ${landscape ? 'landscape' : ''} ${top ? 'clock-top' : ''}`} onPointerDown={onPointerDown} style={{ transform: dragY ? `translateY(${dragY * 0.6}px)` : undefined, opacity: dragY ? 1 + dragY / 600 : 1 }}>
      <div className="lock-wallpaper">
        <Wallpaper id={st.wallpaper} dark={st.theme === 'dark'} blur={!locked ? 30 : 0} />
        {!locked && <div className="nc-dim" />}
      </div>
      <div className="lock-top">
        {locked && <div className="lock-glyph" aria-hidden><Lock size={16} strokeWidth={2.6} /></div>}
        <div className="lock-date" style={{ color: st.lockClockColor }}>
          {WEEKDAYS[d.getDay()]}, {MONTHS[d.getMonth()]} {d.getDate()}
          {top && <span className="lock-date-weather"> · <CloudSun size={14} /> {WEATHER.temp}°</span>}
        </div>
        <div className={`lock-clock ${top ? 'top' : ''}`} style={{ ...clockStyle, color: st.lockClockColor }}>
          {fmtClock(now, st.h24)}
        </div>
        {!top && (
          <div className="lock-widgets">
            {st.lockWidgets.map((w) => <LockWidget key={w} kind={w} />)}
          </div>
        )}
      </div>

      <div className="lock-scroll-area scroll" onScroll={resetIdle}>
        {top && (
          <div className="lock-widgets inline">
            {st.lockWidgets.map((w) => <LockWidget key={w} kind={w} />)}
          </div>
        )}
        {acts.map((a) => (
          <Glass key={a.id} className="lock-activity" variant="dark">
            {a.kind === 'timer' ? <Timer size={26} color="#ff9f0a" /> : a.kind === 'navigation' ? <Navigation size={24} color="#0a84ff" fill="#0a84ff" /> : <KeyRound size={22} />}
            <div className="grow">
              <div className="t-subhead" style={{ opacity: 0.7 }}>{a.title}</div>
              <div className="t-title2" style={{ color: a.kind === 'timer' ? '#ff9f0a' : '#fff' }}>
                {a.kind === 'timer' ? fmtDuration(Math.max(0, ((a.endsAt ?? now) - now) / 1000)) : ((a.data?.eta as string) ?? a.subtitle)}
              </div>
            </div>
            {a.kind === 'navigation' && <div className="t-footnote" style={{ opacity: 0.8 }}>{a.data?.next as string}</div>}
          </Glass>
        ))}
        {showNP && <NowPlayingPlatter />}
        <div style={{ marginTop: 'auto' }} />
        {notifications.length > 0 ? (
          locked && !listMode && notifications.length > 1 ? (
            <div className="lock-stack">
              <NotificationStack items={notifications} onExpand={() => setListMode(true)} />
            </div>
          ) : (
            <>
              {notifications.some((n) => n.summary) && <div className="lock-section-title"><AISparkle size={14} /> Summarized by Apple Intelligence</div>}
              <NotificationList items={notifications} />
              {locked && <button className="lock-collapse" onClick={() => setListMode(false)}>Show Less</button>}
            </>
          )
        ) : (
          !locked && <div className="nc-empty">No Older Notifications</div>
        )}
        {locked && st.passwordsFixed.length === 0 && listMode && (
          <button className="lock-pw-help glass dark-glass" onClick={() => setPasswordHelp(true)}>
            <KeyRound size={16} /> Forgot a password? Get help from your Lock Screen
          </button>
        )}
        <div style={{ height: locked ? 110 : 40, flexShrink: 0 }} />
      </div>

      {locked && (
        <div className="lock-bottom">
          <LockButton label="Flashlight" active={st.flashlight} onClick={() => st.set({ flashlight: !st.flashlight })}><Flashlight size={24} /></LockButton>
          <div className="lock-hint">{dragY ? '' : 'Swipe up to open'}</div>
          <LockButton label="Camera" onClick={() => st.launch('camera')}><Camera size={24} /></LockButton>
        </div>
      )}
      <div className="lock-indicator" />
      {customizing && <LockCustomizer onDone={() => setCustomizing(false)} />}
      <Sheet open={passwordHelp} onClose={() => setPasswordHelp(false)} title="Password Help" detent="medium">
        <div style={{ padding: '4px 20px 24px' }} className="col gap12">
          <p className="t-subhead secondary" style={{ margin: 0 }}>iOS 27 can help you recover account access from the Lock Screen without unlocking. Choose a demo account:</p>
          {['schoolportal.example', 'streamly.example'].map((site) => (
            <button key={site} className="row-item" style={{ background: 'var(--fill-tertiary)', borderRadius: 16 }} onClick={() => {
              setPasswordHelp(false)
              useOS.getState().showToast(`Face ID required to view ${site}`)
              useOS.getState().unlock()
              window.setTimeout(() => useOS.getState().launch('passwords', { route: `site/${site}` }), 400)
            }}>
              <KeyRound size={18} /> <span className="grow">{site}</span> <Check size={16} />
            </button>
          ))}
          <div className="t-caption1 secondary">Demo only — no real passwords are stored.</div>
        </div>
      </Sheet>
    </div>
  )
}

function LockButton({ children, label, active, onClick }: { children: React.ReactNode; label: string; active?: boolean; onClick: () => void }) {
  const [pressed, setPressed] = useState(false)
  return (
    <button
      className={`lock-btn glass dark-glass ${active ? 'active' : ''} ${pressed ? 'pressed' : ''}`}
      aria-label={label}
      aria-pressed={active}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

function LockWidget({ kind }: { kind: string }) {
  const st = useOS()
  const now = useNow()
  switch (kind) {
    case 'weather':
      return <div className="lock-widget circ"><CloudSun size={18} /><b>{WEATHER.temp}°</b></div>
    case 'calendar': {
      const next = st.events.filter((e) => e.start > now).sort((a, b) => a.start - b.start)[0]
      return (
        <div className="lock-widget rect" onClick={() => { st.unlock(); window.setTimeout(() => st.launch('calendar'), 300) }}>
          <div className="row gap4 t-caption1" style={{ opacity: 0.8 }}><CalIcon size={12} /> {next ? fmtTime(next.start) : 'No events'}</div>
          <div className="t-footnote bold nowrap">{next?.title ?? 'Enjoy your day'}</div>
        </div>
      )
    }
    case 'activity':
      return (
        <div className="lock-widget circ">
          <svg width="44" height="44" viewBox="0 0 44 44">
            <circle cx="22" cy="22" r="18" fill="none" stroke="rgb(255 255 255 / .25)" strokeWidth="4" />
            <circle cx="22" cy="22" r="18" fill="none" stroke="#fff" strokeWidth="4" strokeDasharray="95 200" strokeLinecap="round" transform="rotate(-90 22 22)" />
            <circle cx="22" cy="22" r="11" fill="none" stroke="rgb(255 255 255 / .25)" strokeWidth="4" />
            <circle cx="22" cy="22" r="11" fill="none" stroke="#fff" strokeWidth="4" strokeDasharray="60 200" strokeLinecap="round" transform="rotate(-90 22 22)" />
          </svg>
        </div>
      )
    case 'battery':
      return (
        <div className="lock-widget circ">
          <svg width="44" height="44" viewBox="0 0 44 44">
            <circle cx="22" cy="22" r="18" fill="none" stroke="rgb(255 255 255 / .25)" strokeWidth="4" />
            <circle cx="22" cy="22" r="18" fill="none" stroke="#fff" strokeWidth="4" strokeDasharray={`${113 * st.battery} 200`} strokeLinecap="round" transform="rotate(-90 22 22)" />
          </svg>
          <span className="lock-widget-label">{Math.round(st.battery * 100)}</span>
        </div>
      )
    default:
      return null
  }
}

function NowPlayingPlatter() {
  const np = useOS((s) => s.nowPlaying)
  const toggle = useOS((s) => s.togglePlay)
  const next = useOS((s) => s.nextTrack)
  const prev = useOS((s) => s.prevTrack)
  const set = useOS((s) => s.set)
  useNow(1000)
  const [dx, setDx] = useState(0)
  const track = TRACKS.find((t) => t.id === np.trackId)!
  const pos = playbackPosition(np)
  const dismiss = () => {
    if (np.playing) toggle()
    set({ nowPlaying: { ...useOS.getState().nowPlaying, playing: false, dismissed: true } })
  }
  const onDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('button')) return
    e.stopPropagation()
    const scale = screenScale()
    const x0 = e.clientX
    let cur = 0
    const move = (ev: PointerEvent) => {
      cur = (ev.clientX - x0) / scale
      setDx(cur)
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      if (Math.abs(cur) > 140) dismiss()
      setDx(0)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }
  return (
    <Glass className="np-platter" variant="dark" style={{ transform: dx ? `translateX(${dx}px)` : undefined, opacity: 1 - Math.min(0.7, Math.abs(dx) / 300) }} onPointerDown={onDown}>
      <div className="row gap12">
        <AlbumArt track={track} size={52} radius={10} />
        <div className="grow">
          <div className="t-headline nowrap">{track.title}</div>
          <div className="t-subhead nowrap" style={{ opacity: 0.7 }}>{track.artist}</div>
        </div>
        <button className="np-close" aria-label="Dismiss Now Playing" onClick={dismiss}><X size={16} strokeWidth={3} /></button>
      </div>
      <div className="isl-progress" style={{ marginTop: 10 }}>
        <span>{fmtDuration(pos)}</span>
        <div className="bar"><div style={{ width: `${(pos / track.duration) * 100}%` }} /></div>
        <span>-{fmtDuration(track.duration - pos)}</span>
      </div>
      <div className="isl-controls" style={{ marginTop: 4 }}>
        <button aria-label="Previous" onClick={prev}><SkipBack size={26} fill="#fff" /></button>
        <button aria-label={np.playing ? 'Pause' : 'Play'} onClick={toggle}>{np.playing ? <Pause size={32} fill="#fff" strokeWidth={0} /> : <Play size={32} fill="#fff" strokeWidth={0} />}</button>
        <button aria-label="Next" onClick={next}><SkipForward size={26} fill="#fff" /></button>
      </div>
    </Glass>
  )
}

function LockCustomizer({ onDone }: { onDone: () => void }) {
  const st = useOS()
  const [i, setI] = useState(Math.max(0, LOCK_PROFILES.findIndex((p) => p.name === st.lockProfile)))
  const now = useNow()
  const apply = (idx: number) => {
    const p = LOCK_PROFILES[idx]
    st.set({ lockProfile: p.name, wallpaper: p.wallpaper, lockClockStyle: p.clockStyle, lockClockColor: p.clockColor, lockClockPosition: p.position })
  }
  return (
    <div className="lock-customizer" onPointerDown={(e) => e.stopPropagation()}>
      <div className="lc-head">
        <button className="bar-btn glass dark-glass" onClick={onDone}>Cancel</button>
        <span className="t-headline" style={{ color: '#fff' }}>Lock Screen</span>
        <button className="bar-btn prominent" onClick={() => { apply(i); onDone() }}>Done</button>
      </div>
      <div className="lc-track" style={{ transform: `translateX(calc(50% - ${i * 250 + 110}px))` }}>
        {LOCK_PROFILES.map((p, idx) => (
          <button key={p.name} className={`lc-card ${idx === i ? 'on' : ''}`} onClick={() => setI(idx)} aria-label={`${p.name} Lock Screen`}>
            <Wallpaper id={p.wallpaper} dark={false} />
            <div className="lc-clock" style={{ ...CLOCK_FONTS[p.clockStyle], color: p.clockColor, top: p.position === 'top' ? 30 : 58 }}>{fmtClock(now, st.h24)}</div>
            <div className="lc-name">{p.name}</div>
          </button>
        ))}
      </div>
      <Glass className="lc-options" variant="dark">
        <div className="t-footnote" style={{ opacity: 0.7, marginBottom: 8 }}>Clock position</div>
        <div className="row gap8">
          {(['center', 'top'] as const).map((pos) => (
            <button key={pos} className={`chip ${st.lockClockPosition === pos ? 'active' : ''}`} onClick={() => st.set({ lockClockPosition: pos })}>{pos === 'center' ? 'Classic' : 'Top (with widgets)'}</button>
          ))}
        </div>
        <div className="t-footnote" style={{ opacity: 0.7, margin: '12px 0 8px' }}>Clock style</div>
        <div className="row gap8">
          {Object.keys(CLOCK_FONTS).map((f) => (
            <button key={f} className={`chip ${st.lockClockStyle === f ? 'active' : ''}`} style={CLOCK_FONTS[f]} onClick={() => st.set({ lockClockStyle: f as 'bold' })}>12</button>
          ))}
        </div>
        <div className="t-footnote" style={{ opacity: 0.7, margin: '12px 0 8px' }}>Wallpaper</div>
        <div className="row gap8" style={{ overflowX: 'auto' }}>
          {WALLPAPERS.map((w) => (
            <button key={w.id} aria-label={w.name} className="lc-wp" onClick={() => st.set({ wallpaper: w.id })} style={{ outline: st.wallpaper === w.id ? '2px solid #fff' : 'none' }}>
              <Wallpaper id={w.id} dark={false} />
            </button>
          ))}
        </div>
      </Glass>
    </div>
  )
}

/** iOS default "Stack" notification display on the Lock Screen. */
function NotificationStack({ items, onExpand }: { items: ReturnType<typeof useOS.getState>['notifications']; onExpand: () => void }) {
  return (
    <div className="notif-stack-wrap" onClickCapture={(e) => { e.stopPropagation(); e.preventDefault(); onExpand() }} role="button" aria-label={`${items.length} notifications. Tap to expand.`}>
      <NotificationCard n={items[0]} stackCount={Math.min(2, items.length - 1)} />
      <div className="lock-stack-more">{items.length - 1} more notification{items.length > 2 ? 's' : ''}</div>
    </div>
  )
}
