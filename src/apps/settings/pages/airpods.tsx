import { useRef } from 'react'
import { Headphones, Ear, HeartPulse, MapPin, Play, Pause, Music2, Activity, Volume2, Waves, CircleOff, Sparkles, Check } from 'lucide-react'
import { List, Row } from '../../../ui/list'
import { Slider, Button, Chip } from '../../../ui/controls'
import { showAlert } from '../../../ui/overlay'
import { useNav } from '../../../ui/nav'
import { useOS } from '../../../os/store'
import { TRACKS } from '../../../os/data/media'
import { ROUTES, Sub, Ico, Push, ChoicePage, usePrefs, usePref, New27, os, setAirpods } from '../common'

type Mode = ReturnType<typeof os>['airpods']['mode']
const MODES: { id: Mode; label: string; icon: typeof Headphones }[] = [
  { id: 'off', label: 'Off', icon: CircleOff },
  { id: 'transparency', label: 'Transparency', icon: Waves },
  { id: 'adaptive', label: 'Adaptive', icon: Sparkles },
  { id: 'anc', label: 'Noise Cancellation', icon: Headphones },
]

export const EQ_PRESETS: Record<string, [number, number, number]> = {
  Flat: [0, 0, 0],
  'Bass Boost': [8, 1, -1],
  Vocal: [-3, 6, 2],
  Treble: [-2, 0, 8],
}

function Ring({ pct, label }: { pct: number; label: string }) {
  const c = 2 * Math.PI * 22
  const color = pct <= 20 ? 'var(--red)' : 'var(--green)'
  return (
    <div className="stg-ring">
      <svg viewBox="0 0 52 52" width="52" height="52">
        <circle cx="26" cy="26" r="22" fill="none" stroke="var(--fill)" strokeWidth="4" />
        <circle cx="26" cy="26" r="22" fill="none" stroke={color} strokeWidth="4" strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)} transform="rotate(-90 26 26)" strokeLinecap="round" />
      </svg>
      <span className="stg-ring-pct">{pct}%</span>
      <span className="t-caption1 secondary">{label}</span>
    </div>
  )
}

function AirPodsArt() {
  return (
    <svg viewBox="0 0 160 110" width="160" height="110" aria-hidden className="stg-ap-art">
      <defs>
        <linearGradient id="apg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffffff" /><stop offset="1" stopColor="#d9dbe0" /></linearGradient>
      </defs>
      <g transform="translate(38 10) rotate(-12)">
        <ellipse cx="18" cy="20" rx="17" ry="19" fill="url(#apg)" stroke="#c4c6cc" />
        <rect x="12" y="30" width="11" height="48" rx="5.5" fill="url(#apg)" stroke="#c4c6cc" />
        <ellipse cx="11" cy="16" rx="6" ry="7" fill="#2c2c2e" opacity=".85" />
      </g>
      <g transform="translate(88 6) rotate(12)">
        <ellipse cx="18" cy="20" rx="17" ry="19" fill="url(#apg)" stroke="#c4c6cc" />
        <rect x="13" y="30" width="11" height="48" rx="5.5" fill="url(#apg)" stroke="#c4c6cc" />
        <ellipse cx="25" cy="16" rx="6" ry="7" fill="#2c2c2e" opacity=".85" />
      </g>
    </svg>
  )
}

