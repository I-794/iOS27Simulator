import { useEffect, useMemo, useState } from 'react'
import { Settings, ChevronRight, Heart, Video, Smartphone, Aperture, Image as ImageIcon, Wand2, UserSquare, Copy as CopyIcon, EyeOff, Trash2, Lock, Pin, Plus, Ellipsis, Play, Camera, IdCard, Users, Activity, Sparkles, Check, Layers, PanelsTopLeft } from 'lucide-react'
import { Page, useNav, BarButton } from '../../ui/nav'
import { List, Row } from '../../ui/list'
import { Avatar, Button, AISparkle, Spinner } from '../../ui/controls'
import { Sheet, openMenu, showAlert } from '../../ui/overlay'
import { useOS } from '../../os/store'
import { contactName } from '../../os/data/people'
import { PEOPLE_AND_PETS } from '../../os/data/photos'
import { fmtAgo, DAY, startOfDay } from '../../os/time'
import { PhotoView } from './PhotoView'
import { PhotoGrid } from './Grid'
import { FaceIDGate, FaceChip, SelectBar, PhotoPickerSheet } from './Sheets'
import { SharedAlbumPage, ActivityFeed } from './Shared'
import { usePh, useUI, useLibrary, usePhotoMap, openViewer, navRefs } from './pstore'
import { useCollection, builtinMemories, duplicateGroups, dayLabelFor, personName, PINNABLE, MEDIA_TYPES, photoSearch } from './collections-data'
import type { Photo } from '../../os/types'

const ICONS: Record<string, React.ReactNode> = {
  favorites: <Heart size={20} />, captured: <Camera size={20} />, recents: <ImageIcon size={20} />, videos: <Video size={20} />, selfies: <UserSquare size={20} />,
  portrait: <Aperture size={20} />, panoramas: <PanelsTopLeft size={20} />, screenshots: <Smartphone size={20} />, edited: <Wand2 size={20} />, ids: <IdCard size={20} />,
  hidden: <EyeOff size={20} />, deleted: <Trash2 size={20} />, duplicates: <CopyIcon size={20} />,
}

function Cover({ photo, className = '' }: { photo?: Photo; className?: string }) {
  return <div className={`ph-cover ${className}`}>{photo ? <PhotoView photo={photo} /> : <div className="ph-cover-empty"><ImageIcon size={28} /></div>}</div>
}

function SectionHead({ title, onMore, action }: { title: string; onMore?: () => void; action?: React.ReactNode }) {
  return (
    <div className="ph-sec-head">
      <button className="ph-sec-title" onClick={onMore} disabled={!onMore}>
        {title}{onMore && <ChevronRight size={20} strokeWidth={2.8} />}
      </button>
      {action}
    </div>
  )
}

