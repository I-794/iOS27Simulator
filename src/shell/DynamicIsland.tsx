import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Play, Pause, SkipForward, SkipBack, Phone, PhoneOff, MicOff, Timer as TimerIcon, Navigation, BellOff, Bell, Check, Airplay, Headphones, Wifi, Link2, BatteryCharging, Zap, Package, Circle, Square, Heart, ScanFace, Lock, CarFront, Plane } from 'lucide-react'
import { useOS, playbackPosition } from '../os/store'
import { useNow, useLongPress } from '../os/hooks'
import { fmtDuration } from '../os/time'
import type { LiveActivity, AppId } from '../os/types'
import { useShell } from './shellState'
import { AlbumArt } from './widgets/AlbumArt'
import { nowPlayingTrack } from '../os/nowPlaying'

type Pres = 'idle' | 'compact' | 'expanded' | 'event'

interface View {
  w: number
  h: number
  r: number
}

const SIZES: Record<string, View> = {
  idle: { w: 126, h: 37, r: 18.5 },
  compact: { w: 236, h: 37, r: 18.5 },
  wide: { w: 300, h: 37, r: 18.5 },
  faceid: { w: 110, h: 110, r: 36 },
  eventSm: { w: 214, h: 37, r: 18.5 },
  eventLg: { w: 370, h: 84, r: 42 },
  expSm: { w: 370, h: 88, r: 44 },
  expMd: { w: 370, h: 150, r: 46 },
  expLg: { w: 370, h: 196, r: 48 },
  siri: { w: 200, h: 37, r: 18.5 },
}

/** Derive all live activities, including implicit ones (music, recording). */
function useActivities(): LiveActivity[] {
  const activities = useOS((s) => s.activities)
  const np = useOS((s) => s.nowPlaying)
  const rec = useOS((s) => s.screenRecording)
  const hotspot = useOS((s) => s.net.hotspot)
  return useMemo(() => {
    const list = [...activities]
    if (np.playing) list.push({ id: 'music', kind: 'music', title: np.trackId, app: np.kind === 'podcast' ? 'podcasts' : 'music', priority: 2 })
    if (rec) list.push({ id: 'rec', kind: 'recording', title: 'Screen Recording', priority: 8, startedAt: Date.now() })
    if (hotspot) list.push({ id: 'hotspot', kind: 'hotspot', title: 'Personal Hotspot', priority: 1 })
    return list.sort((a, b) => b.priority - a.priority)
  }, [activities, np.playing, np.trackId, np.kind, rec, hotspot])
}

