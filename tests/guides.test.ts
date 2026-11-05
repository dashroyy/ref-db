import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  bendAllowance, outsideSetback, bendDeduction, flatLength, bendChecks, BEND_CLASSES,
  springRate, springIndex, stressFactor, shearStress, solidLength, minGaps, bucklingDeflection, springCheck, SPRING_MATERIALS,
  lapOmega, lapShear, lapCapacity, usefulOverlap, ADHESIVES,
} from '../src/lib/guides.ts';

const near = (a: number, b: number, tol: number, msg?: string) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} ${a} vs ${b}`);

test('sheet metal: bend allowance, setback, deduction and the flat length', () => {
  const b = { t: 1.5, R: 2, angle: 90, K: 0.38 };
  near(bendAllowance(b), (Math.PI / 2) * (2 + 0.38 * 1.5), 1e-12);
  near(outsideSetback(b), 3.5, 1e-12, 'tan 45° = 1');
  near(bendDeduction(b), 2.963, 0.001);
  near(flatLength([25, 40, 25], b), 84.07, 0.01, 'worked example: the U-bracket');
  assert.equal(flatLength([50], b), 50, 'no bend, no deduction');
  // a 180° hem has no virtual sharp: the formula is for bends below 180°; at 0° nothing is deducted
  near(bendDeduction({ ...b, angle: 0 }), 0, 1e-12);
  const c = bendChecks(b, [25, 40, 25], BEND_CLASSES[0]);
  assert.equal(c.radius, 'ok'); assert.equal(c.flange, 'ok'); near(c.flangeMin, 8, 1e-12); near(c.holeMin, 5.75, 1e-12);
  assert.equal(bendChecks({ ...b, R: 1.5 }, [25, 40, 25], BEND_CLASSES[2]).radius, 'bad', 'R = t is too tight for 6082-T6');
  assert.equal(bendChecks(b, [6, 40, 25], BEND_CLASSES[0]).flange, 'bad', 'a 6 mm flange will not clear the die');
});

test('springs: EN 13906-1 rate, stress, solid length and gaps', () => {
  const s = { d: 1, D: 8, n: 8, L0: 25, G: 81500, E: 206000, ends: 'ground' as const };
  near(springRate(s), 81500 / (8 * 512 * 8), 1e-12);
  assert.equal(springIndex(s), 8);
  near(stressFactor(8), 8.5 / 7.25, 1e-12);
  near(shearStress(s, 24.87), 594, 1, 'k·8FD/πd³');
  assert.equal(solidLength(s), 10, 'ground ends: n_t·d');
  assert.equal(solidLength({ ...s, ends: 'closed' }), 11.5, 'unground: (n_t + 1.5)·d');
  near(minGaps(s), 1.568, 1e-9);
  const r = springCheck(s, 20, 15, 0.5);
  near(r.F1, 12.44, 0.01); near(r.F2, 24.87, 0.01); assert.equal(r.clear, true); assert.equal(r.buckles, false); assert.equal(r.indexOk, true);
  assert.equal(bucklingDeflection(s, 0.5), Infinity, 'short and stubby: cannot buckle');
  const tall = { ...s, L0: 60 };
  assert.ok(bucklingDeflection(tall, 0.5) > bucklingDeflection(tall, 2), 'a free end buckles sooner');
  assert.equal(springCheck(tall, 50, 30, 2).buckles, true);
  assert.equal(springCheck(s, 20, 11, 0.5).clear, false, 'too close to solid');
  for (const m of SPRING_MATERIALS) assert.ok(m.G > 0 && m.E > m.G, m.key);
});

test('bonded laps: the Volkersen shear, against the closed form for equal adherends', () => {
  const j = { E1: 73000, t1: 2, E2: 73000, t2: 2, b: 25, L: 25, Ga: 800, ta: 0.15 };
  const w = lapOmega(j), P = 1000, s = lapShear(j, P);
  near(s.max, ((P * w) / (2 * j.b)) / Math.tanh((w * j.L) / 2), 1e-9, 'τmax = (Pω/2b)·coth(ωL/2)');
  let sum = 0; const n = 4000; for (let i = 0; i < n; i++) sum += s.tau(((i + 0.5) * j.L) / n) * j.b * (j.L / n);
  near(sum, P, 0.01, 'the adhesive carries the whole load');
  near(s.tau(0), s.tau(j.L), 1e-9, 'symmetric when balanced');
  const c = lapCapacity(j, 35);
  near(c.P, 6459, 2, 'worked example: elastic capacity'); near(c.naive, 21875, 1e-9); near(c.ratio, 3.39, 0.01);
  assert.ok(lapCapacity({ ...j, L: 50 }, 35).P < c.P * 1.01, 'doubling the overlap adds almost nothing');
  assert.ok(lapCapacity({ ...j, b: 50 }, 35).P > c.P * 1.99, 'doubling the width doubles it');
  near(usefulOverlap(j), 3.66 / w, 1e-12);
  const u = lapShear({ ...j, t2: 1 }, P);
  assert.ok(Math.abs(u.tau(j.L)) > Math.abs(u.tau(0)), 'unequal adherends: the peak moves to one end');
  for (const a of ADHESIVES) assert.ok(a.G > 0 && a.tau > 0 && a.ta > 0, a.key);
});
