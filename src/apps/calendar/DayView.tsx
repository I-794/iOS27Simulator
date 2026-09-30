import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { List as ListIcon, CalendarDays, Plus, Search } from 'lucide-react'
import { Page, useNav, BarGroup } from '../../ui/nav'
import { useOS } from '../../os/store'
import { useNow, useDrag, useOnscreen } from '../../os/hooks'
import { DAY, HOUR, MIN, MONTHS, WEEKDAYS, startOfDay } from '../../os/time'
import { springs, animateSpring } from '../../os/spring'
import { EventDetail } from './EventDetail'
import { EventEditor, QuickAdd, newDraft, type Draft } from './EventEditor'
import { calInfo, fmtT, fmtHour, layoutColumns, occurrences, useCal, useEvents, isToday, type Occ } from './util'
import { SearchPage } from './SearchPage'

const HH = 56 // px per hour

export function DayPage({ date: initial }: { date: number }) {
  const [date, setDate] = useState(startOfDay(initial))
  const [listMode, setListMode] = useState(false)
  const [editor, setEditor] = useState<Draft | null>(null)
  const [quick, setQuick] = useState(false)
  const nav = useNav()
  const events = useEvents()
  const hidden = useCal((s) => s.hidden)
  const h24 = useOS((s) => s.h24)
  const scrollRef = useRef<HTMLDivElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  const dayOcc = occurrences(events, date, date + DAY, hidden)
  const allDay = dayOcc.filter((o) => o.ev.allDay || (o.start <= date && o.end >= date + DAY))
  const timed = dayOcc.filter((o) => !allDay.includes(o))
  useOnscreen('calendar', `Calendar day view: ${new Date(date).toDateString()} (${dayOcc.length} events)`)

  // scroll to "now" or first event
  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el || listMode) return
    const first = timed[0]
    const target = isToday(date) ? (Date.now() - date) / HOUR - 1.5 : first ? (first.start - date) / HOUR - 0.5 : 8
    el.scrollTop = Math.max(0, target * HH)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, listMode])

  const go = (next: number, dir: number) => {
    setDate(startOfDay(next))
    const el = bodyRef.current
    if (el) animateSpring(el, [{ transform: `translateX(${dir * 40}%)`, opacity: 0.2 }, { transform: 'translateX(0)', opacity: 1 }], springs.sheet(), { fill: 'none' })
  }
  const swipe = useDrag({
    onStart: (e) => !(e.target as HTMLElement).closest('.cal-block, button'),
    onMove: (dx) => { if (bodyRef.current) bodyRef.current.style.transform = `translateX(${dx * 0.9}px)` },
    onEnd: (dx) => {
      const el = bodyRef.current!
      el.style.transform = ''
      if (Math.abs(dx) > 70) go(date + (dx < 0 ? DAY : -DAY), dx < 0 ? 1 : -1)
      else animateSpring(el, [{ transform: `translateX(${dx}px)` }, { transform: 'translateX(0)' }], springs.snappy(), { fill: 'none' })
    },
  })

  const d = new Date(date)
  return (
    <Page
      title=""
      large={false}
      inlineTitle={MONTHS[d.getMonth()]}
      scrollRef={scrollRef}
      bottomExtra={70}
      trailing={
        <BarGroup>
          <button className="bar-btn icon" aria-label={listMode ? 'Show timeline' : 'Show list'} onClick={() => setListMode(!listMode)}>{listMode ? <CalendarDays size={21} /> : <ListIcon size={21} />}</button>
          <button className="bar-btn icon" aria-label="Search" onClick={() => nav.push(<SearchPage />)}><Search size={20} /></button>
          <button className="bar-btn icon" aria-label="Add event" onClick={() => setQuick(true)}><Plus size={23} /></button>
        </BarGroup>
      }
      header={<WeekStrip date={date} onPick={(t) => go(t, t > date ? 1 : -1)} />}
      footer={
        <div className="cal-bottombar">
          <button className="cal-pill glass interactive" onClick={() => go(startOfDay(), date < startOfDay() ? 1 : -1)}>Today</button>
        </div>
      }
    >
      <div ref={bodyRef} onPointerDown={swipe} className="cal-day-body">
        {allDay.length > 0 && (
          <div className="cal-allday">
            <span className="cal-allday-lbl">all-day</span>
            <div className="grow col gap4">
              {allDay.map((o) => (
                <button key={o.key} className="cal-allday-ev" style={{ '--c': calInfo(o.ev.calendar).color } as React.CSSProperties} onClick={() => nav.push(<EventDetail id={o.ev.id} occStart={o.start} />)}>{o.ev.title}</button>
              ))}
            </div>
          </div>
        )}
        {listMode ? (
          <DayList occ={dayOcc} h24={h24} onOpen={(o) => nav.push(<EventDetail id={o.ev.id} occStart={o.start} />)} />
        ) : (
          <Timeline date={date} occ={timed} h24={h24} onOpen={(o) => nav.push(<EventDetail id={o.ev.id} occStart={o.start} />)} onCreate={(t) => setEditor(newDraft(t))} />
        )}
      </div>
      <EventEditor open={!!editor} initial={editor} onClose={() => setEditor(null)} />
      <QuickAdd open={quick} onClose={() => setQuick(false)} onMore={(dr) => { setQuick(false); setEditor(dr) }} />
    </Page>
  )
}

