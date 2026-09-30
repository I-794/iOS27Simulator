import { useEffect, useState } from 'react'
import { Link2, Video, Phone, Info, X, MessageCircle, Trash2, PhoneIncoming } from 'lucide-react'
import { NavStack, Page, useNav } from '../../ui/nav'
import { Avatar } from '../../ui/controls'
import { Sheet, openMenu } from '../../ui/overlay'
import { useOS } from '../../os/store'
import { useAppRoute, useLongPress, useNow, useOnscreen } from '../../os/hooks'
import { contactById, CONTACTS } from '../../os/data/people'
import { fmtRelative } from '../../os/time'
import { ContactDetailPage } from '../contacts/ContactDetail'
import { contactMatches, fullName, callName, messageContact } from '../contacts/shared'
import { useFT, useFTRecents, startFT, incomingFT, type FTRecent } from './ftStore'
import { CallView, FTPill } from './CallView'
import './facetime.css'

let demoIncomingScheduled = false

export default function FaceTimeApp() {
  useAppRoute('facetime', (route) => {
    const m = route.match(/^(call|audio|video|incoming)\/(.+)$/)
    if (!m || !contactById(m[2])) return
    if (m[1] === 'incoming') incomingFT(m[2])
    else startFT(m[2], m[1] === 'audio')
  })
  // A gentle demo: the first time FaceTime is opened, Mia calls a little later (if you're not busy).
  useEffect(() => {
    if (demoIncomingScheduled) return
    demoIncomingScheduled = true
    const t = window.setTimeout(() => {
      const st = useOS.getState()
      if (st.openApp === 'facetime' && !useFT.getState().call && !st.locked) incomingFT('mia')
    }, 20_000)
    return () => window.clearTimeout(t)
  }, [])
  const call = useFT((s) => s.call)
  useOnscreen('facetime', call ? `FaceTime call with ${fullName(contactById(call.contactId))}` : 'FaceTime')
  return (
    <div className="app-root ft-app">
      <NavStack root={<Root />} />
      <FTPill />
      <CallView />
    </div>
  )
}

function RecentRow({ r }: { r: FTRecent }) {
  const nav = useNav()
  const now = useNow(60_000)
  const c = contactById(r.contactId)
  const recents = useFTRecents((s) => s.recents)
  const lp = useLongPress((el) =>
    openMenu(el, [
      { label: 'FaceTime Video', icon: <Video size={18} />, onSelect: () => startFT(r.contactId) },
      { label: 'FaceTime Audio', icon: <Phone size={18} />, onSelect: () => startFT(r.contactId, true) },
      { label: 'Message', icon: <MessageCircle size={18} />, onSelect: () => messageContact(r.contactId) },
      { label: 'Remove from Recents', icon: <Trash2 size={18} />, destructive: true, separatorBefore: true, onSelect: () => useFTRecents.getState().set(recents.filter((x) => x.id !== r.id)) },
    ], { title: fullName(c) }),
  )
  if (!c) return null
  return (
    <div className="ft-row" role="button" tabIndex={0} onClick={() => startFT(r.contactId, r.audio)} onKeyDown={(e) => e.key === 'Enter' && startFT(r.contactId, r.audio)} {...lp}>
      <Avatar id={c.id} size={44} />
      <span className="ft-row-main">
        <span className={`ft-row-title ${r.dir === 'missed' ? 'missed' : ''}`}>{callName(c.id)}</span>
        <span className="ft-row-sub">
          {r.audio ? <Phone size={12} fill="currentColor" strokeWidth={0} /> : <Video size={13} fill="currentColor" strokeWidth={0} />}
          {r.dir === 'missed' ? 'Missed' : `FaceTime ${r.audio ? 'Audio' : 'Video'}`}
        </span>
      </span>
      <span className="ft-row-time">{fmtRelative(r.ts, now)}</span>
      <button className="ft-info" aria-label="Info" onClick={(e) => { e.stopPropagation(); nav.push(<ContactDetailPage id={c.id} />) }}><Info size={22} /></button>
    </div>
  )
}

