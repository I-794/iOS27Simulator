/* Rendered page mockups for the demo documents (PDF, Pages, Numbers, images, CAD).
 * Shared by Preview, Files and Mail attachments. */
import type { ReactNode } from 'react'
import { FILES } from '../../os/data/world'
import { Scene } from '../../art/Scene'
import './docs.css'

export type DemoFile = (typeof FILES)[number]

export const fileById = (id: string) => FILES.find((f) => f.id === id)
export const fileByName = (name: string) => FILES.find((f) => f.name.toLowerCase() === name.toLowerCase())

const d = (off: number, o: Intl.DateTimeFormatOptions = { month: 'long', day: 'numeric', year: 'numeric' }) => {
  const x = new Date()
  x.setDate(x.getDate() + off)
  return x.toLocaleDateString('en-US', o)
}

function Page({ children, className = '', n, total }: { children: ReactNode; className?: string; n?: number; total?: number }) {
  return (
    <div className={`pvd-page ${className}`}>
      <div className="pvd-inner">{children}</div>
      {n !== undefined && total !== undefined && total > 1 && <div className="pvd-folio">{n} / {total}</div>}
    </div>
  )
}

function lines(n: number, w = [100, 96, 92, 98, 70]) {
  return Array.from({ length: n }).map((_, i) => <div key={i} className="pvd-line" style={{ width: `${w[i % w.length]}%` }} />)
}

// ------------------------------------------------------------------ documents
function RulesDoc(): ReactNode[] {
  return [
    <>
      <div className="pvd-kicker">Robotics League · 2026 Season</div>
      <h1>Regional Qualifier Rules</h1>
      <p className="pvd-muted">Game Manual excerpt · Revision C · {d(-10)}</p>
      <h2>1. Event overview</h2>
      <p>The Regional Qualifier is held at the State Fair Expo Hall on {d(35, { month: 'long', day: 'numeric' })}. Teams play 10 qualification matches followed by alliance selection and a best-of-three elimination bracket.</p>
      <h2>2. Robot constraints</h2>
      <table className="pvd-table">
        <tbody>
          <tr><td>Max starting size</td><td>30 in × 30 in × 48 in</td></tr>
          <tr><td>Max weight</td><td>125 lb (excl. bumpers, battery)</td></tr>
          <tr><td>Motors</td><td>Up to 14 brushless</td></tr>
          <tr><td>Battery</td><td>12 V sealed lead-acid only</td></tr>
        </tbody>
      </table>
      <h2>3. Match scoring</h2>
      <p>Autonomous period lasts 15 seconds, followed by a 2 minute 15 second teleoperated period.</p>
      {lines(4)}
    </>,
    <>
      <h2>3.1 Scoring table</h2>
      <table className="pvd-table head">
        <thead><tr><th>Action</th><th>Auto</th><th>Teleop</th></tr></thead>
        <tbody>
          <tr><td>Leave starting zone</td><td>3</td><td>—</td></tr>
          <tr><td>Game piece, low goal</td><td>3</td><td>2</td></tr>
          <tr><td>Game piece, high goal</td><td>6</td><td>4</td></tr>
          <tr><td>Park in endgame zone</td><td>—</td><td>2</td></tr>
          <tr><td>Hang (climb)</td><td>—</td><td>12</td></tr>
        </tbody>
      </table>
      <h2>4. Inspection</h2>
      <p>All robots must pass inspection before their first qualification match. Bumpers must display the team number in white or black numerals at least 4 in tall.</p>
      {lines(6)}
    </>,
    <>
      <h2>5. Conduct</h2>
      <p>Gracious professionalism is expected at all times. Yellow and red cards may be issued for unsafe robot operation or egregious behavior.</p>
      {lines(8)}
      <div className="pvd-sig">Head Referee · Robotics League</div>
    </>,
  ]
}

function WorksheetDoc(): ReactNode[] {
  return [
    <>
      <div className="pvd-row"><b>Honors Chemistry — Unit 3</b><span>Name: <u>Jamie Park</u></span></div>
      <h1>Worksheet 3.2 · Stoichiometry</h1>
      <p className="pvd-muted">Show all work. Include units and significant figures.</p>
      {[
        'How many moles of NaCl are in 117 g of NaCl? (M = 58.44 g/mol)',
        'Balance: __ Fe + __ O₂ → __ Fe₂O₃',
        'For 2H₂ + O₂ → 2H₂O, how many grams of water form from 8.0 g H₂?',
        'Which is the limiting reagent when 3.0 mol N₂ reacts with 6.0 mol H₂ (N₂ + 3H₂ → 2NH₃)?',
        'A student expects 25.0 g of product but recovers 21.3 g. Find the percent yield.',
      ].map((q, i) => (
        <div key={i} className="pvd-q">
          <b>{i + 1}.</b> {q}
          <div className="pvd-answer">{i === 0 ? <span className="pvd-hand">2.00 mol</span> : i === 2 ? <span className="pvd-hand">72 g H₂O</span> : null}</div>
        </div>
      ))}
    </>,
    <>
      <h2>Challenge</h2>
      <div className="pvd-q"><b>6.</b> Aluminum reacts with chlorine gas: 2Al + 3Cl₂ → 2AlCl₃. If 5.4 g Al reacts with 14.2 g Cl₂, how many grams of AlCl₃ form? Identify the excess reagent.<div className="pvd-answer tall" /></div>
      <div className="pvd-q"><b>7.</b> Explain in one sentence why percent yield is almost never 100%.<div className="pvd-answer" /></div>
      <p className="pvd-muted">Due {d((5 - new Date().getDay() + 7) % 7, { weekday: 'long', month: 'short', day: 'numeric' })} · Mrs. Alvarez · Room 208</p>
    </>,
  ]
}

