import { useEffect, useRef, useState } from 'react'
import { ShoppingCart, Search as SearchIcon, Truck, ShieldCheck, RotateCcw, ThumbsUp, MessageSquare, Bell, Play, Pause, Music2, Gamepad2, Trophy, Clock, Hourglass } from 'lucide-react'
import { useOS } from '../../os/store'
import { Scene } from '../../art/Scene'
import { AlbumArt } from '../../shell/widgets/AlbumArt'
import { A, Ad, D, Price, Stars, relDay, useWatch, useWeb } from './web'
import { useSafari, searchUrl } from './model'

// =============================== Bolt Electronics ===============================
function BoltHeader() {
  const cart = useSafari((s) => s.cart)
  const { go } = useWeb()
  const [q, setQ] = useState('')
  return (
    <header className="sf-bt-head sf-nav">
      <div className="sf-bt-top">
        <div className="sf-bt-logo">⚡ bolt</div>
        <button className="sf-bt-cart" aria-label={`Cart, ${cart} items`} onClick={() => useOS.getState().showToast(cart ? `${cart} item${cart > 1 ? 's' : ''} in your Bolt cart` : 'Your cart is empty')}>
          <ShoppingCart size={20} />
          {cart > 0 && <i>{cart}</i>}
        </button>
      </div>
      <form className="sf-bt-search" onSubmit={(e) => { e.preventDefault(); if (q.trim()) go(searchUrl(q)) }}>
        <SearchIcon size={15} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search Bolt" aria-label="Search Bolt" enterKeyHint="search" />
      </form>
    </header>
  )
}

const HUES = [
  { name: 'Midnight', hue: 0, sw: '#1f2430' },
  { name: 'Glacier', hue: 160, sw: '#cfe3f2' },
  { name: 'Sage', hue: 60, sw: '#9fb59a' },
]

