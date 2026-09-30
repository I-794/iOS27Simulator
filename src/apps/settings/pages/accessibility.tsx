import { useEffect, useRef, useState } from 'react'
import {
  PersonStanding, ZoomIn, Type, Sparkles, BookOpen, Mic, Grid3x3, LayoutGrid, Lock, Hand, Ear, Captions, Volume2, AudioLines, MessageSquareText, ScanEye,
  Send, Camera, Paperclip, Smile, Check, Play, Square, Languages, ChevronRight, Timer, Contrast, Droplets, Wind, Waves, Bell, Search as SearchIcon,
} from 'lucide-react'
import { List, Row } from '../../../ui/list'
import { Slider, Button, Segmented, Chip, Spinner, AISparkle } from '../../../ui/controls'
import { Sheet } from '../../../ui/overlay'
import { useOS } from '../../../os/store'
import { Scene } from '../../../art/Scene'
import { AppIconArt, ICONS } from '../../../icons/AppIconArt'
import { insightFor, answerAbout } from '../../../os/ai/vision'
import type { AppId } from '../../../os/types'
import { ROUTES, HeroPage, Sub, Ico, Go, Push, ChoicePage, usePrefs, usePref, New27, os, setA11y, setAirpods, setPrefIn } from '../common'

/** Speak with the Web Speech API when available; always returns quickly and never throws. */
export function speak(text: string, opts: { rate?: number; pitch?: number; onEnd?: () => void } = {}): boolean {
  try {
    const synth = window.speechSynthesis
    if (!synth || typeof SpeechSynthesisUtterance === 'undefined') return false
    synth.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.rate = opts.rate ?? 1
    u.pitch = opts.pitch ?? 1
    u.onend = () => opts.onEnd?.()
    u.onerror = () => opts.onEnd?.()
    synth.speak(u)
    return true
  } catch {
    return false
  }
}
export function stopSpeaking() {
  try {
    window.speechSynthesis?.cancel()
  } catch {
    /* ignore */
  }
}

function AccessibilityPage() {
  const a = useOS((s) => s.accessibility)
  const boldText = useOS((s) => s.boldText)
  return (
    <HeroPage title="Accessibility" icon={<Ico c="#0a84ff" i={PersonStanding} size={60} />} blurb="Personalize iPhone in ways that work best for you with accessibility features for vision, mobility, hearing, speech, and cognition.">
      <List header="Vision">
        <Go icon={<Ico c="#1c1c1e" i={AudioLines} />} to="accessibility/voiceover" title="VoiceOver" detail={a.voiceOver ? 'On' : 'Off'} />
        <Go icon={<Ico c="#1c1c1e" i={ZoomIn} />} to="accessibility/zoom" title="Zoom" detail={a.zoom ? 'On' : 'Off'} />
        <Go icon={<Ico c="#007aff" i={Type} />} to="accessibility/display" title="Display & Text Size" detail={boldText ? 'Bold' : undefined} />
        <Go icon={<Ico c="#34c759" i={Wind} />} to="accessibility/motion" title="Motion" />
        <Go icon={<Ico c="#1c1c1e" i={BookOpen} />} to="accessibility/reader" title={<span className="row gap6">Accessibility Reader <New27 /></span>} />
        <Row icon={<Ico c="#1c1c1e" i={SearchIcon} />} title="Magnifier" chevron onClick={() => os().launch('magnifier')} />
        <Row icon={<Ico c="#8e8e93" i={MessageSquareText} />} title="Spoken Content" detail={a.speakScreen ? 'Speak Screen' : 'Off'} onClick={() => setA11y({ speakScreen: !a.speakScreen })} />
      </List>
      <List header="Physical and Motor">
        <Go icon={<Ico c="#007aff" i={Hand} />} to="accessibility/touch" title="Touch" detail={a.touchAccommodations ? 'Accommodations On' : undefined} />
        <Go icon={<Ico c="#007aff" i={Mic} />} to="accessibility/voicecontrol" title="Voice Control" detail={a.voiceControl ? 'On' : 'Off'} />
        <Go icon={<Ico c="#3478f6" i={Hand} fill />} to="action-button" title="Action Button" />
      </List>
      <List header="Hearing">
        <Go icon={<Ico c="#007aff" i={Ear} />} to="accessibility/hearing" title="Hearing Devices" detail={a.hearingDevice ? 'Connected' : undefined} />
        <Row icon={<Ico c="#ff3b30" i={Bell} />} title="Sound Recognition" toggle={{ value: a.soundRecognition, onChange: (v) => setA11y({ soundRecognition: v }) }} />
        <Row icon={<Ico c="#30b0c7" i={Waves} />} title="Background Sounds" toggle={{ value: a.backgroundSounds, onChange: (v) => setA11y({ backgroundSounds: v }) }} />
        <Go icon={<Ico c="#007aff" i={Captions} />} to="accessibility/captions" title="Subtitles & Captioning" />
        <Row icon={<Ico c="#1c1c1e" i={MessageSquareText} />} title="Live Captions" toggle={{ value: a.liveCaptions, onChange: (v) => setA11y({ liveCaptions: v }) }} />
      </List>
      <List header="General">
        <Go icon={<Ico c="#1c1c1e" i={Lock} />} to="accessibility/guided" title="Guided Access" detail={a.guidedAccess ? 'On' : 'Off'} />
        <Go icon={<Ico c="#1c1c1e" i={LayoutGrid} />} to="accessibility/assistive" title="Assistive Access" detail={a.assistiveAccess ? 'On' : undefined} />
      </List>
    </HeroPage>
  )
}

// ------------------------------------------------------------------ VoiceOver
const VO_SAMPLES = [
  { scene: 'dog-beach', label: 'Photo', suggestions: ['What breed is the dog?', 'Where was this taken?', 'Describe this'] },
  { scene: 'screenshot-chart', label: 'Chart', suggestions: ['What’s the trend?', 'Describe this', 'Read the text'] },
  { scene: 'receipt', label: 'Receipt', suggestions: ['How much was the tip?', 'What’s the total?', 'How much does each person owe?'] },
] as const

