import { useMemo, useState, type ReactNode } from 'react'
import { Play, Shuffle, Ellipsis, ChevronRight, ListMusic, Mic2, Disc3, Music2, Download, Radio as RadioIcon, Plus, Check, User, Clock3 } from 'lucide-react'
import { useOS } from '../../os/store'
import { useLongPress } from '../../os/hooks'
import { Page, useNav, BarButton } from '../../ui/nav'
import { List, Row } from '../../ui/list'
import { SearchField, Avatar, Chip } from '../../ui/controls'
import { openMenu } from '../../ui/overlay'
import { AlbumArt } from '../../shell/widgets/AlbumArt'
import { ALBUMS, ARTISTS, PLAYLISTS, TRACKS, STATIONS, GENRE_TILES, albumByName, artistByName, albumsBy, tracksBy, trackById, fmtTime, totalMinutes, playList, CREDITS, type Album } from './lib'
import type { Track } from '../../os/types'

const BOTTOM = 150

// ---------------------------------------------------------------- shared bits
export function NowBars({ playing }: { playing: boolean }) {
  return (
    <span className={`mu-bars ${playing ? 'on' : ''}`} aria-label="Now playing">
      <i /><i /><i /><i />
    </span>
  )
}

function trackMenu(el: HTMLElement, t: Track, nav?: ReturnType<typeof useNav>) {
  const st = useOS.getState()
  openMenu(el, [
    { label: 'Play Next', icon: <ListMusic size={18} />, onSelect: () => {
      const np = useOS.getState().nowPlaying
      const q = np.queue.filter((x) => x !== t.id)
      q.splice(q.indexOf(np.trackId) + 1, 0, t.id)
      st.set({ nowPlaying: { ...np, queue: q } })
      st.showToast(`“${t.title}” will play next`)
    } },
    { label: 'Play Last', onSelect: () => {
      const np = useOS.getState().nowPlaying
      st.set({ nowPlaying: { ...np, queue: [...np.queue.filter((x) => x !== t.id), t.id] } })
      st.showToast('Added to queue')
    } },
    { label: 'Go to Album', icon: <Disc3 size={18} />, separatorBefore: true, onSelect: () => nav?.push(<AlbumPage name={t.album} />) },
    { label: 'Go to Artist', icon: <Mic2 size={18} />, onSelect: () => nav?.push(<ArtistPage name={t.artist} />) },
    { label: 'Create Station', icon: <RadioIcon size={18} />, onSelect: () => st.playTrack(t.id, TRACKS.filter((x) => Math.abs(x.bpm - t.bpm) < 16).map((x) => x.id), `${t.title} Station`) },
    { label: 'Share Song…', onSelect: () => st.set({ shareRequest: { title: `${t.title} — ${t.artist}`, kind: 'link', payload: `music.example/song/${t.id}`, app: 'music' } }) },
  ], { preview: <div className="mu-menu-prev"><AlbumArt track={t} size={60} radius={8} /><div><b>{t.title}</b><div>{t.artist}</div></div></div> })
}

export function TrackRow({ t, index, list, source, showArt = true, showArtist = true }: { t: Track; index?: number; list: string[]; source: string; showArt?: boolean; showArtist?: boolean }) {
  const np = useOS((s) => s.nowPlaying)
  const nav = useNav()
  const cur = np.trackId === t.id && np.kind === 'music'
  const lp = useLongPress((el) => trackMenu(el, t, nav))
  return (
    <div className={`mu-track ${cur ? 'cur' : ''}`} {...lp}>
      <button className="mu-track-main" onClick={() => (cur ? !np.playing && useOS.getState().togglePlay() : playList(list, t.id, source))} aria-label={`Play ${t.title}`}>
        {showArt ? (
          <span className="mu-track-art"><AlbumArt track={t} size={46} radius={6} />{cur && <span className="mu-track-overlay"><NowBars playing={np.playing} /></span>}</span>
        ) : (
          <span className="mu-track-num">{cur ? <NowBars playing={np.playing} /> : index}</span>
        )}
        <span className="mu-track-text">
          <span className="mu-track-title nowrap">{t.title}{t.explicit && <span className="mu-e">E</span>}</span>
          {showArtist && <span className="mu-track-sub nowrap">{t.artist}</span>}
        </span>
      </button>
      <button className="mu-track-more" aria-label={`More for ${t.title}`} onClick={(e) => trackMenu(e.currentTarget, t, nav)}><Ellipsis size={18} /></button>
    </div>
  )
}

