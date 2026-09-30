import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Ellipsis, ZoomIn, ZoomOut, Filter, Heart, Wand2, Video, Smartphone, Play, Settings, Check, Images } from 'lucide-react'
import { useOS } from '../../os/store'
import { openMenu } from '../../ui/overlay'
import { Glass } from '../../ui/controls'
import { PhotoGrid, effCols } from './Grid'
import { PhotoView } from './PhotoView'
import { SelectBar } from './Sheets'
import { usePh, useUI, useLibrary, openViewer } from './pstore'
import { isEdited, monthKey, monthLabel, fmtShortDate } from './look'
import type { Photo } from '../../os/types'
import { MONTHS } from '../../os/time'

const COLS = [1, 3, 5, 7]

export function SyncStatus({ photos }: { photos: Photo[] }) {
  const syncing = useUI((s) => s.syncing)
  const priority = useOS((s) => s.prioritySync)
  const lowPower = useOS((s) => s.lowPower)
  const vids = photos.filter((p) => p.kind === 'video').length
  const status = syncing
    ? lowPower && !priority
      ? `Upload paused in Low Power Mode · ${syncing} item${syncing > 1 ? 's' : ''}`
      : `Uploading ${syncing} item${syncing > 1 ? 's' : ''}${priority ? ' · Prioritized' : '…'}`
    : 'Synced with iCloud Just Now'
  return (
    <div className="ph-sync">
      <div className="t-footnote bold">{photos.length - vids} Photos, {vids} Videos</div>
      <button className="t-caption1 secondary ph-sync-line" onClick={() => useUI.getState().set({ settings: true })}>
        <span className={`ph-sync-dot ${syncing ? (lowPower && !priority ? 'paused' : 'busy') : ''}`} />
        {status}
      </button>
    </div>
  )
}

export function LibraryTab({ active }: { active: boolean }) {
  const lib = useLibrary()
  const zoom = usePh((s) => s.zoom)
  const cols = usePh((s) => s.cols)
  const libFilter = usePh((s) => s.libFilter)
  const land = useOS((s) => s.orientation === 'landscape')
  const nCols = effCols(cols, land)
  const [selecting, setSelecting] = useState(false)
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [topLabel, setTopLabel] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const pendingJump = useRef<string | null>(null)

  const items = useMemo(() => {
    switch (libFilter) {
      case 'favorites': return lib.filter((p) => p.favorite)
      case 'edited': return lib.filter(isEdited)
      case 'videos': return lib.filter((p) => p.kind === 'video')
      case 'screenshots': return lib.filter((p) => p.kind === 'screenshot')
      default: return lib
    }
  }, [lib, libFilter])
  const ids = useMemo(() => items.map((p) => p.id), [items])

  // Start at the newest items (bottom), like Photos.
  const didInit = useRef(false)
  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el) return
    if (zoom === 'all' && pendingJump.current) {
      const cell = el.querySelector(`[data-pid="${pendingJump.current}"]`) as HTMLElement | null
      pendingJump.current = null
      if (cell) {
        el.scrollTop = cell.offsetTop - 120
        return
      }
    }
    if (!didInit.current || zoom !== 'all') el.scrollTop = el.scrollHeight
    didInit.current = true
  }, [zoom, cols, libFilter])

  // Keep newest visible when a new capture arrives while at bottom.
  const lastLen = useRef(items.length)
  useEffect(() => {
    const el = scrollRef.current
    if (el && items.length > lastLen.current && el.scrollHeight - el.scrollTop - el.clientHeight < 400) el.scrollTop = el.scrollHeight
    lastLen.current = items.length
  }, [items.length])

  const updateLabel = () => {
    const el = scrollRef.current
    if (!el || zoom !== 'all') return setTopLabel('')
    const grid = el.querySelector('.ph-grid') as HTMLElement | null
    if (!grid || !items.length) return
    const cell = grid.firstElementChild as HTMLElement | null
    const rowH = (cell?.offsetHeight ?? 130) + 2
    const row = Math.max(0, Math.floor((el.scrollTop + 110 - grid.offsetTop) / rowH))
    const p = items[Math.min(items.length - 1, row * nCols)]
    const last = items[Math.min(items.length - 1, row * nCols + nCols * 5)]
    if (!p) return
    const a = fmtShortDate(p.ts)
    const b = fmtShortDate(last.ts)
    setTopLabel(a === b ? `${a}${p.place ? ` · ${p.place}` : ''}` : `${a} – ${b}`)
  }
  useEffect(updateLabel, [items, nCols, zoom]) // eslint-disable-line react-hooks/exhaustive-deps

  const setZoom = (z: 'years' | 'months' | 'all') => usePh.getState().set({ zoom: z })
  const jumpTo = (id: string) => {
    pendingJump.current = id
    setZoom('all')
  }
  const stepCols = (dir: 1 | -1) => {
    const i = COLS.indexOf(cols)
    const next = COLS[Math.max(0, Math.min(COLS.length - 1, (i < 0 ? 1 : i) + dir))]
    usePh.getState().set({ cols: next })
  }

  const filterLabel = { all: '', favorites: 'Favorites', edited: 'Edited', videos: 'Videos', screenshots: 'Screenshots' }[libFilter]

  return (
    <div className="ph-lib" aria-hidden={!active}>
      <div
        ref={scrollRef}
        className="ph-lib-scroll scroll"
        onScroll={updateLabel}
        onWheel={(e) => {
          if (!e.ctrlKey) return
          e.preventDefault()
          stepCols(e.deltaY > 0 ? 1 : -1)
        }}
      >
        <div className="ph-lib-top-space" />
        {zoom === 'all' && (
          <>
            {items.length === 0 ? (
              <div className="empty-state" style={{ paddingTop: 120 }}>
                <Images size={44} strokeWidth={1.5} />
                <div className="t-headline">No {filterLabel || 'Photos'}</div>
              </div>
            ) : (
              <PhotoGrid
                photos={items}
                cols={cols}
                gap={cols >= 5 ? 1 : 2}
                selecting={selecting}
                selected={sel}
                onToggle={(id) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })}
                onOpen={(id, el) => openViewer(ids, id, el)}
              />
            )}
            <SyncStatus photos={lib} />
          </>
        )}
        {zoom !== 'all' && <Overview items={items} kind={zoom} onPick={jumpTo} />}
        <div style={{ height: 150 }} />
      </div>

      <div className="ph-lib-header">
        <div className="ph-lib-edge" />
        <div className="ph-lib-titles">
          <h1 className="ph-lib-title">{zoom === 'years' ? 'Years' : zoom === 'months' ? 'Months' : 'Library'}{filterLabel && <span className="ph-lib-filter">{filterLabel}</span>}</h1>
          <div className="t-subhead ph-lib-sub">{zoom === 'all' ? topLabel : `${items.length} items`}</div>
        </div>
        <div className="ph-lib-actions">
          {zoom === 'all' && (
            <button className="ph-pill-btn glass interactive" onClick={() => { setSelecting(!selecting); setSel(new Set()) }}>
              {selecting ? 'Cancel' : 'Select'}
            </button>
          )}
          <button
            className="bar-btn icon glass interactive"
            aria-label="More"
            onClick={(e) => {
              const f = (k: typeof libFilter, label: string, icon: React.ReactNode) => ({ label, icon: libFilter === k ? <Check size={17} /> : icon, onSelect: () => usePh.getState().set({ libFilter: k }) })
              openMenu(e.currentTarget, [
                { label: 'Zoom In', icon: <ZoomIn size={17} />, disabled: cols === 1, onSelect: () => stepCols(-1) },
                { label: 'Zoom Out', icon: <ZoomOut size={17} />, disabled: cols === 7, onSelect: () => stepCols(1) },
                { label: 'Slideshow', icon: <Play size={17} />, onSelect: () => useUI.getState().set({ slideshow: { ids: ids.slice(-12), title: 'Library' } }) },
                f('all', 'All Items', <Filter size={17} />),
                { ...f('favorites', 'Favorites', <Heart size={17} />), separatorBefore: false },
                f('edited', 'Edited', <Wand2 size={17} />),
                f('videos', 'Videos', <Video size={17} />),
                f('screenshots', 'Screenshots', <Smartphone size={17} />),
                { label: 'Photos Settings', icon: <Settings size={17} />, separatorBefore: true, onSelect: () => useUI.getState().set({ settings: true }) },
              ], { title: `Grid: ${cols} columns` })
            }}
          >
            <Ellipsis size={22} />
          </button>
        </div>
      </div>

      {!selecting && (
        <div className="ph-zoom-wrap">
          <Glass className="ph-zoom" role="tablist" aria-label="Library zoom level">
            {(['years', 'months', 'all'] as const).map((z) => (
              <button key={z} role="tab" aria-selected={zoom === z} className={zoom === z ? 'on' : ''} onClick={() => setZoom(z)}>
                {z === 'all' ? 'All' : z === 'years' ? 'Years' : 'Months'}
              </button>
            ))}
          </Glass>
        </div>
      )}
      {selecting && <SelectBar ids={[...sel]} onDone={() => { setSelecting(false); setSel(new Set()) }} />}
    </div>
  )
}

