## Context

The app is an Express + EJS server (JWT session via HttpOnly `buddy_token` cookie / Bearer header) with a three.js → `buddylabs` buddy renderer and a SQLite-backed repository. Everything needed for the play screen already exists as slabs:

- **Auth**: `POST /api/profiles` (creates account, auto-login), `POST /api/auth/login|logout`, `GET /api/auth/me`, guards `requireAuth`/`requireAuthApi`/`requireOwner` in `src/middleware/auth.js`.
- **Buddy data**: `avatarDef` canonical composition + `mood` per profile; `PUT /api/profile/:username` updates both via `profileService.update`. `defaultComposition()` in `src/public/avatar.js` is the canonical default.
- **Pokes**: catalog + three-part stage playback in `src/public/interactions.js`; `POST /api/profile/:username/interactions` records `(username, type, sender, ts)` via `interactionService.add`; `store.getProfile` returns `interactions` (limited to 50) per profile.
- **Favorites**: `GET/PUT/DELETE /api/profile/:username/favorites` via `favoritesService`, already a per-owner list by exact username.
- **Humors**: `MOODS` in `src/public/moods.js` map to the vendored animation subset (`mood_happy`, `mood_sad`, `mood_inLove`, `mood_angry`, `mood_giggle`, `mood_sleeping`) + `standBreathe` idle; `isValidMood`, `moodLabel` are shared server/browser.
- **Rendering**: `mountAvatar(container, { composition, mood, orbit })` in `src/public/buddy-3d.js`, thumbnails via `buddy-thumbs.js`, inline profile JSON via `pageService.inlineJson`.
- **Navigation**: `src/routes/pages.js` + `src/services/page-service.js` serve `/`, `/create`, `/login`, `/search`, `/favorites`, `/embed/:username`, `/:username`; `src/views/*.ejs` and shared partials.

Current excess surface to remove: create builder, search, favorites page, and per-user public profiles. The play screen is a new authenticated destination that reuses the slabs above.

## Goals / Non-Goals

**Goals:**
- Reduce the app to landing, register, login, and play.
- Play = one stage + four tabs (BuddyClone, Friends, Humor, Appearance) that reuse existing rendering, poke, favorites, and mood machinery — no new data model beyond what is needed for "no fixed mood".
- Keep API surface changes additive where possible (add `/play`, a friend-preview endpoint, optional `avatarDef` defaulting on create) and remove search/profile page routes.
- New accounts get the base default composition and no fixed mood, so their buddy immediately cycles humor animations.

**Non-Goals:**
- No account deletion, no registration email/verification, no password reset.
- No real-time push: the BuddyClone feed updates on load/refresh and after poke actions, not via websockets/SSE.
- No discoverability beyond exact-username friends (search stays removed).
- No new assets: only existing buddylabs catalogs and the vendored animation subset are used. New visual categories ("ears", "addons") map to existing catalog parts or are omitted.
- Data schema stays compatible with existing rows (no destructive migration of `avatarDef`/`interactions`/`favorites`).

## Decisions

### 1. `/play` as the single play screen; other page routes removed or redirected
Add `GET /play` (guarded by `requireAuth`) rendering a new `play.ejs` with `profileJson` embedded. Remove `/create`, `/search`, `/favorites`, and `/:username` from `pages.js`; delete `create.ejs`, `search.ejs`, `favorites.ejs`, `profile.ejs`, and their client scripts. Keep `/embed/:username` (public) and the API routes. Redirect (301) old bookmarks: `/create`→`/register`, `/:username`→`/play` (site navigation loses "search"; there is no sensible target, so `/search`→`/`).
- *Alternative considered*: a hash-routed single page. Rejected — EJS + shared-chrome model already exists and server-rendering spec requires real routes; hash routing would discard the SSR layout work.

### 2. Create moves onto registration with the default look
`POST /api/profiles` currently requires a client-supplied `avatarDef`. Change `profileService.create` so the account always persists `defaultComposition()` (single source of truth already lives in `src/public/avatar.js`), while the create route keeps accepting an optional `avatarDef` to avoid a hard contract break for API tests. `register.js` submits username+password only; logout stays in the header.
- *Alternative considered*: keep a builder page and add tabs underneath. Rejected — the user asked to drop buddy pages entirely; customization lives in the Appearance tab.

### 3. Nullable `mood` = "random cycling", with Humor "None" clearing it
Today `users.mood` is `NOT NULL` with `DEFAULT_MOOD = "happy"`. To honor "when nothing is selected, cycle randomly", make `mood` nullable: new profiles (and profiles that pick "None") store `null`; the client cycles through the six `mood_*` animations while idle. `_createSchema` and `createProfile` default mood to `null` for new rows (existing rows keep their current mood); `updateProfile(mood: "none")` writes `null`. `moodLabel`/rendering treat `null` as "no fixed mood".
- *Alternative considered*: invent a pseudo-mood (`mood_none`) in the enum. Rejected — `isValidMood` gates the API and a fleet of one-off cases would leak into `MOOD_ORDER`, embed, and labels; a nullable column is the honest model.

