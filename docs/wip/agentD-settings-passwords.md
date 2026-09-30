# Agent D handoff — Settings + Passwords

## Done (src/apps/settings) — type-checks clean, no console errors on tested routes
- `index.tsx`: root list (search field w/ ranked results + breadcrumbs, Apple Account header, AirPods row, all groups), deep-link routing via `useAppRoute('settings')` (pushes parent chain, e.g. `display/glass` → Display › Liquid Glass).
- `common.tsx`: route registry `ROUTES`, `Go/Push/XRow/HeroPage/Sub/ChoicePage/Ico/New27`, persisted Settings-only prefs store `usePrefs` (`ios27-settings`), store helpers (setA11y/setSiri/setST/...).
- `pages/connectivity.tsx`: Wi‑Fi (join sheet, password never stored, network info/forget), Bluetooth (devices connect → airpods/games store, iOS 27 power mgmt), Cellular (Connectivity Assist + live Wi‑Fi-quality handoff demo → net.wifiQuality/activePath, per-app cellular data), Hotspot, VPN.
- `pages/account.tsx`: Apple Account, Sign-In & Security, Account Recovery (recovery contacts, iOS 27 recovery codes), Recovery Key, Quick Start w/ recovery contact demo, iCloud (+storage bar), iCloud Photos priority sync demo, Family.
- `pages/alerts.tsx`: Notifications (per-app → store.permissions[app].notifications), Sounds & Haptics (ringer + independent alarm volume, Test buttons via playAlert, ringtone/text tone pickers w/ previews in `tones.ts`), Focus (modes, schedules, focusAppFilter).
- `pages/general.tsx`: General, About, Software Update, Storage, AirDrop, Keyboards (multilingual demo + grammar via proofread, Indigenous keyboards), Language & Region (English variants), Date & Time (h24), iPhone Handoff demo, Feature Availability (expandable), Game Controllers, Transfer or Reset (resetAll w/ confirm).
- `pages/accessibility.tsx`: VoiceOver (rich image descriptions + ask-about-image via answerAbout), Zoom, Display & Text Size, Larger Text, Motion, Accessibility Reader demo, Voice Control (names/numbers overlay, rename, commands), Assistive Access wizard, Guided Access speed demo, Touch Accommodations wizard, Hearing Devices pairing, Subtitles & Captioning (captionTranslate).
- `pages/display.tsx`: Display & Brightness, Accent, Liquid Glass (live preview + slider/presets → glassTint), Home Screen (icon styles/tint/large), Wallpaper (pair preview, gallery incl. Photos/Playground, Lock Screen profiles, clock style), StandBy, Control Center customize (store.controls), Action Button carousel.
- `pages/system.tsx`: Battery (insights, 24h/10d charts, per-app, charge limit), Privacy & Security (+ Safety Check), Emergency SOS, Face ID, Camera/Photos/Safari/Messages/Music/Wallet settings, Apps list + generic app page, Search.
- `pages/siri.tsx`: Apple Intelligence & Siri, Voice page (pace/expressiveness sliders, speechSynthesis preview + waveform fallback).
- `pages/airpods.tsx`: battery rings, noise control, Custom EQ (draggable curve + sliders + presets → store.eq, Play sample), heart rate, hearing health, Find My.
- `pages/screentime.tsx`: dashboard/activity, Downtime, App Limits, Always Allowed, Communication Safety demo, Family child account for Mia (child-mode switch, setup wizard w/ app grid → allowedApps, Ask to Browse approve/deny, Time Allowances, Schedules add/edit).

## NOT done
- **Passwords app (src/apps/passwords) is still the placeholder.** Next: categories grid (All/Passkeys/Codes/Wi‑Fi/Security/Deleted from PASSWORDS in world.ts), item detail w/ masked "••••••••" → reveal "demo-Passw0rd!", Security recommendations + iOS 27 upgrade flow (animated, push id into store.passwordsFixed), account recovery section, `useAppRoute('passwords', 'site/<site>')`, `passwords.css` with `.pw-` prefix.
- Not yet visually verified: dark mode, landscape, most sub-pages beyond glass/wifi/cellular/sounds/airpods/screentime/family/voiceover (they rendered without console errors).

## Shared-file suggestions (not applied)
- `store.notify`: skip banner when `permissions[app]?.notifications === false` (Settings writes it).
- `pressAction()` 'shortcut': run the chosen shortcut (`usePrefs` key `actionShortcut` lives in localStorage `ios27-settings`), e.g. launch('shortcuts',{route:`run/${id}`}).
- `isAppAllowed`: honour `screenTime.downtime`.
