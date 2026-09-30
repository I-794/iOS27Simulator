/* Helpers shared by Contacts, Phone, FaceTime and Messages (all owned by the same app team). */
import type { AppId, Contact } from '../../os/types'
import { useAppRoute } from '../../os/hooks'
import { CONTACTS, ME, contactById } from '../../os/data/people'
import { useOS } from '../../os/store'

export const digits = (s: string) => s.replace(/\D/g, '')

export function fullName(c: Contact | undefined): string {
  if (!c) return 'Unknown'
  if (c.isBusiness) return c.first
  return [c.first, c.last].filter(Boolean).join(' ')
}

/** Name used in lists — nickname for family, otherwise full name. */
export function listName(id: string): string {
  const c = contactById(id)
  if (!c) return id
  return fullName(c)
}

/** Name shown on call screens: family nicknames ("Mom"), otherwise the full name. */
export function callName(id: string): string {
  const c = contactById(id)
  if (!c) return id
  if (c.nickname && ['Mom', 'Dad', 'Grandma'].includes(c.nickname)) return c.nickname
  return fullName(c)
}

export function shortName(id: string): string {
  const c = contactById(id)
  if (!c) return id
  if (c.isBusiness) return c.first
  if (c.nickname && ['Mom', 'Dad', 'Grandma'].includes(c.nickname)) return c.nickname
  return c.first
}

/** Sort key: businesses by name, people by last then first name (iOS default). */
export function sortKey(c: Contact): string {
  return (c.isBusiness ? c.first : `${c.last ?? ''} ${c.first}`).trim().toLowerCase()
}

export function indexLetter(c: Contact): string {
  const k = sortKey(c)[0]?.toUpperCase() ?? '#'
  return /[A-Z]/.test(k) ? k : '#'
}

/** Match a contact by name, nickname, company, email or phone digits ("555 010-3345"). */
export function contactMatches(c: Contact, q: string): boolean {
  const s = q.trim().toLowerCase()
  if (!s) return true
  const d = digits(s)
  if (d.length >= 3 && c.phones.some((p) => digits(p).includes(d))) return true
  const hay = [c.first, c.last, c.nickname, c.company, c.relation, ...c.emails].filter(Boolean).join(' ').toLowerCase()
  return s.split(/\s+/).every((w) => hay.split(/[\s@.,—-]+/).some((h) => h.startsWith(w)) || hay.includes(w))
}

export function searchContacts(q: string): Contact[] {
  return CONTACTS.filter((c) => contactMatches(c, q))
}

export const T9: Record<string, string> = { '2': 'ABC', '3': 'DEF', '4': 'GHI', '5': 'JKL', '6': 'MNO', '7': 'PQRS', '8': 'TUV', '9': 'WXYZ', '0': '+' }

function toT9(s: string): string {
  return s
    .toUpperCase()
    .split('')
    .map((ch) => Object.entries(T9).find(([, l]) => l.includes(ch))?.[0] ?? '')
    .join('')
}

/** Keypad matching: digits in phone numbers, or T9 spelling of names. */
export function keypadMatches(num: string): { c: Contact; phone: string; how: 'number' | 'name' }[] {
  const d = digits(num)
  if (d.length < 2) return []
  const out: { c: Contact; phone: string; how: 'number' | 'name' }[] = []
  for (const c of CONTACTS) {
    const p = c.phones.find((ph) => digits(ph).includes(d))
    if (p) {
      out.push({ c, phone: p, how: 'number' })
      continue
    }
    const names = [c.first, c.last, c.nickname].filter(Boolean) as string[]
    if (names.some((n) => toT9(n.replace(/[^a-z]/gi, '')).startsWith(d))) out.push({ c, phone: c.phones[0], how: 'name' })
  }
  return out
}

export function contactForNumber(num: string): Contact | undefined {
  const d = digits(num)
  if (d.length < 7) return undefined
  return CONTACTS.find((c) => c.phones.some((p) => digits(p).endsWith(d) || d.endsWith(digits(p))))
}

export function fmtPhone(num: string): string {
  const d = digits(num)
  if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`
  if (d.length === 7) return `${d.slice(0, 3)}-${d.slice(3)}`
  if (d.length === 11 && d[0] === '1') return `+1 (${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`
  if (d.length > 3 && d.length < 7) return `${d.slice(0, 3)}-${d.slice(3)}`
  if (d.length > 7 && d.length < 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`
  return num
}

// ---------- cross-app actions ----------
export function messageContact(id: string) {
  const st = useOS.getState()
  const conv = st.ensureConversation([id])
  st.launch('messages', { route: `conv/${conv}` })
}
export function callContact(id: string) {
  useOS.getState().launch('phone', { route: `call/${id}` })
}
export function facetimeContact(id: string) {
  useOS.getState().launch('facetime', { route: `call/${id}` })
}
export function mailContact(id: string) {
  const c = contactById(id)
  useOS.getState().launch('mail', { route: `compose/${c ? `Hi ${c.isBusiness ? 'there' : c.first}` : ''}` })
}
export function shareContact(id: string) {
  const c = id === 'me' ? { first: ME.first, last: ME.last, phones: [ME.phone], emails: [ME.email] } as Contact : contactById(id)
  const text = c ? `${fullName(c)}\n${c.phones.join('\n')}\n${c.emails.join('\n')}` : ''
  useOS.getState().set({ shareRequest: { title: c ? `${fullName(c)}.vcf` : 'Contact', kind: 'file', payload: text, app: 'contacts' } })
}
export function directionsTo(address: string) {
  const places: Record<string, string> = { '84 Birchwood': 'home', '1420 Willow Creek': 'grandma', '218 Main': 'rosas', '55 Elm': 'dentist', '410 Oak': 'brewlab', 'Greenfield': 'mall', 'Library': 'library', 'Lincoln High': 'school' }
  const hit = Object.entries(places).find(([k]) => address.toLowerCase().includes(k.toLowerCase()))
  useOS.getState().launch('maps', hit ? { route: `route/${hit[1]}` } : {})
}

export const MY_CARD = {
  ...ME,
  color: '#5e5ce6',
}

// ---------- deep links ----------
const handledRoutes = new Map<string, number>()
/** useAppRoute, but de-duplicated (StrictMode runs effects twice in development). */
export function useRouteOnce(app: AppId, cb: (route: string) => void) {
  useAppRoute(app, (route) => {
    const nonce = useOS.getState().routeNonce
    const key = `${nonce}:${route}`
    if (handledRoutes.get(app) === hash(key)) return
    handledRoutes.set(app, hash(key))
    cb(route)
  })
}
function hash(s: string) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return h
}
