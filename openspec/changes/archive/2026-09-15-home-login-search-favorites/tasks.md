## 1. Server and store foundation

- [x] 1.1 Extend the store model: default `favorites: []` on new profiles and normalize interaction records missing a `sender` to `"guest"` in `_publicUser` so old `data.json` files render safely — verify with a store unit test loading a legacy record
- [x] 1.2 Implement store sender attribution: `addInteraction` records `{ type, ts, sender }` and the server derives the sender from an optional `from`/`token` pair (sender applies only when `from` is a valid existing profile other than the target and the token matches; otherwise `guest`) — verify with curl for claimed, guest, and self-poke cases
- [x] 1.3 Implement store favorites operations `getFavorites(username, token)`, `addFavorite(username, target, token)`, `removeFavorite(username, target, token)`: token-mismatch raises 401-equivalent, target-not-found and add-target-not-exists raise 404-equivalent, duplicates are a no-op, and `getFavorites` resolves favorited usernames to public profile summaries while dropping profiles that no longer exist — verify with store tests covering each case
- [x] 1.4 Implement `searchProfiles(query)`: normalize the query, return `[]` for blank/whitespace, otherwise a case-insensitive substring match over usernames capped at 20 results sorted by username — verify with a store test including blank, no-match, and cap behavior

## 2. Server routing and API

- [x] 2.1 Update the interaction route `POST /api/profile/:username/interactions` to accept `{ type, from?, token? }` and record the derived sender, keeping 400/404 behavior intact — verify existing interaction API tests still pass and new sender assertions pass
- [x] 2.2 Add favorites routes: `GET /api/profile/:username/favorites` (token required), `PUT` and `DELETE` accepting `{ token, target }` that add/remove and return the fresh favorites list, all 401 without a valid token and 404 for a missing target — verify with curl for all auth and validation cases
- [x] 2.3 Add `GET /api/search?q=` returning `{ results: [...] }` of public profiles, blank query returns `[]` — verify with curl for match, no-match, and blank queries
- [x] 2.4 Add page routes/structure for `/create` (builder), `/login`, `/search`, and `/favorites` while `/` serves the new landing page — verify a browser loads each page with 200 and no server errors

## 3. Navigation and landing page

- [x] 3.1 Rework `index.html` into the landing page (tagline, three entry points: create a buddy, login, search buddies) and move the existing builder markup to `create.html` — verify in-browser that `/` shows the landing page and `/create` shows the unchanged builder
- [x] 3.2 Add a site header on all pages (brand, nav links to create/login/search, plus "My buddy" and "My favorites" when logged in) and matching footer — verify navigation works between all pages
- [x] 3.3 Add landing/nav styles to `style.css` consistent with the existing Buddy Poke look — verify a visual review of home, create, and search

## 4. Login / session

- [x] 4.1 Create a shared session helper (`public/session.js`): reads `buddy.currentUser`, gets a token via `buddy.token.<username>`, sets/clears currentUser only when a token exists, and exposes login/logout — verify with unit-style checks in the browser console
- [x] 4.2 Implement `login.html` + `login.js`: normalize the entered username; if the matching token exists, set currentUser and redirect to `/<username>`; otherwise show "this profile isn't yours" plus a create link; unknown usernames show a not-found message and a create path — verify manually for owner, non-owner, and unknown cases
- [x] 4.3 Wire login/logout into the site header (logout clears currentUser) — verify that logging out hides "My buddy"/"My favorites" and resets poke sender attribution to guest

## 5. Search page

- [x] 5.1 Implement `search.html` + `search.js`: query form, fetch `/api/search`, render results with the shared avatar renderer and links to `/<username>`, blank-input guard, and an empty-state message — verify searching for existing, partial, and nonexistent usernames
- [x] 5.2 Escape/encode query output and result usernames on render — verify a query with `<script>` characters renders literally and triggers no execution

## 6. Favorites UI

- [x] 6.1 Implement `favorites.html` + `favorites.js` (owner-only view backed by `buddy.currentUser` + token): list favorited buddies with avatars and profile links, remove buttons, and a 401-handling path that routes to login — verify viewing favorites as owner and a 401 clearing path when the token is missing
- [x] 6.2 Add a favorite toggle to other profiles that shows the current favorite state when the visitor is logged in, otherwise a login prompt — verify add/remove toggle and state persistence across reloads
- [x] 6.3 Show the owner's own favorites (link/section) on their own profile — verify the owner sees their favorites with links from their profile

## 7. Poke sender attribution UI

- [x] 7.1 Update `interactions.js` trigger to send `from` (currentUser) and its token with the interaction POST, and use the logged-in buddy's saved avatar as the sender when present (guest otherwise) — verify pokes sent while logged in record the sender
- [x] 7.2 Update `profile.js` history rendering to show each poke's sender: "guest" as plain text and claimed usernames as links to their profiles — verify a profile page shows who poked and links resolve to sender profiles
- [x] 7.3 Confirm animations still play in place for both logged-in and guest senders, and that repeating a trigger restarts cleanly — verify in-browser for both sender cases

## 8. Tests and verification

- [x] 8.1 Add API tests for search (match, no-match, blank), favorites (401 without token, add/remove, duplicate no-op, missing target 404, dropped-profile resolution), and interaction sender attribution (claimed, guest, self-poke as guest, legacy record normalization) — verify `npm test` passes
- [x] 8.2 Add page tests: `/` serves the landing page with entry links, `/create` serves the builder, `/login`, `/search`, and `/favorites` serve 200, and query/sender strings are escaped — verify assertions pass
- [x] 8.3 Run an end-to-end smoke test: create a buddy → land on landing → login as that buddy → search and open a friend → send a poke while logged in → confirm the friend's profile shows the sender → favorite the friend → confirm the favorites page lists them — verify every scenario from the capability specs passes