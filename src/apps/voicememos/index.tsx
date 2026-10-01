import { memo as reactMemo, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Heart, Trash2, Play, Pause, Ellipsis, MessageSquareQuote, RotateCcw, RotateCw, Copy, Pencil, Share, FileText, ChevronRight, AudioLines, Undo2, X, Check } from 'lucide-react'
import { NavStack, Page, useNav, BarButton } from '../../ui/nav'
import { SearchField, AISparkle, Spinner } from '../../ui/controls'
import { openMenu, showAlert, type MenuItem } from '../../ui/overlay'
import { useOS } from '../../os/store'
import { useAppRoute, useOnscreen, useLongPress } from '../../os/hooks'
import { fmtDuration, fmtTime, startOfDay, DAY, WEEKDAYS, MONTHS_SHORT } from '../../os/time'
import { bars, currentWord, memoLevels, wordTimings, LEVELS_PER_SEC, type Memo } from './data'
import { useMemos, useVM, startRecording, stopRecording, toggle, seek, skip, trash, recover, duplicate, summaryFor, liveLevels, type Folder } from './engine'
import './voicememos.css'

const FOLDER_TITLE: Record<Folder, string> = { all: 'All Recordings', favorites: 'Favorites', deleted: 'Recently Deleted' }
const KEEP_DAYS = 30

function fmtListDate(ts: number, now = Date.now()) {
  const sod = startOfDay(now)
  if (ts >= sod) return fmtTime(ts)
  if (ts >= sod - DAY) return 'Yesterday'
  if (ts >= sod - 6 * DAY) return WEEKDAYS[new Date(ts).getDay()]
  const d = new Date(ts)
  return `${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`
}
function fmtLong(ts: number) {
  const d = new Date(ts)
  return `${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()} at ${fmtTime(ts)}`
}
const daysLeft = (m: Memo) => Math.max(0, KEEP_DAYS - Math.floor((Date.now() - (m.deletedAt ?? Date.now())) / DAY))

function inFolder(m: Memo, f: Folder) {
  if (f === 'deleted') return !!m.deletedAt
  if (m.deletedAt) return false
  return f === 'all' || !!m.favorite
}

export default function VoiceMemosApp() {
  const expanded = useVM((s) => s.expanded)
  const memo = useMemos((s) => s.memos.find((m) => m.id === expanded))
  useAppRoute('voicememos', (r) => {
    const vm = useVM.getState()
    if (r === 'record') {
      useVM.setState({ routeFolder: 'all', routeTick: vm.routeTick + 1 })
      startRecording()
    } else if (r.startsWith('rec/')) {
      const m = useMemos.getState().memos.find((x) => x.id === decodeURIComponent(r.slice(4)))
      if (!m) return
      useVM.setState({ routeFolder: m.deletedAt ? 'deleted' : 'all', routeTick: vm.routeTick + 1, expanded: m.deletedAt ? null : m.id, editing: false, selected: [] })
    }
  })
  useOnscreen(
    'voicememos',
    memo ? `Voice memo “${memo.title}”` : 'Voice Memos recordings list',
    memo ? { type: 'note', title: memo.title, text: memo.transcript || '(no speech)' } : undefined,
  )
  return (
    <div className="app-root vm-root">
      <NavStack root={<FoldersPage />} />
      <BottomBar />
    </div>
  )
}

