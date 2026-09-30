import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { Check, ListChecks, Table, Paperclip, PenLine, X, Minus, Link2, Undo2, Eraser, Plus, Camera, ChevronDown } from 'lucide-react'
import { useOS } from '../../os/store'
import { Sheet, openMenu } from '../../ui/overlay'
import { Scene } from '../../art/Scene'
import type { NoteBlock } from '../../os/types'
import { PHOTO_RE, slug } from './markdown'

export type TextBlock = Extract<NoteBlock, { text: string }>
export const isText = (b: NoteBlock): b is TextBlock => 'text' in b && b.t !== 'link'

// ------------------------------------------------------------------ autosizing textarea
function AutoText({ value, onChange, className, idx, onKeyDown, onFocus, placeholder, multiline, label }: {
  value: string; onChange: (v: string) => void; className: string; idx: number; onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void; onFocus: () => void; placeholder?: string; multiline?: boolean; label: string
}) {
  const ref = useRef<HTMLTextAreaElement>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = '0px'
    el.style.height = `${el.scrollHeight}px`
  }, [value])
  return (
    <textarea
      ref={ref}
      className={`nt-ta ${className}`}
      value={value}
      rows={1}
      data-idx={idx}
      data-send-on-enter={multiline ? undefined : '1'}
      enterKeyHint="enter"
      placeholder={placeholder}
      aria-label={label}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={onKeyDown}
      onFocus={onFocus}
      spellCheck
    />
  )
}

// ------------------------------------------------------------------ drawing
export function DrawingSvg({ paths, className = '' }: { paths: string[]; className?: string }) {
  const legacy = paths.length > 0 && paths.every((p) => !p.includes('|'))
  return (
    <svg viewBox={legacy ? '0 0 160 90' : '0 0 320 180'} className={`nt-drawing ${className}`} role="img" aria-label="Drawing">
      {paths.map((p, i) => {
        const [c, d] = p.includes('|') ? p.split('|') : ['currentColor', p]
        const hl = c.endsWith('80')
        return <path key={i} d={d} stroke={c} strokeWidth={hl ? 12 : legacy ? 2.5 : 3} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      })}
    </svg>
  )
}

const PENS = [
  { c: '#1c1c1e', label: 'Black pen' },
  { c: '#0a84ff', label: 'Blue pen' },
  { c: '#ff3b30', label: 'Red pen' },
  { c: '#34c759', label: 'Green pen' },
  { c: '#ffd60a80', label: 'Highlighter' },
]

export function DrawingSheet({ open, initial, onClose, onSave }: { open: boolean; initial: string[]; onClose: () => void; onSave: (paths: string[]) => void }) {
  const [paths, setPaths] = useState<string[]>([])
  const [pen, setPen] = useState(PENS[0].c)
  const svgRef = useRef<SVGSVGElement>(null)
  const cur = useRef<string | null>(null)
  useEffect(() => { if (open) setPaths(initial.filter((p) => p.includes('|'))) }, [open]) // eslint-disable-line react-hooks/exhaustive-deps
  const pt = (e: React.PointerEvent) => {
    const svg = svgRef.current!
    const m = svg.getScreenCTM()!.inverse()
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m)
    return `${p.x.toFixed(1)} ${p.y.toFixed(1)}`
  }
  const dark = useOS((s) => s.theme === 'dark')
  const color = (c: string) => (c === '#1c1c1e' && dark ? '#f2f2f7' : c)
  return (
    <Sheet open={open} onClose={onClose} title="Drawing" detent="large" closeButton={false}
      leading={<button className="bar-btn glass interactive" onClick={onClose}>Cancel</button>}
      trailing={<button className="bar-btn prominent nt-done" onClick={() => onSave(paths)}>Done</button>}>
      <div className="nt-canvas-wrap">
        <svg
          ref={svgRef}
          className="nt-canvas"
          viewBox="0 0 320 180"
          onPointerDown={(e) => {
            ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
            const d = `M${pt(e)}`
            cur.current = d
            setPaths((p) => [...p, `${color(pen)}|${d}`])
          }}
          onPointerMove={(e) => {
            if (!cur.current) return
            cur.current += ` L${pt(e)}`
            const d = cur.current
            setPaths((p) => [...p.slice(0, -1), `${color(pen)}|${d}`])
          }}
          onPointerUp={() => (cur.current = null)}
          role="img"
          aria-label="Drawing canvas"
        >
          {paths.map((p, i) => {
            const [c, d] = p.split('|')
            return <path key={i} d={d} stroke={c} strokeWidth={c.endsWith('80') ? 12 : 3} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          })}
        </svg>
        {!paths.length && <div className="nt-canvas-hint">Draw with your finger</div>}
      </div>
      <div className="nt-pens">
        <button onClick={() => setPaths((p) => p.slice(0, -1))} aria-label="Undo" disabled={!paths.length}><Undo2 size={20} /></button>
        {PENS.map((p) => (
          <button key={p.c} className={`nt-pen ${pen === p.c ? 'on' : ''}`} onClick={() => setPen(p.c)} aria-label={p.label}>
            <span style={{ background: color(p.c) }} />
          </button>
        ))}
        <button onClick={() => setPaths([])} aria-label="Clear drawing" disabled={!paths.length}><Eraser size={20} /></button>
      </div>
    </Sheet>
  )
}

