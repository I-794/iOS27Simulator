import { useMemo } from 'react'
import type { Photo, SharedAlbum } from '../../os/types'
import { useOS } from '../../os/store'
import { PEOPLE_AND_PETS } from '../../os/data/photos'
import { searchPhotos } from '../../os/search'
import { contactName } from '../../os/data/people'
import { WEEKDAYS, startOfDay, DAY } from '../../os/time'
import { usePh, useLibrary, type Memory, type UserAlbum } from './pstore'
import { fmtShortDate, isEdited } from './look'

export interface CollectionInfo {
  id: string
  title: string
  photos: Photo[]
  kind: 'plain' | 'album' | 'shared' | 'hidden' | 'deleted' | 'ids' | 'duplicates' | 'person' | 'memory' | 'day'
  subtitle?: string
  album?: UserAlbum
  shared?: SharedAlbum
}

export const MEDIA_TYPES = [
  { id: 'videos', title: 'Videos' },
  { id: 'selfies', title: 'Selfies' },
  { id: 'portrait', title: 'Portrait' },
  { id: 'panoramas', title: 'Panoramas' },
  { id: 'screenshots', title: 'Screenshots' },
  { id: 'edited', title: 'Edited' },
] as const

export function personName(id: string) {
  return PEOPLE_AND_PETS.find((x) => x.id === id)?.name ?? contactName(id, 'full')
}

export function dayLabelFor(ts: number) {
  const diff = Math.round((startOfDay() - startOfDay(ts)) / DAY)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  if (diff < 7) return WEEKDAYS[new Date(ts).getDay()]
  return fmtShortDate(ts)
}

export function builtinMemories(lib: Photo[]): Memory[] {
  const pick = (f: (p: Photo) => boolean) => lib.filter(f).map((p) => p.id)
  const out: Memory[] = [
    { id: 'm-biscuit', title: 'Biscuit Through the Years', subtitle: 'Pet Memory', photos: pick((p) => !!p.pets?.includes('Biscuit')), theme: 'kenburns', track: 't5' },
    { id: 'm-pelican', title: 'Golden Hour at Pelican Cove', subtitle: 'Summer', photos: pick((p) => p.place === 'Pelican Cove Beach' || p.keywords.includes('sunset')), theme: 'classic', track: 't1' },
    { id: 'm-robotics', title: 'Circuit Breakers Season', subtitle: 'Robotics 2026', photos: pick((p) => p.keywords.includes('robotics') || p.keywords.includes('robot')), theme: 'origami', track: 't4' },
    { id: 'm-food', title: 'Food Adventures', subtitle: 'Past Months', photos: pick((p) => p.keywords.includes('food') || p.keywords.includes('coffee')), theme: 'origami', track: 't11' },
    { id: 'm-trips', title: 'Summer Trips', subtitle: 'Travel', photos: pick((p) => ['mountains', 'canyon', 'lighthouse', 'bridge', 'waterfall', 'stars'].some((k) => p.keywords.includes(k))), theme: 'kenburns', track: 't6' },
  ]
  return out.filter((m) => m.photos.length >= 2)
}

/** Duplicate groups: 2+ still photos of the same scene. */
export function duplicateGroups(lib: Photo[]): Photo[][] {
  const m = new Map<string, Photo[]>()
  for (const p of lib) {
    if (p.kind === 'video' || p.idDocument) continue
    const k = `${p.scene}`
    if (!m.has(k)) m.set(k, [])
    m.get(k)!.push(p)
  }
  return [...m.values()].filter((g) => g.length > 1)
}

