import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Zap, ZapOff, CircleDot, Timer, Sun, Palette, RectangleVertical, FileImage, Grid3x3, Ruler, Aperture, Gauge, Thermometer, BarChart3, ArrowDownToLine, FlipHorizontal2, RefreshCcw, GripVertical, X, BatteryLow, Check, Pin, PinOff, Link2, ChevronRight } from 'lucide-react'
import { useOS } from '../../os/store'
import { useAppRoute, useOnscreen, screenScale } from '../../os/hooks'
import { useShell } from '../../shell/shellState'
import { playAlert } from '../../os/audio'
import { Slider, Switch, Segmented, AISparkle } from '../../ui/controls'
import type { Photo } from '../../os/types'
import { PhotoView } from '../photos/PhotoView'
import { STYLES, SCENE_KEYWORDS, type PhEdits } from '../photos/look'
import { useBackHandler } from '../photos/back'
import { useCam, MODES, lensFor, lensIndex, CONTROLS, APERTURES, SHUTTERS, WBS, type Mode } from './cstore'
import { SceneStrip, SiriReticle, SiriResult, CamScene, answer } from './SiriMode'
import { camInsight } from './extra'
import './camera.css'

type AnyMode = Mode | 'scan'
const VIDEOISH: AnyMode[] = ['video', 'slomo', 'timelapse']
const DARK_SCENES = ['storm', 'city-night', 'night-sky', 'fireworks', 'concert-lights']

