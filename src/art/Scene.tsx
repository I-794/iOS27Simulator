/* Procedurally drawn "photographs". Every scene is original SVG artwork so the
 * simulator ships without third-party images. Scenes are drawn on a 400×300
 * (landscape) or 300×400 (portrait) canvas and cropped by the viewer. */
import { memo, useId, type ReactNode } from 'react'
import { GenImage } from './GenImage'

type Ctx = { id: (s: string) => string; W: number; H: number }

const lg = (id: string, stops: [string, number?][], vertical = true, x2?: number) => (
  <linearGradient id={id} x1="0" y1="0" x2={vertical ? 0 : x2 ?? 1} y2={vertical ? 1 : 0}>
    {stops.map(([c, o], i) => <stop key={i} offset={o ?? i / (stops.length - 1)} stopColor={c} />)}
  </linearGradient>
)
const rg = (id: string, stops: [string, number?, number?][], cx = 0.5, cy = 0.5, r = 0.5) => (
  <radialGradient id={id} cx={cx} cy={cy} r={r}>
    {stops.map(([c, o, op], i) => <stop key={i} offset={o ?? i / (stops.length - 1)} stopColor={c} stopOpacity={op ?? 1} />)}
  </radialGradient>
)

function Dog({ x, y, s = 1, pose = 'stand', color = '#d99a4e' }: { x: number; y: number; s?: number; pose?: 'stand' | 'lie' | 'run' | 'sit'; color?: string }) {
  const dark = '#b0773a'
  if (pose === 'lie') {
    return (
      <g transform={`translate(${x} ${y}) scale(${s})`}>
        <ellipse cx="0" cy="0" rx="62" ry="26" fill={color} />
        <ellipse cx="-20" cy="6" rx="40" ry="18" fill={dark} opacity=".25" />
        <circle cx="52" cy="-14" r="24" fill={color} />
        <ellipse cx="72" cy="-8" rx="14" ry="10" fill="#e8b273" />
        <ellipse cx="83" cy="-10" rx="4.5" ry="3.5" fill="#2a1b10" />
        <path d="M40 -30 q-14 8 -8 30 q10 -4 14 -22z" fill={dark} />
        <path d="M58 -18 q4 3 8 0" stroke="#2a1b10" strokeWidth="2" fill="none" strokeLinecap="round" />
        <path d="M-60 4 q-28 -2 -34 -18" stroke={color} strokeWidth="12" strokeLinecap="round" fill="none" />
        <ellipse cx="30" cy="22" rx="22" ry="7" fill={color} />
      </g>
    )
  }
  const legs = pose === 'run'
    ? <g stroke={color} strokeWidth="11" strokeLinecap="round"><path d="M-30 12 l-26 22" /><path d="M-18 14 l-10 30" /><path d="M26 12 l26 20" /><path d="M36 10 l30 6" /></g>
    : pose === 'sit'
      ? <g stroke={color} strokeWidth="11" strokeLinecap="round"><path d="M22 10 v36" /><path d="M34 10 v36" /><path d="M-28 20 q-6 18 10 26" /></g>
      : <g stroke={color} strokeWidth="11" strokeLinecap="round"><path d="M-34 10 v38" /><path d="M-20 12 v36" /><path d="M24 12 v36" /><path d="M36 10 v38" /></g>
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      {legs}
      <path d={pose === 'run' ? 'M-46 -6 q-30 -18 -44 -4' : 'M-46 -6 q-26 -26 -40 -18'} stroke={color} strokeWidth="11" strokeLinecap="round" fill="none" />
      <ellipse cx="0" cy={pose === 'sit' ? -4 : 0} rx="52" ry="24" fill={color} transform={pose === 'sit' ? 'rotate(-28)' : undefined} />
      <ellipse cx="-6" cy="8" rx="36" ry="12" fill={dark} opacity=".2" />
      <g transform={pose === 'sit' ? 'translate(4 -34)' : undefined}>
        <circle cx="50" cy="-22" r="22" fill={color} />
        <ellipse cx="68" cy="-15" rx="14" ry="10" fill="#e8b273" />
        <ellipse cx="80" cy="-18" rx="5" ry="4" fill="#2a1b10" />
        <circle cx="54" cy="-29" r="3.2" fill="#2a1b10" />
        <circle cx="55" cy="-30" r="1" fill="#fff" />
        <path d="M36 -38 q-16 10 -8 34 q12 -4 14 -26z" fill={dark} />
        {pose === 'run' && <path d="M70 -6 q4 10 10 8" fill="#ff7a8a" />}
      </g>
    </g>
  )
}

function Person({ x, y, s = 1, shirt = '#3b82f6', hair = '#2a1b10', skin = '#c68b59', back = false }: { x: number; y: number; s?: number; shirt?: string; hair?: string; skin?: string; back?: boolean }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M-26 70 q0 -48 26 -48 q26 0 26 48z" fill={shirt} />
      <rect x="-6" y="10" width="12" height="14" fill={skin} />
      <circle cx="0" cy="0" r="17" fill={skin} />
      <path d={back ? 'M-18 2 q0 -22 18 -22 q18 0 18 22 q-2 8 -18 8 q-16 0 -18 -8z' : 'M-18 0 q0 -20 18 -20 q18 0 18 20 q-6 -10 -18 -10 q-12 0 -18 10z'} fill={hair} />
      {!back && <g fill="#2a1b10"><circle cx="-6" cy="2" r="1.8" /><circle cx="6" cy="2" r="1.8" /><path d="M-5 9 q5 4 10 0" stroke="#7a3f2a" strokeWidth="1.6" fill="none" strokeLinecap="round" /></g>}
    </g>
  )
}

function Tree({ x, y, s = 1, c = '#2f7d3a', trunk = '#5b3a24' }: { x: number; y: number; s?: number; c?: string; trunk?: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <rect x="-4" y="0" width="8" height="30" fill={trunk} />
      <circle cx="0" cy="-10" r="22" fill={c} />
      <circle cx="-14" cy="0" r="14" fill={c} />
      <circle cx="14" cy="-2" r="15" fill={c} />
      <circle cx="-6" cy="-18" r="10" fill="#fff" opacity=".08" />
    </g>
  )
}

function Pine({ x, y, s = 1, c = '#1f3b2c' }: { x: number; y: number; s?: number; c?: string }) {
  return <path transform={`translate(${x} ${y}) scale(${s})`} d="M0 -60 L14 -30 L8 -30 L20 -8 L10 -8 L24 16 L-24 16 L-10 -8 L-20 -8 L-8 -30 L-14 -30z" fill={c} />
}

