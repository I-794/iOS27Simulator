import { useState } from 'react'
import { Plus, Download, Smartphone, Contact, Share, Trash2, Pencil, Image as ImageIcon, Smile, Wand } from 'lucide-react'
import { NavStack, Page, useNav } from '../../ui/nav'
import { AISparkle } from '../../ui/controls'
import { Sheet, showAlert } from '../../ui/overlay'
import { List, Row } from '../../ui/list'
import { useOS, uid, type ImageGen } from '../../os/store'
import { useAppRoute } from '../../os/hooks'
import { fmtDate, fmtTime } from '../../os/time'
import { Scene } from '../../art/Scene'
import { CreatePage } from './Create'
import { GenView, genToSpec, usePG, useRemaining, GenmojiArt, consumeGeneration, DAILY_LIMIT } from './shared'
import { saveToPhotos, setWallpaper, PosterSheet } from './actions'
import './playground.css'

export default function PlaygroundApp() {
  return (
    <div className="app-root pg">
      <NavStack root={<Library />} />
    </div>
  )
}

function Library() {
  const nav = useNav()
  const gens = useOS((s) => s.imageGens)
  const genmoji = usePG((s) => s.genmoji)
  const remaining = useRemaining()
  const [gm, setGm] = useState(false)
  const [pick, setPick] = useState(false)
  const photos = useOS((s) => s.photos)

  useAppRoute('playground', (route) => {
    const [kind, arg] = route.split('/')
    nav.popToRoot()
    if (kind === 'gen' && arg) {
      const g = useOS.getState().imageGens.find((x) => x.id === arg)
      if (g) nav.push(<Detail id={g.id} />)
    } else if (kind === 'new' || kind === 'prompt') nav.push(<CreatePage initialPrompt={arg ? decodeURIComponent(arg) : undefined} />)
    else if (kind === 'photo' && arg) nav.push(<CreatePage photoId={arg} />)
    else if (kind === 'genmoji') setGm(true)
  })

  return (
    <Page
      title="Image Playground"
      trailing={<button className="bar-btn icon prominent" aria-label="New Image" onClick={() => nav.push(<CreatePage />)} style={{ background: 'linear-gradient(135deg,#ff375f,#bf5af2 55%,#0a84ff)' }}><Plus size={22} strokeWidth={2.6} /></button>}
    >
      <button className="pg-hero pressable" onClick={() => nav.push(<CreatePage />)}>
        <div className="pg-hero-bubbles">
          {['🐶', '🤖', '🥁', '🌧️', '🚀', '😎'].map((e, i) => <span key={e} style={{ animationDelay: `${i * -1.1}s`, left: `${12 + i * 15}%` }}>{e}</span>)}
        </div>
        <div className="pg-hero-text">
          <div className="row gap6"><AISparkle size={18} /><span className="t-headline">New Image</span></div>
          <div className="t-footnote secondary">Describe anything, add concepts like Biscuit or Seattle, pick a style — now including Photorealistic.</div>
        </div>
      </button>

      <div className="pg-quick">
        <button className="pressable" onClick={() => setPick(true)}><span style={{ background: 'linear-gradient(135deg,#34c759,#30b0c7)' }}><ImageIcon size={20} color="#fff" /></span>Transform a Photo</button>
        <button className="pressable" onClick={() => setGm(true)}><span style={{ background: 'linear-gradient(135deg,#ffcc00,#ff9500)' }}><Smile size={20} color="#fff" /></span>Genmoji</button>
        <button className="pressable" onClick={() => nav.push(<CreatePage initialPrompt="Biscuit as an astronaut" />)}><span style={{ background: 'linear-gradient(135deg,#5e5ce6,#bf5af2)' }}><Wand size={20} color="#fff" /></span>Surprise Me</button>
      </div>

      <div className="pg-limit-card">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <span className="t-subhead bold">Today’s generations</span>
          <span className="t-subhead secondary">{remaining} of {DAILY_LIMIT} left</span>
        </div>
        <div className="pg-limit-bar"><div style={{ width: `${(remaining / DAILY_LIMIT) * 100}%` }} /></div>
        <div className="t-caption1 secondary" style={{ marginTop: 6 }}>iOS 27 sets daily limits for image generation and Siri AI requests. Your count resets at midnight.</div>
      </div>

      {genmoji.length > 0 && (
        <>
          <div className="list-header">Genmoji</div>
          <div className="pg-gm-row scroll">
            {genmoji.map((g) => <span key={g.id} title={g.prompt}><GenmojiArt prompt={g.prompt} seed={7} size={54} /></span>)}
          </div>
        </>
      )}

      <div className="list-header">Library{gens.length ? ` · ${gens.length}` : ''}</div>
      {gens.length === 0 ? (
        <div className="empty-state" style={{ paddingTop: 30 }}>
          <AISparkle size={34} />
          <div className="t-title2">No Images Yet</div>
          <div className="t-subhead">Images you create appear here, ready to share, save to Photos or use as your wallpaper.</div>
        </div>
      ) : (
        <div className="pg-lib-grid">
          {gens.map((g) => <LibTile key={g.id} g={g} onOpen={() => nav.push(<Detail id={g.id} />)} />)}
        </div>
      )}

      <GenmojiSheet open={gm} onClose={() => setGm(false)} />
      <Sheet open={pick} onClose={() => setPick(false)} title="Transform a Photo" detent="large">
        <div className="pg-photo-grid">
          {photos.filter((p) => !p.hidden && !p.idDocument && p.kind !== 'video').slice(0, 36).map((p) => (
            <button key={p.id} aria-label={p.description} onClick={() => { setPick(false); nav.push(<CreatePage photoId={p.id} />) }}><Scene scene={p.scene} /></button>
          ))}
        </div>
      </Sheet>
    </Page>
  )
}

