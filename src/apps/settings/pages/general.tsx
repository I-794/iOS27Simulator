import { useEffect, useState } from 'react'
import { Settings as Gear, Info, RefreshCw, HardDrive, Keyboard, Globe, CalendarClock, Smartphone, ListChecks, Gamepad2, RotateCcw, Share, ChevronDown, ArrowLeftRight, Check, Plus, Trash2, Languages, Sparkles, PhoneCall, Car } from 'lucide-react'
import { List, Row } from '../../../ui/list'
import { Spinner, Button } from '../../../ui/controls'
import { showAlert, Sheet } from '../../../ui/overlay'
import { useNav } from '../../../ui/nav'
import { useOS } from '../../../os/store'
import { useNow } from '../../../os/hooks'
import { fmtClock, fmtDate } from '../../../os/time'
import { proofread } from '../../../os/ai/writing'
import { AppIconArt, ICONS } from '../../../icons/AppIconArt'
import type { AppId } from '../../../os/types'
import { ROUTES, HeroPage, Sub, Ico, Go, Push, ChoicePage, usePrefs, usePref, Note, New27, os, setLang, setGames, DEFAULT_PREFS } from '../common'
import { StorageBar } from './account'

function GeneralPage() {
  const airdrop = useOS((s) => s.airdrop)
  return (
    <HeroPage title="General" icon={<Ico c="#8e8e93" i={Gear} size={60} />} blurb="Manage your overall setup and preferences for iPhone, such as software updates, device language, AirDrop, and more.">
      <List>
        <Go icon={<Ico c="#8e8e93" i={Info} />} to="general/about" title="About" />
        <Go icon={<Ico c="#8e8e93" i={RefreshCw} />} to="general/update" title="Software Update" />
        <Go icon={<Ico c="#8e8e93" i={HardDrive} />} to="general/storage" title="iPhone Storage" />
      </List>
      <List>
        <Push icon={<Ico c="#007aff" i={Share} />} title="AirDrop" detail={airdrop === 'off' ? 'Receiving Off' : airdrop === 'contacts' ? 'Contacts Only' : 'Everyone for 10 Minutes'} page={() => <AirDropPage />} />
        <Go icon={<Ico c="#34c759" i={ArrowLeftRight} />} to="general/handoff" title="iPhone Handoff" />
        <Go icon={<Ico c="#34c759" i={Car} />} to="general/carplay" title="CarPlay" />
      </List>
      <List>
        <Go icon={<Ico c="#8e8e93" i={CalendarClock} />} to="general/datetime" title="Date & Time" />
        <Go icon={<Ico c="#8e8e93" i={Keyboard} />} to="general/keyboard" title="Keyboard" />
        <Go icon={<Ico c="#8e8e93" i={Globe} />} to="general/language" title="Language & Region" />
        <Go icon={<Ico c="#0a84ff" i={ListChecks} />} to="general/availability" title="Feature Availability" />
      </List>
      <List>
        <Go icon={<Ico c="#8e8e93" i={Gamepad2} />} to="games" title="Game Controllers" />
      </List>
      <List>
        <Go icon={<Ico c="#8e8e93" i={RotateCcw} />} to="general/reset" title="Transfer or Reset iPhone" />
      </List>
    </HeroPage>
  )
}

function AirDropPage() {
  const airdrop = useOS((s) => s.airdrop)
  return (
    <Sub title="AirDrop">
      <List footer="AirDrop lets you share instantly with people nearby. You can be discoverable in AirDrop to receive from everyone or only people in your contacts.">
        {([['off', 'Receiving Off'], ['contacts', 'Contacts Only'], ['everyone', 'Everyone for 10 Minutes']] as const).map(([v, l]) => (
          <Row key={v} title={l} onClick={() => os().set({ airdrop: v })} trailing={airdrop === v ? <Check size={20} strokeWidth={2.6} className="stg-check" /> : <span style={{ width: 20 }} />} />
        ))}
      </List>
    </Sub>
  )
}

function AboutPage() {
  const photos = useOS((s) => s.photos.length)
  return (
    <Sub title="About">
      <List>
        <Row title="Name" detail="Jamie’s iPhone" />
        <Row title="iOS Version" detail="27.0" chevron onClick={() => showAlert({ title: 'iOS 27.0', message: 'Released September 2026. This is a browser simulation — not affiliated with Apple.', actions: [{ label: 'OK' }] })} />
        <Row title="Model Name" detail="iPhone 18 Pro (simulated)" />
        <Row title="Model Number" detail="SIM27-LL/A" />
        <Row title="Serial Number" detail="SIMULATED-0001" />
      </List>
      <List>
        <Row title="Songs" detail="1,204" />
        <Row title="Videos" detail="86" />
        <Row title="Photos" detail={photos.toLocaleString()} />
        <Row title="Applications" detail={Object.keys(ICONS).length} />
        <Row title="Capacity" detail="256 GB" />
        <Row title="Available" detail="142.3 GB" />
      </List>
      <List>
        <Row title="Wi‑Fi Address" detail="5E:21:9A:C4:07:B3" />
        <Row title="Bluetooth" detail="5E:21:9A:C4:07:B4" />
        <Row title="Carrier" detail="Maple Mobile 70.0" />
      </List>
    </Sub>
  )
}

