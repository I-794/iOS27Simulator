import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Plus, Camera, ArrowUp, Mic, X, Image as ImageIcon, PenLine, AudioLines, MapPin, Square, Trash2, Check, SwitchCamera, Film } from 'lucide-react'
import type { Conversation, Message } from '../../os/types'
import { useOS } from '../../os/store'
import { AISparkle } from '../../ui/controls'
import { Sheet } from '../../ui/overlay'
import { Scene } from '../../art/Scene'
import { fmtDuration, MIN } from '../../os/time'
import { playAlert } from '../../os/audio'
import { ME } from '../../os/data/people'
import { sendMsg, isOnline } from './engine'
import { msgLocal } from './msgStore'
import { shortName } from '../contacts/shared'

const QUICK_SCENES = ['selfie-group', 'dog-couch', 'autumn-trees', 'food-coffee', 'plant-monstera', 'city-night']

export function sendPhotos(convId: string, ids: string[]) {
  const photos = useOS.getState().photos
  ids.forEach((id, i) => {
    const p = photos.find((x) => x.id === id)
    if (!p) return
    window.setTimeout(() => {
      if (p.kind === 'video') sendMsg(convId, { attachment: { kind: 'video', photoId: p.id, duration: p.duration, sizeMB: Math.round((p.duration ?? 10) * 4.4) } })
      else sendMsg(convId, { attachment: { kind: 'photo', photoId: p.id, sizeMB: p.sizeMB } })
    }, i * 120)
  })
}

/** "Recent camera": a fast picker with a live viewfinder + shutter and the latest shots. */
export function CameraQuick({ open, onClose, convId }: { open: boolean; onClose: () => void; convId: string }) {
  const photos = useOS((s) => s.photos)
  const [sel, setSel] = useState<string[]>([])
  const [flash, setFlash] = useState(false)
  const [front, setFront] = useState(true)
  const [sceneIdx, setSceneIdx] = useState(0)
  useEffect(() => {
    if (!open) return
    setSel([])
    const t = window.setInterval(() => setSceneIdx((i) => i + 1), 2600)
    return () => window.clearInterval(t)
  }, [open])
  const recent = [...photos].filter((p) => !p.hidden && !p.idDocument).sort((a, b) => b.ts - a.ts).slice(0, 11)
  const live = front ? 'selfie-group' : QUICK_SCENES[1 + (sceneIdx % (QUICK_SCENES.length - 1))]
  const shoot = () => {
    const st = useOS.getState()
    setFlash(true)
    playAlert('shutter', st.silent ? 0 : st.volume)
    window.setTimeout(() => setFlash(false), 180)
    const id = st.addPhoto({ scene: live, ts: Date.now(), kind: 'photo', keywords: ['camera', 'messages'], capturedByMe: true, description: 'Photo taken in Messages', width: 4032, height: 3024, sizeMB: 3.1, place: 'Maple Grove' })
    window.setTimeout(() => {
      sendMsg(convId, { attachment: { kind: 'photo', photoId: id, sizeMB: 3.1 } })
      onClose()
    }, 260)
  }
  return (
    <Sheet open={open} onClose={onClose} detent="auto" title="Camera" trailing={sel.length ? <button className="bar-btn prominent" onClick={() => { sendPhotos(convId, sel); onClose() }}>Send {sel.length}</button> : undefined}>
      <div className="msg-cam">
        <div className="msg-cam-grid">
          <div className="msg-cam-live">
            <Scene scene={live} className="msg-cam-live-scene" />
            <span className="msg-cam-live-badge">LIVE</span>
            <button className="msg-cam-flip glass dark-glass" aria-label="Flip camera" onClick={() => setFront(!front)}><SwitchCamera size={18} /></button>
            <button className="msg-cam-shutter" aria-label="Take photo and send" onClick={shoot}><span /></button>
            {flash && <div className="msg-cam-flash" />}
          </div>
          {recent.map((p) => {
            const i = sel.indexOf(p.id)
            return (
              <button key={p.id} className={`msg-cam-cell ${i >= 0 ? 'sel' : ''}`} onClick={() => setSel((s) => (s.includes(p.id) ? s.filter((x) => x !== p.id) : [...s, p.id]))} aria-pressed={i >= 0} aria-label={p.description}>
                <Scene scene={p.scene} />
                {p.kind === 'video' && <span className="msg-picker-dur"><Film size={10} /> {fmtDuration(p.duration ?? 0)}</span>}
                <span className="msg-picker-check">{i >= 0 && <Check size={13} strokeWidth={3.5} />}</span>
              </button>
            )
          })}
        </div>
        <div className="msg-cam-hint">Tap the shutter to take and send instantly. Recent photos appear first.</div>
      </div>
    </Sheet>
  )
}

