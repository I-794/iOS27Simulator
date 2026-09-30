import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { House, Library, Play, Pause, RotateCcw, RotateCw, Plus, Check, Ellipsis, Moon, Captions, ListOrdered, Share, ChevronDown, Clock3, Mic, Sparkles, ChevronRight, Airplay } from 'lucide-react'
import { NavStack, Page, useNav, TabBar, BarButton } from '../../ui/nav'
import { List, Row } from '../../ui/list'
import { SearchField, Chip, Slider } from '../../ui/controls'
import { Sheet, openMenu } from '../../ui/overlay'
import { useOS } from '../../os/store'
import { useAppRoute, useOnscreen } from '../../os/hooks'
import { PODCASTS } from '../../os/data/media'
import { DAY } from '../../os/time'
import { useShell } from '../../shell/shellState'
import './podcasts.css'

type Show = (typeof PODCASTS)[number]
type Episode = Show['episodes'][number]

// ---------------------------------------------------------------- local state
interface PodState {
  progress: Record<string, number>
  played: Record<string, boolean>
  following: string[]
  speed: number
  sleepAt: number | null
  set: (p: Partial<PodState>) => void
}
const usePod = create<PodState>()(persist((set) => ({
  progress: { ep1: 780, ep5: 1210 },
  played: { ep3: true },
  following: ['pod-build', 'pod-freq', 'pod-daily'],
  speed: 1,
  sleepAt: null,
  set: (p) => set(p),
}), { name: 'ios27-podcasts', partialize: (s) => ({ progress: s.progress, played: s.played, following: s.following, speed: s.speed }) }))

const showOf = (epId: string) => PODCASTS.find((p) => p.episodes.some((e) => e.id === epId))
const epById = (epId: string) => showOf(epId)?.episodes.find((e) => e.id === epId)