function UpdatePage() {
  const auto = usePrefs((s) => s.softwareAuto)
  const last = usePrefs((s) => s.lastChecked)
  const [checking, setChecking] = useState(true)
  useEffect(() => {
    const t = window.setTimeout(() => {
      setChecking(false)
      usePrefs.getState().setP({ lastChecked: Date.now() })
    }, 1400)
    return () => window.clearTimeout(t)
  }, [checking])
  return (
    <Sub title="Software Update">
      <List>
        <Row title="Automatic Updates" detail={auto ? 'On' : 'Off'} onClick={() => usePrefs.getState().setP({ softwareAuto: !auto })} />
        <Row title="Beta Updates" detail="Off" />
      </List>
      <div className="stg-update">
        {checking ? (
          <div className="col gap8" style={{ alignItems: 'center' }}><Spinner size={26} /><span className="secondary">Checking for Update…</span></div>
        ) : (
          <div className="col gap6 anim-fade" style={{ alignItems: 'center' }}>
            <div className="stg-update-badge">27</div>
            <div className="t-headline">iOS 27.0</div>
            <div className="secondary">iOS is up to date</div>
            <div className="t-footnote tertiary">Last checked {last ? fmtClock(last) : 'just now'}</div>
            <Button variant="tinted" size="small" onClick={() => setChecking(true)}>Check Again</Button>
          </div>
        )}
      </div>
    </Sub>
  )
}

const APP_SIZES: { app: AppId; gb: number }[] = [
  { app: 'photos', gb: 38.4 }, { app: 'music', gb: 12.2 }, { app: 'messages', gb: 6.8 }, { app: 'games', gb: 4.1 }, { app: 'podcasts', gb: 2.7 },
  { app: 'maps', gb: 1.4 }, { app: 'safari', gb: 0.9 }, { app: 'notes', gb: 0.6 }, { app: 'freeform', gb: 0.4 }, { app: 'playground', gb: 0.3 },
]
function StoragePage() {
  const [offload, setOffload] = useState(false)
  return (
    <Sub title="iPhone Storage">
      <List>
        <StorageBar total={256} used={113.7} items={[{ label: 'Photos', gb: 38.4, color: '#ff9f0a' }, { label: 'Apps', gb: 31.2, color: '#ff375f' }, { label: 'Media', gb: 15.1, color: '#af52de' }, { label: 'iOS', gb: 14.2, color: '#8e8e93' }, { label: 'System Data', gb: 14.8, color: '#c7c7cc' }]} />
      </List>
      <List header="Recommendations" footer="Automatically offload unused apps when you’re low on storage. Your documents & data will be saved.">
        <Row title="Offload Unused Apps" subtitle="Save up to 6.2 GB" trailing={<button className="stg-link" onClick={() => { setOffload(true); os().showToast('Offload Unused Apps enabled') }}>{offload ? 'Enabled' : 'Enable'}</button>} />
      </List>
      <List>
        {APP_SIZES.map((a) => <Row key={a.app} icon={<AppIconArt app={a.app} size={30} />} title={ICONS[a.app].name} detail={`${a.gb} GB`} />)}
      </List>
    </Sub>
  )
}

// ------------------------------------------------------------------ Keyboards
const KEYBOARD_GROUPS: { header: string; list: string[]; new?: boolean }[] = [
  { header: 'Suggested', list: ['English (UK)', 'French (Canada)', 'Korean'] },
  { header: 'Indigenous Languages', list: ['Cherokee', 'Hawaiian', 'Māori', 'Navajo (Diné Bizaad)', 'Inuktitut', 'Plains Cree', 'Ojibwe', 'Northern Sámi'], new: true },
  { header: 'Other Languages', list: ['Arabic', 'Chinese – Simplified (Pinyin)', 'Chinese – Traditional (Zhuyin)', 'Japanese – Kana', 'Japanese – Romaji', 'German', 'Hindi', 'Portuguese (Brazil)', 'Vietnamese', 'Tagalog'] },
]

