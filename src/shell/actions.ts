/* Hardware-level actions shared by device buttons, keyboard shortcuts and gestures. */
import { useOS } from '../os/store'

const S = () => useOS.getState()

export function pressHome() {
  const st = S()
  if (!st.screenOn) return st.set({ screenOn: true })
  if (st.locked) return st.unlock()
  if (st.siriActive) return st.set({ siriActive: false })
  if (st.overlay) return st.setOverlay(null)
  if (st.editingHome) return st.set({ editingHome: false })
  if (st.openApp) return st.goHome()
  // on Home Screen: jump to first page
  window.dispatchEvent(new CustomEvent('home-first-page'))
}

export function pressSide() {
  const st = S()
  if (!st.screenOn || st.locked) {
    if (!st.screenOn) return st.set({ screenOn: true })
    // pressing side while awake on lock screen turns screen off
    return st.set({ screenOn: false })
  }
  st.lock()
  st.set({ screenOn: false })
}

export function holdSide() {
  const st = S()
  if (!st.siriSettings.sideButton) return
  if (st.locked && !st.siriSettings.lockScreen) return
  openSiri()
}

export function openSiri(mode: 'voice' | 'type' = 'voice') {
  const st = S()
  st.set({ screenOn: true, siriActive: true, siriMode: mode === 'voice' ? 'listening' : 'idle', overlay: null })
}

export function volumeStep(dir: 1 | -1) {
  const st = S()
  // With a timer/alarm ringing, volume buttons would adjust alarm volume; otherwise media/ringer.
  const media = st.nowPlaying.playing
  if (media) {
    st.set({ volume: Math.min(1, Math.max(0, +(st.volume + dir * 0.0625).toFixed(4))) })
  } else {
    st.set({ ringerVolume: Math.min(1, Math.max(0, +(st.ringerVolume + dir * 0.0625).toFixed(4))) })
  }
  window.dispatchEvent(new CustomEvent('volume-hud', { detail: { kind: media ? 'media' : 'ringer' } }))
}

export function pressAction() {
  const st = S()
  st.set({ screenOn: true })
  switch (st.actionButton) {
    case 'silent': {
      const silent = !st.silent
      st.set({ silent })
      st.flashIsland({ kind: 'silent', title: silent ? 'Silent Mode' : 'Ring', subtitle: silent ? 'On' : 'Off', duration: 1800 })
      break
    }
    case 'flashlight':
      st.set({ flashlight: !st.flashlight })
      break
    case 'camera':
      if (!st.locked) st.launch('camera')
      else st.launch('camera')
      break
    case 'siri':
      openSiri()
      break
    case 'magnifier':
      st.launch('magnifier')
      break
    case 'visual-intelligence':
      st.launch('camera', { route: 'siri' })
      break
    case 'accessibility':
      st.set({ accessibility: { ...st.accessibility, voiceOver: !st.accessibility.voiceOver } })
      st.showToast(`VoiceOver ${!st.accessibility.voiceOver ? 'On' : 'Off'}`)
      break
    case 'translate':
      st.showToast('Translate: listening… (simulated)')
      break
    case 'shortcut':
      st.launch('shortcuts')
      break
  }
}

export function rotate() {
  const st = S()
  if (st.orientationLock && st.orientation === 'portrait') {
    st.flashIsland({ kind: 'generic', title: 'Portrait Orientation Lock', subtitle: 'On', icon: 'lock-rotate', duration: 1800 })
    return
  }
  st.set({ orientation: st.orientation === 'portrait' ? 'landscape' : 'portrait' })
}

export function installKeyboardShortcuts(): () => void {
  const onKey = (e: KeyboardEvent) => {
    const st = S()
    const t = e.target as HTMLElement
    const typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)
    if (e.altKey && !e.metaKey && !e.ctrlKey) {
      const k = e.code
      const map: Record<string, () => void> = {
        KeyH: pressHome,
        KeyL: pressSide,
        KeyS: () => openSiri(),
        KeyC: () => st.toggleOverlay('cc'),
        KeyN: () => st.toggleOverlay('nc'),
        KeyA: () => !st.locked && st.toggleOverlay('switcher'),
        KeyR: rotate,
        KeyD: () => st.set({ theme: st.theme === 'dark' ? 'light' : 'dark' }),
        Space: () => !st.locked && st.toggleOverlay('spotlight'),
      }
      if (map[k]) {
        e.preventDefault()
        map[k]()
      }
      return
    }
    if ((e.metaKey || e.ctrlKey) && e.code === 'Space') {
      e.preventDefault()
      if (!st.locked) st.toggleOverlay('spotlight')
      return
    }
    if (e.key === 'Escape') {
      if (st.siriActive) return st.set({ siriActive: false })
      if (st.shareRequest) return st.set({ shareRequest: null })
      if (st.overlay) return st.setOverlay(null)
      if (typing) return (t as HTMLInputElement).blur()
      // let apps handle back navigation first
      const ev = new CustomEvent('ios-back', { cancelable: true })
      window.dispatchEvent(ev)
      if (!ev.defaultPrevented && st.openApp) st.goHome()
      return
    }
    if (!typing && st.locked && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault()
      st.unlock()
    }
  }
  window.addEventListener('keydown', onKey)
  return () => window.removeEventListener('keydown', onKey)
}
