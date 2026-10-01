/* iOS 27 Siri presentation (released behaviour):
 *  - no screen-edge glow; a dark Liquid Glass ORB descends from the Dynamic Island and
 *    pulses with a multicolour waveform while listening
 *  - while thinking, the orb shrinks into a pill over the island with a loading indicator
 *  - the answer expands out of the island as a dark translucent card with rich cards
 *  - swipe down on the answer (or tap the chevron) for the chat-style conversation view
 *    where you can type follow-ups. */
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { ArrowUp, Mic, AppWindow, Eye, Keyboard as KbIcon, ChevronDown } from 'lucide-react'
import { useOS } from '../os/store'
import { Spinner } from '../ui/controls'
import { SiriCards } from './siri/SiriCards'
import { runSiri, stopSpeaking } from './siri/session'
import { doSend, SIRI_SUGGESTIONS } from '../os/ai/siri'
import { ICONS } from '../icons/AppIconArt'
import { springs, animateSpring } from '../os/spring'
import { screenScale } from '../os/hooks'
import { useShell } from './shellState'

type View = 'orb' | 'card' | 'chat'

function onscreenLabel(o: ReturnType<typeof useOS.getState>['siriOnscreen'], openApp: string | null): string | null {
  if (!openApp || o.app !== openApp) return null
  const e = o.entity ?? {}
  const what = e.name ?? e.title ?? o.context
  return `${ICONS[o.app as keyof typeof ICONS]?.name ?? ''}${what ? ` · ${what}` : ''}`
}

export function SiriOverlay() {
  const active = useOS((s) => s.siriActive)
  if (!active) return null
  return <SiriOverlayInner />
}