function detectLangs(t: string): string[] {
  const out: string[] = []
  const l = t.toLowerCase()
  if (/\b(the|and|is|you|to|see|at|we|i|practice)\b/.test(l)) out.push('English')
  if (/\b(hola|gracias|mañana|que|nos|vemos|cómo|como|estás|estas|bien|para)\b/.test(l)) out.push('Español')
  if (/\b(bonjour|merci|oui|je|suis|avec|très)\b/.test(l)) out.push('Français')
  if (/[぀-ヿ]/.test(t)) out.push('日本語')
  if (/[一-鿿]/.test(t)) out.push('中文')
  return out
}

function KeyboardPage() {
  const lang = useOS((s) => s.language)
  const prefs = usePrefs()
  const nav = useNav()
  const [demo, setDemo] = useState('hola alex, we was at practice. nos vemos mañana')
  const langs = detectLangs(demo)
  const fixed = lang.grammar ? proofread(demo) : null
  return (
    <Sub title="Keyboards">
      <List>
        <Push title="Keyboards" detail={lang.keyboards.length} page={() => <KeyboardsList />} />
        <Push title="Text Replacement" page={() => <TextReplacement />} />
      </List>
      <List header="All Keyboards">
        <Row title="Auto-Capitalization" toggle={{ value: true, onChange: () => os().showToast('Auto-Capitalization is always on in the simulator') }} />
        <Row title="Auto-Correction" toggle={{ value: prefs.autocorrect, onChange: (v) => prefs.setP({ autocorrect: v }) }} />
        <Row title="Check Spelling & Grammar" toggle={{ value: lang.grammar, onChange: (v) => setLang({ grammar: v }) }} />
        <Row title="Predictive Text" toggle={{ value: prefs.predictive, onChange: (v) => prefs.setP({ predictive: v }) }} />
        <Row title="Smart Punctuation" toggle={{ value: prefs.smartPunct, onChange: (v) => prefs.setP({ smartPunct: v }) }} />
        <Row title="Slide to Type" toggle={{ value: prefs.slideToType, onChange: (v) => prefs.setP({ slideToType: v }) }} />
      </List>
      <List header={<span className="row gap6">Multilingual Typing <New27 /></span>} footer="Type in up to three languages without switching keyboards. Suggestions, autocorrect and grammar checking follow the language of each word.">
        <Row icon={<Ico c="#007aff" i={Languages} />} title="Multilingual Typing" toggle={{ value: lang.multilingual, onChange: (v) => setLang({ multilingual: v }) }} />
        <div className="stg-kbd-demo">
          <textarea className="text-input" rows={2} value={demo} onChange={(e) => setDemo(e.target.value)} aria-label="Try multilingual typing" />
          <div className="row gap6 stg-chips">
            {(lang.multilingual ? langs : langs.slice(0, 1)).map((l) => <span key={l} className="stg-chip">{l}</span>)}
            {!langs.length && <span className="t-footnote secondary">Start typing…</span>}
          </div>
          {fixed && fixed.changes.length > 0 && (
            <div className="stg-kbd-fix">
              <div className="t-footnote secondary">Grammar suggestion</div>
              <div>{fixed.text}</div>
              <button className="stg-link" onClick={() => setDemo(fixed.text)}>Apply</button>
            </div>
          )}
        </div>
      </List>
      <List header="Dictation" footer="Automatic punctuation adds commas, periods and question marks as you dictate.">
        <Row title="Enable Dictation" toggle={{ value: true, onChange: () => os().showToast('Dictation stays on in the simulator keyboard') }} />
        <Row title="Auto-Punctuation" toggle={{ value: lang.autoPunctuation, onChange: (v) => setLang({ autoPunctuation: v }) }} />
      </List>
      <List header={<span className="row gap6">Emoji & Stickers <New27 /></span>} footer="The redesigned emoji and sticker keyboard opens instantly, searches as you type, and suggests Genmoji and stickers from your conversation.">
        <Row title="Faster Emoji & Sticker Keyboard" toggle={{ value: prefs.emojiQuick, onChange: (v) => prefs.setP({ emojiQuick: v }) }} />
        <Row title="Memoji Stickers" toggle={{ value: true, onChange: () => os().showToast('Memoji Stickers are always available') }} />
      </List>
      <List header={<span className="row gap6">Chinese & Japanese <New27 /></span>} footer="Improved conversion now uses the sentence you’re writing and the app you’re in, so Pinyin, Zhuyin and Kana candidates are more accurate.">
        <Row title="Contextual Conversion" detail="On" onClick={() => nav.push(ROUTES['general/availability'].el())} />
      </List>
    </Sub>
  )
}

