import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { Newspaper, Trophy, Puzzle, Heart, Share, Bookmark, BookmarkCheck, AArrowUp, ChevronRight, Check, Plus, Sparkles, Shuffle, RotateCcw, Clock3 } from 'lucide-react'
import { NavStack, Page, useNav, TabBar, BarButton } from '../../ui/nav'
import { List, Row } from '../../ui/list'
import { SearchField, Chip, AISparkle, Segmented } from '../../ui/controls'
import { Sheet } from '../../ui/overlay'
import { Scene } from '../../art/Scene'
import { useOS } from '../../os/store'
import { useAppRoute, useOnscreen } from '../../os/hooks'
import { NEWS } from '../../os/data/media'
import { summarize } from '../../os/ai/writing'
import './news.css'

type Article = (typeof NEWS)[number]

const SCENE: Record<string, string> = { nw1: 'storm', nw2: 'robot-arena', nw3: 'night-sky', nw4: 'soccer-field', nw5: 'city-night' }
const EXTRA: Record<string, string[]> = {
  Local: ['City officials said crews would clear storm drains ahead of the rain. Residents are encouraged to secure patio furniture and check flashlights.', 'The Maple Grove school district confirmed that Thursday evening rehearsals, including the fall concert run-through, will be held in the main auditorium.', 'Forecasters expect cooler, drier air to arrive Friday, with sunshine returning for weekend events.'],
  Technology: ['Organizers credited lower-cost motors and open-source software for helping new teams get started.', 'Several schools, including Lincoln High, added after-school build nights and mentorship from local engineers.', 'The regional qualifier is expected to draw more than 60 teams next month.'],
  Science: ['The image combines data from several infrared filters, revealing dust lanes that are invisible to the human eye.', 'Researchers say the galaxy’s spiral arms are forming new stars at a surprising rate.', 'Public viewing nights at the Maple Grove observatory resume in October.'],
  Sports: ['Coaches praised the teams’ defensive discipline in the final minutes of each game.', 'Playoff brackets will be released Monday, with first-round matches on Thursday.', 'Tickets for home games are available at the school box office.'],
  Culture: ['Participating galleries will feature local photographers, ceramicists and student artists.', 'Food trucks will line Main Street from 5 to 10 PM, with live music at the plaza.', 'Organizers recommend walking or biking, as parking downtown will be limited.'],
}
const SOURCES = ['Maple Grove Gazette', 'Tech Ledger', 'The Science Desk', 'Sports Daily', 'Culture Weekly', 'Morning Brief']
const SECTIONS = ['Top Stories', 'Local', 'Technology', 'Science', 'Sports', 'Culture'] as const

interface NState { saved: string[]; following: string[]; read: string[]; textSize: number; set: (p: Partial<NState>) => void }
const useN = create<NState>()(persist((set) => ({ saved: [], following: ['Maple Grove Gazette', 'Tech Ledger', 'Sports Daily'], read: [], textSize: 1, set: (p) => set(p) }), { name: 'ios27-news', partialize: (s) => ({ saved: s.saved, following: s.following, read: s.read, textSize: s.textSize }) }))

function Hero({ a, className }: { a: Article; className?: string }) {
  return <div className={`nw-hero ${className ?? ''}`} style={{ ['--h' as string]: a.hue }}><Scene scene={SCENE[a.id] ?? 'city-night'} /><span className="nw-hero-tint" /></div>
}

function SourceMark({ s }: { s: string }) {
  const hue = [...s].reduce((a, c) => a + c.charCodeAt(0), 0) % 360
  return <span className="nw-src" style={{ color: `hsl(${hue} 70% 42%)` }}>{s.toUpperCase()}</span>
}

// ---------------------------------------------------------------- app
type Tab = 'today' | 'sports' | 'puzzles' | 'following'
type NavApi = ReturnType<typeof useNav>
function Registrar({ onNav, children }: { onNav: (n: NavApi) => void; children: ReactNode }) {
  const nav = useNav()
  useEffect(() => onNav(nav), [nav, onNav])
  return <>{children}</>
}

