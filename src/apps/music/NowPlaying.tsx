import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Play, Pause, SkipForward, SkipBack, Airplay, ListMusic, MessageSquareQuote, Star, Ellipsis, Volume1, Volume2, Shuffle, Repeat, Repeat1, Infinity as InfinityIcon, GripVertical, MinusCircle, Check, Headphones, Speaker, Tv, MonitorSmartphone, Wifi, WifiOff, Signal, Sparkles, ChevronDown, AudioLines } from 'lucide-react'
import { useOS } from '../../os/store'
import { useDrag, screenScale } from '../../os/hooks'
import { springs, animateSpring } from '../../os/spring'
import { audioAnalyser } from '../../os/audio'
import { AlbumArt } from '../../shell/widgets/AlbumArt'
import { useShell } from '../../shell/shellState'
import { Sheet, openMenu } from '../../ui/overlay'
import { Slider } from '../../ui/controls'
import { trackById, fmtTime, usePosition, TRACKS } from './lib'
import { useMix, waveform, KEY_WHEEL } from './automix'
import type { Track } from '../../os/types'

type View = 'art' | 'lyrics' | 'queue'

export function NowPlaying({ open, onClose, view, setView, onArtist, onAlbum }: { open: boolean; onClose: () => void; view: View; setView: (v: View) => void; onArtist: (a: string) => void; onAlbum: (a: string) => void }) {
  const [render, setRender] = useState(open)
  const ref = useRef<HTMLDivElement>(null)
  const np = useOS((s) => s.nowPlaying)
  const track = trackById(np.trackId) ?? TRACKS[0]
  const [airplay, setAirplay] = useState(false)

  useEffect(() => {
    if (open) setRender(true)
  }, [open])

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    if (open) {
      animateSpring(el, [{ transform: 'translateY(100%)', borderRadius: '40px' }, { transform: 'translateY(0)', borderRadius: '40px' }], springs.sheet(), { fill: 'none' })
    } else if (render) {
      const cur = getComputedStyle(el).transform
      const a = animateSpring(el, [{ transform: cur === 'none' ? 'translateY(0)' : cur }, { transform: 'translateY(100%)' }], springs.sheet())
      a.onfinish = () => setRender(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, render])

  const active = useOS((s) => s.openApp === 'music')
  useEffect(() => {
    if (!open || !active) return
    useShell.getState().set({ statusOverride: 'light' })
    return () => useShell.getState().set({ statusOverride: null })
  }, [open, active])

  const onDrag = useDrag({
    onStart: (e) => {
      const t = e.target as HTMLElement
      if (t.closest('button, [role=slider], .mu-np-lyrics, .mu-np-queue, input')) return false
      return true
    },
    onMove: (_dx, dy) => {
      if (ref.current) ref.current.style.transform = `translateY(${Math.max(0, dy)}px)`
    },
    onEnd: (_dx, dy, _vx, vy) => {
      const el = ref.current!
      if (dy > 150 || vy > 800) onClose()
      else {
        el.style.transform = ''
        animateSpring(el, [{ transform: `translateY(${Math.max(0, dy)}px)` }, { transform: 'translateY(0)' }], springs.sheet(), { fill: 'none' })
      }
    },
  })

  if (!render) return null
  const h = track.hue
  return (
    <div
      ref={ref}
      className={`mu-np ${np.playing ? 'playing' : 'paused'} view-${view}`}
      style={{ ['--h' as string]: h, ['--h2' as string]: (h + 40) % 360, ['--h3' as string]: (h + 320) % 360 }}
      onPointerDown={onDrag}
      role="dialog"
      aria-label="Now Playing"
    >
      <div className="mu-np-bg" aria-hidden>
        <div className="blob b1" />
        <div className="blob b2" />
        <div className="blob b3" />
      </div>
      <button className="mu-np-grabber" aria-label="Close Now Playing" onClick={onClose}><span /></button>
      <div className="mu-np-body">
        <div className="mu-np-top">
          {view === 'art' ? (
            <div className="mu-np-artwrap">
              <div className="mu-np-art" key={track.id}>
                <AlbumArt track={track} size="100%" radius={14} />
              </div>
            </div>
          ) : (
            <div className="mu-np-mini-head">
              <AlbumArt track={track} size={64} radius={8} />
              <div className="grow">
                <div className="t-headline nowrap">{track.title}</div>
                <div className="mu-np-sub nowrap">{track.artist}</div>
              </div>
              <StarButton />
              <MoreButton track={track} onArtist={onArtist} onAlbum={onAlbum} />
            </div>
          )}
          {view === 'lyrics' && <Lyrics track={track} />}
          {view === 'queue' && <Queue />}
        </div>
        <div className="mu-np-controls">
          {view === 'art' && (
            <div className="mu-np-title-row">
              <div className="grow" style={{ minWidth: 0 }}>
                <div className="mu-np-title nowrap">{track.title}{track.explicit && <span className="mu-e">E</span>}</div>
                <button className="mu-np-sub nowrap" onClick={() => onArtist(track.artist)}>{track.artist}</button>
              </div>
              <StarButton />
              <MoreButton track={track} onArtist={onArtist} onAlbum={onAlbum} />
            </div>
          )}
          <AutoMixBanner />
          <Scrubber track={track} />
          <Transport />
          <Volume />
          <div className="mu-np-bottom">
            <button aria-label="Lyrics" aria-pressed={view === 'lyrics'} className={view === 'lyrics' ? 'on' : ''} onClick={() => setView(view === 'lyrics' ? 'art' : 'lyrics')}>
              <MessageSquareQuote size={22} />
            </button>
            <button aria-label="AirPlay" onClick={() => setAirplay(true)} className="mu-airplay-btn">
              <Airplay size={22} />
              <AirplayLabel />
            </button>
            <button aria-label="Queue" aria-pressed={view === 'queue'} className={view === 'queue' ? 'on' : ''} onClick={() => setView(view === 'queue' ? 'art' : 'queue')}>
              <ListMusic size={22} />
            </button>
          </div>
        </div>
      </div>
      <AirplayPicker open={airplay} onClose={() => setAirplay(false)} />
    </div>
  )
}

