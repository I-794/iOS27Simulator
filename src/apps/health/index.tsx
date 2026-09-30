import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { Heart, Footprints, Moon, Flame, Activity, Users, LayoutGrid, ChevronRight, Pin, RefreshCw, Headphones, Watch, Smartphone, Globe, Dumbbell, Ear, Brain, Scale, Apple, Wind, Stethoscope, Accessibility, Pill, CircleDot, BookOpen, Bell, Info, Check, Plus } from 'lucide-react'
import { NavStack, Page, useNav, TabBar, BarButton } from '../../ui/nav'
import { List, Row } from '../../ui/list'
import { Segmented, SearchField, Chip, Avatar, Switch } from '../../ui/controls'
import { Sheet } from '../../ui/overlay'
import { useOS } from '../../os/store'
import { useAppRoute, useNow, useOnscreen } from '../../os/hooks'
import { HEALTH } from '../../os/data/world'
import { dayLabel, fmtTime } from '../../os/time'
import { BarChart, makeSeries, RANGES, type Range } from './charts'
import { RouteMap } from './RouteMap'
import './health.css'

// ---------------------------------------------------------------- local state
interface HState {
  pinned: string[]
  lifeStage: 'none' | 'perimenopause' | 'menopause' | 'postmenopause'
  symptoms: Record<string, string[]>
  cycleNotifs: boolean
  cycleEnabled: boolean
  set: (p: Partial<HState>) => void
}
const useH = create<HState>()(persist((set) => ({
  pinned: ['steps', 'hr', 'sleep', 'energy'],
  lifeStage: 'none',
  symptoms: {},
  cycleNotifs: true,
  cycleEnabled: false,
  set: (p) => set(p),
}), { name: 'ios27-health', partialize: (s) => ({ pinned: s.pinned, lifeStage: s.lifeStage, symptoms: s.symptoms, cycleNotifs: s.cycleNotifs, cycleEnabled: s.cycleEnabled }) }))

interface Metric { id: 'steps' | 'hr' | 'sleep' | 'energy'; name: string; color: string; icon: ReactNode; unit: string; value: string; category: string }
const METRICS: Metric[] = [
  { id: 'steps', name: 'Steps', color: '#ff6b35', icon: <Footprints size={16} />, unit: 'steps', value: HEALTH.steps.toLocaleString(), category: 'Activity' },
  { id: 'hr', name: 'Heart Rate', color: '#ff2d55', icon: <Heart size={16} fill="currentColor" />, unit: 'BPM', value: String(HEALTH.heartRate), category: 'Heart' },
  { id: 'sleep', name: 'Sleep', color: '#5e5ce6', icon: <Moon size={16} fill="currentColor" />, unit: 'hr', value: `${Math.floor(HEALTH.sleep.hours)} hr ${Math.round((HEALTH.sleep.hours % 1) * 60)} min`, category: 'Sleep' },
  { id: 'energy', name: 'Active Energy', color: '#ff375f', icon: <Flame size={16} fill="currentColor" />, unit: 'kcal', value: String(HEALTH.move.value), category: 'Activity' },
]

// ---------------------------------------------------------------- refresh indicator (faster data refresh)
function useRefresh() {
  const [syncing, setSyncing] = useState(false)
  const [at, setAt] = useState(Date.now())
  const [steps, setSteps] = useState(HEALTH.steps)
  const [hr, setHr] = useState(HEALTH.heartRate)
  useEffect(() => {
    const t = window.setInterval(() => {
      setSyncing(true)
      window.setTimeout(() => {
        setSyncing(false)
        setAt(Date.now())
        setSteps((s) => s + Math.round(Math.random() * 24))
        setHr(66 + Math.round(Math.random() * 12))
      }, 700)
    }, 15000)
    return () => window.clearInterval(t)
  }, [])
  const refresh = () => {
    setSyncing(true)
    window.setTimeout(() => { setSyncing(false); setAt(Date.now()); setSteps((s) => s + 3) }, 500)
  }
  return { syncing, at, steps, hr, refresh }
}

function UpdatedPill({ syncing, at, onRefresh }: { syncing: boolean; at: number; onRefresh: () => void }) {
  const now = useNow(1000)
  const secs = Math.round((now - at) / 1000)
  return (
    <button className={`hl-updated ${syncing ? 'sync' : ''}`} onClick={onRefresh} aria-label="Refresh health data">
      <RefreshCw size={12} className={syncing ? 'hl-spin' : ''} />
      {syncing ? 'Syncing with Apple Watch & AirPods…' : secs < 10 ? 'Updated just now' : `Updated ${secs}s ago`}
    </button>
  )
}

