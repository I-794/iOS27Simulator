import { useEffect, useMemo, useState } from 'react'
import { Sun, Cloud, CloudSun, CloudRain, CloudLightning, Moon, CloudMoon, Wind, Droplets, Eye, Gauge, Sunrise, Sunset, Play, Pause, AlertTriangle, Search as SearchIcon, Menu, CalendarPlus, Check, ChevronLeft, ChevronRight, Zap, MapPin } from 'lucide-react'
import { WEATHER, SAFARI_SITES } from '../../os/data/world'
import { useOS } from '../../os/store'
import { at, DAY, startOfDay } from '../../os/time'
import { A, Ad, D, Jump, relDay, useWeb } from './web'
import { BRAND, searchUrl, SEARCH_HOST } from './model'

const ICON: Record<string, typeof Sun> = { sun: Sun, cloud: Cloud, 'cloud-sun': CloudSun, 'cloud-rain': CloudRain, 'cloud-bolt': CloudLightning, moon: Moon, 'cloud-moon': CloudMoon }

// =============================== WeatherNow ===============================
export function WeatherSite() {
  const W = WEATHER
  const lo = Math.min(...W.daily.map((d) => d.lo))
  const hi = Math.max(...W.daily.map((d) => d.hi))
  return (
    <div className="sf-page sf-wx">
      <header className="sf-wx-head sf-nav">
        <div className="sf-wx-logo"><CloudSun size={20} /> WeatherNow</div>
        <nav>
          <a className="on">Today</a>
          <Jump id="wx-hourly">Hourly</Jump>
          <Jump id="wx-10day">10-Day</Jump>
          <A to="stormwatch.example/radar">Radar</A>
        </nav>
      </header>
      <div className="sf-layout">
        <main className="sf-main">
          <section className="sf-wx-hero">
            <div className="sf-wx-loc"><MapPin size={14} /> Maple Grove</div>
            <div className="sf-wx-now">
              <span className="sf-wx-temp">{W.temp}°</span>
              <CloudSun size={64} strokeWidth={1.5} />
            </div>
            <div className="sf-wx-cond">{W.condition} · Feels like {W.feels}°</div>
            <div className="sf-wx-hl">H {W.high}° · L {W.low}°</div>
          </section>
          <A to="stormwatch.example/radar" className="sf-wx-alert">
            <AlertTriangle size={18} />
            <span><b>Severe Thunderstorm Watch</b> — <D>{relDay(daysToThu(), { weekday: 'long' })}</D> evening, 5 PM – 11 PM. Tap for live radar.</span>
          </A>
          <h2 id="wx-hourly" className="sf-wx-h2">Hourly</h2>
          <div className="sf-wx-hourly">
            {W.hourly.slice(0, 16).map((h, i) => {
              const I = ICON[h.icon] ?? Sun
              return (
                <div key={i} className="sf-wx-hour">
                  <span>{i === 0 ? 'Now' : `${h.h % 12 || 12}${h.h < 12 ? 'a' : 'p'}`}</span>
                  <I size={20} />
                  <b>{h.t}°</b>
                  {h.pop > 0 && <small>{h.pop}%</small>}
                </div>
              )
            })}
          </div>
          <h2 id="wx-10day" className="sf-wx-h2">10-Day Forecast</h2>
          <div className="sf-wx-days">
            {W.daily.map((d, i) => {
              const I = ICON[d.icon] ?? Sun
              const left = ((d.lo - lo) / (hi - lo)) * 100
              const width = ((d.hi - d.lo) / (hi - lo)) * 100
              return (
                <div key={i} className="sf-wx-day">
                  <span className="sf-wx-dname">{i === 0 ? 'Today' : relDay(i, { weekday: 'short' })}</span>
                  <I size={20} />
                  <span className="sf-wx-pop">{d.pop ? `${d.pop}%` : ''}</span>
                  <span className="sf-wx-lo">{d.lo}°</span>
                  <span className="sf-wx-bar"><i style={{ left: `${left}%`, width: `${width}%` }} /></span>
                  <span className="sf-wx-hi">{d.hi}°</span>
                </div>
              )
            })}
          </div>
          <Ad variant={0} />
          <div className="sf-wx-grid">
            {[
              [Droplets, 'Humidity', `${W.humidity}%`],
              [Wind, 'Wind', W.wind],
              [Sun, 'UV Index', `${W.uv} Moderate`],
              [Gauge, 'Pressure', W.pressure],
              [Eye, 'Visibility', W.visibility],
              [Cloud, 'Air Quality', `${W.aqi} Good`],
              [Sunrise, 'Sunrise', W.sunrise],
              [Sunset, 'Sunset', W.sunset],
            ].map(([I, k, v]) => {
              const Ic = I as typeof Sun
              return (
                <div key={k as string} className="sf-wx-tile">
                  <span><Ic size={14} /> {k as string}</span>
                  <b>{v as string}</b>
                </div>
              )
            })}
          </div>
          <article className="sf-article sf-wx-disc">
            <h2>Forecast Discussion</h2>
            <p>Partly cloudy skies hold through the afternoon with a high near {W.high}°. A weak ridge keeps things dry into tomorrow, when highs climb to the mid-70s under mostly sunny skies.</p>
            <p>A cold front arrives <D>{relDay(daysToThu(), { weekday: 'long' })}</D> evening. Thunderstorms are likely between 5 PM and 11 PM, with gusty winds up to 45 mph and brief heavy rain. Outdoor evening events should have an indoor backup plan.</p>
            <p>Cooler air settles in behind the front for the weekend, with highs in the low 60s and a chance of lingering showers <D>{relDay(daysToThu() + 1, { weekday: 'long' })}</D> morning.</p>
          </article>
        </main>
        <aside className="sf-sidebar">
          <h3>Nearby &amp; Saved</h3>
          {W.cities.map((c) => (
            <div key={c.city} className="sf-wx-city">
              <span>{c.city}</span>
              <small>{c.condition}</small>
              <b>{c.temp}°</b>
            </div>
          ))}
          <A to="stormwatch.example/radar" className="sf-wx-radar-link">Open live radar →</A>
        </aside>
      </div>
      <footer className="sf-foot">© WeatherNow · Data for demonstration purposes</footer>
    </div>
  )
}

