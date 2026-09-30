import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { create } from 'zustand'
import { Activity, Dumbbell, Users, Footprints, Bike, PersonStanding, Heart, Headphones, Pause, Play, Square, TrendingUp, TrendingDown, ChevronRight, Nfc, Check, Trophy, Mountain, Waves, Zap, Watch } from 'lucide-react'
import { NavStack, Page, useNav, TabBar, BarButton } from '../../ui/nav'
import { Sheet, showAlert } from '../../ui/overlay'
import { Avatar, Segmented } from '../../ui/controls'
import { useOS } from '../../os/store'
import { useAppRoute, useNow, useOnscreen } from '../../os/hooks'
import { HEALTH } from '../../os/data/world'
import { dayLabel, fmtTime, fmtDuration } from '../../os/time'
import { useShell } from '../../shell/shellState'
import { RouteMap } from '../health/RouteMap'
import './fitness.css'

// ---------------------------------------------------------------- active workout engine (survives app switches)
interface Machine { name: string; gym: string; speed: number; incline: number }
interface Live {
  active: boolean
  kind: string
  startedAt: number
  pausedAt: number | null
  pausedTotal: number
  hr: number
  kcal: number
  dist: number
  machine: Machine | null
  hrHistory: number[]
}
const IDLE: Live = { active: false, kind: '', startedAt: 0, pausedAt: null, pausedTotal: 0, hr: 0, kcal: 0, dist: 0, machine: null, hrHistory: [] }
const useLive = create<Live & { last: Live | null }>(() => ({ ...IDLE, last: null }))

let ticker: number | undefined
const ACT_ID = 'workout'

function elapsedOf(l: Live, now = Date.now()) {
  if (!l.active) return 0
  return ((l.pausedAt ?? now) - l.startedAt - l.pausedTotal) / 1000
}

function startWorkout(kind: string, machine: Machine | null = null) {
  const st = useOS.getState()
  const hr = 96
  useLive.setState({ ...IDLE, active: true, kind, startedAt: Date.now(), hr, machine, hrHistory: [hr] })
  const src = st.airpods.connected && st.airpods.heartRate ? 'AirPods Pro 3' : 'Apple Watch'
  st.startActivity({ id: ACT_ID, kind: 'workout', title: kind, subtitle: `${src} · 0:00`, app: 'fitness', priority: 3, startedAt: Date.now(), data: { hr } })
  window.clearInterval(ticker)
  ticker = window.setInterval(() => {
    const l = useLive.getState()
    if (!l.active || l.pausedAt) return
    const el = elapsedOf(l)
    const target = Math.min(172, 112 + el * 0.9 + (machine ? machine.incline * 3 : 0))
    const hr = Math.round(l.hr + (target - l.hr) * 0.25 + (Math.random() - 0.5) * 4)
    const speed = machine ? machine.speed : /Run/.test(kind) ? 6.2 : /Walk/.test(kind) ? 3.1 : /Cycl/.test(kind) ? 13 : 0
    useLive.setState({ hr, kcal: l.kcal + hr * 0.0021 * 2, dist: l.dist + (speed / 3600) * 2, hrHistory: [...l.hrHistory, hr].slice(-90) })
    useOS.getState().updateActivity(ACT_ID, { data: { hr }, subtitle: `${src} · ${fmtDuration(el)}` })
  }, 2000)
}

function togglePause() {
  const l = useLive.getState()
  if (!l.active) return
  if (l.pausedAt) useLive.setState({ pausedTotal: l.pausedTotal + (Date.now() - l.pausedAt), pausedAt: null })
  else useLive.setState({ pausedAt: Date.now() })
}

function endWorkout() {
  window.clearInterval(ticker)
  const l = useLive.getState()
  useLive.setState({ ...IDLE, last: { ...l, pausedAt: l.pausedAt ?? Date.now() } })
  useOS.getState().endActivity(ACT_ID)
}

