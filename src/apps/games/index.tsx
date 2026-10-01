import { useEffect, useRef, useState, type ReactNode } from 'react'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { House, Gamepad2, Users, Library, Trophy, Play, ChevronRight, Check, Settings2, X, Swords, Crown, Sparkles, Joystick, Accessibility, Star, ChevronLeft, ChevronUp, ChevronDown, Circle } from 'lucide-react'
import { NavStack, Page, useNav, TabBar, BarButton } from '../../ui/nav'
import { List, Row } from '../../ui/list'
import { SearchField, Avatar, Chip } from '../../ui/controls'
import { Sheet } from '../../ui/overlay'
import { useOS } from '../../os/store'
import { useAppRoute, useOnscreen } from '../../os/hooks'
import { useShell } from '../../shell/shellState'
import './games.css'

interface Game { id: string; name: string; genre: string; hue: number; arcade: boolean; desc: string; progress: number; ach: [number, number]; glyph: string; size: string }
const GAMES: Game[] = [
  { id: 'g-nova', name: 'Nova Racer', genre: 'Racing', hue: 265, arcade: true, desc: 'Weave through asteroid fields at light speed. Drift, boost and chase your friends’ ghost laps.', progress: 0.62, ach: [18, 30], glyph: '🚀', size: '1.2 GB' },
  { id: 'g-drum', name: 'Drum Hero Live', genre: 'Music', hue: 12, arcade: true, desc: 'Keep the beat with marching cadences and rock anthems. Supports controllers and touch.', progress: 0.81, ach: [26, 32], glyph: '🥁', size: '840 MB' },
  { id: 'g-garden', name: 'Tiny Garden Tales', genre: 'Simulation', hue: 120, arcade: true, desc: 'Grow a cozy pocket garden, befriend bugs and trade seeds with friends.', progress: 0.35, ach: [9, 40], glyph: '🌱', size: '610 MB' },
  { id: 'g-bot', name: 'Robo League', genre: 'Sports', hue: 200, arcade: false, desc: 'Build a robot, tune its drivetrain and compete in 3v3 arena matches.', progress: 0.48, ach: [14, 36], glyph: '🤖', size: '2.4 GB' },
  { id: 'g-word', name: 'Letterbloom', genre: 'Word', hue: 320, arcade: true, desc: 'Daily word puzzles that blossom as you solve them.', progress: 0.9, ach: [41, 45], glyph: '🌸', size: '95 MB' },
  { id: 'g-dungeon', name: 'Lantern Depths', genre: 'Adventure', hue: 38, arcade: true, desc: 'Descend into a hand-drawn dungeon with only a lantern and your wits.', progress: 0.12, ach: [3, 50], glyph: '🏮', size: '3.1 GB' },
  { id: 'g-sky', name: 'Skyward Glide', genre: 'Casual', hue: 190, arcade: false, desc: 'One-tap flight through endless skies. Beat your best distance.', progress: 0, ach: [0, 20], glyph: '🪁', size: '210 MB' },
]
const FRIENDS = [
  { id: 'alex', game: 'g-nova', what: 'beat your lap time in Nova Racer', when: '12m' },
  { id: 'sam', game: 'g-drum', what: 'earned “Perfect Cadence” in Drum Hero Live', when: '1h' },
  { id: 'priya', game: 'g-word', what: 'is playing Letterbloom', when: 'now' },
  { id: 'nora', game: 'g-garden', what: 'sent you seeds in Tiny Garden Tales', when: '3h' },
]
const CONTROLLERS = [
  { id: 'DualSense Wireless Controller', note: 'Adaptive triggers & haptics supported' },
  { id: 'PlayStation Access controller', note: 'New in iOS 27 · customizable accessible layouts' },
  { id: 'Xbox Wireless Controller', note: 'Bluetooth LE' },
  { id: 'MFi Grip Controller', note: 'Lightning/USB-C grip' },
]

