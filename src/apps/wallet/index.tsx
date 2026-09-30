import { useEffect, useMemo, useRef, useState } from 'react'
import { Plus, Ellipsis, Package, ChevronRight, Check, CarFront, Lock, LockOpen, Fan, Send, ArrowDownLeft, CreditCard, Star, Plane, Ticket, IdCard, Train, Wallet as WalletIcon, Nfc, ScanFace, Info, Repeat, Sparkles, Bell } from 'lucide-react'
import { NavStack, Page, useNav, BarButton } from '../../ui/nav'
import { List, Row } from '../../ui/list'
import { Sheet, openMenu, showAlert } from '../../ui/overlay'
import { Button, Avatar } from '../../ui/controls'
import { useOS } from '../../os/store'
import { useAppRoute, useOnscreen } from '../../os/hooks'
import { ORDERS } from '../../os/data/world'
import { fmtRelative, fmtTime } from '../../os/time'
import type { WalletCard } from '../../os/types'
import { TXNS, CAR_KEY, MERCHANT, fmtMoney, type Txn } from './data'
import './wallet.css'

const PAYMENT = ['cash', 'debit', 'credit']
const cardOrder = (c: WalletCard) => ['cash', 'debit', 'credit', 'transit', 'key', 'ticket', 'id', 'loyalty', 'pass'].indexOf(c.kind)

function useCards(): WalletCard[] {
  const cards = useOS((s) => s.walletCards)
  return useMemo(() => [...cards].sort((a, b) => cardOrder(a) - cardOrder(b)), [cards])
}

// ---------------------------------------------------------------- local ledger (demo payments made in this session)
let extraTxns: Record<string, Txn[]> = {}
const txnsFor = (id: string) => [...(extraTxns[id] ?? []), ...(TXNS[id] ?? [])]

type NavApi = ReturnType<typeof useNav>

export default function WalletApp() {
  const [selected, setSelected] = useState<string | null>(null)
  const [pay, setPay] = useState(false)
  const [carKey, setCarKey] = useState(false)
  const navRef = useRef<NavApi | null>(null)
  useAppRoute('wallet', (r) => {
    if (r === 'pay') setPay(true)
    else if (r.startsWith('card/')) { navRef.current?.popToRoot(); setSelected(r.slice(5)) }
    else if (r === 'carkey') setCarKey(true)
    else if (r === 'orders') navRef.current?.push(<OrdersPage />)
  })
  return (
    <div className="app-root wl-root">
      <NavStack root={<Root selected={selected} setSelected={setSelected} onPay={() => setPay(true)} onCarKey={() => setCarKey(true)} navRef={navRef} />} />
      <PaySheet open={pay} onClose={() => setPay(false)} />
      <CarKeySheet open={carKey} onClose={() => setCarKey(false)} />
    </div>
  )
}

// ---------------------------------------------------------------- card face
export function CardFace({ c, small }: { c: WalletCard; small?: boolean }) {
  const icon = c.kind === 'ticket' ? (c.name.includes('Boarding') ? <Plane size={16} /> : <Ticket size={16} />) : c.kind === 'id' ? <IdCard size={16} /> : c.kind === 'transit' ? <Train size={16} /> : c.kind === 'loyalty' ? <Star size={16} /> : c.kind === 'key' ? <CarFront size={16} /> : null
  return (
    <div className={`wl-face kind-${c.kind} ${small ? 'small' : ''}`} style={{ background: c.gradient, color: c.textColor ?? '#fff' }}>
      <div className="wl-face-top">
        <span className="wl-face-issuer">{icon}{c.kind === 'cash' ? <b className="wl-cash-logo"> Cash</b> : c.issuer}</span>
        {c.balance && c.kind !== 'credit' && <span className="wl-face-bal">{c.balance}</span>}
        {c.kind === 'ticket' && c.details?.Flight && <span className="wl-face-bal">{c.details.Flight}</span>}
      </div>
      {c.kind === 'ticket' && c.details?.From && (
        <div className="wl-face-route"><span>{c.details.From}</span><Plane size={18} /><span>{c.details.To}</span></div>
      )}
      <div className="wl-face-bottom">
        <span className="wl-face-name">{c.name}</span>
        {c.last4 && <span className="wl-face-num">•••• {c.last4}</span>}
        {(c.kind === 'credit' || c.kind === 'debit') && <span className="wl-face-net">{c.kind === 'credit' ? 'NORTHSTAR' : 'MAPLE CU'}</span>}
      </div>
      {(c.kind === 'credit' || c.kind === 'debit') && <span className="wl-chip" />}
      <span className="wl-sheen" />
    </div>
  )
}

