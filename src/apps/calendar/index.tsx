import { useLayoutEffect, useMemo, useRef, useState, useCallback } from 'react'
import { ChevronLeft, List as ListIcon, CalendarDays, Plus, Search, Check, Inbox, CalendarClock, ArrowRightLeft, Trash2, Clock } from 'lucide-react'
import { NavStack, Page, useNav, BarGroup, BarButton } from '../../ui/nav'
import { Avatar, Badge } from '../../ui/controls'
import { Sheet, openMenu, showAlert } from '../../ui/overlay'
import { useOS } from '../../os/store'
import { useAppRoute, useOnscreen } from '../../os/hooks'
import { CALENDARS } from '../../os/data/life'
import { contactName } from '../../os/data/people'
import { DAY, HOUR, MIN, WEEKDAYS, startOfDay } from '../../os/time'
import { springs, animateSpring } from '../../os/spring'
import { DayPage, AgendaRow } from './DayView'
import { EventDetail } from './EventDetail'
import { EventEditor, QuickAdd, type Draft } from './EventEditor'
import { SearchPage } from './SearchPage'
import { calInfo, dayHeader, fmtT, fmtDayLong, monthName, occurrences, useCal, useEvents, isToday } from './util'
import './calendar.css'

export default function CalendarApp() {
  return (
    <div className="app-root cal-root">
      <NavStack root={<Root />} />
    </div>
  )
}

function Root() {
  const nav = useNav()
  const mode = useCal((s) => s.mode)
  const [quick, setQuick] = useState(false)
  const [editor, setEditor] = useState<Draft | null>(null)
  const [sheet, setSheet] = useState<null | 'calendars' | 'inbox'>(null)
  const jump = useRef<(() => void) | null>(null)
  useAppRoute('calendar', (r) => {
    const m = r.match(/^event\/(.+)$/)
    if (m) {
      nav.popToRoot()
      nav.push(<EventDetail id={m[1]} />)
    } else if (r === 'new') setQuick(true)
    else if (r === 'today') { nav.popToRoot(); jump.current?.() }
    else if (r === 'inbox') setSheet('inbox')
  })
  const common = {
    onQuick: () => setQuick(true),
    onSheet: setSheet,
    registerJump: (fn: () => void) => { jump.current = fn },
  }
  return (
    <>
      {mode === 'month' ? <MonthPage {...common} /> : <AgendaPage {...common} />}
      <QuickAdd open={quick} onClose={() => setQuick(false)} onMore={(d) => { setQuick(false); setEditor(d) }} />
      <EventEditor open={!!editor} initial={editor} onClose={() => setEditor(null)} />
      <CalendarsSheet open={sheet === 'calendars'} onClose={() => setSheet(null)} />
      <InboxSheet open={sheet === 'inbox'} onClose={() => setSheet(null)} />
    </>
  )
}

interface CommonProps { onQuick: () => void; onSheet: (s: 'calendars' | 'inbox') => void; registerJump: (fn: () => void) => void }

function BottomBar({ onToday, onSheet }: { onToday: () => void; onSheet: (s: 'calendars' | 'inbox') => void }) {
  const pending = useCal((s) => s.invites.filter((i) => i.status === 'pending').length)
  return (
    <div className="cal-bottombar">
      <button className="cal-pill glass interactive" onClick={onToday}>Today</button>
      <button className="cal-pill glass interactive" onClick={() => onSheet('calendars')}>Calendars</button>
      <button className="cal-pill glass interactive" onClick={() => onSheet('inbox')} aria-label={`Inbox${pending ? `, ${pending} invitations` : ''}`}>
        <Inbox size={20} />{pending > 0 && <span className="cal-badge"><Badge n={pending} /></span>}
      </button>
    </div>
  )
}

// ------------------------------------------------------------------ month view
const monthStart = (m: number) => new Date(Math.floor(m / 12), m % 12, 1).getTime()

