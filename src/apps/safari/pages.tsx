import type { ComponentType } from 'react'
import { WeatherSite, RadarSite, ChemSite, LincolnSite, SearchSite } from './sites1'
import { HeadphonesSite, SbcSite, ForumSite, PartsSite, NewsSite, MusicSite, GameZoneSite, VideoTubeSite } from './sites2'
import { resolve } from './model'

export const SITE_PAGES: Record<string, ComponentType> = {
  'weather.example/maple-grove': WeatherSite,
  'stormwatch.example/radar': RadarSite,
  'chemreview.example/unit-3': ChemSite,
  'lincoln.example/calendar': LincolnSite,
  'bolt.example/headphones-x2': HeadphonesSite,
  'bolt.example/sbc-kit': SbcSite,
  'robotics-forum.example/swerve': ForumSite,
  'partsdepot.example/motors': PartsSite,
  'morningbrief.example/today': NewsSite,
  'tunedaily.example/luma-coast': MusicSite,
  'gamezone.example': GameZoneSite,
  'videotube.example': VideoTubeSite,
}

/** Which "Notify Me" watches make sense on a page (iOS 27). */
export const WATCHABLE: Record<string, { kinds: ('price' | 'restock' | 'content')[]; label: string }> = {
  'bolt.example/headphones-x2': { kinds: ['price'], label: 'Aurora X2 Headphones' },
  'bolt.example/sbc-kit': { kinds: ['restock'], label: 'SBC Starter Kit' },
  'partsdepot.example/motors': { kinds: ['content'], label: 'Parts Depot Motors' },
  'robotics-forum.example/swerve': { kinds: ['content'], label: 'Swerve Tuning Guide' },
  'chemreview.example/unit-3': { kinds: ['content'], label: 'Unit 3 Review' },
  'tunedaily.example/luma-coast': { kinds: ['content'], label: 'Luma Coast tour' },
  'morningbrief.example/today': { kinds: ['content'], label: 'The Morning Brief' },
}

export const PRODUCT_PAGES = new Set(['bolt.example/headphones-x2', 'bolt.example/sbc-kit'])

export function PageFor({ url }: { url: string }) {
  const r = resolve(url)
  if (r.kind === 'search') return <SearchSite q={r.q} />
  if (r.kind === 'site') {
    const C = SITE_PAGES[r.key]
    if (C) return <C />
  }
  return null
}

