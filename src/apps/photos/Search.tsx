import { useEffect, useMemo, useState } from 'react'
import { Clock, MapPin, Star, Video, Search as SearchIcon, Camera, Receipt, Sparkles, X } from 'lucide-react'
import { Page } from '../../ui/nav'
import { SearchField, AISparkle } from '../../ui/controls'
import { useDebounced } from '../../os/hooks'
import { timeFilter } from '../../os/search'
import { PEOPLE_AND_PETS } from '../../os/data/photos'
import { PhotoGrid } from './Grid'
import { FaceChip } from './Sheets'
import { usePh, useUI, useLibrary, openViewer } from './pstore'
import { photoSearch } from './collections-data'

const SUGGESTIONS: { q: string; icon: React.ReactNode }[] = [
  { q: 'Biscuit at the beach', icon: <Sparkles size={17} /> },
  { q: '5 stars', icon: <Star size={17} /> },
  { q: 'receipt', icon: <Receipt size={17} /> },
  { q: 'videos from last week', icon: <Video size={17} /> },
  { q: 'shot on ultra wide', icon: <Camera size={17} /> },
  { q: 'robotics competition', icon: <Sparkles size={17} /> },
  { q: 'sunset at Pelican Cove', icon: <MapPin size={17} /> },
]

function understand(q: string) {
  const l = q.toLowerCase()
  const chips: string[] = []
  for (const x of PEOPLE_AND_PETS) if (l.includes(x.id.toLowerCase()) || l.includes(x.name.split(' ')[0].toLowerCase())) chips.push(x.kind === 'pet' ? `🐾 ${x.name}` : `👤 ${x.name}`)
  const tf = timeFilter(l)
  if (tf) chips.push(`🗓 ${tf.label}`)
  const r = l.match(/(\d)\s*(\+|or more)?\s*star/)
  if (r) chips.push(`★ ${r[1]}+ stars`)
  if (/video/.test(l)) chips.push('▶︎ Videos')
  if (/ultra ?wide|telephoto|front camera|main camera/.test(l)) chips.push('📷 Lens')
  if (/screenshot/.test(l)) chips.push('Screenshots')
  return chips
}

export function SearchTab() {
  const lib = useLibrary()
  const q0 = useUI((s) => s.query)
  const recents = usePh((s) => s.recentSearches)
  const [q, setQ] = useState(q0)
  useEffect(() => setQ(q0), [q0])
  const dq = useDebounced(q, 200)
  const results = useMemo(() => {
    const r = photoSearch(dq, lib)
    if (r.length || !dq.trim()) return r
    // Time-only fallback, e.g. "videos from last week"
    const tf = timeFilter(dq)
    if (tf) return lib.filter((p) => p.ts >= tf.from && p.ts < tf.to && (!/video/.test(dq) || p.kind === 'video'))
    return r
  }, [dq, lib])
  const asc = useMemo(() => [...results].reverse(), [results])
  const ids = useMemo(() => asc.map((p) => p.id), [asc])
  const people = PEOPLE_AND_PETS.filter((x) => lib.some((p) => p.people?.includes(x.id) || p.pets?.includes(x.id)))
  const places = useMemo(() => [...new Set(lib.map((p) => p.place).filter(Boolean) as string[])].slice(0, 10), [lib])
  const submit = (text = q) => {
    setQ(text)
    usePh.getState().addSearch(text)
  }
  const chips = understand(dq)

  return (
    <Page title="Search" bottomExtra={80}>
      <div className="ph-search-bar">
        <SearchField value={q} onChange={setQ} placeholder="Places, People, Things & More" onSubmit={() => submit()} />
      </div>
      {!dq.trim() ? (
        <div className="ph-search-home">
          <div className="ph-sec-head"><span className="ph-sec-title static">People & Pets</span></div>
          <div className="ph-hscroll ph-people-row">
            {people.map((x) => (
              <button key={x.id} className="ph-person" onClick={() => submit(x.id === 'me' ? 'me' : x.name.split(' ')[0])}>
                <FaceChip id={x.id} size={68} />
                <span className="t-caption1">{x.name.split(' ')[0]}</span>
              </button>
            ))}
          </div>
          {recents.length > 0 && (
            <>
              <div className="ph-sec-head"><span className="ph-sec-title static">Recent Searches</span><button className="ph-sec-act" onClick={() => usePh.getState().set({ recentSearches: [] })}>Clear</button></div>
              <div className="ph-sugg-list">
                {recents.map((r) => (
                  <div key={r} className="ph-sugg">
                    <button className="grow row gap12" onClick={() => submit(r)}><Clock size={17} className="secondary" /><span className="t-body">{r}</span></button>
                    <button aria-label={`Remove ${r}`} onClick={() => usePh.getState().set({ recentSearches: recents.filter((x) => x !== r) })}><X size={16} className="tertiary" /></button>
                  </div>
                ))}
              </div>
            </>
          )}
          <div className="ph-sec-head"><span className="ph-sec-title static">Suggestions</span></div>
          <div className="ph-sugg-list">
            {SUGGESTIONS.map((s) => (
              <button key={s.q} className="ph-sugg" onClick={() => submit(s.q)}>
                <span className="ph-sugg-ic">{s.icon}</span><span className="t-body grow" style={{ textAlign: 'left' }}>{s.q[0].toUpperCase() + s.q.slice(1)}</span>
              </button>
            ))}
          </div>
          <div className="ph-sec-head"><span className="ph-sec-title static">Places</span></div>
          <div className="ph-chips" style={{ padding: '0 16px' }}>
            {places.map((p) => <button key={p} className="chip" onClick={() => submit(p)}><MapPin size={13} /> {p}</button>)}
          </div>
          <div className="t-footnote secondary ph-search-foot"><AISparkle size={13} /> Search understands natural language, like “Biscuit running on the beach at sunset”, plus camera details, keywords and ratings.</div>
        </div>
      ) : (
        <div className="ph-search-results">
          <div className="ph-search-meta">
            <span className="t-subhead bold">{results.length} Result{results.length === 1 ? '' : 's'}</span>
            {chips.map((c) => <span key={c} className="ph-understood">{c}</span>)}
          </div>
          {results.length ? (
            <PhotoGrid photos={asc} onOpen={(id, el) => { usePh.getState().addSearch(dq); openViewer(ids, id, el) }} />
          ) : (
            <div className="empty-state" style={{ paddingTop: 60 }}>
              <SearchIcon size={40} strokeWidth={1.5} />
              <div className="t-headline">No Results for “{dq}”</div>
              <div className="t-subhead secondary">Try a different description, place, person or pet.</div>
            </div>
          )}
        </div>
      )}
    </Page>
  )
}
