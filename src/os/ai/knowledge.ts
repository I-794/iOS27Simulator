/* A small on-device knowledge base for broad-knowledge Siri answers in the demo. */

interface Fact {
  keys: string[]
  answer: string
  followUps?: string[]
}

export const FACTS: Fact[] = [
  { keys: ['stoichiometry'], answer: 'Stoichiometry is the math of chemical reactions: using a balanced equation’s mole ratios to figure out how much of each reactant you need or how much product you’ll get. The usual path is grams → moles (divide by molar mass) → mole ratio → moles → grams.', followUps: ['What is a limiting reagent?', 'Quiz me on stoichiometry'] },
  { keys: ['limiting reagent', 'limiting reactant'], answer: 'The limiting reagent is the reactant that runs out first, so it determines the maximum amount of product. Convert each reactant to moles, divide by its coefficient in the balanced equation, and the smallest result is the limiting reagent.' },
  { keys: ['mole', 'avogadro'], answer: 'A mole is 6.022 × 10²³ particles (Avogadro’s number). One mole of a substance has a mass in grams equal to its molar mass.' },
  { keys: ['photosynthesis'], answer: 'Photosynthesis is how plants turn light energy into chemical energy: 6CO₂ + 6H₂O + light → C₆H₁₂O₆ + 6O₂. It happens mainly in the chloroplasts of leaf cells.' },
  { keys: ['newton', 'second law', 'f=ma', 'force equals'], answer: 'Newton’s second law says force equals mass times acceleration (F = ma). Double the force on the same mass and you double its acceleration.' },
  { keys: ['speed of light'], answer: 'Light travels at about 299,792 kilometers per second (about 186,282 miles per second) in a vacuum.' },
  { keys: ['moon', 'far'], answer: 'The Moon is about 384,400 km (238,855 miles) from Earth on average — light takes about 1.3 seconds to make the trip.' },
  { keys: ['tallest mountain', 'mount everest', 'highest mountain'], answer: 'Mount Everest is the highest mountain above sea level at about 8,849 meters (29,032 feet).' },
  { keys: ['telephone', 'invented'], answer: 'Alexander Graham Bell received the first US patent for the telephone in 1876, though several inventors worked on similar devices at the time.' },
  { keys: ['swerve drive', 'swerve'], answer: 'A swerve drive gives each wheel its own steering motor, so a robot can move in any direction while rotating independently. It’s fast and agile but more complex to build and calibrate than a tank or mecanum drive.' },
  { keys: ['mecanum'], answer: 'Mecanum wheels have angled rollers so a robot can strafe sideways. They’re simpler than swerve but have less pushing power.' },
  { keys: ['pid', 'pid controller'], answer: 'A PID controller corrects error using three terms: Proportional (how far off you are), Integral (how long you’ve been off), and Derivative (how fast the error is changing). Robotics teams use it to hold arm positions or drive straight.' },
  { keys: ['paradiddle', 'rudiment'], answer: 'A paradiddle is a drum rudiment played R L R R L R L L. It’s great for building hand independence and shows up constantly in drumline cadences.' },
  { keys: ['tempo', 'bpm', 'allegro'], answer: 'Tempo is the speed of music, measured in beats per minute (BPM). Allegro is roughly 120–156 BPM; Andante is a walking pace around 76–108 BPM.' },
  { keys: ['capital of france'], answer: 'The capital of France is Paris.' },
  { keys: ['capital of japan'], answer: 'The capital of Japan is Tokyo.' },
  { keys: ['capital of australia'], answer: 'The capital of Australia is Canberra — not Sydney, which is the largest city.' },
  { keys: ['declaration of independence'], answer: 'The Declaration of Independence was adopted by the Continental Congress on July 4, 1776. Thomas Jefferson was its principal author.' },
  { keys: ['mitochondria'], answer: 'Mitochondria are organelles that produce most of a cell’s ATP through cellular respiration — which is why they’re nicknamed the powerhouse of the cell.' },
  { keys: ['pythagorean', 'pythagoras'], answer: 'The Pythagorean theorem says that in a right triangle a² + b² = c², where c is the hypotenuse.' },
  { keys: ['quadratic formula'], answer: 'For ax² + bx + c = 0, x = (−b ± √(b² − 4ac)) / 2a.' },
  { keys: ['black hole'], answer: 'A black hole is a region where gravity is so strong that nothing, not even light, can escape once it crosses the event horizon. Most form when massive stars collapse.' },
  { keys: ['liquid glass'], answer: 'Liquid Glass is Apple’s design material that refracts and reflects what’s behind it. In iOS 27 you can choose how clear or tinted it looks in Settings › Display & Brightness › Liquid Glass.' },
  { keys: ['ios 27', 'whats new'], answer: 'iOS 27 brings the new Siri with its own app, personal context and onscreen awareness, a Liquid Glass transparency control, new Apple Intelligence photo tools like Extend and Reframe, Describe a Shortcut, faster app launches and AirDrop, and new parental controls.' },
  { keys: ['thunderstorm', 'lightning safety'], answer: 'If you can hear thunder you’re close enough to be struck. Head indoors and wait 30 minutes after the last thunder before going back outside.' },
  { keys: ['golden retriever'], answer: 'Golden retrievers are friendly, energetic sporting dogs originally bred in Scotland to retrieve waterfowl. They usually live 10–12 years and love to swim — as Biscuit has discovered.' },
  { keys: ['monstera'], answer: 'Monstera deliciosa likes bright, indirect light and watering when the top couple inches of soil are dry. The holes in its leaves are called fenestrations.' },
  { keys: ['sunflower'], answer: 'Sunflowers (Helianthus annuus) can grow over 3 m tall. Young flower heads track the sun during the day — a behavior called heliotropism.' },
]

