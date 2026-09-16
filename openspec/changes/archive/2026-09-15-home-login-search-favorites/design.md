## Context

See proposal.md — Why. The app today is builder-at-`/` plus per-username public profiles, with ownership modeled as a browser-held claim token (SHA-256 hash stored server-side). There are no accounts, sessions, or sender identities: `POST /api/profile/:username/interactions` records `{ type, ts }`, and user records are `{ avatarDef, mood, tokenHash, createdAt, interactions }`. Stack: Node.js + Express, single `data.json` flat-file store behind a write queue, plain HTML/CSS/JS frontend with no build step, restrictive CSP, escape-on-render for all user strings. The change adds navigation pages, username search, per-user favorites, and sender attribution on pokes.

## Goals / Non-Goals

**Goals:**
- Keep the no-account ownership model; the claim token stays the only proof of identity.
- All pages share the existing avatar renderer so avatars look identical everywhere.
- Additive data model so existing `data.json` files load unchanged.

**Non-Goals:**
- No real authentication, passwords, sessions, or cookies.
- No server-side favorites list per visitor (favorites belong only to claimed, token-held profiles).
- No pagination of search beyond a fixed result cap.
- No friend-graph or who-added-me tracking.

## Decisions

### 1. Home page becomes a landing page; builder moves to `/create`
`/` serves a new small landing page (`home.html` or reworked `index.html`) with three entry points: create, login, search. The current builder markup moves to `/create` and keeps its existing `builder.js` behavior unchanged. Static routing via Express: `GET /` → `index.html`, `GET /create` → a new `create.html` (the old builder markup) — `express.static` already serves both once the files exist. Add explicit routes only where server logic is needed.

- Rationale: minimal churn — the builder's save flow, token storage, and profile redirect are untouched; only the entry URL changes.
- Alternatives: keeping the builder at `/` and adding a separate landing page at another path (contradicts the requirement that the home page is the landing page).

### 2. Login = username + token lookup in localStorage
`login.js` normalizes the entered username, and if `localStorage["buddy.token.<username>"]` exists, sets `localStorage["buddy.currentUser"] = username` and redirects to `/<username>`. If no token is stored, show "this profile isn't yours" plus a link to create a buddy. `buddy.currentUser` becomes the site-wide active identity marker that the favorites UI and sender-attribution use; it is only ever set when the matching token is present.

- Rationale: reuses the existing token model (spec: edits already depend on it); a single "who am I" key avoids guessing identity from arbitrary tokens in storage — the login page is the explicit "who am I now" step.
- Alternatives: iterating all `buddy.token.*` keys automatically (ambiguous when the browser holds several buddies' tokens); password login (violates the no-accounts design).

### 3. Sender attribution reuses the claim token inside the interaction POST
`POST /api/profile/:target/interactions` accepts `{ type, from?, token? }`. If `from` is present, normalized, `from !== target`, the profile `from` exists, and `token` hashes to `from`'s stored hash, the record stores `sender: from`; otherwise `sender: "guest"`. Frontend sends `from`/`token` from `buddy.currentUser` when present. Old records without a `sender` key are normalized to `"guest"` in `_publicUser`, so history is display-safe without a migration.

- Rationale: proves identity with the existing token mechanism (no new trust model), and guests remain first-class senders per the interactions spec.
- Alternatives: trusting a self-declared `from` username (spoofable), or adding cookies/sessions (against non-goals).

### 4. Favorites are a per-profile server list, token-gated
User records gain `favorites: []`. New store ops `getFavorites(username, token)` (resolves each favorited name to a public profile summary, dropping gone profiles), `addFavorite(username, target, token)`, `removeFavorite(username, target, token)` — all reject with 401 when the token doesn't match, and add/remove reject 404 when the target profile doesn't exist. API:
- `GET /api/profile/:username/favorites` — needs token; returns `{ favorites: [profile...] }`.
- `PUT /api/profile/:username/favorites` — body `{ token, target }`; adds and returns the fresh list.
- `DELETE /api/profile/:username/favorites` — body `{ token, target }`; removes and returns the fresh list.
UI: a `GET /favorites` page (reads `buddy.currentUser` + token, shows the list with avatars and remove buttons) and a favorite toggle on other profiles when the visitor is logged in.

- Rationale: favorites are owned data (spec: token required), stored with the owner, and a resolved-profile payload lets the favorites page render avatars without extra round-trips.
- Alternatives: client-side-only favorites in localStorage (loses cross-device identity and duplicates the "who am I" problem); a global favorites table (out of scope, ties favorites to accounts that don't exist).

### 5. Search is a capped substring match over usernames
`GET /api/search?q=` normalizes the query; blank/whitespace returns `{ results: [] }`. Otherwise it does a case-insensitive substring match over existing usernames, returns up to 20 public profiles (`username`, `avatarDef`, `mood`), sorted by username. `search.js` renders results with the shared avatar renderer and links to `/<username>`; no matches render an empty-state message.

- Rationale: matches the Buddy Poke "who exists?" mental model; flat `users` map makes it a linear scan cheap enough at this scale with no index.
- Alternatives: full-text / prefix index or a DB (overkill; revisit if the user count grows), exact-match-only (too strict for discovery).

### 6. No new dependencies and no CSP changes
All new pages and scripts are same-origin static assets under the existing CSP (`script-src 'self'`, `form-action 'self'`). Sender names, query strings, and favorites are rendered through existing `htmlEscape`/escape-on-render paths; sender usernames in history become links to `/<sender>` built server-side-free in JS.

- Rationale: keeps the no-build, minimal-dependency posture; the existing restrictive headers already fit.
- Alternatives: none worth the added surface.

## Risks / Trade-offs

- **`buddy.currentUser` is client-asserted, so sender identity depends on the browser holding the token** → the token hash check on the server is the real gate; `currentUser` only picks which token to present, it cannot fabricate one. Residual: a browser holding User A's token can poke as A — already the accepted token model.
- **Search is O(n) over all users** → capped at 20 results and acceptable for hobby traffic; swap to an index only if user counts explode.
- **Favorites can reference vanished profiles** → `getFavorites` drops missing profiles from the payload and never errors.
- **Old `data.json` records lack `favorites` and `sender`** → both are lazily defaulted (`favorites: []`, `sender: "guest"`) at read or write time; no migration step required.
- **Logged-in state is per-browser and per-device** → consistent with the no-accounts model; documented via the login page copy.

## Migration Plan

Additive only. Deploy the new code over an existing `data.json`: profiles gain `favorites` on first write, pokes gained `sender` are treated as `"guest"`, and new pages route automatically. Rollback = revert code; `data.json` remains readable by both old and new builds because the added fields are optional.

## Open Questions

- Whether favorites should also be removable directly from the favorites page or only from the buddy's own profile — the design includes both; adjustable without changing specs or tasks.
- Exact landing-page copy and visual treatment — cosmetic, decided during implementation.