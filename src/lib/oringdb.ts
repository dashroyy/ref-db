// The O-ring library: every SAE AS568 size (the same sizes as BS 1806 and the ISO 3601-1 inch series), with the inside
// diameter and its tolerance for each dash number and the cross-section and its tolerance for each series. Every tool
// that takes an O-ring reads it from here (src/data/as568.json). Units: mm unless a name says inch.
import data from '../data/as568.json' with { type: 'json' };

export interface Ring { dash: string; idIn: number; idTolIn: number; id: number; idTol: number; csIn: number; csTolIn: number; cs: number; csTol: number }

export const AS568 = data.rings as Ring[];
/** The five standard sections: -004 to -050, -102 to -178, -201 to -284, -309 to -395, -425 to -475. */
export const SECTIONS = [1.78, 2.62, 3.53, 5.33, 6.99];
export const SERIES: { key: string; name: string; test: (n: number) => boolean }[] = [
  { key: '0', name: '-001 to -050 (1.78 mm)', test: (n) => n < 100 },
  { key: '1', name: '-102 to -178 (2.62 mm)', test: (n) => n >= 100 && n < 200 },
  { key: '2', name: '-201 to -284 (3.53 mm)', test: (n) => n >= 200 && n < 300 },
  { key: '3', name: '-309 to -395 (5.33 mm)', test: (n) => n >= 300 && n < 400 },
  { key: '4', name: '-425 to -475 (6.99 mm)', test: (n) => n >= 400 && n < 500 },
  { key: '9', name: '-901 to -932 (port seals, MS33656 / AS5202 bosses)', test: (n) => n >= 900 },
];
const num = (r: Ring) => +r.dash.slice(1);
const STANDARD = AS568.filter((r) => num(r) >= 4 && num(r) < 900);

export const ring = (dash: string) => AS568.find((r) => r.dash === dash || r.dash === `-${dash.replace(/^-/, '')}`);
/** Standard-series rings of a section, smallest ID first. */
export const ringsFor = (cs: number) => STANDARD.filter((r) => Math.abs(r.cs - cs) < 0.01);
export const idsFor = (cs: number) => ringsFor(cs).map((r) => r.id);
/** The stock ring of a section and ID, if there is one. */
export const ringAt = (cs: number, id: number) => ringsFor(cs).find((r) => Math.abs(r.id - id) < 0.02);

/**
 * Inside-diameter tolerance (±, mm): the AS568 value for a stock ID; for another ID, the value of the stock ring with
 * the nearest ID (AS568 tolerances step with the ID, not with the section).
 */
export function idTolFor(id: number) {
  return STANDARD.reduce((b, r) => (Math.abs(r.id - id) < Math.abs(b.id - id) ? r : b), STANDARD[0]).idTol;
}

/** The size limits of a ring, for a model at the extremes: ID, section, OD and volume. */
export function ringLimits(r: Pick<Ring, 'id' | 'idTol' | 'cs' | 'csTol'>) {
  const idMin = r.id - r.idTol, idMax = r.id + r.idTol, csMin = r.cs - r.csTol, csMax = r.cs + r.csTol;
  const vol = (id: number, cs: number) => Math.PI ** 2 / 4 * (id + cs) * cs * cs; // torus, mm³
  return { idMin, idMax, csMin, csMax, odMin: idMin + 2 * csMin, odMax: idMax + 2 * csMax, volMin: vol(idMin, csMin), volMax: vol(idMax, csMax), volNom: vol(r.id, r.cs) };
}

/** Stock rings of a section that fit a diameter: piston (stretched onto a groove root) or rod (ID at or under the rod). */
export function ringsForGroove(cs: number, arrangement: 'piston' | 'rod', d: number) {
  return ringsFor(cs)
    .map((r) => ({ r, stretch: arrangement === 'piston' ? (d - r.id) / r.id : (d - r.id) / r.id }))
    .filter((x) => (arrangement === 'piston' ? x.stretch >= 0 && x.stretch <= 0.08 : x.stretch >= 0 && x.stretch <= 0.05));
}
