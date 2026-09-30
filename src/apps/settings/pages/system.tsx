import { useState } from 'react'
import {
  BatteryFull, BatteryCharging, Sun, Zap, Activity, Hand, MapPin, Camera, Image as ImageIcon, Mic, Users, Calendar, ShieldCheck, Siren, Wallet, Car, Package, Search, Check, X, Plug, BarChart3, Phone, } from 'lucide-react'
import { List, Row } from '../../../ui/list'
import { Slider, Button, Segmented, Spinner, Avatar } from '../../../ui/controls'
import { showAlert } from '../../../ui/overlay'
import { useNav } from '../../../ui/nav'
import { useOS } from '../../../os/store'
import { AppIconArt, ICONS } from '../../../icons/AppIconArt'
import type { AppId } from '../../../os/types'
import { contactName } from '../../../os/data/people'
import { ROUTES, HeroPage, Sub, Ico, Go, Push, ChoicePage, usePrefs, New27, os, setPrefIn } from '../common'
import { AppNotif } from './alerts'

// ------------------------------------------------------------------ Battery (iOS 27 insights)
const LEVEL_24 = [92, 90, 89, 88, 88, 87, 86, 100, 100, 97, 93, 88, 84, 80, 77, 73, 70, 67, 64, 61, 58, 56, 54, 52]
const USAGE_24 = [2, 1, 0, 0, 0, 0, 1, 6, 8, 5, 4, 6, 7, 5, 4, 6, 9, 8, 6, 7, 9, 5, 4, 2]
const DAYS_10 = [62, 71, 55, 80, 68, 74, 59, 66, 83, 64]
const BATTERY_APPS: { app: AppId; pct: number; screen: string; bg: string }[] = [
  { app: 'messages', pct: 18, screen: '1h 12m', bg: '6m' },
  { app: 'music', pct: 14, screen: '22m', bg: '1h 40m' },
  { app: 'safari', pct: 12, screen: '58m', bg: '2m' },
  { app: 'photos', pct: 9, screen: '18m', bg: '31m' },
  { app: 'games', pct: 8, screen: '31m', bg: '—' },
  { app: 'maps', pct: 6, screen: '12m', bg: '9m' },
  { app: 'camera', pct: 4, screen: '8m', bg: '—' },
]

