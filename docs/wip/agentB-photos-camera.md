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

## Camera (`src/apps/camera/`) — NOT STARTED (only helper written)
- `index.tsx` is still the original placeholder.
- `actions.ts` DONE: `runVisionAction(action)` handles reminder (parseWhen), event, note, search/shop (Safari), map (MAP_PLACES → maps route), weather, copy, ask (runSiri), split/pay (returns text). `money()`.

### Next steps for Camera (spec in original task)
1. `camera/index.tsx` + `camera.css` (prefix `.cam-`): black full-bleed, statusOverride light; viewfinder = large `Scene` with slow CSS pan (default 'autumn-trees'), grid/level overlays, focus tap square; mode wheel TIME-LAPSE/SLO-MO/VIDEO/PHOTO/PORTRAIT/PANO/SIRI; shutter w/ flash + `playAlert('shutter', volume)` + thumbnail fly-in to well; `addPhoto({scene, kind, capturedByMe:true, lens by zoom, keywords: SCENE_KEYWORDS, edits:{capture:{style,exposure,zoom}}})` (import from `../photos/look`); well → `launch('photos',{route:'photo/<id>'})`; video timer/red shutter → kind 'video' w/ duration.
2. Zoom pills .5/1/2/5 (scale + crossfade), vertical drag zoom, long-press zoom dial; Reach toggle (top controls moved down); settings sheet (flash, Live, timer, exposure, styles STYLES, aspect 4:3/16:9/1:1, HEIF/48MP/ProRAW, grid, level); Low Power badge + reduced frame rate (`steps()` animation).
3. Siri mode: CAMERA_DEMO_SCENES strip, glowing reticle, ask field + suggestions, result card from SCENE_INSIGHTS, actions via `runVisionAction`; split calculator; Apple Cash sheet (amount, recipients, Face ID anim → `sendMessage` to `c-drumline`/ensureConversation + toast); free-form `answerAbout(scene,q)`; `useOnscreen('camera', label, {type:'camera', scene})`.
4. Routes `scan` (QR "lincoln.example/calendar" → Safari `url/lincoln.example/calendar`), `siri`, `video`, `selfie`; landscape layout (shutter on right edge).

## Known issues / notes
- Scene `reframe.tilt` rotates only the main layer; with Extend on, the blurred extension ring stays unrotated (visible seam). PhotoView adds a small zoom when tilted to hide empty corners. A shared Scene fix would rotate the extension layers too (src/art/Scene.tsx).
- Sheets rendered inside NavStack pages sit below the app tab bar; the tab bar is hidden via `.ph-root:has(.sheet)`.
- Not yet re-verified after last change: search refine + pet face crop centering (tsc clean). Dark mode & landscape not yet screenshot-verified for Photos.
