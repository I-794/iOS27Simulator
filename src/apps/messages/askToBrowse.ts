/* Screen Time "Ask to Browse" requests carried over Messages (iOS 27).
 *
 * Child side (Settings › Screen Time › Mia › Simulate Mia's iPhone): Safari's restricted page
 * sends an Ask to Browse card to Mom in Messages. Mom answers after a short delay and the
 * site unlocks in Safari.
 * Parent side (Jamie's iPhone, a family organizer for Mia): Mia's requests arrive as cards in
 * her conversation with Approve / Decline, mirrored in Settings › Screen Time › Mia.
 *
 * Requests live in `screenTime.pendingRequests`; the message card only references the id
 * (`attachment.url = screentime:ask/<id>`, `attachment.subtitle = reason`). */
import { useOS, uid } from '../../os/store'
import type { ScreenTimeConfig } from '../../os/types'

export const ASK_PREFIX = 'screentime:ask/'
export const isAskUrl = (u?: string) => !!u && u.startsWith(ASK_PREFIX)
export const askIdOf = (u: string) => u.slice(ASK_PREFIX.length)

export const ASK_REASONS = ['For school', 'For a project', 'A friend sent it', 'Just for fun'] as const

type Req = ScreenTimeConfig['pendingRequests'][number]
const S = () => useOS.getState()

/** Mom's deterministic answers (anything not listed is approved). */
const MOM_DECLINES: Record<string, string> = {
  'gamezone.example': 'Not on a school night — ask me again on Saturday 🙂',
}
const momApproval = (host: string, reason: string) =>
  /school|project/i.test(reason) ? `Approved ✅ Good luck with the ${/project/i.test(reason) ? 'project' : 'homework'}!` : `Approved ✅ ${host} is fine — 30 minutes, then homework.`

function setST(patch: Partial<ScreenTimeConfig>) {
  const st = S()
  st.set({ screenTime: { ...st.screenTime, ...patch } })
}

export function requestById(id: string): Req | undefined {
  return S().screenTime.pendingRequests.find((r) => r.id === id)
}

/** Reason the child typed, read back from the request's message card. */
export function reasonFor(id: string): string | undefined {
  for (const c of S().conversations) {
    const m = c.messages.find((x) => x.attachment?.url === ASK_PREFIX + id)
    if (m) return m.attachment?.subtitle || undefined
  }
  return undefined
}

/** Conversation + message carrying a request's card (for "open in Messages"). */
export function routeFor(id: string): string | undefined {
  for (const c of S().conversations) {
    const m = c.messages.find((x) => x.attachment?.url === ASK_PREFIX + id)
    if (m) return `conv/${c.id}/${m.id}`
  }
  return undefined
}

/** Approve or decline a request from any surface (Messages card, Settings, in person). */
export function decideBrowse(id: string, status: 'approved' | 'denied') {
  const cfg = S().screenTime
  const req = cfg.pendingRequests.find((r) => r.id === id)
  if (!req || req.status !== 'pending') return false
  setST({
    pendingRequests: cfg.pendingRequests.map((r) => (r.id === id ? { ...r, status } : r)),
    approvedSites: status === 'approved' && !cfg.approvedSites.includes(req.site) ? [...cfg.approvedSites, req.site] : cfg.approvedSites,
  })
  return true
}

/** Child side: send an Ask to Browse request to Mom in Messages. */
export function requestToBrowse(host: string, reason: string) {
  const st = S()
  const cfg = st.screenTime
  if (cfg.pendingRequests.some((r) => r.site === host && r.status === 'pending')) return
  const id = uid('req')
  setST({ pendingRequests: [...cfg.pendingRequests, { id, site: host, ts: Date.now(), status: 'pending' }] })
  const convId = st.ensureConversation(['mom'])
  const msgId = st.sendMessage(convId, {
    text: `Ask to Browse: ${host}`,
    status: 'sent',
    attachment: { kind: 'link', url: ASK_PREFIX + id, title: host, subtitle: reason.trim() },
  })
  st.showToast('Request sent to Mom in Messages', 'send')
  window.setTimeout(() => S().patchMessage(convId, msgId, { status: 'delivered' }), 700)
  window.setTimeout(() => S().patchMessage(convId, msgId, { status: 'read' }), 2200)
  window.setTimeout(() => {
    const req = requestById(id)
    if (!req || req.status !== 'pending') return // someone already answered (e.g. in person)
    const decline = MOM_DECLINES[host]
    decideBrowse(id, decline ? 'denied' : 'approved')
    S().receiveMessage(convId, { from: 'mom', text: decline ?? momApproval(host, reason) })
  }, 5200)
}

/** Child side: a parent approves on the child's device with their Screen Time passcode. */
export function approveInPerson(host: string, allow: boolean) {
  const cfg = S().screenTime
  const open = cfg.pendingRequests.find((r) => r.site === host && r.status === 'pending')
  if (open) decideBrowse(open.id, allow ? 'approved' : 'denied')
  else {
    setST({
      pendingRequests: [...cfg.pendingRequests, { id: uid('req'), site: host, ts: Date.now(), status: allow ? 'approved' : 'denied' }],
      approvedSites: allow && !cfg.approvedSites.includes(host) ? [...cfg.approvedSites, host] : cfg.approvedSites,
    })
  }
  S().showToast(allow ? `${host} allowed` : `${host} not allowed`)
}

const CHILD_SITES: [string, string][] = [
  ['videotube.example', 'For school'],
  ['spacefacts.example', 'For a project'],
  ['gamezone.example', 'Just for fun'],
  ['drawingclub.example', 'A friend sent it'],
]

/** Parent side: Mia asks Jamie (a family organizer) to approve a website, in Messages. */
export function simulateChildRequest(): string {
  const st = S()
  const cfg = st.screenTime
  const [site, reason] = CHILD_SITES.find(([s]) => !cfg.approvedSites.includes(s) && !cfg.pendingRequests.some((r) => r.site === s && r.status === 'pending')) ?? ['kidsnews.example', 'For school']
  const id = uid('req')
  setST({ pendingRequests: [{ id, site, ts: Date.now(), status: 'pending' }, ...cfg.pendingRequests] })
  const convId = st.ensureConversation(['mia'])
  st.receiveMessage(convId, {
    from: 'mia',
    text: `Ask to Browse: Mia wants to visit ${site}`,
    attachment: { kind: 'link', url: ASK_PREFIX + id, title: site, subtitle: reason },
  })
  return site
}
