/* Messages "server": delivery status, background uploads, simulated replies & Tapbacks. */
import { useOS } from '../../os/store'
import type { Attachment, Conversation, Message } from '../../os/types'
import { contactById } from '../../os/data/people'
import { smartReplies } from '../../os/ai/writing'
import { playAlert } from '../../os/audio'
import { msgLocal } from './msgStore'
import { shortName, fullName } from '../contacts/shared'

const S = () => useOS.getState()

export const isOnline = (n = S().net) => !n.airplane && (n.wifi || n.cellular)

export function convTitle(c: Conversation): string {
  if (c.name) return c.name
  if (c.participants.length === 1) {
    const ct = contactById(c.participants[0])
    if (ct?.nickname && ['Mom', 'Dad', 'Grandma'].includes(ct.nickname)) return ct.nickname
    return fullName(ct) || c.participants[0]
  }
  return c.participants.map((p) => shortName(p)).join(', ')
}

export function convShortTitle(c: Conversation): string {
  if (c.name) return c.name
  if (c.participants.length === 1) {
    const ct = contactById(c.participants[0])
    if (!ct) return c.participants[0]
    return ct.isBusiness ? ct.first : ct.nickname && ['Mom', 'Dad', 'Grandma'].includes(ct.nickname) ? ct.nickname : ct.first
  }
  return c.participants.map((p) => shortName(p)).join(' & ')
}

export function isBusinessConv(c: Conversation) {
  return c.participants.length === 1 && !!contactById(c.participants[0])?.isBusiness
}

export function attachmentNoun(a: Attachment, article = true): string {
  const map: Record<string, [string, string]> = {
    photo: ['a photo', 'Photo'],
    video: ['a video', 'Video'],
    link: ['a link', 'Link'],
    audio: ['an audio message', 'Audio Message'],
    drawing: ['a drawing', 'Drawing'],
    location: ['a location', 'Location'],
    file: ['a file', 'File'],
  }
  return map[a.kind]?.[article ? 0 : 1] ?? 'an attachment'
}

export function previewText(m: Message): string {
  if (m.text) return m.text
  const a = m.attachment
  if (!a) return ''
  if (a.kind === 'link') return a.title ?? a.url ?? 'Link'
  if (a.kind === 'video') return a.offloaded ? `Video · ${a.sizeMB ?? 0} MB` : 'Video'
  if (a.kind === 'audio') return `Audio Message · ${Math.round(a.duration ?? 0)}s`
  return attachmentNoun(a, false)
}

/** "Leo and 2 others reacted ❤️ to a photo" */
export function reactionSummary(m: Message): string | null {
  const others = (m.reactions ?? []).filter((r) => r.from !== 'me')
  if (!others.length) return null
  const people = [...new Set(others.map((r) => r.from))]
  const emojis = [...new Set(others.map((r) => r.emoji))].slice(0, 3).join('')
  const what = m.attachment ? attachmentNoun(m.attachment) : `“${(m.text ?? '').slice(0, 26)}${(m.text ?? '').length > 26 ? '…' : ''}”`
  const n0 = shortName(people[0])
  const who = people.length === 1 ? n0 : people.length === 2 ? `${n0} and ${shortName(people[1])}` : `${n0} and ${people.length - 1} others`
  return `${who} reacted ${emojis} to ${what}`
}

// ---------------------------------------------------------------------------
// Sending

const patch = (convId: string, id: string, p: Partial<Message>) => S().patchMessage(convId, id, p)
const getMsg = (convId: string, id: string) => S().conversations.find((c) => c.id === convId)?.messages.find((m) => m.id === id)

export function sendMsg(convId: string, msg: Partial<Message>, opts: { replyTo?: string } = {}): string {
  const st = S()
  const large = (msg.attachment?.sizeMB ?? 0) >= 50
  const attachment = msg.attachment ? { ...msg.attachment, ...(large ? { progress: 0 } : {}) } : undefined
  const id = st.sendMessage(convId, { ...msg, attachment, status: 'sending' })
  if (opts.replyTo) msgLocal().set({ replies: { ...msgLocal().replies, [id]: opts.replyTo } })
  playAlert('sent', st.silent ? 0 : st.volume * 0.6)
  if (large) {
    startUpload(convId, id)
    return id
  }
  deliver(convId, id, 550 + (attachment ? 600 : 0))
  return id
}

