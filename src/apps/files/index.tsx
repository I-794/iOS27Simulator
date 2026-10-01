import { useEffect, useMemo, useRef, useState } from 'react'
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { Clock, Users, Folder, Cloud, Smartphone, Trash2, LayoutGrid, List as ListIcon, Ellipsis, Share, Info, PenLine, Link2, UserPlus, Check, X, ChevronRight, Star, Tag, ArrowUpDown, Eye, Pencil, Lock, Globe } from 'lucide-react'
import { NavStack, Page, useNav, BarButton, TabBar } from '../../ui/nav'
import { List, Row } from '../../ui/list'
import { Avatar, Button, SearchField, Segmented } from '../../ui/controls'
import { Sheet, openMenu } from '../../ui/overlay'
import { useOS } from '../../os/store'
import { useAppRoute, useOnscreen } from '../../os/hooks'
import { fmtRelative, fmtDate, fmtTime, HOUR } from '../../os/time'
import { contactName } from '../../os/data/people'
import { ALL_FILES, DocPages, DocThumb, fileById, pageCount, type DemoFile } from '../preview/docs'
import './files.css'

// ------------------------------------------------------------------ collaboration model
type Role = 'owner' | 'edit' | 'view'
interface Share { owner: string; people: { id: string; role: Role }[]; link: 'invited' | 'anyone-view' | 'anyone-edit' }
interface Request { id: string; fileId: string; who: string; ts: number; status: 'pending' | 'approved' | 'denied'; role: Role }

interface FilesLocal {
  view: 'grid' | 'list'
  sort: 'name' | 'date' | 'size' | 'kind'
  shares: Record<string, Share>
  requests: Request[]
  favorites: string[]
  tags: Record<string, string>
  set: (p: Partial<FilesLocal>) => void
}

const useFiles = create<FilesLocal>()(
  persist(
    (set) => ({
      view: 'grid',
      sort: 'date',
      shares: {
        f8: { owner: 'me', people: [{ id: 'alex', role: 'edit' }, { id: 'delgado', role: 'view' }], link: 'invited' },
        f2: { owner: 'alex', people: [{ id: 'me', role: 'view' }, { id: 'nora', role: 'view' }], link: 'anyone-view' },
        f1: { owner: 'nora', people: [{ id: 'me', role: 'edit' }, { id: 'alex', role: 'edit' }], link: 'invited' },
        f7: { owner: 'thompson', people: [{ id: 'me', role: 'view' }, { id: 'sam', role: 'view' }, { id: 'leo', role: 'view' }, { id: 'priya', role: 'view' }], link: 'anyone-view' },
        f3: { owner: 'me', people: [{ id: 'priya', role: 'edit' }], link: 'invited' },
      },
      requests: [{ id: 'rq1', fileId: 'f8', who: 'nora', ts: Date.now() - 2 * HOUR, status: 'pending', role: 'edit' }],
      favorites: ['Robotics'],
      tags: { f2: '#ff3b30', f4: '#ff9500', f8: '#af52de' },
      set: (p) => set(p),
    }),
    { name: 'ios27-files', storage: createJSONStorage(() => localStorage), partialize: (s) => ({ view: s.view, sort: s.sort, shares: s.shares, requests: s.requests, favorites: s.favorites, tags: s.tags }) as FilesLocal },
  ),
)

const personName = (id: string) => (id === 'me' ? 'Me' : contactName(id, 'full'))
const shortName = (id: string) => (id === 'me' ? 'you' : contactName(id, 'short').replace(/^Mr\. |^Ms\. /, ''))
function shareLabel(s: Share): string {
  const n = s.people.length + 1
  return s.owner === 'me' ? `Shared by You · ${n} people` : `Shared by ${shortName(s.owner)} · ${n} people`
}

const KIND_LABEL: Record<string, string> = { pdf: 'PDF Document', doc: 'Pages Document', sheet: 'Numbers Spreadsheet', image: 'HEIC Image', cad: '3D Model (STEP)', md: 'Markdown Text', csv: 'CSV Document', epub: 'EPUB Book', rtf: 'Rich Text Document', key: 'Keynote Presentation' }
const ICLOUD_FOLDERS = ['Robotics', 'School', 'Band', 'Downloads', 'Documents']
const sizeKB = (s: string) => parseFloat(s) * (s.includes('MB') ? 1024 : 1)

