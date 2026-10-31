// Coatings and surface treatments: the change of a dimension (diameters and thread pitch diameters), the change of
// preload when a coating changes the friction, and the life of a sacrificial zinc coating by corrosivity category.
// Units: mm and µm (stated), N·m for torque at the UI, kN, years.
import { torquePreload, type Thread } from './bolts.ts';

/**
 * Finishes and the fraction of their thickness that builds up above the original surface. Anodising converts the
 * metal, so part of it grows inward (MIL-A-8625: about one third outward for Type II, one half for Type III).
 */
export const FINISHES = [
  { key: 'plate', name: 'Electroplate (Zn-Ni, Cd, Ni, Cr)', out: 1 },
  { key: 'flake', name: 'Zinc flake', out: 1 },
  { key: 'en', name: 'Electroless nickel', out: 1 },
  { key: 'paint', name: 'Primer or paint', out: 1 },
  { key: 'a2', name: 'Sulphuric anodise (Type II)', out: 1 / 3 },
  { key: 'a3', name: 'Hard anodise (Type III)', out: 0.5 },
  { key: 'custom', name: 'Your own build-up fraction', out: 1 },
] as const;
export const finish = (k: string) => FINISHES.find((f) => f.key === k);

/** Features and how many build-ups change the dimension: 2 for a diameter, 4 for the pitch diameter of a 60° thread. */
export const FEATURES = [
  { key: 'od', name: 'External diameter', k: 2, sign: 1 },
  { key: 'id', name: 'Internal diameter (bore)', k: 2, sign: -1 },
  { key: 'te', name: 'External thread, pitch diameter', k: 4, sign: 1 },
  { key: 'ti', name: 'Internal thread, pitch diameter', k: 4, sign: -1 },
] as const;
export const feature = (k: string) => FEATURES.find((f) => f.key === k) ?? FEATURES[0];

/**
 * Limits before coating so that every part is inside the final limits after coating. Thickness in µm, limits in mm.
 * An external feature grows by k·out·t; an internal one shrinks by it.
 */
export function preCoat(i: { feature: string; out: number; tMin: number; tMax: number; min: number; max: number }) {
  const f = feature(i.feature), gMin = (f.k * i.out * i.tMin) / 1000, gMax = (f.k * i.out * i.tMax) / 1000;
  const lo = f.sign > 0 ? i.min - gMin : i.min + gMax, hi = f.sign > 0 ? i.max - gMax : i.max + gMin;
  const tol = i.max - i.min;
  return { f, gMin, gMax, min: lo, max: hi, tol: hi - lo, used: (gMax - gMin) / tol, ok: hi > lo };
}

/** Preload from torque with one friction coefficient on the thread and under the head (kN, torque in N·m). */
export const preloadAt = (T: number, t: Thread, mu: number, dw: number, dh: number) => torquePreload(T * 1000, t, mu, mu, dw, dh).F / 1000;
/** Torque (N·m) that gives preload F (kN) at friction mu. */
export const torqueFor = (F: number, t: Thread, mu: number, dw: number, dh: number) => (F / preloadAt(1, t, mu, dw, dh));

/** The same torque with a different finish: the preload range and the torque that restores the design preload. */
export function frictionChange(i: { T: number; t: Thread; dw: number; dh: number; mu0: number; muMin: number; muMax: number }) {
  const F0 = preloadAt(i.T, i.t, i.mu0, i.dw, i.dh), Fhi = preloadAt(i.T, i.t, i.muMin, i.dw, i.dh), Flo = preloadAt(i.T, i.t, i.muMax, i.dw, i.dh);
  const muMid = (i.muMin + i.muMax) / 2;
  return { F0, Flo, Fhi, dLo: Flo / F0 - 1, dHi: Fhi / F0 - 1, Tnew: torqueFor(F0, i.t, muMid, i.dw, i.dh), scatter: (Fhi - Flo) / (Fhi + Flo) };
}

/** ISO 9223 corrosivity categories and the first-year corrosion rate of zinc (µm/year). */
export const CATEGORIES = [
  { key: 'C1', name: 'C1, very low: heated, dry indoors', lo: 0, hi: 0.1 },
  { key: 'C2', name: 'C2, low: unheated indoors, dry rural', lo: 0.1, hi: 0.7 },
  { key: 'C3', name: 'C3, medium: urban, light coastal', lo: 0.7, hi: 2.1 },
  { key: 'C4', name: 'C4, high: industrial, coastal', lo: 2.1, hi: 4.2 },
  { key: 'C5', name: 'C5, very high: marine, aggressive industrial', lo: 4.2, hi: 8.4 },
  { key: 'CX', name: 'CX, extreme: offshore, tropical marine', lo: 8.4, hi: 25 },
] as const;
export const category = (k: string) => CATEGORIES.find((c) => c.key === k) ?? CATEGORIES[2];

/** Life of a sacrificial coating of thickness t (µm), with a rate relative to zinc. Infinity where the rate is zero. */
export function zincLife(i: { t: number; cat: string; rel?: number }) {
  const c = category(i.cat), r = i.rel ?? 1;
  return { c, short: i.t / (c.hi * r), long: c.lo > 0 ? i.t / (c.lo * r) : Infinity };
}
