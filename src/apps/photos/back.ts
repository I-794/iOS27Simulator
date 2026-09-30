import { useEffect, useRef } from 'react'

/* A tiny stack of Escape/back handlers so the top-most overlay (editor, viewer,
 * slideshow…) closes first, before the NavStack pops. */
const stack: { id: number; fn: () => void; el: () => HTMLElement | null }[] = []
let installed = false
let seq = 0

function install() {
  if (installed) return
  installed = true
  window.addEventListener(
    'ios-back',
    (e) => {
      if (e.defaultPrevented) return
      for (let i = stack.length - 1; i >= 0; i--) {
        const h = stack[i]
        const el = h.el()
        if (!el || !el.isConnected || !el.closest('.app-window.active')) continue
        e.preventDefault()
        e.stopImmediatePropagation()
        h.fn()
        return
      }
    },
    true,
  )
}

export function useBackHandler(active: boolean, fn: () => void, ref: React.RefObject<HTMLElement | null>) {
  const cb = useRef(fn)
  cb.current = fn
  useEffect(() => {
    if (!active) return
    install()
    const id = ++seq
    stack.push({ id, fn: () => cb.current(), el: () => ref.current })
    return () => {
      const i = stack.findIndex((h) => h.id === id)
      if (i >= 0) stack.splice(i, 1)
    }
  }, [active, ref])
}
