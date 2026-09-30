import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Leaf, Utensils, Landmark, Receipt, CloudLightning, ShoppingBag, FileText, PawPrint, MapPin, Sparkles, Minus, Plus, ScanFace, Check, ArrowUp, Users, Calculator } from 'lucide-react'
import { useOS } from '../../os/store'
import type { VisionAction } from '../../os/ai/vision'
import { camInsight, camAnswer, DEMO_SCENES } from './extra'
import { EXTRA_SCENES, ExtraScene } from '../photos/extraScenes'
import { Scene } from '../../art/Scene'
import { Sheet } from '../../ui/overlay'
import { Avatar, Segmented, Button, AISparkle } from '../../ui/controls'
import { contactName } from '../../os/data/people'
import { playAlert } from '../../os/audio'
import { runVisionAction, money } from './actions'

const CAT_ICON: Record<string, React.ReactNode> = {
  plant: <Leaf size={18} />, food: <Utensils size={18} />, landmark: <Landmark size={18} />, receipt: <Receipt size={18} />,
  weather: <CloudLightning size={18} />, product: <ShoppingBag size={18} />, text: <FileText size={18} />, document: <FileText size={18} />,
  animal: <PawPrint size={18} />, place: <MapPin size={18} />,
}

export const SUGGEST: Record<string, string[]> = {
  receipt: ['How much was the tip?', 'How much does each person owe?', 'What was the most expensive item?'],
  food: ['What are the nutrition facts?', 'How much protein?', 'Is this healthy?'],
  plant: ['Is this safe for my dog?', 'How often should I water it?', 'Why are the leaves yellow?'],
  landmark: ['How tall is it?', 'Why is it that color?', 'When was it built?'],
  weather: ['Is it safe to be outside?', 'How far away is the storm?'],
  product: ['How much is it?', 'Where can I buy it?'],
  text: ['What does it say?', 'When is the meeting?'],
  document: ['When is it?', 'Where is it?', 'How much are tickets?'],
  animal: ['Who is this?', 'What breed is this?'],
  place: ['Where is this?', 'Tell me more'],
  object: ['What is this?', 'Tell me more'],
}

const SCENE_SUGGEST: Record<string, string[]> = {
  'cam-sign': ['What does it say in English?', 'Is anything vegetarian?', 'How much is the soup?'],
  'dog-park': ['Who is this?', 'What breed is this?'],
  'plant-succulent': ['How often should I water it?', 'Is this safe for my dog?'],
}
export const suggestFor = (scene: string, cat: string) => SCENE_SUGGEST[scene] ?? SUGGEST[cat] ?? SUGGEST.object

export function SceneStrip({ scene, onPick }: { scene: string; onPick: (s: string) => void }) {
  return (
    <div className="cam-strip" role="listbox" aria-label="Point camera at">
      {DEMO_SCENES.map((d) => (
        <button key={d.scene} role="option" aria-selected={scene === d.scene} className={`cam-strip-item ${scene === d.scene ? 'on' : ''}`} onClick={() => onPick(d.scene)}>
          <span className="cam-strip-img"><CamScene scene={d.scene} /></span>
          <span>{d.name}</span>
        </button>
      ))}
    </div>
  )
}

export function SiriReticle({ busy }: { busy: boolean }) {
  return (
    <div className={`cam-reticle ${busy ? 'busy' : ''}`} aria-hidden>
      <i /><i /><i /><i />
      <div className="cam-reticle-glow" />
    </div>
  )
}

interface QA { q: string; a: string }
interface SplitState { total: number; people: number }
interface CashState { amount: number; to: string; memo: string; recipients?: string[] }

const GROUP = ['sam', 'priya', 'leo']

