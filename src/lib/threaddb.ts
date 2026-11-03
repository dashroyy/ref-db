// The thread library: every screw thread the site's tools use, with the limits of size of each tolerance class. Every
// tool that takes a thread reads it from here, so a thread added to src/data/threads.json appears in all of them.
//  - ISO metric (M): ISO 965-2 table values for 6g, 6h, 4g6g and 6H (src/data/threads.json).
//  - MJ (ISO 5855): external 4h6h from the same tables (4h pitch tolerance from 4g6g, 6h major); internal 4H5H
//    computed from ISO 965-1 grades on the MJ basic profile. Check the internal limits against ISO 5855-2.
//  - Unified (UNC, UNF) and UNJ (UNJC, UNJF): ASME B1.1 formulas (classes 2A/2B, 3A/3B), converted to mm.
// Units: mm unless a name says inch.
import data from '../data/threads.json' with { type: 'json' };

export type Family = 'M' | 'MJ' | 'UNC' | 'UNF' | 'UNJC' | 'UNJF';
export type Source = 'table' | 'formula' | 'computed';

export interface ThreadSpec {
  key: string; // stable id, used in tool URLs and selects: "M10", "M10x1.25", "MJ10x1.25", "1/4-28 UNF", "1/4-28 UNJF"
  label: string; // display: "M10 × 1.5", "1/4-28 UNF"
  family: Family;
  d: number; P: number; // nominal (basic major) diameter and pitch, mm
  tpi?: number; inch?: number; // unified threads: threads per inch, basic major diameter in inch
  coarse: boolean;
  d2: number; d3: number; As: number; // basic pitch diameter, basic minor diameter (external, rounded root), tensile stress area
  ext: string[]; int: string[]; // tolerance classes available
}

export interface ExtLimits { cls: string; dmax: number; dmin: number; d2max: number; d2min: number; d1max: number; d3max: number; d3min: number; rootR: [number, number]; source: Source }
export interface IntLimits { cls: string; Dmin: number; D1min: number; D1max: number; D2min: number; D2max: number; source: Source }

const IN = 25.4;
const H = 0.866025; // fundamental triangle height / P
type Metric = (typeof data.metric)[number] & { ext: Record<string, number[]>; int: Record<string, number[]> };
const METRIC = data.metric as Metric[];
const r3 = (v: number) => Math.round(v * 1000) / 1000;
const r4 = (v: number) => Math.round(v * 10000) / 10000;

/** Nearest value of the R40 series (ISO 3), on a log scale: the rounding used for ISO 965-1 tolerances (µm). */
const R40 = [100, 106, 112, 118, 125, 132, 140, 150, 160, 170, 180, 190, 200, 212, 224, 236, 250, 265, 280, 300, 315, 335, 355, 375, 400, 425, 450, 475, 500, 530, 560, 600, 630, 670, 710, 750, 800, 850, 900, 950];
export function r40(v: number) {
  const k = Math.round(40 * Math.log10(v)); // nearest step of 10^(1/40): rounds at the geometric mid-point
  return R40[((k % 40) + 40) % 40] * 10 ** (Math.floor(k / 40) - 2);
}

/** Tensile stress area: ISO 898-1 for metric and MJ, ASME B1.1 for unified (0.7854·(D − 0.9743/n)²). */
const asIso = (d: number, P: number) => (Math.PI / 4) * (d - 0.938194 * P) ** 2;
const asUn = (d: number, P: number) => (Math.PI / 4) * (d - 0.974279 * P) ** 2;

/** Minor diameter of an external thread with a root arc of radius r tangent to both flanks, at pitch diameter d2. */
export const rootMinor = (d2: number, P: number, r: number) => d2 - H * P + 2 * r;

const fmt = (v: number) => String(Number(v.toFixed(3)));
const metricKey = (t: { d: number; P: number; coarse: boolean }) => (t.coarse ? `M${fmt(t.d)}` : `M${fmt(t.d)}x${fmt(t.P)}`);