function VoiceOverPage() {
  const vo = useOS((s) => s.accessibility.voiceOver)
  const [rate, setRate] = useState(0.5)
  const [sample, setSample] = useState<(typeof VO_SAMPLES)[number]['label']>('Photo')
  const [q, setQ] = useState('')
  const [chat, setChat] = useState<{ q: string; a: string }[]>([])
  const [thinking, setThinking] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const [rich, setRich] = useState(true)
  const s = VO_SAMPLES.find((x) => x.label === sample)!
  const ins = insightFor(s.scene)
  useEffect(() => {
    setChat([])
    stopSpeaking()
    setSpeaking(false)
  }, [sample])
  useEffect(() => () => stopSpeaking(), [])
  const description = rich ? `${ins.label}. ${ins.summary} ${ins.details.map((d) => `${d.label}: ${d.value}.`).join(' ')}` : `Image. ${ins.label}.`
  const ask = (question: string) => {
    if (!question.trim()) return
    setThinking(true)
    setQ('')
    window.setTimeout(() => {
      const ans = answerAbout(s.scene, question)
      setChat((c) => [...c, { q: question, a: ans }])
      setThinking(false)
      if (vo) speak(ans, { rate: 0.6 + rate })
    }, 700)
  }
  return (
    <HeroPage title="VoiceOver" icon={<Ico c="#1c1c1e" i={AudioLines} size={60} />} blurb="VoiceOver is a gesture-based screen reader that lets you use iPhone even if you can’t see the screen.">
      <List footer="Triple-click the side button (or press ⌥V) to toggle VoiceOver anywhere in the simulator.">
        <Row title="VoiceOver" toggle={{ value: vo, onChange: (v) => { setA11y({ voiceOver: v }); if (v) speak('VoiceOver on', { rate: 1 }) } }} />
      </List>
      <List header="Speaking Rate">
        <div className="stg-pad"><Slider value={rate} onChange={setRate} label="Speaking rate" left={<span className="stg-turtle">🐢</span>} right={<span className="stg-turtle">🐇</span>} /></div>
      </List>
      <List header={<span className="row gap6">Image Descriptions <New27 /></span>} footer="VoiceOver now describes photos, charts and documents in detail — and you can ask follow-up questions about what’s in them.">
        <Row title="Richer Image Descriptions" toggle={{ value: rich, onChange: setRich }} />
        <div className="stg-pad"><Segmented options={VO_SAMPLES.map((x) => x.label)} value={sample} onChange={setSample} /></div>
        <div className="stg-vo-demo">
          <div className={`stg-vo-img ${vo ? 'focused' : ''}`}>
            <Scene scene={s.scene} style={{ width: '100%', height: '100%' }} />
          </div>
          <div className="stg-vo-caption">
            <div className="row gap6 t-footnote secondary"><AudioLines size={14} /> VoiceOver says</div>
            <div className="t-subhead">{description}</div>
            <Button
              variant="tinted"
              size="small"
              onClick={() => {
                if (speaking) {
                  stopSpeaking()
                  setSpeaking(false)
                  return
                }
                setSpeaking(true)
                const ok = speak(description, { rate: 0.6 + rate, onEnd: () => setSpeaking(false) })
                if (!ok) window.setTimeout(() => setSpeaking(false), 2400)
              }}
            >
              {speaking ? <><Square size={12} fill="currentColor" /> Stop</> : <><Play size={12} fill="currentColor" /> Speak</>}
            </Button>
          </div>
        </div>
      </List>
      <List header={<span className="row gap6">Ask About This Image <New27 /></span>}>
        <div className="stg-vo-chat">
          {chat.map((c, i) => (
            <div key={i} className="anim-up">
              <div className="stg-bubble me">{c.q}</div>
              <div className="stg-bubble ai"><AISparkle size={14} /> {c.a}</div>
            </div>
          ))}
          {thinking && <div className="stg-bubble ai"><Spinner size={14} /> Looking…</div>}
          <div className="row gap6 stg-chips">
            {s.suggestions.map((x) => <Chip key={x} onClick={() => ask(x)}>{x}</Chip>)}
          </div>
          <div className="stg-ask">
            <input className="text-input" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && ask(q)} placeholder="Ask about this image" aria-label="Ask about this image" enterKeyHint="send" />
            <button className="stg-send" aria-label="Ask" onClick={() => ask(q)} disabled={!q.trim()}><Send size={16} /></button>
          </div>
        </div>
      </List>
    </HeroPage>
  )
}

// ------------------------------------------------------------------ Zoom
function ZoomPage() {
  const zoom = useOS((s) => s.accessibility.zoom)
  const region = usePrefs((s) => s.zoomRegion)
  const level = usePrefs((s) => s.zoomLevel)
  const [pos, setPos] = useState({ x: 50, y: 50 })
  const box = useRef<HTMLDivElement>(null)
  return (
    <HeroPage title="Zoom" icon={<Ico c="#1c1c1e" i={ZoomIn} size={60} />} blurb="Zoom magnifies the entire screen. Double-tap three fingers to zoom, drag three fingers to move around.">
      <List>
        <Row title="Zoom" toggle={{ value: zoom, onChange: (v) => setA11y({ zoom: v }) }} />
        <Push title="Zoom Region" detail={region} page={() => <ChoicePage title="Zoom Region" options={['Full Screen Zoom', 'Window Zoom'] as const} use={() => usePref('zoomRegion')} />} />
      </List>
      <List header="Maximum Zoom Level" footer="Drag in the preview to move the zoom window.">
        <div className="stg-pad"><Slider value={level} min={1.2} max={8} onChange={(v) => usePrefs.getState().setP({ zoomLevel: v })} label="Maximum zoom level" right={<span className="t-footnote">{level.toFixed(1)}×</span>} /></div>
        <div
          className="stg-zoom-demo"
          ref={box}
          onPointerMove={(e) => {
            if (e.buttons !== 1 && e.pointerType === 'mouse') return
            const r = box.current!.getBoundingClientRect()
            setPos({ x: Math.max(0, Math.min(100, ((e.clientX - r.left) / r.width) * 100)), y: Math.max(0, Math.min(100, ((e.clientY - r.top) / r.height) * 100)) })
          }}
        >
          <Scene scene="mountain-lake" style={{ width: '100%', height: '100%' }} />
          {zoom && (
            <div className={`stg-zoom-lens ${region === 'Window Zoom' ? 'window' : 'full'}`} style={region === 'Window Zoom' ? { left: `${pos.x}%`, top: `${pos.y}%` } : undefined}>
              <div style={{ width: '100%', height: '100%', transform: `scale(${level})`, transformOrigin: `${pos.x}% ${pos.y}%` }}>
                <Scene scene="mountain-lake" style={{ width: region === 'Window Zoom' ? 360 : '100%', height: region === 'Window Zoom' ? 200 : '100%' }} />
              </div>
            </div>
          )}
          {!zoom && <div className="stg-zoom-off">Turn on Zoom to preview</div>}
        </div>
      </List>
    </HeroPage>
  )
}

