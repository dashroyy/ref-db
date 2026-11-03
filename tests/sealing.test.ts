import { test } from 'node:test';
import assert from 'node:assert/strict';
import { radialGrowth, squeezeAtPressure, seatWallFor, faceSealGap, detectableLeak, holdTimeFor, thermalPressureShift } from '../src/lib/sealing.ts';

const close = (a: number, b: number, tol: number, msg?: string) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} ${a} vs ${b}`);

test('radial growth matches the hoop strain of the case-sizing example', () => {
  // 300 mm D6AC case, 1.37 mm wall, 10 MPa: hoop 1094 MPa, axial 547 MPa
  close(radialGrowth(10, 150, 1.37, 205000), (150 * (1094 - 0.3 * 547)) / 205000, 0.002);
  close(radialGrowth(10, 150, 1.37, 205000, 0.3, false) / radialGrowth(10, 150, 1.37, 205000), 1 / 0.85, 1e-12);
});

test('worked example: a bore seal in the plain cylinder unloads; a thick seat keeps it', () => {
  const ring = 5.33, sMin = 0.107, mate = 0.02; // O-ring page: cold corner after compression set
  assert.ok(squeezeAtPressure(ring, sMin, radialGrowth(10, 150, 1.37, 205000) - mate) < 0);
  close(squeezeAtPressure(ring, sMin, radialGrowth(10, 150, 10, 205000) - mate), 0.093, 0.001);
  const t = seatWallFor(10, 150, 205000, 0.3, ring, sMin, 0.10, mate);
  close(t, 16.3, 0.05);
  close(squeezeAtPressure(ring, sMin, radialGrowth(10, 150, t, 205000) - mate), 0.10, 1e-9);
  assert.equal(seatWallFor(10, 150, 205000, 0.3, ring, 0.09, 0.10), Infinity);
});

test('a face seal stays shut until the bolted joint separates', () => {
  assert.equal(faceSealGap(17700, 32100, 361600), 0);
  close(faceSealGap(40000, 32100, 361600), 7900 / 361600, 1e-12);
});

test('leak check: sensitivity, hold time, and the temperature drift that mimics a leak', () => {
  close(detectableLeak(2, 0.1, 600), 3.29e-6, 0.01e-6);
  close(holdTimeFor(2, 0.1, detectableLeak(2, 0.1, 600)), 600, 1e-9);
  const shift = thermalPressureShift(801.325, 0.1);
  close(shift, 0.273, 0.001);
  assert.ok(shift > 2 * 0.1, 'a tenth of a degree outweighs the gauge resolution');
});
