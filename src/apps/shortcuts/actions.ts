/* Shortcuts action catalog + tree helpers for the action chain (If / Otherwise If / Otherwise). */
import type { LucideIcon } from 'lucide-react'
import {
  Navigation, Type, MessageCircle, Mail, BellRing, Speech, Eye, CloudSun, CalendarDays, ListChecks, NotebookPen, FilePlus, Music, Moon, House,
  Lightbulb, Lock, Timer, ScanText, Camera, ImageDown, DatabaseZap, Database, Sparkles, FileText, Split, Hourglass, Variable, TextCursorInput,
  AppWindow, Globe, SunMoon, BatteryLow, Hand,
} from 'lucide-react'
import type { ShortcutAction } from '../../os/types'
import { uid, useOS } from '../../os/store'
import { PLAYLISTS } from '../../os/data/media'
import { HOME_SCENES } from '../../os/data/world'
import { ICONS } from '../../icons/AppIconArt'

export type Category = 'Scripting' | 'Apple Intelligence' | 'Communication' | 'Location' | 'Calendar & Weather' | 'Media' | 'Home & Focus' | 'Documents' | 'Screen' | 'Data' | 'Device'
export const CATEGORIES: Category[] = ['Apple Intelligence', 'Scripting', 'Communication', 'Screen', 'Data', 'Location', 'Calendar & Weather', 'Home & Focus', 'Media', 'Documents', 'Device']

export interface ParamDef {
  key: string
  type: 'text' | 'enum' | 'contact' | 'bool'
  options?: string[] | (() => string[])
  label?: string
  /** shown only when the block is expanded ("Show More") */
  more?: boolean
}

export interface ActionDef {
  kind: string
  label: string
  category: Category
  icon: LucideIcon
  color: string
  /** sentence with {param} placeholders */
  sentence: string
  params: ParamDef[]
  defaults: Record<string, string>
  output?: string
  desc: string
  isNew?: boolean
  control?: boolean
}

export const PLACES = ['Home', 'Lincoln High School', 'Grandma’s House', 'Brew Lab Coffee', 'Maple Grove Library', 'Riverside Park', 'Greenfield Mall']
export const RECIPIENTS = ['Mom', 'Dad', 'Mia', 'Grandma', 'Alex', 'Sam', 'Priya', 'Nora', 'Mr. Delgado', 'Drumline 🥁 (Group)']
export const FOCUSES = ['Study', 'Do Not Disturb', 'Personal', 'Sleep', 'Driving', 'Fitness']
const noteTitles = () => useOS.getState().notes.map((n) => n.title)
const playlists = () => [...PLAYLISTS.map((p) => p.name), 'Tidal', 'Marching Lights']
const appNames = () => Object.values(ICONS).map((i) => i.name).sort()
export const CONDITIONS = ['contains', 'is', 'is not', 'does not contain', 'has any value']

