import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowUp, Mic, Plus, X, Copy, Share, RotateCcw, Volume2, ThumbsUp, ThumbsDown, MoreHorizontal, SquarePen, Pin, PinOff, Pencil, Trash2,
  Image as ImageIcon, ScanEye, PenLine, Sparkles, ChevronDown, Check, MessageCircle, CloudSun, Plane, Car, House, Camera, Workflow, Square,
} from 'lucide-react'
import { Page, useNav } from '../../ui/nav'
import { Glass } from '../../ui/controls'
import { openMenu, Sheet } from '../../ui/overlay'
import { useOS } from '../../os/store'
import { dayLabel, fmtTime, HOUR } from '../../os/time'
import { SIRI_SUGGESTIONS, doSend } from '../../os/ai/siri'
import { runSiri, speak, stopSpeaking } from '../../shell/siri/session'
import { SiriCards } from '../../shell/siri/SiriCards'
import { Scene } from '../../art/Scene'
import type { SiriTurn } from '../../os/types'
import { Orb, HeroOrb, Waveform } from './Orb'
import { useSiriLocal, freshTurns } from './local'
import { RenameSheet, deleteConversation, shareConversation, togglePin, setProvider } from './helpers'
import { WritingSheet } from './Writing'

const THINK_STEPS: [RegExp, string][] = [
  [/\b(alex|said|text|message|mom|dad|sam|priya)\b/i, 'Searching Messages'],
  [/\b(meeting|event|calendar|when|flight|test|concert)\b/i, 'Checking your Calendar'],
  [/\b(photo|picture|biscuit|beach)\b/i, 'Searching Photos'],
  [/\b(weather|rain|sunny|storm)\b/i, 'Getting the forecast'],
  [/\b(this|what is)\b/i, 'Looking at the image'],
  [/\b(lights?|lock|door|thermostat)\b/i, 'Talking to your Home'],
]

function copyText(t: string) {
  try {
    void navigator.clipboard?.writeText(t).catch(() => {})
  } catch {
    /* clipboard is optional */
  }
  useOS.getState().showToast('Copied', 'copy')
}