function daysToThu() {
  const d = (4 - new Date().getDay() + 7) % 7
  return d
}

// =============================== StormWatch Radar ===============================
export function RadarSite() {
  const [frame, setFrame] = useState(6)
  const [playing, setPlaying] = useState(true)
  const [layers, setLayers] = useState({ precip: true, lightning: true, wind: false })
  useEffect(() => {
    if (!playing) return
    const t = window.setInterval(() => setFrame((f) => (f + 1) % 12), 550)
    return () => window.clearInterval(t)
  }, [playing])
  const base = Date.now() - 60 * 60_000
  const label = new Date(base + frame * 10 * 60_000).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  const dx = frame * 9
  const cells = [
    { x: 40, y: 90, r: 46, k: 1 },
    { x: 95, y: 150, r: 34, k: 0.8 },
    { x: 10, y: 200, r: 52, k: 1.2 },
    { x: 150, y: 60, r: 28, k: 0.6 },
  ]
  return (
    <div className="sf-page sf-rd">
      <header className="sf-rd-head sf-nav">
        <div className="sf-rd-logo"><Zap size={18} /> StormWatch <span>LIVE</span></div>
        <A to="weather.example/maple-grove">Forecast</A>
      </header>
      <div className="sf-rd-map sf-media">
        <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Radar map of the Maple Grove area">
          <defs>
            <radialGradient id="rdcell">
              <stop offset="0" stopColor="#ff2d2d" />
              <stop offset=".3" stopColor="#ffb000" />
              <stop offset=".6" stopColor="#2ecc40" stopOpacity=".85" />
              <stop offset="1" stopColor="#2ecc40" stopOpacity="0" />
            </radialGradient>
            <pattern id="rdgrid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M40 0H0V40" fill="none" stroke="#ffffff10" />
            </pattern>
          </defs>
          <rect width="400" height="300" fill="#1d2733" />
          <path d="M0 210 C 80 190, 140 240, 220 200 S 340 150, 400 170 L400 300 L0 300Z" fill="#223242" />
          <rect width="400" height="300" fill="url(#rdgrid)" />
          <path d="M0 140 L400 120 M170 0 L200 300 M0 60 L400 250" stroke="#ffffff22" strokeWidth="2" />
          <path d="M60 300 C 120 240, 260 260, 330 0" stroke="#4aa3ff55" strokeWidth="5" fill="none" />
          {layers.precip && cells.map((c, i) => (
            <ellipse key={i} cx={c.x + dx * c.k + 60} cy={c.y + dx * 0.25} rx={c.r} ry={c.r * 0.72} fill="url(#rdcell)" opacity={0.85} style={{ mixBlendMode: 'screen' }} />
          ))}
          {layers.lightning && [0, 1, 2].map((i) => (
            <text key={i} x={cells[i].x + dx * cells[i].k + 60} y={cells[i].y + dx * 0.25 + 4} fontSize="14" textAnchor="middle" fill="#fff" opacity={(frame + i) % 3 === 0 ? 1 : 0.25}>⚡</text>
          ))}
          {layers.wind && Array.from({ length: 16 }).map((_, i) => (
            <path key={i} d={`M${(i % 4) * 100 + 20 + (frame * 6) % 60} ${Math.floor(i / 4) * 75 + 30} l24 -6`} stroke="#9fd3ff" strokeWidth="2" opacity=".7" />
          ))}
          <circle cx="245" cy="170" r="5" fill="#fff" />
          <circle cx="245" cy="170" r="11" fill="none" stroke="#fff" strokeOpacity=".5" />
          <text x="256" y="167" fontSize="12" fill="#fff" fontWeight="600">Maple Grove</text>
          <text x="80" y="40" fontSize="10" fill="#ffffff88">Westfield</text>
          <text x="310" y="268" fontSize="10" fill="#ffffff88">MGR ✈︎</text>
        </svg>
        <div className="sf-rd-time">{label}{frame === 11 ? ' · Now' : ''}</div>
      </div>
      <div className="sf-rd-controls">
        <button className="sf-rd-play" onClick={() => setPlaying((p) => !p)} aria-label={playing ? 'Pause loop' : 'Play loop'}>
          {playing ? <Pause size={18} /> : <Play size={18} />}
        </button>
        <input type="range" min={0} max={11} value={frame} onChange={(e) => { setPlaying(false); setFrame(+e.target.value) }} aria-label="Radar time" data-no-keyboard="1" />
      </div>
      <div className="sf-rd-layers">
        {(['precip', 'lightning', 'wind'] as const).map((k) => (
          <button key={k} className={layers[k] ? 'on' : ''} onClick={() => setLayers((l) => ({ ...l, [k]: !l[k] }))}>
            {k === 'precip' ? 'Precipitation' : k === 'lightning' ? 'Lightning' : 'Wind'}
          </button>
        ))}
      </div>
      <div className="sf-layout">
        <article className="sf-main sf-article sf-rd-body">
          <h1>Storm Tracker: Thursday evening line</h1>
          <p className="sf-rd-meta">Updated <D>{relDay(0, { weekday: 'long', month: 'long', day: 'numeric' })}</D> · StormWatch Weather Team</p>
          <p>A cluster of storms is organizing west of Westfield and is expected to reach Maple Grove <D>{relDay(daysToThu(), { weekday: 'long' })}</D> between 5 PM and 11 PM. The strongest cells may produce frequent lightning, wind gusts to 45 mph and pea-sized hail.</p>
          <h2>What to expect</h2>
          <ul>
            <li>Heavy rain rates up to 1 inch per hour in the strongest cells.</li>
            <li>Lightning risk begins around 5 PM; move outdoor practices indoors.</li>
            <li>Conditions improve after midnight as the front clears the valley.</li>
          </ul>
          <h2>Timeline</h2>
          <table className="sf-table">
            <tbody>
              <tr><td>4:00 PM</td><td>Storms form near Westfield</td></tr>
              <tr><td>6:30 PM</td><td>Leading edge reaches downtown Maple Grove</td></tr>
              <tr><td>9:00 PM</td><td>Heaviest rain, frequent lightning</td></tr>
              <tr><td>11:30 PM</td><td>Front exits east; clearing skies</td></tr>
            </tbody>
          </table>
        </article>
        <aside className="sf-sidebar sf-rd-side">
          <h3>Active alerts</h3>
          <div className="sf-rd-alert"><AlertTriangle size={14} /> Severe Thunderstorm Watch — Maple County</div>
          <div className="sf-rd-alert y"><AlertTriangle size={14} /> Wind Advisory — Valley Floor</div>
        </aside>
      </div>
      <Ad variant={3} />
      <footer className="sf-foot">StormWatch · Radar imagery simulated</footer>
    </div>
  )
}