export function HeadphonesSite() {
  const url = 'bolt.example/headphones-x2'
  const watch = useWatch(url)
  const dropped = !!watch?.triggered && watch.kind === 'price'
  const [color, setColor] = useState(0)
  const [qty, setQty] = useState(1)
  const [helpful, setHelpful] = useState<Record<number, boolean>>({})
  const add = () => {
    useSafari.getState().set({ cart: useSafari.getState().cart + qty })
    useOS.getState().showToast(`Added ${qty} to cart`, 'cart')
  }
  const reviews = [
    { who: 'Priyanka R.', stars: 5, t: 'Best ANC I’ve tried under $300', b: 'Wore them on a 5-hour flight and forgot they were on. Transparency mode sounds natural.' },
    { who: 'devon_builds', stars: 4, t: 'Great sound, case is bulky', b: 'Bass is punchy without being muddy. Wish the case folded flatter.' },
    { who: 'M. Chen', stars: 5, t: 'Battery lasts forever', b: 'Charged once in two weeks of commuting. Multipoint switching works well.' },
  ]
  return (
    <div className="sf-page sf-bt">
      <BoltHeader />
      <div className="sf-bt-crumb">Audio › Headphones › Over-ear</div>
      <div className="sf-layout">
        <main className="sf-main">
          <div className="sf-bt-gallery sf-media" style={{ filter: `hue-rotate(${HUES[color].hue}deg)` }}>
            <Scene scene="product-headphones" />
            {dropped && <span className="sf-bt-flag">Price drop</span>}
          </div>
          <h1 className="sf-bt-title">Aurora X2 Wireless Noise-Cancelling Headphones</h1>
          <div className="sf-bt-rating"><Stars value={4.6} /> <span>4.6 · 1,284 ratings</span></div>
          <div className="sf-bt-price">
            {dropped ? (
              <>
                <Price className="big red">$199.00</Price>
                <s>$249.00</s>
                <span className="sf-bt-save">Save $50 (20%)</span>
              </>
            ) : (
              <Price className="big">$249.00</Price>
            )}
          </div>
          {dropped && <div className="sf-bt-drop"><Bell size={14} /> Price dropped since you asked Safari to notify you.</div>}
          <div className="sf-bt-stock"><span className="ok">●</span> In stock · <Truck size={14} /> Free delivery <D>{relDay(2, { weekday: 'long', month: 'short', day: 'numeric' })}</D></div>
          <div className="sf-bt-opt">
            <span>Color: <b>{HUES[color].name}</b></span>
            <div className="sf-bt-swatches">
              {HUES.map((h, i) => (
                <button key={h.name} className={color === i ? 'on' : ''} style={{ background: h.sw }} onClick={() => setColor(i)} aria-label={h.name} />
              ))}
            </div>
          </div>
          <div className="sf-bt-buy">
            <div className="sf-bt-qty">
              <button onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="Decrease quantity">−</button>
              <span>{qty}</span>
              <button onClick={() => setQty((q) => Math.min(5, q + 1))} aria-label="Increase quantity">+</button>
            </div>
            <button className="sf-bt-add" onClick={add}>Add to Cart</button>
          </div>
          <div className="sf-bt-perks">
            <span><ShieldCheck size={16} /> 2-year warranty</span>
            <span><RotateCcw size={16} /> 30-day returns</span>
          </div>
          <article className="sf-article sf-bt-desc">
            <h2>About this item</h2>
            <ul>
              <li>Adaptive noise cancellation that adjusts 200 times per second to your surroundings.</li>
              <li>Up to 40 hours of playback; a 10-minute charge adds 5 hours.</li>
              <li>Spatial audio with head tracking and a custom-tuned 40 mm driver.</li>
              <li>Multipoint Bluetooth 5.4 — switch between phone and laptop automatically.</li>
            </ul>
            <table className="sf-table">
              <tbody>
                <tr><td>Weight</td><td>254 g</td></tr>
                <tr><td>Battery</td><td>40 hr (ANC on)</td></tr>
                <tr><td>Charging</td><td>USB-C, fast charge</td></tr>
                <tr><td>Codecs</td><td>AAC, SBC, LC3</td></tr>
              </tbody>
            </table>
          </article>
          <section className="sf-comments sf-bt-reviews">
            <h2>Customer reviews</h2>
            {reviews.map((r, i) => (
              <div key={i} className="sf-bt-review">
                <Stars value={r.stars} size={12} />
                <b>{r.t}</b>
                <p>{r.b}</p>
                <small>{r.who} · Verified purchase</small>
                <button className={helpful[i] ? 'on' : ''} onClick={() => setHelpful((h) => ({ ...h, [i]: !h[i] }))}><ThumbsUp size={12} /> Helpful{helpful[i] ? ' · Thanks!' : ''}</button>
              </div>
            ))}
          </section>
        </main>
        <aside className="sf-sidebar sf-bt-side">
          <h3>Customers also viewed</h3>
          <A to="bolt.example/sbc-kit" className="sf-bt-rel">
            <div className="sf-bt-relimg sf-media"><SbcArt /></div>
            <span>Single-Board Computer Starter Kit</span>
            <Price>$89.99</Price>
          </A>
          <A to="partsdepot.example/motors" className="sf-bt-rel">
            <div className="sf-bt-relimg sf-media"><MotorArt hue={20} /></div>
            <span>Brushless motors at Parts Depot</span>
            <Price>from $39</Price>
          </A>
          <Ad kind="box" variant={0} />
        </aside>
      </div>
      <footer className="sf-foot">Bolt Electronics · Greenfield Mall, Maple Grove</footer>
    </div>
  )
}

function SbcArt() {
  return (
    <svg viewBox="0 0 160 110" role="img" aria-label="Circuit board">
      <rect width="160" height="110" fill="#eef3ee" />
      <rect x="22" y="18" width="116" height="74" rx="6" fill="#1f8a4c" />
      <rect x="62" y="40" width="30" height="30" rx="3" fill="#222" />
      <rect x="104" y="26" width="26" height="14" rx="2" fill="#c0c0c0" />
      <rect x="104" y="46" width="26" height="14" rx="2" fill="#c0c0c0" />
      <rect x="30" y="22" width="60" height="6" fill="#ffd34d" />
      {Array.from({ length: 20 }).map((_, i) => <circle key={i} cx={32 + i * 3} cy={25} r={1} fill="#8a6d00" />)}
      <path d="M40 80h30M40 72h16M96 76h30" stroke="#9be3b3" strokeWidth="1.5" />
    </svg>
  )
}

function MotorArt({ hue = 20 }: { hue?: number }) {
  return (
    <svg viewBox="0 0 160 110" role="img" aria-label="Brushless motor">
      <rect width="160" height="110" fill={`hsl(${hue} 30% 95%)`} />
      <rect x="40" y="30" width="70" height="52" rx="10" fill={`hsl(${hue} 70% 50%)`} />
      <rect x="40" y="30" width="70" height="10" rx="4" fill="#00000022" />
      <rect x="110" y="50" width="26" height="10" rx="3" fill="#b8b8b8" />
      {[0, 1, 2, 3, 4].map((i) => <rect key={i} x={46 + i * 13} y={44} width="6" height="30" rx="2" fill="#00000026" />)}
      <path d="M44 82c-6 10-10 14-18 16M52 82c-2 10-4 14-10 18" stroke="#333" strokeWidth="2" fill="none" />
    </svg>
  )
}

