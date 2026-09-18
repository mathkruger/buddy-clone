// Interaction catalog and trigger playback.
//
// Each interaction is staged as a three-part scene: the current viewer's buddy
// (sender) on the left, the effect in the middle, and the target's buddy on the
// right. `playScene` mounts the sender from the viewer's own saved profile
// (resolved lazily and cached per page), the poke effect, and the target's
// avatar, animates the sequence, then tears the stage back down and resolves.
// The sender entrance stays procedural whole-object motion (`sender`); once it
// lands, both avatars play their mapped skeletal animations from the vendored
// subset (`senderAnim`/`targetAnim`). Identity is resolved server-side from the
// session cookie, not from anything the browser sends.

import { mountAvatar } from "./buddy-3d.js";

export const CATALOG = {
  poke: {
    label: "Poke",
    senderAnim: "poke1",
    targetAnim: "poke2",
    sender: "sender-fly-tap",
    effect: "fx-poke"
  },
  hug: {
    label: "Hug",
    senderAnim: "hug1",
    targetAnim: "hug2",
    sender: "sender-glide",
    effect: "fx-hug"
  },
  highfive: {
    label: "High-five",
    senderAnim: "gimmeFive1",
    targetAnim: "highTen1",
    sender: "sender-rise",
    effect: "fx-highfive"
  },
  kiss: {
    label: "Kiss",
    senderAnim: "kiss1",
    targetAnim: "kiss2",
    sender: "sender-drift",
    effect: "fx-kiss"
  },
  dance: {
    label: "Dance",
    senderAnim: "jamA1",
    targetAnim: "jamB1",
    sender: "sender-boogie",
    effect: "fx-dance"
  }
};

const GUEST_AVATAR = {
  hair: "Hair_Simple_Twiggy",
  eyes: "Eyes_Lake",
  mouth: "smile",
  face: { beard: "Berd_Goat" },
  colors: {
    skin: "#f6b98b",
    hair: "#15191d",
    shirt: "#8fd3ff",
    eye: "#3a2a68",
    bg: "#eaf7ff"
  }
};

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

// The sender avatar shown during playback: the current user's own saved avatar.
// Resolved once per page and cached; `resetSenderAvatar` clears it after
// appearance edits so replays pick up the new look.
let senderCache = null;

export async function loadSenderAvatar() {
  if (senderCache) return senderCache;

  const session = window.BuddySession;
  const me = session && session.currentUser;
  if (me) {
    try {
      const res = await fetch(`/api/profile/${encodeURIComponent(me)}`, { credentials: "same-origin" });
      if (res.ok) {
        const profile = await res.json();
        senderCache = { avatarDef: profile.avatarDef, mood: profile.mood };
        return senderCache;
      }
    } catch {
      /* fall through to the snapshot/guest fallbacks */
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

export function resetSenderAvatar() {
  senderCache = null;
}

// Tracks the controllers currently living inside the stage so teardown can
// stop their render loops before wiping the DOM.
let stageControllers = [];

function clearStage(stage) {
  if (!stage) return;
  for (const ctl of stageControllers) {
    if (ctl && ctl.destroy) ctl.destroy();
  }
  stageControllers = [];
  stage.classList.remove("interaction-stage", "animated");
  stage.innerHTML = "";
}

// Render the three-part scene into `stage`: sender | effect | target. The
// avatars are mounted through the 3D renderer; the returned controllers drive
// the sender entrance and the target reaction.
async function buildStage(stage, targetProfile, sender, type) {
  stage.classList.add("interaction-stage", "animated");

  const entry = CATALOG[type];

  const senderCol = document.createElement("div");
  senderCol.className = "stage-sender";

  const senderCtl = await mountAvatar(senderCol, {
    composition: sender.avatarDef,
    mood: sender.mood,
    label: "you",
    orbit: true
  });

  const fx = document.createElement("div");
  fx.className = `stage-fx ${entry.effect}`;
  fx.innerHTML = `<svg viewBox="0 0 200 220" class="fx-svg">${EFFECTS[entry.effect]}</svg>`;

  const targetCol = document.createElement("div");
  targetCol.className = "stage-target";

  const targetCtl = await mountAvatar(targetCol, {
    composition: targetProfile.avatarDef,
    mood: targetProfile.mood,
    label: targetProfile.username,
    orbit: true
  });

  stage.append(senderCol, fx, targetCol);
  requestAnimationFrame(() => fx.classList.add("go"));
  return { senderCtl, targetCtl };
}

// Play a poke scene into `stage` and resolve once the animations have run their
// course. `type` is a CATALOG key; `target` is `{ username, avatarDef, mood }`.
// Local playback only — nothing is recorded. Any pre-existing stage contents
// (e.g. the viewer's own buddy) are torn down and the stage is left empty so
// the caller can repopulate it. Rejects when the target profile is unusable.
export async function playScene(stage, target, type) {
  const entry = CATALOG[type];
  if (!entry || !stage) return;
  if (!target || !target.avatarDef) {
    throw new Error("playScene needs a target profile with an avatarDef");
  }

  clearStage(stage);

  const sender = await loadSenderAvatar();
  const { senderCtl, targetCtl } = await buildStage(stage, target, sender, type);
  const local = [senderCtl, targetCtl];
  stageControllers = local;

  // Sender entrance stays procedural; once it lands, the sender plays its
  // skeletal animation. The target plays its skeletal animation a beat later.
  const senderDone = senderCtl && senderCtl.play
    ? senderCtl.play(entry.sender).then(() => (senderCtl.play ? senderCtl.play(entry.senderAnim) : Promise.resolve()))
    : Promise.resolve();
  const targetDone = new Promise((resolve) => {
    window.setTimeout(() => resolve(targetCtl && targetCtl.play ? targetCtl.play(entry.targetAnim) : Promise.resolve()), PAUSE_BEFORE);
  }).then((p) => p || Promise.resolve());

  try {
    await Promise.all([senderDone, targetDone]);
  } finally {
    // A newer playScene reassigns `stageControllers`, so a stale completion
    // never clears a fresh stage.
    if (stageControllers === local) clearStage(stage);
  }
}

window.BuddyInteractions = { CATALOG, playScene, loadSenderAvatar, resetSenderAvatar };