function Shelf({ title, children, onMore }: { title: string; children: ReactNode; onMore?: () => void }) {
  return (
    <section className="mu-shelf">
      <button className="mu-shelf-head" onClick={onMore} disabled={!onMore}>
        <span>{title}</span>{onMore && <ChevronRight size={20} strokeWidth={2.6} />}
      </button>
      <div className="mu-shelf-row scroll-x">{children}</div>
    </section>
  )
}

function AlbumTile({ a, size = 160 }: { a: Album; size?: number }) {
  const nav = useNav()
  return (
    <button className="mu-tile" style={{ width: size }} onClick={() => nav.push(<AlbumPage name={a.name} />)}>
      <AlbumArt album={a.name} hue={a.hue} size={size} radius={10} />
      <span className="mu-tile-title nowrap">{a.name}</span>
      <span className="mu-tile-sub nowrap">{a.artist}</span>
    </button>
  )
}

function PlaylistArt({ hue, name, size }: { hue: number; name: string; size: number }) {
  return (
    <div className="mu-pl-art" style={{ width: size, height: size, ['--h' as string]: hue }}>
      <span className="mu-pl-mark"><Music2 size={size * 0.12} /> Music</span>
      <span className="mu-pl-name" style={{ fontSize: Math.max(14, size * 0.13) }}>{name}</span>
    </div>
  )
}

function PlaylistTile({ p, size = 160 }: { p: (typeof PLAYLISTS)[number]; size?: number }) {
  const nav = useNav()
  return (
    <button className="mu-tile" style={{ width: size }} onClick={() => nav.push(<PlaylistPage id={p.id} />)}>
      <PlaylistArt hue={p.hue} name={p.name} size={size} />
      <span className="mu-tile-title nowrap">{p.name}</span>
      <span className="mu-tile-sub nowrap">{p.curator === 'Apple Music' ? 'Apple Music' : `Playlist · ${p.curator}`}</span>
    </button>
  )
}

function ArtistBubble({ name, size = 110 }: { name: string; size?: number }) {
  const nav = useNav()
  const a = artistByName(name)
  return (
    <button className="mu-tile center" style={{ width: size }} onClick={() => nav.push(<ArtistPage name={name} />)}>
      <div className="mu-artist-pic" style={{ width: size, height: size, ['--h' as string]: a?.hue ?? 200 }}><span>{name.split(' ').map((w) => w[0]).join('').slice(0, 2)}</span></div>
      <span className="mu-tile-title nowrap">{name}</span>
    </button>
  )
}

function AccountButton() {
  return (
    <BarButton label="Account" onClick={() => useOS.getState().showToast('Signed in as Jamie Park')}>
      <Avatar id="me" size={30} />
    </BarButton>
  )
}