// ---------------------------------------------------------------- app
type Tab = 'summary' | 'sharing' | 'browse'
type NavApi = ReturnType<typeof useNav>
function Registrar({ onNav, children }: { onNav: (n: NavApi) => void; children: ReactNode }) {
  const nav = useNav()
  useEffect(() => onNav(nav), [nav, onNav])
  return <>{children}</>
}

export default function HealthApp() {
  const [tab, setTab] = useState<Tab>('summary')
  const [search, setSearch] = useState(false)
  const navs = useRef<Partial<Record<Tab, NavApi>>>({})
  const regs = useRef<Partial<Record<Tab, (n: NavApi) => void>>>({})
  const regFor = (t: Tab) => (regs.current[t] ??= (n: NavApi) => void (navs.current[t] = n))
  useAppRoute('health', (r) => {
    const nav = navs.current[tab]
    if (r === 'cycle') nav?.push(<CyclePage />)
    else if (r.startsWith('metric/')) { const m = METRICS.find((x) => x.id === r.slice(7)); if (m) nav?.push(<MetricPage m={m} />) }
    else if (r.startsWith('workout/')) { const w = HEALTH.workouts.find((x) => x.id === r.slice(8)); if (w) nav?.push(<WorkoutPage w={w} />) }
  })
  const roots: Record<Tab, ReactNode> = { summary: <Summary />, sharing: <Sharing />, browse: <Browse search={search} /> }
  return (
    <div className="app-root hl-root">
      {(Object.keys(roots) as Tab[]).map((t) => (
        <div key={t} className="hl-pane" style={{ display: t === tab ? undefined : 'none' }} inert={t !== tab ? true : undefined}>
          <NavStack root={<Registrar onNav={regFor(t)}>{roots[t]}</Registrar>} />
        </div>
      ))}
      <TabBar
        tabs={[{ id: 'summary', label: 'Summary', icon: <Heart size={24} /> }, { id: 'sharing', label: 'Sharing', icon: <Users size={24} /> }, { id: 'browse', label: 'Browse', icon: <LayoutGrid size={24} /> }]}
        value={tab}
        onChange={(t) => { if (t === tab) navs.current[t]?.popToRoot(); setTab(t); setSearch(false) }}
        onSearch={() => { setTab('browse'); setSearch(true) }}
        searchActive={search && tab === 'browse'}
      />
    </div>
  )
}

