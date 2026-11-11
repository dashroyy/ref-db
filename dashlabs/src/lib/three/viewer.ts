// Product viewer (drag to spin, auto-rotate, recolour, replay the print) and a
// thumbnail renderer that turns every [data-thumb] into a real 3D render with
// one shared WebGL context.

import * as THREE from 'three';
import { scaleProps } from './scale.ts';
import { buildModel, setCut, setFilament, setLook, modelHeight, calm, LAYER_H, type Shape } from './print.ts';

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
  // a cool back light so dark filaments (matte black) still show their edges
  const back = new THREE.DirectionalLight('#d9ccff', 1.4);
  back.position.set(0.5, 2.2, -3.5);
  scene.add(back);
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
  // follow Day shift / Night shift
  const applyTheme = () => {
    const light = document.documentElement.dataset.theme === 'light';
    (disc.material as THREE.MeshStandardMaterial).color.set(light ? '#e9e1f5' : '#171326');
    (ring.material as THREE.MeshBasicMaterial).color.set(light ? '#7d55e6' : '#9b6bff');
  };
  applyTheme();
  new MutationObserver(applyTheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  return { scene, disc, ring };
}

/** Size the turntable to a model: a little wider than its footprint. */
function fitDisc(t: { disc: THREE.Mesh; ring: THREE.Mesh }, model: THREE.Object3D) {
  // reach the furthest point of whatever is on the turntable (centred or not)
  const box = new THREE.Box3().setFromObject(model);
  const r = Math.max(Math.abs(box.min.x), Math.abs(box.max.x), Math.abs(box.min.z), Math.abs(box.max.z)) * 1.08 + 0.12;
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
  const centre = box.getCenter(new THREE.Vector3());
  const target = new THREE.Vector3(centre.x, size.y * 0.45, centre.z);
  camera.position.copy(target).addScaledVector(dir, dist);
  camera.lookAt(target);
}

export function mountViewer(canvas: HTMLCanvasElement, shape: Shape, color: string) {
  return mountModel(canvas, buildModel(shape, color));
}

/**
 * Show any model (base at y = 0) on the turntable: drag to spin, auto-rotate,
 * recolour, replay the print, or swap in another model (e.g. an uploaded STL).
 */
export function mountModel(canvas: HTMLCanvasElement, first: THREE.Object3D) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, Math.min(innerWidth, innerHeight) < 700 ? 1.5 : 2));
  const t = stage(renderer);
  const scene = t.scene;
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  const pivot = new THREE.Group();
  scene.add(pivot);
  let model = first;
  let height = 1;
  let framed: THREE.Object3D = model; // what the camera and turntable fit: the model, or the model + scale props
  let zoom = 1;
  const place = (m: THREE.Object3D) => {
    pivot.add(m);
    framed = m;
    fitDisc(t, m);
    height = modelHeight(m);
    frameCamera(camera, m, camera.aspect || 1);
  };
  place(model);

  const resize = () => {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    frameCamera(camera, framed, camera.aspect, zoom);
  };
  new ResizeObserver(resize).observe(canvas);
  resize();

  // drag to spin, with inertia; auto-rotate resumes when idle
  let rotY = -0.5, vel = 0, dragging = false, lastX = 0, idle = 0;
  let faceTo: number | null = null; // swing round to face the viewer (e.g. while typing text)
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
  let scrubCut: number | null = null; // 0..1 of the height, set from outside (layer slider, scroll story)
  let spin = true;
  let printDur = 3.2;
  let clock = 0, last = performance.now(), visible = true;
  new IntersectionObserver(([e]) => (visible = e.isIntersecting)).observe(canvas);

  const draw = (dt: number) => {
    clock += dt;
    idle += dt;
    if (faceTo !== null && !dragging) {
      rotY += (faceTo - rotY) * Math.min(1, dt * 6);
      if (Math.abs(faceTo - rotY) < 0.002) faceTo = null;
    } else if (!dragging) {
      vel *= Math.pow(0.04, dt);
      rotY += vel + (spin && idle > 2.5 && !calm() ? dt * 0.45 : 0);
    }
    pivot.rotation.y = rotY;
    let cut = scrubCut === null ? 99 : Math.max(LAYER_H, Math.ceil((scrubCut * height) / LAYER_H) * LAYER_H);
    if (scrubCut !== null && scrubCut >= 0.999) cut = 99;
    if (printT >= 0) {
      printT += dt;
      const p = Math.min(1, printT / printDur);
      cut = Math.ceil((p * height) / LAYER_H) * LAYER_H;
      if (p >= 1) printT = -1;
    }
    setCut(model, cut, clock);
    renderer.render(scene, camera);
  };
  const loop = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (visible && !document.hidden && (!calm() || dragging || printT >= 0 || faceTo !== null || Math.abs(vel) > 1e-4)) draw(dt);
    requestAnimationFrame(loop);
  };
  draw(0);
  requestAnimationFrame(loop);

  return {
    setColor(c: string) {
      setFilament(model, c);
      draw(0);
    },
    reprint(seconds = 3.2) {
      printDur = seconds;
      printT = 0;
      idle = 0;
    },
    /** Change the current model (e.g. add text), then redraw. */
    async edit(fn: (m: THREE.Object3D) => void | Promise<void>) {
      await fn(model);
      draw(0);
    },
    /**
     * Drive the view from outside: cut at a fraction of the height (null = whole part),
     * CAD wireframe, layer-line strength, auto-spin on/off.
     */
    scrub(s: { cut?: number | null; wire?: boolean; lines?: number; spin?: boolean }) {
      if (s.cut !== undefined) scrubCut = s.cut;
      if (s.spin !== undefined) spin = s.spin;
      if (s.wire !== undefined || s.lines !== undefined) setLook(model, s);
      printT = -1;
      draw(0);
    },
    /** Layers in the current model at the print's layer height. */
    layers: () => Math.round(height / LAYER_H),
    /** Turn the front of the model toward the viewer (the shortest way round). */
    /** Show a ruler and a bank card at real size beside the model (null hides them). */
    showScale(sz: { mm: number; axis: 'height' | 'length' } | null) {
      const old = pivot.getObjectByName('scale-props');
      if (old) pivot.remove(old);
      const keep = pivot.rotation.y;
      pivot.rotation.y = 0;
      if (sz) {
        pivot.add(scaleProps(model, sz.mm, sz.axis));
        framed = pivot;
        spin = false;
        zoom = 1.3; // the turntable grows with the props; keep it in view
      } else {
        framed = model;
        spin = true;
        zoom = 1;
      }
      fitDisc(t, framed);
      frameCamera(camera, framed, camera.aspect || 1, zoom);
      pivot.rotation.y = keep;
      this.face();
      draw(0);
    },
    face() {
      const front = -0.5;
      const turns = Math.round((rotY - front) / (Math.PI * 2));
      faceTo = front + turns * Math.PI * 2;
      vel = 0;
      idle = 0;
    },
    replace(next: THREE.Object3D) {
      pivot.remove(model);
      model.traverse((o) => (o as THREE.Mesh).geometry?.dispose?.());
      model = next;
      place(model);
      rotY = -0.5;
      draw(0);
    },
  };
}

