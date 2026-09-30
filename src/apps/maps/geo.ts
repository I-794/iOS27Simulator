/* Maple Grove vector world (0–1000 space), road graph and routing. All fictional. */
import { MAP_PLACES } from '../../os/data/world'

export type Pt = { x: number; y: number }
export type Place = (typeof MAP_PLACES)[number] & { hours?: string }
export const PLACES = MAP_PLACES as Place[]
export const placeById = (id: string) => PLACES.find((p) => p.id === id)

/** "You are here" — Jamie is at school (matches Siri's routing). */
export const HERE: Pt = { x: 556, y: 318 }
/** One map unit in miles. */
export const MI_PER_UNIT = 0.006

export interface Road { name: string; kind: 'hwy' | 'major' | 'minor'; pts: [number, number][] }

export const ROADS: Road[] = [
  { name: 'Lincoln Ave', kind: 'major', pts: [[40, 300], [120, 300], [240, 300], [330, 300], [470, 300], [560, 300], [640, 300], [820, 300], [900, 300], [980, 300]] },
  { name: 'Main St', kind: 'major', pts: [[120, 360], [240, 360], [330, 360], [470, 360], [640, 360], [780, 360], [860, 390]] },
  { name: 'Elm St', kind: 'minor', pts: [[120, 450], [240, 450], [330, 450], [470, 450], [640, 450], [760, 470]] },
  { name: 'Oak Ave', kind: 'major', pts: [[470, 110], [470, 300], [470, 360], [470, 450], [470, 620], [470, 830]] },
  { name: 'Birchwood Ln', kind: 'minor', pts: [[140, 620], [240, 620], [330, 620], [470, 620]] },
  { name: 'Civic Center Dr', kind: 'minor', pts: [[330, 200], [330, 300], [330, 360], [330, 450], [330, 620]] },
  { name: 'Willow Creek Dr', kind: 'minor', pts: [[60, 150], [120, 220], [120, 300], [120, 360], [120, 450], [150, 540]] },
  { name: '2nd Ave', kind: 'minor', pts: [[240, 300], [240, 360], [240, 450], [240, 620], [240, 740]] },
  { name: 'Maple St', kind: 'minor', pts: [[640, 190], [640, 300], [640, 360], [640, 450], [640, 700]] },
  { name: 'River Rd', kind: 'major', pts: [[290, 930], [470, 830], [560, 760], [640, 700], [690, 560], [760, 470], [860, 390], [900, 360], [980, 320]] },
  { name: 'Greenfield Pkwy', kind: 'major', pts: [[820, 90], [820, 240], [820, 300]] },
  { name: 'I-5', kind: 'hwy', pts: [[900, 20], [900, 300], [900, 360], [900, 600], [900, 820], [900, 990]] },
  { name: 'Airport Way', kind: 'minor', pts: [[900, 820], [940, 850]] },
  { name: 'Hillcrest Rd', kind: 'minor', pts: [[120, 220], [240, 190], [330, 200], [470, 170], [640, 190], [820, 160]] },
]

export const RIVER: [number, number][] = [[240, 1000], [330, 950], [450, 880], [560, 805], [660, 745], [730, 600], [790, 510], [880, 430], [1000, 385]]

export const PARKS: { name: string; pts: [number, number][]; label?: Pt }[] = [
  { name: 'Riverside Park', pts: [[560, 640], [630, 620], [700, 640], [720, 700], [680, 740], [600, 770], [545, 720]], label: { x: 625, y: 675 } },
  { name: 'Willow Creek Preserve', pts: [[0, 120], [60, 120], [95, 200], [90, 330], [100, 520], [60, 620], [0, 640]], label: { x: 45, y: 400 } },
  { name: 'Civic Green', pts: [[345, 212], [440, 212], [440, 285], [345, 285]] },
  { name: 'Lincoln Fields', pts: [[575, 215], [625, 215], [625, 285], [575, 285]] },
  { name: 'Birch Park', pts: [[260, 640], [320, 640], [320, 700], [260, 700]] },
]

export const WATER: { name: string; cx: number; cy: number; rx: number; ry: number }[] = [
  { name: 'Mill Pond', cx: 150, cy: 790, rx: 70, ry: 42 },
]

// deterministic PRNG
export function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

export interface Building { x: number; y: number; w: number; d: number; h: number; tone: number; landmark?: string }

