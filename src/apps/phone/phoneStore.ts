import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { at, HOUR, MIN } from '../../os/time'

export interface RecentCall {
  id: string
  contactId?: string
  number: string
  ts: number
  dir: 'outgoing' | 'incoming' | 'missed'
  type: 'mobile' | 'FaceTime Audio' | 'FaceTime Video'
  duration: number
}

export interface Voicemail {
  id: string
  contactId?: string
  number: string
  ts: number
  duration: number
  transcript: string
  unread: boolean
}

const now = Date.now()

export const SEED_RECENTS: RecentCall[] = [
  { id: 'rc1', contactId: 'grandma', number: '(555) 010-7702', ts: now - 35 * MIN, dir: 'missed', type: 'mobile', duration: 0 },
  { id: 'rc2', contactId: 'mom', number: '(555) 010-2231', ts: now - 2 * HOUR - 10 * MIN, dir: 'incoming', type: 'mobile', duration: 126 },
  { id: 'rc3', contactId: 'skyward', number: '(800) 555-0142', ts: at(-1, 17, 12), dir: 'outgoing', type: 'mobile', duration: 402 },
  { id: 'rc4', contactId: 'alex', number: '(555) 010-3345', ts: at(-1, 20, 40), dir: 'outgoing', type: 'FaceTime Video', duration: 1260 },
  { id: 'rc5', contactId: 'bolt', number: '(800) 555-0199', ts: at(-1, 11, 5), dir: 'incoming', type: 'mobile', duration: 64 },
  { id: 'rc6', contactId: 'rosas', number: '(555) 010-7777', ts: at(-2, 18, 30), dir: 'outgoing', type: 'mobile', duration: 95 },
  { id: 'rc7', contactId: 'drlee', number: '(555) 010-3030', ts: at(-2, 10, 14), dir: 'missed', type: 'mobile', duration: 0 },
  { id: 'rc8', contactId: 'dad', number: '(555) 010-2232', ts: at(-3, 12, 2), dir: 'outgoing', type: 'mobile', duration: 311 },
  { id: 'rc9', number: '(555) 010-9981', ts: at(-3, 9, 47), dir: 'missed', type: 'mobile', duration: 0 },
  { id: 'rc10', contactId: 'mia', number: '(555) 010-8810', ts: at(-4, 16, 0), dir: 'incoming', type: 'FaceTime Audio', duration: 48 },
]

export const SEED_VOICEMAIL: Voicemail[] = [
  { id: 'vm1', contactId: 'grandma', number: '(555) 010-7702', ts: now - 34 * MIN, duration: 18, unread: true, transcript: 'Hi sweetheart, it’s Grandma. I made your favorite dumplings for Sunday dinner. Bring Biscuit! Call me back when you can. Love you.' },
  { id: 'vm2', contactId: 'drlee', number: '(555) 010-3030', ts: at(-2, 10, 15), duration: 24, unread: true, transcript: 'Hi, this is Lee Family Dental calling for Jamie Park to confirm your cleaning appointment on Tuesday at 3:30 with Dr. Lee. Please call us back at 555-010-3030. Thank you!' },
  { id: 'vm3', contactId: 'bolt', number: '(800) 555-0199', ts: at(-1, 11, 7), duration: 15, unread: false, transcript: 'This is Bolt Electronics with an update on order BE-58213. Your package has shipped with Parcel Express and should arrive Friday.' },
  { id: 'vm4', contactId: 'thompson', number: '(555) 010-1201', ts: at(-3, 15, 30), duration: 21, unread: false, transcript: 'Hi Jamie, it’s Ms. Thompson. Just a reminder that the percussion bag and mallets need to be loaded by 6:15 for the Fall Concert. Thanks!' },
]

interface PhoneLocal {
  recents: RecentCall[]
  voicemails: Voicemail[]
  tab: 'favorites' | 'recents' | 'contacts' | 'keypad' | 'voicemail'
  set: (p: Partial<PhoneLocal>) => void
  addRecent: (r: Omit<RecentCall, 'id'>) => void
}

export const usePhoneLocal = create<PhoneLocal>()(
  persist(
    (set, get) => ({
      recents: SEED_RECENTS,
      voicemails: SEED_VOICEMAIL,
      tab: 'recents',
      set: (p) => set(p),
      addRecent: (r) => set({ recents: [{ ...r, id: `rc-${Date.now().toString(36)}` }, ...get().recents].slice(0, 60) }),
    }),
    { name: 'ios27-phone', partialize: (s) => ({ recents: s.recents, voicemails: s.voicemails, tab: s.tab }) },
  ),
)
