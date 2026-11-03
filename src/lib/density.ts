// Density: the v1 register (src/data/density.json) with the metals, polymers and composites of the material library,
// density in the units of each finite-element unit system, the density of a filled polymer (rule of mixtures on
// specific volume), and the mass of simple shapes. Densities are in g/cm³ unless a name says otherwise.
import data from '../data/density.json' with { type: 'json' };
import { MATERIALS } from './materials.ts';

export const CATS: { key: string; name: string }[] = [
  { key: 'al', name: 'Aluminium' }, { key: 'mg', name: 'Magnesium' }, { key: 'ti', name: 'Titanium' }, { key: 'steel', name: 'Steel' },
  { key: 'ss', name: 'Stainless' }, { key: 'ni', name: 'Superalloy' }, { key: 'cu', name: 'Copper' }, { key: 'refract', name: 'Refractory' },
  { key: 'other', name: 'Other metal' }, { key: 'plastic', name: 'Plastic' }, { key: 'elast', name: 'Elastomer and resin' },
  { key: 'glass', name: 'Glass and ceramic' }, { key: 'comp', name: 'Composite' }, { key: 'core', name: 'Core and foam' },
  { key: 'wood', name: 'Wood' }, { key: 'tool', name: 'Tooling and other' },
];

export interface Row { name: string; cat: string; rho: number; use: string; src: 'register' | 'library'; key?: string }

// Library families onto register categories (the propellant is left out).
const FAM: Record<string, string> = { al: 'al', mg: 'mg', ti: 'ti', steel: 'steel', ss: 'ss', ni: 'ni', cu: 'cu', refract: 'refract', comp: 'comp', cc: 'glass', poly: 'plastic', elast: 'elast' };
export const REGISTER: Row[] = data.rows.map((r) => ({ ...r, src: 'register' as const }));
export const LIBRARY: Row[] = MATERIALS.filter((m) => m.rho && FAM[m.family]).map((m) => ({ name: m.name, cat: FAM[m.family], rho: m.rho! / 1000, use: m.summary, src: 'library' as const, key: m.key }));
export const ROWS: Row[] = [...REGISTER, ...LIBRARY];
export const FILLERS = data.fillers;

/** Density in the units of a consistent finite-element unit system. f converts from g/cm³. */
export const UNITS: { key: string; name: string; unit: string; f: number; mass: string }[] = [
  { key: 'si', name: 'm, kg, s, N, Pa (SI)', unit: 'kg/m³', f: 1000, mass: 'kg' },
  { key: 'mmt', name: 'mm, tonne, s, N, MPa (most mm models)', unit: 't/mm³', f: 1e-9, mass: 't' },
  { key: 'mmkg', name: 'mm, kg, ms, kN, GPa (LS-DYNA)', unit: 'kg/mm³', f: 1e-6, mass: 'kg' },
  { key: 'cgs', name: 'cm, g, s', unit: 'g/cm³', f: 1, mass: 'g' },
  { key: 'ips', name: 'in, lbf, s, psi (US)', unit: 'lbf·s²/in⁴', f: 0.0361272920 / 386.08858, mass: 'lbf·s²/in' },
];
export const toUnit = (rho: number, key: string) => rho * UNITS.find((u) => u.key === key)!.f;
/** Weight density in lb/in³: for hand calculations, never for the mass of a finite-element model. */
export const lbPerIn3 = (rho: number) => rho * 0.036127292;

/**
 * The mass error when a density meant for one unit system is typed into another: the model's mass is multiplied by
 * this factor, and its natural frequencies by 1/√factor.
 */
export function unitMistake(rho: number, typedIn: string, modelIn: string) {
  const typed = toUnit(rho, typedIn), correct = toUnit(rho, modelIn);
  const factor = typed / correct;
  return { typed, correct, factor, freq: 1 / Math.sqrt(factor) };
}

/** Filled polymer, rule of mixtures on specific volume: 1/ρ = w/ρf + (1 − w)/ρm; the filler's volume fraction too. */
export function filled(rhoMatrix: number, rhoFiller: number, w: number) {
  const rho = 1 / (w / rhoFiller + (1 - w) / rhoMatrix);
  return { rho, vf: w > 0 ? (w * rho) / rhoFiller : 0, linear: w * rhoFiller + (1 - w) * rhoMatrix };
}

export type Shape = 'tube' | 'rod' | 'plate' | 'disc' | 'shell' | 'volume';
/** Volume (mm³) of a simple shape. a, b, c are the shape's dimensions in mm (see SHAPES). */
export function volume(shape: Shape, a: number, b: number, c: number) {
  switch (shape) {
    case 'tube': return (Math.PI / 4) * (a * a - b * b) * c; // OD, ID, length
    case 'rod': return (Math.PI / 4) * a * a * c; // diameter, -, length
    case 'plate': return a * b * c; // length, width, thickness
    case 'disc': return (Math.PI / 4) * a * a * c; // diameter, -, thickness
    case 'shell': return (Math.PI / 6) * (a ** 3 - (a - 2 * b) ** 3); // sphere OD, wall
    default: return a * 1000; // a volume in cm³
  }
}
export const SHAPES: { key: Shape; name: string; dims: [string, string, string] }[] = [
  { key: 'tube', name: 'Tube or case cylinder', dims: ['Outside ⌀', 'Inside ⌀', 'Length'] },
  { key: 'rod', name: 'Round bar', dims: ['Diameter', '', 'Length'] },
  { key: 'plate', name: 'Plate or block', dims: ['Length', 'Width', 'Thickness'] },
  { key: 'disc', name: 'Disc', dims: ['Diameter', '', 'Thickness'] },
  { key: 'shell', name: 'Spherical shell', dims: ['Outside ⌀', 'Wall', ''] },
  { key: 'volume', name: 'Volume from CAD (cm³)', dims: ['Volume, cm³', '', ''] },
];
/** Mass in kg of a volume in mm³ at a density in g/cm³. */
export const massKg = (vMm3: number, rho: number) => vMm3 * rho * 1e-6;
