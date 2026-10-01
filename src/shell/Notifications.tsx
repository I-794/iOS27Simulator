import { useMemo, useRef, useState } from 'react'
import { ChevronDown, X } from 'lucide-react'
import type { NotificationItem, AppId } from '../os/types'
import { useOS } from '../os/store'
import { AppIconArt, ICONS } from '../icons/AppIconArt'
import { fmtAgo } from '../os/time'
import { useNow, screenScale, useLongPress } from '../os/hooks'
import { openMenu } from '../ui/overlay'
import { AISparkle } from '../ui/controls'
import { Scene } from '../art/Scene'
import { contactById } from '../os/data/people'
import { handleNotificationAction } from './services'

export function openNotification(n: NotificationItem) {
  const st = useOS.getState()
  const go = () => {
    st.dismissNotification(n.id)
    st.set({ overlay: null })
    st.launch(n.app, { route: n.route })
  }
  if (st.locked) {
    st.unlock()
    window.setTimeout(go, 280)
  } else go()
}

export function NotificationCard({ n, stackCount = 0, onExpand, compact }: { n: NotificationItem; stackCount?: number; onExpand?: () => void; compact?: boolean }) {
  const now = useNow(30_000)
  const ref = useRef<HTMLDivElement>(null)
  const [dx, setDx] = useState(0)
  const dismiss = useOS((s) => s.dismissNotification)
  const lp = useLongPress((el) =>
    openMenu(el, [
      ...(n.actions ?? defaultActions(n)).map((a) => ({ label: a.label, destructive: a.destructive, onSelect: () => handleNotificationAction(n, a.id) })),
      { label: 'Clear', separatorBefore: true, onSelect: () => dismiss(n.id) },
    ]),
  )

  const onDown = (e: React.PointerEvent) => {
    lp.onPointerDown(e)
    const scale = screenScale()
    const x0 = e.clientX
    const y0 = e.clientY
    let horiz: boolean | null = null
    let cur = 0
    const move = (ev: PointerEvent) => {
      const mx = (ev.clientX - x0) / scale
      const my = (ev.clientY - y0) / scale
      if (horiz === null && Math.hypot(mx, my) > 6) horiz = Math.abs(mx) > Math.abs(my)
      if (horiz) {
        cur = Math.min(0, mx)
        setDx(cur)
      }
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      if (cur < -220) {
        dismiss(n.id)
      } else if (cur < -60) setDx(-150)
      else setDx(0)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  const sender = n.thread?.startsWith('c-') ? contactById(n.thread.slice(2)) : undefined
  return (
    <div className="notif-wrap" style={{ marginBottom: stackCount ? 14 : 8 }}>
      {dx < -20 && (
        <div className="notif-swipe-actions" style={{ opacity: Math.min(1, -dx / 120) }}>
          <button className="glass" onClick={() => openMenu(ref.current!, (n.actions ?? defaultActions(n)).map((a) => ({ label: a.label, onSelect: () => handleNotificationAction(n, a.id) })))}>Options</button>
          <button className="glass" onClick={() => dismiss(n.id)}>Clear</button>
        </div>
      )}
      <div
        ref={ref}
        className={`notif glass ${n.summary ? 'ai-summary' : ''} ${compact ? 'compact' : ''}`}
        style={{ transform: dx ? `translateX(${dx}px)` : undefined, transition: dx === 0 || dx === -150 ? 'transform .3s var(--spring-snappy)' : 'none' }}
        onPointerDown={onDown}
        onPointerUp={lp.onPointerUp}
        onPointerMove={lp.onPointerMove}
        onPointerLeave={lp.onPointerLeave}
        onContextMenu={lp.onContextMenu}
        onClickCapture={lp.onClickCapture}
        onClick={() => {
          if (dx) return setDx(0)
          if (stackCount && onExpand) onExpand()
          else openNotification(n)
        }}
        role="button"
        tabIndex={0}
        aria-label={`${ICONS[n.app].name} notification: ${n.title}. ${n.body}`}
        onKeyDown={(e) => e.key === 'Enter' && openNotification(n)}
      >
        <div className="notif-icon">
          {sender ? (
            <div className="notif-avatar" style={{ background: sender.color }}>{sender.first[0]}<span className="notif-app-mini"><AppIconArt app={n.app} size={16} /></span></div>
          ) : (
            <AppIconArt app={n.app} size={38} />
          )}
        </div>
        <div className="notif-body">
          <div className="row" style={{ justifyContent: 'space-between', gap: 8 }}>
            <span className="notif-title nowrap">{n.summary && <AISparkle size={13} />} {n.title}</span>
            <span className="notif-time">{fmtAgo(n.ts, now)}</span>
          </div>
          {n.subtitle && <div className="notif-sub nowrap">{n.subtitle}</div>}
          <div className="notif-text">{n.body}</div>
        </div>
        {n.image && <div className="notif-thumb"><Scene scene={n.image} /></div>}
      </div>
      {stackCount > 0 && (
        <>
          <div className="notif-stack s1 glass" />
          {stackCount > 1 && <div className="notif-stack s2 glass" />}
        </>
      )}
    </div>
  )
}

function defaultActions(n: NotificationItem): { id: string; label: string; destructive?: boolean }[] {
  if (n.app === 'messages') return [{ id: 'reply', label: 'Reply' }, { id: 'read', label: 'Mark as Read' }]
  if (n.app === 'mail') return [{ id: 'archive', label: 'Archive' }, { id: 'read', label: 'Mark as Read' }]
  if (n.app === 'reminders') return [{ id: 'done', label: 'Mark as Completed' }, { id: 'snooze', label: 'Remind Me in 1 Hour' }]
  if (n.app === 'safari') return [{ id: 'open', label: 'View Page' }, { id: 'stop', label: 'Stop Watching' }]
  if (n.app === 'home') return [{ id: 'open', label: 'View Clip' }]
  return [{ id: 'open', label: 'Open' }]
}

/** Group notifications by app/thread into stacks, like iOS. */
export function NotificationList({ items, dense }: { items: NotificationItem[]; dense?: boolean }) {
  const [expanded, setExpanded] = useState<string | null>(null)
  const clear = useOS((s) => s.clearNotifications)
  const groups = useMemo(() => {
    const map = new Map<string, NotificationItem[]>()
    for (const n of items) {
      const k = n.app === 'messages' ? `${n.app}:${n.thread ?? ''}` : n.app
      map.set(k, [...(map.get(k) ?? []), n])
    }
    return [...map.entries()]
  }, [items])
  if (!items.length) return null
  return (
    <div className="notif-list">
      {groups.map(([key, list]) => {
        const open = expanded === key
        if (list.length === 1 || open) {
          return (
            <div key={key} className="notif-group">
              {open && (
                <div className="notif-group-head">
                  <span>{ICONS[list[0].app as AppId].name}</span>
                  <div className="row gap6">
                    <button className="glass" onClick={() => setExpanded(null)}>Show less <ChevronDown size={14} style={{ transform: 'rotate(180deg)' }} /></button>
                    <button className="glass" aria-label="Clear group" onClick={() => clear(list[0].app)}><X size={14} /></button>
                  </div>
                </div>
              )}
              {list.map((n) => <NotificationCard key={n.id} n={n} compact={dense} />)}
            </div>
          )
        }
        return <NotificationCard key={key} n={list[0]} stackCount={list.length - 1} onExpand={() => setExpanded(key)} compact={dense} />
      })}
    </div>
  )
}