function ProgramDoc(): ReactNode[] {
  return [
    <div className="pvd-cover concert">
      <div className="pvd-cover-top">Lincoln High School Music Department presents</div>
      <div className="pvd-cover-title">Fall Concert</div>
      <div className="pvd-cover-sub">{d(16, { weekday: 'long', month: 'long', day: 'numeric' })} · 7:00 PM</div>
      <div className="pvd-cover-sub">Lincoln High Auditorium</div>
      <svg viewBox="0 0 200 60" className="pvd-cover-art" aria-hidden><path d="M10 40 Q 50 0 100 30 T 190 20" stroke="#ffd166" strokeWidth="3" fill="none" /><circle cx="60" cy="42" r="6" fill="#ffd166" /><circle cx="140" cy="36" r="6" fill="#ffd166" /></svg>
    </div>,
    <>
      <h1>Program</h1>
      <table className="pvd-table">
        <tbody>
          <tr><td><b>Concert Band</b></td><td /></tr>
          <tr><td>Autumn Overture</td><td>R. Hale</td></tr>
          <tr><td>Riverside Suite, mvt. II</td><td>J. Moreno</td></tr>
          <tr><td><b>Percussion Ensemble</b></td><td /></tr>
          <tr><td>Cadence 3</td><td>arr. R. Thompson</td></tr>
          <tr><td>Rolling Thunder</td><td>L. Martins</td></tr>
          <tr><td><b>Symphonic Winds</b></td><td /></tr>
          <tr><td>Luminous Coast</td><td>M. Lin, arr. Thompson</td></tr>
          <tr><td>Finale: Lions March</td><td>Traditional</td></tr>
        </tbody>
      </table>
      <h2>Percussion</h2>
      <p>Sam Okafor · Jamie Park · Priya Shah · Leo Martins</p>
      <p className="pvd-muted">Call time 6:00 PM · Black concert attire · Director: Rachel Thompson</p>
    </>,
  ]
}

function ItineraryDoc(): ReactNode[] {
  return [
    <>
      <div className="pvd-air-head"><b>✈︎ Skyward Airlines</b><span>Itinerary / Receipt</span></div>
      <div className="pvd-row"><span>Confirmation</span><b className="pvd-big">7XKQ2P</b></div>
      <div className="pvd-air-flight">
        <div><small>MGR</small><b>8:45 AM</b><span>Maple Grove</span></div>
        <div className="pvd-air-mid">SK 482<br />2h 20m<br />Nonstop</div>
        <div><small>SEA</small><b>11:05 AM</b><span>Seattle</span></div>
      </div>
      <p className="pvd-muted">Friday, November 21 · Economy · Boeing 737</p>
      <table className="pvd-table head">
        <thead><tr><th>Passenger</th><th>Seat</th><th>Bags</th></tr></thead>
        <tbody>
          <tr><td>Michael Park</td><td>14A</td><td>1</td></tr>
          <tr><td>Dana Park</td><td>14B</td><td>1</td></tr>
          <tr><td>Jamie Park</td><td>14C</td><td>1</td></tr>
          <tr><td>Mia Park</td><td>14D</td><td>1</td></tr>
        </tbody>
      </table>
      <div className="pvd-row total"><span>Total paid</span><b>$1,146.40</b></div>
      <p className="pvd-muted">Check in opens 24 hours before departure. Boarding closes 15 minutes before departure.</p>
      <div className="pvd-barcode" aria-hidden>{Array.from({ length: 48 }).map((_, i) => <i key={i} style={{ width: (i * 7) % 3 + 1 }} />)}</div>
    </>,
  ]
}

