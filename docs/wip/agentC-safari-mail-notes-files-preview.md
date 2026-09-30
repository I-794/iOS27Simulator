# Agent C handoff: Safari, Mail, Notes, Files, Preview

Status as of this stop: **Safari is done and verified. Mail is written, type-checks and renders, but has had only a smoke test. Notes, Files and Preview are still placeholders.** Preview has a shared document renderer that Mail already uses.

`npx tsc -p tsconfig.app.json --noEmit | grep -E 'src/apps/(safari|mail|notes|files|preview)'` reports no errors.
No shared files were edited. No dependencies were added.

## Safari (`src/apps/safari/`): done, verified with screenshots
- `model.ts`
  - URL helpers: `normalizeInput`, `resolve`, `searchUrl`, `isBlocked`.
  - Local persisted store `ios27-safari`: bookmarks, reading list, extra tab groups, active group, per-host zoom, reader prefs, cart, hidden Start Page sections.
  - Per-tab back/forward is kept for the session only.
  - Tab actions, `organizeByTopic()`, and `askPermission()` for Screen Time. Approval arrives after 4.5 s and updates `approvedSites` and `pendingRequests`, then sends a notification.
- `web.tsx`: page primitives.
  - `A` handles in-app links and `Jump` handles anchors.
  - `D` marks dates (`.sf-date`) and `Price` marks prices (`.sf-price`).
  - `Ad` renders `.sf-ad`, and `useWatch` reads Notify Me watches.
- `sites1.tsx` and `sites2.tsx`: every `SAFARI_SITES` entry is a real page, plus the "Search" results page and the Screen Time restricted page.
  - Covered pages: weather, radar, chemistry, Lincoln calendar (Add to Calendar), headphones, SBC kit, forum, parts store, news, music, GameZone, VideoTube.
- `pages.tsx`: URL-to-component map, the Notify Me `WATCHABLE` table, and the word-level Spanish translator (DOM text nodes).
- `extensions.ts`: Describe an Extension. It turns a prompt into CSS plus a manifest using rules, and `scopeCss` scopes the CSS to `.sf-webview`.
- `index.tsx`: the browser.
  - Bottom glass bar, which collapses on scroll. Swipe the pill to switch tabs. It becomes a top bar in landscape.
  - aA page menu: zoom, Reader, Listen, Translate, Notify Me, Find, extension toggles, Describe and Manage, Hide Toolbar, Privacy Report.
  - ··· menu: Share, Copy Link, Bookmark, Favorites, Reading List, Library, Find, New Tab, Tabs.
  - Address editing with suggestions (Top Hit, completions, bookmarks and history, sites, On This Page).
  - Find on Page uses CSS Highlights. Reader view has AI summary, read-along Listen and themes.
  - Start Page shows the real load time in ms. It has an Edit sheet.
  - Tab overview: live thumbnails, swipe or X to close, a context menu for moving tabs between groups, and Organize by Topic with an animated reflow.
  - Tab group menu with New Empty Tab Group.
  - Sheets: Library (Bookmarks, Reading List, History, Watching), Notify Me, Extensions, Privacy/Performance.
  - Onscreen awareness sends `{type:'page', url, title, text}`, where text is the `.sf-main` innerText.
  - Routes: `url/<u>` opens the tab that already has the URL, or a new tab. `search/<q>` is URI-decoded. `newtab`.
- Known quirks:
  - Playwright typing at 10 ms per key can drop characters in the Find field. Human-speed typing is fine.
  - The translator is word-level, so the Spanish is intentionally rough.

## Mail (`src/apps/mail/`): code complete, only lightly tested
- `model.ts`
  - Local store `ios27-mail` holds VIP emails and the chosen category.
  - Mailbox filters, priority detection, AI preview summaries, `whenFromFacts`, move/patch/delete helpers.
  - Cleanup needed: `findExistingEvent` currently matches by start time only (the title check is dead code, `|| true`).
