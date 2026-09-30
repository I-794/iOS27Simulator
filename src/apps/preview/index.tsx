import { useEffect, useRef, useState } from 'react'
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { ScanLine, FolderOpen, PenLine, Highlighter, Eraser, Undo2, Share, Ellipsis, FileDown, Info, Check, Camera, FileText, Image as ImageIcon, BookOpen, Type, Hash, Table, Presentation, Sparkles } from 'lucide-react'
import { NavStack, Page, useNav, BarButton } from '../../ui/nav'
import { List, Row } from '../../ui/list'
import { Button, Spinner } from '../../ui/controls'
import { Sheet, openMenu } from '../../ui/overlay'
import { useOS } from '../../os/store'
import { useAppRoute, useOnscreen } from '../../os/hooks'
import { fmtRelative, fmtDate } from '../../os/time'
import { ALL_FILES, DocPages, DocThumb, fileById, pageCount, type DemoFile } from './docs'
import './preview.css'

// ------------------------------------------------------------------ local state
interface Stroke { c: string; w: number; d: string }
interface Scan { id: string; name: string; ts: number; pages: number }
interface PreviewLocal {
  markup: Record<string, Record<number, Stroke[]>>
  scans: Scan[]
  recents: string[]
  set: (p: Partial<PreviewLocal>) => void
}
const usePreview = create<PreviewLocal>()(
  persist((set) => ({ markup: {}, scans: [], recents: ['f6', 'f4', 'f5'], set: (p) => set(p) }), {
    name: 'ios27-preview',
    storage: createJSONStorage(() => localStorage),
    partialize: (s) => ({ markup: s.markup, scans: s.scans, recents: s.recents }) as PreviewLocal,
  }),
)

/** Resolve a document id (demo file or scan) to a renderable file + display name. */
function resolveDoc(id: string): { file: DemoFile; name: string; scan?: Scan } | null {
  const scan = usePreview.getState().scans.find((s) => s.id === id)
  if (scan) {
    const base = fileById('f10')!
    return { file: base, name: scan.name, scan }
  }
  const f = fileById(id)
  return f ? { file: f, name: f.name } : null
}

const PREVIEWABLE = ALL_FILES.filter((f) => f.kind !== 'cad')

const FORMATS: { label: string; sub: string; id: string; icon: typeof FileText; isNew?: boolean }[] = [
  { label: 'PDF', sub: 'Annotate, fill forms, sign', id: 'f2', icon: FileText },
  { label: 'Images', sub: 'HEIC, JPEG, PNG, TIFF', id: 'f9', icon: ImageIcon },
  { label: 'EPUB', sub: 'Read books with page turns', id: 'x-epub', icon: BookOpen, isNew: true },
  { label: 'Rich Text (RTF)', sub: 'Styled text documents', id: 'x-rtf', icon: Type, isNew: true },
  { label: 'Markdown', sub: 'Rendered headings, lists and code', id: 'x-md', icon: Hash, isNew: true },
  { label: 'CSV', sub: 'Sortable tables', id: 'x-csv', icon: Table, isNew: true },
  { label: 'Keynote, Pages, Numbers', sub: 'Quick previews without the apps', id: 'x-key', icon: Presentation, isNew: true },
]

// ------------------------------------------------------------------ app
export default function PreviewApp() {
  return (
    <div className="app-root pv-root">
      <NavStack root={<HomePage />} />
    </div>
  )
}

