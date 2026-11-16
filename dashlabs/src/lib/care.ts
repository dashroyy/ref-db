// Where can a print live? Matches each material's heat and outdoor ratings
// (src/data/materials.ts) against what a place demands. The ratings are
// judgement, so the result is guidance: "risky" means it may deform over time.
// Pure; tested in tests/guides.test.ts.

import { MATERIALS, type Material } from '../data/materials.ts';

export interface Place {
  id: string;
  label: string;
  heat: number; // heat rating a material needs here (1–5)
  outdoor: number; // outdoor/UV rating needed (1–5)
  note: string;
}

export const PLACES: Place[] = [
  { id: 'desk', label: 'On a desk or shelf', heat: 1, outdoor: 1, note: 'Room temperature, no direct sun. Anything works.' },
  { id: 'window', label: 'On a sunny windowsill', heat: 2, outdoor: 3, note: 'Sun through glass warms and fades plastic over months.' },
  { id: 'bathroom', label: 'In a bathroom or kitchen', heat: 2, outdoor: 2, note: 'Warm and humid, with the odd splash.' },
  { id: 'garden', label: 'Outside in the garden', heat: 3, outdoor: 5, note: 'Sun, rain and frost, all year.' },
  { id: 'car', label: 'In a car', heat: 4, outdoor: 4, note: 'A closed car in summer is the hardest everyday place for plastic.' },
  { id: 'dishwasher', label: 'Through the dishwasher', heat: 5, outdoor: 2, note: 'Hot water and detergent for an hour. Hand-wash prints instead.' },
];

export type Fit = 'good' | 'risky' | 'avoid';

export function fit(m: Material, p: Place): Fit {
  const dh = m.ratings.heat - p.heat;
  const du = m.ratings.outdoor - p.outdoor;
  if (dh >= 0 && du >= 0) return 'good';
  if (dh >= -1 && du >= -1) return 'risky';
  return 'avoid';
}

/** Every material for a place, best first. */
export function materialsFor(placeId: string, materials: Material[] = MATERIALS) {
  const p = PLACES.find((x) => x.id === placeId) ?? PLACES[0];
  const order: Fit[] = ['good', 'risky', 'avoid'];
  return materials.map((m) => ({ material: m, fit: fit(m, p) })).sort((a, b) => order.indexOf(a.fit) - order.indexOf(b.fit));
}
