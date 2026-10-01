import { useEffect, useMemo, useRef, useState } from 'react'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { Ellipsis, Plus, Check, X, Newspaper, ChevronRight } from 'lucide-react'
import { Page, NavStack, useNav, BarButton } from '../../ui/nav'
import { SearchField } from '../../ui/controls'
import { Sheet, openMenu } from '../../ui/overlay'
import { useOS } from '../../os/store'
import { useAppRoute, useLongPress, useOnscreen } from '../../os/hooks'
import { STOCKS, NEWS } from '../../os/data/media'
import './stocks.css'

type Stock = (typeof STOCKS)[number]
const EXTRA: Stock[] = [
  { sym: 'GRNF', name: 'Greenfield Outfitters', price: 58.73, change: 0.88 },
  { sym: 'BREW', name: 'Brew Lab Holdings', price: 22.41, change: -0.35 },
  { sym: 'RSTR', name: 'Rosa’s Restaurant Group', price: 14.02, change: 0.12 },
  { sym: 'PDPT', name: 'Parts Depot Inc.', price: 77.9, change: 1.44 },
]
const ALL = [...STOCKS, ...EXTRA]
const RANGES = ['1D', '1W', '1M', '6M', 'YTD', '1Y', '5Y'] as const
type Range = (typeof RANGES)[number]

interface SState { watch: string[]; mode: 'pct' | 'chg' | 'cap'; set: (p: Partial<SState>) => void }
const useS = create<SState>()(persist((set) => ({ watch: STOCKS.map((s) => s.sym), mode: 'pct', set: (p) => set(p) }), { name: 'ios27-stocks', partialize: (s) => ({ watch: s.watch, mode: s.mode }) }))

// live prices: small random walk every few seconds
const useLive = create<{ px: Record<string, number>; tick: number }>(() => ({ px: Object.fromEntries(ALL.map((s) => [s.sym, s.price])), tick: 0 }))
let liveStarted = false
function startLive() {
  if (liveStarted) return
  liveStarted = true
  window.setInterval(() => {
    const px = { ...useLive.getState().px }
    for (const s of ALL) if (Math.random() < 0.5) px[s.sym] = +(px[s.sym] * (1 + (Math.random() - 0.5) * 0.0016)).toFixed(2)
    useLive.setState({ px, tick: useLive.getState().tick + 1 })
  }, 3000)
}

function seeded(seed: number) {
  let s = seed >>> 0
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296)
}

const quote = (s: Stock, px: number) => {
  const prev = s.price / (1 + s.change / 100)
  const chg = px - prev
  return { prev, chg, pct: (chg / prev) * 100 }
}

function series(s: Stock, range: Range, last: number): { v: number; t: string }[] {
  const n = range === '1D' ? 78 : range === '1W' ? 70 : range === '1M' ? 22 : range === '6M' ? 126 : range === 'YTD' ? 190 : range === '1Y' ? 252 : 260
  const rnd = seeded([...s.sym].reduce((a, c) => a * 31 + c.charCodeAt(0), 7) + range.length * 101 + range.charCodeAt(0))
  const drift = range === '1D' ? s.change / 100 : range === '1W' ? 0.02 : range === '1M' ? -0.03 : range === '6M' ? 0.08 : range === 'YTD' ? 0.15 : range === '1Y' ? 0.22 : 0.9
  const vol = range === '1D' ? 0.0022 : range === '5Y' ? 0.03 : 0.012
  const pts: number[] = [1]
  for (let i = 1; i < n; i++) pts.push(pts[i - 1] * (1 + (rnd() - 0.5) * 2 * vol + drift / n))
  const k = last / pts[n - 1]
  const now = new Date()
  return pts.map((p, i) => {
    let t: string
    if (range === '1D') { const m = 9 * 60 + 30 + i * 5; t = `${((Math.floor(m / 60) + 11) % 12) + 1}:${String(m % 60).padStart(2, '0')} ${m >= 720 ? 'PM' : 'AM'}` }
    else if (range === '1W') t = new Date(now.getTime() - ((n - 1 - i) / 14) * 86400000).toLocaleDateString(undefined, { weekday: 'short', hour: 'numeric' })
    else if (range === '5Y') t = new Date(now.getTime() - (n - 1 - i) * 7 * 86400000).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })
    else t = new Date(now.getTime() - (n - 1 - i) * 86400000 * (range === '1M' ? 1.4 : 1.4)).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: range === '1Y' ? 'numeric' : undefined })
    return { v: +(p * k).toFixed(2), t }
  })
}

