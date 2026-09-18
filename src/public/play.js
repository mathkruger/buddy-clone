// Play screen client: one stage + four tabs (BuddyClone, Friends, Humor,
// Appearance). The stage always shows the viewer's own buddy; poke scenes
// temporarily take it over and the play-side restores the buddy afterward.

import { BuddySession } from "./session.js";
import { mountAvatar, mountWhenVisible } from "./buddy-3d.js";
import { MOODS, MOOD_ORDER, moodLabel } from "./moods.js";
import {
  normalizeComposition,
  HAIR_OPTIONS,
  EYE_OPTIONS,
  MOUTH_OPTIONS,
  PROPS_OPTIONS,
  SKIRT_OPTIONS,
  CLOTHING_CATALOG,
  FACE_CATALOG,
  FACE_LAYER_KEYS,
  PALETTES,
  COLOR_GROUPS,
  HAIR_PATTERN_OPTIONS,
  HAIR_STREAK_OPTIONS
} from "./avatar.js";
import { renderPartThumb } from "./buddy-thumbs.js";
import { CATALOG, playScene } from "./interactions.js";

const profileEl = document.getElementById("buddy-profile");
const stageEl = document.getElementById("play-stage");
const moodEl = document.getElementById("play-mood-name");
const clonePanel = document.getElementById("tab-clone");
const friendsPanel = document.getElementById("tab-friends");
const humorPanel = document.getElementById("tab-humor");
const appearancePanel = document.getElementById("tab-appearance");
const tabButtons = Array.from(document.querySelectorAll(".play-tab"));
const tabPanels = Array.from(document.querySelectorAll(".play-tab-panel"));

const buddyProfileEl = (() => {
  try {
    return JSON.parse(profileEl.textContent);
  } catch {
    return null;
  }
})();
const me = buddyProfileEl ? buddyProfileEl.username : null;

const HUMOR_COLORS = {
  happy: "#ffd166",
  sad: "#a0b0c4",
  love: "#ff8fb1",
  angry: "#ff7bac",
  excited: "#8fd3ff",
  sleepy: "#c9b8ff"
};

const HAT_OPTIONS = HAIR_OPTIONS.filter((name) => /BCap|SCap/.test(name));
const EAR_OPTIONS = HAIR_OPTIONS.filter((name) => /Ears/.test(name));

const HEAD_COLORS = COLOR_GROUPS.filter((g) => g.key === "skin" || g.key === "eye");
const HAIR_COLORS = COLOR_GROUPS.filter((g) => g.key === "hair" || g.key === "hairPattern" || g.key === "hairStreak");
const CLOTHES_COLORS = COLOR_GROUPS.filter((g) => ["shirt", "pants", "socks", "belt", "glove"].includes(g.key));
const SHOES_COLORS = COLOR_GROUPS.filter((g) => g.key === "shoes");
const HAT_COLORS = COLOR_GROUPS.filter((g) => g.key === "hair");

const state = {
  username: "",
  avatarDef: null,
  mood: null
};

let stageController = null;
let selfToken = 0;
let sceneToken = 0;
let randomTimer = null;
let statusTimer = null;
let draft = null;
let avatarSaveTimer = null;
let friendCache = new Map();
let friendWatchers = [];

let humorBuilt = false;
let appearanceBuilt = false;

// ---- fetch helper (same cookie-authenticated style as profile/favorites) ----

function api(method, url, body) {
  const headers = body !== undefined ? { "Content-Type": "application/json" } : {};
  const session = window.BuddySession;
  const extra = session && typeof session.headers === "function" ? session.headers() : null;
  return fetch(url, {
    method,
    credentials: "same-origin",
    headers: extra ? { ...extra, ...headers } : headers,
    body: body !== undefined ? JSON.stringify(body) : undefined
  });
}

// ---- status line ----

function renderIdleStatus() {
  clearTimeout(statusTimer);
  moodEl.textContent = state.mood && MOODS[state.mood]
    ? `currently: ${moodLabel(state.mood).toLowerCase()}`
    : "free-flowing humors";
}

