// Duty cycle: the events in the life of the hardware as equivalent cycles at a reference level, rainflow counting of
// a load history (ASTM E1049), and the shock of a drop onto a cushion or the floor.
// Units: any consistent load unit for cycles; m, s, kg, N and g for the drop.

export const G = 9.80665;

/** A load event: level (same unit as the reference), number of cycles from zero to that level. */
export interface LifeEvent { name: string; level: number; n: number }

/**
 * Equivalent cycles at the reference level, for an S–N slope m: Σ n·(level/ref)^m. Each event is a cycle from zero to
 * its level, so its range is its level.
 */
export function lifeCycle(events: LifeEvent[], ref: number, m: number) {
  const rows = events.filter((e) => e.n > 0 && e.level > 0).map((e) => ({ ...e, eq: e.n * (e.level / ref) ** m }));
  const total = rows.reduce((a, r) => a + r.eq, 0);
  return { rows: rows.map((r) => ({ ...r, share: r.eq / total })), total, count: rows.reduce((a, r) => a + r.n, 0) };
}

/** Peaks and valleys of a series: repeated values and points that are not turning points are removed. */
export function reversals(x: number[]) {
  const y = x.filter((v, i) => i === 0 || v !== x[i - 1]);
  if (y.length < 3) return y;
  const out = [y[0]];
  for (let i = 1; i < y.length - 1; i++) if ((y[i] - y[i - 1]) * (y[i + 1] - y[i]) < 0) out.push(y[i]);
  out.push(y[y.length - 1]);
  return out;
}

export interface Cycle { range: number; mean: number; count: number }
/** Rainflow counting to ASTM E1049 (three-point method). Half cycles have count 0.5. */
export function rainflow(x: number[]): Cycle[] {
  const out: Cycle[] = [], s: number[] = [];
  const add = (a: number, b: number, count: number) => out.push({ range: Math.abs(a - b), mean: (a + b) / 2, count });
  for (const r of reversals(x)) {
    s.push(r);
    while (s.length >= 3) {
      const X = Math.abs(s[s.length - 1] - s[s.length - 2]), Y = Math.abs(s[s.length - 2] - s[s.length - 3]);
      if (X < Y) break;
      if (s.length === 3) { add(s[0], s[1], 0.5); s.shift(); }
      else { add(s[s.length - 3], s[s.length - 2], 1); s.splice(s.length - 3, 2); }
    }
  }
  for (let i = 0; i < s.length - 1; i++) add(s[i], s[i + 1], 0.5);
  return out;
}

/** Cycles grouped by range (rounded to `step`), largest first. */
export function histogram(c: Cycle[], step = 1e-9) {
  const m = new Map<number, number>();
  for (const k of c) { const r = Math.round(k.range / step) * step; m.set(r, (m.get(r) ?? 0) + k.count); }
  return [...m.entries()].map(([range, count]) => ({ range, count })).sort((a, b) => b.range - a.range);
}

/** Equivalent full cycles at reference range `ref` for slope m: Σ count·(range/ref)^m. */
export const equivalent = (c: Cycle[], ref: number, m: number) => c.reduce((a, k) => a + k.count * (k.range / ref) ** m, 0);

/** Parse a list of numbers separated by commas, spaces or new lines. */
export const parseSeries = (s: string) => s.split(/[\s,;]+/).filter((t) => t !== '').map(Number).filter((v) => Number.isFinite(v));

/**
 * A drop from height h onto a surface, with a half-sine pulse of duration tau and a coefficient of restitution e:
 * impact speed √(2gh), velocity change (1 + e)·v, peak acceleration π·Δv/(2τ). The stroke is for a linear cushion.
 */
export function drop(i: { h: number; tau: number; e: number; mass: number }) {
  const v = Math.sqrt(2 * G * i.h), dv = (1 + i.e) * v, A = (Math.PI * dv) / (2 * i.tau);
  return { v, dv, A, g: A / G, F: i.mass * A, stroke: (v * i.tau) / Math.PI };
}
/** The pulse duration that keeps the peak at gLimit (g). */
export const tauFor = (gLimit: number, h: number, e: number) => (Math.PI * (1 + e) * Math.sqrt(2 * G * h)) / (2 * gLimit * G);
