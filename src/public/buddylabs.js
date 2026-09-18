// buddylabs.js — port of the MinePoke ("buddylabs") Buddy Poke renderer pipeline.
//
// Loads the vendored authentic assets under `/buddylabs/` and rebuilds the
// avatar the same way the source site does:
//   - 29-bone skeleton from `orderedBones` (bind pose from cpos/crot)
//   - per-mesh BufferGeometry (position/uv/index) + SkinnedMesh skin weights
//     from the packed modifier data
//   - geometry cull regions for hair/hat combos
//   - {buildBodyAtlasTexture, buildFaceAtlasTexture, buildHairTexture} atlas
//     compositors (ported alongside)
//   - AvatarAnimationPlayer: per-bone pos/rot (axis-angle), vis toggles and the
//     head `mat` (mouth frame) channel, rAF-driven
//
// The scene/rendering orchestration stays in `buddy-3d.js`; this module only
// builds objects and animations.

import * as THREE from "three";

export const BUDDY_SCALE = 0.018;
export const BUDDY_POSITION = new THREE.Vector3(-1.35, 0.08, 0);

const ASSET_BASE = "/buddylabs";

// Default mesh set always present (site constant `tx`).
const DEFAULT_MESH_PATHS = [
  "IG_Root/Shadow",
  "IG_Root/Body",
  "Bip01/Bip01_Pelvis/Bip01_Spine/Bip01_Spine1/Bip01_Neck/Bip01_Head/Head",
];

// Material url basename -> vendored texture path (site constant `CS`).
const TEXTURE_ALIASES = {
  "rose.jpg": `${ASSET_BASE}/textures/rose.jpg`,
  "sword.jpg": `${ASSET_BASE}/textures/sword.png`,
  "mic.jpg": `${ASSET_BASE}/textures/mic.png`,
  "mallet.jpg": `${ASSET_BASE}/textures/mallet.png`,
  "strat.jpg": `${ASSET_BASE}/textures/strat-misc.png`,
  "vespa.psd": `${ASSET_BASE}/textures/vespa-base.png`,
  "vespaTire.psd": `${ASSET_BASE}/textures/vespaTire.png`,
  "boy_body.jpg": `${ASSET_BASE}/textures/boy_body.png`,
  "Hair.jpg": `${ASSET_BASE}/textures/Hair.jpg`,
  "Shadow.jpg": `${ASSET_BASE}/textures/Shadow.png`,
};

// Textures that keep their own colors (site constant `RS`).
const KEEP_TEXTURE_COLOR = new Set(["boy_body.jpg", "Hair.jpg", "Shadow.jpg"]);

// Palette strips sampled for skin / shirt / iris tinting (site constant `Jy`).
const PALETTE_URLS = {
  Skin: `${ASSET_BASE}/palettes/skin.png`,
  ShrtSpectrum: `${ASSET_BASE}/palettes/shrt-spectrum.png`,
  Eye: `${ASSET_BASE}/palettes/eye.png`,
};

// ---- asset loading (module-wide cache) ----

