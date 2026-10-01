import { useEffect, useMemo, useState } from 'react'
import { Check, ArrowUp, Play } from 'lucide-react'
import { Sheet } from '../../ui/overlay'
import { SearchField, AISparkle, Segmented } from '../../ui/controls'
import { useOS } from '../../os/store'
import { searchPhotos } from '../../os/search'
import { Scene } from '../../art/Scene'
import { fmtDuration } from '../../os/time'

/** Photos picker used by the + menu and by the "Search Photos" Apple Intelligence suggestion. */
export function PhotoPicker({ open, onClose, initialQuery = '', onSend, aiContext }: { open: boolean; onClose: () => void; initialQuery?: string; onSend: (ids: string[]) => void; aiContext?: string }) {
  const [q, setQ] = useState(initialQuery)
  const [sel, setSel] = useState<string[]>([])
  const [tab, setTab] = useState<'Photos' | 'Collections'>('Photos')
  const photos = useOS((s) => s.photos)
  useEffect(() => {
    if (open) {
      setQ(initialQuery)
      setSel([])
    }
  }, [open, initialQuery])
  const list = useMemo(() => {
    let base = q.trim() ? searchPhotos(q) : [...photos].sort((a, b) => b.ts - a.ts)
    if (q.trim()) {
      // prefer photos that match every word (e.g. "Biscuit" AND "beach")
      const words = q.toLowerCase().split(/\s+/).filter(Boolean)
      const hay = (p: (typeof photos)[number]) => [p.description, p.place, ...(p.keywords ?? []), ...(p.pets ?? []), ...(p.people ?? [])].join(' ').toLowerCase()
      const strict = base.filter((p) => words.every((w) => hay(p).includes(w)))
      if (strict.length) base = strict
    }
    const visible = base.filter((p) => !p.hidden && !p.idDocument)
    return tab === 'Collections' ? visible.filter((p) => p.favorite) : visible
  }, [q, photos, tab])
  const toggle = (id: string) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))
  return (
    <Sheet
      open={open}
      onClose={onClose}
      detent="large"
      title={<Segmented options={['Photos', 'Collections'] as const} value={tab} onChange={setTab} labels={{ Collections: 'Favorites' }} style={{ width: 200, margin: '0 auto' }} />}
      trailing={
        <button className={`bar-btn icon ${sel.length ? 'prominent' : 'glass'}`} aria-label="Send" disabled={!sel.length} onClick={() => { onSend(sel); onClose() }}>
          <ArrowUp size={22} strokeWidth={2.6} />
        </button>
      }
      label="Choose Photos"
    >
      <div className="msg-picker">
        {aiContext && (
          <div className="msg-picker-ai">
            <AISparkle size={16} />
            <span>{aiContext}</span>
          </div>
        )}
        <div style={{ padding: '4px 16px 10px' }}>
          <SearchField value={q} onChange={setQ} placeholder="Search photos, people, places…" />
        </div>
        {q.trim() && <div className="msg-picker-count">{list.length} {list.length === 1 ? 'Result' : 'Results'} for “{q.trim()}”</div>}
        <div className="msg-picker-grid">
          {list.map((p) => {
            const i = sel.indexOf(p.id)
            return (
              <button key={p.id} className={`msg-picker-cell ${i >= 0 ? 'sel' : ''}`} onClick={() => toggle(p.id)} aria-label={p.description} aria-pressed={i >= 0}>
                <Scene scene={p.scene} />
                {p.kind === 'video' && <span className="msg-picker-dur"><Play size={10} fill="#fff" strokeWidth={0} /> {fmtDuration(p.duration ?? 0)}</span>}
                <span className="msg-picker-check">{i >= 0 ? <><Check size={13} strokeWidth={3.5} /></> : null}</span>
              </button>
            )
          })}
        </div>
        {list.length === 0 && <div className="empty-state"><div className="t-title2">No Results</div><div>Try searching for a person, place or thing.</div></div>}
        {sel.length > 0 && (
          <div className="msg-picker-bar glass">
            <span>{sel.length} Selected</span>
            <button className="btn filled small" onClick={() => { onSend(sel); onClose() }}>Send</button>
          </div>
        )}
      </div>
    </Sheet>
  )
}
