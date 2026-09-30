import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { MousePointer2, PenLine, StickyNote, Shapes, Type, Image as ImageIcon, Undo2, Redo2, Plus, Minus, Trash2, Copy, BringToFront, Share, Users, Check } from 'lucide-react'
import { Page } from '../../ui/nav'
import { Glass, Avatar } from '../../ui/controls'
import { Sheet, openMenu } from '../../ui/overlay'
import { useOS, uid, type FreeformItem } from '../../os/store'
import { screenScale } from '../../os/hooks'
import { contactName } from '../../os/data/people'
import { Scene } from '../../art/Scene'
import { ItemView, STICKY_COLORS, INK_COLORS, SHAPES, shapePath, boardBounds } from './Items'
import { updateBoard } from './util'

type Tool = 'select' | 'pen' | 'sticky' | 'shape' | 'text'
interface View { x: number; y: number; z: number }

export function BoardPage({ id }: { id: string }) {
  const board = useOS((s) => s.freeform.find((b) => b.id === id))
  const [view, setView] = useState<View>({ x: 0, y: 0, z: 1 })
  const [tool, setTool] = useState<Tool>('select')
  const [shapeKind, setShapeKind] = useState<string>('rect')
  const [ink, setInk] = useState('#1c1c1e')
  const [sel, setSel] = useState<string | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState<string>('')
  const [live, setLive] = useState<{ pts: [number, number][] } | null>(null)
  const [past, setPast] = useState<FreeformItem[][]>([])
  const [future, setFuture] = useState<FreeformItem[][]>([])
  const [photoPick, setPhotoPick] = useState(false)
  const canvasRef = useRef<HTMLDivElement>(null)
  const editRef = useRef<HTMLTextAreaElement>(null)
  const viewRef = useRef(view)
  viewRef.current = view
  const items = board?.items ?? []
  const itemsRef = useRef(items)
  itemsRef.current = items

  useEffect(() => {
    if (!editing) return
    const t = window.setTimeout(() => editRef.current?.focus(), 40)
    return () => window.clearTimeout(t)
  }, [editing])

  // fit content on open
  useLayoutEffect(() => {
    const el = canvasRef.current
    if (!el || !board) return
    const bb = boardBounds(board.items)
    const W = el.offsetWidth
    const H = el.offsetHeight - 170
    const z = Math.max(0.4, Math.min(1.2, Math.min(W / (bb.w + 80), H / (bb.h + 80))))
    setView({ z, x: (W - bb.w * z) / 2 - bb.x * z, y: 110 + (H - bb.h * z) / 2 - bb.y * z })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const commit = (next: FreeformItem[], record = true) => {
    if (record) { setPast((p) => [...p.slice(-40), itemsRef.current]); setFuture([]) }
    updateBoard(id, { items: next })
  }
  const patchItem = (iid: string, p: Partial<FreeformItem>, record = false) => commit(itemsRef.current.map((it) => (it.id === iid ? { ...it, ...p } : it)), record)

  const local = (clientX: number, clientY: number) => {
    const r = canvasRef.current!.getBoundingClientRect()
    const s = screenScale()
    return { lx: (clientX - r.left) / s, ly: (clientY - r.top) / s }
  }
  const toCanvas = (clientX: number, clientY: number) => {
    const { lx, ly } = local(clientX, clientY)
    const v = viewRef.current
    return { cx: (lx - v.x) / v.z, cy: (ly - v.y) / v.z }
  }

  const zoomAt = (lx: number, ly: number, nz: number) => {
    const v = viewRef.current
    const z = Math.max(0.25, Math.min(4, nz))
    const px = (lx - v.x) / v.z
    const py = (ly - v.y) / v.z
    setView({ z, x: lx - px * z, y: ly - py * z })
  }
  const zoomBy = (f: number) => {
    const el = canvasRef.current!
    zoomAt(el.offsetWidth / 2, el.offsetHeight / 2, viewRef.current.z * f)
  }

  // wheel zoom (non-passive so the page doesn't scroll)
  useEffect(() => {
    const el = canvasRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const { lx, ly } = local(e.clientX, e.clientY)
      if (e.ctrlKey || e.metaKey || Math.abs(e.deltaY) > Math.abs(e.deltaX)) zoomAt(lx, ly, viewRef.current.z * Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0018)))
      else setView((v) => ({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY }))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const drag = (e: React.PointerEvent, onMove: (dx: number, dy: number, ev: PointerEvent) => void, onUp?: (dx: number, dy: number) => void) => {
    const s = screenScale()
    const x0 = e.clientX
    const y0 = e.clientY
    const move = (ev: PointerEvent) => onMove((ev.clientX - x0) / s, (ev.clientY - y0) / s, ev)
    const up = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      onUp?.((ev.clientX - x0) / s, (ev.clientY - y0) / s)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  const finishEdit = () => {
    if (editing) patchItem(editing, { text: draft }, true)
    setEditing(null)
  }

  const onBgDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return
    e.stopPropagation()
    e.preventDefault()
    if (editing) finishEdit()
    const { cx, cy } = toCanvas(e.clientX, e.clientY)
    if (tool === 'select') {
      const v0 = viewRef.current
      drag(e, (dx, dy) => setView({ ...v0, x: v0.x + dx, y: v0.y + dy }), (dx, dy) => { if (Math.hypot(dx, dy) < 4) setSel(null) })
      return
    }
    if (tool === 'pen') {
      const pts: [number, number][] = [[cx, cy]]
      setLive({ pts: [...pts] })
      drag(e, (_dx, _dy, ev) => {
        const p = toCanvas(ev.clientX, ev.clientY)
        const last = pts[pts.length - 1]
        if (Math.hypot(p.cx - last[0], p.cy - last[1]) < 2) return
        pts.push([p.cx, p.cy])
        setLive({ pts: [...pts] })
      }, () => {
        setLive(null)
        if (pts.length < 2) return
        const xs = pts.map((p) => p[0])
        const ys = pts.map((p) => p[1])
        const x = Math.min(...xs)
        const y = Math.min(...ys)
        const w = Math.max(4, Math.max(...xs) - x)
        const h = Math.max(4, Math.max(...ys) - y)
        const d = pts.map((p, i) => `${i ? 'L' : 'M'}${(p[0] - x).toFixed(1)} ${(p[1] - y).toFixed(1)}`).join(' ')
        commit([...itemsRef.current, { id: uid('ff'), kind: 'path', x, y, w, h, d, color: ink }])
      })
      return
    }
    const nid = uid('ff')
    const it: FreeformItem =
      tool === 'sticky' ? { id: nid, kind: 'sticky', x: cx - 75, y: cy - 75, w: 150, h: 150, text: '', color: STICKY_COLORS[items.filter((i) => i.kind === 'sticky').length % STICKY_COLORS.length] }
        : tool === 'shape' ? { id: nid, kind: 'shape', x: cx - 60, y: cy - 60, w: 120, h: 120, d: shapeKind, color: '#5ac8fa' }
          : { id: nid, kind: 'text', x: cx - 100, y: cy - 20, w: 200, h: 40, text: '', color: '#1c1c1e' }
    commit([...itemsRef.current, it])
    setSel(nid)
    setTool('select')
    if (it.kind !== 'shape') { setEditing(nid); setDraft('') }
  }

  const onItemDown = (e: React.PointerEvent, it: FreeformItem) => {
    if (e.button !== 0) return
    if (tool !== 'select') return
    e.stopPropagation()
    if (editing === it.id) return
    e.preventDefault()
    if (editing) finishEdit()
    const wasSel = sel === it.id
    setSel(it.id)
    const start = { x: it.x, y: it.y }
    const z = viewRef.current.z
    let recorded = false
    drag(e, (dx, dy) => {
      if (!recorded && Math.hypot(dx, dy) > 3) { setPast((p) => [...p.slice(-40), itemsRef.current]); setFuture([]); recorded = true }
      if (recorded) patchItem(it.id, { x: start.x + dx / z, y: start.y + dy / z })
    }, (dx, dy) => {
      if (Math.hypot(dx, dy) < 4 && wasSel && (it.kind === 'sticky' || it.kind === 'text' || it.kind === 'shape')) { setEditing(it.id); setDraft(it.text ?? '') }
    })
  }

  const onResize = (e: React.PointerEvent, it: FreeformItem) => {
    e.stopPropagation()
    const z = viewRef.current.z
    const start = { w: it.w, h: it.h }
    setPast((p) => [...p.slice(-40), itemsRef.current]); setFuture([])
    drag(e, (dx, dy) => {
      const keep = it.kind === 'image' || it.kind === 'sticky'
      const w = Math.max(40, start.w + dx / z)
      const h = keep ? (w * start.h) / start.w : Math.max(24, start.h + dy / z)
      patchItem(it.id, { w, h })
    })
  }

  const undo = () => {
    const prev = past[past.length - 1]
    if (!prev) return
    setFuture((f) => [itemsRef.current, ...f])
    setPast((p) => p.slice(0, -1))
    updateBoard(id, { items: prev })
    setSel(null)
  }
  const redo = () => {
    const nx = future[0]
    if (!nx) return
    setPast((p) => [...p, itemsRef.current])
    setFuture((f) => f.slice(1))
    updateBoard(id, { items: nx })
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (editing || !canvasRef.current?.closest('.app-window.active')) return
      if ((e.key === 'Backspace' || e.key === 'Delete') && sel) { commit(itemsRef.current.filter((i) => i.id !== sel)); setSel(null) }
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  if (!board) return <Page title="Board" large={false}><div className="empty-state">This board was deleted.</div></Page>
  const selected = items.find((i) => i.id === sel)
  const colors = selected?.kind === 'sticky' ? STICKY_COLORS : INK_COLORS

  const livePath = live?.pts.map((p, i) => `${i ? 'L' : 'M'}${p[0]} ${p[1]}`).join(' ')
  const addImage = (photoId: string) => {
    const el = canvasRef.current!
    const v = viewRef.current
    const cx = (el.offsetWidth / 2 - v.x) / v.z
    const cy = (el.offsetHeight / 2 - v.y) / v.z
    const nid = uid('ff')
    commit([...itemsRef.current, { id: nid, kind: 'image', x: cx - 110, y: cy - 82, w: 220, h: 165, photoId }])
    setSel(nid)
    setPhotoPick(false)
    setTool('select')
  }

  return (
    <Page
      large={false}
      className="ff-board-page"
      title={board.name}
      trailing={
        <>
          {board.shared?.length ? (
            <button className="ff-collab glass interactive" aria-label="Collaborators" onClick={(e) => openMenu(e.currentTarget, [
              ...board.shared!.map((p) => ({ label: `${contactName(p, 'full')} · can edit`, icon: <Avatar id={p} size={22} /> })),
              { label: 'Share Board…', icon: <Share size={17} />, separatorBefore: true, onSelect: () => useOS.getState().set({ shareRequest: { title: board.name, kind: 'link', payload: `freeform://${board.id}`, app: 'freeform' } }) },
            ], { title: `${board.folder} · shared` })}>
              {board.shared.slice(0, 3).map((p) => <Avatar key={p} id={p} size={26} />)}
            </button>
          ) : (
            <button className="bar-btn icon glass interactive" aria-label="Share board" onClick={() => useOS.getState().set({ shareRequest: { title: board.name, kind: 'link', payload: `freeform://${board.id}`, app: 'freeform' } })}><Share size={19} /></button>
          )}
        </>
      }
    >
      <div ref={canvasRef} className={`ff-canvas tool-${tool}`} onPointerDown={onBgDown} style={{ backgroundPosition: `${view.x}px ${view.y}px`, backgroundSize: `${24 * view.z}px ${24 * view.z}px` }}>
        <div className="ff-layer" style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.z})` }}>
          {items.map((it) => (
            <div key={it.id} className={`ff-item kind-${it.kind} ${sel === it.id ? 'sel' : ''}`} style={{ left: it.x, top: it.y, width: it.w, height: it.h }} onPointerDown={(e) => onItemDown(e, it)}>
              <ItemView it={it} editing={editing === it.id} />
              {editing === it.id && (
                <textarea
                  className={`ff-edit kind-${it.kind}`}
                  ref={editRef}
                  value={draft}
                  placeholder={it.kind === 'sticky' ? 'Type a note' : 'Text'}
                  onChange={(e) => setDraft(e.target.value)}
                  onBlur={finishEdit}
                  onPointerDown={(e) => e.stopPropagation()}
                  onKeyDown={(e) => { if (e.key === 'Escape') finishEdit() }}
                  aria-label="Edit text"
                />
              )}
              {sel === it.id && editing !== it.id && <span className="ff-handle" style={{ transform: `scale(${1 / view.z})` }} onPointerDown={(e) => onResize(e, it)} aria-label="Resize" role="button" />}
            </div>
          ))}
          {livePath && <svg className="ff-live"><path d={livePath} stroke={ink} strokeWidth={4} fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>}
          {board.shared?.length ? <div className="ff-remote" style={{ left: boardBounds(items).x + 40, top: boardBounds(items).y + 30 }}><svg width="16" height="18" viewBox="0 0 16 18"><path d="M1 1 L15 9 L8 10 L5 17 Z" fill="#1fb6ff" stroke="#fff" strokeWidth="1.5" /></svg><span>{contactName(board.shared[0])}</span></div> : null}
        </div>
      </div>

      {selected && !editing && (
        <Glass className="ff-selbar anim-up" variant="heavy">
          {selected.kind !== 'image' && colors.map((c) => (
            <button key={c} className={`ff-swatch ${selected.color === c ? 'on' : ''}`} style={{ background: c }} aria-label={`Color ${c}`} onClick={() => patchItem(selected.id, { color: c }, true)} />
          ))}
          {selected.kind === 'shape' && <button aria-label="Change shape" onClick={(e) => openMenu(e.currentTarget, SHAPES.map((s) => ({ label: s[0].toUpperCase() + s.slice(1), icon: <svg width="18" height="18" viewBox="0 0 100 100"><path d={shapePath(s)} fill="currentColor" /></svg>, onSelect: () => patchItem(selected.id, { d: s }, true) })))}><Shapes size={18} /></button>}
          <button aria-label="Bring to front" onClick={() => commit([...items.filter((i) => i.id !== selected.id), selected])}><BringToFront size={18} /></button>
          <button aria-label="Duplicate" onClick={() => { const nid = uid('ff'); commit([...items, { ...selected, id: nid, x: selected.x + 24, y: selected.y + 24 }]); setSel(nid) }}><Copy size={18} /></button>
          <button aria-label="Delete" className="ff-del" onClick={() => { commit(items.filter((i) => i.id !== selected.id)); setSel(null) }}><Trash2 size={18} /></button>
        </Glass>
      )}

      <div className="ff-zoom">
        <Glass className="ff-zoom-pill" variant="heavy">
          <button aria-label="Zoom out" onClick={() => zoomBy(1 / 1.25)}><Minus size={17} /></button>
          <button className="ff-zoom-pct" aria-label="Zoom to 100%" onClick={() => { const el = canvasRef.current!; zoomAt(el.offsetWidth / 2, el.offsetHeight / 2, 1) }}>{Math.round(view.z * 100)}%</button>
          <button aria-label="Zoom in" onClick={() => zoomBy(1.25)}><Plus size={17} /></button>
        </Glass>
      </div>

      <div className="ff-toolbar-wrap">
        {tool === 'pen' && (
          <Glass className="ff-inks anim-up" variant="heavy">
            {INK_COLORS.map((c) => <button key={c} className={`ff-swatch ${ink === c ? 'on' : ''}`} style={{ background: c }} aria-label={`Ink ${c}`} onClick={() => setInk(c)} />)}
          </Glass>
        )}
        <Glass className="ff-toolbar" variant="heavy">
          <button className={tool === 'select' ? 'on' : ''} aria-label="Select" onClick={() => setTool('select')}><MousePointer2 size={20} /></button>
          <button className={tool === 'pen' ? 'on' : ''} aria-label="Draw" onClick={() => { setTool('pen'); setSel(null) }}><PenLine size={20} /></button>
          <button className={tool === 'sticky' ? 'on' : ''} aria-label="Sticky note" onClick={() => setTool('sticky')}><StickyNote size={20} /></button>
          <button className={tool === 'shape' ? 'on' : ''} aria-label="Shape" onClick={(e) => openMenu(e.currentTarget, SHAPES.map((s) => ({ label: s[0].toUpperCase() + s.slice(1), icon: shapeKind === s ? <Check size={17} /> : <svg width="18" height="18" viewBox="0 0 100 100"><path d={shapePath(s)} fill="currentColor" /></svg>, onSelect: () => { setShapeKind(s); setTool('shape') } })), { title: 'Tap the board to place' })}><Shapes size={20} /></button>
          <button className={tool === 'text' ? 'on' : ''} aria-label="Text box" onClick={() => setTool('text')}><Type size={20} /></button>
          <button aria-label="Insert photo" onClick={() => setPhotoPick(true)}><ImageIcon size={20} /></button>
          <span className="ff-tsep" />
          <button aria-label="Undo" disabled={!past.length} onClick={undo}><Undo2 size={20} /></button>
          <button aria-label="Redo" disabled={!future.length} onClick={redo}><Redo2 size={20} /></button>
        </Glass>
        {tool !== 'select' && tool !== 'pen' && <div className="ff-hint">Tap the board to add {tool === 'sticky' ? 'a sticky note' : tool === 'shape' ? `a ${shapeKind}` : 'a text box'}</div>}
      </div>

      {board.shared?.length ? <div className="ff-presence"><Users size={12} /> {contactName(board.shared[0])} is viewing</div> : null}

      <Sheet open={photoPick} onClose={() => setPhotoPick(false)} title="Insert Photo" detent="large">
        <div className="ff-photo-grid">
          {useOS.getState().photos.filter((p) => !p.hidden && !p.idDocument && p.kind !== 'video').slice(0, 36).map((p) => (
            <button key={p.id} aria-label={p.description} onClick={() => addImage(p.id)}><Scene scene={p.scene} /></button>
          ))}
        </div>
      </Sheet>
    </Page>
  )
}
