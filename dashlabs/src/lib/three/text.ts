// Customer text on a model: real extruded 3D letters, sized to fit the
// model's text anchor, in their own filament colour. Replaces the placeholder
// blocks. Font: Helvetiker Bold (MgOpen licence, /fonts/LICENSE-helvetiker.txt).

import * as THREE from 'three';
import { FontLoader, type Font } from 'three/examples/jsm/loaders/FontLoader.js';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js';
import { printMaterial } from './print.ts';

let fontP: Promise<Font> | null = null;
const font = () => (fontP ??= new FontLoader().loadAsync('/fonts/helvetiker_bold.typeface.json'));

/** Characters the font can draw; anything else is dropped. */
export const cleanText = (t: string, max: number) =>
  t
    .normalize('NFKD')
    .replace(/[^\x20-\x7E]/g, '')
    .slice(0, max);

export async function applyText(root: THREE.Object3D, text: string, color: string) {
  const anchor = root.getObjectByName('text-anchor');
  if (!anchor) return;
  const f = await font();
  // remove the previous text
  for (const old of anchor.children.slice()) {
    anchor.remove(old);
    (old as THREE.Mesh).geometry?.dispose();
  }
  const ph = root.getObjectByName('placeholder-text');
  const t = text.trim();
  if (ph) ph.visible = !t;
  if (!t) return;

  const { maxWidth, maxHeight } = anchor.userData as { maxWidth: number; maxHeight: number };
  const geo = new TextGeometry(t, {
    font: f,
    size: 1,
    depth: 0.35,
    curveSegments: 6,
    bevelEnabled: true,
    bevelThickness: 0.04,
    bevelSize: 0.03,
    bevelSegments: 2,
  });
  geo.computeBoundingBox();
  const b = geo.boundingBox!;
  const w = b.max.x - b.min.x;
  const h = b.max.y - b.min.y;
  const s = Math.min(maxWidth / w, maxHeight / h);
  // centre it, lay it flat (letters face up), and scale to fit
  geo.translate(-(b.min.x + b.max.x) / 2, -(b.min.y + b.max.y) / 2, 0);
  geo.rotateX(-Math.PI / 2);
  geo.scale(s, Math.min(s, 0.08 / 0.39), s); // raised about 0.08 units
  const mesh = new THREE.Mesh(geo, printMaterial(color));
  mesh.castShadow = true;
  mesh.userData.accent = true; // keeps its own colour when the body filament changes
  anchor.add(mesh);
}

/** Recolour the text only. */
export function setTextColor(root: THREE.Object3D, color: string) {
  const anchor = root.getObjectByName('text-anchor');
  anchor?.traverse((o) => {
    const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
    if (m && 'color' in m) m.color.set(color);
  });
}
