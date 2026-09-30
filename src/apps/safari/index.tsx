import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  ChevronLeft, ChevronRight, Copy, Ellipsis, ALargeSmall, RotateCw, Search, X, Plus, Share, BookOpen, Bookmark as BookmarkIcon, Star, Glasses,
  Languages, Bell, BellRing, Puzzle, ShieldCheck, Clock, Trash2, ListPlus, Minus, FileSearch, Link, EyeOff, Headphones, Sparkles, Check, Layers, ChevronDown, Pencil,
} from 'lucide-react'
import { useOS } from '../../os/store'
import { useAppRoute, useOnscreen } from '../../os/hooks'
import { Sheet, openMenu, showAlert } from '../../ui/overlay'
import { Segmented, Switch, AISparkle, Spinner, Button } from '../../ui/controls'
import { List, Row } from '../../ui/list'
import { summarize } from '../../os/ai/writing'
import { fmtRelative, fmtAgo } from '../../os/time'
import { SAFARI_SITES } from '../../os/data/world'
import { springs, animateSpring } from '../../os/spring'
import {
  START, useSafari, useTabNav, navigate, goBack, goForward, newTab, closeTab, resolve, titleFor, displayHost, hostOf, brandFor, isBlocked,
  organizeByTopic, groupColor, GROUP_ORDER, askPermission, searchUrl, normalizeInput, type Bookmark,
} from './model'
import { WebCtx } from './web'
import { PageFor, WATCHABLE, PRODUCT_PAGES, translateDom } from './pages'
import { RestrictedPage } from './sites2'
import { searchSites } from './sites1'
import { generateExtension, scopeCss, EXTENSION_IDEAS, type GeneratedExtension } from './extensions'
import './safari.css'

type SheetKind = null | 'library' | 'extensions' | 'describe' | 'privacy' | 'notify' | 'newgroup' | 'startedit'

// =====================================================================================
export default function SafariApp() {
  const tabs = useOS((s) => s.safariTabs)
  const activeId = useOS((s) => s.safariActiveTab)
  const [view, setView] = useState<'browser' | 'tabs'>('browser')
  const [sheet, setSheet] = useState<SheetKind>(null)
  const [libTab, setLibTab] = useState<'Bookmarks' | 'Reading List' | 'History' | 'Watching'>('Bookmarks')

  useEffect(() => {
    if (!tabs.length) newTab()
    else if (!tabs.some((t) => t.id === activeId)) useOS.getState().set({ safariActiveTab: tabs[0].id })
  }, [tabs, activeId])

  useAppRoute('safari', (route) => {
    setView('browser')
    setSheet(null)
    if (route === 'newtab') return void newTab()
    if (route.startsWith('url/')) {
      const u = normalizeInput(decodeURIComponent(route.slice(4)))
      const existing = useOS.getState().safariTabs.find((t) => t.url === u)
      if (existing) useOS.getState().set({ safariActiveTab: existing.id })
      else newTab(u)
      return
    }
    if (route.startsWith('search/')) return void newTab(searchUrl(decodeURIComponent(route.slice(7))))
  })

  const openLibrary = (t: typeof libTab) => {
    setLibTab(t)
    setSheet('library')
  }

  return (
    <div className="app-root sf-root">
      <Browser onTabs={() => setView('tabs')} onSheet={setSheet} onLibrary={openLibrary} hidden={view !== 'browser'} />
      {view === 'tabs' && <TabOverview onClose={() => setView('browser')} onNewGroup={() => setSheet('newgroup')} />}
      <LibrarySheet open={sheet === 'library'} tab={libTab} setTab={setLibTab} onClose={() => setSheet(null)} />
      <ExtensionsSheet open={sheet === 'extensions' || sheet === 'describe'} describe={sheet === 'describe'} setDescribe={(d) => setSheet(d ? 'describe' : 'extensions')} onClose={() => setSheet(null)} />
      <PrivacySheet open={sheet === 'privacy'} onClose={() => setSheet(null)} />
      <NotifySheet open={sheet === 'notify'} onClose={() => setSheet(null)} onWatching={() => openLibrary('Watching')} />
      <NewGroupSheet open={sheet === 'newgroup'} onClose={() => setSheet(null)} />
      <StartEditSheet open={sheet === 'startedit'} onClose={() => setSheet(null)} />
    </div>
  )
}

// =====================================================================================
// Browser
// =====================================================================================
function Browser({ onTabs, onSheet, onLibrary, hidden }: { onTabs: () => void; onSheet: (s: SheetKind) => void; onLibrary: (t: 'Bookmarks' | 'Reading List' | 'History' | 'Watching') => void; hidden: boolean }) {
  const tab = useOS((s) => s.safariTabs.find((t) => t.id === s.safariActiveTab) ?? s.safariTabs[0])
  const landscape = useOS((s) => s.orientation === 'landscape')
  const screenTime = useOS((s) => s.screenTime)
  const extensions = useOS((s) => s.safariExtensions)
  const watches = useOS((s) => s.safariWatches)
  const nav = useTabNav((s) => (tab ? s.h[tab.id] : undefined))
  const zoomMap = useSafari((s) => s.zoom)
  const url = tab?.url ?? START
  const r = resolve(url)
  const host = hostOf(url)
  const zoom = zoomMap[host] ?? 1
  const blocked = useMemo(() => isBlocked(url), [url, screenTime]) // eslint-disable-line react-hooks/exhaustive-deps
  const scrollRef = useRef<HTMLDivElement>(null)
  const webRef = useRef<HTMLDivElement>(null)
  const [collapsed, setCollapsed] = useState(false)
  const [editing, setEditing] = useState(false)
  const [menu, setMenu] = useState(false)
  const [reader, setReader] = useState(false)
  const [translated, setTranslated] = useState(false)
  const [finding, setFinding] = useState(false)
  const [loading, setLoading] = useState(0)
  const [pageText, setPageText] = useState('')
  const [hasArticle, setHasArticle] = useState(false)
  const [bannerDismissed, setBannerDismissed] = useState<Record<string, boolean>>({})
  const lastY = useRef(0)

  // page load: reset scroll, progress bar, reader/translate state
  useLayoutEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 })
    setCollapsed(false)
    setReader(false)
    setFinding(false)
    setLoading(1)
    const t1 = window.setTimeout(() => setLoading(2), 30)
    const t2 = window.setTimeout(() => setLoading(0), 420)
    return () => {
      window.clearTimeout(t1)
      window.clearTimeout(t2)
    }
  }, [url, tab?.id])

  // extract page text for onscreen awareness + reader availability
  useEffect(() => {
    const t = window.setTimeout(() => {
      const root = webRef.current
      const main = root?.querySelector('.sf-main') as HTMLElement | null
      setPageText((main?.innerText ?? '').replace(/\s+\n/g, '\n').slice(0, 2400))
      setHasArticle(!!root?.querySelector('.sf-article'))
    }, 60)
    return () => window.clearTimeout(t)
  }, [url, blocked])

  // translation
  useEffect(() => {
    const root = webRef.current
    if (!root) return
    const t = window.setTimeout(() => translateDom(root, translated), 30)
    return () => window.clearTimeout(t)
  }, [translated, url])
  useEffect(() => setTranslated(false), [url])

  const title = r.kind === 'start' ? 'Start Page' : titleFor(url)
  useOnscreen('safari', blocked ? 'Restricted page' : title, r.kind === 'start' ? { type: 'page', url: '', title: 'Start Page', text: '' } : { type: 'page', url: `https://${url}`, title, text: blocked ? '' : pageText })

  const onScroll = () => {
    const el = scrollRef.current
    if (!el) return
    const y = el.scrollTop
    const dy = y - lastY.current
    if (y < 30) setCollapsed(false)
    else if (dy > 6) setCollapsed(true)
    else if (dy < -10 && y + el.clientHeight < el.scrollHeight - 4) setCollapsed(false)
    lastY.current = y
    if (menu) setMenu(false)
  }

  const jump = (id: string) => {
    const el = webRef.current?.querySelector(`#${CSS.escape(id)}`) as HTMLElement | null
    const sc = scrollRef.current
    if (!el || !sc) return
    const top = el.getBoundingClientRect().top - sc.getBoundingClientRect().top
    const scale = sc.getBoundingClientRect().height / sc.offsetHeight || 1
    sc.scrollTo({ top: sc.scrollTop + top / scale - (landscape ? 70 : 70), behavior: 'smooth' })
  }

  const extCss = extensions.filter((e) => e.enabled).map((e) => scopeCss(e.css)).join('\n')
  const watch = watches.find((w) => w.url === url)
  const product = r.kind === 'site' && PRODUCT_PAGES.has(r.key)
  const showBanner = product && !blocked && !bannerDismissed[url]

  const more = (anchor: HTMLElement) => {
    const st = useOS.getState()
    const bm = useSafari.getState().bookmarks
    const isBm = bm.some((b) => b.url === url)
    const items = [
      { label: 'Share', icon: <Share size={18} />, disabled: r.kind === 'start', onSelect: () => st.set({ shareRequest: { title, kind: 'link', payload: `https://${url}`, app: 'safari' } }) },
      { label: 'Copy Link', icon: <Link size={18} />, disabled: r.kind === 'start', onSelect: () => { void navigator.clipboard?.writeText(`https://${url}`).catch(() => {}); st.showToast('Link Copied', 'link') } },
      { label: isBm ? 'Remove Bookmark' : 'Add Bookmark', icon: <BookmarkIcon size={18} />, disabled: r.kind === 'start', separatorBefore: true, onSelect: () => toggleBookmark(url, title) },
      { label: 'Add to Favorites', icon: <Star size={18} />, disabled: r.kind === 'start', onSelect: () => addFavorite(url, title) },
      { label: 'Add to Reading List', icon: <ListPlus size={18} />, disabled: r.kind === 'start', onSelect: () => addReading(url, title) },
      { label: 'Bookmarks & History', icon: <BookOpen size={18} />, separatorBefore: true, onSelect: () => onLibrary('Bookmarks') },
      { label: 'Find on Page', icon: <FileSearch size={18} />, disabled: r.kind === 'start', onSelect: () => setFinding(true) },
      { label: 'New Tab', icon: <Plus size={18} />, separatorBefore: true, onSelect: () => newTab() },
      { label: 'Show All Tabs', icon: <Copy size={18} />, onSelect: onTabs },
    ]
    openMenu(anchor, items)
  }

  const reload = () => {
    setLoading(1)
    window.setTimeout(() => setLoading(2), 30)
    window.setTimeout(() => setLoading(0), 380)
  }

  const zoomBy = (d: number) => {
    const cur = useSafari.getState().zoom[host] ?? 1
    const steps = [0.5, 0.75, 0.85, 1, 1.15, 1.25, 1.5, 1.75, 2]
    const i = steps.findIndex((s) => Math.abs(s - cur) < 0.01)
    const next = steps[Math.max(0, Math.min(steps.length - 1, (i < 0 ? 3 : i) + d))]
    useSafari.getState().set({ zoom: { ...useSafari.getState().zoom, [host]: next } })
  }

  const barProps = {
    url, title, collapsed, editing, landscape, loading, canBack: !!nav?.back.length, canFwd: !!nav?.fwd.length,
    onExpand: () => setCollapsed(false), onEdit: () => setEditing(true), onCancel: () => setEditing(false),
    onMenu: () => setMenu((m) => !m), onMore: more, onTabs, onReload: reload, onLibrary: () => onLibrary('Bookmarks'),
    onShare: () => useOS.getState().set({ shareRequest: { title, kind: 'link', payload: `https://${url}`, app: 'safari' } }),
    readerActive: reader,
  }

  return (
    <div className={`sf-browser ${landscape ? 'land' : ''} ${hidden ? 'sf-hidden' : ''}`} aria-hidden={hidden}>
      <div className="sf-scroll scroll" ref={scrollRef} onScroll={onScroll}>
        {showBanner && (
          <NotifyBanner url={url} watching={!!watch} triggered={!!watch?.triggered} onNotify={() => onSheet('notify')} onDismiss={() => setBannerDismissed((b) => ({ ...b, [url]: true }))} />
        )}
        {translated && (
          <div className="sf-translate-bar">
            <Languages size={15} /> Translated to Spanish
            <button onClick={() => setTranslated(false)}>Show Original</button>
          </div>
        )}
        <WebCtx.Provider value={{ go: (u) => navigate(u), url, jump }}>
          <div className="sf-webview" ref={webRef} style={{ zoom }} key={`${tab?.id}-${url}`}>
            {extCss && <style>{extCss}</style>}
            {blocked ? (
              <RestrictedPage host={host} onAsk={() => askPermission(host)} />
            ) : r.kind === 'start' ? (
              <StartPage onPrivacy={() => onSheet('privacy')} onLibrary={onLibrary} onEdit={() => onSheet('startedit')} />
            ) : (
              <PageFor url={url} />
            )}
          </div>
        </WebCtx.Provider>
      </div>
      {!landscape && <div className="sf-topfade" />}
      {reader && <ReaderView title={title} host={host} root={webRef.current} onClose={() => setReader(false)} />}
      {editing && <EditPanel initial={r.kind === 'site' ? url : r.kind === 'search' ? r.q : ''} onDone={() => setEditing(false)} onFind={() => { setEditing(false); setFinding(true) }} landscape={landscape} />}
      {!editing && <Toolbar {...barProps} />}
      {finding && <FindBar root={webRef.current} scroller={scrollRef.current} onClose={() => setFinding(false)} />}
      {menu && (
        <PageMenu
          landscape={landscape}
          onClose={() => setMenu(false)}
          zoom={zoom}
          onZoom={zoomBy}
          resetZoom={() => useSafari.getState().set({ zoom: { ...useSafari.getState().zoom, [host]: 1 } })}
          readerAvailable={hasArticle && !blocked && r.kind === 'site'}
          reader={reader}
          onReader={() => setReader((x) => !x)}
          translated={translated}
          onTranslate={() => setTranslated((x) => !x)}
          canTranslate={r.kind !== 'start' && !blocked}
          watchable={r.kind === 'site' ? WATCHABLE[r.key] : undefined}
          watching={!!watch}
          onNotify={() => onSheet('notify')}
          onFind={() => setFinding(true)}
          onHide={() => setCollapsed(true)}
          onExtensions={() => onSheet('extensions')}
          onDescribe={() => onSheet('describe')}
          onPrivacy={() => onSheet('privacy')}
          isStart={r.kind === 'start'}
        />
      )}
    </div>
  )
}

