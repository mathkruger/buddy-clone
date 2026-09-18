## Context

See `proposal.md` for motivation and the delta specs for requirements. This design records the current state and the choices needed to make the full catalog-backed model render.

Current state, verified against the vendored data:

- **Vocabulary is partly synthetic.** `avatar.js` stores `head` + `hair` duplicates, an `accessory` preset map (`buddylabs.js` `ACCESSORY_PRESETS`) separate from the real `props` category, and `body` (the `Body` catalog — `Head`/`Body`/`Shadow` — is never consulted by `buildAvatar`; it is always in `DEFAULT_MESH_PATHS`). Face layers store `frame-1`..`frame-5` values that do not map to any shipped symbol and are reset by `resolvePart`.
- **Renderer ignores most selections.** `labsComposition` (`buddy-3d.js:83`) reads only `head`/`eyes`/`mouth`/`accessory`/`beard`/`spot`/`brows` and `colors.{skin,accent,shirt,bg}`; it hardcodes `clothingItemName: "SkrtNone"`, drops `skirt` and `props`, and never reads hair material patterns/streaks, body-clothing layers, or eye color.
- **Body atlas is heavily restricted.** `buildBodyAtlasTexture` (`buddylabs.js:1056`) keeps only `Skin`, `ShrtLength`, `ShrtColor`, `Belt`, `BeltColor` (`buddylabs.js:1094`). Only 5 of ~200 body-material sprite refs are vendored; socks, pants, shoes, gloves, shirt patterns/layers, and belt patterns all 404. `resolveBodyColor`/`layerColorKey` only understand `Skin`, `ShrtSpectrum`, `PantSpectrum`.
- **Assets are reachable.** Every missing sprite/texture returns 200 from `https://minepoke.netlify.app/assets/buddylabs/...`; `/assets/buddylabs` is served from `src/public/buddylabs` (`server.js:82`), matching the manifests' absolute `publicPath`.
- **Thumbnails exist but only for 4 categories.** `buddy-thumbs.js` snapshots authentic parts via `labsComposition`, but `variantComposition` (`buddy-thumbs.js:80`) only varies `head`/`eyes`/`mouth`/`accessory`.
- **Server treats `avatarDef` as opaque JSON** (`profile-service.js` only checks it is a plain object) and already imports from `src/public/` (`isValidMood` from `moods.js`), so a DOM-free normalizer in `avatar.js` can be shared with the server.

## Goals / Non-Goals

**Goals:**
- One canonical composition schema whose every field maps to a shipped asset.
- Render every exposed option in preview, thumbnail, profile, embed, and interaction scenes.
- Reset obsolete stored fields (no data migration) while keeping valid canonical values.
- Add a guard test that every exposed vocabulary value resolves to a vendored file.

**Non-Goals:**
- Morph deltas, bone-hierarchy binding, and source texture bytes marked pending in `geometry-preview.json` (unchanged renderer limitations).
- New API endpoints or a DB schema change; `avatarDef` stays opaque JSON.
- A legacy-name → canonical-name migration map (reset was chosen).
- Curating/filtering content within the shipped catalogs (see Risks for the shirt-logo content note).
- Changing the `mountAvatar`/`labsComposition` public surface used by other views beyond the composition shape.

## Decisions

### D1. Canonical composition schema and `normalizeComposition`

Define the canonical shape in `avatar.js`:

```js
{
  hair: <Hair catalog item>,          // e.g. "Hair_Reg_MainShort_PartMid"
  eyes: <eye family>,                 // "Eyes_Male" | ... (7)
  mouth: <mouth frame name>,          // "smile" | ... (7)
  props: <Props catalog item | "none">,
  skirt: <Skrt item>,                 // "SkrtNone" | "Skrt" | "SkrtLong"
  clothing: { <layerName>: <symbol> }, // body-material layers, by manifest layer name
  face: { spot, eyeShadow, mask, brows, glasses, mustache, beard }, // symbol | "none"
  colors: { skin, eye, hair, shirt, pants, socks, shoes, belt, glove },
  hairMaterial: { patternIndex, patternColor, streakIndex, streakColor }
}
```

Add `normalizeComposition(raw)` (DOM-free) that starts from `defaultComposition()` and copies a field only when it is a known, valid value for that category (via the same `resolvePart`/catalog lookup); every other value — including all obsolete names `head`, `accessory`, `body`, `accent`, `bg`, and `frame-N` face values — is dropped so the default applies. `defaultComposition()` returns the full canonical shape.

- **Where it runs**: client on load/save (`builder.js`) and server on create/update (`profile-service.js:create`/`update`) by importing `normalizeComposition` from `../public/avatar.js`. This keeps a single source of truth and prevents API callers from persisting invalid fields. The server still stores `avatarDef` verbatim as JSON — it is normalized on write, not migrated in the DB.
- **Why reset, not migrate**: user decision; there is no unambiguous mapping for `head`→`hair` (both exist today) and reset is one pass with no map table to maintain. Trade-off recorded under Risks.
- **Alternative rejected**: normalizing only on the client (a direct API POST could store invalid data; the server already validates other fields, so it should validate this too).

