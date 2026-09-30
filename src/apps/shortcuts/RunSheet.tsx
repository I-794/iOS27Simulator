import { useEffect, useRef, useState } from 'react'
import { CheckCircle2, XCircle, CornerDownRight, Pencil, RotateCcw } from 'lucide-react'
import { Sheet } from '../../ui/overlay'
import { Spinner } from '../../ui/controls'
import { useOS } from '../../os/store'
import type { Shortcut } from '../../os/types'
import { runShortcut, type RunResult } from './run'
import { tileIcon } from './local'
import { countActions } from './actions'

export function RunSheet({ shortcut, onClose, onEdit }: { shortcut: Shortcut | null; onClose: () => void; onEdit?: (id: string) => void }) {
  const [res, setRes] = useState<RunResult>({ steps: [] })
  const [done, setDone] = useState(false)
  const [nonce, setNonce] = useState(0)
  const cancelled = useRef(false)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!shortcut) return
    cancelled.current = false
    setRes({ steps: [] })
    setDone(false)
    runShortcut(shortcut, (r) => {
      if (!cancelled.current) setRes(r)
    }, () => cancelled.current).then((r) => {
      if (cancelled.current) return
      setDone(true)
      if (r.open) {
        const open = r.open
        window.setTimeout(() => {
          onClose()
          useOS.getState().launch(open.app, { route: open.route })
        }, 900)
      }
    })
    return () => {
      cancelled.current = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shortcut?.id, nonce])

  useEffect(() => {
    listRef.current?.lastElementChild?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [res.steps.length])

  const total = shortcut ? Math.max(1, countActions(shortcut.actions)) : 1
  const doneCount = res.steps.filter((s) => s.status !== 'running' && s.kind !== 'if').length
  const pct = done ? 1 : Math.min(0.95, doneCount / total)
  const Icon = tileIcon(shortcut?.icon ?? '')

  return (
    <Sheet open={!!shortcut} onClose={() => { cancelled.current = true; onClose() }} detent="auto" title={null} closeButton={false} className="shc-runsheet">
      {shortcut && (
        <div className="shc-run">
          <div className="row gap12">
            <span className="shc-run-icon" style={{ background: `linear-gradient(160deg, color-mix(in srgb, ${shortcut.color} 70%, #fff), ${shortcut.color})` }}><Icon size={24} color="#fff" /></span>
            <div className="grow">
              <div className="t-headline">{shortcut.name}</div>
              <div className="t-footnote secondary">{done ? 'Done' : 'Running…'} · {total} action{total === 1 ? '' : 's'}</div>
            </div>
            {done ? (
              <button className="btn small gray" onClick={() => setNonce((n) => n + 1)} aria-label="Run again"><RotateCcw size={14} /> Again</button>
            ) : <Spinner size={22} />}
          </div>
          <div className="shc-progress"><div style={{ width: `${pct * 100}%`, background: shortcut.color }} /></div>
          <div className="shc-steps scroll" ref={listRef}>
            {res.steps.map((s) => (
              <div key={s.id} className={`shc-step anim-up ${s.status}`} style={{ paddingLeft: 4 + s.depth * 18 }}>
                <span className="shc-step-ico">
                  {s.status === 'running' ? <Spinner size={16} /> : s.status === 'failed' ? <XCircle size={18} color="var(--red)" /> : s.kind === 'if' ? <CornerDownRight size={17} color={s.color} /> : <CheckCircle2 size={18} color="var(--green)" />}
                </span>
                <div className="grow">
                  <div className="t-subhead bold">{s.label}</div>
                  {s.detail && <div className="t-footnote secondary shc-step-detail">{s.detail}</div>}
                </div>
              </div>
            ))}
          </div>
          {done && res.result && (
            <div className="shc-result anim-pop">
              <div className="t-caption1 secondary">Result</div>
              <div className="t-body">{res.result}</div>
            </div>
          )}
          <div className="row gap8" style={{ marginTop: 14 }}>
            {onEdit && <button className="btn gray grow" onClick={() => { onClose(); onEdit(shortcut.id) }}><Pencil size={15} /> Edit</button>}
            <button className="btn filled grow" onClick={() => { cancelled.current = true; onClose() }}>{done ? 'Done' : 'Stop'}</button>
          </div>
        </div>
      )}
    </Sheet>
  )
}
