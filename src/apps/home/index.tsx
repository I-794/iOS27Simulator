import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Plus, Ellipsis, Thermometer, Lightbulb, Lock, ShieldCheck, Speaker, Wifi, ScanLine, Check, ChevronRight, Radio, Router, Zap, Clock3, Camera } from 'lucide-react'
import { NavStack, Page, useNav, BarButton } from '../../ui/nav'
import { List, Row } from '../../ui/list'
import { Sheet, openMenu } from '../../ui/overlay'
import { Button, Spinner } from '../../ui/controls'
import { useOS, uid } from '../../os/store'
import { useAppRoute, useOnscreen, useNow } from '../../os/hooks'
import { HOME_SCENES, HOME_ROOMS } from '../../os/data/world'
import { AccessoryTile, AccessorySheet } from './tiles'
import { CamerasPage, CameraDetail, ClipPage, ActivityPage, LiveFeed, CAMERAS } from './cameras'
import { SCENE_ICON, runScene, sceneActive, ROOM_ART, type Acc } from './lib'
import type { HomeAccessory } from '../../os/types'
import './home.css'

type NavApi = ReturnType<typeof useNav>

function Registrar({ onNav, children }: { onNav: (n: NavApi) => void; children: ReactNode }) {
  const nav = useNav()
  useEffect(() => onNav(nav), [nav, onNav])
  return <>{children}</>
}

const FAV_IDS = ['h-fp-lock', 'h-therm', 'h-lr-lamp', 'h-j-desk', 'h-g-door', 'h-k-pendants']

export default function HomeApp() {
  const navRef = useRef<NavApi | null>(null)
  const [detail, setDetail] = useState<Acc | null>(null)
  const [adding, setAdding] = useState(false)
  const onNav = useRef((n: NavApi) => void (navRef.current = n)).current

  useAppRoute('home', (r) => {
    const nav = navRef.current
    if (!nav) return
    nav.popToRoot()
    window.setTimeout(() => {
      if (r.startsWith('clip/')) nav.push(<ClipPage id={r.slice(5)} />)
      else if (r.startsWith('camera/')) {
        const name = decodeURIComponent(r.slice(7))
        nav.push(CAMERAS.includes(name) ? <CameraDetail camera={name} /> : <CamerasPage />)
      } else if (r === 'cameras') nav.push(<CamerasPage />)
      else if (r.startsWith('search/')) nav.push(<CamerasPage initialQuery={decodeURIComponent(r.slice(7))} />)
      else if (r.startsWith('room/')) nav.push(<RoomPage room={decodeURIComponent(r.slice(5))} onOpen={setDetail} />)
      else if (r === 'activity') nav.push(<ActivityPage />)
      else if (r === 'thread') nav.push(<ThreadPage />)
      else if (r === 'add') setAdding(true)
    }, 30)
  })

  return (
    <div className="app-root hm-root">
      <NavStack root={<Registrar onNav={onNav}><HomeRoot onOpen={setDetail} onAdd={() => setAdding(true)} /></Registrar>} />
      <AccessorySheet acc={detail} onClose={() => setDetail(null)} />
      <AddAccessory open={adding} onClose={() => setAdding(false)} />
    </div>
  )
}

function Summary() {
  const accs = useOS((s) => s.accessories)
  const nav = useNav()
  const therm = accs.find((a) => a.kind === 'thermostat')
  const lightsOn = accs.filter((a) => a.kind === 'light' && a.on).length
  const unlocked = accs.filter((a) => (a.kind === 'lock' && !a.locked) || (a.kind === 'garage' && a.value === 'Open')).length
  const speakers = accs.filter((a) => (a.kind === 'speaker' || a.kind === 'tv') && a.on).length
  const chips: { icon: ReactNode; label: string; value: string; color: string; go: () => void }[] = [
    { icon: <Thermometer size={18} />, label: 'Climate', value: `${therm?.temp ?? 70}°`, color: '#30b0c7', go: () => nav.push(<CategoryPage kind="climate" />) },
    { icon: <Lightbulb size={18} />, label: 'Lights', value: lightsOn ? `${lightsOn} On` : 'Off', color: '#ffd60a', go: () => nav.push(<CategoryPage kind="lights" />) },
    { icon: <Lock size={18} />, label: 'Security', value: unlocked ? `${unlocked} Unlocked` : 'Locked', color: unlocked ? '#ff9f0a' : '#30d158', go: () => nav.push(<CategoryPage kind="security" />) },
    { icon: <Speaker size={18} />, label: 'Speakers & TVs', value: speakers ? `${speakers} Playing` : 'Off', color: '#bf5af2', go: () => nav.push(<CategoryPage kind="media" />) },
  ]
  return (
    <div className="hm-summary scroll-x">
      {chips.map((c) => (
        <button key={c.label} className="hm-sum-chip glass interactive" onClick={c.go}>
          <span className="hm-sum-ic" style={{ color: c.color }}>{c.icon}</span>
          <span><b>{c.label}</b><span>{c.value}</span></span>
        </button>
      ))}
    </div>
  )
}

