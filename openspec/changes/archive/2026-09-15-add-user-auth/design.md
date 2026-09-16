## Context

The app (Express + EJS SSR, SQLite via `node:sqlite`, no auth dependencies) currently identifies owners purely by an opaque claim token minted at creation and kept in `localStorage` (`buddy.token.<username>`). "Login" is a client-side check for that token; the server never authenticates anyone. Profile pages, search, and pokes are all public, and interactions fall back to a `guest` sender. The proposal (`add-user-auth/proposal.md`) replaces this with real accounts: username + password verified server-side, JWT sessions, gated views/actions, and a public embed widget as the only anonymous view of a buddy.

Requirements are in the delta specs (`add-user-auth/specs/*`). This document covers the technical approach only.

## Goals / Non-Goals

**Goals:**
- Server-side accounts: new buddy creation requires a password; passwords stored as bcrypt hashes.
- JWT sessions usable two ways: HttpOnly cookie for SSR page gating, `Authorization: Bearer` for API calls.
- Enforce the auth boundary at the route layer so no protected data is reachable anonymously.
- Keep legacy data on disk and in the DB, with non-password accounts inert but still viewable/embeddable.
- Minimal churn to existing file layout (routes/services/public modules stay where they are).

**Non-Goals:**
- Password reset / email verification / account recovery.
- Rate limiting, lockout, or brute-force protection.
- Token revocation or server-side logout; sessions are cleared client-side and expire.
- Roles/permissions beyond "owner of a username".
- CSRF tokens (mitigated via SameSite=Lax and JSON-only mutation endpoints).
- Multi-device session management.

## Decisions

### 1. Dependencies: `bcrypt` + `jsonwebtoken`
Password hashing uses `bcrypt` and JWT signing uses `jsonwebtoken` (user-selected). `bcrypt.hash(password, 12)` at creation; `bcrypt.compare` at login. JWT is HS256 with `jsonwebtoken.sign/verify`.

*Alternative considered:* hand-rolled scrypt + HMAC JWT with `node:crypto` — rejected by user; the two packages are standard, audited, and remove bespoke crypto code.

### 2. Data model: `passwordHash` column; claim tokens retire
`users` gains `passwordHash TEXT` (NULLable). The existing `tokenHash` column stays (avoiding destructive migration and preserving imported legacy data) but is no longer consulted for authentication. New profiles are created only with a username + password and store only the bcrypt hash. No response ever contains `tokenHash` or `passwordHash`.

Schema migration in `src/repository/db/sqlite.js`: after `CREATE TABLE IF NOT EXISTS`, check `PRAGMA table_info(users)` and `ALTER TABLE users ADD COLUMN passwordHash TEXT` when missing (idempotent for existing `data.db`).

### 3. JWT construction
- Payload: `{ sub: <normalized username>, iat, exp }`.
- Algorithm: HS256. Secret from `JWT_SECRET` env; dev fallback constant with a startup `console.warn` (production must set it).
- Expiry: `JWT_EXPIRES` env, default `7d`, passed as `expiresIn`.
- `jsonwebtoken.verify` errors (expired/tampered) are treated as "no session", never as "session".

### 4. Session transport and auth middleware
New `src/middleware/auth.js` exposing:
- `attachUser(store, config)` — optional auth: resolves the user from (a) `buddy_token` cookie or (b) `Authorization: Bearer` header into `req.auth = { username }`; anonymous stays `req.auth = null`.
- `requireAuth` — for page routes: anonymous → `302 /login`.
- `requireAuthApi` — for API routes: anonymous → `401 { error }`.
- `requireOwner` — `req.auth.username` must equal the route/body target username, else `401`/`403`.

Cookie `buddy_token`: `httpOnly`, `sameSite: "lax"`, `secure: NODE_ENV === "production"`, `path: "/"`. Set on login and on creation (auto-login); cleared on logout.

*Alternative considered:* cookie-only or localStorage-only. A dual transport keeps the user's "JWT for the APIs" requirement while still letting SSR page GETs (which can't read `localStorage`) be gated server-side.

### 5. Auth service and routes
New `src/services/auth-service.js`:
- `login(username, password)` → bcrypt compare; issues JWT and sets the cookie.
- `logout()` → clears the cookie.
- `me()` → returns the current user from the (optional) middleware.

New `src/routes/auth.js`:
- `POST /api/auth/login` `{ username, password }` → `200 { user: { username } }` + Set-Cookie; generic `401` for unknown user or wrong password (same message, no enumeration).
- `POST /api/auth/logout` → clears cookie, `204`.
- `GET /api/auth/me` → `200 { user: { username } }` or `200 { user: null }` (drives `session.js` + the `#nav-auth` slot).

