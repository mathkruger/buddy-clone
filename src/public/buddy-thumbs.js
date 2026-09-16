// buddy-thumbs.js — real-asset picker thumbnails.
//
// One shared WebGL renderer snapshots each authentic part option into a
// transparent PNG data URL (cached per part) so the builder / profile-editor
// picker buttons show the actual vendored meshes instead of the hand-drawn SVG
// placeholder. Snapshots reuse `labsComposition` from `buddy-3d.js`, so a
// thumbnail renders exactly like the selected avatar it represents.
//
// Rendering is serialized on a single context (browsers cap the number of live
// WebGL contexts), generated lazily after the pickers are drawn, and cached for
// the life of the page.

import * as THREE from "three";
import {
  BUDDY_SCALE,
  loadGeometry,
  loadBodyMaterial,
  buildAvatar,
  buildBodyAtlasTexture,
  buildHairTexture,
  paintFaceTexture,
} from "./buddylabs.js";
import { isWebGLAvailable, labsComposition } from "./buddy-3d.js";
import { renderPartSnippet, partLabel, defaultComposition } from "./avatar.js";

const THUMB_W = 200;
const THUMB_H = 220;
const FOV = 35;

// Face-atlas size shared with the renderer (buddylabs FACE_ATLAS_WIDTH/HEIGHT).
const FACE_ATLAS_WIDTH = 500;
const FACE_ATLAS_HEIGHT = 250;

// Accessory parts that only change the face (crop the thumbnail to the head).
const FACE_ACCESSORIES = new Set(["glasses", "mustache", "beard"]);

let supplies = null;
let drain = Promise.resolve();
const snapshotCache = new Map();

async function ensureSupplies() {
  if (supplies) return supplies;
  const [geometry, bodyMaterial] = await Promise.all([loadGeometry(), loadBodyMaterial()]);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setPixelRatio(2);
  renderer.setSize(THUMB_W, THUMB_H, false);
  const scene = new THREE.Scene();
  scene.background = null;
  const camera = new THREE.PerspectiveCamera(FOV, THUMB_W / THUMB_H, 0.001, 100);
  scene.add(new THREE.AmbientLight(0xffffff, 0.9));
  const key = new THREE.DirectionalLight(0xffffff, 1.5);
  key.position.set(0.5, 1, 0.8);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xffffff, 0.5);
  fill.position.set(-0.6, 0.2, 0.5);
  scene.add(fill);
  supplies = { renderer, scene, camera, geometry, bodyMaterial };
  return supplies;
}

// A mount-local face atlas canvas so per-thumbnail paints never touch the
// cached face textures used by live avatars (mirrors buddy-3d's approach).
function emptyFaceTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = FACE_ATLAS_WIDTH;
  canvas.height = FACE_ATLAS_HEIGHT;
  const texture = new THREE.CanvasTexture(canvas);
  texture.name = "part-thumb-face";
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.flipY = false;
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.needsUpdate = true;
  return { canvas, texture };
}

function variantComposition(category, name) {
  const base = defaultComposition();
  const comp = {
    head: base.head,
    eyes: base.eyes,
    mouth: base.mouth,
    accessory: "none",
    colors: { ...base.colors },
  };
  if (category === "head") comp.head = name;
  else if (category === "eyes") comp.eyes = name;
  else if (category === "mouth") comp.mouth = name;
  else comp.accessory = name;
  return comp;
}

function thumbZoom(category, name) {
  if (category === "eyes" || category === "mouth") return "face";
  if (category === "accessory") return FACE_ACCESSORIES.has(name) ? "face" : "body";
  return "body";
}

