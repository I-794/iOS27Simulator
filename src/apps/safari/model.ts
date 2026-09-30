import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { useOS, uid } from '../../os/store'
import { SAFARI_SITES, BOOKMARKS } from '../../os/data/world'
import type { SafariTab } from '../../os/types'

export const START = 'about:start'
export const SEARCH_HOST = 'search.example'

export type Resolved =
  | { kind: 'start' }
  | { kind: 'search'; q: string }
  | { kind: 'site'; key: string; host: string }

export function clean(u: string): string {
  return u.trim().replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/+$/, '')
}

export function hostOf(url: string): string {
  if (url === START) return ''
  return clean(url).split(/[/?#]/)[0].toLowerCase()
}

export const searchUrl = (q: string) => `${SEARCH_HOST}/?q=${encodeURIComponent(q.trim())}`

/** Turn whatever was typed into the address field into a URL we can load. */
export function normalizeInput(input: string): string {
  const raw = input.trim()
  if (!raw) return START
  if (raw === START) return START
  const c = clean(raw)
  if (SAFARI_SITES[c.toLowerCase()]) return c.toLowerCase()
  if (c.toLowerCase().startsWith(SEARCH_HOST)) return c
  // bare host of a known site → its first page
  const host = c.toLowerCase().split('/')[0]
  const byHost = Object.keys(SAFARI_SITES).find((k) => k.split('/')[0] === host)
  if (byHost && !/\s/.test(c)) return byHost
  return searchUrl(raw)
}

export function resolve(url: string): Resolved {
  if (!url || url === START) return { kind: 'start' }
  const c = clean(url)
  if (c.toLowerCase().startsWith(SEARCH_HOST)) {
    const m = c.match(/[?&]q=([^&]*)/)
    return { kind: 'search', q: m ? decodeURIComponent(m[1].replace(/\+/g, ' ')) : '' }
  }
  const key = c.toLowerCase()
  if (SAFARI_SITES[key]) return { kind: 'site', key, host: hostOf(key) }
  return { kind: 'search', q: c }
}

export function titleFor(url: string): string {
  const r = resolve(url)
  if (r.kind === 'start') return 'Start Page'
  if (r.kind === 'search') return r.q ? `${r.q} — Search` : 'Search'
  return SAFARI_SITES[r.key].title
}

export function topicFor(url: string): string {
  const r = resolve(url)
  if (r.kind === 'site') return SAFARI_SITES[r.key].topic
  if (r.kind === 'search') return 'Search'
  return 'Other'
}

export function displayHost(url: string): string {
  const r = resolve(url)
  if (r.kind === 'start') return ''
  if (r.kind === 'search') return r.q
  return r.host
}

/** Screen Time "Ask to Browse": is this URL blocked for the child account? */
export function isBlocked(url: string): boolean {
  const st = useOS.getState().screenTime
  if (!st.childMode || !st.askToBrowse) return false
  const r = resolve(url)
  if (r.kind !== 'site') return false
  return !st.approvedSites.some((s) => r.host === s || r.host.endsWith('.' + s))
}

// ---------------- favicon-ish brand colours ----------------
export const BRAND: Record<string, { color: string; fg?: string; letter: string; name: string }> = {
  'weather.example': { color: '#2f7cf6', letter: 'W', name: 'WeatherNow' },
  'stormwatch.example': { color: '#1f2d3d', letter: 'S', name: 'StormWatch' },
  'chemreview.example': { color: '#12a37f', letter: 'C', name: 'ChemReview' },
  'lincoln.example': { color: '#8f1d21', letter: 'L', name: 'Lincoln High' },
  'bolt.example': { color: '#ffcc00', fg: '#111', letter: 'B', name: 'Bolt' },
  'robotics-forum.example': { color: '#6e3bd8', letter: 'R', name: 'Robotics Forum' },
  'partsdepot.example': { color: '#ff6a13', letter: 'P', name: 'Parts Depot' },
  'morningbrief.example': { color: '#111111', letter: 'M', name: 'Morning Brief' },
  'tunedaily.example': { color: '#ff2d6f', letter: 'T', name: 'TuneDaily' },
  'gamezone.example': { color: '#22c55e', letter: 'G', name: 'GameZone' },
  'videotube.example': { color: '#e11d48', letter: 'V', name: 'VideoTube' },
  [SEARCH_HOST]: { color: '#5b6cff', letter: 'S', name: 'Search' },
}
export const brandFor = (url: string) => BRAND[hostOf(url)] ?? { color: '#8e8e93', letter: (hostOf(url)[0] ?? '?').toUpperCase(), name: hostOf(url) }

// ---------------- local persistent state ----------------
export interface Bookmark { id: string; title: string; url: string; favorite?: boolean }

interface SafariLocal {
  bookmarks: Bookmark[]
  readingList: { id: string; title: string; url: string; ts: number; read?: boolean }[]
  extraGroups: string[]
  activeGroup: string | null
  zoom: Record<string, number>
  readerPrefs: { size: number; theme: 'light' | 'sepia' | 'gray' | 'dark'; font: 'System' | 'Serif' | 'Rounded' }
  cart: number
  hiddenSections: string[]
  set: (p: Partial<SafariLocal>) => void
}

export const useSafari = create<SafariLocal>()(
  persist(
    (set) => ({
      bookmarks: BOOKMARKS.map((b, i) => ({ id: `bm-${i}`, title: b.title, url: b.url, favorite: true })),
      readingList: [
        { id: 'rl-1', title: SAFARI_SITES['robotics-forum.example/swerve'].title, url: 'robotics-forum.example/swerve', ts: Date.now() - 86_400_000 },
        { id: 'rl-2', title: SAFARI_SITES['tunedaily.example/luma-coast'].title, url: 'tunedaily.example/luma-coast', ts: Date.now() - 2 * 86_400_000, read: true },
      ],
      extraGroups: [],
      activeGroup: null,
      zoom: {},
      readerPrefs: { size: 19, theme: 'light', font: 'System' },
      cart: 0,
      hiddenSections: [],
      set: (p) => set(p),
    }),
    { name: 'ios27-safari', storage: createJSONStorage(() => localStorage), partialize: (s) => ({ ...s, set: undefined }) as unknown as SafariLocal },
  ),
)

// ---------------- per-tab back/forward (session only) ----------------
interface NavHist { back: string[]; fwd: string[] }
export const useTabNav = create<{ h: Record<string, NavHist>; set: (id: string, v: NavHist) => void }>((set) => ({
  h: {},
  set: (id, v) => set((s) => ({ h: { ...s.h, [id]: v } })),
}))

// ---------------- tab actions (global OS store) ----------------
const S = () => useOS.getState()

export function activeTab(): SafariTab | undefined {
  const st = S()
  return st.safariTabs.find((t) => t.id === st.safariActiveTab) ?? st.safariTabs[0]
}

export function navigate(url: string, opts: { replace?: boolean; tabId?: string } = {}) {
  const st = S()
  const tab = opts.tabId ? st.safariTabs.find((t) => t.id === opts.tabId) : activeTab()
  if (!tab) return newTab(url)
  const next = normalizeInput(url)
  if (next === tab.url && !opts.replace) return
  const title = titleFor(next)
  const nav = useTabNav.getState()
  const h = nav.h[tab.id] ?? { back: [], fwd: [] }
  if (!opts.replace) nav.set(tab.id, { back: [...h.back, tab.url].slice(-50), fwd: [] })
  st.set({ safariTabs: S().safariTabs.map((t) => (t.id === tab.id ? { ...t, url: next, title, ts: Date.now() } : t)), safariActiveTab: tab.id })
  if (next !== START) {
    st.set({ safariHistory: [{ url: next, title, ts: Date.now() }, ...S().safariHistory.filter((x) => !(x.url === next && Date.now() - x.ts < 60_000))].slice(0, 200) })
  }
}

export function goBack() {
  const tab = activeTab()
  if (!tab) return
  const nav = useTabNav.getState()
  const h = nav.h[tab.id]
  if (!h?.back.length) return
  const prev = h.back[h.back.length - 1]
  nav.set(tab.id, { back: h.back.slice(0, -1), fwd: [tab.url, ...h.fwd] })
  S().set({ safariTabs: S().safariTabs.map((t) => (t.id === tab.id ? { ...t, url: prev, title: titleFor(prev), ts: Date.now() } : t)) })
}

export function goForward() {
  const tab = activeTab()
  if (!tab) return
  const nav = useTabNav.getState()
  const h = nav.h[tab.id]
  if (!h?.fwd.length) return
  const next = h.fwd[0]
  nav.set(tab.id, { back: [...h.back, tab.url], fwd: h.fwd.slice(1) })
  S().set({ safariTabs: S().safariTabs.map((t) => (t.id === tab.id ? { ...t, url: next, title: titleFor(next), ts: Date.now() } : t)) })
}

export function newTab(url: string = START, group?: string | null): string {
  const id = uid('tab')
  const u = normalizeInput(url)
  const g = group === undefined ? useSafari.getState().activeGroup ?? undefined : group ?? undefined
  S().set({ safariTabs: [...S().safariTabs, { id, url: u, title: titleFor(u), ts: Date.now(), group: g }], safariActiveTab: id })
  if (u !== START) S().set({ safariHistory: [{ url: u, title: titleFor(u), ts: Date.now() }, ...S().safariHistory].slice(0, 200) })
  return id
}

export function closeTab(id: string) {
  const st = S()
  const idx = st.safariTabs.findIndex((t) => t.id === id)
  const rest = st.safariTabs.filter((t) => t.id !== id)
  let active = st.safariActiveTab
  if (active === id) active = rest[Math.min(idx, rest.length - 1)]?.id ?? ''
  st.set({ safariTabs: rest, safariActiveTab: active })
}

export function addToHistoryTitle(url: string) {
  return titleFor(url)
}

// ---------------- Organize by Topic ----------------
export function organizeByTopic(): { groups: string[]; moved: number } {
  const st = S()
  let moved = 0
  const tabs = st.safariTabs.map((t) => {
    const topic = topicFor(t.url)
    const g = topic === 'Search' || topic === 'Other' ? t.group ?? 'Other' : topic
    if (g !== t.group) moved++
    return { ...t, group: g }
  })
  st.set({ safariTabs: tabs })
  const order = ['Weather', 'School', 'Shopping', 'Music', 'Robotics', 'News']
  const groups = [...new Set(tabs.map((t) => t.group!))].sort((a, b) => (order.indexOf(a) + 1 || 99) - (order.indexOf(b) + 1 || 99))
  return { groups, moved }
}

export const GROUP_ORDER = ['Weather', 'School', 'Shopping', 'Music', 'Robotics', 'News', 'Games', 'Entertainment', 'Other']
export const GROUP_COLOR: Record<string, string> = {
  Weather: '#32ade6', School: '#ff9500', Shopping: '#34c759', Music: '#ff2d55', Robotics: '#af52de', News: '#8e8e93', Games: '#30b0c7', Entertainment: '#ff3b30', Other: '#5856d6',
}
export const groupColor = (g: string) => GROUP_COLOR[g] ?? '#5856d6'

// ---------------- Screen Time: Ask to Browse ----------------
export function askPermission(host: string) {
  const st = S()
  const cfg = st.screenTime
  if (cfg.pendingRequests.some((r) => r.site === host && r.status === 'pending')) return
  const id = uid('req')
  st.set({ screenTime: { ...cfg, pendingRequests: [...cfg.pendingRequests, { id, site: host, ts: Date.now(), status: 'pending' }] } })
  st.showToast(`Request sent to your parent`, 'send')
  window.setTimeout(() => {
    const s2 = S()
    const c2 = s2.screenTime
    const req = c2.pendingRequests.find((r) => r.id === id)
    if (!req || req.status !== 'pending') return
    s2.set({
      screenTime: {
        ...c2,
        approvedSites: c2.approvedSites.includes(host) ? c2.approvedSites : [...c2.approvedSites, host],
        pendingRequests: c2.pendingRequests.map((r) => (r.id === id ? { ...r, status: 'approved' } : r)),
      },
    })
    s2.notify({ app: 'settings', title: 'Screen Time', subtitle: 'Request Approved', body: `Mom approved your request to visit ${host}.`, route: 'screentime', timeSensitive: true })
  }, 4500)
}
