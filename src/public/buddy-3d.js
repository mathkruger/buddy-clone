// Three.js/WebGL renderer for buddy avatars — scene orchestration for the
// authentic asset renderer (`buddylabs.js`).
//
// mountAvatar(container, { composition, mood, label }) -> Promise<controller>
//   - loads the shared buddylabs assets (geometry, animation library, material
//     manifests + atlas compositors) exactly once per page (module-wide caches
//     in `buddylabs.js`) and rebuilds an avatar object per mount
//   - builds a fixed camera + lighting scene, applies the composition's
//     background color, composites the authentic body/face/hair atlases, plays
//     the mood's skeletal animation and drives the mouth frame (`mat` channel)
//     in sync with the animation player
//   - returns a controller: { canvas, destroy(), setComposition(), play(motion) }
//
// The avatar scale (.018) and position (-1.35, .08, 0) are the authentic
// constants baked into `buddylabs.js` (`BUDDY_SCALE`/`BUDDY_POSITION`).
//
// Rendering is deterministic for a given (composition, mood): no randomness,
// fixed camera framing. Any differences between devices are limited to
// rasterization anti-aliasing, not scene content.
//
// When WebGL is missing (or blocked) the surface shows a styled fallback
// message instead of a broken blank canvas. Idle animation pauses under
// `prefers-reduced-motion`.

import * as THREE from "three";
import {
  BUDDY_SCALE,
  BUDDY_POSITION,
  loadGeometry,
  loadAnimations,
  loadBodyMaterial,
  buildAvatar,
  buildBodyAtlasTexture,
  buildHairTexture,
  paintFaceTexture,
  AvatarAnimationPlayer,
} from "./buddylabs.js";
import { MOODS, DEFAULT_IDLE_ANIMATION } from "./moods.js";
import { resolvePart, MOUTH_TO_FRAME, DEFAULT_MOUTH_FRAME } from "./avatar.js";

const FOV = 35;
const FACE_ATLAS_W = 500;
const FACE_ATLAS_H = 250;

// ---- authentic vocabulary -> buddylabs part options ----
//
// The `avatarDef` part keys are the authentic asset ids defined in `avatar.js`
// (`AVATAR_PARTS`): head = hair-mesh catalog name, eyes = eye sprite family,
// mouth = mouth-frame name, accessory = authentic extra. `resolvePart`
// validates each value against that set and resets anything outside it (legacy
// hand-drawn values, typos) to the category default, so every stored
// composition keeps rendering.

// Accessory value -> extra options applied to the labs build: caps swap the
// hair mesh (cull regions hide the base hair), glasses/facial hair are face
// atlas layers, Rose/Mic/Sword are Props-catalog meshes.
const ACCESSORY_PRESETS = {
  none: {},
  glasses: { glassesStyle: "DefineSprite_686_Glas_6", glassesColor: "#1b1f24" },
  "BCap_Hair": { hairItemName: "BCap_Hair" },
  "SCap_Hair": { hairItemName: "SCap_Hair" },
  mustache: { beardStyle: "DefineSprite_654_Must_Thick" },
  beard: { beardStyle: "DefineSprite_683_Berd_Full" },
  Rose: { accessoryItemName: "Rose" },
  Mic: { accessoryItemName: "Mic" },
  Sword: { accessoryItemName: "Sword" },
};

// ---- mood -> idle skeleton animation (subset in animations-subset.json) ----

function moodAnimation(mood) {
  return (MOODS[mood] && MOODS[mood].animation) || DEFAULT_IDLE_ANIMATION;
}

