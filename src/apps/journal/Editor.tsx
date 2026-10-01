import { useEffect, useRef, useState } from 'react'
import { Image as ImageIcon, MapPin, Music, Activity, Mic, Smile, X, MoreHorizontal, Bookmark, Trash2, Check, Square, Sparkles } from 'lucide-react'
import { Page, useNav } from '../../ui/nav'
import { Glass } from '../../ui/controls'
import { Sheet, openMenu, showAlert } from '../../ui/overlay'
import { useOS, uid } from '../../os/store'
import type { JournalEntry } from '../../os/types'
import { fmtDate, fmtTime } from '../../os/time'
import { VISITED, HEALTH } from '../../os/data/world'
import { TRACKS } from '../../os/data/media'
import { Scene } from '../../art/Scene'
import { saveEntry, deleteEntry, useJournalLocal, MOODS, ATTACH_LIMIT_MB, attachmentUsageMB, type JPrompt } from './data'
import { AttachChip } from './Chips'

type Att = JournalEntry['attachments'][number]

export function EntryEditor({ id, prompt }: { id?: string; prompt?: JPrompt }) {
  const nav = useNav()
  const existing = useOS((s) => (id ? s.journal.find((e) => e.id === id) : undefined))
  const bookmarks = useJournalLocal((s) => s.bookmarks)
  const [e, setE] = useState<JournalEntry>(() => existing ?? {
    id: uid('j'), ts: Date.now(), title: '', body: '', photos: prompt?.photo ? [prompt.photo] : [], attachments: prompt?.attach ? [prompt.attach] : [], prompt: prompt?.text,
  })
  const [sheet, setSheet] = useState<null | 'photos' | 'place' | 'song' | 'workout' | 'audio'>(null)
  const bodyRef = useRef<HTMLTextAreaElement>(null)
  const nonEmpty = !!(e.title.trim() || e.body.trim() || e.photos.length || e.attachments.length)

  useEffect(() => {
    if (nonEmpty) saveEntry(e)
  }, [e, nonEmpty])

  useEffect(() => {
    const el = bodyRef.current
    if (el) { el.style.height = 'auto'; el.style.height = `${el.scrollHeight}px` }
  }, [e.body])

  useEffect(() => {
    if (!id) window.setTimeout(() => bodyRef.current?.focus(), 450)
  }, [id])

  const patch = (p: Partial<JournalEntry>) => setE((x) => ({ ...x, ...p }))
  const addAtt = (a: Att) => { patch({ attachments: [...e.attachments.filter((x) => !(x.kind === a.kind && x.label === a.label)), a] }); setSheet(null) }
  const usage = attachmentUsageMB(e)
  const done = () => {
    ;(document.activeElement as HTMLElement | null)?.blur?.()
    if (nonEmpty) useOS.getState().showToast(id ? 'Entry updated' : 'Entry saved')
    nav.pop()
  }
  const menu = (el: HTMLElement) => openMenu(el, [
    { label: bookmarks[e.id] ? 'Remove Bookmark' : 'Bookmark', icon: <Bookmark size={18} />, onSelect: () => { saveEntry(e); const l = useJournalLocal.getState(); l.set({ bookmarks: { ...l.bookmarks, [e.id]: !l.bookmarks[e.id] } }) } },
    { label: 'Set Date to Yesterday', icon: <Check size={18} />, onSelect: () => patch({ ts: e.ts - 86_400_000 }) },
    { label: 'Delete Entry', icon: <Trash2 size={18} />, destructive: true, separatorBefore: true, onSelect: () => showAlert({ title: 'Delete Entry?', message: 'This entry will be deleted from all your devices.', actions: [{ label: 'Cancel', style: 'cancel' }, { label: 'Delete', style: 'destructive', onPress: () => { deleteEntry(e.id); nav.pop() } }] }) },
  ])

  return (
    <Page
      large={false}
      className="jn-editor-page"
      inlineTitle={<span className="jn-ed-date">{fmtDate(e.ts, 'weekday')}<small>{fmtDate(e.ts, 'monthDay')} · {fmtTime(e.ts)}</small></span>}
      onBack={done}
      trailing={<>
        <button className="bar-btn icon glass interactive" aria-label="Entry options" onClick={(ev) => menu(ev.currentTarget)}><MoreHorizontal size={22} /></button>
        <button className="bar-btn prominent jn-done" onClick={done}>Done</button>
      </>}
      bottomExtra={70}
      footer={
        <div className="jn-ed-bar-wrap">
          <Glass className="jn-ed-bar" variant="heavy">
            <button aria-label="Add photos" onClick={() => setSheet('photos')}><ImageIcon size={21} /></button>
            <button aria-label="Add location" onClick={() => setSheet('place')}><MapPin size={21} /></button>
            <button aria-label="Add song" onClick={() => setSheet('song')}><Music size={21} /></button>
            <button aria-label="Add workout" onClick={() => setSheet('workout')}><Activity size={21} /></button>
            <button aria-label="Record audio" onClick={() => setSheet('audio')}><Mic size={21} /></button>
            <button aria-label="Mood" onClick={(ev) => openMenu(ev.currentTarget, MOODS.map((m) => ({ label: m, icon: e.mood === m ? <Check size={17} /> : undefined, onSelect: () => patch({ mood: m }) })), { title: 'How are you feeling?' })}>{e.mood ? <span style={{ fontSize: 20 }}>{e.mood}</span> : <Smile size={21} />}</button>
          </Glass>
        </div>
      }
    >
      <div className="jn-ed">
        {e.prompt && (
          <div className="jn-ed-prompt anim-up">
            <Sparkles size={15} />
            <span className="grow">{e.prompt}</span>
            <button aria-label="Remove prompt" onClick={() => patch({ prompt: undefined })}><X size={14} /></button>
          </div>
        )}
        {e.photos.length > 0 && (
          <div className={`jn-ed-photos n${Math.min(3, e.photos.length)}`}>
            {e.photos.map((pid) => <EdPhoto key={pid} pid={pid} onRemove={() => patch({ photos: e.photos.filter((x) => x !== pid) })} />)}
          </div>
        )}
        <input className="jn-ed-title" placeholder="Title" value={e.title} onChange={(ev) => patch({ title: ev.target.value })} aria-label="Title" />
        <textarea ref={bodyRef} className="jn-ed-body" placeholder={e.prompt ? 'Start writing…' : 'What’s on your mind?'} value={e.body} onChange={(ev) => patch({ body: ev.target.value })} aria-label="Entry" rows={4} data-dictation="The intake finally worked today and I stayed late with Alex.|Sectionals went really well." />
        {e.attachments.length > 0 && (
          <div className="jn-chips">{e.attachments.map((a, i) => <AttachChip key={i} a={a} onRemove={() => patch({ attachments: e.attachments.filter((_x, j) => j !== i) })} />)}</div>
        )}
        <div className="jn-allow">
          <div className="row" style={{ justifyContent: 'space-between' }}><span>Attachments</span><span>{usage.toFixed(1)} MB of 1 GB</span></div>
          <div className="jn-allow-bar"><div style={{ width: `${Math.max(1, (usage / ATTACH_LIMIT_MB) * 100)}%` }} /></div>
          <div className="t-caption2 tertiary" style={{ marginTop: 4 }}>iOS 27 allows attachments up to 1 GB per entry, including longer videos and audio.</div>
        </div>
      </div>

      <PhotoSheet open={sheet === 'photos'} selected={e.photos} onClose={() => setSheet(null)} onDone={(ids) => { patch({ photos: ids }); setSheet(null) }} />
      <Sheet open={sheet === 'place'} onClose={() => setSheet(null)} title="Add Location" detent="medium">
        <div className="list">{VISITED.map((v) => <button key={v.place} className="row-item" onClick={() => addAtt({ kind: 'location', label: v.place })}><MapPin size={18} color="var(--red)" /><span className="row-main"><span className="row-title">{v.place}</span><span className="row-sub">{fmtDate(v.when, 'monthDay')} · {v.duration}</span></span></button>)}</div>
      </Sheet>
      <Sheet open={sheet === 'song'} onClose={() => setSheet(null)} title="Add Music" detent="medium">
        <div className="list">{TRACKS.slice(0, 8).map((t) => <button key={t.id} className="row-item" onClick={() => addAtt({ kind: 'song', label: `${t.title} — ${t.artist}` })}><Music size={18} color="var(--pink)" /><span className="row-main"><span className="row-title">{t.title}</span><span className="row-sub">{t.artist}</span></span></button>)}</div>
      </Sheet>
      <Sheet open={sheet === 'workout'} onClose={() => setSheet(null)} title="Add Workout" detent="medium">
        <div className="list">{HEALTH.workouts.map((w) => <button key={w.id} className="row-item" onClick={() => addAtt({ kind: 'workout', label: `${w.kind} · ${w.distance !== '—' ? w.distance : w.duration}` })}><Activity size={18} color="var(--green)" /><span className="row-main"><span className="row-title">{w.kind}</span><span className="row-sub">{fmtDate(w.when, 'monthDay')} · {w.duration}</span></span></button>)}</div>
      </Sheet>
      <AudioSheet open={sheet === 'audio'} onClose={() => setSheet(null)} onDone={(secs) => addAtt({ kind: 'audio', label: `Audio · ${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}` })} />
    </Page>
  )
}

