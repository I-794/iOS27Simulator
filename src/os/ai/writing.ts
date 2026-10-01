/* Write with Siri — local, deterministic writing transformations.
 * Not a language model: rule-based rewriting that behaves believably for demo text. */
import { contactById, contactName, CONTACTS } from '../data/people'

export type Tone = 'friendly' | 'professional' | 'concise' | 'warm' | 'excited'

const FIXES: [RegExp, string][] = [
  [/\bi\b/g, 'I'],
  [/\bim\b/gi, "I'm"],
  [/\bive\b/gi, "I've"],
  [/\bid\b(?= (like|love|be|rather|have))/gi, "I'd"],
  [/\bdont\b/gi, "don't"],
  [/\bcant\b/gi, "can't"],
  [/\bwont\b/gi, "won't"],
  [/\bdidnt\b/gi, "didn't"],
  [/\bdoesnt\b/gi, "doesn't"],
  [/\bisnt\b/gi, "isn't"],
  [/\bthats\b/gi, "that's"],
  [/\bwhats\b/gi, "what's"],
  [/\byoure\b/gi, "you're"],
  [/\btheyre\b/gi, "they're"],
  [/\bteh\b/gi, 'the'],
  [/\brecieve\b/gi, 'receive'],
  [/\bseperate\b/gi, 'separate'],
  [/\bdefinately\b/gi, 'definitely'],
  [/\btommorow\b/gi, 'tomorrow'],
  [/\btomorow\b/gi, 'tomorrow'],
  [/\bbeleive\b/gi, 'believe'],
  [/\bwierd\b/gi, 'weird'],
  [/\bu\b/g, 'you'],
  [/\bur\b/g, 'your'],
  [/\bthx\b/gi, 'thanks'],
  [/\bpls\b/gi, 'please'],
  [/\bcould of\b/gi, 'could have'],
  [/\bshould of\b/gi, 'should have'],
  [/\balot\b/gi, 'a lot'],
  // multilingual (Spanish) accents
  [/\bestas\b/g, 'estás'],
  [/\bmanana\b/g, 'mañana'],
  [/\bcomo estas\b/gi, 'cómo estás'],
  [/\bgracias por todo\b/gi, 'gracias por todo'],
  [/ {2,}/g, ' '],
  [/ ,/g, ','],
  [/ \./g, '.'],
]

export interface ProofreadResult {
  text: string
  changes: { from: string; to: string }[]
}

export function proofread(input: string): ProofreadResult {
  let text = input
  const changes: { from: string; to: string }[] = []
  for (const [re, rep] of FIXES) {
    text = text.replace(re, (m) => {
      if (m !== rep && !(m === ' ' && rep === ' ')) changes.push({ from: m, to: rep })
      return rep
    })
  }
  // capitalize sentence starts
  text = text.replace(/(^|[.!?]\s+)([a-z])/g, (_m, a: string, b: string) => {
    changes.push({ from: b, to: b.toUpperCase() })
    return a + b.toUpperCase()
  })
  // subject-verb agreement quick wins
  text = text.replace(/\b(he|she|it) don't\b/gi, (m, p: string) => {
    changes.push({ from: m, to: `${p} doesn't` })
    return `${p} doesn't`
  })
  text = text.replace(/\b(we|they|you) was\b/gi, (m, p: string) => {
    changes.push({ from: m, to: `${p} were` })
    return `${p} were`
  })
  if (text.trim() && !/[.!?…)"'😊🙂👍❤️]$/u.test(text.trim())) {
    text = text.trim() + '.'
    changes.push({ from: '', to: '.' })
  }
  return { text, changes }
}

const FILLER = /\b(really|very|just|basically|actually|literally|kind of|sort of|I think that|I think|I guess|pretty much|you know|like,)\s*/gi

