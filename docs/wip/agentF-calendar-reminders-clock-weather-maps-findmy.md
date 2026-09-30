# Agent F handoff: Calendar, Reminders, Clock, Weather, Maps, Find My

Dev port 5186. Screenshot helper used: `tests/shot.mjs` (see docs/APPS.md).
Type-check is clean: `npx tsc -p tsconfig.app.json --noEmit 2>&1 | grep -E 'src/apps/(calendar|reminders|clock|weather|maps|findmy)'` prints nothing.

## Done (verified with screenshots; no console errors)
### Clock (`src/apps/clock/`)
- `Wheel.tsx` + `wheel.css`: reusable iOS picker wheel (cylinder projection; drag with inertia, scroll wheel, tap, arrow keys, loop mode), `WheelGroup`, `TimeWheels`, `range`. Calendar and Reminders import it too.
- `index.tsx`: floating TabBar with four tabs.
  - **World Clock**: analog day/night faces, "Today, +3HRS" offsets via Intl, add city sheet, Edit mode (delete and reorder).
  - **Alarms**: iOS 27 **Alarm & Timer Volume** card. It has the alarm slider (`alarmVolume`) and the ringer slider (`ringerVolume`), a Test button for each that plays `playAlert` and animates a level meter, and the **Separate from Ringer** toggle (`alarmVolumeSeparate`). Alarm rows show a "Volume 90%" chip. The add/edit sheet has time wheels, repeat, label, sound (with preview), snooze, volume and delete. Also: context menu, Edit mode, and the Sleep | Wake Up setup.
  - **Stopwatch**: digital and analog pages with page dots, and laps with best/worst highlighting. Starting it also starts a `stopwatch` Live Activity.
  - **Timers**: H/M/S wheels, presets, label, and a When Timer Ends sound sheet. Timers start with `startTimer()`, so the Dynamic Island shows them. Running rows show a progress ring with pause/resume, which ends or restarts the `timer-<id>` activity, and cancel. Also a Recents list. Activities are re-created on mount for timers restored from storage.
  - Routes: `timer`, `alarm`, `alarm/new`, `stopwatch`, `world`.
### Calendar (`src/apps/calendar/`)
- Month view: 37 months scrolling vertically, a sticky weekday row, event dots, and a red Today with a pulse. The "‹ 2026" button opens the Year view. Bottom glass bar has Today, Calendars and Inbox (with an invitations badge).
- Day view: week strip you can swipe, all-day row, hour timeline with overlap columns and the red current-time line. Swipe the timeline to change day. Long-press or right-click an empty slot to create an event. Also a list toggle.
- List (agenda) view with **multi-select**: bulk Move to calendar, Shift time (±15m/1h/day/week) and Delete.
- Event details: map snippet with Directions (goes to the maps route), calendar, alert, invitee avatars, conflicts, and notes rendered as **markdown**. A third-party source gets a styled header and a "Synced from …" footer. Also Duplicate, Share and Delete.
- Editor sheet: title, location suggestions, all-day, inline date picker and time wheels, repeat, calendar, invitees, alert, URL, notes, delete. Uses the store's add/update/deleteEvent. Repeat is stored as an extra `repeat` field on the event and expanded by `occurrences()`.
- **Apple Intelligence quick add**: text box that runs `parseEvent` live. Recognized date/time, place and people are highlighted in the text. The parsed fields can be edited, and there are More Options and Add buttons.
- Calendars sheet (show/hide per calendar), Inbox sheet (Accept/Maybe/Decline invitations), Search page.
- Routes: `event/<id>`, `new`, `today`, `inbox`.
### Reminders (`src/apps/reminders/`)
- Home: search, smart-list grid (Today/Scheduled/All/Flagged/Completed with counts), My Lists, New Reminder and Add List buttons, New List sheet (color and icon).
- List page:
  - Circle checkboxes with a fill-and-collapse animation, "N Completed · Clear/Show".
  - Sections: Groceries are sorted into sections automatically; you can add or rename sections yourself.
  - Touch-and-hold then drag to reorder or move between sections. Holding without moving opens the context menu (Flag, Move to…, Delete).
  - Inline editing of a reminder's title, and an inline add row with **natural-language chips**.
  - Today groups into Overdue/Morning/Afternoon/Tonight. Scheduled groups by list, with Group by Date in the menu.