// ------------------------------------------------------------------ block editor
export function BlockEditor({ blocks, onChange, focusReq, onFocusIdx, jump }: {
  blocks: NoteBlock[]
  onChange: (b: NoteBlock[]) => void
  focusReq: { idx: number; caret: number | 'end'; n: number } | null
  onFocusIdx: (i: number | null) => void
  jump: (id: string) => void
}) {
  const root = useRef<HTMLDivElement>(null)
  const [drawIdx, setDrawIdx] = useState<number | null>(null)
  const [pending, setPending] = useState<{ idx: number; caret: number | 'end' } | null>(null)

  useEffect(() => { if (focusReq) setPending({ idx: focusReq.idx, caret: focusReq.caret }) }, [focusReq])
  useLayoutEffect(() => {
    if (!pending) return
    const el = root.current?.querySelector(`textarea[data-idx="${pending.idx}"]`) as HTMLTextAreaElement | null
    if (el) {
      el.focus()
      const c = pending.caret === 'end' ? el.value.length : pending.caret
      el.setSelectionRange(c, c)
    }
    setPending(null)
  }, [pending, blocks])

  const set = (i: number, b: NoteBlock) => onChange(blocks.map((x, j) => (j === i ? b : x)))
  const insertAt = (i: number, b: NoteBlock[], focus?: number) => {
    onChange([...blocks.slice(0, i), ...b, ...blocks.slice(i)])
    if (focus !== undefined) setPending({ idx: focus, caret: 0 })
  }

  const onKey = (i: number) => (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const b = blocks[i]
    if (!isText(b)) return
    const el = e.currentTarget
    if (e.key === 'Enter' && !e.shiftKey && b.t !== 'code') {
      e.preventDefault()
      const pos = el.selectionStart ?? b.text.length
      const before = b.text.slice(0, pos)
      const after = b.text.slice(pos)
      if ((b.t === 'check' || b.t === 'bullet') && !b.text.trim()) {
        set(i, { t: 'p', text: '' })
        return
      }
      const nextType: NoteBlock = b.t === 'check' ? { t: 'check', text: after, done: false } : b.t === 'bullet' ? { t: 'bullet', text: after } : { t: 'p', text: after }
      const cur = { ...b, text: before } as NoteBlock
      onChange([...blocks.slice(0, i), cur, nextType, ...blocks.slice(i + 1)])
      setPending({ idx: i + 1, caret: 0 })
    } else if (e.key === 'Backspace' && el.selectionStart === 0 && el.selectionEnd === 0) {
      if (b.t !== 'p' && b.t !== 'h1') {
        e.preventDefault()
        set(i, { t: 'p', text: b.text })
        return
      }
      if (i === 0) return
      e.preventDefault()
      const prev = blocks[i - 1]
      if (isText(prev)) {
        const caret = prev.text.length
        onChange([...blocks.slice(0, i - 1), { ...prev, text: prev.text + b.text } as NoteBlock, ...blocks.slice(i + 1)])
        setPending({ idx: i - 1, caret })
      } else {
        onChange([...blocks.slice(0, i - 1), ...blocks.slice(i)])
        setPending({ idx: i - 1, caret: 0 })
      }
    }
  }

  const blockMenu = (i: number, el: HTMLElement, extra: { label: string; icon?: ReactNode; onSelect: () => void }[] = []) =>
    openMenu(el, [...extra, { label: 'Delete', icon: <X size={18} />, destructive: true, separatorBefore: extra.length > 0, onSelect: () => onChange(blocks.filter((_, j) => j !== i)) }])

  return (
    <div className="nt-blocks" ref={root}>
      {blocks.map((b, i) => {
        const focus = () => onFocusIdx(i)
        switch (b.t) {
          case 'h1':
          case 'h2':
          case 'h3':
          case 'p':
          case 'quote':
          case 'code': {
            const photo = b.t === 'p' ? b.text.match(PHOTO_RE) : null
            if (photo) {
              return (
                <figure key={i} className="nt-photo" onContextMenu={(e) => { e.preventDefault(); blockMenu(i, e.currentTarget) }}>
                  <Scene scene={photo[2]} />
                  <button className="nt-photo-x" onClick={() => onChange(blocks.filter((_, j) => j !== i))} aria-label="Remove photo"><X size={14} /></button>
                </figure>
              )
            }
            return (
              <div key={i} className={`nt-b nt-${b.t}`} id={'id' in b && b.id ? `nt-sec-${b.id}` : undefined}>
                <AutoText
                  idx={i}
                  className={`nt-ta-${b.t}`}
                  value={b.text}
                  onChange={(v) => set(i, { ...b, text: v })}
                  onKeyDown={onKey(i)}
                  onFocus={focus}
                  multiline={b.t === 'code'}
                  placeholder={i === 0 && b.t === 'h1' ? 'Title' : blocks.length === 1 ? 'Start writing' : undefined}
                  label={b.t === 'h1' ? 'Title' : b.t === 'h2' ? 'Heading' : b.t === 'h3' ? 'Subheading' : b.t === 'code' ? 'Monostyled text' : b.t === 'quote' ? 'Block quote' : 'Body text'}
                />
              </div>
            )
          }
          case 'check':
            return (
              <div key={i} className={`nt-b nt-check ${b.done ? 'done' : ''}`}>
                <button className="nt-circle" onClick={() => set(i, { ...b, done: !b.done })} aria-label={b.done ? `Mark “${b.text}” incomplete` : `Mark “${b.text}” complete`} aria-pressed={b.done}>
                  {b.done && <Check size={14} strokeWidth={3.4} />}
                </button>
                <AutoText idx={i} className="nt-ta-check" value={b.text} onChange={(v) => set(i, { ...b, text: v })} onKeyDown={onKey(i)} onFocus={focus} label="Checklist item" />
              </div>
            )
          case 'bullet':
            return (
              <div key={i} className="nt-b nt-bullet">
                <span className="nt-dot">•</span>
                <AutoText idx={i} className="nt-ta-bullet" value={b.text} onChange={(v) => set(i, { ...b, text: v })} onKeyDown={onKey(i)} onFocus={focus} label="List item" />
              </div>
            )
          case 'divider':
            return <button key={i} className="nt-divider" aria-label="Divider line" onClick={(e) => blockMenu(i, e.currentTarget)}><hr /></button>
          case 'drawing':
            return (
              <button key={i} className="nt-drawing-wrap" onClick={() => setDrawIdx(i)} onContextMenu={(e) => { e.preventDefault(); blockMenu(i, e.currentTarget) }} aria-label="Edit drawing">
                <DrawingSvg paths={b.paths} />
              </button>
            )
          case 'link':
            return (
              <div key={i} className="nt-b nt-link">
                <button onClick={() => jump(b.target)} onContextMenu={(e) => { e.preventDefault(); blockMenu(i, e.currentTarget) }}>
                  <Link2 size={15} /> {b.text.replace(/^→\s*/, '')}
                </button>
              </div>
            )
          case 'table':
            return <TableBlock key={i} rows={b.rows} onChange={(rows) => set(i, { t: 'table', rows })} onDelete={() => onChange(blocks.filter((_, j) => j !== i))} onFocus={() => onFocusIdx(null)} />
        }
        return null
      })}
      <button className="nt-tail" aria-label="Add text at end" onClick={() => {
        const last = blocks[blocks.length - 1]
        if (last && isText(last) && !last.text) setPending({ idx: blocks.length - 1, caret: 0 })
        else insertAt(blocks.length, [{ t: 'p', text: '' }], blocks.length)
      }} />
      <DrawingSheet
        open={drawIdx !== null}
        initial={drawIdx !== null && blocks[drawIdx]?.t === 'drawing' ? (blocks[drawIdx] as { paths: string[] }).paths : []}
        onClose={() => setDrawIdx(null)}
        onSave={(paths) => {
          if (drawIdx !== null) set(drawIdx, { t: 'drawing', paths })
          setDrawIdx(null)
        }}
      />
    </div>
  )
}