// Frame the camera on the whole body, or on the top (head) region for parts
// that only change the face. Runs in the authentic pre-scale units the avatar
// is built in (BUDDY_SCALE already applied to the root).
function frameCamera(obj, zoom) {
  const full = new THREE.Box3().setFromObject(obj);
  const size = full.getSize(new THREE.Vector3());
  let box = full;
  if (zoom === "face") {
    const maxY = full.max.y;
    const cropH = Math.min(size.y * 0.45, 1.15 * BUDDY_SCALE);
    box = new THREE.Box3(
      new THREE.Vector3(full.min.x, maxY - cropH, full.min.z),
      new THREE.Vector3(full.max.x, maxY, full.max.z)
    );
  }
  const boxSize = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const ext = Math.max(boxSize.x, boxSize.y, boxSize.z);
  const margin = zoom === "face" ? 1.7 : 1.25;
  const dist = ext > 0 ? (ext / 2 / Math.tan((FOV / 2) * Math.PI / 180)) * margin : 3 * BUDDY_SCALE;
  const camera = supplies.camera;
  camera.fov = FOV;
  camera.position.set(0, 0, dist);
  camera.lookAt(center.x, center.y, center.z);
  camera.updateProjectionMatrix();
}

function disposeAvatar(root) {
  root.traverse((node) => {
    if (node.isMesh) {
      const list = Array.isArray(node.material) ? node.material : [node.material];
      for (const m of list) if (m) m.dispose();
      if (node.geometry && !node.geometry.userData.shared) node.geometry.dispose();
    }
  });
}

async function renderVariant(category, name) {
  const labs = labsComposition(variantComposition(category, name));
  const zoom = thumbZoom(category, name);
  const s = await ensureSupplies();
  const face = emptyFaceTexture();
  const [bodyAtlasTexture] = await Promise.all([
    buildBodyAtlasTexture(s.bodyMaterial, { colors: labs.colors?.shirt ? { ShrtColor: labs.colors.shirt } : {} }),
    paintFaceTexture(face.canvas, face.texture, labs.face),
  ]);
  const hairAtlasTexture = buildHairTexture(labs.hairMaterial);
  const built = buildAvatar(s.geometry, {
    materialMode: "final",
    face: labs.face,
    bodyMaterial: s.bodyMaterial,
    bodyAtlasTexture,
    faceAtlasTexture: face.texture,
    hairAtlasTexture,
    hairMaterial: labs.hairMaterial,
    hairItemName: labs.hairItemName,
    clothingItemName: labs.clothingItemName,
    accessoryItemName: labs.accessoryItemName,
  });
  if (!built) throw new Error(`part thumb build failed: ${category}/${name}`);
  const root = built.object;
  s.scene.add(root);
  try {
    root.updateMatrixWorld(true);
    frameCamera(root, zoom);
    s.renderer.render(s.scene, s.camera);
    return s.renderer.domElement.toDataURL("image/png");
  } finally {
    s.scene.remove(root);
    disposeAvatar(root);
    face.texture.dispose();
  }
}

function enqueueSnapshot(key, category, name) {
  const cached = snapshotCache.get(key);
  if (cached) return cached;
  const job = drain
    .catch(() => undefined)
    .then(() => renderVariant(category, name));
  snapshotCache.set(key, job);
  drain = job.then(
    () => undefined,
    () => undefined
  );
  return job;
}

// Render an authentic thumbnail for one part into a picker button. Falls back
// to the SVG snippet while snapshots are still generating (they are painted
// lazily on the shared renderer) and when WebGL is unavailable or fails.
export function renderPartThumb(container, category, name) {
  if (!container) return;
  if (!isWebGLAvailable()) {
    container.innerHTML = renderPartSnippet(category, name);
    return;
  }
  const img = document.createElement("img");
  img.className = "part-thumb";
  img.alt = partLabel(category, name);
  container.replaceChildren(img);
  enqueueSnapshot(`${category}/${name}`, category, name).then(
    (src) => {
      if (container.contains(img)) img.src = src;
    },
    () => {
      if (container.contains(img)) container.innerHTML = renderPartSnippet(category, name);
    }
  );
}