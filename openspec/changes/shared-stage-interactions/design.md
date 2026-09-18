## Context

See `proposal.md` — Why. Current state that shapes this design:

- `buddy-3d.js` mounts one avatar per call: `mountAvatar` owns a private renderer, camera, and scene, frames the camera to that single avatar's bounding box, and returns a controller (`play`, `setComposition`, `destroy`). It reuses module-wide asset caches (`loadGeometry/loadAnimations/loadBodyMaterial`).
- `interactions.js` stages playback as three siblings: `.stage-sender` and `.stage-target` each `mountAvatar` separately (two private scenes/cameras), with `.stage-fx` (an SVG effect) between them. Playback is orchestrated with a per-buddy `play(sender)` + delayed `play(targetAnim)`; per-buddy procedural `MOTIONS` tracks move the sender inside its own column.
- `play.js` owns `#play-stage`: idle it shows the viewer's buddy (`mountSelf`); `playOnStage` drops it, calls `playScene`, then remounts the buddy.
- Available animation data: the vendored subset (`animations-subset.json`) maps interaction names (`poke1`, `hug1`, `kiss2`, `gimmeFive1`, …) for one-shot skeletal playback; `AvatarAnimationPlayer` advances a single clip with an `elapsed`/frame clock.

## Goals / Non-Goals

**Goals:**
- One shared frame: a single renderer/camera/scene on the play screen stage containing both buddies during an interaction.
- Interaction-defined placement: each interaction supplies its own choreography — starting offsets, approach, contact distance, recoil — rather than a fixed central "effect" column.
- Contact for poke/hug/high-five/kiss (sender reaches the target at an interaction-specific distance); dance stages both buddies adjacent in the shared frame.
- Reuse the existing asset caches, single-buddy `mountAvatar`, and the play screen's stage-ownership flow (drop → play → restore).

**Non-Goals:**
- No changes to the interaction catalog, sending/recording/replay rules, self-poke guards, or any server behavior.
- No new interaction types, no new assets, no schema/database changes.
- No changes to single-buddy surfaces (profile, friends list, thumbs, embed).
- No generic multi-avatar scene API exposed beyond what `interactions.js` needs.

## Decisions

### 1. New `mountSharedStage` API in `buddy-3d.js`
Add `mountSharedStage(container, { sender, target, label })` that builds ONE renderer, camera, and scene and attaches two avatar units (sender + target). Each unit is built via the existing `buildAvatar`/`labsComposition` and gets its own `AvatarAnimationPlayer` (bone sets differ per avatar), but the units share camera, lights, and render loop, and are positioned as children of one scene group.

- Reuse: the mouth-frame repaint path, `sampleTrack` keyframe sampling, one-shot scheduling, WebGL check, and fallback message are extracted/loosened so singles and pairs share the same primitives; `mountAvatar` keeps its current external contract unchanged.
- Returns a controller `{ destroy(), play(type) }`; `play` takes a choreography id, not a raw motion name.
- **Why a new function rather than reusing `mountAvatar` twice in one container:** `mountAvatar` builds a private camera/scene per call and re-frames to one bounding box — two such mounts can never share a frame. A third canvas stacked on top would be a hack that keeps two disjoint coordinate systems.
- **Alternative considered:** rendering the pair to an offscreen canvas and compositing — rejected (adds a full double-render pass and complicates playback timing for no benefit).

### 2. Choreography is data owned by `interactions.js`
`CATALOG` entries gain a `choreography` object of keyframe tracks and animation cues in world space (units already scaled by `BUDDY_SCALE`, relative to the stage center `(0,0)`):
- per-buddy position/rotation/scale keyframes over time (`[t, { x, y, rotZ, scale }]`), e.g. the sender starting off-frame at `x: -3`, approaching, holding at contact `x ≈ -0.5`, then recoiling;
- per-buddy skeletal one-shots scheduled at moments: sender plays `poke1` at contact, target plays `poke2` a beat after; an effect cue (`fx-poke`) at the contact moment;
- a total duration and a resting layout (used for camera framing).

`mountSharedStage` stays generic: it plays the supplied tracks and hits the animation cues. This keeps interaction domain knowledge (poke distance ≈ arm length, hug = embrace at center) in the interaction module and the renderer interaction-agnostic.
- **Why keyframe data rather than hardcoded motion code per interaction:** the previous `MOTIONS` object is procedurally coded logic tied to the old column layout; declarative tracks make per-interaction tuning a data edit and keep the renderer generic.
- **Alternative considered:** shipping a separate animation scene per interaction — rejected (no new assets; the existing skeletal subset + placement tracks achieve the contact without new art).

