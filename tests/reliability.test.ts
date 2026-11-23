import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  phi, phiInv, cdfFailures, lowerBound, trialsNeeded, interference, factorForBeta, betaFor, series, allocate,
  acceptance, defectiveAt,
} from '../src/lib/reliability.ts';
import { podLowerBound, minTrials } from '../src/lib/ndt.ts';

const close = (a: number, b: number, tol: number, msg?: string) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} ${a} vs ${b}`);
const rel = (a: number, b: number, tol: number, msg?: string) => close(a / b, 1, tol, msg);

test('the normal distribution, far into the tails', () => {
  close(phi(0), 0.5, 1e-7); close(phi(1.959964), 0.975, 1e-7); rel(phi(-3), 0.0013498980, 1e-6);
  rel(phi(-6), 9.8658765e-10, 1e-6, 'six sigma'); rel(phi(-10), 7.6198530e-24, 1e-6, 'ten sigma');
  close(phiInv(0.975), 1.959964, 1e-6); close(phiInv(1e-9), -5.997807, 1e-5); close(phiInv(0.5), 0, 1e-7);
  for (const b of [0.5, 2, 3.02, 4.75, 7]) close(betaFor(phi(-b)), b, 1e-6, 'β round trip');
});

test('pass/fail tests: the success run and the binomial bound', () => {
  close(cdfFailures(10, 0, 0.9), 0.9 ** 10, 1e-12); close(cdfFailures(3, 1, 0.5), 0.5, 1e-12); assert.equal(cdfFailures(5, 5, 0.3), 1);
  close(lowerBound(10, 0, 0.9), 0.1 ** 0.1, 1e-12, 'ten successes: 79% at 90%');
  // the table of the page: firings with no failure for 90, 99 and 99.9% at 50, 90 and 95% confidence
  assert.deepEqual([0.9, 0.99, 0.999].map((R) => [0.5, 0.9, 0.95].map((C) => trialsNeeded(R, C))), [[7, 22, 29], [69, 230, 299], [693, 2302, 2995]]);
  assert.deepEqual([0.9, 0.99].map((R) => [0.5, 0.9, 0.95].map((C) => trialsNeeded(R, C, 1))), [[17, 38, 46], [168, 388, 473]]);
  // a failure costs more than it seems: each count is the least that passes
  for (const [R, C, f] of [[0.99, 0.9, 1], [0.9, 0.95, 2], [0.999, 0.9, 1]] as const) {
    const n = trialsNeeded(R, C, f);
    assert.ok(lowerBound(n, f, C) >= R && lowerBound(n - 1, f, C) < R, `${R} at ${C} with ${f}`);
  }
  // the same statistics as the 29-of-29 demonstration of the NDT page
  assert.equal(trialsNeeded(0.9, 0.95), 29); assert.equal(trialsNeeded(0.9, 0.95, 1), minTrials(0.9, 0.95, 1));
  close(lowerBound(29, 1, 0.95), podLowerBound(29, 28, 0.95), 1e-9);
});

test('stress–strength interference and the reliability index', () => {
  const nrm = interference(100, 0.1, 150, 0.1, 'normal');
  close(nrm.beta, 50 / Math.hypot(15, 10), 1e-12); close(nrm.pf, phi(-nrm.beta), 1e-15);
  // lognormal with equal scatters: the medians keep the ratio of the means
  const ln = interference(1, 0.1, 1.5, 0.1);
  close(ln.beta, Math.log(1.5) / (Math.SQRT2 * Math.sqrt(Math.log(1.01))), 1e-12);
  for (const d of ['normal', 'lognormal'] as const) {
    const k = factorForBeta(3.5, 0.08, 0.15, d);
    close(interference(1, 0.08, k, 0.15, d).beta, 3.5, 1e-9, `${d} round trip`);
  }
  assert.equal(factorForBeta(6, 0.05, 0.2, 'normal'), Infinity, 'a normal capability with a large scatter cannot reach a high β');
  // more scatter, less reliability at the same central factor
  assert.ok(interference(1, 0.1, 1.5, 0.2).pf > 10 * interference(1, 0.1, 1.5, 0.1).pf);
});

test('the motor as a chain, and lot acceptance', () => {
  close(series(Array(8).fill(allocate(0.99, 8))), 0.99, 1e-12);
  close(acceptance(2, 0, 0.05), 0.9025, 1e-12);
  close(defectiveAt(2, 0, 0.1), 1 - Math.sqrt(0.1), 1e-9, 'two firings reject a lot only when most of it is bad');
  close(acceptance(10, 1, defectiveAt(10, 1, 0.5)), 0.5, 1e-9);
});

test('the worked example: the 300 mm motor programme', () => {
  close(lowerBound(12, 0, 0.9), 0.8254, 0.0001, 'twelve clean firings');
  assert.equal(trialsNeeded(0.99, 0.9), 230); assert.equal(trialsNeeded(0.99, 0.9, 1), 388);
  const each = allocate(0.99, 8);
  close(each, 0.998744, 0.000001); close(betaFor(1 - each), 3.02, 0.005);
  const burst = interference(9.53, 0.017, 13.5, 0.03);
  assert.ok(burst.beta > 10 && burst.pf < 1e-20, 'the case does not fail by burst');
  const bond = interference(1, 0.1, 1.5, 0.2);
  close(bond.beta, 1.76, 0.005); close(1 / bond.pf, 25.6, 0.1, 'about one bond in 26');
  close(factorForBeta(betaFor(1 - each), 0.1, 0.2), 1.98, 0.005, 'the factor that the allocation needs');
  close(factorForBeta(betaFor(1 - each), 0.1, 0.1), 1.53, 0.005, 'or half the scatter');
  close(defectiveAt(2, 0, 0.95), 0.0253, 0.0001); close(defectiveAt(2, 0, 0.1), 0.6838, 0.0001);
});
