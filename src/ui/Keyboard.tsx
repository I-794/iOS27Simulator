import { useEffect, useRef, useState, useCallback, useLayoutEffect } from 'react'
import { Delete, ArrowBigUp, Globe, Mic, Smile, CornerDownLeft, ArrowUp, Undo2, X, Check } from 'lucide-react'
import { useOS } from '../os/store'
import { AISparkle, Glass, Spinner } from './controls'
import { proofread, rewrite, summarize, keyPoints, toList, feedback, draft, type Tone } from '../os/ai/writing'
import { CONTACTS } from '../os/data/people'
import { springs, animateSpring } from '../os/spring'

type Field = HTMLInputElement | HTMLTextAreaElement

export function setNativeValue(el: Field, value: string) {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
  Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(el, value)
  el.dispatchEvent(new Event('input', { bubbles: true }))
}

function insert(el: Field, text: string) {
  const supportsSel = !(el instanceof HTMLInputElement) || ['text', 'search', 'url', 'tel', 'password', ''].includes(el.type)
  const start = supportsSel ? el.selectionStart ?? el.value.length : el.value.length
  const end = supportsSel ? el.selectionEnd ?? start : el.value.length
  const next = el.value.slice(0, start) + text + el.value.slice(end)
  setNativeValue(el, next)
  if (supportsSel) el.setSelectionRange(start + text.length, start + text.length)
}

function backspace(el: Field) {
  const supportsSel = !(el instanceof HTMLInputElement) || ['text', 'search', 'url', 'tel', 'password', ''].includes(el.type)
  const start = supportsSel ? el.selectionStart ?? el.value.length : el.value.length
  const end = supportsSel ? el.selectionEnd ?? start : el.value.length
  if (start === end && start === 0) return
  const chars = Array.from(el.value.slice(0, start))
  const a = start === end ? chars.slice(0, -1).join('').length : start
  setNativeValue(el, el.value.slice(0, a) + el.value.slice(end))
  if (supportsSel) el.setSelectionRange(a, a)
}

