import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { CalendarDays, Calendar, Inbox, Flag, Check, List as ListIcon, BookOpen, Cpu, ShoppingCart, Plus, Info, Ellipsis, ChevronRight, Star, Music, Dumbbell, Gift, House, Plane, Repeat, Trash2, FolderInput, CircleCheck, X } from 'lucide-react'
import { NavStack, Page, useNav } from '../../ui/nav'
import { SearchField, AISparkle, Switch } from '../../ui/controls'
import { Sheet, openMenu, showAlert } from '../../ui/overlay'
import { useOS, uid } from '../../os/store'
import { useAppRoute, useOnscreen, useNow, screenScale } from '../../os/hooks'
import { REMINDER_LISTS } from '../../os/data/life'
import { DAY, HOUR, startOfDay } from '../../os/time'
import type { Reminder, ReminderList } from '../../os/types'
import { DatePickerInline } from '../calendar/EventEditor'
import { TimeWheels } from '../clock/Wheel'
import { parseReminderNL, fmtDue, repeatLabel, groceryCategory, type RRepeat } from './nlp'
import './reminders.css'

// ------------------------------------------------------------------ local state
interface Meta { repeat?: RRepeat; hasTime?: boolean; created?: number }
interface RemLocal {
  lists: ReminderList[]
  order: Record<string, string[]>
  sectionOf: Record<string, string>
  sections: Record<string, string[]>
  showCompleted: Record<string, boolean>
  sort: Record<string, 'manual' | 'due' | 'priority' | 'title'>
  meta: Record<string, Meta>
  scheduledGroup: 'list' | 'date'
  set: (p: Partial<RemLocal>) => void
}
const useRem = create<RemLocal>()(persist((set) => ({
  lists: [], order: {}, sectionOf: {}, sections: {}, showCompleted: {}, sort: {}, meta: {}, scheduledGroup: 'list',
  set: (p) => set(p),
}), { name: 'ios27-reminders', partialize: ({ set: _s, ...rest }) => { void _s; return rest } }))

const SMART = {
  today: { name: 'Today', color: '#007aff', icon: 'today' },
  scheduled: { name: 'Scheduled', color: '#ff3b30', icon: 'scheduled' },
  all: { name: 'All', color: '#5b5b61', icon: 'all' },
  flagged: { name: 'Flagged', color: '#ff9500', icon: 'flagged' },
  completed: { name: 'Completed', color: '#8e8e93', icon: 'completed' },
} as const
type SmartId = keyof typeof SMART
const isSmart = (id: string): id is SmartId => id in SMART

const LIST_ICONS: Record<string, (p: { size: number }) => ReactNode> = {
  list: ({ size }) => <ListIcon size={size} strokeWidth={2.6} />,
  book: ({ size }) => <BookOpen size={size} strokeWidth={2.4} />,
  cpu: ({ size }) => <Cpu size={size} strokeWidth={2.4} />,
  cart: ({ size }) => <ShoppingCart size={size} strokeWidth={2.4} />,
  star: ({ size }) => <Star size={size} strokeWidth={2.4} />,
  music: ({ size }) => <Music size={size} strokeWidth={2.4} />,
  gym: ({ size }) => <Dumbbell size={size} strokeWidth={2.4} />,
  gift: ({ size }) => <Gift size={size} strokeWidth={2.4} />,
  house: ({ size }) => <House size={size} strokeWidth={2.4} />,
  plane: ({ size }) => <Plane size={size} strokeWidth={2.4} />,
  today: ({ size }) => <CalendarDays size={size} strokeWidth={2.4} />,
  scheduled: ({ size }) => <Calendar size={size} strokeWidth={2.4} />,
  all: ({ size }) => <Inbox size={size} strokeWidth={2.4} />,
  flagged: ({ size }) => <Flag size={size} strokeWidth={2.4} fill="#fff" />,
  completed: ({ size }) => <Check size={size} strokeWidth={3} />,
}
const COLORS = ['#ff3b30', '#ff9500', '#ffcc00', '#34c759', '#5ac8fa', '#007aff', '#5856d6', '#af52de', '#ff2d55', '#a2845e', '#8e8e93', '#30b0c7']

function useLists(): ReminderList[] {
  const custom = useRem((s) => s.lists)
  return useMemo(() => [...REMINDER_LISTS, ...custom], [custom])
}
const endOfToday = () => startOfDay() + DAY

function ListGlyph({ color, icon, size = 30 }: { color: string; icon: string; size?: number }) {
  const I = LIST_ICONS[icon] ?? LIST_ICONS.list
  return <span className="rem-glyph" style={{ background: color, width: size, height: size }}><I size={size * 0.5} /></span>
}

// ------------------------------------------------------------------ app
export default function RemindersApp() {
  return <div className="app-root rem-root"><NavStack root={<Home />} /></div>
}

