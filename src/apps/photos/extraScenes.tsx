/* Extra camera-demo scenes owned by Photos/Camera (event flyer, foreign-language sign).
 * Rendered by PhotoView and the Camera viewfinder; drawn on the same 300×400 / 400×300 canvases as Scene. */
import { memo, type CSSProperties } from 'react'

export const EXTRA_SCENES: Record<string, { portrait: boolean; draw: () => React.ReactNode }> = {
  'cam-flyer': {
    portrait: true,
    draw: () => (
      <>
        <rect width="300" height="400" fill="#b98a57" />
        {Array.from({ length: 60 }).map((_, i) => <circle key={i} cx={(i * 53) % 300} cy={(i * 97) % 400} r={1.4 + (i % 3)} fill="#9c6f41" opacity=".6" />)}
        <g transform="rotate(-2 150 200)">
          <rect x="38" y="36" width="224" height="318" fill="#fffaf0" />
          <rect x="38" y="36" width="224" height="96" fill="#1f3a8a" />
          <text x="150" y="76" textAnchor="middle" fill="#ffd166" fontFamily="var(--font-display)" fontWeight="800" fontSize="28">FALL</text>
          <text x="150" y="112" textAnchor="middle" fill="#fff" fontFamily="var(--font-display)" fontWeight="800" fontSize="30">CONCERT</text>
          <text x="150" y="160" textAnchor="middle" fill="#1f3a8a" fontFamily="var(--font-text)" fontWeight="700" fontSize="15">Lincoln High Bands</text>
          <text x="150" y="180" textAnchor="middle" fill="#555" fontFamily="var(--font-text)" fontSize="11">Marching · Jazz · Drumline</text>
          <g fill="#1f3a8a"><circle cx="92" cy="226" r="9" /><rect x="99" y="196" width="3" height="30" /><circle cx="120" cy="232" r="9" /><rect x="127" y="202" width="3" height="30" /><path d="M99 196 L130 202 L130 208 L99 202z" /></g>
          <g fill="#e63946"><circle cx="196" cy="230" r="15" /><rect x="176" y="222" width="40" height="18" rx="4" fill="#f1faee" stroke="#e63946" strokeWidth="3" /><line x1="182" y1="206" x2="196" y2="222" stroke="#333" strokeWidth="3" /><line x1="212" y1="206" x2="200" y2="222" stroke="#333" strokeWidth="3" /></g>
          <text x="150" y="276" textAnchor="middle" fill="#111" fontFamily="var(--font-text)" fontWeight="700" fontSize="15">Friday, Oct 16 · 7:00 PM</text>
          <text x="150" y="298" textAnchor="middle" fill="#333" fontFamily="var(--font-text)" fontSize="13">Harbor Amphitheater</text>
          <rect x="98" y="314" width="104" height="24" rx="12" fill="#ffd166" />
          <text x="150" y="331" textAnchor="middle" fill="#1f3a8a" fontFamily="var(--font-text)" fontWeight="700" fontSize="12">FREE ADMISSION</text>
        </g>
        <circle cx="150" cy="40" r="6" fill="#d62828" /><circle cx="150" cy="40" r="2" fill="#fff" opacity=".7" />
      </>
    ),
  },
  'cam-sign': {
    portrait: false,
    draw: () => (
      <>
        <rect width="400" height="300" fill="#e9dcc6" />
        <rect y="230" width="400" height="70" fill="#a47148" />
        <rect x="70" y="24" width="260" height="226" rx="8" fill="#6d4c2f" />
        <rect x="82" y="36" width="236" height="202" rx="4" fill="#2f3b33" />
        <g fontFamily="'Bradley Hand','Segoe Print','Comic Sans MS',cursive" fill="#f7f3e8">
          <text x="200" y="72" textAnchor="middle" fontSize="24" fill="#ffd166">MENÚ DEL DÍA</text>
          <text x="100" y="112" fontSize="15">Sopa de tomate</text><text x="300" y="112" fontSize="15" textAnchor="end">4,50 €</text>
          <text x="100" y="142" fontSize="15">Tortilla española</text><text x="300" y="142" fontSize="15" textAnchor="end">6,00 €</text>
          <text x="100" y="172" fontSize="15">Café con leche</text><text x="300" y="172" fontSize="15" textAnchor="end">2,20 €</text>
          <text x="200" y="214" textAnchor="middle" fontSize="18" fill="#9be7ff">¡Bienvenidos!</text>
        </g>
        <path d="M120 250 l-20 50 M280 250 l20 50" stroke="#5a3d25" strokeWidth="8" />
        <ellipse cx="350" cy="232" rx="22" ry="6" fill="#7a5134" /><path d="M334 232 q16 -40 32 0z" fill="#3a7d44" />
      </>
    ),
  },
}

export const ExtraScene = memo(function ExtraScene({ scene, style, className, filter, extended }: { scene: string; style?: CSSProperties; className?: string; filter?: string; extended?: boolean }) {
  const def = EXTRA_SCENES[scene]
  const W = def.portrait ? 300 : 400
  const H = def.portrait ? 400 : 300
  const pad = extended ? 60 : 0
  return (
    <svg className={className} style={{ display: 'block', filter, ...style }} viewBox={`${-pad} ${-pad * 0.75} ${W + pad * 2} ${H + pad * 1.5}`} preserveAspectRatio="xMidYMid slice" role="img" aria-label={scene}>
      {pad > 0 && <rect x={-pad} y={-pad} width={W + pad * 2} height={H + pad * 2} fill={def.portrait ? '#9c6f41' : '#d9c9ae'} />}
      {def.draw()}
    </svg>
  )
})