const LETTERS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm']
const NUMBERS = ['1234567890', '-/:;()$&@"', '.,?!\'']
const SYMBOLS = ['[]{}#%^*+=', '_\\|~<>€£¥•', '.,?!\'']
const EMOJI: Record<string, string[]> = {
  Frequently: ['😂', '❤️', '👍', '🙏', '😭', '🥹', '🔥', '✨', '🎉', '😊', '🙌', '💯', '🥁', '🤖', '🐶', '📸'],
  Smileys: ['😀', '😃', '😄', '😁', '😆', '🥲', '😅', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😋', '😛', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🥸', '🤩', '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '😣', '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡', '🤯', '😳'],
  Animals: ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🐔', '🐧', '🐦', '🦆', '🦉'],
  Food: ['🍕', '🍜', '🥞', '☕️', '🍔', '🌮', '🍣', '🍩', '🍪', '🍎', '🍓', '🍉', '🥑', '🍿', '🧋', '🥤'],
  Activity: ['⚽️', '🏀', '🏈', '🎾', '🏐', '🥁', '🎸', '🎹', '🎺', '🎻', '🎮', '🎯', '🏆', '🎨', '🎬', '🎤'],
  Objects: ['📱', '💻', '⌚️', '📷', '🔋', '🔌', '💡', '🔦', '📚', '✏️', '📎', '🔧', '🔩', '⚙️', '🧲', '🎒'],
}

const COMMON = ['the', 'to', 'and', 'you', 'I', 'it', 'is', 'that', 'for', 'on', 'with', 'robotics', 'tomorrow', 'Thursday', 'Friday', 'practice', 'meeting', 'thanks', 'sounds', 'good', 'okay', 'awesome', 'charger', 'percussion', 'bring', 'remind', 'dinner', 'Grandma', 'Biscuit', 'study', 'library', 'chemistry', 'concert', 'heading', 'home', 'what', 'when', 'where', 'can', 'could', 'would', 'love', 'later', 'see', 'soon', 'mañana', 'gracias', 'hola', 'estás', 'bueno']
const NEXT: Record<string, string[]> = {
  '': ['I', 'The', 'Hey'],
  i: ['am', 'will', 'think'],
  "i'm": ['on', 'heading', 'not'],
  see: ['you', 'it', 'the'],
  sounds: ['good', 'great', 'like'],
  on: ['my', 'the', 'it'],
  my: ['way', 'phone', 'charger'],
  thank: ['you', 'you so', 'u'],
  thanks: ['for', '!', 'so much'],
  the: ['robotics', 'meeting', 'concert'],
  at: ['6:30', 'the', 'home'],
  going: ['to', 'home', 'out'],
  heading: ['home', 'out', 'over'],
  love: ['you', 'it', 'that'],
  can: ['you', 'I', 'we'],
  what: ['time', 'about', 'is'],
  hola: ['cómo', 'amigo', '¿qué'],
}

export function suggestionsFor(text: string, names: string[]): string[] {
  const words = text.split(/\s+/)
  const cur = words[words.length - 1] ?? ''
  const prev = (words[words.length - 2] ?? '').toLowerCase()
  if (!cur) return NEXT[prev] ?? NEXT['']
  const lower = cur.toLowerCase()
  const pool = [...names, ...COMMON]
  const matches = pool.filter((w) => w.toLowerCase().startsWith(lower) && w.toLowerCase() !== lower).slice(0, 2)
  const pr = proofread(cur).text.replace(/\.$/, '')
  const out = [`“${cur}”`, ...matches]
  if (pr !== cur && pr.toLowerCase() !== lower.charAt(0).toUpperCase() + lower.slice(1)) out.splice(1, 0, pr)
  while (out.length < 3) out.push(NEXT[lower]?.[out.length - 1] ?? ['the', 'and', 'you'][out.length - 1])
  return out.slice(0, 3)
}

const NAMES = CONTACTS.filter((c) => !c.isBusiness).map((c) => c.first)

export function KeyboardHost() {
  const open = useOS((s) => s.keyboardOpen)
  const landscape = useOS((s) => s.orientation === 'landscape')
  const multilingual = useOS((s) => s.language.multilingual)
  const autoPunct = useOS((s) => s.language.autoPunctuation)
  const [field, setField] = useState<Field | null>(null)
  const [mode, setMode] = useState<'abc' | '123' | '#+=' | 'emoji'>('abc')
  const [shift, setShift] = useState<'off' | 'on' | 'lock'>('on')
  const [text, setText] = useState('')
  const [tools, setTools] = useState(false)
  const [dictating, setDictating] = useState(false)
  const [lang, setLang] = useState<'EN' | 'ES'>('EN')
  const ref = useRef<HTMLDivElement>(null)
  const lastShiftTap = useRef(0)

  // track focus inside the screen
  useEffect(() => {
    const screen = document.querySelector('.screen')
    if (!screen) return
    const isField = (t: EventTarget | null): t is Field =>
      (t instanceof HTMLInputElement && !['checkbox', 'radio', 'range', 'color', 'file', 'date', 'time', 'datetime-local'].includes(t.type)) || t instanceof HTMLTextAreaElement
    const onIn = (e: Event) => {
      if (isField(e.target) && !(e.target as HTMLElement).dataset.noKeyboard) {
        setField(e.target)
        setText(e.target.value)
        setShift(e.target.value ? 'off' : 'on')
        useOS.setState({ keyboardOpen: true })
      }
    }
    const onOut = (e: Event) => {
      if (!isField(e.target)) return
      window.setTimeout(() => {
        const a = document.activeElement
        if (!isField(a) || !screen.contains(a)) {
          if (!document.querySelector('.kb-tools:hover')) {
            useOS.setState({ keyboardOpen: false })
            setTools(false)
          }
        }
      }, 60)
    }
    const onInput = (e: Event) => {
      if (isField(e.target)) {
        const v = e.target.value
        setText(v)
        setShift((sh) => (sh === 'lock' ? sh : v === '' || /[.!?]\s$/.test(v) ? 'on' : 'off'))
      }
    }
    screen.addEventListener('focusin', onIn)
    screen.addEventListener('focusout', onOut)
    screen.addEventListener('input', onInput)
    return () => {
      screen.removeEventListener('focusin', onIn)
      screen.removeEventListener('focusout', onOut)
      screen.removeEventListener('input', onInput)
    }
  }, [])

  useLayoutEffect(() => {
    const screen = document.querySelector('.screen') as HTMLElement | null
    if (!screen) return
    const h = open ? (landscape ? 206 : 300) : 0
    screen.style.setProperty('--kb-height', `${h}px`)
    if (open && ref.current) animateSpring(ref.current, [{ transform: 'translateY(100%)' }, { transform: 'translateY(0)' }], springs.sheet(), { fill: 'none' })
  }, [open, landscape])

  const press = useCallback(
    (ch: string) => {
      if (!field) return
      let out = ch
      if (mode === 'abc' && shift !== 'off') out = ch.toUpperCase()
      insert(field, out)
      if (mode !== 'abc' && ch === "'") setMode('abc')
    },
    [field, mode, shift],
  )

  const space = () => {
    if (!field) return
    const v = field.value
    // double-space → period
    if (v.endsWith(' ') && /\w$/.test(v.slice(0, -1)) && autoPunct) {
      backspace(field)
      insert(field, '. ')
      setShift('on')
      return
    }
    insert(field, ' ')
    if (/[.!?]\s$/.test(field.value)) setShift('on')
  }

  const returnKey = () => {
    if (!field) return
    if (field instanceof HTMLTextAreaElement && !field.dataset.sendOnEnter) {
      insert(field, '\n')
      setShift('on')
      return
    }
    field.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true }))
    field.form?.requestSubmit?.()
  }

  const acceptSuggestion = (s: string) => {
    if (!field) return
    if (s.startsWith('“')) {
      insert(field, ' ')
      return
    }
    const v = field.value
    const m = v.match(/(\S*)$/)
    const cur = m?.[1] ?? ''
    if (cur) {
      setNativeValue(field, v.slice(0, v.length - cur.length) + s + ' ')
    } else {
      insert(field, s + ' ')
    }
  }

  const dictate = () => {
    if (!field) return
    setDictating(true)
    const phrases = field.dataset.dictation?.split('|') ?? [
      'sounds good see you at six thirty',
      'can you send me the notes from chemistry',
      'heading home now be there in 15 minutes',
    ]
    const phrase = phrases[Math.floor(Math.random() * phrases.length)]
    const words = phrase.split(' ')
    let i = 0
    const iv = window.setInterval(() => {
      if (i >= words.length) {
        window.clearInterval(iv)
        // automatic punctuation + capitalization
        if (autoPunct) setNativeValue(field, proofread(field.value).text)
        setDictating(false)
        return
      }
      insert(field, (field.value && !field.value.endsWith(' ') ? ' ' : '') + words[i])
      i++
    }, 170)
  }

  if (!open) return null
  const rows = mode === 'abc' ? LETTERS : mode === '123' ? NUMBERS : SYMBOLS
  const sugg = suggestionsFor(text, NAMES)
  const keyH = landscape ? 34 : 45
  const recipient = field?.dataset.recipient

  return (
    <div className={`keyboard ${landscape ? 'landscape' : ''}`} ref={ref} onPointerDown={(e) => e.preventDefault()} role="group" aria-label="Keyboard">
      {tools && field && <WritingTools field={field} recipient={recipient} onClose={() => setTools(false)} />}
      <div className="kb-suggest">
        <button className="kb-ai" aria-label="Write with Siri" onClick={() => setTools((t) => !t)}>
          <AISparkle size={20} />
        </button>
        {dictating ? (
          <div className="kb-dictating"><span className="kb-wave" /> Listening… <span className="secondary t-caption1">(simulated dictation)</span></div>
        ) : (
          sugg.map((s, i) => (
            <button key={i} className="kb-sugg" onClick={() => acceptSuggestion(s)}>
              {s}
            </button>
          ))
        )}
      </div>
      {mode === 'emoji' ? (
        <div className="kb-emoji scroll">
          {Object.entries(EMOJI).map(([cat, list]) => (
            <div key={cat}>
              <div className="kb-emoji-cat">{cat}</div>
              <div className="kb-emoji-grid">
                {list.map((e, i) => (
                  <button key={i} onClick={() => field && insert(field, e)} aria-label={e}>
                    {e}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="kb-keys">
          {rows.map((row, r) => (
            <div className="kb-row" key={r} style={{ padding: r === 1 && mode === 'abc' ? '0 18px' : undefined }}>
              {r === 2 && (
                mode === 'abc' ? (
                  <button
                    className={`kb-key kb-fn ${shift !== 'off' ? 'kb-on' : ''}`}
                    style={{ height: keyH }}
                    aria-label="Shift"
                    onClick={() => {
                      const now = Date.now()
                      if (now - lastShiftTap.current < 300) setShift('lock')
                      else setShift(shift === 'off' ? 'on' : 'off')
                      lastShiftTap.current = now
                    }}
                  >
                    <ArrowBigUp size={22} fill={shift !== 'off' ? 'currentColor' : 'none'} strokeWidth={1.8} />
                    {shift === 'lock' && <span className="kb-lock" />}
                  </button>
                ) : (
                  <button className="kb-key kb-fn" style={{ height: keyH }} onClick={() => setMode(mode === '123' ? '#+=' : '123')}>
                    {mode === '123' ? '#+=' : '123'}
                  </button>
                )
              )}
              {row.split('').map((k) => (
                <button key={k} className="kb-key" style={{ height: keyH }} onClick={() => press(k)} aria-label={k}>
                  {mode === 'abc' && shift !== 'off' ? k.toUpperCase() : k}
                </button>
              ))}
              {r === 2 && (
                <button className="kb-key kb-fn" style={{ height: keyH }} aria-label="Delete" onClick={() => field && backspace(field)}>
                  <Delete size={22} strokeWidth={1.8} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      <div className="kb-row kb-bottom">
        <button className="kb-key kb-fn wide" style={{ height: keyH }} onClick={() => setMode(mode === 'abc' ? '123' : 'abc')}>
          {mode === 'abc' ? '123' : 'ABC'}
        </button>
        <button className="kb-key kb-fn" style={{ height: keyH }} aria-label="Emoji" onClick={() => setMode(mode === 'emoji' ? 'abc' : 'emoji')}>
          <Smile size={22} strokeWidth={1.8} />
        </button>
        <button className="kb-key kb-space" style={{ height: keyH }} onClick={space}>
          {multilingual && !landscape ? (lang === 'EN' ? 'English · Español' : 'Español · English') : 'space'}
        </button>
        <button className="kb-key kb-fn wide kb-return" style={{ height: keyH }} onClick={returnKey} aria-label="Return">
          {field?.enterKeyHint === 'send' ? <ArrowUp size={20} strokeWidth={2.4} /> : field?.enterKeyHint === 'search' ? 'search' : field?.enterKeyHint === 'go' ? 'go' : <CornerDownLeft size={20} strokeWidth={2} />}
        </button>
      </div>
      {!landscape && (
        <div className="kb-extra">
          <button aria-label="Next keyboard" onClick={() => setLang(lang === 'EN' ? 'ES' : 'EN')}>
            <Globe size={24} strokeWidth={1.8} />
            <span className="kb-lang">{lang}</span>
          </button>
          <button aria-label="Dictate" onClick={dictate} className={dictating ? 'kb-mic-on' : ''}>
            <Mic size={24} strokeWidth={1.8} />
          </button>
        </div>
      )}
    </div>
  )
}

function WritingTools({ field, recipient, onClose }: { field: Field; recipient?: string; onClose: () => void }) {
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [notes, setNotes] = useState<string[] | null>(null)
  const [undo, setUndo] = useState<string | null>(null)
  const [describe, setDescribe] = useState('')
  const src = field.value
  const isMail = !!field.dataset.mail
  const run = (fn: () => string | string[]) => {
    setBusy(true)
    setResult(null)
    setNotes(null)
    window.setTimeout(() => {
      const r = fn()
      if (Array.isArray(r)) setNotes(r)
      else setResult(r)
      setBusy(false)
    }, 550)
  }
  const apply = () => {
    if (result == null) return
    setUndo(src)
    setNativeValue(field, result)
    setResult(null)
    field.focus()
  }
  const tone = (t: Tone | 'rewrite') => run(() => rewrite(src, t, recipient))
  const empty = !src.trim()
  const rel = recipient ? CONTACTS.find((c) => c.id === recipient) : undefined
  return (
    <Glass className="kb-tools anim-up" variant="heavy" onPointerDown={(e) => e.preventDefault()}>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
        <div className="row gap6 t-headline"><AISparkle size={18} /> Write with Siri</div>
        <div className="row gap6">
          {undo !== null && (
            <button className="bar-btn icon" aria-label="Undo" onClick={() => { setNativeValue(field, undo); setUndo(null) }}><Undo2 size={18} /></button>
          )}
          <button className="bar-btn icon" aria-label="Close Write with Siri" onClick={onClose}><X size={18} /></button>
        </div>
      </div>
      {rel && <div className="t-caption1 secondary" style={{ marginBottom: 8 }}>Matching your usual style with {rel.nickname ?? rel.first} ({rel.tone === 'teacher' ? 'respectful' : rel.tone === 'family' ? 'warm' : 'casual'})</div>}
      <div className="kb-tools-describe">
        <input
          className="text-input"
          data-no-keyboard="1"
          placeholder={empty ? 'Describe what you want to write…' : 'Describe your change…'}
          value={describe}
          onChange={(e) => setDescribe(e.target.value)}
          onPointerDown={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && describe.trim()) {
              const d = describe
              run(() => {
                if (empty) {
                  const r = draft(d, recipient, isMail ? 'mail' : 'message')
                  return r.body
                }
                const low = d.toLowerCase()
                if (/short|concise|brief/.test(low)) return rewrite(src, 'concise', recipient)
                if (/formal|professional|polite/.test(low)) return rewrite(src, 'professional', recipient)
                if (/friend|casual|warm/.test(low)) return rewrite(src, 'friendly', recipient)
                if (/excit|fun|enthusias/.test(low)) return rewrite(src, 'excited', recipient)
                if (/list|bullet/.test(low)) return toList(src)
                if (/poem|rhyme/.test(low)) return `${src.split(/[.!?]/)[0]},\nwords that fall in time —\na message sent with care,\nnow tuned into a rhyme.`
                return rewrite(src, 'rewrite', recipient)
              })
            }
          }}
        />
      </div>
      {empty ? (
        <div className="kb-tools-grid">
          {['Ask to stay late Thursday to finish the intake', 'Tell them I’m heading home', 'Thank them for the help'].map((s) => (
            <button key={s} className="chip" onClick={() => run(() => draft(s, recipient, isMail ? 'mail' : 'message').body)}>{s}</button>
          ))}
        </div>
      ) : (
        <div className="kb-tools-grid">
          <button className="chip" onClick={() => run(() => proofread(src).text)}>Proofread</button>
          <button className="chip" onClick={() => tone('rewrite')}>Rewrite</button>
          <button className="chip" onClick={() => tone('friendly')}>Friendly</button>
          <button className="chip" onClick={() => tone('professional')}>Professional</button>
          <button className="chip" onClick={() => tone('concise')}>Concise</button>
          <button className="chip" onClick={() => run(() => summarize(src))}>Summary</button>
          <button className="chip" onClick={() => run(() => keyPoints(src))}>Key Points</button>
          <button className="chip" onClick={() => run(() => feedback(src))}>Feedback</button>
        </div>
      )}
      {busy && <div className="row gap8" style={{ padding: '10px 2px' }}><Spinner size={16} /><span className="secondary t-subhead">Writing…</span></div>}
      {result !== null && (
        <div className="kb-tools-result anim-fade">
          <div className="scroll" style={{ maxHeight: 110, whiteSpace: 'pre-wrap' }}>{result}</div>
          <div className="row gap8" style={{ marginTop: 8 }}>
            <button className="btn small gray" onClick={() => setResult(null)}>Discard</button>
            <button className="btn small filled" onClick={apply}><Check size={16} /> Replace</button>
          </div>
        </div>
      )}
      {notes && (
        <div className="kb-tools-result anim-fade">
          {notes.map((n, i) => <div key={i} className="t-subhead" style={{ padding: '3px 0' }}>• {n}</div>)}
        </div>
      )}
    </Glass>
  )
}
