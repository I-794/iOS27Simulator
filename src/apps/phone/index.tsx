import { useEffect, useMemo, useRef, useState } from 'react'
import { create } from 'zustand'
import { Star, Clock, CircleUserRound, Grid3x3, Voicemail as VoicemailIcon, Plus, Info, Phone, Video, PhoneIncoming, PhoneOutgoing, PhoneMissed, Delete, Play, Pause, Volume2, Trash2, MessageCircle, UserPlus } from 'lucide-react'
import { NavStack, Page, useNav, BarButton, TabBar } from '../../ui/nav'
import { Avatar, Segmented, AISparkle } from '../../ui/controls'
import { openMenu, showAlert, Sheet } from '../../ui/overlay'
import { useOS } from '../../os/store'
import { useAppRoute, useLongPress, useNow, useOnscreen } from '../../os/hooks'
import { contactById, CONTACTS } from '../../os/data/people'
import { fmtRelative, fmtDuration } from '../../os/time'
import { playAlert } from '../../os/audio'
import { ContactsList } from '../contacts/ContactsList'
import { ContactDetailPage } from '../contacts/ContactDetail'
import { useContactsLocal } from '../contacts/contactsStore'
import { fullName, callName, fmtPhone, keypadMatches, contactForNumber, digits, messageContact, facetimeContact } from '../contacts/shared'
import { usePhoneLocal, type RecentCall, type Voicemail } from './phoneStore'
import { useCall, startCall } from './callStore'
import { CallScreen, CallPill, KeyPad } from './CallScreen'
import './phone.css'

type Tab = 'favorites' | 'recents' | 'contacts' | 'keypad' | 'voicemail'

const useDial = create<{ num: string; set: (n: string) => void }>((set) => ({ num: '', set: (num) => set({ num }) }))

function callRecent(r: RecentCall) {
  if (r.type !== 'mobile' && r.contactId) {
    useOS.getState().launch('facetime', { route: `${r.type === 'FaceTime Audio' ? 'audio' : 'call'}/${r.contactId}` })
    return
  }
  startCall({ contactId: r.contactId, number: r.number })
}

export default function PhoneApp() {
  const tab = usePhoneLocal((s) => s.tab)
  const setTab = (t: Tab) => usePhoneLocal.getState().set({ tab: t })
  const vmUnread = usePhoneLocal((s) => s.voicemails.filter((v) => v.unread).length)
  const missed = usePhoneLocal((s) => s.recents.filter((r) => r.dir === 'missed' && Date.now() - r.ts < 86_400_000).length)
  useAppRoute('phone', (route) => {
    const call = route.match(/^call\/(.+)$/)
    if (call && contactById(call[1])) return startCall({ contactId: call[1] })
    const dial = route.match(/^dial\/(.+)$/)
    if (dial) {
      useDial.getState().set(digits(decodeURIComponent(dial[1])))
      setTab('keypad')
      return
    }
    if (['favorites', 'recents', 'contacts', 'keypad', 'voicemail'].includes(route)) setTab(route as Tab)
  })
  useOnscreen('phone', `Phone ${tab}`)
  return (
    <div className="app-root ph-app">
      {tab === 'favorites' && <NavStack key="fav" root={<Favorites />} />}
      {tab === 'recents' && <NavStack key="rec" root={<Recents />} />}
      {tab === 'contacts' && <NavStack key="con" root={<ContactsTab />} />}
      {tab === 'keypad' && <Keypad />}
      {tab === 'voicemail' && <NavStack key="vm" root={<VoicemailTab />} />}
      <TabBar<Tab>
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'favorites', label: 'Favorites', icon: <Star size={24} fill={tab === 'favorites' ? 'currentColor' : 'none'} /> },
          { id: 'recents', label: 'Recents', icon: <span className="ph-tab-ic"><Clock size={24} />{missed > 0 && <b>{missed}</b>}</span> },
          { id: 'contacts', label: 'Contacts', icon: <CircleUserRound size={24} /> },
          { id: 'keypad', label: 'Keypad', icon: <Grid3x3 size={24} /> },
          { id: 'voicemail', label: 'Voicemail', icon: <span className="ph-tab-ic"><VoicemailIcon size={24} />{vmUnread > 0 && <b>{vmUnread}</b>}</span> },
        ]}
      />
      <CallPill />
      <CallScreen />
    </div>
  )
}

