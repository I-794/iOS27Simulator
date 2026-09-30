/* Passwords — iOS 27. All entries are fictional demo data; the app never asks for,
 * collects or stores a real password. Revealed values are obviously fake ("demo-…"). */
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  KeyRound, UserRoundCheck, Clock3, Wifi, AlertTriangle, Trash2, Plus, Copy, Eye, EyeOff, ShieldCheck, ShieldAlert, Sparkles, Check, ScanFace, Globe,
  LifeBuoy, Lock, Users, ChevronRight, RotateCcw, Share, QrCode, Info, Smartphone, Wand2,
} from 'lucide-react'
import { NavStack, Page, useNav, BarButton } from '../../ui/nav'
import { List, Row } from '../../ui/list'
import { SearchField, Button, Avatar, Spinner } from '../../ui/controls'
import { Sheet, showAlert, openMenu } from '../../ui/overlay'
import { useOS } from '../../os/store'
import { useAppRoute, useOnscreen, useNow } from '../../os/hooks'
import { PASSWORDS } from '../../os/data/world'
import { contactName } from '../../os/data/people'
import './passwords.css'

// ------------------------------------------------------------------ model
type Base = (typeof PASSWORDS)[number]
export interface PwItem {
  id: string
  site: string
  user: string
  strength: 'weak' | 'medium' | 'strong'
  compromised: boolean
  reused: boolean
  passkey: boolean
  upgradeEligible?: boolean
  updated: number
  wifi?: boolean
  added?: boolean
  code?: boolean
  shared?: string
}
type Issue = 'compromised' | 'reused' | 'weak'

interface PwLocal {
  deleted: Record<string, number>
  upgrades: Record<string, 'passkey' | 'strong'>
  added: PwItem[]
  set: (p: Partial<PwLocal>) => void
}
const useLocal = create<PwLocal>()(
  persist((set) => ({ deleted: {}, upgrades: {}, added: [], set: (p) => set(p) }), {
    name: 'ios27-passwords',
    partialize: (s) => ({ deleted: s.deleted, upgrades: s.upgrades, added: s.added }) as PwLocal,
  }),
)

const CODE_SITES = new Set(['schoolportal.example', 'mgpl.example', 'brewlab.example'])
const SHARED: Record<string, string> = { 'streamly.example': 'Family', 'Home Wi-Fi (ParkNet)': 'Family' }
const BASE: PwItem[] = (PASSWORDS as Base[]).map((p) => ({ ...(p as PwItem), strength: p.strength as PwItem['strength'], code: CODE_SITES.has(p.site), shared: SHARED[p.site] }))

function useItems() {
  const fixed = useOS((s) => s.passwordsFixed)
  const local = useLocal()
  return useMemo(() => {
    const all = [...BASE, ...local.added].map((p) => {
      const up = fixed.includes(p.id) ? local.upgrades[p.id] ?? 'strong' : null
      return up ? { ...p, compromised: false, reused: false, strength: 'strong' as const, passkey: p.passkey || up === 'passkey', updated: 0 } : p
    })
    return { live: all.filter((p) => !(p.id in local.deleted)), deleted: all.filter((p) => p.id in local.deleted), fixed, local }
  }, [fixed, local])
}

export function issuesOf(p: PwItem): Issue[] {
  const out: Issue[] = []
  if (p.wifi) return out
  if (p.compromised) out.push('compromised')
  if (p.reused) out.push('reused')
  if (p.strength === 'weak') out.push('weak')
  return out
}

/** Obviously fake values only. Reused items intentionally share one fake value. */
function fakePassword(p: PwItem, upgraded: boolean) {
  if (upgraded || p.added) return `demo-${p.id.slice(-3)}Xk7#qP2v!R9w`
  if (p.wifi) return 'demo-parknet-wifi'
  if (p.reused) return 'demo-password1'
  if (p.compromised) return 'demo-stream2019'
  if (p.strength === 'weak') return 'demo-1234'
  return 'demo-Passw0rd!'
}

const ISSUE_TEXT: Record<Issue, { title: string; body: string; color: string }> = {
  compromised: { title: 'Compromised Password', body: 'This password has appeared in a data leak, which puts this account at high risk. Change it now.', color: 'var(--red)' },
  reused: { title: 'Reused Password', body: 'You use this password on another website. If one site is breached, attackers can try it on the others.', color: 'var(--orange)' },
  weak: { title: 'Weak Password', body: 'This password is short or easy to guess. Strong passwords use 16+ random characters.', color: 'var(--orange)' },
}

