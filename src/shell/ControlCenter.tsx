import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { Plane, Antenna, Wifi, Bluetooth, Link2, Airplay, Lock, RotateCcw, Moon, Sun, Volume2, Flashlight, Timer, Calculator, Camera, Circle, House, BatteryLow, Ear, ScanLine, Contrast, Tv, Play, Pause, SkipForward, SkipBack, Plus, Minus, Power, BedDouble, BookOpen, Car, Dumbbell, User, Headphones, Speaker, Check, MonitorSmartphone, SunDim, Eye, Mic, Music2 } from 'lucide-react'
import { useOS, playbackPosition } from '../os/store'
import { useNow, useLongPress, useDrag } from '../os/hooks'
import { BigSlider, Glass } from '../ui/controls'
import { springs, animateSpring } from '../os/spring'
import { AlbumArt } from './widgets/AlbumArt'
import { startTimer } from '../os/ai/siri'
import { fmtDuration } from '../os/time'
import { nowPlayingTrack } from '../os/nowPlaying'

type Panel = null | 'connectivity' | 'media' | 'focus' | 'brightness' | 'volume' | 'timer' | 'gallery'

const ALL_CONTROLS: { id: string; name: string; icon: ReactNode; size: '1x1' | '2x1' | '1x2' | '2x2' }[] = [
  { id: 'connectivity', name: 'Connectivity', icon: <Wifi size={18} />, size: '2x2' },
  { id: 'media', name: 'Now Playing', icon: <Music2 size={18} />, size: '2x2' },
  { id: 'orientation', name: 'Orientation Lock', icon: <RotateCcw size={18} />, size: '1x1' },
  { id: 'mirror', name: 'Screen Mirroring', icon: <MonitorSmartphone size={18} />, size: '1x1' },
  { id: 'focus', name: 'Focus', icon: <Moon size={18} />, size: '2x1' },
  { id: 'brightness', name: 'Brightness', icon: <Sun size={18} />, size: '1x2' },
  { id: 'volume', name: 'Volume', icon: <Volume2 size={18} />, size: '1x2' },
  { id: 'flashlight', name: 'Flashlight', icon: <Flashlight size={18} />, size: '1x1' },
  { id: 'timer', name: 'Timer', icon: <Timer size={18} />, size: '1x1' },
  { id: 'calculator', name: 'Calculator', icon: <Calculator size={18} />, size: '1x1' },
  { id: 'camera', name: 'Camera', icon: <Camera size={18} />, size: '1x1' },
  { id: 'record', name: 'Screen Recording', icon: <Circle size={18} />, size: '1x1' },
  { id: 'home', name: 'Home', icon: <House size={18} />, size: '1x1' },
  { id: 'lowpower', name: 'Low Power Mode', icon: <BatteryLow size={18} />, size: '1x1' },
  { id: 'hearing', name: 'Hearing', icon: <Ear size={18} />, size: '1x1' },
  { id: 'scan', name: 'Code Scanner', icon: <ScanLine size={18} />, size: '1x1' },
  { id: 'dark', name: 'Dark Mode', icon: <Contrast size={18} />, size: '1x1' },
  { id: 'airplay-tv', name: 'Apple TV Remote', icon: <Tv size={18} />, size: '1x1' },
  { id: 'siri', name: 'Siri', icon: <Mic size={18} />, size: '1x1' },
  { id: 'nightshift', name: 'Night Shift', icon: <SunDim size={18} />, size: '1x1' },
  { id: 'magnifier', name: 'Magnifier', icon: <Eye size={18} />, size: '1x1' },
  { id: 'hotspot', name: 'Personal Hotspot', icon: <Link2 size={18} />, size: '1x1' },
]

