import { memo, useRef, type ReactNode } from 'react'
import { Heart, Check, Share, Copy, EyeOff, Trash2, Star, Play, SquareStack } from 'lucide-react'
import type { Photo } from '../../os/types'
import { useOS } from '../../os/store'
import { openMenu, showAlert } from '../../ui/overlay'
import { PhotoView } from './PhotoView'
import { fmtDur } from './look'
import { usePh } from './pstore'

export const Thumb = memo(function Thumb({ photo, selecting, selected, blur, reactions }: { photo: Photo; selecting?: boolean; selected?: boolean; blur?: boolean; reactions?: string[] }) {
  return (
    <div className={`ph-cell ${selected ? 'sel' : ''}`} data-pid={photo.id} role="button" aria-label={photo.description || 'Photo'} tabIndex={0}>
      <div className={`ph-cell-img ${blur ? 'blurred' : ''}`}>
        <PhotoView photo={photo} />
      </div>
      {photo.kind === 'video' && <span className="ph-cell-dur">{fmtDur(photo.duration ?? 0)}</span>}
      {photo.kind === 'panorama' && <span className="ph-cell-dur">PANO</span>}
      {photo.favorite && !selecting && <Heart className="ph-cell-fav" size={13} fill="#fff" strokeWidth={0} />}
      {reactions && reactions.length > 0 && <span className="ph-cell-react">{reactions.slice(0, 3).join('')}{reactions.length > 3 ? ` ${reactions.length}` : ''}</span>}
      {blur && <span className="ph-cell-lock">ID</span>}
      {selecting && <span className={`ph-check ${selected ? 'on' : ''}`}>{selected && <Check size={13} strokeWidth={3.4} />}</span>}
    </div>
  )
})

export function thumbMenu(el: HTMLElement, p: Photo, onOpen: () => void) {
  const os = useOS.getState()
  openMenu(el, [
    { label: 'Share…', icon: <Share size={17} />, onSelect: () => os.set({ shareRequest: { title: p.place ?? 'Photo', kind: 'photo', photoId: p.id, app: 'photos' } }) },
    { label: p.favorite ? 'Unfavorite' : 'Favorite', icon: <Heart size={17} />, onSelect: () => os.updatePhoto(p.id, { favorite: !p.favorite }) },
    { label: 'Rate 5 Stars', icon: <Star size={17} />, onSelect: () => { os.updatePhoto(p.id, { rating: 5 }); os.showToast('Rated ★★★★★') } },
    { label: 'Copy', icon: <Copy size={17} />, onSelect: () => os.showToast('Copied Photo') },
    { label: 'Duplicate', icon: <SquareStack size={17} />, onSelect: () => { const { id: _id, ...rest } = p; void _id; os.addPhoto({ ...rest, ts: p.ts + 1000 }); os.showToast('Duplicated') } },
    { label: p.kind === 'video' ? 'Play' : 'Open', icon: <Play size={17} />, onSelect: onOpen },
    { label: 'Hide', icon: <EyeOff size={17} />, separatorBefore: true, onSelect: () => { os.updatePhoto(p.id, { hidden: true }); os.showToast('Moved to Hidden') } },
    {
      label: 'Delete', icon: <Trash2 size={17} />, destructive: true,
      onSelect: () => showAlert({ title: 'Delete Photo?', message: 'This photo will be moved to Recently Deleted.', actions: [{ label: 'Cancel', style: 'cancel' }, { label: 'Delete Photo', style: 'destructive', onPress: () => usePh.getState().del([p.id]) }] }),
    },
  ], { preview: <div style={{ width: '100%', height: '100%', borderRadius: 12, overflow: 'hidden' }}><PhotoView photo={p} /></div> })
}

/** Tight square grid with event delegation (one handler for all cells). */
export function PhotoGrid({ photos, cols = 3, selecting, selected, onToggle, onOpen, blurIds, reactions, header, gap = 2 }: {
  photos: Photo[]
  cols?: number
  selecting?: boolean
  selected?: Set<string>
  onToggle?: (id: string) => void
  onOpen: (id: string, el: HTMLElement) => void
  blurIds?: Set<string>
  reactions?: Record<string, string[]>
  header?: ReactNode
  gap?: number
}) {
  const lp = useRef<{ t?: number; fired: boolean; x: number; y: number }>({ fired: false, x: 0, y: 0 })
  const find = (t: EventTarget) => (t as HTMLElement).closest('[data-pid]') as HTMLElement | null
  const byId = (id: string) => photos.find((p) => p.id === id)
  return (
    <>
      {header}
      <div
        className="ph-grid"
        style={{ gridTemplateColumns: `repeat(${cols}, 1fr)`, gap }}
        onPointerDown={(e) => {
          const cell = find(e.target)
          if (!cell || e.button !== 0) return
          lp.current.fired = false
          lp.current.x = e.clientX
          lp.current.y = e.clientY
          window.clearTimeout(lp.current.t)
          lp.current.t = window.setTimeout(() => {
            const p = byId(cell.dataset.pid!)
            if (!p || selecting) return
            lp.current.fired = true
            thumbMenu(cell, p, () => onOpen(p.id, cell))
          }, 480)
        }}
        onPointerMove={(e) => {
          if (Math.hypot(e.clientX - lp.current.x, e.clientY - lp.current.y) > 8) window.clearTimeout(lp.current.t)
        }}
        onPointerUp={() => window.clearTimeout(lp.current.t)}
        onPointerLeave={() => window.clearTimeout(lp.current.t)}
        onContextMenu={(e) => {
          const cell = find(e.target)
          if (!cell) return
          e.preventDefault()
          const p = byId(cell.dataset.pid!)
          if (p) thumbMenu(cell, p, () => onOpen(p.id, cell))
        }}
        onClick={(e) => {
          if (lp.current.fired) {
            lp.current.fired = false
            return
          }
          const cell = find(e.target)
          if (!cell) return
          const id = cell.dataset.pid!
          if (selecting) onToggle?.(id)
          else onOpen(id, cell)
        }}
        onKeyDown={(e) => {
          if (e.key !== 'Enter') return
          const cell = find(e.target)
          if (cell) selecting ? onToggle?.(cell.dataset.pid!) : onOpen(cell.dataset.pid!, cell)
        }}
      >
        {photos.map((p) => (
          <Thumb key={p.id} photo={p} selecting={selecting} selected={selected?.has(p.id)} blur={blurIds?.has(p.id)} reactions={reactions?.[p.id]} />
        ))}
      </div>
    </>
  )
}
