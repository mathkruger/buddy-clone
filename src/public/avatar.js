// Shared avatar data module — single source of truth for the authentic part
// vocabulary used by the builder, profile editor, and 3D renderer.
//
// A composition is a plain object:
//   { head, eyes, mouth, accessory, colors: { skin, shirt, bg, accent } }
// `head` holds the authentic hair-mesh catalog name, `eyes` an eye sprite
// family, `mouth` a mouth-frame name (see MOUTH_TO_FRAME), and `accessory` an
// authentic extra (cap / facial hair / prop / glasses). The values are exactly
// the option strings listed in `AVATAR_PARTS`.
//
// Values from the old hand-drawn vocabulary (or any value outside the current
// set) reset to that category's default part via `resolvePart`, so every stored
// `avatarDef` keeps rendering. This module stays DOM-free apart from the pure
// SVG string builders used by the pickers' fallback snippet.

export function esc(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export const PALETTES = {
  skin: ["#ffcea5", "#f6b98b", "#e8a87c", "#d98f63", "#b06a42", "#8d5b3c"],
  shirt: ["#ff8fb1", "#8fd3ff", "#ffd166", "#b8f2e2", "#c9b8ff", "#ff9f6e", "#7ed6a5", "#ff7b7b"],
  bg: ["#ffe9f3", "#eaf7ff", "#fff6d9", "#e4fbf4", "#f0e9ff", "#ffefe0", "#e8fdff", "#fff0f0"],
  accent: ["#ffb3c6", "#ff6b9d", "#ff8a4c", "#ffd166", "#7bc8f6", "#a78bfa", "#4ade80", "#f671b1"]
};

// ---- authentic part vocabulary (catalog names from geometry-preview.json) ----

// Hair mesh catalog item names (curated subset; the caps are accessory values).
const HAIR_OPTIONS = [
  "Hair_Reg_MainShort_PartMid",
  "Hair_Simple_LeftBob",
  "Hair_Simple_RiceBowl",
  "Hair_Tied_Pig",
  "Hair_Simple_Twiggy",
  "Hair_Simple_FauxHawk",
  "Hair_Shave"
];

// Eye sprite families (buddylabs EYE_SPRITES).
const EYE_OPTIONS = [
  "Eyes_Fem",
  "Eyes_Male",
  "Eyes_Lake",
  "Eyes_Rio",
  "Eyes_Goth",
  "Eyes_Azn1",
  "Eyes_Azn2"
];

// Mouth-frame names (MOUTH_TO_FRAME maps each to a frame of the mouth sprite).
const MOUTH_OPTIONS = ["neutral", "smile", "laugh", "frown", "tongue", "heart", "growl"];

// Authentic extras: two caps (hair-mesh items), glasses + facial hair (face
// atlas layers), and three props (Props catalog items).
const ACCESSORY_OPTIONS = ["none", "glasses", "BCap_Hair", "SCap_Hair", "mustache", "beard", "Rose", "Mic", "Sword"];

export const AVATAR_PARTS = {
  head: { label: "Hair style", options: HAIR_OPTIONS },
  eyes: { label: "Eyes", options: EYE_OPTIONS },
  mouth: { label: "Mouth", options: MOUTH_OPTIONS },
  accessory: { label: "Accessory", options: ACCESSORY_OPTIONS }
};

// Friendly display names for the pickers (the stored value stays the catalog id).
const PART_LABELS = {
  "Hair_Reg_MainShort_PartMid": "Classic",
  "Hair_Simple_LeftBob": "Left Bob",
  "Hair_Simple_RiceBowl": "Bowl",
  "Hair_Tied_Pig": "Pigtails",
  "Hair_Simple_Twiggy": "Twiggy",
  "Hair_Simple_FauxHawk": "Fauxhawk",
  "Hair_Shave": "Shaved",
  "Eyes_Fem": "Fem",
  "Eyes_Male": "Male",
  "Eyes_Lake": "Lake",
  "Eyes_Rio": "Rio",
  "Eyes_Goth": "Goth",
  "Eyes_Azn1": "Azn 1",
  "Eyes_Azn2": "Azn 2",
  neutral: "Neutral",
  smile: "Smile",
  laugh: "Laugh",
  frown: "Frown",
  tongue: "Tongue",
  heart: "Heart",
  growl: "Growl",
  none: "None",
  glasses: "Glasses",
  "BCap_Hair": "Cap A",
  "SCap_Hair": "Cap B",
  mustache: "Mustache",
  beard: "Beard",
  Rose: "Rose",
  Mic: "Mic",
  Sword: "Sword"
};

export function partLabel(category, value) {
  return PART_LABELS[value] || String(value);
}

// Mouth frame name -> frame number of DefineSprite_44_Mouth (1..33). The first
// five are the current vocabulary; `open` is kept so legacy stored avatars
// render their old smiling-open mouth instead of resetting.
export const MOUTH_TO_FRAME = {
  neutral: 1,
  smile: 7,
  open: 9,
  laugh: 33,
  frown: 12,
  tongue: 30,
  heart: 31,
  growl: 29
};
export const DEFAULT_MOUTH_FRAME = 1;

const DEFAULT_PARTS = {
  head: HAIR_OPTIONS[0],
  eyes: "Eyes_Male",
  mouth: "smile",
  accessory: "none"
};

// Category defaults plus the same first palette swatch each, matching the
// original defaultComposition shape.
export function defaultComposition() {
  return {
    head: DEFAULT_PARTS.head,
    eyes: DEFAULT_PARTS.eyes,
    mouth: DEFAULT_PARTS.mouth,
    accessory: DEFAULT_PARTS.accessory,
    colors: {
      skin: PALETTES.skin[0],
      shirt: PALETTES.shirt[0],
      bg: PALETTES.bg[0],
      accent: PALETTES.accent[0]
    }
  };
}

// Resolve a category value to a valid authentic part: values outside the
// current set (legacy hand-drawn values, typos) reset to the category default.
export function resolvePart(category, value) {
  const options = AVATAR_PARTS[category]?.options ?? [];
  return options.includes(value) ? value : DEFAULT_PARTS[category];
}

// Fallback picker snippet used while the real-asset thumbnail renderer is
// loading (or when WebGL is unavailable). Replaced by `renderPartThumb` in
// `buddy-thumbs.js` wherever the pickers run.
export function renderPartSnippet(category, name) {
  const colors = defaultComposition().colors;
  const label = partLabel(category, name);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 220" role="img" aria-label="${esc(label)}">
    <rect width="200" height="220" rx="20" fill="${esc(colors.bg)}"/>
    <circle cx="100" cy="88" r="36" fill="${esc(colors.skin)}"/>
    <path d="M78,64 Q86,74 76,86 Q90,82 100,72 Q110,82 124,86 Q114,74 122,64 Q110,70 100,60 Q90,70 78,64 Z" fill="${esc(colors.accent)}"/>
    <circle cx="86" cy="104" r="3.6" fill="${esc(colors.accent)}"/>
    <circle cx="114" cy="104" r="3.6" fill="${esc(colors.accent)}"/>
    <text x="100" y="158" text-anchor="middle" font-size="21" font-weight="700" fill="${esc(colors.accent)}">${esc(label)}</text>
  </svg>`;
}