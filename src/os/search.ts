/* Centralized on-device search index. Every app contributes entities; Spotlight,
 * Siri, Photos, Mail, Messages, Notes and Home search all query it. */
import type { AppId, Photo } from './types'
import { useOS } from './store'
import { CONTACTS, contactName } from './data/people'
import { FILES, SAFARI_SITES, ACCESSORIES } from './data/world'
import { CAMERA_CLIPS, PEOPLE_AND_PETS } from './data/photos'
import { ICONS } from '../icons/AppIconArt'
import { DAY, startOfDay, MONTHS, WEEKDAYS } from './time'

export type EntityType = 'app' | 'contact' | 'message' | 'mail' | 'event' | 'reminder' | 'note' | 'photo' | 'file' | 'setting' | 'camera' | 'web' | 'action' | 'accessory'

export interface Entity {
  id: string
  type: EntityType
  title: string
  subtitle?: string
  text?: string
  keywords?: string[]
  app: AppId
  route?: string
  ts?: number
  ref?: string
  /** photo scene for thumbnails */
  scene?: string
  contact?: string
}

export interface Hit extends Entity {
  score: number
  matched: string[]
}

// ---------------- normalization ----------------
const SYN: Record<string, string[]> = {
  dog: ['puppy', 'pup', 'retriever', 'pet', 'biscuit', 'doggo'],
  cat: ['kitten', 'kitty', 'pet', 'mochi', 'tabby'],
  pet: ['dog', 'cat', 'animal'],
  photo: ['picture', 'pic', 'image', 'shot', 'snapshot'],
  picture: ['photo', 'pic', 'image'],
  meeting: ['meet', 'practice', 'session', 'build'],
  robotics: ['robot', 'robots', 'frc', 'build', 'intake'],
  robot: ['robotics', 'bot'],
  package: ['parcel', 'delivery', 'box', 'delivered', 'courier'],
  delivery: ['package', 'parcel', 'delivered', 'courier'],
  food: ['meal', 'dinner', 'lunch', 'breakfast', 'restaurant', 'pizza', 'ramen'],
  dinner: ['restaurant', 'meal', 'reservation', 'food'],
  flight: ['plane', 'airline', 'trip', 'boarding', 'airport', 'travel'],
  trip: ['flight', 'travel', 'vacation'],
  receipt: ['bill', 'total', 'check', 'invoice'],
  beach: ['ocean', 'sea', 'shore', 'coast', 'waves'],
  storm: ['thunderstorm', 'lightning', 'rain', 'weather'],
  concert: ['band', 'performance', 'show', 'music'],
  band: ['drumline', 'music', 'concert', 'percussion'],
  drum: ['drumline', 'percussion', 'snare'],
  school: ['class', 'lincoln', 'homework', 'test'],
  test: ['exam', 'quiz'],
  chem: ['chemistry'],
  chemistry: ['chem', 'stoichiometry'],
  car: ['vehicle', 'suv', 'driveway'],
  person: ['people', 'someone', 'visitor'],
  id: ['identity', 'license', 'permit', 'document', 'card'],
  document: ['doc', 'pdf', 'file', 'id'],
  screenshot: ['screen', 'capture'],
  video: ['clip', 'movie', 'recording'],
  mom: ['mother', 'dana', 'mum'],
  dad: ['father', 'michael'],
  grandma: ['grandmother', 'helen', 'nana'],
  wifi: ['wi-fi', 'wireless', 'network', 'internet'],
  glass: ['liquid', 'transparency', 'tint', 'translucency', 'clear'],
  bluetooth: ['wireless', 'airpods', 'headphones'],
  password: ['passwords', 'passkey', 'login', 'security'],
  flower: ['flowers', 'sunflower', 'tulips', 'garden', 'plant'],
  plant: ['plants', 'leaf', 'monstera', 'succulent'],
  mountain: ['mountains', 'hike', 'hiking', 'alpine'],
  night: ['dark', 'evening', 'stars'],
}

const STOP = new Set(['the', 'a', 'an', 'of', 'to', 'in', 'on', 'at', 'for', 'my', 'me', 'show', 'find', 'with', 'from', 'and', 'is', 'was', 'when', 'what', 'where', 'did', 'photos', 'photo', 'pictures', 'that', 'this', 'about', 'any', 'all', 'i', 'search'])

