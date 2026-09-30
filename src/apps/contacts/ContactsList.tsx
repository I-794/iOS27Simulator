import { useMemo, useRef, useState } from 'react'
import { CONTACTS, ME } from '../../os/data/people'
import { Avatar, SearchField } from '../../ui/controls'
import { openMenu } from '../../ui/overlay'
import { useLongPress, screenScale } from '../../os/hooks'
import { MessageCircle, Phone, Video, Mail, Share, Star } from 'lucide-react'
import type { Contact } from '../../os/types'
import { sortKey, indexLetter, contactMatches, fullName, messageContact, callContact, facetimeContact, mailContact, shareContact, MY_CARD } from './shared'
import { useContactsLocal } from './contactsStore'
import './contacts.css'

const ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ#'.split('')

function ContactRow({ c, onOpen }: { c: Contact; onOpen: (id: string) => void }) {
  const toggleFavorite = useContactsLocal((s) => s.toggleFavorite)
  const favs = useContactsLocal((s) => s.favorites)
  const lp = useLongPress((el) =>
    openMenu(
      el,
      [
        { label: 'Message', icon: <MessageCircle size={18} />, onSelect: () => messageContact(c.id) },
        { label: 'Call', icon: <Phone size={18} />, onSelect: () => callContact(c.id) },
        ...(c.isBusiness ? [] : [{ label: 'FaceTime', icon: <Video size={18} />, onSelect: () => facetimeContact(c.id) }]),
        { label: 'Mail', icon: <Mail size={18} />, onSelect: () => mailContact(c.id) },
        { label: favs.includes(c.id) ? 'Remove from Favorites' : 'Add to Favorites', icon: <Star size={18} />, separatorBefore: true, onSelect: () => toggleFavorite(c.id) },
        { label: 'Share Contact', icon: <Share size={18} />, onSelect: () => shareContact(c.id) },
      ],
      { title: fullName(c) },
    ),
  )
  const bold = c.isBusiness ? c.first : c.last ?? c.first
  const light = c.isBusiness ? '' : c.last ? c.first : ''
  return (
    <button className="ct-row" onClick={() => onOpen(c.id)} {...lp}>
      <span className="ct-row-name">
        {light && <span>{light} </span>}
        <b>{bold}</b>
      </span>
    </button>
  )
}

/** Alphabetical contacts list with My Card, search and a letter index. */
export function ContactsList({ onOpen, showMyCard = true }: { onOpen: (id: string) => void; showMyCard?: boolean }) {
  const [q, setQ] = useState('')
  const root = useRef<HTMLDivElement>(null)
  const sections = useMemo(() => {
    const list = CONTACTS.filter((c) => contactMatches(c, q)).sort((a, b) => sortKey(a).localeCompare(sortKey(b)))
    const map = new Map<string, Contact[]>()
    for (const c of list) {
      const L = indexLetter(c)
      map.set(L, [...(map.get(L) ?? []), c])
    }
    return [...map.entries()]
  }, [q])

  const jump = (L: string) => {
    const el = root.current?.querySelector(`[data-letter="${L}"]`) as HTMLElement | null
    const scroller = root.current?.closest('.page-scroll') as HTMLElement | null
    if (!scroller) return
    if (!el) {
      // nearest following letter
      const idx = ALPHA.indexOf(L)
      for (let i = idx; i < ALPHA.length; i++) {
        const e = root.current?.querySelector(`[data-letter="${ALPHA[i]}"]`) as HTMLElement | null
        if (e) return (scroller.scrollTop = e.offsetTop - 110)
      }
      return
    }
    scroller.scrollTop = el.offsetTop - 110
  }

  const onIndexPointer = (e: React.PointerEvent) => {
    const bar = e.currentTarget as HTMLElement
    const pick = (clientY: number) => {
      const r = bar.getBoundingClientRect()
      const s = screenScale()
      const i = Math.floor(((clientY - r.top) / s / (r.height / s)) * ALPHA.length)
      jump(ALPHA[Math.max(0, Math.min(ALPHA.length - 1, i))])
    }
    pick(e.clientY)
    const move = (ev: PointerEvent) => pick(ev.clientY)
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  const count = sections.reduce((n, [, l]) => n + l.length, 0)
  return (
    <div className="ct-list" ref={root}>
      <div className="ct-search">
        <SearchField value={q} onChange={setQ} placeholder="Search" />
      </div>
      {!q && (
        <div className="ct-index-wrap">
          <div className="ct-index" onPointerDown={onIndexPointer} role="navigation" aria-label="Section index">
            {ALPHA.map((L) => <span key={L}>{L}</span>)}
          </div>
        </div>
      )}
      {showMyCard && !q && (
        <button className="ct-mycard" onClick={() => onOpen('me')}>
          <Avatar id="me" size={64} color={MY_CARD.color} />
          <span className="col" style={{ alignItems: 'flex-start' }}>
            <span className="ct-mycard-name">{ME.first} {ME.last}</span>
            <span className="t-subhead secondary">My Card</span>
          </span>
        </button>
      )}
      {sections.map(([L, list]) => (
        <section key={L} data-letter={L}>
          <div className="ct-letter">{L}</div>
          <div className="ct-group">
            {list.map((c) => <ContactRow key={c.id} c={c} onOpen={onOpen} />)}
          </div>
        </section>
      ))}
      {count === 0 ? <div className="empty-state"><div className="t-title2">No Results</div><div>Check the spelling or try a new search.</div></div> : <div className="ct-count">{count} Contacts</div>}
    </div>
  )
}
