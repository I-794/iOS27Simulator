import { useMemo, useRef, useState, type ReactNode } from 'react'
import { SquarePen, ListFilter, Search, Mic, X, BellOff, Trash2, Pin, PinOff, MessageCircle, MailOpen, Check, CloudCheck, CloudOff, CloudUpload, Bell, ChevronRight, RotateCcw } from 'lucide-react'
import type { Conversation, Message } from '../../os/types'
import { useOS } from '../../os/store'
import { Page, BarButton, useNav } from '../../ui/nav'
import { Avatar } from '../../ui/controls'
import { openMenu, showAlert } from '../../ui/overlay'
import { useLongPress, useNow, screenScale } from '../../os/hooks'
import { contactById } from '../../os/data/people'
import { fmtRelative } from '../../os/time'
import { useMsgLocal, msgLocal } from './msgStore'
import { convTitle, convShortTitle, previewText, reactionSummary, isOnline } from './engine'
import { contactMatches, digits, shortName } from '../contacts/shared'

const lastTs = (c: Conversation) => c.messages[c.messages.length - 1]?.ts ?? 0

export function patchConv(id: string, p: Partial<Conversation>) {
  const st = useOS.getState()
  st.set({ conversations: st.conversations.map((c) => (c.id === id ? { ...c, ...p } : c)) })
}

export function deleteConv(c: Conversation) {
  const st = useOS.getState()
  st.set({ conversations: st.conversations.filter((x) => x.id !== c.id) })
  msgLocal().set({ deleted: [{ conv: c, at: Date.now() }, ...msgLocal().deleted].slice(0, 20) })
  st.showToast('Moved to Recently Deleted', '🗑️')
}

function convActions(c: Conversation, onOpen: () => void) {
  const unread = (c.unread ?? 0) > 0
  return [
    { label: 'Open', icon: <MessageCircle size={18} />, onSelect: onOpen },
    { label: c.pinned ? 'Unpin' : 'Pin', icon: c.pinned ? <PinOff size={18} /> : <Pin size={18} />, onSelect: () => patchConv(c.id, { pinned: !c.pinned }) },
    { label: unread ? 'Mark as Read' : 'Mark as Unread', icon: <MailOpen size={18} />, onSelect: () => patchConv(c.id, { unread: unread ? 0 : 1 }) },
    { label: c.muted ? 'Show Alerts' : 'Hide Alerts', icon: c.muted ? <Bell size={18} /> : <BellOff size={18} />, onSelect: () => patchConv(c.id, { muted: !c.muted }) },
    { label: 'Delete', icon: <Trash2 size={18} />, destructive: true, separatorBefore: true, onSelect: () => confirmDelete(c) },
  ]
}

function confirmDelete(c: Conversation) {
  showAlert({
    title: 'Delete this conversation?',
    message: 'It will be moved to Recently Deleted for 30 days.',
    actions: [{ label: 'Cancel', style: 'cancel' }, { label: 'Delete', style: 'destructive', onPress: () => deleteConv(c) }],
  })
}

function ConvAvatar({ c, size }: { c: Conversation; size: number }) {
  if (c.participants.length === 1) return <Avatar id={c.participants[0]} size={size} />
  const [a, b, d] = c.participants
  return (
    <div className="msg-cluster" style={{ width: size, height: size }}>
      <Avatar id={a} size={size * 0.56} style={{ position: 'absolute', left: 0, top: size * 0.06 }} />
      <Avatar id={b} size={size * 0.46} style={{ position: 'absolute', right: 0, top: 0 }} />
      {d && <Avatar id={d} size={size * 0.5} style={{ position: 'absolute', right: size * 0.12, bottom: 0 }} />}
    </div>
  )
}

function Preview({ c }: { c: Conversation }): ReactNode {
  const m = c.messages[c.messages.length - 1]
  if (c.draft) return <><span className="msg-draft">Draft</span> {c.draft}</>
  if (!m) return 'No messages'
  if (m.from === 'me' && m.status === 'failed') return <><span className="msg-row-failed">Not Delivered</span> · {previewText(m)}</>
  if (m.from === 'me' && m.attachment?.progress !== undefined && m.attachment.progress < 1) return `Uploading ${m.attachment.kind}… ${Math.round(m.attachment.progress * 100)}%`
  const prefix = c.participants.length > 1 && m.from !== 'me' ? `${shortName(m.from)}: ` : ''
  return prefix + previewText(m)
}

