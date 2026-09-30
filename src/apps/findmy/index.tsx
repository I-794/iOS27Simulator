import { useEffect, useMemo, useRef, useState, type ReactNode, type CSSProperties } from 'react'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { Users, Smartphone, Headphones, Tablet, Monitor, CircleDot, UserRound, MessageCircle, Navigation, Bell, Volume2, Lock, Eraser, X, Check, ChevronRight, Share2, Crosshair, Star, Flashlight, Pause, Play, MapPin as PinIcon, Plus, Clock, Infinity as InfinityIcon, Sun } from 'lucide-react'
import { TabBar } from '../../ui/nav'
import { Avatar, Switch, Spinner } from '../../ui/controls'
import { Sheet, openMenu, showAlert } from '../../ui/overlay'
import { useOS } from '../../os/store'
import { useAppRoute, useOnscreen, useDrag, useNow } from '../../os/hooks'
import { playAlert } from '../../os/audio'
import { useShell } from '../../shell/shellState'
import { FINDMY } from '../../os/data/world'
import { CONTACTS, contactName } from '../../os/data/people'
import { MapView, type Camera, type MapPin } from '../maps/MapView'
import { HERE, PLACES, straightMiles, type Pt } from '../maps/geo'
import { usePrecision, startPrecision, stopPrecision, togglePause, fmtFt, hintFor } from './precision'
import './findmy.css'

type Tab = 'people' | 'devices' | 'items' | 'me'
type Sel = { kind: 'person' | 'device' | 'item'; id: string } | null
type Detent = 'peek' | 'mid' | 'full'

interface Share { until: number | null; since: number; precise: boolean }
interface FMLocal {
  sharing: Record<string, Share>
  shareEnabled: boolean
  locationName: string
  friendRequests: boolean
  notify: Record<string, boolean>
  lost: Record<string, boolean>
  erasing: Record<string, boolean>
  favorites: string[]
  set: (p: Partial<FMLocal>) => void
}
const endOfDay = () => { const d = new Date(); d.setHours(23, 59, 0, 0); return d.getTime() }
const useFM = create<FMLocal>()(persist((set) => ({
  sharing: { mom: { until: null, since: Date.now() - 90 * 86_400_000, precise: true }, dad: { until: null, since: Date.now() - 90 * 86_400_000, precise: true }, alex: { until: endOfDay(), since: Date.now() - 3 * 3600_000, precise: true } },
  shareEnabled: true,
  locationName: 'School',
  friendRequests: true,
  notify: {},
  lost: {},
  erasing: {},
  favorites: ['mom', 'mia'],
  set: (p) => set(p),
}), { name: 'ios27-findmy', partialize: ({ set: _s, ...r }) => { void _s; return r } }))

const HOME: Pt = { x: 240, y: 620 }
const DEVICE_PT: Record<string, Pt> = { iphone: HERE, airpods: { x: HERE.x + 6, y: HERE.y + 4 }, ipad: HOME, mac: { x: HOME.x + 12, y: HOME.y - 8 } }
const ITEM_PT: Record<string, Pt> = { keys: { x: HOME.x - 30, y: HOME.y - 8 }, backpack: { x: 548, y: 292 }, percbag: { x: 590, y: 280 }, collar: { x: HOME.x + 34, y: HOME.y + 46 } }
const DEVICE_ICON: Record<string, (s: number) => ReactNode> = {
  iphone: (s) => <Smartphone size={s} />, airpods: (s) => <Headphones size={s} />, ipad: (s) => <Tablet size={s} />, mac: (s) => <Monitor size={s} />,
}
const PRECISION_START: Record<string, number> = { alex: 420, mia: 360 }

const distStr = (p: Pt) => { const mi = straightMiles(HERE, p); return mi < 0.05 ? 'With You' : `${mi.toFixed(1)} mi` }
const nearestPlace = (p: Pt) => [...PLACES].sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0]

function remaining(s: Share, now: number) {
  if (s.until === null) return 'Indefinitely'
  const ms = s.until - now
  if (ms <= 0) return 'Expired'
  if (ms < 3600_000) return `${Math.ceil(ms / 60000)} min left`
  if (new Date(s.until).toDateString() === new Date(now).toDateString()) return 'Until end of day'
  return `Until ${new Date(s.until).toLocaleDateString('en-US', { weekday: 'short' })}`
}

