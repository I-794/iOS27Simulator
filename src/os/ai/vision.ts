/* Visual Intelligence: what the simulated on-device vision model "sees" in each scene. */

export type VisionAction =
  | { kind: 'split'; total: number; people: number }
  | { kind: 'pay'; amount: number; to: string }
  | { kind: 'reminder'; title: string; due?: string }
  | { kind: 'event'; title: string; when: string; location?: string }
  | { kind: 'note'; title: string; body: string }
  | { kind: 'search'; query: string }
  | { kind: 'shop'; query: string }
  | { kind: 'map'; place: string }
  | { kind: 'weather' }
  | { kind: 'copy'; text: string }
  | { kind: 'translate'; text: string }
  | { kind: 'ask'; prompt: string }

export interface SceneInsight {
  label: string
  category: 'food' | 'plant' | 'landmark' | 'receipt' | 'weather' | 'product' | 'text' | 'animal' | 'document' | 'place' | 'people' | 'object'
  summary: string
  details: { label: string; value: string }[]
  actions: { label: string; action: VisionAction }[]
  /** Answers to likely follow-up questions */
  qa?: { q: RegExp; a: string }[]
  text?: string
}

export const SCENE_INSIGHTS: Record<string, SceneInsight> = {
  receipt: {
    label: 'Restaurant receipt', category: 'receipt',
    summary: "This is a receipt from Rosa's Trattoria. The total is $86.40, including $5.12 tax and a $17.28 tip, for a party of 4.",
    details: [{ label: 'Merchant', value: "Rosa's Trattoria" }, { label: 'Subtotal', value: '$64.00' }, { label: 'Tax', value: '$5.12' }, { label: 'Tip', value: '$17.28 (27%)' }, { label: 'Total', value: '$86.40' }, { label: 'Paid with', value: 'Card ending 9021' }],
    actions: [
      { label: 'Split 4 ways', action: { kind: 'split', total: 86.4, people: 4 } },
      { label: 'Request with Apple Cash', action: { kind: 'pay', amount: 21.6, to: 'Drumline 🥁' } },
      { label: 'Save to Notes', action: { kind: 'note', title: "Rosa's receipt", body: "Rosa's Trattoria — total $86.40 (tax $5.12, tip $17.28). Split 4 ways: $21.60 each." } },
      { label: 'Copy total', action: { kind: 'copy', text: '$86.40' } },
    ],
    qa: [
      { q: /tip|gratuity/, a: 'The tip was $17.28, which is 27% of the $64.00 subtotal.' },
      { q: /each|split|per person|owe/, a: 'Split between 4 people, each person owes $21.60.' },
      { q: /tax/, a: 'Tax was $5.12 (8% of the subtotal).' },
      { q: /most expensive|priciest/, a: 'The most expensive item was the Rigatoni Vodka at $19.50.' },
      { q: /total|how much/, a: 'The total is $86.40.' },
    ],
    text: "ROSA'S TRATTORIA\nMargherita Pizza 18.00\nRigatoni Vodka 19.50\nCaesar Salad 11.00\nGarlic Knots 7.50\nLemonade x2 8.00\nSubtotal 64.00\nTax 5.12\nTip 17.28\nTOTAL $86.40",
  },
  'food-pizza': {
    label: 'Margherita pizza', category: 'food',
    summary: 'This looks like a Margherita pizza — tomato sauce, fresh mozzarella and basil on a thin crust. About 250–300 calories per slice.',
    details: [{ label: 'Dish', value: 'Pizza Margherita' }, { label: 'Cuisine', value: 'Italian (Neapolitan)' }, { label: 'Toppings', value: 'Tomato, mozzarella, basil' }],
    actions: [{ label: 'Find a recipe', action: { kind: 'search', query: 'margherita pizza recipe' } }, { label: 'Pizza places nearby', action: { kind: 'map', place: "Rosa's Trattoria" } }, { label: 'Log in Journal', action: { kind: 'note', title: 'Pizza night', body: 'Margherita at Rosa’s.' } }],
    qa: [{ q: /calorie|healthy/, a: 'A slice is roughly 250–300 calories.' }, { q: /where|restaurant/, a: "Based on the photo's location, this was taken at Rosa's Trattoria." }],
  },
  'food-ramen': {
    label: 'Tonkotsu-style ramen', category: 'food',
    summary: 'This is a bowl of ramen with a soft-boiled egg, chashu pork, and scallions in a rich broth.',
    details: [{ label: 'Dish', value: 'Ramen' }, { label: 'Cuisine', value: 'Japanese' }, { label: 'Toppings', value: 'Ajitama egg, chashu, scallions, nori' }],
    actions: [{ label: 'Find a recipe', action: { kind: 'search', query: 'ramen egg recipe' } }, { label: 'Save to Notes', action: { kind: 'note', title: 'Ramen to try', body: 'Soft egg + chashu ramen.' } }],
  },
  'food-pancakes': {
    label: 'Blueberry pancakes', category: 'food',
    summary: 'A stack of fluffy pancakes topped with blueberries, butter and maple syrup.',
    details: [{ label: 'Dish', value: 'Pancakes' }, { label: 'Toppings', value: 'Blueberries, butter, syrup' }],
    actions: [{ label: 'Find a recipe', action: { kind: 'search', query: 'blueberry pancakes' } }, { label: 'Add ingredients to Groceries', action: { kind: 'reminder', title: 'Blueberries + pancake mix' } }],
  },
  'food-coffee': {
    label: 'Latte', category: 'food',
    summary: 'A latte with heart-shaped latte art. Typically espresso with steamed milk and a thin layer of foam.',
    details: [{ label: 'Drink', value: 'Caffè latte' }, { label: 'Caffeine', value: '~75–150 mg' }],
    actions: [{ label: 'Directions to Brew Lab', action: { kind: 'map', place: 'Brew Lab Coffee' } }],
  },
  'plant-monstera': {
    label: 'Monstera deliciosa', category: 'plant',
    summary: 'This is a Monstera deliciosa (Swiss cheese plant). The leaves look healthy — keep it in bright, indirect light and water when the top 2 inches of soil are dry.',
    details: [{ label: 'Species', value: 'Monstera deliciosa' }, { label: 'Light', value: 'Bright, indirect' }, { label: 'Water', value: 'Every 1–2 weeks' }, { label: 'Pet safe', value: 'No — toxic to dogs and cats' }],
    actions: [{ label: 'Remind me to water it', action: { kind: 'reminder', title: 'Water the monstera', due: 'Sunday' } }, { label: 'Learn more', action: { kind: 'search', query: 'monstera care' } }],
    qa: [{ q: /dog|cat|pet|biscuit|toxic|safe/, a: 'Monstera is toxic to dogs and cats if chewed, so keep it out of Biscuit’s reach.' }, { q: /water/, a: 'Water when the top 2 inches of soil are dry — usually every 1–2 weeks.' }, { q: /yellow/, a: 'Yellow leaves usually mean overwatering. Let the soil dry out more between waterings.' }],
  },
  'plant-succulent': {
    label: 'Echeveria succulent', category: 'plant',
    summary: 'This looks like an Echeveria, a rosette-shaped succulent. It likes lots of light and very little water.',
    details: [{ label: 'Genus', value: 'Echeveria' }, { label: 'Light', value: 'Full sun' }, { label: 'Water', value: 'Every 2–3 weeks' }],
    actions: [{ label: 'Remind me to water it', action: { kind: 'reminder', title: 'Water the succulent', due: 'in 2 weeks' } }],
  },
  'plant-sunflower': {
    label: 'Common sunflower', category: 'plant',
    summary: 'These are common sunflowers (Helianthus annuus). They can grow over 10 feet tall and their seeds are edible.',
    details: [{ label: 'Species', value: 'Helianthus annuus' }, { label: 'Bloom', value: 'Summer–early fall' }],
    actions: [{ label: 'Learn more', action: { kind: 'search', query: 'sunflower facts' } }],
  },
  'landmark-bridge': {
    label: 'Bay Crossing Bridge', category: 'landmark',
    summary: 'This is the Bay Crossing Bridge, a suspension bridge completed in 1937. Its towers rise 227 m above the water and it’s famous for its International Orange color.',
    details: [{ label: 'Type', value: 'Suspension bridge' }, { label: 'Opened', value: '1937' }, { label: 'Main span', value: '1,280 m' }],
    actions: [{ label: 'Directions', action: { kind: 'map', place: 'Bay Crossing Bridge' } }, { label: 'Learn more', action: { kind: 'search', query: 'Bay Crossing Bridge history' } }],
    qa: [{ q: /color|orange|red/, a: 'The bridge is painted International Orange so it stays visible in fog.' }, { q: /tall|high/, a: 'The towers rise about 227 m (746 ft) above the water.' }],
  },
  'landmark-lighthouse': {
    label: 'Point Harbor Lighthouse', category: 'landmark',
    summary: 'Point Harbor Lighthouse, built in 1871. Its light is visible for about 20 nautical miles. The grounds are open to visitors on weekends.',
    details: [{ label: 'Built', value: '1871' }, { label: 'Height', value: '34 m' }, { label: 'Visits', value: 'Sat–Sun, 10 AM–4 PM' }],
    actions: [{ label: 'Add visit to Calendar', action: { kind: 'event', title: 'Visit Point Harbor Lighthouse', when: 'Saturday 10am', location: 'Point Harbor' } }, { label: 'Directions', action: { kind: 'map', place: 'Point Harbor Lighthouse' } }],
  },
  storm: {
    label: 'Thunderstorm (cumulonimbus)', category: 'weather',
    summary: 'This is a thunderstorm with cloud-to-ground lightning from a cumulonimbus cloud. The forecast shows thunderstorms Thursday evening in Maple Grove — the same time as your robotics meeting.',
    details: [{ label: 'Cloud', value: 'Cumulonimbus' }, { label: 'Hazard', value: 'Lightning, gusty wind' }, { label: 'Safety', value: 'Stay indoors 30 min after last thunder' }],
    actions: [{ label: 'Check forecast', action: { kind: 'weather' } }, { label: 'Remind me to bring an umbrella', action: { kind: 'reminder', title: 'Bring umbrella to robotics', due: 'Thursday 5pm' } }],
    qa: [{ q: /safe|danger|outside/, a: 'If you can hear thunder, you’re close enough to be struck. Stay inside until 30 minutes after the last thunder.' }, { q: /far|distance|away/, a: 'Count the seconds between the flash and thunder and divide by 5 — that’s roughly the distance in miles.' }],
  },
  'product-headphones': {
    label: 'Aurora X2 wireless headphones', category: 'product',
    summary: 'These look like Aurora X2 over-ear headphones in Sage. They’re $249 at Bolt Electronics and currently in stock.',
    details: [{ label: 'Model', value: 'Aurora X2' }, { label: 'Color', value: 'Sage' }, { label: 'Price', value: '$249 at Bolt Electronics' }, { label: 'Battery', value: '40 hours' }],
    actions: [{ label: 'Shop', action: { kind: 'shop', query: 'bolt.example/headphones-x2' } }, { label: 'Watch price in Safari', action: { kind: 'shop', query: 'bolt.example/headphones-x2#notify' } }],
  },
  'product-sneakers': {
    label: 'Low-top sneakers', category: 'product',
    summary: 'White and blue low-top sneakers. Similar pairs are on sale this weekend at Greenfield Mall.',
    details: [{ label: 'Style', value: 'Low-top court sneaker' }, { label: 'Colors', value: 'White / Blue' }],
    actions: [{ label: 'Search similar', action: { kind: 'search', query: 'white blue sneakers' } }],
  },
  'product-speaker': {
    label: 'Smart speaker', category: 'product',
    summary: 'This appears to be a HomePod-style smart speaker in slate. You have a HomePod mini in Jamie’s Room already set up in Home.',
    details: [{ label: 'Type', value: 'Smart speaker' }, { label: 'In your Home', value: 'HomePod mini — Jamie’s Room' }],
    actions: [{ label: 'Open Home', action: { kind: 'ask', prompt: 'Open Home' } }],
  },
  handwritten: {
    label: 'Handwritten note', category: 'text',
    summary: 'This handwritten note says: “Robotics — zip ties, laptop charger, safety glasses, build log. Thurs 6:30! Rm 114.”',
    details: [{ label: 'Detected text', value: 'Robotics checklist' }, { label: 'Date found', value: 'Thursday 6:30 PM' }, { label: 'Location', value: 'Room 114' }],
    actions: [
      { label: 'Add to Reminders', action: { kind: 'reminder', title: 'Bring zip ties, laptop charger, safety glasses, build log', due: 'Thursday 5pm' } },
      { label: 'Add event Thursday 6:30', action: { kind: 'event', title: 'Robotics', when: 'Thursday 6:30pm', location: 'Room 114' } },
      { label: 'Copy text', action: { kind: 'copy', text: 'Robotics — zip ties, laptop charger, safety glasses, build log. Thurs 6:30! Rm 114' } },
    ],
    text: 'Robotics —\n• zip ties\n• laptop charger\n• safety glasses\n• build log\nThurs 6:30!\nRm 114',
  },
  'dog-couch': { label: 'Golden retriever (Biscuit)', category: 'animal', summary: 'That’s Biscuit, your golden retriever, napping on the couch.', details: [{ label: 'Breed', value: 'Golden Retriever' }, { label: 'Name', value: 'Biscuit' }], actions: [{ label: 'Show more of Biscuit', action: { kind: 'search', query: 'Biscuit' } }] },
  'dog-park': { label: 'Golden retriever (Biscuit)', category: 'animal', summary: 'That’s Biscuit playing fetch at Riverside Park.', details: [{ label: 'Breed', value: 'Golden Retriever' }, { label: 'Place', value: 'Riverside Park' }], actions: [{ label: 'Show more of Biscuit', action: { kind: 'search', query: 'Biscuit' } }] },
  'dog-beach': { label: 'Golden retriever at the beach', category: 'animal', summary: 'Biscuit running along the shore at Pelican Cove Beach at sunset.', details: [{ label: 'Breed', value: 'Golden Retriever' }, { label: 'Place', value: 'Pelican Cove Beach' }], actions: [{ label: 'Send to Dad', action: { kind: 'ask', prompt: 'Send this photo to Dad' } }] },
  'robot-workshop': { label: 'Competition robot', category: 'object', summary: 'Your team’s competition robot with the orange roller intake, on the workbench in Room 114.', details: [{ label: 'Team', value: 'Circuit Breakers #7729' }, { label: 'Mechanism', value: 'Roller intake' }], actions: [{ label: 'Open Build Log', action: { kind: 'ask', prompt: 'Open my robotics build log note' } }] },
  'screenshot-chart': { label: 'Bar chart', category: 'document', summary: 'This bar chart shows Team 7729’s points per match rising steadily from 42 in Q1 to 88 in Q6 — more than double. The biggest jump was Q4 to Q5 (+13).', details: [{ label: 'Type', value: 'Bar chart, 6 bars' }, { label: 'Range', value: '42 → 88 points' }, { label: 'Trend', value: 'Increasing, avg +9.2/match' }], actions: [{ label: 'Save summary to Notes', action: { kind: 'note', title: 'Match trend', body: 'Points rose from 42 to 88 across six qualification matches.' } }] },
  'screenshot-boarding': { label: 'Flight itinerary', category: 'document', summary: 'Skyward Airlines flight SK 482 from Maple Grove (MGR) to Seattle (SEA), Nov 21 at 8:45 AM. Seat 14C, confirmation 7XKQ2P.', details: [{ label: 'Flight', value: 'SK 482' }, { label: 'Confirmation', value: '7XKQ2P' }, { label: 'Seat', value: '14C' }], actions: [{ label: 'Add to Calendar', action: { kind: 'event', title: 'Flight SK 482 to Seattle', when: 'Nov 21 8:45am', location: 'MGR' } }] },
  'id-student': { label: 'Student ID card', category: 'document', summary: 'This is a Lincoln High School student ID for Jamie Park, grade 11, ID LHS-204417. It’s in your Identity Documents collection in Photos.', details: [{ label: 'Name', value: 'Jamie Park' }, { label: 'ID', value: 'LHS-204417' }], actions: [{ label: 'Add to Wallet', action: { kind: 'ask', prompt: 'Open Wallet' } }] },
  'mountain-lake': { label: 'Alpine lake', category: 'place', summary: 'Snow-capped peaks reflected in a calm alpine lake, taken on the Glacier Point Trail.', details: [{ label: 'Place', value: 'Glacier Point Trail' }], actions: [{ label: 'Show on map', action: { kind: 'map', place: 'Glacier Point Trail' } }] },
  'cat-window': { label: 'Gray tabby cat (Mochi)', category: 'animal', summary: 'That’s Mochi, Grandma’s gray tabby, sunning in the window.', details: [{ label: 'Name', value: 'Mochi' }], actions: [] },
}