export function lookupFact(q: string): Fact | null {
  const l = q.toLowerCase().replace(/[’']/g, '')
  let best: { f: Fact; n: number } | null = null
  for (const f of FACTS) {
    const n = f.keys.filter((k) => l.includes(k)).reduce((a, k) => a + k.length, 0)
    if (n && (!best || n > best.n)) best = { f, n }
  }
  return best?.f ?? null
}

/** Evaluate simple math, percentages and bill splitting. */
export function mathAnswer(q: string): string | null {
  const l = q.toLowerCase().replace(/,/g, '').replace(/\$/g, '')
  let m = l.match(/(\d+(?:\.\d+)?)\s*%\s*(?:of|tip on)\s*(\d+(?:\.\d+)?)/)
  if (m) return `${m[1]}% of ${m[2]} is ${+(+m[1] * +m[2] / 100).toFixed(2)}.`
  m = l.match(/split\s*(\d+(?:\.\d+)?)\s*(?:between|among|by|ways|into)?\s*(\d+|two|three|four|five|six)/)
  if (m) {
    const n = { two: 2, three: 3, four: 4, five: 5, six: 6 }[m[2] as 'two'] ?? +m[2]
    return `Split ${n} ways, each person pays $${(+m[1] / n).toFixed(2)}.`
  }
  m = l.match(/(?:what(?:’s|'s| is)\s*)?(-?\d+(?:\.\d+)?)\s*(plus|\+|minus|-|times|x|\*|divided by|\/)\s*(-?\d+(?:\.\d+)?)/)
  if (m) {
    const a = +m[1]
    const b = +m[3]
    const op = m[2]
    const r = op === 'plus' || op === '+' ? a + b : op === 'minus' || op === '-' ? a - b : op === 'times' || op === 'x' || op === '*' ? a * b : a / b
    return `${m[1]} ${op} ${m[3]} is ${+r.toFixed(4)}.`
  }
  m = l.match(/(\d+(?:\.\d+)?)\s*(miles?|mi|km|kilometers?|pounds?|lbs?|kg|kilograms?|fahrenheit|f|celsius|c|feet|ft|meters?|m)\s*(?:in|to)\s*(miles?|km|kilometers?|pounds?|lbs?|kg|kilograms?|celsius|c|fahrenheit|f|meters?|m|feet|ft)\b/)
  if (m) {
    const v = +m[1]
    const from = m[2][0]
    const to = m[3][0]
    const conv: Record<string, (x: number) => [number, string]> = {
      'mk': (x) => [x * 1.609, 'km'], 'km': (x) => [x / 1.609, 'miles'], 'pk': (x) => [x * 0.4536, 'kg'], 'lk': (x) => [x * 0.4536, 'kg'],
      'kp': (x) => [x / 0.4536, 'pounds'], 'kl': (x) => [x / 0.4536, 'pounds'], 'fc': (x) => [(x - 32) * 5 / 9, '°C'], 'cf': (x) => [x * 9 / 5 + 32, '°F'],
      'fm': (x) => [x * 0.3048, 'meters'], 'mf': (x) => [x / 0.3048, 'feet'],
    }
    const k = `${from}${to}`
    const f = conv[k]
    if (f) {
      const [r, u] = f(v)
      return `${m[1]} ${m[2]} is about ${+r.toFixed(2)} ${u}.`
    }
  }
  return null
}

const TRANSLATIONS: Record<string, Record<string, string>> = {
  spanish: { 'thank you': 'gracias', hello: 'hola', 'good morning': 'buenos días', 'see you tomorrow': 'hasta mañana', 'where is the library': '¿dónde está la biblioteca?', 'i love you': 'te quiero', dog: 'perro', 'good luck': 'buena suerte' },
  french: { 'thank you': 'merci', hello: 'bonjour', 'good morning': 'bonjour', 'see you tomorrow': 'à demain', 'i love you': 'je t’aime', dog: 'chien', 'good luck': 'bonne chance' },
  korean: { 'thank you': '감사합니다 (gamsahamnida)', hello: '안녕하세요 (annyeonghaseyo)', 'i love you': '사랑해요 (saranghaeyo)', 'good luck': '행운을 빌어요 (haeng-uneul bireoyo)' },
  japanese: { 'thank you': 'ありがとう (arigatou)', hello: 'こんにちは (konnichiwa)', 'good morning': 'おはよう (ohayou)', 'good luck': '頑張って (ganbatte)' },
}

export function translate(q: string): string | null {
  const m = q.toLowerCase().match(/(?:how (?:do you|do i) say|translate)\s+["“]?(.+?)["”]?\s+(?:in|into|to)\s+(spanish|french|korean|japanese)/)
  if (!m) return null
  const phrase = m[1].trim().replace(/[?.!]$/, '')
  const t = TRANSLATIONS[m[2]]?.[phrase]
  if (t) return `In ${m[2][0].toUpperCase() + m[2].slice(1)}, “${phrase}” is “${t}”.`
  return `I can translate common phrases offline in this demo. Try “thank you”, “good luck”, or “see you tomorrow” in ${m[2][0].toUpperCase() + m[2].slice(1)}.`
}
