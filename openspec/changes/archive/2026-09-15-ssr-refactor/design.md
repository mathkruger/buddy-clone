## Context

Today `server.js` mounts `public/` via `express.static`, reads three static HTML files into strings, and patches two placeholders by hand (`<!-- BUDDY_PROFILE_PLACEHOLDER -->`, `__USERNAME__`). The other five pages are served as static files. The eight HTML files duplicate the same `<head>`, site header/nav, clouds, and footer. Paths are computed with `import.meta.url`, so moving files under `src/` keeps the same technique. See proposal.md for the motivation.

Constraints that shape the design:

- Client JS must stay byte-for-byte the same. All client modules import one another with bare relative specifiers (`./avatar.js`, `./moods.js`, `./session.js`); they all live in one folder, so moving that folder wholesale keeps every import valid.
- The API tests assert specific strings on rendered pages (`id="builder-preview"`, `entry-grid`, `id="nav-auth"`, `session.js`, `<script type="application/json" id="buddy-profile">`, `&lt;script&gt;` on 404).
- Security headers are set by an Express middleware, independently of how HTML is produced, so `frame-ancestors *` for `/embed` is unaffected.

## Goals / Non-Goals

**Goals:**

- A single `src/` tree containing all server source, static assets, and templates.
- Server-rendered pages via EJS with a shared chrome defined once (head, site header/nav, clouds, footer, session script).
- Identical observable output for every existing route, payload, status code, and asset URL.
- Zero changes to client-side JS.

**Non-Goals:**

- No visual or URL surface changes; bare `.html` extension URLs (`/create.html`) that were never routed, advertised, or tested are dropped.
- No change to the JSON API, store, security headers, or data format.
- Not converting client-side rendering of the avatar/profile card to the server — profile data is still embedded as JSON and rendered by the existing JS.

## Decisions

### 1. Move server source into `src/`, keep `data.json` at the repo root

`server.js` → `src/server.js`, `store.js` → `src/store.js`. `src/store.js` imports `./public/moods.js`, which continues to resolve once the whole `public/` folder moves under `src/`. The default data file stays `<repo-root>/data.json`; compute it as `path.join(SRC_DIR, "..", "data.json")` so existing runtime data is preserved across the move.

**Alternatives considered:** keep `public/` at the root and only move `server.js`/`store.js`. Rejected — the request asks for the contents reorganized under `src/`, and the view templates naturally live beside the public assets they reference.

### 2. EJS as the view engine, driven by Express

Add `ejs` (^3.1.x), set `app.set("view engine", "ejs")` and `app.set("views", path.join(SRC_DIR, "views"))`, then `res.render("profile", {...})` in each page route. EJS is the user's chosen template system; Express resolves views without the `.ejs` extension.

**Alternatives considered:** dependency-free string templates (rejected by decision), Handlebars/Pug (extra deps, different syntax, no user preference).

### 3. Include-based partials instead of a layout/body wrapper

Define the chrome once as partials included by every page template:

- `partials/head.ejs` — doctype, `<head>` (title, metas, favicon, stylesheet), opens `<body class="<%= bodyClass %>">`.
- `partials/site-header.ejs` — brand + nav with the `nav-auth` slot.
- `partials/clouds.ejs` and `partials/footer.ejs` — decorative divs and footer.
- `partials/foot.ejs` — `<script type="module" src="/session.js">` then `</body></html>`.

Each page template (`index.ejs`, `create.ejs`, `login.ejs`, `search.ejs`, `favorites.ejs`, `profile.ejs`, `embed.ejs`, `404.ejs`) includes those partials around its own `<main>` body and its page-specific scripts. This removes the duplicated chrome without pulling in a layout/body-injection package or double rendering.

**Alternatives considered:** `express-ejs-layouts` body wrapper, or a `layout.ejs` receiving a pre-rendered `body` string. Rejected — an extra dependency / two-pass render adds complexity for no behavioral gain; EJS `include` already gives the reuse the change is after.

