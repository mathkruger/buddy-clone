// Shared avatar renderer — single source of truth for avatar artwork.
//
// A composition is a plain object:
//   { head, eyes, mouth, accessory, colors: { skin, shirt, bg, accent } }
// `renderAvatar(composition, mood)` returns a deterministic inline SVG string
// so the same (composition, mood) always renders byte-identical somewhere
// (builder preview, profile page, embed widget). No randomness, no network.
//
// Works as an ES module in the browser (`<script type="module">`) and in Node,
// so the server can validate avatar definitions and moods reusing the same set.

import { MOODS, DEFAULT_MOOD } from "./moods.js";

const INK = "#4a3145";

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

export const AVATAR_PARTS = {
  head: { label: "Head shape", options: ["round", "squircle", "square", "heart", "star", "cat", "egg"] },
  eyes: { label: "Eyes", options: ["dot", "round", "happy", "wink", "star", "heart", "sleepy"] },
  mouth: { label: "Mouth", options: ["smile", "open", "frown", "neutral", "tongue", "heart", "growl"] },
  accessory: { label: "Accessory", options: ["none", "crown", "bow", "glasses", "beanie", "flower", "headphones", "halo"] }
};

export function defaultComposition() {
  return {
    head: "round",
    eyes: "dot",
    mouth: "smile",
    accessory: "none",
    colors: {
      skin: PALETTES.skin[0],
      shirt: PALETTES.shirt[0],
      bg: PALETTES.bg[0],
      accent: PALETTES.accent[0]
    }
  };
}

// --- body ---

function body(c) {
  return `
    <g id="body">
      <path d="M58,220 L58,170 Q58,154 76,152 L124,152 Q142,154 142,170 L142,220 Z" fill="${esc(c.shirt)}" stroke="none"/>
      <path d="M84,152 L96,176 L108,152" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" opacity="0.35"/>
    </g>`;
}

function blush(c) {
  return `
    <g id="blush" opacity="0.6">
      <ellipse cx="68" cy="108" rx="8" ry="4.5" fill="${esc(c.accent)}"/>
      <ellipse cx="132" cy="108" rx="8" ry="4.5" fill="${esc(c.accent)}"/>
    </g>`;
}

// --- head shapes ---

const HEAD_SHAPES = {
  round(c) {
    return `<circle cx="100" cy="98" r="52" fill="${esc(c.skin)}"/>`;
  },
  squircle(c) {
    return `<rect x="47" y="45" width="106" height="106" rx="36" fill="${esc(c.skin)}"/>`;
  },
  square(c) {
    return `<rect x="45" y="43" width="110" height="110" rx="14" fill="${esc(c.skin)}"/>`;
  },
  heart(c) {
    return `<path d="M100,50 C88,26 52,30 45,60 C38,92 70,106 100,144 C130,106 162,92 155,60 C148,30 112,26 100,50 Z" fill="${esc(c.skin)}"/>`;
  },
  star(c) {
    // Five-point star centered at (100,104), outer R=60, inner r=28.
    const pts = [
      [100, 44], [77.4, 87.5], [81.5, 46.9], [108.7, 77.4], [148.5, 68.7],
      [100, 132], [148.5, 139.3], [108.7, 130.6], [81.5, 161.1], [77.4, 120.5]
    ].map(([x, y]) => `${x},${y}`).join(" ");
    return `<polygon points="${pts}" fill="${esc(c.skin)}"/>`;
  },
  cat(c) {
    return `
      <path d="M50,64 L36,20 L82,40 Z" fill="${esc(c.accent)}"/>
      <path d="M150,64 L164,20 L126,40 Z" fill="${esc(c.accent)}"/>
      <circle cx="100" cy="100" r="52" fill="${esc(c.skin)}"/>
      <ellipse cx="62" cy="120" rx="4" ry="4" fill="${esc(c.accent)}"/>
      <ellipse cx="138" cy="120" rx="4" ry="4" fill="${esc(c.accent)}"/>`;
  },
  egg(c) {
    return `<ellipse cx="102" cy="102" rx="46" ry="60" fill="${esc(c.skin)}"/>`;
  }
};

// --- eyes ---