export function ControlCenter() {
  const overlay = useOS((s) => s.overlay)
  const open = overlay === 'cc'
  const [render, setRender] = useState(open)
  const ref = useRef<HTMLDivElement>(null)
  const prev = useRef(open)
  useEffect(() => {
    if (open) setRender(true)
  }, [open])
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    if (open && !prev.current) {
      el.getAnimations().forEach((x) => x.cancel())
      animateSpring(el, [{ opacity: 0, transform: 'translateY(-40px) scale(.96)' }, { opacity: 1, transform: 'none' }], springs.sheet(), { fill: 'none' })
    } else if (!open && prev.current) {
      const a = el.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(-30px) scale(.97)' }], { duration: 200, easing: 'ease-in', fill: 'forwards' })
      a.onfinish = () => {
        if (useOS.getState().overlay !== 'cc') setRender(false)
      }
    }
    prev.current = open
  }, [open, render])

  const dismissDrag = useDrag({
    onStart: (e) => !(e.target as HTMLElement).closest('.cc-module, .cc-panel, button, [role=slider]'),
    onMove: () => {},
    onEnd: (_dx, dy) => {
      if (dy < -40 || Math.abs(dy) < 4) useOS.getState().setOverlay(null)
    },
  })

  if (!render) return null
  return (
    <div className="cc" ref={ref} onPointerDown={dismissDrag} role="dialog" aria-label="Control Center">
      <div className="cc-backdrop" />
      <CCContent />
    </div>
  )
}

