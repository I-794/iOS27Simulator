/* Siri: structured intent handling over the simulated personal data.
 *
 * Input → normalization → skill scoring (patterns + entity signals) → the best
 * skill extracts entities (people, dates, places, apps) and runs composable
 * actions against the OS store. Multi-clause requests are split into steps.
 * Conversation memory lets follow-ups like "add it to my calendar" resolve. */
import type { AppId, SiriCard } from '../types'
import { useOS, uid, isAppAllowed } from '../store'
import { CONTACTS, contactById, contactName } from '../data/people'
import { TRACKS, PLAYLISTS, ARTISTS } from '../data/media'
import { WEATHER, MAP_PLACES, HOME_SCENES, FINDMY, SCREEN_TIME_USAGE } from '../data/world'
import { CAMERA_CLIPS } from '../data/photos'
import { ICONS } from '../../icons/AppIconArt'
import { search, searchPhotos, tokens, SETTINGS_INDEX } from '../search'
import { parseWhen, parseEvent, parseReminder, parseDuration, fmtWhen, wordsToNumbers } from './parse'
import { draft, summarize, rewrite } from './writing'
import { lookupFact, mathAnswer, translate } from './knowledge'
import { insightFor, answerAbout } from './vision'
import { DAY, HOUR, MIN, fmtTime, startOfDay, WEEKDAYS, dayLabel } from '../time'

export interface SiriResult {
  text: string
  cards?: SiriCard[]
  followUps?: string[]
  open?: { app: AppId; route?: string }
  intent: string
}

interface Memory {
  lastIntent?: string
  lastQuery?: string
  event?: { title: string; start: number; end?: number; location?: string }
  contact?: string
  photoIds?: string[]
  draft?: { to?: string; body: string; app: 'messages' | 'mail'; subject?: string }
  place?: string
}

const memories = new Map<string, Memory>()
const mem = (id: string) => {
  if (!memories.has(id)) memories.set(id, {})
  return memories.get(id)!
}

interface Q {
  raw: string
  l: string
  toks: string[]
  convId: string
  m: Memory
  onscreen: ReturnType<typeof useOS.getState>['siriOnscreen']
}

type Skill = { id: string; score: (q: Q) => number; run: (q: Q) => SiriResult }

const S = () => useOS.getState()

// ---------------------------------------------------------------- entities
export function findContact(text: string): string | undefined {
  const l = ` ${text.toLowerCase()} `
  let best: { id: string; len: number } | undefined
  for (const c of CONTACTS) {
    const names = [c.first, c.last, c.nickname, [c.first, c.last].filter(Boolean).join(' '), c.relation === 'mother' ? 'mom' : '', c.relation === 'father' ? 'dad' : '', c.relation === 'grandmother' ? 'grandma' : '', c.relation === 'sister' ? 'my sister' : '']
      .filter(Boolean)
      .map((n) => n!.toLowerCase())
    for (const n of names) {
      if (n.length < 2) continue
      const re = new RegExp(`[^a-z]${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:'s|’s)?[^a-z]`)
      if (re.test(l) && (!best || n.length > best.len)) best = { id: c.id, len: n.length }
    }
  }
  return best?.id
}

function findApp(text: string): AppId | undefined {
  const l = text.toLowerCase()
  let best: { id: AppId; len: number } | undefined
  for (const [id, spec] of Object.entries(ICONS)) {
    const n = spec.name.toLowerCase()
    if (new RegExp(`\\b${n}\\b`).test(l) && (!best || n.length > best.len)) best = { id: id as AppId, len: n.length }
  }
  if (!best && /\bplayground\b/.test(l)) return 'playground'
  if (!best && /\bappointments?\b/.test(l)) return undefined
  return best?.id
}

const people = () => CONTACTS.map((c) => ({ id: c.id, names: [c.first, c.nickname ?? ''].filter(Boolean) }))

function eventCard(id: string): SiriCard {
  return { type: 'event', eventId: id }
}

function addEventFrom(title: string, start: number, end?: number, location?: string, source = 'Siri'): string {
  return S().addEvent({ title, start, end: end ?? start + HOUR, location, calendar: 'personal', source })
}

function eventExists(title: string, start: number) {
  const tl = title.toLowerCase()
  return S().events.find((e) => Math.abs(e.start - start) < 2 * HOUR && (e.title.toLowerCase().includes(tl.split(' ')[0]) || tl.includes(e.title.toLowerCase().split(' ')[0])))
}

/** Pull an event out of message/mail text (title, time, address). */
function eventFromTexts(texts: string[]): { title: string; start: number; location?: string } | null {
  let start: number | undefined
  let title: string | undefined
  let location: string | undefined
  for (const t of texts) {
    const addr = t.match(/\b\d{2,5} [A-Z][\w]+(?: [A-Z][\w]+)* (?:St|Street|Dr|Drive|Ave|Avenue|Rd|Road|Lane|Ln|Blvd|Way)\b\.?(?:,? [A-Z][\w]+(?: [A-Z][\w]+)?)?/)
    if (addr && !location) location = addr[0]
    const w = parseWhen(t)
    if (w && !start) {
      start = w.start
      const m = t.match(/\b((?:dinner|lunch|breakfast|party|meeting|practice|study group|sectionals|robotics|concert|game|movie|appointment)[^.!?,]*)/i)
      title = m ? m[1].replace(/\s+(on|at|this|next)\b.*$/i, '').trim() : undefined
    }
  }
  if (!start) return null
  return { title: title ? title[0].toUpperCase() + title.slice(1) : 'New Event', start, location }
}

function onscreenTexts(q: Q): { texts: string[]; from?: string; kind?: string } {
  const e = q.onscreen.entity ?? {}
  const st = S()
  if (e.type === 'conversation' && e.convId) {
    const conv = st.conversations.find((c) => c.id === e.convId)
    if (conv) {
      const incoming = conv.messages.filter((m) => m.from !== 'me' && m.text).slice(-4)
      return { texts: incoming.map((m) => m.text!).reverse(), from: incoming[incoming.length - 1]?.from, kind: 'conversation' }
    }
  }
  if (e.type === 'mail' && e.mailId) {
    const m = st.mails.find((x) => x.id === e.mailId)
    if (m) return { texts: [m.subject, m.body], from: undefined, kind: 'mail' }
  }
  if (e.type === 'page' && e.text) return { texts: [e.title ?? '', e.text], kind: 'page' }
  if (e.type === 'note' && e.text) return { texts: [e.title ?? '', e.text], kind: 'note' }
  if (q.onscreen.context) return { texts: [q.onscreen.context], kind: 'context' }
  return { texts: [] }
}

// ---------------------------------------------------------------- skills
const has = (q: Q, re: RegExp) => (re.test(q.l) ? 1 : 0)