function Spark({ s, px }: { s: Stock; px: number }) {
  const d = useMemo(() => series(s, '1D', px), [s, px])
  const up = px >= quote(s, px).prev
  const min = Math.min(...d.map((x) => x.v), quote(s, px).prev)
  const max = Math.max(...d.map((x) => x.v), quote(s, px).prev)
  const y = (v: number) => 30 - ((v - min) / (max - min || 1)) * 28
  const prevY = y(quote(s, px).prev)
  return (
    <svg width="72" height="32" viewBox="0 0 72 32" aria-hidden className="st-spark">
      <line x1="0" x2="72" y1={prevY} y2={prevY} stroke="var(--label-tertiary)" strokeDasharray="1 2" />
      <polyline points={d.map((p, i) => `${(i / (d.length - 1)) * 72},${y(p.v)}`).join(' ')} fill="none" stroke={up ? '#30d158' : '#ff453a'} strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  )
}

const fmt = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// ---------------------------------------------------------------- app
export default function StocksApp() {
  useEffect(() => startLive(), [])
  const [sel, setSel] = useState<string | null>(null)
  const landscape = useOS((s) => s.orientation === 'landscape')
  useAppRoute('stocks', (r) => { if (r.startsWith('symbol/')) setSel(r.slice(7).toUpperCase()) })
  const stock = ALL.find((s) => s.sym === sel)
  return (
    <div className={`app-root st-root ${landscape ? 'split' : ''}`}>
      <div className="st-list-pane"><NavStack root={<Watchlist onOpen={setSel} selected={landscape ? sel : null} />} /></div>
      {landscape ? (
        <div className="st-detail-pane">{stock ? <Detail s={stock} key={stock.sym} /> : <div className="empty-state">Select a symbol</div>}</div>
      ) : (
        <Sheet open={!!stock} onClose={() => setSel(null)} detent="large" className="st-sheet" closeButton={false}
          leading={<span />}
          trailing={<button className="bar-btn icon glass interactive" aria-label="Close" onClick={() => setSel(null)}><X size={20} /></button>}
          label={stock?.name}>
          {stock && <Detail s={stock} key={stock.sym} />}
        </Sheet>
      )}
    </div>
  )
}