export default function NewsApp() {
  const [tab, setTab] = useState<Tab>('today')
  const [searching, setSearching] = useState(false)
  const navs = useRef<Partial<Record<Tab, NavApi>>>({})
  const regs = useRef<Partial<Record<Tab, (n: NavApi) => void>>>({})
  const regFor = (t: Tab) => (regs.current[t] ??= (n: NavApi) => void (navs.current[t] = n))
  useAppRoute('news', (r) => {
    if (r.startsWith('article/')) {
      const a = NEWS.find((x) => x.id === r.slice(8))
      if (a) { setTab('today'); setSearching(false); window.setTimeout(() => navs.current.today?.push(<ArticlePage a={a} />), 20) }
    } else if (r === 'puzzles') setTab('puzzles')
  })
  const roots: Record<Tab, ReactNode> = { today: <Today searching={searching} onDoneSearch={() => setSearching(false)} />, sports: <Sports />, puzzles: <Puzzles />, following: <Following /> }
  return (
    <div className="app-root nw-root">
      {(Object.keys(roots) as Tab[]).map((t) => (
        <div key={t} className="nw-pane" style={{ display: t === tab ? undefined : 'none' }} inert={t !== tab ? true : undefined}>
          <NavStack root={<Registrar onNav={regFor(t)}>{roots[t]}</Registrar>} />
        </div>
      ))}
      <TabBar
        tabs={[{ id: 'today', label: 'Today', icon: <Newspaper size={24} /> }, { id: 'sports', label: 'Sports', icon: <Trophy size={24} /> }, { id: 'puzzles', label: 'Puzzles', icon: <Puzzle size={24} /> }, { id: 'following', label: 'Following', icon: <Heart size={24} /> }]}
        value={tab}
        onChange={(t) => { if (t === tab) navs.current[t]?.popToRoot(); setTab(t); setSearching(false) }}
        onSearch={() => { setTab('today'); navs.current.today?.popToRoot(); setSearching(true) }}
        searchActive={searching}
      />
    </div>
  )
}

// ---------------------------------------------------------------- Today
function Today({ searching, onDoneSearch }: { searching: boolean; onDoneSearch: () => void }) {
  const nav = useNav()
  const [section, setSection] = useState<(typeof SECTIONS)[number]>('Top Stories')
  const [q, setQ] = useState('')
  const read = useN((s) => s.read)
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => { if (searching) input.current?.focus() }, [searching])
  const list = NEWS.filter((a) => section === 'Top Stories' || a.category === section)
  const results = q.trim() ? NEWS.filter((a) => `${a.title} ${a.body} ${a.source} ${a.category}`.toLowerCase().includes(q.trim().toLowerCase())) : []
  const [lead, ...rest] = list
  useOnscreen('news', 'News Today feed', { type: 'page', title: 'Apple News Today', text: NEWS.map((a) => a.title).join('. '), url: 'news' })
  return (
    <Page title={<span className="nw-logo"><Newspaper size={26} /> News</span>} subtitle={new Date().toLocaleDateString(undefined, { month: 'long', day: 'numeric' })} bottomExtra={70}
      trailing={searching ? <BarButton label="Done" onClick={() => { setQ(''); onDoneSearch() }}>Done</BarButton> : undefined}>
      {searching && <div className="nw-search"><SearchField ref={input} value={q} onChange={setQ} placeholder="Channels, Topics & Stories" /></div>}
      {searching && q ? (
        <div className="nw-list">
          {results.map((a) => <StoryRow key={a.id} a={a} />)}
          {!results.length && <div className="empty-state">No stories match “{q}”</div>}
        </div>
      ) : (
        <>
          <div className="nw-sections scroll-x">
            {SECTIONS.map((s) => <Chip key={s} active={s === section} onClick={() => setSection(s)}>{s}</Chip>)}
          </div>
          <div className="nw-kicker red">{section === 'Top Stories' ? 'Top Stories' : section}</div>
          {lead && (
            <button className="nw-lead anim-fade" key={lead.id + section} onClick={() => nav.push(<ArticlePage a={lead} />)}>
              <Hero a={lead} />
              <div className="nw-lead-text">
                <SourceMark s={lead.source} />
                <h2>{lead.title}</h2>
                <span className="nw-meta">{lead.time}{read.includes(lead.id) ? ' · Read' : ''}</span>
              </div>
            </button>
          )}
          <div className="nw-list">{rest.map((a) => <StoryRow key={a.id} a={a} />)}</div>
          {section === 'Top Stories' && (
            <>
              <div className="nw-kicker">For You</div>
              <div className="nw-cards scroll-x">
                {[...NEWS].reverse().map((a) => (
                  <button key={a.id} className="nw-card" onClick={() => nav.push(<ArticlePage a={a} />)}>
                    <Hero a={a} className="small" />
                    <SourceMark s={a.source} />
                    <b>{a.title}</b>
                    <span className="nw-meta">{a.time}</span>
                  </button>
                ))}
              </div>
              <button className="nw-brief" onClick={() => nav.push(<Briefing />)}>
                <AISparkle size={20} />
                <span className="grow"><b>Today’s Briefing</b><span>Summaries of your top stories</span></span>
                <ChevronRight size={18} />
              </button>
            </>
          )}
        </>
      )}
    </Page>
  )
}

