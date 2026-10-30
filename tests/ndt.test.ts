import { test } from 'node:test';
import assert from 'node:assert/strict';
import { screen, growthCycles, normCdf, pod, a50, missChance, binomTail, podLowerBound, minTrials, METHODS } from '../src/lib/ndt.ts';
import { surfaceK } from '../src/lib/lbb.ts';

const close = (a: number, b: number, tol: number, msg?: string) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} ${a} vs ${b}`);

const d6ac = { sigma: 1094, t: 1.377, kic: 70, ac: 0.4, rangeFraction: 1, C: 1.35e-10, m: 2.25, mat: 'ferro' as const, embedded: false, serviceCycles: 2, lifeFactor: 4 };

test('worked example: methods against the critical flaw of the D6AC case', () => {
  const s = screen(d6ac);
  close(s.aCrit, 0.877, 0.002); assert.equal(s.through, false); assert.equal(s.required, 8);
  close(surfaceK(1094, s.aCrit, s.aCrit / 0.4, 1.377).KA, 70, 0.01, 'K at the critical depth is the toughness');
  const row = (k: string) => s.rows.find((r) => r.key === k)!;
  assert.ok(row('et').ok && row('pt').ok && row('ut').ok);
  assert.ok(!row('mt').ok && !row('rt').ok, 'MT and RT cannot find a flaw smaller than critical here');
  close(row('pt').life, 165, 2); close(row('et').life, 309, 3); close(row('ut').life, 70, 1);
  assert.ok(row('et').life > row('pt').life && row('pt').life > row('ut').life, 'a smaller missed flaw buys more life');
  assert.equal(screen({ ...d6ac, lifeFactor: null }).required, null);
  const emb = screen({ ...d6ac, embedded: true });
  assert.deepEqual(emb.rows.filter((r) => r.usable).map((r) => r.key), ['ut', 'rt'], 'only volumetric methods find embedded flaws');
  assert.ok(!screen({ ...d6ac, mat: 'al' }).rows.find((r) => r.key === 'mt')!.usable, 'MT needs a ferromagnetic material');
  assert.ok(METHODS.every((m) => m.mats.length > 0));
});

test('crack growth integral', () => {
  close(growthCycles(0.5, 0.8, 0.4, 1.377, 1094, 1.35e-10, 2.25), growthCycles(0.5, 0.6, 0.4, 1.377, 1094, 1.35e-10, 2.25) + growthCycles(0.6, 0.8, 0.4, 1.377, 1094, 1.35e-10, 2.25), 0.01, 'additive');
  assert.equal(growthCycles(0.8, 0.5, 0.4, 1.377, 1094, 1.35e-10, 2.25), 0);
  const half = growthCycles(0.5, 0.8, 0.4, 1.377, 547, 1.35e-10, 2.25), full = growthCycles(0.5, 0.8, 0.4, 1.377, 1094, 1.35e-10, 2.25);
  close(half / full, 2 ** 2.25, 1e-6, 'life scales as the stress range to the power -m');
});

test('probability of detection curve', () => {
  close(normCdf(0), 0.5, 1e-7); close(normCdf(1.959964), 0.975, 1e-6); close(normCdf(-1), 0.158655, 1e-6);
  close(pod(0.76, 0.76, 0.4), 0.9, 1e-6, 'POD is 90% at a90'); close(pod(a50(0.76, 0.4), 0.76, 0.4), 0.5, 1e-6);
  close(pod(0.877, 0.76, 0.4), 0.949, 0.001);
  const one = missChance(0.877, 0.76, 0.4, 20, 1), two = missChance(0.877, 0.76, 0.4, 20, 2);
  close(one.anyMissed, 0.646, 0.001); close(two.anyMissed, 0.050, 0.001);
});

test('demonstration: 29 of 29, 45 of 46, 59 of 61', () => {
  close(binomTail(10, 0, 0.3), 1, 1e-12); close(binomTail(4, 4, 0.5), 1 / 16, 1e-12); close(binomTail(3, 2, 0.5), 0.5, 1e-12);
  close(podLowerBound(29, 29, 0.95), 0.9019, 1e-4); close(podLowerBound(29, 28, 0.95), 0.8466, 1e-4);
  assert.ok(podLowerBound(28, 28, 0.95) < 0.9);
  assert.equal(minTrials(0.9, 0.95, 0), 29); assert.equal(minTrials(0.9, 0.95, 1), 46); assert.equal(minTrials(0.9, 0.95, 2), 61);
  close(binomTail(46, 45, podLowerBound(46, 45, 0.95)), 0.05, 1e-6, 'the bound is where the tail equals 1 − confidence');
});
