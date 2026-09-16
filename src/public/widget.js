// Embed widget loader. Runs inside the sandboxed iframe on host pages
// (see the snippet generated on each profile page). Reuses the shared
// 3D renderer so the widget matches the profile exactly.

import { mountAvatar } from "./buddy-3d.js";
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

async function build() {
  const profile = parseInlineProfile();
  if (!profile) return;

  const frame = document.createElement("div");
  frame.className = "avatar-frame";
  root.appendChild(frame);

  await mountAvatar(frame, {
    composition: profile.avatarDef,
    mood: profile.mood,
    label: `${profile.username}'s avatar`
  });

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