function toggleBookmark(url: string, title: string) {
  const s = useSafari.getState()
  if (s.bookmarks.some((b) => b.url === url)) {
    s.set({ bookmarks: s.bookmarks.filter((b) => b.url !== url) })
    useOS.getState().showToast('Bookmark Removed')
  } else {
    s.set({ bookmarks: [...s.bookmarks, { id: `bm-${Date.now()}`, title, url }] })
    useOS.getState().showToast('Bookmark Added', 'bookmark')
  }
}
function addFavorite(url: string, title: string) {
  const s = useSafari.getState()
  const ex = s.bookmarks.find((b) => b.url === url)
  if (ex) s.set({ bookmarks: s.bookmarks.map((b) => (b.url === url ? { ...b, favorite: true } : b)) })
  else s.set({ bookmarks: [...s.bookmarks, { id: `bm-${Date.now()}`, title, url, favorite: true }] })
  useOS.getState().showToast('Added to Favorites', 'star')
}
function addReading(url: string, title: string) {
  const s = useSafari.getState()
  if (!s.readingList.some((x) => x.url === url)) s.set({ readingList: [{ id: `rl-${Date.now()}`, title, url, ts: Date.now() }, ...s.readingList] })
  useOS.getState().showToast('Added to Reading List', 'glasses')
}

// ------------------------------ Toolbar ------------------------------
function Toolbar(p: {
  url: string; title: string; collapsed: boolean; editing: boolean; landscape: boolean; loading: number; canBack: boolean; canFwd: boolean; readerActive: boolean
  onExpand: () => void; onEdit: () => void; onCancel: () => void; onMenu: () => void; onMore: (el: HTMLElement) => void; onTabs: () => void; onReload: () => void; onLibrary: () => void; onShare: () => void
}) {
  const host = displayHost(p.url)
  const tabs = useOS((s) => s.safariTabs)
  const activeId = useOS((s) => s.safariActiveTab)
  const swipe = useRef<{ x: number; moved: boolean } | null>(null)
  const pillRef = useRef<HTMLDivElement>(null)
  const switchTab = (dir: number) => {
    const i = tabs.findIndex((t) => t.id === activeId)
    const next = tabs[i + dir]
    if (next) {
      useOS.getState().set({ safariActiveTab: next.id })
      if (pillRef.current) animateSpring(pillRef.current, [{ transform: `translateX(${dir * 60}px)`, opacity: 0.4 }, { transform: 'translateX(0)', opacity: 1 }], springs.snappy(), { fill: 'none' })
    } else if (dir > 0) newTab()
  }
  const pillHandlers = {
    onPointerDown: (e: React.PointerEvent) => { swipe.current = { x: e.clientX, moved: false } },
    onPointerUp: (e: React.PointerEvent) => {
      const s = swipe.current
      swipe.current = null
      if (!s) return
      const dx = e.clientX - s.x
      if (Math.abs(dx) > 50) {
        s.moved = true
        switchTab(dx < 0 ? 1 : -1)
        return
      }
      if (p.collapsed) p.onExpand()
      else p.onEdit()
    },
  }
  const progress = p.loading ? <span className={`sf-progress s${p.loading}`} /> : null
  const label = host || 'Search or enter website name'

  if (p.landscape) {
    return (
      <div className={`sf-topbar ${p.collapsed ? 'collapsed' : ''}`}>
        {p.collapsed ? (
          <button className="sf-mini" onClick={p.onExpand}>{host || 'Start Page'}</button>
        ) : (
          <>
            <button className="sf-circle glass interactive" disabled={!p.canBack} onClick={goBack} aria-label="Back"><ChevronLeft size={22} /></button>
            <button className="sf-circle glass interactive" disabled={!p.canFwd} onClick={goForward} aria-label="Forward"><ChevronRight size={22} /></button>
            <div className="sf-pill glass" ref={pillRef} {...pillHandlers}>
              <button className="sf-aa" onClick={(e) => { e.stopPropagation(); p.onMenu() }} onPointerUp={(e) => e.stopPropagation()} aria-label="Page menu"><ALargeSmall size={20} /></button>
              <span className="sf-host">{host ? host : <span className="sf-ph"><Search size={15} /> {label}</span>}</span>
              {host && <button className="sf-aa" onClick={(e) => { e.stopPropagation(); p.onReload() }} onPointerUp={(e) => e.stopPropagation()} aria-label="Reload"><RotateCw size={17} /></button>}
              {progress}
            </div>
            <button className="sf-circle glass interactive" onClick={p.onShare} aria-label="Share"><Share size={19} /></button>
            <button className="sf-circle glass interactive" onClick={p.onLibrary} aria-label="Bookmarks"><BookOpen size={19} /></button>
            <button className="sf-circle glass interactive" onClick={() => newTab()} aria-label="New Tab"><Plus size={21} /></button>
            <button className="sf-circle glass interactive" onClick={p.onTabs} aria-label="Show Tabs"><Copy size={19} /></button>
          </>
        )}
      </div>
    )
  }

  return (
    <div className={`sf-bottombar ${p.collapsed ? 'collapsed' : ''}`}>
      {p.collapsed ? (
        <button className="sf-mini glass" onClick={p.onExpand} aria-label="Show toolbar">
          {p.url !== START && <span className="sf-mini-dot" style={{ background: brandFor(p.url).color }} />}
          {host || 'Start Page'}
        </button>
      ) : (
        <>
          <div className="sf-group glass">
            <button disabled={!p.canBack} onClick={goBack} aria-label="Back"><ChevronLeft size={24} /></button>
            {p.canFwd && <button onClick={goForward} aria-label="Forward"><ChevronRight size={24} /></button>}
          </div>
          <div className="sf-pill glass" ref={pillRef} {...pillHandlers} role="button" aria-label={`Address: ${label}`} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && p.onEdit()}>
            <button className={`sf-aa ${p.readerActive ? 'on' : ''}`} onClick={(e) => { e.stopPropagation(); p.onMenu() }} onPointerUp={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()} aria-label="Page menu"><ALargeSmall size={20} /></button>
            <span className="sf-host">{host ? host : <span className="sf-ph"><Search size={15} /> Search or enter website</span>}</span>
            {host && <button className="sf-aa" onClick={(e) => { e.stopPropagation(); p.onReload() }} onPointerUp={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()} aria-label="Reload"><RotateCw size={17} /></button>}
            {progress}
          </div>
          <div className="sf-group glass">
            <button onClick={p.onTabs} aria-label={`Show Tabs, ${tabs.length} open`}><Copy size={20} /></button>
            <button onClick={(e) => p.onMore(e.currentTarget)} aria-label="More"><Ellipsis size={22} /></button>
          </div>
        </>
      )}
    </div>
  )
}

