import { MOODS, MOOD_ORDER, DEFAULT_MOOD } from "./moods.js";
import { mountAvatar } from "./buddy-3d.js";
import { BuddySession } from "./session.js";

const root = document.getElementById("profile-root");
const notFoundEl = document.getElementById("not-found");
const dataEl = document.getElementById("buddy-profile");

const els = {
  avatar: document.getElementById("profile-avatar"),
  username: document.getElementById("profile-username"),
  mood: document.getElementById("profile-mood"),
  created: document.getElementById("profile-created"),
  stats: document.getElementById("profile-stats"),
  actions: document.getElementById("profile-actions"),
  editors: document.getElementById("profile-editors"),
  favoriteArea: document.getElementById("favorite-area"),
  embedSection: document.getElementById("embed-section"),
  embedSnippet: document.getElementById("embed-snippet"),
  copySnippet: document.getElementById("copy-snippet"),
  interactionTarget: document.getElementById("interaction-target"),
  interactionButtons: document.getElementById("interaction-buttons"),
  interactionStage: document.getElementById("interaction-stage"),
  interactionHistory: document.getElementById("interaction-history")
};

export function parseInlineProfile() {
  if (!dataEl) return null;
  try {
    return JSON.parse(dataEl.textContent);
  } catch {
    return null;
  }
}

export const BuddyProfile = {
  profile: null,

  isOwner() {
    const me = BuddySession.currentUser;
    return Boolean(this.profile && me && me === this.profile.username);
  },

  getProfile() {
    return this.profile;
  },

  reRender() {
    render();
  }
};

let avatarController = null;
let avatarToken = 0;

function mountProfileAvatar(p) {
  const token = ++avatarToken;
  if (avatarController) {
    avatarController.destroy();
    avatarController = null;
  }
  mountAvatar(els.avatar, {
    composition: p.avatarDef,
    mood: p.mood,
    label: `${p.username}'s avatar`,
    orbit: true
  }).then((ctl) => {
    if (token !== avatarToken) {
      if (ctl && ctl.destroy) ctl.destroy();
      return;
    }
    avatarController = ctl;
  });
}

function render() {
  const p = BuddyProfile.profile;
  if (!p) {
    if (avatarController) {
      avatarController.destroy();
      avatarController = null;
    }
    root.hidden = true;
    notFoundEl.hidden = false;
    return;
  }
  root.hidden = false;
  notFoundEl.hidden = true;

  mountProfileAvatar(p);
  els.username.textContent = p.username;
  els.mood.textContent = (MOODS[p.mood] && MOODS[p.mood].label) || p.mood;
  els.created.textContent = `buddy since ${new Date(p.createdAt).toLocaleDateString()}`;

  const counts = p.interactionCounts || {};
  const total = p.interactionTotal || 0;
  els.stats.textContent = total === 0
    ? "no pokes yet"
    : `got ${total} poke${total === 1 ? "" : "s"}: ${Object.entries(counts)
        .map(([type, n]) => `${type} \u00d7 ${n}`)
        .join(", ")}`;

  els.interactionTarget.textContent = p.username;
  els.interactionHistory.innerHTML = "";
  renderHistory(p);

  if (window.BuddyInteractions && typeof window.BuddyInteractions.render === "function") {
    window.BuddyInteractions.render(p);
  }

  if (BuddyProfile.isOwner()) {
    els.actions.hidden = false;
    buildOwnerActions();
    els.embedSection.hidden = false;
    buildEmbedSection(p);
    els.favoriteArea.textContent = "";
  } else {
    els.actions.hidden = true;
    els.embedSection.hidden = true;
    els.editors.innerHTML = "";
    buildFavoriteArea(p);
  }
}

