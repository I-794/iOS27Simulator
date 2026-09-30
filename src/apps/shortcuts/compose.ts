/* "Describe a Shortcut" (iOS 27): turns a natural-language description into an editable
 * action chain. Keyword/intent composer: trigger → clauses → actions, with contact,
 * place, time, playlist, note and condition detection. Unknown clauses fall back to
 * an Apple Intelligence "Use Model" step so the result is always a sensible chain. */
import type { ShortcutAction } from '../../os/types'
import { useOS } from '../../os/store'
import { findContact } from '../../os/ai/siri'
import { contactById } from '../../os/data/people'
import { PLAYLISTS, TRACKS } from '../../os/data/media'
import { HOME_SCENES } from '../../os/data/world'
import { parseDuration, parseReminder, wordsToNumbers } from '../../os/ai/parse'
import { ICONS } from '../../icons/AppIconArt'
import { makeAction, FOCUSES } from './actions'

export interface Composed {
  name: string
  color: string
  icon: string
  trigger?: string
  actions: ShortcutAction[]
  understood: string[]
}

const VERBS = 'text|message|tell|send|turn|dim|brighten|play|remind|save|set|start|open|show|include|add|lock|unlock|notify|speak|say|take|email|run|wait|get|summarize|append|put|log|share|let|read|ask|switch|enable|disable|begin|put|give|announce'
const VERB_RE = new RegExp(`\\b(${VERBS})\\b`, 'i')

const title = (s: string) => s.replace(/\s+/g, ' ').trim().replace(/\b([a-z])/g, (m) => m.toUpperCase())
const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s)

export function resolvePlace(p: string): string {
  const l = p.toLowerCase().replace(/^(the|my)\s+/, '').trim()
  if (!l) return 'Home'
  if (/\b(school|lincoln|class)\b/.test(l)) return 'Lincoln High School'
  if (/\bhome|house\b/.test(l) && !/grandma/.test(l)) return 'Home'
  if (/grandma/.test(l)) return 'Grandma’s House'
  if (/practice|field/.test(l)) return 'Lincoln High Practice Field'
  if (/coffee|brew/.test(l)) return 'Brew Lab Coffee'
  if (/library/.test(l)) return 'Maple Grove Library'
  if (/park/.test(l)) return 'Riverside Park'
  if (/mall/.test(l)) return 'Greenfield Mall'
  if (/work|job/.test(l)) return 'Work'
  return title(l)
}

export function recipientLabel(name: string): string | undefined {
  if (/\b(drumline|band group|drum group)\b/i.test(name)) return 'Drumline 🥁 (Group)'
  if (/\brobotics (group|team)\b/i.test(name)) return 'Alex'
  const id = findContact(name)
  if (!id) return undefined
  const c = contactById(id)!
  return c.nickname && !c.nickname.startsWith('Al') ? c.nickname : c.first
}

