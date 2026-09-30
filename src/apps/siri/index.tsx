import { useEffect, useMemo, useState } from 'react'
import { SquarePen, Pin, PinOff, Pencil, Trash2, Share, Mic, ArrowUp, MoreHorizontal, Settings, Sparkles, MessageCircle, Check } from 'lucide-react'
import { NavStack, Page, useNav } from '../../ui/nav'
import { SearchField, Glass } from '../../ui/controls'
import { openMenu } from '../../ui/overlay'
import { useOS } from '../../os/store'
import { useAppRoute, useLongPress, useNow } from '../../os/hooks'
import { startOfDay, DAY, fmtTime, WEEKDAYS, MONTHS } from '../../os/time'
import type { SiriConversation } from '../../os/types'
import { ChatPage } from './Chat'
import { RenameSheet, deleteConversation, shareConversation, togglePin, setProvider } from './helpers'
import { Orb } from './Orb'
import { seedDemo } from './seed'
import { useSiriLocal } from './local'
import './siri.css'

export default function SiriApp() {
  return (
    <div className="app-root siriapp">
      <NavStack root={<ListPage />} />
    </div>
  )
}

function relGroup(ts: number, now: number): string {
  const today = startOfDay(now)
  if (ts >= today) return 'Today'
  if (ts >= today - DAY) return 'Yesterday'
  if (ts >= today - 7 * DAY) return 'Previous 7 Days'
  if (ts >= today - 30 * DAY) return 'Previous 30 Days'
  return MONTHS[new Date(ts).getMonth()]
}
function relTime(ts: number, now: number): string {
  const today = startOfDay(now)
  if (ts >= today) return fmtTime(ts)
  if (ts >= today - DAY) return 'Yesterday'
  if (ts >= today - 6 * DAY) return WEEKDAYS[new Date(ts).getDay()]
  const d = new Date(ts)
  return `${d.getMonth() + 1}/${d.getDate()}/${String(d.getFullYear()).slice(2)}`
}