// ---------------------------------------------------------------- Home
export function HomeTab({ onScroll }: { onScroll: (t: number) => void }) {
  const nav = useNav()
  const recents = useOS((s) => s.recents)
  void recents
  const np = useOS((s) => s.nowPlaying)
  const cur = trackById(np.trackId)!
  const hero = [
    { kind: 'pl' as const, p: PLAYLISTS[2], label: 'Made for You' },
    { kind: 'album' as const, a: albumByName('Salt & Static')!, label: 'New Release' },
    { kind: 'pl' as const, p: PLAYLISTS[0], label: 'Because you listen to Aria Vale' },
    { kind: 'album' as const, a: albumByName('Weather Systems')!, label: 'Featuring Static Bloom' },
  ]
  return (
    <Page title="Home" trailing={<AccountButton />} bottomExtra={BOTTOM} onScroll={onScroll}>
      <section className="mu-shelf">
        <div className="mu-shelf-head static"><span>Top Picks for You</span></div>
        <div className="mu-shelf-row scroll-x">
          {hero.map((h, i) => {
            const hue = h.kind === 'pl' ? h.p.hue : h.a.hue
            const name = h.kind === 'pl' ? h.p.name : h.a.name
            return (
              <button key={i} className="mu-hero" style={{ ['--h' as string]: hue }} onClick={() => nav.push(h.kind === 'pl' ? <PlaylistPage id={h.p.id} /> : <AlbumPage name={h.a.name} />)}>
                <span className="mu-hero-label">{h.label}</span>
                <span className="mu-hero-art">{h.kind === 'pl' ? <PlaylistArt hue={hue} name={name} size={220} /> : <AlbumArt album={name} hue={hue} size={220} radius={0} />}</span>
                <span className="mu-hero-foot">
                  <span className="grow" style={{ minWidth: 0 }}><b className="nowrap" style={{ display: 'block' }}>{name}</b><span className="nowrap" style={{ display: 'block' }}>{h.kind === 'pl' ? `${h.p.tracks.length} songs · Updated today` : h.a.artist}</span></span>
                  <span className="mu-hero-play" role="button" aria-label={`Play ${name}`} onClick={(e) => { e.stopPropagation(); playList(h.kind === 'pl' ? h.p.tracks : h.a.tracks.map((t) => t.id), undefined, name) }}><Play size={16} fill="currentColor" strokeWidth={0} /></span>
                </span>
              </button>
            )
          })}
        </div>
      </section>
      <Shelf title="Recently Played" onMore={() => nav.push(<AllAlbums />)}>
        <button className="mu-tile" style={{ width: 150 }} onClick={() => nav.push(<AlbumPage name={cur.album} />)}>
          <AlbumArt track={cur} size={150} radius={10} />
          <span className="mu-tile-title nowrap">{cur.album}</span>
          <span className="mu-tile-sub nowrap">{cur.artist}</span>
        </button>
        {PLAYLISTS.slice(0, 2).map((p) => <PlaylistTile key={p.id} p={p} size={150} />)}
        {ALBUMS.filter((a) => a.name !== cur.album).slice(0, 4).map((a) => <AlbumTile key={a.name} a={a} size={150} />)}
      </Shelf>
      <Shelf title="Made for You">
        {PLAYLISTS.map((p) => <PlaylistTile key={p.id} p={p} />)}
        <button className="mu-tile" style={{ width: 160 }} onClick={() => playList([...TRACKS].sort(() => Math.random() - 0.5).map((t) => t.id), undefined, 'Discovery Station')}>
          <div className="mu-pl-art station" style={{ width: 160, height: 160, ['--h' as string]: 300 }}><span className="mu-pl-mark"><RadioIcon size={16} /> Station</span><span className="mu-pl-name">Discovery</span></div>
          <span className="mu-tile-title nowrap">Discovery Station</span>
          <span className="mu-tile-sub nowrap">Endless new music</span>
        </button>
      </Shelf>
      <Shelf title="Your Favorite Artists" onMore={() => nav.push(<AllArtists />)}>
        {ARTISTS.map((a) => <ArtistBubble key={a.name} name={a.name} />)}
      </Shelf>
      <section className="mu-shelf">
        <div className="mu-shelf-head static"><span>Stay on Repeat</span></div>
        <div className="mu-grid4 scroll-x">
          {[0, 1, 2].map((col) => (
            <div key={col} className="mu-grid4-col">
              {TRACKS.slice(col * 4, col * 4 + 4).map((t) => <TrackRow key={t.id} t={t} list={TRACKS.map((x) => x.id)} source="Stay on Repeat" />)}
            </div>
          ))}
        </div>
      </section>
    </Page>
  )
}

