/* Camera-local Visual Intelligence additions (iOS 27 Siri mode examples):
 * event flyer → Calendar, translate a foreign-language sign, nutrition facts for food. */
import { insightFor, answerAbout, CAMERA_DEMO_SCENES, type SceneInsight } from '../../os/ai/vision'

const EXTRA: Record<string, SceneInsight> = {
  'cam-flyer': {
    label: 'Event flyer — Fall Concert', category: 'document',
    summary: 'This flyer is for the Lincoln High Bands Fall Concert on Friday, October 16 at 7:00 PM at Harbor Amphitheater. Admission is free.',
    details: [{ label: 'Event', value: 'Fall Concert — Lincoln High Bands' }, { label: 'Date', value: 'Friday, Oct 16' }, { label: 'Time', value: '7:00 PM' }, { label: 'Location', value: 'Harbor Amphitheater' }, { label: 'Admission', value: 'Free' }],
    actions: [
      { label: 'Add to Calendar', action: { kind: 'event', title: 'Fall Concert — Lincoln High Bands', when: 'Oct 16 7pm', location: 'Harbor Amphitheater' } },
      { label: 'Remind me the day before', action: { kind: 'reminder', title: 'Fall Concert tomorrow at 7 PM', due: 'Oct 15 6pm' } },
      { label: 'Directions', action: { kind: 'map', place: 'Harbor Amphitheater' } },
      { label: 'Copy details', action: { kind: 'copy', text: 'Fall Concert — Lincoln High Bands, Fri Oct 16, 7:00 PM, Harbor Amphitheater. Free admission.' } },
    ],
    qa: [
      { q: /when|time|date|day/, a: 'The concert is Friday, October 16 at 7:00 PM.' },
      { q: /where|location|venue/, a: 'It’s at Harbor Amphitheater.' },
      { q: /cost|price|free|ticket/, a: 'Admission is free.' },
      { q: /who|band|perform/, a: 'The Lincoln High marching band, jazz band and drumline are performing.' },
    ],
    text: 'FALL CONCERT\nLincoln High Bands\nMarching · Jazz · Drumline\nFriday, Oct 16 · 7:00 PM\nHarbor Amphitheater\nFREE ADMISSION',
  },
  'cam-sign': {
    label: 'Menu board (Spanish)', category: 'text',
    summary: 'This chalkboard is in Spanish. Translated to English: “Menu of the Day — Tomato soup €4.50 · Spanish omelette €6.00 · Coffee with milk €2.20 · Welcome!”',
    details: [{ label: 'Language', value: 'Spanish → English' }, { label: 'Sopa de tomate', value: 'Tomato soup — €4.50' }, { label: 'Tortilla española', value: 'Spanish omelette — €6.00' }, { label: 'Café con leche', value: 'Coffee with milk — €2.20' }],
    actions: [
      { label: 'Translate', action: { kind: 'translate', text: 'Menu of the Day\nTomato soup — €4.50\nSpanish omelette — €6.00\nCoffee with milk — €2.20\nWelcome!' } },
      { label: 'Copy translation', action: { kind: 'copy', text: 'Menu of the Day: Tomato soup €4.50, Spanish omelette €6.00, Coffee with milk €2.20. Welcome!' } },
      { label: 'Save to Notes', action: { kind: 'note', title: 'Menú del día (translated)', body: 'Tomato soup €4.50 · Spanish omelette €6.00 · Coffee with milk €2.20' } },
    ],
    qa: [
      { q: /say|translate|mean|english/, a: 'It says: “Menu of the Day — Tomato soup €4.50, Spanish omelette €6.00, Coffee with milk €2.20. Welcome!”' },
      { q: /soup/, a: 'The tomato soup (sopa de tomate) is €4.50, about $5.20.' },
      { q: /vegetarian|meat/, a: 'The tortilla española is vegetarian — it’s made with eggs, potatoes and onion.' },
      { q: /coffee|café/, a: 'Café con leche is coffee with steamed milk, €2.20 (about $2.55).' },
      { q: /total|all|everything/, a: 'Ordering all three would be €12.70, about $14.70.' },
    ],
    text: 'MENÚ DEL DÍA\nSopa de tomate 4,50 €\nTortilla española 6,00 €\nCafé con leche 2,20 €\n¡Bienvenidos!',
  },
}

const NUTRITION: Record<string, { details: SceneInsight['details']; note: string; qa: { q: RegExp; a: string }[] }> = {
  'food-pizza': { details: [{ label: 'Per slice', value: '≈285 kcal' }, { label: 'Protein / Carbs / Fat', value: '12 g · 36 g · 10 g' }, { label: 'Sodium', value: '640 mg' }], note: 'Margherita pizza, 1 slice: ~285 kcal, 12 g protein, 36 g carbs, 10 g fat.', qa: [{ q: /protein/, a: 'About 12 g of protein per slice.' }, { q: /carb/, a: 'About 36 g of carbohydrates per slice.' }] },
  'food-ramen': { details: [{ label: 'Per bowl', value: '≈650 kcal' }, { label: 'Protein / Carbs / Fat', value: '32 g · 70 g · 24 g' }, { label: 'Sodium', value: '1,900 mg (high)' }], note: 'Ramen bowl: ~650 kcal, 32 g protein, very high sodium.', qa: [{ q: /calorie|healthy/, a: 'A bowl like this is about 650 calories and very high in sodium (~1,900 mg).' }] },
  'food-pancakes': { details: [{ label: 'Stack of 3', value: '≈520 kcal' }, { label: 'Sugar', value: '38 g (with syrup)' }], note: 'Blueberry pancakes (3): ~520 kcal, 38 g sugar with syrup.', qa: [{ q: /calorie|healthy|sugar/, a: 'Three pancakes with syrup are roughly 520 calories and 38 g of sugar.' }] },
  'food-coffee': { details: [{ label: '12 oz latte', value: '≈190 kcal' }, { label: 'Caffeine', value: '~130 mg' }], note: 'Latte (12 oz): ~190 kcal, ~130 mg caffeine.', qa: [{ q: /calorie/, a: 'A 12 oz whole-milk latte is about 190 calories.' }] },
}

export const DEMO_SCENES = [...CAMERA_DEMO_SCENES.slice(0, 7), { scene: 'cam-flyer', name: 'Flyer' }, { scene: 'cam-sign', name: 'Translate' }, ...CAMERA_DEMO_SCENES.slice(7)]

export function camInsight(scene: string): SceneInsight {
  const base = EXTRA[scene] ?? insightFor(scene)
  const n = NUTRITION[scene]
  if (!n) return base
  return {
    ...base,
    details: [...base.details, ...n.details],
    actions: [...base.actions, { label: 'Log nutrition in Notes', action: { kind: 'note', title: `Nutrition — ${base.label}`, body: n.note } }],
    qa: [...n.qa, ...(base.qa ?? [])],
  }
}

export function camAnswer(scene: string, q: string): string {
  const ins = camInsight(scene)
  const l = q.toLowerCase()
  for (const x of ins.qa ?? []) if (x.q.test(l)) return x.a
  if (EXTRA[scene]) {
    if (/read|text|say/.test(l) && ins.text) return `It says:\n${ins.text}`
    return ins.summary
  }
  return answerAbout(scene, q)
}
