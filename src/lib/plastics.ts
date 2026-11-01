// Plastics: the v1 reference data (src/data/plastics.json), a screen against the service requirements, and a plastic
// part fitted to a metal part across the temperature range (free expansion plus Lamé, from expansion.ts). Typical
// unfilled values at room temperature: filled grades, moisture and temperature change them a lot.
import data from '../data/plastics.json' with { type: 'json' };
import { fitChange, fitPressure, fitStresses } from './expansion.ts';

export type Fam = 'commodity' | 'engineering' | 'high-perf' | 'fluoro' | 'elastomer';
export interface Polymer {
  a: string; name: string; alt: string; fam: Fam;
  tmax: number; tmin: number; tg: number; // °C: continuous service limits, glass transition
  wabs: number; // water absorption, %
  cof: number; // friction against steel, typical
  outgas: string; rad: string;
  E?: number; cte?: number; // GPa, µm/m·K
  app: string; good: string[]; bad: string[];
}

export const POLYMERS = data.polymers as Polymer[];
export const FAMS: { key: Fam; name: string }[] = [
  { key: 'commodity', name: 'Commodity' }, { key: 'engineering', name: 'Engineering' }, { key: 'high-perf', name: 'High performance' },
  { key: 'fluoro', name: 'Fluoropolymer' }, { key: 'elastomer', name: 'Elastomer' },
];
export const polymer = (a: string) => POLYMERS.find((p) => p.a === a);

export interface Req {
  tmin?: number; tmax?: number; // required service window, °C
  maxWabs?: number; // %
  outgas?: 'any' | 'low'; // low = "low" or "very low" (screening, before ASTM E595 data)
  rad?: 'any' | 'good'; // good = "good" or "excellent"
  maxCof?: number;
}

const LOW_OUTGAS = ['low', 'very low'], GOOD_RAD = ['good', 'excellent'];

/** The reasons a polymer fails the requirements. Empty means it passes the screen. */
export function screen(p: Polymer, r: Req) {
  const f: string[] = [];
  if (r.tmin !== undefined && r.tmin < p.tmin) f.push(`too cold: rated to ${p.tmin} °C`);
  if (r.tmax !== undefined && r.tmax > p.tmax) f.push(`too hot: rated to ${p.tmax} °C`);
  if (r.maxWabs !== undefined && p.wabs > r.maxWabs) f.push(`absorbs ${p.wabs}% water`);
  if (r.outgas === 'low' && !LOW_OUTGAS.includes(p.outgas)) f.push(`outgassing ${p.outgas}`);
  if (r.rad === 'good' && !GOOD_RAD.includes(p.rad)) f.push(`radiation ${p.rad}`);
  if (r.maxCof !== undefined && p.cof > r.maxCof) f.push(`friction ${p.cof}`);
  return f;
}

/** A glass transition inside the service window: the stiffness changes a lot across it. */
export const tgInWindow = (p: Polymer, r: Req) => p.fam !== 'elastomer' && r.tmin !== undefined && r.tmax !== undefined && p.tg > r.tmin && p.tg < r.tmax;

export interface FitInput {
  arrangement: 'bush' | 'ring'; // bush: plastic inside a metal bore; ring: plastic outside a metal shaft
  d: number; // interface diameter, mm
  D: number; // outer diameter of the outer part, mm
  di: number; // bore of the inner part, mm (0 for a solid shaft)
  fit0: number; // diametral fit at T0, mm: positive is interference, negative is clearance
  T0?: number; // °C, temperature at which fit0 is measured
  Ep: number; nuP: number; alphaP: number; // plastic: MPa, -, 1/K
  Em: number; nuM: number; alphaM: number; // metal
}

/** The fit at temperature T: interference (positive) or clearance (negative), contact pressure and stresses. */
export function fitAt(f: FitInput, T: number) {
  const dT = T - (f.T0 ?? 20);
  const bush = f.arrangement === 'bush';
  const delta = f.fit0 + (bush ? fitChange(f.d, f.alphaP, f.alphaM, dT) : fitChange(f.d, f.alphaM, f.alphaP, dT));
  const parts = bush
    ? { d: f.d, D: f.D, di: f.di, Eo: f.Em, nuo: f.nuM, Ei: f.Ep, nui: f.nuP }
    : { d: f.d, D: f.D, di: f.di, Eo: f.Ep, nuo: f.nuP, Ei: f.Em, nui: f.nuM };
  const p = fitPressure(delta, parts), s = fitStresses(p, parts);
  // Bore closure of a pressed-in bush (Lamé, external pressure on the inner part): 2·p·d²·di / (E·(d² − di²)).
  const closure = bush && f.di > 0 ? (2 * p * f.d ** 2 * f.di) / (f.Ep * (f.d ** 2 - f.di ** 2)) : 0;
  return { T, delta, p, closure, hoopPlastic: bush ? s.hoopInner : s.hoopOuter };
}

/** The fit across the service window, at n + 1 temperatures. */
export const fitSweep = (f: FitInput, tmin: number, tmax: number, n = 40) =>
  Array.from({ length: n + 1 }, (_, i) => fitAt(f, tmin + ((tmax - tmin) * i) / n));