export function CollectionsRoot() {
  const nav = useNav()
  useEffect(() => {
    navRefs.collections = nav
  }, [nav])
  const lib = useLibrary()
  const pinned = usePh((s) => s.pinned)
  const albums = usePh((s) => s.albums)
  const userMems = usePh((s) => s.memories)
  const shared = useOS((s) => s.sharedAlbums)
  const all = useOS((s) => s.photos)
  const deleted = usePh((s) => s.deleted)
  const map = usePhotoMap()
  const [pinSheet, setPinSheet] = useState(false)
  const [newAlbum, setNewAlbum] = useState(false)

  const days = useMemo(() => {
    const m = new Map<number, Photo[]>()
    for (const p of [...lib].reverse()) {
      const d = startOfDay(p.ts)
      if (!m.has(d)) m.set(d, [])
      m.get(d)!.push(p)
    }
    return [...m.entries()].slice(0, 8)
  }, [lib])
  const memories = useMemo(() => [...userMems, ...builtinMemories(lib)], [lib, userMems])
  const people = PEOPLE_AND_PETS.filter((x) => lib.some((p) => p.people?.includes(x.id) || p.pets?.includes(x.id)))
  const count = (f: (p: Photo) => boolean) => lib.filter(f).length
  const dupCount = duplicateGroups(lib).length
  const pinnedTiles = pinned.map((id) => ({ id, title: PINNABLE.find((x) => x.id === id)?.title ?? id }))

  const push = (cid: string) => nav.push(cid.startsWith('shared:') ? <SharedAlbumPage albumId={cid.slice(7)} /> : <CollectionPage cid={cid} />)

  return (
    <Page
      title="Collections"
      bottomExtra={80}
      trailing={
        <>
          <BarButton label="Photos Settings" onClick={() => useUI.getState().set({ settings: true })}><Settings size={21} /></BarButton>
          <button className="ph-me-btn" aria-label="Account" onClick={() => useUI.getState().set({ settings: true })}><Avatar id="me" size={36} /></button>
        </>
      }
    >
      <SectionHead title="Pinned" action={<button className="ph-sec-act" onClick={() => setPinSheet(true)}>Modify</button>} />
      <div className="ph-hscroll">
        {pinnedTiles.map((t) => <PinnedTile key={t.id} id={t.id} title={t.title} onOpen={() => push(t.id)} />)}
        <button className="ph-pin-add" onClick={() => setPinSheet(true)} aria-label="Add pinned collection"><Plus size={26} /></button>
      </div>

      <SectionHead title="Recent Days" onMore={() => nav.push(<RecentDaysPage />)} />
      <div className="ph-hscroll">
        {days.map(([d, ps]) => (
          <button key={d} className="ph-day-card" onClick={() => push(`day:${d}`)}>
            <Cover photo={ps[0]} />
            <div className="ph-card-shade" />
            <div className="ph-card-text"><div className="t-headline">{dayLabelFor(d)}</div><div className="t-caption1">{[...new Set(ps.map((p) => p.place).filter(Boolean))].slice(0, 1).join('') || `${ps.length} items`}</div></div>
          </button>
        ))}
      </div>

      <SectionHead title="People & Pets" onMore={() => nav.push(<PeoplePage />)} />
      <div className="ph-hscroll ph-people-row">
        {people.map((x) => (
          <button key={x.id} className="ph-person" onClick={() => push(`people:${x.id}`)}>
            <FaceChip id={x.id} size={84} />
            <span className="t-footnote">{x.name.replace(' (You)', '')}</span>
          </button>
        ))}
      </div>

      <SectionHead title="Memories" onMore={() => nav.push(<MemoriesPage />)} />
      <div className="ph-hscroll">
        {memories.map((m) => (
          <button key={m.id} className="ph-mem-card" onClick={() => useUI.getState().set({ slideshow: { ids: m.photos, title: m.title, autoplay: true } })}>
            <Cover photo={map.get(m.photos[0])} />
            <div className="ph-card-shade" />
            <div className="ph-mem-text"><div className="ph-mem-title">{m.title}</div><div className="t-caption1">{m.subtitle}</div></div>
            <span className="ph-mem-play"><Play size={14} fill="#fff" /></span>
          </button>
        ))}
      </div>

      <SectionHead title="Albums" onMore={() => nav.push(<AlbumsPage />)} action={<button className="ph-sec-act" aria-label="New Album" onClick={() => setNewAlbum(true)}><Plus size={20} /></button>} />
      <div className="ph-hscroll">
        {albums.map((a) => (
          <button key={a.id} className="ph-album-card" onClick={() => push(`album:${a.id}`)}>
            <Cover photo={map.get(a.photos[a.photos.length - 1])} />
            <div className="t-subhead nowrap">{a.name}</div>
            <div className="t-footnote secondary">{a.photos.filter((i) => map.has(i) && !deleted[i]).length}</div>
          </button>
        ))}
      </div>

      <SectionHead title="Shared Albums" onMore={() => nav.push(<SharedAlbumsPage />)} />
      <div className="ph-hscroll">
        {shared.map((a) => (
          <button key={a.id} className="ph-album-card" onClick={() => push(`shared:${a.id}`)}>
            <Cover photo={map.get(a.photos[0])} />
            <div className="t-subhead nowrap">{a.name}</div>
            <div className="t-footnote secondary nowrap">{a.participants.length} people · {fmtAgo(Math.max(...a.activity.map((x) => x.ts), 0))}</div>
          </button>
        ))}
      </div>
      <List>
        <Row title="Shared Album Activity" subtitle={latestActivity(shared)} icon={<span className="ph-row-ic" style={{ background: 'var(--blue)' }}><Activity size={17} color="#fff" /></span>} chevron onClick={() => nav.push(<ActivityPage />)} />
      </List>

      <List header="Media Types">
        {MEDIA_TYPES.map((m) => {
          const n = countFor(m.id, lib)
          return <Row key={m.id} title={m.title} detail={n} icon={<span className="ph-list-ic">{ICONS[m.id]}</span>} chevron onClick={() => push(m.id)} />
        })}
      </List>

      <List header="Utilities">
        <Row title="Captured by Me" detail={count((p) => p.capturedByMe && p.kind !== 'screenshot')} icon={<span className="ph-list-ic">{ICONS.captured}</span>} chevron onClick={() => push('captured')} />
        <Row title="Identity Documents" detail={count((p) => !!p.idDocument)} icon={<span className="ph-list-ic">{ICONS.ids}</span>} chevron onClick={() => push('ids')} />
        <Row title="Duplicates" detail={dupCount} icon={<span className="ph-list-ic">{ICONS.duplicates}</span>} chevron onClick={() => push('duplicates')} />
        <Row title="Hidden" detail={<Lock size={15} />} icon={<span className="ph-list-ic">{ICONS.hidden}</span>} chevron onClick={() => push('hidden')} />
        <Row title="Recently Deleted" detail={<span className="row gap4">{all.filter((p) => deleted[p.id]).length || ''} <Lock size={15} /></span>} icon={<span className="ph-list-ic">{ICONS.deleted}</span>} chevron onClick={() => push('deleted')} />
      </List>
      <div style={{ height: 30 }} />

      <PinSheet open={pinSheet} onClose={() => setPinSheet(false)} />
      <NewAlbumSheet open={newAlbum} onClose={() => setNewAlbum(false)} />
    </Page>
  )
}