function KeyboardsList() {
  const kb = useOS((s) => s.language.keyboards)
  const [adding, setAdding] = useState(false)
  return (
    <Sub title="Keyboards" trailing={<button className="bar-btn glass interactive" onClick={() => setAdding(true)}>Add</button>}>
      <List footer="Tap a keyboard to remove it. Emoji can’t be removed while it’s your only emoji input.">
        {kb.map((k) => (
          <Row
            key={k}
            title={k}
            trailing={k === 'Emoji' ? undefined : <Trash2 size={18} className="secondary" />}
            onClick={() => {
              if (k === 'Emoji' || kb.length <= 1) return
              showAlert({ title: `Remove ${k}?`, actions: [{ label: 'Cancel', style: 'cancel' }, { label: 'Remove', style: 'destructive', onPress: () => setLang({ keyboards: os().language.keyboards.filter((x) => x !== k) }) }] })
            }}
          />
        ))}
        <Row tint title={<span className="row gap6"><Plus size={18} /> Add New Keyboard…</span>} onClick={() => setAdding(true)} />
      </List>
      <Sheet open={adding} onClose={() => setAdding(false)} title="Add New Keyboard">
        {KEYBOARD_GROUPS.map((g) => (
          <List key={g.header} header={<span className="row gap6">{g.header}{g.new && <New27 />}</span>}>
            {g.list.map((k) => {
              const has = kb.includes(k)
              return (
                <Row
                  key={k}
                  title={k}
                  trailing={has ? <Check size={20} className="stg-check" /> : undefined}
                  onClick={() => {
                    if (has) return
                    setLang({ keyboards: [...os().language.keyboards, k] })
                    setAdding(false)
                    os().showToast(`${k} keyboard added`)
                  }}
                />
              )
            })}
          </List>
        ))}
      </Sheet>
    </Sub>
  )
}

function TextReplacement() {
  const [items, setItems] = useState([{ p: 'omw', t: 'On my way!' }, { p: 'rbt', t: 'Robotics build tonight at 6:30' }, { p: 'lhs', t: 'Lincoln High School' }])
  const [p, setP] = useState('')
  const [t, setT] = useState('')
  return (
    <Sub title="Text Replacement">
      <List>
        {items.map((i) => <Row key={i.p} title={i.t} detail={i.p} onClick={() => setItems((l) => l.filter((x) => x.p !== i.p))} trailing={<Trash2 size={16} className="secondary" />} />)}
      </List>
      <List header="New Shortcut">
        <Row title="Phrase" trailing={<input className="text-input stg-field" value={t} onChange={(e) => setT(e.target.value)} placeholder="Phrase" aria-label="Phrase" />} />
        <Row title="Shortcut" trailing={<input className="text-input stg-field" value={p} onChange={(e) => setP(e.target.value)} placeholder="Optional" aria-label="Shortcut" />} />
        <Row tint title="Save" onClick={() => { if (t && p) { setItems((l) => [...l, { p, t }]); setP(''); setT('') } }} />
      </List>
    </Sub>
  )
}

// ------------------------------------------------------------------ Language & Region
const ENGLISH_VARIANTS: { name: string; new?: boolean }[] = [
  { name: 'English (US)' }, { name: 'English (UK)' }, { name: 'English (Australia)' }, { name: 'English (Canada)' }, { name: 'English (India)' },
  { name: 'English (Singapore)', new: true }, { name: 'English (Ireland)', new: true }, { name: 'English (New Zealand)', new: true }, { name: 'English (South Africa)', new: true }, { name: 'English (Nigeria)', new: true }, { name: 'English (Philippines)', new: true },
]
const REGIONS = ['United States', 'Canada', 'United Kingdom', 'Australia', 'India', 'Singapore', 'Ireland', 'New Zealand', 'South Africa', 'Japan', 'Mexico', 'Germany']