// =============================== ChemReview ===============================
const PRACTICE = [
  { q: 'How many moles are in 36.0 g of water (H₂O, M = 18.02 g/mol)?', a: '36.0 g ÷ 18.02 g/mol = 2.00 mol H₂O' },
  { q: 'In 2H₂ + O₂ → 2H₂O, how many moles of O₂ react with 5.0 mol H₂?', a: '5.0 mol H₂ × (1 mol O₂ / 2 mol H₂) = 2.5 mol O₂' },
  { q: '4.0 mol Al reacts with 4.0 mol Cl₂ (2Al + 3Cl₂ → 2AlCl₃). Which is limiting?', a: 'Cl₂: 4.0 mol Cl₂ needs only 2.67 mol Al, so Cl₂ runs out first.' },
  { q: 'A reaction should make 50.0 g of product but makes 42.5 g. What is the percent yield?', a: '42.5 ÷ 50.0 × 100 = 85.0 %' },
]

export function ChemSite() {
  const [open, setOpen] = useState<Record<number, boolean>>({})
  return (
    <div className="sf-page sf-ch">
      <header className="sf-ch-head sf-nav">
        <div className="sf-ch-logo">⚗︎ ChemReview</div>
        <nav>
          <a>Unit 1</a><a>Unit 2</a><a className="on">Unit 3</a><a>Unit 4</a>
        </nav>
      </header>
      <div className="sf-layout">
        <main className="sf-main">
          <div className="sf-ch-crumb">Chemistry › Honors › Unit 3</div>
          <article className="sf-article">
            <h1>Unit 3 Review: Stoichiometry</h1>
            <p className="sf-ch-by">By Ms. Alvarez · Updated <D>{relDay(-2, { month: 'long', day: 'numeric' })}</D> · 8 min read</p>
            <p className="sf-ch-lede">Stoichiometry is the math of chemical reactions. If you can convert between grams, moles and particles — and read the coefficients of a balanced equation — you can solve every problem on the Unit 3 test.</p>
            <h2 id="ch-mole">1. The mole and molar mass</h2>
            <p>A mole is 6.022 × 10²³ particles (Avogadro’s number). The molar mass of a substance, in grams per mole, is the sum of the atomic masses in its formula. Water, H₂O, has a molar mass of 2(1.008) + 16.00 = 18.02 g/mol.</p>
            <figure className="sf-figure sf-media">
              <svg viewBox="0 0 360 120" role="img" aria-label="Mole map: grams to moles to particles">
                <rect x="6" y="36" width="92" height="48" rx="12" fill="#e6f6f1" stroke="#12a37f" />
                <rect x="134" y="36" width="92" height="48" rx="12" fill="#12a37f" />
                <rect x="262" y="36" width="92" height="48" rx="12" fill="#e6f6f1" stroke="#12a37f" />
                <text x="52" y="65" textAnchor="middle" fontSize="15" fill="#0c6b54" fontWeight="700">Grams</text>
                <text x="180" y="65" textAnchor="middle" fontSize="15" fill="#fff" fontWeight="700">Moles</text>
                <text x="308" y="65" textAnchor="middle" fontSize="15" fill="#0c6b54" fontWeight="700">Particles</text>
                <path d="M100 52h30M130 68h-30M228 52h30M258 68h-30" stroke="#0c6b54" strokeWidth="2" />
                <text x="116" y="28" textAnchor="middle" fontSize="10" fill="#555">÷ molar mass</text>
                <text x="116" y="102" textAnchor="middle" fontSize="10" fill="#555">× molar mass</text>
                <text x="244" y="28" textAnchor="middle" fontSize="10" fill="#555">× 6.022×10²³</text>
                <text x="244" y="102" textAnchor="middle" fontSize="10" fill="#555">÷ 6.022×10²³</text>
              </svg>
              <figcaption>Figure 1. The mole map — every conversion goes through moles.</figcaption>
            </figure>
            <h2 id="ch-ratio">2. Mole ratios</h2>
            <p>The coefficients of a balanced equation tell you the ratio in which substances react. In 2H₂ + O₂ → 2H₂O, two moles of hydrogen react with one mole of oxygen to make two moles of water. Always balance the equation first.</p>
            <div className="sf-ch-formula">mol B = mol A × (coefficient B ÷ coefficient A)</div>
            <Ad kind="strip" variant={2} />
            <h2 id="ch-limit">3. Limiting reagents</h2>
            <p>The limiting reagent is the reactant that runs out first; it determines how much product forms. Convert each reactant to moles of product — the smaller answer wins. The other reactant is in excess.</p>
            <div className="sf-ch-example">
              <b>Worked example</b>
              <p>10.0 g H₂ reacts with 64.0 g O₂. H₂: 10.0 ÷ 2.016 = 4.96 mol → 4.96 mol H₂O. O₂: 64.0 ÷ 32.00 = 2.00 mol → 4.00 mol H₂O. Oxygen is limiting; 4.00 mol (72.1 g) of water forms.</p>
            </div>
            <h2 id="ch-yield">4. Percent yield</h2>
            <p>Real reactions rarely make the theoretical amount. Percent yield compares what you actually collected to what the math predicts.</p>
            <div className="sf-ch-formula">% yield = actual ÷ theoretical × 100</div>
            <h2 id="ch-practice">Practice problems</h2>
            <ol className="sf-ch-practice">
              {PRACTICE.map((p, i) => (
                <li key={i}>
                  <p>{p.q}</p>
                  <button onClick={() => setOpen((o) => ({ ...o, [i]: !o[i] }))}>{open[i] ? 'Hide answer' : 'Show answer'}</button>
                  {open[i] && <div className="sf-ch-ans">{p.a}</div>}
                </li>
              ))}
            </ol>
            <p>Unit 3 test: <D>{relDay((5 - new Date().getDay() + 7) % 7, { weekday: 'long', month: 'short', day: 'numeric' })}</D>, all sections. Bring a scientific calculator and your periodic table.</p>
          </article>
        </main>
        <aside className="sf-sidebar sf-ch-toc">
          <h3>On this page</h3>
          <Jump id="ch-mole">The mole</Jump>
          <Jump id="ch-ratio">Mole ratios</Jump>
          <Jump id="ch-limit">Limiting reagents</Jump>
          <Jump id="ch-yield">Percent yield</Jump>
          <Jump id="ch-practice">Practice</Jump>
          <h3>Study tools</h3>
          <A to="lincoln.example/calendar">Test calendar</A>
          <Ad kind="box" variant={1} />
        </aside>
      </div>
      <footer className="sf-foot">ChemReview — free study guides for high school chemistry</footer>
    </div>
  )
}