function countFor(id: string, lib: Photo[]) {
  switch (id) {
    case 'videos': return lib.filter((p) => p.kind === 'video').length
    case 'selfies': return lib.filter((p) => p.keywords.includes('selfie') || /front/i.test(p.lens ?? '')).length
    case 'portrait': return lib.filter((p) => p.kind === 'portrait').length
    case 'panoramas': return lib.filter((p) => p.kind === 'panorama').length
    case 'screenshots': return lib.filter((p) => p.kind === 'screenshot' && !p.idDocument).length
    case 'edited': return lib.filter((p) => !!p.edits && Object.keys(p.edits).some((k) => k !== 'capture')).length
    default: return 0
  }
}

function latestActivity(shared: ReturnType<typeof useOS.getState>['sharedAlbums']) {
  const all = shared.flatMap((a) => a.activity.map((x) => ({ ...x, album: a.name }))).sort((a, b) => b.ts - a.ts)
  const x = all[0]
  return x ? `${contactName(x.who)} ${x.what} · ${fmtAgo(x.ts)}` : 'No recent activity'
}

function PinnedTile({ id, title, onOpen }: { id: string; title: string; onOpen: () => void }) {
  const c = useCollection(id)
  const cover = c.kind === 'ids' ? undefined : c.photos[c.photos.length - 1]
  return (
    <button className="ph-pin-tile" onClick={onOpen}>
      <Cover photo={cover} />
      <div className="ph-card-shade" />
      <div className="ph-pin-label">
        {id.startsWith('people:') ? null : <span className="ph-pin-ic">{ICONS[id] ?? (id.startsWith('shared:') ? <Users size={14} /> : <Layers size={14} />)}</span>}
        <span className="t-footnote bold nowrap">{title}</span>
      </div>
      {c.kind === 'ids' && <span className="ph-pin-lock"><Lock size={18} /></span>}
    </button>
  )
}

function PinSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pinned = usePh((s) => s.pinned)
  const albums = usePh((s) => s.albums)
  const opts = [...PINNABLE, ...albums.filter((a) => !PINNABLE.some((p) => p.id === `album:${a.id}`)).map((a) => ({ id: `album:${a.id}`, title: a.name }))]
  return (
    <Sheet open={open} onClose={onClose} title="Pinned Collections" detent="large" trailing={<Button size="small" onClick={onClose}>Done</Button>}>
      <List footer="Pinned collections appear at the top of Collections for quick access.">
        {opts.map((o) => (
          <Row key={o.id} title={o.title} icon={<span className="ph-list-ic">{ICONS[o.id] ?? <Pin size={18} />}</span>} trailing={pinned.includes(o.id) ? <Check size={20} className="accent" /> : undefined} onClick={() => usePh.getState().togglePin(o.id)} />
        ))}
      </List>
    </Sheet>
  )
}

function NewAlbumSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [name, setName] = useState('')
  const [pick, setPick] = useState(false)
  const create = (ids: string[]) => {
    const id = `ua-${Date.now().toString(36)}`
    usePh.getState().set({ albums: [...usePh.getState().albums, { id, name: name.trim() || 'Untitled Album', photos: ids }] })
    useOS.getState().showToast(`Created “${name.trim() || 'Untitled Album'}”`)
    setName('')
    onClose()
  }
  return (
    <>
      <Sheet open={open && !pick} onClose={onClose} title="New Album" detent="auto" trailing={<Button size="small" disabled={!name.trim()} onClick={() => setPick(true)}>Next</Button>}>
        <div style={{ padding: '8px 16px 24px' }}>
          <input className="text-input" autoFocus placeholder="Album Name" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && name.trim() && setPick(true)} aria-label="Album name" />
          <div className="t-footnote secondary" style={{ marginTop: 10 }}>Next, choose photos to add. You can also create an empty album.</div>
          <Button variant="gray" block style={{ marginTop: 12 }} onClick={() => create([])}>Create Empty Album</Button>
        </div>
      </Sheet>
      <PhotoPickerSheet open={pick} title={`Add to “${name}”`} onClose={() => { setPick(false) }} onPick={(ids) => create(ids)} />
    </>
  )
}