/** Consolidated Tapbacks for the most recent reacted message ("Leo and 2 others reacted ❤️ to a photo"). */
function recentReaction(c: Conversation): string | null {
  let best: Message | null = null
  let bestN = 0
  for (let i = c.messages.length - 1; i >= Math.max(0, c.messages.length - 4); i--) {
    const m = c.messages[i]
    const n = new Set((m.reactions ?? []).filter((r) => r.from !== 'me').map((r) => r.from)).size
    if (n > bestN) {
      best = m
      bestN = n
    }
  }
  return best && bestN >= 1 ? reactionSummary(best) : null
}

function SwipeRow({ c, onOpen, now }: { c: Conversation; onOpen: () => void; now: number }) {
  const [dx, setDx] = useState(0)
  const [anim, setAnim] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const lp = useLongPress((el) => openMenu(el, convActions(c, onOpen), { title: convTitle(c) }))
  const unread = (c.unread ?? 0) > 0
  const reaction = c.participants.length > 1 ? recentReaction(c) : null
  const m: Message | undefined = c.messages[c.messages.length - 1]

  const settle = (x: number) => {
    setAnim(true)
    setDx(x)
    window.setTimeout(() => setAnim(false), 320)
  }

  const onPointerDown = (e: React.PointerEvent) => {
    lp.onPointerDown(e)
    if (e.button !== 0) return
    const s = screenScale()
    const x0 = e.clientX
    const y0 = e.clientY
    const base = dx
    let horiz: boolean | null = null
    let cur = base
    const move = (ev: PointerEvent) => {
      const mx = (ev.clientX - x0) / s
      const my = (ev.clientY - y0) / s
      if (horiz === null && Math.hypot(mx, my) > 8) horiz = Math.abs(mx) > Math.abs(my)
      if (horiz) {
        cur = Math.max(-300, Math.min(260, base + mx))
        setDx(cur)
      }
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      if (!horiz) return
      if (cur < -250) {
        settle(0)
        confirmDelete(c)
      } else if (cur > 220) {
        settle(0)
        patchConv(c.id, { unread: unread ? 0 : 1 })
      } else if (cur < -60) settle(-150)
      else if (cur > 60) settle(150)
      else settle(0)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  return (
    <div className="msg-swipe" ref={ref}>
      {dx > 0 && (
        <div className="msg-swipe-lead" style={{ width: dx }}>
          <button className="msg-swipe-btn blue" onClick={() => { patchConv(c.id, { unread: unread ? 0 : 1 }); settle(0) }} aria-label={unread ? 'Mark as Read' : 'Mark as Unread'}>
            <MailOpen size={20} /><span>{unread ? 'Read' : 'Unread'}</span>
          </button>
          <button className="msg-swipe-btn orange" onClick={() => { patchConv(c.id, { pinned: !c.pinned }); settle(0) }} aria-label={c.pinned ? 'Unpin' : 'Pin'}>
            {c.pinned ? <PinOff size={20} /> : <Pin size={20} />}<span>{c.pinned ? 'Unpin' : 'Pin'}</span>
          </button>
        </div>
      )}
      {dx < 0 && (
        <div className="msg-swipe-trail" style={{ width: -dx }}>
          <button className="msg-swipe-btn indigo" onClick={() => { patchConv(c.id, { muted: !c.muted }); settle(0) }} aria-label={c.muted ? 'Show Alerts' : 'Hide Alerts'}>
            {c.muted ? <Bell size={20} /> : <BellOff size={20} />}<span>{c.muted ? 'Alerts' : 'Hide'}</span>
          </button>
          <button className="msg-swipe-btn red" onClick={() => { settle(0); confirmDelete(c) }} aria-label="Delete">
            <Trash2 size={20} /><span>Delete</span>
          </button>
        </div>
      )}
      <div
        className="msg-conv"
        role="button"
        tabIndex={0}
        aria-label={`${convTitle(c)}${unread ? ', unread' : ''}`}
        style={{ transform: dx ? `translateX(${dx}px)` : undefined, transition: anim ? 'transform .32s var(--spring-snappy)' : 'none' }}
        onPointerDown={onPointerDown}
        onPointerUp={lp.onPointerUp}
        onPointerMove={lp.onPointerMove}
        onPointerLeave={lp.onPointerLeave}
        onContextMenu={lp.onContextMenu}
        onClickCapture={lp.onClickCapture}
        onClick={() => (dx ? settle(0) : onOpen())}
        onKeyDown={(e) => e.key === 'Enter' && onOpen()}
      >
        <span className={`msg-unread-dot ${unread ? 'on' : ''}`} />
        <ConvAvatar c={c} size={50} />
        <div className="msg-conv-main">
          <div className="msg-conv-top">
            <span className="msg-conv-name">{convTitle(c)}</span>
            {c.muted && <BellOff size={13} className="secondary" />}
            <span className="msg-conv-time">{m ? fmtRelative(m.ts, now) : ''}</span>
            <ChevronRight size={15} strokeWidth={2.6} className="tertiary" />
          </div>
          <div className="msg-conv-preview">
            {reaction ? (
              <>
                <span className="msg-conv-preview-1"><Preview c={c} /></span>
                <span className="msg-conv-react">{reaction}</span>
              </>
            ) : (
              <Preview c={c} />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function PinnedItem({ c, onOpen }: { c: Conversation; onOpen: () => void }) {
  const lp = useLongPress((el) => openMenu(el, convActions(c, onOpen), { title: convTitle(c) }))
  const unread = (c.unread ?? 0) > 0
  const m = c.messages[c.messages.length - 1]
  const typing = useMsgLocal((s) => s.typing[c.id])
  return (
    <button className="msg-pin" onClick={onOpen} {...lp} aria-label={`${convTitle(c)} (pinned)${unread ? ', unread' : ''}`}>
      {(unread && m && m.from !== 'me') || typing ? (
        <span className="msg-pin-bubble anim-pop">{typing ? <span className="msg-pin-typing"><i /><i /><i /></span> : previewText(m!)}</span>
      ) : null}
      <span className="msg-pin-avatar">
        <ConvAvatar c={c} size={78} />
        {unread && <span className="msg-pin-dot" />}
      </span>
      <span className="msg-pin-name">{convShortTitle(c)}</span>
    </button>
  )
}

function SyncFooter() {
  const convs = useOS((s) => s.conversations)
  const net = useOS((s) => s.net)
  const online = isOnline(net)
  const uploading = convs.flatMap((c) => c.messages).filter((m) => m.from === 'me' && m.attachment?.progress !== undefined && m.attachment.progress < 1)
  const failed = convs.flatMap((c) => c.messages).filter((m) => m.status === 'failed').length
  let icon = <CloudCheck size={15} />
  let text: ReactNode = <>Messages in iCloud · <b>Up to date</b></>
  if (!online) {
    icon = <CloudOff size={15} />
    text = <>Waiting for network{failed ? ` · ${failed} to send` : ''}</>
  } else if (uploading.length) {
    const p = uploading.reduce((n, m) => n + (m.attachment!.progress ?? 0), 0) / uploading.length
    icon = <CloudUpload size={15} />
    text = <>Uploading {uploading.length} item{uploading.length > 1 ? 's' : ''} · {Math.round(p * 100)}%</>
  }
  return (
    <div className="msg-sync" role="status">
      {icon}
      <span>{text}</span>
    </div>
  )
}

function highlightText(text: string, q: string) {
  const i = text.toLowerCase().indexOf(q.toLowerCase())
  if (i < 0 || !q) return text
  const start = Math.max(0, i - 24)
  return (
    <>
      {start > 0 ? '…' : ''}
      {text.slice(start, i)}
      <mark>{text.slice(i, i + q.length)}</mark>
      {text.slice(i + q.length)}
    </>
  )
}

function SearchResults({ q, convs, onOpen }: { q: string; convs: Conversation[]; onOpen: (id: string, msgId?: string) => void }) {
  const query = q.trim()
  const d = digits(query)
  const people = convs.filter((c) => (c.name ?? '').toLowerCase().includes(query.toLowerCase()) || c.participants.some((p) => {
    const ct = contactById(p)
    return ct ? contactMatches(ct, query) : false
  }))
  const hits = query.length < 2 || (d.length >= 3 && d.length === query.replace(/[\s()-]/g, '').length)
    ? []
    : convs.flatMap((c) => c.messages.filter((m) => m.text?.toLowerCase().includes(query.toLowerCase())).map((m) => ({ c, m }))).sort((a, b) => b.m.ts - a.m.ts).slice(0, 20)
  if (!query) {
    return (
      <div className="msg-search-hint">
        <div className="msg-search-sec">Suggested</div>
        <div className="msg-search-people">
          {convs.slice(0, 4).map((c) => (
            <button key={c.id} onClick={() => onOpen(c.id)}>
              <ConvAvatar c={c} size={56} />
              <span>{convShortTitle(c)}</span>
            </button>
          ))}
        </div>
        <div className="msg-search-tip">Search by name, nickname, phone number or message text.</div>
      </div>
    )
  }
  return (
    <div className="msg-search-results">
      {people.length > 0 && <div className="msg-search-sec">Conversations</div>}
      {people.map((c) => {
        const ct = c.participants.length === 1 ? contactById(c.participants[0]) : undefined
        const phoneHit = ct && d.length >= 3 ? ct.phones.find((p) => digits(p).includes(d)) : undefined
        const nickHit = ct?.nickname && ct.nickname.toLowerCase().startsWith(query.toLowerCase()) ? `“${ct.nickname}”` : undefined
        return (
          <button key={c.id} className="msg-search-row" onClick={() => onOpen(c.id)}>
            <ConvAvatar c={c} size={40} />
            <span className="grow col" style={{ alignItems: 'flex-start' }}>
              <span className="msg-conv-name">{convTitle(c)}</span>
              <span className="t-subhead secondary">{phoneHit ?? nickHit ?? (c.participants.length > 1 ? c.participants.map(shortName).join(', ') : ct?.company ?? ct?.phones[0])}</span>
            </span>
          </button>
        )
      })}
      {hits.length > 0 && <div className="msg-search-sec">Messages</div>}
      {hits.map(({ c, m }) => (
        <button key={m.id} className="msg-search-row" onClick={() => onOpen(c.id, m.id)}>
          <ConvAvatar c={c} size={40} />
          <span className="grow col" style={{ alignItems: 'flex-start', minWidth: 0 }}>
            <span className="row" style={{ width: '100%' }}>
              <span className="msg-conv-name grow">{convTitle(c)}</span>
              <span className="t-footnote secondary">{fmtRelative(m.ts)}</span>
            </span>
            <span className="msg-search-snippet">{m.from === 'me' ? 'You: ' : c.participants.length > 1 ? `${shortName(m.from)}: ` : ''}{highlightText(m.text ?? '', query)}</span>
          </span>
        </button>
      ))}
      {!people.length && !hits.length && (
        <div className="empty-state"><div className="t-title2">No Results for “{query}”</div><div>Check the spelling or try a new search.</div></div>
      )}
    </div>
  )
}

export function RecentlyDeleted() {
  const deleted = useMsgLocal((s) => s.deleted)
  const recover = (i: number) => {
    const item = deleted[i]
    const st = useOS.getState()
    st.set({ conversations: [item.conv, ...st.conversations.filter((c) => c.id !== item.conv.id)] })
    msgLocal().set({ deleted: deleted.filter((_, j) => j !== i) })
    st.showToast('Conversation recovered', '↩️')
  }
  return (
    <Page title="Recently Deleted" grouped large={false}>
      {deleted.length === 0 ? (
        <div className="empty-state" style={{ paddingTop: 140 }}>
          <Trash2 size={44} strokeWidth={1.5} />
          <div className="t-title2">No Messages</div>
          <div>Conversations you delete stay here for 30 days.</div>
        </div>
      ) : (
        <>
          <div className="list-footer" style={{ marginTop: 6, paddingBottom: 12 }}>Messages are available here for 30 days. After that, they’ll be permanently deleted.</div>
          <div className="list">
            {deleted.map((d, i) => (
              <div key={d.conv.id + d.at} className="row-item">
                <ConvAvatar c={d.conv} size={40} />
                <span className="row-main">
                  <span className="row-title">{convTitle(d.conv)}</span>
                  <span className="row-sub">30 days</span>
                </span>
                <button className="btn tinted small" onClick={() => recover(i)}><RotateCcw size={14} /> Recover</button>
              </div>
            ))}
          </div>
          <div style={{ padding: '0 16px' }}>
            <button className="btn destructive block" onClick={() => msgLocal().set({ deleted: [] })}>Delete All</button>
          </div>
        </>
      )}
    </Page>
  )
}

export function ConversationList({ onOpen, onCompose }: { onOpen: (id: string, msgId?: string) => void; onCompose: () => void }) {
  const nav = useNav()
  const convs = useOS((s) => s.conversations)
  const filter = useMsgLocal((s) => s.filter)
  const [q, setQ] = useState('')
  const [searching, setSearching] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const now = useNow(30_000)
  const sorted = useMemo(() => [...convs].sort((a, b) => lastTs(b) - lastTs(a)), [convs])
  const pinned = sorted.filter((c) => c.pinned)
  const rest = sorted.filter((c) => !c.pinned && (filter === 'all' || (c.unread ?? 0) > 0))
  const unreadCount = convs.filter((c) => (c.unread ?? 0) > 0).length

  const filterMenu = (el: HTMLElement) =>
    openMenu(el, [
      { label: 'All Messages', icon: filter === 'all' ? <Check size={18} /> : undefined, onSelect: () => msgLocal().set({ filter: 'all' }) },
      { label: `Unread${unreadCount ? ` (${unreadCount})` : ''}`, icon: filter === 'unread' ? <Check size={18} /> : undefined, onSelect: () => msgLocal().set({ filter: 'unread' }) },
      { label: 'Mark All as Read', icon: <MailOpen size={18} />, separatorBefore: true, disabled: !unreadCount, onSelect: () => useOS.getState().set({ conversations: useOS.getState().conversations.map((c) => ({ ...c, unread: 0 })) }) },
      { label: 'Recently Deleted', icon: <Trash2 size={18} />, onSelect: () => nav.push(<RecentlyDeleted />) },
    ])

  const closeSearch = () => {
    setSearching(false)
    setQ('')
    input.current?.blur()
  }

  return (
    <Page
      title={searching ? 'Search' : filter === 'unread' ? 'Unread' : 'Messages'}
      bottomExtra={76}
      leading={
        !searching && (
          <button className="bar-btn icon glass interactive" aria-label="Filter" onClick={(e) => filterMenu(e.currentTarget)}>
            <ListFilter size={21} strokeWidth={2.2} color={filter !== 'all' ? 'var(--accent)' : undefined} />
          </button>
        )
      }
      trailing={!searching && <BarButton label="Compose" onClick={onCompose}><SquarePen size={21} strokeWidth={2.2} /></BarButton>}
      footer={
        <div className="msg-searchbar">
          <label className={`msg-searchbar-field glass ${searching ? 'active' : ''}`}>
            <Search size={18} strokeWidth={2.4} />
            <input
              ref={input}
              value={q}
              placeholder="Search"
              aria-label="Search messages"
              enterKeyHint="search"
              onFocus={() => setSearching(true)}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === 'Escape' && closeSearch()}
            />
            {q ? (
              <button aria-label="Clear" className="msg-search-clear" onClick={() => setQ('')}><X size={12} strokeWidth={3} /></button>
            ) : (
              <Mic size={18} />
            )}
          </label>
          {searching && (
            <button className="msg-circle glass interactive anim-pop" aria-label="Cancel search" onClick={closeSearch}>
              <X size={20} strokeWidth={2.4} />
            </button>
          )}
        </div>
      }
    >
      {searching ? (
        <SearchResults q={q} convs={sorted} onOpen={(id, mid) => { closeSearch(); onOpen(id, mid) }} />
      ) : (
        <>
          {pinned.length > 0 && filter === 'all' && (
            <div className="msg-pins">
              {pinned.map((c) => <PinnedItem key={c.id} c={c} onOpen={() => onOpen(c.id)} />)}
            </div>
          )}
          <div className="msg-convs" role="list">
            {rest.map((c) => <SwipeRow key={c.id} c={c} now={now} onOpen={() => onOpen(c.id)} />)}
          </div>
          {rest.length === 0 && filter === 'unread' && (
            <div className="empty-state"><div className="t-title2">No Unread Messages</div><button className="btn tinted small" onClick={() => msgLocal().set({ filter: 'all' })}>Show All Messages</button></div>
          )}
          <SyncFooter />
        </>
      )}
    </Page>
  )
}

