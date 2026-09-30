import { useState } from 'react'
import { Phone, Video, Mail, Info, MapPin, BellOff, Pin, UserPlus, Link2 } from 'lucide-react'
import type { Conversation } from '../../os/types'
import { useOS } from '../../os/store'
import { Sheet } from '../../ui/overlay'
import { Avatar } from '../../ui/controls'
import { List, Row } from '../../ui/list'
import { Scene } from '../../art/Scene'
import { contactById, CONTACTS, ME } from '../../os/data/people'
import { fmtPhone, fullName, callContact, facetimeContact, mailContact } from '../contacts/shared'
import { convTitle, sendMsg } from './engine'

/** Conversation details: contact card with call / FaceTime / mail, alerts, pins, shared photos. */
export function ConvDetails({ open, onClose, conv, onOpenPhoto }: { open: boolean; onClose: () => void; conv: Conversation; onOpenPhoto: (id: string) => void }) {
  const photos = useOS((s) => s.photos)
  const [editingName, setEditingName] = useState(false)
  const [name, setName] = useState(conv.name ?? '')
  const group = conv.participants.length > 1
  const c = !group ? contactById(conv.participants[0]) : undefined
  const title = convTitle(conv)
  const patchConv = (p: Partial<Conversation>) => useOS.getState().set({ conversations: useOS.getState().conversations.map((x) => (x.id === conv.id ? { ...x, ...p } : x)) })
  const media = conv.messages.filter((m) => (m.attachment?.kind === 'photo' || m.attachment?.kind === 'video') && m.attachment.photoId && !m.attachment.offloaded).reverse()
  const links = conv.messages.filter((m) => m.attachment?.kind === 'link')
  const target = conv.participants[0]

  return (
    <Sheet open={open} onClose={onClose} detent="large" title="" trailing={<button className="bar-btn glass interactive" onClick={onClose}>Done</button>} closeButton={false} label={`${title} details`} style={{ ['--sheet-bg' as string]: 'var(--grouped-background)' }}>
      <div className="msg-details">
        <div className="msg-details-head">
          {group ? (
            <div className="msg-details-cluster">
              {conv.participants.slice(0, 3).map((p, i) => <Avatar key={p} id={p} size={64} style={{ marginLeft: i ? -22 : 0, boxShadow: '0 0 0 3px var(--elevated-background)' }} />)}
            </div>
          ) : (
            <Avatar id={target} size={96} />
          )}
          {editingName ? (
            <input
              className="msg-details-name-input"
              value={name}
              autoFocus
              placeholder="Group Name"
              onChange={(e) => setName(e.target.value)}
              onBlur={() => { patchConv({ name: name.trim() || undefined }); setEditingName(false) }}
              onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
              enterKeyHint="done"
            />
          ) : (
            <h2 className="msg-details-name">{title}</h2>
          )}
          {c && <div className="t-subhead secondary">{c.isBusiness ? c.company : fmtPhone(c.phones[0])}</div>}
          {group && <button className="btn plain small" onClick={() => setEditingName(true)}>Change Name and Photo</button>}
          {!group && (
            <div className="msg-details-actions">
              <button className="glass interactive" onClick={() => callContact(target)}><Phone size={20} fill="currentColor" strokeWidth={0} /><span>call</span></button>
              <button className="glass interactive" onClick={() => facetimeContact(target)} disabled={c?.isBusiness}><Video size={21} fill="currentColor" strokeWidth={0} /><span>FaceTime</span></button>
              <button className="glass interactive" onClick={() => mailContact(target)}><Mail size={20} /><span>mail</span></button>
              <button className="glass interactive" onClick={() => useOS.getState().launch('contacts', { route: `contact/${target}` })}><Info size={20} /><span>info</span></button>
            </div>
          )}
        </div>

        {group && (
          <List header={`${conv.participants.length + 1} Members`}>
            {conv.participants.map((p) => (
              <Row
                key={p}
                icon={<Avatar id={p} size={34} />}
                title={fullName(contactById(p))}
                subtitle={contactById(p)?.company}
                trailing={
                  <span className="row gap8">
                    <button className="msg-mini-btn" aria-label={`Call ${fullName(contactById(p))}`} onClick={(e) => { e.stopPropagation(); callContact(p) }}><Phone size={15} fill="currentColor" strokeWidth={0} /></button>
                    <button className="msg-mini-btn" aria-label={`FaceTime ${fullName(contactById(p))}`} onClick={(e) => { e.stopPropagation(); facetimeContact(p) }}><Video size={16} fill="currentColor" strokeWidth={0} /></button>
                  </span>
                }
                onClick={() => useOS.getState().launch('contacts', { route: `contact/${p}` })}
              />
            ))}
            <Row icon={<span className="msg-add-member"><UserPlus size={18} /></span>} title="Add Member" tint onClick={() => {
              const next = CONTACTS.find((x) => !x.isBusiness && !conv.participants.includes(x.id) && ['nora', 'alex', 'mia'].includes(x.id))
              if (!next) return
              patchConv({ participants: [...conv.participants, next.id] })
              useOS.getState().showToast(`${next.first} added to ${title}`, '👥')
            }} />
          </List>
        )}

        <List>
          <Row icon={<MapPin size={20} color="var(--accent)" />} title="Send My Current Location" tint onClick={() => { sendMsg(conv.id, { attachment: { kind: 'location', title: 'My Location', subtitle: ME.home } }); onClose() }} />
          <Row icon={<MapPin size={20} color="var(--green)" />} title="Share My Location" tint onClick={() => useOS.getState().showToast(`Sharing location with ${title} for 1 hour`, '📍')} />
        </List>
        <List>
          <Row icon={<BellOff size={20} color="var(--indigo)" />} title="Hide Alerts" toggle={{ value: !!conv.muted, onChange: (v) => patchConv({ muted: v }) }} />
          <Row icon={<Pin size={20} color="var(--orange)" />} title="Pin" toggle={{ value: !!conv.pinned, onChange: (v) => patchConv({ pinned: v }) }} />
        </List>

        {media.length > 0 && (
          <List header={`Photos · ${media.length}`}>
            <div className="msg-details-grid">
              {media.map((m) => {
                const p = photos.find((x) => x.id === m.attachment!.photoId)
                return (
                  <button key={m.id} onClick={() => onOpenPhoto(m.attachment!.photoId!)} aria-label={p?.description ?? 'Photo'}>
                    <Scene scene={p?.scene ?? 'sunset-beach'} />
                  </button>
                )
              })}
            </div>
          </List>
        )}
        {links.length > 0 && (
          <List header="Links">
            {links.map((m) => (
              <Row key={m.id} icon={<Link2 size={18} color="var(--accent)" />} title={m.attachment!.title ?? m.attachment!.url} subtitle={m.attachment!.subtitle} onClick={() => useOS.getState().launch('safari', { route: `url/${m.attachment!.url}` })} />
            ))}
          </List>
        )}
      </div>
    </Sheet>
  )
}
