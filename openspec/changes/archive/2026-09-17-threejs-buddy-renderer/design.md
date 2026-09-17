## Context

The buddy is currently rendered as a byte-identical inline SVG by one shared function, `renderAvatar(composition, mood)` in `src/public/avatar.js`, mounted synchronously via `innerHTML` on six surfaces: the builder live preview, profile page, embed widget, search results, favorites, and the interaction stage. The server never renders the avatar — it only persists the `avatarDef` JSON (validated as a plain object) plus a mood; `avatar.js` is imported solely by browser modules (`moods.js` is the only avatar-related module the server imports). Client assets are all static files under `src/public`; `node_modules` is not served; CSP is `script-src 'self'`; the embed page allows `frame-ancestors *`. A 3D base model (`buddy-base.fbx`, ~3 MB) is already in the repo at `src/public/3d-models/`. Avatar motion today is CSS keyframes applied to `svg` elements (idle sway on profile/embed; sender/target reactions in the interaction stage). See proposal.md - Why for motivation; the behavior contract is in the specs delta.

## Goals / Non-Goals

**Goals:**
- Replace the inline-SVG scene renderer with a client-side 3D renderer everywhere the buddy is drawn.
- Reuse the existing SVG artwork as "stickers" (hair, eyes, mouth, accessory, mood overlays) on the 3D model, keeping the composition JSON shape unchanged (`head` reinterpreted as hair style) so stored avatars and the rollback path stay intact.
- Serve Three.js, its FBX loader, and the model exclusively from the app's own static assets (CSP `'self'` preserved; no CDN).
- Deterministic visuals per composition, renderer-driven motion, one model download per page, graceful WebGL fallback.

**Non-Goals:**
- No changes to the avatar `avatarDef` data model, the persistence layer, or the API.
- No server-side/SSR rendering of the 3D avatar.
- No new interaction catalog, no new part designs beyond relabeling head→hair and reusing existing catalogue values (new designs can land later without a spec change).
- No build/bundling toolchain (the repo has none and this change stays consistent with that).
- No conversion of the FBX to another format in this change (kept as an option below).

## Decisions

### 1. One 3D renderer replaces the inline SVG on every avatar surface
Add `src/public/buddy-3d.js` exposing `mountAvatar(container, { composition, mood }) -> Promise<controller>` and a module-wide cached model load. Every caller (builder preview, profile avatar, widget, search, favorites, interaction stage) swaps `el.innerHTML = renderAvatar(...)` for `mountAvatar(el, {...})`. Pickers keep using `renderPartSnippet(...)` so builders still see small SVG thumbnails of the sticker artwork.
- *Alternative:* keep SVG for small thumbnails (search/favorites) and use 3D only on profile/embed. Rejected — inconsistent visual language and two render paths to maintain; the request is a full change of the renderer.

### 2. `avatar.js` becomes the shared data + sticker module (not a scene renderer)
Keep `PALETTES`, `AVATAR_PARTS`, `defaultComposition`, `renderPartSnippet`, and the part builders. Drop/stop using `renderAvatar`; add a small exported map explaining which head value maps to which hair-style sticker and expose pure builders the renderer can string together per sticker. Keep the module DOM-free so it stays Node-valid for future server-side checks.
- The persisted `head` field is preserved; only the UI label becomes "Hair style" and each stored head value maps to a hair sticker drawn around the model's head ("round" default).
- *Alternative:* introduce a `hair` field and migrate stored rows. Rejected — no migration machinery exists and it breaks the clean rollback story.

### 3. Three.js and FBXLoader are served locally with an import map
- Add `three` to `package.json` dependencies.
- Add a whitelisted static route in `src/server.js`, e.g. `app.use("/vendor/three", express.static(.../three/build))` and `/vendor/three-examples` mapped to the `examples/jsm` subtree, exposing exactly `three.module.js`, `loaders/FBXLoader.js`, and `libs/fflate.module.js` (FBXLoader imports both relative `utils`… actually only `fflate` from `../libs/`), so its internal relative imports resolve from the same origin.
- Add a one-line import map in `partials/head.ejs` mapping `"three"` to `/vendor/three/three.module.js`, so `buddy-3d.js` can `import * as THREE from "three"`. All pages boot through this partial (including `embed.ejs`), so a single template edit covers every surface. `script-src 'self'` stays satisfied.
- *Alternative:* vendor copies of the files under `src/public/vendor` with rewritten import paths. Rejected — duplicated third-party files that drift from npm; the route approach keeps one source of truth. *Alternative:* esbuild/rollup bundle. Rejected — introduces a build pipeline the repo intentionally lacks.