export const ACTIONS: ActionDef[] = [
  // Apple Intelligence
  { kind: 'model', label: 'Use Model', category: 'Apple Intelligence', icon: Sparkles, color: '#bf5af2', sentence: 'Ask {model} {prompt}', params: [{ key: 'model', type: 'enum', options: ['On-Device', 'Private Cloud Compute', 'ChatGPT'] }, { key: 'prompt', type: 'text' }, { key: 'follow', type: 'bool', label: 'Follow Up', more: true }], defaults: { model: 'Private Cloud Compute', prompt: 'Summarize [Screen Content]', follow: 'Off' }, output: 'Response', desc: 'Ask an Apple Intelligence model to reason over your input and return a response.' },
  { kind: 'summarize', label: 'Summarize Text', category: 'Apple Intelligence', icon: FileText, color: '#bf5af2', sentence: 'Summarize {text}', params: [{ key: 'text', type: 'text' }], defaults: { text: '[Screen Content]' }, output: 'Summary', desc: 'Creates a short summary using Writing Tools.' },

  // Scripting
  { kind: 'text', label: 'Text', category: 'Scripting', icon: Type, color: '#f5b700', sentence: '{text}', params: [{ key: 'text', type: 'text' }], defaults: { text: 'Hello!' }, output: 'Text', desc: 'Passes the specified text to the next action.' },
  { kind: 'if', label: 'If', category: 'Scripting', icon: Split, color: '#8e8e93', sentence: 'If {input} {cond} {value}', params: [{ key: 'input', type: 'enum' }, { key: 'cond', type: 'enum', options: CONDITIONS }, { key: 'value', type: 'text' }], defaults: { input: 'Weather', cond: 'contains', value: 'Rain' }, desc: 'Runs actions when a condition is true. iOS 27 adds Otherwise If branches.', control: true },
  { kind: 'setVar', label: 'Set Variable', category: 'Scripting', icon: Variable, color: '#ff9500', sentence: 'Set variable {name} to {value}', params: [{ key: 'name', type: 'text' }, { key: 'value', type: 'text' }], defaults: { name: 'Status', value: 'On my way' }, desc: 'Stores a value in a named variable.' },
  { kind: 'ask', label: 'Ask for Input', category: 'Scripting', icon: TextCursorInput, color: '#ff9500', sentence: 'Ask for {type} with {prompt}', params: [{ key: 'type', type: 'enum', options: ['Text', 'Number', 'Date'] }, { key: 'prompt', type: 'text' }], defaults: { type: 'Text', prompt: 'What’s up?' }, output: 'Provided Input', desc: 'Prompts you for a value when the shortcut runs.' },
  { kind: 'wait', label: 'Wait', category: 'Scripting', icon: Hourglass, color: '#8e8e93', sentence: 'Wait {seconds}', params: [{ key: 'seconds', type: 'enum', options: ['1 second', '3 seconds', '10 seconds'] }], defaults: { seconds: '1 second' }, desc: 'Pauses before the next action.' },
  { kind: 'showResult', label: 'Show Result', category: 'Scripting', icon: Eye, color: '#ff9500', sentence: 'Show {text}', params: [{ key: 'text', type: 'text' }], defaults: { text: '[Response]' }, desc: 'Shows the result in the Shortcuts run view.' },
  { kind: 'speak', label: 'Speak Text', category: 'Scripting', icon: Speech, color: '#0a84ff', sentence: 'Speak {text}', params: [{ key: 'text', type: 'text' }, { key: 'voice', type: 'enum', options: ['Siri Voice 2', 'Siri Voice 4'], more: true }], defaults: { text: '[Text]', voice: 'Siri Voice 2' }, desc: 'Speaks text aloud with the Siri voice.' },
  { kind: 'notification', label: 'Show Notification', category: 'Scripting', icon: BellRing, color: '#ff3b30', sentence: 'Show notification {text}', params: [{ key: 'text', type: 'text' }], defaults: { text: 'Shortcut finished' }, desc: 'Posts a notification.' },

  // Communication
  { kind: 'message', label: 'Send Message', category: 'Communication', icon: MessageCircle, color: '#34c759', sentence: 'Send {text} to {to}', params: [{ key: 'text', type: 'text' }, { key: 'to', type: 'contact' }, { key: 'confirm', type: 'bool', label: 'Show When Run', more: true }], defaults: { text: '[Text]', to: 'Dad', confirm: 'Off' }, desc: 'Sends a message — iOS 27 supports group conversations as recipients.' },
  { kind: 'email', label: 'Send Email', category: 'Communication', icon: Mail, color: '#0a84ff', sentence: 'Email {text} to {to}', params: [{ key: 'text', type: 'text' }, { key: 'to', type: 'contact' }], defaults: { text: '[Text]', to: 'Mr. Delgado' }, desc: 'Sends an email.' },

  // Screen (iOS 27)
  { kind: 'screen', label: 'Get What’s On Screen', category: 'Screen', icon: ScanText, color: '#5e5ce6', sentence: 'Get {content} on screen', params: [{ key: 'content', type: 'enum', options: ['All Content', 'Text', 'Images', 'Links', 'Entities'] }, { key: 'text', type: 'bool', label: 'Include Text', more: true }, { key: 'images', type: 'bool', label: 'Include Images', more: true }, { key: 'links', type: 'bool', label: 'Include Links', more: true }, { key: 'entities', type: 'bool', label: 'Include Entities (people, places, dates)', more: true }], defaults: { content: 'All Content', text: 'On', images: 'On', links: 'On', entities: 'On' }, output: 'Screen Content', desc: 'Expanded in iOS 27: returns text, images, links and recognized entities from the current screen.', isNew: true },
  { kind: 'screenshot', label: 'Take Screenshot', category: 'Screen', icon: Camera, color: '#5e5ce6', sentence: 'Take screenshot', params: [], defaults: {}, output: 'Screenshot', desc: 'Captures the screen.' },
  { kind: 'savePhoto', label: 'Save to Photo Album', category: 'Screen', icon: ImageDown, color: '#ff9500', sentence: 'Save {input} to {album}', params: [{ key: 'input', type: 'text' }, { key: 'album', type: 'enum', options: ['Recents', 'Robotics', 'Favorites'] }], defaults: { input: '[Screenshot]', album: 'Recents' }, desc: 'Saves an image to Photos.' },

  // Data (iOS 27)
  { kind: 'dataSave', label: 'Save to Data Store', category: 'Data', icon: DatabaseZap, color: '#30b0c7', sentence: 'Save {value} as {key}', params: [{ key: 'value', type: 'text' }, { key: 'key', type: 'text' }], defaults: { value: '[Text]', key: 'last-run' }, desc: 'New in iOS 27: keep values between runs of your shortcuts.', isNew: true },
  { kind: 'dataGet', label: 'Get Stored Data', category: 'Data', icon: Database, color: '#30b0c7', sentence: 'Get stored value for {key}', params: [{ key: 'key', type: 'text' }], defaults: { key: 'last-run' }, output: 'Stored Data', desc: 'New in iOS 27: read a value saved with Save to Data Store.', isNew: true },

  // Location
  { kind: 'eta', label: 'Get Travel Time', category: 'Location', icon: Navigation, color: '#0a84ff', sentence: 'Get {mode} time to {to}', params: [{ key: 'mode', type: 'enum', options: ['Driving', 'Walking', 'Transit', 'Cycling'] }, { key: 'to', type: 'enum', options: PLACES }], defaults: { mode: 'Driving', to: 'Home' }, output: 'Travel Time', desc: 'Gets the travel time and ETA from your current location.' },

  // Calendar & Weather
  { kind: 'weather', label: 'Get Weather', category: 'Calendar & Weather', icon: CloudSun, color: '#32ade6', sentence: 'Get weather {when} in {place}', params: [{ key: 'when', type: 'enum', options: ['Now', 'Today', 'Tomorrow'] }, { key: 'place', type: 'enum', options: ['Current Location', 'Maple Grove', 'Seattle'] }], defaults: { when: 'Now', place: 'Current Location' }, output: 'Weather', desc: 'Gets the current conditions or forecast.' },
  { kind: 'nextEvent', label: 'Get Upcoming Events', category: 'Calendar & Weather', icon: CalendarDays, color: '#ff3b30', sentence: 'Get {which} event {range}', params: [{ key: 'which', type: 'enum', options: ['First', 'Next', 'All'] }, { key: 'range', type: 'enum', options: ['Today', 'Tomorrow', 'This Week'] }], defaults: { which: 'Next', range: 'Today' }, output: 'Event', desc: 'Gets events from your calendars.' },
  { kind: 'reminder', label: 'Add Reminder', category: 'Calendar & Weather', icon: ListChecks, color: '#0a84ff', sentence: 'Add {title} to Reminders {when}', params: [{ key: 'title', type: 'text' }, { key: 'when', type: 'text' }, { key: 'list', type: 'enum', options: ['Reminders', 'School', 'Robotics', 'Groceries'], more: true }], defaults: { title: 'New reminder', when: 'tomorrow at 8 AM', list: 'Reminders' }, desc: 'Adds a reminder.' },
  { kind: 'timer', label: 'Start Timer', category: 'Calendar & Weather', icon: Timer, color: '#ff9500', sentence: 'Start timer for {duration}', params: [{ key: 'duration', type: 'enum', options: ['5 minutes', '10 minutes', '25 minutes', '45 minutes', '1 hour'] }], defaults: { duration: '25 minutes' }, desc: 'Starts a timer in Clock.' },

  // Home & Focus
  { kind: 'focus', label: 'Set Focus', category: 'Home & Focus', icon: Moon, color: '#5856d6', sentence: 'Turn {focus} Focus {state} until {until}', params: [{ key: 'focus', type: 'enum', options: FOCUSES }, { key: 'state', type: 'enum', options: ['On', 'Off'] }, { key: 'until', type: 'enum', options: ['Turned Off', '1 hour', '2 hours', 'I leave', 'Tomorrow morning'] }], defaults: { focus: 'Study', state: 'On', until: 'Turned Off' }, desc: 'Turns a Focus on or off.' },
  { kind: 'scene', label: 'Run Home Scene', category: 'Home & Focus', icon: House, color: '#ff9500', sentence: 'Run {scene}', params: [{ key: 'scene', type: 'enum', options: HOME_SCENES.map((s) => s.name) }], defaults: { scene: 'Good Night' }, desc: 'Runs a Home scene.' },
  { kind: 'lights', label: 'Set Lights', category: 'Home & Focus', icon: Lightbulb, color: '#ffcc00', sentence: 'Set {target} to {level}', params: [{ key: 'target', type: 'enum', options: ['All Lights', 'Jamie’s Room', 'Living Room', 'Kitchen', 'Front Porch'] }, { key: 'level', type: 'enum', options: ['Off', '20%', '30%', '50%', '100%'] }], defaults: { target: 'Jamie’s Room', level: '30%' }, desc: 'Controls HomeKit lights.' },
  { kind: 'lock', label: 'Lock Door', category: 'Home & Focus', icon: Lock, color: '#ff9500', sentence: '{state} {door}', params: [{ key: 'state', type: 'enum', options: ['Lock', 'Unlock'] }, { key: 'door', type: 'enum', options: ['Front Door'] }], defaults: { state: 'Lock', door: 'Front Door' }, desc: 'Locks or unlocks a door.' },

  // Media
  { kind: 'music', label: 'Play Music', category: 'Media', icon: Music, color: '#ff2d55', sentence: 'Play {playlist}', params: [{ key: 'playlist', type: 'enum', options: playlists }, { key: 'shuffle', type: 'bool', label: 'Shuffle', more: true }], defaults: { playlist: 'Study Focus', shuffle: 'Off' }, desc: 'Plays music from your library.' },

  // Documents
  { kind: 'note', label: 'Append to Note', category: 'Documents', icon: NotebookPen, color: '#f5b700', sentence: 'Append {text} to {note}', params: [{ key: 'text', type: 'text' }, { key: 'note', type: 'enum', options: noteTitles }], defaults: { text: '[Screen Content]', note: 'Robotics Build Log' }, desc: 'Adds text to the end of a note.' },
  { kind: 'createNote', label: 'Create Note', category: 'Documents', icon: FilePlus, color: '#f5b700', sentence: 'Create note with {text}', params: [{ key: 'text', type: 'text' }], defaults: { text: '[Text]' }, desc: 'Creates a new note.' },

  // Device
  { kind: 'openApp', label: 'Open App', category: 'Device', icon: AppWindow, color: '#0a84ff', sentence: 'Open {app}', params: [{ key: 'app', type: 'enum', options: appNames }], defaults: { app: 'Music' }, desc: 'Opens an app.' },
  { kind: 'url', label: 'Open URL', category: 'Device', icon: Globe, color: '#0a84ff', sentence: 'Open {url}', params: [{ key: 'url', type: 'text' }], defaults: { url: 'frc-manual.example' }, desc: 'Opens a website in Safari.' },
  { kind: 'appearance', label: 'Set Appearance', category: 'Device', icon: SunMoon, color: '#8e8e93', sentence: 'Set appearance to {mode}', params: [{ key: 'mode', type: 'enum', options: ['Dark', 'Light'] }], defaults: { mode: 'Dark' }, desc: 'Switches Light or Dark Mode.' },
  { kind: 'lowPower', label: 'Set Low Power Mode', category: 'Device', icon: BatteryLow, color: '#34c759', sentence: 'Turn Low Power Mode {state}', params: [{ key: 'state', type: 'enum', options: ['On', 'Off'] }], defaults: { state: 'On' }, desc: 'Turns Low Power Mode on or off.' },
]

