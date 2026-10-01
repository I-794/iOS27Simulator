import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type {
  AppId, Theme, Orientation, NotificationItem, LiveActivity, IslandEvent, Conversation, Message, MailMessage,
  CalendarEvent, Reminder, Note, Photo, SharedAlbum, SiriConversation, SiriTurn, Alarm, HomeAccessory, SafariTab,
  Shortcut, ScreenTimeConfig, JournalEntry, Attachment,
} from './types'
import { CONVERSATIONS, MAILS } from './data/comms'
import { EVENTS, REMINDERS, NOTES, JOURNAL, ALARMS } from './data/life'
import { PHOTOS, SHARED_ALBUMS } from './data/photos'
import { contactName } from './data/people'
import { ACCESSORIES, SAFARI_TABS, SHORTCUTS, DEFAULT_SCREEN_TIME, WALLET_CARDS } from './data/world'

export const uid = (p = 'id') => `${p}-${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-3)}`

export type Overlay = null | 'cc' | 'nc' | 'spotlight' | 'switcher' | 'applibrary' | 'today' | 'siri' | 'share' | 'volume' | 'power'

export type WidgetSize = 's' | 'm' | 'l' | 'xl'
export type HomeItem = { type: 'app'; id: AppId } | { type: 'widget'; id: string; kind: string; size: WidgetSize } | { type: 'folder'; id: string; name: string; apps: AppId[] }

export interface Rect { x: number; y: number; w: number; h: number }

export interface Timer { id: string; label: string; duration: number; endsAt: number | null; remaining: number; running: boolean }

export interface ShareRequest { title: string; kind: 'photo' | 'link' | 'text' | 'file' | 'note'; payload?: string; photoId?: string; app: AppId }

export interface NetState {
  wifi: boolean
  wifiNetwork: string
  wifiQuality: number // 0..1
  cellular: boolean
  cellularSignal: number // 0..4
  cellularType: '5G' | 'LTE' | '5G UW'
  airplane: boolean
  bluetooth: boolean
  hotspot: boolean
  vpn: boolean
  connectivityAssist: boolean
  /** which path traffic is using right now */
  activePath: 'wifi' | 'cellular' | 'none'
}

export interface SafariWatch { id: string; url: string; kind: 'price' | 'restock' | 'content'; label: string; created: number; triggered?: boolean }

export interface ImageGen { id: string; prompt: string; style: string; seed: number; ts: number; source?: string; edits: string[] }

export interface FreeformItem { id: string; kind: 'sticky' | 'shape' | 'text' | 'image' | 'path'; x: number; y: number; w: number; h: number; text?: string; color?: string; d?: string; photoId?: string }
export interface FreeformBoard { id: string; name: string; folder: string; items: FreeformItem[]; shared?: string[]; updated: number }

interface OSState {
  // ---------- device & appearance ----------
  locked: boolean
  screenOn: boolean
  orientation: Orientation
  theme: Theme
  themeAuto: boolean
  glassTint: number
  wallpaper: string
  lockClockPosition: 'center' | 'top'
  /** How a photo wallpaper fills the screen: cropped, whole photo, or extended with Apple Intelligence */
  wallpaperFit: 'fill' | 'photo' | 'extend'
  lockClockStyle: 'bold' | 'rounded' | 'serif' | 'stencil'
  lockClockColor: string
  lockProfile: string
  lockWidgets: string[]
  iconStyle: 'default' | 'dark' | 'clear' | 'tinted'
  iconTint: string
  largeIcons: boolean
  textScale: number
  boldText: boolean
  reduceMotion: boolean
  reduceTransparency: boolean
  increaseContrast: boolean
  accent: string
  h24: boolean
  homePages: HomeItem[][]
  dock: AppId[]
  hiddenPages: number[]

  // ---------- sound & hardware ----------
  volume: number
  ringerVolume: number
  alarmVolume: number
  alarmVolumeSeparate: boolean
  silent: boolean
  brightness: number
  trueTone: boolean
  nightShift: boolean
  lowPower: boolean
  battery: number
  charging: boolean
  orientationLock: boolean
  flashlight: boolean
  flashlightLevel: number
  screenRecording: boolean
  focus: null | 'Do Not Disturb' | 'Personal' | 'Sleep' | 'Study' | 'Driving' | 'Fitness'
  actionButton: 'silent' | 'flashlight' | 'camera' | 'siri' | 'magnifier' | 'shortcut' | 'accessibility' | 'visual-intelligence' | 'translate'
  airdrop: 'off' | 'contacts' | 'everyone'
  net: NetState
  controls: string[]

