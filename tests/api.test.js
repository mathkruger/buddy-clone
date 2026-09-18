import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Store } from "../src/repository/store.js";
import { createApp } from "../src/server.js";
import { defaultComposition, HAIR_OPTIONS } from "../src/public/avatar.js";

let baseUrl;
let server;
let store;
let dbPath;

async function setup() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "buddy-api-"));
  dbPath = path.join(dir, "test.db");
  store = new Store(dbPath);
  await store.init();
  const app = createApp(store);
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
}

async function teardown() {
  await new Promise((resolve) => server.close(resolve));
}

before(setup);
after(teardown);

const PASSWORD = "correct-horse-42";

// JSON helper; `headers` is merged over the defaults so tests can send the
// session cookie (or an Authorization header) where the API requires it.
function json(method, url, body, headers = {}) {
  return fetch(`${baseUrl}${url}`, {
    method,
    headers: body !== undefined ? { "Content-Type": "application/json", ...headers } : headers,
    body: body !== undefined ? JSON.stringify(body) : undefined
  });
}

// The `buddy_token` cookie minted on signup/login, as a Cookie header string.
function sessionHeader(res) {
  const cookie = res.headers.getSetCookie()?.[0] ?? res.headers.get("set-cookie");
  if (!cookie) return null;
  return { Cookie: cookie.split(";")[0] };
}

// Create a user and hand back { username, headers } where `headers` carries the
// auto-login session cookie from the create response.
async function createUser(username, password = PASSWORD, avatarDef = {}) {
  const res = await json("POST", "/api/profiles", { username, avatarDef, password });
  assert.equal(res.status, 201, `create ${username}`);
  return { username: username.toLowerCase(), headers: sessionHeader(res), res };
}

describe("security headers", () => {
  test("CSP restricts frame-ancestors on pages", async () => {
    const res = await json("GET", "/");
    const csp = res.headers.get("content-security-policy");
    assert.match(csp, /script-src 'self'/);
    assert.match(csp, /frame-ancestors 'self'/);
    assert.equal(res.headers.get("x-content-type-options"), "nosniff");
  });

  test("embed endpoint allows any frame ancestor", async () => {
    await createUser("cspcheck");
    const res = await fetch(`${baseUrl}/embed/cspcheck`);
    assert.match(res.headers.get("content-security-policy"), /frame-ancestors \*/);
  });
});

describe("auth / api/auth", () => {
  test("login succeeds and sets an HttpOnly buddy_token cookie", async () => {
    const { username } = await createUser("authbob");
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password: PASSWORD })
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.deepEqual(body, { user: { username } });
    assert.match(res.headers.get("set-cookie"), /buddy_token=/i);
    assert.match(res.headers.get("set-cookie"), /HttpOnly/i);
    assert.match(res.headers.get("set-cookie"), /SameSite=Lax/i);
  });

  test("unknown user and wrong password both get the same generic 401", async () => {
    await createUser("authcarol");
    const wrong = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "authcarol", password: "nope-nogo" })
    });
    assert.equal(wrong.status, 401);
    const wrongBody = await wrong.json();
    assert.equal(wrongBody.error, "Invalid username or password");

    const missing = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "nobody-here", password: PASSWORD })
    });
    assert.equal(missing.status, 401);
    assert.deepEqual(await missing.json(), wrongBody);
  });

  test("auth/me reports the session owner or null", async () => {
    const anon = await json("GET", "/api/auth/me");
    assert.deepEqual(await anon.json(), { user: null });

    const { username, headers } = await createUser("authdave");
    const me = await json("GET", "/api/auth/me", undefined, headers);
    assert.deepEqual(await me.json(), { user: { username } });
  });

  test("logout clears the session cookie", async () => {
    const { headers } = await createUser("authev");
    const out = await json("POST", "/api/auth/logout", undefined, headers);
    assert.equal(out.status, 204);
    assert.match(out.headers.get("set-cookie"), /buddy_token=;/i);
    const cleared = { Cookie: out.headers.getSetCookie()[0].split(";")[0] };
    const me = await json("GET", "/api/auth/me", undefined, cleared);
    assert.deepEqual(await me.json(), { user: null });
  });

  test("a Bearer token works as an alternative to the cookie", async () => {
    const { username } = await createUser("authfrank");
    const login = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password: PASSWORD })
    });
    const jwt = login.headers.get("set-cookie").split(";")[0].split("=")[1];
    const res = await json("GET", "/api/auth/me", undefined, {
      Authorization: `Bearer ${jwt}`
    });
    assert.deepEqual(await res.json(), { user: { username } });
  });
});

