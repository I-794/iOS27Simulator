import type { HomeAccessory, WalletCard, SafariTab, Shortcut, ScreenTimeConfig } from '../types'
import { at, HOUR } from '../time'

export const HOME_ROOMS = ['Living Room', 'Kitchen', 'Jamie’s Room', 'Garage', 'Front Porch', 'Backyard']

export const ACCESSORIES: HomeAccessory[] = [
  { id: 'h-lr-lamp', name: 'Floor Lamp', room: 'Living Room', kind: 'light', on: true, brightness: 70, color: '#ffd28a', thread: true },
  { id: 'h-lr-ceiling', name: 'Ceiling Lights', room: 'Living Room', kind: 'light', on: false, brightness: 100, color: '#fff4e0', thread: true },
  { id: 'h-lr-tv', name: 'Living Room TV', room: 'Living Room', kind: 'tv', on: false },
  { id: 'h-lr-blinds', name: 'Blinds', room: 'Living Room', kind: 'blinds', value: '60% open' },
  { id: 'h-therm', name: 'Thermostat', room: 'Living Room', kind: 'thermostat', temp: 70, target: 71, mode: 'auto', thread: true },
  { id: 'h-k-pendants', name: 'Pendants', room: 'Kitchen', kind: 'light', on: true, brightness: 45, color: '#ffe0b0', thread: true },
  { id: 'h-k-outlet', name: 'Coffee Maker', room: 'Kitchen', kind: 'outlet', on: false },
  { id: 'h-j-desk', name: 'Desk Lamp', room: 'Jamie’s Room', kind: 'light', on: true, brightness: 90, color: '#c8e4ff', thread: true },
  { id: 'h-j-strip', name: 'LED Strip', room: 'Jamie’s Room', kind: 'light', on: true, brightness: 60, color: '#b56bff', thread: true },
  { id: 'h-j-fan', name: 'Fan', room: 'Jamie’s Room', kind: 'fan', on: false },
  { id: 'h-j-speaker', name: 'HomePod mini', room: 'Jamie’s Room', kind: 'speaker', on: false },
  { id: 'h-g-door', name: 'Garage Door', room: 'Garage', kind: 'garage', locked: true, value: 'Closed' },
  { id: 'h-fp-lock', name: 'Front Door', room: 'Front Porch', kind: 'lock', locked: true, battery: 82, thread: true },
  { id: 'h-fp-light', name: 'Porch Light', room: 'Front Porch', kind: 'light', on: false, brightness: 100, color: '#fff0d0' },
  { id: 'h-fp-cam', name: 'Front Door', room: 'Front Porch', kind: 'camera', on: true },
  { id: 'h-dw-cam', name: 'Driveway', room: 'Garage', kind: 'camera', on: true },
  { id: 'h-by-cam', name: 'Backyard', room: 'Backyard', kind: 'camera', on: true },
  { id: 'h-by-sensor', name: 'Gate Sensor', room: 'Backyard', kind: 'sensor', value: 'Closed', battery: 64, thread: true },
]

export const HOME_SCENES = [
  { id: 'sc-morning', name: 'Good Morning', icon: 'sun', color: '#ffb800', set: { 'h-k-pendants': true, 'h-lr-lamp': true, 'h-j-desk': true } },
  { id: 'sc-leave', name: 'Leave Home', icon: 'door', color: '#5ac8fa', set: { 'h-lr-lamp': false, 'h-lr-ceiling': false, 'h-k-pendants': false, 'h-j-desk': false, 'h-j-strip': false, 'h-fp-lock': 'lock' } },
  { id: 'sc-arrive', name: 'Arrive Home', icon: 'home', color: '#34c759', set: { 'h-lr-lamp': true, 'h-fp-light': true } },
  { id: 'sc-night', name: 'Good Night', icon: 'moon', color: '#5856d6', set: { 'h-lr-lamp': false, 'h-lr-ceiling': false, 'h-k-pendants': false, 'h-j-desk': false, 'h-j-strip': false, 'h-fp-lock': 'lock', 'h-fp-light': true } },
  { id: 'sc-focus', name: 'Study Mode', icon: 'book', color: '#ff9500', set: { 'h-j-desk': true, 'h-j-strip': false, 'h-j-speaker': false } },
]

