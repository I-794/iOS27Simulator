import { useEffect, useMemo, useRef, useState } from 'react'
import { Play, Pause, Share, Download, Search as SearchIcon, ShieldCheck, Mic, MicOff, Volume2, VolumeX, Package, Dog, Car, User, Moon, Leaf, Sparkles, ChevronRight, Radio } from 'lucide-react'
import { Page, useNav, BarButton } from '../../ui/nav'
import { List, Row } from '../../ui/list'
import { SearchField, AISparkle, Chip } from '../../ui/controls'
import { Scene } from '../../art/Scene'
import { useOS } from '../../os/store'
import { useNow, useOnscreen } from '../../os/hooks'
import { search, tokens, stem } from '../../os/search'
import { CAMERA_CLIPS } from '../../os/data/photos'
import { fmtTime, dayLabel, fmtAgo, fmtDuration, startOfDay, HOUR, DAY } from '../../os/time'
import { CAMERA_LIVE, useLightStatusBar } from './lib'
import type { CameraClip } from '../../os/types'

export const CAMERAS = ['Front Door', 'Driveway', 'Backyard']

function clipIcon(c: CameraClip, size = 14) {
  if (c.tags.includes('package')) return <Package size={size} />
  if (c.tags.includes('dog') || c.tags.includes('pet')) return <Dog size={size} />
  if (c.tags.includes('car') || c.tags.includes('vehicle')) return <Car size={size} />
  if (c.tags.includes('night')) return <Moon size={size} />
  if (c.tags.includes('deer') || c.tags.includes('animal')) return <Leaf size={size} />
  return <User size={size} />
}