function MonthPage({ onQuick, onSheet, registerJump }: CommonProps) {
  const nav = useNav()
  const events = useEvents()
  const hidden = useCal((s) => s.hidden)
  const setCal = useCal((s) => s.set)
  const scrollRef = useRef<HTMLDivElement>(null)
  const refs = useRef(new Map<number, HTMLElement>())
  const t = new Date()
  const base = t.getFullYear() * 12 + t.getMonth()
  const months = useMemo(() => Array.from({ length: 37 }, (_, i) => base - 12 + i), [base])
  const [visible, setVisible] = useState(base)
  const [pulse, setPulse] = useState(0)
  useOnscreen('calendar', 'Calendar month view')

  const dayColors = useMemo(() => {
    const map = new Map<number, string[]>()
    for (const o of occurrences(events, monthStart(base - 12), monthStart(base + 25), hidden)) {
      for (let d = startOfDay(o.start); d < o.end; d = startOfDay(d + DAY + 2 * HOUR)) {
        const arr = map.get(d) ?? []
        const col = calInfo(o.ev.calendar).color
        if (!arr.includes(col)) arr.push(col)
        map.set(d, arr)
        if (o.ev.allDay && d >= startOfDay(o.end)) break
      }
    }
    return map
  }, [events, hidden, base])

  const scrollToMonth = useCallback((m: number, smooth: boolean) => {
    const el = refs.current.get(m)
    const sc = scrollRef.current
    if (!el || !sc) return
    sc.scrollTo({ top: el.offsetTop - 118, behavior: smooth ? 'smooth' : 'auto' })
  }, [])
  useLayoutEffect(() => scrollToMonth(base, false), [base, scrollToMonth])
  const today = () => {
    scrollToMonth(base, true)
    setPulse((p) => p + 1)
  }
  registerJump(today)

  const onScroll = (top: number) => {
    let cur = months[0]
    for (const m of months) {
      const el = refs.current.get(m)
      if (el && el.offsetTop - 140 <= top) cur = m
    }
    if (cur !== visible) setVisible(cur)
  }
  const year = Math.floor(visible / 12)

  return (
    <Page
      title=""
      large={false}
      scrollRef={scrollRef}
      onScroll={onScroll}
      bottomExtra={70}
      leading={
        <button className="bar-btn glass interactive cal-yearbtn" onClick={() => nav.push(<YearPage year={year} onPick={(m) => { nav.pop(); window.setTimeout(() => scrollToMonth(m, true), 380) }} />)}>
          <ChevronLeft size={22} strokeWidth={2.4} /> {year}
        </button>
      }
      trailing={
        <BarGroup>
          <button className="bar-btn icon" aria-label="List view" onClick={() => setCal({ mode: 'list' })}><ListIcon size={21} /></button>
          <button className="bar-btn icon" aria-label="Search" onClick={() => nav.push(<SearchPage />)}><Search size={20} /></button>
          <button className="bar-btn icon" aria-label="Add event" onClick={onQuick}><Plus size={23} /></button>
        </BarGroup>
      }
      header={<div className="cal-wd-sticky">{WEEKDAYS.map((w, i) => <span key={i} className={i === 0 || i === 6 ? 'we' : ''}>{w[0]}</span>)}</div>}
      footer={<BottomBar onToday={today} onSheet={onSheet} />}
    >
      {months.map((m) => {
        const first = new Date(monthStart(m))
        const days = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate()
        const cur = m === base
        return (
          <section key={m} className="cal-month" ref={(el) => { if (el) refs.current.set(m, el) }}>
            <div className="cal-month-title" style={{ paddingLeft: `calc(${first.getDay()} * 100% / 7)` }}>
              <span className={cur ? 'cur' : ''}>{first.getMonth() === 0 || m === months[0] ? `${monthName(first.getMonth())} ${first.getFullYear()}` : monthName(first.getMonth())}</span>
            </div>
            <div className="cal-grid">
              {Array.from({ length: first.getDay() }, (_, i) => <span key={`b${i}`} className="cal-cell blank" />)}
              {Array.from({ length: days }, (_, i) => {
                const ts = new Date(first.getFullYear(), first.getMonth(), i + 1).getTime()
                const colors = dayColors.get(ts) ?? []
                const td = isToday(ts)
                const dow = new Date(ts).getDay()
                return (
                  <button key={i} className={`cal-cell ${td ? 'today' : ''} ${dow === 0 || dow === 6 ? 'we' : ''}`} onClick={() => nav.push(<DayPage date={ts} />)} aria-label={`${fmtDayLong(ts)}${colors.length ? `, ${colors.length} calendars with events` : ''}`}>
                    <span className="cal-num" key={td ? pulse : 0}>{i + 1}</span>
                    <span className="cal-dots">{colors.slice(0, 3).map((c) => <i key={c} style={{ background: c }} />)}</span>
                  </button>
                )
              })}
            </div>
          </section>
        )
      })}
    </Page>
  )
}

