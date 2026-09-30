import { useMemo, useState } from 'react'
import { UserPlus, Plus, Ellipsis, Play, Link2, Copy, Share, Clock, Maximize2, Users, Smartphone, Monitor, Globe, Bot, X } from 'lucide-react'
import { Page } from '../../ui/nav'
import { List, Row } from '../../ui/list'
import { Avatar, Button, Segmented, Switch } from '../../ui/controls'
import { Sheet, openMenu, showAlert } from '../../ui/overlay'
import { useOS } from '../../os/store'
import { CONTACTS, contactName } from '../../os/data/people'
import { fmtAgo, DAY, fmtDate } from '../../os/time'
import type { SharedAlbum } from '../../os/types'
import { PhotoView } from './PhotoView'
import { PhotoGrid } from './Grid'
import { PhotoPickerSheet, addToShared } from './Sheets'
import { usePhotoMap, openViewer, useUI } from './pstore'

type Platform = SharedAlbum['participants'][number]['platform']

export function PlatformBadge({ p }: { p: Platform }) {
  const icon = p === 'iOS' ? <Smartphone size={10} /> : p === 'Android' ? <Bot size={10} /> : p === 'Windows' ? <Monitor size={10} /> : <Globe size={10} />
  return <span className={`ph-plat ${p.toLowerCase()}`}>{icon}{p === 'iOS' ? 'iPhone' : p}</span>
}

function patch(albumId: string, f: (a: SharedAlbum) => SharedAlbum) {
  const os = useOS.getState()
  os.set({ sharedAlbums: os.sharedAlbums.map((a) => (a.id === albumId ? f(a) : a)) })
}

const name = (id: string) => (id === 'me' ? 'You' : contactName(id))
const fullName = (id: string) => (id === 'me' ? 'You' : contactName(id, 'full'))

