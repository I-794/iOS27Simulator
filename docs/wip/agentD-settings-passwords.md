# Agent D handoff — Settings + Passwords (updated)

## Settings (src/apps/settings) — complete, type-checks clean
- Root list, search (page + row-level entries in `searchIndex.ts`), deep links via `useAppRoute('settings')` that push the parent chain.
- New iOS 27 **Appearance** top-level page (`appearance`): Light/Dark cards, Automatic, Liquid Glass, Accent Color, icon-style link.
  **Liquid Glass** at `appearance/glass` (alias `display/glass`, parent = appearance): live preview + slider labelled
  "More Clear" / "More Tinted", midpoint tick (snaps to 0.5 = Default), presets Clearest/Default/Most Tinted.
  Display & Brightness now only brightness/True Tone/Night Shift/text/auto-lock (+ link to Appearance).
- Apple Intelligence & Siri: new **Siri AI (Beta)** waitlist row (none → "Joined waitlist · You'll be notified" → notification after ~8 s → "Available"; EU regions show not-available; English only). State in `usePrefs.siriAiWaitlist`.
- Always Allowed page now mirrors `DOWNTIME_ALLOWED` from the store (read-only) + Downtime toggle.
- Everything else as in the original handoff (connectivity, account/recovery, alerts, general, accessibility, display, system, siri voice, AirPods EQ, Screen Time/Family/child mode).

## Passwords (src/apps/passwords) — complete
- Home: search, 6 category tiles (All/Passkeys/Codes/Wi‑Fi/Security/Deleted) with live counts, Family shared group, Account Recovery, Lock Screen help, "demo data" note, + New Password (site + user only; password is generated, never typed).
- Detail: favicon tile, warnings (compromised/reused/weak) with explanations, masked `••••••••` → simulated Face ID → reveal fake `demo-…` value, passkey row, rotating fake TOTP code with countdown ring, website link (Safari), Wi‑Fi QR (fake), delete → Deleted (30-day recover).
- Security: high-priority vs other recommendations, iOS 27 Automatic Upgrades ("Upgrade All to Passkeys" batch), per-item "Upgrade to Passkey"/"Change Password" → animated 5-step sheet → pushes id into `store.passwordsFixed` (Lock Screen help prompt disappears once anything is fixed), Recently Fixed, Reset Security Demo.
- Routes: `site/<site>` (fuzzy match), `security`, `recovery`. Local persisted store `ios27-passwords` (deleted, upgrades, added).

## Verified (screenshots, no console errors)
- Liquid Glass tint 0 vs 1 visibly changes the real banner and dock opacity (effect is moderate — mapping lives in tokens.css).
- Child mode greys Home Screen icons with hourglass; launching a blocked app shows the "App Limited" alert.
- Settings + Passwords in dark mode and landscape (landscape content capped at 640px width).

## Known issues / ideas
- Relaunching Passwords from Home keeps its nav stack (expected iOS behaviour).
- Settings-only toggles (e.g. Keyboard Feedback, StandBy) only persist in `ios27-settings`; nothing else reads them.
- Siri voice preview picks a browser voice by index; accent may not match.
