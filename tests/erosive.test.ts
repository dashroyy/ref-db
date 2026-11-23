import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  gammaFn, rt0, areaRatio, subsonicMach, constantPort, aftFlux, phi, machOfPhi, mukundaPaul, thresholdFlux,
  lenoirRobillard, lrAlpha, portFlow, section, gradientLoad, burn1D, MUKUNDA_PAUL, type Cell,
} from '../src/lib/erosive.ts';
import { equilibriumPressure } from '../src/lib/ballistics.ts';
import { burnBack, throatForPeak } from '../src/lib/grain.ts';

const close = (a: number, b: number, tol: number, msg?: string) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} ${a} vs ${b}`);
const PROP = { rhoP: 1770, a: 4.05, n: 0.35, cStar: 1540 };
const GAS = { gamma: 1.2, cStar: 1540, mu: 8.5e-5 };
const tube = (d: number, L: number, N = 48): Cell[] =>
  Array.from({ length: N }, () => ({ A: (Math.PI * d * d) / 4, P: Math.PI * d, dh: d }));
const At = (Dt: number) => (Math.PI * Dt * Dt) / 4;

test('gas dynamics of the port: the throat function, the area ratio and the closed-form Mach number', () => {
  close(gammaFn(1.2), 0.64853, 1e-5);
  close(Math.sqrt(rt0(1540, 1.2)) / gammaFn(1.2), 1540, 1e-9, 'c* = √(RT0)/Γ');
  for (const r of [1.05, 1.5, 2, 4, 10]) close(areaRatio(subsonicMach(r, 1.2), 1.2), r, 1e-9);
  for (const M of [0.01, 0.2, 0.5, 0.9, 1]) close(machOfPhi(phi(M, 1.2), 1.2), M, 1e-9);
  close(phi(1, 1.2), 1 / Math.sqrt(2 * 2.2), 1e-12, 'φ is largest at M = 1');
  assert.ok(Number.isNaN(machOfPhi(1.0001 / Math.sqrt(4.4), 1.2)), 'above the limit the port chokes');
  // a port as small as the throat chokes at its end: p falls by 1 + γ, and the stagnation pressure by 1.2418
  const c = constantPort(1, 1.2);
  close(c.M, 1, 0); close(c.staticDrop, 2.2, 1e-12); close(c.totalDrop, 2.2 / 1.1 ** 6, 1e-12);
  // port-to-throat 2: M = 0.312, 11.7% of static pressure and 5.4% of stagnation pressure lost along the port
  const d = constantPort(2, 1.2);
  close(d.M, 0.3122, 1e-4); close(d.staticDrop, 1.117, 1e-3); close(d.totalDrop, 1.0538, 1e-4);
  close(aftFlux(2.66, 1540, 5.70), 303.0, 0.1, 'the grain-page tube at ignition');
});

test('Mukunda–Paul: their Eq. 12, the threshold and the size effect', () => {
  // ρp·r0 = 10 kg/m²s and Re0 = 1000, so g = G/10
  const at = (G: number, d = 0.0085) => mukundaPaul(G, 1000, 0.01, d, 8.5e-5);
  close(at(1000).Re0, 1000, 1e-9);
  close(at(1000).eta, 1 + 0.023 * (100 ** 0.8 - 35 ** 0.8), 1e-12);
  close(at(1000).eta, 1.5203, 1e-4);
  assert.equal(at(350).eta, 1, 'no change at or below g = 35');
  close(thresholdFlux(1000, 0.01, 0.0085, 8.5e-5), 350, 1e-9);
  // a larger port lowers g by d^−0.125: the same flux erodes a large motor less
  close(at(1000, 0.017).g / at(1000).g, 2 ** -0.125, 1e-12);
  assert.ok(at(1000, 0.017).eta < at(1000).eta);
  // a slower propellant is more sensitive at the same flux
  assert.ok(mukundaPaul(1000, 1770, 0.005, 0.08, 8.5e-5).eta > mukundaPaul(1000, 1770, 0.010, 0.08, 8.5e-5).eta);
});

test('Lenoir–Robillard: the root, its limits, and the non-dimensional form of Mukunda and Paul (their Eq. 3)', () => {
  const alpha = lrAlpha(2000, 8.5e-5, 0.7, 1770, 1300, 3000, 1000, 300);
  close(alpha, 1.392e-5, 0.001e-5, 'α from the properties');
  const r0 = 0.008, G = 2273, d = 0.08, rhoP = 1770;
  const r = lenoirRobillard(r0, G, d, rhoP, alpha);
  close(r, r0 + alpha * G ** 0.8 * d ** -0.2 * Math.exp((-53 * rhoP * r) / G), 1e-15, 'r is the root');
  assert.ok(r > r0 && lenoirRobillard(r0, 3000, d, rhoP, alpha) > r, 'more flux, more rate');
  close(lenoirRobillard(r0, 1e-9, d, rhoP, alpha), r0, 1e-12, 'no flow, no erosive burning');
  // η = 1 + 0.0288·(cp/cs)·Re0^−0.2·Pr^−2/3·τf·g0^0.8·exp(−β·η/g0), with Re0 = ρp·r0·d/μ
  const eta = r / r0, g0 = G / (rhoP * r0), Re0 = (rhoP * r0 * d) / 8.5e-5, tf = (3000 - 1000) / (1000 - 300);
  close(eta, 1 + 0.0288 * (2000 / 1300) * Re0 ** -0.2 * 0.7 ** (-2 / 3) * tf * g0 ** 0.8 * Math.exp((-53 * eta) / g0), 1e-12);
});

test('the port at one instant: momentum, the throat condition and the mass balance', () => {
  const c = { cells: tube(80, 1800), length: 1800, prop: PROP, gas: GAS, law: null, At: At(58) };
  const f = portFlow(c);
  assert.ok(f.ok);
  // constant area, no friction: p + ρu² = p(1 + γM²) stays at the head-end pressure
  for (const q of f.points) close(q.p * (1 + 1.2 * q.M * q.M), f.pHead, 1e-9 * f.pHead);
  // the end of the port feeds the throat isentropically
  close(f.M, subsonicMach((80 * 80) / (58 * 58), 1.2), 1e-6);
  close(f.mdot, (f.p0 * 1e6 * At(58) * 1e-6) / 1540, 1e-9 * f.mdot, 'the throat passes what the grain makes');
  const made = f.rates.reduce((s, r) => s + 1770 * (r / 1000) * (Math.PI * 0.08) * (1.8 / 48), 0);
  close(made, f.mdot, 1e-9 * f.mdot);
  // the head end is above the uniform-pressure model, and the nozzle is close to it
  const p0D = equilibriumPressure({ ...PROP, kn: (Math.PI * 80 * 1800) / At(58) });
  assert.ok(f.pHead > 1.05 * p0D && Math.abs(f.p0 / p0D - 1) < 0.02);
  // a port much larger than the throat: the uniform-pressure model
  const big = portFlow({ ...c, cells: tube(80, 1800), At: At(10) });
  close(big.pHead / equilibriumPressure({ ...PROP, kn: (Math.PI * 80 * 1800) / At(10) }), 1, 0.003);
  assert.equal(portFlow({ ...c, At: At(81) }).ok, false, 'a throat larger than the port');
});

test('erosive burning in the port: where it starts, and what it does to the pressure', () => {
  const c = { cells: tube(80, 1800), length: 1800, prop: PROP, gas: GAS, law: MUKUNDA_PAUL, At: At(58) };
  const f = portFlow(c), dry = portFlow({ ...c, law: null });
  assert.ok(f.pHead > 1.1 * dry.pHead, 'erosive burning raises the head-end pressure');
  const etas = f.points.map((q) => q.eta);
  for (let i = 1; i < etas.length; i++) assert.ok(etas[i] >= etas[i - 1], 'η grows toward the nozzle');
  // it starts where the flux passes the threshold at the local rate
  const k = etas.findIndex((e) => e > 1);
  assert.ok(k > 0 && k < etas.length - 1);
  const q = f.points[k], r0 = (q.r / q.eta) / 1000;
  assert.ok(q.G > 0.95 * thresholdFlux(1770, r0, 0.08, 8.5e-5) && f.points[k - 2].G < thresholdFlux(1770, r0, 0.08, 8.5e-5));
  close(f.points[47].eta, 1.325, 0.005, 'at the nozzle end, at ignition');
});

test('the axial load of the port flow on the grain', () => {
  const sec = section(150, 1800, { kind: 'circular', d: 80 });
  const f = portFlow({ cells: tube(80, 1800, 96), length: 1800, prop: PROP, gas: GAS, law: null, At: At(58) });
  const g = gradientLoad(f, { caseArea: sec.caseArea, portArea: sec.A0, length: 1800, rhoP: 1770, od: 150 })!;
  const Ag = sec.caseArea - sec.A0;
  close(g.force, (Ag * (f.pHead - f.pAft)) / 1000, 1e-9, 'the force is the drop on the propellant section');
  close(g.tauAft, ((Ag / (2 * Math.PI * 75)) * g.grad) / 1000, 1e-12);
  // with no erosive burning, the drop grows nearly as x²: the gradient at the end is about twice the mean
  const ratio = g.gAft / g.gMean;
  assert.ok(ratio > 2 && ratio < 2.4, `${ratio}`);
  close(g.gMean, (f.pHead - f.pAft) / 1800 / ((1770 * 9.80665) / 1e9), 1e-9);
});

test('through the burn: mass, the uniform-pressure limit, and the aft end that burns through first', () => {
  const short = burn1D({ od: 150, length: 600, port: { kind: 'circular', d: 80 }, prop: PROP, gas: GAS, law: MUKUNDA_PAUL, throatD: 33.5 });
  assert.ok(short.ok);
  close(short.mass / short.propMass, 1, 0.005, 'the nozzle passes all the propellant');
  close(short.peak.p / short.peak0.p, 1, 0.01, 'the grain-page tube: the uniform-pressure model holds');
  close(short.touch.head / short.end0, 1, 0.005);
  assert.equal(short.trace[0].etaMax, 1, 'no erosive burning in the grain-page tube');
  const long = burn1D({ od: 150, length: 1800, port: { kind: 'circular', d: 80 }, prop: PROP, gas: GAS, law: MUKUNDA_PAUL, throatD: 58 });
  close(long.mass / long.propMass, 1, 0.005);
  close(long.start.pHead, 3.20, 0.01, 'the erosive hump at ignition');
  assert.ok(long.touch.aft < long.touch.head - 0.3, 'erosive burning takes the aft end to the case first');
  assert.ok(long.peak.p < long.peak0.p, 'the final peak is lower: the aft end has stopped burning');
  const dry = burn1D({ od: 150, length: 1800, port: { kind: 'circular', d: 80 }, prop: PROP, gas: GAS, law: null, throatD: 58 });
  assert.ok(dry.touch.aft > dry.touch.head, 'with no erosive burning the aft end, at a lower pressure, is last');
});

test('the worked example: the long tube and the star of the grain page', () => {
  // by hand at the nozzle end of the long tube, at the uniform-pressure 2.66 MPa
  const r0 = (4.05 * 2.66 ** 0.35) / 1000;
  close(thresholdFlux(1770, r0, 0.08, 8.5e-5), 468, 1);
  close(aftFlux(2.663, 1540, (80 * 80) / (58 * 58)), 909, 1);
  close(mukundaPaul(910, 1770, r0, 0.08, 8.5e-5).eta, 1.277, 0.002);
  // the star preset, its throat sized by the grain page for a 7 MPa peak
  const star = { kind: 'star', points: 7, tipD: 110, valleyD: 40 } as const;
  const Dt = throatForPeak(burnBack({ od: 150, length: 600, segments: 1, burningEnds: 0, port: star }), PROP, 7);
  close(Dt, 36.50, 0.01);
  const b = burn1D({ od: 150, length: 600, port: star, prop: PROP, gas: GAS, law: MUKUNDA_PAUL, throatD: Dt });
  close(b.peak0.p, 7.0, 0.01); close(b.start.p0D, 6.50, 0.01);
  close(b.sec.dh(0), 25.1, 0.1, 'the hydraulic diameter of the star');
  close(b.peak.p, 7.94, 0.02, 'the erosive peak at ignition');
  assert.equal(b.peak.t, 0);
  close(b.peak.p / b.peak0.p - 1, 0.134, 0.005, 'the allowance for the MEOP build-up');
});
