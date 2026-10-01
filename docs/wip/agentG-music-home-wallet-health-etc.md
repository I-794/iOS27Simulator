# Agent G handoff: all 11 apps built

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

## Day 2 (2026-09-30): the six remaining apps
- **fitness/**: animated activity rings, step cards, week rings, trends, workouts list and detail (route map with an "improved route accuracy" toggle, heart-rate graph, GymKit treadmill note), awards, Sharing.
  - Workout tab: AirPods Pro 3 heart-rate source toggle, workout types, and GymKit (tap to connect → set treadmill speed → start).
  - A live workout runs full screen: timer, live BPM, zones, graph, kcal, distance and pace. It starts a `workout` Live Activity and calls `updateActivity` every 2 s with `data.hr`, so the Island shows live BPM. You can minimize it to a pill; ending it shows a summary.
  - Routes: `workout`, `gymkit`, `workout/<id>`.
- **news/**: Today (sections, lead story, list, For You, AI Briefing), article view (parallax hero, reading-progress bar, Summarize, text-size sheet, save, share, related stories), Sports (scores, standings), Puzzles (a working Quartiles-lite), Following (channels, saved stories) and search. Route: `article/<id>`, `puzzles`.
- **stocks/**: watchlist with sparklines, live price ticks with flash, a pill that toggles %/change/market cap, edit/reorder/remove, and search to add. Detail has ranges 1D–5Y, a chart you can drag to scrub (cursor + dot + time label), stats and related news. Landscape is a split view. Route: `symbol/<SYM>`.
- **calculator/**: iOS 18-style keypad (⌫ / C / AC, live expression line, operator precedence, % including a+b%, +/−, repeat =, keyboard input, swipe to delete). Scientific keys in landscape or when chosen from the mode menu (2nd, Rad/Deg, memory, trig, etc.). History sheet. Math Notes-lite shows inline results for lines ending in "=" and supports variables (`bill = 86.40`). Routes: `notes`, `basic`.
- **games/**: Home (continue playing, friends' activity, events), Arcade (hero, genre filter, Get/Play), Play Together (challenges, leaderboard), Library, game pages with achievements. Controller settings are stored in `store.games` and include the PlayStation Access controller note. A playable mini game has the iOS 27 **Game Overlay** (tabs, focus navigation with arrow keys, Enter, Esc or an on-screen D-pad/A). Routes: `controller`, `play/<id>`, `game/<id>`.
- **magnifier/**: live camera view from a Scene with drift; picker for which scene to point at; zoom 1–10×; flashlight (`store.flashlight`, turned off when the app leaves the foreground); filters; brightness/contrast; freeze. Detection modes: Door, People, and Text (Point and Speak highlights each line in turn). **Ask** assistant: "read this sign" / "what does this say" answer from `SCENE_INSIGHTS`/`answerAbout`, and spoken commands work too ("zoom in", "zoom to 5x", "turn on flashlight", "invert colors", "freeze"). Answers use `speechSynthesis` when available. Routes: `ask/<q>`, `text|door|people`.
- Polish:
  - Music landscape: the mini-player now sits inline in the tab bar.
  - Health landscape: shorter charts and narrower columns.
  - Wallet dark mode: card edge stroke added.
  - Wallet: Brew Lab Rewards now uses the iOS 27 "Poster" pass layout.
  - Wallet boarding pass now uses `kind: 'flight'`.

## Known issues / shared-file requests
(Items 1–3 were fixed by the coordinator on day 2.) 1. **Podcast playback in the shell**: DynamicIsland, LockScreen, ControlCenter and the music widget all call `TRACKS.find(np.trackId)!`. Podcasts therefore keeps `trackId` pointing at a valid music track, and the Island shows that song's title while a podcast plays. Fix: in those components, when `np.kind === 'podcast'`, render the episode (`PODCASTS…episodes.find(e => e.id === np.episodeId)`) instead.
2. `services.ts` music subscription returns early when `np.kind !== 'music'` without pausing the synth. Podcasts works around this by pausing music first. Suggested fix: `if (np.kind !== 'music') { if (was.kind === 'music' && was.playing) music.pause(); return }`.
3. LiveActivity has no `flight` kind, so the boarding-pass Live Activity uses `kind:'sports'`, which renders the generic view.
4. Music NavStacks for hidden tabs stay mounted. Escape/`ios-back` may pop a hidden tab's stack first (minor).
5. Podcasts still keeps the last song's id in `nowPlaying.trackId`. This is harmless now that the shell uses `nowPlayingTrack()`.
6. The Magnifier text boxes are hand-mapped for the `handwritten` and `receipt` scenes. Other scenes show "No text found" in Text mode.
7. Stocks prices and news are simulated. The Fitness heart rate is simulated, and the AirPods source label follows `store.airpods`.