/** Building footprints: dense downtown blocks, houses in neighborhoods. */
export const BUILDINGS: Building[] = (() => {
  const r = rng(7729)
  const out: Building[] = []
  const block = (x0: number, y0: number, x1: number, y1: number, density: number, hMin: number, hMax: number, size: [number, number]) => {
    for (let y = y0 + 8; y < y1 - 10; y += size[1] + 8) {
      for (let x = x0 + 8; x < x1 - 10; x += size[0] + 8) {
        if (r() > density) continue
        const w = size[0] * (0.7 + r() * 0.4)
        const d = size[1] * (0.7 + r() * 0.4)
        if (x + w > x1 - 6 || y + d > y1 - 6) continue
        out.push({ x, y, w, d, h: hMin + r() * (hMax - hMin), tone: r() })
      }
    }
  }
  // downtown (between Lincoln/Main/Elm and Civic/Oak/Maple)
  block(330, 300, 470, 360, 0.95, 26, 80, [30, 22])
  block(470, 300, 640, 360, 0.95, 30, 110, [34, 22])
  block(330, 360, 470, 450, 0.9, 20, 70, [30, 30])
  block(470, 360, 640, 450, 0.95, 26, 95, [34, 30])
  block(640, 300, 820, 360, 0.8, 16, 50, [36, 24])
  block(240, 300, 330, 360, 0.8, 14, 34, [22, 22])
  // neighborhoods: small houses
  block(120, 450, 240, 620, 0.7, 6, 12, [16, 14])
  block(240, 450, 330, 620, 0.7, 6, 12, [16, 14])
  block(330, 450, 470, 620, 0.75, 6, 14, [18, 14])
  block(120, 360, 240, 450, 0.7, 6, 12, [16, 14])
  block(470, 450, 640, 620, 0.6, 8, 20, [22, 18])
  block(130, 230, 240, 300, 0.6, 6, 12, [16, 14])
  block(640, 360, 760, 450, 0.7, 10, 26, [22, 20])
  block(660, 180, 810, 290, 0.5, 10, 24, [26, 20])
  // landmarks
  out.push({ x: 515, y: 232, w: 52, d: 46, h: 34, tone: 0.2, landmark: 'Lincoln High' })
  out.push({ x: 780, y: 205, w: 80, d: 60, h: 28, tone: 0.5, landmark: 'Greenfield Mall' })
  out.push({ x: 300, y: 228, w: 42, d: 36, h: 30, tone: 0.8, landmark: 'Library' })
  out.push({ x: 520, y: 318, w: 34, d: 30, h: 150, tone: 0.1, landmark: 'Grove Tower' })
  return out
})()

export const ROAD_LABELS: { text: string; x: number; y: number; a: number; kind?: 'hwy' | 'area' | 'water' | 'park' }[] = [
  { text: 'Lincoln Ave', x: 745, y: 300, a: 0 },
  { text: 'Lincoln Ave', x: 185, y: 300, a: 0 },
  { text: 'Main St', x: 560, y: 360, a: 0 },
  { text: 'Elm St', x: 555, y: 450, a: 0 },
  { text: 'Elm St', x: 180, y: 450, a: 0 },
  { text: 'Oak Ave', x: 470, y: 720, a: 90 },
  { text: 'Oak Ave', x: 470, y: 200, a: 90 },
  { text: 'Birchwood Ln', x: 400, y: 620, a: 0 },
  { text: 'Civic Center Dr', x: 330, y: 535, a: 90 },
  { text: 'Willow Creek Dr', x: 120, y: 405, a: 90 },
  { text: '2nd Ave', x: 240, y: 535, a: 90 },
  { text: 'Maple St', x: 640, y: 560, a: 90 },
  { text: 'River Rd', x: 725, y: 515, a: -52 },
  { text: 'River Rd', x: 390, y: 875, a: -29 },
  { text: 'Greenfield Pkwy', x: 820, y: 150, a: 90 },
  { text: 'Hillcrest Rd', x: 560, y: 180, a: 7 },
  { text: '5', x: 900, y: 480, a: 0, kind: 'hwy' },
  { text: '5', x: 900, y: 120, a: 0, kind: 'hwy' },
  { text: 'DOWNTOWN', x: 520, y: 408, a: 0, kind: 'area' },
  { text: 'BIRCHWOOD', x: 180, y: 540, a: 0, kind: 'area' },
  { text: 'NORTH HILLS', x: 700, y: 120, a: 0, kind: 'area' },
  { text: 'Maple River', x: 610, y: 790, a: -34, kind: 'water' },
  { text: 'Mill Pond', x: 150, y: 790, a: 0, kind: 'water' },
  { text: 'Willow Creek Preserve', x: 45, y: 400, a: 90, kind: 'park' },
]