function Favicon({ site, size = 34 }: { site: string; size?: number }) {
  const hue = [...site].reduce((a, c) => a + c.charCodeAt(0), 0) % 360
  const wifi = site.includes('Wi-Fi')
  return (
    <span className="pw-fav" style={{ width: size, height: size, borderRadius: size * 0.26, background: wifi ? 'linear-gradient(160deg,#64d2ff,#0a84ff)' : `linear-gradient(160deg,hsl(${hue} 70% 62%),hsl(${(hue + 30) % 360} 65% 45%))`, fontSize: size * 0.46 }}>
      {wifi ? <Wifi size={size * 0.52} /> : site[0].toUpperCase()}
    </span>
  )
}

const ago = (days: number) => (days === 0 ? 'Today' : `${Math.abs(days)} days ago`)

// ------------------------------------------------------------------ app
export default function PasswordsApp() {
  return (
    <div className="app-root grouped pw-root">
      <NavStack root={<Home />} grouped />
    </div>
  )
}

type Cat = 'all' | 'passkeys' | 'codes' | 'wifi' | 'security' | 'deleted'
const CATS: { id: Cat; title: string; icon: typeof KeyRound; color: string }[] = [
  { id: 'all', title: 'All', icon: KeyRound, color: '#0a84ff' },
  { id: 'passkeys', title: 'Passkeys', icon: UserRoundCheck, color: '#34c759' },
  { id: 'codes', title: 'Codes', icon: Clock3, color: '#ffb800' },
  { id: 'wifi', title: 'Wi‑Fi', icon: Wifi, color: '#32ade6' },
  { id: 'security', title: 'Security', icon: AlertTriangle, color: '#ff3b30' },
  { id: 'deleted', title: 'Deleted', icon: Trash2, color: '#ff9500' },
]

function inCat(p: PwItem, c: Cat) {
  if (c === 'passkeys') return p.passkey
  if (c === 'codes') return !!p.code
  if (c === 'wifi') return !!p.wifi
  if (c === 'security') return issuesOf(p).length > 0
  return !p.wifi
}

function Home() {
  const nav = useNav()
  const { live, deleted } = useItems()
  const [q, setQ] = useState('')
  const [adding, setAdding] = useState(false)
  useOnscreen('passwords', 'Passwords (demo data)')

  useAppRoute('passwords', (route) => {
    nav.popToRoot()
    const m = route.match(/^site\/(.+)$/)
    if (m) {
      const site = decodeURIComponent(m[1])
      const item = [...BASE, ...useLocal.getState().added].find((p) => p.site === site || p.site.includes(site) || site.includes(p.site))
      if (item) nav.push(<Detail id={item.id} />)
    } else if (route === 'security') nav.push(<SecurityPage />)
    else if (route === 'recovery') nav.push(<RecoveryPage />)
  })

  const count = (c: Cat) => (c === 'deleted' ? deleted.length : live.filter((p) => inCat(p, c)).length)
  const hits = q.trim() ? live.filter((p) => `${p.site} ${p.user}`.toLowerCase().includes(q.trim().toLowerCase())) : []
  return (
    <Page
      title="Passwords"
      grouped
      trailing={<BarButton label="New Password" onClick={() => setAdding(true)}><Plus size={22} /></BarButton>}
      footer={<AddSheet open={adding} onClose={() => setAdding(false)} onSaved={(id) => { setAdding(false); nav.push(<Detail id={id} />) }} />}
    >
      <div className="pw-search"><SearchField value={q} onChange={setQ} placeholder="Search" /></div>
      {q.trim() ? (
        hits.length ? (
          <List>{hits.map((p) => <ItemRow key={p.id} p={p} />)}</List>
        ) : (
          <div className="empty-state"><KeyRound size={40} /><div className="t-title2">No Results</div></div>
        )
      ) : (
        <>
          <div className="pw-tiles">
            {CATS.map((c) => {
              const n = count(c.id)
              return (
                <button key={c.id} className={`pw-tile glass ${c.id === 'security' && n > 0 ? 'pw-tile-alert' : ''}`} onClick={() => nav.push(c.id === 'security' ? <SecurityPage /> : <CategoryPage cat={c.id} />)} aria-label={`${c.title}, ${n}`}>
                  <span className="pw-tile-ico" style={{ background: c.color }}><c.icon size={19} color="#fff" strokeWidth={2.3} /></span>
                  <span className="pw-tile-count">{c.id === 'security' && n === 0 ? <Check size={20} strokeWidth={3} /> : n}</span>
                  <span className="pw-tile-title">{c.title}</span>
                </button>
              )
            })}
          </div>
          <List header="Shared Groups">
            <Row icon={<span className="pw-group-ico"><Users size={18} /></span>} title="Family" subtitle="Mom, Dad, You · 2 passwords" chevron onClick={() => nav.push(<GroupPage />)} />
          </List>
          <List header="Help">
            <Row icon={<span className="pw-group-ico red"><LifeBuoy size={18} /></span>} title="Account Recovery" subtitle="Recovery contacts & recovery key" chevron onClick={() => nav.push(<RecoveryPage />)} />
            <Row icon={<span className="pw-group-ico dark"><Lock size={18} /></span>} title="Password Help from Lock Screen" subtitle="iOS 27" chevron onClick={() => nav.push(<LockHelpPage />)} />
          </List>
          <div className="pw-demo-note"><Info size={13} /> Demo data — every account here is fictional and no real passwords are ever stored.</div>
        </>
      )}
    </Page>
  )
}