// ---------------------------------------------------------------- rings
export function Rings({ size = 170, move, exercise, stand, animate = true }: { size?: number; move: number; exercise: number; stand: number; animate?: boolean }) {
  const [shown, setShown] = useState(animate ? [0, 0, 0] : [move, exercise, stand])
  useEffect(() => {
    const t = requestAnimationFrame(() => setShown([move, exercise, stand]))
    return () => cancelAnimationFrame(t)
  }, [move, exercise, stand])
  const rings = [
    { r: 0.42, c1: '#fa114f', c2: '#ff5c8a', v: shown[0] },
    { r: 0.3, c1: '#92e82a', c2: '#c4ff5c', v: shown[1] },
    { r: 0.18, c1: '#1eeaef', c2: '#7af7ff', v: shown[2] },
  ]
  const sw = size * 0.105
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="ft-rings" role="img" aria-label={`Move ${Math.round(move * 100)}%, Exercise ${Math.round(exercise * 100)}%, Stand ${Math.round(stand * 100)}%`}>
      {rings.map((g, i) => {
        const R = g.r * size
        const C = 2 * Math.PI * R
        const frac = Math.min(g.v, 1)
        return (
          <g key={i} transform={`rotate(-90 ${size / 2} ${size / 2})`}>
            <circle cx={size / 2} cy={size / 2} r={R} stroke={g.c1} strokeOpacity=".22" strokeWidth={sw} fill="none" />
            <circle cx={size / 2} cy={size / 2} r={R} stroke={g.c1} strokeWidth={sw} fill="none" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - frac)} className="ft-ring-arc" />
            {g.v > 1 && <circle cx={size / 2} cy={size / 2} r={R} stroke={g.c2} strokeWidth={sw} fill="none" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - (g.v - 1))} className="ft-ring-arc" />}
          </g>
        )
      })}
    </svg>
  )
}

// ---------------------------------------------------------------- app shell
type Tab = 'summary' | 'workout' | 'sharing'
type NavApi = ReturnType<typeof useNav>
function Registrar({ onNav, children }: { onNav: (n: NavApi) => void; children: ReactNode }) {
  const nav = useNav()
  useEffect(() => onNav(nav), [nav, onNav])
  return <>{children}</>
}

export default function FitnessApp() {
  const [tab, setTab] = useState<Tab>('summary')
  const [gym, setGym] = useState(false)
  const active = useLive((s) => s.active)
  const [showLive, setShowLive] = useState(false)
  const navs = useRef<Partial<Record<Tab, NavApi>>>({})
  const regs = useRef<Partial<Record<Tab, (n: NavApi) => void>>>({})
  const regFor = (t: Tab) => (regs.current[t] ??= (n: NavApi) => void (navs.current[t] = n))
  const isFg = useOS((s) => s.openApp === 'fitness')
  useEffect(() => {
    if (!isFg) return
    useShell.getState().set({ statusOverride: 'light' })
    return () => useShell.getState().set({ statusOverride: null })
  }, [isFg])
  useEffect(() => { if (active) setShowLive(true) }, [active])
  useAppRoute('fitness', (r) => {
    if (r === 'workout') { setTab('workout'); if (useLive.getState().active) setShowLive(true) }
    else if (r === 'gymkit') setGym(true)
    else if (r.startsWith('workout/')) { const w = HEALTH.workouts.find((x) => x.id === r.slice(8)); if (w) { setTab('summary'); navs.current.summary?.push(<WorkoutDetail w={w} />) } }
  })
  const start = (k: string) => { startWorkout(k); setShowLive(true) }
  const roots: Record<Tab, ReactNode> = {
    summary: <Summary />,
    workout: <WorkoutTab onStart={start} onGym={() => setGym(true)} />,
    sharing: <SharingTab />,
  }
  return (
    <div className="app-root ft-root">
      {(Object.keys(roots) as Tab[]).map((t) => (
        <div key={t} className="ft-pane" style={{ display: t === tab ? undefined : 'none' }} inert={t !== tab ? true : undefined}>
          <NavStack root={<Registrar onNav={regFor(t)}>{roots[t]}</Registrar>} />
        </div>
      ))}
      {active && !showLive && (
        <button className="ft-live-pill glass dark-glass anim-up" onClick={() => setShowLive(true)}>
          <Heart size={16} fill="#ff375f" color="#ff375f" /> <LiveMini />
        </button>
      )}
      <TabBar
        tabs={[{ id: 'summary', label: 'Summary', icon: <Activity size={24} /> }, { id: 'workout', label: 'Workout', icon: <Dumbbell size={24} /> }, { id: 'sharing', label: 'Sharing', icon: <Users size={24} /> }]}
        value={tab}
        onChange={(t) => { if (t === tab) navs.current[t]?.popToRoot(); setTab(t) }}
      />
      <LiveWorkout open={showLive && active} onClose={() => setShowLive(false)} />
      <GymKitSheet open={gym} onClose={() => setGym(false)} onConnected={(m) => { setGym(false); startWorkout(`${m.name} Run`, m); setShowLive(true) }} />
      <WorkoutSummary />
    </div>
  )
}

