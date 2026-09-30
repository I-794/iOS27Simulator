import { useEffect, useState } from 'react'
import { Check } from 'lucide-react'
import { showAlert, Sheet } from '../../ui/overlay'
import { useOS } from '../../os/store'
import type { SiriConversation } from '../../os/types'

// ---------------------------------------------------------------- helpers
export function convTranscript(c: SiriConversation): string {
  return c.turns.map((t) => `${t.role === 'user' ? 'You' : 'Siri'}: ${t.text}`).join('\n\n')
}

export function renameConversation(id: string, title: string) {
  const st = useOS.getState()
  st.set({ siriConversations: st.siriConversations.map((c) => (c.id === id ? { ...c, title: title.trim() || c.title } : c)) })
}
export function togglePin(id: string) {
  const st = useOS.getState()
  st.set({ siriConversations: st.siriConversations.map((c) => (c.id === id ? { ...c, pinned: !c.pinned } : c)) })
}
export function deleteConversation(id: string, after?: () => void) {
  showAlert({
    title: 'Delete Conversation?',
    message: 'This conversation will be deleted from Siri on all your devices.',
    actions: [
      { label: 'Cancel', style: 'cancel' },
      {
        label: 'Delete',
        style: 'destructive',
        onPress: () => {
          const st = useOS.getState()
          st.set({ siriConversations: st.siriConversations.filter((c) => c.id !== id), siriCurrent: st.siriCurrent === id ? null : st.siriCurrent })
          after?.()
        },
      },
    ],
  })
}
export function shareConversation(c: SiriConversation) {
  useOS.getState().set({ shareRequest: { title: c.title, kind: 'text', payload: convTranscript(c), app: 'siri' } })
}

// ---------------------------------------------------------------- rename sheet
export function RenameSheet({ conv, open, onClose }: { conv: SiriConversation | undefined; open: boolean; onClose: () => void }) {
  const [v, setV] = useState(conv?.title ?? '')
  useEffect(() => { if (open) setV(conv?.title ?? '') }, [open, conv?.title])
  const save = () => {
    if (conv) renameConversation(conv.id, v)
    onClose()
  }
  return (
    <Sheet open={open} onClose={onClose} detent="auto" title="Rename" trailing={<button className="bar-btn icon prominent" aria-label="Save" onClick={save}><Check size={20} strokeWidth={2.6} /></button>}>
      <div style={{ padding: '4px 16px 24px' }}>
        <input className="text-input siriapp-rename" value={v} onChange={(e) => setV(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && save()} autoFocus aria-label="Conversation name" enterKeyHint="done" />
      </div>
    </Sheet>
  )
}

export function setProvider(p: 'siri' | 'chatgpt') {
  const st = useOS.getState()
  st.set({ siriSettings: { ...st.siriSettings, provider: p } })
  st.showToast(p === 'chatgpt' ? 'ChatGPT extension on' : 'Answering with Siri')
}