function TableBlock({ rows, onChange, onDelete, onFocus }: { rows: string[][]; onChange: (r: string[][]) => void; onDelete: () => void; onFocus: () => void }) {
  const [active, setActive] = useState(false)
  const cols = Math.max(1, ...rows.map((r) => r.length))
  return (
    <div className={`nt-table-wrap ${active ? 'active' : ''}`} onFocus={() => { setActive(true); onFocus() }} onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setActive(false) }}>
      <div className="nt-table-scroll">
        <table className="nt-table">
          <tbody>
            {rows.map((r, ri) => (
              <tr key={ri}>
                {Array.from({ length: cols }).map((_, ci) => (
                  <td key={ci} className={ri === 0 ? 'head' : ''}>
                    <input value={r[ci] ?? ''} aria-label={`Row ${ri + 1} column ${ci + 1}`} onChange={(e) => onChange(rows.map((row, x) => (x === ri ? Array.from({ length: cols }, (_, y) => (y === ci ? e.target.value : row[y] ?? '')) : row)))} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {active && (
        <div className="nt-table-tools" onPointerDown={(e) => e.preventDefault()}>
          <button onClick={() => onChange([...rows, Array(cols).fill('')])}><Plus size={14} /> Row</button>
          <button onClick={() => onChange(rows.map((r) => [...r, '']))}><Plus size={14} /> Column</button>
          {rows.length > 1 && <button onClick={() => onChange(rows.slice(0, -1))}><Minus size={14} /> Row</button>}
          <button className="red" onClick={onDelete}><X size={14} /> Delete Table</button>
        </div>
      )}
    </div>
  )
}

// ------------------------------------------------------------------ formatting toolbar
export const STYLES: { t: TextBlock['t'] | 'check' | 'bullet'; label: string }[] = [
  { t: 'h1', label: 'Title' },
  { t: 'h2', label: 'Heading' },
  { t: 'h3', label: 'Subheading' },
  { t: 'p', label: 'Body' },
  { t: 'code', label: 'Monostyled' },
]

export function FormatToolbar({ focused, blocks, onChange, focusIdx, onNewNote, onRequestFocus, onLink, onDone }: {
  focused: boolean
  blocks: NoteBlock[]
  onChange: (b: NoteBlock[]) => void
  focusIdx: number | null
  onNewNote: () => void
  onRequestFocus: (idx: number) => void
  onLink: () => void
  onDone: () => void
}) {
  const [aa, setAa] = useState(false)
  const [draw, setDraw] = useState(false)
  const cur = focusIdx !== null ? blocks[focusIdx] : undefined
  const insertIdx = focusIdx !== null ? focusIdx + 1 : blocks.length
  const insert = (b: NoteBlock[], focusOffset?: number) => {
    onChange([...blocks.slice(0, insertIdx), ...b, ...blocks.slice(insertIdx)])
    if (focusOffset !== undefined) window.setTimeout(() => onRequestFocus(insertIdx + focusOffset), 0)
  }
  const convert = (t: string) => {
    if (focusIdx === null || !cur) return
    const text = isText(cur) ? cur.text : ''
    const nb: NoteBlock = t === 'check' ? { t: 'check', text, done: false } : t === 'bullet' ? { t: 'bullet', text } : t === 'quote' ? { t: 'quote', text } : { t: t as 'p', text, ...(t === 'h2' || t === 'h3' ? { id: slug(text) } : {}) }
    onChange(blocks.map((b, i) => (i === focusIdx ? nb : b)))
    window.setTimeout(() => onRequestFocus(focusIdx), 0)
  }
  const checklist = () => {
    if (focused && cur && isText(cur)) {
      if (cur.t === 'check') convert('p')
      else convert('check')
    } else insert([{ t: 'check', text: '', done: false }], 0)
  }
  const attach = (el: HTMLElement) => {
    const add = (scene: string, alt: string) => insert([{ t: 'p', text: `![${alt}](scene:${scene})` }, { t: 'p', text: '' }], 1)
    openMenu(el, [
      { label: 'Choose Photo: Robot Workshop', icon: <Paperclip size={18} />, onSelect: () => add('robot-workshop', 'Robot workshop') },
      { label: 'Choose Photo: Biscuit at the Beach', icon: <Paperclip size={18} />, onSelect: () => add('dog-beach', 'Biscuit at the beach') },
      { label: 'Choose Photo: Concert Lights', icon: <Paperclip size={18} />, onSelect: () => add('concert-lights', 'Concert') },
      { label: 'Take Photo', icon: <Camera size={18} />, separatorBefore: true, onSelect: () => add('robot-arena', 'Photo') },
    ], { title: 'Attach' })
  }
  const kb = (fn: () => void) => ({ onPointerDown: (e: React.PointerEvent) => e.preventDefault(), onClick: fn })
  return (
    <>
      {aa && focused && (
        <div className="nt-aa glass heavy" onPointerDown={(e) => e.preventDefault()}>
          <div className="nt-aa-head"><b>Format</b><button onClick={() => setAa(false)} aria-label="Close format"><X size={16} /></button></div>
          <div className="nt-aa-styles">
            {STYLES.map((s) => (
              <button key={s.t} className={`nt-style-${s.t} ${cur?.t === s.t ? 'on' : ''}`} onClick={() => convert(s.t)}>{s.label}</button>
            ))}
          </div>
          <div className="nt-aa-lists">
            <button className={cur?.t === 'bullet' ? 'on' : ''} onClick={() => convert(cur?.t === 'bullet' ? 'p' : 'bullet')}>• List</button>
            <button className={cur?.t === 'check' ? 'on' : ''} onClick={() => convert(cur?.t === 'check' ? 'p' : 'check')}>◯ Checklist</button>
            <button className={cur?.t === 'quote' ? 'on' : ''} onClick={() => convert(cur?.t === 'quote' ? 'p' : 'quote')}>▍Quote</button>
          </div>
        </div>
      )}
      <div className={`nt-toolbar ${focused ? 'kb' : ''}`}>
        <div className="nt-tools glass">
          {focused && <button {...kb(() => setAa((a) => !a))} aria-label="Text style" className={aa ? 'on' : ''}><span className="nt-aa-glyph">Aa</span></button>}
          <button {...kb(checklist)} aria-label="Checklist"><ListChecks size={21} /></button>
          <button {...kb(() => insert([{ t: 'table', rows: [['', '', ''], ['', '', ''], ['', '', '']] }]))} aria-label="Insert table"><Table size={20} /></button>
          <button {...kb(() => insert([{ t: 'divider' }, { t: 'p', text: '' }], 1))} aria-label="Insert divider line"><Minus size={21} /></button>
          <button {...kb(onLink)} aria-label="Insert section link"><Link2 size={20} /></button>
          <button onPointerDown={(e) => e.preventDefault()} onClick={(e) => attach(e.currentTarget)} aria-label="Attach photo"><Paperclip size={20} /></button>
          <button {...kb(() => setDraw(true))} aria-label="Draw"><PenLine size={20} /></button>
        </div>
        {focused ? (
          <button className="nt-circle-btn glass interactive" onClick={() => { setAa(false); onDone() }} aria-label="Done editing"><ChevronDown size={22} /></button>
        ) : (
          <button className="nt-circle-btn glass interactive" onClick={onNewNote} aria-label="New Note"><SquarePenIcon /></button>
        )}
      </div>
      <DrawingSheet open={draw} initial={[]} onClose={() => setDraw(false)} onSave={(paths) => { setDraw(false); if (paths.length) insert([{ t: 'drawing', paths }, { t: 'p', text: '' }]) }} />
    </>
  )
}

function SquarePenIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.4 2.6a2.1 2.1 0 1 1 3 3L12 15l-4 1 1-4Z" />
    </svg>
  )
}

