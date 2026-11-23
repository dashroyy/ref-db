// Propellant mechanical tests: from the tensile tests of a characterisation to a strain allowable for a grain margin.
// Each test is shifted to its reduced strain rate (WLF); a quadratic in the log of the reduced rate fits the capability
// master curve; a one-sided tolerance bound on the regression gives the lower bound at the rate and the temperature of a
// load; and the corrections for the stress state, the pressure and the age turn it into the allowable. Units: mm, °C,
// % strain, s. Shown and derived on /make/propellant-tests/.

import { wlfLogShift } from './propellant.ts';
import { noncentralTCdf, normalQuantile } from './allowables.ts';

export interface TensileTest { T: number; rate: number; em: number } // °C; crosshead speed, mm/min; strain at maximum stress, %
export interface Shift { Ts: number; C1: number; C2: number; Leff: number } // reference temperature, WLF constants, effective gauge length (mm)

/** The strain rate of a tensile test: crosshead speed over the effective gauge length, 1/s. */
export const strainRate = (rateMmPerMin: number, Leff: number) => rateMmPerMin / 60 / Leff;

/** log₁₀ of the reduced strain rate: the rate at the test temperature times a_T, the rate at Ts that has the same effect. */
export const logReducedRate = (rate: number, T: number, s: Shift) => Math.log10(rate) + wlfLogShift(T, s.Ts, s.C1, s.C2);

/** Solve a small linear system A·x = b by Gauss–Jordan elimination with partial pivoting (A is copied). */
function solve(A: number[][], b: number[]) {
  const n = b.length, M = A.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]];
    const d = M[c][c];
    if (Math.abs(d) < 1e-300) return null;
    for (let k = c; k <= n; k++) M[c][k] /= d;
    for (let r = 0; r < n; r++) if (r !== c) { const f = M[r][c]; for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k]; }
  }
  return M.map((row) => row[n]);
}

export interface Fit {
  n: number; nu: number; // tests, and degrees of freedom of the scatter
  coef: number[]; // in (L − Lm): b0 + b1·u + b2·u²
  Lm: number; // the centre of the data in log reduced rate
  s: number; // standard deviation about the fit, % strain
  predict: (L: number) => number;
  leverage: (L: number) => number; // x0ᵀ(XᵀX)⁻¹x0: 1/n at the centre, larger away from it
  peak: { L: number; em: number } | null; // the maximum of the curve, if it has one inside the data
  range: [number, number]; // the reduced rates that the tests cover
}

/** A least-squares quadratic in the log of the reduced rate. Needs four tests or more, at three rates or more. */
export function fitCapability(L: number[], y: number[]): Fit | null {
  const n = L.length;
  if (n < 4 || new Set(L.map((v) => v.toFixed(6))).size < 3) return null;
  const Lm = L.reduce((s, v) => s + v, 0) / n, u = L.map((v) => v - Lm);
  const S = (k: number) => u.reduce((s, v) => s + v ** k, 0), Sy = (k: number) => u.reduce((s, v, i) => s + v ** k * y[i], 0);
  const XtX = [[n, S(1), S(2)], [S(1), S(2), S(3)], [S(2), S(3), S(4)]];
  const coef = solve(XtX, [Sy(0), Sy(1), Sy(2)]);
  if (!coef) return null;
  const inv = [0, 1, 2].map((j) => solve(XtX, [0, 1, 2].map((i) => (i === j ? 1 : 0)))!);
  const f = (Lx: number) => { const v = Lx - Lm; return coef[0] + coef[1] * v + coef[2] * v * v; };
  const sse = L.reduce((s, v, i) => s + (y[i] - f(v)) ** 2, 0), nu = n - 3;
  const lev = (Lx: number) => {
    const x = [1, Lx - Lm, (Lx - Lm) ** 2];
    return x.reduce((s, xi, i) => s + xi * x.reduce((t, xj, j) => t + inv[i][j] * xj, 0), 0);
  };
  const range: [number, number] = [Math.min(...L), Math.max(...L)];
  const Lp = coef[2] < 0 ? Lm - coef[1] / (2 * coef[2]) : NaN;
  return {
    n, nu, coef, Lm, s: Math.sqrt(sse / Math.max(1, nu)), predict: f, leverage: lev, range,
    peak: Number.isFinite(Lp) && Lp >= range[0] && Lp <= range[1] ? { L: Lp, em: f(Lp) } : null,
  };
}

/**
 * The one-sided tolerance factor for a regression at a point of leverage h: the predicted mean less k·s is exceeded by
 * a fraction p of the population with confidence γ. k = t′_γ(ν, δ = z_p/√h)·√h, the noncentral t. With h = 1/n and
 * ν = n − 1 it is the factor of an A- or B-basis value from a plain sample.
 */
export function regressionK(nu: number, h: number, p: number, gamma = 0.95) {
  const delta = normalQuantile(p) / Math.sqrt(h);
  let lo = delta, hi = delta + 20 * Math.sqrt(1 + (delta * delta) / (2 * nu)) + 10;
  for (let k = 0; k < 60; k++) {
    const mid = (lo + hi) / 2;
    if (noncentralTCdf(mid, nu, delta) < gamma) lo = mid; else hi = mid;
  }
  return ((lo + hi) / 2) * Math.sqrt(h);
}

/** The capability at a reduced rate: the fitted mean and its lower bound, with the factor used. */
export function capabilityAt(fit: Fit, L: number, p: number, gamma = 0.95) {
  const h = fit.leverage(L), k = regressionK(fit.nu, h, p, gamma), mean = fit.predict(L);
  return { mean, k, h, lower: mean - k * fit.s, inside: L >= fit.range[0] && L <= fit.range[1] };
}

export interface Corrections {
  biaxial: number; // ratio of the biaxial to the uniaxial capability, from strip-biaxial tests
  ageing: number; // fraction of the capability left at the end of life, from ageing and surveillance tests
  pressure: number; // credit for the superimposed pressure of ignition, if the programme allows one (1 = none)
}

/** The steps from the lower bound to the allowable, and the margin against an analysis strain with a factor of safety. */
export function allowable(lower: number, c: Corrections, strain: number, sf: number) {
  const steps = [
    { name: 'lower bound', v: lower },
    { name: 'biaxial', v: lower * c.biaxial },
    { name: 'end of life', v: lower * c.biaxial * c.ageing },
    { name: 'pressure', v: lower * c.biaxial * c.ageing * c.pressure },
  ];
  const allow = steps[steps.length - 1].v;
  return { steps, allow, required: sf * strain, ms: allow / (sf * strain) - 1 };
}