export function stem(w: string): string {
  w = w.toLowerCase().replace(/[’']s$/, '').replace(/[^\p{L}\p{N}-]/gu, '')
  if (w.length > 4 && w.endsWith('ies')) return w.slice(0, -3) + 'y'
  if (w.length > 4 && w.endsWith('ing')) return w.slice(0, -3)
  if (w.length > 3 && w.endsWith('ed') && !w.endsWith('eed')) return w.slice(0, -2)
  if (w.length > 3 && w.endsWith('es') && /(ch|sh|x|ss)es$/.test(w)) return w.slice(0, -2)
  if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) return w.slice(0, -1)
  return w
}

export function tokens(s: string, keepStop = false): string[] {
  return s
    .toLowerCase()
    .split(/[^\p{L}\p{N}#-]+/u)
    .filter((w) => w && (keepStop || !STOP.has(w)))
    .map(stem)
}

function expand(tok: string): string[] {
  const out = new Set([tok])
  for (const [k, list] of Object.entries(SYN)) {
    const ks = stem(k)
    if (ks === tok || list.map(stem).includes(tok)) {
      out.add(ks)
      list.forEach((x) => out.add(stem(x)))
    }
  }
  return [...out]
}

// ---------------- time filters ----------------
export function timeFilter(q: string, now = Date.now()): { from: number; to: number; label: string } | null {
  const l = q.toLowerCase()
  const sod = startOfDay(now)
  if (/\btoday\b/.test(l)) return { from: sod, to: sod + DAY, label: 'Today' }
  if (/\byesterday\b/.test(l)) return { from: sod - DAY, to: sod, label: 'Yesterday' }
  if (/\blast week\b|\bthis week\b|\bpast week\b/.test(l)) return { from: sod - 7 * DAY, to: sod + DAY, label: 'Last 7 days' }
  if (/\blast month\b|\bpast month\b/.test(l)) return { from: sod - 31 * DAY, to: sod + DAY, label: 'Last month' }
  if (/\bthis summer\b|\blast summer\b|\bsummer\b/.test(l)) {
    const y = new Date(now).getFullYear()
    return { from: new Date(y, 5, 1).getTime(), to: new Date(y, 8, 22).getTime(), label: 'Summer' }
  }
  const mi = MONTHS.findIndex((m) => l.includes(m.toLowerCase()))
  if (mi >= 0) {
    const y = new Date(now).getFullYear() - (mi > new Date(now).getMonth() ? 1 : 0)
    return { from: new Date(y, mi, 1).getTime(), to: new Date(y, mi + 1, 1).getTime(), label: MONTHS[mi] }
  }
  const wd = WEEKDAYS.findIndex((d) => new RegExp(`\\b(last )?${d.toLowerCase()}\\b`).test(l))
  if (wd >= 0 && /\blast\b/.test(l)) {
    let diff = (new Date(now).getDay() - wd + 7) % 7 || 7
    return { from: sod - diff * DAY, to: sod - diff * DAY + DAY, label: `Last ${WEEKDAYS[wd]}` }
  }
  return null
}

// ---------------- settings index ----------------
export const SETTINGS_INDEX: { title: string; route: string; keywords: string }[] = [
  { title: 'Wi-Fi', route: 'wifi', keywords: 'wifi network internet wireless parknet' },
  { title: 'Bluetooth', route: 'bluetooth', keywords: 'bluetooth airpods headphones power management' },
  { title: 'Cellular', route: 'cellular', keywords: 'cellular mobile data 5g connectivity assist' },
  { title: 'Personal Hotspot', route: 'hotspot', keywords: 'hotspot tethering share internet' },
  { title: 'Battery', route: 'battery', keywords: 'battery health low power insights charging' },
  { title: 'Liquid Glass', route: 'display/glass', keywords: 'liquid glass transparency tint clear tinted translucency appearance' },
  { title: 'Display & Brightness', route: 'display', keywords: 'display brightness dark mode light appearance text size bold true tone night shift' },
  { title: 'Wallpaper', route: 'wallpaper', keywords: 'wallpaper background lock screen home screen' },
  { title: 'Home Screen & App Library', route: 'homescreen', keywords: 'home screen app library icons widgets dark tinted clear' },
  { title: 'Sounds & Haptics', route: 'sounds', keywords: 'sound ringtone volume haptics alarm timer volume' },
  { title: 'Alarm & Timer Volume', route: 'sounds', keywords: 'alarm timer volume independent ringtone' },
  { title: 'Focus', route: 'focus', keywords: 'focus do not disturb sleep study driving' },
  { title: 'Screen Time', route: 'screentime', keywords: 'screen time limits downtime family child allowances schedules ask to browse' },
  { title: 'Family & Child Account', route: 'screentime/family', keywords: 'family child account parental controls communication safety' },
  { title: 'Siri', route: 'siri', keywords: 'siri voice pace expressiveness chatgpt assistant apple intelligence' },
  { title: 'Apple Intelligence & Siri', route: 'siri', keywords: 'apple intelligence ai writing tools image playground' },
  { title: 'Accessibility', route: 'accessibility', keywords: 'accessibility voiceover zoom magnifier captions voice control assistive access' },
  { title: 'VoiceOver', route: 'accessibility/voiceover', keywords: 'voiceover screen reader image descriptions' },
  { title: 'Accessibility Reader', route: 'accessibility/reader', keywords: 'reader text cleanup summaries translation' },
  { title: 'AirPods Pro 3', route: 'airpods', keywords: 'airpods eq equalizer custom eq heart rate noise cancellation' },
  { title: 'Control Center', route: 'controls', keywords: 'control center controls gallery customize' },
  { title: 'Action Button', route: 'action-button', keywords: 'action button silent flashlight camera shortcut' },
  { title: 'Camera', route: 'camera', keywords: 'camera formats grid siri mode low power' },
  { title: 'Photos', route: 'photos', keywords: 'photos icloud priority sync shared albums shuffle' },
  { title: 'Safari', route: 'safari', keywords: 'safari tabs extensions notify me organize topic' },
  { title: 'Messages', route: 'messages', keywords: 'messages imessage smart reply' },
  { title: 'General', route: 'general', keywords: 'general about software update storage' },
  { title: 'Keyboards', route: 'general/keyboard', keywords: 'keyboard multilingual grammar autocorrect punctuation dictation emoji' },
  { title: 'Language & Region', route: 'general/language', keywords: 'language region english variants indigenous' },
  { title: 'iPhone Handoff', route: 'general/handoff', keywords: 'two iphones same phone number switch handoff' },
  { title: 'Feature Availability', route: 'general/availability', keywords: 'regional feature availability languages countries' },
  { title: 'Apple Account', route: 'account', keywords: 'apple account icloud recovery contact recovery key' },
  { title: 'Game Controllers', route: 'games', keywords: 'game controller playstation access game overlay' },
  { title: 'Notifications', route: 'notifications', keywords: 'notifications summaries banners previews' },
  { title: 'Privacy & Security', route: 'privacy', keywords: 'privacy security permissions location camera' },
  { title: 'Emergency SOS', route: 'emergency', keywords: 'emergency sos alerts' },
  { title: 'Wallet & Apple Pay', route: 'wallet', keywords: 'wallet apple pay cards default card express' },
]

// ---------------- index build ----------------
let cache: { key: unknown[]; entities: Entity[] } | null = null

export function buildIndex(): Entity[] {
  const s = useOS.getState()
  const key = [s.conversations, s.mails, s.events, s.reminders, s.notes, s.photos, s.accessories]
  if (cache && cache.key.every((k, i) => k === key[i])) return cache.entities
  const E: Entity[] = []
  for (const [id, spec] of Object.entries(ICONS)) E.push({ id: `app-${id}`, type: 'app', title: spec.name, app: id as AppId, keywords: [id] })
  for (const c of CONTACTS) {
    E.push({ id: `contact-${c.id}`, type: 'contact', title: contactName(c.id, 'full'), subtitle: c.company ?? c.relation ?? c.phones[0], app: 'contacts', route: `contact/${c.id}`, keywords: [c.nickname ?? '', c.relation ?? '', ...c.phones.map((p) => p.replace(/\D/g, '')), ...c.phones, ...c.emails], contact: c.id })
  }
  for (const conv of s.conversations) {
    const name = conv.name ?? conv.participants.map((p) => contactName(p, 'full')).join(', ')
    const nick = conv.participants.map((p) => CONTACTS.find((c) => c.id === p)).flatMap((c) => [c?.nickname ?? '', ...(c?.phones ?? []), ...(c?.phones ?? []).map((p) => p.replace(/\D/g, ''))])
    for (const m of conv.messages) {
      if (!m.text && !m.attachment) continue
      E.push({ id: `msg-${conv.id}-${m.id}`, type: 'message', title: m.from === 'me' ? `You → ${name}` : conv.name ? `${contactName(m.from)} in ${conv.name}` : name, subtitle: m.text ?? (m.attachment?.kind === 'photo' ? 'Photo' : m.attachment?.title ?? 'Attachment'), text: m.text, app: 'messages', route: `conv/${conv.id}/${m.id}`, ts: m.ts, keywords: [name, ...nick], contact: m.from === 'me' ? conv.participants[0] : m.from })
    }
  }
  for (const m of s.mails) {
    E.push({ id: `mail-${m.id}`, type: 'mail', title: m.subject, subtitle: m.from.name, text: m.body, app: 'mail', route: `mail/${m.id}`, ts: m.ts, keywords: [m.from.name, m.from.email, m.category, ...Object.values(m.facts ?? {})] })
  }
  for (const e of s.events) E.push({ id: `event-${e.id}`, type: 'event', title: e.title, subtitle: e.location, text: e.notes, app: 'calendar', route: `event/${e.id}`, ts: e.start, keywords: [e.calendar] })
  for (const r of s.reminders) E.push({ id: `rem-${r.id}`, type: 'reminder', title: r.title, subtitle: r.list, app: 'reminders', route: `list/${r.list}`, ts: r.due, keywords: [r.list, r.done ? 'completed' : 'open'] })
  for (const n of s.notes) {
    const body = n.blocks.map((b) => ('text' in b ? b.text : 'rows' in b ? b.rows.flat().join(' ') : '')).join(' ')
    E.push({ id: `note-${n.id}`, type: 'note', title: n.title, subtitle: body.slice(0, 80), text: body, app: 'notes', route: `note/${n.id}`, ts: n.updated, keywords: [n.folder] })
  }
  for (const p of s.photos) E.push(photoEntity(p))
  for (const f of FILES) E.push({ id: `file-${f.id}`, type: 'file', title: f.name, subtitle: `${f.folder} · ${f.size}`, app: 'files', route: `file/${f.id}`, ts: f.modified, keywords: [f.folder, f.kind] })
  for (const st of SETTINGS_INDEX) E.push({ id: `set-${st.route}-${st.title}`, type: 'setting', title: st.title, subtitle: 'Settings', app: 'settings', route: st.route, keywords: st.keywords.split(' ') })
  for (const c of CAMERA_CLIPS) E.push({ id: `cam-${c.id}`, type: 'camera', title: `${c.camera} — ${c.tags.slice(0, 2).join(', ')}`, subtitle: c.description, text: c.description, app: 'home', route: `clip/${c.id}`, ts: c.ts, keywords: c.tags, scene: c.scene })
  for (const [url, site] of Object.entries(SAFARI_SITES)) if (site.kind !== 'blocked') E.push({ id: `web-${url}`, type: 'web', title: site.title, subtitle: url, app: 'safari', route: `url/${url}`, keywords: [site.topic] })
  for (const a of s.accessories) E.push({ id: `acc-${a.id}`, type: 'accessory', title: a.name, subtitle: `${a.room} · ${a.kind === 'light' ? (a.on ? 'On' : 'Off') : a.kind === 'lock' ? (a.locked ? 'Locked' : 'Unlocked') : a.kind}`, app: 'home', route: `room/${a.room}`, keywords: [a.room, a.kind] })
  void ACCESSORIES
  cache = { key, entities: E }
  return E
}

export function photoEntity(p: Photo): Entity {
  const people = (p.people ?? []).map((id) => PEOPLE_AND_PETS.find((x) => x.id === id)?.name ?? id)
  return {
    id: `photo-${p.id}`,
    type: 'photo',
    title: p.place ?? 'Photo',
    subtitle: p.description,
    text: p.description,
    app: 'photos',
    route: `photo/${p.id}`,
    ts: p.ts,
    scene: p.scene,
    ref: p.id,
    keywords: [...p.keywords, ...people, ...(p.pets ?? []), p.kind, p.place ?? '', p.idDocument ? 'identity document id' : '', p.favorite ? 'favorite' : '', p.rating ? `${p.rating} stars rated` : ''],
  }
}

export function search(query: string, opts: { types?: EntityType[]; limit?: number; entities?: Entity[] } = {}): Hit[] {
  const q = query.trim()
  if (!q) return []
  const tf = timeFilter(q)
  const raw = tokens(q.replace(/\b(today|yesterday|last|this|past|week|month|summer)\b/gi, ' '))
  const qt = raw.length ? raw : tokens(q, true)
  const expanded = qt.map(expand)
  const ents = (opts.entities ?? buildIndex()).filter((e) => !opts.types || opts.types.includes(e.type))
  const now = Date.now()
  const out: Hit[] = []
  for (const e of ents) {
    if (tf && (!e.ts || e.ts < tf.from || e.ts >= tf.to)) continue
    const titleT = tokens(e.title, true)
    const kwT = (e.keywords ?? []).flatMap((k) => tokens(k, true))
    const textT = tokens(`${e.subtitle ?? ''} ${e.text ?? ''}`, true)
    let score = 0
    const matched: string[] = []
    let allMatched = true
    expanded.forEach((variants, i) => {
      let best = 0
      for (const v of variants) {
        const exact = v === qt[i]
        const w = exact ? 1 : 0.7
        if (titleT.includes(v)) best = Math.max(best, 5 * w)
        else if (kwT.includes(v)) best = Math.max(best, 3.5 * w)
        else if (textT.includes(v)) best = Math.max(best, 2 * w)
        else if (v.length >= 2 && titleT.some((t) => t.startsWith(v))) best = Math.max(best, 3 * w)
        else if (v.length >= 3 && kwT.some((t) => t.startsWith(v))) best = Math.max(best, 2 * w)
        else if (v.length >= 3 && textT.some((t) => t.startsWith(v))) best = Math.max(best, 1.2 * w)
        else if (/^\d{4,}$/.test(v) && kwT.some((t) => t.includes(v))) best = Math.max(best, 4 * w)
      }
      if (best === 0) allMatched = false
      else matched.push(qt[i])
      score += best
    })
    if (!score) continue
    if (!allMatched) score *= 0.35
    if (e.type === 'app' && e.title.toLowerCase().startsWith(q.toLowerCase())) score += 20
    if (e.ts) {
      const ageDays = Math.abs(now - e.ts) / DAY
      score += Math.max(0, 2 - ageDays / 15)
    }
    if (tf) score += 1
    out.push({ ...e, score, matched })
  }
  out.sort((a, b) => b.score - a.score)
  return out.slice(0, opts.limit ?? 60)
}

/** Photos-specific semantic search (people/pets, metadata, rating, kind). */
export function searchPhotos(query: string): Photo[] {
  const s = useOS.getState()
  const q = query.toLowerCase()
  let photos = s.photos
  const rating = q.match(/(\d)\s*(\+|or more)?\s*star/)
  if (rating) photos = photos.filter((p) => (p.rating ?? 0) >= +rating[1])
  if (/\bfavorite/.test(q)) photos = photos.filter((p) => p.favorite)
  if (/\bvideo/.test(q)) photos = photos.filter((p) => p.kind === 'video')
  if (/\bscreenshot/.test(q)) photos = photos.filter((p) => p.kind === 'screenshot')
  if (/\bcaptured by me\b|\bi took\b/.test(q)) photos = photos.filter((p) => p.capturedByMe)
  const residual = q.replace(/(\d)\s*(\+|or more)?\s*stars?|favorites?|videos?|screenshots?|captured by me|i took/g, ' ').trim()
  if (!residual || !tokens(residual).length) {
    const tf = timeFilter(q)
    return tf ? photos.filter((p) => p.ts >= tf.from && p.ts < tf.to) : photos
  }
  const ids = new Set(photos.map((p) => p.id))
  const hits = search(residual, { types: ['photo'], limit: 100 })
  return hits.filter((h) => h.ref && ids.has(h.ref) && h.matched.length >= Math.max(1, tokens(residual).length - 1)).map((h) => s.photos.find((p) => p.id === h.ref)!).filter(Boolean)
}