function setStatus(text, keep = false) {
  clearTimeout(statusTimer);
  moodEl.textContent = text;
  if (!keep) {
    statusTimer = window.setTimeout(renderIdleStatus, 2000);
  }
}

// ---- stage ownership ----

function dropStage() {
  ++selfToken;
  if (stageController) {
    stageController.destroy();
    stageController = null;
  }
}

async function mountSelf() {
  const token = ++selfToken;
  stageEl.classList.remove("interaction-live");
  if (stageController) {
    stageController.destroy();
    stageController = null;
  }
  const ctl = await mountAvatar(stageEl, {
    composition: state.avatarDef,
    mood: state.mood,
    label: "Your buddy",
    orbit: true
  });
  if (token !== selfToken) {
    if (ctl && ctl.destroy) ctl.destroy();
    return null;
  }
  stageController = ctl;
  return ctl;
}

// Run a poke scene on the main stage, then restore the viewer's own buddy.
async function playOnStage(target, type, statusText) {
  const token = ++sceneToken;
  dropStage();
  setStatus(statusText, true);
  try {
    await playScene(stageEl, target, type);
  } catch {
    setStatus(statusText, true);
  } finally {
    if (token === sceneToken) {
      await mountSelf();
      renderIdleStatus();
    }
  }
}

// ---- random humor cycling while no fixed mood is set ----

function stopRandomCycle() {
  if (randomTimer) {
    clearInterval(randomTimer);
    randomTimer = null;
  }
}

function startRandomCycle() {
  if (state.mood !== null) return;
  stopRandomCycle();
  randomTimer = window.setInterval(() => {
    const key = MOOD_ORDER[Math.floor(Math.random() * MOOD_ORDER.length)];
    if (stageController && stageController.play) {
      stageController.play(MOODS[key].animation);
    }
  }, 6000);
}

function applyProfile(profile) {
  if (!profile || !profile.avatarDef) return;
  const before = { avatarDef: JSON.stringify(state.avatarDef), mood: state.mood };
  state.avatarDef = normalizeComposition(profile.avatarDef);
  state.mood = profile.mood || null;
  if (JSON.stringify(state.avatarDef) !== before.avatarDef || state.mood !== before.mood) {
    stopRandomCycle();
    if (state.mood === null) startRandomCycle();
    void mountSelf().then(renderIdleStatus);
  }
}

// ---- tabs ----

function switchTab(name) {
  for (const btn of tabButtons) {
    btn.classList.toggle("active", btn.dataset.tab === name);
  }
  for (const panel of tabPanels) {
    panel.classList.toggle("active", panel.id === `tab-${name}`);
  }
  if (name === "clone") {
    renderClone();
  } else if (name === "friends") {
    renderFriends();
  } else if (name === "humor") {
    if (!humorBuilt) {
      humorBuilt = true;
      renderHumor();
    }
  } else if (name === "appearance") {
    if (!appearanceBuilt) {
      appearanceBuilt = true;
      renderAppearance();
    }
  }
}

// ---- small DOM helpers ----

function emptyEl(text) {
  const p = document.createElement("p");
  p.className = "search-empty play-empty";
  p.textContent = text;
  return p;
}

function buttonEl(text, className) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = className || "btn";
  btn.textContent = text;
  return btn;
}

function timeAgo(value) {
  if (value === undefined || value === null) return "";
  const then = new Date(value).getTime();
  if (!Number.isFinite(then)) return "";
  const sec = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  return new Date(then).toLocaleDateString();
}

function pokeLabel(type) {
  const entry = CATALOG[type];
  return (entry && entry.label ? entry.label : String(type)).toUpperCase();
}

// ---- BuddyClone tab ----