const EYE_STYLES = {
  dot() {
    return `
      <circle cx="82" cy="95" r="6" fill="${INK}"/>
      <circle cx="118" cy="95" r="6" fill="${INK}"/>`;
  },
  round() {
    return `
      <circle cx="82" cy="95" r="9" fill="${INK}"/>
      <circle cx="118" cy="95" r="9" fill="${INK}"/>
      <circle cx="85" cy="92" r="3" fill="#fff"/>
      <circle cx="121" cy="92" r="3" fill="#fff"/>`;
  },
  happy() {
    return `
      <path d="M74,96 Q82,86 90,96 M110,96 Q118,86 126,96" fill="none" stroke="${INK}" stroke-width="4.5" stroke-linecap="round"/>`;
  },
  wink() {
    return `
      <path d="M74,95 Q82,87 90,95" fill="none" stroke="${INK}" stroke-width="4.5" stroke-linecap="round"/>
      <circle cx="118" cy="95" r="6.5" fill="${INK}"/>`;
  },
  star() {
    const s = (x, y, r) => `<path d="M${x},${y - r} L${x + r * 0.5},${y} L${x},${y + r} L${x - r * 0.5},${y} Z" fill="${INK}"/>`;
    return `${s(82, 95, 7)}${s(118, 95, 7)}`;
  },
  heart() {
    const h = (x) => `<path d="M${x},90 C${x - 3},87.5 ${x - 5},89 ${x - 5},91.8 C${x - 5},94.8 ${x - 2},96.8 ${x},98.5 C${x + 2},96.8 ${x + 5},94.8 ${x + 5},91.8 C${x + 5},89 ${x + 3},87.5 ${x},90 Z" fill="${INK}"/>`;
    return `${h(82)}${h(118)}`;
  },
  sleepy() {
    return `
      <path d="M75,96 L89,96 M111,96 L125,96" stroke="${INK}" stroke-width="4.5" stroke-linecap="round"/>`;
  },
  sad() {
    return `
      <path d="M74,91 Q81,87 88,91 M112,95 Q119,91 126,95" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>
      <ellipse cx="82" cy="100" rx="6" ry="3" fill="${INK}" opacity="0.85"/>
      <ellipse cx="118" cy="104" rx="6" ry="3" fill="${INK}" opacity="0.85"/>`;
  },
  angry() {
    return `
      <path d="M70,88 L90,95 M130,88 L110,95" stroke="${INK}" stroke-width="4.5" stroke-linecap="round"/>
      <circle cx="80" cy="96" r="5" fill="${INK}"/>
      <circle cx="120" cy="96" r="5" fill="${INK}"/>`;
  },
  love() {
    const h = (x) => `<path d="M${x},92 C${x - 4},88.5 ${x - 7},90.5 ${x - 7},93.8 C${x - 7},97.4 ${x - 2.6},100 ${x},101.6 C${x + 2.6},100 ${x + 7},97.4 ${x + 7},93.8 C${x + 7},90.5 ${x + 4},88.5 ${x},92 Z" fill="${INK}"/>`;
    return `<path d="M82,99 C79,97 77,98 77,101 C77,104 80,106 82,107 C84,106 87,104 87,101 C87,98 85,97 82,99 Z" fill="${INK}"/>${h(82)}${h(118)}`;
  }
};

// --- mouths ---

const MOUTH_SHAPES = {
  smile() {
    return `<path d="M86,110 Q100,126 114,110" fill="none" stroke="${INK}" stroke-width="4.5" stroke-linecap="round"/>`;
  },
  open() {
    return `
      <path d="M86,108 Q98,130 112,108 Q100,116 86,108 Z" fill="${INK}"/>
      <path d="M94,124 Q100,132 106,124 L106,118 Q94,120 94,124 Z" fill="#ff8496"/>`;
  },
  frown() {
    return `<path d="M86,120 Q100,104 114,120" fill="none" stroke="${INK}" stroke-width="4.5" stroke-linecap="round"/>`;
  },
  neutral() {
    return `<path d="M90,114 L110,114" stroke="${INK}" stroke-width="4.5" stroke-linecap="round"/>`;
  },
  tongue() {
    return `
      <path d="M86,110 Q100,124 114,110" fill="none" stroke="${INK}" stroke-width="4.5" stroke-linecap="round"/>
      <path d="M96,119 Q100,130 104,119 Z" fill="#ff8496"/>`;
  },
  heart() {
    return `<path d="M100,108 C95,103 92,105 92,109 C92,114 97,118 100,120 C103,118 108,114 108,109 C108,105 105,103 100,108 Z" fill="${INK}"/>`;
  },
  growl() {
    return `
      <path d="M86,116 L92,106 L97,114 L102,106 L107,114 L113,104" fill="none" stroke="${INK}" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>`;
  }
};

