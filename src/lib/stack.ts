// Tolerance stack-ups. Linear stacks of contributors with sensitivities: worst case, root-sum-square (RSS) with each
// part's tolerance at ±3·Cpk standard deviations, and Monte Carlo — which also takes a nonlinear result function.
// Radial stacks: offsets in a plane that add as vectors (coaxiality, clearance shifts, tilts at a lever arm), where
// worst case, the RSS of the radii and Monte Carlo can disagree badly. Units are the contributors' own, usually mm.
import { normalCdf } from './allowables.ts';

export type Dist = 'normal' | 'uniform';
/** One term in a stack: limits from the drawing, and the sensitivity of the result to it (±1, ±½ for a diameter…). */
export interface Contributor { name: string; sens: number; lo: number; hi: number; dist?: Dist; cpk?: number }

const mid = (c: Contributor) => (c.lo + c.hi) / 2;
const half = (c: Contributor) => Math.abs(c.hi - c.lo) / 2;

/** Standard deviation of a contributor: normal and centred with its tolerance at ±3·Cpk σ, or uniform across it. */
export const sigmaOf = (c: Contributor, cpk = 1) => (c.dist === 'uniform' ? half(c) / Math.sqrt(3) : half(c) / (3 * (c.cpk ?? cpk)));

/**
 * Linear stack, result = Σ sens·x. Worst case adds every half tolerance; RSS adds variances. With every part normal
 * and Cpk 1, the ±3σ RSS band is the textbook √Σ(s·t)². Shares say which contributor to tighten first.
 */
export function linearStack(cs: Contributor[], cpk = 1) {
  const nominal = cs.reduce((a, c) => a + c.sens * mid(c), 0);
  const wc = cs.reduce((a, c) => a + Math.abs(c.sens) * half(c), 0);
  const vars = cs.map((c) => (c.sens * sigmaOf(c, cpk)) ** 2);
  const variance = vars.reduce((a, v) => a + v, 0), sigma = Math.sqrt(variance);
  const rows = cs.map((c, i) => ({
    name: c.name, mean: mid(c), half: half(c), wcPart: Math.abs(c.sens) * half(c),
    wcShare: wc > 0 ? (Math.abs(c.sens) * half(c)) / wc : 0, varShare: variance > 0 ? vars[i] / variance : 0,
  }));
  return { nominal, wc, wcMin: nominal - wc, wcMax: nominal + wc, sigma, rss: 3 * sigma, rssMin: nominal - 3 * sigma, rssMax: nominal + 3 * sigma, rows };
}

/** Capability of a normal result against optional limits: Cpk and the predicted fractions outside. */
export function capability(mean: number, sigma: number, lsl?: number, usl?: number) {
  const zl = lsl === undefined ? Infinity : (mean - lsl) / sigma;
  const zu = usl === undefined ? Infinity : (usl - mean) / sigma;
  return { cpk: Math.min(zl, zu) / 3, below: zl === Infinity ? 0 : normalCdf(-zl), above: zu === Infinity ? 0 : normalCdf(-zu) };
}

/** Small, fast, seedable generator (mulberry32) so a Monte Carlo run is repeatable. */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Standard normal by Box–Muller. */
export const gauss = (r: () => number) => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r());

/** Summary of a sample: mean, standard deviation, quantiles and fractions beyond limits. */
export function summarise(values: Float64Array) {
  const s = Float64Array.from(values).sort(), n = s.length;
  let m = 0;
  for (const v of s) m += v;
  m /= n;
  let q = 0;
  for (const v of s) q += (v - m) ** 2;
  const quantile = (p: number) => {
    const x = Math.min(n - 1, Math.max(0, p * (n - 1))), i = Math.floor(x), f = x - i;
    return i + 1 < n ? s[i] * (1 - f) + s[i + 1] * f : s[i];
  };
  const below = (v: number) => { let lo = 0, hi = n; while (lo < hi) { const k = (lo + hi) >> 1; if (s[k] < v) lo = k + 1; else hi = k; } return lo / n; };
  return { n, mean: m, sd: Math.sqrt(q / (n - 1)), min: s[0], max: s[n - 1], sorted: s, quantile, below, above: (v: number) => 1 - below(v) };
}