function SiriOverlayInner() {
  const st = useOS()
  const pending = useRef(useShell.getState().siriPending)
  const [view, setView] = useState<View>(pending.current ? 'card' : st.siriMode === 'listening' ? 'orb' : 'chat')
  const [text, setText] = useState('')
  const [transcript, setTranscript] = useState('')
  const [turnStart, setTurnStart] = useState(0)
  const cardRef = useRef<HTMLDivElement>(null)
  const orbRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const chatEnd = useRef<HTMLDivElement>(null)
  const convId = useRef<string | null>(null)
  const conv = st.siriConversations.find((c) => c.id === convId.current)
  const turns = conv?.turns.slice(turnStart) ?? []
  const lastSiri = [...turns].reverse().find((t) => t.role === 'siri')
  const lastUser = [...turns].reverse().find((t) => t.role === 'user')
  const ctx = st.siriSettings.onscreen ? onscreenLabel(st.siriOnscreen, st.openApp) : null
  const mode = st.siriMode
  const landscape = st.orientation === 'landscape'

  useEffect(() => {
    // continue a conversation from the last 5 minutes, otherwise start fresh
    const recent = st.siriConversations[0]
    if (recent && Date.now() - recent.updated < 5 * 60_000) {
      convId.current = recent.id
      setTurnStart(recent.turns.length)
      st.set({ siriCurrent: recent.id })
    } else {
      convId.current = st.siriNewConversation()
    }
    if (pending.current) {
      const q = pending.current
      useShell.getState().set({ siriPending: null })
      void runSiri(q, { convId: convId.current ?? undefined, fromOverlay: true })
    }
    return () => stopSpeaking()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // orb descends from the Dynamic Island
  useLayoutEffect(() => {
    if (view === 'orb' && orbRef.current) animateSpring(orbRef.current, [{ transform: 'scale(.98, .29)', borderRadius: '20px', opacity: 0.9 }, { transform: 'none', borderRadius: '50%', opacity: 1 }], springs.island(), { fill: 'none' })
    if (view === 'card' && cardRef.current) animateSpring(cardRef.current, [{ transform: 'scale(.4, .15)', opacity: 0.2, borderRadius: '60px' }, { transform: 'none', opacity: 1, borderRadius: '38px' }], springs.island(), { fill: 'none' })
  }, [view, lastSiri?.id])

  useEffect(() => {
    if (view === 'chat') window.setTimeout(() => inputRef.current?.focus(), 60)
  }, [view])
  useEffect(() => {
    chatEnd.current?.scrollIntoView({ block: 'end' })
  }, [turns.length, view])

  const submit = async (q: string, voice = false) => {
    if (!q.trim()) return
    setText('')
    setTranscript('')
    if (view === 'orb') setView('card')
    await runSiri(q.trim(), { convId: convId.current ?? undefined, fromOverlay: true, voice })
  }

  // simulated speech: stream the chosen phrase word-by-word into the transcript, then send
  const speakPhrase = (phrase: string) => {
    setView('orb')
    useOS.getState().set({ siriMode: 'listening' })
    const words = phrase.split(' ')
    let i = 0
    setTranscript('')
    const iv = window.setInterval(() => {
      i++
      setTranscript(words.slice(0, i).join(' '))
      if (i >= words.length) {
        window.clearInterval(iv)
        window.setTimeout(() => submit(phrase, true), 250)
      }
    }, 110)
  }

  const close = () => useOS.getState().set({ siriActive: false, siriMode: 'idle' })
  const suggestions = lastSiri?.followUps?.length ? lastSiri.followUps : ctx ? contextualSuggestions(st.siriOnscreen) : SIRI_SUGGESTIONS.slice(0, 4)

  // swipe down on the answer card → conversation view
  const onCardDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('button, a, input, textarea, .scard')) return
    const y0 = e.clientY
    const s = screenScale()
    const up = (ev: PointerEvent) => {
      window.removeEventListener('pointerup', up)
      if ((ev.clientY - y0) / s > 30) setView('chat')
    }
    window.addEventListener('pointerup', up)
  }

  const thinking = mode === 'thinking'

  return (
    <div className={`siri27 view-${view} ${landscape ? 'landscape' : ''}`} role="dialog" aria-label="Siri">
      <div className="siri27-scrim" onClick={close} />

      {/* pill over the Dynamic Island while thinking */}
      {thinking && view !== 'chat' && (
        <div className="siri27-pill" aria-label="Siri is thinking">
          <span className="siri27-pill-orb" />
          <Spinner size={14} />
        </div>
      )}

      {view === 'orb' && !thinking && (
        <div className="siri27-orb-wrap">
          <div ref={orbRef} className={`siri27-orb ${mode === 'listening' ? 'listening' : ''} ${transcript ? 'hearing' : ''}`} onClick={() => setView('chat')} role="button" aria-label="Siri is listening">
            <span className="siri27-orb-glow" />
            <span className="siri27-orb-cam" />
            <div className="siri27-wave">{Array.from({ length: 5 }).map((_, i) => <span key={i} style={{ animationDelay: `${i * 0.11}s` }} />)}</div>
          </div>
          <div className="siri27-below">
            {transcript && <div className="siri27-transcript">{transcript}</div>}
            {ctx && <div className="siri27-ctx"><Eye size={12} /> {ctx}</div>}
            <div className="siri27-chips scroll">
              {suggestions.map((s) => <button key={s} className="siri27-chip" onClick={() => speakPhrase(s)}>{s}</button>)}
            </div>
            <button className="siri27-typebtn" aria-label="Type to Siri" onClick={() => setView('chat')}><KbIcon size={16} /> Type to Siri</button>
          </div>
        </div>
      )}

      {view === 'card' && lastSiri && !thinking && (
        <div className="siri27-card" ref={cardRef} onPointerDown={onCardDown}>
          {lastUser && <div className="siri27-q">{lastUser.text}</div>}
          <div className="siri-bubble siri27-answer">{lastSiri.text}</div>
          {lastSiri.cards && lastSiri.cards.length > 0 && (
            <div className="siri27-cards scroll"><SiriCards cards={lastSiri.cards} onSend={(c, body) => doSend({ to: c.to, body, app: c.app, subject: c.subject })} /></div>
          )}
          <button className="siri27-more" onClick={() => setView('chat')} aria-label="Swipe down to reply"><ChevronDown size={18} /> Reply or ask a follow-up</button>
        </div>
      )}

      {view === 'chat' && (
        <div className="siri27-chat">
          <div className="siri27-chat-head">
            <span className="siri27-pill-orb" />
            <span className="t-headline">Siri</span>
            <div style={{ flex: 1 }} />
            <button className="siri27-link" onClick={() => { const id = convId.current; close(); useOS.getState().launch('siri', { route: id ? `conv/${id}` : undefined }) }}><AppWindow size={14} /> Open in Siri</button>
            <button className="siri27-link" onClick={close}>Done</button>
          </div>
          <div className="siri27-thread scroll">
            {turns.length === 0 && <div className="siri27-empty">Ask about your day, your messages, what’s on screen — or anything.</div>}
            {turns.map((t) =>
              t.role === 'user' ? (
                <div key={t.id} className="siri27-user anim-fade">{t.text}</div>
              ) : (
                <div key={t.id} className="siri27-reply anim-up">
                  <div className="siri-bubble siri27-bubble">{t.text}</div>
                  {t.cards && t.cards.length > 0 && <SiriCards cards={t.cards} onSend={(c, body) => doSend({ to: c.to, body, app: c.app, subject: c.subject })} />}
                </div>
              ),
            )}
            {thinking && <div className="siri27-thinking"><span className="siri27-pill-orb" /> <Spinner size={14} /></div>}
            <div ref={chatEnd} />
          </div>
          <div className="siri27-chips scroll">
            {suggestions.map((s) => <button key={s} className="siri27-chip" onClick={() => submit(s)}>{s}</button>)}
          </div>
          <div className="siri27-inputbar">
            {ctx && <div className="siri27-ctx"><Eye size={12} /> Onscreen: {ctx}</div>}
            <div className="row gap8">
              <input
                ref={inputRef}
                className="text-input siri-input"
                placeholder="Ask Siri…"
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && submit(text)}
                enterKeyHint="send"
                aria-label="Ask Siri"
              />
              {text.trim() ? (
                <button className="send-btn" aria-label="Send" onClick={() => submit(text)}><ArrowUp size={18} strokeWidth={3} /></button>
              ) : (
                <button className="bar-btn icon" aria-label="Use voice" onClick={() => { setView('orb'); useOS.getState().set({ siriMode: 'listening' }) }}><Mic size={20} /></button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function contextualSuggestions(o: ReturnType<typeof useOS.getState>['siriOnscreen']): string[] {
  const t = o.entity?.type
  if (t === 'conversation') return ['Add this to my calendar', 'Add this to Reminders', 'Summarize this conversation', 'Reply that I’ll be there']
  if (t === 'photo') return ['What is this?', 'Send this photo to Dad', 'When was this taken?']
  if (t === 'page') return ['Summarize this page', 'What is this page about?', 'Save it to Notes']
  if (t === 'mail') return ['Add this to my calendar', 'Summarize this email', 'Get directions']
  if (t === 'camera') return ['What is this?', 'How much is the tip?', 'Split it four ways']
  return ['What’s on my screen?', ...SIRI_SUGGESTIONS.slice(0, 2)]
}