// --- accessories ---

const ACCESSORIES = {
  none() {
    return "";
  },
  crown(c) {
    return `
      <path d="M66,48 L76,34 L84,44 L92,34 L100,44 L108,34 L116,44 L124,34 L134,48 L134,58 L66,58 Z" fill="${esc(c.accent)}" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>
      <circle cx="80" cy="48" r="2.5" fill="#fff"/>
      <circle cx="100" cy="44" r="2.5" fill="#fff"/>
      <circle cx="120" cy="48" r="2.5" fill="#fff"/>`;
  },
  bow(c) {
    return `
      <path d="M156,52 Q150,44 142,46 Q142,56 154,58 Q144,66 150,64 Q158,60 156,52 Z" fill="${esc(c.accent)}" stroke="${INK}" stroke-width="2"/>
      <circle cx="149" cy="54" r="4" fill="${INK}"/>`;
  },
  glasses(c) {
    return `
      <circle cx="82" cy="95" r="12" fill="none" stroke="${esc(c.accent)}" stroke-width="4"/>
      <circle cx="118" cy="95" r="12" fill="none" stroke="${esc(c.accent)}" stroke-width="4"/>
      <path d="M94,95 L106,95" stroke="${esc(c.accent)}" stroke-width="4"/>`;
  },
  beanie(c) {
    return `
      <path d="M52,62 Q52,34 100,34 Q148,34 148,62 Q100,56 52,62 Z" fill="${esc(c.accent)}"/>
      <rect x="52" y="58" width="96" height="8" rx="4" fill="${INK}"/>
      <circle cx="100" cy="26" r="6" fill="${INK}"/>`;
  },
  flower(c) {
    const petal = (x, y) => `<circle cx="${x}" cy="${y}" r="5" fill="${esc(c.accent)}"/>`;
    return `
      <g transform="translate(46,46)">
        ${petal(0, -6)}${petal(5, -3)}${petal(5, 3)}${petal(0, 6)}${petal(-5, 3)}${petal(-5, -3)}
        <circle cx="0" cy="0" r="4.5" fill="${esc(c.shirt)}"/>
      </g>`;
  },
  headphones(c) {
    return `
      <path d="M52,84 Q52,46 100,46 Q148,46 148,84" fill="none" stroke="${esc(c.accent)}" stroke-width="7" stroke-linecap="round"/>
      <path d="M46,86 Q46,104 60,106 Q70,106 70,96 L70,90 L46,90 Z" fill="${esc(c.accent)}"/>
      <path d="M154,86 Q154,104 140,106 Q130,106 130,96 L130,90 L154,90 Z" fill="${esc(c.accent)}"/>
      <circle cx="58" cy="67" r="5" fill="#fff" opacity="0.8"/>
      <circle cx="142" cy="67" r="5" fill="#fff" opacity="0.8"/>`;
  },
  halo(c) {
    return `<ellipse cx="100" cy="34" rx="30" ry="7" fill="none" stroke="${esc(c.accent)}" stroke-width="5"/>`;
  }
};

// --- mood overlay accessories ---