describe("POST /api/profiles", () => {
  test("creates a profile with just username+password, defaults the look, sets session", async () => {
    const res = await json("POST", "/api/profiles", {
      username: "Mario",
      password: PASSWORD
    });
    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.username, "mario");
    assert.equal(body.profile.username, "mario");
    assert.equal(body.profile.mood, null);
    assert.deepEqual(body.profile.avatarDef, defaultComposition());
    assert.equal(body.profile.avatarDef.hair, HAIR_OPTIONS[0]);
    assert.equal(body.profile.avatarDef.eyes, "Eyes_Male");
    assert.equal(body.profile.avatarDef.mouth, "smile");
    assert.equal(body.profile.avatarDef.props, "none");
    assert.equal(body.profile.avatarDef.skirt, "SkrtNone");
    assert.equal("token" in body, false);
    assert.match(res.headers.get("set-cookie"), /buddy_token=/i);
  });

  test("rejects an invalid username", async () => {
    for (const bad of ["", "  ", "a b", "a@b", "x".repeat(25), "<script>"]) {
      const res = await json("POST", "/api/profiles", {
        username: bad,
        avatarDef: {},
        password: PASSWORD
      });
      assert.equal(res.status, 400, `expected 400 for "${bad}"`);
    }
  });

  test("rejects a duplicate username", async () => {
    await createUser("dup");
    const dup = await json("POST", "/api/profiles", {
      username: "DUP",
      avatarDef: {},
      password: PASSWORD
    });
    assert.equal(dup.status, 409);
  });

  test("rejects a missing, short, or non-string password", async () => {
    await createUser("pwuser");
    const short = await json("POST", "/api/profiles", {
      username: "pwshort",
      avatarDef: {},
      password: "1234567"
    });
    assert.equal(short.status, 400);

    const missing = await json("POST", "/api/profiles", { username: "pwmiss", avatarDef: {} });
    assert.equal(missing.status, 400);

    const nonString = await json("POST", "/api/profiles", {
      username: "pwnum",
      avatarDef: {},
      password: 12345678
    });
    assert.equal(nonString.status, 400);
  });

  test("rejects a non-object avatarDef", async () => {
    const arrDef = await json("POST", "/api/profiles", {
      username: "arrdef",
      avatarDef: [],
      password: PASSWORD
    });
    assert.equal(arrDef.status, 400);
  });

  test("rejects creation while already logged in", async () => {
    const { headers } = await createUser("loggedin");
    const res = await json(
      "POST",
      "/api/profiles",
      { username: "shouldfail", avatarDef: {}, password: PASSWORD },
      headers
    );
    assert.equal(res.status, 403);
  });
});

describe("GET /api/profile/:username", () => {
  test("requires authentication", async () => {
    const res = await json("GET", "/api/profile/pwuser");
    assert.equal(res.status, 401);
  });

  test("returns the full profile to an authenticated caller", async () => {
    const { headers } = await createUser("wario");
    const res = await json("GET", "/api/profile/wario", undefined, headers);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.username, "wario");
    assert.equal(body.mood, null);
    assert.deepEqual(body.avatarDef, defaultComposition());
    assert.deepEqual(body.interactions, []);
    assert.deepEqual(body.interactionCounts, {});
    assert.equal(body.interactionTotal, 0);
    assert.equal(typeof body.createdAt, "string");
    assert.equal("tokenHash" in body, false);
    assert.equal("token" in body, false);
    assert.equal("passwordHash" in body, false);
  });

  test("404 for unknown usernames", async () => {
    const { headers } = await createUser("ghoster");
    const res = await json("GET", "/api/profile/ghost", undefined, headers);
    assert.equal(res.status, 404);
  });
});

