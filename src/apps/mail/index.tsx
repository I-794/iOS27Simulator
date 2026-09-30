import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { create } from 'zustand'
import {
  Inbox, Star, Flag, FileText, Send, Archive, ShieldAlert, Trash2, Mail as MailIcon, Paperclip, SquarePen, ListFilter, Search, User, ShoppingCart, Megaphone, Tag, Mails,
  ChevronRight, Reply, ReplyAll, Forward, FolderInput, Ellipsis, MailOpen, Bell, MapPin, CalendarPlus, Wallet, Package, Check, X, ArrowUp, Plus, Image as ImageIcon, Clock, CircleCheck, Circle, Undo2,
} from 'lucide-react'
import { NavStack, Page, useNav, BarButton } from '../../ui/nav'
import { List, Row } from '../../ui/list'
import { Avatar, AISparkle, Button, Spinner, Chip } from '../../ui/controls'
import { Sheet, openMenu, showAlert } from '../../ui/overlay'
import { useOS } from '../../os/store'
import { useAppRoute, useOnscreen, useNow } from '../../os/hooks'
import { smartReplies } from '../../os/ai/writing'
import { search } from '../../os/search'
import { fmtRelative, fmtDate, fmtTime, HOUR } from '../../os/time'
import { CONTACTS, contactName } from '../../os/data/people'
import type { MailMessage } from '../../os/types'
import { DocPages, fileByName } from '../preview/docs'
import { Scene } from '../../art/Scene'
import {
  useMailLocal, BOX_TITLE, inBox, CATEGORY_META, isPriority, contactFor, previewFor, whenFromFacts, findExistingEvent, calendarFor, moveMail, patchMails, deleteForever,
  initialsOf, colorFor, ME_EMAIL, mailSummary, type Box, type Category,
} from './model'
import './mail.css'

// ------------------------------------------------------------------ compose state
interface Draft { to: string; cc: string; subject: string; body: string; replyTo?: string; thread?: string; attachments?: MailMessage['attachments']; draftId?: string }
const useCompose = create<{ open: boolean; draft: Draft; undo: { id: string; draft: Draft } | null; set: (p: Partial<{ open: boolean; draft: Draft; undo: { id: string; draft: Draft } | null }>) => void }>((set) => ({
  open: false,
  draft: { to: '', cc: '', subject: '', body: '' },
  undo: null,
  set: (p) => set(p),
}))
const compose = (d: Partial<Draft> = {}) => useCompose.getState().set({ open: true, draft: { to: '', cc: '', subject: '', body: '', ...d } })

// ------------------------------------------------------------------ app
export default function MailApp() {
  return (
    <div className="app-root ml-root">
      <NavStack root={<MailboxesPage />} />
      <ComposeSheet />
      <UndoSendBanner />
    </div>
  )
}

function MailboxesPage() {
  const nav = useNav()
  const mails = useOS((s) => s.mails)
  const vips = useMailLocal((s) => s.vips)
  const pushed = useRef(false)
  useEffect(() => {
    if (pushed.current) return
    pushed.current = true
    nav.push(<MailboxView box="inbox" />, 'inbox')
  }, [nav])
  useAppRoute('mail', (route) => {
    if (route.startsWith('mail/')) {
      const id = route.slice(5)
      const m = useOS.getState().mails.find((x) => x.id === id)
      if (m) {
        nav.popToRoot()
        window.setTimeout(() => {
          nav.push(<MailboxView box={m.folder === 'inbox' ? 'inbox' : (m.folder as Box)} />)
          window.setTimeout(() => nav.push(<MessageView id={id} />), 30)
        }, 30)
      }
    } else if (route.startsWith('compose')) {
      const subject = route.startsWith('compose/') ? decodeURIComponent(route.slice(8)) : ''
      compose({ subject })
    }
  })
  const count = (b: Box) => mails.filter((m) => inBox(m, b, vips)).length
  const unread = (b: Box) => mails.filter((m) => inBox(m, b, vips) && m.unread).length
  const row = (b: Box, icon: ReactNode, badge: 'unread' | 'count' = 'unread') => {
    const n = badge === 'unread' ? unread(b) : count(b)
    return <Row key={b} icon={icon} title={BOX_TITLE[b]} detail={n ? String(n) : ''} chevron onClick={() => nav.push(<MailboxView box={b} />)} />
  }
  const ic = (el: ReactNode, color = 'var(--accent)') => <span className="ml-boxicon" style={{ color }}>{el}</span>
  return (
    <Page title="Mailboxes" grouped trailing={<BarButton label="New Message" onClick={() => compose()}><SquarePen size={21} /></BarButton>}>
      <List>
        {row('inbox', ic(<Inbox size={22} />))}
        {row('vip', ic(<Star size={22} />, 'var(--yellow)'))}
        {row('flagged', ic(<Flag size={22} />, 'var(--orange)'), 'count')}
        {row('unread', ic(<MailIcon size={22} />))}
        {row('attachments', ic(<Paperclip size={22} />), 'count')}
      </List>
      <List header="iCloud">
        {row('drafts', ic(<FileText size={22} />), 'count')}
        {row('sent', ic(<Send size={22} />), 'count')}
        {row('junk', ic(<ShieldAlert size={22} />), 'count')}
        {row('trash', ic(<Trash2 size={22} />), 'count')}
        {row('archive', ic(<Archive size={22} />), 'count')}
      </List>
      <div className="ml-updated">Updated Just Now</div>
    </Page>
  )
}

// ------------------------------------------------------------------ mailbox list
const CAT_ICON: Record<Category, ReactNode> = {
  primary: <User size={18} />, transactions: <ShoppingCart size={18} />, updates: <Megaphone size={18} />, promotions: <Tag size={18} />, all: <Mails size={18} />,
}