function BatteryPage() {
  const st = useOS()
  const prefs = usePrefs()
  const [dismissed, setDismissed] = useState<string[]>([])
  const [appMode, setAppMode] = useState<'Usage' | 'Activity'>('Usage')
  const pct = Math.round(st.battery * 100)
  const range = prefs.batteryRange
  const insights = [
    { id: 'bright', icon: Sun, color: '#ff9500', title: 'Screen brightness used more battery than usual', body: 'Brightness averaged 92% today, up from 64%. Turning on Auto-Brightness could save about 40 minutes.', action: st.brightness > 0.6 ? { label: 'Lower Brightness', run: () => st.set({ brightness: 0.55 }) } : null },
    { id: 'photos', icon: ImageIcon, color: '#34c759', title: 'Photos synced 1,240 items in the background', body: 'A large iCloud Photos upload ran while on cellular. It’s finished now, so battery life should return to normal.', action: null },
    { id: 'lowpower', icon: Zap, color: '#ffcc00', title: `Low Power Mode could add up to 2 hr`, body: 'Based on how you usually use iPhone in the evening.', action: !st.lowPower ? { label: 'Turn On', run: () => st.set({ lowPower: true }) } : null },
  ].filter((i) => !dismissed.includes(i.id))
  const bars = range === '24h' ? USAGE_24 : DAYS_10
  const maxBar = Math.max(...bars)
  return (
    <HeroPage title="Battery" icon={<Ico c="#34c759" i={BatteryFull} size={60} />} blurb="View battery usage and insights, and adjust settings that help iPhone last longer.">
      <List>
        <div className="stg-batt-head">
          <div className={`stg-batt ${st.lowPower ? 'low' : ''} ${st.charging ? 'charging' : ''}`}>
            <span style={{ width: `${pct}%` }} />
            {st.charging && <BatteryCharging size={18} className="stg-batt-bolt" />}
          </div>
          <div>
            <div className="t-title2">{pct}%</div>
            <div className="t-footnote secondary">{st.charging ? `Charging · Optimized to ${prefs.chargeLimit}%` : 'Last charged to 100% · 7:42 AM'}</div>
          </div>
          <div className="grow" />
          <Button size="small" variant={st.charging ? 'filled' : 'gray'} onClick={() => st.set({ charging: !st.charging })}><Plug size={14} /> {st.charging ? 'Unplug' : 'Plug In'}</Button>
        </div>
        <Row title="Battery Percentage" toggle={{ value: prefs.batteryPct, onChange: (v) => prefs.setP({ batteryPct: v }) }} />
        <Row icon={<Ico c="#ffcc00" i={Zap} fill />} title="Low Power Mode" toggle={{ value: st.lowPower, onChange: (v) => st.set({ lowPower: v }), color: '#ffcc00' }} />
      </List>
      {insights.length > 0 && (
        <List header={<span className="row gap6">Insights <New27 /></span>}>
          {insights.map((i) => (
            <div key={i.id} className="stg-insight anim-fade">
              <span className="stg-insight-ico" style={{ background: i.color }}><i.icon size={16} color="#fff" /></span>
              <div className="grow">
                <div className="t-subhead bold">{i.title}</div>
                <div className="t-footnote secondary">{i.body}</div>
                {i.action && <button className="stg-link" onClick={() => { i.action!.run(); setDismissed((d) => [...d, i.id]) }}>{i.action.label}</button>}
              </div>
              <button className="stg-x" aria-label="Dismiss insight" onClick={() => setDismissed((d) => [...d, i.id])}><X size={14} /></button>
            </div>
          ))}
        </List>
      )}
      <List header="Battery Usage">
        <div className="stg-pad"><Segmented options={['24h', '10d'] as const} value={range} onChange={(v) => prefs.setP({ batteryRange: v })} labels={{ '24h': 'Last 24 Hours', '10d': 'Last 10 Days' }} /></div>
        {range === '24h' && (
          <div className="stg-chart">
            <div className="stg-chart-label t-caption1 secondary">Battery Level</div>
            <svg viewBox="0 0 240 60" className="stg-level" preserveAspectRatio="none" aria-label="Battery level over 24 hours">
              <path d={`M0 60 ${LEVEL_24.map((l, i) => `L${i * 10 + 5} ${60 - l * 0.56}`).join(' ')} L240 60 Z`} fill="color-mix(in srgb, var(--green) 30%, transparent)" />
              <path d={LEVEL_24.map((l, i) => `${i ? 'L' : 'M'}${i * 10 + 5} ${60 - l * 0.56}`).join(' ')} fill="none" stroke="var(--green)" strokeWidth="1.6" />
              <rect x="70" y="0" width="20" height="60" fill="color-mix(in srgb, var(--green) 14%, transparent)" />
            </svg>
          </div>
        )}
        <div className="stg-chart">
          <div className="stg-chart-label t-caption1 secondary">{range === '24h' ? 'Screen On Usage' : 'Daily Battery Usage'}</div>
          <div className="stg-bars">
            {bars.map((b, i) => (
              <div key={i} className="stg-bar-col">
                <span className="stg-bar" style={{ height: `${(b / maxBar) * 100}%`, background: range === '24h' ? 'var(--accent)' : 'var(--green)' }} />
              </div>
            ))}
          </div>
          <div className="stg-bar-axis t-caption2 secondary">
            {range === '24h' ? ['12 AM', '6', '12 PM', '6'].map((t) => <span key={t}>{t}</span>) : ['10 d', '7 d', '4 d', 'Today'].map((t) => <span key={t}>{t}</span>)}
          </div>
        </div>
        <div className="stg-batt-stats">
          <div><span className="t-title3">{range === '24h' ? '5h 41m' : '5h 12m'}</span><span className="t-footnote secondary">{range === '24h' ? 'Screen Active' : 'Avg. Screen Active'}</span></div>
          <div><span className="t-title3">{range === '24h' ? '1h 04m' : '58m'}</span><span className="t-footnote secondary">Screen Idle</span></div>
        </div>
      </List>
      <List header={<div className="row" style={{ justifyContent: 'space-between' }}><span>By App</span><button className="stg-link" onClick={() => setAppMode(appMode === 'Usage' ? 'Activity' : 'Usage')}>Show {appMode === 'Usage' ? 'Activity' : 'Usage'}</button></div>}>
        {BATTERY_APPS.map((a) => (
          <Row key={a.app} icon={<AppIconArt app={a.app} size={30} />} title={ICONS[a.app].name} subtitle={appMode === 'Activity' ? `${a.screen} on screen · ${a.bg} background` : a.bg !== '—' && a.app === 'music' ? 'Background Activity' : undefined} detail={appMode === 'Usage' ? `${a.pct}%` : undefined} />
        ))}
      </List>
      <List header="Battery Health & Charging" footer="To reduce battery aging, iPhone learns from your daily charging routine and can hold at 80% until you need it.">
        <Row title="Maximum Capacity" detail="98%" />
        <Row title="Optimized Charging" toggle={{ value: prefs.optimizedCharging, onChange: (v) => prefs.setP({ optimizedCharging: v }) }} />
        <div className="stg-pad">
          <div className="t-footnote secondary" style={{ marginBottom: 6 }}>Charge Limit</div>
          <Segmented options={['80', '85', '90', '95', '100'] as const} value={String(prefs.chargeLimit) as '80'} onChange={(v) => prefs.setP({ chargeLimit: Number(v) })} labels={{ '80': '80%', '85': '85%', '90': '90%', '95': '95%', '100': '100%' }} />
        </div>
      </List>
    </HeroPage>
  )
}

