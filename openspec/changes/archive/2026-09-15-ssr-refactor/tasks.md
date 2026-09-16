## 1. Restructure into `src/`

- [x] 1.1 Create `src/`, move `server.js` → `src/server.js` and `store.js` → `src/store.js`, and verify `node --check src/server.js src/store.js` (and any JS built-ins they import) passes
- [x] 1.2 Move `public/` → `src/public/` without changing any file contents, and verify `git status` (or `diff`) shows no textual changes and that file count of `src/public` matches the old `public` minus `.html` files
- [x] 1.3 Remove the `.html` files from `src/public/` (they become EJS views), and verify none remain under `src/public`
- [x] 1.4 Keep the default data file at the repo root (`src/../data.json`) and verify `npm start` still resolves/creates data at the repo root rather than under `src/`

## 2. Build the EJS template system

- [x] 2.1 Add `ejs` to `package.json` dependencies (`^3.1.x`) and verify `npm install` completes and `npm test` still passes before any route changes
- [x] 2.2 Create `src/views/partials/head.ejs` (doctype, `<head>` with title/meta/favicon/stylesheet, opens `<body class="<%= bodyClass %>">`) and verify it renders the body class from the passed variable
- [x] 2.3 Create `src/views/partials/site-header.ejs` (brand + nav with `nav-auth` slot) and `src/views/partials/clouds.ejs`, `src/views/partials/footer.ejs`, `src/views/partials/foot.ejs` (session script + closing tags), and verify each partial parses in isolation with `ejs.compile`
- [x] 2.4 Port `index.html`, `create.html`, `login.html`, `search.html`, `favorites.html` bodies verbatim into `src/views/{index,create,login,search,favorites}.ejs`, swapping asset links to absolute `/`-rooted URLs and page chrome to partial includes, and verify each view contains the same test-asserted strings (`entry-grid`, `id="builder-preview"`, `id="nav-auth"`, `session.js`)
- [x] 2.5 Port `profile.html` and `embed.html` into `src/views/{profile,embed}.ejs`, injecting `<%- profileJson %>` inside `<script type="application/json" id="buddy-profile">`, keeping `profile-root`, `nav-auth`, and the profile/interactions widget script tags, and verify the payload slot is emitted exactly as `<script type="application/json" id="buddy-profile">`
- [x] 2.6 Create `src/views/404.ejs` rendering the username with `<%= username %>`, and verify it outputs `&lt;script&gt;` when given a scripty username

## 3. Rewire the server

- [x] 3.1 In `src/server.js`, set `app.set("views", path.join(SRC_DIR, "views"))` and `app.set("view engine", "ejs")`, and verify `createApp` still returns an `express` app with no startup error
- [x] 3.2 Mount `express.static` on `src/public` and confirm it serves `/style.css`, `/favicon.svg`, and `/session.js` while the old `public` root is no longer mounted
- [x] 3.3 Convert `/`, `/create`, `/login`, `/search`, `/favorites` to `res.render(...)`, and verify each returns the same 200 page with the asserted markup
- [x] 3.4 Convert `/embed/:username` and `/:username` to render `embed.ejs`/`profile.ejs` with the inert `inlineJson` payload, and verify a created profile's page contains the escaped JSON and no `<`/`>` inside the payload (matches specs: "Dynamic profile data embedded at render time")
- [x] 3.5 Render `404.ejs` with `res.status(404)` for unknown usernames, and verify the response body escapes the username and the status is 404 (matches specs: "Not-found page escapes the requested username")
- [x] 3.6 Keep the CSP/security middleware unchanged and confirm `/embed/:username` still returns `frame-ancestors *` and other pages `frame-ancestors 'self'`
- [x] 3.7 Delete `renderShell`/`htmlEscape`/`inlineJson` usage that no longer applies (keeping `inlineJson` where the payload still needs inert serialization), and verify no stale placeholder (`BUDDY_PROFILE_PLACEHOLDER`/`__USERNAME__`) references remain in `src/`

## 4. Update CLI entry and tests

- [x] 4.1 Update the `start` script in `package.json` to `node src/server.js`, and verify `npm start` boots and serves `/` 200
- [x] 4.2 Update `tests/api.test.js` imports to `../src/store.js` and `../src/server.js`, and verify `node --check tests/api.test.js` passes
- [x] 4.3 Run `npm test` and verify the full suite passes unchanged (security headers, API, favorites, and all page assertions)

## 5. Final verification

- [x] 5.1 Start the server and spot-check `/`, `/create`, `/login`, `/search`, `/favorites`, an existing `/:username`, `/embed/:username`, and an unknown `/:username` (404) in a browser/curl for correct rendering
- [x] 5.2 Verify every client JS asset (`avatar.js`, `builder.js`, `login.js`, `search.js`, `favorites.js`, `interactions.js`, `profile.js`, `session.js`, `widget.js`, `moods.js`) is served unchanged at its URL and loads without module-resolution errors
- [x] 5.3 Delete the legacy `public/*.html` files and the old `server.js`/`store.js` only if steps 4.3 and 5.1 pass; confirm the final tree has no top-level `public/` or stray `server.js`/`store.js`