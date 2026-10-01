/* Audio engine: procedurally synthesized music (so Custom EQ and AutoMix are
 * audible without shipping audio files), plus system alert sounds that respect
 * the independent ringer vs. alarm/timer volumes introduced in iOS 27. */
import { TRACKS } from './data/media'
import type { Track } from './types'

const NOTE: Record<string, number> = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 }
const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12)

let ctx: AudioContext | null = null
let master: GainNode
let eqLow: BiquadFilterNode
let eqMid: BiquadFilterNode
let eqHigh: BiquadFilterNode
let analyser: AnalyserNode
let noiseBuf: AudioBuffer

function ensure(): AudioContext | null {
  if (ctx) return ctx
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AC) return null
  ctx = new AC()
  master = ctx.createGain()
  master.gain.value = 0.5
  eqLow = ctx.createBiquadFilter()
  eqLow.type = 'lowshelf'
  eqLow.frequency.value = 220
  eqMid = ctx.createBiquadFilter()
  eqMid.type = 'peaking'
  eqMid.frequency.value = 1400
  eqMid.Q.value = 0.9
  eqHigh = ctx.createBiquadFilter()
  eqHigh.type = 'highshelf'
  eqHigh.frequency.value = 4800
  analyser = ctx.createAnalyser()
  analyser.fftSize = 256
  eqLow.connect(eqMid).connect(eqHigh).connect(master).connect(analyser).connect(ctx.destination)
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate)
  const d = noiseBuf.getChannelData(0)
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  return ctx
}

export function audioAnalyser(): AnalyserNode | null {
  return ctx ? analyser : null
}

export function setMasterVolume(v: number) {
  if (!ctx) return
  master.gain.setTargetAtTime(Math.max(0, Math.min(1, v)) * 0.55, ctx.currentTime, 0.05)
}

export function setEQ(low: number, mid: number, high: number, enabled = true) {
  if (!ctx) return
  const t = ctx.currentTime
  eqLow.gain.setTargetAtTime(enabled ? low : 0, t, 0.05)
  eqMid.gain.setTargetAtTime(enabled ? mid : 0, t, 0.05)
  eqHigh.gain.setTargetAtTime(enabled ? high : 0, t, 0.05)
}

// ------------------------------------------------------------ track player
class Player {
  out: GainNode
  track: Track
  private timer: number | undefined
  private nextTime = 0
  private step = 0
  private root: number
  private spb: number
  private stopped = false

  constructor(track: Track, offsetSec: number, gain = 1) {
    const c = ctx!
    this.track = track
    this.out = c.createGain()
    this.out.gain.value = gain
    this.out.connect(eqLow)
    this.root = 48 + (NOTE[track.key] ?? 0)
    this.spb = 60 / track.bpm / 2 // eighth notes
    this.step = Math.floor(offsetSec / this.spb) % 64
    this.nextTime = c.currentTime + 0.06
    this.timer = window.setInterval(() => this.schedule(), 40)
    this.schedule()
  }

  private schedule() {
    const c = ctx!
    while (!this.stopped && this.nextTime < c.currentTime + 0.18) {
      this.tick(this.step, this.nextTime)
      this.step++
      this.nextTime += this.spb
    }
  }

  private tick(s: number, t: number) {
    const prog = [0, 7, 9, 5] // I V vi IV
    const bar = Math.floor(s / 8) % 4
    const chordRoot = this.root + prog[bar]
    const minor = prog[bar] === 9
    const third = minor ? 3 : 4
    const beat = s % 8
    const energy = this.track.bpm > 110 ? 1 : 0.7
    // pad on bar start
    if (beat === 0) {
      for (const iv of [0, third, 7, 12]) this.pad(midi(chordRoot + 12 + iv), t, this.spb * 8, 0.035)
    }
    // bass on beats
    if (beat % 2 === 0) this.bass(midi(chordRoot - 12 + (beat === 6 ? 7 : 0)), t, this.spb * 1.8, 0.16)
    // arpeggio
    const arp = [0, third, 7, 12, 7, third, 0, 12][beat]
    this.pluck(midi(chordRoot + 24 + arp), t, this.spb * 0.9, 0.05 * energy)
    // drums
    if (beat === 0 || beat === 4 || (energy === 1 && beat === 6)) this.kick(t, 0.5)
    if (beat === 2 || beat === 6) this.snare(t, 0.12 * energy)
    this.hat(t, beat % 2 ? 0.03 : 0.045)
  }

  private env(g: GainNode, t: number, dur: number, peak: number, a = 0.01) {
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(peak, t + a)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  }

  private pad(f: number, t: number, dur: number, vol: number) {
    const c = ctx!
    const g = c.createGain()
    const lp = c.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 1400
    for (const det of [-7, 7]) {
      const o = c.createOscillator()
      o.type = 'sawtooth'
      o.frequency.value = f
      o.detune.value = det
      o.connect(lp)
      o.start(t)
      o.stop(t + dur + 0.1)
    }
    lp.connect(g).connect(this.out)
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(vol, t + dur * 0.25)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  }

  private bass(f: number, t: number, dur: number, vol: number) {
    const c = ctx!
    const o = c.createOscillator()
    o.type = 'triangle'
    o.frequency.value = f
    const g = c.createGain()
    o.connect(g).connect(this.out)
    this.env(g, t, dur, vol)
    o.start(t)
    o.stop(t + dur + 0.05)
  }