export function SharedAlbumPage({ albumId }: { albumId: string }) {
  const album = useOS((s) => s.sharedAlbums.find((a) => a.id === albumId))
  const map = usePhotoMap()
  const [tab, setTab] = useState<'photos' | 'activity'>('photos')
  const [filter, setFilter] = useState<string>('all')
  const [settings, setSettings] = useState(false)
  const [invite, setInvite] = useState(false)
  const [add, setAdd] = useState(false)
  const poster = useMemo(() => {
    const m: Record<string, string> = {}
    album?.activity.forEach((x) => { if (x.photoId && /added/.test(x.what) && !m[x.photoId]) m[x.photoId] = x.who })
    return m
  }, [album])
  const reactions = useMemo(() => {
    const r: Record<string, string[]> = {}
    for (const [pid, list] of Object.entries(album?.reactions ?? {})) r[pid] = list.map((x) => x.emoji)
    return r
  }, [album])
  if (!album) return <Page title="Shared Album"><div className="empty-state">Album not found</div></Page>
  const photos = album.photos.map((i) => map.get(i)).filter((p): p is NonNullable<typeof p> => !!p)
  const shown = photos.filter((p) => filter === 'all' ? true : filter === 'photos' ? p.kind !== 'video' : filter === 'videos' ? p.kind === 'video' : (poster[p.id] ?? album.owner) === filter)
  const ids = shown.map((p) => p.id)
  const me = album.participants.find((p) => p.id === 'me')
  const canPost = !!me?.canPost
  const canInvite = !!me?.canInvite || album.owner === 'me'

  return (
    <Page
      title={album.name}
      subtitle={`From ${contactName(album.owner)} · ${album.participants.length} people`}
      bottomExtra={80}
      trailing={
        <>
          {canPost && <button className="bar-btn icon glass interactive" aria-label="Add photos" onClick={() => setAdd(true)}><Plus size={22} /></button>}
          <button
            className="bar-btn icon glass interactive"
            aria-label="More"
            onClick={(e) => openMenu(e.currentTarget, [
              { label: 'Slideshow', icon: <Play size={17} />, onSelect: () => useUI.getState().set({ slideshow: { ids: photos.map((p) => p.id), title: album.name } }) },
              { label: 'Invite People', icon: <UserPlus size={17} />, onSelect: () => setInvite(true) },
              { label: 'Participants & Settings', icon: <Users size={17} />, onSelect: () => setSettings(true) },
            ])}
          >
            <Ellipsis size={22} />
          </button>
        </>
      }
    >
      <div className="ph-sa-head">
        <button className="ph-sa-people" onClick={() => setSettings(true)} aria-label="Participants">
          {album.participants.slice(0, 5).map((p, i) => <span key={p.id} style={{ zIndex: 10 - i }}><Avatar id={p.id} size={34} name={p.id} /></span>)}
        </button>
        <div className="ph-sa-badges">
          {album.fullResolution && <span className="ph-badge-pill"><Maximize2 size={12} /> Full Resolution</span>}
          {album.expires && <span className="ph-badge-pill warn"><Clock size={12} /> Expires {fmtDate(album.expires, 'monthDay')}</span>}
          {album.participants.some((p) => p.platform !== 'iOS') && <span className="ph-badge-pill"><Globe size={12} /> Cross-platform</span>}
        </div>
        <Button size="small" variant="tinted" onClick={() => setInvite(true)}><UserPlus size={15} /> Invite</Button>
      </div>
      <div style={{ padding: '4px 16px 10px' }}>
        <Segmented options={['photos', 'activity'] as const} value={tab} onChange={setTab} labels={{ photos: `Photos (${photos.length})`, activity: 'Activity' }} />
      </div>
      {tab === 'photos' ? (
        <>
          <div className="ph-chips ph-sa-filter" role="toolbar" aria-label="Filter">
            {[['all', 'All'], ['photos', 'Photos'], ['videos', 'Videos']].map(([k, l]) => <button key={k} className={`chip ${filter === k ? 'active' : ''}`} onClick={() => setFilter(k)}>{l}</button>)}
            {album.participants.map((p) => (
              <button key={p.id} className={`chip ph-chip-person ${filter === p.id ? 'active' : ''}`} onClick={() => setFilter(filter === p.id ? 'all' : p.id)} aria-label={`Posted by ${name(p.id)}`}>
                <Avatar id={p.id} size={20} name={p.id} /> {p.id === 'me' ? 'You' : contactName(p.id)}
              </button>
            ))}
          </div>
          {shown.length ? (
            <PhotoGrid photos={shown} reactions={reactions} onOpen={(id, el) => openViewer(ids, id, el, { sharedAlbumId: album.id })} />
          ) : <div className="empty-state" style={{ paddingTop: 50 }}>No items match this filter</div>}
        </>
      ) : (
        <ActivityFeed albums={[album]} />
      )}
      <SharedAlbumSheet open={settings} album={album} onClose={() => setSettings(false)} onInvite={() => { setSettings(false); setInvite(true) }} canInvite={canInvite} />
      <InviteSheet open={invite} album={album} onClose={() => setInvite(false)} />
      <PhotoPickerSheet open={add} title={`Add to “${album.name}”`} exclude={album.photos} onClose={() => setAdd(false)} onPick={(ids2) => { addToShared(album.id, ids2); useOS.getState().showToast(`Posted ${ids2.length} item${ids2.length > 1 ? 's' : ''}${album.fullResolution ? ' at full resolution' : ''}`) }} />
    </Page>
  )
}

export function ActivityFeed({ albums }: { albums: SharedAlbum[] }) {
  const map = usePhotoMap()
  const items = albums.flatMap((a) => a.activity.map((x) => ({ ...x, album: a }))).sort((a, b) => b.ts - a.ts)
  if (!items.length) return <div className="empty-state">No activity yet</div>
  return (
    <div className="ph-activity">
      {items.map((x) => {
        const p = x.photoId ? map.get(x.photoId) : undefined
        return (
          <button key={`${x.album.id}-${x.id}`} className="ph-act-row" onClick={() => p && openViewer(x.album.photos, p.id, null, { sharedAlbumId: x.album.id })} disabled={!p}>
            <Avatar id={x.who} size={38} name={x.who} />
            <div className="grow" style={{ textAlign: 'left' }}>
              <div className="t-subhead"><b>{name(x.who)}</b> {x.what}</div>
              <div className="t-caption1 secondary">{albums.length > 1 ? `${x.album.name} · ` : ''}{fmtAgo(x.ts)}</div>
            </div>
            {p && <div className="ph-act-thumb"><PhotoView photo={p} />{x.emoji && <span>{x.emoji}</span>}</div>}
          </button>
        )
      })}
    </div>
  )
}