function sortFiles(list: DemoFile[], sort: FilesLocal['sort']) {
  return [...list].sort((a, b) => (sort === 'name' ? a.name.localeCompare(b.name) : sort === 'size' ? sizeKB(b.size) - sizeKB(a.size) : sort === 'kind' ? a.kind.localeCompare(b.kind) : b.modified - a.modified))
}

const useViewer = create<{ open: number; set: (d: number) => void }>((set) => ({ open: 0, set: (d) => set((s) => ({ open: Math.max(0, s.open + d) })) }))

// ------------------------------------------------------------------ app
type TabId = 'recents' | 'shared' | 'browse'
export default function FilesApp() {
  const [tab, setTab] = useState<TabId>('browse')
  const [route, setRoute] = useState<{ id: string; n: number } | null>(null)
  const viewerOpen = useViewer((s) => s.open > 0)
  useAppRoute('files', (r) => {
    if (r.startsWith('file/') && fileById(r.slice(5))) {
      setTab('browse')
      setRoute({ id: r.slice(5), n: Date.now() })
    }
  })
  return (
    <div className="app-root fl-root">
      <div className="fl-tab" hidden={tab !== 'recents'}><NavStack root={<RecentsPage />} /></div>
      <div className="fl-tab" hidden={tab !== 'shared'}><NavStack root={<SharedPage />} /></div>
      <div className="fl-tab" hidden={tab !== 'browse'}><NavStack root={<BrowsePage route={route} />} /></div>
      {!viewerOpen && <TabBar<TabId>
        tabs={[
          { id: 'recents', label: 'Recents', icon: <Clock size={24} /> },
          { id: 'shared', label: 'Shared', icon: <Users size={24} /> },
          { id: 'browse', label: 'Browse', icon: <Folder size={24} /> },
        ]}
        value={tab}
        onChange={setTab}
      />}
    </div>
  )
}

// ------------------------------------------------------------------ Browse
function BrowsePage({ route }: { route: { id: string; n: number } | null }) {
  const nav = useNav()
  const favorites = useFiles((s) => s.favorites)
  const tags = useFiles((s) => s.tags)
  const [q, setQ] = useState('')
  const handled = useRef<number | null>(null)
  useEffect(() => {
    if (!route || handled.current === route.n) return
    handled.current = route.n
    nav.popToRoot()
    window.setTimeout(() => nav.push(<FileView id={route.id} />), 40)
  }, [route, nav])
  const results = q.trim() ? ALL_FILES.filter((f) => f.name.toLowerCase().includes(q.trim().toLowerCase()) || f.folder.toLowerCase().includes(q.trim().toLowerCase())) : []
  const TAGS = [['#ff3b30', 'Red'], ['#ff9500', 'Orange'], ['#af52de', 'Purple']] as const
  return (
    <Page title="Browse" grouped bottomExtra={80} trailing={<button className="bar-btn icon glass interactive" aria-label="More" onClick={(e) => openMenu(e.currentTarget, [
      { label: 'Icons', icon: useFiles.getState().view === 'grid' ? <Check size={18} /> : <LayoutGrid size={18} />, onSelect: () => useFiles.getState().set({ view: 'grid' }) },
      { label: 'List', icon: useFiles.getState().view === 'list' ? <Check size={18} /> : <ListIcon size={18} />, onSelect: () => useFiles.getState().set({ view: 'list' }) },
      { label: 'Connect to Server', icon: <Cloud size={18} />, separatorBefore: true, onSelect: () => useOS.getState().showToast('No servers found on ParkNet') },
    ])}><Ellipsis size={22} /></button>}>
      <div className="fl-search"><SearchField value={q} onChange={setQ} placeholder="Search" /></div>
      {q.trim() ? (
        <FileCollection files={results} empty={`No results for “${q}”`} />
      ) : (
        <>
          <List header="Locations">
            <Row icon={<span className="fl-loc icloud"><Cloud size={18} /></span>} title="iCloud Drive" chevron onClick={() => nav.push(<FolderPage title="iCloud Drive" location="icloud" />)} />
            <Row icon={<span className="fl-loc phone"><Smartphone size={18} /></span>} title="On My iPhone" chevron onClick={() => nav.push(<FolderPage title="On My iPhone" folder="On My iPhone" />)} />
            <Row icon={<span className="fl-loc trash"><Trash2 size={18} /></span>} title="Recently Deleted" chevron onClick={() => nav.push(<FolderPage title="Recently Deleted" folder="__deleted" />)} />
          </List>
          <List header="Favorites">
            {favorites.map((f) => <Row key={f} icon={<Folder size={24} className="fl-ficon" />} title={f} chevron onClick={() => nav.push(<FolderPage title={f} folder={f} />)} />)}
            <Row icon={<Star size={22} className="fl-ficon" />} title="Downloads" chevron onClick={() => nav.push(<FolderPage title="Downloads" folder="Downloads" />)} />
          </List>
          <List header="Tags">
            {TAGS.map(([c, n]) => (
              <Row key={c} icon={<span className="fl-tagdot" style={{ background: c }} />} title={n} detail={String(Object.values(tags).filter((x) => x === c).length)} chevron onClick={() => nav.push(<FolderPage title={n} tag={c} />)} />
            ))}
          </List>
        </>
      )}
    </Page>
  )
}

