import { useState } from 'react'
import { Hourglass, Moon, Timer, CheckCircle2, MessageCircle, ShieldCheck, Users, Globe, CalendarClock, Smartphone, Plus, Minus, Check, X, Ban, Eye, EyeOff, Home, Ruler, Lock, ChevronRight, Sparkles, Gamepad2, Music2, Palette, GraduationCap } from 'lucide-react'
import { List, Row } from '../../../ui/list'
import { Button, Segmented, Avatar, Switch } from '../../../ui/controls'
import { Sheet, showAlert } from '../../../ui/overlay'
import { useNav } from '../../../ui/nav'
import { useOS, uid } from '../../../os/store'
import { SCREEN_TIME_USAGE } from '../../../os/data/world'
import { AppIconArt, ICONS } from '../../../icons/AppIconArt'
import type { AppId, ScreenTimeConfig } from '../../../os/types'
import { WEEKDAYS_SHORT } from '../../../os/time'
import { ROUTES, HeroPage, Sub, Ico, Go, Push, ChoicePage, usePrefs, usePref, New27, os, setST, fmtMin } from '../common'

const CAT_COLORS: Record<string, string> = { Social: '#0a84ff', Education: '#34c759', Entertainment: '#ff9f0a', Games: '#bf5af2', Creativity: '#ff375f', Travel: '#64d2ff' }
const CAT_ICONS: Record<ScreenTimeConfig['allowances'][number]['category'], typeof Timer> = { Entertainment: Music2, Games: Gamepad2, Social: MessageCircle, Creativity: Palette, Education: GraduationCap }