// ---------------------------------------------------------------- root with 3D stack
function Root({ selected, setSelected, onPay, onCarKey, navRef }: { selected: string | null; setSelected: (id: string | null) => void; onPay: () => void; onCarKey: () => void; navRef: React.MutableRefObject<NavApi | null> }) {
  const nav = useNav()
  navRef.current = nav
  const cards = useCards()
  const carKeySetup = useOS((s) => s.carKeySetup)
  const sel = cards.find((c) => c.id === selected)
  const PEEK = 58
  const CARD_H = 228
  useOnscreen('wallet', sel ? `Wallet — ${sel.name}` : 'Wallet', sel ? { type: 'page', title: sel.name, text: `${sel.issuer} ${sel.balance ?? ''}`, url: `wallet/${sel.id}` } : undefined)
  useEffect(() => {
    const onBack = (e: Event) => {
      if (!selected || e.defaultPrevented) return
      e.preventDefault()
      setSelected(null)
    }
    window.addEventListener('ios-back', onBack)
    return () => window.removeEventListener('ios-back', onBack)
  }, [selected, setSelected])
  return (
    <Page
      title="Wallet"
      large={!sel}
      inlineTitle={sel ? '' : 'Wallet'}
      bottomExtra={sel ? 90 : 20}
      leading={sel ? <BarButton label="Done" onClick={() => setSelected(null)}>Done</BarButton> : undefined}
      trailing={sel ? <BarButton label="More" onClick={() => showAlert({ title: sel.name, message: 'Card options', actions: [{ label: 'Card Details', onPress: () => nav.push(<CardInfo c={sel} />) }, { label: 'Cancel', style: 'cancel' }] })}><Ellipsis size={20} /></BarButton> : <>
        <BarButton label="Pay" onClick={onPay}><Nfc size={21} /></BarButton>
        <button className="bar-btn icon glass interactive" aria-label="Add" onClick={(e) => openMenu(e.currentTarget, [
          { label: 'Debit or Credit Card', icon: <CreditCard size={18} />, onSelect: () => useOS.getState().showToast('Card scanning isn’t available in the demo') },
          { label: 'Transit Card', icon: <Train size={18} />, onSelect: () => useOS.getState().showToast('Metro Transit card is already in Wallet') },
          { label: 'Car Key', icon: <CarFront size={18} />, onSelect: onCarKey },
          { label: 'Orders', icon: <Package size={18} />, separatorBefore: true, onSelect: () => nav.push(<OrdersPage />) },
          { label: 'Manage Cards', icon: <Repeat size={18} />, onSelect: () => nav.push(<ManageCards />) },
        ])}><Plus size={22} /></button>
      </>}
    >
      {!sel && carKeySetup === 'offered' && (
        <button className="wl-banner anim-up" onClick={onCarKey}>
          <span className="wl-banner-ic"><CarFront size={22} /></span>
          <span className="grow" style={{ textAlign: 'left' }}>
            <b>Add your car key</b>
            <span>Your 2026 Demo Motors Aria EV supports car keys in Wallet.</span>
          </span>
          <span className="wl-banner-add">Add</span>
        </button>
      )}
      <div className={`wl-stack ${sel ? 'has-sel' : ''}`} style={{ height: sel ? CARD_H + 10 : (cards.length - 1) * PEEK + CARD_H + 10 }}>
        {cards.map((c, i) => {
          const isSel = c.id === selected
          const y = sel ? (isSel ? 0 : 900 + i * 8) : i * PEEK
          return (
            <button
              key={c.id}
              className={`wl-card ${isSel ? 'sel' : ''} ${sel && !isSel ? 'away' : ''}`}
              style={{ transform: `translateY(${y}px) ${sel && !isSel ? 'scale(0.92)' : ''}`, zIndex: i + 1, transitionDelay: sel && !isSel ? `${i * 18}ms` : '0ms' }}
              onClick={() => setSelected(isSel ? null : c.id)}
              aria-label={`${c.name}${isSel ? ', selected' : ''}`}
              aria-expanded={isSel}
            >
              <CardFace c={c} />
            </button>
          )
        })}
      </div>
      {sel ? (
        <div className="wl-detail" key={sel.id}>
          <CardDetail c={sel} onPay={onPay} />
        </div>
      ) : (
        <>
          <List>
            <Row title="Orders" subtitle={`${ORDERS.filter((o) => o.progress < 1).length} in progress · ${ORDERS[0].merchant} ${ORDERS[0].eta.toLowerCase()}`} icon={<span className="wl-row-ic" style={{ background: '#ff9f0a' }}><Package size={17} /></span>} chevron onClick={() => nav.push(<OrdersPage />)} />
            <Row title="Try Apple Pay" subtitle="Demo checkout at Brew Lab Coffee" icon={<span className="wl-row-ic" style={{ background: '#000' }}><Nfc size={17} /></span>} chevron onClick={onPay} />
          </List>
          <div className="wl-foot">All cards, merchants and balances are fictional demo data.</div>
        </>
      )}
      {sel && (
        <button className="wl-pile" onClick={() => setSelected(null)} aria-label="Show all cards">
          {cards.filter((c) => c.id !== sel.id).slice(0, 4).map((c, i) => <span key={c.id} style={{ background: c.gradient, transform: `translateY(${i * 7}px) scale(${1 - (3 - i) * 0.03})` }} />)}
        </button>
      )}
    </Page>
  )
}

