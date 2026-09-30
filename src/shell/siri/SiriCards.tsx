import { useState } from 'react'
import { Calendar, MapPin, CheckCircle2, Circle, Phone, MessageCircle, Play, Pause, Timer, AlarmClock, Navigation, FileText, Settings, Video, Send, Pencil, Check, ChevronRight, Mail } from 'lucide-react'
import type { SiriCard } from '../../os/types'
import { useOS } from '../../os/store'
import { useNow } from '../../os/hooks'
import { contactById, contactName } from '../../os/data/people'
import { TRACKS } from '../../os/data/media'
import { WEATHER } from '../../os/data/world'
import { CAMERA_CLIPS } from '../../os/data/photos'
import { CALENDARS } from '../../os/data/life'
import { Scene } from '../../art/Scene'
import { Avatar } from '../../ui/controls'
import { AlbumArt } from '../widgets/AlbumArt'
import { WeatherGlyph } from '../widgets/Widgets'
import { fmtTime, fmtDuration, dayLabel, DAY, WEEKDAYS_SHORT, fmtRelative } from '../../os/time'
import { AppIconArt, ICONS } from '../../icons/AppIconArt'
import type { AppId } from '../../os/types'

function openApp(app: AppId, route?: string) {
  const st = useOS.getState()
  st.set({ siriActive: false })
  if (st.locked) {
    st.unlock()
    window.setTimeout(() => useOS.getState().launch(app, { route }), 300)
  } else st.launch(app, { route })
}

export function SiriCards({ cards, onSend }: { cards: SiriCard[]; onSend?: (card: Extract<SiriCard, { type: 'draft' }>, body: string) => void }) {
  return (
    <div className="siri-cards">
      {cards.map((c, i) => <SiriCardView key={i} c={c} onSend={onSend} />)}
    </div>
  )
}

