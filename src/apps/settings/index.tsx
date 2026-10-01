import { useMemo, useState, type ReactNode } from 'react'
import {
  Plane, Wifi, Bluetooth, Antenna, Link2, BatteryFull, Globe2, Settings as Gear, PersonStanding, Sun, LayoutGrid, Search as SearchIcon,
  Image as ImageIcon, SlidersHorizontal, Camera, Bell, Volume2, Moon, Hourglass, ScanFace, Hand, Wallet, AppWindow, Gamepad2,
  Cloud, Headphones, ChevronRight, Clock3, Siren, KeyRound, Contrast,
} from 'lucide-react'
import { NavStack, Page, useNav } from '../../ui/nav'
import { List, Row } from '../../ui/list'
import { SearchField, Avatar, AISparkle } from '../../ui/controls'
import { useOS } from '../../os/store'
import { useAppRoute, useOnscreen } from '../../os/hooks'
import { SETTINGS_INDEX } from '../../os/search'
import { ROUTES, Ico, usePrefs } from './common'
import { registerConnectivity } from './pages/connectivity'
import { registerAccount } from './pages/account'
import { registerAlerts } from './pages/alerts'
import { registerGeneral } from './pages/general'
import { registerAccessibility } from './pages/accessibility'
import { registerDisplay } from './pages/display'
import { registerSystem } from './pages/system'
import { registerSiri } from './pages/siri'
import { registerAirPods } from './pages/airpods'
import { registerScreenTime } from './pages/screentime'
import { EXTRA_INDEX } from './searchIndex'
import './settings.css'

registerConnectivity()
registerAccount()
registerAlerts()
registerGeneral()
registerAccessibility()
registerDisplay()
registerSystem()
registerSiri()
registerAirPods()
registerScreenTime()

ROUTES['root'] = { title: 'Settings', el: () => <RootPage /> }

export default function SettingsApp() {
  return (
    <div className="app-root grouped stg-root">
      <NavStack root={<RootPage />} grouped />
    </div>
  )
}

/** The chain of routes to push for a deep link, e.g. appearance/glass → [appearance, appearance/glass]. */
function chainFor(route: string): string[] {
  const out: string[] = []
  let r: string | undefined = route
  const guard = new Set<string>()
  while (r && ROUTES[r] && !guard.has(r)) {
    guard.add(r)
    out.unshift(r)
    r = ROUTES[r].parent ?? (r.includes('/') ? r.slice(0, r.lastIndexOf('/')) : undefined)
  }
  return out
}

