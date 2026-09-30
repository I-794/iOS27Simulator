import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { House, LayoutGrid, Radio, Library, Play, Pause, SkipForward } from 'lucide-react'
import { NavStack, TabBar, useNav } from '../../ui/nav'
import { useOS } from '../../os/store'
import { useAppRoute, useOnscreen } from '../../os/hooks'
import { AlbumArt } from '../../shell/widgets/AlbumArt'
import { HomeTab, NewTab, RadioTab, LibraryTab, SearchTab, AlbumPage, ArtistPage, PlaylistPage } from './pages'
import { NowPlaying } from './NowPlaying'
import { wireAutoMix } from './automix'
import { trackById, usePosition, TRACKS } from './lib'
import './music.css'

type Tab = 'home' | 'new' | 'radio' | 'library' | 'search'
type NavApi = ReturnType<typeof useNav>

const TABS = [
  { id: 'home' as const, label: 'Home', icon: <House size={24} /> },
  { id: 'new' as const, label: 'New', icon: <LayoutGrid size={24} /> },
  { id: 'radio' as const, label: 'Radio', icon: <Radio size={24} /> },
  { id: 'library' as const, label: 'Library', icon: <Library size={24} /> },
]

function Registrar({ onNav, children }: { onNav: (n: NavApi) => void; children: ReactNode }) {
  const nav = useNav()
  useEffect(() => onNav(nav), [nav, onNav])
  return <>{children}</>
}

export default function MusicApp() {
  const [tab, setTab] = useState<Tab>('home')
  const [npOpen, setNpOpen] = useState(false)
  const [npView, setNpView] = useState<'art' | 'lyrics' | 'queue'>('art')
  const [minimized, setMinimized] = useState(false)
  const navs = useRef<Partial<Record<Tab, NavApi>>>({})
  const lastTop = useRef(0)
  const np = useOS((s) => s.nowPlaying)
  const track = trackById(np.trackId)

  useEffect(() => wireAutoMix(), [])
  useOnscreen('music', npOpen ? `Now Playing: ${track?.title} by ${track?.artist}` : 'Browsing Apple Music', { type: 'music', trackId: np.trackId, title: track?.title ?? '', artist: track?.artist ?? '' })

  useAppRoute('music', (r) => {
    if (r.startsWith('nowplaying')) {
      setNpView(r.endsWith('lyrics') ? 'lyrics' : r.endsWith('queue') ? 'queue' : 'art')
      setNpOpen(true)
    } else if (r.startsWith('album/')) {
      setNpOpen(false)
      navs.current[tab]?.push(<AlbumPage name={decodeURIComponent(r.slice(6))} />)
    } else if (r.startsWith('artist/')) {
      setNpOpen(false)
      navs.current[tab]?.push(<ArtistPage name={decodeURIComponent(r.slice(7))} />)
    } else if (r.startsWith('playlist/')) {
      setNpOpen(false)
      navs.current[tab]?.push(<PlaylistPage id={r.slice(9)} />)
    } else if (r.startsWith('play/')) {
      const id = r.slice(5)
      if (TRACKS.some((t) => t.id === id)) useOS.getState().playTrack(id)
      setNpOpen(true)
    }
  })

  const onScroll = useCallback((top: number) => {
    const d = top - lastTop.current
    lastTop.current = top
    if (top < 40) setMinimized(false)
    else if (d > 6) setMinimized(true)
    else if (d < -8) setMinimized(false)
  }, [])

  const choose = (t: Tab) => {
    if (t === tab) navs.current[t]?.popToRoot()
    setTab(t)
    setMinimized(false)
    lastTop.current = 0
  }

  const reg = useCallback((t: Tab) => (n: NavApi) => void (navs.current[t] = n), [])
  const regs = useRef<Partial<Record<Tab, (n: NavApi) => void>>>({})
  const regFor = (t: Tab) => (regs.current[t] ??= reg(t))

  const goArtist = (a: string) => {
    setNpOpen(false)
    window.setTimeout(() => navs.current[tab]?.push(<ArtistPage name={a} />), 120)
  }
  const goAlbum = (a: string) => {
    setNpOpen(false)
    window.setTimeout(() => navs.current[tab]?.push(<AlbumPage name={a} />), 120)
  }

  const roots: Record<Tab, ReactNode> = {
    home: <HomeTab onScroll={onScroll} />,
    new: <NewTab onScroll={onScroll} />,
    radio: <RadioTab onScroll={onScroll} />,
    library: <LibraryTab onScroll={onScroll} />,
    search: <SearchTab onScroll={onScroll} />,
  }

  return (
    <div className="app-root mu-root">
      {(Object.keys(roots) as Tab[]).map((t) => (
        <div key={t} className="mu-tabpane" style={{ display: t === tab ? undefined : 'none' }} inert={t !== tab ? true : undefined}>
          <NavStack root={<Registrar onNav={regFor(t)}>{roots[t]}</Registrar>} />
        </div>
      ))}
      {!minimized && track && <MiniPlayer onOpen={() => setNpOpen(true)} floating />}
      <TabBar
        tabs={TABS}
        value={(tab === 'search' ? 'home' : tab) as Exclude<Tab, 'search'>}
        onChange={(t) => choose(t)}
        onSearch={() => choose('search')}
        searchActive={tab === 'search'}
        minimized={minimized}
        accessory={minimized && track ? <MiniPlayer onOpen={() => setNpOpen(true)} /> : undefined}
      />
      <NowPlaying open={npOpen} onClose={() => setNpOpen(false)} view={npView} setView={setNpView} onArtist={goArtist} onAlbum={goAlbum} />
    </div>
  )
}

function MiniPlayer({ onOpen, floating }: { onOpen: () => void; floating?: boolean }) {
  const np = useOS((s) => s.nowPlaying)
  const track = trackById(np.trackId)!
  const pos = usePosition(!!floating)
  const st = useOS.getState
  return (
    <div className={`mu-mini glass ${floating ? 'floating anim-up' : 'inline'}`} role="button" tabIndex={0} aria-label={`Now playing ${track.title}. Open player`} onClick={onOpen} onKeyDown={(e) => e.key === 'Enter' && onOpen()}>
      <AlbumArt track={track} size={floating ? 40 : 34} radius={floating ? 8 : 17} />
      <div className="mu-mini-text">
        <div className="mu-mini-title nowrap">{track.title}</div>
        {floating && <div className="mu-mini-sub nowrap">{track.artist}</div>}
      </div>
      <button aria-label={np.playing ? 'Pause' : 'Play'} onClick={(e) => { e.stopPropagation(); st().togglePlay() }}>
        {np.playing ? <Pause size={22} fill="currentColor" strokeWidth={0} /> : <Play size={22} fill="currentColor" strokeWidth={0} />}
      </button>
      {floating && <button aria-label="Next" onClick={(e) => { e.stopPropagation(); st().nextTrack() }}><SkipForward size={22} fill="currentColor" strokeWidth={0} /></button>}
      {floating && <div className="mu-mini-progress"><div style={{ width: `${Math.min(100, (pos / track.duration) * 100)}%` }} /></div>}
    </div>
  )
}
