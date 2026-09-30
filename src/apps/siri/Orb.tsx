/** Siri's glowing orb (original drawing): layered conic gradients that swirl. */
export function Orb({ size = 32, state = 'idle', still }: { size?: number; state?: 'idle' | 'listening' | 'thinking'; still?: boolean }) {
  return (
    <span className={`siriapp-orb ${state} ${still ? 'still' : ''}`} style={{ width: size, height: size }} aria-hidden>
      <span className="siriapp-orb-a" />
      <span className="siriapp-orb-b" />
      <span className="siriapp-orb-shine" />
    </span>
  )
}

/** Large hero orb with a halo used on the empty chat screen. */
export function HeroOrb({ state = 'idle' }: { state?: 'idle' | 'listening' | 'thinking' }) {
  return (
    <div className={`siriapp-hero-orb ${state}`} aria-hidden>
      <div className="siriapp-hero-halo" />
      <Orb size={112} state={state} />
    </div>
  )
}

/** Listening waveform (animated bars). */
export function Waveform({ bars = 28, active = true }: { bars?: number; active?: boolean }) {
  return (
    <div className={`siriapp-wave ${active ? 'on' : ''}`} aria-hidden>
      {Array.from({ length: bars }).map((_, i) => (
        <span key={i} style={{ animationDelay: `${(i * 67) % 900}ms`, animationDuration: `${700 + ((i * 131) % 500)}ms` }} />
      ))}
    </div>
  )
}