// ------------------------------------------------------------------ folders
function FoldersPage() {
  const nav = useNav()
  const memos = useMemos((s) => s.memos)
  const tick = useVM((s) => s.routeTick)
  const handled = useRef<number | null>(null)
  useEffect(() => {
    if (nav.isTop) useVM.setState({ folder: null, editing: false, selected: [] })
  }, [nav.isTop])
  // open All Recordings on launch, and the requested folder on deep links
  useEffect(() => {
    if (handled.current === tick) return
    const first = handled.current === null
    handled.current = tick
    const { routeFolder, folder } = useVM.getState()
    const target: Folder = first && tick === 0 ? 'all' : routeFolder
    if (!first && folder === target) return
    if (!first) nav.popToRoot()
    nav.push(<RecordingsPage folder={target} />, `vm-${target}-${tick}`)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick])
  const count = (f: Folder) => memos.filter((m) => inFolder(m, f)).length
  const rows: { f: Folder; icon: React.ReactNode }[] = [
    { f: 'all', icon: <AudioLines size={22} /> },
    { f: 'favorites', icon: <Heart size={21} /> },
    { f: 'deleted', icon: <Trash2 size={21} /> },
  ]
  return (
    <Page title="Voice Memos" grouped bottomExtra={110}>
      <div className="list vm-folders" role="list">
        {rows.map((r) => (
          <button key={r.f} className="row-item has-icon" role="listitem" onClick={() => nav.push(<RecordingsPage folder={r.f} />)}>
            <span className="vm-folder-icon">{r.icon}</span>
            <span className="row-main"><span className="row-title">{FOLDER_TITLE[r.f]}</span></span>
            <span className="row-detail">{count(r.f)}</span>
            <ChevronRight className="chev" size={18} strokeWidth={2.6} />
          </button>
        ))}
      </div>
      <div className="list-footer vm-folders-foot">Recordings are transcribed on device with Apple Intelligence. Recently Deleted recordings are removed after {KEEP_DAYS} days.</div>
    </Page>
  )
}

// ------------------------------------------------------------------ recordings list
function RecordingsPage({ folder }: { folder: Folder }) {
  const nav = useNav()
  const all = useMemos((s) => s.memos)
  const editing = useVM((s) => s.editing && s.folder === folder)
  const [q, setQ] = useState('')
  useEffect(() => {
    if (nav.isTop) useVM.setState({ folder, editing: false, selected: [] })
  }, [nav.isTop, folder])
  const list = useMemo(() => {
    const l = q.trim().toLowerCase()
    return all
      .filter((m) => inFolder(m, folder))
      .filter((m) => !l || `${m.title} ${m.location} ${m.transcript}`.toLowerCase().includes(l))
      .sort((a, b) => (folder === 'deleted' ? (b.deletedAt ?? 0) - (a.deletedAt ?? 0) : b.createdAt - a.createdAt))
  }, [all, folder, q])
  const total = all.filter((m) => inFolder(m, folder)).length
  const trailing = total ? (
    <BarButton label={editing ? 'Done' : 'Edit'} prominent={editing} onClick={() => useVM.setState({ editing: !editing, selected: [], expanded: null })}>
      {editing ? 'Done' : 'Edit'}
    </BarButton>
  ) : undefined
  return (
    <Page title={FOLDER_TITLE[folder]} bottomExtra={110} trailing={trailing}>
      <div className="vm-search">
        <SearchField value={q} onChange={setQ} placeholder={folder === 'all' ? 'Search recordings & transcripts' : 'Search'} />
      </div>
      {list.length === 0 && (
        <div className="vm-empty">
          {q ? (
            <><div className="t-title3">No Results</div><div>No recordings or transcripts match “{q}”.</div></>
          ) : folder === 'deleted' ? (
            <><Trash2 size={40} strokeWidth={1.6} /><div className="t-title3">No Recently Deleted</div><div>Deleted recordings stay here for {KEEP_DAYS} days.</div></>
          ) : folder === 'favorites' ? (
            <><Heart size={40} strokeWidth={1.6} /><div className="t-title3">No Favorites</div><div>Favorite a recording from its ••• menu.</div></>
          ) : (
            <><AudioLines size={40} strokeWidth={1.6} /><div className="t-title3">No Recordings</div><div>Tap the Record button to start a Voice Memo.</div></>
          )}
        </div>
      )}
      <div className="vm-list" role="list">
        {list.map((m) => (folder === 'deleted' ? <DeletedRow key={m.id} m={m} editing={editing} /> : <MemoRow key={m.id} m={m} editing={editing} />))}
      </div>
    </Page>
  )
}

function SelectDot({ id }: { id: string }) {
  const on = useVM((s) => s.selected.includes(id))
  return <span className={`vm-sel ${on ? 'on' : ''}`} aria-hidden>{on && <Check size={14} strokeWidth={3.2} />}</span>
}