function Home() {
  const nav = useNav()
  const reminders = useOS((s) => s.reminders)
  const lists = useLists()
  const [q, setQ] = useState('')
  const [newList, setNewList] = useState(false)
  const [newRem, setNewRem] = useState(false)
  useOnscreen('reminders', 'Reminders lists')
  useAppRoute('reminders', (r) => {
    const m = r.match(/^list\/(.+)$/)
    if (m) { nav.popToRoot(); nav.push(<ListPage listId={m[1]} />) }
    else if (r === 'new') setNewRem(true)
  })
  const eot = endOfToday()
  const counts: Record<SmartId, number> = {
    today: reminders.filter((r) => !r.done && r.due !== undefined && r.due < eot).length,
    scheduled: reminders.filter((r) => !r.done && r.due !== undefined).length,
    all: reminders.filter((r) => !r.done).length,
    flagged: reminders.filter((r) => !r.done && r.flagged).length,
    completed: reminders.filter((r) => r.done).length,
  }
  const results = q.trim() ? reminders.filter((r) => `${r.title} ${r.notes ?? ''}`.toLowerCase().includes(q.trim().toLowerCase())) : []
  return (
    <Page
      title=""
      large={false}
      bottomExtra={60}
      grouped
      trailing={<button className="bar-btn icon glass interactive" aria-label="More" onClick={(e) => openMenu(e.currentTarget, [
        { label: 'New List', icon: <Plus size={18} />, onSelect: () => setNewList(true) },
        { label: 'New Reminder', icon: <CircleCheck size={18} />, onSelect: () => setNewRem(true) },
        { label: 'Show Completed', icon: <Check size={18} />, onSelect: () => nav.push(<ListPage listId="completed" />) },
      ])}><Ellipsis size={22} /></button>}
      footer={
        <div className="rem-bottombar">
          <button className="rem-newbtn glass interactive" onClick={() => setNewRem(true)}><span className="rem-plus"><Plus size={16} strokeWidth={3} /></span> New Reminder</button>
          <button className="rem-addlist glass interactive" onClick={() => setNewList(true)}>Add List</button>
        </div>
      }
    >
      <div style={{ padding: '4px 16px 14px' }}><SearchField value={q} onChange={setQ} placeholder="Search" /></div>
      {q.trim() ? (
        <div className="rem-results">
          {results.length === 0 && <div className="empty-state"><div className="t-title2">No Results</div></div>}
          {lists.filter((l) => results.some((r) => r.list === l.id)).map((l) => (
            <section key={l.id}>
              <div className="rem-group-h" style={{ color: l.color }}>{l.name}</div>
              <div className="rem-card">{results.filter((r) => r.list === l.id).map((r) => <ReminderRow key={r.id} r={r} color={l.color} />)}</div>
            </section>
          ))}
        </div>
      ) : (
        <>
          <div className="rem-smart">
            {(Object.keys(SMART) as SmartId[]).map((id) => (
              <button key={id} className={`rem-smartcard ${id === 'completed' ? 'wide' : ''}`} onClick={() => nav.push(<ListPage listId={id} />)}>
                <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  {id === 'today' ? (
                    <span className="rem-glyph rem-today-glyph" style={{ background: SMART[id].color }}><span>{new Date().getDate()}</span></span>
                  ) : <ListGlyph color={SMART[id].color} icon={SMART[id].icon} size={32} />}
                  <span className="rem-smartcount">{counts[id]}</span>
                </div>
                <div className="rem-smartname">{SMART[id].name}</div>
              </button>
            ))}
          </div>
          <div className="rem-section-title">My Lists</div>
          <div className="list">
            {lists.map((l) => {
              const n = reminders.filter((r) => r.list === l.id && !r.done).length
              return (
                <button key={l.id} className="row-item has-icon" onClick={() => nav.push(<ListPage listId={l.id} />)}>
                  <ListGlyph color={l.color} icon={l.icon} />
                  <span className="row-main"><span className="row-title">{l.name}</span></span>
                  <span className="row-detail">{n}</span>
                  <ChevronRight className="chev" size={18} strokeWidth={2.6} />
                </button>
              )
            })}
          </div>
        </>
      )}
      <NewListSheet open={newList} onClose={() => setNewList(false)} onCreated={(id) => nav.push(<ListPage listId={id} />)} />
      <NewReminderSheet open={newRem} onClose={() => setNewRem(false)} />
    </Page>
  )
}

// ------------------------------------------------------------------ list page
type Item = { kind: 'section'; name: string; key: string } | { kind: 'row'; r: Reminder; key: string }

