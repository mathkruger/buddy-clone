import { AVATAR_PARTS, PALETTES, COLOR_GROUPS, CLOTHING_CATALOG, FACE_CATALOG, FACE_LAYER_KEYS, HAIR_PATTERN_OPTIONS, HAIR_STREAK_OPTIONS, defaultComposition, normalizeComposition, partLabel } from "./avatar.js";
import { renderPartThumb } from "./buddy-thumbs.js";
import { mountAvatar } from "./buddy-3d.js";
import { MOODS } from "./moods.js";

const USERNAME_RE = /^[a-zA-Z0-9_-]{1,24}$/;

const state = {
  composition: defaultComposition(),
  mood: "happy",
  username: ""
};

const preview = document.getElementById("builder-preview");
const pickers = document.getElementById("builder-pickers");
const colorsEl = document.getElementById("builder-colors");
const form = document.getElementById("save-form");
const usernameInput = document.getElementById("username");
const passwordInput = document.getElementById("password");
const errorEl = document.getElementById("save-error");
const successEl = document.getElementById("save-success");
const profileLink = document.getElementById("profile-link");
const moodNameEl = document.getElementById("builder-mood-name");

let previewController = null;
let previewToken = 0;

const buddyDataEl = document.getElementById("buddy-data");
const isEditing = Boolean(buddyDataEl);
if (isEditing) {
  try {
    const buddyData = JSON.parse(buddyDataEl.textContent);
    if (buddyData && buddyData.avatarDef) {
      state.composition = normalizeComposition(buddyData.avatarDef);
      state.username = buddyData.username || "";
    }
  } catch {
    // Use defaults if buddyData is malformed
  }
}

function renderPreview() {
  const moodM = MOODS[state.mood] || {};
  const token = ++previewToken;
  if (previewController) {
    previewController.destroy();
    previewController = null;
  }
  mountAvatar(preview, {
    composition: state.composition,
    mood: state.mood,
    label: "Live avatar preview",
    orbit: true
  }).then((ctl) => {
    if (token !== previewToken) {
      if (ctl && ctl.destroy) ctl.destroy();
      return;
    }
    previewController = ctl;
  });
  const moodLabel = moodM.label ? moodM.label.toLowerCase() : state.mood;
  moodNameEl.textContent = `feeling ${moodLabel}`;
}

// Dot-path helpers over the composition: "clothing.ShrtLength" / "face.brows" /
// "hairMaterial.patternIndex" / "colors.shirt".
function readPath(comp, path) {
  return path.split(".").reduce((obj, key) => (obj && typeof obj === "object" ? obj[key] : undefined), comp);
}

function writePath(comp, path, value) {
  const keys = path.split(".");
  let obj = comp;
  for (let i = 0; i < keys.length - 1; i++) {
    if (!obj[keys[i]] || typeof obj[keys[i]] !== "object") obj[keys[i]] = {};
    obj = obj[keys[i]];
  }
  obj[keys[keys.length - 1]] = value;
}

function selectionPath(category, option) {
  if (category === "hairPattern") return { path: "hairMaterial.patternIndex", value: HAIR_PATTERN_OPTIONS.indexOf(option) };
  if (category === "hairStreak") return { path: "hairMaterial.streakIndex", value: HAIR_STREAK_OPTIONS.indexOf(option) };
  if (category.startsWith("clothing:")) return { path: `clothing.${category.slice("clothing:".length)}`, value: option };
  if (category.startsWith("face:")) return { path: `face.${category.slice("face:".length)}`, value: option };
  return { path: category, value: option };
}

function setSelection(category, option) {
  const { path, value } = selectionPath(category, option);
  writePath(state.composition, path, value);
  document.querySelectorAll(`[data-picker="${category}"]`).forEach((btn) => {
    const selected = btn.dataset.option === option;
    btn.classList.toggle("selected", selected);
    btn.setAttribute("aria-pressed", selected ? "true" : "false");
  });
  renderPreview();
}

