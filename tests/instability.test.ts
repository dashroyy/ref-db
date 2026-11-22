import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  besselJ, besselJPrime, TRANSVERSE, soundSpeed, longitudinal, transverse, combined, modeMap, particleDamping, optimumDiameter,
} from '../src/lib/instability.ts';

const close = (a: number, b: number, tol: number, msg?: string) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} ${a} vs ${b}`);

test('Bessel functions and the roots of the transverse modes', () => {
  close(besselJ(0, 0), 1, 1e-9); close(besselJ(1, 0), 0, 1e-9);
  close(besselJ(0, 2.4048), 0, 1e-4, 'first zero of J0');
  for (const t of TRANSVERSE) close(besselJPrime(t.m, t.alpha), 0, 2e-4, `J'${t.m}(${t.alpha})`);
});

test('mode frequencies of the 300 mm motor', () => {
  close(soundSpeed(1.2, 3000, 0.025), 1094.2, 0.1);
  close(longitudinal(1, 1100, 1200), 458.33, 0.01, '1L = a/2L');
  close(transverse(1.8412, 1100, 100), 6446.8, 0.1, '1T at a 100 mm port: 1.8412 × 1100 / (π × 0.1)');
  close(transverse(1.8412, 1100, 300), 2148.9, 0.1, 'and at 300 mm');
  close(combined(0, 1.8412, 1100, 1200, 100), transverse(1.8412, 1100, 100), 1e-6, 'n = 0 is the pure transverse mode');
  close(combined(1, 0, 1100, 1200, 100), longitudinal(1, 1100, 1200), 1e-6, 'α = 0 is the pure longitudinal mode');
});

test('mode map: when each transverse mode is inside the response band', () => {
  const m = modeMap({ a: 1100, L: 1200, D0: 100, D1: 300, band: [1500, 3500] });
  const t1 = m.trans.find((t) => t.key === '1T')!;
  assert.ok(t1.w, '1T crosses the band');
  close(t1.w![0], (((1.8412 * 1100) / (Math.PI * 3500)) * 1000 - 100) / 200, 1e-9, 'it enters at 3.5 kHz');
  close(t1.w![1], 1, 1e-12, 'and stays to burnout');
  assert.equal(m.trans.find((t) => t.key === '2T')!.w, null, '2T stays above the band');
  assert.equal(m.longi.filter((l) => l.inBand).length, 0, 'the longitudinal modes are below it');
  close(m.freq(1.8412, 0.5), transverse(1.8412, 1100, 200), 1e-9);
});

test('particle damping: the optimum size and the peak', () => {
  const base = { f: 2000, rhoP: 3000, mu: 9e-5, g: 1.2, cmCp: 0, Pr: 0.6 };
  const dOpt = optimumDiameter(2000, 3000, 9e-5);
  const at = (d: number) => particleDamping({ ...base, dUm: d });
  close(at(dOpt).tv * 2 * Math.PI * 2000, 1, 1e-9, 'ωτ_v = 1 at the optimum');
  close(at(dOpt).viscous, (2 * Math.PI * 2000) / 4, 1e-6, 'the peak is ω/4 per unit loading');
  assert.ok(at(dOpt).viscous > at(dOpt / 3).viscous && at(dOpt).viscous > at(dOpt * 3).viscous);
  assert.ok(optimumDiameter(500, 3000, 9e-5) > optimumDiameter(5000, 3000, 9e-5), 'low frequencies need larger particles');
  assert.ok(particleDamping({ ...base, dUm: dOpt, cmCp: 0.7 }).thermal > 0);
});
