import { useMemo, useState } from 'react'
import { Plus, Flame, Cloud, RefreshCw, Shuffle, Bookmark, Pencil, Trash2, Sparkles, Calendar, Music, Image as ImageIcon, MapPin, Heart, Activity, RotateCcw, Search } from 'lucide-react'
import { NavStack, Page, useNav } from '../../ui/nav'
import { SearchField, Glass } from '../../ui/controls'
import { openMenu, showAlert } from '../../ui/overlay'
import { useOS } from '../../os/store'
import { useAppRoute, useLongPress, useNow } from '../../os/hooks'
import type { JournalEntry } from '../../os/types'
import { fmtDate, fmtTime, fmtAgo, MONTHS, WEEKDAYS_SHORT } from '../../os/time'
import { Scene } from '../../art/Scene'
import { EntryEditor } from './Editor'
import { AttachChip } from './Chips'
import { buildPrompts, streakInfo, insights, useJournalLocal, deleteEntry, type JPrompt } from './data'
import './journal.css'

export default function JournalApp() {
  return (
    <div className="app-root jn">
      <NavStack root={<Home />} />
    </div>
  )
}

const FILTERS = ['All', 'Bookmarked', 'Photos', 'Places', 'Workouts', 'Music', 'Audio'] as const
type Filter = (typeof FILTERS)[number]

const PROMPT_ICON: Record<string, typeof Sparkles> = { refresh: RotateCcw, calendar: Calendar, music: Music, sparkles: Sparkles, run: Activity, photo: ImageIcon, pin: MapPin, heart: Heart }

