import { useEffect, useRef, useState } from 'react'
import { Wifi, WifiOff, Bluetooth, Antenna, Link2, Globe2, Lock, Info, Check, Headphones, Gamepad2, Car, Speaker, Keyboard, Smartphone, Laptop, Tablet, BatteryCharging, Zap, Radio, ShieldCheck } from 'lucide-react'
import { List, Row } from '../../../ui/list'
import { Slider, Spinner, Segmented } from '../../../ui/controls'
import { Sheet, showAlert } from '../../../ui/overlay'
import { useNav } from '../../../ui/nav'
import { useOS } from '../../../os/store'
import { AppIconArt, ICONS } from '../../../icons/AppIconArt'
import type { AppId } from '../../../os/types'
import { XRow, ROUTES, HeroPage, Sub, Ico, ChoicePage, Push, usePrefs, usePref, Note, New27, os, setGames, setAirpods, useGo } from '../common'

// ------------------------------------------------------------------ Wi-Fi
const OTHER_NETWORKS = [
  { name: 'Birchwood-5G', secure: true, q: 0.7 },
  { name: 'NETGEAR-Guest', secure: false, q: 0.45 },
  { name: 'Park Family Printer', secure: true, q: 0.3 },
  { name: 'xfinity-demo', secure: false, q: 0.55 },
  { name: 'Chen House', secure: true, q: 0.4 },
]

function Bars({ q, size = 18 }: { q: number; size?: number }) {
  const level = q <= 0.05 ? 0 : Math.max(1, Math.round(q * 3))
  return (
    <svg width={size} height={size * 0.78} viewBox="0 0 18 14" aria-label={`Signal ${level} of 3`}>
      {[0, 1, 2].map((i) => {
        const r = 4.5 + i * 4.8
        const on = level > i
        return <path key={i} d={`M ${9 - r} ${13 - r * 0.62} Q 9 ${13 - r * 1.55} ${9 + r} ${13 - r * 0.62}`} fill="none" stroke="currentColor" strokeOpacity={on ? 1 : 0.25} strokeWidth={2.3} strokeLinecap="round" />
      })}
      <circle cx="9" cy="12.2" r="1.7" fill="currentColor" fillOpacity={level > 0 ? 1 : 0.25} />
    </svg>
  )
}

