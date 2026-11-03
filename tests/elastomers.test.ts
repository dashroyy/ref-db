import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ELASTOMERS, elastomer, POISONS, poisoning, pottingStress } from '../src/lib/elastomers.ts';

const near = (a: number, b: number, tol: number) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`);

test('the classes are complete and consistent', () => {
  for (const e of ELASTOMERS) {
    assert.ok(e.tmin < e.tmax && e.tensile[0] <= e.tensile[1] && e.cte > 0 && e.K > e.E, e.key);
    assert.ok(!/—/.test(e.use + e.watch), `${e.key} has an em dash`);
  }
  assert.ok(elastomer('si-add').surface < elastomer('pu-ether').surface, 'silicone wets nothing');
});

test('platinum poisoning: parts per million are enough', () => {
  const amine = POISONS.find((p) => p.key === 'amine')!;
  const a = poisoning(10, 5, amine.mw); // 10 ppm platinum, 5 ppm amine
  near(a.pt, 10 / 195.08, 1e-9);
  near(a.active, 1 - (5 / 112.2) / (10 / 195.08), 1e-9); // 13% active
  assert.equal(a.verdict, 'does not cure');
  near(a.matchPpm, 5.75, 0.01, ); // 5.75 ppm of amine matches 10 ppm of platinum
  assert.equal(poisoning(10, 0, amine.mw).active, 1);
  const tin = poisoning(10, 20, POISONS.find((p) => p.key === 'tin')!.mw);
  assert.equal(tin.verdict, 'tacky: a partial cure at the interface');
});

test('potting stress: soft when free, stiff when confined', () => {
  const si = elastomer('si-add'), ep = elastomer('epoxy');
  const s = pottingStress(si, 23.6e-6, 25, -40);
  near(s.free, (2 / 0.51) * (280e-6 - 23.6e-6) * 65, 1e-9); // about 0.07 MPa
  near(s.confined, 3 * 1000 * (280e-6 - 23.6e-6) * 65, 1e-9); // about 50 MPa of hydrostatic tension
  assert.ok(s.confined > 500 * s.free);
  const e = pottingStress(ep, 23.6e-6, 25, -40);
  assert.ok(e.free > 50 * s.free, 'epoxy loads the parts far more when free');
  assert.equal(pottingStress(elastomer('pu-pot'), 23.6e-6, 25, -60).belowTg, true);
});
