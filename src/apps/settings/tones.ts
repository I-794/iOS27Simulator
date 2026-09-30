/* Tiny WebAudio previews for the ringtone / text-tone pickers (distinct melodies per tone).
 * Short, user-initiated, and scaled by the ringer volume so the picker is audible. */

let ctx: AudioContext | null = null
function ac(): AudioContext | null {
  if (typeof window === 'undefined') return null
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctor) return null
  ctx ??= new Ctor()
  void ctx.resume()
  return ctx
}

const MELODIES: Record<string, { notes: number[]; step: number; type: OscillatorType; dur: number }> = {
  Reflection: { notes: [659, 784, 988, 784, 659, 988], step: 0.16, type: 'triangle', dur: 0.22 },
  Opening: { notes: [523, 659, 784, 1046], step: 0.14, type: 'sine', dur: 0.3 },
  Radar: { notes: [1318, 1318, 1318, 1318, 1318, 1318], step: 0.1, type: 'square', dur: 0.06 },
  Chimes: { notes: [1046, 880, 784, 659], step: 0.22, type: 'sine', dur: 0.5 },
  'Slow Rise': { notes: [392, 440, 494, 523, 587], step: 0.24, type: 'triangle', dur: 0.3 },
  Marimba: { notes: [784, 988, 784, 659, 523], step: 0.13, type: 'sine', dur: 0.15 },
  Note: { notes: [1175, 1480], step: 0.09, type: 'sine', dur: 0.28 },
  'Tri-tone': { notes: [1318, 988, 1568], step: 0.12, type: 'sine', dur: 0.18 },
  Chord: { notes: [659, 830, 988], step: 0.02, type: 'sine', dur: 0.6 },
  Bamboo: { notes: [1568, 1175], step: 0.08, type: 'triangle', dur: 0.14 },
  Popcorn: { notes: [1760, 2093, 1760], step: 0.06, type: 'square', dur: 0.04 },
}

export const RINGTONES = ['Reflection', 'Opening', 'Radar', 'Chimes', 'Slow Rise', 'Marimba']
export const TEXT_TONES = ['Note', 'Tri-tone', 'Chord', 'Bamboo', 'Popcorn']

export function previewTone(name: string, volume: number) {
  const c = ac()
  const m = MELODIES[name]
  if (!c || !m || volume <= 0) return
  const out = c.createGain()
  out.gain.value = Math.min(1, volume) * 0.3
  out.connect(c.destination)
  const t0 = c.currentTime + 0.02
  m.notes.forEach((f, i) => {
    const o = c.createOscillator()
    const g = c.createGain()
    o.type = m.type
    o.frequency.value = f
    o.connect(g).connect(out)
    const t = t0 + i * m.step
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(m.type === 'square' ? 0.25 : 0.8, t + 0.01)
    g.gain.exponentialRampToValueAtTime(0.0001, t + m.dur)
    o.start(t)
    o.stop(t + m.dur + 0.05)
  })
}