function StoryRow({ a }: { a: Article }) {
  const nav = useNav()
  const read = useN((s) => s.read.includes(a.id))
  return (
    <button className={`nw-row ${read ? 'read' : ''}`} onClick={() => nav.push(<ArticlePage a={a} />)}>
      <span className="grow" style={{ textAlign: 'left' }}>
        <SourceMark s={a.source} />
        <b>{a.title}</b>
        <span className="nw-meta">{a.time} · {a.category}</span>
      </span>
      <span className="nw-thumb"><Hero a={a} /></span>
    </button>
  )
}

function Briefing() {
  const nav = useNav()
  return (
    <Page title="Today’s Briefing" bottomExtra={70}>
      <div className="nw-brief-note"><AISparkle size={14} /> Summarized with Apple Intelligence</div>
      {NEWS.map((a) => (
        <button key={a.id} className="nw-brief-item" onClick={() => nav.push(<ArticlePage a={a} />)}>
          <SourceMark s={a.source} />
          <b>{a.title}</b>
          <p>{summarize(a.body)}</p>
        </button>
      ))}
    </Page>
  )
}

// ---------------------------------------------------------------- Article (reading progress, fluid hero)
export function ArticlePage({ a }: { a: Article }) {
  const nav = useNav()
  const [top, setTop] = useState(0)
  const [prog, setProg] = useState(0)
  const [sumOpen, setSumOpen] = useState(false)
  const [textOpen, setTextOpen] = useState(false)
  const scroller = useRef<HTMLDivElement>(null)
  const saved = useN((s) => s.saved.includes(a.id))
  const size = useN((s) => s.textSize)
  const paras = useMemo(() => [a.body, ...(EXTRA[a.category] ?? [])], [a])
  const related = NEWS.filter((x) => x.id !== a.id).slice(0, 3)
  useEffect(() => {
    const t = window.setTimeout(() => { const r = useN.getState().read; if (!r.includes(a.id)) useN.getState().set({ read: [...r, a.id] }) }, 1500)
    return () => window.clearTimeout(t)
  }, [a.id])
  useOnscreen('news', `Reading: ${a.title}`, { type: 'page', title: a.title, text: paras.join(' '), url: `news.example/${a.id}` })
  return (
    <Page
      title={a.title}
      large={false}
      inlineTitle=""
      footer={<div className="nw-progress" style={{ transform: `scaleX(${prog})` }} role="progressbar" aria-valuenow={Math.round(prog * 100)} aria-label="Reading progress" />}
      scrollRef={scroller}
      onScroll={(t) => {
        setTop(t)
        const el = scroller.current
        if (el) setProg(Math.min(1, t / Math.max(1, el.scrollHeight - el.clientHeight)))
      }}
      bottomExtra={30}
      className="nw-article-page"
      trailing={<>
        <BarButton label="Text size" onClick={() => setTextOpen(true)}><AArrowUp size={20} /></BarButton>
        <BarButton label={saved ? 'Unsave' : 'Save'} onClick={() => { const s = useN.getState().saved; useN.getState().set({ saved: saved ? s.filter((x) => x !== a.id) : [...s, a.id] }); useOS.getState().showToast(saved ? 'Removed from Saved Stories' : 'Saved to Saved Stories') }}>{saved ? <BookmarkCheck size={20} /> : <Bookmark size={20} />}</BarButton>
        <BarButton label="Share" onClick={() => useOS.getState().set({ shareRequest: { title: a.title, kind: 'link', payload: `news.example/${a.id}`, app: 'news' } })}><Share size={20} /></BarButton>
      </>}
    >
      <div className="nw-art-hero" style={{ transform: `translateY(${top * 0.35}px) scale(${1 + Math.max(0, -top) / 400})`, opacity: Math.max(0.2, 1 - top / 500) }}>
        <Hero a={a} />
      </div>
      <article className="nw-article" style={{ ['--ts' as string]: size }}>
        <SourceMark s={a.source} />
        <h1>{a.title}</h1>
        <div className="nw-byline"><span>By {['Rin Adeyemi', 'Theo Brandt', 'Noor Castellanos', 'Sol Park', 'Ivy Harlan'][NEWS.indexOf(a) % 5]}</span><span><Clock3 size={12} /> {Math.max(2, Math.round(paras.join(' ').split(' ').length / 120))} min read · {a.time}</span></div>
        <button className="nw-sum-btn" onClick={() => setSumOpen(!sumOpen)}><Sparkles size={14} /> {sumOpen ? 'Hide Summary' : 'Summarize'}</button>
        {sumOpen && <div className="nw-sum anim-up"><AISparkle size={14} /> {summarize(paras.join(' '))}</div>}
        {paras.map((p, i) => <p key={i} className={i === 0 ? 'dropcap' : ''}>{p}</p>)}
        <p className="nw-end">■</p>
      </article>
      <div className="nw-kicker">More Stories</div>
      <div className="nw-list">{related.map((r) => <button key={r.id} className="nw-row" onClick={() => nav.replaceTop(<ArticlePage a={r} />)}><span className="grow" style={{ textAlign: 'left' }}><SourceMark s={r.source} /><b>{r.title}</b></span><span className="nw-thumb"><Hero a={r} /></span></button>)}</div>
      <Sheet open={textOpen} onClose={() => setTextOpen(false)} detent="auto" title="Text Size">
        <div style={{ padding: '0 20px 30px' }}>
          <Segmented options={['0.9', '1', '1.15', '1.3'] as const} labels={{ '0.9': 'A', '1': 'A', '1.15': 'A', '1.3': 'A' }} value={String(size) as '1'} onChange={(v) => useN.getState().set({ textSize: +v })} />
          <p style={{ fontSize: 17 * size, marginTop: 16 }}>Preview: The quick brown fox jumps over the lazy dog.</p>
        </div>
      </Sheet>
    </Page>
  )
}

