// Welding: heat input, carbon equivalents, preheat to avoid hydrogen cracking (EN 1011-2 method B), cooling time t8/5
// (EN 1011-2 Annex D), transverse shrinkage (Blodgett), and fatigue of welded joints with IIW FAT classes.
// Units: mm, kJ/mm, °C, MPa, ml/100 g of deposited weld metal.

/** Arc welding processes and their thermal efficiency k (EN 1011-1). */
export const PROCESSES = [
  { key: 'saw', name: 'Submerged arc (121)', k: 1.0 },
  { key: 'mma', name: 'Manual metal arc (111)', k: 0.8 },
  { key: 'mag', name: 'MIG/MAG (131/135)', k: 0.8 },
  { key: 'fcaw', name: 'Flux-cored (136)', k: 0.8 },
  { key: 'tig', name: 'TIG (141)', k: 0.6 },
  { key: 'paw', name: 'Plasma (15)', k: 0.6 },
] as const;
export type ProcessKey = (typeof PROCESSES)[number]['key'];
export const proc = (k: string) => PROCESSES.find((p) => p.key === k) ?? PROCESSES[0];

/** Arc energy U·I/v in kJ/mm (v in mm/s). */
export const arcEnergy = (U: number, I: number, v: number) => (U * I) / (1000 * v);
/** Heat input Q = k·U·I/v in kJ/mm. */
export const heatInput = (U: number, I: number, v: number, k: number) => k * arcEnergy(U, I, v);

/** Composition in mass %. Missing elements count as zero. */
export type Comp = { C: number; Mn?: number; Cr?: number; Mo?: number; V?: number; Ni?: number; Cu?: number };
/** CET of EN 1011-2 method B: C + (Mn + Mo)/10 + (Cr + Cu)/20 + Ni/40. */
export const cet = (c: Comp) => c.C + ((c.Mn ?? 0) + (c.Mo ?? 0)) / 10 + ((c.Cr ?? 0) + (c.Cu ?? 0)) / 20 + (c.Ni ?? 0) / 40;
/** CEV of the IIW (EN 1011-2 method A): C + Mn/6 + (Cr + Mo + V)/5 + (Ni + Cu)/15. */
export const cev = (c: Comp) => c.C + (c.Mn ?? 0) / 6 + ((c.Cr ?? 0) + (c.Mo ?? 0) + (c.V ?? 0)) / 5 + ((c.Ni ?? 0) + (c.Cu ?? 0)) / 15;

/** Hydrogen scales of weld metal (ml/100 g, upper limits). */
export const HYDROGEN_SCALES: [string, number][] = [['E', 3], ['D', 5], ['C', 10], ['B', 15], ['A', Infinity]];
export const hydrogenScale = (hd: number) => HYDROGEN_SCALES.find(([, lim]) => hd <= lim)![0];

/** Range of validity of method B. */
export const PREHEAT_RANGE = { cet: [0.2, 0.5], d: [10, 90], hd: [1, 20], q: [0.5, 4.0] } as const;

/**
 * Minimum preheat and interpass temperature to avoid hydrogen cracking, EN 1011-2 Annex C method B:
 * Tp = 697·CET + 160·tanh(d/35) + 62·HD^0.35 + (53·CET − 32)·Q − 328.
 * d is the plate thickness (mm), hd the diffusible hydrogen (ml/100 g), q the heat input (kJ/mm).
 */
export function preheat(i: { cet: number; d: number; hd: number; q: number }) {
  const parts = {
    cet: 750 * i.cet - 150,
    d: 160 * Math.tanh(i.d / 35) - 110,
    hd: 62 * i.hd ** 0.35 - 100,
    q: (53 * i.cet - 32) * i.q - 53 * i.cet + 32,
  };
  const tp = parts.cet + parts.d + parts.hd + parts.q;
  const R = PREHEAT_RANGE, inR = (v: number, [a, b]: readonly [number, number]) => v >= a && v <= b;
  const out: string[] = [];
  if (!inR(i.cet, R.cet)) out.push('CET');
  if (!inR(i.d, R.d)) out.push('thickness');
  if (!inR(i.hd, R.hd)) out.push('hydrogen');
  if (!inR(i.q, R.q)) out.push('heat input');
  return { tp, parts, outside: out, valid: out.length === 0 };
}

/** Joint shape factors for the cooling time (EN 1011-2 Table D.1): F2 for 2D heat flow, F3 for 3D. */
export const JOINTS = [
  { key: 'bead', name: 'Bead on plate', f2: 1, f3: 1 },
  { key: 'butt', name: 'Butt weld, fill passes', f2: 0.9, f3: 0.9 },
  { key: 'corner', name: 'Fillet weld, corner joint', f2: 0.9, f3: 0.67 },
  { key: 'tee', name: 'Fillet weld, T-joint', f2: 0.67, f3: 0.67 },
] as const;
export const joint = (k: string) => JOINTS.find((j) => j.key === k) ?? JOINTS[1];

/**
 * Cooling time from 800 to 500 °C, EN 1011-2 Annex D. q in kJ/mm, d in mm, t0 is the preheat or interpass temperature.
 * Heat flows in three dimensions (thick plate) above the transition thickness, and in two (thin plate) below it.
 */
export function t85(i: { q: number; d: number; t0: number; f2?: number; f3?: number }) {
  const { q, d, t0 } = i, f2 = i.f2 ?? 1, f3 = i.f3 ?? 1;
  const a = 1 / (500 - t0), b = 1 / (800 - t0);
  const k3 = (6700 - 5 * t0) * (a - b), k2 = (4300 - 4.3 * t0) * 1e5 * (a * a - b * b);
  const t3d = k3 * q * f3, t2d = (k2 * q * q) / (d * d) * f2;
  const dt = Math.sqrt((k2 * q) / k3);
  const thin = d < dt;
  return { t3d, t2d, dt, regime: thin ? '2D' : '3D', t: thin ? t2d : t3d };
}

