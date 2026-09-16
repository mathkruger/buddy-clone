import crypto from "node:crypto";
import { isValidMood, DEFAULT_MOOD } from "../public/moods.js";
import { openDatabase } from "./db/backend.js";
import {
  DuplicateUsernameError,
  NotFoundError,
  TokenMismatchError,
  ValidationError
} from "./errors.js";

export {
  DuplicateUsernameError,
  NotFoundError,
  TokenMismatchError,
  ValidationError
} from "./errors.js";
export { INTERACTION_LIMIT, MAX_INTERACTION_TYPES } from "./constants.js";

// Usernames: 1-24 chars, letters (normalized to lowercase), digits, _ or -.
const USERNAME_RE = /^[a-zA-Z0-9_-]{1,24}$/;

export function normalizeUsername(name) {
  return String(name).trim().toLowerCase();
}

export function isValidUsername(name) {
  return USERNAME_RE.test(name);
}

export function hashToken(rawToken) {
  return crypto.createHash("sha256").update(String(rawToken), "utf8").digest("hex");
}

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

// `Store` is a facade over a storage backend. It keeps validation, error
// mapping, sender resolution, and profile projection; the backend owns
// persistence. The constructor accepts storage config — a database path
// string, or `{ path, dataFile, provider }` where `dataFile` is the optional
// legacy JSON migration source.
export class Store {
  constructor(config) {
    const opts = typeof config === "string" ? { path: config } : config || {};
    this.config = opts;
    this._backend = null;
    this._initialized = false;
  }

  async init() {
    this._backend = openDatabase({
      provider: this.config.provider || "sqlite",
      path: this.config.path,
      dataFile: this.config.dataFile
    });
    await this._backend.init();
    this._initialized = true;
    return this;
  }

  // ---- reads ----

  getProfile(username) {
    this._assertReady();
    const user = this._backend.getProfile(username);
    if (!user) return null;
    return this._publicUser(username, user);
  }

  hasUser(username) {
    this._assertReady();
    return this._backend.hasUser(username);
  }

  // ---- writes ----

  // Create a profile for `username`. `passwordHash` is a bcrypt hash set by
  // the auth flow; profiles created without one (legacy imports) cannot log
  // in. No claim token is minted or returned.
  createProfile(username, avatarDef, passwordHash) {
    return (async () => {
      this._assertReady();
      if (this._backend.hasUser(username)) {
        throw new DuplicateUsernameError(`Username "${username}" is already taken`);
      }
      const user = {
        avatarDef: avatarDef || {},
        mood: DEFAULT_MOOD,
        tokenHash: "",
        passwordHash: passwordHash || null,
        createdAt: new Date().toISOString()
      };
      this._backend.createProfile(username, user);
      return { username };
    })();
  }

  updateProfile(username, patch) {
    return (async () => {
      this._assertReady();
      const user = this._backend.getProfile(username);
      if (!user) throw new NotFoundError("Profile not found");
      const update = {};
      const hasAvatar = Object.prototype.hasOwnProperty.call(patch, "avatarDef");
      const hasMood = Object.prototype.hasOwnProperty.call(patch, "mood");
      if (hasAvatar) update.avatarDef = patch.avatarDef || {};
      if (hasMood) {
        if (!isValidMood(patch.mood)) {
          throw new ValidationError(`Unsupported mood "${patch.mood}"`);
        }
        update.mood = patch.mood;
      }
      this._backend.updateProfile(username, update);
      return this._publicUser(username, this._backend.getProfile(username));
    })();
  }

  // The bcrypt hash backing an account (used by the auth service at login),
  // or null when the profile has no password.
  getPasswordHash(username) {
    this._assertReady();
    const user = this._backend.getProfile(username);
    if (!user) return null;
    return user.passwordHash || null;
  }

  addInteraction(username, type, sender) {
    return (async () => {
      this._assertReady();
      const user = this._backend.addInteraction(username, type, sender || "guest");
      return this._publicUser(username, user);
    })();
  }

  async snapshot() {
    this._assertReady();
    return clone(this._backend.snapshot());
  }

  // ---- favorites ----

  getFavorites(username) {
    return (async () => {
      this._assertReady();
      const user = this._backend.getProfile(username);
      if (!user) throw new NotFoundError("Profile not found");
      return this._resolveFavorites(this._backend.getFavorites(username));
    })();
  }

  addFavorite(username, target) {
    return (async () => {
      this._assertReady();
      const user = this._backend.getProfile(username);
      if (!user) throw new NotFoundError("Profile not found");
      const targetName = normalizeUsername(target);
      if (!targetName) throw new NotFoundError("Profile not found");
      const favorites = this._backend.addFavorite(username, targetName);
      return this._resolveFavorites(favorites);
    })();
  }

  removeFavorite(username, target) {
    return (async () => {
      this._assertReady();
      const user = this._backend.getProfile(username);
      if (!user) throw new NotFoundError("Profile not found");
      const targetName = normalizeUsername(target);
      if (!targetName) throw new NotFoundError("Profile not found");
      const favorites = this._backend.removeFavorite(username, targetName);
      return this._resolveFavorites(favorites);
    })();
  }

  // ---- search ----

  searchProfiles(query) {
    this._assertReady();
    const q = normalizeUsername(query);
    if (!q) return [];
    return this._backend.searchProfiles(q);
  }

  // ---- private helpers ----

  _assertReady() {
    if (!this._initialized) throw new Error("Store not initialized. Call store.init() first.");
  }

  _profileSummary(username, user) {
    return {
      username,
      avatarDef: clone(user.avatarDef),
      mood: user.mood
    };
  }

  _resolveFavorites(rawTargets) {
    const resolved = [];
    for (const name of rawTargets) {
      const target = this._backend.getProfile(name);
      if (target) resolved.push(this._profileSummary(name, target));
    }
    return resolved;
  }

  _publicUser(username, user) {
    const interactions = (user.interactions || []).map((hit) => ({
      type: hit.type,
      ts: hit.ts,
      sender: hit.sender || "guest"
    }));
    const summary = {};
    for (const hit of interactions) {
      summary[hit.type] = (summary[hit.type] || 0) + 1;
    }
    return {
      username,
      avatarDef: clone(user.avatarDef),
      mood: user.mood,
      createdAt: user.createdAt,
      interactions,
      interactionCounts: summary,
      interactionTotal: interactions.length
    };
  }
}