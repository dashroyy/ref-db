// General tolerances to ISO 2768: part 1 for linear and angular dimensions (classes f, m, c, v) and part 2 for geometry
// (classes H, K, L). They apply to every dimension and feature that has no tolerance of its own. Units: mm, degrees.

export type LinClass = 'f' | 'm' | 'c' | 'v';
export type GeoClass = 'H' | 'K' | 'L';
export const LIN_CLASSES: { key: LinClass; name: string }[] = [
  { key: 'f', name: 'f (fine)' }, { key: 'm', name: 'm (medium)' }, { key: 'c', name: 'c (coarse)' }, { key: 'v', name: 'v (very coarse)' },
];
export const GEO_CLASSES: { key: GeoClass; name: string }[] = [{ key: 'H', name: 'H' }, { key: 'K', name: 'K' }, { key: 'L', name: 'L' }];

/** A table of values by size range: upper bounds of each range (the first range starts at `from`), and the values. */
interface Table<C extends string> { from: number; to: number[]; v: Record<C, (number | null)[]> }
const pick = <C extends string>(t: Table<C>, size: number, cls: C) => {
  if (!(size >= t.from)) return { value: null as number | null, range: '' };
  const i = t.to.findIndex((b) => size <= b);
  if (i < 0) return { value: null, range: `over ${t.to[t.to.length - 1]}` };
  const lo = i === 0 ? t.from : t.to[i - 1];
  const hi = t.to[i];
  return { value: t.v[cls][i], range: !Number.isFinite(hi) ? `over ${lo}` : i === 0 ? `${lo} to ${hi}` : `over ${lo} to ${hi}` };
};

/** ISO 2768-1 table 1: permissible deviations (±mm) for linear dimensions except broken edges. */
export const LINEAR: Table<LinClass> = {
  from: 0.5, to: [3, 6, 30, 120, 400, 1000, 2000, 4000],
  v: {
    f: [0.05, 0.05, 0.1, 0.15, 0.2, 0.3, 0.5, null],
    m: [0.1, 0.1, 0.2, 0.3, 0.5, 0.8, 1.2, 2],
    c: [0.2, 0.3, 0.5, 0.8, 1.2, 2, 3, 4],
    v: [null, 0.5, 1, 1.5, 2.5, 4, 6, 8],
  },
};
/** ISO 2768-1 table 2: broken edges (external radii and chamfer heights), ±mm. */
export const EDGES: Table<LinClass> = {
  from: 0.5, to: [3, 6, Infinity],
  v: { f: [0.2, 0.5, 1], m: [0.2, 0.5, 1], c: [0.4, 1, 2], v: [0.4, 1, 2] },
};
/** ISO 2768-1 table 3: angular dimensions, ± minutes of arc, by the length of the shorter side. */
export const ANGULAR: Table<LinClass> = {
  from: 0, to: [10, 50, 120, 400, Infinity],
  v: { f: [60, 30, 20, 10, 5], m: [60, 30, 20, 10, 5], c: [90, 60, 30, 15, 10], v: [180, 120, 60, 30, 20] },
};
/** ISO 2768-2 table 1: straightness and flatness (mm), by nominal length. */
export const FLATNESS: Table<GeoClass> = {
  from: 0, to: [10, 30, 100, 300, 1000, 3000],
  v: { H: [0.02, 0.05, 0.1, 0.2, 0.3, 0.4], K: [0.05, 0.1, 0.2, 0.4, 0.6, 0.8], L: [0.1, 0.2, 0.4, 0.8, 1.2, 1.6] },
};
/** ISO 2768-2 table 2: perpendicularity (mm), by the length of the shorter side. */
export const PERPENDICULARITY: Table<GeoClass> = {
  from: 0, to: [100, 300, 1000, 3000],
  v: { H: [0.2, 0.3, 0.4, 0.5], K: [0.4, 0.6, 0.8, 1], L: [0.6, 1, 1.5, 2] },
};
/** ISO 2768-2 table 3: symmetry (mm), by the length of the shorter feature. */
export const SYMMETRY: Table<GeoClass> = {
  from: 0, to: [100, 300, 1000, 3000],
  v: { H: [0.5, 0.5, 0.5, 0.5], K: [0.6, 0.6, 0.8, 1], L: [0.6, 1, 1.5, 2] },
};
/** ISO 2768-2 table 4: circular runout (mm). */
export const RUNOUT: Record<GeoClass, number> = { H: 0.1, K: 0.2, L: 0.5 };

export const linear = (size: number, c: LinClass) => pick(LINEAR, size, c);
export const edge = (size: number, c: LinClass) => pick(EDGES, size, c);
export const angular = (shorterSide: number, c: LinClass) => pick(ANGULAR, shorterSide, c);
export const flatness = (length: number, c: GeoClass) => pick(FLATNESS, length, c);
export const perpendicularity = (shorter: number, c: GeoClass) => pick(PERPENDICULARITY, shorter, c);
export const symmetry = (length: number, c: GeoClass) => pick(SYMMETRY, length, c);

/** An angle in minutes of arc as degrees and minutes: 90 → 1°30′. */
export const dms = (min: number) => {
  const d = Math.floor(min / 60), m = Math.round(min - 60 * d);
  return `${d}°${m ? `${String(m).padStart(2, '0')}′` : ''}`;
};

/** The title-block note, for example "ISO 2768-mK" or "ISO 2768-mK-E" with the envelope requirement. */
export const note = (lin: LinClass, geo: GeoClass | '', envelope = false) => `ISO 2768-${lin}${geo}${geo && envelope ? '-E' : ''}`;

/** All the general tolerances for one size, as the tool shows them. */
export function lookup(size: number, lin: LinClass, geo: GeoClass | '') {
  return {
    linear: linear(size, lin), edge: edge(size, lin), angular: angular(size, lin),
    flatness: geo ? flatness(size, geo) : null, perpendicularity: geo ? perpendicularity(size, geo) : null,
    symmetry: geo ? symmetry(size, geo) : null, runout: geo ? RUNOUT[geo] : null,
  };
}