const FALLBACK: ActionDef = { kind: 'unknown', label: 'Action', category: 'Scripting', icon: Hand, color: '#8e8e93', sentence: '{value}', params: [{ key: 'value', type: 'text' }], defaults: { value: '' }, desc: '' }

export function defOf(kind: string): ActionDef {
  return ACTIONS.find((a) => a.kind === kind) ?? FALLBACK
}

export function optionsOf(p: ParamDef): string[] {
  return typeof p.options === 'function' ? p.options() : p.options ?? []
}

export function makeAction(kind: string, params: Record<string, string> = {}): ShortcutAction {
  const d = defOf(kind)
  const a: ShortcutAction = { id: uid('act'), kind, label: d.label, params: { ...d.defaults, ...params } }
  if (kind === 'if') {
    a.children = []
    a.otherwise = []
  }
  return a
}

// ---------------------------------------------------------------- tree helpers
export type Branch = 'children' | 'otherwise' | number
export interface Loc { parent: string | null; branch: Branch }

export function listAt(actions: ShortcutAction[], loc: Loc): ShortcutAction[] {
  if (!loc.parent) return actions
  const p = findAction(actions, loc.parent)
  if (!p) return []
  if (loc.branch === 'children') return p.children ?? []
  if (loc.branch === 'otherwise') return p.otherwise ?? []
  return p.elseIf?.[loc.branch]?.actions ?? []
}

