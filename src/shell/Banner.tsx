import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { ArrowUp } from 'lucide-react'
import { useOS } from '../os/store'
import { NotificationCard, openNotification } from './Notifications'
import { springs, animateSpring } from '../os/spring'
import { screenScale } from '../os/hooks'
import { Glass } from '../ui/controls'
import { smartReplies } from '../os/ai/writing'

export function Banner() {
  const banner = useOS((s) => s.banner)
  const locked = useOS((s) => s.locked)
  const overlay = useOS((s) => s.overlay)
  const ref = useRef<HTMLDivElement>(null)
  const [reply, setReply] = useState(false)
  const [text, setText] = useState('')

  useLayoutEffect(() => {
    if (banner && ref.current) {
      setReply(false)
      animateSpring(ref.current, [{ transform: 'translateX(-115%)', opacity: 0.6 }, { transform: 'none', opacity: 1 }], springs.sheet(), { fill: 'none' })
    }
  }, [banner?.id])

  useEffect(() => {
    if (!reply || !banner) return
    // keep the banner up while replying
    useOS.setState({ banner })
  }, [reply, banner])

  if (!banner || locked || overlay === 'nc') return null
  const conv = banner.thread ? useOS.getState().conversations.find((c) => c.id === banner.thread) : undefined
  const last = conv?.messages[conv.messages.length - 1]

  const onDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('input, button')) return
    const scale = screenScale()
    const y0 = e.clientY
    let dy = 0
    const move = (ev: PointerEvent) => {
      dy = (ev.clientY - y0) / scale
      if (ref.current) ref.current.style.transform = `translateY(${dy < 0 ? dy : dy * 0.3}px)`
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      if (ref.current) ref.current.style.transform = ''
      if (dy < -30) useOS.setState({ banner: null })
      else if (dy > 30 && banner.app === 'messages') setReply(true)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  const send = (t: string) => {
    if (!conv || !t.trim()) return
    const st = useOS.getState()
    const id = st.sendMessage(conv.id, { text: t })
    window.setTimeout(() => useOS.getState().patchMessage(conv.id, id, { status: 'delivered' }), 600)
    st.dismissNotification(banner.id)
    useOS.setState({ banner: null })
    setText('')
  }

  return (
    <div className="banner" ref={ref} onPointerDown={onDown} onClickCapture={(e) => {
      if (reply) return
      if ((e.target as HTMLElement).closest('.notif')) {
        e.stopPropagation()
        openNotification(banner)
      }
    }}>
      <NotificationCard n={banner} />
      {reply && conv && (
        <Glass className="banner-reply anim-up" variant="heavy">
          <div className="row gap6" style={{ marginBottom: 8, flexWrap: 'wrap' }}>
            {smartReplies(last?.text ?? '', last?.from).map((r) => <button key={r} className="chip" onClick={() => send(r)}>{r}</button>)}
          </div>
          <div className="row gap8">
            <input className="text-input banner-input" autoFocus placeholder="iMessage" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send(text)} enterKeyHint="send" data-recipient={conv.participants[0]} />
            <button className="send-btn" aria-label="Send" onClick={() => send(text)} disabled={!text.trim()}><ArrowUp size={18} strokeWidth={3} /></button>
          </div>
        </Glass>
      )}
    </div>
  )
}
