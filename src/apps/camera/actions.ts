/* Executes Visual Intelligence actions (used by Camera Siri mode and Photos Look Up). */
import { useOS } from '../../os/store'
import type { VisionAction } from '../../os/ai/vision'
import { parseWhen, fmtWhen } from '../../os/ai/parse'
import { MAP_PLACES } from '../../os/data/world'
import { runSiri } from '../../shell/siri/session'
import { HOUR } from '../../os/time'

export function money(n: number) {
  return `$${n.toFixed(2)}`
}

/** Runs an action. Returns a confirmation line to show inline, or null. */
export function runVisionAction(a: VisionAction): string | null {
  const os = useOS.getState()
  switch (a.kind) {
    case 'reminder': {
      const w = a.due ? parseWhen(a.due) : null
      os.addReminder({ title: a.title, due: w?.start, list: 'reminders', source: 'Visual Intelligence' })
      os.showToast('Added to Reminders')
      return `Added reminder “${a.title}”${w ? ` for ${fmtWhen(w.start, !w.hasTime)}` : ''}.`
    }
    case 'event': {
      const w = parseWhen(a.when)
      const start = w?.start ?? Date.now() + 24 * HOUR
      os.addEvent({ title: a.title, start, end: w?.end ?? start + HOUR, calendar: 'personal', location: a.location, source: 'Visual Intelligence' })
      os.showToast('Added to Calendar')
      return `Added “${a.title}” to Calendar ${fmtWhen(start)}.`
    }
    case 'note': {
      os.addNote({ title: a.title, blocks: [{ t: 'p', text: a.body }, { t: 'p', text: 'Captured with Visual Intelligence' }], folder: 'Notes' })
      os.showToast('Saved to Notes')
      return `Saved “${a.title}” to Notes.`
    }
    case 'search':
      os.launch('safari', { route: `search/${a.query}` })
      return null
    case 'shop':
      os.launch('safari', { route: `url/${a.query}` })
      return null
    case 'map': {
      const place = MAP_PLACES.find((p) => p.name.toLowerCase() === a.place.toLowerCase() || a.place.toLowerCase().includes(p.name.toLowerCase()))
      os.launch('maps', place ? { route: `route/${place.id}` } : {})
      return null
    }
    case 'weather':
      os.launch('weather')
      return null
    case 'copy':
      try {
        void navigator.clipboard?.writeText(a.text).catch(() => {})
      } catch {
        /* clipboard optional */
      }
      os.showToast('Copied')
      return `Copied “${a.text.length > 40 ? a.text.slice(0, 40) + '…' : a.text}”.`
    case 'translate':
      return a.text
    case 'ask':
      os.set({ siriActive: true, siriMode: 'thinking' })
      void runSiri(a.prompt, { fromOverlay: true })
      return null
    case 'split':
      return `Split ${a.people} ways, each person owes ${money(a.total / a.people)}.`
    case 'pay':
      return `Request ${money(a.amount)} from ${a.to}.`
  }
}