function PlusMenu({ onPick, onClose }: { onPick: (k: 'camera' | 'photos' | 'drawing' | 'audio' | 'location') => void; onClose: () => void }) {
  const items: { k: 'camera' | 'photos' | 'drawing' | 'audio' | 'location'; label: string; icon: ReactNode; color: string }[] = [
    { k: 'camera', label: 'Camera', icon: <Camera size={19} />, color: '#8e8e93' },
    { k: 'photos', label: 'Photos', icon: <ImageIcon size={19} />, color: 'linear-gradient(135deg,#ffcc00,#ff2d55 55%,#5856d6)' },
    { k: 'drawing', label: 'Drawing', icon: <PenLine size={19} />, color: '#ff375f' },
    { k: 'audio', label: 'Audio', icon: <AudioLines size={19} />, color: '#ff9500' },
    { k: 'location', label: 'Location', icon: <MapPin size={19} />, color: '#34c759' },
  ]
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <>
      <div className="msg-plus-backdrop" onClick={onClose} />
      <div className="msg-plus-menu glass heavy anim-pop" role="menu">
        {items.map((it) => (
          <button key={it.k} role="menuitem" onClick={() => { onClose(); onPick(it.k) }}>
            <span className="msg-plus-icon" style={{ background: it.color }}>{it.icon}</span>
            <span>{it.label}</span>
          </button>
        ))}
      </div>
    </>
  )
}

function Recorder({ onCancel, onSend }: { onCancel: () => void; onSend: (dur: number) => void }) {
  const [t0] = useState(() => Date.now())
  const [now, setNow] = useState(Date.now())
  const [stopped, setStopped] = useState<number | null>(null)
  useEffect(() => {
    if (stopped !== null) return
    const i = window.setInterval(() => setNow(Date.now()), 100)
    return () => window.clearInterval(i)
  }, [stopped])
  const dur = stopped ?? (now - t0) / 1000
  const bars = Array.from({ length: 34 }, (_, i) => (stopped !== null ? 0.3 + Math.abs(Math.sin(i * 1.3)) * 0.7 : 0.2 + Math.abs(Math.sin(now / 140 + i * 0.9)) * 0.8))
  return (
    <div className="msg-recorder glass">
      <button className="msg-rec-trash" aria-label="Discard recording" onClick={onCancel}><Trash2 size={19} /></button>
      <span className={`msg-rec-dot ${stopped !== null ? 'off' : ''}`} />
      <div className="msg-rec-wave">{bars.map((h, i) => <span key={i} style={{ height: `${h * 100}%` }} />)}</div>
      <span className="msg-rec-time">{fmtDuration(dur)}</span>
      {stopped === null ? (
        <button className="msg-rec-stop" aria-label="Stop recording" onClick={() => setStopped(Math.max(1, (Date.now() - t0) / 1000))}><Square size={13} fill="currentColor" strokeWidth={0} /></button>
      ) : (
        <button className="msg-send" aria-label="Send audio message" onClick={() => onSend(stopped)}><ArrowUp size={20} strokeWidth={3} /></button>
      )}
    </div>
  )
}

