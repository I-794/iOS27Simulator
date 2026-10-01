import { Fragment, type ReactNode } from 'react'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { CALENDARS } from '../../os/data/life'
import { CONTACTS } from '../../os/data/people'
import { DAY, MONTHS_SHORT, WEEKDAYS, MONTHS, startOfDay, at, daysUntilWeekday } from '../../os/time'
import { useOS } from '../../os/store'
import type { CalendarEvent } from '../../os/types'

export type Repeat = 'never' | 'daily' | 'weekdays' | 'weekly' | 'biweekly' | 'monthly' | 'yearly'
export type Ev = CalendarEvent & { repeat?: Repeat; alert?: string; url?: string }
export interface Occ { ev: Ev; start: number; end: number; key: string }

export const REPEAT_LABEL: Record<Repeat, string> = { never: 'Never', daily: 'Every Day', weekdays: 'Every Weekday', weekly: 'Every Week', biweekly: 'Every 2 Weeks', monthly: 'Every Month', yearly: 'Every Year' }
export const ALERTS = ['None', 'At time of event', '5 minutes before', '10 minutes before', '15 minutes before', '30 minutes before', '1 hour before', '2 hours before', '1 day before']

export const calInfo = (id: string) => CALENDARS.find((c) => c.id === id) ?? { id, name: id, color: '#8e8e93' }

export const PEOPLE = CONTACTS.filter((c) => !c.isBusiness).map((c) => ({ id: c.id, names: [c.first, ...(c.nickname ? [c.nickname] : [])] }))

export interface Invite { id: string; title: string; from: string; start: number; end: number; location: string; calendar: string; status: 'pending' | 'accepted' | 'maybe' | 'declined'; notes?: string; eventId?: string }

interface CalLocal {
  hidden: string[]
  mode: 'month' | 'list'
  invites: Invite[]
  set: (p: Partial<CalLocal>) => void
}
const thu = daysUntilWeekday(4, false)
export const useCal = create<CalLocal>()(persist((set) => ({
  hidden: [],
  mode: 'month',
  invites: [
    { id: 'inv-pizza', title: 'Robotics Pizza Night 🍕', from: 'alex', start: at(thu + 2, 18, 0), end: at(thu + 2, 20, 0), location: "Rosa's Trattoria", calendar: 'robotics', status: 'pending', notes: 'Celebrating the intake finally working! Bring $10.' },
    { id: 'inv-sectional', title: 'Extra snare sectional', from: 'sam', start: at(thu + 5, 16, 0), end: at(thu + 5, 17, 0), location: 'Band Room', calendar: 'band', status: 'pending' },
  ],
  set: (p) => set(p),
}), { name: 'ios27-calendar', partialize: (s) => ({ hidden: s.hidden, mode: s.mode, invites: s.invites }) }))

/** Expand repeating events into occurrences inside [from, to). */
export function occurrences(events: Ev[], from: number, to: number, hidden: string[] = []): Occ[] {
  const out: Occ[] = []
  for (const ev of events) {
    if (hidden.includes(ev.calendar)) continue
    const dur = Math.max(0, ev.end - ev.start)
    const rep = ev.repeat ?? 'never'
    if (rep === 'never') {
      if (ev.end > from && ev.start < to) out.push({ ev, start: ev.start, end: ev.end, key: ev.id })
      continue
    }
    const d0 = new Date(ev.start)
    for (let i = 0; i < 1200; i++) {
      const d = new Date(d0)
      if (rep === 'daily' || rep === 'weekdays') d.setDate(d0.getDate() + i)
      else if (rep === 'weekly') d.setDate(d0.getDate() + i * 7)
      else if (rep === 'biweekly') d.setDate(d0.getDate() + i * 14)
      else if (rep === 'monthly') d.setMonth(d0.getMonth() + i)
      else d.setFullYear(d0.getFullYear() + i)
      const s = d.getTime()
      if (s >= to) break
      if (rep === 'weekdays' && (d.getDay() === 0 || d.getDay() === 6)) continue
      if (s + dur > from) out.push({ ev, start: s, end: s + dur, key: `${ev.id}@${i}` })
    }
  }
  return out.sort((a, b) => a.start - b.start || b.end - a.end)
}

export function useEvents(): Ev[] {
  return useOS((s) => s.events) as Ev[]
}

