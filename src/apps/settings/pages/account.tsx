import { useEffect, useState } from 'react'
import { User, ShieldCheck, CreditCard, RefreshCcw, Cloud, Users, MapPin, ShoppingBag, Smartphone, Tablet, Monitor, Image as ImageIcon, FolderClosed, KeyRound, MessageCircle, StickyNote, HardDriveUpload, Lock, Mail, Globe2, LifeBuoy, KeySquare, Check, ArrowUpCircle } from 'lucide-react'
import { List, Row } from '../../../ui/list'
import { Avatar, Button, Spinner } from '../../../ui/controls'
import { Sheet, showAlert } from '../../../ui/overlay'
import { useNav } from '../../../ui/nav'
import { useOS } from '../../../os/store'
import { Scene } from '../../../art/Scene'
import { contactName } from '../../../os/data/people'
import { ROUTES, Sub, Ico, Go, Push, usePrefs, Note, New27, os, setPrefIn } from '../common'

function AccountPage() {
  const findMy = usePrefs((s) => s.findMy)
  return (
    <Sub title="Apple Account">
      <div className="stg-acct-head">
        <Avatar id="me" size={92} color="#6aa9ff" />
        <div className="stg-acct-name">Jamie Park</div>
        <div className="secondary t-subhead">jamie.park@icloud.example</div>
      </div>
      <List>
        <Push icon={<Ico c="#8e8e93" i={User} />} title="Personal Information" page={() => <PersonalInfo />} />
        <Go icon={<Ico c="#8e8e93" i={ShieldCheck} />} to="account/security" title="Sign-In & Security" />
        <Push icon={<Ico c="#8e8e93" i={CreditCard} />} title="Payment & Shipping" detail="Apple Cash" page={() => <Payment />} />
        <Push icon={<Ico c="#8e8e93" i={RefreshCcw} />} title="Subscriptions" page={() => <Subscriptions />} />
      </List>
      <List>
        <Go icon={<Ico c="#32ade6" i={Cloud} fill />} to="account/icloud" title="iCloud" detail="42 GB" />
        <Go icon={<Ico c="#007aff" i={Users} />} to="account/family" title="Family" detail="Mom, Dad, Mia" />
        <Push icon={<Ico c="#34c759" i={MapPin} />} title="Find My" detail={findMy ? 'On' : 'Off'} page={() => <FindMyPage />} />
        <Push icon={<Ico c="#007aff" i={ShoppingBag} />} title="Media & Purchases" page={() => <Media />} />
      </List>
      <List header="Devices">
        <Row icon={<span className="stg-dev-ico"><Smartphone size={18} /></span>} title="Jamie’s iPhone" subtitle="This iPhone 18 Pro (simulated)" />
        <Go icon={<span className="stg-dev-ico"><Smartphone size={18} /></span>} to="general/handoff" title="Jamie’s Work iPhone" subtitle="iPhone 17 · Same phone number" />
        <Row icon={<span className="stg-dev-ico"><Tablet size={18} /></span>} title="Jamie’s iPad" subtitle="iPad Air" />
        <Row icon={<span className="stg-dev-ico"><Monitor size={18} /></span>} title="Family iMac" subtitle="iMac" />
      </List>
      <List>
        <Row
          destructive
          title={<span style={{ display: 'block', textAlign: 'center' }}>Sign Out</span>}
          onClick={() =>
            showAlert({
              title: 'Sign Out of Apple Account?',
              message: 'This is a simulator — signing out would remove all demo data. Use General › Transfer or Reset iPhone to start over.',
              actions: [{ label: 'OK', style: 'cancel' }],
            })
          }
        />
      </List>
    </Sub>
  )
}

function PersonalInfo() {
  return (
    <Sub title="Personal Information">
      <List>
        <Row title="Name" detail="Jamie Park" />
        <Row title="Birthday" detail="May 14, 2010" />
        <Row title="Phone" detail="(555) 010-4417" />
        <Row title="Email" detail="jamie.park@icloud.example" />
      </List>
      <Note>All people and accounts in this simulator are fictional.</Note>
    </Sub>
  )
}

