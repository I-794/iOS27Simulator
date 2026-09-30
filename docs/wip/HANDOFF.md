# Handoff — resume here

## Branches
- `claude/ios27-simulator`: the clean branch. It holds the OS core, shell, tests and docs; the apps are still placeholders. It builds and passes all tests.
- `claude/ios27-wip`: snapshots of the same work **plus** the unfinished app code from the seven parallel agents. It may not build or type-check yet.

## State at pause
**Done (on both branches)**
- **OS core:** `src/os` holds the store, demo data, search index, Siri engine, NLP date parsing, writing tools, vision data and the audio engine.
- **System shell:** `src/shell` covers the Lock Screen, Home Screen, Dynamic Island, Control Center, Notification Center, Spotlight, App Switcher, Siri overlay, share sheet, banners, keyboard, VoiceOver and the background services.
- **UI primitives and art:** `src/ui` holds the primitives; `src/art` and `src/icons` hold the SVG artwork.
- **Tests:** 19 unit tests (`npm test`) and 11 Playwright e2e tests (`npm run test:e2e`) pass.
- **Docs:** `docs/APPS.md` is the conventions guide every app follows.

**In progress (wip branch only)**

Each agent owns a set of app folders and writes its notes to a `docs/wip/agentX-*.md` file:
| Agent | Apps |
| --- | --- |
| A | messages, facetime, phone, contacts |
| B | photos, camera |
| C | safari, mail, notes, files, preview |
| D | settings, passwords |
| E | siri, shortcuts, playground, journal, freeform |
| F | calendar, reminders, clock, weather, maps, findmy |
| G | music, podcasts, home, wallet, health, fitness, news, stocks, calculator, games, magnifier |

## How to resume tomorrow
1. Check out the wip branch: `git fetch origin claude/ios27-wip && git checkout claude/ios27-wip`.
2. Run `npm install`, then `npx tsc -p tsconfig.app.json --noEmit` and `npx vite build` to list what's broken.
3. Read each `docs/wip/agentX-*.md` note, finish or fix each app group, and re-run the type-check and build.
4. Once it builds, merge the wip branch into `claude/ios27-simulator`.
5. Add e2e tests for the connected app flows:
   - a Messages reminder suggestion creating a Reminders item
   - Safari Notify Me producing a notification
   - Photos search, star ratings and Clean Up
   - Camera Siri mode
   - Mail suggestions
   - Calendar natural-language event creation
   - Describe a Shortcut
   - Home camera search
   - AirPods EQ
   - alarm volume in Clock
6. Run the final iOS 27 feature-gap audit. The background research pass was stopped before it saved anything, so redo it quickly first (MacRumors "Apple Releases iOS 27", "50 New Things", Apple newsroom).

## Useful tools
- `node tests/shot.mjs <name> '<steps-json>'` takes screenshots, with `SHOT_DIR` and `URL` set as environment variables.
- `python3 tests/sheet.py out.png a.png b.png` joins screenshots into one contact sheet; it needs `pip install pillow`.
- In dev builds, `window.__os` is the store, for debugging and tests.

## Shared-file fixes the agents suggested (not applied yet)
1. **`src/os/hooks.ts` › `useAppRoute`** (agent A): in development, React StrictMode runs the callback twice, so a deep link opens its page twice. Guard it with a ref keyed on `nonce` (`handled.current !== nonce`). Once that's fixed, agent A's `useRouteOnce` wrapper can be removed.
2. **`src/art/Scene.tsx`** (agent E): render `gen:<id>` scenes with the stored generation. Add `if (scene.startsWith('gen:')) return <GenImage seed={scene.slice(4)} … />` and import GenImage. Without it, Image Playground images saved to Photos show up as the default sunset beach.

## Agent status at pause
- **A:** Messages and Contacts are done. Phone is partial (its store and Call Context logic are written; the screens aren't). FaceTime is not started.
- **E:** Siri app, Shortcuts and Image Playground are done. Journal and Freeform are not started.
- **B:** Photos is done. Camera is not started; only `camera/actions.ts` (`runVisionAction`) exists.
- **D:** Settings is done; it keeps extra preferences in its own `ios27-settings` store. Passwords is not started.
- **F:** Clock, Calendar and Reminders are done. Maps has only its map engine (`maps/geo.ts`, `maps/MapView.tsx`); the app screens aren't built. Weather and Find My are not started.
- **C, G:** see their notes in `docs/wip/`.