export function DynamicIsland() {
  const st = useOS()
  const expanded = useShell((s) => s.islandExpanded)
  const setShell = useShell((s) => s.set)
  const all = useActivities()
  const event = st.islandEvent
  const landscape = st.orientation === 'landscape'
  // hide the activity belonging to the foreground app (iOS behaviour)
  const visible = all.filter((a) => !(st.openApp && a.app === st.openApp && !st.locked && !st.overlay))
  const primary = visible[0]
  const secondary = visible[1]
  const siri = st.siriActive && st.siriMode === 'listening'

  let pres: Pres = 'idle'
  if (event) pres = 'event'
  else if (expanded && visible.find((a) => a.id === expanded)) pres = 'expanded'
  else if (primary) pres = 'compact'

  // collapse expanded when tapping elsewhere
  useEffect(() => {
    if (!expanded) return
    const onDown = (e: PointerEvent) => {
      if (!(e.target as HTMLElement).closest('.island')) setShell({ islandExpanded: null })
    }
    window.addEventListener('pointerdown', onDown)
    return () => window.removeEventListener('pointerdown', onDown)
  }, [expanded, setShell])

  const expandedAct = pres === 'expanded' ? visible.find((a) => a.id === expanded)! : undefined
  let size: View = SIZES.idle
  if (pres === 'event' && event) size = event.kind === 'faceid' ? SIZES.faceid : ['airdrop', 'airpods', 'carkey', 'nfc', 'airplay'].includes(event.kind) ? SIZES.eventLg : event.kind === 'charging' ? SIZES.wide : SIZES.eventSm
  else if (pres === 'expanded' && expandedAct) size = ['music'].includes(expandedAct.kind) ? SIZES.expLg : ['navigation', 'findmy', 'delivery', 'workout'].includes(expandedAct.kind) ? SIZES.expMd : SIZES.expSm
  else if (pres === 'compact' && primary) size = primary.kind === 'navigation' || primary.kind === 'findmy' ? SIZES.wide : SIZES.compact
  if (siri && pres === 'idle') size = SIZES.siri

  const lp = useLongPress(() => primary && setShell({ islandExpanded: primary.id }))

  const onTap = () => {
    if (pres === 'compact' && primary) setShell({ islandExpanded: primary.id })
  }

  if (!st.screenOn) return null

  const content =
    pres === 'event' && event ? <EventView e={event} /> :
      pres === 'expanded' && expandedAct ? <Expanded a={expandedAct} onOpen={(app) => { setShell({ islandExpanded: null }); if (app) { if (st.locked) st.unlock(); st.launch(app) } }} /> :
        pres === 'compact' && primary ? <Compact a={primary} /> :
          siri ? <div className="isl-siri"><span className="siri-orb-sm" /><span>Listening…</span></div> : null

  return (
    <>
      <div
        className={`island ${landscape ? 'landscape' : ''} pres-${pres}`}
        style={landscape ? { width: size.h, height: pres === 'idle' || pres === 'compact' ? size.w * 0.6 : size.w, borderRadius: size.r } : { width: size.w, height: size.h, borderRadius: size.r }}
        role={pres === 'idle' ? undefined : 'button'}
        aria-label={primary ? `Live Activity: ${primary.title}` : 'Dynamic Island'}
        tabIndex={pres === 'compact' ? 0 : -1}
        onClick={onTap}
        onKeyDown={(e) => e.key === 'Enter' && onTap()}
        {...(pres === 'compact' ? lp : {})}
      >
        {!landscape && <div className="isl-content" key={`${pres}-${event?.id ?? expandedAct?.id ?? primary?.id ?? ''}`}>{content}</div>}
        <div className="isl-camera" />
      </div>
      {landscape && content && (
        <div className={`island-side pres-${pres}`} onClick={onTap} role="button" tabIndex={0} aria-label="Live Activity">
          {content}
        </div>
      )}
      {!landscape && secondary && pres === 'compact' && (
        <button className="island-minimal" onClick={() => setShell({ islandExpanded: secondary.id })} aria-label={`Live Activity: ${secondary.title}`} style={{ left: `calc(50% + ${size.w / 2 + 8}px)` }}>
          <Minimal a={secondary} />
        </button>
      )}
    </>
  )
}

function Waveform({ playing, color = '#ff4d64' }: { playing: boolean; color?: string }) {
  return (
    <span className={`waveform ${playing ? 'playing' : ''}`} aria-hidden>
      {[0, 1, 2, 3, 4].map((i) => <span key={i} style={{ background: color, animationDelay: `${i * 0.12}s` }} />)}
    </span>
  )
}

function Countdown({ endsAt }: { endsAt: number }) {
  const now = useNow(250)
  return <>{fmtDuration(Math.max(0, (endsAt - now) / 1000))}</>
}

function Elapsed({ since }: { since: number }) {
  const now = useNow(1000)
  return <>{fmtDuration((now - since) / 1000)}</>
}

