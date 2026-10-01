import type { Track } from '../types'

/** Fictional artists and songs. Audio is synthesized live by the music engine. */
export const TRACKS: Track[] = [
  { id: 't1', title: 'Tidal', artist: 'Luma Coast', album: 'Salt & Static', duration: 204, bpm: 104, key: 'D', hue: 198, lyrics: ['Pull me under like the tide', 'Every light is on the other side', 'We were static, we were gold', 'Let the salt air make it hold'] },
  { id: 't2', title: 'Afterglow Avenue', artist: 'Luma Coast', album: 'Salt & Static', duration: 188, bpm: 110, key: 'A', hue: 22 },
  { id: 't3', title: 'Paper Satellites', artist: 'The Midnight Ferns', album: 'Low Orbit', duration: 231, bpm: 92, key: 'F', hue: 262, lyrics: ['Folded maps into the sky', 'Paper satellites drifting by', 'Tell me where the signal goes', 'Only the midnight knows'] },
  { id: 't4', title: 'Circuit Hearts', artist: 'Kai Marlowe', album: 'Circuit Hearts', duration: 197, bpm: 122, key: 'E', hue: 330, explicit: false },
  { id: 't5', title: 'Glasshouse', artist: 'Aria Vale', album: 'Glasshouse', duration: 215, bpm: 86, key: 'C', hue: 160 },
  { id: 't6', title: 'Northbound', artist: 'Static Bloom', album: 'Weather Systems', duration: 242, bpm: 128, key: 'G', hue: 48 },
  { id: 't7', title: 'Thunder Season', artist: 'Static Bloom', album: 'Weather Systems', duration: 226, bpm: 118, key: 'Bb', hue: 220 },
  { id: 't8', title: 'Marching Lights', artist: 'Lincoln Drumline', album: 'Fall Cadences', duration: 132, bpm: 120, key: 'C', hue: 0 },
  { id: 't9', title: 'Soft Focus', artist: 'Aria Vale', album: 'Glasshouse', duration: 199, bpm: 78, key: 'Ab', hue: 140 },
  { id: 't10', title: 'Low Orbit', artist: 'The Midnight Ferns', album: 'Low Orbit', duration: 254, bpm: 96, key: 'F#', hue: 250 },
  { id: 't11', title: 'Sunday Drive', artist: 'Kai Marlowe', album: 'Circuit Hearts', duration: 183, bpm: 100, key: 'D', hue: 36 },
  { id: 't12', title: 'Fieldnotes', artist: 'Luma Coast', album: 'Salt & Static', duration: 176, bpm: 90, key: 'G', hue: 186 },
]

export const ARTISTS = [
  { name: 'Luma Coast', hue: 198, bio: 'Coastal indie-pop trio known for shimmering guitars and layered harmonies.', listeners: '2.4M monthly listeners' },
  { name: 'The Midnight Ferns', hue: 262, bio: 'Dream-pop duo recording late-night songs in a converted greenhouse.', listeners: '1.1M monthly listeners' },
  { name: 'Kai Marlowe', hue: 330, bio: 'Singer-songwriter and producer blending synthpop with live drums.', listeners: '3.8M monthly listeners' },
  { name: 'Aria Vale', hue: 160, bio: 'Ambient pianist and vocalist.', listeners: '640K monthly listeners' },
  { name: 'Static Bloom', hue: 48, bio: 'High-energy electronic rock band with weather-inspired albums.', listeners: '1.9M monthly listeners' },
  { name: 'Lincoln Drumline', hue: 0, bio: 'Lincoln High School drumline cadences, recorded live.', listeners: '312 monthly listeners' },
]

export const PLAYLISTS = [
  { id: 'pl-focus', name: 'Study Focus', tracks: ['t5', 't9', 't3', 't10', 't12'], hue: 150, curator: 'Jamie' },
  { id: 'pl-drive', name: 'Robotics Build Night', tracks: ['t4', 't6', 't7', 't2', 't11'], hue: 280, curator: 'Jamie' },
  { id: 'pl-chill', name: 'Sunset Mix', tracks: ['t1', 't2', 't12', 't11', 't9'], hue: 20, curator: 'Apple Music' },
]

