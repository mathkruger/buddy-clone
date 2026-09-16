## Why

`src/repository/store.js` persists the entire dataset by rewriting one `data.json` file on every write: it loads the whole file into memory, mutates it, and re-serializes it through a write queue. This does not scale — every write is O(all data), the file can only be edited by one process, and there is no querying, indexing, or concurrency story. We want a small embedded database as the storage engine (SQLite by default) behind a provider abstraction, so the repository keeps its current API but can swap engines later.

## What Changes

- Introduce a `Database` abstraction in `src/repository/` that exposes the same operations the `Store` class exposes today (profiles, interactions, favorites, search, tokens), backed by SQLite by default (`node:sqlite`, built-in in Node ≥ 22) with the option to add other providers later behind the same interface.
- Replace the JSON persistence in `src/repository/store.js` with the database adapter, keeping the public `Store` API, exported errors, validation helpers, and constants unchanged so services, routes, and the server wiring do not change.
- On first start against an empty database, migrate any existing `data.json` file into the database so current users are not lost.
- Make the storage location configurable per environment: a separate database file is used for smoke tests so the development database is never touched.
- Keep every public URL, HTTP status, header, response body shape, and client asset byte-for-byte identical. This is **not** breaking for clients.
- Update `tests/` to exercise the SQLite-backed store; the store test suite stays behaviorally equivalent.

## Capabilities

### New Capabilities

- `data-storage`: specifies how the application stores and retrieves its persistent data (profiles, interactions, favorites, auth tokens) in a database-backed repository behind a provider abstraction, including migration from a legacy JSON file and environment-specific database files.

### Modified Capabilities

- None. Existing specs (user-profile, interactions, favorites, buddy-search, mood, avatar-creation, embed-widget, server-rendering, site-navigation) describe externally observable behavior, all of which this refactor preserves. Only the internal persistence mechanism changes.

## Impact

- **Repository**: `src/repository/store.js` keeps its public shape but delegates persistence to a new database layer (`src/repository/`); the JSON file read/write path is replaced.
- **Migration**: an existing `data.json` at the app's data root is imported into the database on first init; the file itself is left in place (not deleted) so nothing is lost.
- **Server**: `src/server.js` main-runner resolves the storage target from the environment (`DATA_FILE`/`DB_PATH`); behavior, URLs, headers, and rendering unchanged.
- **Dependencies**: `node:sqlite` is built into Node ≥ 22; if the project must stay on Node 18/20, assess a `better-sqlite3` dependency (recorded in design.md). No other dependencies added.
- **Tests**: `tests/store.test.js` and `tests/api.test.js` updated to use in-memory or temp-file databases; smoke tests (boot + API exercise in `tests/`) use a dedicated smoke-test database file rather than the development one.