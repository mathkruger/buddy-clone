## Context

Greenfield project — empty repository, no existing code or dependencies. The approach is constrained by choices made in the proposal: plain HTML/CSS/JS frontend with no build step, a lightweight server only for storage, username-based public profiles with no accounts, and original artwork only (no Buddy Poke assets). See `proposal.md` for motivation.

## Goals / Non-Goals

**Goals:**
- Single-file-friendly original avatar rendering reusable across builder, profile, and embed widget.
- Server small enough to run with a minimal dependency set, using flat-file storage that is safe against corruption.
- No-account ownership model that still keeps profile editing exclusive to the owner.
- Embed widget fully isolated from host pages.

**Non-Goals:**
- No user accounts, passwords, friend graphs, or real-time push (WebSockets).
- No databases (no PostgreSQL/MySQL/MongoDB) — flat-file storage is sufficient for this scope.
- No build tooling or bundling for the frontend.
- No mobile-native clients; pages are responsive but web-only.

## Decisions

### 1. Backend: Node.js + Express, JSON-file store
Server is Node.js with Express serving both the static frontend and a tiny JSON API. Persistence is a single `data.json` written atomically (write temp file, then rename) and loaded into memory at startup. The store is organized as `{ users: { username: { avatarDef, mood, tokenHash, createdAt, interactions: [{ type, ts }] } } }`.

- Rationale: web-ubiquitous runtime; raw `node:http` would require hand-rolling routing that Express gives for free; one file keeps backup/debug trivial.
- Alternatives considered: Python Flask (equally valid; Node chosen so one language spans frontend and backend), SQLite via `better-sqlite3` (native build step; unnecessary at this scale — revisit if the store grows).

### 2. Avatar model: data-driven parts + one shared SVG renderer
A user's avatar is a plain JSON composition (`{ head, eyes, mouth, accessory, colors, ... }`). A single shared JavaScript renderer (`avatar.js`) turns that object plus a mood into an inline SVG string. The same renderer runs in the builder preview, the profile page, and the embed widget.

- Rationale: guarantees identical rendering everywhere (spec: reproducible avatar), keeps art swappable without touching logic, and works with zero build step (script tag loading).
- Alternatives considered: pre-rendered PNG sprites (harder to tint/reuse, larger payloads), canvas drawing (loses the SVG crispness and DOM testability).

### 3. Mood as a mapping over avatar parts
Mood is stored as a string name. A static `MOODS` table maps each supported mood to a visual delta: an override for the mouth/eyes expression and an optional accessory (e.g. "love" adds hearts overlay, "angry" draws angled brows). The renderer applies the delta on top of the base composition.

### 4. Ownership via claim token (no accounts)
On first successful save, the server generates a random 128-bit claim token, returns it once, stores only its SHA-256 hash, and the browser keeps it in `localStorage` keyed by username. All edit endpoints (`PUT` avatar, `PUT` mood) require the raw token to match the hash. The profile page shows edit controls only when a matching token is present locally.

- Rationale: satisfies the "edits require ownership" spec without building auth; hashing the token keeps a leaked database dump from granting edit access.
- Alternatives considered: passwords (contradicts no-auth decision), purely client-side edit gating (trivially bypassed).

### 5. Embed widget: sandboxed iframe
The embed snippet is `<iframe src="/embed/:username" width="200" height="280" sandbox="allow-scripts allow-same-origin" loading="lazy"></iframe>`. The `/embed/:username` page is minimal HTML loading the shared renderer, fetches profile data, renders avatar + mood, and shows a footer link back to the profile.

- Rationale: iframe gives hard isolation from host-page CSS/JS (spec requirement) with near-zero implementation effort, and works on blogs/forums that block arbitrary scripts. The snippet never changes when mood changes, satisfying the spec.
- Alternatives considered: script-tag widget injecting a `<div>` (needs shadow DOM + CSS reset to isolate; more code, more failure modes).

### 6. Interactions: fixed-size SVG animation layer on the profile
Interactions live in a catalog (`interactions.js`): each entry is an SVG/SMIL + CSS animation keyframing the target avatar (and an avatar representing the sender when the visitor has a claimed one, else a default guest) through a scripted sequence (e.g. poke = gentle bounce + swoosh line). On trigger the client POSTs the type and displays the animation in an overlay above the avatar; a running animation is interrupted/restarted on repeat rather than queued arbitrarily.

- Rationale: no external animation service (spec), no canvas/WebGL, degrades gracefully, and animation files are plain JS/CSS matching the no-build constraint.
- Alternatives considered: pre-recorded GIF/APNG loops (large, not customizable per avatar), Canvas/WebAnimations API (heavier, breaks the "one avatar realm" simplicity).

### 7. Routing and data flow
- `GET /` — home page shell; builder + username form bootstrapped from `builder.js`.
- `GET /:username` — profile page shell with data inline; `profile.js` renders avatar, mood, interaction history, and edit controls based on the stored token.
- `GET /embed/:username` — widget page.
- `GET /api/profile/:username` — JSON profile data (avatar, mood, interaction counts/recent).
- `POST /api/profiles` — create/claim profile (`{ username, avatarDef }`) → `{ token }` or 409.
- `PUT /api/profile/:username` — update avatar or mood (token-authenticated).
- `POST /api/profile/:username/interactions` — record interaction `{ type }`.
- All user-supplied strings (username, mood) are escaped on render; interaction history is bounded (e.g. last 50 kept).

## Risks / Trade-offs

- **JSON file store can corrupt or lose writes under concurrent requests** → single-process write queue + atomic rename; document that horizontal scaling means swapping to SQLite. Acceptable for hobby-traffic clone.
- **Claim token in `localStorage` is exposed if the site is XSS-attacked** → escape all user content on render, serve under restrictive CSP header, hash the token at rest. Residual risk accepted given no-auth scope.
- **Username squatting (first-come-first-served)** → inherent to the no-account model; the taken-username error guides users to pick another.
- **Fixed-size iframe may not fit narrow host layouts** → document two advertised sizes on the embed page for v1; a responsive/postMessage height mechanism is a deferred enhancement (see Open Questions).
- **SMIL reduces to CSS for animation breadth** → CSS animations cover the catalog; the catalog can grow without new assets.

## Migration Plan

Greenfield: no existing data or deployments. Go-live is "run `npm install`, start server, done". Rollback is not applicable before first deploy; after, keep `data.json` versioned and the previous code a `git checkout` away.

## Open Questions

- Whether the embed widget should auto-resize to fit its content in the host page (postMessage-based) — deferred; does not change specs, rendering approach, or task breakdown.
- How a sender's own avatar is chosen to appear in an interaction when the visitor has claimed a profile but is on a different browser — deferred; a default guest avatar satisfies the spec for v1.