function fmtRec(sec: number) {
  const s = Math.floor(sec)
  return `${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor(s / 60) % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

export default function CameraApp() {
  const cam = useCam()
  const orientation = useOS((s) => s.orientation)
  const lowPower = useOS((s) => s.lowPower)
  const land = orientation === 'landscape'
  const [mode, setModeRaw] = useState<AnyMode>('photo')
  const [front, setFront] = useState(false)
  const [scene, setScene] = useState('autumn-trees')
  const [siriScene, setSiriScene] = useState('food-pizza')
  const [zoom, setZoom] = useState(1)
  const [dial, setDial] = useState(false)
  const [panel, setPanel] = useState(false)
  const [editCtl, setEditCtl] = useState(false)
  const [recStart, setRecStart] = useState<number | null>(null)
  const [recNow, setRecNow] = useState(0)
  const [countdown, setCountdown] = useState<number | null>(null)
  const [fx, setFx] = useState<{ kind: 'white' | 'black'; key: number } | null>(null)
  const [fly, setFly] = useState<{ photo: Photo; from: DOMRect; key: number } | null>(null)
  const [focus, setFocus] = useState<{ x: number; y: number; key: number; locked: boolean } | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [result, setResult] = useState(false)
  const [qa, setQa] = useState<{ q: string; a: string }[]>([])
  const [pano, setPano] = useState<number | null>(null)
  const [scanHit, setScanHit] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const vfRef = useRef<HTMLDivElement>(null)
  const wellRef = useRef<HTMLButtonElement>(null)

  const recording = recStart !== null
  const siri = mode === 'siri'
  const vfScene = mode === 'scan' ? 'scan' : siri ? siriScene : front ? 'selfie-group' : mode === 'pano' ? 'panorama-canyon' : scene
  const label = mode === 'scan' ? 'code scanner' : camInsight(vfScene).label

  useEffect(() => {
    useShell.getState().set({ statusOverride: 'light' })
    return () => useShell.getState().set({ statusOverride: null })
  }, [])
  useOnscreen('camera', siri ? `Camera Siri mode pointed at ${label}` : `Camera viewfinder (${mode})`, { type: 'camera', scene: vfScene })

  const setMode = useCallback((m: AnyMode) => {
    if (recStart !== null) return
    setModeRaw(m)
    setResult(false)
    setQa([])
    setPano(null)
    setDial(false)
    if (m === 'siri' || m === 'scan') setFront(false)
    setZoom((z) => (m === 'portrait' ? (z < 1 ? 1 : Math.min(z, 2)) : m === 'siri' || m === 'scan' ? 1 : z))
  }, [recStart])

  useAppRoute('camera', (route) => {
    if (route === 'siri') setMode('siri')
    else if (route === 'video') setMode('video')
    else if (route === 'selfie') { setMode('photo'); setFront(true) }
    else if (route === 'scan') setMode('scan')
  })

  // Recording clock
  useEffect(() => {
    if (recStart === null) return
    const iv = window.setInterval(() => setRecNow(Date.now()), 250)
    return () => window.clearInterval(iv)
  }, [recStart])

  // Leaving Camera or locking the phone ends the recording and saves the clip, as on iPhone
  const stopRef = useRef<() => void>(() => {})
  const away = useOS((s) => s.openApp !== 'camera' || s.locked)
  useEffect(() => {
    if (away && recStart !== null) stopRef.current()
  }, [away, recStart])

  // Lens switch crossfade
  const lastLens = useRef(lensIndex(zoom))
  useEffect(() => {
    const li = lensIndex(zoom)
    if (li !== lastLens.current && vfRef.current) {
      vfRef.current.querySelector('.cam-scene-wrap')?.animate([{ filter: 'blur(7px) brightness(0.8)', opacity: 0.7 }, { filter: 'blur(0) brightness(1)', opacity: 1 }], { duration: 320, easing: 'ease-out' })
    }
    lastLens.current = li
  }, [zoom])

  // Scanner detection
  useEffect(() => {
    if (mode !== 'scan') return setScanHit(false)
    const t = window.setTimeout(() => setScanHit(true), 1300)
    return () => window.clearTimeout(t)
  }, [mode])

  // Pano sweep
  useEffect(() => {
    if (pano === null) return
    if (pano >= 1) {
      finishPano()
      return
    }
    const t = window.setTimeout(() => setPano((p) => (p === null ? null : Math.min(1, p + 0.025))), 60)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pano])

  const closeOverlay = () => (result ? setResult(false) : panel ? setPanel(false) : setDial(false))
  useBackHandler(result || panel || dial || mode === 'scan', () => (mode === 'scan' && !result && !panel ? setMode('photo') : closeOverlay()), rootRef)

  // ---------------------------------------------------------------- capture
  const shutterEV = cam.shutter ? (cam.shutter - 5) * 0.18 : 0
  const buildPhoto = (kind: Photo['kind'], extra: Partial<Photo> = {}): Omit<Photo, 'id'> => {
    const lf = lensFor(zoom, front)
    const big = cam.format !== 'HEIF'
    let w = big ? 8064 : 4032
    let h = big ? 6048 : 3024
    if (cam.aspect === '16:9') h = Math.round((w * 9) / 16)
    if (cam.aspect === '1:1') w = h
    if (!land) [w, h] = [h, w]
    const ins = camInsight(vfScene)
    const kw = SCENE_KEYWORDS[vfScene] ?? ins.label.toLowerCase().split(/[^a-z]+/).filter((x) => x.length > 3).slice(0, 4)
    const capture: PhEdits['capture'] = {}
    if (cam.style !== 'Standard') capture.style = cam.style
    if (cam.exposure + shutterEV) capture.exposure = +(cam.exposure + shutterEV).toFixed(2)
    if (zoom > 1.02 && kind !== 'panorama') capture.zoom = +zoom.toFixed(2)
    if (front && cam.mirror) capture.mirror = true
    return {
      scene: vfScene,
      ts: Date.now(),
      kind,
      place: 'Maple Grove',
      keywords: [...new Set([...kw, ...(front ? ['selfie'] : []), ...(cam.format === 'ProRAW' ? ['proraw'] : []), ...(cam.live && kind === 'photo' ? ['live photo'] : []), ...(kind === 'portrait' ? ['portrait'] : [])])],
      capturedByMe: true,
      description: ins.label === 'Photo' ? `Photo taken with the ${lf.name} camera.` : `${ins.label}, captured with the ${lf.name} camera.`,
      camera: `iPhone 18 Pro${cam.format === 'ProRAW' ? ' · ProRAW' : cam.format === 'HEIF Max' ? ' · 48MP' : ''}`,
      lens: lf.lens,
      aperture: cam.aperture ? APERTURES[cam.aperture] : kind === 'portrait' ? 'ƒ2.8' : lf.aperture,
      iso: 64 + Math.round(Math.random() * (DARK_SCENES.includes(vfScene) ? 1600 : 300)),
      width: w,
      height: h,
      sizeMB: cam.format === 'ProRAW' ? 74.8 : big ? 6.2 : 2.6,
      people: front ? ['me', 'priya', 'sam'] : undefined,
      pets: vfScene.startsWith('dog') ? ['Biscuit'] : undefined,
      edits: Object.keys(capture).length ? ({ capture } as Photo['edits']) : undefined,
      ...extra,
    }
  }

  const flyIn = (id: string) => {
    const p = useOS.getState().photos.find((x) => x.id === id)
    const vf = vfRef.current?.querySelector('.cam-vf') as HTMLElement | null
    if (!p || !vf) return
    setFly({ photo: p, from: vf.getBoundingClientRect(), key: Date.now() })
  }

  const shoot = (kind: Photo['kind'] = mode === 'portrait' ? 'portrait' : 'photo') => {
    const st = useOS.getState()
    playAlert('shutter', st.silent ? 0 : st.volume)
    const white = cam.flash === 'on' || (cam.flash === 'auto' && DARK_SCENES.includes(vfScene))
    setFx({ kind: white ? 'white' : 'black', key: Date.now() })
    const id = st.addPhoto(buildPhoto(kind))
    flyIn(id)
  }

  const finishPano = () => {
    setPano(null)
    const st = useOS.getState()
    playAlert('shutter', st.silent ? 0 : st.volume)
    const id = st.addPhoto(buildPhoto('panorama', { width: 8000, height: 2400, keywords: ['panorama', 'canyon', 'landscape'], description: 'Panorama of red canyon walls, captured with Pano.' }))
    flyIn(id)
  }

  stopRef.current = () => stopRecording()
  const stopRecording = () => {
    if (recStart === null) return
    const secs = Math.max(1, Math.round((Date.now() - recStart) / 1000))
    setRecStart(null)
    const st = useOS.getState()
    playAlert('lock', st.volume)
    const is4k = cam.video.startsWith('4K')
    const dur = mode === 'timelapse' ? Math.max(1, Math.round(secs / 6)) : mode === 'slomo' ? secs * 4 : secs
    const id = st.addPhoto(buildPhoto('video', {
      duration: dur,
      width: land ? (is4k ? 3840 : 1920) : is4k ? 2160 : 1080,
      height: land ? (is4k ? 2160 : 1080) : is4k ? 3840 : 1920,
      sizeMB: +(dur * (is4k ? 0.9 : 0.35)).toFixed(1),
      keywords: ['video', ...(mode === 'slomo' ? ['slo-mo'] : mode === 'timelapse' ? ['time-lapse'] : []), ...(SCENE_KEYWORDS[vfScene] ?? [])],
      description: `${mode === 'slomo' ? 'Slo-mo video' : mode === 'timelapse' ? 'Time-lapse video' : 'Video'} of ${camInsight(vfScene).label.toLowerCase()}.`,
    }))
    flyIn(id)
  }

  const analyze = (then?: () => void) => {
    setAnalyzing(true)
    setResult(false)
    const st = useOS.getState()
    playAlert('tapback', st.volume)
    window.setTimeout(() => {
      setAnalyzing(false)
      setResult(true)
      then?.()
    }, 950)
  }
  const ask = (q: string) => {
    const go = () => {
      setQa((x) => [...x, { q, a: '' }])
      answer(siriScene, q, (a) => setQa((x) => x.map((it, i) => (i === x.length - 1 && it.q === q && !it.a ? { ...it, a } : it))))
    }
    if (!result) analyze(go)
    else go()
  }

  const onShutter = () => {
    if (countdown !== null) return
    if (VIDEOISH.includes(mode)) {
      if (recording) stopRecording()
      else {
        playAlert('lock', useOS.getState().volume)
        setRecStart(Date.now())
        setRecNow(Date.now())
      }
      return
    }
    if (mode === 'pano') {
      if (pano === null) setPano(0)
      else if (pano > 0.2) finishPano()
      else setPano(null)
      return
    }
    if (mode === 'siri') return analyze()
    if (mode === 'scan') return setScanHit(true)
    if (cam.timer) {
      let n = cam.timer
      setCountdown(n)
      const iv = window.setInterval(() => {
        n -= 1
        if (n <= 0) {
          window.clearInterval(iv)
          setCountdown(null)
          shoot()
        } else {
          setCountdown(n)
          playAlert('tapback', useOS.getState().volume)
        }
      }, 1000)
      return
    }
    shoot()
  }

  // ---------------------------------------------------------------- latest photo well
  const photos = useOS((s) => s.photos)
  const latest = useMemo(() => photos.filter((p) => !p.hidden).reduce<Photo | undefined>((a, p) => (!a || p.ts > a.ts ? p : a), undefined), [photos])

  // ---------------------------------------------------------------- viewfinder gestures
  const gesture = useRef<{ x: number; y: number; z: number; moved: boolean; t?: number; axis?: 'x' | 'y' } | null>(null)
  const onVfDown = (e: React.PointerEvent) => {
    if (e.button !== 0 || (e.target as HTMLElement).closest('button, input, .cam-strip, .cam-result, .cam-dial')) return
    const scale = screenScale()
    const vf = (e.currentTarget as HTMLElement).querySelector('.cam-vf') as HTMLElement
    const g = { x: e.clientX, y: e.clientY, z: zoom, moved: false } as NonNullable<typeof gesture.current>
    gesture.current = g
    g.t = window.setTimeout(() => {
      if (g.moved) return
      const r = vf.getBoundingClientRect()
      setFocus({ x: ((g.x - r.left) / r.width) * 100, y: ((g.y - r.top) / r.height) * 100, key: Date.now(), locked: true })
      g.moved = true
    }, 650)
    const move = (ev: PointerEvent) => {
      const dx = (ev.clientX - g.x) / scale
      const dy = (ev.clientY - g.y) / scale
      if (!g.axis && Math.hypot(dx, dy) > 10) {
        g.axis = Math.abs(dy) > Math.abs(dx) ? 'y' : 'x'
        g.moved = true
        window.clearTimeout(g.t)
      }
      if (g.axis === 'y' && !siri && mode !== 'scan' && !front) {
        const minZ = mode === 'portrait' ? 1 : 0.5
        setZoom(Math.max(minZ, Math.min(25, g.z * Math.exp(-dy / 140))))
      }
    }
    const up = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.clearTimeout(g.t)
      gesture.current = null
      const dx = (ev.clientX - g.x) / scale
      if (g.axis === 'x' && Math.abs(dx) > 50 && mode !== 'scan') {
        const i = MODES.findIndex((m) => m.id === mode)
        const n = MODES[Math.max(0, Math.min(MODES.length - 1, i + (dx < 0 ? 1 : -1)))]
        setMode(n.id)
        return
      }
      if (!g.moved) {
        if (siri) return analyze()
        const r = vf.getBoundingClientRect()
        if (ev.clientX < r.left || ev.clientX > r.right || ev.clientY < r.top || ev.clientY > r.bottom) return
        setFocus({ x: ((ev.clientX - r.left) / r.width) * 100, y: ((ev.clientY - r.top) / r.height) * 100, key: Date.now(), locked: false })
      }
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }
  useEffect(() => {
    if (!focus || focus.locked) return
    const t = window.setTimeout(() => setFocus(null), 1600)
    return () => window.clearTimeout(t)
  }, [focus])

  // ---------------------------------------------------------------- derived look
  const wbShift = cam.wb ? (cam.wb - 5) : 0
  const vfFilter = [STYLES[cam.style] ?? '', cam.exposure + shutterEV ? `brightness(${(1 + (cam.exposure + shutterEV) * 0.25).toFixed(3)})` : '', wbShift > 0 ? `sepia(${wbShift * 0.08}) saturate(${1 + wbShift * 0.05})` : wbShift < 0 ? `hue-rotate(${wbShift * 5}deg) saturate(${1 + wbShift * 0.04})` : ''].filter(Boolean).join(' ') || undefined
  const vfScale = siri ? 1.12 : Math.max(1, 1.3 * zoom)
  const blurPx = mode === 'portrait' ? (cam.aperture ? Math.max(0, 6 - cam.aperture * 0.7) : 3.5) : cam.aperture && cam.aperture < 3 ? 2.5 - cam.aperture * 0.6 : 0
  const ratio = (() => {
    const base = siri || mode === 'scan' || mode === 'pano' ? null : VIDEOISH.includes(mode) ? 9 / 16 : cam.aspect === '16:9' ? 9 / 16 : cam.aspect === '1:1' ? 1 : 3 / 4
    if (base === null) return null
    return land ? 1 / base : base
  })()
  const pills = front || siri || mode === 'scan' ? [] : mode === 'portrait' ? [1, 2] : mode === 'pano' ? [0.5, 1] : [0.5, 1, 2, 5]
  const activePill = pills.length ? pills.reduce((a, p) => (zoom >= p - 0.05 ? p : a), pills[0]) : 1

  const recSecs = recording ? (recNow - recStart!) / 1000 : 0

  return (
    <div ref={rootRef} className={`app-root cam-root ${land ? 'land' : ''} ${cam.reach && !land ? 'reach' : ''} ${lowPower ? 'lowpower' : ''} ${siri ? 'siri' : ''} ${recording ? 'rec' : ''}`}>
      {/* ---------- top controls ---------- */}
      <div className="cam-top">
        {recording ? (
          <div className="cam-rec-time">{fmtRec(recSecs)}</div>
        ) : siri ? (
          <div className="cam-siri-title"><AISparkle size={14} /> Siri · Visual Intelligence</div>
        ) : !(cam.reach && !land) ? (
          <ControlRow onOpenPanel={() => setPanel(true)} mode={mode} />
        ) : <div className="cam-top-spacer" />}
      </div>

      {/* ---------- viewfinder ---------- */}
      <div className="cam-vf-area" ref={vfRef} onPointerDown={onVfDown}>
        <div className={`cam-vf ${ratio === null ? 'full' : ''}`} style={ratio ? ({ ['--r' as string]: ratio } as React.CSSProperties) : undefined}>
          <div className="cam-scene-wrap" style={{ transform: `scale(${vfScale})${front && cam.mirror ? ' scaleX(-1)' : ''}`, filter: vfFilter }}>
            <div className="cam-pan">
              {vfScene === 'scan' ? <ScanPoster /> : <CamScene scene={vfScene} extended />}
            </div>
          </div>
          {blurPx > 0 && <div className="cam-dof" style={{ ['--b' as string]: `${blurPx}px` } as React.CSSProperties} />}
          {cam.grid && <div className="cam-grid" aria-hidden />}
          {cam.level && !siri && mode !== 'scan' && <div className="cam-level" aria-hidden><i /><b /><i /></div>}
          {cam.histogram && !siri && <Histogram scene={vfScene} ev={cam.exposure + shutterEV} />}
          {lowPower && <div className="cam-lowpower"><BatteryLow size={13} /> Low Power — efficiency mode · 30 fps</div>}
          {mode === 'portrait' && <div className="cam-portrait-badge">NATURAL LIGHT · {cam.aperture ? APERTURES[cam.aperture] : 'ƒ2.8'}</div>}
          {VIDEOISH.includes(mode) && !recording && <div className="cam-video-badge">{mode === 'slomo' ? 'HD · 240' : mode === 'timelapse' ? 'AUTO' : cam.video}</div>}
          {(cam.aperture > 0 || cam.shutter > 0 || cam.wb > 0) && !siri && <div className="cam-pro-badge">{[cam.aperture ? APERTURES[cam.aperture] : '', cam.shutter ? SHUTTERS[cam.shutter] : '', cam.wb ? WBS[cam.wb] : ''].filter(Boolean).join(' · ')}</div>}
          {focus && <div key={focus.key} className={`cam-focus ${focus.locked ? 'locked' : ''}`} style={{ left: `${focus.x}%`, top: `${focus.y}%` }}>{focus.locked && <span>AE/AF LOCK</span>}<i className="cam-focus-sun"><Sun size={12} /></i></div>}
          {siri && <SiriReticle busy={analyzing} />}
          {analyzing && <div className="cam-analyze" aria-live="polite"><AISparkle size={14} /> Looking…</div>}
          {mode === 'scan' && <ScanFrame hit={scanHit} />}
          {mode === 'pano' && <PanoGuide p={pano} />}
          {countdown !== null && <div className="cam-countdown" key={countdown}>{countdown}</div>}
          {fx && <div key={fx.key} className={`cam-fx ${fx.kind}`} onAnimationEnd={() => setFx(null)} />}
          {pills.length > 0 && !recording && (
            <ZoomPills pills={pills} zoom={zoom} active={activePill} setZoom={setZoom} dial={dial} setDial={setDial} min={mode === 'portrait' ? 1 : 0.5} />
          )}
          {recording && pills.length > 0 && <div className="cam-rec-zoom">{zoom < 1 ? zoom.toFixed(1).replace('0.', '.') : `${+zoom.toFixed(1)}`}×</div>}
        </div>
        {siri && !result && (
          <div className="cam-siri-bottom">
            <SceneStrip scene={siriScene} onPick={(s) => { setSiriScene(s); setScene(s); setQa([]); analyze() }} />
            <SiriAsk onAsk={ask} scene={siriScene} />
          </div>
        )}
        {siri && result && <SiriResult key={siriScene} scene={siriScene} qa={qa} onAsk={ask} onClose={() => { setResult(false); setQa([]) }} />}
        {mode === 'scan' && scanHit && (
          <button className="cam-scan-pill" onClick={() => useOS.getState().launch('safari', { route: 'url/lincoln.example/calendar' })}>
            <span className="cam-scan-ic"><Link2 size={16} /></span>
            <span className="grow" style={{ textAlign: 'left' }}><b>lincoln.example/calendar</b><br /><small>Open in Safari</small></span>
            <ChevronRight size={18} />
          </button>
        )}
        {mode === 'scan' && <button className="cam-scan-close" aria-label="Close code scanner" onClick={() => setMode('photo')}><X size={20} /></button>}
      </div>

      {/* ---------- reach row ---------- */}
      {cam.reach && !land && !recording && !siri && <div className="cam-reach-row"><ControlRow onOpenPanel={() => setPanel(true)} mode={mode} compact /></div>}

      {/* ---------- modes ---------- */}
      <div className="cam-modes-row">
        {!recording && mode !== 'scan' && <ModeWheel mode={mode as Mode} setMode={setMode} vertical={land} />}
        {!recording && (
          <button className="cam-six glass dark-glass interactive" aria-label="Camera controls" aria-expanded={panel} onClick={() => setPanel(!panel)}><GripVertical size={18} /></button>
        )}
      </div>

      {/* ---------- bottom ---------- */}
      <div className="cam-bottom">
        <button ref={wellRef} className="cam-well" aria-label="Last photo" onClick={() => latest && useOS.getState().launch('photos', { route: `photo/${latest.id}` })}>
          {latest && <PhotoView photo={latest} />}
        </button>
        <button className={`cam-shutter ${VIDEOISH.includes(mode) ? 'video' : ''} ${mode} ${recording ? 'on' : ''} ${pano !== null ? 'on' : ''}`} aria-label={recording ? 'Stop recording' : VIDEOISH.includes(mode) ? 'Record' : siri ? 'Ask Siri about what you see' : mode === 'pano' ? (pano !== null ? 'Finish panorama' : 'Start panorama') : 'Take photo'} onClick={onShutter}>
          <span className="cam-shutter-inner">{siri && <span className="cam-orb" />}</span>
          {mode === 'timelapse' && recording && <span className="cam-tl-ticks" />}
        </button>
        {siri || mode === 'scan' ? (
          <button className="cam-flip glass dark-glass interactive" aria-label="Siri settings" onClick={() => useOS.getState().launch('settings', { route: 'siri' })}><AISparkle size={20} color="#fff" /></button>
        ) : (
          <button className="cam-flip glass dark-glass interactive" aria-label={front ? 'Switch to back camera' : 'Switch to front camera'} disabled={recording && !VIDEOISH.includes(mode)} onClick={(e) => { (e.currentTarget.firstChild as Element)?.animate([{ transform: 'rotate(0)' }, { transform: 'rotate(180deg)' }], { duration: 350 }); vfRef.current?.querySelector('.cam-scene-wrap')?.animate([{ filter: 'blur(14px)', transform: `scale(${vfScale}) rotateY(90deg)` }, { filter: 'blur(0)', transform: `scale(${vfScale}) rotateY(0)` }], { duration: 380 }); setFront(!front); setZoom(1) }}>
            <RefreshCcw size={22} />
          </button>
        )}
      </div>

      {panel && <ControlsPanel mode={mode} edit={editCtl} setEdit={setEditCtl} onClose={() => { setPanel(false); setEditCtl(false) }} />}
      {fly && <FlyThumb key={fly.key} photo={fly.photo} from={fly.from} to={wellRef.current} root={rootRef.current} onDone={() => setFly(null)} />}
    </div>
  )
}

// ====================================================================== pieces

function ctlIcon(id: string, size = 20): React.ReactNode {
  const c = useCam.getState()
  switch (id) {
    case 'flash': return c.flash === 'off' ? <ZapOff size={size} /> : <Zap size={size} fill={c.flash === 'on' ? 'currentColor' : 'none'} />
    case 'live': return <CircleDot size={size} />
    case 'timer': return <Timer size={size} />
    case 'exposure': return <Sun size={size} />
    case 'style': return <Palette size={size} />
    case 'aspect': return <RectangleVertical size={size} />
    case 'format': return <FileImage size={size} />
    case 'grid': return <Grid3x3 size={size} />
    case 'level': return <Ruler size={size} />
    case 'aperture': return <Aperture size={size} />
    case 'shutter': return <Gauge size={size} />
    case 'wb': return <Thermometer size={size} />
    case 'histogram': return <BarChart3 size={size} />
    case 'reach': return <ArrowDownToLine size={size} />
    case 'mirror': return <FlipHorizontal2 size={size} />
    default: return null
  }
}

function ctlState(id: string): { on: boolean; text?: string } {
  const c = useCam.getState()
  switch (id) {
    case 'flash': return { on: c.flash === 'on', text: c.flash === 'auto' ? 'A' : undefined }
    case 'live': return { on: c.live, text: c.live ? undefined : 'OFF' }
    case 'timer': return { on: c.timer > 0, text: c.timer ? `${c.timer}s` : undefined }
    case 'exposure': return { on: c.exposure !== 0, text: c.exposure ? `${c.exposure > 0 ? '+' : ''}${c.exposure.toFixed(1)}` : undefined }
    case 'style': return { on: c.style !== 'Standard' }
    case 'aspect': return { on: false, text: c.aspect }
    case 'format': return { on: c.format !== 'HEIF', text: c.format === 'HEIF' ? 'HEIF' : c.format === 'HEIF Max' ? '48MP' : 'RAW' }
    case 'grid': return { on: c.grid }
    case 'level': return { on: c.level }
    case 'aperture': return { on: c.aperture > 0, text: c.aperture ? APERTURES[c.aperture] : undefined }
    case 'shutter': return { on: c.shutter > 0, text: c.shutter ? SHUTTERS[c.shutter] : undefined }
    case 'wb': return { on: c.wb > 0, text: c.wb ? WBS[c.wb] : undefined }
    case 'histogram': return { on: c.histogram }
    case 'reach': return { on: c.reach }
    case 'mirror': return { on: c.mirror }
    default: return { on: false }
  }
}

/** Quick action for a pinned control; returns false when it should open the panel. */
function quick(id: string): boolean {
  const c = useCam.getState()
  const cyc = <T,>(arr: readonly T[], v: T) => arr[(arr.indexOf(v) + 1) % arr.length]
  switch (id) {
    case 'flash': c.set({ flash: cyc(['auto', 'on', 'off'] as const, c.flash) }); return true
    case 'live': c.set({ live: !c.live }); return true
    case 'timer': c.set({ timer: cyc([0, 3, 10] as const, c.timer) }); return true
    case 'aspect': c.set({ aspect: cyc(['4:3', '16:9', '1:1'] as const, c.aspect) }); return true
    case 'format': c.set({ format: cyc(['HEIF', 'HEIF Max', 'ProRAW'] as const, c.format) }); return true
    case 'grid': c.set({ grid: !c.grid }); return true
    case 'level': c.set({ level: !c.level }); return true
    case 'histogram': c.set({ histogram: !c.histogram }); return true
    case 'reach': c.set({ reach: !c.reach }); return true
    case 'mirror': c.set({ mirror: !c.mirror }); return true
    default: return false
  }
}

function ControlRow({ onOpenPanel, mode, compact }: { onOpenPanel: () => void; mode: AnyMode; compact?: boolean }) {
  const pinned = useCam((s) => s.pinned)
  useCam() // re-render on any setting change
  const shown = pinned.filter((id) => !(VIDEOISH.includes(mode) && ['live', 'timer', 'format', 'aspect'].includes(id)))
  return (
    <div className={`cam-ctl-row ${compact ? 'compact' : ''}`}>
      {shown.map((id) => {
        const st = ctlState(id)
        const def = CONTROLS.find((c) => c.id === id)
        return (
          <button key={id} className={`cam-ctl ${st.on ? 'on' : ''}`} aria-label={def?.label ?? id} aria-pressed={st.on} onClick={() => { if (!quick(id)) onOpenPanel() }}>
            {ctlIcon(id)}
            {st.text && <span className="cam-ctl-text">{st.text}</span>}
            {id === 'live' && !useCam.getState().live && <span className="cam-slash" />}
          </button>
        )
      })}
      {VIDEOISH.includes(mode) && <button className="cam-ctl pill" onClick={() => { const c = useCam.getState(); c.set({ video: c.video === '4K · 30' ? '4K · 60' : c.video === '4K · 60' ? 'HD · 30' : '4K · 30' }) }}>{useCam.getState().video}</button>}
    </div>
  )
}

function ControlsPanel({ mode, edit, setEdit, onClose }: { mode: AnyMode; edit: boolean; setEdit: (v: boolean) => void; onClose: () => void }) {
  const c = useCam()
  const pin = (id: string) => {
    if (c.pinned.includes(id)) c.set({ pinned: c.pinned.filter((x) => x !== id) })
    else if (c.pinned.length >= 5) useOS.getState().showToast('Up to 5 controls can be pinned')
    else c.set({ pinned: [...c.pinned, id] })
  }
  const editor = (id: string): React.ReactNode => {
    switch (id) {
      case 'flash': return <Segmented options={['auto', 'on', 'off'] as const} value={c.flash} onChange={(v) => c.set({ flash: v })} labels={{ auto: 'Auto', on: 'On', off: 'Off' }} />
      case 'live': return <Switch checked={c.live} onChange={(v) => c.set({ live: v })} label="Live" />
      case 'timer': return <Segmented options={['0', '3', '10'] as const} value={String(c.timer) as '0'} onChange={(v) => c.set({ timer: +v as 0 })} labels={{ 0: 'Off', 3: '3s', 10: '10s' }} />
      case 'exposure': return <div className="cam-slider"><Slider value={c.exposure} min={-2} max={2} step={0.1} onChange={(v) => c.set({ exposure: Math.abs(v) < 0.05 ? 0 : v })} label="Exposure" color="#ffd60a" /><span>{c.exposure > 0 ? '+' : ''}{c.exposure.toFixed(1)}</span></div>
      case 'style': return <div className="cam-styles">{Object.keys(STYLES).map((s) => <button key={s} className={c.style === s ? 'on' : ''} onClick={() => c.set({ style: s })}><span className="cam-style-sw" style={{ filter: STYLES[s] || undefined }} />{s}</button>)}</div>
      case 'aspect': return <Segmented options={['4:3', '16:9', '1:1'] as const} value={c.aspect} onChange={(v) => c.set({ aspect: v })} />
      case 'format': return <Segmented options={['HEIF', 'HEIF Max', 'ProRAW'] as const} value={c.format} onChange={(v) => c.set({ format: v })} labels={{ 'HEIF Max': '48MP' }} />
      case 'grid': return <Switch checked={c.grid} onChange={(v) => c.set({ grid: v })} label="Grid" />
      case 'level': return <Switch checked={c.level} onChange={(v) => c.set({ level: v })} label="Level" />
      case 'aperture': return <div className="cam-slider"><Slider value={c.aperture} min={0} max={APERTURES.length - 1} step={1} onChange={(v) => c.set({ aperture: Math.round(v) })} label="Aperture" color="#ffd60a" /><span>{APERTURES[c.aperture]}</span></div>
      case 'shutter': return <div className="cam-slider"><Slider value={c.shutter} min={0} max={SHUTTERS.length - 1} step={1} onChange={(v) => c.set({ shutter: Math.round(v) })} label="Shutter speed" color="#ffd60a" /><span>{SHUTTERS[c.shutter]}</span></div>
      case 'wb': return <div className="cam-slider"><Slider value={c.wb} min={0} max={WBS.length - 1} step={1} onChange={(v) => c.set({ wb: Math.round(v) })} label="White balance" color="#ffd60a" /><span>{WBS[c.wb]}</span></div>
      case 'histogram': return <Switch checked={c.histogram} onChange={(v) => c.set({ histogram: v })} label="Histogram" />
      case 'reach': return <Switch checked={c.reach} onChange={(v) => c.set({ reach: v })} label="Reach" />
      case 'mirror': return <Switch checked={c.mirror} onChange={(v) => c.set({ mirror: v })} label="Mirror Front Camera" />
      default: return null
    }
  }
  const groups = [
    { title: 'Controls', items: CONTROLS.filter((x) => !x.pro && !['reach', 'mirror'].includes(x.id)) },
    { title: 'Pro Controls · iPhone 18 Pro', items: CONTROLS.filter((x) => x.pro) },
    { title: 'Reachability & Front Camera', items: CONTROLS.filter((x) => ['reach', 'mirror'].includes(x.id)) },
  ]
  return (
    <div className="cam-panel" role="dialog" aria-label="Camera controls">
      <div className="cam-panel-head">
        <button className="cam-panel-edit" onClick={() => setEdit(!edit)}>{edit ? 'Done' : 'Edit'}</button>
        <div className="t-headline">{edit ? 'Customize Controls' : 'Camera Controls'}</div>
        <button className="cam-x" aria-label="Close controls" onClick={onClose}><X size={18} /></button>
      </div>
      {edit && <div className="cam-panel-hint">Tap <Pin size={12} /> to pin a control to the top of the viewfinder (up to 5). {c.pinned.length}/5 pinned.</div>}
      <div className="cam-panel-body scroll">
        {VIDEOISH.includes(mode) && !edit && (
          <div className="cam-prow"><span className="cam-prow-ic"><FileImage size={18} /></span><span className="cam-prow-label">Video Format</span><div className="cam-prow-ed"><Segmented options={['HD · 30', '4K · 30', '4K · 60'] as const} value={c.video} onChange={(v) => c.set({ video: v })} /></div></div>
        )}
        {groups.map((g) => (
          <div key={g.title} className="cam-pgroup">
            <div className="cam-pgroup-title">{g.title}</div>
            {g.items.map((it) => {
              const pinned = c.pinned.includes(it.id)
              return (
                <div key={it.id} className={`cam-prow ${edit ? 'edit' : ''}`}>
                  {edit && <button className={`cam-pin ${pinned ? 'on' : ''}`} aria-label={pinned ? `Unpin ${it.label}` : `Pin ${it.label}`} onClick={() => pin(it.id)}>{pinned ? <PinOff size={14} /> : <Pin size={14} />}</button>}
                  <span className={`cam-prow-ic ${ctlState(it.id).on ? 'on' : ''}`}>{ctlIcon(it.id, 18)}</span>
                  <span className="cam-prow-label">{it.label}{pinned && !edit && <Check size={12} className="cam-pinned-mark" />}</span>
                  {!edit && <div className="cam-prow-ed">{editor(it.id)}</div>}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

function ModeWheel({ mode, setMode, vertical }: { mode: Mode; setMode: (m: Mode) => void; vertical: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  const [off, setOff] = useState(0)
  useLayoutEffect(() => {
    const el = ref.current
    const btn = el?.querySelector(`[data-mode="${mode}"]`) as HTMLElement | null
    if (!el || !btn) return
    if (vertical) setOff(-(btn.offsetTop + btn.offsetHeight / 2) + (el.parentElement!.offsetHeight / 2))
    else setOff(-(btn.offsetLeft + btn.offsetWidth / 2) + (el.parentElement!.offsetWidth / 2))
  }, [mode, vertical])
  const start = useRef<{ x: number; y: number } | null>(null)
  return (
    <div
      className={`cam-modes ${vertical ? 'vertical' : ''}`}
      onPointerDown={(e) => (start.current = { x: e.clientX, y: e.clientY })}
      onPointerUp={(e) => {
        const s = start.current
        start.current = null
        if (!s) return
        const d = vertical ? e.clientY - s.y : e.clientX - s.x
        if (Math.abs(d) > 30) {
          const i = MODES.findIndex((m) => m.id === mode)
          setMode(MODES[Math.max(0, Math.min(MODES.length - 1, i + (d < 0 ? 1 : -1)))].id)
        }
      }}
    >
      <div className="cam-modes-track" ref={ref} style={{ transform: vertical ? `translateY(${off}px)` : `translateX(${off}px)` }} role="tablist" aria-label="Camera mode">
        {MODES.map((m) => (
          <button key={m.id} data-mode={m.id} role="tab" aria-selected={mode === m.id} className={`${mode === m.id ? 'on' : ''} ${m.id === 'siri' ? 'siri' : ''}`} onClick={() => setMode(m.id)}>
            {m.id === 'siri' && <AISparkle size={11} color={mode === 'siri' ? undefined : '#fff'} />}{m.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function ZoomPills({ pills, zoom, active, setZoom, dial, setDial, min }: { pills: number[]; zoom: number; active: number; setZoom: (z: number) => void; dial: boolean; setDial: (v: boolean) => void; min: number }) {
  const lp = useRef<number | undefined>(undefined)
  const hideT = useRef<number | undefined>(undefined)
  const fmt = (z: number) => (z < 1 ? z.toFixed(1).replace('0.', '.') : `${+z.toFixed(1)}`)
  const scheduleHide = () => {
    window.clearTimeout(hideT.current)
    hideT.current = window.setTimeout(() => setDial(false), 1800)
  }
  useEffect(() => () => window.clearTimeout(hideT.current), [])
  const dialDown = (e: React.PointerEvent) => {
    e.stopPropagation()
    window.clearTimeout(hideT.current)
    const scale = screenScale()
    const x0 = e.clientX
    const z0 = Math.log(zoom)
    const move = (ev: PointerEvent) => setZoom(Math.max(min, Math.min(25, Math.exp(z0 - ((ev.clientX - x0) / scale) / 70))))
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      scheduleHide()
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }
  const ticks = [0.5, 1, 2, 3, 5, 10, 15, 25].filter((t) => t >= min)
  return (
    <>
      {dial && (
        <div className="cam-dial" onPointerDown={dialDown} role="slider" aria-label="Zoom dial" aria-valuemin={min} aria-valuemax={25} aria-valuenow={+zoom.toFixed(1)} tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'ArrowRight') setZoom(Math.min(25, zoom * 1.1)); if (e.key === 'ArrowLeft') setZoom(Math.max(min, zoom / 1.1)) }}>
          <div className="cam-dial-arc" style={{ transform: `translateX(${-Math.log(zoom) * 70}px)` }}>
            {ticks.map((t) => <span key={t} style={{ left: `calc(50% + ${Math.log(t) * 70}px)` }}>{fmt(t)}</span>)}
            {Array.from({ length: 60 }).map((_, i) => <i key={i} style={{ left: `calc(50% + ${(Math.log(min) + i * 0.07) * 70}px)` }} className={i % 5 === 0 ? 'major' : ''} />)}
          </div>
          <div className="cam-dial-needle" />
          <div className="cam-dial-val">{fmt(zoom)}×</div>
        </div>
      )}
      <div className="cam-pills" role="group" aria-label="Lens">
        {pills.map((p) => (
          <button
            key={p}
            className={`cam-pill ${active === p ? 'on' : ''}`}
            aria-label={`${p}× zoom`}
            onPointerDown={(e) => {
              e.stopPropagation()
              lp.current = window.setTimeout(() => { setDial(true); scheduleHide(); lp.current = undefined }, 450)
            }}
            onPointerUp={() => {
              if (lp.current !== undefined) {
                window.clearTimeout(lp.current)
                lp.current = undefined
                setZoom(p)
              }
            }}
            onPointerLeave={() => { if (lp.current !== undefined) { window.clearTimeout(lp.current); lp.current = undefined } }}
            onKeyDown={(e) => e.key === 'Enter' && setZoom(p)}
          >
            {active === p ? `${fmt(zoom)}×` : fmt(p)}
          </button>
        ))}
      </div>
    </>
  )
}

function SiriAsk({ onAsk, scene }: { onAsk: (q: string) => void; scene: string }) {
  const [q, setQ] = useState('')
  const ins = camInsight(scene)
  return (
    <div className="cam-siri-ask">
      <div className="cam-siri-hint"><AISparkle size={13} /> Point at something and tap the shutter, or ask about {ins.label === 'Photo' ? 'it' : `the ${ins.label.toLowerCase()}`}</div>
      <div className="cam-ask glass dark-glass">
        <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && q.trim()) { onAsk(q.trim()); setQ('') } }} placeholder="Ask about what you see…" aria-label="Ask about what you see" enterKeyHint="send" />
        <button aria-label="Ask" disabled={!q.trim()} onClick={() => { onAsk(q.trim()); setQ('') }}>↑</button>
      </div>
    </div>
  )
}

function Histogram({ scene, ev }: { scene: string; ev: number }) {
  const bins = useMemo(() => {
    let h = 17
    for (const ch of scene) h = (h * 31 + ch.charCodeAt(0)) >>> 0
    return Array.from({ length: 32 }, (_, i) => {
      h = (h * 1103515245 + 12345) >>> 0
      const center = 16 + ev * 5
      const base = Math.exp(-((i - center) ** 2) / 90)
      return Math.min(1, base * 0.8 + ((h >>> 16) % 100) / 400)
    })
  }, [scene, ev])
  return (
    <svg className="cam-histo" viewBox="0 0 64 30" aria-label="Histogram">
      {bins.map((b, i) => <rect key={i} x={i * 2} y={30 - b * 28} width="1.6" height={b * 28} fill="rgb(255 255 255 / .85)" />)}
    </svg>
  )
}

function PanoGuide({ p }: { p: number | null }) {
  return (
    <div className="cam-pano">
      <div className="cam-pano-bar">
        <div className="cam-pano-fill" style={{ width: `${(p ?? 0) * 100}%` }} />
        <div className="cam-pano-arrow" style={{ left: `${(p ?? 0) * 100}%` }}>➜</div>
      </div>
      <div className="cam-pano-text">{p === null ? 'Tap the shutter and move iPhone continuously' : 'Keep the arrow on the center line'}</div>
    </div>
  )
}

function ScanFrame({ hit }: { hit: boolean }) {
  return (
    <div className={`cam-scanframe ${hit ? 'hit' : ''}`} aria-hidden>
      <i /><i /><i /><i />
    </div>
  )
}

function ScanPoster() {
  const cells = useMemo(() => {
    const out: [number, number][] = []
    let h = 99
    for (let y = 0; y < 21; y++) for (let x = 0; x < 21; x++) {
      if ((x < 7 && y < 7) || (x > 13 && y < 7) || (x < 7 && y > 13)) continue
      h = (h * 1103515245 + 12345) >>> 0
      if ((h >> 16) & 1) out.push([x, y])
    }
    return out
  }, [])
  const F = ({ x, y }: { x: number; y: number }) => <g><rect x={x} y={y} width="7" height="7" /><rect x={x + 1} y={y + 1} width="5" height="5" fill="#fff" /><rect x={x + 2} y={y + 2} width="3" height="3" /></g>
  return (
    <svg viewBox="-60 -45 520 390" preserveAspectRatio="xMidYMid slice" style={{ width: '100%', height: '100%', display: 'block' }} role="img" aria-label="Poster with QR code">
      <rect x="-60" y="-45" width="520" height="390" fill="#cfd8dc" />
      <rect x="-60" y="250" width="520" height="95" fill="#90a4ae" />
      <rect x="95" y="10" width="210" height="270" rx="6" fill="#fff" />
      <rect x="95" y="10" width="210" height="60" rx="6" fill="#8b1e2d" />
      <text x="200" y="38" textAnchor="middle" fill="#fff" fontFamily="var(--font-display)" fontWeight="800" fontSize="18">LINCOLN HIGH</text>
      <text x="200" y="58" textAnchor="middle" fill="#ffd6dc" fontFamily="var(--font-text)" fontSize="11">2026–27 School Calendar</text>
      <g transform="translate(152 88) scale(4.6)" fill="#000">
        {cells.map(([x, y]) => <rect key={`${x}-${y}`} x={x} y={y} width="1.02" height="1.02" />)}
        <F x={0} y={0} /><F x={14} y={0} /><F x={0} y={14} />
      </g>
      <text x="200" y="200" textAnchor="middle" fill="#333" fontFamily="var(--font-text)" fontSize="11">Scan to add events to your calendar</text>
    </svg>
  )
}

function FlyThumb({ photo, from, to, root, onDone }: { photo: Photo; from: DOMRect; to: HTMLElement | null; root: HTMLElement | null; onDone: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const s = screenScale()
  const rr = root?.getBoundingClientRect()
  const rel = (r: DOMRect) => ({ x: (r.left - (rr?.left ?? 0)) / s, y: (r.top - (rr?.top ?? 0)) / s, w: r.width / s, h: r.height / s })
  const F = rel(from)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el || !to) return onDone()
    const T = rel(to.getBoundingClientRect())
    const sc = T.w / F.w
    const a = el.animate(
      [
        { transform: 'translate(0,0) scale(1)', borderRadius: '0px', opacity: 1 },
        { transform: `translate(${T.x - F.x}px, ${T.y - F.y}px) scale(${sc}, ${T.h / F.h})`, borderRadius: `${10 / sc}px`, opacity: 1 },
      ],
      { duration: 420, easing: 'cubic-bezier(.3,.7,.2,1)', fill: 'forwards' },
    )
    a.onfinish = onDone
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return (
    <div ref={ref} className="cam-fly" style={{ left: F.x, top: F.y, width: F.w, height: F.h }}>
      <PhotoView photo={photo} />
    </div>
  )
}

