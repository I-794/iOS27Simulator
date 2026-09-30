/* Natural-language date / time / entity parsing used by Siri, Calendar and Reminders. */
import { DAY, HOUR, MIN, startOfDay, WEEKDAYS, MONTHS } from '../time'

const NUM_WORDS: Record<string, number> = {
  zero: 0, one: 1, a: 1, an: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
  thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, 'forty-five': 45, fifty: 50, sixty: 60, ninety: 90, half: 0.5, couple: 2, few: 3,
}

export function wordsToNumbers(s: string): string {
  return s.replace(/\b(twenty|thirty|forty|fifty)[- ](one|two|three|four|five|six|seven|eight|nine)\b/gi, (_m, a: string, b: string) => String(NUM_WORDS[a.toLowerCase()] + NUM_WORDS[b.toLowerCase()]))
    .replace(/\b(zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|ninety)\b/gi, (m) => String(NUM_WORDS[m.toLowerCase()]))
    .replace(/\bhalf an hour\b/gi, '30 minutes')
    .replace(/\ban hour\b/gi, '1 hour')
    .replace(/\ba minute\b/gi, '1 minute')
}

export interface ParsedWhen {
  start: number
  end?: number
  allDay?: boolean
  hasTime: boolean
  hasDate: boolean
  spans: string[]
}

const MONTH_RE = MONTHS.map((m) => `${m.toLowerCase()}|${m.slice(0, 3).toLowerCase()}\\.?`).join('|')

