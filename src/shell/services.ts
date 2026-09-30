/* Background "system daemons": timers, alarms, music engine sync, demo events,
 * Safari page watching, message retry, battery, and notification actions. */
import { useOS, uid, playbackPosition } from '../os/store'
import type { NotificationItem } from '../os/types'
import { music, setMasterVolume, setEQ, playAlert, unlockAudio } from '../os/audio'
import { TRACKS } from '../os/data/media'
import { MIN, HOUR } from '../os/time'

const S = () => useOS.getState()

export function handleNotificationAction(n: NotificationItem, action: string) {
  const st = S()
  switch (action) {
    case 'read':
      if (n.thread) st.markConversationRead(n.thread)
      if (n.route?.startsWith('mail/')) st.updateMail(n.route.slice(5), { unread: false })
      st.dismissNotification(n.id)
      break
    case 'archive':
      if (n.route?.startsWith('mail/')) st.updateMail(n.route.slice(5), { folder: 'archive', unread: false })
      st.dismissNotification(n.id)
      break
    case 'done':
      if (n.route?.startsWith('rem/')) st.updateReminder(n.route.slice(4), { done: true })
      st.dismissNotification(n.id)
      break
    case 'snooze':
      st.dismissNotification(n.id)
      window.setTimeout(() => S().notify({ ...n, id: undefined, ts: undefined }), 20_000)
      break
    case 'stop':
      st.set({ safariWatches: st.safariWatches.filter((w) => !n.route?.includes(w.url)) })
      st.dismissNotification(n.id)
      break
    case 'reply':
    case 'open':
    default:
      st.dismissNotification(n.id)
      if (st.locked) st.unlock()
      window.setTimeout(() => S().launch(n.app, { route: n.route }), 250)
  }
}

function seedNotifications() {
  const st = S()
  if (st.notifications.length) return
  const now = Date.now()
  const items: Omit<NotificationItem, 'id'>[] = [
    { app: 'messages', title: 'Sam Okafor', body: 'Can you remind me to bring the percussion bag tomorrow? I always forget it 😭', ts: now - 12 * MIN, thread: 'c-sam', route: 'conv/c-sam' },
    { app: 'messages', title: 'Alex Rivera', body: 'also bring your laptop charger, the one in the shop is broken again', ts: now - 38 * MIN, thread: 'c-alex', route: 'conv/c-alex' },
    { app: 'home', title: 'Home Activity', body: 'Front Door: package delivered yesterday at 2:14 PM · Backyard: Biscuit playing 50 min ago · Driveway: Mom arrived 3 hours ago', ts: now - 50 * MIN, route: 'activity', summary: true },
    { app: 'mail', title: "Rosa's Trattoria", subtitle: 'Your reservation is confirmed', body: 'Saturday · 7:00 PM · Party of 4 · 218 Main St', ts: now - 55 * MIN, route: 'mail/mail-rosas' },
    { app: 'reminders', title: 'Pick up Mia at 5', body: 'Today at 4:45 PM', ts: now - 70 * MIN, route: 'list/reminders' },
    { app: 'news', title: 'Maple Grove Gazette', body: 'Thunderstorms expected Thursday evening; outdoor events may move indoors', ts: now - 2 * HOUR, route: 'article/nw1' },
  ]
  st.set({ notifications: items.map((n) => ({ ...n, id: uid('n') })) })
}

/** Scripted, gentle demo events so the phone feels alive. */
function scheduleDemoEvents(): () => void {
  const timers: number[] = []
  const at = (ms: number, fn: () => void) => timers.push(window.setTimeout(fn, ms))
  at(35_000, () => {
    const st = S()
    if (st.conversations.find((c) => c.id === 'c-priya')?.messages.some((m) => m.id === 'p-demo')) return
    st.receiveMessage('c-priya', { id: 'p-demo', from: 'priya', text: 'omg did you see Mrs. Alvarez posted the practice test? sending it now' })
    playAlert('received', st.ringerVolume * (st.silent ? 0 : 1))
  })
  at(80_000, () => {
    const st = S()
    st.notify({ app: 'home', title: 'Front Door', body: 'Video description: A courier in a blue jacket left a small box on the doormat.', route: 'clip/clip-package', image: 'porch-package' })
  })
  at(140_000, () => {
    const st = S()
    st.startActivity({ id: 'delivery-bolt', kind: 'delivery', title: 'Bolt Electronics order', subtitle: 'Out for delivery · 3 stops away', app: 'wallet', priority: 1, progress: 0.8, data: { eta: '3 stops' } })
  })
  return () => timers.forEach((t) => window.clearTimeout(t))
}

