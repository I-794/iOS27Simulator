import { Moon, BedDouble, BookOpen, Car, Dumbbell, User, Navigation } from 'lucide-react'
import { useOS } from '../os/store'
import { useNow } from '../os/hooks'
import { fmtClock } from '../os/time'
import { useShell } from './shellState'
import { wallpaperDef } from '../art/Wallpaper'

export function SignalBars({ level, color = 'currentColor' }: { level: number; color?: string }) {
  return (
    <svg width="19" height="12" viewBox="0 0 19 12" aria-hidden>
      {[0, 1, 2, 3].map((i) => (
        <rect key={i} x={i * 5} y={9 - i * 3} width="3.2" height={3 + i * 3} rx="1" fill={color} opacity={i < level ? 1 : 0.3} />
      ))}
    </svg>
  )
}

export function WifiIcon({ level = 3, color = 'currentColor' }: { level?: number; color?: string }) {
  return (
    <svg width="17" height="12" viewBox="0 0 17 12" aria-hidden>
      <path d="M8.5 11.6 6.2 9.3a3.3 3.3 0 0 1 4.6 0z" fill={color} opacity={level >= 1 ? 1 : 0.3} />
      <path d="M3.9 7a6.5 6.5 0 0 1 9.2 0l-1.5 1.5a4.4 4.4 0 0 0-6.2 0z" fill={color} opacity={level >= 2 ? 1 : 0.3} />
      <path d="M1.5 4.6a9.9 9.9 0 0 1 14 0l-1.5 1.5a7.8 7.8 0 0 0-11 0z" fill={color} opacity={level >= 3 ? 1 : 0.3} />
    </svg>
  )
}

export function BatteryIcon({ level, charging, lowPower, color = 'currentColor', showPct = true }: { level: number; charging?: boolean; lowPower?: boolean; color?: string; showPct?: boolean }) {
  const pct = Math.round(level * 100)
  const fill = charging ? '#34c759' : lowPower ? '#ffcc00' : pct <= 20 ? '#ff3b30' : color
  return (
    <svg width="27" height="13" viewBox="0 0 27 13" aria-label={`Battery ${pct}%`}>
      <rect x="0.5" y="0.5" width="23" height="12" rx="3.8" fill="none" stroke={color} opacity=".4" />
      <rect x="2" y="2" width={Math.max(2, 20 * level)} height="9" rx="2.4" fill={fill} />
      <path d="M25 4.5v4c.8-.3 1.3-1.1 1.3-2s-.5-1.7-1.3-2z" fill={color} opacity=".45" />
      {showPct && !charging && (
        <text x="12" y="10" textAnchor="middle" fontSize="8.6" fontWeight="700" fontFamily="var(--font-text)" fill={level > 0.55 && !lowPower ? (color === '#fff' ? '#000' : '#fff') : color} style={{ mixBlendMode: 'normal' }}>
          {pct}
        </text>
      )}
      {charging && <path d="M13 1.8 8.5 7.2h3l-1 4 4.5-5.4h-3z" fill={color === '#fff' ? '#000' : '#fff'} />}
    </svg>
  )
}

const FOCUS_ICON = { 'Do Not Disturb': Moon, Sleep: BedDouble, Study: BookOpen, Driving: Car, Fitness: Dumbbell, Personal: User } as const

export function StatusBar() {
  const now = useNow(1000)
  const st = useOS()
  const override = useShell((s) => s.statusOverride)
  const hide = useShell((s) => s.hideStatusBar)
  const landscape = st.orientation === 'landscape'
  if (landscape && st.openApp) return null
  if (hide && st.openApp && !st.overlay) return null

  const onMedia = st.locked || st.overlay === 'cc' || st.overlay === 'nc' || st.overlay === 'switcher' || st.overlay === 'spotlight' || st.siriActive
  let light: boolean
  if (onMedia || !st.openApp) light = st.locked || st.overlay ? true : wallpaperDef(st.wallpaper).tone === 'dark' || st.theme === 'dark'
  else light = override ? override === 'light' : st.theme === 'dark'
  if (st.overlay === 'spotlight' || st.overlay === 'switcher') light = true
  const color = light ? '#fff' : '#000'
  const FocusIcon = st.focus ? FOCUS_ICON[st.focus] : null
  const net = st.net
  const navigating = st.activities.some((a) => a.kind === 'navigation')
  const inCall = st.activities.some((a) => a.kind === 'call' || a.kind === 'facetime')
  const pill = st.screenRecording ? '#ff3b30' : inCall ? '#34c759' : net.hotspot ? '#34c759' : null

  return (
    <div className={`status-bar ${landscape ? 'landscape' : ''}`} style={{ color }} role="status" aria-label="Status bar">
      <div className="sb-left">
        <span className="sb-time" style={pill ? { background: pill, color: '#fff' } : undefined}>
          {fmtClock(now, st.h24)}
        </span>
        {FocusIcon && <FocusIcon size={14} strokeWidth={2.6} fill={st.focus === 'Do Not Disturb' ? color : 'none'} style={{ marginLeft: 4, color: st.focus === 'Do Not Disturb' ? '#8e8cf8' : color }} />}
        {navigating && !FocusIcon && <Navigation size={12} fill={color} strokeWidth={0} style={{ marginLeft: 4 }} />}
      </div>
      <div className="sb-right">
        {net.airplane ? (
          <svg width="16" height="14" viewBox="0 0 24 24" aria-label="Airplane mode"><path fill={color} d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z" /></svg>
        ) : (
          <>
            {net.cellular && <SignalBars level={net.cellularSignal} color={color} />}
            {net.wifi && net.activePath !== 'cellular' ? (
              <WifiIcon level={Math.max(1, Math.round(net.wifiQuality * 3))} color={color} />
            ) : net.cellular ? (
              <span className="sb-5g">{net.cellularType}</span>
            ) : null}
          </>
        )}
        <BatteryIcon level={st.battery} charging={st.charging} lowPower={st.lowPower} color={color} />
      </div>
    </div>
  )
}