function ListPage({ listId }: { listId: string }) {
  const nav = useNav()
  const reminders = useOS((s) => s.reminders)
  const lists = useLists()
  const loc = useRem()
  const smart = isSmart(listId)
  const list = smart ? { id: listId, ...SMART[listId] } : lists.find((l) => l.id === listId)
  const color = list?.color ?? '#007aff'
  const showCompleted = listId === 'completed' || !!loc.showCompleted[listId]
  const sort = loc.sort[listId] ?? 'manual'
  const [details, setDetails] = useState<string | null>(null)
  const addRef = useRef<HTMLInputElement>(null)
  const [completing, setCompleting] = useState<Record<string, 'fill' | 'leave'>>({})
  useNow(60_000)
  useOnscreen('reminders', list ? `Reminders list ${list.name}` : undefined)

  if (!list) return <Page title="List" large={false}><div className="empty-state">This list was deleted.</div></Page>

  const eot = endOfToday()
  const pool = reminders.filter((r) => {
    if (smart) {
      if (listId === 'completed') return r.done
      if (listId === 'today') return (!r.done || completing[r.id]) && r.due !== undefined && r.due < eot
      if (listId === 'scheduled') return (!r.done || completing[r.id] || showCompleted) && r.due !== undefined
      if (listId === 'flagged') return (!r.done || completing[r.id] || showCompleted) && r.flagged
      return !r.done || completing[r.id] || showCompleted
    }
    return r.list === listId
  })
  const open = pool.filter((r) => !r.done || completing[r.id])
  const done = pool.filter((r) => r.done && !completing[r.id])

  const sortFn = (a: Reminder, b: Reminder) => {
    if (sort === 'due') return (a.due ?? Infinity) - (b.due ?? Infinity)
    if (sort === 'priority') return (b.priority ?? 0) - (a.priority ?? 0)
    if (sort === 'title') return a.title.localeCompare(b.title)
    const ord = loc.order[listId] ?? []
    const ia = ord.indexOf(a.id)
    const ib = ord.indexOf(b.id)
    if (ia === -1 && ib === -1) return reminders.indexOf(a) - reminders.indexOf(b)
    if (ia === -1) return 1
    if (ib === -1) return -1
    return ia - ib
  }

  // sections (real lists only)
  const sectionOf = (r: Reminder) => loc.sectionOf[r.id] ?? (r.list === 'groceries' ? groceryCategory(r.title) : '')
  let items: Item[] = []
  const lname = (id: string) => lists.find((l) => l.id === id)
  if (!smart) {
    const manual = loc.sections[listId] ?? []
    const secNames = [...new Set([...open.map(sectionOf).filter(Boolean), ...manual])]
    const noSec = open.filter((r) => !sectionOf(r)).sort(sortFn)
    items = noSec.map((r) => ({ kind: 'row', r, key: r.id }))
    for (const s of secNames) {
      items.push({ kind: 'section', name: s, key: `sec:${s}` })
      items.push(...open.filter((r) => sectionOf(r) === s).sort(sortFn).map((r) => ({ kind: 'row' as const, r, key: r.id })))
    }
  } else if (listId === 'scheduled' && loc.scheduledGroup === 'date') {
    const byDay = new Map<number, Reminder[]>()
    open.sort((a, b) => a.due! - b.due!).forEach((r) => { const k = Math.max(startOfDay(r.due!), startOfDay() - DAY); byDay.set(k, [...(byDay.get(k) ?? []), r]) })
    for (const [k, rs] of byDay) {
      items.push({ kind: 'section', name: k < startOfDay() ? 'Overdue' : fmtDue(k, false), key: `sec:${k}` })
      items.push(...rs.map((r) => ({ kind: 'row' as const, r, key: r.id })))
    }
  } else if (listId === 'today') {
    const buckets: [string, (r: Reminder) => boolean][] = [
      ['Overdue', (r) => r.due! < startOfDay()],
      ['Morning', (r) => r.due! >= startOfDay() && new Date(r.due!).getHours() < 12],
      ['Afternoon', (r) => r.due! >= startOfDay() && new Date(r.due!).getHours() >= 12 && new Date(r.due!).getHours() < 17],
      ['Tonight', (r) => r.due! >= startOfDay() && new Date(r.due!).getHours() >= 17],
    ]
    for (const [name, f] of buckets) {
      const rs = open.filter(f).sort((a, b) => a.due! - b.due!)
      items.push({ kind: 'section', name, key: `sec:${name}` })
      items.push(...rs.map((r) => ({ kind: 'row' as const, r, key: r.id })))
    }
  } else if (listId === 'flagged') {
    items = open.sort((a, b) => (a.due ?? Infinity) - (b.due ?? Infinity)).map((r) => ({ kind: 'row', r, key: r.id }))
  } else {
    // group by list: scheduled / all / completed
    const src = listId === 'completed' ? done : open
    for (const l of lists) {
      const rs = src.filter((r) => r.list === l.id).sort((a, b) => (a.due ?? Infinity) - (b.due ?? Infinity))
      if (!rs.length && listId !== 'all') continue
      items.push({ kind: 'section', name: l.name, key: `sec:${l.id}` })
      items.push(...rs.map((r) => ({ kind: 'row' as const, r, key: r.id })))
    }
  }

  const complete = (r: Reminder) => {
    if (r.done) {
      useOS.getState().updateReminder(r.id, { done: false })
      return
    }
    setCompleting((c) => ({ ...c, [r.id]: 'fill' }))
    const meta = loc.meta[r.id]
    window.setTimeout(() => setCompleting((c) => (c[r.id] ? { ...c, [r.id]: 'leave' } : c)), 750)
    window.setTimeout(() => {
      const st = useOS.getState()
      if (meta?.repeat && r.due) {
        const next = nextRepeat(r.due, meta.repeat)
        st.updateReminder(r.id, { due: next })
        st.showToast(`Next: ${fmtDue(next, meta.hasTime !== false)}`)
      } else st.updateReminder(r.id, { done: true })
      setCompleting((c) => { const n = { ...c }; delete n[r.id]; return n })
    }, 1050)
  }

  const commitOrder = (flat: Item[]) => {
    const sectionOfN = { ...loc.sectionOf }
    const ord: string[] = []
    let cur = ''
    for (const it of flat) {
      if (it.kind === 'section') cur = it.name
      else {
        if (cur) sectionOfN[it.r.id] = cur
        else if (it.r.list === 'groceries') sectionOfN[it.r.id] = ''
        else delete sectionOfN[it.r.id]
        ord.push(it.r.id)
      }
    }
    loc.set({ order: { ...loc.order, [listId]: ord }, sectionOf: sectionOfN, sort: { ...loc.sort, [listId]: 'manual' } })
  }

  const menu = (el: HTMLElement) => openMenu(el, [
    ...(listId !== 'completed' ? [{ label: showCompleted ? 'Hide Completed' : 'Show Completed', icon: <Check size={18} />, onSelect: () => loc.set({ showCompleted: { ...loc.showCompleted, [listId]: !showCompleted } }) }] : []),
    ...(!smart ? [
      { label: `Sort By: ${{ manual: 'Manual', due: 'Due Date', priority: 'Priority', title: 'Title' }[sort]}`, icon: <ListIcon size={18} />, onSelect: () => window.setTimeout(() => openMenu(el, (['manual', 'due', 'priority', 'title'] as const).map((k) => ({ label: { manual: 'Manual', due: 'Due Date', priority: 'Priority', title: 'Title' }[k], icon: sort === k ? <Check size={18} /> : undefined, onSelect: () => loc.set({ sort: { ...loc.sort, [listId]: k } }) }))), 50) },
      { label: 'Add Section', icon: <Plus size={18} />, onSelect: () => { const base = 'New Section'; let n = base; let i = 2; const ex = loc.sections[listId] ?? []; while (ex.includes(n)) n = `${base} ${i++}`; loc.set({ sections: { ...loc.sections, [listId]: [...ex, n] } }) } },
    ] : []),
    ...(listId === 'scheduled' ? [{ label: `Group by ${loc.scheduledGroup === 'list' ? 'Date' : 'List'}`, icon: <Calendar size={18} />, onSelect: () => loc.set({ scheduledGroup: loc.scheduledGroup === 'list' ? 'date' : 'list' }) }] : []),
    ...(listId === 'completed' && done.length ? [{ label: 'Clear All Completed', destructive: true, icon: <Trash2 size={18} />, onSelect: () => clearCompleted(done) }] : []),
    ...(!smart && loc.lists.some((l) => l.id === listId) ? [{ label: 'Delete List', destructive: true, icon: <Trash2 size={18} />, separatorBefore: true, onSelect: () => showAlert({ title: `Delete “${list.name}”?`, message: 'This will delete all reminders in this list.', actions: [{ label: 'Cancel', style: 'cancel' }, { label: 'Delete', style: 'destructive', onPress: () => { const st = useOS.getState(); st.set({ reminders: st.reminders.filter((r) => r.list !== listId) }); loc.set({ lists: loc.lists.filter((l) => l.id !== listId) }); nav.pop() } }] }) }] : []),
  ])

  const clearCompleted = (rs: Reminder[]) => showAlert({ title: `Clear ${rs.length} Completed Reminder${rs.length === 1 ? '' : 's'}?`, actions: [{ label: 'Cancel', style: 'cancel' }, { label: 'Clear', style: 'destructive', onPress: () => { const ids = new Set(rs.map((r) => r.id)); const st = useOS.getState(); st.set({ reminders: st.reminders.filter((r) => !ids.has(r.id)) }) } }] })

  const addTarget = smart ? (listId === 'completed' ? null : 'reminders') : listId
  const showListName = smart && listId !== 'scheduled' && listId !== 'all' && listId !== 'completed'
  return (
    <Page
      title={<span style={{ color }}>{list.name}</span>}
      inlineTitle={list.name}
      bottomExtra={70}
      trailing={<button className="bar-btn icon glass interactive" aria-label="List options" onClick={(e) => menu(e.currentTarget)}><Ellipsis size={22} /></button>}
      footer={addTarget ? (
        <div className="rem-bottombar">
          <button className="rem-newbtn glass interactive" style={{ '--c': color } as CSSProperties} onClick={() => addRef.current?.focus()}><span className="rem-plus"><Plus size={16} strokeWidth={3} /></span> New Reminder</button>
        </div>
      ) : undefined}
    >
      {listId !== 'completed' && (
        <div className="rem-donebar">
          <span>{done.length} Completed</span>
          {done.length > 0 && <><span className="dotsep">•</span><button onClick={() => clearCompleted(done)} style={{ color }}>Clear</button></>}
          <span className="grow" />
          <button style={{ color }} onClick={() => loc.set({ showCompleted: { ...loc.showCompleted, [listId]: !showCompleted } })}>{showCompleted ? 'Hide' : 'Show'}</button>
        </div>
      )}
      <DragList
        items={items}
        enabled={!smart}
        color={color}
        onCommit={commitOrder}
        render={(it, dragging) => it.kind === 'section' ? (
          <SectionHeader key={it.key} name={it.name} listId={listId} editable={!smart && !(listId === 'groceries' && !(loc.sections[listId] ?? []).includes(it.name))} color={smart && lname(it.key.slice(4)) ? lname(it.key.slice(4))!.color : undefined} />
        ) : (
          <ReminderRow
            r={it.r}
            color={smart ? lname(it.r.list)?.color ?? color : color}
            state={completing[it.r.id]}
            onToggle={() => complete(it.r)}
            onInfo={() => setDetails(it.r.id)}
            listName={showListName ? lname(it.r.list)?.name : undefined}
            lifted={dragging}
          />
        )}
      />
      {addTarget && (
        <AddRow
          inputRef={addRef}
          color={color}
          listId={addTarget}
          defaults={listId === 'today' ? { due: startOfDay() + 17 * HOUR } : listId === 'flagged' ? { flagged: true } : listId === 'scheduled' ? { due: startOfDay() + DAY + 9 * HOUR } : {}}
          onAdded={(id) => { if (!smart) loc.set({ order: { ...loc.order, [listId]: [...(loc.order[listId] ?? items.filter((i) => i.kind === 'row').map((i) => (i as { r: Reminder }).r.id)), id] } }) }}
        />
      )}
      {showCompleted && done.length > 0 && listId !== 'completed' && (
        <div className="rem-completed">
          {done.map((r) => <ReminderRow key={r.id} r={r} color={lname(r.list)?.color ?? color} onToggle={() => complete(r)} onInfo={() => setDetails(r.id)} />)}
        </div>
      )}
      {items.filter((i) => i.kind === 'row').length === 0 && !showCompleted && (
        <div className="rem-empty">{listId === 'today' ? 'Nothing due today 🎉' : listId === 'completed' ? 'No Completed Reminders' : 'No Reminders'}</div>
      )}
      <DetailsSheet id={details} onClose={() => setDetails(null)} />
    </Page>
  )
}

