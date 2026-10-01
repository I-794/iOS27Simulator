import { useEffect, useMemo, useRef, useState } from 'react'
import { Sun, Sparkles, Droplet, Wand2, Crop as CropIcon, Eraser, Expand, Move3d, SlidersHorizontal, Aperture, Undo2, Check, X, RotateCcw, SplitSquareHorizontal } from 'lucide-react'
import { useOS } from '../../os/store'
import { screenScale } from '../../os/hooks'
import { Slider, Segmented, AISparkle } from '../../ui/controls'
import { showAlert } from '../../ui/overlay'
import { SCENE_OBJECTS } from '../../art/Scene'
import type { Photo } from '../../os/types'
import { PhotoView } from './PhotoView'
import { useUI, usePhotoMap } from './pstore'
import { FILTERS, edits as getEdits, mapBox, photoRatio, sceneSize, ratioLabel, type PhEdits } from './look'
import { useBackHandler } from './back'

type Tool = 'adjust' | 'filters' | 'crop' | 'cleanup' | 'extend' | 'reframe'
const TOOLS: { id: Tool; label: string; icon: React.ReactNode; ai?: boolean }[] = [
  { id: 'adjust', label: 'Adjust', icon: <SlidersHorizontal size={21} /> },
  { id: 'filters', label: 'Filters', icon: <Aperture size={21} /> },
  { id: 'crop', label: 'Crop', icon: <CropIcon size={21} /> },
  { id: 'cleanup', label: 'Clean Up', icon: <Eraser size={21} />, ai: true },
  { id: 'extend', label: 'Extend', icon: <Expand size={21} />, ai: true },
  { id: 'reframe', label: 'Reframe', icon: <Move3d size={21} />, ai: true },
]

export function Editor() {
  const id = useUI((s) => s.editor)
  const map = usePhotoMap()
  const photo = id ? map.get(id) : undefined
  if (!photo) return null
  return <EditorInner key={photo.id} photo={photo} />
}

const clean = (e: PhEdits): PhEdits | undefined => {
  const out: PhEdits = {}
  for (const [k, v] of Object.entries(e)) {
    if (v === undefined || v === 0 || (Array.isArray(v) && !v.length) || (k === 'filter' && v === 'Original') || (k === 'cropAspect' && v === 'original') || (k === 'crop' && v === 1)) continue
    ;(out as Record<string, unknown>)[k] = v
  }
  return Object.keys(out).length ? out : undefined
}

interface Removal { id: string; box: { left: number; top: number; width: number; height: number }; start: number; dur: number }

