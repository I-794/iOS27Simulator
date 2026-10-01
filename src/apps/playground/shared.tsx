/* Image Playground shared pieces: local store, renderer with overlays, concept data. */
import { memo, type CSSProperties } from 'react'
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { GenArt } from '../../art/GenImage'
import { Scene } from '../../art/Scene'
import type { ImageGen } from '../../os/store'

export const DAILY_LIMIT = 50

export interface Sticker { id: string; emoji?: string; genmoji?: string; x: number; y: number; s: number }
export interface Stroke { id: string; d: string; kind: string; pts: [number, number][] }
export interface Genmoji { id: string; prompt: string; seed: number }

interface PGLocal {
  day: string
  used: number
  stickers: Record<string, Sticker[]>
  strokes: Record<string, Stroke[]>
  genmoji: Genmoji[]
  poster: { genId: string; contact: string } | null
  set: (p: Partial<PGLocal>) => void
}

export const usePG = create<PGLocal>()(
  persist((set) => ({ day: '', used: 0, stickers: {}, strokes: {}, genmoji: [], poster: null, set: (p) => set(p) }), {
    name: 'ios27-playground',
    storage: createJSONStorage(() => localStorage),
    partialize: ({ set: _s, ...rest }) => { void _s; return rest as unknown as PGLocal },
  }),
)

const today = () => new Date().toDateString()
export function remainingToday(): number {
  const s = usePG.getState()
  return DAILY_LIMIT - (s.day === today() ? s.used : 0)
}
export function useRemaining(): number {
  const day = usePG((s) => s.day)
  const used = usePG((s) => s.used)
  return DAILY_LIMIT - (day === today() ? used : 0)
}
export function consumeGeneration(): boolean {
  const s = usePG.getState()
  const used = s.day === today() ? s.used : 0
  if (used >= DAILY_LIMIT) return false
  s.set({ day: today(), used: used + 1 })
  return true
}

/** Same hash GenImage uses, so previews match stored generations (wallpapers). */
export function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}

export const CONCEPTS: { group: string; items: { label: string; emoji: string; frag: string }[] }[] = [
  {
    group: 'For You',
    items: [
      { label: 'Biscuit', emoji: '🐶', frag: 'Biscuit the golden retriever dog' },
      { label: 'Robot', emoji: '🤖', frag: 'our competition robot' },
      { label: 'Drums', emoji: '🥁', frag: 'snare drum on a concert stage' },
      { label: 'Seattle', emoji: '🌧️', frag: 'Seattle city skyline at night' },
      { label: 'Jamie', emoji: '🧑', frag: 'portrait of Jamie, a person' },
      { label: 'Mochi', emoji: '🐱', frag: 'Mochi the gray cat' },
    ],
  },
  {
    group: 'Places',
    items: [
      { label: 'Space', emoji: '🚀', frag: 'in outer space' },
      { label: 'Beach', emoji: '🏖️', frag: 'at the beach' },
      { label: 'Mountains', emoji: '🏔️', frag: 'in the mountains' },
      { label: 'Forest', emoji: '🌲', frag: 'in a forest' },
      { label: 'Winter', emoji: '❄️', frag: 'in the snow' },
    ],
  },
  {
    group: 'Accessories & Themes',
    items: [
      { label: 'Sunglasses', emoji: '😎', frag: 'wearing sunglasses' },
      { label: 'Party Hat', emoji: '🥳', frag: 'with a party hat' },
      { label: 'Crown', emoji: '👑', frag: 'wearing a royal crown' },
      { label: 'Headphones', emoji: '🎧', frag: 'wearing headphones' },
      { label: 'Birthday', emoji: '🎂', frag: 'birthday cake celebration' },
      { label: 'Dragon', emoji: '🐉', frag: 'a friendly dragon' },
      { label: 'Sunflowers', emoji: '🌻', frag: 'sunflower' },
    ],
  },
]
export const ALL_CONCEPTS = CONCEPTS.flatMap((g) => g.items)

export const EDIT_SUGGESTIONS = ['Make it sunset', 'Add sunglasses', 'Put it in space', 'Add a party hat', 'Make it winter', 'Make it nighttime', 'Add headphones']

const STYLE_FILTER: Record<string, string> = {
  Animation: 'saturate(1.6) contrast(1.12) brightness(1.06)',
  Illustration: 'saturate(1.45) contrast(1.35)',
  Sketch: 'grayscale(1) contrast(1.9) brightness(1.18)',
  Photorealistic: 'contrast(1.05) saturate(1.08)',
  Watercolor: 'saturate(1.25) contrast(0.92) blur(0.7px) brightness(1.08)',
  'Oil Painting': 'saturate(1.75) contrast(1.25) sepia(0.15)',
  Vector: 'saturate(2.1) contrast(1.7) brightness(1.05)',
}

