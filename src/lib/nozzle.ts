// Solid rocket motor nozzle: ideal (isentropic, one-dimensional) performance with a conical divergence loss, the
// flow-separation screen, throat erosion and what it does to the pressure, thrust and burn of a neutral grain, the
// convective heat-transfer profile (Bartz area scaling) and the axial loads on the nozzle parts.
// Units: MPa, mm, s, N. Shown and derived on /motor/nozzle/. Screening only.

const G0 = 9.80665;

/** Area ratio A/A* at Mach M for a ratio of specific heats g. */
export const areaRatio = (M: number, g: number) =>
  (1 / M) * ((2 / (g + 1)) * (1 + ((g - 1) / 2) * M * M)) ** ((g + 1) / (2 * (g - 1)));

/** Static to stagnation pressure ratio at Mach M. */
export const pressureRatio = (M: number, g: number) => (1 + ((g - 1) / 2) * M * M) ** (-g / (g - 1));

/** Mach number for a static to stagnation pressure ratio. */
export const machFromPressure = (pr: number, g: number) => Math.sqrt((2 / (g - 1)) * (pr ** (-(g - 1) / g) - 1));

/** Mach number at an area ratio eps ≥ 1, on the supersonic (default) or subsonic branch. */
export function machFromArea(eps: number, g: number, supersonic = true) {
  if (eps <= 1) return 1;
  let lo = supersonic ? 1 : 1e-9, hi = supersonic ? 100 : 1;
  for (let i = 0; i < 200; i++) {
    const m = (lo + hi) / 2, a = areaRatio(m, g);
    // A/A* falls with M below 1 and rises above it
    if (supersonic ? a < eps : a > eps) lo = m; else hi = m;
  }
  return (lo + hi) / 2;
}

/** Throat to chamber pressure ratio (M = 1). */
export const throatPressureRatio = (g: number) => (2 / (g + 1)) ** (g / (g - 1));

/** Divergence factor of a conical exit cone of half-angle thetaDeg: λ = (1 + cos θ)/2. */
export const divergence = (thetaDeg: number) => (1 + Math.cos((thetaDeg * Math.PI) / 180)) / 2;

/**
 * Thrust coefficient of an ideal nozzle with a conical divergence loss on the momentum term.
 * pc and pa in the same unit. Returns the exit Mach number and pressure, and C_F in vacuum and at pa.
 */
export function thrustCoefficient(g: number, eps: number, pc: number, pa: number, lambda = 1) {
  const Me = machFromArea(eps, g), pe = pc * pressureRatio(Me, g);
  const mom = Math.sqrt(((2 * g * g) / (g - 1)) * (2 / (g + 1)) ** ((g + 1) / (g - 1)) * (1 - (pe / pc) ** ((g - 1) / g)));
  return { Me, pe, cfMom: lambda * mom, cfVac: lambda * mom + (pe / pc) * eps, cf: lambda * mom + ((pe - pa) / pc) * eps };
}

/** The area ratio that expands to the ambient pressure (the optimum for that ambient). */
export const optimumAreaRatio = (g: number, pc: number, pa: number) => areaRatio(machFromPressure(pa / pc, g), g);

/** Summerfield screen: the flow is likely to separate if the exit pressure is below about 0.4 of ambient. */
export const SEPARATION_RATIO = 0.4;
export function expansionState(pe: number, pa: number) {
  if (pa <= 0) return { state: 'vacuum' as const, ratio: Infinity };
  const ratio = pe / pa;
  return {
    ratio,
    state: ratio < SEPARATION_RATIO ? ('separated' as const) : ratio < 0.97 ? ('over' as const) : ratio <= 1.03 ? ('optimum' as const) : ('under' as const),
  };
}

export interface NozzleInputs {
  pc: number; // chamber pressure, MPa
  dt: number; // throat diameter, mm
  eps: number; // exit to throat area ratio
  g: number; // ratio of specific heats of the exhaust
  pa: number; // ambient pressure, MPa
  thetaDeg?: number; // exit cone half-angle (conical), degrees
  cStar?: number; // m/s, for the specific impulse
}

/** The nozzle at one operating point: exit conditions, C_F, thrust and specific impulse at pa and in vacuum. */
export function nozzlePoint(i: NozzleInputs) {
  const lambda = divergence(i.thetaDeg ?? 0);
  const c = thrustCoefficient(i.g, i.eps, i.pc, i.pa, lambda);
  const at = (Math.PI * i.dt * i.dt) / 4; // mm²
  const de = i.dt * Math.sqrt(i.eps);
  const exp = expansionState(c.pe, i.pa);
  return {
    ...c, lambda, at, de, exp,
    thrust: c.cf * i.pc * at, thrustVac: c.cfVac * i.pc * at, // N
    isp: i.cStar ? (c.cf * i.cStar) / G0 : NaN, ispVac: i.cStar ? (c.cfVac * i.cStar) / G0 : NaN, // s
    massFlow: i.cStar ? (i.pc * at) / i.cStar : NaN, // kg/s (MPa·mm² = N; N / (m/s) = kg/s)
    epsOpt: i.pa > 0 ? optimumAreaRatio(i.g, i.pc, i.pa) : Infinity,
    // the chamber pressure below which the exit flow separates at this ambient (Summerfield), for this area ratio
    pcSeparation: i.pa > 0 ? (SEPARATION_RATIO * i.pa) / pressureRatio(c.Me, i.g) : 0,
  };
}

