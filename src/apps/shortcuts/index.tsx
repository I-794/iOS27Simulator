import { useEffect, useMemo, useRef, useState } from 'react'
import { Plus, MoreHorizontal, LayoutGrid, Workflow, Sparkles, Play, Pencil, Copy, Trash2, ArrowUp, ChevronRight, Check } from 'lucide-react'
import { NavStack, Page, useNav, TabBar } from '../../ui/nav'
import { SearchField, Switch, AISparkle, Glass } from '../../ui/controls'
import { Sheet, openMenu, showAlert } from '../../ui/overlay'
import { useOS, uid } from '../../os/store'
import { useAppRoute, useLongPress } from '../../os/hooks'
import type { Shortcut } from '../../os/types'
import { Editor, patchShortcut } from './Editor'
import { RunSheet } from './RunSheet'
import { composeShortcut, DESCRIBE_EXAMPLES } from './compose'
import { tileIcon, triggerMeta, useShortcutsLocal, seedShortcuts, TRIGGER_TYPES } from './local'
import { countActions, defOf, makeAction } from './actions'
import { GALLERY, type GalleryItem } from './gallery'
import './shortcuts.css'

type Tab = 'shortcuts' | 'automation' | 'gallery'

export default function ShortcutsApp() {
  return (
    <div className="app-root shc">
      <NavStack root={<Root />} />
    </div>
  )
}

function Root() {
  const nav = useNav()
  const [tab, setTab] = useState<Tab>('shortcuts')
  const [running, setRunning] = useState<Shortcut | null>(null)
  const seeded = useShortcutsLocal((s) => s.seeded)
  useEffect(() => { if (!seeded) seedShortcuts() }, [seeded])

  const edit = (id: string, extra?: { building?: boolean; understood?: string[] }) => nav.push(<Editor id={id} building={extra?.building} understood={extra?.understood} />)
  const run = (sc: Shortcut) => setRunning(sc)

  useAppRoute('shortcuts', (route) => {
    const [kind, id] = route.split('/')
    const sc = useOS.getState().shortcuts.find((s) => s.id === id || s.name.toLowerCase() === decodeURIComponent(id ?? '').toLowerCase())
    nav.popToRoot()
    setTab('shortcuts')
    if (kind === 'run' && sc) window.setTimeout(() => setRunning(sc), 250)
    if (kind === 'edit' && sc) edit(sc.id)
  })

  const tabbar = (
    <TabBar<Tab>
      tabs={[
        { id: 'shortcuts', label: 'Shortcuts', icon: <LayoutGrid size={24} /> },
        { id: 'automation', label: 'Automation', icon: <Workflow size={24} /> },
        { id: 'gallery', label: 'Gallery', icon: <Sparkles size={24} /> },
      ]}
      value={tab}
      onChange={setTab}
    />
  )

  return (
    <>
      {tab === 'shortcuts' && <ShortcutsTab footer={tabbar} onRun={run} onEdit={edit} />}
      {tab === 'automation' && <AutomationTab footer={tabbar} onEdit={edit} />}
      {tab === 'gallery' && <GalleryTab footer={tabbar} onEdit={edit} onDescribe={() => setTab('shortcuts')} />}
      <RunSheet shortcut={running} onClose={() => setRunning(null)} onEdit={(id) => edit(id)} />
    </>
  )
}

