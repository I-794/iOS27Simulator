import { useEffect, useState } from 'react'
import { Volume2, VolumeX, Bell, BellOff, AlarmClock, Headphones } from 'lucide-react'
import { useOS } from '../os/store'
import { Glass } from '../ui/controls'

/** iOS-style vertical volume HUD that appears beside the volume buttons. */
export function VolumeHUD() {
  const [show, setShow] = useState<null | 'media' | 'ringer' | 'alarm'>(null)
  const volume = useOS((s) => s.volume)
  const ringer = useOS((s) => s.ringerVolume)
  const alarm = useOS((s) => s.alarmVolume)
  const silent = useOS((s) => s.silent)
  const airpods = useOS((s) => s.airpods.connected && s.net.bluetooth)
  useEffect(() => {
    let t: number | undefined
    const on = (e: Event) => {
      setShow((e as CustomEvent).detail?.kind ?? 'media')
      window.clearTimeout(t)
      t = window.setTimeout(() => setShow(null), 1500)
    }
    window.addEventListener('volume-hud', on)
    return () => window.removeEventListener('volume-hud', on)
  }, [])
  if (!show) return null
  const v = show === 'media' ? volume : show === 'alarm' ? alarm : ringer
  const Icon = show === 'media' ? (airpods ? Headphones : v === 0 ? VolumeX : Volume2) : show === 'alarm' ? AlarmClock : silent ? BellOff : Bell
  return (
    <Glass className="volume-hud anim-pop" variant="heavy" role="status" aria-label={`${show} volume ${Math.round(v * 100)}%`}>
      <div className="vh-track"><div className="vh-fill" style={{ height: `${v * 100}%` }} /></div>
      <Icon size={16} />
      <span className="vh-label">{show === 'media' ? (airpods ? 'AirPods' : 'Media') : show === 'alarm' ? 'Alarm' : 'Ringer'}</span>
    </Glass>
  )
}

export function Toast() {
  const toast = useOS((s) => s.toast)
  if (!toast) return null
  return (
    <Glass className="toast anim-pop" variant="heavy" role="status" key={toast.id}>
      {toast.text}
    </Glass>
  )
}
