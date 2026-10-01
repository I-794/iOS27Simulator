/* Shortcut runner: walks the action chain step by step, performing real effects in the
 * simulated OS (messages, focus, Home, music, reminders, notes…) and resolving magic
 * variables like [Travel Time]. If / Otherwise If / Otherwise branches are evaluated. */
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { Shortcut, ShortcutAction, AppId } from '../../os/types'
import { useOS } from '../../os/store'
import { findContact, doSend, startTimer } from '../../os/ai/siri'
import { speak } from '../../shell/siri/session'
import { summarize } from '../../os/ai/writing'
import { parseReminder, parseDuration } from '../../os/ai/parse'
import { PLAYLISTS, TRACKS } from '../../os/data/media'
import { HOME_SCENES, WEATHER, SAFARI_TABS } from '../../os/data/world'
import { ICONS } from '../../icons/AppIconArt'
import { fmtTime, startOfDay, DAY, MIN } from '../../os/time'
import { defOf, parseCondition, type Loc } from './actions'

// ---------------------------------------------------------------- data store (iOS 27)
interface DataStore { data: Record<string, string>; set: (k: string, v: string) => void }
export const useDataStore = create<DataStore>()(
  persist((set, get) => ({ data: { 'last-run': 'Never' }, set: (k, v) => set({ data: { ...get().data, [k]: v } }) }), { name: 'ios27-shortcuts-data', storage: createJSONStorage(() => localStorage), partialize: (s) => ({ data: s.data }) as unknown as DataStore }),
)

export interface RunStep {
  id: string
  label: string
  detail?: string
  status: 'running' | 'done' | 'skipped' | 'failed'
  depth: number
  color: string
  kind: string
}

export interface RunResult {
  steps: RunStep[]
  result?: string
  open?: { app: AppId; route?: string }
}

const S = () => useOS.getState()
const sleep = (ms: number) => new Promise((r) => window.setTimeout(r, ms))

const ICON_COND: Record<string, string> = { sun: 'Sunny', 'cloud-sun': 'Partly Cloudy', 'cloud-bolt': 'Thunderstorms', 'cloud-rain': 'Rain', cloud: 'Cloudy', moon: 'Clear' }
const ETA_MIN: Record<string, number> = { Home: 14, 'Lincoln High School': 12, 'Grandma’s House': 19, 'Brew Lab Coffee': 7, 'Maple Grove Library': 9, 'Riverside Park': 11, 'Greenfield Mall': 16, 'Lincoln High Practice Field': 12 }

export function resolveVars(text: string, vars: Record<string, string>): string {
  return text.replace(/\[([^\]]+)\]/g, (m, name: string) => vars[name] ?? m)
}

function recipient(to: string): { convId?: string; contactId?: string } {
  if (/drumline/i.test(to)) return { convId: 'c-drumline' }
  const id = findContact(to)
  return id ? { contactId: id } : {}
}

function evalCond(c: { input: string; cond: string; value: string }, vars: Record<string, string>): boolean {
  const left = (vars[c.input.replace(/^\[|\]$/g, '')] ?? resolveVars(c.input, vars)).toLowerCase()
  const right = resolveVars(c.value, vars).toLowerCase()
  switch (c.cond) {
    case 'is': return left === right || (right.startsWith('below') && /\d+/.test(left) && +left.match(/\d+/)![0] < +right.match(/\d+/)![0])
    case 'is not': return left !== right
    case 'does not contain': return !left.includes(right)
    case 'has any value': return !!left.trim()
    default: return left.includes(right)
  }
}

