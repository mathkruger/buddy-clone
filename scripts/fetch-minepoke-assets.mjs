#!/usr/bin/env node
// One-off provenance script for the OpenSpec change `authentic-buddypoke-assets`.
//
// Vendors the curated MinePoke (fan reconstruction of Buddy Poke) assets that the
// ported buddylabs renderer uses under `src/public/buddylabs/`, mirroring the
// site's own asset layout (`https://minepoke.netlify.app/assets/buddylabs/...`) so
// the ported builder functions resolve the same paths.
//
// Provenance: assets are published data from the MinePoke reconstruction
// (minepoke.netlify.app), not BinArt source binaries. See the vendored README.
//
// Usage: node scripts/fetch-minepoke-assets.mjs

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const BASE = 'https://minepoke.netlify.app/assets/buddylabs';
const OUT = join(ROOT, 'src', 'public', 'buddylabs');

// Data manifests consumed by the ported builders, unmodified.
const DATA = [
  'geometry-preview.json',
  'body-material.json',
  'head-material.json',
];

// Palette swatches sampled for skin / shirt / iris tinting.
const PALETTES = ['skin.png', 'shrt-spectrum.png', 'eye.png'].map((f) => `palettes/${f}`);

// Static mesh texture fallbacks (the geometry export holds color shells, not
// bitmaps; 33.png/boy_body.png are the deleted-projection fill colors).
const TEXTURES = ['Hair.jpg', 'Shadow.png', '33.png', 'boy_body.png'].map((f) => `textures/${f}`);

// Prop textures for the authentic extras (rose/mic/sword), same map as the site.
const PROPS = ['rose.jpg', 'mic.png', 'sword.png'].map((f) => `textures/${f}`);

// Face symbol sprites — the 7 curated eye families (all frame variants) plus the
// mouth sprite frames and one sprite from each enabled-by-accessory extra layer.
// Directory names match the full DefineSprite IDs from the site's Qy map.
const EYE_DIRS = [
  'DefineSprite_146_Eyes_Fem',
  'DefineSprite_92_Eyes_Male',
  'DefineSprite_136_Eyes_Lake',
  'DefineSprite_69_Eyes_Rio',
  'DefineSprite_67_Eyes_Goth',
  'DefineSprite_123_Eyes_Azn1',
  'DefineSprite_122_Eyes_Azn2',
];
// Each eye family has 6 frame variants; the mouth sprite has all 33 frames
// (the animation `mat` channel drives the Head mouth material index, and the
// ported `mouthSpriteFrame` clamps to 1..33).
const EYE_FRAMES = 6;
const MOUTH_FRAMES = 33;
// Face extras — the authentic option catalogs from the site's face editor
// (bundle `Rx`/`Px`/`Lx`/`Dx`/`Ix`/`Fx`/`Nx`). Each `<sprite>/1.svg` path is
// referenced by the face atlas layers (Brows/Glas/5OClock/Mustache/Beard/Spot/
// EyeShadow/Mask) when a non-default option is selected.
const FACE_EXTRAS = [
  'DefineSprite_1012_Berd_5OClock',
  'DefineSprite_641_Berd_Chops',
  'DefineSprite_646_Berd_ChinPatch',
  'DefineSprite_649_Must_Thin',
  'DefineSprite_654_Must_Thick',
  'DefineSprite_676_Berd_Goat',
  'DefineSprite_683_Berd_Full',
  'DefineSprite_992_Glas_1',
  'DefineSprite_698_Glas_2',
  'DefineSprite_695_Glas_3',
  'DefineSprite_692_Glas_4',
  'DefineSprite_689_Glas_5',
  'DefineSprite_686_Glas_6',
  'DefineSprite_989_Glas_7',
  'DefineSprite_107_Brows_Thin',
  'DefineSprite_98_Brows_Thick',
  'DefineSprite_30_EyeShadow_1',
  'DefineSprite_28_EyeShadow_2',
  'DefineSprite_26_EyeShadow_3',
  'DefineSprite_1008_Mask_1',
  'DefineSprite_1005_Mask_2',
  'DefineSprite_1002_Mask_3',
  'DefineSprite_999_Mask_4',
  'DefineSprite_995_Mask_5',
  'DefineSprite_102_Spot_Beauty_1',
  'DefineSprite_100_Spot_Beauty_2',
  'DefineSprite_104_Spot_Freckles_1',
].map((n) => `${n}/1.svg`);

