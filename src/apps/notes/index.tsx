import { useEffect, useMemo, useRef, useState } from 'react'
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { Folder, FolderPlus, Users, Trash2, Pin, PinOff, Ellipsis, Share, FileDown, ClipboardPaste, FolderInput, Copy, Check, NotebookText, Lock } from 'lucide-react'
import { NavStack, Page, useNav, BarButton } from '../../ui/nav'
import { List, Row } from '../../ui/list'
import { Avatar, AISparkle, Button, SearchField, Spinner } from '../../ui/controls'
import { Sheet, openMenu, showAlert } from '../../ui/overlay'
import { useOS } from '../../os/store'
import { useAppRoute, useOnscreen, useNow } from '../../os/hooks'
import { summarize } from '../../os/ai/writing'
import { fmtRelative, fmtDate, fmtTime, startOfDay, DAY } from '../../os/time'
import type { Note, NoteBlock } from '../../os/types'
import { Scene } from '../../art/Scene'
import { BlockEditor, FormatToolbar, DrawingSvg, isText } from './editor'
import { toMarkdown, fromMarkdown, SAMPLE_MD, slug, PHOTO_RE } from './markdown'
import './notes.css'

type Heading = { t: 'h1' | 'h2' | 'h3'; text: string; id?: string }

// ------------------------------------------------------------------ local state
interface NotesLocal {
  extraFolders: string[]
  deleted: (Note & { deletedAt: number })[]
  set: (p: Partial<NotesLocal>) => void
}
const useNotesLocal = create<NotesLocal>()(
  persist((set) => ({ extraFolders: [], deleted: [], set: (p) => set(p) }), {
    name: 'ios27-notes',
    storage: createJSONStorage(() => localStorage),
    partialize: (s) => ({ extraFolders: s.extraFolders, deleted: s.deleted }) as NotesLocal,
  }),
)

const BASE_FOLDERS = ['Notes', 'School', 'Robotics', 'Band']
const SHARED: Record<string, string[]> = { Robotics: ['alex', 'nora'] }
const ALL = '__all__'
const DELETED = '__deleted__'
const folderTitle = (f: string) => (f === ALL ? 'All iCloud' : f === DELETED ? 'Recently Deleted' : f)

export const noteText = (n: Note) => n.blocks.map((b) => ('text' in b ? (b.t === 'p' && PHOTO_RE.test(b.text) ? '' : b.text) : 'rows' in b ? b.rows.map((r) => r.join(' ')).join(' ') : '')).filter(Boolean).join('\n')
const titleOf = (blocks: NoteBlock[]) => {
  const first = blocks.find((b) => isText(b) && b.text.trim()) as { text: string } | undefined
  return first?.text.split('\n')[0].slice(0, 60) || 'New Note'
}
const snippet = (n: Note) => {
  const lines = noteText(n).split('\n').map((l) => l.trim()).filter(Boolean)
  return lines.slice(1).join(' ') || 'No additional text'
}

function deleteNote(n: Note) {
  const st = useOS.getState()
  st.set({ notes: st.notes.filter((x) => x.id !== n.id) })
  const l = useNotesLocal.getState()
  if (noteText(n).trim()) l.set({ deleted: [{ ...n, deletedAt: Date.now() }, ...l.deleted].slice(0, 30) })
}

// ------------------------------------------------------------------ app
export default function NotesApp() {
  return (
    <div className="app-root nt-root">
      <NavStack root={<FoldersPage />} />
    </div>
  )
}

