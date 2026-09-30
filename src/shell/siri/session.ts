/* Shared Siri session logic used by the system overlay and the Siri app. */
import { useOS } from '../../os/store'
import { ask, type SiriResult } from '../../os/ai/siri'

let speakTimer: number | undefined

export function speak(text: string) {
  const st = useOS.getState()
  if (st.siriSettings.responses === 'silent' || st.silent) return
  const synth = typeof window !== 'undefined' ? window.speechSynthesis : undefined
  if (!synth || typeof SpeechSynthesisUtterance === 'undefined') return
  try {
    synth.cancel()
    const u = new SpeechSynthesisUtterance(text.replace(/[“”]/g, '').slice(0, 280))
    u.rate = 0.75 + st.siriSettings.pace * 0.7
    u.pitch = 0.8 + st.siriSettings.expressiveness * 0.5
    u.volume = Math.max(0.05, st.volume)
    synth.speak(u)
  } catch {
    /* speech is optional */
  }
}

export function stopSpeaking() {
  try {
    window.speechSynthesis?.cancel()
  } catch {
    /* ignore */
  }
  window.clearTimeout(speakTimer)
}

/**
 * Run a Siri request: records the user turn, "thinks", records Siri's answer with
 * cards, speaks it, and performs any app navigation. Returns the result.
 */
export function runSiri(text: string, opts: { convId?: string; fromOverlay?: boolean; voice?: boolean } = {}): Promise<SiriResult> {
  const st = useOS.getState()
  let convId = opts.convId ?? st.siriCurrent ?? undefined
  if (!convId || !st.siriConversations.some((c) => c.id === convId)) convId = st.siriNewConversation()
  st.siriAppend({ role: 'user', text }, convId)
  st.set({ siriMode: 'thinking', siriCurrent: convId })
  return new Promise((resolve) => {
    const delay = 380 + Math.min(700, text.length * 8)
    window.setTimeout(() => {
      let res: SiriResult
      try {
        res = ask(text, convId!)
      } catch (e) {
        console.error(e)
        res = { text: 'Sorry, something went wrong. Please try again.', intent: 'error' }
      }
      useOS.getState().siriAppend({ role: 'siri', text: res.text, cards: res.cards, followUps: res.followUps }, convId)
      useOS.getState().set({ siriMode: 'responding' })
      if (opts.voice || useOS.getState().siriSettings.responses === 'always') speak(res.text)
      if (res.open) {
        const { app, route } = res.open
        speakTimer = window.setTimeout(() => {
          const s = useOS.getState()
          if (opts.fromOverlay) s.set({ siriActive: false })
          if (s.locked) s.unlock()
          s.launch(app, { route })
        }, opts.fromOverlay ? 1100 : 600)
      }
      resolve(res)
    }, delay)
  })
}
