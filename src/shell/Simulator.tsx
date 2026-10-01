import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Home, Lock, RotateCw, Moon, Sun, LayoutGrid, Search, SlidersHorizontal, Bell, Mic, Camera, RefreshCcw, Info, Volume2, Volume1 } from 'lucide-react'
import { useOS } from '../os/store'
import { Screen } from './Screen'
import { pressHome, pressSide, holdSide, volumeStep, openSiri, pressAction, rotate } from './actions'

const SCREEN = { w: 402, h: 874 }
const BEZEL = 11

export function Simulator() {
  const orientation = useOS((s) => s.orientation)
  const theme = useOS((s) => s.theme)
  const [vp, setVp] = useState({ w: window.innerWidth, h: window.innerHeight })
  const deviceRef = useRef<HTMLDivElement>(null)
  const prevOrientation = useRef(orientation)

  useEffect(() => {
    const onResize = () => setVp({ w: window.innerWidth, h: window.innerHeight })
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // physical-device style: small viewports run the phone full-bleed
  const fullscreen = vp.w < 520 || (vp.h < 520 && vp.w < 1000)
  const landscape = orientation === 'landscape'
  let scale: number
  let screenW = landscape ? SCREEN.h : SCREEN.w
  let screenH = landscape ? SCREEN.w : SCREEN.h
  if (fullscreen) {
    scale = vp.w / screenW
    screenH = Math.round(vp.h / scale)
    if (landscape && vp.w < vp.h) {
      // viewport is portrait but user rotated: fit width
      scale = Math.min(vp.w / screenW, vp.h / screenH)
    }
  } else {
    const dw = screenW + BEZEL * 2 + 40
    const dh = screenH + BEZEL * 2 + 40
    scale = Math.min((vp.w - 120) / dw, (vp.h - 24) / dh, 1.08)
    scale = Math.max(0.35, scale)
  }

  // rotation animation: device appears to turn 90°
  useLayoutEffect(() => {
    if (prevOrientation.current === orientation || !deviceRef.current) {
      prevOrientation.current = orientation
      return
    }
    const dir = orientation === 'landscape' ? 90 : -90
    deviceRef.current.animate(
      [{ transform: `rotate(${dir}deg)`, filter: 'blur(0px)' }, { transform: 'rotate(0deg)' }],
      { duration: 520, easing: 'cubic-bezier(.2,.85,.25,1)' },
    )
    prevOrientation.current = orientation
  }, [orientation])

  return (
    <div className={`host ${fullscreen ? 'fullscreen' : ''}`} data-host-theme={theme}>
      <div className="device-stage" style={{ transform: `scale(${scale})`, width: fullscreen ? screenW : undefined }}>
        <div className="device" ref={deviceRef}>
          {!fullscreen && <DeviceButtons landscape={landscape} />}
          <Screen width={screenW} height={screenH} fullscreen={fullscreen} />
        </div>
      </div>
      {!fullscreen && <HostPanel />}
      {!fullscreen && (
        <div className="host-caption">
          iOS 27 Simulator — an unofficial, educational recreation of the iOS 27 experience. Not affiliated with or endorsed by Apple. All people, businesses and data are fictional.
        </div>
      )}
    </div>
  )
}

function DeviceButtons({ landscape }: { landscape: boolean }) {
  // In landscape the frame is rotated: buttons move to top/bottom edges.
  const hold = useRef<number | undefined>(undefined)
  const held = useRef(false)
  const side = {
    onPointerDown: () => {
      held.current = false
      hold.current = window.setTimeout(() => {
        held.current = true
        holdSide()
      }, 500)
    },
    onPointerUp: () => {
      window.clearTimeout(hold.current)
      if (!held.current) pressSide()
    },
    onPointerLeave: () => window.clearTimeout(hold.current),
  }
  if (landscape) {
    return (
      <>
        <button className="device-btn" style={{ bottom: -4, left: 140, width: 44, height: 5 }} aria-label="Action button" onClick={pressAction} />
        <button className="device-btn" style={{ bottom: -4, left: 200, width: 64, height: 5 }} aria-label="Volume up" onClick={() => volumeStep(1)} />
        <button className="device-btn" style={{ bottom: -4, left: 280, width: 64, height: 5 }} aria-label="Volume down" onClick={() => volumeStep(-1)} />
        <button className="device-btn" style={{ top: -4, left: 230, width: 96, height: 5 }} aria-label="Side button" {...side} />
      </>
    )
  }
  return (
    <>
      <button className="device-btn left" style={{ top: 140, height: 44 }} aria-label="Action button" onClick={pressAction}>
        <span className="tip">Action button</span>
      </button>
      <button className="device-btn left" style={{ top: 208, height: 64 }} aria-label="Volume up" onClick={() => volumeStep(1)}>
        <span className="tip">Volume +</span>
      </button>
      <button className="device-btn left" style={{ top: 286, height: 64 }} aria-label="Volume down" onClick={() => volumeStep(-1)}>
        <span className="tip">Volume −</span>
      </button>
      <button className="device-btn right" style={{ top: 230, height: 96 }} aria-label="Side button (hold for Siri)" {...side}>
        <span className="tip">Side button · hold for Siri</span>
      </button>
      <button className="device-btn right" style={{ top: 520, height: 70, width: 4, opacity: 0.6 }} aria-label="Camera Control" onClick={() => useOS.getState().launch('camera')}>
        <span className="tip">Camera Control</span>
      </button>
    </>
  )
}

function HostPanel() {
  const theme = useOS((s) => s.theme)
  const locked = useOS((s) => s.locked)
  const btn = (icon: React.ReactNode, tip: string, onClick: () => void, pressed?: boolean) => (
    <button onClick={onClick} aria-label={tip} aria-pressed={pressed}>
      {icon}
      <span className="tip">{tip}</span>
    </button>
  )
  return (
    <nav className="host-panel" aria-label="Simulator controls">
      {btn(<Home size={19} />, 'Home (Alt+H)', pressHome)}
      {btn(<Lock size={19} />, locked ? 'Wake / Unlock (Alt+L)' : 'Lock (Alt+L)', pressSide, locked)}
      {btn(<Mic size={19} />, 'Siri (Alt+S)', () => openSiri())}
      {btn(<LayoutGrid size={19} />, 'App Switcher (Alt+A)', () => !locked && useOS.getState().toggleOverlay('switcher'))}
      {btn(<SlidersHorizontal size={19} />, 'Control Center (Alt+C)', () => useOS.getState().toggleOverlay('cc'))}
      {btn(<Bell size={19} />, 'Notification Center (Alt+N)', () => useOS.getState().toggleOverlay('nc'))}
      {btn(<Search size={19} />, 'Search or Ask (Alt+Space)', () => !locked && useOS.getState().toggleOverlay('spotlight'))}
      <div className="sep" />
      {btn(<Volume2 size={19} />, 'Volume up', () => volumeStep(1))}
      {btn(<Volume1 size={19} />, 'Volume down', () => volumeStep(-1))}
      {btn(<Camera size={19} />, 'Camera Control', () => useOS.getState().launch('camera'))}
      {btn(<RotateCw size={19} />, 'Rotate (Alt+R)', rotate)}
      {btn(theme === 'dark' ? <Sun size={19} /> : <Moon size={19} />, 'Toggle appearance (Alt+D)', () => useOS.getState().set({ theme: theme === 'dark' ? 'light' : 'dark' }))}
      <div className="sep" />
      {btn(<Info size={19} />, 'Tips: swipe down top-right for Control Center, top-left for notifications, up from the bottom bar to go home', () => useOS.getState().showToast('Swipe from the top-right corner for Control Center'))}
      {btn(<RefreshCcw size={19} />, 'Reset simulator data', () => {
        if (confirm('Reset all simulator data and settings?')) useOS.getState().resetAll()
      })}
    </nav>
  )
}
