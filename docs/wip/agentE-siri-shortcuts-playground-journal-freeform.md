# Agent E handoff — Siri, Shortcuts, Image Playground, Journal, Freeform

Type-check: `npx tsc -p tsconfig.app.json --noEmit 2>&1 | grep -E 'src/apps/(siri|shortcuts|playground|journal|freeform)'` → clean.
No shared files were edited.

## Done (verified with tests/shot.mjs, no console errors)
### Siri (`src/apps/siri`, classes `siriapp-*`)
- index.tsx: history list (search, pinned tiles, Today/Yesterday/Previous 7/30 Days/month groups, relative times,
  long-press menu Pin/Rename/Share/Delete, New Chat card, bottom "Ask Siri" glass bar, provider menu).
  Routes `conv/<id>`, `ask/<q>`, `new`, `voice`. Seeds 3 demo conversations once (seed.ts, flag in `ios27-siri`).
- Chat.tsx: hero orb + greeting + personalized suggestion cards + tools (Writing Tools, Visual Intelligence → camera `siri`,
  Ask About a Photo, Shortcuts); streaming replies, SiriCards (drafts send via doSend), follow-up chips, thinking shimmer
  with context step ("Searching Messages…"), copy/speak/thumbs/share/regenerate (regenerate removes the pair and re-asks),
  simulated voice (waveform, pick phrase → word-by-word transcript → runSiri voice:true → speak), photo attach
  (sets `siriOnscreen` photo entity, "What is this?" works and follow-ups keep the photo context), model pill Siri/ChatGPT.
- Writing.tsx: Compose / Rewrite / Proofread, recipient chips, tone chips, result with Copy/Share/Retry/Send.
### Shortcuts (`src/apps/shortcuts`, classes `shc-*`)
- actions.ts: action catalog (incl. iOS 27 Get What's On Screen w/ expanded options, Save to Data Store / Get Stored Data,
  Use Model, group recipients), tree helpers for If / Otherwise If / Otherwise.
- compose.ts: Describe-a-Shortcut composer (trigger detection: location/time/screenshot/notification/focus/alarm/CarPlay/battery;
  clause splitting; contacts via findContact; playlists; notes; conditionals with else-if; fallback to Use Model).
  All 5 required examples verified.
- run.ts: runner with real effects (messages incl. Drumline group, focus, lights/scenes/lock, music, reminders, notes, timer,
  weather/event/ETA outputs, data store `ios27-shortcuts-data`, appearance, low power, open app/url).
- index.tsx: tabs Shortcuts (describe card + examples, tile grid, long-press menu), Automation (derived from shortcut.trigger,
  toggles, New Automation sheet), Gallery (hero + collections + add sheet). Route `run/<id>` (also `edit/<id>`).
- Editor.tsx: building animation, trigger card, tokens (enum/contact menus, text sheet with magic variables), expand "more",
  drag handle reorder + menu Move Up/Down/Duplicate/Delete, Otherwise If add/remove, Add Action sheet with search + categories,
  Details sheet (name/color/glyph/trigger/duplicate/delete). RunSheet.tsx: animated step checklist + result.
### Image Playground (`src/apps/playground`, classes `pg-*`)
- Library (hero, Transform a Photo, Genmoji, Surprise Me, daily limit card, Genmoji row, grid of store.imageGens),
  Detail (metadata, Edit, Save to Photos, Set as Lock Screen wallpaper `gen:<id>`, Contact Poster, Delete, Share).
- Create.tsx: concept bubbles (personalized), prompt, style picker (Photorealistic NEW), creating shimmer, 4 variations,
  natural-language edits (+ chips), sticker tool (tap/drag), brush tool (draw → pick what the area becomes), undo,
  transform photo (restyled Scene), daily limit (50, local store `ios27-playground`). Routes `new[/<prompt>]`, `gen/<id>`, `photo/<id>`, `genmoji`.

### Journal (`src/apps/journal`, classes `jn-*`) — done (day 2)
- Home: iCloud sync line (tap to sync; offline aware), streak card (current streak, week dots, tappable weekly goal),
  insights (entries this year, words, days journaled, longest streak), AI writing prompts built from recent data
  (last entry, Robotics Scrimmage, drumline practice, upcoming chem test, run, Biscuit photos, song, places; shuffle),
  month-grouped timeline cards (Scene photos, attachment chips, mood, bookmark), search + filters, long-press menu, FAB.
- Editor: prompt banner, photos (multi-select sheet), title/body autosave to store.journal, location/song/workout/audio
  (simulated recorder)/mood, attachment allowance meter ("of 1 GB"), bookmark / change date / delete. Routes `entry/<id>`, `new`.
### Freeform (`src/apps/freeform`, classes `ff-*`) — done (day 2)
- Board list: search, scope chips (All/Recents/Shared/folders), folder sections with participant avatars
  ("Robotics (Shared)"), live miniature previews (dark-adaptive), long-press Rename/Duplicate/Move/Delete, New Board.
- Canvas: pan (drag background / trackpad), zoom (wheel/pinch around cursor, +/−/100% pill), select/move/resize,
  sticky notes (tap selected to edit), shapes (rect/circle/triangle/star/arrow), text boxes, photos from Photos, pen with
  ink colors, color/duplicate/bring-to-front/delete bar, undo/redo (+ ⌘Z, Delete key), shared-board presence + remote
  cursor. Persists to store.freeform. Routes `board/<id>`, `new`.
### Day-2 fixes
- Shortcuts If/Otherwise If input token no longer double-outlined (bare variable pill).
- Landscape: all five apps pad `.page-scroll` by `--safe-left/right`; Siri chat + Shortcuts editor checked in landscape+dark.

## Next steps (polish only)
- Freeform: multi-select/lasso, connectors, per-board zoom persistence.
- Journal: edit entry date with a picker; map view of places.

## Known issues / shared-file notes
- Saving a non-photorealistic image to Photos uses `scene: 'gen:<id>'`; `Scene` (src/art/Scene.tsx) falls back to
  sunset-beach for unknown keys. Suggest Scene render `gen:` ids via `<GenImage seed=…/>`.
- Playground edits that are tints (sunset/night/snow/rain) and stickers/brush strokes render only inside the app
  (GenImage/wallpaper show the base art + concept edits).
