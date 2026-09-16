import { AVATAR_PARTS, PALETTES, defaultComposition } from "./avatar.js";
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
    label: "Live avatar preview"
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

function setSelection(category, option) {
  state.composition[category] = option;
  document.querySelectorAll(`[data-picker="${category}"]`).forEach((btn) => {
    btn.classList.toggle("selected", btn.dataset.option === option);
    btn.setAttribute("aria-pressed", btn.dataset.option === option ? "true" : "false");
  });
  renderPreview();
}

function buildPickers() {
  pickers.innerHTML = "";
  for (const [category, meta] of Object.entries(AVATAR_PARTS)) {
    const group = document.createElement("div");
    group.className = "picker-group";
    group.dataset.group = category;

    const title = document.createElement("h3");
    title.textContent = meta.label;
    group.appendChild(title);

    const row = document.createElement("div");
    row.className = "part-row";

    for (const option of meta.options) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "part-btn";
      btn.dataset.picker = category;
      btn.dataset.option = option;
      btn.title = option;
      btn.setAttribute("aria-pressed", "false");
      renderPartThumb(btn, category, option);
      btn.addEventListener("click", () => setSelection(category, option));
      row.appendChild(btn);
    }
    group.appendChild(row);
    pickers.appendChild(group);
  }

  // mood reflects default from composition
  setSelection("head", state.composition.head);
  setSelection("eyes", state.composition.eyes);
  setSelection("mouth", state.composition.mouth);
  setSelection("accessory", state.composition.accessory);
}

function buildColors() {
  colorsEl.innerHTML = "";
  const paletteMeta = {
    skin: "Skin",
    shirt: "Outfit",
    bg: "Background",
    accent: "Accent"
  };
  for (const [key, label] of Object.entries(paletteMeta)) {
    const group = document.createElement("div");
    group.className = "color-group";
    group.dataset.colorGroup = key;

    const title = document.createElement("h3");
    title.textContent = label;
    group.appendChild(title);

    const row = document.createElement("div");
    row.className = "swatch-row";

    for (const hex of PALETTES[key]) {
      const swatch = document.createElement("button");
      swatch.type = "button";
      swatch.className = "swatch";
      swatch.style.background = hex;
      swatch.dataset.colorKey = key;
      swatch.dataset.hex = hex;
      swatch.title = hex;
      swatch.setAttribute("aria-pressed", "false");
      swatch.addEventListener("click", () => setColor(key, hex));
      row.appendChild(swatch);
    }
    group.appendChild(row);
    colorsEl.appendChild(group);
    markColorSelection(key);
  }
}

function markColorSelection(key) {
  const active = state.composition.colors[key];
  document.querySelectorAll(`[data-color-key="${key}"]`).forEach((s) => {
    const selected = s.dataset.hex === active;
    s.classList.toggle("selected", selected);
    s.setAttribute("aria-pressed", selected ? "true" : "false");
  });
}

function setColor(key, hex) {
  state.composition.colors[key] = hex;
  markColorSelection(key);
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
  const raw = usernameInput.value;
  const username = raw.trim().toLowerCase();

  if (raw.trim().length === 0) {
    showError("Please choose a username.");
    return;
  }
  if (!USERNAME_RE.test(username)) {
    showError("Usernames use letters, numbers, underscores or dashes (up to 24 characters).");
    return;
  }

  const password = passwordInput.value;
  if (password.length < 8) {
    showError("Choose a password of at least 8 characters — it keeps your buddy yours.");
    return;
  }

  form.classList.add("saving");
  try {
    const res = await fetch("/api/profiles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username,
        password,
        avatarDef: (({ mood, ...clean }) => clean)(state.composition)
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
    saveAvatarSnapshot(data.username, (({ mood, ...clean }) => clean)(state.composition));
    state.username = data.username;
    showSuccess(data.username);
    usernameInput.value = "";
    passwordInput.value = "";
  } catch (err) {
    showError("Could not reach the server. Is it running?");
  } finally {
    form.classList.remove("saving");
  }
}

// The builder is only wired when the template shipped the form — a logged-in
// visitor sees the "log out first" notice instead, so none of these elements
// exist on that page.
if (form && passwordInput && preview) {
  form.addEventListener("submit", handleSave);
  buildPickers();
  buildColors();
  renderPreview();
}