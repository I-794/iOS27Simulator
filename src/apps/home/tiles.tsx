import { useRef, useState } from 'react'
import { Power, Lock, LockOpen, Signal, Battery, Settings2, ChevronUp, ChevronDown } from 'lucide-react'
import { useOS } from '../../os/store'
import { useLongPress } from '../../os/hooks'
import { Sheet } from '../../ui/overlay'
import { BigSlider, Segmented, Switch } from '../../ui/controls'
import { List, Row } from '../../ui/list'
import { accIcon, accStatus, isActive, patchAcc, quickToggle, tint, type Acc } from './lib'

export function AccessoryTile({ a, onOpen, wide }: { a: Acc; onOpen: (a: Acc) => void; wide?: boolean }) {
  const on = isActive(a)
  const [pulse, setPulse] = useState(0)
  const lp = useLongPress(() => onOpen(a))
  const col = tint(a)
  return (
    <div
      className={`hm-tile ${on ? 'on' : ''} ${wide ? 'wide' : ''}`}
      style={{ ['--tint' as string]: col }}
      {...lp}
    >
      <button
        className="hm-tile-icon"
        aria-label={`${a.name} ${accStatus(a)}. Toggle`}
        onClick={() => {
          if (!quickToggle(a)) onOpen(a)
          setPulse((p) => p + 1)
        }}
      >
        <span key={pulse} className={pulse ? 'hm-pop' : ''}>{accIcon(a, 22)}</span>
      </button>
      <button className="hm-tile-text" onClick={() => onOpen(a)} aria-label={`${a.name} controls`}>
        <span className="hm-tile-name nowrap">{a.name}</span>
        <span className="hm-tile-status nowrap">{accStatus(a)}</span>
      </button>
    </div>
  )
}

const LIGHT_COLORS = ['#fff4e0', '#ffd28a', '#ffb05c', '#c8e4ff', '#8ec5ff', '#b56bff', '#ff6b9a', '#6bffb0']

export function AccessorySheet({ acc, onClose }: { acc: Acc | null; onClose: () => void }) {
  const live = useOS((s) => s.accessories.find((x) => x.id === acc?.id))
  const a = live ?? acc
  return (
    <Sheet open={!!acc} onClose={onClose} detent="large" title={a?.name} className="hm-sheet" label={a ? `${a.name} controls` : 'Accessory'}>
      {a && <Controls a={a} />}
    </Sheet>
  )
}

