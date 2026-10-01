import { useOS, type FreeformBoard } from '../../os/store'

export function updateBoard(id: string, patch: Partial<FreeformBoard>) {
  const st = useOS.getState()
  st.set({ freeform: st.freeform.map((b) => (b.id === id ? { ...b, ...patch, updated: Date.now() } : b)) })
}
