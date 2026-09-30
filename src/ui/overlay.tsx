import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type CSSProperties } from 'react'
import { create } from 'zustand'
import { X } from 'lucide-react'
import { springs, animateSpring } from '../os/spring'
import { useDrag, screenScale } from '../os/hooks'
import { Glass } from './controls'

/** Keeps a component mounted while its exit animation plays (call `done` when finished). */
export function usePresence(open: boolean): [boolean, () => void] {
  const [mounted, setMounted] = useState(open)
  useEffect(() => {
    if (open) setMounted(true)
  }, [open])
  return [mounted || open, () => !open && setMounted(false)]
}

// ======================= Bottom sheet =======================

export function Sheet({
  open,
  onClose,
  children,
  title,
  leading,
  trailing,
  detent = 'large',
  glassy,
  style,
  closeButton = true,
  className = '',
  label,
}: {
  open: boolean
  onClose: () => void
  children: ReactNode
  title?: ReactNode
  leading?: ReactNode
  trailing?: ReactNode
  detent?: 'medium' | 'large' | 'auto' | 'full'
  glassy?: boolean
  style?: CSSProperties
  closeButton?: boolean
  className?: string
  label?: string
}) {
  const [render, setRender] = useState(open)
  const ref = useRef<HTMLDivElement>(null)
  const dimRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) setRender(true)
  }, [open])

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    if (open) {
      animateSpring(el, [{ transform: 'translateY(105%)' }, { transform: 'translateY(0)' }], springs.sheet(), { fill: 'none' })
      if (dimRef.current) dimRef.current.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 250, fill: 'none' })
    } else if (render) {
      const a = animateSpring(el, [{ transform: getComputedStyle(el).transform === 'none' ? 'translateY(0)' : getComputedStyle(el).transform }, { transform: 'translateY(105%)' }], springs.sheet())
      dimRef.current?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 220, fill: 'forwards' })
      a.onfinish = () => setRender(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, render])

  const onDrag = useDrag({
    onStart: (e) => {
      const t = e.target as HTMLElement
      return !!t.closest('.sheet-drag')
    },
    onMove: (_dx, dy) => {
      if (ref.current) ref.current.style.transform = `translateY(${Math.max(0, dy)}px)`
    },
    onEnd: (_dx, dy, _vx, vy) => {
      const el = ref.current!
      if (dy > 140 || vy > 700) {
        onClose()
      } else {
        el.style.transform = ''
        animateSpring(el, [{ transform: `translateY(${Math.max(0, dy)}px)` }, { transform: 'translateY(0)' }], springs.sheet(), { fill: 'none' })
      }
    },
  })

  if (!open && !render) return null
  const h = detent === 'medium' ? '52%' : detent === 'auto' ? 'auto' : detent === 'full' ? 'calc(100% - 0px)' : 'calc(100% - var(--safe-top) - 12px)'
  return (
    <>
      <div className="dim" ref={dimRef} onClick={onClose} style={{ pointerEvents: open ? undefined : 'none', ...(detent === 'medium' || detent === 'auto' ? { background: 'rgb(0 0 0 / 0.12)' } : {}) }} />
      <div
        ref={ref}
        className={`sheet ${detent === 'large' || detent === 'full' ? 'large' : ''} ${glassy || detent === 'medium' || detent === 'auto' ? 'glassy' : ''} ${className}`}
        style={{ height: h, maxHeight: 'calc(100% - var(--safe-top))', ...style }}
        role="dialog"
        aria-modal="true"
        aria-label={label ?? (typeof title === 'string' ? title : 'Sheet')}
        onPointerDown={onDrag}
      >
        <div className="sheet-drag">
          <div className="grabber" />
          {(title || leading || trailing || closeButton) && (
            <div className="sheet-header">
              <div style={{ minWidth: 44 }}>
                {leading ?? (closeButton && (
                  <button className="bar-btn icon glass interactive" onClick={onClose} aria-label="Close">
                    <X size={20} strokeWidth={2.5} />
                  </button>
                ))}
              </div>
              <div className="title">{title}</div>
              <div style={{ minWidth: 44, display: 'flex', justifyContent: 'flex-end' }}>{trailing}</div>
            </div>
          )}
        </div>
        <div className="sheet-body scroll">{children}</div>
      </div>
    </>
  )
}

// ======================= Context menu + alerts (global hosts) =======================

export interface MenuItem {
  label: string
  icon?: ReactNode
  destructive?: boolean
  onSelect?: () => void
  separatorBefore?: boolean
  disabled?: boolean
}

