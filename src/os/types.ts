export type AppId =
  | 'phone' | 'messages' | 'safari' | 'music' | 'facetime' | 'calendar' | 'photos' | 'camera'
  | 'mail' | 'clock' | 'maps' | 'weather' | 'reminders' | 'notes' | 'news' | 'stocks' | 'podcasts'
  | 'health' | 'fitness' | 'home' | 'wallet' | 'settings' | 'siri' | 'playground' | 'shortcuts'
  | 'findmy' | 'freeform' | 'journal' | 'passwords' | 'files' | 'contacts' | 'calculator'
  | 'games' | 'preview' | 'magnifier'

export type Theme = 'light' | 'dark'
export type Orientation = 'portrait' | 'landscape'

export interface Contact {
  id: string
  first: string
  last?: string
  nickname?: string
  relation?: string
  company?: string
  phones: string[]
  emails: string[]
  color: string
  isBusiness?: boolean
  address?: string
  birthday?: string
  notes?: string
  /** Contact Poster style */
  poster?: string
  /** Writing-style hint used by Write with Siri relationship-aware drafting */
  tone?: 'casual' | 'family' | 'formal' | 'teacher'
}

export type AttachmentKind = 'photo' | 'video' | 'link' | 'audio' | 'drawing' | 'location' | 'file'

export interface Attachment {
  kind: AttachmentKind
  photoId?: string
  url?: string
  title?: string
  subtitle?: string
  sizeMB?: number
  /** 0..1 upload progress for large media */
  progress?: number
  offloaded?: boolean
  drawing?: string // SVG path data
  duration?: number
}

export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read' | 'failed' | 'retrying'

export interface Message {
  id: string
  from: 'me' | string
  text?: string
  ts: number
  attachment?: Attachment
  reactions?: { from: string; emoji: string }[]
  status?: MessageStatus
  effect?: string
}

export interface Conversation {
  id: string
  participants: string[]
  name?: string
  pinned?: boolean
  muted?: boolean
  unread?: number
  messages: Message[]
  draft?: string
}

export interface MailMessage {
  id: string
  from: { name: string; email: string }
  to: string
  subject: string
  preview?: string
  body: string
  ts: number
  unread: boolean
  flagged?: boolean
  folder: 'inbox' | 'sent' | 'drafts' | 'archive' | 'trash' | 'junk'
  category: 'primary' | 'transactions' | 'updates' | 'promotions'
  attachments?: { name: string; size: string; kind: 'pdf' | 'image' | 'doc' | 'ics' }[]
  thread?: string
  /** Structured facts for Apple Intelligence suggestions */
  facts?: Record<string, string>
}

export interface CalendarEvent {
  id: string
  title: string
  start: number
  end: number
  allDay?: boolean
  location?: string
  calendar: string
  notes?: string
  invitees?: string[]
  source?: string
}

export interface CalendarInfo {
  id: string
  name: string
  color: string
  account?: string
}

export interface Reminder {
  id: string
  title: string
  due?: number
  done: boolean
  list: string
  notes?: string
  flagged?: boolean
  priority?: 0 | 1 | 2 | 3
  source?: string
}

export interface ReminderList {
  id: string
  name: string
  color: string
  icon: string
}

export type NoteBlock =
  | { t: 'h1' | 'h2' | 'h3' | 'p' | 'quote' | 'code'; text: string; id?: string }
  | { t: 'check'; text: string; done: boolean }
  | { t: 'bullet'; text: string }
  | { t: 'divider' }
  | { t: 'drawing'; paths: string[] }
  | { t: 'link'; text: string; target: string }
  | { t: 'table'; rows: string[][] }

export interface Note {
  id: string
  title: string
  blocks: NoteBlock[]
  folder: string
  updated: number
  pinned?: boolean
}

export type PhotoKind = 'photo' | 'video' | 'screenshot' | 'live' | 'portrait' | 'panorama'

export interface Photo {
  id: string
  scene: string
  ts: number
  kind: PhotoKind
  place?: string
  people?: string[]
  pets?: string[]
  keywords: string[]
  favorite?: boolean
  rating?: number
  capturedByMe: boolean
  description: string
  camera?: string
  lens?: string
  aperture?: string
  iso?: number
  duration?: number
  idDocument?: boolean
  hidden?: boolean
  aiGenerated?: boolean
  /** User edits applied (Clean Up, Extend, Reframe…) */
  edits?: PhotoEdits
  width: number
  height: number
  sizeMB: number
}

export interface PhotoEdits {
  cleanedUp?: string[]
  extended?: boolean
  reframe?: { x: number; y: number; tilt: number }
  filter?: string
  exposure?: number
  crop?: number
}

export interface SharedAlbum {
  id: string
  name: string
  owner: string
  participants: { id: string; platform: 'iOS' | 'Android' | 'Windows' | 'Web'; canPost: boolean; canInvite: boolean }[]
  photos: string[]
  activity: { id: string; who: string; what: string; ts: number; photoId?: string; emoji?: string }[]
  expires?: number
  reactions: Record<string, { who: string; emoji: string }[]>
  fullResolution: boolean
}

