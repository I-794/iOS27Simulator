import { useEffect, useRef, useState } from 'react'
import {
  Sun, SunDim, Moon, Droplets, LayoutGrid, Image as ImageIcon, Clock3, SlidersHorizontal, Check, Plus, Minus, BellOff, Flashlight, Camera, Mic, Search, ScanEye, Languages, Layers, PersonStanding,
  Wifi, Music2, RotateCcw, MonitorSmartphone, Volume2, Timer, Calculator, Circle, House, BatteryLow, Ear, ScanLine, Contrast, Tv, Eye, Link2, ChevronLeft, ChevronRight, Palette, Sparkles,
} from 'lucide-react'
import { List, Row } from '../../../ui/list'
import { Slider, Button, Chip, Segmented } from '../../../ui/controls'
import { Sheet } from '../../../ui/overlay'
import { useOS } from '../../../os/store'
import { useNow } from '../../../os/hooks'
import { fmtClock, fmtDate } from '../../../os/time'
import { Wallpaper, WALLPAPERS, wallpaperDef } from '../../../art/Wallpaper'
import { GenImage } from '../../../art/GenImage'
import { AppIconArt } from '../../../icons/AppIconArt'
import { LOCK_PROFILES } from '../../../shell/LockScreen'
import type { AppId } from '../../../os/types'
import { ROUTES, HeroPage, Sub, Ico, Go, Push, ChoicePage, usePrefs, New27, os } from '../common'

// ------------------------------------------------------------------ Display & Brightness
function MiniPhone({ dark, wallpaper }: { dark: boolean; wallpaper: string }) {
  return (
    <div className={`stg-mini-phone ${dark ? 'dark' : ''}`}>
      <Wallpaper id={wallpaper} dark={dark} />
      <div className="stg-mini-time">9:41</div>
      <div className="stg-mini-sheet">
        <i /><i /><i />
      </div>
    </div>
  )
}

const ACCENTS = [
  { id: 'blue', color: '#007aff' },
  { id: 'purple', color: '#af52de' },
  { id: 'pink', color: '#ff2d55' },
  { id: 'orange', color: '#ff9500' },
  { id: 'green', color: '#34c759' },
]