function RootPage() {
  const nav = useNav()
  const [q, setQ] = useState('')
  const st = useOS()
  const batteryPct = usePrefs((s) => s.batteryPct)
  useOnscreen('settings', 'Settings')

  useAppRoute('settings', (route) => {
    const r = route.replace(/^\/+|\/+$/g, '')
    const chain = chainFor(r)
    nav.popToRoot()
    setQ('')
    if (!chain.length) return
    for (const c of chain) nav.push(ROUTES[c].el(), `${c}-${Date.now()}`)
  })

  const open = (r: string) => {
    const chain = chainFor(r)
    for (const c of chain.slice(chain.length > 1 ? -2 : -1)) nav.push(ROUTES[c].el(), `${c}-${Date.now()}`)
  }

  const net = st.net
  const accent = (c: string, I: Parameters<typeof Ico>[0]['i'], fill?: boolean) => <Ico c={c} i={I} fill={fill} />

  return (
    <Page title="Settings" grouped>
      <div className="stg-search-wrap">
        <SearchField value={q} onChange={setQ} placeholder="Search" />
      </div>
      {q.trim() ? (
        <SearchResults q={q} onOpen={open} />
      ) : (
        <>
          <List>
            <button className="row-item stg-account" onClick={() => open('account')} aria-label="Apple Account, Jamie Park">
              <Avatar id="me" size={62} color="#6aa9ff" />
              <span className="row-main">
                <span className="row-title stg-account-name">Jamie Park</span>
                <span className="row-sub">Apple Account, iCloud, and more</span>
              </span>
              <ChevronRight className="chev" size={18} strokeWidth={2.6} />
            </button>
            {st.airpods.connected && (
              <Row
                icon={<span className="stg-airpods-ico"><Headphones size={20} strokeWidth={2} /></span>}
                title="Jamie’s AirPods Pro 3"
                detail={`${Math.min(st.airpods.battery.l, st.airpods.battery.r)}%`}
                chevron
                onClick={() => open('airpods')}
              />
            )}
            <Row icon={accent('#8e8e93', Cloud)} title="iCloud" detail="42 GB of 50 GB" chevron onClick={() => open('account/icloud')} />
          </List>

          <List>
            <Row icon={accent('#ff9500', Plane, true)} title="Airplane Mode" toggle={{ value: net.airplane, onChange: (v) => st.setNet(v ? { airplane: true, wifi: false, bluetooth: false, cellular: false, activePath: 'none' } : { airplane: false, wifi: true, bluetooth: true, cellular: true, activePath: 'wifi' }) }} />
            <Row icon={accent('#007aff', Wifi)} title="Wi‑Fi" detail={net.wifi ? net.wifiNetwork || 'Not Connected' : 'Off'} chevron onClick={() => open('wifi')} />
            <Row icon={accent('#007aff', Bluetooth)} title="Bluetooth" detail={net.bluetooth ? 'On' : 'Off'} chevron onClick={() => open('bluetooth')} />
            <Row icon={accent('#34c759', Antenna)} title="Cellular" detail={net.airplane ? 'Airplane Mode' : net.cellular ? undefined : 'Off'} chevron onClick={() => open('cellular')} />
            <Row icon={accent('#34c759', Link2)} title="Personal Hotspot" detail={net.hotspot ? 'On' : 'Off'} chevron onClick={() => open('hotspot')} />
            <Row icon={accent('#34c759', BatteryFull)} title="Battery" detail={batteryPct ? `${Math.round(st.battery * 100)}%` : undefined} chevron onClick={() => open('battery')} />
            <Row icon={accent('#0a5fd6', Globe2)} title="VPN" detail={net.vpn ? 'Connected' : 'Not Connected'} chevron onClick={() => open('vpn')} />
          </List>

          <List>
            <Row icon={accent('#8e8e93', Gear)} title="General" chevron onClick={() => open('general')} />
            <Row icon={accent('#0a84ff', PersonStanding)} title="Accessibility" chevron onClick={() => open('accessibility')} />
            <Row icon={accent('#3478f6', Hand)} title="Action Button" chevron onClick={() => open('action-button')} />
            <Row icon={<span className="stg-ai-ico"><AISparkle size={20} color="#fff" /></span>} title="Apple Intelligence & Siri" chevron onClick={() => open('siri')} />
            <Row icon={accent('#1c1c1e', Contrast)} title="Appearance" detail={st.theme === 'dark' ? 'Dark' : 'Light'} chevron onClick={() => open('appearance')} />
            <Row icon={accent('#8e8e93', Camera)} title="Camera" chevron onClick={() => open('camera')} />
            <Row icon={accent('#8e8e93', SlidersHorizontal)} title="Control Center" chevron onClick={() => open('controls')} />
            <Row icon={accent('#007aff', Sun)} title="Display & Brightness" chevron onClick={() => open('display')} />
            <Row icon={accent('#5856d6', LayoutGrid)} title="Home Screen & App Library" chevron onClick={() => open('homescreen')} />
            <Row icon={accent('#8e8e93', SearchIcon)} title="Search" chevron onClick={() => open('search')} />
            <Row icon={accent('#1c1c1e', Clock3)} title="StandBy" chevron onClick={() => open('standby')} />
            <Row icon={accent('#32ade6', ImageIcon)} title="Wallpaper" chevron onClick={() => open('wallpaper')} />
          </List>

          <List>
            <Row icon={accent('#ff3b30', Bell, true)} title="Notifications" chevron onClick={() => open('notifications')} />
            <Row icon={accent('#ff2d55', Volume2, true)} title="Sounds & Haptics" chevron onClick={() => open('sounds')} />
            <Row icon={accent('#5856d6', Moon, true)} title="Focus" detail={st.focus ?? undefined} chevron onClick={() => open('focus')} />
            <Row icon={accent('#5856d6', Hourglass)} title="Screen Time" detail={st.screenTime.childMode ? 'Child Mode' : undefined} chevron onClick={() => open('screentime')} />
          </List>

          <List>
            <Row icon={accent('#34c759', ScanFace)} title="Face ID & Passcode" chevron onClick={() => open('faceid')} />
            <Row icon={accent('#ff3b30', Siren)} title="Emergency SOS" chevron onClick={() => open('emergency')} />
            <Row icon={accent('#007aff', Hand, true)} title="Privacy & Security" chevron onClick={() => open('privacy')} />
          </List>

          <List>
            <Row icon={accent('#1c1c1e', Wallet)} title="Wallet & Apple Pay" chevron onClick={() => open('wallet')} />
            <Row icon={accent('#8e8e93', Gamepad2)} title="Game Controllers" detail={st.games.controller ?? undefined} chevron onClick={() => open('games')} />
            <Row icon={accent('#8e8e93', KeyRound)} title="Passwords" chevron onClick={() => st.launch('passwords')} />
          </List>

          <List>
            <Row icon={accent('#5856d6', AppWindow)} title="Apps" chevron onClick={() => open('apps')} />
          </List>
        </>
      )}
    </Page>
  )
}

