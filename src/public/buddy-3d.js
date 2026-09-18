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
// Passing `orbit: true` in the mount options wires OrbitControls onto the
// stage canvas so the viewer can drag to rotate the camera around the buddy.
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
import { OrbitControls } from "/vendor/three-examples/controls/OrbitControls.js";
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
import { resolvePart, resolveProps, MOUTH_TO_FRAME, DEFAULT_MOUTH_FRAME, faceSymbolPath } from "./avatar.js";

const FOV = 35;
const FACE_ATLAS_W = 500;
const FACE_ATLAS_H = 250;

// Framing margin: how much empty stage surrounds the buddy. Larger values pull
// the camera back, so the avatar renders smaller inside the stage frame.
const FRAME_MARGIN = 2.0;

// Default face colors for the lens when the composition doesn't set them.
const FACE_DEFAULTS = {
  skin: "#f0c49e",
  eye: "#3a2a68",
  eyeSecondary: "#3a2a68",
  glasses: "#1b1f24",
  beard: "#1b1714",
  eyeShadow: "#5b3540",
  mask: "#1b1f24",
};

// ---- authentic vocabulary -> buddylabs part options ----
//
// `labsComposition` maps the canonical `avatarDef` (see `avatar.js`) onto the
// buddylabs build options. `resolvePart`/`resolveProps`/`faceSymbolPath`
// validate every value against the catalog so any stored composition keeps
// rendering: hair = Hair-catalog mesh name, eyes = eye sprite family, mouth =
// mouth-frame name, props = Props-catalog item (or none), skirt = Skrt item,
// clothing = per-body-material-layer symbol selections, face = per-face-layer
// symbol names (via `faceSymbolPath` -> sprite directory).