let geometryPromise = null;
let animationsPromise = null;
let bodyMaterialPromise = null;
let headMaterialPromise = null;

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GET ${url} -> ${res.status}`);
  return res.json();
}

export function loadGeometry() {
  return (geometryPromise ??= fetchJSON(`${ASSET_BASE}/geometry-preview.json`));
}
export function loadAnimations() {
  return (animationsPromise ??= fetchJSON(`${ASSET_BASE}/animations-subset.json`));
}
export function loadBodyMaterial() {
  return (bodyMaterialPromise ??= fetchJSON(`${ASSET_BASE}/body-material.json`));
}
export function loadHeadMaterial() {
  return (headMaterialPromise ??= fetchJSON(`${ASSET_BASE}/head-material.json`));
}

const textureCache = new Map();
export function loadTexture(url) {
  const key = (url.split("/").pop() ?? url);
  const mapped = TEXTURE_ALIASES[key];
  if (!mapped) return null;
  if (textureCache.has(mapped)) return textureCache.get(mapped);
  const loader = new THREE.TextureLoader();
  const tex = loader.load(mapped);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.anisotropy = 4;
  textureCache.set(mapped, tex);
  return tex;
}

// ---- small predicates ----

function isVec3(v) {
  return Array.isArray(v) && v.length === 3 && v.every((n) => typeof n === "number" && Number.isFinite(n));
}
function isVec2(v) {
  return Array.isArray(v) && v.length === 2 && v.every((n) => typeof n === "number" && Number.isFinite(n));
}
function hasSkinWeights(mesh) {
  return !!(mesh.modifier && mesh.modifier.boneIndex.length === mesh.positions.length);
}
function uvFlip(url) {
  return url ? !(url === "boy_body.jpg" || url === "Shadow.jpg") : true;
}
function validIndices(indices, count) {
  for (const t of indices) if (!Number.isInteger(t) || t < 0 || t >= count) return false;
  return true;
}

// ---- skeleton (site `Sd`, `WS`, `zS`) ----

export function buildBones(geometry) {
  const map = new Map();
  for (const bone of geometry.skeleton.orderedBones) {
    const obj = new THREE.Bone();
    obj.name = bone.name;
    obj.userData.originalFound = bone.found;
    if (bone.cpos) obj.position.set(bone.cpos[0], bone.cpos[1], bone.cpos[2]);
    if (bone.crot) {
      const axis = new THREE.Vector3(bone.crot[0], bone.crot[1], bone.crot[2]);
      if (axis.lengthSq() > 0) {
        axis.normalize();
        obj.quaternion.setFromAxisAngle(axis, bone.crot[3]);
      }
    }
    map.set(bone.name, obj);
  }
  for (const bone of geometry.skeleton.orderedBones) {
    const obj = map.get(bone.name);
    const parent = bone.parentName ? map.get(bone.parentName) : null;
    if (obj && parent) parent.add(obj);
  }
  for (const obj of map.values()) if (!obj.parent) obj.updateMatrixWorld(true);
  return map;
}

// Bind-pose world matrices keyed by bone name (site `WS`).
export function buildBindMatrices(geometry) {
  const bones = new Map(geometry.skeleton.orderedBones.map((b) => [b.name, b]));
  const cache = new Map();
  const worldMatrix = (name) => {
    const hit = cache.get(name);
    if (hit) return hit;
    const bone = bones.get(name);
    const local = new THREE.Matrix4();
    if (bone && bone.cpos) local.makeTranslation(bone.cpos[0], bone.cpos[1], bone.cpos[2]);
    else if (!bone) local.identity();
    if (bone && bone.crot && bone.crot[3] !== 0) {
      const rot = new THREE.Matrix4().makeRotationAxis(
        new THREE.Vector3(bone.crot[0], bone.crot[1], bone.crot[2]),
        bone.crot[3]
      );
      local.multiply(rot);
    }
    const parent = bone && bone.parentName ? worldMatrix(bone.parentName).clone() : new THREE.Matrix4();
    const out = parent.multiply(local);
    cache.set(name, out);
    return out;
  };
  for (const bone of geometry.skeleton.orderedBones) worldMatrix(bone.name);
  return cache;
}

// Geography: bind the bones into a THREE.Skeleton (site `nx` + `El`).
function buildThreeSkeleton(bonesMap, orderedBoneNames) {
  const bones = orderedBoneNames.map((name) => bonesMap.get(name)).filter(Boolean);
  const skeleton = new THREE.Skeleton(bones);
  skeleton.calculateInverses();
  return skeleton;
}

// ---- geometry / skinning (site `Vs`, `XS`, `LS`, `$S`, `YS`, `QS`, `qS`, `JS`) ----

// Pre-bake vertices to bind pose using skin weights (site `$S`).
function bakeSkinnedPositions(mesh, skinning) {
  if (!hasSkinWeights(mesh)) return null;
  const out = [];
  const modifier = mesh.modifier;
  for (let v = 0; v < mesh.positions.length; v++) {
    const pos = mesh.positions[v];
    const boneIndex = modifier.boneIndex[v] ?? [];
    const boneWeight = modifier.boneWeight[v] ?? [];
    let x = 0, y = 0, z = 0, total = 0;
    for (let b = 0; b < boneIndex.length; b++) {
      const boneName = skinning.skeleton.orderedBoneNames[boneIndex[b]];
      const world = boneName ? skinning.matrices.get(boneName) : null;
      if (!world) continue;
      const local = world.clone().invert().transformPoint(new THREE.Vector3(pos[0], pos[1], pos[2]));
      const word = new THREE.Vector3(world.elements[12], world.elements[13], world.elements[14])
        .add(local);
      const weight = boneWeight[b] ?? (boneIndex.length === 1 ? 1 : 0);
      x += word.x * weight;
      y += word.y * weight;
      z += word.z * weight;
      total += weight;
    }
    out.push(total > 0 ? [x / total, y / total, z / total] : pos);
  }
  return out;
}

// Also ported exactly: the site applies the *same* point again (`g.transformPoint(p)`).
// For a rigid in to world:
//   p = inverse(bindWorld) * vertex   (vertex in bone local space)
//   E = bindWorld                    (identical transform -> returns vertex)
// The bake is therefore rotation-free at bind pose; we compute it faithfully below.

function bakeSkinnedPositionsExact(mesh, skinning) {
  if (!hasSkinWeights(mesh)) return null;
  const out = [];
  const modifier = mesh.modifier;
  for (let v = 0; v < mesh.positions.length; v++) {
    const pos = mesh.positions[v];
    const boneIndex = modifier.boneIndex[v] ?? [];
    const boneWeight = modifier.boneWeight[v] ?? [];
    let x = 0, y = 0, z = 0, total = 0;
    for (let b = 0; b < boneIndex.length; b++) {
      const boneName = skinning.skeleton.orderedBoneNames[boneIndex[b]];
      const world = boneName ? skinning.matrices.get(boneName) : null;
      if (!world) continue;
      const p = world.clone().invert().transformPoint(new THREE.Vector3(pos[0], pos[1], pos[2]));
      const E = new THREE.Vector3(p.x, p.y, p.z);
      const weight = boneWeight[b] ?? (boneIndex.length === 1 ? 1 : 0);
      x += E.x * weight;
      y += E.y * weight;
      z += E.z * weight;
      total += weight;
    }
    out.push(total > 0 ? [x / total, y / total, z / total] : pos);
  }
  return out;
}

// Apply parent-bone world transform to raw positions (site `YS`).
function applyParentTransform(positions, mesh, skinning) {
  const parentBone = findParentBone(mesh.path, skinning.skeleton);
  const world = parentBone ? skinning.matrices.get(parentBone) : null;
  return world ? positions.map((p) => {
    const v = new THREE.Vector3(p[0], p[1], p[2]).applyMatrix4(world);
    return [v.x, v.y, v.z];
  }) : positions;
}

// Nearest ancestor that is a named bone (site `yd`).
export function findParentBone(path, skeleton) {
  const names = new Set(skeleton.orderedBoneNames);
  const parts = path.split("/").slice(0, -1);
  for (let i = parts.length - 1; i >= 0; i--) if (names.has(parts[i])) return parts[i];
  return null;
}

// Cull geometry indices by hidden cull-region id (site `qS`).
function applyCullRegions(mesh, opts) {
  if (!mesh.indices) return null;
  const hidden = opts.hiddenCullRegionNames;
  const named = opts.cullRegionNames ?? [];
  if (!hidden || hidden.size === 0 || !mesh.cull || mesh.cull.length !== mesh.indices.length / 3) {
    return mesh.indices;
  }
  const out = [];
  for (let f = 0; f < mesh.cull.length; f++) {
    const region = mesh.cull[f];
    const name = typeof region === "number" ? named[region] : null;
    if (name && hidden.has(name)) continue;
    const i = f * 3;
    out.push(mesh.indices[i], mesh.indices[i + 1], mesh.indices[i + 2]);
  }
  return out;
}

// Compute smooth vertex normals from triangle faces (site `JS`).
function computeNormals(geometry) {
  const pos = geometry.getAttribute("position");
  const index = geometry.getIndex();
  if (!pos || !index) {
    geometry.computeVertexNormals();
    return;
  }
  const key = (i) => {
    const x = Math.round(pos.getX(i) * 1000);
    const y = Math.round(pos.getY(i) * 1000);
    const z = Math.round(pos.getZ(i) * 1000);
    return `${x},${y},${z}`;
  };
  const normalsByIndex = new Map();
  const v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), v3 = new THREE.Vector3();
  const ab = new THREE.Vector3(), ac = new THREE.Vector3(), cross = new THREE.Vector3();
  for (let f = 0; f + 2 < index.count; f += 3) {
    const a = index.getX(f), b = index.getX(f + 1), c = index.getX(f + 2);
    v1.fromBufferAttribute(pos, a);
    v2.fromBufferAttribute(pos, b);
    v3.fromBufferAttribute(pos, c);
    ab.subVectors(v3, v2);
    ac.subVectors(v1, v2);
    cross.crossVectors(ab, ac);
    if (cross.lengthSq() !== 0) {
      for (const vi of [a, b, c]) {
        const n = normalsByIndex.get(key(vi)) ?? new THREE.Vector3();
        n.add(cross);
        normalsByIndex.set(key(vi), n);
      }
    }
  }
  const out = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const n = normalsByIndex.get(key(i));
    if (n && n.lengthSq() !== 0) {
      n.normalize();
      out[i * 3] = n.x;
      out[i * 3 + 1] = n.y;
      out[i * 3 + 2] = n.z;
    }
  }
  geometry.setAttribute("normal", new THREE.BufferAttribute(out, 3));
}

// Extract skinIndex/skinWeight from packed modifier data (site `QS`).
function addSkinAttributes(geometry, mesh) {
  if (!mesh.modifier || mesh.modifier.boneIndex.length !== mesh.positions.length) return;
  const boneIndex = new Uint16Array(mesh.positions.length * 4);
  const boneWeight = new Float32Array(mesh.positions.length * 4);
  for (let v = 0; v < mesh.positions.length; v++) {
    const idx = mesh.modifier.boneIndex[v] ?? [];
    const w = mesh.modifier.boneWeight[v] ?? [];
    let total = 0;
    for (let b = 0; b < 4; b++) {
      const at = v * 4 + b;
      boneIndex[at] = idx[b] ?? 0;
      boneWeight[at] = w[b] ?? (b === 0 && idx.length === 1 ? 1 : 0);
      total += boneWeight[at];
    }
    if (total > 0) for (let b = 0; b < 4; b++) boneWeight[v * 4 + b] /= total;
  }
  geometry.setAttribute("skinIndex", new THREE.BufferAttribute(boneIndex, 4));
  geometry.setAttribute("skinWeight", new THREE.BufferAttribute(boneWeight, 4));
}

// Debug vertex colors for the skin-weight material mode (site `DS`).
function skinWeightColors(mesh) {
  const out = new Float32Array(mesh.positions.length * 3);
  const color = new THREE.Color();
  for (let v = 0; v < mesh.positions.length; v++) {
    const idx = mesh.modifier?.boneIndex[v] ?? [];
    const w = mesh.modifier?.boneWeight[v] ?? [];
    let bestIdx = idx[0] ?? 0;
    let bestWeight = w[0] ?? 0;
    for (let b = 1; b < idx.length; b++) {
      const weight = w[b] ?? 0;
      if (weight > bestWeight) {
        bestIdx = idx[b];
        bestWeight = weight;
      }
    }
    color.setHSL(((bestIdx * 0.137) % 1), 0.72, 0.42 + Math.min(bestWeight, 1) * 0.22);
    out[v * 3] = color.r;
    out[v * 3 + 1] = color.g;
    out[v * 3 + 2] = color.b;
  }
  return out;
}

// Debug per-mesh color (site `Bs`).
export function meshDebugColor(mesh, opts = {}) {
  const t = mesh.material?.url ?? "";
  if (mesh.path.includes("BCap") || mesh.path.includes("SCap")) return "#272b34";
  if (t === "boy_body.jpg") return "#d95b6e";
  if (t === "33.png") return "#f0c49d";
  if (/hair/i.test(t)) return opts.hairColor ?? "#242428";
  if (/shadow/i.test(t)) return "#7b735f";
  if (/skrt/i.test(t)) return opts.clothingColor ?? "#6d7bd8";
  if (/tire/i.test(mesh.path) || /vespaTire/i.test(t)) return "#1f2228";
  if (/(^|\/)Strat$/.test(mesh.path) || /strat\.jpg$/.test(t)) return "#15171c";
  if (/(^|\/)Ball$/.test(mesh.path) || /spBalloon/i.test(mesh.path) || /ball\.jpg$/.test(t) || /spBalloon\.jpg$/.test(t)) return "#cf8a42";
  if (/vesp/i.test(mesh.path) || /vespa/i.test(t)) return "#d83a56";
  return "#ffffff";
}

function isBodyMesh(mesh) {
  return mesh.path === "IG_Root/Body" || mesh.material?.url === "boy_body.jpg";
}
function isFaceMesh(mesh) {
  return mesh.path === "Bip01/Bip01_Pelvis/Bip01_Spine/Bip01_Spine1/Bip01_Neck/Bip01_Head/Head" || mesh.material?.url === "33.png";
}
function isHairMesh(mesh) {
  const url = mesh.material?.url ?? "";
  return /(^|\/)Hair_/.test(mesh.path) || (/Hair(?:Test)?\.(?:jpg|psd)$/i.test(url) && !/(^|\/)(BCap|SCap)$/.test(mesh.path));
}
function isShaveMesh(mesh) {
  return /(^|\/)Hair_Shave$/i.test(mesh.path);
}

// Ported material selector (site `LS`). Atlas textures are provided by the
// renderer-facing helpers; when absent we fall back to the debug color so the
// object still renders correctly-sized for bind-pose verification.
// NOTE: reference site renders every surface `DoubleSide` (bundle enum `_t=2`).
// The source meshes are open shells wound toward the front, so a single-sided
// material would cull the head's back faces, making it see-through and showing
// the mirrored interior. DoubleSide matches the reference exactly.
function buildMaterial(mesh, opts) {
  if (opts.materialMode === "skinWeights" && mesh.modifier) {
    return new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.72,
      metalness: 0,
      side: THREE.DoubleSide,
    });
  }
  if (opts.materialMode === "final" && mesh.material?.url) {
    const base = mesh.material.url.split("/").pop() ?? mesh.material.url;
    if (isBodyMesh(mesh) && opts.bodyAtlasTexture) {
      return new THREE.MeshStandardMaterial({ map: opts.bodyAtlasTexture, roughness: 0.86, metalness: 0, side: THREE.DoubleSide });
    }
    if (isFaceMesh(mesh) && opts.faceAtlasTexture) {
      return new THREE.MeshStandardMaterial({ map: opts.faceAtlasTexture, roughness: 0.86, metalness: 0, side: THREE.DoubleSide });
    }
    if (isHairMesh(mesh)) {
      if (isShaveMesh(mesh)) {
        const tex = loadTexture("Hair.jpg");
        if (tex) return new THREE.MeshStandardMaterial({ color: opts.hairBaseColor ?? opts.hairColor ?? "#15191d", map: tex, roughness: 0.86, metalness: 0, side: THREE.DoubleSide });
      }
      if (opts.hairAtlasTexture) {
        return new THREE.MeshStandardMaterial({ map: opts.hairAtlasTexture, roughness: 0.86, metalness: 0, side: THREE.DoubleSide });
      }
    }
    const tex = loadTexture(base);
    if (tex) {
      const tinted = KEEP_TEXTURE_COLOR.has(base);
      const shadow = base === "Shadow.jpg";
      return new THREE.MeshStandardMaterial({
        color: tinted ? opts.color ?? "#ffffff" : "#ffffff",
        map: tex,
        roughness: shadow ? 1 : 0.86,
        metalness: 0,
        transparent: shadow,
        opacity: shadow ? 0.55 : 1,
        depthWrite: !shadow,
        side: THREE.DoubleSide,
      });
    }
  }
  return new THREE.MeshStandardMaterial({
    color: opts.color ?? "#ffffff",
    roughness: opts.materialMode === "final" ? 0.86 : 0.7,
    metalness: 0,
    side: THREE.DoubleSide,
  });
}

// Build the per-mesh surface (SkinnedMesh or Mesh) (site `XS`).
function buildSurface(mesh, geometry, material, opts) {
  const skinned = opts.skinning?.skeleton3js && hasSkinWeights(mesh);
  if (skinned) {
    // NOTE: binding to the skeleton happens in the avatar builder so the
    // skinned mesh can be positioned before `bind()`.
    return new THREE.SkinnedMesh(geometry, material);
  }
  const m = new THREE.Mesh(geometry, material);
  if (opts.skinning && mesh.modifier && mesh.modifier.boneIndex.length === geometry.getAttribute("position").count) {
    m.userData.originalSkinning = "bind-pose-static";
  }
  return m;
}

// Decode a single mesh entry into an object (site `Vs`).
export function buildMesh(mesh, opts = {}) {
  if (!mesh || mesh.positions.length === 0) return null;
  const skinning = opts.skinning;
  const useSkinned = skinning?.skeleton3js && hasSkinWeights(mesh);
  let baked = skinning && !useSkinned ? bakeSkinnedPositionsExact(mesh, skinning) : null;

  const useReindexed =
    !useSkinned && !baked &&
    mesh.indices && mesh.reindexedPositions &&
    mesh.reindexedPositions.every(isVec3) &&
    (!mesh.reindexedUvs || mesh.reindexedUvs.every(isVec2)) &&
    validIndices(mesh.indices, mesh.reindexedPositions.length);

  let srcPos = baked ?? (useReindexed ? mesh.reindexedPositions : mesh.positions);

  // Non-skinned meshes get their world transform baked into the vertices.
  if (!useSkinned && !baked && skinning && !opts.skipParentTransform) {
    srcPos = applyParentTransform(srcPos, mesh, skinning);
  }

  const uvs = useReindexed ? (mesh.reindexedUvs ?? mesh.uvs) : mesh.uvs;
  const position = new Float32Array(srcPos.length * 3);
  for (let i = 0; i < srcPos.length; i++) {
    position[i * 3] = srcPos[i][0];
    position[i * 3 + 1] = srcPos[i][1];
    position[i * 3 + 2] = srcPos[i][2];
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(position, 3));
  if (uvs && uvs.length === srcPos.length) {
    const flip = uvFlip(mesh.material?.url ?? null);
    const uv = new Float32Array(uvs.length * 2);
    for (let i = 0; i < uvs.length; i++) {
      uv[i * 2] = uvs[i][0];
      uv[i * 2 + 1] = flip ? 1 - uvs[i][1] : uvs[i][1];
    }
    geometry.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  }

  if (opts.materialMode === "skinWeights") {
    geometry.setAttribute("color", new THREE.BufferAttribute(skinWeightColors(mesh), 3));
  }

  if (useSkinned) addSkinAttributes(geometry, mesh);

  // Cull regions (hair/hat combos).
  const culled = applyCullRegions(mesh, opts);
  if (culled) geometry.setIndex(culled);

  geometry.computeBoundingBox();
  if (opts.materialMode === "final") computeNormals(geometry);
  else geometry.computeVertexNormals();
  if (opts.center && srcPos.length) geometry.center();

  const group = new THREE.Group();
  group.name = mesh.path;

  const material = buildMaterial(mesh, opts);
  let surface;
  if (culled) {
    surface = buildSurface(mesh, geometry, material, opts);
    surface.name = "OriginalSWFSurface";
    surface.castShadow = true;
    surface.receiveShadow = true;
    group.add(surface);
  }

  if (opts.showPointsFallback && !culled) {
    const points = new THREE.Points(geometry, new THREE.PointsMaterial({
      color: opts.color ?? "#ffffff",
      size: 0.035,
      sizeAttenuation: true,
    }));
    points.name = "OriginalSWFPoints";
    points.visible = false;
    group.add(points);
  }

  return group;
}

// ---- avatar builder (site `Ty`, `nx`) ----

function catalogItem(catalog, name, itemName) {
  if (!itemName) return null;
  const category = catalog.categories.find((c) => c.name === name);
  return category?.items.find((i) => i.name === itemName) ?? null;
}

function meshPathFor(geometry, path) {
  const exact = geometry.meshes.find((m) => m.path === path);
  if (exact) return exact.path;
  const leaf = geometry.meshes.find((m) => m.path.split("/").at(-1) === path);
  return leaf?.path ?? null;
}

function collectItemPaths(geometry, opts) {
  const hidden = new Set();
  const catalog = geometry.catalog;
  if (!catalog) return { paths: [], hiddenCullRegionNames: hidden, usedCatalog: false };
  const items = [
    catalogItem(catalog, "Skrt", opts.clothingItemName),
    catalogItem(catalog, "Hair", opts.hairItemName ?? "Hair_Simple_Twiggy"),
    catalogItem(catalog, "Props", opts.accessoryItemName),
  ].filter(Boolean);

  // Vespa props magnet all Vesp_ meshes (site behaviour).
  const prop = catalogItem(catalog, "Props", opts.accessoryItemName);
  if (prop && /^Vesp_/i.test(prop.name)) {
    const props = catalog.categories.find((c) => c.name === "Props")?.items ?? [];
    for (const item of props) {
      if (/^Vesp_/i.test(item.name) && !items.some((x) => x.name === item.name)) items.push(item);
    }
  }

  const paths = [];
  for (const item of items) {
    for (const geo of item.geos) {
      const p = meshPathFor(geometry, geo);
      if (p) paths.push(p);
    }
    for (const groupId of item.culls) {
      for (const name of catalog.cullGroups[groupId] ?? []) hidden.add(name);
    }
  }
  return { paths, hiddenCullRegionNames: hidden, usedCatalog: true };
}

// Build the full avatar object (site `nx`). Returns { object, bones }.
export function buildAvatar(geometry, opts = {}) {
  const selected = collectItemPaths(geometry, opts);
  const meshPaths = [
    ...DEFAULT_MESH_PATHS,
    ...selected.paths,
    ...(selected.usedCatalog ? [] : [opts.clothingPath, opts.hairPath ?? "Bip01/Bip01_Pelvis/Bip01_Spine/Bip01_Spine1/Bip01_Neck/Bip01_Head/Hair_Simple_Twiggy", opts.accessoryPath]),
  ].filter(Boolean);

  const deduped = new Set();
  const meshes = meshPaths
    .filter((p) => (deduped.has(p) ? false : (deduped.add(p), true)))
    .map((p) => geometry.meshes.find((m) => m.path === p))
    .filter(Boolean);
  if (meshes.length === 0) return null;

  const root = new THREE.Group();
  root.name = "OriginalSWF:AvatarBase";
  root.scale.setScalar(BUDDY_SCALE);
  root.position.copy(BUDDY_POSITION);
  if (opts.face) root.userData.originalFaceOptions = { ...opts.face };

  const bonesMap = geometry.skeleton ? buildBones(geometry) : null;
  const matrices = geometry.skeleton ? buildBindMatrices(geometry) : null;
  const skinningBase = bonesMap && geometry.skeleton
    ? { bones: bonesMap, matrices, skeleton: geometry.skeleton }
    : null;

  const skinnedMeshes = [];

  for (const mesh of meshes) {
    if (mesh.modifier && bonesMap) {
      skinnedMeshes.push(mesh);
      continue;
    }
    try {
      const group = buildMesh(mesh, {
        color: meshDebugColor(mesh, opts),
        center: false,
        showPointsFallback: false,
        materialMode: opts.materialMode ?? "final",
        face: opts.face,
        bodyMaterial: opts.bodyMaterial,
        hairMaterial: opts.hairMaterial,
        hairColor: opts.hairColor,
        cullRegionNames: geometry.cullRegionNames ?? [],
        hiddenCullRegionNames: selected.hiddenCullRegionNames,
        skinning: skinningBase,
        bodyAtlasTexture: opts.bodyAtlasTexture,
        faceAtlasTexture: opts.faceAtlasTexture,
        hairAtlasTexture: opts.hairAtlasTexture,
        hairBaseColor: opts.hairMaterial?.baseColor ?? opts.hairColor,
      });
      if (group) root.add(group);
    } catch (err) {
      console.warn(`buddylabs: skipping mesh ${mesh.path}`, err);
    }
  }

  if (opts.showSkeleton && geometry.skeleton && root.add) {
    const viz = buildSkeletonVisualization(geometry);
    if (viz) root.add(viz);
  }

  if (bonesMap) {
    for (const bone of bonesMap.values()) {
      if (!bone.parent) root.add(bone);
    }
  }

  // Skinned meshes: bound after the root matrix is settled.
  let threeSkeleton = null;
  if (bonesMap && geometry.skeleton) {
    root.updateMatrix();
    root.matrixWorld.copy(root.matrix);
    for (const bone of bonesMap.values()) if (!bone.parent) bone.updateMatrixWorld(true);
    threeSkeleton = buildThreeSkeleton(bonesMap, geometry.skeleton.orderedBoneNames);
  }

  if (threeSkeleton && bonesMap) {
    const skinnedOpts = {
      materialMode: opts.materialMode ?? "final",
      face: opts.face,
      bodyMaterial: opts.bodyMaterial,
      hairMaterial: opts.hairMaterial,
      hairColor: opts.hairColor,
      cullRegionNames: geometry.cullRegionNames ?? [],
      hiddenCullRegionNames: selected.hiddenCullRegionNames,
      skinning: { ...skinningBase, skeleton3js: threeSkeleton },
      bodyAtlasTexture: opts.bodyAtlasTexture,
      faceAtlasTexture: opts.faceAtlasTexture,
      hairAtlasTexture: opts.hairAtlasTexture,
      hairBaseColor: opts.hairMaterial?.baseColor ?? opts.hairColor,
    };
    for (const mesh of skinnedMeshes) {
      try {
        const group = buildMesh(mesh, { ...skinnedOpts, color: meshDebugColor(mesh, opts) });
        if (!group) continue;
        group.traverse((obj) => {
          if (obj.isSkinnedMesh) {
            obj.updateMatrix();
            obj.matrixWorld.multiplyMatrices(root.matrixWorld, obj.matrix);
            obj.bind(threeSkeleton);
          }
        });
        root.add(group);
      } catch (err) {
        console.warn(`buddylabs: skipping skinned mesh ${mesh.path}`, err);
      }
    }
  }

  // Non-skinned meshes: attach to their nearest bone / sibling mesh (site logic).
  if (bonesMap && geometry.skeleton) {
    const attached = new Map();
    const others = meshes
      .filter((m) => !m.modifier)
      .sort((a, b) => depth(a.path) - depth(b.path));
    for (const mesh of others) {
      const parentBone = findParentBone(mesh.path, geometry.skeleton);
      const leaf = mesh.path.split("/").at(-1) ?? mesh.path;
      const existing = root.getObjectByName(mesh.path);
      if (!existing) continue;
      root.remove(existing);
      const optsForMesh = {
        materialMode: opts.materialMode ?? "final",
        face: opts.face,
        bodyMaterial: opts.bodyMaterial,
        hairMaterial: opts.hairMaterial,
        hairColor: opts.hairColor,
        cullRegionNames: geometry.cullRegionNames ?? [],
        hiddenCullRegionNames: selected.hiddenCullRegionNames,
        skinning: skinningBase,
        skipParentTransform: true,
        bodyAtlasTexture: opts.bodyAtlasTexture,
        faceAtlasTexture: opts.faceAtlasTexture,
        hairAtlasTexture: opts.hairAtlasTexture,
        hairBaseColor: opts.hairMaterial?.baseColor ?? opts.hairColor,
      };
      const rebuilt = buildMesh(mesh, { ...optsForMesh, color: meshDebugColor(mesh, opts) });
      if (!rebuilt) continue;
      rebuilt.name = leaf;
      if (mesh.nodePos) rebuilt.position.set(mesh.nodePos[0], mesh.nodePos[1], mesh.nodePos[2]);
      if (mesh.nodeRot) {
        const axis = new THREE.Vector3(mesh.nodeRot[0], mesh.nodeRot[1], mesh.nodeRot[2]);
        if (axis.lengthSq() > 0) {
          axis.normalize();
          rebuilt.quaternion.setFromAxisAngle(axis, mesh.nodeRot[3]);
        }
      }
      if (leaf === "Ball") rebuilt.position.z += 14;
      const siblingHost = (() => {
        const parts = mesh.path.split("/");
        for (let i = parts.length - 1; i > 1; i--) {
          const prefix = parts.slice(0, i).join("/");
          const found = attached.get(prefix);
          if (found) return found;
        }
        return null;
      })();
      if (siblingHost) siblingHost.add(rebuilt);
      else if (parentBone) bonesMap.get(parentBone)?.add(rebuilt);
      else root.add(rebuilt);
      attached.set(mesh.path, rebuilt);
    }
  }

  return { object: root, bones: bonesMap };
}

function depth(path) {
  return path.split("/").length;
}

// Debug skeleton viz (site `GS`).
function buildSkeletonVisualization(geometry) {
  const bones = buildBones(geometry);
  const linesArr = [];
  const pointsArr = [];
  const group = new THREE.Group();
  group.name = "OriginalSWFSkeleton";
  for (const bone of bones.values()) {
    if (!bone.userData.originalFound) continue;
    bone.updateMatrixWorld(true);
    const wp = bone.matrixWorld.elements;
    pointsArr.push(wp[12], wp[13], wp[14]);
    const parent = bone.parent?.isBone ? bone.parent : null;
    if (parent) {
      parent.updateMatrixWorld(true);
      const pp = parent.matrixWorld.elements;
      linesArr.push(pp[12], pp[13], pp[14], wp[12], wp[13], wp[14]);
    }
  }
  if (linesArr.length) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(linesArr), 3));
    const line = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: "#ffde59", transparent: true, opacity: 0.92 }));
    line.name = "OriginalSWFSkeletonLines";
    group.add(line);
  }
  if (pointsArr.length) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(pointsArr), 3));
    const points = new THREE.Points(geo, new THREE.PointsMaterial({ color: "#1f2f3a", size: 2.6, sizeAttenuation: false }));
    points.name = "OriginalSWFSkeletonPoints";
    group.add(points);
  }
  return group;
}

// ---- animation player (site `Mx`) ----

const VIS_DEBUG_TARGETS = ["Rose", "Sword", "Strat", "Mic", "Shadow"];

export class AvatarAnimationPlayer {
  constructor(root, bones, animationLibrary) {
    this.entries = new Map();
    this.targets = new Map();
    this.initialStates = new Map();
    this.current = null;
    this.elapsed = 0;
    this.currentFrame = 0;
    this.playing = false;
    this.headMaterialFrame = null;
    this.root = root;
    this.bones = bones;
    for (const anim of animationLibrary.anims) this.entries.set(anim.name, anim);
    this.indexTargets();
  }

  play(name) {
    const anim = this.entries.get(name);
    if (!anim) return false;
    this.resetTargets();
    this.current = anim;
    this.elapsed = 0;
    this.currentFrame = 0;
    this.playing = true;
    this.applyFrame(0);
    return true;
  }

  stop() {
    this.playing = false;
    this.current = null;
    this.elapsed = 0;
    this.currentFrame = 0;
    this.headMaterialFrame = null;
    this.resetTargets();
  }

  getHeadMaterialFrame() {
    return this.headMaterialFrame;
  }

  get state() {
    return {
      name: this.current?.name ?? null,
      frame: this.currentFrame,
      numFrames: this.current?.numFrames ?? 0,
      fps: this.current?.fps ?? 30,
      playing: this.playing,
      mouthFrame: this.headMaterialFrame,
      visTargets: VIS_DEBUG_TARGETS
        .map((name) => this.targets.get(name))
        .filter(Boolean)
        .map((t) => ({ target: t.name, visible: t.visible })),
    };
  }

  update(dt) {
    if (!this.playing || !this.current) return;
    this.elapsed += dt;
    const fps = this.current.fps > 0 ? this.current.fps : 30;
    let frame = Math.floor(this.elapsed * fps + 0.499);
    if (this.current.loop) {
      frame %= Math.max(1, this.current.numFrames);
    } else {
      frame = Math.min(frame, Math.max(0, this.current.numFrames - 1));
      if (frame >= this.current.numFrames - 1) this.playing = false;
    }
    this.currentFrame = frame;
    this.applyFrame(frame);
  }

  indexTargets() {
    if (this.bones) for (const [name, obj] of this.bones) this.addTarget(name, obj);
    this.root.traverse((obj) => {
      if (!obj.name) return;
      this.addTarget(obj.name, obj);
      const leaf = obj.name.split("/").at(-1);
      if (leaf) this.addTarget(leaf, obj);
    });
  }

  addTarget(name, obj) {
    if (!this.targets.has(name)) this.targets.set(name, obj);
    if (!this.initialStates.has(obj)) {
      this.initialStates.set(obj, {
        position: obj.position.clone(),
        quaternion: obj.quaternion.clone(),
        visible: obj.visible,
      });
    }
  }

  resetTargets() {
    this.headMaterialFrame = null;
    for (const [obj, state] of this.initialStates) {
      obj.position.copy(state.position);
      obj.quaternion.copy(state.quaternion);
      obj.visible = state.visible;
      obj.userData.originalMaterialIndex = undefined;
      obj.userData.originalMorphWeights = undefined;
    }
  }

  applyFrame(frame) {
    const anim = this.current;
    if (!anim) return;
    const temp = new THREE.Vector3();
    for (const controller of anim.controllers) {
      const target = this.targets.get(controller.target);
      if (!target) continue;
      const pos = controller.pos?.[frame % controller.pos.length];
      if (pos) target.position.set(pos[0], pos[1], pos[2]);
      if (controller.rot) {
        const rot = controller.rotStatic ? controller.rot : controller.rot[frame % controller.rot.length];
        if (rot) {
          temp.set(rot[0], rot[1], rot[2]);
          if (temp.lengthSq() > 0) {
            temp.normalize();
            target.quaternion.setFromAxisAngle(temp, rot[3]);
          }
        }
      }
      if (controller.vis?.length) target.visible = controller.vis[frame % controller.vis.length];
      if (controller.mat?.length) {
        const mat = controller.mat[frame % controller.mat.length];
        target.userData.originalMaterialIndex = mat;
        if (controller.target === "Head" && Number.isFinite(mat)) {
          this.headMaterialFrame = Math.round(mat);
        }
      }
      if (controller.weight?.length) {
        const value = controller.weight[frame % controller.weight.length];
        target.userData.originalMorphWeights = { channel: controller.weightChannel ?? null, value };
        this.applyMorphWeight(target, controller.weightChannel ?? null, value);
      }
    }
  }

  applyMorphWeight(target, channel, value) {
    if (!target.isMesh || !target.morphTargetInfluences) return;
    const influences = target.morphTargetInfluences;
    let idx = null;
    if (typeof channel === "number" && Number.isFinite(channel)) idx = Math.round(channel);
    else if (typeof channel === "string") {
      const parsed = Number(channel);
      if (Number.isFinite(parsed)) idx = Math.round(parsed);
      else if (target.morphTargetDictionary && channel in target.morphTargetDictionary) idx = target.morphTargetDictionary[channel];
    }
    if (idx == null || idx < 0 || idx >= influences.length) return;
    influences[idx] = value;
    target.userData.originalMorphWeightApplied = true;
  }
}

// ---- atlas compositors ----
// Ported 1:1 from the site; each returns a CanvasTexture. Because symbol bitmaps
// load async, callers can await the returned promise to ensure the canvas is
// populated before first render (or rely on the rAF loop + needsUpdate).

async function loadSVGTranslate(url) {
  if (!url) return Promise.resolve(null);
  const res = await fetch(url);
  if (!res.ok) return null;
  const text = await res.text();
  const match = text.match(/<g\s+transform="matrix\([^,]+,[^,]+,[^,]+,[^,]+,\s*(-?[0-9.]+),\s*(-?[0-9.]+)\)"/);
  if (!match) return null;
  const x = Number(match[1]);
  const y = Number(match[2]);
  return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
}

function decodeSVGBitmap(text) {
  const width = Number(text.match(/\bwidth="([0-9.]+)px"/)?.[1] ?? 0);
  const height = Number(text.match(/\bheight="([0-9.]+)px"/)?.[1] ?? 0);
  const g = text.match(/<g transform="matrix\([^,]+,[^,]+,[^,]+,[^,]+,\s*(-?[0-9.]+),\s*(-?[0-9.]+)\)"/);
  const signed = g ? { x: Number(g[1]), y: Number(g[2]) } : { x: 0, y: 0 };
  const x = Math.abs(signed.x);
  const y = Math.abs(signed.y);
  // signed translate for body-style placement (`svgTranslate`), abs for faces
  return { x: Number.isFinite(x) ? x : 0, y: Number.isFinite(y) ? y : 0, rawX: signed.x, rawY: signed.y, width, height };
}

function svgToBitmap(svgText) {
  return new Promise((resolve, reject) => {
    const blob = new Blob([svgText], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to decode face SVG."));
    };
    img.src = url;
  });
}

const paletteCache = new Map();
function loadPalette(key) {
  const url = PALETTE_URLS[key];
  if (!url) return Promise.resolve(null);
  if (paletteCache.has(url)) return paletteCache.get(url);
  const promise = new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) { resolve(null); return; }
      ctx.drawImage(img, 0, 0);
      const data = ctx.getImageData(0, 0, canvas.width, 1).data;
      const colors = [];
      for (let i = 0; i < data.length; i += 4) {
        colors.push(`#${[data[i], data[i + 1], data[i + 2]].map((v) => v.toString(16).padStart(2, "0")).join("")}`);
      }
      resolve(colors);
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
  paletteCache.set(url, promise);
  return promise;
}

