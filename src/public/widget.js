// Embed widget loader. Runs inside the sandboxed iframe on host pages
// (see the snippet generated on each profile page). Reuses the shared
// renderer so the widget matches the profile exactly.

import { renderAvatar } from "./avatar.js";
import { MOODS } from "./moods.js";

const root = document.getElementById("embed-root");
const dataEl = document.getElementById("buddy-profile");

function parseInlineProfile() {
  if (!dataEl) return null;
  try {
    return JSON.parse(dataEl.textContent);
  } catch {
    return null;
  }
}

function build() {
  const profile = parseInlineProfile();
  if (!profile) return;

  const frame = document.createElement("div");
  frame.className = "avatar-frame";
  frame.innerHTML = renderAvatar(profile.avatarDef, profile.mood);
  frame.setAttribute("aria-label", `${profile.username}'s avatar`);
  root.appendChild(frame);

  const mood = document.createElement("div");
  mood.className = "mood-name";
  mood.textContent = (MOODS[profile.mood] && MOODS[profile.mood].label) || profile.mood;
  root.appendChild(mood);

  const link = document.createElement("a");
  link.className = "embed-footer";
  link.href = `/${encodeURIComponent(profile.username)}`;
  link.textContent = `${profile.username} is a buddy`;
  link.target = "_top";
  root.appendChild(link);

  root.hidden = false;
}

build();