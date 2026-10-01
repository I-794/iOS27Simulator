# iOS27Simulator
A Simulator of iOS 27 made with Claude Opus 5.5

An interactive, browser-based recreation of the **iOS 27** user experience: a Dynamic Island iPhone that boots to its Lock Screen and runs a connected set of apps, Siri AI, Liquid Glass and the system shell, all backed by one simulated OS state.

> **Disclaimer:** this is an unofficial, educational interface recreation. It is not an Apple product and is not affiliated with or endorsed by Apple. It ships no Apple source code, system files, fonts or images. All artwork is original SVG, and every person, business, account and data point is fictional.

## Run it

```bash
npm install
npm run dev          # http://localhost:5173
npm run build        # production build in dist/
npm test             # unit tests (Siri engine, NLP, search)
npm run test:e2e     # Playwright end-to-end tests (uses the bundled Chromium)
```

## Controls

| Action | Mouse / touch | Keyboard |
| --- | --- | --- |
| Unlock | Swipe up on the Lock Screen, or press the side button | `Enter` |
| Home | Swipe up from the home bar | `Alt+H` |
| App Switcher | Swipe up and pause | `Alt+A` |
| Control Center | Pull down from the top-right | `Alt+C` |
| Notification Center | Pull down from the top-left | `Alt+N` |
| Search or Ask | Pull down from the top centre, or tap *Search* | `Alt+Space` |
| Siri | Hold the side button | `Alt+S` |
| Lock | Side button | `Alt+L` |
| Rotate | Panel button | `Alt+R` |
| Dark mode | Panel button | `Alt+D` |
| Back / dismiss | Swipe from the left edge | `Esc` |

Touch-and-hold, or right-click, opens context menus on icons, notifications, bubbles and more. Right-click the Lock Screen to customise it. The panel next to the phone also has volume, Action button and Camera Control buttons. On a phone-sized browser, the simulator runs full-bleed.

## What's inside

- **System shell:** Lock Screen (Classic or Compact clock, widgets, stacked notifications, Now Playing you can swipe away without pausing, Live Activities, profile switching, photo wallpapers you can *Extend* with Apple Intelligence), Home Screen (widgets up to Extra Large, folders, edit mode, Today View, App Library, icon styles), Dynamic Island state machine (compact, minimal, expanded, transient events, landscape), Control Center with a controls gallery, Notification Center, *Search or Ask* (which replaces Spotlight and hands questions to Siri) over a central search index, App Switcher, banners with quick reply, share sheet with content-based suggestions and fast AirDrop, and a keyboard with Write with Siri, dictation and multilingual suggestions.
- **Liquid Glass:** material tokens driven by one *More Clear ↔ More Tinted* slider (Settings › Appearance), with real backdrop refraction on the dock and tab bars in Chromium.
- **Siri AI:** the released iOS 27 presentation — a dark glass orb that grows out of the Dynamic Island, answers that expand from the island, and a chat view for follow-ups — over an intent engine with personal context across Messages, Mail, Calendar, Photos, Notes and Reminders, onscreen awareness, app actions, multi-step requests, follow-ups, broad knowledge, Camera Siri mode, Write with Siri, and a dedicated Siri app with conversation history and photo and document uploads.
- **Apps:** Messages, FaceTime, Phone (Call Context), Safari (Organize by Topic, Notify Me, Describe an Extension), Mail, Photos (Clean Up, Extend, Reframe, ratings, shared albums), Camera (Siri mode), Settings (Screen Time and family controls, Accessibility, AirPods Custom EQ, alarm volume), Calendar, Reminders, Notes, Clock, Weather, Maps, Find My, Music (AutoMix), Podcasts, Home (camera search), Wallet and Apple Pay, Health, Fitness, Shortcuts (Describe a Shortcut), Image Playground, Journal, Freeform, Passwords, Files, Preview, News, Stocks, Calculator, Games, Magnifier and Voice Memos.
- **Audio:** music is synthesized live with Web Audio, so AirPods Custom EQ and AutoMix crossfades are audible. Alarm and timer sounds follow the independent alarm volume.

## Architecture

```
src/
  os/        store (zustand, persisted), types, demo data, time, search index,
             ai/ (siri intents, NLP date parsing, writing tools, vision, knowledge), audio engine
  shell/     device, screen layers, lock/home/island/CC/spotlight/siri/share/keyboard hosts, services
  ui/        reusable iOS primitives: Glass, Switch, Slider, Segmented, NavStack, Page, TabBar,
             List/Row, Sheet, context menus, alerts, Keyboard
  apps/      one lazily-loaded folder per app (see docs/APPS.md)
  art/       procedural SVG photos, wallpapers, Image Playground renderer
  icons/     original app icon artwork
```

The OS state lives in one place, so the apps stay connected. For example, a reminder that Siri creates appears in Reminders, and a Safari *Notify Me* change becomes a notification. Music playback updates the Dynamic Island and the Lock Screen, and Screen Time changes what can launch.