function Watchlist({ onOpen, selected }: { onOpen: (s: string) => void; selected: string | null }) {
  const watch = useS((s) => s.watch)
  const [q, setQ] = useState('')
  const [editing, setEditing] = useState(false)
  const nav = useNav()
  const results = q.trim() ? ALL.filter((s) => `${s.sym} ${s.name}`.toLowerCase().includes(q.trim().toLowerCase())) : []
  useOnscreen('stocks', 'Stocks watchlist', { type: 'page', title: 'Stocks', text: watch.join(', '), url: 'stocks' })
  return (
    <Page title="Stocks" subtitle={new Date().toLocaleDateString(undefined, { month: 'long', day: 'numeric' })} bottomExtra={10} className="st-page"
      trailing={<>
        {editing && <BarButton label="Done" onClick={() => setEditing(false)}>Done</BarButton>}
        {!editing && <button className="bar-btn icon glass interactive" aria-label="More" onClick={(e) => openMenu(e.currentTarget, [
          { label: 'Edit Watchlist', onSelect: () => setEditing(true) },
          { label: 'Show Percentage Change', onSelect: () => useS.getState().set({ mode: 'pct' }) },
          { label: 'Show Price Change', onSelect: () => useS.getState().set({ mode: 'chg' }) },
          { label: 'Show Market Cap', onSelect: () => useS.getState().set({ mode: 'cap' }) },
          { label: 'Business News', separatorBefore: true, onSelect: () => nav.push(<BizNews />) },
        ])}><Ellipsis size={20} /></button>}
      </>}>
      <div className="st-search"><SearchField value={q} onChange={setQ} placeholder="Search" /></div>
      {q ? (
        <div className="st-results">
          {results.map((s) => {
            const inList = watch.includes(s.sym)
            return (
              <div key={s.sym} className="st-res">
                <button className="grow" style={{ textAlign: 'left' }} onClick={() => onOpen(s.sym)}><b>{s.sym}</b><span>{s.name}</span></button>
                <button className={`st-add ${inList ? 'on' : ''}`} aria-label={inList ? `Remove ${s.sym}` : `Add ${s.sym}`} onClick={() => useS.getState().set({ watch: inList ? watch.filter((x) => x !== s.sym) : [...watch, s.sym] })}>{inList ? <Check size={16} /> : <Plus size={16} />}</button>
              </div>
            )
          })}
          {!results.length && <div className="empty-state">No results</div>}
        </div>
      ) : (
        <>
          <div className="st-group-h">My Symbols</div>
          <div className="st-rows">
            {watch.map((sym, i) => {
              const s = ALL.find((x) => x.sym === sym)
              return s ? <StockRow key={sym} s={s} onOpen={() => onOpen(sym)} selected={selected === sym} editing={editing} index={i} /> : null
            })}
          </div>
          <button className="st-news-link" onClick={() => nav.push(<BizNews />)}><Newspaper size={18} /> <span className="grow">Top Stories</span><span className="st-muted">From Apple News</span><ChevronRight size={16} /></button>
          <div className="st-disclaimer">Fictional tickers · simulated quotes</div>
        </>
      )}
    </Page>
  )
}

function StockRow({ s, onOpen, selected, editing, index }: { s: Stock; onOpen: () => void; selected: boolean; editing: boolean; index: number }) {
  const px = useLive((l) => l.px[s.sym])
  const mode = useS((st) => st.mode)
  const q = quote(s, px)
  const up = q.chg >= 0
  const [flash, setFlash] = useState<'' | 'up' | 'down'>('')
  const prev = useRef(px)
  useEffect(() => {
    if (px !== prev.current) {
      setFlash(px > prev.current ? 'up' : 'down')
      const t = window.setTimeout(() => setFlash(''), 700)
      prev.current = px
      return () => window.clearTimeout(t)
    }
  }, [px])
  const lp = useLongPress((el) => openMenu(el, [
    { label: 'Remove from Watchlist', destructive: true, onSelect: () => useS.getState().set({ watch: useS.getState().watch.filter((x) => x !== s.sym) }) },
    { label: 'Move to Top', onSelect: () => useS.getState().set({ watch: [s.sym, ...useS.getState().watch.filter((x) => x !== s.sym)] }) },
  ]))
  const cap = (px * (s.sym.length * 97 + 120)) / 1000
  const move = (d: number) => {
    const w = [...useS.getState().watch]
    const j = index + d
    if (j < 0 || j >= w.length) return
    ;[w[index], w[j]] = [w[j], w[index]]
    useS.getState().set({ watch: w })
  }
  return (
    <div className={`st-row ${selected ? 'sel' : ''}`} {...(editing ? {} : lp)}>
      {editing && <button className="st-del" aria-label={`Remove ${s.sym}`} onClick={() => useS.getState().set({ watch: useS.getState().watch.filter((x) => x !== s.sym) })}>−</button>}
      <button className="st-row-main" onClick={onOpen} disabled={editing}>
        <span className="st-row-l"><b>{s.sym}</b><span>{s.name}</span></span>
        {!editing && <Spark s={s} px={px} />}
      </button>
      {editing ? (
        <span className="st-move"><button onClick={() => move(-1)} aria-label="Move up">↑</button><button onClick={() => move(1)} aria-label="Move down">↓</button></span>
      ) : (
        <span className="st-row-r">
          <b className={`st-px ${flash}`}>{fmt(px)}</b>
          <button className={`st-pill ${up ? 'up' : 'down'}`} onClick={() => useS.getState().set({ mode: mode === 'pct' ? 'chg' : mode === 'chg' ? 'cap' : 'pct' })} aria-label="Toggle change display">
            {mode === 'pct' ? `${up ? '+' : ''}${q.pct.toFixed(2)}%` : mode === 'chg' ? `${up ? '+' : ''}${q.chg.toFixed(2)}` : `${cap.toFixed(1)}B`}
          </button>
        </span>
      )}
    </div>
  )
}

