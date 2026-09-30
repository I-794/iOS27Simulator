import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Play, X, ChevronDown, ChevronUp, GripVertical, Plus, Search, Check, MoreHorizontal, ArrowUp, ArrowDown, Copy, Trash2, Users, Variable as VarIcon, Info, Zap } from 'lucide-react'
import { Page, useNav } from '../../ui/nav'
import { Glass, Switch, SearchField, AISparkle } from '../../ui/controls'
import { Sheet, openMenu, showAlert } from '../../ui/overlay'
import { useOS, uid } from '../../os/store'
import { useDrag } from '../../os/hooks'
import type { Shortcut, ShortcutAction } from '../../os/types'
import {
  ACTIONS, CATEGORIES, CONDITIONS, RECIPIENTS, TILE_COLORS, TILE_ICONS, defOf, optionsOf, makeAction, sentenceParts, textParts, updateAction, removeAction, moveAction,
  insertAt, variablesBefore, parseCondition, fmtCondition, type Loc, type ParamDef, type Category,
} from './actions'
import { tileIcon, triggerMeta, TRIGGER_TYPES, useShortcutsLocal } from './local'
import { RunSheet } from './RunSheet'

interface Ctx {
  sc: Shortcut
  update: (fn: (a: ShortcutAction[]) => ShortcutAction[]) => void
  reveal: number
  order: Map<string, number>
  expanded: Set<string>
  toggle: (id: string) => void
  editParam: (a: ShortcutAction, p: ParamDef, el: HTMLElement, elseIf?: number) => void
  addTo: (loc: Loc) => void
}
const EdCtx = createContext<Ctx>(null as unknown as Ctx)

const VAR_COLOR: Record<string, string> = Object.fromEntries(ACTIONS.filter((a) => a.output).map((a) => [a.output!, a.color]))

export function patchShortcut(id: string, patch: Partial<Shortcut>) {
  const st = useOS.getState()
  st.set({ shortcuts: st.shortcuts.map((s) => (s.id === id ? { ...s, ...patch } : s)) })
}

function flatOrder(list: ShortcutAction[], m = new Map<string, number>()): Map<string, number> {
  for (const a of list) {
    m.set(a.id, m.size)
    if (a.kind === 'if') {
      flatOrder(a.children ?? [], m)
      a.elseIf?.forEach((e, i) => {
        m.set(`${a.id}-elif-${i}`, m.size)
        flatOrder(e.actions, m)
      })
      m.set(`${a.id}-else`, m.size)
      flatOrder(a.otherwise ?? [], m)
      m.set(`${a.id}-end`, m.size)
    }
  }
  return m
}