// Body material manifest layer (site `hd`).
const bodyMaterialManifestPromise = loadBodyMaterial;

// Interior color-adjust helper (site `xr`).
function adjustHexColor(hex, factor) {
  const base = hex.startsWith("#") ? hex.slice(1) : hex;
  const val = parseInt(base.length === 3 ? base.split("").map((c) => `${c}${c}`).join("") : base, 16);
  if (!Number.isFinite(val)) return "#101418";
  const channel = (shift) => {
    const c = (val >> shift) & 255;
    return Math.max(0, Math.min(255, Math.round(factor < 0 ? c * (1 + factor) : c + (255 - c) * factor)));
  };
  return `#${[channel(16), channel(8), channel(0)].map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

// Body atlas (site `ud` + `Oy`). Draws the kept layers (body via full manifest).
const BODY_SUPERSAMPLE = 2; // Vi (300 x 200 base units -> 600 x 400 canvas)
export async function buildBodyAtlasTexture(bodyMaterial, overrides = {}) {
  const canvas = document.createElement("canvas");
  canvas.width = 600;
  canvas.height = 400;
  const ctx = canvas.getContext("2d");
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.flipY = false;
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.anisotropy = 4;

  const manifest = bodyMaterial ?? await loadBodyMaterial();
  if (!manifest || !ctx) return texture;

  const layers = [...manifest.layers].sort((a, b) => a.order - b.order);
  // Selections are per-layer texture symbols (overrides.clothing), falling back
  // to any manifest-provided numeric indices, then the layer default.
  const selections = { ...(bodyMaterial?.selections ?? {}), ...(overrides.clothing ?? {}) };
  const colors = { ...(bodyMaterial?.colors ?? {}), ...(overrides.colors ?? {}) };

  const selIndex = {};
  for (const layer of layers) {
    const raw = selections[layer.name];
    const base = layer.selectedTextureIndex;
    let chosen = base;
    if (typeof raw === "string") {
      const idx = (layer.textures ?? []).findIndex((t) => t.symbol === raw);
      if (idx >= 0) chosen = idx;
    } else if (Number.isFinite(raw)) {
      chosen = Math.round(raw);
    }
    selIndex[layer.name] = Math.min(Math.max(chosen, 0), Math.max(layer.textures.length - 1, 0));
  }
  // Shadow layers follow their owner length layer.
  for (const [shadow, owner] of [["SockShadow", "SockLength"], ["PantShadow", "PantLength"], ["ShrtShadow", "ShrtLength"], ["GlveShadow", "Glve"]]) {
    if (selections[shadow] === undefined && selIndex[owner] !== undefined) selIndex[shadow] = selIndex[owner];
  }

  const maskLayerCache = new Map();
  for (const layer of layers) {
    const textureSpec = layer.textures[selIndex[layer.name] ?? layer.selectedTextureIndex];
    if (!textureSpec?.publicPath || !textureSpec.symbol || /Blank/.test(textureSpec.symbol)) continue;

    const bitmap = await loadSVGImage(textureSpec.publicPath);
    if (!bitmap) continue;

    const mask = await resolveBodyMask(layer, layers, selIndex, maskLayerCache);
    const fill = await resolveBodyColor(layer, textureSpec, colors);

    const tile = document.createElement("canvas");
    tile.width = canvas.width;
    tile.height = canvas.height;
    const tileCtx = tile.getContext("2d");
    if (!tileCtx) continue;
    tileCtx.imageSmoothingEnabled = true;
    tileCtx.imageSmoothingQuality = "high";
    // Position + size from the layer's `placement` (or the SVG translate),
    // scaled by the atlas supersample (site `Yo`).
    const place = textureSpec.placement;
    const svgT = bitmap.svgTranslate;
    const dx = (svgT ? -svgT.x : place?.x ?? 0) * BODY_SUPERSAMPLE;
    const dy = (svgT ? -svgT.y : place?.y ?? 0) * BODY_SUPERSAMPLE;
    const dw = (place?.width ?? bitmap.image.naturalWidth) * BODY_SUPERSAMPLE;
    const dh = (place?.height ?? bitmap.image.naturalHeight) * BODY_SUPERSAMPLE;
    tileCtx.drawImage(bitmap.image, dx, dy, dw, dh);
    if (!textureSpec.preserveColors) {
      // Color-matrix multiply tint for tinted layers (site `Gy` -> `jy`).
      tintBitmap(tileCtx, colorMatrixFor(fill));
    }
    if (mask) {
      // Mask drawn with the layer's own placement, then applied destination-in.
      const mdx = (svgT ? -svgT.x : place?.x ?? 0) * BODY_SUPERSAMPLE;
      const mdy = (svgT ? -svgT.y : place?.y ?? 0) * BODY_SUPERSAMPLE;
      const mdw = (place?.width ?? mask.image.naturalWidth) * BODY_SUPERSAMPLE;
      const mdh = (place?.height ?? mask.image.naturalHeight) * BODY_SUPERSAMPLE;
      tileCtx.globalCompositeOperation = "destination-in";
      tileCtx.drawImage(mask.image, mdx, mdy, mdw, mdh);
      tileCtx.globalCompositeOperation = "source-over";
    }
    ctx.save();
    ctx.globalAlpha = layer.name.endsWith("Shadow") ? 0.28 : 1;
    ctx.globalCompositeOperation = textureSpec.symbol?.endsWith("_Shadow") ? "multiply" : "source-over";
    ctx.drawImage(tile, 0, 0);
    ctx.restore();
  }

  texture.needsUpdate = true;
  return texture;
}

async function resolveBodyMask(layer, layers, selIndex, cache) {
  const grab = layer.attributes?.grabMask;
  if (grab) {
    if (cache.has(grab)) return cache.get(grab);
    const owner = layers.find((l) => l.name === grab);
    if (!owner) return null;
    const spec = owner.textures[selIndex[grab] ?? owner.selectedTextureIndex];
    if (!spec?.publicPath || /Blank/.test(spec.symbol)) return null;
    const mask = await loadSVGImage(spec);
    cache.set(grab, mask);
    return mask;
  }
  const spec = layer.textures[selIndex[layer.name] ?? layer.selectedTextureIndex];
  if (spec?.masks?.length) {
    if (/Blank/.test(spec.symbol)) return null;
    const mask = await loadSVGImage(spec);
    cache.set(layer.name, mask);
    return mask;
  }
  return null;
}

async function resolveBodyColor(layer, textureSpec, colors) {
  if (layer.name.endsWith("Shadow")) return "#000000";
  const colorName = layerColorKey(layer.name);
  const explicit = colors[colorName];
  if (explicit) return explicit;
  const palette = textureSpec.color ? await loadPalette(textureSpec.color) : null;
  const index = Number.parseInt(textureSpec.colorSelection ?? layer.attributes?.colorIndex ?? "", 10);
  if (palette && Number.isFinite(index)) {
    const clamped = Math.min(Math.max(index, 0), palette.length - 1);
    if (palette[clamped]) return palette[clamped];
  }
  return DEFAULT_LAYER_COLORS[colorName] ?? "#ffffff";
}

// Bodymaterial layer -> canonical `colors` key (design D3): each lockColor
// family maps to one avatar color category. `Skin`/`SkinColor` -> skin and the
// per-item-family keys (Sock/Pant/Shrt/Shoe/Glve/Belt -> socks/pants/shirt/
// shoes/glove/belt); pattern/`{X}Color` layers reuse their category's color.
function layerColorKey(name) {
  if (name === "Skin" || name === "SkinColor") return "skin";
  if (name.startsWith("Sock")) return "socks";
  if (name.startsWith("Pant")) return "pants";
  if (name.startsWith("Shrt")) return "shirt";
  if (name.startsWith("Shoe")) return "shoes";
  if (name.startsWith("Glve")) return "glove";
  if (name.startsWith("Belt")) return "belt";
  return name;
}

const DEFAULT_LAYER_COLORS = {
  skin: "#f0c49e",
  socks: "#ffffff",
  pants: "#4d5f7a",
  shirt: "#6d7bd8",
  shoes: "#2d3a4a",
  glove: "#ffffff",
  belt: "#1e2838",
};

async function loadSVGImage(urlOrSpec) {
  if (!urlOrSpec) return null;
  const url = typeof urlOrSpec === "string" ? urlOrSpec : urlOrSpec.publicPath;
  if (!url) return null;
  const key = url;
  if (svgBitmapCache.has(key)) return svgBitmapCache.get(key);
  const promise = (async () => {
    const res = await fetch(url);
    if (!res.ok) return null;
    const text = await res.text();
    const img = await svgToBitmap(text);
    if (!img) return null;
    const geo = decodeSVGBitmap(text);
    return { image: img, svgTranslate: { x: geo.rawX ?? 0, y: geo.rawY ?? 0 }, ...geo };
  })();
  svgBitmapCache.set(key, promise);
  return promise;
}

const svgBitmapCache = new Map();

// ---- face atlas (site `fd`, `eS`, `tS`, `kh`, `lS`) ----
// 500x250 supersampled face atlas (Dl=250, Il=125, et=2) composited from the
// head-material manifest in `Fh` order, then sampled by the Head (33.png) mesh.

const FACE_ATLAS_WIDTH = 500;          // Dl * et
const FACE_ATLAS_HEIGHT = 250;         // Il * et
const FACE_SUPERSAMPLE = 2;            // et
const FACE_SPRITE_BASE = `${ASSET_BASE}/face-symbols/`; // Fh
const FACE_HEAD_FILL = "#f0c49e";

// Curated eye family id -> sprite directory (site constant `Qy`).
const EYE_SPRITES = {
  Eyes_Fem: "DefineSprite_146_Eyes_Fem",
  Eyes_Male: "DefineSprite_92_Eyes_Male",
  Eyes_Lake: "DefineSprite_136_Eyes_Lake",
  Eyes_Rio: "DefineSprite_69_Eyes_Rio",
  Eyes_Goth: "DefineSprite_67_Eyes_Goth",
  Eyes_Azn1: "DefineSprite_123_Eyes_Azn1",
  Eyes_Azn2: "DefineSprite_122_Eyes_Azn2",
};

// Face layer order + per-layer behavior (site constant `Oh`).
// `resolvePath`/`resolveColor` take the face options object; `role` drives the
// SVG tint pass; blendMode/opacity are prepended defaults overridden by the
// manifest layer when present.
const FACE_LAYERS = [
  { name: "Head", role: "head", resolvePath: () => null, resolveColor: (o) => o.skinColor ?? FACE_HEAD_FILL },
  { name: "Spot", role: "multiply", resolvePath: (o) => spriteFramePath(o.spotStyle), resolveColor: (o) => o.spotColor ?? adjustHexColor(o.skinColor ?? FACE_HEAD_FILL, -0.22), blendMode: "multiply", opacity: 0.65 },
  { name: "Mouth", role: "mouth", resolvePath: (o) => `DefineSprite_44_Mouth/${mouthSpriteFrame(o.mouthStyle)}.svg`, resolveColor: () => "#7a343d" },
  { name: "EyeShadow", role: "multiply", resolvePath: (o) => spriteFramePath(o.eyeShadowStyle), resolveColor: (o) => o.eyeShadowColor ?? "#5b3540", blendMode: "multiply", opacity: 0.62 },
  { name: "Mask", role: "solid", resolvePath: (o) => spriteFramePath(o.maskStyle), resolveColor: (o) => o.maskColor ?? "#1b1f24" },
  { name: "Eyes", role: "eyes", resolvePath: (o) => eyesFramePath(o.eyeStyle), resolveColor: (o) => o.eyeColor },
  { name: "Brows", role: "solid", resolvePath: (o) => spriteFramePath(o.browStyle), resolveColor: (o) => o.beardColor ?? "#1b1714" },
  { name: "5OClock", role: "multiply", resolvePath: (o) => o.beardStyle === "DefineSprite_1012_Berd_5OClock" ? spriteFramePath(o.beardStyle) : null, resolveColor: (o) => o.beardColor ?? "#1b1714", blendMode: "multiply", opacity: 0.54 },
  { name: "Glas", role: "solid", resolvePath: (o) => spriteFramePath(o.glassesStyle), resolveColor: (o) => o.glassesColor ?? "#1b1f24" },
  { name: "Mustache", role: "solid", resolvePath: (o) => spriteFramePath(o.mustacheStyle), resolveColor: (o) => o.beardColor ?? "#1b1714" },
  { name: "Beard", role: "solid", resolvePath: (o) => o.beardStyle && o.beardStyle !== "DefineSprite_1012_Berd_5OClock" ? spriteFramePath(o.beardStyle) : null, resolveColor: (o) => o.beardColor ?? "#1b1714" },
];

// `<sprite>/<frame>.svg` path builder (site `Un`).
function spriteFramePath(name, frame = 1) {
  return name ? `${name}/${frame}.svg` : null;
}

// Eye sprite path: full path when given, else `<family>/1.svg` (site `aS`).
function eyesFramePath(style) {
  const s = String(style);
  if (s.includes("/")) return s;
  const dir = EYE_SPRITES[style] ?? style;
  return `${dir}/1.svg`;
}

// Mouth style "frame-N" -> frame number clamped to [1, 33] (site `oS`).
function mouthSpriteFrame(style) {
  const n = Number(style.replace("frame-", ""));
  return Number.isFinite(n) ? Math.min(33, Math.max(1, Math.round(n))) : 1;
}

// Option key lookup for a manifest color spec (site `rS`).
function faceColorOptionKey(value) {
  switch (value) {
    case "Head":
    case "Skin": return "skinColor";
    case "Spot":
    case "SpotColor": return "spotColor";
    case "EyeShadow":
    case "EyeShadowColor": return "eyeShadowColor";
    case "Mask":
    case "MaskColor": return "maskColor";
    case "Eyes":
    case "EyesColor":
    case "Eye": return "eyeColor";
    case "Glas":
    case "GlasColor": return "glassesColor";
    case "Brows":
    case "5OClock":
    case "Mustache":
    case "Beard":
    case "BeardColor": return "beardColor";
    default: return null;
  }
}

// Resolve a layer's color from the manifest lock/name/color spec (site `iS`).
function faceSelection(options, manifestLayer, definition) {
  const base = definition.resolveColor(options);
  if (!manifestLayer) return { color: base, isExplicitColor: false };
  const picked = [
    manifestLayer.flashAttributes?.lockColor,
    manifestLayer.name,
    manifestLayer.selectedTexture?.color,
  ]
    .map(faceColorOptionKey)
    .filter(Boolean)
    .map((key) => options[key])
    .find((v) => !!v);
  return { color: picked ?? base, isExplicitColor: !!picked };
}

// Flash blendMode -> Canvas composite-op (site `sS`).
function blendModeName(mode, fallback) {
  if (!mode) return fallback;
  const t = mode.trim().toLowerCase();
  const map = {
    normal: "source-over",
    multiply: "multiply",
    overlay: "overlay",
    screen: "screen",
    hardlight: "hard-light",
    "hard-light": "hard-light",
    lighten: "lighten",
    darken: "darken",
  };
  return map[t] ?? fallback;
}

// Ordered layer resolution from the head-material manifest (site `tS`).
function faceLayerDefs(options, manifest) {
  const defs = new Map(FACE_LAYERS.map((s) => [s.name, s]));
  const entries = (manifest?.layers ?? [])
    .filter((l) => !l.isControllerOnly)
    .map((layer) => ({ layer, definition: defs.get(layer.name) }))
    .filter((s) => !!s.definition);
  const resolved = entries.length ? entries : FACE_LAYERS.map((definition) => ({ layer: undefined, definition }));
  return resolved.map(({ layer, definition }) => ({
    name: definition.name,
    path: definition.resolvePath(options),
    ...faceSelection(options, layer, definition),
    role: definition.role,
    blendMode: blendModeName(layer?.flashAttributes?.blendMode, definition.blendMode),
    opacity: definition.opacity,
    manifestLayer: layer,
  }));
}

// Role-based SVG tint before rasterizing (site `vS`).
function faceSVGTint(svg, color, role, eyeSecondary) {
  if (role === "head") return svg;
  if (role === "mouth") {
    return svg
      .replaceAll('stroke="#000000"', `stroke="${color}"`)
      .replaceAll('fill="#000000"', `fill="${color}"`);
  }
  if (role === "solid" || role === "multiply") {
    return svg
      .replace(/fill="#(?!none)[0-9a-fA-F]{6}"/g, `fill="${color}"`)
      .replace(/stroke="#(?!none)[0-9a-fA-F]{6}"/g, `stroke="${color}"`);
  }
  return svg
    .replaceAll("#00ff00", color)
    .replaceAll("#00ff01", color)
    .replaceAll("#00c000", adjustHexColor(color, -0.22))
    .replaceAll("#008000", adjustHexColor(color, -0.35))
    .replaceAll("#ff0000", eyeSecondary)
    .replaceAll("#400000", adjustHexColor(eyeSecondary, -0.35))
    .replaceAll("#400101", adjustHexColor(eyeSecondary, -0.35));
}

const faceSymbolCache = new Map(); // Dh
// Fetch + tint + decode a face symbol bitmap (site `kh`).
function loadFaceSymbol(path, color, role, eyeSecondary = "#400000") {
  const key = `${path}:${color}:${eyeSecondary}:${role}`;
  if (faceSymbolCache.has(key)) return faceSymbolCache.get(key);
  const promise = fetch(`${FACE_SPRITE_BASE}${path}`)
    .then((res) => {
      if (!res.ok) throw new Error(`Face symbol not found: ${path}`);
      return res.text();
    })
    .then(async (svg) => ({ image: await svgToBitmap(faceSVGTint(svg, color, role, eyeSecondary)), path, ...decodeSVGBitmap(svg) }));
  faceSymbolCache.set(key, promise);
  return promise;
}

const maskSymbolCache = new Map(); // Ih
// Fetch a face symbol raw for masking (no tint) (site `fS`).
function loadMaskSymbol(url) {
  const relative = url.startsWith(FACE_SPRITE_BASE) ? url.slice(FACE_SPRITE_BASE.length) : null;
  if (!relative) return Promise.resolve(null);
  if (maskSymbolCache.has(relative)) return maskSymbolCache.get(relative);
  const promise = fetch(url)
    .then((res) => (res.ok ? res.text() : null))
    .then(async (svg) => {
      if (!svg) return null;
      return { image: await svgToBitmap(svg), path: relative, ...decodeSVGBitmap(svg) };
    });
  maskSymbolCache.set(relative, promise);
  return promise;
}

// Whether the layer needs a multiply tint pass (site `pS`).
function shouldTintFaceLayer(layer) {
  if (layer.role === "head") return false;
  return !!(layer.manifestLayer?.selectedTexture?.color || layer.manifestLayer?.flashAttributes?.lockColor);
}

// Hex -> RGBA color-matrix multiplications (site `mS`).
function colorMatrixFor(hex) {
  const base = hex.startsWith("#") ? hex.slice(1) : hex;
  const val = parseInt(base.length === 3 ? base.split("").map((c) => `${c}${c}`).join("") : base, 16);
  return Number.isFinite(val) ? [(val >> 16 & 255) / 255, (val >> 8 & 255) / 255, (val & 255) / 255, 1, 0, 0, 0, 0] : [1, 1, 1, 1, 0, 0, 0, 0];
}

// Apply an 8-element RGBA multiply+add matrix ignoring transparent pixels (site `gS`).
function tintBitmap(ctx, matrix) {
  const [r, s, a, o, l, c, h, u] = matrix;
  const img = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height);
  const data = img.data;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] !== 0) {
      data[i] = Math.max(0, Math.min(255, Math.round(data[i] * r + l)));
      data[i + 1] = Math.max(0, Math.min(255, Math.round(data[i + 1] * s + c)));
      data[i + 2] = Math.max(0, Math.min(255, Math.round(data[i + 2] * a + h)));
      data[i + 3] = Math.max(0, Math.min(255, Math.round(data[i + 3] * o + u)));
    }
  }
  ctx.putImageData(img, 0, 0);
}

// Mask canvas for a layer (grabMask + texture masks), null when empty (site `dS`).
async function resolveFaceMask(layer, maskCache) {
  const masks = layer.manifestLayer?.selectedTexture?.masks ?? [];
  const grab = layer.manifestLayer?.flashAttributes?.grabMask;
  if (!masks.length && !grab) return null;
  const canvas = document.createElement("canvas");
  canvas.width = FACE_ATLAS_WIDTH;
  canvas.height = FACE_ATLAS_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  if (grab) {
    const cached = maskCache.get(grab);
    if (cached) ctx.drawImage(cached, 0, 0);
  }
  for (const mask of masks) {
    const url = mask.maskSelectionPublicPath ?? mask.maskPublicPath ?? null;
    if (!url) continue;
    const bitmap = await loadMaskSymbol(url);
    if (bitmap) {
      ctx.drawImage(bitmap.image, bitmap.x * FACE_SUPERSAMPLE, bitmap.y * FACE_SUPERSAMPLE, bitmap.width * FACE_SUPERSAMPLE, bitmap.height * FACE_SUPERSAMPLE);
    }
  }
  const nonEmpty = ctx.getImageData(0, 0, canvas.width, canvas.height).data.some((v) => v !== 0);
  return nonEmpty ? canvas : null;
}

// Rasterize a symbol bitmap into a full-aspect canvas (site `cS`).
function faceSymbolBitmapCanvas(bitmap) {
  const canvas = document.createElement("canvas");
  canvas.width = FACE_ATLAS_WIDTH;
  canvas.height = FACE_ATLAS_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap.image, bitmap.x * FACE_SUPERSAMPLE, bitmap.y * FACE_SUPERSAMPLE, bitmap.width * FACE_SUPERSAMPLE, bitmap.height * FACE_SUPERSAMPLE);
  }
  return canvas;
}

// Composite one face layer onto the atlas canvas (site `lS`).
async function placeFaceLayer(target, bitmap, layer, maskCache) {
  const tile = document.createElement("canvas");
  tile.width = target.canvas.width;
  tile.height = target.canvas.height;
  const ctx = tile.getContext("2d");
  if (!ctx) return;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap.image, bitmap.x * FACE_SUPERSAMPLE, bitmap.y * FACE_SUPERSAMPLE, bitmap.width * FACE_SUPERSAMPLE, bitmap.height * FACE_SUPERSAMPLE);
  if (shouldTintFaceLayer(layer)) tintBitmap(ctx, colorMatrixFor(layer.color));
  const mask = await resolveFaceMask(layer, maskCache);
  if (mask) {
    ctx.save();
    ctx.globalCompositeOperation = "destination-in";
    ctx.drawImage(mask, 0, 0);
    ctx.restore();
  }
  target.save();
  if (layer.blendMode) target.globalCompositeOperation = layer.blendMode;
  if (layer.opacity !== undefined) target.globalAlpha = layer.opacity;
  target.drawImage(tile, 0, 0);
  target.restore();
}

// Resolve a layer's tint from its manifest palette selection (site `hS`).
async function resolveFaceLayerColor(layer) {
  if (layer.isExplicitColor) return layer.color;
  const selected = layer.manifestLayer?.selectedTexture;
  const paletteRef = selected?.color;
  const index = Number.parseInt(selected?.colorSelection ?? layer.manifestLayer?.flashAttributes?.colorIndex ?? "", 10);
  if (!paletteRef || !Number.isFinite(index)) return layer.color;
  const url = PALETTE_URLS[paletteRef];
  if (!url) return layer.color;
  const palette = await loadPalette(url);
  if (!palette?.length) return layer.color;
  const clamped = Math.min(Math.max(index, 0), palette.length - 1);
  return palette[clamped] ?? layer.color;
}

const faceTextureCache = new Map(); // Lh

// Face atlas texture factory (site `fd`).
export function buildFaceAtlasTexture(options = {}) {
  const o = options;
  const key = [
    o.eyeStyle, o.mouthStyle, o.eyeColor, o.eyeSecondaryColor ?? "", o.skinColor ?? "",
    o.spotStyle ?? "", o.spotColor ?? "", o.eyeShadowStyle ?? "", o.eyeShadowColor ?? "",
    o.maskStyle ?? "", o.maskColor ?? "", o.browStyle ?? "", o.beardStyle ?? "",
    o.beardColor ?? "", o.mustacheStyle ?? "", o.glassesStyle ?? "", o.glassesColor ?? "",
  ].join(":");
  if (faceTextureCache.has(key)) return faceTextureCache.get(key);

  const canvas = document.createElement("canvas");
  canvas.width = FACE_ATLAS_WIDTH;
  canvas.height = FACE_ATLAS_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context is unavailable.");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = o.skinColor ?? FACE_HEAD_FILL;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const texture = new THREE.CanvasTexture(canvas);
  texture.name = `OriginalSWFFace:${key}`;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.flipY = false;
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.needsUpdate = true;
  faceTextureCache.set(key, texture);
  paintFaceTexture(canvas, texture, o);
  return texture;
}

// Async paint (site `eS`); callers may await to guarantee the atlas is drawn once.
export async function paintFaceTexture(canvas, texture, options) {
  const manifest = await loadHeadMaterial();
  const defs = faceLayerDefs(options, manifest);
  await Promise.all(defs.map(async (def) => {
    if (!def.path) return null;
    return loadFaceSymbol(def.path, def.color, def.role, options.eyeSecondaryColor);
  }));
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = options.skinColor ?? FACE_HEAD_FILL;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  const maskCache = new Map();
  for (const def of defs) {
    if (!def.path) continue;
    const color = await resolveFaceLayerColor(def);
    const bitmap = await loadFaceSymbol(def.path, color, def.role, options.eyeSecondaryColor);
    if (!bitmap || !ctx) continue;
    await placeFaceLayer(ctx, bitmap, { ...def, color }, maskCache);
    maskCache.set(def.name, faceSymbolBitmapCanvas(bitmap));
  }
  texture.needsUpdate = true;
  return texture;
}

// ---- hair material (site `gd`, `TS`, `Ya`) ----
// Procedural 270x180 hair material: base + pattern + streak overlays, each
// drawn source-atop with its tint color. Caps/shaves instead use Hair.jpg.

const HAIR_ATLAS_WIDTH = 270;   // Us
const HAIR_ATLAS_HEIGHT = 180;  // Os
const HAIR_BASE_URL = `${ASSET_BASE}/hair-material/Hair.svg`; // xS
const DEFAULT_HAIR_MATERIAL = { baseColor: "#15191d", patternIndex: 0, patternColor: "#747a7d", streakIndex: 0, streakColor: "#f0d06a" };

// Pattern overlay catalog (site `$s`).
const HAIR_PATTERNS = [
  { label: "Nenhum", symbol: null, publicPath: null },
  { label: "Gradiente 1", symbol: "Hair_Gradient_1", publicPath: `${ASSET_BASE}/hair-material/Hair_Gradient_1.svg` },
  { label: "Gradiente 2", symbol: "Hair_Gradient_2", publicPath: `${ASSET_BASE}/hair-material/Hair_Gradient_2.svg` },
  { label: "Listra horizontal 1", symbol: "Hair_Stripe_Hor_1", publicPath: `${ASSET_BASE}/hair-material/Hair_Stripe_Hor_1.svg` },
  { label: "Listra horizontal 2", symbol: "Hair_Stripe_Hor_2", publicPath: `${ASSET_BASE}/hair-material/Hair_Stripe_Hor_2.svg` },
  { label: "Listra vertical 1", symbol: "Hair_Stripe_Vert_1", publicPath: `${ASSET_BASE}/hair-material/Hair_Stripe_Vert_1.svg` },
  { label: "Listra vertical 2", symbol: "Hair_Stripe_Vert_2", publicPath: `${ASSET_BASE}/hair-material/Hair_Stripe_Vert_2.svg` },
  { label: "Manchas 1", symbol: "Hair_Spots_1", publicPath: `${ASSET_BASE}/hair-material/Hair_Spots_1.svg` },
  { label: "Manchas 2", symbol: "Hair_Spots_2", publicPath: `${ASSET_BASE}/hair-material/Hair_Spots_2.svg` },
];

// Streak overlay catalog (site `Ys`).
const HAIR_STREAKS = [
  { label: "Nenhuma", symbol: null, publicPath: null },
  { label: "Mecha 1", symbol: "Hair_Streak_1", publicPath: `${ASSET_BASE}/hair-material/Hair_Streak_1.svg` },
  { label: "Mecha 2", symbol: "Hair_Streak_2", publicPath: `${ASSET_BASE}/hair-material/Hair_Streak_2.svg` },
  { label: "Mecha 3", symbol: "Hair_Streak_3", publicPath: `${ASSET_BASE}/hair-material/Hair_Streak_3.svg` },
  { label: "Mecha 4", symbol: "Hair_Streak_4", publicPath: `${ASSET_BASE}/hair-material/Hair_Streak_4.svg` },
  { label: "Mecha 5", symbol: "Hair_Streak_5", publicPath: `${ASSET_BASE}/hair-material/Hair_Streak_5.svg` },
];

// Clamp a catalog index to range (site `js`).
function clampCatalogIndex(value, entries) {
  return Number.isFinite(value) ? Math.min(Math.max(Math.round(value ?? 0), 0), Math.max(entries.length - 1, 0)) : 0;
}

// Cache-key for a hair material config (site `_d`).
function hairMaterialKey(config) {
  return JSON.stringify({
    baseColor: config.baseColor ?? "#15191d",
    patternIndex: clampCatalogIndex(config.patternIndex, HAIR_PATTERNS),
    patternColor: config.patternColor ?? "#747a7d",
    streakIndex: clampCatalogIndex(config.streakIndex, HAIR_STREAKS),
    streakColor: config.streakColor ?? "#f0d06a",
  });
}

const hairImageCache = new Map(); // Bh (Image loads)
function loadHairImage(url) {
  if (hairImageCache.has(url)) return hairImageCache.get(url);
  const promise = new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
  hairImageCache.set(url, promise);
  return promise;
}

// Draw one overlay: raster at 270x180 then source-atop tint (site `Ya`).
async function paintHairOverlay(target, url, color) {
  const img = await loadHairImage(url);
  if (!img) return;
  const tile = document.createElement("canvas");
  tile.width = HAIR_ATLAS_WIDTH;
  tile.height = HAIR_ATLAS_HEIGHT;
  const ctx = tile.getContext("2d");
  if (!ctx) return;
  ctx.drawImage(img, 0, 0, Math.min(img.naturalWidth || HAIR_ATLAS_WIDTH, HAIR_ATLAS_WIDTH), Math.min(img.naturalHeight || HAIR_ATLAS_HEIGHT, HAIR_ATLAS_HEIGHT));
  ctx.globalCompositeOperation = "source-atop";
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, tile.width, tile.height);
  target.drawImage(tile, 0, 0);
}

const hairTextureCache = new Map();  // Er
const hairTextureDrawing = new Set(); // ks

// Hair material texture factory (site `gd`).
export function buildHairTexture(config = {}) {
  const key = hairMaterialKey(config);
  if (hairTextureCache.has(key)) return hairTextureCache.get(key);

  const canvas = document.createElement("canvas");
  canvas.width = HAIR_ATLAS_WIDTH;
  canvas.height = HAIR_ATLAS_HEIGHT;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.flipY = false;
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.anisotropy = 4;
  hairTextureCache.set(key, texture);

  if (!hairTextureDrawing.has(key)) {
    hairTextureDrawing.add(key);
    paintHairTexture(canvas, texture, config)
      .catch((err) => console.warn("Failed to draw hair material texture.", err))
      .finally(() => hairTextureDrawing.delete(key));
  }
  return texture;
}

// Async paint (site `TS`).
export async function paintHairTexture(canvas, texture, config) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return texture;
  const c = { ...DEFAULT_HAIR_MATERIAL, ...config };
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  await paintHairOverlay(ctx, HAIR_BASE_URL, c.baseColor);
  const pattern = HAIR_PATTERNS[clampCatalogIndex(c.patternIndex, HAIR_PATTERNS)];
  if (pattern?.publicPath) await paintHairOverlay(ctx, pattern.publicPath, c.patternColor);
  const streak = HAIR_STREAKS[clampCatalogIndex(c.streakIndex, HAIR_STREAKS)];
  if (streak?.publicPath) await paintHairOverlay(ctx, streak.publicPath, c.streakColor);
  texture.needsUpdate = true;
  return texture;
}