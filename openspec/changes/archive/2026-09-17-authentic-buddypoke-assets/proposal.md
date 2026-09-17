## Why

The app currently renders hand-drawn approximations (SVG parts + an FBX base) rather than the genuine Buddy Poke look. The original Buddy Poke assets — Flash-extracted skeletal meshes, texture atlases, and skeletal animations — are publicly reconstructable as the MinePoke project (https://minepoke.netlify.app), whose data files are compatible with Three.js. Rendering the authentic assets makes the avatar, moods, and interactions look like the real product instead of an imitation.

## What Changes

- **Vendor a curated subset of authentic Buddy Poke assets** (sourced from the MinePoke reconstruction) into `src/public/buddylabs/`: base meshes (Head/Body/Shadow), 7 hair meshes, 7 eye sprites (one per family), 7 mouth frames, authentic extras (caps, Glas, Mustache/Beard, a small props set), 3 palette PNGs (skin/shirt-spectrum/eye), composed geometry with bind skeleton, and a ~15-animation subset. All assets are self-hosted; no runtime fetch to minepoke.netlify.app.
- **New skinned-mesh renderer** replaces the FBX + SVG-decal pipeline in `buddy-3d.js`: reconstructs `BufferGeometry` + `SkinnedMesh` from the decoded geometry/skin-weights, builds body/face/hair texture atlases via canvas compositing (ported from the MinePoke app bundle), and plays skeletal animations with a custom player (per-bone axis-angle keyframes + head material mouth-frame channel). The `mountAvatar`/`setComposition`/`play`/`destroy` API surface stays intact so profiles, search, favorites, widget, and interactions keep working unchanged.
- **Builder pickers render the real assets** as live canvas thumbnails instead of lightweight SVG preview icons.
- **Part vocabulary switches to authentic values** — **BREAKING**. `head` maps to hair meshes, `eyes` maps to eye sprites, `mouth` maps to mouth frames, `accessory` maps to authentic extras (glasses, caps, facial hair, rose/mic/sword props). Old stored values that do not map cleanly reset to defaults on render. The `avatarDef` JSON shape is unchanged, so no database migration is needed.
- **Moods and interactions use the authentic animation set**: mood_happy/sad/inLove/angry/giggle/sleeping plus poke, hug, kiss, highfive variants (gimmeFive/highTen), jam (dance), and standBreathe. Sender fly-in entrances stay procedural (whole-object motion; not part of the skeletal set).
- **Old artwork policy is dropped**: the "Original artwork only" requirement is replaced by a self-hosted authentic-Buddy-Poke-assets policy.

## Capabilities

### New Capabilities
- `avatar-rendering`: Renders an avatar from its composition using bundled authentic buddy meshes, composited texture atlases, and skeletal animations, fully offline in the browser — covers mesh reconstruction, atlas building, animation playback, and thumbnails.

### Modified Capabilities
- `avatar-creation`: Part categories change from original hand-drawn artwork to authentic Buddy Poke hair/eyes/mouth/extras; live preview and picker thumbnails render through the 3D asset pipeline; the reproduced-avatar requirement no longer mandates inline SVG; the "Original artwork only" requirement is replaced by a self-contained authentic-assets policy, and old un-mappable part values reset to defaults.

## Impact

- **Code**: `src/public/buddy-3d.js` (renderer internals), `src/public/avatar.js` (part vocabulary resolve + previews), `src/public/moods.js` (mood→animation map), `src/public/interactions.js` (interaction→animation map), `src/public/builder.js` + `src/public/profile.js` picker thumbnails.
- **New assets**: `src/public/buddylabs/` (geometry, atlases, animations subset, SVG sprites, palettes) — from the MinePoke reconstruction, not the proprietary BinArt source.
- **Data**: `avatarDef` JSON shape and persistence are unchanged; only the meaning of part values changes (unmappable old values reset to defaults). No DB migration.
- **Behavior preserved**: interactions staging, mood persistence/validation, embed widget, search/favorites rendering, and widget mood-sync all keep their current external behavior.
- **Tests**: `tests/` treat `avatarDef` as opaque JSON; no test changes expected.