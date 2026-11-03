import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gLimits, rLimits, nptLimits, sizes, taperAt } from '../src/lib/pipethreads.ts';

const near = (a: number, b: number, tol: number) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`);

test('G (BSPP) limits: ISO 228-1', () => {
  const g = gLimits('1', 'A')!;
  assert.deepEqual([g.ext.dmax, g.ext.dmin, g.ext.d2max, g.ext.d2min], [33.249, 32.889, 31.77, 31.59]);
  assert.equal(gLimits('1', 'B')!.ext.d2min, 31.41);
  near(g.int.D2max, 31.95, 0.0005); // published 31.770–31.950
  near(g.int.D1max, 30.932, 0.002); // published 30.292–30.932
  assert.equal(gLimits('1/4', 'A')!.tpi, 19);
  assert.equal(sizes('G').length, 18);
});

test('R (BSPT): gauge plane and its tolerances, ISO 7-1', () => {
  const r = rLimits('1/2')!;
  assert.deepEqual([r.d, r.a, r.aMin, r.aMax], [20.955, 8.2, 6.4, 10]);
  near(r.smallEnd, 20.955 - 8.2 / 16, 1e-9);
  near(r.t2, 1.25 * 1.814, 1e-9);
  assert.deepEqual([r.rp.D2min, r.rp.D2max], [19.651, 19.935]);
  assert.equal(rLimits('1/8')!.d, 9.728);
  near(taperAt(20.955, 16), 19.955, 1e-12);
});

test('NPT: ASME B1.20.1 formulas reproduce the published E1 and L2', () => {
  near(nptLimits('1/8')!.inch.E1, 0.3736, 0.00005);
  near(nptLimits('1/4')!.inch.E1, 0.49163, 0.00002);
  near(nptLimits('3/8')!.inch.E1, 0.62701, 0.00002);
  near(nptLimits('1/2')!.inch.E1, 0.77843, 0.00002);
  near(nptLimits('1')!.inch.E1, 1.23863, 0.00002);
  near(nptLimits('2')!.inch.E1, 2.29627, 0.00002);
  near(nptLimits('1/2')!.inch.L2, 0.5337, 0.0001);
  near(nptLimits('1/2')!.inch.K0, 0.7013, 0.0001); // basic minor diameter at the small end
  near(nptLimits('1/2')!.mm.E1, 0.77843 * 25.4, 0.001);
});