function Payment() {
  const def = useOS((s) => s.walletDefault)
  const cards = useOS((s) => s.walletCards)
  return (
    <Sub title="Payment & Shipping">
      <List header="Payment Method">
        <Row title={cards.find((c) => c.id === def)?.name ?? 'Apple Cash'} subtitle="Default · managed in Wallet & Apple Pay" />
        <Go to="wallet" title="Wallet & Apple Pay" />
      </List>
      <List header="Shipping Address">
        <Row title="84 Birchwood Lane" subtitle="Maple Grove" />
      </List>
    </Sub>
  )
}

function Subscriptions() {
  const [subs, setSubs] = useState([
    { id: 'one', name: 'Apple One Family', price: '$25.95/month', on: true, shared: true },
    { id: 'icloud', name: 'iCloud+ 50 GB', price: 'Included in Apple One', on: true, shared: true },
    { id: 'tuneup', name: 'TuneUp Guitar Lessons', price: '$4.99/month', on: true, shared: false },
  ])
  return (
    <Sub title="Subscriptions">
      <List header="Active">
        {subs.filter((s) => s.on).map((s) => (
          <Row key={s.id} title={s.name} subtitle={`${s.price}${s.shared ? ' · Shared with Family' : ''}`} detail="Cancel" onClick={() => showAlert({ title: `Cancel ${s.name}?`, message: 'Demo subscription — no charges are real.', actions: [{ label: 'Keep', style: 'cancel' }, { label: 'Cancel Subscription', style: 'destructive', onPress: () => setSubs((l) => l.map((x) => (x.id === s.id ? { ...x, on: false } : x))) }] })} />
        ))}
      </List>
      {subs.some((s) => !s.on) && (
        <List header="Inactive">
          {subs.filter((s) => !s.on).map((s) => (
            <Row key={s.id} title={s.name} subtitle="Expired" detail="Resubscribe" onClick={() => setSubs((l) => l.map((x) => (x.id === s.id ? { ...x, on: true } : x)))} />
          ))}
        </List>
      )}
    </Sub>
  )
}

function FindMyPage() {
  const findMy = usePrefs((s) => s.findMy)
  const [network, setNetwork] = useState(true)
  const [last, setLast] = useState(true)
  return (
    <Sub title="Find My">
      <List footer="Locate, lock, or erase this iPhone and supported accessories. This iPhone cannot be erased and reactivated without your password.">
        <Row title="Find My iPhone" toggle={{ value: findMy, onChange: (v) => usePrefs.getState().setP({ findMy: v }) }} />
        <Row title="Find My network" toggle={{ value: network && findMy, onChange: setNetwork }} disabled={!findMy} />
        <Row title="Send Last Location" toggle={{ value: last && findMy, onChange: setLast }} disabled={!findMy} />
      </List>
      <List>
        <Row title="Open Find My" tint onClick={() => os().launch('findmy')} />
      </List>
    </Sub>
  )
}

function Media() {
  const [pw, setPw] = useState<'Always Require' | 'Require After 15 Minutes'>('Require After 15 Minutes')
  return (
    <Sub title="Media & Purchases">
      <List>
        <Row title="View Account" chevron onClick={() => showAlert({ title: 'Apple Account', message: 'jamie.park@icloud.example · Country: United States', actions: [{ label: 'OK' }] })} />
        <Row title="Password Settings" detail={pw === 'Always Require' ? 'Always' : '15 min'} onClick={() => setPw(pw === 'Always Require' ? 'Require After 15 Minutes' : 'Always Require')} />
      </List>
    </Sub>
  )
}