/** Generic collection page: grid, selection, slideshow, pin. */
export function CollectionPage({ cid }: { cid: string }) {
  const c = useCollection(cid)
  const nav = useNav()
  const pinned = usePh((s) => s.pinned.includes(cid))
  const [selecting, setSelecting] = useState(false)
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [unlocked, setUnlocked] = useState(false)
  const [revealed, setRevealed] = useState(false)
  const [addPick, setAddPick] = useState(false)
  const ids = useMemo(() => c.photos.map((p) => p.id), [c.photos])
  const blur = useMemo(() => (c.kind === 'ids' && !revealed ? new Set(ids) : undefined), [c.kind, revealed, ids])
  const locked = (c.kind === 'hidden' || c.kind === 'deleted') && !unlocked
  const toggle = (id: string) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const open = (id: string, el: HTMLElement) => {
    if (c.kind === 'ids' && !revealed) return reveal()
    openViewer(ids, id, el, { deleted: c.kind === 'deleted', title: c.title })
  }
  const reveal = () => {
    useOS.getState().flashIsland({ kind: 'faceid', duration: 900 })
    window.setTimeout(() => setRevealed(true), 700)
  }

  const more = (el: HTMLElement) => {
    const items = [
      { label: 'Slideshow', icon: <Play size={17} />, disabled: !ids.length, onSelect: () => useUI.getState().set({ slideshow: { ids, title: c.title } }) },
      { label: pinned ? 'Unpin' : 'Pin', icon: <Pin size={17} />, onSelect: () => usePh.getState().togglePin(cid) },
    ]
    if (c.kind === 'album' && c.album) {
      items.push({ label: 'Add Photos', icon: <Plus size={17} />, disabled: false, onSelect: () => setAddPick(true) })
      items.push({
        label: 'Delete Album', icon: <Trash2 size={17} />, disabled: false,
        onSelect: () => showAlert({ title: `Delete “${c.title}”?`, message: 'Photos in this album won’t be deleted from your library.', actions: [{ label: 'Cancel', style: 'cancel' }, { label: 'Delete Album', style: 'destructive', onPress: () => { usePh.getState().set({ albums: usePh.getState().albums.filter((a) => a.id !== c.album!.id) }); nav.pop() } }] }),
      })
    }
    openMenu(el, items)
  }

  const extra = c.kind === 'album' && c.album ? [{ label: 'Remove from Album', destructive: true, onSelect: () => usePh.getState().set({ albums: usePh.getState().albums.map((a) => (a.id === c.album!.id ? { ...a, photos: a.photos.filter((x) => !sel.has(x)) } : a)) }) }]
    : c.kind === 'hidden' ? [{ label: 'Unhide', onSelect: () => sel.forEach((i) => useOS.getState().updatePhoto(i, { hidden: false })) }] : undefined

  return (
    <Page
      title={c.title}
      subtitle={c.subtitle ?? `${c.photos.length} item${c.photos.length === 1 ? '' : 's'}`}
      bottomExtra={80}
      trailing={locked ? undefined : (
        <>
          {c.kind !== 'duplicates' && ids.length > 0 && <button className="ph-pill-btn glass interactive" onClick={() => { setSelecting(!selecting); setSel(new Set()) }}>{selecting ? 'Cancel' : 'Select'}</button>}
          <button className="bar-btn icon glass interactive" aria-label="More" onClick={(e) => more(e.currentTarget)}><Ellipsis size={22} /></button>
        </>
      )}
    >
      {(c.kind === 'hidden' || c.kind === 'deleted') ? (
        <FaceIDGate label={c.title} unlocked={unlocked} onUnlock={() => setUnlocked(true)}>
          {c.kind === 'deleted' && ids.length > 0 && (
            <div className="ph-banner t-footnote">Items show the days remaining before deletion. After that time, items will be permanently deleted.
              <div className="row gap8" style={{ marginTop: 8 }}>
                <Button size="small" variant="tinted" onClick={() => { usePh.getState().recover(ids); useOS.getState().showToast('Recovered all items') }}>Recover All</Button>
                <Button size="small" variant="destructive" onClick={() => showAlert({ title: 'Delete All?', message: 'These items will be permanently deleted. This can’t be undone.', actions: [{ label: 'Cancel', style: 'cancel' }, { label: 'Delete All', style: 'destructive', onPress: () => usePh.getState().purge(ids) }] })}>Delete All</Button>
              </div>
            </div>
          )}
          {ids.length ? <PhotoGrid photos={c.photos} selecting={selecting} selected={sel} onToggle={toggle} onOpen={open} /> : <Empty text={c.kind === 'hidden' ? 'No Hidden Items' : 'No Recently Deleted Items'} />}
        </FaceIDGate>
      ) : c.kind === 'duplicates' ? (
        <DuplicatesView />
      ) : (
        <>
          {c.kind === 'ids' && (
            <div className="ph-banner t-footnote">
              <IdCard size={16} /> Identity documents are blurred until you authenticate. They’re excluded from Memories, Shuffle and search suggestions.
              {!revealed ? <Button size="small" variant="tinted" style={{ marginTop: 8 }} onClick={reveal}>Reveal with Face ID</Button> : <Button size="small" variant="gray" style={{ marginTop: 8 }} onClick={() => setRevealed(false)}>Hide Again</Button>}
            </div>
          )}
          {c.kind === 'person' && <PersonHeader id={cid.slice(7)} count={c.photos.length} />}
          {ids.length ? <PhotoGrid photos={c.photos} selecting={selecting} selected={sel} onToggle={toggle} onOpen={open} blurIds={blur} /> : <Empty text="No Photos or Videos" />}
        </>
      )}
      {selecting && <SelectBar ids={[...sel]} extra={extra} onDone={() => { setSelecting(false); setSel(new Set()) }} />}
      {c.kind === 'album' && c.album && <PhotoPickerSheet open={addPick} exclude={c.album.photos} onClose={() => setAddPick(false)} onPick={(ids2) => { usePh.getState().addToAlbum(c.album!.id, ids2); useOS.getState().showToast(`Added ${ids2.length} item${ids2.length > 1 ? 's' : ''}`) }} />}
    </Page>
  )
}

