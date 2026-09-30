/* Active phone call state. Module-level so a call survives leaving (and unmounting) the Phone app. */
import { create } from 'zustand'
import { useOS } from '../../os/store'
import { contactById } from '../../os/data/people'
import { playAlert } from '../../os/audio'
import { usePhoneLocal } from './phoneStore'
import { callName, fmtPhone, contactForNumber } from '../contacts/shared'

export type AudioRoute = 'iPhone' | 'Speaker' | 'AirPods Pro'

export interface PhoneCall {
  contactId?: string
  number: string
  name: string
  phase: 'dialing' | 'active' | 'ended'
  startedAt?: number
  muted: boolean
  route: AudioRoute
  keypad: boolean
  dtmf: string
  held: boolean
  merged?: string
  minimized: boolean
  activityId?: string
}

interface CallState {
  call: PhoneCall | null
  set: (p: Partial<PhoneCall>) => void
}

export const useCall = create<CallState>((set, get) => ({
  call: null,
  set: (p) => {
    const c = get().call
    if (c) set({ call: { ...c, ...p } })
  },
}))

const S = () => useOS.getState()
let dialTimer: number | undefined

export function startCall(opts: { contactId?: string; number?: string }) {
  const cur = useCall.getState().call
  if (cur && cur.phase !== 'ended') endCall(true)
  const c = opts.contactId ? contactById(opts.contactId) : opts.number ? contactForNumber(opts.number) : undefined
  const number = opts.number ?? c?.phones[0] ?? ''
  const name = c ? callName(c.id) : fmtPhone(number)
  useCall.setState({ call: { contactId: c?.id, number, name, phase: 'dialing', muted: false, route: 'iPhone', keypad: false, dtmf: '', held: false, minimized: false } })
  window.clearTimeout(dialTimer)
  dialTimer = window.setTimeout(() => {
    const call = useCall.getState().call
    if (!call || call.phase !== 'dialing') return
    const startedAt = Date.now()
    const activityId = S().startActivity({ id: 'phone-call', kind: 'call', title: name, subtitle: 'Mobile', startedAt, app: 'phone', priority: 3 })
    useCall.getState().set({ phase: 'active', startedAt, activityId })
    playAlert('tapback', S().silent ? 0 : S().volume * 0.4)
  }, c?.isBusiness ? 1500 : 2200)
}

export function endCall(silent = false) {
  const call = useCall.getState().call
  if (!call) return
  window.clearTimeout(dialTimer)
  const duration = call.startedAt ? Math.round((Date.now() - call.startedAt) / 1000) : 0
  if (silent) useCall.setState({ call: null })
  else useCall.getState().set({ phase: 'ended', activityId: undefined, keypad: false })
  if (call.activityId) S().endActivity(call.activityId)
  usePhoneLocal.getState().addRecent({ contactId: call.contactId, number: call.number, ts: Date.now(), dir: 'outgoing', type: 'mobile', duration })
  if (silent) return
  window.setTimeout(() => {
    if (useCall.getState().call?.phase === 'ended') useCall.setState({ call: null })
  }, 1100)
}

// Ending the call from the Dynamic Island / Lock Screen removes the Live Activity → hang up here too.
useOS.subscribe((s, p) => {
  if (s.activities === p.activities) return
  const call = useCall.getState().call
  if (call?.phase === 'active' && call.activityId && !s.activities.some((a) => a.id === call.activityId)) {
    useCall.getState().set({ activityId: undefined })
    endCall()
  }
})
