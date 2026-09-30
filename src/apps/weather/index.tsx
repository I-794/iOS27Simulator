import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { Map as MapIcon, List as ListIcon, Navigation, TriangleAlert, Clock, CalendarDays, Sun, Wind, Sunrise, Sunset, Droplets, Droplet, Thermometer, Eye, Gauge, Leaf, Umbrella, Ellipsis, Minus, Play, Pause, Check, ChevronDown } from 'lucide-react'
import { SearchField } from '../../ui/controls'
import { openMenu } from '../../ui/overlay'
import { useOS } from '../../os/store'
import { useAppRoute, useOnscreen, useNow } from '../../os/hooks'
import { useShell } from '../../shell/shellState'
import { WeatherGlyph } from '../../shell/widgets/Widgets'
import { WEEKDAYS_SHORT } from '../../os/time'
import { MapView } from '../maps/MapView'
import { Sky, skyGradient } from './Sky'
import { mapleGrove, cityWx, isNightFor, tzHour, fmtClock, SEARCHABLE, type CityWx, type Day } from './data'
import './weather.css'

interface WxLocal { unit: 'F' | 'C'; cities: string[]; set: (p: Partial<WxLocal>) => void }
const useWx = create<WxLocal>()(persist((set) => ({ unit: 'F', cities: ['Seattle', 'Cupertino', 'Seoul'], set: (p) => set(p) }), { name: 'ios27-weather', partialize: (s) => ({ unit: s.unit, cities: s.cities }) }))

const useT = () => {
  const unit = useWx((s) => s.unit)
  return (f: number) => (unit === 'C' ? Math.round(((f - 32) * 5) / 9) : Math.round(f))
}

function Glyph({ icon, size = 26 }: { icon: string; size?: number }) {
  if (icon === 'sunrise') return <Sunrise size={size} color="#ffd60a" />
  if (icon === 'sunset') return <Sunset size={size} color="#ff9f0a" />
  if (icon === 'cloud-rain' || icon === 'cloud-bolt') return <span className="wx-glyph-rain"><WeatherGlyph icon={icon} size={size} color="#fff" /></span>
  return <WeatherGlyph icon={icon} size={size} />
}

export default function WeatherApp() {
  const loc = useWx()
  const minute = useNow(60_000)
  const cities = useMemo(() => [mapleGrove(minute), ...loc.cities.map((c) => cityWx(c, minute))], [loc.cities, minute])
  const [idx, setIdx] = useState(0)
  const [list, setList] = useState(false)
  const pager = useRef<HTMLDivElement>(null)
  const reduce = useOS((s) => s.reduceMotion)
  const low = useOS((s) => s.lowPower)
  const goTo = (i: number, smooth = true) => {
    const el = pager.current
    if (el) el.scrollTo({ left: i * el.offsetWidth, behavior: smooth ? 'smooth' : 'auto' })
    setIdx(i)
  }
  useEffect(() => {
    useShell.getState().set({ statusOverride: 'light' })
    return () => useShell.getState().set({ statusOverride: null })
  }, [])
  useAppRoute('weather', (r) => {
    const m = r.match(/^city\/(.+)$/)
    if (m) { const i = cities.findIndex((c) => c.city.toLowerCase() === decodeURIComponent(m[1]).toLowerCase()); if (i >= 0) { setList(false); window.setTimeout(() => goTo(i), 50) } }
    else if (r === 'list') setList(true)
  })
  const cur = cities[Math.min(idx, cities.length - 1)]
  useOnscreen('weather', `Weather for ${cur.city}: ${cur.temp}° ${cur.condLabel}. ${cur.summary}`)
  return (
    <div className="app-root wx-root">
      <div className="wx-pager" ref={pager} onScroll={(e) => { const i = Math.round(e.currentTarget.scrollLeft / e.currentTarget.offsetWidth); if (i !== idx) setIdx(i) }}>
        {cities.map((c, i) => <CityPage key={c.id} c={c} active={i === idx} still={reduce || low || Math.abs(i - idx) > 0} />)}
      </div>
      <div className="wx-toolbar">
        <button className="wx-tb-btn" aria-label="Precipitation map" onClick={() => document.querySelector<HTMLElement>(`.wx-page:nth-child(${idx + 1}) .wx-radar`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })}><MapIcon size={22} /></button>
        <div className="wx-dots">
          {cities.map((c, i) => (
            <button key={c.id} className={i === idx ? 'on' : ''} aria-label={c.city} onClick={() => goTo(i)}>
              {c.mine ? <Navigation size={9} fill="currentColor" strokeWidth={0} /> : <i />}
            </button>
          ))}
        </div>
        <button className="wx-tb-btn" aria-label="Locations" onClick={() => setList(true)}><ListIcon size={22} /></button>
      </div>
      {list && <CityList cities={cities} onPick={(i) => { setList(false); window.setTimeout(() => goTo(i, false), 30) }} onClose={() => setList(false)} />}
    </div>
  )
}