function SheetMusicDoc(): ReactNode[] {
  const staff = (y: number, seed: number) => (
    <g key={y}>
      {[0, 1, 2, 3, 4].map((l) => <line key={l} x1="10" x2="390" y1={y + l * 6} y2={y + l * 6} stroke="#222" strokeWidth="0.6" />)}
      {Array.from({ length: 16 }).map((_, i) => {
        const x = 40 + i * 22
        const ny = y + ((i * seed) % 5) * 3 + 3
        return (
          <g key={i}>
            <ellipse cx={x} cy={ny} rx="3.2" ry="2.4" fill="#111" transform={`rotate(-20 ${x} ${ny})`} />
            <line x1={x + 3} x2={x + 3} y1={ny} y2={ny - 16} stroke="#111" strokeWidth="0.8" />
            {i % 4 === 3 && <line x1={x + 20} x2={x + 20} y1={y} y2={y + 24} stroke="#222" strokeWidth="0.8" />}
          </g>
        )
      })}
      <text x="12" y={y + 18} fontSize="16" fontFamily="serif">𝄥</text>
    </g>
  )
  return [
    <>
      <h1 style={{ textAlign: 'center' }}>Cadence 3</h1>
      <p className="pvd-muted" style={{ textAlign: 'center' }}>Snare · Tenors · Bass — ♩ = 120 · arr. R. Thompson</p>
      <svg viewBox="0 0 400 420" className="pvd-staff" role="img" aria-label="Sheet music">
        {[20, 80, 140, 200, 260, 320, 380].map((y, i) => staff(y, i + 2))}
      </svg>
    </>,
  ]
}

function PermissionDoc(): ReactNode[] {
  return [
    <div className="pvd-scan">
      <h1>Field Trip Permission Slip</h1>
      <p>Student name: <span className="pvd-hand">Jamie Park</span> &nbsp; Grade: <span className="pvd-hand">11</span></p>
      <p>Destination: <b>State Science Museum — Engineering Hall</b></p>
      <p>Date: {d(12, { month: 'long', day: 'numeric' })} · Departs 8:15 AM, returns 3:00 PM</p>
      <p>I give permission for my child to attend this field trip and to be transported by school bus.</p>
      {lines(3)}
      <div className="pvd-row" style={{ marginTop: '6%' }}>
        <span>Parent/guardian signature</span>
        <svg viewBox="0 0 120 30" className="pvd-signature" aria-hidden><path d="M4 22 C 14 4, 22 30, 32 14 S 48 6, 56 20 S 76 28, 86 10 S 104 18, 116 12" stroke="#1a3a8a" strokeWidth="1.6" fill="none" /></svg>
      </div>
      <p>Emergency contact: <span className="pvd-hand">Dana Park (555) 010-2231</span></p>
    </div>,
  ]
}

function LabReportDoc(): ReactNode[] {
  return [
    <>
      <h1>Percent Yield of Copper(II) Carbonate</h1>
      <p className="pvd-muted">Lab Report — DRAFT · Jamie Park, Priya Shah · Honors Chemistry</p>
      <h2>Purpose</h2>
      <p>To determine the percent yield of copper(II) carbonate produced from the reaction of copper(II) sulfate and sodium carbonate.</p>
      <h2>Procedure</h2>
      <p>1. Measure 2.50 g CuSO₄·5H₂O and dissolve in 50 mL water. 2. Add 1.20 g Na₂CO₃ solution while stirring. 3. Filter, dry and weigh the precipitate.</p>
      <h2>Data</h2>
      <table className="pvd-table head">
        <thead><tr><th>Measurement</th><th>Value</th></tr></thead>
        <tbody>
          <tr><td>Mass of filter paper</td><td>0.92 g</td></tr>
          <tr><td>Filter paper + product</td><td>2.03 g</td></tr>
          <tr><td>Actual yield</td><td>1.11 g</td></tr>
          <tr><td>Theoretical yield</td><td>1.24 g</td></tr>
        </tbody>
      </table>
      <p className="pvd-comment">Priya: can you double-check the theoretical yield calc? 🧪</p>
    </>,
    <>
      <h2>Analysis</h2>
      <p>Percent yield = 1.11 ÷ 1.24 × 100 = 89.5%. Some product likely passed through the filter paper, and the precipitate may not have been completely dry.</p>
      {lines(7)}
      <h2>Conclusion</h2>
      {lines(4)}
    </>,
  ]
}