  // ---------- runtime (not persisted) ----------
  openApp: AppId | null
  launchRect: Rect | null
  appRoutes: Partial<Record<AppId, string>>
  routeNonce: number
  recents: AppId[]
  overlay: Overlay
  banner: NotificationItem | null
  toast: { id: string; text: string; icon?: string } | null
  shareRequest: ShareRequest | null
  editingHome: boolean
  keyboardOpen: boolean
  siriActive: boolean
  siriMode: 'idle' | 'listening' | 'thinking' | 'responding'
  siriOnscreen: { app: AppId | null; context?: string; entity?: Record<string, string> }
  lastUnlock: number

  // ---------- notifications & activities ----------
  notifications: NotificationItem[]
  activities: LiveActivity[]
  islandEvent: IslandEvent | null

  // ---------- media ----------
  nowPlaying: { trackId: string; playing: boolean; position: number; updatedAt: number; queue: string[]; shuffle: boolean; repeat: 'off' | 'all' | 'one'; source?: string; kind: 'music' | 'podcast'; podcastId?: string; episodeId?: string; dismissed: boolean; airplay?: string }
  automix: boolean
  crossfade: number
  eq: { low: number; mid: number; high: number; preset: string; enabled: boolean }
  airpods: { connected: boolean; mode: 'anc' | 'transparency' | 'adaptive' | 'off'; heartRate: boolean; battery: { l: number; r: number; case: number }; conversationAwareness: boolean; hearingAid: boolean }

  // ---------- Siri ----------
  siriConversations: SiriConversation[]
  siriCurrent: string | null
  siriSettings: { voice: string; pace: number; expressiveness: number; provider: 'siri' | 'chatgpt'; typeToSiri: boolean; responses: 'always' | 'automatic' | 'silent'; sideButton: boolean; heySiri: boolean; lockScreen: boolean; personalContext: boolean; onscreen: boolean }

  // ---------- personal data ----------
  conversations: Conversation[]
  mails: MailMessage[]
  events: CalendarEvent[]
  reminders: Reminder[]
  notes: Note[]
  photos: Photo[]
  sharedAlbums: SharedAlbum[]
  prioritySync: boolean
  shuffle: { pet: string; includeMe: boolean; kind: 'pets' | 'people' | 'nature' | 'cities' }
  alarms: Alarm[]
  timers: Timer[]
  stopwatch: { running: boolean; startedAt: number; elapsed: number; laps: number[] }
  accessories: HomeAccessory[]
  safariTabs: SafariTab[]
  safariHistory: { url: string; title: string; ts: number }[]
  safariWatches: SafariWatch[]
  safariExtensions: { id: string; name: string; prompt: string; css: string; enabled: boolean }[]
  safariActiveTab: string
  shortcuts: Shortcut[]
  screenTime: ScreenTimeConfig
  journal: JournalEntry[]
  imageGens: ImageGen[]
  freeform: FreeformBoard[]
  walletDefault: string
  walletCards: typeof WALLET_CARDS
  carKeySetup: 'none' | 'offered' | 'added'
  passwordsFixed: string[]
  accessibility: {
    voiceOver: boolean; zoom: boolean; speakScreen: boolean; captions: boolean; captionTranslate: string; liveCaptions: boolean;
    voiceControl: boolean; assistiveAccess: boolean; guidedAccess: boolean; touchAccommodations: boolean; holdDuration: number;
    hearingDevice: string | null; readerFont: string; backgroundSounds: boolean; soundRecognition: boolean
  }
  focusAppFilter: boolean
  iphoneHandoff: boolean
  games: { controller: string | null; overlay: boolean }
  language: { keyboards: string[]; region: string; multilingual: boolean; autoPunctuation: boolean; grammar: boolean }
  appUsage: Partial<Record<AppId, number>>
  permissions: Record<string, Record<string, boolean>>