function ItemRow({ p, onClick }: { p: PwItem; onClick?: () => void }) {
  const nav = useNav()
  const iss = issuesOf(p)
  return (
    <Row
      icon={<Favicon site={p.site} />}
      title={p.site}
      subtitle={p.user}
      trailing={iss.length ? <AlertTriangle size={17} color={iss[0] === 'compromised' ? 'var(--red)' : 'var(--orange)'} /> : p.passkey ? <UserRoundCheck size={16} className="secondary" /> : undefined}
      chevron
      onClick={onClick ?? (() => nav.push(<Detail id={p.id} />))}
      className="pw-item"
    />
  )
}

function CategoryPage({ cat }: { cat: Cat }) {
  const { live, deleted, local } = useItems()
  const [sort, setSort] = useState<'Website' | 'Date Edited'>('Website')
  const meta = CATS.find((c) => c.id === cat)!
  if (cat === 'deleted') {
    return (
      <Page title="Deleted" grouped>
        <List footer="Deleted passwords and passkeys are kept for 30 days, then permanently removed.">
          {deleted.length === 0 && <Row title={<span className="secondary">No Deleted Items</span>} />}
          {deleted.map((p) => (
            <Row
              key={p.id}
              icon={<Favicon site={p.site} />}
              title={p.site}
              subtitle={`${p.user} · ${30 - Math.floor((Date.now() - local.deleted[p.id]) / 86_400_000)} days left`}
              detail="Recover"
              onClick={() => {
                const d = { ...local.deleted }
                delete d[p.id]
                local.set({ deleted: d })
                useOS.getState().showToast(`${p.site} recovered`)
              }}
            />
          ))}
        </List>
      </Page>
    )
  }
  const items = live.filter((p) => inCat(p, cat)).sort((a, b) => (sort === 'Website' ? a.site.localeCompare(b.site) : b.updated - a.updated))
  return (
    <Page
      title={meta.title}
      grouped
      trailing={<BarButton label="Sort" onClick={() => setSort(sort === 'Website' ? 'Date Edited' : 'Website')}>{sort === 'Website' ? 'A–Z' : 'Recent'}</BarButton>}
    >
      {cat === 'codes' && <div className="pw-hint">Verification codes refresh every 30 seconds. Codes here are fake demo codes.</div>}
      <List>
        {items.length === 0 && <Row title={<span className="secondary">None</span>} />}
        {items.map((p) => <ItemRow key={p.id} p={p} />)}
      </List>
    </Page>
  )
}

function GroupPage() {
  const { live } = useItems()
  const items = live.filter((p) => p.shared === 'Family')
  return (
    <Page title="Family" grouped>
      <div className="pw-group-head">
        {['mom', 'dad', 'me'].map((id) => <Avatar key={id} id={id} size={48} color={id === 'me' ? '#6aa9ff' : undefined} />)}
      </div>
      <List header="Members">
        <Row title={contactName('mom', 'full')} detail="Owner" />
        <Row title={contactName('dad', 'full')} detail="Member" />
        <Row title="Jamie Park" detail="You" />
      </List>
      <List header="Shared Passwords" footer="Everyone in the group can see, edit and use these passwords.">
        {items.map((p) => <ItemRow key={p.id} p={p} />)}
      </List>
    </Page>
  )
}