function WifiPage() {
  const net = useOS((s) => s.net)
  const known = usePrefs((s) => s.knownNetworks)
  const askToJoin = usePrefs((s) => s.askToJoin)
  const autoHotspot = usePrefs((s) => s.autoHotspot)
  const nav = useNav()
  const [joining, setJoining] = useState<string | null>(null)
  const [connecting, setConnecting] = useState<string | null>(null)
  const [scan, setScan] = useState(0)
  useEffect(() => {
    const t = window.setInterval(() => setScan((n) => n + 1), 4000)
    return () => window.clearInterval(t)
  }, [])

  const connect = (name: string) => {
    setConnecting(name)
    window.setTimeout(() => {
      setConnecting(null)
      os().setNet({ wifi: true, wifiNetwork: name, wifiQuality: 0.85, activePath: 'wifi', airplane: false })
      const k = usePrefs.getState().knownNetworks
      if (!k.includes(name)) usePrefs.getState().setP({ knownNetworks: [name, ...k] })
    }, 1300)
  }
  const tapNetwork = (name: string, secure: boolean) => {
    if (net.wifiNetwork === name && net.wifi) return nav.push(<NetworkInfo name={name} />)
    if (known.includes(name) || !secure) return connect(name)
    setJoining(name)
  }
  const myNets = known.filter((n) => n !== net.wifiNetwork)
  const others = OTHER_NETWORKS.filter((n) => !known.includes(n.name))

  return (
    <HeroPage title="Wi‑Fi" icon={<Ico c="#007aff" i={Wifi} size={60} />} blurb="Connect to Wi‑Fi, view available networks, and manage settings for joining networks and nearby hotspots.">
      <List>
        <Row title="Wi‑Fi" toggle={{ value: net.wifi, onChange: (v) => os().setNet({ wifi: v, airplane: v ? false : net.airplane, activePath: v ? 'wifi' : net.cellular ? 'cellular' : 'none' }) }} />
        {net.wifi && net.wifiNetwork && (
          <XRow
            title={<span className="row gap6"><Check size={18} strokeWidth={3} className="stg-check" />{net.wifiNetwork}</span>}
            trailing={<span className="row gap8 secondary"><Lock size={15} /><Bars q={net.wifiQuality} /><button className="stg-info" aria-label={`${net.wifiNetwork} info`} onClick={(e) => { e.stopPropagation(); nav.push(<NetworkInfo name={net.wifiNetwork} />) }}><Info size={22} /></button></span>}
            onClick={() => nav.push(<NetworkInfo name={net.wifiNetwork} />)}
          />
        )}
      </List>
      {net.wifi && (
        <>
          {myNets.length > 0 && (
            <List header="My Networks">
              {myNets.map((n) => (
                <Row key={n} title={n} onClick={() => tapNetwork(n, true)} trailing={connecting === n ? <Spinner size={18} /> : <span className="row gap8 secondary"><Lock size={15} /><Bars q={0.35 + ((n.length * 7) % 5) / 10} /></span>} />
              ))}
            </List>
          )}
          <List header={<span className="row gap8">Other Networks <Spinner key={scan} size={13} /></span>}>
            {others.map((n) => (
              <Row key={n.name} title={n.name} onClick={() => tapNetwork(n.name, n.secure)} trailing={connecting === n.name ? <Spinner size={18} /> : <span className="row gap8 secondary">{n.secure && <Lock size={15} />}<Bars q={n.q} /></span>} />
            ))}
            <Row title="Other…" onClick={() => setJoining('')} />
          </List>
        </>
      )}
      <List footer="Known networks will be joined automatically. If no known networks are available, you will be notified of available networks.">
        <Push title="Ask to Join Networks" detail={askToJoin} page={() => <ChoicePage title="Ask to Join Networks" options={['Off', 'Notify', 'Ask'] as const} use={() => usePref('askToJoin')} />} />
      </List>
      <List footer="Allow this device to automatically discover nearby personal hotspots when no Wi‑Fi network is available.">
        <Push title="Auto-Join Hotspot" detail={autoHotspot} page={() => <ChoicePage title="Auto-Join Hotspot" options={['Never', 'Ask to Join', 'Automatic'] as const} use={() => usePref('autoHotspot')} />} />
      </List>
      <JoinSheet name={joining} onClose={() => setJoining(null)} onJoin={(n) => { setJoining(null); connect(n) }} />
    </HeroPage>
  )
}

/** Password entry for a network. The typed value lives only in this component and is discarded. */
function JoinSheet({ name, onClose, onJoin }: { name: string | null; onClose: () => void; onJoin: (n: string) => void }) {
  const [pw, setPw] = useState('')
  const [other, setOther] = useState('')
  const [show, setShow] = useState(false)
  useEffect(() => {
    setPw('')
    setOther('')
    setShow(false)
  }, [name])
  const target = name || other
  const ok = target.trim().length > 0 && pw.length >= 8
  return (
    <Sheet open={name !== null} onClose={() => { setPw(''); onClose() }} detent="large" title={name ? `Enter the password for “${name}”` : 'Other Network'} trailing={<button className="bar-btn prominent" disabled={!ok} style={{ opacity: ok ? 1 : 0.4 }} onClick={() => { setPw(''); onJoin(target) }}>Join</button>}>
      <div style={{ height: 8 }} />
      <List footer="Simulator demo: the password you type is never saved or sent anywhere. Any 8+ characters will join.">
        {name === '' && (
          <Row title="Name" trailing={<input className="text-input stg-field" value={other} onChange={(e) => setOther(e.target.value)} placeholder="Network Name" aria-label="Network Name" />} />
        )}
        <Row
          title="Password"
          trailing={
            <span className="row gap8" style={{ flex: 1, justifyContent: 'flex-end' }}>
              <input className="text-input stg-field" type={show ? 'text' : 'password'} autoComplete="off" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Required" aria-label="Wi‑Fi password" enterKeyHint="go" onKeyDown={(e) => e.key === 'Enter' && ok && onJoin(target)} />
              <button className="stg-link" onClick={() => setShow(!show)}>{show ? 'Hide' : 'Show'}</button>
            </span>
          }
        />
      </List>
      <List footer="You can also access this Wi‑Fi network by bringing your iPhone near any iPhone, iPad or Mac that has connected to this network and has you in their contacts.">
        <Row title={<span className="row gap8"><Link2 size={18} /> Password Sharing</span>} detail="Nearby" />
      </List>
    </Sheet>
  )
}