function NewFaceTime({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [q, setQ] = useState('')
  const [to, setTo] = useState<string | null>(null)
  useEffect(() => {
    if (open) {
      setQ('')
      setTo(null)
    }
  }, [open])
  const list = CONTACTS.filter((c) => !c.isBusiness && contactMatches(c, q))
  const go = (audio: boolean) => {
    if (!to) return
    onClose()
    window.setTimeout(() => startFT(to, audio), 250)
  }
  return (
    <Sheet open={open} onClose={onClose} title="New FaceTime" detent="large">
      <div className="ft-new">
        <div className="ft-new-to">
          <span className="secondary">To:</span>
          {to ? (
            <button className="ft-token" onClick={() => setTo(null)}>{fullName(contactById(to))} <X size={12} strokeWidth={3} /></button>
          ) : (
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, email or number" aria-label="To" autoFocus />
          )}
        </div>
        {!to && (
          <div className="ft-new-list">
            <div className="ft-sec">Suggested</div>
            {list.map((c) => (
              <button key={c.id} className="ft-new-row" onClick={() => setTo(c.id)}>
                <Avatar id={c.id} size={40} />
                <span className="grow">{fullName(c)}</span>
                <Video size={18} color="var(--green)" />
              </button>
            ))}
          </div>
        )}
        <div className="ft-new-actions">
          <button className="ft-new-audio" disabled={!to} onClick={() => go(true)}><Phone size={20} fill="currentColor" strokeWidth={0} /> Audio</button>
          <button className="ft-new-video" disabled={!to} onClick={() => go(false)}><Video size={22} fill="currentColor" strokeWidth={0} /> FaceTime</button>
        </div>
      </div>
    </Sheet>
  )
}

function Root() {
  const recents = useFTRecents((s) => s.recents)
  const [newOpen, setNewOpen] = useState(false)
  const sorted = [...recents].sort((a, b) => b.ts - a.ts)
  const posters = [...new Map(sorted.map((r) => [r.contactId, r])).values()].slice(0, 4)
  return (
    <Page title="FaceTime" bottomExtra={10}>
      <div className="ft-actions">
        <button
          className="ft-link glass interactive"
          onClick={() => useOS.getState().set({ shareRequest: { title: 'FaceTime Link', kind: 'link', payload: `https://facetime.example/join#${Math.random().toString(36).slice(2, 10)}`, app: 'facetime' } })}
        >
          <Link2 size={20} /> Create Link
        </button>
        <button className="ft-newbtn" onClick={() => setNewOpen(true)}><Video size={20} fill="#fff" strokeWidth={0} /> New FaceTime</button>
      </div>
      <div className="ft-posters">
        {posters.map((r) => {
          const c = contactById(r.contactId)
          if (!c) return null
          return (
            <button key={r.id} className="ft-poster" style={{ ['--ft-c' as string]: c.color }} onClick={() => startFT(c.id, r.audio)} aria-label={`FaceTime ${fullName(c)}`}>
              <span className="ft-poster-avatar"><Avatar id={c.id} size={64} /></span>
              <span className="ft-poster-name">{c.nickname && ['Mom', 'Dad', 'Grandma'].includes(c.nickname) ? c.nickname : c.first}</span>
              <span className="ft-poster-sub">{r.audio ? <Phone size={11} fill="currentColor" strokeWidth={0} /> : <Video size={12} fill="currentColor" strokeWidth={0} />} {fmtRelative(r.ts)}</span>
            </button>
          )
        })}
      </div>
      <div className="ft-sec">Recent</div>
      <div className="ft-list">
        {sorted.map((r) => <RecentRow key={r.id} r={r} />)}
      </div>
      <button className="ft-demo" onClick={() => incomingFT(posters[0]?.contactId ?? 'alex')}>
        <PhoneIncoming size={15} /> Test incoming call
      </button>
      <NewFaceTime open={newOpen} onClose={() => setNewOpen(false)} />
    </Page>
  )
}