const toggleSelect = (id: string) => {
  const s = useVM.getState().selected
  useVM.setState({ selected: s.includes(id) ? s.filter((x) => x !== id) : [...s, id] })
}

function menuFor(m: Memo, rename?: () => void): MenuItem[] {
  const lib = useMemos.getState()
  const os = useOS.getState()
  return [
    { label: m.favorite ? 'Unfavorite' : 'Favorite', icon: <Heart size={18} />, onSelect: () => lib.update(m.id, { favorite: !m.favorite }) },
    { label: 'Rename', icon: <Pencil size={18} />, onSelect: () => (rename ? rename() : (useVM.setState({ expanded: m.id }), window.setTimeout(() => (document.querySelector(`.vm-title-input[data-id="${m.id}"]`) as HTMLInputElement | null)?.focus(), 80))) },
    { label: 'Duplicate', icon: <Copy size={18} />, onSelect: () => { duplicate(m.id); os.showToast('Recording duplicated') } },
    {
      label: 'Copy Transcript', icon: <FileText size={18} />, disabled: !m.transcript,
      onSelect: () => { void navigator.clipboard?.writeText(m.transcript).catch(() => {}); os.showToast('Transcript copied') },
    },
    { label: 'Share', icon: <Share size={18} />, onSelect: () => os.set({ shareRequest: { title: m.title, kind: 'file', payload: `${m.title}.m4a`, app: 'voicememos' } }) },
    { label: 'Delete', icon: <Trash2 size={18} />, destructive: true, separatorBefore: true, onSelect: () => trash([m.id]) },
  ]
}

const MemoRow = reactMemo(function MemoRow({ m, editing }: { m: Memo; editing: boolean }) {
  const expanded = useVM((s) => s.expanded === m.id) && !editing
  const ref = useRef<HTMLDivElement>(null)
  const lp = useLongPress((el) => openMenu(el, menuFor(m), { title: m.title }))
  useEffect(() => {
    if (expanded) ref.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [expanded])
  return (
    <div ref={ref} className={`vm-row ${expanded ? 'expanded' : ''}`} role="listitem">
      {expanded ? (
        <Expanded m={m} />
      ) : (
        <button
          className="vm-row-btn"
          {...lp}
          onClick={() => (editing ? toggleSelect(m.id) : useVM.setState({ expanded: m.id }))}
          aria-label={`${m.title}, ${fmtDuration(m.duration)}`}
        >
          {editing && <SelectDot id={m.id} />}
          <span className="vm-row-main">
            <span className="vm-row-title">{m.title}</span>
            <span className="vm-row-meta">
              <span>{fmtListDate(m.createdAt)}</span>
              <span className="vm-dur">{m.favorite && <Heart size={12} fill="currentColor" className="vm-fav" />}{fmtDuration(m.duration)}</span>
            </span>
          </span>
        </button>
      )}
    </div>
  )
})

function DeletedRow({ m, editing }: { m: Memo; editing: boolean }) {
  const onClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (editing) return toggleSelect(m.id)
    openMenu(e.currentTarget, [
      { label: 'Recover', icon: <Undo2 size={18} />, onSelect: () => { recover([m.id]); useOS.getState().showToast('Recording recovered') } },
      { label: 'Delete Forever', icon: <Trash2 size={18} />, destructive: true, onSelect: () => confirmErase([m.id]) },
    ], { title: m.title })
  }
  const d = daysLeft(m)
  return (
    <div className="vm-row" role="listitem">
      <button className="vm-row-btn" onClick={onClick} aria-label={`${m.title}, deleted`}>
        {editing && <SelectDot id={m.id} />}
        <span className="vm-row-main">
          <span className="vm-row-title">{m.title}</span>
          <span className="vm-row-meta">
            <span>{d} day{d === 1 ? '' : 's'} remaining</span>
            <span className="vm-dur">{fmtDuration(m.duration)}</span>
          </span>
        </span>
      </button>
    </div>
  )
}

function confirmErase(ids: string[]) {
  showAlert({
    title: ids.length === 1 ? 'Delete this recording forever?' : `Delete ${ids.length} recordings forever?`,
    message: 'This action can’t be undone.',
    actions: [
      { label: 'Cancel', style: 'cancel' },
      { label: 'Delete', style: 'destructive', onPress: () => { useMemos.getState().remove(ids); useVM.setState({ selected: [] }) } },
    ],
  })
}