export interface NotificationItem {
  id: string
  app: AppId
  title: string
  subtitle?: string
  body: string
  ts: number
  thread?: string
  /** deep link route inside the app */
  route?: string
  actions?: { id: string; label: string; destructive?: boolean }[]
  summary?: boolean
  read?: boolean
  image?: string
  timeSensitive?: boolean
}

export interface LiveActivity {
  id: string
  kind: 'timer' | 'flight' | 'music' | 'call' | 'navigation' | 'findmy' | 'sports' | 'delivery' | 'airdrop' | 'recording' | 'facetime' | 'workout' | 'stopwatch' | 'hotspot'
  title: string
  subtitle?: string
  progress?: number
  endsAt?: number
  startedAt?: number
  data?: Record<string, unknown>
  app?: AppId
  priority: number
}

export interface IslandEvent {
  id: string
  kind: 'silent' | 'ring' | 'airdrop' | 'faceid' | 'charging' | 'hotspot' | 'airpods' | 'lowpower' | 'focus' | 'nfc' | 'network' | 'screenshot' | 'airplay' | 'carkey' | 'generic'
  title?: string
  subtitle?: string
  icon?: string
  duration?: number
  tint?: string
}

export interface SiriTurn {
  id: string
  role: 'user' | 'siri'
  text: string
  ts: number
  cards?: SiriCard[]
  followUps?: string[]
}

export type SiriCard =
  | { type: 'event'; eventId: string }
  | { type: 'reminder'; reminderId: string }
  | { type: 'message'; conversationId: string; messageId: string }
  | { type: 'mail'; mailId: string }
  | { type: 'photos'; photoIds: string[]; title?: string }
  | { type: 'contact'; contactId: string }
  | { type: 'timer'; seconds: number }
  | { type: 'alarm'; alarmId: string }
  | { type: 'music'; trackId: string }
  | { type: 'weather' }
  | { type: 'map'; destination: string; eta?: string; via?: string }
  | { type: 'note'; noteId: string }
  | { type: 'setting'; label: string; route: string }
  | { type: 'camera'; clipId: string }
  | { type: 'draft'; to?: string; body: string; app: 'messages' | 'mail'; subject?: string; sent?: boolean }
  | { type: 'info'; title: string; rows: { label: string; value: string }[] }
  | { type: 'steps'; steps: { label: string; done: boolean }[] }
  | { type: 'app'; app: AppId; route?: string; label: string }

export interface SiriConversation {
  id: string
  title: string
  turns: SiriTurn[]
  updated: number
  pinned?: boolean
}

export interface Track {
  id: string
  title: string
  artist: string
  album: string
  duration: number
  bpm: number
  key: string
  hue: number
  explicit?: boolean
  lyrics?: string[]
}

export interface Alarm {
  id: string
  hour: number
  minute: number
  label: string
  enabled: boolean
  repeat: number[]
  sound: string
  snooze: boolean
}

export interface WalletCard {
  id: string
  kind: 'credit' | 'debit' | 'cash' | 'transit' | 'pass' | 'ticket' | 'id' | 'key' | 'loyalty'
  name: string
  issuer: string
  last4?: string
  gradient: string
  balance?: string
  details?: Record<string, string>
  textColor?: string
}

export interface HomeAccessory {
  id: string
  name: string
  room: string
  kind: 'light' | 'thermostat' | 'lock' | 'camera' | 'fan' | 'outlet' | 'speaker' | 'blinds' | 'sensor' | 'tv' | 'garage'
  on?: boolean
  brightness?: number
  color?: string
  temp?: number
  target?: number
  mode?: 'heat' | 'cool' | 'auto' | 'off'
  locked?: boolean
  battery?: number
  reachable?: boolean
  thread?: boolean
  value?: string
}

export interface CameraClip {
  id: string
  camera: string
  ts: number
  scene: string
  description: string
  tags: string[]
  duration: number
}

export interface ScreenTimeConfig {
  childMode: boolean
  childName: string
  allowedApps: AppId[]
  askToBrowse: boolean
  approvedSites: string[]
  pendingRequests: { id: string; site: string; ts: number; status: 'pending' | 'approved' | 'denied' }[]
  communicationSafety: boolean
  allowances: { category: 'Entertainment' | 'Games' | 'Social' | 'Creativity' | 'Education'; minutes: number; used: number; enabled: boolean }[]
  schedules: { id: string; name: string; start: string; end: string; days: 'weekdays' | 'weekends' | 'everyday'; apps: AppId[]; enabled: boolean }[]
  downtime: boolean
}

export interface SafariTab {
  id: string
  url: string
  title: string
  group?: string
  ts: number
}

export interface Shortcut {
  id: string
  name: string
  color: string
  icon: string
  actions: ShortcutAction[]
  trigger?: string
  description?: string
}

export interface ShortcutAction {
  id: string
  kind: string
  label: string
  params: Record<string, string>
  children?: ShortcutAction[]
  elseIf?: { condition: string; actions: ShortcutAction[] }[]
  otherwise?: ShortcutAction[]
}

export interface JournalEntry {
  id: string
  ts: number
  title: string
  body: string
  photos: string[]
  attachments: { kind: 'location' | 'song' | 'workout' | 'audio' | 'photo'; label: string }[]
  mood?: string
  prompt?: string
}