// ------------------------------------------------------------------ Display & Text Size
function DisplayTextPage() {
  const st = useOS()
  return (
    <Sub title="Display & Text Size">
      <List>
        <Row title="Bold Text" toggle={{ value: st.boldText, onChange: (v) => st.set({ boldText: v }) }} />
        <Push title="Larger Text" detail={`${Math.round(st.textScale * 100)}%`} page={() => <LargerText />} />
      </List>
      <List footer="Increase Contrast raises the opacity of Liquid Glass and deepens separators and secondary text across the system.">
        <Row icon={<Ico c="#1c1c1e" i={Contrast} />} title="Increase Contrast" toggle={{ value: st.increaseContrast, onChange: (v) => st.set({ increaseContrast: v }) }} />
        <Row icon={<Ico c="#007aff" i={Droplets} />} title="Reduce Transparency" toggle={{ value: st.reduceTransparency, onChange: (v) => st.set({ reduceTransparency: v }) }} />
        <Row icon={<Ico c="#34c759" i={Wind} />} title="Reduce Motion" toggle={{ value: st.reduceMotion, onChange: (v) => st.set({ reduceMotion: v }) }} />
      </List>
      <div className="stg-a11y-preview">
        <div className="glass stg-a11y-glass">
          <div className="t-headline">Preview</div>
          <div className="t-subhead secondary">Liquid Glass, text weight and size update everywhere instantly.</div>
        </div>
      </div>
      <List>
        <Go to="display/glass" title="Liquid Glass" />
      </List>
    </Sub>
  )
}

function LargerText() {
  const scale = useOS((s) => s.textScale)
  const bold = useOS((s) => s.boldText)
  return (
    <Sub title="Larger Text">
      <div className="stg-textsize-preview" style={{ fontSize: `${17 * scale}px`, fontWeight: bold ? 600 : 400 }}>
        Apps that support Dynamic Type will adjust to your preferred reading size below.
      </div>
      <List footer="Changes apply across the simulator immediately.">
        <div className="stg-pad">
          <Slider value={scale} min={0.82} max={1.4} step={0.06} onChange={(v) => os().set({ textScale: v })} label="Text size" left={<span style={{ fontSize: 13 }}>A</span>} right={<span style={{ fontSize: 22 }}>A</span>} />
        </div>
        <Row title="Reset to Default" tint onClick={() => os().set({ textScale: 1 })} />
      </List>
    </Sub>
  )
}

function MotionPage() {
  const st = useOS()
  const [autoplay, setAutoplay] = useState(true)
  return (
    <Sub title="Motion">
      <List footer="Reduce the motion of the user interface, including the parallax effect of icons and spring animations.">
        <Row title="Reduce Motion" toggle={{ value: st.reduceMotion, onChange: (v) => st.set({ reduceMotion: v }) }} />
        <Row title="Auto-Play Animated Images" toggle={{ value: autoplay, onChange: setAutoplay }} />
      </List>
      <div className="stg-motion-demo"><span className="stg-motion-ball" /></div>
    </Sub>
  )
}

// ------------------------------------------------------------------ Accessibility Reader (iOS 27)
const MESSY = `ACCEPT ALL COOKIES?? [Accept] [Manage]
SPONSORED — Try NitroSnacks™ today!!!
Swerve   Module Tuning:  a   beginners guide
posted by jamie_builds · 3,241 views · Share Share Share
swerve drive lets your robot move in any direction.first,zero each module so the wheels point forward.then tune the P gain untill the wheel snaps to angle without oscillating
[IMG_4471.jpg]
| Gain | Value |
|P|0.35|
|I|0.0|
|D|0.002|
Subscribe to our newsletter!! >>> CLICK HERE <<<`

const READER_OUT = {
  title: 'Swerve Module Tuning: A Beginner’s Guide',
  byline: 'By jamie_builds',
  paras: ['Swerve drive lets your robot move in any direction.', 'First, zero each module so the wheels point forward. Then tune the P gain until the wheel snaps to its angle without oscillating.'],
  image: 'Image: A swerve module with a blue wheel mounted in an aluminum frame.',
  table: [['Gain', 'Value'], ['P', '0.35'], ['I', '0.0'], ['D', '0.002']],
  summary: 'Zero every swerve module first, then raise the P gain until wheels snap to angle without wobbling. Suggested gains: P 0.35, I 0, D 0.002.',
  es: { title: 'Ajuste de módulos swerve: guía para principiantes', paras: ['El sistema swerve permite que tu robot se mueva en cualquier dirección.', 'Primero, pon a cero cada módulo para que las ruedas apunten hacia adelante. Luego ajusta la ganancia P hasta que la rueda gire a su ángulo sin oscilar.'], summary: 'Pon a cero cada módulo y sube la ganancia P hasta que las ruedas se alineen sin vibrar.' },
  fr: { title: 'Réglage des modules swerve : guide du débutant', paras: 'Le swerve permet à votre robot de se déplacer dans toutes les directions.|Mettez d’abord chaque module à zéro, puis réglez le gain P jusqu’à ce que la roue s’aligne sans osciller.'.split('|'), summary: 'Mettez les modules à zéro, puis augmentez le gain P jusqu’à un alignement sans oscillation.' },
}