// ---------------------------------------------------------------- Shortcuts tab
function ShortcutsTab({ footer, onRun, onEdit }: { footer: React.ReactNode; onRun: (s: Shortcut) => void; onEdit: (id: string, extra?: { building?: boolean; understood?: string[] }) => void }) {
  const shortcuts = useOS((s) => s.shortcuts)
  const [q, setQ] = useState('')
  const [desc, setDesc] = useState('')
  const [thinking, setThinking] = useState(false)
  const ql = q.trim().toLowerCase()
  const list = shortcuts.filter((s) => !ql || s.name.toLowerCase().includes(ql) || s.actions.some((a) => a.label.toLowerCase().includes(ql)))

  const create = (text: string) => {
    const t = text.trim()
    if (!t || thinking) return
    setThinking(true)
    ;(document.activeElement as HTMLElement | null)?.blur?.()
    window.setTimeout(() => {
      const c = composeShortcut(t)
      const sc: Shortcut = { id: uid('sh'), name: c.name, color: c.color, icon: c.icon, trigger: c.trigger, actions: c.actions, description: t }
      const st = useOS.getState()
      st.set({ shortcuts: [...st.shortcuts, sc] })
      setThinking(false)
      setDesc('')
      onEdit(sc.id, { building: true, understood: c.understood })
    }, 900)
  }

  const newBlank = () => {
    const sc: Shortcut = { id: uid('sh'), name: 'New Shortcut', color: '#0a84ff', icon: 'bolt', actions: [] }
    const st = useOS.getState()
    st.set({ shortcuts: [...st.shortcuts, sc] })
    onEdit(sc.id)
  }

  return (
    <Page
      title="Shortcuts"
      bottomExtra={80}
      footer={footer}
      trailing={<button className="bar-btn icon glass interactive" aria-label="New Shortcut" onClick={newBlank}><Plus size={22} /></button>}
    >
      <div className={`shc-describe ${thinking ? 'ai-glow' : ''}`}>
        <div className="row gap6 shc-describe-head"><AISparkle size={17} /><span>Describe a Shortcut</span><span className="shc-new">NEW</span></div>
        <div className="shc-describe-field">
          <textarea
            className="shc-describe-input"
            rows={2}
            placeholder="When I leave school, text Dad that I’m heading home…"
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); create(desc) } }}
            data-send-on-enter="1"
            aria-label="Describe a shortcut"
            data-dictation={DESCRIBE_EXAMPLES.slice(0, 3).join('|')}
          />
          <button className="shc-describe-go" aria-label="Create shortcut" disabled={!desc.trim() || thinking} onClick={() => create(desc)}>
            {thinking ? <span className="shc-dots"><i /><i /><i /></span> : <ArrowUp size={18} strokeWidth={3} />}
          </button>
        </div>
        <div className="shc-examples scroll">
          {DESCRIBE_EXAMPLES.map((ex) => <button key={ex} onClick={() => { setDesc(ex); create(ex) }}>{ex}</button>)}
        </div>
      </div>

      <div style={{ padding: '6px 16px 12px' }}><SearchField value={q} onChange={setQ} placeholder="Search Shortcuts" /></div>
      <div className="list-header" style={{ paddingTop: 4 }}>All Shortcuts · {list.length}</div>
      <div className="shc-grid">
        {list.map((s, i) => <Tile key={s.id} s={s} i={i} onRun={() => onRun(s)} onEdit={() => onEdit(s.id)} />)}
        {!ql && (
          <button className="shc-tile shc-tile-new pressable" onClick={newBlank}><Plus size={26} /><span>New Shortcut</span></button>
        )}
      </div>
      {list.length === 0 && ql && <div className="empty-state">No shortcuts match “{q}”.</div>}
    </Page>
  )
}

