# Complete BuddyPoke Customization

## Why

The authentic **MinePoke/BuddyPoke** assets are vendored only as a curated subset: the body atlas compositor keeps only `Skin`, `ShrtLength`, `ShrtColor`, `Belt`, `BeltColor`, dropping socks, pants, shoes, gloves, and shirt patterns entirely, and only 5 of the ~200 body-symbol sprites referenced by `body-material.json` are present. The builder exposes categories the renderer ignores (`skirt`, `props` as distinct from `accessory`, and `face` layers whose picker values are synthetic `frame-1`..`frame-5` names that `resolvePart` resets to defaults), plus an unused `body` catalog and a `head`/`hair` duplicate. Several exposed Prop options (`Strat`, `Mallet`, the `Vesp_*` set) have no vendored texture. Preview and profile states therefore diverge — a `belt`, `skirt`, or `props` selection is discarded before it reaches the rendered avatar — so "the same buddy" is not reproducible.

We need to finish the customization surface so every available option is exposed, persisted, and rendered, remove concepts the authentic pipeline dropped (accent color, background, the `head` vs. `hair` duplication, the `accessory` vs. `props` split, the inert `body` catalog), replace the synthetic face-layer vocabulary with the real named symbols, extend the authentic thumbnail renderer to every exposed category, and vendor the missing assets so the full pipeline works.

**Scope boundary**: configure the builder and the rendering pipeline to the full BuddyPoke/MinePoke asset catalogs under `src/public/buddylabs/` (verified against `body-material.json`, `head-material.json`, `geometry-preview.json`, `hair-material`, `face-symbols`, `body-symbols`, `palettes`, and the catalog item lists). The rendering pipeline is ported from the MinePoke buddylabs builders; missing or unavailable catalogs (morph deltas, pending bone binding/source textures) are out of scope. No API change: `avatarDef` stays the opaque JSON contract between client and server.

## What Changes

The granularity of the customization model changes to match the authentic catalogs, and every exposed option becomes renderable from vendored assets.

- **BREAKING** — remove the `accent` color concept (it was a placeholder color already not applied by the authentic atlas). Remove `bg` (scene background) from the stored composition; scene background stays a fixed neutral. Both are reset to default on existing buddies.
- **BREAKING** — collapse duplicated storage/editing concepts: `head` and `hair` become a single `hair` value; `accessory` and `props` merge into a single `props` value; `clothingItemName` grows to the true `Skrt` (skirt) catalog item names. Legacy `head`, `accessory`, and `props` entries are reset on existing buddies (user decision: no migration mapping, only reset).
- **BREAKING** — replace the synthetic placeholder vocabulary with the real catalog values. `body` (the `Body` catalog has no rendering effect — it is always present in the default mesh set) is dropped; the face-layer `frame-1`..`frame-5` values are replaced by the shipped named symbols (`Brows_Thin`/`Brows_Thick`, `Glas_1`..`Glas_7`, `Must_Thin`/`Must_Thick`, `Berd_*`, `Spot_*`, `EyeShadow_1`..`EyeShadow_3`, `Mask_1`..`Mask_5`). All real Hair (48), Props (10) and Skrt (3) catalog items stay exposed.
- **Setting up a canonical, persisted composition schema** that mirrors the authentic Layers/catalogs: `hair/eyes/mouth/props/skirt` + `clothing` (body-material layer selections: sock, pant, shirt, shoe, glove, belt lengths/patterns) + `face` (`spot`, `eyeShadow`, `mask`, `eyes`, `brows`, `glasses`, `mustache`, `beard`) + `colors` (`skin`, `eye`, `hair`, `shirt`, `pants`, `socks`, `shoes`, `belt`, `glove`) + `hairMaterial` (`patternIndex`, `patternColor`, `streakIndex`, `streakColor`). All persisted composition fields not present in this schema are reset to defaults (existing buddies, or server-side on save).
- **Backing every exposed option with a vendored asset** — vendor the missing sprites referenced by the manifests and catalogs: ~195 body symbol SVGs (socks, pants, shirt lengths/patterns/layers/shadows, shoes, gloves, belts — only 5 of ~200 body-material refs are currently vendored), the four missing Prop textures (`mallet.png`, `strat-misc.png`, `vespa-base.png`, `vespaTire.png`), and the base `Head` face sprite, so every catalog-backed option can actually render. `scripts/fetch-minepoke-assets.mjs` and `buddylabs/README.md` are extended to cover them.
- **Rendering everything a composition can express** — `labsComposition` and `buddylabs.js` build the body atlas from all kept layers (skin, socks, pants, shirt, shoes, gloves, belt), the face from every enabled face-layer, and the hair/hat/props/skirt from catalog items — instead of the current hardcodeds (`accessory`-only presets and `SkrtNone`).
- **Builder renders authentic pickers for every category** — `buddy-thumbs.js` currently snapshots authentic thumbnails only for `head`/`eyes`/`mouth`/`accessory`; extend it to every exposed category and option via the shared asset cache, keeping the SVG snippet as fallback only (WebGL unavailable / thumbnail still painting).
- **Ownership/edit flow keeps working** — editing loads the full stored composition, and profile/embed/search/favorites render the same full composition so the buddy looks identical everywhere ("reproducible avatar").

## Capabilities

### New Capabilities

None. This change reworks the existing avatar creation/editing surface.

### Modified Capabilities

- `avatar-creation`: Requirement **Avatar composition** and Requirement **All buddylabs customization options exposed** change. The composition schema is reworked to the canonical catalog-backed model (removing accent/bg/`head`/`accessory`, adding `props`, `hair`, `skirt`, `face`, `hairMaterial`, `colors.{skin,eye,hair,shirt,pants,socks,shoes,belt}`), the builder must expose every catalog-backed option, pickers must render authentic thumbnails, and every exposed option must be rendered by the live preview from vendored assets.
- `buddy-edit`: Requirement **All buddylabs customization options exposed** changes in the same way — the editor must expose the same canonical catalog-backed options and render them from vendored assets, and pre-populate from the full stored composition.

## Impact

- **Client rendering**: `src/public/avatar.js` (vocabulary/palette/defaults), `src/public/buddylabs.js` (body atlas coat, face atlas coat, hair catalog items), `src/public/buddy-3d.js` (`labsComposition`), `src/public/builder.js` (pickers/colors), `src/public/buddy-thumbs.js` (authentic thumbnails), `src/public/profile.js`/`search.js`/`favorites.js`/`widget.js`/`interactions.js` (mount `labsComposition` — public `mountAvatar` surface unchanged).
- **Templates**: `src/views/create.ejs` (builder controls), plus the profile/embed/search/favorites views that consume the avatar frame (label/alt text only — composition is opaque JSON).
- **Server**: no API change — `avatarDef` remains opaque; only client-side normalization/reset-to-default is added along the canonized schema (server treats it as JSON, so no migration). `profile-service.js` gains a server-side normalization pass so API payloads cannot store invalid/obsolete fields.
- **Assets**: vendored symbol sprites / palettes under `src/public/buddylabs/` (via `scripts/fetch-minepoke-assets.mjs`); repo README and `buddylabs/README.md` updated.
- **Tests**: existing `node --test` suite (`tests/api.test.js`, `tests/smoke.test.js`, `tests/store.test.js`) must still pass; normalize/normalize reset cases and "all stored options render" mapping checks are added where feasible without WebGL (avatar.js is DOM-free, buddylabs.js needs three/browser).
- **Dependencies**: no new runtime dependencies (three + vendored assets).