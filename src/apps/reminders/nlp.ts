/* iOS 27 expanded natural-language reminder parsing, layered on the shared parser. */
import { parseReminder } from '../../os/ai/parse'
import { DAY, startOfDay, WEEKDAYS } from '../../os/time'
import type { ReminderList } from '../../os/types'

export type RRepeat = 'daily' | 'weekdays' | 'weekly' | 'monthly' | 'yearly' | `weekly:${number}`

export interface ParsedReminder {
  title: string
  due?: number
  hasTime: boolean
  priority?: 0 | 1 | 2 | 3
  flagged?: boolean
  list?: string
  repeat?: RRepeat
  chips: { kind: 'when' | 'priority' | 'flag' | 'list' | 'repeat'; label: string }[]
}

const at = (base: number, h: number, m = 0) => startOfDay(base) + h * 3_600_000 + m * 60_000

const PHRASES: { re: RegExp; due: (now: number) => number }[] = [
  { re: /\bfirst thing tomorrow( morning)?\b/i, due: (n) => at(n + DAY, 7) },
  { re: /\b(by |at )?(the )?end of (the )?day\b/i, due: (n) => at(n, 17) },
  { re: /\bafter school\b/i, due: (n) => { const t = at(n, 15, 30); return t > n ? t : at(n + DAY, 15, 30) } },
  { re: /\b(at |during )?lunch\b/i, due: (n) => { const t = at(n, 12, 10); return t > n ? t : at(n + DAY, 12, 10) } },
  { re: /\bafter dinner\b/i, due: (n) => { const t = at(n, 19, 30); return t > n ? t : at(n + DAY, 19, 30) } },
  { re: /\bbefore bed\b/i, due: (n) => { const t = at(n, 22, 0); return t > n ? t : at(n + DAY, 22, 0) } },
]

export function fmtDue(ts: number, hasTime = true, now = Date.now()): string {
  const d = new Date(ts)
  const diff = Math.round((startOfDay(ts) - startOfDay(now)) / DAY)
  const day = diff === 0 ? 'Today' : diff === 1 ? 'Tomorrow' : diff === -1 ? 'Yesterday' : diff > 1 && diff < 7 ? WEEKDAYS[d.getDay()] : `${d.getMonth() + 1}/${d.getDate()}/${String(d.getFullYear()).slice(2)}`
  if (!hasTime) return day
  const h = d.getHours() % 12 || 12
  return `${day}, ${h}:${String(d.getMinutes()).padStart(2, '0')} ${d.getHours() >= 12 ? 'PM' : 'AM'}`
}

export function repeatLabel(r?: string): string {
  if (!r) return 'Never'
  if (r === 'daily') return 'Daily'
  if (r === 'weekdays') return 'Weekdays'
  if (r === 'weekly') return 'Weekly'
  if (r === 'monthly') return 'Monthly'
  if (r === 'yearly') return 'Yearly'
  if (r.startsWith('weekly:')) return `Every ${WEEKDAYS[+r.split(':')[1]]}`
  return r
}

