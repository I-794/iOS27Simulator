import { useEffect, type CSSProperties } from 'react'
import { useOS } from '../os/store'
import { useDrag } from '../os/hooks'
import { HomeScreen } from './HomeScreen'
import { AppHost } from './AppHost'
import { LockScreen } from './LockScreen'
import { StatusBar } from './StatusBar'
import { DynamicIsland } from './DynamicIsland'
import { ControlCenter } from './ControlCenter'
import { Spotlight } from './Spotlight'
import { Banner } from './Banner'
import { SiriOverlay } from './SiriOverlay'
import { ShareSheet } from './ShareSheet'
import { VolumeHUD, Toast } from './HUD'
import { KeyboardHost } from '../ui/Keyboard'
import { OverlayHost } from '../ui/overlay'
import { Wallpaper } from '../art/Wallpaper'
import { installKeyboardShortcuts } from './actions'
import { startServices } from './services'
import { VoiceOverHost } from './VoiceOver'

export function Screen({ width, height, fullscreen }: { width: number; height: number; fullscreen: boolean }) {
  const theme = useOS((s) => s.theme)
  const glassTint = useOS((s) => s.glassTint)
  const orientation = useOS((s) => s.orientation)
  const screenOn = useOS((s) => s.screenOn)
  const brightness = useOS((s) => s.brightness)
  const nightShift = useOS((s) => s.nightShift)
  const reduceMotion = useOS((s) => s.reduceMotion)
  const reduceTransparency = useOS((s) => s.reduceTransparency)
  const increaseContrast = useOS((s) => s.increaseContrast)
  const boldText = useOS((s) => s.boldText)
  const accent = useOS((s) => s.accent)
  const textScale = useOS((s) => s.textScale)
  const voiceOver = useOS((s) => s.accessibility.voiceOver)
  const wallpaper = useOS((s) => s.wallpaper)
  const locked = useOS((s) => s.locked)
  const lowPower = useOS((s) => s.lowPower)
  const overlay = useOS((s) => s.overlay)

  useEffect(() => {
    const off1 = installKeyboardShortcuts()
    const off2 = startServices()
    return () => {
      off1()
      off2()
    }
  }, [])

  useEffect(() => {
    document.documentElement.dataset.reduceMotion = String(reduceMotion)
  }, [reduceMotion])

  const landscape = orientation === 'landscape'
  const style = {
    width,
    height,
    '--glass-tint': glassTint,
    '--safe-top': landscape ? '0px' : '62px',
    '--safe-bottom': landscape ? '21px' : '34px',
    '--safe-left': landscape ? '62px' : '0px',
    '--safe-right': landscape ? '62px' : '0px',
    fontSize: `${17 * textScale}px`,
    zoom: textScale !== 1 ? undefined : undefined,
  } as CSSProperties

  return (
    <div
      className={`screen ios ${landscape ? 'landscape' : ''} ${lowPower ? 'low-power' : ''}`}
      data-theme={theme}
      data-reduce-motion={reduceMotion}
      data-reduce-transparency={reduceTransparency}
      data-increase-contrast={increaseContrast}
      data-bold={boldText}
      data-accent={accent}
      data-voiceover={voiceOver}
      data-fullscreen={fullscreen}
      data-overlay={overlay ?? undefined}
      style={style}
    >
      <GlassFilters />
      <div className="layer-wallpaper">
        <Wallpaper id={wallpaper} dark={theme === 'dark'} />
      </div>
      {!locked && <HomeScreen />}
      <AppHost />
      <TopEdgeGestures />
      <LockScreen />
      <Spotlight />
      <ControlCenter />
      <Banner />
      <StatusBar />
      <DynamicIsland />
      <SiriOverlay />
      <ShareSheet />
      <KeyboardHost />
      <OverlayHost />
      <Toast />
      <VolumeHUD />
      <VoiceOverHost />
      {nightShift && <div className="nightshift-veil" />}
      <div className="brightness-veil" style={{ opacity: Math.max(0, 0.85 - brightness) * 0.8 }} />
      <div className={`screen-off ${screenOn ? '' : 'on'}`} onClick={() => useOS.getState().set({ screenOn: true })} aria-hidden={screenOn} />
    </div>
  )
}

/** iOS 27 top-edge gesture map: top-left pulls down Notification Center, the centre
 *  (Dynamic Island) pulls down Search or Ask, and top-right pulls down Control Center. */
function TopEdgeGestures() {
  const overlay = useOS((s) => s.overlay)
  const siri = useOS((s) => s.siriActive)
  const make = (target: 'cc' | 'nc' | 'spotlight') =>
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useDrag({
      onMove: () => {},
      onEnd: (_dx, dy) => {
        if (!(dy > 30 || Math.abs(dy) < 4)) return
        const st = useOS.getState()
        st.setOverlay(target === 'spotlight' && st.locked ? 'nc' : target)
      },
    })
  const ncDrag = make('nc')
  const askDrag = make('spotlight')
  const ccDrag = make('cc')
  if (overlay === 'cc' || overlay === 'nc' || overlay === 'spotlight' || siri) return null
  return (
    <>
      <div className="edge-zone edge-nc" onPointerDown={ncDrag} aria-hidden />
      <div className="edge-zone edge-ask" onPointerDown={askDrag} aria-hidden />
      <div className="edge-zone edge-cc" onPointerDown={ccDrag} aria-hidden />
    </>
  )
}

const H_MAP = `data:image/svg+xml;utf8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" preserveAspectRatio="none"><defs><linearGradient id="h"><stop offset="0" stop-color="rgb(230,0,0)"/><stop offset=".03" stop-color="rgb(185,0,0)"/><stop offset=".08" stop-color="rgb(145,0,0)"/><stop offset=".14" stop-color="rgb(128,0,0)"/><stop offset=".86" stop-color="rgb(128,0,0)"/><stop offset=".92" stop-color="rgb(111,0,0)"/><stop offset=".97" stop-color="rgb(71,0,0)"/><stop offset="1" stop-color="rgb(26,0,0)"/></linearGradient></defs><rect width="100" height="100" fill="url(#h)"/></svg>')}`
const V_MAP = `data:image/svg+xml;utf8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" preserveAspectRatio="none"><defs><linearGradient id="v" x2="0" y2="1"><stop offset="0" stop-color="rgb(0,230,0)"/><stop offset=".06" stop-color="rgb(0,185,0)"/><stop offset=".16" stop-color="rgb(0,145,0)"/><stop offset=".28" stop-color="rgb(0,128,0)"/><stop offset=".72" stop-color="rgb(0,128,0)"/><stop offset=".84" stop-color="rgb(0,111,0)"/><stop offset=".94" stop-color="rgb(0,71,0)"/><stop offset="1" stop-color="rgb(0,26,0)"/></linearGradient></defs><rect width="100" height="100" fill="url(#v)"/></svg>')}`

/** Edge-lens displacement used by Liquid Glass surfaces to refract what's behind them. */
function GlassFilters() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden>
      <filter id="lg-refract" x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
        <feImage href={H_MAP} x="0" y="0" width="100%" height="100%" preserveAspectRatio="none" result="h" />
        <feImage href={V_MAP} x="0" y="0" width="100%" height="100%" preserveAspectRatio="none" result="v" />
        <feComposite in="h" in2="v" operator="arithmetic" k2="1" k3="1" result="map" />
        <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
        <feDisplacementMap in="blur" in2="map" scale="20" xChannelSelector="R" yChannelSelector="G" />
      </filter>
    </svg>
  )
}