### 4. FBX model loaded as-is; format conversion is a later optimization
`FBXLoader` parses `buddy-base.fbx` once and caches the resulting object on the module-level promise, satisfying "single model load per page". The 3 MB payload is mitigated by browser caching and one-fetch-per-page; if it proves heavy, a follow-up can convert to binary glTF and swap to `GLTFLoader` with no spec change.

### 5. Stickers: SVG → texture/quads anchored on the model
`buddy-3d.js` renders each selected part into an offscreen SVG (reusing `avatar.js` builders), uploads it as a `CanvasTexture`/`PlaneGeometry` anchored at fixed model-space offsets relative to the head/torso. Anchors are centralized in one calibration constant block so visual tuning is a single-file edit. Colors flow through the existing palette painters; mood overlays (sparkle, teardrop, hearts, …) attach as additional quads.

### 6. Motion moves into the renderer
Replace CSS keyframes that target avatar `svg`/wrapper elements with renderer controllers: an idle cycle (subtle sway/breath) on profile/embed, and a reaction controller for the interaction stage (bounce, squeeze, pop, blush, dance, sender entrances) implemented as transform pulses on the scene group. `prefers-reduced-motion` pauses idle loops. Non-avatar page CSS (entry pops, clouds) stays as-is.
- *Alternative:* keep CSS animation by transforming a wrapper element. Rejected — a CSS transform cannot convincingly animate a 3D scene, and the interaction reactions must affect the model itself.

### 7. Renderer lifecycle and context budget
Each mounted avatar owns a `WebGLRenderer` + `PerspectiveCamera` sized via `ResizeObserver`. Use `IntersectionObserver` on list surfaces (search/favorites/stage) to mount only when visible and dispose (renderer + textures) on unmount, staying within the browser's ~8–16 WebGL context limit and avoiding wasted GPU work. A `destroy()` on the controller also tears down its render loop.

### 8. Graceful degradation
Guard surfaces with WebGL + fetch capability checks: on failure render a styled fallback block (reusing `avatar-frame` styling) rather than a blank canvas, and log once.

## Risks / Trade-offs

- [3 MB FBX payload on every avatar surface] → single fetch cached per page plus HTTP caching; glTF conversion documented as follow-up option.
- [Sticker anchors won't line up with the FBX geometry first try] → central calibration constants; add a "tune anchors" task done against the real model. Depends on the FBX layout (see Open Questions).
- [Multiple WebGL contexts per page can exceed browser limits (search/favorites grids)] → IntersectionObserver lazy mount + dispose; renderer count stays near visible count.
- [Canvas replaces SVG, losing inline-markup accessibility] → wrapper gets `role="img"` + descriptive `aria-label`; builders still render sticker SVGs for sighted preview.
- [GPU-dependent output can differ pixel-perfectly across devices] → camera, lighting, pose, and sticker layout are fixed with no random inputs; differences limited to rasterization AA, not scene content.
- [Async mount introduces races in the interaction stage (rapid replay)] → controller token guards; stale controllers dispose before mounting the replacement.

## Migration Plan

1. Add `three` dependency; add the vendor static routes; add the import map to `partials/head.ejs`.
2. Refactor `avatar.js` into the sticker/data module (keep `renderPartSnippet`; extract sticker builders).
3. Implement `buddy-3d.js` (model load cache, scene, sticker quads, idle + reaction controllers, fallback).
4. Migrate callers surface-by-surface (builder → profile → embed → search → favorites → interactions), updating CSS selectors previously aimed at `svg`.
5. Extend `tests/api.test.js` to assert the model, vendor modules, and `buddy-3d.js` are served; keep existing static-asset and API assertions green; run `npm test`.
6. Manually verify in a browser with WebGL on/off and with `prefers-reduced-motion`.

Rollback: composition JSON is unchanged and the old `renderAvatar` semantics remain reproducible, so reverting the code (single commit) restores the SVG renderer with no data migration.

## Open Questions

- Does the FBX include named meshes/skeleton bones usable as sticker anchors, or should stickers be placed purely by fixed offsets in front of the head/torso? Either way anchors live in one calibration block; answering it just tells us whether anchoring can use bone-space coordinates. Doesn't change specs, approach, or tasks.
- Should the hair catalogue eventually grow beyond the seven legacy head values? Yes would be a later, spec-level addition — out of scope here.