function LiveMini() {
  const l = useLive()
  const now = useNow(1000)
  return <span>{l.kind} · {fmtDuration(elapsedOf(l, now))} · {l.hr} BPM</span>
}

// ---------------------------------------------------------------- summary
function Summary() {
  const nav = useNav()
  const m = HEALTH.move
  const e = HEALTH.exercise
  const s = HEALTH.stand
  const week = [0.9, 1.1, 0.7, 0.95, 1.25, 0.6, m.value / m.goal]
  useOnscreen('fitness', 'Fitness summary', { type: 'page', title: 'Fitness', text: `Move ${m.value}/${m.goal} kcal, Exercise ${e.value}/${e.goal} min, Stand ${s.value}/${s.goal} hr`, url: 'fitness' })
  return (
    <Page title="Summary" bottomExtra={70} bg="#000" className="ft-page" trailing={<BarButton label="Profile" onClick={() => useOS.getState().showToast('Jamie Park · Move goal 500 kcal')}><Avatar id="me" size={30} /></BarButton>}>
      <div className="ft-date">{new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).toUpperCase()}</div>
      <button className="ft-card ft-activity" onClick={() => nav.push(<ActivityDetail />)}>
        <div className="ft-card-h">Activity Rings <ChevronRight size={16} /></div>
        <div className="ft-act-body">
          <div className="ft-act-stats">
            <div><span>Move</span><b style={{ color: '#fa114f' }}>{m.value}/{m.goal}<small>KCAL</small></b></div>
            <div><span>Exercise</span><b style={{ color: '#92e82a' }}>{e.value}/{e.goal}<small>MIN</small></b></div>
            <div><span>Stand</span><b style={{ color: '#1eeaef' }}>{s.value}/{s.goal}<small>HRS</small></b></div>
          </div>
          <Rings size={150} move={m.value / m.goal} exercise={e.value / e.goal} stand={s.value / s.goal} />
        </div>
      </button>
      <div className="ft-grid2">
        <div className="ft-card"><div className="ft-card-h">Step Count</div><b className="ft-big" style={{ color: '#bf5af2' }}>{HEALTH.steps.toLocaleString()}</b></div>
        <div className="ft-card"><div className="ft-card-h">Step Distance</div><b className="ft-big" style={{ color: '#bf5af2' }}>{HEALTH.distance}<small>MI</small></b></div>
      </div>
      <div className="ft-card">
        <div className="ft-card-h">This Week</div>
        <div className="ft-week">
          {week.map((v, i) => (
            <div key={i}><Rings size={36} move={v} exercise={Math.min(1.2, v * 1.1)} stand={Math.min(1, v * 0.9)} animate={false} /><span>{'SMTWTFS'[(new Date().getDay() - 6 + i + 7) % 7]}</span></div>
          ))}
        </div>
      </div>
      <button className="ft-card" onClick={() => nav.push(<Trends />)}>
        <div className="ft-card-h">Trends <ChevronRight size={16} /></div>
        <div className="ft-trends">
          <div><TrendingUp size={20} color="#fa114f" /><span>Move</span><b style={{ color: '#fa114f' }}>431 kcal/day</b></div>
          <div><TrendingUp size={20} color="#92e82a" /><span>Exercise</span><b style={{ color: '#92e82a' }}>38 min/day</b></div>
          <div><TrendingDown size={20} color="#1eeaef" /><span>Stand</span><b style={{ color: '#1eeaef' }}>10 hr/day</b></div>
          <div><TrendingUp size={20} color="#ff9f0a" /><span>Walking Pace</span><b style={{ color: '#ff9f0a' }}>17:40 /mi</b></div>
        </div>
      </button>
      <div className="ft-sec">Workouts <button onClick={() => nav.push(<AllWorkouts />)}>Show More</button></div>
      <div className="ft-list">
        {HEALTH.workouts.map((w) => <WorkoutRow key={w.id} w={w} />)}
      </div>
      <div className="ft-sec">Awards</div>
      <div className="ft-awards scroll-x">
        {[{ n: 'Move Streak', c: '#fa114f', t: '12 days' }, { n: 'New Move Record', c: '#ff9f0a', t: '812 kcal' }, { n: '5K Run', c: '#30d158', t: 'Best time 29:48' }, { n: 'Perfect Week', c: '#1eeaef', t: 'Stand' }].map((a) => (
          <button key={a.n} className="ft-award" style={{ ['--c' as string]: a.c }} onClick={() => useOS.getState().showToast(`${a.n}: ${a.t}`)}><Trophy size={28} /><b>{a.n}</b><span>{a.t}</span></button>
        ))}
      </div>
    </Page>
  )
}

