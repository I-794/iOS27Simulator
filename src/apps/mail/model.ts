import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { useOS } from '../../os/store'
import { CONTACTS } from '../../os/data/people'
import type { MailMessage, CalendarEvent } from '../../os/types'
import { startOfDay, DAY, HOUR, MIN, fmtDate, fmtTime } from '../../os/time'
import { summarize } from '../../os/ai/writing'

export type Box = 'inbox' | 'vip' | 'flagged' | 'drafts' | 'sent' | 'archive' | 'junk' | 'trash' | 'unread' | 'attachments'
export type Category = 'primary' | 'transactions' | 'updates' | 'promotions' | 'all'

export const ME_EMAIL = 'jamie.park@icloud.example'

interface MailLocal {
  vips: string[]
  category: Category
  set: (p: Partial<MailLocal>) => void
}
export const useMailLocal = create<MailLocal>()(
  persist(
    (set) => ({
      vips: ['rthompson@lincoln.example', 'mdelgado@lincoln.example', 'helen.cho@mail.example'],
      category: 'primary',
      set: (p) => set(p),
    }),
    { name: 'ios27-mail', storage: createJSONStorage(() => localStorage), partialize: (s) => ({ vips: s.vips, category: s.category }) as MailLocal },
  ),
)

export const BOX_TITLE: Record<Box, string> = {
  inbox: 'Inbox', vip: 'VIP', flagged: 'Flagged', drafts: 'Drafts', sent: 'Sent', archive: 'Archive', junk: 'Junk', trash: 'Trash', unread: 'Unread', attachments: 'Attachments',
}

export function inBox(m: MailMessage, box: Box, vips: string[]): boolean {
  switch (box) {
    case 'vip': return m.folder === 'inbox' && vips.includes(m.from.email)
    case 'flagged': return !!m.flagged && m.folder !== 'trash'
    case 'unread': return m.unread && m.folder === 'inbox'
    case 'attachments': return !!m.attachments?.length && m.folder !== 'trash' && m.folder !== 'junk'
    default: return m.folder === box
  }
}

export const CATEGORY_META: Record<Exclude<Category, 'all'>, { label: string; color: string }> = {
  primary: { label: 'Primary', color: '#007aff' },
  transactions: { label: 'Transactions', color: '#34c759' },
  updates: { label: 'Updates', color: '#af52de' },
  promotions: { label: 'Promotions', color: '#ff2d55' },
}

/** Priority messages (Apple Intelligence): unread, time-sensitive content. */
export function isPriority(m: MailMessage): boolean {
  return m.folder === 'inbox' && m.unread && !!m.facts && ['reservation', 'event', 'flight'].includes(m.facts.kind)
}

export function contactFor(email: string) {
  return CONTACTS.find((c) => c.emails.includes(email))
}

/** Apple Intelligence-style summary: uses structured facts when available, else sentence extraction. */
export function mailSummary(m: MailMessage): string {
  const f = m.facts
  const when = whenFromFacts(f?.when)
  const at = when ? `${when - Date.now() > 6 * DAY ? fmtDate(when, 'monthDay') : fmtDate(when, 'weekday')} at ${fmtTime(when)}` : ''
  if (f?.kind === 'reservation') return `Your table for ${f.party} at ${m.from.name} is confirmed for ${at}${f.location ? `, ${f.location.split(',')[0]}` : ''}. Call to change plans.`
  if (f?.kind === 'order') return `Order ${f.order} has shipped via Parcel Express and should arrive ${f.eta}. Tracking ${f.tracking}.`
  if (f?.kind === 'flight') return `Flight ${f.flight} from Maple Grove to Seattle is booked for four passengers (confirmation ${f.confirmation}, seat ${f.seat}). Check-in opens 24 hours before.`
  if (f?.kind === 'event' && /robot/i.test(m.subject)) return `The robotics build meeting moves to ${at} in Room 114. Bring laptops, safety glasses and your build log; regionals are five weeks away.`
  if (f?.kind === 'event') return `${f.title} call time is ${at} in the band room; the concert starts an hour later. Black concert attire, percussion loaded by 6:15.`
  const text = m.body
    .replace(/^(hi|hello|dear|hey|team)[^,\n]*,?\s*/i, '')
    .split('\n')
    .map((l) => l.replace(/^[•\-–]\s*/, '').trim())
    .filter(Boolean)
    .map((l) => (/[.!?:]$/.test(l) ? l : l + '.'))
    .join(' ')
  return summarize(text)
}

const cache = new Map<string, string>()
/** Apple Intelligence summary used in place of the plain preview for longer mails. */
export function previewFor(m: MailMessage): { text: string; ai: boolean } {
  if (m.preview) return { text: m.preview, ai: false }
  const body = m.body.replace(/\s+/g, ' ').trim()
  if (body.length < 140 || m.folder === 'sent' || m.folder === 'drafts') return { text: body, ai: false }
  let s = cache.get(m.id)
  if (!s) {
    s = mailSummary(m)
    cache.set(m.id, s)
  }
  return { text: s, ai: true }
}

export function whenFromFacts(when?: string): number | null {
  if (!when) return null
  const [d, hm] = when.split('|')
  const [h, mi] = (hm ?? '9:00').split(':').map(Number)
  return startOfDay() + +d * DAY + h * HOUR + mi * MIN
}

export function findExistingEvent(title: string, start: number): CalendarEvent | undefined {
  const words = title.toLowerCase().split(/\W+/).filter((w) => w.length > 3)
  return useOS.getState().events.find((e) => Math.abs(e.start - start) < 2 * MIN && (words.length === 0 || words.some((w) => e.title.toLowerCase().includes(w))))
}

export function calendarFor(kind?: string, title = ''): string {
  if (/robot/i.test(title)) return 'robotics'
  if (/concert|band/i.test(title)) return 'band'
  if (kind === 'reservation') return 'personal'
  if (kind === 'flight') return 'family'
  return 'personal'
}

export function moveMail(ids: string[], folder: MailMessage['folder']) {
  const st = useOS.getState()
  st.set({ mails: st.mails.map((m) => (ids.includes(m.id) ? { ...m, folder, unread: folder === 'trash' || folder === 'archive' ? false : m.unread } : m)) })
}

export function patchMails(ids: string[], patch: Partial<MailMessage>) {
  const st = useOS.getState()
  st.set({ mails: st.mails.map((m) => (ids.includes(m.id) ? { ...m, ...patch } : m)) })
}

export function deleteForever(ids: string[]) {
  const st = useOS.getState()
  st.set({ mails: st.mails.filter((m) => !ids.includes(m.id)) })
}

export function initialsOf(name: string) {
  return name.replace(/[^\p{L}\s']/gu, '').split(/\s+/).filter(Boolean).map((w) => w[0]).join('').slice(0, 2).toUpperCase() || '?'
}

export function colorFor(s: string) {
  const palette = ['#ff6b6b', '#f7a531', '#34c759', '#30b0c7', '#5e8cff', '#af52de', '#ff2d55', '#a2845e', '#5856d6']
  let h = 0
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return palette[h % palette.length]
}
