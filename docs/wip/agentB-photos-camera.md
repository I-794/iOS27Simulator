# Agent B handoff — Photos + Camera (iOS 27 Simulator)

Dev server port 5182, screenshots in scratch `agentB/`. `npx tsc -p tsconfig.app.json --noEmit | grep -E 'src/apps/(photos|camera)'` → clean.

## Photos (`src/apps/photos/`) — DONE (verified by screenshots, no console errors)
- `index.tsx` root: Library / Collections / Search tabs (TabBar + search button), deep links `photo/<id>`, `search/<q>`, `album/<id|favorites|sa-…|people:X|…>` (deduped for StrictMode), onscreen awareness, iCloud sync simulation (`useUI.syncing`, Priority Sync fast / paused in Low Power).
- `pstore.ts`: persisted app store `ios27-photos` (Recently Deleted map, albums, pinned, recent searches, zoom, cols, memories) + runtime `useUI` (tab, viewer, editor, slideshow, settings, query). `openViewer(ids,id,el)`.
- `look.ts`: `PhEdits` (extends PhotoEdits: brilliance, saturation, extendRatio, cropAspect, cleanMode, capture{style,exposure,zoom,mirror}), FILTERS/STYLES → CSS filter, `photoRatio`, `mapBox` (scene bbox → % in cover box), formatters, `SCENE_KEYWORDS` (for Camera captures).
- `PhotoView.tsx` (memo Scene with edits), `Grid.tsx` (memo thumbs, delegated click/long-press/context menu, video durations, favorites, reactions, blur for IDs, selection checks).
- `Library.tsx`: 3/5/7/1-col grid (menu + ctrl+wheel), Years/Months/All glass pill, filter menu, select mode + `SelectBar` bulk actions, sync status line, scroll-to-newest.
- `Viewer.tsx`: zoom-from-thumbnail FLIP open/close, swipe L/R, drag-down dismiss, swipe-up/(i) info, tap chrome toggle, double-tap zoom, keyboard arrows, favorite/share/edit/delete (Recently Deleted w/ Recover/Delete permanently), … menu (copy, duplicate, add to album, slideshow, save frame, revert, hide), shared-album emoji reactions, video scrubber + **Save Frame as Photo** (addPhoto), landscape side info panel, statusOverride light.
- `Info.tsx`: date, AI caption, 1–5 star rating, editable keywords, Visual Look Up (insightFor + actions via `camera/actions.ts`), EXIF card, mini map → Maps, people & pets chips → search, AI edit notes, Revert.
- `Editor.tsx`: Adjust (Auto/exposure/brilliance/saturation), Filters, Crop (aspect + scale), **Clean Up** (pulsing detected objects, tap/brush/circle, Fast vs High Quality w/ progress, notes, undo), **Extend** (16:9/4:3/Square/9:16/Fill + drag handles, generative shimmer, dashed original frame), **Reframe** (drag pan w/ 3D parallax tilt, tilt slider, presets), compare-hold, undo, revert, Done → updatePhoto.
- `Collections.tsx` + `collections-data.ts`: Pinned (modify sheet), Recent Days, People & Pets (Scene-crop pet faces + avatars), Memories (built-ins + "Describe a Memory" AI creation), Albums (new album flow, add/remove, delete), Shared Albums, Activity, Media Types, Utilities (Captured by Me, Identity Documents blurred + Face ID reveal, Duplicates w/ merge, Hidden + Recently Deleted behind Face ID gate). Natural-language + metadata search `photoSearch` (lens/ISO/aperture/place/edited…) with `refine` (named pets/people required).
- `Shared.tsx`: shared album page (filters by participant/media type, reactions badges, Full Resolution / expiry / cross-platform badges, add photos), participants sheet (platform badges iPhone/Android/Windows/Web, Can Post/Can Invite toggles, remove, full-res toggle, expiration menu), Invite sheet (QR, copy/share link, suggested contacts, phone/email + platform).
- `Search.tsx`, `Slideshow.tsx` (setup: include/exclude, add, theme Ken Burns/Classic/Origami, music via store playTrack, timing, repeat; player with crossfades; **Save as Video** → addPhoto kind video), `Sheets.tsx` (SelectBar, AlbumPicker, PhotoPicker, FaceIDGate, FaceChip, Photos Settings sheet: Prioritize Sync + Photo Shuffle pet/kind/include-me w/ preview).
- `back.ts`: stack of Escape/ios-back handlers (top overlay closes first).

