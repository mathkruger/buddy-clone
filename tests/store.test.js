import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  Store,
  DuplicateUsernameError,
  ValidationError,
  NotFoundError,
  hashToken,
  INTERACTION_LIMIT
} from "../src/repository/store.js";

let dbPath;
let store;

beforeEach(async () => {
  dbPath = path.join(await fs.mkdtemp(path.join(os.tmpdir(), "buddy-store-")), "test.db");
  store = new Store(dbPath);
  await store.init();
});

function sampleAvatar() {
  return { head: "cat", eyes: "dot", mouth: "smile", accessory: "crown", colors: { skin: "#ffcea5" } };
}

describe("Store init", () => {
  test("initializes an empty database on first init", async () => {
    assert.deepEqual(await store.snapshot(), { users: {} });
  });

  test("rejects reads before init", async () => {
    const fresh = new Store(path.join(path.dirname(dbPath), "other.db"));
    assert.throws(() => fresh.getProfile("nope"), /not initialized/);
  });

  test("loads an existing database in the same shape", async () => {
    await store.createProfile("alice", { head: "round" }, "hash-a");
    const reloaded = new Store(dbPath);
    await reloaded.init();
    assert.equal(reloaded.hasUser("alice"), true);
    assert.equal(reloaded.getProfile("alice").avatarDef.head, "round");
  });
});

describe("createProfile", () => {
  test("returns the username, mints no claim token, and accepts a password hash", async () => {
    const result = await store.createProfile("ada-love", sampleAvatar(), "$2b$12$fakehash");
    assert.deepEqual(result, { username: "ada-love" });
    const row = store._backend.getProfile("ada-love");
    assert.equal(row.passwordHash, "$2b$12$fakehash");
    assert.equal(row.tokenHash, "");
    assert.equal("token" in row, false);
  });

  test("defaults mood and starts with empty history", async () => {
    await store.createProfile("bob", {});
    const profile = store.getProfile("bob");
    assert.equal(profile.mood, null);
    assert.deepEqual(profile.interactions, []);
    assert.equal(profile.interactionTotal, 0);
    assert.deepEqual(profile.interactionCounts, {});
  });

  test("stores no password hash when created without one", async () => {
    await store.createProfile("legacy-new", {});
    assert.equal(store.getPasswordHash("legacy-new"), null);
  });

  test("rejects a duplicate username", async () => {
    await store.createProfile("carol", sampleAvatar(), "hash-c");
    await assert.rejects(() => store.createProfile("carol", {}, "hash-d"), DuplicateUsernameError);
  });

  test("is case-sensitive (normalization happens in the API layer)", async () => {
    await store.createProfile("MiXeD", {});
    assert.equal(store.hasUser("MiXeD"), true);
    assert.equal(store.hasUser("mixed"), false);
  });
});

describe("getPasswordHash", () => {
  test("returns the stored bcrypt hash and null for hash-less profiles", async () => {
    await store.createProfile("hashy", {}, "$2b$12$bcrypt-value");
    await store.createProfile("plain", {});
    assert.equal(store.getPasswordHash("hashy"), "$2b$12$bcrypt-value");
    assert.equal(store.getPasswordHash("plain"), null);
    assert.equal(store.getPasswordHash("ghost"), null);
  });
});

describe("updateProfile", () => {
  test("persists avatar and mood changes without any token", async () => {
    await store.createProfile("dave", sampleAvatar(), "hash-d");
    await store.updateProfile("dave", { avatarDef: { head: "star" }, mood: "excited" });
    const profile = store.getProfile("dave");
    assert.equal(profile.avatarDef.head, "star");
    assert.equal(profile.mood, "excited");
  });

  test("rejects updates to unknown usernames", async () => {
    await assert.rejects(
      () => store.updateProfile("ghost", { mood: "sad" }),
      NotFoundError
    );
  });

  test("rejects invalid moods", async () => {
    await store.createProfile("finn", {});
    await assert.rejects(
      () => store.updateProfile("finn", { mood: "turbo" }),
      ValidationError
    );
  });

  test("writes a null mood through (cleared humor)", async () => {
    await store.createProfile("eve", {});
    await store.updateProfile("eve", { mood: "sad" });
    const cleared = await store.updateProfile("eve", { mood: null });
    assert.equal(cleared.mood, null);
    assert.equal(store.getProfile("eve").mood, null);
  });

  test("rejects an empty update", async () => {
    await store.createProfile("gina", {});
    const before = store.getProfile("gina");
    const after = await store.updateProfile("gina", {});
    assert.deepEqual(after, before);
  });
});