function DisplayPage() {
  const st = useOS()
  const [autoLock, setAutoLock] = useState<'30 seconds' | '1 minute' | '2 minutes' | '5 minutes' | 'Never'>('1 minute')
  const [raise, setRaise] = useState(true)
  const [aod, setAod] = useState(true)
  const [zoom, setZoom] = useState<'Default' | 'Larger Text'>('Default')
  return (
    <HeroPage title="Display & Brightness" icon={<Ico c="#007aff" i={Sun} size={60} />} blurb="Adjust brightness, switch between Light and Dark Mode, and tune how Liquid Glass looks across iPhone.">
      <List header="Appearance">
        <div className="stg-appearance">
          {(['light', 'dark'] as const).map((t) => (
            <button key={t} className="stg-appearance-opt" onClick={() => st.set({ theme: t })} aria-pressed={st.theme === t}>
              <MiniPhone dark={t === 'dark'} wallpaper={st.wallpaper} />
              <span>{t === 'light' ? 'Light' : 'Dark'}</span>
              <span className={`stg-radio ${st.theme === t ? 'on' : ''}`}>{st.theme === t && <Check size={12} strokeWidth={3.4} />}</span>
            </button>
          ))}
        </div>
        <Row title="Automatic" toggle={{ value: st.themeAuto, onChange: (v) => { st.set({ themeAuto: v }); if (v) { const h = new Date().getHours(); st.set({ theme: h >= 19 || h < 7 ? 'dark' : 'light' }) } } }} />
        {st.themeAuto && <Row title="Options" detail="Light Until Sunset" />}
      </List>
      <List>
        <Go icon={<Ico c="#5ac8fa" i={Layers} />} to="display/glass" title={<span className="row gap6">Liquid Glass</span>} detail={st.glassTint < 0.2 ? 'Clear' : st.glassTint > 0.75 ? 'Tinted' : 'Custom'} />
        <Push icon={<Ico c="#ff9500" i={Palette} />} title="Accent Color" detail={<span className="stg-dot" style={{ background: ACCENTS.find((a) => a.id === st.accent)?.color }} />} page={() => <AccentPage />} />
      </List>
      <List header="Text">
        <Go to="accessibility/textsize" title="Text Size" detail={`${Math.round(st.textScale * 100)}%`} />
        <Row title="Bold Text" toggle={{ value: st.boldText, onChange: (v) => st.set({ boldText: v }) }} />
      </List>
      <List header="Brightness" footer="True Tone automatically adapts iPhone display based on ambient lighting conditions to make colors appear consistent in different environments.">
        <div className="stg-pad"><Slider value={st.brightness} min={0.1} max={1} onChange={(v) => st.set({ brightness: v })} label="Brightness" left={<SunDim size={16} />} right={<Sun size={20} />} /></div>
        <Row title="True Tone" toggle={{ value: st.trueTone, onChange: (v) => st.set({ trueTone: v }) }} />
      </List>
      <List>
        <Row icon={<Ico c="#ff9500" i={Moon} fill />} title="Night Shift" toggle={{ value: st.nightShift, onChange: (v) => st.set({ nightShift: v }) }} />
        <Push title="Auto-Lock" detail={autoLock} page={() => <ChoicePage title="Auto-Lock" options={['30 seconds', '1 minute', '2 minutes', '5 minutes', 'Never'] as const} use={() => [autoLock, setAutoLock]} />} />
        <Row title="Raise to Wake" toggle={{ value: raise, onChange: setRaise }} />
        <Row title="Always On Display" toggle={{ value: aod, onChange: setAod }} />
      </List>
      <List header="Display Zoom" footer="Choose a view for iPhone. Larger Text shows larger controls. Default shows more content.">
        <div className="stg-pad"><Segmented options={['Default', 'Larger Text'] as const} value={zoom} onChange={(v) => { setZoom(v); os().set({ textScale: v === 'Default' ? 1 : 1.12 }) }} /></div>
      </List>
    </HeroPage>
  )
}

function AccentPage() {
  const accent = useOS((s) => s.accent)
  return (
    <Sub title="Accent Color">
      <List footer="Buttons, switches and links across the simulator use your accent color.">
        <div className="stg-swatches">
          {ACCENTS.map((a) => (
            <button key={a.id} className={`stg-swatch ${accent === a.id ? 'on' : ''}`} style={{ background: a.color }} onClick={() => os().set({ accent: a.id })} aria-label={a.id} aria-pressed={accent === a.id}>
              {accent === a.id && <Check size={18} strokeWidth={3} color="#fff" />}
            </button>
          ))}
        </div>
        <div className="stg-pad row gap8"><Button size="small">Filled</Button><Button size="small" variant="tinted">Tinted</Button><span className="accent t-subhead">Link</span></div>
      </List>
    </Sub>
  )
}

// ------------------------------------------------------------------ Liquid Glass (iOS 27)
const PREVIEW_APPS: AppId[] = ['messages', 'photos', 'camera', 'weather', 'maps', 'notes', 'music', 'settings']
const GLASS_PRESETS = [
  { label: 'Clear', v: 0 },
  { label: 'Balanced', v: 0.35 },
  { label: 'Frosted', v: 0.65 },
  { label: 'Tinted', v: 1 },
]

export function GlassPreview({ compact }: { compact?: boolean }) {
  const theme = useOS((s) => s.theme)
  const wallpaper = useOS((s) => s.wallpaper)
  const iconStyle = useOS((s) => s.iconStyle)
  const tint = useOS((s) => s.iconTint)
  const now = useNow()
  return (
    <div className={`stg-glass-preview ${compact ? 'compact' : ''}`} aria-label="Liquid Glass preview">
      <Wallpaper id={wallpaper} dark={theme === 'dark'} />
      <div className="stg-gp-status"><span>{fmtClock(now)}</span></div>
      <div className="glass stg-gp-notif">
        <AppIconArt app="messages" size={26} style={iconStyle} tint={tint} />
        <div className="grow">
          <div className="row" style={{ justifyContent: 'space-between' }}><b>Alex Rivera</b><span className="secondary">now</span></div>
          <div className="nowrap">Robotics build moved to 6:30 🤖</div>
        </div>
      </div>
      <div className="stg-gp-grid">
        {PREVIEW_APPS.map((a) => <AppIconArt key={a} app={a} size={38} style={iconStyle} tint={tint} />)}
      </div>
      <div className="glass stg-gp-search"><Search size={11} /> Search</div>
      <div className="glass stg-gp-dock">
        {(['phone', 'safari', 'messages', 'music'] as AppId[]).map((a) => <AppIconArt key={a} app={a} size={38} style={iconStyle} tint={tint} />)}
      </div>
    </div>
  )
}

