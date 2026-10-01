import type { Photo, SharedAlbum, CameraClip } from '../types'
import { at, HOUR, MIN } from '../time'

type Seed = [id: string, scene: string, day: number, hour: number, opts: Partial<Photo>]

const P = (portrait = false) => (portrait ? { width: 3024, height: 4032 } : { width: 4032, height: 3024 })

const seeds: Seed[] = [
  ['p-biscuit-couch', 'dog-couch', -1, 20, { pets: ['Biscuit'], keywords: ['dog', 'couch', 'sleepy', 'home', 'golden retriever'], description: 'Biscuit, a golden retriever, curled up asleep on a gray couch with a blanket.', favorite: true, rating: 5, place: 'Home', kind: 'portrait', ...P(true) }],
  ['p-drumline', 'drumline', -1, 17, { people: ['sam', 'leo', 'priya'], keywords: ['band', 'drumline', 'snare', 'practice', 'field', 'music'], description: 'Three drumline members with snare and tenor drums on a practice field in afternoon light.', place: 'Lincoln High Practice Field', capturedByMe: false, rating: 4 }],
  ['p-robot-workshop', 'robot-workshop', -2, 19, { people: ['alex'], keywords: ['robot', 'robotics', 'workshop', 'intake', 'engineering', 'build'], description: 'A competition robot with an orange roller intake on a workbench surrounded by tools.', place: 'Lincoln High Room 114', favorite: true, rating: 4, capturedByMe: false }],
  ['p-handwritten', 'handwritten', -2, 16, { keywords: ['note', 'handwriting', 'list', 'paper', 'text'], description: 'Handwritten note on lined paper: "Robotics — bring zip ties, laptop charger, safety glasses. Thurs 6:30!"', place: 'Lincoln High School', ...P(true) }],
  ['p-pizza', 'food-pizza', -3, 19, { keywords: ['food', 'pizza', 'dinner', 'restaurant', 'italian'], description: 'Margherita pizza with basil on a wooden board.', place: "Rosa's Trattoria", rating: 3 }],
  ['p-receipt', 'receipt', -3, 20, { keywords: ['receipt', 'restaurant', 'bill', 'total', 'document'], description: "Receipt from Rosa's Trattoria: total $86.40 including tip.", place: "Rosa's Trattoria", ...P(true) }],
  ['p-biscuit-park', 'dog-park', -3, 16, { pets: ['Biscuit'], keywords: ['dog', 'park', 'grass', 'fetch', 'ball', 'golden retriever'], description: 'Biscuit running across green grass with a tennis ball.', place: 'Riverside Park', favorite: true, rating: 5 }],
  ['p-sunflowers', 'plant-sunflower', -4, 15, { people: ['grandma'], keywords: ['flowers', 'sunflower', 'garden', 'yellow', 'plant'], description: 'Tall sunflowers in Grandma’s garden under a blue sky.', place: '1420 Willow Creek Dr', capturedByMe: false, ...P(true) }],
  ['p-robot-comp', 'robot-arena', -4, 13, { people: ['alex', 'nora'], keywords: ['robot', 'robotics', 'competition', 'scrimmage', 'arena', 'team'], description: 'Robots competing on a field with blue and red alliance walls at the scrimmage.', place: 'Westfield High', rating: 4 }],
  ['p-family-dinner', 'family-dinner', -5, 18, { people: ['mom', 'dad', 'mia', 'grandma'], keywords: ['family', 'dinner', 'table', 'food', 'candles'], description: 'Family dinner table with candles and serving dishes.', place: 'Home', favorite: true }],
  ['p-autumn', 'autumn-trees', -6, 11, { keywords: ['autumn', 'fall', 'trees', 'leaves', 'orange', 'path', 'nature'], description: 'Path through orange and red autumn trees.', place: 'Riverside Park', rating: 4, ...P(true) }],
  ['p-biscuit-beach', 'dog-beach', -8, 18, { pets: ['Biscuit'], keywords: ['dog', 'beach', 'ocean', 'waves', 'sunset', 'golden retriever', 'summer'], description: 'Biscuit running along the shoreline at sunset with waves behind her.', place: 'Pelican Cove Beach', favorite: true, rating: 5 }],
  ['p-beach-sunset', 'sunset-beach', -8, 19, { keywords: ['beach', 'sunset', 'ocean', 'sky', 'orange', 'waves'], description: 'Sun setting over the ocean with pink and orange clouds.', place: 'Pelican Cove Beach', rating: 5 }],
  ['p-monstera', 'plant-monstera', -10, 9, { keywords: ['plant', 'monstera', 'leaf', 'houseplant', 'green'], description: 'Monstera deliciosa houseplant in a white pot by a window.', place: 'Home', ...P(true) }],
  ['p-storm', 'storm', -12, 18, { keywords: ['storm', 'lightning', 'clouds', 'weather', 'thunderstorm', 'sky', 'dark'], description: 'Dark storm clouds with a lightning bolt over a field.', place: 'Maple Grove', rating: 4 }],
  ['p-headphones', 'product-headphones', -14, 14, { keywords: ['headphones', 'product', 'audio', 'music', 'electronics'], description: 'Over-ear headphones in sage green on a white desk.', place: 'Greenfield Mall' }],
  ['p-ramen', 'food-ramen', -15, 19, { keywords: ['food', 'ramen', 'noodles', 'soup', 'egg', 'dinner'], description: 'Bowl of ramen with soft egg, scallions and chashu.', place: 'Noodle Bar' }],
  ['p-screenshot-chart', 'screenshot-chart', -16, 22, { kind: 'screenshot', keywords: ['screenshot', 'chart', 'graph', 'data', 'robotics'], description: 'Screenshot of a bar chart: team points per match rising from 42 to 88 over six matches.', ...P(true) }],
  ['p-pancakes', 'food-pancakes', -20, 9, { keywords: ['food', 'breakfast', 'pancakes', 'berries', 'syrup'], description: 'Stack of pancakes with blueberries and syrup.', place: 'Home' }],
  ['p-soccer', 'soccer-field', -21, 17, { people: ['mia'], keywords: ['soccer', 'sports', 'field', 'game', 'ball'], description: 'Mia dribbling a soccer ball during a game.', place: 'Riverside Park Fields' }],
  ['p-sneakers', 'product-sneakers', -25, 13, { keywords: ['shoes', 'sneakers', 'product', 'white', 'fashion'], description: 'A pair of white and blue sneakers.', place: 'Greenfield Mall' }],
  ['p-selfie', 'selfie-group', -27, 15, { people: ['me', 'priya', 'sam'], keywords: ['selfie', 'friends', 'smile', 'fair'], description: 'Selfie with Priya and Sam at the county fair, Ferris wheel behind.', place: 'County Fair', favorite: true, kind: 'photo', ...P(true) }],
  ['p-coffee', 'food-coffee', -30, 8, { keywords: ['coffee', 'latte', 'cafe', 'drink', 'latte art'], description: 'Latte with a heart in the foam on a wooden table.', place: 'Brew Lab Coffee', ...P(true) }],
  ['p-city-night', 'city-night', -40, 21, { keywords: ['city', 'night', 'skyline', 'lights', 'buildings'], description: 'City skyline at night with lit windows reflected in a river.', place: 'Downtown Maple Grove', rating: 3 }],
  ['p-mochi', 'cat-window', -44, 10, { pets: ['Mochi'], keywords: ['cat', 'window', 'sunlight', 'pet'], description: 'Mochi, Grandma’s gray tabby cat, sitting in a sunny window.', place: '1420 Willow Creek Dr', ...P(true) }],
  ['p-mountains', 'mountain-lake', -60, 7, { keywords: ['mountains', 'lake', 'reflection', 'nature', 'hiking', 'landscape'], description: 'Snow-capped mountains reflected in a calm alpine lake.', place: 'Glacier Point Trail', rating: 5, favorite: true }],
  ['p-panorama', 'panorama-canyon', -62, 12, { kind: 'panorama', keywords: ['canyon', 'panorama', 'desert', 'landscape', 'rocks'], description: 'Panorama of red canyon walls.', place: 'Red Rock Canyon', width: 8000, height: 2400 }],
  ['p-fireworks', 'fireworks', -88, 22, { keywords: ['fireworks', 'night', 'celebration', 'sky'], description: 'Fireworks bursting over a lake.', place: 'Maple Grove Lake' }],
  ['p-bridge', 'landmark-bridge', -90, 17, { keywords: ['bridge', 'landmark', 'suspension bridge', 'fog', 'travel'], description: 'Red suspension bridge towers rising above low fog.', place: 'Bay Crossing Bridge', rating: 4 }],
  ['p-desert', 'desert', -100, 18, { keywords: ['desert', 'dunes', 'sand', 'sunset', 'landscape'], description: 'Sand dunes at sunset with long shadows.', place: 'Dune Valley' }],
  ['p-lighthouse', 'landmark-lighthouse', -120, 16, { keywords: ['lighthouse', 'landmark', 'coast', 'ocean', 'rocks'], description: 'Striped lighthouse on a rocky point.', place: 'Point Harbor Lighthouse', ...P(true) }],
  ['p-night-sky', 'night-sky', -130, 23, { keywords: ['stars', 'night', 'milky way', 'sky', 'astrophotography'], description: 'Milky Way over pine silhouettes.', place: 'Glacier Point Trail', ...P(true), rating: 5 }],
  ['p-waterfall', 'waterfall', -150, 11, { keywords: ['waterfall', 'nature', 'rocks', 'forest', 'water'], description: 'Waterfall pouring into a mossy pool.', place: 'Silver Falls', ...P(true) }],
  ['p-garden', 'garden', -160, 10, { keywords: ['garden', 'flowers', 'tulips', 'spring'], description: 'Rows of pink and red tulips.', place: 'Botanic Garden' }],
  ['p-rainbow', 'rainbow', -170, 18, { keywords: ['rainbow', 'weather', 'sky', 'field', 'rain'], description: 'Double rainbow over a green field after rain.', place: 'Maple Grove' }],
  ['p-biscuit-snow', 'dog-snow', -280, 12, { pets: ['Biscuit'], keywords: ['dog', 'snow', 'winter', 'golden retriever'], description: 'Biscuit with snow on her nose.', place: 'Home', favorite: true, ...P(true) }],
  ['p-snow-cabin', 'snow-cabin', -285, 16, { keywords: ['snow', 'cabin', 'winter', 'trees', 'mountains'], description: 'Wooden cabin in snowy pines.', place: 'Pine Ridge' }],
  ['p-concert', 'concert-lights', -200, 21, { keywords: ['concert', 'music', 'lights', 'stage', 'crowd'], description: 'Stage lights over a crowd at a concert.', place: 'Harbor Amphitheater' }],
  ['p-student-id', 'id-student', -35, 9, { kind: 'screenshot', idDocument: true, keywords: ['id', 'student id', 'card', 'document', 'school'], description: 'Photo of Lincoln High student ID card for Jamie Park.', place: 'Lincoln High School' }],
  ['p-permit', 'id-permit', -70, 15, { idDocument: true, keywords: ['id', 'permit', 'license', 'document', 'driving'], description: "Photo of a learner's permit (sample document).", place: 'DMV' }],
  ['p-screenshot-boarding', 'screenshot-boarding', -6, 10, { kind: 'screenshot', keywords: ['screenshot', 'boarding pass', 'flight', 'travel', 'skyward'], description: 'Screenshot of Skyward Airlines itinerary SK 482, confirmation 7XKQ2P.', ...P(true) }],
  ['v-cadence', 'drumline', -1, 18, { kind: 'video', duration: 94, people: ['sam', 'leo', 'priya'], keywords: ['video', 'drumline', 'cadence', 'music', 'practice'], description: 'Video of the drumline playing cadence 3.', place: 'Lincoln High Practice Field', capturedByMe: false }],
  ['v-fetch', 'dog-park', -3, 16, { kind: 'video', duration: 22, pets: ['Biscuit'], keywords: ['video', 'dog', 'fetch', 'park'], description: 'Video of Biscuit playing fetch.', place: 'Riverside Park' }],
  ['v-robot-auto', 'robot-arena', -4, 14, { kind: 'video', duration: 41, keywords: ['video', 'robot', 'autonomous', 'competition'], description: 'Video of the robot running its autonomous routine.', place: 'Westfield High' }],
  ['p-bike', 'bicycle', -48, 17, { keywords: ['bike', 'bicycle', 'street', 'ride'], description: 'Blue bicycle leaning against a brick wall.', place: 'Downtown Maple Grove', ...P(true) }],
]

