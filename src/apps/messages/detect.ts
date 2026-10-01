/* Apple Intelligence: contextual suggestions and data detectors for message text. */
import type { Message } from '../../os/types'
import { parseWhen, parseEvent } from '../../os/ai/parse'
import { at } from '../../os/time'

export type Suggestion =
  | { kind: 'reminder'; key: string; label: string; title: string; due: number }
  | { kind: 'note'; key: string; label: string; title: string; text: string }
  | { kind: 'photos'; key: string; label: string; query: string }
  | { kind: 'event'; key: string; label: string; title: string; start: number; end: number; location?: string }

const STOP = new Set(['at', 'the', 'on', 'in', 'from', 'a', 'an', 'of', 'with', 'that', 'those', 'this', 'my', 'our', 'your', 'me', 'us'])

export function suggestionsFor(m: Message, senderFirst: string, now = Date.now()): Suggestion[] {
  const text = m.text
  if (!text || m.from === 'me') return []
  const out: Suggestion[] = []

  // "Can you remind me to bring the percussion bag tomorrow?"
  const rem = text.match(/remind me (?:to|about) (.+?)(?:\?|\.|!|$)/i)
  if (rem) {
    const when = parseWhen(text, now)
    let task = rem[1]
    if (when) for (const s of when.spans) task = task.replace(new RegExp(`\\s*\\b${s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i'), '')
    task = task.replace(/\s+(tomorrow|tonight|today)$/i, '').trim()
    let due = when?.start ?? at(1, 8, 0)
    if (when && !when.hasTime) {
      const d = new Date(when.start)
      d.setHours(8, 0, 0, 0)
      due = d.getTime()
    }
    const title = `Remind ${senderFirst} to ${task}`
    out.push({ kind: 'reminder', key: `${m.id}:reminder`, label: 'Add to Reminders', title, due })
    out.push({ kind: 'note', key: `${m.id}:note`, label: 'Add to Notes', title: `${senderFirst}: ${task}`, text })
    return out
  }

  // "Can you send me that photo of Biscuit at the beach?"
  const ph = text.match(/(?:send|share|text|airdrop)(?: me| us)?(?: that| the| those| a| some)? (?:photo|picture|pic|pics|photos|pictures|video)s? (?:of|from|with) (.+?)(?:\?|\.|!|$|,| to | so | for | want)/i)
  if (ph) {
    const q = ph[1]
      .split(/\s+/)
      .map((w) => w.replace(/[’']s$/i, '').replace(/[^\w’'-]/g, ''))
      .filter((w) => w && !STOP.has(w.toLowerCase()))
      .join(' ')
    if (q) out.push({ kind: 'photos', key: `${m.id}:photos`, label: `Search Photos: ${q}`, query: q })
    return out
  }

  // Events: "Sectionals Saturday 9am in the band room", "Robotics got moved to 6:30 Thursday"
  const hasCue = /\b(mon|tues|wednes|thurs|fri|satur|sun)day\b|\btomorrow\b|\btonight\b|\b\d{1,2}(:\d{2})?\s*(am|pm)\b|\bat \d{1,2}(:\d{2})?\b/i.test(text)
  if (hasCue) {
    const when = parseWhen(text, now)
    if (when && when.hasTime) {
      const ev = parseEvent(text, now)
      const title = cleanTitle(ev?.title ?? '', text)
      const location = ev?.location ?? matchLocation(text)
      out.push({ kind: 'event', key: `${m.id}:event`, label: 'Add to Calendar', title, start: when.start, end: when.end ?? when.start + 3_600_000, location })
    }
  }
  return out
}

function matchLocation(text: string): string | undefined {
  const addr = findAddresses(text)[0]
  if (addr) return addr.text
  const room = text.match(/\b(room \d+|the band room|band room|library|the library)\b/i)
  return room ? room[1].replace(/^the /i, '').replace(/^\w/, (c) => c.toUpperCase()) : undefined
}

function cleanTitle(raw: string, text: string): string {
  const lower = text.toLowerCase()
  if (/sectionals/.test(lower)) return 'Drumline Sectionals'
  if (/robotics/.test(lower)) return 'Robotics'
  if (/dinner/.test(lower)) return /grandma/.test(lower) ? 'Dinner at Grandma’s' : 'Dinner'
  if (/study/.test(lower)) return 'Study group'
  if (/pick up (\w+)/i.test(text)) return `Pick up ${text.match(/pick up (\w+)/i)![1]}`
  const t = raw
    .replace(/^(can you|could you|will you|did you|are you|do you|hey|so|also|ok|omg)\s+/i, '')
    .replace(/\b(got )?(moved|changed) to\b/i, '')
    .replace(/[?!.]+$/, '')
    .trim()
  return t.length > 2 && t.length < 40 ? t.charAt(0).toUpperCase() + t.slice(1) : 'New Event'
}

// ---------------------------------------------------------------------------
// Data detectors

export type Span = { text: string; kind: 'text' | 'date' | 'address' | 'phone' | 'url' | 'flight' }

const ADDRESS = /\b\d{2,5}\s+(?:[A-Z][\w’']*\s){1,3}(?:Dr|Drive|St|Street|Ave|Avenue|Ln|Lane|Rd|Road|Blvd|Way|Ct|Plaza)\b\.?(?:,\s*[A-Z][a-z]+(?:\s[A-Z][a-z]+)?)?/g
const PHONE = /\(\d{3}\)\s?\d{3}-\d{4}|\b\d{3}[-.\s]\d{3}[-.\s]\d{4}\b/g
const URL = /\b(?:https?:\/\/)?[a-z0-9-]+\.(?:example|com|org|net|io)(?:\/[\w\-./]*)?/gi
const FLIGHT = /\b(?:SK|AA|UA|DL)\s?\d{2,4}\b/g
const DATE =
  /\b(?:(?:this|next)\s+)?(?:mon|tues|wednes|thurs|fri|satur|sun)day(?:\s+(?:at\s+)?\d{1,2}(?::\d{2})?\s*(?:am|pm)?)?|\b\d{1,2}:\d{2}\s*(?:am|pm)?(?:\s+(?:today|tomorrow|tonight|(?:mon|tues|wednes|thurs|fri|satur|sun)day))?|\b\d{1,2}\s*(?:am|pm)\b|\btomorrow\b|\btonight\b|\bat \d{1,2}(?=\s+today|!|\s*$|\?)(?:\s+today)?|\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.? \d{1,2}\b/gi

function findAll(re: RegExp, text: string, kind: Span['kind']) {
  const out: { start: number; end: number; kind: Span['kind'] }[] = []
  re.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    if (!m[0]) {
      re.lastIndex++
      continue
    }
    out.push({ start: m.index, end: m.index + m[0].length, kind })
  }
  return out
}

export function findAddresses(text: string) {
  return findAll(ADDRESS, text, 'address').map((r) => ({ ...r, text: text.slice(r.start, r.end) }))
}

export function detectSpans(text: string): Span[] {
  const found = [
    ...findAll(ADDRESS, text, 'address'),
    ...findAll(PHONE, text, 'phone'),
    ...findAll(URL, text, 'url'),
    ...findAll(FLIGHT, text, 'flight'),
    ...findAll(DATE, text, 'date'),
  ].sort((a, b) => a.start - b.start || b.end - a.end)
  const spans: Span[] = []
  let i = 0
  for (const f of found) {
    if (f.start < i) continue
    if (f.start > i) spans.push({ text: text.slice(i, f.start), kind: 'text' })
    spans.push({ text: text.slice(f.start, f.end), kind: f.kind })
    i = f.end
  }
  if (i < text.length) spans.push({ text: text.slice(i), kind: 'text' })
  return spans
}

/** Is the message only emoji (renders jumbo, without a bubble)? */
export function isJumboEmoji(text?: string) {
  if (!text) return false
  const t = text.replace(/\s/g, '')
  if (!t || t.length > 12) return false
  return /^(\p{Extended_Pictographic}|\p{Emoji_Modifier}|‍|️)+$/u.test(t)
}
