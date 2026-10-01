import { useEffect, useMemo, useRef, useState } from 'react'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { Plus, Globe, AlarmClock, Timer as TimerIcon, Hourglass, Play, Pause, X, Check, Minus, Bell, BellRing, Volume2, BedDouble, ChevronRight, ChevronLeft } from 'lucide-react'
import { Page, BarButton, TabBar } from '../../ui/nav'
import { List, Row } from '../../ui/list'
import { Switch, Slider, SearchField } from '../../ui/controls'
import { Sheet, openMenu, showAlert } from '../../ui/overlay'
import { useOS, uid } from '../../os/store'
import { useAppRoute, useOnscreen, useNow, useLongPress } from '../../os/hooks'
import { playAlert } from '../../os/audio'
import { startTimer } from '../../os/ai/siri'
import { WORLD_CLOCKS } from '../../os/data/life'
import { WEEKDAYS, fmtDuration } from '../../os/time'
import type { Alarm } from '../../os/types'
import { Wheel, WheelGroup, TimeWheels, range } from './Wheel'
import './clock.css'

type Tab = 'world' | 'alarms' | 'stopwatch' | 'timers'
interface City { city: string; tz: string }

const EXTRA_CITIES: City[] = [
  { city: 'Honolulu', tz: 'Pacific/Honolulu' }, { city: 'Anchorage', tz: 'America/Anchorage' }, { city: 'Seattle', tz: 'America/Los_Angeles' },
  { city: 'Denver', tz: 'America/Denver' }, { city: 'Chicago', tz: 'America/Chicago' }, { city: 'Mexico City', tz: 'America/Mexico_City' },
  { city: 'Toronto', tz: 'America/Toronto' }, { city: 'São Paulo', tz: 'America/Sao_Paulo' }, { city: 'Reykjavík', tz: 'Atlantic/Reykjavik' },
  { city: 'Paris', tz: 'Europe/Paris' }, { city: 'Berlin', tz: 'Europe/Berlin' }, { city: 'Cairo', tz: 'Africa/Cairo' }, { city: 'Nairobi', tz: 'Africa/Nairobi' },
  { city: 'Dubai', tz: 'Asia/Dubai' }, { city: 'Mumbai', tz: 'Asia/Kolkata' }, { city: 'Bangkok', tz: 'Asia/Bangkok' }, { city: 'Singapore', tz: 'Asia/Singapore' },
  { city: 'Hong Kong', tz: 'Asia/Hong_Kong' }, { city: 'Tokyo', tz: 'Asia/Tokyo' }, { city: 'Sydney', tz: 'Australia/Sydney' }, { city: 'Auckland', tz: 'Pacific/Auckland' },
  ...WORLD_CLOCKS,
]

const SOUNDS = ['Radial', 'Apex', 'Beacon', 'Bulletin', 'By the Seaside', 'Chimes', 'Circuit', 'Constellation', 'Cosmic', 'Crystals', 'Hillside', 'Illuminate', 'Night Owl', 'Opening', 'Playtime', 'Presto', 'Radar', 'Reflection', 'Ripples', 'Sencha', 'Signal', 'Silk', 'Slow Rise', 'Stargaze', 'Summit', 'Twinkle', 'Uplift', 'Waves']

interface ClockLocal {
  tab: Tab
  cities: City[]
  timerRecents: { s: number; label: string }[]
  timerSound: string
  lastTimer: number
  set: (p: Partial<ClockLocal>) => void
}
const useClock = create<ClockLocal>()(persist((set) => ({
  tab: 'world',
  cities: WORLD_CLOCKS,
  timerRecents: [{ s: 300, label: '5 min' }, { s: 600, label: 'Pasta' }, { s: 1500, label: 'Focus' }],
  timerSound: 'Radial',
  lastTimer: 300,
  set: (p) => set(p),
}), { name: 'ios27-clock', partialize: (s) => ({ tab: s.tab, cities: s.cities, timerRecents: s.timerRecents, timerSound: s.timerSound, lastTimer: s.lastTimer }) }))

// ---------------------------------------------------------------- helpers
const fmtCache = new Map<string, Intl.DateTimeFormat>()
function tzInfo(tz: string, now: number) {
  let f = fmtCache.get(tz)
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' })
    fmtCache.set(tz, f)
  }
  const p = Object.fromEntries(f.formatToParts(now).map((x) => [x.type, x.value])) as Record<string, string>
  const d = new Date(now)
  const wall = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second)
  const local = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds())
  const offsetH = Math.round((wall - local) / 60000) / 60
  const dayDiff = Math.round((Date.UTC(+p.year, +p.month - 1, +p.day) - Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())) / 86_400_000)
  return { h: +p.hour % 24, m: +p.minute, s: +p.second, offsetH, dayDiff }
}