function BudgetDoc(): ReactNode[] {
  const rows = [
    ['Drivetrain (swerve modules)', 'Mechanical', '4', '$460', '$1,840'],
    ['Brushless motors', 'Electrical', '12', '$42', '$504'],
    ['Motor controllers', 'Electrical', '12', '$74', '$888'],
    ['Aluminum stock', 'Mechanical', '—', '—', '$320'],
    ['Registration fee', 'Events', '1', '$5,000', '$5,000'],
    ['Team shirts', 'Outreach', '24', '$14', '$336'],
    ['Single-board computer kit', 'Software', '2', '$90', '$180'],
  ]
  return [
    <div className="pvd-sheet">
      <div className="pvd-sheet-title">Robot Budget 2026 <span>Sheet 1</span></div>
      <table>
        <thead><tr><th /><th>A · Item</th><th>B · Category</th><th>C · Qty</th><th>D · Unit</th><th>E · Total</th></tr></thead>
        <tbody>
          {rows.map((r, i) => <tr key={i}><td className="rn">{i + 2}</td>{r.map((c, j) => <td key={j} className={j >= 2 ? 'num' : ''}>{c}</td>)}</tr>)}
          <tr className="sum"><td className="rn">9</td><td>Total</td><td /><td /><td /><td className="num">$9,068</td></tr>
          <tr><td className="rn">10</td><td>Sponsorships</td><td /><td /><td /><td className="num pos">$7,500</td></tr>
          <tr><td className="rn">11</td><td>Fundraising goal</td><td /><td /><td /><td className="num neg">$1,568</td></tr>
        </tbody>
      </table>
      <div className="pvd-chart" aria-hidden>
        {[1840, 504, 888, 320, 5000, 336, 180].map((v, i) => <i key={i} style={{ height: `${(v / 5000) * 100}%` }} />)}
      </div>
    </div>,
  ]
}

function CadDoc(): ReactNode[] {
  return [
    <div className="pvd-cad">
      <svg viewBox="0 0 300 220" role="img" aria-label="3D model of the intake">
        <defs><linearGradient id="cadg" x1="0" x2="1"><stop offset="0" stopColor="#8fb3ff" /><stop offset="1" stopColor="#4a6fd1" /></linearGradient></defs>
        <polygon points="60,120 180,70 250,110 130,160" fill="url(#cadg)" opacity=".85" stroke="#1d3a8a" />
        <polygon points="60,120 130,160 130,190 60,150" fill="#3957b8" stroke="#1d3a8a" />
        <polygon points="130,160 250,110 250,140 130,190" fill="#2d4796" stroke="#1d3a8a" />
        {[0, 1, 2, 3].map((i) => <ellipse key={i} cx={95 + i * 30} cy={122 - i * 12} rx="10" ry="18" fill="#ffb020" stroke="#8a5a00" transform={`rotate(-60 ${95 + i * 30} ${122 - i * 12})`} />)}
        <text x="10" y="20" fontSize="10" fill="#9ab">Intake CAD v7 · roller spacing 2.5 in</text>
      </svg>
      <div className="pvd-cad-bar"><span>Orbit</span><span>Section</span><span>Measure</span></div>
    </div>,
  ]
}

function ImageDoc({ scene }: { scene: string }): ReactNode[] {
  return [<div className="pvd-image"><Scene scene={scene} /></div>]
}

export function pagesFor(file: DemoFile): ReactNode[] {
  switch (file.id) {
    case 'f1': return CadDoc()
    case 'f2': return RulesDoc()
    case 'f3': return LabReportDoc()
    case 'f4': return WorksheetDoc()
    case 'f5': return ProgramDoc()
    case 'f6': return ItineraryDoc()
    case 'f7': return SheetMusicDoc()
    case 'f8': return BudgetDoc()
    case 'f9': return ImageDoc({ scene: 'robot-arena' })
    case 'f10': return PermissionDoc()
    default: return [<>{lines(12)}</>]
  }
}

/** Renders every page of a document as paper sheets. `raw` pages (image/cad/sheet) render without paper chrome. */
export function DocPages({ file, pageClass = '', renderOverlay }: { file: DemoFile; pageClass?: string; renderOverlay?: (i: number) => ReactNode }) {
  const pages = pagesFor(file)
  const raw = file.kind === 'image' || file.kind === 'cad' || file.kind === 'sheet'
  return (
    <div className={`pvd-stack ${raw ? 'raw' : ''}`}>
      {pages.map((p, i) => (
        <div key={i} className={`pvd-wrap ${pageClass}`}>
          <Page n={i + 1} total={pages.length} className={raw ? `raw ${file.kind}` : file.id === 'f10' ? 'scan' : ''}>{p}</Page>
          {renderOverlay?.(i)}
        </div>
      ))}
    </div>
  )
}

/** Small first-page thumbnail. */
export function DocThumb({ file, className = '' }: { file: DemoFile; className?: string }) {
  const first = pagesFor(file)[0]
  const raw = file.kind === 'image' || file.kind === 'cad' || file.kind === 'sheet'
  return (
    <div className={`pvd-thumb ${className} ${raw ? 'raw' : ''}`} aria-hidden>
      <Page className={raw ? `raw ${file.kind}` : file.id === 'f10' ? 'scan' : ''}>{first}</Page>
    </div>
  )
}

export function pageCount(file: DemoFile) {
  return pagesFor(file).length
}
