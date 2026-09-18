// Shared avatar data module — single source of truth for the authentic part
// vocabulary used by the builder, profile editor, and 3D renderer.
//
// A composition is a plain object in the canonical catalog-backed shape:
//   { hair, eyes, mouth, props, skirt,
//     clothing: { <body-material layer>: <symbol> },
//     face: { spot, eyeShadow, mask, brows, glasses, mustache, beard },
//     colors: { skin, eye, hair, shirt, pants, socks, shoes, belt, glove },
//     hairMaterial: { patternIndex, patternColor, streakIndex, streakColor } }
// `hair`/`props`/`skirt` hold authentic catalog item names, `eyes` an eye
// sprite family, `mouth` a mouth-frame name (see MOUTH_TO_FRAME), `clothing`
// holds body-material layer selections keyed by manifest layer name, and
// `face`/`colors`/`hairMaterial` the face-layer symbols and colors. The values
// are exactly the option strings listed in the exported catalogs.
//
// `normalizeComposition` resets any stored field that is not a known, valid
// value for its category — including the obsolete placeholder names `head`,
// `accessory`, `body`, `accent`, `bg`, and the synthetic `frame-N` face values
// — so every stored `avatarDef` keeps rendering. This module stays DOM-free so
// the server can import it too (the pure SVG string builders are the only
// non-data exports, and they never touch the DOM).