export function Editor({ id, building, understood }: { id: string; building?: boolean; understood?: string[] }) {
  const nav = useNav()
  const sc = useOS((s) => s.shortcuts.find((x) => x.id === id))
  const [reveal, setReveal] = useState(building ? 0 : 9999)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [addLoc, setAddLoc] = useState<Loc | null>(null)
  const [textEdit, setTextEdit] = useState<{ id: string; key: string; value: string; label: string; elseIf?: number } | null>(null)
  const [details, setDetails] = useState(false)
  const [running, setRunning] = useState<Shortcut | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const order = useMemo(() => flatOrder(sc?.actions ?? []), [sc?.actions])
  const total = order.size

  useEffect(() => {
    if (!building) return
    let n = 0
    const iv = window.setInterval(() => {
      n++
      setReveal(n)
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
      if (n > total) window.clearInterval(iv)
    }, 420)
    return () => window.clearInterval(iv)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!sc) return <Page title="Shortcut" large={false}><div className="empty-state">This shortcut was deleted.</div></Page>

  const update = (fn: (a: ShortcutAction[]) => ShortcutAction[]) => {
    const cur = useOS.getState().shortcuts.find((x) => x.id === id)
    if (cur) patchShortcut(id, { actions: fn(cur.actions) })
  }
  const setParam = (aid: string, key: string, value: string, elseIf?: number) =>
    update((acts) => updateAction(acts, aid, (a) => {
      if (elseIf === undefined) return { ...a, params: { ...a.params, [key]: value } }
      const elif = [...(a.elseIf ?? [])]
      const c = parseCondition(elif[elseIf].condition)
      elif[elseIf] = { ...elif[elseIf], condition: fmtCondition({ ...c, [key]: value }) }
      return { ...a, elseIf: elif }
    }))

  const editParam = (a: ShortcutAction, p: ParamDef, el: HTMLElement, elseIf?: number) => {
    const current = elseIf === undefined ? a.params[p.key] : (parseCondition(a.elseIf![elseIf].condition) as Record<string, string>)[p.key]
    if (p.type === 'text') return setTextEdit({ id: a.id, key: p.key, value: current ?? '', label: p.label ?? `${defOf(a.kind).label} · ${cap(p.key)}`, elseIf })
    if (p.type === 'bool') return setParam(a.id, p.key, current === 'On' ? 'Off' : 'On', elseIf)
    let opts = p.type === 'contact' ? RECIPIENTS : optionsOf(p)
    if (a.kind === 'if' && p.key === 'input') opts = [...new Set([...variablesBefore(sc.actions, a.id), 'Weather', 'Current Focus', 'Battery Level', 'Clipboard'])]
    if (a.kind === 'if' && p.key === 'cond') opts = CONDITIONS
    openMenu(el, opts.map((o) => ({
      label: o,
      icon: o === current ? <Check size={17} /> : p.type === 'contact' && /group/i.test(o) ? <Users size={17} /> : undefined,
      onSelect: () => setParam(a.id, p.key, o, elseIf),
    })), { title: p.type === 'contact' ? 'Recipients · groups supported in iOS 27' : undefined })
  }

  const ctx: Ctx = {
    sc,
    update,
    reveal,
    order,
    expanded,
    toggle: (aid) => setExpanded((s) => { const n = new Set(s); if (n.has(aid)) n.delete(aid); else n.add(aid); return n }),
    editParam,
    addTo: (loc) => setAddLoc(loc),
  }

  const Icon = tileIcon(sc.icon)
  const immediate = useShortcutsLocal.getState().immediate[sc.id] ?? true
  const vars = textEdit ? variablesBefore(sc.actions, textEdit.id) : []
  const isBuilding = reveal <= total

  return (
    <EdCtx.Provider value={ctx}>
      <Page
        large={false}
        scrollRef={scrollRef}
        grouped
        bottomExtra={70}
        inlineTitle={
          <button className="shc-titlebtn" onClick={() => setDetails(true)} aria-label="Shortcut details">
            <span className="shc-mini-icon" style={{ background: sc.color }}><Icon size={14} color="#fff" /></span>
            <span className="nowrap">{sc.name}</span>
            <ChevronDown size={14} strokeWidth={2.6} className="secondary" />
          </button>
        }
        trailing={<button className="bar-btn icon prominent" aria-label="Run shortcut" onClick={() => setRunning(sc)} style={{ background: sc.color }}><Play size={18} fill="#fff" /></button>}
        footer={
          <div className="shc-addbar-wrap">
            <Glass className="shc-addbar interactive" variant="heavy" as="button" onClick={() => setAddLoc({ parent: null, branch: 'children' })} aria-label="Search for actions">
              <Search size={18} /> <span>Search for Actions</span>
            </Glass>
          </div>
        }
      >
        <div className="shc-editor">
          {building && (
            <div className={`shc-building ${isBuilding ? 'ai-glow' : ''}`}>
              <div className="row gap8"><AISparkle size={18} /><span className="t-subhead bold">{isBuilding ? 'Building your shortcut…' : 'Created from your description'}</span></div>
              {!isBuilding && understood && understood.length > 0 && (
                <div className="shc-understood anim-fade">{understood.map((u) => <span key={u}>{u}</span>)}</div>
              )}
              {!isBuilding && <div className="t-footnote secondary" style={{ marginTop: 6 }}>Tap any blue token to change it, drag ⋮⋮ to reorder, or add more actions below.</div>}
            </div>
          )}

          {sc.trigger && (
            <TriggerCard sc={sc} immediate={immediate} visible={reveal > 0 || !building} />
          )}

          <ActionList list={sc.actions} loc={{ parent: null, branch: 'children' }} depth={0} />

          {sc.actions.length === 0 && (
            <div className="shc-empty">
              <Zap size={30} />
              <div className="t-headline">Add actions to get started</div>
              <div className="t-footnote secondary">Search for actions, or go back and describe what you want this shortcut to do.</div>
            </div>
          )}

          {!sc.trigger && !isBuilding && (
            <button className="shc-add-trigger" onClick={(e) => pickTrigger(e.currentTarget, sc)}><Plus size={16} /> Add Automation Trigger</button>
          )}
        </div>

        <AddActionSheet
          open={!!addLoc}
          onClose={() => setAddLoc(null)}
          onPick={(kind) => {
            const loc = addLoc ?? { parent: null, branch: 'children' as const }
            update((acts) => insertAt(acts, loc, makeAction(kind)))
            setAddLoc(null)
            window.setTimeout(() => { if (!loc.parent) scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }) }, 350)
          }}
        />
        <TextSheet
          edit={textEdit}
          vars={vars}
          onClose={() => setTextEdit(null)}
          onSave={(v) => { if (textEdit) setParam(textEdit.id, textEdit.key, v, textEdit.elseIf); setTextEdit(null) }}
        />
        <DetailsSheet sc={sc} open={details} onClose={() => setDetails(false)} onDeleted={() => { setDetails(false); nav.pop() }} />
        <RunSheet shortcut={running} onClose={() => setRunning(null)} />
      </Page>
    </EdCtx.Provider>
  )
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export function pickTrigger(el: HTMLElement, sc: Shortcut) {
  openMenu(el, [
    ...TRIGGER_TYPES.map((t) => ({
      label: `${t.kind}${t.isNew ? ' — New' : ''}`,
      icon: (() => { const M = triggerMeta(t.options[0]); const I = M.icon; return <I size={17} color={M.color} /> })(),
      onSelect: () => window.setTimeout(() => openMenu(el, t.options.map((o) => ({ label: o, icon: o === sc.trigger ? <Check size={17} /> : undefined, onSelect: () => patchShortcut(sc.id, { trigger: o }) })), { title: t.kind }), 60),
    })),
    ...(sc.trigger ? [{ label: 'Remove Trigger', icon: <Trash2 size={17} />, destructive: true, separatorBefore: true, onSelect: () => patchShortcut(sc.id, { trigger: undefined }) }] : []),
  ], { title: 'Run this shortcut automatically when…' })
}

