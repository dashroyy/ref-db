// Crystal structures of metals from fractional lattice coordinates: atom positions of the BCC, FCC and HCP cells (one
// cell or a block), nearest-neighbour bonds, coordination number, atoms per cell, packing factor, and the slip planes.
// Lattice parameter a = 1. Used by the 3D viewer on the metallurgy page.

export type V3 = [number, number, number];
export type Structure = 'bcc' | 'fcc' | 'hcp';

const C_HCP = Math.sqrt(8 / 3); // ideal c/a = 1.633

/** True atom radius for touching hard spheres (a = 1). */
export const RADIUS: Record<Structure, number> = { bcc: Math.sqrt(3) / 4, fcc: Math.sqrt(2) / 4, hcp: 0.5 };
/** Nearest-neighbour distance = 2r. */
export const NN = (s: Structure) => 2 * RADIUS[s];

const key = (p: V3) => p.map((v) => v.toFixed(4)).join(',');
const dedupe = (pts: V3[]) => [...new Map(pts.map((p) => [key(p), p])).values()];

/** Atom positions of n × n × n cubic cells, or of the hexagonal prism (three HCP cells), stacked n high. */
export function atoms(s: Structure, n = 1): V3[] {
  const pts: V3[] = [];
  if (s === 'hcp') {
    const hex = (z: number): V3[] => [[0, 0, z], ...Array.from({ length: 6 }, (_, k) => [Math.cos((k * Math.PI) / 3), Math.sin((k * Math.PI) / 3), z] as V3)];
    for (let l = 0; l < n; l++) {
      const z0 = l * C_HCP;
      pts.push(...hex(z0), ...hex(z0 + C_HCP));
      // the B layer at half height: over the centroids of alternate triangles of the hexagon (30°, 150°, 270°)
      for (const deg of [30, 150, 270]) {
        const t = (deg * Math.PI) / 180, r = 1 / Math.sqrt(3);
        pts.push([r * Math.cos(t), r * Math.sin(t), z0 + C_HCP / 2]);
      }
    }
    return dedupe(pts);
  }
  const basis: V3[] = s === 'bcc' ? [[0, 0, 0], [0.5, 0.5, 0.5]] : [[0, 0, 0], [0.5, 0.5, 0], [0.5, 0, 0.5], [0, 0.5, 0.5]];
  for (let i = -1; i <= n; i++) for (let j = -1; j <= n; j++) for (let k = -1; k <= n; k++)
    for (const b of basis) {
      const p: V3 = [i + b[0], j + b[1], k + b[2]];
      if (p.every((v) => v >= -1e-9 && v <= n + 1e-9)) pts.push(p);
    }
  return dedupe(pts);
}

const dist = (a: V3, b: V3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/** Pairs of atoms at the nearest-neighbour distance: the bonds to draw. */
export function bonds(s: Structure, pts: V3[]) {
  const d = NN(s), out: [number, number][] = [];
  for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) if (Math.abs(dist(pts[i], pts[j]) - d) < 1e-6) out.push([i, j]);
  return out;
}

/** Coordination number: the neighbours of an atom deep inside a large block. */
export function coordination(s: Structure) {
  const pts = atoms(s, 3);
  const centre: V3 = s === 'hcp' ? [0, 0, C_HCP] : [1.5, 1.5, 1.5];
  const c = pts.reduce((b, p) => (dist(p, centre) < dist(b, centre) ? p : b));
  return pts.filter((p) => Math.abs(dist(p, c) - NN(s)) < 1e-6).length;
}

/** Atoms per cell and the atomic packing factor (volume of the atoms ÷ volume of the cell). */
export function cellFacts(s: Structure) {
  const n = s === 'bcc' ? 2 : s === 'fcc' ? 4 : 6; // HCP: the hexagonal prism
  const vol = s === 'hcp' ? ((3 * Math.sqrt(3)) / 2) * C_HCP : 1;
  return { n, apf: (n * (4 / 3) * Math.PI * RADIUS[s] ** 3) / vol };
}

/** The principal slip plane, as a polygon (cell coordinates): FCC {111}, BCC {110}, HCP basal (0001). */
export function slipPlane(s: Structure): V3[] {
  if (s === 'fcc') return [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  if (s === 'bcc') return [[1, 0, 0], [0, 1, 0], [0, 1, 1], [1, 0, 1]];
  return Array.from({ length: 6 }, (_, k) => [Math.cos((k * Math.PI) / 3), Math.sin((k * Math.PI) / 3), 0] as V3);
}

/** Signed distance of a point from the slip plane (for highlighting the atoms on it). */
export function onSlipPlane(s: Structure, p: V3) {
  if (s === 'fcc') return Math.abs(p[0] + p[1] + p[2] - 1) < 1e-6;
  if (s === 'bcc') return Math.abs(p[0] + p[1] - 1) < 1e-6;
  return Math.abs(p[2]) < 1e-6;
}

export const STRUCTURES: Record<Structure, { name: string; slip: string; systems: string; metals: string; consequence: string }> = {
  bcc: {
    name: 'Body-centred cubic', slip: '{110} planes, ⟨111⟩ directions (also {112} and {123})', systems: '48 possible, none close packed',
    metals: 'Ferritic and martensitic steels, 9% Ni steel, Mo, W, Nb, Ta, Cr, β-titanium',
    consequence: 'No close-packed plane: dislocations need thermal energy to move, so the yield strength rises steeply when cold and the steel has a ductile-to-brittle transition.',
  },
  fcc: {
    name: 'Face-centred cubic', slip: '{111} planes, ⟨110⟩ directions', systems: '12, on close-packed planes',
    metals: 'Aluminium, nickel and its superalloys, copper, austenitic stainless steel, γ-iron (austenite)',
    consequence: 'Close-packed planes slip easily at any temperature: no ductile-to-brittle transition, so these metals stay tough at cryogenic temperature.',
  },
  hcp: {
    name: 'Hexagonal close-packed', slip: 'Basal (0001) plane, ⟨11-20⟩ directions; prism and pyramidal planes are harder', systems: '3 easy (basal) systems',
    metals: 'α-titanium, magnesium, beryllium, zinc, α-cobalt',
    consequence: 'Few easy slip systems: properties depend on direction (texture) in plate, bar and forgings, and ductility at room temperature is lower.',
  },
};