const EXPIRY: [string, number | null][] = [['Never', null], ['1 Week', 7], ['1 Month', 30], ['3 Months', 90], ['1 Year', 365]]

function SharedAlbumSheet({ open, album, onClose, onInvite, canInvite }: { open: boolean; album: SharedAlbum; onClose: () => void; onInvite: () => void; canInvite: boolean }) {
  const [notify, setNotify] = useState(true)
  const setPerm = (pid: string, k: 'canPost' | 'canInvite', v: boolean) => {
    patch(album.id, (a) => ({ ...a, participants: a.participants.map((p) => (p.id === pid ? { ...p, [k]: v } : p)) }))
  }
  return (
    <Sheet open={open} onClose={onClose} title={album.name} detent="large">
      <List header={`${album.participants.length} Participants`} footer="People using Android, Windows or a web browser can view, post and react through an invitation link.">
        {album.participants.map((p) => (
          <div key={p.id} className="ph-part">
            <div className="ph-part-top">
              <Avatar id={p.id} size={40} name={p.id} />
              <div className="grow">
                <div className="t-body">{fullName(p.id)}{p.id === album.owner && <span className="ph-owner">Owner</span>}</div>
                <PlatformBadge p={p.platform} />
              </div>
              {p.id !== album.owner && p.id !== 'me' && (
                <button className="ph-part-remove" aria-label={`Remove ${name(p.id)}`} onClick={() => showAlert({ title: `Remove ${name(p.id)}?`, message: 'They will no longer see or post to this album.', actions: [{ label: 'Cancel', style: 'cancel' }, { label: 'Remove', style: 'destructive', onPress: () => patch(album.id, (a) => ({ ...a, participants: a.participants.filter((x) => x.id !== p.id), activity: [{ id: `ac-${Date.now()}`, who: 'me', what: `removed ${contactName(p.id)}`, ts: Date.now() }, ...a.activity] })) }] })}><X size={16} /></button>
              )}
            </div>
            {p.id !== album.owner && (
              <div className="ph-part-perms">
                <label><span className="t-footnote">Can Post</span><Switch checked={p.canPost} onChange={(v) => setPerm(p.id, 'canPost', v)} label={`${name(p.id)} can post`} /></label>
                <label><span className="t-footnote">Can Invite</span><Switch checked={p.canInvite} onChange={(v) => setPerm(p.id, 'canInvite', v)} label={`${name(p.id)} can invite`} /></label>
              </div>
            )}
          </div>
        ))}
        <Row title="Invite People…" tint icon={<UserPlus size={20} className="accent" />} onClick={onInvite} disabled={!canInvite && false} />
      </List>
      <List footer="Full-resolution sharing uploads originals so everyone gets the best quality. Uses more iCloud storage.">
        <Row title="Full-Resolution Sharing" toggle={{ value: album.fullResolution, onChange: (v) => { patch(album.id, (a) => ({ ...a, fullResolution: v })); useOS.getState().showToast(v ? 'Sharing at full resolution' : 'Sharing optimized versions') } }} />
        <Row
          title="Album Expiration"
          detail={album.expires ? fmtDate(album.expires, 'monthDay') : 'Never'}
          chevron
          onClick={() => {
            const el = document.querySelector('.ph-exp-anchor') as HTMLElement | null
            if (!el) return
            openMenu(el, EXPIRY.map(([l, d]) => ({ label: l, onSelect: () => { patch(album.id, (a) => ({ ...a, expires: d ? Date.now() + d * DAY : undefined })); useOS.getState().showToast(d ? `Album expires in ${l.toLowerCase()}` : 'Album never expires') } })), { title: 'Delete album automatically after' })
          }}
        />
        <div className="ph-exp-anchor" />
        <Row title="Notifications" toggle={{ value: notify, onChange: setNotify }} />
      </List>
    </Sheet>
  )
}