### D2. Catalog vocabulary lives in `avatar.js`, guarded by a test

Keep explicit, DOM-free catalogs in `avatar.js` (as today) rather than deriving them from the JSON manifests at runtime:

- `HAIR_OPTIONS` (48, already complete and matching the geometry catalog).
- `PROPS_OPTIONS` (`Strat`, `Rose`, `Mic`, `Sword`, `Mallet`, `Ball`, `Vesp_Body`, `Vesp_Tire_Main`, `Vesp_Tire_Side`, `Vesp_SideCar`).
- `SKIRT_OPTIONS` (`SkrtNone`, `Skrt`, `SkrtLong`).
- `CLOTHING_CATALOG`: per body-material `category` (`socks`, `pants`, `shirt`, `shoes`, `gloves`, `belt`) the layers and their non-blank texture symbols, copied from `body-material.json`. Each entry is `{ label, layer, symbols: [...] }`.
- `FACE_CATALOG`: per face layer (`spot`, `eyeShadow`, `mask`, `brows`, `glasses`, `mustache`, `beard`) the shipped symbol names and their sprite directory, taken from the vendored `face-symbols/` set (`Brows_Thin`/`Brows_Thick`, `Glas_1`..`Glas_7`, `Must_Thin`/`Must_Thick`, `Berd_Chops`/`ChinPatch`/`Goat`/`Full`/`5OClock`, `Spot_Beauty_1`/`Beauty_2`/`Freckles_1`, `EyeShadow_1`..`EyeShadow_3`, `Mask_1`..`Mask_5`).

Rationale: `avatar.js` is imported by the server, so it must not `fetch`; explicit lists keep normalization synchronous. Risk: lists drift from the manifests. **Mitigation**: a new `node:test` reads `body-material.json`, `head-material.json`, `geometry-preview.json`, and the `face-symbols/` directory and asserts every exposed value maps to a non-blank manifest texture / existing sprite file, and that every non-blank manifest option is exposed.