function metricSpec(t: Metric): ThreadSpec {
  return {
    key: metricKey(t), label: `M${fmt(t.d)} × ${fmt(t.P)}`, family: 'M', d: t.d, P: t.P, coarse: t.coarse,
    d2: t.d - 0.649519 * t.P, d3: t.d - 1.226869 * t.P, As: asIso(t.d, t.P),
    ext: Object.keys(t.ext).concat(t.ext['4g6g'] ? ['4h6h'] : []), int: ['6H'],
  };
}
function mjSpec(d: number, P: number): ThreadSpec {
  return {
    key: `MJ${fmt(d)}x${fmt(P)}`, label: `MJ${fmt(d)} × ${fmt(P)}`, family: 'MJ', d, P, coarse: false,
    d2: d - 0.649519 * P, d3: d - 1.154701 * P, As: asIso(d, P), ext: ['4h6h'], int: ['4H5H'],
  };
}
function unSpec(u: (typeof data.unified)[number], j: boolean): ThreadSpec {
  const P = IN / u.tpi, d = u.D * IN, family = (j ? `UNJ${u.series.slice(2)}` : u.series) as Family;
  return {
    key: `${u.size}-${u.tpi} ${family}`, label: `${u.size}-${u.tpi} ${family}`, family, d, P, tpi: u.tpi, inch: u.D, coarse: u.series === 'UNC',
    d2: d - 0.649519 * P, d3: j ? d - 1.154701 * P : d - 1.226869 * P, As: asUn(d, P),
    ext: j ? ['3A'] : ['2A', '3A'], int: j ? ['3B'] : ['2B', '3B'],
  };
}

const UNJ_SIZES = (u: (typeof data.unified)[number]) => u.D >= 0.112; // #4 and larger
export const THREAD_DB: ThreadSpec[] = [
  ...METRIC.map(metricSpec),
  ...data.mj.filter(({ d, P }) => METRIC.some((t) => t.d === d && t.P === P && t.ext['4g6g'])).map(({ d, P }) => mjSpec(d, P)),
  ...data.unified.map((u) => unSpec(u, false)),
  ...data.unified.filter(UNJ_SIZES).map((u) => unSpec(u, true)),
];
export const FAMILIES: { key: Family; name: string }[] = [
  { key: 'M', name: 'ISO metric (ISO 261 / 965)' }, { key: 'MJ', name: 'MJ aerospace (ISO 5855)' },
  { key: 'UNC', name: 'Unified coarse (ASME B1.1)' }, { key: 'UNF', name: 'Unified fine (ASME B1.1)' },
  { key: 'UNJC', name: 'UNJ coarse (AS8879)' }, { key: 'UNJF', name: 'UNJ fine (AS8879)' },
];
export const threadSpec = (key: string) => THREAD_DB.find((t) => t.key === key);
const metricRow = (t: ThreadSpec) => METRIC.find((m) => m.d === t.d && m.P === t.P)!;

// ASME B1.1, for a basic major diameter D and pitch P in inch. Length of engagement for the standard tolerances = D.
function unTol(D: number, P: number) {
  const tol2A = 0.0015 * Math.cbrt(D) + 0.0015 * Math.sqrt(D) + 0.015 * P ** (2 / 3);
  const allowance = r4(0.3 * tol2A);
  const majorTol = r4(0.06 * P ** (2 / 3));
  // Internal minor diameter tolerance: below 1/4 in, 0.05P^(2/3) + 0.03P/D − 0.002, not more than 0.394P; from 1/4 in, 0.25P − 0.40P² (class 2B).
  const small = Math.min(0.05 * P ** (2 / 3) + (0.03 * P) / D - 0.002, 0.394 * P);
  const minor2B = D < 0.25 ? small : 0.25 * P - 0.4 * P * P;
  const minor3B = Math.max(Math.min(0.05 * P ** (2 / 3) + (0.03 * P) / D - 0.002, 0.394 * P), 0.23 * P - 1.5 * P * P);
  return { tol2A, allowance, majorTol, minor2B, minor3B };
}