export const CAMERA_DEMO_SCENES = [
  { scene: 'food-pizza', name: 'Food' },
  { scene: 'plant-monstera', name: 'Plant' },
  { scene: 'landmark-bridge', name: 'Landmark' },
  { scene: 'receipt', name: 'Receipt' },
  { scene: 'storm', name: 'Storm' },
  { scene: 'product-headphones', name: 'Product' },
  { scene: 'handwritten', name: 'Handwriting' },
  { scene: 'plant-succulent', name: 'Succulent' },
  { scene: 'landmark-lighthouse', name: 'Lighthouse' },
  { scene: 'dog-park', name: 'Biscuit' },
]

export function insightFor(scene: string, description?: string): SceneInsight {
  return (
    SCENE_INSIGHTS[scene] ?? {
      label: 'Photo',
      category: 'object',
      summary: description ?? 'I can see a photo, but I’m not sure what it shows.',
      details: [],
      actions: [],
    }
  )
}

export function answerAbout(scene: string, question: string, description?: string): string {
  const ins = insightFor(scene, description)
  const q = question.toLowerCase()
  for (const qa of ins.qa ?? []) if (qa.q.test(q)) return qa.a
  if (/what|who|describe|identify|tell me/.test(q)) return ins.summary
  if (/read|text|say/.test(q) && ins.text) return `It says:\n${ins.text}`
  return `${ins.summary}`
}