function HomePage() {
  const nav = useNav()
  const recents = usePreview((s) => s.recents)
  const scans = usePreview((s) => s.scans)
  const [scanOpen, setScanOpen] = useState(false)
  useAppRoute('preview', (route) => {
    const [kind, id] = route.split('/')
    if ((kind === 'file' || kind === 'markup') && resolveDoc(id)) {
      nav.popToRoot()
      window.setTimeout(() => nav.push(<DocViewer id={id} markup={kind === 'markup'} />), 40)
    } else if (kind === 'scan') {
      nav.popToRoot()
      window.setTimeout(() => setScanOpen(true), 250)
    }
  })
  const open = (id: string) => nav.push(<DocViewer id={id} />)
  const recentDocs = [...scans.map((s) => s.id), ...recents].filter((id, i, a) => a.indexOf(id) === i && resolveDoc(id)).slice(0, 8)
  return (
    <Page title="Preview" grouped>
      <div className="pv-actions">
        <button className="pv-action" onClick={() => setScanOpen(true)}>
          <span className="pv-action-ic scan"><ScanLine size={24} /></span>
          <b>Scan Documents</b>
          <small>Auto-capture pages</small>
        </button>
        <button className="pv-action" onClick={() => nav.push(<BrowsePage />)}>
          <span className="pv-action-ic open"><FolderOpen size={24} /></span>
          <b>Open File</b>
          <small>iCloud Drive &amp; On My iPhone</small>
        </button>
      </div>
      <div className="list-header big">Recents</div>
      <div className="pv-recents">
        {recentDocs.map((id) => {
          const r = resolveDoc(id)!
          return (
            <button key={id} className="pv-recent" onClick={() => open(id)}>
              <DocThumb file={r.file} />
              <b>{r.name.replace(/\.[^.]+$/, '')}</b>
              <small>{r.scan ? fmtRelative(r.scan.ts) : fmtRelative(r.file.modified)}</small>
            </button>
          )
        })}
      </div>
      <List header={<span className="pv-fmt-h"><Sparkles size={14} /> More formats in iOS 27</span>} footer="Preview opens these formats directly — no extra apps needed.">
        {FORMATS.map((f) => {
          const I = f.icon
          return <Row key={f.label} icon={<span className="pv-fmt-ic"><I size={17} /></span>} title={<>{f.label}{f.isNew && <span className="pv-new">NEW</span>}</>} subtitle={f.sub} chevron onClick={() => open(f.id)} />
        })}
      </List>
      <ScanSheet open={scanOpen} onClose={() => setScanOpen(false)} onSaved={(id) => { setScanOpen(false); window.setTimeout(() => open(id), 300) }} />
    </Page>
  )
}

function BrowsePage() {
  const nav = useNav()
  const groups = [...new Set(PREVIEWABLE.map((f) => f.folder))]
  return (
    <Page title="Open File" grouped>
      {groups.map((g) => (
        <List key={g} header={g === 'On My iPhone' ? 'On My iPhone' : `iCloud Drive ▸ ${g}`}>
          {PREVIEWABLE.filter((f) => f.folder === g).map((f) => (
            <Row key={f.id} icon={<span className="pv-mini"><DocThumb file={f} /></span>} title={f.name} subtitle={`${fmtRelative(f.modified)} · ${f.size}`} chevron onClick={() => nav.push(<DocViewer id={f.id} />)} />
          ))}
        </List>
      ))}
    </Page>
  )
}

// ------------------------------------------------------------------ viewer + markup
const COLORS = ['#1c1c1e', '#ff3b30', '#0a84ff', '#34c759']
type Tool = 'pen' | 'highlighter' | 'eraser'