// ------------------------------------------------------------------ Sign-In & Security + recovery
function SecurityPage() {
  const contacts = usePrefs((s) => s.recoveryContacts)
  const key = usePrefs((s) => s.recoveryKey)
  const nav = useNav()
  return (
    <Sub title="Sign-In & Security">
      <List>
        <Row icon={<Ico c="#8e8e93" i={Mail} />} title="Email & Phone Numbers" detail="2" />
        <Row
          icon={<Ico c="#8e8e93" i={KeyRound} />}
          title="Change Password"
          chevron
          onClick={() => showAlert({ title: 'Change Password', message: 'In the simulator, your Apple Account password is never collected. On a real iPhone you’d enter your passcode, then a new password.', actions: [{ label: 'OK' }] })}
        />
      </List>
      <List footer="Your trusted devices and phone numbers are used to verify your identity when signing in.">
        <Row title="Two-Factor Authentication" detail="On" />
        <Row title="Passkeys" detail="3" onClick={() => os().launch('passwords')} chevron />
      </List>
      <List header="Account Recovery" footer="If you forget your password or device passcode, you have options to recover your data.">
        <Push icon={<Ico c="#34c759" i={LifeBuoy} />} title="Account Recovery" detail={`${contacts.length} contact${contacts.length === 1 ? '' : 's'}`} page={() => <RecoveryPage />} />
        <Push icon={<Ico c="#ff9500" i={KeySquare} />} title="Recovery Key" detail={key ? 'On' : 'Off'} page={() => <RecoveryKeyPage />} />
        <Row icon={<Ico c="#5856d6" i={Smartphone} />} title={<span className="row gap6">Quick Start with Recovery Contact <New27 /></span>} chevron onClick={() => nav.push(<QuickStartPage />)} />
      </List>
    </Sub>
  )
}

const RECOVERY_CANDIDATES = ['mom', 'dad', 'grandma', 'alex']

function RecoveryPage() {
  const contacts = usePrefs((s) => s.recoveryContacts)
  const codeAccess = usePrefs((s) => s.recoveryCodeAccess)
  const [adding, setAdding] = useState(false)
  const [code, setCode] = useState<string | null>(null)
  const [gen, setGen] = useState(false)
  const getCode = () => {
    setGen(true)
    setCode(null)
    window.setTimeout(() => {
      setGen(false)
      setCode(String(Math.floor(100000 + Math.random() * 899999)))
    }, 900)
  }
  return (
    <Sub title="Account Recovery">
      <List header="Recovery Assistance" footer="A recovery contact can help you get back into your account if you forget your password. They won’t have access to your account.">
        {contacts.map((c) => (
          <Row
            key={c}
            icon={<Avatar id={c} size={30} />}
            title={contactName(c, 'full')}
            detail="Recovery Contact"
            onClick={() => showAlert({ title: `Remove ${contactName(c)}?`, message: `${contactName(c)} will no longer be able to help you recover your account.`, actions: [{ label: 'Cancel', style: 'cancel' }, { label: 'Remove', style: 'destructive', onPress: () => usePrefs.getState().setP({ recoveryContacts: usePrefs.getState().recoveryContacts.filter((x) => x !== c) }) }] })}
          />
        ))}
        <Row tint title="Add Recovery Contact…" onClick={() => setAdding(true)} />
      </List>
      <List header={<span className="row gap6">Recovery Codes <New27 /></span>} footer="iOS 27 lets you request a one-time recovery code from any of your signed-in devices or a recovery contact’s device in seconds — no waiting for an account-recovery period when you still have a trusted device.">
        <Row title="Faster Recovery Code Access" toggle={{ value: codeAccess, onChange: (v) => usePrefs.getState().setP({ recoveryCodeAccess: v }) }} />
      </List>
      <List header="Recovery Contact For" footer="If Mia is locked out of her account, she can ask you for a code. Read it to her only if you’re sure it’s her.">
        <Row icon={<Avatar id="mia" size={30} />} title="Mia Park" trailing={gen ? <Spinner size={16} /> : <button className="stg-link" onClick={getCode}>Get Recovery Code</button>} />
        {code && (
          <div className="stg-code anim-pop" aria-live="polite">
            <div className="t-footnote secondary">Recovery code for Mia · expires in 10 minutes</div>
            <div className="stg-code-digits">{code.split('').map((d, i) => <span key={i}>{d}</span>)}</div>
            <div className="t-caption1 secondary">Demo code — not a real credential.</div>
          </div>
        )}
      </List>
      <Sheet open={adding} onClose={() => setAdding(false)} detent="medium" title="Add Recovery Contact">
        <List footer="Choose someone you trust. They’ll receive a message asking them to accept.">
          {RECOVERY_CANDIDATES.filter((c) => !contacts.includes(c)).map((c) => (
            <Row
              key={c}
              icon={<Avatar id={c} size={32} />}
              title={contactName(c, 'full')}
              chevron
              onClick={() => {
                usePrefs.getState().setP({ recoveryContacts: [...usePrefs.getState().recoveryContacts, c] })
                setAdding(false)
                os().showToast(`Invitation sent to ${contactName(c)}`)
              }}
            />
          ))}
        </List>
      </Sheet>
    </Sub>
  )
}