function StarButton() {
  const id = useOS((s) => s.nowPlaying.trackId)
  const [fav, setFav] = useState<Record<string, boolean>>({ t1: true })
  return (
    <button className="mu-np-round" aria-label={fav[id] ? 'Unfavorite' : 'Favorite'} onClick={() => { setFav({ ...fav, [id]: !fav[id] }); useOS.getState().showToast(fav[id] ? 'Removed from Favorites' : 'Added to Favorites') }}>
      <Star size={18} fill={fav[id] ? '#fff' : 'none'} />
    </button>
  )
}

function MoreButton({ track, onArtist, onAlbum }: { track: Track; onArtist: (a: string) => void; onAlbum: (a: string) => void }) {
  return (
    <button
      className="mu-np-round"
      aria-label="More"
      onClick={(e) =>
        openMenu(e.currentTarget, [
          { label: 'Go to Album', onSelect: () => onAlbum(track.album) },
          { label: 'Go to Artist', onSelect: () => onArtist(track.artist) },
          { label: 'Add to Library', onSelect: () => useOS.getState().showToast('Added to Library') },
          { label: 'Share Song…', onSelect: () => useOS.getState().set({ shareRequest: { title: `${track.title} — ${track.artist}`, kind: 'link', payload: `music.example/song/${track.id}`, app: 'music' } }) },
          { label: 'Create Station', separatorBefore: true, onSelect: () => useOS.getState().playTrack(track.id, TRACKS.filter((t) => t.artist === track.artist || Math.abs(t.bpm - track.bpm) < 12).map((t) => t.id), `${track.title} Station`) },
        ])
      }
    >
      <Ellipsis size={18} />
    </button>
  )
}

