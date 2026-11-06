// Static test firing of a solid motor: reading the pressure and thrust traces (10% points, web burnout by the aft
// tangent-bisector method), reducing them to delivered c*, C_F, specific impulse and burn rate, the dynamics of the
// thrust stand, and the uncertainty of the results. A synthetic firing of the 300 mm motor (clearly synthetic) is the
// example. Units: s, MPa, kN, mm, kg. Shown and derived on /verify/static-firing/.
import { erodingThroat, thrustCoefficient, divergence } from './nozzle.ts';

const G0 = 9.80665;
export interface Trace { t: number[]; p: number[]; F: number[] }

// ---------------------------------------------------------------------------
// A synthetic firing
// ---------------------------------------------------------------------------

/** Small seeded random numbers, so that the synthetic firing is the same every time. */
function rng(seed: number) {
  let a = seed >>> 0;
  const u = () => { a = (a + 0x6d2b79f5) >>> 0; let x = Math.imul(a ^ (a >>> 15), 1 | a); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };
  return () => Math.sqrt(-2 * Math.log(u() + 1e-12)) * Math.cos(2 * Math.PI * u());
}

export interface SyntheticInputs {
  p0: number; d0: number; n: number; web: number; a: number; // MPa, mm, —, mm, mm/s per MPa^n
  erosion: number; // throat recession at p0, mm/s
  cStar: number; // delivered c*, m/s
  etaCf: number; eps: number; g: number; pa: number; thetaDeg: number; // the nozzle, for the thrust
  rate?: number; noise?: number; seed?: number; // Hz; fraction of reading
}

/**
 * A neutral grain with an eroding throat (nozzle.ts), a quick ignition rise with a small spike, a rounded knee and a
 * tail-off. Thrust is the delivered C_F times p·A_t. Returns the trace and the propellant mass that it burns.
 */
export function syntheticFiring(s: SyntheticInputs) {
  const r0 = s.a * s.p0 ** s.n, tb0 = s.web / r0;
  const e = erodingThroat({ pc: s.p0, dt: s.d0, eps: s.eps, g: s.g, pa: s.pa, thetaDeg: s.thetaDeg, n: s.n, tb0, e0: s.erosion, steps: 400 });
  const tIg = 0.12, tau = 0.42, tTail = 3.2, rate = s.rate ?? 100, noise = s.noise ?? 0.003, rnd = rng(s.seed ?? 7);
  const main = (tt: number) => { // pressure and throat diameter during the main burn, by interpolation in time
    const tr = e.trace;
    if (tt <= 0) return { p: tr[0].p, d: tr[0].d };
    for (let i = 1; i < tr.length; i++) if (tr[i].t >= tt) { const f = (tt - tr[i - 1].t) / (tr[i].t - tr[i - 1].t); return { p: tr[i - 1].p + f * (tr[i].p - tr[i - 1].p), d: tr[i - 1].d + f * (tr[i].d - tr[i - 1].d) }; }
    return { p: e.pEnd, d: e.dEnd };
  };
  const lambda = divergence(s.thetaDeg);
  const T: number[] = [], P: number[] = [], F: number[] = [];
  let mass = 0, prev: { t: number; m: number } | null = null;
  const end = tIg + e.tb + tTail;
  for (let k = 0; k * (1 / rate) <= end + 1e-9; k++) {
    const t = k / rate;
    let p: number, d: number;
    if (t < tIg) { // ignition: smooth rise with a small spike
      const x = t / tIg, m = main(0);
      p = m.p * (x * x * (3 - 2 * x)) * (1 + 0.06 * Math.exp(-(((x - 0.85) / 0.12) ** 2)));
      d = m.d;
    } else if (t < tIg + e.tb) { const m = main(t - tIg); p = m.p; d = m.d; }
    else { // web burnout: the sliver burns away with a rounded knee, then the chamber empties
      const x = (t - tIg - e.tb) / tau;
      p = e.pEnd * Math.exp(-(x ** 1.8)); d = e.dEnd;
    }
    const at = (Math.PI * d * d) / 4; // mm²
    const cf = p > 0.02 ? s.etaCf * thrustCoefficient(s.g, (s.eps * s.d0 * s.d0) / (d * d), p, s.pa, lambda).cf : 0;
    const mdot = (p * at) / s.cStar; // kg/s
    if (prev) mass += ((mdot + prev.m) / 2) * (t - prev.t);
    prev = { t, m: mdot };
    T.push(+t.toFixed(4));
    P.push(Math.max(0, p * (1 + noise * rnd())));
    F.push(Math.max(0, (Math.max(cf, 0) * p * at) / 1000 * (1 + noise * rnd()))); // kN
  }
  return { trace: { t: T, p: P, F } as Trace, mass, dEnd: e.dEnd, tb0, r0 };
}