// ---------------------------------------------------------------- New
export function NewTab({ onScroll }: { onScroll: (t: number) => void }) {
  const nav = useNav()
  const newest = ALBUMS.filter((a) => a.year === 2026)
  return (
    <Page title="New" trailing={<AccountButton />} bottomExtra={BOTTOM} onScroll={onScroll}>
      <div className="mu-feature scroll-x">
        {newest.map((a) => (
          <button key={a.name} className="mu-feature-card" onClick={() => nav.push(<AlbumPage name={a.name} />)}>
            <span className="mu-feature-kicker">NEW ALBUM</span>
            <span className="mu-feature-title">{a.name}</span>
            <span className="mu-feature-sub">{a.artist}</span>
            <span className="mu-feature-art" style={{ ['--h' as string]: a.hue }}><AlbumArt album={a.name} hue={a.hue} size="100%" radius={0} /><span className="mu-feature-blurb">{a.description}</span></span>
          </button>
        ))}
      </div>
      <Shelf title="New Releases" onMore={() => nav.push(<AllAlbums />)}>{ALBUMS.map((a) => <AlbumTile key={a.name} a={a} />)}</Shelf>
      <Shelf title="Updated Playlists">{PLAYLISTS.map((p) => <PlaylistTile key={p.id} p={p} size={140} />)}</Shelf>
      <section className="mu-shelf">
        <div className="mu-shelf-head static"><span>Coming Soon</span></div>
        <List>
          <Row title="Tide Pools (Deluxe)" subtitle="Luma Coast · Oct 17" icon={<AlbumArt album="Tide Pools" hue={186} size={46} radius={6} />} trailing={<PreAdd />} />
          <Row title="Aurora Sessions" subtitle="Aria Vale · Nov 7" icon={<AlbumArt album="Aurora Sessions" hue={120} size={46} radius={6} />} trailing={<PreAdd />} />
        </List>
      </section>
    </Page>
  )
}

function PreAdd() {
  const [added, setAdded] = useState(false)
  return <button className="mu-preadd" onClick={(e) => { e.stopPropagation(); setAdded(!added); if (!added) useOS.getState().showToast('Pre-added — you’ll be notified on release') }}>{added ? <Check size={16} /> : <Plus size={16} />}</button>
}

// ---------------------------------------------------------------- Radio
export function RadioTab({ onScroll }: { onScroll: (t: number) => void }) {
  const np = useOS((s) => s.nowPlaying)
  return (
    <Page title="Radio" trailing={<AccountButton />} bottomExtra={BOTTOM} onScroll={onScroll}>
      <button className="mu-live" onClick={() => playList(STATIONS[0].tracks, undefined, STATIONS[0].name)}>
        <span className="mu-live-badge">LIVE</span>
        <span className="mu-live-title">Pulse Radio</span>
        <span className="mu-live-sub">The Afternoon Drop with Nia Solberg · 2–5 PM</span>
        <span className="mu-live-play"><Play size={16} fill="currentColor" strokeWidth={0} /> {np.source === 'Pulse Radio' && np.playing ? 'Listening' : 'Listen Now'}</span>
      </button>
      <Shelf title="Stations for You">
        {STATIONS.map((s) => (
          <button key={s.id} className="mu-tile" style={{ width: 160 }} onClick={() => playList(s.tracks, undefined, s.name)}>
            <div className="mu-pl-art station" style={{ width: 160, height: 160, ['--h' as string]: s.hue }}>
              <span className="mu-pl-mark"><RadioIcon size={16} /> Station</span>
              <span className="mu-pl-name">{s.name}</span>
              {np.source === s.name && np.playing && <span className="mu-station-live"><NowBars playing /></span>}
            </div>
            <span className="mu-tile-title nowrap">{s.name}</span>
            <span className="mu-tile-sub nowrap">{s.subtitle}</span>
          </button>
        ))}
      </Shelf>
      <section className="mu-shelf">
        <div className="mu-shelf-head static"><span>Artist Stations</span></div>
        <List>
          {ARTISTS.slice(0, 5).map((a) => (
            <Row key={a.name} title={`${a.name} Radio`} subtitle="Based on your listening" icon={<div className="mu-artist-pic" style={{ width: 46, height: 46, ['--h' as string]: a.hue }}><span style={{ fontSize: 15 }}>{a.name[0]}</span></div>} onClick={() => playList([...tracksBy(a.name).map((t) => t.id), ...TRACKS.filter((t) => t.artist !== a.name).slice(0, 4).map((t) => t.id)], undefined, `${a.name} Radio`)} chevron />
          ))}
        </List>
      </section>
    </Page>
  )
}