// ---------------------------------------------------------------- per-card detail
function CardDetail({ c, onPay }: { c: WalletCard; onPay: () => void }) {
  const nav = useNav()
  const def = useOS((s) => s.walletDefault)
  const [bal, setBal] = useState(c.balance)
  const txns = txnsFor(c.id)
  if (PAYMENT.includes(c.kind)) {
    return (
      <>
        <div className="wl-bal">
          <div><span>{c.kind === 'credit' ? 'Balance' : 'Available'}</span><b>{c.kind === 'credit' ? '$312.38' : bal}</b></div>
          {c.kind === 'credit' && <div><span>Available credit</span><b>$1,687.62</b></div>}
        </div>
        <div className="wl-actions">
          {c.kind === 'cash' ? <>
            <button onClick={() => useOS.getState().launch('messages', { route: 'conv/c-alex' })}><Send size={20} /><span>Send</span></button>
            <button onClick={() => useOS.getState().showToast('Request sent to Drumline 🥁')}><ArrowDownLeft size={20} /><span>Request</span></button>
            <button onClick={() => { setBal('$52.50'); useOS.getState().showToast('Added $10.00 from Maple CU Debit') }}><Plus size={20} /><span>Add Money</span></button>
          </> : <>
            <button onClick={onPay}><Nfc size={20} /><span>Pay</span></button>
            <button onClick={() => nav.push(<CardInfo c={c} />)}><Info size={20} /><span>Card Info</span></button>
            <button onClick={() => { useOS.getState().set({ walletDefault: c.id }); useOS.getState().showToast(`${c.name} is now your default card`) }}>{def === c.id ? <Check size={20} /> : <Star size={20} />}<span>{def === c.id ? 'Default' : 'Set Default'}</span></button>
          </>}
        </div>
        {c.kind === 'credit' && (
          <div className="wl-payopt">
            <div className="wl-payopt-h"><Sparkles size={14} /> Payment Options</div>
            <div className="wl-payopt-row"><span>Pay in 4 installments</span><span className="wl-muted">Available at checkout</span></div>
            <div className="wl-payopt-row"><span>Rewards</span><span className="wl-muted">2× points on dining</span></div>
            <div className="wl-payopt-row"><span>Payment due</span><span className="wl-muted">Oct 21 · $35 min</span></div>
          </div>
        )}
        <Txns txns={txns} />
      </>
    )
  }
  if (c.kind === 'transit') {
    return (
      <>
        <div className="wl-bal"><div><span>Balance</span><b>{bal}</b></div><div><span>Express Mode</span><b>On</b></div></div>
        <div className="wl-actions">
          <button onClick={() => { const n = parseFloat((bal ?? '$0').slice(1)) + 10; setBal(`$${n.toFixed(2)}`); useOS.getState().showToast('Added $10.00 to Metro Transit') }}><Plus size={20} /><span>Add Money</span></button>
          <button onClick={() => nav.push(<CardInfo c={c} />)}><Info size={20} /><span>Card Info</span></button>
        </div>
        <Txns txns={txns} />
      </>
    )
  }
  if (c.kind === 'key') return <CarKeyControls />
  if (c.kind === 'loyalty') return <PosterPass c={c} />
  return <PassBody c={c} />
}

function Txns({ txns }: { txns: Txn[] }) {
  if (!txns.length) return null
  return (
    <List header="Latest Transactions">
      {txns.map((t) => (
        <Row key={t.id} title={t.merchant} subtitle={`${t.pending ? 'Pending · ' : ''}${t.note ?? t.cat}`} detail={<span className={t.amount > 0 ? 'wl-pos' : ''}>{fmtMoney(t.amount)}<br /><small>{fmtRelative(t.ts)}</small></span>}
          icon={<span className="wl-txn-ic" style={{ background: t.color }}>{t.merchant[0]}</span>} />
      ))}
    </List>
  )
}

