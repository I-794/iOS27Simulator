/* iOS 27 Call Context: when calling a business, surface relevant info from Mail, Messages and Calendar. */
import { useOS } from '../../os/store'
import { contactById } from '../../os/data/people'
import { at, dayLabel, fmtTime } from '../../os/time'
import type { AppId } from '../../os/types'

export interface CallContextCard {
  heading: string
  kind: 'flight' | 'reservation' | 'order' | 'appointment'
  rows: { label: string; value: string; copy?: boolean }[]
  sources: string[]
  open?: { app: AppId; route?: string; label: string }
}

/** Mail facts store "when" as `${daysFromNow}|HH:MM`. */
function factWhen(v: string): number | undefined {
  const m = v.match(/^(-?\d+)\|(\d{1,2}):(\d{2})$/)
  if (!m) return undefined
  return at(+m[1], +m[2], +m[3])
}

function whenLabel(ts: number) {
  const d = dayLabel(ts)
  return `${d}, ${fmtTime(ts)}`
}

export function callContext(contactId: string): CallContextCard | null {
  const c = contactById(contactId)
  if (!c?.isBusiness) return null
  const st = useOS.getState()
  const mails = st.mails.filter((m) => c.emails.includes(m.from.email) || m.from.name === c.first).sort((a, b) => b.ts - a.ts)
  const withFacts = mails.find((m) => m.facts)
  const f = withFacts?.facts
  const conv = st.conversations.find((x) => x.participants.length === 1 && x.participants[0] === contactId)
  const sources: string[] = []
  if (withFacts) sources.push('Mail')

  if (f?.kind === 'flight') {
    const ev = st.events.find((e) => f.flight && e.title.includes(f.flight))
    if (conv?.messages.some((m) => m.text?.includes(f.confirmation ?? '###'))) sources.push('Messages')
    if (ev) sources.push('Calendar')
    const rows = [
      { label: 'Flight', value: f.flight ?? '' },
      { label: 'Confirmation', value: f.confirmation ?? '', copy: true },
      ...(f.seat ? [{ label: 'Seat', value: f.seat }] : []),
      ...(ev ? [{ label: 'Departs', value: `${new Date(ev.start).toLocaleDateString([], { month: 'short', day: 'numeric' })}, ${fmtTime(ev.start)}` }] : []),
    ]
    return { heading: `Your trip · ${f.flight}`, kind: 'flight', rows, sources, open: { app: 'mail', route: `mail/${withFacts!.id}`, label: 'Show Email' } }
  }
  if (f?.kind === 'reservation') {
    const ts = f.when ? factWhen(f.when) : undefined
    return {
      heading: 'Your reservation',
      kind: 'reservation',
      rows: [
        ...(ts ? [{ label: 'When', value: whenLabel(ts) }] : []),
        ...(f.party ? [{ label: 'Party of', value: f.party }] : []),
        ...(f.name ? [{ label: 'Name', value: f.name }] : []),
      ],
      sources,
      open: { app: 'mail', route: `mail/${withFacts!.id}`, label: 'Show Email' },
    }
  }
  if (f?.kind === 'order') {
    return {
      heading: `Order ${f.order}`,
      kind: 'order',
      rows: [
        { label: 'Order', value: f.order ?? '', copy: true },
        ...(f.tracking ? [{ label: 'Tracking', value: f.tracking, copy: true }] : []),
        ...(f.eta ? [{ label: 'Arrives', value: f.eta }] : []),
      ],
      sources,
      open: { app: 'mail', route: `mail/${withFacts!.id}`, label: 'Show Email' },
    }
  }
  // Appointments: match calendar events at the business address or with the business name
  const street = c.address?.split(',')[0]
  const key = c.first.split(' ').find((w) => w.length > 2 && !/family|the|and/i.test(w))
  const ev = st.events
    .filter((e) => e.end > Date.now())
    .sort((a, b) => a.start - b.start)
    .find((e) => (street && e.location?.includes(street)) || (key && new RegExp(`\\b${key}\\b`, 'i').test(e.title)))
  if (ev) {
    const doc = ev.title.match(/Dr\.\s?\w+/)?.[0]
    return {
      heading: 'Upcoming appointment',
      kind: 'appointment',
      rows: [
        { label: 'When', value: whenLabel(ev.start) },
        ...(doc ? [{ label: 'With', value: doc }] : []),
        ...(ev.location ? [{ label: 'Where', value: ev.location.split(',')[0] }] : []),
      ],
      sources: ['Calendar', ...(mails.length ? ['Mail'] : [])],
      open: { app: 'calendar', route: `event/${ev.id}`, label: 'Show Event' },
    }
  }
  return null
}