export function startServices(): () => void {
  seedNotifications()
  const offs: (() => void)[] = []

  // unlock audio on the first user gesture
  const gesture = () => {
    unlockAudio()
    window.removeEventListener('pointerdown', gesture)
  }
  window.addEventListener('pointerdown', gesture)
  offs.push(() => window.removeEventListener('pointerdown', gesture))

  // ----- tick: timers, alarms, battery, safari watches, automix -----
  let automixing = false
  let lastAlarmMinute = ''
  const tick = window.setInterval(() => {
    const st = S()
    const now = Date.now()
    // timers
    for (const t of st.timers) {
      if (t.running && t.endsAt && t.endsAt <= now) {
        st.set({ timers: S().timers.filter((x) => x.id !== t.id) })
        st.endActivity(`timer-${t.id}`)
        st.notify({ app: 'clock', title: 'Timer', body: `${t.label} — Done`, timeSensitive: true, route: 'timer' })
        st.flashIsland({ kind: 'generic', title: '⏰ Timer Done', subtitle: `${Math.round(st.alarmVolume * 100)}% alarm volume`, duration: 3000, tint: '#ff9f0a' })
        // iOS 27: alarm/timer volume is independent from the ringer volume
        playAlert('timer', st.alarmVolumeSeparate ? st.alarmVolume : st.ringerVolume)
      }
    }
    // alarms
    const d = new Date(now)
    const key = `${d.getHours()}:${d.getMinutes()}`
    if (key !== lastAlarmMinute) {
      lastAlarmMinute = key
      for (const a of st.alarms) {
        if (a.enabled && a.hour === d.getHours() && a.minute === d.getMinutes() && (a.repeat.length === 0 || a.repeat.includes(d.getDay()))) {
          st.notify({ app: 'clock', title: 'Alarm', body: a.label, timeSensitive: true, route: 'alarm' })
          playAlert('alarm', st.alarmVolumeSeparate ? st.alarmVolume : st.ringerVolume)
          st.set({ screenOn: true })
        }
      }
    }
    // battery drain / charge
    if (Math.random() < 0.02) {
      const delta = st.charging ? 0.01 : st.lowPower ? -0.001 : -0.002
      st.set({ battery: Math.max(0.05, Math.min(1, +(st.battery + delta).toFixed(3))) })
    }
    // automix / track end
    const np = st.nowPlaying
    if (np.playing && np.kind === 'music') {
      const tr = TRACKS.find((t) => t.id === np.trackId)
      const pos = playbackPosition(np)
      if (tr) {
        if (st.automix && pos >= tr.duration - st.crossfade && !automixing) {
          automixing = true
          const i = np.queue.indexOf(np.trackId)
          const next = np.queue[(i + 1) % np.queue.length]
          music.crossfade(next, st.crossfade)
          st.set({ nowPlaying: { ...np, trackId: next, position: 0, updatedAt: now } })
          window.setTimeout(() => (automixing = false), 1500)
        } else if (!st.automix && pos >= tr.duration) {
          st.nextTrack()
        }
      }
    }
  }, 500)
  offs.push(() => window.clearInterval(tick))

  // ----- music engine follows the store -----
  let prev = S().nowPlaying
  const unsubMusic = useOS.subscribe((s) => {
    const np = s.nowPlaying
    if (np === prev) return
    const was = prev
    prev = np
    if (np.kind !== 'music') {
      if (was.kind === 'music' && was.playing) music.pause()
      return
    }
    if (!np.playing) {
      if (was.playing) music.pause()
      return
    }
    if (automixing && music.playingId === np.trackId) return
    if (!was.playing || was.trackId !== np.trackId) music.restart(np.trackId, np.position)
    else if (Math.abs(np.position - (was.position + (np.updatedAt - was.updatedAt) / 1000)) > 1.5) music.restart(np.trackId, np.position)
  })
  offs.push(unsubMusic)

  // volume + EQ
  const applyAudio = () => {
    const s = S()
    setMasterVolume(s.volume)
    setEQ(s.eq.low, s.eq.mid, s.eq.high, s.eq.enabled && s.airpods.connected && s.nowPlaying.airplay !== 'tv' && s.nowPlaying.airplay !== 'homepod')
  }
  applyAudio()
  offs.push(useOS.subscribe((s, p) => (s.volume !== p.volume || s.eq !== p.eq || s.airpods !== p.airpods) && applyAudio()))

  // flashlight / charging island events
  offs.push(
    useOS.subscribe((s, p) => {
      if (s.charging && !p.charging) s.flashIsland({ kind: 'charging', duration: 2400 })
      if (s.lowPower !== p.lowPower) s.flashIsland({ kind: 'lowpower', title: 'Low Power Mode', subtitle: s.lowPower ? 'On' : 'Off', duration: 1800 })
      if (s.focus !== p.focus && s.focus) s.flashIsland({ kind: 'focus', title: s.focus, subtitle: 'On', duration: 1800 })
      // connectivity assist: seamless Wi-Fi → cellular handoff
      if (p.net.wifi && !s.net.wifi && s.net.cellular && s.net.connectivityAssist) {
        s.flashIsland({ kind: 'network', title: 'Switched to 5G', subtitle: 'Connectivity Assist', duration: 2000 })
      }
      // auto-retry failed messages when connectivity returns
      const online = (n: typeof s.net) => !n.airplane && (n.wifi || n.cellular)
      if (online(s.net) && !online(p.net)) {
        for (const c of s.conversations) {
          for (const m of c.messages) {
            if (m.status === 'failed') {
              s.patchMessage(c.id, m.id, { status: 'retrying' })
              window.setTimeout(() => S().patchMessage(c.id, m.id, { status: 'delivered' }), 900)
            }
          }
        }
      }
    }),
  )

  // sounds for new notifications
  offs.push(
    useOS.subscribe((s, p) => {
      if (s.banner && s.banner !== p.banner && !s.silent && !s.focus) playAlert('notification', s.ringerVolume)
    }),
  )

  // Safari "Notify Me" watches trigger after a short, visible delay
  const watchTimer = window.setInterval(() => {
    const st = S()
    for (const w of st.safariWatches) {
      if (!w.triggered && Date.now() - w.created > 25_000) {
        st.set({ safariWatches: S().safariWatches.map((x) => (x.id === w.id ? { ...x, triggered: true } : x)) })
        const body = w.kind === 'price' ? 'Price dropped from $249 to $199 — 20% off.' : w.kind === 'restock' ? 'Back in stock. Only 4 left.' : 'The page was updated with new content.'
        st.notify({ app: 'safari', title: `Notify Me · ${w.label}`, body, route: `url/${w.url}`, timeSensitive: true })
      }
    }
  }, 2000)
  offs.push(() => window.clearInterval(watchTimer))

  offs.push(scheduleDemoEvents())
  return () => offs.forEach((f) => f())
}
