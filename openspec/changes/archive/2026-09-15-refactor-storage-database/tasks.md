## 1. Baseline

- [x] 1.1 Run `npm test` and record the passing test count as the regression baseline before any edits (expect ~73 passing)

## 2. Storage backend and SQLite provider

- [x] 2.1 Create the storage backend contract (`src/repository/backend.js` or `src/repository/db/`): an interface with the repository's data operations (`init`, `getProfile`, `hasUser`, `createProfile`, `updateProfile`, `addInteraction`, `getFavorites`, `addFavorite`, `removeFavorite`, `searchProfiles`, `snapshot`) and an `openDatabase({ provider, path })` factory that defaults to `"sqlite"` and throws for unknown providers; verify with a node one-liner that an unknown provider name throws
- [x] 2.2 Implement `SqliteBackend` with `node:sqlite` (built-in, Node ≥ 22.5): create the `users`, `interactions` (plus index) and `favorites` tables from design.md, and implement every data operation with prepared statements — `avatarDef` JSON-serialized, interactions trimmed to the newest `INTERACTION_LIMIT` per insert, search `lower(username) LIKE` capped at 20, favorites deduped via composite PK, `sendername` defaulting to `guest` when not provided; verify by running a temporary script that creates a temp DB, inserts a profile with interactions and favorites, and reads them back exactly
- [x] 2.3 Implement `snapshot()` on the backend that reconstructs the `{ users: {...} }` shape (profiles with `avatarDef`, `mood`, `tokenHash`, `createdAt`, `interactions`, `favorites`) so existing data-inspection helpers keep working; verify by creating two profiles with interactions and asserting the snapshot matches a known serialization
- [x] 2.4 Implement first-run migration in `init()`: when the `users` table is empty and a legacy JSON file exists at the configured data-file path, import every user (normalizing missing interaction senders to `guest`) inside a single transaction and leave the JSON file in place; verify by writing a legacy `data.json` fixture, initializing an empty DB, and asserting all profiles/interactions/favorites are readable and the JSON file still exists
- [x] 2.5 Verify the migration does not re-import: re-run `init()` on a DB that already has users with the same legacy file present, and assert the database contents are unchanged and the file is still ignored

## 3. Rewire `Store`

- [x] 3.1 Rewrite `src/repository/store.js` so `Store` becomes a facade over the chosen backend: keep every exported symbol (`Store`, error classes, `normalizeUsername`, `isValidUsername`, `hashToken`, `INTERACTION_LIMIT`, `MAX_INTERACTION_TYPES`) and every public method (including `resolveSender`, favorites, search, `snapshot`), move validation/error mapping/projection into `Store`, drop the JSON write queue, and change the constructor to accept storage config (database path plus optional legacy data-file path); verify `import { Store } from "../src/repository/store.js"` still resolves all currently consumed symbols
- [x] 3.2 Port the store behavior: `node --test tests/store.test.js` currently failing only where JSON-file mechanics are asserted, with every behavioral assertion (defaults, duplicates, token hashing, mood validation, interaction counts/trimming, sender resolution, favorites dedupe/drop-missing, search caps, reload persistence, concurrent creation) passing against the SQLite-backed `Store`; run the suite and list any assertion that could not be preserved

## 4. Server wiring and configuration

- [x] 4.1 Update `src/server.js` main runner to resolve storage config from env: `DB_PATH` (default `<SRC_DIR>/../data.db`), `DATA_FILE` (unchanged default `data.json`, now the migration source), optional `STORAGE_PROVIDER` (default `sqlite`), and construct the `Store` through the provider factory; verify `npm start` boots, `GET /` returns 200, `data.db` is created, and an existing `data.json` is imported on first boot
- [x] 4.2 Bump `package.json` `engines.node` to `>=22.5.0` (required by `node:sqlite`) and add DB files (default `data.db`, the smoke-test DB dir) to `.gitignore`; verify `npm pkg get engines` reports the new value and `git status` does not list DB artifacts after a boot run

## 5. Tests and isolated smoke-test database

- [x] 5.1 Rewrite `tests/store.test.js`: use temp-directory SQLite databases, replace raw-`JSON.parse(fs.readFile(filePath))` assertions (e.g. `data.json` created on init, token hash storage, favorites inspection, concurrency file checks) with `snapshot()`/backend row lookups, and keep every behavioral case; verify the full store suite passes with the same coverage as the baseline
- [x] 5.2 Rewrite `tests/api.test.js`: boot the app against a temp SQLite DB, and adapt the tests that mutate `store.filePath` raw JSON (legacy destructure of missing interaction sender, dropping a missing favorites target) to operate through the backend/`snapshot()` instead; verify the API suite passes unchanged against HTTP behavior
- [x] 5.3 Add an isolated smoke test that boots the server with a dedicated `DB_PATH` (e.g. `tests/.smoke/smoke.db`, temp-or-gitignored), creates a profile and exercises key routes (`/`, profile page, `/api/search`, favorites, `/embed/:username`), and asserts a separate default development database is unmodified by the run; verify the smoke test passes and the dev `data.db` is untouched
- [x] 5.4 Run the full `npm test` suite and verify all tests pass and the count matches or exceeds the 1.1 baseline with zero failures

## 6. Finalization and end-to-end verification

- [x] 6.1 Grep for stale references to JSON-storage mechanics (`data.json` write paths, `.tmp` persist, raw file reads in `src/`) and remove dead code; re-run `npm test` green
- [x] 6.2 End-to-end smoke-test the real flow: with a copy of the current `data.json`, boot the server, confirm migration runs once, confirm a second restart does not re-import, and verify `GET /`, a known profile page, and an API interaction return identical status/headers/body shape as before the refactor