function AirplayLabel() {
  const ap = useOS((s) => s.nowPlaying.airplay)
  const pods = useOS((s) => s.airpods.connected)
  const cur = ap ?? (pods ? 'airpods' : 'iphone')
  const label = cur === 'airpods' ? 'AirPods Pro 3' : cur === 'homepod' ? 'HomePod mini' : cur === 'tv' ? 'Living Room TV' : 'iPhone'
  return <span className="mu-airplay-label">{label}</span>
}

// ---------------------------------------------------------------- scrubber
function Scrubber({ track }: { track: Track }) {
  const pos = usePosition()
  const seek = useOS((s) => s.seek)
  const [drag, setDrag] = useState<number | null>(null)
  const bar = useRef<HTMLDivElement>(null)
  const shown = drag ?? Math.min(pos, track.duration)
  const frac = shown / track.duration
  const fromX = (x: number) => {
    const r = bar.current!.getBoundingClientRect()
    return Math.min(1, Math.max(0, (x - r.left) / r.width)) * track.duration
  }
  return (
    <div className="mu-scrub-wrap">
      <div
        className={`mu-scrub ${drag !== null ? 'active' : ''}`}
        ref={bar}
        role="slider"
        aria-label="Playback position"
        aria-valuemin={0}
        aria-valuemax={track.duration}
        aria-valuenow={Math.round(shown)}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight') seek(Math.min(track.duration - 1, pos + 5))
          if (e.key === 'ArrowLeft') seek(Math.max(0, pos - 5))
        }}
        onPointerDown={(e) => {
          e.stopPropagation()
          let v = fromX(e.clientX)
          setDrag(v)
          const move = (ev: PointerEvent) => setDrag((v = fromX(ev.clientX)))
          const up = () => {
            window.removeEventListener('pointermove', move)
            window.removeEventListener('pointerup', up)
            seek(Math.min(track.duration - 0.5, v))
            setDrag(null)
          }
          window.addEventListener('pointermove', move)
          window.addEventListener('pointerup', up)
        }}
      >
        <div className="mu-scrub-track"><div className="mu-scrub-fill" style={{ width: `${frac * 100}%` }} /></div>
      </div>
      <div className="mu-scrub-times">
        <span>{fmtTime(shown)}</span>
        <StreamBadge />
        <span>-{fmtTime(track.duration - shown)}</span>
      </div>
    </div>
  )
}

/** iOS 27: improved streaming reliability — prebuffering, seamless network handoff. */
function StreamBadge() {
  const net = useOS((s) => s.net)
  const latency = useMix((m) => m.startLatency)
  const [open, setOpen] = useState(false)
  const offline = net.airplane || (!net.wifi && !net.cellular)
  const path = offline ? 'offline' : net.wifi ? 'wifi' : 'cell'
  const label = offline ? 'Downloaded' : path === 'wifi' ? 'Lossless' : 'High Quality'
  return (
    <span className="mu-stream">
      <button className={`mu-stream-pill ${path}`} onClick={(e) => { e.stopPropagation(); setOpen((o) => !o) }} aria-expanded={open} aria-label={`Streaming: ${label}`}>
        {path === 'offline' ? <WifiOff size={11} /> : path === 'wifi' ? <AudioLines size={12} /> : <Signal size={11} />}
        {label}
      </button>
      {open && (
        <span className="mu-stream-pop anim-pop" onClick={(e) => e.stopPropagation()}>
          <span className="row gap6"><span className={`mu-dot ${path}`} /> <b>{offline ? 'Playing from device' : 'Stream stable'}</b></span>
          <span>{offline ? 'Downloaded songs keep playing without a connection.' : path === 'wifi' ? `Wi-Fi · ${net.wifiNetwork} · ALAC 24-bit/48 kHz` : `${net.cellularType} · AAC 256 kbps · adaptive`}</span>
          <span>Buffered ahead: {offline ? 'Full song' : path === 'wifi' ? '3:10' : '1:25'} · next song prefetched</span>
          <span>Started in {latency.toFixed(2)} s · Seamless Wi-Fi ↔ cellular handoff</span>
          {!offline && <span className="row gap6" style={{ opacity: 0.8 }}>{path === 'wifi' ? <Wifi size={12} /> : <Signal size={12} />} Connectivity Assist {net.connectivityAssist ? 'On' : 'Off'}</span>}
        </span>
      )}
    </span>
  )
}