export function SbcSite() {
  const url = 'bolt.example/sbc-kit'
  const watch = useWatch(url)
  const restocked = !!watch?.triggered
  const add = () => {
    useSafari.getState().set({ cart: useSafari.getState().cart + 1 })
    useOS.getState().showToast('Added to cart', 'cart')
  }
  return (
    <div className="sf-page sf-bt">
      <BoltHeader />
      <div className="sf-bt-crumb">Computers › Maker &amp; DIY</div>
      <div className="sf-layout">
        <main className="sf-main">
          <div className="sf-bt-gallery sf-media"><SbcArt /></div>
          <h1 className="sf-bt-title">Single-Board Computer Starter Kit (8 GB)</h1>
          <div className="sf-bt-rating"><Stars value={4.8} /> <span>4.8 · 612 ratings</span></div>
          <div className="sf-bt-price"><Price className="big">$89.99</Price></div>
          {restocked ? (
            <div className="sf-bt-stock"><span className="ok">●</span> <b>Back in stock</b> — only 4 left · Ships <D>{relDay(1, { weekday: 'long' })}</D></div>
          ) : (
            <div className="sf-bt-stock"><span className="no">●</span> <b>Temporarily out of stock.</b> Expected <D>{relDay(9, { month: 'short', day: 'numeric' })}</D></div>
          )}
          <div className="sf-bt-buy">
            <button className="sf-bt-add" disabled={!restocked} onClick={add}>{restocked ? 'Add to Cart' : 'Out of Stock'}</button>
          </div>
          <article className="sf-article sf-bt-desc">
            <h2>What’s in the box</h2>
            <ul>
              <li>Quad-core single-board computer with 8 GB RAM</li>
              <li>Aluminum case with fan, 27 W USB-C power supply</li>
              <li>32 GB microSD card with OS preinstalled</li>
              <li>Sensor pack: temperature, motion, distance, 40-pin ribbon cable</li>
            </ul>
            <p>Perfect for robotics dashboards, retro gaming and first coding projects. Our order <b>BE-58213</b> customers report setup in under 15 minutes.</p>
          </article>
        </main>
        <aside className="sf-sidebar sf-bt-side">
          <h3>Pairs well with</h3>
          <A to="bolt.example/headphones-x2" className="sf-bt-rel">
            <div className="sf-bt-relimg sf-media"><Scene scene="product-headphones" /></div>
            <span>Aurora X2 Headphones</span>
            <Price>$249.00</Price>
          </A>
          <Ad kind="box" variant={2} />
        </aside>
      </div>
      <footer className="sf-foot">Bolt Electronics · Greenfield Mall, Maple Grove</footer>
    </div>
  )
}