function Compact({ a }: { a: LiveActivity }) {
  const np = useOS((s) => s.nowPlaying)
  const track = nowPlayingTrack(np)
  const L = (n: ReactNode) => <div className="isl-lead">{n}</div>
  const T = (n: ReactNode) => <div className="isl-trail">{n}</div>
  switch (a.kind) {
    case 'music':
      return <>{L(<AlbumArt track={track} size={24} radius={6} />)}{T(<Waveform playing={np.playing} color={`hsl(${track?.hue ?? 0} 85% 62%)`} />)}</>
    case 'timer':
      return <>{L(<TimerIcon size={20} color="#ff9f0a" strokeWidth={2.4} />)}{T(<span className="isl-num" style={{ color: '#ff9f0a' }}><Countdown endsAt={a.endsAt!} /></span>)}</>
    case 'stopwatch':
      return <>{L(<TimerIcon size={20} color="#ff9f0a" />)}{T(<span className="isl-num" style={{ color: '#ff9f0a' }}><Elapsed since={a.startedAt!} /></span>)}</>
    case 'call':
    case 'facetime':
      return <>{L(<span className="isl-pill-green"><Phone size={13} fill="#fff" strokeWidth={0} /></span>)}{T(<span className="isl-num" style={{ color: '#30d158' }}><Elapsed since={a.startedAt ?? Date.now()} /></span>)}</>
    case 'navigation':
      return <>{L(<span className="isl-nav"><Navigation size={16} fill="#0a84ff" strokeWidth={0} style={{ transform: 'rotate(45deg)' }} /> <b>{(a.data?.dist as string) ?? ''}</b></span>)}{T(<span className="isl-num" style={{ color: '#30d158' }}>{(a.data?.eta as string) ?? ''}</span>)}</>
    case 'findmy':
      return <>{L(<span className="isl-find" style={{ transform: `rotate(${(a.data?.bearing as number) ?? 0}deg)` }}>➤</span>)}{T(<span className="isl-num" style={{ color: '#30d158' }}>{(a.data?.distance as string) ?? ''}</span>)}</>
    case 'recording':
      return <>{L(<Circle size={14} fill="#ff453a" color="#ff453a" />)}{T(<span className="isl-num" style={{ color: '#ff453a' }}><Elapsed since={a.startedAt ?? Date.now()} /></span>)}</>
    case 'airdrop':
      return <>{L(<span className="airdrop-glyph" />)}{T(<span className="isl-num" style={{ color: '#0a84ff' }}>{Math.round((a.progress ?? 0) * 100)}%</span>)}</>
    case 'delivery':
      return <>{L(<Package size={18} color="#ff9f0a" />)}{T(<span className="isl-num">{(a.data?.eta as string) ?? ''}</span>)}</>
    case 'flight':
      return <>{L(<span className="isl-nav" style={{ color: '#64d2ff' }}><Plane size={16} /> <b>{(a.data?.flight as string) ?? ''}</b></span>)}{T(<span className="isl-num" style={{ color: '#64d2ff' }}>{(a.data?.status as string) ?? a.subtitle ?? ''}</span>)}</>
    case 'workout':
      return <>{L(<Heart size={16} fill="#ff375f" color="#ff375f" />)}{T(<span className="isl-num" style={{ color: '#ff375f' }}>{(a.data?.hr as number) ?? 120} BPM</span>)}</>
    case 'hotspot':
      return <>{L(<Link2 size={16} color="#30d158" />)}{T(<span className="isl-num" style={{ color: '#30d158' }}>1</span>)}</>
    default:
      return <>{L(<Zap size={16} color="#fff" />)}{T(<span className="isl-num">{a.title}</span>)}</>
  }
}

function Minimal({ a }: { a: LiveActivity }) {
  const np = useOS((s) => s.nowPlaying)
  if (a.kind === 'music') return <AlbumArt track={nowPlayingTrack(np)} size={22} radius={11} />
  if (a.kind === 'timer' || a.kind === 'stopwatch') return <TimerIcon size={18} color="#ff9f0a" />
  if (a.kind === 'flight') return <Plane size={16} color="#64d2ff" />
  if (a.kind === 'navigation') return <Navigation size={16} fill="#0a84ff" strokeWidth={0} />
  if (a.kind === 'call' || a.kind === 'facetime') return <Phone size={16} fill="#30d158" strokeWidth={0} />
  if (a.kind === 'recording') return <Circle size={14} fill="#ff453a" color="#ff453a" />
  if (a.kind === 'findmy') return <span style={{ color: '#30d158' }}>➤</span>
  return <Zap size={16} />
}