describe("addInteraction", () => {
  test("appends types and computes counts", async () => {
    await store.createProfile("hugo", {});
    await store.addInteraction("hugo", "poke");
    await store.addInteraction("hugo", "hug");
    await store.addInteraction("hugo", "poke");
    const profile = store.getProfile("hugo");
    assert.equal(profile.interactionTotal, 3);
    assert.deepEqual(profile.interactionCounts, { poke: 2, hug: 1 });
    assert.deepEqual(
      profile.interactions.map((i) => i.type),
      ["poke", "hug", "poke"]
    );
    assert.equal(typeof profile.interactions[0].ts, "number");
  });

  test("records the given sender and defaults to guest", async () => {
    await store.createProfile("iris", {});
    await store.addInteraction("iris", "poke");
    await store.addInteraction("iris", "hug", "guest");
    await store.addInteraction("iris", "poke", "mel");
    const profile = store.getProfile("iris");
    assert.deepEqual(
      profile.interactions.map((i) => i.sender),
      ["guest", "guest", "mel"]
    );
  });

  test("rejects interaction on an unknown user", async () => {
    await assert.rejects(() => store.addInteraction("ghost", "poke"), NotFoundError);
  });

  test("trims history beyond the limit", async () => {
    await store.createProfile("iris", {});
    for (let i = 0; i < INTERACTION_LIMIT + 7; i++) {
      await store.addInteraction("iris", `poke${i}`);
    }
    const profile = store.getProfile("iris");
    assert.equal(profile.interactions.length, INTERACTION_LIMIT);
    assert.equal(profile.interactions[0].type, "poke7");
  });
});

describe("favorites", () => {
  test("new profiles start with an empty favorites list", async () => {
    const { username } = await store.createProfile("fav-owner", {});
    const snap = await store.snapshot();
    assert.deepEqual(snap.users[username].favorites, []);
  });

  test("addFavorite records, dedupes, and getFavorites resolves summaries", async () => {
    await store.createProfile("fav-owner", { head: "star" });
    const { username: mate } = await store.createProfile("mate-a", { head: "round" });
    await store.createProfile("mate-b", { head: "heart" });

    assert.deepEqual(await store.getFavorites("fav-owner"), []);

    const first = await store.addFavorite("fav-owner", mate);
    assert.deepEqual(first.map((f) => f.username), [mate]);
    assert.deepEqual(first[0].avatarDef.head, "round");

    await store.addFavorite("fav-owner", mate);
    const afterDup = await store.getFavorites("fav-owner");
    assert.deepEqual(afterDup.map((f) => f.username), [mate]);
  });

  test("removeFavorite removes an existing favorite", async () => {
    await store.createProfile("fav-owner", {});
    const { username: mate } = await store.createProfile("mate-c", {});
    await store.addFavorite("fav-owner", mate);
    const after = await store.removeFavorite("fav-owner", mate);
    assert.deepEqual(after, []);
  });

  test("rejects favorites ops against unknown targets", async () => {
    await store.createProfile("fav-owner", {});
    await assert.rejects(() => store.addFavorite("fav-owner", "nobody"), NotFoundError);
    await assert.rejects(() => store.removeFavorite("fav-owner", "nobody"), NotFoundError);
  });

  test("rejects favorites ops against unknown owners", async () => {
    await assert.rejects(() => store.getFavorites("ghost"), NotFoundError);
    await assert.rejects(() => store.addFavorite("ghost", "mate"), NotFoundError);
  });

  test("getFavorites drops profiles that no longer exist", async () => {
    await store.createProfile("fav-owner", {});
    const { username: mate } = await store.createProfile("mate-e", {});
    await store.addFavorite("fav-owner", mate);

    store._backend.db.prepare("DELETE FROM users WHERE username = ?").run(mate);

    const reloaded = new Store(dbPath);
    await reloaded.init();
    assert.deepEqual(await reloaded.getFavorites("fav-owner"), []);
  });
});