// ------------------------------ Page menu (aA) ------------------------------
function PageMenu(p: {
  landscape: boolean; onClose: () => void; zoom: number; onZoom: (d: number) => void; resetZoom: () => void; readerAvailable: boolean; reader: boolean; onReader: () => void
  translated: boolean; onTranslate: () => void; canTranslate: boolean; watchable?: { kinds: string[]; label: string }; watching: boolean; onNotify: () => void; onFind: () => void; onHide: () => void
  onExtensions: () => void; onDescribe: () => void; onPrivacy: () => void; isStart: boolean
}) {
  const exts = useOS((s) => s.safariExtensions)
  const ref = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    if (ref.current) animateSpring(ref.current, [{ transform: 'scale(.6)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }], springs.snappy(), { fill: 'none' })
  }, [])
  const act = (f: () => void) => () => {
    p.onClose()
    f()
  }
  const toggleExt = (id: string, v: boolean) => useOS.getState().set({ safariExtensions: useOS.getState().safariExtensions.map((e) => (e.id === id ? { ...e, enabled: v } : e)) })
  return (
    <>
      <div className="sf-menu-scrim" onClick={p.onClose} />
      <div className={`sf-pagemenu glass heavy ${p.landscape ? 'land' : ''}`} ref={ref} role="menu" aria-label="Page menu">
        {!p.isStart && (
          <div className="sf-zoomrow">
            <button onClick={() => p.onZoom(-1)} aria-label="Decrease page zoom"><span style={{ fontSize: 13 }}>A</span></button>
            <button className="sf-zoomval" onClick={p.resetZoom} aria-label="Reset zoom">{Math.round(p.zoom * 100)}%</button>
            <button onClick={() => p.onZoom(1)} aria-label="Increase page zoom"><span style={{ fontSize: 20 }}>A</span></button>
          </div>
        )}
        {p.readerAvailable && <MenuRow icon={<Glasses size={19} />} label={p.reader ? 'Hide Reader' : 'Show Reader'} onClick={act(p.onReader)} />}
        {p.readerAvailable && <MenuRow icon={<Headphones size={19} />} label="Listen to Page" onClick={act(() => { if (!p.reader) p.onReader(); window.setTimeout(() => window.dispatchEvent(new Event('sf-listen')), 250) })} />}
        {p.canTranslate && <MenuRow icon={<Languages size={19} />} label={p.translated ? 'View Original' : 'Translate to Spanish'} onClick={act(p.onTranslate)} />}
        {p.watchable && <MenuRow icon={p.watching ? <BellRing size={19} /> : <Bell size={19} />} label={p.watching ? 'Notify Me · On' : 'Notify Me…'} onClick={act(p.onNotify)} />}
        {!p.isStart && <MenuRow icon={<FileSearch size={19} />} label="Find on Page" onClick={act(p.onFind)} />}
        <div className="sf-menusep" />
        <div className="sf-menuhead">Extensions</div>
        {exts.map((e) => (
          <div key={e.id} className="sf-menurow">
            <Puzzle size={19} />
            <span>{e.name}</span>
            <Switch checked={e.enabled} onChange={(v) => toggleExt(e.id, v)} label={e.name} />
          </div>
        ))}
        <MenuRow icon={<AISparkle size={19} />} label="Describe an Extension…" onClick={act(p.onDescribe)} />
        <MenuRow icon={<Puzzle size={19} />} label="Manage Extensions" onClick={act(p.onExtensions)} />
        <div className="sf-menusep" />
        {!p.isStart && <MenuRow icon={<EyeOff size={19} />} label="Hide Toolbar" onClick={act(p.onHide)} />}
        <MenuRow icon={<ShieldCheck size={19} />} label="Privacy Report" onClick={act(p.onPrivacy)} />
      </div>
    </>
  )
}

function MenuRow({ icon, label, onClick }: { icon: ReactNode; label: string; onClick: () => void }) {
  return (
    <button className="sf-menurow" role="menuitem" onClick={onClick}>
      {icon}
      <span>{label}</span>
    </button>
  )
}

// ------------------------------ Notify Me banner ------------------------------
function NotifyBanner({ url, watching, triggered, onNotify, onDismiss }: { url: string; watching: boolean; triggered: boolean; onNotify: () => void; onDismiss: () => void }) {
  const kind = WATCHABLE[url]?.kinds[0]
  const text = triggered
    ? kind === 'price' ? 'Price dropped to $199 — you asked Safari to watch this page.' : 'Back in stock — you asked Safari to watch this page.'
    : watching
      ? `Watching for ${kind === 'price' ? 'price drops' : kind === 'restock' ? 'restocks' : 'updates'}. Safari will notify you.`
      : kind === 'price' ? 'Get notified if the price drops.' : 'Get notified when this is back in stock.'
  return (
    <div className={`sf-notify-banner glass ${triggered ? 'hit' : ''}`}>
      <span className="sf-nb-icon">{triggered ? <BellRing size={17} /> : <Bell size={17} />}</span>
      <span className="sf-nb-text"><b>Safari</b> {text}</span>
      {!watching && <button className="sf-nb-btn" onClick={onNotify}>Notify Me</button>}
      {watching && !triggered && <button className="sf-nb-btn ghost" onClick={onNotify}>Edit</button>}
      <button className="sf-nb-x" onClick={onDismiss} aria-label="Dismiss"><X size={15} /></button>
    </div>
  )
}

// ------------------------------ Address editing ------------------------------
function EditPanel({ initial, onDone, onFind, landscape }: { initial: string; onDone: () => void; onFind: () => void; landscape: boolean }) {
  const [q, setQ] = useState(initial)
  const inputRef = useRef<HTMLInputElement>(null)
  const history = useOS((s) => s.safariHistory)
  const bookmarks = useSafari((s) => s.bookmarks)
  useEffect(() => {
    const el = inputRef.current
    if (!el) return
    el.focus()
    el.select()
  }, [])
  const go = (u: string) => {
    inputRef.current?.blur()
    navigate(u)
    onDone()
  }
  const cancel = () => {
    inputRef.current?.blur()
    onDone()
  }
  const ql = q.trim().toLowerCase()
  const typed = ql && ql !== initial.toLowerCase()
  const siteHits = typed ? searchSites(ql).filter((u) => SAFARI_SITES[u].kind !== 'blocked' || useOS.getState().screenTime.childMode).slice(0, 4) : []
  const bmHits = typed ? bookmarks.filter((b) => `${b.title} ${b.url}`.toLowerCase().includes(ql)).slice(0, 3) : []
  const histHits = typed ? dedupe(history).filter((h) => `${h.title} ${h.url}`.toLowerCase().includes(ql) && !bmHits.some((b) => b.url === h.url)).slice(0, 3) : []
  const top = bmHits[0]?.url ?? histHits[0]?.url ?? siteHits[0]
  const completions = typed ? suggestCompletions(ql) : []
  return (
    <div className={`sf-edit ${landscape ? 'land' : ''}`}>
      <div className="sf-edit-panel scroll">
        {!typed ? (
          <>
            <div className="sf-sec-title">Favorites</div>
            <FavoritesGrid onOpen={go} />
            <div className="sf-sec-title">Recently Visited</div>
            <div className="sf-edit-list">
              {dedupe(history).slice(0, 5).map((h) => (
                <button key={h.url} className="sf-edit-item" onClick={() => go(h.url)}>
                  <Favicon url={h.url} size={30} />
                  <span><b>{h.title}</b><small>{h.url}</small></span>
                </button>
              ))}
              {history.length === 0 && <div className="sf-empty-note">Pages you visit will appear here.</div>}
            </div>
          </>
        ) : (
          <>
            {top && (
              <>
                <div className="sf-sec-title">Top Hit</div>
                <div className="sf-edit-list">
                  <button className="sf-edit-item top" onClick={() => go(top)}>
                    <Favicon url={top} size={34} />
                    <span><b>{titleFor(top)}</b><small>{top}</small></span>
                  </button>
                </div>
              </>
            )}
            <div className="sf-sec-title">Search Suggestions</div>
            <div className="sf-edit-list">
              {[q.trim(), ...completions].filter((x, i, a) => a.indexOf(x) === i).slice(0, 4).map((c) => (
                <button key={c} className="sf-edit-item" onClick={() => go(searchUrl(c))}>
                  <span className="sf-edit-ic"><Search size={17} /></span>
                  <span><b>{c}</b></span>
                </button>
              ))}
            </div>
            {(bmHits.length > 0 || histHits.length > 0) && (
              <>
                <div className="sf-sec-title">Bookmarks and History</div>
                <div className="sf-edit-list">
                  {[...bmHits, ...histHits].map((h) => (
                    <button key={h.url} className="sf-edit-item" onClick={() => go(h.url)}>
                      <span className="sf-edit-ic">{'id' in h ? <BookmarkIcon size={17} /> : <Clock size={17} />}</span>
                      <span><b>{h.title}</b><small>{h.url}</small></span>
                    </button>
                  ))}
                </div>
              </>
            )}
            {siteHits.length > 0 && (
              <>
                <div className="sf-sec-title">Websites</div>
                <div className="sf-edit-list">
                  {siteHits.filter((u) => u !== top).map((u) => (
                    <button key={u} className="sf-edit-item" onClick={() => go(u)}>
                      <Favicon url={u} size={30} />
                      <span><b>{SAFARI_SITES[u].title}</b><small>{u}</small></span>
                    </button>
                  ))}
                </div>
              </>
            )}
            {initial && (
              <>
                <div className="sf-sec-title">On This Page</div>
                <div className="sf-edit-list">
                  <button className="sf-edit-item" onClick={onFind}>
                    <span className="sf-edit-ic"><FileSearch size={17} /></span>
                    <span><b>Find “{q.trim()}”</b></span>
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </div>
      <form className="sf-edit-bar" onSubmit={(e) => { e.preventDefault(); if (q.trim()) go(q) }}>
        <label className="sf-edit-field glass">
          <Search size={17} />
          <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search or enter website name" aria-label="Address" enterKeyHint="go" autoCapitalize="off" autoCorrect="off" spellCheck={false} data-dictation="luma coast tour dates|swerve module tuning|weather radar maple grove" />
          {q && <button type="button" className="sf-clear" onClick={() => { setQ(''); inputRef.current?.focus() }} aria-label="Clear text"><X size={12} strokeWidth={3} /></button>}
        </label>
        <button type="button" className="sf-circle glass interactive" onClick={cancel} aria-label="Cancel"><X size={20} /></button>
      </form>
    </div>
  )
}

function suggestCompletions(q: string): string[] {
  const pool = ['aurora x2 headphones', 'aurora x2 price', 'maple grove weather', 'maple grove radar', 'stoichiometry practice problems', 'swerve module tuning', 'swerve drive pid', 'luma coast tour', 'luma coast tickets', 'lincoln high calendar', 'brushless motors', 'single board computer kit', 'free games', 'funny dog videos', 'morning brief news', 'chemistry unit 3 review', 'homecoming 2026']
  return pool.filter((p) => p.startsWith(q) || p.includes(` ${q}`)).slice(0, 3)
}

function dedupe<T extends { url: string }>(list: T[]): T[] {
  const seen = new Set<string>()
  return list.filter((x) => (seen.has(x.url) ? false : (seen.add(x.url), true)))
}

// ------------------------------ Find on page ------------------------------
type HL = { set: (k: string, v: unknown) => void; delete: (k: string) => void }
function FindBar({ root, scroller, onClose }: { root: HTMLElement | null; scroller: HTMLElement | null; onClose: () => void }) {
  const [q, setQ] = useState('')
  const [idx, setIdx] = useState(0)
  const [ranges, setRanges] = useState<Range[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => inputRef.current?.focus(), [])
  useEffect(() => {
    const out: Range[] = []
    const needle = q.trim().toLowerCase()
    if (root && needle.length >= 1) {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
      while (walker.nextNode()) {
        const n = walker.currentNode as Text
        const text = (n.nodeValue ?? '').toLowerCase()
        let i = text.indexOf(needle)
        while (i >= 0 && out.length < 500) {
          const r = document.createRange()
          r.setStart(n, i)
          r.setEnd(n, i + needle.length)
          out.push(r)
          i = text.indexOf(needle, i + needle.length)
        }
      }
    }
    setRanges(out)
    setIdx(0)
  }, [q, root])
  useEffect(() => {
    const hl = (CSS as unknown as { highlights?: HL }).highlights
    const H = (window as unknown as { Highlight?: new (...r: Range[]) => unknown }).Highlight
    if (!hl || !H) return
    hl.set('sf-find', new H(...ranges))
    if (ranges[idx]) hl.set('sf-find-cur', new H(ranges[idx]))
    else hl.delete('sf-find-cur')
    const r = ranges[idx]
    if (r && scroller) {
      const rect = r.getBoundingClientRect()
      const sr = scroller.getBoundingClientRect()
      const scale = sr.height / scroller.offsetHeight || 1
      const y = (rect.top - sr.top) / scale
      if (y < 80 || y > scroller.offsetHeight * 0.45) scroller.scrollTo({ top: scroller.scrollTop + y - scroller.offsetHeight * 0.25, behavior: 'smooth' })
    }
  }, [ranges, idx, scroller])
  useEffect(() => () => {
    const hl = (CSS as unknown as { highlights?: HL }).highlights
    hl?.delete('sf-find')
    hl?.delete('sf-find-cur')
  }, [])
  const n = ranges.length
  return (
    <form className="sf-findbar glass heavy" onSubmit={(e) => { e.preventDefault(); if (n) setIdx((i) => (i + 1) % n) }}>
      <label className="sf-find-field">
        <Search size={16} />
        <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find on Page" aria-label="Find on Page" enterKeyHint="search" />
        {q && <span className="sf-find-count">{n ? `${idx + 1} of ${n}` : 'No matches'}</span>}
      </label>
      <button type="button" disabled={!n} onClick={() => setIdx((i) => (i - 1 + n) % n)} aria-label="Previous match"><ChevronDown size={20} style={{ transform: 'rotate(180deg)' }} /></button>
      <button type="button" disabled={!n} onClick={() => setIdx((i) => (i + 1) % n)} aria-label="Next match"><ChevronDown size={20} /></button>
      <button type="button" className="sf-find-done" onClick={() => { inputRef.current?.blur(); onClose() }}>Done</button>
    </form>
  )
}

// ------------------------------ Reader ------------------------------
interface RBlock { tag: string; text: string }
function extractReader(root: HTMLElement | null): RBlock[] {
  if (!root) return []
  const out: RBlock[] = []
  root.querySelectorAll('.sf-article').forEach((art) => {
    art.querySelectorAll('h1, h2, h3, p, li, figcaption, pre, .sf-ch-formula').forEach((el) => {
      if (el.closest('.sf-ad, .sf-comments, button')) return
      const text = (el as HTMLElement).innerText.trim()
      if (!text || text.length < 2) return
      const tag = el.classList.contains('sf-ch-formula') ? 'pre' : el.tagName.toLowerCase()
      if (out.some((b) => b.text === text)) return
      out.push({ tag, text })
    })
  })
  return out
}

function ReaderView({ title, host, root, onClose }: { title: string; host: string; root: HTMLElement | null; onClose: () => void }) {
  const prefs = useSafari((s) => s.readerPrefs)
  const blocks = useMemo(() => extractReader(root), [root])
  const [summary, setSummary] = useState<string | null>(null)
  const [summarizing, setSummarizing] = useState(false)
  const [speaking, setSpeaking] = useState<number | null>(null)
  const [opts, setOpts] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const timer = useRef<number | undefined>(undefined)
  const setP = (p: Partial<typeof prefs>) => useSafari.getState().set({ readerPrefs: { ...prefs, ...p } })
  useLayoutEffect(() => {
    if (ref.current) animateSpring(ref.current, [{ transform: 'translateY(40px)', opacity: 0 }, { transform: 'translateY(0)', opacity: 1 }], springs.sheet(), { fill: 'none' })
  }, [])
  const stop = () => {
    window.clearTimeout(timer.current)
    try { window.speechSynthesis?.cancel() } catch { /* not available */ }
    setSpeaking(null)
  }
  const listen = () => {
    if (speaking !== null) return stop()
    let i = 0
    const step = () => {
      if (i >= blocks.length) return setSpeaking(null)
      setSpeaking(i)
      ref.current?.querySelector(`[data-rb="${i}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' })
      const words = blocks[i].text.split(/\s+/).length
      i++
      timer.current = window.setTimeout(step, Math.min(6000, 600 + words * 190))
    }
    try {
      if (window.speechSynthesis && typeof SpeechSynthesisUtterance !== 'undefined') {
        window.speechSynthesis.cancel()
        const u = new SpeechSynthesisUtterance(blocks.map((b) => b.text).join('. '))
        u.volume = useOS.getState().volume
        window.speechSynthesis.speak(u)
      }
    } catch { /* speech unavailable: visual read-along only */ }
    step()
  }
  useEffect(() => {
    const onListen = () => listen()
    window.addEventListener('sf-listen', onListen)
    return () => {
      window.removeEventListener('sf-listen', onListen)
      stop()
    }
  }) // eslint-disable-line react-hooks/exhaustive-deps
  const doSummary = () => {
    setSummarizing(true)
    window.setTimeout(() => {
      const heads = blocks.filter((b) => b.tag === 'h2').map((b) => b.text.replace(/^\d+\.\s*/, '').replace(/\s*\(new\)$/i, '')).slice(0, 4)
      const body = summarize(blocks.filter((b) => b.tag === 'p' || b.tag === 'li').map((b) => b.text).join(' '))
      const covers = heads.length > 1 ? ` It covers ${heads.slice(0, -1).map((h) => h.toLowerCase()).join(', ')} and ${heads[heads.length - 1].toLowerCase()}.` : ''
      setSummary(body + covers)
      setSummarizing(false)
    }, 700)
  }
  const font = prefs.font === 'Serif' ? "'New York', Georgia, serif" : prefs.font === 'Rounded' ? 'var(--font-rounded)' : 'var(--font-text)'
  const mins = Math.max(1, Math.round(blocks.reduce((a, b) => a + b.text.split(/\s+/).length, 0) / 220))
  return (
    <div className={`sf-reader theme-${prefs.theme}`} ref={ref} role="dialog" aria-label="Reader">
      <div className="sf-reader-top">
        <button className="sf-circle glass interactive" onClick={() => { stop(); onClose() }} aria-label="Close Reader"><X size={20} /></button>
        <div className="sf-reader-actions">
          <button className={`sf-circle glass interactive ${speaking !== null ? 'on' : ''}`} onClick={listen} aria-label={speaking !== null ? 'Stop listening' : 'Listen'}><Headphones size={19} /></button>
          <button className="sf-circle glass interactive" onClick={() => setOpts((o) => !o)} aria-label="Reader appearance"><ALargeSmall size={20} /></button>
        </div>
      </div>
      {opts && (
        <div className="sf-reader-opts glass heavy">
          <div className="sf-ro-row">
            <button onClick={() => setP({ size: Math.max(14, prefs.size - 2) })} aria-label="Smaller text">A</button>
            <span>{prefs.size}pt</span>
            <button onClick={() => setP({ size: Math.min(30, prefs.size + 2) })} aria-label="Larger text" style={{ fontSize: 22 }}>A</button>
          </div>
          <div className="sf-ro-themes">
            {(['light', 'sepia', 'gray', 'dark'] as const).map((t) => (
              <button key={t} className={`t-${t} ${prefs.theme === t ? 'on' : ''}`} onClick={() => setP({ theme: t })} aria-label={`${t} theme`} />
            ))}
          </div>
          <Segmented options={['System', 'Serif', 'Rounded'] as const} value={prefs.font} onChange={(f) => setP({ font: f })} />
        </div>
      )}
      <div className="sf-reader-body scroll" style={{ fontFamily: font, fontSize: prefs.size }}>
        <div className="sf-reader-host">{host}</div>
        <h1>{title}</h1>
        <div className="sf-reader-meta">{mins} min read</div>
        <div className={`sf-reader-sum ${summary ? 'done' : ''}`}>
          {summary ? (
            <>
              <div className="sf-sum-head"><AISparkle size={16} /> Summary</div>
              <p>{summary}</p>
            </>
          ) : (
            <button onClick={doSummary} disabled={summarizing}>
              {summarizing ? <Spinner size={16} /> : <AISparkle size={16} />} {summarizing ? 'Summarizing…' : 'Summarize'}
            </button>
          )}
        </div>
        {blocks.filter((b) => b.tag !== 'h1' || b.text !== title).map((b, i) => {
          const cls = speaking === i ? 'speaking' : ''
          if (b.tag === 'h1' || b.tag === 'h2') return <h2 key={i} data-rb={i} className={cls}>{b.text}</h2>
          if (b.tag === 'h3') return <h3 key={i} data-rb={i} className={cls}>{b.text}</h3>
          if (b.tag === 'li') return <p key={i} data-rb={i} className={`li ${cls}`}>• {b.text}</p>
          if (b.tag === 'pre') return <pre key={i} data-rb={i} className={cls}>{b.text}</pre>
          if (b.tag === 'figcaption') return <p key={i} data-rb={i} className={`cap ${cls}`}>{b.text}</p>
          return <p key={i} data-rb={i} className={cls}>{b.text}</p>
        })}
      </div>
    </div>
  )
}

// ------------------------------ Start Page ------------------------------
function Favicon({ url, size = 28 }: { url: string; size?: number }) {
  const b = brandFor(url)
  return (
    <span className="sf-fav" style={{ width: size, height: size, borderRadius: size * 0.24, background: b.color, color: b.fg ?? '#fff', fontSize: size * 0.48 }} aria-hidden>
      {b.letter}
    </span>
  )
}

function FavoritesGrid({ onOpen }: { onOpen: (url: string) => void }) {
  const bookmarks = useSafari((s) => s.bookmarks)
  const favs = bookmarks.filter((b) => b.favorite)
  return (
    <div className="sf-favgrid">
      {favs.map((b) => (
        <FavTile key={b.id} b={b} onOpen={onOpen} />
      ))}
    </div>
  )
}

function FavTile({ b, onOpen }: { b: Bookmark; onOpen: (url: string) => void }) {
  return (
    <button
      className="sf-favtile"
      onClick={() => onOpen(b.url)}
      onContextMenu={(e) => {
        e.preventDefault()
        openMenu(e.currentTarget, [
          { label: 'Open in New Tab', icon: <Plus size={18} />, onSelect: () => newTab(b.url) },
          { label: 'Remove from Favorites', icon: <Trash2 size={18} />, destructive: true, onSelect: () => useSafari.getState().set({ bookmarks: useSafari.getState().bookmarks.map((x) => (x.id === b.id ? { ...x, favorite: false } : x)) }) },
        ])
      }}
    >
      <Favicon url={b.url} size={58} />
      <span>{b.title}</span>
    </button>
  )
}

const START_SECTIONS = ['Favorites', 'Privacy Report', 'Shared with You', 'Recently Visited', 'Reading List', 'Siri Suggestions'] as const

function StartPage({ onPrivacy, onLibrary, onEdit }: { onPrivacy: () => void; onLibrary: (t: 'Bookmarks' | 'Reading List' | 'History' | 'Watching') => void; onEdit: () => void }) {
  const t0 = useRef(performance.now())
  const [ms, setMs] = useState<number | null>(null)
  const history = useOS((s) => s.safariHistory)
  const reading = useSafari((s) => s.readingList)
  const hidden = useSafari((s) => s.hiddenSections)
  const tabs = useOS((s) => s.safariTabs)
  useEffect(() => {
    const m = performance.now() - t0.current
    setMs(Math.max(4, Math.round(m)))
  }, [])
  const recent = dedupe(history).slice(0, 8)
  const recentShown = recent.length ? recent : tabs.slice(0, 6).map((t) => ({ url: t.url, title: t.title, ts: t.ts }))
  const show = (k: string) => !hidden.includes(k)
  const suggestions = ['bolt.example/headphones-x2', 'stormwatch.example/radar', 'lincoln.example/calendar'].filter((u) => !tabs.some((t) => t.url === u && t.id === useOS.getState().safariActiveTab))
  return (
    <div className="sf-start">
      {show('Favorites') && (
        <>
          <h2 className="sf-start-h">Favorites</h2>
          <FavoritesGrid onOpen={(u) => navigate(u)} />
        </>
      )}
      {show('Privacy Report') && (
        <>
          <h2 className="sf-start-h">Privacy Report</h2>
          <button className="sf-start-card sf-privacy-card" onClick={onPrivacy}>
            <ShieldCheck size={30} className="sf-shield" />
            <span className="sf-pc-num">42</span>
            <span className="sf-pc-text">In the last seven days, Safari has prevented 42 trackers from profiling you and hidden your IP address from known trackers.</span>
          </button>
        </>
      )}
      {show('Shared with You') && (
        <>
          <h2 className="sf-start-h">Shared with You</h2>
          <div className="sf-hscroll">
            <button className="sf-start-card sf-link-card" onClick={() => navigate('chemreview.example/unit-3')}>
              <div className="sf-lc-img" style={{ background: '#12a37f' }}>⚗︎</div>
              <b>Unit 3 Review: Stoichiometry</b>
              <small>chemreview.example</small>
              <span className="sf-from">From Priya Shah</span>
            </button>
          </div>
        </>
      )}
      {show('Recently Visited') && (
        <>
          <h2 className="sf-start-h">Recently Visited <button className="sf-start-more" onClick={() => onLibrary('History')}>Show All</button></h2>
          <div className="sf-hscroll">
            {recentShown.map((h) => (
              <button key={h.url} className="sf-start-card sf-link-card" onClick={() => navigate(h.url)}>
                <div className="sf-lc-img" style={{ background: brandFor(h.url).color, color: brandFor(h.url).fg ?? '#fff' }}>{brandFor(h.url).letter}</div>
                <b>{h.title}</b>
                <small>{hostOf(h.url) || 'Search'}</small>
              </button>
            ))}
          </div>
        </>
      )}
      {show('Reading List') && reading.length > 0 && (
        <>
          <h2 className="sf-start-h">Reading List <button className="sf-start-more" onClick={() => onLibrary('Reading List')}>Show All</button></h2>
          <div className="sf-rl">
            {reading.slice(0, 3).map((x) => (
              <button key={x.id} className="sf-rl-item" onClick={() => navigate(x.url)}>
                <Favicon url={x.url} size={40} />
                <span><b>{x.title}</b><small>{hostOf(x.url)} · {fmtRelative(x.ts)}</small></span>
                {!x.read && <i className="sf-unread" />}
              </button>
            ))}
          </div>
        </>
      )}
      {show('Siri Suggestions') && (
        <>
          <h2 className="sf-start-h">Siri Suggestions</h2>
          <div className="sf-rl">
            {suggestions.map((u) => (
              <button key={u} className="sf-rl-item" onClick={() => navigate(u)}>
                <Favicon url={u} size={40} />
                <span><b>{SAFARI_SITES[u].title}</b><small>{u === 'bolt.example/headphones-x2' ? 'Found in Messages and Mail' : u.includes('radar') ? 'Storms expected Thursday' : 'Upcoming school events'}</small></span>
              </button>
            ))}
          </div>
        </>
      )}
      <div className="sf-start-foot">
        <button className="sf-edit-btn" onClick={onEdit}><Pencil size={14} /> Edit</button>
        <div className="sf-perf">{ms !== null ? `Start Page loaded in ${ms} ms` : 'Loading…'} · Safari 27</div>
      </div>
    </div>
  )
}

function StartEditSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const hidden = useSafari((s) => s.hiddenSections)
  const set = (k: string, v: boolean) => useSafari.getState().set({ hiddenSections: v ? hidden.filter((x) => x !== k) : [...hidden, k] })
  return (
    <Sheet open={open} onClose={onClose} title="Customize Start Page" detent="medium" trailing={<button className="bar-btn tinted" onClick={onClose}>Done</button>} closeButton={false}>
      <List>
        {START_SECTIONS.map((k) => <Row key={k} title={k} toggle={{ value: !hidden.includes(k), onChange: (v) => set(k, v) }} />)}
      </List>
    </Sheet>
  )
}

// =====================================================================================
// Tab overview (+ Organize by Topic, tab groups)
// =====================================================================================
function TabOverview({ onClose, onNewGroup }: { onClose: () => void; onNewGroup: () => void }) {
  const tabs = useOS((s) => s.safariTabs)
  const activeId = useOS((s) => s.safariActiveTab)
  const landscape = useOS((s) => s.orientation === 'landscape')
  const activeGroup = useSafari((s) => s.activeGroup)
  const extraGroups = useSafari((s) => s.extraGroups)
  const [organizing, setOrganizing] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const rects = useRef<Map<string, DOMRect>>(new Map())
  const groups = useMemo(() => {
    const g = [...new Set([...tabs.map((t) => t.group).filter(Boolean) as string[], ...extraGroups])]
    return g.sort((a, b) => (GROUP_ORDER.indexOf(a) + 1 || 50) - (GROUP_ORDER.indexOf(b) + 1 || 50))
  }, [tabs, extraGroups])
  const visible = activeGroup ? tabs.filter((t) => t.group === activeGroup) : tabs
  const sectioned = !activeGroup && tabs.some((t) => t.group)

  useLayoutEffect(() => {
    if (rootRef.current) animateSpring(rootRef.current, [{ opacity: 0, transform: 'scale(1.06)' }, { opacity: 1, transform: 'scale(1)' }], springs.snappy(), { fill: 'none' })
  }, [])

  // FLIP: animate cards from their old positions whenever layout changes
  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root) return
    const cards = root.querySelectorAll<HTMLElement>('[data-tab]')
    cards.forEach((el) => {
      const id = el.dataset.tab!
      const now = el.getBoundingClientRect()
      const prev = rects.current.get(id)
      if (prev && (Math.abs(prev.left - now.left) > 1 || Math.abs(prev.top - now.top) > 1)) {
        const scale = root.getBoundingClientRect().width / root.offsetWidth || 1
        const dx = (prev.left - now.left) / scale
        const dy = (prev.top - now.top) / scale
        animateSpring(el, [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'translate(0,0)' }], springs.sheet(), { fill: 'none' })
      }
    })
  })
  const snapshot = () => {
    rects.current.clear()
    rootRef.current?.querySelectorAll<HTMLElement>('[data-tab]').forEach((el) => rects.current.set(el.dataset.tab!, el.getBoundingClientRect()))
  }

  const organize = () => {
    snapshot()
    setOrganizing(true)
    window.setTimeout(() => {
      snapshot()
      const { groups: g } = organizeByTopic()
      useSafari.getState().set({ activeGroup: null })
      setOrganizing(false)
      useOS.getState().showToast(`Organized into ${g.length} groups`, 'sparkles')
    }, 900)
  }
  const ungroup = () => {
    snapshot()
    useOS.getState().set({ safariTabs: useOS.getState().safariTabs.map((t) => ({ ...t, group: undefined })) })
  }

  const pick = (id: string) => {
    useOS.getState().set({ safariActiveTab: id })
    onClose()
  }

  const groupMenu = (el: HTMLElement) => {
    const set = useSafari.getState().set
    openMenu(el, [
      { label: `All Tabs (${tabs.length})`, icon: activeGroup === null ? <Check size={18} /> : <Copy size={18} />, onSelect: () => set({ activeGroup: null }) },
      ...groups.map((g, i) => ({ label: `${g} (${tabs.filter((t) => t.group === g).length})`, icon: activeGroup === g ? <Check size={18} /> : <Layers size={18} color={groupColor(g)} />, separatorBefore: i === 0, onSelect: () => set({ activeGroup: g }) })),
      { label: 'New Empty Tab Group', icon: <Plus size={18} />, separatorBefore: true, onSelect: onNewGroup },
      ...(sectioned ? [{ label: 'Ungroup All Tabs', icon: <X size={18} />, onSelect: ungroup }] : []),
    ])
  }

  const renderCards = (list: typeof tabs) => (
    <div className={`sf-tabgrid ${landscape ? 'land' : ''}`}>
      {list.map((t) => (
        <TabCard key={t.id} tab={t} active={t.id === activeId} onOpen={() => pick(t.id)} onClose={() => closeTab(t.id)} groups={groups} snapshot={snapshot} />
      ))}
    </div>
  )

  const sections = sectioned ? groups.map((g) => ({ g, list: tabs.filter((t) => t.group === g) })).filter((x) => x.list.length) : []
  const ungrouped = sectioned ? tabs.filter((t) => !t.group) : []

  return (
    <div className={`sf-tabs ${organizing ? 'organizing' : ''}`} ref={rootRef}>
      <div className="sf-tabs-scroll scroll">
        <div className="sf-tabs-head">
          <div>
            <h1>{activeGroup ?? 'All Tabs'}</h1>
            <small>{visible.length} tab{visible.length === 1 ? '' : 's'}{sectioned ? ` · ${sections.length} groups` : ''}</small>
          </div>
          <button className={`sf-organize ${organizing ? 'busy ai-glow' : ''}`} onClick={organize} disabled={organizing || tabs.length < 2}>
            {organizing ? <Spinner size={15} /> : <AISparkle size={16} />} {organizing ? 'Organizing…' : 'Organize by Topic'}
          </button>
        </div>
        {sectioned ? (
          <>
            {sections.map(({ g, list }) => (
              <section key={g} className="sf-tabsec">
                <button className="sf-tabsec-h" onClick={() => useSafari.getState().set({ activeGroup: g })}>
                  <i style={{ background: groupColor(g) }} /> {g} <span>{list.length}</span> <ChevronRight size={16} />
                </button>
                {renderCards(list)}
              </section>
            ))}
            {ungrouped.length > 0 && (
              <section className="sf-tabsec">
                <div className="sf-tabsec-h"><i style={{ background: '#8e8e93' }} /> Ungrouped <span>{ungrouped.length}</span></div>
                {renderCards(ungrouped)}
              </section>
            )}
          </>
        ) : (
          renderCards(visible)
        )}
        {visible.length === 0 && (
          <div className="sf-tabs-empty">
            <b>No Tabs in “{activeGroup}”</b>
            <button onClick={() => { newTab(START, activeGroup); onClose() }}>Open a New Tab</button>
          </div>
        )}
      </div>
      <div className="sf-tabs-bar">
        <button className="sf-circle glass interactive" onClick={() => { newTab(START); onClose() }} aria-label="New Tab"><Plus size={24} /></button>
        <button className="sf-groupbtn glass interactive" onClick={(e) => groupMenu(e.currentTarget)}>
          {activeGroup ? <i style={{ background: groupColor(activeGroup) }} /> : null}
          {activeGroup ?? `${tabs.length} Tabs`} <ChevronDown size={16} />
        </button>
        <button className="sf-done glass interactive" onClick={onClose}>Done</button>
      </div>
    </div>
  )
}

function TabCard({ tab, active, onOpen, onClose, groups, snapshot }: { tab: { id: string; url: string; title: string; group?: string }; active: boolean; onOpen: () => void; onClose: () => void; groups: string[]; snapshot: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const drag = useRef<{ x: number; dx: number } | null>(null)
  const blocked = isBlocked(tab.url)
  const menu = (el: HTMLElement) => {
    const moveTo = (g: string | undefined) => {
      snapshot()
      useOS.getState().set({ safariTabs: useOS.getState().safariTabs.map((t) => (t.id === tab.id ? { ...t, group: g } : t)) })
    }
    openMenu(el, [
      { label: 'Copy Link', icon: <Link size={18} />, onSelect: () => useOS.getState().showToast('Link Copied', 'link') },
      { label: 'Share', icon: <Share size={18} />, onSelect: () => useOS.getState().set({ shareRequest: { title: tab.title, kind: 'link', payload: `https://${tab.url}`, app: 'safari' } }) },
      ...groups.filter((g) => g !== tab.group).slice(0, 5).map((g, i) => ({ label: `Move to “${g}”`, icon: <Layers size={18} color={groupColor(g)} />, separatorBefore: i === 0, onSelect: () => moveTo(g) })),
      ...(tab.group ? [{ label: 'Remove from Group', icon: <X size={18} />, onSelect: () => moveTo(undefined) }] : []),
      { label: 'Close Tab', icon: <X size={18} />, destructive: true, separatorBefore: true, onSelect: onClose },
      { label: 'Close Other Tabs', icon: <Trash2 size={18} />, destructive: true, onSelect: () => useOS.getState().set({ safariTabs: useOS.getState().safariTabs.filter((t) => t.id === tab.id), safariActiveTab: tab.id }) },
    ])
  }
  return (
    <div
      ref={ref}
      className={`sf-tabcard ${active ? 'active' : ''}`}
      data-tab={tab.id}
      onPointerDown={(e) => { drag.current = { x: e.clientX, dx: 0 } }}
      onPointerMove={(e) => {
        const d = drag.current
        if (!d || !ref.current) return
        d.dx = e.clientX - d.x
        if (Math.abs(d.dx) > 8) ref.current.style.transform = `translateX(${d.dx}px) rotate(${d.dx / 40}deg)`
        ref.current.style.opacity = String(1 - Math.min(0.6, Math.abs(d.dx) / 300))
      }}
      onPointerUp={() => {
        const d = drag.current
        drag.current = null
        if (!d || !ref.current) return
        if (Math.abs(d.dx) > 110) {
          snapshot()
          onClose()
          return
        }
        ref.current.style.transform = ''
        ref.current.style.opacity = ''
        if (Math.abs(d.dx) < 6) onOpen()
      }}
      onPointerLeave={() => {
        if (drag.current && ref.current) {
          drag.current = null
          ref.current.style.transform = ''
          ref.current.style.opacity = ''
        }
      }}
      onContextMenu={(e) => { e.preventDefault(); menu(e.currentTarget) }}
      role="button"
      aria-label={`${tab.title}${active ? ', current tab' : ''}`}
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onOpen()}
    >
      <div className="sf-thumb">
        <div className="sf-thumb-inner sf-webview" inert>
          <WebCtx.Provider value={{ go: () => {}, url: tab.url, jump: () => {} }}>
            {blocked ? <RestrictedPage host={hostOf(tab.url)} onAsk={() => {}} /> : resolve(tab.url).kind === 'start' ? <MiniStart /> : <PageFor url={tab.url} />}
          </WebCtx.Provider>
        </div>
        <button className="sf-tabclose" onPointerDown={(e) => e.stopPropagation()} onPointerUp={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); snapshot(); onClose() }} aria-label={`Close ${tab.title}`}><X size={13} strokeWidth={3} /></button>
      </div>
      <div className="sf-tabtitle">
        <Favicon url={tab.url} size={16} />
        <span>{tab.url === START ? 'Start Page' : tab.title}</span>
      </div>
    </div>
  )
}

function MiniStart() {
  const bookmarks = useSafari((s) => s.bookmarks)
  return (
    <div className="sf-start">
      <h2 className="sf-start-h">Favorites</h2>
      <div className="sf-favgrid">
        {bookmarks.filter((b) => b.favorite).map((b) => (
          <div key={b.id} className="sf-favtile"><Favicon url={b.url} size={58} /><span>{b.title}</span></div>
        ))}
      </div>
    </div>
  )
}

function NewGroupSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [name, setName] = useState('')
  useEffect(() => { if (open) setName('') }, [open])
  const create = () => {
    const n = name.trim()
    if (!n) return
    const s = useSafari.getState()
    s.set({ extraGroups: [...new Set([...s.extraGroups, n])], activeGroup: n })
    onClose()
  }
  return (
    <Sheet open={open} onClose={onClose} title="New Tab Group" detent="medium" trailing={<button className="bar-btn tinted" disabled={!name.trim()} onClick={create} style={{ fontWeight: 600 }}>Save</button>}>
      <form onSubmit={(e) => { e.preventDefault(); create() }} style={{ padding: '8px 16px' }}>
        <input className="sf-sheet-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" aria-label="Group name" autoFocus enterKeyHint="done" />
      </form>
      <div className="list-footer" style={{ marginTop: 4 }}>Tab groups sync across your devices with iCloud.</div>
    </Sheet>
  )
}

// =====================================================================================
// Sheets: Library (bookmarks, reading list, history, watching), Extensions, Privacy, Notify
// =====================================================================================
function LibrarySheet({ open, tab, setTab, onClose }: { open: boolean; tab: 'Bookmarks' | 'Reading List' | 'History' | 'Watching'; setTab: (t: 'Bookmarks' | 'Reading List' | 'History' | 'Watching') => void; onClose: () => void }) {
  const bookmarks = useSafari((s) => s.bookmarks)
  const reading = useSafari((s) => s.readingList)
  const history = useOS((s) => s.safariHistory)
  const watches = useOS((s) => s.safariWatches)
  const [q, setQ] = useState('')
  const openUrl = (u: string) => {
    onClose()
    navigate(u)
  }
  const ql = q.toLowerCase()
  const f = <T extends { title: string; url: string }>(l: T[]) => (ql ? l.filter((x) => `${x.title} ${x.url}`.toLowerCase().includes(ql)) : l)
  const byDay = useMemo(() => {
    const groups: Record<string, typeof history> = {}
    for (const h of f(history)) {
      const k = fmtRelative(h.ts).includes(':') ? 'Today' : fmtRelative(h.ts)
      ;(groups[k] ??= []).push(h)
    }
    return groups
  }, [history, ql]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Sheet open={open} onClose={onClose} title={tab} detent="large" trailing={<button className="bar-btn tinted" onClick={onClose} style={{ fontWeight: 600 }}>Done</button>} closeButton={false}>
      <div style={{ padding: '0 16px 10px' }}>
        <Segmented options={['Bookmarks', 'Reading List', 'History', 'Watching'] as const} value={tab} onChange={setTab} labels={{ Bookmarks: <BookOpen size={17} />, 'Reading List': <Glasses size={17} />, History: <Clock size={17} />, Watching: <Bell size={17} /> }} />
      </div>
      {tab !== 'Watching' && (
        <div style={{ padding: '0 16px 12px' }}>
          <label className="search-field"><Search size={17} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${tab}`} aria-label={`Search ${tab}`} /></label>
        </div>
      )}
      {tab === 'Bookmarks' && (
        <>
          <List header="Favorites">
            {f(bookmarks.filter((b) => b.favorite)).map((b) => (
              <Row key={b.id} icon={<Favicon url={b.url} size={30} />} title={b.title} subtitle={b.url} onClick={() => openUrl(b.url)} trailing={<DeleteBtn onClick={() => useSafari.getState().set({ bookmarks: bookmarks.filter((x) => x.id !== b.id) })} />} />
            ))}
          </List>
          {bookmarks.some((b) => !b.favorite) && (
            <List header="Bookmarks">
              {f(bookmarks.filter((b) => !b.favorite)).map((b) => (
                <Row key={b.id} icon={<Favicon url={b.url} size={30} />} title={b.title} subtitle={b.url} onClick={() => openUrl(b.url)} trailing={<DeleteBtn onClick={() => useSafari.getState().set({ bookmarks: bookmarks.filter((x) => x.id !== b.id) })} />} />
              ))}
            </List>
          )}
        </>
      )}
      {tab === 'Reading List' && (
        <List footer={reading.length ? `${reading.filter((r) => !r.read).length} unread` : undefined}>
          {f(reading).map((x) => (
            <Row key={x.id} icon={<Favicon url={x.url} size={30} />} title={x.title} subtitle={`${hostOf(x.url)} · ${x.read ? 'Read' : 'Unread'}`} onClick={() => { useSafari.getState().set({ readingList: reading.map((r) => (r.id === x.id ? { ...r, read: true } : r)) }); openUrl(x.url) }} trailing={<DeleteBtn onClick={() => useSafari.getState().set({ readingList: reading.filter((r) => r.id !== x.id) })} />} />
          ))}
          {reading.length === 0 && <Row title={<span className="secondary">No items</span>} />}
        </List>
      )}
      {tab === 'History' && (
        <>
          {Object.entries(byDay).map(([day, list]) => (
            <List key={day} header={day}>
              {list.slice(0, 30).map((h, i) => (
                <Row key={h.url + i} icon={<Favicon url={h.url} size={30} />} title={h.title} subtitle={h.url.startsWith('search.example') ? 'Search' : h.url} detail={fmtAgo(h.ts)} onClick={() => openUrl(h.url)} />
              ))}
            </List>
          ))}
          {history.length === 0 && <div className="empty-state"><Clock size={34} /><div className="t-headline">No History</div>Pages you visit appear here.</div>}
          {history.length > 0 && (
            <div style={{ padding: '0 16px 30px' }}>
              <Button variant="destructive" block onClick={() => showAlert({ title: 'Clear History?', message: 'This removes history, cookies and other browsing data.', actions: [{ label: 'Cancel', style: 'cancel' }, { label: 'Clear History', style: 'destructive', onPress: () => useOS.getState().set({ safariHistory: [] }) }] })}>Clear History</Button>
            </div>
          )}
        </>
      )}
      {tab === 'Watching' && (
        <>
          <List header="Notify Me" footer="Safari checks watched pages in the background and sends a notification when the price drops, an item is restocked, or content changes.">
            {watches.map((w) => (
              <Row
                key={w.id}
                icon={<Favicon url={w.url} size={30} />}
                title={w.label}
                subtitle={`${w.kind === 'price' ? 'Price drop' : w.kind === 'restock' ? 'Back in stock' : 'Page updates'} · ${w.triggered ? (w.kind === 'price' ? 'Dropped to $199' : w.kind === 'restock' ? 'Restocked' : 'Updated') : `Watching since ${fmtAgo(w.created)}`}`}
                onClick={() => openUrl(w.url)}
                trailing={<DeleteBtn label="Stop" onClick={() => useOS.getState().set({ safariWatches: useOS.getState().safariWatches.filter((x) => x.id !== w.id) })} />}
              />
            ))}
            {watches.length === 0 && <Row title={<span className="secondary">No watched pages</span>} subtitle="Open a product or article, then choose Notify Me from the page menu." />}
          </List>
        </>
      )}
    </Sheet>
  )
}

function DeleteBtn({ onClick, label = 'Delete' }: { onClick: () => void; label?: string }) {
  return (
    <button className="sf-del" onClick={(e) => { e.stopPropagation(); onClick() }} aria-label={label}>
      {label === 'Delete' ? <Minus size={14} strokeWidth={3} /> : label}
    </button>
  )
}

function NotifySheet({ open, onClose, onWatching }: { open: boolean; onClose: () => void; onWatching: () => void }) {
  const tab = useOS((s) => s.safariTabs.find((t) => t.id === s.safariActiveTab))
  const watches = useOS((s) => s.safariWatches)
  const url = tab?.url ?? ''
  const w = WATCHABLE[url]
  const existing = watches.find((x) => x.url === url)
  const [kind, setKind] = useState<'price' | 'restock' | 'content'>('price')
  useEffect(() => { if (w) setKind(existing?.kind ?? w.kinds[0]) }, [open, url]) // eslint-disable-line react-hooks/exhaustive-deps
  const save = () => {
    if (!w) return
    const st = useOS.getState()
    st.set({ safariWatches: [...st.safariWatches.filter((x) => x.url !== url), { id: `sw-${Date.now()}`, url, kind, label: w.label, created: Date.now() }] })
    st.showToast('Safari will notify you', 'bell')
    onClose()
  }
  const stop = () => {
    useOS.getState().set({ safariWatches: watches.filter((x) => x.url !== url) })
    onClose()
  }
  const OPTS: Record<string, { title: string; sub: string }> = {
    price: { title: 'Price Drops', sub: 'Currently $249.00' },
    restock: { title: 'Back in Stock', sub: 'Currently out of stock' },
    content: { title: 'Page Updates', sub: 'New or changed content' },
  }
  return (
    <Sheet open={open} onClose={onClose} title="Notify Me" detent="auto">
      {w ? (
        <div className="sf-notify">
          <div className="sf-notify-page">
            <Favicon url={url} size={44} />
            <div><b>{titleFor(url)}</b><small>{hostOf(url)}</small></div>
          </div>
          <List header="Notify me about">
            {(['price', 'restock', 'content'] as const).map((k) => (
              <Row key={k} title={OPTS[k].title} subtitle={OPTS[k].sub} disabled={!w.kinds.includes(k)} onClick={() => w.kinds.includes(k) && setKind(k)} trailing={kind === k ? <Check size={20} className="accent" /> : undefined} style={!w.kinds.includes(k) ? { opacity: 0.4 } : undefined} />
            ))}
          </List>
          <div className="sf-notify-actions">
            <Button block onClick={save}>{existing ? 'Update' : 'Notify Me'}</Button>
            {existing && <Button variant="destructive" block onClick={stop}>Stop Notifying</Button>}
            <Button variant="plain" onClick={() => { onClose(); onWatching() }}>Show All Watched Pages ({watches.length})</Button>
          </div>
        </div>
      ) : (
        <div className="empty-state" style={{ padding: 30 }}>
          <Bell size={32} />
          <div className="t-headline">Nothing to Watch Here</div>
          Notify Me works on product pages and articles.
          <Button variant="tinted" size="small" onClick={() => { onClose(); onWatching() }}>Watched Pages</Button>
        </div>
      )}
    </Sheet>
  )
}

function ExtensionsSheet({ open, describe, setDescribe, onClose }: { open: boolean; describe: boolean; setDescribe: (d: boolean) => void; onClose: () => void }) {
  const exts = useOS((s) => s.safariExtensions)
  const [prompt, setPrompt] = useState('')
  const [gen, setGen] = useState<GeneratedExtension | null>(null)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const [codeFor, setCodeFor] = useState<string | null>(null)
  const [codeTab, setCodeTab] = useState<'style.css' | 'manifest.json'>('style.css')
  useEffect(() => {
    if (open && describe) {
      setGen(null)
      setFailed(false)
    }
  }, [open, describe])
  const run = (p = prompt) => {
    if (!p.trim()) return
    setPrompt(p)
    setBusy(true)
    setGen(null)
    setFailed(false)
    window.setTimeout(() => {
      const g = generateExtension(p)
      setBusy(false)
      if (g) setGen(g)
      else setFailed(true)
    }, 1100)
  }
  const install = () => {
    if (!gen) return
    const st = useOS.getState()
    st.set({ safariExtensions: [...st.safariExtensions, { id: `ext-${Date.now()}`, name: gen.name, prompt, css: gen.css, enabled: true }] })
    st.showToast(`“${gen.name}” is on`, 'puzzle')
    setPrompt('')
    setGen(null)
    onClose()
  }
  const setExt = (id: string, patch: Partial<(typeof exts)[number]>) => useOS.getState().set({ safariExtensions: useOS.getState().safariExtensions.map((e) => (e.id === id ? { ...e, ...patch } : e)) })
  const viewing = exts.find((e) => e.id === codeFor)
  return (
    <Sheet open={open} onClose={onClose} title={describe ? 'Describe an Extension' : 'Extensions'} detent="large" trailing={<button className="bar-btn tinted" onClick={onClose} style={{ fontWeight: 600 }}>Done</button>} closeButton={false} leading={describe ? <button className="bar-btn icon glass interactive" onClick={() => setDescribe(false)} aria-label="Back"><ChevronLeft size={22} /></button> : undefined}>
      {describe ? (
        <div className="sf-describe">
          <div className="sf-describe-hero">
            <div className="sf-describe-icon"><Puzzle size={28} /></div>
            <p>Describe what you want Safari to change on web pages, and Apple Intelligence will build an extension for you.</p>
          </div>
          <form className="sf-describe-box ai-glow" onSubmit={(e) => { e.preventDefault(); run() }}>
            <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="e.g. Hide the sidebar and make article text larger" rows={3} aria-label="Describe your extension" data-send-on-enter="1" enterKeyHint="go" />
            <button type="submit" className="sf-describe-go" disabled={!prompt.trim() || busy} aria-label="Create extension">{busy ? <Spinner size={16} /> : <Sparkles size={18} />}</button>
          </form>
          {!gen && !busy && (
            <div className="sf-ideas">
              {EXTENSION_IDEAS.map((i) => <button key={i} className="chip" onClick={() => run(i)}>{i}</button>)}
            </div>
          )}
          {busy && <div className="sf-gen-wait"><AISparkle size={18} /> Writing your extension…<div className="skeleton" style={{ height: 12, width: '80%' }} /><div className="skeleton" style={{ height: 12, width: '60%' }} /></div>}
          {failed && <div className="sf-gen-fail">I couldn’t turn that into an extension yet. Try mentioning what to change — like sidebars, ads, text size, dates, images, comments, links or colors.</div>}
          {gen && (
            <div className="sf-gen anim-up">
              <div className="sf-gen-head">
                <div className="sf-gen-icon"><Puzzle size={20} /></div>
                <div>
                  <input className="sf-gen-name" value={gen.name} onChange={(e) => setGen({ ...gen, name: e.target.value })} aria-label="Extension name" />
                  <small>Runs on all websites · No data access</small>
                </div>
              </div>
              <ul className="sf-gen-features">{gen.features.map((f) => <li key={f}><Check size={14} /> {f}</li>)}</ul>
              <div className="sf-code-tabs">
                {(['style.css', 'manifest.json'] as const).map((t) => <button key={t} className={codeTab === t ? 'on' : ''} onClick={() => setCodeTab(t)}>{t}</button>)}
              </div>
              <pre className="sf-code-view">{codeTab === 'style.css' ? gen.css : gen.manifest}</pre>
              <div className="sf-gen-actions">
                <Button variant="gray" onClick={() => run()}>Regenerate</Button>
                <Button onClick={install}>Add Extension</Button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <>
          <div style={{ padding: '4px 16px 16px' }}>
            <Button block variant="tinted" onClick={() => setDescribe(true)}><AISparkle size={18} /> Describe an Extension</Button>
          </div>
          <List header="Your Extensions" footer="Extensions you create run only in Safari on this iPhone. Turn one off to stop it changing web pages.">
            {exts.map((e) => (
              <Row key={e.id} icon={<span className="sf-ext-ic"><Puzzle size={17} /></span>} title={e.name} subtitle={`“${e.prompt}”`} toggle={{ value: e.enabled, onChange: (v) => setExt(e.id, { enabled: v }) }} />
            ))}
            {exts.length === 0 && <Row title={<span className="secondary">No extensions yet</span>} />}
          </List>
          {exts.length > 0 && (
            <List header="Code">
              {exts.map((e) => (
                <Row key={e.id} title={`View ${e.name}`} chevron onClick={() => { setCodeFor(e.id); setCodeTab('style.css') }} />
              ))}
            </List>
          )}
          {viewing && (
            <div className="sf-codeview-wrap">
              <div className="sf-code-tabs"><b>{viewing.name}</b><span className="grow" /><button onClick={() => setCodeFor(null)}>Close</button></div>
              <pre className="sf-code-view">{viewing.css}</pre>
              <div style={{ padding: '0 16px 20px' }}>
                <Button variant="destructive" block onClick={() => { useOS.getState().set({ safariExtensions: exts.filter((x) => x.id !== viewing.id) }); setCodeFor(null) }}>Delete Extension</Button>
              </div>
            </div>
          )}
        </>
      )}
    </Sheet>
  )
}

function PrivacySheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [ms] = useState(() => 8 + Math.round(Math.random() * 6))
  const sites = [
    ['morningbrief.example', 14], ['weather.example', 9], ['tunedaily.example', 7], ['bolt.example', 6], ['robotics-forum.example', 4], ['chemreview.example', 2],
  ] as const
  const trackers = [['adnet.example', 11], ['pixel-metrics.example', 8], ['socialwidgets.example', 6]] as const
  return (
    <Sheet open={open} onClose={onClose} title="Privacy Report" detent="large">
      <div className="sf-priv">
        <div className="sf-priv-hero">
          <ShieldCheck size={40} />
          <div><b>42</b><span>Trackers prevented from profiling you in the last 7 days</span></div>
        </div>
        <div className="sf-priv-stats">
          <div><b>67%</b><span>of websites contacted trackers</span></div>
          <div><b>adnet.example</b><span>was the most contacted tracker</span></div>
        </div>
        <List header="Websites">
          {sites.map(([s, n]) => <Row key={s} icon={<Favicon url={s} size={28} />} title={s} detail={`${n} trackers`} />)}
        </List>
        <List header="Trackers">
          {trackers.map(([s, n]) => <Row key={s} title={s} detail={`${n} websites`} />)}
        </List>
        <List header="Performance" footer="Safari 27 measures page responsiveness on-device. Numbers are from this simulated iPhone.">
          <Row title="Start Page load" detail={`${ms} ms`} />
          <Row title="Tab switching" detail="Instant" />
          <Row title="Web app responsiveness" subtitle="Interaction to Next Paint for installed web apps" detail="38 ms · Good" />
          <Row title="Page loads vs. Safari 26" detail="Up to 20% faster" />
        </List>
      </div>
    </Sheet>
  )
}
