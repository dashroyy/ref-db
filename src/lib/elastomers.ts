// Silicone and polyurethane: typical properties of the common classes (with epoxy for comparison), a molar model of
// platinum-cure poisoning, and the stress that a potting compound puts on the parts it holds when it cools. Typical
// values: grades differ widely, so use the datasheet of the actual product. Units: MPa, °C, 1/K, ppm by mass.
import { thinLayerStress } from './expansion.ts';

export interface Elastomer {
  key: string; name: string; family: 'si' | 'pu' | 'ep';
  cure: string; tmin: number; tmax: number;
  shore: string; tensile: [number, number]; elong: [number, number]; tear: [number, number]; // MPa, %, kN/m
  E: number; K: number; nu: number; cte: number; // typical modulus and bulk modulus (MPa), Poisson's ratio, expansion (1/K)
  tg: number; // glass transition, °C
  surface: number; // surface energy, mN/m
  permeability: string; hydrolysis: string; fuels: string; weather: string;
  use: string; watch: string;
}

export const ELASTOMERS: Elastomer[] = [
  { key: 'si-add', name: 'Silicone, addition cure (platinum)', family: 'si', cure: 'Two-part, platinum catalyst; no by-product, no shrinkage', tmin: -55, tmax: 200, shore: '10–70 A', tensile: [3, 10], elong: [100, 600], tear: [5, 30], E: 2, K: 1000, nu: 0.49, cte: 280e-6, tg: -120, surface: 21, permeability: 'Very high', hydrolysis: 'Excellent', fuels: 'Poor: swells', weather: 'Excellent: ozone, UV', use: 'Potting and encapsulation, moulded seals and boots, thermal insulation, low-outgassing space grades', watch: 'Its platinum is poisoned by amines, tin, sulphur: the cure fails at the interface. Low tear strength.' },
  { key: 'si-rtv', name: 'Silicone RTV, condensation cure (one-part)', family: 'si', cure: 'Moisture from the air with a tin catalyst; releases acetic acid, oxime or alcohol', tmin: -55, tmax: 200, shore: '20–40 A', tensile: [1.5, 3], elong: [200, 500], tear: [3, 8], E: 1.2, K: 1000, nu: 0.49, cte: 300e-6, tg: -120, surface: 21, permeability: 'Very high', hydrolysis: 'Excellent', fuels: 'Poor: swells', weather: 'Excellent: ozone, UV', use: 'Sealants, form-in-place gaskets, wire tacking', watch: 'Cures from the surface inwards, a few millimetres a day: not for deep sections. Acetoxy grades corrode copper and attack urethane: use neutral (alkoxy, oxime) cure. Its tin poisons platinum silicones.' },
  { key: 'fvmq', name: 'Fluorosilicone (FVMQ)', family: 'si', cure: 'Heat cure (peroxide) or platinum', tmin: -55, tmax: 175, shore: '40–80 A', tensile: [5, 10], elong: [150, 400], tear: [10, 25], E: 4, K: 1000, nu: 0.49, cte: 250e-6, tg: -65, surface: 22, permeability: 'High', hydrolysis: 'Excellent', fuels: 'Good: fuels and many oils', weather: 'Excellent', use: 'Fuel-system seals that must stay soft when cold', watch: 'Low tear and abrasion resistance: static duty. Expensive.' },
  { key: 'pu-ether', name: 'Polyurethane, polyether (cast)', family: 'pu', cure: 'Isocyanate with a polyether polyol, amine or tin catalyst', tmin: -40, tmax: 80, shore: '60 A – 70 D', tensile: [20, 45], elong: [300, 600], tear: [40, 120], E: 20, K: 2500, nu: 0.49, cte: 180e-6, tg: -60, surface: 37, permeability: 'Low', hydrolysis: 'Good', fuels: 'Good: oils, fuels, greases', weather: 'Good (aromatic grades yellow in UV)', use: 'Wear pads, bump stops, rollers, cable jackets, damp environments', watch: 'Heat: soft above about 80 °C. Water during the cure makes CO₂ bubbles.' },
  { key: 'pu-ester', name: 'Polyurethane, polyester (cast)', family: 'pu', cure: 'Isocyanate with a polyester polyol', tmin: -30, tmax: 90, shore: '60 A – 75 D', tensile: [30, 55], elong: [300, 600], tear: [60, 150], E: 25, K: 2500, nu: 0.49, cte: 170e-6, tg: -40, surface: 38, permeability: 'Low', hydrolysis: 'Poor: hot water reverts it', weather: 'Good', fuels: 'Excellent: oils and fuels', use: 'Highest abrasion and cut resistance, oil-wetted parts', watch: 'Hydrolysis: avoid hot, wet service. Stiffer when cold than polyether.' },
  { key: 'pu-pot', name: 'Polyurethane potting (flexible)', family: 'pu', cure: 'Two-part, room or low-temperature cure', tmin: -55, tmax: 120, shore: '40–90 A', tensile: [5, 20], elong: [100, 400], tear: [15, 50], E: 10, K: 2500, nu: 0.49, cte: 200e-6, tg: -55, surface: 36, permeability: 'Low', hydrolysis: 'Fair to good', fuels: 'Good', weather: 'Good', use: 'Potting of electronics where moisture resistance and toughness matter', watch: 'Tg near the cold limit of many grades: it becomes rigid when cold, and the stress on the parts rises sharply.' },
  { key: 'epoxy', name: 'Epoxy potting (rigid, for comparison)', family: 'ep', cure: 'Two-part, amine or anhydride hardener', tmin: -55, tmax: 150, shore: '80–90 D', tensile: [40, 80], elong: [2, 6], tear: [0, 0], E: 3000, K: 3300, nu: 0.35, cte: 60e-6, tg: 100, surface: 45, permeability: 'Very low', hydrolysis: 'Good', fuels: 'Excellent', weather: 'Fair (chalks in UV)', use: 'Rigid encapsulation, high voltage, structural potting', watch: 'Stiff and brittle: large stress on components when cold, cracks around sharp inserts.' },
];
export const elastomer = (k: string) => ELASTOMERS.find((e) => e.key === k)!;

