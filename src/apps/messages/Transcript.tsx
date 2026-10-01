import { useEffect, useLayoutEffect, useMemo, useRef, useState, Fragment, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight, Video, Phone, Check, X, Heart, Share, Plane, Reply, Copy, Undo2, Trash2, Pencil, Download, Images, Plus } from 'lucide-react'
import type { Message } from '../../os/types'
import { useOS } from '../../os/store'
import { useNav } from '../../ui/nav'
import { Avatar, AISparkle } from '../../ui/controls'
import { showAlert } from '../../ui/overlay'
import { useOnscreen, screenScale, useNow } from '../../os/hooks'
import { contactById } from '../../os/data/people'
import { smartReplies } from '../../os/ai/writing'
import { fmtWhen } from '../../os/ai/parse'
import { fmtTime, fmtRelative, DAY, MIN } from '../../os/time'
import { setNativeValue } from '../../ui/Keyboard'
import { playAlert } from '../../os/audio'
import { Scene } from '../../art/Scene'
import { useShell } from '../../shell/shellState'
import { MessageRow, timeHeader, type RowCtx } from './Bubble'
import { Composer, ReplyChips, CameraQuick, sendPhotos } from './Composer'
import { PhotoPicker } from './PhotoPicker'
import { DrawingSheet } from './DrawingSheet'
import { ConvDetails } from './ConvDetails'
import { suggestionsFor, type Suggestion } from './detect'
import { useMsgLocal, msgLocal } from './msgStore'
import { convTitle, convService, sendMsg, toggleReaction } from './engine'
import { shortName } from '../contacts/shared'

const TAPBACKS = ['❤️', '👍', '👎', '😂', '‼️', '❓']
const MORE_EMOJI = ['🔥', '🥹', '😭', '🙏', '🎉', '👏', '😍', '🤯', '💯', '🥁', '🤖', '🐶', '😮', '🙌', '✨', '😎', '🤔', '😅', '🫶', '💀', '👀', '🍕', '⚡️', '🏆']

