/* Shared building blocks for the Settings app: route registry, icon squares,
 * hero headers, choice pages and a small persisted store for settings that
 * only matter inside Settings (the OS-wide ones live in the central store). */
import { type ReactNode, type ComponentType } from 'react'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { Check, ChevronRight } from 'lucide-react'
import { useNav, Page } from '../../ui/nav'
import { List, Row, SettingsIcon, type RowProps } from '../../ui/list'
import { Switch } from '../../ui/controls'
import { useOS } from '../../os/store'

// ---------------------------------------------------------------- route registry
export interface RouteDef {
  title: string
  el: () => ReactNode
  keywords?: string
  /** parent route used for breadcrumbs in search + deep-link stacks */
  parent?: string
  icon?: ReactNode
}

/** Filled in by index.tsx once every page module has loaded (avoids import cycles). */
export const ROUTES: Record<string, RouteDef> = {}

export function useGo() {
  const nav = useNav()
  return (route: string) => {
    const def = ROUTES[route]
    if (def) nav.push(def.el(), `${route}-${Date.now()}`)
  }
}

// ---------------------------------------------------------------- icons
type LucideLike = ComponentType<{ size?: number; strokeWidth?: number; color?: string; fill?: string }>

export function Ico({ c, i: I, fill, size = 30 }: { c: string; i: LucideLike; fill?: boolean; size?: number }) {
  return (
    <SettingsIcon color={c} size={size}>
      <I size={Math.round(size * 0.62)} strokeWidth={2.2} color="#fff" fill={fill ? '#fff' : 'none'} />
    </SettingsIcon>
  )
}

/** Navigation row to a registered route. */
export function Go({ to, title, icon, detail, subtitle }: { to: string; title?: ReactNode; icon?: ReactNode; detail?: ReactNode; subtitle?: ReactNode }) {
  const go = useGo()
  return <Row title={title ?? ROUTES[to]?.title ?? to} icon={icon} detail={detail} subtitle={subtitle} chevron onClick={() => go(to)} />
}

/** Push an arbitrary page element. */
export function Push({ title, icon, detail, subtitle, page, tint }: { title: ReactNode; icon?: ReactNode; detail?: ReactNode; subtitle?: ReactNode; page: () => ReactNode; tint?: boolean }) {
  const nav = useNav()
  return <Row title={title} icon={icon} detail={detail} subtitle={subtitle} tint={tint} chevron={!tint} onClick={() => nav.push(page())} />
}

/** Like Row, but rendered as a div[role=button] so it can contain trailing buttons (no nested <button>). */
export function XRow({ title, subtitle, detail, icon, chevron, onClick, toggle, trailing, destructive, tint, compact, style, className = '', label, disabled }: RowProps) {
  const cls = `row-item pressable-row ${icon ? 'has-icon' : ''} ${destructive ? 'destructive' : ''} ${tint ? 'tint' : ''} ${compact ? 'compact' : ''} ${className}`
  return (
    <div
      className={cls}
      style={style}
      role="button"
      tabIndex={0}
      aria-label={label}
      aria-disabled={disabled}
      onClick={() => !disabled && onClick?.()}
      onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) { e.preventDefault(); onClick?.() } }}
    >
      {icon}
      <span className="row-main">
        <span className="row-title">{title}</span>
        {subtitle && <span className="row-sub">{subtitle}</span>}
      </span>
      {detail !== undefined && <span className="row-detail">{detail}</span>}
      {trailing}
      {toggle && <Switch checked={toggle.value} onChange={toggle.onChange} color={toggle.color} label={typeof title === 'string' ? title : label} disabled={disabled} />}
      {chevron && <ChevronRight className="chev" size={18} strokeWidth={2.6} />}
    </div>
  )
}

// ---------------------------------------------------------------- page shells
/** iOS 18+ top-level settings page: inline title appears after scrolling past the hero card. */
export function HeroPage({ title, icon, blurb, children, trailing }: { title: string; icon: ReactNode; blurb: ReactNode; children: ReactNode; trailing?: ReactNode }) {
  return (
    <Page grouped inlineTitle={title} trailing={trailing}>
      <div className="list stg-hero">
        <div className="stg-hero-icon">{icon}</div>
        <div className="stg-hero-title">{title}</div>
        <div className="stg-hero-blurb">{blurb}</div>
      </div>
      {children}
    </Page>
  )
}

export function Sub({ title, children, trailing, large = false }: { title: string; children: ReactNode; trailing?: ReactNode; large?: boolean }) {
  return (
    <Page grouped title={title} large={large} trailing={trailing}>
      <div style={{ height: large ? 0 : 12 }} />
      {children}
    </Page>
  )
}