function Home() {
  const nav = useNav()
  const journal = useOS((s) => s.journal)
  const bookmarks = useJournalLocal((s) => s.bookmarks)
  const lastSync = useJournalLocal((s) => s.lastSync)
  const weeklyGoal = useJournalLocal((s) => s.weeklyGoal)
  const net = useOS((s) => s.net)
  const now = useNow(30_000)
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<Filter>('All')
  const [searching, setSearching] = useState(false)
  const [shuffle, setShuffle] = useState(0)
  const [syncing, setSyncing] = useState(false)

  useAppRoute('journal', (route) => {
    const [kind, id] = route.split('/')
    nav.popToRoot()
    if (kind === 'entry' && id) nav.push(<EntryEditor id={id} />)
    if (kind === 'new') nav.push(<EntryEditor />)
  })

  const sorted = useMemo(() => [...journal].sort((a, b) => b.ts - a.ts), [journal])
  const prompts = useMemo(() => buildPrompts(shuffle), [shuffle, journal.length])
  const streak = streakInfo(journal)
  const ins = insights(journal)
  const online = (net.wifi || net.cellular) && !net.airplane

  const ql = q.trim().toLowerCase()
  const visible = sorted.filter((e) => {
    if (ql && !(e.title.toLowerCase().includes(ql) || e.body.toLowerCase().includes(ql) || e.attachments.some((a) => a.label.toLowerCase().includes(ql)))) return false
    switch (filter) {
      case 'Bookmarked': return !!bookmarks[e.id]
      case 'Photos': return e.photos.length > 0
      case 'Places': return e.attachments.some((a) => a.kind === 'location')
      case 'Workouts': return e.attachments.some((a) => a.kind === 'workout')
      case 'Music': return e.attachments.some((a) => a.kind === 'song')
      case 'Audio': return e.attachments.some((a) => a.kind === 'audio')
      default: return true
    }
  })
  const groups: { label: string; items: JournalEntry[] }[] = []
  for (const e of visible) {
    const d = new Date(e.ts)
    const label = `${MONTHS[d.getMonth()]} ${d.getFullYear()}`
    const g = groups[groups.length - 1]
    if (g && g.label === label) g.items.push(e)
    else groups.push({ label, items: [e] })
  }

  const syncNow = () => {
    if (!online) return useOS.getState().showToast('iCloud unavailable — offline')
    setSyncing(true)
    window.setTimeout(() => { setSyncing(false); useJournalLocal.getState().set({ lastSync: Date.now() }) }, 1200)
  }

  return (
    <Page
      title="Journal"
      bottomExtra={90}
      trailing={<button className="bar-btn icon glass interactive" aria-label="Search" onClick={() => setSearching((s) => !s)}><Search size={20} /></button>}
      footer={
        <div className="jn-fab-wrap">
          <Glass as="button" className="jn-fab interactive" variant="heavy" aria-label="New Entry" onClick={() => nav.push(<EntryEditor />)}><Plus size={30} strokeWidth={2.4} /></Glass>
        </div>
      }
    >
      <button className="jn-sync" onClick={syncNow}>
        {syncing ? <RefreshCw size={13} className="jn-spin" /> : <Cloud size={13} />}
        {!online ? 'Offline · changes will sync to iCloud later' : syncing ? 'Syncing with iCloud…' : `Synced with iCloud · ${now - lastSync < 60_000 ? 'Just now' : fmtAgo(lastSync, now)}`}
      </button>

      {(searching || q) && (
        <div className="jn-search anim-fade">
          <SearchField value={q} onChange={setQ} placeholder="Search Entries" autoFocus />
          <div className="jn-filters scroll">
            {FILTERS.map((f) => <button key={f} className={filter === f ? 'on' : ''} onClick={() => setFilter(f)}>{f}</button>)}
          </div>
        </div>
      )}

      {!ql && filter === 'All' && (
        <>
          <div className="jn-top">
            <div className="jn-streak">
              <div className="row gap6">
                <span className="jn-flame"><Flame size={18} fill="currentColor" /></span>
                <div className="grow">
                  <div className="t-headline">{streak.cur > 0 ? `${streak.cur}-day streak` : 'Start a streak'}</div>
                  <div className="t-caption1 secondary">{streak.journaledToday ? 'You wrote today ✓' : streak.cur > 0 ? 'Write today to keep it going' : 'Write today to begin'}</div>
                </div>
              </div>
              <div className="jn-week">
                {streak.week.map((w) => (
                  <div key={w.day} className={`jn-day ${w.done ? 'done' : ''} ${w.today ? 'today' : ''} ${w.future ? 'future' : ''}`}>
                    <span>{w.done ? <Flame size={11} fill="currentColor" /> : null}</span>
                    <small>{WEEKDAYS_SHORT[new Date(w.day).getDay()][0]}</small>
                  </div>
                ))}
              </div>
              <button className="jn-goal" onClick={(e) => openMenu(e.currentTarget, [2, 3, 4, 5, 7].map((n) => ({ label: `${n} days a week`, onSelect: () => useJournalLocal.getState().set({ weeklyGoal: n }) })), { title: 'Weekly goal' })}>
                <span>Weekly goal</span><b>{streak.weekCount} of {weeklyGoal} days</b>
                <span className="jn-goal-bar"><i style={{ width: `${Math.min(100, (streak.weekCount / weeklyGoal) * 100)}%` }} /></span>
              </button>
            </div>
            <div className="jn-insights">
              <div><b>{ins.entries}</b><span>Entries this year</span></div>
              <div><b>{ins.words.toLocaleString()}</b><span>Words written</span></div>
              <div><b>{ins.days}</b><span>Days journaled</span></div>
              <div><b>{streak.longest}</b><span>Longest streak</span></div>
            </div>
          </div>

          <div className="jn-sec-h">
            <span className="row gap6"><Sparkles size={15} className="jn-ai" /> Writing Prompts</span>
            <button aria-label="Shuffle prompts" onClick={() => setShuffle((s) => s + 1)}><Shuffle size={16} /></button>
          </div>
          <div className="jn-prompts scroll">
            {prompts.slice(0, 6).map((p, i) => <PromptCard key={`${p.id}-${shuffle}`} p={p} i={i} onUse={() => nav.push(<EntryEditor prompt={p} />)} />)}
          </div>
        </>
      )}

      {groups.map((g) => (
        <section key={g.label}>
          <div className="jn-month">{g.label}</div>
          {g.items.map((e) => <EntryCard key={e.id} e={e} bookmarked={!!bookmarks[e.id]} onOpen={() => nav.push(<EntryEditor id={e.id} />)} />)}
        </section>
      ))}
      {visible.length === 0 && (
        <div className="empty-state">
          <Pencil size={34} />
          <div className="t-title2">{ql || filter !== 'All' ? 'No Matching Entries' : 'Start Your Journal'}</div>
          <div className="t-subhead">{ql || filter !== 'All' ? 'Try a different search or filter.' : 'Tap + to write about your day, or pick a writing prompt.'}</div>
        </div>
      )}
    </Page>
  )
}