const MOOD_ACCESSORIES = {
  sparkle(c) {
    return `<path d="M150,46 L154,56 L164,60 L154,64 L150,74 L146,64 L136,60 L146,56 Z" fill="${esc(c.accent)}"/>`;
  },
  teardrop() {
    return `<path d="M136,78 Q143,90 133,98 Q124,90 136,78 Z" fill="#8fd3ff" stroke="${INK}" stroke-width="2"/>`;
  },
  hearts(c) {
    const h = (x, y, s) => `<path transform="translate(${x},${y}) scale(${s})" d="M0,-6 C-4,-9 -7,-6 -7,-2 C-7,3 -2,6 0,8 C2,6 7,3 7,-2 C7,-6 4,-9 0,-6 Z" fill="${esc(c.accent)}"/>`;
    return `${h(46, 56, 1)}${h(156, 44, 0.7)}${h(40, 90, 0.8)}`;
  },
  angerVein() {
    return `<path d="M158,70 L176,82 L158,80 L176,94" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" opacity="0.7"/>`;
  },
  sparkles(c) {
    const s = (x, y, r) => `<path d="M${x},${y - r} L${x + r * 0.4},${y} L${x},${y + r} L${x - r * 0.4},${y} Z" fill="${esc(c.accent)}"/>`;
    return `${s(50, 48, 8)}${s(158, 58, 11)}${s(44, 78, 6)}${s(154, 86, 6)}`;
  },
  zzz() {
    return `<text x="150" y="52" font-family="Verdana, sans-serif" font-size="18" font-weight="bold" fill="#7bc8f6">Z</text>
      <text x="164" y="40" font-family="Verdana, sans-serif" font-size="13" font-weight="bold" fill="#a3d9ff">Z</text>`;
  }
};

// --- public renderer ---

export function renderAvatar(composition, mood) {
  const comp = composition && typeof composition === "object" ? composition : {};
  const colors = comp.colors && typeof comp.colors === "object" ? comp.colors : {};
  const moodName = MOODS[mood] ? mood : DEFAULT_MOOD;
  const moodInfo = MOODS[moodName];
  const head = HEAD_SHAPES[comp.head] ? comp.head : "round";
  const eyes = EYE_STYLES[moodInfo.eyes] ? moodInfo.eyes : EYE_STYLES[comp.eyes] ? comp.eyes : "dot";
  const mouth = MOUTH_SHAPES[moodInfo.mouth] ? moodInfo.mouth : MOUTH_SHAPES[comp.mouth] ? comp.mouth : "smile";
  const access = ACCESSORIES[comp.accessory] ? comp.accessory : "none";
  const moodAcc = MOOD_ACCESSORIES[moodInfo.accessory] ? moodInfo.accessory : null;

  const parts = [
    `<rect x="6" y="6" width="188" height="208" rx="30" fill="${esc(colors.bg)}"/>`,
    body(colors),
    `<g id="head">${HEAD_SHAPES[head](colors)}</g>`,
    blush(colors),
    `<g id="eyes">${EYE_STYLES[eyes](colors)}</g>`,
    `<g id="mouth">${MOUTH_SHAPES[mouth](colors)}</g>`,
    `<g id="accessory">${ACCESSORIES[access](colors)}</g>`
  ];
  if (moodAcc) parts.push(`<g id="mood">${MOOD_ACCESSORIES[moodAcc](colors)}</g>`);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 220" role="img" aria-label="Avatar">${parts.join("")}</svg>`;
}

// Render one standalone part category (used by the builder pickers and for
// verifying each part renders as a standalone SVG snippet).
export function renderPartSnippet(category, name) {
  const colors = defaultComposition().colors;
  if (category === "head") return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 220">${HEAD_SHAPES[name](colors)}</svg>`;
  if (category === "eyes") return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 220"><circle cx="100" cy="92" r="52" fill="${colors.skin}"/><g id="eyes">${EYE_STYLES[name](colors)}</g></svg>`;
  if (category === "mouth") return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 220"><circle cx="100" cy="100" r="52" fill="${colors.skin}"/><g id="mouth">${MOUTH_SHAPES[name](colors)}</g></svg>`;
  if (category === "accessory")
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 220"><circle cx="100" cy="100" r="52" fill="${colors.skin}"/><g id="accessory">${ACCESSORIES[name](colors)}</g></svg>`;
  if (category === "moods") return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 220"><circle cx="100" cy="100" r="52" fill="${colors.skin}"/><g id="mood">${MOOD_ACCESSORIES[name](colors)}</g></svg>`;
  return "";
}