// ------------------------------------------------------------------ Privacy & Security
const PERM_CATEGORIES: { key: string; title: string; icon: typeof MapPin; color: string; apps: AppId[] }[] = [
  { key: 'location', title: 'Location Services', icon: MapPin, color: '#007aff', apps: ['maps', 'weather', 'camera', 'findmy', 'safari', 'photos', 'reminders', 'fitness'] },
  { key: 'camera', title: 'Camera', icon: Camera, color: '#8e8e93', apps: ['camera', 'facetime', 'messages', 'magnifier', 'wallet'] },
  { key: 'photos', title: 'Photos', icon: ImageIcon, color: '#ff9500', apps: ['camera', 'messages', 'mail', 'notes', 'journal', 'freeform', 'playground'] },
  { key: 'microphone', title: 'Microphone', icon: Mic, color: '#ff9500', apps: ['facetime', 'messages', 'notes', 'safari', 'games'] },
  { key: 'contacts', title: 'Contacts', icon: Users, color: '#8e8e93', apps: ['messages', 'mail', 'phone', 'findmy', 'games'] },
  { key: 'calendars', title: 'Calendars', icon: Calendar, color: '#ff3b30', apps: ['mail', 'reminders', 'siri', 'shortcuts'] },
]
const permOf = (perms: Record<string, Record<string, boolean>>, app: string, key: string) => perms[app]?.[key] ?? ['maps', 'camera', 'weather', 'findmy', 'facetime', 'messages'].includes(app)
function setPerm(app: string, key: string, v: boolean) {
  const p = os().permissions
  os().set({ permissions: { ...p, [app]: { ...(p[app] ?? {}), [key]: v } } })
}

function PermissionPage({ cat }: { cat: (typeof PERM_CATEGORIES)[number] }) {
  const perms = useOS((s) => s.permissions)
  const loc = usePrefs((s) => s.privacyLocation)
  const isLoc = cat.key === 'location'
  return (
    <Sub title={cat.title}>
      {isLoc && (
        <List footer="Location Services uses GPS, Bluetooth, and crowd-sourced Wi‑Fi hotspot and cell tower locations to determine your approximate location.">
          <Row title="Location Services" toggle={{ value: loc, onChange: (v) => usePrefs.getState().setP({ privacyLocation: v }) }} />
        </List>
      )}
      <List footer={`Apps that have requested access to your ${cat.title.toLowerCase()} will appear here.`}>
        {cat.apps.map((a) => (
          <Row key={a} icon={<AppIconArt app={a} size={30} />} title={ICONS[a].name} subtitle={isLoc ? (permOf(perms, a, cat.key) ? 'While Using' : 'Never') : undefined} toggle={{ value: permOf(perms, a, cat.key) && (!isLoc || loc), onChange: (v) => setPerm(a, cat.key, v) }} disabled={isLoc && !loc} />
        ))}
      </List>
    </Sub>
  )
}

function PrivacyPage() {
  const prefs = usePrefs()
  const perms = useOS((s) => s.permissions)
  const nav = useNav()
  return (
    <HeroPage title="Privacy & Security" icon={<Ico c="#007aff" i={Hand} fill size={60} />} blurb="Control which apps can access your data, location, camera and microphone, and review who you share with.">
      <List>
        {PERM_CATEGORIES.map((c) => (
          <Row key={c.key} icon={<Ico c={c.color} i={c.icon} fill={c.key === 'location'} />} title={c.title} detail={c.key === 'location' ? (prefs.privacyLocation ? 'On' : 'Off') : `${c.apps.filter((a) => permOf(perms, a, c.key)).length}`} chevron onClick={() => nav.push(<PermissionPage cat={c} />)} />
        ))}
      </List>
      <List footer="Protect your personal safety by staying aware of which people, apps, and devices have access to your information.">
        <Push icon={<Ico c="#007aff" i={ShieldCheck} />} title="Safety Check" page={() => <SafetyCheck />} />
      </List>
      <List>
        <Row title="Sensitive Content Warning" detail="On" chevron onClick={() => nav.push(ROUTES['screentime/safety'].el())} />
        <Row title="Analytics & Improvements" toggle={{ value: prefs.analytics, onChange: (v) => prefs.setP({ analytics: v }) }} />
        <Row title="App Privacy Report" detail="Off" />
      </List>
      <List header="Security">
        <Row title="Stolen Device Protection" toggle={{ value: prefs.faceId.stolen, onChange: (v) => setPrefIn('faceId', { stolen: v }) }} />
        <Row
          title="Lockdown Mode"
          detail={prefs.lockdown ? 'On' : 'Off'}
          chevron
          onClick={() => showAlert({ title: prefs.lockdown ? 'Turn Off Lockdown Mode?' : 'Turn On Lockdown Mode?', message: 'Lockdown Mode is an extreme, optional protection for people who might be targeted by sophisticated cyberattacks.', actions: [{ label: 'Cancel', style: 'cancel' }, { label: prefs.lockdown ? 'Turn Off' : 'Turn On & Restart', style: 'destructive', onPress: () => prefs.setP({ lockdown: !prefs.lockdown }) }] })}
        />
      </List>
    </HeroPage>
  )
}

