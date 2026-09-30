import { memo } from 'react'
import { Sun, Cloud, CloudSun, CloudRain, CloudLightning, Moon, CloudMoon, Play, Pause, SkipForward, Headphones, Smartphone, Circle, CheckCircle2, Mic, Lightbulb, Lock, Thermometer, Hourglass } from 'lucide-react'
import { useOS, playbackPosition } from '../../os/store'
import { useNow } from '../../os/hooks'
import { WEATHER, SCREEN_TIME_USAGE } from '../../os/data/world'
import { CALENDARS } from '../../os/data/life'
import { WEEKDAYS, MONTHS, fmtTime, startOfDay, DAY, WEEKDAYS_SHORT } from '../../os/time'
import { Scene } from '../../art/Scene'
import { AlbumArt } from './AlbumArt'
import { AISparkle } from '../../ui/controls'
import { tryLaunch } from '../AppIcon'
import { openSiri } from '../actions'
import type { WidgetSize } from '../../os/store'
import type { AppId } from '../../os/types'
import { TRACKS as TRACKS_ALL } from '../../os/data/media'
import { nowPlayingTrack } from '../../os/nowPlaying'

export function WeatherGlyph({ icon, size = 20, color }: { icon: string; size?: number; color?: string }) {
  const p = { size, strokeWidth: 2, color }
  switch (icon) {
    case 'sun':
      return <Sun {...p} color={color ?? '#ffd60a'} fill={color ?? '#ffd60a'} />
    case 'moon':
      return <Moon {...p} fill={color ?? '#fff'} />
    case 'cloud-sun':
      return <CloudSun {...p} />
    case 'cloud-moon':
      return <CloudMoon {...p} />
    case 'cloud-rain':
      return <CloudRain {...p} />
    case 'cloud-bolt':
      return <CloudLightning {...p} />
    default:
      return <Cloud {...p} fill={color ?? '#fff'} />
  }
}

const APP_FOR: Record<string, AppId> = { weather: 'weather', calendar: 'calendar', photos: 'photos', music: 'music', batteries: 'settings', reminders: 'reminders', siri: 'siri', home: 'home', screentime: 'settings', clock: 'clock', fitness: 'fitness', notes: 'notes' }

export const Widget = memo(function Widget({ kind, size, onClick }: { kind: string; size: WidgetSize; onClick?: () => void }) {
  const open = (e: React.MouseEvent) => {
    if (onClick) return onClick()
    const app = APP_FOR[kind]
    const route = kind === 'batteries' ? 'battery' : kind === 'screentime' ? 'screentime' : undefined
    if (app) tryLaunch(app, e.currentTarget as HTMLElement, route)
  }
  return (
    <div className={`widget w-${size} wk-${kind}`} onClick={open} role="button" tabIndex={0} aria-label={`${kind} widget`} onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget as HTMLElement).click()}>
      <WidgetBody kind={kind} size={size} />
    </div>
  )
})

function WidgetBody({ kind, size }: { kind: string; size: WidgetSize }) {
  switch (kind) {
    case 'weather':
      return <WeatherWidget size={size} />
    case 'calendar':
      return <CalendarWidget size={size} />
    case 'photos':
      return <PhotosWidget size={size} />
    case 'music':
      return <MusicWidget size={size} />
    case 'batteries':
      return <BatteriesWidget size={size} />
    case 'reminders':
      return <RemindersWidget size={size} />
    case 'siri':
      return <SiriWidget size={size} />
    case 'home':
      return <HomeWidget size={size} />
    case 'screentime':
      return <ScreenTimeWidget />
    default:
      return <div className="w-pad">{kind}</div>
  }
}

