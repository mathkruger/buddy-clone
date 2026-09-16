## Context

Today `src/server.js` is a single module that owns the Express app factory and everything inside it: security headers middleware, all JSON API handlers (profiles, interactions, favorites, search), static asset mounting, named page routes, and the profile/embed/404 pages. Its helper functions (`inlineJson`, `isPlainObject`, `requireToken`, `favoritesError`) are module-local. `src/store.js` already isolates data access (a JSON-file-backed `Store` with a write queue, plus exported errors, `normalizeUsername`, `isValidUsername`, `hashToken`, and limits). See proposal.md — Why.

External behavior is frozen by existing specs (server-rendering, user-profile, interactions, favorites, buddy-search, embed-widget, site-navigation) and by `tests/api.test.js` + `tests/store.test.js`, which assert on URLs, status codes, response shapes, headers, and store semantics. The refactor must not change any of it.

## Goals / Non-Goals

**Goals:**
- Separate server concerns into three layers: routes (HTTP wiring), services (business logic), repository (data access).
- Keep `createApp(store)` as the public test/app entry point with the same signature.
- Preserve every exported symbol from `src/store.js` (`Store`, errors, helpers, constants) so store semantics and tests are untouched except for import paths.

**Non-Goals:**
- No new capabilities, endpoints, view templates, or behavior changes.
- No dependency changes.
- No database or persistence change — the repository stays JSON-file-backed and moves on disk only.
- No re-parsing of the API surface, error codes, or HTTP status mappings.

## Decisions

### 1. Directory layout: `routes/`, `services/`, `repository/` under `src/`

Target structure:

```
src/
  server.js                 # constants, app factory wiring, main runner
  middleware/security-headers.js
  routes/
    profiles.js             # POST /api/profiles, GET/PUT /api/profile/:username, POST .../interactions
    favorites.js            # GET/PUT/DELETE /api/profile/:username/favorites
    search.js               # GET /api/search
    pages.js                # static mount + named pages + /embed/:username + /:username + 404
  services/
    profile-service.js      # normalize/validate, build update patch, create/get/update
    interaction-service.js  # validate interaction type, resolve sender, add
    favorites-service.js    # token + target validation, list/update/remove
    search-service.js       # normalize query + delegate
    page-service.js         # inlineJson, page title/bodyClass, profile lookup + not-found meta
  repository/
    store.js                # moved from src/store.js, exports unchanged
  public/                   # unchanged
  views/                    # unchanged
```

Convert the inline handler bodies in `createApp` into `(req, res, next) =>` handlers exported from the route modules. Each route module exports a factory `(store, services) => Router` (or individual handler functions), and `server.js` mounts them. Statics and page routes move with pages.js.

**Alternative considered:** a single `routes.js` file — rejected because it just relocates the monolith; per-concern modules keep each navigation path small. A controllers/pages split inside routes was deliberately not taken — pages.js holding both static mount and page routes is small enough.

### 2. Services own business logic; routes only map errors to HTTP

Move what handlers do today into service functions that delegate persistence to the repository:

- `profile-service`: `create`, `get`, `update` — normalizes username, validates `isValidUsername`/`avatarDef`/mood, builds the update patch, calls `store.createProfile`/`getProfile`/`updateProfile`, throws the existing domain errors (`DuplicateUsernameError`, `NotFoundError`, `TokenMismatchError`).
- `interaction-service`: `add` — validates interaction type length against `MAX_INTERACTION_TYPES`, calls `store.resolveSender` + `store.addInteraction`, raises `NotFoundError`.
- `favorites-service`: `list`, `add`, `remove` — validates token presence and target, delegates to store.
- `search-service`: `search` — normalizes the query and delegates to `store.searchProfiles`.

Routes become thin: they extract request data, call the service, and convert thrown domain errors to status codes (`409`/`404`/`401`/`403`). Route-local helpers like `requireToken` and `favoritesError` live inside the favorites route (or are replaced by the service raising `TokenMismatchError`).

**Alternative considered:** keep validation in the routes and extract only persistence calls — rejected: it leaves the business logic in HTTP handlers, which is the problem this change fixes.

### 3. Error classes remain the repository's contract

`DuplicateUsernameError`, `NotFoundError`, `TokenMismatchError`, `ValidationError` stay defined in (and exported from) `repository/store.js`, because the repository is the source of those failures and tests import them from there. Services and routes may rely on them without redefining.

### 4. Shared middleware and helpers live in small modules

- `middleware/security-headers.js` exports `securityHeaders()` returning the CSP/no-sniff/referrer middleware, including the `/embed` frame-ancestors special case.
- `inlineJson` moves to `services/page-service.js` (it is page-rendering concern); `isPlainObject` and username helpers used by validation move to the services that need them (`isValidUsername`/`normalizeUsername` still come from the repository, unchanged).

### 5. `createApp(store)` builds services internally

`server.js` constructs the three tiers: `const repository = store` (already the repository), `const services = {...}` from `src/services/`, then mounts middleware + `routes/*` with `services` wired in. `createApp(store)` keeps its single-argument signature so `tests/api.test.js` keeps working. The main-runner block at the bottom of `server.js` is unchanged.

## Risks / Trade-offs

- [Behavioral regression sneaking in during the move] → Rely on the existing test suite (`npm test`) as the safety net; tasks are ordered so tests run after the move and catch any drift.
- [Repository move breaks imports that this plan missed] → `tests/` imports are limited to `../src/store.js` and `../src/server.js`; the repository move keeps module IDs changeless except for path, and all imports are updated in the same task. Search the tree for `src/store` before finishing.
- [Over-extraction: helpers/route modules get small and scattered] → Kept to a single service per concern; no micro-splitting beyond what the proposal lists.

## Migration Plan

Apply is a file move + import rewire with no runtime migration. Rollback is `git revert` of the change commit; the old single-file layout is recovered since behavior is identical. There is no staged deployment — behavior is frozen, so the change can be applied in one go and verified with `npm test`.

## Open Questions

None.