function YearPage({ year: y0, onPick }: { year: number; onPick: (m: number) => void }) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const years = [y0 - 1, y0, y0 + 1]
  const refs = useRef(new Map<number, HTMLElement>())
  const now = new Date()
  useLayoutEffect(() => {
    const el = refs.current.get(y0)
    if (el && scrollRef.current) scrollRef.current.scrollTop = el.offsetTop - 110
  }, [y0])
  return (
    <Page title="" large={false} scrollRef={scrollRef} bottomExtra={20}>
      {years.map((y) => (
        <section key={y} ref={(el) => { if (el) refs.current.set(y, el) }} className="cal-year">
          <div className={`cal-year-title ${y === now.getFullYear() ? 'cur' : ''}`}>{y}</div>
          <div className="cal-year-grid">
            {Array.from({ length: 12 }, (_, m) => {
              const first = new Date(y, m, 1)
              const days = new Date(y, m + 1, 0).getDate()
              return (
                <button key={m} className="cal-mini" onClick={() => onPick(y * 12 + m)}>
                  <div className={`cal-mini-t ${y === now.getFullYear() && m === now.getMonth() ? 'cur' : ''}`}>{monthName(m).slice(0, 3)}</div>
                  <div className="cal-mini-g">
                    {Array.from({ length: first.getDay() }, (_, i) => <span key={`b${i}`} />)}
                    {Array.from({ length: days }, (_, i) => <span key={i} className={isToday(new Date(y, m, i + 1).getTime()) ? 'today' : ''}>{i + 1}</span>)}
                  </div>
                </button>
              )
            })}
          </div>
        </section>
      ))}
    </Page>
  )
}

