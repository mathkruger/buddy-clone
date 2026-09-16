// Shared mood table — single source of truth for the supported mood set.
// Loaded both in the browser (as an ES module) and on the server.
//
// Each mood maps to optional visual deltas: an eye override, a mouth override
// and an on-avatar overlay accessory. `null` means "keep the base part".

export const MOODS = {
  happy: {
    label: "Happy",
    eyes: null,
    mouth: "smile",
    accessory: "sparkle"
  },
  sad: {
    label: "Sad",
    eyes: "sad",
    mouth: "frown",
    accessory: "teardrop"
  },
  love: {
    label: "In Love",
    eyes: "love",
    mouth: "smile",
    accessory: "hearts"
  },
  angry: {
    label: "Angry",
    eyes: "angry",
    mouth: "growl",
    accessory: "angerVein"
  },
  excited: {
    label: "Excited",
    eyes: "star",
    mouth: "open",
    accessory: "sparkles"
  },
  sleepy: {
    label: "Sleepy",
    eyes: "sleepy",
    mouth: "neutral",
    accessory: "zzz"
  }
};

export const MOOD_ORDER = Object.keys(MOODS);
export const DEFAULT_MOOD = "happy";

export function isValidMood(name) {
  return typeof name === "string" && Object.prototype.hasOwnProperty.call(MOODS, name);
}

export function moodLabel(name) {
  return MOODS[name] && MOODS[name].label ? MOODS[name].label : name;
}