async function renderClone() {
  const panel = clonePanel;
  panel.textContent = "";
  panel.appendChild(emptyEl("Loading your pokes\u2026"));

  let profile = null;
  try {
    const res = await api("GET", `/api/profile/${encodeURIComponent(me)}`);
    if (!res.ok) {
      panel.textContent = "";
      panel.appendChild(emptyEl("Could not load your pokes right now."));
      return;
    }
    profile = await res.json();
    applyProfile(profile);
  } catch {
    panel.textContent = "";
    panel.appendChild(emptyEl("Could not load your pokes right now."));
    return;
  }

  const pokes = (profile.interactions || []).slice().reverse();
  panel.textContent = "";
  if (pokes.length === 0) {
    panel.appendChild(emptyEl("No pokes yet \u2014 your buddies will show up here when they poke you."));
    return;
  }
  for (const hit of pokes) {
    panel.appendChild(pokeCard(hit));
  }
}

function pokeCard(hit) {
  const card = document.createElement("article");
  card.className = "poke-card";

  const sender = hit.sender || "guest";
  const ts = hit.timestamp !== undefined && hit.timestamp !== null ? hit.timestamp : hit.ts;

  const meta = document.createElement("div");
  meta.className = "poke-meta";

  const senderEl = document.createElement("span");
  senderEl.className = "poke-sender";
  senderEl.textContent = sender;

  const typeEl = document.createElement("strong");
  typeEl.className = "poke-type";
  typeEl.textContent = pokeLabel(hit.type);

  const timeEl = document.createElement("time");
  timeEl.className = "poke-time";
  const numeric = ts === undefined || ts === null ? NaN : new Date(ts).getTime();
  if (Number.isFinite(numeric)) {
    timeEl.dateTime = new Date(numeric).toISOString();
    timeEl.textContent = timeAgo(numeric);
  }

  meta.append(senderEl, " ", typeEl, " ", timeEl);

  const replay = buttonEl("Replay", "btn");
  replay.addEventListener("click", () => void replayPoke(hit));

  const back = buttonEl("Poke back", "btn");
  back.addEventListener("click", () => void pokeBack(hit));

  const actions = document.createElement("div");
  actions.className = "poke-actions";
  actions.append(replay, back);

  card.append(meta, actions);
  return card;
}

async function replayPoke(hit) {
  const sender = hit.sender;
  if (!sender) return;
  let target = null;
  try {
    const res = await api("GET", `/api/profile/${encodeURIComponent(sender)}/public`);
    if (res.ok) target = await res.json();
  } catch {
    target = null;
  }
  if (!target || !target.avatarDef) {
    setStatus(`Couldn't find ${sender} to replay.`);
    return;
  }
  await playOnStage(target, hit.type, `replaying a poke from ${sender}`);
}

async function pokeBack(hit) {
  const sender = hit.sender;
  if (!sender) return;
  try {
    const res = await api("POST", `/api/profile/${encodeURIComponent(sender)}/interactions`, { type: hit.type });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setStatus((body && body.error) || "That poke couldn't be sent.");
      return;
    }
  } catch {
    setStatus("Could not reach the server.");
    return;
  }
  let target = null;
  try {
    const res = await api("GET", `/api/profile/${encodeURIComponent(sender)}/public`);
    if (res.ok) target = await res.json();
  } catch {
    target = null;
  }
  if (target && target.avatarDef) {
    await playOnStage(target, hit.type, `poked ${sender}`);
  } else {
    setStatus(`poked ${sender}`);
  }
}

// ---- Friends tab ----

function disposeFriendWatchers() {
  for (const watcher of friendWatchers) {
    if (watcher && typeof watcher.dispose === "function") watcher.dispose();
  }
  friendWatchers = [];
}

function renderFriends() {
  const panel = friendsPanel;
  disposeFriendWatchers();
  friendCache = new Map();
  panel.textContent = "";
  panel.appendChild(addFriendForm());

  const listEl = document.createElement("div");
  listEl.className = "friends-list";
  panel.appendChild(listEl);

  api("GET", `/api/profile/${encodeURIComponent(me)}/favorites`)
    .then(async (res) => {
      if (!res.ok) {
        listEl.appendChild(emptyEl("Could not load your friends right now."));
        return;
      }
      const data = await res.json();
      const friends = (data && data.favorites) || [];
      if (friends.length === 0) {
        listEl.appendChild(emptyEl("No friends yet \u2014 add them by exact username above."));
        return;
      }
      await renderFriendRows(listEl, friends);
    })
    .catch(() => {
      listEl.appendChild(emptyEl("Could not load your friends right now."));
    });
}