// ---------------------------------------------------------------- Library
export function LibraryTab({ onScroll }: { onScroll: (t: number) => void }) {
  const nav = useNav()
  return (
    <Page title="Library" trailing={<AccountButton />} bottomExtra={BOTTOM} onScroll={onScroll}>
      <div className="mu-lib-list">
        {[
          { l: 'Playlists', i: <ListMusic size={24} />, go: () => nav.push(<AllPlaylists />) },
          { l: 'Artists', i: <Mic2 size={24} />, go: () => nav.push(<AllArtists />) },
          { l: 'Albums', i: <Disc3 size={24} />, go: () => nav.push(<AllAlbums />) },
          { l: 'Songs', i: <Music2 size={24} />, go: () => nav.push(<AllSongs />) },
          { l: 'Made for You', i: <User size={24} />, go: () => nav.push(<AllPlaylists />) },
          { l: 'Downloaded', i: <Download size={24} />, go: () => nav.push(<AllSongs downloaded />) },
        ].map((x) => (
          <button key={x.l} className="mu-lib-row" onClick={x.go}>
            <span className="mu-lib-icon">{x.i}</span><span className="grow">{x.l}</span><ChevronRight size={18} className="chev" />
          </button>
        ))}
      </div>
      <div className="mu-shelf-head static" style={{ marginTop: 18 }}><span>Recently Added</span></div>
      <div className="mu-grid2">
        {[...PLAYLISTS.slice(0, 2)].map((p) => <PlaylistTile key={p.id} p={p} size={170} />)}
        {ALBUMS.map((a) => <AlbumTile key={a.name} a={a} size={170} />)}
      </div>
    </Page>
  )
}

function AllPlaylists() {
  const nav = useNav()
  return (
    <Page title="Playlists" bottomExtra={BOTTOM}>
      <List plain>
        <Row title={<span className="accent row gap8"><Plus size={20} /> New Playlist…</span>} onClick={() => useOS.getState().showToast('New playlist created')} />
        {PLAYLISTS.map((p) => <Row key={p.id} title={p.name} subtitle={p.curator} icon={<PlaylistArt hue={p.hue} name="" size={56} />} onClick={() => nav.push(<PlaylistPage id={p.id} />)} chevron />)}
      </List>
    </Page>
  )
}
function AllArtists() {
  const nav = useNav()
  return (
    <Page title="Artists" bottomExtra={BOTTOM}>
      <List plain>
        {[...ARTISTS].sort((a, b) => a.name.localeCompare(b.name)).map((a) => (
          <Row key={a.name} title={a.name} icon={<div className="mu-artist-pic" style={{ width: 46, height: 46, ['--h' as string]: a.hue }}><span style={{ fontSize: 15 }}>{a.name.split(' ').map((w) => w[0]).join('').slice(0, 2)}</span></div>} onClick={() => nav.push(<ArtistPage name={a.name} />)} chevron />
        ))}
      </List>
    </Page>
  )
}
function AllAlbums() {
  return (
    <Page title="Albums" bottomExtra={BOTTOM}>
      <div className="mu-grid2">{ALBUMS.map((a) => <AlbumTile key={a.name} a={a} size={170} />)}</div>
    </Page>
  )
}
function AllSongs({ downloaded }: { downloaded?: boolean }) {
  const list = downloaded ? TRACKS.filter((_, i) => i % 3 !== 2) : [...TRACKS].sort((a, b) => a.title.localeCompare(b.title))
  const ids = list.map((t) => t.id)
  return (
    <Page title={downloaded ? 'Downloaded' : 'Songs'} bottomExtra={BOTTOM}>
      <PlayShuffle ids={ids} source={downloaded ? 'Downloaded' : 'Songs'} />
      <div className="mu-tracklist">{list.map((t) => <TrackRow key={t.id} t={t} list={ids} source={downloaded ? 'Downloaded' : 'Songs'} />)}</div>
    </Page>
  )
}

function PlayShuffle({ ids, source, dark }: { ids: string[]; source: string; dark?: boolean }) {
  return (
    <div className={`mu-playshuffle ${dark ? 'dark' : ''}`}>
      <button className="glass interactive" onClick={() => playList(ids, undefined, source)}><Play size={18} fill="currentColor" strokeWidth={0} /> Play</button>
      <button className="glass interactive" onClick={() => playList(ids, undefined, source, true)}><Shuffle size={18} /> Shuffle</button>
    </div>
  )
}

