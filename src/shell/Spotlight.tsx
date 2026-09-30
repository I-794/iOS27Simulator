import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { MessageCircle, Mail, Calendar, FileText, Folder, Settings, Video, Globe, CheckCircle2, User, Timer, Phone, Zap, Lightbulb, Search as SearchIcon, ChevronRight } from 'lucide-react'
import { useOS } from '../os/store'
import { search, type Hit, type EntityType } from '../os/search'
import { AppIconArt, ICONS } from '../icons/AppIconArt'
import { Avatar, SearchField, AISparkle } from '../ui/controls'
import { Scene } from '../art/Scene'
import { tryLaunch } from './AppIcon'
import { parseDuration } from '../os/ai/parse'
import { startTimer, findContact } from '../os/ai/siri'
import { fmtRelative } from '../os/time'
import { springs, animateSpring } from '../os/spring'
import { useDebounced } from '../os/hooks'
import { contactName } from '../os/data/people'
import { useShell } from './shellState'
import { WEATHER } from '../os/data/world'
import { WeatherGlyph } from './widgets/Widgets'

const GROUP_ORDER: EntityType[] = ['app', 'contact', 'message', 'mail', 'event', 'reminder', 'photo', 'note', 'file', 'camera', 'setting', 'accessory', 'web']
const GROUP_LABEL: Record<EntityType, string> = { app: 'Applications', contact: 'Contacts', message: 'Messages', mail: 'Mail', event: 'Calendar', reminder: 'Reminders', photo: 'Photos', note: 'Notes', file: 'Files', camera: 'Home — Camera Events', setting: 'Settings', accessory: 'Home Accessories', web: 'Safari', action: 'Actions' }

interface Action {
  label: string
  sub?: string
  icon: ReactNode
  run: () => void
}

function quickActions(q: string): Action[] {
  const st = useOS.getState()
  const out: Action[] = []
  const l = q.toLowerCase()
  const secs = parseDuration(l)
  if (secs && /timer|min|sec|hour/.test(l)) out.push({ label: `Start ${Math.round(secs / 60) || secs + 's'}${secs >= 60 ? ' min' : ''} timer`, sub: 'Clock', icon: <Timer size={18} />, run: () => startTimer(secs) })
  const c = findContact(q)
  if (c) {
    out.push({ label: `Call ${contactName(c)}`, sub: 'Phone', icon: <Phone size={18} />, run: () => st.launch('phone', { route: `call/${c}` }) })
    out.push({ label: `Message ${contactName(c)}`, sub: 'Messages', icon: <MessageCircle size={18} />, run: () => st.launch('messages', { route: `conv/c-${c}` }) })
  }
  if (/dark/.test(l)) out.push({ label: `Turn ${st.theme === 'dark' ? 'off' : 'on'} Dark Mode`, sub: 'Settings', icon: <Zap size={18} />, run: () => st.set({ theme: st.theme === 'dark' ? 'light' : 'dark' }) })
  if (/flash|torch/.test(l)) out.push({ label: `Turn ${st.flashlight ? 'off' : 'on'} Flashlight`, sub: 'Control Center', icon: <Lightbulb size={18} />, run: () => st.set({ flashlight: !st.flashlight }) })
  if (/light/.test(l) && !/flash/.test(l)) out.push({ label: 'Turn off all lights', sub: 'Home', icon: <Lightbulb size={18} />, run: () => st.set({ accessories: st.accessories.map((a) => (a.kind === 'light' ? { ...a, on: false } : a)) }) })
  if (/glass|clear|tint/.test(l)) out.push({ label: 'Adjust Liquid Glass', sub: 'Settings', icon: <Settings size={18} />, run: () => st.launch('settings', { route: 'display/glass' }) })
  for (const sc of st.shortcuts) if (sc.name.toLowerCase().includes(l) && l.length > 2) out.push({ label: sc.name, sub: 'Shortcut', icon: <Zap size={18} color={sc.color} />, run: () => st.launch('shortcuts', { route: `run/${sc.id}` }) })
  return out.slice(0, 4)
}

export function Spotlight() {
  const overlay = useOS((s) => s.overlay)
  if (overlay !== 'spotlight') return null
  return <SpotlightInner />
}

