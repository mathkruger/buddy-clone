import { BuddySession } from "./session.js";
import { mountWhenVisible } from "./buddy-3d.js";

const ownerEl = document.getElementById("favorites-owner");
const statusEl = document.getElementById("favorites-status");
const listEl = document.getElementById("favorites-list");

const watchers = [];

async function boot() {
  await BuddySession.ready();
  const username = BuddySession.currentUser;
  if (!username) {
    location.href = "/login";
    return;
  }

  ownerEl.textContent = `favorites for ${username}`;
  await load();
}

function disposeWatchers() {
  for (const watcher of watchers) watcher.dispose();
  watchers.length = 0;
}

async function load() {
  const username = BuddySession.currentUser;
  disposeWatchers();
  statusEl.textContent = "";
  listEl.textContent = "";

  let favorites;
  try {
    const res = await fetch(`/api/profile/${encodeURIComponent(username)}/favorites`);
    if (res.status === 401) {
      BuddySession.logout();
      location.href = "/login";
      return;
    }
    if (!res.ok) throw new Error("bad status");
    const data = await res.json();
    favorites = data.favorites || [];
  } catch {
    statusEl.textContent = "Could not load your favorites right now.";
    return;
  }

  if (favorites.length === 0) {
    const empty = document.createElement("p");
    empty.className = "search-empty";
    empty.innerHTML = `No favorites yet. <a href="/search">Search for buddies</a> and hit the heart on their profile.`;
    listEl.appendChild(empty);
    return;
  }

  for (const favorite of favorites) {
    listEl.appendChild(renderFavorite(favorite, username));
  }
}

function renderFavorite(favorite, username) {
  const row = document.createElement("div");
  row.className = "favorite-row";

  const link = document.createElement("a");
  link.className = "favorite-link";
  link.href = `/${encodeURIComponent(favorite.username)}`;

  const avatar = document.createElement("div");
  avatar.className = "avatar-frame favorite-avatar";
  avatar.setAttribute("aria-hidden", "true");
  watchers.push(
    mountWhenVisible(avatar, {
      composition: favorite.avatarDef,
      mood: favorite.mood,
      label: `${favorite.username}'s avatar`
    })
  );

  const name = document.createElement("span");
  name.className = "search-name";
  name.textContent = favorite.username;

  link.append(avatar, name);

  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "btn favorite-remove";
  remove.textContent = "Remove";
  remove.addEventListener("click", async () => {
    remove.disabled = true;
    try {
      const res = await fetch(`/api/profile/${encodeURIComponent(username)}/favorites`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target: favorite.username })
      });
      if (res.status === 401) {
        BuddySession.logout();
        location.href = "/login";
        return;
      }
      if (!res.ok) {
        remove.disabled = false;
        return;
      }
      await load();
    } finally {
      remove.disabled = false;
    }
  });

  row.append(link, remove);
  return row;
}

boot();