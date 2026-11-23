// Thermal cycles and cumulative damage in a case-bonded grain. The air temperature reaches the grain through the case
// and the insulation: a daily cycle reaches only the outer part of a large grain, a seasonal cycle all of it. The bore
// strain follows the area-weighted mean temperature of the propellant and the temperature of the case, so the periodic
// steady state of conduction gives the strain cycles at the bore. Miner's rule then adds the damage of those cycles with
// the strain-life of the propellant from cyclic tests, and the strength left for the ignition follows from the damage.
// Units: m, s, K, W unless stated; strains as fractions. Shown and derived on /verify/thermal-cycles/.

type C = [number, number]; // a complex number: real, imaginary
const add = (a: C, b: C): C => [a[0] + b[0], a[1] + b[1]];
const sub = (a: C, b: C): C => [a[0] - b[0], a[1] - b[1]];
const mul = (a: C, b: C): C => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
const div = (a: C, b: C): C => { const d = b[0] * b[0] + b[1] * b[1]; return [(a[0] * b[0] + a[1] * b[1]) / d, (a[1] * b[0] - a[0] * b[1]) / d]; };
const scale = (a: C, s: number): C => [a[0] * s, a[1] * s];
export const cabs = (a: C) => Math.hypot(a[0], a[1]);
export const carg = (a: C) => Math.atan2(a[1], a[0]);

export const DAY = 86400, YEAR = 365.25 * DAY;
export const omegaOf = (period: number) => (2 * Math.PI) / period;

/** Penetration depth of a periodic surface temperature into a thick solid: δ = √(2α/ω). The amplitude falls as e^(−x/δ). */
export const penetration = (alpha: number, omega: number) => Math.sqrt((2 * alpha) / omega);

export interface Section {
  a: number; b: number; // bore radius and outer radius of the propellant, m
  kP: number; alphaP: number; // conductivity (W/m·K) and diffusivity (m²/s) of the propellant
  tI: number; kI: number; alphaI: number; // insulation between the propellant and the case
}

/**
 * The periodic steady state of conduction in the grain: finite volumes in r, from the bore (no heat flow: the port is
 * closed in storage) through the propellant and the insulation to the case, which follows the air with unit amplitude.
 * Returns the complex amplitude Θ at the cell centres and its area-weighted mean over the propellant.
 */
export function periodicConduction(s: Section, omega: number, nP = 160, nI = 12) {
  const cells: { r0: number; r1: number; k: number; rc: number }[] = [];
  for (let j = 0; j < nP; j++) { const r0 = s.a + ((s.b - s.a) * j) / nP, r1 = s.a + ((s.b - s.a) * (j + 1)) / nP; cells.push({ r0, r1, k: s.kP, rc: s.alphaP }); }
  const ni = s.tI > 0 ? nI : 0;
  for (let j = 0; j < ni; j++) { const r0 = s.b + (s.tI * j) / ni, r1 = s.b + (s.tI * (j + 1)) / ni; cells.push({ r0, r1, k: s.kI, rc: s.alphaI }); }
  const N = cells.length;
  const cap = cells.map((c) => (c.k / c.rc) * Math.PI * (c.r1 * c.r1 - c.r0 * c.r0)); // ρc·area per unit length
  const half = (c: (typeof cells)[number]) => (c.r1 - c.r0) / 2 / c.k;
  const G = cells.map((c, j) => (j < N - 1 ? (2 * Math.PI * c.r1) / (half(c) + half(cells[j + 1])) : (2 * Math.PI * c.r1) / half(c)));
  // tridiagonal: lo·Θ[j−1] + di·Θ[j] + up·Θ[j+1] = rhs
  const lo: C[] = [], di: C[] = [], up: C[] = [], rhs: C[] = [];
  for (let j = 0; j < N; j++) {
    const gl = j > 0 ? G[j - 1] : 0, gr = G[j];
    lo.push([-gl, 0]); up.push([j < N - 1 ? -gr : 0, 0]);
    di.push([gl + gr, omega * cap[j]]);
    rhs.push([j === N - 1 ? gr : 0, 0]); // the case at unit amplitude beyond the last face
  }
  for (let j = 1; j < N; j++) { const w = div(lo[j], di[j - 1]); di[j] = sub(di[j], mul(w, up[j - 1])); rhs[j] = sub(rhs[j], mul(w, rhs[j - 1])); }
  const th: C[] = new Array(N);
  th[N - 1] = div(rhs[N - 1], di[N - 1]);
  for (let j = N - 2; j >= 0; j--) th[j] = div(sub(rhs[j], mul(up[j], th[j + 1])), di[j]);
  let sum: C = [0, 0], area = 0;
  for (let j = 0; j < nP; j++) { const A = Math.PI * (cells[j].r1 ** 2 - cells[j].r0 ** 2); sum = add(sum, scale(th[j], A)); area += A; }
  return { r: cells.map((c) => (c.r0 + c.r1) / 2), theta: th, mean: scale(sum, 1 / area), bore: th[0] };
}