function ActionMenu({ m, rect, root, onClose, onReply, onEdit, conv }: { m: Message; rect: { x: number; y: number; w: number; h: number }; root: HTMLElement; onClose: () => void; onReply: () => void; onEdit: () => void; conv: { id: string } }) {
  const cloneHost = useRef<HTMLDivElement>(null)
  const [emoji, setEmoji] = useState(false)
  const mine = m.from === 'me'
  const my = m.reactions?.find((r) => r.from === 'me')?.emoji
  const H = root.offsetHeight
  const W = root.offsetWidth
  const canUndo = mine && Date.now() - m.ts < 2 * MIN && m.status !== 'failed'
  const items: { label: string; icon: ReactNode; onSelect: () => void; destructive?: boolean }[] = [
    { label: 'Reply', icon: <Reply size={19} />, onSelect: onReply },
    ...(m.text ? [{ label: 'Copy', icon: <Copy size={19} />, onSelect: () => { void navigator.clipboard?.writeText(m.text ?? '').catch(() => {}); useOS.getState().showToast('Copied', '📋') } }] : []),
    ...(m.attachment?.photoId && !m.attachment.offloaded ? [{ label: 'Save', icon: <Download size={19} />, onSelect: () => { useOS.getState().updatePhoto(m.attachment!.photoId!, { favorite: true }); useOS.getState().showToast('Saved to Photos', '🖼️') } }] : []),
    ...(mine && m.text && Date.now() - m.ts < 15 * MIN ? [{ label: 'Edit', icon: <Pencil size={19} />, onSelect: onEdit }] : []),
    ...(canUndo ? [{ label: 'Undo Send', icon: <Undo2 size={19} />, onSelect: () => removeMsg(conv.id, m.id, true) }] : []),
    { label: 'Delete', icon: <Trash2 size={19} />, destructive: true, onSelect: () => showAlert({ title: 'Delete Message?', message: 'This message will be deleted from all your devices.', actions: [{ label: 'Cancel', style: 'cancel' }, { label: 'Delete', style: 'destructive', onPress: () => removeMsg(conv.id, m.id) }] }) },
  ]
  const barH = 52
  const menuH = items.length * 46 + 12
  const h = Math.min(rect.h, H - barH - menuH - 120)
  let top = rect.y
  const minTop = parseFloat(getComputedStyle(root).getPropertyValue('--safe-top')) + barH + 16
  if (top - barH - 12 < minTop - barH) top = minTop
  if (top + h + 12 + menuH > H - 24) top = Math.max(minTop, H - 24 - menuH - 12 - h)

  useLayoutEffect(() => {
    const host = cloneHost.current
    const src = root.querySelector(`[data-mid="${m.id}"] .msg-body`) as HTMLElement | null
    if (!host || !src) return
    const clone = src.cloneNode(true) as HTMLElement
    clone.removeAttribute('tabindex')
    clone.style.margin = '0'
    host.appendChild(clone)
    return () => clone.remove()
  }, [m.id, root])

  const react = (e: string) => {
    toggleReaction(conv.id, m.id, e)
    playAlert('tapback', useOS.getState().silent ? 0 : useOS.getState().volume * 0.5)
    onClose()
  }
  const barLeft = mine ? Math.max(12, Math.min(W - 332, rect.x + rect.w - 320)) : Math.max(12, Math.min(W - 332, rect.x))
  return (
    <div className="msg-lp" onClick={onClose} onContextMenu={(e) => { e.preventDefault(); onClose() }}>
      <div className="msg-lp-backdrop" />
      <div className={`msg-lp-bar glass heavy ${emoji ? 'expanded' : ''}`} style={{ top: emoji ? Math.max(minTop - barH, top - 230) : top - barH - 10, left: barLeft }} onClick={(e) => e.stopPropagation()} role="toolbar" aria-label="Tapback">
        {emoji ? (
          <div className="msg-lp-emoji-grid">
            {[...TAPBACKS, ...MORE_EMOJI].map((e) => <button key={e} onClick={() => react(e)} aria-label={`React ${e}`}>{e}</button>)}
          </div>
        ) : (
          <>
            {TAPBACKS.map((e) => (
              <button key={e} className={my === e ? 'on' : ''} onClick={() => react(e)} aria-label={`React ${e}`}>{e}</button>
            ))}
            <button className="msg-lp-more" onClick={() => setEmoji(true)} aria-label="More emoji"><Plus size={20} /></button>
          </>
        )}
      </div>
      <div className={`msg-lp-clone ${mine ? 'me' : 'them'}`} ref={cloneHost} style={{ top, left: rect.x, width: rect.w, maxHeight: h }} />
      {!emoji && (
        <div className="msg-lp-menu glass heavy" style={{ top: top + h + 12, ...(mine ? { right: Math.max(12, W - rect.x - rect.w) } : { left: Math.max(12, rect.x) }) }} role="menu" onClick={(e) => e.stopPropagation()}>
          {items.map((it) => (
            <button key={it.label} role="menuitem" className={it.destructive ? 'destructive' : ''} onClick={() => { onClose(); it.onSelect() }}>
              <span>{it.label}</span>
              {it.icon}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function removeMsg(convId: string, msgId: string, undo = false) {
  const st = useOS.getState()
  st.set({ conversations: st.conversations.map((c) => (c.id === convId ? { ...c, messages: c.messages.filter((m) => m.id !== msgId) } : c)) })
  if (undo) st.showToast('Message unsent', '↩️')
}

function PhotoViewer({ photoId, subtitle, onClose }: { photoId: string; subtitle: string; onClose: () => void }) {
  const photo = useOS((s) => s.photos.find((p) => p.id === photoId))
  useEffect(() => {
    useShell.getState().set({ statusOverride: 'light' })
    return () => useShell.getState().set({ statusOverride: null })
  }, [])
  if (!photo) return null
  return (
    <div className="msg-viewer anim-fade" role="dialog" aria-label="Photo">
      <Scene scene={photo.scene} fit="contain" className="msg-viewer-img" />
      <div className="msg-viewer-top">
        <button className="bar-btn icon glass dark-glass" aria-label="Close" onClick={onClose}><X size={20} /></button>
        <div className="msg-viewer-title">
          <div>{subtitle}</div>
          <div className="msg-viewer-sub">{photo.place ?? ''}</div>
        </div>
        <span style={{ width: 44 }} />
      </div>
      <div className="msg-viewer-bottom">
        <button className="bar-btn icon glass dark-glass" aria-label="Share" onClick={() => useOS.getState().set({ shareRequest: { title: photo.description, kind: 'photo', photoId: photo.id, app: 'messages' } })}><Share size={20} /></button>
        <button className="bar-btn icon glass dark-glass" aria-label={photo.favorite ? 'Unfavorite' : 'Favorite'} onClick={() => useOS.getState().updatePhoto(photo.id, { favorite: !photo.favorite })}><Heart size={20} fill={photo.favorite ? '#fff' : 'none'} /></button>
        <button className="bar-btn glass dark-glass" onClick={() => useOS.getState().launch('photos', { route: `photo/${photo.id}` })}><Images size={18} /> All Photos</button>
      </div>
    </div>
  )
}

export function Transcript({ convId, highlight }: { convId: string; highlight?: string }) {
  const nav = useNav()
  const conv = useOS((s) => s.conversations.find((c) => c.id === convId))
  const totalUnread = useOS((s) => s.conversations.reduce((n, c) => n + (c.id === convId ? 0 : c.unread ?? 0), 0))
  const net = useOS((s) => s.net)
  const typing = useMsgLocal((s) => s.typing[convId])
  const replies = useMsgLocal((s) => s.replies)
  const readAt = useMsgLocal((s) => s.readAt)
  const sugg = useMsgLocal((s) => s.suggestions)
  const now = useNow(30_000)
  const [replyTo, setReplyTo] = useState<Message | null>(null)
  const [menu, setMenu] = useState<{ m: Message; rect: { x: number; y: number; w: number; h: number } } | null>(null)
  const [viewer, setViewer] = useState<string | null>(null)
  const [photoReq, setPhotoReq] = useState<Suggestion & { kind: 'photos' } | null>(null)
  const [picker, setPicker] = useState(false)
  const [drawing, setDrawing] = useState(false)
  const [camera, setCamera] = useState(false)
  const [details, setDetails] = useState(false)
  const [hl, setHl] = useState<string | undefined>(highlight)
  const [editing, setEditing] = useState<Message | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const fieldRef = useRef<HTMLTextAreaElement>(null)
  const composerRef = useRef<HTMLDivElement>(null)

  const title = conv ? convTitle(conv) : ''
  const group = (conv?.participants.length ?? 0) > 1
  const service = conv ? convService(conv) : 'iMessage'
  const sms = service !== 'iMessage'
  const online = !net.airplane && (net.wifi || net.cellular)
  useOnscreen('messages', `Conversation with ${title}`, { type: 'conversation', convId, name: title })

  // open / read state
  useEffect(() => {
    msgLocal().set({ openConv: convId })
    return () => {
      if (msgLocal().openConv === convId) msgLocal().set({ openConv: null })
    }
  }, [convId])
  const count = conv?.messages.length ?? 0
  const unread = conv?.unread ?? 0
  const appOpen = useOS((s) => s.openApp === 'messages')
  useEffect(() => {
    if (unread && appOpen) useOS.getState().markConversationRead(convId)
  }, [unread, appOpen, convId, count])

  // scrolling
  const atBottom = useRef(true)
  useLayoutEffect(() => {
    const el = scrollRef.current
    if (el && !highlight) el.scrollTop = el.scrollHeight
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const lastFromMe = conv?.messages[count - 1]?.from === 'me'
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    if (atBottom.current || lastFromMe) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [count, typing, lastFromMe])
  const kb = useOS((s) => s.keyboardOpen)
  useEffect(() => {
    const el = scrollRef.current
    if (!el || !atBottom.current) return
    const t = window.setTimeout(() => el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' }), 60)
    return () => window.clearTimeout(t)
  }, [kb])
  useEffect(() => {
    if (!highlight) return
    setHl(highlight)
    const t1 = window.setTimeout(() => {
      const el = scrollRef.current?.querySelector(`[data-mid="${highlight}"]`) as HTMLElement | null
      if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' })
      else if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }, 380)
    const t2 = window.setTimeout(() => setHl(undefined), 2600)
    return () => {
      window.clearTimeout(t1)
      window.clearTimeout(t2)
    }
  }, [highlight])

  // composer height → transcript padding
  useLayoutEffect(() => {
    const c = composerRef.current
    const r = rootRef.current
    if (!c || !r) return
    const ro = new ResizeObserver(() => {
      r.style.setProperty('--msg-composer-h', `${c.offsetHeight}px`)
      const el = scrollRef.current
      if (el && atBottom.current) requestAnimationFrame(() => (el.scrollTop = el.scrollHeight))
    })
    ro.observe(c)
    return () => ro.disconnect()
  }, [])

  const rowCtx: RowCtx = useMemo(
    () => ({
      conv: conv!,
      group,
      sms,
      onLongPress: (m, el) => {
        const root = rootRef.current!
        const rr = root.getBoundingClientRect()
        const r = el.getBoundingClientRect()
        const s = screenScale()
        fieldRef.current?.blur()
        setMenu({ m, rect: { x: (r.left - rr.left) / s, y: (r.top - rr.top) / s, w: r.width / s, h: r.height / s } })
      },
      onOpenPhoto: (id) => setViewer(id),
      onQuoteTap: (id) => {
        const el = scrollRef.current?.querySelector(`[data-mid="${id}"]`) as HTMLElement | null
        el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
        setHl(id)
        window.setTimeout(() => setHl(undefined), 1800)
      },
    }),
    [conv, group, sms],
  )

  if (!conv) {
    return (
      <div className="msg-transcript" ref={rootRef}>
        <div className="empty-state" style={{ paddingTop: 200 }}>
          <div className="t-title2">Conversation Deleted</div>
          <button className="btn tinted small" onClick={nav.pop}>Back to Messages</button>
        </div>
      </div>
    )
  }

  const msgs = conv.messages
  let lastMine = -1
  for (let i = msgs.length - 1; i >= 0; i--) if (msgs[i].from === 'me' && msgs[i].status !== 'failed') { lastMine = i; break }
  const showReceiptAt = lastMine >= 0 && msgs.slice(lastMine + 1).every((m) => m.from === 'me') ? lastMine : -1

  const act = (s: Suggestion, senderName: string) => {
    const st = useOS.getState()
    const done = (label: string) => msgLocal().set({ suggestions: { ...msgLocal().suggestions, [s.key]: { done: true, label, at: Date.now() } } })
    if (s.kind === 'reminder') {
      st.addReminder({ title: s.title, due: s.due, list: 'reminders', source: 'Messages' })
      done(`Added to Reminders · ${fmtWhen(s.due)}`)
      st.showToast('Reminder added', '✅')
    } else if (s.kind === 'note') {
      st.addNote({ title: s.title, folder: 'Notes', blocks: [{ t: 'p', text: s.text }, { t: 'p', text: `From Messages with ${senderName}` }] })
      done('Saved to Notes')
      st.showToast('Saved to Notes', '📝')
    } else if (s.kind === 'event') {
      st.addEvent({ title: s.title, start: s.start, end: s.end, calendar: 'personal', location: s.location, source: 'Messages' })
      done(`Added to Calendar · ${fmtWhen(s.start)}`)
      st.showToast(`“${s.title}” added to Calendar`, '📅')
    } else if (s.kind === 'photos') {
      setPhotoReq(s)
    }
  }

  const renderSuggestions = (m: Message, i: number) => {
    if (m.from === 'me' || i < msgs.length - 6 || now - m.ts > 3 * DAY) return null
    const c = contactById(m.from)
    const list = suggestionsFor(m, c?.first ?? shortName(m.from), m.ts)
    if (!list.length) return null
    return (
      <div className="msg-suggest" role="list" aria-label="Suggestions">
        {list.map((s) => {
          const state = sugg[s.key]
          if (state && 'dismissed' in state) return null
          if (state && 'done' in state) {
            return (
              <button
                key={s.key}
                className="msg-suggest-done"
                onClick={() => {
                  const st = useOS.getState()
                  if (s.kind === 'reminder') st.launch('reminders', { route: 'list/reminders' })
                  else if (s.kind === 'event') st.launch('calendar')
                  else if (s.kind === 'note') st.launch('notes')
                }}
              >
                <Check size={14} strokeWidth={3} /> {state.label}
              </button>
            )
          }
          return (
            <button key={s.key} className="msg-suggest-chip glass interactive" onClick={() => act(s, c?.first ?? '')} role="listitem">
              <AISparkle size={14} /> {s.label}
            </button>
          )
        })}
      </div>
    )
  }

  const last = msgs[msgs.length - 1]
  const chipReplies = last && last.from !== 'me' && last.text && now - last.ts < 2 * DAY ? smartReplies(last.text, last.from) : []
  const unanswered = chipReplies.length > 0

  const receiptFor = (m: Message, i: number): ReactNode => {
    if (m.status === 'failed') return <div className="msg-receipt me failed">Not Delivered</div>
    if (i !== showReceiptAt) return null
    const up = m.attachment?.progress !== undefined && m.attachment.progress < 1
    const txt = up ? '' : m.status === 'read' ? (group ? 'Read' : <><b>Read</b> {fmtTime(readAt[m.id] ?? m.ts)}</>) : m.status === 'delivered' || m.status === 'sent' ? 'Delivered' : m.status === 'retrying' ? 'Sending…' : m.status === 'sending' ? (online ? '' : 'Waiting for network…') : ''
    if (!txt) return null
    return <div className="msg-receipt me">{txt}</div>
  }

  const otherIds = conv.participants
  const contact = !group ? contactById(otherIds[0]) : undefined

  return (
    <div className="msg-transcript" ref={rootRef}>
      <div className="msg-head">
        <div className="msg-head-edge" />
        <button className="bar-btn icon glass interactive msg-back" aria-label="Back" onClick={nav.pop}>
          <ChevronLeft size={26} strokeWidth={2.4} style={{ marginLeft: -2 }} />
          {totalUnread > 0 && <span className="msg-back-badge">{totalUnread}</span>}
        </button>
        <button className="msg-head-center" onClick={() => setDetails(true)} aria-label={`${title} details`}>
          <span className="msg-head-avatars">
            {group ? (
              otherIds.slice(0, 3).map((p, i) => <Avatar key={p} id={p} size={30} style={{ marginLeft: i ? -12 : 0, boxShadow: '0 0 0 2px var(--system-background)' }} />)
            ) : (
              <Avatar id={otherIds[0]} size={52} />
            )}
          </span>
          <span className="msg-head-name glass">
            {title}
            {service !== 'iMessage' && <span className="msg-head-svc">{service}</span>}
            <ChevronRight size={13} strokeWidth={3} className="tertiary" />
          </span>
        </button>
        {contact?.isBusiness ? (
          <button className="bar-btn icon glass interactive" aria-label="Call" onClick={() => useOS.getState().launch('phone', { route: `call/${otherIds[0]}` })}><Phone size={20} /></button>
        ) : (
          <button className="bar-btn icon glass interactive" aria-label="FaceTime" onClick={() => useOS.getState().launch('facetime', { route: `call/${otherIds[0]}` })}><Video size={22} /></button>
        )}
      </div>

      {!online && (
        <div className="msg-offline glass anim-up" role="status">
          <Plane size={16} />
          <span className="grow">{net.airplane ? 'Airplane Mode is on.' : 'No connection.'} Messages will send automatically when you’re back online.</span>
          {net.airplane && <button onClick={() => useOS.getState().setNet({ airplane: false })}>Turn Off</button>}
        </div>
      )}

      <div
        className="msg-scroll scroll"
        ref={scrollRef}
        onScroll={(e) => {
          const el = e.currentTarget
          atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80
        }}
      >
        <div className="msg-thread-top">
          {sms ? <><b>Text Message</b> · {service}{service === 'RCS' ? ' · Encrypted' : ''}</> : <><b>iMessage</b> · Encrypted</>}
        </div>
        {msgs.map((m, i) => {
          const prev = msgs[i - 1]
          const next = msgs[i + 1]
          const header = !prev || m.ts - prev.ts > 60 * MIN
          const nextHeader = !!next && next.ts - m.ts > 60 * MIN
          const first = header || !prev || prev.from !== m.from || m.ts - prev.ts > 5 * MIN
          const lastInGroup = !next || nextHeader || next.from !== m.from || next.ts - m.ts > 5 * MIN
          const quoteId = replies[m.id]
          const quote = quoteId ? msgs.find((x) => x.id === quoteId) : undefined
          return (
            <Fragment key={m.id}>
              {header && <div className="msg-time">{timeHeader(m.ts, now)}</div>}
              <MessageRow
                m={m}
                first={first || !!quote}
                last={lastInGroup}
                showName={group && (first || !!quote) && m.from !== 'me'}
                receipt={receiptFor(m, i)}
                highlight={hl === m.id}
                quote={quote}
                suggestions={renderSuggestions(m, i)}
                ctx={rowCtx}
              />
            </Fragment>
          )
        })}
        {typing && (
          <div className="msg-row them first last">
            {group && <div className="msg-sender">{shortName(typing)}</div>}
            <div className="msg-line">
              {group && <div className="msg-avatar-slot"><Avatar id={typing} size={28} /></div>}
              <div className="msg-typing" aria-label={`${shortName(typing)} is typing`}>
                <span /><span /><span />
              </div>
            </div>
          </div>
        )}
        <div style={{ height: 8 }} />
      </div>

      <div ref={composerRef} className="msg-composer-wrap">
        <Composer
          key={editing?.id ?? 'main'}
          conv={conv}
          editing={editing}
          onEditDone={() => setEditing(null)}
          sms={sms}
          service={service}
          replyTo={replyTo}
          onCancelReply={() => setReplyTo(null)}
          fieldRef={fieldRef}
          onOpenDrawing={() => setDrawing(true)}
          onOpenPhotos={() => setPicker(true)}
          onOpenCamera={() => setCamera(true)}
          chips={
            unanswered && !replyTo ? (
              <ReplyChips
                replies={chipReplies}
                onPick={(r) => {
                  const el = fieldRef.current
                  if (el) {
                    setNativeValue(el, r)
                    el.focus()
                  }
                }}
              />
            ) : null
          }
        />
      </div>

      {menu && (
        <ActionMenu
          m={menu.m}
          rect={menu.rect}
          root={rootRef.current!}
          conv={conv}
          onClose={() => setMenu(null)}
          onReply={() => {
            setReplyTo(menu.m)
            window.setTimeout(() => fieldRef.current?.focus(), 50)
          }}
          onEdit={() => {
            const m = menu.m
            showAlert({
              title: 'Edit Message',
              message: 'Edits are visible to everyone in the conversation for 15 minutes after sending.',
              actions: [
                { label: 'Cancel', style: 'cancel' },
                {
                  label: 'Edit',
                  onPress: () => {
                    setEditing(m)
                    window.setTimeout(() => fieldRef.current?.focus(), 80)
                  },
                },
              ],
            })
          }}
        />
      )}
      {viewer && (
        <PhotoViewer
          photoId={viewer}
          subtitle={(() => {
            const m = msgs.find((x) => x.attachment?.photoId === viewer)
            return m ? `${m.from === 'me' ? 'You' : shortName(m.from)} · ${fmtRelative(m.ts)}` : ''
          })()}
          onClose={() => setViewer(null)}
        />
      )}
      <PhotoPicker open={picker} onClose={() => setPicker(false)} onSend={(ids) => sendPhotos(conv.id, ids)} />
      <PhotoPicker
        open={!!photoReq}
        onClose={() => setPhotoReq(null)}
        initialQuery={photoReq?.query ?? ''}
        aiContext={photoReq ? `${contact ? contact.nickname ?? contact.first : 'They'} asked for a photo — here are the best matches.` : undefined}
        onSend={(ids) => {
          if (!photoReq) return
          sendPhotos(conv.id, ids)
          msgLocal().set({ suggestions: { ...msgLocal().suggestions, [photoReq.key]: { done: true, label: `Sent ${ids.length} photo${ids.length === 1 ? '' : 's'}`, at: Date.now() } } })
        }}
      />
      <DrawingSheet open={drawing} onClose={() => setDrawing(false)} onSend={(d) => sendMsg(conv.id, { attachment: { kind: 'drawing', drawing: d } })} />
      <CameraQuick open={camera} onClose={() => setCamera(false)} convId={conv.id} />
      <ConvDetails open={details} onClose={() => setDetails(false)} conv={conv} onOpenPhoto={(id) => { setDetails(false); setViewer(id) }} />
    </div>
  )
}
