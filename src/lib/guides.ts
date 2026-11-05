// Design guides: the calculations behind three guides that no other zone covers. Sheet metal flat patterns (bend
// allowance and deduction), helical compression springs to EN 13906-1, and the shear-lag (Volkersen) stress in a
// bonded lap joint under load. Units: mm, N, MPa, degrees.

const rad = (deg: number) => (deg * Math.PI) / 180;

// ---------------------------------------------------------------------------------------------------------------
// Sheet metal

export interface Bend { t: number; R: number; angle: number; K: number } // thickness, inside radius, bend angle, K-factor

/** Bend allowance: the length of the neutral axis through the bend, θ·(R + K·t). */
export const bendAllowance = (b: Bend) => rad(b.angle) * (b.R + b.K * b.t);
/** Outside setback: from the tangent of the bend to the virtual sharp of the outside faces, tan(θ/2)·(R + t). */
export const outsideSetback = (b: Bend) => Math.tan(rad(b.angle) / 2) * (b.R + b.t);
/** Bend deduction: what one bend takes off the sum of the outside dimensions, 2·OSSB − BA. */
export const bendDeduction = (b: Bend) => 2 * outsideSetback(b) - bendAllowance(b);
/** Flat length of a part whose legs are dimensioned to the virtual sharps of the outside faces, all bends equal. */
export const flatLength = (legs: number[], b: Bend) => legs.reduce((s, l) => s + l, 0) - (legs.length - 1) * bendDeduction(b);

/** Typical smallest inside bend radius, as a multiple of the thickness. Confirm with the press-brake shop. */
export const BEND_CLASSES = [
  { key: 'soft', name: 'Soft aluminium and mild steel (1050A, 5251-H22, 5083-O, DC01, S275)', rMin: 1, rOk: 1 },
  { key: 'ss', name: 'Austenitic stainless, annealed (304L, 316L)', rMin: 1, rOk: 1.5 },
  { key: 'hard', name: 'Heat-treated aluminium (6082-T6, 6061-T6, 2024-T3, 7075-T6)', rMin: 2, rOk: 4 },
];

/** The makeability checks for a bent part: radius, the shortest flange, and how close a hole may sit to a bend. */
export function bendChecks(b: Bend, legs: number[], cls: (typeof BEND_CLASSES)[number]) {
  const rt = b.R / b.t;
  const flangeMin = 4 * b.t + b.R, holeMin = 2.5 * b.t + b.R, relief = b.t;
  const shortest = legs.length ? Math.min(legs[0], legs[legs.length - 1], ...legs.slice(1, -1)) : 0;
  return {
    rt, radius: rt >= cls.rOk ? 'ok' : rt >= cls.rMin ? 'warn' : 'bad',
    flangeMin, flange: shortest >= flangeMin ? 'ok' : 'bad', shortest,
    holeMin, relief,
  } as const;
}

// ---------------------------------------------------------------------------------------------------------------
// Helical compression springs (EN 13906-1)

/** Typical moduli of spring materials (EN 13906-1 and makers' data). Confirm with the spring maker. */
export const SPRING_MATERIALS = [
  { key: 'sh', name: 'Spring steel wire, patented (EN 10270-1 SH/DH)', G: 81500, E: 206000 },
  { key: 'vd', name: 'Oil-hardened and tempered wire (EN 10270-2)', G: 79500, E: 206000 },
  { key: '1.4310', name: 'Stainless 1.4310 / 302 (EN 10270-3)', G: 70000, E: 185000 },
  { key: '1.4568', name: 'Stainless 1.4568 / 17-7PH (EN 10270-3)', G: 73000, E: 195000 },
  { key: 'cube', name: 'Beryllium copper CuBe2 (C17200), aged', G: 47000, E: 128000 },
  { key: 'x750', name: 'Nickel alloy X-750, aged', G: 76000, E: 214000 },
];

export type Ends = 'ground' | 'closed';
export interface Spring { d: number; D: number; n: number; L0: number; G: number; E: number; ends: Ends }

/** Total coils: two dead coils for closed ends. */
export const totalCoils = (s: Spring) => s.n + 2;
/** Spring rate, G·d⁴ / (8·D³·n), N/mm. */
export const springRate = (s: Spring) => (s.G * s.d ** 4) / (8 * s.D ** 3 * s.n);
/** Spring index w = D/d; EN 13906-1 recommends 4 to 20. */
export const springIndex = (s: Spring) => s.D / s.d;
/** Stress correction factor k = (w + 0.5)/(w − 0.75) (Bergsträsser, as EN 13906-1). */
export const stressFactor = (w: number) => (w + 0.5) / (w - 0.75);
/** Corrected shear stress at force F, k·8·F·D / (π·d³). */
export const shearStress = (s: Spring, F: number) => (stressFactor(springIndex(s)) * 8 * F * s.D) / (Math.PI * s.d ** 3);
/** Solid length: n_t·d with ground ends, (n_t + 1.5)·d with closed unground ends. */
export const solidLength = (s: Spring) => (totalCoils(s) + (s.ends === 'ground' ? 0 : 1.5)) * s.d;
/** The minimum sum of the gaps between active coils at the shortest working length, (0.0015·D²/d + 0.1·d)·n. */
export const minGaps = (s: Spring) => (0.0015 * s.D ** 2 / s.d + 0.1 * s.d) * s.n;