function FolderPage({ title, folder, location, tag }: { title: string; folder?: string; location?: 'icloud'; tag?: string }) {
  const nav = useNav()
  const view = useFiles((s) => s.view)
  const sort = useFiles((s) => s.sort)
  const tags = useFiles((s) => s.tags)
  const favorites = useFiles((s) => s.favorites)
  const files = useMemo(() => {
    if (location === 'icloud') return []
    if (tag) return ALL_FILES.filter((f) => tags[f.id] === tag)
    if (folder === '__deleted') return []
    return ALL_FILES.filter((f) => f.folder === folder)
  }, [folder, location, tag, tags])
  const menu = (el: HTMLElement) =>
    openMenu(el, [
      { label: 'Icons', icon: view === 'grid' ? <Check size={18} /> : <LayoutGrid size={18} />, onSelect: () => useFiles.getState().set({ view: 'grid' }) },
      { label: 'List', icon: view === 'list' ? <Check size={18} /> : <ListIcon size={18} />, onSelect: () => useFiles.getState().set({ view: 'list' }) },
      ...(['name', 'date', 'size', 'kind'] as const).map((k, i) => ({ label: `Sort by ${k[0].toUpperCase() + k.slice(1)}`, icon: sort === k ? <Check size={18} /> : <ArrowUpDown size={18} />, separatorBefore: i === 0, onSelect: () => useFiles.getState().set({ sort: k }) })),
      ...(folder && !folder.startsWith('__') && folder !== 'On My iPhone' ? [{ label: favorites.includes(folder) ? 'Remove from Favorites' : 'Add to Favorites', icon: <Star size={18} />, separatorBefore: true, onSelect: () => useFiles.getState().set({ favorites: favorites.includes(folder) ? favorites.filter((f) => f !== folder) : [...favorites, folder] }) }] : []),
    ])
  return (
    <Page title={title} bottomExtra={80} trailing={
      <>
        <BarButton label={view === 'grid' ? 'View as List' : 'View as Icons'} onClick={() => useFiles.getState().set({ view: view === 'grid' ? 'list' : 'grid' })}>{view === 'grid' ? <ListIcon size={20} /> : <LayoutGrid size={20} />}</BarButton>
        <button className="bar-btn icon glass interactive" aria-label="View options" onClick={(e) => menu(e.currentTarget)}><Ellipsis size={22} /></button>
      </>
    }>
      {location === 'icloud' ? (
        <div className={view === 'grid' ? 'fl-grid' : 'fl-list'}>
          {ICLOUD_FOLDERS.map((f) => {
            const n = ALL_FILES.filter((x) => x.folder === f).length
            return view === 'grid' ? (
              <button key={f} className="fl-item" onClick={() => nav.push(<FolderPage title={f} folder={f} />)}>
                <span className="fl-folder-ic"><Folder size={62} strokeWidth={1.2} fill="currentColor" />{f === 'Robotics' && <Users size={16} className="fl-folder-shared" />}</span>
                <b>{f}</b>
                <small>{n} item{n === 1 ? '' : 's'}</small>
              </button>
            ) : (
              <Row key={f} icon={<Folder size={28} className="fl-ficon" fill="currentColor" />} title={f} subtitle={`${n} item${n === 1 ? '' : 's'}`} chevron onClick={() => nav.push(<FolderPage title={f} folder={f} />)} />
            )
          })}
        </div>
      ) : (
        <FileCollection files={sortFiles(files, sort)} empty={folder === '__deleted' ? 'No recently deleted files.' : 'This folder is empty.'} />
      )}
      <div className="fl-foot">{location === 'icloud' ? `${ICLOUD_FOLDERS.length} items · 38.2 GB available on iCloud` : `${files.length} item${files.length === 1 ? '' : 's'}`}</div>
    </Page>
  )
}