function QR({ seed, size = 170 }: { seed: string; size?: number }) {
  const N = 25
  let s = [...seed].reduce((a, c) => a * 33 + c.charCodeAt(0), 5381) >>> 0
  const rnd = () => ((s = (s * 1103515245 + 12345) >>> 0) / 4294967296)
  const cells: [number, number][] = []
  const finder = (x: number, y: number) => x < 7 && y < 7
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    if (finder(x, y) || finder(N - 1 - x, y) || finder(x, N - 1 - y)) continue
    if (rnd() > 0.52) cells.push([x, y])
  }
  const F = ({ x, y }: { x: number; y: number }) => <g><rect x={x} y={y} width="7" height="7" fill="#000" /><rect x={x + 1} y={y + 1} width="5" height="5" fill="#fff" /><rect x={x + 2} y={y + 2} width="3" height="3" fill="#000" /></g>
  return (
    <svg viewBox={`-1 -1 ${N + 2} ${N + 2}`} width={size} height={size} className="wl-qr" role="img" aria-label="Pass QR code">
      <rect x="-1" y="-1" width={N + 2} height={N + 2} fill="#fff" />
      {cells.map(([x, y]) => <rect key={`${x}-${y}`} x={x} y={y} width="1.02" height="1.02" fill="#000" />)}
      <F x={0} y={0} /><F x={N - 7} y={0} /><F x={0} y={N - 7} />
    </svg>
  )
}

function Barcode({ seed }: { seed: string }) {
  let s = [...seed].reduce((a, c) => a * 31 + c.charCodeAt(0), 7) >>> 0
  const bars = Array.from({ length: 60 }, () => ((s = (s * 1664525 + 1013904223) >>> 0) % 3) + 1)
  let x = 0
  return (
    <svg viewBox="0 0 240 60" className="wl-barcode" role="img" aria-label="Barcode">
      <rect width="240" height="60" fill="#fff" />
      {bars.map((w, i) => { const r = i % 2 ? null : <rect key={i} x={6 + x} y="6" width={w * 0.9} height="48" fill="#000" />; x += w * 1.25; return r })}
    </svg>
  )
}

function PassBody({ c }: { c: WalletCard }) {
  const d = c.details ?? {}
  const boarding = c.name.includes('Boarding')
  const [shared, setShared] = useState(false)
  return (
    <>
      <div className="wl-pass" style={{ ['--pass' as string]: c.gradient }}>
        {c.kind === 'id' && (
          <div className="wl-id-top">
            <Avatar id="me" size={78} />
            <div><b>{d.Name}</b><span>Grade {d.Grade} · {d.ID}</span><span>Valid {d.Valid}</span></div>
          </div>
        )}
        <div className="wl-pass-grid">
          {Object.entries(d).filter(([k]) => !(c.kind === 'id' && ['Name'].includes(k))).map(([k, v]) => (
            <div key={k}><span>{k}</span><b>{v}</b></div>
          ))}
        </div>
        <div className="wl-pass-code">
          {boarding || c.kind === 'ticket' ? <QR seed={c.id + (d.Confirmation ?? '')} /> : <Barcode seed={c.id} />}
          <span>{boarding ? `Confirmation ${d.Confirmation}` : c.kind === 'id' ? 'Tap at readers or scan at the library' : c.kind === 'loyalty' ? 'Scan to earn stars' : 'Admit one'}</span>
        </div>
        {c.kind === 'loyalty' && (
          <div className="wl-stars">{Array.from({ length: 10 }).map((_, i) => <Star key={i} size={20} fill={i < 7 ? '#ffd60a' : 'none'} color="#ffd60a" />)}<span>3 more for a free drink</span></div>
        )}
      </div>
      <List>
        {boarding && <Row title="Live Activity" subtitle="Gate & boarding updates on Lock Screen" toggle={{ value: shared, onChange: (v) => {
          setShared(v)
          if (v) useOS.getState().startActivity({ id: 'flight-sk482', kind: 'flight', title: 'SK 482 · MGR → SEA', data: { flight: 'SK 482', status: `Gate ${d.Gate}` }, subtitle: `Gate ${d.Gate} · Boards ${d.Boards}`, app: 'wallet', priority: 1 })
          else useOS.getState().endActivity('flight-sk482')
        } }} />}
        <Row title="Automatic Updates" toggle={{ value: true, onChange: () => useOS.getState().showToast('Pass updates setting saved') }} />
        <Row title="Suggest on Lock Screen" toggle={{ value: true, onChange: () => useOS.getState().showToast('Saved') }} />
        <Row title="Share Pass" tint onClick={() => useOS.getState().set({ shareRequest: { title: c.name, kind: 'file', payload: c.issuer, app: 'wallet' } })} />
        <Row title="Remove Pass" destructive onClick={() => showAlert({ title: `Remove ${c.name}?`, message: 'This demo pass will be removed from Wallet.', actions: [{ label: 'Cancel', style: 'cancel' }, { label: 'Remove', style: 'destructive', onPress: () => useOS.getState().set({ walletCards: useOS.getState().walletCards.filter((x) => x.id !== c.id) }) }] })} />
      </List>
    </>
  )
}