// =============================== Lincoln High calendar ===============================
type Cat = 'Academics' | 'Arts' | 'Athletics' | 'Clubs'
function schoolEvents() {
  const wd = (w: number) => (w - new Date().getDay() + 7) % 7
  return [
    { id: 'lx1', title: 'Early release — 1:15 PM dismissal', day: wd(3), h: 13, m: 15, cat: 'Academics' as Cat, where: 'All campus' },
    { id: 'lx2', title: 'Club Fair', day: wd(4), h: 12, m: 10, cat: 'Clubs' as Cat, where: 'Main Quad' },
    { id: 'lx3', title: 'Chemistry Unit 3 Test', day: wd(5), h: 10, m: 0, cat: 'Academics' as Cat, where: 'Room 208' },
    { id: 'lx4', title: 'Homecoming Game vs. Westfield', day: wd(5) + 7, h: 19, m: 0, cat: 'Athletics' as Cat, where: 'Lions Stadium' },
    { id: 'lx5', title: 'Homecoming Dance', day: wd(6) + 7, h: 19, m: 30, cat: 'Clubs' as Cat, where: 'Gym' },
    { id: 'lx6', title: 'Fall Concert', day: 16, h: 19, m: 0, cat: 'Arts' as Cat, where: 'Lincoln High Auditorium' },
    { id: 'lx7', title: 'Picture retakes', day: wd(2) + 7, h: 8, m: 0, cat: 'Academics' as Cat, where: 'Library' },
    { id: 'lx8', title: 'Robotics Regional Qualifier', day: 35, h: 8, m: 0, cat: 'Clubs' as Cat, where: 'State Fair Expo Hall' },
    { id: 'lx9', title: 'Parent-teacher conferences', day: 20, h: 16, m: 0, cat: 'Academics' as Cat, where: 'Classrooms' },
  ].sort((a, b) => a.day - b.day || a.h - b.h)
}