function WorkoutRow({ w }: { w: (typeof HEALTH.workouts)[number] }) {
  const nav = useNav()
  const icon = /Run/.test(w.kind) ? <PersonStanding size={22} /> : /Walk/.test(w.kind) ? <Footprints size={22} /> : <Activity size={22} />
  return (
    <button className="ft-wrow" onClick={() => nav.push(<WorkoutDetail w={w} />)}>
      <span className="ft-wrow-ic">{icon}</span>
      <span className="grow" style={{ textAlign: 'left' }}>
        <span className="ft-wrow-t">{w.kind}</span>
        <b className="ft-wrow-v">{w.distance !== '—' ? w.distance : w.duration}</b>
      </span>
      <span className="ft-wrow-d">{dayLabel(w.when)}</span>
    </button>
  )
}

function AllWorkouts() {
  return <Page title="Workouts" bg="#000" className="ft-page" bottomExtra={70}><div className="ft-list">{HEALTH.workouts.map((w) => <WorkoutRow key={w.id} w={w} />)}</div></Page>
}

function ActivityDetail() {
  const [range, setRange] = useState<'Day' | 'Week' | 'Month'>('Day')
  const hours = useMemo(() => Array.from({ length: 24 }, (_, h) => (h < 7 ? 2 : h > 21 ? 4 : 10 + ((h * 37) % 40))), [])
  return (
    <Page title="Activity" bg="#000" className="ft-page" large={false} bottomExtra={70}>
      <div style={{ padding: '0 16px 12px' }}><Segmented options={['Day', 'Week', 'Month'] as const} value={range} onChange={setRange} /></div>
      <div className="ft-center"><Rings size={220} move={range === 'Day' ? 0.84 : range === 'Week' ? 0.92 : 0.88} exercise={range === 'Day' ? 1.13 : 0.97} stand={range === 'Day' ? 0.75 : 0.9} key={range} /></div>
      {(['Move', 'Exercise', 'Stand'] as const).map((k, i) => (
        <div key={k} className="ft-card">
          <div className="ft-card-h" style={{ color: ['#fa114f', '#92e82a', '#1eeaef'][i] }}>{k}</div>
          <b className="ft-big" style={{ color: ['#fa114f', '#92e82a', '#1eeaef'][i] }}>{[`${HEALTH.move.value}/${HEALTH.move.goal}`, `${HEALTH.exercise.value}/${HEALTH.exercise.goal}`, `${HEALTH.stand.value}/${HEALTH.stand.goal}`][i]}<small>{['KCAL', 'MIN', 'HRS'][i]}</small></b>
          <div className="ft-hours">{hours.map((v, h) => <i key={h} style={{ height: (i === 2 ? (v > 8 ? 20 : 3) : v * (i === 1 ? 0.5 : 1)), background: ['#fa114f', '#92e82a', '#1eeaef'][i] }} />)}</div>
        </div>
      ))}
    </Page>
  )
}

