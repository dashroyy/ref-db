import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AS568, ring, ringsFor, ringAt, idTolFor, ringLimits, ringsForGroove, SECTIONS } from '../src/lib/oringdb.ts';

test('the AS568 library is complete', () => {
  assert.equal(AS568.length, 369);
  const counts = SECTIONS.map((cs) => ringsFor(cs).length);
  assert.deepEqual(counts, [47, 77, 84, 87, 51]); // -004..-050, -102..-178, -201..-284, -309..-395, -425..-475
  for (const r of AS568) {
    assert.ok(Math.abs(r.idIn * 25.4 - r.id) < 0.03 && Math.abs(r.idTolIn * 25.4 - r.idTol) < 0.03, r.dash);
    assert.ok(r.cs > 0 && r.csTol > 0, r.dash);
  }
});

test('sizes and tolerances are the AS568 values', () => {
  assert.deepEqual([ring('-222')!.idIn, ring('-222')!.idTolIn, ring('-222')!.csIn, ring('-222')!.csTolIn], [1.484, 0.015, 0.139, 0.004]);
  assert.deepEqual([ring('-010')!.id, ring('-010')!.idTol, ring('-010')!.cs, ring('-010')!.csTol], [6.07, 0.13, 1.78, 0.08]);
  assert.equal(ring('357')!.id, 139.07); assert.equal(ring('-357')!.idTol, 0.94);
  assert.equal(ring('-904')!.csIn, 0.072); // port-seal series
  assert.equal(ringAt(5.33, 139.29), undefined, '139.29 is -254, a 3.53 ring, not a 5.33 ring');
  assert.equal(ringAt(3.53, 139.29)!.dash, '-254');
  assert.equal(idTolFor(139.07), 0.94);
});

test('limits for a model at the extremes, and rings that fit a groove', () => {
  const l = ringLimits(ring('-357')!);
  assert.ok(Math.abs(l.idMin - 138.13) < 1e-9 && Math.abs(l.csMax - 5.46) < 1e-9);
  assert.ok(Math.abs(l.odMax - (140.01 + 2 * 5.46)) < 1e-9);
  assert.ok(l.volMin < l.volNom && l.volNom < l.volMax);
  const fits = ringsForGroove(5.33, 'piston', 141.5).map((x) => x.r.dash);
  assert.deepEqual(fits, ['-355', '-356', '-357']);
});

test('BS 4518 metric sizes: ID tolerance by size range, section tolerance by section', async () => {
  const { BS4518, ringsFor: rf, ring: rg, idTolFor: tol, bs4518IdTol } = await import('../src/lib/oringdb.ts');
  assert.equal(BS4518.length, 203);
  assert.deepEqual([1.6, 2.4, 3.0, 5.7, 8.4].map((cs) => rf(cs).length), [24, 43, 58, 59, 19]);
  const r = rg('0545-30')!;
  assert.deepEqual([r.id, r.idTol, r.cs, r.csTol, r.std], [54.5, 0.4, 3, 0.1, 'BS 4518']);
  const pairs: [number, number][] = [[3.1, 0.15], [10.1, 0.2], [19.5, 0.25], [44.3, 0.3], [54.5, 0.4], [99.5, 0.5], [149.1, 0.6], [209.3, 0.8], [289.3, 1.0], [359.3, 1.5], [459.3, 2.0]];
  for (const [id, t] of pairs) assert.equal(bs4518IdTol(id), t, String(id));
  assert.equal(rg('2493-57')!.csTol, 0.12);
  assert.equal(tol(53, 3.0), 0.4, 'a non-stock metric ID takes the BS 4518 range value');
  assert.equal(tol(139.07, 5.33), 0.94, 'a stock AS568 ID takes its own value');
});
