import { test } from 'node:test';
import assert from 'node:assert/strict';
import { atoms, bonds, coordination, cellFacts, slipPlane, onSlipPlane, NN } from '../src/lib/crystal.ts';

test('cells hold the right atoms, and the bonds are at the nearest-neighbour distance', () => {
  assert.equal(atoms('bcc').length, 9); // 8 corners + 1 centre
  assert.equal(atoms('fcc').length, 14); // 8 corners + 6 faces
  assert.equal(atoms('hcp').length, 17); // 2 × 7 on the hexagons + 3 inside
  assert.equal(atoms('bcc', 2).length, 27 + 8);
  assert.equal(bonds('bcc', atoms('bcc')).length, 8); // centre to each corner
  assert.ok(Math.abs(NN('fcc') - Math.SQRT1_2) < 1e-12 && Math.abs(NN('bcc') - Math.sqrt(3) / 2) < 1e-12);
});

test('coordination numbers and packing factors', () => {
  assert.equal(coordination('bcc'), 8);
  assert.equal(coordination('fcc'), 12);
  assert.equal(coordination('hcp'), 12);
  assert.deepEqual([cellFacts('bcc').n, cellFacts('fcc').n, cellFacts('hcp').n], [2, 4, 6]);
  assert.ok(Math.abs(cellFacts('bcc').apf - 0.680) < 0.001);
  assert.ok(Math.abs(cellFacts('fcc').apf - 0.740) < 0.001);
  assert.ok(Math.abs(cellFacts('hcp').apf - 0.740) < 0.001);
});

test('slip planes pass through atoms: {111} holds 6 in the FCC cell, {110} holds 5 in BCC, basal holds 7', () => {
  assert.equal(atoms('fcc').filter((p) => onSlipPlane('fcc', p)).length, 6);
  assert.equal(atoms('bcc').filter((p) => onSlipPlane('bcc', p)).length, 5);
  assert.equal(atoms('hcp').filter((p) => onSlipPlane('hcp', p)).length, 7);
  assert.equal(slipPlane('hcp').length, 6);
});
