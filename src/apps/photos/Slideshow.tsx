import { useEffect, useMemo, useRef, useState } from 'react'
import { X, Play, Pause, Music, Check, Film, Plus, SkipForward } from 'lucide-react'
import { useOS } from '../../os/store'
import { TRACKS } from '../../os/data/media'
import { Slider, Switch, Button } from '../../ui/controls'
import { AlbumArt } from '../../shell/widgets/AlbumArt'
import type { Photo } from '../../os/types'
import { PhotoView } from './PhotoView'
import { PhotoPickerSheet } from './Sheets'
import { useUI, usePhotoMap } from './pstore'
import { useBackHandler } from './back'

type Theme = 'kenburns' | 'classic' | 'origami'
const THEMES: { id: Theme; label: string; desc: string }[] = [
  { id: 'kenburns', label: 'Ken Burns', desc: 'Slow pan & zoom' },
  { id: 'classic', label: 'Classic', desc: 'Gentle crossfade' },
  { id: 'origami', label: 'Origami', desc: 'Folding panels' },
]

export function Slideshow() {
  const s = useUI((x) => x.slideshow)
  if (!s) return null
  return <SlideshowInner key={s.ids.join(',')} ids={s.ids} title={s.title} autoplay={!!s.autoplay} />
}

function SlideshowInner({ ids: initial, title, autoplay }: { ids: string[]; title: string; autoplay: boolean }) {
  const map = usePhotoMap()
  const [ids, setIds] = useState(initial)
  const [off, setOff] = useState<Set<string>>(new Set())
  const [theme, setTheme] = useState<Theme>('kenburns')
  const [track, setTrack] = useState<string | null>('t5')
  const [dur, setDur] = useState(3)
  const [loop, setLoop] = useState(true)
  const [phase, setPhase] = useState<'setup' | 'play'>(autoplay ? 'play' : 'setup')
  const [pick, setPick] = useState(false)
  const [exporting, setExporting] = useState(0)
  const ref = useRef<HTMLDivElement>(null)
  const photos = useMemo(() => ids.filter((i) => !off.has(i)).map((i) => map.get(i)).filter(Boolean) as Photo[], [ids, off, map])
  const close = () => useUI.getState().set({ slideshow: null })
  useBackHandler(true, () => (phase === 'play' && !autoplay ? setPhase('setup') : close()), ref)

  const exportVideo = () => {
    if (!photos.length) return
    setExporting(0.01)
    const t0 = performance.now()
    const iv = window.setInterval(() => {
      const p = Math.min(1, (performance.now() - t0) / 1800)
      setExporting(p)
      if (p >= 1) {
        window.clearInterval(iv)
        const first = photos[0]
        const t = TRACKS.find((x) => x.id === track)
        useOS.getState().addPhoto({
          scene: first.scene,
          ts: Date.now(),
          kind: 'video',
          duration: photos.length * dur,
          place: first.place,
          keywords: ['slideshow', 'memory', 'movie', THEMES.find((x) => x.id === theme)!.label.toLowerCase(), ...new Set(photos.flatMap((p) => p.keywords.slice(0, 2)))].slice(0, 10),
          capturedByMe: true,
          description: `Slideshow video “${title}” — ${photos.length} photos, ${THEMES.find((x) => x.id === theme)!.label} theme${t ? `, music “${t.title}” by ${t.artist}` : ''}.`,
          camera: 'Photos',
          lens: 'Slideshow export — 1080p',
          width: 1920,
          height: 1080,
          sizeMB: +(photos.length * dur * 0.9).toFixed(1),
          pets: [...new Set(photos.flatMap((p) => p.pets ?? []))],
          people: [...new Set(photos.flatMap((p) => p.people ?? []))],
        })
        setExporting(0)
        useOS.getState().showToast('Slideshow saved as video')
      }
    }, 60)
  }

  return (
    <div className="ph-slideshow" ref={ref} role="dialog" aria-label="Slideshow">
      {phase === 'setup' ? (
        <div className="ph-ss-setup">
          <div className="ph-ss-top">
            <button className="bar-btn icon glass dark-glass interactive" aria-label="Close" onClick={close}><X size={20} /></button>
            <div className="t-headline">Slideshow</div>
            <button className="ph-ss-play-btn interactive" disabled={!photos.length} onClick={() => setPhase('play')}><Play size={16} fill="currentColor" /> Play</button>
          </div>
          <div className="ph-ss-scroll scroll">
            <div className="ph-ss-title">{title}</div>
            <div className="ph-ss-label">PHOTOS · {photos.length} of {ids.length} included</div>
            <div className="ph-ss-strip">
              {ids.map((i) => {
                const p = map.get(i)
                if (!p) return null
                const on = !off.has(i)
                return (
                  <button key={i} className={`ph-ss-thumb ${on ? '' : 'off'}`} onClick={() => setOff((s) => { const n = new Set(s); if (n.has(i)) n.delete(i); else n.add(i); return n })} aria-pressed={on} aria-label={`${on ? 'Exclude' : 'Include'} photo`}>
                    <PhotoView photo={p} />
                    <span className={`ph-check ${on ? 'on' : ''}`}>{on && <Check size={12} strokeWidth={3.4} />}</span>
                  </button>
                )
              })}
              <button className="ph-ss-thumb add" onClick={() => setPick(true)} aria-label="Add photos"><Plus size={24} /></button>
            </div>
            <div className="ph-ss-label">THEME</div>
            <div className="ph-ss-themes">
              {THEMES.map((t) => (
                <button key={t.id} className={`ph-ss-theme ${theme === t.id ? 'on' : ''}`} onClick={() => setTheme(t.id)} aria-pressed={theme === t.id}>
                  <div className={`ph-ss-theme-prev ${t.id}`}>{photos[0] && <PhotoView photo={photos[0]} />}</div>
                  <span className="t-subhead bold">{t.label}</span>
                  <span className="t-caption1">{t.desc}</span>
                </button>
              ))}
            </div>
            <div className="ph-ss-label">MUSIC</div>
            <div className="ph-ss-music">
              <button className={`ph-ss-track ${track === null ? 'on' : ''}`} onClick={() => setTrack(null)}><span className="ph-ss-none"><Music size={18} /></span><span className="grow">None</span>{track === null && <Check size={18} />}</button>
              {TRACKS.slice(0, 8).map((t) => (
                <button key={t.id} className={`ph-ss-track ${track === t.id ? 'on' : ''}`} onClick={() => setTrack(t.id)}>
                  <span className="ph-ss-art"><AlbumArt track={t} size={36} /></span>
                  <span className="grow" style={{ textAlign: 'left' }}><span className="t-subhead" style={{ display: 'block' }}>{t.title}</span><span className="t-caption1">{t.artist}</span></span>
                  {track === t.id && <Check size={18} />}
                </button>
              ))}
            </div>
            <div className="ph-ss-label">TIMING</div>
            <div className="ph-ss-row"><span>Each photo</span><span className="grow"><Slider value={dur} min={2} max={6} step={0.5} onChange={setDur} label="Seconds per photo" color="#fff" /></span><span className="ph-ss-val">{dur.toFixed(1)}s</span></div>
            <div className="ph-ss-row"><span className="grow">Repeat</span><Switch checked={loop} onChange={setLoop} label="Repeat" /></div>
            <div className="ph-ss-row"><span className="grow">Length</span><span className="ph-ss-val">{Math.round(photos.length * dur)}s</span></div>
            <Button block variant="glass" className="ph-ss-save" disabled={!photos.length || exporting > 0} onClick={exportVideo}><Film size={17} /> Save as Video</Button>
            <div style={{ height: 40 }} />
          </div>
          {exporting > 0 && (
            <div className="ph-ss-export">
              <div className="t-headline">Exporting Video…</div>
              <div className="ph-cu-progress" style={{ width: 200 }}><div style={{ width: `${exporting * 100}%` }} /></div>
              <div className="t-footnote">1080p · {photos.length} photos</div>
            </div>
          )}
          <PhotoPickerSheet open={pick} exclude={ids} onClose={() => setPick(false)} onPick={(n) => setIds((x) => [...x, ...n])} />
        </div>
      ) : (
        <Player photos={photos} theme={theme} setTheme={setTheme} track={track} dur={dur} loop={loop} title={title} onExit={() => (autoplay ? close() : setPhase('setup'))} onSave={exportVideo} exporting={exporting} />
      )}
    </div>
  )
}