function NetworkInfo({ name }: { name: string }) {
  const nav = useNav()
  const net = useOS((s) => s.net)
  const [autoJoin, setAutoJoin] = useState(true)
  const [lowData, setLowData] = useState(false)
  const [priv, setPriv] = useState<'Off' | 'Fixed' | 'Rotating'>('Fixed')
  const connected = net.wifi && net.wifiNetwork === name
  return (
    <Sub title={name}>
      <List>
        <Row
          tint
          title="Forget This Network"
          onClick={() =>
            showAlert({
              title: `Forget Wi‑Fi Network “${name}”?`,
              message: 'Your iPhone and other devices using iCloud Keychain will no longer join this Wi‑Fi network.',
              actions: [
                { label: 'Cancel', style: 'cancel' },
                {
                  label: 'Forget',
                  style: 'destructive',
                  onPress: () => {
                    usePrefs.getState().setP({ knownNetworks: usePrefs.getState().knownNetworks.filter((n) => n !== name) })
                    if (connected) os().setNet({ wifiNetwork: '', activePath: net.cellular ? 'cellular' : 'none' })
                    nav.pop()
                  },
                },
              ],
            })
          }
        />
      </List>
      <List>
        <Row title="Auto-Join" toggle={{ value: autoJoin, onChange: setAutoJoin }} />
        <Row title="Password" detail="•••••••••••" />
      </List>
      <List footer="Low Data Mode helps apps on your iPhone reduce their network data use when connected to this network.">
        <Row title="Low Data Mode" toggle={{ value: lowData, onChange: setLowData }} />
      </List>
      <List header="Private Wi‑Fi Address" footer="Using a private address helps reduce tracking of your iPhone across different Wi‑Fi networks.">
        <div className="stg-pad"><Segmented options={['Off', 'Fixed', 'Rotating'] as const} value={priv} onChange={setPriv} /></div>
        <Row title="Wi‑Fi Address" detail={priv === 'Off' ? 'A4:83:E7:1F:22:0C' : priv === 'Fixed' ? '5E:21:9A:C4:07:B3' : '7A:10:3F:88:2D:61'} />
      </List>
      {connected && (
        <List header="IPv4 Address">
          <Row title="Configure IP" detail="Automatic" />
          <Row title="IP Address" detail="192.168.1.42" />
          <Row title="Subnet Mask" detail="255.255.255.0" />
          <Row title="Router" detail="192.168.1.1" />
          <Row title="Signal" detail={`${Math.round(net.wifiQuality * 100)}%`} />
        </List>
      )}
    </Sub>
  )
}

