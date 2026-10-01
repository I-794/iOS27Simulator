/* Siri app local state: per-turn metadata that the shared SiriTurn type doesn't carry. */
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

interface SiriLocal {
  /** user turn id → attached photo id */
  attachments: Record<string, string>
  /** user turn id → attached document (Files id) */
  docs: Record<string, string>
  /** siri turn id → provider that answered */
  providers: Record<string, 'siri' | 'chatgpt'>
  /** siri turn id → answered by voice */
  voiced: Record<string, boolean>
  seeded: boolean
  set: (p: Partial<SiriLocal>) => void
}

export const useSiriLocal = create<SiriLocal>()(
  persist(
    (set) => ({ attachments: {}, docs: {}, providers: {}, voiced: {}, seeded: false, set: (p) => set(p) }),
    { name: 'ios27-siri', storage: createJSONStorage(() => localStorage), partialize: ({ set: _s, ...rest }) => { void _s; return rest } },
  ),
)

/** Siri turn ids created during this session that should stream in. */
export const freshTurns = new Set<string>()
