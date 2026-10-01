import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, Share, Heart, Info, SlidersHorizontal, Trash2, Ellipsis, Play, Pause, Volume2, VolumeX, Camera, Copy, EyeOff, Plus, RotateCcw, SquareStack, Images, Undo2 } from 'lucide-react'
import { useOS } from '../../os/store'
import { useOnscreen } from '../../os/hooks'
import { screenScale } from '../../os/hooks'
import { useShell } from '../../shell/shellState'
import { springs, animateSpring } from '../../os/spring'
import { openMenu, showAlert } from '../../ui/overlay'
import { SCENE_INSIGHTS } from '../../os/ai/vision'
import type { Photo } from '../../os/types'
import { PhotoView } from './PhotoView'
import { InfoPanel } from './Info'
import { AlbumPickerSheet } from './Sheets'
import { useUI, usePh, usePhotoMap, type ViewerState } from './pstore'
import { photoRatio, fmtDur, isEdited, fmtShortDate } from './look'
import { fmtTime } from '../../os/time'
import { useBackHandler } from './back'

const EMOJIS = ['❤️', '😍', '😂', '😮', '👍', '🔥']

export function Viewer() {
  const v = useUI((s) => s.viewer)
  if (!v) return null
  return <ViewerInner v={v} />
}

function ViewerInner({ v }: { v: ViewerState }) {
  const map = usePhotoMap()
  const [ids, setIds] = useState(v.ids)
  const [index, setIndex] = useState(v.index)
  const [chrome, setChrome] = useState(true)
  const [info, setInfo] = useState(false)
  const [zoomAt, setZoomAt] = useState<{ x: number; y: number } | null>(null)
  const [albumPick, setAlbumPick] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const bgRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const anim = useRef<Animation | null>(null)
  const closing = useRef(false)
  const lastTap = useRef(0)
  const landscape = useOS((s) => s.orientation === 'landscape')

  // Filter out items that disappeared (purged)
  const photos = useMemo(() => ids.map((id) => map.get(id)).filter(Boolean) as Photo[], [ids, map])
  const idx = Math.min(index, photos.length - 1)
  const photo = photos[idx]
  const vid = useVideo(photo?.kind === 'video' ? photo : undefined)

  useEffect(() => {
    useShell.getState().set({ statusOverride: 'light' })
    return () => useShell.getState().set({ statusOverride: null })
  }, [])
  useEffect(() => {
    useShell.getState().set({ hideStatusBar: !chrome })
    return () => useShell.getState().set({ hideStatusBar: false })
  }, [chrome])

  useOnscreen('photos', photo ? `Viewing photo: ${photo.description}` : 'Photos', photo ? { type: 'photo', photoId: photo.id, scene: photo.scene } : undefined)

  // After a swipe commits, reset the track in the same frame as the new index renders
  useLayoutEffect(() => {
    anim.current?.cancel()
    anim.current = null
    if (trackRef.current) trackRef.current.style.transform = ''
    setZoomAt(null)
  }, [idx])

  const boxEl = () => rootRef.current?.querySelector('.ph-v-slide.cur .ph-v-box') as HTMLElement | null
  const rel = (r: DOMRect) => {
    const rr = rootRef.current!.getBoundingClientRect()
    const s = screenScale()
    return { x: (r.left - rr.left) / s, y: (r.top - rr.top) / s, w: r.width / s, h: r.height / s }
  }
  const flip = (el: HTMLElement, from: { x: number; y: number; w: number; h: number }, reverse: boolean) => {
    const F = rel(el.getBoundingClientRect())
    const s = Math.max(from.w / F.w, from.h / F.h)
    const dx = from.x + from.w / 2 - (F.x + F.w / 2)
    const dy = from.y + from.h / 2 - (F.y + F.h / 2)
    const ix = Math.max(0, (F.w * s - from.w) / 2 / s)
    const iy = Math.max(0, (F.h * s - from.h) / 2 / s)
    const a = { transform: `translate(${dx}px, ${dy}px) scale(${s})`, clipPath: `inset(${iy}px ${ix}px round ${4 / s}px)` }
    const b = { transform: 'translate(0,0) scale(1)', clipPath: 'inset(0px 0px round 0px)' }
    return animateSpring(el, reverse ? [b, a] : [a, b], reverse ? springs.appClose() : springs.appOpen(), { fill: reverse ? 'forwards' : 'none' })
  }

  // Open: zoom from the thumbnail
  useLayoutEffect(() => {
    const el = boxEl()
    bgRef.current?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 260, easing: 'ease-out' })
    rootRef.current?.querySelectorAll('.ph-v-chrome').forEach((c) => c.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 320, easing: 'ease-out' }))
    if (el && v.rect) flip(el, v.rect, false)
    else if (el) animateSpring(el, [{ transform: 'scale(0.9)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }], springs.appOpen(), { fill: 'none' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const close = useCallback(() => {
    if (closing.current) return
    closing.current = true
    const el = boxEl()
    const root = rootRef.current
    const done = () => useUI.getState().set({ viewer: null, editor: null })
    if (!el || !root) return done()
    const appRoot = root.closest('.ph-root')
    const thumbs = appRoot ? [...appRoot.querySelectorAll(`[data-pid="${photo?.id}"]`)].filter((t) => !root.contains(t)) as HTMLElement[] : []
    const visible = thumbs.find((t) => {
      if (t.closest('[aria-hidden="true"]')) return false
      const r = t.getBoundingClientRect()
      const rr = root.getBoundingClientRect()
      return r.width > 0 && r.bottom > rr.top + 40 && r.top < rr.bottom - 60
    })
    bgRef.current?.animate([{ opacity: getComputedStyle(bgRef.current).opacity }, { opacity: 0 }], { duration: 240, fill: 'forwards' })
    root.querySelectorAll('.ph-v-chrome, .ph-v-info').forEach((c) => c.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 150, fill: 'forwards' }))
    const a = visible ? flip(el, rel(visible.getBoundingClientRect()), true) : animateSpring(el, [{ opacity: 1, transform: getComputedStyle(el).transform === 'none' ? 'scale(1)' : getComputedStyle(el).transform }, { opacity: 0, transform: 'scale(0.86)' }], springs.appClose(), { fill: 'forwards' })
    a.onfinish = done
    window.setTimeout(done, 700)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photo?.id])

  useBackHandler(true, () => (info ? setInfo(false) : close()), rootRef)

  const go = useCallback((dir: 1 | -1, fromDx = 0) => {
    const track = trackRef.current
    const target = idx + dir
    if (!track || target < 0 || target >= photos.length) {
      if (track && fromDx) animateSpring(track, [{ transform: `translateX(${fromDx}px)` }, { transform: 'translateX(0px)' }], springs.snappy(), { fill: 'none' })
      if (track) track.style.transform = ''
      return
    }
    const w = track.offsetWidth + 16
    anim.current?.cancel()
    const a = animateSpring(track, [{ transform: `translateX(${fromDx}px)` }, { transform: `translateX(${-dir * w}px)` }], springs.push(), { fill: 'forwards' })
    anim.current = a
    a.onfinish = () => setIndex(target)
  }, [idx, photos.length])

  // Keyboard arrows
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return
      if (!rootRef.current?.closest('.app-window.active') || useUI.getState().editor || useUI.getState().slideshow) return
      if (e.key === 'ArrowRight') go(1)
      if (e.key === 'ArrowLeft') go(-1)
      if (e.key === 'ArrowUp') setInfo(true)
      if (e.key === 'ArrowDown') setInfo(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go])

  // Drag: horizontal = page, down = dismiss, up = info
  const drag = useRef<{ axis: 'x' | 'y' | null; x0: number; y0: number; t0: number; id: number } | null>(null)
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 || (e.target as HTMLElement).closest('button, input, .ph-v-scrub')) return
    drag.current = { axis: null, x0: e.clientX, y0: e.clientY, t0: performance.now(), id: e.pointerId }
    const scale = screenScale()
    const move = (ev: PointerEvent) => {
      const d = drag.current
      if (!d) return
      const dx = (ev.clientX - d.x0) / scale
      const dy = (ev.clientY - d.y0) / scale
      if (!d.axis) {
        if (Math.hypot(dx, dy) < 8) return
        d.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y'
        if (zoomAt) d.axis = null
      }
      if (d.axis === 'x' && !zoomAt) {
        const edge = (idx === 0 && dx > 0) || (idx === photos.length - 1 && dx < 0)
        trackRef.current!.style.transform = `translateX(${edge ? dx * 0.35 : dx}px)`
      } else if (d.axis === 'y') {
        const el = boxEl()
        if (!info && dy > 0 && el) {
          el.style.transform = `translate(${dx * 0.6}px, ${dy}px) scale(${Math.max(0.6, 1 - dy / 900)})`
          if (bgRef.current) bgRef.current.style.opacity = String(Math.max(0.2, 1 - dy / 380))
        }
      }
    }
    const up = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      const d = drag.current
      drag.current = null
      if (!d) return
      const dx = (ev.clientX - d.x0) / scale
      const dy = (ev.clientY - d.y0) / scale
      const dt = performance.now() - d.t0
      if (!d.axis) {
        if (Math.hypot(dx, dy) < 8) onTap(ev)
        return
      }
      if (d.axis === 'x') {
        const vx = dx / Math.max(1, dt)
        const w = trackRef.current!.offsetWidth
        if (dx < -w * 0.25 || vx < -0.5) go(1, dx)
        else if (dx > w * 0.25 || vx > 0.5) go(-1, dx)
        else go(0 as 1, dx)
        return
      }
      const el = boxEl()
      if (info) {
        if (dy > 50) setInfo(false)
        return
      }
      if (dy < -50) {
        setInfo(true)
        return
      }
      if (dy > 110 || dy / Math.max(1, dt) > 0.6) {
        close()
        return
      }
      if (el) {
        const from = el.style.transform
        el.style.transform = ''
        animateSpring(el, [{ transform: from || 'none' }, { transform: 'translate(0,0) scale(1)' }], springs.snappy(), { fill: 'none' })
      }
      if (bgRef.current) bgRef.current.style.opacity = ''
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
  }

  const onTap = (ev: PointerEvent) => {
    const now = performance.now()
    if (now - lastTap.current < 300) {
      lastTap.current = 0
      const el = boxEl()
      if (!el) return
      if (zoomAt) setZoomAt(null)
      else {
        const r = el.getBoundingClientRect()
        setZoomAt({ x: ((ev.clientX - r.left) / r.width) * 100, y: ((ev.clientY - r.top) / r.height) * 100 })
      }
      return
    }
    lastTap.current = now
    window.setTimeout(() => {
      if (lastTap.current === now) {
        if (info) setInfo(false)
        else setChrome((c) => !c)
      }
    }, 260)
  }

  if (!photo) {
    window.setTimeout(() => useUI.getState().set({ viewer: null }), 0)
    return null
  }

  const os = useOS.getState
  const removeCurrent = () => {
    const next = ids.filter((i) => i !== photo.id)
    if (!next.length) return useUI.getState().set({ viewer: null })
    setIds(next)
    setIndex(Math.min(idx, next.length - 1))
  }
  const del = () => {
    if (v.deleted) {
      showAlert({ title: 'Delete Permanently?', message: 'This item will be deleted from all your devices. You can’t undo this action.', actions: [{ label: 'Cancel', style: 'cancel' }, { label: 'Delete', style: 'destructive', onPress: () => { usePh.getState().purge([photo.id]); removeCurrent() } }] })
      return
    }
    showAlert({
      title: photo.kind === 'video' ? 'Delete Video?' : 'Delete Photo?',
      message: `This ${photo.kind === 'video' ? 'video' : 'photo'} will be moved to Recently Deleted.${v.sharedAlbumId ? ' It stays in the shared album.' : ''}`,
      actions: [{ label: 'Cancel', style: 'cancel' }, { label: photo.kind === 'video' ? 'Delete Video' : 'Delete Photo', style: 'destructive', onPress: () => { usePh.getState().del([photo.id]); if (!v.sharedAlbumId) removeCurrent() } }],
    })
  }
  const edited = isEdited(photo)
  const hasInsight = !!SCENE_INSIGHTS[photo.scene]
  const sharedAlbum = v.sharedAlbumId ? os().sharedAlbums.find((a) => a.id === v.sharedAlbumId) : undefined

  const menu = (el: HTMLElement) => openMenu(el, [
    { label: 'Copy', icon: <Copy size={17} />, onSelect: () => os().showToast('Copied Photo') },
    { label: 'Duplicate', icon: <SquareStack size={17} />, onSelect: () => { const { id: _i, ...rest } = photo; void _i; os().addPhoto({ ...rest, ts: photo.ts + 1000 }); os().showToast('Duplicated') } },
    { label: 'Add to Album', icon: <Plus size={17} />, onSelect: () => setAlbumPick(true) },
    { label: 'Slideshow', icon: <Play size={17} />, onSelect: () => useUI.getState().set({ slideshow: { ids: photos.slice(Math.max(0, idx - 5), idx + 7).map((p) => p.id), title: fmtShortDate(photo.ts) } }) },
    ...(photo.kind === 'video' ? [{ label: 'Save Frame as Photo', icon: <Camera size={17} />, onSelect: () => saveFrame(photo, vid.pos) }] : []),
    ...(edited ? [{ label: 'Revert to Original', icon: <RotateCcw size={17} />, onSelect: () => { os().updatePhoto(photo.id, { edits: undefined }); os().showToast('Reverted to Original') } }] : []),
    { label: 'Show in All Photos', icon: <Images size={17} />, onSelect: () => { useUI.getState().set({ tab: 'library', viewer: null }); usePh.getState().set({ zoom: 'all', libFilter: 'all' }) } },
    { label: 'Hide', icon: <EyeOff size={17} />, separatorBefore: true, onSelect: () => { os().updatePhoto(photo.id, { hidden: true }); os().showToast('Moved to Hidden'); removeCurrent() } },
  ])

  return (
    <div ref={rootRef} className={`ph-viewer ${chrome ? '' : 'immersive'} ${info ? 'info' : ''} ${landscape ? 'land' : ''}`} role="dialog" aria-label="Photo viewer">
      <div className="ph-v-bg" ref={bgRef} />
      <div className="ph-v-stage" onPointerDown={onPointerDown}>
        <div className="ph-v-track" ref={trackRef}>
          {[-1, 0, 1].map((k) => {
            const p = photos[idx + k]
            if (!p) return null
            return (
              <div key={p.id} className={`ph-v-slide ${k === 0 ? 'cur' : ''}`} style={{ transform: k ? `translateX(calc(${k * 100}% + ${k * 16}px))` : undefined }} aria-hidden={k !== 0}>
                <div className="ph-v-box" style={{ ['--r' as string]: photoRatio(p) }}>
                  <div className="ph-v-zoom" style={k === 0 && zoomAt ? { transform: 'scale(2.2)', transformOrigin: `${zoomAt.x}% ${zoomAt.y}%` } : undefined}>
                    {p.kind === 'video' && k === 0 ? <VideoFrame photo={p} f={vid.pos / vid.dur} /> : <PhotoView photo={p} grain={k === 0} />}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="ph-v-top ph-v-chrome">
        <button className="bar-btn icon glass dark-glass interactive" aria-label="Back" onClick={close}><ChevronLeft size={26} strokeWidth={2.4} /></button>
        <div className="ph-v-title">
          <div className="t-headline">{fmtShortDate(photo.ts)}</div>
          <div className="t-caption1">{fmtTime(photo.ts)}{photo.place ? ` · ${photo.place}` : ''}</div>
          {edited && <span className="ph-edited-badge">{photo.edits && (photo.edits.cleanedUp?.length || photo.edits.extended || photo.edits.reframe) ? '✦ Edited' : 'Edited'}</span>}
        </div>
        <button className="bar-btn icon glass dark-glass interactive" aria-label="More" onClick={(e) => menu(e.currentTarget)}><Ellipsis size={22} /></button>
      </div>

      {photo.kind === 'video' && !info && <VideoControls photo={photo} vid={vid} chrome={chrome} />}

      {sharedAlbum && !info && (
        <div className="ph-v-react ph-v-chrome glass dark-glass">
          {EMOJIS.map((em) => {
            const mine = sharedAlbum.reactions[photo.id]?.some((r) => r.who === 'me' && r.emoji === em)
            const count = sharedAlbum.reactions[photo.id]?.filter((r) => r.emoji === em).length ?? 0
            return (
              <button key={em} className={mine ? 'on' : ''} aria-pressed={mine} aria-label={`React ${em}`} onClick={() => react(sharedAlbum.id, photo.id, em)}>
                <span>{em}</span>{count > 0 && <small>{count}</small>}
              </button>
            )
          })}
        </div>
      )}

      <div className="ph-v-bottom ph-v-chrome">
        <button className="ph-v-circle glass dark-glass interactive" aria-label="Share" onClick={() => os().set({ shareRequest: { title: photo.place ?? 'Photo', kind: 'photo', photoId: photo.id, app: 'photos' } })}><Share size={21} /></button>
        {v.deleted ? (
          <button className="ph-v-capsule glass dark-glass interactive ph-v-recover" onClick={() => { usePh.getState().recover([photo.id]); os().showToast('Recovered'); removeCurrent() }}><Undo2 size={19} /> Recover</button>
        ) : (
          <div className="ph-v-capsule glass dark-glass">
            <button aria-label={photo.favorite ? 'Unfavorite' : 'Favorite'} aria-pressed={!!photo.favorite} className={photo.favorite ? 'fav' : ''} onClick={(e) => { os().updatePhoto(photo.id, { favorite: !photo.favorite }); (e.currentTarget.firstChild as Element)?.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.35)' }, { transform: 'scale(1)' }], { duration: 320 }) }}>
              <Heart size={22} fill={photo.favorite ? 'currentColor' : 'none'} />
            </button>
            <button aria-label="Info" aria-pressed={info} className={info ? 'on' : ''} onClick={() => setInfo(!info)}>
              <Info size={22} />
              {hasInsight && <span className="ph-v-lookup-dot" aria-hidden>✦</span>}
            </button>
            <button aria-label="Edit" onClick={() => useUI.getState().set({ editor: photo.id })}><SlidersHorizontal size={22} /></button>
          </div>
        )}
        <button className="ph-v-circle glass dark-glass interactive" aria-label={v.deleted ? 'Delete Permanently' : 'Delete'} onClick={del}><Trash2 size={21} /></button>
      </div>

      <div className="ph-v-info" aria-hidden={!info} inert={!info ? true : undefined}>
        <InfoPanel photo={photo} onClose={() => setInfo(false)} onExit={close} />
      </div>
      <AlbumPickerSheet open={albumPick} ids={[photo.id]} onClose={() => setAlbumPick(false)} />
    </div>
  )
}

export function react(albumId: string, photoId: string, emoji: string) {
  const os = useOS.getState()
  os.set({
    sharedAlbums: os.sharedAlbums.map((a) => {
      if (a.id !== albumId) return a
      const list = a.reactions[photoId] ?? []
      const has = list.some((r) => r.who === 'me' && r.emoji === emoji)
      const next = has ? list.filter((r) => !(r.who === 'me' && r.emoji === emoji)) : [...list, { who: 'me', emoji }]
      return {
        ...a,
        reactions: { ...a.reactions, [photoId]: next },
        activity: has ? a.activity : [{ id: `ac-${Date.now()}`, who: 'me', what: `reacted ${emoji} to a photo`, ts: Date.now(), photoId, emoji }, ...a.activity],
      }
    }),
  })
  playTap()
}

function playTap() {
  import('../../os/audio').then((m) => m.playAlert('tapback', useOS.getState().volume)).catch(() => {})
}

export function saveFrame(photo: Photo, pos: number) {
  const os = useOS.getState()
  const { id: _id, duration: _d, ...rest } = photo
  void _id
  void _d
  const newId = os.addPhoto({
    ...rest,
    kind: 'photo',
    ts: photo.ts + Math.round(pos * 1000),
    capturedByMe: true,
    description: `Frame saved from video at ${fmtDur(pos)}: ${photo.description.replace(/^Video of /, '')}`,
    keywords: [...photo.keywords.filter((k) => k !== 'video'), 'video frame'],
    sizeMB: 1.6,
    width: photo.width,
    height: photo.height,
    edits: { ...(photo.edits ?? {}), capture: { zoom: 1.06 } } as Photo['edits'],
  })
  os.showToast(`Frame at ${fmtDur(pos)} saved to Library`)
  return newId
}

/** Simulated video playback state (lives at viewer level so controls sit outside the zoomable box). */
function useVideo(photo: Photo | undefined) {
  const dur = photo?.duration ?? 10
  const [playing, setPlaying] = useState(false)
  const [pos, setPos] = useState(0)
  const [muted, setMuted] = useState(false)
  useEffect(() => {
    setPlaying(false)
    setPos(0)
  }, [photo?.id])
  useEffect(() => {
    if (!playing) return
    let last = performance.now()
    let raf = 0
    const tick = (t: number) => {
      const dt = (t - last) / 1000
      last = t
      setPos((p) => {
        const n = p + dt
        if (n >= dur) {
          setPlaying(false)
          return dur
        }
        return n
      })
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [playing, dur])
  return { dur, playing, setPlaying, pos, setPos, muted, setMuted }
}
type VideoApi = ReturnType<typeof useVideo>

function VideoFrame({ photo, f }: { photo: Photo; f: number }) {
  return (
    <div className="ph-video-frame" style={{ transform: `scale(${1.06 + Math.sin(f * Math.PI) * 0.04}) translateX(${(f - 0.5) * -3}%)` }}>
      <PhotoView photo={photo} grain />
    </div>
  )
}

function VideoControls({ photo, vid, chrome }: { photo: Photo; vid: VideoApi; chrome: boolean }) {
  const { dur, playing, setPlaying, pos, setPos, muted, setMuted } = vid
  const stripRef = useRef<HTMLDivElement>(null)
  const f = pos / dur
  const scrub = (clientX: number) => {
    const r = stripRef.current!.getBoundingClientRect()
    setPos(Math.max(0, Math.min(1, (clientX - r.left) / r.width)) * dur)
  }
  return (
    <>
      {!playing && (
        <button className="ph-v-play glass dark-glass interactive" aria-label="Play video" onClick={() => { if (pos >= dur) setPos(0); setPlaying(true) }}>
          <Play size={30} fill="#fff" />
        </button>
      )}
      <div className={`ph-v-scrub ph-v-chrome ${chrome ? '' : 'hide'}`}>
        <div className="ph-v-scrub-row">
          <button className="ph-v-scrub-btn" aria-label={playing ? 'Pause' : 'Play'} onClick={() => setPlaying(!playing)}>{playing ? <Pause size={18} fill="#fff" /> : <Play size={18} fill="#fff" />}</button>
          <div
            className="ph-v-strip"
            ref={stripRef}
            role="slider"
            aria-label="Video position"
            aria-valuemin={0}
            aria-valuemax={dur}
            aria-valuenow={Math.round(pos)}
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'ArrowRight') setPos(Math.min(dur, pos + 1)); if (e.key === 'ArrowLeft') setPos(Math.max(0, pos - 1)) }}
            onPointerDown={(e) => {
              setPlaying(false)
              scrub(e.clientX)
              const move = (ev: PointerEvent) => scrub(ev.clientX)
              const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up) }
              window.addEventListener('pointermove', move)
              window.addEventListener('pointerup', up)
            }}
          >
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="ph-v-strip-frame"><div style={{ width: '100%', height: '100%', transform: `scale(1.3) translateX(${(i - 3) * -4}%)` }}><PhotoView photo={photo} /></div></div>
            ))}
            <div className="ph-v-playhead" style={{ left: `${f * 100}%` }} />
          </div>
          <button className="ph-v-scrub-btn" aria-label={muted ? 'Unmute' : 'Mute'} onClick={() => setMuted(!muted)}>{muted ? <VolumeX size={18} /> : <Volume2 size={18} />}</button>
        </div>
        <div className="ph-v-scrub-row sub">
          <span className="ph-v-time">{fmtDur(pos)} / {fmtDur(dur)}</span>
          <button className="ph-v-saveframe glass dark-glass interactive" onClick={() => { setPlaying(false); saveFrame(photo, pos) }}><Camera size={15} /> Save Frame as Photo</button>
        </div>
      </div>
    </>
  )
}
