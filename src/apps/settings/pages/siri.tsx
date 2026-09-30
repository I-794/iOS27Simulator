import { useEffect, useRef, useState } from 'react'
import { Mic, MessageSquare, Lock, Keyboard, Globe, AudioLines, Brain, ScanEye, Sparkles, PenLine, Smile, Play, Square, Check, History } from 'lucide-react'
import { List, Row } from '../../../ui/list'
import { Slider, Button, AISparkle } from '../../../ui/controls'
import { showAlert } from '../../../ui/overlay'
import { useOS } from '../../../os/store'
import { ROUTES, HeroPage, Sub, Ico, Go, Push, ChoicePage, usePrefs, usePref, New27, os, setSiri } from '../common'
import { stopSpeaking } from './accessibility'

const RESPONSES = ['always', 'automatic', 'silent'] as const
const RESP_LABEL = { always: 'Prefer Spoken Responses', automatic: 'Automatic', silent: 'Prefer Silent Responses' }

function SiriPage() {
  const s = useOS((x) => x.siriSettings)
  const convs = useOS((x) => x.siriConversations.length)
  const phrase = usePrefs((x) => x.heySiriPhrase)
  const lang = usePrefs((x) => x.siriLanguage)
  const [ai, setAi] = useState(true)
  return (
    <HeroPage title="Apple Intelligence & Siri" icon={<span className="stg-ai-ico big"><AISparkle size={38} color="#fff" /></span>} blurb="Apple Intelligence is the personal intelligence system that helps you write, express yourself, and get things done — privately, on device.">
      <List>
        <Row icon={<span className="stg-ai-ico"><AISparkle size={18} color="#fff" /></span>} title="Apple Intelligence" toggle={{ value: ai, onChange: (v) => { setAi(v); os().showToast(v ? 'Apple Intelligence on' : 'Apple Intelligence off (demo)') } }} />
      </List>
      <List header="Siri Requests">
        <Push icon={<Ico c="#1c1c1e" i={Mic} />} title="Talk to Siri" detail={s.heySiri ? (phrase === 'Hey Siri' ? '“Hey Siri”' : '“Siri” or “Hey Siri”') : 'Off'} page={() => <TalkPage />} />
        <Row icon={<Ico c="#1c1c1e" i={AudioLines} />} title="Press Side Button for Siri" toggle={{ value: s.sideButton, onChange: (v) => setSiri({ sideButton: v }) }} />
        <Row icon={<Ico c="#1c1c1e" i={Keyboard} />} title="Type to Siri" subtitle="Double-tap the bottom of the screen" toggle={{ value: s.typeToSiri, onChange: (v) => setSiri({ typeToSiri: v }) }} />
        <Row icon={<Ico c="#1c1c1e" i={Lock} />} title="Allow Siri When Locked" toggle={{ value: s.lockScreen, onChange: (v) => setSiri({ lockScreen: v }) }} />
      </List>
      <List>
        <Push icon={<Ico c="#8e8e93" i={Globe} />} title="Language" detail={lang.replace('English ', '')} page={() => <ChoicePage title="Language" options={['English (United States)', 'English (United Kingdom)', 'English (Australia)', 'English (India)', 'Spanish (United States)', 'Korean'] as const} use={() => [usePrefs((x) => x.siriLanguage) as 'Korean', (v) => usePrefs.getState().setP({ siriLanguage: v })]} />} />
        <Go icon={<Ico c="#5856d6" i={AudioLines} />} to="siri/voice" title="Voice" detail={s.voice} />
        <Push icon={<Ico c="#8e8e93" i={MessageSquare} />} title="Siri Responses" detail={s.responses === 'automatic' ? 'Automatic' : s.responses === 'always' ? 'Spoken' : 'Silent'} page={() => <ChoicePage title="Siri Responses" options={RESPONSES} labels={RESP_LABEL} use={() => [useOS((x) => x.siriSettings.responses), (v) => setSiri({ responses: v })]} footer="Automatic uses on-device intelligence to decide when Siri should speak." />} />
      </List>
      <List header={<span className="row gap6">Personal Intelligence <New27 /></span>} footer="Siri can use information from your apps — like messages, mail and calendar — and understand what’s on your screen to take action. This happens on device.">
        <Row icon={<Ico c="#ff9500" i={Brain} />} title="Personal Context" toggle={{ value: s.personalContext, onChange: (v) => setSiri({ personalContext: v }) }} />
        <Row icon={<Ico c="#007aff" i={ScanEye} />} title="Onscreen Awareness" toggle={{ value: s.onscreen, onChange: (v) => setSiri({ onscreen: v }) }} />
      </List>
      <List header="Extensions" footer="With the ChatGPT extension on, Siri can pass complex questions to ChatGPT after asking you. In this simulator, requests stay on device and answers are simulated.">
        <Row
          icon={<span className="stg-gpt-ico">✳︎</span>}
          title="ChatGPT"
          subtitle={s.provider === 'chatgpt' ? 'On · Confirm requests' : 'Off'}
          toggle={{
            value: s.provider === 'chatgpt',
            onChange: (v) =>
              v
                ? showAlert({ title: 'Set Up ChatGPT Extension?', message: 'Siri will ask before sending a request. Simulated — no data leaves your browser.', actions: [{ label: 'Cancel', style: 'cancel' }, { label: 'Enable', onPress: () => setSiri({ provider: 'chatgpt' }) }] })
                : setSiri({ provider: 'siri' }),
          }}
        />
      </List>
      <List header="Apple Intelligence Features">
        <Row icon={<Ico c="#5856d6" i={PenLine} />} title="Writing Tools" detail="Everywhere" />
        <Row icon={<Ico c="#ff2d55" i={Sparkles} />} title="Image Playground" chevron onClick={() => os().launch('playground')} />
        <Row icon={<Ico c="#ff9500" i={Smile} />} title="Genmoji" detail="On" />
      </List>
      <List>
        <Row icon={<Ico c="#8e8e93" i={History} />} title="Siri Conversations" detail={convs} chevron onClick={() => os().launch('siri')} />
        <Row
          destructive
          title="Delete Siri & Dictation History"
          onClick={() => showAlert({ title: 'Delete Siri & Dictation History?', message: 'Your Siri conversations in this simulator will be removed.', actions: [{ label: 'Cancel', style: 'cancel' }, { label: 'Delete', style: 'destructive', onPress: () => { os().set({ siriConversations: [], siriCurrent: null }); os().showToast('Siri history deleted') } }] })}
        />
      </List>
    </HeroPage>
  )
}

