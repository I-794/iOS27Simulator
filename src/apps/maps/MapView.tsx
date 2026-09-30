import { memo, useLayoutEffect, useRef, useState, type ReactNode, type CSSProperties } from 'react'
import { Coffee, UtensilsCrossed, Trees, GraduationCap, ShoppingBag, BookOpen, House, Plane, Stethoscope, MapPin, Star } from 'lucide-react'
import { screenScale } from '../../os/hooks'
import { useOS } from '../../os/store'
import { ROADS, RIVER, PARKS, WATER, BUILDINGS, ROAD_LABELS, polyPath, smoothPath, type Pt } from './geo'
import './mapview.css'

export interface Camera { x: number; y: number; z: number; heading?: number; tilt?: number }
export interface MapPin { id: string; x: number; y: number; node: ReactNode; onClick?: () => void; zIndex?: number }
export interface MapRoute { pts: Pt[]; color?: string; width?: number; dashed?: boolean; dim?: boolean; onClick?: () => void; id?: string }

export const CATEGORY: Record<string, { color: string; Icon: typeof Coffee; label: string }> = {
  coffee: { color: '#c47a2c', Icon: Coffee, label: 'Coffee Shop' },
  restaurant: { color: '#ff9500', Icon: UtensilsCrossed, label: 'Restaurant' },
  park: { color: '#30b858', Icon: Trees, label: 'Park' },
  school: { color: '#a2845e', Icon: GraduationCap, label: 'High School' },
  shopping: { color: '#f5a623', Icon: ShoppingBag, label: 'Shopping Center' },
  library: { color: '#8e6ad8', Icon: BookOpen, label: 'Library' },
  home: { color: '#007aff', Icon: House, label: 'Home' },
  airport: { color: '#32ade6', Icon: Plane, label: 'Airport' },
  health: { color: '#ff3b30', Icon: Stethoscope, label: 'Dentist' },
  guide: { color: '#ff2d55', Icon: Star, label: 'Guide' },
}
export const catOf = (kind: string) => CATEGORY[kind] ?? { color: '#8e8e93', Icon: MapPin, label: 'Place' }

/** iOS-style place pin: coloured glyph circle + label. */
export function PlacePin({ kind, label, selected, small }: { kind: string; label?: string; selected?: boolean; small?: boolean }) {
  const c = catOf(kind)
  return (
    <div className={`mp-pin ${selected ? 'sel' : ''} ${small ? 'small' : ''}`} style={{ '--pin': c.color } as CSSProperties}>
      <div className="mp-pin-bubble"><c.Icon size={selected ? 22 : small ? 12 : 15} strokeWidth={2.4} color="#fff" /></div>
      {selected && <div className="mp-pin-tail" />}
      {label && <div className="mp-pin-label">{label}</div>}
    </div>
  )
}

export function UserDot({ heading, mapHeading = 0 }: { heading?: number; mapHeading?: number }) {
  return (
    <div className="mp-user">
      <div className="mp-user-halo" />
      {heading !== undefined && <div className="mp-user-cone" style={{ transform: `translate(-50%, -100%) rotate(${heading - mapHeading}deg)` }} />}
      <div className="mp-user-dot" />
    </div>
  )
}

const MapArt = memo(function MapArt({ flatBuildings }: { flatBuildings: boolean }) {
  return (
    <svg className="mp-art" width="1000" height="1000" viewBox="0 0 1000 1000" aria-hidden>
      <rect width="1000" height="1000" className="mp-land" />
      {PARKS.map((p) => <path key={p.name} d={polyPath(p.pts) + 'Z'} className="mp-park" />)}
      {/* school track */}
      <rect x="582" y="226" width="36" height="50" rx="18" className="mp-track" />
      <path d={smoothPath(RIVER)} className="mp-river" />
      {WATER.map((w) => <ellipse key={w.name} cx={w.cx} cy={w.cy} rx={w.rx} ry={w.ry} className="mp-water" />)}
      {/* airport */}
      <g className="mp-airport">
        <rect x="870" y="760" width="130" height="150" rx="6" />
        <rect x="905" y="770" width="16" height="140" rx="3" className="mp-runway" transform="rotate(-18 913 840)" />
        <rect x="950" y="780" width="12" height="110" rx="3" className="mp-runway" transform="rotate(-18 956 835)" />
      </g>
      {flatBuildings && BUILDINGS.map((b, i) => <rect key={i} x={b.x} y={b.y} width={b.w} height={b.d} rx="1.5" className={b.landmark ? 'mp-bld lm' : 'mp-bld'} />)}
      {(['minor', 'major', 'hwy'] as const).map((kind) => (
        <g key={kind}>
          {ROADS.filter((r) => r.kind === kind).map((r) => <path key={r.name + 'c'} d={polyPath(r.pts)} className={`mp-road-case ${kind}`} />)}
          {ROADS.filter((r) => r.kind === kind).map((r) => <path key={r.name} d={polyPath(r.pts)} className={`mp-road ${kind}`} />)}
        </g>
      ))}
    </svg>
  )
})