/**
 * Monte Carlo: draw every contributor from its distribution and evaluate the result — the linear sum by default, or
 * any function of the drawn values (a squeeze as a fraction of the drawn section, say).
 */
export function monteCarlo(cs: Contributor[], opts: { n?: number; seed?: number; cpk?: number; f?: (x: number[]) => number } = {}) {
  const { n = 100000, seed = 1, cpk = 1, f } = opts, r = rng(seed), out = new Float64Array(n), x = new Array(cs.length);
  for (let k = 0; k < n; k++) {
    for (let i = 0; i < cs.length; i++) {
      const c = cs[i];
      x[i] = c.dist === 'uniform' ? c.lo + (c.hi - c.lo) * r() : mid(c) + sigmaOf(c, cpk) * gauss(r);
    }
    out[k] = f ? f(x) : x.reduce((a: number, v: number, i: number) => a + cs[i].sens * v, 0);
  }
  return summarise(out);
}

export type RadialKind = 'zone' | 'shift' | 'fixed';
/**
 * One radial offset, r its largest value at the plane of interest:
 * zone — anywhere in a circular tolerance zone of radius r (position, coaxiality), uniformly;
 * shift — a clearance taken up fully, in a random direction;
 * fixed — a clearance taken up fully, in the same direction on every assembly (gravity on a horizontal stand).
 */
export interface Offset { name: string; r: number; kind: RadialKind }

/** Radial stack: worst case Σr, the RSS of the radii √Σr², and the Monte Carlo resultant. */
export function radialStack(offs: Offset[], opts: { n?: number; seed?: number } = {}) {
  const { n = 100000, seed = 1 } = opts, r = rng(seed), out = new Float64Array(n);
  const xs = new Float32Array(Math.min(n, 1500)), ys = new Float32Array(xs.length);
  for (let k = 0; k < n; k++) {
    let x = 0, y = 0;
    for (const o of offs) {
      if (o.kind === 'fixed') { x += o.r; continue; }
      const rho = o.kind === 'zone' ? o.r * Math.sqrt(r()) : o.r, th = 2 * Math.PI * r();
      x += rho * Math.cos(th); y += rho * Math.sin(th);
    }
    out[k] = Math.hypot(x, y);
    if (k < xs.length) { xs[k] = x; ys[k] = y; }
  }
  const wc = offs.reduce((a, o) => a + o.r, 0), rssRadii = Math.sqrt(offs.reduce((a, o) => a + o.r * o.r, 0));
  const shares = offs.map((o) => ({ name: o.name, r: o.r, kind: o.kind, wcShare: wc > 0 ? o.r / wc : 0 }));
  return { wc, rssRadii, mc: summarise(out), points: { xs, ys }, shares };
}

/** Line offset of a tilt at a lever arm: a tolerance t over a length l tilts the axis by t/l. */
export const tiltOffset = (t: number, l: number, lever: number) => (t / l) * lever;

/** Parse "name, sensitivity, low, high[, n|u]" lines; names may contain commas. */
export function parseContributors(text: string) {
  const out: Contributor[] = [], bad: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const f = line.split(',').map((s) => s.trim());
    let dist: Dist = 'normal';
    if (/^(u|uniform)$/i.test(f[f.length - 1])) { dist = 'uniform'; f.pop(); } else if (/^(n|normal)$/i.test(f[f.length - 1])) f.pop();
    const nums = f.slice(-3).map(Number), name = f.slice(0, -3).join(', ');
    if (f.length < 4 || nums.some((v) => !Number.isFinite(v)) || f.slice(-3).some((s) => s === '')) { bad.push(line); continue; }
    const [sens, a, b] = nums;
    out.push({ name: name || `Row ${out.length + 1}`, sens, lo: Math.min(a, b), hi: Math.max(a, b), dist });
  }
  return { rows: out, bad };
}

