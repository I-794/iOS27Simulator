import { useEffect, useState } from 'react'
import { Copy, Printer, FolderDown, Heart, Link, FileText, Check, ImageDown, Sparkles } from 'lucide-react'
import { useOS, type ShareRequest } from '../os/store'
import { Sheet } from '../ui/overlay'
import { Avatar } from '../ui/controls'
import { AppIconArt } from '../icons/AppIconArt'
import { Scene } from '../art/Scene'
import { contactName } from '../os/data/people'
import type { AppId } from '../os/types'

/** Content-based share suggestions (iOS 27): who is this content most relevant to? */
export function suggestRecipients(req: ShareRequest): { id: string; reason: string }[] {
  const st = useOS.getState()
  const text = `${req.title} ${req.payload ?? ''}`.toLowerCase()
  const photo = req.photoId ? st.photos.find((p) => p.id === req.photoId) : undefined
  const out: { id: string; reason: string }[] = []
  const add = (id: string, reason: string) => !out.some((o) => o.id === id) && out.push({ id, reason })
  if (photo?.pets?.includes('Biscuit') || /biscuit|dog/.test(text)) {
    if (photo?.id === 'p-biscuit-beach') add('dad', 'Asked for this photo')
    add('grandma', 'Loves Biscuit photos')
    add('mom', 'Shares Park Family album')
  }
  if (photo?.people?.length) photo.people.filter((p) => p !== 'me').forEach((p) => add(p, 'In this photo'))
  if (/robot|intake|cad|swerve|motor/.test(text) || photo?.keywords.includes('robotics')) {
    add('alex', 'Robotics teammate')
    add('nora', 'Robotics teammate')
    add('delgado', 'Robotics advisor')
  }
  if (/drum|band|concert|cadence/.test(text)) {
    add('sam', 'Drumline')
    add('leo', 'Drumline')
  }
  if (/chem|study|stoichiometry/.test(text)) add('priya', 'Study group')
  for (const c of ['mom', 'alex', 'sam', 'dad']) add(c, 'Frequent')
  return out.slice(0, 6)
}

const DEVICES = [
  { id: 'mom-iphone', name: 'Mom’s iPhone', owner: 'mom' },
  { id: 'alex-iphone', name: 'Alex’s iPhone', owner: 'alex' },
  { id: 'imac', name: 'Family iMac', owner: 'dad' },
  { id: 'ipad', name: 'Jamie’s iPad', owner: 'me' },
]

