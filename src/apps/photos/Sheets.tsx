import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Share, Heart, Trash2, Ellipsis, Plus, ScanFace, Check, CloudUpload, Cloud, PawPrint, User } from 'lucide-react'
import { useOS } from '../../os/store'
import { Sheet, openMenu, showAlert } from '../../ui/overlay'
import { List, Row } from '../../ui/list'
import { Button, Segmented, Switch, Avatar } from '../../ui/controls'
import { Scene } from '../../art/Scene'
import { PhotoView } from './PhotoView'
import { PhotoGrid } from './Grid'
import { usePh, useUI, useLibrary, usePhotoMap } from './pstore'

/** Bottom toolbar shown in selection mode. */
export function SelectBar({ ids, onDone, extra }: { ids: string[]; onDone: () => void; extra?: { label: string; onSelect: () => void; destructive?: boolean }[] }) {
  const os = useOS.getState
  const map = usePhotoMap()
  const [albumPick, setAlbumPick] = useState(false)
  const n = ids.length
  const kinds = ids.map((i) => map.get(i)?.kind)
  const vids = kinds.filter((k) => k === 'video').length
  const label = n === 0 ? 'Select Items' : vids === 0 ? `${n} Photo${n > 1 ? 's' : ''} Selected` : vids === n ? `${n} Video${n > 1 ? 's' : ''} Selected` : `${n} Items Selected`
  return (
    <>
      <div className="ph-selectbar">
        <button className="ph-sb-btn glass interactive" disabled={!n} aria-label="Share" onClick={() => os().set({ shareRequest: { title: `${n} Item${n > 1 ? 's' : ''}`, kind: 'photo', photoId: ids[0], app: 'photos' } })}>
          <Share size={21} />
        </button>
        <div className="ph-sb-mid glass">
          <span className="t-footnote bold">{label}</span>
        </div>
        <button
          className="ph-sb-btn glass interactive"
          disabled={!n}
          aria-label="More"
          onClick={(e) => {
            const allFav = ids.every((i) => map.get(i)?.favorite)
            openMenu(e.currentTarget, [
              { label: allFav ? 'Unfavorite' : 'Favorite', icon: <Heart size={17} />, onSelect: () => { ids.forEach((i) => os().updatePhoto(i, { favorite: !allFav })); onDone() } },
              { label: 'Add to Album', icon: <Plus size={17} />, onSelect: () => setAlbumPick(true) },
              { label: 'Slideshow', onSelect: () => { useUI.getState().set({ slideshow: { ids, title: `${n} Items` } }); onDone() } },
              { label: 'Rate 5 Stars', onSelect: () => { ids.forEach((i) => os().updatePhoto(i, { rating: 5 })); os().showToast(`Rated ${n} item${n > 1 ? 's' : ''} ★★★★★`); onDone() } },
              { label: 'Hide', onSelect: () => { ids.forEach((i) => os().updatePhoto(i, { hidden: true })); os().showToast(`Hid ${n} item${n > 1 ? 's' : ''}`); onDone() } },
              ...(extra ?? []).map((x) => ({ ...x, onSelect: () => { x.onSelect(); onDone() } })),
            ])
          }}
        >
          <Ellipsis size={21} />
        </button>
        <button
          className="ph-sb-btn glass interactive"
          disabled={!n}
          aria-label="Delete"
          onClick={() => showAlert({ title: `Delete ${n} Item${n > 1 ? 's' : ''}?`, message: 'These items will be moved to Recently Deleted for 30 days.', actions: [{ label: 'Cancel', style: 'cancel' }, { label: 'Delete', style: 'destructive', onPress: () => { usePh.getState().del(ids); onDone() } }] })}
        >
          <Trash2 size={21} />
        </button>
      </div>
      <AlbumPickerSheet open={albumPick} ids={ids} onClose={() => { setAlbumPick(false) }} onAdded={onDone} />
    </>
  )
}

