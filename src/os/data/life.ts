import type { CalendarEvent, CalendarInfo, Note, Reminder, ReminderList, JournalEntry, Alarm } from '../types'
import { at, daysUntilWeekday } from '../time'

const thu = daysUntilWeekday(4, false)
const fri = daysUntilWeekday(5, false)
const sat = daysUntilWeekday(6, false)
const tue = daysUntilWeekday(2, true)

export const CALENDARS: CalendarInfo[] = [
  { id: 'school', name: 'School', color: '#ff9500' },
  { id: 'personal', name: 'Personal', color: '#007aff' },
  { id: 'family', name: 'Family', color: '#34c759', account: 'Shared' },
  { id: 'robotics', name: 'Robotics Team', color: '#af52de', account: 'Subscribed' },
  { id: 'band', name: 'Band', color: '#ff2d55' },
]

export const EVENTS: CalendarEvent[] = [
  { id: 'e-mia', title: 'Pick up Mia from soccer', start: at(0, 17, 0), end: at(0, 17, 30), calendar: 'family', location: 'Riverside Park Fields' },
  { id: 'e-robotics', title: 'Robotics Build Meeting', start: at(thu, 18, 30), end: at(thu, 20, 30), calendar: 'robotics', location: 'Lincoln High Room 114', notes: 'Moved from 3:30 because the gym is booked.\n\n**Bring:** laptop + charger, safety glasses, build log.\n\n_Synced from Circuit Breakers team calendar_', source: 'Team Calendar' },
  { id: 'e-chem', title: 'Chemistry Unit 3 Test', start: at(fri, 10, 0), end: at(fri, 11, 0), calendar: 'school', location: 'Room 208' },
  { id: 'e-study', title: 'Chem study group', start: at(fri, 16, 0), end: at(fri, 17, 30), calendar: 'school', location: 'Maple Grove Library', invitees: ['priya'] },
  { id: 'e-sectionals', title: 'Drumline Sectionals', start: at(sat, 9, 0), end: at(sat, 11, 0), calendar: 'band', location: 'Band Room' },
  { id: 'e-dentist', title: 'Dentist — Dr. Lee', start: at(tue, 15, 30), end: at(tue, 16, 30), calendar: 'personal', location: '55 Elm St, Maple Grove' },
  { id: 'e-concert', title: 'Fall Concert', start: at(16, 18, 0), end: at(16, 20, 30), calendar: 'band', location: 'Lincoln High Auditorium', notes: 'Call time 6:00 PM. Black concert attire.' },
  { id: 'e-physics', title: 'AP Physics Lab', start: at(1, 13, 0), end: at(1, 14, 0), calendar: 'school', location: 'Room 112' },
  { id: 'e-run', title: 'Run with Biscuit', start: at(1, 7, 0), end: at(1, 7, 45), calendar: 'personal' },
  { id: 'e-regional', title: 'Robotics Regional Qualifier', start: at(35, 8, 0), end: at(35, 17, 0), calendar: 'robotics', location: 'State Fair Expo Hall', allDay: false },
  { id: 'e-flight', title: 'Flight SK 482 to Seattle', start: new Date(new Date().getFullYear(), 10, 21, 8, 45).getTime(), end: new Date(new Date().getFullYear(), 10, 21, 11, 5).getTime(), calendar: 'family', location: 'Maple Grove Regional Airport (MGR)', notes: 'Confirmation 7XKQ2P · Seat 14C' },
  { id: 'e-past1', title: 'Robotics Scrimmage', start: at(-4, 9, 0), end: at(-4, 15, 0), calendar: 'robotics', location: 'Westfield High' },
  { id: 'e-past2', title: 'Drumline practice', start: at(-1, 15, 30), end: at(-1, 17, 30), calendar: 'band', location: 'Practice Field' },
  { id: 'e-today-class', title: 'AP Calculus', start: at(0, 9, 0), end: at(0, 10, 0), calendar: 'school', location: 'Room 204' },
  { id: 'e-today-lunch', title: 'Club Fair planning', start: at(0, 12, 10), end: at(0, 12, 45), calendar: 'school', location: 'Cafeteria' },
]

export const REMINDER_LISTS: ReminderList[] = [
  { id: 'reminders', name: 'Reminders', color: '#007aff', icon: 'list' },
  { id: 'school', name: 'School', color: '#ff9500', icon: 'book' },
  { id: 'robotics', name: 'Robotics', color: '#af52de', icon: 'cpu' },
  { id: 'groceries', name: 'Groceries', color: '#34c759', icon: 'cart' },
]

export const REMINDERS: Reminder[] = [
  { id: 'r1', title: 'Finish chem lab report', due: at(thu, 21, 0), done: false, list: 'school', priority: 2 },
  { id: 'r2', title: 'Study stoichiometry flashcards', due: at(fri - 1 >= 0 ? fri - 1 : 0, 20, 0), done: false, list: 'school' },
  { id: 'r3', title: 'Order zip ties + heat shrink', done: false, list: 'robotics', flagged: true },
  { id: 'r4', title: 'Upload intake CAD to team drive', done: true, list: 'robotics' },
  { id: 'r5', title: 'Pick up Mia at 5', due: at(0, 16, 45), done: false, list: 'reminders' },
  { id: 'r6', title: 'Return library book', due: at(3, 12, 0), done: false, list: 'reminders' },
  { id: 'r7', title: 'Dog food for Biscuit', done: false, list: 'groceries' },
  { id: 'r8', title: 'Oat milk', done: false, list: 'groceries' },
  { id: 'r9', title: 'Eggs', done: true, list: 'groceries' },
  { id: 'r10', title: 'Practice cadence 3 at 120 bpm', due: at(1, 19, 0), done: false, list: 'reminders' },
]