function SafetyCheck() {
  const [step, setStep] = useState(0)
  const [people, setPeople] = useState([
    { id: 'mom', what: 'Location, Shared Calendar', on: true },
    { id: 'alex', what: 'Shared Album “Robotics 2026”, Notes', on: true },
    { id: 'nora', what: 'Freeform board', on: true },
  ])
  const [running, setRunning] = useState(false)
  return (
    <Sub title="Safety Check">
      <div className="stg-aa">
        {step === 0 && (
          <div className="anim-up">
            <div className="stg-sc-ico"><ShieldCheck size={44} /></div>
            <h2 className="stg-qs-title center">Safety Check</h2>
            <p className="secondary center">Review and update who you share information with, and which apps have access.</p>
            <Button block onClick={() => setStep(1)}>Manage Sharing & Access</Button>
            <Button
              block
              variant="destructive"
              style={{ marginTop: 10 }}
              onClick={() => showAlert({ title: 'Emergency Reset', message: 'Immediately stop sharing with everyone and reset app access. (Simulated — resets demo sharing only.)', actions: [{ label: 'Cancel', style: 'cancel' }, { label: 'Reset', style: 'destructive', onPress: () => { setPeople((p) => p.map((x) => ({ ...x, on: false }))); setStep(3) } }] })}
            >
              Emergency Reset
            </Button>
          </div>
        )}
        {step === 1 && (
          <div className="anim-up">
            <h2 className="stg-qs-title">People</h2>
            <List footer="Stop sharing with anyone you no longer want to have your information.">
              {people.map((p) => (
                <Row key={p.id} icon={<Avatar id={p.id} size={32} />} title={contactName(p.id, 'full')} subtitle={p.what} toggle={{ value: p.on, onChange: (v) => setPeople((l) => l.map((x) => (x.id === p.id ? { ...x, on: v } : x))) }} />
              ))}
            </List>
            <Button block onClick={() => setStep(2)}>Continue</Button>
          </div>
        )}
        {step === 2 && (
          <div className="anim-up">
            <h2 className="stg-qs-title">Apps & Devices</h2>
            <List>
              <Row title="Apps with Location Access" detail="5" />
              <Row title="Devices Signed In" detail="3" />
            </List>
            <Button block onClick={() => { setRunning(true); window.setTimeout(() => { setRunning(false); setStep(3) }, 900) }}>{running ? <Spinner size={16} /> : 'Update Sharing'}</Button>
          </div>
        )}
        {step === 3 && (
          <div className="anim-pop center">
            <div className="stg-qs-done"><Check size={44} strokeWidth={3} /></div>
            <h2 className="stg-qs-title">Safety Check Complete</h2>
            <p className="secondary">Sharing with {people.filter((p) => p.on).length} {people.filter((p) => p.on).length === 1 ? 'person' : 'people'}.</p>
            <Button block variant="tinted" onClick={() => setStep(0)}>Done</Button>
          </div>
        )}
      </div>
    </Sub>
  )
}

// ------------------------------------------------------------------ Emergency SOS
function EmergencyPage() {
  const sos = usePrefs((s) => s.sos)
  const set = (p: Partial<typeof sos>) => setPrefIn('sos', p)
  const [sent, setSent] = useState(false)
  const test = () => {
    setSent(true)
    os().notify({ app: 'settings', title: 'Emergency Alert (Test)', body: 'This is a TEST of the simulated emergency alert system. No action is required.', timeSensitive: true })
    window.setTimeout(() => setSent(false), 2500)
  }
  return (
    <HeroPage title="Emergency SOS" icon={<Ico c="#ff3b30" i={Siren} size={60} />} blurb="Quickly call emergency services and notify your emergency contacts. In the simulator, nothing is ever dialed.">
      <List footer="Press and hold the side and volume buttons, then release, to call emergency services.">
        <Row title="Call with Hold and Release" toggle={{ value: sos.callHold, onChange: (v) => set({ callHold: v }) }} />
        <Row title="Call with 5 Button Presses" toggle={{ value: sos.callPress, onChange: (v) => set({ callPress: v }) }} />
        <Row title="Call Quietly" toggle={{ value: !sos.countdown, onChange: (v) => set({ countdown: !v }) }} />
      </List>
      <List header="Crash Detection" footer="iPhone can detect a severe car crash and call emergency services if you don’t respond.">
        <Row title="Call After Severe Crash" toggle={{ value: sos.crash, onChange: (v) => set({ crash: v }) }} />
      </List>
      <List header="Emergency Contacts">
        {['mom', 'dad'].map((c) => <Row key={c} icon={<Avatar id={c} size={30} />} title={contactName(c, 'full')} subtitle={c === 'mom' ? 'Mother' : 'Father'} />)}
        <Row tint title="Edit Emergency Contacts in Health" onClick={() => os().launch('health')} />
      </List>
      <List header={<span className="row gap6">Emergency Alerts <New27 /></span>} footer="iOS 27 delivers government and emergency alerts with less delay and less battery impact, and groups repeat alerts so they don’t pile up.">
        <Row title="Efficient Alert Delivery" toggle={{ value: sos.efficientAlerts, onChange: (v) => set({ efficientAlerts: v }) }} />
        <Row title="Public Safety Alerts" toggle={{ value: true, onChange: () => os().showToast('Public Safety Alerts stay on in the simulator') }} />
        <Row tint title={sent ? 'Test alert sent' : 'Send Test Alert'} onClick={test} />
      </List>
    </HeroPage>
  )
}