## Camera (`src/apps/camera/`) — DONE (day 2, screenshot-verified, no console errors)
- `index.tsx`: black full-bleed UI (statusOverride light). The viewfinder is an extended Scene with a slow pan, zoomed via transform.
  - Modes: TIME-LAPSE / SLO-MO / VIDEO / PHOTO / PORTRAIT / PANO / SIRI (tap or swipe the wheel or the viewfinder).
  - Zoom: .5/1/2/5 pills with lens-switch crossfade, long-press zoom dial, vertical drag zoom. Tap to focus; long-press for AE/AF lock.
  - Capture: shutter flash/blink plus `playAlert('shutter')`, then the thumbnail flies into the photo well. `addPhoto` runs instantly with lens/aperture/ISO/size/keywords/`edits.capture` (style, exposure, zoom, mirror).
  - Timer countdown. Video/slo-mo/time-lapse recording with a timer and the red stop shutter. Pano sweep saves a panorama.
  - Front camera (flip) and Portrait depth blur. Grid, level and histogram overlays.
  - Low Power: stepped 30 fps pan plus a badge. Reach mode moves the pinned controls down above the mode wheel.
  - Routes `siri`, `video`, `selfie`, `scan`. Scan shows a QR poster, the frame locks onto it, and a pill opens Safari at `url/lincoln.example/calendar`.
  - Landscape: controls column on the left; modes and the shutter on the right edge.
- iOS 27 customizable controls: the six-dot button opens the Camera Controls panel with an **Edit** mode to pin or unpin up to 5 controls in the top row (persisted as `useCam.pinned`, `ios27-camera`). Pro controls (iPhone 18 Pro): aperture, shutter speed, white balance, histogram.
- `SiriMode.tsx`:
  - Demo scene strip (CAMERA_DEMO_SCENES plus local **Flyer** and **Translate** scenes) and a glowing reticle. Ask field and suggestions. Result card: summary, details, actions via `runVisionAction`, Q&A via `camAnswer`, which falls back to `answerAbout`.
  - Split-bill calculator with a people stepper and per-person amounts.
  - **Apple Cash** sheet (portaled to the camera root): request/send, amount stepper, recipient chips incl. the Drumline group, note, Face ID animation. On success it `sendMessage`s to `c-drumline` or 1:1 conversations, patches them to delivered, and shows a toast.
- `extra.ts`: camera-local insights: event flyer → Calendar/Reminder/Directions, Spanish menu → translation, and nutrition facts for food scenes. `photos/extraScenes.tsx` draws the `cam-flyer` / `cam-sign` scenes (PhotoView renders them, so captures of them show correctly in Photos).
- `cstore.ts` holds settings, `actions.ts` the vision action runner.

## Day-2 Photos changes
- Clean Up has **Fast / High Quality / Auto**. Auto picks HQ for people or large objects, otherwise Fast, and says which it chose.
- Grids show more columns in landscape (`effCols`). Captured by Me excludes ID documents and AI images.
- Checked in dark mode (library, collections, info, settings sheet) and landscape (library, collections, viewer + side info panel).

## Known issues / notes
- Scene `reframe.tilt` rotates only the main layer; with Extend on, the blurred extension ring stays unrotated (visible seam). PhotoView adds a small zoom when tilted to hide empty corners. A shared Scene fix would rotate the extension layers too (src/art/Scene.tsx).
- Sheets rendered inside NavStack pages sit below the app tab bar; the tab bar is hidden via `.ph-root:has(.sheet)`.
- The landscape tab bar is the shared TabBar (full width). A Siri-mode typed question needs the result panel scrolled; it scrolls to the latest answer automatically.