export const NOTES: Note[] = [
  {
    id: 'n-buildlog', title: 'Robotics Build Log', folder: 'Robotics', updated: at(-1, 21, 14), pinned: true,
    blocks: [
      { t: 'h1', text: 'Robotics Build Log' },
      { t: 'p', text: 'Circuit Breakers #7729 — 2026 season. Jump to: ' },
      { t: 'link', text: '→ Intake', target: 'intake' },
      { t: 'link', text: '→ Drivetrain', target: 'drivetrain' },
      { t: 'divider' },
      { t: 'h2', text: 'Intake', id: 'intake' },
      { t: 'p', text: 'Roller spacing moved to 2.5 in. Compliance wheels grip much better on the practice field.' },
      { t: 'check', text: 'Print new side plates', done: true },
      { t: 'check', text: 'Replace polycord belts', done: false },
      { t: 'check', text: 'Test with 3 game pieces', done: false },
      { t: 'divider' },
      { t: 'h2', text: 'Drivetrain', id: 'drivetrain' },
      { t: 'table', rows: [['Motor', 'Gear ratio', 'Top speed'], ['Front L/R', '8.14:1', '12.1 ft/s'], ['Back L/R', '8.14:1', '12.1 ft/s']] },
      { t: 'bullet', text: 'Swerve modules calibrated Tuesday' },
      { t: 'bullet', text: 'Need new bumper fabric before regionals' },
    ],
  },
  {
    id: 'n-chem', title: 'Chem Unit 3 Study Guide', folder: 'School', updated: at(-1, 20, 2),
    blocks: [
      { t: 'h1', text: 'Chem Unit 3 Study Guide' },
      { t: 'p', text: 'Test is Friday. Focus on mole ratios and limiting reagents.' },
      { t: 'h3', text: 'Key formulas' },
      { t: 'code', text: 'n = m / M\nPercent yield = actual / theoretical × 100' },
      { t: 'check', text: 'Review worksheet 3.2', done: true },
      { t: 'check', text: 'Practice limiting reagent problems', done: false },
      { t: 'quote', text: 'Always balance the equation first! — Mrs. Alvarez' },
    ],
  },
  {
    id: 'n-packing', title: 'Seattle trip packing', folder: 'Notes', updated: at(-5, 18, 40),
    blocks: [
      { t: 'h1', text: 'Seattle trip packing' },
      { t: 'check', text: 'Rain jacket', done: false },
      { t: 'check', text: 'Chargers', done: false },
      { t: 'check', text: 'Headphones', done: true },
      { t: 'check', text: 'Book for the plane', done: false },
    ],
  },
  {
    id: 'n-cadence', title: 'Drumline cadences', folder: 'Band', updated: at(-2, 22, 5),
    blocks: [
      { t: 'h1', text: 'Drumline cadences' },
      { t: 'p', text: 'Cadence 3 — tempo 120. Watch the rolls in bar 12.' },
      { t: 'drawing', paths: ['M10 40 Q 40 10 70 40 T 130 40', 'M10 70 L 150 70'] },
    ],
  },
  {
    id: 'n-gifts', title: 'Gift ideas', folder: 'Notes', updated: at(-9, 14, 0),
    blocks: [
      { t: 'h1', text: 'Gift ideas' },
      { t: 'bullet', text: 'Mom — pottery class' },
      { t: 'bullet', text: 'Mia — soccer socks (the fun ones)' },
      { t: 'bullet', text: 'Grandma — printed photo of Biscuit at the beach' },
    ],
  },
]

export const JOURNAL: JournalEntry[] = [
  { id: 'j1', ts: at(-1, 21, 30), title: 'Practice field test', body: 'The intake actually worked today. Alex and I stayed late tuning the rollers and it grabbed every piece. Feels like we might have a shot at regionals.', photos: ['p-robot-workshop'], attachments: [{ kind: 'location', label: 'Lincoln High School' }] },
  { id: 'j2', ts: at(-4, 20, 0), title: 'Scrimmage day', body: 'Long day at Westfield. We lost the final but learned a ton about our autonomous routine.', photos: ['p-robot-comp'], attachments: [{ kind: 'workout', label: '8,412 steps' }] },
  { id: 'j3', ts: at(-8, 19, 0), title: 'Beach with Biscuit', body: 'Biscuit discovered waves. She was not a fan at first, then would not leave.', photos: ['p-biscuit-beach', 'p-beach-sunset'], attachments: [{ kind: 'song', label: 'Tidal — Luma Coast' }] },
]

export const ALARMS: Alarm[] = [
  { id: 'al1', hour: 6, minute: 30, label: 'School', enabled: true, repeat: [1, 2, 3, 4, 5], sound: 'Radial', snooze: true },
  { id: 'al2', hour: 8, minute: 0, label: 'Sectionals', enabled: true, repeat: [6], sound: 'Chimes', snooze: true },
  { id: 'al3', hour: 9, minute: 30, label: 'Weekend', enabled: false, repeat: [0], sound: 'Silk', snooze: false },
]

export const WORLD_CLOCKS = [
  { city: 'Cupertino', tz: 'America/Los_Angeles' },
  { city: 'New York', tz: 'America/New_York' },
  { city: 'London', tz: 'Europe/London' },
  { city: 'Seoul', tz: 'Asia/Seoul' },
]

