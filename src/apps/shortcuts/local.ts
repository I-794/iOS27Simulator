import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { LucideIcon } from 'lucide-react'
import {
  Sparkles, House, BookOpen, Camera, Droplet, Music, MessageCircle, Moon, Car, Zap, CloudSun, Bell, NotebookPen, ListChecks, Timer, Lightbulb,
  Bot, Drum, Umbrella, Sun, Heart, Image, MapPin, Clock, ScanLine, BellRing, AlarmClock, BatteryLow, AppWindow, Workflow,
} from 'lucide-react'
import type { Shortcut } from '../../os/types'
import { useOS } from '../../os/store'
import { makeAction } from './actions'

interface ShortcutsLocal {
  disabled: Record<string, boolean>
  immediate: Record<string, boolean>
  seeded: boolean
  set: (p: Partial<ShortcutsLocal>) => void
}

export const useShortcutsLocal = create<ShortcutsLocal>()(
  persist((set) => ({ disabled: {}, immediate: {}, seeded: false, set: (p) => set(p) }), {
    name: 'ios27-shortcuts',
    storage: createJSONStorage(() => localStorage),
    partialize: ({ set: _s, ...rest }) => { void _s; return rest as unknown as ShortcutsLocal },
  }),
)

export const TILE_ICON: Record<string, LucideIcon> = {
  sparkles: Sparkles, home: House, book: BookOpen, camera: Camera, drop: Droplet, music: Music, message: MessageCircle, moon: Moon, car: Car, bolt: Zap,
  cloud: CloudSun, bell: Bell, note: NotebookPen, list: ListChecks, timer: Timer, bulb: Lightbulb, robot: Bot, drum: Drum, umbrella: Umbrella, sun: Sun,
  heart: Heart, image: Image,
}
export const tileIcon = (k: string): LucideIcon => TILE_ICON[k] ?? Workflow

export function triggerMeta(t: string): { icon: LucideIcon; color: string; kind: string; isNew?: boolean } {
  if (/^(when i )?(leave|arrive|get to)/i.test(t)) return { icon: MapPin, color: '#af52de', kind: 'Location' }
  if (/^time of day/i.test(t)) return { icon: Clock, color: '#0a84ff', kind: 'Time of Day' }
  if (/screenshot/i.test(t)) return { icon: ScanLine, color: '#5e5ce6', kind: 'Screenshot', isNew: true }
  if (/notification|message from|email from/i.test(t)) return { icon: BellRing, color: '#ff3b30', kind: 'Notification', isNew: true }
  if (/focus/i.test(t)) return { icon: Moon, color: '#5856d6', kind: 'Focus' }
  if (/alarm/i.test(t)) return { icon: AlarmClock, color: '#ff9500', kind: 'Alarm' }
  if (/carplay/i.test(t)) return { icon: Car, color: '#34c759', kind: 'CarPlay' }
  if (/battery/i.test(t)) return { icon: BatteryLow, color: '#34c759', kind: 'Battery Level' }
  return { icon: AppWindow, color: '#0a84ff', kind: 'App' }
}

export const TRIGGER_TYPES: { kind: string; isNew?: boolean; options: string[] }[] = [
  { kind: 'Time of Day', options: ['Time of Day: 7:00 AM, Weekdays', 'Time of Day: 6:30 AM, Daily', 'Time of Day: 9:00 PM, Daily', 'Time of Day: 9:00 AM, Weekends'] },
  { kind: 'Arrive', options: ['Arrive at Home', 'Arrive at Lincoln High School', 'Arrive at Grandma’s House', 'Arrive at Maple Grove Library'] },
  { kind: 'Leave', options: ['Leave Lincoln High School', 'Leave Home', 'Leave Lincoln High Practice Field'] },
  { kind: 'Screenshot', isNew: true, options: ['Screenshot taken in Safari', 'Screenshot taken in Messages', 'Screenshot taken in Any App'] },
  { kind: 'Notification', isNew: true, options: ['Notification from Messages · Alex', 'Notification from Mail containing “Robotics”', 'Notification from Messages · Drumline 🥁 (Group)', 'Notification from Calendar'] },
  { kind: 'Focus', options: ['When Study Focus turns on', 'When Sleep Focus turns on', 'When Driving Focus turns on'] },
  { kind: 'Alarm', options: ['When my alarm is stopped'] },
  { kind: 'CarPlay', options: ['When CarPlay connects'] },
  { kind: 'Battery Level', options: ['Battery Level falls below 20%', 'Battery Level falls below 50%'] },
  { kind: 'App', options: ['When Music is opened', 'When Safari is opened', 'When Messages is closed'] },
]

/** Adds a couple of automation-backed shortcuts the first time the app opens. */
export function seedShortcuts() {
  useShortcutsLocal.getState().set({ seeded: true, immediate: { 'sh-home': true, 'sh-shot': true, 'sh-morning': false, 'sh-robomail': true } })
  const st = useOS.getState()
  const have = new Set(st.shortcuts.map((s) => s.id))
  const extra: Shortcut[] = []
  if (!have.has('sh-morning')) {
    extra.push({
      id: 'sh-morning', name: 'Morning Briefing', color: '#ff9500', icon: 'sun', trigger: 'Time of Day: 7:00 AM, Weekdays',
      actions: [
        { ...makeAction('weather', { when: 'Today' }), id: 'm1' },
        { ...makeAction('nextEvent', { which: 'First', range: 'Today' }), id: 'm2' },
        { ...makeAction('text', { text: 'Good morning, Jamie! [Weather]. First up: [Event].' }), id: 'm3' },
        { ...makeAction('speak', { text: '[Text]' }), id: 'm4' },
      ],
    })
  }
  if (!have.has('sh-robomail')) {
    extra.push({
      id: 'sh-robomail', name: 'Robotics Mail to Log', color: '#5e5ce6', icon: 'robot', trigger: 'Notification from Mail containing “Robotics”',
      actions: [
        { ...makeAction('screen', { content: 'Text' }), id: 'r1' },
        { ...makeAction('summarize', { text: '[Screen Content]' }), id: 'r2' },
        { ...makeAction('note', { text: '[Summary]', note: 'Robotics Build Log' }), id: 'r3' },
        { ...makeAction('dataSave', { value: '[Summary]', key: 'last-robotics-mail' }), id: 'r4' },
      ],
    })
  }
  if (!have.has('sh-drumline')) {
    extra.push({
      id: 'sh-drumline', name: 'Drumline Running Late', color: '#ff2d55', icon: 'drum',
      actions: [
        { ...makeAction('eta', { to: 'Lincoln High School', mode: 'Driving' }), id: 'd1' },
        { ...makeAction('text', { text: 'Running a little late to sectionals — be there in [Travel Time] 🥁' }), id: 'd2' },
        { ...makeAction('message', { text: '[Text]', to: 'Drumline 🥁 (Group)' }), id: 'd3' },
      ],
    })
  }
  if (extra.length) st.set({ shortcuts: [...st.shortcuts, ...extra] })
}