export default function FindMyApp() {
  const [tab, setTab] = useState<Tab>('people')
  const [sel, setSel] = useState<Sel>(null)
  const [detent, setDetent] = useState<Detent>('mid')
  const [cam, setCam] = useState<Camera>({ x: 520, y: 430, z: 0.62 })
  const [anim, setAnim] = useState(false)
  const [shareOpen, setShareOpen] = useState<string[] | null>(null)
  const [size, setSize] = useState({ w: 402, h: 874 })
  const ref = useRef<HTMLDivElement>(null)
  const prec = usePrecision()
  const landscape = useOS((s) => s.orientation === 'landscape')
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const m = () => setSize({ w: el.offsetWidth || 402, h: el.offsetHeight || 874 })
    m()
    const ro = new ResizeObserver(m)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const heights: Record<Detent, number> = landscape ? { peek: 170, mid: size.h - 110, full: size.h - 100 } : { peek: 200, mid: Math.round(size.h * 0.46), full: size.h - 150 }
  const sheetH = heights[detent]
  const anchorY = landscape ? 0.5 : Math.max(0.22, Math.min(0.5, ((size.h - sheetH - 90) / 2 + 30) / size.h))
  const anchorX = landscape ? (370 + (size.w - 370) / 2) / size.w : 0.5

  const flyTo = (p: Pt, z = 1.5) => { setAnim(true); setCam({ x: p.x, y: p.y, z }); window.setTimeout(() => setAnim(false), 900) }
  const open = (s: NonNullable<Sel>) => {
    setSel(s)
    setTab(s.kind === 'person' ? 'people' : s.kind === 'device' ? 'devices' : 'items')
    if (detent === 'peek') setDetent('mid')
    const p = s.kind === 'person' ? FINDMY.people.find((x) => x.id === s.id)! : s.kind === 'device' ? DEVICE_PT[s.id] : ITEM_PT[s.id]
    if (p) flyTo(p, 1.6)
  }
  useAppRoute('findmy', (r) => {
    const m = r.match(/^(person|device|item)\/(.+)$/)
    if (m) open({ kind: m[1] as 'person' | 'device' | 'item', id: m[2] })
    else if (r === 'me') { setSel(null); setTab('me') }
  })
  useOnscreen('findmy', sel ? `Find My: ${sel.kind} ${sel.id}` : `Find My ${tab}`)

  const pins: MapPin[] = useMemo(() => {
    const out: MapPin[] = []
    if (tab === 'people' || tab === 'me') for (const p of FINDMY.people) out.push({ id: p.id, x: p.x, y: p.y, zIndex: sel?.id === p.id ? 20 : 10, onClick: () => open({ kind: 'person', id: p.id }), node: <div className={`fm-pin ${sel?.id === p.id ? 'sel' : ''}`}><Avatar id={p.id} size={sel?.id === p.id ? 50 : 38} /><span className="fm-pin-name">{contactName(p.id)}</span></div> })
    if (tab === 'devices') for (const d of FINDMY.devices) if (d.id !== 'iphone') out.push({ id: d.id, ...DEVICE_PT[d.id], zIndex: sel?.id === d.id ? 20 : 10, onClick: () => open({ kind: 'device', id: d.id }), node: <div className={`fm-pin dev ${sel?.id === d.id ? 'sel' : ''}`}><span className="fm-pin-ico">{DEVICE_ICON[d.kind](20)}</span><span className="fm-pin-name">{d.name.replace('Jamie’s ', '')}</span></div> })
    if (tab === 'items') for (const it of FINDMY.items) out.push({ id: it.id, ...ITEM_PT[it.id], zIndex: sel?.id === it.id ? 20 : 10, onClick: () => open({ kind: 'item', id: it.id }), node: <div className={`fm-pin item ${sel?.id === it.id ? 'sel' : ''}`}><span className="fm-pin-ico">{it.emoji}</span><span className="fm-pin-name">{it.name}</span></div> })
    return out
  }, [tab, sel]) // eslint-disable-line react-hooks/exhaustive-deps

  const drag = useDrag({
    onStart: (e) => !!(e.target as HTMLElement).closest('.fm-grab'),
    onMove: (_dx, dy) => { const el = ref.current?.querySelector<HTMLElement>('.fm-sheet'); if (el) { el.style.transition = 'none'; el.style.height = `${Math.max(120, sheetH - dy)}px` } },
    onEnd: (_dx, dy, _vx, vy) => {
      const el = ref.current?.querySelector<HTMLElement>('.fm-sheet')
      if (el) { el.style.transition = ''; el.style.height = '' }
      const target = sheetH - dy - vy * 0.18
      setDetent((Object.keys(heights) as Detent[]).reduce((a, b) => (Math.abs(heights[b] - target) < Math.abs(heights[a] - target) ? b : a)))
    },
  })

  const showPrecision = prec.active || prec.arrived
  return (
    <div className={`app-root fm-root ${landscape ? 'land' : ''}`} ref={ref}>
      <MapView camera={cam} onCamera={setCam} animate={anim} pins={pins} user={{ p: HERE, heading: 20 }} anchorY={anchorY} anchorX={anchorX} onTap={() => sel && setSel(null)} />
      <button className="fm-locate glass" aria-label="Show my location" onClick={() => flyTo(HERE, 1.4)}><Navigation size={19} fill="currentColor" strokeWidth={0} /></button>
      <div className={`fm-sheet glass heavy ${landscape ? 'land' : ''}`} style={{ height: sheetH }} onPointerDown={drag}>
        <div className="fm-grab" onClick={() => setDetent(detent === 'peek' ? 'mid' : detent === 'mid' ? 'full' : 'peek')}><span /></div>
        <div className="fm-sheet-body scroll">
          {sel?.kind === 'person' ? <PersonDetail id={sel.id} onClose={() => setSel(null)} onShare={(ids) => setShareOpen(ids)} />
            : sel?.kind === 'device' ? <DeviceDetail id={sel.id} onClose={() => setSel(null)} />
              : sel?.kind === 'item' ? <ItemDetail id={sel.id} onClose={() => setSel(null)} />
                : tab === 'people' ? <PeopleList onOpen={(id) => open({ kind: 'person', id })} onShare={() => setShareOpen([])} />
                  : tab === 'devices' ? <DeviceList onOpen={(id) => open({ kind: 'device', id })} />
                    : tab === 'items' ? <ItemList onOpen={(id) => open({ kind: 'item', id })} />
                      : <MePanel onShare={() => setShareOpen([])} />}
        </div>
      </div>
      <TabBar<Tab>
        value={tab}
        onChange={(t) => { setTab(t); setSel(null); if (detent === 'peek') setDetent('mid') }}
        tabs={[
          { id: 'people', label: 'People', icon: <Users size={23} /> },
          { id: 'devices', label: 'Devices', icon: <Smartphone size={23} /> },
          { id: 'items', label: 'Items', icon: <CircleDot size={23} /> },
          { id: 'me', label: 'Me', icon: <UserRound size={23} /> },
        ]}
      />
      <ShareSheet preselect={shareOpen} onClose={() => setShareOpen(null)} />
      {showPrecision && <PrecisionView />}
    </div>
  )
}