function Tile({ s, i, onRun, onEdit }: { s: Shortcut; i: number; onRun: () => void; onEdit: () => void }) {
  const I = tileIcon(s.icon)
  const lp = useLongPress((el) => openMenu(el, [
    { label: 'Run', icon: <Play size={17} />, onSelect: onRun },
    { label: 'Edit', icon: <Pencil size={17} />, onSelect: onEdit },
    { label: 'Duplicate', icon: <Copy size={17} />, onSelect: () => { const st = useOS.getState(); st.set({ shortcuts: [...st.shortcuts, { ...structuredClone(s), id: uid('sh'), name: `${s.name} 2`, trigger: undefined }] }) } },
    { label: 'Delete', icon: <Trash2 size={17} />, destructive: true, separatorBefore: true, onSelect: () => showAlert({ title: `Delete “${s.name}”?`, actions: [{ label: 'Cancel', style: 'cancel' }, { label: 'Delete', style: 'destructive', onPress: () => { const st = useOS.getState(); st.set({ shortcuts: st.shortcuts.filter((x) => x.id !== s.id) }) } }] }) },
  ], { title: s.name }))
  const n = countActions(s.actions)
  return (
    <div className="shc-tile pressable anim-up" style={{ ['--tc' as string]: s.color, animationDelay: `${Math.min(i, 10) * 25}ms` }} role="button" tabIndex={0} aria-label={`Run ${s.name}`} onClick={onRun} onKeyDown={(e) => e.key === 'Enter' && onRun()} {...lp}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <span className="shc-tile-icon"><I size={22} color="#fff" /></span>
        <button className="shc-tile-more" aria-label={`Edit ${s.name}`} onClick={(e) => { e.stopPropagation(); onEdit() }}><MoreHorizontal size={18} color="#fff" /></button>
      </div>
      <div className="grow" />
      <div className="shc-tile-name">{s.name}</div>
      <div className="shc-tile-sub">{s.trigger ? triggerMeta(s.trigger).kind : `${n} action${n === 1 ? '' : 's'}`}</div>
    </div>
  )
}

// ---------------------------------------------------------------- Automation tab
function AutomationTab({ footer, onEdit }: { footer: React.ReactNode; onEdit: (id: string) => void }) {
  const shortcuts = useOS((s) => s.shortcuts)
  const disabled = useShortcutsLocal((s) => s.disabled)
  const immediate = useShortcutsLocal((s) => s.immediate)
  const [newOpen, setNewOpen] = useState(false)
  const autos = shortcuts.filter((s) => s.trigger)
  const personal = autos.filter((s) => !/screenshot|notification/i.test(s.trigger!))
  const fresh = autos.filter((s) => /screenshot|notification/i.test(s.trigger!))
  const row = (s: Shortcut) => {
    const m = triggerMeta(s.trigger!)
    const I = m.icon
    const on = !disabled[s.id]
    return (
      <div key={s.id} className="row-item has-icon shc-auto-row" role="listitem" onClick={() => onEdit(s.id)}>
        <span className="shc-auto-ico" style={{ background: m.color }}><I size={17} color="#fff" /></span>
        <span className="row-main">
          <span className="row-title">{s.trigger}</span>
          <span className="row-sub">{on ? `${immediate[s.id] === false ? 'Ask Before Running' : 'Runs Immediately'} · ${s.name}` : `Off · ${s.name}`}</span>
        </span>
        <Switch checked={on} onChange={(v) => useShortcutsLocal.getState().set({ disabled: { ...disabled, [s.id]: !v } })} label={`Enable ${s.trigger}`} />
      </div>
    )
  }
  return (
    <Page title="Automation" bottomExtra={80} footer={footer} grouped trailing={<button className="bar-btn icon glass interactive" aria-label="New Automation" onClick={() => setNewOpen(true)}><Plus size={22} /></button>}>
      {fresh.length > 0 && (
        <>
          <div className="list-header">Screenshot & Notification <span className="shc-new">NEW</span></div>
          <div className="list" role="list">{fresh.map(row)}</div>
          <div className="list-footer">New in iOS 27: run shortcuts when you take a screenshot in an app or when a matching notification arrives.</div>
        </>
      )}
      <div className="list-header">Personal</div>
      <div className="list" role="list">
        {personal.map(row)}
        {personal.length === 0 && <div className="row-item"><span className="row-main secondary">No automations yet</span></div>}
      </div>
      <button className="shc-new-auto pressable" onClick={() => setNewOpen(true)}><Plus size={18} /> New Automation</button>
      <NewAutomationSheet open={newOpen} onClose={() => setNewOpen(false)} onCreated={(id) => { setNewOpen(false); onEdit(id) }} />
    </Page>
  )
}