// One shared thumbnail renderer and a cache, so re-rendered lists (the cart)
// reuse images instead of drawing the same model twice.
const thumbCache = new Map<string, string>();
let thumbQueue: HTMLElement[] = [];
let thumbBusy = false;

/** Render every [data-thumb] element (data-shape, data-color) to an image, once. */
export function renderThumbs(root: ParentNode = document) {
  const els = [...root.querySelectorAll<HTMLElement>('[data-thumb]:not([data-thumb-done])')];
  for (const el of els) el.dataset.thumbDone = '';
  thumbQueue.push(...els);
  if (thumbBusy || !thumbQueue.length) return;
  thumbBusy = true;
  const W = 640, H = 480;
  const canvas = document.createElement('canvas');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(W, H, false);
  const t = stage(renderer);
  const scene = t.scene;
  const camera = new THREE.PerspectiveCamera(30, W / H, 0.1, 50);
  const show = (el: HTMLElement, src: string) => {
    const img = new Image();
    img.alt = '';
    img.src = src;
    img.className = 'thumb-3d';
    el.appendChild(img);
    requestAnimationFrame(() => el.classList.add('thumb-ready'));
  };
  const work = async () => {
    const el = thumbQueue.shift();
    if (!el) {
      renderer.dispose();
      thumbBusy = false;
      return;
    }
    const text = el.dataset.text ?? '';
    const key = `${el.dataset.shape}|${el.dataset.color}|${text}|${el.dataset.textColor ?? ''}`;
    let src = thumbCache.get(key);
    if (!src) {
      const model = buildModel(el.dataset.shape as Shape, el.dataset.color || '#ffab2e');
      if (text) {
        // personalised items show the customer's own text
        const { applyText, cleanText } = await import('./text.ts');
        await applyText(model, cleanText(text, 40), el.dataset.textColor || '#ece6da');
      }
      model.rotation.y = -0.55;
      scene.add(model);
      fitDisc(t, model);
      frameCamera(camera, model, W / H, 0.92);
      setCut(model, 99, 1.3);
      renderer.render(scene, camera);
      src = canvas.toDataURL('image/webp', 0.9);
      thumbCache.set(key, src);
      scene.remove(model);
      model.traverse((o) => (o as THREE.Mesh).geometry?.dispose?.());
    }
    show(el, src);
    (window.requestIdleCallback ?? ((f: () => void) => setTimeout(f, 16)))(() => void work());
  };
  void work();
}