// ------------------------------------------------------------------ Face ID & Passcode
function FaceIdPage() {
  const f = usePrefs((s) => s.faceId)
  const set = (p: Partial<typeof f>) => setPrefIn('faceId', p)
  return (
    <Sub title="Face ID & Passcode">
      <List header="Use Face ID For">
        <Row title="iPhone Unlock" toggle={{ value: f.unlock, onChange: (v) => set({ unlock: v }) }} />
        <Row title="Apple Pay" toggle={{ value: f.pay, onChange: (v) => set({ pay: v }) }} />
        <Row title="Password AutoFill" toggle={{ value: f.autofill, onChange: (v) => set({ autofill: v }) }} />
      </List>
      <List footer="TrueDepth camera will provide an additional level of security by verifying that you’re looking at iPhone before unlocking.">
        <Row title="Require Attention for Face ID" toggle={{ value: f.attention, onChange: (v) => set({ attention: v }) }} />
      </List>
      <List>
        <Row tint title="Change Passcode" onClick={() => showAlert({ title: 'Change Passcode', message: 'The simulator never asks for or stores a real passcode. Face ID unlock is always simulated.', actions: [{ label: 'OK' }] })} />
      </List>
      <List header="Stolen Device Protection" footer="Adds a security delay and requires Face ID for sensitive changes when away from familiar locations.">
        <Row title="Stolen Device Protection" toggle={{ value: f.stolen, onChange: (v) => set({ stolen: v }) }} />
      </List>
    </Sub>
  )
}

// ------------------------------------------------------------------ App settings
function CameraSettings() {
  const c = usePrefs((s) => s.camera)
  const set = (p: Partial<typeof c>) => setPrefIn('camera', p)
  return (
    <Sub title="Camera">
      <List>
        <Push title="Formats" detail={c.format} page={() => <ChoicePage title="Formats" options={['High Efficiency', 'Most Compatible'] as const} use={() => [usePrefs((s) => s.camera.format), (v) => setPrefIn('camera', { format: v })]} />} />
        <Push title="Record Video" detail={c.video.replace(' at ', ' ')} page={() => <ChoicePage title="Record Video" options={['1080p at 30 fps', '4K at 30 fps', '4K at 60 fps', '4K at 120 fps'] as const} use={() => [usePrefs((s) => s.camera.video), (v) => setPrefIn('camera', { video: v })]} />} />
        <Row title="Preserve Settings" toggle={{ value: c.preserve, onChange: (v) => set({ preserve: v }) }} />
      </List>
      <List header="Composition">
        <Row title="Grid" toggle={{ value: c.grid, onChange: (v) => set({ grid: v }) }} />
        <Row title="Level" toggle={{ value: c.level, onChange: (v) => set({ level: v }) }} />
        <Row title="Mirror Front Camera" toggle={{ value: c.mirror, onChange: (v) => set({ mirror: v }) }} />
      </List>
      <List header="Photo Capture">
        <Row title="Prioritize Faster Shooting" toggle={{ value: c.prioritizeFaster, onChange: (v) => set({ prioritizeFaster: v }) }} />
        <Row title="Lens Cleaning Hints" toggle={{ value: c.lensCleaning, onChange: (v) => set({ lensCleaning: v }) }} />
      </List>
      <List><Row tint title="Open Camera" onClick={() => os().launch('camera')} /></List>
    </Sub>
  )
}

function PhotosSettings() {
  const p = usePrefs((s) => s.photos)
  const prioritySync = useOS((s) => s.prioritySync)
  const shuffle = useOS((s) => s.shuffle)
  const set = (x: Partial<typeof p>) => setPrefIn('photos', x)
  return (
    <Sub title="Photos">
      <List>
        <Go to="account/icloud-photos" title="iCloud Photos" detail={p.icloud ? 'On' : 'Off'} />
        <Row title={<span className="row gap6">Priority Syncing <New27 /></span>} toggle={{ value: prioritySync, onChange: (v) => os().set({ prioritySync: v }) }} />
        <Row title="Shared Albums" toggle={{ value: p.sharedAlbums, onChange: (v) => set({ sharedAlbums: v }) }} />
      </List>
      <List header="Albums">
        <Row title="Show Hidden Album" toggle={{ value: p.hiddenAlbum, onChange: (v) => set({ hiddenAlbum: v }) }} />
      </List>
      <List header="Memories & Featured Photos">
        <Row title="Show Featured Content" toggle={{ value: p.showFeatured, onChange: (v) => set({ showFeatured: v }) }} />
        <Row title="Memories" toggle={{ value: p.memories, onChange: (v) => set({ memories: v }) }} />
        <Row title="Photo Shuffle Subject" detail={shuffle.kind === 'pets' ? shuffle.pet : shuffle.kind} onClick={() => os().set({ shuffle: { ...shuffle, kind: shuffle.kind === 'pets' ? 'nature' : 'pets' } })} />
      </List>
      <List><Row tint title="Open Photos" onClick={() => os().launch('photos')} /></List>
    </Sub>
  )
}

