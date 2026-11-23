// Erosive burning and the flow along the port. A quasi-steady, one-dimensional model of the gas that the grain adds to
// its port: the mass flux that builds up toward the nozzle, the pressure that falls from the head end, the burn rate
// that the flow raises, the burn-back station by station, and the axial load that the pressure gradient puts on the
// grain. Units: mm, MPa, s and kg unless stated; the correlations work in SI. Shown and derived on
// /motor/erosive-burning/. Screening only: a production prediction calibrates its erosive law on firings.

import { burnBack, performance, type BurnBack, type Port, type Propellant } from './grain.ts';
import { equilibriumPressure } from './ballistics.ts';

export const G0 = 9.80665;

export interface Gas {
  gamma: number; // ratio of specific heats of the gas in the port
  cStar: number; // characteristic velocity, m/s
  mu: number; // viscosity of the gas, Pa·s
}

/** The two constants of the Mukunda–Paul law. The published values are 0.023 and 35. */
export interface ErosiveLaw { K1: number; gth: number }
export const MUKUNDA_PAUL: ErosiveLaw = { K1: 0.023, gth: 35 };

// ---------------------------------------------------------------------------
// Gas dynamics of the port
// ---------------------------------------------------------------------------

/** Γ(γ): the mass flow through a choked throat is Γ·p0·At/√(R·T0). */
export const gammaFn = (g: number) => Math.sqrt(g) * Math.pow(2 / (g + 1), (g + 1) / (2 * (g - 1)));

/** R·T0 of the gas, m²/s², from c* = √(R·T0)/Γ. */
export const rt0 = (cStar: number, g: number) => (cStar * gammaFn(g)) ** 2;

/** Isentropic area ratio A/A* at Mach M. */
export const areaRatio = (M: number, g: number) =>
  Math.pow((2 / (g + 1)) * (1 + ((g - 1) / 2) * M * M), (g + 1) / (2 * (g - 1))) / M;

/** Subsonic Mach number for an area ratio A/A* (1 at the throat; NaN below 1). */
export function subsonicMach(ratio: number, g: number) {
  if (!(ratio >= 1)) return NaN;
  if (ratio === 1) return 1;
  let lo = 1e-12, hi = 1;
  for (let k = 0; k < 200; k++) {
    const m = (lo + hi) / 2;
    if (areaRatio(m, g) > ratio) lo = m; else hi = m;
  }
  return (lo + hi) / 2;
}

/**
 * A port of constant area with gas added along its length, and the throat at its end. The gas leaves the head end at
 * rest. With no axial momentum in the added gas and no friction, p + ρu² stays constant along the port, so the static
 * pressure falls by 1 + γM² from the head end. The flow from the end of the port to the throat is isentropic, so the
 * port-to-throat area ratio alone sets M at the end of the port.
 */
export function constantPort(ratio: number, g: number) {
  const M = subsonicMach(ratio, g), k = 1 + ((g - 1) / 2) * M * M, s = 1 + g * M * M;
  return {
    M,
    staticDrop: s, // head-end pressure ÷ static pressure at the end of the port
    totalDrop: s / Math.pow(k, g / (g - 1)), // head-end pressure ÷ stagnation pressure at the nozzle
  };
}

/** Mass flux at the end of the port, kg/m²·s, from the stagnation pressure at the nozzle (MPa) and the port-to-throat ratio. */
export const aftFlux = (p0: number, cStar: number, ratio: number) => (p0 * 1e6) / (cStar * ratio);

/** φ(M) = M·√(1 + (γ−1)M²/2)/(1 + γM²), which is (ṁ/F)·√(R·T0/γ) with F = pA(1 + γM²). It is largest at M = 1. */
export const phi = (M: number, g: number) => (M * Math.sqrt(1 + ((g - 1) / 2) * M * M)) / (1 + g * M * M);

/** The subsonic M for a value of φ, in closed form. NaN above the limit 1/√(2(γ+1)): there the port chokes. */
export function machOfPhi(f: number, g: number) {
  const d = 1 - 2 * (g + 1) * f * f;
  if (d < -1e-12) return NaN; // the tolerance keeps M = 1 itself from rounding into a choke
  return Math.sqrt((2 * f * f) / (1 - 2 * g * f * f + Math.sqrt(Math.max(0, d))));
}