function CCContent() {
  const st = useOS()
  const [panel, setPanel] = useState<Panel>(null)
  const [recCountdown, setRecCountdown] = useState(0)
  const controls = st.controls
  const has = (id: string) => controls.includes(id)

  const toggleRecord = () => {
    if (st.screenRecording) {
      st.set({ screenRecording: false })
      st.showToast('Screen Recording saved to Photos')
      return
    }
    setRecCountdown(3)
    let n = 3
    const iv = window.setInterval(() => {
      n--
      setRecCountdown(n)
      if (n <= 0) {
        window.clearInterval(iv)
        useOS.getState().set({ screenRecording: true, overlay: null })
      }
    }, 700)
  }

  const small = (id: string, icon: ReactNode, label: string, active: boolean, onClick: () => void, activeColor = '#fff') =>
    has(id) && (
      <CCButton key={id} label={label} active={active} activeColor={activeColor} onClick={onClick}>
        {icon}
      </CCButton>
    )

  return (
    <div className="cc-content">
      <div className="cc-top">
        <button className="cc-round glass clear" aria-label="Edit Controls" onClick={() => setPanel('gallery')}><Plus size={20} /></button>
        <div style={{ flex: 1 }} />
        <button className="cc-round glass clear" aria-label="Power" onClick={() => { st.lock(); st.set({ screenOn: false }) }}><Power size={20} /></button>
      </div>
      <div className="cc-grid">
        {has('connectivity') && <Connectivity onExpand={() => setPanel('connectivity')} />}
        {has('media') && <MediaModule onExpand={() => setPanel('media')} />}
        {small('orientation', <Lock size={22} />, 'Orientation Lock', st.orientationLock, () => {
          st.set({ orientationLock: !st.orientationLock })
          st.flashIsland({ kind: 'generic', title: 'Portrait Orientation Lock', subtitle: !st.orientationLock ? 'On' : 'Off', duration: 1600 })
        }, '#ff453a')}
        {small('mirror', <MonitorSmartphone size={22} />, 'Screen Mirroring', false, () => setPanel('media'))}
        {has('focus') && (
          <Glass className="cc-module cc-2x1 cc-focus" variant="clear" as="button" onClick={() => setPanel('focus')} aria-label="Focus">
            <span className={`cc-focus-icon ${st.focus ? 'on' : ''}`}><Moon size={18} fill={st.focus ? '#fff' : 'none'} /></span>
            <span className="t-subhead bold">{st.focus ?? 'Focus'}</span>
          </Glass>
        )}
        {has('brightness') && (
          <BigSlider value={st.brightness} onChange={(v) => st.set({ brightness: Math.max(0.05, v) })} icon={<Sun size={22} />} label="Brightness" className="cc-1x2" />
        )}
        {has('volume') && (
          <BigSlider value={st.volume} onChange={(v) => st.set({ volume: v })} icon={st.airpods.connected ? <Headphones size={22} /> : <Volume2 size={22} />} label="Volume" className="cc-1x2" />
        )}
        {small('flashlight', <Flashlight size={22} />, 'Flashlight', st.flashlight, () => st.set({ flashlight: !st.flashlight }))}
        {small('timer', <Timer size={22} />, 'Timer', st.timers.some((t) => t.running), () => setPanel('timer'), '#ff9f0a')}
        {small('calculator', <Calculator size={22} />, 'Calculator', false, () => st.launch('calculator'))}
        {small('camera', <Camera size={22} />, 'Camera', false, () => st.launch('camera'))}
        {has('record') && (
          <CCButton label="Screen Recording" active={st.screenRecording} activeColor="#ff453a" onClick={toggleRecord}>
            {recCountdown > 0 ? <span className="t-title3">{recCountdown}</span> : <Circle size={22} fill={st.screenRecording ? '#fff' : 'none'} />}
          </CCButton>
        )}
        {small('home', <House size={22} />, 'Home', false, () => st.launch('home'))}
        {small('lowpower', <BatteryLow size={22} />, 'Low Power Mode', st.lowPower, () => st.set({ lowPower: !st.lowPower }), '#ffcc00')}
        {small('hearing', <Ear size={22} />, 'Hearing', st.airpods.hearingAid, () => st.set({ airpods: { ...st.airpods, hearingAid: !st.airpods.hearingAid } }))}
        {small('scan', <ScanLine size={22} />, 'Code Scanner', false, () => st.launch('camera', { route: 'scan' }))}
        {small('dark', <Contrast size={22} />, 'Dark Mode', st.theme === 'dark', () => st.set({ theme: st.theme === 'dark' ? 'light' : 'dark' }))}
        {small('airplay-tv', <Tv size={22} />, 'Apple TV Remote', false, () => st.flashIsland({ kind: 'airplay', title: 'Living Room TV', subtitle: 'Remote connected in 0.3 s', duration: 2000 }))}
        {small('siri', <Mic size={22} />, 'Siri', false, () => st.set({ overlay: null, siriActive: true, siriMode: 'listening' }))}
        {small('nightshift', <SunDim size={22} />, 'Night Shift', st.nightShift, () => st.set({ nightShift: !st.nightShift }), '#ff9f0a')}
        {small('magnifier', <Eye size={22} />, 'Magnifier', false, () => st.launch('magnifier'))}
        {small('hotspot', <Link2 size={22} />, 'Personal Hotspot', st.net.hotspot, () => st.setNet({ hotspot: !st.net.hotspot }), '#30d158')}
      </div>
      {panel && <CCPanel panel={panel} onClose={() => setPanel(null)} />}
    </div>
  )
}

function CCButton({ children, label, active, activeColor = '#fff', onClick, onLong }: { children: ReactNode; label: string; active?: boolean; activeColor?: string; onClick: () => void; onLong?: () => void }) {
  const lp = useLongPress(() => onLong?.())
  return (
    <button
      className={`cc-module cc-1x1 glass clear ${active ? 'active' : ''}`}
      style={active ? { background: activeColor, color: activeColor === '#fff' ? '#000' : '#fff' } : undefined}
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      {...(onLong ? lp : {})}
    >
      {children}
    </button>
  )
}