// ---------------------------------------------------------------- live feed
export function LiveFeed({ camera, big, scene, onClick, motion = true }: { camera: string; big?: boolean; scene?: string; onClick?: () => void; motion?: boolean }) {
  const now = useNow(1000)
  const sc = scene ?? CAMERA_LIVE[camera] ?? 'porch-package'
  const seed = camera.length
  const [motionOn, setMotionOn] = useState(false)
  useEffect(() => {
    if (!motion) return
    const t = window.setInterval(() => setMotionOn((m) => !m && Math.random() < 0.45), 2600 + seed * 300)
    return () => window.clearInterval(t)
  }, [motion, seed])
  const d = new Date(now)
  return (
    <div className={`hm-feed ${big ? 'big' : ''}`} onClick={onClick} role={onClick ? 'button' : undefined} tabIndex={onClick ? 0 : undefined} aria-label={`${camera} live camera`} onKeyDown={(e) => e.key === 'Enter' && onClick?.()}>
      <div className="hm-feed-scene" style={{ animationDelay: `${-seed * 3}s` }}><Scene scene={sc} /></div>
      <div className="hm-feed-noise" />
      {motionOn && <div className="hm-motion-box" style={{ left: `${20 + (seed * 13) % 40}%`, top: `${30 + (seed * 7) % 25}%` }} />}
      <div className="hm-feed-top">
        <span className="hm-live"><i /> LIVE</span>
        <span className="hm-4k">4K · HSV</span>
      </div>
      <div className="hm-feed-bottom">
        <span className="hm-feed-name">{camera}</span>
        <span className="hm-feed-time">{d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', second: '2-digit' })}</span>
      </div>
      {motionOn && <span className="hm-feed-motion">Motion detected</span>}
    </div>
  )
}

// ---------------------------------------------------------------- cameras overview (simultaneous streams + NL search)
export function CamerasPage({ initialQuery }: { initialQuery?: string }) {
  const nav = useNav()
  const [q, setQ] = useState(initialQuery ?? '')
  const [submitted, setSubmitted] = useState(initialQuery ?? '')
  const [thinking, setThinking] = useState(false)
  useOnscreen('home', 'Home cameras', { type: 'camera', scene: 'porch-package' })
  const run = (text: string) => {
    setQ(text)
    setThinking(true)
    window.setTimeout(() => {
      setSubmitted(text)
      setThinking(false)
    }, 420)
  }
  const suggestions = ['Show me when a package was left at the front door', 'When did Biscuit play in the backyard?', 'Cars in the driveway yesterday', 'Animals at night']
  return (
    <Page title="Cameras" bottomExtra={20} trailing={<BarButton label="Activity" onClick={() => nav.push(<ActivityPage />)}><Radio size={20} /></BarButton>}>
      <div className="hm-nlsearch">
        <SearchField value={q} onChange={(v) => { setQ(v); if (!v) setSubmitted('') }} placeholder="Search your camera recordings" onSubmit={() => q.trim() && run(q)} />
        {!submitted && !thinking && (
          <div className="hm-suggest scroll-x">
            {suggestions.map((s) => <Chip key={s} onClick={() => run(s)}><SearchIcon size={13} /> {s}</Chip>)}
          </div>
        )}
      </div>
      {(thinking || submitted) && <SearchResults q={submitted} thinking={thinking} />}
      {!submitted && !thinking && (
        <>
          <div className="hm-section-head"><span>Live · {CAMERAS.length} streams</span><span className="hm-badge-sec"><ShieldCheck size={13} /> HomeKit Secure Video</span></div>
          <div className="hm-feed-grid">
            {CAMERAS.map((c, i) => (
              <div key={c} className={i === 0 ? 'span2' : ''}>
                <LiveFeed camera={c} onClick={() => nav.push(<CameraDetail camera={c} />)} />
              </div>
            ))}
          </div>
          <div className="hm-section-head"><span>Recent Clips</span></div>
          <ClipList clips={[...CAMERA_CLIPS].sort((a, b) => b.ts - a.ts).slice(0, 6)} />
        </>
      )}
    </Page>
  )
}

function SearchResults({ q, thinking }: { q: string; thinking: boolean }) {
  const hits = useMemo(() => (q ? search(q, { types: ['camera'], limit: 10 }).filter((h) => h.score > 3) : []), [q])
  const nav = useNav()
  const qt = useMemo(() => new Set(tokens(q)), [q])
  const expanded = useMemo(() => {
    const s = new Set(qt)
    for (const h of hits) h.matched.forEach((m) => s.add(m))
    return s
  }, [qt, hits])
  if (thinking) return <div className="hm-thinking"><AISparkle size={18} /> Searching video descriptions…</div>
  const best = hits[0] ? CAMERA_CLIPS.find((c) => `cam-${c.id}` === hits[0].id) : undefined
  return (
    <div className="hm-results anim-up">
      <div className="hm-results-sum"><AISparkle size={16} /> {hits.length ? `${hits.length} matching clip${hits.length > 1 ? 's' : ''} found using Video Descriptions` : 'No clips match that description'}</div>
      {best && (
        <button className="hm-best" onClick={() => nav.push(<ClipPage id={best.id} />)}>
          <div className="hm-best-media"><Scene scene={best.scene} /><span className="hm-best-tag">Best match</span><span className="hm-best-play"><Play size={18} fill="#fff" strokeWidth={0} /></span></div>
          <div className="hm-best-text">
            <div className="hm-clip-meta">{best.camera} · {dayLabel(best.ts)} at {fmtTime(best.ts)}</div>
            <div className="hm-desc"><Highlight text={best.description} terms={expanded} /></div>
          </div>
        </button>
      )}
      {hits.slice(1).map((h) => {
        const c = CAMERA_CLIPS.find((x) => `cam-${x.id}` === h.id)
        if (!c) return null
        return (
          <button key={h.id} className="hm-clip-row" onClick={() => nav.push(<ClipPage id={c.id} />)}>
            <div className="hm-clip-thumb"><Scene scene={c.scene} /></div>
            <div className="grow" style={{ textAlign: 'left' }}>
              <div className="hm-clip-meta">{c.camera} · {dayLabel(c.ts)} {fmtTime(c.ts)}</div>
              <div className="hm-desc small"><Highlight text={c.description} terms={expanded} /></div>
            </div>
          </button>
        )
      })}
    </div>
  )
}

function Highlight({ text, terms }: { text: string; terms: Set<string> }) {
  const parts = text.split(/(\s+)/)
  const syn: Record<string, string[]> = { package: ['box', 'parcel', 'envelope', 'cardboard'], door: ['doormat', 'doorbell'], dog: ['biscuit', 'retriever'], car: ['suv', 'van'] }
  const has = (w: string) => {
    const s = stem(w)
    if (terms.has(s)) return true
    return [...terms].some((t) => syn[t]?.some((x) => s.startsWith(x)))
  }
  return <>{parts.map((p, i) => (p.trim() && has(p) ? <mark key={i} className="hm-mark">{p}</mark> : <span key={i}>{p}</span>))}</>
}

export function ClipList({ clips }: { clips: CameraClip[] }) {
  const nav = useNav()
  return (
    <div className="hm-clips">
      {clips.map((c) => (
        <button key={c.id} className="hm-clip-row" onClick={() => nav.push(<ClipPage id={c.id} />)}>
          <div className="hm-clip-thumb"><Scene scene={c.scene} /><span className="hm-clip-dur">{fmtDuration(c.duration)}</span></div>
          <div className="grow" style={{ textAlign: 'left', minWidth: 0 }}>
            <div className="hm-clip-meta"><span className="hm-clip-ic">{clipIcon(c, 12)}</span> {c.camera} · {fmtAgo(c.ts)}</div>
            <div className="hm-desc small">{c.description}</div>
          </div>
        </button>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------- single camera with timeline
export function CameraDetail({ camera }: { camera: string }) {
  const nav = useNav()
  const clips = CAMERA_CLIPS.filter((c) => c.camera === camera).sort((a, b) => a.ts - b.ts)
  const now = useNow(60_000)
  const RANGE = 6 * DAY
  const start = now - RANGE
  const [sel, setSel] = useState<number>(1) // 1 = live
  const [mic, setMic] = useState(false)
  const [muted, setMuted] = useState(true)
  const strip = useRef<HTMLDivElement>(null)
  const selTs = start + sel * RANGE
  const nearest = clips.reduce<CameraClip | null>((best, c) => (Math.abs(c.ts - selTs) < 3 * HOUR && (!best || Math.abs(c.ts - selTs) < Math.abs(best.ts - selTs)) ? c : best), null)
  const live = sel > 0.985
  useLightStatusBar(nav.isTop)
  useOnscreen('home', `Viewing ${camera} camera`, { type: 'camera', scene: nearest && !live ? nearest.scene : CAMERA_LIVE[camera] })
  const setFromX = (x: number) => {
    const r = strip.current!.getBoundingClientRect()
    setSel(Math.min(1, Math.max(0, (x - r.left) / r.width)))
  }
  const days = Array.from({ length: 7 }).map((_, i) => startOfDay(now) - (6 - i) * DAY)
  return (
    <Page title={camera} large={false} bg="#000" className="hm-cam-page">
      <div className="hm-cam-view">
        {live || !nearest ? <LiveFeed camera={camera} big /> : <ClipPlayer clip={nearest} autoPlay />}
      </div>
      <div className="hm-cam-controls">
        <button className={mic ? 'on' : ''} onClick={() => { setMic(!mic); if (!mic) useOS.getState().showToast('Talking through Front Door speaker…') }} aria-label="Talk">{mic ? <Mic size={22} /> : <MicOff size={22} />}</button>
        <button onClick={() => setMuted(!muted)} aria-label={muted ? 'Unmute' : 'Mute'}>{muted ? <VolumeX size={22} /> : <Volume2 size={22} />}</button>
        <button className={live ? 'on live' : ''} onClick={() => setSel(1)} aria-label="Go live">LIVE</button>
      </div>
      <div className="hm-timeline-wrap">
        <div className="hm-tl-label">{live ? 'Live' : `${dayLabel(selTs)} · ${fmtTime(selTs)}`}{nearest && !live ? ` — ${nearest.tags[0]}` : ''}</div>
        <div
          className="hm-timeline"
          ref={strip}
          role="slider"
          aria-label="Recording timeline"
          aria-valuenow={Math.round(sel * 100)}
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'ArrowLeft') setSel((s) => Math.max(0, s - 0.01))
            if (e.key === 'ArrowRight') setSel((s) => Math.min(1, s + 0.01))
          }}
          onPointerDown={(e) => {
            e.stopPropagation()
            setFromX(e.clientX)
            const move = (ev: PointerEvent) => setFromX(ev.clientX)
            const up = () => {
              window.removeEventListener('pointermove', move)
              window.removeEventListener('pointerup', up)
            }
            window.addEventListener('pointermove', move)
            window.addEventListener('pointerup', up)
          }}
        >
          {days.map((d) => <span key={d} className="hm-tl-day" style={{ left: `${((d - start) / RANGE) * 100}%` }}>{new Date(d).toLocaleDateString(undefined, { weekday: 'short' })}</span>)}
          {clips.map((c) => (
            <button key={c.id} className="hm-tl-mark" style={{ left: `${((c.ts - start) / RANGE) * 100}%` }} onClick={(e) => { e.stopPropagation(); setSel((c.ts - start) / RANGE) }} onPointerDown={(e) => e.stopPropagation()} aria-label={`${c.tags[0]} at ${fmtTime(c.ts)}`}>
              {clipIcon(c, 11)}
            </button>
          ))}
          <div className="hm-tl-head" style={{ left: `${sel * 100}%` }} />
        </div>
      </div>
      <div className="hm-cam-list">
        {nearest && !live && (
          <div className="hm-vdesc anim-fade">
            <div className="hm-vdesc-h"><AISparkle size={15} /> Video Description</div>
            <div>{nearest.description}</div>
            <button className="hm-link" onClick={() => nav.push(<ClipPage id={nearest.id} />)}>Open clip <ChevronRight size={14} /></button>
          </div>
        )}
        <div className="hm-section-head dark"><span>Events</span></div>
        {[...clips].reverse().map((c) => (
          <button key={c.id} className="hm-clip-row dark" onClick={() => setSel((c.ts - start) / RANGE)}>
            <div className="hm-clip-thumb"><Scene scene={c.scene} /></div>
            <div className="grow" style={{ textAlign: 'left', minWidth: 0 }}>
              <div className="hm-clip-meta">{dayLabel(c.ts)} · {fmtTime(c.ts)}</div>
              <div className="hm-desc small">{c.description}</div>
            </div>
          </button>
        ))}
      </div>
    </Page>
  )
}

// ---------------------------------------------------------------- clip player + page
export function ClipPlayer({ clip, autoPlay }: { clip: CameraClip; autoPlay?: boolean }) {
  const [t, setT] = useState(0)
  const [playing, setPlaying] = useState(!!autoPlay)
  useEffect(() => { setT(0); setPlaying(!!autoPlay) }, [clip.id, autoPlay])
  useEffect(() => {
    if (!playing) return
    const id = window.setInterval(() => setT((x) => {
      if (x + 0.1 >= clip.duration) { setPlaying(false); return clip.duration }
      return x + 0.1
    }), 100)
    return () => window.clearInterval(id)
  }, [playing, clip.duration])
  const p = t / clip.duration
  return (
    <div className="hm-feed big clip">
      <div className="hm-feed-scene" style={{ transform: `scale(${1.04 + p * 0.08}) translate(${-p * 3}%, ${-p * 1.5}%)`, animation: 'none' }}><Scene scene={clip.scene} /></div>
      <div className="hm-feed-noise" />
      <div className="hm-feed-top"><span className="hm-4k">4K · HSV</span><span className="hm-live rec">{dayLabel(clip.ts)} {fmtTime(clip.ts)}</span></div>
      <button className="hm-clip-pp" onClick={() => { if (t >= clip.duration) setT(0); setPlaying(!playing) }} aria-label={playing ? 'Pause clip' : 'Play clip'}>
        {playing ? <Pause size={26} fill="#fff" strokeWidth={0} /> : <Play size={26} fill="#fff" strokeWidth={0} style={{ marginLeft: 3 }} />}
      </button>
      <div className="hm-clip-bar">
        <span>{fmtDuration(t)}</span>
        <div
          className="hm-clip-track"
          onPointerDown={(e) => {
            const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
            setT(Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)) * clip.duration)
          }}
        >
          <div style={{ width: `${p * 100}%` }} />
        </div>
        <span>{fmtDuration(clip.duration)}</span>
      </div>
    </div>
  )
}

export function ClipPage({ id }: { id: string }) {
  const nav = useNav()
  const clip = CAMERA_CLIPS.find((c) => c.id === id) ?? CAMERA_CLIPS[0]
  const related = CAMERA_CLIPS.filter((c) => c.id !== clip.id && (c.camera === clip.camera || c.tags.some((t) => clip.tags.includes(t)))).slice(0, 4)
  useOnscreen('home', `Viewing ${clip.camera} clip`, { type: 'camera', scene: clip.scene, clipId: clip.id })
  return (
    <Page title={clip.camera} large={false} bottomExtra={20}
      trailing={<BarButton label="Share" onClick={() => useOS.getState().set({ shareRequest: { title: `${clip.camera} clip`, kind: 'file', payload: clip.description, app: 'home' } })}><Share size={20} /></BarButton>}>
      <div style={{ padding: '0 16px' }}>
        <ClipPlayer clip={clip} autoPlay />
      </div>
      <div className="hm-vdesc light">
        <div className="hm-vdesc-h"><AISparkle size={15} /> Video Description</div>
        <div className="hm-vdesc-body">{clip.description}</div>
        <div className="hm-tags">{clip.tags.slice(0, 5).map((t) => <span key={t}>{t}</span>)}</div>
        <div className="hm-vdesc-foot">Generated on your Home hub · Private & end-to-end encrypted</div>
      </div>
      <List>
        <Row title="Camera" detail={clip.camera} />
        <Row title="Recorded" detail={`${dayLabel(clip.ts)}, ${fmtTime(clip.ts)}`} />
        <Row title="Length" detail={fmtDuration(clip.duration)} />
        <Row title="Quality" detail="4K HDR · HomeKit Secure Video" />
      </List>
      <List>
        <Row title="Save to Photos" icon={<Download size={20} color="var(--accent)" />} tint onClick={() => useOS.getState().showToast('Clip saved to Photos')} />
        <Row title="Go to Live View" icon={<Play size={20} color="var(--accent)" />} tint onClick={() => nav.push(<CameraDetail camera={clip.camera} />)} />
      </List>
      {related.length > 0 && (
        <>
          <div className="hm-section-head"><span>Related Activity</span></div>
          <ClipList clips={related} />
        </>
      )}
    </Page>
  )
}

// ---------------------------------------------------------------- activity history with AI summary
export function ActivityPage() {
  const nav = useNav()
  const accs = useOS((s) => s.accessories)
  const [filter, setFilter] = useState<'All' | 'Cameras' | 'Doors & Locks' | 'People'>('All')
  const now = Date.now()
  const events = useMemo(() => {
    const lock = accs.find((a) => a.id === 'h-fp-lock')
    const list: { id: string; ts: number; kind: 'Cameras' | 'Doors & Locks' | 'People'; title: string; body: string; clip?: CameraClip; icon: React.ReactNode }[] = [
      ...CAMERA_CLIPS.map((c) => ({ id: c.id, ts: c.ts, kind: (c.tags.includes('person') ? 'People' : 'Cameras') as 'People' | 'Cameras', title: c.camera, body: c.description, clip: c, icon: clipIcon(c, 16) })),
      { id: 'ev-lock1', ts: now - 3 * HOUR + 4 * 60_000, kind: 'Doors & Locks', title: 'Front Door', body: `Unlocked by Mom with Home Key · ${lock?.locked ? 'Locked again 2 min later' : 'Currently unlocked'}`, icon: <ShieldCheck size={16} /> },
      { id: 'ev-garage', ts: now - 3 * HOUR, kind: 'Doors & Locks', title: 'Garage Door', body: 'Opened and closed automatically on arrival', icon: <ShieldCheck size={16} /> },
      { id: 'ev-gate', ts: now - 55 * 60_000, kind: 'Doors & Locks', title: 'Gate Sensor', body: 'Opened for 2 minutes', icon: <ShieldCheck size={16} /> },
    ]
    return list.sort((a, b) => b.ts - a.ts)
  }, [accs, now])
  const filtered = events.filter((e) => filter === 'All' || e.kind === filter)
  const groups = new Map<string, typeof filtered>()
  for (const e of filtered) {
    const k = dayLabel(e.ts)
    groups.set(k, [...(groups.get(k) ?? []), e])
  }
  return (
    <Page title="Activity" bottomExtra={20}>
      <div className="hm-ai-sum">
        <div className="hm-vdesc-h"><AISparkle size={15} /> Summary</div>
        <p>A package was delivered to the Front Door yesterday at 2:14 PM. Biscuit played in the Backyard about 50 minutes ago, and Mom arrived home in the Driveway 3 hours ago. A raccoon tipped the recycling bin overnight.</p>
        <div className="hm-sum-chips">
          <span><Package size={13} /> 2 deliveries</span><span><User size={13} /> 4 people</span><span><Dog size={13} /> 1 pet</span><span><Leaf size={13} /> 2 animals</span>
        </div>
      </div>
      <div className="hm-filter scroll-x">
        {(['All', 'Cameras', 'People', 'Doors & Locks'] as const).map((f) => <Chip key={f} active={filter === f} onClick={() => setFilter(f)}>{f}</Chip>)}
      </div>
      {[...groups.entries()].map(([day, list]) => (
        <section key={day} className="hm-act-group">
          <div className="hm-act-day">{day}<span>{list.length} events</span></div>
          <div className="hm-act-list">
            {list.map((e) => (
              <button key={e.id} className="hm-act-row" onClick={() => e.clip && nav.push(<ClipPage id={e.clip.id} />)} disabled={!e.clip}>
                <span className="hm-act-ic">{e.icon}</span>
                <span className="grow" style={{ minWidth: 0, textAlign: 'left' }}>
                  <span className="hm-act-title">{e.title} <em>{fmtTime(e.ts)}</em></span>
                  <span className="hm-act-body">{e.body}</span>
                </span>
                {e.clip && <span className="hm-act-thumb"><Scene scene={e.clip.scene} /></span>}
              </button>
            ))}
          </div>
        </section>
      ))}
      <div className="hm-foot-note"><Sparkles size={12} /> iOS 27 summarizes related notifications from your cameras and accessories.</div>
    </Page>
  )
}
