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
      {nightShift && <div className="nightshift-veil" />}
      <div className="brightness-veil" style={{ opacity: Math.max(0, 0.85 - brightness) * 0.8 }} />
      <div className={`screen-off ${screenOn ? '' : 'on'}`} onClick={() => useOS.getState().set({ screenOn: true })} aria-hidden={screenOn} />
    </div>
  )
}

/** Invisible strips along the top edge: pull down on the right for Control Center, elsewhere for Notification Center. */
function TopEdgeGestures() {
  const overlay = useOS((s) => s.overlay)
  const siri = useOS((s) => s.siriActive)
  const make = (target: 'cc' | 'nc') =>
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useDrag({
      onMove: () => {},
      onEnd: (_dx, dy) => {
        if (dy > 30 || Math.abs(dy) < 4) useOS.getState().setOverlay(target)
      },
    })
  const ncDrag = make('nc')
  const ccDrag = make('cc')
  if (overlay === 'cc' || overlay === 'nc' || siri) return null
  return (
    <>
      <div className="edge-zone edge-nc" onPointerDown={ncDrag} aria-hidden />
      <div className="edge-zone edge-cc" onPointerDown={ccDrag} aria-hidden />
    </>
  )
}
