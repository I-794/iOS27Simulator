import { useState, type ReactNode } from 'react'
import { Bell, Volume2, Volume1, Moon, User, BedDouble, BookOpen, Car, Dumbbell, BellOff, Play, AlarmClock, Vibrate, Share2, Check, Clock } from 'lucide-react'
import { List, Row } from '../../../ui/list'
import { Slider, Button, Segmented, AISparkle, Avatar } from '../../../ui/controls'
import { useNav } from '../../../ui/nav'
import { useOS } from '../../../os/store'
import { playAlert } from '../../../os/audio'
import { AppIconArt, ICONS } from '../../../icons/AppIconArt'
import type { AppId } from '../../../os/types'
import { ROUTES, HeroPage, Sub, Ico, Push, ChoicePage, usePrefs, usePref, New27, os } from '../common'
import { RINGTONES, TEXT_TONES, previewTone } from '../tones'

// ------------------------------------------------------------------ Notifications
const NOTIF_APPS: AppId[] = ['calendar', 'clock', 'facetime', 'findmy', 'fitness', 'health', 'home', 'mail', 'maps', 'messages', 'music', 'news', 'phone', 'photos', 'podcasts', 'reminders', 'safari', 'shortcuts', 'stocks', 'wallet', 'weather']

const notifOn = (perms: Record<string, Record<string, boolean>>, app: AppId) => perms[app]?.notifications !== false
function setPerm(app: string, key: string, v: boolean) {
  const p = os().permissions
  os().set({ permissions: { ...p, [app]: { ...(p[app] ?? {}), [key]: v } } })
}

function NotificationsPage() {
  const prefs = usePrefs()
  const perms = useOS((s) => s.permissions)
  const nav = useNav()
  const send = () => {
    window.setTimeout(() => os().notify({ app: 'messages', title: 'Alex Rivera', body: 'Test notification from Settings 👋 (demo)', route: 'conv/c-alex' }), 1200)
    os().showToast('Test notification in 1 second…')
  }
  return (
    <HeroPage title="Notifications" icon={<Ico c="#ff3b30" i={Bell} fill size={60} />} blurb="Choose how notifications appear on your Lock Screen and which apps can send them.">
      <List header="Display As">
        <div className="stg-notif-styles">
          {(['Count', 'Stack', 'List'] as const).map((d) => (
            <button key={d} className={`stg-notif-style ${prefs.notifDisplay === d ? 'on' : ''}`} onClick={() => prefs.setP({ notifDisplay: d })} aria-pressed={prefs.notifDisplay === d}>
              <div className={`stg-ns-phone ${d.toLowerCase()}`}>
                {d === 'Count' ? <span className="stg-ns-count">3 Notifications</span> : d === 'Stack' ? <><i /><i className="b" /><i className="c" /></> : <><i /><i /><i /></>}
              </div>
              <span>{d}</span>
              <span className={`stg-radio ${prefs.notifDisplay === d ? 'on' : ''}`}>{prefs.notifDisplay === d && <Check size={12} strokeWidth={3.4} />}</span>
            </button>
          ))}
        </div>
      </List>
      <List footer="Apple Intelligence summarizes stacks of notifications so you can scan the key details. Summaries are labeled with a sparkle.">
        <Row icon={<span className="stg-ai-ico"><AISparkle size={18} color="#fff" /></span>} title="Summarize Notifications" toggle={{ value: prefs.notifSummaries, onChange: (v) => prefs.setP({ notifSummaries: v }) }} />
        <Push title="Show Previews" detail={prefs.notifPreviews} page={() => <ChoicePage title="Show Previews" options={['Always', 'When Unlocked', 'Never'] as const} use={() => usePref('notifPreviews')} footer="Previews show the content of notifications, like message text." />} />
        <Row title="Send a Test Notification" tint onClick={send} />
      </List>
      <List header="Notification Style">
        {NOTIF_APPS.map((a) => (
          <Row key={a} icon={<AppIconArt app={a} size={30} />} title={ICONS[a].name} subtitle={notifOn(perms, a) ? (perms[a]?.timeSensitive ? 'Immediate, Banners, Sounds, Badges' : 'Banners, Sounds, Badges') : 'Off'} chevron onClick={() => nav.push(<AppNotif app={a} />)} />
        ))}
      </List>
    </HeroPage>
  )
}

