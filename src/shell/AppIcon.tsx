import { memo, useRef } from 'react'
import { Hourglass, Minus, Share, Trash2, Pencil, Plus, Camera, Video, UserRound, Timer, AlarmClock, Search, MessageSquarePlus, Mic, Image, Play, Navigation } from 'lucide-react'
import type { AppId } from '../os/types'
import { useOS, isAppAllowed } from '../os/store'
import { AppIconArt, ICONS } from '../icons/AppIconArt'
import { useLongPress, useNow, screenScale } from '../os/hooks'
import { openMenu, showAlert, type MenuItem } from '../ui/overlay'
import { preloadApp } from '../apps/registry'

export function iconRect(el: HTMLElement) {
  const screen = document.querySelector('.screen') as HTMLElement
  const sr = screen.getBoundingClientRect()
  const r = el.getBoundingClientRect()
  const s = screenScale()
  return { x: (r.left - sr.left) / s, y: (r.top - sr.top) / s, w: r.width / s, h: r.height / s }
}

export function tryLaunch(app: AppId, el?: HTMLElement | null, route?: string) {
  const st = useOS.getState()
  const allowed = isAppAllowed(app)
  if (!allowed.allowed) {
    showAlert({
      title: st.screenTime.childMode ? 'App Limited' : 'Time Limit',
      message: `${ICONS[app].name}: ${allowed.reason}`,
      actions: [
        { label: 'OK', style: 'cancel' },
        {
          label: 'Ask for More Time',
          onPress: () => {
            st.notify({ app: 'settings', title: 'Screen Time', body: `Request for ${ICONS[app].name} sent to Mom and Dad.` })
            window.setTimeout(() => {
              const s2 = useOS.getState()
              s2.set({ screenTime: { ...s2.screenTime, allowedApps: [...new Set([...s2.screenTime.allowedApps, app])], allowances: s2.screenTime.allowances.map((a) => ({ ...a, used: Math.min(a.used, a.minutes - 15) })), schedules: s2.screenTime.schedules.map((x) => ({ ...x, apps: x.apps.filter((a) => a !== app) })) } })
              s2.notify({ app: 'settings', title: 'Screen Time', body: `Mom approved 15 more minutes of ${ICONS[app].name}.` })
            }, 3500)
          },
        },
      ],
    })
    return
  }
  st.launch(app, { rect: el ? iconRect(el) : null, route })
}

const QUICK: Partial<Record<AppId, { label: string; icon: React.ReactNode; route?: string; action?: () => void }[]>> = {
  camera: [{ label: 'Take Selfie', icon: <UserRound size={20} />, route: 'selfie' }, { label: 'Record Video', icon: <Video size={20} />, route: 'video' }, { label: 'Siri Mode', icon: <Camera size={20} />, route: 'siri' }],
  clock: [{ label: 'Start Timer', icon: <Timer size={20} />, route: 'timer' }, { label: 'Create Alarm', icon: <AlarmClock size={20} />, route: 'alarm' }],
  messages: [{ label: 'New Message', icon: <MessageSquarePlus size={20} />, route: 'compose' }, { label: 'Alex Rivera', icon: <UserRound size={20} />, route: 'conv/c-alex' }],
  photos: [{ label: 'Search', icon: <Search size={20} />, route: 'search' }, { label: 'Favorites', icon: <Image size={20} />, route: 'album/favorites' }],
  siri: [{ label: 'New Conversation', icon: <MessageSquarePlus size={20} />, route: 'new' }, { label: 'Talk to Siri', icon: <Mic size={20} />, route: 'voice' }],
  music: [{ label: 'Play Study Focus', icon: <Play size={20} />, action: () => useOS.getState().playTrack('t5', ['t5', 't9', 't3', 't10', 't12'], 'Study Focus') }],
  maps: [{ label: 'Directions Home', icon: <Navigation size={20} />, route: 'route/home' }],
  safari: [{ label: 'New Tab', icon: <Plus size={20} />, route: 'newtab' }],
}