export function ShareSheet() {
  const req = useOS((s) => s.shareRequest)
  const [open, setOpen] = useState(false)
  const [airdrop, setAirdrop] = useState<Record<string, number>>({})
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    setOpen(!!req)
    setAirdrop({})
    setCopied(false)
  }, [req])

  const close = () => {
    setOpen(false)
    window.setTimeout(() => useOS.setState({ shareRequest: null }), 300)
  }
  if (!req) return null
  const st = useOS.getState()
  const photo = req.photoId ? st.photos.find((p) => p.id === req.photoId) : undefined
  const recips = suggestRecipients(req)

  const sendTo = (contact: string) => {
    const conv = st.ensureConversation([contact])
    const id = st.sendMessage(conv, req.photoId ? { attachment: { kind: 'photo', photoId: req.photoId } } : req.kind === 'link' ? { attachment: { kind: 'link', url: req.payload, title: req.title, subtitle: req.payload } } : { text: req.payload ?? req.title })
    window.setTimeout(() => useOS.getState().patchMessage(conv, id, { status: 'delivered' }), 700)
    st.showToast(`Sent to ${contactName(contact)}`)
    close()
  }

  const airdropTo = (dev: string, name: string) => {
    // iOS 27: noticeably faster AirDrop — transfer completes almost immediately
    const size = photo ? photo.sizeMB : 0.2
    const start = performance.now()
    const dur = Math.min(900, 250 + size * 60)
    const step = () => {
      const p = Math.min(1, (performance.now() - start) / dur)
      setAirdrop((a) => ({ ...a, [dev]: p }))
      if (p < 1) requestAnimationFrame(step)
      else {
        useOS.getState().flashIsland({ kind: 'airdrop', title: `Sent to ${name}`, subtitle: `${photo ? `${size} MB · full resolution` : req.title} in ${(dur / 1000).toFixed(1)} s`, duration: 2400 })
      }
    }
    requestAnimationFrame(step)
  }

  const apps: { app: AppId; label: string; run: () => void }[] = [
    { app: 'messages', label: 'Messages', run: () => { close(); st.launch('messages', { route: 'compose' }) } },
    { app: 'mail', label: 'Mail', run: () => { close(); st.launch('mail', { route: `compose/${encodeURIComponent(req.title)}` }) } },
    { app: 'notes', label: 'Notes', run: () => { st.addNote({ title: req.title, blocks: [{ t: 'h1', text: req.title }, { t: 'p', text: req.payload ?? '' }], folder: 'Notes' }); st.showToast('Added to Notes'); close() } },
    { app: 'reminders', label: 'Reminders', run: () => { st.addReminder({ title: req.title, list: 'reminders' }); st.showToast('Added to Reminders'); close() } },
    { app: 'freeform', label: 'Freeform', run: () => { st.showToast('Added to Freeform board'); close() } },
    { app: 'journal', label: 'Journal', run: () => { st.set({ journal: [{ id: `j-${Date.now()}`, ts: Date.now(), title: req.title, body: '', photos: req.photoId ? [req.photoId] : [], attachments: [] }, ...st.journal] }); st.showToast('Added to Journal'); close() } },
  ]

  return (
    <Sheet open={open} onClose={close} detent="medium" glassy title={undefined} closeButton={false} label="Share">
      <div className="share">
        <div className="share-head">
          <div className="share-thumb">
            {photo ? <Scene scene={photo.scene} /> : <span className="share-thumb-icon"><AppIconArt app={req.app} size={44} /></span>}
          </div>
          <div className="grow" style={{ minWidth: 0 }}>
            <div className="t-headline nowrap">{req.title}</div>
            <div className="t-footnote secondary nowrap">{photo ? `${photo.width}×${photo.height} · ${photo.sizeMB} MB · Full Resolution` : req.payload ?? req.kind}</div>
          </div>
          <button className="bar-btn icon glass" aria-label="Close" onClick={close}>✕</button>
        </div>
        <div className="share-caption t-caption1 secondary"><Sparkles size={12} /> Suggested based on what you’re sharing</div>
        <div className="share-row scroll">
          {recips.map((r) => (
            <button key={r.id} className="share-person" onClick={() => sendTo(r.id)}>
              <span style={{ position: 'relative' }}><Avatar id={r.id} size={60} /><span className="share-badge"><AppIconArt app="messages" size={20} /></span></span>
              <span className="t-caption1 nowrap">{contactName(r.id)}</span>
              <span className="t-caption2 secondary nowrap">{r.reason}</span>
            </button>
          ))}
        </div>
        <div className="share-row scroll">
          <div className="share-airdrop-title t-caption1 secondary">AirDrop</div>
          {DEVICES.map((d) => {
            const p = airdrop[d.id]
            return (
              <button key={d.id} className="share-person" onClick={() => p === undefined && airdropTo(d.id, d.name)}>
                <span className="share-ad-ring">
                  <Avatar id={d.owner === 'me' ? 'me' : d.owner} size={56} />
                  {p !== undefined && (
                    <svg className="share-progress" viewBox="0 0 64 64"><circle cx="32" cy="32" r="30" fill="none" stroke="#0a84ff" strokeWidth="4" strokeDasharray={`${p * 188} 200`} transform="rotate(-90 32 32)" strokeLinecap="round" /></svg>
                  )}
                </span>
                <span className="t-caption1 nowrap">{p === 1 ? <span style={{ color: 'var(--blue)' }}>Sent</span> : p !== undefined ? 'Sending…' : d.name}</span>
              </button>
            )
          })}
        </div>
        <div className="share-row scroll">
          {apps.map((a) => (
            <button key={a.app} className="share-person" onClick={a.run}>
              <AppIconArt app={a.app} size={60} />
              <span className="t-caption1">{a.label}</span>
            </button>
          ))}
        </div>
        <div className="list" style={{ margin: '8px 0 12px', background: 'var(--fill-quaternary)' }}>
          <button className="row-item" onClick={() => { navigator.clipboard?.writeText(req.payload ?? req.title).catch(() => {}); setCopied(true) }}>
            <span className="grow">{copied ? 'Copied' : 'Copy'}</span>{copied ? <Check size={20} /> : <Copy size={20} />}
          </button>
          {photo && <button className="row-item" onClick={() => { st.showToast('Saved at full resolution'); close() }}><span className="grow">Save Image</span><ImageDown size={20} /></button>}
          {photo && <button className="row-item" onClick={() => { st.updatePhoto(photo.id, { favorite: !photo.favorite }); close() }}><span className="grow">{photo.favorite ? 'Unfavorite' : 'Favorite'}</span><Heart size={20} /></button>}
          {req.kind === 'link' && <button className="row-item" onClick={() => { st.showToast('Link copied'); close() }}><span className="grow">Copy Link</span><Link size={20} /></button>}
          <button className="row-item" onClick={() => { st.showToast('Saved to Files · PDF created in 0.2 s'); close() }}><span className="grow">Save to Files</span><FolderDown size={20} /></button>
          <button className="row-item" onClick={() => { st.showToast('Sent to printer'); close() }}><span className="grow">Print</span><Printer size={20} /></button>
          <button className="row-item" onClick={() => { st.showToast('Saved as PDF'); close() }}><span className="grow">Save as PDF</span><FileText size={20} /></button>
        </div>
      </div>
    </Sheet>
  )
}