export function AppNotif({ app }: { app: AppId }) {
  const perms = useOS((s) => s.permissions)
  const p = perms[app] ?? {}
  const on = p.notifications !== false
  const t = (k: string, def = true) => ({ value: p[k] ?? def, onChange: (v: boolean) => setPerm(app, k, v) })
  return (
    <Sub title={ICONS[app].name}>
      <List>
        <Row title="Allow Notifications" toggle={{ value: on, onChange: (v) => setPerm(app, 'notifications', v) }} />
      </List>
      {on && (
        <>
          <List footer="Time-sensitive notifications are always delivered immediately and remain on the Lock Screen for an hour.">
            <Row title="Time Sensitive Notifications" toggle={t('timeSensitive', false)} />
          </List>
          <List header="Alerts">
            <Row title="Lock Screen" toggle={t('lockScreen')} />
            <Row title="Notification Center" toggle={t('center')} />
            <Row title="Banners" toggle={t('banners')} />
          </List>
          <List>
            <Row title="Sounds" toggle={t('sounds')} />
            <Row title="Badges" toggle={t('badges')} />
          </List>
        </>
      )}
    </Sub>
  )
}

// ------------------------------------------------------------------ Sounds & Haptics
function VolumeBlock({ label, value, onChange, onTest, disabled, icon }: { label: ReactNode; value: number; onChange: (v: number) => void; onTest: () => void; disabled?: boolean; icon?: ReactNode }) {
  return (
    <div className={`stg-vol ${disabled ? 'disabled' : ''}`}>
      <div className="stg-vol-head">
        <span className="row gap8">{icon}{label}</span>
        <span className="secondary t-subhead">{Math.round(value * 100)}%</span>
      </div>
      <div className="row gap12">
        <div className="grow"><Slider value={value} onChange={onChange} label={typeof label === 'string' ? label : 'Volume'} left={<Volume1 size={18} />} right={<Volume2 size={18} />} /></div>
        <Button variant="tinted" size="small" onClick={onTest} disabled={disabled} label={`Test ${typeof label === 'string' ? label : ''}`}><Play size={14} fill="currentColor" /> Test</Button>
      </div>
    </div>
  )
}

function SoundsPage() {
  const st = useOS()
  const prefs = usePrefs()
  return (
    <HeroPage title="Sounds & Haptics" icon={<Ico c="#ff2d55" i={Volume2} fill size={60} />} blurb="Change the sounds and vibrations for calls, alerts and alarms — and set alarm volume independently from your ringer.">
      <List footer="Silent Mode mutes calls and alerts. Alarms and timers still sound.">
        <Row icon={<Ico c="#ff3b30" i={BellOff} />} title="Silent Mode" toggle={{ value: st.silent, onChange: (v) => { st.set({ silent: v }); st.flashIsland({ kind: 'silent', title: v ? 'Silent Mode' : 'Ring', subtitle: v ? 'On' : 'Off', duration: 1500 }) } }} />
      </List>
      <List header="Ringtone and Alerts" footer="The volume buttons adjust ringtone and alerts only when “Change with Buttons” is on.">
        <VolumeBlock label="Ringtone & Alerts" value={st.ringerVolume} onChange={(v) => st.set({ ringerVolume: v })} onTest={() => playAlert('ringtone', st.ringerVolume)} />
        <Row title="Change with Buttons" toggle={{ value: prefs.changeWithButtons, onChange: (v) => prefs.setP({ changeWithButtons: v }) }} />
      </List>
      <List header={<span className="row gap6">Alarm & Timer Volume <New27 /></span>} footer={st.alarmVolumeSeparate ? 'Alarms and timers use their own volume, so a quiet ringer won’t make you miss your alarm. Tap Test on both to hear the difference.' : 'Alarms and timers follow your Ringtone & Alerts volume.'}>
        <Row icon={<Ico c="#ff9500" i={AlarmClock} />} title="Independent Alarm Volume" toggle={{ value: st.alarmVolumeSeparate, onChange: (v) => st.set({ alarmVolumeSeparate: v }) }} />
        <VolumeBlock
          label="Alarm & Timer"
          value={st.alarmVolumeSeparate ? st.alarmVolume : st.ringerVolume}
          onChange={(v) => st.alarmVolumeSeparate && st.set({ alarmVolume: v })}
          onTest={() => playAlert('alarm', st.alarmVolumeSeparate ? st.alarmVolume : st.ringerVolume)}
          disabled={!st.alarmVolumeSeparate}
        />
      </List>
      <List header="Sounds and Haptic Patterns">
        <Push title="Ringtone" detail={prefs.ringtone} page={() => <TonePicker kind="ringtone" />} />
        <Push title="Text Tone" detail={prefs.textTone} page={() => <TonePicker kind="text" />} />
        <Row title="New Voicemail" detail="Tri-tone" />
        <Row title="Calendar Alerts" detail="Chord" />
      </List>
      <List>
        <Push icon={<Ico c="#8e8e93" i={Vibrate} />} title="Haptics" detail={prefs.haptics === 'Always Play' ? 'Always' : prefs.haptics === 'Never Play' ? 'Never' : 'Silent Only'} page={() => <ChoicePage title="Haptics" options={['Always Play', 'Play in Silent Mode', "Don't Play in Silent Mode", 'Never Play'] as const} use={() => usePref('haptics')} />} />
        <Row title="Keyboard Feedback" detail={prefs.keyboardClicks ? 'Sound' : 'None'} onClick={() => prefs.setP({ keyboardClicks: !prefs.keyboardClicks })} />
        <Row title="Lock Sound" toggle={{ value: prefs.lockSound, onChange: (v) => { prefs.setP({ lockSound: v }); if (v) playAlert('lock', st.ringerVolume) } }} />
      </List>
    </HeroPage>
  )
}

