import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight, Check, X, MapPin, Plus, Clock, CalendarDays, Users, Sparkles } from 'lucide-react'
import { Sheet, openMenu, showAlert } from '../../ui/overlay'
import { List, Row } from '../../ui/list'
import { Avatar, AISparkle, Switch } from '../../ui/controls'
import { useOS } from '../../os/store'
import { parseEvent, parseWhen } from '../../os/ai/parse'
import { CALENDARS } from '../../os/data/life'
import { CONTACTS, contactName } from '../../os/data/people'
import { HOUR, MIN, DAY, startOfDay, WEEKDAYS } from '../../os/time'
import { PLACES } from '../maps/geo'
import { TimeWheels } from '../clock/Wheel'
import { calInfo, fmtT, fmtDayChip, monthName, REPEAT_LABEL, ALERTS, PEOPLE, type Ev, type Repeat } from './util'

export type Draft = Omit<Ev, 'id'> & { id?: string }

export function newDraft(start?: number, allDay = false): Draft {
  const now = Date.now()
  const s = start ?? Math.ceil((now + 15 * MIN) / (30 * MIN)) * 30 * MIN
  return { title: '', start: s, end: s + HOUR, allDay, calendar: 'personal', location: '', notes: '', invitees: [], repeat: 'never', alert: '15 minutes before' }
}

// ------------------------------------------------------------------ inline month date picker
export function DatePickerInline({ value, onChange }: { value: number; onChange: (ts: number) => void }) {
  const [view, setView] = useState(() => { const d = new Date(value); return { y: d.getFullYear(), m: d.getMonth() } })
  const first = new Date(view.y, view.m, 1)
  const days = new Date(view.y, view.m + 1, 0).getDate()
  const sel = startOfDay(value)
  const today = startOfDay()
  const cells: (number | null)[] = [...Array(first.getDay()).fill(null), ...Array.from({ length: days }, (_, i) => new Date(view.y, view.m, i + 1).getTime())]
  const shift = (n: number) => setView((v) => { const d = new Date(v.y, v.m + n, 1); return { y: d.getFullYear(), m: d.getMonth() } })
  return (
    <div className="cal-dp anim-fade">
      <div className="cal-dp-head">
        <span className="t-headline">{monthName(view.m)} {view.y}</span>
        <span className="grow" />
        <button aria-label="Previous month" onClick={() => shift(-1)}><ChevronLeft size={22} /></button>
        <button aria-label="Next month" onClick={() => shift(1)}><ChevronRight size={22} /></button>
      </div>
      <div className="cal-dp-grid">
        {WEEKDAYS.map((w) => <span key={w} className="cal-dp-wd">{w.slice(0, 3).toUpperCase()}</span>)}
        {cells.map((c, i) => c === null ? <span key={i} /> : (
          <button
            key={i}
            className={`cal-dp-day ${c === sel ? 'sel' : ''} ${c === today ? 'today' : ''}`}
            onClick={() => {
              const d = new Date(value)
              const n = new Date(c)
              n.setHours(d.getHours(), d.getMinutes(), 0, 0)
              onChange(n.getTime())
            }}
          >
            {new Date(c).getDate()}
          </button>
        ))}
      </div>
    </div>
  )
}

/** "Starts  [Sep 30, 2026] [2:00 PM]" row with inline expanding pickers. */
function DateTimeRow({ label, value, allDay, open, onOpen, onChange, h24, invalid }: { label: string; value: number; allDay?: boolean; open: 'date' | 'time' | null; onOpen: (w: 'date' | 'time' | null) => void; onChange: (ts: number) => void; h24: boolean; invalid?: boolean }) {
  const d = new Date(value)
  return (
    <>
      <div className="row-item cal-dtrow">
        <span className="row-main"><span className="row-title">{label}</span></span>
        <button className={`cal-chip ${open === 'date' ? 'on' : ''} ${invalid ? 'bad' : ''}`} onClick={() => onOpen(open === 'date' ? null : 'date')}>{fmtDayChip(value)}</button>
        {!allDay && <button className={`cal-chip ${open === 'time' ? 'on' : ''} ${invalid ? 'bad' : ''}`} onClick={() => onOpen(open === 'time' ? null : 'time')}>{fmtT(value, h24)}</button>}
      </div>
      {open === 'date' && <div className="cal-expand"><DatePickerInline value={value} onChange={onChange} /></div>}
      {open === 'time' && !allDay && (
        <div className="cal-expand cal-time-wheels">
          <TimeWheels hour={d.getHours()} minute={d.getMinutes() - (d.getMinutes() % 5)} minuteStep={5} h24={h24} onChange={(h, m) => { const n = new Date(value); n.setHours(h, m, 0, 0); onChange(n.getTime()) }} />
        </div>
      )}
    </>
  )
}

