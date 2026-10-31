import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classify, fluidEnergy, fmea, sealPair, PV_ENERGY } from '../src/lib/risk.ts';

const close = (a: number, b: number, tol: number, msg?: string) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} ${a} vs ${b}`);
const rel = (a: number, b: number, r: number, msg?: string) => assert.ok(Math.abs(a / b - 1) <= r, `${msg ?? ''} ${a} vs ${b}`);

test('worked example: classifying the case and a bracket', () => {
  const caseA = classify({ cons: 'cat', failSafe: false, pressurised: true, p: 11, V: 85, medium: 'n2' });
  assert.equal(caseA.cls, 'A'); assert.ok(caseA.fracture); assert.deepEqual(caseA.pvWhy, ['stored energy', 'pressure']);
  rel(caseA.energy!.E, 1.742e6, 0.001, 'the proof-testing page: 1.7 MJ in nitrogen');
  const water = fluidEnergy(11, 85, 'water'); close(water.E, 2337.5, 0.1); assert.ok(water.E < PV_ENERGY);
  assert.deepEqual(classify({ cons: 'cat', failSafe: false, pressurised: true, p: 11, V: 85, medium: 'water' }).pvWhy, ['pressure'], 'still a pressure vessel by its pressure');
  const bracket = classify({ cons: 'marg', failSafe: false, pressurised: false });
  assert.equal(bracket.cls, 'C'); assert.ok(!bracket.fracture);
  assert.ok(!classify({ cons: 'cat', failSafe: true, pressurised: false }).fracture, 'a demonstrated fail-safe structure');
  assert.equal(classify({ cons: 'crit', failSafe: false, pressurised: false }).cls, 'B');
});

test('worked example: FMEA of the aft closure joint', () => {
  const rows = [
    { mode: 'Primary O-ring cut at assembly', s: 10, o: 4, d: 3 },
    { mode: 'Closure bolt preload low', s: 10, o: 3, d: 5 },
    { mode: 'Seal groove corrosion in storage', s: 8, o: 3, d: 6 },
    { mode: 'Insulation debond at the closure', s: 10, o: 2, d: 7 },
    { mode: 'Wrong O-ring compound', s: 10, o: 2, d: 4 },
  ];
  const f = fmea(rows, 100);
  assert.deepEqual(f.byRpn.map((r) => r.rpn), [150, 144, 140, 120, 80]);
  assert.equal(f.byRpn[1].s, 8, 'RPN puts a severity-8 mode above three severity-10 modes');
  assert.equal(f.act[f.act.length - 1].s, 8, 'acting by severity first moves it to the end');
  assert.equal(f.actions, 5); assert.equal(f.rows.filter((r) => r.over).length, 4);
  assert.ok(f.rows.find((r) => r.rpn === 80)!.sev, 'severity 10 needs action whatever its RPN');
});

test('worked example: two seals with and without a port', () => {
  const p = sealPair({ q: 1e-4, d: 1e-2, c: 0.99, beta: 0.05, port: true });
  rel(p.single, 2e-4, 1e-9); rel(p.pair, 1.0036e-5, 1e-4); close(p.gain, 19.9, 0.05);
  assert.ok(p.ccf > 100 * p.indep, 'common cause controls a tested pair');
  const n = sealPair({ q: 1e-4, d: 1e-2, c: 0.99, beta: 0.05, port: false });
  rel(n.pair, 5.97e-4, 0.001); close(n.gain, 0.335, 0.001, 'an untested pair is worse than one tested seal');
});