// ------------------------------------------------------------------ Bluetooth
interface BtDevice { id: string; name: string; kind: 'airpods' | 'controller' | 'car' | 'speaker' | 'keyboard'; controller?: string }
const BT_DEVICES: BtDevice[] = [
  { id: 'airpods', name: 'Jamie’s AirPods Pro 3', kind: 'airpods' },
  { id: 'dualsense', name: 'DualSense Wireless Controller', kind: 'controller', controller: 'DualSense' },
  { id: 'access', name: 'Access Controller', kind: 'controller', controller: 'PlayStation Access' },
  { id: 'xbox', name: 'Xbox Wireless Controller', kind: 'controller', controller: 'Xbox Wireless' },
  { id: 'car', name: 'Dad’s Car', kind: 'car' },
]
const BT_NEARBY: BtDevice[] = [
  { id: 'pill', name: 'Pulse Pill Speaker', kind: 'speaker' },
  { id: 'kbd', name: 'Magic Keyboard (Demo)', kind: 'keyboard' },
]
const btIcon = (k: BtDevice['kind']) => ({ airpods: Headphones, controller: Gamepad2, car: Car, speaker: Speaker, keyboard: Keyboard })[k]

function BluetoothPage() {
  const net = useOS((s) => s.net)
  const airpods = useOS((s) => s.airpods)
  const games = useOS((s) => s.games)
  const power = usePrefs((s) => s.btPowerMgmt)
  const [paired, setPaired] = useState<string[]>([])
  const [busy, setBusy] = useState<string | null>(null)
  const [carOn, setCarOn] = useState(false)
  const go = useGo()

  const connected = (d: BtDevice) => (d.kind === 'airpods' ? airpods.connected : d.kind === 'controller' ? games.controller === d.controller : d.kind === 'car' ? carOn : paired.includes(d.id))
  const toggle = (d: BtDevice) => {
    if (!net.bluetooth) return
    setBusy(d.id)
    window.setTimeout(() => {
      setBusy(null)
      const on = !connected(d)
      if (d.kind === 'airpods') {
        setAirpods({ connected: on })
        if (on) os().flashIsland({ kind: 'airpods', title: 'AirPods Pro 3', subtitle: 'Connected', duration: 2200 })
      } else if (d.kind === 'controller') setGames({ controller: on ? d.controller! : null })
      else if (d.kind === 'car') setCarOn(on)
      else setPaired((p) => (on ? [...p, d.id] : p.filter((x) => x !== d.id)))
    }, 900)
  }
  const Dev = ({ d }: { d: BtDevice }) => {
    const I = btIcon(d.kind)
    const c = connected(d)
    return (
      <XRow
        icon={<span className="stg-dev-ico"><I size={18} /></span>}
        title={d.name}
        onClick={() => toggle(d)}
        trailing={
          <span className="row gap8">
            {busy === d.id ? <Spinner size={16} /> : <span className="secondary">{c ? 'Connected' : 'Not Connected'}</span>}
            {(d.kind === 'airpods' || d.kind === 'controller') && (
              <button className="stg-info" aria-label={`${d.name} info`} onClick={(e) => { e.stopPropagation(); go(d.kind === 'airpods' ? 'airpods' : 'games') }}><Info size={22} /></button>
            )}
          </span>
        }
      />
    )
  }

  return (
    <HeroPage title="Bluetooth" icon={<Ico c="#007aff" i={Bluetooth} size={60} />} blurb="Connect to accessories you can use for activities such as streaming music, typing, and gaming.">
      <List footer={net.bluetooth ? 'This iPhone is discoverable as “Jamie’s iPhone” while Bluetooth Settings is open.' : undefined}>
        <Row title="Bluetooth" toggle={{ value: net.bluetooth, onChange: (v) => { os().setNet({ bluetooth: v }); if (!v) { setAirpods({ connected: false }); setGames({ controller: null }) } } }} />
      </List>
      {net.bluetooth && (
        <>
          <List header="My Devices">
            {BT_DEVICES.map((d) => <Dev key={d.id} d={d} />)}
            {BT_NEARBY.filter((d) => paired.includes(d.id)).map((d) => <Dev key={d.id} d={d} />)}
          </List>
          <List header={<span className="row gap8">Other Devices <Spinner size={13} /></span>} footer="To pair an Apple Watch with your iPhone, go to the Apple Watch app.">
            {BT_NEARBY.filter((d) => !paired.includes(d.id)).map((d) => {
              const I = btIcon(d.kind)
              return <Row key={d.id} icon={<span className="stg-dev-ico"><I size={18} /></span>} title={d.name} onClick={() => toggle(d)} trailing={busy === d.id ? <Spinner size={16} /> : undefined} />
            })}
          </List>
        </>
      )}
      <List header={<span className="row gap6">Power Management <New27 /></span>} footer="iOS 27 schedules Bluetooth radio activity around what your accessories actually need — idle controllers and speakers sleep sooner and AirPods use low-energy audio links when possible.">
        <Row icon={<Ico c="#34c759" i={BatteryCharging} />} title="Improved Power Management" toggle={{ value: power, onChange: (v) => usePrefs.getState().setP({ btPowerMgmt: v }) }} />
        <Row icon={<Ico c="#ff9500" i={Zap} />} title="Estimated Savings Today" detail={power ? '≈ 38 min' : '—'} />
      </List>
    </HeroPage>
  )
}

