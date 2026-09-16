## 1. Dependencies and auth primitives

- [x] 1.1 Add `bcrypt` and `jsonwebtoken` to `package.json`; verify `npm install` completes and `npm test` still passes unchanged before further edits
- [x] 1.2 Add auth config (read `JWT_SECRET` with a warned dev fallback, `JWT_EXPIRES` default `7d`, cookie name `buddy_token`) in `src/server.js`; verify the server boots with and without `JWT_SECRET` set
- [x] 1.3 Create `src/middleware/auth.js` with `attachUser` (reads the `buddy_token` cookie header manually or `Authorization: Bearer`, verifies the JWT, sets `req.auth = { username }` or `null`), `requireAuth`, `requireAuthApi`, and `requireOwner`; verify `GET /api/auth/me` returns `user: null` anonymously and reflects a valid bearer token once wired
- [x] 1.4 Create `src/services/auth-service.js` wrapping bcrypt hash/compare, JWT sign/verify, and cookie set/clear helpers; verify login with a correct password issues a JWT and a wrong one does not

## 2. Data model and repository

- [x] 2.1 Add a nullable `passwordHash` column to the SQLite schema with an idempotent `ALTER TABLE ... ADD COLUMN passwordHash TEXT` (guarded by `PRAGMA table_info(users)`); verify the existing `data.db` / fresh test DBs both initialize without error
- [x] 2.2 Update `Store.createProfile` to accept a password hash (bcrypt) and stop minting claim tokens; remove `resolveSender`, `_assertToken`, and all `rawToken` parameters from `updateProfile`/favorites/`addInteraction` call paths (auth becomes middleware-driven); update `src/repository/db/*` accordingly and verify `tests/store.test.js` passes after updates
- [x] 2.3 Keep legacy `tokenHash` import path working and inert — imported profiles with no `passwordHash` stay viewable but cannot authenticate; verify a legacy JSON import yields profiles with `passwordHash: null`

## 3. Auth API and enforcement

- [x] 3.1 Create `src/routes/auth.js` with `POST /api/auth/login` (generic 401 for unknown user or wrong password, issues JWT + sets HttpOnly cookie), `POST /api/auth/logout` (clears cookie), and `GET /api/auth/me` (`{ user }` or `{ user: null }`); wire it into `server.js` before the page router; verify the endpoints with curl/fetch
- [x] 3.2 Update `POST /api/profiles` to require a password (min length 8) and reject with 403 when the requester is already logged in; on success persist the bcrypt hash, set the login cookie, and return `{ username, profile }` (no claim token); verify creation auto-login and the logged-in 403
- [x] 3.3 Gate the profile page `/:username` and `GET`/`PUT /api/profile/:username`: anonymous page visitors redirect to `/login`, anonymous API calls get 401, and `PUT` requires being logged in as that username (identity from `req.auth`, not a body token); verify each status code
- [x] 3.4 Gate `POST /api/profile/:username/interactions` to authenticated users and record the sender from `req.auth.username` (drop the `from`/`token` claim mechanism); verify an anonymous poke is rejected and an authenticated poke records the correct sender
- [x] 3.5 Gate the search page `/search` (redirect anonymous to `/login`) and `GET /api/search` (401 anonymous); verify both
- [x] 3.6 Gate `GET`/`PUT`/`DELETE /api/profile/:username/favorites` to the owner via `requireOwner` and remove the `token` query/body params; verify 401 without a session and owner-only success
- [x] 3.7 Redirect authenticated visitors to their own `/:username` when they open `/login`; verify the redirect

## 4. Server-rendered gating and client updates

- [x] 4.1 Apply `requireAuth` in `pagesRouter` for `/search`, `/favorites`, and the `/:username` handler while keeping `/`, `/create`, `/login`, and `/embed/:username` public; pass the authenticated viewer (or null) to the `/create` render; verify anonymous requests redirect and `/embed/:username` stays publicly frameable
- [x] 4.2 Rewrite `src/public/session.js` to derive `BuddySession.currentUser` from `GET /api/auth/me` (cookie travels automatically), back `logout()` with `POST /api/auth/logout`, and stop reading/writing `buddy.token.*`; verify the site header shows login vs. "My buddy"/logout based on real session state
- [x] 4.3 Update `src/views/login.ejs` and `src/public/login.js` to a username + password form posting to `POST /api/auth/login` with generic error handling; verify correct credentials redirect to the profile and a bad login shows the generic error
- [x] 4.4 Update `src/views/create.ejs` and `src/public/builder.js` to collect a password, send it in the create payload, surface the 403 "log out first" state for logged-in users, and stop storing claim tokens on success; verify creation logs the user in
- [x] 4.5 Update `src/public/profile.js` so `isOwner()` is `BuddySession.currentUser === profile.username` and `PUT` requests omit the token; verify owner controls vs. read-only for a different account
- [x] 4.6 Update `src/public/interactions.js` to drop the `from`/`token` claim payload (sender is server-resolved from the session) and treat a 401 as "log in to poke"; verify a poke records the authenticated sender
- [x] 4.7 Update `src/public/favorites.js` to drop the `token` param in favor of the session cookie and handle 401 redirects; verify favoriting works for the owner and is rejected for others

## 5. Tests and integration

- [x] 5.1 Rewrite `tests/api.test.js` token-based flows to password/JWT flows: create-with-password + auto-login, login success/generic failure, `/api/auth/me`, logout, gated page redirects (`/search`, `/favorites`, `/:username`), gated API 401s, create-while-logged-in 403, owner-scoped edits/favorites, sender-from-session, and legacy guest-sender rendering; verify `npm test` passes
- [x] 5.2 End-to-end manual pass: create a buddy with a password from a logged-out browser, confirm auto-login, log out, log in with the wrong then right password, verify gate redirects for an anonymous visitor, confirm only the embed widget is public, and confirm a second buddy cannot be created while logged in; verify via `npm start` and browser checks