export function parseReminderNL(input: string, lists: ReminderList[], now = Date.now()): ParsedReminder {
  let text = input
  const chips: ParsedReminder['chips'] = []
  let priority: ParsedReminder['priority']
  let flagged: boolean | undefined
  let list: string | undefined
  let repeat: RRepeat | undefined
  let due: number | undefined
  let hasTime = false

  // priority: "!!!", "!!", "!" or words
  const bang = text.match(/(^|\s)(!{1,3})(?=\s|$)/)
  if (bang) {
    priority = bang[2].length as 1 | 2 | 3
    text = text.replace(bang[0], ' ')
  } else {
    const w = text.match(/\b(urgent|high priority|important)\b/i)
    if (w) {
      priority = 3
      text = text.replace(w[0], ' ')
    }
  }
  if (priority) chips.push({ kind: 'priority', label: ['', 'Low', 'Medium', 'High'][priority] + ' Priority' })

  // flag
  const fl = text.match(/\b(flag(ged)?( it)?)\b/i)
  if (fl) {
    flagged = true
    text = text.replace(fl[0], ' ')
    chips.push({ kind: 'flag', label: 'Flagged' })
  }

  // list: "#school" or "in/to my groceries list"
  const tag = text.match(/#(\w+)/)
  const inList = text.match(/\b(?:in|to|on) (?:my |the )?(\w+)(?: list)\b/i)
  const listName = tag?.[1] ?? inList?.[1]
  if (listName) {
    const l = lists.find((x) => x.name.toLowerCase().startsWith(listName.toLowerCase()) || x.id === listName.toLowerCase())
    if (l) {
      list = l.id
      text = text.replace((tag ?? inList)![0], ' ')
      chips.push({ kind: 'list', label: l.name })
    }
  }

  // repeat: "every day", "daily", "every Tuesday", "weekly"
  const rep = text.match(/\b(every ?day|daily|every weekday|weekdays|every week|weekly|every month|monthly|every year|yearly|every (sunday|monday|tuesday|wednesday|thursday|friday|saturday))\b/i)
  if (rep) {
    const r = rep[1].toLowerCase()
    if (/day$|daily/.test(r) && !/weekday/.test(r) && !rep[2]) repeat = 'daily'
    else if (/weekday/.test(r)) repeat = 'weekdays'
    else if (rep[2]) repeat = `weekly:${WEEKDAYS.map((d) => d.toLowerCase()).indexOf(rep[2].toLowerCase())}`
    else if (/week/.test(r)) repeat = 'weekly'
    else if (/month/.test(r)) repeat = 'monthly'
    else repeat = 'yearly'
    text = text.replace(rep[0], rep[2] ? ` ${rep[2]} ` : ' ')
    chips.push({ kind: 'repeat', label: repeatLabel(repeat) })
  }

  // contextual time phrases first
  for (const p of PHRASES) {
    const m = text.match(p.re)
    if (m) {
      due = p.due(now)
      hasTime = true
      text = text.replace(m[0], ' ')
      break
    }
  }
  const base = parseReminder(text.replace(/\s{2,}/g, ' ').trim(), now)
  let title = base.title
  if (due === undefined && base.due !== undefined) {
    due = base.due
    hasTime = /\d|noon|midnight|morning|afternoon|evening|tonight|night/i.test(input.replace(title, ''))
  }
  if (due !== undefined) chips.unshift({ kind: 'when', label: fmtDue(due, hasTime, now) })
  title = title.replace(/\s{2,}/g, ' ').replace(/\s+([,.!?])/g, '$1').trim()
  if (!title || title === 'Reminder') title = input.trim() ? title : ''
  return { title, due, hasTime, priority, flagged, list, repeat, chips }
}

// Groceries auto-categories (iOS 17+)
const GROCERY: [string, RegExp][] = [
  ['Produce', /\b(apple|banana|lettuce|spinach|tomato|onion|potato|avocado|berries|fruit|vegetable|carrot|lemon|lime|pepper|garlic)s?\b/i],
  ['Dairy, Eggs & Cheese', /\b(milk|egg|cheese|yogurt|butter|cream)s?\b/i],
  ['Bakery', /\b(bread|bagel|muffin|tortilla|bun)s?\b/i],
  ['Meat', /\b(chicken|beef|turkey|pork|salmon|fish|bacon)\b/i],
  ['Pets', /\b(dog|cat|pet|biscuit|kibble|treats?)\b/i],
  ['Snacks', /\b(chips|cookies?|crackers|popcorn|granola|snack)s?\b/i],
  ['Household', /\b(paper towels?|soap|detergent|batteries|trash bags?|tissues)\b/i],
]
export function groceryCategory(title: string): string {
  for (const [name, re] of GROCERY) if (re.test(title)) return name
  return 'Other'
}