interface GState { installed: string[]; set: (p: Partial<GState>) => void }
const useG = create<GState>()(persist((set) => ({ installed: ['g-nova', 'g-drum', 'g-garden', 'g-bot', 'g-word'], set: (p) => set(p) }), { name: 'ios27-games', partialize: (s) => ({ installed: s.installed }) }))

export function GameArt({ g, size = 64, radius }: { g: Game; size?: number | string; radius?: number }) {
  return (
    <div className="gm-art" style={{ width: size, height: size, borderRadius: radius ?? (typeof size === 'number' ? size * 0.22 : 20), ['--h' as string]: g.hue }} aria-hidden>
      <span style={{ fontSize: typeof size === 'number' ? size * 0.5 : 64 }}>{g.glyph}</span>
    </div>
  )
}

type Tab = 'home' | 'arcade' | 'together' | 'library'
type NavApi = ReturnType<typeof useNav>
function Registrar({ onNav, children }: { onNav: (n: NavApi) => void; children: ReactNode }) {
  const nav = useNav()
  useEffect(() => onNav(nav), [nav, onNav])
  return <>{children}</>
}

export default function GamesApp() {
  const [tab, setTab] = useState<Tab>('home')
  const [search, setSearch] = useState(false)
  const [playing, setPlaying] = useState<Game | null>(null)
  const [ctl, setCtl] = useState(false)
  const navs = useRef<Partial<Record<Tab, NavApi>>>({})
  const regs = useRef<Partial<Record<Tab, (n: NavApi) => void>>>({})
  const regFor = (t: Tab) => (regs.current[t] ??= (n: NavApi) => void (navs.current[t] = n))
  useAppRoute('games', (r) => {
    if (r === 'controller') setCtl(true)
    else if (r.startsWith('play/')) { const g = GAMES.find((x) => x.id === r.slice(5)); if (g) setPlaying(g) }
    else if (r.startsWith('game/')) { const g = GAMES.find((x) => x.id === r.slice(5)); if (g) navs.current[tab]?.push(<GamePage g={g} onPlay={setPlaying} />) }
  })
  const roots: Record<Tab, ReactNode> = {
    home: <HomeTab onPlay={setPlaying} onController={() => setCtl(true)} search={search} />,
    arcade: <ArcadeTab onPlay={setPlaying} />,
    together: <TogetherTab onPlay={setPlaying} />,
    library: <LibraryTab onPlay={setPlaying} />,
  }
  return (
    <div className="app-root gm-root">
      {(Object.keys(roots) as Tab[]).map((t) => (
        <div key={t} className="gm-pane" style={{ display: t === tab ? undefined : 'none' }} inert={t !== tab ? true : undefined}>
          <NavStack root={<Registrar onNav={regFor(t)}>{roots[t]}</Registrar>} />
        </div>
      ))}
      <TabBar
        tabs={[{ id: 'home', label: 'Home', icon: <House size={24} /> }, { id: 'arcade', label: 'Arcade', icon: <Joystick size={24} /> }, { id: 'together', label: 'Play Together', icon: <Users size={24} /> }, { id: 'library', label: 'Library', icon: <Library size={24} /> }]}
        value={tab}
        onChange={(t) => { if (t === tab) navs.current[t]?.popToRoot(); setTab(t); setSearch(false) }}
        onSearch={() => { setTab('home'); navs.current.home?.popToRoot(); setSearch(true) }}
        searchActive={search}
      />
      <ControllerSheet open={ctl} onClose={() => setCtl(false)} />
      {playing && <GameSession g={playing} onQuit={() => setPlaying(null)} onController={() => setCtl(true)} />}
    </div>
  )
}

function ControllerChip({ onClick }: { onClick: () => void }) {
  const c = useOS((s) => s.games.controller)
  return <BarButton label="Controller" onClick={onClick}><Gamepad2 size={20} color={c ? '#30d158' : undefined} /></BarButton>
}

