import { test } from 'node:test';
import assert from 'node:assert/strict';
import { endLoad, shearAllow, pinBearingAllow, margins, lockRing, radialPins, threadedClosure } from '../src/lib/closures.ts';

const close = (a: number, b: number, tol: number, msg?: string) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} ${a} vs ${b}`);
const D6AC = { uts: 1520, yield: 1450 }, AL = { uts: 505, yield: 435 }, PH = { uts: 1070, yield: 1000 }, S4340 = { uts: 1280, yield: 1180 };
const F = { proof: 1.1, burst: 1.25, fitting: 1.15 };

test('end load and screening allowables', () => {
  close(endLoad(10, 300) / 1000, 706.86, 0.01, 'the 300 mm closure at MEOP');
  close(shearAllow(D6AC).u, 912, 1e-9); close(shearAllow(D6AC).y, 0.577 * 1450, 1e-9);
  close(pinBearingAllow(AL, 1.5).u, 1.5 * 505, 1e-9); close(pinBearingAllow(AL, 2).y, 1.7 * 435, 1e-9);
  close(pinBearingAllow(AL, 1.75).u, 1.7 * 505, 1e-9, 'linear between e/D = 1.5 and 2');
  close(pinBearingAllow(AL, 3).u, 1.9 * 505, 1e-9, 'held above e/D = 2');
});

test('no factors, no margins; with factors, the smallest margin governs', () => {
  const r = lockRing({ ds: 300, D: 300, t: 16.5, caseMat: D6AC, closureMat: AL, h: 5, g1: 2.5, g2: 2.5, L: 12, L2: 20, ringMat: PH });
  const none = margins(r.checks, 10, { proof: null, burst: 1.25, fitting: 1.15 });
  assert.equal(none.governing, null);
  assert.ok(none.rows.every((x) => x.msProof === null && x.msBurst === null && x.atMeop > 0));
  const m = margins(r.checks, 10, F);
  assert.equal(m.governing!.key, 'bk', 'the aluminium closure groove governs');
  close(m.ms!, 435 / (302.5 * 1.1 * 1.15) - 1, 2e-3);
});

test('lock ring: hand values for the 300 mm closure', () => {
  const r = lockRing({ ds: 300, D: 300, t: 16.5, caseMat: D6AC, closureMat: D6AC, h: 5, g1: 2.5, g2: 2.5, L: 12, L2: 20, ringMat: PH });
  const at = (k: string) => r.checks.find((c) => c.key === k)!.s * 10;
  close(at('ring'), 706858 / (Math.PI * 300 * 5), 0.05, 'ring shear = F/(π D h) = 150 MPa');
  close(at('bc'), 706858 / (Math.PI * 2.5 * 302.5), 0.05);
  close(at('lc'), 706858 / (Math.PI * 305 * 12), 0.05);
  assert.equal(margins(r.checks, 10, F).governing!.key, 'ring', 'with a steel closure the ring shear governs');
});

test('radial pins: shear, bearing, shear-out and the ligaments', () => {
  const r = radialPins({ ds: 300, D: 300, t: 16.5, caseMat: D6AC, closureMat: AL, n: 24, d: 10, e: 20, t2: 10, e2: 20, pinMat: S4340 });
  close(r.V * 10, 706858 / 24, 0.5, 'load per pin at MEOP');
  const at = (k: string) => r.checks.find((c) => c.key === k)!.s * 10;
  close(at('pin'), 706858 / 24 / (Math.PI * 25), 0.05);
  close(at('bk'), 706858 / 24 / 100, 0.05);
  close(at('sk'), 706858 / 24 / (2 * 15 * 10), 0.05);
  close(r.pitch, (Math.PI * 316.5) / 24, 1e-9);
  assert.equal(margins(r.checks, 10, F).governing!.key, 'pin');
  assert.equal(radialPins({ ds: 300, D: 300, t: 16.5, caseMat: D6AC, closureMat: AL, n: 120, d: 10, e: 20, t2: 10, e2: 20, pinMat: S4340 }).valid, false, 'holes that overlap');
});

test('threaded closure: basic stripping areas and the flank hoop load', () => {
  const r = threadedClosure({ ds: 296, dT: 300, t: 16.5, caseMat: D6AC, closureMat: AL, pitch: 2, Le: 20 });
  close(r.aInt, (7 / 8) * Math.PI * 300 * 20, 1e-3, 'internal: 7/8 of π d Le');
  close(r.aExt, 0.75 * Math.PI * (300 - 1.082532 * 2) * 20, 1e-2, 'external: 3/4 of π D1 Le');
  close(r.sFlank, (endLoad(1, 296) * Math.tan(Math.PI / 6)) / (2 * Math.PI * 20 * 16.5), 1e-9);
  close(r.threads, 10, 1e-12);
});