/** iOS 27 "Poster" pass layout for membership / loyalty / rewards cards. */
function PosterPass({ c }: { c: WalletCard }) {
  const d = c.details ?? {}
  const [stars, max] = (d.Stars ?? '7 / 10').split('/').map((x) => parseInt(x))
  return (
    <>
      <div className="wl-poster" style={{ background: c.gradient }}>
        <svg className="wl-poster-art" viewBox="0 0 300 220" aria-hidden>
          <circle cx="220" cy="70" r="90" fill="rgb(255 255 255 / .08)" />
          <circle cx="60" cy="190" r="70" fill="rgb(0 0 0 / .12)" />
          <path d="M110 80 h90 l-10 90 q-2 16 -18 16 h-34 q-16 0 -18 -16z" fill="#f5e6d3" />
          <path d="M200 100 q34 2 30 30 q-4 24 -34 22" fill="none" stroke="#f5e6d3" strokeWidth="10" />
          <path d="M122 96 h66 l-3 26 h-60z" fill="#7a4b27" />
          <path d="M140 60 q-8 -14 4 -26 M158 62 q-8 -14 4 -26 M176 60 q-8 -14 4 -26" stroke="rgb(255 255 255 / .6)" strokeWidth="4" fill="none" strokeLinecap="round" />
        </svg>
        <div className="wl-poster-top"><span>{c.issuer}</span><span>MEMBER</span></div>
        <div className="wl-poster-title">{c.name}</div>
        <div className="wl-poster-stats">
          <div><b>{stars}</b><span>of {max} stars</span></div>
          <div><b>{max - stars}</b><span>to a free drink</span></div>
          <div><b>{d.Member?.replace('Since ', '') ?? '2025'}</b><span>member since</span></div>
        </div>
        <div className="wl-poster-bar"><i style={{ width: `${(stars / max) * 100}%` }} /></div>
      </div>
      <div className="wl-pass-code poster"><Barcode seed={c.id} /><span>Scan to earn stars · Jamie Park</span></div>
      <List>
        <Row title="Rewards Available" detail={stars >= max ? '1 free drink' : 'None yet'} />
        <Row title="Automatic Updates" toggle={{ value: true, onChange: () => useOS.getState().showToast('Pass updates setting saved') }} />
        <Row title="Pay with Card" detail="Maple CU Debit" onClick={() => useOS.getState().launch('wallet', { route: 'pay' })} chevron />
      </List>
    </>
  )
}

function CarKeyControls() {
  const [locked, setLocked] = useState(true)
  const [climate, setClimate] = useState(false)
  const [trunk, setTrunk] = useState(false)
  const act = (msg: string) => useOS.getState().flashIsland({ kind: 'carkey', title: msg, subtitle: 'Demo Motors Aria EV', duration: 1800 })
  return (
    <>
      <div className="wl-car">
        <svg viewBox="0 0 300 110" width="100%" aria-hidden>
          <path d="M20 80 Q30 50 80 44 L120 22 Q150 14 200 22 L240 44 Q280 50 285 80 Z" fill="#c9ced6" />
          <path d="M92 44 L124 26 Q150 20 196 26 L226 44 Z" fill="#5a6470" />
          <circle cx="80" cy="84" r="17" fill="#222" /><circle cx="228" cy="84" r="17" fill="#222" />
          <circle cx="80" cy="84" r="7" fill="#888" /><circle cx="228" cy="84" r="7" fill="#888" />
          {!locked && <circle cx="150" cy="50" r="6" fill="#30d158"><animate attributeName="r" values="4;9;4" dur="1.4s" repeatCount="indefinite" /></circle>}
        </svg>
        <div className="wl-car-status">{locked ? 'Locked' : 'Unlocked'} · 82% · 241 mi range</div>
      </div>
      <div className="wl-actions four">
        <button className={!locked ? 'on' : ''} onClick={() => { setLocked(!locked); act(locked ? 'Car Unlocked' : 'Car Locked') }}>{locked ? <LockOpen size={20} /> : <Lock size={20} />}<span>{locked ? 'Unlock' : 'Lock'}</span></button>
        <button className={trunk ? 'on' : ''} onClick={() => { setTrunk(!trunk); act(trunk ? 'Trunk Closed' : 'Trunk Opened') }}><CarFront size={20} /><span>Trunk</span></button>
        <button className={climate ? 'on' : ''} onClick={() => { setClimate(!climate); act(climate ? 'Climate Off' : 'Pre-conditioning to 70°') }}><Fan size={20} /><span>Climate</span></button>
        <button onClick={() => act('Horn & Lights')}><Bell size={20} /><span>Locate</span></button>
      </div>
      <List header="Key Details">
        {Object.entries(CAR_KEY.details).map(([k, v]) => <Row key={k} title={k} detail={v} />)}
        <Row title="Share Key…" tint onClick={() => useOS.getState().launch('messages', { route: 'conv/c-alex' })} />
      </List>
    </>
  )
}