// ------------------------------------------------------------------ detail
function TotpCode({ site }: { site: string }) {
  const now = useNow(1000)
  const step = Math.floor(now / 30000)
  const left = 30 - Math.floor((now / 1000) % 30)
  const seed = [...site].reduce((a, c) => a * 31 + c.charCodeAt(0), 7)
  const code = String(Math.abs((seed * (step + 13)) % 1_000_000)).padStart(6, '0')
  const c = 2 * Math.PI * 9
  return (
    <span className="pw-code">
      <b>{code.slice(0, 3)} {code.slice(3)}</b>
      <svg width="22" height="22" viewBox="0 0 22 22" aria-label={`${left} seconds left`}>
        <circle cx="11" cy="11" r="9" fill="none" stroke="var(--fill)" strokeWidth="2.5" />
        <circle cx="11" cy="11" r="9" fill="none" stroke={left < 6 ? 'var(--red)' : 'var(--accent)'} strokeWidth="2.5" strokeDasharray={c} strokeDashoffset={c * (1 - left / 30)} transform="rotate(-90 11 11)" />
      </svg>
    </span>
  )
}

function copy(text: string, label: string) {
  try {
    void navigator.clipboard?.writeText(text)
  } catch {
    /* ignore */
  }
  useOS.getState().showToast(`${label} copied`)
}