function InfoBtn({ id }: { id?: string }) {
  const nav = useNav()
  return (
    <button
      className="ph-info"
      aria-label="Contact info"
      onClick={(e) => {
        e.stopPropagation()
        if (id) nav.push(<ContactDetailPage id={id} />)
        else useOS.getState().showToast('Unknown caller · Maple Grove', 'ℹ️')
      }}
    >
      <Info size={22} />
    </button>
  )
}

// ---------------------------------------------------------------- Favorites

function FavRow({ id }: { id: string }) {
  const c = contactById(id)!
  const toggle = useContactsLocal((s) => s.toggleFavorite)
  const lp = useLongPress((el) =>
    openMenu(el, [
      { label: 'Call', icon: <Phone size={18} />, onSelect: () => startCall({ contactId: id }) },
      { label: 'Message', icon: <MessageCircle size={18} />, onSelect: () => messageContact(id) },
      ...(c.isBusiness ? [] : [{ label: 'FaceTime', icon: <Video size={18} />, onSelect: () => facetimeContact(id) }]),
      { label: 'Remove from Favorites', icon: <Star size={18} />, destructive: true, separatorBefore: true, onSelect: () => toggle(id) },
    ], { title: fullName(c) }),
  )
  return (
    <div className="ph-row" role="button" tabIndex={0} onClick={() => startCall({ contactId: id })} onKeyDown={(e) => e.key === 'Enter' && startCall({ contactId: id })} {...lp}>
      <Avatar id={id} size={44} />
      <span className="ph-row-main">
        <span className="ph-row-title">{callName(id)}</span>
        <span className="ph-row-sub"><Phone size={12} fill="currentColor" strokeWidth={0} /> {c.isBusiness ? 'main' : 'mobile'}</span>
      </span>
      <InfoBtn id={id} />
    </div>
  )
}

function Favorites() {
  const favs = useContactsLocal((s) => s.favorites)
  const toggle = useContactsLocal((s) => s.toggleFavorite)
  const [adding, setAdding] = useState(false)
  return (
    <Page title="Favorites" bottomExtra={80} trailing={<BarButton label="Add Favorite" onClick={() => setAdding(true)}><Plus size={24} /></BarButton>}>
      <div className="ph-list">
        {favs.filter((f) => contactById(f)).map((f) => <FavRow key={f} id={f} />)}
      </div>
      {favs.length === 0 && <div className="empty-state"><Star size={40} strokeWidth={1.5} /><div className="t-title2">No Favorites</div><div>Tap + to add people you call often.</div></div>}
      <Sheet open={adding} onClose={() => setAdding(false)} title="Add Favorite" detent="large">
        <div className="ph-add-list">
          {CONTACTS.filter((c) => !favs.includes(c.id)).map((c) => (
            <button key={c.id} className="ph-add-row" onClick={() => { toggle(c.id); setAdding(false) }}>
              <Avatar id={c.id} size={40} />
              <span className="grow">{fullName(c)}</span>
              <UserPlus size={18} color="var(--accent)" />
            </button>
          ))}
        </div>
      </Sheet>
    </Page>
  )
}

// ---------------------------------------------------------------- Recents

