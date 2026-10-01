import { memo } from 'react'
import { Scene, sceneIsPortrait } from './Scene'
import { GenImage } from './GenImage'

export interface WallpaperDef {
  id: string
  name: string
  /** CSS background layers for light / dark */
  light?: string
  dark?: string
  scene?: string
  /** dominant colour used for status-bar contrast and tinting */
  tone: 'light' | 'dark'
  accent: string
}

export const WALLPAPERS: WallpaperDef[] = [
  {
    id: 'sequoia', name: 'Liquid Blue', tone: 'dark', accent: '#2f7bff',
    light: 'radial-gradient(120% 70% at 20% 10%, #9fd8ff 0%, transparent 55%), radial-gradient(90% 60% at 90% 30%, #4d7dff 0%, transparent 60%), radial-gradient(120% 80% at 30% 90%, #0b3fd1 0%, transparent 60%), radial-gradient(80% 50% at 80% 85%, #34d6ff 0%, transparent 60%), linear-gradient(180deg, #5fa8ff, #1742c9)',
    dark: 'radial-gradient(120% 70% at 20% 10%, #1e4f8f 0%, transparent 55%), radial-gradient(90% 60% at 90% 30%, #1a2f7a 0%, transparent 60%), radial-gradient(120% 80% at 30% 90%, #06164d 0%, transparent 60%), radial-gradient(80% 50% at 80% 85%, #0f5b7a 0%, transparent 60%), linear-gradient(180deg, #0c1f45, #030817)',
  },
  {
    id: 'sunrise', name: 'Sunrise', tone: 'dark', accent: '#ff7a3d',
    light: 'radial-gradient(100% 60% at 80% 0%, #ffe0a3 0%, transparent 60%), radial-gradient(100% 70% at 0% 40%, #ff8a65 0%, transparent 60%), radial-gradient(120% 80% at 70% 100%, #d9346b 0%, transparent 65%), linear-gradient(180deg, #ffb07a, #b8286a)',
    dark: 'radial-gradient(100% 60% at 80% 0%, #7a4a1f 0%, transparent 60%), radial-gradient(100% 70% at 0% 40%, #6e2b24 0%, transparent 60%), radial-gradient(120% 80% at 70% 100%, #4d0f2b 0%, transparent 65%), linear-gradient(180deg, #3b1b12, #14050c)',
  },
  {
    id: 'aurora', name: 'Aurora', tone: 'dark', accent: '#34d399',
    light: 'radial-gradient(90% 50% at 30% 20%, #6ef0c0 0%, transparent 60%), radial-gradient(90% 60% at 80% 50%, #8b5cf6 0%, transparent 60%), radial-gradient(120% 70% at 20% 100%, #1e3a8a 0%, transparent 60%), linear-gradient(180deg, #2dd4bf, #312e81)',
    dark: 'radial-gradient(90% 50% at 30% 20%, #0f5f4a 0%, transparent 60%), radial-gradient(90% 60% at 80% 50%, #3b1f73 0%, transparent 60%), radial-gradient(120% 70% at 20% 100%, #0b1437 0%, transparent 60%), linear-gradient(180deg, #06231f, #0b0a24)',
  },
  {
    id: 'graphite', name: 'Graphite', tone: 'dark', accent: '#8e8e93',
    light: 'radial-gradient(100% 60% at 30% 10%, #9aa3ad 0%, transparent 60%), radial-gradient(100% 70% at 90% 90%, #3a3f47 0%, transparent 60%), linear-gradient(180deg, #6f7680, #1f2227)',
    dark: 'radial-gradient(100% 60% at 30% 10%, #3a3f47 0%, transparent 60%), radial-gradient(100% 70% at 90% 90%, #15171a 0%, transparent 60%), linear-gradient(180deg, #24272c, #050506)',
  },
  {
    id: 'meadow', name: 'Meadow', tone: 'light', accent: '#65c466',
    light: 'radial-gradient(100% 60% at 50% 0%, #fdf6d8 0%, transparent 60%), radial-gradient(120% 70% at 10% 70%, #b8e986 0%, transparent 60%), radial-gradient(120% 70% at 90% 100%, #4cb86a 0%, transparent 60%), linear-gradient(180deg, #e8f7c8, #5fb96b)',
    dark: 'radial-gradient(100% 60% at 50% 0%, #3d3a24 0%, transparent 60%), radial-gradient(120% 70% at 10% 70%, #2d4a1c 0%, transparent 60%), radial-gradient(120% 70% at 90% 100%, #0f3a1c 0%, transparent 60%), linear-gradient(180deg, #1d2614, #07160c)',
  },
  { id: 'scene:mountain-lake', name: 'Glacier Point', scene: 'mountain-lake', tone: 'dark', accent: '#6aa3d8' },
  { id: 'scene:dog-beach', name: 'Biscuit at the Beach', scene: 'dog-beach', tone: 'dark', accent: '#ff9a5c' },
  { id: 'scene:night-sky', name: 'Night Sky', scene: 'night-sky', tone: 'dark', accent: '#8a7dff' },
  { id: 'scene:autumn-trees', name: 'Autumn', scene: 'autumn-trees', tone: 'dark', accent: '#e67e22' },
]