  private pluck(f: number, t: number, dur: number, vol: number) {
    const c = ctx!
    const o = c.createOscillator()
    o.type = 'triangle'
    o.frequency.value = f
    const g = c.createGain()
    o.connect(g).connect(this.out)
    this.env(g, t, dur, vol, 0.004)
    o.start(t)
    o.stop(t + dur + 0.05)
  }

  private kick(t: number, vol: number) {
    const c = ctx!
    const o = c.createOscillator()
    o.frequency.setValueAtTime(140, t)
    o.frequency.exponentialRampToValueAtTime(40, t + 0.12)
    const g = c.createGain()
    o.connect(g).connect(this.out)
    this.env(g, t, 0.22, vol, 0.003)
    o.start(t)
    o.stop(t + 0.25)
  }

  private noise(t: number, dur: number, vol: number, hp: number) {
    const c = ctx!
    const src = c.createBufferSource()
    src.buffer = noiseBuf
    const f = c.createBiquadFilter()
    f.type = 'highpass'
    f.frequency.value = hp
    const g = c.createGain()
    src.connect(f).connect(g).connect(this.out)
    this.env(g, t, dur, vol, 0.002)
    src.start(t, Math.random() * 0.5)
    src.stop(t + dur + 0.02)
  }

  private snare(t: number, vol: number) {
    this.noise(t, 0.14, vol, 1800)
  }

  private hat(t: number, vol: number) {
    this.noise(t, 0.04, vol, 7000)
  }

  fade(to: number, seconds: number) {
    const c = ctx!
    this.out.gain.cancelScheduledValues(c.currentTime)
    this.out.gain.setValueAtTime(this.out.gain.value, c.currentTime)
    this.out.gain.linearRampToValueAtTime(to, c.currentTime + seconds)
  }

  stop(after = 0) {
    window.setTimeout(() => {
      this.stopped = true
      window.clearInterval(this.timer)
      try {
        this.out.disconnect()
      } catch {
        /* ignore */
      }
    }, after * 1000 + 300)
  }
}

let current: Player | null = null

export const music = {
  play(trackId: string, offset = 0) {
    const c = ensure()
    if (!c) return
    void c.resume()
    const track = TRACKS.find((t) => t.id === trackId)
    if (!track) return
    if (current && current.track.id === trackId) return
    current?.stop()
    current = new Player(track, offset)
  },
  /** AutoMix: overlap the next track, match levels and fade smoothly instead of cutting. */
  crossfade(trackId: string, seconds: number) {
    const c = ensure()
    if (!c) return
    const track = TRACKS.find((t) => t.id === trackId)
    if (!track) return
    const old = current
    current = new Player(track, 0, 0.0001)
    current.fade(1, seconds)
    if (old) {
      old.fade(0.0001, seconds)
      old.stop(seconds)
    }
  },
  pause() {
    current?.fade(0.0001, 0.12)
    current?.stop(0.15)
    current = null
  },
  restart(trackId: string, offset: number) {
    current?.stop()
    current = null
    this.play(trackId, offset)
  },
  get playingId() {
    return current?.track.id ?? null
  },
}

// ------------------------------------------------------------ alert sounds
export type AlertKind = 'timer' | 'alarm' | 'ringtone' | 'notification' | 'sent' | 'received' | 'shutter' | 'lock' | 'tapback'

export function playAlert(kind: AlertKind, volume: number) {
  const c = ensure()
  if (!c || volume <= 0) return
  void c.resume()
  const out = c.createGain()
  out.gain.value = Math.min(1, volume) * 0.35
  out.connect(c.destination)
  const tone = (f: number, t: number, dur: number, type: OscillatorType = 'sine', v = 1) => {
    const o = c.createOscillator()
    o.type = type
    o.frequency.value = f
    const g = c.createGain()
    o.connect(g).connect(out)
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(v, t + 0.01)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    o.start(t)
    o.stop(t + dur + 0.05)
  }
  const t = c.currentTime + 0.02
  switch (kind) {
    case 'timer':
    case 'alarm':
      for (let r = 0; r < (kind === 'alarm' ? 4 : 3); r++) [1046, 1318, 1568].forEach((f, i) => tone(f, t + r * 0.6 + i * 0.1, 0.35, 'sine', 0.8))
      break
    case 'ringtone':
      for (let r = 0; r < 2; r++) [659, 784, 988, 784].forEach((f, i) => tone(f, t + r * 0.9 + i * 0.14, 0.2, 'triangle', 0.7))
      break
    case 'notification':
      ;[1175, 1480].forEach((f, i) => tone(f, t + i * 0.09, 0.28, 'sine', 0.5))
      break
    case 'sent':
      tone(880, t, 0.08, 'sine', 0.3)
      tone(1320, t + 0.05, 0.14, 'sine', 0.3)
      break
    case 'received':
      tone(1320, t, 0.1, 'sine', 0.35)
      tone(990, t + 0.08, 0.16, 'sine', 0.35)
      break
    case 'tapback':
      tone(1568, t, 0.06, 'sine', 0.25)
      break
    case 'shutter': {
      const src = c.createBufferSource()
      src.buffer = noiseBuf
      const g = c.createGain()
      src.connect(g).connect(out)
      g.gain.setValueAtTime(0.6, t)
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09)
      src.start(t)
      src.stop(t + 0.1)
      break
    }
    case 'lock':
      tone(180, t, 0.05, 'square', 0.15)
      break
  }
}

/** Resume the audio context from a user gesture (browsers require this). */
export function unlockAudio() {
  const c = ensure()
  void c?.resume()
}