function SafariSettings() {
  const s = usePrefs((x) => x.safari)
  const exts = useOS((x) => x.safariExtensions)
  const watches = useOS((x) => x.safariWatches)
  const set = (p: Partial<typeof s>) => setPrefIn('safari', p)
  return (
    <Sub title="Safari">
      <List header="Search">
        <Push title="Search Engine" detail={s.engine} page={() => <ChoicePage title="Search Engine" options={['Google', 'DuckDuckGo', 'Bing', 'Ecosia'] as const} use={() => [usePrefs((x) => x.safari.engine) as 'Google', (v) => setPrefIn('safari', { engine: v })]} />} />
        <Row title="Search Engine Suggestions" toggle={{ value: s.suggestions, onChange: (v) => set({ suggestions: v }) }} />
      </List>
      <List header="Tabs">
        <div className="stg-pad"><Segmented options={['Compact', 'Bottom', 'Top'] as const} value={s.tabLayout} onChange={(v) => set({ tabLayout: v })} /></div>
        <Row title={<span className="row gap6">Organize Tabs by Topic <New27 /></span>} toggle={{ value: s.organizeTopics, onChange: (v) => set({ organizeTopics: v }) }} />
        <Row title={<span className="row gap6">Notify Me on Changes <New27 /></span>} detail={`${watches.length} watching`} toggle={{ value: s.notifyMe, onChange: (v) => set({ notifyMe: v }) }} />
      </List>
      <List header="Extensions" footer={exts.length ? undefined : 'Extensions you create in Safari with Apple Intelligence appear here.'}>
        {exts.map((e) => <Row key={e.id} title={e.name} subtitle={e.prompt} toggle={{ value: e.enabled, onChange: (v) => os().set({ safariExtensions: os().safariExtensions.map((x) => (x.id === e.id ? { ...x, enabled: v } : x)) }) }} />)}
      </List>
      <List header="Privacy & Security">
        <Row title="Prevent Cross-Site Tracking" toggle={{ value: s.crossSite, onChange: (v) => set({ crossSite: v }) }} />
        <Row title="Hide IP Address" detail={s.hideIp ? 'From Trackers' : 'Off'} onClick={() => set({ hideIp: !s.hideIp })} />
        <Row title="Block Pop-ups" toggle={{ value: s.blockPopups, onChange: (v) => set({ blockPopups: v }) }} />
        <Row title="Fraudulent Website Warning" toggle={{ value: s.fraud, onChange: (v) => set({ fraud: v }) }} />
      </List>
      <List>
        <Row tint title="Clear History and Website Data" onClick={() => showAlert({ title: 'Clear History and Website Data?', message: 'Clearing will remove history, cookies and other browsing data.', actions: [{ label: 'Cancel', style: 'cancel' }, { label: 'Clear History', style: 'destructive', onPress: () => { os().set({ safariHistory: [] }); os().showToast('History cleared') } }] })} />
      </List>
    </Sub>
  )
}

function MessagesSettings() {
  const m = usePrefs((s) => s.messages)
  const set = (p: Partial<typeof m>) => setPrefIn('messages', p)
  return (
    <Sub title="Messages">
      <List footer="iMessage can be sent between iPhone, iPad, iPod touch and Mac over Wi‑Fi or cellular data.">
        <Row title="iMessage" toggle={{ value: m.imessage, onChange: (v) => set({ imessage: v }) }} />
      </List>
      <List>
        <Row title="Send Read Receipts" toggle={{ value: m.readReceipts, onChange: (v) => set({ readReceipts: v }) }} />
        <Row title="Send as Text Message" toggle={{ value: m.sendAsSms, onChange: (v) => set({ sendAsSms: v }) }} />
        <Row title="Smart Replies" subtitle="Apple Intelligence suggests replies" toggle={{ value: m.smartReplies, onChange: (v) => set({ smartReplies: v }) }} />
        <Row title={<span className="row gap6">Retry Failed Deliveries <New27 /></span>} subtitle="Automatically resend when you’re back online" toggle={{ value: m.retryDelivery, onChange: (v) => set({ retryDelivery: v }) }} />
      </List>
      <List header="Message History">
        <Push title="Keep Messages" detail={m.keep} page={() => <ChoicePage title="Keep Messages" options={['30 Days', '1 Year', 'Forever'] as const} use={() => [usePrefs((s) => s.messages.keep), (v) => setPrefIn('messages', { keep: v })]} />} />
      </List>
      <List header="Message Filtering">
        <Row title="Screen Unknown Senders" toggle={{ value: m.filterUnknown, onChange: (v) => set({ filterUnknown: v }) }} />
        <Row title="Check In" toggle={{ value: m.checkIn, onChange: (v) => set({ checkIn: v }) }} />
      </List>
      <List><Row tint title="Open Messages" onClick={() => os().launch('messages')} /></List>
    </Sub>
  )
}