// ------------------------------------------------------------------ list / agenda with multi-select
function AgendaPage({ onQuick, onSheet, registerJump }: CommonProps) {
  const nav = useNav()
  const events = useEvents()
  const hidden = useCal((s) => s.hidden)
  const setCal = useCal((s) => s.set)
  const h24 = useOS((s) => s.h24)
  const [select, setSelect] = useState(false)
  const [sel, setSel] = useState<Set<string>>(new Set())
  const scrollRef = useRef<HTMLDivElement>(null)
  const todayRef = useRef<HTMLDivElement>(null)
  const today0 = startOfDay()
  const occ = occurrences(events, today0 - 14 * DAY, today0 + 120 * DAY, hidden)
  const groups = new Map<number, typeof occ>()
  groups.set(today0, [])
  occ.forEach((o) => { const k = Math.max(startOfDay(o.start), o.ev.allDay ? startOfDay(o.start) : startOfDay(o.start)); groups.set(k, [...(groups.get(k) ?? []), o]) })
  const days = [...groups.keys()].sort((a, b) => a - b)
  useOnscreen('calendar', 'Calendar list view')
  useLayoutEffect(() => {
    if (scrollRef.current && todayRef.current) scrollRef.current.scrollTop = todayRef.current.offsetTop - 110
  }, [])
  const jumpToday = () => {
    if (scrollRef.current && todayRef.current) scrollRef.current.scrollTo({ top: todayRef.current.offsetTop - 110, behavior: 'smooth' })
    if (todayRef.current) animateSpring(todayRef.current, [{ transform: 'scale(1.04)' }, { transform: 'scale(1)' }], springs.island(), { fill: 'none' })
  }
  registerJump(jumpToday)
  const toggle = (id: string) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const ids = [...sel]
  const exit = () => { setSelect(false); setSel(new Set()) }
  const st = useOS.getState
  const shift = (ms: number, label: string) => {
    for (const id of ids) {
      const e = st().events.find((x) => x.id === id)
      if (e) st().updateEvent(id, { start: e.start + ms, end: e.end + ms })
    }
    st().showToast(`${ids.length} event${ids.length === 1 ? '' : 's'} moved ${label}`)
    exit()
  }
  return (
    <Page
      title={select ? '' : 'Upcoming'}
      large={!select}
      inlineTitle={select ? `${sel.size} Selected` : 'Upcoming'}
      scrollRef={scrollRef}
      bottomExtra={70}
      leading={select ? <BarButton label="Cancel" onClick={exit}>Cancel</BarButton> : <BarButton label="Select" onClick={() => setSelect(true)}>Select</BarButton>}
      trailing={select ? (
        <BarButton label="Select All" onClick={() => setSel(sel.size ? new Set() : new Set(occ.filter((o) => o.start >= today0).map((o) => o.ev.id)))}>{sel.size ? 'Deselect' : 'Select All'}</BarButton>
      ) : (
        <BarGroup>
          <button className="bar-btn icon" aria-label="Month view" onClick={() => setCal({ mode: 'month' })}><CalendarDays size={21} /></button>
          <button className="bar-btn icon" aria-label="Search" onClick={() => nav.push(<SearchPage />)}><Search size={20} /></button>
          <button className="bar-btn icon" aria-label="Add event" onClick={onQuick}><Plus size={23} /></button>
        </BarGroup>
      )}
      footer={select ? (
        <div className="cal-bottombar">
          <button className="cal-pill glass interactive" disabled={!sel.size} onClick={(e) => openMenu(e.currentTarget, CALENDARS.map((c) => ({
            label: c.name,
            icon: <span className="cal-dot" style={{ background: c.color, width: 12, height: 12 }} />,
            onSelect: () => { ids.forEach((id) => st().updateEvent(id, { calendar: c.id })); st().showToast(`Moved ${ids.length} to ${c.name}`); exit() },
          })), { title: 'Move to Calendar' })}><ArrowRightLeft size={18} /> Move</button>
          <button className="cal-pill glass interactive" disabled={!sel.size} onClick={(e) => openMenu(e.currentTarget, [
            { label: '15 Minutes Later', icon: <Clock size={18} />, onSelect: () => shift(15 * MIN, '15 min later') },
            { label: '1 Hour Later', icon: <Clock size={18} />, onSelect: () => shift(HOUR, '1 hour later') },
            { label: '1 Hour Earlier', icon: <Clock size={18} />, onSelect: () => shift(-HOUR, '1 hour earlier') },
            { label: 'Next Day', icon: <CalendarClock size={18} />, onSelect: () => shift(DAY, 'to the next day'), separatorBefore: true },
            { label: 'Previous Day', icon: <CalendarClock size={18} />, onSelect: () => shift(-DAY, 'to the previous day') },
            { label: 'Next Week', icon: <CalendarClock size={18} />, onSelect: () => shift(7 * DAY, 'to next week') },
          ], { title: 'Shift Time' })}><Clock size={18} /> Shift</button>
          <button className="cal-pill glass interactive danger" disabled={!sel.size} onClick={() => showAlert({
            title: `Delete ${ids.length} Event${ids.length === 1 ? '' : 's'}?`,
            message: 'This can’t be undone.',
            actions: [{ label: 'Cancel', style: 'cancel' }, { label: 'Delete', style: 'destructive', onPress: () => { ids.forEach((id) => st().deleteEvent(id)); st().showToast(`Deleted ${ids.length} event${ids.length === 1 ? '' : 's'}`); exit() } }],
          })}><Trash2 size={18} /></button>
        </div>
      ) : <BottomBar onToday={jumpToday} onSheet={onSheet} />}
    >
      <div className="cal-agenda">
        {days.map((day) => (
          <div key={day} ref={day === today0 ? todayRef : undefined} className={day < today0 ? 'cal-past' : ''}>
            <div className={`cal-agenda-h ${day === today0 ? 'today' : ''}`}>{dayHeader(day)}</div>
            {groups.get(day)!.length === 0 && <div className="cal-agenda-empty">No Events</div>}
            {groups.get(day)!.map((o) => (
              <AgendaRow key={o.key} o={o} h24={h24} selectMode={select} selected={sel.has(o.ev.id)} onClick={() => (select ? toggle(o.ev.id) : nav.push(<EventDetail id={o.ev.id} occStart={o.start} />))} />
            ))}
          </div>
        ))}
      </div>
    </Page>
  )
}