/** A list of options with a checkmark (UITableView "choice" pattern). */
export function Choices<T extends string>({ options, value, onChange, labels, subtitles, header, footer }: { options: readonly T[]; value: T; onChange: (v: T) => void; labels?: Partial<Record<T, ReactNode>>; subtitles?: Partial<Record<T, ReactNode>>; header?: ReactNode; footer?: ReactNode }) {
  return (
    <List header={header} footer={footer}>
      {options.map((o) => (
        <Row key={o} title={labels?.[o] ?? o} subtitle={subtitles?.[o]} onClick={() => onChange(o)} trailing={o === value ? <Check size={20} strokeWidth={2.6} className="stg-check" /> : <span style={{ width: 20 }} />} />
      ))}
    </List>
  )
}

/** Pushed page with a checkmark list. `use` is a hook returning [value, setter] so the page stays live. */
export function ChoicePage<T extends string>({ title, options, use, labels, subtitles, footer, header }: { title: string; options: readonly T[]; use: () => [T, (v: T) => void]; labels?: Partial<Record<T, ReactNode>>; subtitles?: Partial<Record<T, ReactNode>>; footer?: ReactNode; header?: ReactNode }) {
  const [value, onChange] = use()
  return (
    <Sub title={title}>
      <Choices options={options} value={value} onChange={onChange} labels={labels} subtitles={subtitles} footer={footer} header={header} />
    </Sub>
  )
}

/** Hook factory for a top-level prefs key. */
export function usePref<K extends keyof SettingsPrefs>(key: K): [SettingsPrefs[K], (v: SettingsPrefs[K]) => void] {
  const v = usePrefs((s) => s[key])
  return [v, (nv) => usePrefs.getState().setP({ [key]: nv } as Partial<SettingsPrefs>)]
}

/** Small "Learn more…" style link text. */
export const Learn = ({ children = 'Learn more…', onClick }: { children?: ReactNode; onClick?: () => void }) => (
  <button className="stg-link" onClick={onClick}>{children}</button>
)

export function Note({ children, ai }: { children: ReactNode; ai?: boolean }) {
  return <div className={`stg-note ${ai ? 'ai' : ''}`}>{children}</div>
}

/** Badge shown next to features introduced in iOS 27. */
export const New27 = () => <span className="stg-new">iOS 27</span>