// ------------------------------------------------------------------ Cellular + Connectivity Assist
const DATA_APPS: { app: AppId; gb: number }[] = [
  { app: 'music', gb: 3.2 }, { app: 'safari', gb: 2.1 }, { app: 'messages', gb: 1.4 }, { app: 'maps', gb: 0.9 }, { app: 'facetime', gb: 0.8 },
  { app: 'photos', gb: 0.6 }, { app: 'podcasts', gb: 0.5 }, { app: 'news', gb: 0.3 }, { app: 'mail', gb: 0.2 }, { app: 'weather', gb: 0.05 },
]

function CellularPage() {
  const net = useOS((s) => s.net)
  const perms = useOS((s) => s.permissions)
  const dataMode = usePrefs((s) => s.dataMode)
  const voiceData = usePrefs((s) => s.voiceData)
  const roaming = usePrefs((s) => s.dataRoaming)
  const allowed = (a: AppId) => perms[a]?.cellular !== false
  const setAllowed = (a: AppId, v: boolean) => os().set({ permissions: { ...perms, [a]: { ...(perms[a] ?? {}), cellular: v } } })
  return (
    <HeroPage title="Cellular" icon={<Ico c="#34c759" i={Antenna} size={60} />} blurb="Manage your cellular plan, data usage, and how iPhone moves between Wi‑Fi and cellular.">
      <List>
        <Row title="Cellular Data" toggle={{ value: net.cellular && !net.airplane, onChange: (v) => os().setNet({ cellular: v, airplane: false, activePath: v ? (net.wifi ? 'wifi' : 'cellular') : net.wifi ? 'wifi' : 'none' }) }} />
        <Push
          title="Cellular Data Options"
          detail={roaming ? 'Roaming On' : 'Roaming Off'}
          page={() => <DataOptions />}
        />
        <Push title="Personal Hotspot" detail={net.hotspot ? 'On' : 'Off'} page={() => ROUTES['hotspot'].el()} />
      </List>
      <List header="Maple Mobile · Primary">
        <Row title="Network" detail={`${net.cellularType} · ${['No Signal', 'Poor', 'Fair', 'Good', 'Excellent'][net.cellularSignal]}`} />
        <Push title="Voice & Data" detail={voiceData} page={() => <ChoicePage title="Voice & Data" options={['5G Auto', '5G On', 'LTE'] as const} use={() => usePref('voiceData')} footer="5G Auto: Use 5G only when it won’t significantly reduce battery life." />} />
        <Push title="Data Mode" detail={dataMode} page={() => <ChoicePage title="Data Mode" options={['Allow More Data on 5G', 'Standard', 'Low Data Mode'] as const} use={() => usePref('dataMode')} />} />
        <Row title="Phone Number" detail="(555) 010-4417" />
      </List>
      <ConnectivityAssist />
      <List header="Cellular Data" footer="Turn off cellular data to restrict apps to Wi‑Fi. When turned off, those apps won’t use cellular data.">
        <Row title="Current Period" detail="10.1 GB" />
        <Row title="Current Period Roaming" detail="0 bytes" />
        {DATA_APPS.map((d) => (
          <Row key={d.app} icon={<AppIconArt app={d.app} size={30} />} title={ICONS[d.app].name} subtitle={`${d.gb >= 1 ? `${d.gb} GB` : `${Math.round(d.gb * 1000)} MB`}`} toggle={{ value: allowed(d.app), onChange: (v) => setAllowed(d.app, v) }} />
        ))}
      </List>
    </HeroPage>
  )
}