function MailboxView({ box }: { box: Box }) {
  const nav = useNav()
  const mails = useOS((s) => s.mails)
  const vips = useMailLocal((s) => s.vips)
  const category = useMailLocal((s) => s.category)
  const [unreadOnly, setUnreadOnly] = useState(false)
  const [editing, setEditing] = useState(false)
  const [sel, setSel] = useState<string[]>([])
  const [searching, setSearching] = useState(false)
  const [q, setQ] = useState('')
  const [moveOpen, setMoveOpen] = useState<string[] | null>(null)
  useNow(60_000)
  const isInbox = box === 'inbox'
  const list = useMemo(() => {
    let l = mails.filter((m) => inBox(m, box, vips))
    if (isInbox && category !== 'all') l = l.filter((m) => m.category === category || (category === 'primary' && isPriority(m)))
    if (unreadOnly) l = l.filter((m) => m.unread)
    return l.sort((a, b) => b.ts - a.ts)
  }, [mails, box, vips, category, unreadOnly, isInbox])
  const priority = isInbox && !unreadOnly ? list.filter(isPriority) : []
  const rest = list.filter((m) => !priority.includes(m))
  const catUnread = (c: Category) => mails.filter((m) => m.folder === 'inbox' && m.unread && (c === 'all' || m.category === c)).length
  const open = (m: MailMessage) => {
    if (m.folder === 'drafts') {
      compose({ to: m.to, subject: m.subject, body: m.body, draftId: m.id })
      return
    }
    nav.push(<MessageView id={m.id} />)
  }
  const toggleSel = (id: string) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))
  const endEdit = () => {
    setEditing(false)
    setSel([])
  }
  const title = BOX_TITLE[box]
  const unreadCount = mails.filter((m) => inBox(m, box, vips) && m.unread).length

  if (searching) return <SearchView box={box} q={q} setQ={setQ} onClose={() => { setSearching(false); setQ('') }} />

  return (
    <Page
      title={title}
      subtitle={unreadCount ? `${unreadCount} Unread` : undefined}
      bottomExtra={70}
      trailing={
        editing ? (
          <BarButton label="Done" onClick={endEdit} prominent>Done</BarButton>
        ) : (
          <BarButton label="Select" onClick={() => setEditing(true)}>Select</BarButton>
        )
      }
      leading={editing ? <BarButton label={sel.length === list.length ? 'Deselect All' : 'Select All'} onClick={() => setSel(sel.length === list.length ? [] : list.map((m) => m.id))}>{sel.length === list.length && list.length ? 'Deselect All' : 'Select All'}</BarButton> : undefined}
      footer={
        editing ? (
          <div className="ml-editbar glass">
            <button disabled={!sel.length} onClick={() => { const anyUnread = mails.some((m) => sel.includes(m.id) && m.unread); patchMails(sel, { unread: !anyUnread }); endEdit() }}>{mails.some((m) => sel.includes(m.id) && m.unread) ? 'Mark Read' : 'Mark Unread'}</button>
            <button disabled={!sel.length} onClick={() => setMoveOpen(sel)}>Move</button>
            <button disabled={!sel.length} onClick={() => { patchMails(sel, { flagged: true }); endEdit() }}>Flag</button>
            <button disabled={!sel.length} className="red" onClick={() => { if (box === 'trash') deleteForever(sel); else moveMail(sel, 'trash'); useOS.getState().showToast(`${sel.length} moved to Trash`, 'trash'); endEdit() }}>{box === 'trash' ? 'Delete' : 'Trash'}</button>
          </div>
        ) : (
          <div className="ml-bottombar">
            <button className={`ml-circle glass interactive ${unreadOnly ? 'on' : ''}`} onClick={() => setUnreadOnly((u) => !u)} aria-label={unreadOnly ? 'Show all mail' : 'Filter: Unread'} aria-pressed={unreadOnly}><ListFilter size={21} /></button>
            <button className="ml-searchpill glass" onClick={() => setSearching(true)}><Search size={17} /> Search</button>
            <button className="ml-circle glass interactive" onClick={() => compose()} aria-label="New Message"><SquarePen size={21} /></button>
          </div>
        )
      }
    >
      {isInbox && (
        <div className="ml-cats" role="tablist" aria-label="Categories">
          {(['primary', 'transactions', 'updates', 'promotions', 'all'] as Category[]).map((c) => {
            const on = category === c
            const meta = c === 'all' ? { label: 'All Mail', color: '#8e8e93' } : CATEGORY_META[c]
            const n = catUnread(c)
            return (
              <button key={c} role="tab" aria-selected={on} aria-label={`${meta.label}${n ? `, ${n} unread` : ''}`} className={`ml-cat ${on ? 'on' : ''}`} style={{ ['--cat' as string]: meta.color }} onClick={() => useMailLocal.getState().set({ category: c })}>
                {CAT_ICON[c]}
                {on && <span>{meta.label}</span>}
                {!on && n > 0 && c !== 'all' && <i className="ml-catdot" />}
              </button>
            )
          })}
        </div>
      )}
      {unreadOnly && <div className="ml-filterchip">Filtered by: <b>Unread</b> <button onClick={() => setUnreadOnly(false)} aria-label="Clear filter"><X size={13} /></button></div>}
      {priority.length > 0 && (
        <div className="ml-priority">
          <div className="ml-priority-h"><AISparkle size={15} /> Priority</div>
          {priority.map((m) => <MailRow key={m.id} m={m} onOpen={() => open(m)} editing={editing} selected={sel.includes(m.id)} onSelect={() => toggleSel(m.id)} onMove={() => setMoveOpen([m.id])} box={box} compact />)}
        </div>
      )}
      <div className="ml-list">
        {rest.map((m) => <MailRow key={m.id} m={m} onOpen={() => open(m)} editing={editing} selected={sel.includes(m.id)} onSelect={() => toggleSel(m.id)} onMove={() => setMoveOpen([m.id])} box={box} />)}
      </div>
      {list.length === 0 && (
        <div className="empty-state">
          <MailOpen size={40} strokeWidth={1.5} />
          <div className="t-title3" style={{ color: 'var(--label-primary)' }}>No Mail</div>
          {unreadOnly ? 'No unread messages.' : isInbox && category !== 'all' ? `Nothing in ${CATEGORY_META[category as Exclude<Category, 'all'>].label}.` : `${title} is empty.`}
        </div>
      )}
      {list.length > 0 && <div className="ml-updated">Updated Just Now · {list.length} message{list.length === 1 ? '' : 's'}</div>}
      <MoveSheet ids={moveOpen} onClose={() => { setMoveOpen(null); if (editing) endEdit() }} />
    </Page>
  )
}

// ------------------------------------------------------------------ row with swipe actions
let openRow: { id: string; reset: () => void } | null = null

