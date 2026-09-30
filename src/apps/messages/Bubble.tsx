import { memo, useEffect, useRef, useState, type ReactNode } from 'react'
import { Play, Pause, CloudDownload, MapPin, Link2, CircleAlert, X } from 'lucide-react'
import type { Conversation, Message } from '../../os/types'
import { useOS } from '../../os/store'
import { Scene } from '../../art/Scene'
import { Avatar } from '../../ui/controls'
import { openMenu } from '../../ui/overlay'
import { useLongPress } from '../../os/hooks'
import { fmtTime, fmtDuration } from '../../os/time'
import { parseWhen, parseEvent } from '../../os/ai/parse'
import { ME } from '../../os/data/people'
import { detectSpans, isJumboEmoji, type Span } from './detect'
import { useMsgLocal } from './msgStore'
import { download, cancelUpload, retry } from './engine'
import { shortName, contactForNumber, directionsTo } from '../contacts/shared'

// ---------------------------------------------------------------------------
// Tail + drawing helpers

export function Tail({ side }: { side: 'me' | 'them' }) {
  return (
    <svg className={`msg-tail ${side}`} viewBox="-14 0 22 21" width="22" height="21" aria-hidden>
      <path d="M-14 3 H0 V12.5 C0 16.6 2.8 19.4 7.8 20.6 C4.5 21.3 0 21.2 -4 20 C-7 21 -10 21 -14 21 Z" />
    </svg>
  )
}

export function parseDrawing(s: string): { color: string; d: string; w: number }[] {
  if (!s.includes('|')) return [{ color: '#ff375f', d: s, w: 5 }]
  return s.split(';;').filter(Boolean).map((seg) => {
    const [color, w, d] = seg.split('|')
    return { color, w: +w || 5, d }
  })
}