export const WALLET_CARDS: WalletCard[] = [
  { id: 'w-cash', kind: 'cash', name: 'Apple Cash', issuer: 'Cash', balance: '$42.50', gradient: 'linear-gradient(135deg,#1c1c1e,#3a3a3c)', textColor: '#fff' },
  { id: 'w-debit', kind: 'debit', name: 'Maple CU Student Debit', issuer: 'Maple Credit Union', last4: '4417', gradient: 'linear-gradient(135deg,#0d6e4f,#34c78f)', textColor: '#fff', balance: '$318.22' },
  { id: 'w-credit', kind: 'credit', name: 'Northstar Rewards', issuer: 'Northstar Bank (Demo)', last4: '9021', gradient: 'linear-gradient(135deg,#1b2a6b,#5b6be8 60%,#9fa9ff)', textColor: '#fff' },
  { id: 'w-transit', kind: 'transit', name: 'Metro Transit', issuer: 'Maple Grove Metro', balance: '$12.75', gradient: 'linear-gradient(135deg,#ff9500,#ffcc00)', textColor: '#1c1c1e' },
  { id: 'w-boarding', kind: 'ticket', name: 'Boarding Pass', issuer: 'Skyward Airlines', gradient: 'linear-gradient(160deg,#0a3d91,#0a84ff)', textColor: '#fff', details: { Flight: 'SK 482', From: 'MGR', To: 'SEA', Seat: '14C', Gate: 'B7', Boards: '8:10 AM', Confirmation: '7XKQ2P' } },
  { id: 'w-concert', kind: 'ticket', name: 'Fall Concert', issuer: 'Lincoln High Music', gradient: 'linear-gradient(160deg,#6d1b3b,#ff2d55)', textColor: '#fff', details: { Section: 'Performer', Doors: '6:30 PM', Venue: 'Lincoln High Auditorium' } },
  { id: 'w-student', kind: 'id', name: 'Student ID', issuer: 'Lincoln High School', gradient: 'linear-gradient(160deg,#7a1f1f,#c0392b)', textColor: '#fff', details: { Name: 'Jamie Park', ID: 'LHS-204417', Grade: '11', Valid: '2026–2027' } },
  { id: 'w-coffee', kind: 'loyalty', name: 'Brew Lab Rewards', issuer: 'Brew Lab Coffee', gradient: 'linear-gradient(160deg,#5b3a1e,#a0673a)', textColor: '#fff', details: { Stars: '7 / 10', Member: 'Since 2025' } },
]

export const ORDERS = [
  { id: 'o1', merchant: 'Bolt Electronics', item: 'Single-board computer starter kit', status: 'Shipped', eta: 'Arriving Friday', progress: 0.6, number: 'BE-58213' },
  { id: 'o2', merchant: 'Greenfield Outfitters', item: 'Rain jacket', status: 'Delivered', eta: 'Delivered Monday', progress: 1, number: 'GO-11820' },
]

export const PASSWORDS = [
  { id: 'pw1', site: 'schoolportal.example', user: 'jpark27', strength: 'strong', compromised: false, reused: false, passkey: true, updated: -40 },
  { id: 'pw2', site: 'robotics-forum.example', user: 'jamie_builds', strength: 'weak', compromised: false, reused: true, passkey: false, upgradeEligible: true, updated: -400 },
  { id: 'pw3', site: 'streamly.example', user: 'jamie.park@icloud.example', strength: 'medium', compromised: true, reused: false, passkey: false, upgradeEligible: true, updated: -700 },
  { id: 'pw4', site: 'gamezone.example', user: 'BiscuitFan', strength: 'weak', compromised: false, reused: true, passkey: false, upgradeEligible: false, updated: -500 },
  { id: 'pw5', site: 'mgpl.example', user: 'jamie.park', strength: 'strong', compromised: false, reused: false, passkey: false, updated: -30 },
  { id: 'pw6', site: 'brewlab.example', user: 'jamie.park@icloud.example', strength: 'strong', compromised: false, reused: false, passkey: true, updated: -90 },
  { id: 'pw7', site: 'Home Wi-Fi (ParkNet)', user: 'Wi-Fi', strength: 'strong', compromised: false, reused: false, passkey: false, updated: -200, wifi: true },
]

