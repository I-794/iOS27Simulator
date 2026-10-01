/** Time helpers. Demo data is anchored relative to "now" so it stays coherent every day. */

export const MIN = 60_000
export const HOUR = 3_600_000
export const DAY = 86_400_000

export function startOfDay(ts: number = Date.now()): number {
  const d = new Date(ts)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

/** Timestamp for `days` from today at hh:mm local time. */
export function at(days: number, hh = 9, mm = 0): number {
  const d = new Date(startOfDay())
  d.setDate(d.getDate() + days)
  d.setHours(hh, mm, 0, 0)
  return d.getTime()
}

/** Days until the next given weekday (0=Sun). Returns 0..6, or 7 if `strictlyAfter` and today matches. */
export function daysUntilWeekday(weekday: number, strictlyAfter = true, from = Date.now()): number {
  const today = new Date(from).getDay()
  let diff = (weekday - today + 7) % 7
  if (diff === 0 && strictlyAfter) diff = 7
  return diff
}

export function nextWeekday(weekday: number, hh = 9, mm = 0, strictlyAfter = true): number {
  return at(daysUntilWeekday(weekday, strictlyAfter), hh, mm)
}

export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
export const WEEKDAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
export const MONTHS_SHORT = MONTHS.map((m) => m.slice(0, 3))

export function fmtTime(ts: number, opts: { ampm?: boolean; h24?: boolean } = {}): string {
  const d = new Date(ts)
  let h = d.getHours()
  const m = d.getMinutes()
  if (opts.h24) return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
  const suffix = h >= 12 ? 'PM' : 'AM'
  h = h % 12 || 12
  return `${h}:${m.toString().padStart(2, '0')}${opts.ampm === false ? '' : ' ' + suffix}`
}

export function fmtClock(ts: number, h24 = false): string {
  const d = new Date(ts)
  let h = d.getHours()
  if (!h24) h = h % 12 || 12
  return `${h24 ? h.toString().padStart(2, '0') : h}:${d.getMinutes().toString().padStart(2, '0')}`
}

export function fmtDate(ts: number, style: 'long' | 'short' | 'weekday' | 'monthDay' | 'full' = 'long'): string {
  const d = new Date(ts)
  switch (style) {
    case 'short':
      return `${d.getMonth() + 1}/${d.getDate()}/${String(d.getFullYear()).slice(2)}`
    case 'weekday':
      return WEEKDAYS[d.getDay()]
    case 'monthDay':
      return `${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}`
    case 'full':
      return `${WEEKDAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`
    default:
      return `${WEEKDAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`
  }
}

/** iOS-style relative list timestamp: 9:41 AM / Yesterday / Tuesday / 9/12/26 */
export function fmtRelative(ts: number, now = Date.now()): string {
  const sod = startOfDay(now)
  if (ts >= sod) return fmtTime(ts)
  if (ts >= sod - DAY) return 'Yesterday'
  if (ts >= sod - 6 * DAY) return WEEKDAYS[new Date(ts).getDay()]
  return fmtDate(ts, 'short')
}

/** "now", "5m ago", "2h ago" for notifications */
export function fmtAgo(ts: number, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - ts) / 1000))
  if (s < 60) return 'now'
  const m = Math.round(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h}h ago`
  return fmtRelative(ts, now)
}

export function fmtDuration(sec: number): string {
  sec = Math.max(0, Math.round(sec))
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  if (h) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function sameDay(a: number, b: number): boolean {
  return startOfDay(a) === startOfDay(b)
}

export function dayLabel(ts: number, now = Date.now()): string {
  const diff = Math.round((startOfDay(ts) - startOfDay(now)) / DAY)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Tomorrow'
  if (diff === -1) return 'Yesterday'
  if (diff > 1 && diff < 7) return WEEKDAYS[new Date(ts).getDay()]
  return fmtDate(ts, 'monthDay')
}