function Detail({ id }: { id: string }) {
  const nav = useNav()
  const { live, deleted, fixed, local } = useItems()
  const p = live.find((x) => x.id === id) ?? deleted.find((x) => x.id === id)
  const [reveal, setReveal] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [upgrade, setUpgrade] = useState<null | 'passkey' | 'strong'>(null)
  const [qr, setQr] = useState(false)
  useOnscreen('passwords', p ? `Viewing ${p.site}` : undefined, p ? { type: 'page', title: p.site, url: p.site, text: `Account ${p.user} on ${p.site} (demo)` } : undefined)
  if (!p) return <Page title="Password" grouped large={false}><div className="empty-state">This item was removed.</div></Page>
  const upgraded = fixed.includes(p.id)
  const iss = issuesOf(p)
  const pw = fakePassword(p, upgraded)
  const toggleReveal = () => {
    if (reveal) return setReveal(false)
    setVerifying(true)
    useOS.getState().flashIsland({ kind: 'faceid', duration: 800 })
    window.setTimeout(() => {
      setVerifying(false)
      setReveal(true)
    }, 700)
  }
  return (
    <Page
      grouped
      large={false}
      title={p.site}
      trailing={
        <BarButton
          label="More"
          onClick={() => {
            const el = document.activeElement as HTMLElement
            openMenu(el, [
              { label: 'Copy User Name', icon: <Copy size={18} />, onSelect: () => copy(p.user, 'User name') },
              { label: 'Share with Family', icon: <Share size={18} />, onSelect: () => useOS.getState().showToast(`${p.site} shared with Family (demo)`) },
              {
                label: 'Delete',
                icon: <Trash2 size={18} />,
                destructive: true,
                separatorBefore: true,
                onSelect: () =>
                  showAlert({
                    title: `Delete ${p.site}?`,
                    message: 'It will move to Deleted for 30 days.',
                    actions: [{ label: 'Cancel', style: 'cancel' }, { label: 'Delete', style: 'destructive', onPress: () => { local.set({ deleted: { ...local.deleted, [p.id]: Date.now() } }); nav.pop() } }],
                  }),
              },
            ])
          }}
        >
          Edit
        </BarButton>
      }
    >
      <div className="pw-detail-head">
        <Favicon site={p.site} size={64} />
        <div className="t-title2">{p.site}</div>
        <div className="t-footnote secondary">Last modified {ago(p.updated)}{p.shared ? ` · Shared with ${p.shared}` : ''}</div>
      </div>
      {iss.map((i) => (
        <div key={i} className="pw-warning" style={{ ['--wc' as string]: ISSUE_TEXT[i].color }}>
          <AlertTriangle size={18} />
          <div className="grow">
            <div className="t-subhead bold">{ISSUE_TEXT[i].title}</div>
            <div className="t-footnote secondary">{ISSUE_TEXT[i].body}</div>
            <div className="row gap8" style={{ marginTop: 8, flexWrap: 'wrap' }}>
              {p.upgradeEligible && <Button size="small" onClick={() => setUpgrade('passkey')}><UserRoundCheck size={14} /> Upgrade to Passkey</Button>}
              <Button size="small" variant={p.upgradeEligible ? 'tinted' : 'filled'} onClick={() => setUpgrade('strong')}><Wand2 size={14} /> Change to Strong Password</Button>
            </div>
          </div>
        </div>
      )).slice(0, 1)}
      {iss.length > 1 && <div className="pw-hint">Also: {iss.slice(1).map((i) => ISSUE_TEXT[i].title).join(', ')}</div>}
      {upgraded && (
        <div className="pw-fixed anim-pop"><ShieldCheck size={18} /> {local.upgrades[p.id] === 'passkey' ? 'Upgraded to a passkey' : 'Changed to a strong password'} automatically</div>
      )}
      <List>
        <Row title={p.wifi ? 'Network' : 'User Name'} detail={p.wifi ? 'ParkNet' : p.user} onClick={() => copy(p.user, 'User name')} className="pw-field" />
        <Row
          title="Password"
          className="pw-field"
          detail={verifying ? <Spinner size={14} /> : <span className={`pw-secret ${reveal ? 'shown' : ''}`}>{reveal ? pw : '••••••••'}</span>}
          trailing={<span className="pw-eye" aria-hidden>{reveal ? <EyeOff size={18} /> : <Eye size={18} />}</span>}
          label={reveal ? 'Hide password' : 'Show password'}
          onClick={toggleReveal}
        />
        {p.passkey && <Row title="Passkey" detail={<span className="row gap4"><UserRoundCheck size={15} /> Created {ago(p.updated)}</span>} className="pw-field" />}
        {p.code && <Row title="Verification Code" detail={<TotpCode site={p.site} />} className="pw-field" />}
      </List>
      {reveal && <div className="pw-hint">Demo value — clearly fake, not a real credential.</div>}
      {!p.wifi && (
        <List header="Websites">
          <Row icon={<Globe size={18} className="secondary" />} title={p.site} tint onClick={() => useOS.getState().launch('safari', { route: `url/${p.site}` })} />
        </List>
      )}
      {p.wifi && (
        <List>
          <Row tint title={<span className="row gap6"><QrCode size={18} /> Show Network QR Code</span>} onClick={() => setQr(true)} />
        </List>
      )}
      {!p.code && !p.wifi && (
        <List footer="Set up a verification code so this app can fill codes for you.">
          <Row tint title="Set Up Verification Code…" onClick={() => showAlert({ title: 'Set Up Verification Code', message: 'Scan a setup QR code from the website with Camera. (Demo — no real codes.)', actions: [{ label: 'OK' }] })} />
        </List>
      )}
      <List>
        <Row destructive title="Delete Password" onClick={() => { local.set({ deleted: { ...local.deleted, [p.id]: Date.now() } }); nav.pop(); useOS.getState().showToast('Moved to Deleted') }} />
      </List>
      <UpgradeSheet item={p} kind={upgrade} onClose={() => setUpgrade(null)} />
      <Sheet open={qr} onClose={() => setQr(false)} detent="auto" title="ParkNet">
        <div className="pw-qr-wrap">
          <FakeQR seed="parknet" />
          <div className="t-footnote secondary center">Scan to join “ParkNet”. Demo QR — encodes nothing.</div>
        </div>
      </Sheet>
    </Page>
  )
}

function FakeQR({ seed }: { seed: string }) {
  let h = [...seed].reduce((a, c) => (Math.imul(a, 33) + c.charCodeAt(0)) | 0, 5381)
  const N = 25
  const cells: ReactNode[] = []
  const finder = (x: number, y: number) => x < 7 && y < 7
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      h = (Math.imul(h, 1103515245) + 12345) & 0x7fffffff
      const inF = finder(x, y) || finder(N - 1 - x, y) || finder(x, N - 1 - y)
      if (inF) continue
      if ((h >> 7) % 2) cells.push(<rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" />)
    }
  const F = ({ x, y }: { x: number; y: number }) => (
    <g>
      <rect x={x} y={y} width="7" height="7" />
      <rect x={x + 1} y={y + 1} width="5" height="5" fill="#fff" />
      <rect x={x + 2} y={y + 2} width="3" height="3" />
    </g>
  )
  return (
    <svg viewBox={`-2 -2 ${N + 4} ${N + 4}`} width="200" height="200" className="pw-qr" aria-label="Demo QR code">
      <rect x="-2" y="-2" width={N + 4} height={N + 4} fill="#fff" />
      <g fill="#000">{cells}<F x={0} y={0} /><F x={N - 7} y={0} /><F x={0} y={N - 7} /></g>
    </svg>
  )
}

