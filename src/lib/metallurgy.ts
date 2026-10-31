// Metallurgy: the steel corner of the iron–carbon diagram (lever rule), transformation temperatures from composition
// (Andrews), the hardness of martensite from carbon, tempering by the Hollomon–Jaffe parameter, and diffusion depth
// (carburising, decarburisation, hydrogen). Units: mass %, °C, hours (tempering), seconds and metres (diffusion).

export type Steel = { C: number; Mn?: number; Si?: number; Ni?: number; Cr?: number; Mo?: number; V?: number };

/** Iron–carbon reference points (mass % C, °C). */
export const FE_C = { alphaMax: 0.022, eutectoid: 0.77, cementite: 6.67, A1: 727, A3pure: 912, acmAt211: 1148, gammaMax: 2.11 } as const;

/** Binary Fe–C A3 line, a quadratic through 912 °C at 0%, 800 °C at 0.4% and 727 °C at 0.77% C. */
export const a3Binary = (c: number) => 912 - 323 * c + 107.4 * c * c;
/** Binary Acm line, straight from the eutectoid to 1148 °C at 2.11% C. */
export const acmBinary = (c: number) => FE_C.A1 + ((c - FE_C.eutectoid) * (FE_C.acmAt211 - FE_C.A1)) / (FE_C.gammaMax - FE_C.eutectoid);

/** Phases of a slowly cooled plain carbon steel, by the lever rule just below A1 (mass fractions). */
export function slowCooled(c: number) {
  const { alphaMax: a, eutectoid: e, cementite: k } = FE_C;
  if (c <= a) return { kind: 'ferrite' as const, ferrite: 1, pearlite: 0, cementite: 0 };
  if (c <= e) { const p = (c - a) / (e - a); return { kind: 'hypoeutectoid' as const, ferrite: 1 - p, pearlite: p, cementite: 0 }; }
  const cm = (c - e) / (k - e);
  return { kind: 'hypereutectoid' as const, ferrite: 0, pearlite: 1 - cm, cementite: cm };
}

/** Andrews (1965) linear formulas for low-alloy steels, °C. */
export const ac1 = (s: Steel) => 723 - 10.7 * (s.Mn ?? 0) - 16.9 * (s.Ni ?? 0) + 29.1 * (s.Si ?? 0) + 16.9 * (s.Cr ?? 0);
export const ac3 = (s: Steel) => 910 - 203 * Math.sqrt(s.C) - 15.2 * (s.Ni ?? 0) + 44.7 * (s.Si ?? 0) + 104 * (s.V ?? 0) + 31.5 * (s.Mo ?? 0);
export const ms = (s: Steel) => 539 - 423 * s.C - 30.4 * (s.Mn ?? 0) - 17.7 * (s.Ni ?? 0) - 12.1 * (s.Cr ?? 0) - 7.5 * (s.Mo ?? 0);
/** Approximate hardness of fully martensitic steel, HRC = 35 + 50·C, for 0.1 to 0.6% C. Alloying does not change it. */
export const martensiteHrc = (c: number) => 35 + 50 * c;

/** Transformation summary for a steel: phases, critical temperatures and the as-quenched hardness. */
export function steelSummary(s: Steel) {
  const A1 = ac1(s), A3 = ac3(s), M = ms(s);
  return {
    phases: slowCooled(s.C), ac1: A1, ac3: A3, ms: M, hrc: martensiteHrc(Math.min(s.C, 0.6)),
    austenitise: [A3 + 30, A3 + 60] as [number, number], valid: s.C >= 0.1 && s.C <= 0.6,
  };
}

/** Hollomon–Jaffe tempering parameter P = T(K)·(C + log10 t), with t in hours. */
export const hjP = (tC: number, hours: number, C = 20) => (tC + 273.15) * (C + Math.log10(hours));
/** Time (h) at temperature tC that gives the parameter P. */
export const hjTime = (P: number, tC: number, C = 20) => 10 ** (P / (tC + 273.15) - C);
/** Temperature (°C) that gives the parameter P in the time `hours`. */
export const hjTemp = (P: number, hours: number, C = 20) => P / (C + Math.log10(hours)) - 273.15;

