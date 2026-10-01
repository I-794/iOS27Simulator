import type { Conversation, MailMessage } from '../types'
import { at, HOUR, MIN, nextWeekday, daysUntilWeekday } from '../time'

const now = Date.now()
const thu = daysUntilWeekday(4, false)
const sat = daysUntilWeekday(6, false)

export const CONVERSATIONS: Conversation[] = [
  {
    id: 'c-alex',
    participants: ['alex'],
    pinned: true,
    unread: 1,
    messages: [
      { id: 'a1', from: 'alex', text: 'did you finish the intake CAD?', ts: at(-2, 19, 2) },
      { id: 'a2', from: 'me', text: 'almost, just need to fix the roller spacing', ts: at(-2, 19, 10), status: 'read' },
      { id: 'a3', from: 'alex', text: 'nice. Mr. Delgado wants to test it on the practice field', ts: at(-2, 19, 11) },
      { id: 'a4', from: 'alex', attachment: { kind: 'photo', photoId: 'p-robot-workshop' }, ts: at(-2, 19, 13), reactions: [{ from: 'me', emoji: '❤️' }] },
      { id: 'a5', from: 'alex', text: 'Robotics got moved to 6:30 Thursday. Room 114 like usual', ts: at(-1, 16, 42) },
      { id: 'a6', from: 'me', text: 'ok cool 👍', ts: at(-1, 16, 50), status: 'read' },
      { id: 'a7', from: 'alex', text: 'also bring your laptop charger, the one in the shop is broken again', ts: now - 38 * MIN },
    ],
  },
  {
    id: 'c-mom',
    participants: ['mom'],
    pinned: true,
    messages: [
      { id: 'm1', from: 'mom', text: 'Dinner at Grandma’s on Sunday at 5! She moved into her new place', ts: at(-3, 12, 5) },
      { id: 'm2', from: 'mom', text: 'Her new address is 1420 Willow Creek Dr, Maple Grove', ts: at(-3, 12, 6) },
      { id: 'm3', from: 'me', text: 'got it', ts: at(-3, 12, 30), status: 'read' },
      { id: 'm4', from: 'mom', text: 'Can you pick up Mia from soccer at 5 today? I’m stuck at work', ts: now - 2 * HOUR },
      { id: 'm5', from: 'me', text: 'yep I can', ts: now - 2 * HOUR + 4 * MIN, status: 'read' },
      { id: 'm6', from: 'mom', text: 'Thank you sweetie ❤️', ts: now - 2 * HOUR + 5 * MIN, reactions: [{ from: 'me', emoji: '❤️' }] },
    ],
  },
  {
    id: 'c-sam',
    participants: ['sam'],
    unread: 1,
    messages: [
      { id: 's1', from: 'sam', text: 'yo that cadence at practice was clean', ts: at(-1, 20, 11) },
      { id: 's2', from: 'me', text: 'haha thanks, the new sticking helped', ts: at(-1, 20, 20), status: 'read' },
      { id: 's3', from: 'sam', text: 'Can you remind me to bring the percussion bag tomorrow? I always forget it 😭', ts: now - 12 * MIN },
    ],
  },
  {
    id: 'c-dad',
    participants: ['dad'],
    messages: [
      { id: 'd1', from: 'dad', text: 'Great job at the scrimmage Saturday!', ts: at(-4, 18, 0) },
      { id: 'd2', from: 'dad', text: 'Can you send me that photo of Biscuit at the beach? Want to print it for Grandma', ts: now - 3 * HOUR },
    ],
  },
  {
    id: 'c-drumline',
    participants: ['sam', 'priya', 'leo'],
    name: 'Drumline 🥁',
    messages: [
      { id: 'g1', from: 'leo', text: 'Sectionals Saturday 9am in the band room, Ms. Thompson confirmed', ts: at(-1, 17, 30), reactions: [{ from: 'sam', emoji: '👍' }, { from: 'priya', emoji: '👍' }, { from: 'me', emoji: '👍' }] },
      { id: 'g2', from: 'priya', text: 'can someone bring extra sticks? mine cracked', ts: at(-1, 17, 34), reactions: [{ from: 'leo', emoji: '😂' }, { from: 'sam', emoji: '😂' }] },
      { id: 'g3', from: 'sam', attachment: { kind: 'photo', photoId: 'p-drumline' }, ts: at(-1, 17, 40), reactions: [{ from: 'leo', emoji: '❤️' }, { from: 'priya', emoji: '❤️' }, { from: 'me', emoji: '❤️' }, { from: 'leo', emoji: '‼️' }] },
      { id: 'g4', from: 'me', text: 'I have a spare pair', ts: at(-1, 17, 45), status: 'read', reactions: [{ from: 'priya', emoji: '❤️' }] },
      { id: 'g5', from: 'leo', attachment: { kind: 'video', photoId: 'v-cadence', sizeMB: 412, offloaded: true, duration: 94 }, ts: at(-1, 18, 2) },
    ],
  },
  {
    id: 'c-priya',
    participants: ['priya'],
    messages: [
      { id: 'p1', from: 'priya', text: 'study group for the chem test Friday at 4? library', ts: at(-1, 15, 0) },
      { id: 'p2', from: 'me', text: 'I’m in', ts: at(-1, 15, 3), status: 'read' },
      { id: 'p3', from: 'priya', attachment: { kind: 'link', url: 'chemreview.example/unit-3', title: 'Unit 3 Review: Stoichiometry', subtitle: 'chemreview.example' }, ts: at(-1, 15, 4) },
    ],
  },
  {
    id: 'c-mia',
    participants: ['mia'],
    messages: [
      { id: 'mi1', from: 'mia', text: 'can I borrow your gray hoodie', ts: at(-2, 7, 12) },
      { id: 'mi2', from: 'me', text: 'only if you give it back this time', ts: at(-2, 7, 20), status: 'read' },
      { id: 'mi3', from: 'mia', attachment: { kind: 'drawing', drawing: 'M20 60 C 40 10, 80 10, 100 60 S 160 110, 180 60' }, ts: at(-2, 7, 21) },
    ],
  },
  {
    id: 'c-skyward',
    participants: ['skyward'],
    messages: [
      { id: 'sk1', from: 'skyward', text: 'Skyward Airlines: Your trip is confirmed. Flight SK 482 MGR → SEA departs Nov 21 at 8:45 AM. Confirmation code 7XKQ2P. Reply HELP for help.', ts: at(-6, 10, 0) },
    ],
  },
  {
    id: 'c-nora',
    participants: ['nora'],
    messages: [
      { id: 'n1', from: 'nora', text: 'the new motor controllers came in!!', ts: at(-5, 14, 22) },
      { id: 'n2', from: 'me', text: 'finally 🙌', ts: at(-5, 14, 25), status: 'read' },
    ],
  },
]