// ------------------------------------------------------------------ iOS 27 automatic upgrade flow
function UpgradeSheet({ item, kind, onClose }: { item: PwItem; kind: null | 'passkey' | 'strong'; onClose: () => void }) {
  const [step, setStep] = useState(0)
  const steps =
    kind === 'passkey'
      ? [`Signing in to ${item.site}`, 'Confirming with Face ID', 'Creating passkey', 'Removing old password', 'Saving to iCloud Keychain']
      : [`Signing in to ${item.site}`, 'Confirming with Face ID', 'Generating strong password', `Updating password on ${item.site}`, 'Saving to iCloud Keychain']
  useEffect(() => {
    if (!kind) return setStep(0)
    if (step >= steps.length) return
    const t = window.setTimeout(() => setStep((s) => s + 1), step === 1 ? 1000 : 750)
    return () => window.clearTimeout(t)
  }, [kind, step, steps.length])
  useEffect(() => {
    if (kind && step === steps.length) {
      const st = useOS.getState()
      if (!st.passwordsFixed.includes(item.id)) st.set({ passwordsFixed: [...st.passwordsFixed, item.id] })
      const l = useLocal.getState()
      l.set({ upgrades: { ...l.upgrades, [item.id]: kind } })
    }
  }, [kind, step, steps.length, item.id])
  const done = step >= steps.length
  return (
    <Sheet open={!!kind} onClose={onClose} detent="auto" title={kind === 'passkey' ? 'Upgrade to Passkey' : 'Change to Strong Password'} label="Automatic upgrade">
      <div className="pw-up">
        <div className={`pw-up-hero ${done ? 'done' : ''}`}>
          {done ? <ShieldCheck size={42} /> : step === 1 ? <ScanFace size={42} className="pw-faceid" /> : <Favicon site={item.site} size={54} />}
          {!done && <span className="pw-up-ring" />}
        </div>
        <div className="t-headline center">{done ? (kind === 'passkey' ? 'Passkey Created' : 'Password Updated') : 'Upgrading automatically…'}</div>
        <div className="t-footnote secondary center">{done ? `${item.site} is now secured. You won’t need to remember anything.` : 'iOS 27 handles the change with the website for you — no forms to fill.'}</div>
        <ol className="pw-steps">
          {steps.map((s, i) => (
            <li key={s} className={i < step ? 'done' : i === step ? 'active' : ''}>
              <span className="pw-step-dot">{i < step ? <Check size={12} strokeWidth={3.4} /> : i === step ? <Spinner size={12} /> : null}</span>
              {s}
            </li>
          ))}
        </ol>
        {kind === 'strong' && step >= 3 && <div className="pw-gen anim-fade">demo-{item.id.slice(-3)}Xk7#qP2v!R9w</div>}
        <Button block onClick={onClose} disabled={!done}>{done ? 'Done' : 'Working…'}</Button>
        <div style={{ height: 10 }} />
      </div>
    </Sheet>
  )
}

// ------------------------------------------------------------------ Security recommendations
function SecurityPage() {
  const { live } = useItems()
  const fixed = useOS((s) => s.passwordsFixed)
  const nav = useNav()
  const [batch, setBatch] = useState<{ id: string; kind: 'passkey' | 'strong' }[]>([])
  const [running, setRunning] = useState<string | null>(null)
  const high = live.filter((p) => issuesOf(p).includes('compromised'))
  const other = live.filter((p) => !issuesOf(p).includes('compromised') && issuesOf(p).length > 0)
  const eligible = [...high, ...other].filter((p) => p.upgradeEligible)
  const fixedItems = live.filter((p) => fixed.includes(p.id))
  const [one, setOne] = useState<{ item: PwItem; kind: 'passkey' | 'strong' } | null>(null)

  useEffect(() => {
    if (!batch.length) return
    const [head, ...rest] = batch
    setRunning(head.id)
    const t = window.setTimeout(() => {
      const st = useOS.getState()
      if (!st.passwordsFixed.includes(head.id)) st.set({ passwordsFixed: [...st.passwordsFixed, head.id] })
      const l = useLocal.getState()
      l.set({ upgrades: { ...l.upgrades, [head.id]: head.kind } })
      setRunning(null)
      setBatch(rest)
      if (!rest.length) st.showToast('All eligible accounts upgraded')
    }, 1800)
    return () => window.clearTimeout(t)
  }, [batch])

  const Item = ({ p }: { p: PwItem }) => {
    const iss = issuesOf(p)
    return (
      <div className={`pw-rec ${running === p.id ? 'running' : ''}`}>
        <button className="pw-rec-main" onClick={() => nav.push(<Detail id={p.id} />)}>
          <Favicon site={p.site} />
          <span className="grow">
            <span className="t-body nowrap" style={{ display: 'block' }}>{p.site}</span>
            <span className="t-footnote" style={{ color: ISSUE_TEXT[iss[0]].color }}>{iss.map((i) => ISSUE_TEXT[i].title.replace(' Password', '')).join(' · ')}</span>
          </span>
          {running === p.id ? <Spinner size={16} /> : <ChevronRight size={18} className="tertiary" />}
        </button>
        <div className="pw-rec-actions">
          {p.upgradeEligible && <button className="pw-chip" onClick={() => setOne({ item: p, kind: 'passkey' })}><UserRoundCheck size={14} /> Upgrade to Passkey</button>}
          <button className="pw-chip" onClick={() => setOne({ item: p, kind: 'strong' })}><Wand2 size={14} /> Change Password</button>
        </div>
      </div>
    )
  }

  const total = high.length + other.length
  return (
    <Page title="Security" grouped>
      <div className={`pw-sec-hero ${total ? '' : 'ok'}`}>
        {total ? <ShieldAlert size={40} /> : <ShieldCheck size={40} />}
        <div className="t-title3">{total ? `${total} Recommendation${total === 1 ? '' : 's'}` : 'No Security Recommendations'}</div>
        <div className="t-footnote secondary">{total ? 'Passwords checks your saved accounts for leaks, reuse and weak passwords — privately, on device.' : 'Every saved account is using a strong password or passkey.'}</div>
      </div>
      {eligible.length > 0 && (
        <List header={<span className="row gap6"><Sparkles size={13} /> Automatic Upgrades · iOS 27</span>} footer="These websites support automatic upgrades, so iPhone can switch them to a passkey or strong password for you in the background.">
          <div className="pw-auto">
            <div className="row gap8">{eligible.map((p) => <Favicon key={p.id} site={p.site} size={30} />)}</div>
            <div className="t-subhead">{eligible.length} account{eligible.length === 1 ? ' is' : 's are'} eligible</div>
            <Button size="medium" block disabled={!!batch.length} onClick={() => setBatch(eligible.map((p) => ({ id: p.id, kind: 'passkey' as const })))}>{batch.length ? <><Spinner size={14} /> Upgrading…</> : 'Upgrade All to Passkeys'}</Button>
          </div>
        </List>
      )}
      {high.length > 0 && (
        <List header="High Priority" footer="Compromised passwords appeared in a known data leak. Change them first.">
          {high.map((p) => <Item key={p.id} p={p} />)}
        </List>
      )}
      {other.length > 0 && (
        <List header="Other Recommendations" footer="Reused passwords put several accounts at risk at once; weak passwords are easy to guess.">
          {other.map((p) => <Item key={p.id} p={p} />)}
        </List>
      )}
      {fixedItems.length > 0 && (
        <List header="Recently Fixed">
          {fixedItems.map((p) => <Row key={p.id} icon={<Favicon site={p.site} />} title={p.site} subtitle={useLocal.getState().upgrades[p.id] === 'passkey' ? 'Now uses a passkey' : 'Now uses a strong password'} trailing={<ShieldCheck size={18} color="var(--green)" />} onClick={() => nav.push(<Detail id={p.id} />)} />)}
        </List>
      )}
      <List>
        <Row
          tint
          title={<span className="row gap6"><RotateCcw size={16} /> Reset Security Demo</span>}
          onClick={() => { useOS.getState().set({ passwordsFixed: [] }); useLocal.getState().set({ upgrades: {} }) }}
        />
      </List>
      {one && <UpgradeSheet item={one.item} kind={one.kind} onClose={() => setOne(null)} />}
    </Page>
  )
}

// ------------------------------------------------------------------ recovery + lock screen help
function readRecoveryContacts(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem('ios27-settings') ?? '{}')
    return raw?.state?.recoveryContacts ?? ['mom']
  } catch {
    return ['mom']
  }
}