const fmt = (s: number) => {
  s = Math.max(0, Math.floor(s))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}` : `${m}:${String(sec).padStart(2, '0')}`
}
const fmtLeft = (s: number) => {
  const m = Math.round(s / 60)
  return m >= 60 ? `${Math.floor(m / 60)} hr ${m % 60} min left` : `${m} min left`
}
const fmtLen = (s: number) => {
  const m = Math.round(s / 60)
  return m >= 60 ? `${Math.floor(m / 60)} hr ${m % 60} min` : `${m} min`
}
const epDate = (d: number) => (d === 0 ? 'Today' : d === -1 ? 'Yesterday' : new Date(Date.now() + d * DAY).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }))

/** Transcript split into timestamped sentences spread over the episode. */
function transcriptLines(ep: Episode): { t: number; text: string }[] {
  const sentences = ep.transcript.split(/(?<=[.!?])\s+/).filter(Boolean)
  const intro = 42
  return sentences.map((text, i) => ({ t: Math.round(intro + ((ep.duration - intro - 60) * i) / sentences.length), text }))
}

// ---------------------------------------------------------------- playback
function currentPos(): number {
  const np = useOS.getState().nowPlaying
  const speed = usePod.getState().speed
  return np.playing ? np.position + ((Date.now() - np.updatedAt) / 1000) * speed : np.position
}

function playEpisode(ep: Episode, at?: number) {
  const st = useOS.getState()
  const show = showOf(ep.id)!
  let np = st.nowPlaying
  // stop music synth first (the engine ignores podcast state)
  if (np.kind === 'music' && np.playing) {
    st.togglePlay()
    np = useOS.getState().nowPlaying
  }
  if (np.kind === 'podcast' && np.episodeId) usePod.getState().set({ progress: { ...usePod.getState().progress, [np.episodeId]: currentPos() } })
  const start = at ?? (usePod.getState().played[ep.id] ? 0 : usePod.getState().progress[ep.id] ?? 0)
  useOS.getState().set({ nowPlaying: { ...useOS.getState().nowPlaying, kind: 'podcast', podcastId: show.id, episodeId: ep.id, position: start, updatedAt: Date.now(), playing: true, dismissed: false, source: show.title } })
}

function togglePodcast() {
  const st = useOS.getState()
  const np = st.nowPlaying
  const pos = currentPos()
  if (np.episodeId) usePod.getState().set({ progress: { ...usePod.getState().progress, [np.episodeId]: pos } })
  st.set({ nowPlaying: { ...np, playing: !np.playing, position: pos, updatedAt: Date.now() } })
}

function seekPodcast(pos: number) {
  const np = useOS.getState().nowPlaying
  const ep = np.episodeId ? epById(np.episodeId) : undefined
  if (!ep) return
  useOS.getState().set({ nowPlaying: { ...np, position: Math.max(0, Math.min(ep.duration - 1, pos)), updatedAt: Date.now() } })
}

function setSpeed(speed: number) {
  const np = useOS.getState().nowPlaying
  const pos = currentPos()
  useOS.getState().set({ nowPlaying: { ...np, position: pos, updatedAt: Date.now() } })
  usePod.getState().set({ speed })
}

function usePodPos(ms = 500) {
  const np = useOS((s) => s.nowPlaying)
  const speed = usePod((s) => s.speed)
  const [, force] = useState(0)
  useEffect(() => {
    if (!np.playing) return
    const t = window.setInterval(() => force((n) => n + 1), ms)
    return () => window.clearInterval(t)
  }, [np.playing, ms])
  return np.playing ? np.position + ((Date.now() - np.updatedAt) / 1000) * speed : np.position
}

// end-of-episode + sleep timer + periodic progress save
let daemon = false
function startDaemon() {
  if (daemon) return
  daemon = true
  window.setInterval(() => {
    const np = useOS.getState().nowPlaying
    if (np.kind !== 'podcast' || !np.playing || !np.episodeId) return
    const ep = epById(np.episodeId)
    if (!ep) return
    const pos = currentPos()
    const ps = usePod.getState()
    ps.set({ progress: { ...ps.progress, [ep.id]: pos } })
    if (pos >= ep.duration) {
      ps.set({ played: { ...ps.played, [ep.id]: true }, progress: { ...ps.progress, [ep.id]: 0 } })
      useOS.getState().set({ nowPlaying: { ...np, playing: false, position: ep.duration, updatedAt: Date.now() } })
    }
    if (ps.sleepAt && Date.now() >= ps.sleepAt) {
      ps.set({ sleepAt: null })
      togglePodcast()
      useOS.getState().showToast('Sleep timer ended — paused')
    }
  }, 1000)
}

// ---------------------------------------------------------------- art
function ShowArt({ show, size = 120, radius }: { show: Show; size?: number | string; radius?: number }) {
  const icon = show.category === 'Technology' ? '⚙︎' : show.category === 'Music' ? '♫' : '☀︎'
  return (
    <div className="pc-art" style={{ width: size, height: size, borderRadius: radius ?? (typeof size === 'number' ? size * 0.12 : 14), ['--h' as string]: show.hue }} aria-hidden>
      <svg viewBox="0 0 100 100" width="100%" height="100%">
        <defs>
          <linearGradient id={`pc-g-${show.id}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={`hsl(${show.hue} 85% 58%)`} />
            <stop offset="1" stopColor={`hsl(${(show.hue + 40) % 360} 75% 30%)`} />
          </linearGradient>
        </defs>
        <rect width="100" height="100" fill={`url(#pc-g-${show.id})`} />
        {Array.from({ length: 5 }).map((_, i) => <circle key={i} cx="78" cy="22" r={8 + i * 9} fill="none" stroke="#fff" strokeOpacity={0.28 - i * 0.05} strokeWidth="1.6" />)}
        <text x="10" y="30" fontSize="18" fill="#fff" opacity=".9">{icon}</text>
        <text x="9" y="78" fontFamily="var(--font-display)" fontWeight="800" fontSize={show.title.length > 12 ? 11 : 13} fill="#fff">{show.title.toUpperCase()}</text>
        <text x="9" y="90" fontFamily="var(--font-text)" fontWeight="600" fontSize="6" fill="#fff" opacity=".75">{show.author.toUpperCase()}</text>
      </svg>
    </div>
  )
}

// ---------------------------------------------------------------- app
type Tab = 'home' | 'library' | 'search'
type NavApi = ReturnType<typeof useNav>

function Registrar({ onNav, children }: { onNav: (n: NavApi) => void; children: ReactNode }) {
  const nav = useNav()
  useEffect(() => onNav(nav), [nav, onNav])
  return <>{children}</>
}