function FoldersPage() {
  const nav = useNav()
  const notes = useOS((s) => s.notes)
  const extra = useNotesLocal((s) => s.extraFolders)
  const deleted = useNotesLocal((s) => s.deleted)
  const [q, setQ] = useState('')
  const [newFolder, setNewFolder] = useState(false)
  const pushed = useRef(false)
  const folders = [...BASE_FOLDERS, ...extra.filter((f) => !BASE_FOLDERS.includes(f)), ...[...new Set(notes.map((n) => n.folder))].filter((f) => !BASE_FOLDERS.includes(f) && !extra.includes(f))]
  useEffect(() => {
    if (pushed.current) return
    pushed.current = true
    nav.push(<NoteList folder="Notes" />, 'list-notes')
  }, [nav])
  useAppRoute('notes', (route) => {
    if (!route.startsWith('note/')) return
    const n = useOS.getState().notes.find((x) => x.id === route.slice(5))
    if (!n) return
    nav.popToRoot()
    window.setTimeout(() => {
      nav.push(<NoteList folder={n.folder} />)
      window.setTimeout(() => nav.push(<NoteEditor id={n.id} />), 30)
    }, 30)
  })
  const count = (f: string) => notes.filter((n) => f === ALL || n.folder === f).length
  const results = q.trim() ? notes.filter((n) => `${n.title}\n${noteText(n)}`.toLowerCase().includes(q.trim().toLowerCase())) : []
  return (
    <Page title="Folders" grouped bottomExtra={60}
      trailing={<BarButton label="Edit" onClick={() => setNewFolder(true)}>Edit</BarButton>}
      footer={
        <div className="nt-bottom">
          <button className="nt-circle-btn glass interactive" onClick={() => setNewFolder(true)} aria-label="New Folder"><FolderPlus size={22} /></button>
          <button className="nt-circle-btn glass interactive" onClick={() => { const id = newNote('Notes'); nav.push(<NoteList folder="Notes" />); window.setTimeout(() => nav.push(<NoteEditor id={id} autoFocus />), 30) }} aria-label="New Note"><NotebookText size={22} /></button>
        </div>
      }>
      <div className="nt-search"><SearchField value={q} onChange={setQ} placeholder="Search" /></div>
      {q.trim() ? (
        <List header={`${results.length} Result${results.length === 1 ? '' : 's'}`}>
          {results.map((n) => <Row key={n.id} title={<Hl text={n.title} q={q} />} subtitle={<>{fmtRelative(n.updated)} · {n.folder} — <Hl text={matchLine(n, q)} q={q} /></>} chevron onClick={() => nav.push(<NoteEditor id={n.id} />)} />)}
          {!results.length && <Row title={<span className="secondary">No results for “{q}”</span>} />}
        </List>
      ) : (
        <>
          <List header={<b className="nt-acct">iCloud</b>}>
            <Row icon={<Folder size={24} className="nt-ficon" />} title="All iCloud" detail={count(ALL)} chevron onClick={() => nav.push(<NoteList folder={ALL} />)} />
            {folders.map((f) => (
              <Row key={f} icon={SHARED[f] ? <Users size={22} className="nt-ficon" /> : <Folder size={24} className="nt-ficon" />} title={f} subtitle={SHARED[f] ? `Shared with ${SHARED[f].map((p) => (p === 'alex' ? 'Alex' : 'Nora')).join(' and ')}` : undefined} detail={count(f)} chevron onClick={() => nav.push(<NoteList folder={f} />)} />
            ))}
            <Row icon={<Trash2 size={22} className="nt-ficon" />} title="Recently Deleted" detail={deleted.length} chevron onClick={() => nav.push(<NoteList folder={DELETED} />)} />
          </List>
          <List header="Shared">
            <Row icon={<Avatar id="alex" size={30} />} title="Regional Strategy" subtitle="Alex Rivera · Freeform board" onClick={() => useOS.getState().launch('freeform')} chevron />
            <Row icon={<Avatar id="nora" size={30} />} title="Robotics Build Log" subtitle="Shared with Alex, Nora · edited yesterday" onClick={() => nav.push(<NoteEditor id="n-buildlog" />)} chevron />
          </List>
        </>
      )}
      <NewFolderSheet open={newFolder} onClose={() => setNewFolder(false)} />
    </Page>
  )
}

function matchLine(n: Note, q: string) {
  const l = noteText(n).split('\n').find((x) => x.toLowerCase().includes(q.trim().toLowerCase()))
  return (l ?? snippet(n)).slice(0, 70)
}

function Hl({ text, q }: { text: string; q: string }) {
  const ql = q.trim().toLowerCase()
  const i = ql ? text.toLowerCase().indexOf(ql) : -1
  if (i < 0) return <>{text}</>
  return <>{text.slice(0, i)}<mark className="nt-mark">{text.slice(i, i + ql.length)}</mark>{text.slice(i + ql.length)}</>
}

function newNote(folder: string, blocks: NoteBlock[] = [{ t: 'h1', text: '' }]) {
  const f = folder === ALL || folder === DELETED ? 'Notes' : folder
  return useOS.getState().addNote({ title: titleOf(blocks), blocks, folder: f })
}

function NewFolderSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [name, setName] = useState('')
  useEffect(() => { if (open) setName('New Folder') }, [open])
  const save = () => {
    const n = name.trim()
    if (!n) return
    const l = useNotesLocal.getState()
    if (!l.extraFolders.includes(n) && !BASE_FOLDERS.includes(n)) l.set({ extraFolders: [...l.extraFolders, n] })
    onClose()
  }
  return (
    <Sheet open={open} onClose={onClose} title="New Folder" detent="medium" trailing={<button className="bar-btn tinted" onClick={save} disabled={!name.trim()} style={{ fontWeight: 600 }}>Done</button>}>
      <form onSubmit={(e) => { e.preventDefault(); save() }} style={{ padding: '6px 16px' }}>
        <input className="nt-input" value={name} onChange={(e) => setName(e.target.value)} aria-label="Folder name" autoFocus onFocus={(e) => e.currentTarget.select()} />
      </form>
    </Sheet>
  )
}

// ------------------------------------------------------------------ list
function NoteList({ folder }: { folder: string }) {
  const nav = useNav()
  const notes = useOS((s) => s.notes)
  const deleted = useNotesLocal((s) => s.deleted)
  const [q, setQ] = useState('')
  useNow(60_000)
  const isDeleted = folder === DELETED
  const list = useMemo(() => {
    const base: Note[] = isDeleted ? deleted : notes.filter((n) => folder === ALL || n.folder === folder)
    const ql = q.trim().toLowerCase()
    return base.filter((n) => !ql || `${n.title}\n${noteText(n)}`.toLowerCase().includes(ql)).sort((a, b) => b.updated - a.updated)
  }, [notes, deleted, folder, q, isDeleted])
  const pinned = isDeleted ? [] : list.filter((n) => n.pinned)
  const rest = list.filter((n) => !pinned.includes(n))
  const sod = startOfDay()
  const groups: [string, Note[]][] = [
    ['Today', rest.filter((n) => n.updated >= sod)],
    ['Previous 7 Days', rest.filter((n) => n.updated < sod && n.updated >= sod - 7 * DAY)],
    ['Previous 30 Days', rest.filter((n) => n.updated < sod - 7 * DAY && n.updated >= sod - 30 * DAY)],
    ['Earlier', rest.filter((n) => n.updated < sod - 30 * DAY)],
  ]
  const open = (n: Note) => {
    if (isDeleted) {
      showAlert({ title: 'Recover Note?', message: `“${n.title}” will be moved back to ${n.folder}.`, actions: [
        { label: 'Cancel', style: 'cancel' },
        { label: 'Delete', style: 'destructive', onPress: () => useNotesLocal.getState().set({ deleted: deleted.filter((d) => d.id !== n.id) }) },
        { label: 'Recover', onPress: () => {
          const { deletedAt: _d, ...note } = n as Note & { deletedAt: number }
          void _d
          useOS.getState().set({ notes: [note, ...useOS.getState().notes] })
          useNotesLocal.getState().set({ deleted: deleted.filter((d) => d.id !== n.id) })
        } },
      ] })
      return
    }
    nav.push(<NoteEditor id={n.id} />)
  }
  const create = () => {
    const id = newNote(folder)
    nav.push(<NoteEditor id={id} autoFocus />)
  }
  const title = folderTitle(folder)
  return (
    <Page title={title} bottomExtra={60}
      trailing={SHARED[folder] ? <div className="nt-collab">{SHARED[folder].map((p) => <Avatar key={p} id={p} size={30} />)}</div> : undefined}
      footer={
        <div className="nt-bottom">
          <span className="nt-count glass">{list.length} Note{list.length === 1 ? '' : 's'}</span>
          {!isDeleted && <button className="nt-circle-btn glass interactive" onClick={create} aria-label="New Note"><NotebookText size={22} /></button>}
        </div>
      }>
      <div className="nt-search"><SearchField value={q} onChange={setQ} placeholder={`Search ${title}`} /></div>
      {isDeleted && <div className="nt-banner">Notes are available here for 30 days. Tap a note to recover it.</div>}
      {pinned.length > 0 && (
        <NoteGroup label={<><Pin size={13} /> Pinned</>} notes={pinned} q={q} onOpen={open} folder={folder} />
      )}
      {groups.filter(([, l]) => l.length).map(([label, l]) => <NoteGroup key={label} label={label} notes={l} q={q} onOpen={open} folder={folder} deleted={isDeleted} />)}
      {list.length === 0 && (
        <div className="empty-state">
          <NotebookText size={40} strokeWidth={1.5} />
          <div className="t-title3" style={{ color: 'var(--label-primary)' }}>{q ? 'No Results' : 'No Notes'}</div>
          {q ? `Nothing matches “${q}”.` : isDeleted ? 'Deleted notes appear here.' : 'Tap the compose button to create a note.'}
        </div>
      )}
    </Page>
  )
}

