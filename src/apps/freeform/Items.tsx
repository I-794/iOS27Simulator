import { memo } from 'react'
import type { FreeformItem, FreeformBoard } from '../../os/store'
import { useOS } from '../../os/store'
import { Scene } from '../../art/Scene'

export const STICKY_COLORS = ['#ffe066', '#9be7ff', '#ffb3c1', '#b8f2a0', '#ffc98b', '#d7b8ff']
export const INK_COLORS = ['#1c1c1e', '#0a84ff', '#ff3b30', '#34c759', '#ff9500', '#af52de', '#5ac8fa']
export const SHAPES = ['rect', 'circle', 'triangle', 'star', 'arrow'] as const

export function shapePath(kind: string): string {
  switch (kind) {
    case 'circle': return 'M50 2 A48 48 0 1 1 49.9 2 Z'
    case 'triangle': return 'M50 4 L96 94 L4 94 Z'
    case 'star': return 'M50 4 L61 37 L96 38 L68 59 L78 94 L50 73 L22 94 L32 59 L4 38 L39 37 Z'
    case 'arrow': return 'M4 36 L60 36 L60 12 L96 50 L60 88 L60 64 L4 64 Z'
    default: return 'M10 2 H90 Q98 2 98 10 V90 Q98 98 90 98 H10 Q2 98 2 90 V10 Q2 2 10 2 Z'
  }
}

export const ItemView = memo(function ItemView({ it, editing }: { it: FreeformItem; editing?: boolean }) {
  const photo = useOS((s) => (it.photoId ? s.photos.find((p) => p.id === it.photoId) : undefined))
  switch (it.kind) {
    case 'sticky':
      return <div className="ff-sticky" style={{ background: it.color ?? STICKY_COLORS[0] }}>{!editing && <span>{it.text}</span>}</div>
    case 'shape':
      return (
        <svg className="ff-shape" viewBox="0 0 100 100" preserveAspectRatio="none">
          <path d={shapePath(it.d ?? 'rect')} fill={it.color ?? '#5ac8fa'} vectorEffect="non-scaling-stroke" />
          {it.text && !editing && <text x="50" y="54" textAnchor="middle" fontSize="12" fill="#fff" fontWeight="600">{it.text}</text>}
        </svg>
      )
    case 'text':
      return <div className="ff-text" style={{ color: it.color && it.color !== '#1c1c1e' ? it.color : undefined }}>{!editing && (it.text || 'Text')}</div>
    case 'image':
      return <div className="ff-image"><Scene scene={photo?.scene ?? 'sunset-beach'} /></div>
    case 'path':
      return (
        <svg className="ff-path" viewBox={`0 0 ${it.w} ${it.h}`} preserveAspectRatio="none" style={{ overflow: 'visible' }}>
          <path d={it.d} fill="none" stroke={it.color ?? '#1c1c1e'} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" className={it.color === '#1c1c1e' || !it.color ? 'ff-ink' : undefined} />
        </svg>
      )
    default:
      return null
  }
})

export function boardBounds(items: FreeformItem[]) {
  if (!items.length) return { x: 0, y: 0, w: 400, h: 300 }
  const x0 = Math.min(...items.map((i) => i.x))
  const y0 = Math.min(...items.map((i) => i.y))
  const x1 = Math.max(...items.map((i) => i.x + i.w))
  const y1 = Math.max(...items.map((i) => i.y + i.h))
  return { x: x0, y: y0, w: Math.max(1, x1 - x0), h: Math.max(1, y1 - y0) }
}

/** Static miniature of a board used in the board list. */
export function BoardPreview({ b }: { b: FreeformBoard }) {
  const bb = boardBounds(b.items)
  const pad = 30
  const W = 180
  const H = 120
  const z = Math.min(W / (bb.w + pad * 2), H / (bb.h + pad * 2), 0.8)
  const ox = (W - bb.w * z) / 2 - bb.x * z
  const oy = (H - bb.h * z) / 2 - bb.y * z
  return (
    <div className="ff-preview">
      <div className="ff-layer" style={{ transform: `translate(${ox}px, ${oy}px) scale(${z})`, width: W / z }}>
        {b.items.map((it) => (
          <div key={it.id} className={`ff-item kind-${it.kind}`} style={{ left: it.x, top: it.y, width: it.w, height: it.h }}>
            <ItemView it={it} />
          </div>
        ))}
      </div>
      {b.items.length === 0 && <span className="ff-preview-empty">Empty board</span>}
    </div>
  )
}