function TonePicker({ kind }: { kind: 'ringtone' | 'text' }) {
  const value = usePrefs((s) => (kind === 'ringtone' ? s.ringtone : s.textTone))
  const vol = useOS((s) => s.ringerVolume)
  const list = kind === 'ringtone' ? RINGTONES : TEXT_TONES
  const pick = (t: string) => {
    usePrefs.getState().setP(kind === 'ringtone' ? { ringtone: t } : { textTone: t })
    previewTone(t, vol)
  }
  return (
    <Sub title={kind === 'ringtone' ? 'Ringtone' : 'Text Tone'}>
      <List header={kind === 'ringtone' ? 'Ringtones' : 'Alert Tones'} footer={`Previews play at your Ringtone volume (${Math.round(vol * 100)}%).`}>
        {list.map((t) => (
          <Row key={t} title={t} onClick={() => pick(t)} trailing={t === value ? <Check size={20} strokeWidth={2.6} className="stg-check" /> : <span style={{ width: 20 }} />} />
        ))}
      </List>
    </Sub>
  )
}

// ------------------------------------------------------------------ Focus
type FocusName = NonNullable<ReturnType<typeof os>['focus']>
export const FOCUS_MODES: { name: FocusName; icon: typeof Moon; color: string; desc: string }[] = [
  { name: 'Do Not Disturb', icon: Moon, color: '#5856d6', desc: 'Silence calls and notifications.' },
  { name: 'Personal', icon: User, color: '#af52de', desc: 'Only people and apps that matter to you.' },
  { name: 'Sleep', icon: BedDouble, color: '#30b0c7', desc: 'Wind down and dim the Lock Screen.' },
  { name: 'Study', icon: BookOpen, color: '#ff9500', desc: 'Silence games and social apps while studying.' },
  { name: 'Driving', icon: Car, color: '#007aff', desc: 'Auto-reply and silence while driving.' },
  { name: 'Fitness', icon: Dumbbell, color: '#34c759', desc: 'Stay focused during workouts.' },
]

