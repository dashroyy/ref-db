// Product viewer (drag to spin, auto-rotate, recolour, replay the print) and a
// thumbnail renderer that turns every [data-thumb] into a real 3D render with
// one shared WebGL context.

import * as THREE from 'three';
import { buildModel, setCut, setFilament, modelHeight, calm, LAYER_H, type Shape } from './print.ts';

function stage(renderer: THREE.WebGLRenderer) {
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight('#c4b5ff', '#20120a', 1.0));
  const key = new THREE.DirectionalLight('#ffffff', 1.7);
  key.position.set(2.5, 4, 3);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = key.shadow.camera.bottom = -1.6;
  key.shadow.camera.right = key.shadow.camera.top = 1.6;
  scene.add(key);
  const rim = new THREE.DirectionalLight('#9b6bff', 2.4);
  rim.position.set(-3, 1.5, -2.5);
  scene.add(rim);
  const warm = new THREE.PointLight('#ffab2e', 1.2, 6);
  warm.position.set(2, 0.6, 1.5);
  scene.add(warm);
  // turntable disc with a glowing rim
  const disc = new THREE.Mesh(
    new THREE.CylinderGeometry(1.25, 1.3, 0.08, 64),
    new THREE.MeshStandardMaterial({ color: '#171326', roughness: 0.55, metalness: 0.3 }),
  );
  disc.position.y = -0.06;
  disc.receiveShadow = true;
  scene.add(disc);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.27, 0.008, 8, 128), new THREE.MeshBasicMaterial({ color: '#9b6bff' }));
  ring.rotation.x = Math.PI / 2;
  ring.position.y = -0.02;
  scene.add(ring);
  return { scene, disc, ring };
}

/** Size the turntable to a model: a little wider than its footprint. */
function fitDisc(t: { disc: THREE.Mesh; ring: THREE.Mesh }, model: THREE.Object3D) {
  const box = new THREE.Box3().setFromObject(model);
  const r = Math.max(box.max.x - box.min.x, box.max.z - box.min.z) / 2 * 1.08 + 0.12;
  const s = r / 1.27;
  t.disc.scale.set(s, 1, s);
  t.ring.scale.set(s, s, 1);
}

function frameCamera(camera: THREE.PerspectiveCamera, model: THREE.Object3D, aspect: number, zoom = 1) {
  // fit the model's bounding sphere (turntable included) in the view
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const radius = Math.hypot(Math.max(size.x, size.z) * 0.6 + 0.15, size.y / 2) * 1.02;
  const vfov = (camera.fov * Math.PI) / 180;
  const fit = Math.min(vfov, 2 * Math.atan(Math.tan(vfov / 2) * aspect));
  const dist = (radius / Math.sin(fit / 2)) * zoom;
  const dir = new THREE.Vector3(0.62, 0.48, 0.78).normalize();
  const target = new THREE.Vector3(0, size.y * 0.45, 0);
  camera.position.copy(target).addScaledVector(dir, dist);
  camera.lookAt(target);
}

export function mountViewer(canvas: HTMLCanvasElement, shape: Shape, color: string) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  const t = stage(renderer);
  const scene = t.scene;
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  const pivot = new THREE.Group();
  scene.add(pivot);
  const model = buildModel(shape, color);
  pivot.add(model);
  fitDisc(t, model);
  const height = modelHeight(model);

  const resize = () => {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    frameCamera(camera, model, camera.aspect);
  };
  new ResizeObserver(resize).observe(canvas);
  resize();

  // drag to spin, with inertia; auto-rotate resumes when idle
  let rotY = -0.5, vel = 0, dragging = false, lastX = 0, idle = 0;
  canvas.addEventListener('pointerdown', (e) => {
    dragging = true;
    lastX = e.clientX;
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const dx = e.clientX - lastX;
    lastX = e.clientX;
    vel = dx * 0.01;
    rotY += vel;
    idle = 0;
  });
  const up = () => (dragging = false);
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);

  let printT = -1; // < 0: not printing
  let clock = 0, last = performance.now(), visible = true;
  new IntersectionObserver(([e]) => (visible = e.isIntersecting)).observe(canvas);

  const draw = (dt: number) => {
    clock += dt;
    idle += dt;
    if (!dragging) {
      vel *= Math.pow(0.04, dt);
      rotY += vel + (idle > 1.5 && !calm() ? dt * 0.45 : 0);
    }
    pivot.rotation.y = rotY;
    let cut = 99;
    if (printT >= 0) {
      printT += dt;
      const p = Math.min(1, printT / 3.2);
      cut = Math.ceil((p * height) / LAYER_H) * LAYER_H;
      if (p >= 1) printT = -1;
    }
    setCut(model, cut, clock);
    renderer.render(scene, camera);
  };
  const loop = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (visible && !document.hidden && (!calm() || dragging || printT >= 0 || Math.abs(vel) > 1e-4)) draw(dt);
    requestAnimationFrame(loop);
  };
  draw(0);
  requestAnimationFrame(loop);

  return {
    setColor(c: string) {
      setFilament(model, c);
      draw(0);
    },
    reprint() {
      printT = 0;
      idle = 0;
    },
  };
}

/** Render every [data-thumb] element (data-shape, data-color) to an image, once. */
export function renderThumbs(root: ParentNode = document) {
  const els = [...root.querySelectorAll<HTMLElement>('[data-thumb]:not([data-thumb-done])')];
  if (!els.length) return;
  const W = 640, H = 480;
  const canvas = document.createElement('canvas');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(W, H, false);
  const t = stage(renderer);
  const scene = t.scene;
  const camera = new THREE.PerspectiveCamera(30, W / H, 0.1, 50);
  const work = () => {
    const el = els.shift();
    if (!el) {
      renderer.dispose();
      return;
    }
    const model = buildModel(el.dataset.shape as Shape, el.dataset.color || '#ffab2e');
    model.rotation.y = -0.55;
    scene.add(model);
    fitDisc(t, model);
    frameCamera(camera, model, W / H, 0.92);
    setCut(model, 99, 1.3);
    renderer.render(scene, camera);
    const img = new Image();
    img.alt = '';
    img.src = canvas.toDataURL('image/webp', 0.9);
    img.className = 'thumb-3d';
    el.appendChild(img);
    el.dataset.thumbDone = '';
    requestAnimationFrame(() => el.classList.add('thumb-ready'));
    scene.remove(model);
    model.traverse((o) => (o as THREE.Mesh).geometry?.dispose?.());
    (window.requestIdleCallback ?? ((f: () => void) => setTimeout(f, 16)))(work);
  };
  work();
}
