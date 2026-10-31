import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lint, lintAll, method, cross, transfer, boltPattern, budget } from '../src/lib/reqs.ts';

const close = (a: number, b: number, tol: number, msg?: string) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} ${a} vs ${b}`);
const problems = (s: string) => lint(s).issues.map((i) => i.problem);

test('requirement wording', () => {
  assert.deepEqual(problems('The bracket shall have a mass of 0.2 kg or less.'), []);
  assert.ok(problems('The finish shall be adequate.').includes('No threshold'));
  assert.ok(problems('The seal shall be tested and the bolts shall be torqued to 60 N·m.').includes('More than one requirement'));
  assert.ok(problems('The case will hold 10 MPa.').includes('No binding verb'));
  assert.ok(problems('The case shall withstand TBD MPa.').includes('Open item'));
  assert.ok(!problems('The case shall withstand TBD MPa.').includes('No value'), 'a TBD is already flagged');
  assert.equal(method('The thread shall be M10 × 1.5 6g.'), 'Inspection'); assert.equal(method('The closure shall be removable in 10 minutes.'), 'Demonstration');
});

test('worked example: the nozzle ICD requirements', () => {
  const r = lintAll(`1. The nozzle shall be suitable for the motor environment.
2. The nozzle-to-closure joint shall not leak more than 1e-5 std cm³/s of helium at 700 kPa gauge.
3. The nozzle mass should be minimised.
4. The interface bolts and/or pins shall be supplied by the nozzle team as required.
5. The throat insert shall withstand a peak chamber pressure of TBD MPa.
6. The nozzle shall have a mass of 6.0 kg or less.`);
  assert.equal(r.length, 6);
  assert.deepEqual(r.map((x) => x.issues.filter((i) => i.level === 'bad').length), [1, 0, 2, 2, 0, 0]);
  assert.deepEqual(r.map((x) => x.method), ['Analysis', 'Test', 'Test', 'Analysis', 'Test or analysis', 'Test']);
});

test('worked example: nozzle loads at the interface plane', () => {
  assert.deepEqual(cross([1, 0, 0], [0, 1, 0]), [0, 0, 1]);
  // the ICD gives 65.6 kN axial and 15 g × 6 kg lateral at a point 120 mm aft of the interface plane
  const t = transfer([65.6, 0.883, 0], [0, 0, 0], [120, 0, 0], [0, 0, 0]);
  close(t.M[2], 105.96, 1e-9, 'kN·mm = N·m'); close(t.M[1], 0, 0);
  const b = boltPattern(t.F, t.M, 12, 150);
  close(b.axial, 5.467, 0.001); close(b.bend, 0.2355, 0.0001); close(b.max, 5.702, 0.001); close(b.increase, 0.043, 0.001);
  close(boltPattern([0, 0, 0], [0, 100, 0], 8, 100).bend, 0.5, 1e-12);
});

test('worked example: the inert mass budget', () => {
  const r = budget([{ name: 'Case', value: 11.77, growth: 0.05 }, { name: 'Insulation', value: 4.84, growth: 0.15 }, { name: 'Nozzle', value: 6, growth: 0.15 }, { name: 'Other hardware', value: 4, growth: 0.25 }], 30, 1.5);
  close(r.current, 26.61, 1e-9, 'the hardware page'); close(r.predicted, 29.82, 0.01); close(r.marginNow, 1.89, 1e-9); close(r.margin, -1.32, 0.01);
  close(r.growth, 3.21, 0.01);
});
