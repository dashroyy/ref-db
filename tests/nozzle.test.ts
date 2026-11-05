import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  areaRatio, machFromArea, pressureRatio, machFromPressure, throatPressureRatio, divergence, thrustCoefficient,
  optimumAreaRatio, expansionState, nozzlePoint, erodingThroat, nozzleLoads, heatRatio, throatHeatScaling,
} from '../src/lib/nozzle.ts';

const close = (a: number, b: number, tol: number, msg?: string) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} ${a} vs ${b}`);

test('isentropic relations invert on both branches', () => {
  close(areaRatio(1, 1.2), 1, 1e-12);
  for (const M of [0.2, 0.6, 1.5, 3, 5]) close(machFromArea(areaRatio(M, 1.25), 1.25, M > 1), M, 1e-9, `M ${M}`);
  for (const M of [0.5, 2, 4]) close(machFromPressure(pressureRatio(M, 1.2), 1.2), M, 1e-9);
  close(throatPressureRatio(1.4), 0.5283, 1e-4, 'the familiar 0.528 for air');
  close(divergence(15), 0.9830, 1e-4, 'a 15° cone keeps 98.3% of the momentum thrust');
});

test('thrust coefficient: the sonic exit, the infinite-expansion limit and the optimum', () => {
  // a sonic exit (ε = 1) in vacuum gives the throat momentum and pressure: (1 + γ)·p_t/p_c
  close(thrustCoefficient(1.2, 1, 10, 0).cfVac, 2.2 * throatPressureRatio(1.2), 1e-9);
  // γ = 1.2, ε = 10 in vacuum, by hand: M_e = 3.2783, p_e/p_c = 0.012541, C_F = 1.6171 + 0.1254 = 1.7425
  close(thrustCoefficient(1.2, 10, 10, 0).cfVac, 1.7425, 2e-4);
  // it rises with ε toward √(2γ²/(γ−1)·(2/(γ+1))^((γ+1)/(γ−1))) = 2.2467, and never reaches it
  const v = [10, 100, 1000, 1e5].map((e) => thrustCoefficient(1.2, e, 10, 0).cfVac);
  assert.ok(v.every((x, k) => k === 0 || x > v[k - 1]) && v[3] < 2.2467);
  // the optimum area ratio expands to ambient, and C_F at ambient is highest there
  const eo = optimumAreaRatio(1.2, 10, 0.101325), cf = (e: number) => thrustCoefficient(1.2, e, 10, 0.101325).cf;
  close(thrustCoefficient(1.2, eo, 10, 0.101325).pe, 0.101325, 1e-6);
  assert.ok(cf(eo) > cf(eo * 1.1) && cf(eo) > cf(eo / 1.1));
});

test('expansion states and the Summerfield separation screen', () => {
  assert.equal(expansionState(0.3, 0.1).state, 'under');
  assert.equal(expansionState(0.1, 0.1).state, 'optimum');
  assert.equal(expansionState(0.06, 0.1).state, 'over');
  assert.equal(expansionState(0.03, 0.1).state, 'separated');
  const p = nozzlePoint({ pc: 10, dt: 50, eps: 8, g: 1.2, pa: 0.101325, thetaDeg: 15, cStar: 1540 });
  // at the separation chamber pressure, the exit pressure is 0.4 of ambient
  close(nozzlePoint({ pc: p.pcSeparation, dt: 50, eps: 8, g: 1.2, pa: 0.101325 }).pe, 0.4 * 0.101325, 1e-9);
});

test('the 300 mm motor nozzle: performance at MEOP', () => {
  const p = nozzlePoint({ pc: 10, dt: 50, eps: 8, g: 1.2, pa: 0.101325, thetaDeg: 15, cStar: 1540 });
  close(p.Me, 3.122, 1e-3); close(p.pe, 0.1687, 1e-4);
  close(p.cf, 1.6053, 1e-4); close(p.cfVac, 1.6864, 1e-4);
  close(p.thrust / 1000, 31.52, 0.01); close(p.isp, 252.1, 0.1); close(p.massFlow, 12.75, 0.01);
  close(p.de, 141.4, 0.1); close(p.pcSeparation, 2.403, 0.001);
  assert.equal(p.exp.state, 'under');
});

test('loads: the joint carries the convergent load less the exit cone, and the test load is larger', () => {
  const L = nozzleLoads({ pc: 10, dt: 50, eps: 8, g: 1.2, pa: 0.101325, thetaDeg: 15, ds: 110 });
  close(L.joint, L.convergent - L.exitCone, 1e-6);
  close(L.test, L.joint + L.point.thrust, 1e-6);
  close(L.joint / 1000, 62.55, 0.01);
  close(L.exitCone / 1000, 7.34, 0.01);
  assert.ok(L.test > L.joint);
});

test('throat erosion: closed form, limits and the impulse', () => {
  const base = { pc: 10, dt: 50, eps: 8, g: 1.2, pa: 0.101325, thetaDeg: 15, n: 0.35, tb0: 10 };
  const none = erodingThroat({ ...base, e0: 0 });
  close(none.dEnd, 50, 1e-9); close(none.pEnd, 10, 1e-9); close(none.tb, 10, 1e-9); close(none.impulseRatio, 1, 1e-9);
  // with m = n the throat grows linearly with the web
  close(erodingThroat({ ...base, e0: 0.1, m: 0.35 }).dEnd, 52, 1e-9);
  // against a brute-force time integration
  let d = 50, t = 0;
  const N = 100000;
  for (let s = 0; s < N; s++) { const p = 10 * (50 / d) ** (2 / 0.65), dt = (10 * (10 / p) ** 0.35) / N; d += 2 * 0.1 * (p / 10) ** 0.8 * dt; t += dt; }
  const e = erodingThroat({ ...base, e0: 0.1 });
  close(e.dEnd, d, 1e-5); close(e.tb, t, 1e-4);
  close(e.pEnd, 10 * (50 / e.dEnd) ** (2 / 0.65), 1e-9);
  assert.ok(e.pDrop > 0.1 && e.stretch > 0 && e.impulseRatio < 1 && e.impulseRatio > 0.99, 'pressure falls, the burn stretches, the impulse barely moves');
});

test('heat transfer scales with the area ratio and the chamber pressure (Bartz)', () => {
  close(heatRatio(1), 1, 1e-12);
  close(heatRatio(4), 4 ** -0.9, 1e-12);
  close(throatHeatScaling(20, 50, 10, 50), 2 ** 0.8, 1e-12);
  assert.ok(throatHeatScaling(10, 25, 10, 50) > 1, 'a smaller throat has a higher heat-transfer coefficient');
});