function EdPhoto({ pid, onRemove }: { pid: string; onRemove: () => void }) {
  const p = useOS((s) => s.photos.find((x) => x.id === pid))
  return (
    <div className="jn-ed-photo">
      <Scene scene={p?.scene ?? pid.replace(/^p-/, '')} />
      <button aria-label="Remove photo" onClick={onRemove}><X size={13} strokeWidth={3} /></button>
    </div>
  )
}

function PhotoSheet({ open, selected, onClose, onDone }: { open: boolean; selected: string[]; onClose: () => void; onDone: (ids: string[]) => void }) {
  const photos = useOS((s) => s.photos)
  const [sel, setSel] = useState<string[]>(selected)
  useEffect(() => { if (open) setSel(selected) }, [open, selected])
  const list = photos.filter((p) => !p.hidden && !p.idDocument).sort((a, b) => b.ts - a.ts).slice(0, 45)
  return (
    <Sheet open={open} onClose={onClose} title="Photos" detent="large" trailing={<button className="bar-btn prominent" onClick={() => onDone(sel)}>Add</button>}>
      <div className="jn-photo-grid">
        {list.map((p) => {
          const i = sel.indexOf(p.id)
          return (
            <button key={p.id} aria-label={p.description} aria-pressed={i >= 0} onClick={() => setSel((s) => (i >= 0 ? s.filter((x) => x !== p.id) : [...s, p.id]))}>
              <Scene scene={p.scene} />
              {i >= 0 && <span className="jn-pick">{i + 1}</span>}
            </button>
          )
        })}
      </div>
    </Sheet>
  )
}

