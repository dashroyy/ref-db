// The hero printer: a build plate, gantry and print head that print a model
// layer by layer, show it off, slide it off the bed and start the next one.
// Pauses off-screen, on a hidden tab and under Motion off; reduced motion gets
// one finished still frame.

import * as THREE from 'three';
import { buildModel, setCut, modelHeight, calm, LAYER_H, type Shape } from './print.ts';

export interface HeroStatus {
  model: string;
  layer: number;
  layers: number;
  phase: 'heating' | 'printing' | 'done' | 'ejecting';
  temp: number;
}

const QUEUE: { shape: Shape; color: string; name: string }[] = [
  { shape: 'vase', color: '#9b6bff', name: 'Spiral vase' },
  { shape: 'launcher', color: '#ffab2e', name: 'Pen Launcher' },
  { shape: 'bust', color: '#ff6ec7', name: 'Mini-Me figurine' },
  { shape: 'dragon', color: 'rainbow', name: 'Articulated dragon' },
  { shape: 'keychain', color: '#3dffc5', name: 'Name keychain' },
];

function gridTexture() {
  const s = 512;
  const c = document.createElement('canvas');
  c.width = c.height = s;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s * 0.7);
  grad.addColorStop(0, '#1d1830');
  grad.addColorStop(1, '#0c0a14');
  g.fillStyle = grad;
  g.fillRect(0, 0, s, s);
  for (let i = 0; i <= 16; i++) {
    const p = (i / 16) * s;
    g.strokeStyle = i % 4 === 0 ? 'rgba(155,107,255,0.45)' : 'rgba(155,107,255,0.14)';
    g.lineWidth = i % 4 === 0 ? 2 : 1;
    g.beginPath();
    g.moveTo(p, 0);
    g.lineTo(p, s);
    g.moveTo(0, p);
    g.lineTo(s, p);
    g.stroke();
  }
  g.font = '600 22px monospace';
  g.fillStyle = 'rgba(255,171,46,0.55)';
  g.fillText('DASHLABS · BUILD PLATE 01', 24, s - 24);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