export function labsComposition(composition, mood) {
  const comp = composition && typeof composition === "object" ? composition : {};
  const colors = comp.colors && typeof comp.colors === "object" ? comp.colors : {};
  const faceOpt = comp.face && typeof comp.face === "object" ? comp.face : {};

  const hair = resolvePart("hair", comp.hair);
  const eyes = resolvePart("eyes", comp.eyes);
  const props = resolveProps(comp.props);
  const skirt = resolvePart("skirt", comp.skirt);
  const frame = MOUTH_TO_FRAME[comp.mouth] ?? DEFAULT_MOUTH_FRAME;

  const skinColor = colors.skin || FACE_DEFAULTS.skin;
  const beardColor = colors.beard || FACE_DEFAULTS.beard;
  const lens = {
    skinColor,
    eyeStyle: eyes,
    eyeColor: colors.eye || FACE_DEFAULTS.eye,
    eyeSecondaryColor: FACE_DEFAULTS.eyeSecondary,
    mouthStyle: `frame-${frame}`,
    spotStyle: faceSymbolPath(faceOpt.spot),
    spotColor: adjustHex(skinColor, -0.22),
    eyeShadowStyle: faceSymbolPath(faceOpt.eyeShadow),
    eyeShadowColor: FACE_DEFAULTS.eyeShadow,
    maskStyle: faceSymbolPath(faceOpt.mask),
    maskColor: FACE_DEFAULTS.mask,
    browStyle: faceSymbolPath(faceOpt.brows),
    beardStyle: faceSymbolPath(faceOpt.beard),
    beardColor,
    mustacheStyle: faceSymbolPath(faceOpt.mustache),
    glassesStyle: faceSymbolPath(faceOpt.glasses),
    glassesColor: FACE_DEFAULTS.glasses,
  };

  const hairMaterial = comp.hairMaterial && typeof comp.hairMaterial === "object" ? comp.hairMaterial : {};
  return {
    face: lens,
    hairItemName: hair,
    accessoryItemName: props === "none" ? null : props,
    clothingItemName: skirt === "SkrtNone" ? null : skirt,
    clothing: isPlainObject(comp.clothing) ? comp.clothing : {},
    hairMaterial: {
      baseColor: colors.hair || "#15191d",
      patternIndex: hairMaterial.patternIndex ?? 0,
      patternColor: hairMaterial.patternColor || "#747a7d",
      streakIndex: hairMaterial.streakIndex ?? 0,
      streakColor: hairMaterial.streakColor || "#f0d06a",
    },
    animation: moodAnimation(mood),
    colors,
  };
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

// ---- mood -> idle skeleton animation (subset in animations-subset.json) ----

function moodAnimation(mood) {
  return (MOODS[mood] && MOODS[mood].animation) || DEFAULT_IDLE_ANIMATION;
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

// Module-wide asset bundle shared by every mount (single or paired). The
// underlying fetches are already cached in `buddylabs.js`; this turns the three
// promises into one convenient tuple both mount paths await.
let assetBundlePromise = null;
function loadAssetBundle() {
  return (assetBundlePromise ??= Promise.all([loadGeometry(), loadAnimations(), loadBodyMaterial()]).then(
    ([geometry, animations, bodyMaterial]) => ({ geometry, animations, bodyMaterial })
  ));
}

// Mount-local mouth-frame repaint machinery, factored so single and pair mounts
// share the same repaint-while-atlas-painting behavior: mutate the mount-local
// mouth style to the new frame, repaint the face atlas, then restore.
function makeMouthPainter(getLabs, getFaceTexture) {
  let painting = null;
  let lastAppliedFrame = null;
  function repaint(frame) {
    const labs = getLabs();
    const faceTexture = getFaceTexture();
    if (!faceTexture || !labs || !labs.face) return;
    if (painting) return;
    const next = labs.face.mouthStyle;
    labs.face = { ...labs.face, mouthStyle: `frame-${frame}` };
    painting = paintFaceTexture(faceTexture.image, faceTexture, labs.face)
      .catch((err) => console.warn("buddylabs: mouth frame repaint failed", err))
      .finally(() => {
        painting = null;
        labs.face.mouthStyle = next;
      });
  }
  function handleFrame(frame) {
    if (frame == null || frame === lastAppliedFrame) return;
    repaint(frame);
    lastAppliedFrame = frame;
  }
  function reset() {
    painting = null;
    lastAppliedFrame = null;
  }
  return { repaint, handleFrame, reset };
}

// Build one avatar object from shared assets + a composition/mood. Returns
// `{ labs, faceTexture, built }` where `built` is `buildAvatar`'s
// `{ object, bones }`. The avatar carries its authentic baked root position;
// pair mounts neutralize that and let the choreography place the unit instead.
async function buildAvatarUnit(assets, composition, mood) {
  const labs = labsComposition(composition || {}, mood);
  const face = emptyCanvasTexture(FACE_ATLAS_W, FACE_ATLAS_H, "OriginalSWFFace");
  try {
    const [bodyAtlasTexture] = await Promise.all([
      buildBodyAtlasTexture(assets.bodyMaterial, { clothing: labs.clothing, colors: labs.colors }),
      paintFaceTexture(face.image, face, labs.face),
    ]);
    const hairAtlasTexture = buildHairTexture(labs.hairMaterial);
    const built = buildAvatar(assets.geometry, {
      materialMode: "final",
      face: labs.face,
      bodyMaterial: assets.bodyMaterial,
      bodyAtlasTexture,
      faceAtlasTexture: face,
      hairAtlasTexture,
      hairMaterial: labs.hairMaterial,
      hairItemName: labs.hairItemName,
      clothingItemName: labs.clothingItemName,
      accessoryItemName: labs.accessoryItemName,
    });
    if (!built) {
      face.dispose();
      return null;
    }
    return { labs, faceTexture: face, built };
  } catch (err) {
    face.dispose();
    throw err;
  }
}

export async function mountAvatar(container, options = {}) {
  if (!container) return null;
  let composition = options.composition || {};
  let mood = options.mood;
  const label = options.label || "Avatar";
  const enableOrbit = options.orbit === true;

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

  // Optional drag-to-rotate stage controls (profile, builder, interaction).
  // Rotate-only: pan/zoom stay off so scroll gestures over the stage never
  // fight the page.
  let controls = null;
  if (enableOrbit) {
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = false;
    controls.enableZoom = false;
    controls.rotateSpeed = 0.8;
    controls.minPolarAngle = 0.15 * Math.PI;
    controls.maxPolarAngle = 0.45 * Math.PI;
    controls.cursorStyle = "grab";
    controls.target.set(0, 0, 0);
    controls.update();
  }

  let labs = labsComposition(composition, mood);
  scene.background = new THREE.Color(labs.colors.bg || "#ffe9f3");

  let shared = null; // { geometry, animations, bodyMaterial, hairItems }
  let disposed = false;
  let loaded = false;
  let applyToken = 0;
  let avatar = null;
  let player = null;
  let faceTexture = null;
  const mouthPainter = makeMouthPainter(() => labs, () => faceTexture);

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
    mouthPainter.reset();
  }

  async function applyComposition() {
    const token = ++applyToken;
    labs = labsComposition(composition, mood);
    scene.background = new THREE.Color(labs.colors.bg || "#ffe9f3");
    removeAvatar();
    if (!loaded || !shared) return;

    const unit = await buildAvatarUnit(shared, composition, mood);
    if (token !== applyToken || !unit) {
      if (unit) unit.faceTexture.dispose();
      return;
    }
    faceTexture = unit.faceTexture;
    avatar = unit.built;
    group.add(avatar.object);

    // Frame the avatar from its own bounding box (authentic units, pre-scale).
    avatar.object.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(avatar.object);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const ext = Math.max(size.x, size.y, size.z);
    const dist = ext > 0
      ? (ext / 2 / Math.tan(((FOV / 2) * Math.PI) / 180)) * FRAME_MARGIN
      : CAM_DISTANCE * BUDDY_SCALE;
    camera.fov = FOV;
    camera.updateProjectionMatrix();

    if (controls) {
      // Re-frame around the new center but keep the viewer's current rotation.
      const offset = camera.position.clone().sub(controls.target);
      if (offset.lengthSq() < 1e-9) offset.set(0, 0, 1);
      controls.target.copy(center);
      camera.position.copy(center).addScaledVector(offset.normalize(), dist);
      camera.lookAt(center.x, center.y, center.z);
      controls.update();
    } else {
      camera.position.set(0, 0, dist);
      camera.lookAt(center.x, center.y, center.z);
    }

    player = new AvatarAnimationPlayer(avatar.object, avatar.bones, shared.animations);
    // The mood animation is the looping idle: play it immediately and let the
    // player loop it (`loop: true`) until a poke scene takes over the stage.
    if (!player.play(unit.labs.animation)) {
      player.play(DEFAULT_IDLE_ANIMATION);
    }
    mouthPainter.handleFrame(player.headMaterialFrame);
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
        mouthPainter.handleFrame(player.headMaterialFrame);
      }
    }

    animateGroup(now);
    if (controls) controls.update();
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
    if (controls) {
      controls.dispose();
      controls = null;
    }
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
      shared = await loadAssetBundle();
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

// ---- shared-frame stage ----
//
// mountSharedStage(container, { sender, target, label, onEffect }) -> controller
//   - Stage two buddies inside ONE renderer/camera/scene. Each buddy is a unit
//     built via `buildAvatar`/`labsComposition` with its own `AvatarAnimationPlayer`
//     (bone sets differ per avatar), but the units share the camera, lights and
//     the render loop.
//   - The controller exposes `play(choreography)` which drives the pair through
//     the interaction's keyframe tracks (world-space offsets relative to the
//     stage center), fires per-buddy skeletal one-shots and effect cues at their
//     scheduled moments, and resolves exactly once when the total duration has
//     elapsed (including recoil/settle).
//   - Choreography is declarative data owned by `interactions.js`:
//       {
//         duration: <seconds>,
//         resting: { sender: { x, y }, target: { x, y } },   // framing/reduced-motion layout
//         sender:  { yaw, tracks: [[t, { x, y, rotZ, scale }]], animCues: [{ t, name }] },
//         target:  { yaw, tracks: [...], animCues: [...] },
//         effects: [{ t, name }]                              // each fires onEffect(name)
//       }
//   - WebGL fallback and `prefers-reduced-motion` behave like the single mount:
//     no WebGL -> styled fallback message; reduced motion -> static shared frame
//     (resting layout, no approach/recoil, no cues).
//
// The avatar's baked root position (-1.35, .08, 0) is a single-mount framing
// constant; pair units neutralize it so the choreography decides placement.

const DEFAULT_BACKGROUND = "#ffe9f3";

// Sample a `[[t, state], ...]` track at `t`, interpolating linearly between
// keyframes. Only properties present on the surrounding keyframes are filled.
function sampleWorldTrack(track, t) {
  const out = { x: 0, y: 0, rotZ: 0, scale: 1 };
  if (!track || track.length === 0) return out;
  for (let i = 0; i < track.length - 1; i++) {
    const [t0, s0] = track[i];
    const [t1, s1] = track[i + 1];
    if (t <= t1) {
      const span = t1 - t0 || 1;
      const p = Math.min(Math.max((t - t0) / span, 0), 1);
      for (const key of ["x", "y", "rotZ", "scale"]) {
        if (s0[key] !== undefined && s1[key] !== undefined) out[key] = s0[key] + (s1[key] - s0[key]) * p;
        else if (s1[key] !== undefined) out[key] = s1[key];
        else if (s0[key] !== undefined) out[key] = s0[key];
      }
      return out;
    }
  }
  const last = track[track.length - 1][1];
  for (const key of ["x", "y", "rotZ", "scale"]) if (last[key] !== undefined) out[key] = last[key];
  return out;
}

function sampleResting(resting) {
  return { x: 0, y: 0, rotZ: 0, scale: 1, ...(resting || {}) };
}

export async function mountSharedStage(container, options = {}) {
  if (!container) return null;
  const label = options.label || "Poke stage";
  const onEffect = typeof options.onEffect === "function" ? options.onEffect : null;
  const senderDef = options.sender || {};
  const targetDef = options.target || {};

  container.replaceChildren();
  container.classList.remove("buddy-3d-fallback");
  container.classList.add("buddy-3d-mounted", "interaction-live");
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

  scene.add(new THREE.AmbientLight(0xffffff, 0.9));
  const key = new THREE.DirectionalLight(0xffffff, 1.5);
  key.position.set(0.5, 1, 0.8);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xffffff, 0.5);
  fill.position.set(-0.6, 0.2, 0.5);
  scene.add(fill);

  const pair = new THREE.Group();
  scene.add(pair);

  let assets = null;
  let disposed = false;
  let loaded = false;
  let senderUnit = null;
  let targetUnit = null;
  let senderPainter = null;
  let targetPainter = null;
  let currentChoreography = null;
  let playback = null; // { choreography, start, resolved, resolve, fired }

  let raf = 0;
  const resizeObserver = new ResizeObserver(() => {
    if (disposed || !senderUnit || !targetUnit) return;
    const w = container.clientWidth || 1;
    const h = container.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    frameCamera(currentChoreography);
  });
  resizeObserver.observe(container);

  function dispose() {
    if (disposed) return;
    disposed = true;
    cancelAnimationFrame(raf);
    resizeObserver.disconnect();
    if (playback && !playback.resolved) {
      playback.resolved = true;
      playback.resolve();
      playback = null;
    }
    for (const unit of [senderUnit, targetUnit]) removeUnit(unit);
    senderUnit = targetUnit = null;
    scene.background = null;
    renderer.dispose();
    renderer.forceContextLoss();
    canvas.remove();
    container.classList.remove("buddy-3d-mounted", "interaction-live");
    if (container.getAttribute("role") === "img") container.removeAttribute("role");
  }

  function play(choreography) {
    if (disposed) return Promise.resolve();
    if (!choreography) return Promise.resolve();
    if (playback && !playback.resolved) {
      playback.resolved = true;
      playback.resolve();
    }
    currentChoreography = choreography;
    frameCamera(choreography);
    playback = {
      choreography,
      start: performance.now(),
      resolved: false,
      resolve: null,
      fired: new Set(),
    };
    return new Promise((resolve) => {
      playback.resolve = resolve;
    });
  }

  const controller = {
    canvas,
    get isFallback() {
      return false;
    },
    get container() {
      return container;
    },
    play,
    destroy: dispose
  };

  async function buildUnit(composition, mood) {
    const unit = await buildAvatarUnit(assets, composition, mood);
    if (!unit) return null;
    unit.group = new THREE.Group();
    unit.built.object.position.set(0, 0, 0);
    unit.group.add(unit.built.object);
    unit.player = new AvatarAnimationPlayer(unit.built.object, unit.built.bones, assets.animations);
    if (!unit.player.play(unit.labs.animation)) unit.player.play(DEFAULT_IDLE_ANIMATION);
    pair.add(unit.group);
    return unit;
  }

  function removeUnit(unit) {
    if (!unit) return;
    if (unit.group && unit.group.parent) unit.group.parent.remove(unit.group);
    if (unit.built) {
      unit.built.object.traverse((node) => {
        if (node.isMesh) {
          const list = Array.isArray(node.material) ? node.material : [node.material];
          for (const m of list) if (m) m.dispose();
          if (node.geometry && !node.geometry.userData.shared) node.geometry.dispose();
        }
      });
    }
    if (unit.faceTexture) unit.faceTexture.dispose();
  }

  try {
    assets = await loadAssetBundle();
    loaded = true;
    senderPainter = makeMouthPainter(() => (senderUnit ? senderUnit.labs : null), () => (senderUnit ? senderUnit.faceTexture : null));
    targetPainter = makeMouthPainter(() => (targetUnit ? targetUnit.labs : null), () => (targetUnit ? targetUnit.faceTexture : null));
    const [s, t] = await Promise.all([
      buildUnit(senderDef.composition, senderDef.mood),
      buildUnit(targetDef.composition, targetDef.mood),
    ]);
    senderUnit = s;
    targetUnit = t;
  } catch (err) {
    console.error("buddy-3d: shared-stage asset load failed", err);
    dispose();
    return makeFallback(container, "The 3D buddy model couldn't be loaded right now.");
  }
  if (disposed) return controller;
  if (!senderUnit || !targetUnit) {
    dispose();
    return makeFallback(container, "The 3D buddy model couldn't be loaded right now.");
  }

  scene.background = new THREE.Color((senderUnit.labs.colors && senderUnit.labs.colors.bg) || DEFAULT_BACKGROUND);

  function measureUnit(unit) {
    unit.built.object.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(unit.built.object);
    return {
      halfW: Math.abs(box.max.x - box.min.x) / 2,
      halfH: Math.abs(box.max.y - box.min.y) / 2,
      halfD: Math.abs(box.max.z - box.min.z) / 2,
    };
  }

  // Pastry-time sampling of the widest staged extent: union the two avatar
  // boxes at (a) every sender/target keyframe and (b) the neutral resting
  // layout, then frame that union around its midpoint. Fits the widest extent
  // of the choreography (resting vs. contact) so nobody walks out of frame.
  function computeFrameBox(choreography) {
    const sBox = measureUnit(senderUnit);
    const tBox = measureUnit(targetUnit);
    const resting = (choreography && choreography.resting) || {};
    const rs = sampleResting(resting.sender);
    const rt = sampleResting(resting.target);

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, minZ = Infinity, maxZ = -Infinity;
    const include = (center, box) => {
      minX = Math.min(minX, center.x - box.halfW);
      maxX = Math.max(maxX, center.x + box.halfW);
      minY = Math.min(minY, center.y - box.halfH);
      maxY = Math.max(maxY, center.y + box.halfH);
      minZ = Math.min(minZ, center.z - box.halfD);
      maxZ = Math.max(maxZ, center.z + box.halfD);
    };

    const times = new Set([0]);
    if (choreography) {
      const duration = Number(choreography.duration) || 0;
      times.add(duration);
      for (const side of [choreography.sender, choreography.target]) {
        if (!side || !Array.isArray(side.tracks)) continue;
        for (const [t] of side.tracks) times.add(t);
      }
    }
    for (const tau of times) {
      const s = choreography && choreography.sender
        ? sampleWorldTrack(choreography.sender.tracks, tau)
        : rs;
      const t = choreography && choreography.target
        ? sampleWorldTrack(choreography.target.tracks, tau)
        : rt;
      include({ x: s.x, y: s.y, z: 0 }, sBox);
      include({ x: t.x, y: t.y, z: 0 }, tBox);
    }
    include({ x: rs.x, y: rs.y, z: 0 }, sBox);
    include({ x: rt.x, y: rt.y, z: 0 }, tBox);

    return { minX, maxX, minY, maxY, minZ, maxZ };
  }

  function frameCamera(choreography) {
    const w = container.clientWidth || 1;
    const h = container.clientHeight || 1;
    const aspect = Math.max(w / h, 0.001);
    const box = computeFrameBox(choreography);
    const cx = (box.minX + box.maxX) / 2;
    const cy = (box.minY + box.maxY) / 2;
    const cz = (box.minZ + box.maxZ) / 2;
    const sizeX = Math.max(box.maxX - box.minX, 0.001);
    const sizeY = Math.max(box.maxY - box.minY, 0.001);
    const tan = Math.tan(((FOV / 2) * Math.PI) / 180);
    // Fit both the vertical and the horizontal extent at the current aspect so
    // narrow stages (and resizes) keep both buddies visible.
    const distH = (sizeY / 2 / tan) * FRAME_MARGIN;
    const distW = (sizeX / 2 / (tan * aspect)) * FRAME_MARGIN;
    const dist = Math.max(distH, distW, 0.01);
    camera.position.set(cx, cy, cz + dist);
    camera.lookAt(cx, cy, cz);
  }

  function applyUnitAt(unit, side, t) {
    if (!unit || !side) return;
    const state = sampleWorldTrack(side.tracks, t);
    unit.group.position.set(state.x, state.y, 0);
    unit.group.rotation.set(0, side.yaw || 0, state.rotZ, "YXZ");
    const s = state.scale || 1;
    unit.group.scale.set(s, s, s);
  }

  function applyResting(unit, side, resting) {
    if (!unit) return;
    const state = sampleResting(resting);
    unit.group.position.set(state.x, state.y, 0);
    unit.group.rotation.set(0, (side && side.yaw) || 0, state.rotZ, "YXZ");
    const s = state.scale || 1;
    unit.group.scale.set(s, s, s);
  }

  function cueKey(scope, name) {
    return `${scope}:${name}`;
  }

  function fireAnimCues(unit, side, t, fired) {
    if (!unit || !side || !Array.isArray(side.animCues)) return;
    for (const cue of side.animCues) {
      if (!cue || t < cue.t) continue;
      const key = cueKey("anim", cue.name);
      if (fired.has(key)) continue;
      fired.add(key);
      if (unit.player && unit.player.play(cue.name)) unit.returnToIdle = true;
    }
  }

  function fireEffectCues(choreography, t, fired) {
    if (!choreography || !Array.isArray(choreography.effects) || !onEffect) return;
    for (const cue of choreography.effects) {
      if (!cue || t < cue.t) continue;
      const key = cueKey("fx", cue.name);
      if (fired.has(key)) continue;
      fired.add(key);
      onEffect(cue.name);
    }
  }

  function animateStep(now) {
    const reduced = prefersReducedMotion();
    const ch = playback ? playback.choreography : null;
    if (playback && ch) {
      const start = playback.start;
      const t = reduced
        ? Infinity
        : Math.min((now - start) / 1000, Math.max(Number(ch.duration) || 0, 0));
      if (reduced) {
        applyResting(senderUnit, ch.sender, ch.resting && ch.resting.sender);
        applyResting(targetUnit, ch.target, ch.resting && ch.resting.target);
      } else {
        applyUnitAt(senderUnit, ch.sender, t);
        applyUnitAt(targetUnit, ch.target, t);
        fireAnimCues(senderUnit, ch.sender, t, playback.fired);
        fireAnimCues(targetUnit, ch.target, t, playback.fired);
        fireEffectCues(ch, t, playback.fired);
      }
      if (!reduced && t >= (Number(ch.duration) || 0) && !playback.resolved) {
        playback.resolved = true;
        playback.resolve();
        playback = null;
      } else if (reduced && !playback.resolved) {
        // Static reduced-motion frame: settle immediately (still resolve once).
        playback.resolved = true;
        playback.resolve();
        playback = null;
      }
    }
  }

  function advanceUnits(dt) {
    const reduced = prefersReducedMotion();
    const units = [
      { unit: senderUnit, painter: senderPainter },
      { unit: targetUnit, painter: targetPainter },
    ];
    for (const { unit, painter } of units) {
      if (!unit || !unit.player) continue;
      if (reduced) continue;
      unit.player.update(dt);
      if (unit.returnToIdle && !unit.player.playing) {
        unit.returnToIdle = false;
        unit.player.play(unit.labs.animation || DEFAULT_IDLE_ANIMATION);
      }
      if (painter) painter.handleFrame(unit.player.headMaterialFrame);
    }
  }

  let lastTick = performance.now();
  function loop(now) {
    if (disposed) return;
    const dt = Math.min((now - lastTick) / 1000, 0.1);
    lastTick = now;

    animateStep(now);
    advanceUnits(dt);
    renderer.render(scene, camera);
    raf = requestAnimationFrame(loop);
  }

  if (!disposed) {
    frameCamera(null);
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