/** Natural-language + metadata photo search (iOS 27). */
export function photoSearch(q: string, lib: Photo[]): Photo[] {
  const t = q.trim().toLowerCase()
  if (!t) return []
  const ok = new Set(lib.map((p) => p.id))
  const byId = new Map(lib.map((p) => [p.id, p]))
  const res = new Map<string, Photo>()
  try {
    for (const p of searchPhotos(q)) if (ok.has(p.id)) res.set(p.id, byId.get(p.id)!)
  } catch {
    /* index errors are non-fatal */
  }
  // metadata: camera / lens / place / ISO / aperture / edited / kinds
  const lensWords: [RegExp, (p: Photo) => boolean][] = [
    [/ultra ?wide|0?\.5x|13 ?mm/, (p) => /ultra wide|13 mm/i.test(p.lens ?? '')],
    [/telephoto|5x|120 ?mm|zoom/, (p) => /telephoto|120 mm/i.test(p.lens ?? '')],
    [/front camera|selfie/, (p) => /front/i.test(p.lens ?? '') || p.keywords.includes('selfie')],
    [/\bmain camera|24 ?mm|wide camera/, (p) => /main camera/i.test(p.lens ?? '')],
    [/48 ?mm|2x/, (p) => /48 mm/i.test(p.lens ?? '')],
    [/proraw|raw/, (p) => /raw/i.test(p.camera ?? '') || p.keywords.includes('proraw')],
    [/iphone( 17)? pro|iphone/, (p) => /iphone/i.test(p.camera ?? '')],
    [/edited|clean ?up|extended|reframed/, (p) => isEdited(p)],
    [/portrait mode|\bportraits?\b/, (p) => p.kind === 'portrait'],
    [/panorama|pano/, (p) => p.kind === 'panorama'],
    [/captured by me|i took|my photos/, (p) => p.capturedByMe],
    [/shared with me|from others|not mine/, (p) => !p.capturedByMe],
    [/\bid\b|identity|document|license|permit/, (p) => !!p.idDocument],
  ]
  const matched = lensWords.filter(([re]) => re.test(t))
  if (matched.length) {
    const filtered = lib.filter((p) => matched.every(([, f]) => f(p)))
    let residual = t
    matched.forEach(([re]) => (residual = residual.replace(re, ' ')))
    residual = residual.replace(/\b(photos?|pictures?|shots?|on|with|the|taken|from|by|of|my|a|camera|lens)\b/g, ' ').trim()
    const inter = residual && res.size ? filtered.filter((p) => res.has(p.id)) : []
    const pick = inter.length ? inter : filtered
    res.clear()
    pick.forEach((p) => res.set(p.id, p))
  }
  const iso = t.match(/iso\s*(\d+)/)
  if (iso) lib.filter((p) => (p.iso ?? 0) >= +iso[1]).forEach((p) => res.set(p.id, p))
  const ap = t.match(/[fƒ]\s*\/?\s*(\d(?:\.\d+)?)/)
  if (ap) lib.filter((p) => (p.aperture ?? '').includes(ap[1])).forEach((p) => res.set(p.id, p))
  for (const p of lib) {
    if (p.place && t.length > 3 && p.place.toLowerCase().includes(t)) res.set(p.id, p)
    if (p.keywords.some((k) => k === t)) res.set(p.id, p)
  }
  return refine(t, [...res.values()], lib).sort((a, b) => b.ts - a.ts)
}

const STOP = new Set(['at', 'the', 'in', 'on', 'of', 'with', 'from', 'my', 'photos', 'photo', 'pictures', 'picture', 'show', 'find', 'and', 'a', 'an', 'to', 'for', 'during', 'while', 'near', 'by', 'taken', 'shot', 'pics', 'pic', 'all', 'any', 'some'])