export function iconMenu(app: AppId, el: HTMLElement, onRemove?: () => void) {
  const items: MenuItem[] = [
    ...(QUICK[app] ?? []).map((q) => ({ label: q.label, icon: q.icon, onSelect: () => (q.action ? q.action() : tryLaunch(app, el, q.route)) })),
    { label: 'Edit Home Screen', icon: <Pencil size={18} />, separatorBefore: !!QUICK[app], onSelect: () => useOS.getState().set({ editingHome: true }) },
    { label: `Share App`, icon: <Share size={18} />, onSelect: () => useOS.getState().set({ shareRequest: { title: ICONS[app].name, kind: 'link', payload: `apps.example/${app}`, app } }) },
  ]
  if (onRemove) items.push({ label: 'Remove App', icon: <Trash2 size={18} />, destructive: true, onSelect: onRemove })
  openMenu(el, items, { preview: <AppIconArt app={app} size={el.offsetWidth} /> })
}

export const AppIcon = memo(function AppIcon({ app, size = 62, label = true, onRemove, dock, dragging }: { app: AppId; size?: number; label?: boolean; onRemove?: () => void; dock?: boolean; dragging?: boolean }) {
  const style = useOS((s) => s.iconStyle)
  const tint = useOS((s) => s.iconTint)
  const editing = useOS((s) => s.editingHome)
  const badge = useOS((s) => badgeFor(s, app))
  const restricted = useOS((s) => s.screenTime.childMode && !isAppAllowed(app).allowed)
  const live = app === 'clock' || app === 'calendar'
  const now = useNow(live ? (app === 'clock' ? 1000 : 60_000) : 3_600_000)
  const ref = useRef<HTMLButtonElement>(null)
  const lp = useLongPress((el) => {
    if (editing) return
    iconMenu(app, el.querySelector('.app-icon-art') as HTMLElement ?? el, onRemove)
  })
  return (
    <div className={`app-icon ${editing ? 'jiggle' : ''} ${dragging ? 'dragging' : ''}`} style={{ ['--jiggle-delay' as string]: `${(app.length % 5) * -0.07}s` }}>
      <button
        ref={ref}
        className="app-icon-btn"
        aria-label={`${ICONS[app].name}${badge ? `, ${badge} notifications` : ''}`}
        onPointerEnter={() => preloadApp(app)}
        onPointerDown={(e) => {
          preloadApp(app)
          lp.onPointerDown(e)
        }}
        onPointerUp={lp.onPointerUp}
        onPointerLeave={lp.onPointerLeave}
        onPointerMove={lp.onPointerMove}
        onContextMenu={lp.onContextMenu}
        onClickCapture={lp.onClickCapture}
        onClick={() => {
          if (editing) return
          tryLaunch(app, ref.current?.querySelector('.app-icon-art') as HTMLElement)
        }}
      >
        <span className="icon-wrap" style={{ width: size, height: size, filter: restricted ? 'grayscale(1) brightness(.7)' : undefined }}>
          <AppIconArt app={app} size={size} style={style} tint={tint} now={new Date(now)} />
          {restricted && <span className="icon-restricted"><Hourglass size={size * 0.35} /></span>}
        </span>
        {badge > 0 && !editing && <span className="badge icon-badge">{badge}</span>}
        {label && !dock && <span className="app-label">{ICONS[app].name}</span>}
      </button>
      {editing && onRemove && (
        <button className="icon-remove" aria-label={`Remove ${ICONS[app].name}`} onClick={onRemove}>
          <Minus size={14} strokeWidth={4} />
        </button>
      )}
    </div>
  )
})

function badgeFor(s: ReturnType<typeof useOS.getState>, app: AppId): number {
  switch (app) {
    case 'messages':
      return s.conversations.reduce((a, c) => a + (c.unread ?? 0), 0)
    case 'mail':
      return s.mails.filter((m) => m.unread && m.folder === 'inbox').length
    case 'phone':
      return 1
    case 'reminders':
      return s.reminders.filter((r) => !r.done && r.due && r.due < Date.now() + 86_400_000).length
    case 'settings':
      return s.screenTime.pendingRequests.filter((r) => r.status === 'pending').length
    default:
      return 0
  }
}