// ---------------------------------------------------------------- Album (refreshed)
export function AlbumPage({ name }: { name: string }) {
  const nav = useNav()
  const a = albumByName(name) ?? ALBUMS[0]
  const ids = a.tracks.map((t) => t.id)
  const [scroll, setScroll] = useState(0)
  const [saved, setSaved] = useState(false)
  const credits = CREDITS.default.map((c) => (c.role === 'Performed by' ? { ...c, names: a.artist } : c))
  const more = albumsBy(a.artist).filter((x) => x.name !== a.name)
  return (
    <Page
      title={a.name}
      large={false}
      inlineTitle={scroll > 330 ? a.name : ''}
      bottomExtra={BOTTOM}
      onScroll={setScroll}
      className="mu-album-page"
      bg={`linear-gradient(180deg, hsl(${a.hue} 45% 32%) 0px, hsl(${(a.hue + 30) % 360} 35% 18%) 420px, var(--system-background) 640px)`}
      trailing={<>
        <BarButton label={saved ? 'In Library' : 'Add to Library'} onClick={() => { setSaved(!saved); useOS.getState().showToast(saved ? 'Removed from Library' : 'Added to Library') }}>{saved ? <Check size={20} /> : <Plus size={22} />}</BarButton>
        <BarButton label="More" onClick={() => useOS.getState().set({ shareRequest: { title: `${a.name} — ${a.artist}`, kind: 'link', payload: `music.example/album/${encodeURIComponent(a.name)}`, app: 'music' } })}><Ellipsis size={20} /></BarButton>
      </>}
    >
      <div className="mu-album-head" style={{ ['--h' as string]: a.hue }}>
        <div className="mu-album-art" style={{ transform: `scale(${Math.max(0.82, 1 - scroll / 1600)})`, opacity: Math.max(0.3, 1 - scroll / 500) }}>
          <AlbumArt album={a.name} hue={a.hue} size={250} radius={12} />
        </div>
        <h1 className="mu-album-title">{a.name}</h1>
        <button className="mu-album-artist" onClick={() => nav.push(<ArtistPage name={a.artist} />)}>{a.artist}</button>
        <div className="mu-album-meta">{a.genre} · {a.year} · <span className="mu-lossless">Lossless</span></div>
        <PlayShuffle ids={ids} source={a.name} dark />
        <p className="mu-album-desc">{a.description}</p>
      </div>
      <div className="mu-tracklist numbered">
        {a.tracks.map((t, i) => <TrackRow key={t.id} t={t} index={i + 1} list={ids} source={a.name} showArt={false} showArtist={false} />)}
      </div>
      <div className="mu-album-foot">
        <div>{new Date(a.year, 4 + (a.name.length % 6), 3 + (a.name.length % 20)).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}</div>
        <div>{a.tracks.length} {a.tracks.length === 1 ? 'song' : 'songs'}, {totalMinutes(a.tracks)} minutes</div>
        <div>℗ {a.year} {a.artist} Records (fictional)</div>
      </div>
      <List header="Credits">
        {credits.map((c) => <Row key={c.role} title={c.names} subtitle={c.role} />)}
      </List>
      {more.length > 0 && <Shelf title={`More by ${a.artist}`}>{more.map((x) => <AlbumTile key={x.name} a={x} size={140} />)}</Shelf>}
      <Shelf title="You Might Also Like">{ALBUMS.filter((x) => x.artist !== a.artist).slice(0, 4).map((x) => <AlbumTile key={x.name} a={x} size={140} />)}</Shelf>
    </Page>
  )
}