// ---------------------------------------------------------------- Settings-local persisted prefs
export interface SettingsPrefs {
  notifSummaries: boolean
  notifPreviews: 'Always' | 'When Unlocked' | 'Never'
  notifDisplay: 'Count' | 'Stack' | 'List'
  appNotifs: Record<string, boolean>
  ringtone: string
  textTone: string
  haptics: 'Always Play' | 'Play in Silent Mode' | "Don't Play in Silent Mode" | 'Never Play'
  keyboardClicks: boolean
  lockSound: boolean
  changeWithButtons: boolean
  btPowerMgmt: boolean
  knownNetworks: string[]
  askToJoin: 'Off' | 'Notify' | 'Ask'
  autoHotspot: 'Never' | 'Ask to Join' | 'Automatic'
  hotspotFamily: boolean
  hotspotMax: boolean
  dataMode: 'Allow More Data on 5G' | 'Standard' | 'Low Data Mode'
  voiceData: '5G Auto' | '5G On' | 'LTE'
  dataRoaming: boolean
  recoveryContacts: string[]
  recoveryKey: boolean
  recoveryCodeAccess: boolean
  findMy: boolean
  icloudBackup: boolean
  appLibraryBadges: boolean
  showInAppLibrary: 'Add to Home Screen' | 'App Library Only'
  standby: boolean
  standbyNight: boolean
  standbyAlwaysOn: boolean
  batteryPct: boolean
  optimizedCharging: boolean
  chargeLimit: number
  faceId: { unlock: boolean; pay: boolean; autofill: boolean; attention: boolean; stolen: boolean }
  sos: { callHold: boolean; callPress: boolean; crash: boolean; countdown: boolean; efficientAlerts: boolean }
  camera: { grid: boolean; level: boolean; mirror: boolean; preserve: boolean; format: 'High Efficiency' | 'Most Compatible'; video: '1080p at 30 fps' | '4K at 30 fps' | '4K at 60 fps' | '4K at 120 fps'; prioritizeFaster: boolean; lensCleaning: boolean }
  photos: { icloud: boolean; optimize: boolean; sharedAlbums: boolean; hiddenAlbum: boolean; memories: boolean; showFeatured: boolean }
  safari: { engine: string; suggestions: boolean; tabLayout: 'Compact' | 'Bottom' | 'Top'; blockPopups: boolean; fraud: boolean; crossSite: boolean; hideIp: boolean; notifyMe: boolean; organizeTopics: boolean }
  messages: { imessage: boolean; readReceipts: boolean; smartReplies: boolean; filterUnknown: boolean; sendAsSms: boolean; keep: '30 Days' | '1 Year' | 'Forever'; retryDelivery: boolean; checkIn: boolean }
  wallet: { doubleClick: boolean; expressTransit: string; proactiveCarKey: boolean; orderTracking: boolean }
  focusSchedules: Record<string, { on: boolean; from: string; to: string }>
  focusShare: boolean
  zoomRegion: 'Full Screen Zoom' | 'Window Zoom'
  zoomLevel: number
  readerOptions: { cleanup: boolean; format: boolean; images: boolean; summary: boolean; translate: boolean; lang: string }
  voiceControlNames: Record<string, string>
  touchWizardDone: boolean
  assistiveSetup: boolean
  guidedTimeout: boolean
  autoCaptions: boolean
  captionStyle: 'Default' | 'Large Text' | 'Classic' | 'Outline Text'
  gameControllerPrefs: { haptics: boolean; remap: boolean; accessController: boolean; overlayNav: boolean; lowLatency: boolean }
  langVariant: string
  preferredLanguages: string[]
  calendar: 'Gregorian' | 'Japanese' | 'Buddhist'
  tempUnit: '°F' | '°C'
  setAuto: boolean
  timeZone: string
  naturalTime: boolean
  emojiQuick: boolean
  predictive: boolean
  autocorrect: boolean
  smartPunct: boolean
  slideToType: boolean
  softwareAuto: boolean
  lastChecked: number
  privacyLocation: boolean
  analytics: boolean
  lockdown: boolean
  vpnConfig: 'ParkNet Home' | 'School Relay (Demo)'
  heySiriPhrase: 'Siri or Hey Siri' | 'Hey Siri'
  siriLanguage: string
  personalVoice: boolean
  airpodsName: string
  airpodsEarDetection: boolean
  airpodsPress: 'Noise Control' | 'Siri'
  airpodsHearingProtection: boolean
  airpodsConvBoost: boolean
  airpodsHeadGestures: boolean
  airpodsFindMy: boolean
  airpodsCustomEq: { low: number; mid: number; high: number }
  passcodeChangedDemo: boolean
  screenDistance: boolean
  commLimits: 'Everyone' | 'Contacts Only' | 'Contacts & Groups'
  actionShortcut: string
  searchSuggestions: boolean
  batteryRange: '24h' | '10d'
  alwaysAllowed: string[]
  downtimeFrom: string
  downtimeTo: string
  appLimits: Record<string, number>
  childSetupDone: boolean
}

