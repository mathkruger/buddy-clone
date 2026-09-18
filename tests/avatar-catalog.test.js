import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ASSET_DIR = path.join(ROOT, "src", "public", "buddylabs");

function readJSON(name) {
  return JSON.parse(fs.readFileSync(path.join(ASSET_DIR, name), "utf8"));
}

const bodyMaterial = readJSON("body-material.json");
const headMaterial = readJSON("head-material.json");
const geometry = readJSON("geometry-preview.json");
const faceSymbolDirs = fs.readdirSync(path.join(ASSET_DIR, "face-symbols")).filter((d) => /^DefineSprite_/.test(d));

describe("avatar catalog (avatar.js) matches the vendored buddylabs manifests", async () => {
  const avatar = await import(`file://${path.join(ROOT, "src", "public", "avatar.js")}`);

  const bodyLayers = new Map(bodyMaterial.layers.map((l) => [l.name, l]));
  function nonBlankSymbols(layerName) {
    const layer = bodyLayers.get(layerName);
    if (!layer) return null;
    return (layer.textures ?? [])
      .filter((t) => t.symbol && !/Blank/.test(t.symbol))
      .map((t) => t.symbol);
  }

  test("every CLOTHING_CATALOG layer/symbol exists as a non-blank body material texture", () => {
    for (const entry of avatar.CLOTHING_CATALOG) {
      const actual = nonBlankSymbols(entry.layer);
      assert.ok(actual, `layer ${entry.layer} missing from body-material.json`);
      for (const symbol of entry.symbols) {
        assert.ok(actual.includes(symbol), `${entry.layer} is missing symbol ${symbol}`);
      }
    }
  });

  test("every non-blank, non-shadow body material layer symbol is exposed in CLOTHING_CATALOG", () => {
    const exposed = new Set();
    for (const entry of avatar.CLOTHING_CATALOG) for (const s of entry.symbols) exposed.add(s);
    for (const layer of bodyMaterial.layers) {
      if (layer.name.endsWith("Shadow") || layer.name === "Skin") continue;
      const actual = nonBlankSymbols(layer.name) ?? [];
      for (const symbol of actual) {
        assert.ok(exposed.has(symbol), `${layer.name} symbol ${symbol} is not exposed`);
      }
    }
  });

  test("clothing layer entries cover exactly the non-blank user-selectable layers", () => {
    const exposedLayers = new Set(avatar.CLOTHING_CATALOG.map((e) => e.layer));
    for (const layer of bodyMaterial.layers) {
      const nonBlank = (layer.textures ?? []).some((t) => t.symbol && !/Blank/.test(t.symbol));
      if (!nonBlank) continue;
      if (layer.name.endsWith("Shadow") || layer.name === "Skin") continue;
      assert.ok(exposedLayers.has(layer.name), `layer ${layer.name} is not in CLOTHING_CATALOG`);
    }
  });

  test("HAIR_OPTIONS / PROPS_OPTIONS / SKIRT_OPTIONS match the geometry catalog", () => {
    const catalogs = {};
    for (const c of geometry.catalog.categories) catalogs[c.name] = c.items.map((i) => i.name);
    assert.deepEqual(avatar.HAIR_OPTIONS.map((x) => x), catalogs.Hair);
    assert.deepEqual([...avatar.PROPS_OPTIONS], catalogs.Props);
    assert.deepEqual([...avatar.SKIRT_OPTIONS], catalogs.Skrt);
  });

  test("every face catalog symbol maps to a shipped sprite directory", () => {
    for (const layer of Object.values(avatar.FACE_CATALOG)) {
      for (const { symbol, sprite } of layer.options) {
        assert.ok(faceSymbolDirs.includes(sprite), `sprite dir ${sprite} (${symbol}) not shipped`);
        const frame = path.join(ASSET_DIR, "face-symbols", sprite, "1.svg");
        assert.ok(fs.existsSync(frame), `${symbol}: ${frame} missing`);
        assert.equal(avatar.faceSymbolPath(symbol), sprite, `${symbol} resolves to ${sprite}`);
        assert.equal(avatar.FACE_SYMBOLS[symbol], sprite);
      }
    }
  });

  test("every shipped eye family in avatar.js resolves to a sprite directory", () => {
    const eyeSprites = Object.fromEntries(avatar.EYE_OPTIONS.map((name) => [name, name]));
    for (const name of avatar.EYE_OPTIONS) {
      assert.ok(eyeSprites[name]);
    }
    const shippedEyes = faceSymbolDirs.filter((d) => /_Eyes_/.test(d));
    assert.equal(shippedEyes.length, avatar.EYE_OPTIONS.length, "eye family count matches shipped eye sprites");
  });

  test("mouth names map to valid frames of the shipped mouth sprite", () => {
    for (const name of avatar.MOUTH_OPTIONS) {
      const frame = avatar.MOUTH_TO_FRAME[name];
      assert.ok(Number.isInteger(frame) && frame >= 1 && frame <= 33, `${name} -> frame ${frame}`);
    }
  });

  test("head-material face layers used by the face atlas are present", () => {
    const names = headMaterial.layers.map((l) => l.name);
    const manifestLayer = {
      spot: "Spot",
      eyeShadow: "EyeShadow",
      mask: "Mask",
      brows: "Brows",
      mustache: "Mustache",
      beard: "Beard",
      glasses: "Glas",
      mouth: "Mouth",
      eyes: "Eyes",
    };
    for (const key of avatar.FACE_LAYER_KEYS) {
      assert.ok(names.includes(manifestLayer[key]), `head-material missing layer ${manifestLayer[key]} (for ${key})`);
    }
  });

  describe("normalizeComposition", () => {
    test("drops obsolete fields (accent/bg/head/accessory/body/frame-N) and resets to defaults", () => {
      const out = avatar.normalizeComposition({
        head: "star",
        accessory: "crown",
        body: "classic",
        accent: "#ff0000",
        bg: "#000000",
        "frame-3": "DoesNotExist",
        spot: "DoesNotExist",
        hair: "Hair_Simple_Mohawk",
        eyes: "Eyes_Rio",
        mouth: "tongue",
        props: "Mic",
        skirt: "SkrtLong",
      });
      assert.equal(out.head, undefined);
      assert.equal(out.accessory, undefined);
      assert.equal(out.body, undefined);
      assert.ok(!("accent" in out.colors) && !("bg" in out.colors));
      assert.equal(out.hair, "Hair_Simple_Mohawk");
      assert.equal(out.eyes, "Eyes_Rio");
      assert.equal(out.mouth, "tongue");
      assert.equal(out.props, "Mic");
      assert.equal(out.skirt, "SkrtLong");
      assert.equal(out.face.spot, "none");
    });

    test("keeps valid clothing layers and face symbols, drops invalid ones", () => {
      const out = avatar.normalizeComposition({
        clothing: { ShrtLength: "Shrt_Tank", SockPattern: "Sock_NotReal", ShrtLayer2: "Shrt_Logo_Nike" },
        face: { glasses: "Glas_3", mustache: "Must_Thin", beard: "NotReal" },
        hairMaterial: { patternIndex: 3, patternColor: "#abcdef", streakIndex: 1, streakColor: "#123456" },
      });
      assert.deepEqual(out.clothing, { ShrtLength: "Shrt_Tank", ShrtLayer2: "Shrt_Logo_Nike" });
      assert.equal(out.face.glasses, "Glas_3");
      assert.equal(out.face.mustache, "Must_Thin");
      assert.equal(out.face.beard, "none");
      assert.equal(out.hairMaterial.patternIndex, 3);
    });

    test("resets unknown top-level values to canonical defaults", () => {
      const out = avatar.normalizeComposition({ hair: "Bogus", eyes: "Bogus", mouse: "x" });
      assert.equal(out.hair, avatar.HAIR_OPTIONS[0]);
      assert.equal(out.eyes, "Eyes_Male");
      assert.ok(!("mouse" in out));
    });

    test("returns the default composition for non-objects", () => {
      assert.deepEqual(avatar.normalizeComposition(null), avatar.defaultComposition());
      assert.deepEqual(avatar.normalizeComposition([]), avatar.defaultComposition());
    });
  });
});