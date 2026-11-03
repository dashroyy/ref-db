// Pipe threads for ports and fittings (src/data/pipethreads.json):
//  - G, BSPP (ISO 228-1): parallel, 55°; seals on a face, a bonded seal or an O-ring, never on the thread.
//  - R, Rc, Rp, BSPT (ISO 7-1): taper 1:16 on diameter, 55°; seals on the thread with a sealant.
//  - NPT (ASME B1.20.1): taper 1:16, 60°; seals on the thread with a sealant (NPTF dryseal on the flanks).
// Taper threads have no "limits of size" like a bolt: they are toleranced by the position of the gauge plane.
// Units: mm, except where a name says inch.
import data from '../data/pipethreads.json' with { type: 'json' };

const IN = 25.4;
export type PipeForm = 'G' | 'R' | 'NPT';
type G = (typeof data.G)[number];
type R = (typeof data.R)[number];
type N = (typeof data.NPT)[number];

export const PIPE_FORMS: { key: PipeForm; name: string }[] = [
  { key: 'G', name: 'G, BSPP (ISO 228-1): parallel' },
  { key: 'R', name: 'R / Rc / Rp, BSPT (ISO 7-1): taper' },
  { key: 'NPT', name: 'NPT (ASME B1.20.1): taper' },
];
export const sizes = (f: PipeForm) => (f === 'G' ? data.G : f === 'R' ? data.R : data.NPT).map((x) => x.size);
const find = <T extends { size: string }>(list: T[], s: string) => list.find((x) => x.size === s);

/** G (BSPP): external limits for class A or B, and the internal limits. */
export function gLimits(size: string, cls: 'A' | 'B') {
  const g = find(data.G as G[], size);
  if (!g) return undefined;
  const td2 = g.d2 - g.d2minA, td1 = (data.TD1 as Record<string, number>)[String(g.tpi)];
  return {
    size, tpi: g.tpi, P: g.P,
    ext: { dmax: g.d, dmin: g.dmin, d2max: g.d2, d2min: cls === 'A' ? g.d2minA : g.d2minB, d1max: g.d1 },
    int: { Dmin: g.d, D2min: g.d2, D2max: +(g.d2 + td2).toFixed(3), D1min: g.d1, D1max: +(g.d1 + td1).toFixed(3) },
  };
}

/** R / Rc / Rp (BSPT): gauge-plane diameters, gauge length and the tolerances on the gauge-plane position. */
export function rLimits(size: string) {
  const r = find(data.R as R[], size);
  if (!r) return undefined;
  const t2 = r.t2turns * r.P; // ± position of the gauge plane of an internal taper thread, mm
  return {
    size, tpi: r.tpi, P: r.P, d: r.d, d2: r.d2, d1: r.d1,
    a: r.a, aMin: +(r.a - r.t1).toFixed(2), aMax: +(r.a + r.t1).toFixed(2), t1: r.t1,
    t2, t2turns: r.t2turns,
    smallEnd: r.d - r.a / 16, // major diameter at the end of the pipe, basic
    rp: { D2min: +(r.d2 - r.rp).toFixed(3), D2max: +(r.d2 + r.rp).toFixed(3), tol: r.rp },
  };
}

/** NPT: the basic dimensions from ASME B1.20.1, in inch and mm. Tolerance: ±1 turn on the gauge, ±p/16 on the pitch diameter. */
export function nptLimits(size: string) {
  const n = find(data.NPT as N[], size);
  if (!n) return undefined;
  const p = 1 / n.tpi;
  const E0 = n.D - (0.05 * n.D + 1.1) * p; // pitch diameter at the small end
  const E1 = E0 + 0.0625 * n.L1; // at the hand-tight plane
  const L2 = (0.8 * n.D + 6.8) * p; // effective thread length
  const E2 = E0 + 0.0625 * L2;
  const h = 0.8 * p; // thread height
  const inch = { D: n.D, p, E0, E1, L1: n.L1, L2, E2, h, K0: E0 - h, tolAxial: p, tolDia: 0.0625 * p };
  const mm = Object.fromEntries(Object.entries(inch).map(([k, v]) => [k, v * IN])) as typeof inch;
  return { size, tpi: n.tpi, inch, mm };
}

/** Diameter of a 1:16 taper at a distance x from a reference plane (positive towards the small end). */
export const taperAt = (dRef: number, x: number) => dRef - x / 16;
