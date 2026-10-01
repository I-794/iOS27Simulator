import { MapPin, Music, Activity, Mic, Image as ImageIcon, X } from 'lucide-react'
import type { JournalEntry } from '../../os/types'

const META = {
  location: { icon: MapPin, color: '#ff3b30' },
  song: { icon: Music, color: '#ff2d55' },
  workout: { icon: Activity, color: '#34c759' },
  audio: { icon: Mic, color: '#ff9500' },
  photo: { icon: ImageIcon, color: '#0a84ff' },
}

export function AttachChip({ a, onRemove }: { a: JournalEntry['attachments'][number]; onRemove?: () => void }) {
  const m = META[a.kind] ?? META.photo
  const I = m.icon
  return (
    <span className="jn-chip" style={{ ['--jc' as string]: m.color }}>
      <I size={13} strokeWidth={2.4} />
      <span className="nowrap">{a.label}</span>
      {onRemove && <button aria-label={`Remove ${a.label}`} onClick={onRemove}><X size={11} strokeWidth={3} /></button>}
    </span>
  )
}