// ---------------------------------------------------------------- transport
function Transport() {
  const np = useOS((s) => s.nowPlaying)
  const st = useOS.getState
  const [bump, setBump] = useState<'prev' | 'next' | null>(null)
  const press = (which: 'prev' | 'next') => {
    setBump(which)
    window.setTimeout(() => setBump(null), 260)
    if (which === 'prev') st().prevTrack()
    else st().nextTrack()
  }
  return (
    <div className="mu-transport">
      <button aria-label="Previous" className={bump === 'prev' ? 'bump' : ''} onClick={() => press('prev')}><SkipBack size={34} fill="currentColor" strokeWidth={0} /></button>
      <button aria-label={np.playing ? 'Pause' : 'Play'} className="mu-play" onClick={() => st().togglePlay()}>
        {np.playing ? <Pause size={46} fill="currentColor" strokeWidth={0} /> : <Play size={46} fill="currentColor" strokeWidth={0} style={{ marginLeft: 4 }} />}
      </button>
      <button aria-label="Next" className={bump === 'next' ? 'bump' : ''} onClick={() => press('next')}><SkipForward size={34} fill="currentColor" strokeWidth={0} /></button>
    </div>
  )
}

function Volume() {
  const volume = useOS((s) => s.volume)
  const set = useOS((s) => s.set)
  return (
    <div className="mu-volume">
      <Slider value={volume} onChange={(v) => set({ volume: v })} left={<Volume1 size={16} />} right={<Volume2 size={18} />} label="Volume" color="#fff" />
    </div>
  )
}

// ---------------------------------------------------------------- lyrics
interface LyricLine { t: number; text: string }
export function lyricTimeline(track: Track): LyricLine[] {
  if (!track.lyrics?.length) return []
  const bar = (4 * 60) / track.bpm
  const lineLen = bar * 2
  const out: LyricLine[] = [{ t: 0, text: '♪' }]
  let t = bar * 4
  let rep = 0
  while (t + lineLen * track.lyrics.length < track.duration - 12) {
    for (const l of track.lyrics) {
      out.push({ t, text: l })
      t += lineLen
    }
    rep++
    out.push({ t, text: '♪' })
    t += bar * (rep % 2 ? 4 : 2)
  }
  return out
}

function Lyrics({ track }: { track: Track }) {
  const pos = usePosition()
  const seek = useOS((s) => s.seek)
  const lines = useMemo(() => lyricTimeline(track), [track])
  const cur = lines.reduce((acc, l, i) => (l.t <= pos ? i : acc), 0)
  const box = useRef<HTMLDivElement>(null)
  const userScroll = useRef(0)
  useEffect(() => {
    const el = box.current?.querySelector(`[data-i="${cur}"]`) as HTMLElement | null
    if (!el || !box.current || Date.now() - userScroll.current < 2500) return
    box.current.scrollTo({ top: el.offsetTop - box.current.clientHeight * 0.28, behavior: 'smooth' })
  }, [cur])
  if (!lines.length) {
    return (
      <div className="mu-np-lyrics empty">
        <Visualizer height={120} />
        <div className="t-headline" style={{ marginTop: 16 }}>Lyrics aren’t available</div>
        <div className="mu-np-sub">This song is instrumental in your library. Enjoy the visualizer.</div>
      </div>
    )
  }
  return (
    <div className="mu-np-lyrics scroll" ref={box} onWheel={() => (userScroll.current = Date.now())} onTouchMove={() => (userScroll.current = Date.now())}>
      {lines.map((l, i) => (
        <button key={i} data-i={i} className={`mu-lyric ${i === cur ? 'cur' : i < cur ? 'past' : ''} ${l.text === '♪' ? 'inst' : ''}`} onClick={() => { userScroll.current = 0; seek(l.t + 0.05) }}>
          {l.text === '♪' ? <span className="mu-dots"><i /><i /><i /></span> : l.text}
        </button>
      ))}
      <div className="mu-lyric-credit">Written by Rin Adeyemi & Theo Brandt · Time-synced lyrics</div>
    </div>
  )
}