function MailRow({ m, onOpen, editing, selected, onSelect, onMove, box, compact }: { m: MailMessage; onOpen: () => void; editing: boolean; selected: boolean; onSelect: () => void; onMove: () => void; box: Box; compact?: boolean }) {
  const [x, setX] = useState(0)
  const [anim, setAnim] = useState(false)
  const drag = useRef<{ x0: number; y0: number; base: number; active: boolean; moved: boolean } | null>(null)
  const justDragged = useRef(false)
  const tapClose = useRef(false)
  const vips = useMailLocal((s) => s.vips)
  const c = contactFor(m.from.email)
  const sent = m.folder === 'sent' || m.folder === 'drafts'
  const who = sent ? `To: ${contactFor(m.to) ? contactName(contactFor(m.to)!.id, 'full') : m.to}` : m.from.name
  const pv = previewFor(m)
  const destructive = box === 'trash' || box === 'junk' ? 'delete' : m.folder === 'inbox' ? 'archive' : 'trash'
  const settle = (to: number) => {
    setAnim(true)
    setX(to)
    window.setTimeout(() => setAnim(false), 320)
  }
  const reset = () => settle(0)
  const doArchive = () => {
    if (destructive === 'delete') deleteForever([m.id])
    else moveMail([m.id], destructive === 'archive' ? 'archive' : 'trash')
    useOS.getState().showToast(destructive === 'archive' ? 'Archived' : destructive === 'delete' ? 'Deleted' : 'Moved to Trash', destructive === 'archive' ? 'archive' : 'trash')
  }
  const toggleRead = () => {
    useOS.getState().updateMail(m.id, { unread: !m.unread })
    reset()
  }
  const more = (el: HTMLElement) => {
    openMenu(el, [
      { label: 'Reply', icon: <Reply size={18} />, onSelect: () => replyTo(m) },
      { label: 'Forward', icon: <Forward size={18} />, onSelect: () => forward(m) },
      { label: m.unread ? 'Mark as Read' : 'Mark as Unread', icon: <MailOpen size={18} />, separatorBefore: true, onSelect: toggleRead },
      { label: m.flagged ? 'Unflag' : 'Flag', icon: <Flag size={18} />, onSelect: () => useOS.getState().updateMail(m.id, { flagged: !m.flagged }) },
      { label: 'Remind Me in 1 Hour', icon: <Clock size={18} />, onSelect: () => remindMe(m) },
      { label: 'Move Message…', icon: <FolderInput size={18} />, separatorBefore: true, onSelect: onMove },
      { label: 'Move to Junk', icon: <ShieldAlert size={18} />, onSelect: () => { moveMail([m.id], 'junk'); useOS.getState().showToast('Moved to Junk') } },
      { label: box === 'trash' ? 'Delete' : 'Trash Message', icon: <Trash2 size={18} />, destructive: true, onSelect: () => (box === 'trash' ? deleteForever([m.id]) : moveMail([m.id], 'trash')) },
    ])
    reset()
  }
  const onPointerDown = (e: React.PointerEvent) => {
    if (editing || e.button !== 0) return
    if (openRow && openRow.id !== m.id) {
      openRow.reset()
      openRow = null
    }
    tapClose.current = x !== 0
    drag.current = { x0: e.clientX, y0: e.clientY, base: x, active: false, moved: false }
  }
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d) return
    const dx = e.clientX - d.x0
    const dy = e.clientY - d.y0
    if (!d.active) {
      if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy) * 1.2) {
        d.active = true
        d.moved = true
        ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
      } else if (Math.abs(dy) > 8) {
        drag.current = null
        return
      } else return
    }
    const scale = (e.currentTarget as HTMLElement).getBoundingClientRect().width / (e.currentTarget as HTMLElement).offsetWidth || 1
    setX(Math.max(-330, Math.min(260, d.base + dx / scale)))
  }
  const onPointerUp = () => {
    const d = drag.current
    drag.current = null
    if (!d) return
    if (d.active) {
      justDragged.current = true
      window.setTimeout(() => (justDragged.current = false), 60)
    }
    if (!d.active) {
      if (x !== 0) return reset()
      return
    }
    if (x < -230) {
      settle(-420)
      window.setTimeout(doArchive, 200)
    } else if (x < -60) {
      settle(-222)
      openRow = { id: m.id, reset }
    } else if (x > 150) {
      toggleRead()
    } else if (x > 50) {
      settle(80)
      openRow = { id: m.id, reset }
    } else reset()
  }
  const click = () => {
    if (justDragged.current) return
    if (x !== 0 || tapClose.current) {
      tapClose.current = false
      return reset()
    }
    if (editing) onSelect()
    else onOpen()
  }
  return (
    <div className={`ml-row-wrap ${compact ? 'compact' : ''}`}>
      {!editing && (
        <>
          <div className="ml-actions-left" style={{ width: Math.max(0, x) }}>
            <button className="ml-act blue" onClick={toggleRead} aria-label={m.unread ? 'Mark as Read' : 'Mark as Unread'} tabIndex={x > 0 ? 0 : -1}>
              <MailOpen size={20} /><span>{m.unread ? 'Read' : 'Unread'}</span>
            </button>
          </div>
          <div className="ml-actions-right" style={{ width: Math.max(0, -x) }}>
            <button className="ml-act gray" onClick={(e) => more(e.currentTarget)} aria-label="More" tabIndex={x < 0 ? 0 : -1}><Ellipsis size={20} /><span>More</span></button>
            <button className="ml-act orange" onClick={() => { useOS.getState().updateMail(m.id, { flagged: !m.flagged }); reset() }} aria-label={m.flagged ? 'Unflag' : 'Flag'} tabIndex={x < 0 ? 0 : -1}><Flag size={20} /><span>{m.flagged ? 'Unflag' : 'Flag'}</span></button>
            <button className={`ml-act ${destructive === 'archive' ? 'purple' : 'red'}`} onClick={doArchive} aria-label={destructive === 'archive' ? 'Archive' : 'Trash'} tabIndex={x < 0 ? 0 : -1}>
              {destructive === 'archive' ? <Archive size={20} /> : <Trash2 size={20} />}<span>{destructive === 'archive' ? 'Archive' : destructive === 'delete' ? 'Delete' : 'Trash'}</span>
            </button>
          </div>
        </>
      )}
      <div
        className={`ml-row ${m.unread ? 'unread' : ''} ${selected ? 'sel' : ''}`}
        style={{ transform: `translateX(${x}px)`, transition: anim ? 'transform 0.32s var(--spring-snappy)' : undefined }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClick={click}
        onContextMenu={(e) => { e.preventDefault(); more(e.currentTarget as HTMLElement) }}
        role="button"
        tabIndex={0}
        aria-label={`${m.unread ? 'Unread. ' : ''}${who}. ${m.subject}`}
        onKeyDown={(e) => e.key === 'Enter' && click()}
      >
        {editing ? (
          <span className="ml-check">{selected ? <CircleCheck size={24} fill="var(--accent)" color="#fff" /> : <Circle size={24} />}</span>
        ) : (
          <span className="ml-dotcol">{m.unread && <i className="ml-unread" />}</span>
        )}
        <SenderAvatar email={sent ? m.to : m.from.email} name={sent ? m.to : m.from.name} size={40} />
        <div className="ml-row-main">
          <div className="ml-row-top">
            <span className="ml-from">{vips.includes(m.from.email) && !sent && <Star size={12} fill="currentColor" className="ml-vipstar" />}{who}</span>
            {m.attachments?.length ? <Paperclip size={13} className="ml-clip" /> : null}
            {m.flagged && <Flag size={13} fill="var(--orange)" color="var(--orange)" />}
            <span className="ml-time">{fmtRelative(m.ts)}</span>
            <ChevronRight size={14} className="ml-chev" />
          </div>
          <div className="ml-subject">{m.subject}</div>
          {!compact && (
            <div className="ml-preview">
              {pv.ai && <AISparkle size={12} />} {pv.text}
            </div>
          )}
          {compact && <div className="ml-preview one">{pv.ai && <AISparkle size={12} />} {pv.text}</div>}
        </div>
      </div>
      {!c && null}
    </div>
  )
}

function SenderAvatar({ email, name, size = 40 }: { email: string; name: string; size?: number }) {
  const c = contactFor(email)
  if (email === ME_EMAIL) return <Avatar id="me" size={size} />
  if (c && !c.isBusiness) return <Avatar id={c.id} size={size} />
  const color = c?.color ?? colorFor(name)
  return <Avatar name={initialsOf(name)} color={color} size={size} />
}

