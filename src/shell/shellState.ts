import { create } from 'zustand'

/** Transient shell-only UI state (not persisted). */
interface ShellState {
  /** apps can force the status bar colour (e.g. Camera, full-screen photos) */
  statusOverride: 'light' | 'dark' | null
  hideStatusBar: boolean
  islandExpanded: string | null
  appLaunching: boolean
  homePage: number
  /** a query handed from Search or Ask to Siri */
  siriPending: string | null
  set: (p: Partial<ShellState>) => void
}

export const useShell = create<ShellState>((set) => ({
  statusOverride: null,
  hideStatusBar: false,
  islandExpanded: null,
  appLaunching: false,
  homePage: 0,
  siriPending: null,
  set: (p) => set(p),
}))