function optionButton(category, option, label) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "part-btn";
  btn.dataset.picker = category;
  btn.dataset.option = option;
  btn.title = option;
  btn.setAttribute("aria-pressed", "false");
  if (label === null) {
    renderPartThumb(btn, category, option);
  } else {
    const span = document.createElement("span");
    span.className = "part-thumb-label";
    span.textContent = label;
    btn.appendChild(span);
  }
  btn.addEventListener("click", () => setSelection(category, option));
  return btn;
}

function pickerGroup(title, rows, categoryToOptions) {
  const group = document.createElement("div");
  group.className = "picker-group";
  group.dataset.group = title;
  const heading = document.createElement("h3");
  heading.textContent = title;
  group.appendChild(heading);
  const content = document.createElement("div");
  content.className = "part-rows";
  for (const row of rows) {
    if (row.label && row.label !== title) {
      const sub = document.createElement("h4");
      sub.className = "part-row-label";
      sub.textContent = row.label;
      content.appendChild(sub);
    }
    const rowEl = document.createElement("div");
    rowEl.className = "part-row";
    for (const option of row.options) {
      rowEl.appendChild(optionButton(row.category, option, categoryToOptions(row.category, option)));
    }
    content.appendChild(rowEl);
  }
  group.appendChild(content);
  pickers.appendChild(group);
}

function buildPickers() {
  pickers.innerHTML = "";

  for (const [category, meta] of Object.entries(AVATAR_PARTS)) {
    const options = category === "props" ? ["none", ...meta.options] : meta.options;
    pickerGroup(meta.label, [{ category, options }], () => null);
    markSelection(category, state.composition[category]);
  }

  // Body-material clothing layers, grouped by category (socks/pants/shirt/
  // shoes/gloves/belt). Each category has several independent layers.
  const clothingGroups = new Map();
  for (const entry of CLOTHING_CATALOG) {
    if (!clothingGroups.has(entry.category)) clothingGroups.set(entry.category, []);
    clothingGroups.get(entry.category).push({ label: entry.label, category: `clothing:${entry.layer}`, options: entry.symbols });
  }
  for (const [category, rows] of clothingGroups) {
    pickerGroup(`Clothes: ${category}`, rows, () => null);
    for (const row of rows) markSelection(row.category, (state.composition.clothing || {})[row.category.slice("clothing:".length)]);
  }

  // Face layers: one row per layer, always including "none" (layer off).
  for (const key of FACE_LAYER_KEYS) {
    const meta = FACE_CATALOG[key];
    const options = ["none", ...meta.options.map((o) => o.symbol)];
    pickerGroup(meta.label, [{ category: `face:${key}`, options }], () => null);
    markSelection(`face:${key}`, (state.composition.face || {})[key]);
  }

  // Hair material overlays (pattern / streak), plain label buttons (no mesh to
  // snapshot).
  pickerGroup("Hair pattern", [{ category: "hairPattern", options: HAIR_PATTERN_OPTIONS }], (_, option) => option);
  markSelection("hairPattern", HAIR_PATTERN_OPTIONS[state.composition.hairMaterial.patternIndex] ?? HAIR_PATTERN_OPTIONS[0]);
  pickerGroup("Hair streak", [{ category: "hairStreak", options: HAIR_STREAK_OPTIONS }], (_, option) => option);
  markSelection("hairStreak", HAIR_STREAK_OPTIONS[state.composition.hairMaterial.streakIndex] ?? HAIR_STREAK_OPTIONS[0]);
}

function markSelection(category, option) {
  document.querySelectorAll(`[data-picker="${category}"]`).forEach((btn) => {
    const selected = btn.dataset.option === option;
    btn.classList.toggle("selected", selected);
    btn.setAttribute("aria-pressed", selected ? "true" : "false");
  });
}

