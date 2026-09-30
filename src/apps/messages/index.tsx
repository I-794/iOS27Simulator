import { useCallback, useEffect, useState } from 'react'
import { NavStack, useNav } from '../../ui/nav'
import { useRouteOnce } from '../contacts/shared'
import { useOS } from '../../os/store'
import { ConversationList } from './ConversationList'
import { Transcript } from './Transcript'
import { NewMessage } from './NewMessage'
import { resumePending } from './engine'
import './messages.css'

let resumed = false

export default function MessagesApp() {
  useEffect(() => {
    if (!resumed) {
      resumed = true
      resumePending()
    }
  }, [])
  return (
    <div className="app-root msg-app">
      <NavStack root={<Root />} />
    </div>
  )
}

function Root() {
  const nav = useNav()
  const [compose, setCompose] = useState(false)
  const open = useCallback(
    (id: string, msgId?: string) => {
      nav.push(<Transcript convId={id} highlight={msgId} />, `conv-${id}-${Date.now()}`)
    },
    [nav],
  )
  useRouteOnce('messages', (route) => {
    if (route === 'compose' || route.startsWith('compose')) {
      nav.popToRoot()
      setCompose(true)
      return
    }
    const m = route.match(/^conv\/([^/]+)(?:\/(.+))?$/)
    if (m && useOS.getState().conversations.some((c) => c.id === m[1])) {
      nav.popToRoot()
      window.setTimeout(() => open(m[1], m[2]), nav.depth > 0 ? 380 : 30)
    }
  })
  return (
    <>
      <ConversationList onOpen={open} onCompose={() => setCompose(true)} />
      <NewMessage open={compose} onClose={() => setCompose(false)} onSent={(id) => open(id)} />
    </>
  )
}
