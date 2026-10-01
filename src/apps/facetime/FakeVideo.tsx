import { useEffect, useRef } from 'react'

/** Resolution factor (canvas pixels per CSS pixel). Low values + pixelated rendering = poor network. */
export type Res = 'hd' | 'sd' | 'low'
const FACTOR: Record<Res, number> = { hd: 1.5, sd: 0.45, low: 0.09 }

function hueOf(color: string) {
  const m = color.match(/^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i)
  if (!m) return 210
  const [r, g, b] = [m[1], m[2], m[3]].map((x) => parseInt(x, 16) / 255)
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  if (max === min) return 220
  const d = max - min
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return Math.round(h * 60 + 360) % 360
}

const SKINS = ['#f1c7a5', '#d9a07a', '#a86b48', '#7a4a2e', '#e8b894']
const HAIRS = ['#2b1d16', '#4a2f1f', '#111', '#6b4226', '#a0703a']

function draw(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, hue: number, seed: number, talking: boolean) {
  const skin = SKINS[seed % SKINS.length]
  const hair = HAIRS[(seed >> 1) % HAIRS.length]
  // room
  const g = ctx.createLinearGradient(0, 0, 0, h)
  g.addColorStop(0, `hsl(${(hue + 30) % 360} 22% 80%)`)
  g.addColorStop(1, `hsl(${(hue + 30) % 360} 18% 52%)`)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)
  // window with daylight
  const wx = w * 0.6
  const wy = h * 0.1
  const ww = w * 0.34
  const wh = h * 0.28
  const sky = ctx.createLinearGradient(0, wy, 0, wy + wh)
  sky.addColorStop(0, '#bfe3ff')
  sky.addColorStop(1, '#fff4d6')
  ctx.fillStyle = sky
  ctx.fillRect(wx, wy, ww, wh)
  ctx.strokeStyle = 'rgba(255,255,255,.85)'
  ctx.lineWidth = Math.max(1, w * 0.012)
  ctx.strokeRect(wx, wy, ww, wh)
  ctx.beginPath()
  ctx.moveTo(wx + ww / 2, wy)
  ctx.lineTo(wx + ww / 2, wy + wh)
  ctx.stroke()
  // shelf + plant
  ctx.fillStyle = `hsl(${(hue + 20) % 360} 25% 35%)`
  ctx.fillRect(0, h * 0.44, w * 0.28, h * 0.012)
  ctx.fillStyle = '#3f8f4f'
  for (let i = 0; i < 5; i++) {
    ctx.beginPath()
    ctx.ellipse(w * (0.08 + i * 0.035), h * (0.41 - (i % 2) * 0.02), w * 0.035, h * 0.028, (i - 2) * 0.5, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.fillStyle = '#c96f4a'
  ctx.fillRect(w * 0.08, h * 0.415, w * 0.1, h * 0.028)

  // person
  const s = Math.min(w, h * 0.55)
  const cx = w * 0.5 + Math.sin(t * 0.7) * s * 0.03
  const cy = h * 0.5 + Math.sin(t * 1.1) * s * 0.008
  const r = s * 0.2
  // shoulders
  ctx.fillStyle = `hsl(${hue} 55% 42%)`
  ctx.beginPath()
  ctx.ellipse(cx, cy + r * 3.1, r * 2.5, r * 1.9, 0, Math.PI, 0)
  ctx.lineTo(cx + r * 2.5, h)
  ctx.lineTo(cx - r * 2.5, h)
  ctx.fill()
  ctx.fillRect(cx - r * 2.5, cy + r * 3.1, r * 5, h)
  // neck
  ctx.fillStyle = skin
  ctx.fillRect(cx - r * 0.38, cy + r * 0.7, r * 0.76, r * 0.9)
  // head
  ctx.beginPath()
  ctx.ellipse(cx, cy, r * 0.9, r * 1.08, Math.sin(t * 0.9) * 0.05, 0, Math.PI * 2)
  ctx.fill()
  // hair
  ctx.fillStyle = hair
  ctx.beginPath()
  ctx.ellipse(cx, cy - r * 0.35, r * 0.98, r * 0.85, 0, Math.PI, 0)
  ctx.fill()
  // eyes (blink)
  const blink = t % 4 < 0.12 ? 0.15 : 1
  ctx.fillStyle = '#1b1b1b'
  for (const dx of [-0.34, 0.34]) {
    ctx.beginPath()
    ctx.ellipse(cx + dx * r, cy + r * 0.05, r * 0.09, r * 0.11 * blink, 0, 0, Math.PI * 2)
    ctx.fill()
  }
  // mouth
  const open = talking ? Math.abs(Math.sin(t * 8.5)) * Math.abs(Math.sin(t * 1.3)) : 0
  ctx.fillStyle = '#7a2e2e'
  ctx.beginPath()
  ctx.ellipse(cx, cy + r * 0.52, r * 0.26, r * (0.05 + open * 0.14), 0, 0, Math.PI * 2)
  ctx.fill()
  // soft vignette
  const v = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.75)
  v.addColorStop(0, 'rgba(0,0,0,0)')
  v.addColorStop(1, 'rgba(0,0,0,.35)')
  ctx.fillStyle = v
  ctx.fillRect(0, 0, w, h)
}

/** A procedurally animated "camera feed" of a person (no real camera is used). */
export function FakeVideo({ color, seed = 1, res = 'hd', frozen, talking = true, className = '', mirrored }: { color: string; seed?: number; res?: Res; frozen?: boolean; talking?: boolean; className?: string; mirrored?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const state = useRef({ res, frozen, talking })
  state.current = { res, frozen, talking }
  useEffect(() => {
    const cv = ref.current!
    const ctx = cv.getContext('2d')
    if (!ctx) return
    let raf = 0
    let last = 0
    const hue = hueOf(color)
    const t0 = performance.now() - seed * 1000
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop)
      const { res: r, frozen: fz, talking: tk } = state.current
      if (fz && last) return
      // lower frame rate on poor connections
      const minDt = r === 'low' ? 250 : r === 'sd' ? 60 : 30
      if (now - last < minDt) return
      last = now
      const f = FACTOR[r]
      const w = Math.max(8, Math.round(cv.clientWidth * f))
      const h = Math.max(8, Math.round(cv.clientHeight * f))
      if (cv.width !== w || cv.height !== h) {
        cv.width = w
        cv.height = h
      }
      draw(ctx, w, h, (now - t0) / 1000, hue, seed, tk)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [color, seed])
  return <canvas ref={ref} className={`ft-canvas ${res} ${className}`} style={mirrored ? { transform: 'scaleX(-1)' } : undefined} aria-hidden />
}
