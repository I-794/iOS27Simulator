/* Shared photo "look" helpers used by Photos and Camera: edit model, CSS filter
 * mapping, aspect ratios and scene-coordinate mapping for Clean Up / Extend. */
import type { Photo, PhotoEdits } from '../../os/types'
import { sceneIsPortrait } from '../../art/Scene'
import { MONTHS, MONTHS_SHORT, WEEKDAYS, fmtTime } from '../../os/time'

/** Photos keeps a few extra edit fields next to the shared PhotoEdits model. */
export interface PhEdits extends PhotoEdits {
  brilliance?: number
  saturation?: number
  /** width/height ratio chosen with Extend */
  extendRatio?: number
  cropAspect?: 'original' | 'square' | '16:9' | '4:5' | '3:2'
  cleanMode?: 'fast' | 'hq'
  /** non-destructive capture look from Camera (not counted as an edit) */
  capture?: { style?: string; exposure?: number; zoom?: number; mirror?: boolean; blur?: boolean }
}

export const edits = (p: Photo): PhEdits => (p.edits ?? {}) as PhEdits

export const FILTERS: Record<string, string> = {
  Original: '',
  Vivid: 'saturate(1.38) contrast(1.08)',
  'Vivid Warm': 'saturate(1.3) contrast(1.06) sepia(0.2)',
  'Vivid Cool': 'saturate(1.25) contrast(1.06) hue-rotate(-12deg) brightness(1.02)',
  Dramatic: 'contrast(1.32) brightness(0.9) saturate(0.88)',
  'Dramatic Warm': 'contrast(1.28) brightness(0.9) sepia(0.3) saturate(0.95)',
  'Dramatic Cool': 'contrast(1.28) brightness(0.9) hue-rotate(-18deg) saturate(0.85)',
  Mono: 'grayscale(1)',
  Silvertone: 'grayscale(1) contrast(1.12) brightness(1.06)',
  Noir: 'grayscale(1) contrast(1.55) brightness(0.82)',
}

export const STYLES: Record<string, string> = {
  Standard: '',
  Amber: 'sepia(0.22) saturate(1.12)',
  Gold: 'sepia(0.34) saturate(1.2) brightness(1.03)',
  Rose: 'hue-rotate(-14deg) saturate(1.12)',
  Neutral: 'saturate(0.78) contrast(0.97)',
  Cool: 'hue-rotate(14deg) saturate(0.95) brightness(1.02)',
  'Stark B&W': 'grayscale(1) contrast(1.2)',
}

export function cssFilter(e?: PhEdits, extra?: Partial<PhEdits>): string | undefined {
  const x = { ...(e ?? {}), ...(extra ?? {}) }
  const parts: string[] = []
  const cap = x.capture
  if (cap?.style && STYLES[cap.style]) parts.push(STYLES[cap.style])
  if (cap?.exposure) parts.push(`brightness(${(1 + cap.exposure * 0.25).toFixed(3)})`)
  if (x.filter && FILTERS[x.filter]) parts.push(FILTERS[x.filter])
  if (x.exposure) parts.push(`brightness(${(1 + x.exposure * 0.45).toFixed(3)})`)
  if (x.brilliance) parts.push(`contrast(${(1 - x.brilliance * 0.18).toFixed(3)}) brightness(${(1 + x.brilliance * 0.12).toFixed(3)})`)
  if (x.saturation) parts.push(`saturate(${Math.max(0, 1 + x.saturation).toFixed(3)})`)
  return parts.length ? parts.join(' ') : undefined
}

export function isEdited(p: Photo): boolean {
  const e = edits(p)
  return !!(e.cleanedUp?.length || e.extended || e.reframe || (e.filter && e.filter !== 'Original') || e.exposure || e.brilliance || e.saturation || (e.crop && e.crop !== 1) || (e.cropAspect && e.cropAspect !== 'original'))
}

export function isAIEdited(p: Photo): boolean {
  const e = edits(p)
  return !!(e.cleanedUp?.length || e.extended || e.reframe)
}

/** Human readable Apple Intelligence edit history for the info panel. */
export function aiEditNotes(p: Photo): string[] {
  const e = edits(p)
  const out: string[] = []
  if (e.cleanedUp?.length) out.push(`Clean Up${e.cleanMode === 'hq' ? ' (High Quality)' : ''}: removed ${e.cleanedUp.length} object${e.cleanedUp.length > 1 ? 's' : ''}`)
  if (e.extended) out.push(`Extend: canvas expanded${e.extendRatio ? ` to ${ratioLabel(e.extendRatio)}` : ''} with generative fill`)
  if (e.reframe) out.push(`Spatial Reframing: pan ${Math.round(e.reframe.x)}, ${Math.round(e.reframe.y)} · tilt ${e.reframe.tilt.toFixed(1)}°`)
  return out
}