### 4. Friends tab reuses the favorites endpoints; friend preview via a light public profile
Add/remove/list stay on `GET/PUT/DELETE /api/profile/:username/favorites` (owner-guarded). To render a friend's avatar on the Friends rows and as the target in a poke scene, add `GET /api/profile/:username/public` (or a query on the existing GET) returning only `{ username, avatarDef, mood }`, accessible to any logged-in user — no interactions/favorites leakage. The poke stage then has three parts: my avatar (from my profile) on one side, the poke effect, the friend's avatar (from `/public`) on the other, reusing `interactions.js` CATALOG.
- *Alternative considered*: reuse `GET /api/profile/:username`; rejected — it currently returns the full profile including interaction history, which would leak data when the target is someone else's account.

### 5. Pokes-as-messages read the existing interactions rows
The feed for the BuddyClone tab is produced from `store.getProfile(me).interactions` (already sender + type + ts, capped at the last 50) embedded in the play page or fetched from `GET /api/profile/:username`. The poke-send endpoint already attributes the authenticated sender; `interactionService.add` already rejects self-poke and unknown targets (profile is looked up at record time). Replay uses `interactions.js` render-only path; poke-back is a normal `POST /api/profile/:sender/interactions` with an `is-replay` client flag omitted server-side (replay just re-renders locally, no POST).
- *Alternative considered*: new `messages` table with read/unread state. Rejected — would duplicate what `interactions` already records; the user asked for pokes treated as messages, not a full inbox.

### 6. Appearance tab wraps the existing builder controls
Reuse the catalog loading, picker rendering, and color/material controls from `builder.js`/`buddy-thumbs.js` inside the Appearance tab, grouped per the requested categories (head, hair, clothes, shoes, hats, ears, addons) mapped onto the canonical fields where they exist (e.g. hats → `hair` catalog items with hats, ears → available `hair`/face parts, addons → `props`). Save via existing `PUT /api/profile/:username` with `avatarDef`; the stage re-renders live. Obsolete fields continue to be normalized by `normalizeComposition`.
- *Alternative considered*: a separate builder page opened from the tab. Rejected — the change explicitly wants one screen.

### 7. Humor tab maps to the mood API
Playing = `buddylabs` animation playback on the stage (no persistence); "Set as mood" = `PUT /api/profile/:username` with `mood`; "None" = same call with `mood: "none"` writing null. Preview does not hit the server; set/clear do.

## Risks / Trade-offs

- **Existing rows keep a fixed mood** → they never randomly cycle until the owner picks "None". Acceptable (preserves stored look), documented in the Humor tab via the active-mood highlight.
- **Removing public profiles is breaking for anyone linking to `/:username`** → add 301 redirects from `/:username` to `/play` and `?user=` query not viable; we redirect to `/play` and keep `/embed/:username` as the one public entry point (Revisit if the embed must die).
- **Pokes feed is "last 50", no read/unread state** → treated as messages by presentation only; acceptable scope, revisit as a follow-up.
- **Random-cycle is client-side `mood_*` rotation** → if the renderer is disabled (no WebGL), the SVG fallback shows the base look; same fallback as today, not a regression.
- **`PUT /api/profile/:username/mood: "none"` touches shared mood validation** → keep `isValidMood` for the enum and add an explicit `"none"` sentinel only in the API layer; embed still treats `null` as "no mood badge".

## Migration Plan

1. Server: make mood nullable + null default on create ("none" clears); default `avatarDef` on create; add `/public` friend-preview; add `/play` route + `register.ejs` + `play.ejs`; remove `/create`, `/search`, `/favorites`, `/:username` routes with 301s (`/:username`→`/play`, `/create`→`/register`, `/search`→`/`).
2. Client: new `play.js` (stage + 4 tabs), `register.js`; re-point header nav/logout; delete `builder.js`, `profile.js`, `search.js`, `favorites.js`, `create.ejs`, `search.ejs`, `favorites.ejs`, `profile.ejs`; keep `interactions.js`, `moods.js`, `buddylabs.js`, `buddy-3d.js`, `buddy-thumbs.js`, `widget.js`, `avatar.js`.
3. Landing/register/login: update `index.ejs` (register + login CTAs), `login.ejs` (redirect to `/play`), add `register.ejs`; header `nav-auth` unchanged.
4. Tests (`node --test`): update API/smoke suites to the new routes; cover register-with-default-look, `/play` gating + embedded payload, add-friend-by-username, poke → feed entry, poke-back, humor set/clear/none, removed-route redirects. `/embed/:username` stays covered.
5. Assets: `scripts/fetch-minepoke-assets.mjs` untouched (no new assets).

Rollback: keep commits that remove routes isolated to the route/view layer so the old pages can be restored by reverting; the nullable mood + default-composition changes are additive to the DB and roll back by reverting the migration lines.

## Open Questions

- Whether the embed widget should survive this simplification at all (it is the one remaining public "buddy page"). Kept for now; can be removed independently later without affecting the play-screen contract.
- Whether the BuddyClone feed should keep a local-only "sent" thread (a running log of pokes you sent) in addition to received pokes. Not needed by the spec; client-side only if wanted later.
- Username validation on add-friend: exact match, and whether normalized usernames should get a specific "not found" vs "invalid chars" message. Deferrable to implementation without changing behavior.