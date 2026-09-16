import { mountWhenVisible } from "./buddy-3d.js";

const form = document.getElementById("search-form");
const input = document.getElementById("search-query");
const statusEl = document.getElementById("search-status");
const resultsEl = document.getElementById("search-results");

const watchers = [];

form.addEventListener("submit", onSearch);

async function onSearch(event) {
  event.preventDefault();
  statusEl.textContent = "";
  resultsEl.textContent = "";

  const raw = input.value;
  const query = raw.trim();

  if (!query) {
    statusEl.textContent = "Type a username to search for buddies.";
    return;
  }

  statusEl.textContent = "Searching…";
  let data;
  try {
    const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
    if (!res.ok) throw new Error("bad status");
    data = await res.json();
  } catch {
    statusEl.textContent = "Could not search right now. Please try again.";
    return;
  }

  statusEl.textContent = "";
  renderResults(data.results || [], query);
}

function disposeWatchers() {
  for (const watcher of watchers) watcher.dispose();
  watchers.length = 0;
}

function renderResults(results, query) {
  disposeWatchers();
  resultsEl.textContent = "";
  if (results.length === 0) {
    const empty = document.createElement("p");
    empty.className = "search-empty";
    empty.textContent = `No buddies match “${query}”. Try a different name or create this buddy.`;
    resultsEl.appendChild(empty);
    return;
  }

  for (const result of results) {
    const card = document.createElement("a");
    card.className = "search-result";
    card.href = `/${encodeURIComponent(result.username)}`;

    const avatar = document.createElement("div");
    avatar.className = "avatar-frame search-avatar";
    avatar.setAttribute("aria-hidden", "true");
    watchers.push(
      mountWhenVisible(avatar, {
        composition: result.avatarDef,
        mood: result.mood,
        label: `${result.username}'s avatar`
      })
    );

    const name = document.createElement("span");
    name.className = "search-name";
    name.textContent = result.username;

    const mood = document.createElement("span");
    mood.className = "search-mood";
    mood.textContent = result.mood;

    card.append(avatar, name, mood);
    resultsEl.appendChild(card);
  }
}