function SiriCardView({ c, onSend }: { c: SiriCard; onSend?: (card: Extract<SiriCard, { type: 'draft' }>, body: string) => void }) {
  const st = useOS()
  const now = useNow(1000)
  switch (c.type) {
    case 'event': {
      const e = st.events.find((x) => x.id === c.eventId)
      if (!e) return null
      const cal = CALENDARS.find((x) => x.id === e.calendar)
      return (
        <button className="scard" onClick={() => openApp('calendar', `event/${e.id}`)}>
          <div className="scard-bar" style={{ background: cal?.color ?? 'var(--blue)' }} />
          <div className="grow">
            <div className="scard-kicker"><Calendar size={12} /> {dayLabel(e.start)} · {e.allDay ? 'All day' : `${fmtTime(e.start)} – ${fmtTime(e.end)}`}</div>
            <div className="t-headline">{e.title}</div>
            {e.location && <div className="t-footnote secondary row gap4"><MapPin size={12} /> {e.location}</div>}
          </div>
          <ChevronRight size={16} className="tertiary" />
        </button>
      )
    }
    case 'reminder': {
      const r = st.reminders.find((x) => x.id === c.reminderId)
      if (!r) return null
      return (
        <div className="scard">
          <button aria-label={r.done ? 'Mark incomplete' : 'Complete'} onClick={() => st.updateReminder(r.id, { done: !r.done })}>
            {r.done ? <CheckCircle2 size={24} color="var(--blue)" /> : <Circle size={24} color="var(--label-tertiary)" />}
          </button>
          <div className="grow" onClick={() => openApp('reminders', `list/${r.list}`)}>
            <div className="t-headline" style={{ textDecoration: r.done ? 'line-through' : undefined }}>{r.title}</div>
            <div className="t-footnote secondary">{r.due ? `${dayLabel(r.due)}, ${fmtTime(r.due)}` : 'No due date'} · {r.list[0].toUpperCase() + r.list.slice(1)}</div>
          </div>
        </div>
      )
    }
    case 'message': {
      const conv = st.conversations.find((x) => x.id === c.conversationId)
      const m = conv?.messages.find((x) => x.id === c.messageId)
      if (!conv || !m) return null
      return (
        <button className="scard col" style={{ alignItems: 'stretch' }} onClick={() => openApp('messages', `conv/${conv.id}/${m.id}`)}>
          <div className="scard-kicker row gap6"><AppIconArt app="messages" size={16} /> {conv.name ?? contactName(conv.participants[0], 'full')} · {fmtRelative(m.ts)}</div>
          <div className={`scard-bubble ${m.from === 'me' ? 'me' : ''}`}>{m.text ?? '📎 Attachment'}</div>
        </button>
      )
    }
    case 'mail': {
      const m = st.mails.find((x) => x.id === c.mailId)
      if (!m) return null
      return (
        <button className="scard" onClick={() => openApp('mail', `mail/${m.id}`)}>
          <Mail size={22} color="var(--blue)" />
          <div className="grow">
            <div className="scard-kicker">{m.from.name} · {fmtRelative(m.ts)}</div>
            <div className="t-headline nowrap">{m.subject}</div>
            <div className="t-footnote secondary" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{m.body.replace(/\n+/g, ' ')}</div>
          </div>
        </button>
      )
    }
    case 'photos':
      return (
        <div className="scard col" style={{ alignItems: 'stretch' }}>
          {c.title && <div className="scard-kicker">Photos · “{c.title}”</div>}
          <div className="scard-photos">
            {c.photoIds.map((id) => {
              const p = st.photos.find((x) => x.id === id)
              return p ? <button key={id} onClick={() => openApp('photos', `photo/${id}`)} aria-label={p.description}><Scene scene={p.scene} /></button> : null
            })}
          </div>
          <button className="btn small tinted" style={{ alignSelf: 'flex-start', marginTop: 8 }} onClick={() => openApp('photos', `search/${encodeURIComponent(c.title ?? '')}`)}>Show All in Photos</button>
        </div>
      )
    case 'contact': {
      const ct = contactById(c.contactId)
      if (!ct) return null
      return (
        <div className="scard">
          <Avatar id={ct.id} size={44} />
          <div className="grow"><div className="t-headline">{contactName(ct.id, 'full')}</div><div className="t-footnote secondary">{ct.phones[0]}</div></div>
          <button className="scard-round" aria-label="Call" onClick={() => openApp('phone', `call/${ct.id}`)}><Phone size={18} /></button>
          <button className="scard-round" aria-label="Message" onClick={() => openApp('messages', `conv/c-${ct.id}`)}><MessageCircle size={18} /></button>
        </div>
      )
    }
    case 'timer': {
      const t = st.timers[st.timers.length - 1]
      const left = t?.endsAt ? Math.max(0, (t.endsAt - now) / 1000) : c.seconds
      return (
        <div className="scard">
          <Timer size={28} color="var(--orange)" />
          <div className="grow"><div className="scard-kicker">Timer</div><div className="t-title1" style={{ color: 'var(--orange)', fontVariantNumeric: 'tabular-nums' }}>{fmtDuration(left)}</div></div>
          <button className="btn small gray" onClick={() => openApp('clock', 'timer')}>Open</button>
        </div>
      )
    }
    case 'alarm': {
      const a = st.alarms.find((x) => x.id === c.alarmId)
      if (!a) return null
      return (
        <div className="scard">
          <AlarmClock size={28} color="var(--orange)" />
          <div className="grow"><div className="t-title1">{a.hour % 12 || 12}:{String(a.minute).padStart(2, '0')} <span className="t-headline">{a.hour < 12 ? 'AM' : 'PM'}</span></div><div className="t-footnote secondary">{a.label} · Alarm volume {Math.round(st.alarmVolume * 100)}%</div></div>
        </div>
      )
    }
    case 'music': {
      const t = TRACKS.find((x) => x.id === st.nowPlaying.trackId) ?? TRACKS.find((x) => x.id === c.trackId)!
      return (
        <div className="scard">
          <AlbumArt track={t} size={48} radius={8} />
          <div className="grow" onClick={() => openApp('music', 'nowplaying')}><div className="t-headline nowrap">{t.title}</div><div className="t-footnote secondary">{t.artist} · {t.album}</div></div>
          <button className="scard-round" aria-label="Play/Pause" onClick={st.togglePlay}>{st.nowPlaying.playing ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}</button>
        </div>
      )
    }
    case 'weather':
      return (
        <button className="scard col weather-card" style={{ alignItems: 'stretch' }} onClick={() => openApp('weather')}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <div><div className="t-subhead bold">{WEATHER.city}</div><div className="t-large-title" style={{ fontWeight: 300 }}>{WEATHER.temp}°</div></div>
            <div style={{ textAlign: 'right' }}><div className="t-subhead">{WEATHER.condition}</div><div className="t-footnote">H:{WEATHER.high}° L:{WEATHER.low}°</div></div>
          </div>
          <div className="row" style={{ justifyContent: 'space-between', marginTop: 8 }}>
            {WEATHER.daily.slice(0, 5).map((d, i) => {
              const stormy = i === (4 - new Date().getDay() + 7) % 7
              return (
                <div key={i} className="col" style={{ alignItems: 'center', gap: 2 }}>
                  <span className="t-caption1">{i === 0 ? 'Today' : WEEKDAYS_SHORT[new Date(Date.now() + i * DAY).getDay()]}</span>
                  <WeatherGlyph icon={stormy ? 'cloud-bolt' : d.icon} size={18} />
                  <span className="t-caption1 bold">{d.hi}°</span>
                </div>
              )
            })}
          </div>
        </button>
      )
    case 'map':
      return (
        <button className="scard col" style={{ alignItems: 'stretch' }} onClick={() => openApp('maps', 'nav')}>
          <div className="scard-map">
            <svg viewBox="0 0 300 110" width="100%" height="110"><rect width="300" height="110" fill="#dfe9d8" /><path d="M0 80 L300 30" stroke="#fff" strokeWidth="10" /><path d="M120 0 L160 110" stroke="#fff" strokeWidth="8" /><path d="M40 90 C 110 70, 150 50, 190 40 S 250 30, 270 20" stroke="#0a84ff" strokeWidth="6" fill="none" strokeLinecap="round" /><circle cx="40" cy="90" r="7" fill="#0a84ff" stroke="#fff" strokeWidth="3" />{c.via && <circle cx="170" cy="45" r="7" fill="#8b5a2b" stroke="#fff" strokeWidth="3" />}<circle cx="270" cy="20" r="8" fill="#ff3b30" stroke="#fff" strokeWidth="3" /></svg>
          </div>
          <div className="row gap8" style={{ marginTop: 8 }}>
            <Navigation size={18} color="var(--blue)" />
            <div className="grow"><div className="t-headline">{c.destination}</div>{c.via && <div className="t-footnote secondary">Stop at {c.via}</div>}</div>
            <span className="t-headline" style={{ color: 'var(--green)' }}>{c.eta}</span>
          </div>
        </button>
      )
    case 'note': {
      const n = st.notes.find((x) => x.id === c.noteId)
      if (!n) return null
      return (
        <button className="scard" onClick={() => openApp('notes', `note/${n.id}`)}>
          <FileText size={24} color="var(--yellow)" />
          <div className="grow"><div className="t-headline">{n.title}</div><div className="t-footnote secondary">{n.blocks.filter((b) => b.t === 'check').length} items · Notes</div></div>
          <ChevronRight size={16} className="tertiary" />
        </button>
      )
    }
    case 'setting':
      return (
        <button className="scard" onClick={() => openApp('settings', c.route)}>
          <Settings size={22} color="var(--gray)" />
          <div className="grow t-headline">{c.label}</div>
          <ChevronRight size={16} className="tertiary" />
        </button>
      )
    case 'camera': {
      const clip = CAMERA_CLIPS.find((x) => x.id === c.clipId)
      if (!clip) return null
      return (
        <button className="scard col" style={{ alignItems: 'stretch' }} onClick={() => openApp('home', `clip/${clip.id}`)}>
          <div className="scard-clip"><Scene scene={clip.scene} /><span className="scard-play"><Play size={20} fill="#fff" color="#fff" /></span><span className="scard-dur">{fmtDuration(clip.duration)}</span></div>
          <div className="row gap6" style={{ marginTop: 8 }}><Video size={14} /><span className="t-footnote bold">{clip.camera}</span><span className="t-footnote secondary">· {dayLabel(clip.ts)} {fmtTime(clip.ts)}</span></div>
        </button>
      )
    }
    case 'draft':
      return <DraftCard c={c} onSend={onSend} />
    case 'info':
      return (
        <div className="scard col" style={{ alignItems: 'stretch' }}>
          <div className="t-headline" style={{ marginBottom: 6 }}>{c.title}</div>
          {c.rows.map((r) => (
            <div key={r.label} className="row" style={{ justifyContent: 'space-between', padding: '4px 0', borderTop: '0.5px solid var(--separator)' }}>
              <span className="t-subhead secondary">{r.label}</span><span className="t-subhead bold">{r.value}</span>
            </div>
          ))}
        </div>
      )
    case 'steps':
      return (
        <div className="scard col" style={{ alignItems: 'stretch' }}>
          {c.steps.map((s, i) => (
            <div key={i} className="row gap8 t-subhead" style={{ padding: '3px 0' }}>
              <CheckCircle2 size={18} color="var(--green)" /> {s.label}
            </div>
          ))}
        </div>
      )
    case 'app':
      return (
        <button className="scard" onClick={() => openApp(c.app, c.route)}>
          <AppIconArt app={c.app} size={32} />
          <div className="grow t-headline">{c.label}</div>
          <span className="t-footnote secondary">{ICONS[c.app].name}</span>
        </button>
      )
    default:
      return null
  }
}