export function esc(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

// The `colors` swatches. `shirt` and `pants` reuse the authentic shrt/pant
// spectrum strips; the other categories get curated builder palettes (any hex
// tints the matching body-material lockColor family).
export const PALETTES = {
  skin: ["#ffcea5", "#f6b98b", "#e8a87c", "#d98f63", "#b06a42", "#8d5b3c"],
  eye: ["#1e2838", "#2d3a4a", "#3d4e64", "#5a6a80", "#7b8fa8", "#8a9bb5", "#a0b0c4", "#b8c4d4", "#cdd4e0", "#e2e8f0", "#1e2838", "#4a3728", "#5c4033", "#6b4423", "#8b5e3c", "#a07060", "#b89080", "#c8a090", "#d8b0a0", "#e8c0b0", "#f0d0c0", "#1a1a2e", "#16213e", "#0f3460", "#1b4332", "#2d6a4f", "#40916c", "#52b788", "#74c9ad", "#95d5b2"],
  hair: ["#2b1f18", "#3d2b1f", "#4a341f", "#5c4033", "#6b4423", "#7a5230", "#8b5e3c", "#a07060", "#b89080", "#c8a090", "#e8d0c0", "#ffd700", "#d4af37", "#b8860b", "#c0c0c0", "#808080"],
  shirt: ["#6d7bd8", "#4d5f7a", "#8b9dc3", "#a8b5d4", "#c4c9e0", "#5a6a80", "#7b8fa8", "#9ab0c8", "#b5c4da", "#d0d8ea", "#e8ecf2", "#f0f2f6", "#3d4e64", "#2d3a4a", "#1e2838", "#8a9bb5", "#a0b0c4", "#b8c4d4", "#cdd4e0", "#e2e8f0", "#f5f7fa", "#d9e2ec", "#bfcdd8", "#a6b5c4", "#8d9cab"],
  pants: ["#4d5f7a", "#2d3a4a", "#1e2838", "#5a6a80", "#7b8fa8", "#8a9bb5", "#a0b0c4", "#b8c4d4", "#cdd4e0", "#e2e8f0", "#3d4e64", "#6d7bd8", "#8b9dc3", "#a8b5d4", "#c4c9e0", "#d0d8ea", "#e8ecf2", "#f0f2f6", "#f5f7fa", "#d9e2ec", "#bfcdd8", "#a6b5c4", "#8d9cab", "#74859a"],
  socks: ["#ffffff", "#e2e8f0", "#c0c0c0", "#808080", "#4d5f7a", "#2d3a4a", "#1e2838", "#6d7bd8", "#8b9dc3", "#e8d0c0", "#f5d0c0", "#79a88e"],
  shoes: ["#2d3a4a", "#1e2838", "#3d4e64", "#5a6a80", "#7b8fa8", "#8a9bb5", "#a0b0c4", "#b8c4d4", "#cdd4e0", "#e2e8f0", "#6b4423", "#8b5e3c", "#4a3728", "#a07060", "#c8a090", "#ffffff", "#f5f7fa"],
  belt: ["#1e2838", "#2d3a4a", "#3d4e64", "#4d5f7a", "#5a6a80", "#5c4033", "#6b4423", "#8b5e3c", "#a07060", "#b89080", "#c8a090", "#ffffff", "#e2e8f0"],
  glove: ["#ffffff", "#e2e8f0", "#f0f2f6", "#c0c0c0", "#808080", "#4d5f7a", "#2d3a4a", "#1e2838", "#6b4423", "#8b5e3c", "#a07060", "#b89080"],
  hairMat: ["#f0d06a", "#ff8a4c", "#ff6b9d", "#7bc8f6", "#a78bfa", "#4ade80", "#f671b1", "#ffd166", "#747a7d", "#7ed6a5", "#8fd3ff", "#c9b8ff", "#ffffff", "#1e2838"],
};

// Builder color categories: which composition field each swatch group writes.
// `palette` is the PALETTES key with the swatches; `path` is the dotted
// composition path (pattern/streak colors live in `hairMaterial`, not `colors`).
export const COLOR_GROUPS = [
  { key: "skin", label: "Skin", palette: "skin", path: "colors.skin" },
  { key: "eye", label: "Eyes", palette: "eye", path: "colors.eye" },
  { key: "hair", label: "Hair", palette: "hair", path: "colors.hair" },
  { key: "shirt", label: "Shirt", palette: "shirt", path: "colors.shirt" },
  { key: "pants", label: "Pants", palette: "pants", path: "colors.pants" },
  { key: "socks", label: "Socks", palette: "socks", path: "colors.socks" },
  { key: "shoes", label: "Shoes", palette: "shoes", path: "colors.shoes" },
  { key: "belt", label: "Belt", palette: "belt", path: "colors.belt" },
  { key: "glove", label: "Gloves", palette: "glove", path: "colors.glove" },
  { key: "hairPattern", label: "Hair pattern color", palette: "hairMat", path: "hairMaterial.patternColor" },
  { key: "hairStreak", label: "Hair streak color", palette: "hairMat", path: "hairMaterial.streakColor" },
];

// ---- authentic part vocabulary (catalog names from geometry-preview.json) ----

// All hair mesh catalog item names from the buddylabs Hair catalog.
export const HAIR_OPTIONS = [
  "BCap", "BCap_Hair",
  "SCap", "SCap_Hair",
  "Hair_Simple_FlatTop", "Hair_Simple_LeftBob", "Hair_Simple_MidBob",
  "Hair_Simple_PartMid", "Hair_Simple_PartSide", "Hair_Simple_PartSideShort",
  "Hair_Simple_RiceBowl", "Hair_Simple_ScruffySide", "Hair_Simple_SlickBack",
  "Hair_Simple_Twiggy", "Hair_CrispBob_PartMid", "Hair_Reg_MainShort_PartMid",
  "Hair_Reg_MainShort_PartMidEars", "Hair_Reg_MainShort_PartRice",
  "Hair_Reg_MainShort_PartSide", "Hair_Reg_MainShort_PartSweepLeft",
  "Hair_Reg_MainMed_PartMid", "Hair_Reg_MainMed_PartMidEars",
  "Hair_Reg_MainMed_PartRice", "Hair_Reg_MainMed_PartSide",
  "Hair_Reg_MainMed_PartSweepLeft", "Hair_Tied_Pig", "Hair_Tied_PigMid",
  "Hair_Tied_PigRice", "Hair_Tied_Pony", "Hair_Tied_PonyMid",
  "Hair_Tied_PonyRice", "Hair_Shave", "Hair_Simple_EmoMop",
  "Hair_Simple_EmoMopEars", "Hair_Simple_EmoMopLong", "Hair_Simple_FauxHawk",
  "Hair_Simple_LayeredTips", "Hair_Simple_LayeredTipsLong",
  "Hair_Simple_Mohawk", "Hair_Simple_MohawkSpike",
  "Hair_Simple_PartMidOilyLong", "Hair_Simple_PartMidOilyLongEars",
  "Hair_Simple_PartSideOilyLong", "Hair_Simple_Porcupine",
  "Hair_Simple_Spike", "Hair_Simple_SpikeBack", "Hair_Simple_SpikeLong",
  "Hair_Simple_PartMidOilyPony"
];

// Eye sprite families (buddylabs EYE_SPRITES).
export const EYE_OPTIONS = [
  "Eyes_Fem", "Eyes_Male", "Eyes_Lake", "Eyes_Rio",
  "Eyes_Goth", "Eyes_Azn1", "Eyes_Azn2"
];

// Mouth-frame names (MOUTH_TO_FRAME maps each to a frame of the mouth sprite).
export const MOUTH_OPTIONS = ["neutral", "smile", "laugh", "frown", "tongue", "heart", "growl"];

// Props catalog items (10, all shipped).
export const PROPS_OPTIONS = ["Strat", "Rose", "Mic", "Sword", "Mallet", "Ball", "Vesp_Body", "Vesp_Tire_Main", "Vesp_Tire_Side", "Vesp_SideCar"];

// Skirt catalog items (geometry-preview.json Skrt catalog).
export const SKIRT_OPTIONS = ["SkrtNone", "Skrt", "SkrtLong"];

// Simple top-level categories (builders + `resolvePart`).
export const AVATAR_PARTS = {
  hair: { label: "Hair", options: HAIR_OPTIONS },
  eyes: { label: "Eyes", options: EYE_OPTIONS },
  mouth: { label: "Mouth", options: MOUTH_OPTIONS },
  props: { label: "Props", options: PROPS_OPTIONS },
  skirt: { label: "Skirt", options: SKIRT_OPTIONS },
};

// ---- clothing catalog (non-blank body-material layer textures) ----
//
// Copied from `body-material.json`: the user-selectable body layers grouped by
// the builder category they belong to. Shadow/color/skin layers are derived by
// the atlas compositor and are not exposed as options. Each entry lists every
// non-`Blank` texture symbol of its layer, keyed by the manifest layer name so
// a `clothing` selection maps straight to `textures[].index`.
export const CLOTHING_CATALOG = [
  { category: "socks", label: "Sock length", layer: "SockLength", symbols: ["Sock_Short", "Sock_Med", "Sock_Long"] },
  { category: "socks", label: "Sock pattern", layer: "SockPattern", symbols: ["Sock_Jester", "Sock_Stripe_1", "Sock_Stripe_2", "Sock_Stripe_3", "Sock_Sport_1", "Sock_Sport_2"] },
  { category: "pants", label: "Pant length", layer: "PantLength", symbols: ["Pant_Low_Panties", "Pant_Low_Shorts", "Pant_Low_Knickers", "Pant_Low_Long", "Pant_High_Panties", "Pant_High_Shorts", "Pant_High_Knickers", "Pant_High_Long"] },
  { category: "pants", label: "Pant pattern", layer: "PantPattern", symbols: ["Pant_Hero", "Pant_Sport_1", "Pant_Sport_2", "Pant_Stripe_1", "Pant_Stripe_2", "Pant_Jester", "Pant_Fade_1", "Pant_Fade_2", "Pant_Gradient_1", "Pant_Camouflage", "Pant_ChainMail", "Pant_ScaleMail", "Pant_Diamond"] },
  { category: "pants", label: "Pant trim", layer: "PantPattern2", symbols: ["Pant_Lace_1", "Pant_Buckle_1", "Pant_Buckle_2"] },
  { category: "shirt", label: "Shirt length", layer: "ShrtLength", symbols: ["Shrt_Tee", "Shrt_TeeCrop", "Shrt_TeeLong", "Shrt_Tank", "Shrt_TankCrop", "Shrt_Tube", "Shrt_TeeLongCrop", "Shrt_DrShoulderShort", "Shrt_DrShoulderLong"] },
  { category: "shirt", label: "Shirt pattern", layer: "ShrtLayer1", symbols: ["Shrt_Plaid", "Shrt_Sport_1", "Shrt_Sport_2", "Shrt_Sport_3", "Shrt_Sport_4", "Shrt_Sport_5", "Shrt_Sport_6", "Shrt_Sport_7", "Shrt_Sport_8", "Shrt_Stripe_1", "Shrt_Stripe_2", "Shrt_Stripe_3", "Shrt_Jester", "Shrt_Tie_1", "Shrt_Gradient_1", "Shrt_TankLayered", "Shrt_Vest", "Shrt_Camouflage", "Shrt_Argyle_1", "Shrt_Argyle_2", "Shrt_ChainMail_1", "Shrt_ChainMail_2", "Shrt_ScaleMail_1", "Shrt_ScaleMail_2", "Shrt_Diamond_1", "Shrt_Diamond_2"] },
  { category: "shirt", label: "Shirt logo", layer: "ShrtLayer2", symbols: ["Shrt_Logo_Anarchy", "Shrt_Logo_Cancel", "Shrt_Logo_Flower_1", "Shrt_Logo_Flower_2", "Shrt_Logo_Heart", "Shrt_Logo_Nuclear", "Shrt_Logo_Peace", "Shrt_Logo_Question", "Shrt_Logo_Happy", "Shrt_Logo_Sad", "Shrt_Logo_Skull", "Shrt_V", "Shrt_SportsCoat", "Shrt_CoatOpen", "Shrt_CardiganTight", "Shrt_Logo_Alien", "Shrt_Logo_FleurDeLis", "Shrt_Logo_Nuclear2", "Shrt_Logo_Skeleton", "Shrt_Logo_Butterfly", "Shrt_Logo_Star", "Shrt_Lace_1", "Shrt_Buckle_1", "Shrt_Buckle_2", "Shrt_Logo_SaoPaulo", "Shrt_Logo_Flamengo", "Shrt_Logo_Timão", "Shrt_Logo_Verdão", "Shrt_Logo_Nike", "Shrt_Logo_Jordan", "Shrt_Logo_Roblox", "Shrt_Logo_Vasco", "Shrt_Logo_Steam", "Shrt_Logo_Twitter", "Shrt_Logo_GPT", "Shrt_Logo_Counter-Strike", "Shrt_Logo_LOL", "Shrt_Logo_Barcelona", "Shrt_Logo_Batman", "Shrt_Logo_Nasa", "Shrt_Logo_Supercell", "Shrt_Logo_Barbie", "Shrt_Logo_BTS", "Shrt_Logo_supreme", "Shrt_Logo_TheNorthFace", "Shrt_Logo_RollingStone", "Shrt_Logo_VOGUE", "Shrt_Logo_DIESEL", "Shrt_Logo_CALVIN", "Shrt_Logo_OBEY", "Shrt_Logo_GAP", "Shrt_Logo_NewYork", "Shrt_Logo_Brasail", "Shrt_Logo_CANADA", "Shrt_Logo_France", "Shrt_Logo_China", "Shrt_Logo_USA", "Shrt_Logo_Playboy", "Shrt_Logo_ViVi", "Shrt_Logo_MG", "Shrt_Logo_Friends"] },
  { category: "shoes", label: "Shoe", layer: "Shoe", symbols: ["Shoe_FlipFlop", "Shoe_Sling_1", "Shoe_Sling_2", "Shoe_Reg", "Shoe_Boot"] },
  { category: "shoes", label: "Shoe design", layer: "ShoeSlingDesign", symbols: ["Shoe_Reg_Sport_1", "Shoe_Reg_Sport_2", "Shoe_Reg_Sport_5", "Shoe_Reg_Jester_1", "Shoe_Reg_Jester_2"] },
  { category: "shoes", label: "Shoe design", layer: "ShoeRegDesign", symbols: ["Shoe_Reg_Sport_1", "Shoe_Reg_Sport_2", "Shoe_Reg_Sport_3", "Shoe_Reg_Sport_4", "Shoe_Reg_Sport_5", "Shoe_Reg_Jester_1", "Shoe_Reg_Jester_2"] },
  { category: "shoes", label: "Shoe design", layer: "ShoeBootDesign", symbols: ["Shoe_Reg_Sport_1", "Shoe_Reg_Sport_2", "Shoe_Reg_Sport_4", "Shoe_Reg_Sport_5", "Shoe_Boot_Sport_1", "Shoe_Boot_Sport_2", "Shoe_Reg_Jester_1", "Shoe_Reg_Jester_2", "Shoe_Boot_Flop"] },
  { category: "shoes", label: "Laces", layer: "ShoeRegLaces", symbols: ["Shoe_Reg_Laces_Thin", "Shoe_Reg_Laces_Thick", "Shoe_Reg_Laces_Velcro"] },
  { category: "shoes", label: "Laces", layer: "ShoeBootLaces", symbols: ["Shoe_Reg_Laces_Thin", "Shoe_Reg_Laces_Thick", "Shoe_Boot_Laces_Side", "Shoe_Reg_Laces_Velcro", "Shoe_Boot_Buckle_1", "Shoe_Boot_Buckle_2"] },
  { category: "shoes", label: "Shoe sole", layer: "ShoeSole", symbols: ["Shoe_Sole"] },
  { category: "gloves", label: "Gloves", layer: "Glve", symbols: ["Glve_Short", "Glve_Med", "Glve_Long", "Glve_Fngr", "Glve_Lace"] },
  { category: "belt", label: "Belt", layer: "Belt", symbols: ["Belt_Reg", "Belt_Para", "Belt_X", "Belt_Low", "Belt_Low_Para", "Belt_Low_X"] },
  { category: "belt", label: "Belt fastener", layer: "BeltRegPattern", symbols: ["Belt_Reg_Buckle_Military", "Belt_Reg_Buckle_Oval", "Belt_Reg_Buckle_Reg", "Belt_Reg_Buckle_Stud_1", "Belt_Reg_Buckle_Stud_2"] },
  { category: "belt", label: "Belt fastener", layer: "BeltLowPattern", symbols: ["Belt_Low_Buckle_Military", "Belt_Low_Buckle_Oval", "Belt_Low_Buckle_Reg", "Belt_Low_Buckle_Stud_1", "Belt_Low_Buckle_Stud_2"] },
];

// Lookups over CLOTHING_CATALOG.
export const CLOTHING_LAYERS = new Map(CLOTHING_CATALOG.map((entry) => [entry.layer, entry]));

// body-material lockColor family -> canonical `colors` key (design D3).
export function clothingColorKey(name) {
  if (name === "Skin" || name === "SkinColor") return "skin";
  if (name.startsWith("Sock")) return "socks";
  if (name.startsWith("Pant")) return "pants";
  if (name.startsWith("Shrt")) return "shirt";
  if (name.startsWith("Shoe")) return "shoes";
  if (name.startsWith("Glve")) return "glove";
  if (name.startsWith("Belt")) return "belt";
  return null;
}

// ---- face catalog (real shipped face-atlas symbols) ----
//
// Sprite directories match the vendored `face-symbols/` set. Values stored in
// `face` are the bare symbol names (or "none"); `faceSymbolPath` resolves a
// symbol to its `<sprite>` directory for the atlas compositor.
export const FACE_CATALOG = {
  brows: {
    label: "Brows",
    options: [
      { symbol: "Brows_Thin", sprite: "DefineSprite_107_Brows_Thin" },
      { symbol: "Brows_Thick", sprite: "DefineSprite_98_Brows_Thick" },
    ],
  },
  glasses: {
    label: "Glasses",
    options: [
      { symbol: "Glas_1", sprite: "DefineSprite_992_Glas_1" },
      { symbol: "Glas_2", sprite: "DefineSprite_698_Glas_2" },
      { symbol: "Glas_3", sprite: "DefineSprite_695_Glas_3" },
      { symbol: "Glas_4", sprite: "DefineSprite_692_Glas_4" },
      { symbol: "Glas_5", sprite: "DefineSprite_689_Glas_5" },
      { symbol: "Glas_6", sprite: "DefineSprite_686_Glas_6" },
      { symbol: "Glas_7", sprite: "DefineSprite_989_Glas_7" },
    ],
  },
  mustache: {
    label: "Mustache",
    options: [
      { symbol: "Must_Thin", sprite: "DefineSprite_649_Must_Thin" },
      { symbol: "Must_Thick", sprite: "DefineSprite_654_Must_Thick" },
    ],
  },
  beard: {
    label: "Beard",
    options: [
      { symbol: "Berd_Chops", sprite: "DefineSprite_641_Berd_Chops" },
      { symbol: "Berd_ChinPatch", sprite: "DefineSprite_646_Berd_ChinPatch" },
      { symbol: "Berd_Goat", sprite: "DefineSprite_676_Berd_Goat" },
      { symbol: "Berd_Full", sprite: "DefineSprite_683_Berd_Full" },
      { symbol: "Berd_5OClock", sprite: "DefineSprite_1012_Berd_5OClock" },
    ],
  },
  spot: {
    label: "Spot",
    options: [
      { symbol: "Spot_Beauty_1", sprite: "DefineSprite_102_Spot_Beauty_1" },
      { symbol: "Spot_Beauty_2", sprite: "DefineSprite_100_Spot_Beauty_2" },
      { symbol: "Spot_Freckles_1", sprite: "DefineSprite_104_Spot_Freckles_1" },
    ],
  },
  eyeShadow: {
    label: "Eye shadow",
    options: [
      { symbol: "EyeShadow_1", sprite: "DefineSprite_30_EyeShadow_1" },
      { symbol: "EyeShadow_2", sprite: "DefineSprite_28_EyeShadow_2" },
      { symbol: "EyeShadow_3", sprite: "DefineSprite_26_EyeShadow_3" },
    ],
  },
  mask: {
    label: "Mask",
    options: [
      { symbol: "Mask_1", sprite: "DefineSprite_1008_Mask_1" },
      { symbol: "Mask_2", sprite: "DefineSprite_1005_Mask_2" },
      { symbol: "Mask_3", sprite: "DefineSprite_1002_Mask_3" },
      { symbol: "Mask_4", sprite: "DefineSprite_999_Mask_4" },
      { symbol: "Mask_5", sprite: "DefineSprite_995_Mask_5" },
    ],
  },
};

// Face layer keys, in the order the pickers show them.
export const FACE_LAYER_KEYS = Object.keys(FACE_CATALOG);

// Flat symbol -> sprite directory map used by `faceSymbolPath`.
export const FACE_SYMBOLS = Object.values(FACE_CATALOG).reduce((map, layer) => {
  for (const { symbol, sprite } of layer.options) map[symbol] = sprite;
  return map;
}, {});

// Resolve a face-layer value to its sprite directory: "none" / missing -> null
// (layer off); a full `DefineSprite_...` dir passes through; a bare symbol name
// looks up FACE_SYMBOLS. Returns null when the symbol is not shipped.
export function faceSymbolPath(value) {
  if (!value || value === "none") return null;
  if (value.startsWith("DefineSprite_")) return value;
  return FACE_SYMBOLS[value] ?? null;
}

// Friendly display names for the pickers (the stored value stays the catalog id).
const PART_LABELS = {
  "Hair_Reg_MainShort_PartMid": "Classic",
  "Hair_Simple_LeftBob": "Left Bob",
  "Hair_Simple_RiceBowl": "Bowl",
  "Hair_Tied_Pig": "Pigtails",
  "Hair_Simple_Twiggy": "Twiggy",
  "Hair_Simple_FauxHawk": "Fauxhawk",
  "Hair_Shave": "Shaved",
  "Hair_Simple_FlatTop": "Flat Top",
  "Hair_Simple_MidBob": "Mid Bob",
  "Hair_Simple_PartMid": "Part Mid",
  "Hair_Simple_PartSide": "Part Side",
  "Hair_Simple_PartSideShort": "Part Side Short",
  "Hair_Simple_ScruffySide": "Scruffy Side",
  "Hair_Simple_SlickBack": "Slick Back",
  "Hair_CrispBob_PartMid": "Crisp Bob",
  "Hair_Reg_MainShort_PartMidEars": "Short Part Ears",
  "Hair_Reg_MainShort_PartRice": "Short Part Rice",
  "Hair_Reg_MainShort_PartSide": "Short Part Side",
  "Hair_Reg_MainShort_PartSweepLeft": "Short Sweep Left",
  "Hair_Reg_MainMed_PartMid": "Med Part Mid",
  "Hair_Reg_MainMed_PartMidEars": "Med Part Ears",
  "Hair_Reg_MainMed_PartRice": "Med Part Rice",
  "Hair_Reg_MainMed_PartSide": "Med Part Side",
  "Hair_Reg_MainMed_PartSweepLeft": "Med Sweep Left",
  "Hair_Tied_PigMid": "Tied Pig Mid",
  "Hair_Tied_PigRice": "Tied Pig Rice",
  "Hair_Tied_Pony": "Tied Pony",
  "Hair_Tied_PonyMid": "Tied Pony Mid",
  "Hair_Tied_PonyRice": "Tied Pony Rice",
  "Hair_Simple_EmoMop": "Emo Mop",
  "Hair_Simple_EmoMopEars": "Emo Mop Ears",
  "Hair_Simple_EmoMopLong": "Emo Mop Long",
  "Hair_Simple_LayeredTips": "Layered Tips",
  "Hair_Simple_LayeredTipsLong": "Layered Tips Long",
  "Hair_Simple_Mohawk": "Mohawk",
  "Hair_Simple_MohawkSpike": "Mohawk Spike",
  "Hair_Simple_PartMidOilyLong": "Part Mid Oily Long",
  "Hair_Simple_PartMidOilyLongEars": "Part Mid Oily Long Ears",
  "Hair_Simple_PartSideOilyLong": "Part Side Oily Long",
  "Hair_Simple_Porcupine": "Porcupine",
  "Hair_Simple_Spike": "Spike",
  "Hair_Simple_SpikeBack": "Spike Back",
  "Hair_Simple_SpikeLong": "Spike Long",
  "Hair_Simple_PartMidOilyPony": "Part Mid Oily Pony",
  "Eyes_Fem": "Fem", "Eyes_Male": "Male", "Eyes_Lake": "Lake",
  "Eyes_Rio": "Rio", "Eyes_Goth": "Goth", "Eyes_Azn1": "Azn 1", "Eyes_Azn2": "Azn 2",
  neutral: "Neutral", smile: "Smile", laugh: "Laugh", frown: "Frown",
  tongue: "Tongue", heart: "Heart", growl: "Growl",
  none: "None", SkrtNone: "None", Skrt: "Skirt", SkrtLong: "Long Skirt",
  Strat: "Strat", Rose: "Rose", Mic: "Mic", Sword: "Sword",
  Mallet: "Mallet", Ball: "Ball",
  Vesp_Body: "Vesp Body", Vesp_Tire_Main: "Vesp Tire", Vesp_Tire_Side: "Vesp Tire Side", Vesp_SideCar: "Vesp Sidecar",
};

export function partLabel(category, value) {
  return PART_LABELS[value] || String(value);
}

// Mouth frame name -> frame number of DefineSprite_44_Mouth (1..33). The first
// five are the current vocabulary; `open` is kept so legacy stored avatars
// render their old smiling-open mouth instead of resetting.
export const MOUTH_TO_FRAME = {
  neutral: 1, smile: 7, open: 9, laugh: 33, frown: 12, tongue: 30, heart: 31, growl: 29
};
export const DEFAULT_MOUTH_FRAME = 1;

const DEFAULT_PARTS = {
  hair: HAIR_OPTIONS[0],
  eyes: "Eyes_Male",
  mouth: "smile",
  props: "none",
  skirt: "SkrtNone",
};

// Hair material overlay catalogs (indices match the buddylabs HAIR_PATTERNS /
// HAIR_STREAKS arrays; 0 disables the overlay). Exposed so the builder and the
// guard test share the canonical range.
export const HAIR_PATTERN_OPTIONS = ["None", "Gradient 1", "Gradient 2", "Stripe Horizontal 1", "Stripe Horizontal 2", "Stripe Vertical 1", "Stripe Vertical 2", "Spots 1", "Spots 2"];
export const HAIR_STREAK_OPTIONS = ["None", "Streak 1", "Streak 2", "Streak 3", "Streak 4", "Streak 5"];
export const DEFAULT_HAIR_MATERIAL = { patternIndex: 0, patternColor: "#747a7d", streakIndex: 0, streakColor: "#f0d06a" };

// The canonical, catalog-backed default composition. `clothing` starts empty so
// the atlas compositor falls back to each body-material layer's manifest
// default selection; every face layer is off except the always-on eyes/mouth.
export function defaultComposition() {
  return {
    hair: DEFAULT_PARTS.hair,
    eyes: DEFAULT_PARTS.eyes,
    mouth: DEFAULT_PARTS.mouth,
    props: DEFAULT_PARTS.props,
    skirt: DEFAULT_PARTS.skirt,
    clothing: {},
    face: {
      spot: "none",
      eyeShadow: "none",
      mask: "none",
      brows: "none",
      glasses: "none",
      mustache: "none",
      beard: "none",
    },
    colors: {
      skin: PALETTES.skin[0],
      eye: PALETTES.eye[0],
      hair: PALETTES.hair[0],
      shirt: PALETTES.shirt[0],
      pants: PALETTES.pants[0],
      socks: PALETTES.socks[0],
      shoes: PALETTES.shoes[0],
      belt: PALETTES.belt[0],
      glove: PALETTES.glove[0],
    },
    hairMaterial: { ...DEFAULT_HAIR_MATERIAL },
  };
}

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

// Validate a value against a simple category's option list (hair/eyes/mouth/
// props/skirt). Unknown values (legacy hand-drawn values, typos) reset to the
// category default.
export function resolvePart(category, value) {
  const options = AVATAR_PARTS[category]?.options ?? [];
  return options.includes(value) ? value : DEFAULT_PARTS[category];
}

// Validate a props value against the Props catalog; anything invalid (including
// "none") resolves to "none".
export function resolveProps(value) {
  return PROPS_OPTIONS.includes(value) ? value : "none";
}

// Normalize any stored `avatarDef` to the canonical shape (design D1). Starts
// from `defaultComposition()` and copies a field only when it is a known, valid
// value for its category; obsolete names (`head`, `accessory`, `body`, `accent`,
// `bg`, synthetic `frame-N` face values) are dropped so the default applies.
// DOM-free and synchronous so the server can share it.
export function normalizeComposition(raw) {
  const base = defaultComposition();
  if (!isPlainObject(raw)) return base;

  const out = {
    ...base,
    colors: { ...base.colors },
    hairMaterial: { ...base.hairMaterial },
  };

  for (const key of Object.keys(AVATAR_PARTS)) {
    if (AVATAR_PARTS[key].options.includes(raw[key])) out[key] = raw[key];
  }
  if (raw.props === "none") out.props = "none";

  if (isPlainObject(raw.clothing)) {
    for (const [layer, symbol] of Object.entries(raw.clothing)) {
      const entry = CLOTHING_LAYERS.get(layer);
      if (entry && entry.symbols.includes(symbol)) out.clothing[layer] = symbol;
    }
  }

  if (isPlainObject(raw.face)) {
    for (const layer of FACE_LAYER_KEYS) {
      const value = raw.face[layer];
      if (value === "none") out.face[layer] = "none";
      else if (FACE_SYMBOLS[value]) out.face[layer] = value;
    }
  }

  if (isPlainObject(raw.colors)) {
    for (const key of Object.keys(base.colors)) {
      if (typeof raw.colors[key] === "string" && HEX_RE.test(raw.colors[key])) {
        out.colors[key] = raw.colors[key];
      }
    }
  }

  if (isPlainObject(raw.hairMaterial)) {
    const hm = raw.hairMaterial;
    if (typeof hm.patternIndex === "number" && Number.isFinite(hm.patternIndex)) {
      out.hairMaterial.patternIndex = Math.max(0, Math.round(hm.patternIndex));
    }
    if (typeof hm.streakIndex === "number" && Number.isFinite(hm.streakIndex)) {
      out.hairMaterial.streakIndex = Math.max(0, Math.round(hm.streakIndex));
    }
    if (typeof hm.patternColor === "string" && HEX_RE.test(hm.patternColor)) {
      out.hairMaterial.patternColor = hm.patternColor;
    }
    if (typeof hm.streakColor === "string" && HEX_RE.test(hm.streakColor)) {
      out.hairMaterial.streakColor = hm.streakColor;
    }
  }

  return out;
}

// Fallback picker snippet used while the real-asset thumbnail renderer is
// loading (or when WebGL is unavailable). Replaced by `renderPartThumb` in
// `buddy-thumbs.js` wherever the pickers run.
export function renderPartSnippet(category, name) {
  const colors = defaultComposition().colors;
  const label = partLabel(category, name);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 220" role="img" aria-label="${esc(label)}">
    <rect width="200" height="220" rx="20" fill="#f0eaff"/>
    <circle cx="100" cy="88" r="36" fill="${esc(colors.skin)}"/>
    <path d="M78,64 Q86,74 76,86 Q90,82 100,72 Q110,82 124,86 Q114,74 122,64 Q110,70 100,60 Q90,70 78,64 Z" fill="${esc(colors.hair)}"/>
    <circle cx="86" cy="104" r="3.6" fill="${esc(colors.eye)}"/>
    <circle cx="114" cy="104" r="3.6" fill="${esc(colors.eye)}"/>
    <text x="100" y="158" text-anchor="middle" font-size="21" font-weight="700" fill="${esc(colors.hair)}">${esc(label)}</text>
  </svg>`;
}