- Details sheet: date and time pickers, repeat, flag, priority, list, delete. `nlp.ts` extends `parseReminder` with priority (`!!`), `#list`, flag, "every Tuesday"-style repeats, "after school", "end of day" and similar phrases.
- Route: `list/<id>` (smart ids are also accepted).
- Siri/Messages reminders show up because the app reads `useOS().reminders`.
### Maps foundation (`src/apps/maps/`), used by Calendar already
- `geo.ts`: the fictional Maple Grove world, built from `MAP_PLACES` coordinates: roads, river, parks, buildings and labels. Also a road graph with Dijkstra routing (`route`, `routeOptions` for alternatives, `routeVia`), turn-by-turn steps, `placeForLocation`, `pointAlong`, and `HERE` (school, which matches Siri's routing).
- `MapView.tsx` + `mapview.css`: pannable and zoomable CSS-3D map layer (drag with inertia, wheel zoom at the cursor, double-click, pinch). Heading and tilt are supported, pins and labels stay facing the viewer, routes are drawn, there is a user dot with a heading cone, `Buildings3D` gives extruded 3D buildings, `MiniMap` is a static snippet, and `PlacePin`/`CATEGORY` give category glyph pins.

## Not started (still the original placeholders)
- `src/apps/maps/index.tsx`: the app UI. Next steps:
  1. Bottom glass sheet with detents: search, Favorites, Recents, Guides, Visited Places, Offline Maps.
  2. Place card and route preview using `routeOptions` (drive/walk/transit/bike, alternatives), plus `route/<id>/<via>` via `routeVia`.
  3. Navigation mode. Put the controller at module level with `pointAlong` so it keeps running when the app is closed, and drive `startActivity({id:'nav', kind:'navigation', data:{eta,next,dist}})` from it. If a `nav` activity already exists when the route opens, go straight into navigation.
  4. Natural-language routing, reusing the detour math in `siri.ts navigate()`.
  5. Flyover: `MapView` with tilt ~58, an animated heading and `buildings3d`.
  6. Landscape layout: sheet as a left-side panel.
- `src/apps/weather/index.tsx`. Plan:
  - Storm storyline: build the daily data from `WEATHER.daily`. The Thursday index is `daysUntilWeekday(4,false)`; override its icon to `cloud-bolt` and pop to 80 (the widget does the same), keep lo/hi, and set index 2 to rain if it isn't Thursday.
  - Animated sky (clouds, rain, lightning, stars), respecting `reduceMotion`/`lowPower`.
  - Hourly forecast with sunrise/sunset markers, 10-day forecast with range bars that expand into an hourly chart, glass modules, alert banner.
  - City pager (`WEATHER.cities`), search to add, °F/°C.
- `src/apps/findmy/index.tsx`. Plan:
  - Reuse `MapView` with avatar, device and item pins.
  - People/Devices/Items/Me tabs, detail cards, flexible sharing (1 hour / end of day / indefinitely, per person).
  - Precision Finding UI. Put the controller at module level with a 600ms `updateActivity` on `findmy-<id>`, and end the activity on arrival.

## Known issues / notes
- `DynamicIsland.tsx` `Minimal()` has no `stopwatch` case, so it shows a Zap icon when the stopwatch is the secondary activity. This is a shared shell change; suggested fix: `if (a.kind === 'stopwatch') return <TimerIcon size={18} color="#ff9f0a" />`.
- Pausing a timer ends its activity, because the island compact countdown can't show a paused state. Resuming restarts the activity.
- Calendar `repeat`/`alert`/`url` are stored as extra fields on `CalendarEvent`. They are cast via `Ev` in `calendar/util.tsx` and aren't in the shared type.
- Reminder repeat and date-only flags live in app-local storage (`ios27-reminders` meta), not on `Reminder`.
- Landscape and dark mode were spot-checked for Clock and Calendar only. Reminders landscape has CSS but hasn't been screenshotted.