const scenes: Record<string, { portrait?: boolean; draw: (c: Ctx) => ReactNode }> = {
  'dog-couch': { portrait: true, draw: ({ id }) => (<>
    <defs>{lg(id('w'), [['#e9ddcc'], ['#cdb99f']])}{rg(id('l'), [['#fff6dd', 0, 0.9], ['#fff6dd', 1, 0]], 0.8, 0.1, 0.6)}</defs>
    <rect width="300" height="400" fill={`url(#${id('w')})`} />
    <rect x="200" y="30" width="80" height="120" rx="4" fill="#f8f1e2" stroke="#bfa98a" strokeWidth="4" />
    <rect width="300" height="400" fill={`url(#${id('l')})`} />
    <rect x="0" y="210" width="300" height="190" rx="30" fill="#8a8f98" />
    <rect x="0" y="170" width="300" height="80" rx="30" fill="#9aa0a9" />
    <path d="M20 250 q60 -30 150 -10 q60 14 110 -6 v160 h-260z" fill="#c9785b" opacity=".9" />
    <Dog x={140} y={265} s={1.1} pose="lie" />
    <rect x="0" y="360" width="300" height="40" fill="#5d6068" />
  </>) },
  drumline: { draw: ({ id }) => (<>
    <defs>{lg(id('s'), [['#8fc6ff'], ['#e6f2ff']])}{lg(id('g'), [['#4c9a3f'], ['#2f6e2a']])}</defs>
    <rect width="400" height="300" fill={`url(#${id('s')})`} />
    <rect y="170" width="400" height="130" fill={`url(#${id('g')})`} />
    {[0, 1, 2, 3, 4, 5].map((i) => <line key={i} x1={i * 80} y1="170" x2={i * 80 - 60} y2="300" stroke="#fff" strokeOpacity=".5" strokeWidth="2" />)}
    <rect x="0" y="120" width="400" height="50" fill="#b8c3cc" /><rect x="0" y="118" width="400" height="6" fill="#8a96a1" />
    {[[100, '#1f2a44'], [200, '#8b1e2d'], [300, '#1f2a44']].map(([x, c], i) => (<g key={i}>
      <Person x={x as number} y={150} s={1.25} shirt={c as string} hair={['#2a1b10', '#111', '#5a3a1a'][i]} skin={['#8d5a3b', '#c68b59', '#e0ac7e'][i]} />
      <ellipse cx={x as number} cy={232} rx="30" ry="9" fill="#e9e9ee" /><rect x={(x as number) - 30} y={232} width="60" height="26" fill="#c0c4cc" /><ellipse cx={x as number} cy={258} rx="30" ry="9" fill="#9aa0a9" />
    </g>))}
  </>) },
  'robot-workshop': { draw: ({ id }) => (<>
    <defs>{lg(id('w'), [['#3a3f47'], ['#23262b']])}{rg(id('lamp'), [['#fff2c9', 0, 0.8], ['#fff2c9', 1, 0]], 0.5, 0.15, 0.5)}</defs>
    <rect width="400" height="300" fill={`url(#${id('w')})`} />
    <rect x="20" y="30" width="360" height="110" fill="#2d3138" stroke="#444a53" />
    {Array.from({ length: 12 }).map((_, i) => <rect key={i} x={40 + i * 28} y={50 + (i % 3) * 10} width="6" height={40 + (i % 4) * 8} rx="2" fill={['#e74c3c', '#f1c40f', '#3498db', '#95a5a6'][i % 4]} />)}
    <rect x="0" y="200" width="400" height="100" fill="#6b4f35" /><rect x="0" y="196" width="400" height="8" fill="#8a6a4a" />
    <rect x="110" y="130" width="180" height="70" rx="6" fill="#9aa4ae" />
    <rect x="120" y="140" width="160" height="46" rx="4" fill="#2c3e50" />
    <rect x="130" y="120" width="140" height="20" rx="3" fill="#7f8c8d" />
    {[0, 1, 2].map((i) => <rect key={i} x="95" y={128 + i * 16} width="210" height="10" rx="5" fill="#ff7a1a" transform="skewX(-8)" />)}
    <circle cx="140" cy="202" r="16" fill="#1c1c1e" /><circle cx="140" cy="202" r="6" fill="#95a5a6" />
    <circle cx="260" cy="202" r="16" fill="#1c1c1e" /><circle cx="260" cy="202" r="6" fill="#95a5a6" />
    <rect x="150" y="150" width="30" height="16" rx="2" fill="#27ae60" /><circle cx="230" cy="158" r="5" fill="#e74c3c" />
    <rect x="30" y="230" width="60" height="10" rx="3" fill="#c0392b" transform="rotate(-12 60 235)" />
    <rect x="310" y="226" width="70" height="30" rx="4" fill="#34495e" />
    <rect width="400" height="300" fill={`url(#${id('lamp')})`} />
  </>) },
  handwritten: { portrait: true, draw: ({ id }) => (<>
    <defs>{lg(id('d'), [['#8b6a4a'], ['#6f5236']])}</defs>
    <rect width="300" height="400" fill={`url(#${id('d')})`} />
    <g transform="rotate(-4 150 200)">
      <rect x="30" y="40" width="240" height="320" fill="#fdfbf3" />
      {Array.from({ length: 13 }).map((_, i) => <line key={i} x1="30" x2="270" y1={80 + i * 22} y2={80 + i * 22} stroke="#a9c8e8" strokeWidth="1" />)}
      <line x1="62" x2="62" y1="40" y2="360" stroke="#f0a0a0" />
      <g fontFamily="'Bradley Hand','Segoe Print','Comic Sans MS',cursive" fill="#1f3a8a" fontSize="17">
        <text x="72" y="76" fontSize="21">Robotics —</text>
        <text x="80" y="120">• zip ties</text>
        <text x="80" y="142">• laptop charger</text>
        <text x="80" y="164">• safety glasses</text>
        <text x="80" y="186">• build log</text>
        <text x="72" y="230" fontSize="22" fill="#b91c1c">Thurs 6:30!</text>
        <text x="72" y="274">Rm 114</text>
      </g>
    </g>
  </>) },
  'food-pizza': { draw: ({ id }) => (<>
    <defs>{rg(id('b'), [['#2d1d14'], ['#120b07']])}{rg(id('p'), [['#f4c16b'], ['#d98c3a', 0.85], ['#b86a24', 1]])}</defs>
    <rect width="400" height="300" fill={`url(#${id('b')})`} />
    <rect x="60" y="20" width="280" height="260" rx="20" fill="#a0703f" /><rect x="320" y="130" width="70" height="30" rx="10" fill="#a0703f" />
    <circle cx="200" cy="150" r="118" fill={`url(#${id('p')})`} />
    <circle cx="200" cy="150" r="100" fill="#c83a24" />
    {[[160, 110], [240, 120], [200, 180], [150, 175], [250, 190], [205, 95], [215, 140]].map(([x, y], i) => <ellipse key={i} cx={x} cy={y} rx="20" ry="16" fill="#fbf1d9" />)}
    {[[180, 130], [230, 160], [170, 200], [260, 110]].map(([x, y], i) => <path key={i} d={`M${x} ${y} q10 -14 20 0 q-10 10 -20 0z`} fill="#2e8b3a" />)}
  </>) },
  receipt: { portrait: true, draw: ({ id }) => (<>
    <defs>{lg(id('t'), [['#39302a'], ['#1e1915']])}</defs>
    <rect width="300" height="400" fill={`url(#${id('t')})`} />
    <g transform="rotate(2 150 200)">
      <path d="M50 20 h200 v350 l-10 8 -10 -8 -10 8 -10 -8 -10 8 -10 -8 -10 8 -10 -8 -10 8 -10 -8 -10 8 -10 -8 -10 8 -10 -8 -10 8 -10 -8 -10 8 -10 -8 -10 8 -10 -8z" fill="#fbfaf6" />
      <g fontFamily="'Courier New',monospace" fill="#222" fontSize="11">
        <text x="150" y="48" textAnchor="middle" fontSize="15" fontWeight="700">ROSA'S TRATTORIA</text>
        <text x="150" y="64" textAnchor="middle">218 Main St · Maple Grove</text>
        <text x="150" y="78" textAnchor="middle">Table 12 · Server: Luca</text>
        <line x1="62" x2="238" y1="90" y2="90" stroke="#999" strokeDasharray="3 3" />
        {[['Margherita Pizza', '18.00'], ['Rigatoni Vodka', '19.50'], ['Caesar Salad', '11.00'], ['Garlic Knots', '7.50'], ['Lemonade x2', '8.00']].map(([a, b], i) => (
          <g key={i}><text x="64" y={110 + i * 18}>{a}</text><text x="236" y={110 + i * 18} textAnchor="end">{b}</text></g>
        ))}
        <line x1="62" x2="238" y1="200" y2="200" stroke="#999" strokeDasharray="3 3" />
        <text x="64" y="218">Subtotal</text><text x="236" y="218" textAnchor="end">64.00</text>
        <text x="64" y="236">Tax 8%</text><text x="236" y="236" textAnchor="end">5.12</text>
        <text x="64" y="254">Tip 27%</text><text x="236" y="254" textAnchor="end">17.28</text>
        <text x="64" y="282" fontSize="15" fontWeight="700">TOTAL</text><text x="236" y="282" textAnchor="end" fontSize="15" fontWeight="700">$86.40</text>
        <text x="150" y="316" textAnchor="middle">VISA ****9021</text>
        <text x="150" y="340" textAnchor="middle">Grazie! Party of 4</text>
      </g>
    </g>
  </>) },
  'dog-park': { draw: ({ id }) => (<>
    <defs>{lg(id('s'), [['#9fd3ff'], ['#e4f4ff']])}{lg(id('g'), [['#7bc043'], ['#3f8f2f']])}</defs>
    <rect width="400" height="300" fill={`url(#${id('s')})`} />
    <Tree x={40} y={150} s={1.4} /><Tree x={340} y={140} s={1.6} c="#3a8f45" /><Tree x={290} y={160} s={1} c="#2b6e33" />
    <path d="M0 170 q200 -30 400 0 v130 h-400z" fill={`url(#${id('g')})`} />
    <Dog x={180} y={210} s={1} pose="run" />
    <circle cx="310" cy="226" r="9" fill="#d9f24a" /><path d="M303 222 q7 5 14 0" stroke="#fff" strokeWidth="1.5" fill="none" />
  </>) },
  'plant-sunflower': { portrait: true, draw: ({ id }) => (<>
    <defs>{lg(id('s'), [['#3d8bff'], ['#bfe0ff']])}</defs>
    <rect width="300" height="400" fill={`url(#${id('s')})`} />
    {[[90, 120, 1], [200, 90, 1.2], [250, 200, 0.8], [60, 240, 0.9]].map(([x, y, s], i) => (
      <g key={i}>
        <path d={`M${x} ${y} q-6 150 10 ${400 - y}`} stroke="#2f7d3a" strokeWidth={7 * s} fill="none" />
        <ellipse cx={x + 22 * s} cy={y + 80} rx={24 * s} ry={10 * s} fill="#3a8f45" transform={`rotate(-30 ${x + 22 * s} ${y + 80})`} />
        <g transform={`translate(${x} ${y}) scale(${s})`}>
          {Array.from({ length: 16 }).map((_, k) => <ellipse key={k} cx="0" cy="-34" rx="9" ry="22" fill={k % 2 ? '#ffc400' : '#ffd84d'} transform={`rotate(${k * 22.5})`} />)}
          <circle r="22" fill="#5a3413" /><circle r="14" fill="#3e230c" />
        </g>
      </g>
    ))}
  </>) },
  'robot-arena': { draw: ({ id }) => (<>
    <defs>{lg(id('a'), [['#0e1320'], ['#1b2335']])}</defs>
    <rect width="400" height="300" fill={`url(#${id('a')})`} />
    {Array.from({ length: 8 }).map((_, i) => <circle key={i} cx={30 + i * 50} cy="20" r="10" fill="#fff" opacity=".5" />)}
    <path d="M20 120 L380 120 L400 300 L0 300z" fill="#5a6474" />
    <path d="M20 120 L80 120 L40 300 L0 300z" fill="#1e5bd8" opacity=".85" /><path d="M320 120 L380 120 L400 300 L360 300z" fill="#d8321e" opacity=".85" />
    <line x1="200" y1="120" x2="200" y2="300" stroke="#fff" strokeWidth="3" />
    {[[140, 200, '#1e5bd8'], [260, 170, '#d8321e'], [220, 240, '#1e5bd8']].map(([x, y, c], i) => (
      <g key={i}><rect x={(x as number) - 26} y={(y as number) - 16} width="52" height="32" rx="4" fill="#2c2c2e" /><rect x={(x as number) - 26} y={(y as number) - 16} width="52" height="8" fill={c as string} /><rect x={(x as number) - 30} y={(y as number) + 8} width="60" height="6" rx="3" fill="#ff7a1a" /></g>
    ))}
    <text x="200" y="100" textAnchor="middle" fill="#fff" fontFamily="var(--font-text)" fontSize="14" fontWeight="700">QUAL 14 · 0:47</text>
  </>) },
  'family-dinner': { draw: ({ id }) => (<>
    <defs>{rg(id('r'), [['#ffd9a0'], ['#6a3e22']], 0.5, 0.3, 0.7)}</defs>
    <rect width="400" height="300" fill={`url(#${id('r')})`} />
    <Person x={80} y={110} s={1.1} shirt="#c0392b" hair="#111" skin="#e0ac7e" />
    <Person x={170} y={100} s={1.15} shirt="#2c3e50" hair="#2a1b10" skin="#d5a07a" />
    <Person x={250} y={105} s={1.05} shirt="#8e44ad" hair="#3b2412" skin="#e8b78d" />
    <Person x={330} y={112} s={1} shirt="#16a085" hair="#ccc" skin="#e8b78d" />
    <ellipse cx="200" cy="250" rx="220" ry="70" fill="#f4efe6" />
    {[[110, 240], [200, 230], [290, 244]].map(([x, y], i) => <g key={i}><ellipse cx={x} cy={y} rx="34" ry="14" fill="#fff" stroke="#ddd" /><ellipse cx={x} cy={y - 3} rx="22" ry="8" fill={['#e67e22', '#27ae60', '#c0392b'][i]} /></g>)}
    {[150, 250].map((x) => <g key={x}><rect x={x - 3} y="190" width="6" height="34" fill="#fff8e7" /><ellipse cx={x} cy="186" rx="4" ry="8" fill="#ffcc4d" /></g>)}
  </>) },
  'autumn-trees': { portrait: true, draw: ({ id }) => (<>
    <defs>{lg(id('s'), [['#f7d9a8'], ['#f0b27a']])}</defs>
    <rect width="300" height="400" fill={`url(#${id('s')})`} />
    {[[40, 170, '#d35400'], [110, 140, '#e67e22'], [190, 160, '#c0392b'], [260, 150, '#f39c12'], [70, 240, '#e74c3c'], [240, 250, '#d35400']].map(([x, y, c], i) => <Tree key={i} x={x as number} y={y as number} s={1.8} c={c as string} trunk="#3e2a1c" />)}
    <path d="M110 400 L140 250 L160 250 L200 400z" fill="#c8a27a" />
    {Array.from({ length: 30 }).map((_, i) => <ellipse key={i} cx={(i * 37) % 300} cy={300 + ((i * 53) % 100)} rx="5" ry="3" fill={['#e67e22', '#c0392b', '#f1c40f'][i % 3]} />)}
  </>) },
  'dog-beach': { draw: ({ id }) => (<>
    <defs>{lg(id('s'), [['#ff9a5c'], ['#ffc98b', 0.5], ['#fbe3c2']])}{lg(id('w'), [['#3d7fb8'], ['#7fb6d9']])}{rg(id('sun'), [['#fff3c4'], ['#ffb347', 0.4], ['#ffb347', 1, 0]], 0.5, 0.5, 0.5)}</defs>
    <rect width="400" height="300" fill={`url(#${id('s')})`} />
    <circle cx="300" cy="120" r="60" fill={`url(#${id('sun')})`} />
    <rect y="140" width="400" height="60" fill={`url(#${id('w')})`} />
    <path d="M0 190 q50 -10 100 0 t100 0 t100 0 t100 0 v20 h-400z" fill="#f4f7fa" opacity=".8" />
    <rect y="200" width="400" height="100" fill="#e8c89a" />
    <path d="M0 205 q100 10 200 0 t200 0 v10 h-400z" fill="#cfae7e" opacity=".6" />
    <Dog x={170} y={228} s={0.9} pose="run" />
    {[[60, 260], [280, 270], [330, 250]].map(([x, y], i) => <ellipse key={i} cx={x} cy={y} rx="3" ry="1.5" fill="#b89366" />)}
  </>) },
  'sunset-beach': { draw: ({ id }) => (<>
    <defs>{lg(id('s'), [['#2b1e5a'], ['#c44d7a', 0.45], ['#ff9a5c', 0.75], ['#ffd08a']])}{lg(id('w'), [['#f59a6a'], ['#3c2a5c']])}</defs>
    <rect width="400" height="300" fill={`url(#${id('s')})`} />
    <circle cx="200" cy="170" r="34" fill="#ffe3a3" />
    {[[80, 60, 90], [260, 80, 120], [150, 110, 70]].map(([x, y, w], i) => <ellipse key={i} cx={x} cy={y} rx={w} ry="10" fill="#ff8fa3" opacity=".45" />)}
    <rect y="170" width="400" height="130" fill={`url(#${id('w')})`} />
    {Array.from({ length: 10 }).map((_, i) => <rect key={i} x={190 - i * 3} y={178 + i * 11} width={20 + i * 6} height="3" fill="#ffe3a3" opacity={0.7 - i * 0.06} />)}
  </>) },
  'plant-monstera': { portrait: true, draw: ({ id }) => (<>
    <defs>{lg(id('w'), [['#f4f1ea'], ['#e3ddd0']])}</defs>
    <rect width="300" height="400" fill={`url(#${id('w')})`} />
    <rect x="170" y="20" width="110" height="160" fill="#dff0ff" stroke="#fff" strokeWidth="8" />
    {[[-40, 150, 150], [30, 160, 120], [-10, 110, 110], [60, 130, 170], [-70, 170, 190]].map(([r, x, y], i) => (
      <g key={i} transform={`translate(${x} ${y}) rotate(${r})`}>
        <path d="M0 0 C -50 -20 -60 -90 0 -110 C 60 -90 50 -20 0 0z" fill={['#2e7d32', '#388e3c', '#1b5e20', '#43a047', '#2e7d32'][i]} />
        <path d="M0 0 V-105" stroke="#a5d6a7" strokeWidth="2" />
        {[-30, -55, -80].map((yy) => <g key={yy}><path d={`M-40 ${yy} q15 5 30 0`} stroke="#f4f1ea" strokeWidth="5" fill="none" /><path d={`M40 ${yy} q-15 5 -30 0`} stroke="#f4f1ea" strokeWidth="5" fill="none" /></g>)}
      </g>
    ))}
    <path d="M100 270 h100 l-12 110 h-76z" fill="#fafafa" stroke="#ddd" />
    <rect y="380" width="300" height="20" fill="#c9b79c" />
  </>) },
  storm: { draw: ({ id }) => (<>
    <defs>{lg(id('s'), [['#1a1f2b'], ['#3b4252', 0.6], ['#5c667a']])}<filter id={id('glow')}><feGaussianBlur stdDeviation="4" /></filter></defs>
    <rect width="400" height="300" fill={`url(#${id('s')})`} />
    {[[80, 60, 110], [220, 50, 140], [330, 80, 100], [150, 100, 120]].map(([x, y, r], i) => <ellipse key={i} cx={x} cy={y} rx={r} ry={r * 0.35} fill="#2a303c" opacity=".9" />)}
    <path d="M230 90 L210 150 L228 150 L200 230 L250 135 L230 135 L250 90z" fill="#e8f0ff" filter={`url(#${id('glow')})`} />
    <path d="M230 90 L210 150 L228 150 L200 230 L250 135 L230 135 L250 90z" fill="#fff" />
    <rect y="230" width="400" height="70" fill="#2d3a24" />
    <path d="M0 230 q100 -12 200 0 t200 0 v10 h-400z" fill="#3f5232" />
    {Array.from({ length: 40 }).map((_, i) => <line key={i} x1={(i * 23) % 400} y1={(i * 41) % 230} x2={(i * 23) % 400 - 6} y2={(i * 41) % 230 + 18} stroke="#a9b8cf" strokeOpacity=".35" />)}
  </>) },
  'product-headphones': { draw: ({ id }) => (<>
    <defs>{rg(id('b'), [['#ffffff'], ['#e8e8ea']])}</defs>
    <rect width="400" height="300" fill={`url(#${id('b')})`} />
    <ellipse cx="200" cy="262" rx="120" ry="12" fill="#000" opacity=".08" />
    <path d="M110 170 C 110 60, 290 60, 290 170" stroke="#9fb5a3" strokeWidth="18" fill="none" strokeLinecap="round" />
    <path d="M118 150 C 125 90, 275 90, 282 150" stroke="#c9d6cb" strokeWidth="6" fill="none" />
    <rect x="86" y="150" width="56" height="96" rx="26" fill="#8fa693" /><rect x="96" y="160" width="36" height="76" rx="18" fill="#6d8471" />
    <rect x="258" y="150" width="56" height="96" rx="26" fill="#8fa693" /><rect x="268" y="160" width="36" height="76" rx="18" fill="#6d8471" />
  </>) },
  'food-ramen': { draw: ({ id }) => (<>
    <defs>{rg(id('b'), [['#3b2a20'], ['#140d09']])}{rg(id('s'), [['#f2c078'], ['#c8813d']])}</defs>
    <rect width="400" height="300" fill={`url(#${id('b')})`} />
    <ellipse cx="200" cy="160" rx="150" ry="120" fill="#1c1c1e" />
    <ellipse cx="200" cy="155" rx="130" ry="102" fill={`url(#${id('s')})`} />
    {Array.from({ length: 12 }).map((_, i) => <path key={i} d={`M${110 + i * 14} 140 q10 30 0 60`} stroke="#f6e3a6" strokeWidth="5" fill="none" />)}
    <circle cx="160" cy="120" r="26" fill="#fff" /><circle cx="160" cy="120" r="14" fill="#f5a623" />
    <ellipse cx="250" cy="120" rx="40" ry="26" fill="#c98b62" /><ellipse cx="250" cy="120" rx="30" ry="18" fill="#e8b48f" />
    {Array.from({ length: 14 }).map((_, i) => <circle key={i} cx={180 + ((i * 29) % 90)} cy={175 + ((i * 17) % 40)} r="4" fill="#4caf50" />)}
    <rect x="240" y="170" width="70" height="36" fill="#1a2a1a" rx="3" transform="rotate(20 275 188)" />
  </>) },
  'screenshot-chart': { portrait: true, draw: () => (<>
    <rect width="300" height="400" fill="#fff" />
    <rect width="300" height="30" fill="#f2f2f7" />
    <text x="20" y="60" fontFamily="var(--font-text)" fontSize="18" fontWeight="700" fill="#000">Team 7729 — Points per Match</text>
    <line x1="40" y1="330" x2="280" y2="330" stroke="#c7c7cc" />
    {[42, 51, 58, 66, 79, 88].map((v, i) => (
      <g key={i}>
        <rect x={50 + i * 38} y={330 - v * 2.8} width="24" height={v * 2.8} rx="4" fill={i === 5 ? '#34c759' : '#0a84ff'} />
        <text x={62 + i * 38} y={322 - v * 2.8} textAnchor="middle" fontSize="11" fontFamily="var(--font-text)" fill="#3c3c43">{v}</text>
        <text x={62 + i * 38} y="348" textAnchor="middle" fontSize="11" fontFamily="var(--font-text)" fill="#8e8e93">Q{i + 1}</text>
      </g>
    ))}
    <text x="20" y="380" fontSize="12" fontFamily="var(--font-text)" fill="#8e8e93">Average +9.2 pts per match</text>
  </>) },
  'food-pancakes': { draw: ({ id }) => (<>
    <defs>{lg(id('t'), [['#f5efe6'], ['#e7dccb']])}</defs>
    <rect width="400" height="300" fill={`url(#${id('t')})`} />
    <ellipse cx="200" cy="200" rx="140" ry="60" fill="#fff" stroke="#e1d6c4" strokeWidth="3" />
    {[0, 1, 2, 3, 4].map((i) => <ellipse key={i} cx="200" cy={200 - i * 18} rx="90" ry="28" fill={i % 2 ? '#e0a45c' : '#d18f45'} />)}
    <ellipse cx="200" cy="120" rx="90" ry="28" fill="#e7b16a" />
    <path d="M150 115 q50 30 100 0 q-10 60 -20 70 q-10 -40 -30 -40 q-20 0 -30 30z" fill="#9c5a1a" opacity=".7" />
    {Array.from({ length: 9 }).map((_, i) => <circle key={i} cx={165 + ((i * 17) % 70)} cy={110 + ((i * 7) % 16)} r="6" fill="#3b4cc0" />)}
    <rect x="200" y="100" width="18" height="12" fill="#fff5c7" rx="2" />
  </>) },
  'soccer-field': { draw: ({ id }) => (<>
    <defs>{lg(id('s'), [['#8ecaff'], ['#dff1ff']])}</defs>
    <rect width="400" height="300" fill={`url(#${id('s')})`} />
    <rect y="130" width="400" height="170" fill="#3f9b3a" />
    {[0, 1, 2, 3, 4].map((i) => <rect key={i} x={i * 80} y="130" width="40" height="170" fill="#48a843" />)}
    <rect x="300" y="100" width="90" height="50" fill="none" stroke="#fff" strokeWidth="4" />
    <Person x={170} y={150} s={1.3} shirt="#f39c12" hair="#111" skin="#e0ac7e" />
    <rect x="152" y="238" width="10" height="36" fill="#1c1c1e" /><rect x="178" y="238" width="10" height="36" fill="#1c1c1e" transform="rotate(20 183 238)" />
    <circle cx="225" cy="272" r="13" fill="#fff" /><path d="M219 268 l6 -4 6 4 -2 7 h-8z" fill="#1c1c1e" />
  </>) },
  'product-sneakers': { draw: ({ id }) => (<>
    <defs>{lg(id('b'), [['#dfe9f5'], ['#b9cde6']])}</defs>
    <rect width="400" height="300" fill={`url(#${id('b')})`} />
    {[[70, 150], [190, 175]].map(([x, y], i) => (
      <g key={i} transform={`translate(${x} ${y})`}>
        <path d="M0 50 C 0 10, 40 0, 60 0 L 90 30 C 120 40, 150 40, 150 60 L 150 70 H0z" fill="#fff" />
        <path d="M0 62 H150 V74 H0z" fill="#e5e5ea" />
        <path d="M60 10 L100 45 L70 55 L40 25z" fill="#0a84ff" />
        {[0, 1, 2].map((k) => <line key={k} x1={62 + k * 8} y1={8 + k * 7} x2={80 + k * 8} y2={2 + k * 7} stroke="#999" strokeWidth="2" />)}
      </g>
    ))}
  </>) },
  'selfie-group': { portrait: true, draw: ({ id }) => (<>
    <defs>{lg(id('s'), [['#6ab7ff'], ['#ffd6a5']])}</defs>
    <rect width="300" height="400" fill={`url(#${id('s')})`} />
    <g opacity=".7" transform="translate(220 110)"><circle r="70" fill="none" stroke="#e74c3c" strokeWidth="5" />{Array.from({ length: 8 }).map((_, i) => <line key={i} x1="0" y1="0" x2={Math.cos(i * 0.785) * 70} y2={Math.sin(i * 0.785) * 70} stroke="#e74c3c" strokeWidth="3" />)}</g>
    <Person x={70} y={250} s={2} shirt="#ff7a45" hair="#111" skin="#b07350" />
    <Person x={230} y={250} s={2} shirt="#2bd67b" hair="#1c1109" skin="#6b4226" />
    <Person x={150} y={230} s={2.3} shirt="#3a8dff" hair="#2a1b10" skin="#e0ac7e" />
  </>) },
  'food-coffee': { portrait: true, draw: ({ id }) => (<>
    <defs>{lg(id('t'), [['#8b5a2b'], ['#5b3a1e']])}{rg(id('c'), [['#f5e6d3'], ['#c68e5b', 0.75], ['#7a4a22', 1]])}</defs>
    <rect width="300" height="400" fill={`url(#${id('t')})`} />
    <ellipse cx="150" cy="220" rx="120" ry="100" fill="#f7f4ef" />
    <ellipse cx="150" cy="210" rx="92" ry="76" fill="#fff" />
    <ellipse cx="150" cy="205" rx="78" ry="62" fill={`url(#${id('c')})`} />
    <path d="M150 240 C 110 200, 120 170, 150 190 C 180 170, 190 200, 150 240z" fill="#fbf2e6" />
    <path d="M232 200 q40 0 40 30 q0 30 -40 20" stroke="#fff" strokeWidth="12" fill="none" />
  </>) },
  'city-night': { draw: ({ id }) => (<>
    <defs>{lg(id('s'), [['#05070f'], ['#1a2350']])}{lg(id('w'), [['#0d1330'], ['#05070f']])}</defs>
    <rect width="400" height="300" fill={`url(#${id('s')})`} />
    {Array.from({ length: 40 }).map((_, i) => <circle key={i} cx={(i * 97) % 400} cy={(i * 31) % 100} r=".8" fill="#fff" opacity=".6" />)}
    {[[20, 90], [60, 130], [100, 70], [150, 110], [200, 50], [245, 100], [290, 80], [340, 120], [370, 95]].map(([x, h], i) => (
      <g key={i}>
        <rect x={x} y={190 - h} width="42" height={h} fill="#141a33" />
        {Array.from({ length: Math.floor(h / 12) * 3 }).map((_, k) => <rect key={k} x={x + 5 + (k % 3) * 12} y={196 - h + Math.floor(k / 3) * 12} width="6" height="6" fill={(k * 7 + i) % 5 ? '#ffd27a' : '#1f2749'} opacity=".85" />)}
      </g>
    ))}
    <rect y="190" width="400" height="110" fill={`url(#${id('w')})`} />
    {Array.from({ length: 30 }).map((_, i) => <rect key={i} x={(i * 53) % 400} y={200 + ((i * 13) % 90)} width="16" height="2" fill="#ffd27a" opacity=".35" />)}
  </>) },
  'cat-window': { portrait: true, draw: ({ id }) => (<>
    <defs>{lg(id('l'), [['#fff5d6'], ['#ffd98a']])}</defs>
    <rect width="300" height="400" fill="#e9e1d4" />
    <rect x="40" y="40" width="220" height="220" fill={`url(#${id('l')})`} stroke="#fff" strokeWidth="10" />
    <line x1="150" y1="40" x2="150" y2="260" stroke="#fff" strokeWidth="8" /><line x1="40" y1="150" x2="260" y2="150" stroke="#fff" strokeWidth="8" />
    <rect x="20" y="260" width="260" height="20" fill="#d9cfbf" />
    <g transform="translate(150 230)">
      <ellipse cx="0" cy="10" rx="50" ry="40" fill="#7d7f86" />
      <circle cx="0" cy="-40" r="32" fill="#8a8c93" />
      <path d="M-28 -60 L-22 -86 L-6 -68z M28 -60 L22 -86 L6 -68z" fill="#8a8c93" />
      {[-12, 12].map((x) => <ellipse key={x} cx={x} cy="-42" rx="6" ry="7" fill="#c7e36b" />)}
      {[-12, 12].map((x) => <ellipse key={x} cx={x} cy="-42" rx="1.6" ry="6" fill="#111" />)}
      <path d="M-4 -30 h8 l-4 4z" fill="#e89aa0" />
      {[-30, -20, -10].map((y) => <path key={y} d={`M-40 ${y} q40 -10 80 0`} stroke="#5f6168" strokeWidth="3" fill="none" />)}
      <path d="M45 30 q40 10 30 -30" stroke="#7d7f86" strokeWidth="12" fill="none" strokeLinecap="round" />
    </g>
  </>) },
  'mountain-lake': { draw: ({ id }) => (<>
    <defs>{lg(id('s'), [['#79b8ff'], ['#e8f3ff']])}{lg(id('w'), [['#6aa3d8'], ['#2b5d8a']])}</defs>
    <rect width="400" height="300" fill={`url(#${id('s')})`} />
    <path d="M0 170 L70 80 L120 130 L190 40 L260 120 L320 70 L400 150 V180 H0z" fill="#6d7b8f" />
    <path d="M170 64 L190 40 L212 66 L200 62 L190 70 L180 62z M52 102 L70 80 L86 102 L76 98 L70 104z M300 88 L320 70 L338 90 L328 86 L320 92z" fill="#fff" />
    <path d="M0 175 L400 175 V185 H0z" fill="#2f4f3a" />
    {Array.from({ length: 22 }).map((_, i) => <Pine key={i} x={i * 19} y={168} s={0.5 + ((i * 7) % 5) / 12} />)}
    <rect y="185" width="400" height="115" fill={`url(#${id('w')})`} />
    <g opacity=".35" transform="translate(0 370) scale(1 -1)"><path d="M0 170 L70 80 L120 130 L190 40 L260 120 L320 70 L400 150 V185 H0z" fill="#9fb4cc" /></g>
  </>) },
  'panorama-canyon': { draw: ({ id }) => (<>
    <defs>{lg(id('s'), [['#8ec5ff'], ['#ffe2c2']])}</defs>
    <rect width="400" height="300" fill={`url(#${id('s')})`} />
    <path d="M0 140 L40 120 L60 150 L110 110 L150 150 L200 120 L260 150 L300 110 L350 140 L400 115 V300 H0z" fill="#c1502e" />
    <path d="M0 180 L60 165 L120 190 L200 160 L280 195 L340 170 L400 185 V300 H0z" fill="#9e3b22" />
    <path d="M0 230 L100 215 L200 240 L300 220 L400 235 V300 H0z" fill="#7a2d1a" />
    {[130, 170, 210].map((y) => <path key={y} d={`M0 ${y} q200 -10 400 0`} stroke="#e4875e" strokeOpacity=".4" fill="none" />)}
  </>) },
  fireworks: { draw: ({ id }) => (<>
    <defs>{lg(id('s'), [['#030514'], ['#101a40']])}</defs>
    <rect width="400" height="300" fill={`url(#${id('s')})`} />
    {[[100, 90, '#ff5c8a'], [250, 70, '#ffd60a'], [320, 130, '#5ac8fa'], [170, 140, '#bf5af2']].map(([x, y, c], i) => (
      <g key={i}>{Array.from({ length: 24 }).map((_, k) => { const a = (k / 24) * Math.PI * 2; return <line key={k} x1={(x as number) + Math.cos(a) * 8} y1={(y as number) + Math.sin(a) * 8} x2={(x as number) + Math.cos(a) * 46} y2={(y as number) + Math.sin(a) * 46} stroke={c as string} strokeWidth="2" strokeLinecap="round" opacity=".9" /> })}</g>
    ))}
    <rect y="220" width="400" height="80" fill="#050a1c" />
    {[[100, '#ff5c8a'], [250, '#ffd60a'], [320, '#5ac8fa']].map(([x, c], i) => <rect key={i} x={(x as number) - 20} y="225" width="40" height="60" fill={c as string} opacity=".12" />)}
  </>) },
  'landmark-bridge': { draw: ({ id }) => (<>
    <defs>{lg(id('s'), [['#9cc9f0'], ['#f5f9ff']])}{lg(id('f'), [['#ffffff', 0], ['#e9eef5', 1]])}</defs>
    <rect width="400" height="300" fill={`url(#${id('s')})`} />
    <path d="M0 230 L400 230" stroke="#b5392a" strokeWidth="10" />
    {[110, 290].map((x) => <g key={x}><rect x={x - 9} y="50" width="18" height="190" fill="#c0392b" /><rect x={x - 12} y="80" width="24" height="6" fill="#a93226" /><rect x={x - 12} y="140" width="24" height="6" fill="#a93226" /></g>)}
    <path d="M0 200 Q110 40 110 50 Q200 180 290 50 Q290 40 400 200" stroke="#c0392b" strokeWidth="4" fill="none" />
    {Array.from({ length: 30 }).map((_, i) => <line key={i} x1={i * 14} y1="230" x2={i * 14} y2={i * 14 < 110 ? 200 - i * 14 * 1.3 : 120} stroke="#c0392b" strokeWidth="1" opacity=".6" />)}
    <rect y="210" width="400" height="90" fill={`url(#${id('f')})`} opacity=".92" />
  </>) },
  desert: { draw: ({ id }) => (<>
    <defs>{lg(id('s'), [['#ff9966'], ['#ffd6a0']])}</defs>
    <rect width="400" height="300" fill={`url(#${id('s')})`} />
    <circle cx="290" cy="120" r="30" fill="#fff0c4" />
    <path d="M0 200 Q100 140 200 190 T400 170 V300 H0z" fill="#e3a064" />
    <path d="M0 240 Q120 180 260 230 T400 220 V300 H0z" fill="#c9824a" />
    <path d="M0 270 Q150 230 300 270 T400 260 V300 H0z" fill="#a8663a" />
  </>) },
  'landmark-lighthouse': { portrait: true, draw: ({ id }) => (<>
    <defs>{lg(id('s'), [['#74b3f5'], ['#dcefff']])}</defs>
    <rect width="300" height="400" fill={`url(#${id('s')})`} />
    <rect y="300" width="300" height="100" fill="#2f6aa1" />
    <path d="M60 300 L100 260 L220 250 L280 300 V330 H40z" fill="#5d5448" />
    <path d="M130 250 L140 90 L170 90 L180 250z" fill="#fff" />
    {[110, 150, 190, 230].map((y) => <path key={y} d={`M${132 + (y - 90) * 0.02} ${y} L${178 - (y - 90) * 0.02} ${y} L${179 - (y - 90) * 0.02} ${y + 18} L${131 + (y - 90) * 0.02} ${y + 18}z`} fill="#d62d20" />)}
    <rect x="134" y="66" width="42" height="26" fill="#ffe28a" stroke="#333" strokeWidth="3" />
    <path d="M130 66 L155 44 L180 66z" fill="#333" />
  </>) },
  'night-sky': { portrait: true, draw: ({ id }) => (<>
    <defs>{lg(id('s'), [['#02030a'], ['#0f1b3d']])}{lg(id('m'), [['#b3a4ff', 0], ['#ffc9a8', 1]], false)}</defs>
    <rect width="300" height="400" fill={`url(#${id('s')})`} />
    <ellipse cx="150" cy="160" rx="200" ry="40" fill={`url(#${id('m')})`} opacity=".25" transform="rotate(-50 150 160)" />
    {Array.from({ length: 140 }).map((_, i) => <circle key={i} cx={(i * 73) % 300} cy={(i * 131) % 330} r={(i % 7) / 6 + 0.3} fill="#fff" opacity={0.4 + (i % 5) / 8} />)}
    {Array.from({ length: 14 }).map((_, i) => <Pine key={i} x={i * 23} y={380} s={1 + (i % 3) * 0.3} c="#05070d" />)}
    <rect y="390" width="300" height="10" fill="#05070d" />
  </>) },
  waterfall: { portrait: true, draw: ({ id }) => (<>
    <defs>{lg(id('w'), [['#e8f6ff'], ['#a9d7f5']])}</defs>
    <rect width="300" height="400" fill="#2f4a2f" />
    <path d="M0 0 H110 L100 300 H0z" fill="#3e5a3a" /><path d="M300 0 H190 L200 300 H300z" fill="#3b5536" />
    <rect x="110" y="0" width="80" height="300" fill={`url(#${id('w')})`} />
    {Array.from({ length: 10 }).map((_, i) => <line key={i} x1={115 + i * 8} y1="0" x2={113 + i * 8} y2="300" stroke="#fff" strokeOpacity=".6" />)}
    <ellipse cx="150" cy="320" rx="160" ry="60" fill="#5fa0b5" />
    <ellipse cx="150" cy="300" rx="70" ry="18" fill="#fff" opacity=".7" />
    <rect y="360" width="300" height="40" fill="#28402a" />
  </>) },
  garden: { draw: ({ id }) => (<>
    <defs>{lg(id('s'), [['#bfe3ff'], ['#f3fbff']])}</defs>
    <rect width="400" height="300" fill={`url(#${id('s')})`} />
    <rect y="130" width="400" height="170" fill="#4a8f3a" />
    {Array.from({ length: 5 }).map((_, r) => Array.from({ length: 16 }).map((_, i) => (
      <g key={`${r}-${i}`} transform={`translate(${i * 26 + (r % 2) * 13} ${150 + r * 30}) scale(${0.6 + r * 0.15})`}>
        <line x1="0" y1="0" x2="0" y2="22" stroke="#2f6b25" strokeWidth="2.5" />
        <path d="M-7 0 Q-7 -14 0 -16 Q7 -14 7 0 Q0 5 -7 0z" fill={['#ff4f81', '#ff2d55', '#ff8fb1', '#e0245e'][(i + r) % 4]} />
      </g>
    )))}
  </>) },
  rainbow: { draw: ({ id }) => (<>
    <defs>{lg(id('s'), [['#8fa6bd'], ['#e2ecf5']])}</defs>
    <rect width="400" height="300" fill={`url(#${id('s')})`} />
    {['#ff3b30', '#ff9500', '#ffcc00', '#34c759', '#0a84ff', '#5856d6', '#af52de'].map((c, i) => <path key={i} d={`M${40 + i * 6} 240 A ${160 - i * 6} ${160 - i * 6} 0 0 1 ${360 - i * 6} 240`} stroke={c} strokeWidth="6" fill="none" opacity=".55" />)}
    <path d="M0 200 Q200 170 400 200 V300 H0z" fill="#5a9b43" /><path d="M0 240 Q200 215 400 245 V300 H0z" fill="#4a8a36" />
  </>) },
  'dog-snow': { portrait: true, draw: ({ id }) => (<>
    <defs>{lg(id('s'), [['#dfe9f3'], ['#ffffff']])}</defs>
    <rect width="300" height="400" fill={`url(#${id('s')})`} />
    {Array.from({ length: 6 }).map((_, i) => <Pine key={i} x={20 + i * 55} y={150} s={1.1} c="#6d8a7b" />)}
    <path d="M0 250 Q150 220 300 250 V400 H0z" fill="#fbfdff" />
    <Dog x={130} y={280} s={1.2} pose="sit" />
    <ellipse cx="200" cy="222" rx="8" ry="5" fill="#fff" />
    {Array.from({ length: 50 }).map((_, i) => <circle key={i} cx={(i * 61) % 300} cy={(i * 97) % 400} r={1 + (i % 3)} fill="#fff" opacity=".9" />)}
  </>) },
  'snow-cabin': { draw: ({ id }) => (<>
    <defs>{lg(id('s'), [['#a9c6e3'], ['#f0f6fb']])}</defs>
    <rect width="400" height="300" fill={`url(#${id('s')})`} />
    {Array.from({ length: 12 }).map((_, i) => <Pine key={i} x={i * 36} y={170} s={1.3} c="#2e4a3c" />)}
    <path d="M0 190 Q200 170 400 195 V300 H0z" fill="#fff" />
    <rect x="140" y="160" width="120" height="70" fill="#7b4a2a" />
    <path d="M125 165 L200 115 L275 165z" fill="#fff" stroke="#e6ecf2" strokeWidth="4" />
    <rect x="160" y="180" width="26" height="22" fill="#ffd27a" /><rect x="214" y="180" width="26" height="22" fill="#ffd27a" />
    <rect x="232" y="100" width="12" height="30" fill="#5c3a22" />
  </>) },
  'concert-lights': { draw: ({ id }) => (<>
    <defs>{lg(id('s'), [['#0a0014'], ['#300050']])}</defs>
    <rect width="400" height="300" fill={`url(#${id('s')})`} />
    {[['#ff2d55', 60], ['#5ac8fa', 200], ['#bf5af2', 340]].map(([c, x], i) => <path key={i} d={`M${x} 0 L${(x as number) - 60} 220 L${(x as number) + 60} 220z`} fill={c as string} opacity=".35" />)}
    <rect y="180" width="400" height="40" fill="#1a1024" />
    {Array.from({ length: 40 }).map((_, i) => <circle key={i} cx={(i * 11) % 400} cy={260 + (i % 4) * 8} r="12" fill="#07030c" />)}
    {Array.from({ length: 8 }).map((_, i) => <rect key={i} x={20 + i * 50} y={228 - (i % 3) * 4} width="3" height="18" fill="#07030c" transform={`rotate(${-20 + i * 5} ${21 + i * 50} 240)`} />)}
  </>) },
  'id-student': { draw: ({ id }) => (<>
    <defs>{lg(id('t'), [['#4b4b52'], ['#2c2c30']])}</defs>
    <rect width="400" height="300" fill={`url(#${id('t')})`} />
    <g transform="rotate(-3 200 150)">
      <rect x="60" y="50" width="280" height="180" rx="14" fill="#fff" />
      <rect x="60" y="50" width="280" height="44" rx="14" fill="#a51c1c" /><rect x="60" y="80" width="280" height="14" fill="#a51c1c" />
      <text x="200" y="79" textAnchor="middle" fill="#fff" fontFamily="var(--font-text)" fontWeight="800" fontSize="16">LINCOLN HIGH SCHOOL</text>
      <rect x="80" y="110" width="80" height="100" rx="6" fill="#d7dde4" />
      <circle cx="120" cy="148" r="22" fill="#9aa5b1" /><path d="M86 210 q34 -44 68 0z" fill="#9aa5b1" />
      <g fontFamily="var(--font-text)" fill="#1c1c1e" fontSize="13">
        <text x="178" y="130" fontWeight="700" fontSize="17">JAMIE PARK</text>
        <text x="178" y="152">Grade 11</text>
        <text x="178" y="172">ID LHS-204417</text>
        <text x="178" y="192">2026–2027</text>
      </g>
      <text x="330" y="222" textAnchor="end" fontSize="9" fill="#8e8e93" fontFamily="var(--font-text)">SAMPLE · NOT A REAL ID</text>
    </g>
  </>) },
  'id-permit': { draw: () => (<>
    <rect width="400" height="300" fill="#3c3c42" />
    <g transform="rotate(2 200 150)">
      <rect x="60" y="55" width="280" height="175" rx="12" fill="#eaf3ff" />
      <rect x="60" y="55" width="280" height="36" rx="12" fill="#1b4d8f" /><rect x="60" y="80" width="280" height="11" fill="#1b4d8f" />
      <text x="200" y="79" textAnchor="middle" fill="#fff" fontFamily="var(--font-text)" fontWeight="800" fontSize="14">SAMPLE STATE · LEARNER PERMIT</text>
      <rect x="78" y="104" width="76" height="96" rx="6" fill="#c4cfdb" />
      <g fontFamily="var(--font-text)" fill="#1c1c1e" fontSize="12"><text x="170" y="120" fontWeight="700" fontSize="15">PARK, JAMIE</text><text x="170" y="140">DL 000-SAMPLE</text><text x="170" y="158">CLASS: LEARNER</text><text x="170" y="176">EXP 2027</text></g>
      <text x="330" y="222" textAnchor="end" fontSize="9" fill="#8e8e93" fontFamily="var(--font-text)">SPECIMEN — DEMO ONLY</text>
    </g>
  </>) },
  'screenshot-boarding': { portrait: true, draw: () => (<>
    <rect width="300" height="400" fill="#f2f2f7" />
    <rect x="16" y="40" width="268" height="330" rx="16" fill="#0a3d91" />
    <g fontFamily="var(--font-text)" fill="#fff">
      <text x="32" y="72" fontSize="14" fontWeight="700">SKYWARD AIRLINES</text>
      <text x="32" y="120" fontSize="40" fontWeight="700">MGR</text><text x="268" y="120" fontSize="40" fontWeight="700" textAnchor="end">SEA</text>
      <text x="32" y="140" fontSize="11" opacity=".7">Maple Grove</text><text x="268" y="140" fontSize="11" opacity=".7" textAnchor="end">Seattle</text>
      <text x="32" y="180" fontSize="11" opacity=".7">FLIGHT</text><text x="32" y="198" fontSize="18" fontWeight="600">SK 482</text>
      <text x="150" y="180" fontSize="11" opacity=".7">SEAT</text><text x="150" y="198" fontSize="18" fontWeight="600">14C</text>
      <text x="32" y="232" fontSize="11" opacity=".7">CONFIRMATION</text><text x="32" y="252" fontSize="18" fontWeight="600">7XKQ2P</text>
      <text x="150" y="232" fontSize="11" opacity=".7">DEPARTS</text><text x="150" y="252" fontSize="18" fontWeight="600">Nov 21 · 8:45</text>
    </g>
    <rect x="70" y="276" width="160" height="76" rx="6" fill="#fff" />
    {Array.from({ length: 30 }).map((_, i) => <rect key={i} x={80 + i * 4.8} y="284" width={i % 3 ? 2 : 3} height="60" fill="#111" />)}
  </>) },
  bicycle: { portrait: true, draw: ({ id }) => (<>
    <defs>{lg(id('w'), [['#b5553c'], ['#8a3f2c']])}</defs>
    <rect width="300" height="400" fill={`url(#${id('w')})`} />
    {Array.from({ length: 20 }).map((_, r) => Array.from({ length: 6 }).map((_, c) => <rect key={`${r}${c}`} x={c * 54 + (r % 2) * 27 - 10} y={r * 16} width="50" height="13" fill="#a14a33" opacity=".7" />))}
    <rect y="300" width="300" height="100" fill="#8e8e93" />
    <g stroke="#1a5fd6" strokeWidth="7" fill="none" strokeLinecap="round">
      <circle cx="80" cy="290" r="44" stroke="#1c1c1e" strokeWidth="6" /><circle cx="220" cy="290" r="44" stroke="#1c1c1e" strokeWidth="6" />
      <path d="M80 290 L130 210 L200 210 L150 290 L80 290 M130 210 L120 190 M200 210 L220 290 M195 195 L215 190" />
    </g>
  </>) },
  // Home camera scenes
  'porch-package': { draw: ({ id }) => (<>
    <defs>{lg(id('w'), [['#d8d2c8'], ['#b8b0a3']])}</defs>
    <rect width="400" height="300" fill={`url(#${id('w')})`} />
    <rect x="150" y="30" width="100" height="200" fill="#6b3e26" /><circle cx="235" cy="135" r="5" fill="#d4af37" />
    <rect y="230" width="400" height="70" fill="#8a8178" /><rect x="120" y="226" width="160" height="16" rx="3" fill="#6d4c3d" />
    <rect x="170" y="186" width="70" height="46" fill="#c49a6c" /><rect x="170" y="200" width="70" height="6" fill="#d8b98a" /><rect x="200" y="186" width="10" height="46" fill="#e3c89b" opacity=".6" />
    <text x="12" y="20" fill="#fff" fontFamily="var(--font-mono)" fontSize="11">FRONT DOOR · 4K HDR</text>
  </>) },
  'porch-person': { draw: (c) => (<>{scenes['porch-package'].draw(c)}<Person x={300} y={120} s={1.6} shirt="#2bd67b" hair="#111" skin="#6b4226" /><rect x="320" y="200" width="44" height="40" rx="6" fill="#1c1c1e" /></>) },
  'yard-dog': { draw: (c) => (<>{scenes['dog-park'].draw(c)}<text x="12" y="20" fill="#fff" fontFamily="var(--font-mono)" fontSize="11">BACKYARD · 4K HDR</text></>) },
  'yard-night': { draw: () => (<>
    <rect width="400" height="300" fill="#1f2a22" />
    <rect y="180" width="400" height="120" fill="#2c3a2e" />
    {Array.from({ length: 16 }).map((_, i) => <rect key={i} x={i * 26} y="120" width="20" height="70" fill="#3a463c" />)}
    <g transform="translate(200 200)"><ellipse rx="34" ry="16" fill="#8d918e" /><circle cx="30" cy="-10" r="14" fill="#8d918e" /><rect x="22" y="-14" width="18" height="6" fill="#222" /><path d="M-34 0 q-20 0 -26 -10" stroke="#555" strokeWidth="8" fill="none" /></g>
    <rect x="300" y="190" width="30" height="40" fill="#3576c9" transform="rotate(70 315 210)" />
    <text x="12" y="20" fill="#fff" fontFamily="var(--font-mono)" fontSize="11">BACKYARD · NIGHT VISION</text>
  </>) },
  'driveway-car': { draw: () => (<>
    <rect width="400" height="300" fill="#c8ced6" />
    <rect y="170" width="400" height="130" fill="#7c7f85" />
    <g transform="translate(120 150)"><rect x="0" y="30" width="170" height="60" rx="14" fill="#1f3a6e" /><path d="M24 30 L50 0 H130 L150 30z" fill="#1f3a6e" /><path d="M40 28 L58 6 H122 L136 28z" fill="#9fc3e8" /><circle cx="40" cy="92" r="18" fill="#111" /><circle cx="135" cy="92" r="18" fill="#111" /></g>
    <Person x={330} y={140} s={1.4} shirt="#ff6b8a" hair="#111" skin="#e0ac7e" />
    <text x="12" y="20" fill="#fff" fontFamily="var(--font-mono)" fontSize="11">DRIVEWAY · 4K HDR</text>
  </>) },
  'driveway-mail': { draw: () => (<>
    <rect width="400" height="300" fill="#cdd3da" /><rect y="170" width="400" height="130" fill="#80848a" />
    <rect x="80" y="130" width="10" height="60" fill="#444" /><rect x="60" y="110" width="50" height="28" rx="12" fill="#2c3e50" />
    <Person x={140} y={130} s={1.4} shirt="#3a5f8f" hair="#333" skin="#c68b59" />
    <text x="12" y="20" fill="#fff" fontFamily="var(--font-mono)" fontSize="11">DRIVEWAY · 4K HDR</text>
  </>) },
  'yard-deer': { draw: () => (<>
    <rect width="400" height="300" fill="#e9d8c2" /><rect y="170" width="400" height="130" fill="#6c8a4b" />
    {[150, 260].map((x, i) => <g key={x} transform={`translate(${x} ${200 - i * 6})`}><ellipse rx="34" ry="16" fill="#a0704a" /><rect x="-26" y="8" width="5" height="34" fill="#8a5d3b" /><rect x="20" y="8" width="5" height="34" fill="#8a5d3b" /><path d="M28 -6 L40 -34 L50 -30 L40 -4z" fill="#a0704a" /><circle cx="46" cy="-36" r="9" fill="#a0704a" /></g>)}
    <text x="12" y="20" fill="#fff" fontFamily="var(--font-mono)" fontSize="11">BACKYARD · DAWN</text>
  </>) },
  // Camera Siri-mode scenes
  'plant-succulent': { draw: ({ id }) => (<>
    <defs>{lg(id('b'), [['#f6efe6'], ['#e2d5c3']])}</defs>
    <rect width="400" height="300" fill={`url(#${id('b')})`} />
    <path d="M150 190 h100 l-10 80 h-80z" fill="#d7835a" />
    <g transform="translate(200 180)">{Array.from({ length: 14 }).map((_, i) => <ellipse key={i} cx="0" cy={-18 - (i % 3) * 6} rx="10" ry="30" fill={i % 2 ? '#7fb08a' : '#9ccaa5'} transform={`rotate(${i * 26})`} />)}<circle r="12" fill="#b9dcbf" /></g>
  </>) },
  'product-speaker': { draw: ({ id }) => (<>
    <defs>{rg(id('b'), [['#fdfdfd'], ['#e2e4e8']])}</defs>
    <rect width="400" height="300" fill={`url(#${id('b')})`} />
    <ellipse cx="200" cy="250" rx="90" ry="14" fill="#000" opacity=".1" />
    <rect x="130" y="70" width="140" height="180" rx="60" fill="#4d5b6b" />
    <ellipse cx="200" cy="80" rx="60" ry="14" fill="#6c7c8e" />
    {Array.from({ length: 12 }).map((_, i) => <line key={i} x1="134" x2="266" y1={100 + i * 12} y2={100 + i * 12} stroke="#44505e" />)}
  </>) },
}