function Trends() {
  return (
    <Page title="Trends" bg="#000" className="ft-page" bottomExtra={70}>
      <p className="ft-p">Trends compare your last 90 days with the past 365 days.</p>
      {[['Move', '431 kcal/day', '+6%', '#fa114f', true], ['Exercise', '38 min/day', '+11%', '#92e82a', true], ['Stand', '10 hr/day', '−4%', '#1eeaef', false], ['Distance', '3.1 mi/day', '+3%', '#bf5af2', true], ['Walking Pace', '17:40 /mi', 'faster', '#ff9f0a', true], ['Cardio Fitness', '44.2 VO₂ max', 'above avg', '#ff375f', true]].map(([n, v, d, c, up]) => (
        <div key={n as string} className="ft-card ft-trend-row">
          {up ? <TrendingUp size={26} color={c as string} /> : <TrendingDown size={26} color={c as string} />}
          <div className="grow"><span className="ft-card-h">{n}</span><b style={{ color: c as string }}>{v}</b></div>
          <span className="ft-muted">{d}</span>
        </div>
      ))}
    </Page>
  )
}

function WorkoutDetail({ w }: { w: (typeof HEALTH.workouts)[number] }) {
  const [improved, setImproved] = useState(true)
  const hr = useMemo(() => Array.from({ length: 40 }, (_, i) => w.hr - 20 + Math.round(Math.sin(i / 4) * 12 + (i / 40) * 25 + ((i * 17) % 7))), [w.hr])
  const max = Math.max(...hr)
  const min = Math.min(...hr)
  return (
    <Page title={dayLabel(w.when)} large={false} bg="#000" className="ft-page" bottomExtra={70}>
      <div className="ft-wd-head">
        <span className="ft-wrow-ic big"><Activity size={30} /></span>
        <div><b>{w.kind}</b><span>{fmtTime(w.when)} · Maple Grove</span></div>
      </div>
      <div className="ft-card">
        <div className="ft-card-h">Workout Details</div>
        <div className="ft-stats">
          <div><span>Workout Time</span><b style={{ color: '#ffd60a' }}>{w.duration}</b></div>
          <div><span>Distance</span><b style={{ color: '#1eeaef' }}>{w.distance}</b></div>
          <div><span>Active Kcal</span><b style={{ color: '#fa114f' }}>{Math.round(w.hr * 2.1)}</b></div>
          <div><span>Avg Heart Rate</span><b style={{ color: '#ff375f' }}>{w.hr} BPM</b></div>
        </div>
      </div>
      {'route' in w && w.route && (
        <div className="ft-card">
          <div className="ft-card-h">Map</div>
          <div className="ft-map"><RouteMap seed={w.id.length + w.kind.length} improved={improved} showBoth={!improved} height={190} /></div>
          <button className={`ft-toggle ${improved ? 'on' : ''}`} onClick={() => setImproved(!improved)}><Check size={14} /> Improved route accuracy {improved ? 'On' : 'Off'}</button>
        </div>
      )}
      {'calibrated' in w && w.calibrated && (
        <div className="ft-card"><div className="ft-card-h"><Dumbbell size={14} /> GymKit · Treadmill</div><p className="ft-p0">Distance synced from the treadmill and calibrated with your stride — improved indoor accuracy.</p></div>
      )}
      <div className="ft-card">
        <div className="ft-card-h"><Heart size={14} fill="#ff375f" color="#ff375f" /> Heart Rate <span className="ft-src"><Headphones size={12} /> AirPods Pro 3</span></div>
        <svg viewBox="0 0 400 110" width="100%" height="110" preserveAspectRatio="none">
          <polyline points={hr.map((v, i) => `${(i / (hr.length - 1)) * 400},${100 - ((v - min) / (max - min || 1)) * 90}`).join(' ')} fill="none" stroke="#ff375f" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
        </svg>
        <div className="ft-muted">{min}–{max} BPM</div>
      </div>
    </Page>
  )
}