export const PHOTOS: Photo[] = seeds.map(([id, scene, day, hour, o]) => ({
  id,
  scene,
  ts: at(day, hour, (id.length * 7) % 60),
  kind: 'photo',
  keywords: [],
  capturedByMe: true,
  description: '',
  width: 4032,
  height: 3024,
  sizeMB: +(2 + ((id.length * 13) % 30) / 10).toFixed(1),
  camera: 'iPhone Pro',
  lens: 'Main Camera — 24 mm ƒ1.78',
  aperture: 'ƒ1.78',
  iso: 50 + ((id.length * 31) % 400),
  ...o,
}))

export const PEOPLE_AND_PETS = [
  { id: 'Biscuit', kind: 'pet' as const, name: 'Biscuit', species: 'Dog' },
  { id: 'Mochi', kind: 'pet' as const, name: 'Mochi', species: 'Cat' },
  { id: 'alex', kind: 'person' as const, name: 'Alex Rivera' },
  { id: 'mom', kind: 'person' as const, name: 'Mom' },
  { id: 'dad', kind: 'person' as const, name: 'Dad' },
  { id: 'mia', kind: 'person' as const, name: 'Mia' },
  { id: 'grandma', kind: 'person' as const, name: 'Grandma' },
  { id: 'sam', kind: 'person' as const, name: 'Sam Okafor' },
  { id: 'priya', kind: 'person' as const, name: 'Priya Shah' },
  { id: 'leo', kind: 'person' as const, name: 'Leo Martins' },
  { id: 'nora', kind: 'person' as const, name: 'Nora Kim' },
  { id: 'me', kind: 'person' as const, name: 'Jamie (You)' },
]