export function labsComposition(composition, mood) {
  const comp = composition && typeof composition === "object" ? composition : {};
  const colors = comp.colors && typeof comp.colors === "object" ? comp.colors : {};
  const head = resolvePart("head", comp.head !== undefined ? comp.head : comp.hair);
  const eyes = resolvePart("eyes", comp.eyes);
  const frame = MOUTH_TO_FRAME[comp.mouth] ?? DEFAULT_MOUTH_FRAME;
  const accessory = ACCESSORY_PRESETS[resolvePart("accessory", comp.accessory)] ?? ACCESSORY_PRESETS.none;

  const skinColor = colors.skin || "#f0c49e";
  const lens = {
    skinColor,
    eyeStyle: eyes,
    eyeColor: colors.accent || colors.skin || "#6d7bd8",
    eyeSecondaryColor: "#3a2a68",
    mouthStyle: `frame-${frame}`,
    ...(accessory.glassesStyle ? { glassesStyle: accessory.glassesStyle, glassesColor: accessory.glassesColor || "#1b1f24" } : {}),
    beardStyle: accessory.beardStyle || (comp.beard ? "DefineSprite_683_Berd_Full" : null),
    beardColor: colors.accent || "#1b1714",
    spotStyle: comp.spot ? "DefineSprite_102_Spot_Beauty_1" : null,
    spotColor: adjustHex(skinColor, -0.22),
    browStyle: comp.brows ? "DefineSprite_98_Brows_Thick" : null,
  };

  return {
    face: lens,
    hairItemName: accessory.hairItemName || head,
    accessoryItemName: accessory.accessoryItemName || null,
    clothingItemName: "SkrtNone",
    hairMaterial: {
      baseColor: colors.accent || comp.hairColor || colors.skin || "#15191d",
      patternIndex: 0,
      patternColor: "#747a7d",
      streakIndex: 0,
      streakColor: "#f0d06a",
    },
    animation: moodAnimation(mood),
    colors,
  };
}