// ---------------------------------------------------------------------------
// Erosive burning laws (SI: G kg/m²·s, r m/s, d m, ρ kg/m³, μ Pa·s)
// ---------------------------------------------------------------------------

/**
 * Mukunda & Paul (1997), their Eq. 12: η = r/r0 = 1 + K1·(g^0.8 − gth^0.8) for g > gth, and 1 below. g = g0·(Re0/1000)^−0.125,
 * with g0 = G/(ρp·r0) and Re0 = ρp·r0·d/μ, r0 the rate with no flow over the surface and d the hydraulic diameter of the
 * port. Published: K1 = 0.023, gth = 35.
 */
export function mukundaPaul(G: number, rhoP: number, r0: number, d: number, mu: number, law: ErosiveLaw = MUKUNDA_PAUL) {
  const m0 = rhoP * r0, Re0 = (m0 * d) / mu, g = (G / m0) * Math.pow(Re0 / 1000, -0.125);
  const eta = g > law.gth ? 1 + law.K1 * (Math.pow(g, 0.8) - Math.pow(law.gth, 0.8)) : 1;
  return { g0: G / m0, Re0, g, eta };
}

/** The mass flux at which the Mukunda–Paul law starts to raise the rate: G_th = gth·ρp·r0·(Re0/1000)^0.125. */
export function thresholdFlux(rhoP: number, r0: number, d: number, mu: number, gth = MUKUNDA_PAUL.gth) {
  const m0 = rhoP * r0;
  return gth * m0 * Math.pow((m0 * d) / mu / 1000, 0.125);
}

/**
 * Lenoir & Robillard (1957): r = r0 + α·G^0.8·d^−0.2·exp(−β·ρp·r/G), solved for r. The first factor is the heat transfer
 * of turbulent flow in a pipe; the exponential is the gas that blows off the surface and thickens the layer over it.
 * The rate is the root of an increasing, concave function, so Newton's method from r0 climbs to it without overshoot.
 */
export function lenoirRobillard(r0: number, G: number, d: number, rhoP: number, alpha: number, beta = 53) {
  if (!(G > 0)) return r0;
  const c = alpha * Math.pow(G, 0.8) * Math.pow(d, -0.2), k = (beta * rhoP) / G;
  let r = r0;
  for (let i = 0; i < 100; i++) {
    const e = c * Math.exp(-k * r), dr = (r - r0 - e) / (1 + k * e);
    r -= dr;
    if (Math.abs(dr) <= 1e-15 * r) break;
  }
  return r;
}

/** The Lenoir–Robillard coefficient from properties: α = 0.0288·cp·μ^0.2·Pr^(−2/3)·(Tf − Ts)/(ρp·cs·(Ts − Ti)). SI. */
export const lrAlpha = (cp: number, mu: number, Pr: number, rhoP: number, cs: number, Tf: number, Ts: number, Ti: number) =>
  (0.0288 * cp * Math.pow(mu, 0.2) * Math.pow(Pr, -2 / 3) * (Tf - Ts)) / (rhoP * cs * (Ts - Ti));

// ---------------------------------------------------------------------------
// The port at one instant
// ---------------------------------------------------------------------------

/** One length of the port: its flow area (mm²), the perimeter that burns (mm) and its hydraulic diameter (mm). */
export interface Cell { A: number; P: number; dh: number }

export interface FlowCase {
  cells: Cell[]; // equal lengths, from the head end to the nozzle end
  length: number; // grain length, mm
  prop: Propellant;
  gas: Gas;
  law: ErosiveLaw | null; // null: no erosive burning, the port flow only
  At: number; // throat area, mm²
}

export interface FlowPoint {
  x: number; // distance from the head end to the end of the cell, mm
  p: number; // static pressure, MPa
  M: number;
  G: number; // mass flux, kg/m²·s
  r: number; // burn rate over the cell, mm/s
  eta: number; // burn rate ÷ the rate with no flow, over the cell
  mdot: number; // mass flow through the port, kg/s
}

