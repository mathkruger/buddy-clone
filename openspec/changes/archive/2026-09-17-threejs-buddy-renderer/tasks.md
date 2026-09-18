## 1. Vendor Three.js as static assets

- [x] 1.1 Add `three` to `package.json` dependencies, run `npm install`, and verify `node_modules/three/build/three.module.js`, `node_modules/three/examples/jsm/loaders/FBXLoader.js`, and `node_modules/three/examples/jsm/libs/fflate.module.js` exist
- [x] 1.2 Add whitelisted vendor static routes in `src/server.js` (`/vendor/three` → three `build/`, `/vendor/three-examples` → three `examples/jsm/`), and verify with a running server that each of the three files returns HTTP 200
- [x] 1.3 Add an import map in `src/views/partials/head.ejs` mapping `"three"` to `/vendor/three/three.module.js`, and verify every page body (including `/create` and `/embed/:username`) contains the import map and that `import * as THREE from "three"` resolves in the browser console
- [x] 1.4 Verify `GET /3d-models/buddy-base.fbx` returns 200 with the expected file size from the app's own static path

## 2. Refactor avatar.js into the sticker/data module

- [x] 2.1 Relabel the head category in `AVATAR_PARTS` as "Hair style" (persisted key stays `head`), and export a `HEAD_TO_HAIR` mapping so each stored head value resolves to a hair sticker
- [x] 2.2 Keep `PALETTES`, `defaultComposition`, and `renderPartSnippet` behavior identical and remove/replace `renderAvatar`; verify by running a Node script that imports `avatar.js`, calls `renderPartSnippet` for every part, and confirms the module imports without touching `document`
- [x] 2.3 Add pure sticker-builder helpers (hair, eyes, mouth, accessory, mood overlay) that produce reusable SVG strings for a given composition; verify each category builds non-empty SVG for every option in its catalogue

## 3. Implement buddy-3d.js renderer

- [x] 3.1 Implement WebGL capability detection and a styled fallback block (no blank canvas); verify by loading a profile page with WebGL disabled in the browser and seeing the fallback message
- [x] 3.2 Implement the module-wide cached model load via `FBXLoader` (one `Promise` per URL); verify with a network-request log that mounting two avatars on one page fetches `/3d-models/buddy-base.fbx` exactly once
- [x] 3.3 Implement `mountAvatar(container, { composition, mood })` that builds the scene (camera, lights, loaded model), applies the composition background color, and returns a controller with `destroy()`; verify a canvas appears in the container and rendering is deterministic (two mounts with identical input produce the same visual)
- [x] 3.4 Implement sticker application: render the selected hair/eyes/mouth/accessory/mood SVG parts to textures placed at the calibrated anchor quad positions; verify parts change visibly in style and color when the composition changes
- [x] 3.5 Implement the idle-motion controller (gentle sway/breath) honoring `prefers-reduced-motion`, resize handling via `ResizeObserver`, and render-loop teardown on `destroy()`; verify idle animation plays on profile/embed and pauses under reduced motion

## 4. Migrate avatar surfaces to the 3D renderer

- [x] 4.1 Builder: mount the 3D renderer into `#builder-preview`, keep pickers on `renderPartSnippet`, update the category label to "Hair style"; verify selecting any part/color updates the 3D preview without a reload and the saved JSON still uses the `head` key
- [x] 4.2 Profile: mount the renderer into `#profile-avatar` and update the profile avatar editor label; verify a visitor sees the 3D avatar with idle motion and the owner's editor pickers still work and re-render on save
- [x] 4.3 Embed widget: mount the renderer in `widget.js`; verify the avatar renders inside the sandboxed iframe with current mood using only same-origin assets
- [x] 4.4 Search and favorites grids: mount renderers with `IntersectionObserver` lazy mounting + disposal; verify all results render and only one model request occurs on the page
- [x] 4.5 Interaction stage: render sender and target through the renderer and drive reactions via the reaction controller; verify a poke plays the target reaction in place, replaying replays locally without reload, and rapid replay does not leave a stuck stage

## 5. Styles and accessibility

- [x] 5.1 Update `src/public/style.css`: size/tint canvas-based avatars like the old `svg` rules, keep `.avatar-frame` box sizing, remove/replace avatar-specific CSS keyframes (idle sway on profile/embed, sender/target reaction keyframes) that no longer apply, and style the fallback block; verify profile and embed layouts are not broken
- [x] 5.2 Wrap mounted avatars with `role="img"` and a descriptive `aria-label`; verify the accessibility tree shows a labelled image instead of a bare canvas

## 6. Tests and end-to-end verification

- [x] 6.1 Extend `tests/api.test.js` to assert `/3d-models/buddy-base.fbx`, `/buddy-3d.js`, and the vendor modules (`/vendor/three/three.module.js`) are served 200; run `npm test` and confirm the full suite passes with no regressions
- [x] 6.2 End-to-end browser pass against the dev server: `/create` builder preview, `/profile`, `/embed/:username` in an iframe, search, favorites, and one interaction — each showing the 3D avatar, single model fetch, and no console errors