function CardInfo({ c }: { c: WalletCard }) {
  const [express, setExpress] = useState(c.kind === 'transit' || c.kind === 'debit')
  const [notif, setNotif] = useState(true)
  return (
    <Page title="Card Info" grouped large={false}>
      <div style={{ padding: '6px 16px 18px' }}><CardFace c={c} /></div>
      <List header="Card Information" footer="Only the device account number is shared with merchants. The full card number is never stored on this device.">
        <Row title="Card Number" detail={c.last4 ? `•••• ${c.last4}` : '—'} />
        <Row title="Device Account Number" detail={c.last4 ? `•••• ${(Number(c.last4) * 7 % 10000).toString().padStart(4, '0')}` : '—'} />
        <Row title="Issuer" detail={c.issuer} />
      </List>
      <List>
        <Row title="Express Mode" toggle={{ value: express, onChange: setExpress }} />
        <Row title="Transaction Notifications" toggle={{ value: notif, onChange: setNotif }} />
      </List>
    </Page>
  )
}

// ---------------------------------------------------------------- orders
function OrdersPage() {
  const nav = useNav()
  return (
    <Page title="Orders" grouped>
      <List header="In Progress">
        {ORDERS.filter((o) => o.progress < 1).map((o) => <OrderRow key={o.id} o={o} onClick={() => nav.push(<OrderDetail o={o} />)} />)}
      </List>
      <List header="Completed">
        {ORDERS.filter((o) => o.progress >= 1).map((o) => <OrderRow key={o.id} o={o} onClick={() => nav.push(<OrderDetail o={o} />)} />)}
      </List>
    </Page>
  )
}

function OrderRow({ o, onClick }: { o: (typeof ORDERS)[number]; onClick: () => void }) {
  return (
    <button className="wl-order" onClick={onClick}>
      <span className="wl-order-ic"><Package size={22} /></span>
      <span className="grow" style={{ textAlign: 'left', minWidth: 0 }}>
        <b>{o.merchant}</b>
        <span className="nowrap">{o.item}</span>
        <span className="wl-order-eta">{o.eta}</span>
        <span className="wl-prog"><i style={{ width: `${o.progress * 100}%`, background: o.progress >= 1 ? 'var(--green)' : 'var(--accent)' }} /></span>
      </span>
      <ChevronRight size={18} className="chev" />
    </button>
  )
}

function OrderDetail({ o }: { o: (typeof ORDERS)[number] }) {
  const steps = ['Ordered', 'Shipped', 'Out for Delivery', 'Delivered']
  const idx = Math.round(o.progress * 3)
  const acts = useOS((s) => s.activities)
  const live = acts.some((a) => a.id === 'delivery-bolt')
  return (
    <Page title={o.merchant} grouped large={false}>
      <div className="wl-od-head"><Package size={40} /><b>{o.status}</b><span>{o.eta}</span></div>
      <div className="wl-steps">
        {steps.map((s, i) => <div key={s} className={i <= idx ? 'done' : ''}><i>{i <= idx ? <Check size={12} strokeWidth={3} /> : null}</i><span>{s}</span></div>)}
      </div>
      <List header="Order">
        <Row title={o.item} />
        <Row title="Order Number" detail={o.number} />
        <Row title="Carrier" detail="Demo Express" />
      </List>
      {o.progress < 1 && (
        <List>
          <Row title="Track in Dynamic Island" toggle={{ value: live, onChange: (v) => {
            if (v) useOS.getState().startActivity({ id: 'delivery-bolt', kind: 'delivery', title: `${o.merchant} order`, subtitle: 'Out for delivery · 3 stops away', app: 'wallet', priority: 1, progress: o.progress, data: { eta: '3 stops' } })
            else useOS.getState().endActivity('delivery-bolt')
          } }} />
        </List>
      )}
    </Page>
  )
}

