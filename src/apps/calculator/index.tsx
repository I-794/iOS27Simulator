import { useEffect, useMemo, useRef, useState } from 'react'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { Calculator as CalcIcon, Delete, ListOrdered, Check, FunctionSquare, NotebookPen, Trash2, X } from 'lucide-react'
import { Sheet, openMenu } from '../../ui/overlay'
import { useOS } from '../../os/store'
import { useAppRoute, useOnscreen } from '../../os/hooks'
import { evaluate, fact, fmtNum, type Vars } from './engine'
import './calculator.css'

interface CState {
  mode: 'basic' | 'scientific' | 'notes'
  history: { expr: string; result: string; ts: number }[]
  notes: string
  set: (p: Partial<CState>) => void
}
const useC = create<CState>()(persist((set) => ({
  mode: 'basic',
  history: [],
  notes: 'Rosa’s dinner\nbill = 86.40\ntip = bill × 20%\n86.40 / 4 =\n(bill + tip) / 4 =\n',
  set: (p) => set(p),
}), { name: 'ios27-calculator', partialize: (s) => ({ mode: s.mode, history: s.history, notes: s.notes }) }))

const OPS = ['+', '−', '×', '÷', '^']
const isOp = (c: string) => OPS.includes(c)

export default function CalculatorApp() {
  const mode = useC((s) => s.mode)
  const landscape = useOS((s) => s.orientation === 'landscape')
  useAppRoute('calculator', (r) => { if (r === 'notes') useC.getState().set({ mode: 'notes' }); if (r === 'basic') useC.getState().set({ mode: 'basic' }) })
  if (mode === 'notes') return <MathNotes />
  return <Keypad scientific={landscape || mode === 'scientific'} landscape={landscape} />
}

