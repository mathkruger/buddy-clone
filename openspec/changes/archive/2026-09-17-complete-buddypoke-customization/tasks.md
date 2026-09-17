## 1. Vendor assets

- [x] 1.1 Extend `scripts/fetch-minepoke-assets.mjs` to enumerate every non-`Blank` `body-material.json` texture with a `publicPath` and vendor its `<DefineSprite_...>/1.svg` under `body-symbols/`; verify by running `node scripts/fetch-minepoke-assets.mjs` and confirming it reports ~200 body symbols downloaded
- [x] 1.2 Add the four missing Prop textures (`mallet.png`, `strat-misc.png`, `vespa-base.png`, `vespaTire.png`) to the binary downloads and the base head sprite `face-symbols/DefineSprite_214_Head/1.svg`; verify all four files exist under `src/public/buddylabs/textures/` and the head sprite exists under `face-symbols/`
- [x] 1.3 Confirm the generated `src/public/buddylabs/README.md` lists the new files; verify the file listing includes the body symbols, prop textures, and head sprite

## 2. Canonical vocabulary and normalization

- [x] 2.1 Replace the placeholder vocabulary in `src/public/avatar.js`: add `CLOTHING_CATALOG` (per body-material category/layer with non-blank symbols), `FACE_CATALOG` (real named symbols with sprite dirs), keep the 48 Hair / 10 Props / 3 Skrt options, remove `body` and the `frame-1`..`frame-5` face values, and drop `head`/`accessory`/`accent`/`bg`; verify `node --test` still imports the module without DOM errors
- [x] 2.2 Add `normalizeComposition(raw)` and update `defaultComposition()` to the canonical shape (`hair`, `eyes`, `mouth`, `props`, `skirt`, `clothing`, `face`, `colors.{skin,eye,hair,shirt,pants,socks,shoes,belt,glove}`, `hairMaterial`); verify with `node -e` that obsolete fields (`head`, `accessory`, `body`, `accent`, `bg`, `frame-1`) are dropped and valid canonical values survive
- [x] 2.3 Add a `node:test` guard that reads `body-material.json`, `head-material.json`, `geometry-preview.json`, and the `face-symbols/` directory and asserts every exposed vocabulary value maps to a shipped asset and every non-blank manifest option is exposed; verify `node --test tests/avatar-catalog.test.js` passes

## 3. Render the full composition

- [x] 3.1 In `src/public/buddylabs.js` `buildBodyAtlasTexture`, remove the `kept` layer filter, resolve `selections[layer.name]` from symbol name to `textures[].index`, and extend `layerColorKey`/palette mapping to `socks`, `pants`, `shirt`, `shoes`, `glove`, `belt`, `skin`; verify the guard/catalog test and a manual preview show sock/pant/shoe/glove/belt options rendering
- [x] 3.2 Add face symbol resolution (symbol → sprite directory; `"none"` → off) and update `FACE_LAYERS` consumers in `src/public/buddylabs.js`; verify a manual preview renders each `FACE_CATALOG` symbol
- [x] 3.3 Rewrite `labsComposition` in `src/public/buddy-3d.js` to map the canonical composition to buddylabs options (`hairItemName: comp.hair`, `accessoryItemName: comp.props`, `clothingItemName: comp.skirt`, `eyeColor`, face layers, `hairMaterial` with `colors.hair` base); remove `ACCESSORY_PRESETS`; verify `mountAvatar` renders hair/props/skirt/eye/facial-hair selections in the builder preview

## 4. Builder and thumbnail UI

- [x] 4.1 Rework `src/public/builder.js` to build pickers from the new catalogs (hair, eyes, mouth, props, skirt, clothing categories, face layers, colors, hair material) with category-aware `setSelection`/`setColor`, and remove the `body` group; verify each picker changes the live preview without a reload
- [x] 4.2 Generalize `variantComposition`/`thumbZoom` in `src/public/buddy-thumbs.js` to vary any category, including clothing, face, colors, hair material, props, and skirt; verify thumbnails render distinct authentic images for those categories
- [x] 4.3 Load stored `avatarDef` through `normalizeComposition` in `builder.js` edit mode; verify an old buddy with `head`/`accent`/`frame-1` fields loads with defaults and saves cleanly

## 5. Server normalization

- [x] 5.1 Call `normalizeComposition` in `src/services/profile-service.js` `create` and `update` before storing `avatarDef`; verify a POST/PUT with obsolete fields stores only canonical fields via `node --test tests/api.test.js`

## 6. Integration verification

- [x] 6.1 Run the full suite with `node --test` and verify all existing tests plus the new guard test pass
- [x] 6.2 Manually smoke-test create, edit, profile, embed, search, favorites, and interaction pages and verify each renders the same full composition
- [x] 6.3 Verify no third-party asset request occurs at runtime (only `/assets/buddylabs/...` and `/vendor/...`) using the browser network panel