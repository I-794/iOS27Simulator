/* Image Playground renderer: composes an original illustration from the prompt's
 * concepts (setting + subject + accessories) and renders it in the chosen style.
 * No network or model is used — it is a deterministic local "generation". */
import { memo, useId } from 'react'
import { useOS } from '../os/store'
import { Scene } from './Scene'

export const PLAYGROUND_STYLES = ['Animation', 'Illustration', 'Sketch', 'Photorealistic', 'Watercolor', 'Oil Painting', 'Vector'] as const
export type PlaygroundStyle = (typeof PLAYGROUND_STYLES)[number]

function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}

const has = (p: string, ...words: string[]) => words.some((w) => p.includes(w))

export function conceptsFor(prompt: string) {
  const p = prompt.toLowerCase()
  const setting = has(p, 'space', 'moon', 'planet', 'astronaut', 'galaxy') ? 'space'
    : has(p, 'beach', 'ocean', 'sea', 'surf', 'wave') ? 'beach'
      : has(p, 'city', 'street', 'neon', 'downtown') ? 'city'
        : has(p, 'forest', 'woods', 'tree', 'jungle') ? 'forest'
          : has(p, 'snow', 'winter', 'ski') ? 'snow'
            : has(p, 'mountain', 'hike', 'camp') ? 'mountain'
              : has(p, 'stage', 'concert', 'band', 'drum', 'music') ? 'stage'
                : has(p, 'party', 'birthday', 'celebrat') ? 'party'
                  : 'studio'
  const subject = has(p, 'dog', 'puppy', 'retriever', 'biscuit') ? 'dog'
    : has(p, 'cat', 'kitten', 'mochi') ? 'cat'
      : has(p, 'robot', 'bot', 'mech') ? 'robot'
        : has(p, 'rocket', 'spaceship') ? 'rocket'
          : has(p, 'cake', 'cupcake') ? 'cake'
            : has(p, 'flower', 'sunflower', 'rose', 'bloom') ? 'flower'
              : has(p, 'dragon') ? 'dragon'
                : has(p, 'drum', 'snare') ? 'drum'
                  : has(p, 'me', 'person', 'portrait', 'jamie', 'friend', 'selfie') ? 'person'
                    : 'orb'
  const accessories = [
    has(p, 'sunglass', 'shades', 'cool') && 'sunglasses',
    has(p, 'hat', 'party', 'birthday', 'wizard') && 'hat',
    has(p, 'astronaut', 'helmet', 'space') && 'helmet',
    has(p, 'scarf', 'winter', 'cozy') && 'scarf',
    has(p, 'crown', 'king', 'queen', 'royal') && 'crown',
    has(p, 'headphone', 'music', 'dj') && 'headphones',
  ].filter(Boolean) as string[]
  return { setting, subject, accessories }
}

/** Look up a stored generation by id (used by wallpapers / contact posters). */
export const GenImage = memo(function GenImage(props: { seed?: string; prompt?: string; genStyle?: string; source?: string; edits?: string[]; className?: string; style?: React.CSSProperties }) {
  const gens = useOS((s) => s.imageGens)
  const stored = props.seed ? gens.find((g) => g.id === props.seed) : undefined
  const prompt = props.prompt ?? stored?.prompt ?? 'a glowing orb'
  const style = props.genStyle ?? stored?.style ?? 'Animation'
  const source = props.source ?? stored?.source
  const edits = props.edits ?? stored?.edits ?? []
  const seed = hash(`${prompt}|${stored?.seed ?? props.seed ?? ''}`)
  return <GenArt prompt={[prompt, ...edits].join(' ')} artStyle={style} seed={seed} source={source} className={props.className} style={props.style} />
})

const PALETTES = [
  ['#ff9a8b', '#ff6a88', '#ff99ac', '#ffd3a5'],
  ['#8ec5fc', '#e0c3fc', '#a1c4fd', '#c2e9fb'],
  ['#84fab0', '#8fd3f4', '#a6c0fe', '#f68084'],
  ['#fccb90', '#d57eeb', '#e0c3fc', '#8ec5fc'],
  ['#43e97b', '#38f9d7', '#fa709a', '#fee140'],
]