/**
 * The bore hoop strain from temperature changes: ε = −P·ΔT_p + Cc·ΔT_c, with ΔT_p the area-weighted mean change of the
 * propellant and ΔT_c that of the case. P = (3α_p/2)(m² − 1), Cc = α_c(3m² − 1)/2. With one ΔT for both it is the
 * cool-down strain of the Propellant grain page.
 */
export const boreStrainCoefficients = (m: number, alphaP: number, alphaC: number) => ({ P: ((3 * alphaP) / 2) * (m * m - 1), Cc: (alphaC * (3 * m * m - 1)) / 2 });

export interface Climate { Tmean: number; As: number; Ad: number } // °C; seasonal and daily amplitudes of the air, K

/** The strain cycles at the bore in a climate: the mean, and the complex amplitudes of the seasonal and daily cycles. */
export function boreCycles(s: Section, alphaP: number, alphaC: number, Tsf: number, cl: Climate) {
  const { P, Cc } = boreStrainCoefficients(s.b / s.a, alphaP, alphaC);
  const per = (omega: number) => {
    const pc = periodicConduction(s, omega);
    const amp = sub(scale(pc.mean, -P), [-Cc, 0]); // strain per kelvin of air amplitude (complex): −P·⟨Θ⟩ + Cc
    return { pc, amp };
  };
  const seas = per(omegaOf(YEAR)), day = per(omegaOf(DAY));
  const mean = (P - Cc) * (Tsf - cl.Tmean); // cooling from the stress-free temperature gives tension
  const epsS = cabs(seas.amp) * cl.As, epsD = cabs(day.amp) * cl.Ad;
  return {
    mean, epsS, epsD, peak: mean + epsS + epsD, perK: P - Cc,
    season: { ...seas, gain: cabs(seas.amp) / (P - Cc), lag: -carg(scale(seas.amp, -1)) },
    day: { ...day, gain: cabs(day.amp) / (P - Cc), lag: -carg(scale(day.amp, -1)) },
  };
}

/**
 * Miner's rule over one year of daily cycles: the peak strain of each day is the mean, plus the seasonal strain of that
 * day, plus the daily amplitude; the cycles to failure at a peak ε are N_f = (ε_cap/ε)^k, the power law of cyclic
 * tests, so each day adds (ε/ε_cap)^k. The seasonal cycle is in the modulation of the daily peaks.
 */
export function yearDamage(mean: number, epsS: number, epsD: number, cap: number, k: number, days = 365) {
  let D = 0, worst = 0;
  for (let d = 0; d < days; d++) {
    const e = mean + epsS * Math.cos((2 * Math.PI * (d + 0.5)) / days) + epsD;
    if (e > 0) { const q = Math.pow(e / cap, k); D += q; if (q > worst) worst = q; }
  }
  return { D, worstDay: worst };
}

/** The damage of n events at a peak strain ε: n·(ε/ε_cap)^k. */
export const eventDamage = (n: number, eps: number, cap: number, k: number) => (eps > 0 ? n * Math.pow(eps / cap, k) : 0);

/** The strength left after a damage D for a power law of exponent k: (1 − D)^(1/k). */
export const residualStrength = (D: number, k: number) => (D >= 1 ? 0 : Math.pow(1 - D, 1 / k));