function StatusLine() {
  const now = useNow(1000)
  const accs = useOS((s) => s.accessories)
  const [lastChange, setLast] = useState(Date.now())
  const prev = useRef(accs)
  useEffect(() => {
    if (prev.current !== accs) setLast(Date.now())
    prev.current = accs
  }, [accs])
  const secs = Math.round((now - lastChange) / 1000)
  return (
    <div className="hm-status-line">
      <span className="hm-dot" /> All {accs.length} accessories responding · {secs < 3 ? 'Updated just now' : `Updated ${secs < 60 ? `${secs}s` : `${Math.round(secs / 60)}m`} ago`}
    </div>
  )
}

function HomeRoot({ onOpen, onAdd }: { onOpen: (a: Acc) => void; onAdd: () => void }) {
  const nav = useNav()
  const accs = useOS((s) => s.accessories)
  useOnscreen('home', 'Home app — accessories and cameras', { type: 'page', title: 'Home', text: accs.map((a) => `${a.name} (${a.room})`).join(', '), url: 'home' })
  const favs = FAV_IDS.map((id) => accs.find((a) => a.id === id)).filter(Boolean) as Acc[]
  return (
    <Page
      title="My Home"
      className="hm-page"
      bg="var(--hm-wall)"
      trailing={<>
        <BarButton label="Add Accessory" onClick={onAdd}><Plus size={22} /></BarButton>
        <button className="bar-btn icon glass interactive" aria-label="More" onClick={(e) => openMenu(e.currentTarget, [
          { label: 'Activity History', icon: <Clock3 size={18} />, onSelect: () => nav.push(<ActivityPage />) },
          { label: 'Cameras', icon: <Camera size={18} />, onSelect: () => nav.push(<CamerasPage />) },
          { label: 'Thread Network', icon: <Radio size={18} />, onSelect: () => nav.push(<ThreadPage />) },
          { label: 'Add Accessory', icon: <Plus size={18} />, separatorBefore: true, onSelect: onAdd },
        ])}><Ellipsis size={20} /></button>
      </>}
    >
      <StatusLine />
      <Summary />
      <div className="hm-section-head"><span>Cameras</span><button onClick={() => nav.push(<CamerasPage />)} className="hm-more">All <ChevronRight size={14} /></button></div>
      <div className="hm-cam-strip scroll-x">
        {CAMERAS.map((c) => <div key={c} className="hm-cam-card"><LiveFeed camera={c} onClick={() => nav.push(<CameraDetail camera={c} />)} motion={false} /></div>)}
      </div>
      <div className="hm-section-head"><span>Scenes</span></div>
      <div className="hm-scenes">
        {HOME_SCENES.map((s) => {
          const on = sceneActive(s.id, accs)
          return (
            <button key={s.id} className={`hm-scene glass interactive ${on ? 'on' : ''}`} style={{ ['--tint' as string]: s.color }} onClick={() => runScene(s.id)}>
              <span className="hm-scene-ic">{SCENE_ICON[s.icon]}</span>
              <span className="nowrap">{s.name}</span>
            </button>
          )
        })}
      </div>
      <div className="hm-section-head"><span>Favorites</span></div>
      <div className="hm-grid">{favs.map((a) => <AccessoryTile key={a.id} a={a} onOpen={onOpen} />)}</div>
      {HOME_ROOMS.map((room) => {
        const list = accs.filter((a) => a.room === room && a.kind !== 'camera')
        if (!list.length) return null
        return (
          <section key={room}>
            <button className="hm-section-head room" onClick={() => nav.push(<RoomPage room={room} onOpen={onOpen} />)}><span>{room}</span><ChevronRight size={18} /></button>
            <div className="hm-grid">{list.map((a) => <AccessoryTile key={a.id} a={a} onOpen={onOpen} />)}</div>
          </section>
        )
      })}
      <List>
        <Row title="Thread Network" subtitle="Border router: HomePod mini · 9 devices" icon={<span className="hm-row-ic" style={{ background: '#5e5ce6' }}><Radio size={16} /></span>} chevron onClick={() => nav.push(<ThreadPage />)} />
        <Row title="Activity History" subtitle="Summarized events from cameras and locks" icon={<span className="hm-row-ic" style={{ background: '#ff9f0a' }}><Clock3 size={16} /></span>} chevron onClick={() => nav.push(<ActivityPage />)} />
      </List>
    </Page>
  )
}