function GlassPage() {
  const tint = useOS((s) => s.glassTint)
  const rt = useOS((s) => s.reduceTransparency)
  const ic = useOS((s) => s.increaseContrast)
  const label = tint < 0.12 ? 'Clear' : tint > 0.88 ? 'Tinted' : `${Math.round(tint * 100)}% Tint`
  return (
    <Sub title="Liquid Glass">
      <div className="stg-glass-wrap">
        <GlassPreview />
      </div>
      <List header={<span className="row gap6">Appearance <New27 /></span>} footer="Clear lets more of your wallpaper and content shine through. Tinted adds opacity and contrast to buttons, bars, notifications and the dock. Changes apply everywhere instantly.">
        <div className="stg-glass-slider">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span className="t-subhead secondary">Clear</span>
            <span className="t-subhead bold">{label}</span>
            <span className="t-subhead secondary">Tinted</span>
          </div>
          <Slider value={tint} onChange={(v) => os().set({ glassTint: v })} label="Liquid Glass tint" left={<Droplets size={18} />} right={<Layers size={18} />} />
          <div className="row gap8 stg-chips" style={{ justifyContent: 'center' }}>
            {GLASS_PRESETS.map((p) => <Chip key={p.label} active={Math.abs(tint - p.v) < 0.02} onClick={() => os().set({ glassTint: p.v })}>{p.label}</Chip>)}
          </div>
        </div>
      </List>
      <List footer={rt ? 'Reduce Transparency is on, so Liquid Glass is replaced by solid materials.' : ic ? 'Increase Contrast is on, which overrides tint to maximum.' : undefined}>
        <Row title="Reduce Transparency" toggle={{ value: rt, onChange: (v) => os().set({ reduceTransparency: v }) }} />
        <Row title="Increase Contrast" toggle={{ value: ic, onChange: (v) => os().set({ increaseContrast: v }) }} />
      </List>
    </Sub>
  )
}

// ------------------------------------------------------------------ Home Screen & App Library
const ICON_STYLES = ['default', 'dark', 'clear', 'tinted'] as const
const TINTS = ['#6aa9ff', '#ff9f0a', '#34c759', '#ff375f', '#bf5af2', '#ffd60a', '#64d2ff', '#ffffff']
function HomeScreenPage() {
  const st = useOS()
  const prefs = usePrefs()
  return (
    <HeroPage title="Home Screen & App Library" icon={<Ico c="#5856d6" i={LayoutGrid} size={60} />} blurb="Choose icon appearance, size and where new apps go.">
      <List header="Icon Appearance">
        <div className="stg-iconstyles">
          {ICON_STYLES.map((s) => (
            <button key={s} className={`stg-iconstyle ${st.iconStyle === s ? 'on' : ''}`} onClick={() => st.set({ iconStyle: s })} aria-pressed={st.iconStyle === s}>
              <div className={`stg-iconstyle-prev ${s}`}>
                {(['photos', 'messages', 'weather', 'music'] as AppId[]).map((a) => <AppIconArt key={a} app={a} size={28} style={s} tint={st.iconTint} />)}
              </div>
              <span>{s[0].toUpperCase() + s.slice(1)}</span>
            </button>
          ))}
        </div>
        {st.iconStyle === 'tinted' && (
          <div className="stg-swatches small">
            {TINTS.map((c) => (
              <button key={c} className={`stg-swatch ${st.iconTint === c ? 'on' : ''}`} style={{ background: c }} onClick={() => st.set({ iconTint: c })} aria-label={`Tint ${c}`}>
                {st.iconTint === c && <Check size={14} strokeWidth={3} color={c === '#ffffff' ? '#000' : '#fff'} />}
              </button>
            ))}
          </div>
        )}
        <Row title="Large Icons" subtitle="Hide app names and enlarge icons" toggle={{ value: st.largeIcons, onChange: (v) => st.set({ largeIcons: v }) }} />
      </List>
      <List header="Newly Downloaded Apps">
        {(['Add to Home Screen', 'App Library Only'] as const).map((o) => (
          <Row key={o} title={o} onClick={() => prefs.setP({ showInAppLibrary: o })} trailing={prefs.showInAppLibrary === o ? <Check size={20} className="stg-check" /> : <span style={{ width: 20 }} />} />
        ))}
      </List>
      <List header="Notification Badges">
        <Row title="Show in App Library" toggle={{ value: prefs.appLibraryBadges, onChange: (v) => prefs.setP({ appLibraryBadges: v }) }} />
      </List>
      <List>
        <Row tint title="Edit Home Screen" onClick={() => { st.goHome(); window.setTimeout(() => os().set({ editingHome: true }), 350) }} />
      </List>
    </HeroPage>
  )
}