function fmtHM(h: number, m: number, h24: boolean) {
  if (h24) return { t: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`, ap: '' }
  return { t: `${h % 12 || 12}:${String(m).padStart(2, '0')}`, ap: h >= 12 ? 'PM' : 'AM' }
}

export function repeatLabel(r: number[]): string {
  const s = [...r].sort()
  if (s.length === 0) return ''
  if (s.length === 7) return 'every day'
  if (s.join() === '1,2,3,4,5') return 'weekdays'
  if (s.join() === '0,6') return 'weekends'
  if (s.length === 1) return `every ${WEEKDAYS[s[0]]}`
  return s.map((d) => WEEKDAYS[d].slice(0, 3)).join(' ')
}

function nextFire(a: Pick<Alarm, 'hour' | 'minute' | 'repeat'>, now = Date.now()): number {
  for (let i = 0; i < 8; i++) {
    const d = new Date(now)
    d.setDate(d.getDate() + i)
    d.setHours(a.hour, a.minute, 0, 0)
    if (d.getTime() <= now) continue
    if (a.repeat.length === 0 || a.repeat.includes(d.getDay())) return d.getTime()
  }
  return now + 86_400_000
}
function fmtIn(ms: number) {
  const mins = Math.round(ms / 60000)
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return h ? `${h} hr ${m} min` : `${m} min`
}

function effectiveAlarmVolume(st: { alarmVolumeSeparate: boolean; alarmVolume: number; ringerVolume: number }) {
  return st.alarmVolumeSeparate ? st.alarmVolume : st.ringerVolume
}

// ---------------------------------------------------------------- app
export default function ClockApp() {
  const tab = useClock((s) => s.tab)
  const set = useClock((s) => s.set)
  const [newAlarm, setNewAlarm] = useState(0)
  useAppRoute('clock', (r) => {
    if (r.startsWith('timer')) set({ tab: 'timers' })
    else if (r.startsWith('stopwatch')) set({ tab: 'stopwatch' })
    else if (r.startsWith('world')) set({ tab: 'world' })
    else if (r.startsWith('alarm')) {
      set({ tab: 'alarms' })
      if (r === 'alarm/new') setNewAlarm((n) => n + 1)
    }
  })
  useOnscreen('clock', { world: 'World Clock', alarms: 'Alarms', stopwatch: 'Stopwatch', timers: 'Timers' }[tab])

  // re-create Live Activities for timers restored from storage
  useEffect(() => {
    const st = useOS.getState()
    for (const t of st.timers) {
      if (t.running && t.endsAt && t.endsAt > Date.now() && !st.activities.some((a) => a.id === `timer-${t.id}`)) {
        st.startActivity({ id: `timer-${t.id}`, kind: 'timer', title: t.label, endsAt: t.endsAt, startedAt: Date.now(), app: 'clock', priority: 3, data: { duration: t.duration } })
      }
    }
    const sw = st.stopwatch
    if (sw.running && !st.activities.some((a) => a.id === 'stopwatch')) st.startActivity({ id: 'stopwatch', kind: 'stopwatch', title: 'Stopwatch', startedAt: sw.startedAt - sw.elapsed, app: 'clock', priority: 3 })
  }, [])

  return (
    <div className="app-root clk-root">
      <div className={`clk-tab ${tab === 'world' ? 'on' : ''}`}><WorldClockTab /></div>
      <div className={`clk-tab ${tab === 'alarms' ? 'on' : ''}`}><AlarmsTab openNew={newAlarm} /></div>
      <div className={`clk-tab ${tab === 'stopwatch' ? 'on' : ''}`}><StopwatchTab /></div>
      <div className={`clk-tab ${tab === 'timers' ? 'on' : ''}`}><TimersTab /></div>
      <TabBar<Tab>
        value={tab}
        onChange={(t) => set({ tab: t })}
        tabs={[
          { id: 'world', label: 'World Clock', icon: <Globe size={24} strokeWidth={2} /> },
          { id: 'alarms', label: 'Alarms', icon: <AlarmClock size={24} strokeWidth={2} /> },
          { id: 'stopwatch', label: 'Stopwatch', icon: <TimerIcon size={24} strokeWidth={2} /> },
          { id: 'timers', label: 'Timers', icon: <Hourglass size={23} strokeWidth={2} /> },
        ]}
      />
    </div>
  )
}

// ---------------------------------------------------------------- analog face
function AnalogFace({ h, m, s, size = 64, showSeconds = true }: { h: number; m: number; s: number; size?: number; showSeconds?: boolean }) {
  const night = h < 6 || h >= 18
  const hr = ((h % 12) + m / 60) * 30
  const mn = (m + s / 60) * 6
  const sc = s * 6
  return (
    <svg className={`clk-face ${night ? 'night' : 'day'}`} width={size} height={size} viewBox="0 0 100 100" aria-hidden>
      <circle cx="50" cy="50" r="49" className="clk-face-bg" />
      {Array.from({ length: 60 }, (_, i) => {
        const major = i % 5 === 0
        const a = (i * 6 * Math.PI) / 180
        const r1 = major ? 40 : 43
        return <line key={i} x1={50 + Math.sin(a) * r1} y1={50 - Math.cos(a) * r1} x2={50 + Math.sin(a) * 46} y2={50 - Math.cos(a) * 46} className={major ? 'clk-tick major' : 'clk-tick'} />
      })}
      {Array.from({ length: 12 }, (_, i) => {
        const n = i + 1
        const a = (n * 30 * Math.PI) / 180
        return <text key={n} x={50 + Math.sin(a) * 32} y={50 - Math.cos(a) * 32 + 4.2} textAnchor="middle" className="clk-num">{n}</text>
      })}
      <line x1="50" y1="50" x2="50" y2="27" className="clk-hand-h" transform={`rotate(${hr} 50 50)`} />
      <line x1="50" y1="50" x2="50" y2="12" className="clk-hand-m" transform={`rotate(${mn} 50 50)`} />
      <circle cx="50" cy="50" r="3" className="clk-hub" />
      {showSeconds && (
        <g transform={`rotate(${sc} 50 50)`}>
          <line x1="50" y1="58" x2="50" y2="8" stroke="#ff9500" strokeWidth="1.3" strokeLinecap="round" />
          <circle cx="50" cy="50" r="1.8" fill="#ff9500" />
        </g>
      )}
    </svg>
  )
}

// ---------------------------------------------------------------- world clock
function WorldClockTab() {
  const now = useNow(1000)
  const cities = useClock((s) => s.cities)
  const set = useClock((s) => s.set)
  const h24 = useOS((s) => s.h24)
  const [editing, setEditing] = useState(false)
  const [adding, setAdding] = useState(false)
  const [q, setQ] = useState('')
  const results = EXTRA_CITIES.filter((c, i, arr) => arr.findIndex((x) => x.city === c.city) === i && !cities.some((x) => x.city === c.city) && c.city.toLowerCase().includes(q.toLowerCase())).sort((a, b) => a.city.localeCompare(b.city))
  return (
    <Page
      title="World Clock"
      bottomExtra={84}
      leading={cities.length ? <BarButton label={editing ? 'Done' : 'Edit'} onClick={() => setEditing(!editing)}>{editing ? 'Done' : 'Edit'}</BarButton> : undefined}
      trailing={<BarButton label="Add City" onClick={() => setAdding(true)}><Plus size={24} /></BarButton>}
    >
      {cities.length === 0 && <div className="empty-state"><Globe size={44} /><div className="t-title2">No World Clocks</div><div>Tap + to add a city.</div></div>}
      <div className="clk-cities">
        {cities.map((c) => {
          const t = tzInfo(c.tz, now)
          const f = fmtHM(t.h, t.m, h24)
          const off = t.offsetH === 0 ? '+0HRS' : `${t.offsetH > 0 ? '+' : ''}${Number.isInteger(t.offsetH) ? t.offsetH : t.offsetH.toFixed(1)}HRS`
          const dayLbl = t.dayDiff === 0 ? 'Today' : t.dayDiff > 0 ? 'Tomorrow' : 'Yesterday'
          return (
            <div key={c.city} className={`clk-city ${editing ? 'editing' : ''}`}>
              {editing && (
                <button className="clk-del" aria-label={`Delete ${c.city}`} onClick={() => set({ cities: cities.filter((x) => x.city !== c.city) })}><Minus size={16} strokeWidth={3.4} /></button>
              )}
              <AnalogFace h={t.h} m={t.m} s={t.s} size={62} />
              <div className="grow">
                <div className="clk-city-off">{dayLbl}, {off}</div>
                <div className="clk-city-name">{c.city}</div>
              </div>
              {!editing && <div className="clk-city-time">{f.t}<span>{f.ap}</span></div>}
              {editing && (
                <div className="clk-reorder">
                  <button aria-label="Move up" onClick={() => { const i = cities.indexOf(c); if (i > 0) { const n = [...cities]; n.splice(i, 1); n.splice(i - 1, 0, c); set({ cities: n }) } }}>▲</button>
                  <button aria-label="Move down" onClick={() => { const i = cities.indexOf(c); if (i < cities.length - 1) { const n = [...cities]; n.splice(i, 1); n.splice(i + 1, 0, c); set({ cities: n }) } }}>▼</button>
                </div>
              )}
            </div>
          )
        })}
      </div>
      <Sheet open={adding} onClose={() => { setAdding(false); setQ('') }} title="Choose a City" detent="large" className="clk-sheet-grouped">
        <div style={{ padding: '0 16px 10px' }}><SearchField value={q} onChange={setQ} placeholder="Search" /></div>
        <List>
          {results.map((c) => {
            const t = tzInfo(c.tz, now)
            const f = fmtHM(t.h, t.m, h24)
            return <Row key={c.city} title={c.city} detail={`${f.t} ${f.ap}`} onClick={() => { set({ cities: [...cities, c] }); setAdding(false); setQ('') }} />
          })}
          {results.length === 0 && <Row title="No Results" />}
        </List>
      </Sheet>
    </Page>
  )
}

// ---------------------------------------------------------------- alarms
function AlarmsTab({ openNew }: { openNew: number }) {
  const alarms = useOS((s) => s.alarms)
  const h24 = useOS((s) => s.h24)
  const [editing, setEditing] = useState(false)
  const [sheet, setSheet] = useState<{ alarm: Alarm | null } | null>(null)
  const volSep = useOS((s) => s.alarmVolumeSeparate)
  const alarmVol = useOS((s) => s.alarmVolume)
  const ringer = useOS((s) => s.ringerVolume)
  const vol = Math.round((volSep ? alarmVol : ringer) * 100)
  useEffect(() => { if (openNew) setSheet({ alarm: null }) }, [openNew])
  const sorted = [...alarms].sort((a, b) => a.hour * 60 + a.minute - (b.hour * 60 + b.minute))
  const toggle = (a: Alarm, v: boolean) => {
    const st = useOS.getState()
    st.set({ alarms: st.alarms.map((x) => (x.id === a.id ? { ...x, enabled: v } : x)) })
    if (v) st.showToast(`Alarm set for ${fmtIn(nextFire(a) - Date.now())} from now`, 'alarm')
  }
  const del = (a: Alarm) => useOS.getState().set({ alarms: useOS.getState().alarms.filter((x) => x.id !== a.id) })
  return (
    <Page
      title="Alarms"
      bottomExtra={84}
      leading={<BarButton label={editing ? 'Done' : 'Edit'} onClick={() => setEditing(!editing)}>{editing ? 'Done' : 'Edit'}</BarButton>}
      trailing={<BarButton label="Add Alarm" onClick={() => setSheet({ alarm: null })}><Plus size={24} /></BarButton>}
    >
      <VolumeCard />
      <div className="clk-section-h"><BedDouble size={18} /> Sleep | Wake Up</div>
      <div className="clk-sleep">
        <span className="secondary">No Alarm</span>
        <button className="btn small gray" onClick={() => setSheet({ alarm: { id: '', hour: 7, minute: 0, label: 'Wake Up', enabled: true, repeat: [1, 2, 3, 4, 5], sound: 'Slow Rise', snooze: true } })}>Set Up</button>
      </div>
      <div className="clk-section-h">Other</div>
      {sorted.length === 0 && <div className="empty-state" style={{ padding: 30 }}>No Alarms</div>}
      <div className="clk-alarms">
        {sorted.map((a) => (
          <AlarmRow key={a.id} a={a} h24={h24} editing={editing} vol={vol} onToggle={(v) => toggle(a, v)} onOpen={() => setSheet({ alarm: a })} onDelete={() => del(a)} />
        ))}
      </div>
      <AlarmEditor state={sheet} onClose={() => setSheet(null)} />
    </Page>
  )
}

function AlarmRow({ a, h24, editing, vol, onToggle, onOpen, onDelete }: { a: Alarm; h24: boolean; editing: boolean; vol: number; onToggle: (v: boolean) => void; onOpen: () => void; onDelete: () => void }) {
  const f = fmtHM(a.hour, a.minute, h24)
  const lp = useLongPress((el) => openMenu(el, [
    { label: 'Edit Alarm', onSelect: onOpen },
    { label: a.enabled ? 'Turn Off' : 'Turn On', onSelect: () => onToggle(!a.enabled) },
    { label: 'Delete', destructive: true, onSelect: onDelete },
  ]))
  return (
    <div className={`clk-alarm ${a.enabled ? '' : 'off'} ${editing ? 'editing' : ''}`} {...lp} onClick={() => (editing ? onOpen() : undefined)}>
      {editing && <button className="clk-del" aria-label="Delete alarm" onClick={(e) => { e.stopPropagation(); onDelete() }}><Minus size={16} strokeWidth={3.4} /></button>}
      <div className="grow" onClick={onOpen} role="button" tabIndex={0} aria-label={`Edit alarm ${f.t} ${f.ap}`}>
        <div className="clk-alarm-time">{f.t}<span>{f.ap}</span></div>
        <div className="clk-alarm-meta">
          {a.label || 'Alarm'}{a.repeat.length ? `, ${repeatLabel(a.repeat)}` : ''}
          <span className="clk-vol-chip"><Volume2 size={12} strokeWidth={2.6} /> Volume {vol}%</span>
        </div>
      </div>
      {editing ? <ChevronRight size={20} className="tertiary" /> : <Switch checked={a.enabled} onChange={onToggle} label={`Alarm ${f.t}`} />}
    </div>
  )
}

/** iOS 27: alarm & timer volume independent from the ringer volume. */
function VolumeCard() {
  const alarmVol = useOS((s) => s.alarmVolume)
  const ringer = useOS((s) => s.ringerVolume)
  const sep = useOS((s) => s.alarmVolumeSeparate)
  const set = useOS((s) => s.set)
  const [testing, setTesting] = useState<null | 'alarm' | 'ringer'>(null)
  const tRef = useRef<number | undefined>(undefined)
  const test = (which: 'alarm' | 'ringer') => {
    const st = useOS.getState()
    if (which === 'alarm') playAlert('alarm', effectiveAlarmVolume(st))
    else playAlert('ringtone', st.ringerVolume)
    setTesting(which)
    window.clearTimeout(tRef.current)
    tRef.current = window.setTimeout(() => setTesting(null), which === 'alarm' ? 2400 : 1800)
  }
  useEffect(() => () => window.clearTimeout(tRef.current), [])
  const effective = sep ? alarmVol : ringer
  return (
    <div className="clk-volcard">
      <div className="clk-vol-head">
        <span className="clk-vol-icon"><BellRing size={17} strokeWidth={2.4} /></span>
        <div className="grow">
          <div className="t-headline">Alarm & Timer Volume</div>
          <div className="t-footnote secondary">{sep ? 'Independent from your ringer' : `Follows ringer volume`}</div>
        </div>
        <span className="clk-vol-pct">{Math.round(effective * 100)}%</span>
      </div>
      <div className={`clk-vol-line ${sep ? '' : 'linked'}`}>
        <Slider value={effective} onChange={(v) => sep && set({ alarmVolume: v })} label="Alarm and timer volume" color="#ff9500" left={<Volume2 size={16} />} />
        <button className={`clk-test ${testing === 'alarm' ? 'playing' : ''}`} onClick={() => test('alarm')} aria-label="Test alarm volume">
          {testing === 'alarm' ? <Meter level={effective} color="#ff9500" /> : 'Test'}
        </button>
      </div>
      <div className="clk-vol-head" style={{ marginTop: 6 }}>
        <span className="clk-vol-icon ringer"><Bell size={17} strokeWidth={2.4} /></span>
        <div className="grow"><div className="t-headline">Ringer Volume</div><div className="t-footnote secondary">Calls, texts & notifications</div></div>
        <span className="clk-vol-pct">{Math.round(ringer * 100)}%</span>
      </div>
      <div className="clk-vol-line">
        <Slider value={ringer} onChange={(v) => set({ ringerVolume: v })} label="Ringer volume" color="#8e8e93" left={<Volume2 size={16} />} />
        <button className={`clk-test ${testing === 'ringer' ? 'playing' : ''}`} onClick={() => test('ringer')} aria-label="Test ringer volume">
          {testing === 'ringer' ? <Meter level={ringer} color="#8e8e93" /> : 'Test'}
        </button>
      </div>
      <div className="clk-vol-sep">
        <div className="grow"><div className="t-body">Separate from Ringer</div></div>
        <Switch checked={sep} onChange={(v) => set({ alarmVolumeSeparate: v, ...(v ? {} : {}) })} label="Separate from Ringer" />
      </div>
      <div className="clk-vol-foot">
        {sep ? `Alarms and timers ring at ${Math.round(alarmVol * 100)}% even when your ringer is at ${Math.round(ringer * 100)}%.` : `Alarms and timers use your ringer volume (${Math.round(ringer * 100)}%).`}
      </div>
    </div>
  )
}

function Meter({ level, color }: { level: number; color: string }) {
  return (
    <span className="clk-meter" aria-hidden>
      {[0, 1, 2, 3, 4].map((i) => <span key={i} style={{ background: color, animationDelay: `${i * 0.09}s`, ['--lvl' as string]: String(Math.max(0.15, level)) }} />)}
    </span>
  )
}

function AlarmEditor({ state, onClose }: { state: { alarm: Alarm | null } | null; onClose: () => void }) {
  const open = !!state
  const src = state?.alarm
  const h24 = useOS((s) => s.h24)
  const alarmVol = useOS((s) => s.alarmVolume)
  const sep = useOS((s) => s.alarmVolumeSeparate)
  const ringer = useOS((s) => s.ringerVolume)
  const [d, setD] = useState<Omit<Alarm, 'id' | 'enabled'>>({ hour: 7, minute: 0, label: 'Alarm', repeat: [], sound: 'Radial', snooze: true })
  const [sub, setSub] = useState<'main' | 'repeat' | 'sound'>('main')
  useEffect(() => {
    if (!state) return
    setSub('main')
    const now = new Date()
    setD(state.alarm ? { hour: state.alarm.hour, minute: state.alarm.minute, label: state.alarm.label, repeat: state.alarm.repeat, sound: state.alarm.sound, snooze: state.alarm.snooze } : { hour: now.getHours(), minute: now.getMinutes(), label: 'Alarm', repeat: [], sound: 'Radial', snooze: true })
  }, [state])
  const existing = !!src?.id
  const save = () => {
    const st = useOS.getState()
    if (existing) st.set({ alarms: st.alarms.map((a) => (a.id === src!.id ? { ...a, ...d, enabled: true } : a)) })
    else st.set({ alarms: [...st.alarms, { id: uid('al'), ...d, enabled: true }] })
    st.showToast(`Alarm set for ${fmtIn(nextFire(d) - Date.now())} from now`, 'alarm')
    onClose()
  }
  return (
    <Sheet
      open={open}
      onClose={onClose}
      detent="large"
      className="clk-sheet-grouped"
      title={sub === 'repeat' ? 'Repeat' : sub === 'sound' ? 'Sound' : existing ? 'Edit Alarm' : 'Add Alarm'}
      leading={sub !== 'main' ? <button className="bar-btn icon glass interactive" aria-label="Back" onClick={() => setSub('main')}><ChevronLeft size={24} /></button> : undefined}
      trailing={sub === 'main' ? <button className="bar-btn icon prominent" aria-label="Save" onClick={save} style={{ background: '#ff9500' }}><Check size={22} strokeWidth={2.8} /></button> : undefined}
    >
      {sub === 'main' && (
        <div className="clk-editor anim-fade">
          <div className="clk-editor-wheel"><TimeWheels hour={d.hour} minute={d.minute} h24={h24} onChange={(hour, minute) => setD({ ...d, hour, minute })} /></div>
          <List>
            <Row title="Repeat" detail={d.repeat.length ? repeatLabel(d.repeat).replace(/^every /, 'Every ').replace(/^weekdays$/, 'Weekdays').replace(/^weekends$/, 'Weekends') : 'Never'} chevron onClick={() => setSub('repeat')} />
            <div className="row-item">
              <span className="row-main"><span className="row-title">Label</span></span>
              <input className="text-input clk-label-input" value={d.label} placeholder="Alarm" onChange={(e) => setD({ ...d, label: e.target.value })} aria-label="Alarm label" />
            </div>
            <Row title="Sound" detail={d.sound} chevron onClick={() => setSub('sound')} />
            <Row title="Snooze" toggle={{ value: d.snooze, onChange: (v) => setD({ ...d, snooze: v }) }} />
          </List>
          <List header="Alarm Volume" footer={sep ? 'New in iOS 27: this volume is separate from your ringer, so a quiet ringer never means a quiet alarm.' : 'Turn on “Separate from Ringer” to give alarms their own volume.'}>
            <div className="row-item" style={{ gap: 10 }}>
              <Slider value={sep ? alarmVol : ringer} onChange={(v) => sep && useOS.getState().set({ alarmVolume: v })} color="#ff9500" label="Alarm volume" left={<Volume2 size={16} />} style={{ flex: 1 }} />
              <span className="clk-vol-pct">{Math.round((sep ? alarmVol : ringer) * 100)}%</span>
            </div>
            <Row title="Separate from Ringer" toggle={{ value: sep, onChange: (v) => useOS.getState().set({ alarmVolumeSeparate: v }) }} />
          </List>
          {existing && (
            <List>
              <Row title="Delete Alarm" destructive onClick={() => {
                const st = useOS.getState()
                st.set({ alarms: st.alarms.filter((a) => a.id !== src!.id) })
                onClose()
              }} />
            </List>
          )}
        </div>
      )}
      {sub === 'repeat' && (
        <div className="anim-fade">
          <List>
            {WEEKDAYS.map((w, i) => (
              <Row key={w} title={`Every ${w}`} trailing={d.repeat.includes(i) ? <Check size={20} color="#ff9500" strokeWidth={2.6} /> : undefined}
                onClick={() => setD({ ...d, repeat: d.repeat.includes(i) ? d.repeat.filter((x) => x !== i) : [...d.repeat, i].sort() })} />
            ))}
          </List>
        </div>
      )}
      {sub === 'sound' && (
        <div className="anim-fade">
          <List header="Ringtones" footer={`Previews play at your alarm volume (${Math.round((sep ? alarmVol : ringer) * 100)}%).`}>
            {SOUNDS.map((s) => (
              <Row key={s} title={s === 'Radial' ? 'Radial (Default)' : s} trailing={d.sound === s ? <Check size={20} color="#ff9500" strokeWidth={2.6} /> : undefined}
                onClick={() => { setD({ ...d, sound: s }); playAlert('timer', effectiveAlarmVolume(useOS.getState()) * 0.8) }} />
            ))}
          </List>
        </div>
      )}
    </Sheet>
  )
}

// ---------------------------------------------------------------- stopwatch
function useFrameNow(active: boolean) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    if (!active) return
    let raf = 0
    let last = 0
    const loop = (t: number) => {
      if (t - last > 30) {
        last = t
        setNow(Date.now())
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [active])
  return active ? now : Date.now()
}

function fmtSW(ms: number) {
  const cs = Math.floor(ms / 10) % 100
  const s = Math.floor(ms / 1000) % 60
  const m = Math.floor(ms / 60000)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`
}

function StopwatchTab() {
  const sw = useOS((s) => s.stopwatch)
  const tab = useClock((s) => s.tab)
  const now = useFrameNow(sw.running && tab === 'stopwatch')
  const total = sw.elapsed + (sw.running ? now - sw.startedAt : 0)
  const [page, setPage] = useState(0)
  const pager = useRef<HTMLDivElement>(null)
  const st = useOS.getState
  const start = () => {
    const t = Date.now()
    st().set({ stopwatch: { ...st().stopwatch, running: true, startedAt: t } })
    st().startActivity({ id: 'stopwatch', kind: 'stopwatch', title: 'Stopwatch', startedAt: t - st().stopwatch.elapsed, app: 'clock', priority: 3 })
  }
  const stop = () => {
    const s = st().stopwatch
    st().set({ stopwatch: { ...s, running: false, elapsed: s.elapsed + (Date.now() - s.startedAt) } })
    st().endActivity('stopwatch')
  }
  const lap = () => {
    const s = st().stopwatch
    st().set({ stopwatch: { ...s, laps: [...s.laps, s.elapsed + (Date.now() - s.startedAt)] } })
  }
  const reset = () => {
    st().set({ stopwatch: { running: false, startedAt: 0, elapsed: 0, laps: [] } })
    st().endActivity('stopwatch')
  }
  const lapTimes = sw.laps.map((t, i) => t - (i ? sw.laps[i - 1] : 0))
  const curLap = total - (sw.laps.length ? sw.laps[sw.laps.length - 1] : 0)
  const best = lapTimes.length > 1 ? Math.min(...lapTimes) : -1
  const worst = lapTimes.length > 1 ? Math.max(...lapTimes) : -1
  const started = sw.running || sw.elapsed > 0
  return (
    <Page noNav bottomExtra={84} large={false}>
      <div className="clk-sw">
        <div className="clk-sw-pager scroll" ref={pager} onScroll={(e) => setPage(Math.round(e.currentTarget.scrollLeft / e.currentTarget.offsetWidth))}>
          <div className="clk-sw-page"><div className="clk-sw-digital">{fmtSW(total)}</div></div>
          <div className="clk-sw-page"><StopwatchDial total={total} lap={sw.laps.length ? curLap : null} /></div>
        </div>
        <div className="clk-dots">
          {[0, 1].map((i) => <button key={i} className={page === i ? 'on' : ''} aria-label={i ? 'Analog' : 'Digital'} onClick={() => pager.current?.scrollTo({ left: i * pager.current.offsetWidth, behavior: 'smooth' })} />)}
        </div>
        <div className="clk-sw-buttons">
          <button className="clk-round gray" disabled={!started} onClick={sw.running ? lap : reset}>{sw.running || !started ? 'Lap' : 'Reset'}</button>
          <button className={`clk-round ${sw.running ? 'red' : 'green'}`} onClick={sw.running ? stop : start}>{sw.running ? 'Stop' : 'Start'}</button>
        </div>
        <div className="clk-laps">
          {started && (
            <div className="clk-lap"><span>Lap {sw.laps.length + 1}</span><span>{fmtSW(curLap)}</span></div>
          )}
          {lapTimes.map((t, i) => ({ t, i })).reverse().map(({ t, i }) => (
            <div key={i} className={`clk-lap ${t === best ? 'best' : t === worst ? 'worst' : ''}`}><span>Lap {i + 1}</span><span>{fmtSW(t)}</span></div>
          ))}
        </div>
      </div>
    </Page>
  )
}

function StopwatchDial({ total, lap }: { total: number; lap: number | null }) {
  const sec = (total / 1000) % 60
  const min = (total / 60000) % 30
  return (
    <svg className="clk-sw-dial" viewBox="0 0 300 300" role="img" aria-label="Analog stopwatch">
      {Array.from({ length: 240 }, (_, i) => {
        const a = (i * 1.5 * Math.PI) / 180
        const major = i % 20 === 0
        const mid = i % 4 === 0
        const r1 = major ? 128 : mid ? 132 : 136
        return <line key={i} x1={150 + Math.sin(a) * r1} y1={150 - Math.cos(a) * r1} x2={150 + Math.sin(a) * 142} y2={150 - Math.cos(a) * 142} className={major || mid ? 'clk-sw-tick major' : 'clk-sw-tick'} strokeWidth={major ? 2.2 : 1} />
      })}
      {Array.from({ length: 12 }, (_, i) => {
        const n = (i + 1) * 5
        const a = (n * 6 * Math.PI) / 180
        return <text key={n} x={150 + Math.sin(a) * 112} y={150 - Math.cos(a) * 112 + 7} textAnchor="middle" className="clk-sw-num">{n}</text>
      })}
      <g transform="translate(150 98)">
        <circle r="30" className="clk-sw-sub" />
        {Array.from({ length: 30 }, (_, i) => {
          const a = (i * 12 * Math.PI) / 180
          return <line key={i} x1={Math.sin(a) * 25} y1={-Math.cos(a) * 25} x2={Math.sin(a) * 29} y2={-Math.cos(a) * 29} className="clk-sw-tick" strokeWidth={i % 5 === 0 ? 1.6 : 0.8} />
        })}
        {[5, 10, 15, 20, 25, 30].map((n) => {
          const a = (n * 12 * Math.PI) / 180
          return <text key={n} x={Math.sin(a) * 18} y={-Math.cos(a) * 18 + 3} textAnchor="middle" className="clk-sw-subnum">{n}</text>
        })}
        <line x1="0" y1="0" x2="0" y2="-26" stroke="#ff9500" strokeWidth="2" strokeLinecap="round" transform={`rotate(${min * 12})`} />
      </g>
      <text x="150" y="212" textAnchor="middle" className="clk-sw-mini">{fmtSW(total)}</text>
      {lap !== null && (
        <line x1="150" y1="160" x2="150" y2="14" stroke="#0a84ff" strokeWidth="2" strokeLinecap="round" transform={`rotate(${((lap / 1000) % 60) * 6} 150 150)`} />
      )}
      <g transform={`rotate(${sec * 6} 150 150)`}>
        <line x1="150" y1="172" x2="150" y2="10" stroke="#ff9500" strokeWidth="2" strokeLinecap="round" />
      </g>
      <circle cx="150" cy="150" r="5" fill="#ff9500" />
      <circle cx="150" cy="150" r="2" className="clk-hub-dot" />
    </svg>
  )
}

// ---------------------------------------------------------------- timers
function toggleTimer(id: string) {
  const st = useOS.getState()
  const t = st.timers.find((x) => x.id === id)
  if (!t) return
  if (t.running) {
    const remaining = Math.max(0, ((t.endsAt ?? Date.now()) - Date.now()) / 1000)
    st.set({ timers: st.timers.map((x) => (x.id === id ? { ...x, running: false, endsAt: null, remaining } : x)) })
    st.endActivity(`timer-${id}`)
  } else {
    const endsAt = Date.now() + t.remaining * 1000
    st.set({ timers: st.timers.map((x) => (x.id === id ? { ...x, running: true, endsAt } : x)) })
    st.startActivity({ id: `timer-${id}`, kind: 'timer', title: t.label, endsAt, startedAt: Date.now(), app: 'clock', priority: 3, data: { duration: t.duration } })
  }
}
function cancelTimer(id: string) {
  const st = useOS.getState()
  st.set({ timers: st.timers.filter((x) => x.id !== id) })
  st.endActivity(`timer-${id}`)
}

function fmtPreset(s: number) {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const parts = [h && `${h} hr`, m && `${m} min`, sec && `${sec} sec`].filter(Boolean)
  return parts.join(' ') || '0 sec'
}

function TimersTab() {
  const timers = useOS((s) => s.timers)
  const loc = useClock()
  const [adding, setAdding] = useState(false)
  const [hms, setHms] = useState(() => ({ h: Math.floor(loc.lastTimer / 3600), m: Math.floor((loc.lastTimer % 3600) / 60), s: loc.lastTimer % 60 }))
  const [label, setLabel] = useState('')
  const [soundOpen, setSoundOpen] = useState(false)
  const secs = hms.h * 3600 + hms.m * 60 + hms.s
  const showPicker = timers.length === 0 || adding
  const begin = (seconds: number, lbl?: string) => {
    if (seconds <= 0) return
    const name = (lbl ?? label).trim() || fmtPreset(seconds)
    startTimer(seconds, name)
    const recents = [{ s: seconds, label: name }, ...loc.timerRecents.filter((r) => !(r.s === seconds && r.label === name))].slice(0, 8)
    loc.set({ timerRecents: recents, lastTimer: seconds })
    setAdding(false)
    setLabel('')
  }
  const presets = [60, 180, 300, 600, 900, 1800]
  return (
    <Page title="Timers" bottomExtra={84} trailing={timers.length > 0 && !adding ? <BarButton label="Add Timer" onClick={() => setAdding(true)}><Plus size={24} /></BarButton> : undefined}>
      {showPicker && (
        <div className="clk-timer-new anim-fade">
          <WheelGroup className="clk-timer-wheels">
            <Wheel label="Hours" items={range(0, 23)} value={hms.h} onChange={(h) => setHms((x) => ({ ...x, h }))} width={108} suffix="hours" />
            <Wheel label="Minutes" items={range(0, 59)} value={hms.m} onChange={(m) => setHms((x) => ({ ...x, m }))} width={108} suffix="min" loop />
            <Wheel label="Seconds" items={range(0, 59)} value={hms.s} onChange={(s) => setHms((x) => ({ ...x, s }))} width={108} suffix="sec" loop />
          </WheelGroup>
          <div className="clk-sw-buttons" style={{ marginTop: 8 }}>
            <button className="clk-round gray" onClick={() => (timers.length ? setAdding(false) : setHms({ h: 0, m: 0, s: 0 }))}>Cancel</button>
            <button className="clk-round green" disabled={secs === 0} onClick={() => begin(secs)}>Start</button>
          </div>
          <div className="clk-presets">
            {presets.map((p) => (
              <button key={p} className="clk-preset" onClick={() => begin(p, fmtPreset(p))}>
                <span className="n">{p >= 3600 ? p / 3600 : p / 60}</span><span className="u">{p >= 3600 ? 'hr' : 'min'}</span>
              </button>
            ))}
          </div>
          <List>
            <div className="row-item">
              <span className="row-main"><span className="row-title">Label</span></span>
              <input className="text-input clk-label-input" value={label} placeholder="Timer" onChange={(e) => setLabel(e.target.value)} aria-label="Timer label" />
            </div>
            <Row title="When Timer Ends" detail={loc.timerSound} chevron onClick={() => setSoundOpen(true)} />
          </List>
        </div>
      )}
      {timers.length > 0 && (
        <>
          <div className="clk-section-h">{timers.length === 1 ? 'Timer' : `${timers.length} Timers`}</div>
          <div className="clk-timers">{timers.map((t) => <TimerRow key={t.id} id={t.id} />)}</div>
        </>
      )}
      {loc.timerRecents.length > 0 && (
        <>
          <div className="clk-section-h">Recents</div>
          <div className="clk-timers">
            {loc.timerRecents.map((r, i) => (
              <div key={i} className="clk-recent">
                <div className="grow">
                  <div className="clk-recent-time">{fmtDuration(r.s)}</div>
                  <div className="t-subhead secondary">{r.label}</div>
                </div>
                <button className="clk-play" aria-label={`Start ${r.label}`} onClick={() => begin(r.s, r.label)}><Play size={20} fill="currentColor" strokeWidth={0} /></button>
                <button className="clk-x" aria-label="Remove recent" onClick={() => loc.set({ timerRecents: loc.timerRecents.filter((_, j) => j !== i) })}><X size={14} strokeWidth={3} /></button>
              </div>
            ))}
          </div>
        </>
      )}
      <Sheet open={soundOpen} onClose={() => setSoundOpen(false)} title="When Timer Ends" detent="large" className="clk-sheet-grouped">
        <List footer={`Plays at your Alarm & Timer Volume (${Math.round(effectiveAlarmVolume(useOS.getState()) * 100)}%), separate from your ringer.`}>
          {['Stop Playing', ...SOUNDS].map((s) => (
            <Row key={s} title={s} trailing={loc.timerSound === s ? <Check size={20} color="#ff9500" strokeWidth={2.6} /> : undefined}
              onClick={() => { loc.set({ timerSound: s }); if (s !== 'Stop Playing') playAlert('timer', effectiveAlarmVolume(useOS.getState())) }} />
          ))}
        </List>
      </Sheet>
    </Page>
  )
}

function TimerRow({ id }: { id: string }) {
  const t = useOS((s) => s.timers.find((x) => x.id === id))
  const now = useNow(250)
  const remaining = useMemo(() => (t ? (t.running && t.endsAt ? Math.max(0, (t.endsAt - now) / 1000) : t.remaining) : 0), [t, now])
  if (!t) return null
  const p = t.duration ? remaining / t.duration : 0
  const R = 26
  const C = 2 * Math.PI * R
  const ends = t.running && t.endsAt ? new Date(t.endsAt) : null
  return (
    <div className={`clk-timer ${t.running ? '' : 'paused'}`}>
      <div className="grow">
        <div className="clk-timer-remaining">{fmtDuration(Math.ceil(remaining))}</div>
        <div className="t-subhead secondary nowrap">{t.label}{ends ? ` · 🔔 ${ends.getHours() % 12 || 12}:${String(ends.getMinutes()).padStart(2, '0')}` : ' · Paused'}</div>
      </div>
      <button className="clk-x big" aria-label="Cancel timer" onClick={() => showAlert({ title: `Cancel “${t.label}”?`, actions: [{ label: 'Keep', style: 'cancel' }, { label: 'Cancel Timer', style: 'destructive', onPress: () => cancelTimer(id) }] })}><X size={16} strokeWidth={3} /></button>
      <button className="clk-ring" aria-label={t.running ? 'Pause timer' : 'Resume timer'} onClick={() => toggleTimer(id)}>
        <svg width="62" height="62" viewBox="0 0 62 62" aria-hidden>
          <circle cx="31" cy="31" r={R} className="clk-ring-track" />
          <circle cx="31" cy="31" r={R} stroke="#ff9500" strokeWidth="4" fill="none" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - p)} transform="rotate(-90 31 31)" style={{ transition: 'stroke-dashoffset .25s linear' }} />
        </svg>
        {t.running ? <Pause size={20} fill="#ff9500" strokeWidth={0} /> : <Play size={20} fill="#ff9500" strokeWidth={0} style={{ marginLeft: 2 }} />}
      </button>
    </div>
  )
}

