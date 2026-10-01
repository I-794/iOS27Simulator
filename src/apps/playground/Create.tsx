import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowUp, Plus, X, Image as ImageIcon, Smile, Brush, Undo2, MoreHorizontal, Download, Smartphone, Contact, Share, RotateCcw, Shuffle } from 'lucide-react'
import { Page, useNav } from '../../ui/nav'
import { Glass, AISparkle } from '../../ui/controls'
import { Sheet, openMenu, showAlert } from '../../ui/overlay'
import { useOS, uid, type ImageGen } from '../../os/store'
import { PLAYGROUND_STYLES, GenArt } from '../../art/GenImage'
import { Scene } from '../../art/Scene'
import { screenScale } from '../../os/hooks'
import { GenView, CONCEPTS, ALL_CONCEPTS, EDIT_SUGGESTIONS, STROKE_KINDS, usePG, useRemaining, consumeGeneration, GenmojiArt, type GenSpec, type Sticker, type Stroke } from './shared'
import { saveToPhotos, setWallpaper, PosterSheet } from './actions'

type Phase = 'idle' | 'creating' | 'results'
type Tool = null | 'sticker' | 'brush'
const STICKER_EMOJI = ['😎', '🎉', '⭐️', '❤️', '🔥', '🥁', '🤖', '🐶', '🌈', '👑', '🎧', '✨']