interface SearchEntry { title: string; route: string; path: string; keywords: string; icon?: ReactNode }

function buildEntries(): SearchEntry[] {
  const seen = new Set<string>()
  const out: SearchEntry[] = []
  const pathFor = (route: string) => {
    const chain = chainFor(route)
    return ['Settings', ...chain.slice(0, -1).map((c) => ROUTES[c].title)].join(' › ')
  }
  const add = (title: string, route: string, keywords = '') => {
    if (!ROUTES[route]) return
    const key = `${title}|${route}`
    if (seen.has(key)) return
    seen.add(key)
    out.push({ title, route, path: pathFor(route), keywords: `${title} ${keywords} ${ROUTES[route].keywords ?? ''}`.toLowerCase() })
  }
  for (const [route, def] of Object.entries(ROUTES)) if (route !== 'root') add(def.title, route, def.keywords)
  for (const e of SETTINGS_INDEX) add(e.title, e.route, e.keywords)
  for (const e of EXTRA_INDEX) add(e.title, e.route, e.keywords)
  return out
}

function SearchResults({ q, onOpen }: { q: string; onOpen: (route: string) => void }) {
  const entries = useMemo(buildEntries, [])
  const terms = q.toLowerCase().split(/\s+/).filter(Boolean)
  const hits = entries
    .map((e) => {
      const t = e.title.toLowerCase()
      let score = 0
      for (const term of terms) {
        if (t.startsWith(term)) score += 5
        else if (t.includes(term)) score += 3
        else if (e.keywords.includes(term)) score += 1
        else return { e, score: -1 }
      }
      return { e, score }
    })
    .filter((h) => h.score > 0)
    .sort((a, b) => b.score - a.score || a.e.title.length - b.e.title.length)
    .slice(0, 40)
  if (!hits.length) {
    return (
      <div className="empty-state">
        <SearchIcon size={44} strokeWidth={1.6} />
        <div className="t-title2">No Results for “{q}”</div>
        <div>Check the spelling or try a new search.</div>
      </div>
    )
  }
  return (
    <List>
      {hits.map(({ e }) => (
        <Row key={`${e.route}-${e.title}`} title={e.title} subtitle={e.path} chevron onClick={() => onOpen(e.route)} />
      ))}
    </List>
  )
}

