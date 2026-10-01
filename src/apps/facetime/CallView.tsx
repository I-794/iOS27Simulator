import { useEffect, useRef, useState } from 'react'
import { Mic, MicOff, Video, VideoOff, SwitchCamera, Volume2, PhoneOff, Phone, ScreenShare, MessageCircle, Clock, ChevronDown, Wifi, Music, Tv, Check, Columns2, PictureInPicture2, Bluetooth, Smartphone } from 'lucide-react'
import { useOS } from '../../os/store'
import { useNow, screenScale } from '../../os/hooks'
import { Avatar, Segmented, Spinner } from '../../ui/controls'
import { Sheet, openMenu } from '../../ui/overlay'
import { useShell } from '../../shell/shellState'
import { Scene } from '../../art/Scene'
import { contactById } from '../../os/data/people'
import { fmtDuration } from '../../os/time'
import { TRACKS } from '../../os/data/media'
import { FakeVideo, type Res } from './FakeVideo'
import { useFT, acceptFT, declineFT, endFT, setQuality, type Quality, type FTCall } from './ftStore'
import { callName, messageContact } from '../contacts/shared'

const RES: Record<Quality, { res: Res; label: string; bars: number }> = {
  Excellent: { res: 'hd', label: '1080p HD', bars: 4 },
  Fair: { res: 'sd', label: '540p', bars: 2 },
  Poor: { res: 'low', label: '180p', bars: 1 },
  Lost: { res: 'low', label: '—', bars: 0 },
}

function Bars({ n }: { n: number }) {
  return (
    <span className="ft-bars" aria-hidden>
      {[1, 2, 3, 4].map((i) => <i key={i} className={i <= n ? 'on' : ''} style={{ height: 3 + i * 2.5 }} />)}
    </span>
  )
}

/** My own camera: front, back or both at once (iOS 27 dual capture). */
function SelfView({ call }: { call: FTCall }) {
  const front = <FakeVideo color="#5e5ce6" seed={7} res="sd" talking={!call.muted} mirrored />
  const back = <Scene scene="autumn-trees" className="ft-back-scene" />
  if (call.camOff) return <div className="ft-self-off"><VideoOff size={22} /></div>
  if (call.dual === 'split') {
    return (
      <div className="ft-self-split">
        <div>{call.front ? front : back}</div>
        <div>{call.front ? back : front}</div>
      </div>
    )
  }
  if (call.dual === 'pip') {
    return (
      <div className="ft-self-dualpip">
        {call.front ? back : front}
        <div className="ft-self-bubble">{call.front ? front : back}</div>
      </div>
    )
  }
  return call.front ? front : back
}

function DraggablePiP({ call }: { call: FTCall }) {
  const ref = useRef<HTMLDivElement>(null)
  const [corner, setCorner] = useState<'tr' | 'tl' | 'br' | 'bl'>('br')
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null)
  const patch = useFT((s) => s.patch)
  const onDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('button')) return
    e.stopPropagation()
    const s = screenScale()
    const x0 = e.clientX
    const y0 = e.clientY
    let moved = false
    const move = (ev: PointerEvent) => {
      const dx = (ev.clientX - x0) / s
      const dy = (ev.clientY - y0) / s
      if (Math.hypot(dx, dy) > 4) moved = true
      setDrag({ x: dx, y: dy })
    }
    const up = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      setDrag(null)
      if (!moved) return
      const el = ref.current
      const parent = el?.parentElement
      if (!el || !parent) return
      const r = el.getBoundingClientRect()
      const pr = parent.getBoundingClientRect()
      const cx = (r.left + r.width / 2 - pr.left) / pr.width
      const cy = (r.top + r.height / 2 - pr.top) / pr.height
      setCorner(`${cy < 0.5 ? 't' : 'b'}${cx < 0.5 ? 'l' : 'r'}` as 'tr')
      void ev
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }
  return (
    <div
      ref={ref}
      className={`ft-pip ${corner} ${call.dual !== 'off' ? 'dual' : ''} ${call.controls ? 'with-controls' : ''} ${drag ? 'dragging' : ''}`}
      style={drag ? { translate: `${drag.x}px ${drag.y}px` } : undefined}
      onPointerDown={onDown}
      onClick={(e) => e.stopPropagation()}
      role="group"
      aria-label="Your camera"
    >
      <SelfView call={call} />
      {!call.camOff && (
        <div className="ft-pip-tools">
          <button aria-label="Flip camera" onClick={() => patch({ front: !call.front })}><SwitchCamera size={16} /></button>
          <button
            aria-label="Dual camera"
            className={call.dual !== 'off' ? 'on' : ''}
            onClick={(e) =>
              openMenu(e.currentTarget, [
                { label: 'Single Camera', icon: call.dual === 'off' ? <Check size={18} /> : undefined, onSelect: () => patch({ dual: 'off' }) },
                { label: 'Dual Camera · Split', icon: call.dual === 'split' ? <Check size={18} /> : <Columns2 size={18} />, onSelect: () => patch({ dual: 'split' }) },
                { label: 'Dual Camera · Picture in Picture', icon: call.dual === 'pip' ? <Check size={18} /> : <PictureInPicture2 size={18} />, onSelect: () => patch({ dual: 'pip' }) },
              ], { title: 'Front and back cameras at the same time' })
            }
          >
            <Columns2 size={16} />
          </button>
        </div>
      )}
    </div>
  )
}

