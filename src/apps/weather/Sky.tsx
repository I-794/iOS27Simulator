import { memo } from 'react'
import type { Cond } from './data'

/** Animated condition background: drifting clouds, rain, lightning and twinkling stars (CSS/SVG). */
function seeded(n: number, seed: number) {
  let s = seed
  return Array.from({ length: n }, () => {
    s = (s * 1664525 + 1013904223) >>> 0
    const a = s / 4294967296
    s = (s * 1664525 + 1013904223) >>> 0
    const b = s / 4294967296
    s = (s * 1664525 + 1013904223) >>> 0
    return [a, b, s / 4294967296]
  })
}
const STARS = seeded(70, 11)
const DROPS = seeded(90, 23)

export function skyGradient(cond: Cond, night: boolean): string {
  if (night) {
    if (cond === 'storm') return 'linear-gradient(180deg, #151a24 0%, #2a3140 60%, #394253 100%)'
    if (cond === 'rain') return 'linear-gradient(180deg, #1b2330 0%, #2e3a4b 100%)'
    if (cond === 'cloudy') return 'linear-gradient(180deg, #1d2533 0%, #37445a 100%)'
    return 'linear-gradient(180deg, #0a1633 0%, #1a2d57 55%, #2f4a7a 100%)'
  }
  if (cond === 'storm') return 'linear-gradient(180deg, #2c3442 0%, #4a5567 55%, #667285 100%)'
  if (cond === 'rain') return 'linear-gradient(180deg, #4d6078 0%, #7589a1 100%)'
  if (cond === 'cloudy') return 'linear-gradient(180deg, #6a7e96 0%, #9fb0c4 100%)'
  if (cond === 'partly') return 'linear-gradient(180deg, #3b7fd0 0%, #6aa5e0 55%, #9cc4ea 100%)'
  return 'linear-gradient(180deg, #2a78d6 0%, #5aa2ea 55%, #8cc3f2 100%)'
}

export const Sky = memo(function Sky({ cond, night, still }: { cond: Cond; night: boolean; still: boolean }) {
  const clouds = cond === 'clear' ? 0 : cond === 'partly' ? 4 : 7
  const rain = cond === 'rain' || cond === 'storm'
  return (
    <div className={`wx-sky ${still ? 'still' : ''} ${night ? 'night' : 'day'} c-${cond}`} style={{ background: skyGradient(cond, night) }} aria-hidden>
      {night && cond !== 'storm' && cond !== 'rain' && (
        <div className="wx-stars">
          {STARS.map(([x, y, s], i) => (
            <i key={i} style={{ left: `${x * 100}%`, top: `${y * 60}%`, width: 1 + s * 2, height: 1 + s * 2, animationDelay: `${s * 4}s`, animationDuration: `${2.5 + s * 3}s`, opacity: cond === 'cloudy' ? 0.3 : 0.9 }} />
          ))}
        </div>
      )}
      {!night && cond === 'clear' && <div className="wx-sun" />}
      {Array.from({ length: clouds }, (_, i) => (
        <svg key={i} className="wx-cloud" viewBox="0 0 200 80" style={{ top: `${4 + ((i * 37) % 48)}%`, width: 220 + (i % 3) * 90, animationDuration: `${70 + i * 17}s`, animationDelay: `${-i * 13}s`, opacity: (cond === 'partly' ? 0.55 : 0.75) * (night ? 0.55 : 1) }}>
          <g fill={cond === 'storm' || cond === 'rain' ? '#6b7788' : '#fff'}>
            <ellipse cx="70" cy="50" rx="55" ry="24" />
            <ellipse cx="110" cy="38" rx="45" ry="30" />
            <ellipse cx="145" cy="52" rx="45" ry="22" />
          </g>
        </svg>
      ))}
      {rain && (
        <div className="wx-rain">
          {DROPS.map(([x, d, s], i) => (
            <i key={i} style={{ left: `${x * 104 - 2}%`, animationDelay: `${-d * 1.2}s`, animationDuration: `${0.55 + s * 0.35}s`, height: 14 + s * 16, opacity: 0.25 + s * 0.4 }} />
          ))}
        </div>
      )}
      {cond === 'storm' && (
        <>
          <div className="wx-flash" />
          <svg className="wx-bolt" viewBox="0 0 40 120"><path d="M24 0 L8 58 H20 L12 120 L34 46 H22 L30 0 Z" fill="#fff8c4" /></svg>
        </>
      )}
    </div>
  )
})