function LibTile({ g, onOpen }: { g: ImageGen; onOpen: () => void }) {
  const stickers = usePG((s) => s.stickers[g.id])
  const strokes = usePG((s) => s.strokes[g.id])
  return (
    <button className="pg-lib-tile pressable" onClick={onOpen} aria-label={g.prompt}>
      <GenView g={genToSpec(g)} stickers={stickers} strokes={strokes} badge />
    </button>
  )
}

function Detail({ id }: { id: string }) {
  const nav = useNav()
  const g = useOS((s) => s.imageGens.find((x) => x.id === id))
  const wallpaper = useOS((s) => s.wallpaper)
  const stickers = usePG((s) => s.stickers[id])
  const strokes = usePG((s) => s.strokes[id])
  const [poster, setPoster] = useState<string | null>(null)
  if (!g) return <Page title="Image" large={false}><div className="empty-state">This image was deleted.</div></Page>
  const del = () => showAlert({ title: 'Delete Image?', message: 'It will be removed from your Image Playground library.', actions: [{ label: 'Cancel', style: 'cancel' }, { label: 'Delete', style: 'destructive', onPress: () => { const st = useOS.getState(); st.set({ imageGens: st.imageGens.filter((x) => x.id !== id), ...(st.wallpaper === `gen:${id}` ? { wallpaper: 'sequoia' } : {}) }); nav.pop() } }] })
  return (
    <Page title="" large={false} grouped inlineTitle={<span className="row gap6"><AISparkle size={15} /> {g.style}</span>}
      trailing={<button className="bar-btn icon glass interactive" aria-label="Share" onClick={() => useOS.getState().set({ shareRequest: { title: g.prompt, kind: 'photo', payload: `gen:${g.id}`, app: 'playground' } })}><Share size={19} /></button>}>
      <div className="pg-detail-img"><GenView g={genToSpec(g)} stickers={stickers} strokes={strokes} badge /></div>
      <List header="Details" footer="Images made with Image Playground include metadata indicating they were created with Apple Intelligence.">
        <Row title="Created with" detail="Image Playground" />
        <Row title="Style" detail={g.style} />
        <Row title="Date" detail={`${fmtDate(g.ts, 'short')}, ${fmtTime(g.ts)}`} />
        <Row title="Description" subtitle={[g.prompt, ...g.edits].join(' · ')} />
      </List>
      <List>
        <Row title="Edit in Image Playground" icon={<Pencil size={20} className="accent" />} onClick={() => nav.push(<CreatePage edit={g} />)} />
        <Row title="Save to Photos" icon={<Download size={20} className="accent" />} onClick={() => saveToPhotos(g)} />
        <Row title={wallpaper === `gen:${g.id}` ? 'Current Wallpaper' : 'Set as Lock Screen Wallpaper'} icon={<Smartphone size={20} className="accent" />} onClick={() => setWallpaper(g)} detail={wallpaper === `gen:${g.id}` ? '✓' : undefined} />
        <Row title="Create Contact Poster" icon={<Contact size={20} className="accent" />} onClick={() => setPoster(g.id)} />
        <Row title="Delete" icon={<Trash2 size={20} color="var(--red)" />} destructive onClick={del} />
      </List>
      <PosterSheet genId={poster} onClose={() => setPoster(null)} />
    </Page>
  )
}

const GM_SUGGEST = ['robot drummer', 'Biscuit with sunglasses', 'rainy Seattle cloud', 'dragon eating cake', 'cat astronaut', 'party snare drum']

function GenmojiSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<{ prompt: string; seeds: number[] } | null>(null)
  const [busy, setBusy] = useState(false)
  const make = (p: string) => {
    const t = p.trim()
    if (!t || busy) return
    if (!consumeGeneration()) return showAlert({ title: 'Daily Limit Reached', actions: [{ label: 'OK' }] })
    setBusy(true)
    setQ(t)
    window.setTimeout(() => {
      const r = Math.floor(Math.random() * 1000)
      setResults({ prompt: t, seeds: [r, r + 1, r + 2] })
      setBusy(false)
    }, 1100)
  }
  const add = (seed: number) => {
    if (!results) return
    const pg = usePG.getState()
    pg.set({ genmoji: [{ id: uid('gm'), prompt: results.prompt, seed }, ...pg.genmoji].slice(0, 24) })
    useOS.getState().showToast('Added to Stickers')
    onClose()
  }
  return (
    <Sheet open={open} onClose={onClose} title="New Genmoji" detent="large">
      <div className="pg-gm">
        <div className="pg-gm-stage">
          {busy ? <div className="pg-creating-blob small" /> : results ? (
            <div className="pg-gm-results">
              {results.seeds.map((s) => <button key={s} className="pressable" onClick={() => add(s)} aria-label="Add Genmoji"><GenmojiArt prompt={results.prompt} seed={s} size={84} /></button>)}
            </div>
          ) : <div className="t-subhead secondary center">Describe an emoji and tap one to add it to your stickers.</div>}
        </div>
        <div className="pg-gm-field">
          <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && make(q)} placeholder="Describe an emoji" aria-label="Describe an emoji" enterKeyHint="go" />
          <button className="pg-go" disabled={!q.trim() || busy} onClick={() => make(q)} aria-label="Create Genmoji"><Plus size={18} strokeWidth={3} /></button>
        </div>
        <div className="pg-gm-sugg">{GM_SUGGEST.map((s) => <button key={s} onClick={() => make(s)}>{s}</button>)}</div>
      </div>
    </Sheet>
  )
}
