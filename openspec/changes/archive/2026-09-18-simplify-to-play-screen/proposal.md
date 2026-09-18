## Why

The app currently spreads the experience across many pages — landing, create/builder, login, search, favorites, per-user public profiles, plus an embed widget — each with its own chrome and flows. The original Buddy Poke was simpler: you landed, registered, and played with your buddy. We want that single-screen focus back: one place where the buddy lives, pokes arrive as messages, friends are poked by username, humor sets the mood, and appearance is customized in place.

## What Changes

- **Four screens total**: a landing page (project intro + CTAs to register and log in), a register page (username + password only), a login page (username + password), and the play screen. The create/builder, search, and favorites pages and public profile routes are gone.
- **BREAKING — no public profile pages**: `/:username` profile pages are removed. There is no public per-user page anymore; the play screen is the only place a buddy renders.
- **BREAKING — no buddy search**: search is removed entirely. Friends are added only by exact username in the Friends tab, and are validated against existing usernames.
- **Play screen** (new): a single authenticated screen with one main render stage where the login user's buddy is displayed, and four tabs:
  - **BuddyClone**: received pokes appear as messages (sender, type, time) in a feed. The user can replay any received poke on the stage and re-send/repeat a poke back to that sender.
  - **Friends**: the old favorites list, now called friends. Add a friend by typing their username (saved as a favorite), see existing friends with their avatars, and send pokes (previewed on the main stage).
  - **Humor**: all humor options. Clicking a humor plays its animation on the main stage; a "set as mood" action persists it as the buddy's current mood (loops), and selecting "None" returns to idle cycling. When no mood is set, the buddy cycles randomly through the humor animations.
  - **Appearance**: change the buddy's appearance from the existing vendored catalog, grouped into categories (head/hair/clothes/shoes/hats/ears/addons); "ears" and "addons" map to the closest existing catalog parts. New accounts are created with a predefined simple default appearance (the plain base look).
- **BREAKING — creation and editing move into the play screen**: the standalone `/create` builder and `/favorites` pages are removed. Registering creates the account + buddy with the default look; the owner customizes via the Appearance tab (saved through the same avatar endpoint).
- **BREAKING — pokes are messages**: interaction history is no longer a public profile section; it is the owner's private pokes feed. The existing poke/hug/kiss/high-five/etc. catalog is kept; each entry includes sender and timestamp.
- **Embed widget stays**: `/embed/:username` keeps rendering the avatar + mood (needs a working link target; it now links to the play screen path). Revisit separately if public display is unwanted.

## Capabilities

### New Capabilities

- `play-screen`: the authenticated single-screen play experience — persistent buddy stage, BuddyClone pokes feed, Friends (favorites) tab with poke sending, Humor tab (play + persist mood + random cycle when unset), and Appearance tab backed by the vendored catalog with a simple default look for new accounts.

### Modified Capabilities

- `site-navigation`: requirement set replaced with the four-screen structure (landing, register, login, play). Landing offers register/login CTAs; register and login are username+password forms; play is authenticated.
- `user-profile`: profile pages are removed — no public per-user rendering, no public mood/poke display. The capability's remaining content moves into `play-screen`.
- `interactions`: pokes are now sent only from the Friends tab of the play screen, recorded as messages, and shown in the BuddyClone feed (with replay and poke-back); a poke's animation plays on the play-screen stage.
- `buddy-search`: removed — the search page, endpoint, and capability are deleted.
- `favorites`: the favorites list is renamed "friends", managed and viewed inside the Friends tab of the play screen (add by username, saved as a favorite, remove); no dedicated favorites page exists anymore.
- `avatar-creation`: creating and editing move to the play screen's Appearance tab; registering seeds the simplest default appearance; the same saved-composition contract is reused.
- `buddy-edit`: the `/create` editor is replaced by the Appearance tab inside the play screen (edit loads the stored composition, pre-populates, and saves via the same avatar endpoint).
- `mood`: the mood surface becomes the Humor tab — select to play, persist as the looping current mood, or "None" for random idle cycling; mood is no longer shown on a public profile but on the play-screen stage.
- `server-rendering`: the set of site pages becomes landing, register, login, and play; search/favorites/profile/create routes (and their views) are removed while the shared-chrome/layout model stays.
- `embed-widget`: unchanged rendering, but the widget's link back to the app points at the play screen instead of a public profile.

## Impact

- **Routes/views removed**: `/create`, `/login`, `/search`, `/favorites`, `/:username` public pages, and the search/favorites page services; new `/register` (or a dedicated register path) and `/play` routes. Views: `create.ejs`, `login.ejs`, `search.ejs`, `favorites.ejs`, `profile.ejs` replaced by `register.ejs`, `login.ejs`, `play.ejs`; landing reworked.
- **Client**: a new `play.js` (stage + tabs) replaces `builder.js`, `profile.js`, `search.js`, `favorites.js`; `interactions.js`, `moods.js`, `avatar.js`, `buddy-thumbs.js`, `buddy-3d.js` are reused/adapted; nav chrome drops search/favorites/create links.
- **Server**: `pages.js` reworked, search/favorites/profile routers and services trimmed; interaction feed endpoint (GET own pokes), poke-send from Friends, humor set via existing mood API, appearance via existing `PUT /api/profile/:username`. `data-storage` unchanged at the schema level (profiles, moods, interactions feed, favorites all already persisted) — no new tables expected.
- **Assets**: no new assets expected — existing buddylabs catalogs and animation subset cover humors and appearance.
- **Tests**: existing `node --test` suites updated for the new routes/flow; new coverage for poke-as-message feed, poke-back from the feed, add-friend-by-username, humor play/set/None random cycling, and default appearance on registration.
- **Removed surface**: any tests/docs referencing public profiles, search, or dedicated favorites/create pages are updated.