function nextRepeat(due: number, rep: RRepeat): number {
  const d = new Date(due)
  if (rep === 'daily') d.setDate(d.getDate() + 1)
  else if (rep === 'weekdays') { do d.setDate(d.getDate() + 1); while (d.getDay() === 0 || d.getDay() === 6) }
  else if (rep === 'weekly' || rep.startsWith('weekly:')) d.setDate(d.getDate() + 7)
  else if (rep === 'monthly') d.setMonth(d.getMonth() + 1)
  else d.setFullYear(d.getFullYear() + 1)
  return d.getTime()
}

function SectionHeader({ name, listId, editable, color }: { name: string; listId: string; editable: boolean; color?: string }) {
  const loc = useRem()
  const [v, setV] = useState(name)
  useEffect(() => setV(name), [name])
  const rename = () => {
    const nv = v.trim()
    if (!nv || nv === name) return setV(name)
    const secs = (loc.sections[listId] ?? []).map((s) => (s === name ? nv : s))
    const so = Object.fromEntries(Object.entries(loc.sectionOf).map(([k, s]) => [k, s === name ? nv : s]))
    loc.set({ sections: { ...loc.sections, [listId]: secs.includes(nv) ? secs : [...secs, nv] }, sectionOf: so })
  }
  return (
    <div className="rem-sec" data-section>
      {editable ? (
        <input className="rem-sec-input" value={v} onChange={(e) => setV(e.target.value)} onBlur={rename} onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} aria-label="Section name" />
      ) : <span style={color ? { color } : undefined}>{name}</span>}
      {editable && (loc.sections[listId] ?? []).includes(name) && (
        <button aria-label="Delete section" className="rem-sec-del" onClick={() => {
          const so = Object.fromEntries(Object.entries(loc.sectionOf).filter(([, s]) => s !== name))
          loc.set({ sections: { ...loc.sections, [listId]: (loc.sections[listId] ?? []).filter((s) => s !== name) }, sectionOf: so })
        }}><X size={14} /></button>
      )}
    </div>
  )
}