function TalkPage() {
  const hey = useOS((s) => s.siriSettings.heySiri)
  const phrase = usePrefs((s) => s.heySiriPhrase)
  const opts = ['Siri or Hey Siri', 'Hey Siri', 'Off'] as const
  const value = hey ? phrase : 'Off'
  return (
    <Sub title="Talk to Siri">
      <List footer="Siri can be activated hands-free by saying “Siri” or “Hey Siri”.">
        {opts.map((o) => (
          <Row key={o} title={o === 'Off' ? 'Off' : `“${o.replace(' or ', '” or “')}”`} onClick={() => { if (o === 'Off') setSiri({ heySiri: false }); else { setSiri({ heySiri: true }); usePrefs.getState().setP({ heySiriPhrase: o }) } }} trailing={value === o ? <Check size={20} strokeWidth={2.6} className="stg-check" /> : <span style={{ width: 20 }} />} />
        ))}
      </List>
    </Sub>
  )
}

// ------------------------------------------------------------------ Voice (pace + expressiveness)
const VOICES = [
  { id: 'Voice 1', accent: 'American', desc: 'Warm, lower register' },
  { id: 'Voice 2', accent: 'American', desc: 'Bright, mid register' },
  { id: 'Voice 3', accent: 'American', desc: 'Calm, relaxed' },
  { id: 'Voice 4', accent: 'British', desc: 'Crisp, measured' },
  { id: 'Voice 5', accent: 'Australian', desc: 'Friendly, upbeat' },
  { id: 'Voice 6', accent: 'Indian', desc: 'Clear, even' },
]
const SAMPLE = 'Hi Jamie, I’m Siri. Your robotics build starts at six thirty, and it looks like rain later — bring a jacket.'