function LanguagePage() {
  const region = useOS((s) => s.language.region)
  const h24 = useOS((s) => s.h24)
  const prefs = usePrefs()
  const now = useNow()
  const nav = useNav()
  return (
    <Sub title="Language & Region">
      <List header="Preferred Languages" footer="Apps and websites will use the first language in this list that they support.">
        {prefs.preferredLanguages.map((l, i) => <Row key={l} title={i === 0 ? prefs.langVariant : l} subtitle={i === 0 ? 'iPhone Language' : undefined} />)}
        <Push tint title="Add Language…" page={() => <ChoicePage title="Add Language" options={['Spanish (US)', 'French', 'Korean', 'Japanese', 'Chinese, Simplified', 'Hawaiian', 'Māori'] as const} use={() => ['' as 'French', (v) => { const l = usePrefs.getState().preferredLanguages; if (!l.includes(v)) usePrefs.getState().setP({ preferredLanguages: [...l, v] }); nav.pop() }]} />} />
      </List>
      <List header={<span className="row gap6">iPhone Language <New27 /></span>} footer="iOS 27 adds more regional English variants for the whole interface — spelling, vocabulary and Siri responses follow your variant.">
        <Push title="English Variant" detail={prefs.langVariant.replace('English ', '')} page={() => <VariantPage />} />
      </List>
      <List>
        <Push title="Region" detail={region} page={() => <ChoicePage title="Region" options={REGIONS} use={() => [useOS((st) => st.language.region), (v) => setLang({ region: v })]} />} />
        <Push title="Calendar" detail={prefs.calendar} page={() => <ChoicePage title="Calendar" options={['Gregorian', 'Japanese', 'Buddhist'] as const} use={() => usePref('calendar')} />} />
        <Push title="Temperature" detail={prefs.tempUnit} page={() => <ChoicePage title="Temperature" options={['°F', '°C'] as const} use={() => usePref('tempUnit')} />} />
        <Row title="Natural Language Times" subtitle="“quarter past 5”, “in half an hour”" toggle={{ value: prefs.naturalTime, onChange: (v) => prefs.setP({ naturalTime: v }) }} />
      </List>
      <div className="stg-region-card">
        <div className="t-headline">Region Format Example</div>
        <div className="t-title2">{fmtClock(now, h24)}</div>
        <div className="secondary">{fmtDate(now, 'full')}</div>
        <div className="secondary">{region === 'United States' ? '$1,234.56 · 4,567.89' : region === 'Germany' ? '1.234,56 € · 4.567,89' : region === 'India' ? '₹1,234.56 · 4,567.89' : region === 'Japan' ? '¥1,235 · 4,567.89' : '1,234.56 · 4,567.89'}</div>
      </div>
    </Sub>
  )
}

function VariantPage() {
  const v = usePrefs((s) => s.langVariant)
  return (
    <Sub title="English Variant">
      <List footer="Changing the variant updates spelling (color/colour), date order, and Siri’s voice defaults.">
        {ENGLISH_VARIANTS.map((e) => (
          <Row key={e.name} title={<span className="row gap6">{e.name}{e.new && <New27 />}</span>} onClick={() => { usePrefs.getState().setP({ langVariant: e.name }); os().showToast(`iPhone language: ${e.name}`) }} trailing={v === e.name ? <Check size={20} strokeWidth={2.6} className="stg-check" /> : <span style={{ width: 20 }} />} />
        ))}
      </List>
    </Sub>
  )
}

// ------------------------------------------------------------------ Date & Time
function DateTimePage() {
  const h24 = useOS((s) => s.h24)
  const prefs = usePrefs()
  const now = useNow(1000)
  return (
    <Sub title="Date & Time">
      <div className="stg-clock-card">
        <div className="stg-clock-big">{fmtClock(now, h24)}{!h24 && <span>{new Date(now).getHours() < 12 ? 'AM' : 'PM'}</span>}</div>
        <div className="secondary">{fmtDate(now, 'full')}</div>
      </div>
      <List footer="The status bar, Lock Screen, Clock and Calendar all follow this setting.">
        <Row title="24-Hour Time" toggle={{ value: h24, onChange: (v) => os().set({ h24: v }) }} />
      </List>
      <List>
        <Row title="Set Automatically" toggle={{ value: prefs.setAuto, onChange: (v) => prefs.setP({ setAuto: v }) }} />
        <Push title="Time Zone" detail={prefs.timeZone} page={() => <ChoicePage title="Time Zone" options={['Los Angeles', 'Denver', 'Chicago', 'New York', 'London', 'Seoul', 'Tokyo'] as const} use={() => [usePrefs((st) => st.timeZone) as 'Los Angeles', (v) => usePrefs.getState().setP({ timeZone: v })]} footer="The simulator clock follows your computer’s time; this is a display preference only." />} />
      </List>
    </Sub>
  )
}

