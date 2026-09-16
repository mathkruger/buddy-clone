## Context

See `proposal.md` — Why. Current state that shapes this design:

- The stage (`#interaction-stage`) is an overlay strip: `.stage-sender` is absolutely positioned inside it, `.stage-effect` overlays it, and the target avatar reacts **in the page header** (`#profile-avatar`, driven by `.react-holder` classes). The scene reads as disconnected from both buddies.
- The sender avatar comes from a legacy `localStorage` key (`buddy.avatar.<me>`, written only on avatar create/edit) — it is stale or missing across devices and after session-cookie auth replaced browser-held tokens.
- Send flow is already authenticated-only: `POST /api/profile/:username/interactions` requires a session (`requireAuthApi`), sender = `req.auth.username`. Tests enforce anonymous → 401. The main `interactions` spec still carries pre-auth "guest sender" wording (a surfaced conflict, see Decisions/Risks).
- `profile.js` owns ownership state via `BuddyProfile.isOwner()` (`BuddySession.currentUser === profile.username`), but `interactions.js` currently builds buttons at module load — before the async session fetch resolves.
- There is no replay path: the only replay today is clicking the same button again, which re-POSTs and re-records the poke.

## Goals / Non-Goals

**Goals:**
- A single, coherent three-part playback scene: current buddy | effect | target buddy.
- Authoritative sender avatar (server profile) with graceful fallbacks.
- Explicit local replay of the last played interaction (no network, no record).
- Self-poke prevention enforced server-side and mirrored in the owner's UI.

**Non-Goals:**
- No new interaction types; the existing catalog, and its labels/classes, are kept.
- No change to history storage/format, interaction counts, or the embed widget (it has no interaction surface).
- No server-side "replay" concept — replay is purely a client-side playback concern.
- No guest-sending feature; anonymous visitors remain unable to send (existing behavior).

## Decisions

### 1. Three-column scene built in `interactions.js`, styled with CSS grid
`buildStage()` renders three children into `#interaction-stage` when `.animated`: `.stage-sender` (left), `.stage-fx` (middle, the existing `EFFECTS` SVG), `.stage-target` (right). The stage switches from `position: relative` overlay to a grid (`grid-template-columns: 1fr auto 1fr; align-items: end`). Sender and target avatars render at ~80px; the effect keeps its 200×220 viewBox and is centered.