export function ChatPage({ convId, ask, voice }: { convId?: string; ask?: string; voice?: boolean }) {
  const nav = useNav()
  const [cid, setCid] = useState<string | null>(convId ?? null)
  const conv = useOS((s) => s.siriConversations.find((c) => c.id === cid))
  const provider = useOS((s) => s.siriSettings.provider)
  const attachments = useSiriLocal((s) => s.attachments)
  const [text, setText] = useState('')
  const [pending, setPending] = useState<string | null>(null)
  const [listening, setListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [attach, setAttach] = useState<string | null>(null)
  const [attachOpen, setAttachOpen] = useState(false)
  const [writingOpen, setWritingOpen] = useState(false)
  const [renameOpen, setRenameOpen] = useState(false)
  const [, force] = useState(0)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const lastPhoto = useRef<string | null>(null)
  const busy = useRef(false)
  const turns = conv?.turns ?? []

  const scrollDown = (smooth = true) => {
    const el = scrollRef.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' })
  }
  useLayoutEffect(() => scrollDown(false), [])
  useEffect(() => scrollDown(), [turns.length, pending])

  // restore the image context for continued conversations
  useEffect(() => {
    const withPhoto = [...turns].reverse().find((t) => attachments[t.id])
    if (withPhoto) lastPhoto.current = attachments[withPhoto.id]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cid])

  useEffect(() => {
    if (conv) useOS.getState().set({ siriCurrent: conv.id })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conv?.id])

  const send = async (raw: string, opts: { voice?: boolean; photoId?: string | null } = {}) => {
    const q = raw.trim()
    if (!q || busy.current) return
    busy.current = true
    const st = useOS.getState()
    let id = cid
    if (!id || !st.siriConversations.some((c) => c.id === id)) {
      id = st.siriNewConversation()
      setCid(id)
    }
    const photoId = opts.photoId ?? null
    if (photoId) lastPhoto.current = photoId
    const ctxPhoto = photoId ?? lastPhoto.current
    const photo = ctxPhoto ? st.photos.find((p) => p.id === ctxPhoto) : undefined
    useOS.setState({
      siriOnscreen: photo
        ? { app: 'photos', context: 'Viewing photo', entity: { type: 'photo', photoId: photo.id, scene: photo.scene } }
        : { app: 'siri', context: undefined },
    })
    setText('')
    setAttach(null)
    setPending(q)
    const answeredBy = useOS.getState().siriSettings.provider
    const p = runSiri(q, { convId: id, voice: opts.voice })
    const afterUser = useOS.getState().siriConversations.find((c) => c.id === id)
    const userTurn = afterUser?.turns[afterUser.turns.length - 1]
    if (photoId && userTurn) useSiriLocal.getState().set({ attachments: { ...useSiriLocal.getState().attachments, [userTurn.id]: photoId } })
    await p
    const done = useOS.getState().siriConversations.find((c) => c.id === id)
    const reply = done?.turns[done.turns.length - 1]
    if (reply && reply.role === 'siri') {
      freshTurns.add(reply.id)
      const loc = useSiriLocal.getState()
      loc.set({ providers: { ...loc.providers, [reply.id]: answeredBy }, voiced: { ...loc.voiced, [reply.id]: !!opts.voice } })
    }
    busy.current = false
    setPending(null)
    window.setTimeout(() => {
      const s = useOS.getState()
      if (!s.siriActive && s.siriMode !== 'thinking') s.set({ siriMode: 'idle' })
    }, 900)
  }

  // routed actions: ask/<q>, voice
  useEffect(() => {
    if (ask) send(ask)
    else if (voice) startListening()
    return () => stopSpeaking()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ---------- simulated voice ----------
  const voiceTimer = useRef<number | undefined>(undefined)
  const startListening = () => {
    stopSpeaking()
    setListening(true)
    setTranscript('')
    ;(document.activeElement as HTMLElement | null)?.blur?.()
    useOS.getState().set({ siriMode: 'listening' })
  }
  const stopListening = () => {
    window.clearInterval(voiceTimer.current)
    setListening(false)
    setTranscript('')
    const s = useOS.getState()
    if (!s.siriActive) s.set({ siriMode: 'idle' })
  }
  const speakPhrase = (phrase: string) => {
    window.clearInterval(voiceTimer.current)
    const words = phrase.split(' ')
    let i = 0
    setTranscript('')
    voiceTimer.current = window.setInterval(() => {
      i++
      setTranscript(words.slice(0, i).join(' '))
      if (i >= words.length) {
        window.clearInterval(voiceTimer.current)
        window.setTimeout(() => {
          setListening(false)
          setTranscript('')
          send(phrase, { voice: true, photoId: attach })
        }, 380)
      }
    }, 120)
  }
  useEffect(() => () => window.clearInterval(voiceTimer.current), [])

  // ---------- regenerate ----------
  const regenerate = (siriTurnId: string) => {
    const st = useOS.getState()
    const c = st.siriConversations.find((x) => x.id === cid)
    if (!c || busy.current) return
    const idx = c.turns.findIndex((t) => t.id === siriTurnId)
    let u = idx - 1
    while (u >= 0 && c.turns[u].role !== 'user') u--
    if (u < 0) return
    const userTurn = c.turns[u]
    const photoId = attachments[userTurn.id] ?? null
    st.set({ siriConversations: st.siriConversations.map((x) => (x.id === c.id ? { ...x, turns: x.turns.filter((_t, i) => i < u || i > idx) } : x)) })
    send(userTurn.text, { photoId })
  }

  const moreMenu = (el: HTMLElement) =>
    openMenu(el, [
      { label: 'New Chat', icon: <SquarePen size={18} />, onSelect: () => { stopListening(); setCid(null); lastPhoto.current = null; setAttach(null) } },
      { label: conv?.pinned ? 'Unpin' : 'Pin', icon: conv?.pinned ? <PinOff size={18} /> : <Pin size={18} />, disabled: !conv, onSelect: () => conv && togglePin(conv.id) },
      { label: 'Rename', icon: <Pencil size={18} />, disabled: !conv, onSelect: () => setRenameOpen(true) },
      { label: 'Share Conversation', icon: <Share size={18} />, disabled: !conv, onSelect: () => conv && shareConversation(conv) },
      { label: 'Delete', icon: <Trash2 size={18} />, destructive: true, separatorBefore: true, disabled: !conv, onSelect: () => conv && deleteConversation(conv.id, () => nav.pop()) },
    ])

  const providerMenu = (el: HTMLElement) =>
    openMenu(el, [
      { label: 'Siri', icon: provider === 'siri' ? <Check size={18} /> : <Orb size={18} still />, onSelect: () => setProvider('siri') },
      { label: 'ChatGPT', icon: provider === 'chatgpt' ? <Check size={18} /> : <Sparkles size={18} />, onSelect: () => setProvider('chatgpt') },
    ], { title: 'Siri can use ChatGPT for world knowledge when you allow it.' })

  const plusMenu = (el: HTMLElement) =>
    openMenu(el, [
      { label: 'Photos', icon: <ImageIcon size={18} />, onSelect: () => setAttachOpen(true) },
      { label: 'Visual Intelligence', icon: <ScanEye size={18} />, onSelect: () => useOS.getState().launch('camera', { route: 'siri' }) },
      { label: 'Writing Tools', icon: <PenLine size={18} />, onSelect: () => setWritingOpen(true) },
      { label: 'Create Image', icon: <Sparkles size={18} />, onSelect: () => useOS.getState().launch('playground') },
    ])

  const lastSiri = [...turns].reverse().find((t) => t.role === 'siri')
  const follow = !pending && lastSiri?.followUps?.length && turns[turns.length - 1]?.id === lastSiri.id ? lastSiri.followUps : []
  const photoFor = (id: string | null) => (id ? useOS.getState().photos.find((p) => p.id === id) : undefined)
  const attachPhoto = photoFor(attach)

  return (
    <Page
      large={false}
      className="siriapp-chat"
      scrollRef={scrollRef}
      bottomExtra={follow.length ? 100 : 62}
      inlineTitle={
        <button className="siriapp-model" onClick={(e) => providerMenu(e.currentTarget)} aria-label="Choose model">
          {provider === 'chatgpt' ? <Sparkles size={15} className="siriapp-gpt" /> : <Orb size={16} still />}
          <span>{provider === 'chatgpt' ? 'ChatGPT' : 'Siri'}</span>
          <ChevronDown size={14} strokeWidth={2.6} className="secondary" />
        </button>
      }
      trailing={<button className="bar-btn icon glass interactive" aria-label="More" onClick={(e) => moreMenu(e.currentTarget)}><MoreHorizontal size={22} /></button>}
      footer={
        <div className="siriapp-footer">
          {follow.length > 0 && !listening && (
            <div className="siriapp-follow scroll">
              {follow.map((f) => <button key={f} className="siriapp-chip glass interactive" onClick={() => send(f)}>{f}</button>)}
            </div>
          )}
          {listening ? (
            <Glass className="siriapp-listen anim-up" variant="heavy">
              <div className="row gap12">
                <Orb size={34} state="listening" />
                <div className="grow siriapp-transcript">{transcript || <span className="secondary">Listening…</span>}</div>
                <button className="siriapp-stop" aria-label="Stop listening" onClick={stopListening}><Square size={12} fill="currentColor" /></button>
              </div>
              <Waveform active={!transcript} />
              {!transcript && (
                <>
                  <div className="t-caption1 secondary" style={{ margin: '6px 4px 6px' }}>Say something like…</div>
                  <div className="siriapp-say">
                    {(attach || lastPhoto.current ? ['What is this?', 'When was this taken?'] : []).concat(SIRI_SUGGESTIONS.slice(0, 5)).slice(0, 5).map((s) => (
                      <button key={s} onClick={() => speakPhrase(s)}>“{s}”</button>
                    ))}
                  </div>
                </>
              )}
            </Glass>
          ) : (
            <>
              {attachPhoto && (
                <div className="siriapp-attach anim-pop">
                  <Scene scene={attachPhoto.scene} />
                  <button aria-label="Remove attachment" onClick={() => setAttach(null)}><X size={12} strokeWidth={3} /></button>
                </div>
              )}
              <div className="row gap8">
                <button className="siriapp-plus glass interactive" aria-label="Add" onClick={(e) => plusMenu(e.currentTarget)}><Plus size={22} /></button>
                <Glass className="siriapp-inputbar grow" variant="heavy">
                  <input
                    ref={inputRef}
                    className="siriapp-input"
                    placeholder={attach ? 'Ask about this photo…' : provider === 'chatgpt' ? 'Ask Siri or ChatGPT…' : 'Ask Siri…'}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && send(text || (attach ? 'What is this?' : ''), { photoId: attach })}
                    enterKeyHint="send"
                    aria-label="Message Siri"
                    data-dictation="What is this?|Which day did Alex say the robotics meeting was?|Add it to my calendar"
                  />
                  {text.trim() || attach ? (
                    <button className="siriapp-send" aria-label="Send" onClick={() => send(text || 'What is this?', { photoId: attach })}><ArrowUp size={18} strokeWidth={3} /></button>
                  ) : (
                    <button className="siriapp-mic" aria-label="Talk to Siri" onClick={startListening}><Mic size={20} /></button>
                  )}
                </Glass>
              </div>
            </>
          )}
        </div>
      }
    >
      <div className="siriapp-ambient" aria-hidden />
      <div className="siriapp-thread">
        {turns.length === 0 && !pending && <Hero onAsk={(q) => send(q)} onWrite={() => setWritingOpen(true)} onAttach={() => setAttachOpen(true)} listening={listening} />}
        {turns.map((t, i) =>
          t.role === 'user' ? (
            <UserBubble key={t.id} t={t} photoId={attachments[t.id]} />
          ) : (
            <SiriMessage key={t.id} t={t} last={i === turns.length - 1} onRegenerate={() => regenerate(t.id)} onSend={send} onStream={() => scrollDown(false)} onDone={() => force((n) => n + 1)} />
          ),
        )}
        {pending && <Thinking q={pending} />}
      </div>

      <AttachSheet open={attachOpen} onClose={() => setAttachOpen(false)} onPick={(id) => { setAttach(id); setAttachOpen(false); window.setTimeout(() => inputRef.current?.focus(), 350) }} />
      <WritingSheet open={writingOpen} onClose={() => setWritingOpen(false)} />
      <RenameSheet conv={conv} open={renameOpen} onClose={() => setRenameOpen(false)} />
    </Page>
  )
}

// ---------------------------------------------------------------- hero (empty chat)
function Hero({ onAsk, onWrite, onAttach, listening }: { onAsk: (q: string) => void; onWrite: () => void; onAttach: () => void; listening: boolean }) {
  const events = useOS((s) => s.events)
  const unread = useOS((s) => s.conversations.reduce((n, c) => n + (c.unread ?? 0), 0))
  const h = new Date().getHours()
  const greet = h < 5 ? 'Good night' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
  const cards = useMemo(() => {
    const now = Date.now()
    const robotics = events.filter((e) => e.start > now && /robotics/i.test(e.title)).sort((a, b) => a.start - b.start)[0]
    const flight = events.find((e) => /flight/i.test(e.title) && e.start > now)
    const all = [
      { q: 'Which day did Alex say the robotics meeting was?', kicker: unread ? `Messages · ${unread} unread` : 'Messages', icon: <MessageCircle size={16} />, color: '#34c759' },
      { q: 'What’s the weather for robotics?', kicker: robotics ? `${robotics.title.replace(/ Meeting$/, '')} · ${dayLabel(robotics.start)} ${fmtTime(robotics.start)}` : 'Weather', icon: <CloudSun size={16} />, color: '#32ade6' },
      { q: 'Show me photos of Biscuit at the beach', kicker: 'Photos · Biscuit', icon: <ImageIcon size={16} />, color: '#ff9500' },
      { q: 'When is my flight?', kicker: flight ? `Calendar · Seattle` : 'Calendar', icon: <Plane size={16} />, color: '#5856d6' },
      { q: 'Text Dad that I’m heading home with my ETA', kicker: 'Messages · Maps', icon: <Car size={16} />, color: '#0a84ff' },
      { q: 'Turn off the living room lights and lock the front door', kicker: 'Home', icon: <House size={16} />, color: '#ff9f0a' },
    ]
    const start = h % 3
    return [...all.slice(start), ...all.slice(0, start)].slice(0, 4)
  }, [events, unread, h])

  return (
    <div className="siriapp-hero">
      <HeroOrb state={listening ? 'listening' : 'idle'} />
      <div className="siriapp-greet">{greet}, Jamie</div>
      <div className="t-callout secondary center" style={{ marginTop: 4 }}>How can I help?</div>
      <div className="siriapp-sugg">
        {cards.map((c, i) => (
          <button key={c.q} className="siriapp-sugg-card pressable anim-up" style={{ animationDelay: `${60 + i * 50}ms` }} onClick={() => onAsk(c.q)}>
            <span className="siriapp-sugg-kicker" style={{ color: c.color }}>{c.icon}<span className="nowrap">{c.kicker}</span></span>
            <span className="siriapp-sugg-q">{c.q}</span>
          </button>
        ))}
      </div>
      <div className="siriapp-tools">
        <button className="pressable" onClick={onWrite}><span style={{ background: 'linear-gradient(135deg,#ff9f0a,#ff375f)' }}><PenLine size={19} color="#fff" /></span>Writing Tools</button>
        <button className="pressable" onClick={() => useOS.getState().launch('camera', { route: 'siri' })}><span style={{ background: 'linear-gradient(135deg,#0a84ff,#64d2ff)' }}><ScanEye size={19} color="#fff" /></span>Visual Intelligence</button>
        <button className="pressable" onClick={onAttach}><span style={{ background: 'linear-gradient(135deg,#34c759,#00c7be)' }}><Camera size={19} color="#fff" /></span>Ask About a Photo</button>
        <button className="pressable" onClick={() => useOS.getState().launch('shortcuts')}><span style={{ background: 'linear-gradient(135deg,#bf5af2,#5e5ce6)' }}><Workflow size={19} color="#fff" /></span>Shortcuts</button>
      </div>
      <div className="t-caption1 tertiary center" style={{ marginTop: 18 }}>Siri uses personal context from your apps, privately on device.</div>
    </div>
  )
}

// ---------------------------------------------------------------- messages
function UserBubble({ t, photoId }: { t: SiriTurn; photoId?: string }) {
  const photo = useOS((s) => (photoId ? s.photos.find((p) => p.id === photoId) : undefined))
  return (
    <div className="siriapp-user anim-up">
      {photo && (
        <button className="siriapp-user-photo" onClick={() => useOS.getState().launch('photos', { route: `photo/${photo.id}` })} aria-label={photo.description}>
          <Scene scene={photo.scene} />
        </button>
      )}
      <div className="siriapp-bubble">{t.text}</div>
    </div>
  )
}

function StreamText({ text, animate, onTick, onDone }: { text: string; animate: boolean; onTick?: () => void; onDone?: () => void }) {
  const parts = useMemo(() => text.split(/(\s+)/), [text])
  const [n, setN] = useState(animate ? 0 : parts.length)
  useEffect(() => {
    if (!animate) return
    let i = 0
    const iv = window.setInterval(() => {
      i += 2
      setN(i)
      onTick?.()
      if (i >= parts.length) {
        window.clearInterval(iv)
        onDone?.()
      }
    }, 34)
    return () => window.clearInterval(iv)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return (
    <div className="siriapp-text">
      {parts.slice(0, n).join('')}
      {n < parts.length && <span className="siriapp-caret" />}
    </div>
  )
}

function SiriMessage({ t, last, onRegenerate, onSend, onStream, onDone }: { t: SiriTurn; last: boolean; onRegenerate: () => void; onSend: (q: string) => void; onStream: () => void; onDone: () => void }) {
  const [streaming, setStreaming] = useState(freshTurns.has(t.id))
  const [rating, setRating] = useState<null | 'up' | 'down'>(null)
  const prov = useSiriLocal((s) => s.providers[t.id])
  const gpt = prov === 'chatgpt' && /^ChatGPT/.test(t.text)
  const conv = useOS((s) => s.siriConversations.find((c) => c.turns.some((x) => x.id === t.id)))
  void onSend
  return (
    <div className="siriapp-reply">
      <div className="siriapp-reply-head">
        {gpt ? <span className="siriapp-gpt-badge"><Sparkles size={12} /></span> : <Orb size={20} still={!streaming} />}
        <span>{gpt ? 'ChatGPT' : 'Siri'}</span>
      </div>
      <StreamText
        text={gpt ? t.text.replace(/^ChatGPT \(simulated\):\s*/, '') : t.text}
        animate={streaming}
        onTick={onStream}
        onDone={() => {
          freshTurns.delete(t.id)
          setStreaming(false)
          onDone()
          window.setTimeout(onStream, 40)
        }}
      />
      {!streaming && t.cards && t.cards.length > 0 && (
        <div className="siriapp-cards anim-up">
          <SiriCards cards={t.cards} onSend={(c, body) => doSend({ to: c.to, body, app: c.app, subject: c.subject })} />
        </div>
      )}
      {!streaming && (
        <div className={`siriapp-actions ${last ? 'show' : ''}`}>
          <button aria-label="Copy" onClick={() => copyText(t.text)}><Copy size={16} /></button>
          <button aria-label="Read aloud" onClick={() => speak(t.text)}><Volume2 size={17} /></button>
          <button aria-label="Good response" className={rating === 'up' ? 'on' : ''} onClick={() => { setRating(rating === 'up' ? null : 'up'); if (rating !== 'up') useOS.getState().showToast('Thanks for the feedback') }}><ThumbsUp size={16} /></button>
          <button aria-label="Bad response" className={rating === 'down' ? 'on' : ''} onClick={() => { setRating(rating === 'down' ? null : 'down'); if (rating !== 'down') useOS.getState().showToast('Thanks — Siri will improve') }}><ThumbsDown size={16} /></button>
          <button aria-label="Share" onClick={() => useOS.getState().set({ shareRequest: { title: conv?.title ?? 'Siri', kind: 'text', payload: t.text, app: 'siri' } })}><Share size={16} /></button>
          <button aria-label="Regenerate" onClick={onRegenerate}><RotateCcw size={16} /></button>
        </div>
      )}
    </div>
  )
}

function Thinking({ q }: { q: string }) {
  const step = THINK_STEPS.find(([re]) => re.test(q))?.[1] ?? 'Thinking'
  const [phase, setPhase] = useState(0)
  useEffect(() => {
    const t = window.setTimeout(() => setPhase(1), 450)
    return () => window.clearTimeout(t)
  }, [])
  return (
    <div className="siriapp-reply siriapp-thinking anim-fade" aria-live="polite">
      <div className="siriapp-reply-head"><Orb size={20} state="thinking" /><span className="siriapp-shimmer">{phase ? `${step}…` : 'Thinking…'}</span></div>
      <div className="siriapp-skel" style={{ width: '88%' }} />
      <div className="siriapp-skel" style={{ width: '64%' }} />
    </div>
  )
}

// ---------------------------------------------------------------- attach
function AttachSheet({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick: (id: string) => void }) {
  const photos = useOS((s) => s.photos)
  const list = useMemo(() => photos.filter((p) => !p.hidden && !p.idDocument && p.kind !== 'video').sort((a, b) => b.ts - a.ts).slice(0, 36), [photos])
  return (
    <Sheet open={open} onClose={onClose} title="Photos" detent="large">
      <div className="t-footnote secondary" style={{ padding: '0 18px 10px' }}>Choose a photo to ask Siri about. Recent · {list.length} items</div>
      <div className="siriapp-grid">
        {list.map((p) => (
          <button key={p.id} onClick={() => onPick(p.id)} aria-label={p.description} className="pressable">
            <Scene scene={p.scene} />
            {p.ts > Date.now() - 48 * HOUR && <span className="siriapp-new-dot" />}
          </button>
        ))}
      </div>
    </Sheet>
  )
}
