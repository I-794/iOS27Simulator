/* Original SVG artwork for the simulated system apps. Drawn on a 100×100 grid.
 * Glyph colours use CSS variables so Dark / Clear / Tinted icon styles can recolour them:
 *   --g1 primary glyph, --g2 secondary glyph, --g3 tertiary.
 */
import type { AppId } from '../os/types'
import { memo, type ReactNode } from 'react'

export interface IconSpec {
  name: string
  bg: [string, string]
  /** glyph colours in the default (light) icon style */
  g: [string, string?, string?]
  /** glyph colours in the dark icon style */
  gd?: [string, string?, string?]
  /** background is white-ish (so dark style needs a dark bg but glyph keeps colour) */
  light?: boolean
  art: (now: Date) => ReactNode
}

const F = (v: string) => `var(${v})`

export const ICONS: Record<AppId, IconSpec> = {
  phone: {
    name: 'Phone', bg: ['#6ee677', '#22c142'], g: ['#fff'], gd: ['#3ddc57'],
    art: () => <path fill={F('--g1')} d="M36.2 23.5c-1.9-2.6-5.4-3.2-8-1.3l-4.5 3.3c-3.6 2.7-5 7.4-3.4 11.6 6.8 17.6 20.9 31.8 38.6 38.6 4.2 1.6 8.9.2 11.6-3.4l3.3-4.5c1.9-2.6 1.3-6.1-1.3-8l-8.4-6.1c-2.3-1.7-5.5-1.5-7.6.5l-3.2 3.1c-7.3-3.6-13.2-9.5-16.8-16.8l3.1-3.2c2-2.1 2.2-5.3.5-7.6z" />,
  },
  messages: {
    name: 'Messages', bg: ['#6ee677', '#23c143'], g: ['#fff'], gd: ['#3ddc57'],
    art: () => <path fill={F('--g1')} d="M50 21c-18.8 0-34 12.3-34 27.5 0 8.8 5.1 16.6 13 21.6-.6 4.4-3 8.3-6.3 10.9 6.4.4 12.6-1.6 17.3-5.4 3.2.8 6.6 1.3 10 1.3 18.8 0 34-12.3 34-27.5S68.8 21 50 21z" />,
  },
  safari: {
    name: 'Safari', bg: ['#e9f4ff', '#cfe3fb'], g: ['#1f8fff', '#ff3b30', '#fff'], gd: ['#3aa0ff', '#ff453a', '#e5e5ea'], light: true,
    art: () => (
      <g>
        <defs>
          <linearGradient id="saf-b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#1ec0ff" /><stop offset="1" stopColor="#0a60ff" /></linearGradient>
        </defs>
        <circle cx="50" cy="50" r="38" fill="url(#saf-b)" />
        {Array.from({ length: 48 }).map((_, i) => {
          const a = (i / 48) * Math.PI * 2
          const r1 = i % 4 === 0 ? 30 : 33
          return <line key={i} x1={50 + Math.cos(a) * r1} y1={50 + Math.sin(a) * r1} x2={50 + Math.cos(a) * 35.5} y2={50 + Math.sin(a) * 35.5} stroke="#fff" strokeWidth={i % 4 === 0 ? 1.4 : 0.8} opacity={0.9} />
        })}
        <path d="M50 50 L70 30 L54 54 Z" fill={F('--g2')} />
        <path d="M50 50 L30 70 L46 46 Z" fill="#fff" />
        <path d="M70 30 L50 50 L46 46z" fill="#ff7a70" opacity=".6" />
        <circle cx="50" cy="50" r="2.4" fill="#fff" />
      </g>
    ),
  },
  music: {
    name: 'Music', bg: ['#ff6b82', '#fa233b'], g: ['#fff'], gd: ['#ff4d64'],
    art: () => <path fill={F('--g1')} d="M66 18.5 39.5 24c-2 .4-3.5 2.2-3.5 4.3v34.4c-1.6-.7-3.5-1-5.5-.8-5.5.6-9.5 4.8-8.9 9.3.6 4.5 5.6 7.6 11.1 7 5.2-.6 9.1-4.4 8.9-8.6V42.3l22.5-4.7v19.1c-1.6-.7-3.5-1-5.5-.8-5.5.6-9.5 4.8-8.9 9.3.6 4.5 5.6 7.6 11.1 7 5.2-.6 9.1-4.4 8.9-8.6V22.8c0-2.8-2.5-4.9-5.2-4.3z" />,
  },
  facetime: {
    name: 'FaceTime', bg: ['#6ee677', '#22c142'], g: ['#fff'], gd: ['#3ddc57'],
    art: () => (
      <g fill={F('--g1')}>
        <rect x="16" y="32" width="46" height="36" rx="10" />
        <path d="M65 45.5 80 35.6c2-1.3 4.5.1 4.5 2.5v23.8c0 2.4-2.6 3.8-4.5 2.5L65 54.5z" />
      </g>
    ),
  },
  calendar: {
    name: 'Calendar', bg: ['#ffffff', '#f4f4f6'], g: ['#ff3b30', '#1c1c1e'], gd: ['#ff453a', '#fff'], light: true,
    art: (now) => (
      <g textAnchor="middle" fontFamily="var(--font-text)">
        <text x="50" y="30" fontSize="13.5" fontWeight="600" fill={F('--g1')}>{['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'][now.getDay()].slice(0, 3)}</text>
        <text x="50" y="79" fontSize="50" fontWeight="300" fill={F('--g2')} letterSpacing="-2">{now.getDate()}</text>
      </g>
    ),
  },
  photos: {
    name: 'Photos', bg: ['#ffffff', '#f5f5f7'], g: ['#fff'], light: true,
    art: () => (
      <g transform="translate(50 50)" style={{ mixBlendMode: 'multiply' }}>
        {['#ffb400', '#ff7a00', '#ff3b5c', '#c945d6', '#6c5ce7', '#2e8bff', '#1fc2a8', '#7ed321'].map((c, i) => (
          <ellipse key={i} cx="0" cy="-16" rx="10.5" ry="17" fill={c} opacity=".82" transform={`rotate(${i * 45})`} />
        ))}
      </g>
    ),
  },
  camera: {
    name: 'Camera', bg: ['#e8e8ec', '#a9a9b1'], g: ['#2b2b30', '#58585f'], gd: ['#d0d0d5', '#58585f'], light: true,
    art: () => (
      <g>
        <rect x="14" y="30" width="72" height="46" rx="10" fill={F('--g1')} />
        <rect x="36" y="24" width="20" height="9" rx="3" fill={F('--g1')} />
        <circle cx="50" cy="53" r="17" fill="#e9e9ee" />
        <circle cx="50" cy="53" r="13" fill={F('--g2')} />
        <circle cx="50" cy="53" r="7.5" fill="#1a1a1e" />
        <circle cx="46" cy="49" r="2.2" fill="#fff" opacity=".7" />
        <circle cx="76" cy="38" r="3" fill="#ffcc00" />
      </g>
    ),
  },
  mail: {
    name: 'Mail', bg: ['#2cb7ff', '#0a6cff'], g: ['#fff'], gd: ['#2d9cff'],
    art: () => (
      <g>
        <rect x="16" y="28" width="68" height="46" rx="7" fill={F('--g1')} />
        <path d="M18 31 50 55 82 31" fill="none" stroke="#0a6cff" strokeOpacity=".35" strokeWidth="3.5" strokeLinejoin="round" />
      </g>
    ),
  },
  clock: {
    name: 'Clock', bg: ['#1c1c1e', '#000'], g: ['#fff', '#1c1c1e', '#ff9500'], light: false,
    art: (now) => {
      const h = now.getHours() % 12
      const m = now.getMinutes()
      const s = now.getSeconds()
      return (
        <g>
          <circle cx="50" cy="50" r="40" fill={F('--g1')} />
          {Array.from({ length: 12 }).map((_, i) => (
            <text key={i} x={50 + Math.sin((i + 1) * Math.PI / 6) * 31} y={50 - Math.cos((i + 1) * Math.PI / 6) * 31 + 3.5} fontSize="9.5" textAnchor="middle" fill={F('--g2')} fontFamily="var(--font-text)" fontWeight="500">{i + 1}</text>
          ))}
          <line x1="50" y1="50" x2={50 + Math.sin(((h + m / 60) * Math.PI) / 6) * 18} y2={50 - Math.cos(((h + m / 60) * Math.PI) / 6) * 18} stroke={F('--g2')} strokeWidth="3.6" strokeLinecap="round" />
          <line x1="50" y1="50" x2={50 + Math.sin((m * Math.PI) / 30) * 28} y2={50 - Math.cos((m * Math.PI) / 30) * 28} stroke={F('--g2')} strokeWidth="2.6" strokeLinecap="round" />
          <line x1={50 - Math.sin((s * Math.PI) / 30) * 7} y1={50 + Math.cos((s * Math.PI) / 30) * 7} x2={50 + Math.sin((s * Math.PI) / 30) * 32} y2={50 - Math.cos((s * Math.PI) / 30) * 32} stroke={F('--g3')} strokeWidth="1.2" strokeLinecap="round" />
          <circle cx="50" cy="50" r="2.4" fill={F('--g3')} />
        </g>
      )
    },
  },
  maps: {
    name: 'Maps', bg: ['#dff3d6', '#bfe3b0'], g: ['#fff'], light: true,
    art: () => (
      <g>
        <path d="M0 62 C 20 55, 35 70, 55 60 S 85 45, 100 52 V100 H0z" fill="#7cc3ff" />
        <path d="M60 0 L 40 100" stroke="#fff" strokeWidth="9" />
        <path d="M0 30 L 100 44" stroke="#ffd65c" strokeWidth="7" />
        <path d="M60 0 L 40 100" stroke="#f2f2f2" strokeWidth="1" strokeDasharray="4 4" />
        <rect x="64" y="8" width="22" height="18" rx="3" fill="#a8d890" />
        <circle cx="32" cy="34" r="11" fill="#ff3b30" />
        <circle cx="32" cy="34" r="4.5" fill="#fff" />
        <path d="M26 42 32 54 38 42z" fill="#ff3b30" />
      </g>
    ),
  },
  weather: {
    name: 'Weather', bg: ['#4ab1ff', '#1567e0'], g: ['#fff', '#ffd23f'], gd: ['#e5e5ea', '#ffd23f'],
    art: () => (
      <g>
        <circle cx="38" cy="38" r="15" fill={F('--g2')} />
        <path fill={F('--g1')} d="M70 74H33c-8 0-14-6-14-13.5S25 47 32.5 47c1.2 0 2.3.1 3.4.4C38.7 40 46 35 54.5 35 65 35 73.6 42.6 74.8 52.6 80.4 53.8 84.5 58.7 84.5 64.5 84.5 70 79.9 74 74.5 74z" />
      </g>
    ),
  },
  reminders: {
    name: 'Reminders', bg: ['#ffffff', '#f4f4f6'], g: ['#c7c7cc'], gd: ['#636366'], light: true,
    art: () => (
      <g>
        {[['#ff9500', 30], ['#007aff', 50], ['#ff3b30', 70]].map(([c, y]) => (
          <g key={y as number}>
            <circle cx="26" cy={y as number} r="7.5" fill={c as string} />
            <circle cx="26" cy={y as number} r="3.2" fill="#fff" />
            <rect x="40" y={(y as number) - 2} width="40" height="4" rx="2" fill={F('--g1')} />
          </g>
        ))}
      </g>
    ),
  },
  notes: {
    name: 'Notes', bg: ['#ffffff', '#f7f7f5'], g: ['#ffcc00', '#d8d8dc'], gd: ['#ffd60a', '#48484a'], light: true,
    art: () => (
      <g>
        <rect x="0" y="0" width="100" height="26" fill={F('--g1')} />
        <path d="M0 26 H100" stroke="#d9a800" strokeWidth="1" />
        {[40, 53, 66, 79].map((y) => <line key={y} x1="10" y1={y} x2="90" y2={y} stroke={F('--g2')} strokeWidth="1.3" />)}
        <g fill="#c7a100" opacity=".5">{[14, 24, 34, 44, 54, 64, 74, 84].map((x) => <circle key={x} cx={x} cy="7" r="1.3" />)}</g>
      </g>
    ),
  },
  news: {
    name: 'News', bg: ['#ff5b6b', '#f6263f'], g: ['#fff'], gd: ['#ff4d64'],
    art: () => (
      <g fill={F('--g1')}>
        <rect x="20" y="22" width="60" height="56" rx="7" />
        <g fill="#f6263f" opacity=".85">
          <rect x="28" y="30" width="44" height="9" rx="2" />
          <rect x="28" y="45" width="20" height="18" rx="2" />
          <rect x="52" y="45" width="20" height="3.5" rx="1.5" />
          <rect x="52" y="52" width="20" height="3.5" rx="1.5" />
          <rect x="52" y="59" width="14" height="3.5" rx="1.5" />
          <rect x="28" y="68" width="44" height="3.5" rx="1.5" />
        </g>
      </g>
    ),
  },
  stocks: {
    name: 'Stocks', bg: ['#1c1c1e', '#000'], g: ['#30d158', '#fff'],
    art: () => (
      <g>
        <path d="M14 66 L30 54 L42 60 L58 38 L70 46 L86 26" fill="none" stroke={F('--g1')} strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M14 66 L30 54 L42 60 L58 38 L70 46 L86 26 V82 H14z" fill={F('--g1')} opacity=".18" />
      </g>
    ),
  },
  podcasts: {
    name: 'Podcasts', bg: ['#d57cff', '#8a2be2'], g: ['#fff'], gd: ['#c77dff'],
    art: () => (
      <g fill="none" stroke={F('--g1')} strokeLinecap="round">
        <circle cx="50" cy="44" r="7.5" fill={F('--g1')} stroke="none" />
        <path d="M46 56 h8 l-1.5 22 h-5z" fill={F('--g1')} stroke="none" />
        <path d="M36 58 A18 18 0 1 1 64 58" strokeWidth="4.2" />
        <path d="M28 68 A29 29 0 1 1 72 68" strokeWidth="4.2" />
      </g>
    ),
  },
  health: {
    name: 'Health', bg: ['#ffffff', '#f5f5f7'], g: ['#ff2d55'], light: true,
    art: () => <path fill={F('--g1')} d="M72 22c7 2.5 12 9.5 11 18-1.5 13-15 24-33 37C32 64 18.5 53 17 40c-1-8.5 4-15.5 11-18 8-2.8 16.2.5 22 8 5.8-7.5 14-10.8 22-8z"  transform="translate(50 50) scale(1.02) translate(-50 -49)" />,
  },
  fitness: {
    name: 'Fitness', bg: ['#1c1c1e', '#000'], g: ['#fa114f', '#a6ff00', '#00f0ff'],
    art: () => (
      <g fill="none" strokeLinecap="round" strokeWidth="8.5">
        <circle cx="50" cy="50" r="34" stroke={F('--g1')} strokeOpacity=".25" />
        <circle cx="50" cy="50" r="34" stroke={F('--g1')} strokeDasharray="180 300" transform="rotate(-90 50 50)" />
        <circle cx="50" cy="50" r="24" stroke={F('--g2')} strokeOpacity=".25" />
        <circle cx="50" cy="50" r="24" stroke={F('--g2')} strokeDasharray="130 300" transform="rotate(-90 50 50)" />
        <circle cx="50" cy="50" r="14" stroke={F('--g3')} strokeOpacity=".25" />
        <circle cx="50" cy="50" r="14" stroke={F('--g3')} strokeDasharray="60 300" transform="rotate(-90 50 50)" />
      </g>
    ),
  },
  home: {
    name: 'Home', bg: ['#ffb340', '#ff8a00'], g: ['#fff', '#ff9500'], gd: ['#ffa826', '#1c1c1e'],
    art: () => (
      <g>
        <path fill={F('--g1')} d="M50 18 16 46c-2 1.7-.8 5 1.8 5H24v26c0 2.8 2.2 5 5 5h42c2.8 0 5-2.2 5-5V51h6.2c2.6 0 3.8-3.3 1.8-5z" />
        <rect x="42" y="56" width="16" height="26" rx="3" fill={F('--g2')} />
      </g>
    ),
  },
  wallet: {
    name: 'Wallet', bg: ['#1c1c1e', '#000'], g: ['#fff'],
    art: () => (
      <g>
        <rect x="14" y="20" width="72" height="56" rx="9" fill="#2c2c2e" />
        <rect x="18" y="24" width="64" height="18" rx="5" fill="#3ec1ff" />
        <rect x="18" y="33" width="64" height="18" rx="5" fill="#ffb300" />
        <rect x="18" y="42" width="64" height="18" rx="5" fill="#34c759" />
        <rect x="18" y="51" width="64" height="18" rx="5" fill="#ff5a48" />
        <path d="M14 58 H44 C47 58 48 64 50 64 C52 64 53 58 56 58 H86 V74 C86 78 83 80 80 80 H20 C17 80 14 78 14 74z" fill="#e5e5ea" />
      </g>
    ),
  },
  settings: {
    name: 'Settings', bg: ['#d4d4d9', '#8e8e96'], g: ['#58585f', '#e8e8ec'], gd: ['#aeaeb2', '#1c1c1e'], light: true,
    art: () => (
      <g transform="translate(50 50)">
        {Array.from({ length: 36 }).map((_, i) => <rect key={i} x="-2.2" y="-38" width="4.4" height="8" rx="1" fill={F('--g1')} transform={`rotate(${i * 10})`} />)}
        <circle r="31" fill={F('--g1')} />
        <circle r="26" fill={F('--g2')} />
        {Array.from({ length: 6 }).map((_, i) => <rect key={i} x="-3.5" y="-23" width="7" height="46" rx="3" fill={F('--g1')} transform={`rotate(${i * 30})`} />)}
        <circle r="12" fill={F('--g1')} />
        <circle r="8" fill={F('--g2')} />
      </g>
    ),
  },
  siri: {
    name: 'Siri', bg: ['#0b0b16', '#000'], g: ['#fff'],
    art: () => (
      <g>
        <defs>
          <radialGradient id="siri-a" cx="35%" cy="35%" r="70%"><stop offset="0" stopColor="#ff5cd6" /><stop offset=".55" stopColor="#7a4bff" /><stop offset="1" stopColor="#1b1bff" stopOpacity="0" /></radialGradient>
          <radialGradient id="siri-b" cx="70%" cy="65%" r="60%"><stop offset="0" stopColor="#1fe1ff" /><stop offset=".6" stopColor="#3a7bff" stopOpacity=".6" /><stop offset="1" stopColor="#3a7bff" stopOpacity="0" /></radialGradient>
          <radialGradient id="siri-c" cx="50%" cy="80%" r="50%"><stop offset="0" stopColor="#ffb13b" /><stop offset="1" stopColor="#ff5c3b" stopOpacity="0" /></radialGradient>
        </defs>
        <circle cx="50" cy="50" r="33" fill="url(#siri-a)" />
        <circle cx="50" cy="50" r="33" fill="url(#siri-b)" />
        <circle cx="50" cy="50" r="33" fill="url(#siri-c)" opacity=".8" />
        <circle cx="50" cy="50" r="33" fill="none" stroke="#fff" strokeOpacity=".35" strokeWidth="1" />
        <ellipse cx="42" cy="38" rx="12" ry="6" fill="#fff" opacity=".35" transform="rotate(-30 42 38)" />
      </g>
    ),
  },
  playground: {
    name: 'Image Playground', bg: ['#ffffff', '#eef0ff'], g: ['#fff'], light: true,
    art: () => (
      <g>
        <circle cx="38" cy="40" r="18" fill="#ff9f0a" opacity=".92" />
        <circle cx="62" cy="38" r="15" fill="#ff375f" opacity=".85" />
        <circle cx="58" cy="62" r="19" fill="#5e5ce6" opacity=".85" />
        <circle cx="36" cy="64" r="13" fill="#30d158" opacity=".85" />
        <circle cx="50" cy="50" r="9" fill="#fff" opacity=".9" />
      </g>
    ),
  },
  shortcuts: {
    name: 'Shortcuts', bg: ['#2b2f6b', '#141531'], g: ['#fff'],
    art: () => (
      <g>
        <defs>
          <linearGradient id="sc-a" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#ff5ea8" /><stop offset="1" stopColor="#ff8a3d" /></linearGradient>
          <linearGradient id="sc-b" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#35d4ff" /><stop offset="1" stopColor="#5a5bff" /></linearGradient>
        </defs>
        <rect x="18" y="32" width="46" height="46" rx="12" fill="url(#sc-b)" transform="rotate(-45 41 55)" />
        <rect x="36" y="18" width="46" height="46" rx="12" fill="url(#sc-a)" transform="rotate(-45 59 41)" opacity=".92" />
      </g>
    ),
  },
  findmy: {
    name: 'Find My', bg: ['#5ee27a', '#15b847'], g: ['#fff'], gd: ['#30d158'],
    art: () => (
      <g fill="none" stroke={F('--g1')}>
        <circle cx="50" cy="50" r="30" strokeWidth="4" opacity=".5" />
        <circle cx="50" cy="50" r="19" strokeWidth="4" opacity=".8" />
        <circle cx="50" cy="50" r="8" fill={F('--g1')} stroke="none" />
      </g>
    ),
  },
  freeform: {
    name: 'Freeform', bg: ['#ffffff', '#f4f7ff'], g: ['#0a84ff'], light: true,
    art: () => (
      <g fill="none" strokeLinecap="round">
        <path d="M18 70 C 30 30, 45 30, 50 50 S 70 75, 82 30" stroke={F('--g1')} strokeWidth="6" />
        <rect x="58" y="16" width="24" height="24" rx="4" fill="#ffd60a" />
      </g>
    ),
  },
  journal: {
    name: 'Journal', bg: ['#ffb4d0', '#a66bff'], g: ['#fff'], gd: ['#d19cff'],
    art: () => (
      <g>
        <rect x="26" y="18" width="48" height="64" rx="6" fill={F('--g1')} />
        <rect x="26" y="18" width="9" height="64" rx="3" fill="#000" opacity=".12" />
        <path d="M50 38c4-7 13-4 11 3-1 4-6 7-11 11-5-4-10-7-11-11-2-7 7-10 11-3z" fill="#ff6fae" />
      </g>
    ),
  },
  passwords: {
    name: 'Passwords', bg: ['#4ad7ff', '#0a84ff'], g: ['#fff'], gd: ['#3aa0ff'],
    art: () => (
      <g fill={F('--g1')}>
        <circle cx="50" cy="36" r="17" />
        <circle cx="50" cy="31" r="5" fill="#0a84ff" />
        <path d="M44 48 h12 v10 l-4 4 4 4 -4 4 4 4 -6 6 -6 -6z" />
      </g>
    ),
  },
  files: {
    name: 'Files', bg: ['#ffffff', '#f2f6ff'], g: ['#1e9bff', '#58b8ff'], light: true,
    art: () => (
      <g>
        <path d="M16 30c0-3 2-5 5-5h20l6 7h32c3 0 5 2 5 5v37c0 3-2 5-5 5H21c-3 0-5-2-5-5z" fill={F('--g1')} />
        <path d="M16 40c0-3 2-5 5-5h58c3 0 5 2 5 5v34c0 3-2 5-5 5H21c-3 0-5-2-5-5z" fill={F('--g2')} />
      </g>
    ),
  },
  contacts: {
    name: 'Contacts', bg: ['#f2f2f5', '#d3d3d9'], g: ['#8e8e93', '#fff'], gd: ['#aeaeb2'], light: true,
    art: () => (
      <g>
        <circle cx="50" cy="50" r="30" fill={F('--g1')} opacity=".35" />
        <circle cx="50" cy="42" r="11" fill={F('--g1')} />
        <path d="M30 70c3-10 11-15 20-15s17 5 20 15" fill={F('--g1')} />
      </g>
    ),
  },
  calculator: {
    name: 'Calculator', bg: ['#2c2c2e', '#0f0f10'], g: ['#ff9f0a', '#636366', '#d4d4d2'],
    art: () => (
      <g>
        {[0, 1, 2, 3].map((r) => [0, 1, 2, 3].map((c) => (
          <circle key={`${r}${c}`} cx={23 + c * 18} cy={23 + r * 18} r="7.5" fill={c === 3 ? F('--g1') : r === 0 ? F('--g3') : F('--g2')} />
        )))}
      </g>
    ),
  },
  games: {
    name: 'Games', bg: ['#34c759', '#0a84ff'], g: ['#fff'], gd: ['#64d2ff'],
    art: () => (
      <g>
        <path fill={F('--g1')} d="M30 36h40c9 0 15 8 16 20l1 10c.6 6-6 10-11 6l-8-7H32l-8 7c-5 4-11.6 0-11-6l1-10c1-12 7-20 16-20z" />
        <g fill="#0a84ff" opacity=".85"><rect x="27" y="44" width="4" height="13" rx="1" /><rect x="22.5" y="48.5" width="13" height="4" rx="1" /><circle cx="68" cy="46" r="3" /><circle cx="74" cy="52" r="3" /></g>
      </g>
    ),
  },
  preview: {
    name: 'Preview', bg: ['#e9f3ff', '#c9ddf7'], g: ['#1c6ef2'], light: true,
    art: () => (
      <g>
        <rect x="18" y="18" width="46" height="60" rx="4" fill="#fff" stroke="#b8c9e6" />
        {[28, 36, 44, 52].map((y) => <rect key={y} x="25" y={y} width="32" height="3" rx="1.5" fill="#c9d6ea" />)}
        <circle cx="62" cy="60" r="15" fill="#e8f1ff" stroke={F('--g1')} strokeWidth="5" />
        <path d="M72 70 L84 82" stroke={F('--g1')} strokeWidth="7" strokeLinecap="round" />
      </g>
    ),
  },
  magnifier: {
    name: 'Magnifier', bg: ['#2c2c2e', '#000'], g: ['#fff'],
    art: () => (
      <g fill="none" stroke={F('--g1')} strokeLinecap="round">
        <circle cx="44" cy="44" r="20" strokeWidth="7" />
        <path d="M59 59 L78 78" strokeWidth="10" />
        <path d="M36 38 a10 10 0 0 1 10 -6" strokeWidth="3" opacity=".6" />
      </g>
    ),
  },
  voicememos: {
    name: 'Voice Memos', bg: ['#2c2c2e', '#050505'], g: ['#ff3b30', '#fff'], gd: ['#ff453a', '#f2f2f7'],
    art: () => (
      <g strokeLinecap="round">
        {[6, 12, 20, 30, 16, 36, 24, 14, 28, 18, 10, 22, 8].map((h, i) => (
          <line key={i} x1={19 + i * 5.2} x2={19 + i * 5.2} y1={50 - h / 2} y2={50 + h / 2} stroke={i < 7 ? F('--g1') : F('--g2')} strokeWidth="3" opacity={i < 7 ? 1 : 0.85} />
        ))}
        <line x1="53.4" x2="53.4" y1="24" y2="76" stroke={F('--g1')} strokeWidth="1.6" />
        <circle cx="53.4" cy="24" r="2.6" fill={F('--g1')} />
        <circle cx="53.4" cy="76" r="2.6" fill={F('--g1')} />
      </g>
    ),
  },
}

