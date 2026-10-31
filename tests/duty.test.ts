import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lifeCycle, reversals, rainflow, histogram, equivalent, parseSeries, drop, tauFor } from '../src/lib/duty.ts';

const close = (a: number, b: number, tol: number, msg?: string) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} ${a} vs ${b}`);

test('rainflow counting: the ASTM E1049 example', () => {
  assert.deepEqual(reversals([0, 1, 1, 2, 1, 1, 0, 3]), [0, 2, 0, 3]);
  const h = histogram(rainflow([-2, 1, -3, 5, -1, 3, -4, 4, -2]));
  assert.deepEqual(h.map((r) => [r.range, r.count]), [[9, 0.5], [8, 1], [6, 0.5], [4, 1.5], [3, 0.5]]);
  assert.deepEqual(parseSeries('0, 1;2\n 3  x'), [0, 1, 2, 3]);
});

test('worked example: the life of the case in equivalent MEOP cycles', () => {
  const ev = [{ name: 'Proof', level: 11, n: 1 }, { name: 'Leak checks', level: 0.7, n: 4 }, { name: 'Flight', level: 10, n: 1 }];
  const r3 = lifeCycle(ev, 10, 3);
  close(r3.total, 2.332, 0.001); close(r3.rows[0].share, 0.571, 0.001, 'the proof test is most of the damage'); assert.equal(r3.count, 6);
  close(r3.rows[1].eq, 0.00137, 0.00001, 'four leak checks are almost nothing');
  close(lifeCycle(ev, 10, 8).total, 3.144, 0.001, 'a steeper slope makes the proof count more');
});

test('worked example: rainflow of the pressure history', () => {
  const hist = [0, 11, 0, 0.7, 0, 0.7, 0, 0.7, 0, 0.7, 0, 10.4, 9.2, 10, 9.4, 10, 0];
  const c = rainflow(hist), h = histogram(c, 0.01);
  assert.deepEqual(h.map((r) => [+r.range.toFixed(2), r.count]), [[11, 1], [10.4, 1], [0.8, 1], [0.7, 4], [0.6, 1]]);
  close(equivalent(c, 10, 3), 2.458, 0.001, 'the ignition peak adds 0.125');
  close(c.reduce((a, k) => a + k.count, 0), 8, 1e-12);
});

test('worked example: the handling drop', () => {
  const d = drop({ h: 0.3, tau: 0.01, e: 0.5, mass: 137.81 });
  close(d.v, 2.426, 0.001); close(d.dv, 3.639, 0.001); close(d.g, 58.3, 0.05); close(d.F / 1000, 78.8, 0.05);
  close(tauFor(30, 0.3, 0.5) * 1000, 19.4, 0.05);
  const c = drop({ h: 0.3, tau: tauFor(30, 0.3, 0.5), e: 0.5, mass: 137.81 });
  close(c.g, 30, 1e-9); close(c.stroke * 1000, 15.0, 0.05);
});