export interface PortFlow {
  ok: boolean;
  why?: string;
  pHead: number; // MPa: the gas is at rest at the head end
  pAft: number; // static pressure at the end of the port, MPa
  p0: number; // stagnation pressure at the nozzle, MPa
  M: number; // Mach number at the end of the port
  mdot: number; // kg/s
  points: FlowPoint[];
  rates: number[]; // burn rate of each cell, mm/s
}

const fail = (why: string): PortFlow => ({ ok: false, why, pHead: NaN, pAft: NaN, p0: NaN, M: NaN, mdot: NaN, points: [], rates: [] });

/**
 * March from the head end at a head-end pressure pH (MPa). Each cell adds ρp·r·P·Δx of gas with no axial momentum, at the
 * mean of its inlet and outlet states (predictor, corrector), and a step in area between two cells takes p·ΔA into the
 * momentum flux F = pA + ṁu. M follows from ṁ/F in closed form. Returns null if the port chokes.
 */
function march(pH: number, c: FlowCase, keep: boolean) {
  const g = c.gas.gamma, cg = Math.sqrt(rt0(c.gas.cStar, g) / g), N = c.cells.length, dx = c.length / N / 1000;
  const { rhoP, a, n } = c.prop, mu = c.gas.mu;
  const rate = (p: number, G: number, dh: number) => {
    const r0 = (a * Math.pow(Math.max(p, 0) / 1e6, n)) / 1000;
    const eta = c.law && G > 0 ? mukundaPaul(G, rhoP, r0, dh, mu, c.law).eta : 1;
    return { r: r0 * eta, eta };
  };
  const state = (mdot: number, F: number, A: number) => {
    const M = mdot > 0 ? machOfPhi((mdot * cg) / F, g) : 0;
    return { M, p: F / (A * (1 + g * M * M)) };
  };
  let p = pH * 1e6, M = 0, mdot = 0, Aprev = c.cells[0].A * 1e-6, F = p * Aprev;
  const points: FlowPoint[] = [], rates: number[] = new Array(N);
  for (let i = 0; i < N; i++) {
    const cell = c.cells[i], A = cell.A * 1e-6, P = cell.P * 1e-3, dh = cell.dh * 1e-3;
    if (A !== Aprev) {
      const F0 = F;
      let pm = p, s = { M, p };
      for (let k = 0; k < 3; k++) {
        F = F0 + pm * (A - Aprev);
        s = state(mdot, F, A);
        if (Number.isNaN(s.M)) return null;
        pm = (p + s.p) / 2;
      }
      p = s.p; M = s.M; Aprev = A;
    }
    let q = rate(p, mdot / A, dh), mo = mdot + rhoP * q.r * P * dx, so = state(mo, F, A);
    if (Number.isNaN(so.M)) return null;
    q = rate((p + so.p) / 2, (mdot + mo) / (2 * A), dh);
    mo = mdot + rhoP * q.r * P * dx;
    so = state(mo, F, A);
    if (Number.isNaN(so.M)) return null;
    rates[i] = q.r * 1000;
    mdot = mo; M = so.M; p = so.p;
    if (keep) points.push({ x: ((i + 1) * c.length) / N, p: p / 1e6, M, G: mdot / A, r: q.r * 1000, eta: q.eta, mdot });
  }
  const p0 = p * Math.pow(1 + ((g - 1) / 2) * M * M, g / (g - 1));
  return { mdot, p0, M, p, points, rates };
}

/** Total burning area of the cells, mm². */
const burningArea = (c: FlowCase) => c.cells.reduce((s, x) => s + x.P, 0) * (c.length / c.cells.length);

/**
 * The port at one instant: the head-end pressure at which the gas that the grain makes leaves through the throat,
 * ṁ = p0·At/c*. The residual falls as pH rises (the throat passes ∝ pH, the grain makes ∝ pH^n), and a port that chokes
 * needs a higher pH. A bracketed false position (Illinois) finds it.
 */