export function AlbumPickerSheet({ open, ids, onClose, onAdded }: { open: boolean; ids: string[]; onClose: () => void; onAdded?: () => void }) {
  const albums = usePh((s) => s.albums)
  const shared = useOS((s) => s.sharedAlbums)
  const map = usePhotoMap()
  const [newName, setNewName] = useState('')
  const add = (albumId: string, name: string) => {
    usePh.getState().addToAlbum(albumId, ids)
    useOS.getState().showToast(`Added to “${name}”`)
    onClose()
    onAdded?.()
  }
  return (
    <Sheet open={open} onClose={onClose} title="Add to Album" detent="large">
      <div className="ph-picker-new">
        <input className="text-input" placeholder="New Album Name" value={newName} onChange={(e) => setNewName(e.target.value)} />
        <Button size="small" disabled={!newName.trim()} onClick={() => {
          const id = `ua-${Date.now().toString(36)}`
          usePh.getState().set({ albums: [...usePh.getState().albums, { id, name: newName.trim(), photos: [] }] })
          add(id, newName.trim())
          setNewName('')
        }}>Create</Button>
      </div>
      <List header="My Albums">
        {albums.map((a) => {
          const cover = map.get(a.photos[a.photos.length - 1] ?? '')
          return <Row key={a.id} title={a.name} detail={a.photos.length} icon={<div className="ph-row-thumb">{cover && <PhotoView photo={cover} />}</div>} onClick={() => add(a.id, a.name)} />
        })}
      </List>
      <List header="Shared Albums">
        {shared.map((a) => {
          const cover = map.get(a.photos[0] ?? '')
          return (
            <Row key={a.id} title={a.name} detail={a.photos.length} icon={<div className="ph-row-thumb">{cover && <PhotoView photo={cover} />}</div>} onClick={() => {
              addToShared(a.id, ids)
              useOS.getState().showToast(`Posted to “${a.name}”`)
              onClose()
              onAdded?.()
            }} />
          )
        })}
      </List>
    </Sheet>
  )
}

export function addToShared(albumId: string, ids: string[]) {
  const os = useOS.getState()
  os.set({
    sharedAlbums: os.sharedAlbums.map((a) => (a.id === albumId ? {
      ...a,
      photos: [...ids.filter((i) => !a.photos.includes(i)), ...a.photos],
      activity: [{ id: `ac-${Date.now()}`, who: 'me', what: `added ${ids.length} item${ids.length > 1 ? 's' : ''}`, ts: Date.now(), photoId: ids[0] }, ...a.activity],
    } : a)),
  })
}

/** Pick photos from the library (multi-select). */
export function PhotoPickerSheet({ open, onClose, onPick, title = 'Add Photos', exclude }: { open: boolean; onClose: () => void; onPick: (ids: string[]) => void; title?: string; exclude?: string[] }) {
  const lib = useLibrary()
  const items = useMemo(() => [...lib].reverse().filter((p) => !exclude?.includes(p.id) && !p.idDocument), [lib, exclude])
  const [sel, setSel] = useState<Set<string>>(new Set())
  useEffect(() => { if (open) setSel(new Set()) }, [open])
  return (
    <Sheet open={open} onClose={onClose} title={title} trailing={<Button size="small" disabled={!sel.size} onClick={() => { onPick([...sel]); onClose() }}>Add{sel.size ? ` (${sel.size})` : ''}</Button>}>
      <PhotoGrid photos={items} cols={4} selecting selected={sel} onToggle={(id) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })} onOpen={() => {}} />
    </Sheet>
  )
}

/** Simulated Face ID gate used by Hidden / Recently Deleted / Identity Documents. */
export function FaceIDGate({ label, children, unlocked, onUnlock }: { label: string; children: ReactNode; unlocked: boolean; onUnlock: () => void }) {
  const [scan, setScan] = useState<'idle' | 'scan' | 'ok'>('idle')
  if (unlocked) return <>{children}</>
  return (
    <div className="ph-gate">
      <div className={`ph-faceid ${scan}`}>{scan === 'ok' ? <Check size={46} strokeWidth={2.6} /> : <ScanFace size={54} strokeWidth={1.6} />}</div>
      <div className="t-title3">{label} is Locked</div>
      <div className="t-subhead secondary center">Use Face ID to view this collection.</div>
      <Button variant="tinted" onClick={() => {
        setScan('scan')
        useOS.getState().flashIsland({ kind: 'faceid', duration: 900 })
        window.setTimeout(() => setScan('ok'), 750)
        window.setTimeout(onUnlock, 1150)
      }}>{scan === 'scan' ? 'Scanning…' : 'View Album'}</Button>
    </div>
  )
}

const PET_FACE: Record<string, { scene: string; ox: number; oy: number; z: number }> = {
  Biscuit: { scene: 'dog-couch', ox: 64, oy: 64, z: 2.6 },
  Mochi: { scene: 'cat-window', ox: 50, oy: 45, z: 2.6 },
}

/** Circular face / pet crop (pets from Scene crops, people from contact avatars). */
export function FaceChip({ id, size = 64 }: { id: string; size?: number }) {
  const pet = PET_FACE[id]
  if (pet) {
    return (
      <div className="ph-face" style={{ width: size, height: size }}>
        <Scene scene={pet.scene} style={{ width: '100%', height: '100%', transform: `translate(${50 - pet.ox}%, ${50 - pet.oy}%) scale(${pet.z})`, transformOrigin: `${pet.ox}% ${pet.oy}%` }} />
      </div>
    )
  }
  return <div className="ph-face person" style={{ width: size, height: size }}><Avatar id={id} size={size} /></div>
}

