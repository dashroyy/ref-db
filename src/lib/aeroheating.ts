// External heating of a motor case in flight: the standard atmosphere, the recovery temperature of the boundary
// layer, the convective heat transfer coefficient by Eckert's reference-temperature method on a flat plate at a
// distance x from the nose, and the temperature of the case under external insulation over a flight, with the
// insulation thickness that keeps the case below its limit. Units: SI (m, s, K, Pa, W) inside; °C, km, mm at the edges.
// Shown and derived on /motor/external-heating/. Screening only.
import { solve, type Mat } from './thermal.ts';

const R_AIR = 287.05, GAMMA = 1.4, CP_AIR = 1005, PR = 0.71, G0 = 9.80665;

/** U.S. Standard Atmosphere 1976 up to 47 km: temperature (K), pressure (Pa), density, speed of sound, viscosity. */
export function atmosphere(hKm: number) {
  const h = Math.max(0, Math.min(47, hKm));
  let T: number, p: number;
  if (h <= 11) { T = 288.15 - 6.5 * h; p = 101325 * (T / 288.15) ** (G0 / (R_AIR * 0.0065)); }
  else if (h <= 20) { T = 216.65; p = 22632.06 * Math.exp((-G0 * (h - 11) * 1000) / (R_AIR * T)); }
  else if (h <= 32) { T = 216.65 + 1.0 * (h - 20); p = 5474.889 * (T / 216.65) ** (-G0 / (R_AIR * 0.001)); }
  else { T = 228.65 + 2.8 * (h - 32); p = 868.0187 * (T / 228.65) ** (-G0 / (R_AIR * 0.0028)); }
  return { T, p, rho: p / (R_AIR * T), a: Math.sqrt(GAMMA * R_AIR * T), mu: sutherland(T) };
}

/** Viscosity of air by Sutherland's law, Pa·s. */
export const sutherland = (T: number) => (1.458e-6 * T ** 1.5) / (T + 110.4);

/** Recovery factor: √Pr for a laminar boundary layer, ∛Pr for a turbulent one. */
export const recoveryFactor = (laminar: boolean) => (laminar ? Math.sqrt(PR) : Math.cbrt(PR));

/**
 * Convective heating at a distance x (m) from the nose, at a Mach number and an altitude, for a wall at Tw (K).
 * Recovery temperature T_r = T∞(1 + r(γ−1)/2·M²). Eckert's reference temperature
 * T* = T∞ + 0.5(Tw − T∞) + 0.22(T_r − T∞) gives the properties for the flat-plate correlations: turbulent
 * St = 0.0296·Re*^(−0.2)·Pr^(−2/3), laminar St = 0.332·Re*^(−0.5)·Pr^(−2/3), and h = St·ρ*·u·c_p.
 */
export function aeroHeating(i: { mach: number; hKm: number; x: number; Tw: number; laminar?: boolean }) {
  const atm = atmosphere(i.hKm), lam = !!i.laminar;
  const u = i.mach * atm.a;
  const r = recoveryFactor(lam);
  const Tr = atm.T * (1 + r * ((GAMMA - 1) / 2) * i.mach * i.mach);
  const T0 = atm.T * (1 + ((GAMMA - 1) / 2) * i.mach * i.mach);
  const Ts = atm.T + 0.5 * (i.Tw - atm.T) + 0.22 * (Tr - atm.T);
  const rhoS = atm.p / (R_AIR * Ts), muS = sutherland(Ts);
  const Re = (rhoS * u * Math.max(i.x, 1e-6)) / muS;
  const St = (lam ? 0.332 * Re ** -0.5 : 0.0296 * Re ** -0.2) * PR ** (-2 / 3);
  const h = St * rhoS * u * CP_AIR;
  return { ...atm, u, Tr, T0, Ts, Re, St, h, q: h * (Tr - i.Tw), r };
}

export interface FlightPhase { duration: number; mach: number; hKm: number }
export interface Layer { mat: Mat; thickness: number } // thickness in m

/**
 * The case under optional external insulation, heated over the phases of a flight (one h and T_r for each phase,
 * from aeroHeating with a cold wall, which slightly overstates h). The inner face of the case is adiabatic: the
 * internal insulation and the grain take little heat in this time. Returns the temperature histories (°C) of the outer
 * surface, the case's hot face (the joint with the insulation) and its inner face, and the peak of the case.
 */
export function caseHeating(i: { phases: FlightPhase[]; x: number; laminar?: boolean; tps: Layer | null; wall: Layer; t0: number; limit?: number; steps?: number }) {
  const ph = i.phases.filter((p) => p.duration > 0).map((p) => {
    const a = aeroHeating({ mach: p.mach, hKm: p.hKm, x: i.x, Tw: i.t0 + 273.15, laminar: i.laminar });
    return { duration: p.duration, h: a.h, tEnv: a.Tr - 273.15 };
  });
  const layers = i.tps && i.tps.thickness > 0 ? [i.tps, i.wall] : [i.wall];
  const r = solve({ geometry: 'slab', layers, t0: i.t0, phases: ph, limit: i.limit, cellsPerLayer: 40, stepsPerPhase: i.steps ?? 300 });
  const caseHot = layers.length > 1 ? r.ifc : r.surface;
  let iMax = 0;
  for (let k = 1; k < caseHot.length; k++) if (caseHot[k] > caseHot[iMax]) iMax = k;
  let tCross: number | null = null;
  if (i.limit !== undefined) for (let k = 0; k < caseHot.length; k++) if (caseHot[k] >= i.limit) { tCross = r.t[k]; break; }
  return { r, phases: ph, t: r.t, surface: r.surface, caseHot, caseInner: r.back, maxCase: caseHot[iMax], tMax: r.t[iMax], tCross, maxSurface: Math.max(...r.surface) };
}

/** The external insulation thickness (m) that keeps the case at or below its limit, by bisection (null if 30 mm is not enough). */
export function tpsNeeded(i: Omit<Parameters<typeof caseHeating>[0], 'tps'> & { tpsMat: Mat; limit: number }) {
  const peak = (t: number) => caseHeating({ ...i, tps: t > 0 ? { mat: i.tpsMat, thickness: t } : null, steps: 200 }).maxCase;
  if (peak(0) <= i.limit) return 0;
  if (peak(0.03) > i.limit) return null;
  let lo = 0, hi = 0.03;
  for (let k = 0; k < 30; k++) { const m = (lo + hi) / 2; if (peak(m) > i.limit) lo = m; else hi = m; }
  return hi;
}