// ------------------------------------------------------------------ graph
interface Edge { to: string; len: number; road: string; kind: Road['kind'] }
const key = (x: number, y: number) => `${Math.round(x)},${Math.round(y)}`

function projectOnSeg(p: Pt, a: [number, number], b: [number, number]) {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const t = Math.max(0, Math.min(1, ((p.x - a[0]) * dx + (p.y - a[1]) * dy) / (dx * dx + dy * dy || 1)))
  const x = a[0] + dx * t
  const y = a[1] + dy * t
  return { x, y, t, d: Math.hypot(p.x - x, p.y - y) }
}

/** Nearest point on any drivable road (optionally excluding highways). */
export function snapToRoad(p: Pt, noHwy = false) {
  let best = { x: p.x, y: p.y, d: Infinity, road: ROADS[0], i: 0, t: 0 }
  for (const r of ROADS) {
    if (noHwy && r.kind === 'hwy') continue
    for (let i = 0; i < r.pts.length - 1; i++) {
      const s = projectOnSeg(p, r.pts[i], r.pts[i + 1])
      if (s.d < best.d) best = { ...s, road: r, i }
    }
  }
  return best
}

type Graph = Map<string, { p: Pt; edges: Edge[] }>

function buildGraph(extra: Pt[], noHwy: boolean): Graph {
  // split road polylines at snapped extra points
  const roads = ROADS.filter((r) => !(noHwy && r.kind === 'hwy')).map((r) => ({ ...r, pts: r.pts.map((p) => [...p] as [number, number]) }))
  for (const e of extra) {
    let best: { r: (typeof roads)[number]; i: number; x: number; y: number; d: number } | null = null
    for (const r of roads) for (let i = 0; i < r.pts.length - 1; i++) {
      const s = projectOnSeg(e, r.pts[i], r.pts[i + 1])
      if (!best || s.d < best.d) best = { r, i, x: s.x, y: s.y, d: s.d }
    }
    if (best) best.r.pts.splice(best.i + 1, 0, [best.x, best.y])
  }
  const g: Graph = new Map()
  const node = (x: number, y: number) => {
    const k = key(x, y)
    if (!g.has(k)) g.set(k, { p: { x: Math.round(x), y: Math.round(y) }, edges: [] })
    return k
  }
  for (const r of roads) {
    for (let i = 0; i < r.pts.length - 1; i++) {
      const a = node(...r.pts[i])
      const b = node(...r.pts[i + 1])
      if (a === b) continue
      const len = Math.hypot(r.pts[i][0] - r.pts[i + 1][0], r.pts[i][1] - r.pts[i + 1][1])
      g.get(a)!.edges.push({ to: b, len, road: r.name, kind: r.kind })
      g.get(b)!.edges.push({ to: a, len, road: r.name, kind: r.kind })
    }
  }
  return g
}

export type Mode = 'drive' | 'walk' | 'transit' | 'bike'
const SPEED: Record<Mode, Record<Road['kind'], number>> = {
  drive: { hwy: 110, major: 48, minor: 38 },
  walk: { hwy: 0, major: 4.4, minor: 4.4 },
  bike: { hwy: 0, major: 13, minor: 13 },
  transit: { hwy: 60, major: 30, minor: 22 },
}

export interface Step { road: string; pts: Pt[]; len: number; instruction: string; turn: 'start' | 'left' | 'right' | 'straight' | 'slight-left' | 'slight-right' | 'arrive' }
export interface RouteResult { pts: Pt[]; len: number; minutes: number; miles: number; steps: Step[]; via: string; roads: string[] }

function dijkstra(g: Graph, from: string, to: string, mode: Mode, penalty?: Map<string, number>) {
  const dist = new Map<string, number>()
  const prev = new Map<string, { k: string; e: Edge }>()
  const done = new Set<string>()
  dist.set(from, 0)
  for (;;) {
    let u: string | null = null
    let best = Infinity
    for (const [k, d] of dist) if (!done.has(k) && d < best) { best = d; u = k }
    if (u === null || u === to) break
    done.add(u)
    for (const e of g.get(u)!.edges) {
      const sp = SPEED[mode][e.kind]
      if (!sp) continue
      const pen = penalty?.get(`${u}|${e.to}`) ?? 1
      const nd = best + (e.len / sp) * pen
      if (nd < (dist.get(e.to) ?? Infinity)) {
        dist.set(e.to, nd)
        prev.set(e.to, { k: u, e })
      }
    }
  }
  if (!prev.has(to) && from !== to) return null
  const path: { k: string; e?: Edge }[] = [{ k: to }]
  let cur = to
  while (cur !== from) {
    const p = prev.get(cur)!
    path[0].e = p.e
    path.unshift({ k: p.k })
    cur = p.k
  }
  return path
}