/** Photos settings: iCloud priority sync + Photo Shuffle (iOS 27). */
export function PhotosSettingsSheet() {
  const open = useUI((s) => s.settings)
  const prioritySync = useOS((s) => s.prioritySync)
  const shuffle = useOS((s) => s.shuffle)
  const photos = useOS((s) => s.photos)
  const syncing = useUI((s) => s.syncing)
  const close = () => useUI.getState().set({ settings: false })
  const setShuffle = (p: Partial<typeof shuffle>) => useOS.getState().set({ shuffle: { ...shuffle, ...p } })
  const shufflePhotos = useMemo(() => photos.filter((p) => {
    if (p.hidden || p.idDocument || p.kind === 'screenshot' || p.kind === 'video') return false
    const me = p.people?.includes('me')
    if (me && !shuffle.includeMe) return false
    if (shuffle.kind === 'pets') return p.pets?.includes(shuffle.pet) || (shuffle.includeMe && me)
    if (shuffle.kind === 'people') return (p.people?.length ?? 0) > 0
    if (shuffle.kind === 'nature') return p.keywords.some((k) => ['nature', 'landscape', 'mountains', 'beach', 'sky', 'flowers', 'garden'].includes(k))
    return p.keywords.some((k) => ['city', 'bridge', 'landmark', 'skyline', 'buildings'].includes(k))
  }).slice(0, 8), [photos, shuffle])
  return (
    <Sheet open={open} onClose={close} title="Photos Settings" detent="large">
      <List header="iCloud" footer="Prioritize Sync uploads new photos and videos first, even on cellular or in Low Power Mode, so they’re available on your other devices sooner.">
        <Row title="iCloud Photos" icon={<span className="ph-set-ic" style={{ background: 'linear-gradient(#5ac8fa,#007aff)' }}><Cloud size={17} color="#fff" /></span>} toggle={{ value: true, onChange: () => useOS.getState().showToast('iCloud Photos stays on in this demo') }} />
        <Row title="Prioritize Sync" subtitle="New in iOS 27" icon={<span className="ph-set-ic" style={{ background: 'linear-gradient(#34c759,#248a3d)' }}><CloudUpload size={17} color="#fff" /></span>} toggle={{ value: prioritySync, onChange: (v) => { useOS.getState().set({ prioritySync: v }); useOS.getState().showToast(v ? 'Priority Sync on' : 'Priority Sync off') } }} />
        <Row title="Status" detail={syncing ? `Uploading ${syncing} item${syncing > 1 ? 's' : ''}…` : 'Up to date'} />
      </List>
      <List header="Photo Shuffle" footer="Choose what appears on your Lock Screen and in the Photos widget. Photo Shuffle can feature a specific pet, and you can choose whether photos of you are included.">
        <div className="ph-shuffle-kind">
          <Segmented options={['pets', 'people', 'nature', 'cities'] as const} value={shuffle.kind} onChange={(k) => setShuffle({ kind: k })} labels={{ pets: 'Pets', people: 'People', nature: 'Nature', cities: 'Cities' }} />
        </div>
        {shuffle.kind === 'pets' && (
          <div className="ph-shuffle-pets">
            {['Biscuit', 'Mochi'].map((pet) => (
              <button key={pet} className={`ph-shuffle-pet ${shuffle.pet === pet ? 'on' : ''}`} onClick={() => setShuffle({ pet })} aria-pressed={shuffle.pet === pet}>
                <FaceChip id={pet} size={64} />
                <span className="t-footnote">{pet}</span>
                {shuffle.pet === pet && <span className="ph-shuffle-tick"><Check size={12} strokeWidth={3.4} /></span>}
              </button>
            ))}
          </div>
        )}
        <Row title="Include Photos of You" icon={<User size={20} className="accent" />} trailing={<Switch checked={shuffle.includeMe} onChange={(v) => setShuffle({ includeMe: v })} label="Include Photos of You" />} />
        <div className="ph-shuffle-preview">
          {shufflePhotos.length ? shufflePhotos.map((p) => <div key={p.id} className="ph-shuffle-card"><PhotoView photo={p} /></div>) : <div className="t-footnote secondary" style={{ padding: 12 }}>No matching photos yet.</div>}
        </div>
        <Row title="Add Shuffle to Lock Screen" tint icon={<PawPrint size={20} className="accent" />} onClick={() => { useOS.getState().showToast('Photo Shuffle added to Lock Screen'); close() }} />
      </List>
      <List header="Memories & Search">
        <Row title="Show Featured Content" toggle={{ value: true, onChange: () => useOS.getState().showToast('Featured content stays on') }} />
        <Row title="Reset Suggested Memories" tint onClick={() => { usePh.getState().set({ memories: [] }); useOS.getState().showToast('Suggested memories reset') }} />
        <Row title="Clear Recent Searches" tint onClick={() => { usePh.getState().set({ recentSearches: [] }); useOS.getState().showToast('Recent searches cleared') }} />
      </List>
      <div style={{ height: 24 }} />
    </Sheet>
  )
}
