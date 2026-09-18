// Interaction catalog and trigger playback.
//
// Each interaction runs on a SINGLE shared frame: the current viewer's buddy
// (sender) and the target's buddy are mounted into one camera/scene together
// (`mountSharedStage`), and the interaction's choreography decides where each
// buddy starts, how close they get, and whether they touch. Poke/hug/high-five/
// kiss reach contact at an interaction-specific distance; dance stages both
// buddies adjacent. `playScene` mounts the shared stage and resolves
// once the choreography has run its course, then tears the stage back down.
//
// Choreography is declarative data owned by this module: world-space keyframe
// tracks (offsets relative to the stage center, in buddy-scaled units), yaw
// facing, and scheduled skeletal one-shots, plus a total duration. The
// shared-frame renderer stays generic and just plays the supplied tracks.
//
// Identity is resolved server-side from the session cookie, not from anything
// the browser sends.

import { mountSharedStage } from "./buddy-3d.js";

export const CATALOG = {
  poke: {
    label: "Poke",
    choreography: {
      duration: 6.0,
      resting: { sender: { x: -1.0 }, target: { x: 1.0 } },
      sender: {
        yaw: 0.5,
        tracks: [
          [0, { x: -3.4, scale: 0.9 }],
          [1.0, { x: -0.55 }],
          [1.6, { x: -0.85, rotZ: 0.05 }],
          [2.4, { x: -1.8 }],
          [5.2, { x: -1.0, rotZ: 0 }]
        ],
        animCues: [{ t: 1.0, name: "poke1" }]
      },
      target: {
        yaw: -0.5,
        tracks: [
          [0, { x: 1.0 }],
          [1.0, { x: 0.92, scale: 1.02 }],
          [1.6, { x: 1.06, rotZ: 0.04 }],
          [2.6, { x: 1.0, rotZ: 0, scale: 1 }]
        ],
        animCues: [{ t: 1.25, name: "poke2" }]
      }
    }
  },
  hug: {
    label: "Hug",
    choreography: {
      duration: 7.0,
      resting: { sender: { x: -1.0 }, target: { x: 1.0 } },
      sender: {
        yaw: 0.6,
        tracks: [
          [0, { x: -3.0, scale: 0.9 }],
          [1.2, { x: 0.05 }],
          [2.2, { x: 0.05, rotZ: 0 }],
          [3.2, { x: -1.4 }],
          [6.2, { x: -1.0, rotZ: 0 }]
        ],
        animCues: [{ t: 1.2, name: "hug1" }]
      },
      target: {
        yaw: -0.6,
        tracks: [
          [0, { x: 1.0 }],
          [1.2, { x: -0.05, scale: 1.03 }],
          [2.2, { x: -0.05, rotZ: -0.03 }],
          [3.4, { x: 1.0, rotZ: 0, scale: 1 }]
        ],
        animCues: [{ t: 1.4, name: "hug2" }]
      }
    }
  },
  highfive: {
    label: "High-five",
    choreography: {
      duration: 6.5,
      resting: { sender: { x: -1.0 }, target: { x: 1.0 } },
      sender: {
        yaw: 0.45,
        tracks: [
          [0, { x: -3.1, scale: 0.9 }],
          [1.0, { x: -0.35, rotZ: -0.06 }],
          [2.0, { x: -1.3 }],
          [5.9, { x: -1.0, rotZ: 0 }]
        ],
        animCues: [{ t: 1.0, name: "gimmeFive1" }]
      },
      target: {
        yaw: -0.45,
        tracks: [
          [0, { x: 1.0 }],
          [1.0, { x: 0.35, scale: 1.02 }],
          [2.2, { x: 1.0, scale: 1 }]
        ],
        animCues: [{ t: 1.15, name: "highTen1" }]
      }
    }
  },
  kiss: {
    label: "Kiss",
    choreography: {
      duration: 7.0,
      resting: { sender: { x: -1.0 }, target: { x: 1.0 } },
      sender: {
        yaw: 0.6,
        tracks: [
          [0, { x: -3.0, scale: 0.9 }],
          [1.3, { x: 0.0 }],
          [2.3, { x: 0.0, rotZ: 0 }],
          [3.3, { x: -1.4 }],
          [6.4, { x: -1.0, rotZ: 0 }]
        ],
        animCues: [{ t: 1.3, name: "kiss1" }]
      },
      target: {
        yaw: -0.6,
        tracks: [
          [0, { x: 1.0 }],
          [1.3, { x: 0.0, scale: 1.02 }],
          [2.3, { x: 0.0, rotZ: 0 }],
          [3.5, { x: 1.0, scale: 1 }]
        ],
        animCues: [{ t: 1.5, name: "kiss2" }]
      }
    }
  },
  dance: {
    label: "Dance",
    choreography: {
      duration: 5.0,
      resting: { sender: { x: -1.0 }, target: { x: 1.0 } },
      sender: {
        yaw: 0.4,
        tracks: [
          [0, { x: -1.0 }],
          [0.4, { x: -0.95, rotZ: -0.04 }],
          [1.6, { x: -1.05, rotZ: 0.05 }],
          [2.6, { x: -0.95, rotZ: -0.04 }],
          [3.6, { x: -1.0, rotZ: 0 }]
        ],
        animCues: [{ t: 0.4, name: "jamA1" }]
      },
      target: {
        yaw: -0.4,
        tracks: [
          [0, { x: 1.0 }],
          [0.4, { x: 1.05, rotZ: 0.04 }],
          [1.6, { x: 0.95, rotZ: -0.05 }],
          [2.6, { x: 1.05, rotZ: 0.04 }],
          [3.6, { x: 1.0, rotZ: 0 }]
        ],
        animCues: [{ t: 0.4, name: "jamB1" }]
      }
    }
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

// Tracks the shared-stage controller currently living inside the stage so
// teardown can stop its render loop before wiping the DOM.
let stageControllers = [];

function clearStage(stage) {
  if (!stage) return;
  for (const ctl of stageControllers) {
    if (ctl && ctl.destroy) ctl.destroy();
  }
  stageControllers = [];
  stage.classList.remove("interaction-live");
  stage.innerHTML = "";
}

// Mount a pair into `stage` through the shared-frame renderer. The returned
// controller drives the interaction's choreography.
async function buildStage(stage, targetProfile, sender, type) {
  const entry = CATALOG[type];

  return mountSharedStage(stage, {
    label: `${entry.label} between you and ${targetProfile.username}`,
    sender: { composition: sender.avatarDef, mood: sender.mood },
    target: { composition: targetProfile.avatarDef, mood: targetProfile.mood }
  });
}

// Play a poke scene into `stage` and resolve once the choreography has run its
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
  const ctl = await buildStage(stage, target, sender, type);
  const local = [ctl];
  stageControllers = local;

  try {
    await ctl.play(entry.choreography);
  } finally {
    // A newer playScene reassigns `stageControllers`, so a stale completion
    // never clears a fresh stage.
    if (stageControllers === local) clearStage(stage);
  }
}

window.BuddyInteractions = { CATALOG, playScene, loadSenderAvatar, resetSenderAvatar };