function Player({ photos, theme, setTheme, track, dur, loop, title, onExit, onSave, exporting }: { photos: Photo[]; theme: Theme; setTheme: (t: Theme) => void; track: string | null; dur: number; loop: boolean; title: string; onExit: () => void; onSave: () => void; exporting: number }) {
  const [i, setI] = useState(0)
  const [prev, setPrev] = useState<number | null>(null)
  const [playing, setPlaying] = useState(true)
  const [chrome, setChrome] = useState(false)
  const [showTitle, setShowTitle] = useState(true)
  const lowPower = useOS((s) => s.lowPower)

  // Music through the system player
  useEffect(() => {
    if (!track) return
    useOS.getState().playTrack(track, [track], 'Slideshow')
    return () => {
      const np = useOS.getState().nowPlaying
      if (np.source === 'Slideshow' && np.playing) useOS.getState().togglePlay()
    }
  }, [track])
  useEffect(() => {
    const np = useOS.getState().nowPlaying
    if (track && np.source === 'Slideshow' && np.playing !== playing) useOS.getState().togglePlay()
  }, [playing, track])
  useEffect(() => {
    const t = window.setTimeout(() => setShowTitle(false), 2600)
    return () => window.clearTimeout(t)
  }, [])
  useEffect(() => {
    if (!playing || photos.length < 2) return
    const t = window.setTimeout(() => {
      if (i + 1 >= photos.length && !loop) {
        setPlaying(false)
        return
      }
      setPrev(i)
      setI((i + 1) % photos.length)
    }, dur * 1000)
    return () => window.clearTimeout(t)
  }, [i, playing, dur, photos.length, loop])
  useEffect(() => {
    if (prev === null) return
    const t = window.setTimeout(() => setPrev(null), 1100)
    return () => window.clearTimeout(t)
  }, [prev])

  const cur = photos[i]
  if (!cur) return null
  return (
    <div className={`ph-ss-player ${theme}`} onClick={() => setChrome((c) => !c)}>
      {prev !== null && photos[prev] && (
        <div key={`p-${prev}-${i}`} className={`ph-ss-slide out ${theme}`} style={{ ['--d' as string]: `${dur}s` }}>
          <PhotoView photo={photos[prev]} />
        </div>
      )}
      <div key={`c-${i}-${prev}`} className={`ph-ss-slide in ${theme} ${playing ? '' : 'paused'}`} style={{ ['--d' as string]: `${dur + 1}s` }}>
        {theme === 'origami' ? (
          <>
            <div className="ph-ss-half l"><PhotoView photo={cur} grain={!lowPower} /></div>
            <div className="ph-ss-half r"><PhotoView photo={cur} grain={!lowPower} /></div>
          </>
        ) : <PhotoView photo={cur} grain={!lowPower} />}
      </div>
      {showTitle && <div className="ph-ss-caption"><div className="ph-ss-caption-title">{title}</div><div className="t-subhead">{photos.length} photos</div></div>}
      <div className={`ph-ss-chrome ${chrome ? 'show' : ''}`} onClick={(e) => e.stopPropagation()}>
        <div className="ph-ss-ptop">
          <button className="bar-btn icon glass dark-glass interactive" aria-label="Exit slideshow" onClick={onExit}><X size={20} /></button>
          <div className="ph-ss-progress">{photos.map((p, k) => <span key={p.id} className={k < i ? 'done' : k === i ? 'cur' : ''} style={k === i && playing ? { ['--d' as string]: `${dur}s` } : undefined} />)}</div>
        </div>
        <div className="ph-ss-pbottom">
          <div className="ph-ss-themes-mini glass dark-glass">
            {THEMES.map((t) => <button key={t.id} className={theme === t.id ? 'on' : ''} onClick={() => setTheme(t.id)}>{t.label}</button>)}
          </div>
          <div className="row gap12">
            <button className="ph-v-circle glass dark-glass interactive" aria-label={playing ? 'Pause' : 'Play'} onClick={() => setPlaying(!playing)}>{playing ? <Pause size={20} fill="#fff" /> : <Play size={20} fill="#fff" />}</button>
            <button className="ph-v-circle glass dark-glass interactive" aria-label="Next photo" onClick={() => { setPrev(i); setI((i + 1) % photos.length) }}><SkipForward size={20} fill="#fff" /></button>
            <button className="ph-pill-btn glass dark-glass interactive" disabled={exporting > 0} onClick={onSave}><Film size={16} /> {exporting > 0 ? `${Math.round(exporting * 100)}%` : 'Save as Video'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}