/** Perform one action; returns detail text and optional output value. */
function perform(a: ShortcutAction, vars: Record<string, string>, ctx: { open?: RunResult['open']; result?: string; name: string }): { detail?: string; output?: string } {
  const p = Object.fromEntries(Object.entries(a.params).map(([k, v]) => [k, resolveVars(v, vars)]))
  const st = S()
  switch (a.kind) {
    case 'text': return { detail: p.text, output: p.text }
    case 'eta': {
      const mins = ETA_MIN[p.to] ?? 15
      const eta = Date.now() + (p.mode === 'Walking' ? mins * 3.2 : p.mode === 'Cycling' ? mins * 1.6 : p.mode === 'Transit' ? mins * 1.4 : mins) * MIN
      const val = `${Math.round((eta - Date.now()) / MIN)} min (${fmtTime(eta)})`
      return { detail: `${p.to}: ${val}`, output: val }
    }
    case 'message': {
      const r = recipient(p.to)
      if (r.convId) {
        const id = st.sendMessage(r.convId, { text: p.text })
        window.setTimeout(() => S().patchMessage(r.convId!, id, { status: 'delivered' }), 700)
      } else if (r.contactId) doSend({ to: r.contactId, body: p.text, app: 'messages' })
      else return { detail: `Couldn’t find “${p.to}” in Contacts` }
      return { detail: `To ${p.to}: “${p.text}”` }
    }
    case 'email': {
      const r = recipient(p.to)
      doSend({ to: r.contactId, body: p.text, app: 'mail', subject: ctx.name })
      return { detail: `Email to ${p.to}` }
    }
    case 'weather': {
      if (p.when === 'Tomorrow') {
        const d = WEATHER.daily[1]
        const v = `${ICON_COND[d.icon] ?? 'Clear'}, high ${d.hi}°`
        return { detail: `Tomorrow: ${v}`, output: v }
      }
      if (p.place === 'Seattle') {
        const c = WEATHER.cities[0]
        return { detail: `Seattle: ${c.condition}, ${c.temp}°`, output: `${c.condition}, ${c.temp}°` }
      }
      const v = p.when === 'Today' ? `${WEATHER.condition}, high ${WEATHER.high}°` : `${WEATHER.condition}, ${WEATHER.temp}°`
      return { detail: v, output: v }
    }
    case 'nextEvent': {
      const now = Date.now()
      const day = p.range === 'Tomorrow' ? startOfDay() + DAY : startOfDay()
      const end = p.range === 'This Week' ? startOfDay() + 7 * DAY : day + DAY
      let evs = st.events.filter((e) => e.start >= day && e.start < end).sort((x, y) => x.start - y.start)
      if (p.which === 'Next') evs = evs.filter((e) => e.start > now)
      if (!evs.length) evs = st.events.filter((e) => e.start > now).sort((x, y) => x.start - y.start)
      const list = p.which === 'All' ? evs.slice(0, 4) : evs.slice(0, 1)
      const v = list.map((e) => `${e.title} at ${fmtTime(e.start)}`).join(', ') || 'No events'
      return { detail: v, output: v }
    }
    case 'reminder': {
      const r = parseReminder(`remind me to ${p.title} ${p.when === 'now' ? '' : p.when}`)
      const list = (p.list ?? 'Reminders').toLowerCase()
      st.addReminder({ title: p.title, due: r.due, list: ['school', 'robotics', 'groceries'].includes(list) ? list : 'reminders', source: 'Shortcuts' })
      return { detail: `“${p.title}”${r.due ? ` · ${fmtTime(r.due)}` : ''}` }
    }
    case 'note': {
      const n = st.notes.find((x) => x.title === p.note) ?? st.notes.find((x) => x.title.toLowerCase().includes(p.note.toLowerCase().split(' ')[0]))
      const stamp = new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
      if (n) st.updateNote(n.id, { blocks: [...n.blocks, { t: 'p', text: `${stamp} — ${p.text}` }] })
      else st.addNote({ title: p.note, blocks: [{ t: 'h1', text: p.note }, { t: 'p', text: p.text }], folder: 'Notes' })
      return { detail: `Added to “${n?.title ?? p.note}”` }
    }
    case 'createNote': {
      const t = p.text.split(/[.!?\n]/)[0].slice(0, 40) || 'New Note'
      st.addNote({ title: t, blocks: [{ t: 'h1', text: t }, { t: 'p', text: p.text }], folder: 'Notes' })
      return { detail: `Created “${t}”` }
    }
    case 'music': {
      const pl = PLAYLISTS.find((x) => x.name === p.playlist)
      if (pl) {
        const q = p.shuffle === 'On' ? [...pl.tracks].sort(() => Math.random() - 0.5) : pl.tracks
        st.playTrack(q[0], q, pl.name)
      } else {
        const t = TRACKS.find((x) => x.title.toLowerCase() === p.playlist.toLowerCase()) ?? TRACKS[0]
        st.playTrack(t.id, undefined, t.album)
      }
      return { detail: `Now playing ${p.playlist}` }
    }
    case 'focus': {
      const on = p.state !== 'Off'
      st.set({ focus: on ? (p.focus as NonNullable<ReturnType<typeof S>['focus']>) : null })
      st.flashIsland({ kind: 'focus', title: p.focus, subtitle: on ? 'On' : 'Off' })
      return { detail: `${p.focus} ${on ? 'on' : 'off'}${on && p.until !== 'Turned Off' ? ` until ${p.until}` : ''}` }
    }
    case 'scene': {
      const sc = HOME_SCENES.find((x) => x.name === p.scene)
      if (sc) {
        st.set({ accessories: st.accessories.map((acc) => {
          const v = (sc.set as unknown as Record<string, boolean | string | undefined>)[acc.id]
          if (v === undefined) return acc
          if (v === 'lock') return { ...acc, locked: true }
          return { ...acc, on: !!v }
        }) })
      }
      return { detail: `${p.scene} scene ran` }
    }
    case 'lights': {
      const lvl = p.level === 'Off' ? 0 : parseInt(p.level) || 100
      st.set({ accessories: st.accessories.map((acc) => (acc.kind === 'light' && (p.target === 'All Lights' || acc.room === p.target) ? { ...acc, on: lvl > 0, brightness: lvl || acc.brightness } : acc)) })
      return { detail: `${p.target}: ${p.level}` }
    }
    case 'lock': {
      st.set({ accessories: st.accessories.map((acc) => (acc.kind === 'lock' ? { ...acc, locked: p.state === 'Lock' } : acc)) })
      return { detail: `${p.door} ${p.state === 'Lock' ? 'locked' : 'unlocked'}` }
    }
    case 'timer': {
      const secs = parseDuration(p.duration) ?? 1500
      startTimer(secs, ctx.name)
      return { detail: `${p.duration} timer started` }
    }
    case 'screen': {
      const o = st.siriOnscreen
      const e = o.entity ?? {}
      const tab = SAFARI_TABS[0]
      const text = e.text ? `${e.title ?? ''} — ${e.text}` : e.title ?? o.context ?? `${tab?.title ?? 'Robotics Game Manual'} — scoring rules for the 2026 season`
      const parts = [p.text !== 'Off' && 'text', p.images !== 'Off' && 'images', p.links !== 'Off' && 'links', p.entities !== 'Off' && 'entities'].filter(Boolean)
      return { detail: `Captured ${p.content === 'All Content' ? parts.join(', ') : p.content.toLowerCase()}`, output: text.slice(0, 160) }
    }
    case 'screenshot': {
      useOS.getState().flashIsland({ kind: 'screenshot', title: 'Screenshot' })
      return { detail: 'Screenshot captured', output: 'Screenshot.png' }
    }
    case 'savePhoto': {
      st.addPhoto({ scene: 'screenshot-chart', ts: Date.now(), kind: 'screenshot', keywords: ['screenshot', 'shortcut'], capturedByMe: true, description: `Saved by the ${ctx.name} shortcut`, width: 1206, height: 2622, sizeMB: 1.2 })
      return { detail: `Saved to ${p.album}` }
    }
    case 'dataSave': {
      useDataStore.getState().set(p.key, p.value)
      return { detail: `${p.key} = “${p.value.slice(0, 40)}”` }
    }
    case 'dataGet': {
      const v = useDataStore.getState().data[p.key] ?? ''
      return { detail: v ? `${p.key} = “${v}”` : `No value for ${p.key}`, output: v }
    }
    case 'model': {
      const src = p.prompt
      const out = /summari/i.test(src) ? summarize(resolveVars(src.replace(/^summari[sz]e\s*/i, ''), vars) || src) : `Here’s what I found for “${src.replace(/[.?]$/, '')}”: ${p.model === 'ChatGPT' ? 'ChatGPT suggests' : 'Apple Intelligence suggests'} breaking it into small steps and starting now.`
      return { detail: `${p.model} responded`, output: out }
    }
    case 'summarize': {
      const out = summarize(p.text)
      return { detail: out.slice(0, 80), output: out }
    }
    case 'setVar': return { detail: `${p.name} = ${p.value}`, output: p.value }
    case 'ask': return { detail: `Answered “${p.prompt}” → Sounds good`, output: 'Sounds good' }
    case 'wait': return { detail: p.seconds }
    case 'showResult': ctx.result = p.text; return { detail: p.text }
    case 'speak': speak(p.text); return { detail: `“${p.text}”` }
    case 'notification': st.notify({ app: 'shortcuts', title: ctx.name, body: p.text }); return { detail: p.text }
    case 'openApp': {
      const app = (Object.entries(ICONS).find(([, v]) => v.name === p.app)?.[0] ?? 'music') as AppId
      ctx.open = { app }
      return { detail: `Opening ${p.app}` }
    }
    case 'url': ctx.open = { app: 'safari', route: `url/${p.url}` }; return { detail: p.url }
    case 'appearance': st.set({ theme: p.mode === 'Dark' ? 'dark' : 'light', themeAuto: false }); return { detail: `${p.mode} Mode` }
    case 'lowPower': st.set({ lowPower: p.state === 'On' }); return { detail: `Low Power Mode ${p.state.toLowerCase()}` }
    default: return {}
  }
}

