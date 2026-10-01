/* Siri app: document uploads. Plain-text versions of the demo documents in Files
 * (rendered by src/apps/preview/docs.tsx) plus a small deterministic reader that
 * summarizes a document or answers a question about it. */
import { summarize } from '../../os/ai/writing'
import { at } from '../../os/time'
import { useOS } from '../../os/store'
import { speak } from '../../shell/siri/session'
import { fileById, type DemoFile } from '../preview/docs'

export interface SiriDoc {
  file: DemoFile
  /** label shown on the chip, e.g. "PDF · 2 pages" */
  meta: string
  text: string
  /** one-line gist used as the summary lead */
  gist: string
  highlights: string[]
  /** question patterns → exact answers (checked before the generic search) */
  facts: [RegExp, string][]
  suggestions: string[]
}

const day = (off: number, o: Intl.DateTimeFormatOptions = { weekday: 'long', month: 'long', day: 'numeric' }) => new Date(at(off, 12)).toLocaleDateString('en-US', o)
const money = (n: number) => `$${n.toLocaleString('en-US')}`

// ---------------------------------------------------------------- Robot Budget 2026
const BUDGET_ROWS: { item: string; cat: string; qty: number | null; unit: number | null; total: number; words: RegExp }[] = [
  { item: 'Drivetrain (swerve modules)', cat: 'Mechanical', qty: 4, unit: 460, total: 1840, words: /\b(drivetrain|swerve|modules?)\b/ },
  { item: 'Brushless motors', cat: 'Electrical', qty: 12, unit: 42, total: 504, words: /\bmotors?\b(?! controllers?)/ },
  { item: 'Motor controllers', cat: 'Electrical', qty: 12, unit: 74, total: 888, words: /\bcontrollers?\b/ },
  { item: 'Aluminum stock', cat: 'Mechanical', qty: null, unit: null, total: 320, words: /\b(aluminum|aluminium|stock|metal)\b/ },
  { item: 'Registration fee', cat: 'Events', qty: 1, unit: 5000, total: 5000, words: /\b(registration|entry|fee)\b/ },
  { item: 'Team shirts', cat: 'Outreach', qty: 24, unit: 14, total: 336, words: /\b(shirts?|t-shirts?|apparel)\b/ },
  { item: 'Single-board computer kit', cat: 'Software', qty: 2, unit: 90, total: 180, words: /\b(computer|single-board|kit|software)\b/ },
]
const BUDGET_TOTAL = BUDGET_ROWS.reduce((n, r) => n + r.total, 0)
const SPONSORS = 7500
const CATS = [...new Set(BUDGET_ROWS.map((r) => r.cat))].map((c) => ({ cat: c, total: BUDGET_ROWS.filter((r) => r.cat === c).reduce((n, r) => n + r.total, 0) })).sort((a, b) => b.total - a.total)
const pct = (n: number) => `${Math.round((n / BUDGET_TOTAL) * 100)}%`

function budgetFacts(): [RegExp, string][] {
  const biggest = [...BUDGET_ROWS].sort((a, b) => b.total - a.total)[0]
  const cheapest = [...BUDGET_ROWS].sort((a, b) => a.total - b.total)[0]
  return [
    [/\b(raise|fundrais\w*|short|gap|still need|left to|missing|deficit)\b/, `The budget is ${money(BUDGET_TOTAL)} and sponsorships cover ${money(SPONSORS)}, so the team still needs to raise ${money(BUDGET_TOTAL - SPONSORS)} — that’s the fundraising goal in row 11.`],
    [/\b(sponsor\w*)\b/, `Sponsorships bring in ${money(SPONSORS)}, about ${pct(SPONSORS)} of the ${money(BUDGET_TOTAL)} budget.`],
    [/\b(biggest|largest|most expensive|highest|main)\b/, `The biggest expense is the ${biggest.item.toLowerCase()} at ${money(biggest.total)} — ${pct(biggest.total)} of the whole budget. Next is the drivetrain at ${money(1840)}.`],
    [/\b(cheapest|smallest|least expensive|lowest)\b/, `The smallest line is the ${cheapest.item.toLowerCase()} at ${money(cheapest.total)} (${cheapest.qty} × ${money(cheapest.unit ?? 0)}).`],
    [/\b(categor\w*|breakdown|split|by type)\b/, `By category: ${CATS.map((c) => `${c.cat} ${money(c.total)} (${pct(c.total)})`).join(', ')}.`],
    [/\b(cut|save|reduce|lower|trim)\b/, `The easiest savings are outside the fixed registration fee: ordering 18 team shirts instead of 24 saves ${money(6 * 14)}, and reusing last season’s aluminum stock would save up to ${money(320)}. Together that would bring the fundraising goal down to ${money(BUDGET_TOTAL - SPONSORS - 84 - 320)}.`],
    [/\b(total|overall|all together|altogether|whole budget|how much (is|does) (it|the budget))\b/, `The 2026 robot budget totals ${money(BUDGET_TOTAL)} across ${BUDGET_ROWS.length} line items.`],
  ]
}

