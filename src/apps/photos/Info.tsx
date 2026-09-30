import { useState } from 'react'
import { Star, X, Plus, MapPin, Sparkles, RotateCcw, ChevronDown, Leaf, Utensils, Landmark, Receipt, CloudLightning, ShoppingBag, FileText, PawPrint, Tag } from 'lucide-react'
import type { Photo } from '../../os/types'
import { useOS } from '../../os/store'
import { insightFor, SCENE_INSIGHTS } from '../../os/ai/vision'
import { MAP_PLACES } from '../../os/data/world'
import { PEOPLE_AND_PETS } from '../../os/data/photos'
import { AISparkle } from '../../ui/controls'
import { FaceChip } from './Sheets'
import { useUI } from './pstore'
import { fmtPhotoDate, aiEditNotes, isEdited, edits } from './look'
import { runVisionAction } from '../camera/actions'

const CAT_ICON: Record<string, React.ReactNode> = {
  plant: <Leaf size={16} />, food: <Utensils size={16} />, landmark: <Landmark size={16} />, receipt: <Receipt size={16} />,
  weather: <CloudLightning size={16} />, product: <ShoppingBag size={16} />, text: <FileText size={16} />, document: <FileText size={16} />,
  animal: <PawPrint size={16} />, place: <MapPin size={16} />,
}

export function Stars({ value, onChange, size = 26 }: { value: number; onChange: (v: number) => void; size?: number }) {
  return (
    <div className="ph-stars" role="radiogroup" aria-label="Rating">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} role="radio" aria-checked={value === n} aria-label={`${n} star${n > 1 ? 's' : ''}`} onClick={() => onChange(value === n ? 0 : n)} className={n <= value ? 'on' : ''}>
          <Star size={size} fill={n <= value ? 'currentColor' : 'none'} strokeWidth={1.8} />
        </button>
      ))}
    </div>
  )
}