function faceSymbols() {
  const urls = [];
  for (const dir of EYE_DIRS) {
    for (let i = 1; i <= EYE_FRAMES; i++) urls.push(`face-symbols/${dir}/${i}.svg`);
  }
  for (let i = 1; i <= MOUTH_FRAMES; i++) urls.push(`face-symbols/DefineSprite_44_Mouth/${i}.svg`);
  urls.push(...FACE_EXTRAS.map((n) => `face-symbols/${n}`));
  return urls;
}

// Body symbol sprites for the kept atlas layers (Skin fill, ShrtLength/Color,
// Belt) per design decision D2, including the shirt shadow + reg buckle masks.
const BODY_SYMBOLS = [
  'DefineSprite_554_Body/1.svg',
  'DefineSprite_553_Shrt_Tee/1.svg',
  'DefineSprite_551_Shrt_Tee_Shadow/1.svg',
  'DefineSprite_446_Belt_Reg/1.svg',
  'DefineSprite_429_Belt_Reg_Buckle_Reg/1.svg',
].map((n) => `body-symbols/${n}`);

// Hair material sprites (base + pattern/streak overlays) used by the procedural
// hair material builder.
const HAIR_SYMBOLS = [
  'Hair.svg',
  'Hair_Gradient_1.svg',
  'Hair_Gradient_2.svg',
  'Hair_Spots_1.svg',
  'Hair_Spots_2.svg',
  'Hair_Streak_1.svg',
  'Hair_Streak_2.svg',
  'Hair_Streak_3.svg',
  'Hair_Streak_4.svg',
  'Hair_Streak_5.svg',
  'Hair_Stripe_Hor_1.svg',
  'Hair_Stripe_Hor_2.svg',
  'Hair_Stripe_Vert_1.svg',
  'Hair_Stripe_Vert_2.svg',
].map((f) => `hair-material/${f}`);

// The full animations JSON (27MB) is fetched in-memory and sliced down to the
// mapped mood/interaction anims (design D5) before being written, so the repo
// only carries `animations-subset.json` (~1.5MB).
const ANIMATIONS_SRC = 'animations.json';
const ANIMATIONS_DST = 'animations-subset.json';
// Mood map (moods.js): happy/sad/love/angry/excited/sleepy.
// Interaction map (interactions.js): poke/hug/highfive (gimmeFive+highTen)/
// kiss/dance (jamA+jamB). Plus the standBreathe idle.
const ANIM_SUBSET = [
  'mood_happy',
  'mood_sad',
  'mood_inLove',
  'mood_angry',
  'mood_giggle',
  'mood_sleeping',
  'poke1',
  'poke2',
  'hug1',
  'hug2',
  'gimmeFive1',
  'gimmeFive2',
  'highTen1',
  'highTen2',
  'kiss1',
  'kiss2',
  'jamA1',
  'jamA2',
  'jamB1',
  'jamB2',
  'standBreathe',
];

const MANIFESTS = [DATA, PALETTES, TEXTURES, PROPS, faceSymbols(), BODY_SYMBOLS, HAIR_SYMBOLS].flat();