function WalletSettings() {
  const cards = useOS((s) => s.walletCards)
  const def = useOS((s) => s.walletDefault)
  const carKey = useOS((s) => s.carKeySetup)
  const w = usePrefs((s) => s.wallet)
  const set = (p: Partial<typeof w>) => setPrefIn('wallet', p)
  const [adding, setAdding] = useState(false)
  const payCards = cards.filter((c) => ['credit', 'debit', 'cash'].includes(c.kind))
  const transitCards = cards.filter((c) => ['transit', 'credit', 'debit'].includes(c.kind))
  return (
    <HeroPage title="Wallet & Apple Pay" icon={<Ico c="#1c1c1e" i={Wallet} size={60} />} blurb="Manage cards, transit, keys and order tracking in Wallet.">
      <List header="Payment Cards">
        {payCards.map((c) => (
          <Row key={c.id} icon={<span className="stg-card-mini" style={{ background: c.gradient }} />} title={c.name} subtitle={c.last4 ? `•••• ${c.last4}` : c.balance} onClick={() => os().set({ walletDefault: c.id })} trailing={def === c.id ? <span className="row gap4 t-footnote secondary">Default <Check size={18} className="stg-check" /></span> : undefined} />
        ))}
      </List>
      <List footer="Double-click the side button to open Wallet from the Lock Screen or anywhere.">
        <Row title="Double-Click Side Button" toggle={{ value: w.doubleClick, onChange: (v) => set({ doubleClick: v }) }} />
        <Push title="Express Transit Card" detail={cards.find((c) => c.id === w.expressTransit)?.name ?? 'None'} page={() => <ChoicePage title="Express Transit" options={['None', ...transitCards.map((c) => c.name)]} use={() => { const cur = usePrefs((s) => s.wallet.expressTransit); return [cards.find((c) => c.id === cur)?.name ?? 'None', (v) => setPrefIn('wallet', { expressTransit: cards.find((c) => c.name === v)?.id ?? '' })] }} footer="Pay for transit without Face ID or waking iPhone." />} />
      </List>
      <List header={<span className="row gap6">Car Keys <New27 /></span>} footer="Wallet suggests adding a car key when your iPhone is near a compatible car you’re allowed to drive — no dealership app needed.">
        <Row icon={<Ico c="#8e8e93" i={Car} />} title="Proactive Car Key Suggestions" toggle={{ value: w.proactiveCarKey, onChange: (v) => set({ proactiveCarKey: v }) }} />
        {carKey === 'added' ? (
          <Row title="Dad’s Car" subtitle="Car Key · Shared by Dad" detail="Remove" onClick={() => os().set({ carKeySetup: 'offered' })} />
        ) : (
          <Row tint title={adding ? <span className="row gap8"><Spinner size={14} /> Adding Car Key…</span> : 'Add Car Key — Dad’s Car (nearby)'} onClick={() => { if (adding) return; setAdding(true); window.setTimeout(() => { setAdding(false); os().set({ carKeySetup: 'added' }); os().flashIsland({ kind: 'carkey', title: 'Car Key Added', subtitle: 'Dad’s Car', duration: 2000 }) }, 1400) }} />
        )}
      </List>
      <List header="Order Tracking">
        <Row icon={<Ico c="#34c759" i={Package} />} title="Track Orders from Mail" toggle={{ value: w.orderTracking, onChange: (v) => set({ orderTracking: v }) }} />
      </List>
      <List><Row tint title="Open Wallet" onClick={() => os().launch('wallet')} /></List>
    </HeroPage>
  )
}

function MusicSettings() {
  const automix = useOS((s) => s.automix)
  const crossfade = useOS((s) => s.crossfade)
  return (
    <Sub title="Music">
      <List header="Audio">
        <Row title="AutoMix" subtitle="Blend songs like a DJ" toggle={{ value: automix, onChange: (v) => os().set({ automix: v }) }} />
        <Row title="Crossfade" detail={`${crossfade} s`} />
        <div className="stg-pad"><Slider value={crossfade} min={1} max={12} step={1} onChange={(v) => os().set({ crossfade: v })} label="Crossfade seconds" /></div>
        <Go to="airpods" title="EQ (AirPods Pro 3)" />
      </List>
      <List><Row tint title="Open Music" onClick={() => os().launch('music')} /></List>
    </Sub>
  )
}