function PromptCard({ p, i, onUse }: { p: JPrompt; i: number; onUse: () => void }) {
  const I = PROMPT_ICON[p.icon] ?? Sparkles
  const photo = useOS((s) => (p.photo ? s.photos.find((x) => x.id === p.photo) : undefined))
  return (
    <button className="jn-prompt pressable anim-up" style={{ ['--pc' as string]: p.color, animationDelay: `${i * 50}ms` }} onClick={onUse}>
      {photo && <div className="jn-prompt-img"><Scene scene={photo.scene} /></div>}
      <div className="jn-prompt-body">
        <span className="jn-prompt-kicker"><I size={12} strokeWidth={2.6} /> <span className="nowrap">{p.kicker}</span></span>
        <span className="jn-prompt-text">{p.text}</span>
      </div>
    </button>
  )
}

function EntryCard({ e, bookmarked, onOpen }: { e: JournalEntry; bookmarked: boolean; onOpen: () => void }) {
  const all = useOS((s) => s.photos)
  const photos = e.photos.map((id) => all.find((p) => p.id === id)).filter(Boolean)
  const lp = useLongPress((el) => openMenu(el, [
    { label: 'Edit', icon: <Pencil size={18} />, onSelect: onOpen },
    { label: bookmarked ? 'Remove Bookmark' : 'Bookmark', icon: <Bookmark size={18} />, onSelect: () => { const l = useJournalLocal.getState(); l.set({ bookmarks: { ...l.bookmarks, [e.id]: !bookmarked } }) } },
    { label: 'Delete', icon: <Trash2 size={18} />, destructive: true, separatorBefore: true, onSelect: () => showAlert({ title: 'Delete Entry?', actions: [{ label: 'Cancel', style: 'cancel' }, { label: 'Delete', style: 'destructive', onPress: () => deleteEntry(e.id) }] }) },
  ]))
  return (
    <div className="jn-card pressable anim-up" role="button" tabIndex={0} onClick={onOpen} onKeyDown={(ev) => ev.key === 'Enter' && onOpen()} {...lp}>
      {photos.length > 0 && (
        <div className={`jn-card-photos n${Math.min(3, photos.length)}`}>
          {photos.slice(0, 3).map((p) => <div key={p!.id}><Scene scene={p!.scene} /></div>)}
          {photos.length > 3 && <span className="jn-more">+{photos.length - 3}</span>}
        </div>
      )}
      <div className="jn-card-body">
        {e.prompt && <div className="jn-card-prompt"><Sparkles size={11} /> {e.prompt}</div>}
        <div className="row gap6">
          <div className="t-headline grow">{e.title || 'Untitled'}</div>
          {e.mood && <span style={{ fontSize: 18 }}>{e.mood}</span>}
          {bookmarked && <Bookmark size={15} fill="var(--pink)" color="var(--pink)" />}
        </div>
        {e.body && <div className="jn-card-text">{e.body}</div>}
        {e.attachments.length > 0 && <div className="jn-chips">{e.attachments.map((a, i) => <AttachChip key={i} a={a} />)}</div>}
        <div className="jn-card-date">{fmtDate(e.ts)} · {fmtTime(e.ts)}</div>
      </div>
    </div>
  )
}