export const SAFARI_SITES: Record<string, { title: string; topic: string; kind: string }> = {
  'weather.example/maple-grove': { title: 'Maple Grove 10-Day Forecast', topic: 'Weather', kind: 'weather' },
  'stormwatch.example/radar': { title: 'StormWatch Live Radar', topic: 'Weather', kind: 'weather' },
  'chemreview.example/unit-3': { title: 'Unit 3 Review: Stoichiometry', topic: 'School', kind: 'article' },
  'lincoln.example/calendar': { title: 'Lincoln High — Events Calendar', topic: 'School', kind: 'school' },
  'bolt.example/headphones-x2': { title: 'Aurora X2 Headphones — Bolt Electronics', topic: 'Shopping', kind: 'product' },
  'bolt.example/sbc-kit': { title: 'Single-Board Computer Starter Kit', topic: 'Shopping', kind: 'product' },
  'robotics-forum.example/swerve': { title: 'Swerve Module Tuning Guide', topic: 'Robotics', kind: 'article' },
  'partsdepot.example/motors': { title: 'Brushless Motors — Parts Depot', topic: 'Robotics', kind: 'product' },
  'morningbrief.example/today': { title: 'The Morning Brief — Today', topic: 'News', kind: 'news' },
  'tunedaily.example/luma-coast': { title: 'Luma Coast announces fall tour', topic: 'Music', kind: 'article' },
  'gamezone.example': { title: 'GameZone — Play Free Games', topic: 'Games', kind: 'blocked' },
  'videotube.example': { title: 'VideoTube', topic: 'Entertainment', kind: 'blocked' },
}

export const SAFARI_TABS: SafariTab[] = Object.entries(SAFARI_SITES)
  .filter(([, s]) => s.kind !== 'blocked')
  .map(([url, s], i) => ({ id: `tab-${i}`, url, title: s.title, ts: Date.now() - i * HOUR }))

export const BOOKMARKS = [
  { title: 'Lincoln High', url: 'lincoln.example/calendar' },
  { title: 'Chem Review', url: 'chemreview.example/unit-3' },
  { title: 'Swerve Guide', url: 'robotics-forum.example/swerve' },
  { title: 'Weather', url: 'weather.example/maple-grove' },
  { title: 'Bolt', url: 'bolt.example/headphones-x2' },
  { title: 'Morning Brief', url: 'morningbrief.example/today' },
]

export const SHORTCUTS: Shortcut[] = [
  {
    id: 'sh-home', name: 'Heading Home', color: '#34c759', icon: 'home', trigger: 'When I leave Lincoln High School',
    actions: [
      { id: 'x1', kind: 'eta', label: 'Get ETA', params: { to: 'Home', mode: 'Driving' } },
      { id: 'x2', kind: 'message', label: 'Send Message', params: { to: 'Dad', text: 'Heading home! ETA [ETA]' } },
    ],
  },
  {
    id: 'sh-study', name: 'Study Mode', color: '#ff9500', icon: 'book',
    actions: [
      { id: 'x3', kind: 'focus', label: 'Set Focus', params: { focus: 'Study', until: '2 hours' } },
      { id: 'x4', kind: 'scene', label: 'Run Home Scene', params: { scene: 'Study Mode' } },
      { id: 'x5', kind: 'music', label: 'Play Playlist', params: { playlist: 'Study Focus' } },
    ],
  },
  {
    id: 'sh-shot', name: 'Log Robotics Screenshot', color: '#af52de', icon: 'camera', trigger: 'When I take a screenshot in Safari',
    actions: [
      { id: 'x6', kind: 'screen', label: 'Get What’s On Screen', params: { include: 'Text, Images, Links' } },
      { id: 'x7', kind: 'note', label: 'Append to Note', params: { note: 'Robotics Build Log' } },
    ],
  },
  {
    id: 'sh-laundry', name: 'Water Plants', color: '#30b0c7', icon: 'drop',
    actions: [{ id: 'x8', kind: 'reminder', label: 'Add Reminder', params: { title: 'Water the monstera', when: 'Every Sunday' } }],
  },
]