function expandContractions(t: string) {
  return t
    .replace(/\bcan't\b/gi, 'cannot')
    .replace(/\bwon't\b/gi, 'will not')
    .replace(/\bdon't\b/gi, 'do not')
    .replace(/\bI'm\b/g, 'I am')
    .replace(/\bit's\b/gi, 'it is')
    .replace(/\bthat's\b/gi, 'that is')
    .replace(/\bgonna\b/gi, 'going to')
    .replace(/\bwanna\b/gi, 'want to')
    .replace(/\byeah\b/gi, 'yes')
    .replace(/\bok\b/gi, 'okay')
    .replace(/\bhey\b/gi, 'Hello')
    .replace(/!+/g, '.')
}

function sentences(t: string): string[] {
  return (t.match(/[^.!?\n]+[.!?]*/g) ?? [t]).map((s) => s.trim()).filter(Boolean)
}

export function rewrite(input: string, tone: Tone | 'rewrite', recipientId?: string): string {
  const base = proofread(input).text
  const c = recipientId ? contactById(recipientId) : undefined
  const name = c ? (c.nickname && c.tone !== 'teacher' ? c.nickname : c.first) : undefined
  switch (tone) {
    case 'professional': {
      const body = expandContractions(base.replace(/[😊🙂👍❤️😭🙌🥁]/gu, '').trim())
      const greet = c?.tone === 'teacher' ? `Hi ${contactName(c.id, 'short')}` : name ? `Hi ${name}` : 'Hello'
      return `${greet},\n\n${body}\n\nThank you,\nJamie`
    }
    case 'concise': {
      const s = sentences(base.replace(FILLER, ''))
      return s.slice(0, Math.max(1, Math.ceil(s.length / 2))).join(' ')
    }
    case 'friendly':
    case 'warm': {
      const hi = name ? `Hey ${name}! ` : 'Hey! '
      return `${hi}${base.replace(/^(hi|hey|hello)[^,.!]*[,.!]\s*/i, '')} 😊`
    }
    case 'excited':
      return base.replace(/\./g, '!') + ' 🎉'
    default: {
      // generic rewrite: vary phrasing
      return sentences(base)
        .map((s) =>
          s
            .replace(/^Can you/i, 'Could you')
            .replace(/^I want to/i, "I'd like to")
            .replace(/\bneed to\b/gi, 'have to')
            .replace(/\bget\b/gi, 'grab')
            .replace(/\bvery good\b/gi, 'great')
            .replace(/\bbig\b/gi, 'huge'),
        )
        .join(' ')
    }
  }
}

export function summarize(input: string): string {
  const s = sentences(input.replace(/\n+/g, ' '))
  if (s.length <= 2) return s.join(' ')
  const scored = s.map((x, i) => ({ x, i, score: (x.match(/\b(\d|Thursday|Friday|Saturday|Sunday|Monday|Tuesday|Wednesday|PM|AM|confirm|moved|due|please|bring|order|flight|reservation|total)\b/gi)?.length ?? 0) * 2 + (i === 0 ? 1.5 : 0) + Math.min(x.length, 120) / 120 }))
  return scored.sort((a, b) => b.score - a.score).slice(0, 2).sort((a, b) => a.i - b.i).map((a) => a.x).join(' ')
}

export function keyPoints(input: string): string {
  return sentences(input.replace(/\n+/g, ' '))
    .filter((s) => s.length > 12)
    .slice(0, 5)
    .map((s) => `• ${s.replace(/^[•\-–]\s*/, '')}`)
    .join('\n')
}

export function toList(input: string): string {
  return input.split(/,|\band\b|\n/).map((x) => x.trim()).filter(Boolean).map((x) => `• ${x[0]?.toUpperCase()}${x.slice(1)}`).join('\n')
}

export function feedback(input: string): string[] {
  const out: string[] = []
  const words = input.trim().split(/\s+/).filter(Boolean).length
  const pr = proofread(input)
  if (pr.changes.length) out.push(`Fix ${pr.changes.length} spelling or grammar issue${pr.changes.length > 1 ? 's' : ''} (for example “${pr.changes[0].from || 'missing punctuation'}” → “${pr.changes[0].to}”).`)
  if (words > 80) out.push('This is fairly long — consider a Concise rewrite or leading with the key request.')
  if (words < 6) out.push('Add a bit more context so the reader knows what you need.')
  if (/!{2,}/.test(input)) out.push('Multiple exclamation points can read as shouting.')
  if (!/\?/.test(input) && /\b(can|could|would|will) you\b/i.test(input)) out.push('Your request reads like a question — end it with a question mark.')
  if (/\b(asap|now)\b/i.test(input)) out.push('The tone may come across as urgent; a friendlier phrasing could help.')
  if (!out.length) out.push('Clear and well organized. Nice work!')
  return out
}

/** Draft from a natural-language description, e.g. "ask Mr. Delgado if I can stay late Thursday". */
export function draft(prompt: string, recipientId?: string, kind: 'message' | 'mail' = 'message'): { body: string; subject?: string } {
  const p = prompt.trim().replace(/[.!]$/, '')
  let recipient = recipientId ? contactById(recipientId) : undefined
  if (!recipient) {
    const low = p.toLowerCase()
    recipient = CONTACTS.find((c) => low.includes(c.first.toLowerCase()) || (c.nickname && low.includes(c.nickname.toLowerCase())))
  }
  const formal = recipient?.tone === 'teacher' || kind === 'mail'
  const family = recipient?.tone === 'family'
  const who = recipient ? contactName(recipient.id, 'short') : ''
  const toSecond = (s: string) =>
    s
      .replace(/\b(him|her|them)\b/gi, 'you')
      .replace(/\bhis\b|\bher\b(?= \w)/gi, 'your')
      .replace(/\bmy\b/gi, 'my')
  let core = p
    .replace(/^(write|draft|compose|send)( a| an)? (message|text|email|note|reply)?\s*(to\s+)?/i, '')
    .replace(new RegExp(`^(to )?${who}\\s*`, 'i'), '')
  let body: string
  let m: RegExpMatchArray | null
  if ((m = core.match(/^(?:ask(?:ing)?)(?: \w+(?: \w+)?)? (?:if|whether) (.+)/i))) {
    const q = toSecond(m[1]).replace(/\bI can\b/i, 'I could').replace(/\bthey can\b/i, 'you could')
    body = formal ? `Would it be possible ${q.startsWith('I could') ? 'for me to ' + q.slice(8) : 'to know if ' + q}? Please let me know if that works.` : `Would it be okay if ${q.replace(/^I could/i, 'I')}?`
  } else if ((m = core.match(/^(?:ask(?:ing)?)(?: \w+(?: \w+)?)? (?:to|for) (.+)/i))) {
    body = formal ? `Could you please ${toSecond(m[1])}? I really appreciate your help.` : `Could you ${toSecond(m[1])}? 🙏`
  } else if ((m = core.match(/^(?:tell|let)(?: \w+(?: \w+)?)?(?: know)? (?:that )?(.+)/i))) {
    body = m[1].replace(/^I'?m\b/i, "I'm").replace(/^i /, 'I ')
    body = body[0].toUpperCase() + body.slice(1) + '.'
  } else if ((m = core.match(/^thank(?:s| you)?(?: \w+(?: \w+)?)? for (.+)/i))) {
    body = formal ? `Thank you so much for ${toSecond(m[1])}. I really appreciate it.` : `Thank you so much for ${toSecond(m[1])}! ${family ? '❤️' : '🙌'}`
  } else if ((m = core.match(/^invite(?: \w+(?: \w+)?)? to (.+)/i))) {
    body = formal ? `I wanted to invite you to ${m[1]}. Please let me know if you are able to attend.` : `Want to come to ${m[1]}? It'd be so fun!`
  } else if ((m = core.match(/^(?:apologi[sz]e|say sorry)(?: \w+(?: \w+)?)? for (.+)/i))) {
    body = `I'm really sorry about ${toSecond(m[1])}. ${formal ? 'I will make sure it does not happen again.' : "I'll make it up to you!"}`
  } else {
    core = core.replace(/^(about|regarding)\s+/i, '')
    body = formal ? `I wanted to reach out about ${core}.` : `Hey, quick thing about ${core}!`
  }
  body = proofread(body).text
  if (kind === 'mail' || formal) {
    const greet = recipient ? `Hi ${who},` : 'Hello,'
    const subj = core.split(/\s+/).slice(0, 6).join(' ')
    return { subject: subj.charAt(0).toUpperCase() + subj.slice(1), body: `${greet}\n\n${body}\n\n${recipient?.tone === 'teacher' ? 'Thank you,\nJamie Park' : 'Thanks,\nJamie'}` }
  }
  if (family) return { body: `${body}${/[.!?]$/.test(body) ? '' : '.'} Love you!` }
  return { body }
}

/** Personalized Smart Reply: short replies tuned to relationship and message content. */
export function smartReplies(lastText: string, fromId?: string): string[] {
  const t = lastText.toLowerCase()
  const c = fromId ? contactById(fromId) : undefined
  const fam = c?.tone === 'family'
  const teacher = c?.tone === 'teacher'
  if (/\?\s*$/.test(t) || /\bcan you\b|\bcould you\b|\bwill you\b/.test(t)) {
    if (/remind/.test(t)) return ['Yep, I’ll remind you!', 'Setting a reminder now 👍', 'On it']
    if (/photo|picture|pic/.test(t)) return ['Sending it now!', 'Which one?', 'Here you go 📸']
    if (/pick up|pick .* up/.test(t)) return fam ? ['Yes, I’ll get her!', 'On my way at 5', 'Can’t today, sorry'] : ['Sure!', 'What time?', 'Can’t, sorry']
    if (/study|group|library/.test(t)) return ['I’m in!', 'What time?', 'Can’t make it 😕']
    return teacher ? ['Yes, thank you!', 'I’ll check and get back to you.', 'Unfortunately I can’t.'] : fam ? ['Yes! ❤️', 'Sure thing', 'Can we talk later?'] : ['Yeah!', 'Sure', 'Nah, sorry']
  }
  if (/moved|changed|reschedul/.test(t)) return ['Thanks for the heads up!', 'Got it 👍', 'Wait, what time?']
  if (/thank/.test(t)) return fam ? ['Love you too ❤️', 'Anytime!', '😊'] : ['Anytime!', 'No problem', '🙌']
  if (/bring|charger|forget/.test(t)) return ['Will do!', 'Got it 👍', 'Remind me tomorrow?']
  return fam ? ['Sounds good ❤️', 'Okay!', 'Love you'] : teacher ? ['Thank you!', 'Sounds good.', 'Will do.'] : ['Sounds good', 'Haha', 'Nice!']
}

export function wordCount(t: string) {
  return t.trim() ? t.trim().split(/\s+/).length : 0
}
