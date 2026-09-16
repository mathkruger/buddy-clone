## 1. Baseline

- [x] 1.1 Run `npm test` and record the passing test count as the regression baseline before any edits (baseline: 73 passing)

## 2. Move the repository layer

- [x] 2.1 Move `src/store.js` to `src/repository/store.js` with all exports unchanged (`Store`, error classes, `normalizeUsername`, `isValidUsername`, `hashToken`, `INTERACTION_LIMIT`, `MAX_INTERACTION_TYPES`), and verify no file references the old `../src/store.js` path after the move (`grep -rn "src/store" src tests` returns nothing)
- [x] 2.2 Update imports in `src/server.js`, `tests/api.test.js`, and `tests/store.test.js` to the new repository path, and verify `npm test` passes with the baseline test count

## 3. Extract middleware and services

- [x] 3.1 Create `src/middleware/security-headers.js` exporting a `securityHeaders()` middleware factory with the existing CSP (including the `/embed` frame-ancestors `*` special case), `X-Content-Type-Options`, and `Referrer-Policy` headers, and verify the security-header tests in `tests/api.test.js` still pass once wired in
- [x] 3.2 Create `src/services/profile-service.js` exposing create/get/update that normalize + validate (`isValidUsername`, `isPlainObject` avatarDef, mood via `isValidMood`) and build the update patch, delegating to the repository, and verify profiles API tests pass once wired in
- [x] 3.3 Create `src/services/interaction-service.js` exposing `add` that validates interaction type length (`MAX_INTERACTION_TYPES`), resolves the sender via `store.resolveSender`, and delegates to `store.addInteraction`, and verify interactions API tests pass once wired in
- [x] 3.4 Create `src/services/favorites-service.js` exposing list/add/remove that validate token presence and non-empty target and delegate to the repository, raising the existing errors, and verify favorites API tests pass once wired in
- [x] 3.5 Create `src/services/search-service.js` exposing `search` that normalizes the query and delegates to `store.searchProfiles`, and verify the search API test passes once wired in
- [x] 3.6 Create `src/services/page-service.js` with `inlineJson` (angle-bracket escaping), page title/bodyClass data for each page route, and profile lookup plus the not-found meta for profile/embed pages, and verify page rendering tests pass once wired in

## 4. Extract route modules

- [x] 4.1 Create `src/routes/profiles.js` with thin handlers for `POST /api/profiles`, `GET/PUT /api/profile/:username`, and `POST /api/profile/:username/interactions` that map service errors to the existing 400/401/403/404/409 statuses, and verify profiles and interactions API tests pass
- [x] 4.2 Create `src/routes/favorites.js` with thin handlers for `GET/PUT/DELETE /api/profile/:username/favorites` that map `NotFoundError`/`TokenMismatchError` to 404/401, and verify favorites API tests pass
- [x] 4.3 Create `src/routes/search.js` serving `GET /api/search` from the search service, and verify the search API test passes
- [x] 4.4 Create `src/routes/pages.js` mounting static assets and serving `/`, `/create`, `/login`, `/search`, `/favorites`, `/embed/:username`, `/:username`, and the 404 render from the page service, and verify page-rendering and embed API tests pass

## 5. Rewire the app factory and finalize

- [x] 5.1 Rewrite `src/server.js` so `createApp(store)` keeps its single-argument signature, builds the services from the new `src/services/`, mounts `securityHeaders()`, `express.json`, `express.static`, and the route modules, and preserves the main-runner block (`new Store(DATA_FILE)`, `store.init()`, `app.listen`) unchanged; verify `npm start` boots and `GET /` returns 200
- [x] 5.2 Run the full `npm test` suite and verify the count matches the 1.1 baseline with zero failures
- [x] 5.3 Smoke-test end-to-end: boot the server, create a profile via `POST /api/profiles`, load `/`, `/login`, a profile page, an unknown username (404), and `/embed/:username`, and verify identical status/headers/body shape as before the refactor

## 6. Cleanup

- [x] 6.1 Grep the tree for stale references to the old layout (`src/store`, `./store`, `../store`, inline route bodies) and remove dead modules, then re-run `npm test` green