export const DEFAULT_SCREEN_TIME: ScreenTimeConfig = {
  childMode: false,
  childName: 'Mia',
  allowedApps: ['phone', 'messages', 'safari', 'music', 'camera', 'photos', 'calendar', 'clock', 'weather', 'maps', 'notes', 'reminders', 'facetime', 'settings', 'podcasts', 'freeform', 'calculator', 'journal', 'fitness', 'health', 'games'],
  askToBrowse: true,
  approvedSites: ['lincoln.example', 'chemreview.example', 'weather.example', 'morningbrief.example', 'tunedaily.example', 'robotics-forum.example', 'bolt.example', 'partsdepot.example', 'stormwatch.example'],
  pendingRequests: [],
  communicationSafety: true,
  allowances: [
    { category: 'Entertainment', minutes: 60, used: 38, enabled: true },
    { category: 'Games', minutes: 45, used: 45, enabled: true },
    { category: 'Social', minutes: 30, used: 12, enabled: true },
    { category: 'Creativity', minutes: 120, used: 20, enabled: false },
    { category: 'Education', minutes: 240, used: 64, enabled: false },
  ],
  schedules: [
    { id: 'sch-school', name: 'School Hours', start: '08:00', end: '15:00', days: 'weekdays', apps: ['games', 'podcasts', 'music'], enabled: true },
    { id: 'sch-bed', name: 'Bedtime', start: '21:30', end: '07:00', days: 'everyday', apps: ['games', 'safari', 'music', 'podcasts', 'photos'], enabled: true },
    { id: 'sch-weekend', name: 'Weekend Mornings', start: '07:00', end: '09:00', days: 'weekends', apps: ['games'], enabled: false },
  ],
  downtime: false,
}

export const SCREEN_TIME_USAGE = {
  dailyAverage: 214,
  week: [182, 240, 196, 205, 260, 230, 187],
  apps: [
    { app: 'messages', minutes: 52, category: 'Social' },
    { app: 'safari', minutes: 38, category: 'Education' },
    { app: 'music', minutes: 34, category: 'Entertainment' },
    { app: 'games', minutes: 31, category: 'Games' },
    { app: 'photos', minutes: 18, category: 'Creativity' },
    { app: 'notes', minutes: 15, category: 'Education' },
    { app: 'maps', minutes: 9, category: 'Travel' },
  ],
  pickups: 71,
  notifications: 143,
}

export const WEATHER = {
  city: 'Maple Grove',
  temp: 68,
  condition: 'Partly Cloudy',
  high: 72,
  low: 55,
  feels: 67,
  humidity: 58,
  wind: '8 mph NW',
  uv: 4,
  aqi: 31,
  visibility: '10 mi',
  pressure: '29.92 inHg',
  sunrise: '7:02 AM',
  sunset: '6:48 PM',
  summary: 'Partly cloudy through the afternoon. Thunderstorms likely Thursday evening.',
  hourly: Array.from({ length: 24 }, (_, i) => {
    const h = (new Date().getHours() + i) % 24
    const t = Math.round(62 + 9 * Math.sin(((h - 9) / 24) * Math.PI * 2))
    const icon = h >= 19 || h < 7 ? (i > 14 ? 'cloud-moon' : 'moon') : i > 4 && i < 9 ? 'cloud-sun' : 'sun'
    return { h, t, icon, pop: i > 10 && i < 14 ? 20 : 0 }
  }),
  daily: [
    { d: 'Today', icon: 'cloud-sun', lo: 55, hi: 72, pop: 0 },
    { d: '+1', icon: 'sun', lo: 54, hi: 74, pop: 0 },
    { d: '+2', icon: 'cloud-bolt', lo: 58, hi: 70, pop: 80 },
    { d: '+3', icon: 'cloud-rain', lo: 52, hi: 63, pop: 60 },
    { d: '+4', icon: 'cloud', lo: 49, hi: 61, pop: 10 },
    { d: '+5', icon: 'sun', lo: 47, hi: 64, pop: 0 },
    { d: '+6', icon: 'sun', lo: 50, hi: 67, pop: 0 },
    { d: '+7', icon: 'cloud-sun', lo: 53, hi: 69, pop: 10 },
    { d: '+8', icon: 'cloud-rain', lo: 51, hi: 60, pop: 70 },
    { d: '+9', icon: 'cloud', lo: 48, hi: 58, pop: 20 },
  ],
  cities: [
    { city: 'Seattle', temp: 57, condition: 'Rain', hi: 59, lo: 50 },
    { city: 'Cupertino', temp: 78, condition: 'Sunny', hi: 83, lo: 57 },
    { city: 'Seoul', temp: 64, condition: 'Clear', hi: 70, lo: 55 },
  ],
}