export function findAction(actions: ShortcutAction[], id: string): ShortcutAction | undefined {
  for (const a of actions) {
    if (a.id === id) return a
    const inner = [...(a.children ?? []), ...(a.elseIf ?? []).flatMap((e) => e.actions), ...(a.otherwise ?? [])]
    const hit = findAction(inner, id)
    if (hit) return hit
  }
  return undefined
}

/** Apply `fn` to every action list in the tree (depth-first). */
function mapLists(actions: ShortcutAction[], fn: (list: ShortcutAction[], loc: Loc) => ShortcutAction[], loc: Loc = { parent: null, branch: 'children' }): ShortcutAction[] {
  const next = fn(actions, loc).map((a) => {
    if (a.kind !== 'if') return a
    return {
      ...a,
      children: mapLists(a.children ?? [], fn, { parent: a.id, branch: 'children' }),
      elseIf: a.elseIf?.map((e, i) => ({ ...e, actions: mapLists(e.actions, fn, { parent: a.id, branch: i }) })),
      otherwise: mapLists(a.otherwise ?? [], fn, { parent: a.id, branch: 'otherwise' }),
    }
  })
  return next
}

const sameLoc = (a: Loc, b: Loc) => a.parent === b.parent && a.branch === b.branch

export function setListAt(actions: ShortcutAction[], loc: Loc, list: ShortcutAction[]): ShortcutAction[] {
  if (!loc.parent) return list
  return mapLists(actions, (l, at) => (sameLoc(at, loc) ? list : l))
}