function ManageCards() {
  const cards = useOS((s) => s.walletCards)
  const def = useOS((s) => s.walletDefault)
  const [smart, setSmart] = useState(true)
  const pay = cards.filter((c) => PAYMENT.includes(c.kind))
  const move = (id: string, d: number) => {
    const list = [...cards]
    const i = list.findIndex((c) => c.id === id)
    const j = i + d
    if (j < 0 || j >= list.length) return
    ;[list[i], list[j]] = [list[j], list[i]]
    useOS.getState().set({ walletCards: list })
  }
  return (
    <Page title="Manage Cards" grouped large={false}>
      <List header="Default Card" footer="Your default card appears first when you double-click the side button.">
        {pay.map((c) => (
          <Row key={c.id} title={c.name} subtitle={c.last4 ? `•••• ${c.last4}` : c.balance} icon={<div className="wl-mini-card" style={{ background: c.gradient }} />} onClick={() => useOS.getState().set({ walletDefault: c.id })} trailing={def === c.id ? <Check size={18} color="var(--accent)" /> : undefined} />
        ))}
      </List>
      <List header="Card Order" footer="Easier payment management in iOS 27: reorder cards and let Wallet suggest the best card for each merchant.">
        {pay.map((c, i) => (
          <Row key={c.id} title={c.name} trailing={<span className="wl-reorder"><button aria-label="Move up" disabled={i === 0} onClick={() => move(c.id, -1)}>↑</button><button aria-label="Move down" disabled={i === pay.length - 1} onClick={() => move(c.id, 1)}>↓</button></span>} />
        ))}
        <Row title="Suggest Best Card" subtitle="Based on rewards & merchant" toggle={{ value: smart, onChange: setSmart }} />
      </List>
    </Page>
  )
}