function FocusPage() {
  const focus = useOS((s) => s.focus)
  const sched = usePrefs((s) => s.focusSchedules)
  const share = usePrefs((s) => s.focusShare)
  const nav = useNav()
  return (
    <HeroPage title="Focus" icon={<Ico c="#5856d6" i={Moon} fill size={60} />} blurb="Set a Focus to silence notifications and filter apps so you can stay in the moment.">
      <List>
        {FOCUS_MODES.map((f) => (
          <Row
            key={f.name}
            icon={<Ico c={f.color} i={f.icon} fill={f.name === 'Do Not Disturb'} />}
            title={f.name}
            detail={focus === f.name ? 'On' : sched[f.name]?.on ? `${sched[f.name].from}–${sched[f.name].to}` : 'Set Up'}
            chevron
            onClick={() => nav.push(<FocusDetail name={f.name} />)}
          />
        ))}
      </List>
      <List footer="Share Across Devices keeps your Focus the same on every device signed in to your Apple Account.">
        <Row icon={<Ico c="#007aff" i={Share2} />} title="Share Across Devices" toggle={{ value: share, onChange: (v) => usePrefs.getState().setP({ focusShare: v }) }} />
      </List>
      {focus && (
        <List>
          <Row destructive title={`Turn Off ${focus}`} onClick={() => os().set({ focus: null })} />
        </List>
      )}
    </HeroPage>
  )
}

function FocusDetail({ name }: { name: FocusName }) {
  const focus = useOS((s) => s.focus)
  const filter = useOS((s) => s.focusAppFilter)
  const sched = usePrefs((s) => s.focusSchedules[name])
  const mode = FOCUS_MODES.find((f) => f.name === name)!
  const [people, setPeople] = useState<'Allow' | 'Silence'>('Allow')
  const setSched = (patch: Partial<typeof sched>) => usePrefs.getState().setP({ focusSchedules: { ...usePrefs.getState().focusSchedules, [name]: { ...sched, ...patch } } })
  const on = focus === name
  return (
    <Sub title={name}>
      <div className="stg-focus-hero" style={{ ['--fc' as string]: mode.color }}>
        <div className="stg-focus-ico"><mode.icon size={34} strokeWidth={2.2} fill={name === 'Do Not Disturb' ? '#fff' : 'none'} /></div>
        <div className="secondary t-subhead">{mode.desc}</div>
        <Button variant={on ? 'filled' : 'gray'} style={on ? { background: mode.color } : undefined} onClick={() => os().set({ focus: on ? null : name })}>{on ? `${name} On` : `Turn On ${name}`}</Button>
      </div>
      <List header="Allow Notifications">
        <div className="stg-pad"><Segmented options={['Allow', 'Silence'] as const} value={people} onChange={setPeople} labels={{ Allow: 'Allow Notifications From', Silence: 'Silence Notifications From' }} /></div>
        <Row title="People" trailing={<span className="row" style={{ gap: -6 }}>{['mom', 'dad', 'mia'].map((p) => <Avatar key={p} id={p} size={26} style={{ marginLeft: -6, border: '2px solid var(--secondary-grouped-background)' }} />)}</span>} />
        <Row title="Apps" trailing={<span className="row gap4">{(['messages', 'calendar', 'reminders'] as AppId[]).map((a) => <AppIconArt key={a} app={a} size={24} />)}</span>} />
      </List>
      <List header="Customize Screens" footer="Filter apps hides distracting app badges and Home Screen pages while this Focus is on.">
        <Row title="Focus Filters: Hide Distracting Apps" toggle={{ value: filter, onChange: (v) => os().set({ focusAppFilter: v }) }} />
      </List>
      <List header="Set a Schedule">
        <Row icon={<Ico c={mode.color} i={Clock} />} title="Scheduled" toggle={{ value: sched?.on ?? false, onChange: (v) => setSched({ on: v }) }} />
        {sched?.on && (
          <>
            <Row title="From" trailing={<input type="time" className="stg-time" value={sched.from} onChange={(e) => setSched({ from: e.target.value })} aria-label="From" />} />
            <Row title="To" trailing={<input type="time" className="stg-time" value={sched.to} onChange={(e) => setSched({ to: e.target.value })} aria-label="To" />} />
          </>
        )}
      </List>
    </Sub>
  )
}

export function registerAlerts() {
  Object.assign(ROUTES, {
    notifications: { title: 'Notifications', el: () => <NotificationsPage />, keywords: 'notifications summaries banners previews badges test' },
    sounds: { title: 'Sounds & Haptics', el: () => <SoundsPage />, keywords: 'sound ringtone volume haptics alarm timer volume silent text tone vibration' },
    focus: { title: 'Focus', el: () => <FocusPage />, keywords: 'focus do not disturb sleep study driving personal fitness schedule' },
  })
}
