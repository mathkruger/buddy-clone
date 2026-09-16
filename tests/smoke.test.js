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
  test("boots against a dedicated DB and exercises key routes", async () => {
    const root = baseUrl;

    const rootRes = await fetch(`${root}/`);
    assert.equal(rootRes.status, 200);
    assert.match(await rootRes.text(), /class="entry-grid"/);

    const created = await fetch(`${root}/api/profiles`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "smokey", avatarDef: { head: "star" }, password: "pickle-123" })
    });
    assert.equal(created.status, 201);
    const cookie = created.headers.getSetCookie()[0].split(";")[0];

    const profilePage = await fetch(`${root}/smokey`, { headers: { Cookie: cookie } });
    assert.equal(profilePage.status, 200);
    assert.match(await profilePage.text(), /"username":"smokey"/);

    const search = await fetch(`${root}/api/search?q=smo`, { headers: { Cookie: cookie } });
    assert.equal(search.status, 200);
    const searchBody = await search.json();
    assert.deepEqual(searchBody.results.map((r) => r.username), ["smokey"]);

    await fetch(`${root}/api/profiles`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "favme", avatarDef: {}, password: "pickle-123" })
    });
    const fav = await fetch(`${root}/api/profile/smokey/favorites`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ target: "favme" })
    });
    assert.equal(fav.status, 200);
    assert.deepEqual((await fav.json()).favorites.map((f) => f.username), ["favme"]);

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

    const embed = await fetch(`${root}/embed/smokey`);
    assert.equal(embed.status, 200);
    assert.match(await embed.text(), /id="buddy-profile"/);
  });
});