export function SiriResult({ scene, qa, onAsk, onClose }: { scene: string; qa: QA[]; onAsk: (q: string) => void; onClose: () => void }) {
  const ins = camInsight(scene)
  const [notes, setNotes] = useState<string[]>([])
  const [split, setSplit] = useState<SplitState | null>(null)
  const [cash, setCash] = useState<CashState | null>(null)
  const [q, setQ] = useState('')
  const endRef = useRef<HTMLDivElement>(null)
  const [host, setHost] = useState<HTMLElement | null>(null)
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' })
  }, [qa.length, qa[qa.length - 1]?.a, notes.length, split])

  const act = (a: VisionAction) => {
    if (a.kind === 'split') return setSplit({ total: a.total, people: a.people })
    if (a.kind === 'pay') return setCash({ amount: a.amount, to: a.to, memo: ins.label.includes('receipt') ? "Rosa's Trattoria 🍕" : ins.label })
    const n = runVisionAction(a)
    if (n) setNotes((x) => [...x, n])
  }
  const ask = () => {
    const t = q.trim()
    if (!t) return
    onAsk(t)
    setQ('')
  }

  return (
    <div className="cam-result" role="dialog" aria-label={`Visual Intelligence: ${ins.label}`} ref={(el) => { const h = el?.closest('.cam-root') as HTMLElement | null; if (h && h !== host) setHost(h) }}>
      <div className="cam-result-head">
        <span className="cam-result-ic">{CAT_ICON[ins.category] ?? <Sparkles size={18} />}</span>
        <div className="grow">
          <div className="cam-result-kicker"><AISparkle size={11} /> SIRI · VISUAL INTELLIGENCE</div>
          <div className="t-headline">{ins.label}</div>
        </div>
        <button className="cam-x" aria-label="Close results" onClick={onClose}><X size={18} /></button>
      </div>
      <div className="cam-result-body scroll">
        <p className="cam-result-summary">{ins.summary}</p>
        {ins.details.length > 0 && (
          <div className="cam-details">
            {ins.details.map((d) => <div key={d.label} className="cam-kv"><span>{d.label}</span><span>{d.value}</span></div>)}
          </div>
        )}
        {ins.actions.length > 0 && (
          <div className="cam-actions">
            {ins.actions.map((a) => (
              <button key={a.label} className="cam-action" onClick={() => act(a.action)}>
                {a.action.kind === 'split' ? <Calculator size={15} /> : a.action.kind === 'pay' ? <span className="cam-cash-glyph">$</span> : null}
                {a.label}
              </button>
            ))}
          </div>
        )}
        {split && <SplitCalc s={split} setS={setSplit} onRequest={(each, people) => setCash({ amount: each, to: 'Drumline 🥁', memo: "Rosa's Trattoria 🍕", recipients: people })} />}
        {notes.map((n, i) => <div key={i} className="cam-note"><Check size={14} /> {n}</div>)}
        {qa.map((x, i) => (
          <div key={i} className="cam-qa">
            <div className="cam-q">{x.q}</div>
            <div className={`cam-a ${x.a ? '' : 'thinking'}`}>{x.a || <span className="cam-dots"><i /><i /><i /></span>}</div>
          </div>
        ))}
        <div ref={endRef} />
      </div>
      <div className="cam-suggest">
        {suggestFor(scene, ins.category).map((s) => <button key={s} className="cam-sugg" onClick={() => onAsk(s)}>{s}</button>)}
      </div>
      <div className="cam-ask">
        <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && ask()} placeholder="Ask about this…" aria-label="Ask Siri about what the camera sees" enterKeyHint="send" data-dictation={suggestFor(scene, ins.category).join('|')} />
        <button aria-label="Ask" disabled={!q.trim()} onClick={ask}><ArrowUp size={18} strokeWidth={2.6} /></button>
      </div>
      {host && createPortal(<CashSheet state={cash} onClose={() => setCash(null)} onDone={(n) => setNotes((x) => [...x, n])} />, host)}
    </div>
  )
}

function SplitCalc({ s, setS, onRequest }: { s: SplitState; setS: (s: SplitState | null) => void; onRequest: (each: number, people: string[]) => void }) {
  const each = Math.round((s.total / s.people) * 100) / 100
  const others = [...GROUP, 'alex', 'mia', 'nora', 'mom'].slice(0, s.people - 1)
  return (
    <div className="cam-split">
      <div className="cam-split-head">
        <span className="t-subhead bold"><Users size={15} /> Split {money(s.total)}</span>
        <button className="cam-x sm" aria-label="Close split" onClick={() => setS(null)}><X size={14} /></button>
      </div>
      <div className="cam-split-row">
        <span>People</span>
        <div className="cam-stepper">
          <button aria-label="Fewer people" disabled={s.people <= 2} onClick={() => setS({ ...s, people: s.people - 1 })}><Minus size={16} /></button>
          <span className="cam-step-val">{s.people}</span>
          <button aria-label="More people" disabled={s.people >= 8} onClick={() => setS({ ...s, people: s.people + 1 })}><Plus size={16} /></button>
        </div>
      </div>
      <div className="cam-split-each"><span className="cam-big">{money(each)}</span><span>each</span></div>
      <div className="cam-split-people">
        <span className="cam-sp"><Avatar id="me" size={26} /> You</span>
        {others.map((id) => <span key={id} className="cam-sp"><Avatar id={id} size={26} /> {contactName(id)}</span>)}
      </div>
      <Button block onClick={() => onRequest(each, others)}>Request {money(each)} from {others.length} with Apple Cash</Button>
    </div>
  )
}

const RECIPS = ['drumline', 'sam', 'priya', 'leo', 'alex', 'mom', 'dad', 'mia']