function FileCollection({ files, empty }: { files: DemoFile[]; empty: string }) {
  const nav = useNav()
  const view = useFiles((s) => s.view)
  const shares = useFiles((s) => s.shares)
  const tags = useFiles((s) => s.tags)
  if (!files.length) return <div className="empty-state"><Folder size={40} strokeWidth={1.4} />{empty}</div>
  const open = (f: DemoFile) => nav.push(<FileView id={f.id} />)
  if (view === 'list') {
    return (
      <List>
        {files.map((f) => (
          <Row key={f.id} icon={<span className="fl-mini"><DocThumb file={f} /></span>} title={<>{f.name}{tags[f.id] && <i className="fl-tagdot sm" style={{ background: tags[f.id] }} />}</>} subtitle={<>{fmtRelative(f.modified)} · {f.size}{shares[f.id] && <span className="fl-sharedline"> · {shareLabel(shares[f.id])}</span>}</>} onClick={() => open(f)} />
        ))}
      </List>
    )
  }
  return (
    <div className="fl-grid">
      {files.map((f) => (
        <button key={f.id} className="fl-item" onClick={() => open(f)} onContextMenu={(e) => { e.preventDefault(); fileMenu(e.currentTarget, f) }}>
          <span className={`fl-thumb k-${f.kind}`}><DocThumb file={f} />{shares[f.id] && <span className="fl-share-badge"><Users size={11} /></span>}</span>
          <b>{f.name.replace(/\.[^.]+$/, '')}</b>
          <small>{fmtRelative(f.modified)}</small>
          <small>{shares[f.id] ? shareLabel(shares[f.id]) : f.size}{tags[f.id] && <i className="fl-tagdot sm" style={{ background: tags[f.id] }} />}</small>
        </button>
      ))}
    </div>
  )
}

function fileMenu(el: HTMLElement, f: DemoFile) {
  const tags = useFiles.getState().tags
  openMenu(el, [
    { label: 'Open in Preview', icon: <Eye size={18} />, onSelect: () => useOS.getState().launch('preview', { route: `file/${f.id}` }) },
    { label: 'Share', icon: <Share size={18} />, onSelect: () => useOS.getState().set({ shareRequest: { title: f.name, kind: 'file', app: 'files' } }) },
    { label: tags[f.id] ? 'Remove Tag' : 'Tag Red', icon: <Tag size={18} />, onSelect: () => { const t = { ...tags }; if (t[f.id]) delete t[f.id]; else t[f.id] = '#ff3b30'; useFiles.getState().set({ tags: t }) } },
  ])
}

// ------------------------------------------------------------------ Recents
function RecentsPage() {
  const recent = [...ALL_FILES].sort((a, b) => b.modified - a.modified).slice(0, 12)
  const [filter, setFilter] = useState<'All' | 'Documents' | 'Images'>('All')
  const list = recent.filter((f) => filter === 'All' || (filter === 'Images' ? f.kind === 'image' : f.kind !== 'image'))
  return (
    <Page title="Recents" bottomExtra={80}>
      <div className="fl-seg"><Segmented options={['All', 'Documents', 'Images'] as const} value={filter} onChange={setFilter} /></div>
      <FileCollection files={list} empty="No recent files." />
    </Page>
  )
}