function ReaderPage() {
  const opts = usePrefs((s) => s.readerOptions)
  const font = useOS((s) => s.accessibility.readerFont)
  const [theme, setTheme] = useState<'Light' | 'Sepia' | 'Dark'>('Sepia')
  const [size, setSize] = useState(1)
  const [processing, setProcessing] = useState(false)
  const [reading, setReading] = useState(-1)
  const set = (p: Partial<typeof opts>) => {
    setProcessing(true)
    setPrefIn('readerOptions', p)
    window.setTimeout(() => setProcessing(false), 450)
  }
  useEffect(() => () => stopSpeaking(), [])
  const tr = opts.translate ? (opts.lang === 'French' ? READER_OUT.fr : READER_OUT.es) : null
  const title = tr?.title ?? READER_OUT.title
  const paras = tr?.paras ?? READER_OUT.paras
  const summary = tr?.summary ?? READER_OUT.summary
  const fontFamily = font === 'New York' ? "'New York', Georgia, serif" : font === 'Rounded' ? 'var(--font-rounded)' : font === 'Atkinson' ? 'Verdana, var(--font-text)' : 'var(--font-text)'
  const readAloud = () => {
    if (reading >= 0) {
      stopSpeaking()
      setReading(-1)
      return
    }
    let i = 0
    const next = () => {
      if (i >= paras.length) return setReading(-1)
      setReading(i)
      const ok = speak(paras[i], { rate: 1, onEnd: () => { i++; next() } })
      if (!ok) window.setTimeout(() => { i++; next() }, 2200)
    }
    next()
  }
  return (
    <HeroPage title="Accessibility Reader" icon={<Ico c="#1c1c1e" i={BookOpen} size={60} />} blurb={<>A system-wide reading mode that cleans up cluttered text, and reformats it with your preferred font, colors and spacing. <New27 /></>}>
      <List header="Original">
        <pre className="stg-reader-raw">{MESSY}</pre>
      </List>
      <List header={<span className="row gap6">Reader {processing && <Spinner size={12} />}</span>}>
        <div className={`stg-reader ${theme.toLowerCase()}`} style={{ fontFamily, fontSize: `${16 * size}px` }}>
          {opts.summary && (
            <div className="stg-reader-summary anim-fade"><AISparkle size={14} /> <b>Summary</b> — {summary}</div>
          )}
          {opts.format ? <h3>{title}</h3> : <div>{opts.cleanup ? title : 'Swerve   Module Tuning:  a   beginners guide'}</div>}
          {opts.format && <div className="stg-reader-by">{READER_OUT.byline}</div>}
          {opts.cleanup ? (
            paras.map((p, i) => <p key={i} className={reading === i ? 'reading' : ''}>{p}</p>)
          ) : (
            <p>ACCEPT ALL COOKIES?? SPONSORED — Try NitroSnacks™ today!!! swerve drive lets your robot move in any direction.first,zero each module so the wheels point forward.then tune the P gain untill the wheel snaps…</p>
          )}
          {opts.images ? (
            <>
              <div className="stg-reader-img"><ScanEye size={16} /> {READER_OUT.image}</div>
              <table className="stg-reader-table">
                <tbody>{READER_OUT.table.map((r, i) => <tr key={i}>{r.map((c, j) => (i === 0 ? <th key={j}>{c}</th> : <td key={j}>{c}</td>))}</tr>)}</tbody>
              </table>
            </>
          ) : (
            <p className="stg-reader-dim">[IMG_4471.jpg] |P|0.35| |I|0.0| |D|0.002|</p>
          )}
        </div>
        <div className="stg-pad row gap8">
          <Button variant="tinted" size="small" onClick={readAloud}>{reading >= 0 ? <><Square size={12} fill="currentColor" /> Stop</> : <><Volume2 size={14} /> Read Aloud</>}</Button>
          <div className="grow" />
          <Segmented options={['Light', 'Sepia', 'Dark'] as const} value={theme} onChange={setTheme} style={{ width: 190 }} />
        </div>
      </List>
      <List header="Reader Options">
        <Row icon={<Ico c="#34c759" i={Sparkles} />} title="Text Cleanup" subtitle="Remove ads, cookie banners and stray spacing" toggle={{ value: opts.cleanup, onChange: (v) => set({ cleanup: v }) }} />
        <Row icon={<Ico c="#007aff" i={Type} />} title="Formatting" subtitle="Headings, byline and paragraphs" toggle={{ value: opts.format, onChange: (v) => set({ format: v }) }} />
        <Row icon={<Ico c="#ff9500" i={Grid3x3} />} title="Images & Tables" subtitle="Describe images and rebuild tables" toggle={{ value: opts.images, onChange: (v) => set({ images: v }) }} />
        <Row icon={<span className="stg-ai-ico"><AISparkle size={18} color="#fff" /></span>} title="Summary" toggle={{ value: opts.summary, onChange: (v) => set({ summary: v }) }} />
        <Row icon={<Ico c="#5856d6" i={Languages} />} title="Translate" toggle={{ value: opts.translate, onChange: (v) => set({ translate: v }) }} />
        {opts.translate && <Push title="Translate To" detail={opts.lang} page={() => <ChoicePage title="Translate To" options={['Spanish', 'French'] as const} use={() => [usePrefs((s) => s.readerOptions.lang) as 'Spanish', (v) => setPrefIn('readerOptions', { lang: v })]} />} />}
      </List>
      <List header="Appearance">
        <Push title="Font" detail={font} page={() => <ChoicePage title="Font" options={['System', 'New York', 'Rounded', 'Atkinson'] as const} use={() => [useOS((s) => s.accessibility.readerFont) as 'System', (v) => setA11y({ readerFont: v })]} />} />
        <div className="stg-pad"><Slider value={size} min={0.85} max={1.5} onChange={setSize} label="Reader text size" left={<span style={{ fontSize: 12 }}>A</span>} right={<span style={{ fontSize: 20 }}>A</span>} /></div>
      </List>
    </HeroPage>
  )
}