function turnDir(a: Pt, b: Pt, c: Pt): Step['turn'] {
  const v1 = { x: b.x - a.x, y: b.y - a.y }
  const v2 = { x: c.x - b.x, y: c.y - b.y }
  const cross = v1.x * v2.y - v1.y * v2.x
  const dot = v1.x * v2.x + v1.y * v2.y
  const ang = (Math.atan2(cross, dot) * 180) / Math.PI // screen coords: +y down → positive = right turn
  if (Math.abs(ang) < 20) return 'straight'
  if (Math.abs(ang) < 50) return ang > 0 ? 'slight-right' : 'slight-left'
  return ang > 0 ? 'right' : 'left'
}

const COMPASS = ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest']
export function compassDir(a: Pt, b: Pt) {
  const ang = (Math.atan2(b.x - a.x, -(b.y - a.y)) * 180) / Math.PI
  return COMPASS[Math.round(((ang + 360) % 360) / 45) % 8]
}

export function route(from: Pt, to: Pt, mode: Mode = 'drive', destName = 'your destination', avoid?: Set<string>): RouteResult | null {
  const noHwy = mode === 'walk' || mode === 'bike'
  const g = buildGraph([from, to], noHwy)
  const sa = snapToRoad(from, noHwy)
  const sb = snapToRoad(to, noHwy)
  const ka = key(sa.x, sa.y)
  const kb = key(sb.x, sb.y)
  if (!g.has(ka) || !g.has(kb)) return null
  let penalty: Map<string, number> | undefined
  if (avoid) {
    penalty = new Map()
    for (const [k, n] of g) for (const e of n.edges) if (avoid.has(e.road)) penalty.set(`${k}|${e.to}`, 3)
  }
  const path = dijkstra(g, ka, kb, mode, penalty)
  if (!path) return null
  const pts: Pt[] = [from, ...path.map((n) => g.get(n.k)!.p), to]
  // group into steps by road name
  const steps: Step[] = []
  let len = 0
  let mins = 0
  for (let i = 1; i < path.length; i++) {
    const e = path[i].e!
    const a = g.get(path[i - 1].k)!.p
    const b = g.get(path[i].k)!.p
    len += e.len
    mins += e.len / (SPEED[mode][e.kind] || 1)
    const last = steps[steps.length - 1]
    if (last && last.road === e.road) {
      last.pts.push(b)
      last.len += e.len
    } else {
      steps.push({ road: e.road, pts: [a, b], len: e.len, instruction: '', turn: 'start' })
    }
  }
  steps.forEach((s, i) => {
    if (i === 0) {
      s.turn = 'start'
      s.instruction = `Head ${compassDir(s.pts[0], s.pts[s.pts.length - 1])} on ${s.road}`
    } else {
      const prevS = steps[i - 1]
      const a = prevS.pts[prevS.pts.length - 2] ?? prevS.pts[0]
      s.turn = turnDir(a, s.pts[0], s.pts[1])
      const verb = s.turn === 'straight' ? 'Continue onto' : s.turn === 'left' ? 'Turn left onto' : s.turn === 'right' ? 'Turn right onto' : s.turn === 'slight-left' ? 'Bear left onto' : 'Bear right onto'
      s.instruction = s.road === 'I-5' ? `Take the ramp onto I-5 ${s.pts[1].y > s.pts[0].y ? 'South' : 'North'}` : `${verb} ${s.road}`
    }
  })
  steps.push({ road: destName, pts: [to], len: 0, instruction: `Arrive at ${destName}`, turn: 'arrive' })
  const extraMin = mode === 'transit' ? 6 : mode === 'drive' ? 1 : 0
  const minutes = Math.max(1, Math.round(mins + extraMin))
  const counts = new Map<string, number>()
  steps.forEach((s) => counts.set(s.road, (counts.get(s.road) ?? 0) + s.len))
  const via = [...counts.entries()].filter(([r]) => r !== destName).sort((a, b) => b[1] - a[1])[0]?.[0] ?? ''
  return { pts, len, minutes, miles: +(len * MI_PER_UNIT).toFixed(1), steps, via, roads: [...counts.keys()] }
}

