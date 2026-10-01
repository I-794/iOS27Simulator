/* Voice Memos state + engines.
 *  - useMemos: persisted library ('ios27-voicememos').
 *  - useVM: runtime (recording / playback / UI) that outlives the app window, so a recording keeps
 *    going on the Home Screen with a Live Activity in the Dynamic Island.
 * Recording is SIMULATED (generated levels, no microphone). Playback synthesizes a soft murmur with
 * Web Audio that follows the waveform, respecting volume + silent mode, or just advances silently. */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useOS, uid } from '../../os/store'
import { summarize } from '../../os/ai/writing'
import { LEVELS_PER_SEC, currentLocation, demoMemos, memoLevels, simulatedTranscript, speechSource, type Memo } from './data'

export type Folder = 'all' | 'favorites' | 'deleted'

interface Library {
  memos: Memo[]
  showTranscript: boolean
  set: (p: Partial<Library>) => void
  update: (id: string, patch: Partial<Memo>) => void
  add: (m: Memo) => void
  remove: (ids: string[]) => void
}

export const useMemos = create<Library>()(
  persist(
    (set, get) => ({
      memos: demoMemos(),
      showTranscript: false,
      set: (p) => set(p),
      update: (id, patch) => set({ memos: get().memos.map((m) => (m.id === id ? { ...m, ...patch } : m)) }),
      add: (m) => set({ memos: [m, ...get().memos] }),
      remove: (ids) => set({ memos: get().memos.filter((m) => !ids.includes(m.id)) }),
    }),
    { name: 'ios27-voicememos', version: 1, partialize: (s) => ({ memos: s.memos, showTranscript: s.showTranscript }) },
  ),
)

export interface Recording {
  startedAt: number
  title: string
  location: string
  seed: number
}

interface Runtime {
  rec: Recording | null
  /** bumps ~20×/s while recording */
  recTick: number
  playId: string | null
  playing: boolean
  /** seconds */
  pos: number
  expanded: string | null
  editing: boolean
  selected: string[]
  folder: Folder | null
  /** incremented when a deep link asks the UI to show a folder/recording */
  routeTick: number
  routeFolder: Folder
  set: (p: Partial<Runtime>) => void
}

export const useVM = create<Runtime>((set) => ({
  rec: null,
  recTick: 0,
  playId: null,
  playing: false,
  pos: 0,
  expanded: null,
  editing: false,
  selected: [],
  folder: null,
  routeTick: 0,
  routeFolder: 'all',
  set: (p) => set(p),
}))

const REC_ACT = 'vm-rec'
const PLAY_ACT = 'vm-play'

// ------------------------------------------------------------------ recording
let recLevels: number[] = []
let recTimer: number | undefined
let recUnsub: (() => void) | undefined

/** Levels captured so far (mutable buffer; read on recTick). */
export const liveLevels = () => recLevels

export function nextTitle(location: string): string {
  const re = new RegExp(`^${location.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?: (\\d+))?$`)
  let n = 0
  for (const m of useMemos.getState().memos) {
    const hit = re.exec(m.title)
    if (hit) n = Math.max(n, hit[1] ? +hit[1] : 1)
  }
  return `${location} ${n + 1}`
}

export function startRecording() {
  if (useVM.getState().rec) return
  pause()
  const location = currentLocation()
  const rec: Recording = { startedAt: Date.now(), location, title: nextTitle(location), seed: (Date.now() % 100000) + 17 }
  recLevels = []
  const src = speechSource(rec.seed)
  const per = 1000 / LEVELS_PER_SEC
  let acc = 0
  let last = performance.now()
  recTimer = window.setInterval(() => {
    const now = performance.now()
    acc += now - last
    last = now
    while (acc >= per) {
      recLevels.push(src())
      acc -= per
    }
    useVM.setState((s) => ({ recTick: s.recTick + 1 }))
  }, 50)
  useVM.setState({ rec, expanded: null, editing: false, selected: [] })
  const os = useOS.getState()
  os.startActivity({ id: REC_ACT, kind: 'recording', title: rec.title, subtitle: 'Voice Memos', startedAt: rec.startedAt, app: 'voicememos', priority: 8, data: { mode: 'voicememo' } })
  // Stopping from the Dynamic Island ends the activity — treat that as "stop and save".
  recUnsub = useOS.subscribe((s) => {
    if (useVM.getState().rec && !s.activities.some((a) => a.id === REC_ACT)) stopRecording()
  })
}

