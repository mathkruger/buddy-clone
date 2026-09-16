## Why

`src/server.js` is a single 280-line monolith mixing security middleware, JSON API handlers, favorites and search logic, and page rendering. As the app grows, every new endpoint or page requires editing one crowded file, and the business logic (validation, token checks, error mapping) is entangled with Express route plumbing. We want the server code split into clear layers — routes, services, and a repository — so each concern lives in its own file and is independently testable and navigable. This change is purely structural: external behavior, URLs, and the API surface stay identical.

## What Changes

- Split the Express app factory out of the monolith: `src/server.js` keeps only app wiring (view engine, middleware registration, mounting the route modules).
- Extract route handlers into a `src/routes/` module (or modules), one file per concern: profiles/API, favorites, search, and page rendering.
- Extract the business logic currently inlined in handlers into a `src/services/` layer: validation, token/claim resolution, patch building, and error mapping live in small service functions, leaving route handlers thin.
- Treat the data-access layer as a repository: move `src/store.js` into a repository directory (e.g. `src/repository/store.js`), preserving its public API (`Store` class, exported errors, `normalizeUsername`, `isValidUsername`, `hashToken`, constants) so services depend on it unchanged.
- Keep every public URL, HTTP status, header, response body shape, and client asset byte-for-byte identical. This is **not** breaking for clients; only file locations on disk and imports change.
- Update `tests/` imports to the new paths; all existing test assertions stay green.

## Capabilities

### New Capabilities

- None. This change organizes existing server code only; no new externally observable behavior is introduced.

### Modified Capabilities

- None. Existing specs (server-rendering, user-profile, interactions, favorites, buddy-search, embed-widget, site-navigation, mood, avatar-creation) describe externally observable behavior, which this refactor preserves. `skip_specs: true` is set because no spec-level behavior changes.

## Impact

- **Code layout**: `src/server.js` shrinks to app wiring; new `src/routes/` and `src/services/` directories are introduced; `src/store.js` moves under a repository directory.
- **Imports**: `src` internal imports and `tests/` (`tests/api.test.js`, `tests/store.test.js`) update to the new paths.
- **Dependencies**: none added or removed.
- **Server**: behavior, URLs, headers, and rendering unchanged; npm `start` and `test` scripts still work.
- **Public surface**: unchanged.