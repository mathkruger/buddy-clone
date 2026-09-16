# buddylabs assets

Vendored from the **MinePoke** fan reconstruction of Buddy Poke
(<https://minepoke.netlify.app>) by `scripts/fetch-minepoke-assets.mjs`.

- Source base: `https://minepoke.netlify.app/assets/buddylabs/`
- Provenance: published data from the reconstruction, **not** BinArt source binaries.
- Scope: the curated subset used by the ported `buddylabs.js` renderer —
  geometry/skin data, body+head material manifests, the curated face/body hair
  symbol sprites, palette swatches, static texture fallbacks, and the sliced
  animation subset.

Major directories mirror the site's own layout so the ported builders resolve the
same paths they do on the source site:

- `geometry-preview.json` — 58 meshes, 29-bone bind skeleton, skin weights.
- `materials/body-material.json` — 42-layer body-atlas manifest (kept: Skin fill,
  ShrtLength/Color, Belt per design D2).
- `materials/head-material.json` — 17-layer face-atlas manifest.
- `animations-subset.json` — `animations.json` sliced to the mapped mood/
  interaction anims (design D5): mood_happy/mood_sad/mood_inLove/mood_angry/
  mood_giggle/mood_sleeping, poke1-2, hug1-2, gimmeFive1-2, highTen1-2,
  kiss1-2, jamA1-2, jamB1-2, standBreathe.
- `palettes/` — `skin.png`, `shrt-spectrum.png`, `eye.png` swatch strips.
- `textures/` — `Hair.jpg`, `Shadow.png`, `33.png`, `boy_body.png`
  (mesh fallbacks) plus prop textures `rose.jpg`, `mic.png`, `sword.png`.
- `face-symbols/` — 7 curated eye families (6 frames each), the mouth sprite
  (33 frames), and the full face-extra catalogs (Brows/5OClock/Mustache/Beard/
  Glas/Spot/EyeShadow/Mask).
- `body-symbols/` — body crate, shirt (+ shadow), belt (+ buckle) sprites.
- `hair-material/` — hair base + pattern/streak overlay sprites.

## Vendored files

```
- `animations-subset.json`
- `body-material.json`
- `body-symbols/DefineSprite_429_Belt_Reg_Buckle_Reg/1.svg`
- `body-symbols/DefineSprite_446_Belt_Reg/1.svg`
- `body-symbols/DefineSprite_551_Shrt_Tee_Shadow/1.svg`
- `body-symbols/DefineSprite_553_Shrt_Tee/1.svg`
- `body-symbols/DefineSprite_554_Body/1.svg`
- `face-symbols/DefineSprite_1002_Mask_3/1.svg`
- `face-symbols/DefineSprite_1005_Mask_2/1.svg`
- `face-symbols/DefineSprite_1008_Mask_1/1.svg`
- `face-symbols/DefineSprite_100_Spot_Beauty_2/1.svg`
- `face-symbols/DefineSprite_1012_Berd_5OClock/1.svg`
- `face-symbols/DefineSprite_102_Spot_Beauty_1/1.svg`
- `face-symbols/DefineSprite_104_Spot_Freckles_1/1.svg`
- `face-symbols/DefineSprite_107_Brows_Thin/1.svg`
- `face-symbols/DefineSprite_122_Eyes_Azn2/1.svg`
- `face-symbols/DefineSprite_122_Eyes_Azn2/2.svg`
- `face-symbols/DefineSprite_122_Eyes_Azn2/3.svg`
- `face-symbols/DefineSprite_122_Eyes_Azn2/4.svg`
- `face-symbols/DefineSprite_122_Eyes_Azn2/5.svg`
- `face-symbols/DefineSprite_122_Eyes_Azn2/6.svg`
- `face-symbols/DefineSprite_123_Eyes_Azn1/1.svg`
- `face-symbols/DefineSprite_123_Eyes_Azn1/2.svg`
- `face-symbols/DefineSprite_123_Eyes_Azn1/3.svg`
- `face-symbols/DefineSprite_123_Eyes_Azn1/4.svg`
- `face-symbols/DefineSprite_123_Eyes_Azn1/5.svg`
- `face-symbols/DefineSprite_123_Eyes_Azn1/6.svg`
- `face-symbols/DefineSprite_136_Eyes_Lake/1.svg`
- `face-symbols/DefineSprite_136_Eyes_Lake/2.svg`
- `face-symbols/DefineSprite_136_Eyes_Lake/3.svg`
- `face-symbols/DefineSprite_136_Eyes_Lake/4.svg`
- `face-symbols/DefineSprite_136_Eyes_Lake/5.svg`
- `face-symbols/DefineSprite_136_Eyes_Lake/6.svg`
- `face-symbols/DefineSprite_146_Eyes_Fem/1.svg`
- `face-symbols/DefineSprite_146_Eyes_Fem/2.svg`
- `face-symbols/DefineSprite_146_Eyes_Fem/3.svg`
- `face-symbols/DefineSprite_146_Eyes_Fem/4.svg`
- `face-symbols/DefineSprite_146_Eyes_Fem/5.svg`
- `face-symbols/DefineSprite_146_Eyes_Fem/6.svg`
- `face-symbols/DefineSprite_26_EyeShadow_3/1.svg`
- `face-symbols/DefineSprite_28_EyeShadow_2/1.svg`
- `face-symbols/DefineSprite_30_EyeShadow_1/1.svg`
- `face-symbols/DefineSprite_44_Mouth/1.svg`
- `face-symbols/DefineSprite_44_Mouth/10.svg`
- `face-symbols/DefineSprite_44_Mouth/11.svg`
- `face-symbols/DefineSprite_44_Mouth/12.svg`
- `face-symbols/DefineSprite_44_Mouth/13.svg`
- `face-symbols/DefineSprite_44_Mouth/14.svg`
- `face-symbols/DefineSprite_44_Mouth/15.svg`
- `face-symbols/DefineSprite_44_Mouth/16.svg`
- `face-symbols/DefineSprite_44_Mouth/17.svg`
- `face-symbols/DefineSprite_44_Mouth/18.svg`
- `face-symbols/DefineSprite_44_Mouth/19.svg`
- `face-symbols/DefineSprite_44_Mouth/2.svg`
- `face-symbols/DefineSprite_44_Mouth/20.svg`
- `face-symbols/DefineSprite_44_Mouth/21.svg`
- `face-symbols/DefineSprite_44_Mouth/22.svg`
- `face-symbols/DefineSprite_44_Mouth/23.svg`
- `face-symbols/DefineSprite_44_Mouth/24.svg`
- `face-symbols/DefineSprite_44_Mouth/25.svg`
- `face-symbols/DefineSprite_44_Mouth/26.svg`
- `face-symbols/DefineSprite_44_Mouth/27.svg`
- `face-symbols/DefineSprite_44_Mouth/28.svg`
- `face-symbols/DefineSprite_44_Mouth/29.svg`
- `face-symbols/DefineSprite_44_Mouth/3.svg`
- `face-symbols/DefineSprite_44_Mouth/30.svg`
- `face-symbols/DefineSprite_44_Mouth/31.svg`
- `face-symbols/DefineSprite_44_Mouth/32.svg`
- `face-symbols/DefineSprite_44_Mouth/33.svg`
- `face-symbols/DefineSprite_44_Mouth/4.svg`
- `face-symbols/DefineSprite_44_Mouth/5.svg`
- `face-symbols/DefineSprite_44_Mouth/6.svg`
- `face-symbols/DefineSprite_44_Mouth/7.svg`
- `face-symbols/DefineSprite_44_Mouth/8.svg`
- `face-symbols/DefineSprite_44_Mouth/9.svg`
- `face-symbols/DefineSprite_641_Berd_Chops/1.svg`
- `face-symbols/DefineSprite_646_Berd_ChinPatch/1.svg`
- `face-symbols/DefineSprite_649_Must_Thin/1.svg`
- `face-symbols/DefineSprite_654_Must_Thick/1.svg`
- `face-symbols/DefineSprite_676_Berd_Goat/1.svg`
- `face-symbols/DefineSprite_67_Eyes_Goth/1.svg`
- `face-symbols/DefineSprite_67_Eyes_Goth/2.svg`
- `face-symbols/DefineSprite_67_Eyes_Goth/3.svg`
- `face-symbols/DefineSprite_67_Eyes_Goth/4.svg`
- `face-symbols/DefineSprite_67_Eyes_Goth/5.svg`
- `face-symbols/DefineSprite_67_Eyes_Goth/6.svg`
- `face-symbols/DefineSprite_683_Berd_Full/1.svg`
- `face-symbols/DefineSprite_686_Glas_6/1.svg`
- `face-symbols/DefineSprite_689_Glas_5/1.svg`
- `face-symbols/DefineSprite_692_Glas_4/1.svg`
- `face-symbols/DefineSprite_695_Glas_3/1.svg`
- `face-symbols/DefineSprite_698_Glas_2/1.svg`
- `face-symbols/DefineSprite_69_Eyes_Rio/1.svg`
- `face-symbols/DefineSprite_69_Eyes_Rio/2.svg`
- `face-symbols/DefineSprite_69_Eyes_Rio/3.svg`
- `face-symbols/DefineSprite_69_Eyes_Rio/4.svg`
- `face-symbols/DefineSprite_69_Eyes_Rio/5.svg`
- `face-symbols/DefineSprite_69_Eyes_Rio/6.svg`
- `face-symbols/DefineSprite_92_Eyes_Male/1.svg`
- `face-symbols/DefineSprite_92_Eyes_Male/2.svg`
- `face-symbols/DefineSprite_92_Eyes_Male/3.svg`
- `face-symbols/DefineSprite_92_Eyes_Male/4.svg`
- `face-symbols/DefineSprite_92_Eyes_Male/5.svg`
- `face-symbols/DefineSprite_92_Eyes_Male/6.svg`
- `face-symbols/DefineSprite_989_Glas_7/1.svg`
- `face-symbols/DefineSprite_98_Brows_Thick/1.svg`
- `face-symbols/DefineSprite_992_Glas_1/1.svg`
- `face-symbols/DefineSprite_995_Mask_5/1.svg`
- `face-symbols/DefineSprite_999_Mask_4/1.svg`
- `geometry-preview.json`
- `hair-material/Hair.svg`
- `hair-material/Hair_Gradient_1.svg`
- `hair-material/Hair_Gradient_2.svg`
- `hair-material/Hair_Spots_1.svg`
- `hair-material/Hair_Spots_2.svg`
- `hair-material/Hair_Streak_1.svg`
- `hair-material/Hair_Streak_2.svg`
- `hair-material/Hair_Streak_3.svg`
- `hair-material/Hair_Streak_4.svg`
- `hair-material/Hair_Streak_5.svg`
- `hair-material/Hair_Stripe_Hor_1.svg`
- `hair-material/Hair_Stripe_Hor_2.svg`
- `hair-material/Hair_Stripe_Vert_1.svg`
- `hair-material/Hair_Stripe_Vert_2.svg`
- `head-material.json`
- `palettes/eye.png`
- `palettes/shrt-spectrum.png`
- `palettes/skin.png`
- `textures/33.png`
- `textures/Hair.jpg`
- `textures/Shadow.png`
- `textures/boy_body.png`
- `textures/mic.png`
- `textures/rose.jpg`
- `textures/sword.png`
```
