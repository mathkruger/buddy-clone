## Why

A poke today plays as a disconnected three-column scene: the sender's buddy, an effect badge, and the target's buddy each render in their own camera frame side by side, so neither buddy visibly occupies the other's space. The original Buddy Poke staged both buddies inside one shared frame where the interaction itself decided their placement — the sender approaches, makes contact, and recoils while the target reacts, all inside a single scene. We want that authentic shared-frame behaviour, not the separated dummy layout.

## What Changes

- Stage every interaction on a **single shared frame**: the sender and target buddies are mounted into one camera/scene together. Their placement is determined by the interaction, not by a fixed three-column layout — each interaction defines where the buddies start, how close they get, and whether they touch.
- Add per-interaction **choreography**: for poke, hug, high-five, and kiss the sender moves to the target and makes contact (tap, embrace, hand-slap, kiss), while the target reacts in place; dance stages both buddies adjacent in the same frame. Contact positions and distances are interaction-specific.
- Rework the play-screen stage: while idle it shows the viewer's own buddy; during an interaction both buddies share that same frame, and after playback the viewer's buddy is restored. The `.stage-sender` / `.stage-fx` / `.stage-target` three-column structure and its grid layout are removed.
- Keep the interaction catalog, sending, recording, replay, self-poke guards, and all server behaviour unchanged.

## Capabilities

### New Capabilities
- none

### Modified Capabilities
- `interactions`: the playback requirements change from a "three-part scene (sender on one side, effect in the middle, target on the other side)" to shared-frame staging where both buddies occupy one scene and each interaction determines their positions and any contact between them.

## Impact

- `src/public/buddy-3d.js` — new shared-stage API that mounts two avatars into one renderer/scene with per-avatar transforms (offset, facing, scale), reusing the module-wide asset caches; `mountAvatar` stays for single-buddy surfaces.
- `src/public/interactions.js` — `CATALOG` entries gain choreography data (start offsets, approach/contact timing, per-avatar motions); `buildStage`/`playScene` rewritten to drive the shared stage.
- `src/public/play.js` — stage ownership during playback (mount the pair, restore the viewer's own buddy afterward); status/replay paths unchanged.
- `src/public/style.css` — replace the interaction grid (`.interaction-stage.animated` columns, `.stage-sender`/`.stage-target`/`.stage-fx`) with shared-frame styling; keep `prefers-reduced-motion` behaviour.
- `src/views/play.ejs` — unchanged (the existing stage element is reused).
- Tests: server-side suites (`tests/api.test.js`, `store.test.js`, `smoke.test.js`) are unaffected; there is no client test harness, so the scene is verified in the browser.
- No new dependencies; no schema or database changes.