interface Props {
  app: AppId
  size?: number
  style?: 'default' | 'dark' | 'clear' | 'tinted'
  tint?: string
  now?: Date
}

/** Renders an app icon's art on its squircle-ish background with the iOS 27 material highlight. */
export const AppIconArt = memo(function AppIconArt({ app, size = 60, style = 'default', tint = '#6aa9ff', now = new Date() }: Props) {
  const spec = ICONS[app]
  let bg: string
  let vars: Record<string, string>
  const g = spec.g
  const gd = spec.gd ?? g
  switch (style) {
    case 'dark':
      bg = 'linear-gradient(180deg,#2e2e31,#141416)'
      vars = { '--g1': gd[0], '--g2': gd[1] ?? g[1] ?? '#fff', '--g3': gd[2] ?? g[2] ?? '#fff' }
      break
    case 'clear':
      bg = 'linear-gradient(180deg,rgb(255 255 255 / .34),rgb(255 255 255 / .12))'
      vars = { '--g1': 'rgba(255,255,255,.95)', '--g2': 'rgba(255,255,255,.55)', '--g3': 'rgba(255,255,255,.75)' }
      break
    case 'tinted':
      bg = `linear-gradient(180deg,color-mix(in srgb, ${tint} 30%, #111),#0b0b0c)`
      vars = { '--g1': tint, '--g2': `color-mix(in srgb, ${tint} 60%, #000)`, '--g3': `color-mix(in srgb, ${tint} 75%, #fff)` }
      break
    default:
      bg = `linear-gradient(180deg,${spec.bg[0]},${spec.bg[1]})`
      vars = { '--g1': g[0], '--g2': g[1] ?? '#fff', '--g3': g[2] ?? '#fff' }
  }
  return (
    <div
      className={`app-icon-art style-${style}`}
      data-app={app}
      style={{ width: size, height: size, background: bg, ['--tint' as string]: tint, ...(vars as React.CSSProperties) }}
      aria-hidden
    >
      <svg viewBox="0 0 100 100" width={size} height={size}>
        {spec.art(now)}
      </svg>
    </div>
  )
})