export function GenArt({ prompt, artStyle, seed, source, className, style }: { prompt: string; artStyle: string; seed: number; source?: string; className?: string; style?: React.CSSProperties }) {
  const uid = useId().replace(/:/g, '')
  const id = (s: string) => `${uid}-${s}`
  const c = conceptsFor(prompt)
  const pal = PALETTES[seed % PALETTES.length]
  const outline = artStyle === 'Illustration' || artStyle === 'Vector' ? '#1c1c1e' : 'none'
  const sw = artStyle === 'Illustration' ? 4 : artStyle === 'Vector' ? 2.5 : 0
  const filter =
    artStyle === 'Sketch' ? `url(#${id('sketch')})`
      : artStyle === 'Watercolor' ? `url(#${id('water')})`
        : artStyle === 'Oil Painting' ? `url(#${id('oil')})`
          : undefined
  const fur = c.subject === 'cat' ? '#9a9ca3' : '#e0a458'

  if (artStyle === 'Photorealistic') {
    const scene = c.subject === 'dog' ? (c.setting === 'beach' ? 'dog-beach' : c.setting === 'snow' ? 'dog-snow' : 'dog-park')
      : c.subject === 'cat' ? 'cat-window' : c.subject === 'robot' ? 'robot-workshop' : c.subject === 'flower' ? 'plant-sunflower'
        : c.setting === 'space' ? 'night-sky' : c.setting === 'beach' ? 'sunset-beach' : c.setting === 'city' ? 'city-night' : c.setting === 'mountain' ? 'mountain-lake' : c.setting === 'snow' ? 'snow-cabin' : c.setting === 'stage' ? 'concert-lights' : 'autumn-trees'
    return <Scene scene={source ?? scene} className={className} style={{ ...style, filter: 'contrast(1.05) saturate(1.1)' }} grain />
  }

  const bg = {
    space: ['#0b1026', '#2b1e5a'], beach: ['#ffd29d', '#5ec3ff'], city: ['#1e1b4b', '#db2777'], forest: ['#a7f3d0', '#166534'],
    snow: ['#e0f2fe', '#93c5fd'], mountain: ['#bae6fd', '#6366f1'], stage: ['#1e1033', '#7c3aed'], party: [pal[0], pal[1]], studio: [pal[2], pal[3]],
  }[c.setting] as [string, string]

  return (
    <svg className={className} style={{ display: 'block', ...style }} viewBox="0 0 300 300" preserveAspectRatio="xMidYMid slice" role="img" aria-label={`Generated image: ${prompt}`}>
      <defs>
        <linearGradient id={id('bg')} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={bg[0]} /><stop offset="1" stopColor={bg[1]} /></linearGradient>
        <radialGradient id={id('glow')}><stop offset="0" stopColor="#fff" stopOpacity=".9" /><stop offset="1" stopColor="#fff" stopOpacity="0" /></radialGradient>
        <radialGradient id={id('orb')} cx=".35" cy=".3"><stop offset="0" stopColor="#fff" /><stop offset=".3" stopColor={pal[0]} /><stop offset="1" stopColor={pal[1]} /></radialGradient>
        <filter id={id('sketch')}><feColorMatrix type="saturate" values="0" /><feComponentTransfer><feFuncR type="discrete" tableValues="0.15 0.5 0.85 1" /><feFuncG type="discrete" tableValues="0.15 0.5 0.85 1" /><feFuncB type="discrete" tableValues="0.15 0.5 0.85 1" /></feComponentTransfer></filter>
        <filter id={id('water')}><feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="3" seed={seed % 100} /><feDisplacementMap in="SourceGraphic" scale="9" /></filter>
        <filter id={id('oil')}><feTurbulence type="turbulence" baseFrequency="0.08" numOctaves="2" seed={seed % 100} /><feDisplacementMap in="SourceGraphic" scale="6" /><feColorMatrix type="saturate" values="1.4" /></filter>
      </defs>
      <g filter={filter} stroke={outline} strokeWidth={sw} strokeLinejoin="round">
        <rect width="300" height="300" fill={`url(#${id('bg')})`} stroke="none" />
        {c.setting === 'space' && <g stroke="none">{Array.from({ length: 60 }).map((_, i) => <circle key={i} cx={(i * 97 + seed) % 300} cy={(i * 53 + seed) % 300} r={(i % 3) * 0.7 + 0.4} fill="#fff" />)}<circle cx="240" cy="60" r="30" fill="#f4f1de" /><circle cx="232" cy="52" r="6" fill="#d8d3b8" /></g>}
        {c.setting === 'beach' && <g><circle cx="230" cy="80" r="34" fill="#fff3b0" stroke="none" /><path d="M0 190 q75 -18 150 0 t150 0 v110 h-300z" fill="#3aa0ff" /><path d="M0 225 q150 -20 300 0 v75 h-300z" fill="#ffe0a6" /></g>}
        {c.setting === 'city' && <g>{[20, 70, 120, 180, 230, 270].map((x, i) => <rect key={i} x={x} y={120 + (i % 3) * 25} width="40" height="180" rx="4" fill={i % 2 ? '#312e81' : '#4c1d95'} />)}{Array.from({ length: 30 }).map((_, i) => <rect key={i} x={28 + (i % 6) * 48} y={140 + Math.floor(i / 6) * 22} width="8" height="8" fill="#fde68a" stroke="none" />)}</g>}
        {c.setting === 'forest' && <g>{[30, 90, 210, 270].map((x, i) => <g key={i}><rect x={x - 5} y="170" width="10" height="60" fill="#78350f" /><circle cx={x} cy="150" r="42" fill={i % 2 ? '#16a34a' : '#22c55e'} /></g>)}<rect y="230" width="300" height="70" fill="#15803d" /></g>}
        {c.setting === 'snow' && <g><path d="M0 220 q150 -30 300 0 v80 h-300z" fill="#fff" />{Array.from({ length: 40 }).map((_, i) => <circle key={i} cx={(i * 71) % 300} cy={(i * 37) % 220} r="2.5" fill="#fff" stroke="none" />)}</g>}
        {c.setting === 'mountain' && <g><path d="M0 220 L80 110 L140 180 L210 90 L300 200 V300 H0z" fill="#4338ca" /><path d="M190 115 L210 90 L232 118z" fill="#fff" /></g>}
        {c.setting === 'stage' && <g>{[60, 150, 240].map((x, i) => <path key={i} d={`M${x} 0 L${x - 50} 230 L${x + 50} 230z`} fill={pal[i]} opacity=".35" stroke="none" />)}<rect y="230" width="300" height="70" fill="#2e1065" /></g>}
        {c.setting === 'party' && <g stroke="none">{Array.from({ length: 40 }).map((_, i) => <rect key={i} x={(i * 67) % 300} y={(i * 43) % 300} width="6" height="12" rx="2" fill={pal[i % 4]} transform={`rotate(${i * 37} ${(i * 67) % 300} ${(i * 43) % 300})`} />)}</g>}
        {c.setting === 'studio' && <circle cx="150" cy="150" r="130" fill={`url(#${id('glow')})`} opacity=".5" stroke="none" />}

        {/* subject */}
        {(c.subject === 'dog' || c.subject === 'cat') && (
          <g transform="translate(150 175)">
            <ellipse cx="0" cy="55" rx="70" ry="50" fill={fur} />
            <circle cx="0" cy="-10" r="62" fill={fur} />
            {c.subject === 'cat'
              ? <path d="M-52 -40 L-44 -96 L-10 -62z M52 -40 L44 -96 L10 -62z" fill={fur} />
              : <><ellipse cx="-56" cy="-4" rx="20" ry="40" fill="#b8742f" transform="rotate(20 -56 -4)" /><ellipse cx="56" cy="-4" rx="20" ry="40" fill="#b8742f" transform="rotate(-20 56 -4)" /></>}
            <ellipse cx="0" cy="18" rx="30" ry="22" fill="#fbe3c2" />
            <ellipse cx="0" cy="6" rx="11" ry="8" fill="#2a1b10" />
            <circle cx="-24" cy="-22" r="10" fill="#2a1b10" stroke="none" /><circle cx="24" cy="-22" r="10" fill="#2a1b10" stroke="none" />
            <circle cx="-21" cy="-26" r="3.5" fill="#fff" stroke="none" /><circle cx="27" cy="-26" r="3.5" fill="#fff" stroke="none" />
            <path d="M-10 26 q10 10 20 0" fill="none" stroke="#2a1b10" strokeWidth="3" />
          </g>
        )}
        {c.subject === 'robot' && (
          <g transform="translate(150 170)">
            <rect x="-60" y="-10" width="120" height="100" rx="18" fill="#94a3b8" />
            <rect x="-50" y="-90" width="100" height="74" rx="20" fill="#cbd5e1" />
            <rect x="-38" y="-72" width="76" height="38" rx="14" fill="#0f172a" />
            <circle cx="-16" cy="-53" r="8" fill="#38bdf8" stroke="none" /><circle cx="16" cy="-53" r="8" fill="#38bdf8" stroke="none" />
            <line x1="0" y1="-90" x2="0" y2="-112" stroke="#64748b" strokeWidth="5" /><circle cx="0" cy="-116" r="7" fill="#f97316" />
            <rect x="-30" y="20" width="60" height="30" rx="6" fill="#f97316" />
          </g>
        )}
        {c.subject === 'rocket' && (
          <g transform="translate(150 160) rotate(20)"><path d="M0 -100 C 40 -60 40 20 30 60 H-30 C -40 20 -40 -60 0 -100z" fill="#f1f5f9" /><circle cx="0" cy="-30" r="16" fill="#38bdf8" /><path d="M-30 30 L-56 70 L-28 60z M30 30 L56 70 L28 60z" fill="#ef4444" /><path d="M-20 62 Q0 120 20 62z" fill="#f97316" stroke="none" /></g>
        )}
        {c.subject === 'cake' && (
          <g transform="translate(150 190)"><rect x="-80" y="-20" width="160" height="70" rx="10" fill="#f9a8d4" /><rect x="-60" y="-70" width="120" height="54" rx="10" fill="#fde68a" /><path d="M-80 -10 q20 20 40 0 t40 0 t40 0 t40 0" fill="none" stroke="#fff" strokeWidth="8" />{[-30, 0, 30].map((x) => <g key={x}><rect x={x - 4} y="-100" width="8" height="30" fill="#60a5fa" /><ellipse cx={x} cy="-106" rx="5" ry="9" fill="#fbbf24" stroke="none" /></g>)}</g>
        )}
        {c.subject === 'flower' && (
          <g transform="translate(150 150)">{Array.from({ length: 12 }).map((_, i) => <ellipse key={i} cx="0" cy="-60" rx="22" ry="50" fill={pal[i % 4]} transform={`rotate(${i * 30})`} />)}<circle r="34" fill="#fbbf24" /></g>
        )}
        {c.subject === 'dragon' && (
          <g transform="translate(150 170)"><ellipse cx="0" cy="30" rx="80" ry="50" fill="#22c55e" /><circle cx="50" cy="-30" r="40" fill="#22c55e" /><path d="M-30 0 L-110 -80 L-40 -30z M20 -10 L60 -110 L60 -30z" fill="#16a34a" /><circle cx="62" cy="-38" r="7" fill="#111" stroke="none" /><path d="M80 -20 q30 10 40 -10" fill="none" stroke="#f97316" strokeWidth="8" /></g>
        )}
        {c.subject === 'drum' && (
          <g transform="translate(150 180)"><ellipse cx="0" cy="-40" rx="90" ry="26" fill="#f8fafc" /><rect x="-90" y="-40" width="180" height="90" fill="#dc2626" /><ellipse cx="0" cy="50" rx="90" ry="26" fill="#b91c1c" />{[-60, -20, 20, 60].map((x) => <line key={x} x1={x} y1="-30" x2={x + 20} y2="60" stroke="#fde68a" strokeWidth="4" />)}<line x1="-40" y1="-90" x2="10" y2="-44" stroke="#78350f" strokeWidth="8" strokeLinecap="round" /><line x1="60" y1="-100" x2="20" y2="-46" stroke="#78350f" strokeWidth="8" strokeLinecap="round" /></g>
        )}
        {c.subject === 'person' && (
          <g transform="translate(150 175)"><path d="M-80 130 q0 -90 80 -90 q80 0 80 90z" fill={pal[1]} /><circle cx="0" cy="-20" r="56" fill="#e0ac7e" /><path d="M-58 -26 q0 -60 58 -60 q58 0 58 60 q-20 -26 -58 -26 q-38 0 -58 26z" fill="#2a1b10" /><circle cx="-20" cy="-18" r="7" fill="#2a1b10" stroke="none" /><circle cx="20" cy="-18" r="7" fill="#2a1b10" stroke="none" /><path d="M-18 8 q18 16 36 0" fill="none" stroke="#7a3f2a" strokeWidth="4" strokeLinecap="round" /></g>
        )}
        {c.subject === 'orb' && <circle cx="150" cy="160" r="80" fill={`url(#${id('orb')})`} />}

        {/* accessories */}
        {c.accessories.includes('sunglasses') && <g transform="translate(150 153)"><rect x="-60" y="-12" width="50" height="26" rx="10" fill="#111" /><rect x="10" y="-12" width="50" height="26" rx="10" fill="#111" /><rect x="-10" y="-4" width="20" height="5" fill="#111" /></g>}
        {c.accessories.includes('hat') && <g transform="translate(150 70)"><path d="M-40 30 L0 -60 L40 30z" fill={pal[0]} /><circle cx="0" cy="-62" r="10" fill="#fde68a" /></g>}
        {c.accessories.includes('crown') && <path transform="translate(150 80)" d="M-45 20 L-45 -20 L-22 0 L0 -30 L22 0 L45 -20 L45 20z" fill="#fbbf24" />}
        {c.accessories.includes('scarf') && <rect x="95" y="215" width="110" height="24" rx="12" fill="#ef4444" />}
        {c.accessories.includes('headphones') && <g fill="none"><path d="M85 150 C 85 60, 215 60, 215 150" stroke="#111" strokeWidth="12" /><rect x="72" y="135" width="26" height="48" rx="12" fill="#111" /><rect x="202" y="135" width="26" height="48" rx="12" fill="#111" /></g>}
        {c.accessories.includes('helmet') && <circle cx="150" cy="165" r="95" fill="#bae6fd" opacity=".25" stroke="#e2e8f0" strokeWidth="8" />}
      </g>
    </svg>
  )
}