function VoicePage() {
  const s = useOS((x) => x.siriSettings)
  const personal = usePref('personalVoice')
  const [playing, setPlaying] = useState(false)
  const [noSpeech, setNoSpeech] = useState(false)
  const [t, setT] = useState(0)
  const timer = useRef<number | undefined>(undefined)
  const raf = useRef(0)
  const rate = 0.7 + s.pace * 0.75 // 0.7 … 1.45
  const pitch = 0.8 + s.expressiveness * 0.5 // 0.8 … 1.3
  useEffect(() => {
    if (!playing) return
    const loop = () => {
      setT((x) => x + 1)
      raf.current = requestAnimationFrame(loop)
    }
    raf.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf.current)
  }, [playing])
  useEffect(() => () => { stopSpeaking(); window.clearTimeout(timer.current) }, [])

  const stop = () => {
    stopSpeaking()
    window.clearTimeout(timer.current)
    setPlaying(false)
  }
  const preview = () => {
    if (playing) return stop()
    setPlaying(true)
    const est = (SAMPLE.length / 15 / rate) * 1000
    let spoke = false
    try {
      const synth = window.speechSynthesis
      if (synth && typeof SpeechSynthesisUtterance !== 'undefined') {
        synth.cancel()
        const u = new SpeechSynthesisUtterance(SAMPLE)
        u.rate = rate
        u.pitch = pitch
        const voices = synth.getVoices().filter((v) => v.lang.startsWith('en'))
        const vi = VOICES.findIndex((v) => v.id === s.voice)
        const want = VOICES[vi]?.accent === 'British' ? 'GB' : VOICES[vi]?.accent === 'Australian' ? 'AU' : VOICES[vi]?.accent === 'Indian' ? 'IN' : 'US'
        const pick = voices.filter((v) => v.lang.endsWith(want))
        const pool = pick.length ? pick : voices
        if (pool.length) u.voice = pool[Math.max(0, vi) % pool.length]
        u.onend = stop
        u.onerror = stop
        synth.speak(u)
        spoke = true
      }
    } catch {
      spoke = false
    }
    setNoSpeech(!spoke)
    timer.current = window.setTimeout(stop, est + 800)
  }
  const bars = 40
  return (
    <Sub title="Voice">
      <div className="stg-voice">
        <div className={`stg-voice-orb ${playing ? 'on' : ''}`} style={{ ['--pace' as string]: `${1.6 - s.pace}s` }}>
          <AISparkle size={30} color="#fff" />
        </div>
        <div className="stg-wave" aria-hidden>
          {Array.from({ length: bars }).map((_, i) => {
            const amp = playing ? (0.25 + s.expressiveness * 0.75) * Math.abs(Math.sin(i * 0.55 + t * (0.08 + s.pace * 0.18))) * (0.6 + 0.4 * Math.sin(i * 1.7 + t * 0.05)) : 0.08
            return <span key={i} style={{ height: `${6 + amp * 44}px` }} />
          })}
        </div>
        <Button onClick={preview} variant={playing ? 'gray' : 'filled'}>{playing ? <><Square size={14} fill="currentColor" /> Stop</> : <><Play size={14} fill="currentColor" /> Preview</>}</Button>
        {noSpeech && playing && <div className="t-caption1 secondary">Speech isn’t available in this browser — showing the voice waveform.</div>}
      </div>
      <List header="Variety" footer="Voice samples use your browser’s built-in speech when available.">
        {VOICES.map((v) => (
          <Row key={v.id} title={v.id} subtitle={`${v.accent} · ${v.desc}`} onClick={() => setSiri({ voice: v.id })} trailing={s.voice === v.id ? <Check size={20} strokeWidth={2.6} className="stg-check" /> : <span style={{ width: 20 }} />} />
        ))}
      </List>
      <List header={<span className="row gap6">Speaking Style <New27 /></span>} footer="Pace changes how quickly Siri talks. Expressiveness changes how much Siri’s intonation varies — lower is steady and neutral, higher is lively.">
        <div className="stg-voice-slider">
          <div className="row" style={{ justifyContent: 'space-between' }}><span className="t-subhead">Pace</span><span className="t-footnote secondary">{rate.toFixed(2)}×</span></div>
          <Slider value={s.pace} onChange={(v) => setSiri({ pace: v })} label="Siri pace" left={<span className="t-caption1 secondary">Slower</span>} right={<span className="t-caption1 secondary">Faster</span>} />
        </div>
        <div className="stg-voice-slider">
          <div className="row" style={{ justifyContent: 'space-between' }}><span className="t-subhead">Expressiveness</span><span className="t-footnote secondary">{Math.round(s.expressiveness * 100)}%</span></div>
          <Slider value={s.expressiveness} onChange={(v) => setSiri({ expressiveness: v })} label="Siri expressiveness" left={<span className="t-caption1 secondary">Steady</span>} right={<span className="t-caption1 secondary">Lively</span>} />
        </div>
      </List>
      <List>
        <Row title="Use Personal Voice" subtitle="Siri reads messages to others in your voice" toggle={{ value: personal[0], onChange: personal[1] }} />
      </List>
    </Sub>
  )
}

export function registerSiri() {
  Object.assign(ROUTES, {
    siri: { title: 'Apple Intelligence & Siri', el: () => <SiriPage />, keywords: 'siri voice chatgpt assistant apple intelligence personal context onscreen type to siri hey siri responses' },
    'siri/voice': { title: 'Siri Voice', el: () => <VoicePage />, keywords: 'siri voice pace expressiveness preview speed', parent: 'siri' },
  })
}