function SheetTitle({ title, trailing }: { title: ReactNode; trailing?: ReactNode }) {
  return <div className="fm-title fm-grab"><span className="grow">{title}</span>{trailing}</div>
}

// ------------------------------------------------------------------ lists
function PeopleList({ onOpen, onShare }: { onOpen: (id: string) => void; onShare: () => void }) {
  const fm = useFM()
  const now = useNow(60_000)
  const people = [...FINDMY.people].sort((a, b) => +fm.favorites.includes(b.id) - +fm.favorites.includes(a.id))
  return (
    <>
      <SheetTitle title="People" trailing={<button className="fm-round" aria-label="Share My Location" onClick={onShare}><Plus size={20} /></button>} />
      <div className="fm-card">
        {people.map((p) => (
          <button key={p.id} className="fm-row" onClick={() => onOpen(p.id)}>
            <Avatar id={p.id} size={44} />
            <span className="grow">
              <span className="fm-row-t">{contactName(p.id, 'full')}{fm.favorites.includes(p.id) && <Star size={12} fill="#ffcc00" color="#ffcc00" style={{ marginLeft: 5 }} />}</span>
              <span className="fm-row-s">{p.place}</span>
              {fm.sharing[p.id] && <span className="fm-row-share">Sharing with them · {remaining(fm.sharing[p.id], now)}</span>}
            </span>
            <span className="fm-row-r"><span>{p.distance}</span><span className="fm-row-s">{p.updated}</span></span>
          </button>
        ))}
      </div>
      <button className="fm-cta" onClick={onShare}><Share2 size={18} /> Share My Location</button>
    </>
  )
}

function DeviceList({ onOpen }: { onOpen: (id: string) => void }) {
  const fm = useFM()
  return (
    <>
      <SheetTitle title="Devices" />
      <div className="fm-card">
        {FINDMY.devices.map((d) => (
          <button key={d.id} className="fm-row" onClick={() => onOpen(d.id)}>
            <span className="fm-dev-ico">{DEVICE_ICON[d.kind](22)}</span>
            <span className="grow">
              <span className="fm-row-t">{d.name}</span>
              <span className="fm-row-s">{fm.lost[d.id] ? <b className="fm-lost">Lost Mode</b> : d.id === 'iphone' ? 'This iPhone' : d.place}</span>
            </span>
            <span className="fm-row-r"><span>{distStr(DEVICE_PT[d.id])}</span><Battery v={d.battery} /></span>
          </button>
        ))}
      </div>
    </>
  )
}