function NewAutomationSheet({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (id: string) => void }) {
  const shortcuts = useOS((s) => s.shortcuts)
  const [trigger, setTrigger] = useState<string | null>(null)
  useEffect(() => { if (open) setTrigger(null) }, [open])
  const attach = (sc: Shortcut | null) => {
    if (!trigger) return
    if (sc) {
      patchShortcut(sc.id, { trigger })
      onCreated(sc.id)
    } else {
      const id = uid('sh')
      const st = useOS.getState()
      const kind = triggerMeta(trigger).kind
      const actions = kind === 'Screenshot' ? [makeAction('screen'), makeAction('note', { text: '[Screen Content]' })] : kind === 'Notification' ? [makeAction('summarize', { text: '[Screen Content]' }), makeAction('showResult', { text: '[Summary]' })] : []
      st.set({ shortcuts: [...st.shortcuts, { id, name: `${kind} Automation`, color: triggerMeta(trigger).color, icon: 'bolt', trigger, actions }] })
      onCreated(id)
    }
  }
  return (
    <Sheet open={open} onClose={onClose} title={trigger ? 'Choose Shortcut' : 'New Automation'} detent="large" leading={trigger ? <button className="bar-btn glass interactive" onClick={() => setTrigger(null)}>Back</button> : undefined}>
      {!trigger ? (
        TRIGGER_TYPES.map((t) => {
          const m = triggerMeta(t.options[0])
          const I = m.icon
          return (
            <section key={t.kind}>
              <div className="list-header">{t.kind} {t.isNew && <span className="shc-new">NEW</span>}</div>
              <div className="list">
                {t.options.map((o) => (
                  <button key={o} className="row-item has-icon" onClick={() => setTrigger(o)}>
                    <span className="shc-auto-ico" style={{ background: m.color }}><I size={16} color="#fff" /></span>
                    <span className="row-main"><span className="row-title">{o}</span></span>
                    <ChevronRight size={18} className="chev" />
                  </button>
                ))}
              </div>
            </section>
          )
        })
      ) : (
        <>
          <div className="shc-chosen"><span className="t-footnote secondary">When</span><div className="t-headline">{trigger}</div></div>
          <div className="list">
            <button className="row-item" onClick={() => attach(null)}><span className="row-main"><span className="row-title" style={{ color: 'var(--accent)' }}>New Blank Automation</span></span><Plus size={18} className="accent" /></button>
          </div>
          <div className="list-header">My Shortcuts</div>
          <div className="list">
            {shortcuts.map((s) => {
              const I = tileIcon(s.icon)
              return (
                <button key={s.id} className="row-item has-icon" onClick={() => attach(s)}>
                  <span className="shc-auto-ico" style={{ background: s.color }}><I size={16} color="#fff" /></span>
                  <span className="row-main"><span className="row-title">{s.name}</span>{s.trigger && <span className="row-sub">Replaces: {s.trigger}</span>}</span>
                </button>
              )
            })}
          </div>
          <div style={{ height: 30 }} />
        </>
      )}
    </Sheet>
  )
}