/** Heat input that gives a cooling time t (inverse of t85, in the regime that applies at that heat input). */
export function heatForT85(t: number, i: { d: number; t0: number; f2?: number; f3?: number }) {
  const { d, t0 } = i, f2 = i.f2 ?? 1, f3 = i.f3 ?? 1;
  const a = 1 / (500 - t0), b = 1 / (800 - t0);
  const k3 = (6700 - 5 * t0) * (a - b), k2 = (4300 - 4.3 * t0) * 1e5 * (a * a - b * b);
  const q3 = t / (k3 * f3), q2 = Math.sqrt((t * d * d) / (k2 * f2));
  // the 2D answer applies when the plate is thinner than the transition thickness at that heat input
  return d < Math.sqrt((k2 * q2) / k3) ? q2 : q3;
}

/** Area of a single-V groove (mm²): (t − c)²·tan(θ/2) + g·t, with root face c and root gap g. */
export const vGrooveArea = (t: number, angleDeg: number, gap: number, rootFace = 0) =>
  (t - rootFace) ** 2 * Math.tan((angleDeg * Math.PI) / 360) + gap * t;
/** Transverse shrinkage of a butt weld in steel (Blodgett): 0.2·Aw/t + 0.05·g, in mm. */
export const transverseShrinkage = (aw: number, t: number, gap: number) => (0.2 * aw) / t + 0.05 * gap;

/**
 * IIW fatigue classes for steel (Hobbacher, IIW recommendations). FAT is the stress range (MPa) for 2 × 10⁶ cycles.
 * kmCov is the misalignment stress magnification already in the class (Infinity where axial misalignment does not
 * apply); n is the thickness-correction exponent.
 */
export const FAT_CLASSES = [
  { key: 'flush', name: 'Butt weld, ground flush, NDT', fat: 112, kmCov: 1.15, n: 0.1 },
  { key: 'shop', name: 'Butt weld, shop, flat, toe ≤ 30°, NDT', fat: 90, kmCov: 1.15, n: 0.2 },
  { key: 'butt', name: 'Butt weld, other, NDT', fat: 80, kmCov: 1.3, n: 0.2 },
  { key: 'backing', name: 'Butt weld on permanent backing', fat: 71, kmCov: 1.3, n: 0.2 },
  { key: 'root', name: 'One side, no backing, root NDT', fat: 71, kmCov: 1.3, n: 0.2 },
  { key: 'noroot', name: 'One side, no backing, root not checked', fat: 36, kmCov: 1.3, n: 0.2 },
  { key: 'long', name: 'Seam loaded along the weld, automatic, NDT', fat: 125, kmCov: Infinity, n: 0 },
  { key: 'attach', name: 'Fillet-welded attachment, toe', fat: 80, kmCov: Infinity, n: 0.3 },
  { key: 'lctoe', name: 'Load-carrying fillet weld, toe', fat: 63, kmCov: Infinity, n: 0.3 },
  { key: 'throat', name: 'Load-carrying fillet weld, throat', fat: 36, kmCov: Infinity, n: 0 },
] as const;
export type FatKey = (typeof FAT_CLASSES)[number]['key'];
export const fatClass = (k: string) => FAT_CLASSES.find((c) => c.key === k) ?? FAT_CLASSES[2];

/** Stress magnification of an axial offset e in a butt weld of equal thicknesses t (plate or girth weld): 1 + 3e/t. */
export const kmAxial = (e: number, t: number) => 1 + (3 * e) / t;
/** Thickness correction (25/t)^n above 25 mm. */
export const thicknessFactor = (t: number, n: number) => (t > 25 ? (25 / t) ** n : 1);

export const N_FAT = 2e6, N_KNEE = 1e7, M1 = 3, M2 = 22;
/** Cycles to failure on the IIW S–N curve for a design class `fat` (MPa) at stress range ds. */
export function cycles(fat: number, ds: number) {
  const knee = fat * (N_FAT / N_KNEE) ** (1 / M1);
  return ds >= knee ? N_FAT * (fat / ds) ** M1 : N_KNEE * (knee / ds) ** M2;
}
/** Stress range that gives n cycles on the curve (inverse of cycles). */
export function rangeFor(fat: number, n: number) {
  const knee = fat * (N_FAT / N_KNEE) ** (1 / M1);
  return n <= N_KNEE ? fat * (N_FAT / n) ** (1 / M1) : knee * (N_KNEE / n) ** (1 / M2);
}

/** Fatigue check of a welded joint: nominal range ds, offset e, thickness t, partial factor gamma on resistance. */
export function fatigue(i: { cls: string; ds: number; e: number; t: number; gamma: number; nReq?: number }) {
  const c = fatClass(i.cls);
  const km = Number.isFinite(c.kmCov) ? kmAxial(i.e, i.t) : 1;
  const kmExtra = Number.isFinite(c.kmCov) ? Math.max(1, km / c.kmCov) : 1;
  const ft = thicknessFactor(i.t, c.n);
  const fatD = (c.fat * ft) / i.gamma, dsEff = i.ds * kmExtra;
  const life = cycles(fatD, dsEff);
  const nReq = i.nReq ?? NaN;
  const allowRange = Number.isFinite(nReq) ? rangeFor(fatD, nReq) : NaN;
  return { c, km, kmExtra, ft, fatD, dsEff, life, damage: nReq / life, allowRange, margin: allowRange / dsEff - 1 };
}