function TriggerCard({ sc, immediate, visible }: { sc: Shortcut; immediate: boolean; visible: boolean }) {
  const meta = triggerMeta(sc.trigger!)
  const I = meta.icon
  const [imm, setImm] = useState(immediate)
  if (!visible) return null
  return (
    <div className="shc-trigger anim-up">
      <div className="row gap8">
        <span className="shc-trig-ico" style={{ background: meta.color }}><I size={16} color="#fff" /></span>
        <span className="t-footnote bold secondary" style={{ textTransform: 'uppercase', letterSpacing: 0.3 }}>When</span>
        {meta.isNew && <span className="shc-new">NEW</span>}
      </div>
      <button className="shc-trig-text" onClick={(e) => pickTrigger(e.currentTarget, sc)}>{sc.trigger}</button>
      <div className="row" style={{ justifyContent: 'space-between', marginTop: 8 }}>
        <span className="t-subhead">Run Immediately</span>
        <Switch checked={imm} onChange={(v) => { setImm(v); const l = useShortcutsLocal.getState(); l.set({ immediate: { ...l.immediate, [sc.id]: v } }) }} label="Run Immediately" />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- action list & blocks
function ActionList({ list, loc, depth }: { list: ShortcutAction[]; loc: Loc; depth: number }) {
  const ctx = useContext(EdCtx)
  return (
    <div className="shc-list">
      {list.map((a) => (a.kind === 'if' ? <IfBlock key={a.id} a={a} depth={depth} /> : <Block key={a.id} a={a} />))}
      {depth > 0 && ctx.reveal > (ctx.order.size || 0) && (
        <button className="shc-branch-add" onClick={() => ctx.addTo(loc)}><Plus size={14} /> Add Action</button>
      )}
    </div>
  )
}

function useReveal(key: string) {
  const ctx = useContext(EdCtx)
  const i = ctx.order.get(key) ?? 0
  return { hidden: i >= ctx.reveal, fresh: ctx.reveal < 9999 && i === ctx.reveal - 1 }
}

function blockMenu(el: HTMLElement, a: ShortcutAction, ctx: Ctx) {
  openMenu(el, [
    { label: 'Move Up', icon: <ArrowUp size={17} />, onSelect: () => ctx.update((acts) => moveAction(acts, a.id, -1)) },
    { label: 'Move Down', icon: <ArrowDown size={17} />, onSelect: () => ctx.update((acts) => moveAction(acts, a.id, 1)) },
    { label: 'Duplicate', icon: <Copy size={17} />, onSelect: () => ctx.update((acts) => {
      const clone = (x: ShortcutAction): ShortcutAction => ({ ...x, id: uid('act'), children: x.children?.map(clone), otherwise: x.otherwise?.map(clone), elseIf: x.elseIf?.map((e) => ({ ...e, actions: e.actions.map(clone) })) })
      const out = structuredClone(acts)
      const walk = (list: ShortcutAction[]): boolean => {
        const i = list.findIndex((x) => x.id === a.id)
        if (i >= 0) { list.splice(i + 1, 0, clone(list[i])); return true }
        return list.some((x) => walk(x.children ?? []) || (x.elseIf ?? []).some((e) => walk(e.actions)) || walk(x.otherwise ?? []))
      }
      walk(out)
      return out
    }) },
    { label: 'About This Action', icon: <Info size={17} />, onSelect: () => showAlert({ title: defOf(a.kind).label, message: defOf(a.kind).desc, actions: [{ label: 'OK' }] }) },
    { label: 'Delete', icon: <Trash2 size={17} />, destructive: true, separatorBefore: true, onSelect: () => ctx.update((acts) => removeAction(acts, a.id)) },
  ])
}

function useReorder(a: ShortcutAction) {
  const ctx = useContext(EdCtx)
  const ref = useRef<HTMLDivElement>(null)
  const onHandle = useDrag({
    onStart: (e) => { e.stopPropagation(); ref.current?.classList.add('dragging'); return true },
    onMove: (_dx, dy) => { if (ref.current) ref.current.style.transform = `translateY(${dy}px) scale(1.02)` },
    onEnd: (_dx, dy) => {
      const el = ref.current
      if (!el) return
      el.classList.remove('dragging')
      el.style.transform = ''
      const steps = Math.round(dy / (el.offsetHeight + 8))
      if (steps) ctx.update((acts) => moveAction(acts, a.id, steps))
    },
  })
  return { ref, onHandle }
}

function Sentence({ a, elseIf }: { a: ShortcutAction; elseIf?: number }) {
  const ctx = useContext(EdCtx)
  const d = defOf(a.kind)
  const sentence = elseIf !== undefined ? 'Otherwise If {input} {cond} {value}' : d.sentence
  const params = elseIf !== undefined ? (parseCondition(a.elseIf![elseIf].condition) as unknown as Record<string, string>) : a.params
  return (
    <span className="shc-sentence">
      {sentenceParts(sentence).map((part, i) => {
        if (part.text) return <span key={i}>{part.text}</span>
        const pdef = d.params.find((p) => p.key === part.param) ?? { key: part.param!, type: 'text' as const }
        const v = params[part.param!] ?? ''
        if (a.kind === 'if' && part.param === 'value' && params.cond === 'has any value') return null
        return <Token key={i} value={v} pdef={pdef} onClick={(el) => ctx.editParam(a, pdef, el, elseIf)} big={a.kind === 'text'} />
      })}
    </span>
  )
}

function Token({ value, pdef, onClick, big }: { value: string; pdef: ParamDef; onClick: (el: HTMLElement) => void; big?: boolean }) {
  const parts = pdef.type === 'text' || pdef.key === 'input' ? textParts(pdef.key === 'input' && !/^\[/.test(value) ? `[${value}]` : value) : [{ text: value }]
  const empty = !value
  return (
    <button className={`shc-token ${big ? 'big' : ''} ${empty ? 'empty' : ''}`} onClick={(e) => { e.stopPropagation(); onClick(e.currentTarget) }}>
      {empty ? cap(pdef.label ?? pdef.key) : parts.map((p, i) =>
        p.variable ? (
          <span key={i} className="shc-var" style={{ ['--vc' as string]: VAR_COLOR[p.variable] ?? '#ff9500' }}><VarIcon size={11} strokeWidth={2.6} />{p.variable}</span>
        ) : <span key={i}>{p.text}</span>,
      )}
      {pdef.type === 'contact' && /group/i.test(value) && <Users size={12} style={{ marginLeft: 3 }} />}
    </button>
  )
}

function Block({ a }: { a: ShortcutAction }) {
  const ctx = useContext(EdCtx)
  const d = defOf(a.kind)
  const { hidden, fresh } = useReveal(a.id)
  const { ref, onHandle } = useReorder(a)
  const more = d.params.filter((p) => p.more)
  const open = ctx.expanded.has(a.id)
  if (hidden) return null
  const I = d.icon
  return (
    <div ref={ref} className={`shc-block anim-up ${fresh ? 'fresh ai-glow' : ''}`} style={{ ['--c' as string]: d.color }} onContextMenu={(e) => { e.preventDefault(); blockMenu(e.currentTarget as HTMLElement, a, ctx) }}>
      <div className="shc-block-row">
        <span className="shc-ico"><I size={15} color="#fff" /></span>
        <div className="grow shc-block-main">
          {d.isNew && <span className="shc-new" style={{ float: 'right' }}>NEW</span>}
          <Sentence a={a} />
        </div>
        <div className="shc-block-tools">
          {more.length > 0 && (
            <button aria-label={open ? 'Show less' : 'Show more'} onClick={() => ctx.toggle(a.id)}>{open ? <ChevronUp size={17} /> : <ChevronDown size={17} />}</button>
          )}
          <button aria-label="Action options" onClick={(e) => blockMenu(e.currentTarget, a, ctx)}><MoreHorizontal size={17} /></button>
          <button aria-label="Delete action" onClick={() => ctx.update((acts) => removeAction(acts, a.id))}><X size={16} /></button>
          <span className="shc-grip" onPointerDown={onHandle} aria-label="Drag to reorder" role="button"><GripVertical size={16} /></span>
        </div>
      </div>
      {open && more.length > 0 && (
        <div className="shc-more anim-fade">
          {more.map((p) => (
            <div key={p.key} className="shc-more-row">
              <span className="t-subhead">{p.label ?? cap(p.key)}</span>
              {p.type === 'bool'
                ? <Switch checked={a.params[p.key] !== 'Off'} onChange={() => ctx.editParam(a, p, document.body)} label={p.label} />
                : <button className="shc-token" onClick={(e) => ctx.editParam(a, p, e.currentTarget)}>{a.params[p.key]}</button>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function CtlRow({ a, kind, children, tools }: { a: ShortcutAction; kind: string; children: ReactNode; tools?: ReactNode }) {
  const { hidden, fresh } = useReveal(kind === 'if' ? a.id : kind)
  if (hidden) return null
  return (
    <div className={`shc-block shc-ctl anim-up ${fresh ? 'fresh ai-glow' : ''}`} style={{ ['--c' as string]: '#8e8e93' }}>
      <div className="shc-block-row">
        {children}
        <div className="shc-block-tools">{tools}</div>
      </div>
    </div>
  )
}

function IfBlock({ a, depth }: { a: ShortcutAction; depth: number }) {
  const ctx = useContext(EdCtx)
  const d = defOf('if')
  const { ref, onHandle } = useReorder(a)
  const I = d.icon
  const addElseIf = () => ctx.update((acts) => updateAction(acts, a.id, (x) => ({ ...x, elseIf: [...(x.elseIf ?? []), { condition: 'Weather contains Sunny', actions: [] }] })))
  return (
    <div className="shc-if" ref={ref}>
      <CtlRow a={a} kind="if" tools={<>
        <button aria-label="Action options" onClick={(e) => blockMenu(e.currentTarget, a, ctx)}><MoreHorizontal size={17} /></button>
        <button aria-label="Delete If" onClick={() => ctx.update((acts) => removeAction(acts, a.id))}><X size={16} /></button>
        <span className="shc-grip" onPointerDown={onHandle} role="button" aria-label="Drag to reorder"><GripVertical size={16} /></span>
      </>}>
        <span className="shc-ico" style={{ background: d.color }}><I size={15} color="#fff" /></span>
        <div className="grow shc-block-main"><Sentence a={a} /></div>
      </CtlRow>
      <div className="shc-branch"><ActionList list={a.children ?? []} loc={{ parent: a.id, branch: 'children' }} depth={depth + 1} /></div>
      {(a.elseIf ?? []).map((_e, i) => (
        <div key={i}>
          <CtlRow a={a} kind={`${a.id}-elif-${i}`} tools={<button aria-label="Remove Otherwise If" onClick={() => ctx.update((acts) => updateAction(acts, a.id, (x) => ({ ...x, elseIf: x.elseIf?.filter((_z, j) => j !== i) })))}><X size={16} /></button>}>
            <span className="shc-new" style={{ marginRight: 2 }}>NEW</span>
            <div className="grow shc-block-main"><Sentence a={a} elseIf={i} /></div>
          </CtlRow>
          <div className="shc-branch"><ActionList list={a.elseIf![i].actions} loc={{ parent: a.id, branch: i }} depth={depth + 1} /></div>
        </div>
      ))}
      <CtlRow a={a} kind={`${a.id}-else`} tools={<button className="shc-elif-add" onClick={addElseIf}><Plus size={13} /> Otherwise If</button>}>
        <div className="grow shc-block-main shc-sentence">Otherwise</div>
      </CtlRow>
      <div className="shc-branch"><ActionList list={a.otherwise ?? []} loc={{ parent: a.id, branch: 'otherwise' }} depth={depth + 1} /></div>
      <CtlRow a={a} kind={`${a.id}-end`}><div className="grow shc-block-main shc-sentence">End If</div></CtlRow>
    </div>
  )
}

// ---------------------------------------------------------------- sheets
function TextSheet({ edit, vars, onClose, onSave }: { edit: { value: string; label: string } | null; vars: string[]; onClose: () => void; onSave: (v: string) => void }) {
  const [v, setV] = useState('')
  const ref = useRef<HTMLTextAreaElement>(null)
  useEffect(() => { if (edit) setV(edit.value) }, [edit])
  const insertVar = (name: string) => {
    const el = ref.current
    const pos = el?.selectionStart ?? v.length
    const next = `${v.slice(0, pos)}[${name}]${v.slice(pos)}`
    setV(next)
    window.setTimeout(() => { el?.focus(); el?.setSelectionRange(pos + name.length + 2, pos + name.length + 2) }, 0)
  }
  return (
    <Sheet open={!!edit} onClose={onClose} detent="auto" title={edit?.label} trailing={<button className="bar-btn icon prominent" aria-label="Save" onClick={() => onSave(v)}><Check size={20} strokeWidth={2.6} /></button>}>
      <div style={{ padding: '4px 16px 26px' }}>
        <textarea ref={ref} className="text-input shc-textarea" rows={3} value={v} onChange={(e) => setV(e.target.value)} autoFocus aria-label="Value" />
        {vars.length > 0 && (
          <>
            <div className="t-footnote secondary" style={{ margin: '12px 4px 8px' }}>Magic Variables</div>
            <div className="shc-varpick">
              {vars.map((x) => <button key={x} className="shc-var" style={{ ['--vc' as string]: VAR_COLOR[x] ?? '#ff9500' }} onClick={() => insertVar(x)}><VarIcon size={11} strokeWidth={2.6} />{x}</button>)}
            </div>
          </>
        )}
      </div>
    </Sheet>
  )
}

export function AddActionSheet({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick: (kind: string) => void }) {
  const [q, setQ] = useState('')
  const [cat, setCat] = useState<Category | 'All'>('All')
  useEffect(() => { if (open) { setQ(''); setCat('All') } }, [open])
  const ql = q.trim().toLowerCase()
  const list = ACTIONS.filter((a) => (cat === 'All' || a.category === cat) && (!ql || a.label.toLowerCase().includes(ql) || a.desc.toLowerCase().includes(ql) || a.category.toLowerCase().includes(ql)))
  const grouped = CATEGORIES.map((c) => ({ c, items: list.filter((a) => a.category === c) })).filter((g) => g.items.length)
  const suggestions = ['screen', 'dataSave', 'model', 'message', 'if'].map(defOf)
  return (
    <Sheet open={open} onClose={onClose} title="Add Action" detent="large">
      <div style={{ padding: '0 16px 8px' }}><SearchField value={q} onChange={setQ} placeholder="Search Actions" /></div>
      <div className="shc-cats scroll">
        {(['All', ...CATEGORIES] as const).map((c) => <button key={c} className={cat === c ? 'on' : ''} onClick={() => setCat(c)}>{c}</button>)}
      </div>
      {!ql && cat === 'All' && (
        <>
          <div className="list-header">Suggestions</div>
          <div className="shc-sugg-grid">
            {suggestions.map((d) => { const I = d.icon; return (
              <button key={d.kind} className="pressable" onClick={() => onPick(d.kind)}>
                <span className="shc-ico" style={{ ['--c' as string]: d.color }}><I size={15} color="#fff" /></span>
                <span className="t-footnote bold">{d.label}</span>
                {d.isNew && <span className="shc-new">NEW</span>}
              </button>
            ) })}
          </div>
        </>
      )}
      {grouped.map((g) => (
        <section key={g.c}>
          <div className="list-header">{g.c}</div>
          <div className="list">
            {g.items.map((d) => { const I = d.icon; return (
              <button key={d.kind} className="row-item has-icon" role="listitem" onClick={() => onPick(d.kind)}>
                <span className="shc-ico" style={{ ['--c' as string]: d.color }}><I size={15} color="#fff" /></span>
                <span className="row-main"><span className="row-title">{d.label} {d.isNew && <span className="shc-new">NEW</span>}</span><span className="row-sub">{d.desc}</span></span>
                <Plus size={18} className="accent" />
              </button>
            ) })}
          </div>
        </section>
      ))}
      {grouped.length === 0 && <div className="empty-state">No actions match “{q}”.</div>}
      <div style={{ height: 30 }} />
    </Sheet>
  )
}

function DetailsSheet({ sc, open, onClose, onDeleted }: { sc: Shortcut; open: boolean; onClose: () => void; onDeleted: () => void }) {
  const [name, setName] = useState(sc.name)
  useEffect(() => { if (open) setName(sc.name) }, [open, sc.name])
  const save = () => { patchShortcut(sc.id, { name: name.trim() || sc.name }); onClose() }
  const I = tileIcon(sc.icon)
  return (
    <Sheet open={open} onClose={save} title="Details" detent="large" trailing={<button className="bar-btn icon prominent" aria-label="Done" onClick={save}><Check size={20} strokeWidth={2.6} /></button>}>
      <div className="shc-details">
        <div className="shc-details-hero" style={{ background: `linear-gradient(160deg, color-mix(in srgb, ${sc.color} 70%, #fff), ${sc.color})` }}><I size={40} color="#fff" /></div>
        <input className="text-input shc-name-input" value={name} onChange={(e) => setName(e.target.value)} aria-label="Shortcut name" onKeyDown={(e) => e.key === 'Enter' && save()} />
        <div className="list-header" style={{ paddingLeft: 16 }}>Color</div>
        <div className="shc-swatches">
          {TILE_COLORS.map((c) => <button key={c} aria-label={`Color ${c}`} className={c === sc.color ? 'on' : ''} style={{ background: c }} onClick={() => patchShortcut(sc.id, { color: c })} />)}
        </div>
        <div className="list-header" style={{ paddingLeft: 16 }}>Glyph</div>
        <div className="shc-glyphs">
          {TILE_ICONS.map((k) => { const G = tileIcon(k); return <button key={k} aria-label={k} className={k === sc.icon ? 'on' : ''} onClick={() => patchShortcut(sc.id, { icon: k })}><G size={20} /></button> })}
        </div>
        <div className="list" style={{ margin: '18px 0 0' }}>
          <button className="row-item" onClick={(e) => pickTrigger(e.currentTarget, sc)}><span className="row-main"><span className="row-title">Automation Trigger</span></span><span className="row-detail nowrap" style={{ maxWidth: 180 }}>{sc.trigger ?? 'None'}</span></button>
          <button className="row-item" onClick={() => {
            const st = useOS.getState()
            const copy = { ...structuredClone(sc), id: uid('sh'), name: `${sc.name} 2`, trigger: undefined }
            st.set({ shortcuts: [...st.shortcuts, copy] })
            st.showToast('Shortcut duplicated')
          }}><span className="row-main"><span className="row-title tint" style={{ color: 'var(--accent)' }}>Duplicate</span></span></button>
          <button className="row-item destructive" onClick={() => showAlert({ title: `Delete “${sc.name}”?`, message: 'This shortcut will be removed from all your devices.', actions: [{ label: 'Cancel', style: 'cancel' }, { label: 'Delete', style: 'destructive', onPress: () => { const st = useOS.getState(); st.set({ shortcuts: st.shortcuts.filter((x) => x.id !== sc.id) }); onDeleted() } }] })}><span className="row-main"><span className="row-title">Delete Shortcut</span></span></button>
        </div>
      </div>
    </Sheet>
  )
}
