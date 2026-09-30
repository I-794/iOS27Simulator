import { useEffect, useRef, useState } from 'react'
import { Flashlight, FlashlightOff, Snowflake, SlidersHorizontal, DoorOpen, Users, ScanText, MessageCircle, Mic, Send, X, Settings, Sparkles, Volume2, Contrast, Sun } from 'lucide-react'
import { Scene } from '../../art/Scene'
import { Slider, AISparkle } from '../../ui/controls'
import { Sheet } from '../../ui/overlay'
import { useOS } from '../../os/store'
import { useAppRoute, useOnscreen } from '../../os/hooks'
import { useShell } from '../../shell/shellState'
import { answerAbout, insightFor } from '../../os/ai/vision'
import './magnifier.css'

const SCENES = [
  { scene: 'handwritten', label: 'Note' },
  { scene: 'receipt', label: 'Receipt' },
  { scene: 'porch-person', label: 'Front Door' },
  { scene: 'family-dinner', label: 'People' },
  { scene: 'product-headphones', label: 'Box' },
]
const FILTERS = [
  { id: 'none', label: 'None', css: '' },
  { id: 'invert', label: 'Inverted', css: 'invert(1) hue-rotate(180deg)' },
  { id: 'gray', label: 'Grayscale', css: 'grayscale(1)' },
  { id: 'gray-inv', label: 'Gray Inverted', css: 'grayscale(1) invert(1)' },
  { id: 'yb', label: 'Yellow/Blue', css: 'grayscale(1) sepia(1) saturate(6) hue-rotate(10deg) contrast(1.4)' },
  { id: 'hc', label: 'High Contrast', css: 'contrast(2.2) saturate(0.4)' },
] as const
type Mode = 'none' | 'door' | 'people' | 'text'

interface Msg { role: 'user' | 'assistant'; text: string }

/** Text line boxes in the scene's own coordinates (300×400 portrait scenes). */
function textRegions(scene: string): { x: number; y: number; w: number; h: number; text: string; rot: number }[] {
  const lines = (insightFor(scene).text ?? '').split('\n').filter(Boolean)
  if (scene === 'handwritten') {
    const ys = [76, 120, 142, 164, 186, 230, 274]
    return lines.map((t, i) => ({ x: i === 0 || i >= 5 ? 68 : 76, y: (ys[i] ?? 300) - 18, w: Math.min(190, t.length * 9 + 14), h: 24, text: t, rot: -4 }))
  }
  if (scene === 'receipt') {
    const ys = [48, 110, 128, 146, 164, 182, 218, 236, 254, 282]
    return lines.map((t, i) => ({ x: 58, y: (ys[i] ?? 300) - 13, w: 184, h: 17, text: t, rot: 2 }))
  }
  return []
}