function DataOptions() {
  const roaming = usePrefs((s) => s.dataRoaming)
  return (
    <Sub title="Cellular Data Options">
      <List footer="Turn off Data Roaming to avoid charges when traveling outside your carrier’s network.">
        <Row title="Data Roaming" toggle={{ value: roaming, onChange: (v) => usePrefs.getState().setP({ dataRoaming: v }) }} />
      </List>
    </Sub>
  )
}

/** iOS 27 Connectivity Assist: drag Wi‑Fi quality down and watch traffic hand off to cellular. */
function ConnectivityAssist() {
  const net = useOS((s) => s.net)
  const [log, setLog] = useState<string[]>([])
  const prevPath = useRef(net.activePath)
  const [stream, setStream] = useState(0)

  useEffect(() => {
    if (prevPath.current !== net.activePath) {
      const msg = net.activePath === 'cellular' ? `Handed off to ${net.cellularType} — call stayed connected` : net.activePath === 'wifi' ? `Back on Wi‑Fi (${net.wifiNetwork || 'Wi‑Fi'})` : 'Connection dropped'
      setLog((l) => [msg, ...l].slice(0, 4))
      prevPath.current = net.activePath
    }
  }, [net.activePath, net.cellularType, net.wifiNetwork])

  // a pretend audio stream that stalls when there is no working path
  useEffect(() => {
    const t = window.setInterval(() => setStream((s) => s + (net.activePath === 'none' ? 0 : 1)), 120)
    return () => window.clearInterval(t)
  }, [net.activePath])

  const setQuality = (q: number) => {
    const st = os()
    let path = st.net.activePath
    if (!st.net.wifi || st.net.airplane) path = st.net.cellular && !st.net.airplane ? 'cellular' : 'none'
    else if (q < 0.3) path = st.net.connectivityAssist && st.net.cellular ? 'cellular' : q < 0.12 ? 'none' : 'wifi'
    else if (q > 0.38) path = 'wifi'
    if (path === 'cellular' && st.net.activePath !== 'cellular') st.flashIsland({ kind: 'network', title: `Switched to ${st.net.cellularType}`, subtitle: 'Connectivity Assist', duration: 1800 })
    st.setNet({ wifiQuality: q, activePath: path })
  }

  const stalled = net.activePath === 'none'
  const onCell = net.activePath === 'cellular'
  const weak = net.wifiQuality < 0.3
  return (
    <>
      <List header={<span className="row gap6">Connectivity Assist <New27 /></span>} footer="When Wi‑Fi becomes unreliable, iPhone moves calls, FaceTime, streams and downloads to cellular before they drop — then moves them back when Wi‑Fi recovers.">
        <Row icon={<Ico c="#34c759" i={Radio} />} title="Connectivity Assist" toggle={{ value: net.connectivityAssist, onChange: (v) => { os().setNet({ connectivityAssist: v }); setQuality(os().net.wifiQuality) } }} />
      </List>
      <List header="Try It" footer="Drag the Wi‑Fi quality slider down to simulate walking away from your router.">
        <div className="stg-ca">
          <div className="stg-ca-diagram">
            <div className={`stg-ca-node ${net.activePath === 'wifi' ? 'on' : ''} ${weak && net.activePath === 'wifi' ? 'weak' : ''}`}>
              <Wifi size={22} />
              <span>{net.wifiNetwork || 'Wi‑Fi'}</span>
            </div>
            <div className="stg-ca-phone">
              <Smartphone size={30} />
              <div className={`stg-ca-link wifi ${net.activePath === 'wifi' ? 'active' : ''} ${weak ? 'weak' : ''}`}><i /><i /><i /></div>
              <div className={`stg-ca-link cell ${onCell ? 'active' : ''}`}><i /><i /><i /></div>
            </div>
            <div className={`stg-ca-node ${onCell ? 'on cell' : ''}`}>
              <Antenna size={22} />
              <span>{net.cellularType}</span>
            </div>
          </div>
          <div className={`stg-ca-status ${stalled ? 'bad' : onCell ? 'cell' : 'ok'}`}>
            {stalled ? <WifiOff size={16} /> : <ShieldCheck size={16} />}
            {stalled ? 'Stalled — waiting for Wi‑Fi to recover' : onCell ? `Using ${net.cellularType} · FaceTime Audio still connected` : weak ? 'Wi‑Fi is weak — holding on' : 'Using Wi‑Fi'}
          </div>
          <div className="stg-ca-stream" aria-label="Simulated FaceTime Audio stream">
            <span className="secondary">FaceTime Audio · Alex</span>
            <div className="stg-ca-wave">
              {Array.from({ length: 28 }).map((_, i) => (
                <b key={i} style={{ height: stalled ? 3 : 4 + Math.abs(Math.sin((stream + i * 3) / 3.1)) * 16, opacity: stalled ? 0.3 : 1 }} />
              ))}
            </div>
            <span className="stg-ca-time">{stalled ? 'Reconnecting…' : `${Math.floor(stream / 500)}:${String(Math.floor(stream / 8.3) % 60).padStart(2, '0')}`}</span>
          </div>
          <div className="stg-ca-slider">
            <span className="t-footnote secondary">Wi‑Fi Quality</span>
            <Slider value={net.wifiQuality} onChange={setQuality} label="Wi‑Fi quality" left={<WifiOff size={16} />} right={<Wifi size={16} />} />
          </div>
          {log.length > 0 && (
            <div className="stg-ca-log">
              {log.map((l, i) => <div key={i} className={i === 0 ? 'anim-up' : ''}>{l}</div>)}
            </div>
          )}
        </div>
      </List>
    </>
  )
}