// ---------------------------------------------------------------- workout tab
const TYPES = [
  { k: 'Outdoor Run', i: <PersonStanding size={30} />, c: '#92e82a' },
  { k: 'Outdoor Walk', i: <Footprints size={30} />, c: '#92e82a' },
  { k: 'Indoor Run', i: <PersonStanding size={30} />, c: '#92e82a' },
  { k: 'Outdoor Cycle', i: <Bike size={30} />, c: '#92e82a' },
  { k: 'Hiking', i: <Mountain size={30} />, c: '#92e82a' },
  { k: 'Pool Swim', i: <Waves size={30} />, c: '#92e82a' },
  { k: 'HIIT', i: <Zap size={30} />, c: '#92e82a' },
  { k: 'Strength', i: <Dumbbell size={30} />, c: '#92e82a' },
]

function WorkoutTab({ onStart, onGym }: { onStart: (k: string) => void; onGym: () => void }) {
  const airpods = useOS((s) => s.airpods)
  return (
    <Page title="Workout" bottomExtra={70} bg="#000" className="ft-page">
      <div className={`ft-hrsrc ${airpods.connected && airpods.heartRate ? 'on' : ''}`}>
        <Headphones size={18} />
        <div className="grow"><b>AirPods Pro 3</b><span>{airpods.connected ? (airpods.heartRate ? 'Heart rate sensing ready' : 'Heart rate sensing off') : 'Not connected — using Apple Watch'}</span></div>
        <button onClick={() => useOS.getState().set({ airpods: { ...airpods, heartRate: !airpods.heartRate } })}>{airpods.heartRate ? 'On' : 'Off'}</button>
      </div>
      <button className="ft-gym" onClick={onGym}>
        <span className="ft-gym-ic"><Nfc size={24} /></span>
        <span className="grow" style={{ textAlign: 'left' }}><b>GymKit</b><span>Connect iPhone to a treadmill, bike or rower</span></span>
        <ChevronRight size={18} />
      </button>
      <div className="ft-types">
        {TYPES.map((t) => (
          <button key={t.k} className="ft-type" onClick={() => onStart(t.k)}>
            <span className="ft-type-ic" style={{ color: t.c }}>{t.i}</span>
            <b>{t.k}</b>
            <span className="ft-type-go"><Play size={14} fill="currentColor" strokeWidth={0} /></span>
          </button>
        ))}
      </div>
    </Page>
  )
}

function SharingTab() {
  const friends = [{ id: 'alex', m: 0.8, e: 1.2, s: 0.9, t: 'Outdoor Run · 3.4 mi' }, { id: 'sam', m: 1.1, e: 0.6, s: 1, t: 'Drumline practice' }, { id: 'priya', m: 0.5, e: 0.4, s: 0.7, t: 'Walk · 1.2 mi' }]
  return (
    <Page title="Sharing" bottomExtra={70} bg="#000" className="ft-page">
      <div className="ft-list">
        {friends.map((f) => (
          <button key={f.id} className="ft-wrow" onClick={() => useOS.getState().showToast('Sent a 👏 to your friend')}>
            <Avatar id={f.id} size={44} />
            <span className="grow" style={{ textAlign: 'left' }}><span className="ft-wrow-t">{f.id[0].toUpperCase() + f.id.slice(1)}</span><span className="ft-muted">{f.t}</span></span>
            <Rings size={46} move={f.m} exercise={f.e} stand={f.s} animate={false} />
          </button>
        ))}
      </div>
    </Page>
  )
}