function WeekChart({ data, avg, highlight = data.length - 1 }: { data: number[]; avg: number; highlight?: number }) {
  const max = Math.max(...data) * 1.1
  const today = new Date().getDay()
  return (
    <div className="stg-week">
      <div className="stg-week-bars">
        <div className="stg-week-avg" style={{ bottom: `${(avg / max) * 100}%` }}><span>avg</span></div>
        {data.map((m, i) => {
          const segs = [0.3, 0.22, 0.18, 0.16, 0.14]
          const cats = ['Social', 'Education', 'Entertainment', 'Games', 'Creativity']
          return (
            <div key={i} className={`stg-week-col ${i === highlight ? 'today' : ''}`}>
              <div className="stg-week-stack" style={{ height: `${(m / max) * 100}%` }}>
                {segs.map((s, j) => <span key={j} style={{ flex: s, background: CAT_COLORS[cats[j]] }} />)}
              </div>
              <span className="t-caption2 secondary">{WEEKDAYS_SHORT[(today - (data.length - 1 - i) + 7) % 7][0]}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ScreenTimePage() {
  const stc = useOS((s) => s.screenTime)
  const prefs = usePrefs()
  const nav = useNav()
  const U = SCREEN_TIME_USAGE
  const cats = Object.entries(U.apps.reduce<Record<string, number>>((a, x) => ({ ...a, [x.category]: (a[x.category] ?? 0) + x.minutes }), {})).sort((a, b) => b[1] - a[1])
  return (
    <HeroPage title="Screen Time" icon={<Ico c="#5856d6" i={Hourglass} size={60} />} blurb="Understand how you use iPhone, set limits for yourself, and manage your family’s devices.">
      <List>
        <button className="stg-st-dash" onClick={() => nav.push(<ActivityPage />)}>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div className="t-footnote secondary">Daily Average</div>
              <div className="t-title1">{fmtMin(U.dailyAverage)}</div>
              <div className="t-footnote secondary">↓ 12% from last week</div>
            </div>
            <ChevronRight size={18} className="secondary" />
          </div>
          <WeekChart data={U.week} avg={U.dailyAverage} />
          <div className="stg-cat-legend">{cats.slice(0, 3).map(([c, m]) => <span key={c}><i style={{ background: CAT_COLORS[c] }} />{c} <b>{fmtMin(m)}</b></span>)}</div>
        </button>
        <Push title="See All App & Website Activity" page={() => <ActivityPage />} tint />
      </List>
      <List header="Limit Usage">
        <Go icon={<Ico c="#5856d6" i={Moon} fill />} to="screentime/downtime" title="Downtime" detail={stc.downtime ? 'On' : 'Off'} />
        <Go icon={<Ico c="#ff9500" i={Hourglass} />} to="screentime/limits" title="App Limits" detail={Object.keys(prefs.appLimits).length} />
        <Go icon={<Ico c="#34c759" i={CheckCircle2} />} to="screentime/always" title="Always Allowed" detail={prefs.alwaysAllowed.length} />
        <Row icon={<Ico c="#007aff" i={Ruler} />} title="Screen Distance" toggle={{ value: prefs.screenDistance, onChange: (v) => prefs.setP({ screenDistance: v }) }} />
      </List>
      <List header="Communication">
        <Push icon={<Ico c="#34c759" i={MessageCircle} fill />} title="Communication Limits" detail={prefs.commLimits} page={() => <ChoicePage title="Communication Limits" options={['Everyone', 'Contacts Only', 'Contacts & Groups'] as const} use={() => usePref('commLimits')} footer="Controls who you can communicate with during allowed screen time." />} />
        <Go icon={<Ico c="#007aff" i={ShieldCheck} />} to="screentime/safety" title="Communication Safety" detail={stc.communicationSafety ? 'On' : 'Off'} />
      </List>
      <List header="Family">
        <Row icon={<Avatar id="mia" size={32} />} title="Mia" subtitle={stc.childMode ? 'Child Account · Simulating Mia’s iPhone' : 'Child Account · Age 10'} chevron onClick={() => nav.push(ROUTES['screentime/family'].el())} />
      </List>
      <List>
        <Row icon={<Ico c="#ff3b30" i={Lock} />} title="Content & Privacy Restrictions" chevron onClick={() => nav.push(<Restrictions />)} />
      </List>
    </HeroPage>
  )
}

function ActivityPage() {
  const U = SCREEN_TIME_USAGE
  const [range, setRange] = useState<'Week' | 'Day'>('Week')
  const today = U.week[U.week.length - 1]
  const scale = range === 'Day' ? today / U.dailyAverage : 1
  const maxApp = Math.max(...U.apps.map((a) => a.minutes))
  const cats = Object.entries(U.apps.reduce<Record<string, number>>((a, x) => ({ ...a, [x.category]: (a[x.category] ?? 0) + x.minutes }), {})).sort((a, b) => b[1] - a[1])
  return (
    <Sub title="All Activity">
      <div className="stg-pad"><Segmented options={['Week', 'Day'] as const} value={range} onChange={setRange} /></div>
      <List>
        <div className="stg-st-dash static">
          <div className="t-footnote secondary">{range === 'Week' ? 'Daily Average' : 'Today'}</div>
          <div className="t-title1">{fmtMin(range === 'Week' ? U.dailyAverage : today)}</div>
          <WeekChart data={range === 'Week' ? U.week : [18, 4, 0, 0, 0, 0, 0, 6, 22, 30, 12, 8, 26, 14, 9, 19, 24, 11, 10, 17, 12, 7, 4, 0].map((x) => x * 1)} avg={range === 'Week' ? U.dailyAverage : 12} highlight={range === 'Week' ? U.week.length - 1 : new Date().getHours()} />
        </div>
      </List>
      <List header="Categories">
        {cats.map(([c, m]) => <Row key={c} icon={<span className="stg-dot" style={{ background: CAT_COLORS[c] ?? '#8e8e93' }} />} title={c} detail={fmtMin(Math.round(m * scale))} />)}
      </List>
      <List header="Most Used">
        {U.apps.map((a) => (
          <Row
            key={a.app}
            icon={<AppIconArt app={a.app as AppId} size={30} />}
            title={ICONS[a.app as AppId].name}
            subtitle={<span className="stg-usage-bar"><span style={{ width: `${(a.minutes / maxApp) * 100}%`, background: CAT_COLORS[a.category] }} /></span>}
            detail={fmtMin(Math.round(a.minutes * scale))}
          />
        ))}
      </List>
      <List header="Pickups & Notifications">
        <Row title="Pickups" detail={`${Math.round(U.pickups * (range === 'Day' ? 1 : 1))} ${range === 'Week' ? 'avg/day' : 'today'}`} />
        <Row title="First Pickup" detail="6:41 AM" />
        <Row title="Notifications" detail={`${U.notifications} ${range === 'Week' ? 'avg/day' : 'today'}`} />
      </List>
    </Sub>
  )
}

function DowntimePage() {
  const on = useOS((s) => s.screenTime.downtime)
  const prefs = usePrefs()
  return (
    <Sub title="Downtime">
      <List footer="During downtime, only apps you choose to allow and phone calls will be available.">
        <Row title={on ? 'Turn Off Downtime' : 'Turn On Downtime Until Tomorrow'} tint onClick={() => setST({ downtime: !on })} />
      </List>
      <List header="Schedule">
        <Row title="Scheduled" toggle={{ value: on, onChange: (v) => setST({ downtime: v }) }} />
        <Row title="From" trailing={<input type="time" className="stg-time" value={prefs.downtimeFrom} onChange={(e) => prefs.setP({ downtimeFrom: e.target.value })} aria-label="Downtime from" />} />
        <Row title="To" trailing={<input type="time" className="stg-time" value={prefs.downtimeTo} onChange={(e) => prefs.setP({ downtimeTo: e.target.value })} aria-label="Downtime to" />} />
      </List>
      <List>
        <Go to="screentime/always" title="Always Allowed Apps" />
      </List>
    </Sub>
  )
}

function LimitsPage() {
  const limits = usePrefs((s) => s.appLimits)
  const set = (c: string, m: number | null) => {
    const next = { ...limits }
    if (m === null) delete next[c]
    else next[c] = Math.max(15, Math.min(480, m))
    usePrefs.getState().setP({ appLimits: next })
  }
  const all = ['Social', 'Games', 'Entertainment', 'Creativity', 'Education', 'Productivity & Finance']
  return (
    <Sub title="App Limits">
      <List footer="Set daily time limits for app categories. Limits reset every day at midnight.">
        {all.map((c) => (
          <Row
            key={c}
            icon={<span className="stg-dot" style={{ background: CAT_COLORS[c] ?? '#8e8e93' }} />}
            title={c}
            subtitle={limits[c] ? `${fmtMin(limits[c])} a day` : 'No limit'}
            trailing={
              limits[c] ? (
                <span className="stg-stepper">
                  <button aria-label={`Less ${c}`} onClick={() => set(c, limits[c] - 15)}><Minus size={14} /></button>
                  <button aria-label={`More ${c}`} onClick={() => set(c, limits[c] + 15)}><Plus size={14} /></button>
                  <button aria-label={`Remove ${c} limit`} onClick={() => set(c, null)}><X size={14} /></button>
                </span>
              ) : (
                <button className="stg-link" onClick={() => set(c, 60)}>Add Limit</button>
              )
            }
          />
        ))}
      </List>
    </Sub>
  )
}

function AlwaysAllowedPage() {
  const allowed = usePrefs((s) => s.alwaysAllowed)
  const all = (Object.keys(ICONS) as AppId[]).filter((a) => a !== 'settings').sort((a, b) => ICONS[a].name.localeCompare(ICONS[b].name))
  const toggle = (a: string) => usePrefs.getState().setP({ alwaysAllowed: allowed.includes(a) ? allowed.filter((x) => x !== a) : [...allowed, a] })
  return (
    <Sub title="Always Allowed">
      <List header="Allowed Apps" footer="These apps are available during downtime and ignore App Limits.">
        {allowed.map((a) => <Row key={a} icon={<button className="stg-cc-btn remove" aria-label={`Remove ${ICONS[a as AppId]?.name}`} onClick={() => toggle(a)}><Minus size={14} strokeWidth={3.4} /></button>} title={<span className="row gap8"><AppIconArt app={a as AppId} size={28} />{ICONS[a as AppId]?.name}</span>} />)}
      </List>
      <List header="Choose Apps">
        {all.filter((a) => !allowed.includes(a)).map((a) => <Row key={a} icon={<button className="stg-cc-btn add" aria-label={`Allow ${ICONS[a].name}`} onClick={() => toggle(a)}><Plus size={14} strokeWidth={3.4} /></button>} title={<span className="row gap8"><AppIconArt app={a} size={28} />{ICONS[a].name}</span>} onClick={() => toggle(a)} />)}
      </List>
    </Sub>
  )
}

function Restrictions() {
  const [on, setOn] = useState(false)
  const [explicit, setExplicit] = useState(false)
  const [purchases, setPurchases] = useState(true)
  return (
    <Sub title="Content & Privacy">
      <List>
        <Row title="Content & Privacy Restrictions" toggle={{ value: on, onChange: setOn }} />
      </List>
      {on && (
        <List>
          <Row title="Allow Explicit Music & Podcasts" toggle={{ value: explicit, onChange: setExplicit }} />
          <Row title="Allow In-App Purchases" toggle={{ value: purchases, onChange: setPurchases }} />
        </List>
      )}
    </Sub>
  )
}

// ------------------------------------------------------------------ Communication Safety demo
function SafetyPage() {
  const on = useOS((s) => s.screenTime.communicationSafety)
  const [stage, setStage] = useState<'blurred' | 'ask' | 'confirm' | 'viewed' | 'grownup' | 'blocked'>('blurred')
  return (
    <HeroPage title="Communication Safety" icon={<Ico c="#007aff" i={ShieldCheck} size={60} />} blurb="Detects images and videos that may contain nudity before they’re viewed or sent, and offers ways to stay safe. Analysis happens entirely on device.">
      <List footer="On for children in your family by default. You can also turn it on for your own account.">
        <Row title="Communication Safety" toggle={{ value: on, onChange: (v) => { setST({ communicationSafety: v }); setStage('blurred') } }} />
      </List>
      <List header="How It Works (Demo)" footer="The demo uses an abstract shape — no real sensitive content is ever shown.">
        <div className="stg-cs">
          <div className="stg-cs-msg"><Avatar name="Unknown" size={26} color="#8e8e93" /><span className="t-footnote secondary">Unknown Sender</span></div>
          <div className={`stg-cs-img ${on && stage !== 'viewed' ? 'blur' : ''}`}>
            <div className="stg-cs-shape" />
            {on && stage !== 'viewed' && stage !== 'blocked' && (
              <button className="stg-cs-overlay" onClick={() => setStage('ask')}>
                <EyeOff size={24} />
                <b>This may be sensitive</b>
                <span>Tap to see options</span>
              </button>
            )}
            {stage === 'blocked' && <div className="stg-cs-overlay static"><Ban size={24} /><b>Contact Blocked</b></div>}
          </div>
          {!on && <div className="t-footnote secondary center">With Communication Safety off, images appear without a warning.</div>}
          {stage === 'grownup' && <div className="stg-cs-note anim-pop"><Check size={16} /> Mom was notified. You did the right thing.</div>}
          {(stage === 'viewed' || stage === 'grownup' || stage === 'blocked') && <Button size="small" variant="gray" onClick={() => setStage('blurred')}>Reset Demo</Button>}
        </div>
      </List>
      <Sheet open={stage === 'ask' || stage === 'confirm'} onClose={() => setStage('blurred')} detent="auto" title={stage === 'ask' ? 'It’s your choice, but make sure you feel safe' : 'Are you sure?'}>
        <div className="stg-cs-sheet">
          {stage === 'ask' ? (
            <>
              <p className="secondary">Naked photos and videos can be used to hurt people. Once something’s shared, it can’t be taken back.</p>
              <Button block onClick={() => setStage('grownup')}><MessageCircle size={16} /> Message a Grown-Up</Button>
              <Button block variant="gray" onClick={() => setStage('blocked')}><Ban size={16} /> Block Contact</Button>
              <Button block variant="plain" onClick={() => setStage('confirm')}><Eye size={16} /> View</Button>
            </>
          ) : (
            <>
              <p className="secondary">You don’t have to view this. If you do, it’s okay to talk to someone you trust about it.</p>
              <Button block variant="gray" onClick={() => setStage('blurred')}>Not Now</Button>
              <Button block variant="plain" onClick={() => setStage('viewed')}>I’m Sure</Button>
            </>
          )}
          <div style={{ height: 20 }} />
        </div>
      </Sheet>
    </HeroPage>
  )
}

// ------------------------------------------------------------------ Family: Mia's child account
const CHILD_APP_CHOICES: AppId[] = ['phone', 'messages', 'facetime', 'camera', 'photos', 'music', 'podcasts', 'safari', 'maps', 'weather', 'clock', 'calendar', 'notes', 'reminders', 'calculator', 'freeform', 'journal', 'games', 'fitness', 'health', 'news', 'playground', 'books' as AppId].filter((a) => a in ICONS) as AppId[]

function ChildModeCard() {
  const on = useOS((s) => s.screenTime.childMode)
  const flip = (v: boolean) => {
    setST({ childMode: v })
    os().showToast(v ? 'Simulating Mia’s iPhone — restrictions active' : 'Back to Jamie’s iPhone')
  }
  return (
    <div className={`stg-child-card ${on ? 'on' : ''}`}>
      <div className="row gap12">
        <Avatar id="mia" size={46} />
        <div className="grow">
          <div className="t-headline">Simulate Mia’s iPhone</div>
          <div className="t-footnote secondary">{on ? 'Child mode is on. Blocked apps are grayed out with an hourglass, Safari asks to browse.' : 'Turn on to experience the restrictions you set, across the whole simulator.'}</div>
        </div>
        <Switch checked={on} onChange={flip} label="Simulate Mia’s iPhone (child mode)" color="#5856d6" />
      </div>
      {on && <Button block variant="tinted" size="medium" onClick={() => os().goHome()}><Home size={16} /> See Mia’s Home Screen</Button>}
    </div>
  )
}

function AppGrid({ selected, onToggle }: { selected: AppId[]; onToggle: (a: AppId) => void }) {
  return (
    <div className="stg-app-grid">
      {CHILD_APP_CHOICES.map((a) => {
        const sel = selected.includes(a)
        return (
          <button key={a} className={`stg-app-pick ${sel ? 'on' : ''}`} onClick={() => onToggle(a)} aria-pressed={sel} aria-label={`${ICONS[a].name} ${sel ? 'allowed' : 'not allowed'}`}>
            <AppIconArt app={a} size={50} />
            <span>{ICONS[a].name}</span>
            <i className="stg-app-check">{sel && <Check size={12} strokeWidth={3.4} />}</i>
          </button>
        )
      })}
    </div>
  )
}

function toggleAllowed(a: AppId) {
  const cur = os().screenTime.allowedApps
  setST({ allowedApps: cur.includes(a) ? cur.filter((x) => x !== a) : [...cur, a] })
}

function FamilyChildPage() {
  const stc = useOS((s) => s.screenTime)
  const setupDone = usePrefs((s) => s.childSetupDone)
  const [wizard, setWizard] = useState(false)
  const nav = useNav()
  const pending = stc.pendingRequests.filter((r) => r.status === 'pending')
  return (
    <Sub title="Mia">
      <div className="stg-acct-head">
        <Avatar id="mia" size={80} />
        <div className="stg-acct-name">Mia Park</div>
        <div className="secondary t-subhead">Child Account · Age 10 · Managed by Mom, Dad and you</div>
      </div>
      <ChildModeCard />
      {!setupDone && (
        <List>
          <Row icon={<Ico c="#5856d6" i={Sparkles} />} title={<span className="row gap6">Set Up Mia’s iPhone <New27 /></span>} subtitle="Choose exactly which apps Mia can use" chevron onClick={() => setWizard(true)} />
        </List>
      )}
      <List header="Apps" footer="Only the apps you select appear on Mia’s iPhone.">
        <Push icon={<Ico c="#007aff" i={Smartphone} />} title="Allowed Apps" detail={`${stc.allowedApps.filter((a) => a !== 'settings').length} apps`} page={() => <AllowedAppsPage />} />
        {setupDone && <Row tint title="Run Setup Again" onClick={() => setWizard(true)} />}
      </List>
      <List header={<span className="row gap6">Web <New27 /></span>}>
        <Push icon={<Ico c="#007aff" i={Globe} />} title="Ask to Browse" detail={pending.length ? `${pending.length} pending` : stc.askToBrowse ? 'On' : 'Off'} page={() => <AskToBrowsePage />} />
      </List>
      <List header={<span className="row gap6">Time <New27 /></span>}>
        <Push icon={<Ico c="#ff9500" i={Timer} />} title="Time Allowances" detail={`${stc.allowances.filter((a) => a.enabled).length} on`} page={() => <AllowancesPage />} />
        <Push icon={<Ico c="#5856d6" i={CalendarClock} />} title="Schedules" detail={`${stc.schedules.filter((s) => s.enabled).length} active`} page={() => <SchedulesPage />} />
        <Go icon={<Ico c="#5856d6" i={Moon} fill />} to="screentime/downtime" title="Downtime" detail={stc.downtime ? 'On' : 'Off'} />
      </List>
      <List header="Safety">
        <Go icon={<Ico c="#007aff" i={ShieldCheck} />} to="screentime/safety" title="Communication Safety" detail={stc.communicationSafety ? 'On' : 'Off'} />
        <Row icon={<Ico c="#34c759" i={Users} />} title="Family Sharing" chevron onClick={() => nav.push(ROUTES['account/family'].el())} />
      </List>
      <ChildSetupWizard open={wizard} onClose={() => setWizard(false)} />
    </Sub>
  )
}

function AllowedAppsPage() {
  const allowed = useOS((s) => s.screenTime.allowedApps)
  return (
    <Sub title="Allowed Apps">
      <div className="stg-pad row gap8" style={{ justifyContent: 'space-between' }}>
        <span className="t-footnote secondary">{allowed.filter((a) => CHILD_APP_CHOICES.includes(a)).length} of {CHILD_APP_CHOICES.length} selected</span>
        <span className="row gap8">
          <button className="stg-link" onClick={() => setST({ allowedApps: [...CHILD_APP_CHOICES, 'settings'] })}>Select All</button>
          <button className="stg-link" onClick={() => setST({ allowedApps: ['phone', 'messages', 'settings'] })}>Essentials Only</button>
        </span>
      </div>
      <AppGrid selected={allowed} onToggle={toggleAllowed} />
      <div className="stg-foot-note t-footnote secondary">Settings stays available so a parent can always turn off child mode.</div>
    </Sub>
  )
}

function ChildSetupWizard({ open, onClose }: { open: boolean; onClose: () => void }) {
  const stc = useOS((s) => s.screenTime)
  const [step, setStep] = useState(0)
  const finish = () => {
    usePrefs.getState().setP({ childSetupDone: true })
    onClose()
    setStep(0)
    os().showToast('Mia’s iPhone is set up')
  }
  return (
    <Sheet open={open} onClose={() => { onClose(); setStep(0) }} title={`Step ${step + 1} of 4`}>
      <div className="stg-aa">
        <div className="stg-qs-steps">{[0, 1, 2, 3].map((i) => <span key={i} className={i <= step ? 'on' : ''} />)}</div>
        {step === 0 && (
          <div className="anim-up center">
            <Avatar id="mia" size={72} style={{ margin: '0 auto 10px' }} />
            <h2 className="stg-qs-title">Set Up Mia’s iPhone</h2>
            <p className="secondary">Choose exactly which apps Mia can use, whether she needs to ask before visiting websites, and how much time she gets each day.</p>
            <Button block onClick={() => setStep(1)}>Get Started</Button>
          </div>
        )}
        {step === 1 && (
          <div className="anim-up">
            <h2 className="stg-qs-title">Choose Apps for Mia</h2>
            <p className="secondary t-subhead">Tap to include or remove. Apps you don’t choose won’t open on Mia’s iPhone.</p>
            <AppGrid selected={stc.allowedApps} onToggle={toggleAllowed} />
            <Button block onClick={() => setStep(2)}>Continue</Button>
          </div>
        )}
        {step === 2 && (
          <div className="anim-up">
            <h2 className="stg-qs-title">Ask to Browse</h2>
            <p className="secondary t-subhead">Mia can visit approved websites. For anything else, she sends you a request.</p>
            <List>
              <Row title="Ask to Browse" toggle={{ value: stc.askToBrowse, onChange: (v) => setST({ askToBrowse: v }) }} />
              <Row title="Approved Websites" detail={stc.approvedSites.length} />
            </List>
            <Button block onClick={() => setStep(3)}>Continue</Button>
          </div>
        )}
        {step === 3 && (
          <div className="anim-up">
            <h2 className="stg-qs-title">Daily Time Allowances</h2>
            <List>
              {stc.allowances.map((a) => (
                <Row key={a.category} title={a.category} subtitle={a.enabled ? `${a.minutes} min a day` : 'No limit'} toggle={{ value: a.enabled, onChange: (v) => setST({ allowances: os().screenTime.allowances.map((x) => (x.category === a.category ? { ...x, enabled: v } : x)) }) }} />
              ))}
            </List>
            <Button block onClick={finish}>Finish Setup</Button>
          </div>
        )}
      </div>
    </Sheet>
  )
}

function AskToBrowsePage() {
  const stc = useOS((s) => s.screenTime)
  const [site, setSite] = useState('')
  const decide = (id: string, status: 'approved' | 'denied') => {
    const req = stc.pendingRequests.find((r) => r.id === id)
    if (!req) return
    setST({
      pendingRequests: stc.pendingRequests.map((r) => (r.id === id ? { ...r, status } : r)),
      approvedSites: status === 'approved' && !stc.approvedSites.includes(req.site) ? [...stc.approvedSites, req.site] : stc.approvedSites,
    })
    os().showToast(status === 'approved' ? `${req.site} approved for Mia` : `${req.site} declined`)
  }
  const simulate = () => {
    const pick = ['videotube.example', 'gamezone.example', 'drawingclub.example', 'spacefacts.example'].find((s) => !stc.approvedSites.includes(s) && !stc.pendingRequests.some((r) => r.site === s && r.status === 'pending')) ?? 'kidsnews.example'
    setST({ pendingRequests: [{ id: uid('req'), site: pick, ts: Date.now(), status: 'pending' }, ...stc.pendingRequests] })
    os().notify({ app: 'settings', title: 'Screen Time', body: `Mia is asking to visit ${pick}.`, route: 'screentime/family' })
  }
  const add = () => {
    const s = site.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '')
    if (!s || stc.approvedSites.includes(s)) return
    setST({ approvedSites: [...stc.approvedSites, s] })
    setSite('')
  }
  const pending = stc.pendingRequests.filter((r) => r.status === 'pending')
  const history = stc.pendingRequests.filter((r) => r.status !== 'pending').slice(0, 6)
  return (
    <Sub title="Ask to Browse">
      <List footer="When on, Mia can only open websites you’ve approved. Anything else sends you a request. In child mode, Safari shows the request screen.">
        <Row title="Ask to Browse" toggle={{ value: stc.askToBrowse, onChange: (v) => setST({ askToBrowse: v }) }} />
      </List>
      <List header={`Requests${pending.length ? ` (${pending.length})` : ''}`}>
        {pending.length === 0 && <Row title={<span className="secondary">No pending requests</span>} />}
        {pending.map((r) => (
          <Row
            key={r.id}
            icon={<span className="stg-site-ico">{r.site[0].toUpperCase()}</span>}
            title={r.site}
            subtitle="Mia wants to visit this website"
            trailing={
              <span className="row gap6">
                <button className="stg-pill deny" onClick={() => decide(r.id, 'denied')}>Deny</button>
                <button className="stg-pill approve" onClick={() => decide(r.id, 'approved')}>Approve</button>
              </span>
            }
          />
        ))}
        <Row tint title="Simulate a Request from Mia" onClick={simulate} />
      </List>
      {history.length > 0 && (
        <List header="Recent Decisions">
          {history.map((r) => <Row key={r.id} title={r.site} detail={r.status === 'approved' ? 'Approved' : 'Denied'} compact />)}
        </List>
      )}
      <List header="Approved Websites">
        {stc.approvedSites.map((s) => (
          <Row key={s} icon={<span className="stg-site-ico">{s[0].toUpperCase()}</span>} title={s} trailing={<button className="stg-x" aria-label={`Remove ${s}`} onClick={() => setST({ approvedSites: stc.approvedSites.filter((x) => x !== s) })}><X size={14} /></button>} />
        ))}
        <Row title="Add Website" trailing={<span className="row gap8"><input className="text-input stg-field" value={site} onChange={(e) => setSite(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} placeholder="example.com" aria-label="Website to approve" /><button className="stg-link" onClick={add}>Add</button></span>} />
      </List>
    </Sub>
  )
}

function AllowancesPage() {
  const list = useOS((s) => s.screenTime.allowances)
  const patch = (cat: string, p: Partial<ScreenTimeConfig['allowances'][number]>) => setST({ allowances: os().screenTime.allowances.map((a) => (a.category === cat ? { ...a, ...p } : a)) })
  return (
    <Sub title="Time Allowances">
      <div className="stg-foot-note t-footnote secondary" style={{ paddingTop: 0 }}>Give Mia a daily amount of time for each kind of app. When time runs out, apps in that category are limited until tomorrow.</div>
      {list.map((a) => {
        const I = CAT_ICONS[a.category]
        const pct = Math.min(1, a.used / a.minutes)
        return (
          <List key={a.category}>
            <Row icon={<span className="settings-icon" style={{ background: CAT_COLORS[a.category] }}><I size={17} color="#fff" /></span>} title={a.category} toggle={{ value: a.enabled, onChange: (v) => patch(a.category, { enabled: v }) }} />
            {a.enabled && (
              <div className="stg-allow">
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <span className="t-subhead">{fmtMin(a.minutes)} a day</span>
                  <span className="stg-stepper">
                    <button aria-label={`Less ${a.category} time`} onClick={() => patch(a.category, { minutes: Math.max(15, a.minutes - 15) })}><Minus size={14} /></button>
                    <button aria-label={`More ${a.category} time`} onClick={() => patch(a.category, { minutes: Math.min(480, a.minutes + 15) })}><Plus size={14} /></button>
                  </span>
                </div>
                <div className="stg-allow-bar"><span style={{ width: `${pct * 100}%`, background: pct >= 1 ? 'var(--red)' : CAT_COLORS[a.category] }} /></div>
                <div className="row t-footnote secondary" style={{ justifyContent: 'space-between' }}>
                  <span>{a.used} min used today</span>
                  <span>{pct >= 1 ? 'Limit reached' : `${a.minutes - a.used} min left`}</span>
                </div>
                <div className="row gap8">
                  <button className="stg-link" onClick={() => patch(a.category, { used: 0 })}>Reset Today</button>
                  <button className="stg-link" onClick={() => patch(a.category, { used: Math.min(a.minutes, a.used + 15) })}>Simulate +15 min use</button>
                </div>
              </div>
            )}
          </List>
        )
      })}
    </Sub>
  )
}

function SchedulesPage() {
  const schedules = useOS((s) => s.screenTime.schedules)
  const nav = useNav()
  const add = () => {
    const s = { id: uid('sch'), name: 'New Schedule', start: '16:00', end: '17:00', days: 'weekdays' as const, apps: ['games'] as AppId[], enabled: true }
    setST({ schedules: [...os().screenTime.schedules, s] })
    nav.push(<ScheduleEdit id={s.id} />)
  }
  return (
    <Sub title="Schedules" trailing={<button className="bar-btn icon glass interactive" aria-label="Add schedule" onClick={add}><Plus size={22} /></button>}>
      <List footer="During a schedule, the chosen apps are unavailable on Mia’s iPhone.">
        {schedules.map((s) => (
          <Row
            key={s.id}
            title={s.name}
            subtitle={`${s.start}–${s.end} · ${s.days === 'everyday' ? 'Every Day' : s.days === 'weekdays' ? 'Weekdays' : 'Weekends'} · ${s.apps.length} app${s.apps.length === 1 ? '' : 's'}`}
            onClick={() => nav.push(<ScheduleEdit id={s.id} />)}
            trailing={<Switch checked={s.enabled} onChange={(v) => setST({ schedules: os().screenTime.schedules.map((x) => (x.id === s.id ? { ...x, enabled: v } : x)) })} label={`${s.name} enabled`} />}
          />
        ))}
        <Row tint title="Add Schedule…" onClick={add} />
      </List>
    </Sub>
  )
}

function ScheduleEdit({ id }: { id: string }) {
  const s = useOS((x) => x.screenTime.schedules.find((y) => y.id === id))
  const allowed = useOS((x) => x.screenTime.allowedApps)
  const nav = useNav()
  if (!s) return <Sub title="Schedule"><div className="empty-state">Schedule deleted.</div></Sub>
  const patch = (p: Partial<typeof s>) => setST({ schedules: os().screenTime.schedules.map((x) => (x.id === id ? { ...x, ...p } : x)) })
  const apps = CHILD_APP_CHOICES.filter((a) => allowed.includes(a))
  return (
    <Sub title={s.name}>
      <List>
        <Row title="Name" trailing={<input className="text-input stg-field" value={s.name} onChange={(e) => patch({ name: e.target.value })} aria-label="Schedule name" />} />
        <Row title="Enabled" toggle={{ value: s.enabled, onChange: (v) => patch({ enabled: v }) }} />
      </List>
      <List header="Time">
        <Row title="Starts" trailing={<input type="time" className="stg-time" value={s.start} onChange={(e) => patch({ start: e.target.value })} aria-label="Starts" />} />
        <Row title="Ends" trailing={<input type="time" className="stg-time" value={s.end} onChange={(e) => patch({ end: e.target.value })} aria-label="Ends" />} />
        <div className="stg-pad"><Segmented options={['weekdays', 'weekends', 'everyday'] as const} value={s.days} onChange={(v) => patch({ days: v })} labels={{ weekdays: 'Weekdays', weekends: 'Weekends', everyday: 'Every Day' }} /></div>
      </List>
      <List header="Limited Apps">
        <AppGridSmall apps={apps} selected={s.apps} onToggle={(a) => patch({ apps: s.apps.includes(a) ? s.apps.filter((x) => x !== a) : [...s.apps, a] })} />
      </List>
      <List>
        <Row destructive title="Delete Schedule" onClick={() => showAlert({ title: `Delete “${s.name}”?`, actions: [{ label: 'Cancel', style: 'cancel' }, { label: 'Delete', style: 'destructive', onPress: () => { nav.pop(); window.setTimeout(() => setST({ schedules: os().screenTime.schedules.filter((x) => x.id !== id) }), 350) } }] })} />
      </List>
    </Sub>
  )
}

function AppGridSmall({ apps, selected, onToggle }: { apps: AppId[]; selected: AppId[]; onToggle: (a: AppId) => void }) {
  return (
    <div className="stg-app-grid small">
      {apps.map((a) => {
        const sel = selected.includes(a)
        return (
          <button key={a} className={`stg-app-pick ${sel ? 'on' : ''}`} onClick={() => onToggle(a)} aria-pressed={sel} aria-label={`${ICONS[a].name} ${sel ? 'limited' : 'not limited'}`}>
            <AppIconArt app={a} size={40} />
            <span>{ICONS[a].name}</span>
            <i className="stg-app-check">{sel && <Check size={11} strokeWidth={3.4} />}</i>
          </button>
        )
      })}
    </div>
  )
}

export function registerScreenTime() {
  Object.assign(ROUTES, {
    screentime: { title: 'Screen Time', el: () => <ScreenTimePage />, keywords: 'screen time limits downtime usage activity pickups family child' },
    'screentime/activity': { title: 'App & Website Activity', el: () => <ActivityPage />, keywords: 'activity most used pickups notifications categories', parent: 'screentime' },
    'screentime/downtime': { title: 'Downtime', el: () => <DowntimePage />, keywords: 'downtime schedule', parent: 'screentime' },
    'screentime/limits': { title: 'App Limits', el: () => <LimitsPage />, keywords: 'app limits category time', parent: 'screentime' },
    'screentime/always': { title: 'Always Allowed', el: () => <AlwaysAllowedPage />, keywords: 'always allowed apps', parent: 'screentime' },
    'screentime/safety': { title: 'Communication Safety', el: () => <SafetyPage />, keywords: 'communication safety sensitive content blur', parent: 'screentime' },
    'screentime/family': { title: 'Family & Child Account', el: () => <FamilyChildPage />, keywords: 'family child account mia parental controls allowed apps ask to browse allowances schedules child mode', parent: 'screentime' },
    'screentime/browse': { title: 'Ask to Browse', el: () => <AskToBrowsePage />, keywords: 'ask to browse websites approve requests', parent: 'screentime/family' },
    'screentime/allowances': { title: 'Time Allowances', el: () => <AllowancesPage />, keywords: 'time allowances entertainment games social creativity education minutes', parent: 'screentime/family' },
    'screentime/schedules': { title: 'Schedules', el: () => <SchedulesPage />, keywords: 'schedules bedtime school hours', parent: 'screentime/family' },
    'screentime/apps': { title: 'Allowed Apps', el: () => <AllowedAppsPage />, keywords: 'allowed apps child choose apps', parent: 'screentime/family' },
  })
}