function ItemList({ onOpen }: { onOpen: (id: string) => void }) {
  const fm = useFM()
  return (
    <>
      <SheetTitle title="Items" trailing={<button className="fm-round" aria-label="Add item" onClick={() => showAlert({ title: 'Add AirTag', message: 'Bring your AirTag close to iPhone to set it up.', actions: [{ label: 'OK' }] })}><Plus size={20} /></button>} />
      <div className="fm-card">
        {FINDMY.items.map((it) => (
          <button key={it.id} className="fm-row" onClick={() => onOpen(it.id)}>
            <span className="fm-item-ico">{it.emoji}</span>
            <span className="grow">
              <span className="fm-row-t">{it.name}</span>
              <span className="fm-row-s">{fm.lost[it.id] ? <b className="fm-lost">Lost Mode</b> : it.place}</span>
            </span>
            <span className="fm-row-r"><span>{distStr(ITEM_PT[it.id])}</span><span className="fm-row-s">{it.updated}</span></span>
          </button>
        ))}
      </div>
    </>
  )
}

function Battery({ v }: { v: number }) {
  return <span className="fm-batt" aria-label={`Battery ${v}%`}><i style={{ width: `${v}%`, background: v < 20 ? '#ff3b30' : v < 50 ? '#ffcc00' : '#34c759' }} /></span>
}

// ------------------------------------------------------------------ detail
function Action({ icon, label, onClick, tone, disabled }: { icon: ReactNode; label: string; onClick: () => void; tone?: 'green' | 'red'; disabled?: boolean }) {
  return <button className={`fm-act ${tone ?? ''}`} onClick={onClick} disabled={disabled}>{icon}<span>{label}</span></button>
}

function DetailHead({ icon, title, sub, onClose }: { icon: ReactNode; title: string; sub: ReactNode; onClose: () => void }) {
  return (
    <div className="fm-dhead fm-grab">
      {icon}
      <div className="grow"><div className="fm-dtitle">{title}</div><div className="fm-dsub">{sub}</div></div>
      <button className="fm-x" aria-label="Close" onClick={onClose}><X size={17} strokeWidth={2.8} /></button>
    </div>
  )
}

function usePlaySound() {
  const [state, setState] = useState<'idle' | 'playing' | 'done'>('idle')
  const play = () => {
    setState('playing')
    let n = 0
    const id = window.setInterval(() => { playAlert('notification', 0.9); if (++n >= 4) { window.clearInterval(id); setState('done') } }, 600)
  }
  return { state, play }
}

function NotifyToggles({ keys }: { keys: [string, string][] }) {
  const fm = useFM()
  return (
    <div className="fm-card">
      {keys.map(([k, label]) => (
        <div key={k} className="fm-row static"><span className="grow">{label}</span><Switch checked={!!fm.notify[k]} onChange={(v) => { fm.set({ notify: { ...fm.notify, [k]: v } }); if (v) useOS.getState().showToast('Notification set') }} label={label} /></div>
      ))}
    </div>
  )
}