export function LincolnSite() {
  const [cat, setCat] = useState<'All' | Cat>('All')
  const [sel, setSel] = useState<number | null>(null)
  const [month, setMonth] = useState(0)
  const events = useMemo(schoolEvents, [])
  const calEvents = useOS((s) => s.events)
  const today = new Date()
  const m0 = new Date(today.getFullYear(), today.getMonth() + month, 1)
  const days = new Date(m0.getFullYear(), m0.getMonth() + 1, 0).getDate()
  const lead = m0.getDay()
  const offsetOf = (d: number) => Math.round((new Date(m0.getFullYear(), m0.getMonth(), d).getTime() - startOfDay()) / DAY)
  const eventDays = new Set(events.map((e) => e.day))
  const list = events.filter((e) => (cat === 'All' || e.cat === cat) && (sel === null || e.day === sel))
  const added = (e: (typeof events)[number]) => calEvents.some((c) => c.title === e.title && Math.abs(c.start - at(e.day, e.h, e.m)) < 60_000)
  const add = (e: (typeof events)[number]) => {
    const st = useOS.getState()
    st.addEvent({ title: e.title, start: at(e.day, e.h, e.m), end: at(e.day, e.h + 1, e.m), calendar: 'school', location: e.where, source: 'lincoln.example' })
    st.showToast('Added to Calendar', 'calendar')
  }
  return (
    <div className="sf-page sf-ln">
      <header className="sf-ln-head sf-nav">
        <div className="sf-ln-crest">L</div>
        <div>
          <b>Lincoln High School</b>
          <small>Home of the Lions</small>
        </div>
        <Menu size={20} style={{ marginLeft: 'auto' }} />
      </header>
      <div className="sf-ln-banner">Events Calendar</div>
      <div className="sf-layout">
        <main className="sf-main">
          <div className="sf-ln-cal">
            <div className="sf-ln-calhead">
              <button onClick={() => { setMonth((x) => x - 1); setSel(null) }} aria-label="Previous month"><ChevronLeft size={18} /></button>
              <b>{m0.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</b>
              <button onClick={() => { setMonth((x) => x + 1); setSel(null) }} aria-label="Next month"><ChevronRight size={18} /></button>
            </div>
            <div className="sf-ln-grid">
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => <span key={i} className="sf-ln-wd">{d}</span>)}
              {Array.from({ length: lead }).map((_, i) => <span key={`x${i}`} />)}
              {Array.from({ length: days }).map((_, i) => {
                const off = offsetOf(i + 1)
                return (
                  <button key={i} className={`${off === 0 ? 'today' : ''} ${sel === off ? 'sel' : ''}`} onClick={() => setSel(sel === off ? null : off)}>
                    {i + 1}
                    {eventDays.has(off) && <i />}
                  </button>
                )
              })}
            </div>
          </div>
          <div className="sf-ln-chips">
            {(['All', 'Academics', 'Arts', 'Athletics', 'Clubs'] as const).map((c) => (
              <button key={c} className={cat === c ? 'on' : ''} onClick={() => setCat(c)}>{c}</button>
            ))}
          </div>
          <div className="sf-article sf-ln-list">
            {list.length === 0 && <p className="sf-ln-empty">No events{sel !== null ? ' on this day' : ''}. <button onClick={() => { setSel(null); setCat('All') }}>Show all</button></p>}
            {list.map((e) => (
              <div key={e.id} className="sf-ln-ev">
                <div className="sf-ln-date">
                  <small>{relDay(e.day, { month: 'short' })}</small>
                  <b>{relDay(e.day, { day: 'numeric' })}</b>
                </div>
                <div className="sf-ln-evbody">
                  <b>{e.title}</b>
                  <p><D>{relDay(e.day, { weekday: 'long', month: 'long', day: 'numeric' })}</D> · {new Date(at(e.day, e.h, e.m)).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} · {e.where}</p>
                  <span className={`sf-ln-cat c-${e.cat}`}>{e.cat}</span>
                </div>
                <button className={`sf-ln-add ${added(e) ? 'done' : ''}`} onClick={() => !added(e) && add(e)} aria-label={added(e) ? 'Added to Calendar' : `Add ${e.title} to Calendar`}>
                  {added(e) ? <Check size={16} /> : <CalendarPlus size={16} />}
                </button>
              </div>
            ))}
          </div>
        </main>
        <aside className="sf-sidebar sf-ln-side">
          <h3>Quick links</h3>
          <A to="chemreview.example/unit-3">Chem Unit 3 review</A>
          <a>Bell schedule</a>
          <a>Student portal</a>
          <h3>Announcements</h3>
          <p>Homecoming tickets are on sale in the student store through <D>{relDay((5 - new Date().getDay() + 7) % 7 + 7, { weekday: 'long', month: 'short', day: 'numeric' })}</D>.</p>
        </aside>
      </div>
      <footer className="sf-foot">Lincoln High School · 1200 Lincoln Ave, Maple Grove</footer>
    </div>
  )
}