function DocViewer({ id, markup: startMarkup }: { id: string; markup?: boolean }) {
  const doc = resolveDoc(id)
  const strokes = usePreview((s) => s.markup[id])
  const [markup, setMarkup] = useState(!!startMarkup)
  const [tool, setTool] = useState<Tool>('pen')
  const [color, setColor] = useState(COLORS[1])
  const [page, setPage] = useState(1)
  const [exportOpen, setExportOpen] = useState(false)
  const [info, setInfo] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const history = useRef<{ page: number }[]>([])
  useOnscreen('preview', doc?.name, doc ? { type: 'file', title: doc.name, fileId: id } : undefined)
  useEffect(() => {
    const st = usePreview.getState()
    st.set({ recents: [id, ...st.recents.filter((x) => x !== id)].slice(0, 10) })
  }, [id])
  if (!doc) return <Page title="" large={false}><div className="empty-state">Document not found.</div></Page>
  const total = pageCount(doc.file)
  const addStroke = (pg: number, s: Stroke) => {
    const cur = usePreview.getState().markup
    const file = cur[id] ?? {}
    usePreview.getState().set({ markup: { ...cur, [id]: { ...file, [pg]: [...(file[pg] ?? []), s] } } })
    history.current.push({ page: pg })
  }
  const updateLast = (pg: number, d: string) => {
    const cur = usePreview.getState().markup
    const list = cur[id]?.[pg] ?? []
    if (!list.length) return
    usePreview.getState().set({ markup: { ...cur, [id]: { ...cur[id], [pg]: [...list.slice(0, -1), { ...list[list.length - 1], d }] } } })
  }
  const removeStroke = (pg: number, i: number) => {
    const cur = usePreview.getState().markup
    usePreview.getState().set({ markup: { ...cur, [id]: { ...cur[id], [pg]: (cur[id]?.[pg] ?? []).filter((_, j) => j !== i) } } })
  }
  const undo = () => {
    const h = history.current.pop()
    const cur = usePreview.getState().markup
    const pg = h?.page ?? Number(Object.keys(cur[id] ?? {}).reverse().find((k) => cur[id][+k].length) ?? -1)
    if (pg < 0 || !cur[id]?.[pg]?.length) return
    usePreview.getState().set({ markup: { ...cur, [id]: { ...cur[id], [pg]: cur[id][pg].slice(0, -1) } } })
  }
  const strokeCount = Object.values(strokes ?? {}).reduce((a, l) => a + l.length, 0)
  const onScroll = () => {
    const sc = scrollRef.current
    if (!sc) return
    const pages = sc.querySelectorAll('.pvd-wrap')
    const mid = sc.getBoundingClientRect().top + sc.getBoundingClientRect().height / 3
    let n = 1
    pages.forEach((p, i) => { if (p.getBoundingClientRect().top < mid) n = i + 1 })
    setPage(n)
  }
  return (
    <Page title={doc.name} large={false} bg="var(--pv-bg)" scrollRef={scrollRef} onScroll={onScroll} bottomExtra={markup ? 110 : 20}
      trailing={
        <>
          <BarButton label={markup ? 'Done Markup' : 'Markup'} onClick={() => setMarkup((m) => !m)} tinted={markup}><PenLine size={20} /></BarButton>
          <button className="bar-btn icon glass interactive" aria-label="More" onClick={(e) => openMenu(e.currentTarget, [
            { label: 'Export as PDF', icon: <FileDown size={18} />, onSelect: () => setExportOpen(true) },
            { label: 'Share', icon: <Share size={18} />, onSelect: () => useOS.getState().set({ shareRequest: { title: doc.name, kind: 'file', app: 'preview' } }) },
            { label: 'Clear Markup', icon: <Eraser size={18} />, disabled: !strokeCount, onSelect: () => { const cur = usePreview.getState().markup; const next = { ...cur }; delete next[id]; usePreview.getState().set({ markup: next }) } },
            { label: 'Get Info', icon: <Info size={18} />, separatorBefore: true, onSelect: () => setInfo(true) },
            { label: 'Show in Files', icon: <FolderOpen size={18} />, disabled: !!doc.scan, onSelect: () => useOS.getState().launch('files', { route: `file/${id}` }) },
          ])}><Ellipsis size={22} /></button>
        </>
      }
      footer={
        <>
          {total > 1 && <div className="pv-pageind glass">{page} of {total}</div>}
          {markup ? (
            <div className="pv-markup-bar glass heavy">
              <div className="pv-tools">
                <button className={tool === 'pen' ? 'on' : ''} onClick={() => setTool('pen')} aria-label="Pen"><PenLine size={20} /></button>
                <button className={tool === 'highlighter' ? 'on' : ''} onClick={() => setTool('highlighter')} aria-label="Highlighter"><Highlighter size={20} /></button>
                <button className={tool === 'eraser' ? 'on' : ''} onClick={() => setTool('eraser')} aria-label="Eraser"><Eraser size={20} /></button>
                <button onClick={undo} aria-label="Undo" disabled={!strokeCount}><Undo2 size={20} /></button>
              </div>
              <div className="pv-colors">
                {COLORS.map((c) => <button key={c} className={color === c ? 'on' : ''} style={{ background: c }} onClick={() => { setColor(c); if (tool === 'eraser') setTool('pen') }} aria-label={`Color ${c}`} />)}
              </div>
            </div>
          ) : (
            <div className="pv-bottom">
              <button className="pv-circle glass interactive" aria-label="Share" onClick={() => useOS.getState().set({ shareRequest: { title: doc.name, kind: 'file', app: 'preview' } })}><Share size={20} /></button>
              <button className="pv-export glass interactive" onClick={() => setExportOpen(true)}><FileDown size={18} /> Export as PDF</button>
            </div>
          )}
        </>
      }>
      {doc.scan && <div className="pv-scan-note"><ScanLine size={14} /> Scanned {fmtDate(doc.scan.ts, 'monthDay')} · text recognized (Live Text)</div>}
      <div className={`pv-doc ${markup ? `marking tool-${tool}` : ''}`}>
        <DocPages file={doc.file} renderOverlay={(i) => (
          <MarkupLayer key={i} strokes={strokes?.[i] ?? []} active={markup} tool={tool} color={color} onStart={(s) => addStroke(i, s)} onMove={(d) => updateLast(i, d)} onErase={(j) => removeStroke(i, j)} />
        )} />
      </div>
      <ExportSheet open={exportOpen} onClose={() => setExportOpen(false)} name={doc.name} pages={total} marks={strokeCount} />
      <Sheet open={info} onClose={() => setInfo(false)} title="Info" detent="medium">
        <List>
          <Row title="Name" detail={doc.name} />
          <Row title="Kind" detail={doc.file.kind.toUpperCase()} />
          <Row title="Pages" detail={String(total)} />
          <Row title="Size" detail={doc.scan ? '640 KB' : doc.file.size} />
          <Row title="Markup" detail={strokeCount ? `${strokeCount} annotation${strokeCount > 1 ? 's' : ''}` : 'None'} />
        </List>
      </Sheet>
    </Page>
  )
}