function RecoveryKeyPage() {
  const key = usePrefs((s) => s.recoveryKey)
  const [shown, setShown] = useState(false)
  const demoKey = 'DEMO-7K2Q-9XWM-4PLA-R8TE-J3NC'
  return (
    <Sub title="Recovery Key">
      <List footer="A recovery key is a 28-character code you keep in a safe place. With it turned on, Apple can’t help you recover your account, but you have full control.">
        <Row
          title="Recovery Key"
          toggle={{
            value: key,
            onChange: (v) => {
              if (v) {
                showAlert({ title: 'Use Recovery Key?', message: 'You’ll need your recovery key or a trusted device to reset your password.', actions: [{ label: 'Cancel', style: 'cancel' }, { label: 'Use Recovery Key', onPress: () => { usePrefs.getState().setP({ recoveryKey: true }); setShown(true) } }] })
              } else usePrefs.getState().setP({ recoveryKey: false })
            },
          }}
        />
      </List>
      {key && (
        <List header="Your Key">
          <div className="stg-key">
            <code className={shown ? '' : 'blur'}>{demoKey}</code>
            <Button variant="gray" size="small" onClick={() => setShown(!shown)}>{shown ? 'Hide' : 'Show'}</Button>
          </div>
          <Note>Demo value — clearly fake and never used for anything.</Note>
        </List>
      )}
    </Sub>
  )
}

/** iOS 27: set up a new iPhone with Quick Start, verified by a recovery contact's device. */
function QuickStartPage() {
  const [step, setStep] = useState(0)
  const [who, setWho] = useState('mom')
  useEffect(() => {
    if (step === 1) {
      const t = window.setTimeout(() => setStep(2), 2200)
      return () => window.clearTimeout(t)
    }
    if (step === 3) {
      const t = window.setTimeout(() => setStep(4), 1600)
      return () => window.clearTimeout(t)
    }
  }, [step])
  const steps = ['Choose contact', 'Bring devices together', 'Approve on their iPhone', 'Verify code', 'Done']
  return (
    <Sub title="Quick Start">
      <div className="stg-qs">
        <div className="stg-qs-steps">{steps.map((s, i) => <span key={s} className={i <= step ? 'on' : ''} title={s} />)}</div>
        {step === 0 && (
          <div className="anim-up">
            <h2 className="stg-qs-title">Recover with Quick Start</h2>
            <p className="secondary">Locked out on a new iPhone? Hold it next to your recovery contact’s iPhone. Their device vouches for you so you can sign in without your old password.</p>
            <List header="Recovery Contact">
              {usePrefs.getState().recoveryContacts.map((c) => (
                <Row key={c} icon={<Avatar id={c} size={32} />} title={contactName(c, 'full')} onClick={() => setWho(c)} trailing={who === c ? <Check size={20} className="stg-check" /> : <span style={{ width: 20 }} />} />
              ))}
            </List>
            <Button block onClick={() => setStep(1)}>Continue</Button>
          </div>
        )}
        {step === 1 && (
          <div className="anim-up center">
            <div className="stg-qs-devices">
              <div className="stg-qs-phone"><Smartphone size={54} strokeWidth={1.4} /><span>New iPhone</span></div>
              <div className="stg-qs-rings"><i /><i /><i /></div>
              <div className="stg-qs-phone"><Avatar id={who} size={40} /><span>{contactName(who)}’s iPhone</span></div>
            </div>
            <h2 className="stg-qs-title">Looking for {contactName(who)}’s iPhone…</h2>
            <p className="secondary">Keep both devices unlocked and close together.</p>
          </div>
        )}
        {step === 2 && (
          <div className="anim-up center">
            <div className="stg-qs-approve">
              <Avatar id={who} size={48} />
              <div className="t-headline">{contactName(who)}’s iPhone</div>
              <div className="secondary t-subhead">“Jamie is recovering their Apple Account. Is Jamie with you?”</div>
              <div className="row gap8" style={{ marginTop: 12 }}>
                <Button variant="gray" size="medium" onClick={() => setStep(0)}>Not Now</Button>
                <Button size="medium" onClick={() => setStep(3)}>Approve</Button>
              </div>
            </div>
            <p className="secondary t-footnote">Simulated: tap Approve as {contactName(who)}.</p>
          </div>
        )}
        {step === 3 && (
          <div className="anim-up center">
            <div className="stg-code">
              <div className="t-footnote secondary">Code shown on {contactName(who)}’s iPhone</div>
              <div className="stg-code-digits typing">{'482915'.split('').map((d, i) => <span key={i} style={{ animationDelay: `${i * 0.2}s` }}>{d}</span>)}</div>
            </div>
            <div className="row gap8" style={{ justifyContent: 'center' }}><Spinner size={16} /> Verifying…</div>
          </div>
        )}
        {step === 4 && (
          <div className="anim-pop center">
            <div className="stg-qs-done"><Check size={44} strokeWidth={3} /></div>
            <h2 className="stg-qs-title">You’re Back In</h2>
            <p className="secondary">{contactName(who)} verified it’s you. Your new iPhone can now restore from iCloud Backup. You’ll be asked to create a new password.</p>
            <Button block variant="tinted" onClick={() => setStep(0)}>Run Demo Again</Button>
          </div>
        )}
      </div>
    </Sub>
  )
}