// ------------------------------------------------------------------ Shared (collaboration + access requests)
function SharedPage() {
  const nav = useNav()
  const shares = useFiles((s) => s.shares)
  const requests = useFiles((s) => s.requests)
  const [group, setGroup] = useState<'By Person' | 'By File'>('By File')
  const pending = requests.filter((r) => r.status === 'pending')
  const shared = ALL_FILES.filter((f) => shares[f.id])
  const byMe = shared.filter((f) => shares[f.id].owner === 'me')
  const withMe = shared.filter((f) => shares[f.id].owner !== 'me')
  const people = [...new Set(shared.map((f) => shares[f.id].owner))]
  return (
    <Page title="Shared" grouped bottomExtra={80}>
      {pending.map((r) => <AccessRequestCard key={r.id} r={r} />)}
      <div className="fl-seg"><Segmented options={['By File', 'By Person'] as const} value={group} onChange={setGroup} /></div>
      {group === 'By File' ? (
        <>
          <List header="Shared with Me">
            {withMe.map((f) => <SharedRow key={f.id} f={f} onOpen={() => nav.push(<FileView id={f.id} />)} />)}
          </List>
          <List header="Shared by Me">
            {byMe.map((f) => <SharedRow key={f.id} f={f} onOpen={() => nav.push(<FileView id={f.id} />)} />)}
          </List>
        </>
      ) : (
        people.map((p) => (
          <List key={p} header={p === 'me' ? 'Shared by You' : personName(p)}>
            {shared.filter((f) => shares[f.id].owner === p).map((f) => <SharedRow key={f.id} f={f} onOpen={() => nav.push(<FileView id={f.id} />)} />)}
          </List>
        ))
      )}
    </Page>
  )
}

function SharedRow({ f, onOpen }: { f: DemoFile; onOpen: () => void }) {
  const s = useFiles((st) => st.shares[f.id])
  return (
    <Row
      icon={<span className="fl-mini"><DocThumb file={f} /></span>}
      title={f.name}
      subtitle={<span className="fl-collab-line"><Avatars ids={[s.owner, ...s.people.map((p) => p.id)].filter((x) => x !== 'me').slice(0, 3)} size={18} /> {shareLabel(s)}</span>}
      detail={fmtRelative(f.modified)}
      onClick={onOpen}
    />
  )
}

function Avatars({ ids, size = 24 }: { ids: string[]; size?: number }) {
  return <span className="fl-avatars">{ids.map((id) => <Avatar key={id} id={id} size={size} />)}</span>
}

function AccessRequestCard({ r }: { r: Request }) {
  const f = fileById(r.fileId)!
  const decide = (ok: boolean) => {
    const st = useFiles.getState()
    const share = st.shares[r.fileId]
    st.set({
      requests: st.requests.map((x) => (x.id === r.id ? { ...x, status: ok ? 'approved' : 'denied' } : x)),
      shares: ok && share ? { ...st.shares, [r.fileId]: { ...share, people: [...share.people.filter((p) => p.id !== r.who), { id: r.who, role: r.role }] } } : st.shares,
    })
    useOS.getState().showToast(ok ? `${shortName(r.who)} can now ${r.role === 'edit' ? 'edit' : 'view'} “${f.name.replace(/\.[^.]+$/, '')}”` : 'Request declined', ok ? 'check' : 'x')
  }
  return (
    <div className="fl-request anim-up" role="group" aria-label="Access request">
      <Avatar id={r.who} size={42} />
      <div className="fl-request-body">
        <b>{personName(r.who)} requested access to {f.name.replace(/\.[^.]+$/, '')}</b>
        <small>Wants to {r.role === 'edit' ? 'make changes' : 'view'} · {fmtRelative(r.ts)}</small>
        <div className="fl-request-actions">
          <button className="deny" onClick={() => decide(false)}>Deny</button>
          <button className="ok" onClick={() => decide(true)}>Approve</button>
        </div>
      </div>
    </div>
  )
}

