# Building apps for the iOS 27 Simulator

Each app lives in `src/apps/<id>/index.tsx` (default export, no props) and is lazy-loaded from
`src/apps/registry.ts`. Put styles in `src/apps/<id>/<id>.css` and import it from the app's
`index.tsx`. Prefix every class with the app id (`.msg-…`, `.ph-…`) so apps never collide.
Reuse the shared classes in `src/styles/ui.css` (lists, rows, buttons, chips, glass) before
writing new CSS.

## Hard rules
- Only edit files inside your own app folders (and new files there). Do **not** edit shared
  files (`src/os/*`, `src/shell/*`, `src/ui/*`, `src/styles/*`, `src/art/*`, `src/icons/*`,
  `registry.ts`). If you truly need a shared change, describe it in your final report.
- No new npm dependencies. No network calls. No real personal data. All people and
  businesses are fictional (see `src/os/data/*`).
- Don't run `git` commands that change state (commit, reset, checkout, stash).
- Type-check with `npx tsc -p tsconfig.app.json --noEmit 2>&1 | grep 'src/apps/<id>'`
  (other agents may have in-progress errors in their own folders; ignore those).
- Every visible control must do something. No "coming soon" screens.
- Keep the look faithful to iOS 27 (Liquid Glass, SF-style type, grouped lists, large
  titles, floating glass tab bars, glass circular bar buttons). Don't redesign iOS.

## App anatomy
```tsx
import { NavStack, Page, useNav, BarButton, TabBar } from '../../ui/nav'
import { List, Row, SettingsIcon } from '../../ui/list'
import { Glass, Switch, Slider, Segmented, SearchField, Button, Avatar, Chip, AISparkle, Spinner, BigSlider } from '../../ui/controls'
import { Sheet, openMenu, showAlert } from '../../ui/overlay'
import { useOS } from '../../os/store'
import { useAppRoute, useOnscreen, useNow, useLongPress, useDrag } from '../../os/hooks'
import './myapp.css'

export default function MyApp() {
  return <div className="app-root"><NavStack root={<RootPage />} /></div>
}
function RootPage() {
  const nav = useNav()
  return (
    <Page title="Title" grouped trailing={<BarButton label="Add" onClick={...}><Plus size={22} /></BarButton>}>
      <List header="Section"><Row title="Item" chevron onClick={() => nav.push(<Detail />)} /></List>
    </Page>
  )
}
```
- `Page` gives a large collapsing title, scroll-edge blur, glass back button (auto when pushed),
  and bottom padding for the home indicator / keyboard (`--kb-height`). Use `large={false}` for
  inline titles, `noNav` for full-bleed screens (Camera, Photos viewer), `bottomExtra={80}` when a
  tab bar floats over content.
- `NavStack` animates pushes/pops with springs and supports edge-swipe-back and Escape.
- `TabBar` is the iOS 26/27 floating Liquid Glass tab bar (+ optional separate search button).
- `Sheet` = bottom sheet (`detent="medium" | "large" | "auto"`), draggable to dismiss.
- `openMenu(anchorEl, items, { preview })` = context menu; use with `useLongPress` for
  touch-and-hold (right-click also works).
- `showAlert({ title, message, actions })` = UIAlertController.
- Icons: `lucide-react` (size 20–24, strokeWidth ~2–2.2). App icons: `AppIconArt` from
  `src/icons/AppIconArt.tsx`. Avatars: `Avatar id="alex"`.
- Photos/images: `<Scene scene="dog-beach" />` from `src/art/Scene.tsx` (procedural SVG photos;
  see `SCENE_KEYS`, `SCENE_OBJECTS` for Clean Up). Album art: `AlbumArt` in
  `src/shell/widgets/AlbumArt.tsx`. Generated images: `GenArt`/`GenImage` in `src/art/GenImage.tsx`.
- Text fields: plain `<input>`/`<textarea>` inside the screen automatically raise the simulated
  keyboard (with Write with Siri). Add `data-recipient="<contactId>"` for relationship-aware
  writing, `data-mail="1"` for email tone, `enterKeyHint="send"`, and `data-dictation="a|b"`
  for contextual dictation phrases.
- Status bar colour over dark full-bleed UI: `useShell.getState().set({ statusOverride: 'light' })`
  on mount and reset to `null` on unmount (`src/shell/shellState.ts`).