export const PODCASTS = [
  {
    id: 'pod-build', title: 'Build Log', author: 'Makers Collective', hue: 30, category: 'Technology',
    description: 'Conversations with student engineers, robotics mentors and hardware hackers.',
    episodes: [
      { id: 'ep1', title: 'Swerve Drive, Explained', date: -2, duration: 2460, summary: 'Why swerve modules took over competition robotics.', transcript: 'Today we talk about swerve drive. Each module can rotate independently, which means the robot can strafe. We also discuss gear ratios, encoders, and why calibration before every match matters.' },
      { id: 'ep2', title: 'Designing an Intake That Never Jams', date: -9, duration: 2210, summary: 'Rollers, compliance wheels and polycord.', transcript: 'The number one failure is a jammed intake. Compliance wheels give you grip without crushing game pieces. Roller spacing is everything; start with two and a half inches and iterate.' },
      { id: 'ep3', title: 'Mentors Who Changed Everything', date: -16, duration: 2890, summary: 'Stories from teams about great advisors.', transcript: 'Our guest describes a teacher who stayed until midnight before every regional. We talk about safety culture, student leadership and budgeting for motors.' },
    ],
  },
  {
    id: 'pod-freq', title: 'Hidden Frequencies', author: 'Night Radio', hue: 280, category: 'Music',
    description: 'The stories behind the sounds you love.',
    episodes: [
      { id: 'ep4', title: 'How Drumlines Stay in Sync', date: -3, duration: 1850, summary: 'Tempo, listening and the center snare.', transcript: 'Drumlines stay in sync by listening in, not out. The center snare drives tempo. Practice with a metronome at 120 bpm and slowly raise it.' },
      { id: 'ep5', title: 'The Science of the Crossfade', date: -12, duration: 2030, summary: 'DJs, beatmatching and automatic mixing.', transcript: 'A good crossfade matches tempo and key. Automatic mixing analyzes the end of one song and the start of the next, then time-stretches so beats align.' },
    ],
  },
  {
    id: 'pod-daily', title: 'The Morning Brief', author: 'Morning Brief Media', hue: 210, category: 'News',
    description: 'Fifteen minutes of news, every weekday.',
    episodes: [
      { id: 'ep6', title: 'Storms, Schools and Space', date: 0, duration: 920, summary: 'Thunderstorms roll in Thursday.', transcript: 'Thunderstorms expected Thursday evening across Maple Grove. Statewide robotics participation is up thirty percent. And a new telescope captures a distant galaxy.' },
      { id: 'ep7', title: 'The Art Walk Returns', date: -1, duration: 880, summary: 'Downtown events this weekend.', transcript: 'The fall art walk returns downtown this weekend with live music and food trucks near Main Street.' },
    ],
  },
]

export const NEWS = [
  { id: 'nw1', source: 'Maple Grove Gazette', title: 'Thunderstorms expected Thursday evening; outdoor events may move indoors', time: '12m ago', hue: 220, category: 'Local', body: 'Forecasters expect a line of thunderstorms to move through the region Thursday between 5 and 9 PM. Gusty winds up to 40 mph are possible. Schools say evening activities will continue indoors.' },
  { id: 'nw2', source: 'Tech Ledger', title: 'Student robotics participation hits a record high', time: '1h ago', hue: 280, category: 'Technology', body: 'State competition organizers report a 30 percent jump in registered teams, driven by new school programs and cheaper parts.' },
  { id: 'nw3', source: 'The Science Desk', title: 'New telescope image reveals a spiral galaxy in stunning detail', time: '3h ago', hue: 250, category: 'Science', body: 'Astronomers released an image showing star-forming regions along the galaxy’s arms.' },
  { id: 'nw4', source: 'Sports Daily', title: 'Local high school soccer teams clinch playoff spots', time: '5h ago', hue: 130, category: 'Sports', body: 'Three teams from the Maple Grove district advanced after weekend wins.' },
  { id: 'nw5', source: 'Culture Weekly', title: 'The fall art walk returns downtown', time: '8h ago', hue: 20, category: 'Culture', body: 'Galleries along Main Street will stay open late Saturday with live music.' },
]

export const STOCKS = [
  { sym: 'ORCH', name: 'Orchard Technologies', price: 262.14, change: 1.84 },
  { sym: 'MGRV', name: 'Maple Grove Energy', price: 48.2, change: -0.62 },
  { sym: 'BOLT', name: 'Bolt Electronics', price: 121.55, change: 2.31 },
  { sym: 'SKYW', name: 'Skyward Airlines', price: 33.9, change: -1.12 },
  { sym: 'MGX', name: 'Maple Grove Index', price: 4621.4, change: 0.41 },
  { sym: 'TECH', name: 'Demo Tech 100', price: 6702.3, change: 0.36 },
]
