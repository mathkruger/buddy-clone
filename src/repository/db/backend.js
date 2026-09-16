import { SqliteBackend } from "./sqlite.js";

function unknownProvider(provider) {
  return new Error(`Unknown storage provider "${provider}"`);
}

// Contract for a storage backend. Implementations expose the repository's
// data operations; `Store` stays the facade that adds validation, error
// mapping, sender resolution, and profile projection.
//
//   init()                       - create tables, run first-run migration
//   getProfile(username)         - full row or null
//   hasUser(username)            - boolean
//   createProfile(username, { avatarDef, mood, tokenHash, passwordHash, createdAt })
//   updateProfile(username, { avatarDef?, mood? }, tokenHash)
//   addInteraction(username, type, sender)
//   getFavorites(username)       - raw target usernames
//   addFavorite(username, target)
//   removeFavorite(username, target)
//   searchProfiles(query)        - [{ username, avatarDef, mood }] capped at 20
//   snapshot()                   - full { users: {...} } shape
export class StorageBackend {
  constructor(config) {
    this.config = config;
  }

  async init() {
    throw new Error("StorageBackend.init() not implemented");
  }
}

export function openDatabase({ provider = "sqlite", path, dataFile } = {}) {
  if (provider === "sqlite") {
    return new SqliteBackend({ path, dataFile });
  }
  throw unknownProvider(provider);
}