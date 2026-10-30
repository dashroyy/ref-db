// Non-destructive testing: what each method can reliably find (indicative standard flaw sizes), whether that is
// smaller than the critical flaw, the crack-growth life from the largest flaw that can be missed, the
// probability-of-detection curve (log-normal, MIL-HDBK-1823A form) and the binomial demonstration of POD
// (29 of 29 for 90/95). Units: MPa, mm, MPa·√m, C in m/cycle. Screening only.
import { surfaceK, surfaceCriticalDepth } from './lbb.ts';

export type MatClass = 'ferro' | 'aus' | 'al' | 'ti' | 'comp';
export const MAT_CLASSES: { key: MatClass; name: string }[] = [
  { key: 'ferro', name: 'Ferritic or martensitic steel (D6AC, 4340, maraging)' },
  { key: 'aus', name: 'Austenitic stainless or nickel alloy' },
  { key: 'al', name: 'Aluminium alloy' },
  { key: 'ti', name: 'Titanium alloy' },
  { key: 'comp', name: 'Fibre composite' },
];

export interface Method {
  key: string; name: string; short: string;
  reach: 'surface' | 'near-surface' | 'volume' | 'through';
  mats: MatClass[];
  /** Indicative reliably detected depth (mm) of a surface crack with a/2c ≈ 0.2, or a function of the wall. */
  depth: (t: number) => number | null;
  finds: string; blind: string; std: string;
}

// Depths are of the order of the standard NDE crack sizes for surface cracks (NASA-STD-5009). They hold only for
// a qualified procedure on a prepared surface (penetrant after etching, for example). Use your demonstrated values.
export const METHODS: Method[] = [
  { key: 'vt', name: 'Visual (VT)', short: 'VT', reach: 'surface', mats: ['ferro', 'aus', 'al', 'ti', 'comp'], depth: () => null,
    finds: 'Damage, gross cracks, weld profile, corrosion, wrong or missing features', blind: 'Tight cracks and everything below the surface', std: 'ISO 17637 (welds)' },
  { key: 'pt', name: 'Fluorescent penetrant (PT)', short: 'PT', reach: 'surface', mats: ['ferro', 'aus', 'al', 'ti'], depth: () => 0.64,
    finds: 'Cracks, laps and porosity open to the surface, on any non-porous metal', blind: 'Flaws not open to the surface; cracks smeared shut by machining or peening', std: 'ASTM E1417, ISO 3452' },
  { key: 'mt', name: 'Magnetic particle (MT)', short: 'MT', reach: 'near-surface', mats: ['ferro'], depth: () => 0.97,
    finds: 'Surface and slightly subsurface cracks in ferromagnetic steel', blind: 'Non-magnetic alloys; cracks parallel to the field', std: 'ASTM E1444, ISO 9934' },
  { key: 'et', name: 'Eddy current (ET)', short: 'ET', reach: 'near-surface', mats: ['ferro', 'aus', 'al', 'ti'], depth: () => 0.51,
    finds: 'Small surface and near-surface cracks in conductive metals, through thin paint', blind: 'Deep flaws; edges and geometry changes give false signals', std: 'ISO 15548, ASTM E2884' },
  { key: 'ut', name: 'Ultrasonic (UT, PAUT)', short: 'UT', reach: 'volume', mats: ['ferro', 'aus', 'al', 'ti', 'comp'], depth: () => 0.76,
    finds: 'Planar flaws inside the material: cracks, lack of fusion, laminations, delaminations', blind: 'Flaws parallel to the beam; the near-surface dead zone; coarse grain', std: 'ASTM E2375, ISO 16810' },
  { key: 'rt', name: 'Radiography (RT, CT)', short: 'RT', reach: 'volume', mats: ['ferro', 'aus', 'al', 'ti', 'comp'], depth: (t) => 0.7 * t,
    finds: 'Volumetric flaws: porosity, inclusions, voids; a permanent image', blind: 'Tight cracks and planar flaws across the beam', std: 'ASTM E1742, ISO 17636 (welds)' },
  { key: 'lt', name: 'Leak test (LT)', short: 'LT', reach: 'through', mats: ['ferro', 'aus', 'al', 'ti', 'comp'], depth: (t) => t,
    finds: 'Flaws that go through the wall', blind: 'Every flaw that has not yet gone through the wall', std: 'ISO 20485, ASTM E1003' },
];

export interface ScreenInputs {
  sigma: number; t: number; kic: number; ac: number; // stress at MEOP, wall, toughness, flaw aspect a/c
  rangeFraction: number; C: number; m: number; // stress range per cycle ÷ σ; Paris constants
  mat: MatClass; embedded: boolean;
  serviceCycles: number; lifeFactor: number | null;
}