// ------------------------------------------------------------------ drag to reorder / move between sections
function DragList({ items, enabled, render, onCommit }: { items: Item[]; enabled: boolean; color: string; render: (it: Item, dragging: boolean) => ReactNode; onCommit: (flat: Item[]) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const [drag, setDrag] = useState<{ key: string; dy: number; from: number; to: number; h: number } | null>(null)
  const timer = useRef<number | undefined>(undefined)
  const onPointerDown = (e: React.PointerEvent, idx: number) => {
    if (!enabled || e.button !== 0) return
    const t = e.target as HTMLElement
    if (t.closest('input, textarea, .rem-check, .rem-info, button')) return
    const scale = screenScale()
    const y0 = e.clientY
    const x0 = e.clientX
    let lifted = false
    let moved = false
    const els = [...ref.current!.querySelectorAll<HTMLElement>(':scope > [data-idx]')]
    const pos = els.map((el) => ({ top: el.offsetTop, h: el.offsetHeight }))
    const el = e.currentTarget as HTMLElement
    const cancel = () => {
      window.clearTimeout(timer.current)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    const move = (ev: PointerEvent) => {
      const dy = (ev.clientY - y0) / scale
      if (!lifted) {
        if (Math.hypot(ev.clientX - x0, ev.clientY - y0) / scale > 8) cancel()
        return
      }
      if (Math.abs(dy) > 4) moved = true
      const center = pos[idx].top + pos[idx].h / 2 + dy
      let to = 0
      pos.forEach((p, i) => { if (i !== idx && p.top + p.h / 2 < center) to++ })
      setDrag({ key: items[idx].key, dy, from: idx, to, h: pos[idx].h })
    }
    const up = () => {
      cancel()
      if (!lifted) return
      const block = (ev: Event) => { ev.stopPropagation(); ev.preventDefault() }
      window.addEventListener('click', block, { capture: true, once: true })
      window.setTimeout(() => window.removeEventListener('click', block, { capture: true }), 50)
      setDrag((d) => {
        if (d && moved && d.to !== d.from) {
          const flat = [...items]
          const [it] = flat.splice(d.from, 1)
          flat.splice(d.to, 0, it)
          window.setTimeout(() => onCommit(flat), 0)
        } else if (!moved) {
          const it = items[idx]
          if (it.kind === 'row') window.setTimeout(() => rowMenu(el, it.r), 0)
        }
        return null
      })
    }
    timer.current = window.setTimeout(() => {
      if (items[idx].kind !== 'row') return
      lifted = true
      setDrag({ key: items[idx].key, dy: 0, from: idx, to: idx, h: pos[idx].h })
    }, 380)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }
  return (
    <div className={`rem-list ${drag ? 'dragging' : ''}`} ref={ref}>
      {items.map((it, i) => {
        let ty = 0
        if (drag) {
          if (it.key === drag.key) ty = drag.dy
          else if (drag.from < drag.to && i > drag.from && i <= drag.to) ty = -drag.h
          else if (drag.from > drag.to && i >= drag.to && i < drag.from) ty = drag.h
        }
        const me = drag?.key === it.key
        return (
          <div
            key={it.key}
            data-idx={i}
            className={`rem-item ${me ? 'lifted' : ''}`}
            style={{ transform: ty ? `translateY(${ty}px)${me ? ' scale(1.02)' : ''}` : me ? 'scale(1.02)' : undefined, zIndex: me ? 10 : undefined, transition: me ? 'none' : undefined }}
            onPointerDown={(e) => onPointerDown(e, i)}
            onContextMenu={(e) => { e.preventDefault(); if (it.kind === 'row') rowMenu(e.currentTarget, it.r) }}
          >
            {render(it, me)}
          </div>
        )
      })}
    </div>
  )
}

function rowMenu(el: HTMLElement, r: Reminder) {
  const st = useOS.getState()
  const lists = [...REMINDER_LISTS, ...useRem.getState().lists]
  openMenu(el, [
    { label: r.flagged ? 'Unflag' : 'Flag', icon: <Flag size={18} />, onSelect: () => st.updateReminder(r.id, { flagged: !r.flagged }) },
    { label: r.done ? 'Mark as Incomplete' : 'Mark as Completed', icon: <CircleCheck size={18} />, onSelect: () => st.updateReminder(r.id, { done: !r.done }) },
    { label: 'Move to…', icon: <FolderInput size={18} />, onSelect: () => window.setTimeout(() => openMenu(el, lists.filter((l) => l.id !== r.list).map((l) => ({ label: l.name, icon: <span className="rem-dot" style={{ background: l.color }} />, onSelect: () => { useOS.getState().updateReminder(r.id, { list: l.id }); const loc = useRem.getState(); const so = { ...loc.sectionOf }; delete so[r.id]; loc.set({ sectionOf: so }); useOS.getState().showToast(`Moved to ${l.name}`) } }))), 60) },
    { label: 'Delete', icon: <Trash2 size={18} />, destructive: true, separatorBefore: true, onSelect: () => st.set({ reminders: st.reminders.filter((x) => x.id !== r.id) }) },
  ], { preview: <div className="rem-preview">{r.title}</div> })
}

// ------------------------------------------------------------------ rows
function ReminderRow({ r, color, state, onToggle, onInfo, listName, lifted }: { r: Reminder; color: string; state?: 'fill' | 'leave'; onToggle?: () => void; onInfo?: () => void; listName?: string; lifted?: boolean }) {
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(r.title)
  const meta = useRem((s) => s.meta[r.id])
  useEffect(() => setTitle(r.title), [r.title])
  const overdue = !r.done && r.due !== undefined && r.due < Date.now()
  const checked = r.done || !!state
  const toggle = onToggle ?? (() => useOS.getState().updateReminder(r.id, { done: !r.done }))
  return (
    <div className={`rem-row ${checked ? 'checked' : ''} ${state === 'leave' ? 'leaving' : ''} ${lifted ? 'lifted' : ''}`} style={{ '--c': color } as CSSProperties}>
      <button className={`rem-check ${checked ? 'on' : ''}`} aria-label={checked ? `Mark ${r.title} incomplete` : `Complete ${r.title}`} role="checkbox" aria-checked={checked} onClick={toggle}>
        <span className="rem-check-fill" />
      </button>
      <div className="rem-body" onClick={() => !editing && setEditing(true)}>
        {editing ? (
          <input
            className="rem-title-input"
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => { setEditing(false); if (title.trim() && title !== r.title) useOS.getState().updateReminder(r.id, { title: title.trim() }) }}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
            aria-label="Reminder title"
          />
        ) : (
          <div className="rem-title">
            {r.priority ? <span className="rem-prio">{'!'.repeat(r.priority)} </span> : null}
            {r.title}
          </div>
        )}
        {r.notes && <div className="rem-notes">{r.notes}</div>}
        {(r.due !== undefined || listName || meta?.repeat || r.source) && (
          <div className={`rem-meta ${overdue ? 'overdue' : ''}`}>
            {r.due !== undefined && <span>{fmtDue(r.due, meta?.hasTime !== false)}</span>}
            {meta?.repeat && <span className="rem-rep"><Repeat size={12} /> {repeatLabel(meta.repeat)}</span>}
            {listName && <span className="rem-listname">{listName}</span>}
            {r.source && <span className="rem-listname">from {r.source}</span>}
          </div>
        )}
      </div>
      {r.flagged && <Flag size={16} className="rem-flag" fill="#ff9500" color="#ff9500" />}
      <button className="rem-info" aria-label={`Details for ${r.title}`} onClick={(e) => { e.stopPropagation(); onInfo?.() }}><Info size={22} strokeWidth={1.8} /></button>
    </div>
  )
}

function ParsedChips({ chips }: { chips: ReturnType<typeof parseReminderNL>['chips'] }) {
  if (!chips.length) return null
  return (
    <div className="rem-chips anim-fade">
      <AISparkle size={13} />
      {chips.map((c, i) => (
        <span key={i} className={`rem-chip ${c.kind}`}>
          {c.kind === 'when' ? <Calendar size={12} /> : c.kind === 'flag' ? <Flag size={12} /> : c.kind === 'repeat' ? <Repeat size={12} /> : c.kind === 'list' ? <ListIcon size={12} /> : '!'}
          {c.label}
        </span>
      ))}
    </div>
  )
}

function AddRow({ color, listId, defaults, onAdded, inputRef }: { color: string; listId: string; defaults: Partial<Reminder>; onAdded: (id: string) => void; inputRef: React.RefObject<HTMLInputElement | null> }) {
  const [text, setText] = useState('')
  const lists = useLists()
  const parsed = useMemo(() => (text.trim() ? parseReminderNL(text, lists) : null), [text, lists])
  const add = () => {
    if (!parsed || !parsed.title) return
    const st = useOS.getState()
    const id = st.addReminder({ title: parsed.title, list: parsed.list ?? listId, due: parsed.due ?? defaults.due, flagged: parsed.flagged ?? defaults.flagged, priority: parsed.priority })
    if (parsed.repeat || parsed.due !== undefined) {
      const loc = useRem.getState()
      loc.set({ meta: { ...loc.meta, [id]: { repeat: parsed.repeat, hasTime: parsed.due !== undefined ? parsed.hasTime : true, created: Date.now() } } })
    }
    if (parsed.list && parsed.list !== listId) st.showToast(`Added to ${lists.find((l) => l.id === parsed.list)?.name}`)
    onAdded(id)
    setText('')
  }
  return (
    <div className="rem-row rem-add" style={{ '--c': color } as CSSProperties}>
      <span className="rem-check ghost" />
      <div className="rem-body">
        <input
          ref={inputRef}
          className="rem-title-input"
          placeholder="New Reminder"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          onBlur={() => text.trim() && add()}
          aria-label="New reminder"
          enterKeyHint="done"
          data-dictation="Bring percussion bag tomorrow at 7am|Order bumper fabric #robotics !!|Walk Biscuit every day at 6pm"
        />
        {parsed && <ParsedChips chips={parsed.chips} />}
      </div>
    </div>
  )
}

// ------------------------------------------------------------------ sheets
function DetailsSheet({ id, onClose }: { id: string | null; onClose: () => void }) {
  const r = useOS((s) => s.reminders.find((x) => x.id === id))
  const lists = useLists()
  const loc = useRem()
  const [picker, setPicker] = useState<null | 'date' | 'time'>(null)
  const h24 = useOS((s) => s.h24)
  useEffect(() => setPicker(null), [id])
  const upd = (p: Partial<Reminder>) => r && useOS.getState().updateReminder(r.id, p)
  const meta = r ? loc.meta[r.id] ?? {} : {}
  const setMeta = (m: Meta) => r && loc.set({ meta: { ...loc.meta, [r.id]: { ...meta, ...m } } })
  const l = r ? lists.find((x) => x.id === r.list) : undefined
  const hasTime = meta.hasTime !== false
  return (
    <Sheet open={!!id && !!r} onClose={onClose} title="Details" detent="large" className="rem-sheet" trailing={<button className="bar-btn icon prominent" aria-label="Done" onClick={onClose}><Check size={22} strokeWidth={2.8} /></button>}>
      {r && (
        <div className="rem-details">
          <div className="list">
            <div className="row-item"><input className="text-input" value={r.title} onChange={(e) => upd({ title: e.target.value })} aria-label="Title" /></div>
            <div className="row-item" style={{ alignItems: 'flex-start' }}><textarea className="text-input" rows={3} placeholder="Notes" value={r.notes ?? ''} onChange={(e) => upd({ notes: e.target.value })} aria-label="Notes" /></div>
          </div>
          <div className="list">
            <div className="row-item has-icon">
              <span className="settings-icon" style={{ background: '#ff3b30' }}><Calendar size={17} /></span>
              <button className="row-main" style={{ textAlign: 'left' }} onClick={() => r.due !== undefined && setPicker(picker === 'date' ? null : 'date')}>
                <span className="row-title">Date</span>
                {r.due !== undefined && <span className="row-sub" style={{ color: 'var(--accent)' }}>{fmtDue(r.due, false)}</span>}
              </button>
              <Switch checked={r.due !== undefined} onChange={(v) => { upd({ due: v ? startOfDay() + 9 * HOUR : undefined }); setMeta({ hasTime: false }); setPicker(v ? 'date' : null) }} label="Date" />
            </div>
            {picker === 'date' && r.due !== undefined && <div className="rem-expand"><DatePickerInline value={r.due} onChange={(ts) => upd({ due: ts })} /></div>}
            <div className="row-item has-icon">
              <span className="settings-icon" style={{ background: '#007aff' }}><CalendarDays size={17} /></span>
              <button className="row-main" style={{ textAlign: 'left' }} onClick={() => r.due !== undefined && hasTime && setPicker(picker === 'time' ? null : 'time')}>
                <span className="row-title">Time</span>
                {r.due !== undefined && hasTime && <span className="row-sub" style={{ color: 'var(--accent)' }}>{fmtDue(r.due).split(', ')[1]}</span>}
              </button>
              <Switch checked={r.due !== undefined && hasTime} onChange={(v) => { if (v && r.due === undefined) upd({ due: Date.now() + HOUR }); setMeta({ hasTime: v }); setPicker(v ? 'time' : null) }} label="Time" />
            </div>
            {picker === 'time' && r.due !== undefined && (
              <div className="rem-expand"><TimeWheels hour={new Date(r.due).getHours()} minute={new Date(r.due).getMinutes() - (new Date(r.due).getMinutes() % 5)} minuteStep={5} h24={h24} onChange={(h, m) => { const d = new Date(r.due!); d.setHours(h, m, 0, 0); upd({ due: d.getTime() }) }} /></div>
            )}
            <button className="row-item has-icon" onClick={(e) => openMenu(e.currentTarget, ([undefined, 'daily', 'weekdays', 'weekly', 'monthly', 'yearly'] as (RRepeat | undefined)[]).map((x) => ({ label: repeatLabel(x), icon: meta.repeat === x ? <Check size={18} /> : undefined, onSelect: () => setMeta({ repeat: x }) })))}>
              <span className="settings-icon" style={{ background: '#8e8e93' }}><Repeat size={17} /></span>
              <span className="row-main"><span className="row-title">Repeat</span></span>
              <span className="row-detail">{repeatLabel(meta.repeat)}</span>
            </button>
          </div>
          <div className="list">
            <div className="row-item has-icon">
              <span className="settings-icon" style={{ background: '#ff9500' }}><Flag size={17} fill="#fff" /></span>
              <span className="row-main"><span className="row-title">Flag</span></span>
              <Switch checked={!!r.flagged} onChange={(v) => upd({ flagged: v })} label="Flag" />
            </div>
            <button className="row-item" onClick={(e) => openMenu(e.currentTarget, (['None', 'Low', 'Medium', 'High'] as const).map((p, i) => ({ label: p, icon: (r.priority ?? 0) === i ? <Check size={18} /> : undefined, onSelect: () => upd({ priority: i as 0 | 1 | 2 | 3 }) })))}>
              <span className="row-main"><span className="row-title">Priority</span></span>
              <span className="row-detail">{['None', 'Low', 'Medium', 'High'][r.priority ?? 0]}</span>
            </button>
            <button className="row-item" onClick={(e) => openMenu(e.currentTarget, lists.map((x) => ({ label: x.name, icon: <span className="rem-dot" style={{ background: x.color }} />, onSelect: () => upd({ list: x.id }) })))}>
              <span className="row-main"><span className="row-title">List</span></span>
              <span className="row-detail"><span className="rem-dot" style={{ background: l?.color }} /> {l?.name}</span>
            </button>
          </div>
          <div className="list">
            <button className="row-item destructive" style={{ justifyContent: 'center' }} onClick={() => { const st = useOS.getState(); st.set({ reminders: st.reminders.filter((x) => x.id !== r.id) }); onClose() }}>Delete Reminder</button>
          </div>
        </div>
      )}
    </Sheet>
  )
}

function NewReminderSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const lists = useLists()
  const [text, setText] = useState('')
  const [notes, setNotes] = useState('')
  const [listId, setListId] = useState('reminders')
  useEffect(() => { if (open) { setText(''); setNotes('') } }, [open])
  const parsed = text.trim() ? parseReminderNL(text, lists) : null
  const target = lists.find((l) => l.id === (parsed?.list ?? listId)) ?? lists[0]
  const add = () => {
    if (!parsed?.title) return
    const st = useOS.getState()
    const id = st.addReminder({ title: parsed.title, notes: notes || undefined, list: target.id, due: parsed.due, flagged: parsed.flagged, priority: parsed.priority })
    if (parsed.repeat || parsed.due !== undefined) {
      const loc = useRem.getState()
      loc.set({ meta: { ...loc.meta, [id]: { repeat: parsed.repeat, hasTime: parsed.hasTime } } })
    }
    st.showToast(`Added to ${target.name}`)
    onClose()
  }
  return (
    <Sheet open={open} onClose={onClose} title="New Reminder" detent="large" className="rem-sheet" trailing={<button className="bar-btn icon prominent" aria-label="Add" disabled={!parsed?.title} onClick={add}><Check size={22} strokeWidth={2.8} /></button>}>
      <div className="list">
        <div className="row-item" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
          <input className="text-input" placeholder="Title" autoFocus value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} aria-label="Title" data-dictation="Bring percussion bag tomorrow at 7am" />
          {parsed && <ParsedChips chips={parsed.chips} />}
        </div>
        <div className="row-item"><textarea className="text-input" rows={3} placeholder="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} aria-label="Notes" /></div>
      </div>
      <div className="list-footer" style={{ marginTop: -12, marginBottom: 14 }}>Try “Bring percussion bag tomorrow at 7am”, “Walk Biscuit every day at 6pm”, or “Order bumper fabric #robotics !!”.</div>
      <div className="list">
        <button className="row-item has-icon" onClick={(e) => openMenu(e.currentTarget, lists.map((x) => ({ label: x.name, icon: <span className="rem-dot" style={{ background: x.color }} />, onSelect: () => setListId(x.id) })))}>
          <ListGlyph color={target.color} icon={target.icon} />
          <span className="row-main"><span className="row-title">List</span></span>
          <span className="row-detail">{target.name}</span>
          <ChevronRight className="chev" size={18} />
        </button>
      </div>
    </Sheet>
  )
}