// ---------------------------------------------------------------- Home
function HomeTab({ onPlay, onController, search }: { onPlay: (g: Game) => void; onController: () => void; search: boolean }) {
  const nav = useNav()
  const [q, setQ] = useState('')
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => { if (search) input.current?.focus() }, [search])
  const installed = useG((s) => s.installed)
  const recent = GAMES.filter((g) => installed.includes(g.id) && g.progress > 0)
  const results = q ? GAMES.filter((g) => `${g.name} ${g.genre}`.toLowerCase().includes(q.toLowerCase())) : []
  useOnscreen('games', 'Games app home', { type: 'page', title: 'Games', text: GAMES.map((g) => g.name).join(', '), url: 'games' })
  return (
    <Page title="Home" bottomExtra={70} className="gm-page" trailing={<><ControllerChip onClick={onController} /><BarButton label="Profile" onClick={() => useOS.getState().showToast('Game Center · Jamie (Level 24)')}><Avatar id="me" size={30} /></BarButton></>}>
      {search && <div className="gm-search"><SearchField ref={input} value={q} onChange={setQ} placeholder="Games, Friends & Events" /></div>}
      {search && q ? (
        <List>{results.map((g) => <Row key={g.id} title={g.name} subtitle={g.genre} icon={<GameArt g={g} size={44} />} chevron onClick={() => nav.push(<GamePage g={g} onPlay={onPlay} />)} />)}</List>
      ) : (
        <>
          <div className="gm-sec">Continue Playing</div>
          <div className="gm-row scroll-x">
            {recent.map((g) => (
              <div key={g.id} className="gm-cont">
                <button onClick={() => nav.push(<GamePage g={g} onPlay={onPlay} />)}><GameArt g={g} size={120} /></button>
                <b className="nowrap">{g.name}</b>
                <div className="gm-prog"><i style={{ width: `${g.progress * 100}%` }} /></div>
                <button className="gm-play-sm" onClick={() => onPlay(g)}><Play size={12} fill="currentColor" strokeWidth={0} /> Play</button>
              </div>
            ))}
          </div>
          <div className="gm-sec">Friends Are Playing</div>
          <div className="gm-friends">
            {FRIENDS.map((f) => {
              const g = GAMES.find((x) => x.id === f.game)!
              return (
                <button key={f.id} className="gm-friend" onClick={() => nav.push(<GamePage g={g} onPlay={onPlay} />)}>
                  <Avatar id={f.id} size={40} />
                  <span className="grow" style={{ textAlign: 'left' }}><b>{f.id[0].toUpperCase() + f.id.slice(1)}</b> {f.what}<span className="gm-muted"> · {f.when}</span></span>
                  <GameArt g={g} size={36} />
                </button>
              )
            })}
          </div>
          <div className="gm-sec">Events</div>
          <div className="gm-row scroll-x">
            {[{ g: GAMES[0], t: 'Comet Cup', s: 'Happening now · ends in 2 days' }, { g: GAMES[1], t: 'Halftime Showdown', s: 'Starts Friday' }, { g: GAMES[2], t: 'Harvest Moon Festival', s: 'Ongoing' }].map((e) => (
              <button key={e.t} className="gm-event" style={{ ['--h' as string]: e.g.hue }} onClick={() => nav.push(<GamePage g={e.g} onPlay={onPlay} />)}>
                <span className="gm-event-tag">EVENT</span>
                <b>{e.t}</b>
                <span>{e.g.name} · {e.s}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </Page>
  )
}

function GameTile({ g, onPlay }: { g: Game; onPlay: (g: Game) => void }) {
  const nav = useNav()
  const installed = useG((s) => s.installed.includes(g.id))
  const [loading, setLoading] = useState(false)
  return (
    <div className="gm-tile">
      <button onClick={() => nav.push(<GamePage g={g} onPlay={onPlay} />)} className="gm-tile-main">
        <GameArt g={g} size={60} />
        <span className="grow" style={{ textAlign: 'left', minWidth: 0 }}><b className="nowrap" style={{ display: 'block' }}>{g.name}</b><span className="gm-muted">{g.genre}{g.arcade ? ' · Arcade' : ''}</span></span>
      </button>
      <GetButton g={g} installed={installed} loading={loading} setLoading={setLoading} onPlay={onPlay} />
    </div>
  )
}

function GetButton({ g, installed, loading, setLoading, onPlay }: { g: Game; installed: boolean; loading: boolean; setLoading: (b: boolean) => void; onPlay: (g: Game) => void }) {
  return (
    <button className={`gm-get ${loading ? 'loading' : ''}`} onClick={() => {
      if (installed) return onPlay(g)
      setLoading(true)
      window.setTimeout(() => { useG.getState().set({ installed: [...useG.getState().installed, g.id] }); setLoading(false) }, 1400)
    }}>{loading ? <span className="gm-ring" /> : installed ? 'Play' : 'Get'}</button>
  )
}

function ArcadeTab({ onPlay }: { onPlay: (g: Game) => void }) {
  const nav = useNav()
  const [genre, setGenre] = useState('All')
  const arcade = GAMES.filter((g) => g.arcade && (genre === 'All' || g.genre === genre))
  const hero = GAMES[5]
  return (
    <Page title="Arcade" bottomExtra={70} className="gm-page">
      <button className="gm-hero" style={{ ['--h' as string]: hero.hue }} onClick={() => nav.push(<GamePage g={hero} onPlay={onPlay} />)}>
        <span className="gm-hero-k">NEW GAME</span>
        <b>{hero.name}</b>
        <span>{hero.desc}</span>
        <span className="gm-hero-glyph">{hero.glyph}</span>
      </button>
      <div className="gm-chips scroll-x">{['All', 'Racing', 'Music', 'Simulation', 'Word', 'Adventure'].map((c) => <Chip key={c} active={genre === c} onClick={() => setGenre(c)}>{c}</Chip>)}</div>
      <div className="gm-grid">{arcade.map((g) => <GameTile key={g.id} g={g} onPlay={onPlay} />)}</div>
    </Page>
  )
}

function TogetherTab({ onPlay }: { onPlay: (g: Game) => void }) {
  const [sent, setSent] = useState<string[]>([])
  return (
    <Page title="Play Together" bottomExtra={70} className="gm-page">
      <div className="gm-sec">Challenges</div>
      <div className="gm-challenges">
        {FRIENDS.slice(0, 3).map((f) => {
          const g = GAMES.find((x) => x.id === f.game)!
          const done = sent.includes(f.id)
          return (
            <div key={f.id} className="gm-challenge" style={{ ['--h' as string]: g.hue }}>
              <Swords size={20} />
              <span className="grow"><b>Challenge {f.id[0].toUpperCase() + f.id.slice(1)}</b><span>{g.name} · best score</span></span>
              <button onClick={() => { setSent([...sent, f.id]); useOS.getState().showToast(`Challenge sent in ${g.name}`) }} disabled={done}>{done ? <Check size={16} /> : 'Send'}</button>
            </div>
          )
        })}
      </div>
      <div className="gm-sec">Leaderboard · Nova Racer</div>
      <List>
        {[['alex', '1:02.44'], ['me', '1:03.10'], ['sam', '1:05.87'], ['priya', '1:09.02']].map(([id, t], i) => (
          <Row key={id} title={id === 'me' ? 'You' : id[0].toUpperCase() + id.slice(1)} icon={<span className="gm-rank">{i === 0 ? <Crown size={16} /> : i + 1}</span>} trailing={<><Avatar id={id} size={28} /><span className="gm-time">{t}</span></>} onClick={() => i === 1 && onPlay(GAMES[0])} />
        ))}
      </List>
      <List header="Friends">
        {FRIENDS.map((f) => <Row key={f.id} title={f.id[0].toUpperCase() + f.id.slice(1)} subtitle={f.what} icon={<Avatar id={f.id} size={34} />} />)}
      </List>
    </Page>
  )
}

function LibraryTab({ onPlay }: { onPlay: (g: Game) => void }) {
  const installed = useG((s) => s.installed)
  const [filter, setFilter] = useState<'Installed' | 'All' | 'Arcade'>('Installed')
  const list = GAMES.filter((g) => (filter === 'Installed' ? installed.includes(g.id) : filter === 'Arcade' ? g.arcade : true))
  return (
    <Page title="Library" bottomExtra={70} className="gm-page">
      <div className="gm-chips">{(['Installed', 'All', 'Arcade'] as const).map((f) => <Chip key={f} active={filter === f} onClick={() => setFilter(f)}>{f}</Chip>)}</div>
      <div className="gm-grid">{list.map((g) => <GameTile key={g.id} g={g} onPlay={onPlay} />)}</div>
    </Page>
  )
}

function GamePage({ g, onPlay }: { g: Game; onPlay: (g: Game) => void }) {
  const installed = useG((s) => s.installed.includes(g.id))
  const [loading, setLoading] = useState(false)
  return (
    <Page title={g.name} large={false} className="gm-page">
      <div className="gm-gp-hero" style={{ ['--h' as string]: g.hue }}><span>{g.glyph}</span></div>
      <div className="gm-gp-head">
        <GameArt g={g} size={84} />
        <div className="grow"><h2>{g.name}</h2><span className="gm-muted">{g.genre}{g.arcade ? ' · Apple Arcade' : ''} · {g.size}</span></div>
        <GetButton g={g} installed={installed} loading={loading} setLoading={setLoading} onPlay={onPlay} />
      </div>
      <p className="gm-desc">{g.desc}</p>
      <div className="gm-sec">Achievements</div>
      <div className="gm-ach">
        <div className="gm-ach-ring" style={{ ['--p' as string]: g.ach[0] / g.ach[1] }}><b>{g.ach[0]}</b><span>of {g.ach[1]}</span></div>
        <div className="grow">
          {['First Steps', 'Speed Demon', 'Perfectionist'].map((a, i) => <div key={a} className={`gm-ach-row ${i < 2 && g.ach[0] > i * 5 ? 'done' : ''}`}><Trophy size={16} /> {a}</div>)}
        </div>
      </div>
      <List header="Supports">
        <Row title="Game Controllers" subtitle="Including PlayStation Access controller" icon={<Gamepad2 size={20} color="var(--accent)" />} />
        <Row title="Game Overlay" subtitle="Friends, achievements & settings without leaving the game" icon={<Sparkles size={20} color="var(--accent)" />} />
        <Row title="Play Together" subtitle="Challenges & leaderboards" icon={<Users size={20} color="var(--accent)" />} />
      </List>
    </Page>
  )
}

// ---------------------------------------------------------------- controller settings
function ControllerSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const games = useOS((s) => s.games)
  const [pairing, setPairing] = useState<string | null>(null)
  const [haptics, setHaptics] = useState(true)
  const [layout, setLayout] = useState('Default')
  const set = (patch: Partial<typeof games>) => useOS.getState().set({ games: { ...useOS.getState().games, ...patch } })
  return (
    <Sheet open={open} onClose={onClose} title="Game Controller" detent="large">
      <List header="Controllers" footer="iOS 27 adds support for the PlayStation Access controller, including custom accessible button layouts and profiles.">
        {CONTROLLERS.map((c) => (
          <Row key={c.id} title={c.id} subtitle={pairing === c.id ? 'Pairing…' : c.note}
            icon={c.id.includes('Access') ? <Accessibility size={22} color="var(--accent)" /> : <Gamepad2 size={22} color="var(--accent)" />}
            trailing={games.controller === c.id ? <Check size={18} color="var(--accent)" /> : undefined}
            onClick={() => {
              if (games.controller === c.id) return set({ controller: null })
              setPairing(c.id)
              window.setTimeout(() => { set({ controller: c.id }); setPairing(null); useOS.getState().flashIsland({ kind: 'generic', title: 'Controller Connected', subtitle: c.id, duration: 2000 }) }, 900)
            }} />
        ))}
      </List>
      {games.controller && (
        <List header={`${games.controller} Settings`}>
          <Row title="Haptics" toggle={{ value: haptics, onChange: setHaptics }} />
          <Row title="Button Layout" detail={layout} onClick={() => setLayout(layout === 'Default' ? 'One-Handed' : layout === 'One-Handed' ? 'Custom' : 'Default')} chevron />
          <Row title="Home Button Opens" detail="Game Overlay" />
        </List>
      )}
      <List header="Game Overlay">
        <Row title="Enable Game Overlay" toggle={{ value: games.overlay, onChange: (v) => set({ overlay: v }) }} />
      </List>
    </Sheet>
  )
}

// ---------------------------------------------------------------- game session + iOS 27 Game Overlay
function GameSession({ g, onQuit, onController }: { g: Game; onQuit: () => void; onController: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const [score, setScore] = useState(0)
  const [overlay, setOverlay] = useState(false)
  const [focus, setFocus] = useState(0)
  const [section, setSection] = useState(0)
  const games = useOS((s) => s.games)
  const steer = useRef(0)
  const paused = useRef(false)
  paused.current = overlay
  useEffect(() => {
    useShell.getState().set({ statusOverride: 'light' })
    return () => useShell.getState().set({ statusOverride: null })
  }, [])
  useEffect(() => {
    const c = canvas.current!
    const ctx = c.getContext('2d')!
    const W = (c.width = c.offsetWidth * 2)
    const H = (c.height = c.offsetHeight * 2)
    const stars = Array.from({ length: 120 }, () => ({ x: Math.random() * W, y: Math.random() * H, z: Math.random() * 3 + 0.5 }))
    let ship = W / 2
    let raf = 0
    let t = 0
    const loop = () => {
      if (!paused.current) {
        t++
        ship = Math.max(40, Math.min(W - 40, ship + steer.current * 14))
        for (const s of stars) { s.y += s.z * 6; if (s.y > H) { s.y = 0; s.x = Math.random() * W } }
        if (t % 6 === 0) setScore((x) => x + 1)
      }
      ctx.fillStyle = `hsl(${g.hue} 60% 8%)`
      ctx.fillRect(0, 0, W, H)
      for (const s of stars) { ctx.fillStyle = `rgba(255,255,255,${s.z / 3.5})`; ctx.fillRect(s.x, s.y, s.z * 2, s.z * 6) }
      ctx.font = `${Math.round(W * 0.12)}px system-ui`
      ctx.textAlign = 'center'
      ctx.fillText(g.glyph, ship, H * 0.8)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [g])
  const SECTIONS = ['Friends', 'Achievements', 'Controller', 'Settings'] as const
  const items: Record<(typeof SECTIONS)[number], { l: string; a: () => void }[]> = {
    Friends: FRIENDS.map((f) => ({ l: `${f.id[0].toUpperCase() + f.id.slice(1)} — ${f.what}`, a: () => useOS.getState().showToast(`Invited ${f.id} to ${g.name}`) })),
    Achievements: [{ l: `${g.ach[0]} of ${g.ach[1]} earned`, a: () => {} }, { l: 'Next: Speed Demon (80%)', a: () => {} }, { l: 'Leaderboard: #2 among friends', a: () => {} }],
    Controller: [{ l: games.controller ? `Connected: ${games.controller}` : 'No controller — Connect…', a: onController }, { l: 'PlayStation Access controller supported', a: onController }],
    Settings: [{ l: 'Resume Game', a: () => setOverlay(false) }, { l: 'Quit Game', a: onQuit }],
  }
  const cur = items[SECTIONS[section]]
  // controller-style navigation with arrows / enter / escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'g' || e.key === 'Home') { setOverlay((o) => !o); e.preventDefault(); return }
      if (!overlay) {
        if (e.key === 'ArrowLeft') steer.current = -1
        if (e.key === 'ArrowRight') steer.current = 1
        if (e.key === 'Escape') { setOverlay(true); e.preventDefault(); e.stopPropagation() }
        return
      }
      e.preventDefault()
      e.stopPropagation()
      if (e.key === 'ArrowLeft') { setSection((s) => (s + SECTIONS.length - 1) % SECTIONS.length); setFocus(0) }
      if (e.key === 'ArrowRight') { setSection((s) => (s + 1) % SECTIONS.length); setFocus(0) }
      if (e.key === 'ArrowDown') setFocus((f) => Math.min(cur.length - 1, f + 1))
      if (e.key === 'ArrowUp') setFocus((f) => Math.max(0, f - 1))
      if (e.key === 'Enter') cur[focus]?.a()
      if (e.key === 'Escape') setOverlay(false)
    }
    const onUp = (e: KeyboardEvent) => { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') steer.current = 0 }
    window.addEventListener('keydown', onKey, true)
    window.addEventListener('keyup', onUp)
    return () => { window.removeEventListener('keydown', onKey, true); window.removeEventListener('keyup', onUp) }
  })
  const dpad = (d: 'up' | 'down' | 'left' | 'right' | 'a') => {
    if (d === 'left') { setSection((s) => (s + SECTIONS.length - 1) % SECTIONS.length); setFocus(0) }
    if (d === 'right') { setSection((s) => (s + 1) % SECTIONS.length); setFocus(0) }
    if (d === 'down') setFocus((f) => Math.min(cur.length - 1, f + 1))
    if (d === 'up') setFocus((f) => Math.max(0, f - 1))
    if (d === 'a') cur[focus]?.a()
  }
  return (
    <div className="gm-session" role="dialog" aria-label={`${g.name} game`}>
      <canvas ref={canvas} className="gm-canvas"
        onPointerDown={(e) => { const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); steer.current = e.clientX < r.left + r.width / 2 ? -1 : 1 }}
        onPointerUp={() => (steer.current = 0)} onPointerLeave={() => (steer.current = 0)} />
      <div className="gm-hud"><span>{g.name}</span><b>{score.toLocaleString()}</b></div>
      <div className="gm-hint">Tap left/right to steer · ← → keys</div>
      {games.overlay && <button className="gm-overlay-btn" onClick={() => setOverlay(true)} aria-label="Open Game Overlay"><Gamepad2 size={18} /></button>}
      {!games.overlay && <button className="gm-overlay-btn" onClick={onQuit} aria-label="Quit game"><X size={18} /></button>}
      {overlay && (
        <div className="gm-overlay anim-fade" onClick={(e) => e.target === e.currentTarget && setOverlay(false)}>
          <div className="gm-ov-panel anim-pop">
            <div className="gm-ov-head"><GameArt g={g} size={40} /><div className="grow"><b>{g.name}</b><span>Paused · Score {score}</span></div><button onClick={() => setOverlay(false)} aria-label="Close overlay"><X size={18} /></button></div>
            <div className="gm-ov-tabs" role="tablist">
              {SECTIONS.map((s, i) => <button key={s} role="tab" aria-selected={i === section} className={i === section ? 'on' : ''} onClick={() => { setSection(i); setFocus(0) }}>{s === 'Friends' ? <Users size={15} /> : s === 'Achievements' ? <Trophy size={15} /> : s === 'Controller' ? <Gamepad2 size={15} /> : <Settings2 size={15} />}{s}</button>)}
            </div>
            <div className="gm-ov-list">
              {cur.map((it, i) => <button key={it.l} className={i === focus ? 'focus' : ''} onClick={() => { setFocus(i); it.a() }} onMouseEnter={() => setFocus(i)}>{it.l}<ChevronRight size={14} /></button>)}
            </div>
            <div className="gm-ov-foot">
              <div className="gm-dpad" aria-label="Controller navigation">
                <button onClick={() => dpad('up')} aria-label="D-pad up"><ChevronUp size={16} /></button>
                <button onClick={() => dpad('left')} aria-label="D-pad left"><ChevronLeft size={16} /></button>
                <button onClick={() => dpad('right')} aria-label="D-pad right"><ChevronRight size={16} /></button>
                <button onClick={() => dpad('down')} aria-label="D-pad down"><ChevronDown size={16} /></button>
              </div>
              <span className="gm-muted">Navigate with a controller, arrow keys or the D-pad · <Star size={11} /> iOS 27</span>
              <button className="gm-a" onClick={() => dpad('a')} aria-label="A button (select)"><Circle size={12} /> A</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