async function renderFriendRows(listEl, friends) {
  const built = friends.map(buildFriendRow);
  for (const { row } of built) listEl.appendChild(row);

  await Promise.all(
    built.map(async ({ row, entry }) => {
      const name = String(entry.username || "").trim();
      if (!name) return;
      let res = null;
      try {
        res = await api("GET", `/api/profile/${encodeURIComponent(name)}/public`);
      } catch {
        res = null;
      }
      if (!res || !res.ok) {
        row.classList.add("deleted");
        row.dataset.deleted = "true";
        const nameEl = row.querySelector(".friend-name");
        if (nameEl) nameEl.textContent = `${name} (deleted)`;
        const poke = row.querySelector(".friend-poke");
        if (poke) poke.disabled = true;
        const type = row.querySelector(".friend-poke-type");
        if (type) type.disabled = true;
        return;
      }
      let pub = null;
      try {
        pub = await res.json();
      } catch {
        pub = null;
      }
      if (!pub || !pub.avatarDef) return;
      friendCache.set(name, pub);
      const avatar = row.querySelector(".friend-avatar");
      if (avatar) {
        friendWatchers.push(
          mountWhenVisible(avatar, {
            composition: pub.avatarDef,
            mood: pub.mood,
            label: `${name}'s buddy`
          })
        );
      }
    })
  );
}

function pokeTypeSelect() {
  const select = document.createElement("select");
  select.className = "friend-poke-type";
  select.setAttribute("aria-label", "Poke type");
  for (const [key, entry] of Object.entries(CATALOG)) {
    const option = document.createElement("option");
    option.value = key;
    option.textContent = entry.label;
    select.appendChild(option);
  }
  return select;
}

function buildFriendRow(entry) {
  const row = document.createElement("div");
  row.className = "favorite-row friend-row";

  const avatar = document.createElement("div");
  avatar.className = "avatar-frame favorite-avatar friend-avatar";
  avatar.setAttribute("aria-hidden", "true");

  const name = document.createElement("span");
  name.className = "search-name friend-name";
  name.textContent = entry.username;

  const info = document.createElement("div");
  info.className = "friend-info";
  info.append(avatar, name);

  const type = pokeTypeSelect();
  const poke = buttonEl("Poke", "btn friend-poke");
  poke.addEventListener("click", () => void pokeFriend(entry.username, type.value));

  const remove = buttonEl("Remove", "btn friend-remove");
  remove.addEventListener("click", () => void removeFriend(entry.username));

  const actions = document.createElement("div");
  actions.className = "friend-actions";
  actions.append(type, poke, remove);

  row.append(info, actions);
  return { row, entry };
}

function addFriendForm() {
  const form = document.createElement("form");
  form.className = "add-friend-form";

  const input = document.createElement("input");
  input.type = "text";
  input.id = "add-friend-name";
  input.placeholder = "exact username";
  input.autocomplete = "off";

  const addBtn = buttonEl("Add", "btn");
  addBtn.type = "submit";

  const error = document.createElement("p");
  error.className = "friend-error";
  error.hidden = true;

  form.append(input, addBtn, error);

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const name = input.value.trim();
    error.hidden = true;
    if (!name) {
      error.textContent = "Enter a username first.";
      error.hidden = false;
      return;
    }
    addBtn.disabled = true;
    api("PUT", `/api/profile/${encodeURIComponent(me)}/favorites`, { target: name })
      .then(async (res) => {
        if (res.status === 400 || res.status === 404) {
          const body = await res.json().catch(() => null);
          error.textContent =
            (body && body.error) ||
            (res.status === 404 ? `No buddy named "${name}".` : "That friend couldn't be added.");
          error.hidden = false;
          return;
        }
        if (!res.ok) {
          error.textContent = "Could not add that friend right now.";
          error.hidden = false;
          return;
        }
        input.value = "";
        setStatus(`added ${name}`);
        renderFriends();
      })
      .catch(() => {
        error.textContent = "Could not reach the server.";
        error.hidden = false;
      })
      .finally(() => {
        addBtn.disabled = false;
      });
  });

  return form;
}