export function CreatePage({ edit, photoId, initialPrompt }: { edit?: ImageGen; photoId?: string; initialPrompt?: string }) {
  const nav = useNav()
  const remaining = useRemaining()
  const photos = useOS((s) => s.photos)
  const genmoji = usePG((s) => s.genmoji)
  const [concepts, setConcepts] = useState<string[]>([])
  const [text, setText] = useState(initialPrompt ?? '')
  const [style, setStyle] = useState<string>(edit?.style ?? 'Animation')
  const [source, setSource] = useState<string | undefined>(edit?.source ?? (photoId ? photos.find((p) => p.id === photoId)?.scene : undefined))
  const [sourceLabel, setSourceLabel] = useState<string | undefined>(photoId ? photos.find((p) => p.id === photoId)?.description : undefined)
  const [phase, setPhase] = useState<Phase>(edit ? 'results' : 'idle')
  const [base, setBase] = useState(edit?.prompt ?? '')
  const [seeds, setSeeds] = useState<number[]>(edit ? [edit.seed] : [])
  const [sel, setSel] = useState(0)
  const [edits, setEdits] = useState<string[]>(edit?.edits ?? [])
  const [savedId, setSavedId] = useState<string | null>(edit?.id ?? null)
  const [tool, setTool] = useState<Tool>(null)
  const [stickerPick, setStickerPick] = useState<{ emoji?: string; genmoji?: string }>({ emoji: '😎' })
  const [stickers, setStickers] = useState<Sticker[]>(edit ? usePG.getState().stickers[edit.id] ?? [] : [])
  const [strokes, setStrokes] = useState<Stroke[]>(edit ? usePG.getState().strokes[edit.id] ?? [] : [])
  const [pendingStroke, setPendingStroke] = useState<Stroke | null>(null)
  const [drawing, setDrawing] = useState<string>('')
  const [history, setHistory] = useState<{ edits: string[]; stickers: Sticker[]; strokes: Stroke[] }[]>([])
  const [photoPick, setPhotoPick] = useState(false)
  const [poster, setPoster] = useState<string | null>(null)
  const canvasRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (photoId) {
      const p = photos.find((x) => x.id === photoId)
      if (p) { setConcepts(conceptsForPhoto(p.keywords, p.pets)); }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const prompt = useMemo(() => [text.trim(), ...concepts.map((c) => ALL_CONCEPTS.find((x) => x.label === c)?.frag ?? c)].filter(Boolean).join(', '), [text, concepts])
  const spec = (i = sel): GenSpec => ({ prompt: base, style, seed: seeds[i] ?? 1, source, edits })

  const snapshot = () => setHistory((h) => [...h.slice(-20), { edits, stickers, strokes }])

  const generate = () => {
    if (!prompt && !source) {
      showAlert({ title: 'Add a Description', message: 'Describe an image or choose a few concepts to get started.', actions: [{ label: 'OK' }] })
      return
    }
    if (!consumeGeneration()) {
      showAlert({ title: 'Daily Limit Reached', message: 'You’ve reached today’s Image Playground limit. More generations will be available tomorrow.', actions: [{ label: 'OK' }] })
      return
    }
    ;(document.activeElement as HTMLElement | null)?.blur?.()
    setPhase('creating')
    setBase(prompt || (sourceLabel ?? 'photo'))
    setEdits([])
    setStickers([])
    setStrokes([])
    setHistory([])
    setSavedId(null)
    setTool(null)
    window.setTimeout(() => {
      const r = Math.floor(Math.random() * 100000)
      setSeeds([r, r + 17, r + 31, r + 58])
      setSel(0)
      setPhase('results')
      setText('')
    }, 1900)
  }

  const applyEdit = (e: string) => {
    const t = e.trim()
    if (!t) return
    if (!consumeGeneration()) {
      showAlert({ title: 'Daily Limit Reached', message: 'Try again tomorrow.', actions: [{ label: 'OK' }] })
      return
    }
    ;(document.activeElement as HTMLElement | null)?.blur?.()
    snapshot()
    setText('')
    setPhase('creating')
    window.setTimeout(() => {
      setEdits((x) => [...x, t.toLowerCase()])
      setPhase('results')
    }, 1100)
  }

  const reStyle = (s: string) => {
    setStyle(s)
    if (phase === 'results') {
      setPhase('creating')
      window.setTimeout(() => setPhase('results'), 900)
    }
  }

  /** Persist the selected image to store.imageGens (+ local stickers/strokes). */
  const ensureSaved = (): ImageGen => {
    const st = useOS.getState()
    const g: ImageGen = { id: savedId ?? uid('gen'), prompt: base, style, seed: seeds[sel] ?? 1, ts: Date.now(), source, edits }
    const others = st.imageGens.filter((x) => x.id !== g.id)
    st.set({ imageGens: [g, ...others] })
    const pg = usePG.getState()
    pg.set({ stickers: { ...pg.stickers, [g.id]: stickers }, strokes: { ...pg.strokes, [g.id]: strokes } })
    setSavedId(g.id)
    return g
  }

  const moreMenu = (el: HTMLElement) =>
    openMenu(el, [
      { label: 'Save to Photos', icon: <Download size={18} />, onSelect: () => saveToPhotos(ensureSaved()) },
      { label: 'Set as Lock Screen', icon: <Smartphone size={18} />, onSelect: () => setWallpaper(ensureSaved()) },
      { label: 'Create Contact Poster', icon: <Contact size={18} />, onSelect: () => setPoster(ensureSaved().id) },
      { label: 'Share', icon: <Share size={18} />, onSelect: () => { const g = ensureSaved(); useOS.getState().set({ shareRequest: { title: g.prompt, kind: 'photo', payload: `gen:${g.id}`, app: 'playground' } }) } },
      { label: 'Start Over', icon: <RotateCcw size={18} />, separatorBefore: true, onSelect: () => { setPhase('idle'); setSeeds([]); setEdits([]); setStickers([]); setStrokes([]); setSavedId(null); setSource(undefined); setConcepts([]) } },
    ])

  // ---------- touch-based modification ----------
  const toPct = (clientX: number, clientY: number) => {
    const r = canvasRef.current!.getBoundingClientRect()
    return [Math.max(0, Math.min(100, ((clientX - r.left) / r.width) * 100)), Math.max(0, Math.min(100, ((clientY - r.top) / r.height) * 100))] as [number, number]
  }
  const onCanvasDown = (e: React.PointerEvent) => {
    if (phase !== 'results' || !tool) return
    const target = e.target as HTMLElement
    const sid = target.closest('[data-sticker]')?.getAttribute('data-sticker')
    if (tool === 'sticker') {
      e.preventDefault()
      if (sid) {
        // drag existing sticker
        snapshot()
        const move = (ev: PointerEvent) => { const [x, y] = toPct(ev.clientX, ev.clientY); setStickers((s) => s.map((k) => (k.id === sid ? { ...k, x, y } : k))) }
        const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up) }
        window.addEventListener('pointermove', move)
        window.addEventListener('pointerup', up)
        return
      }
      const [x, y] = toPct(e.clientX, e.clientY)
      snapshot()
      setStickers((s) => [...s, { id: uid('stk'), ...stickerPick, x, y, s: 16 }])
      return
    }
    if (tool === 'brush') {
      e.preventDefault()
      const pts: [number, number][] = [toPct(e.clientX, e.clientY)]
      let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`
      setDrawing(d)
      const move = (ev: PointerEvent) => {
        const p = toPct(ev.clientX, ev.clientY)
        const last = pts[pts.length - 1]
        if (Math.hypot(p[0] - last[0], p[1] - last[1]) < 1.2 / screenScale()) return
        pts.push(p)
        d += ` L${p[0].toFixed(1)} ${p[1].toFixed(1)}`
        setDrawing(d)
      }
      const up = () => {
        window.removeEventListener('pointermove', move)
        window.removeEventListener('pointerup', up)
        setDrawing('')
        if (pts.length < 3) return
        const step = Math.max(1, Math.floor(pts.length / 5))
        setPendingStroke({ id: uid('str'), d, kind: 'Flowers', pts: pts.filter((_p, i) => i % step === 0).slice(0, 6) })
      }
      window.addEventListener('pointermove', move)
      window.addEventListener('pointerup', up)
    }
  }

  const undo = () => {
    const last = history[history.length - 1]
    if (!last) return
    setEdits(last.edits)
    setStickers(last.stickers)
    setStrokes(last.strokes)
    setHistory((h) => h.slice(0, -1))
  }

  const done = () => {
    if (phase === 'results') {
      ensureSaved()
      useOS.getState().showToast('Saved to Image Playground')
    }
    nav.pop()
  }

  const results = phase === 'results'
  const selectedSpec = results || phase === 'creating' ? spec() : null

  return (
    <Page
      large={false}
      title="New Image"
      className="pg-create"
      bg="var(--pg-bg)"
      inlineTitle={<span className="row gap6"><AISparkle size={16} /> Image Playground</span>}
      trailing={
        <>
          {results && <button className="bar-btn icon glass interactive" aria-label="More" onClick={(e) => moreMenu(e.currentTarget)}><MoreHorizontal size={22} /></button>}
          <button className="bar-btn prominent" onClick={done}>{results ? 'Done' : 'Cancel'}</button>
        </>
      }
      bottomExtra={160}
      footer={
        <div className="pg-bottom">
          {results && !tool && (
            <div className="pg-edit-chips scroll">
              {EDIT_SUGGESTIONS.map((s) => <button key={s} className="pg-chip glass interactive" onClick={() => applyEdit(s)}>{s}</button>)}
            </div>
          )}
          {!results && concepts.length > 0 && (
            <div className="pg-selected scroll">
              {source && <span className="pg-sel-chip src"><ImageIcon size={13} /> Photo <button aria-label="Remove photo" onClick={() => { setSource(undefined); setSourceLabel(undefined) }}><X size={12} /></button></span>}
              {concepts.map((c) => {
                const k = ALL_CONCEPTS.find((x) => x.label === c)
                return <span key={c} className="pg-sel-chip">{k?.emoji ?? '✦'} {c}<button aria-label={`Remove ${c}`} onClick={() => setConcepts((x) => x.filter((y) => y !== c))}><X size={12} /></button></span>
              })}
            </div>
          )}
          <div className="row gap8">
            <button className="pg-round glass interactive" aria-label="Add" onClick={(e) => openMenu(e.currentTarget, [
              { label: 'Choose Photo', icon: <ImageIcon size={18} />, onSelect: () => setPhotoPick(true) },
              { label: 'Suggested Concepts', icon: <Shuffle size={18} />, onSelect: () => setConcepts((c) => [...new Set([...c, ALL_CONCEPTS[Math.floor(Math.random() * ALL_CONCEPTS.length)].label])]) },
            ])}><Plus size={22} /></button>
            <Glass className="pg-input grow" variant="heavy">
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') (results ? applyEdit(text) : generate()) }}
                placeholder={results ? 'Describe a change…' : source ? 'Describe how to transform it…' : 'Describe an image'}
                enterKeyHint="go"
                aria-label={results ? 'Describe a change' : 'Describe an image'}
                data-dictation={results ? 'make it sunset|add sunglasses|put it in space' : 'Biscuit as an astronaut|a robot playing drums|Seattle in the rain'}
              />
              <button className="pg-go" aria-label={results ? 'Apply change' : 'Create'} disabled={phase === 'creating' || (!text.trim() && (results || (!concepts.length && !source)))} onClick={() => (results ? applyEdit(text) : generate())}>
                <ArrowUp size={18} strokeWidth={3} />
              </button>
            </Glass>
          </div>
          <div className="pg-styles scroll">
            {PLAYGROUND_STYLES.map((s) => (
              <button key={s} className={`pg-style ${style === s ? 'on' : ''}`} onClick={() => reStyle(s)}>
                <span className="pg-style-thumb">
                  {source && s !== 'Photorealistic'
                    ? <GenView g={{ prompt: 'x', style: s, seed: 3, source, edits: [] }} />
                    : <GenArt prompt={base || prompt || 'Biscuit dog'} artStyle={s} seed={11} source={source} />}
                </span>
                <span>{s}{s === 'Photorealistic' && <i className="pg-new">NEW</i>}</span>
              </button>
            ))}
          </div>
        </div>
      }
    >
      <div className="pg-stage">
        <div className="pg-limit"><AISparkle size={12} /> {remaining} of 50 generations left today</div>

        {phase === 'idle' && (
          <div className="pg-idle">
            <div className="pg-orbit">
              <div className="pg-orbit-glow" />
              {source ? (
                <div className="pg-source anim-pop"><Scene scene={source} /><span>Transform this photo</span></div>
              ) : concepts.length ? (
                concepts.slice(0, 6).map((c, i) => {
                  const k = ALL_CONCEPTS.find((x) => x.label === c)
                  const a = (i / Math.max(1, Math.min(6, concepts.length))) * Math.PI * 2 - Math.PI / 2
                  return <span key={c} className="pg-bubble anim-pop" style={{ left: `${50 + Math.cos(a) * 30}%`, top: `${50 + Math.sin(a) * 30}%`, animationDelay: `${i * 60}ms` }}>{k?.emoji ?? '✦'}<small>{c}</small></span>
                })
              ) : (
                <div className="pg-hint"><AISparkle size={30} /><div className="t-headline">Describe an image</div><div className="t-footnote secondary">or pick concepts below — like Biscuit, a robot, or Seattle</div></div>
              )}
            </div>
            <div className="pg-concepts">
              {CONCEPTS.map((g) => (
                <div key={g.group}>
                  <div className="pg-concept-h">{g.group}</div>
                  <div className="pg-concept-row">
                    {g.items.map((k) => {
                      const on = concepts.includes(k.label)
                      return <button key={k.label} className={`pg-concept ${on ? 'on' : ''}`} onClick={() => setConcepts((c) => (on ? c.filter((x) => x !== k.label) : [...c, k.label]))}><span>{k.emoji}</span>{k.label}</button>
                    })}
                  </div>
                </div>
              ))}
            </div>
            <button className="btn filled pg-create-btn" disabled={!prompt && !source} onClick={generate}><AISparkle size={17} color="#fff" /> Create</button>
          </div>
        )}

        {(phase === 'creating' || results) && selectedSpec && (
          <div className="pg-result">
            <div
              ref={canvasRef}
              className={`pg-canvas ${tool ? `tool-${tool}` : ''}`}
              onPointerDown={onCanvasDown}
            >
              <GenView g={selectedSpec} stickers={stickers} strokes={strokes} badge />
              {drawing && <svg className="pg-strokes" viewBox="0 0 100 100" preserveAspectRatio="none"><path d={drawing} stroke="#fff" strokeOpacity=".8" fill="none" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" style={{ strokeWidth: 22 }} /></svg>}
              {phase === 'creating' && (
                <div className="pg-creating">
                  <div className="pg-creating-blob" />
                  <div className="pg-creating-text"><AISparkle size={18} color="#fff" /> {seeds.length ? 'Updating…' : 'Creating…'}</div>
                </div>
              )}
            </div>
            {results && seeds.length > 1 && (
              <div className="pg-variants">
                {seeds.map((s, i) => (
                  <button key={s} className={`pg-variant ${i === sel ? 'on' : ''}`} aria-label={`Variation ${i + 1}`} onClick={() => setSel(i)}>
                    <GenView g={{ ...spec(i) }} variant={i * 6} />
                  </button>
                ))}
              </div>
            )}
            {results && (
              <div className="pg-tools">
                <button className={tool === 'sticker' ? 'on' : ''} onClick={() => setTool(tool === 'sticker' ? null : 'sticker')}><Smile size={18} /> Stickers</button>
                <button className={tool === 'brush' ? 'on' : ''} onClick={() => setTool(tool === 'brush' ? null : 'brush')}><Brush size={18} /> Brush</button>
                <button onClick={undo} disabled={!history.length}><Undo2 size={18} /> Undo</button>
              </div>
            )}
            {tool === 'sticker' && (
              <div className="pg-sticker-row scroll anim-fade">
                {STICKER_EMOJI.map((e) => <button key={e} className={stickerPick.emoji === e ? 'on' : ''} onClick={() => setStickerPick({ emoji: e })}>{e}</button>)}
                {genmoji.map((g) => <button key={g.id} className={stickerPick.genmoji === g.prompt ? 'on' : ''} onClick={() => setStickerPick({ genmoji: g.prompt })}><GenmojiArt prompt={g.prompt} seed={7} size={28} /></button>)}
              </div>
            )}
            {tool && <div className="pg-tool-hint t-footnote secondary">{tool === 'sticker' ? 'Tap the image to place a sticker · drag to move it' : 'Brush over an area to change it'}</div>}
            {results && edits.length > 0 && !tool && (
              <div className="pg-edits">{edits.map((e, i) => <span key={i}>✦ {e}</span>)}</div>
            )}
          </div>
        )}
      </div>

      <Sheet open={!!pendingStroke} onClose={() => setPendingStroke(null)} detent="auto" title="Change This Area To…">
        <div className="pg-brush-opts">
          {STROKE_KINDS.map((k) => (
            <button key={k} onClick={() => { snapshot(); setStrokes((s) => [...s, { ...pendingStroke!, kind: k }]); setPendingStroke(null) }}>{k}</button>
          ))}
        </div>
      </Sheet>
      <Sheet open={photoPick} onClose={() => setPhotoPick(false)} title="Choose a Photo to Transform" detent="large">
        <div className="pg-photo-grid">
          {photos.filter((p) => !p.hidden && !p.idDocument && p.kind !== 'video').slice(0, 36).map((p) => (
            <button key={p.id} aria-label={p.description} onClick={() => { setSource(p.scene); setSourceLabel(p.description); setConcepts(conceptsForPhoto(p.keywords, p.pets)); setPhotoPick(false); setPhase('idle'); setSeeds([]) }}><Scene scene={p.scene} /></button>
          ))}
        </div>
      </Sheet>
      <PosterSheet genId={poster} onClose={() => setPoster(null)} />
    </Page>
  )
}

function conceptsForPhoto(keywords: string[], pets?: string[]): string[] {
  const out: string[] = []
  if (pets?.includes('Biscuit')) out.push('Biscuit')
  if (pets?.includes('Mochi')) out.push('Mochi')
  const k = keywords.join(' ')
  if (/robot/.test(k)) out.push('Robot')
  if (/drum/.test(k)) out.push('Drums')
  if (/beach|ocean/.test(k)) out.push('Beach')
  if (/snow|winter/.test(k)) out.push('Winter')
  if (/mountain/.test(k)) out.push('Mountains')
  if (/city|skyline/.test(k)) out.push('Seattle')
  return out.slice(0, 3)
}