// ------------------------------------------------------------------ File view (Quick Look)
function FileView({ id }: { id: string }) {
  const f = fileById(id)!
  const share = useFiles((s) => s.shares[id])
  const requests = useFiles((s) => s.requests.filter((r) => r.fileId === id && r.status === 'pending').length)
  const [info, setInfo] = useState(false)
  const [collab, setCollab] = useState(false)
  useOnscreen('files', f.name, { type: 'file', title: f.name, fileId: f.id })
  useEffect(() => {
    useViewer.getState().set(1)
    return () => useViewer.getState().set(-1)
  }, [])
  return (
    <Page title={f.name} large={false} bg="var(--fl-viewer-bg)" bottomExtra={80}
      trailing={<button className="bar-btn icon glass interactive" aria-label="More" onClick={(e) => openMenu(e.currentTarget, [
        { label: 'Open in Preview', icon: <Eye size={18} />, onSelect: () => useOS.getState().launch('preview', { route: `file/${f.id}` }) },
        { label: 'Get Info', icon: <Info size={18} />, onSelect: () => setInfo(true) },
        { label: 'Manage Shared File', icon: <Users size={18} />, onSelect: () => setCollab(true) },
      ])}><Ellipsis size={22} /></button>}
      footer={
        <div className="fl-viewer-bar">
          <button className="fl-circle glass interactive" aria-label="Share" onClick={() => useOS.getState().set({ shareRequest: { title: f.name, kind: 'file', app: 'files' } })}><Share size={20} /></button>
          <button className="fl-circle glass interactive" aria-label="Markup in Preview" onClick={() => useOS.getState().launch('preview', { route: `markup/${f.id}` })}><PenLine size={20} /></button>
          <button className="fl-circle glass interactive" aria-label="Info" onClick={() => setInfo(true)}><Info size={20} /></button>
          <button className={`fl-circle glass interactive ${share ? 'shared' : ''}`} aria-label="Collaborate" onClick={() => setCollab(true)}><UserPlus size={20} />{requests > 0 && <i className="fl-badge">{requests}</i>}</button>
        </div>
      }>
      {share && (
        <button className="fl-collab-banner" onClick={() => setCollab(true)}>
          <Avatars ids={[share.owner, ...share.people.map((p) => p.id)].filter((x) => x !== 'me').slice(0, 4)} size={26} />
          <span><b>{shareLabel(share)}</b><small>{share.link === 'invited' ? 'Only invited people can open' : share.link === 'anyone-edit' ? 'Anyone with the link can edit' : 'Anyone with the link can view'}{requests ? ` · ${requests} request` : ''}</small></span>
          <ChevronRight size={16} />
        </button>
      )}
      <div className="fl-viewer"><DocPages file={f} /></div>
      <div className="fl-foot">{pageCount(f)} page{pageCount(f) === 1 ? '' : 's'} · {f.size}</div>
      <Sheet open={info} onClose={() => setInfo(false)} title="Info" detent="medium">
        <div className="fl-info-hero"><span className="fl-thumb"><DocThumb file={f} /></span><b>{f.name}</b><small>{KIND_LABEL[f.kind] ?? f.kind} · {f.size}</small></div>
        <List>
          <Row title="Kind" detail={KIND_LABEL[f.kind] ?? f.kind} />
          <Row title="Size" detail={f.size} />
          <Row title="Where" detail={f.folder === 'On My iPhone' ? 'On My iPhone' : `iCloud Drive ▸ ${f.folder}`} />
          <Row title="Modified" detail={`${fmtDate(f.modified, 'short')} at ${fmtTime(f.modified)}`} />
          {share && <Row title="Shared" detail={shareLabel(share)} />}
        </List>
      </Sheet>
      <CollabSheet open={collab} onClose={() => setCollab(false)} f={f} />
    </Page>
  )
}