// ------------------------------------------------------------------ Wallpaper
const SAMPLE_GENS = [
  { id: 'gen:sample-astronaut', label: 'Astronaut Biscuit' },
  { id: 'gen:sample-city', label: 'Neon City' },
  { id: 'gen:sample-garden', label: 'Garden at Dawn' },
]

function WallpaperThumb({ id, onClick, selected, label }: { id: string; onClick: () => void; selected: boolean; label?: string }) {
  const theme = useOS((s) => s.theme)
  return (
    <button className={`stg-wp-thumb ${selected ? 'on' : ''}`} onClick={onClick} aria-label={label ?? wallpaperDef(id).name} aria-pressed={selected}>
      <div className="stg-wp-img"><Wallpaper id={id} dark={theme === 'dark'} /></div>
      <span>{label ?? wallpaperDef(id).name}</span>
    </button>
  )
}

function WallpaperPage() {
  const st = useOS()
  const now = useNow()
  const [gallery, setGallery] = useState(false)
  const [tab, setTab] = useState<'Collections' | 'Photos' | 'Playground'>('Collections')
  const gens = st.imageGens
  const photos = st.photos.filter((p) => p.kind !== 'screenshot' && !p.idDocument).slice(0, 12)
  const pick = (id: string) => {
    st.set({ wallpaper: id })
    setGallery(false)
    st.showToast('Wallpaper set')
  }
  const font: Record<string, React.CSSProperties> = { bold: { fontWeight: 700 }, rounded: { fontFamily: 'var(--font-rounded)', fontWeight: 600 }, serif: { fontFamily: "'New York', Georgia, serif", fontWeight: 500 }, stencil: { fontWeight: 200 } }
  return (
    <HeroPage title="Wallpaper" icon={<Ico c="#32ade6" i={ImageIcon} size={60} />} blurb="Choose Lock Screen and Home Screen wallpapers, and switch between Lock Screen profiles.">
      <List header="Current Wallpaper">
        <div className="stg-wp-pair">
          <div className="stg-wp-phone">
            <Wallpaper id={st.wallpaper} dark={st.theme === 'dark'} />
            <div className="stg-wp-lock-date">{fmtDate(now, 'weekday')}</div>
            <div className="stg-wp-lock-time" style={{ color: st.lockClockColor, top: st.lockClockPosition === 'top' ? 22 : 34, ...font[st.lockClockStyle] }}>{fmtClock(now, st.h24)}</div>
            <div className="stg-wp-caption">Lock Screen</div>
          </div>
          <div className="stg-wp-phone">
            <Wallpaper id={st.wallpaper} dark={st.theme === 'dark'} blur={st.theme === 'dark' ? 0 : 0} />
            <div className="stg-wp-home-grid">{(['messages', 'photos', 'camera', 'weather', 'maps', 'notes', 'clock', 'music'] as AppId[]).map((a) => <AppIconArt key={a} app={a} size={20} style={st.iconStyle} tint={st.iconTint} />)}</div>
            <div className="glass stg-wp-dock" />
            <div className="stg-wp-caption">Home Screen</div>
          </div>
        </div>
        <div className="stg-pad"><Button block variant="tinted" onClick={() => setGallery(true)}><Plus size={18} /> Add New Wallpaper</Button></div>
      </List>
      <List header="Lock Screen Profiles" footer="Switch profiles from the Lock Screen by touching and holding.">
        <div className="stg-profiles">
          {LOCK_PROFILES.map((p) => (
            <button
              key={p.name}
              className={`stg-profile ${st.lockProfile === p.name ? 'on' : ''}`}
              onClick={() => st.set({ lockProfile: p.name, wallpaper: p.wallpaper, lockClockStyle: p.clockStyle, lockClockColor: p.clockColor, lockClockPosition: p.position })}
              aria-pressed={st.lockProfile === p.name}
            >
              <div className="stg-profile-img">
                <Wallpaper id={p.wallpaper} dark={st.theme === 'dark'} />
                <span style={{ color: p.clockColor, top: p.position === 'top' ? 10 : 22, ...font[p.clockStyle] }}>{fmtClock(now, st.h24)}</span>
              </div>
              <span>{p.name}</span>
            </button>
          ))}
        </div>
      </List>
      <List header="Clock Style">
        <div className="stg-pad"><Segmented options={['bold', 'rounded', 'serif', 'stencil'] as const} value={st.lockClockStyle} onChange={(v) => st.set({ lockClockStyle: v })} labels={{ bold: 'Bold', rounded: 'Rounded', serif: 'Serif', stencil: 'Thin' }} /></div>
        <div className="stg-swatches small">
          {['#ffffff', '#fff4e0', '#c9c3ff', '#d4fff0', '#ffd60a', '#ff9f0a'].map((c) => (
            <button key={c} className={`stg-swatch ${st.lockClockColor === c ? 'on' : ''}`} style={{ background: c }} onClick={() => st.set({ lockClockColor: c })} aria-label={`Clock color ${c}`}>{st.lockClockColor === c && <Check size={14} strokeWidth={3} color="#000" />}</button>
          ))}
        </div>
        <Row title="Clock at Top" toggle={{ value: st.lockClockPosition === 'top', onChange: (v) => st.set({ lockClockPosition: v ? 'top' : 'center' }) }} />
      </List>
      <Sheet open={gallery} onClose={() => setGallery(false)} title="Add New Wallpaper">
        <div className="stg-pad"><Segmented options={['Collections', 'Photos', 'Playground'] as const} value={tab} onChange={setTab} labels={{ Playground: 'Image Playground' }} /></div>
        <div className="stg-wp-grid">
          {tab === 'Collections' && WALLPAPERS.map((w) => <WallpaperThumb key={w.id} id={w.id} selected={st.wallpaper === w.id} onClick={() => pick(w.id)} />)}
          {tab === 'Photos' && photos.map((p) => <WallpaperThumb key={p.id} id={`scene:${p.scene}`} label={p.place ?? 'Photo'} selected={st.wallpaper === `scene:${p.scene}`} onClick={() => pick(`scene:${p.scene}`)} />)}
          {tab === 'Playground' && (
            <>
              {gens.map((g) => <WallpaperThumb key={g.id} id={`gen:${g.id}`} label={g.prompt.slice(0, 22)} selected={st.wallpaper === `gen:${g.id}`} onClick={() => pick(`gen:${g.id}`)} />)}
              {SAMPLE_GENS.map((g) => (
                <button key={g.id} className={`stg-wp-thumb ${st.wallpaper === g.id ? 'on' : ''}`} onClick={() => pick(g.id)} aria-label={g.label}>
                  <div className="stg-wp-img"><GenImage seed={g.id.slice(4)} prompt={g.label} style={{ width: '100%', height: '100%' }} /></div>
                  <span>{g.label}</span>
                </button>
              ))}
            </>
          )}
        </div>
        {tab === 'Playground' && <div className="stg-pad"><Button block variant="gray" onClick={() => { setGallery(false); os().launch('playground') }}><Sparkles size={16} /> Create in Image Playground</Button></div>}
        <div style={{ height: 30 }} />
      </Sheet>
    </HeroPage>
  )
}

