/**
 * Spring physics → CSS `linear()` easing.
 *
 * iOS motion is driven by damped springs described by a response (period)
 * and damping fraction. We integrate that spring once, sample it, and emit a
 * CSS `linear()` timing function that the compositor can run without JS.
 */

export interface SpringSpec {
  /** Approximate time in seconds for one oscillation (SwiftUI "response"). */
  response: number
  /** 1 = critically damped, <1 bouncy. SwiftUI "dampingFraction". */
  damping: number
  /** Initial velocity, in units of total distance per second. */
  velocity?: number
}

export interface SpringEasing {
  easing: string
  duration: number
}

const cache = new Map<string, SpringEasing>()

function solve(spec: SpringSpec, t: number): number {
  const omega = (2 * Math.PI) / spec.response
  const zeta = spec.damping
  const v0 = -(spec.velocity ?? 0)
  const x0 = -1
  if (zeta < 1) {
    const wd = omega * Math.sqrt(1 - zeta * zeta)
    const env = Math.exp(-zeta * omega * t)
    return 1 + env * (x0 * Math.cos(wd * t) + ((zeta * omega * x0 + v0) / wd) * Math.sin(wd * t))
  }
  // critically damped
  const env = Math.exp(-omega * t)
  return 1 + env * (x0 + (v0 + omega * x0) * t)
}

export function spring(spec: SpringSpec): SpringEasing {
  const key = `${spec.response}:${spec.damping}:${spec.velocity ?? 0}`
  const hit = cache.get(key)
  if (hit) return hit
  // find settle time
  const dt = 1 / 120
  let settle = spec.response * 2
  for (let t = 0; t < 4; t += dt) {
    let settled = true
    for (let k = 0; k < 12; k++) {
      if (Math.abs(solve(spec, t + k * dt) - 1) > 0.0015) {
        settled = false
        break
      }
    }
    if (settled) {
      settle = t
      break
    }
  }
  settle = Math.max(settle, 0.12)
  const samples = Math.min(64, Math.max(20, Math.round(settle * 60)))
  const pts: string[] = []
  for (let i = 0; i <= samples; i++) {
    const t = (i / samples) * settle
    const v = i === samples ? 1 : solve(spec, t)
    pts.push(`${+v.toFixed(4)}`)
  }
  const result = { easing: `linear(${pts.join(', ')})`, duration: Math.round(settle * 1000) }
  cache.set(key, result)
  return result
}

/** Named springs mirroring the feel of system animations. */
export const springs = {
  /** App open: fast, very slight overshoot. */
  appOpen: () => spring({ response: 0.4, damping: 0.85 }),
  appClose: () => spring({ response: 0.4, damping: 0.9 }),
  /** Sheets, Control Center. */
  sheet: () => spring({ response: 0.38, damping: 0.88 }),
  /** Snappy UI: toggles, menus. */
  snappy: () => spring({ response: 0.28, damping: 0.8 }),
  /** Bouncy: Dynamic Island. */
  island: () => spring({ response: 0.45, damping: 0.7 }),
  smooth: () => spring({ response: 0.5, damping: 1 }),
  push: () => spring({ response: 0.36, damping: 1 }),
}

export function reducedMotion(): boolean {
  return (
    document.documentElement.dataset.reduceMotion === 'true' ||
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  )
}

/** Animate an element with a named spring via the Web Animations API. */
export function animateSpring(
  el: Element,
  keyframes: Keyframe[] | PropertyIndexedKeyframes,
  s: SpringEasing = springs.snappy(),
  opts: KeyframeAnimationOptions = {},
): Animation {
  const rm = reducedMotion()
  return el.animate(keyframes, {
    duration: rm ? Math.min(160, s.duration) : s.duration,
    easing: rm ? 'ease-out' : s.easing,
    fill: 'both',
    ...opts,
  })
}

/** Install spring easings as CSS custom properties on :root. */
export function installSpringVars(): void {
  const root = document.documentElement.style
  for (const [name, fn] of Object.entries(springs)) {
    const s = fn()
    root.setProperty(`--spring-${name}`, s.easing)
    root.setProperty(`--spring-${name}-dur`, `${s.duration}ms`)
  }
}