/** The synthetic firing of the 300 mm motor used as the worked example (not test data). */
export const EXAMPLE_FIRING: SyntheticInputs = {
  p0: 8.8, d0: 45.65, n: 0.35, web: 100, a: 4.05, erosion: 0.1, cStar: 1494, etaCf: 0.935, eps: 8, g: 1.2, pa: 0.101325, thetaDeg: 15,
};

// ---------------------------------------------------------------------------
// Reading a trace
// ---------------------------------------------------------------------------

/** Parse "t, p, F" lines (commas, tabs, semicolons or spaces). Lines that are not three numbers are skipped. */
export function parseTrace(text: string) {
  const t: number[] = [], p: number[] = [], F: number[] = [];
  let skipped = 0;
  for (const line of text.split(/\r?\n/)) {
    const s = line.trim();
    if (!s) continue;
    const v = s.split(/[\s,;]+/).map(Number);
    if (v.length >= 3 && v.slice(0, 3).every(Number.isFinite)) { t.push(v[0]); p.push(v[1]); F.push(v[2]); } else skipped++;
  }
  // keep time increasing
  const ok = t.every((x, i) => i === 0 || x > t[i - 1]);
  return { trace: { t, p, F } as Trace, skipped, ok: ok && t.length >= 20 };
}

/** Trapezoidal integral of y over t between indices i and j (inclusive). */
const integ = (t: number[], y: number[], i = 0, j = t.length - 1) => {
  let s = 0;
  for (let k = i + 1; k <= j; k++) s += ((y[k] + y[k - 1]) / 2) * (t[k] - t[k - 1]);
  return s;
};

/** Least-squares line through points i..j: y = m·t + c. */
function fitLine(t: number[], y: number[], i: number, j: number) {
  let n = 0, st = 0, sy = 0, stt = 0, sty = 0;
  for (let k = i; k <= j; k++) { n++; st += t[k]; sy += y[k]; stt += t[k] * t[k]; sty += t[k] * y[k]; }
  const m = (n * sty - st * sy) / (n * stt - st * st || 1e-30);
  return { m, c: (sy - m * st) / n };
}

/**
 * The 10% points and the web burnout of a pressure trace. Web burnout is found by the aft tangent-bisector method: one
 * tangent to the end of the main burn and one to the steepest part of the tail-off; the bisector of the angle between
 * them meets the curve at web burnout. The construction is made with time scaled by the action time and pressure by
 * its maximum, so that it does not depend on the units.
 */
