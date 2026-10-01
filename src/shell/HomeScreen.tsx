import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { Search, Plus, X, Check } from 'lucide-react'
import { useOS, type HomeItem, type WidgetSize } from '../os/store'
import type { AppId } from '../os/types'
import { AppIcon, tryLaunch } from './AppIcon'
import { Widget, WIDGET_GALLERY } from './widgets/Widgets'
import { AppIconArt, ICONS } from '../icons/AppIconArt'
import { springs, animateSpring } from '../os/spring'
import { screenScale } from '../os/hooks'
import { useShell } from './shellState'
import { Sheet } from '../ui/overlay'
import { Segmented, Glass, SearchField, Slider } from '../ui/controls'
import { search } from '../os/search'

const SPAN: Record<WidgetSize, [number, number]> = { s: [2, 2], m: [4, 2], l: [4, 4], xl: [4, 6] }

export function HomeScreen() {
  const pages = useOS((s) => s.homePages)
  const dock = useOS((s) => s.dock)
  const editing = useOS((s) => s.editingHome)
  const openApp = useOS((s) => s.openApp)
  const overlay = useOS((s) => s.overlay)
  const landscape = useOS((s) => s.orientation === 'landscape')
  const largeIcons = useOS((s) => s.largeIcons)
  const page = useShell((s) => s.homePage)
  const setShell = useShell((s) => s.set)
  const [folder, setFolder] = useState<Extract<HomeItem, { type: 'folder' }> | null>(null)
  const [gallery, setGallery] = useState(false)
  const [customize, setCustomize] = useState(false)
  const [dragX, setDragX] = useState<number | null>(null)
  const [scrubbing, setScrubbing] = useState(false)
  const trackRef = useRef<HTMLDivElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const count = pages.length
  const width = landscape ? 874 : 402
  const idx = page + 1 // account for Today View at -1

  const goto = useCallback(
    (p: number) => {
      const clamped = Math.max(-1, Math.min(count, p))
      setShell({ homePage: clamped })
    },
    [count, setShell],
  )

  useEffect(() => {
    const f = () => goto(0)
    window.addEventListener('home-first-page', f)
    return () => window.removeEventListener('home-first-page', f)
  }, [goto])

  // animate page changes with a spring
  const lastIdx = useRef(idx)
  useEffect(() => {
    const el = trackRef.current
    if (!el || dragX !== null) return
    if (lastIdx.current !== idx) {
      animateSpring(el, [{ transform: el.style.transform || `translateX(${-lastIdx.current * width}px)` }, { transform: `translateX(${-idx * width}px)` }], springs.snappy(), { fill: 'none' })
    }
    el.style.transform = `translateX(${-idx * width}px)`
    lastIdx.current = idx
  }, [idx, width, dragX])

  // arrow keys page the Home Screen
  useEffect(() => {
    if (openApp || overlay) return
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT') return
      if (e.key === 'ArrowRight') goto(page + 1)
      if (e.key === 'ArrowLeft') goto(page - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [page, goto, openApp, overlay])

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return
    const target = e.target as HTMLElement
    if (target.closest('.dock, .home-search-pill, .edit-bar, input, .widget-scroll, .applib-scroll-lock')) return
    if (editing && target.closest('.app-icon')) return startIconDrag(e)
    const scale = screenScale()
    const x0 = e.clientX
    const y0 = e.clientY
    let mode: 'h' | 'v' | null = null
    const move = (ev: PointerEvent) => {
      const dx = (ev.clientX - x0) / scale
      const dy = (ev.clientY - y0) / scale
      if (!mode && Math.hypot(dx, dy) > 8) mode = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v'
      if (mode === 'h') {
        let d = dx
        if ((idx === 0 && dx > 0) || (idx === count + 1 && dx < 0)) d = dx * 0.3
        setDragX(d)
        if (trackRef.current) trackRef.current.style.transform = `translateX(${-idx * width + d}px)`
      }
    }
    const up = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      const dx = (ev.clientX - x0) / scale
      const dy = (ev.clientY - y0) / scale
      if (mode === 'h') {
        const next = Math.abs(dx) > width * 0.18 ? page - Math.sign(dx) : page
        lastIdx.current = idx - dx / width
        setDragX(null)
        goto(next)
      } else if (mode === 'v' && dy > 50 && page >= 0 && page < count && !editing) {
        useOS.getState().setOverlay('spotlight')
      }
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  // ------------- edit-mode drag to rearrange -------------
  const startIconDrag = (e: React.PointerEvent) => {
    const itemEl = (e.target as HTMLElement).closest('[data-home-pos]') as HTMLElement | null
    if (!itemEl) return
    const from = itemEl.dataset.homePos!
    const scale = screenScale()
    const rect = itemEl.getBoundingClientRect()
    const ghost = itemEl.cloneNode(true) as HTMLElement
    const screen = rootRef.current!.closest('.screen') as HTMLElement
    const sr = screen.getBoundingClientRect()
    ghost.classList.add('drag-ghost')
    Object.assign(ghost.style, { left: `${(rect.left - sr.left) / scale}px`, top: `${(rect.top - sr.top) / scale}px`, width: `${rect.width / scale}px` })
    screen.appendChild(ghost)
    itemEl.style.opacity = '0.2'
    const x0 = e.clientX
    const y0 = e.clientY
    let flipTimer: number | undefined
    const move = (ev: PointerEvent) => {
      ghost.style.transform = `translate(${(ev.clientX - x0) / scale}px, ${(ev.clientY - y0) / scale}px) scale(1.12)`
      const lx = (ev.clientX - sr.left) / scale
      window.clearTimeout(flipTimer)
      if (lx < 20) flipTimer = window.setTimeout(() => goto(useShell.getState().homePage - 1), 500)
      if (lx > width - 20) flipTimer = window.setTimeout(() => goto(useShell.getState().homePage + 1), 500)
    }
    const up = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.clearTimeout(flipTimer)
      ghost.remove()
      itemEl.style.opacity = ''
      const under = document.elementsFromPoint(ev.clientX, ev.clientY).find((el) => (el as HTMLElement).dataset?.homePos && el !== itemEl) as HTMLElement | undefined
      const dockEl = document.elementsFromPoint(ev.clientX, ev.clientY).find((el) => el.classList?.contains('dock'))
      moveItem(from, under?.dataset.homePos ?? (dockEl ? 'dock:end' : `page:${useShell.getState().homePage}:end`))
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  return (
    <div className={`home ${openApp ? 'behind-app' : ''} ${editing ? 'editing' : ''} ${landscape ? 'landscape' : ''} ${largeIcons ? 'large-icons' : ''}`} ref={rootRef} aria-hidden={!!openApp}>
      {editing && (
        <div className="edit-bar">
          <button className="bar-btn glass interactive" onClick={() => setGallery(true)} aria-label="Add widget"><Plus size={20} strokeWidth={2.6} /></button>
          <button className="bar-btn glass interactive" onClick={() => setCustomize(true)}>Edit</button>
          <div className="spacer" style={{ flex: 1 }} />
          <button className="bar-btn glass interactive" style={{ fontWeight: 600 }} onClick={() => useOS.getState().set({ editingHome: false })}>Done</button>
        </div>
      )}
      <div className="home-pages" onPointerDown={onPointerDown} onWheel={(e) => { if (Math.abs(e.deltaX) > 30 && Math.abs(e.deltaX) > Math.abs(e.deltaY)) goto(page + Math.sign(e.deltaX)) }}>
        <div className="home-track" ref={trackRef} style={{ width: (count + 2) * width }}>
          <div className="home-page today-page" style={{ width }}><TodayView /></div>
          {pages.map((items, p) => (
            <div className="home-page" key={p} style={{ width }}>
              <div className="home-grid" data-page={p}>
                {items.map((it, i) => (
                  <GridItem key={it.type === 'app' ? it.id : it.id} item={it} pos={`page:${p}:${i}`} onFolder={setFolder} />
                ))}
              </div>
            </div>
          ))}
          <div className="home-page" style={{ width }}><AppLibrary active={page === count} /></div>
        </div>
      </div>
      {page >= 0 && page < count && (
        <div className="home-search-pill-wrap">
          <button
            className={`home-search-pill glass ${scrubbing || dragX !== null ? 'dots' : ''}`}
            onClick={() => !scrubbing && useOS.getState().setOverlay('spotlight')}
            onPointerDown={(e) => {
              const x0 = e.clientX
              const p0 = page
              const scale = screenScale()
              const move = (ev: PointerEvent) => {
                const dx = (ev.clientX - x0) / scale
                if (Math.abs(dx) > 10) setScrubbing(true)
                const np = Math.max(0, Math.min(count - 1, p0 + Math.round(dx / 30)))
                if (np !== useShell.getState().homePage) goto(np)
              }
              const up = () => {
                window.removeEventListener('pointermove', move)
                window.removeEventListener('pointerup', up)
                window.setTimeout(() => setScrubbing(false), 50)
              }
              window.addEventListener('pointermove', move)
              window.addEventListener('pointerup', up)
            }}
            aria-label="Search"
          >
            {scrubbing || dragX !== null ? (
              <span className="dots-row">{pages.map((_, i) => <span key={i} className={i === page ? 'on' : ''} />)}</span>
            ) : (
              <><Search size={14} strokeWidth={2.8} /> Search</>
            )}
          </button>
        </div>
      )}
      <div className={`dock glass ${page === count || page === -1 ? 'dock-hidden' : ''}`} data-home-pos="dock:end">
        {dock.map((app, i) => (
          <div key={app} data-home-pos={`dock:${i}`}>
            <AppIcon app={app} label={false} dock onRemove={() => useOS.getState().set({ dock: dock.filter((d) => d !== app) })} />
          </div>
        ))}
      </div>
      {folder && <FolderView folder={folder} onClose={() => setFolder(null)} />}
      <Sheet open={gallery} onClose={() => setGallery(false)} title="Add Widget" detent="large">
        <WidgetGallery onAdd={(kind, size) => {
          const st = useOS.getState()
          const p = Math.max(0, Math.min(page, st.homePages.length - 1))
          const next = st.homePages.map((items, i) => (i === p ? [{ type: 'widget' as const, id: `w-${Date.now()}`, kind, size }, ...items] : items))
          st.set({ homePages: next })
          setGallery(false)
        }} />
      </Sheet>
      <Sheet open={customize} onClose={() => setCustomize(false)} title="Customize" detent="medium">
        <Customize />
      </Sheet>
    </div>
  )
}

function moveItem(from: string, to: string) {
  const st = useOS.getState()
  const pages = st.homePages.map((p) => [...p])
  const dock = [...st.dock]
  let item: HomeItem | undefined
  const [fk, fa, fb] = from.split(':')
  if (fk === 'dock') {
    item = { type: 'app', id: dock[+fa] }
    dock.splice(+fa, 1)
  } else {
    item = pages[+fa][+fb]
    pages[+fa].splice(+fb, 1)
  }
  if (!item) return
  const [tk, ta, tb] = to.split(':')
  if (tk === 'dock') {
    if (item.type !== 'app' || dock.length >= 4) {
      // put it back where it was
      if (fk === 'dock') dock.splice(+fa, 0, (item as { id: AppId }).id)
      else pages[+fa].splice(+fb, 0, item)
    } else {
      const at = ta === 'end' ? dock.length : +ta
      dock.splice(at, 0, item.id)
    }
  } else {
    const pg = Math.max(0, Math.min(pages.length - 1, +ta))
    const at = tb === 'end' ? pages[pg].length : +tb
    // dropping an app onto another app creates a folder
    const target = pages[pg][at]
    if (tb !== 'end' && target && target.type === 'app' && item.type === 'app' && fk !== 'dock' && +fa === pg && Math.abs(+fb - at) > 1) {
      pages[pg][at] = { type: 'folder', id: `f-${Date.now()}`, name: 'Folder', apps: [target.id, item.id] }
    } else if (tb !== 'end' && target && target.type === 'folder' && item.type === 'app') {
      pages[pg][at] = { ...target, apps: [...target.apps, item.id] }
    } else {
      pages[pg].splice(at, 0, item)
    }
  }
  st.set({ homePages: pages, dock })
}

function GridItem({ item, pos, onFolder }: { item: HomeItem; pos: string; onFolder: (f: Extract<HomeItem, { type: 'folder' }>) => void }) {
  const editing = useOS((s) => s.editingHome)
  const remove = () => {
    const st = useOS.getState()
    const [, p, i] = pos.split(':')
    st.set({ homePages: st.homePages.map((items, pi) => (pi === +p ? items.filter((_, ii) => ii !== +i) : items)) })
  }
  if (item.type === 'widget') {
    const [c, r] = SPAN[item.size]
    return (
      <div className={`grid-widget ${editing ? 'jiggle' : ''}`} style={{ gridColumn: `span ${c}`, gridRow: `span ${r}` }} data-home-pos={pos}>
        <Widget kind={item.kind} size={item.size} onClick={editing ? () => {} : undefined} />
        {editing && <button className="icon-remove" aria-label="Remove widget" onClick={remove}><X size={12} strokeWidth={4} /></button>}
      </div>
    )
  }
  if (item.type === 'folder') {
    return (
      <div data-home-pos={pos}>
        <FolderIcon folder={item} onOpen={() => onFolder(item)} />
      </div>
    )
  }
  return (
    <div data-home-pos={pos}>
      <AppIcon app={item.id} onRemove={remove} />
    </div>
  )
}

function FolderIcon({ folder, onOpen }: { folder: Extract<HomeItem, { type: 'folder' }>; onOpen: () => void }) {
  const style = useOS((s) => s.iconStyle)
  const editing = useOS((s) => s.editingHome)
  return (
    <div className={`app-icon ${editing ? 'jiggle' : ''}`}>
      <button className="app-icon-btn" onClick={onOpen} aria-label={`${folder.name} folder`}>
        <span className="folder-icon glass clear">
          {folder.apps.slice(0, 9).map((a) => (
            <AppIconArt key={a} app={a} size={13} style={style} />
          ))}
        </span>
        <span className="app-label">{folder.name}</span>
      </button>
    </div>
  )
}

function FolderView({ folder, onClose }: { folder: Extract<HomeItem, { type: 'folder' }>; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const [name, setName] = useState(folder.name)
  useEffect(() => {
    if (ref.current) animateSpring(ref.current, [{ transform: 'scale(.3)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }], springs.appOpen(), { fill: 'none' })
  }, [])
  const rename = (v: string) => {
    setName(v)
    const st = useOS.getState()
    st.set({ homePages: st.homePages.map((p) => p.map((it) => (it.type === 'folder' && it.id === folder.id ? { ...it, name: v } : it))) })
  }
  return (
    <div className="folder-overlay" onClick={onClose}>
      <input className="folder-title" value={name} onChange={(e) => rename(e.target.value)} onClick={(e) => e.stopPropagation()} aria-label="Folder name" />
      <div className="folder-panel glass" ref={ref} onClick={(e) => e.stopPropagation()}>
        {folder.apps.map((a) => (
          <AppIcon key={a} app={a} />
        ))}
      </div>
    </div>
  )
}

function TodayView() {
  return (
    <div className="today-view scroll widget-scroll">
      <div className="today-date">
        <div className="t-title2" style={{ color: '#fff' }}>{new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</div>
      </div>
      <div className="today-widgets">
        <Widget kind="siri" size="l" />
        <Widget kind="weather" size="m" />
        <div className="row gap16">
          <Widget kind="batteries" size="s" />
          <Widget kind="screentime" size="s" />
        </div>
        <Widget kind="home" size="m" />
        <Widget kind="calendar" size="m" />
      </div>
    </div>
  )
}

const LIB_CATS: { name: string; apps: AppId[] }[] = [
  { name: 'Suggestions', apps: ['messages', 'photos', 'siri', 'music'] },
  { name: 'Recently Added', apps: ['playground', 'journal', 'passwords', 'games'] },
  { name: 'Social', apps: ['messages', 'facetime', 'phone', 'contacts'] },
  { name: 'Productivity & Finance', apps: ['notes', 'reminders', 'calendar', 'files', 'wallet', 'stocks', 'freeform', 'shortcuts', 'preview'] },
  { name: 'Creativity', apps: ['photos', 'camera', 'playground', 'freeform'] },
  { name: 'Utilities', apps: ['settings', 'clock', 'calculator', 'findmy', 'magnifier', 'passwords'] },
  { name: 'Entertainment', apps: ['music', 'podcasts', 'news', 'games'] },
  { name: 'Health & Fitness', apps: ['health', 'fitness', 'journal'] },
  { name: 'Travel', apps: ['maps', 'weather', 'wallet', 'home'] },
]

function AppLibrary({ active }: { active: boolean }) {
  const [q, setQ] = useState('')
  const recents = useOS((s) => s.recents)
  const cats = useMemo(() => LIB_CATS.map((c) => (c.name === 'Suggestions' ? { ...c, apps: recents.slice(0, 4) } : c)), [recents])
  const results = q ? search(q, { types: ['app'], limit: 20 }) : []
  return (
    <div className="app-library scroll" aria-hidden={!active}>
      <div className="applib-search">
        <SearchField value={q} onChange={setQ} placeholder="App Library" mic={false} className="glass" />
      </div>
      {q ? (
        <div className="applib-list">
          {results.map((r) => (
            <button key={r.id} className="applib-row" onClick={(e) => tryLaunch(r.app, e.currentTarget.querySelector('.app-icon-art') as HTMLElement)}>
              <AppIconArt app={r.app} size={40} />
              <span>{ICONS[r.app].name}</span>
            </button>
          ))}
          {!results.length && <div className="empty-state" style={{ color: '#fff' }}>No Results</div>}
        </div>
      ) : (
        <div className="applib-grid">
          {cats.map((c) => (
            <div key={c.name} className="applib-cat">
              <div className="applib-box glass clear">
                {c.apps.slice(0, 3).map((a) => (
                  <button key={a} onClick={(e) => tryLaunch(a, e.currentTarget.querySelector('.app-icon-art') as HTMLElement)} aria-label={ICONS[a].name}>
                    <AppIconArt app={a} size={62} />
                  </button>
                ))}
                {c.apps.length > 3 && (
                  c.apps.length === 4 ? (
                    <button onClick={(e) => tryLaunch(c.apps[3], e.currentTarget.querySelector('.app-icon-art') as HTMLElement)} aria-label={ICONS[c.apps[3]].name}><AppIconArt app={c.apps[3]} size={62} /></button>
                  ) : (
                    <div className="applib-mini">
                      {c.apps.slice(3, 7).map((a) => (
                        <button key={a} onClick={(e) => tryLaunch(a, e.currentTarget.querySelector('.app-icon-art') as HTMLElement)} aria-label={ICONS[a].name}><AppIconArt app={a} size={28} /></button>
                      ))}
                    </div>
                  )
                )}
              </div>
              <div className="applib-name">{c.name}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function WidgetGallery({ onAdd }: { onAdd: (kind: string, size: WidgetSize) => void }) {
  const [sel, setSel] = useState<Record<string, WidgetSize>>({})
  return (
    <div style={{ padding: '0 16px 40px' }}>
      <p className="t-subhead secondary" style={{ margin: '0 0 12px' }}>iOS 27 adds an Extra Large size for richer widgets on iPhone.</p>
      {WIDGET_GALLERY.map((w) => {
        const size = sel[w.kind] ?? w.sizes[w.sizes.length > 1 ? 1 : 0]
        return (
          <div key={w.kind} className="wg-item">
            <div className="t-headline">{w.name}</div>
            <div className="t-footnote secondary" style={{ marginBottom: 10 }}>{w.desc}</div>
            <div className="wg-preview" style={{ height: size === 's' ? 170 : size === 'm' ? 170 : size === 'l' ? 360 : 460 }}>
              <div className={`home-grid wg-grid`} style={{ pointerEvents: 'none' }}>
                <div style={{ gridColumn: `span ${SPAN[size][0]}`, gridRow: `span ${SPAN[size][1]}` }}><Widget kind={w.kind} size={size} /></div>
              </div>
            </div>
            <div className="row gap8" style={{ marginTop: 10 }}>
              <Segmented options={w.sizes} value={size} onChange={(v) => setSel({ ...sel, [w.kind]: v })} labels={{ s: 'Small', m: 'Medium', l: 'Large', xl: 'Extra Large' }} style={{ flex: 1 }} />
              <button className="btn small filled" onClick={() => onAdd(w.kind, size)}><Plus size={16} /> Add</button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function Customize() {
  const style = useOS((s) => s.iconStyle)
  const tint = useOS((s) => s.iconTint)
  const large = useOS((s) => s.largeIcons)
  const theme = useOS((s) => s.theme)
  const glassTint = useOS((s) => s.glassTint)
  const set = useOS((s) => s.set)
  return (
    <div style={{ padding: '4px 20px 30px' }} className="col gap16">
      <div className="row gap12" style={{ justifyContent: 'center' }}>
        {(['messages', 'photos', 'weather', 'music'] as AppId[]).map((a) => <AppIconArt key={a} app={a} size={54} style={style} tint={tint} />)}
      </div>
      <Segmented options={['default', 'dark', 'clear', 'tinted'] as const} value={style} onChange={(v) => set({ iconStyle: v })} labels={{ default: 'Default', dark: 'Dark', clear: 'Clear', tinted: 'Tinted' }} />
      {style === 'tinted' && (
        <div className="row gap8" style={{ justifyContent: 'center' }}>
          {['#6aa9ff', '#ff9f0a', '#30d158', '#ff375f', '#bf5af2', '#ffd60a'].map((c) => (
            <button key={c} aria-label={`Tint ${c}`} onClick={() => set({ iconTint: c })} style={{ width: 30, height: 30, borderRadius: 15, background: c, outline: tint === c ? '3px solid var(--label-primary)' : 'none', outlineOffset: 2 }} />
          ))}
        </div>
      )}
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <Segmented options={['small', 'large'] as const} value={large ? 'large' : 'small'} onChange={(v) => set({ largeIcons: v === 'large' })} labels={{ small: 'Small', large: 'Large (no labels)' }} style={{ flex: 1 }} />
      </div>
      <Segmented options={['light', 'dark'] as const} value={theme} onChange={(v) => set({ theme: v })} labels={{ light: 'Light', dark: 'Dark' }} />
      <Glass className="row gap8" variant="clear" style={{ padding: 12, borderRadius: 18 }}>
        <Check size={16} /> <span className="t-footnote">Liquid Glass strength also affects Clear icons.</span>
      </Glass>
      <Slider value={glassTint} onChange={(v) => set({ glassTint: v })} left={<span className="t-caption1">Clear</span>} right={<span className="t-caption1">Tinted</span>} label="Liquid Glass tint" />
    </div>
  )
}