const BUDGET_TEXT = [
  'Robot Budget 2026, Circuit Breakers Robotics.',
  ...BUDGET_ROWS.map((r) => `${r.item} (${r.cat})${r.qty ? `: ${r.qty} at ${money(r.unit ?? 0)} each` : ''}, total ${money(r.total)}.`),
  `Total budget ${money(BUDGET_TOTAL)}.`,
  `Sponsorships ${money(SPONSORS)}.`,
  `Fundraising goal ${money(BUDGET_TOTAL - SPONSORS)}.`,
].join('\n')

// ---------------------------------------------------------------- all documents
function build(): SiriDoc[] {
  const docs: (Omit<SiriDoc, 'file'> & { id: string })[] = [
    {
      id: 'f8',
      meta: 'Numbers · 1 sheet',
      text: BUDGET_TEXT,
      gist: `The Circuit Breakers’ 2026 robot budget is ${money(BUDGET_TOTAL)}. Sponsorships cover ${money(SPONSORS)}, which leaves a ${money(BUDGET_TOTAL - SPONSORS)} fundraising goal.`,
      highlights: [
        `Registration fee: ${money(5000)} (${pct(5000)} of the budget)`,
        `Drivetrain (4 swerve modules): ${money(1840)}`,
        `Electrical — 12 motors + 12 controllers: ${money(504 + 888)}`,
        `Shirts, aluminum and computer kits: ${money(336 + 320 + 180)}`,
      ],
      facts: budgetFacts(),
      suggestions: ['How much do we still need to raise?', 'What’s the biggest expense?', 'Break it down by category', 'Where could we cut costs?'],
    },
    {
      id: 'f3',
      meta: 'Pages · 2 pages',
      text: 'Percent Yield of Copper(II) Carbonate. Lab report draft by Jamie Park and Priya Shah for Honors Chemistry. Purpose: to determine the percent yield of copper(II) carbonate produced from the reaction of copper(II) sulfate and sodium carbonate. Procedure: measure 2.50 g of copper sulfate pentahydrate and dissolve it in 50 mL of water, add 1.20 g of sodium carbonate solution while stirring, then filter, dry and weigh the precipitate. Data: the filter paper weighed 0.92 g and the filter paper plus product weighed 2.03 g. The actual yield was 1.11 g and the theoretical yield was 1.24 g. Priya asked to double-check the theoretical yield calculation. Analysis: percent yield is 1.11 divided by 1.24 times 100, which is 89.5%. Some product likely passed through the filter paper, and the precipitate may not have been completely dry. The conclusion section is still blank.',
      gist: 'This is a draft lab report (Jamie & Priya) measuring the percent yield of copper(II) carbonate. The actual yield was 1.11 g against a theoretical 1.24 g, for a percent yield of 89.5%.',
      highlights: ['Reaction: CuSO₄ + Na₂CO₃ → CuCO₃ (precipitate)', 'Actual yield 1.11 g · theoretical 1.24 g', 'Percent yield 89.5%', 'Still to do: the Conclusion is blank, and Priya asked to double-check the theoretical yield'],
      facts: [
        [/\b(theoretical|double.?check|check (the )?(calc|math)|limiting)\b/, 'Priya’s theoretical yield checks out. CuSO₄·5H₂O is the limiting reagent: 2.50 g ÷ 249.7 g/mol = 0.0100 mol, and the 1.20 g of Na₂CO₃ is 0.0113 mol. Since the reaction is 1:1, you get 0.0100 mol CuCO₃ × 123.6 g/mol = 1.24 g.'],
        [/\b(error|wrong|why|less than|lower|lost)\b/, 'The report gives two likely sources of error: some fine precipitate passed through the filter paper, and the product may not have been completely dry when it was weighed (which would actually push the mass up, so it’s worth mentioning which effect dominated).'],
        [/\b(percent|%|yield)\b/, 'The percent yield is 89.5% — 1.11 g actual ÷ 1.24 g theoretical × 100.'],
        [/\b(conclusion|missing|unfinished|left|to do|todo|finish)\b/, 'The Conclusion section is still empty. It should restate the 89.5% percent yield, compare it with the theoretical 1.24 g, and name the main source of error (product lost through the filter paper).'],
        [/\b(procedure|steps|method|how did)\b/, 'Procedure: dissolve 2.50 g CuSO₄·5H₂O in 50 mL of water, stir in 1.20 g Na₂CO₃ solution, then filter, dry and weigh the CuCO₃ precipitate.'],
        [/\b(who|partner|author)\b/, 'It’s a joint draft by you and Priya Shah for Honors Chemistry.'],
      ],
      suggestions: ['Double-check the theoretical yield', 'What’s missing before I hand it in?', 'Why isn’t the yield 100%?'],
    },
    {
      id: 'f4',
      meta: 'PDF · 2 pages',
      text: `Honors Chemistry Unit 3, Worksheet 3.2: Stoichiometry. Show all work and include units and significant figures. Question 1: How many moles of NaCl are in 117 g of NaCl? Question 2: Balance Fe + O2 → Fe2O3. Question 3: For 2H2 + O2 → 2H2O, how many grams of water form from 8.0 g of H2? Question 4: Which is the limiting reagent when 3.0 mol N2 reacts with 6.0 mol H2? Question 5: A student expects 25.0 g of product but recovers 21.3 g. Find the percent yield. Challenge question 6: 2Al + 3Cl2 → 2AlCl3 with 5.4 g Al and 14.2 g Cl2. Question 7: explain why percent yield is almost never 100%. Due ${day(((5 - new Date().getDay() + 7) % 7))}, Mrs. Alvarez, Room 208.`,
      gist: `Worksheet 3.2 is a seven-question stoichiometry set for Honors Chemistry (moles, balancing, limiting reagents and percent yield). It’s due ${day(((5 - new Date().getDay() + 7) % 7))} for Mrs. Alvarez.`,
      highlights: ['Q1–Q3: moles and mass conversions (Q1 and Q3 already answered)', 'Q4 & Q6: limiting reagents', 'Q5 & Q7: percent yield', 'Show work with units and sig figs'],
      facts: [
        [/\b(question|q|number|#|problem)\s*1\b|\bnacl\b/, 'Q1: 117 g ÷ 58.44 g/mol = 2.00 mol NaCl — your answer on the sheet is right.'],
        [/\b(question|q|number|#|problem)\s*2\b|\b(balance|fe2o3|iron)\b/, 'Q2: 4 Fe + 3 O₂ → 2 Fe₂O₃. Balance the oxygen first (3 O₂ gives 6 O atoms = 2 Fe₂O₃), then iron needs 4.'],
        [/\b(question|q|number|#|problem)\s*3\b|\bwater\b/, 'Q3: 8.0 g H₂ ÷ 2.016 g/mol = 3.97 mol H₂ → 3.97 mol H₂O × 18.02 g/mol ≈ 72 g. That matches what you wrote.'],
        [/\b(question|q|number|#|problem)\s*4\b|\b(n2|nh3|ammonia)\b/, 'Q4: H₂ is limiting. 3.0 mol N₂ would need 9.0 mol H₂ (1:3), but only 6.0 mol is available.'],
        [/\b(question|q|number|#|problem)\s*5\b/, 'Q5: percent yield = 21.3 g ÷ 25.0 g × 100 = 85.2%.'],
        [/\b(question|q|number|#|problem)\s*6\b|\b(challenge|alcl3|aluminum)\b/, 'Q6: 5.4 g Al = 0.200 mol and 14.2 g Cl₂ = 0.200 mol. Al would need 0.300 mol Cl₂, so Cl₂ is limiting and Al is in excess. AlCl₃ = 0.200 × 2/3 = 0.133 mol × 133.3 g/mol ≈ 17.8 g.'],
        [/\b(question|q|number|#|problem)\s*7\b|\b(never 100|why)\b/, 'Q7 (one sentence): some product is always lost during transfer, filtering or drying, and side reactions or incomplete reactions keep the actual yield below the theoretical yield.'],
        [/\b(due|when|deadline|teacher)\b/, `It’s due ${day(((5 - new Date().getDay() + 7) % 7))} — Mrs. Alvarez, Room 208.`],
        [/\b(left|unanswered|remaining|still|to do|blank)\b/, 'Questions 2, 4, 5, 6 and 7 are still blank. Q1 (2.00 mol) and Q3 (72 g) are filled in and both are correct.'],
      ],
      suggestions: ['Which questions are still blank?', 'Walk me through question 6', 'When is it due?'],
    },
    {
      id: 'f2',
      meta: 'PDF · 2 pages',
      text: `Robotics League 2026 Season Regional Qualifier Rules, Revision C. The Regional Qualifier is held at the State Fair Expo Hall on ${day(35, { month: 'long', day: 'numeric' })}. Teams play 10 qualification matches followed by alliance selection and a best-of-three elimination bracket. Robot constraints: maximum starting size 30 in by 30 in by 48 in, maximum weight 125 lb excluding bumpers and battery, up to 14 brushless motors, 12 V sealed lead-acid battery only. The autonomous period lasts 15 seconds, followed by a 2 minute 15 second teleoperated period. Scoring: leaving the starting zone is 3 points in auto; a low goal is 3 in auto and 2 in teleop; a high goal is 6 in auto and 4 in teleop; parking in the endgame zone is 2; a hang (climb) is 12. All robots must pass inspection before their first qualification match. Bumpers must display the team number in white or black numerals at least 4 in tall. Gracious professionalism is expected; yellow and red cards may be issued for unsafe robot operation.`,
      gist: `The Regional Qualifier is on ${day(35, { month: 'long', day: 'numeric' })} at the State Fair Expo Hall: 10 qualification matches, then alliance selection and best-of-three eliminations. Robots must stay under 125 lb and 30 × 30 × 48 in.`,
      highlights: ['Max 125 lb, 30 × 30 × 48 in, up to 14 brushless motors', '15 s autonomous + 2:15 teleop', 'Hang = 12 pts — the most valuable action', 'Pass inspection before your first match; 4 in bumper numbers'],
      facts: [
        [/\b(weight|weigh|heavy|lb|pounds?)\b/, 'Robots can weigh up to 125 lb, not counting bumpers and the battery.'],
        [/\b(size|dimensions?|tall|wide|inches)\b/, 'The maximum starting size is 30 in × 30 in × 48 in.'],
        [/\b(motors?)\b/, 'You can use up to 14 brushless motors.'],
        [/\b(battery|batteries)\b/, 'Only 12 V sealed lead-acid batteries are allowed.'],
        [/\b(hang|climb|endgame|most points|worth the most|best)\b/, 'A hang (climb) is worth 12 points in teleop — by far the most valuable action. Parking in the endgame zone is worth 2.'],
        [/\b(score|scoring|points?|goal)\b/, 'Scoring: leave the starting zone 3 (auto); low goal 3 auto / 2 teleop; high goal 6 auto / 4 teleop; park 2; hang 12.'],
        [/\b(auto|autonomous|teleop|how long|match length|minutes?)\b/, 'Each match has a 15-second autonomous period followed by 2 minutes 15 seconds of teleop.'],
        [/\b(when|date|where|location|venue)\b/, `It’s on ${day(35)} at the State Fair Expo Hall.`],
        [/\b(inspection|bumpers?|numbers?)\b/, 'Every robot must pass inspection before its first qualification match, and bumpers need the team number in white or black numerals at least 4 in tall.'],
        [/\b(matches|format|bracket|elimination)\b/, 'Teams play 10 qualification matches, then alliance selection, then a best-of-three elimination bracket.'],
      ],
      suggestions: ['How much can the robot weigh?', 'What’s worth the most points?', 'When and where is it?'],
    },
    {
      id: 'f6',
      meta: 'PDF · 1 page',
      text: 'Skyward Airlines itinerary and receipt. Confirmation 7XKQ2P. Flight SK 482 departs Maple Grove (MGR) at 8:45 AM and arrives in Seattle (SEA) at 11:05 AM, nonstop, 2 hours 20 minutes, Friday, November 21, Economy, Boeing 737. Passengers: Michael Park seat 14A, Dana Park seat 14B, Jamie Park seat 14C, Mia Park seat 14D, one bag each. Total paid $1,146.40. Check in opens 24 hours before departure. Boarding closes 15 minutes before departure.',
      gist: 'Skyward flight SK 482 for the Park family: Maple Grove 8:45 AM → Seattle 11:05 AM on Friday, November 21 (confirmation 7XKQ2P).',
      highlights: ['Confirmation 7XKQ2P · Economy · nonstop 2h 20m', 'Seats 14A–14D (you’re in 14C)', 'Total paid $1,146.40', 'Check-in opens 24 hours before; boarding closes 15 minutes before'],
      facts: [
        [/\b(seat|sitting|sit)\b/, 'You’re in seat 14C. Dad has 14A, Mom 14B and Mia 14D.'],
        [/\b(confirmation|code|booking|record locator)\b/, 'The confirmation code is 7XKQ2P.'],
        [/\b(cost|paid|price|total|how much)\b/, 'The total paid was $1,146.40 for four passengers.'],
        [/\b(check.?in|board\w*)\b/, 'Check-in opens 24 hours before departure (Thursday, November 20 at 8:45 AM), and boarding closes at 8:30 AM.'],
        [/\b(when|time|depart\w*|leave|arriv\w*|land)\b/, 'SK 482 leaves Maple Grove at 8:45 AM on Friday, November 21 and lands in Seattle at 11:05 AM.'],
        [/\b(bags?|luggage)\b/, 'Each passenger has one bag included.'],
      ],
      suggestions: ['Which seat am I in?', 'When does check-in open?', 'What’s the confirmation code?'],
    },
    {
      id: 'f5',
      meta: 'PDF · 2 pages',
      text: `Lincoln High School Music Department presents the Fall Concert, ${day(16)} at 7:00 PM in the Lincoln High Auditorium. Concert Band: Autumn Overture by R. Hale and Riverside Suite movement II by J. Moreno. Percussion Ensemble: Cadence 3 arranged by R. Thompson and Rolling Thunder by L. Martins. Symphonic Winds: Luminous Coast by M. Lin, arranged by Thompson, and the finale, Lions March. Percussion: Sam Okafor, Jamie Park, Priya Shah and Leo Martins. Call time 6:00 PM. Black concert attire. Director: Rachel Thompson.`,
      gist: `The Fall Concert is ${day(16)} at 7:00 PM in the Lincoln High Auditorium, with Concert Band, the Percussion Ensemble and Symphonic Winds. You’re listed in the percussion section.`,
      highlights: ['Call time 6:00 PM · black concert attire', 'Percussion Ensemble plays Cadence 3 and Rolling Thunder', 'Finale: Lions March', 'Director: Rachel Thompson'],
      facts: [
        [/\b(call time|arrive|get there|be there)\b/, 'Call time is 6:00 PM, an hour before the 7:00 PM start.'],
        [/\b(wear|attire|dress|clothes)\b/, 'Black concert attire.'],
        [/\b(cadence|percussion|drum\w*|when do (i|we) play|my piece)\b/, 'The Percussion Ensemble plays Cadence 3 (arr. R. Thompson) and Rolling Thunder (L. Martins), in the middle of the program after the Concert Band. You’re listed with Sam, Priya and Leo.'],
        [/\b(when|date|time|where)\b/, `${day(16)} at 7:00 PM in the Lincoln High Auditorium.`],
        [/\b(program|pieces|songs|playing|order)\b/, 'Program: Concert Band — Autumn Overture, Riverside Suite II; Percussion Ensemble — Cadence 3, Rolling Thunder; Symphonic Winds — Luminous Coast, then the finale, Lions March.'],
      ],
      suggestions: ['What time is call time?', 'What should I wear?', 'When does percussion play?'],
    },
  ]
  return docs.flatMap(({ id, ...rest }) => {
    const file = fileById(id)
    return file ? [{ file, ...rest }] : []
  })
}

let cache: SiriDoc[] | null = null
export function siriDocs(): SiriDoc[] {
  if (!cache) cache = build()
  return cache
}
export const docById = (id: string | null | undefined) => (id ? siriDocs().find((d) => d.file.id === id) : undefined)

// ---------------------------------------------------------------- reader
const STOP = new Set('a an the is are was were be to of in on for and or it its this that these those what whats which who how much many does do did i me my we our you your about with from at by as can could should would will tell show give document doc file pdf please there their they them than then so if into any some'.split(' '))
const words = (s: string) => (s.toLowerCase().replace(/[’']/g, '').match(/[a-z0-9.%$]+/g) ?? []).filter((w) => w.length > 1 && !STOP.has(w))

/** Does this follow-up look like it's about the attached document? */
export function isAboutDoc(q: string, doc: SiriDoc): boolean {
  const l = q.toLowerCase()
  if (/\b(this|it|document|doc|file|pdf|sheet|spreadsheet|report|worksheet|itinerary|program|rules|budget|summar\w*|key points|tl;?dr|question \d|q\d)\b/.test(l)) return true
  if (doc.facts.some(([re]) => re.test(l))) return true
  const text = doc.text.toLowerCase()
  return words(q).filter((w) => text.includes(w)).length >= 2
}

export interface DocAnswer { text: string; followUps: string[] }

export function answerDoc(q: string, doc: SiriDoc): DocAnswer {
  const l = q.toLowerCase().replace(/[’]/g, '\'')
  const name = `“${doc.file.name}”`
  const follow = (used?: string) => doc.suggestions.filter((s) => s !== used).slice(0, 3)
  const asked = doc.suggestions.find((s) => s.toLowerCase().replace(/’/g, '\'') === l.trim())

  if (/\b(key points|bullet|main points|highlights)\b/.test(l)) {
    return { text: `Key points from ${name}:\n${doc.highlights.map((h) => `• ${h}`).join('\n')}`, followUps: follow(asked) }
  }
  if (/\b(summari[sz]e|summary|tl;?dr|overview|recap|what('s| is) (this|it|in (this|it))|what does (this|it) say|explain (this|it)|look at this|read (this|it))\b/.test(l) || !l.trim()) {
    const body = `${doc.gist}\n\n${doc.highlights.map((h) => `• ${h}`).join('\n')}`
    return { text: `Here’s a summary of ${name}: ${body}`, followUps: follow(asked) }
  }
  // budget: a specific line item
  if (doc.file.id === 'f8') {
    const row = BUDGET_ROWS.find((r) => r.words.test(l))
    if (row && !/\b(biggest|largest|cheapest|smallest|total|raise|category|cut)\b/.test(l)) {
      return { text: `${row.item}: ${row.qty ? `${row.qty} × ${money(row.unit ?? 0)} = ` : ''}${money(row.total)} (${row.cat}, ${pct(row.total)} of the budget).`, followUps: follow(asked) }
    }
    const cat = CATS.find((c) => l.includes(c.cat.toLowerCase()))
    if (cat) {
      const items = BUDGET_ROWS.filter((r) => r.cat === cat.cat)
      return { text: `${cat.cat} costs ${money(cat.total)} (${pct(cat.total)}): ${items.map((r) => `${r.item.toLowerCase()} ${money(r.total)}`).join(', ')}.`, followUps: follow(asked) }
    }
  }
  const fact = doc.facts.find(([re]) => re.test(l))
  if (fact) return { text: fact[1], followUps: follow(asked) }

  // generic: best-matching sentence from the document
  const qw = words(q)
  const sentences = doc.text.split(/(?<=[.!?])\s+|\n/).map((s) => s.trim()).filter(Boolean)
  const scored = sentences.map((s) => ({ s, n: qw.filter((w) => s.toLowerCase().includes(w)).length })).sort((a, b) => b.n - a.n)
  if (scored[0] && scored[0].n > 0) return { text: `From ${name}: ${scored[0].s}`, followUps: follow() }
  return {
    text: `I couldn’t find that in ${name}. Here’s what it covers: ${summarize(doc.text)}`,
    followUps: follow(),
  }
}

/** Siri app turn for a question about an uploaded document: records the user turn,
 * "reads" the document, then appends a deterministic answer. Mirrors runSiri(). */
export function runDocSiri(q: string, doc: SiriDoc, convId: string, voice?: boolean): Promise<{ userTurnId: string }> {
  const st = useOS.getState()
  const first = !st.siriConversations.find((c) => c.id === convId)?.turns.length
  const userTurnId = st.siriAppend({ role: 'user', text: q }, convId)
  if (first) {
    const title = `${doc.file.name.replace(/\.\w+$/, '')} — ${q.replace(/[?.!]+$/, '')}`.slice(0, 48)
    useOS.getState().set({ siriConversations: useOS.getState().siriConversations.map((c) => (c.id === convId ? { ...c, title } : c)) })
  }
  st.set({ siriMode: 'thinking', siriCurrent: convId })
  return new Promise((resolve) => {
    window.setTimeout(() => {
      const res = answerDoc(q, doc)
      useOS.getState().siriAppend({ role: 'siri', text: res.text, followUps: res.followUps }, convId)
      useOS.getState().set({ siriMode: 'responding' })
      if (voice || useOS.getState().siriSettings.responses === 'always') speak(res.text)
      resolve({ userTurnId })
    }, 900 + Math.min(700, q.length * 8))
  })
}