export function ratioLabel(r: number): string {
  const known: [number, string][] = [[16 / 9, '16:9'], [4 / 3, '4:3'], [1, 'Square'], [3 / 4, '3:4'], [9 / 16, '9:16'], [3 / 2, '3:2'], [4 / 5, '4:5']]
  for (const [v, l] of known) if (Math.abs(v - r) < 0.02) return l
  return `${r.toFixed(2)}:1`
}

export const CROP_RATIOS: Record<NonNullable<PhEdits['cropAspect']>, number | null> = { original: null, square: 1, '16:9': 16 / 9, '4:5': 4 / 5, '3:2': 3 / 2 }

/** Display ratio (width / height) of a photo after edits. */
export function photoRatio(p: Photo): number {
  const e = edits(p)
  if (e.extended && e.extendRatio) return e.extendRatio
  if (e.cropAspect && CROP_RATIOS[e.cropAspect]) {
    const r = CROP_RATIOS[e.cropAspect]!
    const portrait = p.height > p.width
    return portrait && r > 1 ? 1 / r : r
  }
  return p.width / p.height
}

export function sceneSize(scene: string) {
  return sceneIsPortrait(scene) ? { W: 300, H: 400 } : { W: 400, H: 300 }
}

/** Map a scene-space bbox to % coordinates inside a cover-fitted box of ratio `r`. */
export function mapBox(scene: string, e: PhEdits, r: number, bbox: [number, number, number, number]) {
  const { W, H } = sceneSize(scene)
  const pad = e.extended ? 60 : 0
  const vbx = -pad + (e.reframe?.x ?? 0)
  const vby = -pad * 0.75 + (e.reframe?.y ?? 0)
  const vbw = W + pad * 2
  const vbh = H + pad * 1.5
  let sw: number, sh: number, ox: number, oy: number
  if (r > vbw / vbh) {
    sw = vbw
    sh = vbw / r
    ox = 0
    oy = (vbh - sh) / 2
  } else {
    sh = vbh
    sw = vbh * r
    ox = (vbw - sw) / 2
    oy = 0
  }
  const z = (e.crop ?? 1) * (e.capture?.zoom ?? 1) * (e.reframe?.tilt ? 1 + Math.abs(e.reframe.tilt) * 0.035 : 1)
  const fx = (sx: number) => 0.5 + ((sx - vbx - ox) / sw - 0.5) * z
  const fy = (sy: number) => 0.5 + ((sy - vby - oy) / sh - 0.5) * z
  const [x, y, w, h] = bbox
  return { left: fx(x) * 100, top: fy(y) * 100, width: (w / sw) * z * 100, height: (h / sh) * z * 100 }
}

export function fmtPhotoDate(ts: number): string {
  const d = new Date(ts)
  return `${WEEKDAYS[d.getDay()]} • ${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()} • ${fmtTime(ts)}`
}

export function fmtShortDate(ts: number): string {
  const d = new Date(ts)
  const now = new Date()
  const y = d.getFullYear() !== now.getFullYear() ? `, ${d.getFullYear()}` : ''
  return `${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}${y}`
}

export function monthKey(ts: number) {
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth()).padStart(2, '0')}`
}

export function monthLabel(ts: number) {
  const d = new Date(ts)
  return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

export function fmtDur(sec: number) {
  const s = Math.max(0, Math.round(sec))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/** Keywords a freshly captured scene gets (Camera → Photos). */
export const SCENE_KEYWORDS: Record<string, string[]> = {
  'autumn-trees': ['autumn', 'fall', 'trees', 'leaves', 'nature'],
  'food-pizza': ['food', 'pizza', 'dinner'],
  'plant-monstera': ['plant', 'monstera', 'houseplant'],
  'landmark-bridge': ['bridge', 'landmark', 'travel'],
  receipt: ['receipt', 'bill', 'document'],
  storm: ['storm', 'lightning', 'weather', 'sky'],
  'product-headphones': ['headphones', 'product', 'electronics'],
  handwritten: ['note', 'handwriting', 'text'],
  'plant-succulent': ['plant', 'succulent'],
  'landmark-lighthouse': ['lighthouse', 'landmark', 'coast'],
  'dog-park': ['dog', 'park', 'golden retriever'],
  'selfie-group': ['selfie', 'friends'],
  'city-night': ['city', 'night', 'lights'],
  'sunset-beach': ['beach', 'sunset', 'ocean'],
  'mountain-lake': ['mountains', 'lake', 'nature'],
  'panorama-canyon': ['canyon', 'panorama', 'landscape'],
}
