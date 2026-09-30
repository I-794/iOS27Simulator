/* Journal helpers: local state, personalized writing prompts, streaks and insights. */
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { JournalEntry } from '../../os/types'
import { useOS } from '../../os/store'
import { startOfDay, DAY } from '../../os/time'
import { HEALTH, VISITED } from '../../os/data/world'
import { TRACKS } from '../../os/data/media'

interface JLocal {
  bookmarks: Record<string, boolean>
  lastSync: number
  weeklyGoal: number
  set: (p: Partial<JLocal>) => void
}
export const useJournalLocal = create<JLocal>()(
  persist((set) => ({ bookmarks: {}, lastSync: Date.now() - 4 * 60_000, weeklyGoal: 4, set: (p) => set(p) }), {
    name: 'ios27-journal',
    storage: createJSONStorage(() => localStorage),
    partialize: ({ set: _s, ...rest }) => { void _s; return rest as unknown as JLocal },
  }),
)

export const ATTACH_LIMIT_MB = 1024
export const MOODS = ['😊', '🤩', '😌', '😤', '😴', '😢', '🥁', '🤖']

export function saveEntry(e: JournalEntry) {
  const st = useOS.getState()
  const exists = st.journal.some((x) => x.id === e.id)
  st.set({ journal: exists ? st.journal.map((x) => (x.id === e.id ? e : x)) : [e, ...st.journal] })
  useJournalLocal.getState().set({ lastSync: Date.now() })
}
export function deleteEntry(id: string) {
  const st = useOS.getState()
  st.set({ journal: st.journal.filter((x) => x.id !== id) })
  useJournalLocal.getState().set({ lastSync: Date.now() })
}

export interface JPrompt { id: string; kicker: string; text: string; color: string; icon: string; photo?: string; attach?: JournalEntry['attachments'][number] }

/** Personalized writing prompts generated from recent on-device data (events, photos, workouts, music, places). */
export function buildPrompts(seed = 0): JPrompt[] {
  const st = useOS.getState()
  const now = Date.now()
  const out: JPrompt[] = []
  const lastEntry = [...st.journal].sort((a, b) => b.ts - a.ts)[0]
  if (lastEntry) out.push({ id: 'p-last', kicker: 'Follow up', text: `Reflect on the ${lastEntry.title.toLowerCase()} — what changed since then?`, color: '#af52de', icon: 'refresh', photo: lastEntry.photos[0] })
  const past = st.events.filter((e) => e.end < now && e.end > now - 7 * DAY).sort((a, b) => b.end - a.end)
  const scrim = past.find((e) => /scrimmage/i.test(e.title))
  if (scrim) out.push({ id: 'p-scrim', kicker: 'Robotics Scrimmage · Westfield High', text: 'How did the scrimmage feel? What would you change about autonomous?', color: '#5856d6', icon: 'calendar', photo: 'p-robot-comp', attach: { kind: 'location', label: 'Westfield High' } })
  const drum = past.find((e) => /drumline/i.test(e.title))
  if (drum) out.push({ id: 'p-drum', kicker: `${drum.title} · ${drum.location}`, text: 'What clicked at drumline practice today? Any part of cadence 3 still tricky?', color: '#ff2d55', icon: 'music', photo: 'p-drumline', attach: { kind: 'location', label: drum.location ?? 'Practice Field' } })
  const upcoming = st.events.filter((e) => e.start > now && e.start < now + 4 * DAY && /test|exam|concert|regional/i.test(e.title)).sort((a, b) => a.start - b.start)[0]
  if (upcoming) out.push({ id: 'p-up', kicker: `Coming up · ${upcoming.title}`, text: `How are you feeling about ${upcoming.title.replace(/^Chemistry/, 'the chemistry')}? What would help you feel ready?`, color: '#ff9500', icon: 'sparkles' })
  const run = HEALTH.workouts[0]
  if (run) out.push({ id: 'p-run', kicker: `${run.kind} · ${run.distance}`, text: `You ran ${run.distance} yesterday morning. What was on your mind?`, color: '#34c759', icon: 'run', attach: { kind: 'workout', label: `${run.kind} · ${run.distance}` } })
  const biscuit = st.photos.find((p) => p.pets?.includes('Biscuit') && p.ts > now - 5 * DAY)
  if (biscuit) out.push({ id: 'p-biscuit', kicker: `Photos · ${biscuit.place ?? 'Biscuit'}`, text: 'Write about a small moment with Biscuit this week.', color: '#ff9f0a', icon: 'photo', photo: biscuit.id })
  const track = TRACKS.find((t) => t.id === st.nowPlaying.trackId)
  if (track) out.push({ id: 'p-song', kicker: `On repeat · ${track.title}`, text: `“${track.title}” by ${track.artist} keeps coming up. What does it remind you of?`, color: '#ff375f', icon: 'music', attach: { kind: 'song', label: `${track.title} — ${track.artist}` } })
  const place = VISITED[1]
  out.push({ id: 'p-place', kicker: `Significant location · ${place.place}`, text: `You spent ${place.duration} at ${place.place}. Who were you with?`, color: '#0a84ff', icon: 'pin', attach: { kind: 'location', label: place.place } })
  out.push({ id: 'p-grat', kicker: 'Reflection', text: 'Name three things you’re grateful for today.', color: '#30b0c7', icon: 'heart' })
  // rotate for "shuffle"
  const k = seed % out.length
  return [...out.slice(k), ...out.slice(0, k)]
}

export function dayKey(ts: number) {
  return startOfDay(ts)
}

export function streakInfo(entries: JournalEntry[]) {
  const days = new Set(entries.map((e) => dayKey(e.ts)))
  const today = startOfDay()
  let cur = 0
  let d = days.has(today) ? today : today - DAY
  while (days.has(d)) { cur++; d -= DAY }
  // longest
  const sorted = [...days].sort((a, b) => a - b)
  let longest = 0
  let run = 0
  let prev = -Infinity
  for (const x of sorted) { run = x - prev === DAY ? run + 1 : 1; longest = Math.max(longest, run); prev = x }
  // this week (Sun..Sat)
  const dow = new Date(today).getDay()
  const weekStart = today - dow * DAY
  const week = Array.from({ length: 7 }, (_, i) => ({ day: weekStart + i * DAY, done: days.has(weekStart + i * DAY), future: weekStart + i * DAY > today, today: weekStart + i * DAY === today }))
  return { cur, longest, week, weekCount: week.filter((w) => w.done).length, journaledToday: days.has(today) }
}

export function insights(entries: JournalEntry[]) {
  const year = new Date().getFullYear()
  const thisYear = entries.filter((e) => new Date(e.ts).getFullYear() === year)
  const words = thisYear.reduce((n, e) => n + (e.body.trim() ? e.body.trim().split(/\s+/).length : 0) + (e.title.trim() ? e.title.trim().split(/\s+/).length : 0), 0)
  const days = new Set(thisYear.map((e) => dayKey(e.ts))).size
  const photos = thisYear.reduce((n, e) => n + e.photos.length, 0)
  const places = new Set(thisYear.flatMap((e) => e.attachments.filter((a) => a.kind === 'location').map((a) => a.label))).size
  return { entries: thisYear.length, words, days, photos, places }
}

export function attachmentUsageMB(e: JournalEntry): number {
  const st = useOS.getState()
  const photos = e.photos.reduce((n, id) => n + (st.photos.find((p) => p.id === id)?.sizeMB ?? 2.4), 0)
  return photos + e.attachments.reduce((n, a) => n + (a.kind === 'audio' ? 1.8 : a.kind === 'photo' ? 3 : 0.01), 0)
}