export function readTrace(tr: { t: number[]; y: number[] }) {
  const { t, y } = tr, N = t.length;
  let iMax = 0;
  for (let k = 1; k < N; k++) if (y[k] > y[iMax]) iMax = k;
  const yMax = y[iMax], lvl = 0.1 * yMax;
  const cross = (k: number) => t[k - 1] + ((lvl - y[k - 1]) / (y[k] - y[k - 1] || 1e-30)) * (t[k] - t[k - 1]);
  let i0 = 0; while (i0 < N && y[i0] < lvl) i0++;
  let i1 = N - 1; while (i1 > 0 && y[i1] < lvl) i1--;
  const t0 = i0 > 0 ? cross(i0) : t[0];
  const t1 = i1 < N - 1 ? cross(i1 + 1) : t[N - 1];
  const T = t1 - t0 || 1, X = (v: number) => (v - t0) / T, Yn = (v: number) => v / yMax;
  // steepest descent after the maximum, on a smoothed slope (±w samples)
  const w = Math.max(2, Math.round(N / 400));
  let iS = iMax, sMin = 0;
  for (let k = Math.max(iMax, w); k < Math.min(N - w, i1 + w); k++) {
    const s = (y[k + w] - y[k - w]) / (t[k + w] - t[k - w]);
    if (s < sMin) { sMin = s; iS = k; }
  }
  // the knee starts where the slope is still small (a tenth of the steepest), walking back from iS
  let iK = iS;
  while (iK > iMax + w && Math.abs((y[iK + w] - y[iK - w]) / (t[iK + w] - t[iK - w])) > 0.1 * Math.abs(sMin)) iK--;
  // tangent 1: the main burn over the half before the knee; tangent 2: the steepest part of the tail-off
  const tA = t0 + 0.5 * (t[iK] - t0);
  let iA = i0; while (iA < iK && t[iA] < tA) iA++;
  const L1 = fitLine(t, y, Math.min(iA, iK - 2), iK), L2 = fitLine(t, y, Math.max(iS - w, 0), Math.min(iS + w, N - 1));
  // in scaled coordinates: y = m·x + c
  const s1 = (L1.m * T) / yMax, c1 = Yn(L1.m * t0 + L1.c), s2 = (L2.m * T) / yMax, c2 = Yn(L2.m * t0 + L2.c);
  const xi = (c2 - c1) / (s1 - s2 || 1e-30), yi = s1 * xi + c1;
  const u1 = [1 / Math.hypot(1, s1), s1 / Math.hypot(1, s1)], u2 = [1 / Math.hypot(1, s2), s2 / Math.hypot(1, s2)];
  let bx = -u1[0] + u2[0], by = -u1[1] + u2[1];
  const bl = Math.hypot(bx, by) || 1; bx /= bl; by /= bl;
  // where the bisector ray (xi, yi) + λ·b meets the curve, between the start of tangent 1 and the steepest point
  let tWb = NaN;
  for (let k = Math.max(iA, 1); k <= Math.min(iS + w, N - 1); k++) {
    const ax = X(t[k - 1]), ay = Yn(y[k - 1]), cx = X(t[k]), cy = Yn(y[k]);
    // solve (xi, yi) + λ b = (ax, ay) + μ (c − a)
    const dx = cx - ax, dy = cy - ay, det = bx * -dy + by * dx;
    if (Math.abs(det) < 1e-15) continue;
    const rx = ax - xi, ry = ay - yi;
    const lam = (rx * -dy + ry * dx) / det, mu = (bx * ry - by * rx) / det;
    if (lam >= 0 && mu >= 0 && mu <= 1) { tWb = t0 + (ax + mu * dx) * T; break; }
  }
  return {
    iMax, yMax, t0, t1, actionTime: t1 - t0, tWb, burnTime: tWb - t0,
    tangent1: { m: L1.m, c: L1.c }, tangent2: { m: L2.m, c: L2.c },
    corner: { t: t0 + xi * T, y: yi * yMax }, bisector: { dt: bx * T, dy: by * yMax },
  };
}

export interface ReduceInputs {
  mp: number; // propellant mass, kg
  dPre: number; dPost: number; // throat diameter before and after the firing, mm
  web?: number; // mm, for the burn rate
  de?: number; g?: number; pa?: number; thetaDeg?: number; // the nozzle exit, for the ideal C_F
}

/**
 * Reduce a firing: times from the pressure trace, impulse from the thrust trace, then c*, C_F, Isp and burn rate.
 * The throat area history is interpolated between the areas before and after the firing in proportion to ∫p^0.8 dt
 * (erosion that follows the heat transfer, as on the Nozzle design page). The result with the plain mean of the two
 * areas is returned as a check: the two differ when the erosion is large.
 */