// ---------------------------------------------------------------- Gallery tab
function GalleryTab({ footer, onEdit, onDescribe }: { footer: React.ReactNode; onEdit: (id: string) => void; onDescribe: () => void }) {
  const [q, setQ] = useState('')
  const [item, setItem] = useState<GalleryItem | null>(null)
  const ql = q.trim().toLowerCase()
  const groups = useMemo(() => GALLERY.map((g) => ({ ...g, items: g.items.filter((i) => !ql || i.name.toLowerCase().includes(ql) || i.desc.toLowerCase().includes(ql)) })).filter((g) => g.items.length), [ql])
  const scrollRef = useRef<HTMLDivElement>(null)
  return (
    <Page title="Gallery" bottomExtra={80} footer={footer} scrollRef={scrollRef}>
      <div style={{ padding: '0 16px 12px' }}><SearchField value={q} onChange={setQ} placeholder="Search Gallery" /></div>
      {!ql && (
        <button className="shc-hero pressable" onClick={onDescribe}>
          <div className="shc-hero-glow" />
          <div className="row gap6"><AISparkle size={18} color="#fff" /><span className="t-footnote bold" style={{ letterSpacing: 0.4 }}>NEW IN iOS 27</span></div>
          <div className="t-title2" style={{ marginTop: 8 }}>Describe a Shortcut</div>
          <div className="t-subhead" style={{ opacity: 0.85, marginTop: 4 }}>Say what you want in your own words — Apple Intelligence builds an editable shortcut for you.</div>
          <span className="shc-hero-btn">Try It</span>
        </button>
      )}
      {groups.map((g) => (
        <section key={g.title}>
          <div className="list-header big">{g.title}</div>
          <div className="shc-gal-row scroll">
            {g.items.map((it) => {
              const I = tileIcon(it.icon)
              return (
                <button key={it.name} className="shc-gal-card pressable" style={{ ['--tc' as string]: it.color }} onClick={() => setItem(it)}>
                  <span className="shc-tile-icon"><I size={22} color="#fff" /></span>
                  <span className="shc-gal-name">{it.name}</span>
                  <span className="shc-gal-desc">{it.desc}</span>
                </button>
              )
            })}
          </div>
        </section>
      ))}
      <GallerySheet item={item} onClose={() => setItem(null)} onAdded={(id) => { setItem(null); onEdit(id) }} />
    </Page>
  )
}

function GallerySheet({ item, onClose, onAdded }: { item: GalleryItem | null; onClose: () => void; onAdded: (id: string) => void }) {
  const [added, setAdded] = useState(false)
  useEffect(() => setAdded(false), [item])
  if (!item) return <Sheet open={false} onClose={onClose}><div /></Sheet>
  const I = tileIcon(item.icon)
  const add = () => {
    const id = uid('sh')
    const st = useOS.getState()
    st.set({ shortcuts: [...st.shortcuts, { id, name: item.name, color: item.color, icon: item.icon, actions: item.build(), trigger: item.trigger }] })
    setAdded(true)
    st.showToast(`Added “${item.name}”`)
    window.setTimeout(() => onAdded(id), 500)
  }
  const preview = item.build()
  return (
    <Sheet open={!!item} onClose={onClose} detent="large" title="">
      <div className="shc-gal-detail">
        <div className="shc-details-hero" style={{ background: `linear-gradient(160deg, color-mix(in srgb, ${item.color} 70%, #fff), ${item.color})` }}><I size={40} color="#fff" /></div>
        <div className="t-title2 center">{item.name}</div>
        <div className="t-subhead secondary center" style={{ margin: '6px 20px 16px' }}>{item.desc}</div>
        <button className="btn filled block" style={{ height: 50, borderRadius: 25 }} onClick={add} disabled={added}>{added ? <><Check size={18} /> Added</> : <><Plus size={18} /> Add Shortcut</>}</button>
        <div className="list-header" style={{ paddingLeft: 4 }}>{item.trigger ? `Runs: ${item.trigger}` : 'Actions'}</div>
        <Glass className="shc-gal-actions" variant="light">
          {preview.map((a) => {
            const d = defOf(a.kind)
            const AI = d.icon
            return (
              <div key={a.id} className="row gap8 shc-gal-act">
                <span className="shc-ico" style={{ ['--c' as string]: d.color }}><AI size={14} color="#fff" /></span>
                <span className="t-subhead grow">{d.label}</span>
                <span className="t-footnote secondary nowrap" style={{ maxWidth: 150 }}>{Object.values(a.params)[0]}</span>
              </div>
            )
          })}
        </Glass>
      </div>
    </Sheet>
  )
}