export default function PodcastsApp() {
  const [tab, setTab] = useState<Tab>('home')
  const [player, setPlayer] = useState(false)
  const navs = useRef<Partial<Record<Tab, NavApi>>>({})
  const regs = useRef<Partial<Record<Tab, (n: NavApi) => void>>>({})
  const regFor = (t: Tab) => (regs.current[t] ??= (n: NavApi) => void (navs.current[t] = n))
  const np = useOS((s) => s.nowPlaying)
  const ep = np.kind === 'podcast' && np.episodeId ? epById(np.episodeId) : undefined
  useEffect(() => startDaemon(), [])
  useOnscreen('podcasts', ep ? `Listening to ${ep.title}` : 'Browsing Podcasts', ep ? { type: 'page', title: ep.title, text: ep.transcript, url: `podcasts.example/${ep.id}` } : undefined)

  useAppRoute('podcasts', (r) => {
    if (r === 'player' || r === 'nowplaying') setPlayer(true)
    else if (r.startsWith('show/')) navs.current[tab]?.push(<ShowPage id={r.slice(5)} onPlayer={() => setPlayer(true)} />)
    else if (r.startsWith('episode/')) {
      const e = epById(r.slice(8))
      if (e) navs.current[tab]?.push(<EpisodePage ep={e} onPlayer={() => setPlayer(true)} />)
    }
  })

  const choose = (t: Tab) => {
    if (t === tab) navs.current[t]?.popToRoot()
    setTab(t)
  }
  const open = () => setPlayer(true)
  const roots: Record<Tab, ReactNode> = {
    home: <HomeTab onPlayer={open} />,
    library: <LibraryTab onPlayer={open} />,
    search: <SearchTab onPlayer={open} />,
  }
  return (
    <div className="app-root pc-root">
      {(Object.keys(roots) as Tab[]).map((t) => (
        <div key={t} className="pc-pane" style={{ display: t === tab ? undefined : 'none' }} inert={t !== tab ? true : undefined}>
          <NavStack root={<Registrar onNav={regFor(t)}>{roots[t]}</Registrar>} />
        </div>
      ))}
      {ep && <MiniPlayer ep={ep} onOpen={open} />}
      <TabBar
        tabs={[{ id: 'home', label: 'Home', icon: <House size={24} /> }, { id: 'library', label: 'Library', icon: <Library size={24} /> }]}
        value={tab === 'search' ? 'home' : tab}
        onChange={(t) => choose(t as Tab)}
        onSearch={() => choose('search')}
        searchActive={tab === 'search'}
      />
      <Player open={player} onClose={() => setPlayer(false)} />
    </div>
  )
}

function MiniPlayer({ ep, onOpen }: { ep: Episode; onOpen: () => void }) {
  const show = showOf(ep.id)!
  const playing = useOS((s) => s.nowPlaying.playing)
  const pos = usePodPos(1000)
  return (
    <div className="pc-mini glass anim-up" role="button" tabIndex={0} onClick={onOpen} onKeyDown={(e) => e.key === 'Enter' && onOpen()} aria-label={`Now playing ${ep.title}`}>
      <ShowArt show={show} size={40} radius={8} />
      <div className="grow">
        <div className="pc-mini-title nowrap">{ep.title}</div>
        <div className="pc-mini-sub nowrap">{epDate(ep.date)} · {fmtLeft(ep.duration - pos)}</div>
      </div>
      <button aria-label={playing ? 'Pause' : 'Play'} onClick={(e) => { e.stopPropagation(); togglePodcast() }}>{playing ? <Pause size={22} fill="currentColor" strokeWidth={0} /> : <Play size={22} fill="currentColor" strokeWidth={0} />}</button>
      <button aria-label="Skip forward 30 seconds" onClick={(e) => { e.stopPropagation(); seekPodcast(currentPos() + 30) }}><RotateCw size={22} /></button>
      <div className="pc-mini-progress"><div style={{ width: `${(pos / ep.duration) * 100}%` }} /></div>
    </div>
  )
}