export const DEFAULT_PREFS: SettingsPrefs = {
  notifSummaries: true,
  notifPreviews: 'When Unlocked',
  notifDisplay: 'Stack',
  appNotifs: {},
  ringtone: 'Reflection',
  textTone: 'Note',
  haptics: 'Always Play',
  keyboardClicks: true,
  lockSound: true,
  changeWithButtons: false,
  btPowerMgmt: true,
  knownNetworks: ['ParkNet', 'Lincoln-High-Guest', 'BrewLab Free WiFi', 'Grandma’s Wi-Fi'],
  askToJoin: 'Notify',
  autoHotspot: 'Ask to Join',
  hotspotFamily: true,
  hotspotMax: false,
  dataMode: 'Standard',
  voiceData: '5G Auto',
  dataRoaming: false,
  recoveryContacts: ['mom'],
  recoveryKey: false,
  recoveryCodeAccess: true,
  findMy: true,
  icloudBackup: true,
  appLibraryBadges: true,
  showInAppLibrary: 'Add to Home Screen',
  standby: true,
  standbyNight: true,
  standbyAlwaysOn: true,
  batteryPct: true,
  optimizedCharging: true,
  chargeLimit: 100,
  faceId: { unlock: true, pay: true, autofill: true, attention: true, stolen: true },
  sos: { callHold: true, callPress: false, crash: true, countdown: true, efficientAlerts: true },
  camera: { grid: false, level: true, mirror: true, preserve: false, format: 'High Efficiency', video: '4K at 30 fps', prioritizeFaster: true, lensCleaning: true },
  photos: { icloud: true, optimize: true, sharedAlbums: true, hiddenAlbum: true, memories: true, showFeatured: true },
  safari: { engine: 'Google', suggestions: true, tabLayout: 'Compact', blockPopups: true, fraud: true, crossSite: true, hideIp: true, notifyMe: true, organizeTopics: true },
  messages: { imessage: true, readReceipts: false, smartReplies: true, filterUnknown: true, sendAsSms: true, keep: 'Forever', retryDelivery: true, checkIn: true },
  wallet: { doubleClick: true, expressTransit: 'w-transit', proactiveCarKey: true, orderTracking: true },
  focusSchedules: {
    'Sleep': { on: true, from: '22:30', to: '06:30' },
    'Study': { on: true, from: '16:00', to: '18:00' },
    'Driving': { on: false, from: '07:30', to: '08:00' },
    'Do Not Disturb': { on: false, from: '21:00', to: '07:00' },
    'Personal': { on: false, from: '18:00', to: '21:00' },
    'Fitness': { on: false, from: '06:30', to: '07:15' },
  },
  focusShare: true,
  zoomRegion: 'Full Screen Zoom',
  zoomLevel: 2,
  readerOptions: { cleanup: true, format: true, images: true, summary: true, translate: false, lang: 'Spanish' },
  voiceControlNames: {},
  touchWizardDone: false,
  assistiveSetup: false,
  guidedTimeout: false,
  autoCaptions: true,
  captionStyle: 'Default',
  gameControllerPrefs: { haptics: true, remap: false, accessController: true, overlayNav: true, lowLatency: true },
  langVariant: 'English (US)',
  preferredLanguages: ['English (US)', 'Spanish (US)'],
  calendar: 'Gregorian',
  tempUnit: '°F',
  setAuto: true,
  timeZone: 'Los Angeles',
  naturalTime: true,
  emojiQuick: true,
  predictive: true,
  autocorrect: true,
  smartPunct: true,
  slideToType: true,
  softwareAuto: true,
  lastChecked: 0,
  privacyLocation: true,
  analytics: false,
  lockdown: false,
  vpnConfig: 'ParkNet Home',
  heySiriPhrase: 'Siri or Hey Siri',
  siriLanguage: 'English (United States)',
  personalVoice: false,
  airpodsName: 'Jamie’s AirPods Pro 3',
  airpodsEarDetection: true,
  airpodsPress: 'Noise Control',
  airpodsHearingProtection: true,
  airpodsConvBoost: false,
  airpodsHeadGestures: true,
  airpodsFindMy: true,
  airpodsCustomEq: { low: 3, mid: -1, high: 2 },
  passcodeChangedDemo: false,
  screenDistance: true,
  commLimits: 'Contacts Only',
  actionShortcut: 'sh-study',
  searchSuggestions: true,
  batteryRange: '24h',
  alwaysAllowed: ['phone', 'messages', 'maps'],
  downtimeFrom: '22:00',
  downtimeTo: '07:00',
  appLimits: { Social: 60, Games: 45 },
  childSetupDone: false,
}

interface PrefsStore extends SettingsPrefs {
  setP: (patch: Partial<SettingsPrefs>) => void
}

export const usePrefs = create<PrefsStore>()(
  persist(
    (set) => ({
      ...DEFAULT_PREFS,
      setP: (patch) => set(patch),
    }),
    {
      name: 'ios27-settings',
      merge: (persisted, current) => ({ ...current, ...(persisted as object) }),
    },
  ),
)

/** Patch a nested object in the prefs store. */
export function setPrefIn<K extends keyof SettingsPrefs>(key: K, patch: Partial<SettingsPrefs[K]>) {
  const cur = usePrefs.getState()[key]
  usePrefs.getState().setP({ [key]: { ...(cur as object), ...(patch as object) } } as Partial<SettingsPrefs>)
}

// ---------------------------------------------------------------- OS store helpers
export const os = () => useOS.getState()
export function setA11y(patch: Partial<ReturnType<typeof os>['accessibility']>) {
  os().set({ accessibility: { ...os().accessibility, ...patch } })
}
export function setSiri(patch: Partial<ReturnType<typeof os>['siriSettings']>) {
  os().set({ siriSettings: { ...os().siriSettings, ...patch } })
}
export function setST(patch: Partial<ReturnType<typeof os>['screenTime']>) {
  os().set({ screenTime: { ...os().screenTime, ...patch } })
}
export function setLang(patch: Partial<ReturnType<typeof os>['language']>) {
  os().set({ language: { ...os().language, ...patch } })
}
export function setAirpods(patch: Partial<ReturnType<typeof os>['airpods']>) {
  os().set({ airpods: { ...os().airpods, ...patch } })
}
export function setGames(patch: Partial<ReturnType<typeof os>['games']>) {
  os().set({ games: { ...os().games, ...patch } })
}

export const fmtMin = (m: number) => (m >= 60 ? `${Math.floor(m / 60)}h ${m % 60 ? `${m % 60}m` : ''}`.trim() : `${m}m`)
