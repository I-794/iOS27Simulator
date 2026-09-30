import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Conversation } from '../../os/types'

export type SuggestionState = { done: true; label: string; at: number } | { dismissed: true }

interface MsgLocal {
  /** replyTo links (message id → quoted message id) */
  replies: Record<string, string>
  /** time the recipient read a message (for "Read 9:41 AM") */
  readAt: Record<string, number>
  /** Apple Intelligence suggestions acted on / dismissed, keyed `${msgId}:${kind}` */
  suggestions: Record<string, SuggestionState>
  /** conversations deleted into Recently Deleted */
  deleted: { conv: Conversation; at: number }[]
  /** edited messages */
  edited: Record<string, true>
  /** runtime (not persisted) */
  openConv: string | null
  typing: Record<string, string | undefined>
  downloads: Record<string, number>
  filter: 'all' | 'unread'
  set: (p: Partial<MsgLocal>) => void
}

export const useMsgLocal = create<MsgLocal>()(
  persist(
    (set) => ({
      replies: {},
      readAt: {},
      suggestions: {},
      deleted: [],
      edited: {},
      openConv: null,
      typing: {},
      downloads: {},
      filter: 'all',
      set: (p) => set(p),
    }),
    {
      name: 'ios27-messages',
      partialize: (s) => ({ replies: s.replies, readAt: s.readAt, suggestions: s.suggestions, deleted: s.deleted, edited: s.edited }),
    },
  ),
)

export const msgLocal = () => useMsgLocal.getState()