describe("GET /api/profile/:username/public", () => {
  test("requires authentication", async () => {
    const res = await json("GET", "/api/profile/bunny/public");
    assert.equal(res.status, 401);
  });

  test("returns exactly { username, avatarDef, mood } to an authenticated caller", async () => {
    await createUser("bunny");
    const { headers } = await createUser("previewer");
    const res = await json("GET", "/api/profile/bunny/public", undefined, headers);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.deepEqual(Object.keys(body).sort(), ["avatarDef", "mood", "username"]);
    assert.equal(body.username, "bunny");
    assert.equal(body.mood, null);
    assert.deepEqual(body.avatarDef, defaultComposition());
  });

  test("404 for unknown usernames", async () => {
    const { headers } = await createUser("ghostpvt");
    const res = await json("GET", "/api/profile/ghost/public", undefined, headers);
    assert.equal(res.status, 404);
  });
});

describe("PUT /api/profile/:username", () => {
  test("sets and clears the mood as the owner", async () => {
    const { headers } = await createUser("moodsetter");
    const none = await json("PUT", "/api/profile/moodsetter", { mood: "none" }, headers);
    assert.equal(none.status, 200);
    assert.equal((await none.json()).mood, null);

    const happy = await json("PUT", "/api/profile/moodsetter", { mood: "happy" }, headers);
    assert.equal(happy.status, 200);
    assert.equal((await happy.json()).mood, "happy");
  });

  test("updates avatar with a mutation as the owner", async () => {
    const { headers } = await createUser("lookchanger");
    const res = await json(
      "PUT",
      "/api/profile/lookchanger",
      { avatarDef: { eyes: "Eyes_Fem" } },
      headers
    );
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.avatarDef.eyes, "Eyes_Fem");
    assert.equal(body.avatarDef.hair, HAIR_OPTIONS[0]);
    assert.equal(body.mood, null);
  });

  test("401 without a session", async () => {
    const res = await json("PUT", "/api/profile/luigi", { mood: "sad" });
    assert.equal(res.status, 401);
  });

  test("403 when a different user tries to edit someone else's profile", async () => {
    await createUser("broluigi");
    const { headers } = await createUser("mariow");
    const res = await json("PUT", "/api/profile/broluigi", { mood: "sad" }, headers);
    assert.equal(res.status, 403);
  });

  test("404 when the targeted profile no longer exists", async () => {
    const { headers } = await createUser("doomed");
    store._backend.db.prepare("DELETE FROM users WHERE username = ?").run("doomed");
    const res = await json("PUT", "/api/profile/doomed", { mood: "sad" }, headers);
    assert.equal(res.status, 404);
  });

  test("400 for invalid mood, avatar shape, or empty patch", async () => {
    const { headers } = await createUser("peach");
    const badMood = await json("PUT", "/api/profile/peach", { mood: "turbo" }, headers);
    assert.equal(badMood.status, 400);
    const badAvatar = await json("PUT", "/api/profile/peach", { avatarDef: [] }, headers);
    assert.equal(badAvatar.status, 400);
    const empty = await json("PUT", "/api/profile/peach", {}, headers);
    assert.equal(empty.status, 400);
  });
});

