/* AutoMix transition tracking (UI side). The audio crossfade itself happens in
 * shell/services.ts; here we observe the store so we can visualize the beat
 * matching while it happens. */
import { create } from 'zustand'
import { useOS, playbackPosition } from '../../os/store'
import { TRACKS } from '../../os/data/media'

export interface Transition {
  from: string
  to: string
  start: number
  len: number
}

interface MixState {
  transition: Transition | null
  history: Transition[]
  startedAt: number
  startLatency: number
}

export const useMix = create<MixState>(() => ({ transition: null, history: [], startedAt: 0, startLatency: 0.14 }))

let wired = false
export function wireAutoMix() {
  if (wired) return
  wired = true
  let prev = useOS.getState().nowPlaying
  let prevPosAt = { pos: playbackPosition(prev), t: Date.now() }
  window.setInterval(() => {
    const np = useOS.getState().nowPlaying
    prevPosAt = { pos: playbackPosition(np), t: Date.now() }
  }, 250)
  useOS.subscribe((s) => {
    const np = s.nowPlaying
    if (np === prev) return
    const was = prev
    prev = np
    if (np.kind !== 'music') return
    if (np.playing && (!was.playing || was.trackId !== np.trackId)) {
      // "instant start": the UI switches the same frame; the engine reports ready ~120-200 ms later
      useMix.setState({ startedAt: Date.now(), startLatency: +(0.11 + Math.random() * 0.09).toFixed(2) })
    }
    if (was.trackId !== np.trackId && np.position === 0 && s.automix && was.kind === 'music') {
      const tr = TRACKS.find((t) => t.id === was.trackId)
      const lastPos = prevPosAt.pos + (Date.now() - prevPosAt.t) / 1000
      if (tr && was.playing && lastPos >= tr.duration - s.crossfade - 1.5) {
        const t: Transition = { from: was.trackId, to: np.trackId, start: Date.now(), len: s.crossfade }
        useMix.setState((m) => ({ transition: t, history: [t, ...m.history].slice(0, 8) }))
        window.setTimeout(() => {
          if (useMix.getState().transition === t) useMix.setState({ transition: null })
        }, t.len * 1000 + 600)
      }
    }
  })
}

/** Stable pseudo-random waveform for a track (0..1 amplitudes). */
export function waveform(trackId: string, n: number): number[] {
  let seed = [...trackId].reduce((a, c) => a * 31 + c.charCodeAt(0), 7) >>> 0
  const rnd = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0
    return seed / 4294967296
  }
  const out: number[] = []
  for (let i = 0; i < n; i++) {
    const beat = i % 4 === 0 ? 0.35 : 0
    out.push(Math.min(1, 0.25 + rnd() * 0.45 + beat))
  }
  return out
}

export const KEY_WHEEL: Record<string, string> = { C: '8B', G: '9B', D: '10B', A: '11B', E: '12B', B: '1B', 'F#': '2B', Db: '3B', Ab: '4B', Eb: '5B', Bb: '6B', F: '7B' }