/** Catalyst poisons with their molar mass (g/mol) and where they come from. */
export const POISONS = [
  { key: 'amine', name: 'Tertiary amine catalyst (DABCO type)', mw: 112.2, source: 'Polyurethane cure catalysts, amine-cured epoxies' },
  { key: 'tin', name: 'Organotin (dibutyltin dilaurate)', mw: 631.6, source: 'Polyurethane and condensation-cure silicone catalysts' },
  { key: 'sulphur', name: 'Sulphur compounds (per S atom)', mw: 32.1, source: 'Sulphur-cured rubber, latex gloves, some modelling clays' },
];
const PT = 195.08;

/**
 * Teaching model of platinum poisoning: each poison molecule deactivates one platinum site. Returns the fraction of the
 * catalyst still active, and a verdict. Real inhibition depends on the species and the formulation: test the actual
 * combination.
 */
export function poisoning(ptPpm: number, poisonPpm: number, mw: number) {
  const pt = ptPpm / PT, poison = poisonPpm / mw; // µmol per gram
  const active = pt > 0 ? Math.max(0, 1 - poison / pt) : 0;
  const verdict = active >= 0.6 ? 'cures, more slowly' : active >= 0.2 ? 'tacky: a partial cure at the interface' : 'does not cure';
  return { pt, poison, ratio: pt > 0 ? poison / pt : Infinity, active, verdict, matchPpm: pt * mw };
}

/**
 * Stress in a potting compound that cools from its cure temperature, against the part or housing that holds it.
 *  - Free surface (thin layer bonded to a rigid part): biaxial E/(1 − ν)·Δα·ΔT.
 *  - Fully confined (filled box, no free surface): hydrostatic 3K·Δα·ΔT, set by the bulk modulus, not by E.
 * Positive is tension in the potting (it shrinks more than the part).
 */
export function pottingStress(p: Elastomer, alphaPart: number, tCure: number, t: number) {
  const dT = t - tCure, dAlpha = p.cte - alphaPart;
  const free = thinLayerStress(p.E, p.nu, alphaPart, p.cte, dT); // MPa
  const confined = -3 * p.K * dAlpha * dT; // hydrostatic, tension positive when cooling
  // A rigid potting (epoxy) always works below its Tg: the warning is for the rubbers, which stiffen there.
  return { dT, dAlpha, free, confined, belowTg: p.family !== 'ep' && t < p.tg };
}
