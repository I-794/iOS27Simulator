import { memo } from 'react'
import type { Track } from '../../os/types'

/** Generated album artwork: each album gets a distinct abstract cover from its hue + title. */
export const AlbumArt = memo(function AlbumArt({ track, album, hue, size = 48, radius = 8, style }: { track?: Track; album?: string; hue?: number; size?: number | string; radius?: number; style?: React.CSSProperties }) {
  const h = hue ?? track?.hue ?? 210
  const name = album ?? track?.album ?? ''
  const seed = [...name].reduce((a, c) => a + c.charCodeAt(0), 0)
  const variant = seed % 4
  return (
    <div className="album-art" style={{ width: size, height: size, borderRadius: radius, flexShrink: 0, ...style }} aria-hidden>
      <svg viewBox="0 0 100 100" width="100%" height="100%" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id={`aa-${seed}-${h}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={`hsl(${h} 80% 62%)`} />
            <stop offset="1" stopColor={`hsl(${(h + 50) % 360} 70% 28%)`} />
          </linearGradient>
        </defs>
        <rect width="100" height="100" fill={`url(#aa-${seed}-${h})`} />
        {variant === 0 && <circle cx="62" cy="40" r="26" fill={`hsl(${(h + 180) % 360} 90% 70%)`} opacity=".75" />}
        {variant === 1 && <path d="M0 70 Q25 50 50 70 T100 70 V100 H0z" fill={`hsl(${(h + 20) % 360} 60% 15%)`} opacity=".7" />}
        {variant === 2 && Array.from({ length: 6 }).map((_, i) => <circle key={i} cx="50" cy="50" r={8 + i * 8} fill="none" stroke="#fff" strokeOpacity={0.35 - i * 0.05} strokeWidth="2" />)}
        {variant === 3 && <rect x="20" y="20" width="60" height="60" rx="30" fill="none" stroke={`hsl(${(h + 140) % 360} 90% 75%)`} strokeWidth="6" transform="rotate(20 50 50)" />}
        <text x="8" y="92" fontFamily="var(--font-display)" fontWeight="800" fontSize="9" fill="#fff" opacity=".85" letterSpacing=".5">{name.toUpperCase().slice(0, 18)}</text>
      </svg>
    </div>
  )
})
