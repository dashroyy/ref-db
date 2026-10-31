import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalise, scoreMatrix, totals, ranking, tieWeight, sensitivity, monteCarlo, rng, type Criterion } from '../src/lib/trade.ts';

const close = (a: number, b: number, tol: number, msg?: string) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} ${a} vs ${b}`);

// the case-material shortlist: D6AC, maraging 250, Ti-6Al-4V ELI, filament-wound carbon/epoxy
const crit: Criterion[] = [
  { name: 'Mass index', dir: 'max', weight: 30, values: [185, 211, 187, 350] },
  { name: 'Damage tolerance', dir: 'max', weight: 25, values: [2, 3, 5, 2] },
  { name: 'Cost', dir: 'min', weight: 20, values: [1, 3, 4, 3.5] },
  { name: 'Heritage', dir: 'max', weight: 15, values: [5, 4, 3, 4] },
  { name: 'Supply risk', dir: 'min', weight: 10, values: [2, 4, 4, 3] },
];
const w = crit.map((c) => c.weight);

test('normalisation and totals', () => {
  assert.deepEqual(normalise([1, 2, 3], 'max'), [0, 0.5, 1]); assert.deepEqual(normalise([1, 2, 3], 'min'), [1, 0.5, 0]); assert.deepEqual(normalise([2, 2], 'max'), [1, 1]);
  const s = scoreMatrix(crit); close(s[1][0], 26 / 165, 1e-12);
  const t = totals(s, w); close(t[0], 45.0, 0.01); close(t[3], 45.83, 0.01); close(t[1], 27.23, 0.01); close(t[2], 25.36, 0.01);
  assert.deepEqual(ranking(t), [3, 0, 1, 2], 'carbon/epoxy first by 0.8 points');
});

test('worked example: sensitivity of the leader', () => {
  const s = scoreMatrix(crit);
  close(tieWeight(s, w, 0, 3, 0)!, 29.17, 0.01, 'mass weight 30 → 29.2 makes D6AC tie');
  const sens = sensitivity(s, w);
  close(sens[0].change!, -0.028, 0.001); close(sens[2].tie!.at, 21, 1e-9, 'cost weight 20 → 21'); assert.equal(sens[2].tie!.other, 0);
  close(sens[1].tie!.at, 45.47, 0.01, 'damage tolerance must nearly double for titanium to tie'); assert.equal(sens[1].tie!.other, 2);
  assert.equal(tieWeight([[1, 1], [0, 0]], [1, 1], 0, 0, 1), null, 'a dominant option never ties');
});

test('worked example: Monte Carlo and the effect of adding an option', () => {
  const s = scoreMatrix(crit);
  const p = monteCarlo(s, w, 0.15, 0.3, 4000, 1);
  close(p[3], 0.507, 0.001); close(p[0], 0.4925, 0.001); close(p.reduce((a, b) => a + b, 0), 1, 1e-12);
  assert.deepEqual(monteCarlo(s, w, 0, 0, 10, 1), [0, 0, 0, 1]);
  const r1 = rng(5), r2 = rng(5); assert.equal(r1(), r2(), 'seeded: repeatable');
  // add 4130: heavier, cheaper, well known; it wins the sum and swaps the order of the other two
  const c5 = crit.map((c, k) => ({ ...c, values: [...c.values, [130, 4, 0.8, 5, 1][k]] }));
  const t5 = totals(scoreMatrix(c5), w);
  assert.deepEqual(ranking(t5), [4, 0, 3, 1, 2]); close(t5[4], 61.67, 0.01); close(t5[0], 47.92, 0.01); close(t5[3], 43.96, 0.01);
});