function Empty({ text }: { text: string }) {
  return <div className="empty-state" style={{ paddingTop: 80 }}><ImageIcon size={42} strokeWidth={1.4} /><div className="t-headline">{text}</div></div>
}

function PersonHeader({ id, count }: { id: string; count: number }) {
  const shuffle = useOS((s) => s.shuffle)
  const info = PEOPLE_AND_PETS.find((x) => x.id === id)
  const pet = info?.kind === 'pet'
  const species = info && 'species' in info ? info.species : undefined
  return (
    <div className="ph-person-head">
      <FaceChip id={id} size={96} />
      <div className="t-footnote secondary">{count} photos & videos{species ? ` · ${species}` : ''}</div>
      {pet && (
        <Button size="small" variant={shuffle.pet === id && shuffle.kind === 'pets' ? 'gray' : 'tinted'} onClick={() => { useOS.getState().set({ shuffle: { ...shuffle, kind: 'pets', pet: id } }); useOS.getState().showToast(`${id} featured in Photo Shuffle`) }}>
          {shuffle.pet === id && shuffle.kind === 'pets' ? `Featured in Photo Shuffle ✓` : 'Feature in Photo Shuffle'}
        </Button>
      )}
    </div>
  )
}

function DuplicatesView() {
  const lib = useLibrary()
  const groups = duplicateGroups(lib)
  if (!groups.length) return <Empty text="No Duplicates Found" />
  return (
    <div className="ph-dups">
      <div className="ph-banner t-footnote">Merging keeps the highest quality version and combines relevant data. The rest move to Recently Deleted.</div>
      {groups.map((g) => (
        <div key={g[0].id} className="ph-dup-group">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span className="t-subhead bold">{g.length} Exact Copies</span>
            <Button size="small" variant="tinted" onClick={() => {
              const keep = [...g].sort((a, b) => b.width * b.height - a.width * a.height)[0]
              const merged = [...new Set(g.flatMap((p) => p.keywords))]
              useOS.getState().updatePhoto(keep.id, { keywords: merged, favorite: g.some((p) => p.favorite), rating: Math.max(...g.map((p) => p.rating ?? 0)) || undefined })
              usePh.getState().del(g.filter((p) => p.id !== keep.id).map((p) => p.id))
              useOS.getState().showToast(`Merged ${g.length} items`)
            }}>Merge {g.length} Items</Button>
          </div>
          <div className="ph-dup-row">
            {g.map((p) => <div key={p.id} className="ph-dup-item"><Cover photo={p} /><span className="t-caption2 secondary">{p.sizeMB} MB · {p.width}×{p.height}</span></div>)}
          </div>
        </div>
      ))}
    </div>
  )
}

