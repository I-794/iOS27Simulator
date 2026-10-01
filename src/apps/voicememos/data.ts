/* Voice Memos demo data: fictional recordings for Jamie (Lincoln High junior, robotics + drumline),
 * deterministic waveforms and Apple Intelligence-style transcripts. Nothing here touches a microphone. */
import { at, DAY } from '../../os/time'

export interface Memo {
  id: string
  title: string
  createdAt: number
  /** seconds */
  duration: number
  location: string
  favorite?: boolean
  /** set when moved to Recently Deleted */
  deletedAt?: number
  /** seed for the generated waveform (demo + new recordings) */
  seed: number
  /** captured levels (0..1, 10 per second) for recordings made in the simulator */
  levels?: number[]
  transcript: string
  summary?: string
}

export const LEVELS_PER_SEC = 10

/** Small deterministic PRNG. */
export function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Speech-like level generator: syllable bursts grouped into phrases with short pauses. */
export function speechSource(seed: number) {
  const r = rng(seed)
  let phraseLeft = 1 + r() * 3
  let pauseLeft = 0
  let t = 0
  let prev = 0.1
  let gain = 0.8
  return (dt = 1 / LEVELS_PER_SEC): number => {
    t += dt
    let v: number
    if (pauseLeft > 0) {
      pauseLeft -= dt
      v = 0.03 + r() * 0.05
      if (pauseLeft <= 0) {
        phraseLeft = 1.2 + r() * 3.4
        gain = 0.45 + r() * 0.55
      }
    } else {
      phraseLeft -= dt
      const syll = Math.abs(Math.sin(t * Math.PI * 2 * (3.6 + r() * 1.4)))
      v = (0.15 + syll * (0.4 + r() * 0.45)) * gain
      if (phraseLeft <= 0) pauseLeft = 0.3 + r() * 1.1
    }
    prev = prev * 0.35 + v * 0.65
    return Math.min(1, prev)
  }
}

const levelCache = new Map<string, number[]>()
/** Levels at LEVELS_PER_SEC for a memo (captured levels if any, else generated from its seed). */
export function memoLevels(m: Pick<Memo, 'id' | 'seed' | 'duration' | 'levels'>): number[] {
  if (m.levels?.length) return m.levels
  const key = `${m.id}:${m.seed}:${m.duration}`
  let l = levelCache.get(key)
  if (!l) {
    const src = speechSource(m.seed)
    l = Array.from({ length: Math.max(1, Math.ceil(m.duration * LEVELS_PER_SEC)) }, () => src())
    levelCache.set(key, l)
  }
  return l
}

/** Resample a level array into `n` bars (peak per bucket). */
export function bars(levels: number[], n: number): number[] {
  if (!levels.length) return Array(n).fill(0.04)
  const out: number[] = []
  for (let i = 0; i < n; i++) {
    const a = Math.floor((i / n) * levels.length)
    const b = Math.max(a + 1, Math.floor(((i + 1) / n) * levels.length))
    let sum = 0
    let c = 0
    for (let j = a; j < b && j < levels.length; j++) {
      sum += levels[j]
      c++
    }
    // a short window at the bucket centre keeps phrase/pause contrast on long recordings
    const mid = Math.min(levels.length - 1, (a + b) >> 1)
    const local = (levels[Math.max(0, mid - 1)] + levels[mid] + levels[Math.min(levels.length - 1, mid + 1)]) / 3
    out.push(c ? 0.7 * local + 0.3 * (sum / c) : 0.04)
  }
  return out
}

// ------------------------------------------------------------------ transcripts
export interface Word { text: string; start: number }
const wordCache = new Map<string, Word[]>()

/** Word timings spread over the recording, with extra time after sentence ends. */
export function wordTimings(transcript: string, duration: number): Word[] {
  const key = `${duration}|${transcript}`
  const hit = wordCache.get(key)
  if (hit) return hit
  const words = transcript.split(/\s+/).filter(Boolean)
  const weights = words.map((w) => w.length + 2 + (/[.!?]$/.test(w) ? 7 : /[,;:—]$/.test(w) ? 3 : 0))
  const total = weights.reduce((a, b) => a + b, 0) || 1
  const lead = Math.min(0.6, duration * 0.04)
  const span = Math.max(0.1, duration - lead - Math.min(0.8, duration * 0.04))
  let acc = 0
  const out = words.map((text, i) => {
    const start = lead + (acc / total) * span
    acc += weights[i]
    return { text, start }
  })
  wordCache.set(key, out)
  return out
}

export function currentWord(words: Word[], pos: number): number {
  let lo = 0
  let hi = words.length - 1
  let ans = -1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (words[mid].start <= pos) {
      ans = mid
      lo = mid + 1
    } else hi = mid - 1
  }
  return ans
}

// ------------------------------------------------------------------ demo recordings
export const SCHOOL = 'Lincoln High School'
export const HOME = 'Home'

