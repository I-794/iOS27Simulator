# Agent C handoff: Safari, Mail, Notes, Files, Preview

Status: **all five apps are built and have been checked with screenshots** in portrait, landscape and dark mode.
- `npx tsc -p tsconfig.app.json --noEmit | grep -E 'src/apps/(safari|mail|notes|files|preview)'` reports no errors.
- A smoke run across all five apps printed no console errors.
- No shared files were edited and no dependencies were added.

## Safari (`src/apps/safari/`): done (see the earlier version of this note in git history for the full feature list)
- Built-in demo sites, bottom glass bar, tab overview with Organize by Topic, tab groups, Notify Me, Describe an Extension, Reader with summary and Listen, translate, zoom, Find on Page, Start Page.
- Screen Time "Ask to Browse" flow, landscape top bar, onscreen page text for Siri.
- Routes: `url/`, `search/`, `newtab`.

## Mail (`src/apps/mail/`): done and verified today
Fixes made today:
- MessageView had a zustand selector that returned a new array on every render, which caused an infinite loop. It is now computed with `useMemo`.
- Swipe actions: releasing a swipe no longer snaps the row shut (a `justDragged` guard). Tapping an open row now closes it instead of opening the message.
- AI summaries now come from the email's structured facts through `mailSummary()` in `model.ts`, used for both previews and the Summarize card.
- Smart Reply chips are context-aware: reservation, order, flight, and a respectful tone for teachers.
- Landscape now respects the side safe areas.

Checked with screenshots: Inbox, Priority section, category chips, swipe actions, select mode, message view with suggestion buttons, Summarize, Smart Reply and compose, the attachment sheet rendering the itinerary PDF, search with suggestions and Top Hits, dark mode, landscape.

## Notes (`src/apps/notes/`): new today
- `index.tsx`:
  - Folders page: search across every note, iCloud folders, a shared Robotics folder with collaborator avatars, Recently Deleted, a Shared section, and a New Folder sheet.
  - Note list: search, Pinned section, date sections, drawing/photo thumbnails, and a context menu (Pin, Copy as Markdown, Move, Share, Delete).
  - Editor:
    - Menu: Summarize (built from the note's structure), Copy as Markdown (sheet plus clipboard), Paste Markdown (sheet with live preview, inserts into the note or makes a new one), Export .md, Pin, Move, Lock, Delete.
    - Section links jump to the heading and flash it. A link picker sheet adds new links.
    - Empty notes are removed after you leave them. This is deferred so React StrictMode's double mount doesn't delete a brand-new note.
    - `useOnscreen('notes', title, {type:'note', title, text})`. Route `note/<id>`.
- `editor.tsx`: the block editor.
  - Each block is an auto-sizing textarea, so the simulated keyboard and Write with Siri work.
  - Enter splits the block or continues the list. Backspace at the start merges into the previous block or converts the block back to body text.
  - Blocks: checklists you tap to toggle, bullets, dividers, code, quotes, editable tables (add/remove rows and columns, delete table), drawings (sheet with pens, highlighter, undo, clear), photos stored as `![alt](scene:<key>)` paragraphs, section links.
  - Formatting toolbar that sits above the keyboard: Aa styles (Title/Heading/Subheading/Body/Monostyled plus list, checklist, quote), checklist, table, divider, section link, attach photo, draw, done.
- `markdown.ts`: `toMarkdown` / `fromMarkdown`. Headings keep their ids as `{#id}`, checklists as `- [ ]`, tables as pipe tables, links as `[text](#id)`.

## Files (`src/apps/files/`): new today
- Floating tab bar with Recents, Shared and Browse; each tab has its own NavStack.
- Browse: Locations (iCloud Drive folders, On My iPhone holding the extra-format samples, Recently Deleted), Favorites, colour tags, search.
- Icon/list view toggle and sorting, both persisted (`ios27-files`).
- File viewer renders through `preview/docs` and hides the tab bar while open.
  - Collaboration banner, for example "Shared by Alex · 3 people".
  - Info sheet.
  - Collaborate sheet: people and roles, invite, link access (invited / anyone can view / anyone can edit), Copy Link, Stop Sharing.
- Access request: "Nora Kim requested access to Robot Budget 2026" with Approve or Deny, shown on the Shared tab and in the Collaborate sheet. Approving adds Nora as an editor.
- Route `file/<id>`.

## Preview (`src/apps/preview/`): new today
- `docs.tsx`: now also exports `EXTRA_FILES` and `ALL_FILES`. It renders Markdown, a sortable CSV, EPUB book pages, RTF and a Keynote slide grid.
- `index.tsx`:
  - Home: Scan Documents and Open File tiles, Recents, and a "More formats in iOS 27" list with sample files.
  - Viewer: page indicator, Markup with pen, highlighter, eraser (tap a stroke), undo and 4 colours; strokes are saved per document in `ios27-preview`.
  - Export as PDF: options, then a progress bar, then "Saved in 0.2 s" with an iOS 26 vs iOS 27 speed bar.
  - Info sheet.
  - Simulated scanner: auto-capture, shutter, save. Saved scans appear in Recents.
  - Routes: `file/<id>`, `markup/<id>` (Files uses this for its Markup button), `scan`.

## Known issues / notes
- Playwright typing at 10 ms per key can drop characters. This appears to be caused by the simulated keyboard's per-keystroke re-render; it is fine at human speed.
- Section-link jumps can only scroll as far as the note's length allows.
- Markup coordinates on non-letter pages (images, sheets) are slightly stretched because of `preserveAspectRatio="none"`.
- Files' `useOnscreen` uses an entity `type: 'file'`, which Siri's onscreen handling doesn't understand yet (harmless).