/** Runs a shortcut with an animated step list; `onUpdate` receives the growing step list. */
export async function runShortcut(sc: Shortcut, onUpdate: (r: RunResult) => void, cancelled: () => boolean = () => false): Promise<RunResult> {
  const vars: Record<string, string> = {}
  const steps: RunStep[] = []
  const ctx: { open?: RunResult['open']; result?: string; name: string } = { name: sc.name }
  const emit = () => onUpdate({ steps: steps.map((s) => ({ ...s })), result: ctx.result, open: ctx.open })

  const runList = async (list: ShortcutAction[], depth: number) => {
    for (const a of list) {
      if (cancelled()) return
      const d = defOf(a.kind)
      if (a.kind === 'if') {
        const conds = [{ c: { input: a.params.input, cond: a.params.cond, value: a.params.value }, actions: a.children ?? [], label: 'If' }, ...(a.elseIf ?? []).map((e) => ({ c: parseCondition(e.condition), actions: e.actions, label: 'Otherwise If' }))]
        let taken = false
        for (const br of conds) {
          const step: RunStep = { id: `${a.id}-${br.label}-${steps.length}`, label: `${br.label} ${br.c.input} ${br.c.cond}${br.c.cond === 'has any value' ? '' : ` ${br.c.value}`}`, status: 'running', depth, color: d.color, kind: 'if' }
          steps.push(step)
          emit()
          await sleep(420)
          const ok = evalCond(br.c, vars)
          step.status = 'done'
          step.detail = ok ? 'Yes — running this branch' : 'No'
          emit()
          if (ok) {
            taken = true
            await runList(br.actions, depth + 1)
            break
          }
        }
        if (!taken && a.otherwise?.length) {
          steps.push({ id: `${a.id}-else`, label: 'Otherwise', status: 'done', depth, color: d.color, kind: 'if', detail: 'Running' })
          emit()
          await runList(a.otherwise, depth + 1)
        }
        continue
      }
      const step: RunStep = { id: a.id, label: d.label === 'Action' ? a.label : d.label, status: 'running', depth, color: d.color, kind: a.kind }
      steps.push(step)
      emit()
      await sleep(a.kind === 'wait' ? Math.min(3000, (parseInt(a.params.seconds) || 1) * 1000) : 380 + Math.random() * 320)
      if (cancelled()) return
      try {
        const r = perform(a, vars, ctx)
        if (r.output !== undefined) {
          if (d.output) vars[d.output] = r.output
          if (a.kind === 'setVar') vars[a.params.name] = r.output
        }
        step.detail = r.detail
        step.status = 'done'
      } catch (e) {
        console.warn(e)
        step.status = 'failed'
        step.detail = 'Couldn’t run this action'
      }
      emit()
    }
  }
  await runList(sc.actions, 0)
  useDataStore.getState().set('last-run', `${sc.name} · ${fmtTime(Date.now())}`)
  const res: RunResult = { steps, result: ctx.result, open: ctx.open }
  onUpdate(res)
  return res
}

export type { Loc }