/**
 * A temper followed by later exposures (stress relief, coating cure, bake). Each exposure converts to an equivalent
 * time at the temper temperature; the times add. `margin` (°C) sets the limit: the parameter of the temper made
 * `margin` degrees colder.
 */
export function tempering(i: { T: number; t: number; C?: number; exposures: { T: number; t: number }[]; margin?: number }) {
  const C = i.C ?? 20;
  const P0 = hjP(i.T, i.t, C);
  const ex = i.exposures.map((e) => { const P = hjP(e.T, e.t, C); return { ...e, P, tEq: hjTime(P, i.T, C) }; });
  const tTotal = i.t + ex.reduce((a, e) => a + e.tEq, 0);
  const P = hjP(i.T, tTotal, C);
  const limit = i.margin === undefined ? NaN : hjP(i.T - i.margin, i.t, C);
  return { P0, ex, tTotal, P, dP: P - P0, limit, worst: Math.max(...ex.map((e) => e.P), -Infinity) };
}

const R = 8.314;
/** Diffusion data (D0 m²/s, Q J/mol). Carbon from Callister; hydrogen in iron is the lattice value (Kiuchi and McLellan). */
export const DIFFUSANTS = [
  { key: 'cg', name: 'Carbon in austenite', D0: 2.3e-5, Q: 148e3 },
  { key: 'ca', name: 'Carbon in ferrite', D0: 1.1e-6, Q: 87.4e3 },
  { key: 'h', name: 'Hydrogen in ferrite, lattice', D0: 7.23e-8, Q: 5.69e3 },
] as const;
export const diffusant = (k: string) => DIFFUSANTS.find((d) => d.key === k);
/** D = D0·exp(−Q/RT), T in °C. */
export const diffusivity = (D0: number, Q: number, tC: number) => D0 * Math.exp(-Q / (R * (tC + 273.15)));

/** Error function (Abramowitz and Stegun 7.1.26 refined by series for small x; |error| < 1e-9). */
export function erf(x: number): number {
  const s = Math.sign(x), a = Math.abs(x);
  if (a < 2.5) {
    // Taylor series converges well here
    let sum = a, term = a;
    for (let n = 1; n < 80; n++) { term *= (-a * a) / n; const add = term / (2 * n + 1); sum += add; if (Math.abs(add) < 1e-16) break; }
    return (s * 2 * sum) / Math.sqrt(Math.PI);
  }
  // continued fraction for erfc at large x
  let f = 0;
  for (let n = 60; n >= 1; n--) f = n / 2 / (a + f);
  return s * (1 - Math.exp(-a * a) / Math.sqrt(Math.PI) / (a + f));
}
export const erfc = (x: number) => 1 - erf(x);
/** z with erfc(z) = y, for 0 < y < 1 (bisection). */
export function erfcInv(y: number) {
  let lo = 0, hi = 6;
  for (let k = 0; k < 100; k++) { const mid = (lo + hi) / 2; if (erfc(mid) > y) lo = mid; else hi = mid; }
  return (lo + hi) / 2;
}

/**
 * Semi-infinite diffusion with a constant surface concentration: the fraction of the surface change left at depth x
 * is erfc(x / 2√(Dt)). `remain` is the criterion (for example 0.1: the depth where only 10% of the change remains).
 */
export function diffusionDepth(i: { D: number; t: number; remain: number }) {
  const L = Math.sqrt(i.D * i.t), z = erfcInv(i.remain);
  return { L, z, depth: 2 * z * L };
}
/** Time (s) for the criterion to reach depth x. */
export const diffusionTime = (x: number, D: number, remain: number) => (x / (2 * erfcInv(remain))) ** 2 / D;
/** Harris's shop rule for carburising: total case depth (mm) = 31.6·√t / 10^(6700/T°R)·25.4, t in hours. */
export const harrisCase = (tC: number, hours: number) => ((31.6 * Math.sqrt(hours)) / 10 ** (6700 / ((tC + 273.15) * 1.8))) * 25.4;