// ---------------------------------------------------------------- keypad calculator
function Keypad({ scientific, landscape }: { scientific: boolean; landscape: boolean }) {
  const [expr, setExpr] = useState('') // what the user has typed (iOS 18 shows the whole expression)
  const [result, setResult] = useState<string | null>(null) // shown after "="
  const [prevExpr, setPrevExpr] = useState('')
  const [typing, setTyping] = useState(false)
  const [second, setSecond] = useState(false)
  const [rad, setRad] = useState(false)
  const [mem, setMem] = useState(0)
  const [hist, setHist] = useState(false)
  const [lastOp, setLastOp] = useState<string | null>(null)
  useOnscreen('calculator', 'Calculator', { type: 'page', title: 'Calculator', text: result ?? expr, url: 'calculator' })

  const live = useMemo(() => {
    if (!expr) return '0'
    try {
      const trimmed = expr.replace(/[+−×÷^]$/, '')
      const open = (trimmed.match(/\(/g)?.length ?? 0) - (trimmed.match(/\)/g)?.length ?? 0)
      return fmtNum(evaluate(trimmed + ')'.repeat(Math.max(0, open)), {}, !rad))
    } catch { return '' }
  }, [expr, rad])

  const lastNumber = (e: string) => /(-?\d*\.?\d+(e[+-]?\d+)?|-?\d+\.)$/i.exec(e)
  const display = result ?? (typing || expr ? live : '0')

  const input = (k: string) => {
    let e = result !== null && /[\d.(πe]/.test(k) ? '' : result !== null ? result.replace(/,/g, '') : expr
    if (result !== null) { setPrevExpr(''); setResult(null) }
    if (/\d/.test(k)) {
      if (/\)$/.test(e) || /[πe]$/.test(e)) e += '×'
      const m = lastNumber(e)
      if (m && m[0] === '0') e = e.slice(0, -1)
      e += k
      setTyping(true)
    } else if (k === '.') {
      const m = lastNumber(e)
      if (m && m[0].includes('.')) return
      e += m ? '.' : '0.'
      setTyping(true)
    } else if (isOp(k)) {
      if (!e) e = '0'
      if (isOp(e.slice(-1))) e = e.slice(0, -1)
      if (e.endsWith('(')) return
      e += k
      setLastOp(k)
      setTyping(false)
    } else if (k === '(' || k === ')') {
      if (k === '(' && /[\d)πe]$/.test(e)) e += '×'
      if (k === ')') {
        const open = (e.match(/\(/g)?.length ?? 0) - (e.match(/\)/g)?.length ?? 0)
        if (open <= 0 || /[(+−×÷^]$/.test(e)) return
      }
      e += k
    } else if (k === 'π' || k === 'e') {
      if (/[\d)πe]$/.test(e)) e += '×'
      e += k
    }
    setExpr(e)
  }

  const equals = () => {
    let e = result !== null && lastOp ? result.replace(/,/g, '') + (prevExpr.match(/[+−×÷^][^+−×÷^]*$/)?.[0] ?? '') : expr
    if (!e) return
    e = e.replace(/[+−×÷^]$/, '')
    const open = (e.match(/\(/g)?.length ?? 0) - (e.match(/\)/g)?.length ?? 0)
    e += ')'.repeat(Math.max(0, open))
    try {
      const v = evaluate(e, {}, !rad)
      const r = fmtNum(v)
      setPrevExpr(e)
      setResult(r)
      setExpr('')
      setTyping(false)
      useC.getState().set({ history: [{ expr: e, result: r, ts: Date.now() }, ...useC.getState().history].slice(0, 50) })
    } catch {
      setPrevExpr(e)
      setResult('Error')
      setExpr('')
    }
  }

  const endsWithEntry = /(\d|\.|[πe)%])$/.test(expr)
  const clearKey = typing && expr ? '⌫' : result !== null || endsWithEntry ? 'C' : 'AC'
  const allClear = () => { setExpr(''); setResult(null); setPrevExpr(''); setTyping(false); setLastOp(null) }
  const clear = () => {
    if (clearKey === '⌫') {
      const e = expr.slice(0, -1)
      setExpr(e)
      if (!e || isOp(e.slice(-1))) setTyping(false)
    } else if (clearKey === 'C') {
      // C clears the current entry but keeps a pending operation (e.g. "12 + 5" → "12 +")
      if (result !== null || !/[+−×÷^]/.test(expr)) return allClear()
      setExpr(expr.replace(/(-?\d*\.?\d+%?|[πe])$/, ''))
      setTyping(false)
    } else allClear()
  }

  /** Apply a unary function to the last number / result (iOS applies immediately). */
  const unary = (f: (x: number) => number) => {
    const base = result !== null ? result.replace(/,/g, '') : expr || '0'
    const m = lastNumber(base) ?? (/[πe]$/.exec(base) ? [base.slice(-1)] : null)
    const head = m ? base.slice(0, base.length - m[0].length) : base
    const x = m ? (m[0] === 'π' ? Math.PI : m[0] === 'e' ? Math.E : parseFloat(m[0])) : 0
    const v = f(x)
    const out = Number.isFinite(v) ? String(+v.toPrecision(12)) : 'NaN'
    setResult(null)
    setPrevExpr('')
    setExpr(head + out)
    setTyping(true)
  }
  const toggleSign = () => unary((x) => -x)
  const percent = () => {
    if (result !== null) return unary((x) => x / 100)
    setExpr((e) => (lastNumber(e) ? e + '%' : e))
  }
  const trig = (fn: 'sin' | 'cos' | 'tan') => (x: number) => {
    const toR = (v: number) => (rad ? v : (v * Math.PI) / 180)
    const fromR = (v: number) => (rad ? v : (v * 180) / Math.PI)
    if (second) return fromR(fn === 'sin' ? Math.asin(x) : fn === 'cos' ? Math.acos(x) : Math.atan(x))
    return fn === 'sin' ? Math.sin(toR(x)) : fn === 'cos' ? Math.cos(toR(x)) : Math.tan(toR(x))
  }

  // hardware keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!document.querySelector('.app-window.active .ca-root')) return
      if ((e.target as HTMLElement)?.tagName === 'INPUT' || (e.target as HTMLElement)?.tagName === 'TEXTAREA') return
      const map: Record<string, string> = { '*': '×', '/': '÷', '-': '−', '+': '+', '^': '^', x: '×' }
      if (/^\d$/.test(e.key) || e.key === '.' || e.key === '(' || e.key === ')') input(e.key)
      else if (map[e.key]) input(map[e.key])
      else if (e.key === 'Enter' || e.key === '=') equals()
      else if (e.key === 'Backspace') clear()
      else if (e.key === '%') percent()
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const sci: { l: string; a: () => void; on?: boolean }[] = [
    { l: '(', a: () => input('(') }, { l: ')', a: () => input(')') }, { l: 'mc', a: () => setMem(0) }, { l: 'm+', a: () => setMem(mem + parseFloat(display.replace(/,/g, '')) || mem) }, { l: 'm−', a: () => setMem(mem - (parseFloat(display.replace(/,/g, '')) || 0)) }, { l: 'mr', a: () => { setExpr((e) => (result !== null ? '' : e) + String(mem)); setResult(null); setTyping(true) } },
    { l: '2ⁿᵈ', a: () => setSecond(!second), on: second }, { l: 'x²', a: () => unary((x) => x * x) }, { l: 'x³', a: () => unary((x) => x ** 3) }, { l: 'xʸ', a: () => input('^') }, { l: second ? 'yˣ' : 'eˣ', a: () => (second ? input('^') : unary(Math.exp)) }, { l: second ? '2ˣ' : '10ˣ', a: () => unary((x) => (second ? 2 ** x : 10 ** x)) },
    { l: '1/x', a: () => unary((x) => 1 / x) }, { l: '√x', a: () => unary(Math.sqrt) }, { l: '∛x', a: () => unary(Math.cbrt) }, { l: 'ʸ√x', a: () => input('^') }, { l: second ? 'logᵧ' : 'ln', a: () => unary(Math.log) }, { l: second ? 'log₂' : 'log₁₀', a: () => unary((x) => (second ? Math.log2(x) : Math.log10(x))) },
    { l: 'x!', a: () => unary(fact) }, { l: second ? 'sin⁻¹' : 'sin', a: () => unary(trig('sin')) }, { l: second ? 'cos⁻¹' : 'cos', a: () => unary(trig('cos')) }, { l: second ? 'tan⁻¹' : 'tan', a: () => unary(trig('tan')) }, { l: 'e', a: () => input('e') }, { l: 'EE', a: () => { input('×'); setExpr((e) => e + '10^') } },
    { l: rad ? 'Deg' : 'Rad', a: () => setRad(!rad) }, { l: 'sinh', a: () => unary(Math.sinh) }, { l: 'cosh', a: () => unary(Math.cosh) }, { l: 'tanh', a: () => unary(Math.tanh) }, { l: 'π', a: () => input('π') }, { l: 'Rand', a: () => { setResult(null); setExpr((e) => (isOp(e.slice(-1)) || !e ? e : e + '×') + Math.random().toFixed(6)) } },
  ]

  const pendingOp = !typing && isOp(expr.slice(-1)) ? expr.slice(-1) : null
  const K = ({ l, cls, a, label }: { l: React.ReactNode; cls: string; a: () => void; label: string }) => (
    <button className={`ca-key ${cls}`} onClick={a} aria-label={label}>{l}</button>
  )
  const exprShown = result !== null ? prevExpr : expr
  return (
    <div className={`app-root ca-root ${scientific ? 'sci' : ''} ${landscape ? 'land' : ''}`}>
      <div className="ca-top">
        <button className="ca-hist-btn" aria-label="History" onClick={() => setHist(true)}><ListOrdered size={22} /></button>
        {rad && scientific && <span className="ca-rad">Rad</span>}
      </div>
      <div className="ca-display" onPointerDown={(e) => {
        const x0 = e.clientX
        const up = (ev: PointerEvent) => { window.removeEventListener('pointerup', up); if (Math.abs(ev.clientX - x0) > 30 && expr) setExpr(expr.slice(0, -1)) }
        window.addEventListener('pointerup', up)
      }}>
        <div className="ca-expr">{exprShown.replace(/\*/g, '×') || ' '}</div>
        <div className={`ca-value ${display.length > 9 ? 'shrink' : ''} ${display.length > 13 ? 'shrink2' : ''}`} aria-live="polite" aria-label={`Result ${display}`}>{display}</div>
      </div>
      <div className="ca-pad">
        {scientific && (
          <div className="ca-sci">
            {sci.map((k) => <button key={k.l} className={`ca-key sci ${k.on ? 'on' : ''} ${k.l === 'mr' && mem ? 'mem' : ''}`} onClick={k.a} aria-label={k.l}>{k.l}</button>)}
          </div>
        )}
        <div className="ca-basic">
          <K l={clearKey === '⌫' ? <Delete size={30} /> : clearKey} cls="fn" a={clear} label={clearKey === '⌫' ? 'Delete' : clearKey === 'C' ? 'Clear' : 'All Clear'} />
          <K l="+/−" cls="fn" a={toggleSign} label="Toggle sign" />
          <K l="%" cls="fn" a={percent} label="Percent" />
          <K l="÷" cls={`op ${pendingOp === '÷' ? 'active' : ''}`} a={() => input('÷')} label="Divide" />
          {['7', '8', '9'].map((d) => <K key={d} l={d} cls="num" a={() => input(d)} label={d} />)}
          <K l="×" cls={`op ${pendingOp === '×' ? 'active' : ''}`} a={() => input('×')} label="Multiply" />
          {['4', '5', '6'].map((d) => <K key={d} l={d} cls="num" a={() => input(d)} label={d} />)}
          <K l="−" cls={`op ${pendingOp === '−' ? 'active' : ''}`} a={() => input('−')} label="Subtract" />
          {['1', '2', '3'].map((d) => <K key={d} l={d} cls="num" a={() => input(d)} label={d} />)}
          <K l="+" cls={`op ${pendingOp === '+' ? 'active' : ''}`} a={() => input('+')} label="Add" />
          <button className="ca-key num" aria-label="Calculator mode" onClick={(e) => openMenu(e.currentTarget, [
            { label: 'Basic', icon: useC.getState().mode === 'basic' ? <Check size={18} /> : <CalcIcon size={18} />, onSelect: () => useC.getState().set({ mode: 'basic' }) },
            { label: 'Scientific', icon: useC.getState().mode === 'scientific' ? <Check size={18} /> : <FunctionSquare size={18} />, onSelect: () => useC.getState().set({ mode: 'scientific' }) },
            { label: 'Math Notes', icon: <NotebookPen size={18} />, onSelect: () => useC.getState().set({ mode: 'notes' }) },
          ])}><CalcIcon size={28} /></button>
          <K l="0" cls="num" a={() => input('0')} label="0" />
          <K l="." cls="num" a={() => input('.')} label="Decimal" />
          <K l="=" cls="op" a={equals} label="Equals" />
        </div>
      </div>
      <Sheet open={hist} onClose={() => setHist(false)} title="History" detent="large" className="ca-hist" trailing={<button className="bar-btn icon glass interactive" aria-label="Clear history" onClick={() => useC.getState().set({ history: [] })}><Trash2 size={18} /></button>}>
        <HistoryList onPick={(r) => { setResult(null); setPrevExpr(''); setExpr(r.replace(/,/g, '')); setTyping(true); setHist(false) }} />
      </Sheet>
    </div>
  )
}