function findTrigger(s: string): { trigger?: string; rest: string; kind?: string } {
  const verbAhead = `(?:,\\s*|\\s+(?=(?:${VERBS})\\b))`
  let m: RegExpMatchArray | null
  // location
  if ((m = s.match(new RegExp(`^(?:when(?:ever)?|once|after|as soon as)\\s+i\\s+(leave|get to|arrive at|arrive to|arrive|reach|get)\\s+(.*?)${verbAhead}`, 'i')))) {
    const leave = /leave/i.test(m[1])
    const place = resolvePlace(m[2] || (m[1].toLowerCase() === 'get' ? 'home' : ''))
    return { trigger: leave ? `Leave ${place}` : `Arrive at ${place}`, rest: s.slice(m[0].length), kind: 'location' }
  }
  // time of day
  const timeRe = /(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)?/i
  if ((m = s.match(/^(?:every|each|on)\s+(weekday|weekend|day|morning|night|evening|monday|tuesday|wednesday|thursday|friday|saturday|sunday)s?(?:\s+(?:morning|night|evening))?(?:\s+at\s+([\d: ]+\s*(?:am|pm)?))?\s*,?\s*/i)) || (m = s.match(/^at\s+([\d: ]+\s*(?:am|pm)?)\s+(?:every|each|on)\s+(weekday|weekend|day|morning|monday|tuesday|wednesday|thursday|friday|saturday|sunday)s?\s*,?\s*/i))) {
    const first = /^at/i.test(m[0])
    const dayWord = (first ? m[2] : m[1]).toLowerCase()
    const timeStr = (first ? m[1] : m[2]) ?? (dayWord === 'morning' ? '7am' : dayWord === 'night' || dayWord === 'evening' ? '9pm' : '8am')
    const t = timeStr.match(timeRe)
    let h = t ? +t[1] : 8
    const min = t?.[2] ? +t[2] : 0
    const ap = t?.[3]?.toLowerCase().startsWith('p') ? 'PM' : t?.[3] ? 'AM' : h >= 7 && h <= 11 ? 'AM' : 'PM'
    if (h > 12) h -= 12
    const days = dayWord === 'weekday' ? 'Weekdays' : dayWord === 'weekend' ? 'Weekends' : ['day', 'morning', 'night', 'evening'].includes(dayWord) ? 'Daily' : `Every ${cap(dayWord)}`
    return { trigger: `Time of Day: ${h}:${String(min).padStart(2, '0')} ${ap}, ${days}`, rest: s.slice(m[0].length), kind: 'time' }
  }
  // screenshot (iOS 27)
  if ((m = s.match(new RegExp(`^(?:when(?:ever)?|each time|every time)\\s+i\\s+(?:take|grab|capture)\\s+a\\s+screenshot(?:\\s+(?:in|of|from|on)\\s+([\\w ]+?))?${verbAhead}`, 'i')))) {
    const app = m[1] ? title(m[1]) : 'Any App'
    return { trigger: `Screenshot taken in ${app}`, rest: s.slice(m[0].length), kind: 'screenshot' }
  }
  // notification (iOS 27)
  if ((m = s.match(new RegExp(`^(?:when(?:ever)?|if)\\s+i\\s+(?:get|receive)\\s+an?\\s+(notification|message|text|email)\\s+from\\s+([\\w .'’]+?)(?:\\s+(?:about|containing|that says)\\s+([\\w ]+?))?${verbAhead}`, 'i')))) {
    const src = recipientLabel(m[2]) ?? title(m[2])
    const kindApp = /email/i.test(m[1]) ? 'Mail' : /message|text/i.test(m[1]) ? 'Messages' : src
    return { trigger: `Notification from ${kindApp === src ? src : `${kindApp} · ${src}`}${m[3] ? ` containing “${m[3]}”` : ''}`, rest: s.slice(m[0].length), kind: 'notification' }
  }
  // focus
  if ((m = s.match(/^when\s+(?:my\s+)?(\w+(?: \w+)?)\s+focus\s+(?:turns on|starts|is on|begins)\s*,?\s*/i))) {
    return { trigger: `When ${title(m[1])} Focus turns on`, rest: s.slice(m[0].length), kind: 'focus' }
  }
  if ((m = s.match(/^when\s+(?:my\s+)?alarm\s+(?:goes off|stops|is stopped)\s*,?\s*/i))) return { trigger: 'When my alarm is stopped', rest: s.slice(m[0].length), kind: 'alarm' }
  if ((m = s.match(/^when\s+i\s+(?:connect to|get in(?:to)?)\s+(?:my\s+)?(car|carplay)\s*,?\s*/i))) return { trigger: 'When CarPlay connects', rest: s.slice(m[0].length), kind: 'carplay' }
  if ((m = s.match(/^when\s+(?:my\s+)?battery\s+(?:drops\s+)?(?:below|under|is below)\s+(\d+)%?\s*,?\s*/i))) return { trigger: `Battery Level falls below ${m[1]}%`, rest: s.slice(m[0].length), kind: 'battery' }
  return { rest: s }
}

function splitClauses(s: string): string[] {
  const re = new RegExp(`\\s*(?:,\\s*(?:and\\s+|then\\s+)?|;\\s*|\\s+and then\\s+|\\s+then\\s+|\\s+and\\s+(?=(?:${VERBS})\\b))`, 'i')
  return s.split(re).map((x) => x.trim()).filter(Boolean)
}

interface Ctx {
  out: ShortcutAction[]
  report: { kind: 'say' | 'show'; items: string[] } | null
  lastText?: ShortcutAction
  lastMessage?: ShortcutAction
  trigger?: string
  triggerKind?: string
  understood: string[]
  names: string[]
  outer?: ShortcutAction[]
}

function weatherValue(w: string): string | undefined {
  const l = w.toLowerCase()
  if (/rain|shower|wet|drizzle/.test(l)) return 'Rain'
  if (/storm|thunder/.test(l)) return 'Thunderstorms'
  if (/snow/.test(l)) return 'Snow'
  if (/sunny|sun\b|clear|nice/.test(l)) return 'Sunny'
  if (/cloud/.test(l)) return 'Cloudy'
  return undefined
}

function ensureWeather(ctx: Ctx, when: string) {
  const has = ctx.out.find((a) => a.kind === 'weather')
  if (has) return
  ctx.out.push(makeAction('weather', { when, place: 'Current Location' }))
  ctx.understood.push(`Weather ${when.toLowerCase()}`)
}

