import { test } from 'node:test';
import assert from 'node:assert/strict';
import { beamOnSupports, bestOverhang, zickK1, zickK2, zickK6, cradleStresses, slings, halfSineResponse, shockSpectrum, drop } from '../src/lib/handling.ts';
import { drop as dutyDrop } from '../src/lib/duty.ts';

const close = (a: number, b: number, tol: number, msg?: string) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} ${a} vs ${b}`);
const rad = (d: number) => (d * Math.PI) / 180;
const CASE = { R: 150.69, t: 1.377, E: 205000, nu: 0.29 };

test("Zick's coefficients: the published values for 120° and 150° saddles", () => {
  close(zickK1(rad(120)), 0.107, 1e-3); close(zickK1(rad(150)), 0.161, 1e-3);
  close(zickK2(rad(120)), 1.171, 1e-3); close(zickK2(rad(150)), 0.799, 1e-3);
  close(zickK6(rad(120)), 0.0528, 2e-4); close(zickK6(rad(150)), 0.0317, 2e-4);
  // a wider saddle spreads the load: every coefficient improves from 120° to 150°
  assert.ok(zickK1(rad(150)) > zickK1(rad(120)) && zickK2(rad(150)) < zickK2(rad(120)) && zickK6(rad(150)) < zickK6(rad(120)));
});

test('K1 is the section modulus of the arc ±Δ from the top, over that of the full ring', () => {
  const theta = rad(120), D = Math.PI / 6 + (5 * theta) / 12, R = 1, t = 1e-3, N = 200000;
  let A = 0, Sy = 0;
  for (let i = 0; i < N; i++) { const p = -D + (2 * D * (i + 0.5)) / N; A += R * t * ((2 * D) / N); Sy += R * Math.cos(p) * R * t * ((2 * D) / N); }
  const yc = Sy / A;
  let I = 0;
  for (let i = 0; i < N; i++) { const p = -D + (2 * D * (i + 0.5)) / N; I += (R * Math.cos(p) - yc) ** 2 * R * t * ((2 * D) / N); }
  const c = yc - R * Math.cos(D); // to the ends of the arc
  close((I / c) / (Math.PI * R * R * t), zickK1(theta), 1e-6);
});

test('the motor as a beam: statics, and the support position that balances the moments', () => {
  const b = beamOnSupports({ mass: 137.8, L: 1150, A: 240, n: 3 });
  close(2 * b.Q, 137.8 * 9.80665 * 3, 1e-9, 'the supports carry the weight');
  // moment at midspan from the left half: the reaction at A from the end, less the load on half the length
  close(b.Mmid, b.Q * (575 - 240) - (b.w * 575 * 575) / 2, 1e-6);
  close(b.V, b.Q - b.w * 240, 1e-9);
  const best = beamOnSupports({ mass: 137.8, L: 1150, A: bestOverhang(1150), n: 3 });
  close(best.Msup, best.Mmid, 1e-6); close(bestOverhang(1000), 207.107, 1e-3);
});

test('the cradle of the 300 mm motor: hand values', () => {
  const beam = beamOnSupports({ mass: 137.8, L: 1150, A: 240, n: 3 });
  const s = cradleStresses(beam, { ...CASE, theta: 120, b: 50 }, 1150, 240);
  close(s.direct, beam.Q / (4 * 1.377 * (50 + 1.56 * Math.sqrt(150.69 * 1.377))), 1e-12);
  close(s.ring, (12 * s.K6 * beam.Q * 150.69) / (1150 * 1.377 ** 2), 1e-9, 'L < 8R: the short form');
  close(s.horn, 93.9, 0.1); close(s.saddle, 9.69, 0.01); close(s.shear, 6.66, 0.01);
  close(s.buckle, 734, 1, 'SP-8007 bending, with its knockdown');
  // the long form above 8R
  const long = cradleStresses(beam, { ...CASE, theta: 120, b: 50 }, 2000, 240);
  close(long.ring, (3 * long.K6 * beam.Q) / (2 * 1.377 ** 2), 1e-9);
  // the drop of the duty-cycle example: 58.3 g
  const d = beamOnSupports({ mass: 137.8, L: 1150, A: 240, n: 58.28 });
  assert.ok(cradleStresses(d, { ...CASE, theta: 120, b: 50 }, 1150, 240).horn > 1450, 'a narrow cradle yields the case');
  assert.ok(cradleStresses(d, { ...CASE, theta: 150, b: 100 }, 1150, 240).horn < 1450 / 1.1, 'a 150° cradle, 100 mm wide, does not');
});

test('slings', () => {
  const s = slings(1000, 60);
  close(s.tension * Math.sin(rad(60)), 1000, 1e-9); close(s.axial, 1000 / Math.tan(rad(60)), 1e-9);
  close(slings(1000, 90).axial, 0, 1e-9, 'vertical slings, or a spreader beam, push nothing into the motor');
});

test('the half-sine shock response spectrum: the classical shape', () => {
  const tau = 0.01;
  const sp = shockSpectrum(tau, 0, 2, 2000, 240), peak = sp.reduce((a, b) => (b.r > a.r ? b : a));
  close(peak.r, 1.77, 0.01, 'undamped peak'); close(peak.f * tau, 0.82, 0.03, 'near fn·τ = 0.8');
  close(halfSineResponse(2, tau, 0) / (4 * 2 * tau), 1, 0.01, 'low frequency: the velocity change, 4·fn·τ');
  close(halfSineResponse(5000, tau, 0), 1, 0.02, 'high frequency: the part follows the pulse');
  assert.ok(halfSineResponse(80, tau, 0.05) < halfSineResponse(80, tau, 0), 'damping lowers the peak');
});

test('the drop is the duty-cycle drop', () => {
  const a = drop({ h: 0.3, tau: 0.01, e: 0.5, mass: 137.8 }), b = dutyDrop({ h: 0.3, tau: 0.01, e: 0.5, mass: 137.8 });
  assert.deepEqual(a, b); close(a.g, 58.28, 0.01);
});
