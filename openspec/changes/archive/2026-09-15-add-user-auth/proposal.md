## Why

The app has no real authentication: a "login" only checks whether this browser's local storage happens to hold an opaque claim token generated when the buddy was created, and virtually every view (profiles, search, pokes, favorites) is open to anonymous visitors. There is no way to identify a user on another browser or have the server verify who is acting. The app needs proper accounts: a username+password that the server can verify on every protected action.

## What Changes

- **Password accounts (BREAKING)**: Creating a buddy now requires a username and a password. Passwords are hashed with bcrypt and stored in the database; the old random claim-token ownership model is removed.
- **Login / logout / session**: Add a real login (username + password) that the server validates against the stored password hash and issues a JWT. Authenticated sessions are carried as an HttpOnly cookie set at login and accepted on APIs as an `Authorization: Bearer <jwt>` header. Logging out invalidates/clears the session.
- **Protected views (BREAKING)**: Viewing other users' profiles and searching for buddies now require an account. Anonymous visitors are redirected to the login page. The embed widget stays public so external pages keep showing avatars without an account.
- **Protected actions**: Poking another buddy requires a logged-in account, and pokes are attributed to the authenticated user (no more anonymous `guest` pokes). Editing your own avatar/mood and managing favorites now use your authenticated identity instead of a stored claim token.
- **Logged-in users cannot create buddies (BREAKING)**: A logged-in user is blocked from creating a new buddy until they log out; the create page and `POST /api/profiles` enforce this.
- **Legacy ownership tokens stop working (BREAKING)**: profiles created before this change carry no password and cannot be claimed via the old token. Their profile and embed page remain visible; only password-based login is accepted. (Dev data only — see design.md.)

## Capabilities

### New Capabilities

- `user-auth`: Account creation with password, server-verified login, JWT issuance/validation, HttpOnly session cookie, logout, and the authenticated-identity contract used by every other capability.

### Modified Capabilities

- `user-profile`: Profile pages require a logged-in account; edit controls are gated by the authenticated owner (JWT) instead of a claim token; the embed widget remains public.
- `interactions`: Poking requires a logged-in account; the sender is the authenticated user (JWT), and anonymous/guest pokes are rejected.
- `buddy-search`: Search now requires a logged-in account; anonymous access is rejected.
- `site-navigation`: The login page becomes a username+password form backed by the auth API; creating a buddy is blocked while logged in.
- `favorites`: Adding, removing, and viewing favorites require the owner's authenticated account (JWT) instead of a claim token.
- `avatar-creation`: Saving an avatar requires a username and password; logged-in users cannot create; ownership is demonstrated by being logged in as that username, replacing the claim token.
- `mood`: Changing a mood is authorized by the authenticated owner account instead of a claim token.
- `data-storage`: User records store a bcrypt password hash alongside the avatar/mood; the claim-token hash is no longer used for authentication.
- `server-rendering`: Gated routes (`/search`, `/favorites`, `/:username`) redirect anonymous visitors to login; the create page reflects the logged-in/out state; session state comes from the auth API instead of browser tokens.

## Impact

- **Backend**: New auth module (`bcrypt` password hashing + `jsonwebtoken` HS256 signing), an auth router (`POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`), an auth middleware that reads the HttpOnly cookie or Bearer header, and gating applied to profile, search, favorites, interactions, and create routes.
- **Store / DB schema**: `users` gains a `passwordHash` column (nullable for legacy rows, previously `tokenHash`); creation requires a password; JWT subjects are normalized usernames.
- **Frontend**: `session.js` becomes JWT-aware and tells the header who is logged in from `GET /api/auth/me`; `login.js` submits username+password; builder/profile/search/favorites flows send the authenticated identity; create page detects a logged-in user and blocks creation.
- **Config**: A new `JWT_SECRET` env var (with a dev fallback) and optional session lifetime settings.
- **Dependencies**: Add `bcrypt` and `jsonwebtoken`.
- **Tests**: Replace token-based API tests with password/JWT flows; new tests for login, logout, session, gated pages/APIs, and blocked create-when-logged-in; existing interaction/favorites/profile tests updated.
- **Severity**: Breaking — old claim tokens and anonymous pokes/search no longer work. Legacy profiles (no password) remain viewable/embeddable but cannot be logged into.