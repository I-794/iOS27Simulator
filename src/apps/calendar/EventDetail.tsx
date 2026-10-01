import { useState } from 'react'
import { Ellipsis, Navigation, Bell, Repeat as RepeatIcon, Link2, CalendarDays, Trash2, Copy, Share } from 'lucide-react'
import { Page, useNav, BarButton } from '../../ui/nav'
import { Avatar } from '../../ui/controls'
import { showAlert, openMenu } from '../../ui/overlay'
import { useOS } from '../../os/store'
import { useOnscreen } from '../../os/hooks'
import { contactName } from '../../os/data/people'
import { MiniMap } from '../maps/MapView'
import { placeForLocation, HERE, route } from '../maps/geo'
import { EventEditor, type Draft } from './EventEditor'
import { calInfo, fmtT, fmtDayLong, Markdown, REPEAT_LABEL, occurrences, type Ev } from './util'

export function EventDetail({ id, occStart }: { id: string; occStart?: number }) {
  const ev = useOS((s) => s.events.find((e) => e.id === id)) as Ev | undefined
  const events = useOS((s) => s.events) as Ev[]
  const h24 = useOS((s) => s.h24)
  const nav = useNav()
  const [editing, setEditing] = useState<Draft | null>(null)
  useOnscreen('calendar', ev ? `Viewing event ${ev.title}` : undefined, ev ? { type: 'note', title: ev.title, text: `${ev.title} ${fmtDayLong(ev.start)} ${fmtT(ev.start)}${ev.location ? ` at ${ev.location}` : ''}. ${ev.notes ?? ''}` } : undefined)
  if (!ev) {
    return <Page title="Event" large={false}><div className="empty-state"><CalendarDays size={40} /><div className="t-title2">Event Deleted</div></div></Page>
  }
  const start = occStart ?? ev.start
  const end = start + (ev.end - ev.start)
  const c = calInfo(ev.calendar)
  const place = placeForLocation(ev.location)
  const drive = place ? route(HERE, place, 'drive', place.name) : null
  const conflicts = ev.allDay ? [] : occurrences(events.filter((e) => e.id !== ev.id && !e.allDay), start, end)
  const multiDay = new Date(start).toDateString() !== new Date(end).toDateString()
  const del = () => showAlert({
    title: 'Are you sure you want to delete this event?',
    message: ev.source ? `This event is synced from ${ev.source}. Deleting it here removes it from this iPhone only.` : undefined,
    actions: [{ label: 'Cancel', style: 'cancel' }, { label: 'Delete Event', style: 'destructive', onPress: () => { useOS.getState().deleteEvent(ev.id); nav.pop(); useOS.getState().showToast('Event Deleted') } }],
  })
  return (
    <Page
      title=""
      large={false}
      inlineTitle="Event Details"
      grouped
      trailing={
        <>
          <button className="bar-btn icon glass interactive" aria-label="More" onClick={(e) => openMenu(e.currentTarget, [
            { label: 'Duplicate', icon: <Copy size={18} />, onSelect: () => { const { id: _i, ...rest } = ev; void _i; const nid = useOS.getState().addEvent({ ...rest, title: `${ev.title} (copy)` }); useOS.getState().showToast('Event Duplicated'); nav.replaceTop(<EventDetail id={nid} />) } },
            { label: 'Share Event', icon: <Share size={18} />, onSelect: () => useOS.getState().set({ shareRequest: { title: ev.title, kind: 'text', payload: `${ev.title} — ${fmtDayLong(start)} ${fmtT(start)}${ev.location ? ` @ ${ev.location}` : ''}`, app: 'calendar' } }) },
            { label: 'Delete Event', icon: <Trash2 size={18} />, destructive: true, onSelect: del },
          ])}><Ellipsis size={22} /></button>
          <BarButton label="Edit" onClick={() => setEditing({ ...ev, alert: ev.alert ?? '15 minutes before', repeat: ev.repeat ?? 'never' })}>Edit</BarButton>
        </>
      }
    >
      <div className="cal-det anim-fade">
        <div className="cal-det-head">
          <div className="cal-det-title">{ev.title}</div>
          {ev.location && <div className="cal-det-loc">{ev.location}</div>}
          <div className="cal-det-when">
            {ev.allDay ? (
              <>{fmtDayLong(start)}<div className="secondary">All-day</div></>
            ) : multiDay ? (
              <>from {fmtT(start, h24)} {fmtDayLong(start)}<br />to {fmtT(end, h24)} {fmtDayLong(end)}</>
            ) : (
              <>{fmtDayLong(start)}<div>from {fmtT(start, h24)} to {fmtT(end, h24)}</div></>
            )}
            {ev.repeat && ev.repeat !== 'never' && <div className="cal-det-sub"><RepeatIcon size={14} /> {REPEAT_LABEL[ev.repeat]}</div>}
          </div>
          {conflicts.length > 0 && (
            <div className="cal-conflict">Conflicts with “{conflicts[0].ev.title}”{conflicts.length > 1 ? ` and ${conflicts.length - 1} more` : ''}</div>
          )}
        </div>

        {place && (
          <div className="cal-det-map">
            <MiniMap center={place} kind={place.kind} label={place.name} zoom={1.7} style={{ height: 160, borderRadius: 0 }} />
            <div className="cal-det-mapbar">
              <div className="grow">
                <div className="t-subhead bold">{place.name}</div>
                <div className="t-footnote secondary">{place.address}, Maple Grove</div>
              </div>
              <button className="btn small filled" onClick={() => useOS.getState().launch('maps', { route: `route/${place.id}` })}>
                <Navigation size={14} fill="#fff" strokeWidth={0} /> {drive ? `${drive.minutes} min` : 'Directions'}
              </button>
            </div>
          </div>
        )}

        <div className="list">
          <div className="row-item">
            <span className="row-main"><span className="row-title">Calendar</span></span>
            <span className="row-detail"><span className="cal-dot" style={{ background: c.color }} /> {c.name}</span>
          </div>
          <div className="row-item">
            <span className="row-main"><span className="row-title">Alert</span></span>
            <span className="row-detail"><Bell size={14} style={{ verticalAlign: -2 }} /> {ev.alert ?? '15 minutes before'}</span>
          </div>
          {ev.url && (
            <button className="row-item" onClick={() => useOS.getState().launch('safari', { route: `url/${ev.url}` })}>
              <span className="row-main"><span className="row-title">URL</span></span>
              <span className="row-detail accent"><Link2 size={14} style={{ verticalAlign: -2 }} /> {ev.url}</span>
            </button>
          )}
        </div>

        {(ev.invitees?.length ?? 0) > 0 && (
          <>
            <div className="list-header">Invitees</div>
            <div className="list">
              <div className="row-item cal-det-invhead">
                <div className="cal-avatars">
                  <Avatar id="me" size={32} />
                  {ev.invitees!.map((p) => <Avatar key={p} id={p} size={32} />)}
                </div>
                <span className="t-footnote secondary">{ev.invitees!.length + 1} people · {ev.invitees!.length} accepted</span>
              </div>
              <div className="row-item"><Avatar id="me" size={30} /><span className="row-main"><span className="row-title">Jamie Park</span><span className="row-sub">Organizer</span></span></div>
              {ev.invitees!.map((p) => (
                <button key={p} className="row-item" onClick={() => useOS.getState().launch('messages', { route: `conv/c-${p}` })}>
                  <Avatar id={p} size={30} />
                  <span className="row-main"><span className="row-title">{contactName(p, 'full')}</span><span className="row-sub">Accepted</span></span>
                  <span className="cal-accepted">✓</span>
                </button>
              ))}
            </div>
          </>
        )}

        {ev.notes && (
          <>
            <div className="list-header">Notes</div>
            <div className={`list cal-notes ${ev.source ? 'third-party' : ''}`}>
              {ev.source && <div className="cal-notes-src" style={{ '--cal': c.color } as React.CSSProperties}><span className="cal-dot" style={{ background: c.color }} />{ev.source}</div>}
              <Markdown text={ev.notes} />
            </div>
          </>
        )}

        <div className="list" style={{ marginTop: 8 }}>
          <button className="row-item destructive" style={{ justifyContent: 'center' }} onClick={del}>Delete Event</button>
        </div>
      </div>
      <EventEditor open={!!editing} initial={editing} onClose={() => setEditing(null)} />
    </Page>
  )
}