export function portFlow(c: FlowCase, guess?: number): PortFlow {
  if (!c.cells.length) return fail('no port');
  const Aend = c.cells[c.cells.length - 1].A;
  if (!(Aend > c.At)) return fail('The port at the nozzle end is not larger than the throat: the port, not the throat, chokes.');
  const Ab = burningArea(c);
  if (!(Ab > 0)) return fail('nothing is burning');
  const p0D = equilibriumPressure({ rhoP: c.prop.rhoP, a: c.prop.a, n: c.prop.n, cStar: c.gas.cStar, kn: Ab / c.At });
  if (!Number.isFinite(p0D)) return fail('n must be below 1');
  const At = c.At * 1e-6, cs = c.gas.cStar;
  const res = (pH: number) => {
    const m = march(pH, c, false);
    return m ? m.mdot - (m.p0 * At) / cs : Infinity;
  };
  let lo = guess && guess > 0 ? guess : p0D, hi = lo, flo = res(lo), fhi = flo;
  let k = 0;
  if (flo > 0) {
    do { lo = hi; flo = fhi; hi *= 1.08; fhi = res(hi); } while (fhi > 0 && ++k < 400);
  } else {
    do { hi = lo; fhi = flo; lo /= 1.08; flo = res(lo); } while (flo <= 0 && ++k < 400);
  }
  if (!(fhi <= 0) || !(flo > 0)) return fail('no solution found');
  let side = 0;
  for (let it = 0; it < 100 && hi - lo > 1e-10 * hi; it++) {
    const m = Number.isFinite(flo) ? hi - (fhi * (hi - lo)) / (fhi - flo) : Math.sqrt(lo * hi);
    const fm = res(m);
    if (fm > 0) {
      lo = m; flo = fm;
      if (side === -1 && Number.isFinite(fhi)) fhi /= 2;
      side = -1;
    } else {
      hi = m; fhi = fm;
      if (side === 1 && Number.isFinite(flo)) flo /= 2;
      side = 1;
    }
    if (fm === 0) { lo = hi = m; break; }
  }
  const pH = hi; // the side that the throat can pass: never choked
  const m = march(pH, c, true);
  if (!m) return fail('the port chokes');
  return { ok: true, pHead: pH, pAft: m.p / 1e6, p0: m.p0 / 1e6, M: m.M, mdot: m.mdot, points: m.points, rates: m.rates };
}

// ---------------------------------------------------------------------------
// The grain section, and the axial load that the port flow puts on the grain
// ---------------------------------------------------------------------------

/** The cross-section of a prismatic grain as it burns back: perimeter P(y) and port area A(y) after a web y. */
export interface Section {
  bb: BurnBack; // the burn-back over the full length, for the 0-D comparison
  P: (y: number) => number; // mm
  A: (y: number) => number; // mm²
  dh: (y: number) => number; // mm
  web: number; // first contact with the case, mm
  burnout: number; // all propellant gone, mm
  caseArea: number; // mm²
  A0: number; // port area as cast, mm²
}

/** Section tables for a grain of diameter od and length L. A round port is exact; other ports use the grid burn-back. */
export function section(od: number, length: number, port: Port, n = 400): Section {
  const R = od / 2, caseArea = Math.PI * R * R;
  let bb: BurnBack;
  if (port.kind === 'circular') {
    const a0 = port.d / 2, web = Math.max(0, R - a0), steps = 400, out = [];
    for (let s = 0; s <= steps; s++) {
      const y = (web * s) / steps, perimeter = s < steps ? 2 * Math.PI * (a0 + y) : 0;
      out.push({ y, perimeter, portArea: Math.PI * (a0 + y) ** 2, burnArea: perimeter * length });
    }
    bb = {
      steps: out, web, burnout: web, caseArea, portArea0: Math.PI * a0 * a0,
      propVolume: (caseArea - Math.PI * a0 * a0) * length,
      volumetricLoading: 1 - (a0 * a0) / (R * R), sliverFraction: 0, map: null,
    };
  } else {
    bb = burnBack({ od, length, segments: 1, burningEnds: 0, port }, 160, n);
  }
  const st = bb.steps, last = st[st.length - 1].y;
  const lerp = (y: number, f: (s: (typeof st)[number]) => number) => {
    if (y <= 0) return f(st[0]);
    if (y >= last) return f(st[st.length - 1]);
    const u = (y / last) * (st.length - 1), i = Math.min(st.length - 2, Math.floor(u)), w = u - i;
    return f(st[i]) * (1 - w) + f(st[i + 1]) * w;
  };
  const P = (y: number) => (y >= bb.burnout ? 0 : lerp(y, (s) => s.perimeter));
  const A = (y: number) => (y >= bb.burnout ? caseArea : Math.min(caseArea, lerp(y, (s) => s.portArea)));
  const dh = (y: number) => {
    const a = A(y), p = P(y), eq = Math.sqrt((4 * a) / Math.PI);
    return p > 0 ? Math.min(eq, (4 * a) / p) : eq;
  };
  return { bb, P, A, dh, web: bb.web, burnout: bb.burnout, caseArea, A0: bb.portArea0 };
}