/**
 * Throat erosion with a neutral grain (constant burning area). The throat grows at a radial rate ė = e0·(p/p0)^m, the
 * pressure falls as p = p0·(d0/d)^(2/(1−n)), and the burn rate as (p/p0)^n. In web fraction w, the throat diameter has a
 * closed form, d(w)^(k+1) = d0^(k+1) + (k+1)·2·e0·tb0·d0^k·w with k = 2(m − n)/(1 − n), where tb0 is the burn time
 * without erosion. Time comes from dt/dw = tb0·(p0/p)^n. A neutral grain discharges the same mass for each part of
 * the web, so the impulse is c*·m_p times the mean C_F over the web.
 */
export function erodingThroat(i: NozzleInputs & { n: number; tb0: number; e0: number; m?: number; steps?: number }) {
  const m = i.m ?? 0.8, k = (2 * (m - i.n)) / (1 - i.n), N = i.steps ?? 200;
  const lambda = divergence(i.thetaDeg ?? 0);
  const dOf = (w: number) => (i.dt ** (k + 1) + (k + 1) * 2 * i.e0 * i.tb0 * i.dt ** k * w) ** (1 / (k + 1));
  const at0 = (Math.PI * i.dt * i.dt) / 4, ae = at0 * i.eps;
  const cf0 = thrustCoefficient(i.g, i.eps, i.pc, i.pa, lambda).cf;
  const trace: { w: number; t: number; d: number; p: number; F: number; F0: number; cf: number; eps: number }[] = [];
  let t = 0, cfSum = 0, prev: { rate: number; cf: number } | null = null;
  for (let s = 0; s <= N; s++) {
    const w = s / N, d = dOf(w), p = i.pc * (i.dt / d) ** (2 / (1 - i.n));
    const at = (Math.PI * d * d) / 4, eps = ae / at;
    const cf = thrustCoefficient(i.g, eps, p, i.pa, lambda).cf;
    const rate = (i.pc / p) ** i.n; // dt/dw ÷ tb0
    if (prev) { t += (i.tb0 * (rate + prev.rate)) / 2 / N; cfSum += (cf + prev.cf) / 2 / N; }
    prev = { rate, cf };
    trace.push({ w, t, d, p, F: cf * p * at, F0: cf0 * i.pc * at0, cf, eps });
  }
  const end = trace[trace.length - 1];
  return {
    trace, cf0,
    dEnd: end.d, pEnd: end.p, epsEnd: end.eps, tb: end.t, // final throat, pressure and area ratio; burn time, s
    pDrop: 1 - end.p / i.pc, stretch: end.t / i.tb0 - 1,
    fStart: trace[0].F, fEnd: end.F,
    impulseRatio: cfSum / cf0, // impulse with erosion ÷ impulse without it
  };
}

/**
 * Axial loads at a chamber pressure pc, from the momentum balance of the gas (aft = positive).
 * - joint: on the nozzle-to-case attachment sealed at ds: (pc − pa)·A_s − F, where F is the thrust at pa.
 * - convergent: on the entrance and throat region up to the throat: pc·A_s − I_t − pa·(A_s − A_t), aft.
 * - exitCone: on the divergent cone, forward: F_vac − I_t − pa·(A_e − A_t). I_t = p_t·A_t·(1 + γ) is the
 *   momentum flux and pressure force at the throat.
 * - test: on the attachment in a static pressure test with the throat plugged: (pc − pa)·A_s.
 */
export function nozzleLoads(i: NozzleInputs & { ds: number }) {
  const pt = nozzlePoint(i);
  const as = (Math.PI * i.ds * i.ds) / 4, at = pt.at, ae = at * i.eps;
  const It = i.pc * throatPressureRatio(i.g) * at * (1 + i.g);
  return {
    point: pt, as, It,
    joint: (i.pc - i.pa) * as - pt.thrust,
    convergent: i.pc * as - It - i.pa * (as - at),
    exitCone: pt.thrustVac - It - i.pa * (ae - at),
    test: (i.pc - i.pa) * as,
  };
}

/**
 * Convective heat transfer along the nozzle relative to the throat, from the area scaling of the Bartz correlation:
 * h/h_t ≈ (A_t/A)^0.9 (the boundary-layer property correction is left out). The throat value itself scales as
 * p_c^0.8 / d_t^0.2: twice the pressure gives 1.74 times the throat heat transfer.
 */
export const heatRatio = (areaRatioHere: number) => areaRatioHere ** -0.9;
export const throatHeatScaling = (pc: number, dt: number, pcRef: number, dtRef: number) => (pc / pcRef) ** 0.8 * (dt / dtRef) ** -0.2;
