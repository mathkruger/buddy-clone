import { isValidUsername, normalizeUsername } from "../repository/store.js";
import { NotFoundError, ValidationError } from "../repository/store.js";
import { isValidMood } from "../public/moods.js";
import { normalizeComposition } from "../public/avatar.js";

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function profileService(store, auth) {
  async function create(username, avatarDef, password) {
    const normalized = normalizeUsername(username);
    if (!isValidUsername(normalized)) {
      throw new ValidationError(
        "Invalid username. Use 1-24 letters, numbers, underscores or dashes."
      );
    }
    if (avatarDef !== undefined && !isPlainObject(avatarDef)) {
      throw new ValidationError("avatarDef must be an object.");
    }
    if (typeof password !== "string" || password.length < 8) {
      throw new ValidationError("Password must be at least 8 characters.");
    }
    const passwordHash = await auth.hashPassword(password);
    await store.createProfile(normalized, normalizeComposition(avatarDef), passwordHash);
    const profile = store.getProfile(normalized);
    return { username: normalized, profile };
  }

  function get(username) {
    const normalized = normalizeUsername(username);
    const profile = store.getProfile(normalized);
    if (!profile) throw new NotFoundError("Profile not found");
    return profile;
  }

  async function update(username, avatarDef, mood) {
    const normalized = normalizeUsername(username);
    if (avatarDef !== undefined && !isPlainObject(avatarDef)) {
      throw new ValidationError("avatarDef must be an object.");
    }
    if (mood !== undefined && mood !== "none" && !isValidMood(mood)) {
      throw new ValidationError(`Unsupported mood "${mood}"`);
    }
    const patch = {};
    if (avatarDef !== undefined) patch.avatarDef = normalizeComposition(avatarDef);
    if (mood !== undefined) patch.mood = mood === "none" ? null : mood;
    if (Object.keys(patch).length === 0) {
      throw new ValidationError("Nothing to update");
    }
    return store.updateProfile(normalized, patch);
  }

  return { create, get, update };
}