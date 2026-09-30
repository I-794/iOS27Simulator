/* Forecast model for the Weather app. Maple Grove follows the shared WEATHER data and the
   Thursday-storm storyline (daily index = days until Thursday → thunderstorms, 80%). */
import { WEATHER } from '../../os/data/world'
import { daysUntilWeekday, startOfDay, DAY, HOUR } from '../../os/time'

export type Cond = 'clear' | 'partly' | 'cloudy' | 'rain' | 'storm'
export interface Hour { ts: number; h: number; temp: number; icon: string; pop: number; marker?: 'sunrise' | 'sunset' }
export interface Day { ts: number; lo: number; hi: number; icon: string; pop: number; cond: Cond; hours: Hour[]; summary: string }
export interface CityWx {
  id: string
  city: string
  tz?: string
  mine?: boolean
  temp: number
  cond: Cond
  condLabel: string
  hi: number
  lo: number
  feels: number
  humidity: number
  dew: number
  wind: number
  windDir: number
  gust: number
  uv: number
  aqi: number
  vis: number
  pressure: number
  sunrise: number
  sunset: number
  summary: string
  daily: Day[]
  alert?: { title: string; when: string; source: string; body: string }
  precipNext: string
}

export const COND_LABEL: Record<Cond, string> = { clear: 'Clear', partly: 'Partly Cloudy', cloudy: 'Cloudy', rain: 'Rain', storm: 'Thunderstorms' }
const ICON_COND: Record<string, Cond> = { sun: 'clear', moon: 'clear', 'cloud-sun': 'partly', 'cloud-moon': 'partly', cloud: 'cloudy', 'cloud-rain': 'rain', 'cloud-bolt': 'storm' }
export const condOfIcon = (i: string): Cond => ICON_COND[i] ?? 'cloudy'

const fmtCache = new Map<string, Intl.DateTimeFormat>()
/** Local wall-clock hour (fractional) in a timezone. */
export function tzHour(tz: string | undefined, now = Date.now()): number {
  if (!tz) { const d = new Date(now); return d.getHours() + d.getMinutes() / 60 }
  let f = fmtCache.get(tz)
  if (!f) { f = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', minute: 'numeric', hourCycle: 'h23' }); fmtCache.set(tz, f) }
  const p = Object.fromEntries(f.formatToParts(now).map((x) => [x.type, x.value]))
  return (+p.hour % 24) + +p.minute / 60
}
export function fmtClock(hf: number): string {
  const h = Math.floor(hf) % 24
  const m = Math.round((hf - Math.floor(hf)) * 60)
  return `${h % 12 || 12}:${String(m === 60 ? 0 : m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`
}

function hash(s: string) { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0 }
function rng(seed: number) { let s = seed; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296 } }

const shape = (h: number) => {
  // 0 at ~6am, 1 at ~3pm
  const x = ((h - 6 + 24) % 24) / 24
  return x < 0.375 ? Math.sin((x / 0.375) * (Math.PI / 2)) : Math.cos(((x - 0.375) / 0.625) * (Math.PI / 2)) ** 1.3
}

function hoursFor(dayTs: number, lo: number, hi: number, cond: Cond, pop: number, sunrise: number, sunset: number, storm: boolean): Hour[] {
  const out: Hour[] = []
  for (let h = 0; h < 24; h++) {
    const night = h < sunrise || h >= sunset
    let icon = cond === 'clear' ? (night ? 'moon' : 'sun') : cond === 'partly' ? (night ? 'cloud-moon' : 'cloud-sun') : cond === 'cloudy' ? 'cloud' : cond === 'rain' ? 'cloud-rain' : 'cloud'
    let p = 0
    if (storm) {
      if (h >= 16 && h <= 23) { icon = 'cloud-bolt'; p = [60, 70, 80, 85, 90, 80, 70, 60][h - 16] }
      else if (h >= 12) { icon = 'cloud'; p = 20 }
      else icon = night ? 'cloud-moon' : 'cloud-sun'
    } else if (cond === 'rain') p = Math.round(pop * (0.6 + 0.4 * Math.sin((h / 24) * Math.PI)))
    else if (pop) p = h > 12 && h < 18 ? pop : Math.round(pop / 2)
    out.push({ ts: dayTs + h * HOUR, h, temp: Math.round(lo + (hi - lo) * shape(h) - (storm && h >= 17 ? 4 : 0)), icon, pop: p })
  }
  return out
}