function DraftCard({ c, onSend }: { c: Extract<SiriCard, { type: 'draft' }>; onSend?: (card: Extract<SiriCard, { type: 'draft' }>, body: string) => void }) {
  const [edit, setEdit] = useState(false)
  const [body, setBody] = useState(c.body)
  const [sent, setSent] = useState(!!c.sent)
  return (
    <div className="scard col" style={{ alignItems: 'stretch' }}>
      <div className="scard-kicker row gap6">
        <AppIconArt app={c.app} size={16} /> {c.app === 'mail' ? 'Email' : 'Message'}{c.to ? ` to ${contactName(c.to, 'full')}` : ''}
      </div>
      {c.subject && <div className="t-headline">{c.subject}</div>}
      {edit ? (
        <textarea className="text-input scard-edit" rows={5} value={body} onChange={(e) => setBody(e.target.value)} data-recipient={c.to} data-mail={c.app === 'mail' ? '1' : undefined} />
      ) : (
        <div className={c.app === 'messages' ? 'scard-bubble me' : 't-subhead'} style={{ whiteSpace: 'pre-wrap' }}>{body}</div>
      )}
      <div className="row gap8" style={{ marginTop: 10 }}>
        {sent ? (
          <span className="row gap6 t-subhead" style={{ color: 'var(--green)' }}><Check size={16} /> Sent</span>
        ) : (
          <>
            <button className="btn small gray" onClick={() => setEdit(!edit)}><Pencil size={14} /> {edit ? 'Done' : 'Edit'}</button>
            {(c.to || c.app === 'mail') && (
              <button className="btn small filled" onClick={() => { setSent(true); onSend?.(c, body) }}><Send size={14} /> Send</button>
            )}
          </>
        )}
      </div>
    </div>
  )
}