function RecentRow({ r, count }: { r: RecentCall; count: number }) {
  const now = useNow(60_000)
  const c = r.contactId ? contactById(r.contactId) : undefined
  const recents = usePhoneLocal((s) => s.recents)
  const lp = useLongPress((el) =>
    openMenu(el, [
      { label: 'Call', icon: <Phone size={18} />, onSelect: () => startCall({ contactId: r.contactId, number: r.number }) },
      ...(c ? [{ label: 'Message', icon: <MessageCircle size={18} />, onSelect: () => messageContact(c.id) }] : []),
      ...(c && !c.isBusiness ? [{ label: 'FaceTime', icon: <Video size={18} />, onSelect: () => facetimeContact(c.id) }] : []),
      { label: 'Delete from Recents', icon: <Trash2 size={18} />, destructive: true, separatorBefore: true, onSelect: () => usePhoneLocal.getState().set({ recents: recents.filter((x) => x.id !== r.id) }) },
    ], { title: c ? fullName(c) : fmtPhone(r.number) }),
  )
  const DirIcon = r.dir === 'missed' ? PhoneMissed : r.dir === 'incoming' ? PhoneIncoming : PhoneOutgoing
  return (
    <div className="ph-row" role="button" tabIndex={0} onClick={() => callRecent(r)} onKeyDown={(e) => e.key === 'Enter' && callRecent(r)} {...lp}>
      {c ? <Avatar id={c.id} size={44} /> : <Avatar name="?" size={44} color="#8e8e93" />}
      <span className="ph-row-main">
        <span className={`ph-row-title ${r.dir === 'missed' ? 'missed' : ''}`}>
          {c ? callName(c.id) : fmtPhone(r.number)}
          {count > 1 && <span className="ph-count"> ({count})</span>}
        </span>
        <span className="ph-row-sub">
          <DirIcon size={12} /> {r.type === 'mobile' ? (c ? (c.isBusiness ? 'main' : 'mobile') : 'Maple Grove, CA') : r.type}
          {r.duration > 0 && <span className="ph-dur"> · {fmtDuration(r.duration)}</span>}
        </span>
      </span>
      <span className="ph-row-time">{fmtRelative(r.ts, now)}</span>
      <InfoBtn id={c?.id} />
    </div>
  )
}

function Recents() {
  const recents = usePhoneLocal((s) => s.recents)
  const [filter, setFilter] = useState<'All' | 'Missed'>('All')
  // collapse consecutive calls with the same person + direction (iOS shows "(2)")
  const rows = useMemo(() => {
    const list = [...recents].filter((r) => filter === 'All' || r.dir === 'missed').sort((a, b) => b.ts - a.ts)
    const out: { r: RecentCall; count: number }[] = []
    for (const r of list) {
      const last = out[out.length - 1]
      if (last && last.r.number === r.number && last.r.dir === r.dir && last.r.type === r.type && last.r.ts - r.ts < 3 * 3_600_000) last.count++
      else out.push({ r, count: 1 })
    }
    return out
  }, [recents, filter])
  return (
    <Page
      title="Recents"
      bottomExtra={80}
      trailing={
        <BarButton label="Clear" onClick={() => showAlert({ title: 'Clear All Recents?', message: 'This removes your entire call history on this iPhone.', actions: [{ label: 'Cancel', style: 'cancel' }, { label: 'Clear All', style: 'destructive', onPress: () => usePhoneLocal.getState().set({ recents: [] }) }] })}>
          Edit
        </BarButton>
      }
      header={
        <div className="ph-seg">
          <Segmented options={['All', 'Missed'] as const} value={filter} onChange={setFilter} />
        </div>
      }
    >
      <div className="ph-list">
        {rows.map(({ r, count }) => <RecentRow key={r.id} r={r} count={count} />)}
      </div>
      {rows.length === 0 && <div className="empty-state"><Clock size={40} strokeWidth={1.5} /><div className="t-title2">No {filter === 'Missed' ? 'Missed ' : ''}Calls</div></div>}
    </Page>
  )
}

// ---------------------------------------------------------------- Contacts

function ContactsTab() {
  const nav = useNav()
  return (
    <Page title="Contacts" bottomExtra={80}>
      <ContactsList onOpen={(id) => nav.push(<ContactDetailPage id={id} />)} />
    </Page>
  )
}

// ---------------------------------------------------------------- Keypad