function daySummary(d: Omit<Day, 'summary' | 'hours'>, storm: boolean) {
  if (storm) return `Thunderstorms likely from 4 PM, heaviest around 8 PM. Gusts up to 35 mph. High ${d.hi}°, low ${d.lo}°. Chance of rain ${d.pop}%.`
  return `${COND_LABEL[d.cond]}${d.cond === 'rain' ? ' through the day' : ''}. High ${d.hi}°, low ${d.lo}°.${d.pop ? ` Chance of precipitation ${d.pop}%.` : ''}`
}

export function mapleGrove(now = Date.now()): CityWx {
  const thu = daysUntilWeekday(4, false, now)
  const sod = startOfDay(now)
  const daily: Day[] = WEATHER.daily.map((d, i) => {
    let icon = d.icon
    let pop = d.pop
    if (i === thu) { icon = 'cloud-bolt'; pop = 80 }
    else if (i === 2 && thu !== 2) { icon = 'cloud-rain'; pop = 40 }
    const cond = condOfIcon(icon)
    const storm = i === thu
    const base = { ts: sod + i * DAY + 2 * HOUR, lo: d.lo, hi: d.hi, icon, pop, cond }
    return { ...base, ts: startOfDay(base.ts), hours: hoursFor(startOfDay(base.ts), d.lo, d.hi, cond, pop, 7, 18.8, storm), summary: daySummary(base, storm) }
  })
  // today's current hour reads the shared "now" temperature
  const h = new Date(now).getHours()
  daily[0].hours[h] = { ...daily[0].hours[h], temp: WEATHER.temp }
  const thuName = thu === 0 ? 'this evening' : thu === 1 ? 'tomorrow evening' : 'Thursday evening'
  const hnow = new Date(now).getHours()
  const night = hnow < 7 || hnow >= 19
  return {
    id: 'maple', city: WEATHER.city, mine: true, temp: WEATHER.temp, cond: 'partly', condLabel: WEATHER.condition, hi: WEATHER.high, lo: WEATHER.low,
    feels: WEATHER.feels, humidity: WEATHER.humidity, dew: 52, wind: 8, windDir: 315, gust: 14, uv: night ? 0 : WEATHER.uv, aqi: WEATHER.aqi, vis: 10, pressure: 29.92,
    sunrise: 7 + 2 / 60, sunset: 18 + 48 / 60,
    summary: `Partly cloudy through the afternoon. Thunderstorms likely ${thuName}, with gusts up to 35 mph.`,
    daily,
    alert: {
      title: 'Severe Thunderstorm Watch',
      when: `${thu === 0 ? 'Today' : thu === 1 ? 'Tomorrow' : 'Thursday'} 4:00 PM – 11:00 PM`,
      source: 'National Weather Service · Maple Grove County',
      body: 'Conditions are favorable for severe thunderstorms capable of damaging winds up to 60 mph, quarter-size hail and frequent lightning. Secure outdoor objects and plan to be indoors during the evening. Outdoor activities (including after-school practices) may be affected.',
    },
    precipNext: `1.2″ expected ${thu === 0 ? 'tonight' : thu === 1 ? 'tomorrow' : 'Thursday'}.`,
  }
}