/** Stop and save. Returns the new memo id (or null when nothing was recording). */
export function stopRecording(opts: { discard?: boolean } = {}): string | null {
  const rec = useVM.getState().rec
  if (!rec) return null
  window.clearInterval(recTimer)
  recUnsub?.()
  recUnsub = undefined
  useOS.getState().endActivity(REC_ACT)
  const duration = Math.max(1, Math.round((Date.now() - rec.startedAt) / 100) / 10)
  useVM.setState({ rec: null })
  if (opts.discard) return null
  const memo: Memo = {
    id: uid('vm'),
    title: rec.title,
    createdAt: rec.startedAt,
    duration,
    location: rec.location,
    seed: rec.seed,
    // the waveform regenerates from the same seed, so the saved memo matches what was shown live
    transcript: simulatedTranscript(rec.location, duration, rec.seed),
  }
  useMemos.getState().add(memo)
  useVM.setState({ expanded: memo.id, pos: 0, playId: null })
  return memo.id
}

// ------------------------------------------------------------------ playback audio
let ac: AudioContext | null = null
let out: GainNode | null = null
let env: GainNode | null = null
let osc: OscillatorNode | null = null
let noise: AudioBufferSourceNode | null = null
let band: BiquadFilterNode | null = null
let volUnsub: (() => void) | undefined

function outputGain() {
  const s = useOS.getState()
  return s.silent ? 0 : Math.max(0, Math.min(1, s.volume)) * 0.32
}

function startSound() {
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AC) return
    if (!ac) ac = new AC()
    void ac.resume()
    const c = ac
    out = c.createGain()
    out.gain.value = outputGain()
    out.connect(c.destination)
    env = c.createGain()
    env.gain.value = 0
    env.connect(out)
    // breathy noise through a moving band-pass + a soft voiced hum = a muffled "voice"
    const buf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * 0.6
    noise = c.createBufferSource()
    noise.buffer = buf
    noise.loop = true
    band = c.createBiquadFilter()
    band.type = 'bandpass'
    band.frequency.value = 900
    band.Q.value = 0.9
    noise.connect(band).connect(env)
    osc = c.createOscillator()
    osc.type = 'triangle'
    osc.frequency.value = 160
    const lp = c.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 1400
    const og = c.createGain()
    og.gain.value = 0.35
    osc.connect(og).connect(lp).connect(env)
    noise.start()
    osc.start()
    volUnsub = useOS.subscribe((s, p) => {
      if ((s.volume !== p.volume || s.silent !== p.silent) && out && ac) out.gain.setTargetAtTime(outputGain(), ac.currentTime, 0.05)
    })
  } catch {
    stopSound()
  }
}

function stopSound() {
  volUnsub?.()
  volUnsub = undefined
  try {
    const t = ac?.currentTime ?? 0
    env?.gain.setTargetAtTime(0, t, 0.02)
    osc?.stop(t + 0.1)
    noise?.stop(t + 0.1)
  } catch { /* already stopped */ }
  const o = out
  window.setTimeout(() => o?.disconnect(), 200)
  osc = noise = null
  env = out = band = null
}

function shapeSound(level: number, pos: number) {
  if (!ac || !env || !osc || !band) return
  const t = ac.currentTime
  env.gain.setTargetAtTime(level * 0.9, t, 0.035)
  osc.frequency.setTargetAtTime(140 + level * 70 + Math.sin(pos * 5.3) * 12, t, 0.05)
  band.frequency.setTargetAtTime(600 + level * 1100 + Math.sin(pos * 3.1) * 200, t, 0.05)
}

// ------------------------------------------------------------------ playback
let playTimer: number | undefined
let playUnsub: (() => void) | undefined
let base = { pos: 0, at: 0 }

const memoById = (id: string | null) => (id ? useMemos.getState().memos.find((m) => m.id === id) : undefined)