async function pokeFriend(username, type = "poke") {
  const key = CATALOG[type] ? type : "poke";
  const target = friendCache.get(username);
  if (!target) return;
  try {
    const res = await api("POST", `/api/profile/${encodeURIComponent(username)}/interactions`, { type: key });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setStatus((body && body.error) || "That poke couldn't be sent.");
      return;
    }
  } catch {
    setStatus("Could not reach the server.");
    return;
  }
  await playOnStage(target, key, `sent a ${pokeLabel(key)} to ${username}`);
}

async function removeFriend(username) {
  try {
    const res = await api("DELETE", `/api/profile/${encodeURIComponent(me)}/favorites`, { target: username });
    if (!res.ok) {
      setStatus("Could not remove that friend.");
      return;
    }
    setStatus(`removed ${username}`);
    renderFriends();
  } catch {
    setStatus("Could not reach the server.");
  }
}

// ---- Humor tab ----

function renderHumor() {
  const panel = humorPanel;
  panel.textContent = "";

  const grid = document.createElement("div");
  grid.className = "humor-grid";

  for (const key of MOOD_ORDER) {
    const moodData = MOODS[key];
    const cell = document.createElement("button");
    cell.type = "button";
    cell.className = "humor-option";
    cell.dataset.mood = key;
    cell.title = moodData.animation;

    const swatch = document.createElement("span");
    swatch.className = "humor-swatch";
    swatch.style.background = HUMOR_COLORS[key];

    const label = document.createElement("span");
    label.className = "humor-label";
    label.textContent = moodData.label;

    cell.append(swatch, label);
    cell.addEventListener("click", () => void chooseMood(key));
    grid.appendChild(cell);
  }
  panel.appendChild(grid);

  const none = document.createElement("button");
  none.type = "button";
  none.className = "humor-option none-option";
  none.dataset.mood = "none";
  none.textContent = "None \u2014 let the humors flow";
  none.addEventListener("click", () => void chooseMood("none"));
  panel.appendChild(none);

  markActiveMood();
}

function markActiveMood() {
  humorPanel.querySelectorAll(".humor-option").forEach((btn) => {
    const active = state.mood || "none";
    const selected = active === btn.dataset.mood;
    btn.classList.toggle("selected", selected);
    btn.setAttribute("aria-pressed", selected ? "true" : "false");
  });
}

async function applyMoodState() {
  if (stageController && stageController.setComposition) {
    await stageController.setComposition(state.avatarDef, state.mood);
  } else {
    await mountSelf();
  }
}

async function chooseMood(key) {
  if (key === "none") {
    try {
      const res = await api("PUT", `/api/profile/${encodeURIComponent(me)}`, { mood: "none" });
      if (!res.ok) throw new Error("Could not clear your mood.");
      stopRandomCycle();
      state.mood = null;
      await applyMoodState();
      startRandomCycle();
      markActiveMood();
      renderIdleStatus();
    } catch (err) {
      setStatus(err.message || "Could not clear your mood.");
    }
    return;
  }

  const moodData = MOODS[key];
  if (!moodData) return;
  if (stageController && stageController.play) {
    stageController.play(moodData.animation);
  }
  try {
    const res = await api("PUT", `/api/profile/${encodeURIComponent(me)}`, { mood: key });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new Error((body && body.error) || "Could not set your mood.");
    }
    stopRandomCycle();
    state.mood = key;
    await applyMoodState();
    markActiveMood();
    renderIdleStatus();
  } catch (err) {
    setStatus(err.message || "Could not set your mood.");
  }
}

// ---- Appearance tab ----

