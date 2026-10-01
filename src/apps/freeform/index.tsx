import { useEffect, useState } from 'react'
import { Plus, Pencil, Copy, Trash2, FolderInput, Check, Users, Folder } from 'lucide-react'
import { NavStack, Page, useNav } from '../../ui/nav'
import { Avatar, SearchField } from '../../ui/controls'
import { Sheet, openMenu, showAlert } from '../../ui/overlay'
import { useOS, uid, type FreeformBoard } from '../../os/store'
import { useAppRoute, useLongPress, useNow } from '../../os/hooks'
import { fmtRelative } from '../../os/time'
import { contactName } from '../../os/data/people'
import { BoardPage } from './Board'
import { BoardPreview } from './Items'
import { updateBoard } from './util'
import './freeform.css'

export default function FreeformApp() {
  return (
    <div className="app-root ff">
      <NavStack root={<Boards />} />
    </div>
  )
}

function Boards() {
  const nav = useNav()
  const boards = useOS((s) => s.freeform)
  const now = useNow()
  const [scope, setScope] = useState<string>('All Boards')
  const [q, setQ] = useState('')
  const [renaming, setRenaming] = useState<FreeformBoard | null>(null)
  const folders = [...new Set(boards.map((b) => b.folder))]
  const scopes = ['All Boards', 'Recents', 'Shared', ...folders]

  useAppRoute('freeform', (route) => {
    const [kind, id] = route.split('/')
    nav.popToRoot()
    if (kind === 'board' && id) nav.push(<BoardPage id={id} />)
    if (kind === 'new') newBoard()
  })

  const newBoard = () => {
    const id = uid('fb')
    const folder = folders.includes(scope) ? scope : 'Boards'
    const st = useOS.getState()
    st.set({ freeform: [{ id, name: 'Untitled', folder, items: [], updated: Date.now(), shared: boards.find((b) => b.folder === folder)?.shared }, ...st.freeform] })
    nav.push(<BoardPage id={id} />)
  }

  const ql = q.trim().toLowerCase()
  const list = boards
    .filter((b) => scope === 'All Boards' || scope === 'Recents' || (scope === 'Shared' ? !!b.shared?.length : b.folder === scope))
    .filter((b) => !ql || b.name.toLowerCase().includes(ql) || b.items.some((i) => i.text?.toLowerCase().includes(ql)))
    .sort((a, b) => b.updated - a.updated)
    .slice(0, scope === 'Recents' ? 6 : undefined)
  const groups = scope === 'All Boards' ? folders.map((f) => ({ f, items: list.filter((b) => b.folder === f) })).filter((g) => g.items.length) : [{ f: scope, items: list }]

  return (
    <Page title="Freeform" trailing={<button className="bar-btn icon glass interactive" aria-label="New Board" onClick={newBoard}><Plus size={22} /></button>}>
      <div style={{ padding: '0 16px 10px' }}><SearchField value={q} onChange={setQ} placeholder="Search Boards" /></div>
      <div className="ff-scopes scroll">
        {scopes.map((s) => <button key={s} className={scope === s ? 'on' : ''} onClick={() => setScope(s)}>{s === 'Shared' ? <Users size={13} /> : folders.includes(s) ? <Folder size={13} /> : null}{s}</button>)}
      </div>
      {groups.map((g) => {
        const shared = [...new Set(g.items.flatMap((b) => b.shared ?? []))]
        return (
          <section key={g.f}>
            <div className="ff-folder-h">
              <span className="grow">{g.f}</span>
              {shared.length > 0 && (
                <span className="ff-avatars" title={shared.map((p) => contactName(p)).join(', ')}>
                  {shared.map((p) => <Avatar key={p} id={p} size={24} />)}
                  <Avatar id="me" size={24} />
                </span>
              )}
            </div>
            {shared.length > 0 && <div className="ff-folder-sub">Shared with {shared.map((p) => contactName(p)).join(' and ')} · everyone can make changes</div>}
            <div className="ff-grid">
              {g.items.map((b) => <BoardCard key={b.id} b={b} now={now} onOpen={() => nav.push(<BoardPage id={b.id} />)} onRename={() => setRenaming(b)} folders={folders} />)}
              {g.f !== 'Recents' && g.f !== 'Shared' && (
                <button className="ff-card ff-card-new pressable" onClick={newBoard}><Plus size={28} /><span>New Board</span></button>
              )}
            </div>
          </section>
        )
      })}
      {list.length === 0 && <div className="empty-state"><div className="t-title2">No Boards</div><div className="t-subhead">{ql ? `Nothing matches “${q}”.` : 'Tap + to start a new board.'}</div></div>}
      <RenameSheet b={renaming} onClose={() => setRenaming(null)} />
    </Page>
  )
}

function BoardCard({ b, now, onOpen, onRename, folders }: { b: FreeformBoard; now: number; onOpen: () => void; onRename: () => void; folders: string[] }) {
  const lp = useLongPress((el) => openMenu(el, [
    { label: 'Rename', icon: <Pencil size={18} />, onSelect: onRename },
    { label: 'Duplicate', icon: <Copy size={18} />, onSelect: () => { const st = useOS.getState(); st.set({ freeform: [{ ...structuredClone(b), id: uid('fb'), name: `${b.name} copy`, updated: Date.now() }, ...st.freeform] }) } },
    { label: 'Move to Folder…', icon: <FolderInput size={18} />, onSelect: () => window.setTimeout(() => openMenu(el, [...folders, 'Boards'].filter((f, i, a) => a.indexOf(f) === i).map((f) => ({ label: f, icon: f === b.folder ? <Check size={17} /> : undefined, onSelect: () => updateBoard(b.id, { folder: f }) }))), 60) },
    { label: 'Delete', icon: <Trash2 size={18} />, destructive: true, separatorBefore: true, onSelect: () => showAlert({ title: `Delete “${b.name}”?`, message: b.shared?.length ? 'Participants will lose access to this board.' : undefined, actions: [{ label: 'Cancel', style: 'cancel' }, { label: 'Delete', style: 'destructive', onPress: () => { const st = useOS.getState(); st.set({ freeform: st.freeform.filter((x) => x.id !== b.id) }) } }] }) },
  ], { title: b.name }))
  return (
    <div className="ff-card pressable anim-up" role="button" tabIndex={0} onClick={onOpen} onKeyDown={(e) => e.key === 'Enter' && onOpen()} {...lp}>
      <BoardPreview b={b} />
      <div className="ff-card-info">
        <div className="t-subhead bold nowrap">{b.name}</div>
        <div className="row gap4 t-caption1 secondary">
          {b.shared?.length ? <Users size={11} /> : null}
          <span className="nowrap">{fmtRelative(b.updated, now)}{b.shared?.length ? ` · ${contactName(b.shared[0])} edited` : ''}</span>
        </div>
      </div>
    </div>
  )
}

function RenameSheet({ b, onClose }: { b: FreeformBoard | null; onClose: () => void }) {
  const [v, setV] = useState('')
  useEffect(() => { if (b) setV(b.name) }, [b])
  const save = () => { if (b && v.trim()) updateBoard(b.id, { name: v.trim() }); onClose() }
  return (
    <Sheet open={!!b} onClose={onClose} detent="auto" title="Rename Board" trailing={<button className="bar-btn icon prominent" aria-label="Save" onClick={save}><Check size={20} strokeWidth={2.6} /></button>}>
      <div style={{ padding: '4px 16px 26px' }}>
        <input className="text-input ff-rename" value={v} onChange={(e) => setV(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && save()} autoFocus aria-label="Board name" />
      </div>
    </Sheet>
  )
}