function MarkupLayer({ strokes, active, tool, color, onStart, onMove, onErase }: { strokes: Stroke[]; active: boolean; tool: Tool; color: string; onStart: (s: Stroke) => void; onMove: (d: string) => void; onErase: (i: number) => void }) {
  const ref = useRef<SVGSVGElement>(null)
  const cur = useRef<string | null>(null)
  const pt = (e: React.PointerEvent) => {
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ref.current!.getScreenCTM()!.inverse())
    return `${p.x.toFixed(1)} ${p.y.toFixed(1)}`
  }
  return (
    <svg
      ref={ref}
      className={`pv-markup ${active ? 'active' : ''}`}
      viewBox="0 0 850 1100"
      preserveAspectRatio="none"
      onPointerDown={(e) => {
        if (!active || tool === 'eraser') return
        ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
        cur.current = `M${pt(e)}`
        onStart({ c: tool === 'highlighter' ? (color === '#1c1c1e' ? '#ffd60a' : color) : color, w: tool === 'highlighter' ? 26 : 4, d: cur.current })
      }}
      onPointerMove={(e) => {
        if (!cur.current) return
        cur.current += ` L${pt(e)}`
        onMove(cur.current)
      }}
      onPointerUp={() => (cur.current = null)}
      aria-hidden={!active}
    >
      {strokes.map((s, i) => (
        <path
          key={i}
          d={s.d}
          stroke={s.c}
          strokeWidth={s.w}
          strokeOpacity={s.w > 10 ? 0.4 : 1}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ mixBlendMode: s.w > 10 ? 'multiply' : undefined, pointerEvents: active && tool === 'eraser' ? 'stroke' : 'none' }}
          onPointerDown={(e) => { if (active && tool === 'eraser') { e.stopPropagation(); onErase(i) } }}
        />
      ))}
    </svg>
  )
}

