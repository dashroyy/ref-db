// DashLabs 3D: a "printed plastic" material and procedural models for every
// product shape. Shared by the hero printer, the product viewer and the
// thumbnail renderer.
//
// The material draws layer lines from world height (so they are horizontal on
// any geometry), can be cut off at a height (uCut) to show a part mid-print,
// glows hot just under the cut like fresh extrusion, and can cycle a rainbow
// for silk filament.

import * as THREE from 'three';

export type Shape = 'bust' | 'paw' | 'card' | 'launcher' | 'dragon' | 'vase' | 'organizer' | 'keychain' | 'spool' | 'spaghetti' | 'dog';

export const LAYER_H = 0.022; // world units per printed layer

export interface PrintUniforms {
  uCut: { value: number };
  uTime: { value: number };
  uRainbow: { value: number };
  uLines: { value: number }; // layer-line contrast: 0.14 normal, up to ~0.7 for a "sliced" look
  uHot: { value: THREE.Color };
}

export interface PrintMaterial extends THREE.MeshStandardMaterial {
  userData: { uniforms: PrintUniforms };
}

export function printMaterial(color: string | THREE.Color, opts: { roughness?: number; layers?: boolean } = {}): PrintMaterial {
  const rainbow = color === 'rainbow';
  const m = new THREE.MeshStandardMaterial({
    color: rainbow ? '#ffffff' : color,
    roughness: rainbow ? 0.28 : (opts.roughness ?? 0.55),
    metalness: rainbow ? 0.35 : 0.05,
  }) as PrintMaterial;
  const uniforms: PrintUniforms = {
    uCut: { value: 99 },
    uTime: { value: 0 },
    uRainbow: { value: rainbow ? 1 : 0 },
    uLines: { value: 0.14 },
    uHot: { value: new THREE.Color('#ffab2e') },
  };
  m.userData.uniforms = uniforms;
  const layers = opts.layers !== false;
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWorldPos;')
      .replace(
        '#include <worldpos_vertex>',
        '#include <worldpos_vertex>\nvWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;',
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vWorldPos;
        uniform float uCut;
        uniform float uTime;
        uniform float uRainbow;
        uniform float uLines;
        uniform vec3 uHot;
        vec3 hue2rgb(float h){ return clamp(abs(mod(h*6.0+vec3(0.,4.,2.),6.)-3.)-1.,0.,1.); }`,
      )
      .replace(
        '#include <clipping_planes_fragment>',
        `#include <clipping_planes_fragment>
        if (vWorldPos.y > uCut) discard;`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        if (uRainbow > 0.5) {
          vec3 rb = hue2rgb(fract(vWorldPos.y * 0.9 + vWorldPos.x * 0.15 + uTime * 0.06));
          diffuseColor.rgb = mix(rb, vec3(1.0), 0.12);
        }
        ${
          layers
            ? `float lp = fract(vWorldPos.y / ${LAYER_H.toFixed(4)});
        diffuseColor.rgb *= (1.0 - uLines) + uLines * smoothstep(0.0, 0.35, lp) * smoothstep(1.0, 0.65, lp);
        if (uLines > 0.3) diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.61, 0.42, 1.0), (uLines - 0.3) * 0.6 * (1.0 - smoothstep(0.0, 0.25, lp)));`
            : ''
        }`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        float hd = uCut - vWorldPos.y;
        if (uCut < 98.0 && hd >= 0.0 && hd < 0.07) totalEmissiveRadiance += uHot * pow(1.0 - hd / 0.07, 2.0) * 2.2;`,
      );
  };
  // distinct cache keys so layered / unlayered variants compile separately
  m.customProgramCacheKey = () => `print-${layers ? 1 : 0}`;
  return m;
}

const accent = (hex: string) => printMaterial(hex, { layers: false, roughness: 0.35 });

/** Recolour every print material in a model (the "filament"). */
export function setFilament(root: THREE.Object3D, color: string) {
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    const m = mesh.material as PrintMaterial | undefined;
    if (!m?.userData?.uniforms || mesh.userData.accent) return;
    const rainbow = color === 'rainbow';
    m.userData.uniforms.uRainbow.value = rainbow ? 1 : 0;
    if (!rainbow) m.color.set(color);
    m.roughness = rainbow ? 0.28 : 0.55;
    m.metalness = rainbow ? 0.35 : 0.05;
  });
}

/** Set how the part looks: wireframe (CAD), layer-line strength (sliced). */
export function setLook(root: THREE.Object3D, look: { wire?: boolean; lines?: number }) {
  root.traverse((o) => {
    const m = (o as THREE.Mesh).material as PrintMaterial | undefined;
    if (!m?.userData?.uniforms) return;
    if (look.wire !== undefined) m.wireframe = look.wire;
    if (look.lines !== undefined) m.userData.uniforms.uLines.value = look.lines;
  });
}

const PART_COLOURS: Record<string, string> = { clothes: '#2f7dff', skin: '#f0c4a2', hair: '#3b2a20' };

/**
 * Multi-colour finish preview: parts tagged 'clothes', 'skin' or 'hair' get
 * their own filament; single colour puts everything back to `base`.
 */
export function setFinish(root: THREE.Object3D, multi: boolean, base: string) {
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    const part = mesh.userData?.part as string | undefined;
    if (!mesh.isMesh || !part) return;
    const m = mesh.material as PrintMaterial;
    if (!mesh.userData.ownMat) {
      // give the part its own material once, keeping the print uniforms working
      const own = printMaterial(base);
      own.side = m.side;
      mesh.material = own;
      mesh.userData.ownMat = true;
    }
    (mesh.material as PrintMaterial).color.set(multi ? PART_COLOURS[part] : base);
    mesh.userData.accent = multi;
  });
}

/** Set the print height cut on every material in a model. */
export function setCut(root: THREE.Object3D, cut: number, time = 0) {
  root.traverse((o) => {
    const m = (o as THREE.Mesh).material as PrintMaterial | undefined;
    if (m?.userData?.uniforms) {
      m.userData.uniforms.uCut.value = cut;
      m.userData.uniforms.uTime.value = time;
    }
  });
}

function roundedRect(w: number, h: number, r: number) {
  const s = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

function slab(w: number, d: number, h: number, r: number, mat: THREE.Material) {
  const g = new THREE.ExtrudeGeometry(roundedRect(w, d, r), { depth: h, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 2, curveSegments: 8 });
  g.rotateX(-Math.PI / 2);
  return new THREE.Mesh(g, mat);
}

/** Where customer text goes on a model, and how big it may be (see text.ts). */
function textAnchor(x: number, y: number, z: number, maxWidth: number, maxHeight: number) {
  const a = new THREE.Object3D();
  a.name = 'text-anchor';
  a.position.set(x, y, z);
  a.userData = { maxWidth, maxHeight };
  return a;
}

const mesh = (g: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0) => {
  const o = new THREE.Mesh(g, m);
  o.position.set(x, y, z);
  return o;
};

/**
 * Build a model. Base sits on y = 0, centred on x/z, about 1.5 units tall/wide.
 * `color` is the filament ('rainbow' for silk).
 */
export function buildModel(shape: Shape, color: string): THREE.Group {
  const g = new THREE.Group();
  const mat = printMaterial(color);
  const white = accent('#ece6da');
  const steel = accent('#9aa3b5');
  // Accent parts (pen, cables, key ring) keep their own colour when the filament changes.
  const add = (o: THREE.Object3D) => {
    o.traverse((c) => {
      const m = c as THREE.Mesh;
      if (!m.isMesh) return;
      m.castShadow = true;
      m.receiveShadow = true;
      m.userData.accent = m.material !== mat;
    });
    g.add(o);
    return o;
  };

  switch (shape) {
    case 'vase': {
      // twisted, lobed vase: a lathe, then each vertex rotated and lobed by height
      const pts: THREE.Vector2[] = [];
      for (let i = 0; i <= 40; i++) {
        const t = i / 40;
        const r = 0.34 + 0.22 * Math.sin(t * Math.PI * 0.95 + 0.25) - 0.1 * t;
        pts.push(new THREE.Vector2(Math.max(0.12, r), t * 1.7));
      }
      const geo = new THREE.LatheGeometry(pts, 120);
      const p = geo.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
        const a = Math.atan2(z, x), r = Math.hypot(x, z);
        const r2 = r * (1 + 0.09 * Math.cos(6 * (a + y * 1.4)));
        const a2 = a + y * 0.9;
        p.setXYZ(i, r2 * Math.cos(a2), y, r2 * Math.sin(a2));
      }
      geo.computeVertexNormals();
      const vase = new THREE.Mesh(geo, mat);
      (vase.material as THREE.Material).side = THREE.DoubleSide;
      add(vase);
      break;
    }
    case 'bust': {
      const sh: THREE.Vector2[] = [];
      for (let i = 0; i <= 20; i++) {
        const t = i / 20;
        sh.push(new THREE.Vector2(0.62 * Math.cos(t * Math.PI * 0.5) + 0.02, 0.5 * Math.sin(t * Math.PI * 0.5)));
      }
      const shoulders = new THREE.Mesh(new THREE.LatheGeometry(sh, 64), mat);
      shoulders.scale.set(1, 1, 0.62);
      shoulders.userData.part = 'clothes';
      add(shoulders);
      add(mesh(new THREE.CylinderGeometry(0.13, 0.16, 0.3, 32), mat, 0, 0.6, 0)).userData.part = 'skin';
      const head = mesh(new THREE.SphereGeometry(0.33, 64, 48), mat, 0, 0.98, 0);
      head.scale.set(0.92, 1.08, 0.98);
      head.userData.part = 'skin';
      add(head);
      const hair = mesh(new THREE.SphereGeometry(0.345, 64, 32, 0, Math.PI * 2, 0, Math.PI * 0.42), mat, 0, 1.03, -0.02);
      hair.scale.set(0.95, 1.12, 1.02);
      hair.userData.part = 'hair';
      add(hair);
      for (const s of [-1, 1]) add(mesh(new THREE.SphereGeometry(0.06, 16, 12), mat, s * 0.3, 0.95, 0)).userData.part = 'skin';
      add(mesh(new THREE.SphereGeometry(0.045, 16, 12), mat, 0, 0.95, 0.32)).userData.part = 'skin';
      break;
    }
    case 'dog': {
      // a sitting dog, facing forward: the pet-portrait stand-in
      const dark = accent('#2b2233');
      const ball = (r: number, x: number, y: number, z: number, sx = 1, sy = 1, sz = 1, m: THREE.Material = mat) => {
        const o = mesh(new THREE.SphereGeometry(r, 40, 28), m, x, y, z);
        o.scale.set(sx, sy, sz);
        return o;
      };
      const body = ball(0.4, 0, 0.52, -0.08, 1, 1.25, 1.05);
      body.rotation.x = -0.25;
      add(body);
      add(ball(0.29, 0, 0.66, 0.16)); // chest
      for (const s of [-1, 1]) {
        add(ball(0.24, s * 0.3, 0.2, -0.02, 1, 0.85, 1.35)); // haunch
        add(ball(0.1, s * 0.34, 0.07, 0.3, 1, 0.65, 1.5)); // hind paw
        add(mesh(new THREE.CylinderGeometry(0.075, 0.085, 0.56, 20), mat, s * 0.15, 0.3, 0.34)); // front leg
        add(ball(0.1, s * 0.15, 0.07, 0.42, 1, 0.65, 1.45)); // front paw
        const ear = ball(0.14, s * 0.27, 1.1, 0.14, 0.55, 1.35, 0.95);
        ear.rotation.z = s * -0.35;
        add(ear);
        add(ball(0.036, s * 0.115, 1.2, 0.47, 1, 1, 1, dark)); // eye
      }
      add(ball(0.3, 0, 1.12, 0.2, 1, 0.95, 1)); // head
      add(ball(0.15, 0, 1.04, 0.47, 1, 0.8, 1.25)); // snout
      add(ball(0.055, 0, 1.08, 0.66, 1.2, 0.9, 1, dark)); // nose
      const tail = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0.2, -0.42), new THREE.Vector3(0.06, 0.38, -0.62), new THREE.Vector3(0.12, 0.62, -0.6), new THREE.Vector3(0.1, 0.74, -0.5)]);
      add(new THREE.Mesh(new THREE.TubeGeometry(tail, 24, 0.05, 10), mat));
      break;
    }
    case 'paw': {
      add(slab(1.4, 1.1, 0.1, 0.12, mat));
      const pad = mesh(new THREE.SphereGeometry(0.36, 48, 32), mat, 0, 0.25, 0.12);
      pad.scale.set(1.15, 0.5, 0.95);
      add(pad);
      const toes: [number, number][] = [[-0.44, -0.18], [-0.16, -0.42], [0.16, -0.42], [0.44, -0.18]];
      for (const [x, z] of toes) {
        const t = mesh(new THREE.SphereGeometry(0.15, 32, 24), mat, x, 0.2, z);
        t.scale.set(1, 0.8, 1.2);
        add(t);
      }
      break;
    }
    case 'card': {
      const card = new THREE.Group();
      const c1 = slab(1.5, 0.92, 0.04, 0.07, mat);
      card.add(c1);
      const raised = (w: number, x: number, z: number) => {
        const r = slab(w, 0.06, 0.03, 0.02, mat);
        r.position.set(x, 0.06, z);
        card.add(r);
      };
      // the two top lines stand in for the name until real text is applied (text.ts)
      const ph = new THREE.Group();
      ph.name = 'placeholder-text';
      card.add(ph);
      const rph = (w: number, x: number, z: number) => {
        const r = slab(w, 0.06, 0.03, 0.02, mat);
        r.position.set(x, 0.06, z);
        ph.add(r);
      };
      rph(0.6, 0.0, -0.22);
      rph(0.4, -0.1, -0.1);
      raised(0.5, -0.35, 0.22);
      card.add(textAnchor(0.2, 0.055, -0.17, 0.82, 0.15)); // right of the round logo
      card.add(mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.05, 32), mat, -0.5, 0.06, -0.18));
      for (const [x, z] of [[0.48, 0.14], [0.6, 0.14], [0.48, 0.26], [0.62, 0.28], [0.55, 0.21]]) card.add(mesh(new THREE.BoxGeometry(0.08, 0.05, 0.08), mat, x, 0.07, z));
      card.rotation.x = Math.PI / 2 - 0.32; // face toward the viewer (+z), leaning back on the stand
      card.position.set(0, 0.5, 0.12);
      add(card);
      const stand = slab(1.0, 0.36, 0.12, 0.06, mat);
      stand.position.z = 0.0;
      add(stand);
      break;
    }
    case 'launcher': {
      add(slab(1.5, 0.6, 0.22, 0.08, mat));
      const barrel = new THREE.Group();
      const b = slab(1.25, 0.36, 0.3, 0.1, mat);
      b.position.y = -0.15;
      barrel.add(b);
      const pen = new THREE.Group();
      pen.add(mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.9, 24), white));
      pen.add(mesh(new THREE.ConeGeometry(0.045, 0.12, 24), steel, 0, 0.51, 0));
      pen.rotation.z = -Math.PI / 2;
      pen.position.set(0.55, 0.2, 0);
      barrel.add(pen);
      barrel.add(mesh(new THREE.BoxGeometry(0.12, 0.24, 0.3), steel, -0.48, 0.18, 0));
      barrel.rotation.z = 0.42;
      barrel.position.set(-0.05, 0.62, 0);
      add(barrel);
      add(mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.3, 16), steel, 0.45, 0.3, 0)).rotateX(Math.PI / 2);
      break;
    }
    case 'dragon': {
      const n = 13;
      for (let i = 0; i < n; i++) {
        const t = i / (n - 1);
        const x = -0.75 + t * 1.5;
        const z = Math.sin(t * Math.PI * 1.6) * 0.32;
        const r = 0.19 - t * 0.11;
        const seg = mesh(new THREE.SphereGeometry(r, 32, 20), mat, x, r * 0.9, z);
        seg.scale.set(1.15, 0.85, 1);
        add(seg);
        if (i % 2 === 0 && i < n - 2) add(mesh(new THREE.ConeGeometry(r * 0.45, r * 1.2, 4), mat, x, r * 1.75, z));
      }
      const head = mesh(new THREE.ConeGeometry(0.17, 0.42, 6), mat, -0.95, 0.18, -0.02);
      head.rotation.z = Math.PI / 2;
      add(head);
      for (const s of [-1, 1]) add(mesh(new THREE.ConeGeometry(0.04, 0.22, 8), mat, -0.82, 0.36, s * 0.08));
      break;
    }
    case 'organizer': {
      add(slab(1.45, 0.62, 0.28, 0.12, mat));
      for (let i = 0; i < 6; i++) add(mesh(new THREE.BoxGeometry(0.07, 0.24, 0.56), mat, -0.6 + i * 0.24, 0.42, 0));
      for (const [i, bend] of [[0, -0.3], [2, 0.1], [4, 0.35]]) {
        const x = -0.48 + i * 0.24;
        const curve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(x, 0.32, 0),
          new THREE.Vector3(x, 0.75, 0.02),
          new THREE.Vector3(x + bend * 0.5, 1.15, -0.15),
          new THREE.Vector3(x + bend, 1.3, -0.55),
        ]);
        add(new THREE.Mesh(new THREE.TubeGeometry(curve, 32, 0.035, 10), white));
      }
      break;
    }
    case 'keychain': {
      const tag = slab(1.3, 0.55, 0.12, 0.2, mat);
      tag.position.set(0.15, 0, 0);
      add(tag);
      const ph = new THREE.Group();
      ph.name = 'placeholder-text';
      for (let i = 0; i < 4; i++) ph.add(mesh(new THREE.BoxGeometry(0.16, 0.08, 0.26), mat, -0.12 + i * 0.24, 0.17, 0));
      add(ph);
      g.add(textAnchor(0.22, 0.13, 0, 1.0, 0.3));
      const ring = mesh(new THREE.TorusGeometry(0.26, 0.035, 16, 48), steel, -0.72, 0.06, 0);
      ring.rotation.x = Math.PI / 2;
      add(ring);
      g.rotation.y = 0.3;
      break;
    }
    case 'spool': {
      // a filament spool lying on its side: dark flanges and hub, wound filament rings
      const flange = accent('#4b4370');
      const sp = new THREE.Group();
      const cyl = (r: number, len: number, m: THREE.Material, x = 0) => {
        const c = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 64), m);
        c.rotation.z = Math.PI / 2;
        c.position.x = x;
        return c;
      };
      for (const x of [-0.44, 0.44]) sp.add(cyl(0.78, 0.05, flange, x));
      sp.add(cyl(0.24, 0.92, flange));
      const wound = printMaterial(color, { layers: false, roughness: 0.4 });
      sp.add(cyl(0.56, 0.8, wound));
      for (let i = 0; i < 12; i++) {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.585, 0.034, 10, 64), wound);
        ring.rotation.y = Math.PI / 2;
        ring.position.x = -0.37 + i * (0.74 / 11);
        sp.add(ring);
      }
      // a loose end of filament curling off the top
      const tail = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0.1, 0.6, 0.1),
        new THREE.Vector3(0.3, 0.75, 0.45),
        new THREE.Vector3(0.65, 0.55, 0.75),
        new THREE.Vector3(1.0, 0.25, 0.7),
      ]);
      sp.add(new THREE.Mesh(new THREE.TubeGeometry(tail, 40, 0.03, 8), wound));
      sp.position.y = 0.8;
      // turn the axle across the view (thumbnails look from about 50° round, model turned −0.55)
      sp.rotation.y = 0.87;
      add(sp);
      // dark parts keep their colour when the filament changes
      sp.traverse((c) => ((c as THREE.Mesh).isMesh && (c as THREE.Mesh).material === flange ? (c.userData.accent = true) : null));
      break;
    }
    case 'spaghetti': {
      // a failed print: a few good first layers, then a tangle of loose filament
      add(slab(0.9, 0.9, 0.12, 0.08, mat));
      let seed = 7;
      const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      for (let k = 0; k < 9; k++) {
        const pts: THREE.Vector3[] = [];
        let x = (rnd() - 0.5) * 0.6, y = 0.15, z = (rnd() - 0.5) * 0.6;
        for (let i = 0; i < 9; i++) {
          pts.push(new THREE.Vector3(x, y, z));
          x += (rnd() - 0.5) * 0.7;
          z += (rnd() - 0.5) * 0.7;
          y = Math.max(0.05, y + (rnd() - 0.35) * 0.35);
          x = Math.max(-0.95, Math.min(0.95, x));
          z = Math.max(-0.95, Math.min(0.95, z));
        }
        add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 80, 0.022, 6), mat));
      }
      break;
    }
  }
  return g;
}

/** Height of a model (top of its bounding box). */
export const modelHeight = (o: THREE.Object3D) => new THREE.Box3().setFromObject(o).max.y;

export { webglOK, calm } from './support.ts';
