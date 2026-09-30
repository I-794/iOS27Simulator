import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface ContactsLocal {
  favorites: string[]
  notes: Record<string, string>
  blocked: string[]
  set: (p: Partial<ContactsLocal>) => void
  toggleFavorite: (id: string) => void
  toggleBlocked: (id: string) => void
}

/** Contacts-side preferences shared by Contacts, Phone and FaceTime. */
export const useContactsLocal = create<ContactsLocal>()(
  persist(
    (set, get) => ({
      favorites: ['mom', 'dad', 'alex', 'grandma', 'mia'],
      notes: {},
      blocked: [],
      set: (p) => set(p),
      toggleFavorite: (id) => {
        const f = get().favorites
        set({ favorites: f.includes(id) ? f.filter((x) => x !== id) : [...f, id] })
      },
      toggleBlocked: (id) => {
        const b = get().blocked
        set({ blocked: b.includes(id) ? b.filter((x) => x !== id) : [...b, id] })
      },
    }),
    { name: 'ios27-contacts', partialize: (s) => ({ favorites: s.favorites, notes: s.notes, blocked: s.blocked }) },
  ),
)