function WeekStrip({ date, onPick }: { date: number; onPick: (ts: number) => void }) {
  const events = useEvents()
  const hidden = useCal((s) => s.hidden)
  const ref = useRef<HTMLDivElement>(null)
  const d = new Date(date)
  const weekStart = startOfDay(date - d.getDay() * DAY + 3 * HOUR)
  const days = Array.from({ length: 7 }, (_, i) => startOfDay(weekStart + i * DAY + 3 * HOUR))
  const occ = occurrences(events, weekStart, weekStart + 7 * DAY, hidden)
  const drag = useDrag({
    onMove: (dx) => { if (ref.current) ref.current.style.transform = `translateX(${dx}px)` },
    onEnd: (dx) => {
      const el = ref.current!
      el.style.transform = ''
      if (Math.abs(dx) > 50) {
        onPick(startOfDay(date + (dx < 0 ? 7 : -7) * DAY + 3 * HOUR))
        animateSpring(el, [{ transform: `translateX(${dx < 0 ? 60 : -60}%)`, opacity: 0 }, { transform: 'translateX(0)', opacity: 1 }], springs.sheet(), { fill: 'none' })
      } else animateSpring(el, [{ transform: `translateX(${dx}px)` }, { transform: 'translateX(0)' }], springs.snappy(), { fill: 'none' })
    },
  })
  return (
    <div className="cal-weekstrip">
      <div className="cal-ws-days" ref={ref} onPointerDown={drag}>
        {days.map((t, i) => {
          const sel = t === date
          const today = isToday(t)
          const has = occ.some((o) => o.start < t + DAY && o.end > t)
          return (
            <button key={t} className={`cal-ws-day ${sel ? 'sel' : ''} ${today ? 'today' : ''}`} onClick={() => onPick(t)} aria-label={new Date(t).toDateString()}>
              <span className="wd">{WEEKDAYS[i][0]}</span>
              <span className="n">{new Date(t).getDate()}</span>
              <span className={`dot ${has ? 'on' : ''}`} />
            </button>
          )
        })}
      </div>
      <div className="cal-ws-title">{WEEKDAYS[d.getDay()]} — {MONTHS[d.getMonth()]} {d.getDate()}, {d.getFullYear()}</div>
    </div>
  )
}

