// The bonds of a case-bonded grain: the long cylinder, the grain end where the bond stops, and the loads from
// acceleration and slump. Units: mm, MPa, K, kg/m³ and g. Shown and derived on /motor/bondlines/. Screening only: the
// stress at the edge of a bond termination needs FEA of the grain end.
import { thermalBondStress, type GrainStructInputs } from './grain.ts';

const G0 = 9.80665;

/**
 * Shear compliance of the web (mm of axial displacement per MPa of shear on the bond). The web hands an axial load to the
 * bond: with the gradient of the axial stress uniform over the section, the shear at radius r is q(r² − a²)/(2r), zero
 * at the free bore. The displacement of the section, averaged over its area and taken relative to the bond, per unit
 * shear on the bond, is the compliance.
 */
export function webCompliance(a: number, b: number, G: number) {
  const A = b * b - a * a;
  const avg = A / 4 - (a * a) / 2 + (a ** 4 * Math.log(b / a)) / A; // area average of (b² − r²)/2 − a²·ln(b/r)
  return (avg / (2 * G)) * ((2 * b) / A);
}

/**
 * The axial strain that a case-bonded web with a free bore takes, relative to the case, when it is free to slide along
 * the case but held at its outer surface (dT negative when cold). It cannot shrink at its outer surface, so the volume
 * that it loses goes into the bore and along the axis: 3Δα·ΔT·(1 + m²)/(3 + m²). A thin layer (m → 1) gives 1.5Δα·ΔT.
 */
export const freeAxialStrain = (m: number, dAlpha: number, dT: number) => (3 * dAlpha * dT * (1 + m * m)) / (3 + m * m);

/** Axial modulus of the same web (incompressible, held at its outer surface, free bore): G(3 + m²) = E(1 + m²/3). */
export const axialModulus = (E: number, m: number) => E * (1 + (m * m) / 3);

export interface GrainEnd {
  a: number; // bore radius (mm)
  b: number; // outer radius, at the bond (mm)
  L: number; // bonded length of the grain (mm)
  E: number; // relaxed modulus of the propellant (MPa)
  alphaP: number; // propellant expansion coefficient (1/K)
  alphaC: number; // case expansion coefficient (1/K)
  dT: number; // service temperature less the stress-free temperature (K), negative when cold
  h: number; // thickness of the bond layer: liner and insulation (mm)
  Gb: number; // shear modulus of the bond layer (MPa)
}

/**
 * The grain end in cool-down, by shear lag. The grain wants to slide along the case by its free axial strain; the bond
 * and the web hold it back, and the force builds up over a length 1/λ from each end. λ² = 2πb/(E_eff·A·c), with c the
 * compliance of the bond layer and of the web in series. The end moves by |ε|·tanh(λL/2)/λ relative to the case, and the
 * shear on the bond at the end of the grain is that movement over c.
 */
export function grainEnd(g: GrainEnd) {
  const m = g.b / g.a, A = Math.PI * (g.b ** 2 - g.a ** 2);
  const eps = freeAxialStrain(m, g.alphaP - g.alphaC, g.dT);
  const Eeff = axialModulus(g.E, m);
  const cWeb = webCompliance(g.a, g.b, g.E / 3), cBond = g.h / g.Gb, c = cWeb + cBond;
  const lambda = Math.sqrt((2 * Math.PI * g.b) / (Eeff * A * c));
  const uEnd = (Math.abs(eps) * Math.tanh((lambda * g.L) / 2)) / lambda;
  const tauEnd = uEnd / c;
  /** Shear on the bond and movement of the grain, at a distance s from the end of the bond. */
  const at = (s: number) => {
    const k = Math.sinh(lambda * (g.L / 2 - s)) / Math.sinh((lambda * g.L) / 2);
    return { tau: tauEnd * k, u: uEnd * k };
  };
  const sigmaR = thermalBondStress({ boreD: 2 * g.a, od: 2 * g.b, alphaP: g.alphaP, alphaC: g.alphaC, dT: g.dT, eRelaxed: g.E } as GrainStructInputs);
  return { m, A, eps, Eeff, cWeb, cBond, c, lambda, len: 1 / lambda, uEnd, tauEnd, sigmaR, at, webShare: cWeb / c };
}

/**
 * An axial acceleration of n g on a case-bonded tubular grain of density rho (kg/m³): the shear on the bond from
 * equilibrium, ρ·n·g·(b² − a²)/(2b), and the axial displacement of the web relative to the case with the shear modulus G.
 * In long storage the displacement uses the relaxed modulus: it is the slump of the grain.
 */
export function axialLoad(a: number, b: number, rho: number, n: number, G: number) {
  const q = rho * G0 * n * 1e-9; // N/mm³
  const w = (r: number) => (q / (2 * G)) * ((b * b - r * r) / 2 - a * a * Math.log(b / r));
  return { q, tau: (q * (b * b - a * a)) / (2 * b), perG: (rho * G0 * 1e-9 * (b * b - a * a)) / (2 * b), slump: w(a), w };
}

/** Margin of safety of a bond: its strength over the stress times the concentration at the termination and the factor. */
export const bondMargin = (stress: number, kt: number, strength: number, sf: number) => strength / (stress * kt * sf) - 1;