function NoteGroup({ label, notes, q, onOpen, folder, deleted }: { label: React.ReactNode; notes: Note[]; q: string; onOpen: (n: Note) => void; folder: string; deleted?: boolean }) {
  return (
    <List header={<span className="nt-grouph">{label}</span>}>
      {notes.map((n) => (
        <NoteRow key={n.id} n={n} q={q} onOpen={() => onOpen(n)} showFolder={folder === ALL} deleted={deleted} />
      ))}
    </List>
  )
}

function NoteRow({ n, q, onOpen, showFolder, deleted }: { n: Note; q: string; onOpen: () => void; showFolder: boolean; deleted?: boolean }) {
  const drawing = n.blocks.find((b) => b.t === 'drawing') as { paths: string[] } | undefined
  const photo = n.blocks.map((b) => (b.t === 'p' ? b.text.match(PHOTO_RE) : null)).find(Boolean)
  const menu = (el: HTMLElement) => {
    if (deleted) return
    openMenu(el, [
      { label: n.pinned ? 'Unpin Note' : 'Pin Note', icon: n.pinned ? <PinOff size={18} /> : <Pin size={18} />, onSelect: () => useOS.getState().updateNote(n.id, { pinned: !n.pinned }) },
      { label: 'Copy as Markdown', icon: <Copy size={18} />, onSelect: () => copyMarkdown(n) },
      { label: 'Move', icon: <FolderInput size={18} />, onSelect: () => moveMenu(el, n) },
      { label: 'Share', icon: <Share size={18} />, onSelect: () => useOS.getState().set({ shareRequest: { title: n.title, kind: 'note', payload: noteText(n), app: 'notes' } }) },
      { label: 'Delete', icon: <Trash2 size={18} />, destructive: true, separatorBefore: true, onSelect: () => deleteNote(n) },
    ], { preview: undefined })
  }
  return (
    <button className="row-item nt-row" onClick={onOpen} onContextMenu={(e) => { e.preventDefault(); menu(e.currentTarget) }}>
      <span className="row-main">
        <span className="row-title nt-row-title">{n.folder === 'Robotics' && SHARED.Robotics && <Users size={13} className="nt-shared-ic" />}<Hl text={n.title} q={q} /></span>
        <span className="nt-row-sub"><b>{fmtRelative(n.updated)}</b> <Hl text={q ? matchLine(n, q) : snippet(n)} q={q} /></span>
        {showFolder && <span className="nt-row-folder"><Folder size={12} /> {n.folder}</span>}
      </span>
      {photo ? (
        <span className="nt-thumb"><SceneThumb scene={photo[2]} /></span>
      ) : drawing ? (
        <span className="nt-thumb draw"><DrawingSvg paths={drawing.paths} /></span>
      ) : null}
    </button>
  )
}

function SceneThumb({ scene }: { scene: string }) {
  return <Scene scene={scene} />
}

function moveMenu(el: HTMLElement, n: Note, after?: () => void) {
  const folders = [...BASE_FOLDERS, ...useNotesLocal.getState().extraFolders].filter((f) => f !== n.folder)
  openMenu(el, folders.map((f) => ({ label: f, icon: <Folder size={18} />, onSelect: () => { useOS.getState().updateNote(n.id, { folder: f }); useOS.getState().showToast(`Moved to ${f}`, 'folder'); after?.() } })), { title: 'Move to Folder' })
}

let mdSheet: ((md: string) => void) | null = null
function copyMarkdown(n: Note) {
  const md = toMarkdown(n.blocks)
  void navigator.clipboard?.writeText(md).catch(() => {})
  useOS.getState().showToast('Copied as Markdown', 'doc')
  mdSheet?.(md)
}