function renderAppearance() {
  const panel = appearancePanel;
  panel.textContent = "";
  draft = normalizeComposition({ ...state.avatarDef });

  const holder = document.createElement("div");
  holder.className = "appearance-pickers";

  holder.appendChild(buildHeadGroup());
  holder.appendChild(buildHairGroup());
  holder.appendChild(buildClothesGroup());
  holder.appendChild(buildShoesGroup());
  holder.appendChild(buildHatsGroup());
  holder.appendChild(buildEarsGroup());
  holder.appendChild(buildAddonsGroup());

  panel.appendChild(holder);
  refreshSelectionMarkers();
}

function buildHeadGroup() {
  const rows = [
    { label: "Eyes", category: "eyes", options: EYE_OPTIONS },
    { label: "Mouth", category: "mouth", options: MOUTH_OPTIONS }
  ];
  for (const key of FACE_LAYER_KEYS) {
    rows.push({
      label: FACE_CATALOG[key].label,
      category: `face:${key}`,
      options: ["none", ...FACE_CATALOG[key].options.map((o) => o.symbol)]
    });
  }
  return pickerGroup("Head", rows, HEAD_COLORS);
}

function buildHairGroup() {
  return pickerGroup("Hair", [
    { label: "Style", category: "hair", options: HAIR_OPTIONS },
    { label: "Pattern", category: "hairPattern", options: HAIR_PATTERN_OPTIONS },
    { label: "Streak", category: "hairStreak", options: HAIR_STREAK_OPTIONS }
  ], HAIR_COLORS);
}

function buildClothesGroup() {
  const rows = [{ label: "Skirt", category: "skirt", options: SKIRT_OPTIONS }];
  for (const entry of CLOTHING_CATALOG) {
    if (entry.category === "shoes") continue;
    rows.push({ label: entry.label, category: `clothing:${entry.layer}`, options: entry.symbols });
  }
  return pickerGroup("Clothes", rows, CLOTHES_COLORS);
}

function buildShoesGroup() {
  const rows = [];
  for (const entry of CLOTHING_CATALOG) {
    if (entry.category !== "shoes") continue;
    rows.push({ label: entry.label, category: `clothing:${entry.layer}`, options: entry.symbols });
  }
  return pickerGroup("Shoes", rows, SHOES_COLORS);
}

function buildHatsGroup() {
  return pickerGroup("Hats", [
    { label: "Style", category: "hair", options: HAT_OPTIONS }
  ], HAT_COLORS);
}

function buildEarsGroup() {
  return pickerGroup("Ears", [
    { label: "Style", category: "hair", options: EAR_OPTIONS }
  ], []);
}

function buildAddonsGroup() {
  return pickerGroup("Addons", [
    { label: "Props", category: "props", options: ["none", ...PROPS_OPTIONS] }
  ], []);
}

function pickerGroup(title, rows, colorGroups) {
  const group = document.createElement("div");
  group.className = "picker-group";

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
      rowEl.appendChild(optionButton(row.category, option, renderOption(row.category, option)));
    }
    content.appendChild(rowEl);
  }
  group.appendChild(content);

  if (colorGroups.length > 0) {
    group.appendChild(buildColorBlock(colorGroups));
  }

  return group;
}

function renderOption(category, option) {
  if (category === "hairPattern" || category === "hairStreak") return option;
  return null;
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
  btn.addEventListener("click", () => setAppearance(category, option));
  return btn;
}

function buildColorBlock(groups) {
  const block = document.createElement("div");
  block.className = "color-group";
  for (const group of groups) {
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
      swatch.addEventListener("click", () => setAppearanceColor(group, hex));
      row.appendChild(swatch);
    }
    block.appendChild(row);
  }
  markColorSelections();
  return block;
}

