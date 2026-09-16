## Context

The app currently renders avatars with an FBX base (`buddy-base.fbx`) plus SVG decals in `src/public/buddy-3d.js`. The authentic look comes from the MinePoke reconstruction of Buddy Poke (https://minepoke.netlify.app), whose decoded data files we already have under `/tmp/minepoke/`: `geometry-preview.json` (58 meshes, 29-bone skeleton, skin weights), `animations.json` (94 skeletal anims), `body-material.json` (42 body-atlas layers) and `head-material.json` (17 face-atlas layers), plus the app bundle whose atlas/skeleton/animation logic (`Oy`, `eS`/`fd`, `gd`, `Mx` player) we reverse-engineered. All required endpoints return 200.

The current `mountAvatar`/`setComposition`/`play`/`destroy` API surface is consumed by `profile.js`, `search.js`, `favorites.js`, `widget.js` and `interactions.js`; keeping that surface lets the swap stay internal to the renderer. `avatarDef` is opaque JSON end-to-end (tests and server treat it as such), so the part-vocabulary change needs no DB migration.

The remaining documentation of the full pipeline lives in the prior investigation; this design only covers decisions needed to build the swap.

## Goals / Non-Goals

**Goals:**
- Authentic mesh/atlas/animation rendering, offline, in the browser.
- Keep the `mountAvatar` renderer surface and the `avatarDef` JSON shape unchanged.
- A curated subset (7 hair meshes, 7 eyes, 7 mouths, authentic extras, ~15 animations) that fits the current customization level.
- Builder pickers show thumbnails rendered from the real assets.

**Non-Goals:**
- Full 48-hair / 94-animation catalog.
- Clothing options beyond shirt color (pants/socks/shoes/gloves layers are dropped).
- Morph-target support (the weight channel) unless a required animation needs it.
- Changing the interactions staging scene, mood persistence, embed widget, or server validation.
- Making the Fly-in/non-skeletal entrances bone-driven (they stay procedural whole-object motion).

## Decisions

### D1. Vendor a curated subset under `src/public/buddylabs/`
Download via a one-off script (kept in the repo under `scripts/` for provenance) from `minepoke.netlify.app`:
- `geometry-preview.json` (meshes + bind skeleton + skin weights).
- A sliced `animations-subset.json` (only the mapped anims; see D5).
- `body-material.json`, `head-material.json` (unmodified; layer logic references them).
- Face/body SVG sprites for the chosen eyes/mouth/extras and their frame variants; palette PNGs (`skin.png`, `shrt-spectrum.png`, `eye.png`); static fallbacks (`Hair.jpg`, `Shadow.png`, `33.png`, `boy_body.png`).
- Rationale: self-contained, offline, mirrors the site's own asset layout so the ported builder functions work unmodified. Alternative (runtime proxy to `minepoke.netlify.app`) rejected: violates the offline requirement.

### D2. New renderer inside `buddy-3d.js`, same public API
Port the site's pipeline into a new internal module (`buddylabs.js`, imported by `buddy-3d.js`):
- **Skeleton**: rebuild bone hierarchy from `orderedBones` (`sa`), bind pose from `cpos`/`crot`.
- **Meshes**: reconstruct `BufferGeometry` (decode geometry into `position`/`uv`/`index`) and `SkinnedMesh` with skin weights decoded from the packed skin data (`skinBits`, per-vertex bone counts); apply geometry cull regions for hair/hat combos.
- **Atlas compositing**: body canvas (600×400) drawn from the body-material subset we keep (Skin fill, ShrtLength/Color, Belt) with the site's mask/opacity rules (Shadow layers at 0.28); face canvas (500×250) from head-material layers — Head skin fill (default skin palette `#f0c49e`), Spot multiply, Eyes frame (iris tinted via `eye.png` palette), Mouth frame, solid Brows/Glas/Beard/Mustache when enabled.
- **Hair material**: procedural texture (baseColor + pattern + streak) for regular hair; real `Hair.jpg`/`Shadow.png` for caps/shaves.
- **Animation player `Mx`**: rAF driver; per-bone `pos`/`rot` (axis-angle → `setFromAxisAngle` quaternion) keyframes with the site's `rotStatic`/loop-indexing semantics; `vis` visibility toggles; face material mouth-frame channel (`mat`) swaps the mouth texture each frame.
- Avatar root scale `.018`, position `(-1.35, .08, 0)` (site values), so interaction staging and camera work unchanged.
- Asset loading is cached module-wide so profiles/widgets/pickers share one decode.

Rationale: porting the exact consumer of the data (proven to produce correct visuals) is lower-risk than re-deriving the encoding. Alternative (writing raw geometry converters to glTF/GLB) rejected: adds a toolchain dependency and re-derivation risk for no behavioral gain.

### D3. Vocabulary swap with reset-to-default
`avatar.js` resolves each category to the new asset identifiers:
- `head` → 7 hair meshes; `eyes` → 7 eye sprites chosen procedurally: dot→Fem, round→Male, happy→Lake, wink→Rio, star→Goth, heart→Azn1, sleepy→Azn2 (one sprite from each family).
- `mouth` → 7 mouth frames (smile/laugh/frown/neutral/tongue/heart/growl) from the mouth sprite.
- `accessory` → authentic extras: glasses→Glas, beanie→BCap_Hair, flower→Rose prop; crown/bow/headphones/halo are **replaced** by caps (SCap_Hair), facial hair (Mustache/Beard), and props (Mic/Sword). Accessory set is reworked to exactly what the authentic extras offer.
- Values not in the new set reset to the category default (per user decision). No legacy→new mapping table.

### D4. Pickers render real assets
Builder/profile pickers draw each option's thumbnail from the shared asset cache: hair via a small orbiting mesh render, eyes/mouth by cropping the region from the composed face atlas, extras/props as mesh renders. Reuses the same `buddylabs.js` builders; reuses the existing tab/category UI shell, only the thumbnail draw path changes.

### D5. Animation subset and mood/interaction mapping
Slice to the anims we use and map them in `moods.js` (`MOODS` gains an `animation` field, e.g. happy→mood_happy, sad→mood_sad, love→mood_inLove, angry→mood_angry, excited→mood_giggle, sleepy→mood_sleeping) and `interactions.js` (`CATALOG` gains `senderAnim`/`targetAnim`, e.g. poke→poke1/poke2, hug→hug1/hug2, highfive→gimmeFive/highTen, kiss→kiss1/kiss2, dance→jamA/jamB; plus `standBreathe` idle). Exact animation names are verified against the sliced file during implementation (task-level detail). Sender entrances (fly-in etc.) remain procedural stage motion.

## Risks / Trade-offs

- **Asset size** (`geometry-preview.json` 3.5MB; full `animations.json` 27MB) → slice animations to the mapped subset and rely on static gzip; load lazily only where a renderer view mounts.
- **Morph deltas / source textures pending** in the geometry export → animations in our subset use bone/visibility/mouth channels; if a mapped anim requires the weight channel, drop it from the subset or approximate. Verified during implementation.
- **Fan-reconstruction provenance** (MinePoke) → assets come from the reconstruction's published data, not BinArt source binaries; kept as a one-off vendoring script with attribution in `README`.
- **SVG sprite loading volume** (many small SVGs) → batch-load and cache; static PNG fallbacks exist for the base textures.
- **Renderer regression surface** (profiles, widgets, search, favorites all mount the renderer) → the public API is preserved and the scene config (scale/position) is identical; each consumer is smoke-tested with the existing test suite + manual views.
- **Old avatars change appearance** (unmapped values reset) → accepted by design decision; only affects legacy part values, all of which visibly change anyway under the authentic set.

## Migration Plan

1. Vendor assets under `src/public/buddylabs/` (additive; no runtime impact).
2. Add `buddylabs.js` (builders + player) alongside the current renderer; swap `buddy-3d.js` internals while keeping its exported API.
3. Update `avatar.js` vocabulary maps and `moods.js`/`interactions.js` animation fields; update picker thumbnail draw paths.
4. Smoke-test builder, profile, widget, search, favorites, and interactions scenes.
5. Rollback: `git revert` the renderer/vocabulary commits; vendored assets are additive and unused by the old renderer, so no cleanup is required for rollback.