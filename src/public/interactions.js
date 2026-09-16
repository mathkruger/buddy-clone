// Interaction catalog and trigger playback.
//
// Each interaction is an original, self-contained SVG+CSS sequence staged as a
// three-part scene: the current viewer's buddy (sender) on the left, the
// effect in the middle, and the target's buddy on the right. The sender avatar
// is resolved from the viewer's server-side profile on first render (cached per
// page), falling back to a saved snapshot, then the guest avatar. The header
// avatar stays static; the target reaction plays inside the stage. Last-played
// animations can be replayed locally without a POST. Identity is resolved
// server-side from the session cookie, not from anything the browser sends.

import { renderAvatar } from "./avatar.js";

const CATALOG = {
  poke: {
    label: "Poke",
    target: "react-bounce",
    sender: "sender-fly-tap",
    effect: "fx-poke"
  },
  hug: {
    label: "Hug",
    target: "react-squeeze",
    sender: "sender-glide",
    effect: "fx-hug"
  },
  highfive: {
    label: "High-five",
    target: "react-pop",
    sender: "sender-rise",
    effect: "fx-highfive"
  },
  kiss: {
    label: "Kiss",
    target: "react-blush",
    sender: "sender-drift",
    effect: "fx-kiss"
  },
  dance: {
    label: "Dance",
    target: "react-dance",
    sender: "sender-boogie",
    effect: "fx-dance"
  }
};

const GUEST_AVATAR = {
  head: "squircle",
  eyes: "happy",
  mouth: "tongue",
  accessory: "beanie",
  colors: {
    skin: "#f6b98b",
    shirt: "#8fd3ff",
    bg: "#eaf7ff",
    accent: "#7bc8f6"
  }
};

const DURATION = 1600;
const PAUSE_BEFORE = 220;

const EFFECTS = {
  "fx-poke": `<text x="118" y="150" font-size="34" text-anchor="middle">\u{1F91B}</text>
    <path d="M120,132 L132,124 L126,140 Z" fill="#ffd166"/>`,
  "fx-hug": `<text x="70" y="70" font-size="30" text-anchor="middle">\u{1F49C}</text>
    <text x="130" y="46" font-size="22" text-anchor="middle">\u{1F497}</text>
    <text x="48" y="120" font-size="20" text-anchor="middle">\u{1F49B}</text>`,
  "fx-highfive": `<path d="M80,60 L100,30 L120,60 L90,52 Z" fill="#ffd166"/>
    <path d="M60,90 L90,86 L70,112 L62,96 Z" fill="#ff8fb1"/>
    <path d="M150,84 L128,64 L150,70 L140,48 Z" fill="#7bc8f6"/>`,
  "fx-kiss": `<path d="M100,44 C92,36 84,38 84,46 C84,54 92,62 100,68 C108,62 116,54 116,46 C116,38 108,36 100,44 Z" fill="#ff8496"/>
    <text x="140" y="90" font-size="20" text-anchor="middle">\u{1F495}</text>`,
  "fx-dance": `<text x="52" y="52" font-size="24" text-anchor="middle">\u{1F3B6}</text>
    <text x="152" y="64" font-size="26" text-anchor="middle">\u{1F3B6}</text>
    <path d="M60,150 L70,138 L80,150 Z" fill="#a78bfa"/>
    <path d="M128,150 L138,138 L148,150 Z" fill="#4ade80"/>`
};