// ---------------------------------------------------------------- Summary
function Summary() {
  const nav = useNav()
  const pinned = useH((s) => s.pinned)
  const r = useRefresh()
  const cycleEnabled = useH((s) => s.cycleEnabled)
  useOnscreen('health', 'Health summary', { type: 'page', title: 'Health Summary', text: `Steps ${r.steps}, heart rate ${r.hr} BPM, sleep ${HEALTH.sleep.hours} hours`, url: 'health' })
  const val = (m: Metric) => (m.id === 'steps' ? r.steps.toLocaleString() : m.id === 'hr' ? String(r.hr) : m.value)
  return (
    <Page title="Summary" bottomExtra={70} grouped trailing={<BarButton label="Profile" onClick={() => useOS.getState().showToast('Health Details: Jamie Park, 16')}><Avatar id="me" size={30} /></BarButton>}>
      <div className="hl-top"><UpdatedPill syncing={r.syncing} at={r.at} onRefresh={r.refresh} /></div>
      <div className="hl-sec-head"><span>Pinned</span><button onClick={() => nav.push(<EditPinned />)}>Edit</button></div>
      {METRICS.filter((m) => pinned.includes(m.id)).map((m) => (
        <button key={m.id} className="hl-card" onClick={() => nav.push(<MetricPage m={m} />)}>
          <div className="hl-card-head" style={{ color: m.color }}>{m.icon}<span>{m.name}</span><em>{m.id === 'hr' ? fmtTime(r.at) : m.id === 'sleep' ? 'Today' : fmtTime(r.at)}</em><ChevronRight size={16} /></div>
          <div className="hl-card-body">
            <div><b className="hl-big">{val(m)}</b> <span className="hl-unit">{m.id === 'sleep' ? '' : m.unit}</span></div>
            <MiniSpark m={m} />
          </div>
          {m.id === 'steps' && <div className="hl-note"><Smartphone size={12} /><Watch size={12} /> Synced across iPhone & Apple Watch — no double counting</div>}
          {m.id === 'hr' && <div className="hl-note"><Headphones size={12} /> Latest from AirPods Pro 3 · during Walk</div>}
          {m.id === 'sleep' && <div className="hl-note"><Globe size={12} /> {HEALTH.sleep.bedtime} – {HEALTH.sleep.wake} · shown in the time zone you slept in ({HEALTH.sleep.tz.split('/')[1].replace('_', ' ')})</div>}
        </button>
      ))}
      <div className="hl-sec-head"><span>Highlights</span></div>
      <button className="hl-card" onClick={() => nav.push(<MetricPage m={METRICS[0]} />)}>
        <div className="hl-card-head" style={{ color: '#ff6b35' }}><Footprints size={16} /><span>Steps</span></div>
        <p className="hl-hl-text">You’re averaging more steps this week than last week.</p>
        <div className="hl-compare"><div><span>This week</span><i style={{ width: '82%', background: '#ff6b35' }} /><b>8,327</b></div><div><span>Last week</span><i style={{ width: '66%', background: 'var(--fill)' }} /><b>6,718</b></div></div>
      </button>
      <button className="hl-card" onClick={() => nav.push(<WorkoutPage w={HEALTH.workouts[1]} />)}>
        <div className="hl-card-head" style={{ color: '#30d158' }}><Dumbbell size={16} /><span>Workouts</span></div>
        <p className="hl-hl-text">Treadmill runs now use improved distance estimation. Your 2.6 mi run was calibrated automatically.</p>
      </button>
      <button className="hl-card" onClick={() => nav.push(<WorkoutPage w={HEALTH.workouts[0]} />)}>
        <div className="hl-card-head" style={{ color: '#30d158' }}><Activity size={16} /><span>Outdoor Run · {dayLabel(HEALTH.workouts[0].when)}</span></div>
        <div className="hl-map-wrap"><RouteMap seed={1} height={130} /></div>
        <div className="hl-note">Improved route accuracy near tall buildings</div>
      </button>
      {cycleEnabled && (
        <button className="hl-card" onClick={() => nav.push(<CyclePage />)}>
          <div className="hl-card-head" style={{ color: '#ff375f' }}><CircleDot size={16} /><span>Cycle Tracking</span><em>Sample data</em><ChevronRight size={16} /></div>
          <p className="hl-hl-text">Symptoms logged this week: {Object.values(useH.getState().symptoms).flat().length || 'none yet'}.</p>
        </button>
      )}
      <div className="hl-sec-head"><span>Get More from Health</span></div>
      <button className="hl-card promo" onClick={() => nav.push(<CyclePage />)}>
        <CircleDot size={28} color="#ff375f" />
        <div><b>Cycle Tracking</b><p>New in iOS 27: support for perimenopause and menopause, symptom logging and educational resources.</p></div>
      </button>
    </Page>
  )
}

function MiniSpark({ m }: { m: Metric }) {
  const bars = useMemo(() => makeSeries(m.id, 'W', HEALTH.weekSteps), [m.id])
  const max = Math.max(...bars.map((b) => (m.id === 'hr' ? b.hi ?? b.v : b.v))) || 1
  return (
    <svg width="96" height="40" viewBox="0 0 96 40" aria-hidden>
      {bars.map((b, i) => {
        const h = m.id === 'hr' ? (((b.hi ?? 0) - (b.lo ?? 0)) / max) * 36 : (b.v / max) * 36
        const yy = m.id === 'hr' ? 38 - ((b.hi ?? 0) / max) * 36 : 38 - h
        return <rect key={i} x={i * 14} y={yy} width="9" height={Math.max(3, h)} rx="3" fill={m.color} opacity={i === bars.length - 1 ? 1 : 0.35} />
      })}
    </svg>
  )
}

function EditPinned() {
  const pinned = useH((s) => s.pinned)
  return (
    <Page title="Pinned" grouped large={false}>
      <List footer="Pinned metrics appear at the top of Summary.">
        {METRICS.map((m) => (
          <Row key={m.id} title={m.name} icon={<span className="hl-ic" style={{ background: m.color }}>{m.icon}</span>} trailing={<button className="hl-pin" aria-label={pinned.includes(m.id) ? `Unpin ${m.name}` : `Pin ${m.name}`} onClick={() => useH.getState().set({ pinned: pinned.includes(m.id) ? pinned.filter((x) => x !== m.id) : [...pinned, m.id] })}><Pin size={18} fill={pinned.includes(m.id) ? 'currentColor' : 'none'} /></button>} />
        ))}
      </List>
    </Page>
  )
}