// ---------------------------------------------------------------- detail with smooth scrubbing
function Detail({ s }: { s: Stock }) {
  const [range, setRange] = useState<Range>('1D')
  const px = useLive((l) => l.px[s.sym])
  const data = useMemo(() => series(s, range, px), [s, range, px])
  const [hover, setHover] = useState<number | null>(null)
  const [article, setArticle] = useState<{ title: string; source: string; body: string } | null>(null)
  const watch = useS((st) => st.watch)
  const box = useRef<HTMLDivElement>(null)
  const q = quote(s, px)
  const first = range === '1D' ? q.prev : data[0].v
  const shownV = hover !== null ? data[hover].v : px
  const chg = shownV - first
  const pct = (chg / first) * 100
  const up = (hover !== null ? chg : range === '1D' ? q.chg : px - first) >= 0
  const W = 360
  const H = 190
  const min = Math.min(...data.map((d) => d.v), first)
  const max = Math.max(...data.map((d) => d.v), first)
  const X = (i: number) => (i / (data.length - 1)) * W
  const Y = (v: number) => 8 + (1 - (v - min) / (max - min || 1)) * (H - 16)
  const path = data.map((d, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)} ${Y(d.v).toFixed(1)}`).join(' ')
  const color = up ? '#30d158' : '#ff453a'
  const pick = (clientX: number) => {
    const r = box.current!.getBoundingClientRect()
    const f = Math.min(1, Math.max(0, (clientX - r.left) / r.width))
    setHover(Math.round(f * (data.length - 1)))
  }
  const stories = [
    { title: `${s.name} shares ${s.change >= 0 ? 'climb' : 'slip'} as analysts weigh fall outlook`, source: 'Market Wire (Demo)', body: `${s.name} (${s.sym}) ${s.change >= 0 ? 'gained' : 'lost'} ground today as investors reacted to updated guidance. Analysts at several fictional firms said demand looks steady heading into the holiday quarter.` },
    { title: `What ${s.sym}’s latest earnings mean for investors`, source: 'Tech Ledger', body: `Revenue for ${s.name} came in slightly ahead of expectations. Management highlighted new products and cost controls. This is simulated demo content, not investment advice.` },
    ...NEWS.filter((n) => n.category === 'Technology' || n.category === 'Local').slice(0, 1).map((n) => ({ title: n.title, source: n.source, body: n.body })),
  ]
  const hi = Math.max(...data.map((d) => d.v))
  const lo = Math.min(...data.map((d) => d.v))
  useOnscreen('stocks', `${s.sym} quote`, { type: 'page', title: `${s.name} (${s.sym})`, text: `${s.sym} ${fmt(px)} ${q.pct.toFixed(2)}%`, url: `stocks/${s.sym}` })
  return (
    <div className="st-detail">
      <div className="st-d-head">
        <div className="grow"><h2>{s.sym}</h2><span>{s.name}</span></div>
        <button className={`st-add ${watch.includes(s.sym) ? 'on' : ''}`} onClick={() => useS.getState().set({ watch: watch.includes(s.sym) ? watch.filter((x) => x !== s.sym) : [...watch, s.sym] })} aria-label={watch.includes(s.sym) ? 'Remove from watchlist' : 'Add to watchlist'}>{watch.includes(s.sym) ? <Check size={16} /> : <Plus size={16} />}</button>
      </div>
      <div className="st-d-price">
        <b>{fmt(shownV)}</b>
        <span className={up ? 'up' : 'down'}>{chg >= 0 ? '+' : ''}{chg.toFixed(2)} ({pct >= 0 ? '+' : ''}{pct.toFixed(2)}%)</span>
        <em>{hover !== null ? data[hover].t : range === '1D' ? 'Market Open · Live' : `Past ${range}`}</em>
      </div>
      <div className="st-ranges" role="tablist">
        {RANGES.map((r) => <button key={r} role="tab" aria-selected={r === range} className={r === range ? 'on' : ''} onClick={() => { setRange(r); setHover(null) }}>{r}</button>)}
      </div>
      <div
        ref={box}
        className="st-chart"
        role="slider"
        aria-label="Price chart scrubber"
        aria-valuemin={0}
        aria-valuemax={data.length - 1}
        aria-valuenow={hover ?? data.length - 1}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft') setHover((h) => Math.max(0, (h ?? data.length) - 1))
          if (e.key === 'ArrowRight') setHover((h) => Math.min(data.length - 1, (h ?? data.length - 2) + 1))
          if (e.key === 'Escape') setHover(null)
        }}
        onPointerDown={(e) => {
          e.stopPropagation()
          pick(e.clientX)
          const move = (ev: PointerEvent) => pick(ev.clientX)
          const up2 = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up2); setHover(null) }
          window.addEventListener('pointermove', move)
          window.addEventListener('pointerup', up2)
        }}
      >
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" width="100%" height={H}>
          <defs>
            <linearGradient id={`st-g-${s.sym}`} x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor={color} stopOpacity=".32" /><stop offset="1" stopColor={color} stopOpacity="0" /></linearGradient>
          </defs>
          <line x1="0" x2={W} y1={Y(first)} y2={Y(first)} stroke="var(--label-tertiary)" strokeDasharray="2 4" vectorEffect="non-scaling-stroke" />
          <path d={`${path} L${W} ${H} L0 ${H} Z`} fill={`url(#st-g-${s.sym})`} opacity={hover !== null ? 0.6 : 1} />
          <path d={path} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" className="st-line" key={range} />
          {hover !== null && <path d={data.slice(hover).map((d, i) => `${i ? 'L' : 'M'}${X(hover + i).toFixed(1)} ${Y(d.v).toFixed(1)}`).join(' ')} fill="none" stroke="var(--label-tertiary)" strokeWidth="2" vectorEffect="non-scaling-stroke" />}
        </svg>
        {hover !== null && (
          <>
            <div className="st-cursor" style={{ left: `${(hover / (data.length - 1)) * 100}%` }} />
            <div className="st-dot" style={{ left: `${(hover / (data.length - 1)) * 100}%`, top: Y(data[hover].v), background: color }} />
          </>
        )}
      </div>
      <div className="st-stats">
        {[['Open', fmt(first * 1.001)], ['High', fmt(hi)], ['Low', fmt(lo)], ['Vol', `${(s.sym.length * 3.1 + 2).toFixed(1)}M`], ['P/E', (18 + s.sym.length * 2.3).toFixed(2)], ['Mkt Cap', `${((px * (s.sym.length * 97 + 120)) / 1000).toFixed(1)}B`], ['52W H', fmt(px * 1.21)], ['52W L', fmt(px * 0.74)], ['Yield', `${(s.sym.length * 0.31).toFixed(2)}%`]].map(([k, v]) => (
          <div key={k}><span>{k}</span><b>{v}</b></div>
        ))}
      </div>
      <div className="st-news-h">Related News</div>
      {stories.map((n) => (
        <button key={n.title} className="st-story" onClick={() => setArticle(n)}>
          <span className="st-story-src">{n.source}</span>
          <b>{n.title}</b>
          <span className="st-muted">{Math.round(n.title.length / 9)}h ago</span>
        </button>
      ))}
      <Sheet open={!!article} onClose={() => setArticle(null)} title={article?.source} detent="large">
        {article && <div className="st-article"><h2>{article.title}</h2><p>{article.body}</p><p className="st-muted">Simulated story for a fictional company. Not investment advice.</p></div>}
      </Sheet>
    </div>
  )
}

function BizNews() {
  return (
    <Page title="Business News" className="st-page">
      {NEWS.map((n) => (
        <button key={n.id} className="st-story wide" onClick={() => useOS.getState().launch('news', { route: `article/${n.id}` })}>
          <span className="st-story-src">{n.source}</span><b>{n.title}</b><span className="st-muted">{n.time}</span>
        </button>
      ))}
    </Page>
  )
}
