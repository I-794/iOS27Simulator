import { createContext, useContext, type ReactNode, type CSSProperties } from 'react'
import { useOS } from '../../os/store'
import type { SafariWatch } from '../../os/store'

export interface WebApi {
  go: (url: string) => void
  url: string
  /** scroll the web view to an element id inside the page */
  jump: (id: string) => void
}
export const WebCtx = createContext<WebApi>({ go: () => {}, url: '', jump: () => {} })
export const useWeb = () => useContext(WebCtx)

/** In-page link. Keeps navigation inside the simulated browser. */
export function A({ to, children, className = '', style, label }: { to: string; children: ReactNode; className?: string; style?: CSSProperties; label?: string }) {
  const { go } = useWeb()
  return (
    <a
      href={`https://${to}`}
      className={className}
      style={style}
      aria-label={label}
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        go(to)
      }}
    >
      {children}
    </a>
  )
}

/** In-page anchor link (#section). */
export function Jump({ id, children, className = '' }: { id: string; children: ReactNode; className?: string }) {
  const { jump } = useWeb()
  return (
    <a href={`#${id}`} className={className} onClick={(e) => { e.preventDefault(); jump(id) }}>
      {children}
    </a>
  )
}

/** A date inside page content — targetable by extensions (e.g. "highlight dates"). */
export const D = ({ children }: { children: ReactNode }) => <time className="sf-date">{children}</time>

/** A price — targetable by extensions. */
export const Price = ({ children, className = '' }: { children: ReactNode; className?: string }) => <span className={`sf-price ${className}`}>{children}</span>

export function Ad({ kind = 'banner', variant = 0 }: { kind?: 'banner' | 'box' | 'strip'; variant?: number }) {
  const ads = [
    { t: 'Greenfield Mall Fall Sale', s: 'Up to 40% off sneakers, headphones & more — this weekend only.', c1: '#ff7a18', c2: '#ffb347', cta: 'Shop now' },
    { t: 'Brew Lab Coffee', s: 'Pumpkin cold brew is back. Rewards members get a free size upgrade.', c1: '#6b3e1e', c2: '#b07a4a', cta: 'Order ahead' },
    { t: 'Maple CU Student Checking', s: 'No monthly fees. Open an account in five minutes.', c1: '#0d6e4f', c2: '#34c78f', cta: 'Learn more' },
    { t: 'StreamBox Premium', s: 'Try 3 months of ad-free music and video for $0.', c1: '#3b1c8c', c2: '#7c4dff', cta: 'Start trial' },
  ]
  const a = ads[variant % ads.length]
  return (
    <div className={`sf-ad sf-ad-${kind}`} data-ad="1" role="complementary" aria-label="Advertisement">
      <span className="sf-ad-tag">Ad</span>
      <div className="sf-ad-art" style={{ background: `linear-gradient(135deg, ${a.c1}, ${a.c2})` }} />
      <div className="sf-ad-body">
        <b>{a.t}</b>
        <span>{a.s}</span>
      </div>
      <span className="sf-ad-cta">{a.cta}</span>
    </div>
  )
}

export function useWatch(url: string): SafariWatch | undefined {
  return useOS((s) => s.safariWatches.find((w) => w.url === url))
}

export function Stars({ value, size = 13 }: { value: number; size?: number }) {
  return (
    <span className="sf-stars" style={{ fontSize: size }} aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} style={{ color: value >= i - 0.25 ? '#f5a623' : '#d0d0d6' }}>★</span>
      ))}
    </span>
  )
}

export function relDay(offset: number, opts: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric' }): string {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  return d.toLocaleDateString('en-US', opts)
}
