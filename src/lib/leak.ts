// Leak testing: leak-rate units, pressure decay with temperature correction and measurement uncertainty, helium
// accumulation (hood) sensitivity, and the conversion of a tracer-gas rate to a service rate through a capillary leak
// path in the viscous and molecular regimes. SI inside: Pa, m³, s, K; leak rates in Pa·m³/s. Screening only.

export const R = 8.314462618;
export const P_ATM = 101325;

/** Leak-rate units, as the value of one unit in Pa·m³/s. atm·cm³/s and sccm are at 1 atm (temperature not corrected). */
export const UNITS = [
  { key: 'pam3s', name: 'Pa·m³/s', f: 1 },
  { key: 'mbarls', name: 'mbar·L/s', f: 0.1 },
  { key: 'atmccs', name: 'atm·cm³/s (std cm³/s)', f: P_ATM * 1e-6 },
  { key: 'sccm', name: 'sccm (std cm³/min)', f: (P_ATM * 1e-6) / 60 },
  { key: 'torrls', name: 'Torr·L/s', f: 133.322368 * 1e-3 },
] as const;
export type Unit = (typeof UNITS)[number]['key'];
export const toSI = (v: number, u: Unit) => v * UNITS.find((x) => x.key === u)!.f;
export const fromSI = (q: number, u: Unit) => q / UNITS.find((x) => x.key === u)!.f;
/** Time to lose 1 cm³ of gas at 1 bar (1 bar·cm³ = 1 mbar·L = 0.1 Pa·m³), s. */
export const timeToLoseCc = (q: number) => 0.1 / q;

// ---------- Pressure decay ----------

export interface DecayInputs {
  V: number; // test volume including lines and gauge, m³
  pAbs: number; // test pressure, absolute, Pa
  t: number; // hold time, s
  dp: number; // measured pressure drop (start − end), Pa
  dT: number; // measured gas temperature fall (start − end), K
  T: number; // gas temperature, K
  resP: number; resT: number; // resolution (uncertainty) of one pressure and one temperature reading, Pa and K
}

/**
 * Leak rate from a pressure-decay test, corrected for the change of gas temperature (ideal gas, constant volume):
 * Δp_leak = Δp − p·ΔT/T, Q = V·Δp_leak/t. The uncertainty combines two readings of each instrument.
 */
export function decay(i: DecayInputs) {
  const thermal = (i.pAbs * i.dT) / i.T;
  const dpLeak = i.dp - thermal;
  const dpUnc = Math.SQRT2 * Math.hypot(i.resP, (i.pAbs * i.resT) / i.T);
  const k = i.V / i.t;
  return { thermal, dpLeak, dpUnc, Q: k * dpLeak, Qraw: k * i.dp, dQ: k * dpUnc };
}
/** Hold time at which the uncertainty of the decay test equals the leak rate q. */
export const holdFor = (q: number, V: number, dpUnc: number) => (V * dpUnc) / q;

// ---------- Helium accumulation ----------

/**
 * Helium accumulation in a hood of free volume V (m³) over time t (s): Q_He = ΔC·V·p/t, with ΔC the rise in helium
 * concentration (volume fraction). The total leak is Q_He divided by the helium fraction in the part.
 */
export function accumulation(o: { V: number; t: number; dC: number; resC: number; frac: number; p?: number }) {
  const p = o.p ?? P_ATM;
  const qHe = (o.dC * o.V * p) / o.t, min = (o.resC * o.V * p) / o.t;
  return { qHe, total: qHe / o.frac, minTotal: min / o.frac };
}
/** Accumulation time for a total leak q to raise the hood concentration by the detector resolution. */
export const accumulateFor = (q: number, o: { V: number; resC: number; frac: number; p?: number }) => (o.resC * o.V * (o.p ?? P_ATM)) / (q * o.frac);

// ---------- Tracer gas to service gas ----------

/** Molar mass (kg/mol) and viscosity at 20 °C (Pa·s). */
export const GASES = [
  { key: 'he', name: 'Helium', M: 4.0026e-3, mu: 19.6e-6 },
  { key: 'h2', name: 'Hydrogen', M: 2.016e-3, mu: 8.8e-6 },
  { key: 'n2', name: 'Nitrogen', M: 28.013e-3, mu: 17.6e-6 },
  { key: 'air', name: 'Air', M: 28.96e-3, mu: 18.1e-6 },
  { key: 'ar', name: 'Argon', M: 39.948e-3, mu: 22.3e-6 },
  { key: 'co2', name: 'Carbon dioxide', M: 44.01e-3, mu: 14.7e-6 },
] as const;
export type Gas = (typeof GASES)[number];
export const gas = (k: string) => GASES.find((g) => g.key === k)!;

/** Mean free path (m) from the viscosity: λ = (μ/p)·√(πRT/2M). */
export const meanFreePath = (g: Gas, p: number, T = 293.15) => (g.mu / p) * Math.sqrt((Math.PI * R * T) / (2 * g.M));

/** Viscous (laminar, compressible) flow through a capillary of diameter d and length L: Q = πd⁴(p₁² − p₂²)/(256μL). */
export const viscousQ = (d: number, L: number, p1: number, p2: number, g: Gas) => (Math.PI * d ** 4 * (p1 * p1 - p2 * p2)) / (256 * g.mu * L);
/** Molecular (Knudsen) flow through a long capillary: Q = (π/12)·v̄·(d³/L)·(p₁ − p₂), v̄ = √(8RT/πM). */
export const molecularQ = (d: number, L: number, p1: number, p2: number, g: Gas, T = 293.15) =>
  (Math.PI / 12) * Math.sqrt((8 * R * T) / (Math.PI * g.M)) * (d ** 3 / L) * (p1 - p2);

/** Diameter of a capillary of length L that passes q in viscous flow. */
export const viscousDiameter = (q: number, L: number, p1: number, p2: number, g: Gas) => Math.pow((256 * g.mu * L * q) / (Math.PI * (p1 * p1 - p2 * p2)), 0.25);

export interface ConvertInputs { q: number; test: Gas; p1t: number; p2t: number; service: Gas; p1s: number; p2s: number; L: number; T?: number }

/**
 * Service leak rate from a test leak rate through the same leak path. The two limits: viscous (ratio of μ and of
 * p₁² − p₂²) and molecular (ratio of √M and of p₁ − p₂). The Knudsen number of the equivalent capillary says which.
 */
export function convert(i: ConvertInputs) {
  const viscous = i.q * (i.test.mu / i.service.mu) * ((i.p1s ** 2 - i.p2s ** 2) / (i.p1t ** 2 - i.p2t ** 2));
  const molecular = i.q * Math.sqrt(i.test.M / i.service.M) * ((i.p1s - i.p2s) / (i.p1t - i.p2t));
  const d = viscousDiameter(i.q, i.L, i.p1t, i.p2t, i.test);
  const knTest = meanFreePath(i.test, (i.p1t + i.p2t) / 2, i.T) / d;
  const knService = meanFreePath(i.service, (i.p1s + i.p2s) / 2, i.T) / d;
  const regime = (kn: number) => (kn < 0.01 ? 'viscous' : kn > 1 ? 'molecular' : 'transitional');
  return { viscous, molecular, d, knTest, knService, regimeTest: regime(knTest), regimeService: regime(knService) };
}
