// Weighted trade study: normalisation of raw criterion values, the weighted sum, the weight at which the leader and
// another option tie, and a seeded Monte Carlo of the scores to give the probability that each option wins.

export type Dir = 'max' | 'min';
export interface Criterion { name: string; dir: Dir; weight: number; values: number[] }

/** Min–max normalisation to 0–1 across the options (1 is best). All equal gives 1 for all. */
export function normalise(values: number[], dir: Dir) {
  const lo = Math.min(...values), hi = Math.max(...values);
  if (hi === lo) return values.map(() => 1);
  return values.map((v) => (dir === 'max' ? (v - lo) / (hi - lo) : (hi - v) / (hi - lo)));
}

/** Normalised score matrix [option][criterion]. */
export function scoreMatrix(crit: Criterion[]) {
  const cols = crit.map((c) => normalise(c.values, c.dir));
  const n = crit[0]?.values.length ?? 0;
  return Array.from({ length: n }, (_, i) => cols.map((col) => col[i]));
}

/** Weighted totals on 0–100 (the sum of weights is the scale). */
export function totals(s: number[][], w: number[]) {
  const W = w.reduce((a, b) => a + b, 0);
  return s.map((row) => (100 * row.reduce((a, v, k) => a + v * w[k], 0)) / W);
}

/** Ranking: option indices from best to worst. */
export const ranking = (t: number[]) => t.map((v, i) => [v, i] as const).sort((a, b) => b[0] - a[0]).map(([, i]) => i);

/**
 * The weight of criterion c at which options a and b tie, with all other weights held. Null when no non-negative
 * weight makes them tie (one option is better or equal on the rest and on c).
 */
export function tieWeight(s: number[][], w: number[], c: number, a: number, b: number) {
  const D = w.reduce((acc, wk, k) => (k === c ? acc : acc + wk * (s[a][k] - s[b][k])), 0);
  const d = s[a][c] - s[b][c];
  if (d === 0) return null;
  const wc = -D / d;
  return wc >= 0 ? wc : null;
}

/** For each criterion, the weight that makes the runner-up tie with the leader. */
export function sensitivity(s: number[][], w: number[]) {
  const r = ranking(totals(s, w)), lead = r[0];
  return w.map((wc, c) => {
    // the first option to catch the leader as this weight moves away from its value
    let best: { other: number; at: number } | null = null;
    for (const o of r.slice(1)) {
      const at = tieWeight(s, w, c, lead, o);
      if (at === null) continue;
      if (!best || Math.abs(at - wc) < Math.abs(best.at - wc)) best = { other: o, at };
    }
    return { c, w: wc, tie: best, change: best ? best.at / wc - 1 : null };
  });
}

/** Mulberry32: a small seeded pseudo-random generator, so the Monte Carlo is repeatable. */
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

/**
 * Each normalised score moves by a uniform ±u (clamped to 0–1); the weights move by a uniform ±v (fraction). Returns
 * the share of n trials that each option wins.
 */
export function monteCarlo(s: number[][], w: number[], u: number, v: number, n = 4000, seed = 1) {
  const r = rng(seed), wins = new Array(s.length).fill(0);
  for (let k = 0; k < n; k++) {
    const ww = w.map((x) => Math.max(0, x * (1 + v * (2 * r() - 1))));
    const ss = s.map((row) => row.map((x) => Math.min(1, Math.max(0, x + u * (2 * r() - 1)))));
    wins[ranking(totals(ss, ww))[0]]++;
  }
  return wins.map((x) => x / n);
}