function deliver(convId: string, id: string, delay: number) {
  window.setTimeout(() => {
    const m = getMsg(convId, id)
    if (!m || (m.status !== 'sending' && m.status !== 'retrying')) return
    if (!isOnline()) return patch(convId, id, { status: 'failed' })
    patch(convId, id, { status: 'delivered' })
    afterDelivered(convId, id)
  }, delay)
}

export function retry(convId: string, id: string) {
  patch(convId, id, { status: 'retrying' })
  deliver(convId, id, 900)
}

function afterDelivered(convId: string, id: string) {
  const conv = S().conversations.find((c) => c.id === convId)
  const m = getMsg(convId, id)
  if (!conv || !m) return
  const group = conv.participants.length > 1
  const business = isBusinessConv(conv)
  if (business) return maybeReply(conv, m)
  if (!group) {
    window.setTimeout(() => {
      const cur = getMsg(convId, id)
      if (!cur || cur.status !== 'delivered') return
      patch(convId, id, { status: 'read' })
      msgLocal().set({ readAt: { ...msgLocal().readAt, [id]: Date.now() } })
      maybeReply(conv, cur)
    }, 1600 + Math.random() * 1400)
  } else {
    maybeReply(conv, m)
  }
}

// ---------------------------------------------------------------------------
// Background upload of large media (keeps going while you keep texting)

const uploads = new Map<string, { convId: string; total: number }>()
let uploadTimer: number | undefined

function startUpload(convId: string, id: string) {
  const m = getMsg(convId, id)
  uploads.set(id, { convId, total: m?.attachment?.sizeMB ?? 100 })
  if (uploadTimer) return
  uploadTimer = window.setInterval(() => {
    const online = isOnline()
    for (const [mid, u] of uploads) {
      const cur = getMsg(u.convId, mid)
      if (!cur?.attachment) {
        uploads.delete(mid)
        continue
      }
      if (!online) continue
      const rate = S().net.activePath === 'cellular' || !S().net.wifi ? 14 : 26 // MB/s
      const next = Math.min(1, (cur.attachment.progress ?? 0) + (rate * 0.25) / u.total)
      patch(u.convId, mid, { attachment: { ...cur.attachment, progress: next } })
      if (next >= 1) {
        uploads.delete(mid)
        patch(u.convId, mid, { status: 'delivered', ts: cur.ts })
        afterDelivered(u.convId, mid)
      }
    }
    if (!uploads.size) {
      window.clearInterval(uploadTimer)
      uploadTimer = undefined
    }
  }, 250)
}

export function cancelUpload(convId: string, id: string) {
  uploads.delete(id)
  S().set({ conversations: S().conversations.map((c) => (c.id === convId ? { ...c, messages: c.messages.filter((m) => m.id !== id) } : c)) })
}