export const ALBUMS = [
  { id: 'robotics', name: 'Robotics 2026', photos: ['p-robot-workshop', 'p-robot-comp', 'v-robot-auto', 'p-screenshot-chart', 'p-handwritten'] },
  { id: 'biscuit', name: 'Biscuit ❤️', photos: ['p-biscuit-couch', 'p-biscuit-park', 'p-biscuit-beach', 'p-biscuit-snow', 'v-fetch'] },
  { id: 'travel', name: 'Summer Trips', photos: ['p-mountains', 'p-panorama', 'p-bridge', 'p-lighthouse', 'p-desert', 'p-night-sky', 'p-waterfall'] },
  { id: 'food', name: 'Food', photos: ['p-pizza', 'p-ramen', 'p-pancakes', 'p-coffee'] },
]

const now = Date.now()

export const SHARED_ALBUMS: SharedAlbum[] = [
  {
    id: 'sa-family', name: 'Park Family', owner: 'mom', fullResolution: true,
    participants: [
      { id: 'mom', platform: 'iOS', canPost: true, canInvite: true },
      { id: 'dad', platform: 'iOS', canPost: true, canInvite: false },
      { id: 'me', platform: 'iOS', canPost: true, canInvite: false },
      { id: 'mia', platform: 'iOS', canPost: true, canInvite: false },
      { id: 'grandma', platform: 'Windows', canPost: true, canInvite: false },
    ],
    photos: ['p-family-dinner', 'p-sunflowers', 'p-biscuit-beach', 'p-soccer', 'p-mochi'],
    activity: [
      { id: 'ac1', who: 'grandma', what: 'added 1 photo', ts: at(-4, 15, 30), photoId: 'p-sunflowers' },
      { id: 'ac2', who: 'dad', what: 'reacted ❤️ to a photo', ts: now - 3 * HOUR, photoId: 'p-biscuit-beach', emoji: '❤️' },
      { id: 'ac3', who: 'mia', what: 'commented “best dog ever”', ts: now - 2 * HOUR, photoId: 'p-biscuit-beach' },
    ],
    reactions: { 'p-biscuit-beach': [{ who: 'dad', emoji: '❤️' }, { who: 'mom', emoji: '😍' }, { who: 'grandma', emoji: '👍' }] },
  },
  {
    id: 'sa-robotics', name: 'Circuit Breakers 7729', owner: 'alex', fullResolution: false, expires: at(90, 0, 0),
    participants: [
      { id: 'alex', platform: 'iOS', canPost: true, canInvite: true },
      { id: 'me', platform: 'iOS', canPost: true, canInvite: false },
      { id: 'nora', platform: 'Android', canPost: true, canInvite: false },
      { id: 'delgado', platform: 'Web', canPost: false, canInvite: false },
    ],
    photos: ['p-robot-workshop', 'p-robot-comp', 'v-robot-auto', 'p-screenshot-chart'],
    activity: [
      { id: 'ac4', who: 'nora', what: 'added 2 photos from Android', ts: at(-4, 16, 0), photoId: 'p-robot-comp' },
      { id: 'ac5', who: 'alex', what: 'reacted 🔥 to a video', ts: now - 40 * MIN, photoId: 'v-robot-auto', emoji: '🔥' },
    ],
    reactions: { 'v-robot-auto': [{ who: 'alex', emoji: '🔥' }] },
  },
]

