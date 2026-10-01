import type { Contact } from '../types'

/** The simulated owner of this iPhone. All data is fictional. */
export const ME = {
  id: 'me',
  first: 'Jamie',
  last: 'Park',
  phone: '(555) 010-4417',
  email: 'jamie.park@icloud.example',
  school: 'Lincoln High School',
  grade: '11th grade',
  home: '84 Birchwood Lane, Maple Grove',
  pet: 'Biscuit',
}

export const CONTACTS: Contact[] = [
  { id: 'mom', first: 'Dana', last: 'Park', nickname: 'Mom', relation: 'mother', phones: ['(555) 010-2231'], emails: ['dana.park@mail.example'], color: '#ff6b8a', tone: 'family', address: '84 Birchwood Lane, Maple Grove', birthday: 'March 3' },
  { id: 'dad', first: 'Michael', last: 'Park', nickname: 'Dad', relation: 'father', phones: ['(555) 010-2232'], emails: ['mpark@work.example'], color: '#3a8dff', tone: 'family', address: '84 Birchwood Lane, Maple Grove' },
  { id: 'mia', first: 'Mia', last: 'Park', relation: 'sister', phones: ['(555) 010-8810'], emails: ['mia.p@icloud.example'], color: '#b36bff', tone: 'casual' },
  { id: 'grandma', first: 'Helen', last: 'Cho', nickname: 'Grandma', relation: 'grandmother', phones: ['(555) 010-7702'], emails: ['helen.cho@mail.example'], color: '#ff9f43', tone: 'family', address: '1420 Willow Creek Dr, Maple Grove' },
  { id: 'alex', first: 'Alex', last: 'Rivera', nickname: 'Al', relation: 'friend', company: 'Circuit Breakers Robotics #7729 — Captain', phones: ['(555) 010-3345'], emails: ['alex.rivera@lincoln.example'], color: '#1fb6ff', tone: 'casual' },
  { id: 'sam', first: 'Sam', last: 'Okafor', relation: 'friend', company: 'Lincoln Drumline', phones: ['(555) 010-5521'], emails: ['sam.okafor@lincoln.example'], color: '#2bd67b', tone: 'casual' },
  { id: 'priya', first: 'Priya', last: 'Shah', relation: 'friend', phones: ['(555) 010-6619'], emails: ['priya.shah@lincoln.example'], color: '#ff7a45', tone: 'casual' },
  { id: 'leo', first: 'Leo', last: 'Martins', relation: 'friend', company: 'Lincoln Drumline', phones: ['(555) 010-9092'], emails: ['leo.m@lincoln.example'], color: '#f5b700', tone: 'casual' },
  { id: 'nora', first: 'Nora', last: 'Kim', relation: 'teammate', company: 'Circuit Breakers Robotics', phones: ['(555) 010-4480'], emails: ['nora.kim@lincoln.example'], color: '#00c7be', tone: 'casual' },
  { id: 'delgado', first: 'Marco', last: 'Delgado', nickname: 'Mr. Delgado', relation: 'robotics advisor', company: 'Lincoln High School — Engineering', phones: ['(555) 010-1200'], emails: ['mdelgado@lincoln.example'], color: '#8e8e93', tone: 'teacher' },
  { id: 'thompson', first: 'Rachel', last: 'Thompson', nickname: 'Ms. Thompson', relation: 'band director', company: 'Lincoln High School — Music', phones: ['(555) 010-1201'], emails: ['rthompson@lincoln.example'], color: '#a2845e', tone: 'teacher' },
  { id: 'rosas', first: "Rosa's Trattoria", phones: ['(555) 010-7777'], emails: ['reservations@rosas.example'], color: '#c0392b', isBusiness: true, address: '218 Main St, Maple Grove', company: 'Italian Restaurant' },
  { id: 'skyward', first: 'Skyward Airlines', phones: ['(800) 555-0142'], emails: ['itinerary@skyward.example'], color: '#0a84ff', isBusiness: true, company: 'Airline' },
  { id: 'bolt', first: 'Bolt Electronics', phones: ['(800) 555-0199'], emails: ['orders@bolt.example'], color: '#ffcc00', isBusiness: true, company: 'Electronics Store', address: 'Greenfield Mall, Maple Grove' },
  { id: 'drlee', first: 'Lee Family Dental', phones: ['(555) 010-3030'], emails: ['frontdesk@leedental.example'], color: '#34c759', isBusiness: true, address: '55 Elm St, Maple Grove' },
  { id: 'brewlab', first: 'Brew Lab Coffee', phones: ['(555) 010-2828'], emails: ['hello@brewlab.example'], color: '#8b5a2b', isBusiness: true, address: '410 Oak Ave, Maple Grove' },
]

export const contactById = (id: string): Contact | undefined => CONTACTS.find((c) => c.id === id)

export function contactName(id: string, style: 'short' | 'full' = 'short'): string {
  if (id === 'me') return 'Me'
  const c = contactById(id)
  if (!c) return id
  if (c.isBusiness) return c.first
  if (style === 'short') return c.nickname && ['Mom', 'Dad', 'Grandma'].includes(c.nickname) ? c.nickname : c.first
  return [c.first, c.last].filter(Boolean).join(' ')
}

export function initials(id: string): string {
  const c = contactById(id)
  if (!c) return id.slice(0, 1).toUpperCase()
  if (c.isBusiness) return c.first.slice(0, 1)
  return ((c.first?.[0] ?? '') + (c.last?.[0] ?? '')).toUpperCase()
}