// ------------------------------------------------------------------ Personal Hotspot
function HotspotPage() {
  const net = useOS((s) => s.net)
  const family = usePrefs((s) => s.hotspotFamily)
  const max = usePrefs((s) => s.hotspotMax)
  const [guests, setGuests] = useState<string[]>([])
  const [reveal, setReveal] = useState(false)
  useEffect(() => {
    if (!net.hotspot) return setGuests([])
    const t = window.setTimeout(() => setGuests(['Jamie’s iPad']), 2600)
    return () => window.clearTimeout(t)
  }, [net.hotspot])
  return (
    <HeroPage title="Personal Hotspot" icon={<Ico c="#34c759" i={Link2} size={60} />} blurb="Share your cellular internet connection with other devices, even when you’re not connected to Wi‑Fi.">
      <List footer="Allow other users or devices not signed into iCloud to look for your shared network “Jamie’s iPhone” when you are in Personal Hotspot settings or when you turn it on in Control Center.">
        <Row title="Allow Others to Join" toggle={{ value: net.hotspot, onChange: (v) => { os().setNet({ hotspot: v }); if (v) os().flashIsland({ kind: 'hotspot', title: 'Personal Hotspot', subtitle: 'On', duration: 1800 }) } }} />
        <Row title="Wi‑Fi Password" detail={reveal ? 'demo-hotspot-4417' : '••••••••••••'} onClick={() => setReveal(!reveal)} />
      </List>
      {net.hotspot && (
        <List header="Connections">
          {guests.length === 0 ? <Row title={<span className="row gap8 secondary"><Spinner size={14} /> Waiting for devices…</span>} /> : guests.map((g) => <Row key={g} icon={<span className="stg-dev-ico"><Tablet size={18} /></span>} title={g} detail="Connected" />)}
        </List>
      )}
      <List footer="Allow family members to join your hotspot automatically without entering the password.">
        <Row title="Family Sharing" toggle={{ value: family, onChange: (v) => usePrefs.getState().setP({ hotspotFamily: v }) }} />
      </List>
      <List footer="Internet performance may be reduced for devices connected to your hotspot when turned on.">
        <Row title="Maximize Compatibility" toggle={{ value: max, onChange: (v) => usePrefs.getState().setP({ hotspotMax: v }) }} />
      </List>
      <List header="To Connect Using USB or Bluetooth">
        <Row icon={<span className="stg-dev-ico"><Laptop size={18} /></span>} title="Plug in your computer, or pair it with iPhone over Bluetooth." compact />
      </List>
    </HeroPage>
  )
}