// ------------------------------------------------------------------ StandBy
function StandByPage() {
  const prefs = usePrefs()
  const now = useNow()
  const [notif, setNotif] = useState(true)
  return (
    <HeroPage title="StandBy" icon={<Ico c="#1c1c1e" i={Clock3} size={60} />} blurb="Turn iPhone on its side while charging to see a full-screen clock, widgets and photos.">
      <div className={`stg-standby ${prefs.standbyNight ? 'night' : ''}`}>
        <div className="stg-standby-clock">{fmtClock(now).replace(/ ?[AP]M/, '')}</div>
        <div className="stg-standby-side"><div>{fmtDate(now, 'weekday')}</div><div className="big">{new Date(now).getDate()}</div></div>
      </div>
      <List>
        <Row title="StandBy" toggle={{ value: prefs.standby, onChange: (v) => prefs.setP({ standby: v }) }} />
      </List>
      {prefs.standby && (
        <List header="Display">
          <Row title="Always On" toggle={{ value: prefs.standbyAlwaysOn, onChange: (v) => prefs.setP({ standbyAlwaysOn: v }) }} />
          <Row title="Night Mode" subtitle="Tints the display red in low light" toggle={{ value: prefs.standbyNight, onChange: (v) => prefs.setP({ standbyNight: v }) }} />
          <Row title="Show Notifications" toggle={{ value: notif, onChange: setNotif }} />
        </List>
      )}
    </HeroPage>
  )
}