/** Overlay tints for natural-language edits that change the lighting/mood. */
function editOverlays(edits: string[]) {
  const e = edits.join(' ').toLowerCase()
  const out: { key: string; style: CSSProperties }[] = []
  if (/sunset|golden hour|dusk/.test(e)) out.push({ key: 'sunset', style: { background: 'linear-gradient(180deg, rgb(255 120 60 / 0.55), rgb(255 60 120 / 0.25) 55%, rgb(80 20 90 / 0.35))', mixBlendMode: 'multiply' } })
  if (/night|dark|moonlit/.test(e)) out.push({ key: 'night', style: { background: 'linear-gradient(180deg, rgb(10 20 60 / 0.65), rgb(20 10 50 / 0.45))', mixBlendMode: 'multiply' } })
  if (/winter|snow/.test(e)) out.push({ key: 'snow', style: { backgroundImage: 'radial-gradient(circle, #fff 1.4px, transparent 1.6px), radial-gradient(circle, rgb(255 255 255 / .8) 1px, transparent 1.2px)', backgroundSize: '26px 26px, 17px 17px', backgroundPosition: '0 0, 9px 11px' } })
  if (/rain/.test(e)) out.push({ key: 'rain', style: { backgroundImage: 'repeating-linear-gradient(105deg, transparent 0 9px, rgb(200 220 255 / .45) 9px 10px)', mixBlendMode: 'screen' } })
  if (/neon|glow/.test(e)) out.push({ key: 'neon', style: { background: 'radial-gradient(70% 60% at 50% 60%, rgb(255 0 200 / .35), transparent 70%)', mixBlendMode: 'screen' } })
  if (/sparkle|glitter|magic/.test(e)) out.push({ key: 'sparkle', style: { backgroundImage: 'radial-gradient(circle, #fff6a8 1.5px, transparent 2px)', backgroundSize: '34px 30px', mixBlendMode: 'screen' } })
  if (/black and white|b&w|monochrome/.test(e)) out.push({ key: 'bw', style: { backdropFilter: 'grayscale(1)', WebkitBackdropFilter: 'grayscale(1)' } })
  return out
}

const STROKE_KIND: Record<string, { color: string; emoji: string }> = {
  Flowers: { color: '#ff7eb6', emoji: '🌸' },
  Stars: { color: '#ffd84d', emoji: '⭐️' },
  Rainbow: { color: 'url(#pg-rainbow)', emoji: '🌈' },
  Fire: { color: '#ff6a00', emoji: '🔥' },
  Water: { color: '#4cc3ff', emoji: '💧' },
  Leaves: { color: '#5bd16b', emoji: '🍃' },
  Hearts: { color: '#ff4d6d', emoji: '💖' },
}
export const STROKE_KINDS = Object.keys(STROKE_KIND)

export interface GenSpec { prompt: string; style: string; seed: number; source?: string; edits: string[] }

/** Renders a generation exactly like GenImage (plus local overlays, stickers and brush strokes). */
export const GenView = memo(function GenView({ g, variant = 0, stickers, strokes, className, style, badge }: { g: GenSpec; variant?: number; stickers?: Sticker[]; strokes?: Stroke[]; className?: string; style?: CSSProperties; badge?: boolean }) {
  const full = [g.prompt, ...g.edits].join(' ')
  const restyle = g.source && g.style !== 'Photorealistic'
  return (
    <div className={`pg-gen ${className ?? ''}`} style={style}>
      {restyle ? (
        <div className="pg-restyle" data-style={g.style}>
          <Scene scene={g.source!} style={{ width: '100%', height: '100%', filter: `${STYLE_FILTER[g.style] ?? ''} hue-rotate(${(g.seed % 5) * 7 - 14 + variant}deg)` }} />
          <div className="pg-restyle-tex" />
        </div>
      ) : (
        <GenArt prompt={full} artStyle={g.style} seed={hash(`${g.prompt}|${g.seed}`)} source={g.source} className="pg-gen-art" />
      )}
      {editOverlays(g.edits).map((o) => <div key={o.key} className="pg-overlay" style={o.style} />)}
      {strokes && strokes.length > 0 && (
        <svg className="pg-strokes" viewBox="0 0 100 100" preserveAspectRatio="none">
          <defs><linearGradient id="pg-rainbow" x1="0" x2="1"><stop offset="0" stopColor="#ff3b30" /><stop offset=".25" stopColor="#ffcc00" /><stop offset=".5" stopColor="#34c759" /><stop offset=".75" stopColor="#0a84ff" /><stop offset="1" stopColor="#af52de" /></linearGradient></defs>
          {strokes.map((s) => <path key={s.id} d={s.d} stroke={STROKE_KIND[s.kind]?.color ?? '#fff'} strokeWidth={7} strokeLinecap="round" strokeLinejoin="round" fill="none" opacity={0.75} vectorEffect="non-scaling-stroke" style={{ strokeWidth: 22 }} />)}
        </svg>
      )}
      {strokes?.flatMap((s) => s.pts.map((p, i) => <span key={`${s.id}-${i}`} className="pg-stroke-emoji" style={{ left: `${p[0]}%`, top: `${p[1]}%` }}>{STROKE_KIND[s.kind]?.emoji}</span>))}
      {stickers?.map((st) => (
        <span key={st.id} className="pg-sticker" data-sticker={st.id} style={{ left: `${st.x}%`, top: `${st.y}%`, fontSize: `${st.s}cqw` }}>
          {st.genmoji ? <GenmojiArt prompt={st.genmoji} seed={7} size="1em" /> : st.emoji}
        </span>
      ))}
      {badge && <span className="pg-ai-badge" title="Created with Image Playground">✦ AI</span>}
    </div>
  )
})

export function GenmojiArt({ prompt, seed, size = 64 }: { prompt: string; seed: number; size?: number | string }) {
  return (
    <span className="pg-genmoji" style={{ width: size, height: size }}>
      <GenArt prompt={prompt} artStyle="Vector" seed={hash(`${prompt}|${seed}`)} />
    </span>
  )
}

export function genToSpec(g: ImageGen): GenSpec {
  return { prompt: g.prompt, style: g.style, seed: g.seed, source: g.source, edits: g.edits }
}