function Expanded({ a, onOpen }: { a: LiveActivity; onOpen: (app?: AppId) => void }) {
  const st = useOS()
  const now = useNow(500)
  switch (a.kind) {
    case 'music': {
      const track = nowPlayingTrack(st.nowPlaying)
      const pos = playbackPosition(st.nowPlaying)
      return (
        <div className="isl-exp isl-music">
          <div className="row gap12" onClick={() => onOpen(a.app)} style={{ cursor: 'pointer' }}>
            <AlbumArt track={track} size={58} radius={14} />
            <div className="grow">
              <div className="t-headline nowrap" style={{ color: '#fff' }}>{track.title}</div>
              <div className="t-subhead nowrap" style={{ color: 'rgb(255 255 255 / .6)' }}>{track.artist}</div>
            </div>
            <Waveform playing={st.nowPlaying.playing} color={`hsl(${track.hue} 85% 62%)`} />
          </div>
          <div className="isl-progress">
            <span>{fmtDuration(pos)}</span>
            <div className="bar"><div style={{ width: `${Math.min(100, (pos / track.duration) * 100)}%` }} /></div>
            <span>-{fmtDuration(track.duration - pos)}</span>
          </div>
          <div className="isl-controls">
            <button aria-label="Previous" onClick={(e) => { e.stopPropagation(); st.prevTrack() }}><SkipBack size={26} fill="#fff" /></button>
            <button aria-label={st.nowPlaying.playing ? 'Pause' : 'Play'} onClick={(e) => { e.stopPropagation(); st.togglePlay() }}>{st.nowPlaying.playing ? <Pause size={32} fill="#fff" strokeWidth={0} /> : <Play size={32} fill="#fff" strokeWidth={0} />}</button>
            <button aria-label="Next" onClick={(e) => { e.stopPropagation(); st.nextTrack() }}><SkipForward size={26} fill="#fff" /></button>
            <button aria-label="AirPlay" className="isl-airplay" onClick={(e) => { e.stopPropagation(); st.flashIsland({ kind: 'airplay', title: 'Living Room TV', subtitle: 'Connected in 0.4 s', duration: 2200 }) }}><Airplay size={20} /></button>
          </div>
        </div>
      )
    }
    case 'timer': {
      const running = st.timers.find((t) => `timer-${t.id}` === a.id)
      return (
        <div className="isl-exp row" style={{ justifyContent: 'space-between' }}>
          <div className="row gap12">
            <button className="isl-round" style={{ background: 'rgb(255 159 10 / .3)', color: '#ff9f0a' }} aria-label="Pause timer" onClick={(e) => {
              e.stopPropagation()
              if (!running) return
              const paused = running.running
              const remaining = paused ? Math.max(0, (running.endsAt! - Date.now()) / 1000) : running.remaining
              const endsAt = paused ? null : Date.now() + running.remaining * 1000
              st.set({ timers: st.timers.map((t) => (t.id === running.id ? { ...t, running: !paused, remaining, endsAt } : t)) })
              if (endsAt) st.updateActivity(a.id, { endsAt })
            }}>{running?.running === false ? <Play size={20} fill="#ff9f0a" /> : <Pause size={20} fill="#ff9f0a" strokeWidth={0} />}</button>
            <button className="isl-round" style={{ background: 'rgb(255 255 255 / .2)' }} aria-label="Cancel timer" onClick={(e) => { e.stopPropagation(); st.endActivity(a.id); st.set({ timers: st.timers.filter((t) => `timer-${t.id}` !== a.id) }) }}>✕</button>
          </div>
          <div style={{ textAlign: 'right' }} onClick={() => onOpen('clock')}>
            <div className="t-caption1" style={{ color: '#ff9f0a' }}>{a.title}</div>
            <div className="isl-big" style={{ color: '#ff9f0a' }}>{running && !running.running ? fmtDuration(running.remaining) : <Countdown endsAt={a.endsAt!} />}</div>
          </div>
        </div>
      )
    }
    case 'call':
    case 'facetime':
      return (
        <div className="isl-exp row" style={{ justifyContent: 'space-between' }}>
          <div onClick={() => onOpen(a.app)}>
            <div className="t-caption1" style={{ color: 'rgb(255 255 255 / .6)' }}>{a.kind === 'facetime' ? 'FaceTime Video' : 'Mobile'} · <Elapsed since={a.startedAt ?? now} /></div>
            <div className="t-title3" style={{ color: '#fff' }}>{a.title}</div>
          </div>
          <div className="row gap12">
            <button className="isl-round" style={{ background: 'rgb(255 255 255 / .2)' }} aria-label="Mute"><MicOff size={20} /></button>
            <button className="isl-round" style={{ background: '#ff453a' }} aria-label="End call" onClick={(e) => { e.stopPropagation(); st.endActivity(a.id) }}><PhoneOff size={20} /></button>
          </div>
        </div>
      )
    case 'navigation':
      return (
        <div className="isl-exp" onClick={() => onOpen('maps')}>
          <div className="row gap12">
            <div className="isl-maneuver"><Navigation size={30} fill="#fff" strokeWidth={0} style={{ transform: 'rotate(45deg)' }} /></div>
            <div className="grow">
              <div className="isl-big" style={{ color: '#fff', fontSize: 28 }}>{(a.data?.dist as string) ?? '0.4 mi'}</div>
              <div className="t-subhead" style={{ color: 'rgb(255 255 255 / .75)' }}>{(a.data?.next as string) ?? 'Continue'}</div>
            </div>
          </div>
          <div className="row" style={{ justifyContent: 'space-between', marginTop: 12 }}>
            <div className="t-subhead" style={{ color: '#30d158' }}>{(a.data?.eta as string) ?? ''} · {a.title}</div>
            <button className="btn small" style={{ background: '#ff453a', color: '#fff', height: 30 }} onClick={(e) => { e.stopPropagation(); st.endActivity(a.id) }}>End</button>
          </div>
        </div>
      )
    case 'findmy': {
      const d = a.data ?? {}
      return (
        <div className="isl-exp row gap16" onClick={() => onOpen('findmy')}>
          <div className="isl-precision"><span style={{ transform: `rotate(${(d.bearing as number) ?? 0}deg)` }}>➤</span></div>
          <div className="grow">
            <div className="t-caption1" style={{ color: 'rgb(255 255 255 / .6)' }}>Precision Finding · {a.title}</div>
            <div className="isl-big" style={{ color: '#30d158' }}>{(d.distance as string) ?? '—'}</div>
            <div className="t-subhead" style={{ color: 'rgb(255 255 255 / .75)' }}>{(d.hint as string) ?? 'to your left'}</div>
          </div>
          <button className="btn small" style={{ background: 'rgb(255 255 255 / .2)', color: '#fff', height: 30 }} onClick={(e) => { e.stopPropagation(); st.endActivity(a.id) }}>Done</button>
        </div>
      )
    }
    case 'recording':
      return (
        <div className="isl-exp row" style={{ justifyContent: 'space-between' }}>
          <div className="row gap8" style={{ color: '#ff453a' }}><Circle size={14} fill="#ff453a" /> <span className="t-headline">Screen Recording</span></div>
          <button className="isl-round" style={{ background: '#ff453a' }} aria-label="Stop recording" onClick={(e) => { e.stopPropagation(); st.set({ screenRecording: false }); st.showToast('Screen recording saved to Photos') }}><Square size={16} fill="#fff" /></button>
        </div>
      )
    case 'delivery':
    case 'workout':
    case 'airdrop':
    case 'hotspot':
    default:
      return (
        <div className="isl-exp" onClick={() => onOpen(a.app)}>
          <div className="t-headline" style={{ color: '#fff' }}>{a.title}</div>
          {a.subtitle && <div className="t-subhead" style={{ color: 'rgb(255 255 255 / .7)' }}>{a.subtitle}</div>}
          {a.progress !== undefined && <div className="isl-progress" style={{ marginTop: 10 }}><div className="bar"><div style={{ width: `${a.progress * 100}%`, background: '#0a84ff' }} /></div></div>}
          {a.kind === 'workout' && <div className="isl-big" style={{ color: '#ff375f' }}>{(a.data?.hr as number) ?? 128} BPM <span className="t-caption1" style={{ color: '#fff' }}>via AirPods Pro 3</span></div>}
        </div>
      )
  }
}