function CashSheet({ state, onClose, onDone }: { state: CashState | null; onClose: () => void; onDone: (note: string) => void }) {
  const [mode, setMode] = useState<'request' | 'send'>('request')
  const [amount, setAmount] = useState(0)
  const [sel, setSel] = useState<string[]>([])
  const [memo, setMemo] = useState('')
  const [stage, setStage] = useState<'form' | 'auth' | 'done'>('form')
  const last = useRef<CashState | null>(null)
  useEffect(() => {
    if (!state) return
    last.current = state
    setAmount(state.amount)
    setMemo(state.memo)
    setSel(state.recipients ? state.recipients : state.to.startsWith('Drumline') ? ['drumline'] : [])
    setMode('request')
    setStage('form')
  }, [state])
  const people = sel.flatMap((r) => (r === 'drumline' ? GROUP : [r])).filter((v, i, a) => a.indexOf(v) === i)
  const toggle = (r: string) => setSel((s) => (s.includes(r) ? s.filter((x) => x !== r) : [...s, r]))
  const confirm = () => {
    if (!people.length || amount <= 0) return
    setStage('auth')
    useOS.getState().flashIsland({ kind: 'faceid', duration: 1100 })
    window.setTimeout(() => {
      setStage('done')
      playAlert('sent', useOS.getState().volume)
    }, 1100)
    window.setTimeout(() => {
      const os = useOS.getState()
      const text = mode === 'request'
        ? `💵 Apple Cash request: ${money(amount)}${people.length > 1 ? ' each' : ''}${memo ? ` — ${memo}` : ''}`
        : `💵 Sent ${money(amount)} with Apple Cash${memo ? ` — ${memo}` : ''}`
      const convs: string[] = []
      if (sel.includes('drumline')) convs.push('c-drumline')
      sel.filter((r) => r !== 'drumline' && !(sel.includes('drumline') && GROUP.includes(r))).forEach((r) => convs.push(os.ensureConversation([r])))
      convs.forEach((cid) => {
        const mid = os.sendMessage(cid, { text })
        window.setTimeout(() => useOS.getState().patchMessage(cid, mid, { status: 'delivered' }), 800)
      })
      const who = sel.includes('drumline') && sel.length === 1 ? 'Drumline 🥁' : people.map((p) => contactName(p)).join(', ')
      const note = mode === 'request' ? `Requested ${money(amount)}${people.length > 1 ? ' each' : ''} from ${who} via Messages.` : `Sent ${money(amount)} to ${who}.`
      os.showToast(mode === 'request' ? `Requested ${money(amount)} · Apple Cash` : `Sent ${money(amount)} · Apple Cash`)
      onDone(note)
      onClose()
    }, 2000)
  }
  return (
    <Sheet open={!!state} onClose={onClose} title="Apple Cash" detent="auto" label="Apple Cash">
      <div className="cam-cash">
        {stage === 'form' ? (
          <>
            <Segmented options={['request', 'send'] as const} value={mode} onChange={setMode} labels={{ request: 'Request', send: 'Send' }} />
            <div className="cam-cash-amount">
              <button aria-label="Decrease amount" onClick={() => setAmount((a) => Math.max(1, Math.round((a - 1) * 100) / 100))}><Minus size={20} /></button>
              <div>
                <div className="cam-cash-num">{money(amount)}</div>
                <div className="t-footnote secondary">{people.length > 1 ? `each · ${money(amount * people.length)} total` : ' '}</div>
              </div>
              <button aria-label="Increase amount" onClick={() => setAmount((a) => Math.round((a + 1) * 100) / 100)}><Plus size={20} /></button>
            </div>
            <div className="cam-cash-label t-footnote secondary">{mode === 'request' ? 'REQUEST FROM' : 'SEND TO'}</div>
            <div className="cam-cash-recips">
              {RECIPS.map((r) => (
                <button key={r} className={`cam-recip ${sel.includes(r) ? 'on' : ''}`} onClick={() => toggle(r)} aria-pressed={sel.includes(r)}>
                  {r === 'drumline' ? <span className="cam-group-av">🥁</span> : <Avatar id={r} size={40} />}
                  <span className="t-caption1">{r === 'drumline' ? 'Drumline' : contactName(r)}</span>
                  {sel.includes(r) && <span className="cam-recip-tick"><Check size={11} strokeWidth={3.4} /></span>}
                </button>
              ))}
            </div>
            <input className="text-input" value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="Add a note" aria-label="Payment note" />
            <button className="cam-pay-btn" disabled={!people.length} onClick={confirm}>
              <ScanFace size={20} /> {mode === 'request' ? 'Request' : 'Pay'} with Face ID
            </button>
          </>
        ) : (
          <div className="cam-cash-auth">
            <div className={`cam-faceid ${stage}`}>{stage === 'done' ? <Check size={52} strokeWidth={2.6} /> : <ScanFace size={64} strokeWidth={1.4} />}</div>
            <div className="t-headline">{stage === 'done' ? 'Done' : 'Face ID'}</div>
            <div className="t-subhead secondary">{mode === 'request' ? 'Request' : 'Pay'} {money(amount)}{people.length > 1 ? ' each' : ''} · Apple Cash</div>
          </div>
        )}
      </div>
    </Sheet>
  )
}

/** Answer helper with a short "thinking" delay. */
export function answer(scene: string, q: string, cb: (a: string) => void) {
  window.setTimeout(() => cb(camAnswer(scene, q)), 650 + Math.min(600, q.length * 10))
}

export function CamScene({ scene, style, className, extended, filter }: { scene: string; style?: React.CSSProperties; className?: string; extended?: boolean; filter?: string }) {
  if (EXTRA_SCENES[scene]) return <ExtraScene scene={scene} style={{ width: '100%', height: '100%', ...style }} className={className} extended={extended} filter={filter} />
  return <Scene scene={scene} extended={extended} filter={filter} className={className} style={{ width: '100%', height: '100%', ...style }} />
}