// ---------------------------------------------------------------- metric detail with D/W/M/6M/Y
function MetricPage({ m }: { m: Metric }) {
  const [range, setRange] = useState<Range>('W')
  const bars = useMemo(() => makeSeries(m.id, range, HEALTH.weekSteps), [m.id, range])
  const [src, setSrc] = useState<'All' | 'iPhone' | 'Apple Watch' | 'AirPods Pro 3'>('All')
  useOnscreen('health', `${m.name} chart`, { type: 'page', title: m.name, text: `${m.name}: ${m.value} ${m.unit}`, url: `health/${m.id}` })
  return (
    <Page title={m.name} large={false} grouped>
      <div className="hl-detail">
        <Segmented options={RANGES} value={range} onChange={setRange} />
        <BarChart
          key={range}
          bars={bars}
          color={m.color}
          unit={m.id === 'hr' ? 'BPM' : m.unit}
          rangeBars={m.id === 'hr'}
          goal={m.id === 'steps' && (range === 'W' || range === 'M') ? HEALTH.stepGoal : undefined}
          fmt={(n) => (m.id === 'sleep' ? `${Math.floor(n)}h ${Math.round((n % 1) * 60)}m` : Math.round(n).toLocaleString())}
          avgLabel={range === 'D' ? (m.id === 'hr' ? 'RANGE' : 'TOTAL') : 'DAILY AVERAGE'}
        />
      </div>
      {m.id === 'hr' && (
        <List header="Sources" footer="AirPods Pro 3 measure heart rate during workouts using in-ear sensors.">
          {(['All', 'Apple Watch', 'AirPods Pro 3', 'iPhone'] as const).map((s) => <Row key={s} title={s} icon={s === 'AirPods Pro 3' ? <Headphones size={20} color="var(--label-secondary)" /> : s === 'Apple Watch' ? <Watch size={20} color="var(--label-secondary)" /> : s === 'iPhone' ? <Smartphone size={20} color="var(--label-secondary)" /> : <Heart size={20} color="var(--label-secondary)" />} onClick={() => setSrc(s)} trailing={src === s ? <Check size={18} color="var(--accent)" /> : undefined} />)}
        </List>
      )}
      {m.id === 'steps' && (
        <List header="Devices" footer="iOS 27 merges step data from all your devices in real time so totals match everywhere.">
          <Row title="Apple Watch" detail="4,980" icon={<Watch size={20} color="var(--label-secondary)" />} />
          <Row title="iPhone" detail="2,432" icon={<Smartphone size={20} color="var(--label-secondary)" />} />
          <Row title="Total (deduplicated)" detail={HEALTH.steps.toLocaleString()} />
        </List>
      )}
      {m.id === 'sleep' && (
        <List header="Last Night" footer="When you travel, sleep is recorded in the local time zone where you slept, so bedtimes don’t shift after a flight.">
          <Row title="Bedtime" detail={HEALTH.sleep.bedtime} />
          <Row title="Wake" detail={HEALTH.sleep.wake} />
          <Row title="Time Zone" detail={HEALTH.sleep.tz} />
          <Row title="Deep / Core / REM" detail="1h 12m · 4h 20m · 2h 04m" />
        </List>
      )}
      <List header="About">
        <Row title={`About ${m.name}`} subtitle={m.id === 'hr' ? 'Your heart beats about 100,000 times a day. Heart rate varies with activity, stress and rest.' : m.id === 'steps' ? 'Step count is the number of steps you take throughout the day.' : m.id === 'sleep' ? 'Getting enough sleep supports focus, mood and recovery.' : 'Active energy is the energy you burn above resting.'} />
        <Row title="Show All Data" chevron onClick={() => useOS.getState().showToast('Showing sample data samples')} />
      </List>
    </Page>
  )
}

