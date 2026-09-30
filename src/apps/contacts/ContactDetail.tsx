import { useState, type ReactNode } from 'react'
import { MessageCircle, Phone, Video, Mail, Star, Share, MapPin, Gift, ChevronRight, Ban, Navigation, Building2 } from 'lucide-react'
import { Page } from '../../ui/nav'
import { List, Row } from '../../ui/list'
import { Avatar } from '../../ui/controls'
import { showAlert } from '../../ui/overlay'
import { useOS } from '../../os/store'
import { contactById, ME } from '../../os/data/people'
import { fmtRelative } from '../../os/time'
import { useContactsLocal } from './contactsStore'
import { fullName, fmtPhone, messageContact, callContact, facetimeContact, mailContact, shareContact, directionsTo, MY_CARD } from './shared'
import './contacts.css'

function QuickButton({ icon, label, onClick, disabled }: { icon: ReactNode; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button className="ct-quick glass interactive" onClick={onClick} aria-label={label} disabled={disabled}>
      {icon}
      <span>{label}</span>
    </button>
  )
}

/** Contact Poster style header + details. Used by Contacts, Phone (Contacts tab) and Messages. */
export function ContactDetailPage({ id, onBack }: { id: string; onBack?: () => void }) {
  const isMe = id === 'me'
  const c = isMe ? undefined : contactById(id)
  const [scrolled, setScrolled] = useState(false)
  const favorites = useContactsLocal((s) => s.favorites)
  const notes = useContactsLocal((s) => s.notes)
  const blocked = useContactsLocal((s) => s.blocked)
  const local = useContactsLocal()
  const convs = useOS((s) => s.conversations)
  const conv = convs.find((x) => x.participants.length === 1 && x.participants[0] === id)
  const last = conv?.messages[conv.messages.length - 1]

  const name = isMe ? `${ME.first} ${ME.last}` : fullName(c)
  const color = isMe ? MY_CARD.color : c?.color ?? '#8e8e93'
  const phones = isMe ? [ME.phone] : c?.phones ?? []
  const emails = isMe ? [ME.email] : c?.emails ?? []
  const address = isMe ? ME.home : c?.address
  const subtitle = isMe ? 'My Card' : c?.company ?? (c?.nickname && c.nickname !== c.first ? `“${c.nickname}”` : c?.relation)
  const fav = favorites.includes(id)
  const note = notes[id] ?? c?.notes ?? ''

  return (
    <Page
      title={name}
      large={false}
      inlineTitle={<span style={{ opacity: scrolled ? 1 : 0, transition: 'opacity .2s' }}>{name}</span>}
      onBack={onBack}
      onScroll={(t) => setScrolled(t > 250)}
      grouped
      className="ct-detail"
    >
      <div className="ct-poster" style={{ ['--ct-color' as string]: color }}>
        <div className="ct-poster-bg" />
        <div className="ct-poster-avatar">
          <Avatar id={isMe ? 'me' : id} size={112} color={color} />
        </div>
        <h1 className="ct-poster-name">{name}</h1>
        {subtitle && <div className="ct-poster-sub">{subtitle}</div>}
        <div className="ct-quick-row">
          <QuickButton icon={<MessageCircle size={22} fill="currentColor" strokeWidth={0} />} label="message" onClick={() => messageContact(id)} disabled={isMe} />
          <QuickButton icon={<Phone size={21} fill="currentColor" strokeWidth={0} />} label="call" onClick={() => callContact(id)} disabled={isMe} />
          <QuickButton icon={<Video size={23} fill="currentColor" strokeWidth={0} />} label="video" onClick={() => facetimeContact(id)} disabled={isMe || c?.isBusiness} />
          <QuickButton icon={<Mail size={22} />} label="mail" onClick={() => mailContact(id)} disabled={isMe} />
        </div>
      </div>

      <div className="ct-sections">
        {c?.isBusiness && c.company && (
          <List>
            <Row title={<span className="row gap8"><Building2 size={17} className="secondary" /> {c.company}</span>} compact />
          </List>
        )}
        <List>
          {phones.map((p, i) => (
            <button key={p} className="row-item ct-field" onClick={() => !isMe && callContact(id)}>
              <span className="row-main">
                <span className="ct-field-label">{i === 0 ? (c?.isBusiness ? 'main' : 'mobile') : 'home'}</span>
                <span className="ct-field-value">{fmtPhone(p)}</span>
              </span>
              {!isMe && (
                <span className="row gap8">
                  <span className="ct-mini-btn" role="button" aria-label="Message" onClick={(e) => { e.stopPropagation(); messageContact(id) }}><MessageCircle size={16} fill="currentColor" strokeWidth={0} /></span>
                  <span className="ct-mini-btn" role="button" aria-label="Call" onClick={(e) => { e.stopPropagation(); callContact(id) }}><Phone size={15} fill="currentColor" strokeWidth={0} /></span>
                </span>
              )}
            </button>
          ))}
          {!isMe && !c?.isBusiness && (
            <button className="row-item ct-field" onClick={() => facetimeContact(id)}>
              <span className="row-main">
                <span className="ct-field-label">FaceTime</span>
              </span>
              <span className="row gap8">
                <span className="ct-mini-btn" role="button" aria-label="FaceTime Video" onClick={(e) => { e.stopPropagation(); facetimeContact(id) }}><Video size={16} fill="currentColor" strokeWidth={0} /></span>
                <span className="ct-mini-btn" role="button" aria-label="FaceTime Audio" onClick={(e) => { e.stopPropagation(); useOS.getState().launch('facetime', { route: `audio/${id}` }) }}><Phone size={15} fill="currentColor" strokeWidth={0} /></span>
              </span>
            </button>
          )}
        </List>
        {emails.length > 0 && (
          <List>
            {emails.map((e, i) => (
              <button key={e} className="row-item ct-field" onClick={() => !isMe && mailContact(id)}>
                <span className="row-main">
                  <span className="ct-field-label">{i === 0 ? (isMe ? 'iCloud' : c?.isBusiness ? 'work' : 'home') : 'work'}</span>
                  <span className="ct-field-value">{e}</span>
                </span>
              </button>
            ))}
          </List>
        )}
        {address && (
          <List>
            <button className="row-item ct-field" onClick={() => directionsTo(address)}>
              <span className="row-main">
                <span className="ct-field-label">{c?.isBusiness ? 'work' : 'home'}</span>
                <span className="ct-field-value plain">{address}</span>
              </span>
              <span className="ct-map-thumb" aria-hidden>
                <svg viewBox="0 0 60 60" width="60" height="60">
                  <rect width="60" height="60" fill="var(--ct-map-bg)" />
                  <path d="M0 22 L60 30 M20 0 L26 60 M0 48 L60 44 M44 0 L40 60" stroke="var(--ct-map-road)" strokeWidth="4" />
                  <circle cx="30" cy="30" r="7" fill="var(--red)" stroke="#fff" strokeWidth="2" />
                </svg>
              </span>
            </button>
            <Row title="Get Directions" tint icon={<Navigation size={18} color="var(--accent)" />} onClick={() => directionsTo(address)} compact />
          </List>
        )}
        {(c?.birthday || isMe) && (
          <List>
            <div className="row-item ct-field">
              <span className="row-main">
                <span className="ct-field-label">birthday</span>
                <span className="ct-field-value plain row gap6"><Gift size={15} className="secondary" /> {c?.birthday ?? 'June 14'}</span>
              </span>
            </div>
          </List>
        )}
        {!isMe && (
          <List>
            <label className="row-item ct-field" style={{ alignItems: 'flex-start' }}>
              <span className="row-main">
                <span className="ct-field-label">Notes</span>
                <textarea
                  className="ct-notes"
                  value={note}
                  placeholder="Add notes"
                  rows={2}
                  onChange={(e) => local.set({ notes: { ...notes, [id]: e.target.value } })}
                />
              </span>
            </label>
          </List>
        )}
        {conv && last && (
          <List header="Recent Messages">
            <button className="row-item" onClick={() => messageContact(id)}>
              <MessageCircle size={20} color="var(--green)" fill="var(--green)" strokeWidth={0} />
              <span className="row-main">
                <span className="row-title">{last.text ?? 'Attachment'}</span>
                <span className="row-sub">{fmtRelative(last.ts)}</span>
              </span>
              <ChevronRight size={18} className="tertiary" />
            </button>
          </List>
        )}
        {!isMe && (
          <List>
            <Row title="Send Message" tint onClick={() => messageContact(id)} compact />
            <Row title="Share Contact" tint trailing={<Share size={18} color="var(--accent)" />} onClick={() => shareContact(id)} compact />
            <Row
              title={fav ? 'Remove from Favorites' : 'Add to Favorites'}
              tint
              trailing={<Star size={18} color="var(--accent)" fill={fav ? 'var(--accent)' : 'none'} />}
              onClick={() => {
                local.toggleFavorite(id)
                useOS.getState().showToast(fav ? 'Removed from Favorites' : 'Added to Favorites', '⭐️')
              }}
              compact
            />
            {!c?.isBusiness && <Row title="Share My Location" tint trailing={<MapPin size={18} color="var(--accent)" />} onClick={() => useOS.getState().showToast(`Sharing location with ${c?.first}`, '📍')} compact />}
          </List>
        )}
        {!isMe && (
          <List>
            <Row
              title={blocked.includes(id) ? 'Unblock this Caller' : 'Block this Caller'}
              destructive={!blocked.includes(id)}
              tint={blocked.includes(id)}
              trailing={<Ban size={17} color={blocked.includes(id) ? 'var(--accent)' : 'var(--red)'} />}
              onClick={() => {
                if (blocked.includes(id)) return local.toggleBlocked(id)
                showAlert({
                  title: `Block ${name}?`,
                  message: 'You will not receive phone calls, messages, or FaceTime from people on the block list.',
                  actions: [{ label: 'Cancel', style: 'cancel' }, { label: 'Block Contact', style: 'destructive', onPress: () => local.toggleBlocked(id) }],
                })
              }}
              compact
            />
          </List>
        )}
        {isMe && (
          <List footer="Your name and photo are shared with people you message or call, according to your preferences.">
            <Row title="Contact Photo & Poster" chevron onClick={() => useOS.getState().showToast('Poster: Color · Indigo', '🎨')} compact />
            <Row title="Share Contact" tint onClick={() => shareContact('me')} compact />
          </List>
        )}
      </div>
    </Page>
  )
}