/** Limits of an external thread of the class, in mm. */
export function extLimits(t: ThreadSpec, cls: string): ExtLimits | undefined {
  if (t.family === 'M' && cls !== '4h6h') {
    const v = metricRow(t).ext[cls];
    if (!v) return undefined;
    const [dmax, dmin, d2max, d2min, d1max] = v;
    return { cls, dmax, dmin, d2max, d2min, d1max, d3max: r3(rootMinor(d2max, t.P, H * t.P / 6)), d3min: r3(rootMinor(d2min, t.P, 0.125 * t.P)), rootR: [0.125 * t.P, (H * t.P) / 6], source: 'table' };
  }
  if ((t.family === 'M' || t.family === 'MJ') && cls === '4h6h') {
    const m = metricRow(t), six = m.ext['6h'], four = m.ext['4g6g'];
    if (!six || !four) return undefined;
    const d2max = six[2], d2min = r3(d2max - (four[2] - four[3]));
    const rMin = t.family === 'MJ' ? 0.15011 * t.P : 0.125 * t.P, rMax = t.family === 'MJ' ? 0.18042 * t.P : (H * t.P) / 6;
    return { cls, dmax: six[0], dmin: six[1], d2max, d2min, d1max: six[4], d3max: r3(rootMinor(d2max, t.P, rMax)), d3min: r3(rootMinor(d2min, t.P, rMin)), rootR: [rMin, rMax], source: 'table' };
  }
  if (t.inch && (cls === '2A' || cls === '3A')) {
    const D = t.inch, P = 1 / t.tpi!, u = unTol(D, P), allow = cls === '2A' ? u.allowance : 0;
    const d2b = D - 0.649519 * P, d2max = r4(d2b - allow), d2min = r4(d2max - r4(cls === '2A' ? u.tol2A : 0.75 * u.tol2A));
    const dmax = r4(D - allow), dmin = r4(dmax - u.majorTol);
    const j = t.family.startsWith('UNJ'), rMin = (j ? 0.15011 : 0.108) * P, rMax = (j ? 0.18042 : H / 6) * P;
    return {
      cls, dmax: dmax * IN, dmin: dmin * IN, d2max: d2max * IN, d2min: d2min * IN, d1max: (d2max - 0.433013 * P) * IN,
      d3max: rootMinor(d2max, P, rMax) * IN, d3min: rootMinor(d2min, P, rMin) * IN, rootR: [rMin * IN, rMax * IN], source: 'formula',
    };
  }
  return undefined;
}

/** Limits of an internal thread of the class, in mm. */
export function intLimits(t: ThreadSpec, cls: string): IntLimits | undefined {
  if (t.family === 'M' && cls === '6H') {
    const [D1min, D1max, D2min, D2max] = metricRow(t).int['6H'];
    return { cls, Dmin: t.d, D1min, D1max, D2min, D2max, source: 'table' };
  }
  if (t.family === 'MJ' && cls === '4H5H') {
    // ISO 965-1 grades: TD2(4) = 0.63·TD2(6), TD1(5) = 0.8·TD1(6), rounded to R40. MJ basic internal minor D − 0.974279P.
    const [D1min6, D1max6, D2min6, D2max6] = metricRow(t).int['6H'];
    const TD2 = r40(0.63 * (D2max6 - D2min6) * 1000) / 1000, TD1 = r40(0.8 * (D1max6 - D1min6) * 1000) / 1000;
    const D2min = D2min6, D1min = r3(t.d - 0.974279 * t.P);
    return { cls, Dmin: t.d, D1min, D1max: r3(D1min + TD1), D2min, D2max: r3(D2min + TD2), source: 'computed' };
  }
  if (t.inch && (cls === '2B' || cls === '3B')) {
    const D = t.inch, P = 1 / t.tpi!, u = unTol(D, P), j = t.family.startsWith('UNJ');
    const D2min = r4(D - 0.649519 * P), D2max = r4(D2min + r4((cls === '2B' ? 1.3 : 0.975) * u.tol2A));
    const D1min = r4(D - (j ? 0.974279 : 1.082532) * P), D1max = r4(D1min + (cls === '2B' ? u.minor2B : u.minor3B));
    return { cls, Dmin: D * IN, D1min: D1min * IN, D1max: D1max * IN, D2min: D2min * IN, D2max: D2max * IN, source: j ? 'computed' : 'formula' };
  }
  return undefined;
}

/** The usual pair of classes for a family: a general-purpose fit, or the aerospace classes. */
export const defaultClasses = (t: ThreadSpec): [string, string] =>
  t.family === 'M' ? ['6g', '6H'] : t.family === 'MJ' ? ['4h6h', '4H5H'] : t.family.startsWith('UNJ') ? ['3A', '3B'] : ['2A', '2B'];

/** Tensile stress area at the minimum-material limits of an external thread: π/4·((d2min + d3min)/2)². */
export const stressAreaMin = (e: ExtLimits) => (Math.PI / 4) * ((e.d2min + e.d3min) / 2) ** 2;