function CollabSheet({ open, onClose, f }: { open: boolean; onClose: () => void; f: DemoFile }) {
  const share = useFiles((s) => s.shares[f.id])
  const allRequests = useFiles((s) => s.requests)
  const requests = useMemo(() => allRequests.filter((r) => r.fileId === f.id && r.status === 'pending'), [allRequests, f.id])
  const set = (s: Share | undefined) => {
    const all = { ...useFiles.getState().shares }
    if (s) all[f.id] = s
    else delete all[f.id]
    useFiles.getState().set({ shares: all })
  }
  const start = () => set({ owner: 'me', people: [], link: 'anyone-view' })
  const copyLink = () => {
    void navigator.clipboard?.writeText(`https://icloud.example/iclouddrive/${f.id}#${encodeURIComponent(f.name)}`).catch(() => {})
    useOS.getState().showToast('Link Copied', 'link')
  }
  const canManage = share?.owner === 'me'
  const roleMenu = (el: HTMLElement, pid: string) =>
    openMenu(el, [
      { label: 'Can Make Changes', icon: <Pencil size={18} />, onSelect: () => share && set({ ...share, people: share.people.map((p) => (p.id === pid ? { ...p, role: 'edit' } : p)) }) },
      { label: 'View Only', icon: <Eye size={18} />, onSelect: () => share && set({ ...share, people: share.people.map((p) => (p.id === pid ? { ...p, role: 'view' } : p)) }) },
      { label: 'Remove Access', icon: <X size={18} />, destructive: true, separatorBefore: true, onSelect: () => share && set({ ...share, people: share.people.filter((p) => p.id !== pid) }) },
    ])
  const invite = (el: HTMLElement) =>
    openMenu(el, ['nora', 'priya', 'sam', 'mom', 'delgado'].filter((id) => !share?.people.some((p) => p.id === id)).map((id) => ({
      label: personName(id),
      icon: <UserPlus size={18} />,
      onSelect: () => {
        const s = share ?? { owner: 'me' as const, people: [], link: 'invited' as const }
        set({ ...s, people: [...s.people, { id, role: 'edit' }] })
        useOS.getState().showToast(`Invited ${shortName(id)}`, 'person')
      },
    })), { title: 'Invite with Messages' })
  return (
    <Sheet open={open} onClose={onClose} title="Collaborate" detent="large">
      <div className="fl-collab">
        <div className="fl-info-hero"><span className="fl-thumb"><DocThumb file={f} /></span><b>{f.name}</b><small>{share ? shareLabel(share) : 'Not shared'}</small></div>
        {requests.map((r) => <AccessRequestCard key={r.id} r={r} />)}
        {!share ? (
          <div className="fl-collab-start">
            <Button block onClick={start}><Link2 size={18} /> Share with a Link</Button>
            <Button block variant="gray" onClick={(e) => invite(e.currentTarget as HTMLElement)}><UserPlus size={18} /> Invite People</Button>
          </div>
        ) : (
          <>
            <List header="People">
              <Row icon={<Avatar id={share.owner} size={34} />} title={personName(share.owner)} subtitle="Owner" />
              {share.people.map((p) => (
                <Row key={p.id} icon={<Avatar id={p.id} size={34} />} title={personName(p.id)} subtitle={p.role === 'edit' ? 'Can make changes' : 'View only'} trailing={canManage && p.id !== 'me' ? <button className="fl-role" onClick={(e) => roleMenu(e.currentTarget, p.id)} aria-label={`Change access for ${personName(p.id)}`}><Ellipsis size={18} /></button> : undefined} />
              ))}
              {canManage && (
                <button className="row-item has-icon tint" onClick={(e) => invite(e.currentTarget)}>
                  <span className="fl-addp"><UserPlus size={17} /></span>
                  <span className="row-main"><span className="row-title">Add People</span></span>
                </button>
              )}
            </List>
            <List header="Link Access" footer={canManage ? 'Easier link access (iOS 27): people who open the link can request access if they aren’t invited. You’ll approve requests here or in Shared.' : `Only ${shortName(share.owner)} can change who has access.`}>
              {(['invited', 'anyone-view', 'anyone-edit'] as const).map((k) => (
                <Row key={k} icon={k === 'invited' ? <Lock size={20} className="fl-ficon" /> : <Globe size={20} className="fl-ficon" />} title={k === 'invited' ? 'Only Invited People' : k === 'anyone-view' ? 'Anyone with the Link · View' : 'Anyone with the Link · Edit'} disabled={!canManage} onClick={() => canManage && set({ ...share, link: k })} trailing={share.link === k ? <Check size={20} className="accent" /> : undefined} />
              ))}
              <Row title="Allow Others to Invite" toggle={{ value: share.link !== 'invited', onChange: (v) => canManage && set({ ...share, link: v ? 'anyone-view' : 'invited' }) }} disabled={!canManage} />
            </List>
            <div className="fl-collab-start">
              <Button block variant="tinted" onClick={copyLink}><Link2 size={18} /> Copy Link</Button>
              {canManage && <Button block variant="destructive" onClick={() => { set(undefined); onClose() }}>Stop Sharing</Button>}
            </div>
          </>
        )}
      </div>
    </Sheet>
  )
}

