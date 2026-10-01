/* Precision Finding simulation. Module-level so the 'findmy' Live Activity keeps counting down
   in the Dynamic Island after you leave the app. */
import { create } from 'zustand'
import { useOS } from '../../os/store'

export interface PrecisionState {
  active: boolean
  arrived: boolean
  id: string
  name: string
  kind: 'person' | 'item'
  avatar?: string
  emoji?: string
  dist: number // feet
  bearing: number // degrees, 0 = straight ahead
  paused: boolean
}

export const usePrecision = create<PrecisionState>(() => ({ active: false, arrived: false, id: '', name: '', kind: 'person', dist: 0, bearing: 0, paused: false }))

let timer: number | undefined
let unsub: (() => void) | undefined

export const fmtFt = (ft: number) => (ft >= 1000 ? `${(ft / 5280).toFixed(1)} mi` : `${Math.max(1, Math.round(ft))} ft`)
export function hintFor(dist: number, bearing: number) {
  if (dist <= 8) return 'nearby'
  if (Math.abs(bearing) < 18) return 'ahead'
  if (Math.abs(bearing) > 140) return 'behind you'
  return bearing > 0 ? 'to your right' : 'to your left'
}

const actId = () => `findmy-${usePrecision.getState().id}`

function push() {
  const s = usePrecision.getState()
  const st = useOS.getState()
  const data = { distance: fmtFt(s.dist), bearing: Math.round(s.bearing), hint: hintFor(s.dist, s.bearing) }
  if (st.activities.some((a) => a.id === actId())) st.updateActivity(actId(), { data })
  else st.startActivity({ id: actId(), kind: 'findmy', title: s.name, app: 'findmy', priority: 5, data })
}

export function startPrecision(p: { id: string; name: string; kind: 'person' | 'item'; avatar?: string; emoji?: string; startFt: number }) {
  stopPrecision(false)
  usePrecision.setState({ active: true, arrived: false, id: p.id, name: p.name, kind: p.kind, avatar: p.avatar, emoji: p.emoji, dist: p.startFt, bearing: 64, paused: false })
  push()
  let tick = 0
  timer = window.setInterval(() => {
    const s = usePrecision.getState()
    if (!s.active || s.paused) return
    tick++
    // "walking": faster when far, slows near the target; bearing converges with a natural wobble
    const step = Math.max(1.2, s.dist * 0.07) * (0.8 + Math.random() * 0.4)
    const dist = Math.max(0, s.dist - step)
    const wobble = Math.sin(tick / 2.3) * Math.min(28, s.dist / 6)
    const bearing = s.bearing * 0.82 + wobble * 0.5
    usePrecision.setState({ dist, bearing })
    if (dist <= 2.5) arrive()
    else push()
  }, 600)
  unsub = useOS.subscribe((st) => {
    const s = usePrecision.getState()
    if (s.active && !st.activities.some((a) => a.id === actId())) stopPrecision(false)
  })
}

function arrive() {
  const s = usePrecision.getState()
  window.clearInterval(timer)
  unsub?.()
  unsub = undefined
  usePrecision.setState({ active: false, arrived: true, dist: 0, bearing: 0 })
  const st = useOS.getState()
  st.endActivity(`findmy-${s.id}`)
  st.flashIsland({ kind: 'generic', title: '📍 You’re here', subtitle: s.name, duration: 2600, tint: '#30d158' })
}

export function stopPrecision(endActivity = true) {
  window.clearInterval(timer)
  timer = undefined
  unsub?.()
  unsub = undefined
  const s = usePrecision.getState()
  if (endActivity && s.id) useOS.getState().endActivity(`findmy-${s.id}`)
  usePrecision.setState({ active: false, arrived: false })
}

export const togglePause = () => usePrecision.setState({ paused: !usePrecision.getState().paused })