function NewListSheet({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (id: string) => void }) {
  const [name, setName] = useState('')
  const [color, setColor] = useState(COLORS[5])
  const [icon, setIcon] = useState('list')
  useEffect(() => { if (open) { setName(''); setColor(COLORS[5]); setIcon('list') } }, [open])
  const create = () => {
    if (!name.trim()) return
    const loc = useRem.getState()
    const id = uid('list')
    loc.set({ lists: [...loc.lists, { id, name: name.trim(), color, icon }] })
    onClose()
    window.setTimeout(() => onCreated(id), 300)
  }
  return (
    <Sheet open={open} onClose={onClose} title="New List" detent="large" className="rem-sheet" trailing={<button className="bar-btn icon prominent" aria-label="Done" disabled={!name.trim()} onClick={create}><Check size={22} strokeWidth={2.8} /></button>}>
      <div className="rem-newlist">
        <span className="rem-glyph big" style={{ background: color }}>{(LIST_ICONS[icon] ?? LIST_ICONS.list)({ size: 44 })}</span>
        <input className="rem-newlist-name" placeholder="List Name" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && create()} style={{ color }} aria-label="List name" />
      </div>
      <div className="rem-swatches">
        {COLORS.map((c) => <button key={c} aria-label={`Color ${c}`} className={c === color ? 'on' : ''} style={{ background: c }} onClick={() => setColor(c)} />)}
      </div>
      <div className="rem-swatches icons">
        {['list', 'book', 'cpu', 'cart', 'star', 'music', 'gym', 'gift', 'house', 'plane'].map((i) => (
          <button key={i} aria-label={`Icon ${i}`} className={i === icon ? 'on' : ''} onClick={() => setIcon(i)}>{LIST_ICONS[i]({ size: 20 })}</button>
        ))}
      </div>
    </Sheet>
  )
}
