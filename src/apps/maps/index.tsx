import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  X, Search, Mic, Navigation, CarFront, Footprints, TrainFront, Bike, Phone, Globe, Share, Star, Plus, Clock, MapPinned, CloudDownload,
  BookOpen, Orbit, Layers, Check, ArrowUp, CornerUpLeft, CornerUpRight, ArrowUpLeft, ArrowUpRight, Flag, Pause, Play, Trash2, ShieldCheck, History, Sparkles, ChevronRight,
} from 'lucide-react'
import { Avatar, AISparkle, Switch, Spinner } from '../../ui/controls'
import { openMenu, showAlert } from '../../ui/overlay'
import { useOS } from '../../os/store'
import { useAppRoute, useOnscreen, useDrag } from '../../os/hooks'
import { useShell } from '../../shell/shellState'
import { VISITED } from '../../os/data/world'
import { wordsToNumbers } from '../../os/ai/parse'
import { Scene } from '../../art/Scene'
import { DAY, startOfDay, fmtRelative } from '../../os/time'
import { MapView, PlacePin, catOf, type Camera, type MapPin, type MapRoute } from './MapView'
import { PLACES, placeById, HERE, route, routeOptions, routeVia, straightMiles, type Place, type Pt, type Mode, type RouteResult, type Step } from './geo'
import { useNavSim, startNavigation, endNavigation, dismissArrival, navSummary } from './navStore'
import './maps.css'

// ------------------------------------------------------------------ local state
interface MapsLocal {
  favorites: string[]
  recents: { kind: 'place' | 'query'; id: string; ts: number }[]
  mapType: 'explore' | 'driving' | 'satellite'
  visitedEnabled: boolean
  visitedEdits: Record<number, { status: 'confirmed' | 'removed'; place?: string }>
  downloads: { id: string; name: string; mb: number; updated: number }[]
  autoUpdate: boolean
  onlyOffline: boolean
  lastCheck: number
  set: (p: Partial<MapsLocal>) => void
}
const useMaps = create<MapsLocal>()(persist((set) => ({
  favorites: ['home', 'school', 'grandma', 'brewlab'],
  recents: [{ kind: 'place', id: 'rosas', ts: Date.now() - 3 * DAY }, { kind: 'place', id: 'library', ts: Date.now() - DAY }, { kind: 'place', id: 'brewlab', ts: Date.now() - 2 * 3600_000 }],
  mapType: 'explore',
  visitedEnabled: true,
  visitedEdits: {},
  downloads: [{ id: 'maple', name: 'Maple Grove & Surroundings', mb: 412, updated: Date.now() - 5 * 3600_000 }],
  autoUpdate: true,
  onlyOffline: false,
  lastCheck: Date.now() - 2 * 3600_000,
  set: (p) => set(p),
}), { name: 'ios27-maps', partialize: ({ set: _s, ...r }) => { void _s; return r } }))

type Panel =
  | { k: 'home' }
  | { k: 'search' }
  | { k: 'place'; id: string }
  | { k: 'route'; dest: string; via?: string; mode: Mode; sel: number }
  | { k: 'nl'; q: string }
  | { k: 'visited' }
  | { k: 'offline' }
  | { k: 'guides' }
  | { k: 'guide'; id: string }
type Detent = 'peek' | 'mid' | 'full'

const SCENES: Record<string, string[]> = {
  coffee: ['food-coffee', 'food-pancakes', 'city-night'], restaurant: ['food-pizza', 'family-dinner', 'food-ramen'], park: ['soccer-field', 'autumn-trees', 'dog-park'],
  school: ['robot-arena', 'drumline', 'robot-workshop'], shopping: ['product-sneakers', 'product-headphones', 'city-night'], library: ['handwritten', 'garden', 'autumn-trees'],
  airport: ['landmark-bridge', 'mountain-lake', 'city-night'], health: ['plant-monstera', 'garden', 'plant-succulent'], home: ['dog-couch', 'garden', 'porch-package'],
}
const PHONE_CONTACT: Record<string, string> = { brewlab: 'brewlab', rosas: 'rosas', dentist: 'drlee' }
const GUIDES = [
  { id: 'coffee', title: 'Best Coffee in Maple Grove', by: 'Maple Grove Eats', scene: 'food-coffee', places: ['brewlab', 'bean'], blurb: 'Two cafés locals swear by — one for oat lattes, one for late-night study sessions.' },
  { id: 'study', title: 'Quiet Study Spots', by: 'Lincoln High Student Council', scene: 'handwritten', places: ['library', 'brewlab', 'bean'], blurb: 'Outlets, Wi-Fi and enough quiet to finally finish that chem lab.' },
  { id: 'family', title: 'A Day Out with the Family', by: 'Visit Maple Grove', scene: 'dog-park', places: ['park', 'mall', 'rosas'], blurb: 'Riverside walks, a little shopping, and the best lasagna in town.' },
]
const MODE_ICON: Record<Mode, ReactNode> = { drive: <CarFront size={18} />, walk: <Footprints size={18} />, transit: <TrainFront size={18} />, bike: <Bike size={18} /> }
const MODE_LABEL: Record<Mode, string> = { drive: 'Drive', walk: 'Walk', transit: 'Transit', bike: 'Cycle' }

const reviews = (p: Place) => Math.round(p.rating * 71 + p.name.length * 13)
const distFromHere = (p: Pt) => { const mi = straightMiles(HERE, p); return mi < 0.1 ? 'Here' : `${mi.toFixed(1)} mi` }
const driveMins = (p: Place) => route(HERE, p, 'drive', p.name)?.minutes ?? 0

export function TurnIcon({ turn, size = 34 }: { turn: Step['turn']; size?: number }) {
  const p = { size, strokeWidth: 2.8 }
  switch (turn) {
    case 'left': return <CornerUpLeft {...p} />
    case 'right': return <CornerUpRight {...p} />
    case 'slight-left': return <ArrowUpLeft {...p} />
    case 'slight-right': return <ArrowUpRight {...p} />
    case 'arrive': return <Flag {...p} />
    default: return <ArrowUp {...p} />
  }
}

// ------------------------------------------------------------------ natural-language routing
interface DetourPlan { dest: Place; cat: string; limit: number; direct: RouteResult; options: { p: Place; r: RouteResult; add: number }[]; pick: { p: Place; r: RouteResult; add: number } | null; text: string }
export function planDetour(q: string): DetourPlan | null {
  const l = wordsToNumbers(q.toLowerCase())
  const cat = /coffee|cafe|café|latte|espresso/.test(l) ? 'coffee' : /restaurant|food|eat|dinner|lunch|pizza|pasta/.test(l) ? 'restaurant' : /\bpark\b/.test(l) ? 'park' : /librar|study spot/.test(l) ? 'library' : null
  if (!cat || !/(on the way|on my way|along the way|en route|way (home|to)|detour|stop)/.test(l)) return null
  const dest = /\bhome\b/.test(l) ? placeById('home')! : /grandma/.test(l) ? placeById('grandma')! : /airport/.test(l) ? placeById('airport')! : PLACES.find((p) => p.kind !== cat && l.includes(p.name.toLowerCase())) ?? placeById('home')!
  const limit = +(l.match(/(\d+)\s*(?:more )?(?:min|minute)/)?.[1] ?? 15)
  const direct = route(HERE, dest, 'drive', dest.name)!
  const options = PLACES.filter((p) => p.kind === cat).map((p) => {
    const r = routeVia(HERE, p, dest, 'drive', p.name, dest.name)!
    return { p, r, add: Math.max(1, r.minutes - direct.minutes) }
  }).sort((a, b) => a.add - b.add)
  const ok = options.filter((o) => o.add <= limit)
  const pick = ok[0] ?? null
  const other = options.find((o) => o !== pick)
  const text = pick
    ? `${pick.p.name} adds just ${pick.add} min to your ${direct.minutes}-minute drive ${dest.id === 'home' ? 'home' : `to ${dest.name}`} — within your ${limit}-minute limit. It’s rated ${pick.p.rating} and ${(pick.p.hours ?? 'open now').toLowerCase()}.${other ? ` ${other.p.name} would add ${other.add} min${other.add > limit ? ', which is over your limit' : ''}.` : ''}`
    : `Nothing ${catOf(cat).label.toLowerCase()}-wise fits under ${limit} minutes. The closest option, ${options[0]?.p.name}, adds ${options[0]?.add} min.`
  return { dest, cat, limit, direct, options, pick, text }
}