export const MAP_PLACES = [
  { id: 'home', name: 'Home', address: '84 Birchwood Lane', x: 240, y: 620, kind: 'home', rating: 0 },
  { id: 'school', name: 'Lincoln High School', address: '1200 Lincoln Ave', x: 560, y: 300, kind: 'school', rating: 4.3 },
  { id: 'brewlab', name: 'Brew Lab Coffee', address: '410 Oak Ave', x: 470, y: 470, kind: 'coffee', rating: 4.7, hours: 'Open until 6 PM' },
  { id: 'bean', name: 'The Daily Bean', address: '88 River Rd', x: 690, y: 560, kind: 'coffee', rating: 4.2, hours: 'Open until 8 PM' },
  { id: 'rosas', name: "Rosa's Trattoria", address: '218 Main St', x: 380, y: 360, kind: 'restaurant', rating: 4.6, hours: 'Open until 10 PM' },
  { id: 'park', name: 'Riverside Park', address: 'River Rd', x: 640, y: 700, kind: 'park', rating: 4.8 },
  { id: 'mall', name: 'Greenfield Mall', address: '5000 Greenfield Pkwy', x: 820, y: 240, kind: 'shopping', rating: 4.0 },
  { id: 'library', name: 'Maple Grove Library', address: '15 Civic Plaza', x: 330, y: 250, kind: 'library', rating: 4.5 },
  { id: 'grandma', name: 'Grandma’s House', address: '1420 Willow Creek Dr', x: 120, y: 280, kind: 'home', rating: 0 },
  { id: 'airport', name: 'Maple Grove Regional Airport', address: 'MGR', x: 900, y: 820, kind: 'airport', rating: 3.9 },
  { id: 'dentist', name: 'Lee Family Dental', address: '55 Elm St', x: 300, y: 450, kind: 'health', rating: 4.9 },
]

export const VISITED = [
  { place: 'Lincoln High School', when: at(0, 7, 55), duration: '7 hr 5 min' },
  { place: 'Brew Lab Coffee', when: at(-1, 15, 20), duration: '25 min' },
  { place: 'Riverside Park', when: at(-3, 16, 0), duration: '1 hr 10 min' },
  { place: "Rosa's Trattoria", when: at(-3, 18, 55), duration: '1 hr 30 min' },
  { place: 'Westfield High', when: at(-4, 8, 40), duration: '6 hr 20 min' },
  { place: 'Pelican Cove Beach', when: at(-8, 16, 30), duration: '2 hr 45 min' },
]