// ---------------------------------------------------------------- Playlist
export function PlaylistPage({ id }: { id: string }) {
  const p = PLAYLISTS.find((x) => x.id === id) ?? PLAYLISTS[0]
  const tracks = p.tracks.map(trackById).filter(Boolean) as Track[]
  const [scroll, setScroll] = useState(0)
  return (
    <Page
      title={p.name}
      large={false}
      inlineTitle={scroll > 330 ? p.name : ''}
      onScroll={setScroll}
      bottomExtra={BOTTOM}
      className="mu-album-page"
      bg={`linear-gradient(180deg, hsl(${p.hue} 50% 34%) 0px, hsl(${(p.hue + 30) % 360} 35% 18%) 420px, var(--system-background) 640px)`}
      trailing={<BarButton label="Add songs" onClick={() => useOS.getState().showToast('Search to add songs to this playlist')}><Plus size={22} /></BarButton>}
    >
      <div className="mu-album-head" style={{ ['--h' as string]: p.hue }}>
        <div className="mu-album-art"><PlaylistArt hue={p.hue} name={p.name} size={250} /></div>
        <h1 className="mu-album-title">{p.name}</h1>
        <div className="mu-album-artist static">{p.curator === 'Apple Music' ? 'Apple Music' : p.curator}</div>
        <div className="mu-album-meta">Updated today · {tracks.length} songs, {totalMinutes(tracks)} min</div>
        <PlayShuffle ids={p.tracks} source={p.name} dark />
      </div>
      <div className="mu-tracklist">{tracks.map((t) => <TrackRow key={t.id} t={t} list={p.tracks} source={p.name} />)}</div>
    </Page>
  )
}

// ---------------------------------------------------------------- Artist (refreshed)
export function ArtistPage({ name }: { name: string }) {
  const nav = useNav()
  const a = artistByName(name) ?? ARTISTS[0]
  const top = tracksBy(a.name)
  const albums = albumsBy(a.name)
  const ids = top.map((t) => t.id)
  const [scroll, setScroll] = useState(0)
  const [following, setFollowing] = useState(false)
  const similar = ARTISTS.filter((x) => x.name !== a.name).slice(0, 4)
  return (
    <Page title={a.name} large={false} inlineTitle={scroll > 260 ? a.name : ''} onScroll={setScroll} bottomExtra={BOTTOM} noNav={false} className="mu-artist-page"
      trailing={<BarButton label={following ? 'Following' : 'Follow'} onClick={() => setFollowing(!following)}>{following ? <Check size={20} /> : <Plus size={22} />}</BarButton>}>
      <div className="mu-artist-hero" style={{ ['--h' as string]: a.hue, transform: `translateY(${Math.min(0, -scroll * 0)}px)` }}>
        <div className="mu-artist-hero-bg" style={{ transform: `scale(${1 + Math.max(0, -scroll) / 300}) translateY(${scroll * 0.35}px)` }}>
          <div className="mu-artist-silhouette"><span>{a.name.split(' ').map((w) => w[0]).join('').slice(0, 2)}</span></div>
        </div>
        <div className="mu-artist-hero-fade" />
        <div className="mu-artist-hero-row">
          <h1>{a.name}</h1>
          <button className="mu-artist-play" aria-label={`Play ${a.name}`} onClick={() => playList(ids, undefined, a.name)}><Play size={22} fill="currentColor" strokeWidth={0} style={{ marginLeft: 3 }} /></button>
        </div>
      </div>
      {albums[0] && (
        <button className="mu-latest" onClick={() => nav.push(<AlbumPage name={albums[0].name} />)}>
          <AlbumArt album={albums[0].name} hue={albums[0].hue} size={96} radius={8} />
          <span className="grow" style={{ textAlign: 'left' }}>
            <span className="mu-kicker">LATEST RELEASE · {albums[0].year}</span>
            <b style={{ display: 'block' }}>{albums[0].name}</b>
            <span className="mu-track-sub">{albums[0].tracks.length} songs</span>
          </span>
          <ChevronRight size={18} className="chev" />
        </button>
      )}
      <div className="mu-shelf-head static"><span>Top Songs</span></div>
      <div className="mu-tracklist">{top.map((t) => <TrackRow key={t.id} t={t} list={ids} source={`${a.name} Top Songs`} showArtist={false} />)}</div>
      <Shelf title="Albums">{albums.map((x) => <AlbumTile key={x.name} a={x} size={150} />)}</Shelf>
      <section className="mu-about">
        <div className="mu-shelf-head static"><span>About</span></div>
        <div className="mu-about-card" style={{ ['--h' as string]: a.hue }}>
          <p>{a.bio}</p>
          <div className="mu-about-stats">
            <span><b>{a.listeners.split(' ')[0]}</b> monthly listeners</span>
            <span><b>{GENRE_TILES.find((g) => g.q.includes(a.name.split(' ')[0]) || a.name.includes(g.q))?.name ?? 'Pop'}</b> genre</span>
          </div>
        </div>
      </section>
      <Shelf title="Similar Artists">{similar.map((s) => <ArtistBubble key={s.name} name={s.name} size={100} />)}</Shelf>
    </Page>
  )
}