function GenericApp({ app }: { app: AppId }) {
  const perms = useOS((s) => s.permissions)
  const nav = useNav()
  const p = perms[app] ?? {}
  const t = (k: string, def = true) => ({ value: p[k] ?? def, onChange: (v: boolean) => setPerm(app, k, v) })
  return (
    <Sub title={ICONS[app].name}>
      <div className="stg-app-head"><AppIconArt app={app} size={64} /><div className="t-title3">{ICONS[app].name}</div></div>
      <List header={`Allow ${ICONS[app].name} to Access`}>
        <Row icon={<span className="stg-ai-ico" style={{ background: '#000' }}><Search size={16} color="#fff" /></span>} title="Siri & Search" toggle={t('siri')} />
        <Row icon={<Ico c="#ff3b30" i={Phone} />} title="Notifications" detail={p.notifications === false ? 'Off' : 'Banners, Sounds, Badges'} chevron onClick={() => nav.push(<AppNotif app={app} />)} />
        <Row icon={<Ico c="#8e8e93" i={Activity} />} title="Background App Refresh" toggle={t('bgRefresh')} />
        <Row icon={<Ico c="#34c759" i={BarChart3} />} title="Cellular Data" toggle={t('cellular')} />
      </List>
      <List><Row tint title={`Open ${ICONS[app].name}`} onClick={() => os().launch(app)} /></List>
    </Sub>
  )
}

const SPECIFIC: Partial<Record<AppId, string>> = { camera: 'camera', photos: 'photos', safari: 'safari', messages: 'messages', wallet: 'wallet', music: 'music', settings: '' }
function AppsPage() {
  const nav = useNav()
  const apps = (Object.keys(ICONS) as AppId[]).filter((a) => a !== 'settings').sort((a, b) => ICONS[a].name.localeCompare(ICONS[b].name))
  return (
    <Sub title="Apps" large>
      <List>
        {apps.map((a) => (
          <Row
            key={a}
            icon={<AppIconArt app={a} size={30} />}
            title={ICONS[a].name}
            chevron
            onClick={() => {
              if (a === 'passwords') return os().launch('passwords')
              const r = SPECIFIC[a]
              if (r) nav.push(ROUTES[r].el())
              else nav.push(<GenericApp app={a} />)
            }}
          />
        ))}
      </List>
    </Sub>
  )
}

function SearchSettings() {
  const sugg = usePrefs((s) => s.searchSuggestions)
  const [recent, setRecent] = useState(true)
  return (
    <HeroPage title="Search" icon={<Ico c="#8e8e93" i={Search} size={60} />} blurb="Choose what appears when you swipe down on the Home Screen to search.">
      <List>
        <Row title="Show Suggestions" toggle={{ value: sugg, onChange: (v) => usePrefs.getState().setP({ searchSuggestions: v }) }} />
        <Row title="Show Recent Searches" toggle={{ value: recent, onChange: setRecent }} />
        <Row tint title="Open Spotlight Search" onClick={() => { os().goHome(); window.setTimeout(() => os().setOverlay('spotlight'), 300) }} />
      </List>
    </HeroPage>
  )
}

export function registerSystem() {
  Object.assign(ROUTES, {
    battery: { title: 'Battery', el: () => <BatteryPage />, keywords: 'battery health low power insights charging percentage usage charge limit' },
    privacy: { title: 'Privacy & Security', el: () => <PrivacyPage />, keywords: 'privacy security permissions location camera microphone safety check lockdown' },
    'privacy/safety-check': { title: 'Safety Check', el: () => <SafetyCheck />, keywords: 'safety check emergency reset sharing', parent: 'privacy' },
    emergency: { title: 'Emergency SOS', el: () => <EmergencyPage />, keywords: 'emergency sos alerts crash detection contacts' },
    faceid: { title: 'Face ID & Passcode', el: () => <FaceIdPage />, keywords: 'face id passcode stolen device protection attention' },
    camera: { title: 'Camera', el: () => <CameraSettings />, keywords: 'camera formats grid level mirror video', parent: 'apps' },
    photos: { title: 'Photos', el: () => <PhotosSettings />, keywords: 'photos icloud priority sync shared albums hidden memories shuffle', parent: 'apps' },
    safari: { title: 'Safari', el: () => <SafariSettings />, keywords: 'safari search engine tabs extensions notify me organize topic history', parent: 'apps' },
    messages: { title: 'Messages', el: () => <MessagesSettings />, keywords: 'messages imessage read receipts smart reply retry', parent: 'apps' },
    music: { title: 'Music', el: () => <MusicSettings />, keywords: 'music automix crossfade eq', parent: 'apps' },
    wallet: { title: 'Wallet & Apple Pay', el: () => <WalletSettings />, keywords: 'wallet apple pay cards default card express transit car key order tracking' },
    apps: { title: 'Apps', el: () => <AppsPage />, keywords: 'apps app settings permissions' },
    search: { title: 'Search', el: () => <SearchSettings />, keywords: 'search spotlight suggestions' },
  })
}