// ---------------------------------------------------------------- Sports
function Sports() {
  const nav = useNav()
  const games = [
    { h: 'Lincoln Lynx', a: 'Westfield Wolves', hs: 2, as: 1, st: 'Final', sport: 'Soccer' },
    { h: 'Riverside Rapids', a: 'Maple Grove Mavericks', hs: 0, as: 0, st: "62'", sport: 'Soccer', live: true },
    { h: 'Lincoln Lynx', a: 'Eastbrook Eagles', hs: null, as: null, st: 'Fri 7:00 PM', sport: 'Football' },
  ]
  return (
    <Page title="Sports" bottomExtra={70}>
      <div className="nw-kicker">Scores</div>
      <div className="nw-scores scroll-x">
        {games.map((g, i) => (
          <button key={i} className="nw-score" onClick={() => useOS.getState().showToast(g.live ? 'Live Activity started' : `${g.h} vs ${g.a}`)}>
            <span className={`nw-score-st ${g.live ? 'live' : ''}`}>{g.live ? `● LIVE ${g.st}` : g.st}</span>
            <div><span>{g.h}</span><b>{g.hs ?? ''}</b></div>
            <div><span>{g.a}</span><b>{g.as ?? ''}</b></div>
            <span className="nw-meta">{g.sport}</span>
          </button>
        ))}
      </div>
      <div className="nw-kicker">Top Sports Stories</div>
      <div className="nw-list">{NEWS.filter((a) => a.category === 'Sports').map((a) => <StoryRow key={a.id} a={a} />)}</div>
      <List header="My Teams">
        <Row title="Lincoln Lynx" subtitle="High School Soccer · 9–2–1" chevron onClick={() => nav.push(<TeamPage />)} />
      </List>
    </Page>
  )
}

