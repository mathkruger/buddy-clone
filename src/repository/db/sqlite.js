import fs from "node:fs/promises";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { INTERACTION_LIMIT } from "../constants.js";
import { DuplicateUsernameError, NotFoundError } from "../errors.js";
import { DEFAULT_MOOD } from "../../public/moods.js";

const USER_RE = /^[a-zA-Z0-9_-]{1,24}$/;

export class SqliteBackend {
  constructor(config) {
    this.config = config || {};
    this.path = this.config.path;
    this.dataFile = this.config.dataFile;
    this.db = null;
  }

  // ---- setup ----

  async init() {
    await fs.mkdir(path.dirname(this.path), { recursive: true });
    this.db = new DatabaseSync(this.path, { enableForeignKeyConstraints: false });
    this._createSchema();
    await this._migrateFromJsonIfEmpty();
    return this;
  }

  close() {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  _createSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users(
        username TEXT PRIMARY KEY,
        avatarDef TEXT,
        mood TEXT NOT NULL,
        tokenHash TEXT NOT NULL,
        createdAt TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS interactions(
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL REFERENCES users(username),
        type TEXT NOT NULL,
        sender TEXT NOT NULL DEFAULT 'guest',
        ts INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_interactions_username_id
        ON interactions(username, id);
      CREATE TABLE IF NOT EXISTS favorites(
        owner TEXT NOT NULL REFERENCES users(username),
        target TEXT NOT NULL REFERENCES users(username),
        PRIMARY KEY(owner, target)
      );
    `);
    this._ensurePasswordHashColumn();
  }

  _ensurePasswordHashColumn() {
    const cols = this.db.prepare("PRAGMA table_info(users)").all();
    if (!cols.some((col) => col.name === "passwordHash")) {
      this.db.exec("ALTER TABLE users ADD COLUMN passwordHash TEXT");
    }
  }

  // ---- reads ----

  getProfile(username) {
    const row = this.db
      .prepare("SELECT username, avatarDef, mood, tokenHash, passwordHash, createdAt FROM users WHERE username = ?")
      .get(username);
    if (!row) return null;
    return {
      ...row,
      avatarDef: this._parseAvatarDef(row.avatarDef),
      interactions: this._getInteractions(username),
      favorites: this._getFavoriteTargets(username)
    };
  }

  hasUser(username) {
    return Boolean(
      this.db.prepare("SELECT 1 AS x FROM users WHERE username = ?").get(username)
    );
  }

  // ---- writes ----

  createProfile(username, { avatarDef, mood, tokenHash, passwordHash, createdAt }) {
    try {
      this.db
        .prepare(
          "INSERT INTO users(username, avatarDef, mood, tokenHash, passwordHash, createdAt) VALUES (?, ?, ?, ?, ?, ?)"
        )
        .run(username, JSON.stringify(avatarDef || {}), mood, tokenHash, passwordHash || null, createdAt);
    } catch (err) {
      if (String(err.message).includes("UNIQUE")) {
        throw new DuplicateUsernameError(`Username "${username}" is already taken`);
      }
      throw err;
    }
    return this.getProfile(username);
  }

  updateProfile(username, patch) {
    this._assertUser(username);
    const hasAvatar = Object.prototype.hasOwnProperty.call(patch, "avatarDef");
    const hasMood = Object.prototype.hasOwnProperty.call(patch, "mood");
    if (hasAvatar && hasMood) {
      this.db
        .prepare("UPDATE users SET avatarDef = ?, mood = ? WHERE username = ?")
        .run(JSON.stringify(patch.avatarDef || {}), patch.mood, username);
    } else if (hasAvatar) {
      this.db
        .prepare("UPDATE users SET avatarDef = ? WHERE username = ?")
        .run(JSON.stringify(patch.avatarDef || {}), username);
    } else if (hasMood) {
      this.db.prepare("UPDATE users SET mood = ? WHERE username = ?").run(patch.mood, username);
    }
    return this.getProfile(username);
  }

  addInteraction(username, type, sender) {
    this._assertUser(username);
    const ts = Date.now();
    this.db
      .prepare("INSERT INTO interactions(username, type, sender, ts) VALUES (?, ?, ?, ?)")
      .run(username, type, sender || "guest", ts);
    this.db
      .prepare(
        `DELETE FROM interactions WHERE username = ? AND id NOT IN (
          SELECT id FROM interactions WHERE username = ? ORDER BY id DESC LIMIT ?
        )`
      )
      .run(username, username, INTERACTION_LIMIT);
    return this.getProfile(username);
  }

  // ---- favorites ----

  getFavorites(username) {
    this._assertUser(username);
    return this._getFavoriteTargets(username);
  }

  addFavorite(username, target) {
    this._assertUser(username);
    this._assertUser(target);
    this.db
      .prepare("INSERT OR IGNORE INTO favorites(owner, target) VALUES (?, ?)")
      .run(username, target);
    return this._getFavoriteTargets(username);
  }

  removeFavorite(username, target) {
    this._assertUser(username);
    this._assertUser(target);
    this.db.prepare("DELETE FROM favorites WHERE owner = ? AND target = ?").run(username, target);
    return this._getFavoriteTargets(username);
  }

  // ---- search ----

  searchProfiles(query) {
    const like = `%${query}%`;
    return this.db
      .prepare(
        "SELECT username, avatarDef, mood FROM users WHERE lower(username) LIKE ? ORDER BY lower(username), username LIMIT 20"
      )
      .all(like)
      .map((row) => ({
        username: row.username,
        avatarDef: this._parseAvatarDef(row.avatarDef),
        mood: row.mood
      }));
  }

  // ---- snapshot ----

  snapshot() {
    const users = {};
    const rows = this.db
      .prepare("SELECT username FROM users ORDER BY username")
      .all();
    for (const row of rows) {
      const profile = this.getProfile(row.username);
      delete profile.username;
      users[row.username] = profile;
    }
    return { users };
  }

  // ---- private helpers ----

  _assertUser(username) {
    if (!this.hasUser(username)) throwNotFound();
  }

  _parseAvatarDef(raw) {
    try {
      const parsed = JSON.parse(raw);
      return parsed === null || typeof parsed !== "object" ? {} : parsed;
    } catch {
      return {};
    }
  }

  _getInteractions(username) {
    return this.db
      .prepare("SELECT type, sender, ts FROM interactions WHERE username = ? ORDER BY id")
      .all(username)
      .map((row) => ({
        type: row.type,
        ts: row.ts,
        sender: row.sender || "guest"
      }));
  }

  _getFavoriteTargets(username) {
    return this.db
      .prepare(
        "SELECT target FROM favorites WHERE owner = ? ORDER BY target"
      )
      .all(username)
      .map((row) => row.target);
  }

  async _migrateFromJsonIfEmpty() {
    if (this.hasAnyUser()) return;
    if (!this.dataFile) return;
    let raw;
    try {
      raw = await fs.readFile(this.dataFile, "utf8");
    } catch (err) {
      if (err.code === "ENOENT") return;
      throw err;
    }
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return;
    }
    if (!parsed || typeof parsed.users !== "object" || parsed.users === null) return;

    this.db.exec("BEGIN");
    try {
      for (const [username, user] of Object.entries(parsed.users)) {
        if (!user || typeof user !== "object") continue;
        if (!USER_RE.test(username)) continue;
        this.db
          .prepare(
            "INSERT OR IGNORE INTO users(username, avatarDef, mood, tokenHash, passwordHash, createdAt) VALUES (?, ?, ?, ?, ?, ?)"
          )
          .run(
            username,
            JSON.stringify(user.avatarDef || {}),
            user.mood || DEFAULT_MOOD,
            String(user.tokenHash || ""),
            typeof user.passwordHash === "string" && user.passwordHash.length > 0 ? user.passwordHash : null,
            String(user.createdAt || new Date(0).toISOString())
          );
        const interactions = Array.isArray(user.interactions) ? user.interactions : [];
        for (const hit of interactions) {
          if (!hit || typeof hit !== "object") continue;
          this.db
            .prepare("INSERT OR IGNORE INTO interactions(username, type, sender, ts) VALUES (?, ?, ?, ?)")
            .run(
              username,
              String(hit.type || ""),
              typeof hit.sender === "string" && hit.sender.length > 0 ? hit.sender : "guest",
              typeof hit.ts === "number" ? hit.ts : Date.now()
            );
        }
        const favorites = Array.isArray(user.favorites) ? user.favorites : [];
        for (const target of favorites) {
          if (typeof target !== "string" || !USER_RE.test(target)) continue;
          this.db
            .prepare("INSERT OR IGNORE INTO favorites(owner, target) VALUES (?, ?)")
            .run(username, target);
        }
      }
      this.db.exec("COMMIT");
    } catch (err) {
      this.db.exec("ROLLBACK");
      throw err;
    }
  }

  hasAnyUser() {
    return Boolean(this.db.prepare("SELECT 1 AS x FROM users LIMIT 1").get());
  }
}

function throwNotFound() {
  throw new NotFoundError("Profile not found");
}