interface MenuState {
  menu: null | { x: number; y: number; w: number; h: number; items: MenuItem[]; preview?: ReactNode; title?: string }
  alert: null | { title: string; message?: string; actions: { label: string; style?: 'default' | 'cancel' | 'destructive'; onPress?: () => void }[]; input?: { placeholder: string; value: string } }
  openMenu: (anchor: HTMLElement, items: MenuItem[], opts?: { preview?: ReactNode; title?: string }) => void
  closeMenu: () => void
  showAlert: (a: NonNullable<MenuState['alert']>) => void
  closeAlert: () => void
}

export const useOverlays = create<MenuState>((set) => ({
  menu: null,
  alert: null,
  openMenu: (anchor, items, opts) => {
    const screen = document.querySelector('.screen') as HTMLElement
    const sr = screen.getBoundingClientRect()
    const r = anchor.getBoundingClientRect()
    const s = screenScale()
    set({ menu: { x: (r.left - sr.left) / s, y: (r.top - sr.top) / s, w: r.width / s, h: r.height / s, items, preview: opts?.preview, title: opts?.title } })
  },
  closeMenu: () => set({ menu: null }),
  showAlert: (alert) => set({ alert }),
  closeAlert: () => set({ alert: null }),
}))

export const openMenu = (...a: Parameters<MenuState['openMenu']>) => useOverlays.getState().openMenu(...a)
export const showAlert = (a: NonNullable<MenuState['alert']>) => useOverlays.getState().showAlert(a)

export function OverlayHost() {
  const { menu, alert, closeMenu, closeAlert } = useOverlays()
  const menuRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ left: number; top: number; origin: string } | null>(null)

  useLayoutEffect(() => {
    if (!menu || !menuRef.current) return setPos(null)
    const screen = document.querySelector('.screen') as HTMLElement
    const W = screen.offsetWidth
    const H = screen.offsetHeight
    const mh = menuRef.current.offsetHeight
    const mw = menuRef.current.offsetWidth
    let top = menu.y + menu.h + 10
    let origin = 'top'
    if (top + mh > H - 40) {
      top = menu.y - mh - 10
      origin = 'bottom'
    }
    if (top < 60) top = Math.max(60, H / 2 - mh / 2)
    let left = menu.x + menu.w / 2 - mw / 2
    left = Math.max(12, Math.min(W - mw - 12, left))
    setPos({ left, top, origin: `${menu.x + menu.w / 2 - left}px ${origin}` })
  }, [menu])

  useEffect(() => {
    if (!menu && !alert) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        closeMenu()
        closeAlert()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [menu, alert, closeMenu, closeAlert])

  return (
    <>
      {menu && (
        <>
          <div className="menu-backdrop" onClick={closeMenu} onContextMenu={(e) => { e.preventDefault(); closeMenu() }} />
          {menu.preview && (
            <div className="menu-preview anim-pop" style={{ left: menu.x, top: menu.y, width: menu.w, height: menu.h }}>
              {menu.preview}
            </div>
          )}
          <Glass
            className="menu anim-pop"
            variant="heavy"
            role="menu"
            style={{ left: pos?.left ?? -999, top: pos?.top ?? -999, transformOrigin: pos?.origin }}
          >
            <div ref={menuRef}>
              {menu.title && <div className="menu-title">{menu.title}</div>}
              {menu.items.map((it, i) => (
                <div key={i}>
                  {it.separatorBefore && <div className="menu-sep" />}
                  <button
                    role="menuitem"
                    className={it.destructive ? 'destructive' : ''}
                    disabled={it.disabled}
                    style={it.disabled ? { opacity: 0.4 } : undefined}
                    onClick={() => {
                      closeMenu()
                      it.onSelect?.()
                    }}
                  >
                    <span>{it.label}</span>
                    {it.icon}
                  </button>
                </div>
              ))}
            </div>
          </Glass>
        </>
      )}
      {alert && (
        <>
          <div className="dim" style={{ zIndex: 955 }} />
          <Glass className="alert anim-pop" variant="heavy" role="alertdialog" aria-label={alert.title}>
            <h3>{alert.title}</h3>
            {alert.message && <p>{alert.message}</p>}
            <div className={`alert-actions ${alert.actions.length > 2 ? 'vertical' : ''}`}>
              {alert.actions.map((a, i) => (
                <button
                  key={i}
                  className={`btn ${a.style === 'destructive' ? 'destructive' : a.style === 'cancel' ? 'gray' : 'filled'}`}
                  onClick={() => {
                    closeAlert()
                    a.onPress?.()
                  }}
                  autoFocus={i === alert.actions.length - 1}
                >
                  {a.label}
                </button>
              ))}
            </div>
          </Glass>
        </>
      )}
    </>
  )
}