// ------------------------------------------------------------------ search (iOS 27: better Top Hits)
function SearchView({ box, q, setQ, onClose }: { box: Box; q: string; setQ: (s: string) => void; onClose: () => void }) {
  const nav = useNav()
  const mails = useOS((s) => s.mails)
  const vips = useMailLocal((s) => s.vips)
  const [scope, setScope] = useState<'all' | 'box'>('all')
  const [token, setToken] = useState<{ kind: 'from' | 'subject'; value: string; email?: string } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => inputRef.current?.focus(), [])
  const pool = mails.filter((m) => (scope === 'box' ? inBox(m, box, vips) : m.folder !== 'trash' && m.folder !== 'junk'))
  const ql = q.trim().toLowerCase()
  const people = useMemo(() => {
    if (!ql || token) return []
    const senders = new Map<string, string>()
    for (const m of mails) senders.set(m.from.email, m.from.name)
    for (const c of CONTACTS) c.emails.forEach((e) => !senders.has(e) && senders.set(e, contactName(c.id, 'full')))
    return [...senders.entries()].filter(([e, n]) => n.toLowerCase().split(/\s+/).some((w) => w.startsWith(ql)) || e.startsWith(ql)).slice(0, 3)
  }, [ql, mails, token])
  const subjects = useMemo(() => (!ql || token ? [] : [...new Set(mails.filter((m) => m.subject.toLowerCase().includes(ql)).map((m) => m.subject))].slice(0, 3)), [ql, mails, token])
  const results = useMemo(() => {
    let list = pool
    if (token?.kind === 'from') list = list.filter((m) => m.from.email === token.email || m.to === token.email)
    if (token?.kind === 'subject') list = list.filter((m) => m.subject === token.value)
    if (!ql) return { top: [] as MailMessage[], all: token ? list.sort((a, b) => b.ts - a.ts) : [] }
    const ids = new Set(list.map((m) => m.id))
    const hits = search(q, { types: ['mail'], limit: 60 }).filter((h) => ids.has(h.id.slice(5)))
    const byId = new Map(list.map((m) => [m.id, m]))
    const scored = hits.map((h) => ({ m: byId.get(h.id.slice(5))!, score: h.score + (byId.get(h.id.slice(5))!.unread ? 1 : 0) + (vips.includes(byId.get(h.id.slice(5))!.from.email) ? 1.5 : 0) }))
    // substring fallback for partial words
    for (const m of list) if (!scored.some((s) => s.m.id === m.id) && `${m.subject} ${m.from.name} ${m.body}`.toLowerCase().includes(ql)) scored.push({ m, score: 1 })
    scored.sort((a, b) => b.score - a.score)
    const top = scored.filter((s) => s.score >= 4).slice(0, 3).map((s) => s.m)
    const all = scored.map((s) => s.m).filter((m) => !top.includes(m)).sort((a, b) => b.ts - a.ts)
    return { top, all }
  }, [pool, q, ql, token, vips])
  const [loading, setLoading] = useState(false)
  useEffect(() => {
    if (!ql) return
    setLoading(true)
    const t = window.setTimeout(() => setLoading(false), 120)
    return () => window.clearTimeout(t)
  }, [ql])
  const open = (m: MailMessage) => nav.push(<MessageView id={m.id} highlight={ql} />)
  return (
    <Page title="Search" large={false} back={false} bottomExtra={10} trailing={<BarButton label="Cancel" onClick={() => { inputRef.current?.blur(); onClose() }}>Cancel</BarButton>}>
      <div className="ml-search-head">
        <label className="search-field">
          <Search size={17} />
          {token && <span className="ml-token">{token.kind === 'from' ? 'From: ' : 'Subject: '}{token.value}<button onClick={() => setToken(null)} aria-label="Remove filter"><X size={11} /></button></span>}
          <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder={token ? '' : 'Search mail'} aria-label="Search mail" enterKeyHint="search" onKeyDown={(e) => { if (e.key === 'Backspace' && !q && token) setToken(null) }} />
          {q && <button onClick={() => setQ('')} aria-label="Clear" className="ml-clear"><X size={12} strokeWidth={3} /></button>}
        </label>
        <div className="ml-scope">
          <Chip active={scope === 'all'} onClick={() => setScope('all')}>All Mailboxes</Chip>
          <Chip active={scope === 'box'} onClick={() => setScope('box')}>{BOX_TITLE[box]}</Chip>
        </div>
      </div>
      {!ql && !token && (
        <List header="Suggested">
          {[['Rosa', 'reservation'], ['Bolt Electronics', 'order'], ['robotics', ''], ['flight', '']].map(([s]) => (
            <Row key={s} icon={<span className="ml-sugg-ic"><Search size={16} /></span>} title={s} onClick={() => setQ(s)} />
          ))}
        </List>
      )}
      {(people.length > 0 || subjects.length > 0) && (
        <List header="Suggestions">
          {people.map(([email, name]) => (
            <Row key={email} icon={<SenderAvatar email={email} name={name} size={30} />} title={<>Messages from <b>{name}</b></>} subtitle={email} onClick={() => { setToken({ kind: 'from', value: name, email }); setQ('') }} />
          ))}
          {subjects.map((s) => (
            <Row key={s} icon={<span className="ml-sugg-ic"><MailIcon size={16} /></span>} title={<>Subject: <b>{s}</b></>} onClick={() => { setToken({ kind: 'subject', value: s }); setQ('') }} />
          ))}
        </List>
      )}
      {loading ? (
        <div className="ml-skel">{[0, 1, 2].map((i) => <div key={i} className="ml-skel-row"><div className="skeleton" style={{ width: 40, height: 40, borderRadius: 20 }} /><div style={{ flex: 1 }}><div className="skeleton" style={{ height: 12, width: '50%', marginBottom: 8 }} /><div className="skeleton" style={{ height: 10, width: '85%' }} /></div></div>)}</div>
      ) : (
        <>
          {results.top.length > 0 && (
            <div className="ml-tophits">
              <div className="list-header">Top Hits</div>
              <div className="ml-list card">
                {results.top.map((m) => <SearchHit key={m.id} m={m} q={ql} onOpen={() => open(m)} />)}
              </div>
            </div>
          )}
          {results.all.length > 0 && (
            <>
              <div className="list-header">Messages</div>
              <div className="ml-list">
                {results.all.map((m) => <SearchHit key={m.id} m={m} q={ql} onOpen={() => open(m)} />)}
              </div>
            </>
          )}
          {(ql || token) && !results.top.length && !results.all.length && <div className="empty-state"><Search size={34} /><div className="t-headline" style={{ color: 'var(--label-primary)' }}>No Results</div>Check the spelling or try a new search.</div>}
        </>
      )}
    </Page>
  )
}

function Hl({ text, q }: { text: string; q: string }) {
  if (!q) return <>{text}</>
  const i = text.toLowerCase().indexOf(q)
  if (i < 0) return <>{text}</>
  return <>{text.slice(0, i)}<mark className="ml-mark">{text.slice(i, i + q.length)}</mark>{text.slice(i + q.length)}</>
}