// ------------------------------------------------------------------ Voice Control (flexible element naming)
const VC_ELEMENTS = [
  { id: 'camera', icon: Camera, def: 'Camera' },
  { id: 'attach', icon: Paperclip, def: 'Attach' },
  { id: 'emoji', icon: Smile, def: 'Emoji' },
  { id: 'send', icon: Send, def: 'Send' },
]
function VoiceControlPage() {
  const on = useOS((s) => s.accessibility.voiceControl)
  const names = usePrefs((s) => s.voiceControlNames)
  const [overlay, setOverlay] = useState<'None' | 'Numbers' | 'Names'>('Names')
  const [renaming, setRenaming] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [cmd, setCmd] = useState('')
  const [hit, setHit] = useState<string | null>(null)
  const [heard, setHeard] = useState('')
  const name = (id: string) => names[id] ?? VC_ELEMENTS.find((e) => e.id === id)!.def
  const run = (text: string) => {
    const t = text.toLowerCase().replace(/^(tap|press|click|open)\s+/, '').trim()
    setHeard(text)
    setCmd('')
    const idx = Number(t)
    const el = !Number.isNaN(idx) && idx > 0 ? VC_ELEMENTS[idx - 1] : VC_ELEMENTS.find((e) => name(e.id).toLowerCase() === t)
    if (/^show names/.test(t)) return setOverlay('Names')
    if (/^show numbers/.test(t)) return setOverlay('Numbers')
    if (/^hide (names|numbers)/.test(t)) return setOverlay('None')
    if (el) {
      setHit(el.id)
      window.setTimeout(() => setHit(null), 900)
    } else setHit('none')
  }
  return (
    <HeroPage title="Voice Control" icon={<Ico c="#007aff" i={Mic} size={60} />} blurb="Voice Control lets you control iPhone with your voice. Say “Show names” or “Show numbers”, then say the name or number to tap it.">
      <List>
        <Row title="Voice Control" toggle={{ value: on, onChange: (v) => setA11y({ voiceControl: v }) }} />
      </List>
      <List header={<span className="row gap6">Element Names <New27 /></span>} footer="Tap any element in the preview to give it a name that’s easier for you to say. Custom names work in every app.">
        <div className="stg-pad"><Segmented options={['None', 'Numbers', 'Names'] as const} value={overlay} onChange={setOverlay} labels={{ None: 'Overlay Off', Numbers: 'Show Numbers', Names: 'Show Names' }} /></div>
        <div className={`stg-vc-demo ${on ? '' : 'off'}`}>
          <div className="stg-vc-bubble">Are we still meeting at the library?</div>
          <div className="stg-vc-bar">
            {VC_ELEMENTS.slice(0, 3).map((e, i) => (
              <button key={e.id} className={`stg-vc-el ${hit === e.id ? 'hit' : ''}`} onClick={() => { setRenaming(e.id); setDraft(name(e.id)) }} aria-label={`Rename ${name(e.id)}`}>
                <e.icon size={18} />
                {overlay !== 'None' && <span className="stg-vc-tag">{overlay === 'Numbers' ? i + 1 : name(e.id)}</span>}
              </button>
            ))}
            <div className="stg-vc-field">iMessage</div>
            <button className={`stg-vc-el send ${hit === 'send' ? 'hit' : ''}`} onClick={() => { setRenaming('send'); setDraft(name('send')) }} aria-label={`Rename ${name('send')}`}>
              <Send size={16} />
              {overlay !== 'None' && <span className="stg-vc-tag">{overlay === 'Numbers' ? 4 : name('send')}</span>}
            </button>
          </div>
          {!on && <div className="stg-vc-offnote">Turn on Voice Control to use commands</div>}
        </div>
        <div className="stg-ask" style={{ margin: '0 14px 12px' }}>
          <Mic size={16} className="secondary" />
          <input className="text-input" value={cmd} onChange={(e) => setCmd(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && on && run(cmd)} placeholder={on ? `Say a command, e.g. “Tap ${name('send')}”` : 'Voice Control is off'} aria-label="Voice command" disabled={!on} data-dictation={`Tap ${name('send')}|Show numbers|Tap 2|Show names`} />
          <button className="stg-send" aria-label="Run command" onClick={() => on && run(cmd)} disabled={!on || !cmd.trim()}><ChevronRight size={16} /></button>
        </div>
        {heard && <div className="stg-vc-heard anim-fade">“{heard}” {hit === 'none' ? '— no matching element' : hit ? '✓' : ''}</div>}
      </List>
      {Object.keys(names).length > 0 && (
        <List header="Custom Names">
          {Object.entries(names).map(([id, n]) => (
            <Row key={id} title={n} detail={VC_ELEMENTS.find((e) => e.id === id)?.def} onClick={() => { const next = { ...names }; delete next[id]; usePrefs.getState().setP({ voiceControlNames: next }) }} trailing={<span className="stg-link">Reset</span>} />
          ))}
        </List>
      )}
      <Sheet open={!!renaming} onClose={() => setRenaming(null)} detent="auto" title="Rename Element" trailing={<button className="bar-btn prominent" onClick={() => { if (draft.trim() && renaming) usePrefs.getState().setP({ voiceControlNames: { ...names, [renaming]: draft.trim() } }); setRenaming(null) }}>Save</button>}>
        <List footer="Voice Control will respond to this name, like “Tap Photo Button”.">
          <Row title="Name" trailing={<input className="text-input stg-field" value={draft} onChange={(e) => setDraft(e.target.value)} aria-label="Element name" autoFocus />} />
        </List>
        <div style={{ height: 24 }} />
      </Sheet>
    </HeroPage>
  )
}

// ------------------------------------------------------------------ Assistive Access
const AA_APPS: AppId[] = ['phone', 'messages', 'camera', 'photos', 'music', 'facetime', 'maps', 'weather']
function AssistivePage() {
  const on = useOS((s) => s.accessibility.assistiveAccess)
  const [step, setStep] = useState(on ? 3 : 0)
  const [layout, setLayout] = useState<'Grid' | 'Rows'>('Grid')
  const [apps, setApps] = useState<AppId[]>(['phone', 'messages', 'camera', 'photos'])
  return (
    <Sub title="Assistive Access">
      <div className="stg-aa">
        <div className="stg-qs-steps">{['Layout', 'Apps', 'Review'].map((s, i) => <span key={s} className={i <= Math.min(step, 2) ? 'on' : ''} />)}</div>
        {step === 0 && (
          <div className="anim-up">
            <h2 className="stg-qs-title">Assistive Access</h2>
            <p className="secondary">A distinctive, streamlined experience with bigger buttons and fewer choices. iOS 27 sets it up in three quick steps — no Apple Account password needed.</p>
            <Button block onClick={() => setStep(1)}>Set Up Assistive Access</Button>
          </div>
        )}
        {step === 1 && (
          <div className="anim-up">
            <h2 className="stg-qs-title">Choose a Layout</h2>
            <div className="stg-aa-layouts">
              {(['Grid', 'Rows'] as const).map((l) => (
                <button key={l} className={`stg-aa-layout ${layout === l ? 'on' : ''}`} onClick={() => setLayout(l)}>
                  <div className={`stg-aa-mini ${l.toLowerCase()}`}>{AA_APPS.slice(0, 4).map((a) => <span key={a}><AppIconArt app={a} size={l === 'Grid' ? 34 : 22} />{l === 'Rows' && <em>{ICONS[a].name}</em>}</span>)}</div>
                  <span>{l}</span>
                </button>
              ))}
            </div>
            <Button block onClick={() => setStep(2)}>Continue</Button>
          </div>
        )}
        {step === 2 && (
          <div className="anim-up">
            <h2 className="stg-qs-title">Choose Apps</h2>
            <div className="stg-app-grid">
              {AA_APPS.map((a) => {
                const sel = apps.includes(a)
                return (
                  <button key={a} className={`stg-app-pick ${sel ? 'on' : ''}`} onClick={() => setApps(sel ? apps.filter((x) => x !== a) : [...apps, a])} aria-pressed={sel}>
                    <AppIconArt app={a} size={52} />
                    <span>{ICONS[a].name}</span>
                    <i className="stg-app-check">{sel && <Check size={12} strokeWidth={3.4} />}</i>
                  </button>
                )
              })}
            </div>
            <Button block onClick={() => setStep(3)} disabled={!apps.length}>Continue</Button>
          </div>
        )}
        {step === 3 && (
          <div className="anim-up">
            <h2 className="stg-qs-title">Ready</h2>
            <div className={`stg-aa-preview ${layout.toLowerCase()}`}>
              {apps.map((a) => <div key={a} className="stg-aa-tile"><AppIconArt app={a} size={layout === 'Grid' ? 58 : 34} /><span>{ICONS[a].name}</span></div>)}
            </div>
            <Button block onClick={() => { setA11y({ assistiveAccess: !on }); os().showToast(on ? 'Assistive Access ended' : 'Assistive Access configured') }}>{on ? 'Exit Assistive Access' : 'Start Assistive Access'}</Button>
            <Button block variant="plain" onClick={() => setStep(1)}>Edit Setup</Button>
          </div>
        )}
      </div>
    </Sub>
  )
}

// ------------------------------------------------------------------ Guided Access
function GuidedPage() {
  const on = useOS((s) => s.accessibility.guidedAccess)
  const timeout = usePrefs((s) => s.guidedTimeout)
  const [demo, setDemo] = useState<'idle' | 'old' | 'new'>('idle')
  const [t0, setT0] = useState(0)
  const run = (kind: 'old' | 'new') => {
    setDemo(kind)
    setT0(Date.now())
    window.setTimeout(() => setDemo('idle'), kind === 'old' ? 1600 : 700)
  }
  return (
    <HeroPage title="Guided Access" icon={<Ico c="#1c1c1e" i={Lock} size={60} />} blurb="Guided Access keeps iPhone in a single app and lets you control which features are available. Triple-click the side button in an app to start.">
      <List>
        <Row title="Guided Access" toggle={{ value: on, onChange: (v) => setA11y({ guidedAccess: v }) }} />
        <Row title="Passcode Settings" detail="Use Face ID" />
        <Row icon={<Ico c="#ff9500" i={Timer} />} title="Time Limits" toggle={{ value: timeout, onChange: (v) => usePrefs.getState().setP({ guidedTimeout: v }) }} />
      </List>
      <List header={<span className="row gap6">Faster Transitions <New27 /></span>} footer="Starting and ending a Guided Access session is now nearly instant, with a lighter animation that doesn’t lose your place.">
        <div className="stg-ga-demo">
          <div className={`stg-ga-screen ${demo}`} key={t0}>
            <div className="stg-ga-app"><BookOpen size={26} /><span>Reading app</span></div>
            {demo !== 'idle' && <div className="stg-ga-banner">Guided Access Started</div>}
          </div>
          <div className="row gap8">
            <Button size="small" variant="gray" onClick={() => run('old')}>iOS 26 Speed</Button>
            <Button size="small" onClick={() => run('new')}>iOS 27 Speed</Button>
          </div>
        </div>
      </List>
    </HeroPage>
  )
}

// ------------------------------------------------------------------ Touch Accommodations wizard
function TouchPage() {
  const a = useOS((s) => s.accessibility)
  const done = usePrefs((s) => s.touchWizardDone)
  const [step, setStep] = useState(done ? 3 : 0)
  const [ignore, setIgnore] = useState(true)
  const [tap, setTap] = useState<'Off' | 'Use Initial Touch Location' | 'Use Final Touch Location'>('Use Initial Touch Location')
  const [press, setPress] = useState(0)
  const [result, setResult] = useState<'ok' | 'short' | null>(null)
  const start = useRef(0)
  const raf = useRef(0)
  const down = () => {
    start.current = performance.now()
    setResult(null)
    const loop = () => {
      const p = (performance.now() - start.current) / 1000 / a.holdDuration
      setPress(Math.min(1, p))
      if (p < 1) raf.current = requestAnimationFrame(loop)
      else setResult('ok')
    }
    raf.current = requestAnimationFrame(loop)
  }
  const up = () => {
    cancelAnimationFrame(raf.current)
    if (press < 1 && start.current) setResult('short')
    start.current = 0
    window.setTimeout(() => setPress(0), 300)
  }
  useEffect(() => () => cancelAnimationFrame(raf.current), [])
  return (
    <Sub title="Touch Accommodations">
      <List>
        <Row title="Touch Accommodations" toggle={{ value: a.touchAccommodations, onChange: (v) => setA11y({ touchAccommodations: v }) }} />
      </List>
      <div className="stg-aa">
        <div className="stg-qs-steps">{['Hold', 'Repeat', 'Tap'].map((s, i) => <span key={s} className={i <= Math.min(step, 2) ? 'on' : ''} />)}</div>
        {(step === 0 || step === 3) && (
          <div className="anim-up">
            <h2 className="stg-qs-title">{step === 3 ? 'Your Settings' : 'Set Up Touch Accommodations'}</h2>
            <p className="secondary">Hold Duration sets how long you must touch the screen before it’s recognized as a touch.</p>
            <List header="Hold Duration">
              <div className="stg-pad"><Slider value={a.holdDuration} min={0.1} max={2} step={0.05} onChange={(v) => setA11y({ holdDuration: v })} label="Hold duration" right={<span className="t-footnote">{a.holdDuration.toFixed(2)} s</span>} /></div>
              <div className="stg-hold">
                <button className="stg-hold-target" onPointerDown={down} onPointerUp={up} onPointerLeave={() => start.current && up()} aria-label="Touch and hold test target">
                  <svg viewBox="0 0 80 80" width="80" height="80"><circle cx="40" cy="40" r="34" fill="none" stroke="var(--fill)" strokeWidth="6" /><circle cx="40" cy="40" r="34" fill="none" stroke="var(--accent)" strokeWidth="6" strokeDasharray={213.6} strokeDashoffset={213.6 * (1 - press)} transform="rotate(-90 40 40)" strokeLinecap="round" /></svg>
                  <Hand size={24} />
                </button>
                <div className="t-footnote secondary">{result === 'ok' ? '✓ Touch recognized' : result === 'short' ? 'Too short — keep holding' : 'Touch and hold to test'}</div>
              </div>
            </List>
            {step === 0 ? <Button block onClick={() => setStep(1)}>Continue</Button> : <Button block variant="tinted" onClick={() => setStep(1)}>Run Setup Again</Button>}
          </div>
        )}
        {step === 1 && (
          <div className="anim-up">
            <h2 className="stg-qs-title">Ignore Repeat</h2>
            <p className="secondary">Multiple touches within a short time are treated as a single touch.</p>
            <List><Row title="Ignore Repeat" toggle={{ value: ignore, onChange: setIgnore }} /></List>
            <Button block onClick={() => setStep(2)}>Continue</Button>
          </div>
        )}
        {step === 2 && (
          <div className="anim-up">
            <h2 className="stg-qs-title">Tap Assistance</h2>
            <List>
              {(['Off', 'Use Initial Touch Location', 'Use Final Touch Location'] as const).map((o) => (
                <Row key={o} title={o} onClick={() => setTap(o)} trailing={tap === o ? <Check size={20} className="stg-check" /> : <span style={{ width: 20 }} />} />
              ))}
            </List>
            <Button block onClick={() => { setA11y({ touchAccommodations: true }); usePrefs.getState().setP({ touchWizardDone: true }); setStep(3); os().showToast('Touch Accommodations on') }}>Turn On Touch Accommodations</Button>
          </div>
        )}
      </div>
    </Sub>
  )
}

// ------------------------------------------------------------------ Hearing devices (MFi)
function HearingPage() {
  const device = useOS((s) => s.accessibility.hearingDevice)
  const airpodsHA = useOS((s) => s.airpods.hearingAid)
  const [phase, setPhase] = useState<'search' | 'found' | 'pairing'>('search')
  const [prog, setProg] = useState(0)
  const [program, setProgram] = useState<'Default' | 'Restaurant' | 'Outdoor'>('Default')
  const [liveListen, setLiveListen] = useState(false)
  useEffect(() => {
    if (device || phase !== 'search') return
    const t = window.setTimeout(() => setPhase('found'), 1800)
    return () => window.clearTimeout(t)
  }, [device, phase])
  const pair = () => {
    setPhase('pairing')
    setProg(0)
    let p = 0
    const iv = window.setInterval(() => {
      p += 0.12
      setProg(Math.min(1, p))
      if (p >= 1) {
        window.clearInterval(iv)
        setA11y({ hearingDevice: 'Aria Hearing Aids (Demo)' })
        os().flashIsland({ kind: 'generic', title: 'Hearing Aids', subtitle: 'Connected', duration: 1800, tint: '#0a84ff' })
      }
    }, 220)
  }
  return (
    <HeroPage title="Hearing Devices" icon={<Ico c="#007aff" i={Ear} size={60} />} blurb="Pair Made for iPhone hearing aids and sound processors, and adjust them from Control Center.">
      <List footer="Use AirPods Pro 3 as a clinical-grade hearing aid with your hearing test results.">
        <Row icon={<Ico c="#8e8e93" i={Ear} />} title="AirPods Pro 3 Hearing Aid" toggle={{ value: airpodsHA, onChange: (v) => setAirpods({ hearingAid: v }) }} />
      </List>
      {device ? (
        <>
          <List header="MFi Hearing Devices">
            <Row title={device} subtitle="Connected · Left 82% · Right 79%" />
            <Row title="Live Listen" toggle={{ value: liveListen, onChange: setLiveListen }} />
          </List>
          <List header="Program">
            {(['Default', 'Restaurant', 'Outdoor'] as const).map((p) => <Row key={p} title={p} onClick={() => setProgram(p)} trailing={program === p ? <Check size={20} className="stg-check" /> : <span style={{ width: 20 }} />} />)}
          </List>
          <List>
            <Row destructive title="Forget This Device" onClick={() => { setA11y({ hearingDevice: null }); setPhase('search') }} />
          </List>
        </>
      ) : (
        <List header={<span className="row gap8">MFi Hearing Devices {phase === 'search' && <Spinner size={13} />}</span>} footer="Open the battery doors on your hearing aids, then close them to make them discoverable.">
          {phase === 'search' && <Row title={<span className="secondary">Searching…</span>} />}
          {phase === 'found' && <Row title="Aria Hearing Aids (Demo)" subtitle="Left + Right" tint onClick={pair} />}
          {phase === 'pairing' && (
            <div className="stg-pair">
              <div className="t-subhead">Pairing with Aria Hearing Aids…</div>
              <div className="stg-sync-bar"><span style={{ width: `${prog * 100}%` }} /></div>
              <div className="t-caption1 secondary">{prog < 0.5 ? 'Pairing left aid' : 'Pairing right aid'}</div>
            </div>
          )}
        </List>
      )}
    </HeroPage>
  )
}

// ------------------------------------------------------------------ Subtitles & Captioning
const CAPTION_LANGS = ['Off', 'Spanish', 'French', 'Korean', 'Japanese', 'Chinese (Simplified)', 'German', 'Hindi']
const CAPTION_TR: Record<string, string> = {
  Spanish: '¡Bienvenidos de nuevo al canal de robótica!',
  French: 'Bon retour sur la chaîne robotique !',
  Korean: '로보틱스 채널에 다시 오신 것을 환영합니다!',
  Japanese: 'ロボティクスチャンネルへようこそ！',
  'Chinese (Simplified)': '欢迎回到机器人频道！',
  German: 'Willkommen zurück beim Robotik-Kanal!',
  Hindi: 'रोबोटिक्स चैनल पर फिर से स्वागत है!',
}
function CaptionsPage() {
  const a = useOS((s) => s.accessibility)
  const auto = usePrefs((s) => s.autoCaptions)
  const style = usePrefs((s) => s.captionStyle)
  return (
    <Sub title="Subtitles & Captioning">
      <div className="stg-cc-video">
        <Scene scene="robot-arena" style={{ width: '100%', height: '100%' }} />
        {(a.captions || auto) && (
          <div className={`stg-cc-text ${style.replace(' ', '-').toLowerCase()}`}>
            <div>Welcome back to the robotics channel!</div>
            {a.captionTranslate !== 'Off' && <div className="tr">{CAPTION_TR[a.captionTranslate]}</div>}
          </div>
        )}
        {auto && !a.captions && <span className="stg-cc-badge"><AISparkle size={11} color="#fff" /> Auto</span>}
      </div>
      <List footer="When available, prefer closed captioning or subtitles for the deaf and hard of hearing.">
        <Row title="Closed Captions + SDH" toggle={{ value: a.captions, onChange: (v) => setA11y({ captions: v }) }} />
      </List>
      <List header={<span className="row gap6">Automatic Captions <New27 /></span>} footer="Generate captions on-device for videos that don’t include them — in Photos, Safari, Messages and more.">
        <Row title="Automatic Video Captioning" toggle={{ value: auto, onChange: (v) => usePrefs.getState().setP({ autoCaptions: v }) }} />
        <Push title="Translate Captions" detail={a.captionTranslate} page={() => <ChoicePage title="Translate Captions" options={CAPTION_LANGS} use={() => [useOS((s) => s.accessibility.captionTranslate), (v) => setA11y({ captionTranslate: v })]} footer="Show a translated line under the original captions." />} />
      </List>
      <List>
        <Push title="Style" detail={style} page={() => <ChoicePage title="Style" options={['Default', 'Large Text', 'Classic', 'Outline Text'] as const} use={() => usePref('captionStyle')} />} />
      </List>
    </Sub>
  )
}

export function registerAccessibility() {
  Object.assign(ROUTES, {
    accessibility: { title: 'Accessibility', el: () => <AccessibilityPage />, keywords: 'accessibility voiceover zoom magnifier captions voice control assistive access' },
    'accessibility/voiceover': { title: 'VoiceOver', el: () => <VoiceOverPage />, keywords: 'voiceover screen reader image descriptions ask about image', parent: 'accessibility' },
    'accessibility/zoom': { title: 'Zoom', el: () => <ZoomPage />, keywords: 'zoom magnify window', parent: 'accessibility' },
    'accessibility/display': { title: 'Display & Text Size', el: () => <DisplayTextPage />, keywords: 'bold text larger text contrast transparency reduce motion', parent: 'accessibility' },
    'accessibility/textsize': { title: 'Larger Text', el: () => <LargerText />, keywords: 'larger text dynamic type size', parent: 'accessibility/display' },
    'accessibility/motion': { title: 'Motion', el: () => <MotionPage />, keywords: 'reduce motion animation', parent: 'accessibility' },
    'accessibility/reader': { title: 'Accessibility Reader', el: () => <ReaderPage />, keywords: 'reader text cleanup summaries translation read aloud font', parent: 'accessibility' },
    'accessibility/voicecontrol': { title: 'Voice Control', el: () => <VoiceControlPage />, keywords: 'voice control show names numbers rename element', parent: 'accessibility' },
    'accessibility/assistive': { title: 'Assistive Access', el: () => <AssistivePage />, keywords: 'assistive access simplified setup', parent: 'accessibility' },
    'accessibility/guided': { title: 'Guided Access', el: () => <GuidedPage />, keywords: 'guided access single app', parent: 'accessibility' },
    'accessibility/touch': { title: 'Touch Accommodations', el: () => <TouchPage />, keywords: 'touch accommodations hold duration ignore repeat tap assistance', parent: 'accessibility' },
    'accessibility/hearing': { title: 'Hearing Devices', el: () => <HearingPage />, keywords: 'hearing aids mfi pair live listen', parent: 'accessibility' },
    'accessibility/captions': { title: 'Subtitles & Captioning', el: () => <CaptionsPage />, keywords: 'subtitles captions sdh automatic caption translation', parent: 'accessibility' },
  })
}