describe("POST /api/profile/:username/interactions", () => {
  test("requires authentication", async () => {
    const res = await json("POST", "/api/profile/toad/interactions", { type: "poke" });
    assert.equal(res.status, 401);
  });

  test("records an interaction and bumps counts", async () => {
    const target = await createUser("toad");
    const { headers } = await createUser("poker");
    const res = await json("POST", "/api/profile/toad/interactions", { type: "poke" }, headers);
    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.profile.interactionTotal, 1);
    assert.deepEqual(body.profile.interactionCounts, { poke: 1 });

    const fetched = await json("GET", "/api/profile/toad", undefined, headers);
    const profile = await fetched.json();
    assert.deepEqual(profile.interactions.at(-1), { sender: "poker", type: "poke", ts: profile.interactions.at(-1).ts });
    assert.equal(typeof profile.interactions.at(-1).ts, "number");
  });

  test("rejects empty, oversized, or non-string types", async () => {
    const { headers } = await createUser("toad2");
    const tooLong = await json(
      "POST",
      "/api/profile/toad2/interactions",
      { type: "x".repeat(65) },
      headers
    );
    assert.equal(tooLong.status, 400);
    const missing = await json("POST", "/api/profile/toad2/interactions", {}, headers);
    assert.equal(missing.status, 400);
    const numeric = await json("POST", "/api/profile/toad2/interactions", { type: 42 }, headers);
    assert.equal(numeric.status, 400);
  });

  test("404 for unknown usernames", async () => {
    const { headers } = await createUser("ghostpoke");
    const res = await json("POST", "/api/profile/ghost/interactions", { type: "poke" }, headers);
    assert.equal(res.status, 404);
  });

  test("rejects poking your own profile with 400 and records nothing", async () => {
    const { username, headers } = await createUser("selfpoke");
    const before = await json("GET", `/api/profile/${username}`, undefined, headers);
    assert.equal(before.status, 200);
    assert.equal((await before.json()).interactionTotal, 0);

    const res = await json(
      "POST",
      `/api/profile/${username}/interactions`,
      { type: "poke" },
      headers
    );
    assert.equal(res.status, 400);
    assert.equal((await res.json()).error, "You cannot poke your own buddy");

    const after = await json("GET", `/api/profile/${username}`, undefined, headers);
    assert.equal(after.status, 200);
    const body = await after.json();
    assert.equal(body.interactionTotal, 0);
    assert.deepEqual(body.interactions, []);
  });
});

describe("interaction sender attribution", () => {
  test("sender is taken from the session, even if a fake sender is claimed", async () => {
    await createUser("target-b");
    const { headers } = await createUser("sender-a");
    const res = await json(
      "POST",
      "/api/profile/target-b/interactions",
      { type: "poke", from: "victim", token: "0".repeat(32) },
      headers
    );
    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.profile.interactions.at(-1).sender, "sender-a");
  });

  test("anonymous visitors cannot poke (no guest fallback anymore)", async () => {
    const res = await json("POST", "/api/profile/target-b/interactions", { type: "poke" });
    assert.equal(res.status, 401);
  });

  test("legacy interactions without a sender normalize to guest", async () => {
    const { headers } = await createUser("legacy-api");
    store._backend.db
      .prepare("INSERT INTO interactions(username, type, ts) VALUES (?, 'poke', ?)")
      .run("legacy-api", Date.now());
    const res = await json("GET", "/api/profile/legacy-api", undefined, headers);
    assert.equal(res.status, 200);
    const profile = await res.json();
    assert.equal(profile.interactions[0].sender, "guest");
  });
});

describe("removed surface", () => {
  test("GET /api/search is gone (404, no route)", async () => {
    const { headers } = await createUser("nosearch");
    const anon = await json("GET", "/api/search?q=bu");
    assert.equal(anon.status, 404);
    const authed = await json("GET", "/api/search?q=bu", undefined, headers);
    assert.equal(authed.status, 404);
  });

  test("removed page routes 301 to their replacements", async () => {
    const create = await fetch(`${baseUrl}/create`, { redirect: "manual" });
    assert.equal(create.status, 301);
    assert.equal(create.headers.get("location"), "/register");

    const search = await fetch(`${baseUrl}/search`, { redirect: "manual" });
    assert.equal(search.status, 301);
    assert.equal(search.headers.get("location"), "/");

    const profile = await fetch(`${baseUrl}/bunny`, { redirect: "manual" });
    assert.equal(profile.status, 301);
    assert.equal(profile.headers.get("location"), "/play");
  });
});

