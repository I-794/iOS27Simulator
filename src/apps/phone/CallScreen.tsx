import { useEffect, useState } from 'react'
import { Volume2, Video, MicOff, UserPlus, Grid3x3, PhoneOff, ChevronDown, Copy, Plane, UtensilsCrossed, Package, CalendarDays, Check, Bluetooth, Smartphone } from 'lucide-react'
import { useOS } from '../../os/store'
import { useNow } from '../../os/hooks'
import { Avatar, AISparkle } from '../../ui/controls'
import { openMenu, Sheet } from '../../ui/overlay'
import { useShell } from '../../shell/shellState'
import { contactById, CONTACTS } from '../../os/data/people'
import { fmtDuration } from '../../os/time'
import { playAlert } from '../../os/audio'
import { useCall, endCall, type AudioRoute } from './callStore'
import { callContext, type CallContextCard } from './callContext'
import { T9, fullName, facetimeContact } from '../contacts/shared'
import { useContactsLocal } from '../contacts/contactsStore'

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#']

export function KeyPad({ onKey, small }: { onKey: (k: string) => void; small?: boolean }) {
  return (
    <div className={`ph-keys ${small ? 'small' : ''}`}>
      {KEYS.map((k) => (
        <button
          key={k}
          className="ph-key"
          aria-label={k}
          onPointerDown={() => onKey(k)}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onKey(k)}
        >
          <span className="ph-key-digit">{k}</span>
          <span className="ph-key-letters">{k === '1' ? ' ' : T9[k] ?? ''}</span>
        </button>
      ))}
    </div>
  )
}

const ICONS = { flight: Plane, reservation: UtensilsCrossed, order: Package, appointment: CalendarDays }

function ContextCard({ ctx }: { ctx: CallContextCard }) {
  const Icon = ICONS[ctx.kind]
  const [copied, setCopied] = useState<string | null>(null)
  return (
    <div className="ph-ctx glass dark-glass anim-up" role="region" aria-label="Call context">
      <div className="ph-ctx-kicker"><AISparkle size={13} /> Call Context</div>
      <div className="ph-ctx-head">
        <span className="ph-ctx-icon"><Icon size={17} /></span>
        <span className="grow">{ctx.heading}</span>
      </div>
      <div className="ph-ctx-rows">
        {ctx.rows.map((r) => (
          <button
            key={r.label}
            className="ph-ctx-row"
            onClick={() => {
              void navigator.clipboard?.writeText(r.value).catch(() => {})
              setCopied(r.label)
              window.setTimeout(() => setCopied(null), 1200)
            }}
            aria-label={`${r.label} ${r.value}, copy`}
          >
            <span className="ph-ctx-label">{r.label}</span>
            <span className="ph-ctx-value">{r.value}</span>
            {copied === r.label ? <Check size={14} color="#30d158" /> : r.copy ? <Copy size={13} className="ph-ctx-copy" /> : null}
          </button>
        ))}
      </div>
      <div className="ph-ctx-foot">
        <span>From {ctx.sources.join(' & ')}</span>
        {ctx.open && (
          <button onClick={() => { useCall.getState().set({ minimized: true }); useOS.getState().launch(ctx.open!.app, { route: ctx.open!.route }) }}>{ctx.open.label}</button>
        )}
      </div>
    </div>
  )
}

function Round({ icon, label, on, onClick, danger, disabled }: { icon: React.ReactNode; label: string; on?: boolean; onClick: (e: React.MouseEvent<HTMLButtonElement>) => void; danger?: boolean; disabled?: boolean }) {
  return (
    <div className="ph-round-wrap">
      <button className={`ph-round ${on ? 'on' : ''} ${danger ? 'danger' : ''}`} onClick={onClick} aria-label={label} aria-pressed={on} disabled={disabled}>
        {icon}
      </button>
      <span>{label}</span>
    </div>
  )
}