// ---------------------------------------------------------------- Search
export function SearchTab({ onScroll }: { onScroll: (t: number) => void }) {
  const [q, setQ] = useState('')
  const [scope, setScope] = useState<'Apple Music' | 'Library'>('Apple Music')
  const results = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return null
    const m = (x: string) => x.toLowerCase().includes(s)
    return {
      artists: ARTISTS.filter((a) => m(a.name) || m(a.bio)),
      albums: ALBUMS.filter((a) => m(a.name) || m(a.artist) || m(a.genre)),
      songs: TRACKS.filter((t) => m(t.title) || m(t.artist) || m(t.album) || t.lyrics?.some(m)),
      playlists: PLAYLISTS.filter((p) => m(p.name)),
      lyric: TRACKS.find((t) => t.lyrics?.some(m)),
    }
  }, [q])
  const empty = results && !results.artists.length && !results.albums.length && !results.songs.length && !results.playlists.length
  return (
    <Page title="Search" bottomExtra={BOTTOM} onScroll={onScroll}>
      <div className="mu-search-head">
        <SearchField value={q} onChange={setQ} placeholder="Artists, Songs, Lyrics and More" />
        {q && <div className="mu-scope"><Chip active={scope === 'Apple Music'} onClick={() => setScope('Apple Music')}>Apple Music</Chip><Chip active={scope === 'Library'} onClick={() => setScope('Library')}>Your Library</Chip></div>}
      </div>
      {!results && (
        <>
          <div className="mu-shelf-head static"><span>Browse Categories</span></div>
          <div className="mu-cats">
            {GENRE_TILES.map((g) => (
              <button key={g.name} className="mu-cat" style={{ ['--h' as string]: g.hue }} onClick={() => setQ(g.q)}>
                <span>{g.name}</span>
                <AlbumArt album={g.name} hue={g.hue} size={62} radius={6} style={{ transform: 'rotate(22deg)', position: 'absolute', right: -8, bottom: -6 }} />
              </button>
            ))}
          </div>
          <List header="Recent Searches">
            {['static bloom', 'tidal', 'study'].map((s) => <Row key={s} title={s} icon={<Clock3 size={18} color="var(--label-secondary)" />} onClick={() => setQ(s)} compact />)}
          </List>
        </>
      )}
      {results && (
        <div className="anim-fade">
          {results.lyric && q.length > 3 && !results.lyric.title.toLowerCase().includes(q.toLowerCase()) && (
            <button className="mu-lyric-hit" onClick={() => playList([results.lyric!.id], undefined, 'Search')}>
              <span className="mu-kicker">LYRICS MATCH</span>
              <span>“{results.lyric.lyrics!.find((l) => l.toLowerCase().includes(q.toLowerCase()))}”</span>
              <span className="mu-track-sub">{results.lyric.title} · {results.lyric.artist}</span>
            </button>
          )}
          {results.artists.length > 0 && <Shelf title="Artists">{results.artists.map((a) => <ArtistBubble key={a.name} name={a.name} size={96} />)}</Shelf>}
          {results.songs.length > 0 && (
            <>
              <div className="mu-shelf-head static"><span>Songs</span></div>
              <div className="mu-tracklist">{results.songs.map((t) => <TrackRow key={t.id} t={t} list={results.songs.map((x) => x.id)} source="Search" />)}</div>
            </>
          )}
          {results.albums.length > 0 && <Shelf title="Albums">{results.albums.map((a) => <AlbumTile key={a.name} a={a} size={140} />)}</Shelf>}
          {results.playlists.length > 0 && <Shelf title="Playlists">{results.playlists.map((p) => <PlaylistTile key={p.id} p={p} size={140} />)}</Shelf>}
          {empty && <div className="empty-state" style={{ paddingTop: 60 }}>No results for “{q}”</div>}
        </div>
      )}
    </Page>
  )
}

export { fmtTime }