- **Why grid:** declarative, responsive-scalable, and the effect column can `auto`-size to the SVG while avatar columns share the remaining space.
- **Alternatives considered:** flexbox (rejected: stretching/centering the middle column is more fiddly), keeping absolute positioning (rejected: that is exactly the disconnected look we're removing).

### 2. Sender avatar resolved from the server, cached per page
Add `loadSenderAvatar()` in `interactions.js`: `GET /api/profile/<me>` (`credentials: "same-origin"`), cached in a module variable for the page lifetime, returning `{ avatarDef, mood }`. Resolution order:
1. server profile (authoritative),
2. `localStorage["buddy.avatar.<me>"]` snapshot,
3. `GUEST_AVATAR` fallback.

Trigger playback eagerly pre-fetches this during the first `render()` of a non-owner profile (not polling, one fetch per page), so `play()` has the avatar ready. The target side uses `BuddyProfile.profile.avatarDef/mood` (already in hand). `renderAvatar()` (shared renderer) draws both.

- **Why server-first:** localStorage snapshot is only written on avatar create/edit and silently misses when the user is on another device or after storage reset; the server profile is the single source of truth.
- **Alternatives considered:** localStorage only (rejected: stale), embedding the viewer's avatarDef in the SSR profile JSON (rejected: the profile payload is about the *target*; would couple unrelated data).

### 3. Reactions move into the stage target column
The `react-*` target classes and `.react-holder` wrapper move from the header `#profile-avatar` onto `.stage-target` inside the stage; the header avatar stays static. `clearTargetReaction()` targets the stage element instead.

- **Why:** keeps the whole scene in the stage (the ask), and removes the fight between the header's idle-sway animation and reaction keyframes.
- **Alternatives considered:** keep the header reaction too (rejected: redundant movement and CSS conflicts; the header already belongs to the page, not the scene).

### 4. Rewrite entrance/reaction keyframes for the scene
The existing `stage-sender` keyframes translate hundreds of px across the old overlay; they no longer make sense in a grid. Per-interaction variety is preserved via the existing `sender-*`/`target`/`effect` class names, but the keyframes are re-authored: the sender lunges toward the centre (/effect) and settles back into its column, the effect reuses `fadeThrough`/`bumpText`, and the target runs its `react-*` bounce/squeeze/pop/blush/dance in its column. Exact px/rotation values are tuned with `animation-fill-mode` and checked visually; `prefers-reduced-motion` disables all `.stage-*` animation as today.

### 5. Replay control
Module state `let lastType = null`. A `▶ Replay` button lives beside the catalog buttons. `trigger(type)` sets `lastType = type` only after a successful POST; `replay()` calls `play(lastType)` directly — no POST, no count change. The button is hidden until something has played and remains visible until the stage is swept (it replays the same scene, including a re-resolved sender avatar from the cache). Clicking a new interaction type replaces `lastType`.

- **Why local-only:** replay must not fabricate interaction records.
- **Alternative considered:** server "replayed" flag (rejected: pollutes the history model for a client-side concern).

### 6. Owner-aware controls driven from `profile.js`
The existing `window.BuddyInteractions.register` no-op is replaced with a real `render(profile)` entry point that `profile.js` calls from `render()` after the session resolves. Behavior:
- **Owner:** clear the catalog buttons, hide replay, show a note ("This is your buddy — you can't poke yourself"); history (rendered by profile.js) stays visible.
- **Non-owner:** render the catalog buttons + replay, hide the note.

This resolves the module-load timing problem (ownership is only known once `BuddySession.ready()` resolves).

- **Why `profile.js` drives it:** it already has `BuddyProfile.isOwner()` and re-renders after every data refresh, so controls stay in sync with session changes.

### 7. Self-poke guard lives in the service layer
`interactionService.add()` normalizes and compares sender vs target, throwing `ValidationError` (→ 400 through the existing `routes/profiles.js` mapping) before calling `store.addInteraction`, so nothing is recorded. Client-side, the owner UI (decision 6) removes the buttons — the server guard is the enforcement, the UI is presentation.

- **Why service, not store:** it's a domain rule (`store.addInteraction` accepts any username pair); store stays a dumb persistence layer.
- **Alternative considered:** route-level check (rejected: the rule would be invisible to any other caller of the service).

### 8. Surface and fix the stale guest-sender wording in the main spec
The main `openspec/specs/interactions/spec.md` still describes pre-auth guest sending, which the codebase has not done since the auth change (anonymous ⇒ 401 in tests). The delta rewrites "Sending an interaction" to authenticated-only — a behaviour-statement fix, not a behaviour change — so archival brings the main spec in line with the implementation. Flagged for reviewer awareness; no production code changes are implied.

## Risks / Trade-offs

- **Animation tuning is subjective** → Keep the existing per-type class hooks; iterate keyframes in-browser; `prefers-reduced-motion` guarantees a usable static result.
- **First playback depends on a server profile fetch** → Pre-fetch sender avatar during first render; localStorage/guest fallbacks cover offline/unresolved cases.
- **Rewriting the main spec's guest-sender wording** (drift fix) → It matches tested behavior; any reviewer objection is a wording revert, not a code risk.
- **Replay can drift from the recorded poke if the sender edits their avatar mid-session** → Replay uses the page-cached sender avatar; acceptable for a client-only replay, and the note for the future is the cache is per-page.

## Migration Plan

- No data migration, schema change, or new dependency (client JS/CSS + one service guard).
- Deploy order: service guard and client assets together (single app).
- Rollback: revert the service guard and the client JS/CSS changes; the old overlay stage is self-contained in `interactions.js`/`style.css`.

## Open Questions

- Visual appetite for the entrance choreography (e.g., how far the sender lunges toward the middle) is best confirmed by eye once implemented; the class-based hooks make this a CSS-only tweak.
- Whether the target buddy's header avatar should also react alongside the stage scene — currently kept static for scene coherence; trivially re-enabled via the old `.react-holder` hook if preferred.