// ------------------------------------------------------------------ Control Center customization
export const CC_CONTROLS: { id: string; name: string; icon: typeof Sun }[] = [
  { id: 'connectivity', name: 'Connectivity', icon: Wifi },
  { id: 'media', name: 'Now Playing', icon: Music2 },
  { id: 'orientation', name: 'Orientation Lock', icon: RotateCcw },
  { id: 'mirror', name: 'Screen Mirroring', icon: MonitorSmartphone },
  { id: 'focus', name: 'Focus', icon: Moon },
  { id: 'brightness', name: 'Brightness', icon: Sun },
  { id: 'volume', name: 'Volume', icon: Volume2 },
  { id: 'flashlight', name: 'Flashlight', icon: Flashlight },
  { id: 'timer', name: 'Timer', icon: Timer },
  { id: 'calculator', name: 'Calculator', icon: Calculator },
  { id: 'camera', name: 'Camera', icon: Camera },
  { id: 'record', name: 'Screen Recording', icon: Circle },
  { id: 'home', name: 'Home', icon: House },
  { id: 'lowpower', name: 'Low Power Mode', icon: BatteryLow },
  { id: 'hearing', name: 'Hearing', icon: Ear },
  { id: 'scan', name: 'Code Scanner', icon: ScanLine },
  { id: 'dark', name: 'Dark Mode', icon: Contrast },
  { id: 'airplay-tv', name: 'Apple TV Remote', icon: Tv },
  { id: 'siri', name: 'Siri', icon: Mic },
  { id: 'nightshift', name: 'Night Shift', icon: SunDim },
  { id: 'magnifier', name: 'Magnifier', icon: Eye },
  { id: 'hotspot', name: 'Personal Hotspot', icon: Link2 },
]
const DEFAULT_CC = ['connectivity', 'media', 'orientation', 'mirror', 'focus', 'brightness', 'volume', 'flashlight', 'timer', 'calculator', 'camera', 'record', 'home', 'lowpower', 'hearing', 'scan', 'dark', 'airplay-tv']