// ------------------------------------------------------------------ iCloud
const STORAGE = [
  { label: 'Photos', gb: 24.1, color: '#ff9f0a' },
  { label: 'Backups', gb: 8.2, color: '#af52de' },
  { label: 'Messages', gb: 4.3, color: '#34c759' },
  { label: 'Drive', gb: 3.1, color: '#0a84ff' },
  { label: 'Other', gb: 2.3, color: '#8e8e93' },
]

export function StorageBar({ items, total, used }: { items: { label: string; gb: number; color: string }[]; total: number; used?: number }) {
  const sum = used ?? items.reduce((a, b) => a + b.gb, 0)
  return (
    <div className="stg-storage">
      <div className="stg-storage-head"><span className="t-headline">{total >= 100 ? 'iPhone' : 'iCloud+'}</span><span className="secondary t-subhead">{sum.toFixed(1)} GB of {total} GB Used</span></div>
      <div className="stg-storage-bar">
        {items.map((i) => <span key={i.label} style={{ width: `${(i.gb / total) * 100}%`, background: i.color }} />)}
      </div>
      <div className="stg-storage-legend">{items.map((i) => <span key={i.label}><i style={{ background: i.color }} />{i.label}</span>)}</div>
    </div>
  )
}

function ICloudPage() {
  const prefs = usePrefs()
  const prioritySync = useOS((s) => s.prioritySync)
  return (
    <Sub title="iCloud">
      <List>
        <StorageBar items={STORAGE} total={50} />
        <Push title="Manage Storage" page={() => <ManageStorage />} />
      </List>
      <List header="Saved to iCloud">
        <Push icon={<Ico c="#ff9500" i={ImageIcon} />} title="Photos" detail={prefs.photos.icloud ? (prioritySync ? 'On · Priority' : 'On') : 'Off'} page={() => <ICloudPhotos />} />
        <Row icon={<Ico c="#0a84ff" i={FolderClosed} fill />} title="iCloud Drive" detail="On" />
        <Row icon={<Ico c="#8e8e93" i={KeyRound} />} title="Passwords" detail="On" chevron onClick={() => os().launch('passwords')} />
        <Row icon={<Ico c="#34c759" i={MessageCircle} fill />} title="Messages in iCloud" detail="On" chevron onClick={() => os().launch('messages')} />
        <Row icon={<Ico c="#ffcc00" i={StickyNote} />} title="Notes" detail="On" chevron onClick={() => os().launch('notes')} />
      </List>
      <List header="Device Backups">
        <Row icon={<Ico c="#34c759" i={HardDriveUpload} />} title="iCloud Backup" subtitle={prefs.icloudBackup ? 'Last successful backup: Today 3:12 AM' : 'Off'} toggle={{ value: prefs.icloudBackup, onChange: (v) => prefs.setP({ icloudBackup: v }) }} />
      </List>
      <List header="iCloud+">
        <Row icon={<Ico c="#0a84ff" i={Globe2} />} title="Private Relay" detail="On" />
        <Row icon={<Ico c="#0a84ff" i={Mail} />} title="Hide My Email" detail="4 addresses" />
      </List>
      <List footer="Advanced Data Protection encrypts most iCloud data end-to-end.">
        <Row icon={<Ico c="#8e8e93" i={Lock} />} title="Advanced Data Protection" detail="Off" />
      </List>
    </Sub>
  )
}