export const SCENE_KEYS = Object.keys(scenes)

/** Removable distractors used by the Photos Clean Up demo. bbox is in scene coordinates. */
export const SCENE_OBJECTS: Record<string, { id: string; label: string; bbox: [number, number, number, number]; draw: () => ReactNode }[]> = {
  'dog-beach': [
    { id: 'walker', label: 'Person in background', bbox: [300, 150, 36, 60], draw: () => <Person x={318} y={170} s={0.45} shirt="#e74c3c" hair="#222" skin="#c68b59" /> },
    { id: 'buoy', label: 'Buoy', bbox: [60, 150, 20, 26], draw: () => <g><rect x="64" y="158" width="12" height="16" rx="3" fill="#ff5a1f" /><rect x="68" y="150" width="4" height="10" fill="#333" /></g> },
  ],
  'landmark-bridge': [
    { id: 'tourist', label: 'Tourist', bbox: [320, 190, 60, 110], draw: () => <Person x={350} y={220} s={1.2} shirt="#f1c40f" hair="#3b2412" skin="#e0ac7e" back /> },
  ],
  'dog-park': [
    { id: 'bin', label: 'Trash can', bbox: [352, 170, 36, 50], draw: () => <g><rect x="356" y="178" width="28" height="40" rx="3" fill="#2e4d3a" /><rect x="352" y="172" width="36" height="8" rx="2" fill="#1e3a2a" /></g> },
    { id: 'bag', label: 'Plastic bag', bbox: [40, 250, 30, 24], draw: () => <path d="M44 270 q4 -18 10 -16 q6 -6 10 2 q6 2 2 14z" fill="#f4f4f4" opacity=".9" /> },
  ],
  'mountain-lake': [
    { id: 'wire', label: 'Power line', bbox: [0, 20, 400, 40], draw: () => <path d="M0 30 Q200 70 400 26" stroke="#222" strokeWidth="1.6" fill="none" /> },
  ],
  'sunset-beach': [
    { id: 'boat', label: 'Boat', bbox: [290, 176, 50, 22], draw: () => <g><path d="M292 190 h44 l-6 8 h-32z" fill="#222" /><path d="M312 190 v-16 l12 16z" fill="#333" /></g> },
  ],
  'food-pizza': [
    { id: 'fork', label: 'Fork', bbox: [330, 40, 40, 200], draw: () => <g><rect x="346" y="80" width="8" height="160" rx="4" fill="#c7c7cc" /><rect x="340" y="40" width="20" height="44" rx="3" fill="#c7c7cc" /></g> },
  ],
}