// =============================== Robotics Forum ===============================
export function ForumSite() {
  const watch = useWatch('robotics-forum.example/swerve')
  const updated = !!watch?.triggered
  const [votes, setVotes] = useState<Record<string, number>>({})
  const [comments, setComments] = useState([
    { id: 'c1', who: 'nora_k', t: '3h', text: 'The kS tip fixed our jitter at low speeds. Thanks!', up: 24 },
    { id: 'c2', who: 'team1138_mech', t: '5h', text: 'Make sure your absolute encoder offsets are saved after every module swap. Burned us at a scrimmage.', up: 41 },
    { id: 'c3', who: 'alex_7729', t: '1d', text: 'We ended up at kP 0.42 for steering with an 150:7 ratio. Close to your table.', up: 12 },
  ])
  const [draft, setDraft] = useState('')
  const post = () => {
    if (!draft.trim()) return
    setComments((c) => [{ id: `c${Date.now()}`, who: 'jamie_builds', t: 'now', text: draft.trim(), up: 1 }, ...c])
    setDraft('')
  }
  return (
    <div className="sf-page sf-rf">
      <header className="sf-rf-head sf-nav">
        <div className="sf-rf-logo">⚙︎ robotics<span>forum</span></div>
        <nav><a>Mechanical</a><a>Software</a><a>Electrical</a><a>Strategy</a></nav>
      </header>
      <div className="sf-rf-crumb">Forums › Mechanical › Drivetrains</div>
      <div className="sf-layout">
        <main className="sf-main">
          <article className="sf-article">
            <h1>Swerve Module Tuning Guide</h1>
            <div className="sf-rf-author">
              <span className="sf-rf-av">CR</span>
              <div><b>coach_ramirez</b><small>Mentor · Team 5410 · posted <D>{relDay(-12, { month: 'short', day: 'numeric' })}</D></small></div>
            </div>
            <div className="sf-rf-tags"><span>swerve</span><span>pid</span><span>feedforward</span></div>
            {updated && (
              <div className="sf-rf-update" id="rf-update">
                <b>Update <D>{relDay(0, { month: 'short', day: 'numeric' })}</D>:</b> Added a section on current limits for the new brushless motors — see “Current limits” below.
              </div>
            )}
            <p>Swerve drivetrains are incredibly capable, but a badly tuned module turns your robot into a shopping cart. This guide walks through tuning the steering loop first, then the drive loop, using values that work for most off-the-shelf modules.</p>
            <h2>1. Zero your absolute encoders</h2>
            <p>Point every wheel forward with the bevel gears facing the same side, then record each encoder’s offset. Save the offsets in code and double-check them whenever you swap a module.</p>
            <figure className="sf-figure sf-media sf-rf-fig">
              <svg viewBox="0 0 300 130" role="img" aria-label="Top view of four swerve modules">
                <rect x="70" y="15" width="160" height="100" rx="10" fill="#f1ecff" stroke="#6e3bd8" strokeWidth="2" />
                {[[90, 35], [210, 35], [90, 95], [210, 95]].map(([x, y], i) => (
                  <g key={i} transform={`translate(${x} ${y})`}>
                    <rect x="-9" y="-15" width="18" height="30" rx="4" fill="#6e3bd8" />
                    <path d="M0 -24 L5 -17 L-5 -17Z" fill="#6e3bd8" />
                  </g>
                ))}
                <text x="150" y="70" textAnchor="middle" fontSize="11" fill="#6e3bd8">front ↑</text>
              </svg>
              <figcaption>All four modules zeroed facing forward.</figcaption>
            </figure>
            <h2>2. Steering PID</h2>
            <p>Start with kP only. Increase it until the module snaps to position with a slight overshoot, then back off 20%. Add a small kD if it oscillates. Enable continuous input from −π to π so the module takes the shortest path.</p>
            <pre className="sf-code"><code>{`steerPID = new PIDController(0.42, 0.0, 0.004);
steerPID.enableContinuousInput(-Math.PI, Math.PI);
double out = steerPID.calculate(angle, target.angle);`}</code></pre>
            <h2>3. Drive feedforward</h2>
            <p>Characterize kS, kV and kA with a quasistatic and dynamic test. kS overcomes static friction — it is the fix for “jittery at low speed.”</p>
            <table className="sf-table">
              <thead><tr><th>Gain</th><th>Typical</th><th>Units</th></tr></thead>
              <tbody>
                <tr><td>kS</td><td>0.18</td><td>V</td></tr>
                <tr><td>kV</td><td>2.35</td><td>V·s/m</td></tr>
                <tr><td>kA</td><td>0.21</td><td>V·s²/m</td></tr>
              </tbody>
            </table>
            {updated && (
              <>
                <h2>4. Current limits (new)</h2>
                <p>Set a 40 A supply limit and an 80 A stator limit on drive motors to prevent brownouts during pushing matches. Steering motors rarely need more than 20 A.</p>
              </>
            )}
            <h2>{updated ? '5' : '4'}. Common problems</h2>
            <ul>
              <li>Module spins the long way around → continuous input not enabled.</li>
              <li>Robot drifts while rotating → check gyro orientation and discretize chassis speeds.</li>
              <li>One wheel fights the others → an encoder offset is wrong by 180°.</li>
            </ul>
          </article>
          <Ad kind="strip" variant={3} />
          <section className="sf-comments sf-rf-comments">
            <h2><MessageSquare size={16} /> {comments.length} replies</h2>
            <form className="sf-rf-reply" onSubmit={(e) => { e.preventDefault(); post() }}>
              <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Add a reply…" aria-label="Add a reply" enterKeyHint="send" />
              <button type="submit" disabled={!draft.trim()}>Post</button>
            </form>
            {comments.map((c) => {
              const v = votes[c.id] ?? 0
              return (
                <div key={c.id} className="sf-rf-c">
                  <button className={`sf-rf-up ${v ? 'on' : ''}`} onClick={() => setVotes((x) => ({ ...x, [c.id]: v ? 0 : 1 }))} aria-label="Upvote">▲<span>{c.up + v}</span></button>
                  <div>
                    <b>{c.who}</b> <small>{c.t}</small>
                    <p>{c.text}</p>
                  </div>
                </div>
              )
            })}
          </section>
        </main>
        <aside className="sf-sidebar sf-rf-side">
          <h3>Related threads</h3>
          <a>Choosing a gear ratio for swerve</a>
          <a>Pathing with odometry drift</a>
          <A to="partsdepot.example/motors">Where to buy brushless motors?</A>
          <h3>Parts mentioned</h3>
          <A to="partsdepot.example/motors">Kestrel BL-550 — Parts Depot</A>
        </aside>
      </div>
      <footer className="sf-foot">Robotics Forum · Community guidelines</footer>
    </div>
  )
}