export function fmtT(ts: number, h24 = false) {
  const d = new Date(ts)
  if (h24) return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  const h = d.getHours() % 12 || 12
  return `${h}:${String(d.getMinutes()).padStart(2, '0')} ${d.getHours() >= 12 ? 'PM' : 'AM'}`
}
export function fmtHour(h: number, h24 = false) {
  if (h24) return `${String(h % 24).padStart(2, '0')}:00`
  if (h === 12) return 'Noon'
  return `${h % 12 || 12} ${h % 24 >= 12 ? 'PM' : 'AM'}`
}
export const fmtDayLong = (ts: number) => { const d = new Date(ts); return `${WEEKDAYS[d.getDay()]}, ${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}` }
export const fmtDayChip = (ts: number) => { const d = new Date(ts); return `${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}` }
export const monthName = (m: number) => MONTHS[((m % 12) + 12) % 12]
export const isToday = (ts: number) => startOfDay(ts) === startOfDay()

export function dayHeader(ts: number) {
  const diff = Math.round((startOfDay(ts) - startOfDay()) / DAY)
  const d = new Date(ts)
  const base = `${WEEKDAYS[d.getDay()]}, ${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}`
  if (diff === 0) return `Today · ${base}`
  if (diff === 1) return `Tomorrow · ${base}`
  if (diff === -1) return `Yesterday · ${base}`
  return base
}

// ------------------------------------------------------------------ markdown
/** Tiny markdown renderer for third-party calendar notes: **bold**, _italic_, [links](url), bare URLs, "- " bullets. */
function inline(text: string, keyBase: string): ReactNode[] {
  const out: ReactNode[] = []
  const re = /(\*\*([^*]+)\*\*)|(__([^_]+)__)|(\*([^*\n]+)\*)|(_([^_\n]+)_)|(\[([^\]]+)\]\(([^)\s]+)\))|(https?:\/\/[^\s)]+|\b[a-z0-9-]+\.(?:example|com|org)\/[^\s)]*)/gi
  let last = 0
  let m: RegExpExecArray | null
  let i = 0
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index))
    const k = `${keyBase}-${i++}`
    if (m[2] || m[4]) out.push(<strong key={k}>{m[2] ?? m[4]}</strong>)
    else if (m[6] || m[8]) out.push(<em key={k}>{m[6] ?? m[8]}</em>)
    else if (m[10]) out.push(<Link key={k} href={m[11]}>{m[10]}</Link>)
    else if (m[12]) out.push(<Link key={k} href={m[12]}>{m[12]}</Link>)
    last = m.index + m[0].length
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

function Link({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      className="cal-md-link"
      href="#"
      onClick={(e) => {
        e.preventDefault()
        useOS.getState().launch('safari', { route: `url/${href.replace(/^https?:\/\//, '')}` })
      }}
    >
      {children}
    </a>
  )
}

export function Markdown({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}/)
  return (
    <div className="cal-md">
      {blocks.map((b, bi) => {
        const lines = b.split('\n')
        // "Synced from …" provenance line renders as a source footer
        const trimmed = b.trim()
        const src = trimmed.match(/^[_*](Synced from [^_*]+)[_*]$/i)
        if (src) {
          return (
            <div key={bi} className="cal-md-source">
              <span className="cal-md-source-ico">⟲</span>
              <span><em>{src[1]}</em></span>
            </div>
          )
        }
        if (lines.every((l) => /^\s*[-•]\s+/.test(l))) {
          return <ul key={bi}>{lines.map((l, li) => <li key={li}>{inline(l.replace(/^\s*[-•]\s+/, ''), `${bi}-${li}`)}</li>)}</ul>
        }
        return (
          <p key={bi}>
            {lines.map((l, li) => (
              <Fragment key={li}>{li > 0 && <br />}{inline(l, `${bi}-${li}`)}</Fragment>
            ))}
          </p>
        )
      })}
    </div>
  )
}

/** Layout overlapping timed events into columns. */
export function layoutColumns(items: Occ[]): { occ: Occ; col: number; cols: number }[] {
  const sorted = [...items].sort((a, b) => a.start - b.start || b.end - a.end)
  const out: { occ: Occ; col: number; cols: number }[] = []
  let cluster: { occ: Occ; col: number; cols: number }[] = []
  let colsEnd: number[] = []
  let clusterEnd = -Infinity
  const flush = () => {
    const n = colsEnd.length
    cluster.forEach((c) => (c.cols = n))
    out.push(...cluster)
    cluster = []
    colsEnd = []
  }
  for (const o of sorted) {
    if (o.start >= clusterEnd && cluster.length) flush()
    let col = colsEnd.findIndex((e) => e <= o.start)
    if (col === -1) {
      col = colsEnd.length
      colsEnd.push(o.end)
    } else colsEnd[col] = o.end
    cluster.push({ occ: o, col, cols: 1 })
    clusterEnd = Math.max(clusterEnd, o.end)
  }
  flush()
  return out
}
