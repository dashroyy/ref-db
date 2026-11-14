// Scale view: a millimetre ruler and a bank card (ISO/IEC 7810 ID-1,
// 85.60 × 53.98 mm) placed beside a model at its real size, so people can see
// how big it actually is.

import * as THREE from 'three';

export const CARD_MM = { w: 85.6, h: 53.98, t: 0.76 };

/** Ruler length (mm): the part plus a margin, rounded up to whole centimetres. */
export const rulerLength = (mm: number) => Math.max(50, Math.ceil((mm + 10) / 10) * 10);

function rulerTexture(lengthMm: number) {
  const pxPerMm = Math.max(4, Math.min(12, 2048 / lengthMm));
  const W = Math.round(lengthMm * pxPerMm);
  const H = Math.round(18 * pxPerMm);
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  g.fillStyle = '#f1e9d8';
  g.fillRect(0, 0, W, H);
  g.fillStyle = '#1d1726';
  for (let mm = 0; mm <= lengthMm; mm++) {
    const x = Math.min(W - 1, mm * pxPerMm);
    const len = mm % 10 === 0 ? H * 0.45 : mm % 5 === 0 ? H * 0.3 : H * 0.18;
    g.fillRect(x, 0, Math.max(1, pxPerMm * 0.12), len);
    if (mm % 10 === 0 && mm > 0 && mm < lengthMm) {
      g.font = `600 ${Math.round(H * 0.3)}px monospace`;
      g.textAlign = 'center';
      g.fillText(String(mm / 10), x, H * 0.82);
    }
  }
  g.font = `600 ${Math.round(H * 0.2)}px monospace`;
  g.textAlign = 'left';
  g.fillStyle = '#9b6bff';
  g.fillText('cm · DASHLABS', pxPerMm * 2, H * 0.82);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function cardTexture() {
  const c = document.createElement('canvas');
  c.width = 856;
  c.height = 540;
  const g = c.getContext('2d')!;
  const grad = g.createLinearGradient(0, 0, 856, 540);
  grad.addColorStop(0, '#3b4a6b');
  grad.addColorStop(1, '#202a40');
  g.fillStyle = grad;
  g.fillRect(0, 0, 856, 540);
  g.fillStyle = '#d9b45a';
  g.fillRect(90, 190, 120, 90); // chip
  g.fillStyle = 'rgba(255,255,255,0.85)';
  g.font = '600 46px monospace';
  g.fillText('BANK CARD', 90, 120);
  g.font = '500 34px monospace';
  g.fillText('85.6 × 54 mm', 90, 440);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/**
 * Props for a model whose real size is `mm` along `axis`. Returns a group in
 * the model's units, positioned beside it (model base at y = 0).
 */
export function scaleProps(model: THREE.Object3D, mm: number, axis: 'height' | 'length') {
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const units = axis === 'height' ? size.y : Math.max(size.x, size.z);
  const k = units / mm; // model units per millimetre
  const g = new THREE.Group();
  g.name = 'scale-props';

  const L = rulerLength(mm);
  const ruler = new THREE.Mesh(
    new THREE.BoxGeometry(L * k, 1.6 * k, 18 * k),
    [
      new THREE.MeshStandardMaterial({ color: '#d8ceb8' }),
      new THREE.MeshStandardMaterial({ color: '#d8ceb8' }),
      new THREE.MeshStandardMaterial({ map: rulerTexture(L), roughness: 0.6 }),
      new THREE.MeshStandardMaterial({ color: '#d8ceb8' }),
      new THREE.MeshStandardMaterial({ color: '#d8ceb8' }),
      new THREE.MeshStandardMaterial({ color: '#d8ceb8' }),
    ],
  );
  ruler.castShadow = ruler.receiveShadow = true;
  if (axis === 'height') {
    // stand it up beside the part, zero at the bed
    ruler.rotation.z = -Math.PI / 2; // printed face toward the camera side
    ruler.position.set(box.max.x + 14 * k, (L * k) / 2, box.min.z + 9 * k);
  } else {
    // lay it in front, zero at the part's left edge
    ruler.position.set(box.min.x + (L * k) / 2, 0.8 * k, box.max.z + 16 * k);
  }
  g.add(ruler);

  const card = new THREE.Mesh(
    new THREE.BoxGeometry(CARD_MM.w * k, CARD_MM.t * k * 2, CARD_MM.h * k),
    [
      new THREE.MeshStandardMaterial({ color: '#202a40' }),
      new THREE.MeshStandardMaterial({ color: '#202a40' }),
      new THREE.MeshStandardMaterial({ map: cardTexture(), roughness: 0.35, metalness: 0.2 }),
      new THREE.MeshStandardMaterial({ color: '#202a40' }),
      new THREE.MeshStandardMaterial({ color: '#202a40' }),
      new THREE.MeshStandardMaterial({ color: '#202a40' }),
    ],
  );
  card.castShadow = card.receiveShadow = true;
  card.position.set(box.max.x + (axis === 'height' ? 34 : 14) * k + (CARD_MM.w * k) / 2, CARD_MM.t * k, box.min.z + (CARD_MM.h * k) / 2);
  card.rotation.y = -0.18;
  g.add(card);
  return g;
}