function AudioSheet({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: (secs: number) => void }) {
  const [rec, setRec] = useState(false)
  const [secs, setSecs] = useState(0)
  useEffect(() => { if (open) { setRec(false); setSecs(0) } }, [open])
  useEffect(() => {
    if (!rec) return
    const iv = window.setInterval(() => setSecs((s) => s + 1), 1000)
    return () => window.clearInterval(iv)
  }, [rec])
  return (
    <Sheet open={open} onClose={onClose} title="Audio Recording" detent="auto">
      <div className="jn-audio">
        <div className={`jn-audio-wave ${rec ? 'on' : ''}`}>{Array.from({ length: 24 }).map((_, i) => <span key={i} style={{ animationDelay: `${(i * 83) % 700}ms` }} />)}</div>
        <div className="t-title1" style={{ fontVariantNumeric: 'tabular-nums' }}>{Math.floor(secs / 60)}:{String(secs % 60).padStart(2, '0')}</div>
        <div className="t-footnote secondary">{rec ? 'Recording… transcription will appear in your entry' : 'Tap to record a voice note'}</div>
        <button className={`jn-rec ${rec ? 'on' : ''}`} aria-label={rec ? 'Stop recording' : 'Start recording'} onClick={() => { if (rec) { setRec(false); onDone(Math.max(1, secs)) } else setRec(true) }}>
          {rec ? <Square size={22} fill="#fff" color="#fff" /> : <span />}
        </button>
      </div>
    </Sheet>
  )
}