// ------------------------------------------------------------------ app
export default function MapsApp() {
  const [panels, setPanels] = useState<Panel[]>([{ k: 'home' }])
  const panel = panels[panels.length - 1]
  const [detent, setDetent] = useState<Detent>('peek')
  const [cam, setCam] = useState<Camera>({ x: HERE.x, y: HERE.y + 30, z: 1.05 })
  const [anim, setAnim] = useState(false)
  const [q, setQ] = useState('')
  const [threeD, setThreeD] = useState(false)
  const [flyover, setFlyover] = useState<null | { x: number; y: number; name: string }>(null)
  const [size, setSize] = useState({ w: 402, h: 874 })
  const rootRef = useRef<HTMLDivElement>(null)
  const animT = useRef<number | undefined>(undefined)
  const loc = useMaps()
  const nav = useNavSim()
  const landscape = useOS((s) => s.orientation === 'landscape')
  const theme = useOS((s) => s.theme)

  useLayoutEffect(() => {
    const el = rootRef.current
    if (!el) return
    const m = () => setSize({ w: el.offsetWidth || 402, h: el.offsetHeight || 874 })
    m()
    const ro = new ResizeObserver(m)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const sheetH = landscape ? 0 : detent === 'peek' ? 176 : detent === 'mid' ? Math.round(size.h * 0.47) : size.h - 70
  const anchorY = landscape ? 0.5 : Math.min(0.5, Math.max(0.22, ((size.h - sheetH) / 2 + 26) / size.h))
  const anchorX = landscape ? (356 + (size.w - 356) / 2) / size.w : 0.5
  const visW = landscape ? size.w - 370 : size.w
  const visH = landscape ? size.h - 40 : size.h - sheetH - 110

  const flyTo = (c: Partial<Camera>) => {
    setAnim(true)
    setCam((prev) => ({ ...prev, heading: 0, tilt: threeD ? 45 : 0, ...c }))
    window.clearTimeout(animT.current)
    animT.current = window.setTimeout(() => setAnim(false), 900)
  }
  const fit = (pts: Pt[], extra = 1) => {
    const xs = pts.map((p) => p.x)
    const ys = pts.map((p) => p.y)
    const bw = Math.max(60, Math.max(...xs) - Math.min(...xs))
    const bh = Math.max(60, Math.max(...ys) - Math.min(...ys))
    const z = Math.min(2.4, Math.max(0.42, Math.min((visW - 70) / bw, (visH - 40) / bh) * extra))
    flyTo({ x: (Math.max(...xs) + Math.min(...xs)) / 2, y: (Math.max(...ys) + Math.min(...ys)) / 2, z })
  }

  const push = (p: Panel) => setPanels((ps) => [...ps.filter((x) => !(x.k === 'search' && p.k !== 'search')), p])
  const back = () => setPanels((ps) => (ps.length > 1 ? ps.slice(0, -1) : ps))
  const home = () => { setPanels([{ k: 'home' }]); setQ(''); setDetent('peek') }
  const addRecent = (kind: 'place' | 'query', id: string) => loc.set({ recents: [{ kind, id, ts: Date.now() }, ...loc.recents.filter((r) => !(r.kind === kind && r.id === id))].slice(0, 10) })

  const openPlace = (id: string) => {
    const p = placeById(id)
    if (!p) return
    addRecent('place', id)
    push({ k: 'place', id })
    setDetent('mid')
    flyTo({ x: p.x, y: p.y, z: Math.max(cam.z, 1.6) })
  }
  const openRoute = (dest: string, via?: string, mode: Mode = 'drive') => {
    push({ k: 'route', dest, via, mode, sel: 0 })
    setDetent('mid')
  }

  // routes: route/<place>[/<via>], nav
  useAppRoute('maps', (r) => {
    const m = r.match(/^route\/([^/]+)(?:\/([^/]+))?$/)
    if (m && placeById(m[1])) {
      const hasSiriNav = useOS.getState().activities.some((a) => a.id === 'nav')
      setPanels([{ k: 'home' }])
      if (hasSiriNav && !useNavSim.getState().active) {
        const dest = placeById(m[1])!
        const via = m[2] ? placeById(m[2]) : undefined
        const rr = via ? routeVia(HERE, via, dest, 'drive', via.name, dest.name) : route(HERE, dest, 'drive', dest.name)
        if (rr) startNavigation(rr, dest.name, dest.id, 'drive', via?.name)
      } else window.setTimeout(() => openRoute(m[1], m[2]), 30)
    } else if (r === 'nav') {
      if (!useNavSim.getState().active) {
        const act = useOS.getState().activities.find((a) => a.id === 'nav')
        const dest = PLACES.find((p) => p.name === act?.title) ?? placeById('home')!
        const rr = route(HERE, dest, 'drive', dest.name)
        if (rr) startNavigation(rr, dest.name, dest.id, 'drive')
      }
    } else if (r.startsWith('place/')) openPlace(r.slice(6))
    else if (r.startsWith('search/')) { setQ(decodeURIComponent(r.slice(7))); push({ k: 'search' }); setDetent('full') }
  })

  // status bar over dark flyover / nav
  useEffect(() => {
    useShell.getState().set({ statusOverride: flyover ? 'light' : null })
    return () => useShell.getState().set({ statusOverride: null })
  }, [flyover, nav.active])

  useOnscreen('maps', nav.active ? `Navigating to ${nav.destName}` : panel.k === 'place' ? `Viewing ${placeById(panel.id)?.name} in Maps` : 'Maps')

  // ---------- derived map content
  const routeData = useMemo(() => {
    if (panel.k === 'route') {
      const dest = placeById(panel.dest)!
      const via = panel.via ? placeById(panel.via) : undefined
      if (via) {
        const r = routeVia(HERE, via, dest, panel.mode, via.name, dest.name)
        const direct = route(HERE, dest, panel.mode, dest.name)
        return { dest, via, options: r ? [r] : [], direct }
      }
      return { dest, via, options: routeOptions(HERE, dest, panel.mode, dest.name), direct: null }
    }
    return null
  }, [panel])
  const nl = useMemo(() => (panel.k === 'nl' ? planDetour(panel.q) : null), [panel])

  // camera follow for route / nl panels
  useEffect(() => {
    if (routeData?.options[0]) fit(routeData.options[0].pts)
    else if (nl?.pick) fit(nl.pick.r.pts)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeData, nl, detent])

  let pins: MapPin[] = []
  let routes: MapRoute[] = []
  const selId = panel.k === 'place' ? panel.id : null
  if (routeData) {
    const sel = panel.k === 'route' ? panel.sel : 0
    routeData.options.forEach((r, i) => { if (i !== sel) routes.push({ id: `alt${i}`, pts: r.pts, dim: true, onClick: () => setPanels((ps) => ps.map((p, j) => (j === ps.length - 1 && p.k === 'route' ? { ...p, sel: i } : p))) }) })
    if (routeData.direct && routeData.via) routes.push({ id: 'direct', pts: routeData.direct.pts, dim: true })
    const s = routeData.options[sel]
    if (s) routes.push({ id: 'sel', pts: s.pts, color: panel.k === 'route' && panel.mode === 'walk' ? '#0a84ff' : undefined, dashed: panel.k === 'route' && panel.mode === 'walk' })
    pins = [{ id: routeData.dest.id, x: routeData.dest.x, y: routeData.dest.y, node: <PlacePin kind={routeData.dest.kind} label={routeData.dest.name} selected />, zIndex: 20 }]
    if (routeData.via) pins.push({ id: routeData.via.id, x: routeData.via.x, y: routeData.via.y, node: <PlacePin kind={routeData.via.kind} label={`Stop · ${routeData.via.name}`} />, zIndex: 19 })
  } else if (nl) {
    if (nl.pick) routes = [{ id: 'direct', pts: nl.direct.pts, dim: true }, { id: 'via', pts: nl.pick.r.pts }]
    pins = [
      { id: nl.dest.id, x: nl.dest.x, y: nl.dest.y, node: <PlacePin kind={nl.dest.kind} label={nl.dest.name} />, zIndex: 18 },
      ...nl.options.map((o) => ({ id: o.p.id, x: o.p.x, y: o.p.y, zIndex: o === nl.pick ? 20 : 15, node: <div className={`mapp-detour ${o.add <= nl.limit ? 'ok' : 'no'}`}><PlacePin kind={o.p.kind} selected={o === nl.pick} /><span>+{o.add} min</span></div>, onClick: () => openPlace(o.p.id) })),
    ]
  } else if (panel.k === 'guide') {
    const g = GUIDES.find((x) => x.id === panel.id)!
    pins = g.places.map((id) => placeById(id)!).map((p) => ({ id: p.id, x: p.x, y: p.y, node: <PlacePin kind={p.kind} label={p.name} />, onClick: () => openPlace(p.id) }))
  } else {
    pins = PLACES.map((p) => ({ id: p.id, x: p.x, y: p.y, zIndex: p.id === selId ? 20 : 10, node: <PlacePin kind={p.kind} label={p.name} selected={p.id === selId} />, onClick: () => openPlace(p.id) }))
  }
  if (loc.mapType === 'driving' && !routeData && !nl) {
    routes = [
      { id: 't1', pts: [{ x: 470, y: 300 }, { x: 640, y: 300 }], color: '#ff9f0a', width: 4 },
      { id: 't2', pts: [{ x: 900, y: 300 }, { x: 900, y: 600 }], color: '#ff453a', width: 5 },
      { id: 't3', pts: [{ x: 470, y: 450 }, { x: 470, y: 620 }], color: '#30d158', width: 4 },
      { id: 't4', pts: [{ x: 330, y: 360 }, { x: 640, y: 360 }], color: '#ff9f0a', width: 4 },
    ]
  }

  // ---------- navigation mode
  if (nav.active || nav.arrived) {
    return (
      <div className={`app-root mapp-root ${theme === 'dark' ? 'dark' : ''}`} ref={rootRef}>
        <NavigationView />
      </div>
    )
  }

  const camera: Camera = threeD ? { ...cam, tilt: cam.tilt ?? 45 } : cam
  return (
    <div className={`app-root mapp-root ${landscape ? 'land' : ''}`} ref={rootRef}>
      <MapView
        camera={camera}
        onCamera={setCam}
        animate={anim}
        pins={pins}
        routes={routes}
        user={{ p: HERE, heading: 28 }}
        buildings3d={threeD}
        anchorY={anchorY}
        anchorX={anchorX}
        className={loc.mapType === 'satellite' ? 'sat' : ''}
        onTap={() => { if (panel.k === 'place') home() }}
      />
      <div className="mapp-controls glass">
        <button aria-label="Map type" onClick={(e) => openMenu(e.currentTarget, (['explore', 'driving', 'satellite'] as const).map((t) => ({ label: t === 'explore' ? 'Explore' : t === 'driving' ? 'Driving (Traffic)' : 'Satellite', icon: loc.mapType === t ? <Check size={18} /> : undefined, onSelect: () => loc.set({ mapType: t }) })), { title: 'Choose Map' })}><Layers size={20} /></button>
        <button aria-label={threeD ? '2D' : '3D'} className="mapp-3d" onClick={() => { setThreeD(!threeD); setAnim(true); setCam((c) => ({ ...c, tilt: !threeD ? 45 : 0, z: !threeD ? Math.max(c.z, 1.4) : c.z })); window.setTimeout(() => setAnim(false), 900) }}>{threeD ? '2D' : '3D'}</button>
        <button aria-label="Current location" onClick={() => flyTo({ x: HERE.x, y: HERE.y, z: 1.6 })}><Navigation size={19} fill="currentColor" strokeWidth={0} style={{ transform: 'rotate(0deg)' }} /></button>
        <button aria-label="Flyover" onClick={() => setFlyover({ x: 520, y: 360, name: 'Downtown Maple Grove' })}><Orbit size={20} /></button>
      </div>
      {loc.onlyOffline && <div className="mapp-offline-pill glass">Offline Maps Only</div>}
      <MapSheet detent={detent} setDetent={setDetent} landscape={landscape} h={size.h}>
        {panel.k === 'home' || panel.k === 'search' ? (
          <HomePanel
            q={q}
            setQ={setQ}
            searching={panel.k === 'search'}
            onFocus={() => { if (panel.k !== 'search') push({ k: 'search' }); setDetent('full') }}
            onCancel={home}
            onPlace={openPlace}
            onRoute={(id) => openRoute(id)}
            onNL={(query) => { addRecent('query', query); push({ k: 'nl', q: query }); setDetent('mid') }}
            onOpen={(p) => { push(p); setDetent(p.k === 'guides' || p.k === 'visited' || p.k === 'offline' ? 'full' : 'mid') }}
          />
        ) : panel.k === 'place' ? (
          <PlacePanel id={panel.id} onClose={back} onRoute={(id) => openRoute(id)} onFlyover={(p) => setFlyover({ x: p.x, y: p.y, name: p.name })} />
        ) : panel.k === 'route' && routeData ? (
          <RoutePanel
            panel={panel}
            data={routeData}
            onClose={back}
            onPanel={(p) => setPanels((ps) => [...ps.slice(0, -1), p])}
            onGo={(r) => { startNavigation(r, routeData.dest.name, routeData.dest.id, panel.mode, routeData.via?.name); addRecent('place', routeData.dest.id) }}
          />
        ) : panel.k === 'nl' ? (
          <NLPanel q={panel.q} plan={nl} onClose={back} onRoute={(dest, via) => openRoute(dest, via)} onPlace={openPlace} />
        ) : panel.k === 'visited' ? (
          <VisitedPanel onClose={back} onPlace={openPlace} />
        ) : panel.k === 'offline' ? (
          <OfflinePanel onClose={back} />
        ) : panel.k === 'guides' ? (
          <GuidesPanel onClose={back} onGuide={(id) => { push({ k: 'guide', id }); setDetent('mid'); const g = GUIDES.find((x) => x.id === id)!; fit(g.places.map((p) => placeById(p)!), 0.8) }} />
        ) : panel.k === 'guide' ? (
          <GuidePanel id={panel.id} onClose={back} onPlace={openPlace} />
        ) : null}
      </MapSheet>
      {flyover && <Flyover target={flyover} onClose={() => setFlyover(null)} />}
    </div>
  )
}

// ------------------------------------------------------------------ bottom sheet with detents
function MapSheet({ detent, setDetent, landscape, h, children }: { detent: Detent; setDetent: (d: Detent) => void; landscape: boolean; h: number; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const heights: Record<Detent, number> = landscape ? { peek: 150, mid: Math.round(h * 0.6), full: h - 16 } : { peek: 176, mid: Math.round(h * 0.47), full: h - 70 }
  const [dragH, setDragH] = useState<number | null>(null)
  const onDrag = useDrag({
    onStart: (e) => !!(e.target as HTMLElement).closest('.mapp-grab'),
    onMove: (_dx, dy) => setDragH(Math.max(110, Math.min(heights.full, heights[detent] - dy))),
    onEnd: (_dx, dy, _vx, vy) => {
      const target = heights[detent] - dy - vy * 0.18
      const best = (Object.keys(heights) as Detent[]).reduce((a, b) => (Math.abs(heights[b] - target) < Math.abs(heights[a] - target) ? b : a))
      setDragH(null)
      setDetent(best)
    },
  })
  return (
    <div
      ref={ref}
      className={`mapp-sheet glass heavy ${landscape ? 'land' : ''} ${dragH !== null ? 'dragging' : ''} d-${detent}`}
      style={{ height: dragH ?? heights[detent] }}
      onPointerDown={onDrag}
    >
      <div className="mapp-grab" onClick={() => setDetent(detent === 'peek' ? 'mid' : detent === 'mid' ? 'full' : 'peek')}><span /></div>
      <div className="mapp-sheet-body">{children}</div>
    </div>
  )
}

function PanelHeader({ title, subtitle, onClose, trailing }: { title: ReactNode; subtitle?: ReactNode; onClose: () => void; trailing?: ReactNode }) {
  return (
    <div className="mapp-ph mapp-grab">
      <div className="grow">
        <div className="mapp-ph-title">{title}</div>
        {subtitle && <div className="mapp-ph-sub">{subtitle}</div>}
      </div>
      {trailing}
      <button className="mapp-x" aria-label="Close" onClick={onClose}><X size={18} strokeWidth={2.8} /></button>
    </div>
  )
}

// ------------------------------------------------------------------ home / search
function HomePanel({ q, setQ, searching, onFocus, onCancel, onPlace, onRoute, onNL, onOpen }: {
  q: string; setQ: (s: string) => void; searching: boolean; onFocus: () => void; onCancel: () => void; onPlace: (id: string) => void; onRoute: (id: string) => void; onNL: (q: string) => void; onOpen: (p: Panel) => void
}) {
  const loc = useMaps()
  const l = q.trim().toLowerCase()
  const nlPlan = useMemo(() => (q.trim().length > 8 ? planDetour(q) : null), [q])
  const matches = l ? PLACES.filter((p) => `${p.name} ${p.address} ${p.kind} ${catOf(p.kind).label}`.toLowerCase().includes(l.replace(/s$/, ''))) : []
  const submit = () => {
    if (nlPlan) onNL(q)
    else if (matches[0]) onPlace(matches[0].id)
  }
  return (
    <div className="mapp-home">
      <div className="mapp-searchrow mapp-grab">
        <label className="mapp-search">
          <Search size={18} strokeWidth={2.4} />
          <input value={q} placeholder="Search Maps" onFocus={onFocus} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} aria-label="Search Maps" enterKeyHint="search" data-dictation="Coffee shop on the way home that doesn't add more than ten minutes|Directions to Rosa's Trattoria" />
          {q ? <button aria-label="Clear" onClick={() => setQ('')} className="mapp-clear"><X size={12} strokeWidth={3} /></button> : <Mic size={18} />}
        </label>
        {searching ? <button className="mapp-cancel" onClick={onCancel}>Cancel</button> : (
          <button aria-label="Account" onClick={(e) => openMenu(e.currentTarget, [
            { label: 'Visited Places', icon: <History size={18} />, onSelect: () => onOpen({ k: 'visited' }) },
            { label: 'Offline Maps', icon: <CloudDownload size={18} />, onSelect: () => onOpen({ k: 'offline' }) },
            { label: 'Guides', icon: <BookOpen size={18} />, onSelect: () => onOpen({ k: 'guides' }) },
          ])}><Avatar id="me" size={36} /></button>
        )}
      </div>
      {searching ? (
        <div className="mapp-results">
          {nlPlan && (
            <button className="mapp-ai-row ai-glow" onClick={() => onNL(q)}>
              <AISparkle size={22} />
              <span className="grow">
                <span className="t-headline" style={{ display: 'block' }}>{catOf(nlPlan.cat).label}s on the way {nlPlan.dest.id === 'home' ? 'home' : `to ${nlPlan.dest.name}`}</span>
                <span className="t-footnote secondary">Adds at most {nlPlan.limit} min · {nlPlan.pick ? `Best: ${nlPlan.pick.p.name} (+${nlPlan.pick.add} min)` : 'No stop fits'}</span>
              </span>
              <ChevronRight size={18} className="tertiary" />
            </button>
          )}
          {!l && (
            <>
              <div className="mapp-chips">
                {[['coffee', 'Coffee'], ['restaurant', 'Restaurants'], ['park', 'Parks'], ['library', 'Libraries'], ['shopping', 'Shopping']].map(([k, label]) => {
                  const c = catOf(k)
                  return <button key={k} className="mapp-chip" onClick={() => setQ(label)}><span style={{ background: c.color }}><c.Icon size={13} color="#fff" strokeWidth={2.6} /></span>{label}</button>
                })}
              </div>
              <div className="mapp-hint"><Sparkles size={14} /> Try: <button onClick={() => setQ("Coffee shop on the way home that doesn't add more than ten minutes")}>“Coffee shop on the way home that doesn’t add more than ten minutes”</button></div>
            </>
          )}
          {matches.map((p) => <PlaceRow key={p.id} p={p} onClick={() => onPlace(p.id)} />)}
          {l && !matches.length && !nlPlan && <div className="empty-state" style={{ padding: 30 }}>No results for “{q}”</div>}
        </div>
      ) : (
        <div className="mapp-scroll scroll">
          <div className="mapp-sec-h">Favorites</div>
          <div className="mapp-favs">
            {loc.favorites.map((id) => {
              const p = placeById(id)
              if (!p) return null
              const c = catOf(p.kind)
              const m = driveMins(p)
              return (
                <button key={id} className="mapp-fav" onClick={() => (id === 'school' ? onPlace(id) : onRoute(id))} onContextMenu={(e) => { e.preventDefault(); openMenu(e.currentTarget, [{ label: 'Remove from Favorites', destructive: true, icon: <Trash2 size={18} />, onSelect: () => loc.set({ favorites: loc.favorites.filter((f) => f !== id) }) }]) }}>
                  <span className="mapp-fav-ico" style={{ background: id === 'home' ? '#007aff' : c.color }}><c.Icon size={24} color="#fff" strokeWidth={2.2} /></span>
                  <span className="mapp-fav-name">{p.id === 'home' ? 'Home' : p.name.split(' ')[0].replace('’s', '')}</span>
                  <span className="mapp-fav-sub">{id === 'school' ? 'Here' : `${m} min`}</span>
                </button>
              )
            })}
            <button className="mapp-fav" onClick={(e) => openMenu(e.currentTarget, PLACES.filter((p) => !loc.favorites.includes(p.id)).map((p) => ({ label: p.name, onSelect: () => loc.set({ favorites: [...loc.favorites, p.id] }) })), { title: 'Add Favorite' })}>
              <span className="mapp-fav-ico add"><Plus size={24} strokeWidth={2.4} /></span>
              <span className="mapp-fav-name">Add</span>
              <span className="mapp-fav-sub">&nbsp;</span>
            </button>
          </div>
          <div className="mapp-card">
            <button className="mapp-row" onClick={() => onOpen({ k: 'visited' })}><span className="mapp-ico" style={{ background: '#5856d6' }}><History size={17} /></span><span className="grow">Visited Places<span className="mapp-new">IMPROVED</span></span><span className="secondary">{VISITED.length}</span><ChevronRight size={17} className="tertiary" /></button>
            <button className="mapp-row" onClick={() => onOpen({ k: 'offline' })}><span className="mapp-ico" style={{ background: '#34c759' }}><CloudDownload size={17} /></span><span className="grow">Offline Maps</span><span className="secondary">{loc.downloads.length}</span><ChevronRight size={17} className="tertiary" /></button>
            <button className="mapp-row" onClick={() => onOpen({ k: 'guides' })}><span className="mapp-ico" style={{ background: '#ff2d55' }}><BookOpen size={17} /></span><span className="grow">Guides</span><span className="secondary">{GUIDES.length}</span><ChevronRight size={17} className="tertiary" /></button>
          </div>
          <div className="mapp-sec-h">Recents</div>
          <div className="mapp-card">
            {loc.recents.map((r) => {
              if (r.kind === 'query') return (
                <button key={`q${r.id}`} className="mapp-row" onClick={() => onNL(r.id)}><span className="mapp-ico" style={{ background: 'var(--fill)' }}><AISparkle size={16} /></span><span className="grow nowrap">{r.id}</span></button>
              )
              const p = placeById(r.id)
              return p ? <PlaceRow key={r.id} p={p} onClick={() => onPlace(p.id)} sub={`${fmtRelative(r.ts)} · ${p.address}`} /> : null
            })}
            <button className="mapp-row accent" onClick={() => loc.set({ recents: [] })} style={{ justifyContent: 'center' }}>Clear Recents</button>
          </div>
        </div>
      )}
    </div>
  )
}

function PlaceRow({ p, onClick, sub }: { p: Place; onClick: () => void; sub?: string }) {
  const c = catOf(p.kind)
  return (
    <button className="mapp-row" onClick={onClick}>
      <span className="mapp-ico round" style={{ background: c.color }}><c.Icon size={16} color="#fff" strokeWidth={2.4} /></span>
      <span className="grow" style={{ minWidth: 0 }}>
        <span className="nowrap" style={{ display: 'block' }}>{p.name}</span>
        <span className="t-footnote secondary nowrap" style={{ display: 'block' }}>{sub ?? `${c.label} · ${distFromHere(p)}${p.rating ? ` · ★ ${p.rating}` : ''}`}</span>
      </span>
    </button>
  )
}

// ------------------------------------------------------------------ place card
function PlacePanel({ id, onClose, onRoute, onFlyover }: { id: string; onClose: () => void; onRoute: (id: string) => void; onFlyover: (p: Place) => void }) {
  const p = placeById(id)!
  const loc = useMaps()
  const c = catOf(p.kind)
  const mins = driveMins(p)
  const fav = loc.favorites.includes(id)
  const phone = PHONE_CONTACT[id]
  return (
    <div className="mapp-place">
      <PanelHeader
        title={p.name}
        subtitle={<>{c.label} · {distFromHere(p)}{p.hours && <> · <span className="mapp-open">{p.hours}</span></>}</>}
        onClose={onClose}
        trailing={<button className="mapp-x" aria-label="Share" onClick={() => useOS.getState().set({ shareRequest: { title: p.name, kind: 'link', payload: `maps.example/place/${p.id}`, app: 'maps' } })}><Share size={16} strokeWidth={2.4} /></button>}
      />
      <div className="mapp-scroll scroll">
        <div className="mapp-actions">
          <button className="mapp-act primary" onClick={() => onRoute(id)}><CarFront size={20} /><span>{mins <= 1 ? 'Directions' : `${mins} min`}</span></button>
          <button className="mapp-act" disabled={!phone} onClick={() => phone && useOS.getState().launch('phone', { route: `call/${phone}` })}><Phone size={20} /><span>Call</span></button>
          <button className="mapp-act" onClick={() => useOS.getState().launch('safari', { route: `url/${p.id}.example` })}><Globe size={20} /><span>Website</span></button>
          <button className="mapp-act" onClick={() => { loc.set({ favorites: fav ? loc.favorites.filter((f) => f !== id) : [...loc.favorites, id] }); useOS.getState().showToast(fav ? 'Removed from Favorites' : 'Added to Favorites') }}><Star size={20} fill={fav ? 'currentColor' : 'none'} /><span>{fav ? 'Saved' : 'Save'}</span></button>
        </div>
        {p.rating > 0 && (
          <div className="mapp-stats">
            <div><span className="k">Hours</span><span className="v mapp-open">{p.hours?.replace('Open until', 'Open · until') ?? 'Open 24 hours'}</span></div>
            <div><span className="k">{reviews(p)} Ratings</span><span className="v">★ {p.rating}</span></div>
            <div><span className="k">Distance</span><span className="v">{distFromHere(p)}</span></div>
          </div>
        )}
        <div className="mapp-photos">
          {(SCENES[p.kind] ?? SCENES.home).map((s) => <div key={s} className="mapp-photo"><Scene scene={s} /></div>)}
        </div>
        <div className="mapp-card">
          <div className="mapp-row static"><span className="grow"><span className="t-footnote secondary" style={{ display: 'block' }}>Address</span>{p.address}<br />Maple Grove</span></div>
          {phone && <div className="mapp-row static"><span className="grow"><span className="t-footnote secondary" style={{ display: 'block' }}>Phone</span><span className="accent">(555) 010-{p.name.length * 137 % 9000 + 1000}</span></span></div>}
          {GUIDES.some((g) => g.places.includes(id)) && <div className="mapp-row static"><span className="grow"><span className="t-footnote secondary" style={{ display: 'block' }}>Featured in</span>{GUIDES.filter((g) => g.places.includes(id)).map((g) => g.title).join(', ')}</span></div>}
          <button className="mapp-row" onClick={() => onFlyover(p)}><span className="mapp-ico" style={{ background: '#5ac8fa' }}><Orbit size={16} /></span><span className="grow">Flyover</span><ChevronRight size={17} className="tertiary" /></button>
        </div>
      </div>
    </div>
  )
}

// ------------------------------------------------------------------ route preview
function RoutePanel({ panel, data, onClose, onGo, onPanel }: {
  panel: Extract<Panel, { k: 'route' }>
  data: { dest: Place; via?: Place; options: RouteResult[]; direct: RouteResult | null }
  onClose: () => void
  onGo: (r: RouteResult) => void
  onPanel: (p: Panel) => void
}) {
  const modes: Mode[] = ['drive', 'walk', 'transit', 'bike']
  const times = useMemo(() => Object.fromEntries(modes.map((m) => [m, (data.via ? routeVia(HERE, data.via, data.dest, m, data.via.name, data.dest.name) : route(HERE, data.dest, m, data.dest.name))?.minutes ?? 0])), [data.dest, data.via]) // eslint-disable-line react-hooks/exhaustive-deps
  const fmtM = (m: number) => (m >= 60 ? `${Math.floor(m / 60)} hr ${m % 60}` : `${m} min`)
  return (
    <div className="mapp-route">
      <PanelHeader title="Directions" onClose={onClose} />
      <div className="mapp-scroll scroll">
        <div className="mapp-card mapp-fromto">
          <div className="mapp-row static"><span className="mapp-dot blue" /><span className="grow">My Location</span></div>
          {data.via && (
            <div className="mapp-row static"><span className="mapp-dot stop" /><span className="grow">{data.via.name}<span className="t-footnote secondary" style={{ display: 'block' }}>Stop · adds {data.direct ? Math.max(1, data.options[0]?.minutes - data.direct.minutes) : 0} min</span></span>
              <button className="mapp-x small" aria-label="Remove stop" onClick={() => onPanel({ ...panel, via: undefined, sel: 0 })}><X size={14} strokeWidth={3} /></button>
            </div>
          )}
          <div className="mapp-row static"><span className="mapp-dot red" /><span className="grow">{data.dest.name}</span>
            <button className="mapp-x small" aria-label="Add stop" onClick={(e) => openMenu(e.currentTarget, PLACES.filter((p) => p.id !== data.dest.id && p.id !== 'school').map((p) => ({ label: p.name, onSelect: () => onPanel({ ...panel, via: p.id, sel: 0 }) })), { title: 'Add Stop' })}><Plus size={15} strokeWidth={3} /></button>
          </div>
        </div>
        <div className="mapp-modes">
          {modes.map((m) => (
            <button key={m} className={m === panel.mode ? 'on' : ''} onClick={() => onPanel({ ...panel, mode: m, sel: 0 })} aria-pressed={m === panel.mode}>
              {MODE_ICON[m]}<span>{times[m] ? fmtM(times[m]) : '—'}</span>
            </button>
          ))}
        </div>
        {data.options.length === 0 && <div className="empty-state" style={{ padding: 20 }}>No {MODE_LABEL[panel.mode].toLowerCase()} route available.</div>}
        <div className="mapp-card">
          {data.options.map((r, i) => (
            <div key={i} className={`mapp-opt ${i === panel.sel ? 'sel' : ''}`} onClick={() => onPanel({ ...panel, sel: i })} role="button" tabIndex={0}>
              <div className="grow">
                <div className="mapp-opt-time">{fmtM(r.minutes)}</div>
                <div className="t-subhead secondary">{r.miles} mi · via {r.via}{panel.mode === 'transit' ? ' · Route 12 bus' : ''}</div>
                <div className="t-footnote" style={{ color: i === 0 ? 'var(--green)' : 'var(--label-secondary)' }}>{i === 0 ? (data.via ? `Includes stop at ${data.via.name}` : 'Fastest route · light traffic') : `${r.minutes - data.options[0].minutes >= 0 ? '+' : ''}${r.minutes - data.options[0].minutes} min · ${i === 1 ? 'Fewer turns' : 'Avoids busy roads'}`}</div>
              </div>
              <button className="mapp-go" onClick={(e) => { e.stopPropagation(); onGo(r) }}>GO</button>
            </div>
          ))}
        </div>
        {data.options[panel.sel] && (
          <>
            <div className="mapp-sec-h">Steps</div>
            <div className="mapp-card">
              {data.options[panel.sel].steps.map((s, i) => (
                <div key={i} className="mapp-row static"><span className="mapp-turn"><TurnIcon turn={s.turn} size={20} /></span><span className="grow">{s.instruction}{s.len > 0 && <span className="t-footnote secondary" style={{ display: 'block' }}>{(s.len * 0.006).toFixed(1)} mi</span>}</span></div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ------------------------------------------------------------------ natural-language route result
function NLPanel({ q, plan, onClose, onRoute, onPlace }: { q: string; plan: DetourPlan | null; onClose: () => void; onRoute: (dest: string, via?: string) => void; onPlace: (id: string) => void }) {
  const [thinking, setThinking] = useState(true)
  useEffect(() => { setThinking(true); const t = window.setTimeout(() => setThinking(false), 900); return () => window.clearTimeout(t) }, [q])
  return (
    <div className="mapp-nl">
      <PanelHeader title={<span className="row gap6"><AISparkle size={18} /> Route Search</span>} subtitle={`“${q}”`} onClose={onClose} />
      <div className="mapp-scroll scroll">
        {thinking ? (
          <div className="mapp-thinking"><Spinner /> Checking stops along your route…</div>
        ) : !plan ? (
          <div className="empty-state">I couldn’t find a stop for that. Try “coffee on the way home under 10 minutes”.</div>
        ) : (
          <>
            <div className="mapp-nl-answer anim-up">{plan.text}</div>
            <div className="mapp-sec-h">Options on the way {plan.dest.id === 'home' ? 'home' : `to ${plan.dest.name}`}</div>
            <div className="mapp-card">
              {plan.options.map((o) => (
                <button key={o.p.id} className="mapp-row" onClick={() => onPlace(o.p.id)}>
                  <span className="mapp-ico round" style={{ background: catOf(o.p.kind).color }}>{(() => { const C = catOf(o.p.kind).Icon; return <C size={16} color="#fff" /> })()}</span>
                  <span className="grow"><span style={{ display: 'block' }}>{o.p.name}</span><span className="t-footnote secondary">★ {o.p.rating} · {o.p.hours ?? 'Open'} · total {o.r.minutes} min</span></span>
                  <span className={`mapp-add ${o.add <= plan.limit ? 'ok' : 'no'}`}>+{o.add} min</span>
                  {o === plan.pick && <Check size={18} color="var(--green)" strokeWidth={3} />}
                </button>
              ))}
            </div>
            <div className="mapp-card" style={{ padding: 12 }}>
              <div className="row gap8 t-subhead"><Clock size={16} /> Direct: {plan.direct.minutes} min · with stop: {plan.pick?.r.minutes ?? '—'} min</div>
            </div>
            {plan.pick && <button className="btn filled block" style={{ margin: '4px 0 16px' }} onClick={() => onRoute(plan.dest.id, plan.pick!.p.id)}>Route with Stop at {plan.pick.p.name}</button>}
          </>
        )}
      </div>
    </div>
  )
}

// ------------------------------------------------------------------ visited places (iOS 27: confidence + confirm/edit)
const CONFIDENCE = [0.99, 0.93, 0.88, 0.71, 0.95, 0.62]
function VisitedPanel({ onClose, onPlace }: { onClose: () => void; onPlace: (id: string) => void }) {
  const loc = useMaps()
  const edit = (i: number, e: MapsLocal['visitedEdits'][number]) => loc.set({ visitedEdits: { ...loc.visitedEdits, [i]: e } })
  const items = VISITED.map((v, i) => ({ ...v, i, conf: CONFIDENCE[i] ?? 0.8, e: loc.visitedEdits[i] })).filter((v) => v.e?.status !== 'removed')
  const days = [...new Set(items.map((v) => startOfDay(v.when)))]
  return (
    <div className="mapp-visited">
      <PanelHeader title="Visited Places" subtitle="Stored on this iPhone with end-to-end encryption" onClose={onClose} />
      <div className="mapp-scroll scroll">
        <div className="mapp-card">
          <div className="mapp-row static"><span className="mapp-ico" style={{ background: '#5856d6' }}><ShieldCheck size={17} /></span><span className="grow">Visited Places</span><Switch checked={loc.visitedEnabled} onChange={(v) => loc.set({ visitedEnabled: v })} label="Visited Places" /></div>
        </div>
        {!loc.visitedEnabled && <div className="empty-state" style={{ padding: 20 }}>Visited Places is off. Maps won’t remember places you go.</div>}
        {loc.visitedEnabled && days.map((d) => (
          <div key={d}>
            <div className="mapp-sec-h">{fmtRelative(d) === 'Yesterday' || d === startOfDay() ? (d === startOfDay() ? 'Today' : 'Yesterday') : new Date(d).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</div>
            <div className="mapp-card">
              {items.filter((v) => startOfDay(v.when) === d).map((v) => {
                const name = v.e?.place ?? v.place
                const p = PLACES.find((x) => x.name === name)
                const confirmed = v.e?.status === 'confirmed'
                const low = v.conf < 0.8 && !confirmed
                const t = new Date(v.when)
                return (
                  <div key={v.i} className="mapp-visit">
                    <div className="row gap12">
                      <span className="mapp-ico round" style={{ background: catOf(p?.kind ?? 'park').color }}>{(() => { const C = catOf(p?.kind ?? 'guide').Icon; return <C size={16} color="#fff" /> })()}</span>
                      <button className="grow" style={{ textAlign: 'left' }} onClick={() => p && onPlace(p.id)}>
                        <span style={{ display: 'block' }}>{name}</span>
                        <span className="t-footnote secondary">{t.getHours() % 12 || 12}:{String(t.getMinutes()).padStart(2, '0')} {t.getHours() >= 12 ? 'PM' : 'AM'} · {v.duration}</span>
                      </button>
                      <span className={`mapp-conf ${confirmed ? 'ok' : low ? 'low' : ''}`}>{confirmed ? 'Confirmed' : `${Math.round(v.conf * 100)}%`}</span>
                      <button className="mapp-x small" aria-label="Edit visit" onClick={(e) => openMenu(e.currentTarget, [
                        { label: 'Confirm', icon: <Check size={18} />, onSelect: () => edit(v.i, { ...v.e, status: 'confirmed' }) },
                        { label: 'Change Place…', icon: <MapPinned size={18} />, onSelect: () => window.setTimeout(() => openMenu(e.currentTarget as HTMLElement, PLACES.filter((x) => x.kind !== 'home').map((x) => ({ label: x.name, onSelect: () => edit(v.i, { status: 'confirmed', place: x.name }) })), { title: 'Where were you?' }), 60) },
                        { label: 'Remove Visit', icon: <Trash2 size={18} />, destructive: true, onSelect: () => edit(v.i, { status: 'removed' }) },
                      ])}><ChevronRight size={16} /></button>
                    </div>
                    {low && (
                      <div className="mapp-ask">
                        <span className="grow">Were you at {name}?</span>
                        <button className="btn small tinted" onClick={() => edit(v.i, { status: 'confirmed' })}>Yes</button>
                        <button className="btn small gray" onClick={(e) => openMenu(e.currentTarget, PLACES.filter((x) => x.kind !== 'home').map((x) => ({ label: x.name, onSelect: () => edit(v.i, { status: 'confirmed', place: x.name }) })), { title: 'Where were you?' })}>No, Edit</button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
        {loc.visitedEnabled && Object.keys(loc.visitedEdits).length > 0 && <button className="btn plain block" onClick={() => loc.set({ visitedEdits: {} })}>Reset Edits</button>}
        <div className="mapp-foot">Confidence improves as you confirm visits. Low-confidence visits ask before they’re used for suggestions.</div>
      </div>
    </div>
  )
}

// ------------------------------------------------------------------ offline maps
const AVAILABLE = [{ id: 'seattle', name: 'Seattle', mb: 684 }, { id: 'cupertino', name: 'Cupertino & San José', mb: 530 }, { id: 'state-fair', name: 'State Fair Expo Area', mb: 96 }]
function OfflinePanel({ onClose }: { onClose: () => void }) {
  const loc = useMaps()
  const [dl, setDl] = useState<{ id: string; p: number } | null>(null)
  const [checking, setChecking] = useState(false)
  useEffect(() => {
    if (!dl) return
    if (dl.p >= 1) {
      const a = AVAILABLE.find((x) => x.id === dl.id)!
      loc.set({ downloads: [...loc.downloads, { id: a.id, name: a.name, mb: a.mb, updated: Date.now() }] })
      useOS.getState().showToast(`${a.name} downloaded`)
      setDl(null)
      return
    }
    const t = window.setTimeout(() => setDl({ ...dl, p: Math.min(1, dl.p + 0.07) }), 160)
    return () => window.clearTimeout(t)
  }, [dl]) // eslint-disable-line react-hooks/exhaustive-deps
  const check = () => { setChecking(true); window.setTimeout(() => { setChecking(false); loc.set({ lastCheck: Date.now(), downloads: loc.downloads.map((d) => ({ ...d, updated: Date.now() })) }) }, 1600) }
  const total = loc.downloads.reduce((a, d) => a + d.mb, 0)
  const since = Math.round((Date.now() - loc.lastCheck) / 60000)
  return (
    <div className="mapp-offline">
      <PanelHeader title="Offline Maps" subtitle={`${(total / 1000).toFixed(2)} GB used`} onClose={onClose} />
      <div className="mapp-scroll scroll">
        <div className="mapp-sec-h">Downloaded</div>
        <div className="mapp-card">
          {loc.downloads.map((d) => (
            <div key={d.id} className="mapp-row static">
              <span className="mapp-ico" style={{ background: '#34c759' }}><MapPinned size={16} /></span>
              <span className="grow"><span style={{ display: 'block' }}>{d.name}</span><span className="t-footnote secondary">{d.mb} MB · Updated {fmtRelative(d.updated)}</span></span>
              <button className="mapp-x small" aria-label={`Delete ${d.name}`} onClick={() => showAlert({ title: `Delete ${d.name}?`, message: `Frees ${d.mb} MB.`, actions: [{ label: 'Cancel', style: 'cancel' }, { label: 'Delete', style: 'destructive', onPress: () => loc.set({ downloads: loc.downloads.filter((x) => x.id !== d.id) }) }] })}><Trash2 size={14} /></button>
            </div>
          ))}
          {loc.downloads.length === 0 && <div className="mapp-row static secondary">No offline maps</div>}
        </div>
        <div className="mapp-sec-h">Updates</div>
        <div className="mapp-card">
          <div className="mapp-row static"><span className="grow">Automatic Updates<span className="t-footnote secondary" style={{ display: 'block' }}>Smarter in iOS 27: updates only changed tiles, on Wi-Fi & while charging</span></span><Switch checked={loc.autoUpdate} onChange={(v) => loc.set({ autoUpdate: v })} label="Automatic Updates" /></div>
          <div className="mapp-row static">
            <span className="grow">{checking ? 'Checking for updates…' : 'Up to date'}<span className="t-footnote secondary" style={{ display: 'block' }}>{checking ? 'Comparing 1,284 tiles' : `Checked ${since < 1 ? 'just now' : since < 60 ? `${since} min ago` : `${Math.round(since / 60)} hr ago`}${loc.autoUpdate ? ' · next check tonight' : ''}`}</span></span>
            {checking ? <Spinner /> : <button className="btn small tinted" onClick={check}>Check Now</button>}
          </div>
          <div className="mapp-row static"><span className="grow">Only Use Offline Maps</span><Switch checked={loc.onlyOffline} onChange={(v) => loc.set({ onlyOffline: v })} label="Only Use Offline Maps" /></div>
        </div>
        <div className="mapp-sec-h">Suggested Downloads</div>
        <div className="mapp-card">
          {AVAILABLE.filter((a) => !loc.downloads.some((d) => d.id === a.id)).map((a) => (
            <div key={a.id} className="mapp-row static">
              <span className="grow"><span style={{ display: 'block' }}>{a.name}</span><span className="t-footnote secondary">{a.id === 'seattle' ? 'For your trip Nov 21 · ' : ''}{a.mb} MB</span>
                {dl?.id === a.id && <span className="mapp-progress"><i style={{ width: `${dl.p * 100}%` }} /></span>}
              </span>
              <button className="btn small tinted" disabled={!!dl} onClick={() => setDl({ id: a.id, p: 0 })}>{dl?.id === a.id ? `${Math.round(dl.p * 100)}%` : 'Download'}</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ------------------------------------------------------------------ guides
function GuidesPanel({ onClose, onGuide }: { onClose: () => void; onGuide: (id: string) => void }) {
  return (
    <div>
      <PanelHeader title="Guides" subtitle="Curated by locals" onClose={onClose} />
      <div className="mapp-scroll scroll">
        {GUIDES.map((g) => (
          <button key={g.id} className="mapp-guide" onClick={() => onGuide(g.id)}>
            <div className="mapp-guide-img"><Scene scene={g.scene} /></div>
            <div className="mapp-guide-txt"><div className="t-headline">{g.title}</div><div className="t-footnote secondary">{g.by} · {g.places.length} places</div></div>
          </button>
        ))}
      </div>
    </div>
  )
}
function GuidePanel({ id, onClose, onPlace }: { id: string; onClose: () => void; onPlace: (id: string) => void }) {
  const g = GUIDES.find((x) => x.id === id)!
  return (
    <div>
      <PanelHeader title={g.title} subtitle={g.by} onClose={onClose} />
      <div className="mapp-scroll scroll">
        <div className="mapp-guide-hero"><Scene scene={g.scene} /></div>
        <p className="t-body" style={{ margin: '4px 4px 12px' }}>{g.blurb}</p>
        <div className="mapp-card">{g.places.map((pid) => <PlaceRow key={pid} p={placeById(pid)!} onClick={() => onPlace(pid)} />)}</div>
      </div>
    </div>
  )
}

// ------------------------------------------------------------------ navigation UI
function NavigationView() {
  const nav = useNavSim()
  const [overview, setOverview] = useState(false)
  if (!nav.route) return null
  const s = navSummary(nav)
  const cur = nav.route.steps[nav.step]
  const camera: Camera = overview
    ? (() => {
      const xs = nav.route.pts.map((p) => p.x)
      const ys = nav.route.pts.map((p) => p.y)
      return { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2, z: 0.6, heading: 0, tilt: 0 }
    })()
    : { x: nav.pos.x, y: nav.pos.y, z: 2.1, heading: nav.heading, tilt: 52 }
  const dest = placeById(nav.destId)
  return (
    <>
      <MapView
        camera={camera}
        interactive={false}
        animate={overview}
        routes={[{ id: 'nav', pts: nav.route.pts, width: 9 }]}
        pins={dest ? [{ id: 'dest', x: dest.x, y: dest.y, node: <PlacePin kind={dest.kind} label={dest.name} selected /> }] : []}
        user={{ p: nav.pos, heading: nav.heading }}
        anchorY={overview ? 0.45 : 0.7}
        labels
      />
      {nav.arrived ? (
        <div className="mapp-arrived glass heavy anim-up">
          <div className="mapp-arrived-ico"><Flag size={30} /></div>
          <div className="t-title2">You’ve arrived</div>
          <div className="t-body secondary">{nav.destName}</div>
          <button className="btn filled block" onClick={dismissArrival}>Done</button>
        </div>
      ) : (
        <>
          <div className="mapp-banner anim-up">
            <div className="mapp-banner-main">
              <span className="mapp-banner-turn"><TurnIcon turn={s.next.turn} size={40} /></span>
              <div className="grow">
                <div className="mapp-banner-dist">{s.toNext}</div>
                <div className="mapp-banner-ins">{s.next.instruction}</div>
              </div>
            </div>
            {s.then && <div className="mapp-banner-then">Then <TurnIcon turn={s.then.turn} size={16} /> {s.then.road}</div>}
          </div>
          <div className="mapp-navbar glass heavy">
            <div className="grow">
              <div className="mapp-nav-eta"><b>{s.arrival}</b></div>
              <div className="mapp-nav-sub">{s.mins} min · {s.miles} mi{nav.viaName ? ` · via ${nav.viaName}` : ''} · on {cur?.road}</div>
            </div>
            <button className="mapp-x" aria-label={overview ? 'Resume' : 'Overview'} onClick={() => setOverview(!overview)}>{overview ? <Navigation size={17} fill="currentColor" strokeWidth={0} /> : <MapPinned size={17} />}</button>
            <button className="mapp-end" onClick={() => endNavigation()}>End</button>
          </div>
        </>
      )}
    </>
  )
}

// ------------------------------------------------------------------ Flyover (CSS 3D city + orbiting camera)
function Flyover({ target, onClose }: { target: { x: number; y: number; name: string }; onClose: () => void }) {
  const [heading, setHeading] = useState(-30)
  const [playing, setPlaying] = useState(true)
  const reduce = useOS((s) => s.reduceMotion)
  const low = useOS((s) => s.lowPower)
  const [t, setT] = useState(0)
  useEffect(() => {
    if (!playing || reduce) return
    let raf = 0
    let last = performance.now()
    const loop = (now: number) => {
      const dt = Math.min(64, now - last)
      last = now
      setHeading((h) => h + dt * (low ? 0.008 : 0.014))
      setT((x) => x + dt)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [playing, reduce, low])
  const r = 36
  const cx = target.x + Math.sin(t / 5200) * r
  const cy = target.y + Math.cos(t / 5200) * r * 0.6
  return (
    <div className="mapp-flyover anim-fade">
      <MapView camera={{ x: cx, y: cy, z: 2.2 + Math.sin(t / 7000) * 0.2, heading, tilt: 60 }} interactive={false} buildings3d labels={false} anchorY={0.58}
        pins={PLACES.filter((p) => Math.hypot(p.x - target.x, p.y - target.y) < 260).map((p) => ({ id: p.id, x: p.x, y: p.y, node: <PlacePin kind={p.kind} label={p.name} small /> }))} />
      <div className="mapp-fly-sky" />
      <div className="mapp-fly-top">
        <div className="glass dark-glass mapp-fly-title"><Orbit size={16} /> Flyover · {target.name}</div>
        <button className="mapp-fly-btn glass dark-glass" aria-label="Close Flyover" onClick={onClose}><X size={20} strokeWidth={2.6} /></button>
      </div>
      <div className="mapp-fly-bottom">
        <button className="mapp-fly-btn glass dark-glass" aria-label={playing ? 'Pause tour' : 'Play tour'} onClick={() => setPlaying(!playing)}>{playing ? <Pause size={20} fill="#fff" strokeWidth={0} /> : <Play size={20} fill="#fff" strokeWidth={0} />}</button>
        <div className="glass dark-glass mapp-fly-cap">{Math.round((((heading % 360) + 360) % 360))}° · City Tour</div>
      </div>
    </div>
  )
}