function PersonDetail({ id, onClose, onShare }: { id: string; onClose: () => void; onShare: (ids: string[]) => void }) {
  const p = FINDMY.people.find((x) => x.id === id)
  const fm = useFM()
  const now = useNow(60_000)
  const [notif, setNotif] = useState(false)
  if (!p) return null
  const name = contactName(id)
  const share = fm.sharing[id]
  const place = nearestPlace(p)
  const precision = 'precision' in p && p.precision
  return (
    <div className="anim-fade">
      <DetailHead icon={<Avatar id={id} size={52} />} title={contactName(id, 'full')} sub={<>{p.place} · {p.distance}<br /><span className="fm-updated">Updated {p.updated}</span></>} onClose={onClose} />
      <div className="fm-acts">
        <Action icon={<MessageCircle size={20} />} label="Contact" onClick={() => useOS.getState().launch('messages', { route: `conv/c-${id}` })} />
        <Action icon={<Navigation size={20} />} label="Directions" onClick={() => useOS.getState().launch('maps', { route: `route/${place.id}` })} />
        <Action icon={<Bell size={20} />} label="Notify" onClick={() => setNotif(!notif)} />
        <Action icon={<Crosshair size={20} />} label="Find" tone="green" disabled={!precision} onClick={() => startPrecision({ id, name, kind: 'person', avatar: id, startFt: PRECISION_START[id] ?? 400 })} />
      </div>
      {precision && <div className="fm-note"><Crosshair size={14} /> Precision Finding is available — {name} shares their location with you and is nearby.</div>}
      {notif && (
        <>
          <div className="fm-h">Notify Me</div>
          <NotifyToggles keys={[[`${id}-arrive`, `When ${name} arrives at ${place.name}`], [`${id}-leave`, `When ${name} leaves ${place.name}`], [`${id}-home`, `When ${name} gets Home`]]} />
        </>
      )}
      <div className="fm-h">Your Location</div>
      <div className="fm-card">
        <div className="fm-row static">
          <span className="grow"><span className="fm-row-t">{share ? `Sharing with ${name}` : `Not sharing with ${name}`}</span>{share && <span className="fm-row-s">{remaining(share, now)}{share.precise ? ' · Precise' : ' · Approximate'}</span>}</span>
          <button className="btn small tinted" onClick={(e) => openMenu(e.currentTarget, [
            { label: 'Share for One Hour', icon: <Clock size={18} />, onSelect: () => fm.set({ sharing: { ...fm.sharing, [id]: { until: Date.now() + 3600_000, since: Date.now(), precise: true } } }) },
            { label: 'Share Until End of Day', icon: <Sun size={18} />, onSelect: () => fm.set({ sharing: { ...fm.sharing, [id]: { until: endOfDay(), since: Date.now(), precise: true } } }) },
            { label: 'Share Indefinitely', icon: <InfinityIcon size={18} />, onSelect: () => fm.set({ sharing: { ...fm.sharing, [id]: { until: null, since: Date.now(), precise: true } } }) },
            ...(share ? [{ label: 'Stop Sharing My Location', destructive: true, separatorBefore: true, onSelect: () => { const s = { ...fm.sharing }; delete s[id]; fm.set({ sharing: s }) } }] : []),
          ], { title: `Share with ${name}` })}>{share ? 'Change' : 'Share'}</button>
        </div>
        {share && <div className="fm-row static"><span className="grow">Share Precise Location</span><Switch checked={share.precise} onChange={(v) => fm.set({ sharing: { ...fm.sharing, [id]: { ...share, precise: v } } })} label="Precise" /></div>}
      </div>
      <div className="fm-card">
        <button className="fm-row" onClick={() => fm.set({ favorites: fm.favorites.includes(id) ? fm.favorites.filter((f) => f !== id) : [...fm.favorites, id] })}><Star size={18} color="#ffcc00" fill={fm.favorites.includes(id) ? '#ffcc00' : 'none'} /><span className="grow">{fm.favorites.includes(id) ? 'Remove from Favorites' : 'Add to Favorites'}</span></button>
        <button className="fm-row" onClick={() => onShare([id])}><Share2 size={18} /><span className="grow">Share With Others Too…</span><ChevronRight size={16} className="tertiary" /></button>
        <button className="fm-row destructive" onClick={() => showAlert({ title: `Remove ${name}?`, message: `You’ll stop sharing locations with ${name}.`, actions: [{ label: 'Cancel', style: 'cancel' }, { label: 'Remove', style: 'destructive', onPress: () => { const s = { ...fm.sharing }; delete s[id]; fm.set({ sharing: s }); onClose() } }] })}><span className="grow">Remove {name}</span></button>
      </div>
    </div>
  )
}

function LostModeCard({ id, name }: { id: string; name: string }) {
  const fm = useFM()
  const [open, setOpen] = useState(false)
  const [msg, setMsg] = useState(`This ${name} has been lost. Please call me.`)
  const lost = !!fm.lost[id]
  return (
    <>
      <div className="fm-card">
        <button className="fm-row" onClick={() => (lost ? fm.set({ lost: { ...fm.lost, [id]: false } }) : setOpen(true))}>
          <span className="fm-sq" style={{ background: '#ff3b30' }}><Lock size={16} /></span>
          <span className="grow"><span className="fm-row-t">{lost ? 'Lost Mode Enabled' : 'Mark As Lost'}</span><span className="fm-row-s">{lost ? 'Tap to turn off' : 'Lock it and show a message with your number'}</span></span>
          {lost ? <span className="fm-lost">On</span> : <ChevronRight size={16} className="tertiary" />}
        </button>
      </div>
      <Sheet open={open} onClose={() => setOpen(false)} title="Mark As Lost" detent="large" className="fm-sheet-grouped">
        <div style={{ padding: '0 18px' }}>
          <div className="fm-lost-hero"><Lock size={40} /></div>
          <p className="t-body center">{name} will be locked, notifications will be silenced, and anyone who finds it will see your message and number.</p>
        </div>
        <div className="list">
          <div className="row-item"><span className="row-main"><span className="row-title">Phone</span></span><span className="row-detail">(555) 010-4417</span></div>
          <div className="row-item"><textarea className="text-input" rows={3} value={msg} onChange={(e) => setMsg(e.target.value)} aria-label="Message" /></div>
        </div>
        <div style={{ padding: '0 16px 24px' }}><button className="btn filled block" style={{ background: '#ff3b30' }} onClick={() => { fm.set({ lost: { ...fm.lost, [id]: true } }); setOpen(false); useOS.getState().showToast(`${name} marked as lost`) }}>Activate</button></div>
      </Sheet>
    </>
  )
}

function DeviceDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const d = FINDMY.devices.find((x) => x.id === id)
  const fm = useFM()
  const sound = usePlaySound()
  if (!d) return null
  const pt = DEVICE_PT[id]
  return (
    <div className="anim-fade">
      <DetailHead icon={<span className="fm-dev-ico big">{DEVICE_ICON[d.kind](28)}</span>} title={d.name} sub={<>{d.id === 'iphone' ? 'This iPhone · Lincoln High School' : d.place} · {distStr(pt)}<br /><span className="fm-updated"><Battery v={d.battery} /> {d.battery}%</span></>} onClose={onClose} />
      <div className="fm-acts">
        <Action icon={sound.state === 'playing' ? <Spinner size={18} /> : <Volume2 size={20} />} label={sound.state === 'playing' ? 'Playing…' : sound.state === 'done' ? 'Sound Played' : 'Play Sound'} onClick={sound.play} disabled={sound.state === 'playing'} />
        <Action icon={<Navigation size={20} />} label="Directions" onClick={() => useOS.getState().launch('maps', { route: `route/${nearestPlace(pt).id}` })} />
      </div>
      <div className="fm-h">Notifications</div>
      <NotifyToggles keys={[[`${id}-found`, 'Notify When Found'], [`${id}-left`, 'Notify When Left Behind']]} />
      <LostModeCard id={id} name={d.name} />
      <div className="fm-card">
        <button className="fm-row destructive" disabled={id === 'iphone' || fm.erasing[id]} onClick={() => showAlert({ title: `Erase ${d.name}?`, message: 'All content and settings will be erased. An erased device can’t be located or tracked.', actions: [{ label: 'Cancel', style: 'cancel' }, { label: 'Erase', style: 'destructive', onPress: () => fm.set({ erasing: { ...fm.erasing, [id]: true } }) }] })}>
          <span className="fm-sq" style={{ background: '#ff3b30' }}><Eraser size={16} /></span><span className="grow">{fm.erasing[id] ? 'Erase Pending — will erase when online' : id === 'iphone' ? 'Erase This Device (unavailable on this iPhone)' : 'Erase This Device'}</span>
        </button>
      </div>
    </div>
  )
}

function ItemDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const it = FINDMY.items.find((x) => x.id === id)
  const sound = usePlaySound()
  const [shared, setShared] = useState(false)
  if (!it) return null
  const pt = ITEM_PT[id]
  return (
    <div className="anim-fade">
      <DetailHead icon={<span className="fm-item-ico big">{it.emoji}</span>} title={it.name} sub={<>{it.place} · {distStr(pt)}<br /><span className="fm-updated">Updated {it.updated}</span></>} onClose={onClose} />
      <div className="fm-acts">
        <Action icon={sound.state === 'playing' ? <Spinner size={18} /> : <Volume2 size={20} />} label={sound.state === 'playing' ? 'Playing…' : sound.state === 'done' ? 'Played' : 'Play Sound'} onClick={sound.play} disabled={sound.state === 'playing'} />
        <Action icon={<Navigation size={20} />} label="Directions" onClick={() => useOS.getState().launch('maps', { route: `route/${nearestPlace(pt).id}` })} />
        <Action icon={<Crosshair size={20} />} label="Find" tone="green" onClick={() => startPrecision({ id, name: it.name, kind: 'item', emoji: it.emoji, startFt: Math.max(40, Math.round(straightMiles(HERE, pt) * 5280) % 300 + 60) })} />
      </div>
      <div className="fm-h">Notifications</div>
      <NotifyToggles keys={[[`${id}-left`, 'Notify When Left Behind'], [`${id}-found`, 'Notify When Found']]} />
      <div className="fm-card">
        <button className="fm-row" onClick={() => { setShared(!shared); useOS.getState().showToast(shared ? 'Stopped sharing item location' : 'Share link created — expires in 7 days') }}>
          <span className="fm-sq" style={{ background: '#34c759' }}><Share2 size={16} /></span>
          <span className="grow"><span className="fm-row-t">{shared ? 'Stop Sharing Item Location' : 'Share Item Location'}</span><span className="fm-row-s">{shared ? 'Link active · expires in 7 days' : 'Let an airline or friend help find it'}</span></span>
        </button>
      </div>
      <LostModeCard id={id} name={it.name} />
    </div>
  )
}