const CITY_TZ: Record<string, string> = {
  Seattle: 'America/Los_Angeles', Cupertino: 'America/Los_Angeles', Seoul: 'Asia/Seoul', Chicago: 'America/Chicago', Denver: 'America/Denver', Honolulu: 'Pacific/Honolulu',
  London: 'Europe/London', Tokyo: 'Asia/Tokyo', Paris: 'Europe/Paris', Sydney: 'Australia/Sydney', 'New York': 'America/New_York', Austin: 'America/Chicago',
  Portland: 'America/Los_Angeles', Reykjavík: 'Atlantic/Reykjavik', 'Mexico City': 'America/Mexico_City', Toronto: 'America/Toronto',
}
export const SEARCHABLE = Object.keys(CITY_TZ)

/** Deterministic weather for any other city (preset ones from WEATHER.cities). */
export function cityWx(city: string, now = Date.now()): CityWx {
  const preset = WEATHER.cities.find((c) => c.city === city)
  const r = rng(hash(city))
  const conds: Cond[] = ['clear', 'partly', 'cloudy', 'rain', 'partly', 'clear']
  const cond: Cond = preset ? (preset.condition === 'Rain' ? 'rain' : preset.condition === 'Sunny' || preset.condition === 'Clear' ? 'clear' : 'partly') : conds[Math.floor(r() * conds.length)]
  const hi = preset?.hi ?? Math.round(50 + r() * 35)
  const lo = preset?.lo ?? hi - Math.round(8 + r() * 12)
  const tz = CITY_TZ[city]
  const localNow = tzHour(tz, now)
  const sod = startOfDay(now)
  const sunrise = 6.5 + r() * 1
  const sunset = 18.3 + r() * 1
  const daily: Day[] = Array.from({ length: 10 }, (_, i) => {
    const c: Cond = i === 0 ? cond : conds[Math.floor(r() * conds.length)]
    const dhi = i === 0 ? hi : hi + Math.round((r() - 0.5) * 10)
    const dlo = i === 0 ? lo : lo + Math.round((r() - 0.5) * 8)
    const pop = c === 'rain' ? 50 + Math.round(r() * 40) : c === 'cloudy' ? Math.round(r() * 30) : 0
    const icon = c === 'clear' ? 'sun' : c === 'partly' ? 'cloud-sun' : c === 'cloudy' ? 'cloud' : 'cloud-rain'
    const base = { ts: startOfDay(sod + i * DAY + 2 * HOUR), lo: dlo, hi: dhi, icon, pop, cond: c }
    return { ...base, hours: hoursFor(base.ts, dlo, dhi, c, pop, sunrise, sunset, false), summary: daySummary(base, false) }
  })
  const temp = preset?.temp ?? Math.round(lo + (hi - lo) * shape(localNow))
  return {
    id: city.toLowerCase().replace(/\W+/g, '-'), city, tz, temp, cond, condLabel: preset?.condition ?? COND_LABEL[cond], hi, lo,
    feels: temp - (cond === 'rain' ? 3 : 0), humidity: cond === 'rain' ? 88 : 40 + Math.round(r() * 30), dew: temp - 10, wind: 4 + Math.round(r() * 14), windDir: Math.round(r() * 360), gust: 12 + Math.round(r() * 12),
    uv: localNow < sunrise || localNow > sunset ? 0 : 2 + Math.round(r() * 6), aqi: 15 + Math.round(r() * 60), vis: cond === 'rain' ? 4 : 10, pressure: +(29.7 + r() * 0.5).toFixed(2),
    sunrise, sunset,
    summary: cond === 'rain' ? 'Rain continuing through the evening. Steadier showers after 6 PM.' : `${COND_LABEL[cond]} conditions will continue for the rest of the day.`,
    daily,
    precipNext: cond === 'rain' ? '0.4″ expected in next 24h.' : 'None expected in next 10 days.',
  }
}

export const isNightFor = (c: CityWx, now = Date.now()) => { const h = tzHour(c.tz, now); return h < c.sunrise || h >= c.sunset }