// ---------------------------------------------------------------- workouts
export function WorkoutPage({ w }: { w: (typeof HEALTH.workouts)[number] }) {
  const [improved, setImproved] = useState(true)
  const treadmill = 'calibrated' in w && w.calibrated
  return (
    <Page title={w.kind} large={false} grouped>
      <div className="hl-wk-head">
        <div className="hl-wk-ic"><Activity size={26} /></div>
        <div><b>{w.kind}</b><span>{dayLabel(w.when)} · {fmtTime(w.when)}</span></div>
      </div>
      <div className="hl-wk-stats">
        <div><span>Duration</span><b>{w.duration}</b></div>
        <div><span>Distance</span><b>{w.distance}</b></div>
        <div><span>Avg Heart Rate</span><b style={{ color: '#ff2d55' }}>{w.hr} BPM</b></div>
      </div>
      {'route' in w && w.route && (
        <div className="hl-card static">
          <div className="hl-card-head" style={{ color: '#30d158' }}><Activity size={16} /><span>Route</span></div>
          <div className="hl-map-wrap"><RouteMap seed={w.id.length + w.kind.length} improved={improved} showBoth={!improved} height={180} /></div>
          <div className="hl-row-set"><span>Improved route accuracy</span><Switch checked={improved} onChange={setImproved} label="Improved route accuracy" /></div>
          <div className="hl-note">{improved ? 'Route corrected using motion sensors and map matching.' : 'Dashed gray: raw GPS. Compare with the corrected route.'}</div>
        </div>
      )}
      {treadmill && (
        <div className="hl-card static">
          <div className="hl-card-head" style={{ color: '#30d158' }}><Dumbbell size={16} /><span>Treadmill Distance</span></div>
          <p className="hl-hl-text">Indoor running distance is now estimated from your stride and cadence, and refined with GymKit when you connect to the treadmill.</p>
          <div className="hl-compare"><div><span>Treadmill display</span><i style={{ width: '88%', background: 'var(--fill)' }} /><b>2.7 mi</b></div><div><span>iPhone (calibrated)</span><i style={{ width: '85%', background: '#30d158' }} /><b>2.6 mi</b></div></div>
        </div>
      )}
      <List header="Heart Rate Source">
        <Row title="AirPods Pro 3" subtitle="In-ear heart rate sensing" icon={<Headphones size={20} color="#ff2d55" />} />
        <Row title="GymKit" subtitle={treadmill ? 'Connected to Treadmill · Lincoln Fitness Center' : 'Not used'} icon={<Dumbbell size={20} color="#30d158" />} />
      </List>
    </Page>
  )
}

// ---------------------------------------------------------------- Sharing
function Sharing() {
  const [sharing, setSharing] = useState(true)
  return (
    <Page title="Sharing" bottomExtra={70} grouped>
      <List header="Sharing With" footer="People you share with see a summary of your data and notifications about changes. Demo data only.">
        <Row title="Mom" subtitle="Activity, Heart, Sleep" icon={<Avatar id="mom" size={34} />} toggle={{ value: sharing, onChange: setSharing }} />
        <Row title="Share with Someone…" tint icon={<Plus size={22} color="var(--accent)" />} onClick={() => useOS.getState().showToast('Invite sent via Messages')} />
      </List>
      <List header="Apps & Services">
        <Row title="Fitness" detail="Read & Write" />
        <Row title="Research Study (Demo)" detail="Off" />
      </List>
    </Page>
  )
}

// ---------------------------------------------------------------- Browse
const CATEGORIES: { name: string; color: string; icon: ReactNode; metrics?: Metric['id'][] }[] = [
  { name: 'Activity', color: '#ff6b35', icon: <Flame size={18} />, metrics: ['steps', 'energy'] },
  { name: 'Body Measurements', color: '#af52de', icon: <Scale size={18} /> },
  { name: 'Cycle Tracking', color: '#ff375f', icon: <CircleDot size={18} /> },
  { name: 'Hearing', color: '#30b0c7', icon: <Ear size={18} /> },
  { name: 'Heart', color: '#ff2d55', icon: <Heart size={18} />, metrics: ['hr'] },
  { name: 'Medications', color: '#5ac8fa', icon: <Pill size={18} /> },
  { name: 'Mental Wellbeing', color: '#34c759', icon: <Brain size={18} /> },
  { name: 'Mobility', color: '#ff9500', icon: <Accessibility size={18} /> },
  { name: 'Nutrition', color: '#30d158', icon: <Apple size={18} /> },
  { name: 'Respiratory', color: '#64d2ff', icon: <Wind size={18} /> },
  { name: 'Sleep', color: '#5e5ce6', icon: <Moon size={18} />, metrics: ['sleep'] },
  { name: 'Vitals', color: '#ff453a', icon: <Stethoscope size={18} />, metrics: ['hr'] },
]