// ------------------------------------------------------------------ expanded recording
function Expanded({ m }: { m: Memo }) {
  const isCur = useVM((s) => s.playId === m.id)
  const playing = useVM((s) => s.playing && s.playId === m.id)
  const pos = useVM((s) => (s.playId === m.id ? s.pos : 0))
  const recording = useVM((s) => !!s.rec)
  const showTx = useMemos((s) => s.showTranscript)
  const [title, setTitle] = useState(m.title)
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => setTitle(m.title), [m.title])
  const commit = () => {
    const t = title.trim()
    if (t && t !== m.title) useMemos.getState().update(m.id, { title: t })
    else setTitle(m.title)
  }
  const shownPos = isCur ? pos : 0
  return (
    <div className="vm-exp">
      <div className="vm-exp-head">
        <input
          ref={input}
          className="vm-title-input"
          data-id={m.id}
          value={title}
          aria-label="Recording name"
          enterKeyHint="done"
          onChange={(e) => setTitle(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') { setTitle(m.title); (e.target as HTMLInputElement).blur() } }}
        />
        <button className="vm-icon-btn" aria-label="More" onClick={(e) => openMenu(e.currentTarget, menuFor(m, () => input.current?.focus()), { title: m.title })}>
          <Ellipsis size={20} />
        </button>
      </div>
      <div className="vm-row-meta vm-exp-meta">
        <span>{fmtLong(m.createdAt)}</span>
        <span className="vm-loc">{m.location}</span>
      </div>
      <Scrubber m={m} pos={shownPos} />
      <div className="vm-times"><span>{fmtDuration(Math.floor(shownPos))}</span><span>-{fmtDuration(Math.ceil(m.duration - shownPos))}</span></div>
      <div className="vm-controls">
        <button className={`vm-icon-btn vm-tx-toggle ${showTx ? 'on' : ''}`} aria-label={showTx ? 'Hide transcript' : 'Show transcript'} aria-pressed={showTx} onClick={() => useMemos.getState().set({ showTranscript: !showTx })}>
          <MessageSquareQuote size={22} />
        </button>
        <button className="vm-skip" aria-label="Back 15 seconds" onClick={() => skip(m.id, -15)}><RotateCcw size={30} strokeWidth={1.8} /><span>15</span></button>
        <button className="vm-play" aria-label={playing ? 'Pause' : 'Play'} disabled={recording} onClick={() => toggle(m.id)}>
          {playing ? <Pause size={30} fill="currentColor" strokeWidth={0} /> : <Play size={30} fill="currentColor" strokeWidth={0} style={{ marginLeft: 3 }} />}
        </button>
        <button className="vm-skip" aria-label="Forward 15 seconds" onClick={() => skip(m.id, 15)}><RotateCw size={30} strokeWidth={1.8} /><span>15</span></button>
        <button className="vm-icon-btn vm-trash" aria-label="Delete recording" onClick={() => trash([m.id])}><Trash2 size={21} /></button>
      </div>
      {showTx && <Transcript m={m} pos={shownPos} />}
    </div>
  )
}

const BARS = 64
function Scrubber({ m, pos }: { m: Memo; pos: number }) {
  const b = useMemo(() => bars(memoLevels(m), BARS), [m])
  const frac = m.duration ? Math.min(1, pos / m.duration) : 0
  const ref = useRef<HTMLDivElement>(null)
  const at = (clientX: number) => {
    const r = ref.current!.getBoundingClientRect()
    return Math.max(0, Math.min(1, (clientX - r.left) / r.width)) * m.duration
  }
  return (
    <div
      ref={ref}
      className="vm-scrub"
      role="slider"
      aria-label="Playback position"
      aria-valuemin={0}
      aria-valuemax={Math.round(m.duration)}
      aria-valuenow={Math.round(pos)}
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'ArrowLeft') skip(m.id, -5); if (e.key === 'ArrowRight') skip(m.id, 5) }}
      onPointerDown={(e) => {
        e.stopPropagation()
        ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
        seek(m.id, at(e.clientX))
      }}
      onPointerMove={(e) => { if (e.buttons) seek(m.id, at(e.clientX)) }}
    >
      {b.map((v, i) => (
        <span key={i} className={i / BARS < frac ? 'played' : ''} style={{ height: `${Math.max(6, v * 100)}%` }} />
      ))}
      <div className="vm-scrub-head" style={{ left: `${frac * 100}%` }} />
    </div>
  )
}