function Connectivity({ onExpand }: { onExpand: () => void }) {
  const net = useOS((s) => s.net)
  const setNet = useOS((s) => s.setNet)
  const lp = useLongPress(onExpand)
  const t = (on: boolean, color: string) => ({ background: on ? color : 'rgb(255 255 255 / .18)', color: '#fff' })
  return (
    <Glass className="cc-module cc-2x2 cc-conn" variant="clear" {...lp}>
      <button style={t(net.airplane, '#ff9f0a')} aria-label="Airplane Mode" aria-pressed={net.airplane} onClick={() => setNet({ airplane: !net.airplane, wifi: net.airplane ? net.wifi : false, cellular: net.airplane, activePath: !net.airplane ? 'none' : 'wifi' })}><Plane size={20} fill={net.airplane ? '#fff' : 'none'} /></button>
      <button style={t(net.cellular && !net.airplane, '#30d158')} aria-label="Cellular Data" aria-pressed={net.cellular} onClick={() => setNet({ cellular: !net.cellular })}><Antenna size={20} /></button>
      <button style={t(net.wifi, '#0a84ff')} aria-label="Wi-Fi" aria-pressed={net.wifi} onClick={() => setNet({ wifi: !net.wifi, activePath: !net.wifi ? 'wifi' : net.cellular ? 'cellular' : 'none' })}><Wifi size={20} /></button>
      <button style={t(net.bluetooth, '#0a84ff')} aria-label="Bluetooth" aria-pressed={net.bluetooth} onClick={() => setNet({ bluetooth: !net.bluetooth })}><Bluetooth size={20} /></button>
    </Glass>
  )
}

function MediaModule({ onExpand }: { onExpand: () => void }) {
  const np = useOS((s) => s.nowPlaying)
  const toggle = useOS((s) => s.togglePlay)
  const next = useOS((s) => s.nextTrack)
  const track = nowPlayingTrack(np)
  const lp = useLongPress(onExpand)
  return (
    <Glass className="cc-module cc-2x2 cc-media" variant="clear" {...lp} onClick={(e: React.MouseEvent) => !(e.target as HTMLElement).closest('button') && onExpand()}>
      <div className="row gap8">
        <AlbumArt track={track} size={38} radius={8} />
        <Airplay size={18} style={{ marginLeft: 'auto', opacity: 0.8 }} />
      </div>
      <div className="t-subhead bold nowrap" style={{ marginTop: 8 }}>{track.title}</div>
      <div className="t-footnote nowrap" style={{ opacity: 0.7 }}>{track.artist}</div>
      <div className="row" style={{ justifyContent: 'space-around', marginTop: 'auto' }}>
        <button aria-label={np.playing ? 'Pause' : 'Play'} onClick={toggle}>{np.playing ? <Pause size={24} fill="#fff" strokeWidth={0} /> : <Play size={24} fill="#fff" strokeWidth={0} />}</button>
        <button aria-label="Next" onClick={next}><SkipForward size={22} fill="#fff" /></button>
      </div>
    </Glass>
  )
}