export function InfoPanel({ photo, onClose, onExit }: { photo: Photo; onClose: () => void; onExit: () => void }) {
  const os = useOS.getState
  const [kw, setKw] = useState('')
  const [lookup, setLookup] = useState(false)
  const [actionNote, setActionNote] = useState<string | null>(null)
  const e = edits(photo)
  const ins = SCENE_INSIGHTS[photo.scene] ? insightFor(photo.scene) : null
  const notes = aiEditNotes(photo)
  const mp = Math.round((photo.width * photo.height) / 1e6)
  const lensMM = photo.lens?.match(/(\d+)\s*mm/)?.[1] ?? '24'
  const place = photo.place ? MAP_PLACES.find((m) => photo.place!.toLowerCase().includes(m.name.toLowerCase()) || m.name.toLowerCase().includes(photo.place!.toLowerCase())) : undefined
  const who = [...(photo.pets ?? []), ...(photo.people ?? [])]

  const addKw = () => {
    const t = kw.trim().toLowerCase()
    if (!t) return
    if (!photo.keywords.includes(t)) os().updatePhoto(photo.id, { keywords: [...photo.keywords, t] })
    setKw('')
  }

  return (
    <div className="ph-info scroll">
      <div className="ph-info-grab" onClick={onClose} role="button" aria-label="Close info"><span /></div>
      <div className="ph-info-head">
        <div className="t-headline">{fmtPhotoDate(photo.ts)}</div>
        {isEdited(photo) && <span className="ph-chip-edited">Edited</span>}
      </div>
      <p className="ph-info-caption t-subhead"><AISparkle size={13} /> {photo.description || 'No description'}</p>

      <div className="ph-info-card">
        <div className="ph-info-row">
          <span className="t-subhead bold">Rating</span>
          <Stars value={photo.rating ?? 0} onChange={(r) => { os().updatePhoto(photo.id, { rating: r || undefined }); if (r) os().showToast(`Rated ${'★'.repeat(r)}`) }} />
        </div>
      </div>

      {ins && (
        <div className={`ph-info-card ph-lookup ${lookup ? 'open' : ''}`}>
          <button className="ph-lookup-head" onClick={() => setLookup(!lookup)} aria-expanded={lookup}>
            <span className="ph-lookup-ic">{CAT_ICON[ins.category] ?? <Sparkles size={16} />}</span>
            <span className="grow" style={{ textAlign: 'left' }}>
              <span className="t-subhead bold" style={{ display: 'block' }}>Look Up — {ins.label}</span>
              <span className="t-caption1 secondary">What is this? · Visual Intelligence</span>
            </span>
            <ChevronDown size={18} style={{ transform: lookup ? 'rotate(180deg)' : undefined, transition: 'transform .25s' }} />
          </button>
          {lookup && (
            <div className="ph-lookup-body anim-fade">
              <p className="t-subhead">{ins.summary}</p>
              {ins.details.map((d) => <div key={d.label} className="ph-kv"><span className="secondary">{d.label}</span><span>{d.value}</span></div>)}
              {ins.actions.length > 0 && (
                <div className="ph-lookup-actions">
                  {ins.actions.map((a) => <button key={a.label} className="chip" onClick={() => setActionNote(runVisionAction(a.action))}>{a.label}</button>)}
                </div>
              )}
              {actionNote && <div className="ph-action-note t-footnote">{actionNote}</div>}
            </div>
          )}
        </div>
      )}

      <div className="ph-info-card">
        <div className="ph-info-row"><span className="t-subhead bold"><Tag size={14} /> Keywords</span></div>
        <div className="ph-kw-list">
          {photo.keywords.map((k) => (
            <span key={k} className="ph-kw">
              {k}
              <button aria-label={`Remove keyword ${k}`} onClick={() => os().updatePhoto(photo.id, { keywords: photo.keywords.filter((x) => x !== k) })}><X size={12} strokeWidth={3} /></button>
            </span>
          ))}
          <span className="ph-kw add">
            <Plus size={13} />
            <input value={kw} placeholder="Add Keyword" onChange={(ev) => setKw(ev.target.value)} onKeyDown={(ev) => ev.key === 'Enter' && addKw()} onBlur={addKw} aria-label="Add keyword" enterKeyHint="done" />
          </span>
        </div>
      </div>

      <div className="ph-info-card ph-exif">
        <div className="ph-exif-head">
          <span className="t-subhead bold">{photo.aiGenerated ? 'Image Playground' : photo.camera ?? 'iPhone'}</span>
          <span className="ph-exif-fmt">{photo.kind === 'video' ? 'HEVC' : photo.kind === 'screenshot' ? 'PNG' : 'HEIF'}</span>
        </div>
        <div className="t-footnote secondary ph-exif-lens">{photo.lens ?? 'Main Camera — 24 mm ƒ1.78'}</div>
        <div className="t-footnote secondary ph-exif-lens">{mp} MP • {photo.width} × {photo.height} • {photo.sizeMB} MB{photo.kind === 'video' ? ` • ${photo.duration}s` : ''}</div>
        <div className="ph-exif-grid t-footnote">
          <span>ISO {photo.iso ?? 100}</span><span>{lensMM} mm</span><span>{e.capture?.exposure ? `${e.capture.exposure > 0 ? '+' : ''}${e.capture.exposure.toFixed(1)} ev` : '0 ev'}</span><span>{photo.aperture ?? 'ƒ1.78'}</span><span>1/{120 + ((photo.iso ?? 100) % 5) * 60} s</span>
        </div>
      </div>

      {photo.place && (
        <button className="ph-info-card ph-map" onClick={() => { onExit(); os().launch('maps', place ? { route: `route/${place.id}` } : {}) }} aria-label={`Show ${photo.place} in Maps`}>
          <MiniMap seed={photo.place.length} />
          <div className="ph-map-label"><MapPin size={14} /> {photo.place}</div>
        </button>
      )}

      {who.length > 0 && (
        <div className="ph-info-card">
          <div className="ph-info-row"><span className="t-subhead bold">People & Pets</span></div>
          <div className="ph-info-people">
            {who.map((id) => (
              <button key={id} onClick={() => { const name = PEOPLE_AND_PETS.find((x) => x.id === id)?.name ?? id; useUI.getState().set({ viewer: null, tab: 'search', query: id === 'me' ? 'me' : name.replace(' (You)', '') }) }}>
                <FaceChip id={id} size={52} />
                <span className="t-caption1">{PEOPLE_AND_PETS.find((x) => x.id === id)?.name.split(' ')[0] ?? id}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {notes.length > 0 && (
        <div className="ph-info-card ph-ai-notes">
          <div className="ph-info-row"><span className="t-subhead bold"><AISparkle size={14} /> Edited with Apple Intelligence</span></div>
          {notes.map((n) => <div key={n} className="t-footnote secondary">• {n}</div>)}
        </div>
      )}
      {isEdited(photo) && (
        <button className="ph-info-card ph-revert" onClick={() => { os().updatePhoto(photo.id, { edits: e.capture ? ({ capture: e.capture } as Photo['edits']) : undefined }); os().showToast('Reverted to Original') }}>
          <RotateCcw size={16} /> Revert to Original
        </button>
      )}
      <div style={{ height: 120 }} />
    </div>
  )
}

function MiniMap({ seed }: { seed: number }) {
  const r = (n: number) => ((seed * 97 + n * 31) % 100) / 100
  return (
    <svg className="ph-minimap" viewBox="0 0 360 140" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <rect width="360" height="140" className="mm-land" />
      <path d={`M0 ${40 + r(1) * 60} C 120 ${r(2) * 140}, 220 ${r(3) * 140}, 360 ${30 + r(4) * 80}`} className="mm-water" />
      {[0, 1, 2, 3, 4].map((i) => <line key={i} x1={i * 80 + r(i) * 30} y1="0" x2={i * 80 + 30 - r(i + 3) * 40} y2="140" className="mm-road" />)}
      {[0, 1, 2].map((i) => <line key={`h${i}`} x1="0" y1={30 + i * 45} x2="360" y2={20 + i * 45 + r(i) * 20} className="mm-road" />)}
      <rect x={60 + r(6) * 200} y={20 + r(7) * 60} width="46" height="30" rx="4" className="mm-park" />
      <g transform="translate(180 70)">
        <circle r="16" fill="rgb(0 122 255 / .2)" />
        <circle r="7" fill="#fff" /><circle r="5" fill="#007aff" />
      </g>
    </svg>
  )
}
