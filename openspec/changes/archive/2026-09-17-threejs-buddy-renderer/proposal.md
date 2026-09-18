## Why

The current buddy renderer draws everything as a flat inline SVG with CSS animations. The project now ships a real 3D base model (`src/public/3d-models/buddy-base.fbx`), and the avatars should be fully 3D: a Three.js renderer shows the model in a WebGL scene, while the customizable parts (hair style, eyes, mouth, accessories) stay as the project's original SVG artwork applied on the model like stickers. This keeps the playful Buddy Poke look while making the buddy three-dimensional.

## What Changes

- Add a new client-side 3D renderer (`buddy-3d.js`) built on Three.js that loads the locally-shipped FBX base model into a WebGL canvas and draws it with a fixed camera/lighting setup.
- **BREAKING (renderer):** Replace the `renderAvatar()` inline-SVG output used everywhere (builder preview, profile page, embed widget, search results, favorites, interaction stage) with the 3D renderer. Callers switch from synchronous `innerHTML = renderAvatar(...)` to mounting an async-rendered WebGL canvas.
- Apply customization parts as SVG "stickers": hair style (renamed from the old head-shape category), eyes, mouth/expression, accessory, plus mood overlay accessories, positioned on the model's face/head.
- Keep the persisted avatar composition JSON (`avatarDef`) shape compatible: the existing `head` field is reinterpreted as the hair style so stored avatars keep rendering; only the builder/profiler UI label changes to "Hair style".
- Replace avatar-specific CSS keyframe animations (idle sway on profile/embed, sender/target interaction reactions) with renderer-driven animation hooks so motion still plays on the 3D model.
- Serve Three.js and its FBX loader locally as static assets (never a CDN), and keep rendering free of any external asset service, preserving the "original artwork only" guarantee.
- Add graceful degradation when WebGL is unavailable (show a clear message instead of a broken canvas).

## Capabilities

### New Capabilities
- `buddy-3d-renderer`: Three.js/WebGL rendering of the buddy avatar from a `avatarDef` composition + mood — loads the local 3D base model, applies SVG sticker parts, renders deterministically for a given composition, animates via the renderer, and requires no external assets.

### Modified Capabilities
- `avatar-creation`: Avatar composition still selects parts and color palettes, but the "head shape" category becomes "hair style" applied to the 3D model, and the reproducible-avatar requirement changes from a byte-identical inline SVG string to a client-side 3D rendering that reproduces the same visual from the same composition; the "original SVG/data" wording is updated to cover SVG and 3D data.
- `server-rendering`: The "client assets remain static and unchanged" requirement is relaxed for avatar rendering — `avatar.js` evolves into the sticker data module, new renderer/vendor assets (Three.js modules, the FBX model) are served as static files — while the "served from our own static directory at stable URLs" behavior stays.

## Impact

- `src/public/avatar.js` — reworked: keeps palettes, part catalogues and SVG sticker builders, drops the scene-level `renderAvatar()`; `renderPartSnippet()` kept for pickers.
- New `src/public/buddy-3d.js` — Three.js renderer (model load, scene, sticker decals, animation hooks, WebGL detection, shared cached model instance).
- New static assets: `src/public/3d-models/buddy-base.fbx` (already present) plus a locally-served Three.js dependency tree (`three`, `FBXLoader`, `fflate`).
- `src/public/builder.js`, `profile.js`, `widget.js`, `search.js`, `favorites.js`, `interactions.js` — switch from `renderAvatar()` to the 3D renderer; topology/selectors of the generated markup change (canvas replaces the `<svg>`).
- `src/public/style.css` — avatar `<svg>` sizing/idle-sway rules and interaction stage keyframes reworked for canvas + renderer animations; picker SVGs unchanged.
- `src/server.js` — optional extra `express.static` route to expose the whitelisted Three.js assets; CSP stays `script-src 'self'`.
- `package.json` — new `three` dependency (browser-only usage).
- Tests (`tests/api.test.js`) — served-static assertions keep passing; add checks that the model and vendor assets are served and that `buddy-3d.js` is reachable.