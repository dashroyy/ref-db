import { test } from 'node:test';
import assert from 'node:assert/strict';
import { strainRate, logReducedRate, fitCapability, regressionK, capabilityAt, allowable } from '../src/lib/proptests.ts';
import { toleranceFactor } from '../src/lib/allowables.ts';

const close = (a: number, b: number, tol: number, msg?: string) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} ${a} vs ${b}`);
const SHIFT = { Ts: -20, C1: 8.86, C2: 101.6, Leff: 68.5 };
// the illustrative characterisation of the worked example: temperature, crosshead speed, strain at maximum stress
const TESTS = [[74, 0.5, 27.2], [49, 5, 32.6], [21, 50, 40.3], [21, 500, 40.8], [-18, 50, 44.5], [-40, 50, 42.9], [-40, 500, 43.2], [-54, 500, 35.5]];
const L = TESTS.map(([T, r]) => logReducedRate(strainRate(r, SHIFT.Leff), T, SHIFT));
const FIT = fitCapability(L, TESTS.map((t) => t[2]))!;

test('the rate of a test, and its reduced rate', () => {
  close(strainRate(50, 68.5), 50 / 60 / 68.5, 1e-15);
  close(logReducedRate(0.01, -20, SHIFT), -2, 1e-12, 'at the reference temperature the rate is its own');
  close(logReducedRate(1, -40, SHIFT), 2.1716, 1e-4, 'a_T ≈ 148 at −40 °C, as on the Propellant page');
  assert.ok(logReducedRate(1, 60, SHIFT) < 0, 'hot looks slow');
});

test('the quadratic fit: exact on clean data, and the hat matrix', () => {
  const xs = [-6, -4, -2, 0, 1, 3], f = (x: number) => 40 + 0.8 * x - 0.3 * x * x;
  const fit = fitCapability(xs, xs.map(f))!;
  for (const x of [-7, -1.3, 2.2]) close(fit.predict(x), f(x), 1e-9);
  close(fit.s, 0, 1e-6); close(fit.peak!.L, 0.8 / 0.6, 1e-9, 'the peak of the curve');
  // the leverages of the data points add up to the number of coefficients
  close(xs.reduce((s, x) => s + fit.leverage(x), 0), 3, 1e-9);
  assert.equal(fitCapability([1, 2, 3], [1, 2, 3]), null, 'three tests are not enough');
  assert.equal(fitCapability([1, 1, 2, 2], [1, 2, 3, 4]), null, 'nor are two rates');
});

test('the regression tolerance factor: a plain sample is the handbook factor, and it grows away from the data', () => {
  for (const n of [8, 10]) for (const p of [0.9, 0.99]) close(regressionK(n - 1, 1 / n, p), toleranceFactor(n, p), 1e-9);
  close(toleranceFactor(10, 0.9), 2.355, 0.01, 'the B-basis factor for ten values');
  assert.ok(regressionK(5, 0.4, 0.9) > regressionK(5, 0.2, 0.9) && regressionK(5, 0.2, 0.9) > regressionK(5, 0.15, 0.9));
});

test('the worked example: the capability of the 300 mm grain at a cold ignition', () => {
  close(FIT.s, 1.146, 0.001); close(FIT.peak!.em, 43.93, 0.01);
  const Lign = logReducedRate(2, -40, SHIFT);
  close(Lign, 2.473, 0.001);
  const c = capabilityAt(FIT, Lign, 0.9);
  close(c.mean, 39.34, 0.01, 'near the 39.6% of the grain page'); close(c.k, 3.364, 0.002); close(c.lower, 35.48, 0.01);
  assert.ok(c.inside);
  close(c.mean / (1.5 * 16.1) - 1, 0.629, 0.001, 'on the mean, the margin of the grain page');
  const a = allowable(c.lower, { biaxial: 0.85, ageing: 0.75, pressure: 1 }, 16.1, 1.5);
  close(a.allow, 22.62, 0.01); close(a.ms, -0.063, 0.001);
  close(allowable(c.lower, { biaxial: 0.85, ageing: 0.75, pressure: 1.1 }, 16.1, 1.5).ms, 0.030, 0.001, 'with a pressure credit');
  // the cool-down to −40 °C in storage, over eight hours
  const cool = capabilityAt(FIT, logReducedRate(0.104 / 28800, -40, SHIFT), 0.9);
  close(allowable(cool.lower, { biaxial: 0.85, ageing: 0.75, pressure: 1 }, 10.4, 1.5).ms, 0.581, 0.001);
  assert.equal(capabilityAt(FIT, 6, 0.9).inside, false, 'past the fastest test');
});