export function Composer({ conv, sms, replyTo, onCancelReply, chips, onOpenDrawing, onOpenPhotos, onOpenCamera, fieldRef, editing, onEditDone }: {
  conv: Conversation
  editing?: Message | null
  onEditDone?: () => void
  sms: boolean
  replyTo: Message | null
  onCancelReply: () => void
  chips: ReactNode
  onOpenDrawing: () => void
  onOpenPhotos: () => void
  onOpenCamera: () => void
  fieldRef: React.RefObject<HTMLTextAreaElement | null>
}) {
  const [text, setText] = useState(editing?.text ?? conv.draft ?? '')
  const [plus, setPlus] = useState(false)
  const [recording, setRecording] = useState(false)
  const textRef = useRef(text)
  textRef.current = text

  // keep draft in the store when leaving the conversation
  useEffect(() => {
    if (editing) return
    return () => {
      const st = useOS.getState()
      st.set({ conversations: st.conversations.map((c) => (c.id === conv.id ? { ...c, draft: textRef.current.trim() ? textRef.current : undefined } : c)) })
    }
  }, [conv.id, editing])

  useEffect(() => {
    const el = fieldRef.current
    if (!el) return
    el.style.height = '0px'
    el.style.height = `${Math.min(120, el.scrollHeight)}px`
  }, [text, fieldRef])

  const send = () => {
    const t = text.trim()
    if (!t) return
    if (editing) {
      useOS.getState().patchMessage(conv.id, editing.id, { text: t })
      msgLocal().set({ edited: { ...msgLocal().edited, [editing.id]: true } })
      setText('')
      onEditDone?.()
      return
    }
    sendMsg(conv.id, { text: t }, { replyTo: replyTo?.id })
    setText('')
    onCancelReply()
  }

  const pick = (k: 'camera' | 'photos' | 'drawing' | 'audio' | 'location') => {
    if (k === 'camera') onOpenCamera()
    if (k === 'photos') onOpenPhotos()
    if (k === 'drawing') onOpenDrawing()
    if (k === 'audio') setRecording(true)
    if (k === 'location') sendMsg(conv.id, { attachment: { kind: 'location', title: 'My Location', subtitle: ME.home } })
  }

  const recipient = conv.participants.length === 1 ? conv.participants[0] : conv.participants[0]
  const placeholder = sms ? 'Text Message • SMS' : 'iMessage'

  return (
    <div className="msg-composer">
      {editing && (
        <div className="msg-replying glass">
          <span className="msg-replying-bar" />
          <span className="grow">
            <span className="msg-replying-to">Editing message</span>
            <span className="msg-replying-text">{editing.text}</span>
          </span>
          <button aria-label="Cancel editing" onClick={() => { setText(''); onEditDone?.() }}><X size={16} strokeWidth={2.6} /></button>
        </div>
      )}
      {replyTo && (
        <div className="msg-replying glass">
          <span className="msg-replying-bar" />
          <span className="grow">
            <span className="msg-replying-to">Replying to {replyTo.from === 'me' ? 'yourself' : shortName(replyTo.from)}</span>
            <span className="msg-replying-text">{replyTo.text ?? 'Attachment'}</span>
          </span>
          <button aria-label="Cancel reply" onClick={onCancelReply}><X size={16} strokeWidth={2.6} /></button>
        </div>
      )}
      {!text && !recording && chips}
      {plus && <PlusMenu onPick={pick} onClose={() => setPlus(false)} />}
      <div className="msg-compose-row">
        {!recording && (
          <>
            <button className={`msg-circle glass interactive ${plus ? 'on' : ''}`} aria-label="More" aria-expanded={plus} onClick={() => setPlus(!plus)}>
              <Plus size={22} strokeWidth={2.2} style={{ transform: plus ? 'rotate(45deg)' : undefined, transition: 'transform .25s' }} />
            </button>
            <button className="msg-circle glass interactive" aria-label="Camera" onClick={onOpenCamera}>
              <Camera size={20} strokeWidth={2.1} />
            </button>
          </>
        )}
        {recording ? (
          <Recorder
            onCancel={() => setRecording(false)}
            onSend={(dur) => {
              setRecording(false)
              sendMsg(conv.id, { attachment: { kind: 'audio', duration: Math.round(dur * 10) / 10 } })
            }}
          />
        ) : (
          <div className="msg-field glass">
            <textarea
              ref={fieldRef}
              rows={1}
              value={text}
              placeholder={placeholder}
              aria-label="Message"
              data-recipient={recipient}
              data-send-on-enter="1"
              data-dictation="On my way!|Sounds good, see you then|Can you send me the details?"
              enterKeyHint="send"
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  send()
                }
              }}
            />
            {text.trim() ? (
              <button className={`msg-send ${sms ? 'sms' : ''}`} aria-label="Send" onClick={send} onPointerDown={(e) => e.preventDefault()}>
                <ArrowUp size={20} strokeWidth={3} />
              </button>
            ) : (
              <button className="msg-mic" aria-label="Record audio" onClick={() => setRecording(true)}>
                <Mic size={20} />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

/** Personalized Smart Reply chips (Apple Intelligence). */
export function ReplyChips({ replies, onPick }: { replies: string[]; onPick: (r: string) => void }) {
  if (!replies.length) return null
  return (
    <div className="msg-chips" role="list" aria-label="Smart Replies">
      <span className="msg-chips-spark"><AISparkle size={15} /></span>
      {replies.map((r) => (
        <button key={r} className="msg-chip glass interactive" onClick={() => onPick(r)} role="listitem">{r}</button>
      ))}
    </div>
  )
}

export function offlineNotice() {
  return !isOnline()
}

export const RECENT_WINDOW = 5 * MIN