function Ctl({ icon, label, on, onClick, danger }: { icon: React.ReactNode; label: string; on?: boolean; onClick: (e: React.MouseEvent<HTMLButtonElement>) => void; danger?: boolean }) {
  return (
    <button className={`ft-ctl ${on ? 'on' : ''} ${danger ? 'danger' : ''}`} aria-label={label} aria-pressed={on} onClick={(e) => { e.stopPropagation(); onClick(e) }}>
      {icon}
    </button>
  )
}

export function CallView() {
  const call = useFT((s) => s.call)
  const patch = useFT((s) => s.patch)
  const now = useNow(1000)
  const np = useOS((s) => s.nowPlaying)
  const [net, setNet] = useState(false)
  const [share, setShare] = useState(false)
  const hideTimer = useRef<number | undefined>(undefined)
  const visible = !!call && !call.minimized
  useEffect(() => {
    if (!visible) return
    useShell.getState().set({ statusOverride: 'light' })
    return () => useShell.getState().set({ statusOverride: null })
  }, [visible])
  // auto-hide the controls during a video call
  useEffect(() => {
    window.clearTimeout(hideTimer.current)
    if (call?.phase === 'active' && !call.audio && call.controls && !net) hideTimer.current = window.setTimeout(() => useFT.getState().patch({ controls: false }), 6000)
    return () => window.clearTimeout(hideTimer.current)
  }, [call?.phase, call?.controls, call?.audio, net])
  if (!call || call.minimized) return null

  const c = contactById(call.contactId)
  const name = c ? callName(c.id) : call.contactId
  const color = c?.color ?? '#0a84ff'
  const seed = [...call.contactId].reduce((n, ch) => n + ch.charCodeAt(0), 0)
  const q = RES[call.quality]
  const elapsed = call.startedAt ? fmtDuration((now - call.startedAt) / 1000) : ''

  const routeMenu = (el: HTMLElement) =>
    openMenu(el, [
      { label: 'iPhone', icon: !call.speaker ? <Check size={18} /> : <Smartphone size={18} />, onSelect: () => patch({ speaker: false }) },
      { label: 'Speaker', icon: call.speaker ? <Check size={18} /> : <Volume2 size={18} />, onSelect: () => patch({ speaker: true }) },
      { label: 'AirPods Pro', icon: <Bluetooth size={18} />, onSelect: () => { patch({ speaker: false }); useOS.getState().showToast('AirPods Pro connected', '🎧') } },
    ])

  // ------------------------------------------------ incoming
  if (call.phase === 'incoming') {
    return (
      <div className="ft-call ft-incoming" style={{ ['--ft-c' as string]: color }} role="dialog" aria-label={`Incoming FaceTime from ${name}`}>
        <div className="ft-poster-bg" />
        <div className="ft-incoming-head">
          <div className="ft-incoming-kind">{call.audio ? 'FaceTime Audio' : 'FaceTime Video'}</div>
          <div className="ft-incoming-name">{name}</div>
        </div>
        <div className="ft-incoming-avatar"><Avatar id={call.contactId} size={150} /></div>
        <div className="ft-incoming-minor">
          <button onClick={() => { declineFT(); useOS.getState().showToast(`Reminder set: call ${c?.first ?? name} in 1 hour`, '⏰') }}><span><Clock size={20} /></span>Remind Me</button>
          <button onClick={() => { declineFT(); messageContact(call.contactId) }}><span><MessageCircle size={20} /></span>Message</button>
        </div>
        <div className="ft-incoming-actions">
          <div className="ft-incoming-btn"><button className="decline" aria-label="Decline" onClick={declineFT}><PhoneOff size={32} /></button>Decline</div>
          <div className="ft-incoming-btn"><button className="accept" aria-label="Accept" onClick={acceptFT}>{call.audio ? <Phone size={32} fill="#fff" strokeWidth={0} /> : <Video size={34} fill="#fff" strokeWidth={0} />}</button>Accept</div>
        </div>
      </div>
    )
  }

  // ------------------------------------------------ outgoing / active / ended
  return (
    <div
      className={`ft-call ${call.phase} ${call.audio ? 'audio' : ''} q-${call.quality.toLowerCase()}`}
      style={{ ['--ft-c' as string]: color }}
      role="dialog"
      aria-label={`FaceTime with ${name}`}
      onClick={() => patch({ controls: !call.controls })}
    >
      {/* full-bleed video */}
      {call.audio || call.phase === 'ended' ? (
        <div className="ft-poster-bg" />
      ) : call.phase === 'outgoing' ? (
        <div className="ft-remote">
          <SelfView call={call} />
          <div className="ft-remote-dim" />
        </div>
      ) : (
        <div className={`ft-remote res-${q.res}`}>
          <FakeVideo color={color} seed={seed} res={q.res} frozen={call.reconnecting || call.audioFallback} talking />
        </div>
      )}

      {/* audio-only / fallback card */}
      {(call.audio || call.phase === 'ended' || call.audioFallback) && (
        <div className="ft-audio-card anim-fade">
          <Avatar id={call.contactId} size={call.audioFallback ? 96 : 130} />
          <div className="ft-audio-name">{name}</div>
          <div className="ft-audio-status">
            {call.phase === 'ended' ? 'Call Ended' : call.phase === 'outgoing' ? 'Calling…' : call.audioFallback ? `Audio only · ${elapsed}` : `FaceTime Audio · ${elapsed}`}
          </div>
          {call.audioFallback && (
            <div className="ft-fallback glass dark-glass" onClick={(e) => e.stopPropagation()}>
              <Wifi size={18} />
              <div className="grow">
                <b>Switched to audio</b>
                <span>Poor connection. Video resumes automatically when the network improves.</span>
              </div>
            </div>
          )}
          {!call.audioFallback && call.phase === 'active' && <div className="ft-wave">{Array.from({ length: 9 }, (_, i) => <i key={i} style={{ animationDelay: `${i * 0.11}s` }} />)}</div>}
        </div>
      )}

      {/* reconnecting */}
      {call.reconnecting && (
        <div className="ft-reconnect anim-fade">
          <Spinner size={28} />
          <b>Reconnecting…</b>
          <span>Connection lost. FaceTime will reconnect automatically.</span>
        </div>
      )}

      {/* top glass info bar */}
      {(call.controls || call.phase !== 'active' || call.audio) && (
        <div className="ft-top anim-fade" onClick={(e) => e.stopPropagation()}>
          <button className="bar-btn icon glass dark-glass" aria-label="Minimize" onClick={() => patch({ minimized: true })}><ChevronDown size={22} /></button>
          <div className="ft-top-pill glass dark-glass">
            <div className="ft-top-name">{name}</div>
            <div className="ft-top-sub">
              {call.phase === 'outgoing' ? 'FaceTime…' : call.phase === 'ended' ? 'Call Ended' : `${call.audio ? 'Audio' : 'Video'} · ${elapsed}`}
            </div>
          </div>
          {call.phase === 'active' ? (
            <button className="ft-net glass dark-glass" aria-label={`Network quality: ${call.quality}`} onClick={() => setNet(true)}>
              <Bars n={q.bars} />
              {!call.audio && <span>{call.audioFallback ? 'Audio' : q.label}</span>}
            </button>
          ) : <span style={{ width: 44 }} />}
        </div>
      )}

      {call.shareplay && call.phase === 'active' && (
        <div className="ft-shareplay glass dark-glass anim-up" onClick={(e) => e.stopPropagation()}>
          {call.shareplay === 'music' ? <Music size={18} /> : call.shareplay === 'tv' ? <Tv size={18} /> : <ScreenShare size={18} />}
          <span className="grow">
            <b>SharePlay</b> ·{' '}
            {call.shareplay === 'music' ? `${TRACKS.find((t) => t.id === np.trackId)?.title ?? 'Music'} — listening together` : call.shareplay === 'tv' ? 'Watching together' : 'Sharing your screen'}
          </span>
          <button onClick={() => patch({ shareplay: null })}>End</button>
        </div>
      )}

      {!call.audio && call.phase === 'active' && <DraggablePiP call={call} />}

      {/* bottom glass controls */}
      {(call.controls || call.phase !== 'active' || call.audio) && call.phase !== 'ended' && (
        <div className="ft-bar glass dark-glass anim-up" onClick={(e) => e.stopPropagation()}>
          <Ctl icon={call.muted ? <MicOff size={24} /> : <Mic size={24} />} label={call.muted ? 'Unmute' : 'Mute'} on={call.muted} onClick={() => patch({ muted: !call.muted })} />
          {call.audio ? (
            <Ctl icon={<Video size={24} />} label="Turn on video" onClick={() => patch({ audio: false, speaker: true })} />
          ) : (
            <Ctl icon={call.camOff ? <VideoOff size={24} /> : <Video size={24} />} label={call.camOff ? 'Camera On' : 'Camera Off'} on={call.camOff} onClick={() => patch({ camOff: !call.camOff })} />
          )}
          {!call.audio && <Ctl icon={<SwitchCamera size={24} />} label="Flip" onClick={() => patch({ front: !call.front })} />}
          <Ctl icon={<Volume2 size={24} />} label={call.speaker ? 'Speaker On' : 'Speaker'} on={call.speaker} onClick={(e) => routeMenu(e.currentTarget)} />
          <Ctl icon={<ScreenShare size={24} />} label="SharePlay" on={!!call.shareplay} onClick={() => setShare(true)} />
          <Ctl icon={<PhoneOff size={26} />} label="End" danger onClick={() => endFT()} />
        </div>
      )}

      <div style={{ display: 'contents' }} onClick={(e) => e.stopPropagation()}>
      <Sheet open={net} onClose={() => setNet(false)} title="Network" detent="auto">
        <div className="ft-netsheet" onClick={(e) => e.stopPropagation()}>
          <div className="ft-net-now"><Bars n={q.bars} /> <b>{call.quality}</b> · {call.reconnecting ? 'Reconnecting…' : call.audioFallback ? 'Audio only' : call.audio ? 'Audio' : q.label}</div>
          <Segmented options={['Excellent', 'Fair', 'Poor', 'Lost'] as const} value={call.quality} onChange={(v) => setQuality(v)} />
          <p>Network simulator. FaceTime adapts in real time: lowering resolution, switching to audio when video can’t keep up, and reconnecting on its own when the connection drops.</p>
        </div>
      </Sheet>
      <Sheet open={share} onClose={() => setShare(false)} title="SharePlay" detent="auto">
        <div className="ft-sharesheet" onClick={(e) => e.stopPropagation()}>
          {[
            { k: 'music' as const, icon: <Music size={22} />, label: 'Listen Together', sub: 'Music plays in sync for everyone' },
            { k: 'tv' as const, icon: <Tv size={22} />, label: 'Watch Together', sub: 'Start a show from the TV app' },
            { k: 'screen' as const, icon: <ScreenShare size={22} />, label: 'Share My Screen', sub: `${c?.first ?? 'They'} can see your screen` },
          ].map((o) => (
            <button
              key={o.k}
              className={call.shareplay === o.k ? 'on' : ''}
              onClick={() => {
                patch({ shareplay: o.k })
                if (o.k === 'music' && !np.playing) useOS.getState().togglePlay()
                setShare(false)
              }}
            >
              <span className="ft-share-ic">{o.icon}</span>
              <span className="grow"><b>{o.label}</b><span>{o.sub}</span></span>
              {call.shareplay === o.k && <Check size={18} color="var(--accent)" />}
            </button>
          ))}
        </div>
      </Sheet>
      </div>
    </div>
  )
}

/** Green pill to return to a minimized FaceTime call. */
export function FTPill() {
  const call = useFT((s) => s.call)
  const now = useNow(1000)
  if (!call || !call.minimized || call.phase === 'ended' || call.phase === 'incoming') return null
  const c = contactById(call.contactId)
  return (
    <button className="ft-pill anim-pop" onClick={() => useFT.getState().patch({ minimized: false })} aria-label="Return to FaceTime call">
      <Video size={14} fill="#fff" strokeWidth={0} /> {c?.first ?? ''} · {call.startedAt ? fmtDuration((now - call.startedAt) / 1000) : 'Calling…'}
    </button>
  )
}
