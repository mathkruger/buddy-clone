## Context

See proposal.md — the motivation is that a single JSON file rewritten on every mutation does not scale and ties reads/writes to one in-memory copy. Current state: `src/repository/store.js` holds the whole dataset in `this.data`, serializes every write through a promise queue, and persists via `data.json` (path resolved from `DATA_FILE` in `src/server.js`). The `Store` public API is consumed by `src/services/*` unchanged across `createApp(store)`. The runtime here is Node v24.16.0, where `node:sqlite` is available built-in; `package.json` currently declares `engines: >=18`.

## Goals / Non-Goals

**Goals:**
- A storage layer behind a provider interface with a SQLite implementation as the default, so another database provider can be added later without touching the repository's public API.
- Preserve the `Store` public surface exactly: methods (`init`, `getProfile`, `hasUser`, `createProfile`, `updateProfile`, `addInteraction`, `resolveSender`, snapshots, favorites, search), exported errors, `normalizeUsername`, `isValidUsername`, `hashToken`, `INTERACTION_LIMIT`, `MAX_INTERACTION_TYPES`.
- First-run migration of an existing `data.json` into the database, leaving the file in place.
- A dedicated database file for smoke tests so the development database is never modified.
- Keep every HTTP response, status, header, and body shape identical.

**Non-Goals:**
- No schema-versioning/migration framework beyond the single first-run JSON import.
- No multi-process deployment; single-process SQLite serialization is enough.
- No client-visible or REST API changes.

## Decisions

### 1. Backend provider interface with `Store` as facade
A new `storage-backend` interface lives in `src/repository/` and mirrors the repository's data operations: `init`, `getProfile`, `hasUser`, `createProfile`, `updateProfile`, `addInteraction`, `getFavorites`, `addFavorite`, `removeFavorite`, `searchProfiles`, `snapshot`. `SqliteBackend` implements it. `Store` keeps validation, error mapping, sender resolution, and profile projection (counts, summaries), delegating persistence to the backend. A factory `openDatabase({ provider, path })` selects the backend; `provider` defaults to `"sqlite"` and unknown providers throw at startup.
- *Why:* keeps the app-level API frozen (spec: pluggable provider), isolates SQL from business rules.
- *Alternative considered:* having `Store` extend/swap backends via duck-typing only — rejected because it keeps no explicit contract for future providers.

### 2. SQLite via built-in `node:sqlite` (Node ≥ 22.5)
The schema:

```
users(username TEXT PRIMARY KEY, avatarDef TEXT, mood TEXT NOT NULL, tokenHash TEXT NOT NULL, createdAt TEXT NOT NULL)
interactions(id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL REFERENCES users(username), type TEXT NOT NULL, sender TEXT NOT NULL DEFAULT 'guest', ts INTEGER NOT NULL)
favorites(owner TEXT NOT NULL REFERENCES users(username), target TEXT NOT NULL REFERENCES users(username), PRIMARY KEY(owner, target))
```

`avatarDef` (and `favorites` in and out) is JSON-serialized per row. Interaction history is queried ordered by id and trimmed to the newest `INTERACTION_LIMIT` rows per insert. Search uses `lower(username) LIKE '%' || ? || '%'` ordered by username, capped at 20. `snapshot()` reconstructs the `{ users: {...} }` shape so test helpers that inspect raw data keep working.
- *Why:* Node 24 (the runtime here) ships a stable, dependency-free SQLite (`DatabaseSync`). No npm install, no native build.
- *Alternative considered:* `better-sqlite3` — same synchronous SQLite semantics but adds a native dependency; only needed if support for Node 18/20 is required. If so, bump-free path is to switch the backend import, which the provider interface already isolates. `package.json` engines is raised to `>=22.5.0` and the smoke-test note documents it.

### 3. Concurrency: drop the write queue
`node:sqlite`'s `DatabaseSync` executes statements synchronously, so the promise-chain write queue in `Store` becomes unnecessary. All `Store` mutations stay `async` (returning promises) so the services/routes continue to `await` them, but the queue itself is removed.
- *Alternative considered:* keeping the queue — rejected as dead weight; SQLite gives atomic, ordered writes.

### 4. Migration on first init
In `SqliteBackend.init()`: if the `users` table is empty and a legacy file exists at the configured `DATA_FILE`, import each user (avatarDef, mood, tokenHash, createdAt, interactions with `sender` normalized to `guest`, favorites) inside a single transaction, then leave the file untouched. When `users` already has rows, the JSON file is ignored. The presence of data, not a marker row, decides re-import.
- *Why:* matches spec scenarios and avoids a version table for one import.
- *Note:* legacy rows with a missing `sender` get `"guest"`, preserving today's normalization (existing `store.test.js` "legacy data" case).

### 5. Environment configuration
The server resolves storage from env vars: `DB_PATH` (default `<SRC_DIR>/../data.db`), `DATA_FILE` (unchanged default `<SRC_DIR>/../data.json`, now the migration source), and optional `STORAGE_PROVIDER` (default `"sqlite"`). Smoke tests boot with a dedicated `DB_PATH` (e.g. `tests/.smoke/smoke.db`, git-ignored or temp) so the development database is never written.

## Risks / Trade-offs

- **Node runtime floor** → `node:sqlite` needs ≥ 22.5; an `engines` bump breaks older runtimes. → Runtime here is v24; the provider interface leaves `better-sqlite3` as a drop-in swap if 18/20 support ever matters.
- **Synchronous SQL on the event loop** → large datasets block the request loop. → Acceptable for this app's scale; no read path is heavier than a per-user query now.
- **Behavior drift between JSON and SQL** → mud details (default mood, guest sender, trim-to-newest, count summaries, favorite drop-on-missing-target) could subtly differ. → `store.test.js` stays as the behavioral oracle; every current assertion is ported to the DB-backed `Store`.
- **Tests inspecting raw JSON** → `store.test.js` lines that `JSON.parse(fs.readFile(filePath))` stop applying. → Rework them against `snapshot()` / targeted queries; token-hash storage is asserted via a row lookup on the backend connection.
- **Migration touching production data** → a buggy import could misread the only copy. → Import is read-only over the JSON (file never deleted or rewritten) and runs inside a transaction against the new DB file.

## Migration Plan

1. Land backend + schema + migration code behind the unchanged `Store` API; `npm test` green on the DB-backed store.
2. On next `npm start`, `DB_PATH` is created and `data.json` is imported; the JSON file remains as a backup.
3. Rollback: revert code; the untouched `data.json` still works with the old `Store` (no destructive change at any point).

## Open Questions

- None that would change the specs, approach, or task breakdown.