export function reduceFiring(tr: Trace, r: ReduceInputs) {
  const read = readTrace({ t: tr.t, y: tr.p });
  const N = tr.t.length;
  const idx = (tt: number) => { let k = 0; while (k < N - 1 && tr.t[k] < tt) k++; return k; };
  const i0 = idx(read.t0), i1 = idx(read.t1), iW = idx(read.tWb);
  const impulse = integ(tr.t, tr.F) * 1000; // N·s over the whole trace
  const pInt = integ(tr.t, tr.p) * 1e6; // Pa·s over the whole trace
  const a0 = (Math.PI / 4) * r.dPre ** 2 * 1e-6, a1 = (Math.PI / 4) * r.dPost ** 2 * 1e-6; // m²
  const atAvg = (a0 + a1) / 2;
  // throat area history: the fraction of the erosion done by time t is the fraction of ∫p^0.8 dt done by then
  const w = tr.p.map((p) => Math.max(p, 0) ** 0.8), wTot = integ(tr.t, w) || 1;
  let cum = 0, pAt = 0;
  for (let k = 1; k < N; k++) {
    const dt = tr.t[k] - tr.t[k - 1];
    const before = cum; cum += ((w[k] + w[k - 1]) / 2) * dt;
    const aMid = a0 + (a1 - a0) * ((before + cum) / 2 / wTot);
    pAt += ((tr.p[k] + tr.p[k - 1]) / 2) * 1e6 * aMid * dt;
  }
  const cStar = pAt / r.mp, cf = impulse / pAt; // m/s, and C_F, with the area history
  const cStarMean = (atAvg * pInt) / r.mp, cfMean = impulse / (atAvg * pInt); // with the mean area
  const isp = impulse / (r.mp * G0);
  const pAction = integ(tr.t, tr.p, i0, i1) / (tr.t[i1] - tr.t[i0] || 1);
  const pBurn = Number.isFinite(read.tWb) ? integ(tr.t, tr.p, i0, iW) / (tr.t[iW] - tr.t[i0] || 1) : NaN;
  const fAction = integ(tr.t, tr.F, i0, i1) / (tr.t[i1] - tr.t[i0] || 1);
  let fMax = 0; for (const v of tr.F) fMax = Math.max(fMax, v);
  // ideal C_F at the action-time average pressure, with the mean throat
  const epsAvg = r.de ? (r.de * r.de) / ((r.dPre ** 2 + r.dPost ** 2) / 2) : NaN;
  const cfIdeal = r.de && r.g ? thrustCoefficient(r.g, epsAvg, pAction, r.pa ?? 0.101325, divergence(r.thetaDeg ?? 0)).cf : NaN;
  return {
    read, impulse, isp, cStar, cf, cStarMean, cfMean, cfIdeal, etaCf: cf / cfIdeal, epsAvg,
    pMax: read.yMax, fMax, pAction, pBurn, fAction,
    burnRate: r.web && Number.isFinite(read.burnTime) ? r.web / read.burnTime : NaN, // mm/s at pBurn
    check: (cf * cStar) / G0 - isp, // C_F·c*/g0 = Isp, to rounding
  };
}

// ---------------------------------------------------------------------------
// The thrust stand
// ---------------------------------------------------------------------------

/** Two springs in series (the load cell and the structure), any consistent unit. */
export const series = (k1: number, k2: number) => 1 / (1 / k1 + 1 / k2);

/** Natural frequency of the motor on the thrust path, Hz: k in kN/mm, m in kg. */
export const standFrequency = (kKNmm: number, m: number) => Math.sqrt((kKNmm * 1e6) / m) / (2 * Math.PI);

/**
 * Ringing after a linear rise of duration tr (s) on a stand of natural frequency fn (Hz), undamped: the overshoot as a
 * fraction of the step is |sin(π fn tr)| / (π fn tr). A rise much longer than the period hardly excites the stand.
 */
export const rampOvershoot = (fn: number, tr: number) => (tr > 0 ? Math.abs(Math.sin(Math.PI * fn * tr)) / (Math.PI * fn * tr) : 1);

/** Root-sum-square of relative uncertainties. */
export const rss = (...u: number[]) => Math.sqrt(u.reduce((s, x) => s + x * x, 0));