export const MAILS: MailMessage[] = [
  {
    id: 'mail-rosas', from: { name: "Rosa's Trattoria", email: 'reservations@rosas.example' }, to: 'jamie.park@icloud.example',
    subject: 'Your reservation is confirmed', ts: now - 55 * MIN, unread: true, folder: 'inbox', category: 'transactions',
    body: `Hi Jamie,\n\nThanks for booking with Rosa's Trattoria! Your table is confirmed.\n\nDate: Saturday\nTime: 7:00 PM\nParty size: 4\nName: Park\nAddress: 218 Main St, Maple Grove\n\nNeed to change your plans? Call us at (555) 010-7777.\n\nSee you soon,\nRosa's Trattoria`,
    facts: { kind: 'reservation', title: "Dinner at Rosa's Trattoria", when: `${sat}|19:00`, location: '218 Main St, Maple Grove', party: '4', name: 'Park' },
  },
  {
    id: 'mail-bolt', from: { name: 'Bolt Electronics', email: 'orders@bolt.example' }, to: 'jamie.park@icloud.example',
    subject: 'Your order BE-58213 has shipped', ts: now - 5 * HOUR, unread: true, folder: 'inbox', category: 'transactions',
    body: `Good news — your order is on its way!\n\nOrder number: BE-58213\nItems: Single-board computer starter kit, 40-pin ribbon cable\nCarrier: Parcel Express\nTracking: PX 7741 2290 5531\nEstimated delivery: Friday\n\nQuestions? Call (800) 555-0199 and have your order number ready.`,
    facts: { kind: 'order', order: 'BE-58213', tracking: 'PX 7741 2290 5531', eta: 'Friday' },
  },
  {
    id: 'mail-skyward', from: { name: 'Skyward Airlines', email: 'itinerary@skyward.example' }, to: 'jamie.park@icloud.example',
    subject: 'Trip confirmation — Maple Grove to Seattle (7XKQ2P)', ts: at(-6, 9, 58), unread: false, folder: 'inbox', category: 'transactions',
    body: `Your trip is booked.\n\nConfirmation code: 7XKQ2P\nFlight: SK 482\nDeparts: MGR Nov 21, 8:45 AM\nArrives: SEA Nov 21, 11:05 AM\nPassengers: Michael Park, Dana Park, Jamie Park, Mia Park\nSeat: 14C\n\nCheck in opens 24 hours before departure.`,
    attachments: [{ name: 'Itinerary-7XKQ2P.pdf', size: '184 KB', kind: 'pdf' }],
    facts: { kind: 'flight', flight: 'SK 482', confirmation: '7XKQ2P', seat: '14C' },
  },
  {
    id: 'mail-delgado', from: { name: 'Marco Delgado', email: 'mdelgado@lincoln.example' }, to: 'circuit-breakers@lincoln.example',
    subject: 'Robotics: meeting time change + regional prep', ts: at(-1, 15, 12), unread: true, folder: 'inbox', category: 'primary',
    body: `Team,\n\nHeads up — because the gym is booked, this week's build meeting moves to Thursday at 6:30 PM in Room 114.\n\nPlease bring:\n• Laptops with the latest CAD\n• Safety glasses\n• Your build log\n\nThe regional qualifier is five weeks away. Let's get the intake finished this week.\n\n— Mr. Delgado`,
    facts: { kind: 'event', title: 'Robotics build meeting', when: `${thu}|18:30`, location: 'Lincoln High Room 114' },
  },
  {
    id: 'mail-thompson', from: { name: 'Rachel Thompson', email: 'rthompson@lincoln.example' }, to: 'band-families@lincoln.example',
    subject: 'Fall Concert — call time and uniforms', ts: at(-2, 8, 30), unread: false, folder: 'inbox', category: 'primary',
    body: `Hello musicians and families,\n\nOur Fall Concert is coming up! Call time is 6:00 PM in the band room; the concert begins at 7:00 PM in the auditorium.\n\nUniform: black concert attire.\n\nPercussion: please make sure the percussion bag and mallets are loaded by 6:15.\n\nThank you!\nMs. Thompson`,
    attachments: [{ name: 'Fall-Concert-Program.pdf', size: '412 KB', kind: 'pdf' }],
    facts: { kind: 'event', title: 'Fall Concert', when: '16|18:00', location: 'Lincoln High Auditorium' },
  },
  {
    id: 'mail-dental', from: { name: 'Lee Family Dental', email: 'frontdesk@leedental.example' }, to: 'jamie.park@icloud.example',
    subject: 'Appointment reminder: Tuesday 3:30 PM', ts: at(-2, 11, 0), unread: false, folder: 'inbox', category: 'updates',
    body: `This is a friendly reminder of your cleaning appointment on Tuesday at 3:30 PM with Dr. Lee.\n\n55 Elm St, Maple Grove\n\nReply C to confirm.`,
  },
  {
    id: 'mail-school', from: { name: 'Lincoln High School', email: 'news@lincoln.example' }, to: 'jamie.park@icloud.example',
    subject: 'Weekly Update: Homecoming, club fair, and early release', ts: at(-3, 7, 0), unread: false, folder: 'inbox', category: 'updates',
    body: `This week at Lincoln:\n\n• Early release Wednesday at 1:15 PM\n• Club fair Thursday during lunch\n• Homecoming tickets on sale in the student store\n• Chemistry Unit 3 test Friday for all sections\n\nGo Lions!`,
  },
  {
    id: 'mail-library', from: { name: 'Maple Grove Library', email: 'notices@mgpl.example' }, to: 'jamie.park@icloud.example',
    subject: 'Your hold is ready for pickup', ts: at(-1, 9, 20), unread: true, folder: 'inbox', category: 'updates',
    body: `The item you placed on hold is ready: "Practical Electronics for Inventors".\n\nPickup by: 7 days from today\nBranch: Downtown`,
  },
  {
    id: 'mail-brief', from: { name: 'The Morning Brief', email: 'daily@morningbrief.example' }, to: 'jamie.park@icloud.example',
    subject: 'Storm watch, a record robotics season, and more', ts: now - 7 * HOUR, unread: false, folder: 'inbox', category: 'updates',
    body: `Good morning.\n\nWeather: A line of thunderstorms is expected to move through Maple Grove Thursday evening.\n\nSchools: Student robotics participation is up 30% statewide this year.\n\nCulture: The fall art walk returns downtown this weekend.`,
  },
  {
    id: 'mail-mall', from: { name: 'Greenfield Mall', email: 'offers@greenfield.example' }, to: 'jamie.park@icloud.example',
    subject: 'Fall Sale: up to 40% off this weekend', ts: at(-1, 12, 0), unread: false, folder: 'inbox', category: 'promotions',
    body: 'Our biggest fall sale starts Friday. Sneakers, headphones, and more.',
  },
  {
    id: 'mail-grandma', from: { name: 'Helen Cho', email: 'helen.cho@mail.example' }, to: 'jamie.park@icloud.example',
    subject: 'Photos from the garden', ts: at(-4, 16, 0), unread: false, folder: 'inbox', category: 'primary',
    body: `Hi sweetheart,\n\nThe sunflowers finally bloomed at the new house! I attached a picture. Can't wait to see you Sunday. Bring Biscuit!\n\nLove,\nGrandma`,
    attachments: [{ name: 'sunflowers.jpg', size: '2.1 MB', kind: 'image' }],
  },
  {
    id: 'mail-sent-1', from: { name: 'Jamie Park', email: 'jamie.park@icloud.example' }, to: 'mdelgado@lincoln.example',
    subject: 'Re: Intake CAD', ts: at(-2, 21, 0), unread: false, folder: 'sent', category: 'primary',
    body: 'Hi Mr. Delgado,\n\nI uploaded the latest intake CAD to the team drive. The roller spacing is now 2.5 in.\n\nThanks,\nJamie',
  },
]

export const nextThursdayRobotics = nextWeekday(4, 18, 30, false)
