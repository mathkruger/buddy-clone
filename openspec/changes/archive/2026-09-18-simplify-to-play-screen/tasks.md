## 1. Storage & API foundations

- [x] 1.1 Make `mood` nullable: update `_createSchema` (mood column allows NULL), `createProfile` (new accounts default mood to null so the buddy cycles humors), and add a small ALTER for existing DBs; verify `node --test tests/store.test.js` still passes and `UPDATE ... SET mood = NULL` works via the backend
- [x] 1.2 Default the appearance on registration: `profileService.create` accepts an optional `avatarDef` and persists `defaultComposition()` from `src/public/avatar.js` when none is supplied (keep rejecting a non-object `avatarDef` if one is given); verify `node --test tests/api.test.js --test-name-pattern "profiles"` passes
- [x] 1.3 Add a friend-preview endpoint `GET /api/profile/:username/public` (logged-in only) returning `{ username, avatarDef, mood }` without interactions/favorites; verify a new api.test.js case asserts it 401s anonymously and returns only the public fields
- [x] 1.4 Support clearing the humor: `profileService.update` accepts `mood: "none"` (writes null) while still validating the real humor names via `isValidMood`; verify `PUT /api/profile/:username` with `mood: "none"` returns a profile whose mood resolves to no-fixed-mood through the store

## 2. Routes & server-rendered views

- [x] 2.1 Rework `src/routes/pages.js` + `src/services/page-service.js`: keep `/` and `/login`; add `/register` (redirect logged-in users to `/play`) and `/play` (guarded by `requireAuth`, embeds `profileJson`); remove `/create`, `/search`, `/favorites`, and `/:username` routes and their page-service entries; verify with `node --test`
- [x] 2.2 Add 301 redirects for removed URLs: `/create` → `/register`, `/search` → `/`, `/:username` → `/play` (and `/login` success now redirects to `/play`); verify via `fetch` in a test that these respond 301 with the expected Location header
- [x] 2.3 Create `src/views/register.ejs` and `src/public/register.js`: username + password only form that POSTs to `/api/profiles` (no avatar fields), shows a duplicate/invalid-username error, and redirects to `/play` on success; verify the page serves 200 and the flow works through `node --test`
- [x] 2.4 Create `src/views/play.ejs` embedding `profileJson` in the `buddy-profile` script element, a main stage container, and the four tab regions (BuddyClone, Friends, Humor, Appearance); verify the served page (logged in) contains the inert payload and no raw angle brackets
- [x] 2.5 Serve every static asset the play/register screens use (`play.js`, `register.js`, `buddylabs.js`, `interactions.js`, `moods.js`, `buddy-3d.js`, `buddy-thumbs.js`) and drop the obsolete ones from the server-rendering static list; verify the 3D-assets test still enumerates working URLs

## 3. Play screen client

- [x] 3.1 Build `src/public/play.js` shell: loads the inline `buddy-profile`, mounts the buddy on the main stage via `mountAvatar` (respecting saved mood/absence of mood), and switches between the four tabs; verify the page renders the avatar and all tabs with `node --test` on the HTML output
- [x] 3.2 BuddyClone tab: render received pokes from the profile payload/fetch as messages (sender, type, time), with a replay control (local playback only, no POST via the `interactions.js` render-only path) and a poke-back control (`POST /api/profile/:sender/interactions`); verify new api.test.js cases cover feed rendering inputs and poke-back recording
- [x] 3.3 Friends tab: list friends (from `GET /api/profile/:username/favorites`) with avatar previews from `/public`, add by exact username (`PUT /favorites`) with not-found handling, remove (`DELETE /favorites`), and a poke control per friend that records the poke and plays the three-part scene on the stage; verify add/remove/poke cases in api.test.js
- [x] 3.4 Humor tab: render the six humors from `moods.js`; a click plays the animation locally on the stage, "Set as mood" persists via `PUT /api/profile/:username` with the mood name, and "None" clears it (mood null) so the stage cycles randomly through the `mood_*` animations while idle; verify humor set/clear purposes via api.test.js and the `moods.js` catalog stays unchanged
- [x] 3.5 Appearance tab: reuse the catalog loading, pickers, and thumbnails from `builder.js`/`buddy-thumbs.js` grouped into the requested categories (head, hair, clothes, shoes, hats, ears, addons) mapped onto the canonical composition fields, with a live stage preview and save via the existing avatar `PUT`; verify save persists the composition (api.test.js) and `avatar-catalog.test.js` still passes
- [x] 3.6 Add empty-state messaging: BuddyClone with no pokes and Friends with no friends each show an empty-state message and the Friends tab still shows the add-by-username control; verify via an assertion on the client data-path tests

## 4. Landing, register, login, and chrome

- [x] 4.1 Rework `src/views/index.ejs`: landing intro + a register CTA and a login CTA (no create/search/favorites entry cards); verify the served home page contains both CTAs and no `/create` or `/search` links
- [x] 4.2 Update `src/views/login.ejs`/`login.js`: submit posts to `/api/auth/login`, success redirects to `/play`, authenticated visitors requesting `/login` get redirected to `/play`; verify with api.test.js page cases
- [x] 4.3 Update the shared chrome (`nav-auth` in `partials/site-header.ejs` and `session.js`): remove create/search/favorites links, keep logout, and see that the login/register CTAs persist when logged out; verify through the "pages include the shared chrome" test
- [x] 4.4 Trim public surfaces: remove the `buddy-profile` payload and profile link from the embed widget flow (embed now links to `/play`) and delete unused `embed`-profile UI; verify `/embed/:username` still renders and stays frameable

## 5. Cleanup & test sweep

- [x] 5.1 Delete obsolete views/scripts/pages: `create.ejs`, `search.ejs`, `favorites.ejs`, `profile.ejs`, `builder.js`, `profile.js`, `search.js`, `favorites.js`, and any references in `server-rendering` static handling; verify no dangling imports or route references (`grep` for removed route paths in `src/`)
- [x] 5.2 Remove the search server surface: `src/routes/search.js`, `src/services/search-service.js`, `searchProfiles` backend usage, and the `/api/search` block; verify search spec-removal is consistent (no search endpoint responds anymore)
- [x] 5.3 Update `tests/api.test.js`: drop profile-shell, `/create`, search, favorites-page tests; keep/fix auth, favorites API, interactions, embed; add cases for register-with-default-composition, `/play` gating + embedded payload, `/public` preview fields, poke feed + poke-back, humor set/clear/none, and removed-route 301s
- [x] 5.4 Update `tests/smoke.test.js` to boot against its dedicated DB and exercise landing → register → play → favorites → poke → humor-set/clear through the new routes; verify `npm test` passes end-to-end
- [x] 5.5 Final gate: run `npm test` (all suites) and `npm start` smoke against a scratch DB, confirm landing/register/login/play render and old profile/search URLs redirect — then run `openspec validate simplify-to-play-screen` and report the outcome