  // ---------- actions ----------
  set: (patch: Partial<OSState>) => void
  unlock: () => void
  lock: () => void
  wake: () => void
  launch: (app: AppId, opts?: { rect?: Rect | null; route?: string }) => void
  goHome: () => void
  setOverlay: (o: Overlay) => void
  toggleOverlay: (o: Overlay) => void
  notify: (n: Omit<NotificationItem, 'id' | 'ts'> & { id?: string; ts?: number }) => void
  dismissNotification: (id: string) => void
  clearNotifications: (app?: AppId) => void
  showToast: (text: string, icon?: string) => void
  startActivity: (a: Omit<LiveActivity, 'id'> & { id?: string }) => string
  updateActivity: (id: string, patch: Partial<LiveActivity>) => void
  endActivity: (id: string) => void
  flashIsland: (e: Omit<IslandEvent, 'id'>) => void
  setNet: (patch: Partial<NetState>) => void

  // media
  playTrack: (trackId: string, queue?: string[], source?: string) => void
  togglePlay: () => void
  seek: (pos: number) => void
  nextTrack: () => void
  prevTrack: () => void

  // messages
  sendMessage: (convId: string, msg: Partial<Message> & { text?: string; attachment?: Attachment }) => string
  receiveMessage: (convId: string, msg: Partial<Message>) => void
  patchMessage: (convId: string, msgId: string, patch: Partial<Message>) => void
  ensureConversation: (contactIds: string[], name?: string) => string
  markConversationRead: (convId: string) => void

  // pim
  addEvent: (e: Omit<CalendarEvent, 'id'>) => string
  updateEvent: (id: string, patch: Partial<CalendarEvent>) => void
  deleteEvent: (id: string) => void
  addReminder: (r: Omit<Reminder, 'id' | 'done'> & { done?: boolean }) => string
  updateReminder: (id: string, patch: Partial<Reminder>) => void
  addNote: (n: Omit<Note, 'id' | 'updated'>) => string
  updateNote: (id: string, patch: Partial<Note>) => void
  updatePhoto: (id: string, patch: Partial<Photo>) => void
  addPhoto: (p: Omit<Photo, 'id'> & { id?: string }) => string
  updateMail: (id: string, patch: Partial<MailMessage>) => void
  addMail: (m: Omit<MailMessage, 'id'>) => string

  // siri
  siriNewConversation: () => string
  siriAppend: (turn: Omit<SiriTurn, 'id' | 'ts'>, convId?: string) => string

  resetAll: () => void
}

const DEFAULT_HOME: HomeItem[][] = [
  [
    { type: 'widget', id: 'w1', kind: 'weather', size: 'm' },
    { type: 'app', id: 'facetime' }, { type: 'app', id: 'calendar' }, { type: 'app', id: 'photos' }, { type: 'app', id: 'camera' },
    { type: 'app', id: 'mail' }, { type: 'app', id: 'clock' }, { type: 'app', id: 'maps' }, { type: 'app', id: 'weather' },
    { type: 'app', id: 'reminders' }, { type: 'app', id: 'notes' }, { type: 'app', id: 'siri' }, { type: 'app', id: 'home' },
    { type: 'app', id: 'wallet' }, { type: 'app', id: 'health' }, { type: 'app', id: 'podcasts' }, { type: 'app', id: 'settings' },
  ],
  [
    { type: 'widget', id: 'w2', kind: 'calendar', size: 's' },
    { type: 'widget', id: 'w3', kind: 'photos', size: 's' },
    { type: 'app', id: 'playground' }, { type: 'app', id: 'shortcuts' }, { type: 'app', id: 'findmy' }, { type: 'app', id: 'freeform' },
    { type: 'app', id: 'journal' }, { type: 'app', id: 'fitness' }, { type: 'app', id: 'passwords' }, { type: 'app', id: 'files' },
    { type: 'app', id: 'news' }, { type: 'app', id: 'stocks' }, { type: 'app', id: 'contacts' }, { type: 'app', id: 'calculator' },
    { type: 'folder', id: 'f-utilities', name: 'Utilities', apps: ['magnifier', 'voicememos', 'preview', 'games'] },
  ],
  [
    { type: 'widget', id: 'w7', kind: 'photos', size: 'xl' },
  ],
  [
    { type: 'widget', id: 'w9', kind: 'music', size: 'xl' },
  ],
  [
    { type: 'widget', id: 'w8', kind: 'home', size: 'm' },
    { type: 'widget', id: 'w5', kind: 'batteries', size: 's' },
    { type: 'widget', id: 'w6', kind: 'reminders', size: 's' },
    { type: 'widget', id: 'w10', kind: 'siri', size: 'm' },
  ],
]