// =============================== Parts Depot ===============================
const PARTS = [
  { id: 'p1', name: 'Kestrel BL-550 Brushless Motor', cat: 'Brushless', price: 42, hue: 20, stock: 'In stock', rating: 4.7 },
  { id: 'p2', name: 'Kestrel BL-775 High-Torque', cat: 'Brushless', price: 59, hue: 200, stock: 'In stock', rating: 4.5 },
  { id: 'p3', name: 'Falcon-Lite 60 Brushless', cat: 'Brushless', price: 39, hue: 0, stock: 'Low stock', rating: 4.2 },
  { id: 'p4', name: 'SparkLine Motor Controller', cat: 'Controllers', price: 74, hue: 280, stock: 'In stock', rating: 4.8 },
  { id: 'p5', name: 'MagEnc Absolute Encoder', cat: 'Encoders', price: 28, hue: 140, stock: 'In stock', rating: 4.6 },
  { id: 'p6', name: 'Thru-Bore Encoder v2', cat: 'Encoders', price: 49, hue: 100, stock: 'Backorder', rating: 4.4 },
]
export function PartsSite() {
  const [cat, setCat] = useState('All')
  const [sort, setSort] = useState<'pop' | 'low'>('pop')
  const [added, setAdded] = useState<Record<string, boolean>>({})
  const watch = useWatch('partsdepot.example/motors')
  const list = PARTS.filter((p) => cat === 'All' || p.cat === cat).sort((a, b) => (sort === 'low' ? a.price - b.price : b.rating - a.rating))
  return (
    <div className="sf-page sf-pd">
      <header className="sf-pd-head sf-nav">
        <div className="sf-pd-logo">PARTS<span>DEPOT</span></div>
        <small>Free shipping for registered teams</small>
      </header>
      <Ad kind="strip" variant={1} />
      <div className="sf-layout">
        <main className="sf-main">
          <h1 className="sf-pd-h1">Brushless Motors &amp; Motion</h1>
          {watch?.triggered && <div className="sf-pd-new">New this week: Kestrel BL-550 v2 now shipping.</div>}
          <div className="sf-pd-bar">
            <div className="sf-pd-chips">
              {['All', 'Brushless', 'Controllers', 'Encoders'].map((c) => <button key={c} className={cat === c ? 'on' : ''} onClick={() => setCat(c)}>{c}</button>)}
            </div>
            <button className="sf-pd-sort" onClick={() => setSort((s) => (s === 'pop' ? 'low' : 'pop'))}>Sort: {sort === 'pop' ? 'Top rated' : 'Price ↑'}</button>
          </div>
          <div className="sf-pd-grid">
            {list.map((p) => (
              <div key={p.id} className="sf-pd-card">
                <div className="sf-media"><MotorArt hue={p.hue} /></div>
                <b>{p.name}</b>
                <Stars value={p.rating} size={11} />
                <div className="sf-pd-row">
                  <Price>${p.price.toFixed(2)}</Price>
                  <small className={p.stock === 'In stock' ? 'ok' : 'warn'}>{p.stock}</small>
                </div>
                <button className={added[p.id] ? 'on' : ''} disabled={p.stock === 'Backorder'} onClick={() => { setAdded((a) => ({ ...a, [p.id]: true })); useOS.getState().showToast(`${p.name} added to cart`, 'cart') }}>
                  {added[p.id] ? 'Added ✓' : p.stock === 'Backorder' ? 'Backorder' : 'Add to cart'}
                </button>
              </div>
            ))}
          </div>
          <article className="sf-article sf-pd-guide">
            <h2>Buying guide</h2>
            <p>Most competition drivetrains use two brushless motors per side or one per swerve module. Pair each motor with a controller that supports current limiting, and add an absolute encoder for steering.</p>
          </article>
        </main>
        <aside className="sf-sidebar sf-pd-side">
          <h3>Team deals</h3>
          <p>Order before <D>{relDay(4, { weekday: 'long', month: 'short', day: 'numeric' })}</D> for delivery before regionals.</p>
          <A to="robotics-forum.example/swerve">Read: Swerve tuning guide</A>
        </aside>
      </div>
      <footer className="sf-foot">Parts Depot · Robotics &amp; maker supply</footer>
    </div>
  )
}