// ------------------------------------------------------------------ editor page
function NoteEditor({ id, autoFocus }: { id: string; autoFocus?: boolean }) {
  const nav = useNav()
  const note = useOS((s) => s.notes.find((n) => n.id === id))
  const [focusIdx, setFocusIdx] = useState<number | null>(null)
  const [focused, setFocused] = useState(false)
  const [focusReq, setFocusReq] = useState<{ idx: number; caret: number | 'end'; n: number } | null>(autoFocus ? { idx: 0, caret: 'end', n: 1 } : null)
  const [summary, setSummary] = useState<string | null>(null)
  const [summing, setSumming] = useState(false)
  const [md, setMd] = useState<string | null>(null)
  const [paste, setPaste] = useState(false)
  const [linkSheet, setLinkSheet] = useState(false)
  const [flash, setFlash] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  const text = note ? noteText(note) : ''
  useOnscreen('notes', note?.title, note ? { type: 'note', title: note.title, text: text.slice(0, 2000) } : undefined)
  useEffect(() => {
    mdSheet = (m) => setMd(m)
    return () => { mdSheet = null }
  }, [])
  // track whether a field inside the editor has focus (keyboard up)
  useEffect(() => {
    const el = bodyRef.current
    if (!el) return
    const isField = (n: Element | null) => !!n && (n.tagName === 'TEXTAREA' || n.tagName === 'INPUT') && el.contains(n)
    const onIn = (e: FocusEvent) => { if (isField(e.target as Element)) setFocused(true) }
    const onOut = () => window.setTimeout(() => { if (!isField(document.activeElement)) { setFocused(false); setFocusIdx(null) } }, 80)
    el.addEventListener('focusin', onIn)
    el.addEventListener('focusout', onOut)
    return () => { el.removeEventListener('focusin', onIn); el.removeEventListener('focusout', onOut) }
  }, [])
  // remove empty notes on leave
  const alive = useRef(true)
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
      // deferred so StrictMode's mount/unmount/mount doesn't discard a brand-new note
      window.setTimeout(() => {
        if (alive.current) return
        const n = useOS.getState().notes.find((x) => x.id === id)
        if (n && !noteText(n).trim() && !n.blocks.some((b) => b.t === 'drawing' || b.t === 'table' || b.t === 'divider')) useOS.getState().set({ notes: useOS.getState().notes.filter((x) => x.id !== id) })
      }, 400)
    }
  }, [id])
  if (!note) return <Page title="" large={false}><div className="empty-state">This note was deleted.</div></Page>
  const setBlocks = (blocks: NoteBlock[]) => useOS.getState().updateNote(id, { blocks, title: titleOf(blocks) })
  const jump = (target: string) => {
    const el = bodyRef.current?.querySelector(`#nt-sec-${CSS.escape(target)}`) as HTMLElement | null
    const sc = scrollRef.current
    if (!el || !sc) return useOS.getState().showToast('Section not found')
    const scale = sc.getBoundingClientRect().height / sc.offsetHeight || 1
    sc.scrollTo({ top: sc.scrollTop + (el.getBoundingClientRect().top - sc.getBoundingClientRect().top) / scale - 110, behavior: 'smooth' })
    setFlash(target)
    window.setTimeout(() => setFlash(null), 1400)
  }
  const doSummary = () => {
    setSumming(true)
    setSummary(null)
    window.setTimeout(() => {
      const paras = note.blocks.filter((b) => (b.t === 'p' || b.t === 'quote') && b.text.trim() && !PHOTO_RE.test(b.text)).map((b) => (b as { text: string }).text.trim()).map((l) => (/[.!?:]$/.test(l) ? l : l + '.'))
      const heads = note.blocks.slice(1).filter((b) => (b.t === 'h1' || b.t === 'h2' || b.t === 'h3') && b.text.trim()).map((b) => (b as { text: string }).text.trim())
      const checks = note.blocks.filter((b): b is Extract<NoteBlock, { t: 'check' }> => b.t === 'check')
      const openItems = checks.filter((c) => !c.done).map((c) => c.text.trim()).filter(Boolean)
      const bullets = note.blocks.filter((b) => b.t === 'bullet').length
      const tables = note.blocks.filter((b) => b.t === 'table').length
      const parts: string[] = []
      if (paras.length) parts.push(summarize(paras.join(' ')))
      if (heads.length > 1) parts.push(`Sections: ${heads.slice(0, -1).join(', ')} and ${heads[heads.length - 1]}.`)
      else if (heads.length === 1) parts.push(`Includes a section on ${heads[0]}.`)
      if (checks.length) parts.push(`${checks.length - openItems.length} of ${checks.length} checklist items done${openItems.length ? `; still to do: ${openItems.slice(0, 3).join(', ')}${openItems.length > 3 ? ` and ${openItems.length - 3} more` : ''}` : ''}.`)
      if (bullets) parts.push(`${bullets} bullet point${bullets > 1 ? 's' : ''}.`)
      if (tables) parts.push(`${tables} table${tables > 1 ? 's' : ''} of details.`)
      const s = parts.join(' ')
      setSummary(s.trim() || 'This note is empty.')
      setSumming(false)
    }, 650)
  }
  const more = (el: HTMLElement) =>
    openMenu(el, [
      { label: 'Summarize Note', icon: <AISparkle size={18} />, onSelect: doSummary },
      { label: 'Copy as Markdown', icon: <Copy size={18} />, separatorBefore: true, onSelect: () => copyMarkdown(note) },
      { label: 'Paste Markdown…', icon: <ClipboardPaste size={18} />, onSelect: () => setPaste(true) },
      { label: 'Export as Markdown File', icon: <FileDown size={18} />, onSelect: () => { useOS.getState().showToast(`Saved “${note.title}.md” to Files`, 'folder') } },
      { label: note.pinned ? 'Unpin Note' : 'Pin Note', icon: note.pinned ? <PinOff size={18} /> : <Pin size={18} />, separatorBefore: true, onSelect: () => useOS.getState().updateNote(id, { pinned: !note.pinned }) },
      { label: 'Move Note', icon: <FolderInput size={18} />, onSelect: () => moveMenu(el, note) },
      { label: 'Lock Note', icon: <Lock size={18} />, onSelect: () => useOS.getState().showToast('Locked with Face ID', 'lock') },
      { label: 'Delete Note', icon: <Trash2 size={18} />, destructive: true, separatorBefore: true, onSelect: () => { deleteNote(note); nav.pop() } },
    ])
  const headings = note.blocks.map((b, i) => ({ b, i })).filter(({ b }) => (b.t === 'h1' || b.t === 'h2' || b.t === 'h3') && b.text.trim()) as { b: Heading; i: number }[]
  const addLink = (hi: number) => {
    const h = note.blocks[hi] as Heading
    const target = h.id ?? slug(h.text)
    const blocks = note.blocks.map((b, i) => (i === hi && !h.id ? { ...h, id: target } : b))
    const at = focusIdx !== null ? focusIdx + 1 : blocks.length
    setBlocks([...blocks.slice(0, at), { t: 'link', text: `→ ${h.text}`, target }, ...blocks.slice(at)])
    setLinkSheet(false)
  }
  return (
    <Page title={note.title} large={false} inlineTitle="" bottomExtra={70} scrollRef={scrollRef}
      trailing={
        <>
          {SHARED[note.folder] && <div className="nt-collab">{SHARED[note.folder].map((p) => <Avatar key={p} id={p} size={28} />)}</div>}
          <BarButton label="Share" onClick={() => useOS.getState().set({ shareRequest: { title: note.title, kind: 'note', payload: noteText(note), app: 'notes' } })}><Share size={20} /></BarButton>
          <button className="bar-btn icon glass interactive" aria-label="More" onClick={(e) => more(e.currentTarget)}><Ellipsis size={22} /></button>
        </>
      }
      footer={
        <FormatToolbar
          focused={focused}
          blocks={note.blocks}
          onChange={setBlocks}
          focusIdx={focusIdx}
          onNewNote={() => { const nid = newNote(note.folder); nav.replaceTop(<NoteEditor key={nid} id={nid} autoFocus />) }}
          onRequestFocus={(i) => setFocusReq({ idx: i, caret: 'end', n: Date.now() })}
          onLink={() => setLinkSheet(true)}
          onDone={() => (document.activeElement as HTMLElement | null)?.blur()}
        />
      }>
      <div className={`nt-editor ${flash ? `flash-${flash}` : ''}`} ref={bodyRef}>
        <div className="nt-date">{fmtDate(note.updated, 'long')} at {fmtTime(note.updated)}{SHARED[note.folder] ? ' · Shared' : ''}</div>
        {(summary || summing) && (
          <div className={`nt-summary ${summing ? 'ai-glow' : ''}`}>
            <div className="nt-summary-h"><AISparkle size={15} /> Summary <button onClick={() => setSummary(null)} aria-label="Close summary">Done</button></div>
            {summing ? <div className="nt-sum-wait"><Spinner size={14} /> Summarizing…</div> : <p>{summary}</p>}
          </div>
        )}
        <BlockEditor blocks={note.blocks} onChange={setBlocks} focusReq={focusReq} onFocusIdx={setFocusIdx} jump={jump} />
        {flash && <style>{`#nt-sec-${flash} { animation: nt-flash 1.4s ease; }`}</style>}
      </div>
      <MarkdownSheet md={md} onClose={() => setMd(null)} />
      <PasteSheet open={paste} onClose={() => setPaste(false)} onInsert={(blocks, asNew) => {
        setPaste(false)
        if (asNew) {
          const nid = newNote(note.folder, blocks)
          nav.push(<NoteEditor id={nid} />)
        } else {
          const last = note.blocks[note.blocks.length - 1]
          const base = note.blocks.length === 1 && last && isText(last) && !last.text ? [] : note.blocks
          setBlocks([...base, ...blocks])
          useOS.getState().showToast(`Pasted ${blocks.length} blocks`, 'doc')
        }
      }} />
      <Sheet open={linkSheet} onClose={() => setLinkSheet(false)} title="Link to Section" detent="medium">
        <List footer="Section links jump to a heading in this note.">
          {headings.map(({ b, i }) => (
            <Row key={i} title={<span className={`nt-lh-${b.t}`}>{b.text}</span>} subtitle={b.t === 'h1' ? 'Title' : b.t === 'h2' ? 'Heading' : 'Subheading'} onClick={() => addLink(i)} />
          ))}
          {!headings.length && <Row title={<span className="secondary">Add a heading first (Aa → Heading)</span>} />}
        </List>
      </Sheet>
    </Page>
  )
}