function CCPanel({ panel, onClose }: { panel: NonNullable<Panel>; onClose: () => void }) {
  const st = useOS()
  const ref = useRef<HTMLDivElement>(null)
  const now = useNow(1000)
  useEffect(() => {
    if (ref.current) animateSpring(ref.current, [{ transform: 'scale(.6)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }], springs.island(), { fill: 'none' })
  }, [])
  let body: ReactNode = null
  if (panel === 'connectivity') {
    const net = st.net
    const tile = (on: boolean, color: string, icon: ReactNode, label: string, sub: string, onClick: () => void) => (
      <button className="cc-conn-tile" onClick={onClick} aria-pressed={on}>
        <span className="cc-conn-dot" style={{ background: on ? color : 'rgb(255 255 255 / .18)' }}>{icon}</span>
        <span className="t-footnote bold">{label}</span>
        <span className="t-caption2" style={{ opacity: 0.7 }}>{sub}</span>
      </button>
    )
    body = (
      <div className="cc-conn-grid">
        {tile(net.airplane, '#ff9f0a', <Plane size={20} />, 'Airplane Mode', net.airplane ? 'On' : 'Off', () => st.setNet({ airplane: !net.airplane }))}
        {tile(net.cellular, '#30d158', <Antenna size={20} />, 'Cellular Data', net.cellular ? 'On' : 'Off', () => st.setNet({ cellular: !net.cellular }))}
        {tile(net.wifi, '#0a84ff', <Wifi size={20} />, 'Wi-Fi', net.wifi ? net.wifiNetwork : 'Off', () => st.setNet({ wifi: !net.wifi }))}
        {tile(net.bluetooth, '#0a84ff', <Bluetooth size={20} />, 'Bluetooth', net.bluetooth ? 'AirPods Pro 3' : 'Off', () => st.setNet({ bluetooth: !net.bluetooth }))}
        {tile(st.airdrop !== 'off', '#0a84ff', <span className="airdrop-glyph" />, 'AirDrop', st.airdrop === 'off' ? 'Receiving Off' : st.airdrop === 'contacts' ? 'Contacts Only' : 'Everyone for 10 Minutes', () => st.set({ airdrop: st.airdrop === 'off' ? 'contacts' : st.airdrop === 'contacts' ? 'everyone' : 'off' }))}
        {tile(net.hotspot, '#30d158', <Link2 size={20} />, 'Personal Hotspot', net.hotspot ? 'Discoverable' : 'Not Discoverable', () => st.setNet({ hotspot: !net.hotspot }))}
        {tile(net.vpn, '#0a84ff', <Lock size={20} />, 'VPN', net.vpn ? 'Connected' : 'Not Connected', () => st.setNet({ vpn: !net.vpn }))}
        {tile(net.connectivityAssist, '#30d158', <Antenna size={20} />, 'Connectivity Assist', net.connectivityAssist ? 'Seamless Wi-Fi ↔ 5G' : 'Off', () => st.setNet({ connectivityAssist: !net.connectivityAssist }))}
      </div>
    )
  } else if (panel === 'media') {
    const np = st.nowPlaying
    const track = nowPlayingTrack(np)
    const pos = playbackPosition(np)
    void now
    const devices = [
      { id: 'iphone', name: 'iPhone', icon: <MonitorSmartphone size={18} /> },
      { id: 'airpods', name: 'Jamie’s AirPods Pro 3', icon: <Headphones size={18} /> },
      { id: 'homepod', name: 'HomePod mini — Jamie’s Room', icon: <Speaker size={18} /> },
      { id: 'tv', name: 'Living Room TV', icon: <Tv size={18} /> },
    ]
    const cur = np.airplay ?? (st.airpods.connected ? 'airpods' : 'iphone')
    body = (
      <>
        <div className="row gap12">
          <AlbumArt track={track} size={64} radius={12} />
          <div className="grow"><div className="t-headline nowrap">{track.title}</div><div className="t-subhead" style={{ opacity: 0.7 }}>{track.artist}</div></div>
        </div>
        <div className="isl-progress" style={{ margin: '12px 0' }}><span>{fmtDuration(pos)}</span><div className="bar"><div style={{ width: `${(pos / track.duration) * 100}%` }} /></div><span>-{fmtDuration(track.duration - pos)}</span></div>
        <div className="isl-controls">
          <button aria-label="Previous" onClick={st.prevTrack}><SkipBack size={26} fill="#fff" /></button>
          <button aria-label="Play/Pause" onClick={st.togglePlay}>{np.playing ? <Pause size={32} fill="#fff" strokeWidth={0} /> : <Play size={32} fill="#fff" strokeWidth={0} />}</button>
          <button aria-label="Next" onClick={st.nextTrack}><SkipForward size={26} fill="#fff" /></button>
        </div>
        <div className="t-footnote" style={{ opacity: 0.7, margin: '14px 0 6px' }}>AirPlay & Speakers</div>
        {devices.map((d) => (
          <button key={d.id} className="cc-device" onClick={() => {
            st.set({ nowPlaying: { ...st.nowPlaying, airplay: d.id } })
            if (d.id !== 'iphone') st.flashIsland({ kind: d.id === 'airpods' ? 'airpods' : 'airplay', title: d.name, subtitle: 'Connected in 0.4 s', duration: 1800 })
          }}>
            {d.icon}<span className="grow" style={{ textAlign: 'left' }}>{d.name}</span>{cur === d.id && <Check size={18} color="#0a84ff" />}
          </button>
        ))}
      </>
    )
  } else if (panel === 'focus') {
    const modes = [
      { id: 'Do Not Disturb', icon: <Moon size={18} />, color: '#5e5ce6' },
      { id: 'Personal', icon: <User size={18} />, color: '#bf5af2' },
      { id: 'Sleep', icon: <BedDouble size={18} />, color: '#30b0c7' },
      { id: 'Study', icon: <BookOpen size={18} />, color: '#ff9f0a' },
      { id: 'Driving', icon: <Car size={18} />, color: '#0a84ff' },
      { id: 'Fitness', icon: <Dumbbell size={18} />, color: '#30d158' },
    ] as const
    body = (
      <div className="col gap8">
        {modes.map((m) => (
          <button key={m.id} className="cc-focus-row" style={st.focus === m.id ? { background: m.color } : undefined} onClick={() => st.set({ focus: st.focus === m.id ? null : m.id })}>
            <span className="cc-conn-dot" style={{ background: st.focus === m.id ? 'rgb(255 255 255 / .25)' : m.color }}>{m.icon}</span>
            <span className="grow t-headline" style={{ textAlign: 'left' }}>{m.id}</span>
            {st.focus === m.id && <span className="t-footnote">On</span>}
          </button>
        ))}
      </div>
    )
  } else if (panel === 'timer') {
    body = (
      <div className="col gap12">
        <div className="t-headline">Start a Timer</div>
        <div className="cc-timer-grid">
          {[1, 3, 5, 10, 15, 30].map((m) => (
            <button key={m} className="chip" onClick={() => { startTimer(m * 60, 'Timer'); onClose(); st.setOverlay(null) }}>{m} min</button>
          ))}
        </div>
        <button className="btn small gray" onClick={() => st.launch('clock', { route: 'timer' })}>Open Clock</button>
      </div>
    )
  } else if (panel === 'gallery') {
    body = <ControlsGallery />
  }
  return (
    <div className="cc-panel-backdrop" onClick={onClose}>
      <Glass className={`cc-panel ${panel === 'gallery' ? 'tall' : ''}`} variant="clear" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
        <div ref={ref}>{body}</div>
      </Glass>
    </div>
  )
}

function ControlsGallery() {
  const controls = useOS((s) => s.controls)
  const set = useOS((s) => s.set)
  return (
    <div>
      <div className="t-headline" style={{ marginBottom: 4 }}>Controls Gallery</div>
      <div className="t-footnote" style={{ opacity: 0.7, marginBottom: 12 }}>Add, remove and reorder controls. Changes appear immediately.</div>
      <div className="col gap6 scroll" style={{ maxHeight: 520 }}>
        {ALL_CONTROLS.map((c) => {
          const on = controls.includes(c.id)
          return (
            <div key={c.id} className="cc-gallery-row">
              <span className="cc-conn-dot" style={{ background: 'rgb(255 255 255 / .18)' }}>{c.icon}</span>
              <span className="grow">{c.name}</span>
              <span className="t-caption2" style={{ opacity: 0.6, marginRight: 8 }}>{c.size}</span>
              <button className="cc-gallery-btn" style={{ background: on ? '#ff453a' : '#30d158' }} aria-label={`${on ? 'Remove' : 'Add'} ${c.name}`} onClick={() => set({ controls: on ? controls.filter((x) => x !== c.id) : [...controls, c.id] })}>
                {on ? <Minus size={14} strokeWidth={3} /> : <Plus size={14} strokeWidth={3} />}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