// =============================== The Morning Brief ===============================
export function NewsSite() {
  const d = new Date()
  return (
    <div className="sf-page sf-mb">
      <header className="sf-mb-head sf-nav">
        <div className="sf-mb-date"><D>{d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</D></div>
        <div className="sf-mb-logo">The Morning Brief</div>
        <nav><a className="on">Top</a><A to="weather.example/maple-grove">Weather</A><A to="lincoln.example/calendar">Schools</A><A to="tunedaily.example/luma-coast">Culture</A></nav>
      </header>
      <div className="sf-layout">
        <main className="sf-main">
          <article className="sf-article sf-mb-lead">
            <A to="stormwatch.example/radar" className="sf-mb-leadimg sf-media"><Scene scene="city-night" /></A>
            <span className="sf-mb-kicker">Weather</span>
            <h1><A to="stormwatch.example/radar">Line of thunderstorms to sweep Maple Grove Thursday evening</A></h1>
            <p>Forecasters expect storms between 5 and 11 PM <D>{relDay((4 - d.getDay() + 7) % 7, { weekday: 'long' })}</D>, with gusts near 45 mph. Several schools have already moved outdoor practices indoors.</p>
          </article>
          <Ad variant={2} />
          <div className="sf-mb-grid">
            <article className="sf-article sf-mb-story">
              <span className="sf-mb-kicker">Education</span>
              <h2><A to="robotics-forum.example/swerve">Student robotics participation jumps 30% statewide</A></h2>
              <p>Teams report record sign-ups as the regional qualifier approaches in five weeks.</p>
            </article>
            <article className="sf-article sf-mb-story">
              <span className="sf-mb-kicker">Music</span>
              <h2><A to="tunedaily.example/luma-coast">Luma Coast announces fall tour with a Maple Grove stop</A></h2>
              <p>The band will play the Riverside Amphitheater on <D>{relDay(24, { month: 'long', day: 'numeric' })}</D>.</p>
            </article>
            <article className="sf-article sf-mb-story">
              <span className="sf-mb-kicker">Local</span>
              <h2><A to="lincoln.example/calendar">Lincoln High homecoming week kicks off with club fair</A></h2>
              <p>Tickets for the dance are on sale in the student store.</p>
            </article>
            <article className="sf-article sf-mb-story">
              <span className="sf-mb-kicker">Deals</span>
              <h2><A to="bolt.example/headphones-x2">Bolt Electronics fall sale: headphones and maker kits discounted</A></h2>
              <p>The Aurora X2 is among the items expected to drop in price this week.</p>
            </article>
          </div>
          <article className="sf-article sf-mb-story">
            <span className="sf-mb-kicker">Culture</span>
            <h2>The fall art walk returns downtown this weekend</h2>
            <p>More than 40 galleries and studios will open their doors <D>{relDay((6 - d.getDay() + 7) % 7, { weekday: 'long' })}</D> from noon to 8 PM, with live music on Main Street and food trucks near the library.</p>
          </article>
        </main>
        <aside className="sf-sidebar sf-mb-side">
          <h3>Most read</h3>
          <ol>
            <li><A to="stormwatch.example/radar">Live radar: storms approach</A></li>
            <li><A to="chemreview.example/unit-3">How to ace stoichiometry</A></li>
            <li><A to="tunedaily.example/luma-coast">Luma Coast tour dates</A></li>
          </ol>
          <h3>Markets</h3>
          <div className="sf-mb-mkt"><span>MGX</span><b className="up">+0.8%</b></div>
          <div className="sf-mb-mkt"><span>TECH</span><b className="dn">−0.3%</b></div>
        </aside>
      </div>
      <footer className="sf-foot">The Morning Brief · Independent local news</footer>
    </div>
  )
}

// =============================== TuneDaily ===============================
export function MusicSite() {
  const playing = useOS((s) => s.nowPlaying.playing && s.nowPlaying.trackId === 't1')
  const listen = () => {
    const st = useOS.getState()
    if (playing) st.togglePlay()
    else st.playTrack('t1', ['t1', 't2'], 'TuneDaily')
  }
  const dates = [
    { d: 8, city: 'Portland, OR', venue: 'Crystal Hall' },
    { d: 11, city: 'Seattle, WA', venue: 'Pier Pavilion' },
    { d: 17, city: 'Boise, ID', venue: 'Riverside Theater' },
    { d: 24, city: 'Maple Grove', venue: 'Riverside Amphitheater' },
    { d: 31, city: 'San Francisco, CA', venue: 'The Foundry' },
  ]
  return (
    <div className="sf-page sf-td">
      <header className="sf-td-head sf-nav">
        <div className="sf-td-logo">tune<span>daily</span></div>
        <nav><a className="on">News</a><a>Reviews</a><a>Tours</a></nav>
      </header>
      <div className="sf-layout">
        <main className="sf-main">
          <article className="sf-article">
            <span className="sf-td-kicker">Tour news</span>
            <h1>Luma Coast announces fall tour</h1>
            <p className="sf-td-by">By Jordan Wells · <D>{relDay(-1, { month: 'long', day: 'numeric' })}</D></p>
            <div className="sf-td-hero sf-media">
              <AlbumArt album="Salt & Static" hue={198} size="100%" radius={0} />
            </div>
            <p className="sf-td-lede">After a summer of festival sets, Luma Coast is heading out on an 18-city headline tour behind <i>Salt &amp; Static</i>, the album that gave us “Tidal” and “Afterglow Avenue.”</p>
            <div className="sf-td-listen">
              <button onClick={listen}>{playing ? <Pause size={16} /> : <Play size={16} />} {playing ? 'Pause' : 'Listen to “Tidal”'}</button>
              <span><Music2 size={14} /> Playing in Music</span>
            </div>
            <p>The run opens in Portland and winds down the West Coast before a hometown-style show at Maple Grove’s Riverside Amphitheater. Singer Mara Lin says the new production leans on “less screen, more light,” with a rig built from reclaimed stage lamps.</p>
            <h2>Tour dates</h2>
            <table className="sf-table sf-td-dates">
              <tbody>
                {dates.map((x) => (
                  <tr key={x.d}>
                    <td><D>{relDay(x.d, { month: 'short', day: 'numeric' })}</D></td>
                    <td><b>{x.city}</b><br /><small>{x.venue}</small></td>
                    <td><button onClick={() => useOS.getState().showToast(`Presale reminder set for ${x.city}`, 'bell')}>Tickets</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p>Presale for fan-club members starts <D>{relDay(2, { weekday: 'long', month: 'long', day: 'numeric' })}</D> at 10 AM; general sale follows <D>{relDay(4, { weekday: 'long' })}</D>.</p>
            <h2>What they said</h2>
            <p>“We wrote this record on the coast with the windows open,” Lin told TuneDaily. “We want the shows to feel like that — salt in the air and a little static in the speakers.”</p>
          </article>
          <Ad variant={3} />
        </main>
        <aside className="sf-sidebar sf-td-side">
          <h3>Trending</h3>
          <a>The Midnight Ferns share “Paper Satellites” video</a>
          <a>10 drumlines that went viral this season</a>
          <A to="morningbrief.example/today">Morning Brief: local culture</A>
        </aside>
      </div>
      <footer className="sf-foot">TuneDaily · Music news every day</footer>
    </div>
  )
}

// =============================== GameZone ===============================
export function GameZoneSite() {
  const [playing, setPlaying] = useState(false)
  const [score, setScore] = useState(0)
  const [left, setLeft] = useState(10)
  const [pos, setPos] = useState({ x: 50, y: 50 })
  const best = useRef(0)
  useEffect(() => {
    if (!playing) return
    const t = window.setInterval(() => setLeft((l) => {
      if (l <= 1) {
        setPlaying(false)
        best.current = Math.max(best.current, score)
        return 0
      }
      return l - 1
    }), 1000)
    return () => window.clearInterval(t)
  }, [playing, score])
  const hop = () => setPos({ x: 10 + Math.random() * 80, y: 15 + Math.random() * 70 })
  const games = ['Biscuit Dash', 'Circuit Puzzle', 'Drum Hero', 'Robo Rally', 'Space Hopper', 'Word Tiles']
  return (
    <div className="sf-page sf-gz">
      <header className="sf-gz-head sf-nav"><Gamepad2 size={20} /> GameZone <small>Play free</small></header>
      <section className="sf-gz-stage sf-media">
        {playing ? (
          <button className="sf-gz-target" style={{ left: `${pos.x}%`, top: `${pos.y}%` }} onClick={() => { setScore((s) => s + 1); hop() }} aria-label="Tap target">🐶</button>
        ) : (
          <div className="sf-gz-start">
            <b>Biscuit Dash</b>
            <span>Tap Biscuit as many times as you can in 10 seconds.</span>
            {left === 0 && <span>Score: {score} · Best: {Math.max(best.current, score)}</span>}
            <button onClick={() => { setScore(0); setLeft(10); setPlaying(true); hop() }}><Play size={16} /> {left === 0 ? 'Play again' : 'Play'}</button>
          </div>
        )}
        <div className="sf-gz-hud"><Trophy size={14} /> {score} <Clock size={14} /> {left}s</div>
      </section>
      <Ad kind="strip" variant={3} />
      <h2 className="sf-gz-h2">Popular games</h2>
      <div className="sf-gz-grid">
        {games.map((g, i) => (
          <button key={g} className="sf-gz-tile" style={{ background: `linear-gradient(135deg, hsl(${i * 55} 80% 55%), hsl(${i * 55 + 40} 80% 45%))` }} onClick={() => useOS.getState().showToast(`${g} is loading…`)}>
            <b>{g}</b>
            <small>{(4.1 + (i % 4) / 5).toFixed(1)} ★ · {(i + 2) * 120}K plays</small>
          </button>
        ))}
      </div>
      <footer className="sf-foot">GameZone · Games for all ages</footer>
    </div>
  )
}

// =============================== VideoTube ===============================
const VIDEOS = [
  { id: 'v1', t: 'Drumline cadence — 120 bpm play-along', ch: 'PercussionLab', scene: 'concert-lights', dur: '4:12', views: '1.2M' },
  { id: 'v2', t: 'Building a swerve module in 10 minutes', ch: 'BuildSeason', scene: 'robot-workshop', dur: '10:48', views: '386K' },
  { id: 'v3', t: 'Golden retriever sees the ocean for the first time', ch: 'Happy Dogs', scene: 'dog-beach', dur: '2:31', views: '8.9M' },
  { id: 'v4', t: 'Storm chasing: lightning in slow motion', ch: 'SkyWatch', scene: 'night-sky', dur: '7:05', views: '2.4M' },
  { id: 'v5', t: 'Easy weeknight ramen', ch: 'Noodle Nerd', scene: 'food-ramen', dur: '6:20', views: '910K' },
  { id: 'v6', t: 'Mountain lake timelapse (4K)', ch: 'Quiet Places', scene: 'mountain-lake', dur: '12:00', views: '4.1M' },
]
export function VideoTubeSite() {
  const [cur, setCur] = useState<string | null>(null)
  const [prog, setProg] = useState(0)
  const [paused, setPaused] = useState(false)
  useEffect(() => {
    if (!cur || paused) return
    const t = window.setInterval(() => setProg((p) => (p >= 100 ? 100 : p + 1.5)), 200)
    return () => window.clearInterval(t)
  }, [cur, paused])
  const v = VIDEOS.find((x) => x.id === cur)
  return (
    <div className="sf-page sf-vt">
      <header className="sf-vt-head sf-nav"><span className="sf-vt-logo">▶</span> VideoTube</header>
      {v && (
        <div className="sf-vt-player sf-media">
          <Scene scene={v.scene} />
          <button className="sf-vt-pp" onClick={() => setPaused((p) => !p)} aria-label={paused ? 'Play' : 'Pause'}>{paused ? <Play size={26} /> : <Pause size={26} />}</button>
          <div className="sf-vt-prog"><i style={{ width: `${prog}%` }} /></div>
          <div className="sf-vt-now"><b>{v.t}</b><small>{v.ch} · {v.views} views</small></div>
        </div>
      )}
      <Ad kind="strip" variant={3} />
      <div className="sf-vt-grid">
        {VIDEOS.map((x) => (
          <button key={x.id} className="sf-vt-card" onClick={() => { setCur(x.id); setProg(0); setPaused(false) }}>
            <div className="sf-vt-thumb sf-media"><Scene scene={x.scene} /><span>{x.dur}</span></div>
            <b>{x.t}</b>
            <small>{x.ch} · {x.views} views</small>
          </button>
        ))}
      </div>
      <footer className="sf-foot">VideoTube</footer>
    </div>
  )
}

// =============================== Screen Time restricted page ===============================
export function RestrictedPage({ host, onAsk }: { host: string; onAsk: () => void }) {
  const cfg = useOS((s) => s.screenTime)
  const req = [...cfg.pendingRequests].reverse().find((r) => r.site === host)
  const pending = req?.status === 'pending'
  const denied = req?.status === 'denied'
  return (
    <div className="sf-restricted">
      <div className="sf-restricted-icon"><Hourglass size={34} /></div>
      <h1>Restricted</h1>
      <p>You can’t browse <b>{host}</b> because it is restricted.</p>
      {pending ? (
        <div className="sf-restricted-wait">
          <span className="spinner" style={{ width: 18, height: 18 }} /> Waiting for a parent to respond…
        </div>
      ) : (
        <button className="sf-restricted-ask" onClick={onAsk}>Ask Permission</button>
      )}
      {denied && <p className="sf-restricted-denied">Your last request was declined.</p>}
      <small>Screen Time · {cfg.childName}’s iPhone</small>
    </div>
  )
}