function QR({ seed }: { seed: string }) {
  const n = 25
  let h = 7
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0
  const cells: [number, number][] = []
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const finder = (x < 8 && y < 8) || (x > n - 9 && y < 8) || (x < 8 && y > n - 9)
    if (finder) continue
    h = (h * 1103515245 + 12345) >>> 0
    if ((h >> 16) & 1) cells.push([x, y])
  }
  const F = ({ x, y }: { x: number; y: number }) => <g><rect x={x} y={y} width="7" height="7" fill="#000" /><rect x={x + 1} y={y + 1} width="5" height="5" fill="#fff" /><rect x={x + 2} y={y + 2} width="3" height="3" fill="#000" /></g>
  return (
    <svg viewBox={`-2 -2 ${n + 4} ${n + 4}`} className="ph-qr" role="img" aria-label="Invitation QR code">
      <rect x="-2" y="-2" width={n + 4} height={n + 4} fill="#fff" />
      {cells.map(([x, y]) => <rect key={`${x}-${y}`} x={x} y={y} width="1.02" height="1.02" fill="#000" />)}
      <F x={0} y={0} /><F x={n - 7} y={0} /><F x={0} y={n - 7} />
    </svg>
  )
}

function InviteSheet({ open, album, onClose }: { open: boolean; album: SharedAlbum; onClose: () => void }) {
  const [handle, setHandle] = useState('')
  const [platform, setPlatform] = useState<Platform>('Android')
  const [post, setPost] = useState(true)
  const link = `icloud.example/sharedalbum/#${album.id.replace('sa-', '')}${album.name.length}K7`
  const candidates = CONTACTS.filter((c) => !c.isBusiness && !album.participants.some((p) => p.id === c.id))
  const addP = (id: string, plat: Platform) => {
    patch(album.id, (a) => ({
      ...a,
      participants: [...a.participants, { id, platform: plat, canPost: post, canInvite: false }],
      activity: [{ id: `ac-${Date.now()}`, who: 'me', what: `invited ${contactName(id)}${plat !== 'iOS' ? ` (${plat})` : ''}`, ts: Date.now() }, ...a.activity],
    }))
    useOS.getState().showToast(`Invited ${contactName(id)}`)
  }
  return (
    <Sheet open={open} onClose={onClose} title="Invite to Album" detent="large">
      <div className="ph-invite">
        <QR seed={link} />
        <div className="t-footnote secondary center">Anyone can scan this code with a phone camera to join — including Android and Windows users.</div>
        <div className="ph-invite-link"><Link2 size={16} /><span className="nowrap grow">{link}</span></div>
        <div className="row gap8">
          <Button size="small" variant="tinted" onClick={() => { try { void navigator.clipboard?.writeText(`https://${link}`).catch(() => {}) } catch { /* optional */ } useOS.getState().showToast('Invitation Link Copied') }}><Copy size={15} /> Copy Link</Button>
          <Button size="small" variant="tinted" onClick={() => useOS.getState().set({ shareRequest: { title: `Join “${album.name}”`, kind: 'link', payload: `https://${link}`, app: 'photos' } })}><Share size={15} /> Share Link</Button>
        </div>
      </div>
      <List header="New participants" footer="You can change permissions later in Participants & Settings.">
        <Row title="Allow Posting" toggle={{ value: post, onChange: setPost }} />
      </List>
      <List header="Suggested">
        {candidates.slice(0, 6).map((c) => (
          <Row key={c.id} title={contactName(c.id, 'full')} subtitle={c.phones[0]} icon={<Avatar id={c.id} size={34} />} trailing={<Button size="small" variant="gray" onClick={() => addP(c.id, 'iOS')}>Add</Button>} />
        ))}
        {!candidates.length && <Row title="Everyone in your contacts is already here" />}
      </List>
      <List header="Invite by phone or email">
        <div className="ph-invite-custom">
          <input className="text-input" placeholder="Phone number or email" value={handle} onChange={(e) => setHandle(e.target.value)} aria-label="Phone number or email" />
          <Segmented options={['iOS', 'Android', 'Windows', 'Web'] as const} value={platform} onChange={setPlatform} labels={{ iOS: 'iPhone' }} />
          <Button block disabled={!handle.trim()} onClick={() => { addP(handle.trim(), platform); setHandle('') }}>Send Invitation</Button>
        </div>
      </List>
      <div style={{ height: 30 }} />
    </Sheet>
  )
}