/** Fastest route plus up to two distinct alternatives. */
export function routeOptions(from: Pt, to: Pt, mode: Mode, destName: string): RouteResult[] {
  const best = route(from, to, mode, destName)
  if (!best) return []
  const out = [best]
  const tried = new Set<string>()
  for (const road of [best.via, ...best.roads]) {
    if (out.length >= 3 || tried.has(road) || road === destName) continue
    tried.add(road)
    const alt = route(from, to, mode, destName, new Set([road]))
    if (alt && !out.some((o) => o.via === alt.via || Math.abs(o.len - alt.len) < 4) && alt.minutes <= best.minutes * 1.6 + 3) out.push(alt)
  }
  return out
}

/** Route through a stop (via). */
export function routeVia(from: Pt, via: Pt, to: Pt, mode: Mode, viaName: string, destName: string): RouteResult | null {
  const a = route(from, via, mode, viaName)
  const b = route(via, to, mode, destName)
  if (!a || !b) return null
  const steps = [...a.steps.slice(0, -1), { ...a.steps[a.steps.length - 1], instruction: `Stop at ${viaName}` }, ...b.steps]
  return { pts: [...a.pts, ...b.pts], len: a.len + b.len, minutes: a.minutes + b.minutes, miles: +(a.miles + b.miles).toFixed(1), steps, via: a.via, roads: [...new Set([...a.roads, ...b.roads])] }
}

export function fmtDist(units: number): string {
  const mi = units * MI_PER_UNIT
  if (mi < 0.19) return `${Math.max(50, Math.round((mi * 5280) / 50) * 50)} ft`
  return `${mi < 10 ? mi.toFixed(1) : Math.round(mi)} mi`
}

export function straightMiles(a: Pt, b: Pt) {
  return Math.hypot(a.x - b.x, a.y - b.y) * MI_PER_UNIT * 1.25
}

/** Match a free-text location ("Lincoln High Room 114") to a map place. */
export function placeForLocation(loc?: string): Place | undefined {
  if (!loc) return undefined
  const l = loc.toLowerCase()
  const direct = PLACES.find((p) => l.includes(p.name.toLowerCase()) || l.includes(p.address.toLowerCase()) || p.name.toLowerCase().includes(l))
  if (direct) return direct
  if (/lincoln high|room \d+|band room|cafeteria|auditorium|practice field|gym/.test(l)) return placeById('school')
  if (/riverside/.test(l)) return placeById('park')
  if (/library/.test(l)) return placeById('library')
  if (/airport|mgr/.test(l)) return placeById('airport')
  if (/elm st/.test(l)) return placeById('dentist')
  if (/rosa/.test(l)) return placeById('rosas')
  if (/brew lab/.test(l)) return placeById('brewlab')
  if (/greenfield/.test(l)) return placeById('mall')
  return undefined
}

export const polyPath = (pts: Pt[] | [number, number][]) =>
  (pts as (Pt | [number, number])[]).map((p, i) => {
    const x = Array.isArray(p) ? p[0] : p.x
    const y = Array.isArray(p) ? p[1] : p.y
    return `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`
  }).join(' ')

export function smoothPath(pts: [number, number][]) {
  let d = `M${pts[0][0]} ${pts[0][1]}`
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = (pts[i][0] + pts[i + 1][0]) / 2
    const my = (pts[i][1] + pts[i + 1][1]) / 2
    d += ` Q${pts[i][0]} ${pts[i][1]} ${mx} ${my}`
  }
  const l = pts[pts.length - 1]
  return d + ` L${l[0]} ${l[1]}`
}

/** Point at distance `d` along a polyline, with heading (deg, 0 = north). */
export function pointAlong(pts: Pt[], d: number): { p: Pt; heading: number; seg: number } {
  let acc = 0
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i]
    const b = pts[i + 1]
    const l = Math.hypot(b.x - a.x, b.y - a.y)
    if (acc + l >= d || i === pts.length - 2) {
      const t = l ? Math.min(1, Math.max(0, (d - acc) / l)) : 0
      return { p: { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }, heading: (Math.atan2(b.x - a.x, -(b.y - a.y)) * 180) / Math.PI, seg: i }
    }
    acc += l
  }
  return { p: pts[pts.length - 1], heading: 0, seg: pts.length - 2 }
}

export function polyLen(pts: Pt[]) {
  let l = 0
  for (let i = 0; i < pts.length - 1; i++) l += Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y)
  return l
}