export function updateAction(actions: ShortcutAction[], id: string, fn: (a: ShortcutAction) => ShortcutAction): ShortcutAction[] {
  return mapLists(actions, (l) => l.map((a) => (a.id === id ? fn(a) : a)))
}

export function removeAction(actions: ShortcutAction[], id: string): ShortcutAction[] {
  return mapLists(actions, (l) => l.filter((a) => a.id !== id))
}

export function locOf(actions: ShortcutAction[], id: string): { loc: Loc; index: number } | null {
  let found: { loc: Loc; index: number } | null = null
  mapLists(actions, (l, loc) => {
    const i = l.findIndex((a) => a.id === id)
    if (i >= 0 && !found) found = { loc, index: i }
    return l
  })
  return found
}

export function moveAction(actions: ShortcutAction[], id: string, delta: number): ShortcutAction[] {
  const pos = locOf(actions, id)
  if (!pos) return actions
  const list = [...listAt(actions, pos.loc)]
  const to = Math.max(0, Math.min(list.length - 1, pos.index + delta))
  if (to === pos.index) return actions
  const [a] = list.splice(pos.index, 1)
  list.splice(to, 0, a)
  return setListAt(actions, pos.loc, list)
}

export function insertAt(actions: ShortcutAction[], loc: Loc, a: ShortcutAction, index?: number): ShortcutAction[] {
  const list = [...listAt(actions, loc)]
  list.splice(index ?? list.length, 0, a)
  return setListAt(actions, loc, list)
}