function ControlsPage() {
  const controls = useOS((s) => s.controls)
  const [inApps, setInApps] = useState(true)
  const included = controls.map((id) => CC_CONTROLS.find((c) => c.id === id)).filter(Boolean) as typeof CC_CONTROLS
  const more = CC_CONTROLS.filter((c) => !controls.includes(c.id))
  const move = (id: string, dir: -1 | 1) => {
    const i = controls.indexOf(id)
    const j = i + dir
    if (j < 0 || j >= controls.length) return
    const next = [...controls]
    ;[next[i], next[j]] = [next[j], next[i]]
    os().set({ controls: next })
  }
  return (
    <HeroPage title="Control Center" icon={<Ico c="#8e8e93" i={SlidersHorizontal} size={60} />} blurb="Swipe down from the top-right corner to open Control Center. Add, remove and reorder controls here or by touching and holding in Control Center.">
      <List footer="Swipe down from the top-right edge while using an app to open Control Center.">
        <Row title="Access Within Apps" toggle={{ value: inApps, onChange: setInApps }} />
        <Row tint title="Open Control Center" onClick={() => os().setOverlay('cc')} />
      </List>
      <List header="Included Controls">
        {included.map((c, i) => (
          <Row
            key={c.id}
            icon={<button className="stg-cc-btn remove" aria-label={`Remove ${c.name}`} onClick={() => os().set({ controls: controls.filter((x) => x !== c.id) })}><Minus size={14} strokeWidth={3.4} /></button>}
            title={<span className="row gap8"><c.icon size={18} className="secondary" />{c.name}</span>}
            trailing={
              <span className="row gap4">
                <button className="stg-move" aria-label={`Move ${c.name} up`} disabled={i === 0} onClick={() => move(c.id, -1)}>▲</button>
                <button className="stg-move" aria-label={`Move ${c.name} down`} disabled={i === included.length - 1} onClick={() => move(c.id, 1)}>▼</button>
              </span>
            }
          />
        ))}
      </List>
      {more.length > 0 && (
        <List header="More Controls">
          {more.map((c) => (
            <Row key={c.id} icon={<span className="stg-cc-btn add" aria-hidden><Plus size={14} strokeWidth={3.4} /></span>} label={`Add ${c.name}`} title={<span className="row gap8"><c.icon size={18} className="secondary" />{c.name}</span>} onClick={() => os().set({ controls: [...controls, c.id] })} />
          ))}
        </List>
      )}
      <List>
        <Row tint title="Reset Control Center" onClick={() => os().set({ controls: DEFAULT_CC })} />
      </List>
    </HeroPage>
  )
}

// ------------------------------------------------------------------ Action Button
type ActionId = ReturnType<typeof os>['actionButton']
const ACTIONS: { id: ActionId; name: string; icon: typeof Sun; color: string; desc: string }[] = [
  { id: 'silent', name: 'Silent Mode', icon: BellOff, color: '#ff3b30', desc: 'Switch between Silent and Ring for calls and alerts.' },
  { id: 'focus' as ActionId, name: 'Focus', icon: Moon, color: '#5856d6', desc: 'Turn a Focus on or off.' },
  { id: 'camera', name: 'Camera', icon: Camera, color: '#8e8e93', desc: 'Open Camera to quickly capture a moment.' },
  { id: 'visual-intelligence', name: 'Visual Intelligence', icon: ScanEye, color: '#bf5af2', desc: 'Learn about the objects and places around you.' },
  { id: 'flashlight', name: 'Flashlight', icon: Flashlight, color: '#ffcc00', desc: 'Turn on extra light when you need it.' },
  { id: 'siri', name: 'Siri', icon: Mic, color: '#0a84ff', desc: 'Talk to Siri — hands free.' },
  { id: 'translate', name: 'Translate', icon: Languages, color: '#34c759', desc: 'Translate phrases or have a conversation with someone in another language.' },
  { id: 'magnifier', name: 'Magnifier', icon: Search, color: '#1c1c1e', desc: 'Magnify text and objects around you.' },
  { id: 'shortcut', name: 'Shortcut', icon: Layers, color: '#ff2d55', desc: 'Run a shortcut you choose.' },
  { id: 'accessibility', name: 'Accessibility', icon: PersonStanding, color: '#007aff', desc: 'Quickly use an accessibility feature (VoiceOver).' },
]
const ACTION_LIST = ACTIONS.filter((a) => (a.id as string) !== 'focus')