function WeatherWidget({ size }: { size: WidgetSize }) {
  const hours = WEATHER.hourly.slice(0, size === 's' ? 0 : 6)
  return (
    <div className="w-pad w-weather">
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div className="t-subhead bold">{WEATHER.city} ➤</div>
          <div className="w-temp">{WEATHER.temp}°</div>
        </div>
        {size !== 's' && (
          <div style={{ textAlign: 'right' }}>
            <CloudSun size={22} />
            <div className="t-footnote bold">{WEATHER.condition}</div>
            <div className="t-footnote">H:{WEATHER.high}° L:{WEATHER.low}°</div>
          </div>
        )}
      </div>
      {size === 's' ? (
        <div style={{ marginTop: 'auto' }}>
          <CloudSun size={18} />
          <div className="t-footnote bold">{WEATHER.condition}</div>
          <div className="t-footnote">H:{WEATHER.high}° L:{WEATHER.low}°</div>
        </div>
      ) : (
        <div className="w-hours">
          {hours.map((h, i) => (
            <div key={i} className="col" style={{ alignItems: 'center', gap: 4 }}>
              <span className="t-caption2 bold">{i === 0 ? 'Now' : `${h.h % 12 || 12}${h.h < 12 ? 'AM' : 'PM'}`}</span>
              <WeatherGlyph icon={h.icon} size={18} />
              <span className="t-footnote bold">{h.t}°</span>
            </div>
          ))}
        </div>
      )}
      {(size === 'l' || size === 'xl') && (
        <div className="w-days">
          {WEATHER.daily.slice(0, size === 'xl' ? 10 : 5).map((d, i) => (
            <div key={i} className="row gap8 t-subhead bold">
              <span style={{ width: 44 }}>{i === 0 ? 'Today' : WEEKDAYS_SHORT[new Date(Date.now() + i * DAY).getDay()]}</span>
              <WeatherGlyph icon={i === (4 - new Date().getDay() + 7) % 7 ? 'cloud-bolt' : d.icon} size={18} />
              <span style={{ width: 30, textAlign: 'right', opacity: 0.7 }}>{d.lo}°</span>
              <div className="w-range"><div style={{ left: `${(d.lo - 45) * 3}%`, right: `${100 - (d.hi - 45) * 3}%` }} /></div>
              <span style={{ width: 30 }}>{d.hi}°</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function CalendarWidget({ size }: { size: WidgetSize }) {
  const now = useNow()
  const events = useOS((s) => s.events)
  const d = new Date(now)
  const upcoming = events.filter((e) => e.end > now && e.start < startOfDay(now) + (size === 'xl' ? 7 : 2) * DAY).sort((a, b) => a.start - b.start)
  const color = (id: string) => CALENDARS.find((c) => c.id === id)?.color ?? '#007aff'
  return (
    <div className="w-pad w-calendar">
      <div className="t-caption1 bold" style={{ color: 'var(--red)', textTransform: 'uppercase' }}>{WEEKDAYS[d.getDay()]}</div>
      <div className="w-cal-date">{d.getDate()}</div>
      <div className="col gap6" style={{ marginTop: 4 }}>
        {upcoming.slice(0, size === 's' ? 2 : size === 'm' ? 3 : 8).map((e) => (
          <div key={e.id} className="w-cal-ev" style={{ borderColor: color(e.calendar) }}>
            <div className="t-caption1 bold nowrap">{e.title}</div>
            <div className="t-caption2 secondary">{startOfDay(e.start) === startOfDay(now) ? '' : `${WEEKDAYS_SHORT[new Date(e.start).getDay()]} `}{fmtTime(e.start)}</div>
          </div>
        ))}
        {!upcoming.length && <div className="t-caption1 secondary">No more events today</div>}
      </div>
    </div>
  )
}

function PhotosWidget({ size }: { size: WidgetSize }) {
  const shuffle = useOS((s) => s.shuffle)
  const photos = useOS((s) => s.photos)
  const now = useNow(8000)
  const pool = photos.filter((p) => p.kind !== 'screenshot' && !p.idDocument && (shuffle.kind === 'pets' ? p.pets?.includes(shuffle.pet) : true) && (shuffle.includeMe || !p.people?.includes('me')))
  const list = pool.length ? pool : photos
  const p = list[Math.floor(now / 8000) % list.length]
  return (
    <div className="w-photo">
      <Scene key={p.id} scene={p.scene} className="w-photo-img anim-fade" />
      <div className="w-photo-cap">
        <div className="t-caption1 bold">{shuffle.kind === 'pets' ? shuffle.pet : 'Featured'}</div>
        {size !== 's' && <div className="t-caption2">{p.place} · {MONTHS[new Date(p.ts).getMonth()]} {new Date(p.ts).getDate()}</div>}
      </div>
    </div>
  )
}

function MusicWidget({ size }: { size: WidgetSize }) {
  const np = useOS((s) => s.nowPlaying)
  const toggle = useOS((s) => s.togglePlay)
  const next = useOS((s) => s.nextTrack)
  useNow(np.playing ? 1000 : 60_000)
  const track = nowPlayingTrack(np)
  const pos = playbackPosition(np)
  if (size === 'xl') return <MusicXL />
  return (
    <div className="w-pad w-music" style={{ background: `linear-gradient(135deg, hsl(${track.hue} 55% 38%), hsl(${(track.hue + 40) % 360} 60% 18%))`, color: '#fff' }}>
      <div className="row gap12">
        <AlbumArt track={track} size={size === 's' ? 56 : 72} radius={10} />
        {size !== 's' && (
          <div className="grow">
            <div className="t-caption1" style={{ opacity: 0.7 }}>{np.playing ? 'Now Playing' : 'Recently Played'}</div>
            <div className="t-headline nowrap">{track.title}</div>
            <div className="t-subhead nowrap" style={{ opacity: 0.75 }}>{track.artist}</div>
          </div>
        )}
      </div>
      {size !== 's' && (
        <div className="row" style={{ marginTop: 'auto', gap: 14 }}>
          <div className="w-mbar"><div style={{ width: `${(pos / track.duration) * 100}%` }} /></div>
          <button aria-label={np.playing ? 'Pause' : 'Play'} onClick={(e) => { e.stopPropagation(); toggle() }}>{np.playing ? <Pause size={22} fill="#fff" strokeWidth={0} /> : <Play size={22} fill="#fff" strokeWidth={0} />}</button>
          <button aria-label="Next" onClick={(e) => { e.stopPropagation(); next() }}><SkipForward size={22} fill="#fff" /></button>
        </div>
      )}
    </div>
  )
}

function Ring({ value, children, color = '#30d158' }: { value: number; children: React.ReactNode; color?: string }) {
  const r = 24
  const c = 2 * Math.PI * r
  return (
    <div className="w-ring">
      <svg width="58" height="58" viewBox="0 0 58 58">
        <circle cx="29" cy="29" r={r} fill="none" stroke="var(--fill)" strokeWidth="5" />
        <circle cx="29" cy="29" r={r} fill="none" stroke={color} strokeWidth="5" strokeDasharray={`${c * value} ${c}`} strokeLinecap="round" transform="rotate(-90 29 29)" />
      </svg>
      <span className="w-ring-icon">{children}</span>
    </div>
  )
}

function BatteriesWidget({ size }: { size: WidgetSize }) {
  const battery = useOS((s) => s.battery)
  const charging = useOS((s) => s.charging)
  const lowPower = useOS((s) => s.lowPower)
  const ap = useOS((s) => s.airpods)
  const items = [
    { icon: <Smartphone size={18} />, v: battery, label: 'iPhone', color: charging ? '#30d158' : lowPower ? '#ffcc00' : '#30d158' },
    ...(ap.connected ? [{ icon: <Headphones size={18} />, v: Math.min(ap.battery.l, ap.battery.r) / 100, label: 'AirPods Pro 3', color: '#30d158' }] : []),
  ]
  return (
    <div className="w-pad w-batt">
      <div className={size === 's' ? 'w-batt-grid' : 'row gap16'}>
        {items.map((it, i) => (
          <div key={i} className="col" style={{ alignItems: 'center', gap: 4 }}>
            <Ring value={it.v} color={it.color}>{it.icon}</Ring>
            <span className="t-caption1 bold">{Math.round(it.v * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function RemindersWidget({ size }: { size: WidgetSize }) {
  const reminders = useOS((s) => s.reminders)
  const update = useOS((s) => s.updateReminder)
  const open = reminders.filter((r) => !r.done).slice(0, size === 's' ? 4 : 6)
  return (
    <div className="w-pad w-rem">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <span className="t-subhead bold" style={{ color: 'var(--blue)' }}>Reminders</span>
        <span className="t-title3" style={{ color: 'var(--blue)' }}>{reminders.filter((r) => !r.done).length}</span>
      </div>
      <div className="col gap6" style={{ marginTop: 6 }}>
        {open.map((r) => (
          <div key={r.id} className="row gap6 t-caption1" onClick={(e) => { e.stopPropagation(); update(r.id, { done: true }) }}>
            {r.done ? <CheckCircle2 size={14} color="var(--blue)" /> : <Circle size={14} color="var(--label-tertiary)" />}
            <span className="nowrap">{r.title}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function SiriWidget({ size }: { size: WidgetSize }) {
  const convs = useOS((s) => s.siriConversations)
  const events = useOS((s) => s.events)
  const now = useNow()
  const next = events.filter((e) => e.start > now).sort((a, b) => a.start - b.start)[0]
  const sugg = ['When is robotics?', 'What’s the weather for robotics?', 'Summarize my notifications', 'Show me photos of Biscuit at the beach']
  return (
    <div className="w-pad w-siri">
      <div className="row gap8"><AISparkle size={20} /><span className="t-headline">Siri</span></div>
      <button className="w-siri-ask glass clear" onClick={(e) => { e.stopPropagation(); openSiri('type') }}>
        <span className="secondary">Ask Siri…</span>
        <Mic size={18} />
      </button>
      {next && (
        <div className="w-siri-card">
          <div className="t-caption1 secondary">Up next</div>
          <div className="t-headline">{next.title}</div>
          <div className="t-subhead secondary">{WEEKDAYS[new Date(next.start).getDay()]} · {fmtTime(next.start)}{next.location ? ` · ${next.location}` : ''}</div>
        </div>
      )}
      <div className="t-caption1 secondary" style={{ marginTop: 10 }}>Suggestions</div>
      <div className="col gap6" style={{ marginTop: 6 }}>
        {sugg.slice(0, size === 'xl' ? 4 : 2).map((q) => (
          <button key={q} className="w-siri-sugg" onClick={(e) => { e.stopPropagation(); useOS.getState().launch('siri', { route: `ask/${encodeURIComponent(q)}` }) }}>{q}</button>
        ))}
      </div>
      {size === 'xl' && convs.length > 0 && (
        <>
          <div className="t-caption1 secondary" style={{ marginTop: 12 }}>Recent Conversations</div>
          {convs.slice(0, 2).map((c) => (
            <button key={c.id} className="w-siri-sugg" onClick={(e) => { e.stopPropagation(); useOS.getState().launch('siri', { route: `conv/${c.id}` }) }}>{c.title}</button>
          ))}
        </>
      )}
    </div>
  )
}

function HomeWidget({ size }: { size: WidgetSize }) {
  const acc = useOS((s) => s.accessories)
  const set = useOS((s) => s.set)
  const tiles = acc.filter((a) => ['light', 'lock', 'thermostat'].includes(a.kind)).slice(0, size === 's' ? 2 : 4)
  return (
    <div className="w-pad w-home">
      <div className="t-subhead bold" style={{ color: 'var(--orange)' }}>Home</div>
      <div className="w-home-grid">
        {tiles.map((a) => (
          <button key={a.id} className={`w-home-tile ${a.on || a.locked ? 'on' : ''}`} onClick={(e) => {
            e.stopPropagation()
            set({ accessories: acc.map((x) => (x.id === a.id ? (a.kind === 'lock' ? { ...x, locked: !x.locked } : { ...x, on: !x.on }) : x)) })
          }}>
            {a.kind === 'light' ? <Lightbulb size={18} /> : a.kind === 'lock' ? <Lock size={18} /> : <Thermometer size={18} />}
            <span className="t-caption2 bold nowrap">{a.name}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

function ScreenTimeWidget() {
  return (
    <div className="w-pad">
      <div className="row gap6 t-subhead bold" style={{ color: 'var(--indigo)' }}><Hourglass size={16} /> Screen Time</div>
      <div className="t-title2" style={{ marginTop: 6 }}>{Math.floor(SCREEN_TIME_USAGE.dailyAverage / 60)}h {SCREEN_TIME_USAGE.dailyAverage % 60}m</div>
      <div className="t-caption1 secondary">Daily average</div>
    </div>
  )
}

export const WIDGET_GALLERY: { kind: string; name: string; desc: string; sizes: WidgetSize[] }[] = [
  { kind: 'siri', name: 'Siri', desc: 'Ask Siri and see suggestions based on your day.', sizes: ['m', 'l', 'xl'] },
  { kind: 'weather', name: 'Weather', desc: 'Current conditions, hourly and 10-day forecast.', sizes: ['s', 'm', 'l', 'xl'] },
  { kind: 'calendar', name: 'Calendar', desc: 'See upcoming events.', sizes: ['s', 'm', 'l', 'xl'] },
  { kind: 'photos', name: 'Photo Shuffle', desc: 'Shuffle photos of Biscuit or featured memories.', sizes: ['s', 'm', 'l', 'xl'] },
  { kind: 'music', name: 'Music', desc: 'Now Playing with controls. Extra Large fills the whole page.', sizes: ['s', 'm', 'xl'] },
  { kind: 'home', name: 'Home', desc: 'Control accessories.', sizes: ['s', 'm'] },
  { kind: 'batteries', name: 'Batteries', desc: 'iPhone and AirPods battery.', sizes: ['s', 'm'] },
  { kind: 'reminders', name: 'Reminders', desc: 'Check off tasks right from the Home Screen.', sizes: ['s', 'm', 'l'] },
  { kind: 'screentime', name: 'Screen Time', desc: 'Your daily average.', sizes: ['s', 'm'] },
]

/** iOS 27 full-screen (Extra Large) Music widget: big artwork, controls and Up Next. */
function MusicXL() {
  const np = useOS((s) => s.nowPlaying)
  const toggle = useOS((s) => s.togglePlay)
  const next = useOS((s) => s.nextTrack)
  const prev = useOS((s) => s.prevTrack)
  const playTrack = useOS((s) => s.playTrack)
  useNow(np.playing ? 1000 : 60_000)
  const track = nowPlayingTrack(np)
  const pos = playbackPosition(np)
  const i = np.queue.indexOf(np.trackId)
  const upNext = [1, 2, 3].map((k) => np.queue[(i + k) % np.queue.length]).map((id) => TRACKS_ALL.find((t) => t.id === id)).filter(Boolean) as typeof TRACKS_ALL
  return (
    <div className="w-pad w-music-xl" style={{ background: `linear-gradient(180deg, hsl(${track.hue} 55% 42%), hsl(${(track.hue + 40) % 360} 60% 14%))`, color: '#fff' }}>
      <div className="t-caption1" style={{ opacity: 0.75 }}>{np.playing ? 'Now Playing' : 'Recently Played'} · {np.source ?? track.album}</div>
      <AlbumArt track={track} size="100%" radius={18} style={{ aspectRatio: '1', height: 'auto', margin: '10px 0 12px', boxShadow: '0 12px 30px rgb(0 0 0 / .35)' }} />
      <div className="t-title3 nowrap">{track.title}</div>
      <div className="t-subhead nowrap" style={{ opacity: 0.75 }}>{track.artist}</div>
      <div className="w-mbar" style={{ margin: '12px 0 10px' }}><div style={{ width: `${Math.min(100, (pos / track.duration) * 100)}%` }} /></div>
      <div className="row" style={{ justifyContent: 'space-around' }}>
        <button aria-label="Previous" onClick={(e) => { e.stopPropagation(); prev() }}><SkipForward size={26} fill="#fff" style={{ transform: 'scaleX(-1)' }} /></button>
        <button aria-label={np.playing ? 'Pause' : 'Play'} onClick={(e) => { e.stopPropagation(); toggle() }}>{np.playing ? <Pause size={34} fill="#fff" strokeWidth={0} /> : <Play size={34} fill="#fff" strokeWidth={0} />}</button>
        <button aria-label="Next" onClick={(e) => { e.stopPropagation(); next() }}><SkipForward size={26} fill="#fff" /></button>
      </div>
      <div className="t-caption1 bold" style={{ opacity: 0.75, margin: '12px 0 6px' }}>Up Next</div>
      {upNext.map((t) => (
        <button key={t.id} className="row gap8 w-upnext" onClick={(e) => { e.stopPropagation(); playTrack(t.id, np.queue, np.source) }}>
          <AlbumArt track={t} size={30} radius={6} />
          <span className="grow nowrap" style={{ textAlign: 'left' }}>{t.title}</span>
          <span className="t-caption1" style={{ opacity: 0.6 }}>{t.artist}</span>
        </button>
      ))}
    </div>
  )
}