function EditorInner({ photo }: { photo: Photo }) {
  const orig = getEdits(photo)
  const [draft, setDraft] = useState<PhEdits>({ ...orig })
  const [hist, setHist] = useState<PhEdits[]>([])
  const [tool, setTool] = useState<Tool>('adjust')
  const [adj, setAdj] = useState<'exposure' | 'brilliance' | 'saturation'>('exposure')
  const [compare, setCompare] = useState(false)
  const [mode, setMode] = useState<'fast' | 'hq' | 'auto'>(orig.cleanMode ?? 'auto')
  const [runMode, setRunMode] = useState<'fast' | 'hq'>('fast')
  const [removing, setRemoving] = useState<Removal[]>([])
  const [progress, setProgress] = useState(0)
  const [cleanNote, setCleanNote] = useState<string | null>(null)
  const [brush, setBrush] = useState<{ x: number; y: number }[]>([])
  const [generating, setGenerating] = useState(false)
  const [tiltLive, setTiltLive] = useState({ rx: 0, ry: 0 })
  const rootRef = useRef<HTMLDivElement>(null)
  const boxRef = useRef<HTMLDivElement>(null)
  const landscape = useOS((s) => s.orientation === 'landscape')

  const view: Photo = useMemo(() => ({ ...photo, edits: compare ? undefined : clean(draft) }), [photo, draft, compare])
  const ratio = photoRatio(view)
  const objects = SCENE_OBJECTS[photo.scene] ?? []
  const remaining = objects.filter((o) => !draft.cleanedUp?.includes(o.id) && !removing.some((r) => r.id === o.id))
  const dirty = JSON.stringify(clean(draft) ?? {}) !== JSON.stringify(clean(orig) ?? {})

  const commit = (patch: Partial<PhEdits>) => {
    setHist((h) => [...h, draft])
    setDraft((d) => ({ ...d, ...patch }))
  }
  const undo = () => {
    if (!hist.length) return
    setDraft(hist[hist.length - 1])
    setHist((h) => h.slice(0, -1))
  }
  const exit = () => useUI.getState().set({ editor: null })
  const cancel = () => {
    if (!dirty) return exit()
    showAlert({ title: 'Discard Changes?', message: 'Your edits to this photo will be lost.', actions: [{ label: 'Keep Editing', style: 'cancel' }, { label: 'Discard Changes', style: 'destructive', onPress: exit }] })
  }
  const done = () => {
    useOS.getState().updatePhoto(photo.id, { edits: clean({ ...draft, cleanMode: draft.cleanedUp?.length ? mode : undefined }) as Photo['edits'] })
    if (dirty) useOS.getState().showToast('Saved')
    exit()
  }
  useBackHandler(true, cancel, rootRef)

  // --------------------------- Clean Up ---------------------------
  const removeObjects = (ids: string[]) => {
    const targets = remaining.filter((o) => ids.includes(o.id))
    if (!targets.length) return
    const complex = targets.some((o) => /person|tourist|walker/i.test(o.label) || o.bbox[2] * o.bbox[3] > 3000)
    const eff: 'fast' | 'hq' = mode === 'auto' ? (complex ? 'hq' : 'fast') : mode
    setRunMode(eff)
    const dur = eff === 'hq' ? 2400 : 900
    const now = performance.now()
    setRemoving((r) => [...r, ...targets.map((o) => ({ id: o.id, box: mapBox(photo.scene, draft, ratio, o.bbox), start: now, dur }))])
    setCleanNote(null)
    if (eff === 'hq') {
      setProgress(0)
      const t0 = performance.now()
      const iv = window.setInterval(() => {
        const p = Math.min(1, (performance.now() - t0) / dur)
        setProgress(p)
        if (p >= 1) window.clearInterval(iv)
      }, 60)
    }
    window.setTimeout(() => {
      setHist((h) => [...h, draft])
      setDraft((d) => ({ ...d, cleanedUp: [...(d.cleanedUp ?? []), ...targets.map((o) => o.id)] }))
      setRemoving((r) => r.filter((x) => !targets.some((o) => o.id === x.id)))
      setProgress(0)
      const what = targets.map((o) => o.label.toLowerCase()).join(', ')
      setCleanNote(mode === 'auto'
        ? `Removed ${what} · Auto chose ${eff === 'hq' ? 'High Quality for the complex background' : 'Fast for a simple background'}.`
        : eff === 'hq'
          ? `Removed ${what} · High Quality reconstructed texture, lighting and shadows.`
          : `Removed ${what} · Fast fill. Try High Quality for complex backgrounds.`)
    }, dur)
  }

  const toPct = (clientX: number, clientY: number) => {
    const r = boxRef.current!.getBoundingClientRect()
    return { x: ((clientX - r.left) / r.width) * 100, y: ((clientY - r.top) / r.height) * 100 }
  }

  const onCanvasDown = (e: React.PointerEvent) => {
    if (e.button !== 0 || !boxRef.current) return
    if (tool === 'cleanup') {
      if (removing.length) return
      const pts = [toPct(e.clientX, e.clientY)]
      setBrush(pts)
      const move = (ev: PointerEvent) => {
        pts.push(toPct(ev.clientX, ev.clientY))
        setBrush([...pts])
      }
      const up = () => {
        window.removeEventListener('pointermove', move)
        window.removeEventListener('pointerup', up)
        const hits = remaining.filter((o) => {
          const b = mapBox(photo.scene, draft, ratio, o.bbox)
          const tol = 4
          return pts.some((p) => p.x >= b.left - tol && p.x <= b.left + b.width + tol && p.y >= b.top - tol && p.y <= b.top + b.height + tol)
        })
        // A circle around an object also counts
        if (!hits.length && pts.length > 8) {
          const xs = pts.map((p) => p.x)
          const ys = pts.map((p) => p.y)
          const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]
          remaining.forEach((o) => {
            const b = mapBox(photo.scene, draft, ratio, o.bbox)
            if (b.left + b.width / 2 > x0 && b.left + b.width / 2 < x1 && b.top + b.height / 2 > y0 && b.top + b.height / 2 < y1) hits.push(o)
          })
        }
        window.setTimeout(() => setBrush([]), hits.length ? 250 : 500)
        if (hits.length) removeObjects(hits.map((o) => o.id))
        else setCleanNote(objects.length ? 'Nothing to remove there. Tap a highlighted object or brush over it.' : 'No distractions detected in this photo.')
      }
      window.addEventListener('pointermove', move)
      window.addEventListener('pointerup', up)
      return
    }
    if (tool === 'reframe') {
      const scale = screenScale()
      const x0 = e.clientX
      const y0 = e.clientY
      const start = draft.reframe ?? { x: 0, y: 0, tilt: 0 }
      setHist((h) => [...h, draft])
      const move = (ev: PointerEvent) => {
        const dx = (ev.clientX - x0) / scale
        const dy = (ev.clientY - y0) / scale
        const x = Math.max(-40, Math.min(40, start.x - dx * 0.35))
        const y = Math.max(-30, Math.min(30, start.y - dy * 0.35))
        setDraft((d) => ({ ...d, reframe: { x, y, tilt: d.reframe?.tilt ?? start.tilt } }))
        setTiltLive({ ry: Math.max(-10, Math.min(10, dx * 0.06)), rx: Math.max(-8, Math.min(8, -dy * 0.05)) })
      }
      const up = () => {
        window.removeEventListener('pointermove', move)
        window.removeEventListener('pointerup', up)
        setTiltLive({ rx: 0, ry: 0 })
      }
      window.addEventListener('pointermove', move)
      window.addEventListener('pointerup', up)
    }
  }

  // --------------------------- Extend ---------------------------
  const baseRatio = photo.width / photo.height
  const genTimer = useRef<number | undefined>(undefined)
  const setExtend = (r: number | null) => {
    if (r === null) {
      commit({ extended: undefined, extendRatio: undefined })
      return
    }
    commit({ extended: true, extendRatio: r, cropAspect: undefined })
    setGenerating(true)
    window.clearTimeout(genTimer.current)
    genTimer.current = window.setTimeout(() => setGenerating(false), 1500)
  }
  useEffect(() => () => window.clearTimeout(genTimer.current), [])
  const onHandle = (side: 'l' | 'r' | 't' | 'b') => (e: React.PointerEvent) => {
    e.stopPropagation()
    const scale = screenScale()
    const box = boxRef.current!
    const w0 = box.offsetWidth
    const h0 = box.offsetHeight
    const r0 = draft.extended && draft.extendRatio ? draft.extendRatio : baseRatio
    const x0 = e.clientX
    const y0 = e.clientY
    let r = r0
    setHist((h) => [...h, draft])
    const move = (ev: PointerEvent) => {
      const dx = ((ev.clientX - x0) / scale) * (side === 'l' ? -1 : 1)
      const dy = ((ev.clientY - y0) / scale) * (side === 't' ? -1 : 1)
      r = side === 'l' || side === 'r' ? r0 * Math.max(0.5, (w0 + dx * 2) / w0) : r0 / Math.max(0.5, (h0 + dy * 2) / h0)
      r = Math.max(0.45, Math.min(2.4, r))
      setDraft((d) => ({ ...d, extended: true, extendRatio: r, cropAspect: undefined }))
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      setGenerating(true)
      window.clearTimeout(genTimer.current)
      genTimer.current = window.setTimeout(() => setGenerating(false), 1500)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }
  const { W, H } = sceneSize(photo.scene)
  const origFrame = draft.extended ? mapBox(photo.scene, draft, ratio, [0, 0, W, H]) : null
  const canvasRatio = useRef(0.6)
  useEffect(() => {
    const el = rootRef.current?.querySelector('.ph-ed-canvas') as HTMLElement | null
    if (el) canvasRatio.current = el.offsetWidth / Math.max(1, el.offsetHeight)
  })

  const adjVal = (draft[adj] as number | undefined) ?? 0
  const toolInfo = TOOLS.find((t) => t.id === tool)!

  return (
    <div ref={rootRef} className={`ph-editor ${landscape ? 'land' : ''}`} role="dialog" aria-label="Edit photo">
      <div className="ph-ed-top">
        <button className="ph-ed-pill glass dark-glass interactive" onClick={cancel}><X size={18} /> Cancel</button>
        <div className="ph-ed-top-mid">
          <button className="bar-btn icon glass dark-glass interactive" aria-label="Undo" disabled={!hist.length} onClick={undo}><Undo2 size={19} /></button>
          <button
            className={`bar-btn icon glass dark-glass interactive ${compare ? 'on' : ''}`}
            aria-label="Compare with original"
            onPointerDown={() => setCompare(true)}
            onPointerUp={() => setCompare(false)}
            onPointerLeave={() => setCompare(false)}
            onClick={() => {}}
          >
            <SplitSquareHorizontal size={19} />
          </button>
          {Object.keys(clean(draft) ?? {}).length > 0 && (
            <button className="ph-ed-pill glass dark-glass interactive" onClick={() => { setHist((h) => [...h, draft]); setDraft(draft.capture ? { capture: draft.capture } : {}) }}><RotateCcw size={15} /> Revert</button>
          )}
        </div>
        <button className="ph-ed-done interactive" aria-label="Done" onClick={done}><Check size={22} strokeWidth={3} /></button>
      </div>

      <div className="ph-ed-canvas" onPointerDown={onCanvasDown}>
        <div
          className={`ph-ed-box ${tool}`}
          ref={boxRef}
          style={{ ['--r' as string]: ratio, transform: tool === 'reframe' ? `perspective(900px) rotateX(${tiltLive.rx}deg) rotateY(${tiltLive.ry}deg)` : undefined }}
        >
          <div className="ph-ed-img"><PhotoView photo={view} /></div>
          {tool === 'crop' && <div className="ph-crop-grid" aria-hidden><i /><i /><i /><i /></div>}
          {tool === 'reframe' && <div className="ph-reframe-grid" aria-hidden />}
          {tool === 'cleanup' && !compare && remaining.map((o) => {
            const b = mapBox(photo.scene, draft, ratio, o.bbox)
            return <button key={o.id} className="ph-cu-obj" style={{ left: `${b.left}%`, top: `${b.top}%`, width: `${b.width}%`, height: `${b.height}%` }} aria-label={`Remove ${o.label}`} onPointerDown={(e) => { e.stopPropagation(); if (!removing.length) removeObjects([o.id]) }} />
          })}
          {removing.map((r) => (
            <div key={r.id} className={`ph-cu-fill ${runMode}`} style={{ left: `${r.box.left}%`, top: `${r.box.top}%`, width: `${r.box.width}%`, height: `${r.box.height}%`, animationDuration: `${r.dur}ms` }}>
              {Array.from({ length: 6 }).map((_, i) => <span key={i} className="ph-spark" style={{ left: `${(i * 37) % 100}%`, top: `${(i * 53) % 100}%`, animationDelay: `${i * 90}ms` }}>✦</span>)}
            </div>
          ))}
          {brush.length > 0 && (
            <svg className="ph-brush" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
              <polyline points={brush.map((p) => `${p.x},${p.y}`).join(' ')} />
            </svg>
          )}
          {tool === 'extend' && origFrame && <div className="ph-ext-frame" style={{ left: `${origFrame.left}%`, top: `${origFrame.top}%`, width: `${origFrame.width}%`, height: `${origFrame.height}%` }} />}
          {tool === 'extend' && generating && <div className="ph-ext-gen" style={origFrame ? ({ ['--fl' as string]: `${origFrame.left}%`, ['--ft' as string]: `${origFrame.top}%`, ['--fw' as string]: `${origFrame.width}%`, ['--fh' as string]: `${origFrame.height}%` }) : undefined}><span>✦</span><span>✦</span><span>✦</span></div>}
          {tool === 'extend' && (['l', 'r', 't', 'b'] as const).map((s) => <div key={s} className={`ph-ext-handle ${s}`} onPointerDown={onHandle(s)} role="slider" aria-label={`Extend ${s === 'l' ? 'left' : s === 'r' ? 'right' : s === 't' ? 'top' : 'bottom'}`} aria-valuenow={Math.round(ratio * 100)} tabIndex={0} />)}
          {compare && <span className="ph-ed-orig">ORIGINAL</span>}
        </div>
      </div>

      <div className="ph-ed-panel">
        <div className="ph-ed-tool-title">{toolInfo.ai && <AISparkle size={14} />} {toolInfo.label.toUpperCase()}</div>
        {tool === 'adjust' && (
          <>
            <div className="ph-adj-list">
              <button className="ph-adj auto" onClick={() => commit({ exposure: 0.12, brilliance: 0.35, saturation: 0.18 })} aria-label="Auto enhance"><Wand2 size={20} /><span>Auto</span></button>
              {([['exposure', 'Exposure', <Sun size={20} key="s" />], ['brilliance', 'Brilliance', <Sparkles size={20} key="b" />], ['saturation', 'Saturation', <Droplet size={20} key="d" />]] as const).map(([k, l, ic]) => {
                const v = (draft[k] as number | undefined) ?? 0
                return (
                  <button key={k} className={`ph-adj ${adj === k ? 'on' : ''}`} onClick={() => setAdj(k)} aria-pressed={adj === k}>
                    <span className="ph-adj-ring" style={{ ['--v' as string]: Math.abs(v) }}>{ic}</span>
                    <span>{l}</span>
                  </button>
                )
              })}
            </div>
            <div className="ph-adj-slider">
              <span className="ph-adj-val">{adjVal > 0 ? '+' : ''}{Math.round(adjVal * 100)}</span>
              <Slider value={adjVal} min={-1} max={1} onChange={(v) => setDraft((d) => ({ ...d, [adj]: Math.abs(v) < 0.03 ? 0 : v }))} onCommit={() => setHist((h) => [...h, draft])} label={adj} color="#ffd60a" />
            </div>
          </>
        )}
        {tool === 'filters' && (
          <div className="ph-filters">
            {Object.keys(FILTERS).map((f) => (
              <button key={f} className={`ph-filter ${((draft.filter ?? 'Original') === f) ? 'on' : ''}`} onClick={() => commit({ filter: f })} aria-pressed={(draft.filter ?? 'Original') === f}>
                <div className="ph-filter-img"><PhotoView photo={photo} override={{ filter: f, exposure: undefined, brilliance: undefined, saturation: undefined }} /></div>
                <span>{f}</span>
              </button>
            ))}
          </div>
        )}
        {tool === 'crop' && (
          <>
            <div className="ph-chips">
              {(['original', 'square', '16:9', '4:5', '3:2'] as const).map((a) => (
                <button key={a} className={`chip ${(draft.cropAspect ?? 'original') === a ? 'active' : ''}`} onClick={() => commit({ cropAspect: a, extended: undefined, extendRatio: undefined })}>{a === 'original' ? 'Original' : a === 'square' ? 'Square' : a}</button>
              ))}
            </div>
            <div className="ph-adj-slider">
              <span className="ph-adj-val">{Math.round(((draft.crop ?? 1) - 1) * 100)}%</span>
              <Slider value={draft.crop ?? 1} min={1} max={2} onChange={(v) => setDraft((d) => ({ ...d, crop: v }))} onCommit={() => setHist((h) => [...h, draft])} label="Scale" color="#ffd60a" />
            </div>
          </>
        )}
        {tool === 'cleanup' && (
          <>
            <Segmented options={['fast', 'hq', 'auto'] as const} value={mode} onChange={setMode} labels={{ fast: 'Fast', hq: 'High Quality', auto: 'Auto' }} style={{ margin: '0 16px' }} />
            {removing.length > 0 ? (
              <div className="ph-cu-status">
                <div className="ph-cu-progress"><div style={{ width: runMode === 'hq' ? `${progress * 100}%` : '100%' }} className={runMode === 'fast' ? 'indeterminate' : ''} /></div>
                <span className="t-footnote">{runMode === 'hq' ? `${mode === 'auto' ? 'Auto · ' : ''}Generating in High Quality… ${Math.round(progress * 100)}%` : `${mode === 'auto' ? 'Auto · ' : ''}Cleaning up…`}</span>
              </div>
            ) : (
              <>
                <div className="ph-chips">
                  {remaining.map((o) => <button key={o.id} className="chip" onClick={() => removeObjects([o.id])}><Eraser size={13} /> {o.label}</button>)}
                  {remaining.length > 1 && <button className="chip active" onClick={() => removeObjects(remaining.map((o) => o.id))}>Remove All</button>}
                </div>
                <div className="t-footnote ph-ed-hint">{cleanNote ?? (remaining.length ? 'Tap, brush or circle what you want to remove. Highlighted items were detected automatically.' : draft.cleanedUp?.length ? 'All detected distractions removed.' : 'Brush over anything you want to remove.')}</div>
              </>
            )}
          </>
        )}
        {tool === 'extend' && (
          <>
            <div className="ph-chips">
              <button className={`chip ${!draft.extended ? 'active' : ''}`} onClick={() => setExtend(null)}>Original</button>
              {([['16:9', 16 / 9], ['4:3', 4 / 3], ['Square', 1], ['9:16', 9 / 16], ['Fill', 0]] as const).map(([l, r]) => {
                const val = r || canvasRatio.current
                const on = !!draft.extended && Math.abs((draft.extendRatio ?? 0) - val) < 0.02
                return <button key={l} className={`chip ${on ? 'active' : ''}`} onClick={() => setExtend(val)}>{l}</button>
              })}
            </div>
            <div className="t-footnote ph-ed-hint">{generating ? 'Generating content beyond the frame…' : draft.extended ? `Extended to ${ratioLabel(ratio)}. Drag the handles to expand further.` : 'Choose a size or drag the edges to expand the photo beyond its original frame.'}</div>
          </>
        )}
        {tool === 'reframe' && (
          <>
            <div className="ph-adj-slider">
              <span className="ph-adj-val">Tilt {(draft.reframe?.tilt ?? 0).toFixed(1)}°</span>
              <Slider value={draft.reframe?.tilt ?? 0} min={-8} max={8} onChange={(v) => setDraft((d) => ({ ...d, reframe: { x: d.reframe?.x ?? 0, y: d.reframe?.y ?? 0, tilt: Math.abs(v) < 0.2 ? 0 : v } }))} onCommit={() => setHist((h) => [...h, draft])} label="Tilt" color="#ffd60a" />
            </div>
            <div className="ph-chips">
              <button className="chip" onClick={() => commit({ reframe: undefined })}>Reset</button>
              <button className="chip" onClick={() => commit({ reframe: { x: -18, y: 6, tilt: -2 } })}>Shift Left</button>
              <button className="chip" onClick={() => commit({ reframe: { x: 18, y: 6, tilt: 2 } })}>Shift Right</button>
              <button className="chip" onClick={() => commit({ reframe: { x: 0, y: -16, tilt: 0 } })}>Lower Angle</button>
            </div>
            <div className="t-footnote ph-ed-hint">Drag the photo to move the virtual camera. Spatial Reframing uses depth from capture to adjust composition and perspective.</div>
          </>
        )}
      </div>

      <div className="ph-ed-tools" role="tablist">
        {TOOLS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tool === t.id} className={tool === t.id ? 'on' : ''} onClick={() => { setTool(t.id); setCleanNote(null) }}>
            <span className="ph-ed-tool-ic">{t.icon}{t.ai && <i className="ph-ed-ai">✦</i>}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