function EventView({ e }: { e: NonNullable<ReturnType<typeof useOS.getState>['islandEvent']> }) {
  const battery = useOS((s) => s.battery)
  const [done, setDone] = useState(false)
  useEffect(() => {
    if (e.kind !== 'faceid') return
    const t = window.setTimeout(() => setDone(true), 420)
    return () => window.clearTimeout(t)
  }, [e.kind])
  switch (e.kind) {
    case 'faceid':
      return <div className={`isl-faceid ${done ? 'done' : ''}`}>{done ? <Lock size={34} color="#fff" strokeWidth={2} style={{ transform: 'translateY(-2px)' }} /> : <ScanFace size={40} color="#fff" strokeWidth={1.6} />}</div>
    case 'silent':
      return (
        <div className="isl-event-row">
          <span className={`isl-bell ${e.title === 'Silent Mode' ? 'off' : ''}`}>{e.title === 'Silent Mode' ? <BellOff size={18} color="#ff453a" /> : <Bell size={18} color="#fff" />}</span>
          <span style={{ color: e.title === 'Silent Mode' ? '#ff453a' : '#fff' }}>{e.title === 'Silent Mode' ? 'Silent' : 'Ring'}</span>
        </div>
      )
    case 'charging':
      return (
        <div className="isl-event-row" style={{ justifyContent: 'space-between', width: '100%', padding: '0 16px' }}>
          <span style={{ color: '#fff' }}>Charging</span>
          <span className="row gap6" style={{ color: '#30d158' }}>{Math.round(battery * 100)}% <BatteryCharging size={20} /></span>
        </div>
      )
    case 'airdrop':
      return (
        <div className="isl-exp row gap12" style={{ padding: '14px 20px' }}>
          <span className="airdrop-glyph big" />
          <div className="grow">
            <div className="t-headline" style={{ color: '#fff' }}>{e.title ?? 'AirDrop'}</div>
            <div className="t-subhead" style={{ color: 'rgb(255 255 255 / .65)' }}>{e.subtitle}</div>
          </div>
          <Check size={24} color="#0a84ff" />
        </div>
      )
    case 'airpods':
      return (
        <div className="isl-exp row gap12" style={{ padding: '14px 20px' }}>
          <Headphones size={30} color="#fff" />
          <div className="grow"><div className="t-headline" style={{ color: '#fff' }}>{e.title ?? 'AirPods Pro 3'}</div><div className="t-subhead" style={{ color: 'rgb(255 255 255 / .65)' }}>{e.subtitle ?? 'Connected'}</div></div>
        </div>
      )
    case 'airplay':
      return (
        <div className="isl-exp row gap12" style={{ padding: '14px 20px' }}>
          <Airplay size={28} color="#0a84ff" />
          <div className="grow"><div className="t-headline" style={{ color: '#fff' }}>{e.title}</div><div className="t-subhead" style={{ color: 'rgb(255 255 255 / .65)' }}>{e.subtitle}</div></div>
        </div>
      )
    case 'carkey':
      return (
        <div className="isl-exp row gap12" style={{ padding: '14px 20px' }}>
          <CarFront size={30} color="#fff" />
          <div className="grow"><div className="t-headline" style={{ color: '#fff' }}>{e.title}</div><div className="t-subhead" style={{ color: 'rgb(255 255 255 / .65)' }}>{e.subtitle}</div></div>
        </div>
      )
    case 'nfc':
      return (
        <div className="isl-exp row gap12" style={{ padding: '14px 20px' }}>
          <Wifi size={28} color="#fff" style={{ transform: 'rotate(90deg)' }} />
          <div className="grow"><div className="t-headline" style={{ color: '#fff' }}>{e.title}</div><div className="t-subhead" style={{ color: 'rgb(255 255 255 / .65)' }}>{e.subtitle}</div></div>
        </div>
      )
    default:
      return (
        <div className="isl-event-row" style={{ color: e.tint ?? '#fff' }}>
          <span>{e.title}</span>
          {e.subtitle && <span style={{ color: 'rgb(255 255 255 / .6)' }}>{e.subtitle}</span>}
        </div>
      )
  }
}