// ---------------------------------------------------------------- live workout (full screen)
function LiveWorkout({ open, onClose }: { open: boolean; onClose: () => void }) {
  const l = useLive()
  const now = useNow(1000)
  const airpods = useOS((s) => s.airpods)
  const el = elapsedOf(l, now)
  const zone = l.hr < 115 ? 1 : l.hr < 133 ? 2 : l.hr < 150 ? 3 : l.hr < 165 ? 4 : 5
  const pace = l.dist > 0.01 ? el / 60 / l.dist : 0
  const src = airpods.connected && airpods.heartRate ? 'AirPods Pro 3' : 'Apple Watch'
  return (
    <Sheet open={open} onClose={onClose} detent="full" className="ft-live" closeButton={false} label="Workout in progress">
      <div className="ft-live-in">
        <div className="ft-live-top"><span className="ft-live-kind">{l.kind}</span><button onClick={onClose} className="ft-live-min">Minimize</button></div>
        <div className="ft-live-time">{fmtDuration(el)}<span>{l.pausedAt ? 'PAUSED' : ''}</span></div>
        <div className="ft-live-hr"><Heart size={28} fill="#ff375f" color="#ff375f" className={l.pausedAt ? '' : 'ft-beat'} style={{ animationDuration: `${60 / Math.max(60, l.hr)}s` }} /><b>{l.hr}</b><small>BPM</small></div>
        <div className="ft-src-line"><Headphones size={13} /> Live heart rate from {src}</div>
        <div className="ft-zones">{[1, 2, 3, 4, 5].map((z) => <i key={z} className={z === zone ? 'on' : ''} style={{ ['--zc' as string]: ['#5ac8fa', '#30d158', '#ffd60a', '#ff9f0a', '#ff375f'][z - 1] }}>{z === zone ? `Zone ${z}` : ''}</i>)}</div>
        <svg viewBox="0 0 300 60" className="ft-live-graph" preserveAspectRatio="none">
          <polyline points={l.hrHistory.map((v, i) => `${(i / Math.max(1, l.hrHistory.length - 1)) * 300},${58 - ((v - 80) / 100) * 56}`).join(' ')} fill="none" stroke="#ff375f" strokeWidth="2" vectorEffect="non-scaling-stroke" />
        </svg>
        <div className="ft-live-grid">
          <div><span>Active Kcal</span><b style={{ color: '#fa114f' }}>{Math.round(l.kcal)}</b></div>
          <div><span>Distance</span><b style={{ color: '#1eeaef' }}>{l.dist.toFixed(2)} mi</b></div>
          <div><span>Avg Pace</span><b style={{ color: '#ffd60a' }}>{pace ? `${Math.floor(pace)}'${String(Math.round((pace % 1) * 60)).padStart(2, '0')}"` : '—'}</b></div>
          {l.machine ? <div><span>{l.machine.name} · {l.machine.incline}%</span><b style={{ color: '#92e82a' }}>{l.machine.speed} mph</b></div> : <div><span>Elevation</span><b style={{ color: '#92e82a' }}>{Math.round(el / 20)} ft</b></div>}
        </div>
        {l.machine && <div className="ft-src-line"><Nfc size={13} /> GymKit · {l.machine.gym}</div>}
        <div className="ft-live-ctl">
          <button className="end" onClick={() => showAlert({ title: 'End Workout?', actions: [{ label: 'Cancel', style: 'cancel' }, { label: 'End', style: 'destructive', onPress: () => { endWorkout(); onClose() } }] })} aria-label="End workout"><Square size={26} fill="currentColor" /></button>
          <button className="pause" onClick={togglePause} aria-label={l.pausedAt ? 'Resume' : 'Pause'}>{l.pausedAt ? <Play size={30} fill="currentColor" strokeWidth={0} /> : <Pause size={30} fill="currentColor" strokeWidth={0} />}</button>
        </div>
      </div>
    </Sheet>
  )
}