export function play(id: string) {
  const vm = useVM.getState()
  if (vm.rec) return
  const memo = memoById(id)
  if (!memo) return
  if (vm.playing && vm.playId === id) return
  stopTimers()
  let pos = vm.playId === id ? vm.pos : 0
  if (pos >= memo.duration - 0.05) pos = 0
  base = { pos, at: performance.now() }
  useVM.setState({ playId: id, playing: true, pos })
  startSound()
  const levels = memoLevels(memo)
  playTimer = window.setInterval(() => {
    const p = base.pos + (performance.now() - base.at) / 1000
    if (p >= memo.duration) {
      useVM.setState({ pos: memo.duration })
      pause()
      return
    }
    shapeSound(levels[Math.min(levels.length - 1, Math.floor(p * LEVELS_PER_SEC))] ?? 0, p)
    useVM.setState({ pos: p })
  }, 50)
  const os = useOS.getState()
  os.startActivity({ id: PLAY_ACT, kind: 'recording', title: memo.title, subtitle: 'Voice Memos', startedAt: Date.now() - pos * 1000, app: 'voicememos', priority: 6, data: { mode: 'playback' } })
  playUnsub = useOS.subscribe((s) => {
    if (useVM.getState().playing && !s.activities.some((a) => a.id === PLAY_ACT)) pause()
  })
}

function stopTimers() {
  window.clearInterval(playTimer)
  playTimer = undefined
  playUnsub?.()
  playUnsub = undefined
  stopSound()
}

export function pause() {
  const vm = useVM.getState()
  if (!vm.playing) return
  stopTimers()
  const memo = memoById(vm.playId)
  const p = Math.min(memo?.duration ?? 0, base.pos + (performance.now() - base.at) / 1000)
  useVM.setState({ playing: false, pos: p })
  useOS.getState().endActivity(PLAY_ACT)
}

export function toggle(id: string) {
  const vm = useVM.getState()
  if (vm.playing && vm.playId === id) pause()
  else play(id)
}

export function seek(id: string, pos: number) {
  const memo = memoById(id)
  if (!memo) return
  const p = Math.max(0, Math.min(memo.duration, pos))
  const vm = useVM.getState()
  if (vm.playId !== id && vm.playing) pause()
  base = { pos: p, at: performance.now() }
  useVM.setState({ playId: id, pos: p })
  if (vm.playing && vm.playId === id) useOS.getState().updateActivity(PLAY_ACT, { startedAt: Date.now() - p * 1000 })
}

export function skip(id: string, by: number) {
  const vm = useVM.getState()
  const cur = vm.playId === id ? (vm.playing ? base.pos + (performance.now() - base.at) / 1000 : vm.pos) : 0
  seek(id, cur + by)
}

/** Stop everything (app force-quit). A recording in progress is saved. */
export function shutdown() {
  pause()
  stopRecording()
}

// Force-quitting Voice Memos from the App Switcher ends playback and saves any recording.
useOS.subscribe((s, p) => {
  if (p.recents.includes('voicememos') && !s.recents.includes('voicememos')) shutdown()
})

// ------------------------------------------------------------------ library actions
export function trash(ids: string[]) {
  const vm = useVM.getState()
  if (vm.playId && ids.includes(vm.playId)) {
    pause()
    useVM.setState({ playId: null, pos: 0 })
  }
  const now = Date.now()
  useMemos.setState((s) => ({ memos: s.memos.map((m) => (ids.includes(m.id) ? { ...m, deletedAt: now } : m)) }))
  if (vm.expanded && ids.includes(vm.expanded)) useVM.setState({ expanded: null })
}

export function recover(ids: string[]) {
  useMemos.setState((s) => ({ memos: s.memos.map((m) => (ids.includes(m.id) ? { ...m, deletedAt: undefined } : m)) }))
}

export function duplicate(id: string) {
  const m = memoById(id)
  if (!m) return
  useMemos.getState().add({ ...m, id: uid('vm'), title: `${m.title} copy`, createdAt: Date.now(), favorite: false, summary: undefined })
}

export function summaryFor(m: Memo): string {
  const s = summarize(m.transcript).trim()
  return s || 'This recording is too short to summarize.'
}
