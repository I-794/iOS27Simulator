import { Lightbulb, Thermometer, Lock, LockOpen, Video, Fan, Plug, Speaker, Blinds, Activity, Tv, Warehouse, Sun, DoorOpen, House, Moon, BookOpen } from 'lucide-react'
import { useEffect, type ReactNode } from 'react'
import { useShell } from '../../shell/shellState'
import { useOS } from '../../os/store'
import { HOME_SCENES } from '../../os/data/world'
import type { HomeAccessory } from '../../os/types'

export type Acc = HomeAccessory

export function accIcon(a: Acc, size = 22): ReactNode {
  switch (a.kind) {
    case 'light': return <Lightbulb size={size} fill={a.on ? 'currentColor' : 'none'} />
    case 'thermostat': return <Thermometer size={size} />
    case 'lock': return a.locked ? <Lock size={size} /> : <LockOpen size={size} />
    case 'camera': return <Video size={size} />
    case 'fan': return <Fan size={size} className={a.on ? 'hm-spin' : ''} />
    case 'outlet': return <Plug size={size} />
    case 'speaker': return <Speaker size={size} />
    case 'blinds': return <Blinds size={size} />
    case 'sensor': return <Activity size={size} />
    case 'tv': return <Tv size={size} />
    case 'garage': return <Warehouse size={size} />
  }
}

export function isActive(a: Acc): boolean {
  if (a.kind === 'lock') return !a.locked
  if (a.kind === 'garage') return a.value === 'Open'
  if (a.kind === 'thermostat') return a.mode !== 'off'
  if (a.kind === 'blinds') return parseInt(a.value ?? '0') > 0
  if (a.kind === 'sensor') return a.value === 'Open'
  if (a.kind === 'camera') return !!a.on
  return !!a.on
}

export function accStatus(a: Acc): string {
  if (a.reachable === false) return 'No Response'
  switch (a.kind) {
    case 'light': return a.on ? `${a.brightness ?? 100}%` : 'Off'
    case 'thermostat': return a.mode === 'off' ? `Off · ${a.temp}°` : `${a.mode === 'heat' ? 'Heating' : a.mode === 'cool' ? 'Cooling' : 'Auto'} to ${a.target}°`
    case 'lock': return a.locked ? 'Locked' : 'Unlocked'
    case 'garage': return a.value ?? 'Closed'
    case 'blinds': return a.value ?? 'Closed'
    case 'sensor': return a.value ?? 'Closed'
    case 'camera': return a.on ? 'Live' : 'Off'
    case 'fan': return a.on ? `On · ${a.value ?? 'Medium'}` : 'Off'
    case 'speaker': return a.on ? 'Playing' : 'Paused'
    case 'tv': return a.on ? 'On' : 'Off'
    default: return a.on ? 'On' : 'Off'
  }
}

export function tint(a: Acc): string {
  switch (a.kind) {
    case 'light': return a.color ?? '#ffd60a'
    case 'thermostat': return a.mode === 'cool' ? '#0a84ff' : '#ff9f0a'
    case 'lock': return '#30b0c7'
    case 'garage': return '#30b0c7'
    case 'fan': return '#30b0c7'
    case 'outlet': return '#30d158'
    case 'tv': return '#5e5ce6'
    case 'speaker': return '#8e8e93'
    case 'blinds': return '#ff9f0a'
    case 'sensor': return '#ff453a'
    default: return '#ffd60a'
  }
}

export function patchAcc(id: string, patch: Partial<Acc>) {
  const st = useOS.getState()
  st.set({ accessories: st.accessories.map((a) => (a.id === id ? { ...a, ...patch } : a)) })
}

/** Primary tap action. Returns true if it toggled. */
export function quickToggle(a: Acc): boolean {
  switch (a.kind) {
    case 'light': case 'outlet': case 'fan': case 'tv': case 'speaker':
      patchAcc(a.id, { on: !a.on })
      return true
    case 'lock':
      patchAcc(a.id, { locked: !a.locked })
      return true
    case 'garage':
      patchAcc(a.id, { value: a.value === 'Open' ? 'Closing…' : 'Opening…' })
      window.setTimeout(() => {
        const cur = useOS.getState().accessories.find((x) => x.id === a.id)
        patchAcc(a.id, { value: cur?.value === 'Opening…' ? 'Open' : 'Closed', locked: cur?.value !== 'Opening…' })
      }, 1600)
      return true
    case 'blinds':
      patchAcc(a.id, { value: parseInt(a.value ?? '0') > 0 ? 'Closed' : '100% open' })
      return true
    default:
      return false
  }
}

export const SCENE_ICON: Record<string, ReactNode> = {
  sun: <Sun size={20} />, door: <DoorOpen size={20} />, home: <House size={20} />, moon: <Moon size={20} />, book: <BookOpen size={20} />,
}

export function runScene(id: string) {
  const sc = HOME_SCENES.find((s) => s.id === id)
  if (!sc) return
  const st = useOS.getState()
  const map = sc.set as unknown as Record<string, boolean | string>
  st.set({
    accessories: st.accessories.map((a) => {
      if (!(a.id in map)) return a
      const v = map[a.id]
      if (v === 'lock') return { ...a, locked: true }
      if (v === 'unlock') return { ...a, locked: false }
      return { ...a, on: !!v }
    }),
  })
  st.showToast(`${sc.name} scene ran · ${Object.keys(map).length} accessories`)
}

export function sceneActive(id: string, accs: Acc[]): boolean {
  const sc = HOME_SCENES.find((s) => s.id === id)
  if (!sc) return false
  return Object.entries(sc.set as unknown as Record<string, boolean | string>).every(([k, v]) => {
    const a = accs.find((x) => x.id === k)
    if (!a) return true
    if (v === 'lock') return !!a.locked
    return !!a.on === !!v
  })
}

export const CAMERA_LIVE: Record<string, string> = { 'Front Door': 'porch-package', Driveway: 'driveway-car', Backyard: 'yard-dog' }
export const ROOM_ART: Record<string, number> = { 'Living Room': 28, Kitchen: 40, 'Jamie’s Room': 265, Garage: 210, 'Front Porch': 18, Backyard: 130 }

/** Light status bar while a dark full-bleed page is on screen and Home is foreground. */
export function useLightStatusBar(enabled = true) {
  const active = useOS((s) => s.openApp === 'home') && enabled
  useEffect(() => {
    if (!active) return
    useShell.getState().set({ statusOverride: 'light' })
    return () => useShell.getState().set({ statusOverride: null })
  }, [active])
}