const DEFAULT_CONTROLS = ['connectivity', 'media', 'orientation', 'mirror', 'focus', 'brightness', 'volume', 'flashlight', 'timer', 'calculator', 'camera', 'record', 'home', 'lowpower', 'hearing', 'scan', 'dark', 'airplay-tv']

function initialData() {
  return {
    conversations: structuredClone(CONVERSATIONS),
    mails: structuredClone(MAILS),
    events: structuredClone(EVENTS),
    reminders: structuredClone(REMINDERS),
    notes: structuredClone(NOTES),
    photos: structuredClone(PHOTOS),
    sharedAlbums: structuredClone(SHARED_ALBUMS),
    alarms: structuredClone(ALARMS),
    accessories: structuredClone(ACCESSORIES),
    safariTabs: structuredClone(SAFARI_TABS),
    shortcuts: structuredClone(SHORTCUTS),
    screenTime: structuredClone(DEFAULT_SCREEN_TIME),
    journal: structuredClone(JOURNAL),
    walletCards: structuredClone(WALLET_CARDS),
  }
}

const now = () => Date.now()

const DEFAULTS = {
  locked: true,
  screenOn: true,
  orientation: 'portrait' as Orientation,
  theme: 'light' as Theme,
  themeAuto: false,
  glassTint: 0.5,
  wallpaper: 'sequoia',
  lockClockPosition: 'center' as const,
  wallpaperFit: 'fill' as 'fill' | 'photo' | 'extend',
  lockClockStyle: 'bold' as const,
  lockClockColor: '#ffffff',
  lockProfile: 'Default',
  lockWidgets: ['weather', 'calendar', 'activity', 'battery'],
  iconStyle: 'default' as const,
  iconTint: '#6aa9ff',
  largeIcons: false,
  textScale: 1,
  boldText: false,
  reduceMotion: false,
  reduceTransparency: false,
  increaseContrast: false,
  accent: 'blue',
  h24: false,
  homePages: DEFAULT_HOME,
  dock: ['phone', 'safari', 'messages', 'music'] as AppId[],
  hiddenPages: [] as number[],
  volume: 0.55,
  ringerVolume: 0.7,
  alarmVolume: 0.9,
  alarmVolumeSeparate: true,
  silent: false,
  brightness: 0.8,
  trueTone: true,
  nightShift: false,
  lowPower: false,
  battery: 0.78,
  charging: false,
  orientationLock: false,
  flashlight: false,
  flashlightLevel: 0.75,
  screenRecording: false,
  focus: null,
  actionButton: 'silent' as const,
  airdrop: 'contacts' as const,
  net: { wifi: true, wifiNetwork: 'ParkNet', wifiQuality: 0.9, cellular: true, cellularSignal: 3, cellularType: '5G' as const, airplane: false, bluetooth: true, hotspot: false, vpn: false, connectivityAssist: true, activePath: 'wifi' as const },
  controls: DEFAULT_CONTROLS,
  openApp: null,
  launchRect: null,
  appRoutes: {},
  routeNonce: 0,
  recents: ['messages', 'safari', 'photos', 'music', 'mail'] as AppId[],
  overlay: null,
  banner: null,
  toast: null,
  shareRequest: null,
  editingHome: false,
  keyboardOpen: false,
  siriActive: false,
  siriMode: 'idle' as const,
  siriOnscreen: { app: null },
  lastUnlock: 0,
  notifications: [] as NotificationItem[],
  activities: [] as LiveActivity[],
  islandEvent: null,
  nowPlaying: { trackId: 't1', playing: false, position: 0, updatedAt: now(), queue: ['t1', 't2', 't3', 't4', 't5', 't6', 't7'], shuffle: false, repeat: 'off' as const, kind: 'music' as const, dismissed: false },
  automix: true,
  crossfade: 6,
  eq: { low: 0, mid: 0, high: 0, preset: 'Flat', enabled: true },
  airpods: { connected: true, mode: 'adaptive' as const, heartRate: true, battery: { l: 64, r: 66, case: 88 }, conversationAwareness: true, hearingAid: false },
  siriConversations: [] as SiriConversation[],
  siriCurrent: null,
  siriSettings: { voice: 'Voice 2', pace: 0.5, expressiveness: 0.6, provider: 'siri' as const, typeToSiri: true, responses: 'automatic' as const, sideButton: true, heySiri: true, lockScreen: true, personalContext: true, onscreen: true },
  prioritySync: false,
  shuffle: { pet: 'Biscuit', includeMe: false, kind: 'pets' as const },
  timers: [] as Timer[],
  stopwatch: { running: false, startedAt: 0, elapsed: 0, laps: [] as number[] },
  safariHistory: [] as { url: string; title: string; ts: number }[],
  safariWatches: [] as SafariWatch[],
  safariExtensions: [] as { id: string; name: string; prompt: string; css: string; enabled: boolean }[],
  safariActiveTab: 'tab-0',
  imageGens: [] as ImageGen[],
  freeform: [
    { id: 'fb1', name: 'Regional Strategy', folder: 'Robotics (Shared)', shared: ['alex', 'nora'], updated: Date.now() - 86_400_000, items: [
      { id: 'i1', kind: 'sticky' as const, x: 40, y: 40, w: 150, h: 150, text: 'Auto: 3 pieces in 15s', color: '#ffe066' },
      { id: 'i2', kind: 'sticky' as const, x: 220, y: 60, w: 150, h: 150, text: 'Defense plan vs. Team 1138', color: '#9be7ff' },
      { id: 'i3', kind: 'image' as const, x: 60, y: 240, w: 220, h: 165, photoId: 'p-robot-comp' },
      { id: 'i4', kind: 'text' as const, x: 320, y: 280, w: 200, h: 40, text: 'Match strategy board' },
    ] },
    { id: 'fb2', name: 'Fall Concert Setup', folder: 'Band', updated: Date.now() - 3 * 86_400_000, items: [
      { id: 'i5', kind: 'sticky' as const, x: 60, y: 60, w: 150, h: 150, text: 'Snares stage left', color: '#ffb3c1' },
      { id: 'i6', kind: 'shape' as const, x: 260, y: 90, w: 120, h: 120, color: '#5ac8fa' },
    ] },
  ] as FreeformBoard[],
  walletDefault: 'w-debit',
  carKeySetup: 'offered' as const,
  passwordsFixed: [] as string[],
  accessibility: { voiceOver: false, zoom: false, speakScreen: false, captions: true, captionTranslate: 'Off', liveCaptions: false, voiceControl: false, assistiveAccess: false, guidedAccess: false, touchAccommodations: false, holdDuration: 0.3, hearingDevice: null, readerFont: 'System', backgroundSounds: false, soundRecognition: false },
  focusAppFilter: false,
  iphoneHandoff: true,
  games: { controller: null, overlay: true },
  language: { keyboards: ['English (US)', 'Emoji', 'Spanish'], region: 'United States', multilingual: true, autoPunctuation: true, grammar: true },
  appUsage: {} as Partial<Record<AppId, number>>,
  permissions: {
    camera: { camera: true, photos: true, siri: true },
    maps: { location: true },
    messages: { siri: true, notifications: true },
    photos: { siri: true },
  } as Record<string, Record<string, boolean>>,
}

