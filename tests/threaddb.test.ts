import { test } from 'node:test';
import assert from 'node:assert/strict';
import { THREAD_DB, threadSpec, extLimits, intLimits, r40, stressAreaMin, defaultClasses } from '../src/lib/threaddb.ts';

const near = (a: number, b: number, tol = 0.0006) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`);
const inch = (mm: number) => mm / 25.4;

test('the library holds the families, with unique keys', () => {
  const keys = THREAD_DB.map((t) => t.key);
  assert.equal(new Set(keys).size, keys.length);
  for (const k of ['M10', 'M10x1.25', 'M12x1.5', 'M60x1.5', 'MJ10x1.25', '1/4-28 UNF', '1/2-13 UNC', '3/8-24 UNJF', '#10-32 UNJF']) assert.ok(threadSpec(k), k);
  assert.ok(THREAD_DB.length > 140);
  assert.deepEqual(defaultClasses(threadSpec('MJ8x1')!), ['4h6h', '4H5H']);
});

test('ISO metric limits are the ISO 965-2 table values', () => {
  const m10 = threadSpec('M10')!, e = extLimits(m10, '6g')!, i = intLimits(m10, '6H')!;
  assert.deepEqual([e.dmax, e.dmin, e.d2max, e.d2min], [9.968, 9.732, 8.994, 8.862]);
  assert.deepEqual([i.D1min, i.D1max, i.D2min, i.D2max], [8.376, 8.676, 9.026, 9.206]);
  const m36 = extLimits(threadSpec('M36')!, '6g')!;
  assert.equal(m36.dmin, 35.465); // the formula would give 35.490: the table governs
  near(threadSpec('M10')!.As, 57.99, 0.01); // ISO 898-1: 58.0 mm²
  assert.ok(stressAreaMin(e) < threadSpec('M10')!.As);
  const h = extLimits(threadSpec('M6')!, '4h6h')!;
  assert.deepEqual([h.dmax, h.dmin, h.d2max, h.d2min], [6, 5.82, 5.35, 5.279]);
});

test('MJ: 4h6h external with the controlled root radius, 4H5H internal', () => {
  const t = threadSpec('MJ6x1')!, e = extLimits(t, '4h6h')!, i = intLimits(t, '4H5H')!;
  assert.deepEqual([e.d2max, e.d2min], [5.35, 5.279]);
  near(e.d3max, 5.35 - 0.866025 + 2 * 0.18042, 0.001);
  near(e.d3min, 5.279 - 0.866025 + 2 * 0.15011, 0.001);
  assert.deepEqual([i.D2min, i.D2max, i.D1min, i.D1max], [5.35, 5.445, 5.026, 5.216]);
  assert.equal(i.source, 'computed');
  assert.equal(r40(94.5), 95); assert.equal(r40(188.8), 190); assert.equal(r40(174.2), 180); assert.equal(r40(171.9), 170);
});

test('unified limits follow ASME B1.1', () => {
  const a = extLimits(threadSpec('1/4-20 UNC')!, '2A')!;
  near(inch(a.dmax), 0.2489); near(inch(a.dmin), 0.2408); near(inch(a.d2max), 0.2164); near(inch(a.d2min), 0.2127);
  const a3 = extLimits(threadSpec('1/4-20 UNC')!, '3A')!;
  near(inch(a3.dmax), 0.25); near(inch(a3.d2max), 0.2175); near(inch(a3.d2min), 0.2147);
  const b = intLimits(threadSpec('1/4-20 UNC')!, '2B')!;
  near(inch(b.D2min), 0.2175); near(inch(b.D2max), 0.2224); near(inch(b.D1min), 0.1959); near(inch(b.D1max), 0.2074);
  const h = extLimits(threadSpec('1/2-13 UNC')!, '2A')!;
  near(inch(h.dmax), 0.4985); near(inch(h.dmin), 0.4876); near(inch(h.d2max), 0.4485); near(inch(h.d2min), 0.4435);
  const hb = intLimits(threadSpec('1/2-13 UNC')!, '2B')!;
  near(inch(hb.D2max), 0.4565); near(inch(hb.D1max), 0.4336);
  const f = extLimits(threadSpec('1/4-28 UNF')!, '2A')!;
  near(inch(f.dmax), 0.249); near(inch(f.dmin), 0.2425); near(inch(f.d2max), 0.2258); near(inch(f.d2min), 0.2225);
  near(inch(intLimits(threadSpec('7/8-14 UNF')!, '2B')!.D1max), 0.8135);
  near(inch(intLimits(threadSpec('#0-80 UNF')!, '2B')!.D1max), 0.0514);
  near(inch(intLimits(threadSpec('#4-40 UNC')!, '2B')!.D1max), 0.0939);
  near(inch(intLimits(threadSpec('#10-32 UNF')!, '2B')!.D1max), 0.1641);
  near(threadSpec('1/4-20 UNC')!.As / 645.16, 0.0318, 0.0001); // ASME: 0.0318 in²
});

test('UNJ: larger internal minor diameter, controlled external root', () => {
  const t = threadSpec('3/8-24 UNJF')!, P = 1 / 24;
  near(inch(intLimits(t, '3B')!.D1min), 0.375 - 0.974279 * P, 0.0001);
  const e = extLimits(t, '3A')!;
  near(e.rootR[0] / 25.4, 0.15011 * P, 1e-6);
  assert.ok(e.d3min < e.d3max);
});