/** Parse "name, r, zone|shift|fixed" lines; r may be a tilt "t/l", taken to the lever arm. */
export function parseOffsets(text: string, lever: number) {
  const out: Offset[] = [], bad: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const f = line.split(',').map((s) => s.trim());
    const kind = f.length >= 3 ? f[f.length - 1].toLowerCase() : '';
    const val = f[f.length - 2] ?? '', name = f.slice(0, -2).join(', ');
    const m = /^([\d.]+)\s*\/\s*([\d.]+)$/.exec(val);
    const r = m ? (Number.isFinite(lever) && lever > 0 ? tiltOffset(+m[1], +m[2], lever) : NaN) : Number(val);
    if (!['zone', 'shift', 'fixed'].includes(kind) || !(r >= 0) || val === '') { bad.push(line); continue; }
    out.push({ name: name || `Row ${out.length + 1}`, r, kind: kind as RadialKind });
  }
  return { rows: out, bad };
}

// ---------- Rows as they are on the drawing ----------

/** How a dimension is toleranced on the drawing. Every format converts to limits, then to a mean ± equal half. */
export type TolFormat = 'eq' | 'uneq' | 'limits' | 'uniPlus' | 'uniMin' | 'gdt';
export const TOL_FORMATS: { key: TolFormat; name: string; hint: string }[] = [
  { key: 'eq', name: 'Equal ±t', hint: '20.5 ±0.5' },
  { key: 'uneq', name: 'Unequal +a / −b', hint: '20 +0.8 / −0.2' },
  { key: 'limits', name: 'Limits max / min', hint: '20.8 / 20.2' },
  { key: 'uniPlus', name: 'Unilateral +t / 0', hint: '12 +0.2 / 0' },
  { key: 'uniMin', name: 'Unilateral 0 / −t', hint: '12 0 / −0.2' },
  { key: 'gdt', name: 'GD&T control', hint: 'position ⌀0.2' },
];

/**
 * Geometric controls and how a zone of width t acts along one direction of a linear stack. A diametral zone is a
 * circle, so only its radius acts: ⌀0.2 is ±0.1, not ±0.2. Position zones can take the MMC bonus; a unilateral profile
 * zone moves the mean by t/2 as well.
 */
export const GDT_CONTROLS = [
  { key: 'pos', name: 'Position, diametral zone', mmc: true, shift: 0 },
  { key: 'posLin', name: 'Position, width zone', mmc: true, shift: 0 },
  { key: 'prof', name: 'Profile, equally disposed', mmc: false, shift: 0 },
  { key: 'profOut', name: 'Profile, unilateral outside (+)', mmc: false, shift: 1 },
  { key: 'profIn', name: 'Profile, unilateral inside (−)', mmc: false, shift: -1 },
  { key: 'form', name: 'Flatness or straightness', mmc: false, shift: 0 },
  { key: 'orient', name: 'Parallelism, perpendicularity, angularity', mmc: false, shift: 0 },
  { key: 'runout', name: 'Runout or total runout (FIM)', mmc: false, shift: 0 },
  { key: 'coax', name: 'Coaxiality, concentricity, symmetry', mmc: false, shift: 0 },
] as const;
export type GdtKey = (typeof GDT_CONTROLS)[number]['key'];

export interface StackRow {
  name: string; on?: boolean;
  dir: 1 | -1; sens?: number; // direction in the loop, and a sensitivity (½ for a diameter whose radius is in the loop)
  format: TolFormat;
  nom?: number; tol?: number; plus?: number; minus?: number; max?: number; min?: number;
  gdt?: GdtKey; zone?: number; bonus?: number;
  dist?: Dist; group?: string; locked?: boolean; mat?: string;
}

/** Limits of a row from its drawing format, with the equal-bilateral mean and half, and what the conversion did. */
export function rowLimits(r: StackRow) {
  const n = (v: number | undefined) => (Number.isFinite(v) ? (v as number) : 0);
  const nom = n(r.nom);
  let lo: number, hi: number, note = '';
  switch (r.format) {
    case 'uneq': hi = nom + n(r.plus); lo = nom - n(r.minus); break;
    case 'limits': hi = Math.max(n(r.max), n(r.min)); lo = Math.min(n(r.max), n(r.min)); break;
    case 'uniPlus': hi = nom + Math.abs(n(r.tol)); lo = nom; break;
    case 'uniMin': hi = nom; lo = nom - Math.abs(n(r.tol)); break;
    case 'gdt': {
      const g = GDT_CONTROLS.find((x) => x.key === r.gdt) ?? GDT_CONTROLS[0];
      const zone = Math.abs(n(r.zone)) + (g.mmc ? Math.max(0, n(r.bonus)) : 0);
      const c = nom + (g.shift * zone) / 2;
      lo = c - zone / 2; hi = c + zone / 2;
      note = g.shift ? 'unilateral zone: mean moved by t/2' : g.mmc && n(r.bonus) > 0 ? 'includes the MMC bonus' : g.key === 'pos' ? 'diametral zone: only the radius acts' : '';
      break;
    }
    default: hi = nom + Math.abs(n(r.tol)); lo = nom - Math.abs(n(r.tol));
  }
  const mean = (lo + hi) / 2, halfW = (hi - lo) / 2, shift = r.format === 'limits' || r.format === 'gdt' ? 0 : mean - nom;
  if (!note && Math.abs(shift) > 1e-12) note = 'unequal tolerance: mean moved to the middle of the limits';
  return { lo, hi, mean, half: halfW, shift, note };
}