// ------------------------------------------------------------------ iPhone Handoff (two iPhones, same number)
function HandoffPage() {
  const enabled = useOS((s) => s.iphoneHandoff)
  const [active, setActive] = useState<'personal' | 'work'>('personal')
  const [moving, setMoving] = useState(false)
  const [autoPick, setAutoPick] = useState(true)
  const switchTo = () => {
    if (!enabled || moving) return
    setMoving(true)
    window.setTimeout(() => {
      const next = active === 'personal' ? 'work' : 'personal'
      setActive(next)
      setMoving(false)
      os().flashIsland({ kind: 'generic', title: next === 'work' ? 'Line moved to Work iPhone' : 'Line moved to this iPhone', subtitle: '(555) 010-4417', duration: 2000, tint: '#34c759' })
    }, 1100)
  }
  const Phone = ({ id, name, model }: { id: 'personal' | 'work'; name: string; model: string }) => (
    <div className={`stg-ho-phone ${active === id ? 'active' : ''}`}>
      <div className="stg-ho-screen">
        <Smartphone size={34} strokeWidth={1.5} />
        {active === id && !moving && <span className="stg-ho-line anim-pop"><PhoneCall size={12} /> Active</span>}
      </div>
      <div className="t-subhead bold">{name}</div>
      <div className="t-caption1 secondary">{model}</div>
    </div>
  )
  return (
    <HeroPage title="iPhone Handoff" icon={<Ico c="#34c759" i={ArrowLeftRight} size={60} />} blurb={<>Use two iPhones with the same phone number and move calls, messages and your cellular line between them in one tap. <New27 /></>}>
      <List>
        <Row title="iPhone Handoff" toggle={{ value: enabled, onChange: (v) => os().set({ iphoneHandoff: v }) }} />
      </List>
      <List header="Your iPhones · (555) 010-4417" footer={enabled ? 'Calls and messages ring on the active iPhone. The other iPhone stays signed in and can take over instantly.' : 'Turn on iPhone Handoff to switch your line between these iPhones.'}>
        <div className={`stg-ho ${enabled ? '' : 'disabled'}`}>
          <Phone id="personal" name="Jamie’s iPhone" model="iPhone 18 Pro · This iPhone" />
          <div className={`stg-ho-token ${moving ? (active === 'personal' ? 'to-right' : 'to-left') : active === 'personal' ? 'left' : 'right'}`} aria-hidden><PhoneCall size={14} /></div>
          <Phone id="work" name="Jamie’s Work iPhone" model="iPhone 17" />
        </div>
        <div className="stg-pad">
          <Button block onClick={switchTo} disabled={!enabled || moving}>{moving ? 'Switching…' : `Switch to ${active === 'personal' ? 'Work iPhone' : 'This iPhone'}`}</Button>
        </div>
      </List>
      <List>
        <Row title="Switch When I Pick Up" subtitle="Move the line to whichever iPhone you unlock" toggle={{ value: autoPick && enabled, onChange: setAutoPick }} disabled={!enabled} />
      </List>
    </HeroPage>
  )
}

// ------------------------------------------------------------------ Feature availability
const AVAILABILITY: { title: string; icon: typeof Globe; color: string; items: string[] }[] = [
  { title: 'English Interface Variants', icon: Globe, color: '#007aff', items: ENGLISH_VARIANTS.filter((e) => e.new).map((e) => e.name) },
  { title: 'Call Recording Transcription', icon: PhoneCall, color: '#34c759', items: ['English', 'Spanish', 'French', 'German', 'Italian', 'Portuguese (Brazil)', 'Japanese', 'Korean', 'Mandarin Chinese', 'Cantonese'] },
  { title: 'Wallet Order Tracking', icon: ListChecks, color: '#1c1c1e', items: ['United States', 'Canada', 'United Kingdom', 'Australia', 'Japan', 'Germany', 'France', 'Mexico', 'Singapore'] },
  { title: 'FaceTime Live Captions', icon: Languages, color: '#34c759', items: ['English (US, UK, Canada, Australia, India)', 'Spanish', 'French', 'German', 'Japanese', 'Korean', 'Mandarin Chinese'] },
  { title: 'Keyboards: Indigenous Languages', icon: Keyboard, color: '#8e8e93', items: KEYBOARD_GROUPS[1].list },
  { title: 'Maps Guides & Visited Places', icon: Globe, color: '#ff9500', items: ['United States', 'Canada', 'United Kingdom', 'Australia', 'Japan', 'Germany', 'France', 'Italy', 'Spain', 'Ireland'] },
  { title: 'Reminders Suggestions', icon: ListChecks, color: '#ff9500', items: ['English', 'Spanish', 'French', 'German', 'Japanese', 'Portuguese', 'Chinese (Simplified)'] },
  { title: 'Natural-Language Time Formats', icon: CalendarClock, color: '#5856d6', items: ['“quarter past five” — English', '“en media hora” — Spanish', '“dans un quart d’heure” — French', '“halb sechs” — German', '“5時半” — Japanese'] },
  { title: 'Chinese & Japanese Typing Context', icon: Sparkles, color: '#ff2d55', items: ['Chinese – Simplified (Pinyin)', 'Chinese – Traditional (Zhuyin, Cangjie)', 'Japanese – Kana & Romaji'] },
  { title: 'Multilingual Typing', icon: Languages, color: '#007aff', items: ['English + Spanish', 'English + French', 'English + Hindi (Latin)', 'English + Korean', 'Spanish + Portuguese', 'Any three supported Latin-script languages'] },
]

