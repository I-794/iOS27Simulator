import { useMemo } from 'react'
import { seeded } from './charts'

/** Stylized map snippet with a workout route. `improved` shows the iOS 27 corrected route;
 * otherwise the raw GPS trace drifts off the path near buildings. */
export function RouteMap({ seed = 1, improved = true, height = 180, showBoth = false }: { seed?: number; improved?: boolean; height?: number; showBoth?: boolean }) {
  const { smooth, raw } = useMemo(() => {
    const rnd = seeded(seed * 7919)
    const pts: [number, number][] = []
    let x = 40
    let y = 140
    for (let i = 0; i < 26; i++) {
      pts.push([x, y])
      const ang = (i / 26) * Math.PI * 2
      x += Math.cos(ang) * 14 + (rnd() - 0.5) * 4
      y += Math.sin(ang) * 9 - 2 + (rnd() - 0.5) * 3
    }
    const toPath = (p: [number, number][]) => p.map(([a, b], i) => `${i ? 'L' : 'M'}${a.toFixed(1)} ${b.toFixed(1)}`).join(' ')
    const noisy = pts.map(([a, b], i) => [a + (i > 6 && i < 14 ? (rnd() - 0.3) * 18 : (rnd() - 0.5) * 6), b + (i > 6 && i < 14 ? (rnd() - 0.5) * 14 : (rnd() - 0.5) * 5)] as [number, number])
    return { smooth: toPath(pts), raw: toPath(noisy), start: pts[0] }
  }, [seed])
  return (
    <svg viewBox="0 0 340 200" width="100%" height={height} preserveAspectRatio="xMidYMid slice" className="hl-map" role="img" aria-label="Workout route map">
      <rect width="340" height="200" fill="var(--hl-map-bg)" />
      <path d="M0 60 H340 M0 150 H340 M90 0 V200 M230 0 V200 M0 20 L340 190" stroke="var(--hl-map-road)" strokeWidth="9" fill="none" />
      <path d="M0 105 H340 M160 0 V200" stroke="var(--hl-map-road)" strokeWidth="5" fill="none" />
      <rect x="100" y="70" width="50" height="30" rx="3" fill="var(--hl-map-block)" />
      <rect x="175" y="115" width="46" height="26" rx="3" fill="var(--hl-map-block)" />
      <ellipse cx="280" cy="40" rx="45" ry="26" fill="var(--hl-map-park)" />
      {(showBoth || !improved) && <path d={raw} stroke={showBoth ? '#8e8e93' : '#ff9f0a'} strokeWidth={showBoth ? 2.5 : 4} fill="none" strokeLinejoin="round" strokeLinecap="round" strokeDasharray={showBoth ? '4 4' : undefined} opacity={showBoth ? 0.8 : 1} />}
      {(improved || showBoth) && <path d={smooth} stroke="url(#hl-route)" strokeWidth="4.5" fill="none" strokeLinejoin="round" strokeLinecap="round" className="hl-route-anim" />}
      <defs>
        <linearGradient id="hl-route" x1="0" x2="1"><stop offset="0" stopColor="#30d158" /><stop offset=".5" stopColor="#ffd60a" /><stop offset="1" stopColor="#ff453a" /></linearGradient>
      </defs>
      <circle cx="40" cy="140" r="6" fill="#30d158" stroke="#fff" strokeWidth="2" />
    </svg>
  )
}