function SearchHit({ m, q, onOpen }: { m: MailMessage; q: string; onOpen: () => void }) {
  const body = m.body.replace(/\s+/g, ' ')
  const i = q ? body.toLowerCase().indexOf(q) : -1
  const snippet = i > 30 ? '…' + body.slice(i - 30, i + 110) : body.slice(0, 140)
  return (
    <button className={`ml-row hit ${m.unread ? 'unread' : ''}`} onClick={onOpen}>
      <span className="ml-dotcol">{m.unread && <i className="ml-unread" />}</span>
      <SenderAvatar email={m.from.email} name={m.from.name} size={36} />
      <div className="ml-row-main">
        <div className="ml-row-top"><span className="ml-from"><Hl text={m.from.name} q={q} /></span><span className="ml-time">{fmtRelative(m.ts)}</span></div>
        <div className="ml-subject"><Hl text={m.subject} q={q} /></div>
        <div className="ml-preview"><Hl text={snippet} q={q} /></div>
        <div className="ml-hit-box">{m.folder === 'inbox' ? 'Inbox' : BOX_TITLE[m.folder as Box]}</div>
      </div>
    </button>
  )
}

// ------------------------------------------------------------------ message view
function replyTo(m: MailMessage, body = '') {
  const quoted = `\n\n\nOn ${fmtDate(m.ts, 'short')}, at ${fmtTime(m.ts)}, ${m.from.name} <${m.from.email}> wrote:\n\n${m.body.split('\n').map((l) => `> ${l}`).join('\n')}`
  compose({ to: m.from.email === ME_EMAIL ? m.to : m.from.email, subject: m.subject.startsWith('Re:') ? m.subject : `Re: ${m.subject}`, body: body + quoted, replyTo: m.id, thread: m.thread ?? m.id })
}
function forward(m: MailMessage) {
  compose({ subject: `Fwd: ${m.subject}`, body: `\n\n\nBegin forwarded message:\n\nFrom: ${m.from.name} <${m.from.email}>\nSubject: ${m.subject}\nDate: ${fmtDate(m.ts, 'long')}\n\n${m.body}`, attachments: m.attachments })
}
function remindMe(m: MailMessage) {
  const st = useOS.getState()
  st.addReminder({ title: `Reply: ${m.subject}`, due: Date.now() + HOUR, list: 'reminders', notes: `From ${m.from.name}`, source: 'Mail' })
  st.showToast('Reminder set for 1 hour', 'bell')
}