function adjustHex(hex, factor) {
  const base = hex.startsWith("#") ? hex.slice(1) : hex;
  const val = parseInt(base.length === 3 ? base.split("").map((c) => `${c}${c}`).join("") : base, 16);
  if (!Number.isFinite(val)) return "#101418";
  const channel = (shift) => {
    const c = (val >> shift) & 255;
    return Math.max(0, Math.min(255, Math.round(factor < 0 ? c * (1 + factor) : c + (255 - c) * factor)));
  };
  return `#${[channel(16), channel(8), channel(0)].map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

// ---- sender-entrance group motions (procedural, kept from the legacy renderer) ----

const MOTIONS = {
  "sender-fly-tap": { duration: 1300, tracks: { posX: [[0, 0], [0.35, 0.5], [0.6, 0.44], [1, 0]], posY: [[0, 0.04], [0.35, -0.16], [0.6, -0.02], [1, 0]], scale: [[0, 0.9], [0.35, 1.08], [1, 1]] } },
  "sender-glide": { duration: 1300, tracks: { posX: [[0, -0.14], [0.45, 0.5], [1, 0]], posY: [[0, 0], [0.45, -0.08], [1, 0]], scale: [[0, 0.92], [0.45, 1.05], [1, 1]] } },
  "sender-rise": { duration: 1300, tracks: { posX: [[0, 0.04], [0.4, 0.4], [1, 0]], posY: [[0, 0.26], [0.4, -0.1], [1, 0]], scale: [[0, 0.9], [0.4, 1.08], [1, 1]] } },
  "sender-drift": { duration: 1300, tracks: { posX: [[0, 0.06], [0.5, 0.56], [1, 0]], posY: [[0, 0.14], [0.5, -0.06], [1, 0]], rotZ: [[0, -0.07], [0.5, 0.05], [1, 0]], scale: [[0, 0.92], [0.5, 1.06], [1, 1]] } },
  "sender-boogie": { duration: 1300, tracks: { posX: [[0, 0], [0.2, 0.46], [0.45, 0.54], [0.7, 0], [1, 0]], posY: [[0, 0.04], [0.2, -0.08], [0.45, 0], [0.7, -0.08], [1, 0]], rotZ: [[0, 0], [0.2, -0.06], [0.45, 0.08], [0.7, 0], [1, 0]], scale: [[0, 0.92], [0.2, 1.06], [0.45, 1.02], [1, 1]] } },
};

function sampleTrack(track, t) {
  if (!track || track.length === 0) return 0;
  for (let i = 0; i < track.length - 1; i++) {
    const [t0, v0] = track[i];
    const [t1, v1] = track[i + 1];
    if (t <= t1) {
      const span = t1 - t0 || 1;
      return v0 + ((t - t0) / span) * (v1 - v0);
    }
  }
  return track[track.length - 1][1];
}

// ---- WebGL capability + styled fallback ----

let webglCheck = null;

export function isWebGLAvailable() {
  if (webglCheck === null) {
    // Detect once per page: each probe allocates a real browser WebGL context,
    // and browsers cap the number of live contexts (16). Repeating the probe
    // per picker button exhausted the pool and silently killed other contexts.
    webglCheck = (() => {
      try {
        const canvas = document.createElement("canvas");
        return Boolean(
          window.WebGLRenderingContext &&
            (canvas.getContext("webgl2") || canvas.getContext("webgl") || canvas.getContext("experimental-webgl"))
        );
      } catch {
        return false;
      }
    })();
  }
  return webglCheck;
}

function makeFallback(container, message) {
  container.replaceChildren();
  container.classList.add("buddy-3d-fallback");
  const block = document.createElement("div");
  block.className = "avatar-fallback";
  block.setAttribute("role", "img");
  block.setAttribute("aria-label", message);
  block.textContent = message;
  container.appendChild(block);
  let disposed = false;
  return {
    isFallback: true,
    destroy() {
      if (disposed) return;
      disposed = true;
      container.classList.remove("buddy-3d-fallback");
      container.replaceChildren();
      if (container.getAttribute("role") === "img") container.removeAttribute("role");
    }
  };
}

// ---- per-mount scene ----

const CAM_DISTANCE = (0.5 / Math.tan(((FOV / 2) * Math.PI) / 180)) * 1.2;

function prefersReducedMotion() {
  return !!(typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
}

// A mount-local face atlas canvas so animation mouth frames can re-paint one
// mount without mutating the module-shared cached face textures.
function emptyCanvasTexture(width, height, name) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const texture = new THREE.CanvasTexture(canvas);
  texture.name = name;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.flipY = false;
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.needsUpdate = true;
  return texture;
}

export async function mountAvatar(container, options = {}) {
  if (!container) return null;
  let composition = options.composition || {};
  let mood = options.mood;
  const label = options.label || "Avatar";

  container.replaceChildren();
  container.classList.remove("buddy-3d-fallback");
  container.classList.add("buddy-3d-mounted");
  container.setAttribute("role", "img");
  container.setAttribute("aria-label", label);

  if (!isWebGLAvailable()) {
    return makeFallback(container, "WebGL isn't available in this browser, so a 3D buddy can't be drawn here.");
  }

  const width = container.clientWidth || 1;
  const height = container.clientHeight || 1;

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(width, height, false);
  const canvas = renderer.domElement;
  canvas.className = "buddy-3d-canvas";
  container.appendChild(canvas);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, width / height, 0.001, 100);
  camera.position.set(0, 0, CAM_DISTANCE * BUDDY_SCALE);
  camera.lookAt(0, 0, 0);

  scene.add(new THREE.AmbientLight(0xffffff, 0.9));
  const key = new THREE.DirectionalLight(0xffffff, 1.5);
  key.position.set(0.5, 1, 0.8);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xffffff, 0.5);
  fill.position.set(-0.6, 0.2, 0.5);
  scene.add(fill);

  const group = new THREE.Group();
  scene.add(group);

  let labs = labsComposition(composition, mood);
  scene.background = new THREE.Color(labs.colors.bg || "#ffe9f3");

  let shared = null; // { geometry, animations, bodyMaterial, hairItems }
  let disposed = false;
  let loaded = false;
  let applyToken = 0;
  let avatar = null;
  let player = null;
  let faceTexture = null;
  let facePainting = null;
  let lastHeadMaterialFrame = null;
  let lastAppliedFrame = null;

  function removeAvatar() {
    if (avatar) {
      group.remove(avatar.object);
      avatar.object.traverse((node) => {
        if (node.isMesh) {
          const list = Array.isArray(node.material) ? node.material : [node.material];
          for (const m of list) if (m) m.dispose();
          if (node.geometry && !node.geometry.userData.shared) node.geometry.dispose();
        }
      });
      avatar = null;
    }
    player = null;
    faceTexture = null;
    facePainting = null;
    lastHeadMaterialFrame = null;
    lastAppliedFrame = null;
  }

  function repaintMouthFrame(frame) {
    if (!faceTexture || !labs.face) return;
    if (facePainting) return;
    const next = labs.face.mouthStyle;
    labs.face = { ...labs.face, mouthStyle: `frame-${frame}` };
    facePainting = paintFaceTexture(faceTexture.image, faceTexture, labs.face)
      .catch((err) => console.warn("buddylabs: mouth frame repaint failed", err))
      .finally(() => {
        facePainting = null;
        labs.face.mouthStyle = next;
      });
  }

  async function applyComposition() {
    const token = ++applyToken;
    labs = labsComposition(composition, mood);
    scene.background = new THREE.Color(labs.colors.bg || "#ffe9f3");
    removeAvatar();
    if (!loaded || !shared) return;

    const opts = labs;
    const face = emptyCanvasTexture(FACE_ATLAS_W, FACE_ATLAS_H, "OriginalSWFFace");
    faceTexture = face;
    facePainting = null;
    lastHeadMaterialFrame = null;
    lastAppliedFrame = null;

    const [bodyAtlasTexture, facePainted] = await Promise.all([
      buildBodyAtlasTexture(shared.bodyMaterial),
      paintFaceTexture(face.image, face, opts.face),
    ]);
    const hairAtlasTexture = buildHairTexture(opts.hairMaterial);
    if (token !== applyToken) {
      face.dispose();
      return;
    }

    const built = buildAvatar(shared.geometry, {
      materialMode: "final",
      face: opts.face,
      bodyMaterial: shared.bodyMaterial,
      bodyAtlasTexture,
      faceAtlasTexture: face,
      hairAtlasTexture,
      hairMaterial: opts.hairMaterial,
      hairItemName: opts.hairItemName,
      clothingItemName: opts.clothingItemName,
      accessoryItemName: opts.accessoryItemName,
    });
    if (token !== applyToken) {
      face.dispose();
      return;
    }
    if (!built) {
      face.dispose();
      return;
    }
    avatar = built;
    group.add(built.object);

    // Frame the avatar from its own bounding box (authentic units, pre-scale).
    built.object.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(built.object);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const ext = Math.max(size.x, size.y, size.z);
    const dist = ext > 0 ? (ext / 2 / Math.tan((FOV / 2) * Math.PI)) * 1.25 : CAM_DISTANCE * BUDDY_SCALE;
    camera.fov = FOV;
    camera.position.set(0, 0, dist);
    camera.lookAt(center.x, center.y, center.z);
    camera.updateProjectionMatrix();

    player = new AvatarAnimationPlayer(built.object, built.bones, shared.animations);
    if (mood || !player.play(opts.animation)) {
      player.play(DEFAULT_IDLE_ANIMATION);
    }
    lastHeadMaterialFrame = player.headMaterialFrame;
    if (lastHeadMaterialFrame != null && lastHeadMaterialFrame !== lastAppliedFrame) {
      repaintMouthFrame(lastHeadMaterialFrame);
      lastAppliedFrame = lastHeadMaterialFrame;
    }
  }

  // ---- animation ----

  let activeMotion = null;
  let motionStart = 0;
  let motionWaiters = [];
  let oneShot = null;
  let oneShotDuration = 0;
  let lastTick = performance.now();

  function settleMotion() {
    if (activeMotion) {
      activeMotion = null;
      const waiters = motionWaiters;
      motionWaiters = [];
      for (const resolve of waiters) resolve();
    }
  }

  function currentIdleAnimation() {
    return (MOODS[mood] && MOODS[mood].animation) || DEFAULT_IDLE_ANIMATION;
  }

  function animateGroup(now) {
    const reduced = prefersReducedMotion();

    if (activeMotion) {
      const cfg = MOTIONS[activeMotion];
      const p = Math.min((now - motionStart) / cfg.duration, 1);
      const track = (name, fallback) => (cfg.tracks && cfg.tracks[name]) || fallback;
      const posX = sampleTrack(track("posX"), p);
      const posY = sampleTrack(track("posY"), p);
      const rotZ = sampleTrack(track("rotZ"), p);
      const scale = sampleTrack(track("scale", [[0, 1]]), p);
      const scaleY = track("scaleY") ? sampleTrack(track("scaleY"), p) : scale;
      group.position.set(posX, posY, 0);
      group.rotation.z = rotZ;
      group.scale.set(scale, scaleY, scale);
      if (p >= 1) settleMotion();
      return;
    }

    if (reduced) {
      group.position.set(0, 0, 0);
      group.rotation.z = 0;
      group.scale.set(1, 1, 1);
      return;
    }

    // gentle idle sway + the skeletal loop plays underneath
    group.rotation.z = Math.sin(now / 1000 * 0.6) * 0.03;
    group.position.y = Math.sin(now / 1000 * 1.1) * 0.018;
    const breath = 1 + Math.sin(now / 1000 * 1.4) * 0.012;
    group.scale.set(breath, breath, breath);
  }

  function loop(now) {
    if (disposed) return;
    const dt = Math.min((now - lastTick) / 1000, 0.1);
    lastTick = now;

    if (player) {
      if (prefersReducedMotion()) {
        // static bind pose under reduced motion
      } else {
        player.update(dt);
        if (oneShot && player.elapsed >= oneShotDuration) {
          oneShot = null;
          player.play(currentIdleAnimation());
        }
        const frame = player.headMaterialFrame;
        if (frame != null && frame !== lastAppliedFrame) {
          repaintMouthFrame(frame);
          lastAppliedFrame = frame;
        }
      }
    }

    animateGroup(now);
    renderer.render(scene, camera);
    raf = requestAnimationFrame(loop);
  }

  let raf = 0;
  const resizeObserver = new ResizeObserver(() => {
    if (disposed) return;
    const w = container.clientWidth || 1;
    const h = container.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  });
  resizeObserver.observe(container);

  function dispose() {
    if (disposed) return;
    disposed = true;
    ++applyToken;
    cancelAnimationFrame(raf);
    resizeObserver.disconnect();
    settleMotion();
    removeAvatar();
    scene.background = null;
    renderer.dispose();
    renderer.forceContextLoss();
    canvas.remove();
    container.classList.remove("buddy-3d-mounted");
    if (container.getAttribute("role") === "img") container.removeAttribute("role");
  }

  const controller = {
    canvas,
    get isFallback() {
      return false;
    },
    get container() {
      return container;
    },
    setComposition(next, nextMood) {
      composition = next || {};
      if (nextMood !== undefined) mood = nextMood;
      return applyComposition();
    },
    play(name) {
      if (disposed) return Promise.resolve();
      let pending = false;

      // Sender-entrance group motions run procedurally on the stage group.
      if (MOTIONS[name]) {
        activeMotion = name;
        motionStart = performance.now();
        pending = true;
      }

      // One-shot skeletal animation (any mapped subset animation name).
      const animName = player && player.entries.has(name) ? name : null;
      if (player && animName && !prefersReducedMotion() && player.play(animName)) {
        activeMotion = null;
        pending = true;
        const anim = player.entries.get(animName);
        const cycle = anim ? anim.numFrames / Math.max(1, anim.fps || 30) : 0;
        oneShot = animName;
        oneShotDuration = Math.max(cycle, 0.6);
        window.setTimeout(() => {
          const waiters = motionWaiters;
          motionWaiters = [];
          for (const resolve of waiters) resolve();
        }, oneShotDuration * 1000);
        return new Promise((resolve) => motionWaiters.push(resolve));
      }

      if (!pending) return Promise.resolve();
      return new Promise((resolve) => motionWaiters.push(resolve));
    },
    stopMotion() {
      settleMotion();
      oneShot = null;
      if (player) player.play(currentIdleAnimation());
    },
    destroy: dispose
  };

  try {
    if (!shared) {
      const [geometry, animations, bodyMaterial] = await Promise.all([
        loadGeometry(),
        loadAnimations(),
        loadBodyMaterial(),
      ]);
      shared = { geometry, animations, bodyMaterial };
    }
    if (disposed) return controller;
    loaded = true;
    await applyComposition();
    if (disposed) return controller;
  } catch (err) {
    if (disposed) return controller;
    console.error("buddy-3d: buddylabs asset load failed", err);
    dispose();
    return makeFallback(container, "The 3D buddy model couldn't be loaded right now.");
  }

  if (!disposed) {
    lastTick = performance.now();
    raf = requestAnimationFrame(loop);
  }
  return controller;
}

// Convenience wrapper for list surfaces (search results, favorites, grids):
// waits until the element scrolls into view before mounting the 3D avatar and
// disposes it when it leaves view, so the page only ever keeps a handful of
// WebGL contexts alive and near-viewport avatars.
export function mountWhenVisible(el, options, rootMargin = "120px") {
  if (!el) return null;
  let ctl = null;
  let token = 0;
  let disconnected = false;
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) {
          if (ctl) {
            ctl.destroy();
            ctl = null;
          }
          continue;
        }
        if (ctl) continue;
        const t = ++token;
        mountAvatar(el, options).then((c) => {
          if (disconnected || t !== token) {
            if (c && c.destroy) c.destroy();
            return;
          }
          ctl = c;
        });
      }
    },
    { rootMargin }
  );
  io.observe(el);
  return {
    dispose() {
      disconnected = true;
      ++token;
      io.disconnect();
      if (ctl) {
        ctl.destroy();
        ctl = null;
      }
    }
  };
}