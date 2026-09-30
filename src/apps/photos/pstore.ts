import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useMemo } from 'react'
import type { Photo } from '../../os/types'
import { useOS } from '../../os/store'
import { ALBUMS } from '../../os/data/photos'

export interface UserAlbum { id: string; name: string; photos: string[] }
export interface Memory { id: string; title: string; subtitle: string; photos: string[]; theme?: string; track?: string }

interface PState {
  deleted: Record<string, number>
  albums: UserAlbum[]
  pinned: string[]
  recentSearches: string[]
  zoom: 'years' | 'months' | 'all'
  cols: number
  libFilter: 'all' | 'favorites' | 'edited' | 'videos' | 'screenshots'
  memories: Memory[]
  set: (p: Partial<PState>) => void
  del: (ids: string[]) => void
  recover: (ids: string[]) => void
  purge: (ids: string[]) => void
  addToAlbum: (albumId: string, ids: string[]) => void
  togglePin: (id: string) => void
  addSearch: (q: string) => void
}

export const usePh = create<PState>()(
  persist(
    (set, get) => ({
      deleted: {},
      albums: ALBUMS.map((a) => ({ ...a, photos: [...a.photos] })),
      pinned: ['favorites', 'captured', 'videos', 'shared:sa-family', 'people:Biscuit', 'screenshots'],
      recentSearches: ['Biscuit at the beach', 'receipt'],
      zoom: 'all',
      cols: 3,
      libFilter: 'all',
      memories: [],
      set: (p) => set(p),
      del: (ids) => {
        const d = { ...get().deleted }
        ids.forEach((id) => (d[id] = Date.now()))
        set({ deleted: d })
      },
      recover: (ids) => {
        const d = { ...get().deleted }
        ids.forEach((id) => delete d[id])
        set({ deleted: d })
      },
      purge: (ids) => {
        const os = useOS.getState()
        os.set({ photos: os.photos.filter((p) => !ids.includes(p.id)) })
        get().recover(ids)
      },
      addToAlbum: (albumId, ids) => set({ albums: get().albums.map((a) => (a.id === albumId ? { ...a, photos: [...a.photos, ...ids.filter((i) => !a.photos.includes(i))] } : a)) }),
      togglePin: (id) => {
        const p = get().pinned
        set({ pinned: p.includes(id) ? p.filter((x) => x !== id) : [...p, id] })
      },
      addSearch: (q) => {
        const t = q.trim()
        if (!t) return
        set({ recentSearches: [t, ...get().recentSearches.filter((x) => x.toLowerCase() !== t.toLowerCase())].slice(0, 8) })
      },
    }),
    { name: 'ios27-photos', partialize: (s) => ({ deleted: s.deleted, albums: s.albums, pinned: s.pinned, recentSearches: s.recentSearches, zoom: s.zoom, cols: s.cols, memories: s.memories }) },
  ),
)

export type Tab = 'library' | 'collections' | 'search'

export interface ViewerState {
  ids: string[]
  index: number
  rect?: { x: number; y: number; w: number; h: number } | null
  sharedAlbumId?: string
  deleted?: boolean
  title?: string
}

interface UIState {
  tab: Tab
  viewer: ViewerState | null
  editor: string | null
  slideshow: { ids: string[]; title: string; autoplay?: boolean } | null
  settings: boolean
  query: string
  syncing: number
  set: (p: Partial<UIState>) => void
}

export const useUI = create<UIState>((set) => ({
  tab: 'library',
  viewer: null,
  editor: null,
  slideshow: null,
  settings: false,
  query: '',
  syncing: 0,
  set: (p) => set(p),
}))

/** Visible library items (not hidden, not deleted), oldest first. */
export function useLibrary(): Photo[] {
  const photos = useOS((s) => s.photos)
  const deleted = usePh((s) => s.deleted)
  return useMemo(() => photos.filter((p) => !p.hidden && !deleted[p.id]).sort((a, b) => a.ts - b.ts), [photos, deleted])
}

export function usePhotoMap(): Map<string, Photo> {
  const photos = useOS((s) => s.photos)
  return useMemo(() => new Map(photos.map((p) => [p.id, p])), [photos])
}

/** Rect of an element relative to the Photos app root, in unscaled screen px. */
export function rectInRoot(el: Element | null): ViewerState['rect'] {
  if (!el) return null
  const root = el.closest('.ph-root') as HTMLElement | null
  if (!root) return null
  const r = el.getBoundingClientRect()
  const rr = root.getBoundingClientRect()
  const s = rr.width / root.offsetWidth || 1
  return { x: (r.left - rr.left) / s, y: (r.top - rr.top) / s, w: r.width / s, h: r.height / s }
}

export function openViewer(ids: string[], id: string, from?: Element | null, extra: Partial<ViewerState> = {}) {
  const index = Math.max(0, ids.indexOf(id))
  useUI.getState().set({ viewer: { ids, index, rect: rectInRoot(from ?? null), ...extra } })
}

/** Nav API of the Collections stack, so deep links can push pages. */
export const navRefs: { collections?: { push: (el: React.ReactNode) => void; popToRoot: () => void } } = {}