function MenuRow({ title, detail, items, icon }: { title: string; detail: ReactNode; items: { label: string; onSelect: () => void; icon?: ReactNode }[]; icon?: ReactNode }) {
  return (
    <button className="row-item" onClick={(e) => openMenu(e.currentTarget, items)}>
      {icon}
      <span className="row-main"><span className="row-title">{title}</span></span>
      <span className="row-detail cal-menu-detail">{detail} <span className="cal-updown">⌃⌄</span></span>
    </button>
  )
}

// ------------------------------------------------------------------ full editor
export function EventEditor({ open, initial, onClose, onSaved }: { open: boolean; initial: Draft | null; onClose: () => void; onSaved?: (id: string) => void }) {
  const [d, setD] = useState<Draft>(initial ?? newDraft())
  const [picker, setPicker] = useState<{ which: 'start' | 'end'; kind: 'date' | 'time' } | null>(null)
  const [locFocus, setLocFocus] = useState(false)
  const h24 = useOS((s) => s.h24)
  useEffect(() => {
    if (open) {
      setD(initial ?? newDraft())
      setPicker(null)
    }
  }, [open, initial])
  const existing = !!d.id
  const invalid = d.end < d.start
  const locSuggestions = useMemo(() => {
    const q = (d.location ?? '').toLowerCase().trim()
    if (!q) return PLACES.slice(0, 4)
    return PLACES.filter((p) => p.name.toLowerCase().includes(q) || p.address.toLowerCase().includes(q)).slice(0, 4)
  }, [d.location])

  const setStart = (ts: number) => {
    const dur = d.end - d.start
    setD({ ...d, start: ts, end: ts + Math.max(dur, 0) })
  }
  const save = () => {
    const st = useOS.getState()
    let start = d.start
    let end = d.end
    if (d.allDay) {
      start = startOfDay(start)
      end = Math.max(start + DAY - 1, startOfDay(end) + DAY - 1)
    }
    if (end < start) end = start + HOUR
    const payload = { ...d, start, end, title: d.title.trim() || 'New Event' } as Ev
    delete (payload as Draft).id
    let id = d.id
    if (id) st.updateEvent(id, payload)
    else id = st.addEvent(payload)
    st.showToast(existing ? 'Event Updated' : `Added to ${calInfo(d.calendar).name}`)
    onSaved?.(id!)
    onClose()
  }
  const c = calInfo(d.calendar)
  return (
    <Sheet
      open={open}
      onClose={onClose}
      detent="large"
      className="cal-sheet-grouped"
      title={existing ? 'Edit Event' : 'New Event'}
      trailing={<button className="bar-btn icon prominent" aria-label={existing ? 'Done' : 'Add'} onClick={save} disabled={invalid}><Check size={22} strokeWidth={2.8} /></button>}
    >
      <div className="cal-editor">
        <List>
          <div className="row-item"><input className="text-input" placeholder="Title" value={d.title} onChange={(e) => setD({ ...d, title: e.target.value })} aria-label="Title" /></div>
          <div className="row-item">
            <input className="text-input" placeholder="Location or Video Call" value={d.location ?? ''} onFocus={() => setLocFocus(true)} onBlur={() => window.setTimeout(() => setLocFocus(false), 200)} onChange={(e) => setD({ ...d, location: e.target.value })} aria-label="Location" />
          </div>
          {locFocus && locSuggestions.map((p) => (
            <button key={p.id} className="row-item cal-loc-sug" onClick={() => { setD({ ...d, location: p.name }); setLocFocus(false) }}>
              <span className="cal-loc-ico"><MapPin size={15} color="#fff" /></span>
              <span className="row-main"><span className="row-title">{p.name}</span><span className="row-sub">{p.address}, Maple Grove</span></span>
            </button>
          ))}
        </List>
        <List>
          <div className="row-item"><span className="row-main"><span className="row-title">All-day</span></span><Switch checked={!!d.allDay} onChange={(v) => setD({ ...d, allDay: v })} label="All-day" /></div>
          <DateTimeRow label="Starts" value={d.start} allDay={d.allDay} h24={h24} open={picker?.which === 'start' ? picker.kind : null} onOpen={(k) => setPicker(k ? { which: 'start', kind: k } : null)} onChange={setStart} />
          <DateTimeRow label="Ends" value={d.end} allDay={d.allDay} h24={h24} invalid={invalid} open={picker?.which === 'end' ? picker.kind : null} onOpen={(k) => setPicker(k ? { which: 'end', kind: k } : null)} onChange={(ts) => setD({ ...d, end: ts })} />
          <MenuRow title="Repeat" detail={REPEAT_LABEL[d.repeat ?? 'never']} items={(Object.keys(REPEAT_LABEL) as Repeat[]).map((r) => ({ label: REPEAT_LABEL[r], onSelect: () => setD({ ...d, repeat: r }), icon: d.repeat === r ? <Check size={18} /> : undefined }))} />
        </List>
        {invalid && <div className="cal-warn">The start date must be before the end date.</div>}
        <List>
          <MenuRow
            title="Calendar"
            detail={<><span className="cal-dot" style={{ background: c.color }} />{c.name}</>}
            items={CALENDARS.map((x) => ({ label: x.name, onSelect: () => setD({ ...d, calendar: x.id }), icon: <span className="cal-dot" style={{ background: x.color, width: 12, height: 12 }} /> }))}
          />
          <button className="row-item" onClick={(e) => openMenu(e.currentTarget, CONTACTS.filter((x) => !x.isBusiness && !(d.invitees ?? []).includes(x.id)).map((x) => ({ label: contactName(x.id, 'full'), onSelect: () => setD({ ...d, invitees: [...(d.invitees ?? []), x.id] }) })))}>
            <span className="row-main"><span className="row-title">Invitees</span></span>
            <span className="row-detail">{(d.invitees ?? []).length ? `${(d.invitees ?? []).length}` : 'None'}</span>
            <Plus size={18} className="tertiary" />
          </button>
          {(d.invitees ?? []).length > 0 && (
            <div className="row-item cal-inv-row">
              {(d.invitees ?? []).map((p) => (
                <span key={p} className="cal-inv-chip"><Avatar id={p} size={22} />{contactName(p)}<button aria-label={`Remove ${contactName(p)}`} onClick={() => setD({ ...d, invitees: (d.invitees ?? []).filter((x) => x !== p) })}><X size={12} strokeWidth={3} /></button></span>
              ))}
            </div>
          )}
          <MenuRow title="Alert" detail={d.alert ?? 'None'} items={ALERTS.map((a) => ({ label: a, onSelect: () => setD({ ...d, alert: a }), icon: d.alert === a ? <Check size={18} /> : undefined }))} />
        </List>
        <List>
          <div className="row-item"><input className="text-input" placeholder="URL" value={d.url ?? ''} onChange={(e) => setD({ ...d, url: e.target.value })} aria-label="URL" /></div>
          <div className="row-item" style={{ alignItems: 'flex-start' }}><textarea className="text-input" rows={4} placeholder="Notes" value={d.notes ?? ''} onChange={(e) => setD({ ...d, notes: e.target.value })} aria-label="Notes" /></div>
        </List>
        {existing && (
          <List>
            <Row title="Delete Event" destructive onClick={() => showAlert({
              title: 'Are you sure you want to delete this event?',
              actions: [{ label: 'Cancel', style: 'cancel' }, { label: 'Delete Event', style: 'destructive', onPress: () => { useOS.getState().deleteEvent(d.id!); onClose() } }],
            })} />
          </List>
        )}
      </div>
    </Sheet>
  )
}