export default function MagnifierApp() {
  const [scene, setScene] = useState('handwritten')
  const [zoom, setZoom] = useState(1.25)
  const flash = useOS((s) => s.flashlight)
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['id']>('none')
  const [bright, setBright] = useState(0.5)
  const [contrast, setContrast] = useState(0.5)
  const [frozen, setFrozen] = useState(false)
  const [mode, setMode] = useState<Mode>('none')
  const [panel, setPanel] = useState<'zoom' | 'filters' | 'adjust'>('zoom')
  const [chat, setChat] = useState(false)
  const [msgs, setMsgs] = useState<Msg[]>([{ role: 'assistant', text: 'Hi! Point your camera at something and ask me about it — or tell me what to do, like “zoom in” or “turn on the flashlight”.' }])
  const [q, setQ] = useState('')
  const [thinking, setThinking] = useState(false)
  const [spoken, setSpoken] = useState<number | null>(null)
  const [settings, setSettings] = useState(false)
  const [speakOn, setSpeakOn] = useState(true)
  const [drift, setDrift] = useState(0)
  const list = useRef<HTMLDivElement>(null)
  const active = useOS((s) => s.openApp === 'magnifier')

  useEffect(() => {
    if (!active) return
    useShell.getState().set({ statusOverride: 'light' })
    return () => useShell.getState().set({ statusOverride: null })
  }, [active])
  useEffect(() => { if (!active && flash) useOS.getState().set({ flashlight: false }) }, [active, flash])
  // hand-shake / live camera drift (stops when frozen)
  useEffect(() => {
    if (frozen) return
    let raf = 0
    let last = 0
    const loop = (t: number) => { if (t - last > 60) { last = t; setDrift(t / 1000) } raf = requestAnimationFrame(loop) }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [frozen])
  useEffect(() => { list.current?.scrollTo({ top: 99999, behavior: 'smooth' }) }, [msgs, thinking])
  useAppRoute('magnifier', (r) => {
    if (r.startsWith('ask/')) { setChat(true); ask(decodeURIComponent(r.slice(4))) }
    else if (r === 'text' || r === 'door' || r === 'people') setMode(r)
  })
  useOnscreen('magnifier', 'Magnifier camera', { type: 'camera', scene })

  const speak = (text: string) => {
    if (!speakOn) return
    try {
      const synth = window.speechSynthesis
      if (synth && typeof SpeechSynthesisUtterance !== 'undefined') {
        synth.cancel()
        const u = new SpeechSynthesisUtterance(text.replace(/[•\n]+/g, '. '))
        u.volume = useOS.getState().volume
        synth.speak(u)
      }
    } catch { /* speech not available */ }
  }

  const reply = (text: string) => {
    setMsgs((m) => [...m, { role: 'assistant', text }])
    speak(text)
  }

  /** Conversational controls: commands change the camera; questions go to the vision model. */
  function ask(raw: string) {
    const text = raw.trim()
    if (!text) return
    setMsgs((m) => [...m, { role: 'user', text }])
    setQ('')
    const l = text.toLowerCase()
    const zoomTo = /zoom (?:to |in to )?(\d+(?:\.\d+)?)\s*x?/.exec(l)
    const act = (fn: () => void, msg: string) => { fn(); window.setTimeout(() => reply(msg), 250) }
    if (zoomTo) return act(() => setZoom(Math.min(10, Math.max(1, +zoomTo[1]))), `Zoomed to ${Math.min(10, Math.max(1, +zoomTo[1]))}×.`)
    if (/zoom in|closer|bigger|magnify more/.test(l)) return act(() => setZoom((z) => Math.min(10, +(z * 1.5).toFixed(1))), 'Zooming in.')
    if (/zoom out|further|smaller/.test(l)) return act(() => setZoom((z) => Math.max(1, +(z / 1.5).toFixed(1))), 'Zooming out.')
    if (/(turn on|enable).*(flash|light|torch)|too dark|brighter/.test(l)) return act(() => useOS.getState().set({ flashlight: true }), 'Flashlight is on.')
    if (/(turn off|disable).*(flash|light|torch)/.test(l)) return act(() => useOS.getState().set({ flashlight: false }), 'Flashlight is off.')
    if (/invert/.test(l)) return act(() => setFilter('invert'), 'Colors inverted.')
    if (/contrast/.test(l)) return act(() => setFilter('hc'), 'High contrast filter on.')
    if (/(no|remove|clear) filter|normal colou?r/.test(l)) return act(() => setFilter('none'), 'Filters removed.')
    if (/freeze|hold still|pause/.test(l)) return act(() => setFrozen(true), 'Frame frozen. Say “unfreeze” to go back to live view.')
    if (/unfreeze|live/.test(l)) return act(() => setFrozen(false), 'Back to live view.')
    if (/door/.test(l) && /find|detect|where/.test(l)) return act(() => setMode('door'), 'Door detection is on.')
    if (/people|person/.test(l) && /find|detect|anyone|who/.test(l)) return act(() => setMode('people'), 'People detection is on.')
    setThinking(true)
    window.setTimeout(() => {
      setThinking(false)
      const ins = insightFor(scene)
      let ans: string
      if (/read|say|text|written|sign/.test(l) && ins.text) {
        ans = `It says: ${ins.text.replace(/\n/g, ' · ')}`
        setMode('text')
        setSpoken(0)
      } else ans = answerAbout(scene, text)
      reply(ans)
    }, 650)
  }

  // Point and Speak line-by-line highlight in text mode
  const regions = mode === 'text' ? textRegions(scene) : []
  useEffect(() => {
    if (spoken === null) return
    if (spoken >= regions.length) { const t = window.setTimeout(() => setSpoken(null), 800); return () => window.clearTimeout(t) }
    const t = window.setTimeout(() => setSpoken((s) => (s === null ? null : s + 1)), 900)
    return () => window.clearTimeout(t)
  }, [spoken, regions.length])

  const f = FILTERS.find((x) => x.id === filter)!
  const cssFilter = `${f.css} brightness(${0.6 + bright * 0.8 + (flash ? 0.35 : 0)}) contrast(${0.6 + contrast * 0.8})`
  const jx = frozen ? 0 : Math.sin(drift * 1.3) * 0.6
  const jy = frozen ? 0 : Math.cos(drift * 1.7) * 0.5
  const peopleScene = ['porch-person', 'family-dinner', 'selfie-group'].includes(scene)
  const doorScene = ['porch-person', 'porch-package'].includes(scene)

  return (
    <div className="app-root mg-root">
      <div className="mg-view">
        <div className="mg-scene" style={{ transform: `scale(${zoom}) translate(${jx}%, ${jy}%)`, filter: cssFilter }}>
          <Scene scene={scene} />
          {regions.length > 0 && (
            <svg className="mg-text-layer" viewBox="0 0 300 400" preserveAspectRatio="xMidYMid slice" aria-hidden>
              {regions.map((r, i) => (
                <rect key={i} className={`mg-text-box ${spoken === i ? 'speaking' : ''}`} x={r.x} y={r.y} width={r.w} height={r.h} rx="4" transform={`rotate(${r.rot} 150 200)`} />
              ))}
            </svg>
          )}
        </div>
        {flash && <div className="mg-flash" />}
        {frozen && <div className="mg-frozen"><Snowflake size={14} /> Frozen</div>}
        {mode === 'door' && (
          <div className="mg-detect door anim-pop">
            {doorScene ? <><b>Door · 4 ft ahead</b><span>Handle on the right · Push to open · Sign: none</span></> : <><b>No door detected</b><span>Move iPhone slowly to find a door</span></>}
          </div>
        )}
        {mode === 'people' && (
          <div className="mg-detect people anim-pop">
            {peopleScene ? <><b>{scene === 'family-dinner' ? '4 people · nearest 3 ft' : '1 person · 6 ft away'}</b><span>{scene === 'family-dinner' ? 'Seated at a table' : 'Standing at the door, holding a case'}</span></> : <><b>No people detected</b><span>Sound and haptic feedback will play when someone is nearby</span></>}
          </div>
        )}
        {mode === 'people' && peopleScene && <div className="mg-person-box" />}
        {mode === 'door' && doorScene && <div className="mg-door-box" />}
        {mode === 'text' && !regions.length && <div className="mg-detect anim-pop"><b>No text found</b><span>Point at a sign, label or page</span></div>}
        {mode === 'text' && regions.length > 0 && spoken !== null && <div className="mg-detect text anim-pop"><Volume2 size={14} /> <span>{regions[Math.min(spoken, regions.length - 1)]?.text}</span></div>}
      </div>

      <div className="mg-top">
        <button className="mg-round" aria-label="Settings" onClick={() => setSettings(true)}><Settings size={20} /></button>
        <div className="mg-scenes">
          {SCENES.map((s) => <button key={s.scene} className={scene === s.scene ? 'on' : ''} onClick={() => { setScene(s.scene); setFrozen(false); setSpoken(null) }}>{s.label}</button>)}
        </div>
      </div>

      <div className="mg-bottom">
        <div className="mg-modes">
          {([['door', <DoorOpen size={18} />, 'Door'], ['people', <Users size={18} />, 'People'], ['text', <ScanText size={18} />, 'Text']] as const).map(([m, ic, l]) => (
            <button key={m} className={mode === m ? 'on' : ''} onClick={() => { setMode(mode === m ? 'none' : m); if (m === 'text' && mode !== 'text') setSpoken(0) }} aria-pressed={mode === m}>{ic}<span>{l}</span></button>
          ))}
          <button className={chat ? 'on ai' : 'ai'} onClick={() => setChat(!chat)} aria-pressed={chat}><Sparkles size={18} /><span>Ask</span></button>
        </div>
        <div className="mg-panel glass dark-glass">
          {panel === 'zoom' && (
            <div className="mg-row">
              <span className="mg-zoom-val">{zoom.toFixed(1)}×</span>
              <Slider value={zoom} min={1} max={10} step={0.1} onChange={setZoom} label="Zoom" color="#ffd60a" />
            </div>
          )}
          {panel === 'filters' && (
            <div className="mg-filters">
              {FILTERS.map((x) => <button key={x.id} className={filter === x.id ? 'on' : ''} onClick={() => setFilter(x.id)}><span className="mg-swatch" style={{ filter: x.css }} />{x.label}</button>)}
            </div>
          )}
          {panel === 'adjust' && (
            <div className="mg-adjust">
              <div className="mg-row"><Sun size={16} /><Slider value={bright} onChange={setBright} label="Brightness" color="#ffd60a" /></div>
              <div className="mg-row"><Contrast size={16} /><Slider value={contrast} onChange={setContrast} label="Contrast" color="#ffd60a" /></div>
            </div>
          )}
          <div className="mg-ctl">
            <button className={panel === 'zoom' ? 'on' : ''} onClick={() => setPanel('zoom')} aria-label="Zoom controls">{zoom.toFixed(0)}×</button>
            <button className={flash ? 'on' : ''} onClick={() => useOS.getState().set({ flashlight: !flash })} aria-label={flash ? 'Turn flashlight off' : 'Turn flashlight on'}>{flash ? <Flashlight size={20} /> : <FlashlightOff size={20} />}</button>
            <button className="mg-shutter" onClick={() => setFrozen(!frozen)} aria-label={frozen ? 'Unfreeze' : 'Freeze frame'}><span /></button>
            <button className={panel === 'filters' ? 'on' : ''} onClick={() => setPanel(panel === 'filters' ? 'zoom' : 'filters')} aria-label="Filters"><Contrast size={20} /></button>
            <button className={panel === 'adjust' ? 'on' : ''} onClick={() => setPanel(panel === 'adjust' ? 'zoom' : 'adjust')} aria-label="Brightness and contrast"><SlidersHorizontal size={20} /></button>
          </div>
        </div>
      </div>

      {chat && (
        <div className="mg-chat anim-up" role="dialog" aria-label="Magnifier assistant">
          <div className="mg-chat-h"><AISparkle size={16} /> <b>Ask Magnifier</b><button onClick={() => setChat(false)} aria-label="Close assistant"><X size={16} /></button></div>
          <div className="mg-chat-list scroll" ref={list}>
            {msgs.map((m, i) => <div key={i} className={`mg-msg ${m.role}`}>{m.text}</div>)}
            {thinking && <div className="mg-msg assistant thinking"><i /><i /><i /></div>}
          </div>
          <div className="mg-sugg scroll-x">
            {['Read this sign', 'What does this say?', 'Zoom in', 'Turn on the flashlight', 'Invert colors', 'Is anyone at the door?'].map((s) => <button key={s} onClick={() => ask(s)}>{s}</button>)}
          </div>
          <form className="mg-input" onSubmit={(e) => { e.preventDefault(); ask(q) }}>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ask or give a command…" aria-label="Ask Magnifier" enterKeyHint="send" data-dictation="read this sign|what does this say|zoom in" />
            {q ? <button type="submit" aria-label="Send"><Send size={18} /></button> : <button type="button" aria-label="Dictate" onClick={() => ask('What does this say?')}><Mic size={18} /></button>}
          </form>
        </div>
      )}

      <Sheet open={settings} onClose={() => setSettings(false)} title="Magnifier Settings" detent="medium">
        <div className="mg-settings">
          <label><span>Speak answers aloud</span><input type="checkbox" checked={speakOn} onChange={(e) => setSpeakOn(e.target.checked)} /></label>
          <p>iOS 27 Magnifier can describe what the camera sees, read text aloud with Point and Speak, and respond to spoken commands like “zoom in”. Detection runs on-device.</p>
          <button className="mg-btn" onClick={() => { setZoom(1.25); setFilter('none'); setBright(0.5); setContrast(0.5); setMode('none'); setSettings(false) }}><MessageCircle size={16} /> Reset Controls</button>
        </div>
      </Sheet>
    </div>
  )
}