### 6. Enforcement points
- **Create** (`POST /api/profiles`): now accepts `{ username, avatarDef, password }`, requires a minimum password length (8), rejects with `403` when `req.auth` is present ("log out to create"), bcrypt-hashes, persists, and auto-logs-in (Set-Cookie). Response is `{ username, profile }` — no claim token. Login page's existence pre-check (`GET /api/profile/:username`) is removed; `login.js` goes straight to the auth API.
- **Profile page / edit** (`/:username`, `PUT /api/profile/:username`, likes via `favorites` routes): `requireOwner` (page: `requireAuth` + `:username`; anonymous → redirect). `PUT` body drops `token`; identity comes from `req.auth`.
- **Interactions** (`POST /api/profile/:username/interactions`): `requireAuthApi`; sender = `req.auth.username` captured server-side (the `from`/`token` claim mechanism in `store.resolveSender` is deleted). Self-poke is allowed and attributed to the self. Legacy `guest` senders (only from pre-auth data) still render as `guest`.
- **Search** (`/search` page and `GET /api/search`): `requireAuth` / `requireAuthApi`. Anonymous visitors redirect/401.
- **Favorites** (`GET/PUT/DELETE /api/profile/:username/favorites`): `requireOwner`; `token` query/body params removed, cookie authenticates.
- **Embed** (`/embed/:username`): stays public, no middleware.
- **Login page** (`/login`): authenticated visitors → redirect to `/:username`.

`GET /api/profile/:username` becomes `requireAuthApi` (it is only used by the old login existence check; the embed widget reads its inline JSON payload, not this endpoint).

### 7. Page gating in `pagesRouter`
Apply `requireAuth` inline for `/search`, `/favorites`, and the `/:username` handler (before rendering), while `/`, `/create`, `/login`, and `/embed/:username` remain public. `/create` serves normally but passes `viewer = req.auth` so the template can show a "log out first to create a new buddy" notice and hide the form when logged in.

### 8. Client updates
- `session.js`: replace localStorage tokens with a server-backed session — `BuddySession.currentUser` is fetched once from `GET /api/auth/me` (cookie travels automatically on same-origin fetches); `logout()` calls `POST /api/auth/logout` then refreshes; `getToken()` removed. Legacy `buddy.token.*` / `buddy.currentUser` keys are no longer used.
- `login.js`: username + password form → `POST /api/auth/login`; shows generic auth errors; redirects to `/:username` on success.
- `builder.js`: gains a password field; posts `password`; handles `403` (logged in — prompt logout) and success (auto-logged-in, no token to save); shows the logged-out requirement notice.
- `profile.js`: `isOwner()` = `BuddySession.currentUser === profile.username`; PUT requests drop the token body field.
- `interactions.js`: drops `from`/`token`; sender identity is server-resolved from the session; cosmetic sender avatar keeps using the `buddy.avatar.<me>` snapshot when present, else the default guest avatar.
- `favorites.js`: drops the `token` param in favor of the cookie; redirects to `/login` on `401`.
- `search.js`: unchanged beyond relying on the gated endpoint.

### 9. Test strategy
Rewrite token-based tests in `tests/api.test.js` to password/JWT flows: create-with-password + auto-login cookie/auth headers; login success/generic-failure; `GET /api/auth/me`; logout; gated page redirects (`/search`, `/favorites`, `/:username` anonymous → `/login`); gated API `401`s; `403` on create-while-logged-in; owner-scoped edits/favorites; interaction sender from session; legacy guest-sender rendering. Existing smoke tests and the isolated test-DB pattern in `tests/` stay unchanged.

## Risks / Trade-offs

- **Legacy profiles (no `passwordHash`) can never log in** → Accepted for dev data; flagged as BREAKING in the proposal. Profiles stay visible/embeddable; anyone wanting the account must recreate it.
- **Stateless JWTs are not revocable server-side** → Logout clears the cookie; a stolen token stays valid until `JWT_EXPIRES`. Mitigation: short expiry defaults are trivial to configure; full revocation is a non-goal.
- **Weak dev JWT secret** → Mitigated by requiring `JWT_SECRET` in production with a startup warning when the fallback is active.
- **Public share links now redirect to login** (`/:username` from the embed footer or finds) → Intentional per the gating decision; `/embed/:username` remains the anonymous path.
- **Cookie + JSON mutation endpoints → CSRF surface** → SameSite=Lax plus existing `nosniff`/CSP headers; JSON-only bodies. Full CSRF tokens deferred (non-goal).
- **bcrypt adds a dependency and hashing cost** → Cost 12 is a reasonable dev/prod middle ground; compare is async and call-site independent.

## Migration Plan

1. Add `bcrypt` + `jsonwebtoken` to `package.json`.
2. Deploy the schema change (idempotent `ALTER TABLE ... ADD COLUMN passwordHash`); existing rows get `NULL`.
3. Existing `data.db` rows keep `tokenHash` (unused) and stay viewable/embeddable; they are simply not loggable-in.
4. Rollback: revert code; keep `passwordHash` column harmlessly (auth reads it only when set) or drop it. No data is transformed destructively at deploy time, so rollback is low-risk.

## Open Questions

None — any remaining unknowns (password length policy, expiry default, cookie transport, migration of legacy rows) are fixed here and recorded in the specs/design.