// ---------------------------------------------------------------- visualizer
export function Visualizer({ height = 60, bars = 32 }: { height?: number; bars?: number }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const playing = useOS((s) => s.nowPlaying.playing)
  const hue = trackById(useOS((s) => s.nowPlaying.trackId))?.hue ?? 200
  useEffect(() => {
    const c = canvas.current!
    const ctx = c.getContext('2d')
    if (!ctx) return
    const W = (c.width = c.offsetWidth * 2)
    const H = (c.height = height * 2)
    const data = new Uint8Array(128)
    const smooth = new Float32Array(bars)
    let raf = 0
    const draw = (t: number) => {
      const an = audioAnalyser()
      if (an && playing) an.getByteFrequencyData(data)
      ctx.clearRect(0, 0, W, H)
      const bw = W / bars
      for (let i = 0; i < bars; i++) {
        let v: number
        if (an && playing) v = data[Math.floor((i / bars) ** 1.4 * 90)] / 255
        else v = playing ? 0.25 + 0.2 * Math.sin(t / 180 + i * 0.7) * Math.sin(t / 420 + i) : 0.04
        smooth[i] += (v - smooth[i]) * 0.3
        const bh = Math.max(4, smooth[i] * H * 0.95)
        ctx.fillStyle = `hsla(${(hue + i * 3) % 360} 90% 75% / .9)`
        const x = i * bw + bw * 0.18
        const w = bw * 0.64
        const r = Math.min(w / 2, 6)
        ctx.beginPath()
        ctx.roundRect(x, (H - bh) / 2, w, bh, r)
        ctx.fill()
      }
      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [playing, hue, height, bars])
  return <canvas ref={canvas} className="mu-viz" style={{ height, width: '100%' }} aria-label="Audio visualizer" />
}

// ---------------------------------------------------------------- queue + AutoMix
function Queue() {
  const np = useOS((s) => s.nowPlaying)
  const automix = useOS((s) => s.automix)
  const crossfade = useOS((s) => s.crossfade)
  const set = useOS((s) => s.set)
  const idx = np.queue.indexOf(np.trackId)
  const upcoming = [...np.queue.slice(idx + 1), ...np.queue.slice(0, Math.max(0, idx))]
  const [dragI, setDragI] = useState<number | null>(null)
  const [dragY, setDragY] = useState(0)
  const ROW = 58

  const setUpcoming = (list: string[]) => set({ nowPlaying: { ...useOS.getState().nowPlaying, queue: [np.trackId, ...list] } })

  const toggleShuffle = () => {
    const s = !np.shuffle
    const list = s ? [...upcoming].sort(() => Math.random() - 0.5) : [...upcoming].sort((a, b) => TRACKS.findIndex((t) => t.id === a) - TRACKS.findIndex((t) => t.id === b))
    set({ nowPlaying: { ...np, shuffle: s, queue: [np.trackId, ...list] } })
  }
  const cycleRepeat = () => set({ nowPlaying: { ...np, repeat: np.repeat === 'off' ? 'all' : np.repeat === 'all' ? 'one' : 'off' } })

  const previewAutoMix = () => {
    const st = useOS.getState()
    const tr = trackById(st.nowPlaying.trackId)
    if (!tr) return
    if (!st.automix) st.set({ automix: true })
    const pos = tr.duration - Math.max(12, st.crossfade + 5)
    if (!st.nowPlaying.playing) st.togglePlay()
    useOS.getState().seek(pos)
    st.showToast('Previewing AutoMix transition…')
  }

  return (
    <div className="mu-np-queue">
      <div className="mu-q-toggles">
        <button className={np.shuffle ? 'on' : ''} aria-pressed={np.shuffle} onClick={toggleShuffle} aria-label="Shuffle"><Shuffle size={18} /></button>
        <button className={np.repeat !== 'off' ? 'on' : ''} aria-pressed={np.repeat !== 'off'} onClick={cycleRepeat} aria-label={`Repeat ${np.repeat}`}>{np.repeat === 'one' ? <Repeat1 size={18} /> : <Repeat size={18} />}</button>
        <button className={automix ? 'on' : ''} aria-pressed={automix} onClick={() => set({ automix: !automix })} aria-label="AutoMix"><InfinityIcon size={20} /><span>AutoMix</span></button>
      </div>
      <div className="scroll mu-q-scroll">
        <div className="mu-q-automix">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <div>
              <div className="t-headline row gap6"><Sparkles size={15} /> AutoMix</div>
              <div className="mu-np-sub t-footnote">{automix ? 'Songs transition seamlessly, tempo- and beat-matched like a DJ.' : 'Off — songs play back to back.'}</div>
            </div>
          </div>
          <div className="mu-q-fade">
            <span className="t-footnote">Transition</span>
            <Slider value={crossfade} min={3} max={12} step={1} onChange={(v) => set({ crossfade: Math.round(v) })} label="Crossfade length" color="#fff" />
            <span className="t-footnote mu-mono">{crossfade}s</span>
          </div>
          <button className="mu-preview-btn" onClick={previewAutoMix}><Sparkles size={15} /> Preview AutoMix</button>
          <MixHistory />
        </div>
        <div className="mu-q-head">
          <div className="t-headline">Playing Next</div>
          <div className="mu-np-sub t-footnote">{np.source ? `From ${np.source}` : 'From your Library'}</div>
        </div>
        <div className="mu-q-list" style={{ height: upcoming.length * ROW }}>
          {upcoming.map((id, i) => {
            const t = trackById(id)
            if (!t) return null
            let y = i * ROW
            if (dragI !== null) {
              const target = Math.max(0, Math.min(upcoming.length - 1, Math.round((dragI * ROW + dragY) / ROW)))
              if (i === dragI) y = dragI * ROW + dragY
              else if (dragI < i && i <= target) y -= ROW
              else if (target <= i && i < dragI) y += ROW
            }
            return (
              <div key={id} className={`mu-q-row ${i === dragI ? 'dragging' : ''}`} style={{ transform: `translateY(${y}px)`, transition: i === dragI ? 'none' : undefined }}>
                <button className="mu-q-remove" aria-label={`Remove ${t.title}`} onClick={() => setUpcoming(upcoming.filter((x) => x !== id))}><MinusCircle size={20} /></button>
                <button className="mu-q-main" onClick={() => useOS.getState().playTrack(id, np.queue, np.source)}>
                  <AlbumArt track={t} size={42} radius={6} />
                  <span className="grow" style={{ minWidth: 0, textAlign: 'left' }}>
                    <span className="nowrap" style={{ display: 'block' }}>{t.title}</span>
                    <span className="mu-np-sub t-footnote nowrap" style={{ display: 'block' }}>{t.artist} · {t.bpm} BPM</span>
                  </span>
                </button>
                <span
                  className="mu-q-grip"
                  role="button"
                  aria-label={`Reorder ${t.title}`}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowUp' && i > 0) { const l = [...upcoming]; [l[i - 1], l[i]] = [l[i], l[i - 1]]; setUpcoming(l) }
                    if (e.key === 'ArrowDown' && i < upcoming.length - 1) { const l = [...upcoming]; [l[i + 1], l[i]] = [l[i], l[i + 1]]; setUpcoming(l) }
                  }}
                  onPointerDown={(e) => {
                    e.stopPropagation()
                    e.preventDefault()
                    const y0 = e.clientY
                    const s = screenScale()
                    setDragI(i)
                    setDragY(0)
                    let dy = 0
                    const move = (ev: PointerEvent) => setDragY((dy = (ev.clientY - y0) / s))
                    const up = () => {
                      window.removeEventListener('pointermove', move)
                      window.removeEventListener('pointerup', up)
                      const target = Math.max(0, Math.min(upcoming.length - 1, Math.round((i * ROW + dy) / ROW)))
                      const l = [...upcoming]
                      const [m] = l.splice(i, 1)
                      l.splice(target, 0, m)
                      setDragI(null)
                      setDragY(0)
                      setUpcoming(l)
                    }
                    window.addEventListener('pointermove', move)
                    window.addEventListener('pointerup', up)
                  }}
                >
                  <GripVertical size={20} />
                </span>
              </div>
            )
          })}
        </div>
        {!upcoming.length && <div className="mu-np-sub center" style={{ padding: 20 }}>Nothing up next. Add songs from your Library.</div>}
      </div>
    </div>
  )
}