/** The active rows as contributors: sensitivity = direction × sensitivity. */
export const toContributors = (rows: StackRow[]): (Contributor & { group?: string; locked?: boolean })[] =>
  rows.filter((r) => r.on !== false).map((r) => {
    const l = rowLimits(r);
    return { name: r.name, sens: r.dir * (r.sens ?? 1), lo: l.lo, hi: l.hi, dist: r.dist ?? 'normal', group: r.group?.trim() || undefined, locked: r.locked };
  });

/**
 * A linear stack with correlated groups: the members of a group (one setup, one tool, one batch) add worst case
 * among themselves, and the groups and single rows then combine statistically. Without groups this is linearStack,
 * with the textbook RSS (Cpk 1, normal), the Cpk-based band, and Bender's 1.5 × RSS.
 */
export function groupedStack(cs: (Contributor & { group?: string })[], cpk = 1) {
  const base = linearStack(cs, cpk);
  const gs = new Map<string, number>(), gt = new Map<string, number>();
  let variance = 0, tv = 0;
  cs.forEach((c) => {
    const s = Math.abs(c.sens) * sigmaOf(c, cpk), t = Math.abs(c.sens) * half(c);
    if (c.group) { gs.set(c.group, (gs.get(c.group) ?? 0) + s); gt.set(c.group, (gt.get(c.group) ?? 0) + t); }
    else { variance += s * s; tv += t * t; }
  });
  for (const s of gs.values()) variance += s * s;
  for (const t of gt.values()) tv += t * t;
  const sigma = Math.sqrt(variance), rss = Math.sqrt(tv);
  return {
    ...base, sigma, rss, rssMin: base.nominal - rss, rssMax: base.nominal + rss,
    cpkBand: 3 * sigma, cpkMin: base.nominal - 3 * sigma, cpkMax: base.nominal + 3 * sigma,
    bender: 1.5 * rss, groups: [...gs.keys()],
  };
}

/** Monte Carlo with correlated groups: one random draw per group, applied to every member in the direction of the loop. */
export function groupedMonteCarlo(cs: (Contributor & { group?: string })[], opts: { n?: number; seed?: number; cpk?: number } = {}) {
  const { n = 100000, seed = 1, cpk = 1 } = opts, r = rng(seed), out = new Float64Array(n);
  const keys = [...new Set(cs.map((c) => c.group).filter(Boolean))] as string[];
  const gz = new Map<string, number>(), gu = new Map<string, number>();
  for (let k = 0; k < n; k++) {
    for (const g of keys) { gz.set(g, gauss(r)); gu.set(g, r()); }
    let y = 0;
    for (const c of cs) {
      const sgn = Math.sign(c.sens) || 1;
      let x: number;
      if (c.dist === 'uniform') {
        const u = c.group ? (sgn > 0 ? gu.get(c.group)! : 1 - gu.get(c.group)!) : r();
        x = c.lo + (c.hi - c.lo) * u;
      } else x = mid(c) + sigmaOf(c, cpk) * (c.group ? sgn * gz.get(c.group)! : gauss(r));
      y += c.sens * x;
    }
    out[k] = y;
  }
  return summarise(out);
}