// ------------------------------------------------------------------ export (fast PDF saving)
function ExportSheet({ open, onClose, name, pages, marks }: { open: boolean; onClose: () => void; name: string; pages: number; marks: number }) {
  const [phase, setPhase] = useState<'options' | 'saving' | 'done'>('options')
  const [includeMarkup, setIncludeMarkup] = useState(true)
  const [optimize, setOptimize] = useState(false)
  const [secs, setSecs] = useState(0)
  useEffect(() => { if (open) setPhase('options') }, [open])
  const pdfName = name.replace(/\.[^.]+$/, '') + '.pdf'
  const run = () => {
    setPhase('saving')
    const t0 = performance.now()
    window.setTimeout(() => {
      setSecs(Math.max(0.1, (performance.now() - t0) / 1000))
      setPhase('done')
    }, 160 + pages * 20)
  }
  return (
    <Sheet open={open} onClose={onClose} title="Export as PDF" detent="auto">
      <div className="pv-export-sheet">
        <div className="pv-export-file"><FileText size={34} /><div><b>{pdfName}</b><small>{pages} page{pages > 1 ? 's' : ''}{marks ? ` · ${marks} annotation${marks > 1 ? 's' : ''}` : ''}</small></div></div>
        {phase === 'options' && (
          <>
            <List>
              <Row title="Include Markup" toggle={{ value: includeMarkup, onChange: setIncludeMarkup }} disabled={!marks} />
              <Row title="Reduce File Size" subtitle="Compresses images for sharing" toggle={{ value: optimize, onChange: setOptimize }} />
            </List>
            <div className="pv-export-actions"><Button block onClick={run}><FileDown size={18} /> Save to Files</Button></div>
          </>
        )}
        {phase === 'saving' && (
          <div className="pv-saving"><Spinner size={18} /> Saving PDF…<div className="pv-progress"><i /></div></div>
        )}
        {phase === 'done' && (
          <div className="pv-done anim-pop">
            <span className="pv-done-ic"><Check size={26} strokeWidth={3} /></span>
            <b>Saved in {secs.toFixed(1)} s</b>
            <small>“{pdfName}” saved to iCloud Drive ▸ Downloads{optimize ? ' · 38% smaller' : ''}{includeMarkup && marks ? ' · markup flattened' : ''}</small>
            <div className="pv-speed"><span>iOS 26</span><i style={{ width: '100%' }} /><em>1.4 s</em></div>
            <div className="pv-speed now"><span>iOS 27</span><i style={{ width: `${Math.max(6, secs / 1.4 * 100)}%` }} /><em>{secs.toFixed(1)} s</em></div>
            <div className="pv-export-actions row gap8">
              <Button variant="gray" onClick={() => useOS.getState().set({ shareRequest: { title: pdfName, kind: 'file', app: 'preview' } })}><Share size={17} /> Share</Button>
              <Button onClick={onClose}>Done</Button>
            </div>
          </div>
        )}
      </div>
    </Sheet>
  )
}

// ------------------------------------------------------------------ scanning
function ScanSheet({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: (id: string) => void }) {
  const [captured, setCaptured] = useState(0)
  const [flash, setFlash] = useState(false)
  const [auto, setAuto] = useState(true)
  useEffect(() => { if (open) setCaptured(0) }, [open])
  const shoot = () => {
    setFlash(true)
    window.setTimeout(() => setFlash(false), 180)
    setCaptured((c) => c + 1)
  }
  useEffect(() => {
    if (!open || !auto || captured > 0) return
    const t = window.setTimeout(shoot, 1800)
    return () => window.clearTimeout(t)
  }, [open, auto, captured])
  const save = () => {
    const st = usePreview.getState()
    const n = st.scans.length + 1
    const id = `scan-${Date.now().toString(36)}`
    st.set({ scans: [{ id, name: `Scanned Document ${n}.pdf`, ts: Date.now(), pages: captured }, ...st.scans] })
    useOS.getState().showToast('Scan saved', 'doc')
    onSaved(id)
  }
  const f10 = fileById('f10')!
  return (
    <Sheet open={open} onClose={onClose} title="Scan" detent="full" className="pv-scan-sheet" closeButton={false}
      leading={<button className="bar-btn glass interactive" onClick={onClose}>Cancel</button>}
      trailing={<button className="bar-btn glass interactive" onClick={() => setAuto((a) => !a)}>{auto ? 'Auto' : 'Manual'}</button>}>
      <div className="pv-scan">
        <div className="pv-viewfinder">
          <div className="pv-desk" />
          <div className={`pv-paper ${captured ? 'got' : ''}`}><DocThumb file={f10} /></div>
          {!captured && <div className="pv-quad" />}
          {flash && <div className="pv-flash" />}
          <div className="pv-scan-hint">{captured ? `${captured} page${captured > 1 ? 's' : ''} captured` : auto ? 'Looking for a document…' : 'Position the document in view'}</div>
        </div>
        <div className="pv-scan-controls">
          <div className="pv-scan-thumb">{captured > 0 && <><DocThumb file={f10} /><i>{captured}</i></>}</div>
          <button className="pv-shutter" onClick={shoot} aria-label="Capture page"><span /></button>
          <button className="pv-scan-save" disabled={!captured} onClick={save}>Save ({captured})</button>
        </div>
        <div className="pv-scan-camera-note"><Camera size={13} /> Simulated camera</div>
      </div>
    </Sheet>
  )
}

