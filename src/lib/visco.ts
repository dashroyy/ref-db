// Linear viscoelasticity with a Prony series (generalised Maxwell model): relaxation, creep, recovery after
// release, dynamic moduli, and time–temperature shifting with WLF. Units: MPa, seconds, °C.

export interface Prony { eInf: number; terms: { e: number; tau: number }[] } // E∞ and arms (E_i, τ_i)

/**
 * The illustrative compounds of the Viscoelasticity page: two arms per decade, E in MPa, τ in s, data at tRef.
 * Not measurements of any real compound.
 */
export const VISCO_PRESETS = {
  seal: {
    label: 'Seal elastomer (FKM-like)', eInf: 6, tg: -20, tRef: 20,
    arms: [[276, 1e-7], [195, 3.16e-7], [138, 1e-6], [98, 3.16e-6], [69.4, 1e-5], [49.1, 3.16e-5], [34.8, 1e-4], [24.6, 3.16e-4], [17.4, 1e-3], [12.3, 3.16e-3], [8.73, 0.01], [6.18, 0.0316], [4.38, 0.1], [3.1, 0.316], [2.19, 1], [1.55, 3.16], [1.1, 10], [0.778, 31.6], [0.551, 100], [0.39, 316], [0.276, 1e3], [0.195, 3.16e3], [0.138, 1e4], [0.098, 3.16e4], [0.0694, 1e5], [0.0491, 3.16e5], [0.0348, 1e6]],
  },
  prop: {
    label: 'Propellant (HTPB-like)', eInf: 3, tg: -70, tRef: -20,
    arms: [[483, 1e-8], [342, 3.16e-8], [242, 1e-7], [171, 3.16e-7], [121, 1e-6], [86, 3.16e-6], [60.9, 1e-5], [43.1, 3.16e-5], [30.5, 1e-4], [21.6, 3.16e-4], [15.3, 1e-3], [10.8, 3.16e-3], [7.66, 0.01], [5.42, 0.0316], [3.84, 0.1], [2.72, 0.316], [1.92, 1], [1.36, 3.16], [0.964, 10], [0.683, 31.6], [0.483, 100], [0.342, 316], [0.242, 1e3], [0.171, 3.16e3], [0.121, 1e4], [0.086, 3.16e4], [0.0609, 1e5], [0.0431, 3.16e5], [0.0305, 1e6], [0.0216, 3.16e6], [0.0153, 1e7], [0.0108, 3.16e7], [0.00766, 1e8]],
  },
};
export type ViscoPreset = (typeof VISCO_PRESETS)[keyof typeof VISCO_PRESETS];

/** A preset as a Prony series. */
export const pronyOf = (pr: { eInf: number; arms: number[][] }): Prony => ({ eInf: pr.eInf, terms: pr.arms.map(([e, tau]) => ({ e, tau })) });

export const instantaneous = (p: Prony) => p.eInf + p.terms.reduce((s, a) => s + a.e, 0);

/** Relaxation modulus E(t) = E∞ + Σ E_i e^(−t/τ_i). */
export const relaxation = (p: Prony, t: number) => p.eInf + p.terms.reduce((s, a) => s + a.e * Math.exp(-t / a.tau), 0);

/** Storage and loss moduli at angular frequency ω (rad/s). */
export function dynamic(p: Prony, w: number) {
  let e1 = p.eInf, e2 = 0;
  for (const a of p.terms) {
    const x = w * a.tau, d = 1 + x * x;
    e1 += (a.e * x * x) / d;
    e2 += (a.e * x) / d;
  }
  return { storage: e1, loss: e2, tanDelta: e2 / e1 };
}

/** WLF constants referred to Tref from the "universal" values at the glass transition (C1g 17.44, C2g 51.6 K). */
export function wlfFromTg(tg: number, tRef: number, c1g = 17.44, c2g = 51.6) {
  const d = tRef - tg;
  return { c1: (c1g * c2g) / (c2g + d), c2: c2g + d };
}
/** log10 a_T, WLF form. */
export const logShift = (T: number, tRef: number, c1: number, c2: number) => (-c1 * (T - tRef)) / (c2 + T - tRef);

/** The middle of the transition at the reference temperature: the time at which log E is halfway from log E0 to log E∞. */
export function transitionTime(p: Prony) {
  const mid = Math.sqrt(instantaneous(p) * p.eInf);
  let lo = -20, hi = 20; // log10 t
  for (let k = 0; k < 100; k++) { const m = (lo + hi) / 2; if (relaxation(p, 10 ** m) > mid) lo = m; else hi = m; }
  return 10 ** ((lo + hi) / 2);
}

/**
 * What a material does when you look at it for tObs seconds at temperature T. The Deborah number is the relaxation
 * time (the middle of the transition, shifted by WLF) divided by the time you look. Mobility is how far the modulus at
 * that time has fallen from glassy (0) to the long-term value (1), on a log scale. WLF is used from about 46 K below
 * the glass transition upward (as the workbench); below that, valid is false.
 */
export function lookAt(p: Prony, w: { tRef: number; c1: number; c2: number }, T: number, tObs: number) {
  if (!(w.c2 + T - w.tRef > 5) || !(tObs > 0) || !(p.eInf > 0)) return { valid: false, aT: NaN, tau: NaN, De: NaN, E: NaN, mobility: NaN };
  const aT = 10 ** logShift(T, w.tRef, w.c1, w.c2);
  const tau = transitionTime(p) * aT, E = relaxation(p, tObs / aT), e0 = instantaneous(p);
  const mobility = Math.min(1, Math.max(0, Math.log10(e0 / E) / Math.log10(e0 / p.eInf)));
  return { valid: true, aT, tau, De: tau / tObs, E, mobility };
}

