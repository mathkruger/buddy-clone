## Why

The current poke playback reads as a disconnected overlay: a sender avatar flies across an empty strip while the target avatar only reacts up in the page header, so neither buddy visibly takes part in the scene. On top of that, visitors cannot re-watch a poke without silently sending a fresh one, and nothing stops a user from poking their own profile.

## What Changes

- Rebuild the interaction playback stage as a three-part scene: the current buddy's avatar on one side, the interaction effect in the middle, and the target buddy's avatar on the other side.
- Source the "current buddy" avatar from the sender's server-side profile instead of a stale browser snapshot, with the existing guest avatar as a fallback.
- Add an explicit replay control that replays the last-played animation locally, without sending a new interaction or reloading the page.
- Prevent self-pokes on both sides:
  - The server rejects an interaction whose sender equals the target (400), recording nothing.
  - A user viewing their own profile no longer sees poke buttons; the interactions section keeps their history and shows a note that they cannot poke themselves.
- Keep the existing authenticated-sender rule as the basis: only a logged-in user can send, and the sender is their authenticated username. This surfaces and fixes a stale claim in the main `interactions` spec that still describes the pre-auth guest-sender flow (see design.md).

## Capabilities

### New Capabilities
- none

### Modified Capabilities
- `interactions`: the playback scene now stages the sender buddy, the effect, and the target buddy in one layout; adds local replay after an interaction plays; and forbids sending an interaction to one's own profile.

## Impact

- `src/public/interactions.js` — three-column scene builder, server-resolved sender avatar, replay control, owner-aware visibility.
- `src/public/profile.js` — drives the interactions module's visibility based on profile ownership.
- `src/public/style.css` — stage layout, entrance/reaction keyframes adapted to the scene, replay button, reduced-motion and responsive rules.
- `src/services/interaction-service.js` — rejects self-poke with a validation error.
- `tests/api.test.js` — self-poke rejection coverage; existing interaction tests stay green.
- No schema/database changes; no new dependencies.