const skills: Skill[] = [
  // ---------- timers & alarms ----------
  {
    id: 'timer',
    score: (q) => has(q, /\btimer\b/) * 0.9 + has(q, /\b(set|start)\b/) * 0.1,
    run: (q) => {
      const st = S()
      if (/\b(cancel|stop|delete)\b/.test(q.l)) {
        st.timers.forEach((t) => st.endActivity(`timer-${t.id}`))
        st.set({ timers: [] })
        return { text: 'Okay, I canceled your timer.', intent: 'timer' }
      }
      if (/\bhow (much|long)\b|left|remaining/.test(q.l)) {
        const t = st.timers.find((x) => x.running && x.endsAt)
        if (!t) return { text: 'You don’t have any timers running.', intent: 'timer' }
        const s = Math.round((t.endsAt! - Date.now()) / 1000)
        return { text: `There’s ${Math.floor(s / 60)} minutes and ${s % 60} seconds left on your ${t.label.toLowerCase()} timer.`, intent: 'timer' }
      }
      const secs = parseDuration(q.l) ?? 300
      const label = q.raw.match(/\bfor (?:the )?([a-z ]+?)(?: for| timer|$)/i)?.[1]?.trim()
      startTimer(secs, label && !/\d/.test(label) ? label : 'Timer')
      return { text: `${fmtSecs(secs)} — counting down.`, cards: [{ type: 'timer', seconds: secs }], intent: 'timer' }
    },
  },
  {
    id: 'alarm',
    score: (q) => has(q, /\balarm\b/) * 0.9 + has(q, /\bwake me( up)?\b/) * 0.9,
    run: (q) => {
      const w = parseWhen(q.l.replace(/wake me( up)?/, ''))
      if (!w || !w.hasTime) return { text: 'What time should I set the alarm for?', intent: 'alarm', followUps: ['6:30 AM', '7 AM tomorrow'] }
      const d = new Date(w.start)
      let h = d.getHours()
      // alarms said without am/pm in the morning context
      if (!/pm|evening|tonight/.test(q.l) && h >= 12 && h < 20 && /wake|morning|am\b/.test(q.l)) h -= 12
      const id = uid('al')
      const st = S()
      st.set({ alarms: [...st.alarms, { id, hour: h, minute: d.getMinutes(), label: 'Alarm', enabled: true, repeat: [], sound: 'Radial', snooze: true }] })
      const vol = Math.round(st.alarmVolume * 100)
      return { text: `Your alarm is set for ${fmtTime(new Date(0, 0, 0, h, d.getMinutes()).getTime())}. It’ll ring at ${vol}% alarm volume${st.alarmVolumeSeparate ? ', separate from your ringer volume' : ''}.`, cards: [{ type: 'alarm', alarmId: id }], intent: 'alarm' }
    },
  },

  // ---------- reminders ----------
  {
    id: 'reminder',
    score: (q) => has(q, /\bremind (me|us|him|her|them|\w+)\b/) * 0.95 + has(q, /\breminders?\b/) * 0.7 + has(q, /\bdon'?t let me forget\b/) * 0.9,
    run: (q) => {
      const st = S()
      // onscreen: "add this to reminders" / "remind me about this"
      if (/\b(this|that|it)\b/.test(q.l) && !/remind me to\b/.test(q.l)) {
        const ot = onscreenTexts(q)
        const ask = ot.texts.find((t) => /remind|bring|don'?t forget|pick up|return|order/i.test(t))
        if (ask) {
          const who = ot.from ? contactName(ot.from) : undefined
          const r = parseReminder(ask.replace(/^.*?(remind me to|can you remind me to|don'?t forget to)\s*/i, 'remind me to ').replace(/\?.*$/, ''))
          const title = who && /remind me/i.test(ask) ? `Remind ${who} to ${r.title.charAt(0).toLowerCase()}${r.title.slice(1)}` : r.title
          const id = st.addReminder({ title, due: r.due ?? startOfDay() + DAY + 8 * HOUR, list: 'reminders', source: ot.kind })
          q.m.lastIntent = 'reminder'
          return { text: `Added “${title}” to Reminders${r.due ? ` for ${fmtWhen(r.due)}` : ' for tomorrow morning'}.`, cards: [{ type: 'reminder', reminderId: id }], intent: 'reminder' }
        }
        if (q.m.event) {
          const due = q.m.event.start - HOUR
          const id = st.addReminder({ title: q.m.event.title, due, list: 'reminders' })
          return { text: `I’ll remind you about ${q.m.event.title} ${fmtWhen(due)}, an hour before.`, cards: [{ type: 'reminder', reminderId: id }], intent: 'reminder' }
        }
      }
      // "remind me an hour before" follow-up
      const before = q.l.match(/(\d+|an?|one)\s*(hour|minute|min)s? before/)
      if (before && q.m.event) {
        const n = /an?|one/.test(before[1]) ? 1 : +before[1]
        const due = q.m.event.start - n * (before[2].startsWith('h') ? HOUR : MIN)
        const id = st.addReminder({ title: q.m.event.title, due, list: 'reminders' })
        return { text: `Okay, I’ll remind you ${fmtWhen(due)}.`, cards: [{ type: 'reminder', reminderId: id }], intent: 'reminder' }
      }
      const r = parseReminder(q.raw)
      const list = /\b(milk|eggs|bread|groceries|grocery|dog food|buy)\b/.test(q.l) ? 'groceries' : /\b(robot|robotics|zip ties|cad)\b/.test(q.l) ? 'robotics' : /\b(homework|chem|test|essay|study|lab)\b/.test(q.l) ? 'school' : 'reminders'
      const id = st.addReminder({ title: r.title, due: r.due, list })
      return { text: r.due ? `Okay, I’ll remind you ${fmtWhen(r.due)}.` : `Added “${r.title}” to your ${list === 'reminders' ? 'Reminders' : list[0].toUpperCase() + list.slice(1)} list.`, cards: [{ type: 'reminder', reminderId: id }], intent: 'reminder' }
    },
  },

  // ---------- calendar: create ----------
  {
    id: 'event',
    score: (q) =>
      has(q, /\b(add|put|schedule|create|book|set up|make)\b/) * 0.35 +
      has(q, /\b(calendar|event|meeting|appointment)\b/) * 0.5 +
      has(q, /\b(schedule|book)\b/) * 0.2 +
      (parseWhen(q.l) && /\b(add|schedule|put|create|book)\b/.test(q.l) ? 0.2 : 0) -
      has(q, /\bremind\b/) * 0.6 -
      has(q, /\b(what|when|which)\b/) * 0.5,
    run: (q) => {
      const st = S()
      // onscreen / follow-up references
      if (/\b(this|that|it)\b/.test(q.l) && !parseWhen(q.l.replace(/\b(this|that|it)\b/g, ''))) {
        const e = q.onscreen.entity ?? {}
        if (e.type === 'mail' && e.mailId) {
          const mail = st.mails.find((m) => m.id === e.mailId)
          const f = mail?.facts
          if (f?.when) {
            const [d, hm] = f.when.split('|')
            const [h, mi] = hm.split(':').map(Number)
            const start = startOfDay() + +d * DAY + h * HOUR + mi * MIN
            const ex = eventExists(f.title ?? mail!.subject, start)
            if (ex) return { text: `“${ex.title}” is already on your calendar ${fmtWhen(ex.start)}.`, cards: [eventCard(ex.id)], intent: 'event' }
            const id = addEventFrom(f.title ?? mail!.subject, start, start + 2 * HOUR, f.location, 'Mail')
            q.m.event = { title: f.title ?? mail!.subject, start, location: f.location }
            return { text: `Added “${f.title}” ${fmtWhen(start)}${f.location ? ` at ${f.location}` : ''}.`, cards: [eventCard(id)], intent: 'event', followUps: ['Remind me an hour before', 'Get directions'] }
          }
        }
        const ot = onscreenTexts(q)
        const ev = ot.texts.length ? eventFromTexts(ot.texts) : null
        if (ev) {
          const ex = eventExists(ev.title, ev.start)
          if (ex) return { text: `“${ex.title}” is already on your calendar ${fmtWhen(ex.start)}.`, cards: [eventCard(ex.id)], intent: 'event' }
          const id = addEventFrom(ev.title, ev.start, ev.start + 2 * HOUR, ev.location, 'Messages')
          q.m.event = ev
          return { text: `Done — “${ev.title}” is on your calendar ${fmtWhen(ev.start)}${ev.location ? ` at ${ev.location}` : ''}.`, cards: [eventCard(id)], intent: 'event', followUps: ['Remind me an hour before', 'Get directions'] }
        }
        if (q.m.event) {
          const ex = eventExists(q.m.event.title, q.m.event.start)
          if (ex) return { text: `It’s already on your calendar ${fmtWhen(ex.start)}.`, cards: [eventCard(ex.id)], intent: 'event' }
          const id = addEventFrom(q.m.event.title, q.m.event.start, q.m.event.end, q.m.event.location)
          return { text: `Added it to your calendar ${fmtWhen(q.m.event.start)}.`, cards: [eventCard(id)], intent: 'event' }
        }
        return { text: 'I don’t see an event on screen. What should I add, and when?', intent: 'event' }
      }
      const ev = parseEvent(q.raw, Date.now(), people())
      if (!ev) return { text: 'When is it? You can say something like “Dinner with Sam next Friday at 6:30 at Rosa’s.”', intent: 'event' }
      const id = st.addEvent({ title: ev.title, start: ev.start, end: ev.end, allDay: ev.allDay, location: ev.location, calendar: 'personal', invitees: ev.invitees, source: 'Siri' })
      q.m.event = { title: ev.title, start: ev.start, end: ev.end, location: ev.location }
      const clash = st.events.find((e) => e.id !== id && e.start < ev.end && e.end > ev.start && !e.allDay)
      return {
        text: `Scheduled “${ev.title}” ${fmtWhen(ev.start, ev.allDay)}${ev.location ? ` at ${ev.location}` : ''}.${clash ? ` Heads up: it overlaps with ${clash.title}.` : ''}`,
        cards: [eventCard(id)],
        intent: 'event',
        followUps: [ev.invitees.length ? `Text ${contactName(ev.invitees[0])} the details` : 'Invite someone', 'Remind me an hour before'],
      }
    },
  },

  // ---------- personal context questions ----------
  {
    id: 'context',
    score: (q) =>
      has(q, /^(when|what time|what day|which day|where|what'?s|what is|what was|did|do i|am i|is there|how many)\b/) * 0.45 +
      has(q, /\b(my|i|alex|mom|dad|sam|priya|mia|grandma|leo|nora|robotics|meeting|practice|dinner|flight|dentist|concert|appointment|package|order|confirmation|reservation|test|study group|sectionals|schedule|calendar|free)\b/) * 0.45 +
      has(q, /\b(say|said|mention|told|text|send|sent|email)\b/) * 0.15 -
      has(q, /\b(weather|rain|umbrella|temperature|forecast)\b/) * 0.5 -
      has(q, /\b(photo|picture|pic)s?\b/) * 0.4 -
      has(q, /\b(this|that)\b.*\b(is|about)\b/) * 0.2,
    run: (q) => personalContext(q),
  },

  // ---------- messages ----------
  {
    id: 'send_message',
    score: (q) =>
      has(q, /^(text|message|imessage|tell|send (a )?(message|text|imessage)|reply( to)?|let)\b/) * 0.85 +
      has(q, /\bsend (it|this|that)\b/) * 0.5 +
      has(q, /\b(text|message) (\w+)\b/) * 0.3 -
      has(q, /\bemail\b/) * 0.7,
    run: (q) => sendMessageSkill(q),
  },
  {
    id: 'email',
    score: (q) => has(q, /\b(write|draft|compose|send|reply)\b/) * 0.35 + has(q, /\b(email|e-mail|mail)\b/) * 0.55 - has(q, /\b(find|search|show|when|what|summari)\b/) * 0.5,
    run: (q) => {
      const to = findContact(q.raw)
      const d = draft(q.raw.replace(/^(write|draft|compose|send)( an?)? (email|e-mail)( to)?/i, ''), to, 'mail')
      q.m.draft = { to, body: d.body, app: 'mail', subject: d.subject }
      return { text: `Here’s a draft${to ? ` to ${contactName(to, 'full')}` : ''}. I matched a ${contactById(to ?? '')?.tone === 'teacher' ? 'respectful' : 'friendly'} tone. Want to send it?`, cards: [{ type: 'draft', to, body: d.body, app: 'mail', subject: d.subject }], intent: 'email', followUps: ['Make it shorter', 'Make it more formal', 'Send it'] }
    },
  },
  {
    id: 'write',
    score: (q) => has(q, /\b(write|draft|help me write|compose)\b/) * 0.6 + has(q, /\b(note|message|text|poem|thank.you|card|caption|reply)\b/) * 0.25 - has(q, /\bemail\b/) * 0.5 - has(q, /\bmake (a )?note\b/) * 0.4,
    run: (q) => {
      const to = findContact(q.raw)
      const body = /\bpoem\b/.test(q.l)
        ? 'Paws on the sand at the end of the day,\nBiscuit chases the waves as they play.\nGolden fur and a salt-sprayed nose —\nhappiest dog wherever she goes.'
        : draft(q.raw.replace(/^(help me )?(write|draft|compose)( a| an)?/i, ''), to).body
      q.m.draft = { to, body, app: 'messages' }
      return { text: to ? `Here’s something for ${contactName(to)} in your usual style:` : 'Here’s a draft:', cards: [{ type: 'draft', to, body, app: 'messages' }], intent: 'write', followUps: ['Make it shorter', 'Make it more friendly', to ? 'Send it' : 'Copy'] }
    },
  },
  {
    id: 'revise',
    score: (q) => (q.m.draft ? has(q, /\b(make it|shorter|longer|more (formal|friendly|casual|professional)|proofread|rewrite|change)\b/) * 0.95 : 0) + has(q, /\b(proofread|rewrite) (this|that|my)\b/) * 0.7,
    run: (q) => {
      let body = q.m.draft?.body ?? onscreenTexts(q).texts.join('\n')
      if (!body) return { text: 'What text should I work on?', intent: 'revise' }
      const tone = /short|concise|brief/.test(q.l) ? 'concise' : /formal|professional/.test(q.l) ? 'professional' : /friend|casual|warm/.test(q.l) ? 'friendly' : /excit/.test(q.l) ? 'excited' : 'rewrite'
      body = /proofread/.test(q.l) ? rewrite(body, 'rewrite') : rewrite(body, tone, q.m.draft?.to)
      if (q.m.draft) q.m.draft.body = body
      return { text: 'Here’s the updated version:', cards: [{ type: 'draft', to: q.m.draft?.to, body, app: q.m.draft?.app ?? 'messages', subject: q.m.draft?.subject }], intent: 'revise', followUps: ['Send it'] }
    },
  },
  {
    id: 'send_draft',
    score: (q) => (q.m.draft ? has(q, /^(send( it| this)?|yes,? send|go ahead|looks good)\b/) * 1.1 : 0),
    run: (q) => {
      const d = q.m.draft!
      doSend(d)
      q.m.draft = undefined
      return { text: `Sent${d.to ? ` to ${contactName(d.to)}` : ''}.`, cards: [{ type: 'draft', ...d, sent: true }], intent: 'send_draft' }
    },
  },

  // ---------- onscreen ----------
  {
    id: 'summarize',
    score: (q) => has(q, /\b(summari[sz]e|summary|tl;?dr|recap|key points)\b/) * 0.95 + has(q, /\bwhat('s| is) (this|the) (page|article|email|thread) about\b/) * 0.9,
    run: (q) => {
      if (/\bnotification/.test(q.l)) {
        const n = S().notifications.slice(0, 6)
        if (!n.length) return { text: 'You’re all caught up — no notifications.', intent: 'summarize' }
        return { text: `You have ${n.length} recent notifications: ${n.map((x) => `${x.title} — ${x.body.slice(0, 50)}`).join('; ')}.`, intent: 'summarize' }
      }
      const ot = onscreenTexts(q)
      const src = ot.texts.join('. ')
      if (!src.trim()) {
        const e = q.onscreen.entity
        return { text: `There isn’t much text on screen to summarize${e?.type === 'photo' ? ' — want me to describe this photo instead?' : '.'}`, intent: 'summarize', followUps: e?.type === 'photo' ? ['What is this?'] : undefined }
      }
      const where = ot.kind === 'page' ? 'this page' : ot.kind === 'mail' ? 'this email' : ot.kind === 'conversation' ? 'this conversation' : 'this'
      return { text: `Here’s a summary of ${where}: ${summarize(src)}`, intent: 'summarize', followUps: ot.kind === 'page' ? ['Save it to Notes', 'Read it to me'] : ['Reply', 'Add to Calendar'] }
    },
  },
  {
    id: 'what_is_this',
    score: (q) => has(q, /\b(what('s| is) (this|that|in this)|who('s| is) (this|that)|describe (this|the) (photo|picture|image|screen)|what am i looking at|identify this|read (this|it))\b/) * 0.95,
    run: (q) => {
      const e = q.onscreen.entity ?? {}
      if ((e.type === 'photo' || e.type === 'camera') && e.scene) {
        const p = e.photoId ? S().photos.find((x) => x.id === e.photoId) : undefined
        const ins = insightFor(e.scene, p?.description)
        const meta = p ? ` Taken ${dayLabel(p.ts).toLowerCase() === 'today' ? 'today' : `on ${new Date(p.ts).toLocaleDateString(undefined, { month: 'long', day: 'numeric' })}`}${p.place ? ` at ${p.place}` : ''}.` : ''
        return { text: `${answerAbout(e.scene, q.l, p?.description)}${meta}`, cards: ins.details.length ? [{ type: 'info', title: ins.label, rows: ins.details }] : undefined, intent: 'what_is_this', followUps: ins.actions.slice(0, 2).map((a) => a.label) }
      }
      if (e.type === 'page') return { text: `You’re on “${e.title}”. ${summarize(e.text ?? '')}`, intent: 'what_is_this' }
      if (e.type === 'conversation') {
        const ot = onscreenTexts(q)
        return { text: `This is your conversation with ${e.name}. The latest message says: “${ot.texts[0] ?? ''}”`, intent: 'what_is_this' }
      }
      const app = q.onscreen.app
      return { text: app ? `You’re in ${ICONS[app].name}. ${q.onscreen.context ?? ''}` : 'You’re on the Home Screen.', intent: 'what_is_this' }
    },
  },

  // ---------- photos ----------
  {
    id: 'photos',
    score: (q) => has(q, /\b(photos?|pictures?|pics?|videos?|screenshots?|selfies?)\b/) * 0.6 + has(q, /\b(show|find|search|get|pull up|look for)\b/) * 0.3 - has(q, /\bsend\b/) * 0.2 - has(q, /\b(take|shoot)\b/) * 0.6,
    run: (q) => {
      const query = q.l.replace(/^(hey siri,?\s*)?(show|find|search( for)?|get|pull up|look for)( me)?( all)?( my| the)?\s*/, '').replace(/\b(photos?|pictures?|pics?)\s*(of|from|with|at)?\s*/g, ' ').trim()
      const res = searchPhotos(query || 'favorites')
      q.m.photoIds = res.map((p) => p.id)
      if (!res.length) return { text: `I couldn’t find photos matching “${query}”.`, intent: 'photos' }
      return { text: `Here ${res.length === 1 ? 'is 1 photo' : `are ${res.length} photos`} ${query ? `matching “${query}”` : ''}.`, cards: [{ type: 'photos', photoIds: res.slice(0, 9).map((p) => p.id), title: query }], intent: 'photos', followUps: ['Send them to Dad', 'Make a slideshow'], open: undefined }
    },
  },

  // ---------- music ----------
  {
    id: 'music',
    score: (q) => has(q, /^(play|pause|resume|stop|skip|next song|previous song|shuffle)\b/) * 0.9 + has(q, /\b(music|song|album|playlist|artist)\b/) * 0.3 - has(q, /\bpodcast\b/) * 0.3,
    run: (q) => {
      const st = S()
      if (/^(pause|stop)\b/.test(q.l)) {
        if (st.nowPlaying.playing) st.togglePlay()
        return { text: 'Paused.', intent: 'music' }
      }
      if (/^(resume|keep playing)\b/.test(q.l)) {
        if (!st.nowPlaying.playing) st.togglePlay()
        return { text: 'Resuming.', cards: [{ type: 'music', trackId: st.nowPlaying.trackId }], intent: 'music' }
      }
      if (/^(skip|next)\b/.test(q.l)) {
        st.nextTrack()
        return { text: 'Skipping ahead.', cards: [{ type: 'music', trackId: S().nowPlaying.trackId }], intent: 'music' }
      }
      const what = q.l.replace(/^play\s*(some|me|the|my)?\s*/, '')
      const pl = PLAYLISTS.find((p) => what.includes(p.name.toLowerCase()) || (/\b(study|focus|homework|concentrate)\b/.test(what) && p.id === 'pl-focus') || (/\b(build|hype|pump|energy|workout)\b/.test(what) && p.id === 'pl-drive') || (/\b(chill|relax|sunset)\b/.test(what) && p.id === 'pl-chill'))
      const track = TRACKS.find((t) => what.includes(t.title.toLowerCase()))
      const artist = ARTISTS.find((a) => what.includes(a.name.toLowerCase()))
      if (track) {
        st.playTrack(track.id, TRACKS.map((t) => t.id))
        return { text: `Playing “${track.title}” by ${track.artist}.`, cards: [{ type: 'music', trackId: track.id }], intent: 'music' }
      }
      if (artist) {
        const list = TRACKS.filter((t) => t.artist === artist.name).map((t) => t.id)
        st.playTrack(list[0], list)
        return { text: `Playing ${artist.name}.`, cards: [{ type: 'music', trackId: list[0] }], intent: 'music' }
      }
      const p = pl ?? PLAYLISTS[2]
      st.playTrack(p.tracks[0], p.tracks, p.name)
      return { text: `Here’s your ${p.name} playlist${st.automix ? ', with AutoMix transitions' : ''}.`, cards: [{ type: 'music', trackId: p.tracks[0] }], intent: 'music' }
    },
  },

  // ---------- home ----------
  {
    id: 'home_camera',
    score: (q) =>
      has(q, /\b(camera|cameras|clip|footage|recording|front door|driveway|backyard)\b/) * 0.45 +
      has(q, /\b(package|delivery|delivered|someone|visitor|car|raccoon|deer|animal|dog|mail carrier)\b/) * 0.35 +
      has(q, /\b(when|show me|was|did|left|come|came)\b/) * 0.2 -
      has(q, /\b(photos?|pictures?)\b/) * 0.3,
    run: (q) => {
      const hits = search(q.l.replace(/\b(show me|when|was|a|the|at|did|left|find)\b/g, ' '), { types: ['camera'], limit: 5 })
      const cam = /front door/.test(q.l) ? 'Front Door' : /driveway/.test(q.l) ? 'Driveway' : /backyard/.test(q.l) ? 'Backyard' : null
      const filtered = hits.filter((h) => !cam || h.title.startsWith(cam))
      const best = filtered[0]
      if (!best) return { text: 'I didn’t find any matching camera events in the last 10 days.', intent: 'home_camera' }
      const clip = CAMERA_CLIPS.find((c) => `cam-${c.id}` === best.id)!
      return {
        text: `${clip.camera} camera, ${dayLabel(clip.ts).toLowerCase() === 'yesterday' ? 'yesterday' : dayLabel(clip.ts)} at ${fmtTime(clip.ts)}: ${clip.description}`,
        cards: [{ type: 'camera', clipId: clip.id }, ...filtered.slice(1, 3).map((h) => ({ type: 'camera' as const, clipId: h.id.slice(4) }))],
        intent: 'home_camera',
        open: { app: 'home', route: `clip/${clip.id}` },
      }
    },
  },
  {
    id: 'home_control',
    score: (q) =>
      has(q, /\b(turn|switch|set|dim|brighten)\b/) * 0.3 +
      has(q, /\b(lights?|lamp|fan|thermostat|heat|ac|porch|pendants|led strip|coffee maker|tv|degrees)\b/) * 0.6 +
      has(q, /\b(lock|unlock)\b.*\b(door|garage)\b/) * 0.9 +
      has(q, /\b(good night|good morning|leave home|arrive home|study mode)\b/) * 0.8 -
      has(q, /\bflashlight\b/) * 0.8,
    run: (q) => homeControl(q),
  },

  // ---------- settings / device ----------
  {
    id: 'settings',
    score: (q) =>
      has(q, /\b(turn|switch|enable|disable|set|make|increase|decrease|lower|raise)\b/) * 0.3 +
      has(q, /\b(wi-?fi|bluetooth|dark mode|light mode|airplane mode|low power|flashlight|torch|do not disturb|focus|night shift|true tone|hotspot|brightness|volume|glass|transparen\w*|tinted|clearer|silent|ringer|alarm volume|reduce motion|voiceover)\b/) * 0.65 +
      has(q, /\bopen (\w+ )?settings\b/) * 0.9,
    run: (q) => settingsSkill(q),
  },
  {
    id: 'device',
    score: (q) => has(q, /\b(battery|what time is it|what'?s the time|what'?s the date|what day is (it|today)|screen time)\b/) * 0.85,
    run: (q) => {
      const st = S()
      if (/battery/.test(q.l)) return { text: `Your iPhone is at ${Math.round(st.battery * 100)}%${st.charging ? ' and charging' : ''}. ${st.lowPower ? 'Low Power Mode is on.' : 'At your usual usage that’s about 9 hours left.'} Your AirPods are at ${Math.min(st.airpods.battery.l, st.airpods.battery.r)}%.`, cards: [{ type: 'setting', label: 'Battery', route: 'battery' }], intent: 'device' }
      if (/screen time/.test(q.l)) return { text: `Your daily average is ${Math.floor(SCREEN_TIME_USAGE.dailyAverage / 60)}h ${SCREEN_TIME_USAGE.dailyAverage % 60}m. Messages is your most-used app at 52 minutes a day.`, cards: [{ type: 'setting', label: 'Screen Time', route: 'screentime' }], intent: 'device' }
      if (/date|day is/.test(q.l)) return { text: `It’s ${new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}.`, intent: 'device' }
      return { text: `It’s ${fmtTime(Date.now())}.`, intent: 'device' }
    },
  },

  // ---------- apps ----------
  {
    id: 'voice_memo',
    score: (q) =>
      has(q, /\b(record|start|begin|take|make|new|capture)\b.*\bvoice (memo|note|recording)s?\b/) * 0.96 +
      has(q, /^(record|start recording)\b.*\b(memo|audio|this|lecture|class|meeting|me|myself)\b/) * 0.9 -
      has(q, /\b(screen|video)\b/) * 0.9,
    run: () => {
      const allowed = isAppAllowed('voicememos')
      if (!allowed.allowed) return { text: `Voice Memos isn’t available right now. ${allowed.reason}`, intent: 'voice_memo' }
      return { text: 'Recording a new voice memo.', open: { app: 'voicememos', route: 'record' }, intent: 'voice_memo' }
    },
  },
  {
    id: 'open_app',
    score: (q) => (has(q, /^(open|launch|go to|start|show( me)?)\b/) * 0.5 + (findApp(q.l) ? 0.45 : 0)) * (q.toks.length <= 4 ? 1 : 0.6),
    run: (q) => {
      const app = findApp(q.l)
      if (!app) return { text: 'Which app should I open?', intent: 'open_app' }
      const allowed = isAppAllowed(app)
      if (!allowed.allowed) return { text: `${ICONS[app].name} isn’t available right now. ${allowed.reason}`, intent: 'open_app' }
      return { text: `Opening ${ICONS[app].name}.`, open: { app }, intent: 'open_app' }
    },
  },
  {
    id: 'shortcut',
    score: (q) => has(q, /^run\b/) * 0.6 + (S().shortcuts.some((s) => q.l.includes(s.name.toLowerCase())) ? 0.5 : 0),
    run: (q) => {
      const sc = S().shortcuts.find((s) => q.l.includes(s.name.toLowerCase()))
      if (!sc) return { text: 'I couldn’t find that shortcut.', intent: 'shortcut' }
      return { text: `Running “${sc.name}”…`, cards: [{ type: 'steps', steps: sc.actions.map((a) => ({ label: `${a.label}: ${Object.values(a.params).join(', ')}`, done: true })) }], intent: 'shortcut' }
    },
  },

  // ---------- phone & contacts ----------
  {
    id: 'call',
    score: (q) => has(q, /^(call|phone|dial|facetime|ring)\b/) * 0.95,
    run: (q) => {
      const c = findContact(q.raw)
      const ft = /facetime/.test(q.l)
      if (!c) return { text: 'Who do you want to call?', intent: 'call' }
      return { text: `${ft ? 'FaceTiming' : 'Calling'} ${contactName(c, 'full')}…`, open: { app: ft ? 'facetime' : 'phone', route: `call/${c}` }, intent: 'call' }
    },
  },
  {
    id: 'contact_info',
    score: (q) => has(q, /\b(phone number|number|email address|address|birthday|contact card)\b/) * 0.6 + (findContact(q.raw) ? 0.3 : 0),
    run: (q) => {
      const c = findContact(q.raw) ?? q.m.contact
      if (!c) return { text: 'Whose information do you want?', intent: 'contact_info' }
      const ct = contactById(c)!
      q.m.contact = c
      const what = /birthday/.test(q.l) ? `${contactName(c)}’s birthday is ${ct.birthday ?? 'not saved'}.` : /address/.test(q.l) ? `${contactName(c)}’s address is ${ct.address ?? 'not saved'}.` : /email/.test(q.l) ? `${contactName(c)}’s email is ${ct.emails[0]}.` : `${contactName(c)}’s number is ${ct.phones[0]}.`
      return { text: what, cards: [{ type: 'contact', contactId: c }], intent: 'contact_info', followUps: [`Call ${contactName(c)}`, `Text ${contactName(c)}`] }
    },
  },

  // ---------- maps ----------
  {
    id: 'navigate',
    score: (q) => has(q, /\b(directions|navigate|take me|drive me|route|how (long|far).*(to|from)|get me to|on the way)\b/) * 0.9,
    run: (q) => navigate(q),
  },
  {
    id: 'findmy',
    score: (q) => has(q, /\b(where('?s| is| are)|find|locate)\b/) * 0.4 + has(q, /\b(my keys|backpack|percussion bag|collar|airpods|ipad|iphone|mom|dad|mia|alex)\b/) * 0.35 + has(q, /\bfind my\b/) * 0.3 - has(q, /\b(photo|message|email|dinner|robotics|meeting|flight)\b/) * 0.6,
    run: (q) => {
      const all = [...FINDMY.items.map((i) => ({ ...i, t: 'item' })), ...FINDMY.devices.map((d) => ({ ...d, t: 'device' })), ...FINDMY.people.map((p) => ({ ...p, t: 'person' }))]
      const hit = all.find((x) => q.l.includes(x.name.toLowerCase().replace(/jamie’s /, '').split(' ')[0].toLowerCase()) || (x.id === 'mom' && /\bmom\b/.test(q.l)) || (x.id === 'dad' && /\bdad\b/.test(q.l)))
      if (!hit) return { text: 'What should I look for in Find My?', intent: 'findmy' }
      const place = 'place' in hit ? hit.place : ''
      return { text: `${hit.name.replace('Jamie’s ', 'Your ')} ${hit.t === 'person' ? 'is at' : 'is'} ${place}${'distance' in hit ? `, ${hit.distance} away` : ''}.`, open: { app: 'findmy', route: `${hit.t}/${hit.id}` }, intent: 'findmy' }
    },
  },

  // ---------- weather ----------
  {
    id: 'weather',
    score: (q) => has(q, /\b(weather|rain|raining|umbrella|temperature|forecast|hot|cold|storm|snow|sunny|jacket|degrees outside)\b/) * 0.9 - has(q, /\b(photo|picture)\b/) * 0.5,
    run: (q) => weatherSkill(q),
  },

  // ---------- notes ----------
  {
    id: 'note',
    score: (q) => has(q, /\b(make|create|start|write|take|new|generate|add)\b.*\bnote\b|\bnote (that|to self)\b|\bto (my )?notes\b|\bstudy guide\b|\bpacking list\b|\bchecklist\b/) * 0.9,
    run: (q) => noteSkill(q),
  },

  // ---------- knowledge / fallback ----------
  {
    id: 'math',
    score: (q) => (mathAnswer(q.l) ? 0.92 : 0),
    run: (q) => ({ text: mathAnswer(q.l)!, intent: 'math' }),
  },
  {
    id: 'translate',
    score: (q) => (translate(q.l) ? 0.92 : 0),
    run: (q) => ({ text: translate(q.l)!, intent: 'translate' }),
  },
  {
    id: 'knowledge',
    score: (q) => (lookupFact(q.l) ? 0.7 : 0) + has(q, /^(what|who|why|how|explain|tell me about|define)\b/) * 0.1,
    run: (q) => {
      const f = lookupFact(q.l)
      if (f) return { text: f.answer, intent: 'knowledge', followUps: f.followUps }
      return fallback(q)
    },
  },
  {
    id: 'chitchat',
    score: (q) => has(q, /^(hi|hey|hello|thanks|thank you|who are you|what can you do|good (morning|night|afternoon))\b/) * 0.8,
    run: (q) => {
      if (/thank/.test(q.l)) return { text: 'You’re welcome!', intent: 'chitchat' }
      if (/what can you do|who are you/.test(q.l)) return { text: 'I can answer questions, take action in your apps, understand what’s on your screen, and find things across your messages, email, calendar and photos — all privately. Try “When is robotics?” or “Add this to my calendar.”', intent: 'chitchat', followUps: ['When is robotics?', 'Show me photos of Biscuit at the beach', 'What’s the weather for robotics on Thursday?'] }
      if (/good morning/.test(q.l)) return morningBrief()
      return { text: `Hi Jamie! How can I help?`, intent: 'chitchat', followUps: ['What’s on my calendar today?', 'Summarize my notifications'] }
    },
  },
]

// ---------------------------------------------------------------- skill impls
function fmtSecs(s: number) {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return [h && `${h} hour${h > 1 ? 's' : ''}`, m && `${m} minute${m > 1 ? 's' : ''}`, sec && `${sec} second${sec > 1 ? 's' : ''}`].filter(Boolean).join(' ')
}

export function startTimer(seconds: number, label = 'Timer') {
  const st = S()
  const id = uid('tm')
  const endsAt = Date.now() + seconds * 1000
  st.set({ timers: [...st.timers, { id, label, duration: seconds, endsAt, remaining: seconds, running: true }] })
  st.startActivity({ id: `timer-${id}`, kind: 'timer', title: label, endsAt, startedAt: Date.now(), app: 'clock', priority: 3, data: { duration: seconds } })
  return id
}

export function doSend(d: { to?: string; body: string; app: 'messages' | 'mail'; subject?: string }) {
  const st = S()
  if (d.app === 'mail') {
    const c = d.to ? contactById(d.to) : undefined
    st.addMail({ from: { name: 'Jamie Park', email: 'jamie.park@icloud.example' }, to: c?.emails[0] ?? 'unknown', subject: d.subject ?? 'Message from Jamie', body: d.body, ts: Date.now(), unread: false, folder: 'sent', category: 'primary' })
    return
  }
  if (!d.to) return
  const conv = st.ensureConversation([d.to])
  const id = st.sendMessage(conv, { text: d.body })
  window.setTimeout(() => S().patchMessage(conv, id, { status: 'delivered' }), 700)
}

function sendMessageSkill(q: Q): SiriResult {
  const st = S()
  // "send this photo to Dad"
  if (/\b(this|that|these|them) (photo|picture|pic)s?\b|\bsend (it|them|this|these) to\b/.test(q.l)) {
    const to = findContact(q.raw)
    const e = q.onscreen.entity ?? {}
    const photoId = e.photoId ?? q.m.photoIds?.[0]
    if (to && photoId) {
      const conv = st.ensureConversation([to])
      const id = st.sendMessage(conv, { attachment: { kind: 'photo', photoId } })
      window.setTimeout(() => S().patchMessage(conv, id, { status: 'delivered' }), 800)
      return { text: `Sent the photo to ${contactName(to)}.`, cards: [{ type: 'photos', photoIds: [photoId] }], intent: 'send_message' }
    }
  }
  const to = findContact(q.raw) ?? q.m.contact
  if (!to) return { text: 'Who should I send it to?', intent: 'send_message', followUps: ['Mom', 'Dad', 'Alex'] }
  q.m.contact = to
  const name = contactById(to)!
  let body = q.raw
    .replace(/^(hey siri,?\s*)?/i, '')
    .replace(/^(send (a )?(message|text|imessage) to|text|message|imessage|tell|reply to|let)\s+/i, '')
  const names = [name.first, name.last, name.nickname, [name.first, name.last].join(' ')].filter(Boolean) as string[]
  for (const n of names.sort((a, b) => b.length - a.length)) body = body.replace(new RegExp(`^${n}(?:'s)?\\s*`, 'i'), '')
  body = body.replace(/^(know\s+)?(that|saying|say)\s+/i, '').replace(/^(,|:)\s*/, '')
  // pronoun conversion for 3rd-person phrasing ("tell dad I'm heading home")
  body = body.replace(/\bmy ETA\b/i, () => `my ETA is ${fmtTime(Date.now() + 14 * MIN)} (about 14 min)`)
  if (/\bI'?ll be there\b/i.test(body) && q.m.event) body = `I'll be there for ${q.m.event.title} ${fmtWhen(q.m.event.start)}`
  if (!body.trim()) return { text: `What do you want to say to ${contactName(to)}?`, intent: 'send_message' }
  body = body.charAt(0).toUpperCase() + body.slice(1)
  if (!/[.!?]$/.test(body)) body += /^(can|could|would|will|are|is|do|did|what|when|where)\b/i.test(body) ? '?' : ''
  q.m.draft = { to, body, app: 'messages' }
  return { text: `Here’s your message to ${contactName(to)}. Ready to send it?`, cards: [{ type: 'draft', to, body, app: 'messages' }], intent: 'send_message', followUps: ['Send it', 'Make it more friendly'] }
}

function personalContext(q: Q): SiriResult {
  const st = S()
  const l = q.l
  // "what's on my calendar tomorrow" / "am I free"
  if (/\b(calendar|schedule|free|busy|plans|agenda|what do i have)\b/.test(l)) {
    const w = parseWhen(l) ?? { start: Date.now(), hasTime: false, spans: [] as string[] }
    const d0 = startOfDay(w.start)
    const evs = st.events.filter((e) => e.start >= d0 && e.start < d0 + DAY).sort((a, b) => a.start - b.start)
    const label = dayLabel(d0).toLowerCase()
    if (/free|busy/.test(l) && w.hasTime) {
      const clash = evs.find((e) => e.start <= w.start && e.end > w.start)
      return { text: clash ? `No — you have ${clash.title} then (${fmtTime(clash.start)}–${fmtTime(clash.end)}).` : `Yes, you’re free ${fmtWhen(w.start)}.`, cards: clash ? [eventCard(clash.id)] : undefined, intent: 'context' }
    }
    if (!evs.length) return { text: `Nothing on your calendar ${label === 'today' || label === 'tomorrow' ? label : `on ${label}`}.`, intent: 'context' }
    return { text: `You have ${evs.length} event${evs.length > 1 ? 's' : ''} ${label === 'today' || label === 'tomorrow' ? label : `on ${label}`}: ${evs.map((e) => `${e.title} at ${fmtTime(e.start)}`).join(', ')}.`, cards: evs.slice(0, 4).map((e) => eventCard(e.id)), intent: 'context' }
  }

  const person = findContact(q.raw)
  // Topic tokens without question words / people
  const stop = /\b(when|what|which|where|time|day|is|was|are|did|does|do|say|said|mention|mentioned|tell|told|me|my|the|a|an|about|going|to|be|at|for|i|s|again|supposed|happening|set|meet|meeting)\b/g
  let topic = l.replace(/[?.!]/g, '').replace(stop, ' ')
  if (person) {
    const c = contactById(person)!
    ;[c.first, c.last, c.nickname].filter(Boolean).forEach((n) => (topic = topic.replace(new RegExp(`\\b${n!.toLowerCase()}('s)?\\b`, 'g'), ' ')))
  }
  topic = topic.replace(/\s+/g, ' ').trim()
  const topicToks = tokens(topic)

  // flight / confirmation codes / orders / reservations (Mail facts)
  if (/\b(flight|confirmation|seat|boarding)\b/.test(l)) {
    const m = st.mails.find((x) => x.facts?.kind === 'flight')!
    const ev = st.events.find((e) => /flight/i.test(e.title))
    return { text: /confirmation/.test(l) ? `Your Skyward confirmation code is 7XKQ2P, for flight SK 482.` : /seat/.test(l) ? 'You’re in seat 14C on flight SK 482.' : `Your flight SK 482 to Seattle departs ${ev ? fmtWhen(ev.start) : 'Nov 21 at 8:45 AM'} from Maple Grove (MGR). Confirmation 7XKQ2P.`, cards: [{ type: 'mail', mailId: m.id }, ...(ev ? [eventCard(ev.id)] : [])], intent: 'context' }
  }
  if (/\b(package|order|delivery|arrive|shipping|tracking)\b/.test(l)) {
    const m = st.mails.find((x) => x.facts?.kind === 'order')!
    return { text: `Your Bolt Electronics order ${m.facts!.order} shipped and is arriving ${m.facts!.eta}. Tracking number ${m.facts!.tracking}.`, cards: [{ type: 'mail', mailId: m.id }], intent: 'context' }
  }
  if (/\b(reservation|rosa)/.test(l)) {
    const m = st.mails.find((x) => x.facts?.kind === 'reservation')!
    const [d] = m.facts!.when.split('|')
    const start = startOfDay() + +d * DAY + 19 * HOUR
    q.m.event = { title: "Dinner at Rosa's Trattoria", start, location: m.facts!.location }
    return { text: `Your reservation at Rosa’s Trattoria is ${fmtWhen(start)} for 4 people, under Park. It’s at 218 Main St.`, cards: [{ type: 'mail', mailId: m.id }], intent: 'context', followUps: ['Add it to my calendar', 'Get directions'] }
  }

  // search across messages, events, mail
  const hits = search(topic || l, { types: ['message', 'event', 'mail', 'reminder', 'note'], limit: 30 })
  const filtered = person ? hits.filter((h) => h.contact === person || h.subtitle?.includes(contactName(person)) || h.title.includes(contactName(person))) : hits
  const msgHit = (filtered.length ? filtered : hits).find((h) => h.type === 'message' && h.text && parseWhen(h.text))
  const evHit = hits.find((h) => h.type === 'event' && topicToks.some((t) => tokens(h.title).includes(t)))
  const ev = evHit ? st.events.find((e) => `event-${e.id}` === evHit.id) : undefined
  const msgBest = (filtered.length ? filtered : hits).find((h) => h.type === 'message')

  if (/\b(which day|what day|when|what time)\b/.test(l) && (msgHit || ev)) {
    const cards: SiriCard[] = []
    let text = ''
    if (msgHit && (person || !ev || (msgHit.ts ?? 0) > (ev ? ev.start - 30 * DAY : 0))) {
      const w = parseWhen(msgHit.text!, msgHit.ts)
      const [convPart, msgId] = msgHit.route!.replace('conv/', '').split('/')
      const who = msgHit.contact && msgHit.contact !== 'me' ? contactName(msgHit.contact) : 'You'
      const whenStr = w ? `${w.hasDate ? WEEKDAYS[new Date(w.start).getDay()] : ''}${w.hasTime ? ` at ${fmtTime(w.start)}` : ''}`.trim() : ''
      text = person
        ? `${who} said it’s ${whenStr}. Their message: “${msgHit.text}”`
        : `${ev ? `${ev.title} is ${fmtWhen(ev.start)}${ev.location ? ` in ${ev.location}` : ''}.` : `It’s ${whenStr}.`} ${who} mentioned it was moved: “${msgHit.text}”`
      cards.push({ type: 'message', conversationId: convPart, messageId: msgId })
      if (ev) cards.push(eventCard(ev.id))
      if (w) q.m.event = { title: ev?.title ?? topic.replace(/\b\w/g, (c) => c.toUpperCase()), start: w.start, location: ev?.location }
    } else if (ev) {
      text = `${ev.title} is ${fmtWhen(ev.start)}${ev.location ? ` at ${ev.location}` : ''}.`
      cards.push(eventCard(ev.id))
      q.m.event = { title: ev.title, start: ev.start, end: ev.end, location: ev.location }
    }
    return { text, cards, intent: 'context', followUps: ['Remind me an hour before', 'What’s the weather then?', ev ? 'Get directions' : 'Add it to my calendar'] }
  }
  if (/\bwhere\b/.test(l) && ev) {
    q.m.event = { title: ev.title, start: ev.start, location: ev.location }
    return { text: `${ev.title} is at ${ev.location ?? 'an unspecified location'}, ${fmtWhen(ev.start)}.`, cards: [eventCard(ev.id)], intent: 'context', followUps: ['Get directions'] }
  }
  if (msgBest) {
    const [convPart, msgId] = msgBest.route!.replace('conv/', '').split('/')
    return { text: `${msgBest.contact && msgBest.contact !== 'me' ? contactName(msgBest.contact) : 'You'} said: “${msgBest.subtitle}”`, cards: [{ type: 'message', conversationId: convPart, messageId: msgId }], intent: 'context' }
  }
  const any = hits[0]
  if (any) {
    const card: SiriCard | undefined = any.type === 'mail' ? { type: 'mail', mailId: any.id.slice(5) } : any.type === 'event' ? eventCard(any.id.slice(6)) : any.type === 'reminder' ? { type: 'reminder', reminderId: any.id.slice(4) } : any.type === 'note' ? { type: 'note', noteId: any.id.slice(5) } : undefined
    return { text: `Here’s what I found: ${any.title}${any.subtitle ? ` — ${any.subtitle}` : ''}.`, cards: card ? [card] : undefined, intent: 'context' }
  }
  return fallback(q)
}

function homeControl(q: Q): SiriResult {
  const st = S()
  const l = q.l
  const scene = HOME_SCENES.find((s) => l.includes(s.name.toLowerCase()))
  if (scene) {
    const acc = st.accessories.map((a) => {
      const v = (scene.set as Record<string, unknown>)[a.id]
      if (v === undefined) return a
      if (v === 'lock') return { ...a, locked: true }
      return { ...a, on: v as boolean }
    })
    st.set({ accessories: acc })
    return { text: `Running “${scene.name}”. ${Object.keys(scene.set).length} accessories updated.`, intent: 'home_control', cards: [{ type: 'app', app: 'home', label: 'Open Home' }] }
  }
  if (/\b(lock|unlock)\b/.test(l)) {
    const lock = !/unlock/.test(l)
    const target = /garage/.test(l) ? 'h-g-door' : 'h-fp-lock'
    st.set({ accessories: st.accessories.map((a) => (a.id === target ? { ...a, locked: lock, value: target === 'h-g-door' ? (lock ? 'Closed' : 'Open') : a.value } : a)) })
    return { text: `${target === 'h-g-door' ? 'The garage door is' : 'The front door is'} ${lock ? (target === 'h-g-door' ? 'closed' : 'locked') : target === 'h-g-door' ? 'open' : 'unlocked'}.`, intent: 'home_control' }
  }
  const temp = wordsToNumbers(l).match(/(\d{2})\s*(degrees|°)?/)
  if (/thermostat|heat|\bac\b|degrees|temperature/.test(l) && temp) {
    st.set({ accessories: st.accessories.map((a) => (a.kind === 'thermostat' ? { ...a, target: +temp[1] } : a)) })
    return { text: `The thermostat is set to ${temp[1]}°. It’s ${st.accessories.find((a) => a.kind === 'thermostat')?.temp}° inside right now.`, intent: 'home_control' }
  }
  const on = /\b(on|brighten|up)\b/.test(l) && !/\boff\b/.test(l)
  const pct = l.match(/(\d{1,3})\s*(%|percent)/)
  const roomMatch = ['living room', 'kitchen', 'bedroom', 'my room', 'jamie', 'garage', 'porch', 'backyard'].find((r) => l.includes(r))
  const room = roomMatch === 'bedroom' || roomMatch === 'my room' || roomMatch === 'jamie' ? 'Jamie’s Room' : roomMatch === 'porch' ? 'Front Porch' : roomMatch ? roomMatch.replace(/\b\w/g, (c) => c.toUpperCase()) : undefined
  const kind = /\bfan\b/.test(l) ? 'fan' : /\btv\b/.test(l) ? 'tv' : /coffee/.test(l) ? 'outlet' : 'light'
  const named = st.accessories.find((a) => l.includes(a.name.toLowerCase()))
  const targets = named ? [named] : st.accessories.filter((a) => a.kind === kind && (!room || a.room === room))
  if (!targets.length) return { text: 'I couldn’t find that accessory in your Home.', intent: 'home_control' }
  const ids = new Set(targets.map((t) => t.id))
  st.set({ accessories: st.accessories.map((a) => (ids.has(a.id) ? { ...a, on: pct ? +pct[1] > 0 : /dim/.test(l) ? true : on, brightness: pct ? +pct[1] : /dim/.test(l) ? 25 : a.brightness } : a)) })
  const where = room ? `in the ${room}` : named ? '' : 'in your home'
  return { text: `${pct ? `Set ${targets.length > 1 ? `${targets.length} lights` : targets[0].name} to ${pct[1]}%` : `Turned ${on || /dim/.test(l) ? 'on' : 'off'} ${targets.length > 1 ? `${targets.length} ${kind === 'light' ? 'lights' : 'accessories'}` : `the ${targets[0].name}`}`} ${where}.`.replace(/\s+\./, '.'), intent: 'home_control' }
}

function settingsSkill(q: Q): SiriResult {
  const st = S()
  const l = q.l
  const off = /\b(off|disable|stop)\b/.test(l)
  const on = !off
  const card = (label: string, route: string): SiriCard[] => [{ type: 'setting', label, route }]
  if (/\bopen\b.*settings/.test(l)) {
    const hit = SETTINGS_INDEX.find((s) => l.includes(s.title.toLowerCase()) || s.keywords.split(' ').some((k) => k.length > 3 && l.includes(k)))
    return { text: `Opening ${hit ? hit.title : 'Settings'}.`, open: { app: 'settings', route: hit?.route }, intent: 'settings' }
  }
  if (/wi-?fi/.test(l)) {
    st.setNet({ wifi: on, activePath: on ? 'wifi' : st.net.cellular ? 'cellular' : 'none' })
    return { text: `Wi-Fi is ${on ? 'on' : 'off'}.${!on && st.net.connectivityAssist ? ' Connectivity Assist moved you to 5G without dropping anything.' : ''}`, cards: card('Wi-Fi', 'wifi'), intent: 'settings' }
  }
  if (/bluetooth/.test(l)) {
    st.setNet({ bluetooth: on })
    return { text: `Bluetooth is ${on ? 'on' : 'off'}.`, cards: card('Bluetooth', 'bluetooth'), intent: 'settings' }
  }
  if (/airplane/.test(l)) {
    st.setNet({ airplane: on, activePath: on ? 'none' : 'wifi' })
    return { text: `Airplane Mode is ${on ? 'on' : 'off'}.`, intent: 'settings' }
  }
  if (/dark mode|light mode/.test(l)) {
    const dark = /dark mode/.test(l) ? on : off
    st.set({ theme: dark ? 'dark' : 'light' })
    return { text: `${dark ? 'Dark' : 'Light'} Mode is on.`, cards: card('Display & Brightness', 'display'), intent: 'settings' }
  }
  if (/low power/.test(l)) {
    st.set({ lowPower: on })
    return { text: `Low Power Mode is ${on ? 'on' : 'off'}.`, cards: card('Battery', 'battery'), intent: 'settings' }
  }
  if (/flashlight|torch/.test(l)) {
    st.set({ flashlight: on })
    return { text: `Flashlight ${on ? 'on' : 'off'}.`, intent: 'settings' }
  }
  if (/do not disturb|focus|dnd/.test(l)) {
    const f = /sleep/.test(l) ? 'Sleep' : /study|school/.test(l) ? 'Study' : /driv/.test(l) ? 'Driving' : 'Do Not Disturb'
    st.set({ focus: on ? f : null })
    return { text: on ? `${f} is on${parseWhen(l) ? ` until ${fmtTime(parseWhen(l)!.start)}` : ''}.` : 'Focus is off.', intent: 'settings' }
  }
  if (/night shift/.test(l)) {
    st.set({ nightShift: on })
    return { text: `Night Shift is ${on ? 'on' : 'off'}.`, intent: 'settings' }
  }
  if (/true tone/.test(l)) {
    st.set({ trueTone: on })
    return { text: `True Tone is ${on ? 'on' : 'off'}.`, intent: 'settings' }
  }
  if (/hotspot/.test(l)) {
    st.setNet({ hotspot: on })
    if (on) st.flashIsland({ kind: 'hotspot', title: 'Personal Hotspot', subtitle: 'Ready to share', duration: 2600 })
    return { text: `Personal Hotspot is ${on ? 'on' : 'off'}.`, intent: 'settings' }
  }
  if (/voiceover/.test(l)) {
    st.set({ accessibility: { ...st.accessibility, voiceOver: on } })
    return { text: `VoiceOver ${on ? 'on' : 'off'}.`, cards: card('VoiceOver', 'accessibility/voiceover'), intent: 'settings' }
  }
  if (/reduce motion/.test(l)) {
    st.set({ reduceMotion: on })
    return { text: `Reduce Motion is ${on ? 'on' : 'off'}.`, intent: 'settings' }
  }
  if (/silent|ringer/.test(l) && !/volume/.test(l)) {
    st.set({ silent: on })
    st.flashIsland({ kind: 'silent', title: on ? 'Silent Mode' : 'Ring', duration: 1800 })
    return { text: `Silent Mode ${on ? 'on' : 'off'}.`, intent: 'settings' }
  }
  const pct = wordsToNumbers(l).match(/(\d{1,3})\s*(%|percent)/)
  const dir = /\b(up|increase|raise|brighter|louder|higher|more)\b/.test(l) ? 1 : /\b(down|decrease|lower|dimmer|quieter|less)\b/.test(l) ? -1 : 0
  if (/glass|transparen|tint|clearer/.test(l)) {
    const v = pct ? +pct[1] / 100 : /clear|transparent|less tint/.test(l) ? Math.max(0, st.glassTint - 0.35) : Math.min(1, st.glassTint + 0.35)
    st.set({ glassTint: v })
    return { text: `Liquid Glass is now ${v < 0.25 ? 'clearer' : v > 0.7 ? 'more tinted' : 'balanced'} (${Math.round(v * 100)}% tint).`, cards: card('Liquid Glass', 'display/glass'), intent: 'settings' }
  }
  if (/brightness|brighter|dimmer/.test(l)) {
    const v = pct ? +pct[1] / 100 : Math.min(1, Math.max(0.05, st.brightness + dir * 0.2))
    st.set({ brightness: v })
    return { text: `Brightness set to ${Math.round(v * 100)}%.`, intent: 'settings' }
  }
  if (/alarm volume/.test(l)) {
    const v = pct ? +pct[1] / 100 : Math.min(1, Math.max(0, st.alarmVolume + dir * 0.15))
    st.set({ alarmVolume: v })
    return { text: `Alarm and timer volume set to ${Math.round(v * 100)}%. Your ringer stays at ${Math.round(st.ringerVolume * 100)}%.`, cards: card('Sounds & Haptics', 'sounds'), intent: 'settings' }
  }
  if (/volume|louder|quieter/.test(l)) {
    const v = pct ? +pct[1] / 100 : Math.min(1, Math.max(0, st.volume + dir * 0.15))
    st.set({ volume: v })
    return { text: `Volume set to ${Math.round(v * 100)}%.`, intent: 'settings' }
  }
  return { text: 'Opening Settings.', open: { app: 'settings' }, intent: 'settings' }
}

function navigate(q: Q): SiriResult {
  const st = S()
  const l = q.l
  const home = MAP_PLACES.find((p) => p.id === 'home')!
  const here = { x: 560, y: 300 } // at school
  const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y)
  const mins = (d: number) => Math.max(3, Math.round(d / 28))
  // natural-language routing: "coffee shop on the way home that doesn't add more than ten minutes"
  const cat = /coffee|cafe/.test(l) ? 'coffee' : /restaurant|food|eat|pizza/.test(l) ? 'restaurant' : /park/.test(l) ? 'park' : null
  const maxAdd = wordsToNumbers(l).match(/(?:more than|over|under|less than|max(?:imum)?) (\d+) min/)?.[1]
  if (cat && /on the way|along the way|en route|on my way/.test(l)) {
    const dest = /home/.test(l) ? home : MAP_PLACES.find((p) => l.includes(p.name.toLowerCase())) ?? home
    const direct = mins(dist(here, dest))
    const options = MAP_PLACES.filter((p) => p.kind === cat)
      .map((p) => ({ p, add: mins(dist(here, p) + dist(p, dest)) - direct + 2 }))
      .sort((a, b) => a.add - b.add)
    const limit = maxAdd ? +maxAdd : 15
    const ok = options.filter((o) => o.add <= limit)
    const pick = ok[0] ?? options[0]
    const eta = direct + pick.add
    st.startActivity({ id: 'nav', kind: 'navigation', title: `Stop at ${pick.p.name}`, subtitle: `then ${dest.name}`, app: 'maps', priority: 4, data: { eta: `${eta} min`, next: 'Turn right onto Oak Ave', dist: '0.4 mi' } })
    return {
      text: `${pick.p.name} is on your way ${dest.id === 'home' ? 'home' : `to ${dest.name}`} and adds ${pick.add} minutes${ok.length ? ` — within your ${limit}-minute limit` : ` (nothing fits under ${limit} minutes)`}. It’s rated ${pick.p.rating} and ${pick.p.hours?.toLowerCase() ?? 'open now'}. Total trip: ${eta} minutes.${options[1] ? ` ${options[1].p.name} would add ${options[1].add} minutes.` : ''}`,
      cards: [{ type: 'map', destination: dest.name, eta: `${eta} min`, via: pick.p.name }],
      intent: 'navigate',
      open: { app: 'maps', route: `route/${dest.id}/${pick.p.id}` },
    }
  }
  let dest = MAP_PLACES.find((p) => l.includes(p.name.toLowerCase().replace(/’s|'s/, '')) || l.includes(p.name.toLowerCase()) || (p.id === 'home' && /\bhome\b/.test(l)) || (p.id === 'school' && /\bschool\b/.test(l)) || (p.id === 'grandma' && /grandma/.test(l)) || (p.id === 'airport' && /airport/.test(l)))
  if (!dest && /\b(there|it)\b/.test(l) && q.m.event?.location) {
    const loc = q.m.event.location.toLowerCase()
    dest = MAP_PLACES.find((p) => loc.includes(p.address.toLowerCase().split(' ').slice(0, 2).join(' ').toLowerCase()) || loc.includes(p.name.toLowerCase().split(' ')[0])) ?? MAP_PLACES.find((p) => p.id === 'school')
  }
  if (!dest && cat) dest = MAP_PLACES.filter((p) => p.kind === cat).sort((a, b) => dist(here, a) - dist(here, b))[0]
  if (!dest) return { text: 'Where do you want to go?', intent: 'navigate' }
  const eta = mins(dist(here, dest))
  st.startActivity({ id: 'nav', kind: 'navigation', title: dest.name, subtitle: dest.address, app: 'maps', priority: 4, data: { eta: `${eta} min`, next: 'Head north on Lincoln Ave', dist: '500 ft' } })
  return { text: `Starting directions to ${dest.name}. It’s ${eta} minutes with light traffic.`, cards: [{ type: 'map', destination: dest.name, eta: `${eta} min` }], intent: 'navigate', open: { app: 'maps', route: `route/${dest.id}` } }
}

function weatherSkill(q: Q): SiriResult {
  const l = q.l
  let dayIdx = 0
  let forWhat = ''
  const w = parseWhen(l)
  if (w) dayIdx = Math.round((startOfDay(w.start) - startOfDay()) / DAY)
  // personal context: "for robotics", "then", "for dinner at grandma's"
  const ev = /\b(then|that day)\b/.test(l) && q.m.event ? { title: q.m.event.title, start: q.m.event.start } : S().events.find((e) => e.start > Date.now() && tokens(l).some((t) => t.length > 3 && tokens(e.title).includes(t)))
  if (ev) {
    dayIdx = Math.round((startOfDay(ev.start) - startOfDay()) / DAY)
    forWhat = ` for ${ev.title} (${fmtWhen(ev.start)})`
  }
  const d = WEATHER.daily[Math.min(9, Math.max(0, dayIdx))]
  // demo storyline: thunderstorms Thursday evening
  const thu = (4 - new Date().getDay() + 7) % 7
  const stormy = dayIdx === thu
  const cond = stormy ? 'thunderstorms' : d.icon.includes('rain') ? 'rain' : d.icon.includes('bolt') ? 'thunderstorms' : d.icon.includes('cloud') ? 'some clouds' : 'sunshine'
  const pop = stormy ? 80 : d.pop
  const umbrella = /umbrella|rain|jacket/.test(l)
  const text = dayIdx === 0 && !forWhat
    ? `It’s ${WEATHER.temp}° and ${WEATHER.condition.toLowerCase()} in Maple Grove, with a high of ${WEATHER.high}° and a low of ${WEATHER.low}°. ${WEATHER.summary}`
    : `${forWhat ? `Weather${forWhat}` : dayLabel(startOfDay() + dayIdx * DAY)}: ${cond}, high ${d.hi}° and low ${d.lo}°, ${pop}% chance of precipitation.${umbrella ? (pop >= 40 ? ' Yes — bring an umbrella.' : ' You probably won’t need an umbrella.') : ''}${stormy ? ' Storms are most likely between 5 and 9 PM.' : ''}`
  return { text, cards: [{ type: 'weather' }], intent: 'weather', followUps: stormy ? ['Remind me to bring an umbrella', 'Text Alex about the storm'] : ['What about tomorrow?'] }
}

function noteSkill(q: Q): SiriResult {
  const st = S()
  const raw = q.raw.replace(/^(hey siri,?\s*)?(please\s+)?(make|create|start|write|take|generate|add)( me)?( a)?( new)?( quick)?\s*(note)?\s*(called|titled|named|about|for|with|that says|saying|to)?\s*/i, '')
  const l = raw.toLowerCase()
  let title = raw.split(/[:\n]/)[0].trim() || 'New Note'
  let blocks: import('../types').NoteBlock[] = []
  if (/packing|pack/.test(l)) {
    title = /seattle/.test(l) ? 'Seattle Packing List' : 'Packing List'
    blocks = [{ t: 'h1', text: title }, { t: 'p', text: 'Generated by Siri from your trip details (Flight SK 482, Nov 21).' }, ...['Rain jacket (Seattle forecast: showers)', 'Phone + AirPods chargers', 'Boarding pass in Wallet', 'Headphones', 'Book for the plane', 'Toiletries'].map((text) => ({ t: 'check' as const, text, done: false }))]
  } else if (/study guide|study|review/.test(l)) {
    const subject = /chem/.test(l) ? 'Chemistry Unit 3' : /physics/.test(l) ? 'AP Physics' : 'Study'
    title = `${subject} Study Guide`
    blocks = [
      { t: 'h1', text: title },
      { t: 'p', text: 'Test Friday at 10 AM · Room 208' },
      { t: 'h2', text: 'Key ideas' },
      { t: 'bullet', text: 'Mole ratios come from the balanced equation' },
      { t: 'bullet', text: 'Limiting reagent = runs out first' },
      { t: 'bullet', text: 'Percent yield = actual ÷ theoretical × 100' },
      { t: 'divider' },
      { t: 'h2', text: 'Practice' },
      { t: 'check', text: 'Worksheet 3.2', done: false },
      { t: 'check', text: 'Limiting reagent problems 1–10', done: false },
      { t: 'check', text: 'Study group Friday 4 PM (library)', done: false },
    ]
  } else if (/,|\band\b/.test(raw) && raw.split(/,|\band\b/).length >= 3) {
    const parts = raw.replace(/^[^:]*:/, '').split(/,|\band\b/).map((s) => s.trim()).filter(Boolean)
    title = raw.includes(':') ? raw.split(':')[0] : 'List'
    blocks = [{ t: 'h1', text: title }, ...parts.map((text) => ({ t: 'check' as const, text: text[0].toUpperCase() + text.slice(1), done: false }))]
  } else {
    title = title.length > 40 ? title.slice(0, 40) + '…' : title
    blocks = [{ t: 'h1', text: title[0]?.toUpperCase() + title.slice(1) }, { t: 'p', text: raw }]
  }
  const id = st.addNote({ title, blocks, folder: 'Notes' })
  return { text: `I created a note called “${title}”.`, cards: [{ type: 'note', noteId: id }], intent: 'note', followUps: ['Add rain boots', 'Share it with Mom'] }
}

function morningBrief(): SiriResult {
  const st = S()
  const today = st.events.filter((e) => e.start >= startOfDay() && e.start < startOfDay() + DAY).sort((a, b) => a.start - b.start)
  return {
    text: `Good morning, Jamie. It’s ${WEATHER.temp}° and ${WEATHER.condition.toLowerCase()}. You have ${today.length} events today${today[0] ? `, starting with ${today[0].title} at ${fmtTime(today[0].start)}` : ''}. Sam asked you to remind them about the percussion bag, and thunderstorms are expected Thursday evening during robotics.`,
    cards: [{ type: 'weather' }, ...today.slice(0, 2).map((e) => eventCard(e.id))],
    intent: 'chitchat',
  }
}

function fallback(q: Q): SiriResult {
  const st = S()
  if (st.siriSettings.provider === 'chatgpt') {
    return { text: `ChatGPT (simulated): “${q.raw}” is a great question. In this offline demo I can’t reach ChatGPT, but in iOS 27 Siri can hand requests like this to ChatGPT when you allow it.`, intent: 'fallback' }
  }
  const hits = search(q.raw, { limit: 3 })
  if (hits.length && hits[0].score > 4) {
    const h = hits[0]
    return { text: `I found “${h.title}” in ${ICONS[h.app].name}.`, cards: [{ type: 'app', app: h.app, route: h.route, label: `Open in ${ICONS[h.app].name}` }], intent: 'fallback' }
  }
  return {
    text: `I’m not sure about that one. I can search the web for “${q.raw}”, or you can try asking another way.`,
    cards: [{ type: 'app', app: 'safari', route: `search/${encodeURIComponent(q.raw)}`, label: 'Search the Web' }],
    intent: 'fallback',
    followUps: ['What can you do?', 'When is robotics?'],
  }
}

// ---------------------------------------------------------------- entry
function scoreAll(q: Q): { skill: Skill; score: number }[] {
  return skills.map((s) => ({ skill: s, score: s.score(q) })).sort((a, b) => b.score - a.score)
}

function mkQ(text: string, convId: string): Q {
  const raw = text.trim()
  const l = wordsToNumbers(raw.toLowerCase().replace(/^(hey |ok )?siri[, ]*/, '')).replace(/[“”]/g, '"').replace(/’/g, "'")
  return { raw: raw.replace(/^(hey |ok )?siri[, ]*/i, ''), l, toks: tokens(l, true), convId, m: mem(convId), onscreen: S().siriOnscreen }
}

export function ask(text: string, convId = 'default'): SiriResult {
  let q = mkQ(text, convId)
  // "what about Friday?" → reuse last intent with new slot
  if (/^(what|how) about\b|^and (on )?\w+day\b/.test(q.l) && q.m.lastQuery) {
    q = mkQ(`${q.m.lastQuery} ${q.raw.replace(/^(what|how) about|^and/i, '')}`, convId)
  }
  const ranked = scoreAll(q)
  const best = ranked[0]

  // multi-step: split into clauses if each part is independently understood
  const parts = q.raw.split(/\s*(?:,? and then |, then | then |,? and also |; |, and |(?<=\w) and (?=(?:text|tell|turn|set|remind|add|play|start|send|open|lock|call|message|make|create|schedule|navigate|get|show)\b))\s*/i).filter((p) => p.trim().length > 2)
  if (parts.length > 1) {
    const partScores = parts.map((p) => scoreAll(mkQ(p, convId))[0])
    if (partScores.every((p) => p.score >= 0.6)) {
      const results = parts.map((p) => {
        const pq = mkQ(p, convId)
        return scoreAll(pq)[0].skill.run(pq)
      })
      const opened = results.find((r) => r.open)?.open
      return {
        text: results.map((r) => r.text).join(' '),
        cards: [{ type: 'steps', steps: results.map((_r, i) => ({ label: parts[i][0].toUpperCase() + parts[i].slice(1), done: true })) }, ...results.flatMap((r) => r.cards ?? []).slice(0, 3)],
        intent: 'multi',
        open: opened,
      }
    }
  }

  const res = best.score >= 0.45 ? best.skill.run(q) : fallback(q)
  q.m.lastIntent = res.intent
  if (['context', 'weather', 'photos', 'home_camera'].includes(res.intent)) q.m.lastQuery = q.raw
  return res
}

/** Reset follow-up memory (new conversation). */
export function forget(convId: string) {
  memories.delete(convId)
}

export const SIRI_SUGGESTIONS = [
  'Which day did Alex say the robotics meeting was?',
  'Add dinner with Sam next Friday at 6:30 at Rosa’s',
  'Show me photos of Biscuit at the beach',
  'What’s the weather for robotics?',
  'Take me to a coffee shop on the way home that doesn’t add more than ten minutes',
  'Show me when a package was left at the front door',
  'Text Dad that I’m heading home with my ETA',
  'Make Liquid Glass more clear',
  'Write an email to Mr. Delgado asking if I can stay late Thursday to finish the intake',
  'Set a timer for 10 minutes',
  'Play my study playlist',
  'Turn off the living room lights and lock the front door',
  'When is my flight?',
  'Make a packing list note for Seattle',
]
