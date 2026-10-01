/* Turn-by-turn navigation simulation. Lives at module level so it keeps running (and
   keeps the 'navigation' Live Activity updated) when Maps is in the background. */
import { create } from 'zustand'
import { useOS } from '../../os/store'
import { fmtDist, pointAlong, polyLen, type RouteResult, type Pt, type Mode } from './geo'

export interface NavSim {
  active: boolean
  arrived: boolean
  route: RouteResult | null
  destName: string
  destId: string
  viaName?: string
  mode: Mode
  progress: number
  total: number
  stepStarts: number[]
  pos: Pt
  heading: number
  step: number
}

const SIM = 9 // simulated time multiplier

export const useNavSim = create<NavSim>(() => ({
  active: false, arrived: false, route: null, destName: '', destId: '', mode: 'drive', progress: 0, total: 0, stepStarts: [], pos: { x: 0, y: 0 }, heading: 0, step: 0,
}))

let timer: number | undefined
let unsub: (() => void) | undefined

function stepStartsFor(r: RouteResult): number[] {
  // distance along r.pts where each step begins
  const out: number[] = []
  for (const s of r.steps) {
    const p = s.pts[0]
    let acc = 0
    let best = 0
    let bestD = Infinity
    for (let i = 0; i < r.pts.length; i++) {
      if (i > 0) acc += Math.hypot(r.pts[i].x - r.pts[i - 1].x, r.pts[i].y - r.pts[i - 1].y)
      const d = Math.hypot(r.pts[i].x - p.x, r.pts[i].y - p.y)
      if (d < bestD - 0.01 && acc >= (out[out.length - 1] ?? 0)) { bestD = d; best = acc }
    }
    out.push(best)
  }
  return out
}

export function navSummary(n = useNavSim.getState()) {
  const r = n.route!
  const remaining = Math.max(0, n.total - n.progress)
  const mins = Math.max(1, Math.round((remaining / Math.max(1, n.total)) * r.minutes))
  const nextIdx = Math.min(r.steps.length - 1, n.step + 1)
  const toNext = Math.max(0, (n.stepStarts[nextIdx] ?? n.total) - n.progress)
  const arrival = new Date(Date.now() + mins * 60_000)
  return {
    mins,
    miles: +((remaining / Math.max(1, n.total)) * r.miles).toFixed(1),
    arrival: `${arrival.getHours() % 12 || 12}:${String(arrival.getMinutes()).padStart(2, '0')} ${arrival.getHours() >= 12 ? 'PM' : 'AM'}`,
    next: r.steps[nextIdx],
    then: r.steps[nextIdx + 1],
    toNext: fmtDist(toNext),
  }
}

function pushActivity() {
  const n = useNavSim.getState()
  if (!n.route) return
  const s = navSummary(n)
  const st = useOS.getState()
  const data = { eta: `${s.mins} min`, next: s.next.instruction, dist: s.toNext, arrival: s.arrival }
  if (st.activities.some((a) => a.id === 'nav')) st.updateActivity('nav', { title: n.destName, subtitle: n.viaName ? `via ${n.viaName}` : undefined, data })
  else st.startActivity({ id: 'nav', kind: 'navigation', title: n.destName, subtitle: n.viaName ? `via ${n.viaName}` : undefined, app: 'maps', priority: 4, data })
}

export function startNavigation(route: RouteResult, destName: string, destId: string, mode: Mode, viaName?: string) {
  stopTimers()
  const total = polyLen(route.pts)
  const a = pointAlong(route.pts, 0)
  useNavSim.setState({ active: true, arrived: false, route, destName, destId, viaName, mode, progress: 0, total, stepStarts: stepStartsFor(route), pos: a.p, heading: a.heading, step: 0 })
  pushActivity()
  const speed = (total / (route.minutes * 60)) * SIM // units per second
  let last = performance.now()
  timer = window.setInterval(() => {
    const now = performance.now()
    const dt = Math.min(1, (now - last) / 1000)
    last = now
    const n = useNavSim.getState()
    if (!n.active || !n.route) return
    const progress = Math.min(n.total, n.progress + speed * dt)
    const at = pointAlong(n.route.pts, progress)
    let step = 0
    n.stepStarts.forEach((s, i) => { if (progress >= s - 0.5) step = i })
    // smooth heading
    let dh = at.heading - n.heading
    while (dh > 180) dh -= 360
    while (dh < -180) dh += 360
    useNavSim.setState({ progress, pos: at.p, heading: n.heading + dh * 0.35, step })
    if (progress >= n.total - 0.5) arrive()
    else pushActivity()
  }, 250)
  // End from the Dynamic Island / Lock Screen stops the simulation too
  unsub = useOS.subscribe((s) => {
    if (useNavSim.getState().active && !s.activities.some((a) => a.id === 'nav')) endNavigation(false)
  })
}

function arrive() {
  const n = useNavSim.getState()
  stopTimers()
  useNavSim.setState({ active: false, arrived: true })
  const st = useOS.getState()
  st.endActivity('nav')
  st.flashIsland({ kind: 'generic', title: '📍 Arrived', subtitle: n.destName, duration: 2600, tint: '#30d158' })
}

function stopTimers() {
  window.clearInterval(timer)
  timer = undefined
  unsub?.()
  unsub = undefined
}

export function endNavigation(endActivity = true) {
  stopTimers()
  useNavSim.setState({ active: false, arrived: false })
  if (endActivity) useOS.getState().endActivity('nav')
}

export function dismissArrival() {
  useNavSim.setState({ arrived: false, route: null })
}