function Timeline({ date, occ, h24, onOpen, onCreate }: { date: number; occ: Occ[]; h24: boolean; onOpen: (o: Occ) => void; onCreate: (ts: number) => void }) {
  const now = useNow(30_000)
  const today = isToday(date)
  const laid = layoutColumns(occ)
  const nowY = ((now - date) / HOUR) * HH
  const press = useRef<number | undefined>(undefined)
  const [ghost, setGhost] = useState<number | null>(null)
  useEffect(() => () => window.clearTimeout(press.current), [])
  const slotAt = (e: React.PointerEvent | React.MouseEvent) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const scale = r.height / (24 * HH)
    const y = (e.clientY - r.top) / scale
    return date + Math.floor(y / (HH / 2)) * 30 * MIN
  }
  return (
    <div
      className="cal-tl"
      style={{ height: 24 * HH }}
      onPointerDown={(e) => {
        if ((e.target as HTMLElement).closest('.cal-block')) return
        const t = slotAt(e)
        window.clearTimeout(press.current)
        press.current = window.setTimeout(() => { setGhost(t); window.setTimeout(() => { setGhost(null); onCreate(t) }, 260) }, 480)
      }}
      onPointerUp={() => window.clearTimeout(press.current)}
      onPointerLeave={() => window.clearTimeout(press.current)}
      onPointerMove={(e) => { if (e.buttons && Math.abs(e.movementX) + Math.abs(e.movementY) > 2) window.clearTimeout(press.current) }}
      onContextMenu={(e) => { e.preventDefault(); onCreate(slotAt(e)) }}
    >
      {Array.from({ length: 25 }, (_, h) => (
        <div key={h} className="cal-tl-hour" style={{ top: h * HH }}>
          <span className={today && Math.abs(nowY - h * HH) < 14 ? 'hide' : ''}>{h === 24 ? fmtHour(0, h24) : fmtHour(h, h24)}</span>
        </div>
      ))}
      {ghost !== null && <div className="cal-ghost" style={{ top: ((ghost - date) / HOUR) * HH, height: HH }}>New Event</div>}
      <div className="cal-tl-events">
        {laid.map(({ occ: o, col, cols }) => {
          const top = Math.max(0, ((o.start - date) / HOUR) * HH)
          const bottom = Math.min(24 * HH, ((o.end - date) / HOUR) * HH)
          const h = Math.max(22, bottom - top - 2)
          const c = calInfo(o.ev.calendar)
          const short = h < 40
          return (
            <button
              key={o.key}
              className={`cal-block ${short ? 'short' : ''} ${o.end < now ? 'past' : ''}`}
              style={{ top, height: h, left: `calc(${(col / cols) * 100}% + 1px)`, width: `calc(${100 / cols}% - 3px)`, '--c': c.color } as React.CSSProperties}
              onClick={() => onOpen(o)}
            >
              <span className="t">{o.ev.title}</span>
              {!short && <span className="s">{o.ev.location ? `${o.ev.location} · ` : ''}{fmtT(o.start, h24)}</span>}
            </button>
          )
        })}
      </div>
      {today && (
        <div className="cal-now" style={{ top: nowY }}>
          <span className="cal-now-t">{fmtT(now, h24).replace(/ (AM|PM)$/, '')}</span>
          <span className="cal-now-dot" />
        </div>
      )}
    </div>
  )
}

function DayList({ occ, h24, onOpen }: { occ: Occ[]; h24: boolean; onOpen: (o: Occ) => void }) {
  if (!occ.length) return <div className="empty-state"><CalendarDays size={40} /><div className="t-title2">No Events</div><div>Tap + to add one.</div></div>
  return (
    <div className="cal-agenda" style={{ paddingTop: 8 }}>
      {occ.map((o) => <AgendaRow key={o.key} o={o} h24={h24} onClick={() => onOpen(o)} />)}
    </div>
  )
}

export function AgendaRow({ o, h24, onClick, selectMode, selected }: { o: Occ; h24: boolean; onClick: () => void; selectMode?: boolean; selected?: boolean }) {
  const c = calInfo(o.ev.calendar)
  return (
    <button className={`cal-arow ${selected ? 'sel' : ''}`} onClick={onClick} style={{ '--c': c.color } as React.CSSProperties}>
      {selectMode && <span className={`cal-check ${selected ? 'on' : ''}`}>{selected && '✓'}</span>}
      <span className="cal-arow-time">
        {o.ev.allDay ? <span>all-day</span> : <><span>{fmtT(o.start, h24)}</span><span className="secondary">{fmtT(o.end, h24)}</span></>}
      </span>
      <span className="cal-arow-bar" />
      <span className="cal-arow-main">
        <span className="t">{o.ev.title}</span>
        {o.ev.location && <span className="s">{o.ev.location}</span>}
      </span>
    </button>
  )
}