function RoomPage({ room, onOpen }: { room: string; onOpen: (a: Acc) => void }) {
  const nav = useNav()
  const accs = useOS((s) => s.accessories).filter((a) => a.room === room)
  const cams = accs.filter((a) => a.kind === 'camera')
  const others = accs.filter((a) => a.kind !== 'camera')
  const hue = ROOM_ART[room] ?? 30
  const lights = others.filter((a) => a.kind === 'light')
  useOnscreen('home', `Home — ${room}`, { type: 'page', title: room, text: others.map((a) => a.name).join(', '), url: `home/${room}` })
  return (
    <Page title={room} className="hm-page" bg={`linear-gradient(180deg, hsl(${hue} 45% 55%), hsl(${hue + 30} 35% 30%))`}>
      <div className="hm-status-line light">{others.length} accessories · {lights.filter((l) => l.on).length} lights on</div>
      {lights.length > 0 && (
        <div className="hm-room-actions">
          <Button variant="glass" size="small" onClick={() => useOS.getState().set({ accessories: useOS.getState().accessories.map((a) => (a.room === room && a.kind === 'light' ? { ...a, on: true } : a)) })}>All Lights On</Button>
          <Button variant="glass" size="small" onClick={() => useOS.getState().set({ accessories: useOS.getState().accessories.map((a) => (a.room === room && a.kind === 'light' ? { ...a, on: false } : a)) })}>All Lights Off</Button>
        </div>
      )}
      {cams.map((c) => <div key={c.id} style={{ padding: '0 16px 14px' }}><LiveFeed camera={c.name} onClick={() => nav.push(<CameraDetail camera={c.name} />)} /></div>)}
      <div className="hm-grid">{others.map((a) => <AccessoryTile key={a.id} a={a} onOpen={onOpen} />)}</div>
      {!others.length && !cams.length && <div className="empty-state">No accessories in this room</div>}
    </Page>
  )
}

function CategoryPage({ kind }: { kind: 'climate' | 'lights' | 'security' | 'media' }) {
  const accs = useOS((s) => s.accessories)
  const [detail, setDetail] = useState<Acc | null>(null)
  const pick: Record<typeof kind, (a: Acc) => boolean> = {
    climate: (a) => a.kind === 'thermostat' || a.kind === 'fan' || a.kind === 'sensor',
    lights: (a) => a.kind === 'light',
    security: (a) => a.kind === 'lock' || a.kind === 'garage' || a.kind === 'sensor',
    media: (a) => a.kind === 'speaker' || a.kind === 'tv',
  }
  const title = { climate: 'Climate', lights: 'Lights', security: 'Security', media: 'Speakers & TVs' }[kind]
  const list = accs.filter(pick[kind])
  return (
    <Page title={title} className="hm-page" bg="var(--hm-wall)">
      {kind === 'security' && <div className="hm-status-line"><ShieldCheck size={14} /> Front door locks automatically at 10 PM</div>}
      {HOME_ROOMS.map((room) => {
        const r = list.filter((a) => a.room === room)
        if (!r.length) return null
        return (
          <section key={room}>
            <div className="hm-section-head"><span>{room}</span></div>
            <div className="hm-grid">{r.map((a) => <AccessoryTile key={a.id} a={a} onOpen={setDetail} />)}</div>
          </section>
        )
      })}
      <AccessorySheet acc={detail} onClose={() => setDetail(null)} />
    </Page>
  )
}