## OS state (`src/os/store.ts`, zustand `useOS`)
Read with selectors: `const events = useOS((s) => s.events)`. Actions live on the same store.
Key data: `conversations, mails, events, reminders, notes, photos, sharedAlbums, alarms, timers,
stopwatch, accessories, safariTabs, safariHistory, safariWatches, safariExtensions, shortcuts,
screenTime, journal, imageGens, freeform, walletCards, walletDefault, nowPlaying, eq, airpods,
siriConversations, siriSettings, accessibility, language, net, theme, glassTint, volume,
ringerVolume, alarmVolume, alarmVolumeSeparate, battery, lowPower, focus, …`
Actions: `set(patch)`, `launch(app,{route})`, `goHome()`, `notify({...})`, `showToast(text)`,
`startActivity/updateActivity/endActivity` (Live Activities → Dynamic Island + Lock Screen),
`flashIsland({kind,title,subtitle})`, `playTrack/togglePlay/seek/nextTrack/prevTrack`,
`sendMessage/receiveMessage/patchMessage/ensureConversation/markConversationRead`,
`addEvent/updateEvent/deleteEvent`, `addReminder/updateReminder`, `addNote/updateNote`,
`updatePhoto/addPhoto`, `updateMail/addMail`, `siriNewConversation/siriAppend`, `setNet`.
Share sheet: `useOS.getState().set({ shareRequest: { title, kind, payload?, photoId?, app } })`.
App-local persistent state: create a small zustand store with `persist` inside your folder
(`name: 'ios27-<app>'`).

Demo data (fictional): `src/os/data/people.ts` (CONTACTS, ME), `comms.ts` (messages, mail),
`life.ts` (calendar, reminders, notes, journal, alarms), `photos.ts` (PHOTOS, ALBUMS,
SHARED_ALBUMS, CAMERA_CLIPS, PEOPLE_AND_PETS), `media.ts` (TRACKS, PLAYLISTS, ARTISTS,
PODCASTS, NEWS, STOCKS), `world.ts` (Home accessories/scenes, wallet, orders, passwords,
Safari sites/tabs/bookmarks, shortcuts, screen time, weather, map places, visited places,
Find My, health, files). Time helpers: `src/os/time.ts`.

## Intelligence helpers
- Siri engine: `ask(text, convId)` in `src/os/ai/siri.ts`; UI session: `runSiri()` in
  `src/shell/siri/session.ts`; rich result cards: `<SiriCards cards=… />`.
- Natural language: `parseWhen`, `parseEvent`, `parseReminder`, `parseDuration`, `fmtWhen`
  (`src/os/ai/parse.ts`).
- Writing: `proofread, rewrite, summarize, keyPoints, feedback, draft, smartReplies`
  (`src/os/ai/writing.ts`).
- Vision: `SCENE_INSIGHTS, insightFor, answerAbout, CAMERA_DEMO_SCENES` (`src/os/ai/vision.ts`).
- Search index: `search(q, {types})`, `searchPhotos(q)`, `timeFilter` (`src/os/search.ts`).
- Audio: `playAlert(kind, volume)` and the synth music engine (`src/os/audio.ts`); music playback
  is driven by `nowPlaying` in the store (don't start audio yourself).

## Deep links, onscreen awareness
- `useAppRoute('messages', (route) => …)` receives routes from notifications, Siri, Spotlight.
  Documented routes: messages `conv/<id>[/<msgId>]`, `compose`; mail `mail/<id>`,
  `compose/<subject>`; calendar `event/<id>`; reminders `list/<id>`; notes `note/<id>`;
  photos `photo/<id>`, `search/<q>`, `album/<id|favorites>`; settings `<route>` (see
  `SETTINGS_INDEX` in `src/os/search.ts`); home `clip/<id>`, `camera/<name>`, `room/<name>`,
  `activity`; maps `route/<placeId>[/<viaId>]`, `nav`; phone/facetime `call/<contactId>`;
  safari `url/<url>`, `search/<q>`, `newtab`; clock `timer`, `alarm`; siri `conv/<id>`,
  `ask/<q>`, `new`, `voice`; findmy `person/<id>`, `device/<id>`, `item/<id>`;
  camera `siri`, `video`, `selfie`, `scan`; music `nowplaying`; files `file/<id>`;
  passwords `site/<site>`; shortcuts `run/<id>`; contacts `contact/<id>`; news `article/<id>`;
  wallet `pay`, `card/<id>`.
- Report what's on screen so Siri can use it:
  `useOnscreen('photos', 'Viewing photo', { type: 'photo', photoId, scene })`.
  Entity `type`s understood by Siri: `conversation {convId, name}`, `mail {mailId}`,
  `page {url, title, text}`, `photo {photoId, scene}`, `camera {scene}`, `note {title, text}`.

## Verify visually
Start your own dev server on your assigned port and screenshot:
```
npx vite --port <PORT> --host 127.0.0.1 &   # once
URL=http://127.0.0.1:<PORT>/ SHOT_DIR=<your scratch dir> node tests/shot.mjs <name> '[{"key":"Enter"},{"wait":800},{"eval":"window.__os.getState().launch(\"photos\")"},{"wait":1200},{"shot":"photos"}]'
```
`window.__os` exposes the store in dev. The script prints console errors — fix them.
Use `{"click":"css selector"}` steps to interact, `{"shot":"name"}` to capture only the phone.
Read the PNGs to check layout at 402×874 (portrait) and in landscape
(`{"eval":"window.__os.getState().set({orientation:'landscape'})"}`), in light and dark mode.