function ActionButtonPage() {
  const action = useOS((s) => s.actionButton)
  const shortcuts = useOS((s) => s.shortcuts)
  const chosen = usePrefs((s) => s.actionShortcut)
  const strip = useRef<HTMLDivElement>(null)
  const idx = Math.max(0, ACTION_LIST.findIndex((a) => a.id === action))
  const [pressed, setPressed] = useState(false)
  useEffect(() => {
    const el = strip.current?.children[idx] as HTMLElement | undefined
    el?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
  }, [idx])
  const choose = (i: number) => os().set({ actionButton: ACTION_LIST[(i + ACTION_LIST.length) % ACTION_LIST.length].id })
  const cur = ACTION_LIST[idx]
  return (
    <Sub title="Action Button">
      <div className="stg-ab">
        <div className="stg-ab-phone">
          <span className={`stg-ab-button ${pressed ? 'pressed' : ''}`} />
          <div className="stg-ab-ico" style={{ background: cur.color }}><cur.icon size={40} color="#fff" /></div>
        </div>
        <div className="stg-ab-carousel">
          <button className="stg-ab-arrow" aria-label="Previous action" onClick={() => choose(idx - 1)}><ChevronLeft size={22} /></button>
          <div className="stg-ab-strip" ref={strip}>
            {ACTION_LIST.map((a, i) => (
              <button key={a.id} className={`stg-ab-card ${i === idx ? 'on' : ''}`} onClick={() => choose(i)} aria-pressed={i === idx}>
                <span className="stg-ab-card-ico" style={{ background: i === idx ? a.color : undefined }}><a.icon size={22} /></span>
                <span>{a.name}</span>
              </button>
            ))}
          </div>
          <button className="stg-ab-arrow" aria-label="Next action" onClick={() => choose(idx + 1)}><ChevronRight size={22} /></button>
        </div>
        <div className="stg-ab-dots">{ACTION_LIST.map((a, i) => <i key={a.id} className={i === idx ? 'on' : ''} />)}</div>
        <div className="t-title3 center">{cur.name}</div>
        <div className="secondary center t-subhead" style={{ padding: '4px 24px 12px' }}>{cur.desc}</div>
      </div>
      {action === 'shortcut' && (
        <List header="Shortcut">
          {shortcuts.map((s) => (
            <Row key={s.id} icon={<span className="settings-icon" style={{ background: s.color }}><Layers size={16} color="#fff" /></span>} title={s.name} onClick={() => usePrefs.getState().setP({ actionShortcut: s.id })} trailing={chosen === s.id ? <Check size={20} className="stg-check" /> : <span style={{ width: 20 }} />} />
          ))}
        </List>
      )}
      <List footer="Press and hold the Action Button on the side of the simulated iPhone (or press ⌥A) to run it.">
        <Row
          tint
          title="Try It"
          onClick={() => {
            setPressed(true)
            window.setTimeout(() => setPressed(false), 400)
            void import('../../../shell/actions').then((m) => m.pressAction())
          }}
        />
      </List>
    </Sub>
  )
}

export function registerDisplay() {
  Object.assign(ROUTES, {
    display: { title: 'Display & Brightness', el: () => <DisplayPage />, keywords: 'display brightness dark mode light appearance text size bold true tone night shift auto-lock accent' },
    'display/glass': { title: 'Liquid Glass', el: () => <GlassPage />, keywords: 'liquid glass transparency tint clear tinted translucency', parent: 'display' },
    'display/accent': { title: 'Accent Color', el: () => <AccentPage />, keywords: 'accent color tint', parent: 'display' },
    homescreen: { title: 'Home Screen & App Library', el: () => <HomeScreenPage />, keywords: 'home screen app library icons dark tinted clear large badges' },
    wallpaper: { title: 'Wallpaper', el: () => <WallpaperPage />, keywords: 'wallpaper background lock screen home screen profiles clock style image playground' },
    standby: { title: 'StandBy', el: () => <StandByPage />, keywords: 'standby night mode always on charging clock' },
    controls: { title: 'Control Center', el: () => <ControlsPage />, keywords: 'control center controls gallery customize add remove' },
    'action-button': { title: 'Action Button', el: () => <ActionButtonPage />, keywords: 'action button silent flashlight camera shortcut translate visual intelligence' },
  })
}