// ------------------------------------------------------------------ VPN
function VpnPage() {
  const net = useOS((s) => s.net)
  const config = usePrefs((s) => s.vpnConfig)
  const [status, setStatus] = useState<'idle' | 'connecting' | 'disconnecting'>('idle')
  const flip = (v: boolean) => {
    setStatus(v ? 'connecting' : 'disconnecting')
    window.setTimeout(() => {
      os().setNet({ vpn: v })
      setStatus('idle')
    }, 1100)
  }
  const label = status === 'connecting' ? 'Connecting…' : status === 'disconnecting' ? 'Disconnecting…' : net.vpn ? 'Connected' : 'Not Connected'
  return (
    <HeroPage title="VPN" icon={<Ico c="#0a5fd6" i={Globe2} size={60} />} blurb="A VPN routes your traffic through a private network. These demo configurations don’t send real traffic anywhere.">
      <List header="VPN Configurations">
        <Row title="Status" trailing={<span className="row gap8"><span className="secondary">{label}</span>{status !== 'idle' && <Spinner size={14} />}</span>} toggle={{ value: status === 'connecting' ? true : status === 'disconnecting' ? false : net.vpn, onChange: flip }} />
        {(['ParkNet Home', 'School Relay (Demo)'] as const).map((c) => (
          <Row key={c} title={c} subtitle="IKEv2 · Demo" onClick={() => usePrefs.getState().setP({ vpnConfig: c })} trailing={c === config ? <Check size={20} strokeWidth={2.6} className="stg-check" /> : <span style={{ width: 20 }} />} />
        ))}
      </List>
      {net.vpn && (
        <List header="Connection">
          <Row title="Server" detail={config === 'ParkNet Home' ? 'home.parknet.example' : 'relay.lincoln.example'} />
          <Row title="Assigned IP" detail="10.8.0.14" />
          <Row title="Connect Time" detail="Just now" />
        </List>
      )}
      <Note>VPN icons appear in the status bar and Control Center while connected.</Note>
    </HeroPage>
  )
}

export function registerConnectivity() {
  Object.assign(ROUTES, {
    wifi: { title: 'Wi‑Fi', el: () => <WifiPage />, keywords: 'wifi network internet wireless parknet join password ask to join hotspot' },
    bluetooth: { title: 'Bluetooth', el: () => <BluetoothPage />, keywords: 'bluetooth airpods controller pair power management' },
    cellular: { title: 'Cellular', el: () => <CellularPage />, keywords: 'cellular mobile data 5g roaming connectivity assist handoff usage' },
    hotspot: { title: 'Personal Hotspot', el: () => <HotspotPage />, keywords: 'hotspot tethering share internet family' },
    vpn: { title: 'VPN', el: () => <VpnPage />, keywords: 'vpn private network' },
  })
}
