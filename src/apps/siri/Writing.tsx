import { useEffect, useState } from 'react'
import { Copy, Share, Send, RotateCcw, Wand2 } from 'lucide-react'
import { Sheet } from '../../ui/overlay'
import { Segmented, Avatar, AISparkle } from '../../ui/controls'
import { useOS } from '../../os/store'
import { draft, rewrite, proofread, type Tone } from '../../os/ai/writing'
import { doSend } from '../../os/ai/siri'
import { contactName } from '../../os/data/people'

const MODES = ['Compose', 'Rewrite', 'Proofread'] as const
type Mode = (typeof MODES)[number]
const TONES: { id: Tone; label: string; emoji: string }[] = [
  { id: 'friendly', label: 'Friendly', emoji: '😊' },
  { id: 'professional', label: 'Professional', emoji: '💼' },
  { id: 'concise', label: 'Concise', emoji: '✂️' },
  { id: 'warm', label: 'Warm', emoji: '🤍' },
  { id: 'excited', label: 'Excited', emoji: '🎉' },
]
const RECIPIENTS = ['mom', 'dad', 'alex', 'delgado', 'sam']
const SAMPLES: Record<Mode, string> = {
  Compose: 'ask Mr. Delgado if I can stay late Thursday to finish the intake',
  Rewrite: 'hey can u send me the cad files for the intake, i need them before thursday',
  Proofread: 'im going to be late to practice tommorow, i definately wont miss sectionals tho',
}

/** Write with Siri inside the Siri app: compose → pick tone → result. */
export function WritingSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [mode, setMode] = useState<Mode>('Compose')
  const [to, setTo] = useState<string | undefined>('delgado')
  const [input, setInput] = useState('')
  const [tone, setTone] = useState<Tone>('friendly')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ body: string; subject?: string; changes?: number } | null>(null)
  const [sent, setSent] = useState(false)

  useEffect(() => {
    if (open) {
      setResult(null)
      setSent(false)
    }
  }, [open])

  const generate = (t: Tone = tone) => {
    const src = input.trim() || SAMPLES[mode]
    if (!input.trim()) setInput(src)
    setBusy(true)
    setResult(null)
    setSent(false)
    window.setTimeout(() => {
      if (mode === 'Compose') {
        const d = draft(src, to, to === 'delgado' ? 'mail' : 'message')
        const body = t === 'professional' || to === 'delgado' ? d.body : rewrite(d.body, t, to)
        setResult({ body, subject: d.subject })
      } else if (mode === 'Rewrite') {
        setResult({ body: rewrite(src, t, to) })
      } else {
        const pr = proofread(src)
        setResult({ body: pr.text, changes: pr.changes.length })
      }
      setBusy(false)
    }, 750)
  }

  const copy = () => {
    try {
      void navigator.clipboard?.writeText(result?.body ?? '').catch(() => {})
    } catch {
      /* optional */
    }
    useOS.getState().showToast('Copied')
  }

  return (
    <Sheet open={open} onClose={onClose} title={<span className="row gap6" style={{ justifyContent: 'center' }}><AISparkle size={18} /> Writing Tools</span>} detent="large">
      <div className="siriapp-write">
        <Segmented options={MODES} value={mode} onChange={(m) => { setMode(m); setResult(null) }} />

        <div className="siriapp-write-label">To</div>
        <div className="siriapp-write-to scroll">
          <button className={!to ? 'on' : ''} onClick={() => setTo(undefined)}><span className="siriapp-anyone">—</span>Anyone</button>
          {RECIPIENTS.map((id) => (
            <button key={id} className={to === id ? 'on' : ''} onClick={() => setTo(id)}><Avatar id={id} size={36} />{contactName(id)}</button>
          ))}
        </div>

        <div className="siriapp-write-label">{mode === 'Compose' ? 'Describe what you want to write' : mode === 'Rewrite' ? 'Text to rewrite' : 'Text to proofread'}</div>
        <textarea
          className="text-input siriapp-write-input"
          rows={4}
          value={input}
          placeholder={SAMPLES[mode]}
          onChange={(e) => setInput(e.target.value)}
          data-recipient={to}
          aria-label="Writing input"
        />

        {mode !== 'Proofread' && (
          <>
            <div className="siriapp-write-label">Tone</div>
            <div className="siriapp-tones">
              {TONES.map((t) => (
                <button key={t.id} className={tone === t.id ? 'on' : ''} onClick={() => { setTone(t.id); if (result) generate(t.id) }}>
                  <span>{t.emoji}</span>{t.label}
                </button>
              ))}
            </div>
          </>
        )}

        <button className="btn filled block siriapp-write-go" onClick={() => generate()} disabled={busy}>
          <Wand2 size={17} /> {busy ? 'Writing…' : result ? 'Try Again' : mode === 'Compose' ? 'Compose' : mode === 'Rewrite' ? 'Rewrite' : 'Proofread'}
        </button>

        {busy && (
          <div className="siriapp-write-result ai-glow">
            <div className="siriapp-skel" style={{ width: '92%' }} /><div className="siriapp-skel" style={{ width: '80%' }} /><div className="siriapp-skel" style={{ width: '55%' }} />
          </div>
        )}
        {result && !busy && (
          <div className="siriapp-write-result anim-up">
            <div className="t-caption1 secondary row gap6" style={{ marginBottom: 6 }}>
              <AISparkle size={13} /> {mode === 'Proofread' ? `${result.changes ?? 0} correction${result.changes === 1 ? '' : 's'}` : `${TONES.find((x) => x.id === tone)?.label}${to ? ` · for ${contactName(to)}` : ''}`}
            </div>
            {result.subject && <div className="t-headline" style={{ marginBottom: 4 }}>{result.subject}</div>}
            <div className="siriapp-write-body">{result.body}</div>
            <div className="row gap8" style={{ marginTop: 12, flexWrap: 'wrap' }}>
              <button className="btn small gray" onClick={copy}><Copy size={14} /> Copy</button>
              <button className="btn small gray" onClick={() => useOS.getState().set({ shareRequest: { title: result.subject ?? 'Writing Tools', kind: 'text', payload: result.body, app: 'siri' } })}><Share size={14} /> Share</button>
              <button className="btn small gray" onClick={() => generate()}><RotateCcw size={14} /> Retry</button>
              {to && (
                <button className="btn small filled" disabled={sent} onClick={() => {
                  doSend({ to, body: result.body, app: to === 'delgado' ? 'mail' : 'messages', subject: result.subject })
                  setSent(true)
                  useOS.getState().showToast(to === 'delgado' ? `Email sent to ${contactName(to)}` : `Sent to ${contactName(to)}`)
                }}><Send size={14} /> {sent ? 'Sent' : `Send to ${contactName(to)}`}</button>
              )}
            </div>
          </div>
        )}
      </div>
    </Sheet>
  )
}