// ------------------------------------------------------------------ city page
function CityPage({ c, active, still }: { c: CityWx; active: boolean; still: boolean }) {
  const T = useT()
  const unit = useWx((s) => s.unit)
  const [top, setTop] = useState(0)
  const [day, setDay] = useState<number | null>(null)
  const [alertOpen, setAlertOpen] = useState(false)
  const now = useNow(60_000)
  const night = isNightFor(c, now)
  const skyCond = day !== null ? c.daily[day].cond : c.cond
  const skyNight = day !== null ? false : night
  const localH = tzHour(c.tz, now)
  const collapse = Math.min(1, Math.max(0, (top - 20) / 110))
  useEffect(() => { if (!active) setDay(null) }, [active])
  return (
    <section className="wx-page" aria-hidden={!active}>
      <Sky cond={skyCond} night={skyNight} still={still} />
      <div className="wx-scroll scroll" onScroll={(e) => setTop(e.currentTarget.scrollTop)}>
        <div className="wx-content">
          <header className="wx-head" style={{ opacity: 1 - collapse * 0.15 }}>
            <div className="wx-city">{c.mine ? 'My Location' : c.city}</div>
            <div className="wx-sub">{c.mine ? c.city.toUpperCase() : fmtClock(localH)}</div>
            <div className="wx-bigtemp" style={{ opacity: 1 - collapse, transform: `scale(${1 - collapse * 0.25})`, height: 104 * (1 - collapse * 0.8) }}>{T(c.temp)}°</div>
            <div className="wx-cond" style={{ opacity: 1 - collapse }}>{c.condLabel}</div>
            <div className="wx-hl" style={{ opacity: 1 - collapse }}>H:{T(c.hi)}°  L:{T(c.lo)}°</div>
            <div className="wx-compact" style={{ opacity: collapse }}>{T(c.temp)}° | {c.condLabel}</div>
          </header>
          <div className="wx-mods">
            {c.alert && (
              <Card className="wx-alert wide" icon={<TriangleAlert size={14} />} title="Severe Weather" onClick={() => setAlertOpen(!alertOpen)}>
                <div className="wx-alert-title">{c.alert.title}</div>
                <div className="wx-alert-when">{c.alert.when}</div>
                {alertOpen && <div className="wx-alert-body anim-fade">{c.alert.body}</div>}
                <div className="wx-alert-src">{c.alert.source} <ChevronDown size={14} style={{ transform: alertOpen ? 'rotate(180deg)' : undefined, transition: 'transform .3s' }} /></div>
              </Card>
            )}
            <Hourly c={c} localH={localH} />
            <Card className="wide" icon={<CalendarDays size={14} />} title="10-Day Forecast">
              <TenDay c={c} localH={localH} open={day} onToggle={(i) => setDay(day === i ? null : i)} unit={unit} />
            </Card>
            <Radar c={c} />
            <Card icon={<Sun size={14} />} title="UV Index">
              <div className="wx-mod-big">{c.uv}</div>
              <div className="wx-mod-label">{uvLabel(c.uv)}</div>
              <div className="wx-uvbar"><i style={{ left: `${Math.min(100, (c.uv / 11) * 100)}%` }} /></div>
              <div className="wx-mod-note">{c.uv >= 3 ? 'Use sun protection 11AM–3PM.' : 'Low for the rest of the day.'}</div>
            </Card>
            <Card icon={<Sunset size={14} />} title={localH > c.sunrise && localH < c.sunset ? 'Sunset' : 'Sunrise'}>
              <div className="wx-mod-big sm">{fmtClock(localH > c.sunrise && localH < c.sunset ? c.sunset : c.sunrise)}</div>
              <SunCurve c={c} h={localH} />
              <div className="wx-mod-note">{localH > c.sunrise && localH < c.sunset ? `Sunrise: ${fmtClock(c.sunrise)}` : `Sunset: ${fmtClock(c.sunset)}`}</div>
            </Card>
            <Card icon={<Wind size={14} />} title="Wind" className="wide">
              <div className="wx-wind">
                <div className="wx-wind-rows">
                  <div><b>{unit === 'C' ? Math.round(c.wind * 1.609) : c.wind}</b> {unit === 'C' ? 'km/h' : 'mph'} <span>Wind</span></div>
                  <div><b>{unit === 'C' ? Math.round(c.gust * 1.609) : c.gust}</b> {unit === 'C' ? 'km/h' : 'mph'} <span>Gusts</span></div>
                  <div><b>{Math.round(c.windDir)}°</b> {dirName(c.windDir)} <span>Direction</span></div>
                </div>
                <Compass dir={c.windDir} speed={c.wind} />
              </div>
            </Card>
            <Card icon={<Droplets size={14} />} title="Precipitation">
              <div className="wx-mod-big sm">0″</div>
              <div className="wx-mod-label">Today</div>
              <div className="wx-mod-note">{c.precipNext}</div>
            </Card>
            <Card icon={<Thermometer size={14} />} title="Feels Like">
              <div className="wx-mod-big">{T(c.feels)}°</div>
              <div className="wx-mod-note">{Math.abs(c.feels - c.temp) <= 2 ? 'Similar to the actual temperature.' : c.feels < c.temp ? 'Wind is making it feel cooler.' : 'Humidity is making it feel warmer.'}</div>
            </Card>
            <Card icon={<Droplet size={14} />} title="Humidity">
              <div className="wx-mod-big">{c.humidity}%</div>
              <div className="wx-mod-note">The dew point is {T(c.dew)}° right now.</div>
            </Card>
            <Card icon={<Eye size={14} />} title="Visibility">
              <div className="wx-mod-big">{unit === 'C' ? Math.round(c.vis * 1.609) : c.vis} {unit === 'C' ? 'km' : 'mi'}</div>
              <div className="wx-mod-note">{c.vis >= 10 ? 'Perfectly clear view.' : 'Rain is reducing visibility.'}</div>
            </Card>
            <Card icon={<Gauge size={14} />} title="Pressure">
              <PressureGauge v={c.pressure} falling={!!c.alert} unit={unit} />
            </Card>
            <Card icon={<Leaf size={14} />} title="Air Quality" className="wide">
              <div className="wx-mod-big sm">{c.aqi} — {c.aqi <= 50 ? 'Good' : c.aqi <= 100 ? 'Moderate' : 'Unhealthy for Sensitive Groups'}</div>
              <div className="wx-aqibar"><i style={{ left: `${Math.min(100, (c.aqi / 300) * 100)}%` }} /></div>
              <div className="wx-mod-note">Air quality index is {c.aqi}, which is similar to yesterday at about this time.</div>
            </Card>
          </div>
          <div className="wx-foot">
            Weather for {c.city}
            <div className="row gap12" style={{ justifyContent: 'center', marginTop: 6 }}>
              <button onClick={() => useOS.getState().showToast('Thanks — your report was sent')}>Report an Issue</button>
              <button onClick={() => useOS.getState().launch('maps')}>Open in Maps</button>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function Card({ icon, title, children, className = '', onClick }: { icon: ReactNode; title: string; children: ReactNode; className?: string; onClick?: () => void }) {
  return (
    <div className={`wx-card ${className}`} onClick={onClick} role={onClick ? 'button' : undefined}>
      <div className="wx-card-h">{icon} {title.toUpperCase()}</div>
      {children}
    </div>
  )
}

const uvLabel = (u: number) => (u <= 2 ? 'Low' : u <= 5 ? 'Moderate' : u <= 7 ? 'High' : u <= 10 ? 'Very High' : 'Extreme')
const dirName = (d: number) => ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(((d % 360) + 360) % 360 / 45) % 8]
const hourLabel = (h: number) => `${h % 12 || 12}${h >= 12 ? 'PM' : 'AM'}`

// ------------------------------------------------------------------ hourly (iOS 27: temp curve + precip + sun markers)
function Hourly({ c, localH }: { c: CityWx; localH: number }) {
  const T = useT()
  const H0 = Math.floor(localH)
  type Col = { key: string; label: string; icon: string; temp?: number; pop: number; marker?: string }
  const cols: Col[] = []
  for (let i = 0; i <= 24; i++) {
    const H = H0 + i
    const d = c.daily[Math.floor(H / 24)] ?? c.daily[c.daily.length - 1]
    const hr = d.hours[H % 24]
    cols.push({ key: `h${i}`, label: i === 0 ? 'Now' : hourLabel(H % 24), icon: hr.icon, temp: i === 0 ? c.temp : hr.temp, pop: hr.pop })
    for (const [t, kind] of [[c.sunrise, 'sunrise'], [c.sunset, 'sunset']] as [number, string][]) {
      const abs = Math.floor(H / 24) * 24 + t
      if (abs > H && abs < H + 1 && abs > localH) cols.push({ key: `${kind}${i}`, label: fmtClock(t).replace(' ', ''), icon: kind, pop: 0, marker: kind === 'sunrise' ? 'Sunrise' : 'Sunset' })
    }
  }
  const temps = cols.filter((x) => x.temp !== undefined).map((x) => x.temp!)
  const min = Math.min(...temps)
  const max = Math.max(...temps)
  const W = 58
  const pts = cols.map((x, i) => (x.temp !== undefined ? `${i * W + W / 2},${28 - ((x.temp - min) / Math.max(1, max - min)) * 22}` : null)).filter(Boolean).join(' ')
  const storm = c.daily.findIndex((d) => d.cond === 'storm')
  return (
    <Card className="wide" icon={<Clock size={14} />} title="Hourly Forecast">
      <div className="wx-hr-summary">{storm >= 0 && storm <= 1 ? c.summary : c.summary.split('.')[0] + '.'}</div>
      <div className="wx-hours scroll" onPointerDown={(e) => e.stopPropagation()}>
        <div className="wx-hours-track" style={{ width: cols.length * W }}>
          {cols.map((x) => (
            <div key={x.key} className={`wx-hour ${x.marker ? 'marker' : ''}`} style={{ width: W }}>
              <span className="wx-hour-l">{x.label}</span>
              <span className="wx-hour-i"><Glyph icon={x.icon} size={24} />{x.pop >= 20 && <span className="wx-pop">{x.pop}%</span>}</span>
              <span className="wx-hour-t">{x.marker ?? `${T(x.temp!)}°`}</span>
            </div>
          ))}
          <svg className="wx-hours-curve" width={cols.length * W} height="34" aria-hidden>
            <polyline points={pts} fill="none" stroke="rgb(255 255 255 / .55)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            {cols.map((x, i) => x.pop > 0 && <rect key={i} x={i * W + W / 2 - 7} y={34 - x.pop * 0.1} width="14" height={x.pop * 0.1} rx="2" fill="rgb(100 190 255 / .6)" />)}
          </svg>
        </div>
      </div>
    </Card>
  )
}

// ------------------------------------------------------------------ 10-day with expandable hourly chart
function TenDay({ c, localH, open, onToggle, unit }: { c: CityWx; localH: number; open: number | null; onToggle: (i: number) => void; unit: 'F' | 'C' }) {
  const T = useT()
  const min = Math.min(...c.daily.map((d) => d.lo))
  const max = Math.max(...c.daily.map((d) => d.hi))
  const pct = (v: number) => ((v - min) / Math.max(1, max - min)) * 100
  const todayIdx = new Date().getDay()
  return (
    <div className="wx-days">
      {c.daily.map((d, i) => (
        <div key={i} className={`wx-day ${open === i ? 'open' : ''}`}>
          <button className="wx-day-row" onClick={(e) => { e.stopPropagation(); onToggle(i) }} aria-expanded={open === i}>
            <span className="wx-day-n">{i === 0 ? 'Today' : WEEKDAYS_SHORT[(todayIdx + i) % 7]}</span>
            <span className="wx-day-i"><Glyph icon={d.icon} size={24} />{d.pop >= 20 && <span className="wx-pop">{d.pop}%</span>}</span>
            <span className="wx-day-lo">{T(d.lo)}°</span>
            <span className="wx-range">
              <i style={{ left: `${pct(d.lo)}%`, right: `${100 - pct(d.hi)}%`, background: `linear-gradient(90deg, ${tempColor(d.lo)}, ${tempColor(d.hi)})`, backgroundSize: '100% 100%' }} />
              {i === 0 && <b style={{ left: `${pct(c.temp)}%` }} />}
            </span>
            <span className="wx-day-hi">{T(d.hi)}°</span>
          </button>
          {open === i && <DayChart d={d} fromH={i === 0 ? Math.floor(localH) : 0} unit={unit} />}
        </div>
      ))}
    </div>
  )
}

function tempColor(f: number) {
  if (f < 45) return '#5ac8fa'
  if (f < 55) return '#63d8c4'
  if (f < 63) return '#a6e35c'
  if (f < 70) return '#ffd60a'
  if (f < 78) return '#ff9f0a'
  return '#ff6b3d'
}

function DayChart({ d, fromH, unit }: { d: Day; fromH: number; unit: 'F' | 'C' }) {
  const T = useT()
  const hrs = d.hours
  const W = 320
  const Hc = 120
  const tmin = Math.min(...hrs.map((h) => h.temp)) - 2
  const tmax = Math.max(...hrs.map((h) => h.temp)) + 2
  const x = (h: number) => (h / 23) * W
  const y = (t: number) => 10 + (1 - (t - tmin) / (tmax - tmin)) * (Hc - 30)
  const line = hrs.map((h) => `${x(h.h).toFixed(1)},${y(h.temp).toFixed(1)}`).join(' ')
  const hiH = hrs.reduce((a, b) => (b.temp > a.temp ? b : a))
  const loH = hrs.reduce((a, b) => (b.temp < a.temp ? b : a))
  return (
    <div className="wx-chart anim-fade" onClick={(e) => e.stopPropagation()}>
      <div className="wx-chart-icons">{[0, 3, 6, 9, 12, 15, 18, 21].map((h) => <span key={h}><Glyph icon={hrs[h].icon} size={18} />{hrs[h].pop >= 20 && <em>{hrs[h].pop}%</em>}</span>)}</div>
      <svg viewBox={`0 0 ${W} ${Hc}`} className="wx-chart-svg" preserveAspectRatio="none">
        <defs>
          <linearGradient id={`wxg-${d.ts}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffd60a" stopOpacity=".5" /><stop offset="1" stopColor="#ffd60a" stopOpacity="0" /></linearGradient>
          <linearGradient id={`wxl-${d.ts}`} x1="0" y1="0" x2="1" y2="0">{hrs.filter((_, i) => i % 4 === 0).map((h, i, a) => <stop key={i} offset={i / (a.length - 1)} stopColor={tempColor(h.temp)} />)}</linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((f) => <line key={f} x1="0" x2={W} y1={Hc * f} y2={Hc * f} stroke="rgb(255 255 255 / .12)" />)}
        {hrs.map((h) => h.pop > 0 && <rect key={h.h} x={x(h.h) - 4} y={Hc - h.pop * 0.28} width="8" height={h.pop * 0.28} rx="2" fill="rgb(90 180 255 / .55)" />)}
        <polygon points={`0,${Hc} ${line} ${W},${Hc}`} fill={`url(#wxg-${d.ts})`} />
        <polyline points={line} fill="none" stroke={`url(#wxl-${d.ts})`} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
        {fromH > 0 && <line x1={x(fromH)} x2={x(fromH)} y1="0" y2={Hc} stroke="#fff" strokeDasharray="3 3" strokeOpacity=".6" />}
        <circle cx={x(hiH.h)} cy={y(hiH.temp)} r="4" fill="#fff" />
        <circle cx={x(loH.h)} cy={y(loH.temp)} r="4" fill="#fff" />
      </svg>
      <div className="wx-chart-x"><span>12AM</span><span>6AM</span><span>12PM</span><span>6PM</span><span>12AM</span></div>
      <div className="wx-chart-sum">{d.summary.replace(/(\d+)°/g, (_m, n) => `${T(+n)}°`)}{unit === 'C' ? ' (°C)' : ''}</div>
    </div>
  )
}

// ------------------------------------------------------------------ modules
function SunCurve({ c, h }: { c: CityWx; h: number }) {
  const W = 140
  const pts = Array.from({ length: 49 }, (_, i) => { const t = i / 2; return `${(t / 24) * W},${30 - Math.sin(((t - c.sunrise) / (c.sunset - c.sunrise)) * Math.PI) * 18 * (t > c.sunrise && t < c.sunset ? 1 : 0.35)}` }).join(' ')
  const sx = (h / 24) * W
  const up = h > c.sunrise && h < c.sunset
  const sy = 30 - Math.sin(((h - c.sunrise) / (c.sunset - c.sunrise)) * Math.PI) * 18 * (up ? 1 : 0.35)
  return (
    <svg viewBox={`0 0 ${W} 40`} className="wx-sun-curve" aria-hidden>
      <line x1="0" x2={W} y1="30" y2="30" stroke="rgb(255 255 255 / .35)" />
      <polyline points={pts} fill="none" stroke="rgb(255 255 255 / .6)" strokeWidth="2" />
      <circle cx={sx} cy={sy} r="4.5" fill={up ? '#fff' : 'rgb(255 255 255 / .5)'} style={{ filter: up ? 'drop-shadow(0 0 4px #fff)' : undefined }} />
    </svg>
  )
}

function Compass({ dir, speed }: { dir: number; speed: number }) {
  return (
    <svg viewBox="0 0 120 120" className="wx-compass" role="img" aria-label={`Wind from ${dirName(dir)}`}>
      <circle cx="60" cy="60" r="54" fill="none" stroke="rgb(255 255 255 / .2)" strokeWidth="1" />
      {Array.from({ length: 72 }, (_, i) => {
        const a = (i * 5 * Math.PI) / 180
        const major = i % 18 === 0
        return <line key={i} x1={60 + Math.sin(a) * (major ? 44 : 48)} y1={60 - Math.cos(a) * (major ? 44 : 48)} x2={60 + Math.sin(a) * 53} y2={60 - Math.cos(a) * 53} stroke={major ? '#fff' : 'rgb(255 255 255 / .35)'} strokeWidth={major ? 2 : 1} />
      })}
      {['N', 'E', 'S', 'W'].map((n, i) => <text key={n} x={60 + Math.sin((i * Math.PI) / 2) * 35} y={64 - Math.cos((i * Math.PI) / 2) * 35} textAnchor="middle" className="wx-compass-t">{n}</text>)}
      <g transform={`rotate(${dir + 180} 60 60)`} className="wx-compass-arrow">
        <line x1="60" y1="104" x2="60" y2="22" stroke="#fff" strokeWidth="2.5" />
        <path d="M60 12 L66 26 L54 26 Z" fill="#fff" />
        <circle cx="60" cy="104" r="3.5" fill="none" stroke="#fff" strokeWidth="2" />
      </g>
      <circle cx="60" cy="60" r="17" fill="rgb(40 70 110 / .9)" />
      <text x="60" y="62" textAnchor="middle" className="wx-compass-v">{speed}</text>
      <text x="60" y="72" textAnchor="middle" className="wx-compass-u">mph</text>
    </svg>
  )
}

function PressureGauge({ v, falling, unit }: { v: number; falling: boolean; unit: 'F' | 'C' }) {
  const a = -120 + ((v - 29.2) / 1.6) * 240
  return (
    <div className="wx-pressure">
      <svg viewBox="0 0 120 100" aria-hidden>
        {Array.from({ length: 41 }, (_, i) => {
          const ang = ((-120 + i * 6) * Math.PI) / 180
          return <line key={i} x1={60 + Math.sin(ang) * 40} y1={55 - Math.cos(ang) * 40} x2={60 + Math.sin(ang) * 48} y2={55 - Math.cos(ang) * 48} stroke="rgb(255 255 255 / .35)" strokeWidth="1.4" />
        })}
        <line x1={60 + Math.sin((a * Math.PI) / 180) * 36} y1={55 - Math.cos((a * Math.PI) / 180) * 36} x2={60 + Math.sin((a * Math.PI) / 180) * 50} y2={55 - Math.cos((a * Math.PI) / 180) * 50} stroke="#fff" strokeWidth="4" strokeLinecap="round" />
        <text x="60" y="55" textAnchor="middle" className="wx-compass-v" style={{ fontSize: 15 }}>{unit === 'C' ? Math.round(v * 33.864) : v.toFixed(2)}</text>
        <text x="60" y="68" textAnchor="middle" className="wx-compass-u">{unit === 'C' ? 'hPa' : 'inHg'}</text>
        <text x="60" y="95" textAnchor="middle" className="wx-compass-u">{falling ? '↓ Falling' : '= Steady'}</text>
      </svg>
    </div>
  )
}

function Radar({ c }: { c: CityWx }) {
  const [big, setBig] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [t, setT] = useState(0)
  useEffect(() => {
    if (!playing) return
    const id = window.setInterval(() => setT((x) => (x >= 1 ? 0 : +(x + 0.05).toFixed(2))), 220)
    return () => window.clearInterval(id)
  }, [playing])
  const wet = c.cond === 'rain' || c.daily.some((d, i) => i <= 1 && d.cond === 'storm')
  const cells = wet ? [{ x: 180 + t * 380, y: 420, r: 170, k: 'storm' }, { x: 60 + t * 380, y: 620, r: 120, k: 'rain' }, { x: 300 + t * 380, y: 250, r: 90, k: 'rain' }] : [{ x: 820 + t * 200, y: 180, r: 70, k: 'light' }]
  return (
    <div className={`wx-card wide wx-radar ${big ? 'big' : ''}`}>
      <div className="wx-card-h"><Umbrella size={14} /> PRECIPITATION</div>
      <div className="wx-radar-map" onClick={() => setBig(!big)}>
        <MapView camera={{ x: 520, y: 480, z: big ? 0.52 : 0.38 }} interactive={false} labels={false}
          layerChildren={cells.map((cl, i) => <div key={i} className={`wx-cell ${cl.k}`} style={{ left: cl.x - cl.r, top: cl.y - cl.r, width: cl.r * 2, height: cl.r * 2 }} />)}
          user={{ p: { x: 556, y: 318 } }}
        />
        <div className="wx-radar-city">{c.mine ? 'Maple Grove' : c.city}</div>
      </div>
      <div className="wx-radar-ctl">
        <button aria-label={playing ? 'Pause radar' : 'Play radar'} onClick={() => setPlaying(!playing)}>{playing ? <Pause size={16} fill="#fff" strokeWidth={0} /> : <Play size={16} fill="#fff" strokeWidth={0} />}</button>
        <div className="wx-radar-bar"><i style={{ width: `${t * 100}%` }} /></div>
        <span>{t === 0 ? 'Now' : `+${Math.round(t * 12)}h`}</span>
      </div>
    </div>
  )
}

// ------------------------------------------------------------------ city list
function CityList({ cities, onPick, onClose }: { cities: CityWx[]; onPick: (i: number) => void; onClose: () => void }) {
  const loc = useWx()
  const T = useT()
  const [q, setQ] = useState('')
  const [edit, setEdit] = useState(false)
  const now = useNow(60_000)
  const results = q.trim() ? SEARCHABLE.filter((c) => c.toLowerCase().includes(q.trim().toLowerCase()) && !loc.cities.includes(c)) : []
  return (
    <div className="wx-list anim-fade">
      <div className="wx-list-top">
        <div className="wx-list-title">Weather</div>
        <button className="bar-btn icon glass interactive wx-list-more" aria-label="More" onClick={(e) => openMenu(e.currentTarget, [
          { label: edit ? 'Done Editing' : 'Edit List', onSelect: () => setEdit(!edit) },
          { label: 'Celsius', icon: loc.unit === 'C' ? <Check size={18} /> : <span>°C</span>, onSelect: () => loc.set({ unit: 'C' }), separatorBefore: true },
          { label: 'Fahrenheit', icon: loc.unit === 'F' ? <Check size={18} /> : <span>°F</span>, onSelect: () => loc.set({ unit: 'F' }) },
        ])}><Ellipsis size={22} /></button>
      </div>
      <div style={{ padding: '0 16px 12px' }}><SearchField value={q} onChange={setQ} placeholder="Search for a city or airport" /></div>
      <div className="wx-list-scroll scroll">
        {q.trim() ? (
          <div className="wx-results">
            {results.map((r) => (
              <button key={r} className="wx-result" onClick={() => { loc.set({ cities: [...loc.cities, r] }); useOS.getState().showToast(`Added ${r}`); onPick(loc.cities.length + 1) }}>
                <span>{r}</span><span className="grow" /><span className="wx-add">Add</span>
              </button>
            ))}
            {results.length === 0 && <div className="wx-noresult">No results for “{q}”</div>}
          </div>
        ) : cities.map((c, i) => {
          const night = isNightFor(c, now)
          return (
            <div key={c.id} className="wx-citycard-wrap">
              {edit && !c.mine && <button className="wx-del" aria-label={`Remove ${c.city}`} onClick={() => loc.set({ cities: loc.cities.filter((x) => x !== c.city) })}><Minus size={16} strokeWidth={3.4} /></button>}
              <button className="wx-citycard" style={{ background: skyGradient(c.cond, night) }} onClick={() => !edit && onPick(i)}>
                <div className="grow">
                  <div className="wx-cc-name">{c.mine ? 'My Location' : c.city}</div>
                  <div className="wx-cc-sub">{c.mine ? c.city : fmtClock(tzHour(c.tz, now))}</div>
                  <div className="wx-cc-cond">{c.alert ? '⚠︎ Severe Thunderstorm Watch' : c.condLabel}</div>
                </div>
                <div className="wx-cc-right">
                  <div className="wx-cc-temp">{T(c.temp)}°</div>
                  <div className="wx-cc-hl">H:{T(c.hi)}° L:{T(c.lo)}°</div>
                </div>
              </button>
            </div>
          )
        })}
        <div className="wx-list-foot">
          <button onClick={() => loc.set({ unit: loc.unit === 'F' ? 'C' : 'F' })}>Showing °{loc.unit} — switch to °{loc.unit === 'F' ? 'C' : 'F'}</button>
          <button onClick={onClose} style={{ marginTop: 8 }}>Done</button>
        </div>
      </div>
    </div>
  )
}
