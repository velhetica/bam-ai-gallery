import * as THREE from 'three';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import gsap from 'gsap';
import { createStrokes } from './plates.js';

const ROOM_LAST = 5;
const INK = 0x080807;

// Look offset stays constant so the instrument remains on the right
// while the camera dollies. Parallax comes from depth, not from yawing
// the plate across the type.
const CAMERA_KEYS = [
  { x: 1.25, y: 0.12, z: 8.5, lx: 4.15, ly: 0.12 },
  { x: 1.25, y: 0.12, z: 7.6, lx: 4.15, ly: 0.12 },
  { x: 0.15, y: 0.12, z: 8.85, lx: 3.05, ly: 0.12 },
  { x: 1.4, y: 0.12, z: 10.5, lx: 4.3, ly: 0.12 },
  { x: 0.25, y: 0.12, z: 7.4, lx: 3.15, ly: 0.12 },
  { x: 0.85, y: 0.12, z: 9.7, lx: 3.75, ly: 0.12 },
];

function clamp01(v) {
  return Math.min(1, Math.max(0, v));
}

function densify(points, step) {
  const count = points.length / 3;
  if (count < 2) return points.slice();
  const out = [points[0], points[1], points[2]];
  for (let i = 0; i < count - 1; i += 1) {
    const ax = points[i * 3];
    const ay = points[i * 3 + 1];
    const az = points[i * 3 + 2];
    const bx = points[(i + 1) * 3];
    const by = points[(i + 1) * 3 + 1];
    const bz = points[(i + 1) * 3 + 2];
    const dist = Math.hypot(bx - ax, by - ay, bz - az);
    const steps = Math.max(1, Math.ceil(dist / step));
    for (let s = 1; s <= steps; s += 1) {
      const t = s / steps;
      out.push(ax + (bx - ax) * t, ay + (by - ay) * t, az + (bz - az) * t);
    }
  }
  return out;
}

function lengthOf(points) {
  let total = 0;
  for (let i = 3; i < points.length; i += 3) {
    total += Math.hypot(
      points[i] - points[i - 3],
      points[i + 1] - points[i - 2],
      points[i + 2] - points[i - 1],
    );
  }
  return total;
}

function scheduleOpening(strokes) {
  let cursor = 0.35;
  strokes.forEach((stroke) => {
    if (!stroke.opening) return;
    if (Number.isFinite(stroke.at) && Number.isFinite(stroke.dur)) return;
    const len = lengthOf(stroke.points);
    const tick = len < 0.55;
    const duration = tick ? 0.32 : Math.min(1.55, 0.48 + len * 0.14);
    stroke.at = cursor;
    stroke.dur = duration;
    cursor += tick ? 0.042 : Math.max(0.16, duration * 0.4);
  });
  let end = cursor;
  strokes.forEach((stroke) => {
    if (!stroke.opening || !Number.isFinite(stroke.at)) return;
    end = Math.max(end, stroke.at + stroke.dur);
  });
  return end;
}

function sequenced(order, count, presence) {
  if (presence <= 0) return 0;
  if (count <= 1) return clamp01(presence);
  const span = 0.36;
  const start = (order / (count - 1)) * (1 - span);
  return clamp01((presence - start) / span);
}

function blendFactor(fraction) {
  const held = Math.min(1, fraction / 0.42);
  const smooth = held * held * (3 - 2 * held);
  return smooth * 0.8 + fraction * 0.2;
}

function presenceFor(index, roomFloat) {
  const base = Math.floor(roomFloat);
  const fraction = roomFloat - base;
  const eased = blendFactor(fraction);
  if (index === base) return 1 - eased;
  if (index === base + 1) return eased;
  return 0;
}

function sampleCamera(roomFloat, target, compact) {
  const maxIndex = CAMERA_KEYS.length - 1;
  const clamped = Math.min(maxIndex, Math.max(0, roomFloat));
  const index = Math.min(maxIndex - 1, Math.floor(clamped));
  const fraction = clamped >= maxIndex ? 1 : clamped - index;
  const eased = clamped >= maxIndex ? 1 : blendFactor(fraction);
  const a = CAMERA_KEYS[index];
  const b = CAMERA_KEYS[Math.min(maxIndex, index + 1)];
  const zPull = compact ? 4.5 : 0;
  target.px = a.x + (b.x - a.x) * eased;
  target.py = a.y + (b.y - a.y) * eased;
  target.pz = a.z + (b.z - a.z) * eased + zPull;
  target.lx = a.lx + (b.lx - a.lx) * eased;
  target.ly = a.ly + (b.ly - a.ly) * eased;
}