function buildColors() {
  colorsEl.innerHTML = "";
  for (const group of COLOR_GROUPS) {
    const block = document.createElement("div");
    block.className = "color-group";
    block.dataset.colorGroup = group.key;

    const title = document.createElement("h3");
    title.textContent = group.label;
    block.appendChild(title);

    const row = document.createElement("div");
    row.className = "swatch-row";

    for (const hex of PALETTES[group.palette]) {
      const swatch = document.createElement("button");
      swatch.type = "button";
      swatch.className = "swatch";
      swatch.style.background = hex;
      swatch.dataset.colorKey = group.key;
      swatch.dataset.hex = hex;
      swatch.title = hex;
      swatch.setAttribute("aria-pressed", "false");
      swatch.addEventListener("click", () => setColor(group, hex));
      row.appendChild(swatch);
    }
    block.appendChild(row);
    colorsEl.appendChild(block);
    markColorSelection(group);
  }
}

function markColorSelection(group) {
  const active = readPath(state.composition, group.path);
  document.querySelectorAll(`[data-color-key="${group.key}"]`).forEach((s) => {
    const selected = s.dataset.hex === active;
    s.classList.toggle("selected", selected);
    s.setAttribute("aria-pressed", selected ? "true" : "false");
  });
}

function setColor(group, hex) {
  writePath(state.composition, group.path, hex);
  markColorSelection(group);
  renderPreview();
}

function showError(message) {
  errorEl.textContent = message;
  successEl.hidden = true;
}

function clearError() {
  errorEl.textContent = "";
}

function showSuccess(username) {
  clearError();
  profileLink.textContent = `buddy-clone.local/${username}`;
  profileLink.href = `/${encodeURIComponent(username)}`;
  successEl.hidden = false;
}

function saveAvatarSnapshot(username, avatarDef) {
  try {
    localStorage.setItem("buddy.avatar." + username, JSON.stringify(avatarDef));
  } catch (err) {
    console.warn("Could not persist avatar snapshot:", err);
  }
}

async function handleSave(event) {
  event.preventDefault();
  clearError();
  const username = isEditing ? state.username : (usernameInput ? usernameInput.value.trim().toLowerCase() : state.username);

  if (!isEditing && !username) {
    showError("Please choose a username.");
    return;
  }
  if (!isEditing && !USERNAME_RE.test(username)) {
    showError("Usernames use letters, numbers, underscores or dashes (up to 24 characters).");
    return;
  }

  const isNewBuddy = !isEditing;
  const password = isNewBuddy ? (passwordInput ? passwordInput.value : "") : "";
  if (isNewBuddy && password.length < 8) {
    showError("Choose a password of at least 8 characters — it keeps your buddy yours.");
    return;
  }

  form.classList.add("saving");
  try {
    const avatarDef = normalizeComposition(state.composition);
    if (isEditing) {
      const res = await fetch(`/api/profile/${encodeURIComponent(state.username)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatarDef })
      });
      if (!res.ok) {
        const body = await res.json();
        showError(body.error || "Something went wrong saving your buddy. Please try again.");
        return;
      }
      const data = await res.json();
      saveAvatarSnapshot(data.username, avatarDef);
      showSuccess(data.username);
    } else {
      const res = await fetch("/api/profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          password,
          avatarDef
        })
      });
      if (res.status === 403) {
        showError("You're already logged in — log out before creating a new buddy.");
        return;
      }
      if (res.status === 409) {
        showError(`"${username}" is already taken — try another username.`);
        return;
      }
      if (res.status === 400) {
        const body = await res.json();
        showError(body.error || "That username is not allowed.");
        return;
      }
      if (!res.ok) {
        showError("Something went wrong saving your buddy. Please try again.");
        return;
      }
      const data = await res.json();
      saveAvatarSnapshot(data.username, avatarDef);
      state.username = data.username;
      showSuccess(data.username);
      usernameInput.value = "";
      passwordInput.value = "";
    }
  } catch (err) {
    showError("Could not reach the server. Is it running?");
  } finally {
    form.classList.remove("saving");
  }
}

// The builder is only wired when the template shipped the form — a logged-in
// visitor sees the "log out first" notice instead, so none of these elements
// exist on that page.
if (form && preview) {
  form.addEventListener("submit", handleSave);
  buildPickers();
  buildColors();
  renderPreview();
}