// ---------------------------------------------------------------- Thread network (improved connectivity)
function ThreadPage() {
  const accs = useOS((s) => s.accessories)
  const threads = accs.filter((a) => a.thread)
  const [testing, setTesting] = useState(false)
  const [results, setResults] = useState<Record<string, number> | null>(null)
  const sig = (a: HomeAccessory) => (a.id.charCodeAt(3) + a.name.length) % 3 + 2
  const runTest = () => {
    setTesting(true)
    setResults(null)
    window.setTimeout(() => {
      setTesting(false)
      setResults(Object.fromEntries(threads.map((a) => [a.id, 40 + ((a.name.length * 17) % 70)])))
    }, 1400)
  }
  return (
    <Page title="Thread Network" grouped>
      <div className="hm-thread-map">
        <svg viewBox="0 0 340 170" width="100%" aria-label="Thread mesh diagram">
          {threads.slice(0, 7).map((a, i) => {
            const ang = (i / 7) * Math.PI * 2
            const x = 170 + 125 * Math.cos(ang)
            const y = 85 + 62 * Math.sin(ang)
            return (
              <g key={a.id}>
                <line x1="170" y1="85" x2={x} y2={y} stroke="var(--accent)" strokeOpacity=".35" strokeWidth="1.5" strokeDasharray="3 4" className="hm-thread-line" />
                <circle cx={x} cy={y} r="9" fill="var(--secondary-grouped-background)" stroke="var(--accent)" strokeWidth="1.5" />
              </g>
            )
          })}
          <circle cx="170" cy="85" r="20" fill="var(--accent)" />
          <text x="170" y="90" textAnchor="middle" fontSize="12" fill="#fff" fontWeight="700">BR</text>
        </svg>
        <div className="hm-thread-cap">Border router: <b>HomePod mini</b> (Jamie’s Room) · Backup: Living Room TV</div>
      </div>
      <List header="Network" footer="iOS 27 keeps Thread accessories connected when a border router restarts, and reports status changes instantly.">
        <Row title="Network Name" detail="MyHome-Thread" />
        <Row title="Border Router" detail="HomePod mini" icon={<span className="hm-row-ic" style={{ background: '#5e5ce6' }}><Router size={16} /></span>} />
        <Row title="Channel" detail="15 · Low interference" />
        <Row title="Improved Connectivity" detail="On" icon={<span className="hm-row-ic" style={{ background: '#30d158' }}><Zap size={16} /></span>} />
        <Row title="Status Update Latency" detail={results ? '≈ 90 ms' : '< 150 ms'} />
      </List>
      <List header={`Devices (${threads.length})`}>
        {threads.map((a) => (
          <Row key={a.id} title={a.name} subtitle={`${a.room} · ${a.kind === 'light' ? 'Router' : 'End Device'}${results ? ` · ${results[a.id]} ms` : ''}`} trailing={<SignalBars n={sig(a)} />} />
        ))}
        <Row title="HomePod mini" subtitle="Jamie’s Room · Border Router" trailing={<SignalBars n={4} />} />
      </List>
      <div style={{ padding: '0 16px 30px' }}>
        <Button block onClick={runTest} disabled={testing}>{testing ? <><Spinner size={16} /> Testing…</> : 'Test Connection Speed'}</Button>
      </div>
    </Page>
  )
}

function SignalBars({ n }: { n: number }) {
  return <span className="hm-bars" aria-label={`Signal ${n} of 4`}>{[1, 2, 3, 4].map((i) => <i key={i} className={i <= n ? 'on' : ''} style={{ height: 4 + i * 3 }} />)}</span>
}

