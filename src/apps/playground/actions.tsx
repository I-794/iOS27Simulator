import { useEffect, useState } from 'react'
import { Check } from 'lucide-react'
import { Sheet } from '../../ui/overlay'
import { Avatar } from '../../ui/controls'
import { useOS, type ImageGen } from '../../os/store'
import { conceptsFor } from '../../art/GenImage'
import { contactName } from '../../os/data/people'
import { GenView, genToSpec, usePG } from './shared'

/** Photorealistic base scene for a generation (used when saving to Photos). */
function photorealScene(g: ImageGen): string {
  if (g.source) return g.source
  const c = conceptsFor([g.prompt, ...g.edits].join(' '))
  return c.subject === 'dog' ? (c.setting === 'beach' ? 'dog-beach' : c.setting === 'snow' ? 'dog-snow' : 'dog-park')
    : c.subject === 'cat' ? 'cat-window' : c.subject === 'robot' ? 'robot-workshop' : c.subject === 'flower' ? 'plant-sunflower'
      : c.setting === 'space' ? 'night-sky' : c.setting === 'beach' ? 'sunset-beach' : c.setting === 'city' ? 'city-night' : c.setting === 'mountain' ? 'mountain-lake' : c.setting === 'snow' ? 'snow-cabin' : c.setting === 'stage' ? 'concert-lights' : 'autumn-trees'
}

export function saveToPhotos(g: ImageGen) {
  const st = useOS.getState()
  const scene = g.style === 'Photorealistic' ? photorealScene(g) : `gen:${g.id}`
  st.addPhoto({
    scene,
    ts: Date.now(),
    kind: 'photo',
    keywords: ['image playground', 'ai', 'generated', g.style.toLowerCase(), ...g.prompt.toLowerCase().split(/[\s,]+/).filter((w) => w.length > 3).slice(0, 6)],
    capturedByMe: true,
    aiGenerated: true,
    description: `Image Playground (${g.style}): ${[g.prompt, ...g.edits].join(', ')}`,
    camera: 'Image Playground',
    width: 1024,
    height: 1024,
    sizeMB: 1.4,
  })
  st.showToast('Saved to Photos')
}

export function setWallpaper(g: ImageGen) {
  const st = useOS.getState()
  st.set({ wallpaper: `gen:${g.id}` })
  st.showToast('Set as Lock Screen & Home Screen')
}

const FONTS = [
  { id: 'bold', label: 'Bold', css: '800 64px/0.95 var(--font-display)' },
  { id: 'rounded', label: 'Rounded', css: '700 60px/0.95 var(--font-rounded)' },
  { id: 'serif', label: 'Serif', css: '600 60px/0.95 ui-serif, Georgia, serif' },
]

export function PosterSheet({ genId, onClose }: { genId: string | null; onClose: () => void }) {
  const g = useOS((s) => s.imageGens.find((x) => x.id === genId))
  const [who, setWho] = useState('me')
  const [font, setFont] = useState(FONTS[0])
  const [saved, setSaved] = useState(false)
  useEffect(() => { if (genId) setSaved(false) }, [genId])
  const name = who === 'me' ? 'Jamie' : contactName(who)
  const [first, ...rest] = (who === 'me' ? 'Jamie Park' : contactName(who, 'full')).split(' ')
  return (
    <Sheet open={!!genId} onClose={onClose} title="Contact Poster" detent="large">
      {g && (
        <div className="pg-poster-wrap">
          <div className="pg-poster">
            <GenView g={genToSpec(g)} stickers={usePG.getState().stickers[g.id]} strokes={usePG.getState().strokes[g.id]} />
            <div className="pg-poster-name" style={{ font: font.css }}>
              <span>{first}</span>
              {rest.length > 0 && <span>{rest.join(' ')}</span>}
            </div>
            <span className="pg-ai-badge" style={{ top: 'auto', bottom: 14 }}>✦ AI</span>
          </div>
          <div className="pg-poster-who scroll">
            {['me', 'mom', 'dad', 'mia', 'alex', 'sam'].map((id) => (
              <button key={id} className={who === id ? 'on' : ''} onClick={() => setWho(id)}><Avatar id={id} size={40} />{id === 'me' ? 'My Card' : contactName(id)}</button>
            ))}
          </div>
          <div className="pg-poster-fonts">
            {FONTS.map((f) => <button key={f.id} className={font.id === f.id ? 'on' : ''} style={{ font: f.css.replace(/\d+px\/0\.95/, '20px/1') }} onClick={() => setFont(f)}>Aa</button>)}
          </div>
          <button className="btn filled block" style={{ height: 50, borderRadius: 25, marginTop: 14 }} disabled={saved} onClick={() => {
            usePG.getState().set({ poster: { genId: g.id, contact: who } })
            setSaved(true)
            useOS.getState().showToast(who === 'me' ? 'Your Contact Poster was updated' : `Poster set for ${name}`)
          }}>{saved ? <><Check size={18} /> Poster Saved</> : 'Use as Contact Poster'}</button>
          <div className="t-footnote secondary center" style={{ marginTop: 10 }}>Your poster appears when you call or message people who have your contact.</div>
        </div>
      )}
    </Sheet>
  )
}