function AvailabilityPage() {
  const region = useOS((s) => s.language.region)
  const [open, setOpen] = useState<string | null>(AVAILABILITY[0].title)
  const inRegion = (items: string[]) => items.some((i) => i.includes(region) || i.includes(region.split(' ')[0])) || !items.some((i) => REGIONS.includes(i))
  return (
    <HeroPage title="Feature Availability" icon={<Ico c="#0a84ff" i={ListChecks} size={60} />} blurb={<>Features newly available in more countries, regions and languages with iOS 27. Your region: <b>{region}</b>.</>}>
      {AVAILABILITY.map((a) => {
        const expanded = open === a.title
        return (
          <List key={a.title}>
            <Row
              icon={<Ico c={a.color} i={a.icon} />}
              title={a.title}
              subtitle={inRegion(a.items) ? 'Available for you' : `Not yet in ${region}`}
              detail={a.items.length}
              onClick={() => setOpen(expanded ? null : a.title)}
              trailing={<ChevronDown size={18} className={`stg-expand ${expanded ? 'open' : ''}`} />}
            />
            {expanded && a.items.map((i) => <Row key={i} compact title={<span className="t-subhead">{i}</span>} trailing={i.includes(region) ? <Check size={16} className="stg-check" /> : undefined} className="stg-sub-row anim-fade" />)}
          </List>
        )
      })}
      <Note>Availability lists are illustrative for this simulator.</Note>
    </HeroPage>
  )
}

// ------------------------------------------------------------------ Game controllers
const BUTTONS = ['A', 'B', 'X', 'Y', 'L1', 'R1', 'Menu'] as const
function GamesPage() {
  const games = useOS((s) => s.games)
  const gp = usePrefs((s) => s.gameControllerPrefs)
  const setGP = (patch: Partial<typeof gp>) => usePrefs.getState().setP({ gameControllerPrefs: { ...gp, ...patch } })
  const [map, setMap] = useState<Record<string, string>>({})
  const [edit, setEdit] = useState<string | null>(null)
  return (
    <HeroPage title="Game Controllers" icon={<Ico c="#8e8e93" i={Gamepad2} size={60} />} blurb={<>Customize controller buttons, haptics and the Game Overlay. <New27 /></>}>
      <List header="Connected">
        {games.controller ? (
          <Row icon={<span className="stg-dev-ico"><Gamepad2 size={18} /></span>} title={games.controller} subtitle="Connected · Battery 72%" detail="Disconnect" onClick={() => setGames({ controller: null })} />
        ) : (
          <>
            <Row title="No Controller Connected" subtitle="Pair one in Bluetooth, or connect a demo controller:" />
            {['DualSense', 'PlayStation Access', 'Xbox Wireless'].map((c) => <Row key={c} tint title={`Connect ${c}`} onClick={() => setGames({ controller: c })} />)}
          </>
        )}
      </List>
      {games.controller === 'PlayStation Access' && (
        <List header={<span className="row gap6">PlayStation Access controller <New27 /></span>} footer="The Access controller’s swappable button caps and stick can be mapped to any game input. Profiles sync across your devices.">
          <Row title="Accessibility Profile" detail="Profile 1 · One-handed" />
          <Row title="Swap Stick Side" toggle={{ value: gp.accessController, onChange: (v) => setGP({ accessController: v }) }} />
        </List>
      )}
      <List header="Game Overlay" footer="Press the Home button on your controller to open the overlay and navigate friends, achievements and settings without touching the screen.">
        <Row title="Game Overlay" toggle={{ value: games.overlay, onChange: (v) => setGames({ overlay: v }) }} />
        <Row title={<span className="row gap6">Navigate Overlay with Controller <New27 /></span>} toggle={{ value: gp.overlayNav && games.overlay, onChange: (v) => setGP({ overlayNav: v }) }} disabled={!games.overlay} />
      </List>
      <List header="Controller Settings">
        <Row title="Haptics" toggle={{ value: gp.haptics, onChange: (v) => setGP({ haptics: v }) }} />
        <Row title="Low-Latency Mode" toggle={{ value: gp.lowLatency, onChange: (v) => setGP({ lowLatency: v }) }} />
        <Row title="Custom Button Mapping" toggle={{ value: gp.remap, onChange: (v) => setGP({ remap: v }) }} />
        {gp.remap && BUTTONS.map((b) => <Row key={b} title={`Button ${b}`} detail={map[b] ?? b} chevron onClick={() => setEdit(b)} />)}
      </List>
      <List>
        <Row tint title="Open Games" onClick={() => os().launch('games')} />
      </List>
      <Sheet open={!!edit} onClose={() => setEdit(null)} detent="medium" title={`Map Button ${edit ?? ''}`}>
        <List>
          {BUTTONS.map((b) => <Row key={b} title={b} onClick={() => { setMap((m) => ({ ...m, [edit!]: b })); setEdit(null) }} trailing={(map[edit ?? ''] ?? edit) === b ? <Check size={20} className="stg-check" /> : undefined} />)}
        </List>
      </Sheet>
    </HeroPage>
  )
}