/** Full-screen in-call UI with Liquid Glass controls and the iOS 27 Call Context card. */
export function CallScreen() {
  const call = useCall((s) => s.call)
  const set = useCall((s) => s.set)
  const now = useNow(1000)
  const [addOpen, setAddOpen] = useState(false)
  const favorites = useContactsLocal((s) => s.favorites)
  const visible = !!call && !call.minimized
  useEffect(() => {
    if (!visible) return
    useShell.getState().set({ statusOverride: 'light' })
    return () => useShell.getState().set({ statusOverride: null })
  }, [visible])
  if (!call || call.minimized) return null
  const c = call.contactId ? contactById(call.contactId) : undefined
  const ctx = call.contactId ? callContext(call.contactId) : null
  const status =
    call.phase === 'dialing' ? 'calling mobile…' : call.phase === 'ended' ? 'Call Ended' : call.held ? 'On Hold' : fmtDuration((now - (call.startedAt ?? now)) / 1000)
  const color = c?.color ?? '#636366'

  const routeMenu = (el: HTMLElement) =>
    openMenu(el, (['iPhone', 'Speaker', 'AirPods Pro'] as AudioRoute[]).map((r) => ({
      label: r,
      icon: call.route === r ? <Check size={18} /> : r === 'AirPods Pro' ? <Bluetooth size={18} /> : r === 'Speaker' ? <Volume2 size={18} /> : <Smartphone size={18} />,
      onSelect: () => set({ route: r }),
    })))

  return (
    <div className={`ph-call ${call.phase}`} style={{ ['--ph-c' as string]: color }} role="dialog" aria-label={`Call with ${call.name}`}>
      <div className="ph-call-bg" />
      <div className="ph-call-top">
        <button className="bar-btn icon glass dark-glass" aria-label="Minimize call" onClick={() => set({ minimized: true })}><ChevronDown size={22} /></button>
        <span />
      </div>
      <div className="ph-call-main">
        <div className="ph-call-head">
          <div className="ph-call-status">{status}</div>
          <div className="ph-call-name">{call.merged ? `${call.name} & ${call.merged}` : call.name}</div>
          {c?.isBusiness && <div className="ph-call-sub">{c.company}</div>}
          {!call.keypad && !ctx && (
            <div className="ph-call-avatar">
              {call.contactId ? <Avatar id={call.contactId} size={110} /> : <Avatar name="#" size={110} color="#8e8e93" />}
            </div>
          )}
          {!call.keypad && ctx && call.contactId && <div className="ph-call-avatar sm"><Avatar id={call.contactId} size={64} /></div>}
        </div>
        {ctx && !call.keypad && <ContextCard ctx={ctx} />}
        {call.keypad && <div className="ph-call-dtmf">{call.dtmf || ' '}</div>}
      </div>
      <div className="ph-call-controls">
        {call.keypad ? (
          <KeyPad
            small
            onKey={(k) => {
              set({ dtmf: (call.dtmf + k).slice(-18) })
              playAlert('tapback', useOS.getState().silent ? 0 : 0.15)
            }}
          />
        ) : (
          <div className="ph-grid">
            <Round icon={<Volume2 size={28} />} label={call.route === 'iPhone' ? 'Audio' : call.route} on={call.route !== 'iPhone'} onClick={(e) => (call.route === 'iPhone' ? set({ route: 'Speaker' }) : routeMenu(e.currentTarget))} />
            <Round
              icon={<Video size={28} />}
              label="FaceTime"
              disabled={!c || c.isBusiness || call.phase !== 'active'}
              onClick={() => {
                const id = call.contactId!
                endCall(true)
                facetimeContact(id)
              }}
            />
            <Round icon={<MicOff size={28} />} label="Mute" on={call.muted} onClick={() => set({ muted: !call.muted })} />
            <Round icon={<UserPlus size={28} />} label="Add" onClick={() => setAddOpen(true)} disabled={call.phase !== 'active'} />
            <Round icon={<PhoneOff size={30} />} label="End" danger onClick={() => endCall()} disabled={call.phase === 'ended'} />
            <Round icon={<Grid3x3 size={28} />} label="Keypad" onClick={() => set({ keypad: true })} disabled={call.phase === 'ended'} />
          </div>
        )}
        {call.keypad && (
          <div className="ph-keypad-foot">
            <span />
            <button className="ph-round danger" aria-label="End" onClick={() => endCall()}><PhoneOff size={30} /></button>
            <button className="ph-hide" onClick={() => set({ keypad: false })}>Hide</button>
          </div>
        )}
      </div>
      <Sheet open={addOpen} onClose={() => setAddOpen(false)} title="Add Call" detent="medium">
        <div className="ph-add-list">
          {CONTACTS.filter((x) => favorites.includes(x.id) && x.id !== call.contactId).map((x) => (
            <button
              key={x.id}
              className="ph-add-row"
              onClick={() => {
                setAddOpen(false)
                set({ merged: fullName(x).split(' ')[0] })
                useOS.getState().showToast(`Merged call with ${fullName(x)}`, '📞')
              }}
            >
              <Avatar id={x.id} size={40} />
              <span className="grow">{fullName(x)}</span>
              <span className="secondary t-subhead">mobile</span>
            </button>
          ))}
        </div>
      </Sheet>
    </div>
  )
}

/** Green "return to call" pill shown inside Phone while a call is minimized. */
export function CallPill() {
  const call = useCall((s) => s.call)
  const now = useNow(1000)
  if (!call || !call.minimized || call.phase === 'ended') return null
  return (
    <button className="ph-pill anim-pop" onClick={() => useCall.getState().set({ minimized: false })} aria-label="Return to call">
      <span className="ph-pill-dot" />
      {call.name} · {call.phase === 'active' ? fmtDuration((now - (call.startedAt ?? now)) / 1000) : 'Calling…'}
    </button>
  )
}