export function demoMemos(): Memo[] {
  return [
    {
      id: 'vm-robotics',
      title: 'Robotics meeting notes',
      createdAt: at(-1, 18, 52),
      duration: 94,
      location: 'Lincoln High Room 114',
      seed: 7729,
      favorite: true,
      transcript:
        'Okay, robotics notes from tonight. Alex says the swerve modules are still drifting about two degrees, so Nora is going to retune the PID gains before Thursday. ' +
        'The intake works now, but the zip ties on the left side keep snapping, so we need to order more zip ties and heat shrink this week. ' +
        'Mr. Delgado wants the build log updated after every meeting, not just on weekends. ' +
        'The regional qualifier is in five weeks at the State Fair Expo Hall, and we still need a driver practice schedule. ' +
        'Next meeting is Thursday at 6:30 in Room 114. Bring safety glasses and a laptop charger.',
    },
    {
      id: 'vm-cadence',
      title: 'Drumline cadence idea',
      createdAt: at(-3, 21, 8),
      duration: 41,
      location: HOME,
      seed: 4411,
      transcript:
        'Cadence idea for Friday. Snares open with a sixteenth note roll, then tenors answer on the and of two. ' +
        'Bass drums split the eighth notes top to bottom. Ask Sam if the stick click section fits before the final unison hit. ' +
        'Maybe Leo can try it at sectionals on Saturday.',
    },
    {
      id: 'vm-chem',
      title: 'Chem study voice note',
      createdAt: at(-5, 16, 40),
      duration: 78,
      location: HOME,
      seed: 3120,
      transcript:
        'Chem test review. Stoichiometry always starts with a balanced equation. Convert grams to moles, use the mole ratio from the coefficients, then convert back to grams. ' +
        'The limiting reactant is the one that makes less product, not the one with less mass. ' +
        'Percent yield is actual over theoretical times one hundred. ' +
        'The test is Friday, and Priya wants to do a study group on Thursday after school. Practice problems twelve through twenty are due before then.',
    },
    {
      id: 'vm-school-1',
      title: 'Lincoln High School 1',
      createdAt: at(-7, 12, 15),
      duration: 23,
      location: SCHOOL,
      seed: 1201,
      transcript:
        'Quick reminder: bring the percussion bag and the spare snare heads on Friday. Ms. Thompson moved warm ups to 6 PM before the game.',
    },
    {
      id: 'vm-grandma',
      title: 'Grandma’s dumpling recipe',
      createdAt: at(-16, 15, 30),
      duration: 132,
      location: 'Willow Creek Dr',
      seed: 1420,
      favorite: true,
      transcript:
        'Grandma is walking me through the dumpling filling. One pound of ground pork, two cups of chopped napa cabbage, salted and squeezed dry. ' +
        'Three green onions, a thumb of ginger, two cloves of garlic. One tablespoon of soy sauce, one teaspoon of sesame oil, a little white pepper. ' +
        'Mix in one direction only, she says, until it gets sticky. Fold the wrapper in half and pinch six pleats on one side. ' +
        'Pan fry until the bottoms are golden, then add a third cup of water and cover for eight minutes. ' +
        'She says to make extra and freeze them flat on a tray first so they do not stick together.',
    },
    {
      id: 'vm-home-1',
      title: 'Home 1',
      createdAt: at(-9, 20, 5),
      duration: 12,
      location: HOME,
      seed: 902,
      deletedAt: Date.now() - 3 * DAY,
      transcript: 'Testing, testing. Is this thing on? Okay, never mind.',
    },
  ]
}

/** Phrases a simulated recording "hears", chosen by location. */
const POOL: Record<string, string[]> = {
  [SCHOOL]: [
    'Notes from class. The lab report is due Monday, and we need to include the error analysis section.',
    'Mr. Delgado said the robot inspection checklist has to be finished before the scrimmage on Saturday.',
    'Remember to ask Alex for the updated CAD files and to charge the spare batteries.',
    'For history, the essay outline should have three supporting arguments and a counterargument.',
    'Nora wants to test the new autonomous routine during lunch tomorrow.',
  ],
  [HOME]: [
    'Idea for the drumline feature: start soft on the rims, then build into a full unison roll.',
    'Things to do tonight. Finish the chem practice problems, text Priya about the study group, and pack the robotics laptop.',
    'Mom asked me to pick up milk and dog food for Biscuit on the way home tomorrow.',
    'Practice the cadence slowly at eighty beats per minute, then bump it to one hundred ten.',
    'Reminder to upload the build log photos to the team drive before Thursday.',
  ],
}

/** A plausible transcript for a simulated recording of `seconds` at `location`. */
export function simulatedTranscript(location: string, seconds: number, seed: number): string {
  if (seconds < 2.5) return ''
  const pool = POOL[location] ?? POOL[HOME]
  const r = rng(seed)
  const target = Math.max(3, Math.round(seconds * 2.2))
  const out: string[] = []
  let start = Math.floor(r() * pool.length)
  let count = 0
  while (count < target) {
    const words = pool[start % pool.length].split(' ')
    const take = words.slice(0, Math.min(words.length, target - count))
    let s = take.join(' ')
    if (!/[.!?]$/.test(s)) s += '…'
    out.push(s)
    count += take.length
    start++
  }
  return out.join(' ')
}

/** Where the simulated phone is: at school during school hours on weekdays, otherwise at home. */
export function currentLocation(now = new Date()): string {
  const d = now.getDay()
  const mins = now.getHours() * 60 + now.getMinutes()
  return d >= 1 && d <= 5 && mins >= 7 * 60 + 30 && mins < 15 * 60 + 30 ? SCHOOL : HOME
}