function WorkoutSummary() {
  const last = useLive((s) => s.last)
  if (!last) return null
  const el = elapsedOf(last, last.pausedAt ?? Date.now())
  const avg = Math.round(last.hrHistory.reduce((a, b) => a + b, 0) / (last.hrHistory.length || 1))
  return (
    <Sheet open={!!last} onClose={() => useLive.setState({ last: null })} detent="auto" title="Workout Summary">
      <div className="ft-sum">
        <b className="ft-sum-k">{last.kind}</b>
        <div className="ft-stats">
          <div><span>Time</span><b style={{ color: '#ffd60a' }}>{fmtDuration(el)}</b></div>
          <div><span>Active Kcal</span><b style={{ color: '#fa114f' }}>{Math.round(last.kcal)}</b></div>
          <div><span>Distance</span><b style={{ color: '#1eeaef' }}>{last.dist.toFixed(2)} mi</b></div>
          <div><span>Avg HR</span><b style={{ color: '#ff375f' }}>{avg} BPM</b></div>
        </div>
        <div className="ft-src-line dark"><Watch size={13} /> Saved to Health · heart rate from AirPods Pro 3</div>
      </div>
    </Sheet>
  )
}

// ---------------------------------------------------------------- GymKit
function GymKitSheet({ open, onClose, onConnected }: { open: boolean; onClose: () => void; onConnected: (m: Machine) => void }) {
  const [step, setStep] = useState<'hold' | 'connecting' | 'ready'>('hold')
  const [speed, setSpeed] = useState(6.0)
  useEffect(() => { if (open) setStep('hold') }, [open])
  const machine: Machine = { name: 'Treadmill', gym: 'Lincoln Fitness Center', speed, incline: 1.5 }
  return (
    <Sheet open={open} onClose={onClose} detent="large" title="GymKit" className="ft-gymsheet">
      <div className="ft-gk">
        <div className={`ft-gk-art ${step}`}>
          <svg viewBox="0 0 200 140" width="220">
            <rect x="20" y="96" width="160" height="16" rx="6" fill="#3a3a3c" />
            <rect x="30" y="86" width="140" height="12" rx="4" fill="#1c1c1e" />
            <rect x="140" y="30" width="10" height="62" rx="4" fill="#48484a" />
            <rect x="118" y="20" width="56" height="26" rx="6" fill="#2c2c2e" />
            <circle cx="146" cy="33" r="6" fill={step === 'hold' ? '#0a84ff' : '#30d158'} />
          </svg>
          {step === 'connecting' && <><span className="ft-wave" /><span className="ft-wave d2" /></>}
        </div>
        {step === 'hold' && <>
          <h2>Hold iPhone Near the Reader</h2>
          <p>Tap iPhone on the GymKit symbol on the treadmill console to pair.</p>
          <button className="ft-btn" onClick={() => { setStep('connecting'); window.setTimeout(() => setStep('ready'), 1400) }}><Nfc size={18} /> Tap to Connect</button>
        </>}
        {step === 'connecting' && <><h2>Connecting…</h2><p>Syncing speed, incline and distance.</p></>}
        {step === 'ready' && <>
          <h2><Check size={22} /> Connected</h2>
          <p>Treadmill · Lincoln Fitness Center. The machine now uses your weight and heart rate for accurate calories, and syncs distance back to Fitness.</p>
          <div className="ft-speed">
            <button onClick={() => setSpeed((s) => Math.max(2, +(s - 0.5).toFixed(1)))} aria-label="Slower">−</button>
            <b>{speed.toFixed(1)} mph</b>
            <button onClick={() => setSpeed((s) => Math.min(12, +(s + 0.5).toFixed(1)))} aria-label="Faster">+</button>
          </div>
          <button className="ft-btn go" onClick={() => onConnected(machine)}><Play size={18} fill="currentColor" strokeWidth={0} /> Press Start on Treadmill</button>
        </>}
      </div>
    </Sheet>
  )
}

