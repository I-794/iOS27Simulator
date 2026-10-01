import { useEffect, useRef } from 'react'
import { Images, LayoutGrid } from 'lucide-react'
import { NavStack, TabBar } from '../../ui/nav'
import { useOS } from '../../os/store'
import { useAppRoute } from '../../os/hooks'
import { LibraryTab } from './Library'
import { CollectionsRoot, CollectionPage } from './Collections'
import { SharedAlbumPage } from './Shared'
import { SearchTab } from './Search'
import { Viewer } from './Viewer'
import { Editor } from './Editor'
import { Slideshow } from './Slideshow'
import { PhotosSettingsSheet } from './Sheets'
import { useUI, usePh, navRefs, type Tab } from './pstore'
import './photos.css'

const lastRoute = { r: '', t: 0 }

export default function PhotosApp() {
  const tab = useUI((s) => s.tab)
  const viewerOpen = useUI((s) => !!s.viewer)
  const count = useOS((s) => s.photos.length)
  const lowPower = useOS((s) => s.lowPower)
  const priority = useOS((s) => s.prioritySync)

  // Onscreen awareness for the non-viewer screens
  useEffect(() => {
    if (viewerOpen) return
    useOS.setState({ siriOnscreen: { app: 'photos', context: tab === 'library' ? 'Photos Library' : tab === 'collections' ? 'Photos Collections' : 'Photos Search', entity: undefined } })
  }, [viewerOpen, tab])

  // iCloud sync simulation (new captures upload; Priority Sync is faster and ignores Low Power Mode)
  const last = useRef(count)
  useEffect(() => {
    const diff = count - last.current
    last.current = count
    if (diff > 0) useUI.getState().set({ syncing: useUI.getState().syncing + diff })
  }, [count])
  const syncing = useUI((s) => s.syncing)
  useEffect(() => {
    if (!syncing) return
    if (lowPower && !priority) return
    const t = window.setTimeout(() => useUI.getState().set({ syncing: Math.max(0, useUI.getState().syncing - 1) }), priority ? 700 : 2600)
    return () => window.clearTimeout(t)
  }, [syncing, lowPower, priority])

  useAppRoute('photos', (route) => {
    // StrictMode can deliver the same route twice in a row; ignore the echo
    if (lastRoute.r === route && Date.now() - lastRoute.t < 400) return
    lastRoute.r = route
    lastRoute.t = Date.now()
    const [kind, ...rest] = route.split('/')
    const arg = decodeURIComponent(rest.join('/'))
    const ui = useUI.getState()
    if (kind === 'photo') {
      const st = useOS.getState()
      const p = st.photos.find((x) => x.id === arg)
      if (!p) return st.showToast('Photo not found')
      const del = usePh.getState().deleted
      const lib = st.photos.filter((x) => !x.hidden && !del[x.id]).sort((a, b) => a.ts - b.ts).map((x) => x.id)
      ui.set({ tab: 'library', editor: null, slideshow: null, viewer: { ids: lib.includes(arg) ? lib : [arg], index: Math.max(0, lib.indexOf(arg)), rect: null } })
    } else if (kind === 'search') {
      ui.set({ tab: 'search', viewer: null, editor: null, query: arg })
    } else if (kind === 'album') {
      ui.set({ tab: 'collections', viewer: null, editor: null })
      // the Collections nav stack may not be mounted yet on a cold launch — retry briefly
      const open = (tries = 0): void => {
        const nav = navRefs.collections
        if (!nav) {
          if (tries < 20) window.setTimeout(() => open(tries + 1), 30)
          return
        }
        nav.popToRoot()
        window.setTimeout(() => {
          if (arg.startsWith('sa-')) nav.push(<SharedAlbumPage albumId={arg} />)
          else if (['favorites', 'captured', 'videos', 'screenshots', 'hidden', 'deleted', 'ids', 'duplicates', 'portrait', 'panoramas', 'selfies', 'edited', 'recents'].includes(arg) || arg.includes(':')) nav.push(<CollectionPage cid={arg} />)
          else nav.push(<CollectionPage cid={`album:${arg}`} />)
        }, 50)
      }
      open()
    }
  })

  const setTab = (t: Tab) => {
    if (t === tab && t === 'collections') navRefs.collections?.popToRoot()
    useUI.getState().set({ tab: t })
  }

  return (
    <div className="app-root ph-root">
      <div className="ph-tab" hidden={tab !== 'library'}><LibraryTab active={tab === 'library'} /></div>
      <div className="ph-tab" hidden={tab !== 'collections'}><NavStack root={<CollectionsRoot />} /></div>
      <div className="ph-tab" hidden={tab !== 'search'}><NavStack root={<SearchTab />} /></div>
      <div className="ph-tabbar">
        <TabBar
          tabs={[
            { id: 'library', label: 'Library', icon: <Images size={24} strokeWidth={2} /> },
            { id: 'collections', label: 'Collections', icon: <LayoutGrid size={24} strokeWidth={2} /> },
          ]}
          value={tab === 'search' ? 'library' : tab}
          onChange={(t) => setTab(t)}
          onSearch={() => setTab('search')}
          searchActive={tab === 'search'}
        />
      </div>
      <Viewer />
      <Editor />
      <Slideshow />
      <PhotosSettingsSheet />
    </div>
  )
}