- `index.tsx`
  - The Mailboxes root pushes Inbox on mount.
  - Inbox:
    - Category chips (Primary, Transactions, Updates, Promotions, All Mail) with unread dots.
    - Priority section, rows with unread dot, VIP star, clip and flag icons, and 2-line AI summaries.
    - Swipe actions: right for read/unread; left for More, Flag and Archive/Trash, with full swipe archiving. Right-click opens a menu.
    - Select mode with Mark, Move, Flag and Trash. Unread filter, and a bottom glass bar with search and compose.
  - Search: suggestions for people (from:) and subjects (subject:), Top Hits from `search(q,{types:['mail']})`, a boost for VIP and unread mail, highlighted matches, a mailbox scope toggle, and a 120 ms skeleton.
  - Message view:
    - 120 ms skeleton, marks the message read, `useOnscreen('mail', subject, {type:'mail', mailId})`.
    - Summarize card for long mails.
    - Suggestion chips: Directions → maps `route/rosas`; Add to Calendar from `facts.when` (shows In Calendar and opens the event); for flights, Calendar plus Wallet `card/w-boarding`; Track Package opens a sheet that can start or stop the `delivery-bolt` Live Activity.
    - Attachment sheet renders the PDF through `preview/docs` and has Open in Preview (`preview` route `file/<id>`).
    - Smart Reply chips pre-fill a reply. Thread stubs link replies to the original. A Move sheet is included.
  - Compose sheet:
    - To field with contact suggestions, Cc, Subject, body (`data-mail="1"`, `data-recipient`), and attachments.
    - Send adds the mail to Sent, then shows a 5 s Undo Send banner.
    - Cancel offers Save Draft or Delete Draft. Tapping a draft reopens it.
  - Routes: `mail/<id>` and `compose/<subject>`.
- Next steps:
  - Screenshot the message view, compose, search, swipe and edit mode, dark mode and landscape.
  - Verify the `mail/<id>` route timing (it uses popToRoot followed by pushes).

## Preview (`src/apps/preview/`)
- `docs.tsx` and `docs.css` (class prefix `pvd-`) are done.
  - `DocPages`, `DocThumb`, `pagesFor`, `fileById`, `fileByName`, `pageCount`.
  - Paper mockups for every FILES entry: rules PDF, worksheet, concert program, itinerary, sheet music, scanned permission slip, Pages lab report, Numbers budget, HEIC image, CAD model.
- `index.tsx` is **still a placeholder**. To do:
  - Browse/Recents list, `file/<id>` route, scan (Camera route `scan` or a simulated scan).
  - Markup overlay (pen and highlighter SVG over each page, using `DocPages renderOverlay`).
  - Export as PDF showing "Saved in 0.2 s".
  - A formats list (PDF, images, EPUB, RTF, Markdown, CSV, Keynote/Pages) with simple renderers for a sample `.md` and `.csv`.

## Notes (`src/apps/notes/`): not started (placeholder)
To do:
- Folders (Notes, School, Robotics, Band, Shared), a list with a pinned section and search.
- Editor that renders every NoteBlock, with section links using `scrollIntoView` to heading `id`s.
- Editing: use **textarea/input** per block, not contentEditable, because the simulated keyboard only attaches to input and textarea.
- Aa toolbar, checklist, table, divider, drawing canvas, photo.
- Copy as Markdown and a Paste Markdown sheet, a Summarize note action, `useOnscreen('notes', ...)`, and the `note/<id>` route.

## Files (`src/apps/files/`): not started (placeholder)
To do:
- Browse, Recents and Shared tabs; locations; grid/list toggle.
- Preview through `DocPages` from `../preview/docs`.
- Collaboration labels ("Shared by Alex · 3 people"), the pending access request "Nora requested access to Robot Budget 2026" with Approve/Deny, the collaboration link sheet, and the `file/<id>` route.

## Shared-file notes (no changes made)
- `tests/shot.mjs`: `locator('.screen').screenshot` timed out late in the session even though `.screen` exists and `page.screenshot()` works. This is probably caused by a shell change from another agent. The workaround is a full-page screenshot.