function Browse({ search }: { search: boolean }) {
  const nav = useNav()
  const [q, setQ] = useState('')
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => { if (search) ref.current?.focus() }, [search])
  const s = q.trim().toLowerCase()
  const cats = CATEGORIES.filter((c) => !s || c.name.toLowerCase().includes(s))
  const mets = s ? METRICS.filter((m) => m.name.toLowerCase().includes(s)) : []
  const open = (c: (typeof CATEGORIES)[number]) => nav.push(c.name === 'Cycle Tracking' ? <CyclePage /> : <CategoryPage c={c} />)
  return (
    <Page title="Browse" bottomExtra={70} grouped>
      <div style={{ padding: '0 16px 14px' }}><SearchField ref={ref} value={q} onChange={setQ} placeholder="Search" /></div>
      {mets.length > 0 && <List header="Metrics">{mets.map((m) => <Row key={m.id} title={m.name} icon={<span className="hl-ic" style={{ background: m.color }}>{m.icon}</span>} chevron onClick={() => nav.push(<MetricPage m={m} />)} />)}</List>}
      <List header="Health Categories">
        {cats.map((c) => <Row key={c.name} title={c.name} icon={<span className="hl-ic" style={{ background: c.color }}>{c.icon}</span>} chevron onClick={() => open(c)} />)}
      </List>
    </Page>
  )
}

function CategoryPage({ c }: { c: (typeof CATEGORIES)[number] }) {
  const nav = useNav()
  const ms = (c.metrics ?? []).map((id) => METRICS.find((m) => m.id === id)!)
  return (
    <Page title={c.name} grouped>
      {ms.length ? (
        ms.map((m) => (
          <button key={m.id} className="hl-card" onClick={() => nav.push(<MetricPage m={m} />)}>
            <div className="hl-card-head" style={{ color: m.color }}>{m.icon}<span>{m.name}</span><ChevronRight size={16} /></div>
            <div className="hl-card-body"><div><b className="hl-big">{m.value}</b> <span className="hl-unit">{m.id === 'sleep' ? '' : m.unit}</span></div><MiniSpark m={m} /></div>
          </button>
        ))
      ) : (
        <List footer="No data yet. Data from connected apps and devices will appear here.">
          <Row title="Add Data" tint onClick={() => useOS.getState().showToast(`Logged a sample ${c.name} entry`)} />
        </List>
      )}
      {c.name === 'Activity' && (
        <List header="Workouts">
          {HEALTH.workouts.map((w) => <Row key={w.id} title={w.kind} subtitle={`${w.distance} · ${w.duration}`} detail={dayLabel(w.when)} chevron onClick={() => nav.push(<WorkoutPage w={w} />)} />)}
        </List>
      )}
    </Page>
  )
}

// ---------------------------------------------------------------- Cycle tracking (iOS 27, optional demo)
const SYMPTOMS = ['Hot flashes', 'Night sweats', 'Sleep changes', 'Mood changes', 'Headache', 'Fatigue', 'Brain fog', 'Joint aches', 'Cramps', 'Bloating', 'Irregular bleeding', 'Spotting']
const STAGES = [
  { id: 'none', label: 'Not specified', desc: 'Track your cycle and symptoms without a life stage.' },
  { id: 'perimenopause', label: 'Perimenopause', desc: 'The transition before menopause, when cycles can become irregular and new symptoms may appear.' },
  { id: 'menopause', label: 'Menopause', desc: 'Reached after 12 months without a period. Symptom tracking can help you notice patterns.' },
  { id: 'postmenopause', label: 'Postmenopause', desc: 'The years after menopause. Keep logging symptoms you want to discuss with a clinician.' },
] as const
const ARTICLES = [
  { t: 'Understanding Perimenopause', m: '4 min read', body: 'Perimenopause is a natural transition that can begin in your 40s (sometimes earlier). Hormone levels change gradually, so cycles may get shorter, longer, or less predictable. Common experiences include changes in sleep, mood, and body temperature. Tracking symptoms over time can help you and your healthcare provider understand what’s typical for you.' },
  { t: 'Hot Flashes & Night Sweats', m: '3 min read', body: 'Hot flashes are sudden feelings of warmth, often in the face and chest. Many people find layers, cool rooms, and noting possible triggers helpful. Log when they happen to see patterns — and talk with a clinician about options if they affect your daily life.' },
  { t: 'Sleep During Midlife', m: '5 min read', body: 'Hormonal changes can affect sleep quality. Consistent bedtimes, a cool dark room, and limiting late caffeine may help. Health can show your sleep trends alongside symptoms you log.' },
  { t: 'When to Talk to a Clinician', m: '2 min read', body: 'Reach out to a healthcare provider if bleeding is very heavy, happens after menopause, or if symptoms affect your quality of life. Health data is a helpful conversation starter — it isn’t a diagnosis.' },
]