// ---------------------------------------------------------------- Add accessory (faster pairing)
function AddAccessory({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [step, setStep] = useState<'scan' | 'found' | 'pairing' | 'room' | 'done'>('scan')
  const [room, setRoom] = useState('Living Room')
  const [kind, setKind] = useState<'light' | 'outlet'>('light')
  const [elapsed, setElapsed] = useState(0)
  const t0 = useRef(0)
  useEffect(() => {
    if (!open) return
    setStep('scan')
    setElapsed(0)
    const t = window.setTimeout(() => setStep('found'), 1600)
    return () => window.clearTimeout(t)
  }, [open])
  const pair = () => {
    setStep('pairing')
    t0.current = performance.now()
    window.setTimeout(() => {
      setElapsed((performance.now() - t0.current) / 1000)
      setStep('room')
    }, 1500)
  }
  const add = () => {
    const st = useOS.getState()
    const acc: HomeAccessory = kind === 'light'
      ? { id: uid('h'), name: 'Smart Bulb', room, kind: 'light', on: true, brightness: 80, color: '#ffd28a', thread: true }
      : { id: uid('h'), name: 'Smart Plug', room, kind: 'outlet', on: false, thread: true }
    st.set({ accessories: [...st.accessories, acc] })
    setStep('done')
    window.setTimeout(() => {
      onClose()
      st.showToast(`${acc.name} added to ${room}`)
    }, 900)
  }
  return (
    <Sheet open={open} onClose={onClose} detent="large" title="Add Accessory" className="hm-add">
      <div className="hm-add-body">
        {step === 'scan' && (
          <>
            <div className="hm-scan">
              <div className="hm-scan-code" aria-hidden>
                {Array.from({ length: 64 }).map((_, i) => <i key={i} style={{ opacity: (i * 37) % 7 > 2 ? 1 : 0 }} />)}
              </div>
              <div className="hm-scan-frame" />
              <div className="hm-scan-line" />
            </div>
            <div className="hm-add-title"><ScanLine size={18} /> Scan Setup Code</div>
            <p className="hm-add-p">Position the Matter or HomeKit code in the frame. Nearby accessories appear automatically.</p>
            <Button variant="gray" onClick={() => setStep('found')}>More options…</Button>
          </>
        )}
        {step === 'found' && (
          <>
            <div className="hm-found-ic anim-pop">{kind === 'light' ? <Lightbulb size={60} /> : <Zap size={60} />}</div>
            <div className="hm-add-title">{kind === 'light' ? 'Smart Bulb' : 'Smart Plug'}</div>
            <p className="hm-add-p">Demo Home Co. · Matter over Thread</p>
            <div className="hm-kind">
              <button className={kind === 'light' ? 'on' : ''} onClick={() => setKind('light')}>Bulb</button>
              <button className={kind === 'outlet' ? 'on' : ''} onClick={() => setKind('outlet')}>Plug</button>
            </div>
            <Button block onClick={pair}>Add to Home</Button>
          </>
        )}
        {step === 'pairing' && (
          <>
            <div className="hm-pair">
              <svg viewBox="0 0 120 120" width="150" height="150"><circle cx="60" cy="60" r="52" stroke="var(--fill)" strokeWidth="8" fill="none" /><circle cx="60" cy="60" r="52" stroke="var(--accent)" strokeWidth="8" fill="none" strokeLinecap="round" className="hm-pair-ring" /></svg>
              <Wifi size={36} className="hm-pair-ic" />
            </div>
            <div className="hm-add-title">Pairing…</div>
            <p className="hm-add-p">Joining your Thread network through HomePod mini</p>
          </>
        )}
        {step === 'room' && (
          <>
            <div className="hm-found-ic ok anim-pop"><Check size={56} strokeWidth={3} /></div>
            <div className="hm-add-title">Paired in {elapsed.toFixed(1)} s</div>
            <p className="hm-add-p">Faster pairing in iOS 27 · Ready to use</p>
            <List header="Room">
              {HOME_ROOMS.map((r) => <Row key={r} title={r} onClick={() => setRoom(r)} trailing={room === r ? <Check size={18} color="var(--accent)" /> : undefined} />)}
            </List>
            <Button block onClick={add}>Done</Button>
          </>
        )}
        {step === 'done' && <div className="hm-found-ic ok anim-pop"><Check size={56} strokeWidth={3} /></div>}
      </div>
    </Sheet>
  )
}