/** Parse the first date/time expression in `text`. Returns null if none found. */
export function parseWhen(input: string, now = Date.now()): ParsedWhen | null {
  const text = wordsToNumbers(input.toLowerCase())
  const spans: string[] = []
  let day: number | null = null
  let hour: number | null = null
  let minute = 0
  let durationMs: number | undefined

  const take = (re: RegExp): RegExpMatchArray | null => {
    const m = text.match(re)
    if (m) spans.push(m[0])
    return m
  }

  let m: RegExpMatchArray | null
  // relative "in 2 hours / in 30 minutes / in 3 days"
  if ((m = take(/\bin (\d+(?:\.\d+)?) (minute|min|hour|hr|day|week)s?\b/))) {
    const n = parseFloat(m[1])
    const unit = m[2].startsWith('min') ? MIN : m[2].startsWith('h') ? HOUR : m[2] === 'day' ? DAY : 7 * DAY
    const t = now + n * unit
    return { start: t, hasTime: unit < DAY, hasDate: true, spans }
  }

  if ((m = take(/\b(today|tonight|this evening|this afternoon|this morning)\b/))) {
    day = startOfDay(now)
    if (m[1] === 'tonight' || m[1] === 'this evening') hour = 19
    if (m[1] === 'this afternoon') hour = 15
    if (m[1] === 'this morning') hour = 9
  } else if ((m = take(/\b(the day after tomorrow)\b/))) day = startOfDay(now) + 2 * DAY
  else if ((m = take(/\b(tomorrow|tmrw|tmr)( morning| afternoon| evening| night)?\b/))) {
    day = startOfDay(now) + DAY
    if (m[2]) hour = { ' morning': 9, ' afternoon': 15, ' evening': 18, ' night': 20 }[m[2]]!
  } else if ((m = take(new RegExp(`\\b(next |this |on |)(${WEEKDAYS.map((d) => d.toLowerCase()).join('|')}|mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun)\\b( morning| afternoon| evening| night)?`)))) {
    const map: Record<string, number> = { mon: 1, tue: 2, tues: 2, wed: 3, thu: 4, thur: 4, thurs: 4, fri: 5, sat: 6, sun: 0 }
    const wd = WEEKDAYS.map((d) => d.toLowerCase()).indexOf(m[2]) >= 0 ? WEEKDAYS.map((d) => d.toLowerCase()).indexOf(m[2]) : map[m[2]]
    const today = new Date(now).getDay()
    let diff = (wd - today + 7) % 7
    if (m[1] === 'next ') diff = diff === 0 ? 7 : diff < 3 ? diff + 7 : diff
    if (diff === 0 && m[1] !== 'this ') diff = 7
    if (diff === 0) diff = 0
    day = startOfDay(now) + diff * DAY
    if (m[3]) hour = { ' morning': 9, ' afternoon': 15, ' evening': 18, ' night': 20 }[m[3]]!
  } else if ((m = take(new RegExp(`\\b(${MONTH_RE}) (\\d{1,2})(st|nd|rd|th)?\\b`)))) {
    const mi = MONTHS.findIndex((x) => m![1].startsWith(x.slice(0, 3).toLowerCase()))
    const y = new Date(now).getFullYear()
    let d = new Date(y, mi, +m[2]).getTime()
    if (d < startOfDay(now) - DAY) d = new Date(y + 1, mi, +m[2]).getTime()
    day = d
  } else if ((m = take(/\b(\d{1,2})\/(\d{1,2})\b/))) {
    const y = new Date(now).getFullYear()
    day = new Date(y, +m[1] - 1, +m[2]).getTime()
  } else if ((m = take(/\bon the (\d{1,2})(st|nd|rd|th)\b/))) {
    const d = new Date(now)
    let t = new Date(d.getFullYear(), d.getMonth(), +m[1]).getTime()
    if (t < startOfDay(now)) t = new Date(d.getFullYear(), d.getMonth() + 1, +m[1]).getTime()
    day = t
  } else if ((m = take(/\bnext week\b/))) day = startOfDay(now) + 7 * DAY
  else if ((m = take(/\bthis weekend\b|\bweekend\b/))) day = startOfDay(now) + ((6 - new Date(now).getDay() + 7) % 7) * DAY

  // time of day
  if ((m = take(/\b(?:at |@ ?|by |around )?(\d{1,2})(?::(\d{2}))? ?(am|pm|a\.m\.|p\.m\.)\b/))) {
    hour = +m[1] % 12 + (m[3].startsWith('p') ? 12 : 0)
    minute = m[2] ? +m[2] : 0
  } else if ((m = take(/\b(?:at|@|by|around) (\d{1,2}):(\d{2})\b/)) || (m = take(/\b(\d{1,2}):(\d{2})\b/))) {
    hour = +m[1]
    minute = +m[2]
    if (hour < 8) hour += 12 // "6:30" in casual speech → evening
    if (hour === 12 && minute >= 0) hour = 12
  } else if ((m = take(/\bat (\d{1,2})\b(?!\s*(?:minutes|min|hours|%|percent|people|st|nd|rd|th))/))) {
    hour = +m[1]
    if (hour < 8) hour += 12
  } else if ((m = take(/\b(noon|midday)\b/))) hour = 12
  else if ((m = take(/\bmidnight\b/))) hour = 0
  else if (hour === null && (m = take(/\b(in the )?(morning|afternoon|evening)\b/))) hour = { morning: 9, afternoon: 15, evening: 18 }[m[2]]!

  // duration
  if ((m = text.match(/\bfor (\d+(?:\.\d+)?) (minute|min|hour|hr)s?\b/))) {
    durationMs = parseFloat(m[1]) * (m[2].startsWith('m') ? MIN : HOUR)
    spans.push(m[0])
  }
  const range = text.match(/\b(?:from )?(\d{1,2})(?::(\d{2}))? ?(am|pm)? ?(?:-|–|to|until) ?(\d{1,2})(?::(\d{2}))? ?(am|pm)\b/)
  if (range) {
    const ap2 = range[6]
    const ap1 = range[3] ?? ap2
    hour = (+range[1] % 12) + (ap1 === 'pm' ? 12 : 0)
    minute = range[2] ? +range[2] : 0
    const h2 = (+range[4] % 12) + (ap2 === 'pm' ? 12 : 0)
    const m2 = range[5] ? +range[5] : 0
    durationMs = (h2 * 60 + m2 - (hour * 60 + minute)) * MIN
    spans.push(range[0])
  }

  if (day === null && hour === null) return null
  if (day === null) {
    day = startOfDay(now)
    // if the time already passed today, assume tomorrow
    if (hour !== null && day + hour * HOUR + minute * MIN < now) day += DAY
  }
  const start = day + (hour ?? 9) * HOUR + minute * MIN
  return {
    start,
    end: durationMs ? start + durationMs : hour !== null ? start + HOUR : undefined,
    allDay: hour === null,
    hasTime: hour !== null,
    hasDate: true,
    spans,
  }
}

/** Remove parsed date/time phrases and filler to get a clean title. */
export function stripWhen(text: string, spans: string[]): string {
  let t = wordsToNumbers(text)
  for (const s of spans) t = t.replace(new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), ' ')
  return t.replace(/\s{2,}/g, ' ').replace(/\s+([,.!?])/g, '$1').trim()
}