export function wallpaperDef(id: string): WallpaperDef {
  const found = WALLPAPERS.find((w) => w.id === id)
  if (found) return found
  if (id.startsWith('scene:')) return { id, name: 'Photo', scene: id.slice(6), tone: 'dark', accent: '#0a84ff' }
  if (id.startsWith('gen:')) return { id, name: 'Image Playground', tone: 'dark', accent: '#bf5af2' }
  return WALLPAPERS[0]
}

/** Full-bleed wallpaper. `dim` darkens it for Dark Mode like iOS does. */
export const Wallpaper = memo(function Wallpaper({ id, dark, blur = 0, className, fit }: { id: string; dark: boolean; blur?: number; className?: string; fit?: 'photo' | 'extend' }) {
  const def = wallpaperDef(id)
  const style: React.CSSProperties = { position: 'absolute', inset: 0, filter: blur ? `blur(${blur}px) saturate(1.2)` : undefined, transform: blur ? 'scale(1.1)' : undefined }
  if (def.scene) {
    const shade = dark ? 'brightness(.62)' : undefined
    // "photo": the picture keeps its original 4:3 frame over a blurred fill, as iOS shows a photo
    // that doesn't fill the screen; "extend": Apple Intelligence continues the scene edge to edge.
    if (fit === 'photo' || fit === 'extend') {
      // The whole photo sits in its original frame (4:3 or 3:4) below the clock.
      const ratio = sceneIsPortrait(def.scene) ? 4 / 3 : 3 / 4
      const top = ratio > 1 ? 22 : 34 // % of screen height
      const frameH = `${ratio * 100}cqw`
      const frame: React.CSSProperties = { position: 'absolute', left: 0, top: `${top}cqh`, width: '100%', height: frameH, filter: shade }
      if (fit === 'photo') {
        return (
          <div className={className} style={{ ...style, overflow: 'hidden', containerType: 'size' }}>
            <Scene scene={def.scene} style={{ position: 'absolute', inset: -40, width: 'calc(100% + 80px)', height: 'calc(100% + 80px)', filter: `blur(34px) saturate(1.3) ${shade ?? ''}` }} />
            <Scene scene={def.scene} fit="contain" style={frame} />
          </div>
        )
      }
      // Extend: Apple Intelligence continues the photo past its edges — the top and bottom rows are
      // carried outwards (softly blurred so they read as new sky / ground), then the original
      // frame is feathered into them.
      const feather = 'linear-gradient(to bottom, transparent 0, #000 9%, #000 91%, transparent 100%)'
      const soft = `blur(6px) ${shade ?? ''}`
      return (
        <div className={className} style={{ ...style, overflow: 'hidden', containerType: 'size' }}>
          <Scene scene={def.scene} strip={[0, 0.06]} style={{ position: 'absolute', left: -10, right: -10, top: -10, width: 'calc(100% + 20px)', height: `calc(${top}cqh + 30px)`, filter: soft }} />
          <Scene scene={def.scene} strip={[0.94, 1]} style={{ position: 'absolute', left: -10, right: -10, top: `calc(${top}cqh + ${frameH} - 20px)`, width: 'calc(100% + 20px)', height: `calc(${100 - top}cqh - ${frameH} + 30px)`, filter: soft }} />
          <Scene scene={def.scene} fit="contain" style={{ ...frame, WebkitMaskImage: feather, maskImage: feather }} />
        </div>
      )
    }
    return (
      <div className={className} style={style}>
        <Scene scene={def.scene} style={{ width: '100%', height: '100%', filter: shade }} />
      </div>
    )
  }
  if (id.startsWith('gen:')) {
    return (
      <div className={className} style={style}>
        <GenImage seed={id.slice(4)} style={{ width: '100%', height: '100%', filter: dark ? 'brightness(.65)' : undefined }} />
      </div>
    )
  }
  return <div className={className} style={{ ...style, background: dark ? def.dark : def.light }} />
})