function selectionPath(category, option) {
  if (category === "hairPattern") return { path: "hairMaterial.patternIndex", value: HAIR_PATTERN_OPTIONS.indexOf(option) };
  if (category === "hairStreak") return { path: "hairMaterial.streakIndex", value: HAIR_STREAK_OPTIONS.indexOf(option) };
  if (category.startsWith("clothing:")) return { path: `clothing.${category.slice(9)}`, value: option };
  if (category.startsWith("face:")) return { path: `face.${category.slice(5)}`, value: option };
  return { path: category, value: option };
}

function readPath(obj, path) {
  return path.split(".").reduce((o, key) => (o && typeof o === "object" ? o[key] : undefined), obj);
}

function writePath(obj, path, value) {
  const keys = path.split(".");
  let o = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    if (!o[keys[i]] || typeof o[keys[i]] !== "object") o[keys[i]] = {};
    o = o[keys[i]];
  }
  o[keys[keys.length - 1]] = value;
}

function setAppearance(category, option) {
  const { path, value } = selectionPath(category, option);
  writePath(draft, path, value);
  state.avatarDef = normalizeComposition(draft);
  draft = state.avatarDef;
  refreshSelectionMarkers();
  void applyAppearanceLive();
}

function setAppearanceColor(group, hex) {
  writePath(draft, group.path, hex);
  state.avatarDef = normalizeComposition(draft);
  draft = state.avatarDef;
  markColorSelections();
  void applyAppearanceLive();
}

async function applyAppearanceLive() {
  try {
    if (stageController && stageController.setComposition) {
      await stageController.setComposition(state.avatarDef, state.mood);
    } else {
      await mountSelf();
    }
  } catch {
    setStatus("Could not refresh the preview.");
  }
  scheduleAvatarSave();
}

function refreshSelectionMarkers() {
  appearancePanel.querySelectorAll("[data-picker]").forEach((btn) => {
    const { path, value } = selectionPath(btn.dataset.picker, btn.dataset.option);
    const selected = readPath(state.avatarDef, path) === value;
    btn.classList.toggle("selected", selected);
    btn.setAttribute("aria-pressed", selected ? "true" : "false");
  });
}

function markColorSelections() {
  appearancePanel.querySelectorAll("[data-color-key]").forEach((swatch) => {
    const group = COLOR_GROUPS.find((g) => g.key === swatch.dataset.colorKey);
    const selected = group ? readPath(state.avatarDef, group.path) === swatch.dataset.hex : false;
    swatch.classList.toggle("selected", selected);
    swatch.setAttribute("aria-pressed", selected ? "true" : "false");
  });
}

function saveAvatarNow() {
  api("PUT", `/api/profile/${encodeURIComponent(me)}`, { avatarDef: state.avatarDef })
    .then(async (res) => {
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error((body && body.error) || "Saving your look failed.");
      }
      const updated = await res.json();
      if (updated && updated.avatarDef) {
        state.avatarDef = normalizeComposition(updated.avatarDef);
        draft = state.avatarDef;
      }
      if (window.BuddyInteractions && typeof window.BuddyInteractions.resetSenderAvatar === "function") {
        window.BuddyInteractions.resetSenderAvatar();
      }
      setStatus("saved");
    })
    .catch((err) => {
      setStatus(err.message || "Saving your look failed.");
    });
}

function scheduleAvatarSave() {
  if (avatarSaveTimer) clearTimeout(avatarSaveTimer);
  avatarSaveTimer = window.setTimeout(() => {
    avatarSaveTimer = null;
    saveAvatarNow();
  }, 350);
}

// ---- boot ----

async function boot() {
  let data = null;
  try {
    data = JSON.parse(profileEl.textContent);
  } catch {
    data = null;
  }
  if (!data || !data.username) return;

  state.username = data.username;
  state.avatarDef = normalizeComposition(data.avatarDef);
  state.mood = data.mood || null;

  for (const btn of tabButtons) {
    btn.addEventListener("click", () => switchTab(btn.dataset.tab));
  }

  await BuddySession.ready();

  await mountSelf();
  if (state.mood === null) startRandomCycle();
  renderIdleStatus();
  switchTab("clone");
}

if (profileEl && stageEl && moodEl && tabButtons.length > 0) {
  void boot();
}