function MixHistory() {
  const history = useMix((m) => m.history)
  if (!history.length) return null
  return (
    <div className="mu-mix-hist">
      {history.slice(0, 3).map((h) => {
        const a = trackById(h.from)
        const b = trackById(h.to)
        return <div key={h.start} className="t-caption1 mu-np-sub nowrap"><Check size={11} /> {a?.title} → {b?.title} · {a?.bpm}→{b?.bpm} BPM matched</div>
      })}
    </div>
  )
}

/** Shown near the end of a song (analysis) and during an AutoMix crossfade (beat alignment). */
function AutoMixBanner() {
  const pos = usePosition()
  const np = useOS((s) => s.nowPlaying)
  const automix = useOS((s) => s.automix)
  const crossfade = useOS((s) => s.crossfade)
  const transition = useMix((m) => m.transition)
  const track = trackById(np.trackId)
  if (!automix || !track || np.kind !== 'music') return null
  if (transition && transition.to === np.trackId) return <MixViz from={transition.from} to={transition.to} start={transition.start} len={transition.len} />
  const remaining = track.duration - pos
  if (np.playing && remaining < crossfade + 9 && remaining > crossfade) {
    const i = np.queue.indexOf(np.trackId)
    const next = trackById(np.queue[(i + 1) % np.queue.length])
    return (
      <div className="mu-mix-soon anim-fade">
        <Sparkles size={13} /> AutoMix · analyzing “{next?.title}” — {track.bpm} → {next?.bpm} BPM, {track.key} → {next?.key}
        <span className="mu-mix-count">{Math.ceil(remaining - crossfade)}s</span>
      </div>
    )
  }
  return null
}