// ------------------------------------------------------------------ me + flexible sharing
function MePanel({ onShare }: { onShare: () => void }) {
  const fm = useFM()
  const now = useNow(60_000)
  const entries = Object.entries(fm.sharing)
  return (
    <>
      <SheetTitle title="Me" />
      <div className="fm-card">
        <div className="fm-row static"><span className="fm-sq" style={{ background: '#007aff' }}><PinIcon size={16} /></span><span className="grow"><span className="fm-row-t">My Location</span><span className="fm-row-s">Lincoln High School, Maple Grove</span></span></div>
        <button className="fm-row" onClick={(e) => openMenu(e.currentTarget, ['Home', 'School', 'Work', 'Gym'].map((n) => ({ label: n, icon: fm.locationName === n ? <Check size={18} /> : undefined, onSelect: () => fm.set({ locationName: n }) })))}><span className="grow">Location Name</span><span className="fm-row-s">{fm.locationName}</span><ChevronRight size={16} className="tertiary" /></button>
        <div className="fm-row static"><span className="grow">Share My Location</span><Switch checked={fm.shareEnabled} onChange={(v) => fm.set({ shareEnabled: v })} label="Share My Location" /></div>
      </div>
      <div className="fm-h">Sharing With</div>
      <div className="fm-card">
        {entries.length === 0 && <div className="fm-row static secondary">Not sharing with anyone</div>}
        {entries.map(([pid, s]) => (
          <button key={pid} className="fm-row" onClick={(e) => openMenu(e.currentTarget, [
            { label: 'One Hour', icon: <Clock size={18} />, onSelect: () => fm.set({ sharing: { ...fm.sharing, [pid]: { ...s, until: Date.now() + 3600_000 } } }) },
            { label: 'Until End of Day', icon: <Sun size={18} />, onSelect: () => fm.set({ sharing: { ...fm.sharing, [pid]: { ...s, until: endOfDay() } } }) },
            { label: 'Indefinitely', icon: <InfinityIcon size={18} />, onSelect: () => fm.set({ sharing: { ...fm.sharing, [pid]: { ...s, until: null } } }) },
            { label: 'Stop Sharing', destructive: true, separatorBefore: true, onSelect: () => { const n = { ...fm.sharing }; delete n[pid]; fm.set({ sharing: n }) } },
          ], { title: contactName(pid, 'full') })}>
            <Avatar id={pid} size={36} />
            <span className="grow"><span className="fm-row-t">{contactName(pid, 'full')}</span><span className="fm-row-s">{fm.shareEnabled ? remaining(s, now) : 'Paused'}{s.precise ? '' : ' · Approximate'}</span></span>
            <ChevronRight size={16} className="tertiary" />
          </button>
        ))}
      </div>
      <button className="fm-cta" onClick={onShare}><Share2 size={18} /> Share With Someone New</button>
      <div className="fm-card">
        <div className="fm-row static"><span className="grow">Allow Friend Requests</span><Switch checked={fm.friendRequests} onChange={(v) => fm.set({ friendRequests: v })} label="Allow Friend Requests" /></div>
      </div>
    </>
  )
}

const DURATIONS = [
  { k: 'hour', label: 'Share for One Hour', icon: <Clock size={20} />, until: () => Date.now() + 3600_000 },
  { k: 'day', label: 'Share Until End of Day', icon: <Sun size={20} />, until: () => endOfDay() },
  { k: 'forever', label: 'Share Indefinitely', icon: <InfinityIcon size={20} />, until: () => null },
] as const

function ShareSheet({ preselect, onClose }: { preselect: string[] | null; onClose: () => void }) {
  const fm = useFM()
  const [picked, setPicked] = useState<string[]>([])
  const [dur, setDur] = useState<'hour' | 'day' | 'forever'>('day')
  const [precise, setPrecise] = useState(true)
  useEffect(() => { if (preselect) { setPicked(preselect); setDur('day'); setPrecise(true) } }, [preselect])
  const people = CONTACTS.filter((c) => !c.isBusiness)
  const send = () => {
    const d = DURATIONS.find((x) => x.k === dur)!
    const next = { ...fm.sharing }
    for (const id of picked) next[id] = { until: d.until(), since: Date.now(), precise }
    fm.set({ sharing: next })
    useOS.getState().showToast(`Sharing with ${picked.length === 1 ? contactName(picked[0]) : `${picked.length} people`}`)
    onClose()
  }
  return (
    <Sheet open={!!preselect} onClose={onClose} title="Share My Location" detent="large" className="fm-sheet-grouped" trailing={<button className="bar-btn icon prominent" aria-label="Share" disabled={!picked.length} onClick={send}><Check size={22} strokeWidth={2.8} /></button>}>
      <div className="list-header">WITH</div>
      <div className="fm-picked">
        {picked.length === 0 && <span className="secondary">Choose one or more people</span>}
        {picked.map((id) => <span key={id} className="fm-chip"><Avatar id={id} size={22} />{contactName(id)}<button aria-label={`Remove ${contactName(id)}`} onClick={() => setPicked(picked.filter((x) => x !== id))}><X size={12} strokeWidth={3} /></button></span>)}
      </div>
      <div className="list">
        {people.map((c) => {
          const on = picked.includes(c.id)
          return (
            <button key={c.id} className="row-item has-icon" onClick={() => setPicked(on ? picked.filter((x) => x !== c.id) : [...picked, c.id])}>
              <Avatar id={c.id} size={32} />
              <span className="row-main"><span className="row-title">{contactName(c.id, 'full')}</span>{fm.sharing[c.id] && <span className="row-sub">Already sharing · {remaining(fm.sharing[c.id], Date.now())}</span>}</span>
              <span className={`fm-check ${on ? 'on' : ''}`}>{on && <Check size={14} strokeWidth={3.4} color="#fff" />}</span>
            </button>
          )
        })}
      </div>
      <div className="list-header">FOR HOW LONG</div>
      <div className="list">
        {DURATIONS.map((d) => (
          <button key={d.k} className="row-item has-icon" onClick={() => setDur(d.k)}>
            <span className="settings-icon" style={{ background: d.k === 'forever' ? '#34c759' : d.k === 'day' ? '#ff9500' : '#007aff' }}>{d.icon}</span>
            <span className="row-main"><span className="row-title">{d.label}</span></span>
            {dur === d.k && <Check size={20} color="var(--accent)" strokeWidth={2.8} />}
          </button>
        ))}
        <div className="row-item"><span className="row-main"><span className="row-title">Precise Location</span><span className="row-sub">Off shares an approximate area</span></span><Switch checked={precise} onChange={setPrecise} label="Precise Location" /></div>
      </div>
      <div style={{ padding: '0 16px 30px' }}><button className="btn filled block" disabled={!picked.length} onClick={send}>Share{picked.length ? ` with ${picked.length}` : ''}</button></div>
    </Sheet>
  )
}