/**
 * Cycles to grow a semi-elliptical surface flaw of fixed a/c from a0 to a1 (mm): da/dN = C·ΔK_A^m with ΔK at the
 * deepest point (Newman–Raju). Simpson's rule on ln a.
 */
export function growthCycles(a0: number, a1: number, ac: number, t: number, dSigma: number, C: number, m: number) {
  if (!(a1 > a0 && a0 > 0 && dSigma > 0)) return 0;
  const n = 200, h = Math.log(a1 / a0) / n;
  const g = (u: number) => { const a = a0 * Math.exp(u); return a / (1000 * C * Math.pow(surfaceK(dSigma, a, a / ac, t).KA, m)); };
  let s = g(0) + g(n * h);
  for (let k = 1; k < n; k++) s += (k % 2 ? 4 : 2) * g(k * h);
  return (s * h) / 3;
}

/** The critical depth, and for each method: can it be used, what it can miss, and the life from that flaw. */
export function screen(i: ScreenInputs) {
  const aCrit = surfaceCriticalDepth(i.sigma, i.ac, i.t, i.kic);
  const through = aCrit >= i.t; // the flaw reaches the back face before it is critical: leak before break
  const required = i.lifeFactor === null ? null : i.serviceCycles * i.lifeFactor;
  const rows = METHODS.map((mth) => {
    const aNde = mth.depth(i.t);
    const usable = mth.mats.includes(i.mat) && !(i.embedded && (mth.reach === 'surface' || mth.reach === 'near-surface')) && aNde !== null && mth.key !== 'lt';
    const life = aNde !== null && aNde < aCrit ? growthCycles(aNde, aCrit, i.ac, i.t, i.sigma * i.rangeFraction, i.C, i.m) : 0;
    const ratio = aNde ? aCrit / aNde : NaN;
    const ok = usable && aNde! < aCrit && (required === null || life >= required);
    return { key: mth.key, name: mth.name, short: mth.short, aNde, usable, ratio, life, ok, matOk: mth.mats.includes(i.mat) };
  });
  return { aCrit, through, required, rows };
}

// ---------- Probability of detection ----------

/** Standard normal CDF (Abramowitz & Stegun 7.1.26, error below 1.5e-7). */
export function normCdf(z: number) {
  const x = Math.abs(z) / Math.SQRT2, t = 1 / (1 + 0.3275911 * x);
  const erf = 1 - (((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t) * Math.exp(-x * x);
  return z >= 0 ? 0.5 * (1 + erf) : 0.5 * (1 - erf);
}
export const Z90 = 1.2815516;

/** Log-normal POD curve fixed by a90 (mm) and the spread σ of ln a: POD(a) = Φ((ln a − μ)/σ). */
export function pod(a: number, a90: number, sigma: number) {
  if (!(a > 0)) return 0;
  const mu = Math.log(a90) - Z90 * sigma;
  return normCdf((Math.log(a) - mu) / sigma);
}
export const a50 = (a90: number, sigma: number) => a90 * Math.exp(-Z90 * sigma);

/** Chance that at least one of n flaws of size a is missed, with k independent inspections (an upper limit on the benefit). */
export function missChance(a: number, a90: number, sigma: number, n = 1, k = 1) {
  const pMiss = Math.pow(1 - pod(a, a90, sigma), k);
  return { pMiss, anyMissed: 1 - Math.pow(1 - pMiss, n), expectedMissed: n * pMiss };
}

// ---------- Demonstration of POD by hit/miss trials ----------

/** P(X ≥ x) for X ~ Binomial(n, p). */
export function binomTail(n: number, x: number, p: number) {
  if (x <= 0) return 1;
  if (x > n) return 0;
  if (p <= 0) return 0;
  if (p >= 1) return 1;
  let lp = n * Math.log(1 - p), s = 0; // log pmf at k = 0
  for (let k = 0; k <= n; k++) {
    if (k >= x) s += Math.exp(lp);
    lp += Math.log((n - k) / (k + 1)) + Math.log(p / (1 - p));
  }
  return Math.min(1, s);
}

/** One-sided lower confidence bound on POD after `hits` detections in n trials (Clopper–Pearson). */
export function podLowerBound(n: number, hits: number, confidence: number) {
  const alpha = 1 - confidence;
  if (hits <= 0) return 0;
  if (hits >= n) return Math.pow(alpha, 1 / n);
  let lo = 0, hi = 1;
  for (let k = 0; k < 80; k++) { const mid = (lo + hi) / 2; if (binomTail(n, hits, mid) < alpha) lo = mid; else hi = mid; }
  return lo;
}

/** Fewest flaws that demonstrate POD ≥ target at the confidence, if `misses` of them are allowed to be missed. */
export function minTrials(target: number, confidence: number, misses = 0) {
  for (let n = misses + 1; n <= 5000; n++) if (podLowerBound(n, n - misses, confidence) >= target) return n;
  return Infinity;
}
