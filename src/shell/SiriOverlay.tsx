import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { ArrowUp, Mic, AppWindow, Eye, X, Keyboard as KbIcon } from 'lucide-react'
import { useOS } from '../os/store'
import { Glass, Spinner } from '../ui/controls'
import { SiriCards } from './siri/SiriCards'
import { runSiri, stopSpeaking } from './siri/session'
import { doSend, SIRI_SUGGESTIONS } from '../os/ai/siri'
import { ICONS } from '../icons/AppIconArt'
import { springs, animateSpring } from '../os/spring'

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
  const [text, setText] = useState('')
  const [typing, setTyping] = useState(st.siriMode !== 'listening' || st.siriSettings.typeToSiri === false ? true : false)
  const [transcript, setTranscript] = useState('')
  const [turnStart, setTurnStart] = useState(0)
  const panelRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const convId = useRef<string | null>(null)
  const conv = st.siriConversations.find((c) => c.id === convId.current)
  const turns = conv?.turns.slice(turnStart) ?? []
  const lastSiri = [...turns].reverse().find((t) => t.role === 'siri')
  const ctx = st.siriSettings.onscreen ? onscreenLabel(st.siriOnscreen, st.openApp) : null

  useEffect(() => {
    // continue the recent conversation if it was < 5 minutes ago, else start a new one
    const recent = st.siriConversations[0]
    if (recent && Date.now() - recent.updated < 5 * 60_000) {
      convId.current = recent.id
      setTurnStart(recent.turns.length)
      st.set({ siriCurrent: recent.id })
    } else {
      convId.current = st.siriNewConversation()
    }
    return () => stopSpeaking()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useLayoutEffect(() => {
    if (panelRef.current) animateSpring(panelRef.current, [{ transform: 'translateY(40px) scale(.96)', opacity: 0 }, { transform: 'none', opacity: 1 }], springs.island(), { fill: 'none' })
  }, [])

  useEffect(() => {
    if (typing) window.setTimeout(() => inputRef.current?.focus(), 60)
  }, [typing])

  const submit = async (q: string, voice = false) => {
    if (!q.trim()) return
    setText('')
    setTranscript('')
    await runSiri(q.trim(), { convId: convId.current ?? undefined, fromOverlay: true, voice })
  }

  // simulated voice dictation: stream the chosen phrase word-by-word, then submit
  const speakPhrase = (phrase: string) => {
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
  const mode = st.siriMode
  const suggestions = lastSiri?.followUps?.length ? lastSiri.followUps : ctx ? contextualSuggestions(st.siriOnscreen) : SIRI_SUGGESTIONS.slice(0, 4)

  return (
    <div className={`siri-overlay mode-${mode}`} role="dialog" aria-label="Siri">
      <div className="siri-edge" aria-hidden />
      <div className="siri-dismiss" onClick={close} />
      <div className="siri-stack" ref={panelRef}>
        <div className="siri-turns scroll">
          {turns.map((t) =>
            t.role === 'user' ? (
              <div key={t.id} className="siri-user anim-fade">{t.text}</div>
            ) : (
              <div key={t.id} className="siri-reply anim-up">
                <Glass className="siri-bubble" variant="heavy">{t.text}</Glass>
                {t.cards && t.cards.length > 0 && <SiriCards cards={t.cards} onSend={(c, body) => doSend({ to: c.to, body, app: c.app, subject: c.subject })} />}
              </div>
            ),
          )}
          {mode === 'thinking' && (
            <div className="siri-thinking"><span className="siri-orb-sm" /> <Spinner size={14} /></div>
          )}
        </div>
        <div className="siri-chips scroll">
          {suggestions.map((s) => (
            <button key={s} className="chip glass" onClick={() => (typing ? submit(s) : speakPhrase(s))}>{s}</button>
          ))}
        </div>
        <Glass className="siri-bar" variant="heavy">
          {ctx && (
            <div className="siri-context"><Eye size={12} /> Onscreen: {ctx}</div>
          )}
          <div className="row gap8">
            <span className={`siri-orb ${mode === 'listening' ? 'listening' : mode === 'thinking' ? 'thinking' : ''}`} aria-hidden />
            {typing ? (
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
            ) : (
              <div className="siri-transcript" onClick={() => setTyping(true)}>
                {transcript || <span className="secondary">{mode === 'listening' ? 'Listening… tap a suggestion to speak it' : 'Tap to type'}</span>}
              </div>
            )}
            {typing && text.trim() ? (
              <button className="send-btn" aria-label="Send" onClick={() => submit(text)}><ArrowUp size={18} strokeWidth={3} /></button>
            ) : (
              <button className="bar-btn icon" aria-label={typing ? 'Use voice' : 'Type to Siri'} onClick={() => { setTyping(!typing); useOS.getState().set({ siriMode: typing ? 'listening' : 'idle' }) }}>
                {typing ? <Mic size={20} /> : <KbIcon size={20} />}
              </button>
            )}
          </div>
          <div className="row" style={{ justifyContent: 'space-between', marginTop: 8 }}>
            <button className="siri-link" onClick={() => { const id = convId.current; close(); useOS.getState().launch('siri', { route: id ? `conv/${id}` : undefined }) }}><AppWindow size={14} /> Continue in Siri app</button>
            <button className="siri-link" onClick={close} aria-label="Close Siri"><X size={14} /> Close</button>
          </div>
        </Glass>
      </div>
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
