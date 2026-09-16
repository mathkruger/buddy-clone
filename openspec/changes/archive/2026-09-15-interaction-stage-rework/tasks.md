## 1. Server-side self-poke guard

- [x] 1.1 In `src/services/interaction-service.js`, add a sender-vs-target equality check (normalized usernames) that throws `ValidationError` before `store.addInteraction` is called, and verify by running `npm test` with existing interaction tests still green
- [x] 1.2 Add an API test in `tests/api.test.js` asserting that a user poking their own profile gets a 400 with no interaction recorded (uses `createUser` + the interactions route), and run `npm test` to confirm the new test passes

## 2. Three-part playback scene (client)

- [x] 2.1 Rework `buildStage()` in `src/public/interactions.js` to render `.stage-sender`, `.stage-fx` (existing `EFFECTS` SVG), and `.stage-target` children and verify by loading a profile and triggering an interaction
- [x] 2.2 Add `loadSenderAvatar()` that resolves the current user's `avatarDef`/`mood` from `GET /api/profile/<me>` (cached per page) with the legacy `buddy.avatar.<me>` snapshot then `GUEST_AVATAR` as fallbacks, eager-pre-fetch it on first non-owner render, and verify the sender side shows the user's own avatar
- [x] 2.3 Move the target reaction (`react-*` classes and `.react-holder` wrapper) from the header `#profile-avatar` onto `.stage-target`, update `clearTargetReaction()` accordingly, and verify the reaction plays inside the stage while the header avatar stays static
- [x] 2.4 Re-author the sender entrance and target reaction keyframes in `src/public/style.css` for the grid scene (sender lunges toward the centre, target reacts in its column, effect reuses `fadeThrough`/`bumpText`) and verify `prefers-reduced-motion` still disables all stage animation

## 3. Replay control

- [x] 3.1 Track the last played type on successful trigger and add a hidden `▶ Replay` button to the interaction area that calls `play(lastType)` locally (no POST), updating `lastType` when a new type is triggered
- [x] 3.2 Verify replay behavior manually and via `npm test`: after a poke, Replay replays the scene, and interaction count/history are unchanged (the API test suite confirms no extra record is created)

## 4. Owner-aware interaction area

- [x] 4.1 Replace the `window.BuddyInteractions.register` no-op with a `render(profile)` entry point that `profile.js` calls from `render()`, so owners see no poke controls, a hidden replay, and a self-poke note while history stays visible
- [x] 4.2 Verify both states: an owner's profile shows the note and no buttons, and a logged-in visitor on someone else's profile sees the catalog buttons plus replay

## 5. Integration verification

- [x] 5.1 Run `npm test` and confirm api, store, and smoke suites all pass
- [x] 5.2 Browser-check a narrow viewport to confirm the three-column stage stays usable and the replay button is reachable