let islandTimer: number | undefined
let toastTimer: number | undefined
let bannerTimer: number | undefined

export const useOS = create<OSState>()(
  persist(
    (set, get) => ({
      ...DEFAULTS,
      ...initialData(),

      set: (patch) => set(patch),

      unlock: () => {
        set({ locked: false, screenOn: true, overlay: null, lastUnlock: now() })
        get().flashIsland({ kind: 'faceid', icon: 'unlock', duration: 900 })
      },
      lock: () => {
        set({ locked: true, overlay: null, openApp: null, siriActive: false, editingHome: false, keyboardOpen: false })
      },
      wake: () => set({ screenOn: true }),

      launch: (app, opts = {}) => {
        const { recents, appUsage } = get()
        set({
          openApp: app,
          launchRect: opts.rect ?? null,
          overlay: null,
          editingHome: false,
          recents: [app, ...recents.filter((a) => a !== app)].slice(0, 12),
          appUsage: { ...appUsage, [app]: (appUsage[app] ?? 0) + 1 },
          ...(opts.route ? { appRoutes: { ...get().appRoutes, [app]: opts.route }, routeNonce: get().routeNonce + 1 } : {}),
        })
      },
      goHome: () => set({ openApp: null, overlay: null, keyboardOpen: false }),
      setOverlay: (o) => set({ overlay: o }),
      toggleOverlay: (o) => set({ overlay: get().overlay === o ? null : o }),

      notify: (n) => {
        const item: NotificationItem = { id: n.id ?? uid('n'), ts: n.ts ?? now(), ...n } as NotificationItem
        const st = get()
        const quiet = st.focus && st.focus !== 'Personal' && !item.timeSensitive
        const muted = st.permissions[item.app]?.notifications === false
        set({ notifications: [item, ...st.notifications].slice(0, 80) })
        if (!quiet && !muted && !(st.openApp === item.app && !st.locked)) {
          set({ banner: item })
          window.clearTimeout(bannerTimer)
          bannerTimer = window.setTimeout(() => {
            if (get().banner?.id === item.id) set({ banner: null })
          }, 5200)
          if (st.locked) set({ screenOn: true })
        }
      },
      dismissNotification: (id) => set({ notifications: get().notifications.filter((n) => n.id !== id), banner: get().banner?.id === id ? null : get().banner }),
      clearNotifications: (app) => set({ notifications: app ? get().notifications.filter((n) => n.app !== app) : [] }),
      showToast: (text, icon) => {
        const id = uid('t')
        set({ toast: { id, text, icon } })
        window.clearTimeout(toastTimer)
        toastTimer = window.setTimeout(() => get().toast?.id === id && set({ toast: null }), 2400)
      },

      startActivity: (a) => {
        const id = a.id ?? uid('la')
        set({ activities: [...get().activities.filter((x) => x.id !== id), { ...a, id } as LiveActivity] })
        return id
      },
      updateActivity: (id, patch) => set({ activities: get().activities.map((a) => (a.id === id ? { ...a, ...patch } : a)) }),
      endActivity: (id) => set({ activities: get().activities.filter((a) => a.id !== id) }),
      flashIsland: (e) => {
        const ev = { ...e, id: uid('ie') }
        set({ islandEvent: ev })
        window.clearTimeout(islandTimer)
        islandTimer = window.setTimeout(() => get().islandEvent?.id === ev.id && set({ islandEvent: null }), e.duration ?? 2200)
      },
      setNet: (patch) => set({ net: { ...get().net, ...patch } }),

      playTrack: (trackId, queue, source) => {
        const np = get().nowPlaying
        set({ nowPlaying: { ...np, trackId, playing: true, position: 0, updatedAt: now(), queue: queue ?? np.queue, source, kind: 'music', dismissed: false } })
      },
      togglePlay: () => {
        const np = get().nowPlaying
        const pos = np.playing ? np.position + (now() - np.updatedAt) / 1000 : np.position
        set({ nowPlaying: { ...np, playing: !np.playing, position: pos, updatedAt: now(), dismissed: false } })
      },
      seek: (pos) => set({ nowPlaying: { ...get().nowPlaying, position: pos, updatedAt: now() } }),
      nextTrack: () => {
        const np = get().nowPlaying
        const i = np.queue.indexOf(np.trackId)
        const next = np.queue[(i + 1) % np.queue.length]
        set({ nowPlaying: { ...np, trackId: next, position: 0, updatedAt: now(), playing: true } })
      },
      prevTrack: () => {
        const np = get().nowPlaying
        const pos = np.playing ? np.position + (now() - np.updatedAt) / 1000 : np.position
        if (pos > 3) return set({ nowPlaying: { ...np, position: 0, updatedAt: now() } })
        const i = np.queue.indexOf(np.trackId)
        const prev = np.queue[(i - 1 + np.queue.length) % np.queue.length]
        set({ nowPlaying: { ...np, trackId: prev, position: 0, updatedAt: now() } })
      },

      sendMessage: (convId, msg) => {
        const id = msg.id ?? uid('msg')
        const m: Message = { from: 'me', ts: now(), status: 'sending', ...msg, id }
        set({ conversations: get().conversations.map((c) => (c.id === convId ? { ...c, messages: [...c.messages, m], draft: '' } : c)) })
        return id
      },
      receiveMessage: (convId, msg) => {
        const m: Message = { id: uid('msg'), from: '?', ts: now(), ...msg } as Message
        const st = get()
        const conv = st.conversations.find((c) => c.id === convId)
        set({ conversations: st.conversations.map((c) => (c.id === convId ? { ...c, messages: [...c.messages, m], unread: (c.unread ?? 0) + (st.openApp === 'messages' ? 0 : 1) } : c)) })
        if (conv) {
          st.notify({ app: 'messages', title: conv.name ?? contactName(m.from, 'full'), subtitle: conv.name ? contactName(m.from) : undefined, body: m.text ?? 'Attachment', thread: convId, route: `conv/${convId}` })
        }
      },
      patchMessage: (convId, msgId, patch) =>
        set({ conversations: get().conversations.map((c) => (c.id === convId ? { ...c, messages: c.messages.map((m) => (m.id === msgId ? { ...m, ...patch } : m)) } : c)) }),
      ensureConversation: (contactIds, name) => {
        const key = [...contactIds].sort().join(',')
        const existing = get().conversations.find((c) => [...c.participants].sort().join(',') === key)
        if (existing) return existing.id
        const id = uid('c')
        set({ conversations: [{ id, participants: contactIds, name, messages: [] }, ...get().conversations] })
        return id
      },
      markConversationRead: (convId) => set({ conversations: get().conversations.map((c) => (c.id === convId ? { ...c, unread: 0 } : c)) }),

      addEvent: (e) => {
        const id = uid('e')
        set({ events: [...get().events, { ...e, id }] })
        return id
      },
      updateEvent: (id, patch) => set({ events: get().events.map((e) => (e.id === id ? { ...e, ...patch } : e)) }),
      deleteEvent: (id) => set({ events: get().events.filter((e) => e.id !== id) }),
      addReminder: (r) => {
        const id = uid('r')
        set({ reminders: [...get().reminders, { done: false, ...r, id }] })
        return id
      },
      updateReminder: (id, patch) => set({ reminders: get().reminders.map((r) => (r.id === id ? { ...r, ...patch } : r)) }),
      addNote: (n) => {
        const id = uid('note')
        set({ notes: [{ ...n, id, updated: now() }, ...get().notes] })
        return id
      },
      updateNote: (id, patch) => set({ notes: get().notes.map((n) => (n.id === id ? { ...n, ...patch, updated: now() } : n)) }),
      updatePhoto: (id, patch) => set({ photos: get().photos.map((p) => (p.id === id ? { ...p, ...patch } : p)) }),
      addPhoto: (p) => {
        const id = p.id ?? uid('p')
        set({ photos: [{ ...p, id } as Photo, ...get().photos] })
        return id
      },
      updateMail: (id, patch) => set({ mails: get().mails.map((m) => (m.id === id ? { ...m, ...patch } : m)) }),
      addMail: (m) => {
        const id = uid('mail')
        set({ mails: [{ ...m, id }, ...get().mails] })
        return id
      },

      siriNewConversation: () => {
        const id = uid('siri')
        set({ siriConversations: [{ id, title: 'New Conversation', turns: [], updated: now() }, ...get().siriConversations], siriCurrent: id })
        return id
      },
      siriAppend: (turn, convId) => {
        let id = convId ?? get().siriCurrent
        if (!id || !get().siriConversations.some((c) => c.id === id)) id = get().siriNewConversation()
        const t: SiriTurn = { ...turn, id: uid('turn'), ts: now() }
        set({
          siriConversations: get().siriConversations.map((c) =>
            c.id === id ? { ...c, turns: [...c.turns, t], updated: now(), title: c.turns.length === 0 && turn.role === 'user' ? turn.text.slice(0, 48) : c.title } : c,
          ),
        })
        return t.id
      },

      resetAll: () => {
        localStorage.removeItem('ios27-sim')
        location.reload()
      },
    }),
    {
      name: 'ios27-sim',
      version: 6,
      storage: createJSONStorage(() => localStorage),
      migrate: (persisted, version) => {
        const p = (persisted ?? {}) as Partial<OSState>
        if (version < 5) return { ...p, homePages: DEFAULT_HOME, glassTint: 0.5 } as OSState
        // v6: Voice Memos was added — put it in the Utilities folder for existing Home Screens
        if (version < 6 && p.homePages && !JSON.stringify(p.homePages).includes('"voicememos"')) {
          const pages = JSON.parse(JSON.stringify(p.homePages)) as { type?: string; id?: string; apps?: string[] }[][]
          const folder = pages.flat().find((x) => x?.type === 'folder' && x.id === 'f-utilities')
          if (folder?.apps) folder.apps.push('voicememos')
          return { ...p, homePages: pages } as unknown as OSState
        }
        return p as OSState
      },
      partialize: (s) => {
        const {
          openApp, launchRect, appRoutes, routeNonce, overlay, banner, toast, shareRequest, editingHome, keyboardOpen,
          siriActive, siriMode, siriOnscreen, islandEvent, locked, screenOn, activities, lastUnlock,
          ...rest
        } = s
        void openApp; void launchRect; void appRoutes; void routeNonce; void overlay; void banner; void toast; void shareRequest; void editingHome; void keyboardOpen
        void siriActive; void siriMode; void siriOnscreen; void islandEvent; void locked; void screenOn; void activities; void lastUnlock
        const out: Record<string, unknown> = {}
        for (const [k, v] of Object.entries(rest)) if (typeof v !== 'function') out[k] = v
        out.nowPlaying = { ...s.nowPlaying, playing: false }
        out.timers = s.timers
        return out as Partial<OSState>
      },
      merge: (persisted, current) => ({ ...current, ...(persisted as object) }),
    },
  ),
)