/** Magic variables available before action `id` (outputs of earlier actions). */
export function variablesBefore(actions: ShortcutAction[], id?: string): string[] {
  const out: string[] = []
  let stop = false
  const walk = (list: ShortcutAction[]) => {
    for (const a of list) {
      if (stop) return
      if (a.id === id) {
        stop = true
        return
      }
      const d = defOf(a.kind)
      if (d.output && !out.includes(d.output)) out.push(d.output)
      if (a.kind === 'setVar' && a.params.name && !out.includes(a.params.name)) out.push(a.params.name)
      walk(a.children ?? [])
      a.elseIf?.forEach((e) => walk(e.actions))
      walk(a.otherwise ?? [])
    }
  }
  walk(actions)
  return out
}

export function countActions(actions: ShortcutAction[]): number {
  return actions.reduce((n, a) => n + 1 + countActions(a.children ?? []) + (a.elseIf ?? []).reduce((m, e) => m + countActions(e.actions), 0) + countActions(a.otherwise ?? []), 0)
}

/** Split a sentence template into literal text and param tokens. */
export function sentenceParts(sentence: string): { text?: string; param?: string }[] {
  const parts: { text?: string; param?: string }[] = []
  const re = /\{(\w+)\}/g
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(sentence))) {
    if (m.index > last) parts.push({ text: sentence.slice(last, m.index) })
    parts.push({ param: m[1] })
    last = m.index + m[0].length
  }
  if (last < sentence.length) parts.push({ text: sentence.slice(last) })
  return parts
}

/** Split a text value into literal runs and [Variable] references. */
export function textParts(v: string): { text?: string; variable?: string }[] {
  const out: { text?: string; variable?: string }[] = []
  const re = /\[([^\]]+)\]/g
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(v))) {
    if (m.index > last) out.push({ text: v.slice(last, m.index) })
    out.push({ variable: m[1] })
    last = m.index + m[0].length
  }
  if (last < v.length) out.push({ text: v.slice(last) })
  return out
}

/** Parse "Weather contains Sunny" style conditions used by Otherwise If. */
export function parseCondition(s: string): { input: string; cond: string; value: string } {
  const m = s.match(/^(.+?) (does not contain|has any value|contains|is not|is)(?: (.*))?$/i)
  if (!m) return { input: s, cond: 'has any value', value: '' }
  return { input: m[1].replace(/^\[|\]$/g, ''), cond: m[2].toLowerCase(), value: m[3] ?? '' }
}
export const fmtCondition = (c: { input: string; cond: string; value: string }) => `${c.input} ${c.cond}${c.cond === 'has any value' ? '' : ` ${c.value}`}`

// ---------------------------------------------------------------- tile icons
export const TILE_ICONS = ['sparkles', 'home', 'book', 'camera', 'drop', 'music', 'message', 'moon', 'car', 'bolt', 'cloud', 'bell', 'note', 'list', 'timer', 'bulb', 'robot', 'drum', 'umbrella', 'sun', 'heart', 'image'] as const
export const TILE_COLORS = ['#ff3b30', '#ff9500', '#ffcc00', '#34c759', '#00c7be', '#30b0c7', '#0a84ff', '#5856d6', '#af52de', '#ff2d55', '#a2845e', '#8e8e93']
