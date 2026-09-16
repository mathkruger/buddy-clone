## 1. Server and storage foundation

- [x] 1.1 Initialize `package.json`, install `express`, and create `server.js` that serves the `public/` directory on a fixed port — verify `npm start` serves the home page
- [x] 1.2 Implement `store.js`: JSON-file store (`data.json`) with in-memory cache and atomic write (temp file + rename), plus a single-process write queue — verify a restart preserves data and writes survive concurrent requests
- [x] 1.3 Implement `POST /api/profiles` to create/claim a profile: validates username (non-empty, allowed charset), returns a 128-bit claim token on success and stores only its SHA-256 hash, returns 409 for an existing username — verify with curl both the success and duplicate cases
- [x] 1.4 Implement `GET /api/profile/:username` returning avatar, mood, and interaction summary; implement `PUT /api/profile/:username` for avatar/mood updates that requires the matching claim token and rejects mismatches — verify with curl with and without the token
- [x] 1.5 Implement `POST /api/profile/:username/interactions` recording `{ type, ts }` and bounded history (last 50 kept), rejecting unknown usernames with 404 — verify with curl including the 404 case

## 2. Avatar renderer and builder

- [x] 2.1 Design an original avatar part set as inline SVG: several head shapes, eyes, mouths/expressions, accessories, and color palettes — verify each part renders as a standalone SVG snippet
- [x] 2.2 Implement shared `avatar.js` renderer that turns a parts composition + mood into one inline SVG string, deterministically (same input → identical output) — verify by calling it from a script and diffing outputs
- [x] 2.3 Implement the builder on the home page (`index.html` + `builder.js`): live preview, per-category part pickers, color selection, username form, and saving that stores the claim token in `localStorage` — verify the flow end-to-end in-browser and that the profile link appears after save
- [x] 2.4 Handle taken/invalid usernames in the builder: show an inline validation error, keep the in-progress avatar intact, and never persist on failure — verify manually for blank, malformed, and duplicate usernames

## 3. Profiles and mood

- [x] 3.1 Implement `GET /:username` profile shell with inline profile data and a 404 not-found page for unknown usernames — verify with curl and in-browser
- [x] 3.2 Implement `profile.js`: renders the avatar with current mood, shows interaction history, and gates edit controls on the presence of the matching claim token in `localStorage` — verify owner vs visitor browser sees different UI
- [x] 3.3 Implement the mood system: define the `MOODS` table (named moods → expression/accessory visual deltas, e.g. happy, sad, love, angry, excited, sleepy), the mood change control, `PUT` persistence, and re-render — verify changing mood updates avatar appearance and persists across reload
- [x] 3.4 Escape all user-supplied strings (username display, mood name) so injected markup renders as text; add a restrictive CSP header — verify a malicious `<script>`-style username renders literally and triggers no execution

## 4. Embed widget

- [x] 4.1 Implement the `/embed/:username` widget page (minimal HTML + `widget.js` reusing `avatar.js`) that fetches profile data and renders avatar + mood with a footer link back to the profile — verify it renders in an iframe and shows the profile link
- [x] 4.2 Implement the embed snippet generator on the profile page that copies a sandboxed iframe snippet (`allow-scripts allow-same-origin`) — verify pasting the snippet into a scratch HTML page renders the widget
- [x] 4.3 Verify the widget reflects the current mood without re-copying the snippet: change the owner's mood, reload the host page, and confirm the widget shows the update — verify manually and confirm no host-page styles leak through the iframe

## 5. Interactions

- [x] 5.1 Build `interactions.js` with an original animation catalog (e.g. poke, hug, high-five) as SVG/CSS sequences over the avatar — verify each animation plays on its own in-browser
- [x] 5.2 Add the interaction trigger UI to the profile and wire POST recording + recent-history display (type, time, count) — verify an interaction appears in history after triggering
- [x] 5.3 Verify playback behavior: animations play in place without page reload, a repeat trigger restarts/interrupts cleanly, the sender avatar (claimed or default guest) appears as designed, and attempts against non-existent users are rejected — verify manually across all cases

## 6. Verification and polish

- [x] 6.1 Add automated tests with Node's built-in test runner covering the store, API auth/token flows, and interaction validation — verify `npm test` passes
- [x] 6.2 Polish the visual look and feel to evoke the Buddy Poke era (chibi rounded avatars, playful color scheme) using only original art — verify a visual review of home, profile, and widget
- [x] 6.3 Run an end-to-end smoke test: claim a username → build avatar → change mood → generate embed snippet → send an interaction from a visitor session → confirm profile, widget, and history all reflect the changes — verify each scenario from the capability specs passes