function RecoveryPage() {
  const [contacts] = useState(readRecoveryContacts)
  return (
    <Page title="Account Recovery" grouped large={false}>
      <div className="pw-sec-hero ok"><LifeBuoy size={40} /><div className="t-title3">Never Get Locked Out</div><div className="t-footnote secondary">If you forget your Apple Account password or passcode, these options help you get back into your passwords.</div></div>
      <List header="Recovery Contacts" footer="A recovery contact can generate a code on their device to help you — they can’t see your passwords.">
        {contacts.map((c) => <Row key={c} icon={<Avatar id={c} size={32} />} title={contactName(c, 'full')} detail="Recovery Contact" />)}
        <Row tint title="Manage in Settings" onClick={() => useOS.getState().launch('settings', { route: 'account/recovery' })} />
      </List>
      <List header="Recovery Key">
        <Row title="Recovery Key" detail="Manage" chevron onClick={() => useOS.getState().launch('settings', { route: 'account/security' })} />
      </List>
      <List header="Trusted Devices">
        <Row icon={<Smartphone size={18} className="secondary" />} title="Jamie’s iPhone" detail="This iPhone" />
        <Row icon={<Smartphone size={18} className="secondary" />} title="Jamie’s Work iPhone" detail="Trusted" />
      </List>
    </Page>
  )
}