function MixViz({ from, to, start, len }: { from: string; to: string; start: number; len: number }) {
  const a = trackById(from)!
  const b = trackById(to)!
  const canvas = useRef<HTMLCanvasElement>(null)
  const [p, setP] = useState(0)
  useEffect(() => {
    const c = canvas.current!
    const ctx = c.getContext('2d')!
    const W = (c.width = c.offsetWidth * 2)
    const H = (c.height = 108)
    const wa = waveform(from, 96)
    const wb = waveform(to, 96)
    let raf = 0
    const draw = () => {
      const now = Date.now()
      const prog = Math.min(1, (now - start) / (len * 1000))
      setP(prog)
      ctx.clearRect(0, 0, W, H)
      const secs = (now - start) / 1000
      // tempo: incoming track is time-stretched to the outgoing tempo, then eases back to its own
      const matched = a.bpm
      const bpmB = prog < 0.7 ? matched : matched + (b.bpm - matched) * ((prog - 0.7) / 0.3)
      const pxPerSec = 70
      const lane = (y: number, wave: number[], bpm: number, alpha: number, hue: number, phase: number) => {
        const beat = 60 / bpm
        ctx.globalAlpha = alpha
        // waveform bars scroll left
        const step = W / 64
        const off = ((secs * pxPerSec) % step)
        for (let i = 0; i < 66; i++) {
          const x = i * step - off
          const amp = wave[(i + Math.floor((secs * pxPerSec) / step)) % wave.length]
          const hh = amp * 36
          ctx.fillStyle = `hsl(${hue} 90% 72%)`
          ctx.fillRect(x, y - hh / 2, step * 0.55, hh)
        }
        // beat grid
        const beatPx = beat * pxPerSec
        const bo = ((secs + phase) * pxPerSec) % beatPx
        for (let x = -bo; x < W; x += beatPx) {
          ctx.fillStyle = 'rgba(255,255,255,.9)'
          ctx.fillRect(x, y - 22, 2, 44)
        }
        ctx.globalAlpha = 1
      }
      const phaseB = prog < 0.25 ? (1 - prog / 0.25) * 0.18 : 0 // phase drifts into alignment
      lane(28, wa, a.bpm, 1 - prog * 0.85, a.hue, 0)
      lane(80, wb, bpmB, 0.25 + prog * 0.75, b.hue, phaseB)
      // playhead
      ctx.fillStyle = '#fff'
      ctx.fillRect(W / 2 - 1, 0, 3, H)
      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [from, to, start, len, a.bpm, b.bpm, a.hue, b.hue])
  const aligned = p > 0.25
  return (
    <div className="mu-mixviz anim-pop" role="status" aria-label="AutoMix transition">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <span className="mu-mixviz-tag"><InfinityIcon size={14} /> AutoMix</span>
        <span className="t-caption1">{aligned ? `${a.bpm} → ${b.bpm} BPM matched` : 'Aligning beats…'}</span>
      </div>
      <canvas ref={canvas} className="mu-mixviz-canvas" />
      <div className="row mu-mixviz-meta">
        <span className="nowrap">{a.title} <em>{a.key} · {KEY_WHEEL[a.key] ?? '—'}</em></span>
        <ChevronDown size={12} style={{ transform: 'rotate(-90deg)' }} />
        <span className="nowrap">{b.title} <em>{b.key} · {KEY_WHEEL[b.key] ?? '—'}</em></span>
      </div>
      <div className="mu-mixviz-bar"><div style={{ width: `${p * 100}%` }} /></div>
    </div>
  )
}

// ---------------------------------------------------------------- AirPlay
function AirplayPicker({ open, onClose }: { open: boolean; onClose: () => void }) {
  const np = useOS((s) => s.nowPlaying)
  const pods = useOS((s) => s.airpods.connected)
  const volume = useOS((s) => s.volume)
  const cur = np.airplay ?? (pods ? 'airpods' : 'iphone')
  const devices = [
    { id: 'iphone', name: 'iPhone', sub: 'This iPhone', icon: <MonitorSmartphone size={20} /> },
    { id: 'airpods', name: 'Jamie’s AirPods Pro 3', sub: pods ? 'Connected · Adaptive Audio' : 'Not connected', icon: <Headphones size={20} /> },
    { id: 'homepod', name: 'HomePod mini', sub: 'Jamie’s Room', icon: <Speaker size={20} /> },
    { id: 'tv', name: 'Living Room TV', sub: 'Living Room', icon: <Tv size={20} /> },
  ]
  return (
    <Sheet open={open} onClose={onClose} detent="auto" title="AirPlay" className="mu-airplay-sheet">
      <div style={{ padding: '4px 16px 28px' }}>
        <div className="mu-ap-list">
          {devices.map((d) => (
            <button
              key={d.id}
              className={`mu-ap-row ${cur === d.id ? 'on' : ''}`}
              onClick={() => {
                useOS.getState().set({ nowPlaying: { ...useOS.getState().nowPlaying, airplay: d.id } })
                if (d.id !== 'iphone') useOS.getState().flashIsland({ kind: d.id === 'airpods' ? 'airpods' : 'airplay', title: d.name, subtitle: 'Connected in 0.4 s', duration: 1800 })
                onClose()
              }}
            >
              <span className="mu-ap-icon">{d.icon}</span>
              <span className="grow" style={{ textAlign: 'left' }}>
                <span style={{ display: 'block' }}>{d.name}</span>
                <span className="t-footnote" style={{ color: 'var(--label-secondary)' }}>{d.sub}</span>
              </span>
              {cur === d.id ? <Check size={20} color="var(--accent)" /> : <span className="mu-ap-circle" />}
            </button>
          ))}
        </div>
        <div style={{ marginTop: 14 }}>
          <Slider value={volume} onChange={(v) => useOS.getState().set({ volume: v })} left={<Volume1 size={16} />} right={<Volume2 size={18} />} label="Volume" />
        </div>
      </div>
    </Sheet>
  )
}
