## Objective
Implement the OpenSpec change `add-user-auth` in `/home/mathkruger/repos/buddy-clone` — replace claim-token accounts with username+password accounts (bcrypt+salt), JWT session cookies (HttpOnly `buddy_token`), and gate profile/search/favorites/interactions behind login while keeping the `/embed/:username` widget public.

## Important Details
- All 23 tasks (1.1–5.2) are `[x]` in `tasks.md`. `npm test` is green: **79 tests / 79 pass / 0 fail** across api, store, and smoke suites. The e2e manual pass (5.2) was verified and ticked.
- Auth flow: bcrypt (12 rounds) hash persisted as `passwordHash`; JWT (`{ sub: username }`, `JWT_EXPIRES` default `7d`) carried in an HttpOnly+SameSite=Lax cookie `buddy_token` (Bearer also accepted); `req.auth = { username }` set by middleware.
- Middleware (`src/middleware/auth.js`): `attachUser` (cookie or Bearer, no token in body), `requireAuth` (redirect page router), `requireAuthApi` (401), `requireOwner` (401/403). Legacy profiles with `passwordHash: null` remain viewable/embeddable but cannot log in (inert tokenHash path preserved).
- Routes: `POST /api/auth/login` (generic 401 — never reveals which is wrong), `POST /api/auth/logout` (clears cookie, 204), `GET /api/auth/me` (`{user}` or `{user:null}`). `POST /api/profiles` requires password ≥8 and returns 403 if already logged in; on success sets cookie (auto-login) and returns `{ username, profile }` — no claim token minted. Owner identity comes from the session, never from a body token.
- Gating: `/search`, `/favorites`, `/:username` and their APIs require login (302 page redirect / 401 API); `/login` redirects authenticated visitors to their own profile; `/create` shows a "log out first" notice to logged-in users; `/embed/:username` and `/` stay public.
- Client rewrite: `session.js` (server-backed session via `/api/auth/me`, nav init, no localStorage token), `login.js`, `builder.js` (password + boot guard so it doesn't crash on the logged-in variant), `profile.js` (session-based owner check), `interactions.js` (sender from session), `favorites.js` (cookie session). Views: `login.ejs`, `create.ejs` gained password fields and logged-in notices.
- Tests rewritten: `tests/api.test.js`, `tests/store.test.js` now cover password/JWT flows (auto-login, generic 401, me, logout-cookie, 403 owner gates, favorites, session-sender interactions, legacy import with `passwordHash: null`). All 79 pass.
- E2E manual pass (5.2) green via Playwright: create-with-password auto-login, wrong-then-right login, anonymous gate redirects, public embed widget with frame-ancestors `*`, and logged-in create-block verified.
- Housekeeping: model cleaned temp server processes and `/tmp/opencode` + all `buddy-store-*` / `buddy-api-*` temp dirs from earlier test runs; no stray servers remain.

## Work State
### Completed
- Dependencies/config/server wiring, store migration, auth service+middleware, all routes and gated pages, all client rewrites, and test rewrites — tasks 1.1–5.2.
### Active
- None — implementation is functionally complete.
### Blocked
- None.

## Next Move
- None — all tasks done; tests green; open a browser pass anytime via `npm start` (dev fallback `JWT_SECRET` prints a warning).
- Optional: ensure no `JWT_SECRET` is committed; the dev fallback is fine for local runs but production should set it.

## Relevant Files
- `openspec/changes/add-user-auth/tasks.md` — all tasks `[x]`.
- `src/server.js`, `src/middleware/auth.js`, `src/services/auth-service.js` (verify naming — auth service may live under `src/services/`)
- `src/routes/*` (auth, profiles, favorites, search, pages), `src/views/*.ejs`, `src/public/*.js`
- `src/public/session.js` — server-backed session + nav; `builder.js`, `login.js`, `profile.js`, `interactions.js`, `favorites.js` — rewritten client logic
- `tests/api.test.js`, `tests/store.test.js`, `tests/smoke.test.js` — 79 tests green