function SpotlightInner() {
  const [q, setQ] = useState('')
  const dq = useDebounced(q, 40)
  const recents = useOS((s) => s.recents)
  const ref = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const results = useMemo(() => (dq.trim() ? search(dq, { limit: 80 }) : []), [dq])
  const actions = useMemo(() => (dq.trim() ? quickActions(dq) : []), [dq])
  const t0 = useRef(0)
  const [ms, setMs] = useState(0)

  useEffect(() => {
    t0.current = performance.now()
    requestAnimationFrame(() => setMs(Math.max(1, Math.round(performance.now() - t0.current))))
  }, [results])

  useEffect(() => {
    if (ref.current) animateSpring(ref.current, [{ opacity: 0, transform: 'translateY(20px)' }, { opacity: 1, transform: 'none' }], springs.sheet(), { fill: 'none' })
    const t = window.setTimeout(() => inputRef.current?.focus(), 80)
    return () => window.clearTimeout(t)
  }, [])

  const groups = useMemo(() => {
    const m = new Map<EntityType, Hit[]>()
    for (const h of results.slice(1)) m.set(h.type, [...(m.get(h.type) ?? []), h])
    return GROUP_ORDER.filter((g) => m.has(g)).map((g) => [g, m.get(g)!] as const)
  }, [results])

  const open = (h: Hit, el?: HTMLElement | null) => {
    const st = useOS.getState()
    st.setOverlay(null)
    if (h.type === 'app') tryLaunch(h.app, el)
    else tryLaunch(h.app, null, h.route)
  }

  const top = results[0]
  const askSiri = (text: string) => {
    useShell.getState().set({ siriPending: text.trim() })
    useOS.getState().set({ overlay: null, siriActive: true, siriMode: 'thinking' })
  }
  // Return opens an exact app match; anything else is handed to Siri
  const submit = () => {
    const t = q.trim()
    if (!t) return
    if (top && top.type === 'app' && top.title.toLowerCase().startsWith(t.toLowerCase())) return open(top)
    if (top && top.score > 18 && t.split(/\s+/).length === 1) return open(top)
    askSiri(t)
  }
  return (
    <div className="spotlight" role="dialog" aria-label="Spotlight Search" onClick={(e) => e.target === e.currentTarget && useOS.getState().setOverlay(null)}>
      <div className="spot-backdrop" onClick={() => useOS.getState().setOverlay(null)} />
      <div className="spot-panel" ref={ref}>
        <div className="spot-field">
          <SearchField ref={inputRef} value={q} onChange={setQ} placeholder="Search or Ask" className="glass" onSubmit={submit} />
        </div>
        <div className="spot-results scroll">
          {q.trim() && (
            <button className="spot-ask glass clear" onClick={() => askSiri(q)}>
              <span className="siri27-pill-orb" />
              <span className="grow" style={{ textAlign: 'left', minWidth: 0 }}>
                <span className="t-caption1" style={{ display: 'block', opacity: 0.7 }}>Ask Siri</span>
                <span className="nowrap" style={{ display: 'block' }}>“{q.trim()}”</span>
              </span>
            </button>
          )}
          {!q && (
            <>
              <div className="spot-section-title"><AISparkle size={14} /> Siri Suggestions</div>
              <div className="spot-apps glass clear">
                {recents.slice(0, 8).map((a) => (
                  <button key={a} className="spot-app" onClick={(e) => { useOS.getState().setOverlay(null); tryLaunch(a, e.currentTarget.querySelector('.app-icon-art') as HTMLElement) }}>
                    <AppIconArt app={a} size={56} />
                    <span>{ICONS[a].name}</span>
                  </button>
                ))}
              </div>
              <button className="spot-weather glass clear" onClick={() => { useOS.getState().setOverlay(null); useOS.getState().launch('weather') }}>
                <WeatherGlyph icon="cloud-sun" size={28} />
                <span className="grow" style={{ textAlign: 'left' }}>
                  <span className="t-headline" style={{ display: 'block' }}>{WEATHER.temp}° {WEATHER.condition}</span>
                  <span className="t-footnote" style={{ opacity: 0.75 }}>{WEATHER.city} · H:{WEATHER.high}° L:{WEATHER.low}° · Storms Thursday evening</span>
                </span>
              </button>
              <div className="spot-section-title">Recent Searches</div>
              <div className="spot-chips">
                {['swerve module tuning', 'stoichiometry practice', 'aurora x2 headphones'].map((r) => (
                  <button key={r} className="siri27-chip" onClick={() => setQ(r)}>{r}</button>
                ))}
              </div>
              <div className="spot-section-title">Suggested Actions</div>
              <div className="spot-list glass clear">
                {[
                  { l: 'Text Alex about robotics', a: () => useOS.getState().launch('messages', { route: 'conv/c-alex' }) },
                  { l: 'Directions to Lincoln High', a: () => useOS.getState().launch('maps', { route: 'route/school' }) },
                  { l: 'Play Study Focus', a: () => useOS.getState().playTrack('t5', ['t5', 't9', 't3'], 'Study Focus') },
                  { l: 'Front Door camera', a: () => useOS.getState().launch('home', { route: 'camera/Front Door' }) },
                ].map((x) => (
                  <button key={x.l} className="spot-row" onClick={() => { useOS.getState().setOverlay(null); x.a() }}>
                    <span className="spot-row-icon"><Zap size={16} /></span><span className="grow">{x.l}</span><ChevronRight size={16} style={{ opacity: 0.5 }} />
                  </button>
                ))}
              </div>
            </>
          )}
          {q && !results.length && !actions.length && (
            <div className="spot-empty">
              <div className="t-title3">No Results</div>
              <button className="btn small tinted" onClick={() => { useOS.getState().setOverlay(null); useOS.getState().launch('safari', { route: `search/${encodeURIComponent(q)}` }) }}><Globe size={16} /> Search Web</button>
            </div>
          )}
          {top && (
            <>
              <div className="spot-section-title">Top Hit</div>
              <button className="spot-top glass clear" onClick={(e) => open(top, e.currentTarget.querySelector('.app-icon-art') as HTMLElement)}>
                <HitIcon h={top} big />
                <div className="grow" style={{ textAlign: 'left', minWidth: 0 }}>
                  <div className="t-headline nowrap">{top.title}</div>
                  <div className="t-footnote nowrap" style={{ opacity: 0.75 }}>{top.subtitle ?? ICONS[top.app].name}</div>
                </div>
              </button>
            </>
          )}
          {actions.length > 0 && (
            <>
              <div className="spot-section-title">Actions</div>
              <div className="spot-list glass clear">
                {actions.map((a) => (
                  <button key={a.label} className="spot-row" onClick={() => { useOS.getState().setOverlay(null); a.run() }}>
                    <span className="spot-row-icon">{a.icon}</span>
                    <span className="grow">{a.label}</span>
                    <span className="t-caption1" style={{ opacity: 0.6 }}>{a.sub}</span>
                  </button>
                ))}
              </div>
            </>
          )}
          {groups.map(([g, hits]) => (
            <div key={g}>
              <div className="spot-section-title row" style={{ justifyContent: 'space-between' }}>
                <span>{GROUP_LABEL[g]}</span>
                {hits.length > 4 && <span style={{ opacity: 0.6 }}>{hits.length}</span>}
              </div>
              {g === 'photo' ? (
                <div className="spot-photos">
                  {hits.slice(0, 8).map((h) => (
                    <button key={h.id} onClick={() => open(h)} aria-label={h.subtitle}><Scene scene={h.scene!} /></button>
                  ))}
                </div>
              ) : g === 'app' ? (
                <div className="spot-apps glass clear">
                  {hits.slice(0, 8).map((h) => (
                    <button key={h.id} className="spot-app" onClick={(e) => open(h, e.currentTarget.querySelector('.app-icon-art') as HTMLElement)}>
                      <AppIconArt app={h.app} size={56} />
                      <span>{h.title}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="spot-list glass clear">
                  {hits.slice(0, 4).map((h) => (
                    <button key={h.id} className="spot-row" onClick={() => open(h)}>
                      <span className="spot-row-icon"><HitIcon h={h} /></span>
                      <span className="grow" style={{ minWidth: 0 }}>
                        <span className="nowrap" style={{ display: 'block' }}>{h.title}</span>
                        {h.subtitle && <span className="t-footnote nowrap" style={{ display: 'block', opacity: 0.7 }}>{h.subtitle}</span>}
                      </span>
                      {h.ts && <span className="t-caption1" style={{ opacity: 0.55 }}>{fmtRelative(h.ts)}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
          {q && (
            <div className="spot-footer">
              <SearchIcon size={12} /> {results.length} results in {ms} ms · on-device index
            </div>
          )}
          <div style={{ height: 20 }} />
        </div>
      </div>
    </div>
  )
}

function HitIcon({ h, big }: { h: Hit; big?: boolean }) {
  const s = big ? 48 : 20
  switch (h.type) {
    case 'app':
      return <AppIconArt app={h.app} size={big ? 48 : 28} />
    case 'contact':
      return <Avatar id={h.contact} size={big ? 48 : 30} />
    case 'photo':
      return <div style={{ width: s + 8, height: s + 8, borderRadius: 8, overflow: 'hidden' }}><Scene scene={h.scene!} /></div>
    case 'camera':
      return big ? <div style={{ width: 64, height: 48, borderRadius: 8, overflow: 'hidden' }}><Scene scene={h.scene!} /></div> : <Video size={18} />
    case 'message':
      return big ? <AppIconArt app="messages" size={48} /> : <MessageCircle size={18} />
    case 'mail':
      return big ? <AppIconArt app="mail" size={48} /> : <Mail size={18} />
    case 'event':
      return big ? <AppIconArt app="calendar" size={48} /> : <Calendar size={18} />
    case 'note':
      return big ? <AppIconArt app="notes" size={48} /> : <FileText size={18} />
    case 'file':
      return big ? <AppIconArt app="files" size={48} /> : <Folder size={18} />
    case 'setting':
      return big ? <AppIconArt app="settings" size={48} /> : <Settings size={18} />
    case 'reminder':
      return big ? <AppIconArt app="reminders" size={48} /> : <CheckCircle2 size={18} />
    case 'web':
      return big ? <AppIconArt app="safari" size={48} /> : <Globe size={18} />
    case 'accessory':
      return big ? <AppIconArt app="home" size={48} /> : <Lightbulb size={18} />
    default:
      return <User size={18} />
  }
}
