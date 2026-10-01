# Handoff — current state

## Branches
- `claude/ios27-simulator`: the main branch. Every app is built and merged; it type-checks, builds and passes all tests.
- `claude/ios27-wip`: old snapshots of unfinished agent work. Everything in it has since been merged into the main branch, so it can be deleted.

## Status
- **Apps:** all 32 apps in `src/apps/registry.ts` are built, including Voice Memos (added after the feature audit).
- **Tests:** 21 unit tests (`npm test`) and 32 Playwright e2e tests (`npm run test:e2e`) pass. The e2e suite covers the shell, the connected app flows (Messages → Reminders, Safari Notify Me, Photos search and ratings, Calendar quick add, Describe a Shortcut, Home camera search, AirPods EQ, alarm volume, Mail → Calendar, Music → Dynamic Island, Camera, Voice Memos, Ask to Browse, Siri document uploads, CarPlay), the Lock Screen editor, the store migration, and an "every app launches and leaves nothing painted after closing" check.
- **Feature audit:** done against `docs/wip/ios27-research.md`. Its gaps were then filled:
  - Lock Screen Extend and Create with Image Playground
  - Voice Memos
  - Siri document uploads
  - Ask to Browse approval in Messages and Settings
  - CarPlay AirPlay video
  - the Screen Time iOS 27 note

## Known limitations
- Several things run on sped-up timelines so a demo finishes quickly: navigation, Precision Finding, Safari Notify Me, and replies to Ask to Browse.
- Generated audio is synthetic:
  - Voice Memos playback is an abstract murmur, not speech.
  - Music is synthesized.
- Markup strokes in Preview are slightly stretched on image and spreadsheet pages.
- Magnifier's Text mode only finds text in the handwritten note and receipt scenes.
- The Dynamic Island's compact Live Activities sit beside the island in landscape.

## Useful tools
- `node tests/shot.mjs <name> '<steps-json>'` takes screenshots, with `SHOT_DIR` and `URL` set as environment variables.
- `python3 tests/sheet.py out.png a.png b.png` joins screenshots into a contact sheet; it needs `pip install pillow`.
- In dev builds, `window.__os` is the store.
- Each `docs/wip/agentX-*.md` note describes one app group's routes and design choices.
