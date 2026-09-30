import { useEffect, useRef, useState } from 'react'
import { Plus, X, ArrowUp } from 'lucide-react'
import { Sheet } from '../../ui/overlay'
import { Avatar } from '../../ui/controls'
import { CONTACTS } from '../../os/data/people'
import { useOS } from '../../os/store'
import { contactMatches, fullName, fmtPhone } from '../contacts/shared'
import { sendMsg } from './engine'

/** New Message sheet: To: field with contact suggestions, then a composer. */
export function NewMessage({ open, onClose, onSent }: { open: boolean; onClose: () => void; onSent: (convId: string) => void }) {
  const [to, setTo] = useState<string[]>([])
  const [q, setQ] = useState('')
  const [text, setText] = useState('')
  const toRef = useRef<HTMLInputElement>(null)
  const bodyRef = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    if (open) {
      setTo([])
      setQ('')
      setText('')
      window.setTimeout(() => toRef.current?.focus(), 350)
    }
  }, [open])
  const suggestions = CONTACTS.filter((c) => !to.includes(c.id) && (q ? contactMatches(c, q) : !c.isBusiness)).slice(0, q ? 8 : 6)
  const add = (id: string) => {
    setTo((t) => [...t, id])
    setQ('')
    window.setTimeout(() => (to.length === 0 ? bodyRef.current?.focus() : toRef.current?.focus()), 30)
  }
  const send = () => {
    if (!to.length || !text.trim()) return
    const st = useOS.getState()
    const id = st.ensureConversation(to, to.length > 1 ? undefined : undefined)
    sendMsg(id, { text: text.trim() })
    onClose()
    window.setTimeout(() => onSent(id), 280)
  }
  return (
    <Sheet open={open} onClose={onClose} title="New Message" detent="large" label="New Message">
      <div className="msg-new">
        <div className="msg-new-to">
          <span className="secondary">To:</span>
          {to.map((id) => (
            <button key={id} className="msg-new-token" onClick={() => setTo((t) => t.filter((x) => x !== id))} aria-label={`Remove ${fullName(CONTACTS.find((c) => c.id === id))}`}>
              {fullName(CONTACTS.find((c) => c.id === id))} <X size={12} strokeWidth={3} />
            </button>
          ))}
          <input
            ref={toRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="To"
            enterKeyHint="next"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && suggestions[0] && q) add(suggestions[0].id)
              if (e.key === 'Backspace' && !q && to.length) setTo((t) => t.slice(0, -1))
            }}
          />
          <button className="msg-new-plus" aria-label="Add contact" onClick={() => suggestions[0] && add(suggestions[0].id)}><Plus size={18} strokeWidth={2.6} /></button>
        </div>
        {(q || to.length === 0) && (
          <div className="msg-new-suggest">
            {suggestions.map((c) => (
              <button key={c.id} onClick={() => add(c.id)}>
                <Avatar id={c.id} size={40} />
                <span className="col" style={{ alignItems: 'flex-start' }}>
                  <span className="msg-conv-name">{fullName(c)}</span>
                  <span className="t-subhead secondary">{c.nickname && c.nickname !== c.first ? `“${c.nickname}” · ` : ''}{fmtPhone(c.phones[0])}</span>
                </span>
              </button>
            ))}
          </div>
        )}
        <div className="msg-new-compose">
          <div className="msg-field glass">
            <textarea
              ref={bodyRef}
              rows={1}
              value={text}
              placeholder={to.length ? 'iMessage' : 'Choose a recipient'}
              aria-label="Message"
              data-recipient={to[0]}
              data-send-on-enter="1"
              enterKeyHint="send"
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  send()
                }
              }}
            />
            <button className="msg-send" aria-label="Send" disabled={!to.length || !text.trim()} onClick={send} onPointerDown={(e) => e.preventDefault()}>
              <ArrowUp size={20} strokeWidth={3} />
            </button>
          </div>
        </div>
      </div>
    </Sheet>
  )
}