// ---------------- Translate (word/phrase level, on-device) ----------------
const PHRASES: [RegExp, string][] = [
  [/\bthunderstorms? likely\b/gi, 'probables tormentas'],
  [/\bin stock\b/gi, 'disponible'],
  [/\bout of stock\b/gi, 'agotado'],
  [/\badd to cart\b/gi, 'añadir al carrito'],
  [/\bfree delivery\b/gi, 'envío gratis'],
  [/\bpractice problems\b/gi, 'problemas de práctica'],
  [/\bshow answer\b/gi, 'mostrar respuesta'],
  [/\btour dates\b/gi, 'fechas de la gira'],
  [/\bmost read\b/gi, 'lo más leído'],
  [/\bcustomer reviews\b/gi, 'opiniones de clientes'],
  [/\babout this item\b/gi, 'acerca de este artículo'],
  [/\bfeels like\b/gi, 'sensación de'],
  [/\bon this page\b/gi, 'en esta página'],
  [/\bpercent yield\b/gi, 'rendimiento porcentual'],
  [/\blimiting reagents?\b/gi, 'reactivo limitante'],
  [/\bmole ratios\b/gi, 'proporciones molares'],
]
const WORDS: Record<string, string> = {
  the: 'el', a: 'un', an: 'un', and: 'y', or: 'o', of: 'de', to: 'a', in: 'en', on: 'en', for: 'para', with: 'con', is: 'es', are: 'son', be: 'ser', will: 'va a', this: 'este', that: 'que', it: 'lo', your: 'tu', you: 'tú', we: 'nosotros', our: 'nuestro', they: 'ellos', from: 'de', by: 'por', at: 'a las', as: 'como', but: 'pero', not: 'no', all: 'todo', more: 'más', most: 'más', new: 'nuevo', every: 'cada', can: 'puede', how: 'cómo', what: 'qué', when: 'cuándo', where: 'dónde', after: 'después', before: 'antes',
  today: 'hoy', tomorrow: 'mañana', evening: 'tarde', morning: 'mañana', night: 'noche', week: 'semana', weekend: 'fin de semana', day: 'día', days: 'días', hour: 'hora', hours: 'horas', minutes: 'minutos', time: 'hora',
  weather: 'tiempo', forecast: 'pronóstico', storms: 'tormentas', storm: 'tormenta', rain: 'lluvia', wind: 'viento', cloudy: 'nublado', partly: 'parcialmente', sunny: 'soleado', skies: 'cielos', high: 'máxima', low: 'mínima', humidity: 'humedad', radar: 'radar', live: 'en vivo', hourly: 'por hora',
  school: 'escuela', test: 'examen', events: 'eventos', event: 'evento', calendar: 'calendario', students: 'estudiantes', student: 'estudiante', club: 'club', fair: 'feria', concert: 'concierto', homecoming: 'regreso a casa', dance: 'baile', game: 'partido',
  price: 'precio', headphones: 'auriculares', wireless: 'inalámbricos', battery: 'batería', color: 'color', cart: 'carrito', delivery: 'entrega', warranty: 'garantía', returns: 'devoluciones', ratings: 'valoraciones', kit: 'kit', computer: 'computadora', motors: 'motores', motor: 'motor',
  news: 'noticias', music: 'música', tour: 'gira', band: 'banda', album: 'álbum', city: 'ciudad', show: 'espectáculo', shows: 'espectáculos', tickets: 'entradas', listen: 'escuchar',
  guide: 'guía', module: 'módulo', modules: 'módulos', tuning: 'ajuste', steering: 'dirección', drive: 'tracción', robot: 'robot', robotics: 'robótica', team: 'equipo', teams: 'equipos', replies: 'respuestas', reply: 'responder', update: 'actualización', common: 'comunes', problems: 'problemas',
  review: 'repaso', unit: 'unidad', chemistry: 'química', moles: 'moles', mole: 'mol', grams: 'gramos', particles: 'partículas', equation: 'ecuación', reaction: 'reacción', reactions: 'reacciones', product: 'producto', first: 'primero', always: 'siempre', balance: 'equilibrar',
  expected: 'se espera', likely: 'probable', updated: 'actualizado', read: 'leer', related: 'relacionados', search: 'buscar', results: 'resultados', home: 'inicio', free: 'gratis', play: 'jugar', games: 'juegos', videos: 'videos', watch: 'ver', views: 'vistas',
}

const originals = new WeakMap<Text, string>()

function translateText(t: string): string {
  let out = t
  for (const [re, rep] of PHRASES) out = out.replace(re, rep)
  out = out.replace(/\b([A-Za-z]+)\b/g, (w) => {
    const low = w.toLowerCase()
    const tr = WORDS[low]
    if (!tr) return w
    return w[0] === w[0].toUpperCase() && w[0] !== w[0].toLowerCase() ? tr[0].toUpperCase() + tr.slice(1) : tr
  })
  return out
}

export function translateDom(root: HTMLElement, on: boolean) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const nodes: Text[] = []
  while (walker.nextNode()) nodes.push(walker.currentNode as Text)
  for (const n of nodes) {
    if (!n.nodeValue || !n.nodeValue.trim()) continue
    if (n.parentElement?.closest('code, pre, svg, input, textarea, .sf-no-translate')) continue
    if (on) {
      const orig = originals.get(n) ?? n.nodeValue
      originals.set(n, orig)
      const tr = translateText(orig)
      if (tr !== n.nodeValue) n.nodeValue = tr
    } else {
      const orig = originals.get(n)
      if (orig !== undefined && orig !== n.nodeValue) n.nodeValue = orig
      originals.delete(n)
    }
  }
}
