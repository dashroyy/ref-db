// The O-ring library. Every tool that takes an O-ring reads it from here. Units: mm unless a name says inch.
//  - SAE AS568 (src/data/as568.json): the inch series, the same sizes as BS 1806 and the ISO 3601-1 inch series. ID and
//    its tolerance for each dash number; section and its tolerance for each series.
//  - BS 4518 (src/data/bs4518.json): the UK metric series, designated by ID and section in tenths of a millimetre
//    (0545-30 is 54.5 × 3.0). ID tolerance by size range, section tolerance by section.
import data from '../data/as568.json' with { type: 'json' };
import metric from '../data/bs4518.json' with { type: 'json' };

export type RingStd = 'AS568' | 'BS 4518';
export interface Ring { dash: string; std: RingStd; idIn: number; idTolIn: number; id: number; idTol: number; csIn: number; csTolIn: number; cs: number; csTol: number }

export const AS568: Ring[] = (data.rings as Omit<Ring, 'std'>[]).map((r) => ({ ...r, std: 'AS568' }));
export const BS4518: Ring[] = metric.rings.map((r) => ({
  dash: r.size, std: 'BS 4518', id: r.id, idTol: r.idTol, cs: r.cs, csTol: r.csTol,
  idIn: r.id / 25.4, idTolIn: r.idTol / 25.4, csIn: r.cs / 25.4, csTolIn: r.csTol / 25.4,
}));
export const ORINGS = [...AS568, ...BS4518];

/** The standard sections: AS568 (-004 to -050, -102 to -178, -201 to -284, -309 to -395, -425 to -475), and BS 4518. */
export const SECTIONS = [1.78, 2.62, 3.53, 5.33, 6.99];
export const METRIC_SECTIONS = [1.6, 2.4, 3.0, 5.7, 8.4];
const num = (r: Ring) => +r.dash.slice(1);
export const SERIES: { key: string; name: string; test: (r: Ring) => boolean }[] = [
  { key: '0', name: 'AS568 -001 to -050 (1.78 mm)', test: (r) => r.std === 'AS568' && num(r) < 100 },
  { key: '1', name: 'AS568 -102 to -178 (2.62 mm)', test: (r) => r.std === 'AS568' && num(r) >= 100 && num(r) < 200 },
  { key: '2', name: 'AS568 -201 to -284 (3.53 mm)', test: (r) => r.std === 'AS568' && num(r) >= 200 && num(r) < 300 },
  { key: '3', name: 'AS568 -309 to -395 (5.33 mm)', test: (r) => r.std === 'AS568' && num(r) >= 300 && num(r) < 400 },
  { key: '4', name: 'AS568 -425 to -475 (6.99 mm)', test: (r) => r.std === 'AS568' && num(r) >= 400 && num(r) < 500 },
  { key: '9', name: 'AS568 -901 to -932 (port seals, MS33656 / AS5202 bosses)', test: (r) => r.std === 'AS568' && num(r) >= 900 },
  ...METRIC_SECTIONS.map((cs) => ({ key: `m${cs}`, name: `BS 4518, ${cs.toFixed(1)} mm section`, test: (r: Ring) => r.std === 'BS 4518' && Math.abs(r.cs - cs) < 0.01 })),
];
const STANDARD = [...AS568.filter((r) => num(r) >= 4 && num(r) < 900), ...BS4518];

/** A ring by its AS568 dash number (-222, 222) or its BS 4518 designation (0545-30). */
export const ring = (dash: string) =>
  /^\d{4}-\d{2}$/.test(dash) ? BS4518.find((r) => r.dash === dash) : AS568.find((r) => r.dash === dash || r.dash === `-${dash.replace(/^-/, '')}`);
/** Standard-series rings of a section, smallest ID first (AS568 or BS 4518, by the section). */
export const ringsFor = (cs: number) => STANDARD.filter((r) => Math.abs(r.cs - cs) < 0.01).sort((a, b) => a.id - b.id);
export const idsFor = (cs: number) => ringsFor(cs).map((r) => r.id);
/** The stock ring of a section and ID, if there is one. */
export const ringAt = (cs: number, id: number) => ringsFor(cs).find((r) => Math.abs(r.id - id) < 0.02);

/** BS 4518 inside-diameter tolerance (±, mm) by size range (the ISO 286 ranges). */
const BS_ID_TOL: [number, number][] = [[10, 0.15], [18, 0.2], [30, 0.25], [50, 0.3], [80, 0.4], [120, 0.5], [180, 0.6], [250, 0.8], [315, 1.0], [400, 1.5], [500, 2.0]];
export const bs4518IdTol = (id: number) => (BS_ID_TOL.find(([max]) => id <= max) ?? BS_ID_TOL[BS_ID_TOL.length - 1])[1];

/**
 * Inside-diameter tolerance (±, mm): the value for a stock ID of the section; for another ID, the AS568 value of the
 * stock ring with the nearest ID (AS568 tolerances step with the ID, not with the section), or the BS 4518 range value
 * for a metric section.
 */
export function idTolFor(id: number, cs?: number) {
  if (cs !== undefined) {
    const stock = ringAt(cs, id);
    if (stock) return stock.idTol;
    if (METRIC_SECTIONS.some((m) => Math.abs(m - cs) < 0.01)) return bs4518IdTol(id);
  }
  const inch = STANDARD.filter((r) => r.std === 'AS568');
  return inch.reduce((b, r) => (Math.abs(r.id - id) < Math.abs(b.id - id) ? r : b), inch[0]).idTol;
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
    .map((r) => ({ r, stretch: (d - r.id) / r.id }))
    .filter((x) => (arrangement === 'piston' ? x.stretch >= 0 && x.stretch <= 0.08 : x.stretch >= 0 && x.stretch <= 0.05));
}