/** 3D extruded buildings (CSS 3D), used by 3D mode and Flyover. */
export const Buildings3D = memo(function Buildings3D() {
  return (
    <div className="mp-b3d">
      {BUILDINGS.map((b, i) => {
        const h = b.h * 0.9
        const base = b.landmark ? 'lm' : b.tone > 0.66 ? 't3' : b.tone > 0.33 ? 't2' : 't1'
        return (
          <div key={i} className={`mp-b ${base}`} style={{ left: b.x, top: b.y, width: b.w, height: b.d }}>
            <i className="f n" style={{ width: b.w, height: h }} />
            <i className="f s" style={{ top: b.d, width: b.w, height: h }} />
            <i className="f w" style={{ width: h, height: b.d }} />
            <i className="f e" style={{ left: b.w, width: h, height: b.d }} />
            <i className="f r" style={{ transform: `translateZ(${h}px)` }} />
          </div>
        )
      })}
    </div>
  )
})

export function MapView({
  camera, onCamera, interactive = true, animate = false, pins = [], routes = [], user, buildings3d, labels = true, onTap, className = '', children, layerChildren, anchorY = 0.5, minZ = 0.38, maxZ = 3.2,
}: {
  camera: Camera
  onCamera?: (c: Camera) => void
  interactive?: boolean
  animate?: boolean
  pins?: MapPin[]
  routes?: MapRoute[]
  user?: { p: Pt; heading?: number } | null
  buildings3d?: boolean
  labels?: boolean
  onTap?: (p: Pt) => void
  className?: string
  children?: ReactNode
  layerChildren?: ReactNode
  anchorY?: number
  minZ?: number
  maxZ?: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 402, h: 874 })
  const [dragging, setDragging] = useState(false)
  const theme = useOS((s) => s.theme)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => setSize({ w: el.offsetWidth || 402, h: el.offsetHeight || 874 })
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const cam = useRef(camera)
  cam.current = camera
  const heading = camera.heading ?? 0
  const tilt = camera.tilt ?? 0
  const z = camera.z
  const ax = size.w / 2
  const ay = size.h * anchorY
  const layerT = `translate(${ax}px, ${ay}px) rotateX(${tilt}deg) rotate(${-heading}deg) scale(${z}) translate(${-camera.x}px, ${-camera.y}px)`
  const bill = `scale(${1 / z}) rotate(${heading}deg) rotateX(${-tilt}deg)`
  const anim = animate && !dragging

  const clampZ = (v: number) => Math.min(maxZ, Math.max(minZ, v))
  const toWorldDelta = (dx: number, dy: number, zz: number) => {
    const h = (heading * Math.PI) / 180
    const dyt = dy / Math.max(0.35, Math.cos((tilt * Math.PI) / 180))
    return { x: (dx * Math.cos(h) - dyt * Math.sin(h)) / zz, y: (dx * Math.sin(h) + dyt * Math.cos(h)) / zz }
  }
  const screenToWorld = (sx: number, sy: number): Pt => {
    const d = toWorldDelta(sx - ax, sy - ay, cam.current.z)
    return { x: cam.current.x + d.x, y: cam.current.y + d.y }
  }

  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const onPointerDown = (e: React.PointerEvent) => {
    if (!interactive || e.button !== 0) return
    const scale = screenScale()
    const rect = ref.current!.getBoundingClientRect()
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const start = { ...cam.current }
    const x0 = e.clientX
    const y0 = e.clientY
    let moved = false
    let pinch0 = 0
    let lastT = performance.now()
    let vx = 0
    let vy = 0
    let lx = x0
    let ly = y0
    const move = (ev: PointerEvent) => {
      if (!pointers.current.has(ev.pointerId)) return
      pointers.current.set(ev.pointerId, { x: ev.clientX, y: ev.clientY })
      const pts = [...pointers.current.values()]
      if (pts.length >= 2) {
        const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y)
        if (!pinch0) pinch0 = d / cam.current.z
        onCamera?.({ ...cam.current, z: clampZ(d / pinch0) })
        moved = true
        return
      }
      const dx = (ev.clientX - x0) / scale
      const dy = (ev.clientY - y0) / scale
      if (!moved && Math.hypot(dx, dy) < 4) return
      if (!moved) setDragging(true)
      moved = true
      const now = performance.now()
      const dt = Math.max(1, now - lastT)
      vx = ((ev.clientX - lx) / scale / dt) * 1000
      vy = ((ev.clientY - ly) / scale / dt) * 1000
      lx = ev.clientX
      ly = ev.clientY
      lastT = now
      const w = toWorldDelta(dx, dy, start.z)
      onCamera?.({ ...cam.current, x: clamp(start.x - w.x, 0, 1000), y: clamp(start.y - w.y, 0, 1000) })
    }
    const up = (ev: PointerEvent) => {
      pointers.current.delete(ev.pointerId)
      if (pointers.current.size > 0) return
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      setDragging(false)
      if (!moved) {
        onTap?.(screenToWorld((ev.clientX - rect.left) / scale, (ev.clientY - rect.top) / scale))
        return
      }
      // inertia
      if (performance.now() - lastT < 80 && Math.hypot(vx, vy) > 150) {
        let fx = vx * 0.016
        let fy = vy * 0.016
        const step = () => {
          fx *= 0.9
          fy *= 0.9
          const w = toWorldDelta(fx, fy, cam.current.z)
          onCamera?.({ ...cam.current, x: clamp(cam.current.x - w.x, 0, 1000), y: clamp(cam.current.y - w.y, 0, 1000) })
          if (Math.hypot(fx, fy) > 0.3) requestAnimationFrame(step)
        }
        requestAnimationFrame(step)
      }
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
  }
  const onWheel = (e: React.WheelEvent) => {
    if (!interactive) return
    e.stopPropagation()
    const scale = screenScale()
    const rect = ref.current!.getBoundingClientRect()
    const sx = (e.clientX - rect.left) / scale
    const sy = (e.clientY - rect.top) / scale
    const c = cam.current
    const nz = clampZ(c.z * Math.exp(-e.deltaY * 0.0016))
    // keep the point under the cursor fixed
    const before = toWorldDelta(sx - ax, sy - ay, c.z)
    const after = toWorldDelta(sx - ax, sy - ay, nz)
    onCamera?.({ ...c, z: nz, x: clamp(c.x + before.x - after.x, 0, 1000), y: clamp(c.y + before.y - after.y, 0, 1000) })
  }
  const onDouble = (e: React.MouseEvent) => {
    if (!interactive) return
    const scale = screenScale()
    const rect = ref.current!.getBoundingClientRect()
    const p = screenToWorld((e.clientX - rect.left) / scale, (e.clientY - rect.top) / scale)
    const c = cam.current
    onCamera?.({ ...c, z: clampZ(c.z * 1.7), x: (c.x + p.x) / 2, y: (c.y + p.y) / 2 })
  }

  const dark = theme === 'dark'
  return (
    <div
      ref={ref}
      className={`mp-view ${dark ? 'dark' : ''} ${anim ? 'anim' : ''} ${z < 0.62 ? 'far' : ''} ${z > 1.5 ? 'near' : ''} ${className}`}
      onPointerDown={onPointerDown}
      onWheel={onWheel}
      onDoubleClick={onDouble}
      style={{ perspectiveOrigin: `${ax}px ${ay}px` }}
    >
      <div className="mp-layer" style={{ transform: layerT }}>
        <MapArt flatBuildings={!buildings3d} />
        <svg className="mp-routes" width="1000" height="1000" viewBox="0 0 1000 1000">
          {routes.map((r, i) => (
            <g key={r.id ?? i} className={`mp-route ${r.dim ? 'dim' : ''}`} onPointerDown={(e) => { if (r.onClick) { e.stopPropagation(); r.onClick() } }} style={{ cursor: r.onClick ? 'pointer' : undefined }}>
              <path d={polyPath(r.pts)} className="mp-route-case" style={{ strokeWidth: ((r.width ?? 7) + 3) / Math.sqrt(z) }} />
              <path d={polyPath(r.pts)} style={{ stroke: r.color ?? '#0a84ff', strokeWidth: (r.width ?? 7) / Math.sqrt(z), strokeDasharray: r.dashed ? `${2 / z} ${9 / z}` : undefined }} className="mp-route-line" />
            </g>
          ))}
        </svg>
        {buildings3d && <Buildings3D />}
        {labels && ROAD_LABELS.map((l, i) => (
          <div key={i} className={`mp-rlabel ${l.kind ?? 'road'}`} style={{ left: l.x, top: l.y, transform: `translate(-50%, -50%) rotate(${l.kind === 'hwy' ? heading : l.a}deg) scale(${1 / Math.max(0.7, Math.min(1.6, z))})` }}>
            {l.text}
          </div>
        ))}
        {layerChildren}
        {user && (
          <div className="mp-anchor" style={{ left: user.p.x, top: user.p.y, transform: bill, zIndex: 30 }}>
            <UserDot heading={user.heading} mapHeading={heading} />
          </div>
        )}
        {pins.map((p) => (
          <div
            key={p.id}
            className="mp-anchor"
            style={{ left: p.x, top: p.y, transform: bill, zIndex: p.zIndex ?? 10 }}
            onPointerDown={(e) => { if (p.onClick) e.stopPropagation() }}
            onClick={(e) => { e.stopPropagation(); p.onClick?.() }}
          >
            {p.node}
          </div>
        ))}
      </div>
      {children}
    </div>
  )
}

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v))

/** Static, non-interactive map snippet (Calendar event details, Find My cards). */
export function MiniMap({ center, kind, label, zoom = 1.5, style, className = '' }: { center: Pt; kind: string; label?: string; zoom?: number; style?: CSSProperties; className?: string }) {
  return (
    <div className={`mp-mini ${className}`} style={style}>
      <MapView
        camera={{ x: center.x, y: center.y + 10, z: zoom }}
        interactive={false}
        labels
        pins={[{ id: 'p', x: center.x, y: center.y, node: <PlacePin kind={kind} label={label} selected /> }]}
        anchorY={0.58}
      />
    </div>
  )
}