function MessageView({ id, highlight }: { id: string; highlight?: string }) {
  const nav = useNav()
  const m = useOS((s) => s.mails.find((x) => x.id === id))
  const allMails = useOS((s) => s.mails)
  const thread = useMemo(() => (m ? allMails.filter((x) => x.id !== m.id && (x.thread === id || (!!m.thread && (x.id === m.thread || x.thread === m.thread)))).sort((a, b) => a.ts - b.ts) : []), [allMails, m, id])
  const events = useOS((s) => s.events)
  const vips = useMailLocal((s) => s.vips)
  const [ready, setReady] = useState(false)
  const [summary, setSummary] = useState<string | null>(null)
  const [summing, setSumming] = useState(false)
  const [attach, setAttach] = useState<{ name: string; kind: string } | null>(null)
  const [track, setTrack] = useState(false)
  const [moveOpen, setMoveOpen] = useState(false)
  const [showDetails, setShowDetails] = useState(false)
  useOnscreen('mail', m?.subject, m ? { type: 'mail', mailId: m.id } : undefined)
  useEffect(() => {
    const t = window.setTimeout(() => setReady(true), 120)
    return () => window.clearTimeout(t)
  }, [])
  useEffect(() => {
    if (m?.unread) useOS.getState().updateMail(m.id, { unread: false })
  }, [m?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!m) return <Page title="" large={false}><div className="empty-state">This message was deleted.</div></Page>
  const long = m.body.length > 220
  const f = m.facts
  const start = whenFromFacts(f?.when)
  const existing = start !== null ? findExistingEvent(f?.title ?? m.subject, start) : f?.kind === 'flight' ? events.find((e) => /SK 482/.test(e.title)) : undefined
  void events
  const addToCal = () => {
    const st = useOS.getState()
    if (existing) {
      st.launch('calendar', { route: `event/${existing.id}` })
      return
    }
    if (start === null) return
    const dur = f?.kind === 'reservation' ? 1.5 * HOUR : 2 * HOUR
    st.addEvent({ title: f?.title ?? m.subject, start, end: start + dur, calendar: calendarFor(f?.kind, f?.title), location: f?.location, notes: f?.kind === 'reservation' ? `Party of ${f.party} · Under ${f.name}` : undefined, source: 'Mail' })
    st.showToast('Added to Calendar', 'calendar')
  }
  const suggestions: { key: string; label: string; icon: ReactNode; done?: boolean; onClick: () => void }[] = []
  if (f?.kind === 'reservation') {
    suggestions.push({ key: 'dir', label: 'Directions', icon: <MapPin size={16} />, onClick: () => useOS.getState().launch('maps', { route: 'route/rosas' }) })
    suggestions.push({ key: 'cal', label: existing ? 'In Calendar' : 'Add to Calendar', icon: existing ? <Check size={16} /> : <CalendarPlus size={16} />, done: !!existing, onClick: addToCal })
  }
  if (f?.kind === 'event') suggestions.push({ key: 'cal', label: existing ? 'In Calendar' : 'Add to Calendar', icon: existing ? <Check size={16} /> : <CalendarPlus size={16} />, done: !!existing, onClick: addToCal })
  if (f?.kind === 'flight') {
    suggestions.push({ key: 'cal', label: existing ? 'In Calendar' : 'Add to Calendar', icon: existing ? <Check size={16} /> : <CalendarPlus size={16} />, done: !!existing, onClick: () => {
      const st = useOS.getState()
      if (existing) return st.launch('calendar', { route: `event/${existing.id}` })
      const s = new Date(new Date().getFullYear(), 10, 21, 8, 45).getTime()
      st.addEvent({ title: 'Flight SK 482 to Seattle', start: s, end: s + 2.33 * HOUR, calendar: 'family', location: 'Maple Grove Regional Airport (MGR)', notes: 'Confirmation 7XKQ2P · Seat 14C', source: 'Mail' })
      st.showToast('Added to Calendar', 'calendar')
    } })
    suggestions.push({ key: 'wallet', label: 'Add to Wallet', icon: <Wallet size={16} />, onClick: () => { useOS.getState().showToast('Boarding pass is in Wallet', 'wallet'); useOS.getState().launch('wallet', { route: 'card/w-boarding' }) } })
  }
  if (f?.kind === 'order') suggestions.push({ key: 'track', label: 'Track Package', icon: <Package size={16} />, onClick: () => setTrack(true) })

  const doSummarize = () => {
    setSumming(true)
    window.setTimeout(() => {
      setSummary(mailSummary(m))
      setSumming(false)
    }, 500)
  }
  const isVip = vips.includes(m.from.email)
  const moreMenu = (el: HTMLElement) =>
    openMenu(el, [
      { label: 'Mark as Unread', icon: <MailIcon size={18} />, onSelect: () => { useOS.getState().updateMail(m.id, { unread: true }); nav.pop() } },
      { label: m.flagged ? 'Unflag' : 'Flag', icon: <Flag size={18} />, onSelect: () => useOS.getState().updateMail(m.id, { flagged: !m.flagged }) },
      { label: 'Remind Me in 1 Hour', icon: <Bell size={18} />, onSelect: () => remindMe(m) },
      { label: isVip ? 'Remove from VIP' : 'Add to VIP', icon: <Star size={18} />, onSelect: () => useMailLocal.getState().set({ vips: isVip ? vips.filter((v) => v !== m.from.email) : [...vips, m.from.email] }) },
      { label: 'Archive', icon: <Archive size={18} />, separatorBefore: true, onSelect: () => { moveMail([m.id], 'archive'); useOS.getState().showToast('Archived', 'archive'); nav.pop() } },
      { label: 'Move to Junk', icon: <ShieldAlert size={18} />, onSelect: () => { moveMail([m.id], 'junk'); nav.pop() } },
    ])
  const replies =
    f?.kind === 'reservation' ? ['Thank you, see you then!', 'Could we move it to 7:30?', 'We need to cancel, sorry.']
    : f?.kind === 'order' ? ['Thanks for the update!', 'Can I change the delivery address?', 'Where is my package?']
    : f?.kind === 'flight' ? ['Thanks!', 'Can I change my seat?', 'Is a checked bag included?']
    : contactFor(m.from.email)?.tone === 'teacher' ? ['Thank you, I’ll be there.', 'Got it, thanks for the reminder!', 'I have a conflict, can we talk?']
    : smartReplies(m.body.replace(/\n+/g, ' '), contactFor(m.from.email)?.id)
  const bodyParas = m.body.split('\n')
  return (
    <Page
      title={m.subject}
      large={false}
      bottomExtra={70}
      inlineTitle={<span />}
      trailing={
        <>
          <BarButton label={m.flagged ? 'Unflag' : 'Flag'} onClick={() => useOS.getState().updateMail(m.id, { flagged: !m.flagged })}><Flag size={20} fill={m.flagged ? 'var(--orange)' : 'none'} color={m.flagged ? 'var(--orange)' : 'currentColor'} /></BarButton>
          <button className="bar-btn icon glass interactive" aria-label="More" onClick={(e) => moreMenu(e.currentTarget)}><Ellipsis size={22} /></button>
        </>
      }
      footer={
        <div className="ml-bottombar msg">
          <button className="ml-circle glass interactive" onClick={() => { if (m.folder === 'trash') deleteForever([m.id]); else moveMail([m.id], 'trash'); useOS.getState().showToast(m.folder === 'trash' ? 'Deleted' : 'Moved to Trash', 'trash'); nav.pop() }} aria-label="Trash"><Trash2 size={20} /></button>
          <button className="ml-circle glass interactive" onClick={() => setMoveOpen(true)} aria-label="Move"><FolderInput size={20} /></button>
          <button className="ml-circle glass interactive" onClick={(e) => openMenu(e.currentTarget, [
            { label: 'Reply', icon: <Reply size={18} />, onSelect: () => replyTo(m) },
            { label: 'Reply All', icon: <ReplyAll size={18} />, onSelect: () => replyTo(m) },
            { label: 'Forward', icon: <Forward size={18} />, onSelect: () => forward(m) },
          ])} aria-label="Reply"><Reply size={20} /></button>
          <button className="ml-circle glass interactive" onClick={() => compose()} aria-label="New Message"><SquarePen size={20} /></button>
        </div>
      }
    >
      {!ready ? (
        <div className="ml-msg-skel" aria-busy="true">
          <div className="skeleton" style={{ height: 22, width: '80%', marginBottom: 14 }} />
          <div className="row gap12"><div className="skeleton" style={{ width: 44, height: 44, borderRadius: 22 }} /><div className="grow"><div className="skeleton" style={{ height: 12, width: '40%', marginBottom: 8 }} /><div className="skeleton" style={{ height: 10, width: '60%' }} /></div></div>
          {[90, 96, 70, 88].map((w, i) => <div key={i} className="skeleton" style={{ height: 12, width: `${w}%`, marginTop: 14 }} />)}
        </div>
      ) : (
        <div className="ml-msg anim-fade">
          {thread.length > 0 && (
            <div className="ml-thread">
              {thread.filter((t) => t.ts < m.ts).map((t) => <ThreadStub key={t.id} m={t} onOpen={() => nav.push(<MessageView id={t.id} />)} />)}
            </div>
          )}
          <h1 className="ml-msg-subject">{highlight ? <Hl text={m.subject} q={highlight} /> : m.subject}</h1>
          <div className="ml-msg-from">
            <SenderAvatar email={m.from.email} name={m.from.name} size={44} />
            <div className="ml-msg-meta">
              <div className="ml-msg-name">{m.from.name}{isVip && <Star size={13} fill="var(--yellow)" color="var(--yellow)" />}</div>
              <button className="ml-msg-to" onClick={() => setShowDetails((s) => !s)}>
                {showDetails ? <>From: {m.from.email}<br />To: {m.to}</> : <>To: {m.to === ME_EMAIL ? 'Jamie Park' : m.to} <span className="accent">Details</span></>}
              </button>
            </div>
            <div className="ml-msg-date">{fmtRelative(m.ts)}{fmtRelative(m.ts).includes(':') ? '' : `\n${fmtTime(m.ts)}`}</div>
          </div>
          {long && (
            <div className={`ml-summary ${summary ? 'done' : ''} ${summing ? 'ai-glow' : ''}`}>
              {summary ? (
                <>
                  <div className="ml-summary-h"><AISparkle size={15} /> Summary</div>
                  <p>{summary}</p>
                </>
              ) : (
                <button onClick={doSummarize} disabled={summing} className="ml-summarize-btn">
                  {summing ? <Spinner size={15} /> : <AISparkle size={16} />} {summing ? 'Summarizing…' : 'Summarize'}
                </button>
              )}
            </div>
          )}
          {suggestions.length > 0 && (
            <div className="ml-suggest">
              {suggestions.map((s) => (
                <button key={s.key} className={`ml-sugg ${s.done ? 'done' : ''}`} onClick={s.onClick}>{s.icon}{s.label}</button>
              ))}
            </div>
          )}
          <div className="ml-body" data-mail-body>
            {bodyParas.map((p, i) => (p.trim() ? <p key={i}>{highlight ? <Hl text={p} q={highlight} /> : p}</p> : <div key={i} className="ml-gap" />))}
          </div>
          {m.attachments?.length ? (
            <div className="ml-attachments">
              {m.attachments.map((a) => (
                <button key={a.name} className="ml-attach" onClick={() => setAttach(a)}>
                  <span className={`ml-attach-ic k-${a.kind}`}>{a.kind === 'image' ? <ImageIcon size={18} /> : <FileText size={18} />}</span>
                  <span className="ml-attach-name"><b>{a.name}</b><small>{a.kind.toUpperCase()} · {a.size}</small></span>
                </button>
              ))}
            </div>
          ) : null}
          {thread.filter((t) => t.ts > m.ts).map((t) => <ThreadStub key={t.id} m={t} onOpen={() => nav.push(<MessageView id={t.id} />)} />)}
          {m.folder !== 'sent' && m.folder !== 'drafts' && (
            <div className="ml-smart">
              <div className="ml-smart-h"><AISparkle size={14} /> Smart Reply</div>
              <div className="ml-smart-row">
                {replies.map((r) => <button key={r} className="ml-smart-chip" onClick={() => replyTo(m, r)}>{r}</button>)}
              </div>
            </div>
          )}
        </div>
      )}
      <AttachmentSheet a={attach} onClose={() => setAttach(null)} />
      <TrackSheet open={track} onClose={() => setTrack(false)} facts={f} />
      <MoveSheet ids={moveOpen ? [m.id] : null} onClose={() => setMoveOpen(false)} onMoved={() => nav.pop()} />
    </Page>
  )
}

function ThreadStub({ m, onOpen }: { m: MailMessage; onOpen: () => void }) {
  return (
    <button className="ml-stub" onClick={onOpen}>
      <SenderAvatar email={m.from.email} name={m.from.name} size={28} />
      <span className="grow"><b>{m.from.email === ME_EMAIL ? 'You' : m.from.name}</b><small>{m.body.replace(/\s+/g, ' ').slice(0, 80)}</small></span>
      <span className="ml-time">{fmtRelative(m.ts)}</span>
    </button>
  )
}

function AttachmentSheet({ a, onClose }: { a: { name: string; kind: string } | null; onClose: () => void }) {
  const file = a ? fileByName(a.name) : undefined
  return (
    <Sheet open={!!a} onClose={onClose} title={a?.name} detent="large" trailing={
      a && (file ? (
        <button className="bar-btn tinted" onClick={() => { onClose(); useOS.getState().launch('preview', { route: `file/${file.id}` }) }}>Preview</button>
      ) : (
        <button className="bar-btn tinted" onClick={() => useOS.getState().set({ shareRequest: { title: a.name, kind: a.kind === 'image' ? 'photo' : 'file', app: 'mail' } })}>Share</button>
      ))
    }>
      <div className="ml-attach-view">
        {a?.kind === 'image' ? (
          <div className="ml-attach-img"><Scene scene="plant-sunflower" /></div>
        ) : file ? (
          <DocPages file={file} />
        ) : (
          <div className="empty-state"><FileText size={40} />{a?.name}</div>
        )}
        {file && (
          <div className="ml-attach-actions">
            <Button variant="tinted" onClick={() => { onClose(); useOS.getState().launch('preview', { route: `file/${file.id}` }) }}>Open in Preview</Button>
            <Button variant="gray" onClick={() => { useOS.getState().showToast('Saved to Files', 'folder') }}>Save to Files</Button>
          </div>
        )}
      </div>
    </Sheet>
  )
}

function TrackSheet({ open, onClose, facts }: { open: boolean; onClose: () => void; facts?: Record<string, string> }) {
  const live = useOS((s) => s.activities.some((a) => a.id === 'delivery-bolt'))
  const steps = [
    { t: 'Order placed', s: 'Bolt Electronics · Monday', done: true },
    { t: 'Shipped', s: 'Parcel Express · Maple Grove hub', done: true },
    { t: 'Out for delivery', s: 'Expected Friday by 8 PM', done: false },
    { t: 'Delivered', s: '84 Birchwood Lane', done: false },
  ]
  return (
    <Sheet open={open} onClose={onClose} title="Track Package" detent="auto">
      <div className="ml-track">
        <div className="ml-track-card">
          <Package size={30} />
          <div><b>Arriving {facts?.eta ?? 'Friday'}</b><small>Order {facts?.order} · {facts?.tracking}</small></div>
        </div>
        <div className="ml-track-steps">
          {steps.map((s, i) => (
            <div key={i} className={`ml-step ${s.done ? 'done' : ''}`}>
              <i />
              <div><b>{s.t}</b><small>{s.s}</small></div>
            </div>
          ))}
        </div>
        <Button block variant={live ? 'gray' : 'filled'} onClick={() => {
          const st = useOS.getState()
          if (live) st.endActivity('delivery-bolt')
          else st.startActivity({ id: 'delivery-bolt', kind: 'delivery', title: 'Bolt Electronics order', subtitle: 'Shipped · Arriving Friday', app: 'mail', priority: 1, progress: 0.55, data: { eta: facts?.eta ?? 'Friday' } })
          st.showToast(live ? 'Live Activity ended' : 'Tracking in Live Activity', 'package')
        }}>{live ? 'Stop Live Activity' : 'Track with Live Activity'}</Button>
        <Button block variant="plain" onClick={() => { onClose(); useOS.getState().launch('wallet') }}>Show Orders in Wallet</Button>
      </div>
    </Sheet>
  )
}

function MoveSheet({ ids, onClose, onMoved }: { ids: string[] | null; onClose: () => void; onMoved?: () => void }) {
  const folders: { f: MailMessage['folder']; icon: ReactNode }[] = [
    { f: 'inbox', icon: <Inbox size={20} /> }, { f: 'archive', icon: <Archive size={20} /> }, { f: 'drafts', icon: <FileText size={20} /> },
    { f: 'sent', icon: <Send size={20} /> }, { f: 'junk', icon: <ShieldAlert size={20} /> }, { f: 'trash', icon: <Trash2 size={20} /> },
  ]
  return (
    <Sheet open={!!ids} onClose={onClose} title={`Move ${ids?.length ?? 0} Message${ids?.length === 1 ? '' : 's'}`} detent="medium">
      <List header="iCloud">
        {folders.map(({ f, icon }) => (
          <Row key={f} icon={<span className="ml-boxicon">{icon}</span>} title={BOX_TITLE[f as Box]} onClick={() => {
            if (!ids) return
            moveMail(ids, f)
            useOS.getState().showToast(`Moved to ${BOX_TITLE[f as Box]}`, 'folder')
            onClose()
            onMoved?.()
          }} />
        ))}
      </List>
    </Sheet>
  )
}

// ------------------------------------------------------------------ compose
function ComposeSheet() {
  const { open, draft, set } = useCompose()
  const [to, setTo] = useState('')
  const [cc, setCc] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [attachments, setAttachments] = useState<NonNullable<MailMessage['attachments']>>([])
  const [focus, setFocus] = useState<'to' | 'cc' | null>(null)
  const [showCc, setShowCc] = useState(false)
  useEffect(() => {
    if (!open) return
    setTo(draft.to)
    setCc(draft.cc)
    setSubject(draft.subject)
    setBody(draft.body)
    setAttachments(draft.attachments ?? [])
    setShowCc(!!draft.cc)
  }, [open, draft])
  const close = () => set({ open: false })
  const recipient = contactFor(to.trim()) ?? CONTACTS.find((c) => contactName(c.id, 'full').toLowerCase() === to.trim().toLowerCase())
  const field = focus === 'to' ? to : focus === 'cc' ? cc : ''
  const suggestions = field.trim() ? CONTACTS.filter((c) => `${contactName(c.id, 'full')} ${c.nickname ?? ''} ${c.emails.join(' ')}`.toLowerCase().includes(field.trim().toLowerCase().split(/,\s*/).pop() ?? '')).slice(0, 4) : []
  const pick = (email: string) => {
    if (focus === 'cc') setCc(email)
    else setTo(email)
    setFocus(null)
  }
  const cancel = () => {
    if (!body.trim() && !subject.trim()) return close()
    showAlert({
      title: 'Save this draft?',
      actions: [
        { label: 'Delete Draft', style: 'destructive', onPress: () => { if (draft.draftId) deleteForever([draft.draftId]); close() } },
        { label: 'Save Draft', onPress: () => {
          const st = useOS.getState()
          if (draft.draftId) st.updateMail(draft.draftId, { to, subject: subject || '(No Subject)', body, ts: Date.now() })
          else st.addMail({ from: { name: 'Jamie Park', email: ME_EMAIL }, to, subject: subject || '(No Subject)', body, ts: Date.now(), unread: false, folder: 'drafts', category: 'primary' })
          st.showToast('Draft Saved', 'doc')
          close()
        } },
        { label: 'Keep Editing', style: 'cancel' },
      ],
    })
  }
  const send = () => {
    const toAddr = recipient ? recipient.emails[0] : to.trim()
    if (!toAddr) return
    const st = useOS.getState()
    const d: Draft = { to, cc, subject, body, replyTo: draft.replyTo, thread: draft.thread, attachments }
    const id = st.addMail({ from: { name: 'Jamie Park', email: ME_EMAIL }, to: toAddr, subject: subject || '(No Subject)', body, ts: Date.now(), unread: false, folder: 'sent', category: 'primary', thread: draft.thread, attachments: attachments.length ? attachments : undefined })
    if (draft.draftId) deleteForever([draft.draftId])
    close()
    set({ undo: { id, draft: d } })
  }
  const attachFile = (el: HTMLElement) => {
    openMenu(el, [
      { label: 'Itinerary-7XKQ2P.pdf', icon: <FileText size={18} />, onSelect: () => setAttachments((a) => [...a, { name: 'Itinerary-7XKQ2P.pdf', size: '184 KB', kind: 'pdf' }]) },
      { label: 'Unit 3 Worksheet.pdf', icon: <FileText size={18} />, onSelect: () => setAttachments((a) => [...a, { name: 'Unit 3 Worksheet.pdf', size: '1.1 MB', kind: 'pdf' }]) },
      { label: 'Robot Budget 2026.numbers', icon: <FileText size={18} />, onSelect: () => setAttachments((a) => [...a, { name: 'Robot Budget 2026.numbers', size: '220 KB', kind: 'doc' }]) },
      { label: 'Photo: Team at the arena', icon: <ImageIcon size={18} />, onSelect: () => setAttachments((a) => [...a, { name: 'IMG_2041.heic', size: '3.2 MB', kind: 'image' }]) },
    ], { title: 'Attach' })
  }
  return (
    <Sheet open={open} onClose={cancel} title={subject || 'New Message'} detent="large" closeButton={false}
      leading={<button className="bar-btn icon glass interactive" onClick={cancel} aria-label="Cancel"><X size={20} /></button>}
      trailing={<button className="ml-send" onClick={send} disabled={!to.trim()} aria-label="Send"><ArrowUp size={20} strokeWidth={2.6} /></button>}
    >
      <div className="ml-compose">
        <div className="ml-field">
          <label>To:</label>
          <input value={to} onChange={(e) => setTo(e.target.value)} onFocus={() => setFocus('to')} onBlur={() => window.setTimeout(() => setFocus((f) => (f === 'to' ? null : f)), 150)} aria-label="To" autoCapitalize="off" data-dictation="alex|mom|mr delgado" />
          {recipient && <span className="ml-rcpt">{contactName(recipient.id, 'full')}</span>}
          <button className="ml-addc" onClick={() => setShowCc((s) => !s)} aria-label="Show Cc"><Plus size={18} /></button>
        </div>
        {focus && suggestions.length > 0 && (
          <div className="ml-rsugg">
            {suggestions.map((c) => (
              <button key={c.id} onPointerDown={(e) => e.preventDefault()} onClick={() => pick(c.emails[0])}>
                <Avatar id={c.id} size={30} />
                <span><b>{contactName(c.id, 'full')}</b><small>{c.emails[0]}</small></span>
              </button>
            ))}
          </div>
        )}
        {showCc && (
          <div className="ml-field">
            <label>Cc/Bcc:</label>
            <input value={cc} onChange={(e) => setCc(e.target.value)} onFocus={() => setFocus('cc')} onBlur={() => window.setTimeout(() => setFocus((f) => (f === 'cc' ? null : f)), 150)} aria-label="Cc" autoCapitalize="off" />
          </div>
        )}
        <div className="ml-field">
          <label>Subject:</label>
          <input value={subject} onChange={(e) => setSubject(e.target.value)} aria-label="Subject" data-mail="1" />
        </div>
        {attachments.length > 0 && (
          <div className="ml-compose-att">
            {attachments.map((a, i) => (
              <span key={i} className="ml-att-chip"><Paperclip size={13} /> {a.name}<button onClick={() => setAttachments((x) => x.filter((_, j) => j !== i))} aria-label={`Remove ${a.name}`}><X size={12} /></button></span>
            ))}
          </div>
        )}
        <textarea className="ml-compose-body" value={body} onChange={(e) => setBody(e.target.value)} placeholder="" aria-label="Message body" data-mail="1" data-recipient={recipient?.id} rows={12} data-dictation="thanks for the update see you thursday|could we move this to friday afternoon|I will bring the permission slip tomorrow" />
        <div className="ml-compose-tools">
          <button onClick={(e) => attachFile(e.currentTarget)} aria-label="Attach file"><Paperclip size={20} /></button>
          <span className="ml-sig">Sent from my iPhone</span>
        </div>
      </div>
    </Sheet>
  )
}

function UndoSendBanner() {
  const undo = useCompose((s) => s.undo)
  const set = useCompose((s) => s.set)
  useEffect(() => {
    if (!undo) return
    const t = window.setTimeout(() => {
      set({ undo: null })
      useOS.getState().flashIsland({ kind: 'generic', title: 'Message Sent', subtitle: 'Mail', duration: 1600 })
    }, 5000)
    return () => window.clearTimeout(t)
  }, [undo, set])
  if (!undo) return null
  return (
    <div className="ml-undo glass heavy anim-up" role="status">
      <Spinner size={16} />
      <span>Sending…</span>
      <button onClick={() => {
        deleteForever([undo.id])
        set({ undo: null, open: true, draft: undo.draft })
      }}><Undo2 size={15} /> Undo Send</button>
    </div>
  )
}