// ---------------------------------------------------------------- redesigned Apple Pay sheet
function PaySheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const cards = useCards().filter((c) => PAYMENT.includes(c.kind) || c.kind === 'transit')
  const def = useOS((s) => s.walletDefault)
  const [idx, setIdx] = useState(0)
  const [stage, setStage] = useState<'select' | 'faceid' | 'done'>('select')
  const [listOpen, setListOpen] = useState(false)
  const rail = useRef<HTMLDivElement>(null)
  const CW = 250
  useEffect(() => {
    if (!open) return
    setStage('select')
    setListOpen(false)
    const i = Math.max(0, cards.findIndex((c) => c.id === def))
    setIdx(i)
    requestAnimationFrame(() => rail.current?.scrollTo({ left: i * (CW + 12), behavior: 'instant' as ScrollBehavior }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])
  const go = (i: number) => {
    setIdx(i)
    rail.current?.scrollTo({ left: i * (CW + 12), behavior: 'smooth' })
  }
  const card = cards[idx] ?? cards[0]
  const confirm = () => {
    if (stage !== 'select') return
    setStage('faceid')
    window.setTimeout(() => {
      setStage('done')
      extraTxns = { ...extraTxns, [card.id]: [{ id: `p-${Date.now()}`, merchant: MERCHANT.name, amount: -MERCHANT.amount, ts: Date.now(), cat: 'Food & Drink', color: '#a0673a' }, ...(extraTxns[card.id] ?? [])] }
      window.setTimeout(() => {
        onClose()
        useOS.getState().showToast(`Paid $${MERCHANT.amount.toFixed(2)} with ${card.name}`)
      }, 1300)
    }, 1300)
  }
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') go(Math.min(cards.length - 1, idx + 1))
      if (e.key === 'ArrowLeft') go(Math.max(0, idx - 1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })
  return (
    <>
    {open && stage === 'select' && <button className="wl-side-button" onClick={confirm} aria-label="Side button: double-click to pay"><span>Double-Click<br />to Pay</span></button>}
    <Sheet open={open} onClose={onClose} detent="auto" title={<span className="wl-pay-title"><WalletIcon size={16} /> Pay</span>} className="wl-paysheet" label="Apple Pay">
      <div className="wl-pay">
        <div className="wl-merchant">
          <span className="wl-merchant-logo">B</span>
          <div className="grow"><b>{MERCHANT.name}</b><span>410 Oak Ave · Demo</span></div>
          <b className="wl-amount">${MERCHANT.amount.toFixed(2)}</b>
        </div>
        <div className={`wl-rail-wrap ${stage !== 'select' ? 'locked' : ''}`}>
          <div className="wl-rail scroll-x" ref={rail} onScroll={(e) => {
            const i = Math.round((e.target as HTMLDivElement).scrollLeft / (CW + 12))
            if (i !== idx && stage === 'select') setIdx(Math.max(0, Math.min(cards.length - 1, i)))
          }}>
            {cards.map((c, i) => (
              <button key={c.id} className={`wl-rail-card ${i === idx ? 'on' : ''}`} style={{ width: CW }} onClick={() => go(i)} aria-label={`Pay with ${c.name}`} aria-pressed={i === idx}>
                <CardFace c={c} small />
              </button>
            ))}
          </div>
          <div className="wl-dots">{cards.map((c, i) => <button key={c.id} className={i === idx ? 'on' : ''} onClick={() => go(i)} aria-label={`Card ${i + 1}`} />)}</div>
        </div>
        <button className="wl-cardline" onClick={() => setListOpen(!listOpen)}>
          <span className="wl-mini-card" style={{ background: card.gradient }} />
          <span className="grow" style={{ textAlign: 'left' }}><b>{card.name}</b><span>{card.last4 ? `•••• ${card.last4}` : card.balance}{card.id === def ? ' · Default' : ''}</span></span>
          <ChevronRight size={16} style={{ transform: listOpen ? 'rotate(90deg)' : undefined, transition: 'transform .25s' }} />
        </button>
        {listOpen && (
          <div className="wl-quicklist anim-fade">
            {cards.map((c, i) => (
              <button key={c.id} onClick={() => { go(i); setListOpen(false) }}>
                <span className="wl-mini-card" style={{ background: c.gradient }} /><span className="grow" style={{ textAlign: 'left' }}>{c.name}</span>{i === idx && <Check size={16} color="var(--accent)" />}
              </button>
            ))}
          </div>
        )}
        <div className="wl-lines">
          {MERCHANT.items.map((it) => <div key={it.label}><span>{it.label}</span><span>${it.price.toFixed(2)}</span></div>)}
          <div className="total"><span>Pay Brew Lab Coffee</span><span>${MERCHANT.amount.toFixed(2)}</span></div>
        </div>
        <div className="wl-confirm">
          {stage === 'select' && (
            <>
              <button className="wl-side-hint" onClick={confirm} aria-label="Double-click side button to pay">
                <span className="wl-side-anim" />
                <span>Confirm with Side Button</span>
              </button>
              <div className="wl-side-caption">Double-click the side button · {fmtTime(Date.now())}</div>
            </>
          )}
          {stage === 'faceid' && (
            <div className="wl-faceid anim-pop"><ScanFace size={54} strokeWidth={1.4} /><span>Face ID</span></div>
          )}
          {stage === 'done' && (
            <div className="wl-done anim-pop"><span className="wl-done-ring"><Check size={40} strokeWidth={3} /></span><span>Done</span></div>
          )}
        </div>
      </div>
    </Sheet>
    </>
  )
}

// ---------------------------------------------------------------- proactive car key setup
function CarKeySheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [step, setStep] = useState<'intro' | 'pair' | 'done'>('intro')
  useEffect(() => { if (open) setStep(useOS.getState().carKeySetup === 'added' ? 'done' : 'intro') }, [open])
  const pair = () => {
    setStep('pair')
    window.setTimeout(() => {
      const st = useOS.getState()
      if (!st.walletCards.some((c) => c.id === CAR_KEY.id)) st.set({ walletCards: [...st.walletCards, CAR_KEY] })
      st.set({ carKeySetup: 'added' })
      st.flashIsland({ kind: 'carkey', title: 'Car Key Added', subtitle: 'Demo Motors Aria EV', duration: 2200 })
      setStep('done')
    }, 2200)
  }
  return (
    <Sheet open={open} onClose={onClose} detent="large" title="Car Key" className="wl-carsheet">
      <div className="wl-ck">
        <div className={`wl-ck-art ${step}`}>
          <CarFront size={72} strokeWidth={1.4} />
          {step === 'pair' && <><span className="wl-wave w1" /><span className="wl-wave w2" /><span className="wl-wave w3" /></>}
          {step === 'done' && <span className="wl-ck-check anim-pop"><Check size={28} strokeWidth={3} /></span>}
        </div>
        {step === 'intro' && <>
          <h2>Add Car Key to Wallet</h2>
          <p>Wallet found a compatible vehicle signed in to your account: <b>2026 Demo Motors Aria EV</b>. Unlock, lock and start your car with iPhone — even when the battery is low.</p>
          <div className="wl-ck-feat">
            <div><Lock size={18} /> Unlock and lock by holding iPhone near the handle</div>
            <div><Nfc size={18} /> Express Mode works without Face ID</div>
            <div><Send size={18} /> Share keys with family in Messages</div>
          </div>
          <Button block onClick={pair}>Continue</Button>
          <Button block variant="plain" onClick={() => { useOS.getState().set({ carKeySetup: 'none' }); onClose() }}>Not Now</Button>
        </>}
        {step === 'pair' && <>
          <h2>Pairing with Your Car…</h2>
          <p>Place iPhone on the key reader in the center console. Keep it there until pairing completes.</p>
        </>}
        {step === 'done' && <>
          <h2>Car Key Added</h2>
          <p>Your car key is ready. Hold iPhone near the door handle to unlock.</p>
          <div style={{ width: '100%', padding: '0 20px' }}><CardFace c={CAR_KEY} /></div>
          <Button block onClick={onClose}>Done</Button>
        </>}
      </div>
    </Sheet>
  )
}