function ManageStorage() {
  return (
    <Sub title="iCloud Storage">
      <List>
        <StorageBar items={STORAGE} total={50} />
      </List>
      <List header="Storage">
        {STORAGE.map((s) => <Row key={s.label} icon={<span className="stg-dot" style={{ background: s.color }} />} title={s.label} detail={`${s.gb} GB`} />)}
      </List>
      <List>
        <Row tint title={<span className="row gap6"><ArrowUpCircle size={18} /> Upgrade to iCloud+ 200 GB</span>} onClick={() => showAlert({ title: 'Upgrade Storage', message: 'Demo only — no purchases are made in the simulator.', actions: [{ label: 'OK' }] })} />
      </List>
    </Sub>
  )
}

/** iCloud Photos with iOS 27 priority syncing — recent and shared photos go first. */
export function ICloudPhotos() {
  const photos = useOS((s) => s.photos)
  const prioritySync = useOS((s) => s.prioritySync)
  const p = usePrefs((s) => s.photos)
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const t = window.setInterval(() => setTick((n) => (n + 1) % 60), 160)
    return () => window.clearInterval(t)
  }, [])
  const queue = [...photos].slice(0, 6)
  const ordered = prioritySync ? [...queue].sort((a, b) => b.ts - a.ts) : [...queue].sort((a, b) => a.ts - b.ts)
  return (
    <Sub title="iCloud Photos">
      <List footer="Automatically upload and store your entire library in iCloud to access photos and videos from all your devices.">
        <Row title="Sync this iPhone" toggle={{ value: p.icloud, onChange: (v) => setPrefIn('photos', { icloud: v }) }} />
      </List>
      <List header={<span className="row gap6">Priority Syncing <New27 /></span>} footer="Photos you just took, and ones you’re sharing in Messages or Shared Albums, upload first so they appear on your other devices right away.">
        <Row title="Prioritize Recent & Shared" toggle={{ value: prioritySync, onChange: (v) => os().set({ prioritySync: v }) }} />
        <div className="stg-sync">
          {ordered.map((ph, i) => {
            const prog = Math.max(0, Math.min(1, (tick - i * 9) / 12))
            return (
              <div key={ph.id} className="stg-sync-item">
                <Scene scene={ph.scene} style={{ width: 44, height: 44, borderRadius: 8 }} />
                <div className="grow">
                  <div className="t-subhead nowrap">{ph.place ?? ph.description.slice(0, 28)}</div>
                  <div className="stg-sync-bar"><span style={{ width: `${prog * 100}%` }} /></div>
                </div>
                <span className="t-caption1 secondary">{prog >= 1 ? <Check size={16} className="stg-check" /> : i === 0 && prioritySync ? 'Priority' : `#${i + 1}`}</span>
              </div>
            )
          })}
        </div>
      </List>
      <List>
        <Row title="Optimize iPhone Storage" onClick={() => setPrefIn('photos', { optimize: true })} trailing={p.optimize ? <Check size={20} className="stg-check" /> : <span style={{ width: 20 }} />} />
        <Row title="Download and Keep Originals" onClick={() => setPrefIn('photos', { optimize: false })} trailing={!p.optimize ? <Check size={20} className="stg-check" /> : <span style={{ width: 20 }} />} />
      </List>
      <List>
        <Row title="Shared Albums" toggle={{ value: p.sharedAlbums, onChange: (v) => setPrefIn('photos', { sharedAlbums: v }) }} />
      </List>
    </Sub>
  )
}