function TeamPage() {
  return (
    <Page title="Lincoln Lynx">
      <List header="Standings">
        {[['Lincoln Lynx', '9-2-1'], ['Westfield Wolves', '8-3-1'], ['Riverside Rapids', '7-4-1'], ['Eastbrook Eagles', '5-6-1']].map(([t, r], i) => <Row key={t} title={`${i + 1}. ${t}`} detail={r} />)}
      </List>
    </Page>
  )
}

// ---------------------------------------------------------------- Puzzles (Quartiles-lite)
const TILES = ['rob', 'ot', 'ics', 'drum', 'line', 'thun', 'der', 'storm', 'star', 'light', 'band', 'stand']
const WORDS: Record<string, number> = { robot: 2, robotics: 3, drumline: 2, thunder: 2, thunderstorm: 3, starlight: 2, bandstand: 2, storm: 1, star: 1, light: 1, band: 1, stand: 1, drum: 1, line: 1 }

function Puzzles() {
  const [picked, setPicked] = useState<number[]>([])
  const [found, setFound] = useState<string[]>([])
  const [order, setOrder] = useState(() => TILES.map((_, i) => i))
  const [shake, setShake] = useState(false)
  const word = picked.map((i) => TILES[i]).join('')
  const score = found.reduce((a, w) => a + WORDS[w] * 2, 0)
  const submit = () => {
    if (WORDS[word] && !found.includes(word)) {
      setFound([word, ...found])
      useOS.getState().showToast(`+${WORDS[word] * 2} · ${word}`)
    } else {
      setShake(true)
      window.setTimeout(() => setShake(false), 400)
    }
    setPicked([])
  }
  return (
    <Page title="Puzzles" bottomExtra={70}>
      <div className="nw-puzzle">
        <div className="nw-pz-h"><b>Quartiles</b><span>Score {score} · {found.length}/{Object.keys(WORDS).length} words</span></div>
        <div className={`nw-pz-word ${shake ? 'shake' : ''}`}>{word || 'Tap tiles to build a word'}</div>
        <div className="nw-tiles">
          {order.map((i) => (
            <button key={i} className={picked.includes(i) ? 'on' : ''} onClick={() => setPicked(picked.includes(i) ? picked.filter((x) => x !== i) : [...picked, i].slice(0, 4))}>{TILES[i]}</button>
          ))}
        </div>
        <div className="nw-pz-ctl">
          <button onClick={() => setPicked([])} aria-label="Clear"><RotateCcw size={18} /></button>
          <button className="go" onClick={submit} disabled={!picked.length}>Submit</button>
          <button onClick={() => setOrder([...order].sort(() => Math.random() - 0.5))} aria-label="Shuffle"><Shuffle size={18} /></button>
        </div>
        <div className="nw-found">{found.map((w) => <span key={w}><Check size={12} /> {w}</span>)}</div>
      </div>
      <List header="More Puzzles">
        <Row title="Crossword" subtitle="Mini · 5×5" detail="Coming tomorrow" />
        <Row title="Emoji Game" subtitle="Guess the phrase" detail="Daily" />
      </List>
    </Page>
  )
}

// ---------------------------------------------------------------- Following
function Following() {
  const following = useN((s) => s.following)
  const saved = useN((s) => s.saved)
  const nav = useNav()
  return (
    <Page title="Following" bottomExtra={70}>
      <List header="Channels">
        {SOURCES.map((s) => (
          <Row key={s} title={s} icon={<span className="nw-ch" style={{ background: `hsl(${[...s].reduce((a, c) => a + c.charCodeAt(0), 0) % 360} 60% 45%)` }}>{s[0]}</span>}
            trailing={<button className={`nw-follow ${following.includes(s) ? 'on' : ''}`} onClick={() => useN.getState().set({ following: following.includes(s) ? following.filter((x) => x !== s) : [...following, s] })} aria-label={following.includes(s) ? `Unfollow ${s}` : `Follow ${s}`}>{following.includes(s) ? <Check size={16} /> : <Plus size={16} />}</button>} />
        ))}
      </List>
      <List header={`Saved Stories (${saved.length})`}>
        {saved.length ? saved.map((id) => { const a = NEWS.find((x) => x.id === id)!; return <Row key={id} title={a.title} subtitle={a.source} chevron onClick={() => nav.push(<ArticlePage a={a} />)} /> }) : <Row title="No saved stories" subtitle="Tap the bookmark on any story" />}
      </List>
    </Page>
  )
}