function LockHelpPage() {
  return (
    <Page title="Lock Screen Help" grouped large={false}>
      <div className="pw-lock-demo">
        <div className="pw-lock-clock">9:41</div>
        <div className="pw-lock-card glass dark-glass"><KeyRound size={14} /> Forgot a password? Get help from your Lock Screen</div>
      </div>
      <List header="How It Works · iOS 27">
        <Row icon={<span className="pw-num">1</span>} title="Tap “Forgot a password?”" subtitle="On the Lock Screen notification list, before unlocking." />
        <Row icon={<span className="pw-num">2</span>} title="Pick the account" subtitle="Only site names are shown while locked — never passwords." />
        <Row icon={<span className="pw-num">3</span>} title="Confirm with Face ID" subtitle="Passwords opens straight to that account after you authenticate." />
        <Row icon={<span className="pw-num">4</span>} title="Fix it on the spot" subtitle="Change to a strong password or upgrade to a passkey." />
      </List>
      <List footer="Try it: lock the simulator (⌘L or the side button) and open Notification Center. The prompt appears while you still have security recommendations.">
        <Row tint title="Lock iPhone to Try" onClick={() => useOS.getState().lock()} />
      </List>
    </Page>
  )
}

// ------------------------------------------------------------------ add (generated passwords only)
function AddSheet({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: (id: string) => void }) {
  const [site, setSite] = useState('')
  const [user, setUser] = useState('')
  useEffect(() => {
    if (open) {
      setSite('')
      setUser('')
    }
  }, [open])
  const ok = site.trim().length > 2 && user.trim().length > 0
  const save = () => {
    if (!ok) return
    const id = `pw-new-${Date.now().toString(36)}`
    const item: PwItem = { id, site: site.trim().toLowerCase(), user: user.trim(), strength: 'strong', compromised: false, reused: false, passkey: false, updated: 0, added: true }
    useLocal.getState().set({ added: [...useLocal.getState().added, item] })
    onSaved(id)
  }
  return (
    <Sheet open={open} onClose={onClose} title="New Password" trailing={<button className="bar-btn prominent" disabled={!ok} style={{ opacity: ok ? 1 : 0.4 }} onClick={save}>Save</button>}>
      <div style={{ height: 8 }} />
      <List footer="For your safety, the simulator never lets you type a password. A strong demo password is generated for you.">
        <Row title="Website" trailing={<input className="text-input pw-input" value={site} onChange={(e) => setSite(e.target.value)} placeholder="example.com" aria-label="Website" />} />
        <Row title="User Name" trailing={<input className="text-input pw-input" value={user} onChange={(e) => setUser(e.target.value)} placeholder="Required" aria-label="User name" />} />
        <Row title="Password" detail={<span className="pw-secret shown">demo-•••• (Strong)</span>} />
      </List>
    </Sheet>
  )
}