function Transcript({ m, pos }: { m: Memo; pos: number }) {
  const words = useMemo(() => wordTimings(m.transcript, m.duration), [m.transcript, m.duration])
  const cur = currentWord(words, pos)
  const live = pos > 0
  const [busy, setBusy] = useState(false)
  const runSummary = () => {
    setBusy(true)
    window.setTimeout(() => {
      useMemos.getState().update(m.id, { summary: summaryFor(m) })
      setBusy(false)
    }, 650)
  }
  const text = useMemo(
    () =>
      words.map((w, i) => (
        <span key={i} className={`vm-w ${live && i < cur ? 'said' : ''} ${live && i === cur ? 'cur' : ''}`} onClick={() => seek(m.id, w.start + 0.01)}>
          {w.text}{' '}
        </span>
      )),
    [words, cur, live, m.id],
  )
  return (
    <div className="vm-tx">
      <div className="vm-tx-head">
        <span className="vm-tx-label"><AISparkle size={15} /> Transcript</span>
        <button className="vm-sum-btn" disabled={!m.transcript || busy} onClick={runSummary}>
          {busy ? <Spinner size={14} /> : <AISparkle size={14} />} {m.summary ? 'Summarize Again' : 'Summarize'}
        </button>
      </div>
      {m.summary && (
        <div className="vm-summary">
          <div className="vm-summary-head"><span>Summary</span><button aria-label="Dismiss summary" onClick={() => useMemos.getState().update(m.id, { summary: undefined })}><X size={14} /></button></div>
          <p>{m.summary}</p>
        </div>
      )}
      {m.transcript ? <p className={`vm-tx-text ${live ? 'live' : ''}`}>{text}</p> : <p className="vm-tx-none">No speech detected in this recording.</p>}
    </div>
  )
}

// ------------------------------------------------------------------ bottom bar: record / edit toolbar
function BottomBar() {
  const rec = useVM((s) => s.rec)
  const folder = useVM((s) => s.folder)
  const editing = useVM((s) => s.editing)
  const selected = useVM((s) => s.selected)
  const memos = useMemos((s) => s.memos)
  if (editing && folder && !rec) {
    const inF = memos.filter((m) => inFolder(m, folder))
    const ids = selected.filter((id) => inF.some((m) => m.id === id))
    if (folder === 'deleted') {
      const target = ids.length ? ids : inF.map((m) => m.id)
      return (
        <div className="vm-toolbar">
          <button disabled={!target.length} onClick={() => { recover(target); useVM.setState({ selected: [], editing: false }) }}>{ids.length ? 'Recover' : 'Recover All'}</button>
          <span className="vm-toolbar-count">{ids.length ? `${ids.length} Selected` : ''}</span>
          <button className="destructive" disabled={!target.length} onClick={() => confirmErase(target)}>{ids.length ? 'Delete' : 'Delete All'}</button>
        </div>
      )
    }
    const allFav = ids.length > 0 && ids.every((id) => memos.find((m) => m.id === id)?.favorite)
    return (
      <div className="vm-toolbar">
        <button disabled={!ids.length} onClick={() => { useMemos.setState((s) => ({ memos: s.memos.map((m) => (ids.includes(m.id) ? { ...m, favorite: !allFav } : m)) })); useVM.setState({ selected: [] }) }}>
          {allFav ? 'Unfavorite' : 'Favorite'}
        </button>
        <span className="vm-toolbar-count">{ids.length ? `${ids.length} Selected` : 'Select Recordings'}</span>
        <button className="destructive" disabled={!ids.length} onClick={() => { trash(ids); useVM.setState({ selected: [], editing: false }) }}>Delete</button>
      </div>
    )
  }
  if (folder === 'deleted' && !rec) return null
  return <Recorder />
}

