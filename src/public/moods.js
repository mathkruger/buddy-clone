// Shared mood table — single source of truth for the supported mood set.
// Loaded both in the browser (as an ES module) and on the server.
//
// Each mood maps to optional visual deltas: an eye override, a mouth override
// and an on-avatar overlay accessory. `null` means "keep the base part".
// `animation` names the looped skeletal animation from the vendored subset
// (`buddylabs/animations-subset.json`) that plays while the mood is set.

export const MOODS = {
  happy: {
    label: "Happy",
    eyes: null,
    mouth: "smile",
    accessory: "sparkle",
    animation: "mood_happy"
  },
  sad: {
    label: "Sad",
    eyes: "sad",
    mouth: "frown",
    accessory: "teardrop",
    animation: "mood_sad"
  },
  love: {
    label: "In Love",
    eyes: "love",
    mouth: "smile",
    accessory: "hearts",
    animation: "mood_inLove"
  },
  angry: {
    label: "Angry",
    eyes: "angry",
    mouth: "growl",
    accessory: "angerVein",
    animation: "mood_angry"
  },
  excited: {
    label: "Excited",
    eyes: "star",
    mouth: "open",
    accessory: "sparkles",
    animation: "mood_giggle"
  },
  sleepy: {
    label: "Sleepy",
    eyes: "sleepy",
    mouth: "neutral",
    accessory: "zzz",
    animation: "mood_sleeping"
  }
};

export default MOODS;

export const MOOD_ORDER = Object.keys(MOODS);
export const DEFAULT_MOOD = "happy";
export const DEFAULT_IDLE_ANIMATION = "standBreathe";

export function isValidMood(name) {
  return typeof name === "string" && Object.prototype.hasOwnProperty.call(MOODS, name);
}

export function moodLabel(name) {
  return MOODS[name] && MOODS[name].label ? MOODS[name].label : name;
}