// ---------------------------------------------------------------- list page
function ListPage() {
  const nav = useNav()
  const convs = useOS((s) => s.siriConversations)
  const provider = useOS((s) => s.siriSettings.provider)
  const now = useNow()
  const [q, setQ] = useState('')
  const [ask, setAsk] = useState('')
  const [renaming, setRenaming] = useState<string | null>(null)
  const seeded = useSiriLocal((s) => s.seeded)

  useEffect(() => {
    if (!seeded) seedDemo()
  }, [seeded])

  const openChat = (convId?: string, opts: { ask?: string; voice?: boolean } = {}) => {
    nav.popToRoot()
    nav.push(<ChatPage convId={convId} ask={opts.ask} voice={opts.voice} />)
  }

  useAppRoute('siri', (route) => {
    const [kind, ...rest] = route.split('/')
    const arg = decodeURIComponent(rest.join('/'))
    if (kind === 'conv' && arg) openChat(arg)
    else if (kind === 'ask' && arg) openChat(undefined, { ask: arg })
    else if (kind === 'voice') openChat(undefined, { voice: true })
    else if (kind === 'new') openChat()
  })

  const visible = useMemo(() => {
    const ql = q.trim().toLowerCase()
    const list = convs.filter((c) => c.turns.length > 0 || c.pinned)
    const filtered = ql ? list.filter((c) => c.title.toLowerCase().includes(ql) || c.turns.some((t) => t.text.toLowerCase().includes(ql))) : list
    return [...filtered].sort((a, b) => b.updated - a.updated)
  }, [convs, q])

  const pinned = visible.filter((c) => c.pinned)
  const groups = useMemo(() => {
    const g: { label: string; items: SiriConversation[] }[] = []
    for (const c of visible.filter((x) => !x.pinned)) {
      const label = relGroup(c.updated, now)
      const last = g[g.length - 1]
      if (last && last.label === label) last.items.push(c)
      else g.push({ label, items: [c] })
    }
    return g
  }, [visible, now])

  const renamingConv = convs.find((c) => c.id === renaming)

  const moreMenu = (el: HTMLElement) =>
    openMenu(el, [
      { label: 'Siri', icon: provider === 'siri' ? <Check size={18} /> : <Orb size={18} still />, onSelect: () => setProvider('siri') },
      { label: 'ChatGPT Extension', icon: provider === 'chatgpt' ? <Check size={18} /> : <Sparkles size={18} />, onSelect: () => setProvider('chatgpt') },
      { label: 'Siri Settings', icon: <Settings size={18} />, separatorBefore: true, onSelect: () => useOS.getState().launch('settings', { route: 'siri' }) },
    ], { title: 'Answer with' })

  const submitAsk = () => {
    const t = ask.trim()
    if (!t) return
    setAsk('')
    ;(document.activeElement as HTMLElement | null)?.blur?.()
    openChat(undefined, { ask: t })
  }

  return (
    <Page
      title="Siri"
      bottomExtra={84}
      trailing={
        <>
          <button className="bar-btn icon glass interactive" aria-label="More" onClick={(e) => moreMenu(e.currentTarget)}><MoreHorizontal size={22} /></button>
          <button className="bar-btn icon glass interactive" aria-label="New Chat" onClick={() => openChat()}><SquarePen size={20} /></button>
        </>
      }
      footer={
        <div className="siriapp-listbar">
          <Glass className="siriapp-inputbar" variant="heavy">
            <Orb size={30} />
            <input
              className="siriapp-input"
              placeholder="Ask Siri…"
              value={ask}
              onChange={(e) => setAsk(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submitAsk()}
              enterKeyHint="send"
              aria-label="Ask Siri"
              data-dictation="Which day did Alex say the robotics meeting was?|What’s the weather for robotics?|When is my flight?"
            />
            {ask.trim() ? (
              <button className="siriapp-send" aria-label="Send" onClick={submitAsk}><ArrowUp size={18} strokeWidth={3} /></button>
            ) : (
              <button className="siriapp-mic" aria-label="Talk to Siri" onClick={() => openChat(undefined, { voice: true })}><Mic size={20} /></button>
            )}
          </Glass>
        </div>
      }
    >
      <div style={{ padding: '0 16px 10px' }}>
        <SearchField value={q} onChange={setQ} placeholder="Search Conversations" />
      </div>

      <button className="siriapp-newcard pressable" onClick={() => openChat()}>
        <Orb size={44} />
        <div className="grow" style={{ textAlign: 'left' }}>
          <div className="t-headline">New Chat</div>
          <div className="t-footnote secondary">{provider === 'chatgpt' ? 'Siri + ChatGPT extension' : 'Ask anything — Siri knows your context'}</div>
        </div>
        <SquarePen size={20} className="accent" />
      </button>

      {visible.length === 0 && (
        <div className="empty-state">
          <MessageCircle size={40} strokeWidth={1.6} />
          <div className="t-title2">{q ? 'No Results' : 'No Conversations'}</div>
          <div className="t-subhead">{q ? `Nothing matches “${q}”.` : 'Conversations you have with Siri appear here and sync across your devices.'}</div>
        </div>
      )}

      {pinned.length > 0 && (
        <section>
          <div className="list-header">Pinned</div>
          <div className="siriapp-pins">
            {pinned.map((c) => <PinTile key={c.id} c={c} onOpen={() => openChat(c.id)} onRename={() => setRenaming(c.id)} />)}
          </div>
        </section>
      )}

      {groups.map((g) => (
        <section key={g.label}>
          <div className="list-header">{g.label}</div>
          <div className="list" role="list">
            {g.items.map((c) => <ConvRow key={c.id} c={c} now={now} onOpen={() => openChat(c.id)} onRename={() => setRenaming(c.id)} />)}
          </div>
        </section>
      ))}

      {visible.length > 0 && <div className="siriapp-foot t-footnote">Siri conversations are processed on device or with Private Cloud Compute.</div>}

      <RenameSheet conv={renamingConv} open={!!renaming} onClose={() => setRenaming(null)} />
    </Page>
  )
}

function convMenu(el: HTMLElement, c: SiriConversation, onRename: () => void) {
  openMenu(el, [
    { label: c.pinned ? 'Unpin' : 'Pin', icon: c.pinned ? <PinOff size={18} /> : <Pin size={18} />, onSelect: () => togglePin(c.id) },
    { label: 'Rename', icon: <Pencil size={18} />, onSelect: onRename },
    { label: 'Share', icon: <Share size={18} />, onSelect: () => shareConversation(c) },
    { label: 'Delete', icon: <Trash2 size={18} />, destructive: true, separatorBefore: true, onSelect: () => deleteConversation(c.id) },
  ], { title: c.title })
}

function lastSnippet(c: SiriConversation): string {
  const t = [...c.turns].reverse().find((x) => x.role === 'siri') ?? c.turns[c.turns.length - 1]
  return t?.text ?? 'No messages yet'
}

function ConvRow({ c, now, onOpen, onRename }: { c: SiriConversation; now: number; onOpen: () => void; onRename: () => void }) {
  const lp = useLongPress((el) => convMenu(el, c, onRename))
  return (
    <button className="row-item siriapp-row" role="listitem" onClick={onOpen} {...lp}>
      <span className="row-main">
        <span className="row gap8">
          <span className="row-title grow t-headline">{c.title}</span>
          <span className="t-footnote secondary" style={{ flexShrink: 0 }}>{relTime(c.updated, now)}</span>
        </span>
        <span className="row-sub">{lastSnippet(c)}</span>
      </span>
    </button>
  )
}

function PinTile({ c, onOpen, onRename }: { c: SiriConversation; onOpen: () => void; onRename: () => void }) {
  const lp = useLongPress((el) => convMenu(el, c, onRename))
  return (
    <button className="siriapp-pin pressable" onClick={onOpen} {...lp}>
      <span className="siriapp-pin-icon"><Pin size={13} /></span>
      <span className="t-subhead bold siriapp-pin-title">{c.title}</span>
      <span className="t-caption1 secondary siriapp-pin-sub">{lastSnippet(c)}</span>
    </button>
  )
}