export interface ParsedEvent {
  title: string
  start: number
  end: number
  allDay: boolean
  location?: string
  invitees: string[]
}

/** "Dinner with Sam next Friday at 6:30 at Culver's" → structured event */
export function parseEvent(text: string, now = Date.now(), knownPeople: { id: string; names: string[] }[] = []): ParsedEvent | null {
  const cleaned = text
    .replace(/^(hey siri,?\s*)?/i, '')
    .replace(/^(please\s+)?(add|create|schedule|put|make|set up|book)( an?| my)?( new)?( event| appointment| meeting)?( for| called)?\s*/i, '')
    .replace(/\s+(to|on|in) (my |the )?calendar\b/i, '')
    .replace(/[.!]$/, '')
  const when = parseWhen(cleaned, now)
  if (!when) return null
  let rest = stripWhen(cleaned, when.spans)
  let location: string | undefined
  const loc = rest.match(/\s(?:at|@|in) ((?:[A-Z0-9][\w'’&.-]*\s?){1,5}(?:\s(?:St|Ave|Rd|Dr|Lane|Blvd)\.?)?)\s*$/)
  if (loc) {
    location = loc[1].trim()
    rest = rest.slice(0, loc.index).trim()
  } else {
    const loc2 = rest.match(/\s(?:at|@) (.+)$/i)
    if (loc2 && loc2[1].split(' ').length <= 5) {
      location = loc2[1].trim()
      rest = rest.slice(0, loc2.index).trim()
    }
  }
  rest = rest.replace(/\s+(on|at|for)$/i, '').trim()
  const invitees = knownPeople.filter((p) => p.names.some((n) => new RegExp(`\\b${n}\\b`, 'i').test(rest))).map((p) => p.id)
  const title = rest ? rest.charAt(0).toUpperCase() + rest.slice(1) : 'New Event'
  return {
    title,
    start: when.start,
    end: when.end ?? when.start + HOUR,
    allDay: !!when.allDay,
    location,
    invitees,
  }
}

/** "remind me to bring the percussion bag tomorrow at 7am" → { title, due } */
export function parseReminder(text: string, now = Date.now()): { title: string; due?: number } {
  let t = text
    .replace(/^(hey siri,?\s*)?/i, '')
    .replace(/^(please\s+)?(remind me|set a reminder|create a reminder|add a reminder|add|remember)( to| that| about)?\s*/i, '')
    .replace(/\s+(to|on) (my )?(reminders|reminder list|list)\b/i, '')
    .replace(/[.!]$/, '')
  const when = parseWhen(t, now)
  if (when) t = stripWhen(t, when.spans)
  t = t.replace(/\s+(on|at|by)$/i, '').replace(/\bmy\b/gi, 'my').trim()
  return { title: t ? t.charAt(0).toUpperCase() + t.slice(1) : 'Reminder', due: when?.start }
}

/** Duration in seconds from "10 minutes", "an hour and a half", "90 seconds" */
export function parseDuration(text: string): number | null {
  const t = wordsToNumbers(text.toLowerCase()).replace(/and a half/g, 'and 0.5')
  let total = 0
  let found = false
  const re = /(\d+(?:\.\d+)?)\s*(hours?|hrs?|h|minutes?|mins?|m|seconds?|secs?|s)\b/g
  let m: RegExpExecArray | null
  let lastUnit = 60
  while ((m = re.exec(t))) {
    found = true
    const n = parseFloat(m[1])
    const u = m[2][0] === 'h' ? 3600 : m[2][0] === 'm' ? 60 : 1
    lastUnit = u
    total += n * u
  }
  const half = t.match(/and 0\.5\b/)
  if (half && found) total += 0.5 * lastUnit
  return found ? Math.round(total) : null
}

export function fmtWhen(ts: number, allDay = false, now = Date.now()): string {
  const d = new Date(ts)
  const diff = Math.round((startOfDay(ts) - startOfDay(now)) / DAY)
  const dayStr = diff === 0 ? 'today' : diff === 1 ? 'tomorrow' : diff > 1 && diff < 7 ? WEEKDAYS[d.getDay()] : `${WEEKDAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`
  if (allDay) return dayStr
  let h = d.getHours()
  const ap = h >= 12 ? 'PM' : 'AM'
  h = h % 12 || 12
  return `${dayStr} at ${h}:${String(d.getMinutes()).padStart(2, '0')} ${ap}`
}