export function DrawingView({ data, className = '' }: { data: string; className?: string }) {
  const strokes = parseDrawing(data)
  return (
    <svg className={`msg-drawing ${className}`} viewBox="0 0 200 130" preserveAspectRatio="xMidYMid meet" aria-label="Drawing">
      {strokes.map((s, i) => (
        <path key={i} d={s.d} fill="none" stroke={s.color} strokeWidth={s.w} strokeLinecap="round" strokeLinejoin="round" className="msg-drawing-stroke" style={{ ['--len' as string]: 600 }} />
      ))}
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Rich text with data detectors

function spanMenu(el: HTMLElement, s: Span, full: string, from: string) {
  const st = useOS.getState()
  if (s.kind === 'date') {
    const when = parseWhen(full) ?? parseWhen(s.text)
    const ev = parseEvent(full)
    const title = ev?.title && ev.title.length < 40 ? ev.title : `Event with ${from === 'me' ? 'you' : shortName(from)}`
    openMenu(el, [
      {
        label: 'Create Event',
        onSelect: () => {
          if (!when) return st.showToast('Couldn’t read that date', '⚠️')
          st.addEvent({ title, start: when.start, end: when.end ?? when.start + 3_600_000, calendar: 'personal', location: ev?.location, source: 'Messages' })
          st.showToast(`Added “${title}” to Calendar`, '📅')
        },
      },
      {
        label: 'Create Reminder',
        onSelect: () => {
          st.addReminder({ title, due: when?.start, list: 'reminders', source: 'Messages' })
          st.showToast('Reminder created', '✅')
        },
      },
      { label: 'Show in Calendar', onSelect: () => st.launch('calendar') },
      { label: 'Copy', separatorBefore: true, onSelect: () => void navigator.clipboard?.writeText(s.text).catch(() => {}) },
    ], { title: when ? new Date(when.start).toLocaleString([], { weekday: 'long', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : s.text })
  } else if (s.kind === 'address') {
    openMenu(el, [
      { label: 'Get Directions', onSelect: () => directionsTo(s.text) },
      { label: 'Open in Maps', onSelect: () => directionsTo(s.text) },
      { label: 'Copy Address', separatorBefore: true, onSelect: () => { void navigator.clipboard?.writeText(s.text).catch(() => {}); st.showToast('Copied', '📋') } },
    ], { title: s.text })
  } else if (s.kind === 'phone') {
    const c = contactForNumber(s.text)
    openMenu(el, [
      { label: `Call ${s.text}`, onSelect: () => st.launch('phone', { route: c ? `call/${c.id}` : `dial/${s.text}` }) },
      { label: 'Send Message', onSelect: () => c && st.launch('messages', { route: `conv/${st.ensureConversation([c.id])}` }), disabled: !c },
      { label: 'Copy', separatorBefore: true, onSelect: () => void navigator.clipboard?.writeText(s.text).catch(() => {}) },
    ], { title: s.text })
  } else if (s.kind === 'url') {
    st.launch('safari', { route: `url/${s.text.replace(/^https?:\/\//, '')}` })
  } else if (s.kind === 'flight') {
    const mail = st.mails.find((m) => m.facts?.flight?.replace(/\s/g, '') === s.text.replace(/\s/g, ''))
    openMenu(el, [
      { label: 'Preview Flight', onSelect: () => st.showToast(`${s.text} · On time · Gate B12`, '✈️') },
      ...(mail ? [{ label: 'Show Confirmation Email', onSelect: () => st.launch('mail', { route: `mail/${mail.id}` }) }] : []),
      { label: 'Copy', separatorBefore: true, onSelect: () => void navigator.clipboard?.writeText(s.text).catch(() => {}) },
    ], { title: `Flight ${s.text}` })
  }
}

export function RichText({ text, from }: { text: string; from: string }) {
  const spans = detectSpans(text)
  return (
    <>
      {spans.map((s, i) =>
        s.kind === 'text' ? (
          <span key={i}>{s.text}</span>
        ) : (
          <span
            key={i}
            className="msg-dd"
            role="link"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation()
              spanMenu(e.currentTarget, s, text, from)
            }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            {s.text}
          </span>
        ),
      )}
    </>
  )
}

// ---------------------------------------------------------------------------
// Attachments

function ProgressRing({ p, size = 44 }: { p: number; size?: number }) {
  const r = size / 2 - 3
  const c = 2 * Math.PI * r
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="msg-ring">
      <circle cx={size / 2} cy={size / 2} r={r} fill="rgb(0 0 0 / .35)" stroke="rgb(255 255 255 / .3)" strokeWidth="3" />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#fff" strokeWidth="3" strokeDasharray={c} strokeDashoffset={c * (1 - p)} strokeLinecap="round" transform={`rotate(-90 ${size / 2} ${size / 2})`} />
    </svg>
  )
}

function MediaAttachment({ conv, m, onOpen }: { conv: Conversation; m: Message; onOpen: (photoId: string) => void }) {
  const a = m.attachment!
  const photo = useOS((s) => s.photos.find((p) => p.id === a.photoId))
  const dl = useMsgLocal((s) => s.downloads[m.id])
  const ratio = photo ? Math.max(0.62, Math.min(1.5, photo.height / photo.width)) : 0.75
  const w = ratio > 1 ? 200 : 244
  const uploading = m.from === 'me' && a.progress !== undefined && a.progress < 1
  const offloaded = !!a.offloaded
  return (
    <div
      className={`msg-media ${offloaded ? 'offloaded' : ''}`}
      style={{ width: w, height: w * ratio }}
      onClick={(e) => {
        e.stopPropagation()
        if (offloaded) return download(conv.id, m.id)
        if (!uploading && a.photoId) onOpen(a.photoId)
      }}
      role="button"
      aria-label={a.kind === 'video' ? 'Video' : 'Photo'}
    >
      <Scene scene={photo?.scene ?? 'sunset-beach'} className="msg-media-scene" />
      {a.kind === 'video' && !offloaded && !uploading && (
        <>
          <span className="msg-play glass dark-glass"><Play size={22} fill="#fff" strokeWidth={0} /></span>
          <span className="msg-media-dur">{fmtDuration(a.duration ?? photo?.duration ?? 0)}</span>
        </>
      )}
      {offloaded && (
        <div className="msg-offload">
          {dl !== undefined ? (
            <>
              <ProgressRing p={dl} />
              <span className="msg-offload-label">{Math.round((a.sizeMB ?? 0) * dl)} of {a.sizeMB} MB</span>
            </>
          ) : (
            <>
              <span className="msg-offload-btn glass dark-glass"><CloudDownload size={18} /> Download</span>
              <span className="msg-offload-label">{a.kind === 'video' ? `Video · ${fmtDuration(a.duration ?? 0)} · ` : ''}{a.sizeMB} MB · Stored in iCloud</span>
            </>
          )}
        </div>
      )}
      {uploading && (
        <div className="msg-upload">
          <div className="msg-upload-top">
            <ProgressRing p={a.progress ?? 0} size={40} />
            <button className="msg-upload-cancel" aria-label="Cancel upload" onClick={(e) => { e.stopPropagation(); cancelUpload(conv.id, m.id) }}><X size={14} strokeWidth={3} /></button>
          </div>
          <div className="msg-upload-bar"><div style={{ width: `${(a.progress ?? 0) * 100}%` }} /></div>
          <div className="msg-upload-label">{m.status === 'failed' ? 'Waiting for network…' : `Uploading ${Math.round((a.sizeMB ?? 0) * (a.progress ?? 0))} of ${a.sizeMB} MB`}</div>
        </div>
      )}
    </div>
  )
}

function LinkCard({ m }: { m: Message }) {
  const a = m.attachment!
  const domain = a.subtitle ?? (a.url ?? '').split('/')[0]
  const hue = [...domain].reduce((h, ch) => h + ch.charCodeAt(0), 0) % 360
  return (
    <button className={`msg-link ${m.from === 'me' ? 'me' : 'them'}`} onClick={(e) => { e.stopPropagation(); useOS.getState().launch('safari', { route: `url/${a.url}` }) }}>
      <div className="msg-link-hero" style={{ background: `linear-gradient(135deg, hsl(${hue} 70% 55%), hsl(${(hue + 50) % 360} 70% 40%))` }}>
        <svg viewBox="0 0 120 60" preserveAspectRatio="none" aria-hidden>
          <path d="M0 45 Q30 20 60 38 T120 25 V60 H0Z" fill="rgb(255 255 255 / .18)" />
          <path d="M0 52 Q40 35 70 48 T120 40 V60 H0Z" fill="rgb(255 255 255 / .22)" />
        </svg>
        <span className="msg-link-glyph">{(a.title ?? domain).slice(0, 1)}</span>
      </div>
      <div className="msg-link-meta">
        <div className="msg-link-title">{a.title ?? a.url}</div>
        <div className="msg-link-domain"><Link2 size={12} /> {domain}</div>
      </div>
    </button>
  )
}

function AudioBubble({ m }: { m: Message }) {
  const dur = m.attachment?.duration ?? 6
  const [pos, setPos] = useState(0)
  const [playing, setPlaying] = useState(false)
  const raf = useRef(0)
  useEffect(() => {
    if (!playing) return
    const t0 = performance.now() - pos * 1000
    const tick = () => {
      const p = (performance.now() - t0) / 1000
      if (p >= dur) {
        setPos(0)
        setPlaying(false)
        return
      }
      setPos(p)
      raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing])
  const bars = Array.from({ length: 28 }, (_, i) => 0.25 + Math.abs(Math.sin((i + m.id.length) * 1.7) * Math.cos(i * 0.6)) * 0.75)
  return (
    <div className="msg-audio">
      <button aria-label={playing ? 'Pause' : 'Play'} onClick={(e) => { e.stopPropagation(); setPlaying(!playing) }}>
        {playing ? <Pause size={18} fill="currentColor" strokeWidth={0} /> : <Play size={18} fill="currentColor" strokeWidth={0} />}
      </button>
      <div className="msg-wave">
        {bars.map((h, i) => (
          <span key={i} style={{ height: `${h * 100}%`, opacity: i / bars.length <= pos / dur ? 1 : 0.45 }} />
        ))}
      </div>
      <span className="msg-audio-time">{fmtDuration(playing ? pos : dur)}</span>
    </div>
  )
}

function LocationCard({ m }: { m: Message }) {
  const a = m.attachment!
  return (
    <button className="msg-location" onClick={(e) => { e.stopPropagation(); directionsTo(a.subtitle ?? ME.home) }}>
      <svg viewBox="0 0 240 120" preserveAspectRatio="xMidYMid slice" className="msg-location-map" aria-hidden>
        <rect width="240" height="120" className="msg-map-bg" />
        <path d="M0 40 L240 58 M60 0 L78 120 M0 96 L240 86 M170 0 L150 120" className="msg-map-road" strokeWidth="9" />
        <path d="M0 40 L240 58 M60 0 L78 120 M0 96 L240 86 M170 0 L150 120" className="msg-map-road-in" strokeWidth="6" />
        <rect x="95" y="64" width="36" height="16" rx="3" className="msg-map-park" />
      </svg>
      <span className="msg-location-pin"><MapPin size={18} fill="#fff" color="#ff3b30" /></span>
      <div className="msg-location-meta">
        <div className="msg-link-title">{a.title ?? 'My Location'}</div>
        <div className="msg-link-domain">{a.subtitle ?? ME.home}</div>
      </div>
    </button>
  )
}

// ---------------------------------------------------------------------------
// One message row

export interface RowCtx {
  conv: Conversation
  group: boolean
  sms: boolean
  onLongPress: (m: Message, el: HTMLElement) => void
  onOpenPhoto: (id: string) => void
  onQuoteTap: (id: string) => void
}

export const MessageRow = memo(function MessageRow({ m, first, last, showName, receipt, highlight, quote, suggestions, ctx }: {
  m: Message
  first: boolean
  last: boolean
  showName: boolean
  receipt?: ReactNode
  highlight?: boolean
  quote?: Message
  suggestions?: ReactNode
  ctx: RowCtx
}) {
  const mine = m.from === 'me'
  const side = mine ? 'me' : 'them'
  const a = m.attachment
  const jumbo = !a && isJumboEmoji(m.text)
  const edited = useMsgLocal((s) => !!s.edited[m.id])
  const bubbleRef = useRef<HTMLDivElement>(null)
  const lp = useLongPress(() => bubbleRef.current && ctx.onLongPress(m, bubbleRef.current))
  const reactions = m.reactions ?? []
  const failed = m.status === 'failed'
  const kindClass = a ? `att-${a.kind}` : jumbo ? 'jumbo' : 'text'
  const plainMedia = a && (a.kind === 'photo' || a.kind === 'video')

  let body: ReactNode
  if (a?.kind === 'photo' || a?.kind === 'video') body = <MediaAttachment conv={ctx.conv} m={m} onOpen={ctx.onOpenPhoto} />
  else if (a?.kind === 'link') body = <LinkCard m={m} />
  else if (a?.kind === 'drawing') body = <div className="msg-drawing-card"><DrawingView data={a.drawing ?? ''} /></div>
  else if (a?.kind === 'audio') body = <AudioBubble m={m} />
  else if (a?.kind === 'location') body = <LocationCard m={m} />
  else if (jumbo) body = <span className="msg-jumbo">{m.text}</span>
  else body = <RichText text={m.text ?? ''} from={m.from} />

  const bubbleClass = a || jumbo ? '' : `msg-bubble ${side} ${ctx.sms && mine ? 'sms' : ''} ${last ? 'tail' : ''}`
  return (
    <div className={`msg-row ${side} ${first ? 'first' : ''} ${last ? 'last' : ''} ${reactions.length ? 'has-react' : ''} ${highlight ? 'highlight' : ''}`} data-mid={m.id}>
      {showName && !mine && <div className="msg-sender">{shortName(m.from)}</div>}
      {quote && (
        <button className={`msg-quote ${quote.from === 'me' ? 'me' : 'them'}`} onClick={() => ctx.onQuoteTap(quote.id)}>
          <span className="msg-quote-line" />
          <span className="msg-quote-text">{quote.text ?? (quote.attachment ? `${quote.attachment.kind[0].toUpperCase()}${quote.attachment.kind.slice(1)}` : '')}</span>
        </button>
      )}
      <div className="msg-line">
        {ctx.group && !mine && (
          <div className="msg-avatar-slot">{last && <Avatar id={m.from} size={28} />}</div>
        )}
        <div
          ref={bubbleRef}
          className={`msg-body ${kindClass} ${bubbleClass} ${plainMedia ? 'media' : ''}`}
          {...lp}
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === 'ContextMenu') bubbleRef.current && ctx.onLongPress(m, bubbleRef.current)
          }}
        >
          {body}
          {edited && <span className="msg-edited-dot" />}
          {!a && !jumbo && last && <Tail side={side} />}
          {reactions.length > 0 && (
            <div className={`msg-tapbacks ${side}`}>
              {[...new Map(reactions.map((r) => [r.emoji, r])).values()].slice(0, 3).map((r, i) => (
                <span key={r.emoji} className={`msg-tapback ${reactions.some((x) => x.emoji === r.emoji && x.from === 'me') ? 'mine' : ''}`} style={{ zIndex: 3 - i }}>
                  {r.emoji}
                  {reactions.filter((x) => x.emoji === r.emoji).length > 1 && <b>{reactions.filter((x) => x.emoji === r.emoji).length}</b>}
                </span>
              ))}
            </div>
          )}
        </div>
        {failed && mine && (
          <button
            className="msg-failed"
            aria-label="Not Delivered — options"
            onClick={(e) =>
              openMenu(e.currentTarget, [
                { label: 'Try Again', onSelect: () => retry(ctx.conv.id, m.id) },
                ...(m.text && !ctx.sms ? [{ label: 'Send as Text Message', onSelect: () => retry(ctx.conv.id, m.id) }] : []),
                { label: 'Delete Message', destructive: true, separatorBefore: true, onSelect: () => useOS.setState({ conversations: useOS.getState().conversations.map((c) => (c.id === ctx.conv.id ? { ...c, messages: c.messages.filter((x) => x.id !== m.id) } : c)) }) },
              ], { title: 'Your message was not delivered.' })
            }
          >
            <CircleAlert size={24} fill="var(--red)" color="var(--system-background)" strokeWidth={2.2} />
          </button>
        )}
      </div>
      {edited && <div className={`msg-receipt ${side}`}>Edited</div>}
      {suggestions}
      {receipt}
    </div>
  )
})

export function timeHeader(ts: number, now = Date.now()) {
  const d = new Date(ts)
  const sod = new Date(now)
  sod.setHours(0, 0, 0, 0)
  const diffDays = Math.floor((sod.getTime() - new Date(d).setHours(0, 0, 0, 0)) / 86_400_000)
  const day = diffDays <= 0 ? 'Today' : diffDays === 1 ? 'Yesterday' : diffDays < 7 ? d.toLocaleDateString([], { weekday: 'long' }) : d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })
  return (
    <>
      <b>{day}</b> {fmtTime(ts)}
    </>
  )
}