function safeGet(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

// The sender avatar shown during playback: the current user's server-side
// avatar, then the legacy saved snapshot, then the guest avatar. Resolved once
// per page and cached so play() and replay() have it ready.
let senderCache = null;
async function loadSenderAvatar() {
  if (senderCache) return senderCache;

  const session = window.BuddySession;
  const me = session && session.currentUser;
  if (me) {
    try {
      const res = await fetch(`/api/profile/${encodeURIComponent(me)}`, {
        credentials: "same-origin"
      });
      if (res.ok) {
        const profile = await res.json();
        senderCache = { avatarDef: profile.avatarDef, mood: profile.mood };
        return senderCache;
      }
    } catch {
      /* fall through to the saved snapshot */
    }
    const snapshot = safeGet("buddy.avatar." + me);
    if (snapshot) {
      try {
        senderCache = { avatarDef: JSON.parse(snapshot), mood: null };
        return senderCache;
      } catch {
        /* fall through to the guest avatar */
      }
    }
  }

  senderCache = { avatarDef: GUEST_AVATAR, mood: null };
  return senderCache;
}

// Render the three-part scene into #interaction-stage: sender | effect | target.
function buildStage(targetProfile, sender, type) {
  const stage = document.getElementById("interaction-stage");
  stage.classList.add("interaction-stage", "animated");
  stage.innerHTML = "";

  const entry = CATALOG[type];

  const senderCol = document.createElement("div");
  senderCol.className = "stage-sender";
  senderCol.innerHTML = renderAvatar(sender.avatarDef, sender.mood);

  const fx = document.createElement("div");
  fx.className = `stage-fx ${entry.effect}`;
  fx.innerHTML = `<svg viewBox="0 0 200 220" class="fx-svg">${EFFECTS[entry.effect]}</svg>`;

  const targetCol = document.createElement("div");
  targetCol.className = "stage-target";
  targetCol.innerHTML = renderAvatar(targetProfile.avatarDef, targetProfile.mood);

  stage.append(senderCol, fx, targetCol);
  return stage;
}

function clearTargetReaction(stage) {
  const target = stage && stage.querySelector(".stage-target");
  if (!target) return;
  for (const name of Array.from(target.classList)) {
    if (name === "reacting" || name.startsWith("react-")) target.classList.remove(name);
  }
  target.classList.remove("react-holder");
}

// The interaction (type / effect) played most recently; set only after a
// successful POST. Replay plays it again locally without sending anything.
let lastType = null;

async function play(type) {
  const stage = document.getElementById("interaction-stage");
  const entry = CATALOG[type];
  if (!entry) return;

  // Restart cleanly if something is still playing: tear down and re-run.
  stage.classList.remove("interaction-stage", "animated");
  stage.innerHTML = "";
  clearTargetReaction(stage);

  void stage.offsetWidth; // reflow so repeat triggers restart

  const sender = await loadSenderAvatar();
  const frame = buildStage(window.BuddyProfile.profile, sender, type);

  // Play entrance + effect, then make the target react a beat later.
  requestAnimationFrame(() => {
    frame.querySelector(".stage-sender").classList.add(entry.sender);
    frame.querySelector(".stage-fx").classList.add("go");
    const target = frame.querySelector(".stage-target");
    target.classList.add("react-holder", "reacting", entry.target);
  });

  window.clearTimeout(play._timer);
  play._timer = window.setTimeout(() => {
    frame.classList.remove("interaction-stage", "animated");
    frame.innerHTML = "";
  }, PAUSE_BEFORE + DURATION);

  // Keep a trace for tests: no page reload happened.
  window.played = type;
}

function replayLast() {
  if (!lastType) return;
  return play(lastType);
}

async function trigger(type) {
  const profile = window.BuddyProfile && BuddyProfile.profile;
  if (!profile) return;

  const buttons = document.querySelectorAll(".interaction-btn");
  buttons.forEach((b) => {
    b.disabled = true;
  });
  try {
    const res = await fetch(`/api/profile/${profile.username}/interactions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type })
    });
    if (res.status === 401) {
      const stage = document.getElementById("interaction-stage");
      stage.textContent = "Log in to poke.";
      return;
    }
    if (res.status === 404) {
      const stage = document.getElementById("interaction-stage");
      stage.textContent = "This buddy seems to have wandered off.";
      return;
    }
    if (!res.ok) return;
    const data = await res.json();
    window.BuddyProfile.profile = data.profile;
    lastType = type;
    if (replayButton) replayButton.hidden = false;
    window.BuddyProfile.reRender();
    await play(type);
  } finally {
    buttons.forEach((b) => {
      b.disabled = false;
    });
  }
}

// Catalog buttons plus a hidden ▶ Replay control that replays the last
// interaction locally (no POST, no record).
let replayButton = null;

function buildButtons(container) {
  container.innerHTML = "";
  for (const [type, meta] of Object.entries(CATALOG)) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "interaction-btn";
    btn.dataset.interaction = type;
    btn.textContent = meta.label;
    btn.addEventListener("click", () => trigger(type));
    container.appendChild(btn);
  }
  const replay = document.createElement("button");
  replay.type = "button";
  replay.className = "interaction-btn replay-btn";
  replay.textContent = "\u25B6 Replay";
  replay.hidden = true;
  replay.addEventListener("click", () => {
    void replayLast();
  });
  container.appendChild(replay);
  replayButton = replay;
  if (lastType) replayButton.hidden = false;
}

// Owner-aware interaction area. profile.js calls this from render() once the
// session resolves: owners get no poke controls and a self-poke note (history
// still renders), visitors get the catalog + replay and a pre-fetched sender.
let selfPokeNote = null;

function ensureSelfPokeNote() {
  if (selfPokeNote) return selfPokeNote;
  const section = document.querySelector(".interactions");
  if (!section) return null;
  const note = document.createElement("p");
  note.className = "self-poke-note";
  note.textContent = "This is your buddy \u2014 you can't poke yourself.";
  note.hidden = true;
  const heading = section.querySelector("h2");
  section.insertBefore(note, heading ? heading.nextSibling : section.firstChild);
  selfPokeNote = note;
  return note;
}

function render(profile) {
  const p = profile || (window.BuddyProfile && BuddyProfile.profile);
  const me = window.BuddySession && BuddySession.currentUser;
  const isOwner = Boolean(p && me && me === p.username);

  const buttons = document.getElementById("interaction-buttons");
  const note = ensureSelfPokeNote();

  if (isOwner) {
    if (buttons) buttons.innerHTML = "";
    if (replayButton) replayButton.hidden = true;
    if (note) note.hidden = false;
    return;
  }

  if (note) note.hidden = true;
  if (buttons) buildButtons(buttons);
  // Eagerly resolve the sender avatar for the first non-owner render so the
  // first play() has it ready; cached thereafter (one fetch per page).
  void loadSenderAvatar();
}

window.BuddyInteractions = { CATALOG, play, render, replay: replayLast };