function matchPlaylist(q: string): string {
  const l = q.toLowerCase().replace(/\b(my|the|some|playlist|music|songs?)\b/g, ' ').replace(/\s+/g, ' ').trim()
  const pl = PLAYLISTS.find((p) => p.name.toLowerCase() === l) ?? PLAYLISTS.find((p) => l && (p.name.toLowerCase().includes(l) || l.includes(p.name.toLowerCase()))) ?? PLAYLISTS.find((p) => l.split(' ').some((w) => w.length > 3 && p.name.toLowerCase().includes(w)))
  if (pl) return pl.name
  const tr = TRACKS.find((t) => l.includes(t.title.toLowerCase()) || (l && t.title.toLowerCase().includes(l)))
  if (tr) return tr.title
  if (/study|focus|homework/.test(l)) return 'Study Focus'
  if (/chill|relax|sunset/.test(l)) return 'Sunset Mix'
  if (/hype|build|robot/.test(l)) return 'Robotics Build Night'
  return l ? title(l) : 'Study Focus'
}

function matchNote(q: string): string {
  const notes = useOS.getState().notes
  const words = q.toLowerCase().replace(/\b(my|the|note|notes|a)\b/g, ' ').split(/\s+/).filter((w) => w.length > 2)
  const n = notes.find((x) => words.length && words.every((w) => x.title.toLowerCase().includes(w))) ?? notes.find((x) => words.some((w) => x.title.toLowerCase().includes(w)))
  return n?.title ?? (words.length ? title(words.join(' ')) : 'Shortcuts Log')
}

function messageBody(raw: string): string {
  let b = raw.trim().replace(/^["“]|["”]$/g, '').replace(/’/g, "'")
  b = b.replace(/\b(with|and include|including|plus)\s+(my\s+)?(eta|arrival time|travel time)\b/i, '').trim()
  if (/^i'?m\s+/i.test(b) || /^i am\s+/i.test(b)) b = cap(b.replace(/^i'?m\s+|^i am\s+/i, ''))
  else if (/^i\b/i.test(b)) b = 'I' + b.slice(1)
  else b = cap(b)
  b = b.replace(/\bi\b/g, 'I')
  if (!/[.!?]$/.test(b)) b += '!'
  return b.replace(/'/g, '’')
}

function addEta(ctx: Ctx, dest = 'Home') {
  if (ctx.out.some((a) => a.kind === 'eta')) return
  const eta = makeAction('eta', { to: dest, mode: 'Driving' })
  // insert before the message text if one exists
  const idx = ctx.lastText ? ctx.out.indexOf(ctx.lastText) : -1
  if (idx >= 0) ctx.out.splice(idx, 0, eta)
  else ctx.out.push(eta)
  if (ctx.lastText && !/\[Travel Time\]/.test(ctx.lastText.params.text)) ctx.lastText.params.text = `${ctx.lastText.params.text} ETA [Travel Time]`
  ctx.understood.push(`ETA to ${dest}`)
}

