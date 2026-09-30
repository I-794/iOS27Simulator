# Agent A handoff — Messages, FaceTime, Phone, Contacts

## Done (type-checks clean, no console errors in screenshots)
### Messages (`src/apps/messages/`) — feature-complete first pass
- `index.tsx` root NavStack + deep links `conv/<id>[/<msgId>]` (scroll + flash highlight) and `compose`.
- `ConversationList.tsx`: large title, filter menu (All/Unread/Mark All Read/Recently Deleted), compose button,
  pinned grid (big avatars, unread dot, preview bubble / typing dots), swipe rows (Read/Unread, Pin | Hide Alerts, Delete),
  long-press context menus, consolidated Tapback line ("Leo and Priya reacted ❤️‼️ to a photo"), drafts, failed/uploading previews,
  bottom glass search (name, nickname "Al", phone digits "555 010-3345", message text with highlighted snippets),
  "Messages in iCloud · Up to date" sync footer (offline / uploading states), Recently Deleted page with Recover.
- `Transcript.tsx`: iOS 26/27 header (glass back w/ unread badge, avatar + name pill → details sheet, FaceTime/phone button),
  bubbles w/ SVG tails, grouping, time headers, group sender names/avatars, Tapbacks (long-press → blurred overlay with tapback bar,
  "+" emoji grid, Reply/Copy/Save/Edit/Undo Send/Delete), reply quotes, Delivered/Read receipts, typing indicator,
  airplane-mode banner with "Turn Off", useOnscreen conversation entity, marks read on open.
- `Bubble.tsx`: photo/video (Scene), offloaded media with Download + progress ring, background upload progress bar + cancel,
  link preview, drawing (SVG, animated), audio bubble (play progress), location card, data detectors (dates → Create Event/Reminder,
  addresses → Directions, phone → Call, URLs → Safari, flight SK 482 → flight/mail), failed red "!" menu (Try Again / Delete).
- `Composer.tsx`: + menu (Camera, Photos, Drawing, Audio, Location), camera button → "recent camera" quick sheet (live tile + shutter
  sends instantly, recent grid multi-select), audio recorder, textarea with data-recipient/enterKeyHint=send/data-send-on-enter,
  Smart Reply chips (smartReplies), reply/edit banners, draft persistence.
- `engine.ts`: sendMsg (sending→delivered→read, failed when offline; service retries on reconnect), background upload loop
  (video sizeMB≈duration×4.4, e.g. cadence 414 MB), resumePending after reload, download of offloaded media, simulated replies
  (typing indicator, intent-aware), group reaction bursts + ONE consolidated notification.
- `detect.ts`: Apple Intelligence suggestions (Sam → Add to Reminders due tomorrow 8 AM + Add to Notes; Dad → "Search Photos: Biscuit beach"
  opens PhotoPicker filtered via searchPhotos and sends; dated messages → Add to Calendar) + data-detector spans.
- `PhotoPicker.tsx`, `DrawingSheet.tsx` (pen colors/widths/undo/clear → drawing attachment), `ConvDetails.tsx`, `NewMessage.tsx`, `msgStore.ts`.
- Verified: send+reply, tapback, reminder suggestion, photo request, drawing, airplane failure + auto retry, 414 MB upload while texting,
  dark mode, landscape, search by "Al" / "555 010-3345", compose to Grandma.

### Contacts (`src/apps/contacts/`) — done
- List w/ search, My Card (Jamie Park), sticky letters, draggable A–Z index, long-press menu; poster-style detail
  (`ContactDetail.tsx`, exported for reuse) with message/call/video/mail buttons, phones, FaceTime row, emails, address + map thumb,
  birthday, editable notes, favorites, Share Contact (share sheet), Share My Location, Block. Route `contact/<id>`.
- `shared.tsx`: cross-app helpers (callContact/facetimeContact/messageContact/mailContact/directionsTo, T9 keypad matching,
  fmtPhone, contactMatches) and `useRouteOnce` (dedupes useAppRoute, which fires twice under React StrictMode in dev).
- `contactsStore.ts`: persisted favorites/notes/blocked (shared with Phone).

## Partially done
### Phone (`src/apps/phone/`)
- `phoneStore.ts` (persisted recents incl. Skyward/Bolt/Rosa's/Lee Family Dental, voicemails with transcripts) and
  `callContext.ts` (data-driven Call Context from mails[].facts + events: SK 482/7XKQ2P/14C, Rosa's Sat 7 PM party 4 Park,
  BE-58213 + tracking + Friday, Dental Tuesday 3:30 PM Dr. Lee) are written and type-check.
- `index.tsx` is STILL THE PLACEHOLDER.
### FaceTime (`src/apps/facetime/`) — not started (placeholder).

## Exact next steps
1. Phone: `callStore.ts` (module-level zustand: phase dialing→active, startActivity({kind:'call', title, startedAt, app:'phone', priority:3}),
   subscribe to useOS activities so island "End call" ends the call, addRecent on end), `CallScreen.tsx` (dark poster bg, timer,
   glass buttons speaker/FaceTime/mute/add/end/keypad, DTMF keypad, Call Context glass card from `callContext()`),
   `index.tsx` with TabBar (Favorites/Recents/Contacts/Keypad/Voicemail) — reuse `ContactsList`/`ContactDetailPage` from contacts,
   keypad with T9 (`keypadMatches`), voicemail list w/ transcript + progress. Routes via `useRouteOnce('phone')`: `call/<id>`, `dial/<num>`.
   Status bar: `useShell.getState().set({ statusOverride: 'light' })` while call screen is visible.
2. FaceTime: recents + New FaceTime picker, incoming screen (route `incoming/<id>`), active call (animated remote video, draggable PiP,
   glass controls, dual camera, network-quality segmented Excellent/Fair/Poor/Lost with resolution badge/blur/audio-only/Reconnecting),
   startActivity kind 'facetime'; routes `call/<id>` and `audio/<id>` (Contacts' FaceTime Audio button already uses `audio/<id>`).
3. Messages polish ideas: swipe-left on transcript to reveal timestamps; landscape header is compact already.

## Known issues
- No type errors in my folders. Shared-file suggestion: `useAppRoute` in `src/os/hooks.ts` invokes the callback twice in dev StrictMode
  (effect re-run before the route is cleared) → apps push duplicate pages. Fix: track the handled `routeNonce` in a ref inside the hook.
- Details-sheet list styling uses `--sheet-bg: var(--grouped-background)` via inline style (verify in dark mode).