- **Alternative rejected**: deriving options from manifests at runtime (forces async, duplicates the manifests' absolute `publicPath` handling, and the server cannot easily read them from the public dir).

### D3. Body atlas: remove the keep-filter and resolve symbols + per-category colors

In `buildBodyAtlasTexture`:

- Delete the `kept` filter (`buddylabs.js:1093-1095`) so every manifest layer with a non-blank texture composites, in `order`. The existing mask/`grabMask` and shadow-opacity logic already handles the generic cases.
- Change selection resolution: `selections[layer.name]` is now a **symbol** (or absent). Resolve it to the matching `textures[].index` before indexing; keep accepting a numeric index for internal callers. `options.clothing` replaces the flat `overrides.colors` argument as the source of selections.
- Extend `layerColorKey`/palette resolution: map each `lockColor` family to a `colors` key (`Sock*`→`socks`, `Pant*`→`pants`, `Shrt*`→`shirt`, `Shoe*`→`shoes`, `Glve*`→`glove`, `Belt*`→`belt`, `Skin`→`skin`). Pattern color layers reuse their category's color. All body textures reference the single vendored `shrt-spectrum.png` palette for their default swatch, so no new palette assets are required; skin uses `skin.png`.
- `buddy-3d.js`/`budddy-thumbs.js` pass `{ clothing, colors }` instead of `{ colors: { ShrtColor } }`.

- **Why per-layer selections**: it is exactly the manifest model, so new catalog options need no per-field plumbing; the builder groups layers by `category` for a friendly UI.
- **Alternative rejected**: a flat "shirt style / pant style" field per category (lossy — the catalog has independent length, pattern, and second-pattern layers).

### D4. Face atlas: named symbols instead of `frame-N`

Add a `FACE_SYMBOLS` map (symbol → sprite directory) in `avatar.js` (or a small module shared by `buddylabs.js`) and change `labsComposition` to pass `spotStyle`/`eyeShadowStyle`/`maskStyle`/`browStyle`/`glassesStyle`/`beardStyle` values that `faceSymbolPath` resolves. `faceSymbolPath("none")` → `null` (layer off). Defaults are `none` for the optional layers, with `brows`/`beard`/`mustache`/`glasses`/etc. off unless selected. The `FACE_LAYERS` behavior in `buddylabs.js` (multiply/solid roles, `5OClock`/`Must`/`Berd` routing by symbol) stays; only the incoming symbol values change from synthetic to real.

- **Alternative rejected**: keeping `frame-N` and mapping to symbols in the renderer (keeps a fake public vocabulary and prevents the guard test from being meaningful).

### D5. Hair, props, skirt, and hair material flow through

`labsComposition` becomes a pure mapping from the canonical composition to buddylabs options:

- `hairItemName: comp.hair` (validated), removing `head`/`ACCESSORY_PRESETS`.
- `accessoryItemName: comp.props` (`none` → null); the `Vesp_*` magnet logic in `collectItemPaths` already handles the Vespa multi-mesh prop.
- `clothingItemName: comp.skirt`.
- `hairMaterial`: read `comp.colors.hair` as `baseColor` and `comp.hairMaterial.patternIndex/patternColor/streakIndex/streakColor` (clamped by `buildHairTexture`).
- `eyeColor: comp.colors.eye`.
- Face layers from `comp.face`.
- Remove `ACCESSORY_PRESETS`; caps (`BCap_Hair`/`SCap_Hair`) are already Hair catalog items, and glasses/facial hair are face layers.

### D6. Builder and thumbnails

- `builder.js` builds pickers from `AVATAR_PARTS`/the new catalogs: hair, eyes, mouth, props, skirt, each clothing category, each face layer, colors, and hair material pattern/streak. `setSelection`/`setColor` write into `state.composition` via category-aware paths (`clothing.<layer>`, `face.<layer>`, `hairMaterial.<field>`).
- `buddy-thumbs.js` `variantComposition(category, name)` is generalized to clone the default composition and set the one varying field for every category; `thumbZoom` picks `face` for face-layer categories and `body` otherwise (props may be body/head depending on the item). Thumbnails for clothing use neutral colors so the shape reads.
- Remove the `body` picker group; keep `avatar.js` `renderPartSnippet` as the non-WebGL fallback.

### D7. Vendoring

Extend `scripts/fetch-minepoke-assets.mjs`:

- Body symbols: enumerate `body-material.json` textures, take every non-`Blank` `symbol` with a `publicPath`, and vendor `body-symbols/<DefineSprite_...>/1.svg` (~195 files).
- Prop textures: add `textures/mallet.png`, `strat-misc.png`, `vespa-base.png`, `vespaTire.png` to the binary set (the existing `TEXTURE_ALIASES` already point at these paths).
- Base head sprite `face-symbols/DefineSprite_214_Head/1.svg` (kept for fidelity even though the ported `Head` layer currently fills skin color procedurally).
- Update the generated `buddylabs/README.md` listing.
- The script stays a provenance artifact; assets are committed.

## Risks / Trade-offs

- **Reset loses existing avatars' hair/props/accessory** → accepted user decision; no legacy mapping. Documented in the spec scenario "Obsolete fields are reset". Values stored under canonical names (`eyes`, `mouth`) survive.
- **Trademarked / potentially offensive shirt art** → the full `ShrtLayer2` catalog includes brand logos (Nike, Batman, Playboy, etc.) and `ShrtLayer1` patterns. Exposing "all" surfaces them. Mitigation: flag for a product/content decision; the explicit `CLOTHING_CATALOG` in `avatar.js` makes filtering a one-line list edit if desired. Not filtered in this change (out of scope).
- **Repo size / request volume** (≈200 SVGs plus manifests) → assets are lazy-loaded per mount and cached module-wide; static gzip applies. SVG sprites are small; accept the growth.
- **Renderer regression on other views** (profile/embed/search/favorites/interactions all mount the same renderer) → the public surface is unchanged and the mapping is centralized in `labsComposition`; smoke-test every view and keep the existing `node --test` suite green.
- **Vocabulary drift from manifests** → the new guard test fails if `avatar.js` lists diverge from the vendored JSON / sprite files.
- **Body atlas visual differences** (patterns/shadows now visible) → expected; verify a sample of each category renders in the preview and thumbnails.
- **`normalizeComposition` on the server imports `avatar.js`** → `avatar.js` must remain DOM-free; the guard test runs it under `node` to catch accidental DOM usage.

## Migration Plan

1. Vendor assets (additive) and extend the fetch script + README.
2. Add canonical catalogs + `normalizeComposition` in `avatar.js`; add the guard test.
3. Rework `labsComposition` and the atlas builders (`buddy-3d.js`, `buddylabs.js`).
4. Update `builder.js`/`buddy-thumbs.js` pickers and thumbnails.
5. Wire normalization into `profile-service.js` create/update.
6. Run `node --test`; manually smoke-test create/edit, profile, embed, search, favorites, interactions.
7. Rollback: `git revert`; stored `avatarDef` is reset client/server-side at read time, so reverting restores old behavior for newly written data and leaves old data intact (nothing destructive is persisted).

## Open Questions

- Whether to filter any `ShrtLayer2` brand/logo art for content reasons. Deferrable: it is a list edit in `CLOTHING_CATALOG` and does not change the schema, approach, or task breakdown.