/** End seating for buckling: ν = 0.5 both ends on parallel plates, 0.7 one end pinned, 1 both pinned, 2 one end free. */
export const SEATING = [
  { nu: 0.5, name: 'Both ends seated on parallel plates' },
  { nu: 0.7, name: 'One end seated, one pinned' },
  { nu: 1, name: 'Both ends pinned' },
  { nu: 2, name: 'One end seated, one free' },
];

/** The deflection at which the spring buckles (EN 13906-1), or Infinity when it cannot buckle. */
export function bucklingDeflection(s: Spring, nu: number) {
  const g = s.G / s.E;
  const arg = 1 - ((1 - g) / (0.5 + g)) * ((Math.PI * s.D) / (nu * s.L0)) ** 2;
  if (arg < 0) return Infinity;
  return s.L0 * (0.5 / (1 - g)) * (1 - Math.sqrt(arg));
}

/** A spring between its installed length L1 and its shortest working length L2. */
export function springCheck(s: Spring, L1: number, L2: number, nu: number) {
  const R = springRate(s), w = springIndex(s), Lc = solidLength(s), Ln = Lc + minGaps(s);
  const F1 = R * (s.L0 - L1), F2 = R * (s.L0 - L2), sK = bucklingDeflection(s, nu);
  return {
    R, w, k: stressFactor(w), F1, F2, tau1: shearStress(s, F1), tau2: shearStress(s, F2), Lc, Ln, sK,
    nt: totalCoils(s), solidForce: R * (s.L0 - Lc), tauSolid: shearStress(s, R * (s.L0 - Lc)),
    clear: L2 >= Ln, buckles: s.L0 - L2 >= sK, indexOk: w >= 4 && w <= 20,
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Bonded lap joints (Volkersen shear lag)

/** Typical adhesives at room temperature: shear modulus and lap-shear strength. Use your adhesive's datasheet. */
export const ADHESIVES = [
  { key: 'film', name: 'Epoxy film, toughened (structural)', G: 800, tau: 35, ta: 0.13 },
  { key: 'paste', name: 'Epoxy paste, two-part', G: 1200, tau: 25, ta: 0.15 },
  { key: 'acrylic', name: 'Structural acrylic (MMA)', G: 400, tau: 20, ta: 0.25 },
  { key: 'pu', name: 'Structural polyurethane', G: 60, tau: 10, ta: 0.5 },
];

export interface Lap { E1: number; t1: number; E2: number; t2: number; b: number; L: number; Ga: number; ta: number }

/** Shear-lag parameter ω, 1/mm: ω² = (Ga/ta)·(1/(E1·t1) + 1/(E2·t2)). */
export const lapOmega = (j: Lap) => Math.sqrt((j.Ga / j.ta) * (1 / (j.E1 * j.t1) + 1 / (j.E2 * j.t2)));

/**
 * Adhesive shear along the overlap under a load P (Volkersen; the bending of a single lap is not included). x runs
 * from 0, where adherend 1 brings the load in, to L. Returns τ(x) as a function, its peak and the average P/(b·L).
 */
export function lapShear(j: Lap, P: number) {
  const w = lapOmega(j), S1 = j.E1 * j.t1 * j.b, S2 = j.E2 * j.t2 * j.b, c = (j.Ga * P) / j.ta;
  // τ = A·cosh(ωx) + B·sinh(ωx); dτ/dx = (Ga/ta)·(N2/S2 − N1/S1) with N1 = P at x = 0 and N2 = P at x = L
  const B = -c / (S1 * w), A = (c / (S2 * w) - B * Math.cosh(w * j.L)) / Math.sinh(w * j.L);
  const tau = (x: number) => A * Math.cosh(w * x) + B * Math.sinh(w * x);
  const avg = P / (j.b * j.L);
  return { omega: w, tau, avg, max: Math.max(Math.abs(tau(0)), Math.abs(tau(j.L))) };
}

/** The load at which the peak shear reaches the adhesive's strength τu (elastic), and the limit as L grows. */
export function lapCapacity(j: Lap, tauU: number) {
  const unit = lapShear(j, 1).max;
  const long = lapShear({ ...j, L: Math.max(j.L, 40 / lapOmega(j)) }, 1).max;
  return { P: tauU / unit, Pinf: tauU / long, naive: tauU * j.b * j.L, ratio: unit * j.b * j.L };
}

/** The overlap beyond which the elastic capacity grows by less than 5%: about 3.7/ω for equal adherends. */
export const usefulOverlap = (j: Lap) => 3.66 / lapOmega(j);