### 3. Camera frames the pair's union box
Compute a combined bounding box of both avatars after the neutral resting layout, clamp the choreography's widest extent (start span vs contact span) into the frame, and set `CAM_DISTANCE` from that union so nothing walks out of frame. `ResizeObserver` handling and (optionally) orbit controls now target the midpoint of the union.
- **Why union framing:** a single-buddy fit (current `applyComposition`) would crop whoever is off-center as the sender approaches, which is exactly the "disconnected avatars" problem being removed.
- **Alternative considered:** a fixed 2.5-buddy-wide framing regardless of composition — rejected (avatar heights vary by parts selection; box-fit keeps the frame snug and consistent with the single-buddy treatment).

### 4. Playback timeline replaces loose per-buddy `play` chaining
The current `playScene` fires `senderCtl.play(sender)` and a delayed `targetCtl.play(targetAnim)` with a fixed `PAUSE_BEFORE` and separately resolves; two independent clocks. The shared controller runs a small step-sequencer on the render loop: advance `t`, apply each buddy's keyframe tracks, and at cue times start a skeletal one-shot on the relevant player and toggle the effect overlay. The sequencer resolves one promise when `t >= duration`, including the recoil/settle, so `playScene`'s teardown contract (never clear a newer stage) is preserved.
- Reduced motion: the sequencer warps straight to the resting shared-frame layout (no approach/recoil), matches current `prefers-reduced-motion` behavior.
- `playScene`/teardown/stage token plumbing in `play.js` stays as-is.

### 5. Effect becomes a centered overlay on the shared frame
Keep the existing `EFFECTS` SVG artwork but remove the middle column: the effect is absolutely centered over the shared frame's contact area (or stage midpoint), fading in at the contact cue and out during recoil. `.stage-fx` becomes an overlay; `.stage-sender`/`.stage-target` columns and the `grid-template-columns: 1fr auto 1fr` layout are deleted from `style.css`, and `.interaction-stage.animated` is replaced by a lightweight `.interaction-live` class on `#play-stage` (used only for overlay/reduced-motion styling).
- **Why keep the effect at all:** it preserves per-interaction identity cues (kiss hearts, high-five starburst) without new art assets, anchored to the action itself rather than a neutral middle column.
- **Alternative considered:** dropping effects entirely and relying on the choreography — rejected (loses the readable "who did what" cue that the original animations had).

### 6. Facing is a yaw, not a mirror
The two buddies face each other by rotating each avatar's object group around its own local Y (sender `+yaw`, target `-yaw`, tuned so both look at the contact point), instead of `scale.x = -1` mirroring.
- **Why yaw over negative scale:** a negative scale flips winding order and can corrupt shading/backface behavior on the shared meshes; a yaw rotation is cheap and safe for any geometry. Exact angles are tuned in-browser per interaction.

## Risks / Trade-offs

- **Contact distances/offsets are visual tuning** → World-space values are declarative data (decision 2); iterate per-interaction in-browser; reduced-motion offers a guaranteed static result.
- **Two skeleton players + mouth repaint per frame** → One renderer only; the existing single-buddy loop already handles both concerns, and the pair loop reuses the same per-frame work for two units.
- **Wide choreography can escape the frame** → Framing fits the union of start and contact extents (decision 3); clamp tracks to the fitted margin during tuning.
- **Yaw-facing may clip for tall hats/ears** → Angles are modest (<30°); verify per part in-browser; increase world spacing if a silhouette collision appears.
- **Rewriting interaction styling risks regressing the reduced-motion/fallback paths** → The WebGL fallback and `prefers-reduced-motion` branches are preserved in the shared controller; the single-buddy surface is untouched, so any regression is isolated to playback.

## Migration Plan

- Client-only change: `buddy-3d.js` (add `mountSharedStage`, factor shared helpers), `interactions.js` (choreography data + `playScene` rewrite), `play.js` (stage-ownership glue, unchanged orchestration), `style.css` (replace three-column grid with shared-frame styling). No view template, server, or schema changes.
- Rollback: revert the four client files; the previous column layout and `MOTIONS`-based playback are self-contained (kept intact until the rewrite lands).
- Verification: run `node --test` (server suites stay green), then browser-check each interaction for playback, replay, poke-back, reduced-motion, and narrow-width behavior.

## Open Questions

None that change the approach; exact per-interaction offsets, yaw angles, and timing are tuned in-browser during implementation under decision 2's data model.