function MarkdownSheet({ md, onClose }: { md: string | null; onClose: () => void }) {
  const [copied, setCopied] = useState(false)
  useEffect(() => setCopied(false), [md])
  return (
    <Sheet open={md !== null} onClose={onClose} title="Markdown" detent="large" trailing={
      <button className="bar-btn tinted" onClick={() => { void navigator.clipboard?.writeText(md ?? '').catch(() => {}); setCopied(true) }}>{copied ? <><Check size={16} /> Copied</> : 'Copy'}</button>
    }>
      <div className="nt-md-wrap">
        <div className="nt-md-note">Copied to the clipboard. Paste it into any Markdown editor, or use Paste Markdown in Notes.</div>
        <pre className="nt-md">{md}</pre>
      </div>
    </Sheet>
  )
}

function PasteSheet({ open, onClose, onInsert }: { open: boolean; onClose: () => void; onInsert: (b: NoteBlock[], asNew: boolean) => void }) {
  const [src, setSrc] = useState(SAMPLE_MD)
  useEffect(() => { if (open) setSrc(SAMPLE_MD) }, [open])
  const blocks = useMemo(() => fromMarkdown(src), [src])
  return (
    <Sheet open={open} onClose={onClose} title="Paste Markdown" detent="large">
      <div className="nt-paste">
        <textarea className="nt-paste-src" value={src} onChange={(e) => setSrc(e.target.value)} aria-label="Markdown source" spellCheck={false} />
        <div className="nt-paste-h">Preview · {blocks.length} blocks</div>
        <div className="nt-paste-preview" inert>
          <BlockEditor blocks={blocks} onChange={() => {}} focusReq={null} onFocusIdx={() => {}} jump={() => {}} />
        </div>
        <div className="nt-paste-actions">
          <Button variant="gray" onClick={() => onInsert(blocks, true)} disabled={!blocks.length}>New Note</Button>
          <Button onClick={() => onInsert(blocks, false)} disabled={!blocks.length}>Insert in Note</Button>
        </div>
      </div>
    </Sheet>
  )
}