// ------------------------------------------------------------------ Apple Intelligence quick add
const EXAMPLES = ["Dinner with Sam next Friday at 6:30 at Culver's", "Robotics pizza night Thursday 7pm at Rosa's Trattoria", 'Study with Priya tomorrow from 4 to 5:30pm at the library']

interface Token { start: number; end: number; kind: 'when' | 'where' | 'who' }

function findTokens(text: string, spans: string[], location: string | undefined, invitees: string[]): Token[] {
  const lower = text.toLowerCase()
  const toks: Token[] = []
  const add = (needle: string, kind: Token['kind']) => {
    const n = needle.trim().toLowerCase()
    if (!n) return
    const i = lower.indexOf(n)
    if (i >= 0 && !toks.some((t) => i < t.end && i + n.length > t.start)) toks.push({ start: i, end: i + n.length, kind })
  }
  for (const s of spans) add(s.replace(/^(at|on|by|around)\s/, ''), 'when')
  if (location) add(location, 'where')
  for (const p of invitees) {
    const c = PEOPLE.find((x) => x.id === p)
    c?.names.forEach((n) => add(n, 'who'))
  }
  // relative words that were translated to digits by the parser
  const extra = lower.match(/\b(next|this) (monday|tuesday|wednesday|thursday|friday|saturday|sunday|week)\b|\btomorrow\b|\btonight\b/)
  if (extra) add(extra[0], 'when')
  return toks.sort((a, b) => a.start - b.start)
}