/** Tighten natural-language results: named people/pets are required, and descriptive words narrow further when possible. */
function refine(t: string, results: Photo[], lib: Photo[]): Photo[] {
  const words = t.split(/[^a-z0-9']+/).filter(Boolean)
  const ents = PEOPLE_AND_PETS.filter((x) => x.id !== 'me' && words.some((w) => w === x.id.toLowerCase() || w === x.name.split(' ')[0].toLowerCase()))
  let out = results
  if (ents.length) {
    const has = (p: Photo) => ents.every((x) => p.people?.includes(x.id) || p.pets?.includes(x.id))
    out = results.filter(has)
    if (!out.length) out = lib.filter(has)
  }
  const entWords = new Set(ents.flatMap((x) => [x.id.toLowerCase(), x.name.split(' ')[0].toLowerCase()]))
  const rest = words.filter((w) => w.length > 2 && !STOP.has(w) && !entWords.has(w))
  if (rest.length && out.length > 1) {
    const stem = (w: string) => w.replace(/(ing|es|s)$/, '')
    const hit = (p: Photo, w: string) => {
      const hay = `${p.keywords.join(' ')} ${p.description} ${p.place ?? ''}`.toLowerCase()
      return hay.includes(w) || hay.includes(stem(w))
    }
    const strict = out.filter((p) => rest.every((w) => hit(p, w)))
    if (strict.length) out = strict
  }
  return out
}

export function useCollection(cid: string): CollectionInfo {
  const lib = useLibrary()
  const all = useOS((s) => s.photos)
  const shared = useOS((s) => s.sharedAlbums)
  const deleted = usePh((s) => s.deleted)
  const albums = usePh((s) => s.albums)
  const memories = usePh((s) => s.memories)
  return useMemo(() => resolveCollection(cid, lib, all, shared, deleted, albums, memories), [cid, lib, all, shared, deleted, albums, memories])
}

export function resolveCollection(cid: string, lib: Photo[], all: Photo[], shared: SharedAlbum[], deleted: Record<string, number>, albums: UserAlbum[], memories: Memory[]): CollectionInfo {
  const byId = new Map(all.map((p) => [p.id, p]))
  const ids = (xs: string[]) => xs.map((i) => byId.get(i)).filter((p): p is Photo => !!p && !deleted[p.id] && !p.hidden)
  const [kind, arg] = cid.includes(':') ? [cid.slice(0, cid.indexOf(':')), cid.slice(cid.indexOf(':') + 1)] : [cid, '']
  switch (kind) {
    case 'favorites': return { id: cid, title: 'Favorites', photos: lib.filter((p) => p.favorite), kind: 'plain' }
    case 'captured': return { id: cid, title: 'Captured by Me', subtitle: 'Photos and videos taken on this iPhone', photos: lib.filter((p) => p.capturedByMe && p.kind !== 'screenshot'), kind: 'plain' }
    case 'recents': return { id: cid, title: 'Recently Saved', photos: [...lib].sort((a, b) => b.ts - a.ts).slice(0, 30).reverse(), kind: 'plain' }
    case 'videos': return { id: cid, title: 'Videos', photos: lib.filter((p) => p.kind === 'video'), kind: 'plain' }
    case 'selfies': return { id: cid, title: 'Selfies', photos: lib.filter((p) => p.keywords.includes('selfie') || /front/i.test(p.lens ?? '')), kind: 'plain' }
    case 'portrait': return { id: cid, title: 'Portrait', photos: lib.filter((p) => p.kind === 'portrait'), kind: 'plain' }
    case 'panoramas': return { id: cid, title: 'Panoramas', photos: lib.filter((p) => p.kind === 'panorama'), kind: 'plain' }
    case 'screenshots': return { id: cid, title: 'Screenshots', photos: lib.filter((p) => p.kind === 'screenshot' && !p.idDocument), kind: 'plain' }
    case 'edited': return { id: cid, title: 'Edited', photos: lib.filter(isEdited), kind: 'plain' }
    case 'ids': return { id: cid, title: 'Identity Documents', subtitle: 'IDs, licenses and passports are detected automatically and kept private', photos: lib.filter((p) => p.idDocument), kind: 'ids' }
    case 'hidden': return { id: cid, title: 'Hidden', photos: all.filter((p) => p.hidden && !deleted[p.id]).sort((a, b) => a.ts - b.ts), kind: 'hidden' }
    case 'deleted': return { id: cid, title: 'Recently Deleted', photos: all.filter((p) => deleted[p.id]).sort((a, b) => deleted[a.id] - deleted[b.id]), kind: 'deleted' }
    case 'duplicates': return { id: cid, title: 'Duplicates', photos: duplicateGroups(lib).flat(), kind: 'duplicates' }
    case 'album': {
      const a = albums.find((x) => x.id === arg)
      return { id: cid, title: a?.name ?? 'Album', photos: ids(a?.photos ?? []), kind: 'album', album: a }
    }
    case 'shared': {
      const a = shared.find((x) => x.id === arg)
      return { id: cid, title: a?.name ?? 'Shared Album', photos: (a?.photos ?? []).map((i) => byId.get(i)).filter((p): p is Photo => !!p), kind: 'shared', shared: a }
    }
    case 'people': {
      const photos = lib.filter((p) => p.people?.includes(arg) || p.pets?.includes(arg))
      return { id: cid, title: personName(arg), photos, kind: 'person', subtitle: `${photos.length} items` }
    }
    case 'memory': {
      const m = [...builtinMemories(lib), ...memories].find((x) => x.id === arg)
      return { id: cid, title: m?.title ?? 'Memory', photos: ids(m?.photos ?? []), kind: 'memory', subtitle: m?.subtitle }
    }
    case 'day': {
      const d = +arg
      return { id: cid, title: dayLabelFor(d), photos: lib.filter((p) => p.ts >= d && p.ts < d + DAY), kind: 'day', subtitle: fmtShortDate(d) }
    }
    default:
      return { id: cid, title: 'Collection', photos: [], kind: 'plain' }
  }
}

export const PINNABLE: { id: string; title: string }[] = [
  { id: 'favorites', title: 'Favorites' },
  { id: 'captured', title: 'Captured by Me' },
  { id: 'recents', title: 'Recently Saved' },
  { id: 'videos', title: 'Videos' },
  { id: 'screenshots', title: 'Screenshots' },
  { id: 'portrait', title: 'Portrait' },
  { id: 'edited', title: 'Edited' },
  { id: 'people:Biscuit', title: 'Biscuit' },
  { id: 'people:Mochi', title: 'Mochi' },
  { id: 'shared:sa-family', title: 'Park Family' },
  { id: 'shared:sa-robotics', title: 'Circuit Breakers 7729' },
  { id: 'album:robotics', title: 'Robotics 2026' },
  { id: 'album:travel', title: 'Summer Trips' },
  { id: 'ids', title: 'Identity Documents' },
  { id: 'duplicates', title: 'Duplicates' },
]