// ------------------------------------------------------------------ sheets
function CalendarsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const hidden = useCal((s) => s.hidden)
  const set = useCal((s) => s.set)
  const events = useEvents()
  const groups: [string, typeof CALENDARS][] = [
    ['iCloud', CALENDARS.filter((c) => !c.account)],
    ['Shared', CALENDARS.filter((c) => c.account === 'Shared')],
    ['Subscribed', CALENDARS.filter((c) => c.account === 'Subscribed')],
  ]
  return (
    <Sheet open={open} onClose={onClose} title="Calendars" detent="large" className="cal-sheet-grouped" trailing={<button className="bar-btn icon prominent" aria-label="Done" onClick={onClose}><Check size={22} strokeWidth={2.8} /></button>}>
      {groups.map(([name, cals]) => (
        <section key={name}>
          <div className="list-header">{name.toUpperCase()}</div>
          <div className="list">
            {cals.map((c) => {
              const on = !hidden.includes(c.id)
              const n = events.filter((e) => e.calendar === c.id).length
              return (
                <button key={c.id} className="row-item" onClick={() => set({ hidden: on ? [...hidden, c.id] : hidden.filter((x) => x !== c.id) })} aria-pressed={on}>
                  <span className={`cal-toggle ${on ? 'on' : ''}`} style={{ '--c': c.color } as React.CSSProperties}>{on && <Check size={14} strokeWidth={3.4} color="#fff" />}</span>
                  <span className="row-main"><span className="row-title">{c.name}</span><span className="row-sub">{n} event{n === 1 ? '' : 's'}{c.id === 'robotics' ? ' · Circuit Breakers team calendar' : c.id === 'family' ? ' · Shared with Mom, Dad, Mia' : ''}</span></span>
                </button>
              )
            })}
          </div>
        </section>
      ))}
      <div className="row gap8" style={{ padding: '4px 16px 20px', justifyContent: 'center' }}>
        <button className="btn gray small" onClick={() => set({ hidden: [] })}>Show All</button>
        <button className="btn gray small" onClick={() => set({ hidden: CALENDARS.map((c) => c.id) })}>Hide All</button>
      </div>
    </Sheet>
  )
}

function InboxSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const invites = useCal((s) => s.invites)
  const set = useCal((s) => s.set)
  const h24 = useOS((s) => s.h24)
  const respond = (id: string, status: 'accepted' | 'maybe' | 'declined') => {
    const inv = invites.find((i) => i.id === id)!
    const st = useOS.getState()
    const eventId = status !== 'declined' ? st.addEvent({ title: inv.title, start: inv.start, end: inv.end, location: inv.location, calendar: inv.calendar, invitees: [inv.from], notes: inv.notes }) : undefined
    set({ invites: invites.map((i) => (i.id === id ? { ...i, status, eventId } : i)) })
    st.showToast(status === 'accepted' ? `Accepted “${inv.title}”` : status === 'maybe' ? 'Replied Maybe' : 'Declined')
  }
  const pending = invites.filter((i) => i.status === 'pending')
  const replied = invites.filter((i) => i.status !== 'pending')
  return (
    <Sheet open={open} onClose={onClose} title="Inbox" detent="large">
      {pending.length === 0 && <div className="empty-state"><Inbox size={40} /><div className="t-title2">No New Invitations</div></div>}
      {pending.map((i) => (
        <div key={i.id} className="cal-invite anim-up" style={{ '--c': calInfo(i.calendar).color } as React.CSSProperties}>
          <div className="row gap12">
            <Avatar id={i.from} size={40} />
            <div className="grow">
              <div className="t-headline">{i.title}</div>
              <div className="t-subhead secondary">{contactName(i.from, 'full')} invited you</div>
            </div>
          </div>
          <div className="cal-invite-when">{dayHeader(i.start)} · {fmtT(i.start, h24)} – {fmtT(i.end, h24)}<br /><span className="secondary">{i.location}</span></div>
          {i.notes && <div className="t-subhead" style={{ marginTop: 6 }}>{i.notes}</div>}
          <div className="cal-invite-actions">
            <button className="btn small tinted" onClick={() => respond(i.id, 'accepted')}>Accept</button>
            <button className="btn small gray" onClick={() => respond(i.id, 'maybe')}>Maybe</button>
            <button className="btn small destructive" onClick={() => respond(i.id, 'declined')}>Decline</button>
          </div>
        </div>
      ))}
      {replied.length > 0 && (
        <>
          <div className="list-header">REPLIED</div>
          <div className="list">
            {replied.map((i) => (
              <div key={i.id} className="row-item">
                <span className="row-main"><span className="row-title">{i.title}</span><span className="row-sub">{i.status === 'accepted' ? 'Accepted' : i.status === 'maybe' ? 'Maybe' : 'Declined'} · {contactName(i.from)}</span></span>
                <button className="btn small gray" onClick={() => { if (i.eventId) useOS.getState().deleteEvent(i.eventId); set({ invites: invites.map((x) => (x.id === i.id ? { ...x, status: 'pending', eventId: undefined } : x)) }) }}>Change</button>
              </div>
            ))}
          </div>
        </>
      )}
    </Sheet>
  )
}