export const FINDMY = {
  people: [
    { id: 'mom', name: 'Mom', place: 'Work — Downtown', distance: '3.2 mi', updated: 'Now', x: 600, y: 200 },
    { id: 'dad', name: 'Dad', place: 'Driving on I-5', distance: '12 mi', updated: '2 min ago', x: 880, y: 500 },
    { id: 'alex', name: 'Alex Rivera', place: 'Lincoln High School', distance: '1.1 mi', updated: 'Now', x: 560, y: 300, precision: true },
    { id: 'mia', name: 'Mia', place: 'Riverside Park Fields', distance: '0.8 mi', updated: '1 min ago', x: 640, y: 700, precision: true },
  ],
  devices: [
    { id: 'iphone', name: 'Jamie’s iPhone', kind: 'iphone', place: 'With You', battery: 78 },
    { id: 'airpods', name: 'Jamie’s AirPods Pro 3', kind: 'airpods', place: 'With You', battery: 64 },
    { id: 'ipad', name: 'Jamie’s iPad', kind: 'ipad', place: 'Home', battery: 41 },
    { id: 'mac', name: 'Family iMac', kind: 'mac', place: 'Home', battery: 100 },
  ],
  items: [
    { id: 'keys', name: 'Keys', emoji: '🔑', place: 'Home', updated: '5 min ago' },
    { id: 'backpack', name: 'Backpack', emoji: '🎒', place: 'Lincoln High School', updated: '20 min ago' },
    { id: 'percbag', name: 'Percussion Bag', emoji: '🥁', place: 'Band Room', updated: '1 hr ago' },
    { id: 'collar', name: 'Biscuit’s Collar', emoji: '🐕', place: 'Home — Backyard', updated: 'Now' },
  ],
}

export const HEALTH = {
  steps: 7412,
  stepGoal: 10000,
  distance: 3.4,
  flights: 9,
  heartRate: 72,
  restingHR: 61,
  sleep: { hours: 7.6, bedtime: '10:58 PM', wake: '6:34 AM', tz: 'America/Los_Angeles' },
  weekSteps: [8210, 10230, 6602, 9120, 12004, 5310, 7412],
  move: { value: 420, goal: 500 },
  exercise: { value: 34, goal: 30 },
  stand: { value: 9, goal: 12 },
  workouts: [
    { id: 'wk1', kind: 'Outdoor Run', when: at(-1, 7, 0), duration: '32:10', distance: '3.1 mi', hr: 152, route: true },
    { id: 'wk2', kind: 'Indoor Run (Treadmill)', when: at(-3, 18, 0), duration: '25:00', distance: '2.6 mi', hr: 146, calibrated: true },
    { id: 'wk3', kind: 'Walk with Biscuit', when: at(-2, 17, 30), duration: '41:00', distance: '1.9 mi', hr: 98, route: true },
    { id: 'wk4', kind: 'Drumline Practice (Other)', when: at(-1, 15, 30), duration: '1:55:00', distance: '—', hr: 121 },
  ],
}

export const FILES = [
  { id: 'f1', name: 'Intake CAD v7.step', folder: 'Robotics', size: '14.2 MB', kind: 'cad', modified: at(-2, 21, 0) },
  { id: 'f2', name: 'Regional Qualifier Rules.pdf', folder: 'Robotics', size: '2.4 MB', kind: 'pdf', modified: at(-10, 9, 0) },
  { id: 'f3', name: 'Chem Lab Report Draft.pages', folder: 'School', size: '380 KB', kind: 'doc', modified: at(-1, 22, 10) },
  { id: 'f4', name: 'Unit 3 Worksheet.pdf', folder: 'School', size: '1.1 MB', kind: 'pdf', modified: at(-3, 15, 0) },
  { id: 'f5', name: 'Fall-Concert-Program.pdf', folder: 'Downloads', size: '412 KB', kind: 'pdf', modified: at(-2, 8, 31) },
  { id: 'f6', name: 'Itinerary-7XKQ2P.pdf', folder: 'Downloads', size: '184 KB', kind: 'pdf', modified: at(-6, 10, 2) },
  { id: 'f7', name: 'Cadence 3 Sheet Music.pdf', folder: 'Band', size: '860 KB', kind: 'pdf', modified: at(-12, 18, 0) },
  { id: 'f8', name: 'Robot Budget 2026.numbers', folder: 'Robotics', size: '220 KB', kind: 'sheet', modified: at(-7, 20, 0) },
  { id: 'f9', name: 'Team Photo.heic', folder: 'Robotics', size: '3.2 MB', kind: 'image', modified: at(-4, 13, 0) },
  { id: 'f10', name: 'Scan — Permission Slip.pdf', folder: 'School', size: '640 KB', kind: 'pdf', modified: at(-5, 7, 45) },
]