export function QuickAdd({ open, onClose, onMore }: { open: boolean; onClose: () => void; onMore: (d: Draft) => void }) {
  const [text, setText] = useState('')
  const [over, setOver] = useState<Partial<Draft>>({})
  const [picker, setPicker] = useState<null | 'date' | 'time'>(null)
  const h24 = useOS((s) => s.h24)
  const ta = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    if (open) {
      setText('')
      setOver({})
      setPicker(null)
      window.setTimeout(() => ta.current?.focus(), 350)
    }
  }, [open])
  const parsed = useMemo(() => (text.trim().length > 2 ? parseEvent(text, Date.now(), PEOPLE) : null), [text])
  const when = useMemo(() => (text.trim() ? parseWhen(text.replace(/^(add|create|schedule)\s+/i, '')) : null), [text])
  const tokens = useMemo(() => (parsed ? findTokens(text, when?.spans ?? [], parsed.location, parsed.invitees) : []), [parsed, text, when])
  const base: Draft | null = parsed ? { ...newDraft(parsed.start, parsed.allDay), title: parsed.title, start: parsed.start, end: parsed.end, allDay: parsed.allDay, location: parsed.location ?? '', invitees: parsed.invitees } : null
  const draft: Draft | null = base ? { ...base, ...over } : text.trim() ? { ...newDraft(), title: text.trim(), ...over } : null

  const add = () => {
    if (!draft) return
    const st = useOS.getState()
    const payload = { ...draft, title: draft.title || 'New Event', source: undefined } as Ev
    delete (payload as Draft).id
    st.addEvent(payload)
    st.showToast(`Added “${payload.title}”`)
    onClose()
  }

  const segs: ReactNode[] = []
  let last = 0
  tokens.forEach((t, i) => {
    if (t.start > last) segs.push(text.slice(last, t.start))
    segs.push(<mark key={i} className={`cal-tok ${t.kind}`}>{text.slice(t.start, t.end)}</mark>)
    last = t.end
  })
  segs.push(text.slice(last) + '​')
  const c = draft ? calInfo(draft.calendar) : calInfo('personal')

  return (
    <Sheet open={open} onClose={onClose} detent="large" title="New Event" trailing={<button className="bar-btn icon prominent" aria-label="Add event" disabled={!draft} onClick={add}><Check size={22} strokeWidth={2.8} /></button>}>
      <div className="cal-qa">
        <div className={`cal-qa-field ${text ? 'ai-glow' : ''}`}>
          <span className="cal-qa-spark"><AISparkle size={20} /></span>
          <div className="cal-qa-wrap">
            <div className="cal-qa-mirror" aria-hidden>{segs}</div>
            <textarea
              ref={ta}
              className="cal-qa-input"
              rows={2}
              value={text}
              placeholder="Describe your event…"
              onChange={(e) => { setText(e.target.value); setOver({}) }}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); add() } }}
              aria-label="Describe your event"
              data-dictation="Dinner with Sam next Friday at 6:30 at Culver's|Chem study group tomorrow at 4pm at the library"
            />
          </div>
        </div>
        {!text && (
          <div className="cal-qa-examples">
            <div className="t-footnote secondary" style={{ padding: '4px 4px 8px' }}>Type naturally — Apple Intelligence fills in the details.</div>
            {EXAMPLES.map((e) => <button key={e} className="cal-qa-ex" onClick={() => setText(e)}><Sparkles size={14} /> {e}</button>)}
          </div>
        )}
        {tokens.length > 0 && (
          <div className="cal-qa-legend">
            {tokens.some((t) => t.kind === 'when') && <span className="when"><Clock size={12} /> Date & time</span>}
            {tokens.some((t) => t.kind === 'where') && <span className="where"><MapPin size={12} /> Location</span>}
            {tokens.some((t) => t.kind === 'who') && <span className="who"><Users size={12} /> People</span>}
          </div>
        )}
        {draft && (
          <div className="cal-qa-card anim-up">
            <div className="cal-qa-bar" style={{ background: c.color }} />
            <div className="cal-qa-row">
              <input className="text-input cal-qa-title" value={draft.title} onChange={(e) => setOver({ ...over, title: e.target.value })} aria-label="Event title" />
            </div>
            <div className="cal-qa-row">
              <CalendarDays size={18} className="secondary" />
              <button className={`cal-chip ${picker === 'date' ? 'on' : ''}`} onClick={() => setPicker(picker === 'date' ? null : 'date')}>{fmtDayChip(draft.start)}</button>
              {!draft.allDay && <button className={`cal-chip ${picker === 'time' ? 'on' : ''}`} onClick={() => setPicker(picker === 'time' ? null : 'time')}>{fmtT(draft.start, h24)} – {fmtT(draft.end, h24)}</button>}
            </div>
            {picker === 'date' && <DatePickerInline value={draft.start} onChange={(ts) => setOver({ ...over, start: ts, end: ts + (draft.end - draft.start) })} />}
            {picker === 'time' && !draft.allDay && (
              <div className="cal-time-wheels"><TimeWheels hour={new Date(draft.start).getHours()} minute={new Date(draft.start).getMinutes() - (new Date(draft.start).getMinutes() % 5)} minuteStep={5} h24={h24} onChange={(h, m) => { const n = new Date(draft.start); n.setHours(h, m, 0, 0); setOver({ ...over, start: n.getTime(), end: n.getTime() + (draft.end - draft.start) }) }} /></div>
            )}
            <div className="cal-qa-row">
              <MapPin size={18} className="secondary" />
              <input className="text-input" placeholder="Add location" value={draft.location ?? ''} onChange={(e) => setOver({ ...over, location: e.target.value })} aria-label="Location" />
            </div>
            <div className="cal-qa-row" style={{ flexWrap: 'wrap' }}>
              <Users size={18} className="secondary" />
              {(draft.invitees ?? []).map((p) => (
                <span key={p} className="cal-inv-chip"><Avatar id={p} size={22} />{contactName(p)}<button aria-label={`Remove ${contactName(p)}`} onClick={() => setOver({ ...over, invitees: (draft.invitees ?? []).filter((x) => x !== p) })}><X size={12} strokeWidth={3} /></button></span>
              ))}
              <button className="cal-chip" onClick={(e) => openMenu(e.currentTarget, CONTACTS.filter((x) => !x.isBusiness && !(draft.invitees ?? []).includes(x.id)).map((x) => ({ label: contactName(x.id, 'full'), onSelect: () => setOver({ ...over, invitees: [...(draft.invitees ?? []), x.id] }) })))}><Plus size={14} /> Invite</button>
            </div>
            <div className="cal-qa-row">
              <span className="cal-dot" style={{ background: c.color }} />
              <button className="cal-chip" onClick={(e) => openMenu(e.currentTarget, CALENDARS.map((x) => ({ label: x.name, onSelect: () => setOver({ ...over, calendar: x.id }), icon: <span className="cal-dot" style={{ background: x.color, width: 12, height: 12 }} /> })))}>{c.name}</button>
              <span className="grow" />
              <label className="cal-qa-allday">All-day <Switch checked={!!draft.allDay} onChange={(v) => setOver({ ...over, allDay: v })} label="All-day" /></label>
            </div>
          </div>
        )}
        {draft && (
          <div className="row gap8" style={{ padding: '14px 0' }}>
            <button className="btn gray" onClick={() => onMore(draft)}>More Options</button>
            <button className="btn filled grow" onClick={add}>Add to {c.name}</button>
          </div>
        )}
      </div>
    </Sheet>
  )
}