/** Resume uploads / stale sends after a reload. */
export function resumePending() {
  for (const c of S().conversations) {
    for (const m of c.messages) {
      if (m.from !== 'me') continue
      if (m.attachment && (m.attachment.progress ?? 1) < 1 && m.status === 'sending') {
        if (!uploads.has(m.id)) startUpload(c.id, m.id)
      } else if (m.status === 'sending' || m.status === 'retrying') {
        deliver(c.id, m.id, 500)
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Downloading offloaded media

export function download(convId: string, id: string) {
  const m = getMsg(convId, id)
  if (!m?.attachment?.offloaded) return
  if (msgLocal().downloads[id] !== undefined) return
  if (!isOnline()) {
    S().showToast('No internet connection', '⚠️')
    return
  }
  const total = m.attachment.sizeMB ?? 100
  msgLocal().set({ downloads: { ...msgLocal().downloads, [id]: 0 } })
  const t = window.setInterval(() => {
    const p = msgLocal().downloads[id] ?? 0
    const next = Math.min(1, p + (60 * 0.2) / total)
    msgLocal().set({ downloads: { ...msgLocal().downloads, [id]: next } })
    if (next >= 1) {
      window.clearInterval(t)
      const cur = getMsg(convId, id)
      if (cur?.attachment) patch(convId, id, { attachment: { ...cur.attachment, offloaded: false } })
      const d = { ...msgLocal().downloads }
      delete d[id]
      msgLocal().set({ downloads: d })
    }
  }, 200)
}

// ---------------------------------------------------------------------------
// Tapbacks

export function toggleReaction(convId: string, msgId: string, emoji: string) {
  const m = getMsg(convId, msgId)
  if (!m) return
  const mine = m.reactions?.find((r) => r.from === 'me')
  const others = (m.reactions ?? []).filter((r) => r.from !== 'me')
  patch(convId, msgId, { reactions: mine?.emoji === emoji ? others : [...others, { from: 'me', emoji }] })
}

function addReaction(convId: string, msgId: string, from: string, emoji: string) {
  const m = getMsg(convId, msgId)
  if (!m) return
  patch(convId, msgId, { reactions: [...(m.reactions ?? []).filter((r) => r.from !== from), { from, emoji }] })
}

/** A burst of Tapbacks from several people → one consolidated notification. */
function reactionBurst(conv: Conversation, msgId: string) {
  const people = conv.participants
  const emojis = ['❤️', '❤️', '😂', '‼️']
  let t = 900
  people.forEach((p, i) => {
    t += 500 + Math.random() * 700
    window.setTimeout(() => addReaction(conv.id, msgId, p, i === 0 ? '❤️' : emojis[Math.floor(Math.random() * 2)]), t)
  })
  window.setTimeout(() => {
    const m = getMsg(conv.id, msgId)
    const sum = m && reactionSummary(m)
    if (!sum) return
    const st = S()
    const viewing = st.openApp === 'messages' && msgLocal().openConv === conv.id
    if (!viewing) {
      st.notify({ app: 'messages', title: convTitle(conv), body: sum, thread: conv.id, route: `conv/${conv.id}/${msgId}` })
    }
  }, t + 200)
}

// ---------------------------------------------------------------------------
// Simulated replies

function pick<T>(a: T[]): T {
  return a[Math.floor(Math.random() * a.length)]
}

function lastIncoming(conv: Conversation): Message | undefined {
  for (let i = conv.messages.length - 1; i >= 0; i--) if (conv.messages[i].from !== 'me') return conv.messages[i]
}

function replyText(conv: Conversation, from: string, m: Message): string | null {
  const c = contactById(from)
  const fam = c?.tone === 'family'
  const t = (m.text ?? '').toLowerCase()
  const prev = lastIncoming(conv)?.text?.toLowerCase() ?? ''
  if (c?.isBusiness) {
    if (from === 'skyward') return /help/.test(t) ? 'Skyward Airlines: For help with trip 7XKQ2P visit skyward.example/help or call (800) 555-0142. Msg&data rates may apply.' : null
    return null
  }
  if (m.attachment?.kind === 'photo') {
    if (from === 'dad' && /photo|biscuit/.test(prev)) return 'That’s the one! Thanks kiddo, printing it for Grandma tonight 🖨️❤️'
    return fam ? pick(['Aww I love this ❤️', 'So cute!! 😍', 'Beautiful!']) : pick(['LOL amazing', 'omg 😂', 'this is so good', 'W photo 🔥'])
  }
  if (m.attachment?.kind === 'drawing') return pick(['haha did you draw that?', 'masterpiece 🎨', 'lol what is that 😂'])
  if (m.attachment?.kind === 'location') return fam ? 'Thanks! Drive safe ❤️' : 'bet, omw'
  if (m.attachment?.kind === 'audio') return pick(['lol just listened 😂', 'got it!'])
  if (m.attachment?.kind === 'video') return fam ? 'Wow! So proud of you ❤️' : pick(['that was CLEAN 🔥', 'yooo', 'sending this to everyone lol'])
  if (from === 'sam' && /remind|got you|reminder|will do|on it/.test(t)) return 'lifesaver 🙏 I owe you'
  if (/\b(what time|when)\b/.test(t)) {
    if (/robot/.test(t) || ['alex', 'nora', 'delgado'].includes(from)) return from === 'delgado' ? 'Thursday at 6:30 PM in Room 114.' : '6:30 Thursday, room 114 👍'
    if (/practice|sectional|drum|band/.test(t) || ['sam', 'priya', 'leo'].includes(from)) return 'Saturday 9am in the band room'
    if (/dinner|home/.test(t) || fam) return 'Dinner’s at 6! Don’t be late ❤️'
    return 'I think around 6? I’ll double check'
  }
  if (/\bwhere\b/.test(t)) return /robot/.test(t) ? 'Room 114 like always' : fam ? 'I’ll text you the address 🙂' : 'library? or brew lab'
  if (/how are you|how’s it going|how's it going|\bwyd\b|what are you doing/.test(t)) return fam ? 'Good! Just got home. How was school?' : 'nm just finished chem hw 😮‍💨 you?'
  if (/\b(want to|wanna|down to|should we|let’s|let's)\b/.test(t)) return fam ? 'Sounds lovely!' : 'yes!! 🙌'
  if (/thank|thx|ty\b/.test(t)) return fam ? 'Anytime sweetie ❤️' : pick(['anytime!', 'np 🙌', 'of course'])
  if (/love you/.test(t)) return fam ? 'Love you too! ❤️' : '❤️'
  if (/^(hi|hey|yo|hello|sup)\b/.test(t) && t.split(/\s+/).length <= 3) return fam ? 'Hi honey! How was your day?' : pick(['heyy', 'yo what’s up', 'hiii'])
  if (/on my way|omw|leaving now/.test(t)) return fam ? 'Ok, be safe! Text me when you get there' : 'ok see you soon'
  const opts = smartReplies(m.text ?? '', from)
  return pick(opts)
}

function maybeReply(conv: Conversation, m: Message) {
  const group = conv.participants.length > 1
  if (group && m.attachment && ['photo', 'video', 'drawing'].includes(m.attachment.kind)) {
    reactionBurst(conv, m.id)
    return
  }
  if (!group && m.attachment?.kind === 'photo' && Math.random() < 0.6) {
    window.setTimeout(() => addReaction(conv.id, m.id, conv.participants[0], '❤️'), 900)
  }
  const from = group ? pick(conv.participants) : conv.participants[0]
  const text = replyText(conv, from, m)
  const willReply = !!text && (group ? Math.random() < 0.55 : Math.random() < 0.8 || /\?\s*$/.test(m.text ?? '') || !!m.attachment)
  if (!willReply || !text) return
  // debounce: only the latest message gets a reply
  const key = conv.id
  window.clearTimeout(pendingReplies.get(key))
  pendingReplies.set(
    key,
    window.setTimeout(() => {
      if (!isOnline()) return
      setTyping(conv.id, from)
      window.setTimeout(() => {
        setTyping(conv.id, undefined)
        const st = S()
        const open = st.openApp === 'messages' && msgLocal().openConv === conv.id
        st.receiveMessage(conv.id, { from, text })
        if (st.openApp === 'messages' && !open) {
          useOS.setState({ conversations: S().conversations.map((c) => (c.id === conv.id ? { ...c, unread: (c.unread ?? 0) + 1 } : c)) })
        }
        if (open) playAlert('received', st.silent ? 0 : st.ringerVolume * 0.7)
      }, 1400 + Math.min(2600, text.length * 45))
    }, 700 + Math.random() * 900),
  )
}
const pendingReplies = new Map<string, number>()

function setTyping(convId: string, who: string | undefined) {
  msgLocal().set({ typing: { ...msgLocal().typing, [convId]: who } })
}