function renderHistory(p) {
  const recent = (p.interactions || []).slice(-10);
  if (recent.length === 0) {
    const none = document.createElement("p");
    none.textContent = "No interactions yet. Go on, give them a poke!";
    els.interactionHistory.appendChild(none);
    return;
  }
  const head = document.createElement("p");
  head.textContent = "Recent pokes:";
  els.interactionHistory.appendChild(head);
  const ul = document.createElement("ul");
  for (const hit of recent) {
    const li = document.createElement("li");
    li.className = "history-fresh";
    const when = new Date(hit.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const sender = hit.sender || "guest";

    const typeNode = document.createElement("span");
    typeNode.textContent = `${hit.type} \u00d7 `;

    const senderNode = sender === "guest"
      ? (() => {
          const span = document.createElement("span");
          span.className = "sender-guest";
          span.textContent = "guest";
          return span;
        })()
      : (() => {
          const a = document.createElement("a");
          a.className = "sender-link";
          a.href = `/${encodeURIComponent(sender)}`;
          a.textContent = sender;
          return a;
        })();

    const timeNode = document.createElement("span");
    timeNode.textContent = ` \u00d7 ${when}`;

    li.append(typeNode, senderNode, timeNode);
    ul.appendChild(li);
  }
  els.interactionHistory.appendChild(ul);
}

// --- favorite controls (non-owner visitors) ---

function buildFavoriteArea(p) {
  const area = els.favoriteArea;
  area.textContent = "";
  if (!area) return;

  const me = BuddySession.currentUser;
  if (!me) {
    const guest = document.createElement("p");
    guest.className = "favorite-guest";
    const link = document.createElement("a");
    link.href = "/login";
    link.textContent = "Log in";
    guest.append(link, " to favorite buddies like this one.");
    area.appendChild(guest);
    return;
  }
  if (me === p.username) return;

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "btn favorite-toggle";
  btn.textContent = "…";
  area.appendChild(btn);

  async function refresh() {
    btn.disabled = true;
    try {
      const res = await fetch(`/api/profile/${encodeURIComponent(me)}/favorites`);
      if (res.status === 401) {
        BuddySession.logout();
        location.href = "/login";
        return;
      }
      if (!res.ok) {
        btn.textContent = "Could not load favorites";
        return;
      }
      const data = await res.json();
      const names = (data.favorites || []).map((f) => f.username);
      const isFav = names.includes(p.username);
      btn.classList.toggle("fav", isFav);
      btn.textContent = isFav ? "♥ Favorited" : "♡ Favorite this buddy";
    } finally {
      btn.disabled = false;
    }
  }

  btn.addEventListener("click", async () => {
    const isFav = btn.classList.contains("fav");
    btn.disabled = true;
    try {
      const res = await fetch(`/api/profile/${encodeURIComponent(me)}/favorites`, {
        method: isFav ? "DELETE" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target: p.username })
      });
      if (res.status === 401) {
        BuddySession.logout();
        location.href = "/login";
        return;
      }
      if (!res.ok) return;
      await refresh();
    } finally {
      btn.disabled = false;
    }
  });

  refresh();
}

// --- owner controls ---

function buildOwnerActions() {
  els.actions.innerHTML = "";
  const moodBtn = document.createElement("button");
  moodBtn.type = "button";
  moodBtn.className = "btn owner";
  moodBtn.textContent = "Change mood";
  moodBtn.addEventListener("click", () => toggleEditor("mood"));
  els.actions.appendChild(moodBtn);

  const editLink = document.createElement("a");
  editLink.className = "btn owner";
  editLink.href = "/create";
  editLink.textContent = "Edit buddy";
  els.actions.appendChild(editLink);

  const favLink = document.createElement("a");
  favLink.className = "btn owner";
  favLink.href = "/favorites";
  favLink.textContent = "My favorites";
  els.actions.appendChild(favLink);
}

function toggleEditor(kind) {
  if (kind === "mood") {
    els.editors.innerHTML = "";
    els.editors.appendChild(buildMoodEditor());
  } else {
    els.editors.innerHTML = "";
  }
}

function buildMoodEditor() {
  const panel = document.createElement("div");
  panel.className = "editor-panel mood-editor";
  const title = document.createElement("h3");
  title.textContent = "Pick a mood";
  panel.appendChild(title);

  const options = document.createElement("div");
  options.className = "mood-options";

  for (const mood of MOOD_ORDER) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "mood-option";
    btn.dataset.mood = mood;
    btn.textContent = MOODS[mood].label;
    if (mood === BuddyProfile.profile.mood) btn.classList.add("selected");
    btn.addEventListener("click", () => changeMood(mood));
    options.appendChild(btn);
  }
  panel.appendChild(options);
  return panel;
}

async function changeMood(mood) {
  const p = BuddyProfile.profile;
  const res = await fetch(`/api/profile/${p.username}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mood })
  });
  if (!res.ok) return;
  BuddyProfile.profile = await res.json();
  render();
  els.editors.innerHTML = "";
  els.editors.appendChild(buildMoodEditor());
}

// --- embed snippet (owner only) ---

function buildEmbedSection(p) {
  const host = location.origin;
  const snippet = `<iframe src="${host}/embed/${encodeURIComponent(p.username)}" width="200" height="280" sandbox="allow-scripts allow-same-origin" loading="lazy"></iframe>`;
  els.embedSnippet.value = snippet;

  els.copySnippet.onclick = async () => {
    try {
      await navigator.clipboard.writeText(snippet);
      els.copySnippet.textContent = "Copied!";
      setTimeout(() => {
        els.copySnippet.textContent = "Copy";
      }, 1500);
    } catch {
      els.embedSnippet.select();
      document.execCommand("copy");
      els.copySnippet.textContent = "Copied!";
      setTimeout(() => {
        els.copySnippet.textContent = "Copy";
      }, 1500);
    }
  };
}

// --- boot ---

export async function boot() {
  await BuddySession.ready();
  BuddyProfile.profile = parseInlineProfile();
  render();
}

window.BuddyProfile = BuddyProfile;

boot();