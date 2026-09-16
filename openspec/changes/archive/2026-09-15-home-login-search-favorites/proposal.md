## Why

The app currently drops visitors straight into the avatar builder, so there is no way to browse, revisit your own buddy, find friends, or keep track of buddies you like. QoL gaps: no landing page, no way to get back to your own buddy, no search, no favorites, and pokes are anonymous so you can't see who sent them.

## What Changes

- **Homepage / landing page**: Replace the builder-as-home with a small landing page that links to the buddy creation page, a login page, and buddy search.
- **Buddy creation page**: Move the existing avatar builder onto its own page (`/create`), reachable from the landing page.
- **Login page**: A simple "login" page where a user enters their username; if the browser holds that profile's claim token, they are redirected to their own buddy's profile.
- **Buddy search page**: A search page where a visitor can look up buddies by username and see matching profiles with their avatars.
- **Favorite buddies**: Logged-in users can save buddies they interact with as favorites (server-side, tied to their own profile) and view a list of their favorites.
- **Pokes received with sender**: Interactions now record who sent them (a claimed username or `guest`), and profiles show recent pokes together with which buddy sent each one.

## Capabilities

### New Capabilities

- `site-navigation`: Landing page that funnels visitors to buddy creation, login, and search; plus the login page that locates the visitor's own buddy via the locally stored claim token.
- `buddy-search`: Username search endpoint and search page that lists matching buddies with their avatars.
- `favorites`: Server-persisted, per-user list of favorite buddies; mark/unmark from a profile and view the favorites list.

### Modified Capabilities

- `interactions`: Interaction records gain a `sender` field (claimed username or `guest`); recording and history display include who sent each interaction.
- `user-profile`: The profile page shows the pokes received together with which buddy (or guest) sent each one, linking to sender profiles.

## Impact

- **Backend (`server.js`)**: New routes — `GET /create` page, `GET /login` page, `GET /search` page with `GET /api/search`, favorites API (`GET/PUT/DELETE /api/profile/:username/favorites`), and the interactions endpoint accepting an optional authenticated sender.
- **Store (`store.js`)**: Interaction records gain a `sender` key; user records gain a `favorites` array; new search and favorites read/write operations.
- **Frontend (`public/`)**: `index.html` becomes the landing page; builder moves to a new `/create` page; new `login.html`, `search.html`, and favorites views; profile page shows sender attribution and favorite controls.
- **Data**: Existing `data.json` files gain optional `sender` fields and `favorites` arrays; old records without a sender render as `guest`.
- **Tests (`tests/`)**: API tests for search, favorites auth, and sender attribution; existing interaction tests updated for the new payload shape.
- **CSP/security**: Favorites and sender-attributed pokes require the claim token, reusing the existing token model. No new dependencies.