async function fetchText(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GET ${url} -> ${res.status}`);
  return res.text();
}

async function main() {
  let ok = 0;
  const failures = [];
  for (const rel of MANIFESTS) {
    const dest = join(OUT, rel);
    await mkdir(dirname(dest), { recursive: true });
    try {
      const body = await fetchText(`${BASE}/${rel}`);
      await writeFile(dest, body);
      ok++;
      console.log(`ok   ${rel}`);
    } catch (err) {
      failures.push(rel);
      console.error(`FAIL ${rel}: ${err.message}`);
    }
  }

  // Slice the full animation set (in-memory) to the mapped subset.
  try {
    const full = JSON.parse(await fetchText(`${BASE}/${ANIMATIONS_SRC}`));
    const anims = full.anims.filter((a) => ANIM_SUBSET.includes(a.name));
    const missing = ANIM_SUBSET.filter((n) => !anims.some((a) => a.name === n));
    if (missing.length) throw new Error(`missing mapped anims: ${missing.join(', ')}`);
    const subset = { ...full, anims, animCount: anims.length };
    await writeFile(join(OUT, ANIMATIONS_DST), JSON.stringify(subset));
    ok++;
    console.log(`ok   ${ANIMATIONS_DST} (${anims.length} anims)`);
  } catch (err) {
    failures.push(`${ANIMATIONS_SRC} -> ${ANIMATIONS_DST}`);
    console.error(`FAIL ${ANIMATIONS_SRC}: ${err.message}`);
  }
  const listing = MANIFESTS
    .map((rel) => `- \`${rel}\``)
    .concat([`- \`${ANIMATIONS_DST}\``])
    .sort()
    .join('\n');
  const markdown = `# buddylabs assets

Vendored from the **MinePoke** fan reconstruction of Buddy Poke
(<https://minepoke.netlify.app>) by \`scripts/fetch-minepoke-assets.mjs\`.

- Source base: \`https://minepoke.netlify.app/assets/buddylabs/\`
- Provenance: published data from the reconstruction, **not** BinArt source binaries.
- Scope: the curated subset used by the ported \`buddylabs.js\` renderer —
  geometry/skin data, body+head material manifests, the curated face/body hair
  symbol sprites, palette swatches, static texture fallbacks, and the sliced
  animation subset.

Major directories mirror the site's own layout so the ported builders resolve the
same paths they do on the source site:

- \`geometry-preview.json\` — 58 meshes, 29-bone bind skeleton, skin weights.
- \`materials/body-material.json\` — 42-layer body-atlas manifest (kept: Skin fill,
  ShrtLength/Color, Belt per design D2).
- \`materials/head-material.json\` — 17-layer face-atlas manifest.
- \`animations-subset.json\` — \`animations.json\` sliced to the mapped mood/
  interaction anims (design D5): mood_happy/mood_sad/mood_inLove/mood_angry/
  mood_giggle/mood_sleeping, poke1-2, hug1-2, gimmeFive1-2, highTen1-2,
  kiss1-2, jamA1-2, jamB1-2, standBreathe.
- \`palettes/\` — \`skin.png\`, \`shrt-spectrum.png\`, \`eye.png\` swatch strips.
- \`textures/\` — \`Hair.jpg\`, \`Shadow.png\`, \`33.png\`, \`boy_body.png\`
  (mesh fallbacks) plus prop textures \`rose.jpg\`, \`mic.png\`, \`sword.png\`.
- \`face-symbols/\` — 7 curated eye families (6 frames each), the mouth sprite
  (33 frames), and the full face-extra catalogs (Brows/5OClock/Mustache/Beard/
  Glas/Spot/EyeShadow/Mask).
- \`body-symbols/\` — body crate, shirt (+ shadow), belt (+ buckle) sprites.
- \`hair-material/\` — hair base + pattern/streak overlay sprites.

## Vendored files

\`\`\`
${listing}
\`\`\`
`;
  await writeFile(join(OUT, 'README.md'), markdown);
  console.log(`\n${ok}/${MANIFESTS.length} downloaded -> ${OUT}`);
  if (failures.length) {
    console.error(`failures: ${failures.join(', ')}`);
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});