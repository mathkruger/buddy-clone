import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SERVER = path.join(ROOT, "src", "server.js");
const DEV_DB = path.join(ROOT, "data.db");

let baseUrl;
let child;
let smokeDir;
let devDbBefore;

async function freePort() {
  const server = net.createServer();
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

async function hashFile(filePath) {
  try {
    const data = await fs.readFile(filePath);
    return crypto.createHash("sha256").update(data).digest("hex");
  } catch (err) {
    if (err.code === "ENOENT") return null;
    throw err;
  }
}

function bootServer(env) {
  return new Promise((resolve, reject) => {
    const proc = spawn(process.execPath, [SERVER], {
      env: { ...process.env, ...env },
      stdio: ["ignore", "pipe", "pipe"]
    });
    let out = "";
    proc.stdout.on("data", (chunk) => {
      out += chunk;
      const match = out.match(/listening on http:\/\/localhost:(\d+)/);
      if (match) resolve({ proc, port: match[1] });
    });
    proc.on("error", reject);
    proc.on("exit", (code) => {
      reject(new Error(`server exited early (code ${code}): ${out}`));
    });
  });
}

before(async () => {
  devDbBefore = await hashFile(DEV_DB);
  smokeDir = await fs.mkdtemp(path.join(os.tmpdir(), "buddy-smoke-"));
  const dbPath = path.join(smokeDir, "smoke.db");
  const dataFile = path.join(smokeDir, "no-migration.json");
  const booted = await bootServer({ PORT: String(await freePort()), DB_PATH: dbPath, DATA_FILE: dataFile });
  child = booted.proc;
  baseUrl = `http://127.0.0.1:${booted.port}`;
});

after(async () => {
  child.kill();
  await new Promise((resolve) => child.once("exit", resolve));
  await fs.rm(smokeDir, { recursive: true, force: true });
  const devDbAfter = await hashFile(DEV_DB);
  assert.equal(
    devDbAfter,
    devDbBefore,
    "the default development database must not be modified by the smoke run"
  );
});

describe("isolated smoke test", () => {
  test("boots against a dedicated DB and exercises the final surface", async () => {
    const root = baseUrl;

    const rootRes = await fetch(`${root}/`);
    assert.equal(rootRes.status, 200);
    assert.match(rootRes.headers.get("content-security-policy"), /script-src 'self'/);
    assert.match(rootRes.headers.get("content-security-policy"), /frame-ancestors 'self'/);
    assert.equal(rootRes.headers.get("x-content-type-options"), "nosniff");
    const landing = await rootRes.text();
    assert.match(landing, /href="\/register"/);
    assert.match(landing, /href="\/login"/);
    assert.doesNotMatch(landing, /href="\/create"/);
    assert.doesNotMatch(landing, /href="\/search"/);

    for (const asset of ["/style.css", "/session.js"]) {
      const res = await fetch(`${root}${asset}`);
      assert.equal(res.status, 200, `${asset} should be served`);
    }

    const registerPage = await fetch(`${root}/register`);
    assert.equal(registerPage.status, 200);
    const registerHtml = await registerPage.text();
    assert.match(registerHtml, /id="register-username"/);
    assert.match(registerHtml, /id="register-password"/);

    const created = await fetch(`${root}/api/profiles`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "smokey", password: "pickle-123" })
    });
    assert.equal(created.status, 201);
    assert.equal((await created.json()).profile.mood, null);
    const cookie = created.headers.getSetCookie()[0].split(";")[0];

    for (const page of ["/register", "/login"]) {
      const res = await fetch(`${root}${page}`, {
        headers: { Cookie: cookie },
        redirect: "manual"
      });
      assert.equal(res.status, 302, `${page} should redirect a logged-in visitor`);
      assert.equal(res.headers.get("location"), "/play", page);
    }

    const playAnon = await fetch(`${root}/play`, { redirect: "manual" });
    assert.equal(playAnon.status, 302);
    assert.equal(playAnon.headers.get("location"), "/login");

    const play = await fetch(`${root}/play`, { headers: { Cookie: cookie } });
    assert.equal(play.status, 200);
    const playHtml = await play.text();
    assert.match(playHtml, /id="play-stage"/);
    for (const tab of ["clone", "friends", "humor", "appearance"]) {
      assert.match(playHtml, new RegExp(`data-tab="${tab}"`), `missing ${tab} tab`);
    }
    assert.match(playHtml, /id="buddy-profile"/);
    assert.match(playHtml, /play\.js/);
    assert.match(playHtml, /id="nav-auth"/);
    const jsonMatch = playHtml.match(
      /<script type="application\/json" id="buddy-profile">([\s\S]*?)<\/script>/
    );
    assert.ok(jsonMatch, "play payload present");
    assert.doesNotMatch(jsonMatch[1], /[<>]/, "inline JSON angle brackets escaped (inert)");
    const payload = JSON.parse(jsonMatch[1]);
    assert.equal(payload.username, "smokey");
    assert.equal(payload.mood, null);

    const favCreated = await fetch(`${root}/api/profiles`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "favme", password: "pickle-123" })
    });
    assert.equal(favCreated.status, 201);
    const favCookie = favCreated.headers.getSetCookie()[0].split(";")[0];

    const fav = await fetch(`${root}/api/profile/smokey/favorites`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ target: "favme" })
    });
    assert.equal(fav.status, 200);
    assert.deepEqual((await fav.json()).favorites.map((f) => f.username), ["favme"]);

    const poke = await fetch(`${root}/api/profile/smokey/interactions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: favCookie },
      body: JSON.stringify({ type: "poke" })
    });
    assert.equal(poke.status, 201);
    const feed = await fetch(`${root}/api/profile/smokey`, { headers: { Cookie: cookie } });
    assert.equal(feed.status, 200);
    const last = (await feed.json()).interactions.at(-1);
    assert.deepEqual(last, { sender: "favme", type: "poke", ts: last.ts });
    assert.equal(typeof last.ts, "number");

    const wrongLogin = await fetch(`${root}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "smokey", password: "wrong-pass" })
    });
    assert.equal(wrongLogin.status, 401);

    const login = await fetch(`${root}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "smokey", password: "pickle-123" })
    });
    assert.equal(login.status, 200);
    assert.deepEqual(await login.json(), { user: { username: "smokey" } });

    const logout = await fetch(`${root}/api/auth/logout`, {
      method: "POST",
      headers: { Cookie: cookie }
    });
    assert.equal(logout.status, 204);
    assert.deepEqual(await (await fetch(`${root}/api/auth/me`)).json(), { user: null });

    const create = await fetch(`${root}/create`, { redirect: "manual" });
    assert.equal(create.status, 301);
    assert.equal(create.headers.get("location"), "/register");
    const search = await fetch(`${root}/search`, { redirect: "manual" });
    assert.equal(search.status, 301);
    assert.equal(search.headers.get("location"), "/");
    const profile = await fetch(`${root}/smokey`, { redirect: "manual" });
    assert.equal(profile.status, 301);
    assert.equal(profile.headers.get("location"), "/play");

    const embed = await fetch(`${root}/embed/smokey`);
    assert.equal(embed.status, 200);
    assert.match(embed.headers.get("content-security-policy"), /frame-ancestors \*/);
    const embedHtml = await embed.text();
    const embedMatch = embedHtml.match(
      /<script type="application\/json" id="buddy-profile">([\s\S]*?)<\/script>/
    );
    assert.ok(embedMatch, "embed payload present");
    const embedPayload = JSON.parse(embedMatch[1]);
    assert.deepEqual(Object.keys(embedPayload).sort(), ["avatarDef", "mood", "username"]);
    assert.equal(embedPayload.username, "smokey");
  });
});