function RecentDaysPage() {
  const nav = useNav()
  const lib = useLibrary()
  const days = useMemo(() => {
    const m = new Map<number, Photo[]>()
    for (const p of [...lib].reverse()) {
      const d = startOfDay(p.ts)
      if (!m.has(d)) m.set(d, [])
      m.get(d)!.push(p)
    }
    return [...m.entries()].filter(([d]) => d > startOfDay() - 60 * DAY)
  }, [lib])
  return (
    <Page title="Recent Days" bottomExtra={80}>
      <div className="ph-days-list">
        {days.map(([d, ps]) => (
          <button key={d} className="ph-day-row" onClick={() => nav.push(<CollectionPage cid={`day:${d}`} />)}>
            <div className="ph-day-mosaic">{ps.slice(0, 3).map((p) => <Cover key={p.id} photo={p} />)}</div>
            <div className="ph-card-shade" />
            <div className="ph-card-text"><div className="t-title3">{dayLabelFor(d)}</div><div className="t-footnote">{ps.length} items{ps[0].place ? ` · ${ps[0].place}` : ''}</div></div>
          </button>
        ))}
      </div>
    </Page>
  )
}

function PeoplePage() {
  const nav = useNav()
  const lib = useLibrary()
  const [filter, setFilter] = useState<'all' | 'person' | 'pet'>('all')
  const items = PEOPLE_AND_PETS.filter((x) => (filter === 'all' || x.kind === filter)).map((x) => ({ ...x, n: lib.filter((p) => p.people?.includes(x.id) || p.pets?.includes(x.id)).length })).filter((x) => x.n > 0)
  return (
    <Page title="People & Pets" bottomExtra={80}>
      <div className="ph-chips" style={{ padding: '0 16px 12px' }}>
        {(['all', 'person', 'pet'] as const).map((f) => <button key={f} className={`chip ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>{f === 'all' ? 'All' : f === 'person' ? 'People' : 'Pets'}</button>)}
      </div>
      <div className="ph-people-grid">
        {items.map((x) => (
          <button key={x.id} className="ph-person" onClick={() => nav.push(<CollectionPage cid={`people:${x.id}`} />)}>
            <FaceChip id={x.id} size={104} />
            <span className="t-subhead">{x.name.replace(' (You)', '')}</span>
            <span className="t-caption1 secondary">{x.n} {x.kind === 'pet' ? '🐾' : ''}</span>
          </button>
        ))}
      </div>
    </Page>
  )
}

function MemoriesPage() {
  const lib = useLibrary()
  const userMems = usePh((s) => s.memories)
  const map = usePhotoMap()
  const memories = useMemo(() => [...userMems, ...builtinMemories(lib)], [lib, userMems])
  const [prompt, setPrompt] = useState('')
  const [busy, setBusy] = useState(false)
  const create = () => {
    const q = prompt.trim()
    if (!q) return
    setBusy(true)
    window.setTimeout(() => {
      let found = photoSearch(q, lib)
      if (found.length < 2) {
        const words = q.toLowerCase().split(/\W+/).filter((w) => w.length > 3)
        found = lib.filter((p) => words.some((w) => p.keywords.some((k) => k.includes(w)) || p.description.toLowerCase().includes(w) || (p.place ?? '').toLowerCase().includes(w) || (p.pets ?? []).some((x) => x.toLowerCase() === w)))
      }
      setBusy(false)
      if (found.length < 2) {
        useOS.getState().showToast('Not enough photos match that description')
        return
      }
      const m = { id: `um-${Date.now().toString(36)}`, title: q.replace(/^./, (c) => c.toUpperCase()), subtitle: 'Created with Apple Intelligence', photos: found.slice(0, 14).reverse().map((p) => p.id), theme: 'kenburns', track: 't3' }
      usePh.getState().set({ memories: [m, ...usePh.getState().memories] })
      setPrompt('')
      useUI.getState().set({ slideshow: { ids: m.photos, title: m.title, autoplay: true } })
    }, 1300)
  }
  return (
    <Page title="Memories" bottomExtra={80}>
      <div className="ph-mem-create">
        <AISparkle size={20} />
        <input value={prompt} onChange={(e) => setPrompt(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && create()} placeholder="Describe a Memory…" aria-label="Describe a memory" data-dictation="Biscuit at the beach|Robotics season highlights|Summer trips with music" />
        {busy ? <Spinner size={18} /> : <button className="ph-mem-go" disabled={!prompt.trim()} onClick={create} aria-label="Create memory"><Sparkles size={16} /></button>}
      </div>
      <div className="ph-mem-suggest">
        {['Biscuit at the beach', 'Robotics season', 'Food we loved', 'Mountains and lakes'].map((s) => <button key={s} className="chip" onClick={() => setPrompt(s)}>{s}</button>)}
      </div>
      <div className="ph-mem-list">
        {memories.map((m) => (
          <div key={m.id} className="ph-mem-big">
            <button className="ph-mem-card big" onClick={() => useUI.getState().set({ slideshow: { ids: m.photos, title: m.title, autoplay: true } })}>
              <Cover photo={map.get(m.photos[0])} />
              <div className="ph-card-shade" />
              <div className="ph-mem-text"><div className="ph-mem-title">{m.title}</div><div className="t-caption1">{m.subtitle} · {m.photos.length} items</div></div>
              <span className="ph-mem-play"><Play size={16} fill="#fff" /></span>
            </button>
            {m.id.startsWith('um-') && <button className="ph-mem-del t-footnote" onClick={() => usePh.getState().set({ memories: usePh.getState().memories.filter((x) => x.id !== m.id) })}>Delete Memory</button>}
          </div>
        ))}
      </div>
    </Page>
  )
}

function AlbumsPage() {
  const nav = useNav()
  const albums = usePh((s) => s.albums)
  const map = usePhotoMap()
  const [newAlbum, setNewAlbum] = useState(false)
  return (
    <Page title="Albums" bottomExtra={80} trailing={<BarButton label="New Album" onClick={() => setNewAlbum(true)}><Plus size={22} /></BarButton>}>
      <div className="ph-album-grid">
        {albums.map((a) => (
          <button key={a.id} className="ph-album-card" onClick={() => nav.push(<CollectionPage cid={`album:${a.id}`} />)}>
            <Cover photo={map.get(a.photos[a.photos.length - 1])} />
            <div className="t-subhead nowrap">{a.name}</div>
            <div className="t-footnote secondary">{a.photos.length}</div>
          </button>
        ))}
      </div>
      <NewAlbumSheet open={newAlbum} onClose={() => setNewAlbum(false)} />
    </Page>
  )
}

function SharedAlbumsPage() {
  const nav = useNav()
  const shared = useOS((s) => s.sharedAlbums)
  const map = usePhotoMap()
  return (
    <Page title="Shared Albums" bottomExtra={80}>
      <List>
        <Row title="Activity" subtitle={latestActivity(shared)} icon={<span className="ph-row-ic" style={{ background: 'var(--blue)' }}><Activity size={17} color="#fff" /></span>} chevron onClick={() => nav.push(<ActivityPage />)} />
      </List>
      <div className="ph-album-grid">
        {shared.map((a) => (
          <button key={a.id} className="ph-album-card" onClick={() => nav.push(<SharedAlbumPage albumId={a.id} />)}>
            <Cover photo={map.get(a.photos[0])} />
            <div className="t-subhead nowrap">{a.name}</div>
            <div className="t-footnote secondary nowrap">From {contactName(a.owner)}</div>
          </button>
        ))}
      </div>
    </Page>
  )
}

function ActivityPage() {
  const shared = useOS((s) => s.sharedAlbums)
  return (
    <Page title="Activity" bottomExtra={80}>
      <ActivityFeed albums={shared} />
    </Page>
  )
}

export { personName }