function Overview({ items, kind, onPick }: { items: Photo[]; kind: 'years' | 'months'; onPick: (id: string) => void }) {
  const groups = useMemo(() => {
    const m = new Map<string, Photo[]>()
    for (const p of items) {
      const k = kind === 'years' ? String(new Date(p.ts).getFullYear()) : monthKey(p.ts)
      if (!m.has(k)) m.set(k, [])
      m.get(k)!.push(p)
    }
    return [...m.entries()].map(([k, ps]) => {
      const key = [...ps].sort((a, b) => (b.rating ?? 0) + (b.favorite ? 2 : 0) - ((a.rating ?? 0) + (a.favorite ? 2 : 0)))[0]
      const places = [...new Set(ps.map((p) => p.place).filter(Boolean))].slice(0, 2) as string[]
      return { k, ps, key, places }
    })
  }, [items, kind])
  return (
    <div className={`ph-overview ${kind}`}>
      {groups.map((g) => {
        const d = new Date(g.ps[0].ts)
        return (
          <button key={g.k} className="ph-ov-card" onClick={() => onPick(g.ps[0].id)} aria-label={kind === 'years' ? g.k : monthLabel(g.ps[0].ts)}>
            <PhotoView photo={g.key} />
            <div className="ph-ov-shade" />
            <div className="ph-ov-text">
              <div className={kind === 'years' ? 'ph-ov-year' : 'ph-ov-month'}>{kind === 'years' ? g.k : MONTHS[d.getMonth()]}</div>
              <div className="t-footnote">{kind === 'months' ? `${d.getFullYear()} · ` : ''}{g.places.join(', ') || `${g.ps.length} items`}</div>
            </div>
            <span className="ph-ov-count">{g.ps.length}</span>
          </button>
        )
      })}
    </div>
  )
}