function Recorder() {
  const rec = useVM((s) => s.rec)
  useVM((s) => s.recTick)
  const elapsed = rec ? (Date.now() - rec.startedAt) / 1000 : 0
  const tenths = Math.floor((elapsed * 10) % 10)
  return (
    <div className={`vm-recorder ${rec ? 'on' : ''}`}>
      {rec && (
        <div className="vm-rec-info">
          <div className="vm-rec-title">{rec.title}</div>
          <div className="vm-rec-time">{fmtDuration(Math.floor(elapsed))}<small>.{tenths}</small></div>
          <LiveWave startedAt={rec.startedAt} />
        </div>
      )}
      <button
        className={`vm-rec-btn ${rec ? 'stop' : ''}`}
        aria-label={rec ? 'Stop recording' : 'Record'}
        onClick={() => {
          if (rec) {
            stopRecording()
            useOS.getState().showToast('Voice memo saved')
          } else startRecording()
        }}
      >
        <span />
      </button>
    </div>
  )
}

/** Scrolling live waveform drawn on a canvas (generated levels, red playhead). */
function LiveWave({ startedAt }: { startedAt: number }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useLayoutEffect(() => {
    const cv = ref.current!
    let raf = 0
    const draw = () => {
      raf = requestAnimationFrame(draw)
      const w = cv.clientWidth
      const h = cv.clientHeight
      if (!w || !h) return
      const dpr = 2
      if (cv.width !== w * dpr) { cv.width = w * dpr; cv.height = h * dpr }
      const g = cv.getContext('2d')
      if (!g) return
      const cs = getComputedStyle(cv)
      const ink = cs.color
      const sub = cs.getPropertyValue('--label-tertiary') || 'rgba(128,128,128,.5)'
      g.setTransform(dpr, 0, 0, dpr, 0, 0)
      g.clearRect(0, 0, w, h)
      const pxPerSec = 40
      const step = pxPerSec / LEVELS_PER_SEC
      const elapsed = (Date.now() - startedAt) / 1000
      const head = Math.round(w * 0.62)
      const mid = h / 2 + 8
      // time ruler
      g.fillStyle = sub
      g.font = '500 10px -apple-system, system-ui, sans-serif'
      g.textAlign = 'center'
      const firstSec = Math.floor(elapsed - head / pxPerSec)
      for (let s = Math.max(0, firstSec); s <= elapsed + (w - head) / pxPerSec + 1; s++) {
        const x = head - (elapsed - s) * pxPerSec
        g.fillRect(x, 2, 1, 6)
        if (s % 2 === 0) g.fillText(fmtDuration(s), x, 19)
        g.fillRect(x + pxPerSec / 2, 2, 1, 3)
      }
      // bars
      const lv = liveLevels()
      g.fillStyle = ink
      const maxH = h - 34
      for (let i = lv.length - 1; i >= 0; i--) {
        const x = head - (elapsed - i / LEVELS_PER_SEC) * pxPerSec
        if (x < -4) break
        if (x > head) continue
        const bh = Math.max(2, lv[i] * maxH)
        g.beginPath()
        g.roundRect?.(x - 1.2, mid - bh / 2, Math.max(1.6, step * 0.55), bh, 1)
        if (!g.roundRect) g.rect(x - 1.2, mid - bh / 2, Math.max(1.6, step * 0.55), bh)
        g.fill()
      }
      // future dotted center line
      g.fillStyle = sub
      for (let x = head + 4; x < w; x += 6) g.fillRect(x, mid - 0.5, 2, 1)
      // playhead
      g.fillStyle = '#ff3b30'
      g.fillRect(head - 1, 10, 2, h - 12)
      g.beginPath(); g.arc(head, 10, 3.5, 0, Math.PI * 2); g.fill()
      g.beginPath(); g.arc(head, h - 3, 3.5, 0, Math.PI * 2); g.fill()
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [startedAt])
  return <canvas ref={ref} className="vm-live-wave" aria-label="Live waveform" role="img" />
}