/**
 * The axial load of the port flow on a case-bonded grain. The pressure falls toward the nozzle, so the gas pushes the
 * grain aft. Bonded to the case, the nearly incompressible grain takes the local pressure as its axial stress, and the
 * bond carries the change of it: τ = (A_case − A_port)/(2πb)·|dp/dx|. The gradient acts like an acceleration of
 * |dp/dx|/(ρp·g) on the propellant.
 */
export function gradientLoad(flow: PortFlow, s: { caseArea: number; portArea: number; length: number; rhoP: number; od: number }) {
  const pts = flow.points, N = pts.length;
  if (!flow.ok || N < 3) return null;
  const dx = s.length / N; // mm
  const grad = (3 * pts[N - 1].p - 4 * pts[N - 2].p + pts[N - 3].p) / (2 * dx); // MPa/mm at the nozzle end, negative
  const Ag = s.caseArea - s.portArea, b = s.od / 2, drop = flow.pHead - flow.pAft;
  const perG = (s.rhoP * G0) / 1e9; // MPa per mm of a 1 g body force
  return {
    drop, // MPa
    force: (Ag * drop) / 1000, // kN on the grain, toward the nozzle
    grad: -grad * 1000, // MPa/m at the nozzle end
    gAft: -grad / perG, // equivalent acceleration at the nozzle end, g
    gMean: drop / s.length / perG, // over the whole grain, g
    tauAft: (Ag / (2 * Math.PI * b)) * -grad, // bond shear at the nozzle end, MPa
  };
}

// ---------------------------------------------------------------------------
// Through the burn: each length of the port burns back at its own rate
// ---------------------------------------------------------------------------

export interface Burn1DInputs {
  od: number; // grain outer diameter, mm
  length: number; // mm
  port: Port;
  prop: Propellant;
  gas: Gas;
  law: ErosiveLaw | null;
  throatD: number; // mm
  cells?: number;
  steps?: number;
  sec?: Section; // reuse a section already computed
}

export interface Burn1DPoint {
  t: number; // s
  pHead: number; p0: number; pAft: number; // MPa
  M: number; // at the nozzle end
  G: number; // mass flux at the nozzle end, kg/m²·s
  etaMax: number;
}

export interface Burn1D {
  ok: boolean;
  why?: string;
  trace: Burn1DPoint[];
  zeroD: { t: number; p: number }[]; // the uniform-pressure model of the grain page
  peak: { p: number; t: number };
  peak0: { p: number; t: number };
  start: { pHead: number; p0D: number }; // at ignition
  touch: { head: number; aft: number }; // time at which each end of the port first reaches the case, s
  end: number; // all propellant gone, s
  end0: number;
  web0: number; // the uniform-pressure model reaches the case, s
  profiles: { t: number; r: number[] }[]; // equivalent port radius √(A/π) along the grain at each step, mm
  mass: number; // propellant burned, from the flow through the nozzle, kg
  propMass: number; // kg
  sec: Section;
}

/**
 * The burn, station by station. The grain is prismatic, with inhibited ends. Each cell keeps its own web burned y and
 * burns at the rate that the port flow gives it; Heun's method advances the webs. The pressure is quasi-steady: no
 * ignition transient, no gas stored in the port, no throat erosion.
 */