export function mountHero(canvas: HTMLCanvasElement, onStatus?: (s: HeroStatus) => void) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  // phones: fewer pixels and a smaller shadow map keep it smooth and cool
  const small = Math.min(innerWidth, innerHeight) < 700;
  renderer.setPixelRatio(Math.min(devicePixelRatio, small ? 1.5 : 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 50);

  // light
  scene.add(new THREE.HemisphereLight('#b9a6ff', '#1a0f05', 0.9));
  const key = new THREE.DirectionalLight('#ffffff', 1.6);
  key.position.set(3, 5, 2.5);
  key.castShadow = true;
  key.shadow.mapSize.set(small ? 512 : 1024, small ? 512 : 1024);
  key.shadow.camera.left = key.shadow.camera.bottom = -2;
  key.shadow.camera.right = key.shadow.camera.top = 2;
  scene.add(key);
  const rim = new THREE.DirectionalLight('#9b6bff', 2.2);
  rim.position.set(-3, 2, -3);
  scene.add(rim);

  // build plate
  const plate = new THREE.Mesh(
    new THREE.BoxGeometry(2.8, 0.08, 2.8),
    [
      new THREE.MeshStandardMaterial({ color: '#15121f', roughness: 0.6 }),
      new THREE.MeshStandardMaterial({ color: '#15121f', roughness: 0.6 }),
      new THREE.MeshStandardMaterial({ map: gridTexture(), roughness: 0.75, metalness: 0.1 }),
      new THREE.MeshStandardMaterial({ color: '#15121f' }),
      new THREE.MeshStandardMaterial({ color: '#15121f' }),
      new THREE.MeshStandardMaterial({ color: '#15121f' }),
    ],
  );
  plate.position.y = -0.04;
  plate.receiveShadow = true;
  scene.add(plate);
  const edge = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(2.82, 0.085, 2.82)),
    new THREE.LineBasicMaterial({ color: '#9b6bff', transparent: true, opacity: 0.8 }),
  );
  edge.position.y = -0.04;
  scene.add(edge);

  // gantry: two posts, an X rail that rides up with the print, and the head
  const metal = new THREE.MeshStandardMaterial({ color: '#4a4068', roughness: 0.3, metalness: 0.75 });
  for (const x of [-1.55, 1.55]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.09, 2.5, 0.09), metal);
    post.position.set(x, 1.21, -0.2);
    scene.add(post);
  }
  const rail = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.08, 0.08), metal);
  scene.add(rail);
  const head = new THREE.Group();
  const block = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.3, 0.3), new THREE.MeshStandardMaterial({ color: '#1c1830', roughness: 0.4, metalness: 0.5 }));
  block.position.y = 0.32;
  head.add(block);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.345, 0.04, 0.305), new THREE.MeshStandardMaterial({ color: '#ffab2e', emissive: '#ffab2e', emissiveIntensity: 0.8 }));
  stripe.position.y = 0.3;
  head.add(stripe);
  const hotend = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.1, 20), new THREE.MeshStandardMaterial({ color: '#7a5a2a', metalness: 0.9, roughness: 0.3 }));
  hotend.position.y = 0.12;
  head.add(hotend);
  const tipMat = new THREE.MeshStandardMaterial({ color: '#ffb347', emissive: '#ff7a00', emissiveIntensity: 1.5, metalness: 0.6, roughness: 0.3 });
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.1, 20), tipMat);
  tip.rotation.x = Math.PI;
  tip.position.y = 0.04;
  head.add(tip);
  const glow = new THREE.PointLight('#ff9a1f', 3, 1.6, 2);
  glow.position.y = 0.0;
  head.add(glow);
  scene.add(head);

  // extrusion trail
  const TRAIL = 40;
  const trailPos = new Float32Array(TRAIL * 3);
  const trailGeo = new THREE.BufferGeometry();
  trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPos, 3));
  const trail = new THREE.Line(trailGeo, new THREE.LineBasicMaterial({ color: '#ffcf70', transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending }));
  trail.frustumCulled = false;
  scene.add(trail);

  // sparks
  const SPARKS = 60;
  const sparkPos = new Float32Array(SPARKS * 3);
  const sparkVel = new Float32Array(SPARKS * 3);
  const sparkLife = new Float32Array(SPARKS);
  const sparkGeo = new THREE.BufferGeometry();
  sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPos, 3));
  const sparks = new THREE.Points(
    sparkGeo,
    new THREE.PointsMaterial({ color: '#ffb347', size: 0.025, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  sparks.frustumCulled = false;
  scene.add(sparks);

  // job state
  let idx = 0;
  let model: THREE.Group = buildModel(QUEUE[0].shape, QUEUE[0].color);
  let height = modelHeight(model);
  let radius = 0.5;
  scene.add(model);
  const fit = () => {
    const box = new THREE.Box3().setFromObject(model);
    radius = Math.max(box.max.x - box.min.x, box.max.z - box.min.z) / 2;
    height = box.max.y;
  };
  fit();

  const T = { heat: 1.2, print: 9, show: 3, eject: 1.4 };
  let phaseT = 0;
  let phase: HeroStatus['phase'] = 'heating';
  let angle = 0;
  let spin = 0;
  let mouseX = 0, mouseY = 0, camX = 0, camY = 0;

  const nextJob = () => {
    scene.remove(model);
    model.traverse((o) => (o as THREE.Mesh).geometry?.dispose?.());
    idx = (idx + 1) % QUEUE.length;
    model = buildModel(QUEUE[idx].shape, QUEUE[idx].color);
    scene.add(model);
    fit();
    spin = 0;
    phase = 'heating';
    phaseT = 0;
  };

  const resize = () => {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  new ResizeObserver(resize).observe(canvas);
  resize();

  canvas.addEventListener('pointermove', (e) => {
    const r = canvas.getBoundingClientRect();
    mouseX = ((e.clientX - r.left) / r.width - 0.5) * 2;
    mouseY = ((e.clientY - r.top) / r.height - 0.5) * 2;
  });
  canvas.addEventListener('pointerleave', () => (mouseX = mouseY = 0));

  let last = performance.now();
  let clock = 0;
  let statusAt = 0;

  function frame(dt: number) {
    clock += dt;
    phaseT += dt;
    let cut = 99;
    let headY = height + 0.25;

    if (phase === 'heating') {
      cut = 0;
      tipMat.emissiveIntensity = 0.4 + (phaseT / T.heat) * 1.4;
      headY = 0.25 + (1 - phaseT / T.heat) * 0.6;
      if (phaseT > T.heat) ((phase = 'printing'), (phaseT = 0));
    } else if (phase === 'printing') {
      const p = Math.min(1, phaseT / T.print);
      const eased = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
      cut = Math.ceil((eased * height) / LAYER_H) * LAYER_H; // snaps layer by layer
      headY = cut + 0.04;
      angle += dt * 9;
      tipMat.emissiveIntensity = 1.8 + Math.sin(clock * 30) * 0.2;
      if (p >= 1) ((phase = 'done'), (phaseT = 0));
    } else if (phase === 'done') {
      spin += dt * 0.9;
      headY = height + 0.25 + Math.min(1, phaseT) * 0.3;
      tipMat.emissiveIntensity = Math.max(0.4, 1.8 - phaseT);
      if (phaseT > T.show) ((phase = 'ejecting'), (phaseT = 0));
    } else {
      const e = Math.min(1, phaseT / T.eject);
      model.position.x = e * e * 4.2;
      model.rotation.z = -e * 0.4;
      headY = height + 0.55;
      if (phaseT > T.eject) {
        model.position.x = 0;
        model.rotation.z = 0;
        nextJob();
      }
    }
    model.rotation.y = spin;
    setCut(model, cut, clock);

    // head path: circles the current layer at the part's radius, with a wobble
    const printing = phase === 'printing';
    const r = printing ? radius * (0.55 + 0.35 * Math.abs(Math.sin(angle * 0.37))) : 0;
    const hx = printing ? Math.cos(angle) * r : 0;
    const hz = printing ? Math.sin(angle) * r * 0.8 : 0;
    head.position.x += (hx - head.position.x) * Math.min(1, dt * 14);
    head.position.z += (hz - head.position.z) * Math.min(1, dt * 14);
    head.position.y += (headY - head.position.y) * Math.min(1, dt * 8);
    rail.position.set(0, head.position.y + 0.32, head.position.z);
    glow.intensity = printing ? 3 + Math.sin(clock * 40) * 0.4 : 1.2;

    // trail
    for (let i = TRAIL - 1; i > 0; i--) {
      trailPos[i * 3] = trailPos[(i - 1) * 3];
      trailPos[i * 3 + 1] = trailPos[(i - 1) * 3 + 1];
      trailPos[i * 3 + 2] = trailPos[(i - 1) * 3 + 2];
    }
    trailPos[0] = head.position.x;
    trailPos[1] = head.position.y - 0.02;
    trailPos[2] = head.position.z;
    trailGeo.attributes.position.needsUpdate = true;
    (trail.material as THREE.LineBasicMaterial).opacity = printing ? 0.9 : Math.max(0, (trail.material as THREE.LineBasicMaterial).opacity - dt);

    // sparks from the nozzle while printing
    for (let i = 0; i < SPARKS; i++) {
      if (sparkLife[i] <= 0 && printing && Math.random() < 0.08) {
        sparkLife[i] = 0.4 + Math.random() * 0.5;
        sparkPos[i * 3] = head.position.x;
        sparkPos[i * 3 + 1] = head.position.y;
        sparkPos[i * 3 + 2] = head.position.z;
        sparkVel[i * 3] = (Math.random() - 0.5) * 0.8;
        sparkVel[i * 3 + 1] = Math.random() * 0.6;
        sparkVel[i * 3 + 2] = (Math.random() - 0.5) * 0.8;
      }
      if (sparkLife[i] > 0) {
        sparkLife[i] -= dt;
        sparkVel[i * 3 + 1] -= 1.6 * dt;
        sparkPos[i * 3] += sparkVel[i * 3] * dt;
        sparkPos[i * 3 + 1] += sparkVel[i * 3 + 1] * dt;
        sparkPos[i * 3 + 2] += sparkVel[i * 3 + 2] * dt;
      } else sparkPos[i * 3 + 1] = -10;
    }
    sparkGeo.attributes.position.needsUpdate = true;

    // camera: slow orbit plus mouse parallax
    camX += (mouseX - camX) * Math.min(1, dt * 3);
    camY += (mouseY - camY) * Math.min(1, dt * 3);
    const orbit = 0.65 + Math.sin(clock * 0.12) * 0.25 + camX * 0.25;
    camera.position.set(Math.sin(orbit) * 6.6, 3.0 - camY * 0.5, Math.cos(orbit) * 6.6);
    camera.lookAt(0, 0.85, 0);

    if (onStatus && clock - statusAt > 0.1) {
      statusAt = clock;
      const layers = Math.round(height / LAYER_H);
      onStatus({
        model: QUEUE[idx].name,
        layer: phase === 'printing' ? Math.round(Math.min(cut, height) / LAYER_H) : phase === 'heating' ? 0 : layers,
        layers,
        phase,
        temp: Math.round(phase === 'heating' ? 120 + (phaseT / T.heat) * 95 : printing ? 215 + Math.sin(clock * 3) : 215 - Math.min(40, phaseT * 10)),
      });
    }
    renderer.render(scene, camera);
  }

  // still frame for reduced motion: a finished part, nicely lit
  const still = () => {
    phase = 'done';
    phaseT = 0.5;
    spin = 0.6;
    frame(0);
  };

  let visible = true;
  new IntersectionObserver(([e]) => (visible = e.isIntersecting)).observe(canvas);
  const loop = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (visible && !document.hidden && !calm()) frame(dt);
    requestAnimationFrame(loop);
  };
  if (calm()) still();
  requestAnimationFrame(loop);
}