describe("legacy data", () => {
  test("migrates a legacy JSON file (token-hash only, no password) as inert", async () => {
    const dataFile = path.join(path.dirname(dbPath), "data.json");
    await fs.writeFile(
      dataFile,
      JSON.stringify({
        users: {
          legacy: {
            avatarDef: { head: "round" },
            mood: "happy",
            tokenHash: hashToken("x"),
            createdAt: "2020-01-01T00:00:00.000Z",
            interactions: [{ type: "poke", ts: 1 }]
          }
        }
      })
    );
    const migrated = new Store({ path: dbPath, dataFile });
    await migrated.init();
    const profile = migrated.getProfile("legacy");
    assert.equal(profile.interactions[0].sender, "guest");
    assert.equal(profile.interactionTotal, 1);
    assert.equal(migrated.getPasswordHash("legacy"), null);
    assert.equal(await fs.access(dataFile).then(() => true).catch(() => false), true);
  });

  test("does not re-import when the database already has users", async () => {
    const dataFile = path.join(path.dirname(dbPath), "data.json");
    await fs.writeFile(dataFile, JSON.stringify({
      users: {
        legacy: {
          avatarDef: { head: "round" },
          mood: "happy",
          tokenHash: hashToken("x"),
          createdAt: "2020-01-01T00:00:00.000Z",
          interactions: []
        }
      }
    }));
    const migrated = new Store({ path: dbPath, dataFile });
    await migrated.init();
    assert.equal(migrated.hasUser("legacy"), true);

    const modified = {
      users: {
        legacy: { avatarDef: {}, mood: "happy", tokenHash: hashToken("x"), createdAt: "2020-01-01T00:00:00.000Z", interactions: [] },
        brandnew: { avatarDef: {}, mood: "love", tokenHash: hashToken("y"), createdAt: "2020-02-01T00:00:00.000Z", interactions: [] }
      }
    };
    await fs.writeFile(dataFile, JSON.stringify(modified));

    const reloaded = new Store({ path: dbPath, dataFile });
    await reloaded.init();
    assert.equal(reloaded.hasUser("brandnew"), false);
    assert.equal(reloaded.hasUser("legacy"), true);
  });
});

describe("persistence and concurrency", () => {
  test("updates persist across reloads", async () => {
    await store.createProfile("jenna", {}, "hash-j");
    const reloaded = new Store(dbPath);
    await reloaded.init();
    await reloaded.updateProfile("jenna", { mood: "love" });
    assert.equal(reloaded.getProfile("jenna").mood, "love");
  });

  test("survives concurrent creation against the database", async () => {
    const results = await Promise.all(
      ["kate", "leo", "maya", "niko", "olga"].map((name) => store.createProfile(name, {}))
    );
    assert.equal(results.length, 5);
    for (const name of results.map((r) => r.username)) {
      assert.equal(store.hasUser(name), true);
    }
    const snap = await store.snapshot();
    assert.equal(Object.keys(snap.users).length, 5);
  });

  test("conserves early interactions when mixing many additions", async () => {
    await store.createProfile("paula", {});
    for (let i = 0; i < 3; i++) await store.addInteraction("paula", "poke");
    await store.updateProfile("paula", { mood: "angry" });
    assert.equal(store.getProfile("paula").interactionTotal, 3);
  });
});