// =============================== Search engine ===============================
const SITE_WORDS: Record<string, string> = {
  'weather.example/maple-grove': 'weather forecast rain temperature maple grove 10 day hourly',
  'stormwatch.example/radar': 'radar storm thunderstorm lightning weather live tracker',
  'chemreview.example/unit-3': 'chemistry chem stoichiometry mole moles test unit 3 review study limiting reagent yield',
  'lincoln.example/calendar': 'school events calendar homecoming concert lincoln high club fair',
  'bolt.example/headphones-x2': 'headphones aurora x2 noise cancelling bolt audio price wireless',
  'bolt.example/sbc-kit': 'single board computer kit raspberry electronics bolt sbc starter',
  'robotics-forum.example/swerve': 'swerve robotics frc module pid tuning drivetrain forum robot',
  'partsdepot.example/motors': 'motor motors brushless robotics parts controller encoder store',
  'morningbrief.example/today': 'news today headlines morning brief',
  'tunedaily.example/luma-coast': 'music tour concert luma coast band album tickets',
  'gamezone.example': 'games game play free arcade online fun',
  'videotube.example': 'videos video watch tube stream clips',
}
const SNIPPET: Record<string, string> = {
  'weather.example/maple-grove': 'Partly cloudy, 68°. Thunderstorms likely Thursday evening. Hourly and 10-day forecast for Maple Grove.',
  'stormwatch.example/radar': 'Live radar loop, lightning tracker and storm timeline for the Maple County area.',
  'chemreview.example/unit-3': 'Mole ratios, limiting reagents and percent yield explained, with worked examples and practice problems.',
  'lincoln.example/calendar': 'Upcoming events at Lincoln High: club fair, homecoming, Fall Concert, early release days and more.',
  'bolt.example/headphones-x2': 'Aurora X2 wireless noise-cancelling headphones. 40-hour battery, adaptive ANC. Free delivery.',
  'bolt.example/sbc-kit': 'Everything you need to start building: board, case, power supply, 32 GB card and sensor pack.',
  'robotics-forum.example/swerve': 'Step-by-step guide to tuning steering PID and drive feedforward for swerve modules.',
  'partsdepot.example/motors': 'Shop brushless motors, motor controllers and encoders for robotics teams.',
  'morningbrief.example/today': 'Today’s top stories: storm watch, a record robotics season, the fall art walk.',
  'tunedaily.example/luma-coast': 'Luma Coast will tour 18 cities this fall behind Salt & Static, including a Maple Grove stop.',
  'gamezone.example': 'Play hundreds of free online games — puzzles, racing, arcade classics.',
  'videotube.example': 'Watch and share videos: music, gaming, science, and more.',
}