describe("favorites API", () => {
  test("requires a session for viewing", async () => {
    const noAuth = await json("GET", "/api/profile/fav-owner/favorites");
    assert.equal(noAuth.status, 401);
  });

  test("adds, dedupes (case-normalized), and removes favorites as the owner", async () => {
    const owner = await createUser("fav-a");
    await createUser("fav-b");

    const initial = await json("GET", "/api/profile/fav-a/favorites", undefined, owner.headers);
    assert.equal(initial.status, 200);
    assert.deepEqual((await initial.json()).favorites, []);

    const add = await json(
      "PUT",
      "/api/profile/fav-a/favorites",
      { target: "fav-b" },
      owner.headers
    );
    assert.equal(add.status, 200);
    assert.deepEqual((await add.json()).favorites.map((f) => f.username), ["fav-b"]);

    const dup = await json(
      "PUT",
      "/api/profile/fav-a/favorites",
      { target: "FAV-B" },
      owner.headers
    );
    assert.deepEqual((await dup.json()).favorites.map((f) => f.username), ["fav-b"]);

    const del = await json(
      "DELETE",
      "/api/profile/fav-a/favorites",
      { target: "fav-b" },
      owner.headers
    );
    assert.equal(del.status, 200);
    assert.deepEqual((await del.json()).favorites, []);
  });

  test("rejects adding yourself as a favorite", async () => {
    const { username, headers } = await createUser("fav-self");
    const res = await json(
      "PUT",
      "/api/profile/fav-self/favorites",
      { target: username },
      headers
    );
    assert.equal(res.status, 400);
  });

  test("rejects favorites with a missing or unknown target", async () => {
    const owner = await createUser("fav-c");
    const missing = await json("PUT", "/api/profile/fav-c/favorites", {}, owner.headers);
    assert.equal(missing.status, 400);
    const unknown = await json(
      "PUT",
      "/api/profile/fav-c/favorites",
      { target: "nobody" },
      owner.headers
    );
    assert.equal(unknown.status, 404);
    const delUnknown = await json(
      "DELETE",
      "/api/profile/fav-c/favorites",
      { target: "nobody" },
      owner.headers
    );
    assert.equal(delUnknown.status, 404);
  });

  test("rejects non-owner and unauthenticated mutations", async () => {
    const dave = await createUser("fav-d");
    await createUser("fav-e");
    const other = await createUser("fav-other");

    const anon = await json("PUT", "/api/profile/fav-d/favorites", { target: "fav-e" });
    assert.equal(anon.status, 401);

    const nonOwner = await json(
      "PUT",
      "/api/profile/fav-d/favorites",
      { target: "fav-e" },
      other.headers
    );
    assert.equal(nonOwner.status, 403);

    const stillEmpty = await json(
      "GET",
      "/api/profile/fav-d/favorites",
      undefined,
      dave.headers
    );
    assert.deepEqual((await stillEmpty.json()).favorites, []);
  });

  test("drops profiles that no longer exist from the resolved list", async () => {
    const owner = await createUser("fav-f");
    await createUser("fav-g");
    await json("PUT", "/api/profile/fav-f/favorites", { target: "fav-g" }, owner.headers);

    store._backend.db.prepare("DELETE FROM users WHERE username = ?").run("fav-g");
    const reloaded = new Store(dbPath);
    await reloaded.init();
    const app2 = createApp(reloaded);
    const server2 = http.createServer(app2);
    await new Promise((resolve) => server2.listen(0, resolve));
    try {
      const base = `http://127.0.0.1:${server2.address().port}`;
      const res = await fetch(`${base}/api/profile/fav-f/favorites`, { headers: owner.headers });
      assert.equal(res.status, 200);
      assert.deepEqual((await res.json()).favorites, []);
    } finally {
      await new Promise((resolve) => server2.close(resolve));
    }
  });
});