/** Draggable 3-band EQ curve. */
function EQCurve({ low, mid, high, onChange, enabled }: { low: number; mid: number; high: number; onChange: (band: 'low' | 'mid' | 'high', v: number) => void; enabled: boolean }) {
  const ref = useRef<SVGSVGElement>(null)
  const W = 300
  const H = 150
  const y = (db: number) => H / 2 - (db / 12) * (H / 2 - 14)
  const pts: [number, number][] = [[0, y(low)], [W * 0.2, y(low)], [W * 0.5, y(mid)], [W * 0.8, y(high)], [W, y(high)]]
  let d = `M ${pts[0][0]} ${pts[0][1]}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[Math.min(pts.length - 1, i + 2)]
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6]
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6]
    d += ` C ${c1[0]} ${c1[1]} ${c2[0]} ${c2[1]} ${p2[0]} ${p2[1]}`
  }
  const bands: { id: 'low' | 'mid' | 'high'; x: number; v: number }[] = [
    { id: 'low', x: W * 0.2, v: low },
    { id: 'mid', x: W * 0.5, v: mid },
    { id: 'high', x: W * 0.8, v: high },
  ]
  const start = (e: React.PointerEvent, band?: 'low' | 'mid' | 'high') => {
    if (!enabled) return
    e.stopPropagation()
    e.preventDefault()
    const svg = ref.current!
    const r = svg.getBoundingClientRect()
    const toDb = (cy: number) => Math.round(Math.max(-12, Math.min(12, ((H / 2 - ((cy - r.top) / r.height) * H) / (H / 2 - 14)) * 12)))
    const bx = ((e.clientX - r.left) / r.width) * W
    const b = band ?? bands.reduce((a, c) => (Math.abs(c.x - bx) < Math.abs(a.x - bx) ? c : a)).id
    onChange(b, toDb(e.clientY))
    const move = (ev: PointerEvent) => onChange(b, toDb(ev.clientY))
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }
  return (
    <svg ref={ref} viewBox={`0 0 ${W} ${H}`} className={`stg-eq ${enabled ? '' : 'off'}`} onPointerDown={(e) => start(e)} role="group" aria-label="EQ curve — drag the points">
      {[-12, -6, 0, 6, 12].map((db) => (
        <g key={db}>
          <line x1="0" x2={W} y1={y(db)} y2={y(db)} className={db === 0 ? 'zero' : 'grid'} />
          <text x="4" y={y(db) - 3} className="lbl">{db > 0 ? `+${db}` : db}</text>
        </g>
      ))}
      <path d={`${d} L ${W} ${H} L 0 ${H} Z`} className="fill" />
      <path d={d} className="curve" />
      {bands.map((b) => (
        <g key={b.id} onPointerDown={(e) => start(e, b.id)} className="handle">
          <circle cx={b.x} cy={y(b.v)} r="16" fill="transparent" />
          <circle cx={b.x} cy={y(b.v)} r="9" className="dot" />
          <text x={b.x} y={H - 6} textAnchor="middle" className="lbl">{b.id === 'low' ? 'Lows' : b.id === 'mid' ? 'Mids' : 'Highs'}</text>
        </g>
      ))}
    </svg>
  )
}

function AirPodsPage() {
  const ap = useOS((s) => s.airpods)
  const eq = useOS((s) => s.eq)
  const np = useOS((s) => s.nowPlaying)
  const prefs = usePrefs()
  const nav = useNav()
  const setEq = (patch: Partial<typeof eq>) => os().set({ eq: { ...os().eq, ...patch } })
  const setBand = (b: 'low' | 'mid' | 'high', v: number) => {
    const next = { ...os().eq, [b]: v }
    const preset = Object.entries(EQ_PRESETS).find(([, p]) => p[0] === next.low && p[1] === next.mid && p[2] === next.high)?.[0] ?? 'Custom'
    os().set({ eq: { ...next, preset } })
    if (preset === 'Custom') prefs.setP({ airpodsCustomEq: { low: next.low, mid: next.mid, high: next.high } })
  }
  const applyPreset = (name: string) => {
    const p = name === 'Custom' ? [prefs.airpodsCustomEq.low, prefs.airpodsCustomEq.mid, prefs.airpodsCustomEq.high] : EQ_PRESETS[name]
    setEq({ low: p[0], mid: p[1], high: p[2], preset: name, enabled: true })
  }
  const track = TRACKS.find((t) => t.id === np.trackId)
  if (!ap.connected) {
    return (
      <Sub title="AirPods Pro 3">
        <div className="stg-ap-head"><AirPodsArt /><div className="t-title3">{prefs.airpodsName}</div><div className="secondary">Not Connected</div></div>
        <List>
          <Row tint title="Connect" onClick={() => { setAirpods({ connected: true }); os().flashIsland({ kind: 'airpods', title: 'AirPods Pro 3', subtitle: 'Connected', duration: 2000 }) }} />
        </List>
      </Sub>
    )
  }
  return (
    <Sub title={prefs.airpodsName}>
      <div className="stg-ap-head">
        <AirPodsArt />
        <div className="row gap16">
          <Ring pct={ap.battery.l} label="Left" />
          <Ring pct={ap.battery.r} label="Right" />
          <Ring pct={ap.battery.case} label="Case" />
        </div>
      </div>
      <List header="Noise Control">
        <div className="stg-nc">
          {MODES.map((m) => (
            <button key={m.id} className={`stg-nc-opt ${ap.mode === m.id ? 'on' : ''}`} onClick={() => setAirpods({ mode: m.id })} aria-pressed={ap.mode === m.id}>
              <span className="stg-nc-ico"><m.icon size={22} /></span>
              <span>{m.label}</span>
            </button>
          ))}
        </div>
        <Row title="Conversation Awareness" subtitle="Lowers media volume and enhances voices when you start speaking" toggle={{ value: ap.conversationAwareness, onChange: (v) => setAirpods({ conversationAwareness: v }) }} />
      </List>

      <List header={<span className="row gap6">Custom EQ <New27 /></span>} footer="The EQ is applied live to everything you hear on these AirPods. Start music and drag the curve to hear the difference.">
        <Row title="Custom EQ" toggle={{ value: eq.enabled, onChange: (v) => setEq({ enabled: v }) }} />
        <div className="stg-eq-wrap">
          <EQCurve low={eq.low} mid={eq.mid} high={eq.high} onChange={setBand} enabled={eq.enabled} />
          <div className="row gap6 stg-chips" style={{ justifyContent: 'center', flexWrap: 'wrap' }}>
            {[...Object.keys(EQ_PRESETS), 'Custom'].map((p) => <Chip key={p} active={eq.preset === p} onClick={() => applyPreset(p)}>{p}</Chip>)}
          </div>
          {(['low', 'mid', 'high'] as const).map((b) => (
            <div key={b} className="stg-eq-band">
              <span className="t-subhead">{b === 'low' ? 'Lows' : b === 'mid' ? 'Mids' : 'Highs'}</span>
              <div className="grow"><Slider value={eq[b]} min={-12} max={12} step={1} onChange={(v) => setBand(b, v)} label={`${b} dB`} /></div>
              <span className="t-footnote secondary stg-eq-db">{eq[b] > 0 ? '+' : ''}{eq[b]} dB</span>
            </div>
          ))}
          <div className="stg-eq-player">
            <span className="stg-eq-art"><Music2 size={18} /></span>
            <div className="grow">
              <div className="t-subhead bold nowrap">{track?.title ?? 'Sample'}</div>
              <div className="t-caption1 secondary nowrap">{np.playing ? `Playing · EQ ${eq.enabled ? eq.preset : 'Off'}` : track?.artist}</div>
            </div>
            <Button size="small" onClick={() => (np.playing ? os().togglePlay() : os().playTrack('t1'))}>{np.playing ? <><Pause size={14} fill="currentColor" /> Pause</> : <><Play size={14} fill="currentColor" /> Play sample</>}</Button>
          </div>
        </div>
      </List>

      <List header="Health" footer="Heart rate from AirPods Pro 3 is used in Fitness workouts and works with GymKit-compatible gym equipment.">
        <Row icon={<Ico c="#ff2d55" i={HeartPulse} />} title="Heart Rate Sensing" toggle={{ value: ap.heartRate, onChange: (v) => setAirpods({ heartRate: v }) }} />
        <Row icon={<Ico c="#34c759" i={Activity} />} title="Open Fitness" chevron onClick={() => os().launch('fitness')} />
      </List>
      <List header="Hearing Health">
        <Row icon={<Ico c="#007aff" i={Ear} />} title="Hearing Aid" toggle={{ value: ap.hearingAid, onChange: (v) => setAirpods({ hearingAid: v }) }} />
        <Row icon={<Ico c="#ff9500" i={Volume2} />} title="Hearing Protection" toggle={{ value: prefs.airpodsHearingProtection, onChange: (v) => prefs.setP({ airpodsHearingProtection: v }) }} />
        <Row icon={<Ico c="#8e8e93" i={Ear} />} title="Take a Hearing Test" chevron onClick={() => showAlert({ title: 'Hearing Test', message: 'Find a quiet place and wear both AirPods. (Simulated — takes about 5 minutes on a real device.)', actions: [{ label: 'Not Now', style: 'cancel' }, { label: 'Start', onPress: () => os().showToast('Hearing test: results look typical (demo)') }] })} />
      </List>
      <List header="Controls">
        <Row title="Head Gestures" subtitle="Nod or shake your head to respond to Siri and calls" toggle={{ value: prefs.airpodsHeadGestures, onChange: (v) => prefs.setP({ airpodsHeadGestures: v }) }} />
        <Push title="Press and Hold AirPods" detail={prefs.airpodsPress} page={() => <ChoicePage title="Press and Hold" options={['Noise Control', 'Siri'] as const} use={() => usePref('airpodsPress')} />} />
        <Row title="Automatic Ear Detection" toggle={{ value: prefs.airpodsEarDetection, onChange: (v) => prefs.setP({ airpodsEarDetection: v }) }} />
      </List>
      <List header="Find My" footer="Find My network lets you locate these AirPods even when they’re not near your iPhone.">
        <Row icon={<Ico c="#34c759" i={MapPin} />} title="Find My network" toggle={{ value: prefs.airpodsFindMy, onChange: (v) => prefs.setP({ airpodsFindMy: v }) }} />
        <Row title="Show in Find My" chevron onClick={() => os().launch('findmy', { route: 'device/airpods' })} />
      </List>
      <List>
        <Row tint title="Disconnect" onClick={() => setAirpods({ connected: false })} />
        <Row destructive title="Forget This Device" onClick={() => showAlert({ title: 'Forget This Device?', message: 'In the simulator, AirPods can be reconnected from Bluetooth.', actions: [{ label: 'Cancel', style: 'cancel' }, { label: 'Forget', style: 'destructive', onPress: () => { setAirpods({ connected: false }); nav.pop() } }] })} />
      </List>
      <div className="stg-foot-note secondary t-footnote center">{ap.mode === 'anc' ? 'Noise Cancellation on' : ap.mode === 'adaptive' ? 'Adaptive Audio on' : ap.mode === 'transparency' ? 'Transparency on' : 'Noise control off'} <Check size={12} /></div>
    </Sub>
  )
}

export function registerAirPods() {
  Object.assign(ROUTES, {
    airpods: { title: 'AirPods Pro 3', el: () => <AirPodsPage />, keywords: 'airpods eq equalizer custom eq heart rate noise cancellation adaptive transparency conversation awareness hearing' },
  })
}