function HistoryList({ onPick }: { onPick: (r: string) => void }) {
  const history = useC((s) => s.history)
  if (!history.length) return <div className="empty-state">No history yet</div>
  return (
    <div className="ca-hlist">
      {history.map((h) => (
        <button key={h.ts} onClick={() => onPick(h.result)}>
          <span>{h.expr}</span>
          <b>{h.result}</b>
        </button>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------- Math Notes-lite
function solveLines(text: string): (string | null)[] {
  const vars: Vars = {}
  return text.split('\n').map((line) => {
    const raw = line.trim()
    if (!raw) return null
    const assign = /^([a-zA-Z_][\w ]*?)\s*=\s*(.+?)\s*$/.exec(raw)
    if (raw.endsWith('=')) {
      try {
        return fmtNum(evaluate(raw.slice(0, -1).replace(/(\d)\s*%/g, '$1%'), vars))
      } catch { return '?' }
    }
    if (assign && !/^\d/.test(assign[1])) {
      try {
        const v = evaluate(assign[2], vars)
        vars[assign[1].trim().replace(/\s+/g, '_')] = v
        return `${fmtNum(v)}`
      } catch { return null }
    }
    return null
  })
}

function MathNotes() {
  const notes = useC((s) => s.notes)
  const [text, setText] = useState(notes)
  const results = useMemo(() => solveLines(text), [text])
  const ta = useRef<HTMLTextAreaElement>(null)
  useEffect(() => { const t = window.setTimeout(() => useC.getState().set({ notes: text }), 300); return () => window.clearTimeout(t) }, [text])
  useOnscreen('calculator', 'Math Notes', { type: 'note', title: 'Math Notes', text })
  const lines = text.split('\n')
  return (
    <div className="app-root ca-notes">
      <div className="ca-notes-bar">
        <button className="bar-btn icon glass interactive" aria-label="Back to Calculator" onClick={() => useC.getState().set({ mode: 'basic' })}><X size={20} /></button>
        <span className="ca-notes-title">Math Notes</span>
        <button className="bar-btn glass interactive" onClick={() => { setText(''); ta.current?.focus() }}>New</button>
      </div>
      <div className="ca-notes-hint">Type an expression and end it with “=”. Define variables like <code>tip = 20%</code>.</div>
      <div className="ca-notes-body scroll">
        <div className="ca-notes-lines" aria-hidden>
          {lines.map((l, i) => (
            <div key={i} className="ca-nl">
              <span className="ca-nl-text">{l || ' '}</span>
              {results[i] !== null && l.trim().endsWith('=') && <span className={`ca-nl-res ${results[i] === '?' ? 'bad' : ''}`}>{results[i]}</span>}
              {results[i] !== null && !l.trim().endsWith('=') && <span className="ca-nl-var">{results[i]}</span>}
            </div>
          ))}
        </div>
        <textarea ref={ta} className="ca-notes-ta" value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} aria-label="Math Notes" data-dictation="86.40 / 4 =|tip = 20%" />
      </div>
    </div>
  )
}
