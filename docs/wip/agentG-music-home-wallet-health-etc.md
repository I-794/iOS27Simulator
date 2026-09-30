# Agent G handoff: Music, Podcasts, Home, Wallet, Health (+ 6 apps not started)

Status on 2026-09-30: type-check is clean for all of agent G's folders (`npx tsc -p tsconfig.app.json --noEmit | grep src/apps/<id>`).
Screenshots in tests/shot.mjs showed no console errors.

## Done
- **music/**: `index.tsx`, `pages.tsx`, `NowPlaying.tsx`, `automix.ts`, `lib.ts`, `music.css`
  - Floating glass TabBar (Home/New/Radio/Library plus a Search button). The mini-player pill floats above the tab bar and moves inline with the minimized tab bar while you scroll down.
  - Home shelves, New, Radio stations, Library (Playlists/Artists/Albums/Songs/Downloaded), and Search with categories and lyric matches.
  - Album pages use a hue gradient header, play/shuffle glass buttons, credits, "more by" and "you might also like". Artist pages have a hero, latest release, top songs, albums, about/bio and similar artists.
  - Now Playing: dynamic blob background from the track hue; art shrinks when paused; scrubber; volume bound to `store.volume`; AirPlay picker sheet; a streaming reliability badge with a popover; time-synced lyrics you can tap to seek; queue with drag reorder, remove, shuffle, repeat and AutoMix; crossfade slider; "Preview AutoMix", which seeks to 12 s before the end; an AutoMix banner that says "analyzing" before the switch, then a canvas that aligns the beat grids of two waveforms (label "104 → 110 BPM matched"); and a mix history. A `Visualizer` built on `audioAnalyser()` is used when a song has no lyrics.
  - Routes: `nowplaying[/lyrics|/queue]`, `album/<name>`, `artist/<name>`, `playlist/<id>`, `play/<trackId>`.
- **podcasts/**: Home (Up Next cards, shows, latest), Library, Search (also searches transcripts), show page with **search within the show** (titles and transcripts, highlighted snippets, timestamp chips that jump to that point), episode page with transcript, and a full player (speed chips, ±15/30, sleep timer, transcript mode, AirPlay). Progress is simulated from position/updatedAt × speed and saved in `ios27-podcasts`. Routes: `player`, `show/<id>`, `episode/<id>`.
- **home/**: `index.tsx` (root, rooms, categories, Thread page, Add Accessory), `tiles.tsx` (tiles and control sheets: light BigSlider + colors, thermostat dial, lock, garage, fan, blinds, outlet/TV/speaker, sensor), `cameras.tsx` (live feeds, 3 simultaneous streams, 4K HSV badge, natural-language search via `search(q,{types:['camera']})` with highlights, camera detail with a timeline of event markers, clip player, Video Descriptions, Activity history with an AI summary and filters), `lib.tsx`, `home.css`. Routes: `clip/<id>`, `camera/<name>`, `room/<name>`, `activity`, `cameras`, `search/<q>`, `thread`, `add`.
- **wallet/**: 3D-ish card stack with tap to expand (detail, transactions, balance, actions, payment options); passes with QR or barcode (boarding pass, concert, Student ID, loyalty); Orders plus detail (Live Activity toggle); Manage Cards (default card, reorder); **Pay sheet** (route `pay`) with a swipe/tap card rail, dots, a quick list, a side-button hint and "Confirm with Side Button" → Face ID → Done; car key banner and flow (`carKeySetup` offered → added, adds the `w-carkey` card, `flashIsland('carkey')`) with car controls. Routes: `pay`, `card/<id>`, `carkey`, `orders`.
- **health/**: Summary (pinned metrics, "Updated just now" sync pill, step dedupe note, AirPods Pro 3 HR note, sleep time-zone note, highlights, route map), Sharing, Browse (categories and search), metric detail with D/W/M/6M/Y scrubbable charts (`charts.tsx`), workout page with route accuracy on/off (`RouteMap.tsx`), treadmill calibration and a GymKit source, and Cycle Tracking (sample-data banner, life stage incl. peri/menopause, symptom chips, pattern-notification toggle, articles). Routes: `cycle`, `metric/<steps|hr|sleep|energy>`, `workout/<id>`.

## Not started (still original placeholders)
fitness, news, stocks, calculator, games, magnifier. The spec is in the original task prompt.
- Fitness can reuse `../health/RouteMap` and `../health/charts`. For the workout Live Activity: `startActivity({ id:'workout', kind:'workout', app:'fitness', priority:3, data:{hr} })` + `updateActivity` every ~2 s.
- Magnifier: `SCENE_INSIGHTS.handwritten.text` / `answerAbout('handwritten', q)`.

## Known issues / shared-file requests
1. **Podcast playback in the shell**: DynamicIsland, LockScreen, ControlCenter and the music widget all call `TRACKS.find(np.trackId)!`. Podcasts therefore keeps `trackId` pointing at a valid music track, and the Island shows that song's title while a podcast plays. Fix: in those components, when `np.kind === 'podcast'`, render the episode (`PODCASTS…episodes.find(e => e.id === np.episodeId)`) instead.
2. `services.ts` music subscription returns early when `np.kind !== 'music'` without pausing the synth. Podcasts works around this by pausing music first. Suggested fix: `if (np.kind !== 'music') { if (was.kind === 'music' && was.playing) music.pause(); return }`.
3. LiveActivity has no `flight` kind, so the boarding-pass Live Activity uses `kind:'sports'`, which renders the generic view.
4. Music NavStacks for hidden tabs stay mounted. Escape/`ios-back` may pop a hidden tab's stack first (minor).