export function searchSites(q: string): string[] {
  const words = q.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 1)
  if (!words.length) return []
  const scored = Object.entries(SAFARI_SITES).map(([url, s]) => {
    const hay = `${s.title} ${s.topic} ${url} ${SITE_WORDS[url] ?? ''}`.toLowerCase()
    const score = words.reduce((a, w) => a + (hay.includes(w) ? (s.title.toLowerCase().includes(w) ? 3 : 1) : 0), 0)
    return { url, score }
  })
  return scored.filter((x) => x.score > 0).sort((a, b) => b.score - a.score).map((x) => x.url)
}

export function SearchSite({ q }: { q: string }) {
  const { go } = useWeb()
  const [tab, setTab] = useState<'All' | 'News' | 'Shopping' | 'Videos'>('All')
  const [val, setVal] = useState(q)
  useEffect(() => setVal(q), [q])
  const hits = searchSites(q)
  const all = hits.length ? hits : Object.keys(SAFARI_SITES).filter((u) => SAFARI_SITES[u].kind !== 'blocked')
  const filtered = all.filter((u) => {
    const k = SAFARI_SITES[u]
    if (tab === 'News') return k.kind === 'news' || k.kind === 'article'
    if (tab === 'Shopping') return k.kind === 'product'
    if (tab === 'Videos') return u.startsWith('videotube') || u.startsWith('stormwatch')
    return true
  })
  const top = hits[0]
  return (
    <div className="sf-page sf-sr">
      <form className="sf-sr-head" onSubmit={(e) => { e.preventDefault(); if (val.trim()) go(searchUrl(val)) }}>
        <div className="sf-sr-logo"><span>S</span>earch</div>
        <label className="sf-sr-box">
          <SearchIcon size={16} />
          <input value={val} onChange={(e) => setVal(e.target.value)} aria-label="Search the web" enterKeyHint="search" />
        </label>
      </form>
      <div className="sf-sr-tabs sf-nav">
        {(['All', 'News', 'Shopping', 'Videos'] as const).map((t) => (
          <button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>
      <main className="sf-main sf-sr-body">
        {!hits.length && <p className="sf-sr-none">No exact matches for <b>{q}</b>. Here are popular pages instead.</p>}
        {hits.length > 0 && <p className="sf-sr-count">About {(hits.length * 1_380_000).toLocaleString()} results (0.{hits.length + 21} seconds)</p>}
        {top && tab === 'All' && (
          <div className="sf-sr-top">
            <small>Top result</small>
            <Result url={top} big />
          </div>
        )}
        {filtered.filter((u) => !(tab === 'All' && u === top)).map((u) => <Result key={u} url={u} />)}
        {filtered.length === 0 && <p className="sf-sr-none">No {tab.toLowerCase()} results.</p>}
        <div className="sf-sr-related">
          <b>Related searches</b>
          <div>
            {['robotics swerve tuning', 'maple grove radar', 'stoichiometry practice', 'aurora x2 price', 'free games', 'luma coast tour'].map((r) => (
              <A key={r} to={searchUrl(r)}>{r}</A>
            ))}
          </div>
        </div>
      </main>
      <footer className="sf-foot">Search · Private by design. Your searches aren’t tied to you.</footer>
    </div>
  )
}

function Result({ url, big }: { url: string; big?: boolean }) {
  const s = SAFARI_SITES[url]
  const b = BRAND[url.split('/')[0]] ?? { color: '#888', letter: '?', name: url }
  return (
    <div className={`sf-sr-res ${big ? 'big' : ''}`}>
      <div className="sf-sr-src">
        <span className="sf-sr-fav" style={{ background: b.color, color: b.fg ?? '#fff' }}>{b.letter}</span>
        <div>
          <b>{b.name}</b>
          <small>https://{url}</small>
        </div>
      </div>
      <A to={url} className="sf-sr-title">{s.title}</A>
      <p>{SNIPPET[url]}</p>
      {s.kind === 'product' && url.includes('headphones') && <p className="sf-sr-rich">★★★★★ 4.6 (1,284) · <span className="sf-price">$249.00</span> · In stock</p>}
    </div>
  )
}

export { SEARCH_HOST }
