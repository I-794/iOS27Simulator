/* Simulated VoiceOver: tap once to select + speak, tap the selected item again to
 * activate. Draws the VoiceOver cursor and a caption panel, and gives images rich
 * descriptions (iOS 27 richer image/chart descriptions) from the vision data. */
import { useEffect, useState } from 'react'
import { useOS } from '../os/store'
import { screenScale } from '../os/hooks'
import { SCENE_INSIGHTS } from '../os/ai/vision'
import { PHOTOS } from '../os/data/photos'

function describe(el: HTMLElement): string {
  const img = el.closest('svg[role="img"]') as SVGElement | null
  if (img) {
    const key = img.getAttribute('aria-label') ?? ''
    const photo = PHOTOS.find((p) => p.scene === key)
    const ins = SCENE_INSIGHTS[key]
    const base = photo?.description ?? ins?.summary ?? key
    const extra = ins?.category === 'document' && ins.details.length ? ` ${ins.details.map((d) => `${d.label}: ${d.value}`).join('. ')}.` : ''
    return `Image. ${base}${extra}`
  }
  const labelled = el.closest('[aria-label]') as HTMLElement | null
  const role = el.closest('button, [role=button], a, [role=switch], [role=slider], [role=tab], input, textarea')
  let text = labelled?.getAttribute('aria-label') ?? (el.textContent ?? '').trim().slice(0, 140)
  if (!text && role) text = (role.textContent ?? '').trim()
  let trait = ''
  if (role?.getAttribute('role') === 'switch') trait = `, switch button, ${role.getAttribute('aria-checked') === 'true' ? 'on' : 'off'}`
  else if (role?.getAttribute('role') === 'slider') trait = `, adjustable, ${role.getAttribute('aria-valuenow')}`
  else if (role?.tagName === 'INPUT' || role?.tagName === 'TEXTAREA') trait = ', text field'
  else if (role?.getAttribute('role') === 'tab') trait = `, tab${role.getAttribute('aria-selected') === 'true' ? ', selected' : ''}`
  else if (role) trait = ', button'
  return `${text}${trait}`
}

function speakText(t: string) {
  const st = useOS.getState()
  try {
    window.speechSynthesis?.cancel()
    if (st.silent) return
    const u = new SpeechSynthesisUtterance(t)
    u.rate = 1.1
    u.volume = st.volume
    window.speechSynthesis?.speak(u)
  } catch {
    /* optional */
  }
}

export function VoiceOverHost() {
  const on = useOS((s) => s.accessibility.voiceOver)
  const [sel, setSel] = useState<{ el: HTMLElement; rect: { x: number; y: number; w: number; h: number }; text: string } | null>(null)

  useEffect(() => {
    if (!on) {
      setSel(null)
      return
    }
    const screen = document.querySelector('.screen') as HTMLElement
    const onClick = (e: MouseEvent) => {
      const t = e.target as HTMLElement
      if (!screen.contains(t) || t.closest('.vo-caption')) return
      const target = (t.closest('button, [role=button], a, [role=switch], [role=slider], [role=tab], input, textarea, svg[role="img"], [aria-label]') as HTMLElement) ?? t
      if (sel && (sel.el === target || sel.el.contains(target))) {
        setSel(null)
        return // second tap activates
      }
      e.preventDefault()
      e.stopPropagation()
      const sr = screen.getBoundingClientRect()
      const r = target.getBoundingClientRect()
      const s = screenScale()
      const text = describe(target)
      setSel({ el: target, rect: { x: (r.left - sr.left) / s, y: (r.top - sr.top) / s, w: r.width / s, h: r.height / s }, text })
      speakText(text)
    }
    window.addEventListener('click', onClick, true)
    return () => window.removeEventListener('click', onClick, true)
  }, [on, sel])

  if (!on) return null
  return (
    <>
      {sel && <div className="vo-cursor" style={{ left: sel.rect.x - 3, top: sel.rect.y - 3, width: sel.rect.w + 6, height: sel.rect.h + 6 }} />}
      <div className="vo-caption" role="status" aria-live="polite">
        <b>VoiceOver</b> {sel ? sel.text : 'Tap an item to hear it. Tap again to activate.'}
      </div>
    </>
  )
}