function clauseToActions(clause: string, ctx: Ctx) {
  const c = clause.trim().replace(/^(please|also|and|then)\s+/i, '').replace(/[.!]+$/, '')
  const l = wordsToNumbers(c.toLowerCase()).replace(/’/g, "'")
  let m: RegExpMatchArray | null

  // report items: "tell me the weather and my first event"
  if ((m = l.match(/^(tell me|read me|give me|announce|say|show me|let me know)\s+(.+)$/)) && !/\b(that|to)\b.*\b(text|message)\b/.test(l)) {
    const kind = /show/.test(m[1]) ? 'show' : 'say'
    ctx.report ??= { kind, items: [] }
    for (const item of m[2].split(/\s*(?:,|\band\b|&)\s*/).filter(Boolean)) reportItem(item, ctx)
    return
  }
  if (ctx.report && /^(my |the )?(first|next|upcoming) (event|meeting|class)|^(my )?(schedule|calendar|agenda)|^(the )?weather|^(my )?eta/.test(l)) {
    for (const item of l.split(/\s*(?:,|\band\b)\s*/).filter(Boolean)) reportItem(item, ctx)
    return
  }

  // include ETA modifier
  if (/^(include|add|attach|share|with)\s+(my\s+)?(eta|arrival time|travel time|location)/.test(l)) {
    const dest = ctx.lastText?.params.text.match(/heading (?:to )?(\w+(?: \w+)?)/i)?.[1]
    addEta(ctx, resolvePlace(dest ?? 'home'))
    return
  }

  // messages
  if ((m = c.match(/^(?:text|message|imessage|send (?:a )?(?:text|message|imessage) to|let)\s+(.+?)\s+(?:know\s+)?(?:that|saying|say|:)\s+(.+)$/i)) || (m = c.match(/^(?:text|message)\s+(my\s+)?(\w+(?:\s(?:group|chat))?)\s+(.+)$/i)) || (m = c.match(/^tell\s+(?!me\b)(.+?)\s+(?:that\s+)?(.+)$/i))) {
    const who = m.length === 4 ? m[2] : m[1]
    const body = m.length === 4 ? m[3] : m[2]
    const to = recipientLabel(who) ?? title(who.replace(/^my\s+/i, ''))
    const withEta = /\b(eta|arrival time|travel time)\b/i.test(body)
    const text = makeAction('text', { text: messageBody(body) })
    ctx.out.push(text)
    ctx.lastText = text
    const msg = makeAction('message', { text: '[Text]', to })
    ctx.out.push(msg)
    ctx.lastMessage = msg
    ctx.understood.push(`Message ${to}`)
    ctx.names.push(/heading home/i.test(body) ? 'Heading Home' : `Text ${to.replace(/ \(Group\)$/, '').replace(/ 🥁/, '')}`)
    if (withEta) {
      const dest = body.match(/heading (?:to )?(\w+(?: \w+)?)/i)?.[1]
      addEta(ctx, resolvePlace(dest ?? 'home'))
    }
    return
  }
  if ((m = c.match(/^email\s+(.+?)\s+(?:that|saying|about|:)\s+(.+)$/i))) {
    const to = recipientLabel(m[1]) ?? title(m[1])
    const text = makeAction('text', { text: messageBody(m[2]) })
    ctx.out.push(text, makeAction('email', { text: '[Text]', to }))
    ctx.lastText = text
    ctx.understood.push(`Email ${to}`)
    return
  }

  // screenshot / on-screen
  if (/\b(take|grab|capture) a screenshot\b/.test(l)) {
    ctx.out.push(makeAction('screenshot'))
    ctx.understood.push('Screenshot')
    if (!/\b(save|append|add|put)\b/.test(l)) return
  }
  if (/what'?s on (my )?screen|screen content|on-screen/.test(l) && !/\bnote\b/.test(l)) {
    ctx.out.push(makeAction('screen', { content: 'All Content' }))
    ctx.understood.push('What’s on screen')
    return
  }
  if ((m = l.match(/\b(?:save|append|add|put|log|copy)\s+(?:it|this|that|them|the screenshot|the page|the text|a copy)?\s*(?:to|in|into)\s+(?:my\s+|the\s+)?(.+?)\s+note\b/)) || (m = l.match(/\b(?:save|append|add|put|log)\s+(?:it|this|that)?\s*(?:to|in|into)\s+(?:my\s+|the\s+)?notes?\b(.*)$/))) {
    const shot = ctx.triggerKind === 'screenshot' || ctx.out.some((a) => a.kind === 'screenshot')
    if (!ctx.out.some((a) => a.kind === 'screen')) {
      const scr = makeAction('screen', { content: shot ? 'All Content' : 'Text' })
      ctx.out.push(scr)
      ctx.understood.push(shot ? 'Screenshot contents' : 'What’s on screen')
    }
    const note = matchNote(m[1] ?? '')
    ctx.out.push(makeAction('note', { text: '[Screen Content]', note }))
    ctx.understood.push(`Note “${note}”`)
    ctx.names.push(shot ? `Screenshot to ${note.split(' ')[0]}` : `Save to ${note.split(' ')[0]}`)
    return
  }
  if (/\b(save|add) (it|this|them|the screenshot) to (my )?(photos|album|camera roll)/.test(l)) {
    ctx.out.push(makeAction('savePhoto', { input: ctx.out.some((a) => a.kind === 'screenshot') ? '[Screenshot]' : '[Screen Content]', album: /robot/.test(l) ? 'Robotics' : 'Recents' }))
    return
  }

  // reminders
  if ((m = c.match(/^(?:remind me|add a reminder|create a reminder|don'?t let me forget)\s*(?:to|about)?\s+(.+)$/i))) {
    const pr = parseReminder(`remind me to ${m[1]}`)
    const whenM = m[1].match(/\b(tomorrow(?: morning| night| at [\d: ]+\s*(?:am|pm)?)?|tonight|today|this (?:morning|afternoon|evening)|at [\d: ]+\s*(?:am|pm)|in \d+ \w+|on \w+day(?: at [\d: ]+\s*(?:am|pm)?)?|next \w+)\b.*$/i)
    const when = whenM ? whenM[0] : [...ctx.out, ...(ctx.outer ?? [])].some((a) => a.kind === 'weather' && a.params.when === 'Tomorrow') ? 'tomorrow at 7 AM' : ctx.triggerKind === 'location' ? 'now' : 'in 1 hour'
    ctx.out.push(makeAction('reminder', { title: pr.title.replace(/\s+(tomorrow|tonight|today).*$/i, ''), when }))
    ctx.understood.push(`Reminder “${pr.title}”`)
    ctx.names.push(`Remind ${pr.title.split(' ').slice(0, 2).join(' ')}`)
    return
  }

  // focus
  if ((m = l.match(/\b(?:turn|switch|set)\s+(on|off)\s+(?:my\s+|the\s+)?(\w+(?: \w+)?)\s+focus\b/)) || (m = l.match(/\b(?:turn|switch)\s+(?:my\s+|the\s+)?(\w+(?: \w+)?)\s+focus\s+(on|off)\b/)) || (m = l.match(/\b(start|enable|begin|stop|end|disable)\s+(?:my\s+|the\s+)?(\w+(?: \w+)?)\s+focus\b/))) {
    const onoff = /^(on|start|enable|begin)$/.test(m[1]) || m[2] === 'on' ? 'On' : 'Off'
    const nameRaw = /^(on|off|start|enable|begin|stop|end|disable)$/.test(m[1]) ? m[2] : m[1]
    const focus = FOCUSES.find((f) => f.toLowerCase() === nameRaw.toLowerCase()) ?? FOCUSES.find((f) => nameRaw.toLowerCase().includes(f.toLowerCase())) ?? 'Do Not Disturb'
    ctx.out.push(makeAction('focus', { focus, state: onoff, until: 'Turned Off' }))
    ctx.understood.push(`${focus} Focus ${onoff.toLowerCase()}`)
    return
  }
  if (/\b(do not disturb|dnd)\b/.test(l)) {
    ctx.out.push(makeAction('focus', { focus: 'Do Not Disturb', state: /off/.test(l) ? 'Off' : 'On', until: 'Turned Off' }))
    return
  }

  // home
  if (/\blights?\b|\blamps?\b/.test(l)) {
    const room = /bedroom|my room|jamie/.test(l) ? 'Jamie’s Room' : /living/.test(l) ? 'Living Room' : /kitchen/.test(l) ? 'Kitchen' : /porch/.test(l) ? 'Front Porch' : /\ball\b/.test(l) ? 'All Lights' : 'Jamie’s Room'
    const pct = l.match(/(\d{1,3})\s*%/)
    const level = pct ? `${pct[1]}%` : /\bdim\b/.test(l) ? '30%' : /\boff\b/.test(l) ? 'Off' : /brighten|full|\bon\b/.test(l) ? '100%' : '50%'
    ctx.out.push(makeAction('lights', { target: room, level }))
    ctx.understood.push(`Lights ${level}`)
    return
  }
  if (/\b(lock|unlock)\b.*\bdoor\b/.test(l)) {
    ctx.out.push(makeAction('lock', { state: /unlock/.test(l) ? 'Unlock' : 'Lock', door: 'Front Door' }))
    return
  }
  const scene = HOME_SCENES.find((s) => l.includes(s.name.toLowerCase()))
  if (scene && /\b(scene|run|set|activate|start)\b/.test(l)) {
    ctx.out.push(makeAction('scene', { scene: scene.name }))
    return
  }

  // music
  if ((m = l.match(/^(?:play|put on|start playing|shuffle)\s+(.+)$/))) {
    const playlist = matchPlaylist(m[1])
    ctx.out.push(makeAction('music', { playlist, shuffle: /shuffle/.test(l) ? 'On' : 'Off' }))
    ctx.understood.push(`Play ${playlist}`)
    return
  }

  // timer
  if (/\btimer\b|\bpomodoro\b/.test(l)) {
    const secs = parseDuration(l) ?? 25 * 60
    const mins = Math.round(secs / 60)
    ctx.out.push(makeAction('timer', { duration: mins >= 60 && mins % 60 === 0 ? `${mins / 60} hour${mins > 60 ? 's' : ''}` : `${mins} minutes` }))
    ctx.understood.push(`Timer ${mins} min`)
    return
  }

  // weather / events / eta as standalone gets
  if (/\bweather|forecast|temperature\b/.test(l) && /^(get|check|what)/.test(l)) {
    ensureWeather(ctx, /tomorrow/.test(l) ? 'Tomorrow' : 'Now')
    ctx.out.push(makeAction('showResult', { text: '[Weather]' }))
    return
  }
  if (/\b(eta|travel time|how long)\b/.test(l)) {
    const to = l.match(/\bto\s+(.+)$/)?.[1]
    ctx.out.push(makeAction('eta', { to: resolvePlace(to ?? 'home'), mode: /walk/.test(l) ? 'Walking' : 'Driving' }))
    return
  }

  // data store (iOS 27)
  if ((m = c.match(/^(?:save|store|remember)\s+(.+?)\s+as\s+(.+)$/i)) || (m = c.match(/^remember\s+(?:that\s+)?(.+)$/i))) {
    ctx.out.push(makeAction('dataSave', { value: m[1], key: (m[2] ?? 'memo').toLowerCase().replace(/\s+/g, '-') }))
    ctx.understood.push('Data Store')
    return
  }
  if ((m = l.match(/\b(?:get|recall|load)\s+(?:the\s+)?(?:stored|saved)\s+(?:value|data)?\s*(?:for\s+)?(.*)$/))) {
    ctx.out.push(makeAction('dataGet', { key: (m[1] || 'last-run').trim().replace(/\s+/g, '-') }))
    return
  }

  // Apple Intelligence
  if (/\bsummari[sz]e\b/.test(l)) {
    if (!ctx.out.some((a) => a.kind === 'screen')) ctx.out.push(makeAction('screen', { content: 'Text' }))
    ctx.out.push(makeAction('summarize', { text: '[Screen Content]' }))
    if (!/\b(send|text|save)\b/.test(l)) ctx.out.push(makeAction('showResult', { text: '[Summary]' }))
    return
  }

  // device
  if (/\bdark mode\b|\blight mode\b/.test(l)) {
    ctx.out.push(makeAction('appearance', { mode: /light mode|turn off dark|disable dark/.test(l) ? 'Light' : 'Dark' }))
    return
  }
  if (/\blow power\b/.test(l)) {
    ctx.out.push(makeAction('lowPower', { state: /\boff\b|disable/.test(l) ? 'Off' : 'On' }))
    return
  }
  if ((m = l.match(/^(?:notify me|send me a notification|show (?:a )?notification|alert me)\s*(?:that|saying|:)?\s*(.*)$/))) {
    ctx.out.push(makeAction('notification', { text: cap(m[1] || 'Shortcut finished') }))
    return
  }
  if ((m = l.match(/^(?:wait|pause)\s+(?:for\s+)?(\d+)\s*(second|minute)/))) {
    ctx.out.push(makeAction('wait', { seconds: `${m[1]} ${m[2]}${+m[1] > 1 ? 's' : ''}` }))
    return
  }
  if ((m = l.match(/^(?:open|launch)\s+(.+)$/))) {
    const target = m[1].replace(/^(the|my)\s+/, '').replace(/\s+app$/, '')
    if (/\.\w{2,}|https?:/.test(target)) ctx.out.push(makeAction('url', { url: target }))
    else {
      const app = Object.values(ICONS).find((i) => i.name.toLowerCase() === target.trim())
      ctx.out.push(app ? makeAction('openApp', { app: app.name }) : makeAction('url', { url: `${target.replace(/\s+/g, '')}.example` }))
    }
    return
  }
  if ((m = l.match(/^(?:speak|read aloud|say out loud)\s+(.+)$/))) {
    ctx.out.push(makeAction('speak', { text: cap(m[1]) }))
    return
  }

  // fallback: ask Apple Intelligence to handle the step
  ctx.out.push(makeAction('model', { model: 'Private Cloud Compute', prompt: cap(c) }))
  ctx.out.push(makeAction('showResult', { text: '[Response]' }))
  ctx.understood.push(`Apple Intelligence: “${cap(c)}”`)
}

function reportItem(item: string, ctx: Ctx) {
  const l = item.toLowerCase().trim()
  if (!l) return
  if (/weather|forecast|temperature|rain/.test(l)) {
    ensureWeather(ctx, /tomorrow/.test(l) ? 'Tomorrow' : 'Today')
    ctx.report!.items.push('[Weather]')
  } else if (/event|meeting|class|schedule|calendar|agenda/.test(l)) {
    ctx.out.push(makeAction('nextEvent', { which: /first/.test(l) ? 'First' : 'Next', range: /tomorrow/.test(l) ? 'Tomorrow' : 'Today' }))
    ctx.report!.items.push(/first/.test(l) ? 'First up: [Event]' : 'Next: [Event]')
    ctx.understood.push(`${/first/.test(l) ? 'First' : 'Next'} event`)
  } else if (/eta|travel|commute|traffic/.test(l)) {
    ctx.out.push(makeAction('eta', { to: /school/.test(l) ? 'Lincoln High School' : 'Home', mode: 'Driving' }))
    ctx.report!.items.push('Travel time: [Travel Time]')
  } else if (/stored|saved/.test(l)) {
    ctx.out.push(makeAction('dataGet', { key: 'last-run' }))
    ctx.report!.items.push('[Stored Data]')
  } else if (/screen/.test(l)) {
    ctx.out.push(makeAction('screen', { content: 'Text' }))
    ctx.report!.items.push('[Screen Content]')
  } else {
    ctx.out.push(makeAction('model', { model: 'On-Device', prompt: `Tell me ${item}` }))
    ctx.report!.items.push('[Response]')
  }
}

function finishReport(ctx: Ctx, greetingHint?: string) {
  if (!ctx.report || !ctx.report.items.length) return
  const greet = greetingHint ?? 'Hi Jamie!'
  const body = `${greet} ${ctx.report.items.map((x, i) => (i === 0 ? x : x)).join('. ')}.`.replace(/\.\./g, '.')
  const text = makeAction('text', { text: body })
  ctx.out.push(text)
  ctx.out.push(ctx.report.kind === 'say' ? makeAction('speak', { text: '[Text]' }) : makeAction('showResult', { text: '[Text]' }))
  ctx.names.push(greet.startsWith('Good morning') ? 'Morning Briefing' : 'Daily Briefing')
  ctx.report = null
}

function conditionFrom(cond: string, ctx: Ctx): { input: string; cond: string; value: string } {
  const w = weatherValue(cond)
  if (w || /weather|forecast|going to be/.test(cond)) {
    ensureWeather(ctx, /tomorrow/.test(cond) ? 'Tomorrow' : ctx.out.find((a) => a.kind === 'weather')?.params.when ?? 'Today')
    return { input: 'Weather', cond: 'contains', value: w ?? 'Rain' }
  }
  let m: RegExpMatchArray | null
  if ((m = cond.match(/battery (?:is )?(?:below|under|less than) (\d+)/))) return { input: 'Battery Level', cond: 'is', value: `below ${m[1]}%` }
  if (/focus/.test(cond)) return { input: 'Current Focus', cond: 'is', value: FOCUSES.find((f) => cond.includes(f.toLowerCase())) ?? 'Study' }
  if ((m = cond.match(/(?:i have|there'?s|there is) (?:an? )?(.+?) (?:today|tomorrow)?$/))) {
    if (!ctx.out.some((a) => a.kind === 'nextEvent')) ctx.out.push(makeAction('nextEvent', { which: 'All', range: /tomorrow/.test(cond) ? 'Tomorrow' : 'Today' }))
    return { input: 'Event', cond: 'contains', value: title(m[1]) }
  }
  if (!ctx.out.some((a) => a.kind === 'model')) ctx.out.push(makeAction('model', { model: 'On-Device', prompt: `Is it true that ${cond}? Answer yes or no.` }))
  return { input: 'Response', cond: 'contains', value: 'Yes' }
}

function splitCondAction(seg: string): [string, string] {
  const comma = seg.indexOf(',')
  if (comma > 0) return [seg.slice(0, comma).trim(), seg.slice(comma + 1).trim()]
  const vm = seg.match(VERB_RE)
  // skip verbs that are part of the condition (e.g. "it's going to rain")
  const re = new RegExp(`\\s(?:then\\s+)?(${VERBS})\\b`, 'ig')
  let m: RegExpExecArray | null
  while ((m = re.exec(seg))) {
    if (m.index > 3 && !/going$|is$|it's$/.test(seg.slice(0, m.index).trim())) return [seg.slice(0, m.index).replace(/\s+then$/, '').trim(), seg.slice(m.index).trim()]
  }
  if (vm && vm.index) return [seg.slice(0, vm.index).trim(), seg.slice(vm.index).trim()]
  return [seg, '']
}

function sub(ctx: Ctx, text: string): ShortcutAction[] {
  const inner: Ctx = { ...ctx, out: [], report: null, lastText: undefined, lastMessage: undefined, outer: ctx.out, understood: [], names: [] }
  for (const cl of splitClauses(text)) clauseToActions(cl, inner)
  finishReport(inner)
  ctx.understood.push(...inner.understood.filter((u) => !ctx.understood.includes(u)))
  ctx.names.push(...inner.names)
  return inner.out
}

export function composeShortcut(input: string): Composed {
  let s = input.trim().replace(/\s+/g, ' ').replace(/[.!]+$/, '')
  const ctx: Ctx = { out: [], report: null, understood: [], names: [] }
  let name: string | undefined

  // "Start study mode: …" → explicit name
  const named = s.match(/^(?:create |make |build )?(?:a )?(?:shortcut (?:called|named) )?(?:start |begin |run )?([\w '’]{2,30}?)\s*:\s+(.+)$/i)
  if (named) {
    name = title(named[1].replace(/^(start|begin|run)\s+/i, ''))
    s = named[2]
  }
  s = s.replace(/^(?:create|make|build) (?:a |me a )?shortcut (?:that|which|to)\s+/i, '')

  const trig = findTrigger(s)
  ctx.trigger = trig.trigger
  ctx.triggerKind = trig.kind
  if (trig.trigger) ctx.understood.push(`Trigger: ${trig.trigger}`)
  s = trig.rest.trim()

  // conditionals with Otherwise If / Otherwise (iOS 27)
  if (/^if\s+/i.test(s)) {
    const segs = s.split(/\s*,?\s*\b(else if|otherwise if|or if|elif|else|otherwise)\b\s*,?\s*/i)
    const first = segs[0].replace(/^if\s+/i, '')
    const [c0, a0] = splitCondAction(first)
    const ifAct = makeAction('if', conditionFrom(c0.toLowerCase(), ctx))
    ifAct.children = sub(ctx, a0)
    for (let i = 1; i < segs.length; i += 2) {
      const kw = segs[i].toLowerCase()
      const body = segs[i + 1] ?? ''
      if (kw === 'else' || kw === 'otherwise') ifAct.otherwise = sub(ctx, body)
      else {
        const [ci, ai] = splitCondAction(body)
        const cond = conditionFrom(ci.toLowerCase(), ctx)
        ifAct.elseIf = [...(ifAct.elseIf ?? []), { condition: `${cond.input} ${cond.cond}${cond.cond === 'has any value' ? '' : ` ${cond.value}`}`, actions: sub(ctx, ai) }]
      }
    }
    ctx.out.push(ifAct)
    ctx.understood.push(`If ${ifAct.params.input} ${ifAct.params.cond} ${ifAct.params.value}${ifAct.elseIf?.length ? ` · ${ifAct.elseIf.length} Otherwise If` : ''}`)
    if (!name) name = ifAct.params.input === 'Weather' ? 'Weather Check' : 'Smart Check'
  } else {
    for (const cl of splitClauses(s)) clauseToActions(cl, ctx)
    finishReport(ctx, trig.kind === 'time' && /AM/.test(trig.trigger ?? '') ? 'Good morning, Jamie!' : undefined)
  }

  if (!ctx.out.length) {
    ctx.out.push(makeAction('model', { model: 'Private Cloud Compute', prompt: cap(s || input) }), makeAction('showResult', { text: '[Response]' }))
  }

  name ??= ctx.names[0] ?? title(input.replace(/^(when|every|if)\b.*?,\s*/i, '').split(/\s+/).slice(0, 4).join(' ')).slice(0, 32)
  const firstKinds = flatKinds(ctx.out)
  const style =
    firstKinds.includes('message') ? { color: '#34c759', icon: 'message' }
      : firstKinds.includes('if') && firstKinds.includes('weather') ? { color: '#0a84ff', icon: 'umbrella' }
        : firstKinds.includes('focus') ? { color: '#5856d6', icon: 'moon' }
          : firstKinds.includes('screen') || firstKinds.includes('screenshot') ? { color: '#af52de', icon: 'camera' }
            : firstKinds.includes('weather') ? { color: '#32ade6', icon: 'sun' }
              : firstKinds.includes('music') ? { color: '#ff2d55', icon: 'music' }
                : firstKinds.includes('lights') || firstKinds.includes('scene') ? { color: '#ff9500', icon: 'home' }
                  : firstKinds.includes('reminder') ? { color: '#0a84ff', icon: 'list' }
                    : { color: '#bf5af2', icon: 'sparkles' }
  return { name, ...style, trigger: trig.trigger, actions: ctx.out, understood: ctx.understood }
}

function flatKinds(list: ShortcutAction[]): string[] {
  return list.flatMap((a) => [a.kind, ...flatKinds(a.children ?? []), ...(a.elseIf ?? []).flatMap((e) => flatKinds(e.actions)), ...flatKinds(a.otherwise ?? [])])
}

export const DESCRIBE_EXAMPLES = [
  'When I leave school, text Dad that I’m heading home and include my ETA',
  'Every weekday at 7am, tell me the weather and my first event',
  'When I take a screenshot in Safari, save it to my Robotics note',
  'If it’s going to rain tomorrow remind me to bring an umbrella, else if it’s sunny play my Sunset Mix',
  'Start study mode: turn on Study focus, dim lights, play Study Focus',
  'When I get a message from the Drumline group, turn on the porch light',
]
