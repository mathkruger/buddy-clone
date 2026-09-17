import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Store } from "../src/repository/store.js";
import { createApp } from "../src/server.js";

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
  test("creates a profile, returns username + profile (no token), sets session", async () => {
    const res = await json("POST", "/api/profiles", {
      username: "Mario",
      avatarDef: { head: "cat", eyes: "heart" },
      password: PASSWORD
    });
    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.username, "mario");
    assert.equal("token" in body, false);
    assert.equal(body.profile.mood, "happy");
    assert.equal(body.profile.avatarDef.head, undefined);
    assert.equal(body.profile.avatarDef.eyes, "Eyes_Male");
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

  test("rejects a missing or non-object avatarDef", async () => {
    const noDef = await json("POST", "/api/profiles", { username: "nodef", password: PASSWORD });
    assert.equal(noDef.status, 400);
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

  test("returns the public profile to an authenticated caller", async () => {
    const { headers } = await createUser("wario");
    const res = await json("GET", "/api/profile/wario", undefined, headers);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.username, "wario");
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

describe("PUT /api/profile/:username", () => {
  test("updates avatar and mood as the owner", async () => {
    const { headers } = await createUser("luigi");
    const res = await json(
      "PUT",
      "/api/profile/luigi",
      { avatarDef: { head: "star", eyes: "wink" }, mood: "excited" },
      headers
    );
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.mood, "excited");
    assert.equal(body.avatarDef.head, undefined);
    assert.equal(body.avatarDef.eyes, "Eyes_Male");
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

describe("GET /api/search", () => {
  test("requires authentication", async () => {
    const res = await json("GET", "/api/search?q=BuB");
    assert.equal(res.status, 401);
  });

  test("matches usernames case-insensitively with avatar and mood", async () => {
    const { headers } = await createUser("Bubble", PASSWORD, { head: "star" });
    await createUser("bob");
    const res = await json("GET", "/api/search?q=BuB", undefined, headers);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.deepEqual(body.results.map((r) => r.username), ["bubble"]);
    assert.equal(body.results[0].avatarDef.head, undefined);
    assert.equal(typeof body.results[0].mood, "string");
  });

  test("returns an empty list when nothing matches", async () => {
    const { headers } = await createUser("bob2");
    const res = await json("GET", "/api/search?q=zzz", undefined, headers);
    const body = await res.json();
    assert.deepEqual(body.results, []);
  });

  test("returns an empty list for a blank query", async () => {
    const { headers } = await createUser("blanky");
    const res = await json("GET", "/api/search?q=%20%20", undefined, headers);
    const body = await res.json();
    assert.deepEqual(body.results, []);
  });

  test("does not echo a scripty query back as HTML", async () => {
    const { headers } = await createUser("scripty");
    const res = await json(
      "GET",
      `/api/search?q=${encodeURIComponent("<script>alert(1)</script>")}`,
      undefined,
      headers
    );
    assert.equal(res.status, 200);
    assert.doesNotMatch(await res.text(), /<script>alert/);
  });
});

describe("favorites API", () => {
  test("requires a session for viewing", async () => {
    const noAuth = await json("GET", "/api/profile/fav-owner/favorites");
    assert.equal(noAuth.status, 401);
  });

  test("adds, dedupes, and removes favorites as the owner", async () => {
    const owner = await createUser("fav-a");
    await createUser("fav-b");

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
      { target: "fav-b" },
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
  test("profile shell embeds inert inline JSON", async () => {
    const { headers } = await createUser("yoshi");
    const res = await json("GET", "/yoshi", undefined, headers);
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.match(html, /"username":"yoshi"/);
    assert.match(html, /<script type="application\/json" id="buddy-profile">/);
    const jsonMatch = html.match(
      /<script type="application\/json" id="buddy-profile">([\s\S]*?)<\/script>/
    );
    assert.ok(jsonMatch, "inline JSON payload present");
    const payload = jsonMatch[1];
    assert.doesNotMatch(payload, /[<>]/, "inline JSON angle brackets escaped (inert)");
    assert.equal(JSON.parse(payload).username, "yoshi");
  });

  test("404 page escapes malicious usernames", async () => {
    const { headers } = await createUser("xsshunter");
    const res = await json(
      "GET",
      `/${encodeURIComponent("<script>alert(1)</script>")}`,
      undefined,
      headers
    );
    assert.equal(res.status, 404);
    const html = await res.text();
    assert.doesNotMatch(html, /<script>alert/);
    assert.match(html, /&lt;script&gt;/);
  });

  test("root serves the landing page with the three entry points", async () => {
    const res = await fetch(`${baseUrl}/`);
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.match(html, /class="entry-grid"/);
    assert.match(html, /href="\/create"/);
    assert.match(html, /href="\/login"/);
    assert.match(html, /href="\/search"/);
  });

  test("/create serves the avatar builder with a password field", async () => {
    const res = await fetch(`${baseUrl}/create`);
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.match(html, /id="builder-preview"/);
    assert.match(html, /id="password"/);
    assert.match(html, /builder\.js/);
  });

  test("login page serves 200 and shows a password form", async () => {
    const res = await fetch(`${baseUrl}/login`);
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.match(html, /id="login-password"/);
    assert.match(html, /\/api\/auth\/login|login\.js/);
  });

  test("login page redirects an authenticated visitor to their own profile", async () => {
    const { headers } = await createUser("redirme");
    const res = await fetch(`${baseUrl}/login`, { headers, redirect: "manual" });
    assert.equal(res.status, 302);
    assert.equal(res.headers.get("location"), "/redirme");
  });

  test("search, favorites and profile pages redirect anonymous visitors to login", async () => {
    const profile = await fetch(`${baseUrl}/yoshi`, { redirect: "manual" });
    assert.equal(profile.status, 302);
    assert.equal(profile.headers.get("location"), "/login");
    assert.equal((await fetch(`${baseUrl}/search`, { redirect: "manual" })).status, 302);
    assert.equal((await fetch(`${baseUrl}/favorites`, { redirect: "manual" })).status, 302);
  });

  test("search and favorites pages serve 200 when authenticated", async () => {
    const { headers } = await createUser("pagesdave");
    const search = await json("GET", "/search", undefined, headers);
    assert.equal(search.status, 200);
    const favorites = await json("GET", "/favorites", undefined, headers);
    assert.equal(favorites.status, 200);
  });

  test("new pages include the site nav and session script", async () => {
    const { headers } = await createUser("pagesnav");
    for (const page of ["/", "/create", "/login", "/search", "/favorites", "/pagesnav"]) {
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
    for (const page of ["/", "/create", "/login"]) {
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