/** Thermal shift of the stack result: each row grows by L·α·ΔT, L its mean, in the direction of the row. */
export function thermalShift(rows: StackRow[], alphaOf: (mat: string) => number | undefined, dT: number) {
  let total = 0;
  const parts = rows.filter((r) => r.on !== false).map((r) => {
    const a = r.mat ? alphaOf(r.mat) : undefined, L = rowLimits(r).mean;
    const d = a === undefined ? 0 : r.dir * (r.sens ?? 1) * L * a * dT;
    total += d;
    return { name: r.name, alpha: a, shift: d };
  });
  return { total, parts };
}

// ---------- Allocation ----------

/** ISO 286 standard tolerance factor i (µm) for a size D (mm): 0.45 D^⅓ + 0.001 D. */
export const toleranceFactor = (D: number) => 0.45 * Math.cbrt(Math.max(1, Math.abs(D))) + 0.001 * Math.abs(D);

export type AllocMethod = 'scale' | 'equal' | 'size';
/**
 * New half tolerances so that the result meets a target half tolerance, by worst case or by RSS. Locked rows (bought
 * parts, standard parts) keep their tolerance and use part of the target first. Scale keeps the present proportions;
 * equal gives each row the same effect on the result; size makes each tolerance proportional to the ISO tolerance
 * factor of its size, so every row gets about the same IT grade (a row without a size, such as a geometric control,
 * changes in the same proportion as the sized rows on average).
 */
export function allocate(rows: { name: string; sens: number; half: number; mean: number; locked?: boolean; unsized?: boolean }[], target: number, basis: 'wc' | 'rss', method: AllocMethod) {
  const free = rows.filter((r) => !r.locked), fixed = rows.filter((r) => r.locked);
  // a row without a size (a geometric control) keeps the average ratio of tolerance factor to tolerance of the sized rows
  const sized = free.filter((r) => !r.unsized && r.half > 0);
  const ratio = sized.length ? sized.reduce((a, r) => a + toleranceFactor(r.mean) / r.half, 0) / sized.length : 1;
  const used = basis === 'wc' ? fixed.reduce((a, r) => a + Math.abs(r.sens) * r.half, 0) : Math.sqrt(fixed.reduce((a, r) => a + (r.sens * r.half) ** 2, 0));
  const ok = target > used;
  const left = basis === 'wc' ? target - used : ok ? Math.sqrt(target * target - used * used) : 0;
  const weight = (r: (typeof rows)[number]) =>
    method === 'scale' ? r.half : method === 'size' ? (r.unsized ? r.half * ratio : toleranceFactor(r.mean)) : 1 / Math.max(Math.abs(r.sens), 1e-12);
  const sum = basis === 'wc' ? free.reduce((a, r) => a + Math.abs(r.sens) * weight(r), 0) : Math.sqrt(free.reduce((a, r) => a + (r.sens * weight(r)) ** 2, 0));
  const k = ok && sum > 0 ? left / sum : NaN;
  return { used, left, k, ok, rows: rows.map((r) => ({ ...r, newHalf: r.locked ? r.half : k * weight(r) })) };
}

/** The coarsest ISO IT grade (4–12) whose width fits inside a total tolerance 2t (mm) at size D (mm), or undefined. */
export function itGrade(D: number, twoT: number, itValue: (d: number, g: number) => number) {
  const d = Math.min(500, Math.max(1, Math.abs(D)));
  let best: number | undefined;
  for (let g = 4; g <= 12; g++) if (itValue(d, g) / 1000 <= twoT + 1e-12) best = g;
  return best;
}

/** Rows as editable text: "name, sensitivity, low, high[, u]" (the format of parseContributors). */
export const rowsToText = (rows: StackRow[]) =>
  rows.filter((r) => r.on !== false).map((r) => {
    const l = rowLimits(r), f = (v: number) => String(Number(v.toPrecision(10)));
    return `${r.name}, ${f(r.dir * (r.sens ?? 1))}, ${f(l.lo)}, ${f(l.hi)}${r.dist === 'uniform' ? ', u' : ''}`;
  }).join('\n');

/** Rows from text lines, as limits. */
export const rowsFromText = (text: string) => {
  const p = parseContributors(text);
  return {
    rows: p.rows.map((c): StackRow => ({ name: c.name, on: true, dir: c.sens < 0 ? -1 : 1, sens: Math.abs(c.sens) || 1, format: 'limits', max: c.hi, min: c.lo, nom: (c.lo + c.hi) / 2, dist: c.dist })),
    bad: p.bad,
  };
};