export function createExhibition(canvas, { reduced, compact }) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance',
    failIfMajorPerformanceCaveat: false,
  });

  const context = renderer.getContext();
  if (!context) {
    return {
      setScroll() {},
      resize() {},
      render() {},
      destroy() {},
    };
  }

  renderer.setClearColor(INK, 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(compact ? 34 : 32, 1, 0.1, 80);
  const rig = new THREE.Group();
  const heroRig = new THREE.Group();
  scene.add(rig);
  scene.add(heroRig);

  const view = { px: 0, py: 0, pz: 9, lx: 3.4, ly: 0.12 };
  let roomFloat = 0;
  let isCompact = compact;
  let pixelRatio = 1;
  let timeline = null;
  const built = [];
  const materials = new Map();

  function materialFor(color, cssWidth, opacity = 1) {
    const key = `${color}:${cssWidth}:${opacity}`;
    let material = materials.get(key);
    if (!material) {
      const faded = opacity < 0.999;
      material = new LineMaterial({
        color,
        linewidth: cssWidth * pixelRatio,
        worldUnits: false,
        dashed: false,
        alphaToCoverage: !faded,
        transparent: faded,
        opacity,
        depthWrite: !faded,
        toneMapped: false,
      });
      material.userData.cssWidth = cssWidth;
      materials.set(key, material);
    }
    return material;
  }

  function applyRigShift() {
    if (isCompact) {
      rig.position.set(1.7, 0.72, 0);
      rig.scale.setScalar(0.42);
      heroRig.position.set(-1.05, 0.5, 0);
      heroRig.scale.setScalar(0.84);
      camera.fov = 30;
    } else {
      rig.position.set(0.15, 0.02, 0);
      rig.scale.setScalar(1);
      heroRig.position.set(0.85, -0.42, 0);
      heroRig.scale.setScalar(1);
      camera.fov = 32;
    }
    camera.updateProjectionMatrix();
  }

  function clearBuilt() {
    built.forEach((entry) => {
      entry.mesh.parent?.remove(entry.mesh);
      entry.mesh.geometry.dispose();
    });
    built.length = 0;
    materials.forEach((material) => material.dispose());
    materials.clear();
  }

  function drawAmount(entry) {
    const gate = clamp01((roomFloat - 0.4) / 0.34);
    if (gate <= 0) return 0;

    if (reduced) {
      if (entry.stroke.room === 'persist') return gate;
      return (presenceFor(entry.stroke.room, roomFloat) > 0.5 ? 1 : 0) * gate;
    }

    if (entry.stroke.room === 'persist') {
      const reveal = Math.min(1, Math.max(0, (roomFloat - 0.4) / 0.45));
      return entry.stroke.intro * reveal * gate;
    }

    const presence = presenceFor(entry.stroke.room, roomFloat);
    return sequenced(entry.stroke.order, entry.stroke.count, presence) * gate;
  }

  function applyDraw(entry) {
    const amount = drawAmount(entry);
    const { mesh, maxCount } = entry;
    if (amount <= 0.004 || maxCount < 1) {
      mesh.visible = false;
      return;
    }
    mesh.visible = true;
    mesh.geometry.instanceCount = Math.max(1, Math.min(maxCount, Math.round(amount * maxCount)));
  }

  function build() {
    if (timeline) {
      timeline.kill();
      timeline = null;
    }
    clearBuilt();

    const strokes = createStrokes(isCompact);
    const counts = {};
    strokes.forEach((stroke) => {
      if (stroke.room === 'persist') return;
      counts[stroke.room] = (counts[stroke.room] || 0) + 1;
    });
    const seen = {};
    strokes.forEach((stroke) => {
      stroke.intro = reduced ? 1 : 0;
      if (stroke.room === 'persist') return;
      const order = seen[stroke.room] || 0;
      stroke.order = order;
      stroke.count = counts[stroke.room];
      seen[stroke.room] = order + 1;
    });

    scheduleOpening(strokes);

    strokes.forEach((stroke) => {
      const points = densify(stroke.points, stroke.room === 0 ? 0.08 : 0.05);
      if (points.length < 6) return;
      const geometry = new LineGeometry();
      geometry.setPositions(points);
      const maxCount = geometry.instanceCount;
      const mesh = new Line2(
        geometry,
        materialFor(stroke.color, stroke.width, stroke.opacity ?? 1),
      );
      mesh.frustumCulled = false;
      mesh.visible = false;
      if (stroke.room === 0) heroRig.add(mesh);
      else rig.add(mesh);
      built.push({ stroke, mesh, maxCount });
    });

    applyRigShift();

    if (!reduced) {
      timeline = gsap.timeline({ defaults: { ease: 'power2.inOut' } });
      built.forEach((entry) => {
        const stroke = entry.stroke;
        if (!stroke.opening) {
          stroke.intro = 1;
          return;
        }
        timeline.to(
          stroke,
          { intro: 1, duration: stroke.dur, ease: 'power2.inOut' },
          stroke.at,
        );
      });
    }
  }

  function resize() {
    const width = window.innerWidth;
    const height = Math.max(1, window.innerHeight);
    const nextRatio = Math.min(window.devicePixelRatio || 1, 2);
    const nextCompact = width < 760;
    pixelRatio = nextRatio;
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    if (nextCompact !== isCompact) {
      isCompact = nextCompact;
      build();
      return;
    }
    materials.forEach((material) => {
      material.linewidth = material.userData.cssWidth * pixelRatio;
    });
  }

  function render() {
    sampleCamera(roomFloat, view, isCompact);
    camera.position.set(view.px, view.py, view.pz);
    camera.lookAt(view.lx, view.ly, 0);
    built.forEach(applyDraw);
    renderer.render(scene, camera);
  }

  function setScroll(next) {
    roomFloat = Math.min(ROOM_LAST, Math.max(0, next));
  }

  function destroy() {
    if (timeline) timeline.kill();
    clearBuilt();
    renderer.dispose();
  }

  pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  resize();
  build();
  setScroll(0);
  render();

  return { setScroll, resize, render, destroy };
}