### 4. Keep the security-conscious serialization, let EJS escape where it is raw

The profile/embed payload keeps the existing `inlineJson` helper (escapes `<` as `\u003c`) and is injected with the raw tag `<%- profileJson %>` between `<script type="application/json" id="buddy-profile">` and `</script>`. The 404 page interpolates the requested username with `<%= username %>`, relying on EJS's built-in HTML escaping, which matches the current `htmlEscape` behavior for `<`, `>`, `&` (the API tests only assert `&lt;script&gt;` present and no raw `<script>`).

**Alternatives considered:** pre-escaping the username in the route. Rejected — EJS `<%= %>` is the documented, auditable escape point.

### 5. Explicit page routes; static mount serves only assets

Replace the `express.static`-served `index.html` with an explicit `app.get("/", ...)` render. The other page routes (`/create`, `/login`, `/search`, `/favorites`, `/embed/:username`, `/:username`) keep their URLs but call `res.render` instead of `sendFile`; the not-found `__USERNAME__` templating becomes a rendered `404.ejs` view. `express.static` still mounts `src/public` so CSS, JS modules, and the favicon are served at today's URLs. HTML files leave `public/` entirely (converted to `.ejs` views), so no accidentally-served template is possible. Asset URLs in templates become absolute (`/style.css`, `/favicon.svg`, `/session.js`) — same effective URLs as today at every route.

**Alternatives considered:** keep loose placeholder-string rendering on top of EJS. Rejected — it would preserve the duplication the change exists to remove.

## Risks / Trade-offs

- **Markup drift changes test-asserted strings** → Port each page's body markup verbatim from the current HTML into its `.ejs` view; existing API tests assert on those strings (`entry-grid`, `id="builder-preview"`, `id="nav-auth"`, `session.js`, `buddy-profile`).
- **EJS treats `<%`/`<%=` as template tags inside views** → Only `.ejs` views run through EJS; `.css` and client `.js` stay static and untouched, so no code/stylesheet collision.
- **Escaping mismatch on 404 vs current `htmlEscape`** → Keep the test-relevant behavior (`&lt;script&gt;`, no raw `<script>`); EJS escaping satisfies both existing 404 tests.
- **Relative asset links inside rendered pages** → Use absolute `/`-rooted asset URLs in all templates, eliminating the trailing-slash/slash ambiguity every current page works around.
- **Default data file moves with `__dirname`** → Pin the default to `<repo-root>/data.json` via `path.join(SRC_DIR, "..", "data.json")`; `DATA_FILE` env override is unchanged.
- **No VCS in this checkout** → Apply migration as copy-and-convert steps that leave `public/` legacy files in place until the new tree is verified, then remove them, so rollback is restoring the original files.

## Migration Plan

1. Add `ejs` to `package.json`; update the `start` script to `node src/server.js`.
2. Create `src/`, move `server.js`/`store.js`; move `public/` → `src/public/` (drop the `.html` files from it).
3. Convert each `.html` page into `src/views/*.ejs` plus `src/views/partials/*.ejs`, porting body markup verbatim.
4. Rewire `server.js`: view engine + views dir, explicit route renders, `express.static` on `src/public`, DATA_FILE default to repo root.
5. Update `tests/api.test.js` imports to `../src/store.js` and `../src/server.js`.
6. Run `npm test` (full suite must stay green) and start the server to spot-check `/`, `/create`, a profile page, `/embed/:username`, and an unknown-username 404.
7. Delete the now-unused legacy HTML files under the original `src/public` only after step 6 passes.

**Rollback:** restore the pre-change `server.js`, `store.js`, `public/`, `package.json`, and test imports from the backup taken at step 2; revert dependency.

## Open Questions

None. The template-system choice (EJS) was confirmed with the user up front; every other decision is recorded above and none would change the specs or task breakdown.