describe("pages", () => {
  test("register page serves 200 with username and password fields", async () => {
    const res = await fetch(`${baseUrl}/register`);
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.match(html, /id="register-username"/);
    assert.match(html, /id="register-password"/);
    assert.match(html, /register\.js/);
  });

  test("play screen serves 200 with the stage, four tabs, and inert inline JSON", async () => {
    const { headers } = await createUser("yoshi");
    const res = await json("GET", "/play", undefined, headers);
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.match(html, /id="play-stage"/);
    for (const tab of ["clone", "friends", "humor", "appearance"]) {
      assert.match(html, new RegExp(`data-tab="${tab}"`), `missing ${tab} tab`);
    }
    assert.match(html, /<script type="application\/json" id="buddy-profile">/);
    assert.match(html, /play\.js/);
    const jsonMatch = html.match(
      /<script type="application\/json" id="buddy-profile">([\s\S]*?)<\/script>/
    );
    assert.ok(jsonMatch, "inline JSON payload present");
    const payload = jsonMatch[1];
    assert.doesNotMatch(payload, /[<>]/, "inline JSON angle brackets escaped (inert)");
    assert.equal(JSON.parse(payload).username, "yoshi");
  });

  test("play screen redirects anonymous visitors to login", async () => {
    const res = await fetch(`${baseUrl}/play`, { redirect: "manual" });
    assert.equal(res.status, 302);
    assert.equal(res.headers.get("location"), "/login");
  });

  test("embed 404 page escapes malicious usernames", async () => {
    const res = await fetch(
      `${baseUrl}/embed/${encodeURIComponent("<script>alert(1)</script>")}`
    );
    assert.equal(res.status, 404);
    const html = await res.text();
    assert.doesNotMatch(html, /<script>alert/);
    assert.match(html, /&lt;script&gt;/);
  });

  test("root serves the landing page with register/login CTAs and no removed links", async () => {
    const res = await fetch(`${baseUrl}/`);
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.match(html, /class="entry-grid"/);
    assert.match(html, /href="\/register"/);
    assert.match(html, /href="\/login"/);
    assert.doesNotMatch(html, /href="\/create"/);
    assert.doesNotMatch(html, /href="\/search"/);
  });

  test("login page serves 200 and shows a password form", async () => {
    const res = await fetch(`${baseUrl}/login`);
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.match(html, /id="login-password"/);
    assert.match(html, /\/api\/auth\/login|login\.js/);
  });

  test("login page redirects an authenticated visitor to /play", async () => {
    const { headers } = await createUser("redirme");
    const res = await fetch(`${baseUrl}/login`, { headers, redirect: "manual" });
    assert.equal(res.status, 302);
    assert.equal(res.headers.get("location"), "/play");
  });

  test("new pages include the site nav and session script", async () => {
    const { headers } = await createUser("pagesnav");
    for (const page of ["/", "/register", "/login", "/play"]) {
      const res = await fetch(`${baseUrl}${page}`, { headers });
      const html = await res.text();
      assert.match(html, /id="nav-auth"/, `${page} should include the nav slot`);
      assert.match(html, /session\.js/, `${page} should load the session script`);
    }
  });
});

describe("3D renderer assets", () => {
  const ASSETS = [
    ["/buddy-3d.js", "js"],
    ["/vendor/three/three.module.js", "js"],
  ];

  for (const [url, kind] of ASSETS) {
    test(`serves ${url} with HTTP 200`, async () => {
      const res = await fetch(`${baseUrl}${url}`);
      assert.equal(res.status, 200);
      const body = await res.arrayBuffer();
      assert.ok(body.byteLength > 0, `${url} should not be empty`);
    });
  }

  test("every page body includes the three import map", async () => {
    for (const page of ["/", "/register", "/login"]) {
      const res = await fetch(`${baseUrl}${page}`);
      assert.equal(res.status, 200);
      const html = await res.text();
      assert.match(
        html,
        /<script type="importmap">[\s\S]*"three"\s*:\s*"\/vendor\/three\/three\.module\.js"/,
        `${page} should include the import map`
      );
    }
  });

  test("buddy-3d.js is an ES module importing three", async () => {
    const res = await fetch(`${baseUrl}/buddy-3d.js`);
    const code = await res.text();
    assert.match(code, /from "three"/);
    assert.match(code, /export async function mountAvatar/);
    assert.match(code, /export function mountWhenVisible|export async function mountWhenVisible/);
  });
});