// ------------------------------------------------------------------ Family
function FamilyPage() {
  const st = useOS((s) => s.screenTime)
  const [askToBuy, setAskToBuy] = useState(true)
  const [location, setLocation] = useState(true)
  const nav = useNav()
  const members = [
    { id: 'mom', role: 'Organizer' },
    { id: 'dad', role: 'Parent/Guardian' },
    { id: 'me', role: 'Me · Parent/Guardian (demo)' },
    { id: 'mia', role: 'Child · Age 10' },
  ]
  return (
    <Sub title="Family">
      <div className="stg-family-head">
        {members.map((m) => <Avatar key={m.id} id={m.id} size={56} color={m.id === 'me' ? '#6aa9ff' : undefined} />)}
      </div>
      <List>
        {members.map((m) =>
          m.id === 'mia' ? (
            <Row key={m.id} icon={<Avatar id="mia" size={36} />} title="Mia Park" subtitle={`${m.role}${st.childMode ? ' · simulating' : ''}`} chevron onClick={() => nav.push(ROUTES['screentime/family'].el())} />
          ) : (
            <Row key={m.id} icon={<Avatar id={m.id} size={36} color={m.id === 'me' ? '#6aa9ff' : undefined} />} title={m.id === 'me' ? 'Jamie Park' : contactName(m.id, 'full')} subtitle={m.role} />
          ),
        )}
        <Row tint title="Add Member…" onClick={() => showAlert({ title: 'Add Family Member', message: 'Invite someone with Messages or create a child account. (Demo — your family already has 4 members.)', actions: [{ label: 'OK' }] })} />
      </List>
      <List header="Family Features">
        <Go to="screentime/family" icon={<Ico c="#5856d6" i={Users} />} title="Child Account: Mia" detail={st.childMode ? 'Child Mode On' : undefined} />
        <Row title="Ask to Buy (Mia)" toggle={{ value: askToBuy, onChange: setAskToBuy }} />
        <Row title="Location Sharing" toggle={{ value: location, onChange: setLocation }} />
        <Go to="screentime" title="Screen Time" />
        <Row title="Subscriptions" detail="Apple One Family" chevron onClick={() => nav.push(<Subscriptions />)} />
      </List>
    </Sub>
  )
}

export function registerAccount() {
  Object.assign(ROUTES, {
    account: { title: 'Apple Account', el: () => <AccountPage />, keywords: 'apple account icloud sign out devices name payment subscriptions' },
    'account/security': { title: 'Sign-In & Security', el: () => <SecurityPage />, keywords: 'password two factor recovery contact recovery key passkeys quick start', parent: 'account' },
    'account/recovery': { title: 'Account Recovery', el: () => <RecoveryPage />, keywords: 'recovery contact recovery code get code', parent: 'account/security' },
    'account/quickstart': { title: 'Quick Start with Recovery Contact', el: () => <QuickStartPage />, keywords: 'quick start recovery contact new iphone setup', parent: 'account/security' },
    'account/icloud': { title: 'iCloud', el: () => <ICloudPage />, keywords: 'icloud storage backup drive photos private relay', parent: 'account' },
    'account/icloud-photos': { title: 'iCloud Photos', el: () => <ICloudPhotos />, keywords: 'icloud photos priority syncing sync upload shared albums', parent: 'account/icloud' },
    'account/family': { title: 'Family', el: () => <FamilyPage />, keywords: 'family sharing mia ask to buy child', parent: 'account' },
  })
}