function Controls({ a }: { a: Acc }) {
  const [showSettings, setShowSettings] = useState(false)
  return (
    <div className="hm-ctl">
      <div className="hm-ctl-sub">{a.room} · {accStatus(a)}</div>
      {a.kind === 'light' && <LightControls a={a} />}
      {a.kind === 'thermostat' && <ThermostatDial a={a} />}
      {(a.kind === 'lock' || a.kind === 'garage') && <LockControls a={a} />}
      {a.kind === 'fan' && <FanControls a={a} />}
      {a.kind === 'blinds' && <BlindsControls a={a} />}
      {(a.kind === 'outlet' || a.kind === 'tv' || a.kind === 'speaker') && <PowerControls a={a} />}
      {a.kind === 'sensor' && <SensorControls a={a} />}
      <button className="hm-settings-btn" onClick={() => setShowSettings(!showSettings)}><Settings2 size={16} /> Accessory Settings {showSettings ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</button>
      {showSettings && (
        <List>
          <Row title="Room" detail={a.room} />
          <Row title="Include in Favorites" toggle={{ value: a.kind !== 'sensor', onChange: () => useOS.getState().showToast('Favorites updated') }} />
          <Row title="Connection" detail={a.thread ? 'Thread' : 'Wi-Fi'} icon={<Signal size={18} color="var(--label-secondary)" />} />
          <Row title="Status updates" detail="Instant (iOS 27)" />
          {a.battery !== undefined && <Row title="Battery" detail={`${a.battery}%`} icon={<Battery size={18} color="var(--label-secondary)" />} />}
          <Row title="Manufacturer" detail="Demo Home Co." />
          <Row title="Firmware" detail="3.2.1" />
          <Row title="Remove Accessory" destructive onClick={() => useOS.getState().showToast('Removing accessories is disabled in this demo')} />
        </List>
      )}
    </div>
  )
}

function LightControls({ a }: { a: Acc }) {
  const v = a.on ? (a.brightness ?? 100) / 100 : 0
  return (
    <>
      <div className="hm-big" style={{ ['--tint' as string]: a.color ?? '#ffd60a' }}>
        <BigSlider
          value={v}
          onChange={(x) => patchAcc(a.id, { brightness: Math.max(1, Math.round(x * 100)), on: x > 0.01 })}
          icon={accIcon(a, 30)}
          label={`${a.name} brightness`}
          width={130}
          height={320}
          radius={40}
          className="hm-bigslider"
        />
        <div className="hm-big-val">{a.on ? `${a.brightness}%` : 'Off'}</div>
      </div>
      <div className="hm-swatches" role="radiogroup" aria-label="Light color">
        {LIGHT_COLORS.map((c) => (
          <button key={c} role="radio" aria-checked={a.color === c} aria-label={`Color ${c}`} className={a.color === c ? 'on' : ''} style={{ background: c }} onClick={() => patchAcc(a.id, { color: c, on: true })} />
        ))}
      </div>
    </>
  )
}

function PowerControls({ a }: { a: Acc }) {
  return (
    <div className="hm-power-wrap">
      <button className={`hm-power ${a.on ? 'on' : ''}`} style={{ ['--tint' as string]: tint(a) }} onClick={() => patchAcc(a.id, { on: !a.on })} aria-label={a.on ? 'Turn off' : 'Turn on'}>
        <Power size={44} />
      </button>
      <div className="hm-big-val">{a.on ? 'On' : 'Off'}</div>
      {a.kind === 'tv' && a.on && (
        <div style={{ width: '100%' }}>
          <Segmented options={['Apple TV', 'HDMI 2', 'Game']} value={a.value && ['Apple TV', 'HDMI 2', 'Game'].includes(a.value) ? (a.value as 'Apple TV') : 'Apple TV'} onChange={(v) => patchAcc(a.id, { value: v })} />
        </div>
      )}
      {a.kind === 'outlet' && <div className="hm-note">Energy today: {a.on ? '0.42' : '0.18'} kWh</div>}
    </div>
  )
}

function LockControls({ a }: { a: Acc }) {
  const garage = a.kind === 'garage'
  const locked = garage ? a.value !== 'Open' && a.value !== 'Opening…' : !!a.locked
  const [busy, setBusy] = useState(false)
  return (
    <div className="hm-power-wrap">
      <button
        className={`hm-lock ${locked ? '' : 'open'} ${busy ? 'busy' : ''}`}
        onClick={() => {
          setBusy(true)
          window.setTimeout(() => setBusy(false), garage ? 1600 : 350)
          quickToggle(a)
        }}
        aria-label={locked ? (garage ? 'Open' : 'Unlock') : garage ? 'Close' : 'Lock'}
      >
        {locked ? <Lock size={46} /> : <LockOpen size={46} />}
      </button>
      <div className="hm-big-val">{garage ? a.value : locked ? 'Locked' : 'Unlocked'}</div>
      <div className="hm-note">{garage ? 'Tap to open or close' : `Tap to ${locked ? 'unlock' : 'lock'} · Home Key in Wallet`}{a.battery ? ` · Battery ${a.battery}%` : ''}</div>
    </div>
  )
}

function FanControls({ a }: { a: Acc }) {
  const speeds = ['Low', 'Medium', 'High'] as const
  return (
    <div className="hm-power-wrap">
      <button className={`hm-power ${a.on ? 'on' : ''}`} style={{ ['--tint' as string]: tint(a) }} onClick={() => patchAcc(a.id, { on: !a.on })} aria-label={a.on ? 'Turn off' : 'Turn on'}>{accIcon(a, 46)}</button>
      <div className="hm-big-val">{a.on ? a.value ?? 'Medium' : 'Off'}</div>
      <div style={{ width: '100%' }}><Segmented options={speeds} value={(speeds as readonly string[]).includes(a.value ?? '') ? (a.value as 'Low') : 'Medium'} onChange={(v) => patchAcc(a.id, { value: v, on: true })} /></div>
    </div>
  )
}

function BlindsControls({ a }: { a: Acc }) {
  const pct = parseInt(a.value ?? '0') || 0
  return (
    <div className="hm-big">
      <BigSlider value={pct / 100} onChange={(x) => patchAcc(a.id, { value: Math.round(x * 100) ? `${Math.round(x * 100)}% open` : 'Closed' })} icon={accIcon(a, 30)} label="Blinds position" width={130} height={320} radius={30} className="hm-bigslider blinds" />
      <div className="hm-big-val">{pct ? `${pct}% Open` : 'Closed'}</div>
    </div>
  )
}

function SensorControls({ a }: { a: Acc }) {
  return (
    <div className="hm-power-wrap">
      <div className={`hm-power ${a.value === 'Open' ? 'on' : ''}`} style={{ ['--tint' as string]: '#ff453a' }}>{accIcon(a, 44)}</div>
      <div className="hm-big-val">{a.value}</div>
      <div className="hm-note">Contact sensor · Battery {a.battery}% · Thread</div>
      <List style={{ width: '100%', margin: '12px 0 0' }}>
        <Row title="Opened" detail="Today 3:12 PM" />
        <Row title="Closed" detail="Today 3:14 PM" />
        <Row title="Notify when opened" toggle={{ value: true, onChange: () => useOS.getState().showToast('Notification preference saved') }} />
      </List>
    </div>
  )
}

// ---------------------------------------------------------------- thermostat dial
export function ThermostatDial({ a }: { a: Acc }) {
  const ref = useRef<SVGSVGElement>(null)
  const MIN = 50
  const MAX = 90
  const target = a.target ?? 70
  const mode = a.mode ?? 'auto'
  const frac = (target - MIN) / (MAX - MIN)
  const START = 135
  const SWEEP = 270
  const ang = ((START + SWEEP * frac) * Math.PI) / 180
  const R = 110
  const cx = 140
  const cy = 140
  const kx = cx + R * Math.cos(ang)
  const ky = cy + R * Math.sin(ang)
  const arc = (from: number, to: number) => {
    const a0 = (from * Math.PI) / 180
    const a1 = (to * Math.PI) / 180
    const large = to - from > 180 ? 1 : 0
    return `M ${cx + R * Math.cos(a0)} ${cy + R * Math.sin(a0)} A ${R} ${R} 0 ${large} 1 ${cx + R * Math.cos(a1)} ${cy + R * Math.sin(a1)}`
  }
  const col = mode === 'cool' ? '#0a84ff' : mode === 'heat' ? '#ff9f0a' : mode === 'off' ? '#8e8e93' : '#30d158'
  const setFromPointer = (clientX: number, clientY: number) => {
    const r = ref.current!.getBoundingClientRect()
    const s = r.width / 280
    const x = (clientX - r.left) / s - cx
    const y = (clientY - r.top) / s - cy
    let deg = (Math.atan2(y, x) * 180) / Math.PI
    if (deg < 0) deg += 360
    let rel = deg - START
    if (rel < 0) rel += 360
    if (rel > SWEEP) rel = rel > SWEEP + 45 ? 0 : SWEEP
    const t = Math.round(MIN + (rel / SWEEP) * (MAX - MIN))
    patchAcc(a.id, { target: t, mode: mode === 'off' ? 'auto' : mode })
  }
  return (
    <div className="hm-thermo">
      <svg
        ref={ref}
        viewBox="0 0 280 280"
        className="hm-dial"
        role="slider"
        aria-label="Target temperature"
        aria-valuemin={MIN}
        aria-valuemax={MAX}
        aria-valuenow={target}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'ArrowUp' || e.key === 'ArrowRight') patchAcc(a.id, { target: Math.min(MAX, target + 1) })
          if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') patchAcc(a.id, { target: Math.max(MIN, target - 1) })
        }}
        onPointerDown={(e) => {
          e.stopPropagation()
          setFromPointer(e.clientX, e.clientY)
          const move = (ev: PointerEvent) => setFromPointer(ev.clientX, ev.clientY)
          const up = () => {
            window.removeEventListener('pointermove', move)
            window.removeEventListener('pointerup', up)
          }
          window.addEventListener('pointermove', move)
          window.addEventListener('pointerup', up)
        }}
      >
        <path d={arc(START, START + SWEEP)} stroke="var(--fill)" strokeWidth="22" fill="none" strokeLinecap="round" />
        {Array.from({ length: 41 }).map((_, i) => {
          const d = ((START + (SWEEP * i) / 40) * Math.PI) / 180
          return <line key={i} x1={cx + 84 * Math.cos(d)} y1={cy + 84 * Math.sin(d)} x2={cx + (i % 5 ? 88 : 92) * Math.cos(d)} y2={cy + (i % 5 ? 88 : 92) * Math.sin(d)} stroke="var(--label-tertiary)" strokeWidth="1.5" />
        })}
        <path d={arc(START, START + SWEEP * frac + 0.01)} stroke={col} strokeWidth="22" fill="none" strokeLinecap="round" style={{ transition: 'stroke 0.3s' }} />
        <circle cx={kx} cy={ky} r="15" fill="#fff" stroke="rgb(0 0 0 / .12)" style={{ filter: 'drop-shadow(0 2px 4px rgb(0 0 0 / .25))' }} />
        <text x={cx} y={cy - 26} textAnchor="middle" fontSize="14" fill="var(--label-secondary)" fontWeight="600">{mode === 'off' ? 'OFF' : mode === 'heat' ? 'HEATING TO' : mode === 'cool' ? 'COOLING TO' : 'AUTO · TARGET'}</text>
        <text x={cx} y={cy + 28} textAnchor="middle" fontSize="64" fontWeight="300" fill="var(--label-primary)">{target}°</text>
        <text x={cx} y={cy + 56} textAnchor="middle" fontSize="14" fill="var(--label-secondary)">Currently {a.temp}° · Humidity 44%</text>
      </svg>
      <div className="hm-thermo-steps">
        <button onClick={() => patchAcc(a.id, { target: Math.max(MIN, target - 1) })} aria-label="Lower">−</button>
        <button onClick={() => patchAcc(a.id, { target: Math.min(MAX, target + 1) })} aria-label="Raise">+</button>
      </div>
      <Segmented options={['heat', 'cool', 'auto', 'off'] as const} labels={{ heat: 'Heat', cool: 'Cool', auto: 'Auto', off: 'Off' }} value={mode} onChange={(m) => patchAcc(a.id, { mode: m })} />
      <div className="hm-row-set">
        <span>Eco mode when away</span>
        <Switch checked label="Eco mode" onChange={() => useOS.getState().showToast('Eco mode setting saved')} />
      </div>
    </div>
  )
}