// ---------------------------------------------------------------- episode row
function EpisodeRow({ ep, showShow, onPlayer, highlight }: { ep: Episode; showShow?: boolean; onPlayer: () => void; highlight?: ReactNode }) {
  const nav = useNav()
  const np = useOS((s) => s.nowPlaying)
  const progress = usePod((s) => s.progress[ep.id])
  const played = usePod((s) => s.played[ep.id])
  const show = showOf(ep.id)!
  const current = np.kind === 'podcast' && np.episodeId === ep.id
  const pos = current ? currentPos() : progress ?? 0
  return (
    <div className="pc-ep">
      <button className="pc-ep-main" onClick={() => nav.push(<EpisodePage ep={ep} onPlayer={onPlayer} />)}>
        {showShow && <ShowArt show={show} size={54} radius={8} />}
        <span className="grow" style={{ minWidth: 0 }}>
          <span className="pc-ep-date">{epDate(ep.date)}{showShow ? ` · ${show.title}` : ''}</span>
          <span className="pc-ep-title">{ep.title}</span>
          {highlight ?? <span className="pc-ep-sum">{ep.summary}</span>}
        </span>
      </button>
      <div className="pc-ep-foot">
        <button className={`pc-ep-play ${current && np.playing ? 'on' : ''}`} onClick={() => (current ? togglePodcast() : playEpisode(ep))} aria-label={current && np.playing ? `Pause ${ep.title}` : `Play ${ep.title}`}>
          {current && np.playing ? <Pause size={13} fill="currentColor" strokeWidth={0} /> : <Play size={13} fill="currentColor" strokeWidth={0} />}
          {pos > 0 && !played ? <span className="pc-ep-bar"><i style={{ width: `${(pos / ep.duration) * 100}%` }} /></span> : null}
          <span>{played ? 'Played' : pos > 0 ? fmtLeft(ep.duration - pos) : fmtLen(ep.duration)}</span>
        </button>
        <span className="grow" />
        <button className="pc-ep-more" aria-label="More" onClick={(e) => openMenu(e.currentTarget, [
          { label: played ? 'Mark as Unplayed' : 'Mark as Played', icon: <Check size={18} />, onSelect: () => usePod.getState().set({ played: { ...usePod.getState().played, [ep.id]: !played } }) },
          { label: 'Play Next', icon: <ListOrdered size={18} />, onSelect: () => useOS.getState().showToast('Added to Up Next') },
          { label: 'Go to Show', icon: <ChevronRight size={18} />, onSelect: () => nav.push(<ShowPage id={show.id} onPlayer={onPlayer} />) },
          { label: 'Share Episode…', icon: <Share size={18} />, onSelect: () => useOS.getState().set({ shareRequest: { title: ep.title, kind: 'link', payload: `podcasts.example/${ep.id}`, app: 'podcasts' } }) },
        ])}><Ellipsis size={18} /></button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- tabs
function HomeTab({ onPlayer }: { onPlayer: () => void }) {
  const nav = useNav()
  const progress = usePod((s) => s.progress)
  const played = usePod((s) => s.played)
  const following = usePod((s) => s.following)
  const upNext = PODCASTS.filter((p) => following.includes(p.id)).flatMap((p) => p.episodes.filter((e) => !played[e.id]).slice(0, 1))
  const inProgress = PODCASTS.flatMap((p) => p.episodes).filter((e) => (progress[e.id] ?? 0) > 0 && !played[e.id])
  const cards = [...inProgress, ...upNext.filter((e) => !inProgress.includes(e))]
  return (
    <Page title="Home" bottomExtra={140} trailing={<BarButton label="Account" onClick={() => useOS.getState().showToast('Signed in as Jamie Park')}><span className="pc-avatar">JP</span></BarButton>}>
      <div className="pc-shelf-head"><span>Up Next</span></div>
      <div className="pc-cards scroll-x">
        {cards.map((e) => {
          const show = showOf(e.id)!
          const pos = progress[e.id] ?? 0
          return (
            <div key={e.id} className="pc-card" style={{ ['--h' as string]: show.hue }}>
              <button className="pc-card-top" onClick={() => nav.push(<EpisodePage ep={e} onPlayer={onPlayer} />)}>
                <ShowArt show={show} size={64} radius={10} />
                <span className="pc-card-kicker">{pos > 0 ? 'RESUME' : epDate(e.date).toUpperCase()}</span>
                <span className="pc-card-title">{e.title}</span>
                <span className="pc-card-sum">{e.summary}</span>
              </button>
              <button className="pc-card-play" onClick={() => playEpisode(e)}>
                <Play size={13} fill="currentColor" strokeWidth={0} />
                {pos > 0 && <span className="pc-ep-bar light"><i style={{ width: `${(pos / e.duration) * 100}%` }} /></span>}
                {pos > 0 ? fmtLeft(e.duration - pos) : fmtLen(e.duration)}
              </button>
            </div>
          )
        })}
      </div>
      <div className="pc-shelf-head"><span>Your Shows</span></div>
      <div className="pc-shows scroll-x">
        {PODCASTS.map((p) => (
          <button key={p.id} className="pc-show-tile" onClick={() => nav.push(<ShowPage id={p.id} onPlayer={onPlayer} />)}>
            <ShowArt show={p} size={140} />
            <span className="nowrap pc-show-name">{p.title}</span>
            <span className="nowrap pc-show-sub">{p.category} · Updated {epDate(Math.max(...p.episodes.map((e) => e.date)))}</span>
          </button>
        ))}
      </div>
      <div className="pc-shelf-head"><span>Latest Episodes</span></div>
      <div className="pc-list">
        {PODCASTS.flatMap((p) => p.episodes).sort((a, b) => b.date - a.date).slice(0, 5).map((e) => <EpisodeRow key={e.id} ep={e} showShow onPlayer={onPlayer} />)}
      </div>
    </Page>
  )
}

function LibraryTab({ onPlayer }: { onPlayer: () => void }) {
  const nav = useNav()
  const following = usePod((s) => s.following)
  const played = usePod((s) => s.played)
  const progress = usePod((s) => s.progress)
  const all = PODCASTS.flatMap((p) => p.episodes)
  return (
    <Page title="Library" bottomExtra={140}>
      <List>
        <Row title="Shows" icon={<span className="pc-lib-ic"><Mic size={20} /></span>} detail={following.length} chevron onClick={() => nav.push(<ShowsList onPlayer={onPlayer} />)} />
        <Row title="Saved" icon={<span className="pc-lib-ic"><Plus size={20} /></span>} detail={Object.keys(progress).length} chevron onClick={() => nav.push(<EpList title="Saved" eps={all.filter((e) => progress[e.id])} onPlayer={onPlayer} />)} />
        <Row title="Downloaded" icon={<span className="pc-lib-ic"><RotateCw size={20} /></span>} detail={3} chevron onClick={() => nav.push(<EpList title="Downloaded" eps={all.slice(0, 3)} onPlayer={onPlayer} />)} />
        <Row title="Latest Episodes" icon={<span className="pc-lib-ic"><Clock3 size={20} /></span>} chevron onClick={() => nav.push(<EpList title="Latest Episodes" eps={[...all].sort((a, b) => b.date - a.date)} onPlayer={onPlayer} />)} />
        <Row title="Played" icon={<span className="pc-lib-ic"><Check size={20} /></span>} detail={Object.values(played).filter(Boolean).length} chevron onClick={() => nav.push(<EpList title="Played" eps={all.filter((e) => played[e.id])} onPlayer={onPlayer} />)} />
      </List>
      <div className="pc-shelf-head"><span>Recently Updated</span></div>
      <div className="pc-grid">
        {PODCASTS.filter((p) => following.includes(p.id)).map((p) => (
          <button key={p.id} className="pc-show-tile" onClick={() => nav.push(<ShowPage id={p.id} onPlayer={onPlayer} />)}>
            <ShowArt show={p} size="100%" radius={12} />
            <span className="nowrap pc-show-name">{p.title}</span>
          </button>
        ))}
      </div>
    </Page>
  )
}

function ShowsList({ onPlayer }: { onPlayer: () => void }) {
  const nav = useNav()
  return (
    <Page title="Shows" bottomExtra={140}>
      <div className="pc-grid">
        {PODCASTS.map((p) => (
          <button key={p.id} className="pc-show-tile" onClick={() => nav.push(<ShowPage id={p.id} onPlayer={onPlayer} />)}>
            <ShowArt show={p} size="100%" radius={12} />
            <span className="nowrap pc-show-name">{p.title}</span>
            <span className="nowrap pc-show-sub">{p.episodes.length} episodes</span>
          </button>
        ))}
      </div>
    </Page>
  )
}

function EpList({ title, eps, onPlayer }: { title: string; eps: Episode[]; onPlayer: () => void }) {
  return (
    <Page title={title} bottomExtra={140}>
      <div className="pc-list">{eps.map((e) => <EpisodeRow key={e.id} ep={e} showShow onPlayer={onPlayer} />)}</div>
      {!eps.length && <div className="empty-state">No episodes</div>}
    </Page>
  )
}

function SearchTab({ onPlayer }: { onPlayer: () => void }) {
  const nav = useNav()
  const [q, setQ] = useState('')
  const s = q.trim().toLowerCase()
  const shows = s ? PODCASTS.filter((p) => `${p.title} ${p.author} ${p.category} ${p.description}`.toLowerCase().includes(s)) : []
  const eps = s ? PODCASTS.flatMap((p) => p.episodes).filter((e) => `${e.title} ${e.summary} ${e.transcript}`.toLowerCase().includes(s)) : []
  return (
    <Page title="Search" bottomExtra={140}>
      <div className="pc-search"><SearchField value={q} onChange={setQ} placeholder="Shows, Episodes and Transcripts" /></div>
      {!s && (
        <>
          <div className="pc-shelf-head"><span>Browse Categories</span></div>
          <div className="pc-cats">
            {[['Technology', 30], ['Music', 280], ['News', 210], ['Education', 150], ['Comedy', 50], ['Science', 250]].map(([c, h]) => (
              <button key={c} className="pc-cat" style={{ ['--h' as string]: h }} onClick={() => setQ(String(c))}>{c}</button>
            ))}
          </div>
        </>
      )}
      {shows.length > 0 && (
        <List header="Shows">
          {shows.map((p) => <Row key={p.id} title={p.title} subtitle={p.author} icon={<ShowArt show={p} size={48} radius={8} />} chevron onClick={() => nav.push(<ShowPage id={p.id} onPlayer={onPlayer} />)} />)}
        </List>
      )}
      {eps.length > 0 && (
        <>
          <div className="pc-shelf-head"><span>Episodes</span></div>
          <div className="pc-list">{eps.map((e) => <EpisodeRow key={e.id} ep={e} showShow onPlayer={onPlayer} highlight={<Snippet ep={e} q={s} />} />)}</div>
        </>
      )}
      {s && !shows.length && !eps.length && <div className="empty-state">No results for “{q}”</div>}
    </Page>
  )
}

function Snippet({ ep, q }: { ep: Episode; q: string }) {
  const line = transcriptLines(ep).find((l) => l.text.toLowerCase().includes(q))
  if (!line) return <span className="pc-ep-sum">{ep.summary}</span>
  return <span className="pc-ep-sum"><Mark text={line.text} q={q} /></span>
}

function Mark({ text, q }: { text: string; q: string }) {
  if (!q) return <>{text}</>
  const terms = q.split(/\s+/).filter((w) => w.length > 1).map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  if (!terms.length) return <>{text}</>
  const re = new RegExp(`(${terms.join('|')})`, 'gi')
  return <>{text.split(re).map((part, i) => (i % 2 ? <mark key={i} className="pc-mark">{part}</mark> : <span key={i}>{part}</span>))}</>
}

// ---------------------------------------------------------------- show page (iOS 27 search within show)
function ShowPage({ id, onPlayer }: { id: string; onPlayer: () => void }) {
  const show = PODCASTS.find((p) => p.id === id) ?? PODCASTS[0]
  const following = usePod((s) => s.following.includes(show.id))
  const [q, setQ] = useState('')
  const [scroll, setScroll] = useState(0)
  const [sort, setSort] = useState<'Newest' | 'Oldest'>('Newest')
  const s = q.trim().toLowerCase()
  const results = useMemo(() => {
    if (!s) return []
    const terms = s.split(/\s+/).filter(Boolean)
    return show.episodes
      .map((ep) => {
        const titleHit = terms.every((t) => `${ep.title} ${ep.summary}`.toLowerCase().includes(t))
        const lines = transcriptLines(ep).filter((l) => terms.some((t) => l.text.toLowerCase().includes(t)))
        return { ep, titleHit, lines }
      })
      .filter((r) => r.titleHit || r.lines.length)
  }, [s, show])
  const eps = [...show.episodes].sort((a, b) => (sort === 'Newest' ? b.date - a.date : a.date - b.date))
  const latest = show.episodes.reduce((a, b) => (b.date > a.date ? b : a))
  return (
    <Page title={show.title} large={false} inlineTitle={scroll > 280 ? show.title : ''} onScroll={setScroll} bottomExtra={140} className="pc-show-page"
      bg={`linear-gradient(180deg, hsl(${show.hue} 45% 40%) 0, hsl(${(show.hue + 30) % 360} 35% 24%) 420px, var(--system-background) 560px)`}
      trailing={<BarButton label="More" onClick={() => useOS.getState().set({ shareRequest: { title: show.title, kind: 'link', payload: `podcasts.example/show/${show.id}`, app: 'podcasts' } })}><Share size={20} /></BarButton>}>
      <div className="pc-show-head">
        <ShowArt show={show} size={200} radius={16} />
        <h1>{show.title}</h1>
        <div className="pc-show-author">{show.author}</div>
        <div className="pc-show-actions">
          <button className="pc-show-play" onClick={() => { playEpisode(latest); onPlayer() }}><Play size={16} fill="currentColor" strokeWidth={0} /> Latest Episode</button>
          <button className="pc-show-follow glass interactive" aria-label={following ? 'Unfollow' : 'Follow'} onClick={() => {
            const f = usePod.getState().following
            usePod.getState().set({ following: following ? f.filter((x) => x !== show.id) : [...f, show.id] })
            useOS.getState().showToast(following ? 'Unfollowed' : 'Following — new episodes will appear in Up Next')
          }}>{following ? <Check size={20} /> : <Plus size={20} />}</button>
        </div>
        <p className="pc-show-desc">{show.description}</p>
        <div className="pc-show-meta">{show.category} · Updated {epDate(latest.date)} · ★ 4.{7 + (show.title.length % 3)}</div>
      </div>
      <div className="pc-show-body">
        <div className="pc-within">
          <SearchField value={q} onChange={setQ} placeholder={`Search in ${show.title}`} mic={false} />
          {!s && <div className="pc-within-hint"><Sparkles size={13} /> Search episode titles and full transcripts</div>}
        </div>
        {s ? (
          <div className="pc-results anim-fade">
            <div className="pc-results-count">{results.length ? `${results.reduce((a, r) => a + Math.max(1, r.lines.length), 0)} matches in ${results.length} episode${results.length > 1 ? 's' : ''}` : `No matches for “${q}” in this show`}</div>
            {results.map(({ ep, lines, titleHit }) => (
              <div key={ep.id} className="pc-result">
                <div className="pc-ep-date">{epDate(ep.date)} · {fmtLen(ep.duration)}</div>
                <div className="pc-ep-title"><Mark text={ep.title} q={titleHit ? s : ''} /></div>
                {lines.map((l) => (
                  <button key={l.t} className="pc-hit" onClick={() => { playEpisode(ep, l.t); onPlayer(); useOS.getState().showToast(`Jumped to ${fmt(l.t)}`) }}>
                    <span className="pc-hit-time"><Play size={10} fill="currentColor" strokeWidth={0} /> {fmt(l.t)}</span>
                    <span className="pc-hit-text">“<Mark text={l.text} q={s} />”</span>
                  </button>
                ))}
                {!lines.length && <button className="pc-hit" onClick={() => { playEpisode(ep, 0); onPlayer() }}><span className="pc-hit-time"><Play size={10} fill="currentColor" strokeWidth={0} /> 0:00</span><span className="pc-hit-text">{ep.summary}</span></button>}
              </div>
            ))}
          </div>
        ) : (
          <>
            <div className="pc-eps-head">
              <span>Episodes</span>
              <button onClick={(e) => openMenu(e.currentTarget, [{ label: 'Newest to Oldest', onSelect: () => setSort('Newest') }, { label: 'Oldest to Newest', onSelect: () => setSort('Oldest') }])}>{sort} <ChevronRight size={14} style={{ transform: 'rotate(90deg)' }} /></button>
            </div>
            <div className="pc-list">{eps.map((e) => <EpisodeRow key={e.id} ep={e} onPlayer={onPlayer} />)}</div>
            <List header="Information">
              <Row title="Creator" detail={show.author} />
              <Row title="Category" detail={show.category} />
              <Row title="Episodes" detail={show.episodes.length} />
              <Row title="Transcripts" detail="Available" />
            </List>
          </>
        )}
      </div>
    </Page>
  )
}

// ---------------------------------------------------------------- episode page
function EpisodePage({ ep, onPlayer }: { ep: Episode; onPlayer: () => void }) {
  const nav = useNav()
  const show = showOf(ep.id)!
  const np = useOS((s) => s.nowPlaying)
  const current = np.kind === 'podcast' && np.episodeId === ep.id
  const lines = transcriptLines(ep)
  return (
    <Page title="" large={false} bottomExtra={140} className="pc-epi-page">
      <div className="pc-epi-head">
        <button onClick={() => nav.push(<ShowPage id={show.id} onPlayer={onPlayer} />)}><ShowArt show={show} size={150} radius={14} /></button>
        <div className="pc-ep-date">{epDate(ep.date)} · {fmtLen(ep.duration)}</div>
        <h1>{ep.title}</h1>
        <button className="pc-show-author accent" onClick={() => nav.push(<ShowPage id={show.id} onPlayer={onPlayer} />)}>{show.title}</button>
        <button className="pc-show-play wide" onClick={() => { if (current) togglePodcast(); else { playEpisode(ep); onPlayer() } }}>
          {current && np.playing ? <><Pause size={16} fill="currentColor" strokeWidth={0} /> Pause</> : <><Play size={16} fill="currentColor" strokeWidth={0} /> {current ? 'Resume' : 'Play Episode'}</>}
        </button>
      </div>
      <div className="pc-epi-body">
        <p>{ep.summary} {show.description}</p>
        <div className="pc-shelf-head"><span>Transcript</span></div>
        <div className="pc-transcript">
          {lines.map((l) => (
            <button key={l.t} onClick={() => { playEpisode(ep, l.t); onPlayer() }}>
              <span className="pc-hit-time">{fmt(l.t)}</span>
              <span>{l.text}</span>
            </button>
          ))}
        </div>
      </div>
    </Page>
  )
}

// ---------------------------------------------------------------- player
const SPEEDS = [0.5, 1, 1.2, 1.5, 1.8, 2]

function Player({ open, onClose }: { open: boolean; onClose: () => void }) {
  const np = useOS((s) => s.nowPlaying)
  const speed = usePod((s) => s.speed)
  const sleepAt = usePod((s) => s.sleepAt)
  const volume = useOS((s) => s.volume)
  const ep = np.kind === 'podcast' && np.episodeId ? epById(np.episodeId) : undefined
  const show = ep ? showOf(ep.id)! : PODCASTS[0]
  const pos = usePodPos(250)
  const [transcript, setTranscript] = useState(false)
  const [drag, setDrag] = useState<number | null>(null)
  const bar = useRef<HTMLDivElement>(null)
  const active = useOS((s) => s.openApp === 'podcasts')
  useEffect(() => {
    if (!open || !active) return
    useShell.getState().set({ statusOverride: 'light' })
    return () => useShell.getState().set({ statusOverride: null })
  }, [open, active])
  if (!ep) return <Sheet open={open} onClose={onClose} title="Nothing Playing" detent="medium"><div className="empty-state">Choose an episode to start listening.</div></Sheet>
  const shown = drag ?? Math.min(pos, ep.duration)
  const lines = transcriptLines(ep)
  const curLine = lines.reduce((acc, l, i) => (l.t <= shown ? i : acc), -1)
  const fromX = (x: number) => {
    const r = bar.current!.getBoundingClientRect()
    return Math.min(1, Math.max(0, (x - r.left) / r.width)) * ep.duration
  }
  return (
    <Sheet open={open} onClose={onClose} detent="full" className="pc-player" closeButton={false} label="Podcast player">
      <div className="pc-player-inner" style={{ ['--h' as string]: show.hue }}>
        {transcript ? (
          <div className="pc-player-tx scroll">
            {lines.map((l, i) => (
              <button key={l.t} className={i === curLine ? 'cur' : i < curLine ? 'past' : ''} onClick={() => seekPodcast(l.t)}>
                <span className="pc-hit-time">{fmt(l.t)}</span>{l.text}
              </button>
            ))}
          </div>
        ) : (
          <div className={`pc-player-art ${np.playing ? '' : 'paused'}`}><ShowArt show={show} size="100%" radius={16} /></div>
        )}
        <div className="pc-player-meta">
          <div className="pc-ep-date light">{epDate(ep.date)}</div>
          <div className="pc-player-title">{ep.title}</div>
          <div className="pc-player-show">{show.title}</div>
        </div>
        <div className="pc-scrub" ref={bar} role="slider" aria-label="Episode position" aria-valuenow={Math.round(shown)} aria-valuemin={0} aria-valuemax={ep.duration} tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'ArrowRight') seekPodcast(pos + 30); if (e.key === 'ArrowLeft') seekPodcast(pos - 15) }}
          onPointerDown={(e) => {
            e.stopPropagation()
            let v = fromX(e.clientX)
            setDrag(v)
            const move = (ev: PointerEvent) => setDrag((v = fromX(ev.clientX)))
            const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); seekPodcast(v); setDrag(null) }
            window.addEventListener('pointermove', move)
            window.addEventListener('pointerup', up)
          }}>
          <div className={`pc-scrub-track ${drag !== null ? 'active' : ''}`}><div style={{ width: `${(shown / ep.duration) * 100}%` }} /></div>
        </div>
        <div className="pc-times"><span>{fmt(shown)}</span><span>-{fmt(ep.duration - shown)}</span></div>
        <div className="pc-transport">
          <button className="pc-speed" onClick={() => setSpeed(SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length] ?? 1)} aria-label={`Playback speed ${speed}x`}>{speed}×</button>
          <button aria-label="Back 15 seconds" onClick={() => seekPodcast(pos - 15)}><RotateCcw size={34} /><span className="pc-skipn">15</span></button>
          <button className="pc-pp" aria-label={np.playing ? 'Pause' : 'Play'} onClick={togglePodcast}>{np.playing ? <Pause size={48} fill="currentColor" strokeWidth={0} /> : <Play size={48} fill="currentColor" strokeWidth={0} style={{ marginLeft: 5 }} />}</button>
          <button aria-label="Forward 30 seconds" onClick={() => seekPodcast(pos + 30)}><RotateCw size={34} /><span className="pc-skipn">30</span></button>
          <button className={`pc-sleep ${sleepAt ? 'on' : ''}`} aria-label="Sleep timer" onClick={(e) => openMenu(e.currentTarget, [
            { label: 'Off', onSelect: () => usePod.getState().set({ sleepAt: null }) },
            { label: '5 Minutes', onSelect: () => { usePod.getState().set({ sleepAt: Date.now() + 5 * 60_000 }); useOS.getState().showToast('Sleep timer: 5 min') } },
            { label: '15 Minutes', onSelect: () => { usePod.getState().set({ sleepAt: Date.now() + 15 * 60_000 }); useOS.getState().showToast('Sleep timer: 15 min') } },
            { label: '30 Minutes', onSelect: () => { usePod.getState().set({ sleepAt: Date.now() + 30 * 60_000 }); useOS.getState().showToast('Sleep timer: 30 min') } },
          ], { title: 'Sleep Timer' })}><Moon size={20} /></button>
        </div>
        <div className="pc-speed-row">
          {SPEEDS.map((s) => <Chip key={s} active={s === speed} onClick={() => setSpeed(s)}>{s}×</Chip>)}
        </div>
        <div className="pc-vol"><Slider value={volume} onChange={(v) => useOS.getState().set({ volume: v })} label="Volume" color="#fff" /></div>
        <div className="pc-player-bottom">
          <button aria-label="Transcript" className={transcript ? 'on' : ''} onClick={() => setTranscript(!transcript)}><Captions size={22} /></button>
          <button aria-label="AirPlay" onClick={() => { useOS.getState().set({ nowPlaying: { ...useOS.getState().nowPlaying, airplay: 'homepod' } }); useOS.getState().flashIsland({ kind: 'airplay', title: 'HomePod mini', subtitle: 'Connected in 0.4 s', duration: 1800 }) }}><Airplay size={22} /></button>
          <button aria-label="Close player" onClick={onClose}><ChevronDown size={24} /></button>
        </div>
      </div>
    </Sheet>
  )
}
