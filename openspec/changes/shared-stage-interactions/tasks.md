## 1. Shared-frame renderer (`buddy-3d.js`)

- [x] 1.1 Factor the reusable single-avatar machinery (asset load cache, WebGL check, fallback, mouth-frame repaint helper) so single and pair mounts share the same primitives while `mountAvatar`'s external contract stays unchanged; verify the play stage buddy and friends-list avatars still mount and animate (`node --test` green, play screen renders).
- [x] 1.2 Implement `mountSharedStage(container, { sender, target, label })` — one renderer/camera/scene, two avatar units built via `buildAvatar`/`labsComposition`, each with its own `AvatarAnimationPlayer`; verify both buddies appear in a single frame on the play stage with exactly one canvas and one backdrop.
- [x] 1.3 Implement union-box camera framing that fits the widest extent of the choreography (resting vs. contact) around the pair's midpoint, with `ResizeObserver` re-fit; verify neither buddy leaves the frame during playback, including at narrow widths.
- [x] 1.4 Preserve WebGL fallback and `prefers-reduced-motion` behavior on the shared controller; verify the fallback message renders once when WebGL is unavailable and reduced motion shows a static shared frame (no approach/recoil).
- [x] 1.5 Implement the playback step-sequencer (advance `t`, sample per-buddy keyframe tracks, fire skeletal and effect cues, resolve the play promise at duration end); verify with a temporary choreography that the scene runs to completion and resolves exactly once.

## 2. Interaction choreography (`interactions.js`)

- [x] 2.1 Add a `choreography` block to every `CATALOG` entry — start/approach/contact/recoil offsets, yaw facing, `senderAnim`/`targetAnim` cues, effect cue, and total duration — where poke, hug, high-five, and kiss reach contact at an interaction-specific distance and dance stages both buddies adjacent; verify in-browser each interaction makes its buddies share one frame and contact as specified.
- [x] 2.2 Rewrite `buildStage`/`playScene` to mount the shared stage and play the selected interaction's choreography, keeping `loadSenderAvatar`, the sender cache/reset, teardown, and the never-clear-a-newer-stage guard; verify poke from Friends, poke-back from the feed, and replay all play through the shared frame and restore the owner's buddy afterward.

## 3. Play screen glue (`play.js`)

- [x] 3.1 Update stage-ownership glue so `#play-stage` hosts the shared frame during playback (drop idle buddy → shared playback → restore), preserving `dropStage`/`mountSelf` and status text; verify every playback path (send, poke-back, replay) restores the viewer's own buddy and repeated triggers never leave a broken or stuck stage.
- [x] 3.2 Remove stale references to the three-column classes from the play screen client; verify no `.stage-sender`/`.stage-target`/`.stage-fx` elements are created during playback and the page has no console errors.

## 4. Styling (`style.css`)

- [x] 4.1 Delete the `.interaction-stage` grid and `.stage-sender`/`.stage-target`/`.stage-fx` column rules (and their `.play-stage-panel`/≤480px overrides); verify the shared frame uses the existing `#play-stage` single-frame treatment with no leftover column widths.
- [x] 4.2 Add `.interaction-live` hooks and effect-overlay styling (effect absolutely centered over the frame, fading in at the contact cue and out during recoil), plus reduced-motion and narrow-width rules; verify in-browser the overlay lands on the contact area and layouts look right at ≤480px and under `prefers-reduced-motion`.

## 5. Verification

- [x] 5.1 Run `node --test`; verify the full server suite (api, store, smoke) stays green with no skipped regressions.
- [x] 5.2 Browser-check every interaction type through send, poke-back, and replay: both buddies share one frame, placement/contact match each interaction's choreography, the page never reloads, and reduced-motion and mobile-width rendering behave correctly.