function Keypad() {
  const num = useDial((s) => s.num)
  const setNum = useDial((s) => s.set)
  const holdTimer = useRef<number | undefined>(undefined)
  const matches = keypadMatches(num)
  const known = contactForNumber(num)
  const top = known ? { c: known, phone: known.phones[0] } : matches[0]
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest('input,textarea')) return
      if (/^[0-9*#]$/.test(e.key)) setNum(useDial.getState().num + e.key)
      else if (e.key === 'Backspace') setNum(useDial.getState().num.slice(0, -1))
      else if (e.key === 'Enter' && useDial.getState().num) dial()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const dial = () => {
    const n = useDial.getState().num
    if (!n) {
      // iOS: tapping call with an empty field recalls the last dialed number
      const last = usePhoneLocal.getState().recents.find((r) => r.dir === 'outgoing')
      if (last) setNum(digits(last.number))
      return
    }
    const c = contactForNumber(n)
    startCall({ contactId: c?.id, number: fmtPhone(n) })
  }
  return (
    <div className="ph-keypad">
      <div className="ph-display">
        <div className={`ph-number ${num.length > 11 ? 'long' : ''}`} aria-live="polite">{fmtPhone(num)}</div>
        {num && (
          top ? (
            <button className="ph-match" onClick={() => setNum(digits(top.phone))}>
              <span className="ph-match-name">{fullName(top.c)}</span>
              <span className="secondary"> {fmtPhone(top.phone)}</span>
              {matches.length > 1 && !known && <span className="ph-match-more">+{matches.length - 1}</span>}
            </button>
          ) : (
            <button className="ph-match add" onClick={() => useOS.getState().showToast('Number added to Contacts', '👤')}>Add Number</button>
          )
        )}
      </div>
      <KeyPad
        onKey={(k) => {
          setNum(useDial.getState().num + k)
          playAlert('tapback', useOS.getState().silent ? 0 : 0.12)
          if (k === '0') {
            window.clearTimeout(holdTimer.current)
            holdTimer.current = window.setTimeout(() => setNum(useDial.getState().num.replace(/0$/, '+')), 600)
            const up = () => {
              window.clearTimeout(holdTimer.current)
              window.removeEventListener('pointerup', up)
            }
            window.addEventListener('pointerup', up)
          }
        }}
      />
      <div className="ph-keypad-foot">
        <span />
        <button className="ph-round call" aria-label="Call" onClick={dial}><Phone size={32} fill="#fff" strokeWidth={0} /></button>
        {num ? (
          <button className="ph-del" aria-label="Delete" onClick={() => setNum(num.slice(0, -1))} onContextMenu={(e) => { e.preventDefault(); setNum('') }}><Delete size={28} /></button>
        ) : <span />}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- Voicemail

function VoicemailRow({ v, open, onToggle }: { v: Voicemail; open: boolean; onToggle: () => void }) {
  const c = v.contactId ? contactById(v.contactId) : undefined
  const [pos, setPos] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speaker, setSpeaker] = useState(false)
  const raf = useRef(0)
  useEffect(() => {
    if (!playing) return
    const t0 = performance.now() - pos * 1000
    const tick = () => {
      const p = (performance.now() - t0) / 1000
      if (p >= v.duration) {
        setPos(0)
        setPlaying(false)
        return
      }
      setPos(p)
      raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing])
  useEffect(() => {
    if (!open) setPlaying(false)
  }, [open])
  const words = v.transcript.split(' ')
  const spoken = Math.floor((pos / v.duration) * words.length)
  const markRead = () => v.unread && usePhoneLocal.getState().set({ voicemails: usePhoneLocal.getState().voicemails.map((x) => (x.id === v.id ? { ...x, unread: false } : x)) })
  return (
    <div className={`ph-vm ${open ? 'open' : ''}`}>
      <button className="ph-vm-head" onClick={() => { onToggle(); markRead() }} aria-expanded={open}>
        <span className={`ph-vm-dot ${v.unread ? 'on' : ''}`} />
        <span className="ph-row-main">
          <span className="ph-row-title">{c ? fullName(c) : fmtPhone(v.number)}</span>
          <span className="ph-row-sub">{c?.isBusiness ? 'main' : 'mobile'}</span>
        </span>
        <span className="ph-vm-meta">
          <span>{fmtRelative(v.ts)}</span>
          <span>{fmtDuration(v.duration)}</span>
        </span>
      </button>
      {open && (
        <div className="ph-vm-body anim-fade">
          <div className="ph-vm-transcript">
            <div className="ph-vm-tlabel"><AISparkle size={12} /> Transcription</div>
            <p>
              {words.map((w, i) => <span key={i} className={playing && i <= spoken ? 'spoken' : ''}>{w} </span>)}
            </p>
          </div>
          <div className="ph-vm-player">
            <button className="ph-vm-play" aria-label={playing ? 'Pause' : 'Play'} onClick={() => { setPlaying(!playing); markRead() }}>
              {playing ? <Pause size={20} fill="currentColor" strokeWidth={0} /> : <Play size={20} fill="currentColor" strokeWidth={0} />}
            </button>
            <div
              className="ph-vm-track"
              role="slider"
              aria-label="Playback position"
              aria-valuenow={Math.round(pos)}
              onPointerDown={(e) => {
                const r = e.currentTarget.getBoundingClientRect()
                setPos(Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * v.duration)
              }}
            >
              <div className="ph-vm-fill" style={{ width: `${(pos / v.duration) * 100}%` }} />
              <div className="ph-vm-knob" style={{ left: `${(pos / v.duration) * 100}%` }} />
            </div>
            <span className="ph-vm-time">-{fmtDuration(v.duration - pos)}</span>
          </div>
          <div className="ph-vm-actions">
            <button className={speaker ? 'on' : ''} onClick={() => setSpeaker(!speaker)} aria-pressed={speaker}><Volume2 size={20} /> Speaker</button>
            <button onClick={() => startCall({ contactId: v.contactId, number: v.number })}><Phone size={19} /> Call Back</button>
            <button className="destructive" onClick={() => usePhoneLocal.getState().set({ voicemails: usePhoneLocal.getState().voicemails.filter((x) => x.id !== v.id) })}><Trash2 size={19} /> Delete</button>
          </div>
        </div>
      )}
    </div>
  )
}

function VoicemailTab() {
  const vms = usePhoneLocal((s) => s.voicemails)
  const [open, setOpen] = useState<string | null>(vms[0]?.id ?? null)
  const [greeting, setGreeting] = useState(false)
  const [custom, setCustom] = useState(false)
  return (
    <Page title="Voicemail" bottomExtra={80} leading={<BarButton label="Greeting" onClick={() => setGreeting(true)}>Greeting</BarButton>}>
      <div className="ph-list">
        {vms.map((v) => <VoicemailRow key={v.id} v={v} open={open === v.id} onToggle={() => setOpen(open === v.id ? null : v.id)} />)}
      </div>
      {vms.length === 0 && <div className="empty-state"><VoicemailIcon size={40} strokeWidth={1.5} /><div className="t-title2">No Voicemail</div></div>}
      <Sheet open={greeting} onClose={() => setGreeting(false)} title="Greeting" detent="medium">
        <div className="list" style={{ marginTop: 8 }}>
          <button className="row-item" onClick={() => setCustom(false)}><span className="row-main"><span className="row-title">Default</span></span>{!custom && <span className="accent">✓</span>}</button>
          <button className="row-item" onClick={() => setCustom(true)}><span className="row-main"><span className="row-title">Custom</span></span>{custom && <span className="accent">✓</span>}</button>
        </div>
        <div className="list-footer" style={{ marginTop: -10 }}>{custom ? '“Hey, it’s Jamie! Leave a message and I’ll call you back.”' : 'Callers hear: “You have reached (555) 010-4417. Please leave a message.”'}</div>
      </Sheet>
    </Page>
  )
}

export { useCall }