function CyclePage() {
  const st = useH()
  const today = new Date().toDateString()
  const logged = st.symptoms[today] ?? []
  const [article, setArticle] = useState<(typeof ARTICLES)[number] | null>(null)
  const toggle = (s: string) => st.set({ symptoms: { ...st.symptoms, [today]: logged.includes(s) ? logged.filter((x) => x !== s) : [...logged, s] } })
  const days = Array.from({ length: 28 }, (_, i) => i)
  return (
    <Page title="Cycle Tracking" grouped>
      <div className="hl-sample"><Info size={14} /> Sample data for demonstration — not medical advice.</div>
      {!st.cycleEnabled && (
        <div className="hl-card static promo">
          <CircleDot size={28} color="#ff375f" />
          <div><b>Set Up Cycle Tracking</b><p>Log periods and symptoms, get predictions, and find support for every life stage.</p>
            <button className="hl-btn" onClick={() => st.set({ cycleEnabled: true })}>Get Started</button></div>
        </div>
      )}
      <div className="hl-card static">
        <div className="hl-card-head" style={{ color: '#ff375f' }}><CircleDot size={16} /><span>This Cycle · Day 17</span><em>Sample</em></div>
        <div className="hl-cycle">
          {days.map((d) => <span key={d} className={`${d < 5 ? 'period' : d >= 12 && d <= 16 ? 'fertile' : ''} ${d === 16 ? 'today' : ''}`} title={`Day ${d + 1}`} />)}
        </div>
        <div className="hl-cycle-legend"><span><i className="period" /> Period</span><span><i className="fertile" /> Fertile window estimate</span><span><i className="today" /> Today</span></div>
      </div>
      <div className="hl-sec-head"><span>Log Symptoms · Today</span></div>
      <div className="hl-chips">
        {SYMPTOMS.map((s) => <Chip key={s} active={logged.includes(s)} onClick={() => toggle(s)}>{logged.includes(s) ? '✓ ' : ''}{s}</Chip>)}
      </div>
      {logged.length > 0 && <div className="hl-logged anim-fade">Logged {logged.length} symptom{logged.length > 1 ? 's' : ''} for today. You can add notes for your next appointment.</div>}
      <List header="Life Stage" footer="New in iOS 27. Choosing a life stage tailors symptom options and resources. You can change it at any time.">
        {STAGES.map((s) => <Row key={s.id} title={s.label} subtitle={s.desc} onClick={() => st.set({ lifeStage: s.id })} trailing={st.lifeStage === s.id ? <Check size={18} color="#ff375f" /> : undefined} />)}
      </List>
      <List header="Notifications" footer="You’ll be notified if your logged cycles show a pattern you may want to discuss with a clinician, such as persistent irregular cycles. These are informational and never a diagnosis.">
        <Row title="Cycle Pattern Notifications" icon={<Bell size={20} color="#ff375f" />} toggle={{ value: st.cycleNotifs, onChange: (v) => st.set({ cycleNotifs: v }) }} />
        <Row title="Period Prediction" toggle={{ value: true, onChange: () => useOS.getState().showToast('Saved') }} />
      </List>
      <div className="hl-sec-head"><span>Educational Resources</span></div>
      <div className="hl-articles scroll-x">
        {ARTICLES.map((a, i) => (
          <button key={a.t} className="hl-article" style={{ ['--h' as string]: 330 + i * 20 }} onClick={() => setArticle(a)}>
            <BookOpen size={20} /><b>{a.t}</b><span>{a.m}</span>
          </button>
        ))}
      </div>
      <Sheet open={!!article} onClose={() => setArticle(null)} title={article?.t} detent="medium">
        <div className="hl-article-body">
          <p>{article?.body}</p>
          <p className="hl-muted">Reviewed for general education. For personal guidance, talk with your healthcare provider.</p>
        </div>
      </Sheet>
    </Page>
  )
}
