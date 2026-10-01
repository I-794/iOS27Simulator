# Agent A handoff — Messages, FaceTime, Phone, Contacts (status: all four apps complete)

All folders type-check clean; screenshot-verified in light/dark, portrait/landscape; no console errors.

## Messages (`src/apps/messages/`)
List (pins, swipe/long-press actions, unread filter, Recently Deleted, consolidated Tapback line, iCloud sync footer, bottom search by
name/nickname "Al"/phone "555 010-3345"/text), transcript (tails, grouping, receipts, Tapbacks + emoji, inline Reply/Edit/Undo Send,
data detectors, offloaded download, background 400 MB upload, failed "!" + auto-retry, airplane banner), composer (+ menu, quick camera,
drawing sheet, audio recorder, Smart Reply chips, data-recipient), Apple Intelligence suggestions (Reminders/Notes/Photos/Calendar),
details sheet, New Message. Nora Kim is an Android/RCS contact (green bubbles, "RCS" header tag, "Text Message • RCS"); inline Reply works there.
Workaround in engine.ts `fixNotificationTitle`: store.receiveMessage titles 1:1 notifications with the raw contact id (e.g. "nora").

## Contacts (`src/apps/contacts/`)
List + index + My Card; poster detail (`ContactDetailPage`, reused by Phone/FaceTime); `shared.tsx` cross-app helpers
(callName, keypadMatches, directionsTo, useRouteOnce — now redundant since useAppRoute was fixed, harmless).

## Phone (`src/apps/phone/`)
Floating glass TabBar: Favorites (+ add, long-press remove), Recents (All/Missed, grouped counts, businesses), Contacts, Keypad
(T9 letters, pressed states, contact/T9 matching, hold 0 → +, hardware keys), Voicemail (transcripts with word highlight, scrubber,
speaker/call back/delete, greeting sheet). `callStore.ts`: dialing→active, 'call' Live Activity (id phone-call), island hang-up ends
the call, recents logged. `CallScreen.tsx`: glass buttons (audio route, FaceTime handoff, mute, add/merge, end, DTMF keypad), minimize
pill, Call Context card from `callContext.ts` (mail facts + calendar). Routes: `call/<id>`, `dial/<num>`, tab names.

## FaceTime (`src/apps/facetime/`)
Create Link (share sheet), New FaceTime picker (Audio/Video), poster tiles + recents, incoming screen (Remind Me/Message/Decline/Accept,
ringtone; route `incoming/<id>` and a "Test incoming call" footnote button; the automatic demo call was removed),
active call: procedural canvas remote video, draggable/snap-to-corner self-view PiP, flip, dual camera (split / picture-in-picture),
glass control bar (mute, camera, flip, speaker route, SharePlay sheet, end), auto-hiding controls, network simulator
(Excellent 1080p / Fair 540p blur / Poor 180p pixelated → audio-only fallback card / Lost → Reconnecting… → auto-recover),
'facetime' Live Activity (id facetime-call). Routes `call/<id>`, `audio/<id>`, `video/<id>`, `incoming/<id>`.

## Known issues / ideas
- Shared keyboard's bottom row wraps "English · Español" in landscape (not my file).
- Phone "Add" merges calls cosmetically (name "Mom & Alex"); no real multi-party state.