// ------------------------------------------------------------------ Transfer or Reset
function ResetPage() {
  const resetAll = useOS((s) => s.resetAll)
  return (
    <Sub title="Transfer or Reset iPhone">
      <div className="stg-reset-hero">
        <Smartphone size={60} strokeWidth={1.2} />
        <div className="t-title3">Prepare for New iPhone</div>
        <div className="secondary t-subhead">Make sure everything’s ready to transfer to a new iPhone, even if you don’t currently have enough iCloud storage to back up.</div>
      </div>
      <List>
        <Row
          tint
          title="Reset Settings App Preferences"
          onClick={() => showAlert({ title: 'Reset Settings Preferences?', message: 'Wi‑Fi networks, ringtone, Focus schedules and other Settings-only preferences go back to defaults.', actions: [{ label: 'Cancel', style: 'cancel' }, { label: 'Reset', style: 'destructive', onPress: () => { usePrefs.setState({ ...DEFAULT_PREFS }); os().showToast('Settings preferences reset') } }] })}
        />
        <Row
          tint
          title="Reset Location & Privacy"
          onClick={() => showAlert({ title: 'Reset Location & Privacy?', message: 'Apps will ask again before using your location, camera, photos and more.', actions: [{ label: 'Cancel', style: 'cancel' }, { label: 'Reset', style: 'destructive', onPress: () => { os().set({ permissions: {} }); os().showToast('Location & Privacy reset') } }] })}
        />
      </List>
      <List footer="Erases everything in this simulator — messages, photos, settings and demo progress — and restarts from the Lock Screen.">
        <Row
          destructive
          title="Reset All Simulator Data"
          onClick={() =>
            showAlert({
              title: 'Reset All Simulator Data?',
              message: 'This will erase all simulator data and settings and reload the page. This cannot be undone.',
              actions: [
                { label: 'Cancel', style: 'cancel' },
                { label: 'Erase & Restart', style: 'destructive', onPress: () => { try { localStorage.removeItem('ios27-settings'); localStorage.removeItem('ios27-passwords') } catch { /* ignore */ } resetAll() } },
              ],
            })
          }
        />
      </List>
    </Sub>
  )
}

export function registerGeneral() {
  Object.assign(ROUTES, {
    general: { title: 'General', el: () => <GeneralPage />, keywords: 'general about software update storage airdrop' },
    'general/about': { title: 'About', el: () => <AboutPage />, keywords: 'about ios version model serial capacity', parent: 'general' },
    'general/update': { title: 'Software Update', el: () => <UpdatePage />, keywords: 'software update ios 27 automatic', parent: 'general' },
    'general/storage': { title: 'iPhone Storage', el: () => <StoragePage />, keywords: 'storage offload apps space', parent: 'general' },
    'general/keyboard': { title: 'Keyboards', el: () => <KeyboardPage />, keywords: 'keyboard multilingual grammar autocorrect punctuation dictation emoji sticker indigenous chinese japanese', parent: 'general' },
    'general/language': { title: 'Language & Region', el: () => <LanguagePage />, keywords: 'language region english variants calendar temperature', parent: 'general' },
    'general/datetime': { title: 'Date & Time', el: () => <DateTimePage />, keywords: '24-hour time clock time zone', parent: 'general' },
    'general/handoff': { title: 'iPhone Handoff', el: () => <HandoffPage />, keywords: 'two iphones same phone number switch handoff work', parent: 'general' },
    'general/availability': { title: 'Feature Availability', el: () => <AvailabilityPage />, keywords: 'regional feature availability languages countries', parent: 'general' },
    'general/reset': { title: 'Transfer or Reset iPhone', el: () => <ResetPage />, keywords: 'reset erase transfer simulator data', parent: 'general' },
    'general/airdrop': { title: 'AirDrop', el: () => <AirDropPage />, keywords: 'airdrop receiving contacts everyone', parent: 'general' },
    games: { title: 'Game Controllers', el: () => <GamesPage />, keywords: 'game controller playstation access dualsense xbox game overlay', parent: 'general' },
  })
}
