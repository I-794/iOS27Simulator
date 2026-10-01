/* FaceTime call state (module-level so the call survives leaving the app) + persisted recents. */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useOS } from '../../os/store'
import { contactById } from '../../os/data/people'
import { playAlert } from '../../os/audio'
import { at, HOUR, MIN } from '../../os/time'
import { callName } from '../contacts/shared'

export type Quality = 'Excellent' | 'Fair' | 'Poor' | 'Lost'
export type DualMode = 'off' | 'split' | 'pip'

export interface FTCall {
  contactId: string
  audio: boolean
  phase: 'outgoing' | 'incoming' | 'active' | 'ended'
  startedAt?: number
  muted: boolean
  camOff: boolean
  front: boolean
  dual: DualMode
  speaker: boolean
  quality: Quality
  reconnecting: boolean
  audioFallback: boolean
  shareplay: null | 'music' | 'screen' | 'tv'
  minimized: boolean
  activityId?: string
  controls: boolean
}

export interface FTRecent { id: string; contactId: string; ts: number; audio: boolean; dir: 'outgoing' | 'incoming' | 'missed'; duration: number }

const now = Date.now()
const SEED: FTRecent[] = [
  { id: 'ft1', contactId: 'alex', ts: at(-1, 20, 40), audio: false, dir: 'outgoing', duration: 1260 },
  { id: 'ft2', contactId: 'mom', ts: now - 5 * HOUR, audio: false, dir: 'missed', duration: 0 },
  { id: 'ft3', contactId: 'mia', ts: at(-4, 16, 0), audio: true, dir: 'incoming', duration: 48 },
  { id: 'ft4', contactId: 'grandma', ts: at(-5, 18, 30), audio: false, dir: 'incoming', duration: 1830 },
  { id: 'ft5', contactId: 'priya', ts: at(-6, 21, 5), audio: false, dir: 'outgoing', duration: 640 },
  { id: 'ft6', contactId: 'sam', ts: now - 26 * HOUR - 12 * MIN, audio: true, dir: 'outgoing', duration: 95 },
]

export const useFTRecents = create<{ recents: FTRecent[]; set: (r: FTRecent[]) => void }>()(
  persist((set) => ({ recents: SEED, set: (recents) => set({ recents }) }), { name: 'ios27-facetime', partialize: (s) => ({ recents: s.recents }) }),
)

export const useFT = create<{ call: FTCall | null; patch: (p: Partial<FTCall>) => void }>((set, get) => ({
  call: null,
  patch: (p) => {
    const c = get().call
    if (c) set({ call: { ...c, ...p } })
  },
}))

const S = () => useOS.getState()
let timers: number[] = []
const later = (ms: number, fn: () => void) => timers.push(window.setTimeout(fn, ms))
const clearTimers = () => {
  timers.forEach((t) => window.clearTimeout(t))
  timers = []
}

function base(contactId: string, audio: boolean, phase: FTCall['phase']): FTCall {
  return { contactId, audio, phase, muted: false, camOff: false, front: true, dual: 'off', speaker: !audio, quality: 'Excellent', reconnecting: false, audioFallback: false, shareplay: null, minimized: false, controls: true }
}

function connect() {
  const call = useFT.getState().call
  if (!call) return
  const startedAt = Date.now()
  const c = contactById(call.contactId)
  const activityId = S().startActivity({ id: 'facetime-call', kind: 'facetime', title: c ? callName(c.id) : call.contactId, subtitle: call.audio ? 'FaceTime Audio' : 'FaceTime Video', startedAt, app: 'facetime', priority: 3 })
  useFT.getState().patch({ phase: 'active', startedAt, activityId })
}

export function startFT(contactId: string, audio = false) {
  if (useFT.getState().call) endFT(true)
  clearTimers()
  useFT.setState({ call: base(contactId, audio, 'outgoing') })
  later(2400, () => useFT.getState().call?.phase === 'outgoing' && connect())
}

export function incomingFT(contactId: string, audio = false) {
  if (useFT.getState().call) return
  clearTimers()
  useFT.setState({ call: base(contactId, audio, 'incoming') })
  const st = S()
  playAlert('ringtone', st.silent ? 0 : st.ringerVolume)
  // stop ringing after a while → missed call
  later(25_000, () => {
    if (useFT.getState().call?.phase === 'incoming') {
      addRecent(contactId, audio, 'missed', 0)
      useFT.setState({ call: null })
    }
  })
}

export function acceptFT() {
  clearTimers()
  connect()
}

export function declineFT() {
  const call = useFT.getState().call
  if (!call) return
  clearTimers()
  addRecent(call.contactId, call.audio, 'missed', 0)
  useFT.setState({ call: null })
}

function addRecent(contactId: string, audio: boolean, dir: FTRecent['dir'], duration: number) {
  const r = useFTRecents.getState()
  r.set([{ id: `ft-${Date.now().toString(36)}`, contactId, ts: Date.now(), audio, dir, duration }, ...r.recents].slice(0, 50))
}

export function endFT(silent = false) {
  const call = useFT.getState().call
  if (!call) return
  clearTimers()
  const duration = call.startedAt ? Math.round((Date.now() - call.startedAt) / 1000) : 0
  if (silent) useFT.setState({ call: null })
  else useFT.getState().patch({ phase: 'ended', activityId: undefined })
  if (call.activityId) S().endActivity(call.activityId)
  addRecent(call.contactId, call.audio, 'outgoing', duration)
  if (!silent) window.setTimeout(() => useFT.getState().call?.phase === 'ended' && useFT.setState({ call: null }), 1000)
}

/** Network-quality simulator: iOS 27 adapts resolution, falls back to audio, and reconnects on its own. */
export function setQuality(q: Quality) {
  const p = useFT.getState().patch
  clearTimers()
  if (q === 'Lost') {
    p({ quality: 'Lost', reconnecting: true })
    later(4200, () => {
      p({ quality: 'Fair', reconnecting: false, audioFallback: false })
      S().showToast('Reconnected', '📶')
      later(3500, () => useFT.getState().call?.quality === 'Fair' && p({ quality: 'Excellent' }))
    })
  } else if (q === 'Poor') {
    p({ quality: 'Poor', reconnecting: false })
    later(1600, () => useFT.getState().call?.quality === 'Poor' && p({ audioFallback: true }))
  } else {
    p({ quality: q, reconnecting: false, audioFallback: false })
  }
}

// Hang up from the Dynamic Island / Lock Screen.
useOS.subscribe((s, p) => {
  if (s.activities === p.activities) return
  const call = useFT.getState().call
  if (call?.phase === 'active' && call.activityId && !s.activities.some((a) => a.id === call.activityId)) {
    useFT.getState().patch({ activityId: undefined })
    endFT()
  }
})
