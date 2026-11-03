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