export const CAMERA_CLIPS: CameraClip[] = [
  { id: 'clip-package', camera: 'Front Door', ts: at(-1, 14, 14), scene: 'porch-package', description: 'A delivery driver in a brown uniform left a medium cardboard package on the front doormat, then walked back to a van.', tags: ['package', 'delivery', 'person', 'box', 'parcel', 'courier', 'van'], duration: 38 },
  { id: 'clip-package2', camera: 'Front Door', ts: at(-5, 11, 2), scene: 'porch-package', description: 'Small envelope-style package placed by the door by a mail carrier.', tags: ['package', 'mail', 'delivery', 'envelope', 'person'], duration: 21 },
  { id: 'clip-biscuit', camera: 'Backyard', ts: now - 50 * MIN, scene: 'yard-dog', description: 'Biscuit, a golden retriever, chasing a ball across the lawn.', tags: ['dog', 'pet', 'animal', 'biscuit', 'play'], duration: 45 },
  { id: 'clip-car', camera: 'Driveway', ts: now - 3 * HOUR, scene: 'driveway-car', description: 'A dark blue SUV pulled into the driveway. Mom got out carrying grocery bags.', tags: ['car', 'vehicle', 'person', 'arrival', 'mom', 'groceries'], duration: 30 },
  { id: 'clip-raccoon', camera: 'Backyard', ts: at(-1, 2, 41), scene: 'yard-night', description: 'A raccoon walked along the fence and knocked over the recycling bin.', tags: ['animal', 'raccoon', 'night', 'wildlife', 'trash'], duration: 26 },
  { id: 'clip-visitor', camera: 'Front Door', ts: at(-2, 16, 20), scene: 'porch-person', description: 'Sam rang the doorbell and waited holding a snare drum case.', tags: ['person', 'visitor', 'doorbell', 'friend', 'sam', 'drum'], duration: 18 },
  { id: 'clip-mail', camera: 'Driveway', ts: at(-2, 12, 5), scene: 'driveway-mail', description: 'Mail carrier walked up to the mailbox and delivered letters.', tags: ['person', 'mail', 'mail carrier', 'delivery'], duration: 15 },
  { id: 'clip-deer', camera: 'Backyard', ts: at(-3, 6, 12), scene: 'yard-deer', description: 'Two deer grazed near the garden at dawn.', tags: ['animal', 'deer', 'wildlife', 'morning'], duration: 52 },
]
