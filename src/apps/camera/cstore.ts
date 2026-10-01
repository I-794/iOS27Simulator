import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type Mode = 'timelapse' | 'slomo' | 'video' | 'photo' | 'portrait' | 'pano' | 'siri'
export const MODES: { id: Mode; label: string }[] = [
  { id: 'timelapse', label: 'TIME-LAPSE' },
  { id: 'slomo', label: 'SLO-MO' },
  { id: 'video', label: 'VIDEO' },
  { id: 'photo', label: 'PHOTO' },
  { id: 'portrait', label: 'PORTRAIT' },
  { id: 'pano', label: 'PANO' },
  { id: 'siri', label: 'SIRI' },
]

export interface CamSettings {
  flash: 'auto' | 'on' | 'off'
  live: boolean
  timer: 0 | 3 | 10
  exposure: number
  style: string
  aspect: '4:3' | '16:9' | '1:1'
  format: 'HEIF' | 'HEIF Max' | 'ProRAW'
  video: '4K · 30' | '4K · 60' | 'HD · 30'
  grid: boolean
  level: boolean
  mirror: boolean
  reach: boolean
  /** Pro controls (iPhone 18 Pro) */
  aperture: number
  shutter: number
  wb: number
  histogram: boolean
  /** control ids pinned to the top row (iOS 27 customizable controls) */
  pinned: string[]
  set: (p: Partial<CamSettings>) => void
}

export const useCam = create<CamSettings>()(
  persist(
    (set) => ({
      flash: 'auto',
      live: true,
      timer: 0,
      exposure: 0,
      style: 'Standard',
      aspect: '4:3',
      format: 'HEIF',
      video: '4K · 30',
      grid: false,
      level: true,
      mirror: true,
      reach: false,
      aperture: 0,
      shutter: 0,
      wb: 0,
      histogram: false,
      pinned: ['flash', 'live', 'aspect'],
      set: (p) => set(p),
    }),
    { name: 'ios27-camera', partialize: ({ set: _s, ...rest }) => { void _s; return rest } },
  ),
)

export function lensFor(zoom: number, front: boolean) {
  if (front) return { lens: 'Front Camera — 23 mm ƒ1.9', aperture: 'ƒ1.9', name: 'Front' }
  if (zoom < 0.95) return { lens: 'Ultra Wide Camera — 13 mm ƒ2.2', aperture: 'ƒ2.2', name: 'Ultra Wide' }
  if (zoom < 1.95) return { lens: 'Main Camera — 24 mm ƒ1.78', aperture: 'ƒ1.78', name: 'Main' }
  if (zoom < 4.9) return { lens: 'Main Camera — 48 mm ƒ1.78 (2× optical-quality)', aperture: 'ƒ1.78', name: '2×' }
  return { lens: 'Telephoto Camera — 120 mm ƒ2.8', aperture: 'ƒ2.8', name: 'Telephoto' }
}

/** Which physical lens a zoom factor uses (for the crossfade on lens switch). */
export const lensIndex = (z: number) => (z < 0.95 ? 0 : z < 4.9 ? 1 : 2)

/** Variable aperture stops (index 0 = Auto). */
export const APERTURES = ['Auto', 'ƒ1.4', 'ƒ1.8', 'ƒ2.2', 'ƒ2.8', 'ƒ4', 'ƒ5.6', 'ƒ8', 'ƒ11', 'ƒ16']
export const SHUTTERS = ['Auto', '1/8000', '1/2000', '1/500', '1/125', '1/60', '1/30', '1/15', '1/4', '1"']
export const WBS = ['Auto', '2800K', '3200K', '4000K', '5000K', '5600K', '6500K', '7500K', '9000K']

export interface ControlDef { id: string; label: string; pro?: boolean }
export const CONTROLS: ControlDef[] = [
  { id: 'flash', label: 'Flash' },
  { id: 'live', label: 'Live' },
  { id: 'timer', label: 'Timer' },
  { id: 'exposure', label: 'Exposure' },
  { id: 'style', label: 'Styles' },
  { id: 'aspect', label: 'Aspect Ratio' },
  { id: 'format', label: 'Format' },
  { id: 'grid', label: 'Grid' },
  { id: 'level', label: 'Level' },
  { id: 'aperture', label: 'Aperture', pro: true },
  { id: 'shutter', label: 'Shutter Speed', pro: true },
  { id: 'wb', label: 'White Balance', pro: true },
  { id: 'histogram', label: 'Histogram', pro: true },
  { id: 'reach', label: 'Reach' },
  { id: 'mirror', label: 'Mirror Front' },
]