/** A word for the state, from the mobility: glassy below 15%, rubbery above 65%, the transition between. */
export const stateOf = (mobility: number) => (mobility < 0.15 ? 'glassy' : mobility < 0.65 ? 'transition' : 'rubbery');

/**
 * Strain response to a stress history built from constant segments, by exact integration of each Maxwell arm over
 * each step (strain taken as linear within a step). Steps are log-spaced so microseconds and years both resolve.
 */
function stepper(p: Prony) {
  let eps = 0, t = 0;
  const s = p.terms.map(() => 0); // arm stresses
  const e0 = instantaneous(p);
  return {
    get eps() { return eps; },
    get t() { return t; },
    stress: () => p.eInf * eps + s.reduce((a, b) => a + b, 0),
    /** Apply an instantaneous strain jump. */
    jumpStrain(de: number) { eps += de; p.terms.forEach((a, k) => (s[k] += a.e * de)); },
    /** Apply an instantaneous stress jump (all arms respond elastically). */
    jumpStress(ds: number) { this.jumpStrain(ds / e0); },
    /** Advance by dt holding total stress at sigma. */
    stepStress(dt: number, sigma: number) {
      const decay = p.terms.map((a) => Math.exp(-dt / a.tau));
      const gain = p.terms.map((a, k) => (a.e * a.tau * (1 - decay[k])) / dt);
      const rest = p.terms.reduce((acc, _a, k) => acc + s[k] * decay[k], 0);
      const de = (sigma - p.eInf * eps - rest) / (p.eInf + gain.reduce((a, b) => a + b, 0));
      p.terms.forEach((_a, k) => (s[k] = s[k] * decay[k] + gain[k] * de));
      eps += de; t += dt;
    },
    /** Advance by dt holding strain constant (arms just relax). */
    stepStrain(dt: number) { p.terms.forEach((a, k) => (s[k] *= Math.exp(-dt / a.tau))); t += dt; },
  };
}

const logSteps = (t0: number, t1: number, perDecade = 120) => {
  const n = Math.max(1, Math.ceil(Math.log10(t1 / t0) * perDecade));
  return Array.from({ length: n + 1 }, (_, k) => t0 * Math.pow(t1 / t0, k / n));
};

/** Creep compliance J(t) = ε(t)/σ₀ under a constant stress applied at t = 0, at the requested times. */
export function creepCompliance(p: Prony, times: number[]) {
  const m = stepper(p);
  m.jumpStress(1);
  const tMax = Math.max(...times), tMin = Math.max(1e-12, Math.min(...times.filter((x) => x > 0)) / 100);
  const grid = [0, ...logSteps(tMin, tMax)];
  const out = new Map<number, number>();
  const sorted = [...times].sort((a, b) => a - b);
  let k = 0;
  for (let g = 1; g < grid.length && k < sorted.length; g++) {
    m.stepStress(grid[g] - grid[g - 1], 1);
    while (k < sorted.length && sorted[k] <= grid[g] * (1 + 1e-12)) { out.set(sorted[k], m.eps); k++; }
  }
  return times.map((x) => (x <= 0 ? 1 / instantaneous(p) : out.get(x) ?? m.eps));
}

/**
 * Hold a strain for tHold, then release it (stress to zero) and let it recover.
 * Returns the fraction of the original strain recovered at each time after release.
 */
export function recoveryAfterHold(p: Prony, tHold: number, times: number[]) {
  const m = stepper(p);
  m.jumpStrain(1);
  if (tHold > 0) m.stepStrain(tHold);
  m.jumpStress(-m.stress()); // release: elastic spring-back of every arm at once
  const tMax = Math.max(...times), grid = [0, ...logSteps(Math.max(1e-12, Math.min(...times) / 100), tMax)];
  const sorted = [...times].sort((a, b) => a - b), out = new Map<number, number>();
  let k = 0;
  for (let g = 1; g < grid.length && k < sorted.length; g++) {
    m.stepStress(grid[g] - grid[g - 1], 0);
    while (k < sorted.length && sorted[k] <= grid[g] * (1 + 1e-12)) { out.set(sorted[k], 1 - m.eps); k++; }
  }
  return { immediate: relaxation(p, tHold) / instantaneous(p), at: times.map((x) => out.get(x) ?? 1 - m.eps) };
}

/** Abaqus-style card: instantaneous modulus, normalised g_i (k_i = 0: no bulk relaxation) and WLF shift. */
export function abaqusCard(p: Prony, nu: number, tRef: number, c1: number, c2: number, name = 'VISCO') {
  const e0 = instantaneous(p);
  const rows = p.terms.map((a) => `${(a.e / e0).toPrecision(5)}, 0., ${a.tau.toPrecision(5)}`);
  return [
    `*MATERIAL, NAME=${name}`,
    '*ELASTIC, MODULI=INSTANTANEOUS',
    `${e0.toPrecision(6)}, ${nu}`,
    '*VISCOELASTIC, TIME=PRONY',
    ...rows,
    '*TRS, DEFINITION=WLF',
    `${tRef}, ${c1.toPrecision(5)}, ${c2.toPrecision(5)}`,
  ].join('\n');
}