// ------------------------------------------------------------------ Precision Finding
function PrecisionView() {
  const p = usePrecision()
  const flash = useOS((s) => s.flashlight)
  const close = () => stopPrecision(true)
  const near = p.dist < 30
  const hint = hintFor(p.dist, p.bearing)
  const dots = useMemo(() => Array.from({ length: 11 * 7 }, (_, i) => i), [])
  useEffect(() => {
    useShell.getState().set({ statusOverride: 'light' })
    return () => useShell.getState().set({ statusOverride: null })
  }, [])
  if (p.arrived) {
    return (
      <div className="fm-prec arrived anim-fade">
        <div className="fm-prec-top"><button className="fm-prec-x" aria-label="Done" onClick={() => stopPrecision(false)}><X size={22} strokeWidth={2.6} /></button></div>
        <div className="fm-prec-center">
          <div className="fm-pulse"><i /><i /><i /><span className="fm-prec-face">{p.avatar ? <Avatar id={p.avatar} size={96} /> : <span className="fm-prec-emoji">{p.emoji}</span>}</span></div>
          <div className="fm-prec-big">You’re here</div>
          <div className="fm-prec-hint">{p.name} is within reach</div>
        </div>
        <div className="fm-prec-bottom"><button className="btn block" style={{ background: '#fff', color: '#1f9e4a' }} onClick={() => stopPrecision(false)}>Done</button></div>
      </div>
    )
  }
  return (
    <div className={`fm-prec ${near ? 'near' : ''}`}>
      <div className="fm-prec-top">
        <button className="fm-prec-x" aria-label="Stop finding" onClick={close}><X size={22} strokeWidth={2.6} /></button>
        <div className="fm-prec-name">Finding {p.name}</div>
        <button className="fm-prec-x" aria-label={p.paused ? 'Resume walking' : 'Pause walking'} onClick={togglePause}>{p.paused ? <Play size={18} fill="#fff" strokeWidth={0} /> : <Pause size={18} fill="#fff" strokeWidth={0} />}</button>
      </div>
      <div className="fm-prec-dots" style={{ '--prox': String(Math.max(0, 1 - p.dist / 400)) } as CSSProperties}>
        {dots.map((i) => <i key={i} style={{ animationDelay: `${(i % 11) * 0.05 + Math.floor(i / 11) * 0.07}s` }} />)}
      </div>
      <div className="fm-prec-center">
        <svg className="fm-arrow" viewBox="0 0 100 100" style={{ transform: `rotate(${p.bearing}deg)` }} aria-label={`Direction ${hint}`}>
          <path d="M50 6 L84 74 L50 58 L16 74 Z" fill="#fff" />
        </svg>
      </div>
      <div className="fm-prec-info">
        <div className="fm-prec-big">{fmtFt(p.dist)}</div>
        <div className="fm-prec-hint">{hint}</div>
        <div className="fm-prec-sub">{p.paused ? 'Paused — tap ▶ to keep walking' : near ? 'Almost there' : 'Walking… keep your iPhone upright'}</div>
      </div>
      <div className="fm-prec-bottom">
        {p.kind === 'item' ? (
          <button className="fm-prec-btn" onClick={() => playAlert('notification', 1)}><Volume2 size={20} /> Play Sound</button>
        ) : (
          <button className="fm-prec-btn" onClick={() => useOS.getState().launch('messages', { route: `conv/c-${p.id}` })}><MessageCircle size={20} /> Message</button>
        )}
        <button className={`fm-prec-btn ${flash ? 'on' : ''}`} aria-pressed={flash} onClick={() => useOS.getState().set({ flashlight: !flash })}><Flashlight size={20} /> Flashlight</button>
      </div>
    </div>
  )
}
