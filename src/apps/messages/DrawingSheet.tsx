import { useRef, useState, useEffect } from 'react'
import { Undo2, Trash2, ArrowUp } from 'lucide-react'
import { Sheet } from '../../ui/overlay'

const COLORS = ['#ffffff', '#ff375f', '#ff9f0a', '#ffd60a', '#30d158', '#0a84ff', '#bf5af2']
const WIDTHS = [3, 6, 11]

type Stroke = { color: string; w: number; pts: [number, number][] }

function toPath(pts: [number, number][]): string {
  if (!pts.length) return ''
  if (pts.length === 1) return `M${pts[0][0]} ${pts[0][1]} l0.1 0`
  let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`
  for (let i = 1; i < pts.length - 1; i++) {
    const [x1, y1] = pts[i]
    const [x2, y2] = pts[i + 1]
    d += ` Q${x1.toFixed(1)} ${y1.toFixed(1)} ${((x1 + x2) / 2).toFixed(1)} ${((y1 + y2) / 2).toFixed(1)}`
  }
  const l = pts[pts.length - 1]
  return d + ` L${l[0].toFixed(1)} ${l[1].toFixed(1)}`
}

export function encodeDrawing(strokes: { color: string; w: number; d: string }[]): string {
  return strokes.map((s) => `${s.color}|${s.w}|${s.d}`).join(';;')
}

/** iOS 27: sketch right inside Messages and send it as a drawing. */
export function DrawingSheet({ open, onClose, onSend }: { open: boolean; onClose: () => void; onSend: (data: string) => void }) {
  const [strokes, setStrokes] = useState<Stroke[]>([])
  const [color, setColor] = useState(COLORS[1])
  const [w, setW] = useState(WIDTHS[1])
  const svg = useRef<SVGSVGElement>(null)
  const drawing = useRef<Stroke | null>(null)
  useEffect(() => {
    if (open) setStrokes([])
  }, [open])

  const pt = (e: PointerEvent | React.PointerEvent): [number, number] => {
    const r = svg.current!.getBoundingClientRect()
    return [((e.clientX - r.left) / r.width) * 200, ((e.clientY - r.top) / r.height) * 130]
  }

  const down = (e: React.PointerEvent) => {
    e.stopPropagation()
    const s: Stroke = { color, w, pts: [pt(e)] }
    drawing.current = s
    setStrokes((x) => [...x, s])
    const move = (ev: PointerEvent) => {
      const cur = drawing.current
      if (!cur) return
      cur.pts = [...cur.pts, pt(ev)]
      setStrokes((x) => [...x.slice(0, -1), { ...cur }])
    }
    const up = () => {
      drawing.current = null
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  const send = () => {
    if (!strokes.length) return
    onSend(encodeDrawing(strokes.map((s) => ({ color: s.color, w: s.w, d: toPath(s.pts) }))))
    onClose()
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      detent="auto"
      title="Drawing"
      trailing={
        <button className={`bar-btn icon ${strokes.length ? 'prominent' : 'glass'}`} aria-label="Send drawing" disabled={!strokes.length} onClick={send}>
          <ArrowUp size={22} strokeWidth={2.6} />
        </button>
      }
    >
      <div className="msg-draw">
        <svg ref={svg} className="msg-draw-canvas" viewBox="0 0 200 130" onPointerDown={down} role="img" aria-label="Drawing canvas">
          {strokes.map((s, i) => (
            <path key={i} d={toPath(s.pts)} stroke={s.color} strokeWidth={s.w} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          ))}
          {!strokes.length && (
            <text x="100" y="68" textAnchor="middle" className="msg-draw-hint">Draw with your finger</text>
          )}
        </svg>
        <div className="msg-draw-tools">
          <button className="bar-btn icon glass" aria-label="Undo" disabled={!strokes.length} onClick={() => setStrokes((s) => s.slice(0, -1))}><Undo2 size={20} /></button>
          <div className="msg-draw-colors">
            {COLORS.map((c) => (
              <button key={c} className={`msg-draw-color ${c === color ? 'on' : ''}`} style={{ background: c }} aria-label={`Color ${c}`} onClick={() => setColor(c)} />
            ))}
          </div>
          <button className="bar-btn icon glass" aria-label="Clear" disabled={!strokes.length} onClick={() => setStrokes([])}><Trash2 size={19} /></button>
        </div>
        <div className="msg-draw-widths">
          {WIDTHS.map((x) => (
            <button key={x} className={`msg-draw-width ${x === w ? 'on' : ''}`} onClick={() => setW(x)} aria-label={`Pen width ${x}`}>
              <span style={{ width: x * 2.4, height: x * 2.4, background: color }} />
            </button>
          ))}
        </div>
      </div>
    </Sheet>
  )
}
