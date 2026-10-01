import { useState } from 'react'
import { Page, useNav } from '../../ui/nav'
import { SearchField } from '../../ui/controls'
import { useOS } from '../../os/store'
import { DAY, startOfDay } from '../../os/time'
import { EventDetail } from './EventDetail'
import { AgendaRow } from './DayView'
import { occurrences, useEvents, dayHeader } from './util'

export function SearchPage() {
  const [q, setQ] = useState('')
  const nav = useNav()
  const events = useEvents()
  const h24 = useOS((s) => s.h24)
  const l = q.trim().toLowerCase()
  const occ = l
    ? occurrences(events, startOfDay() - 120 * DAY, startOfDay() + 400 * DAY).filter((o) => [o.ev.title, o.ev.location, o.ev.notes].some((x) => x?.toLowerCase().includes(l))).slice(0, 60)
    : []
  const groups = new Map<number, typeof occ>()
  occ.forEach((o) => { const k = startOfDay(o.start); groups.set(k, [...(groups.get(k) ?? []), o]) })
  return (
    <Page title="Search" large={false} inlineTitle="Search">
      <div style={{ padding: '4px 16px 10px' }}><SearchField value={q} onChange={setQ} placeholder="Search events" autoFocus /></div>
      {!l && (
        <div className="cal-sugg">
          {['Robotics', 'Chem', 'Concert', 'Library', 'Mia'].map((s) => <button key={s} className="chip" onClick={() => setQ(s)}>{s}</button>)}
        </div>
      )}
      {l && occ.length === 0 && <div className="empty-state"><div className="t-title2">No Results</div><div>Nothing matches “{q}”.</div></div>}
      <div className="cal-agenda">
        {[...groups.entries()].map(([day, list]) => (
          <div key={day}>
            <div className="cal-agenda-h">{dayHeader(day)}</div>
            {list.map((o) => <AgendaRow key={o.key} o={o} h24={h24} onClick={() => nav.push(<EventDetail id={o.ev.id} occStart={o.start} />)} />)}
          </div>
        ))}
      </div>
    </Page>
  )
}