export const os = () => useOS.getState()

/** Current playback position in seconds, derived from wall-clock. */
export function playbackPosition(np = useOS.getState().nowPlaying): number {
  return np.playing ? np.position + (Date.now() - np.updatedAt) / 1000 : np.position
}

export function isAppAllowed(app: AppId): { allowed: boolean; reason?: string } {
  const st = useOS.getState()
  const cfg = st.screenTime
  if (cfg.downtime && !DOWNTIME_ALLOWED.includes(app)) return { allowed: false, reason: 'Downtime is on. Only always-allowed apps are available.' }
  if (!cfg.childMode) return { allowed: true }
  if (app === 'settings') return { allowed: true }
  if (!cfg.allowedApps.includes(app)) return { allowed: false, reason: `${cfg.childName}'s parent hasn't approved this app.` }
  const d = new Date()
  const mins = d.getHours() * 60 + d.getMinutes()
  const weekend = d.getDay() === 0 || d.getDay() === 6
  for (const s of cfg.schedules) {
    if (!s.enabled || !s.apps.includes(app)) continue
    if (s.days === 'weekdays' && weekend) continue
    if (s.days === 'weekends' && !weekend) continue
    const [sh, sm] = s.start.split(':').map(Number)
    const [eh, em] = s.end.split(':').map(Number)
    const a = sh * 60 + sm
    const b = eh * 60 + em
    const inside = a <= b ? mins >= a && mins < b : mins >= a || mins < b
    if (inside) return { allowed: false, reason: `Limited by the “${s.name}” schedule (${s.start}–${s.end}).` }
  }
  const cat = APP_CATEGORY[app]
  const allowance = cfg.allowances.find((x) => x.category === cat)
  if (allowance && allowance.enabled && allowance.used >= allowance.minutes) {
    return { allowed: false, reason: `You've reached your ${allowance.minutes}-minute ${cat} allowance for today.` }
  }
  return { allowed: true }
}

/** Apps that stay available during Downtime (Settings › Screen Time › Always Allowed). */
export const DOWNTIME_ALLOWED: AppId[] = ['phone', 'messages', 'facetime', 'maps', 'settings', 'clock', 'contacts']

export const APP_CATEGORY: Partial<Record<AppId, ScreenTimeConfig['allowances'][number]['category']>> = {
  games: 'Games', music: 'Entertainment', podcasts: 'Entertainment', news: 'Entertainment', messages: 'Social', facetime: 'Social',
  freeform: 'Creativity', playground: 'Creativity', photos: 'Creativity', journal: 'Creativity', notes: 'Education', safari: 'Education',
}