export function sceneIsPortrait(scene: string): boolean {
  return !!scenes[scene]?.portrait
}

interface SceneProps {
  scene: string
  className?: string
  style?: React.CSSProperties
  fit?: 'cover' | 'contain'
  /** Clean Up: hide object layers (simulated by masking a region) */
  extended?: boolean
  reframe?: { x: number; y: number; tilt: number }
  filter?: string
  title?: string
  /** ids of SCENE_OBJECTS removed by Clean Up */
  removed?: string[]
  grain?: boolean
}

/** Renders a generated photo scene. */
export const Scene = memo(function Scene({ scene, className, style, fit = 'cover', extended, reframe, filter, title, removed, grain }: SceneProps) {
  const uidBase = useId().replace(/:/g, '')
  if (scene.startsWith('gen:')) return <GenImage seed={scene.slice(4)} className={className} style={{ ...style, filter }} />
  const def = scenes[scene] ?? scenes['sunset-beach']
  const W = def.portrait ? 300 : 400
  const H = def.portrait ? 400 : 300
  const ctx: Ctx = { id: (s) => `${uidBase}-${s}`, W, H }
  const pad = extended ? 60 : 0
  const vb = `${-pad + (reframe?.x ?? 0)} ${-pad * 0.75 + (reframe?.y ?? 0)} ${W + pad * 2} ${H + pad * 1.5}`
  return (
    <svg
      className={className}
      style={{ display: 'block', filter, ...style }}
      viewBox={vb}
      preserveAspectRatio={fit === 'cover' ? 'xMidYMid slice' : 'xMidYMid meet'}
      role="img"
      aria-label={title ?? scene}
    >
      {extended && (
        <g transform={reframe ? `rotate(${reframe.tilt} ${W / 2} ${H / 2})` : undefined}>
          <filter id={`${uidBase}-ext`}><feGaussianBlur stdDeviation="6" /></filter>
          <g filter={`url(#${uidBase}-ext)`} transform={`translate(${W / 2} ${H / 2}) scale(1.5) translate(${-W / 2} ${-H / 2})`}>{def.draw({ ...ctx, id: (s) => `${uidBase}-x-${s}` })}</g>
          <g transform={`translate(${W / 2} ${H / 2}) scale(1.28) translate(${-W / 2} ${-H / 2})`} opacity=".7">{def.draw({ ...ctx, id: (s) => `${uidBase}-y-${s}` })}</g>
        </g>
      )}
      <g transform={reframe ? `rotate(${reframe.tilt} ${W / 2} ${H / 2})` : undefined}>
        {def.draw(ctx)}
        {(SCENE_OBJECTS[scene] ?? []).filter((o) => !removed?.includes(o.id)).map((o) => <g key={o.id} data-object={o.id}>{o.draw()}</g>)}
      </g>
      {grain && (
        <>
          <filter id={`${uidBase}-grain`}>
            <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" />
            <feColorMatrix values="0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 0.05 0" />
          </filter>
          <rect x={-pad} y={-pad} width={W + pad * 2} height={H + pad * 2} filter={`url(#${uidBase}-grain)`} />
        </>
      )}
    </svg>
  )
})