export function burn1D(i: Burn1DInputs): Burn1D {
  const N = i.cells ?? 48, steps = i.steps ?? 160;
  const sec = i.sec ?? section(i.od, i.length, i.port);
  const At = (Math.PI * i.throatD * i.throatD) / 4;
  const prop = i.prop, gas = i.gas;
  const empty = (why: string): Burn1D => ({
    ok: false, why, trace: [], zeroD: [], peak: { p: NaN, t: NaN }, peak0: { p: NaN, t: NaN },
    start: { pHead: NaN, p0D: NaN }, touch: { head: NaN, aft: NaN }, end: NaN, end0: NaN, web0: NaN, profiles: [], mass: NaN,
    propMass: NaN, sec,
  });
  if (!(sec.burnout > 0)) return empty('nothing to burn');
  const cellsAt = (y: number[]): Cell[] => y.map((v) => ({ A: sec.A(v), P: sec.P(v), dh: sec.dh(v) }));
  const flowAt = (y: number[], guess?: number) =>
    portFlow({ cells: cellsAt(y), length: i.length, prop, gas: gas, law: i.law, At }, guess);

  const y = new Array(N).fill(0);
  const trace: Burn1DPoint[] = [], profiles: { t: number; r: number[] }[] = [];
  const touch = { head: NaN, aft: NaN };
  let t = 0, mass = 0, guess: number | undefined, prevM = 0, end = NaN;
  const dy = sec.burnout / steps;
  for (let k = 0; k < 20 * steps; k++) {
    const f = flowAt(y, guess);
    if (!f.ok) {
      if (k === 0) return empty(f.why ?? 'no solution');
      break;
    }
    guess = f.pHead;
    const etaMax = Math.max(...f.points.map((q) => q.eta));
    trace.push({ t, pHead: f.pHead, p0: f.p0, pAft: f.pAft, M: f.M, G: f.points[N - 1].G, etaMax });
    profiles.push({ t, r: y.map((v) => Math.sqrt(sec.A(v) / Math.PI)) });
    if (k > 0) mass += ((f.mdot + prevM) / 2) * (t - trace[trace.length - 2].t);
    prevM = f.mdot;
    const r1 = f.rates.map((r, j) => (y[j] < sec.burnout ? r : 0));
    const rMax = Math.max(...r1);
    if (!(rMax > 0)) { end = t; break; }
    // a step of dy at the fastest cell, but land on the next burnout of a cell, so that the end of the burn is exact
    let dt = dy / rMax;
    for (let j = 0; j < N; j++) if (r1[j] > 0) dt = Math.min(dt, Math.max((sec.burnout - y[j]) / r1[j], dt * 1e-3));
    const yP = y.map((v, j) => v + r1[j] * dt);
    const fP = flowAt(yP, f.pHead);
    // a cell that the predictor takes to burnout still regresses at its rate there; the clamp below ends it
    const r2 = fP.ok ? fP.rates.map((r, j) => (r1[j] > 0 ? r : 0)) : r1;
    const yN = y.map((v, j) => Math.min(sec.burnout, v + ((r1[j] + r2[j]) / 2) * dt));
    for (const [key, j] of [['head', 0], ['aft', N - 1]] as const) {
      if (Number.isNaN(touch[key]) && y[j] < sec.web && yN[j] >= sec.web) {
        touch[key] = t + (dt * (sec.web - y[j])) / (yN[j] - y[j]);
      }
    }
    for (let j = 0; j < N; j++) y[j] = yN[j];
    t += dt;
    if (y.every((v) => v >= sec.burnout)) { end = t; break; }
  }
  if (Number.isNaN(end)) end = t;
  // the last interval, to burnout, at a pressure that falls to zero
  mass += (prevM / 2) * (end - trace[trace.length - 1].t);
  profiles.push({ t: end, r: y.map((v) => Math.sqrt(sec.A(v) / Math.PI)) });

  const perf = performance(sec.bb, prop, i.throatD, 1);
  const zeroD = perf.trace.map((q) => ({ t: q.t, p: q.p }));
  const pk = trace.reduce((a, b) => (b.pHead > a.pHead ? b : a), trace[0]);
  const pk0 = zeroD.reduce((a, b) => (b.p > a.p ? b : a), zeroD[0]);
  return {
    ok: true, trace, zeroD,
    peak: { p: pk.pHead, t: pk.t }, peak0: { p: pk0.p, t: pk0.t },
    start: { pHead: trace[0].pHead, p0D: zeroD[0].p },
    touch, end, end0: perf.burnTime, web0: perf.mainBurnTime, profiles, mass,
    propMass: (sec.bb.propVolume * prop.rhoP) / 1e9, sec,
  };
}
