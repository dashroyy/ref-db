import { test } from 'node:test';
import assert from 'node:assert/strict';
import { syntheticFiring, EXAMPLE_FIRING, parseTrace, readTrace, reduceFiring, series, standFrequency, rampOvershoot, rss } from '../src/lib/firing.ts';

const close = (a: number, b: number, tol: number, msg?: string) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} ${a} vs ${b}`);

test('10% points and the tangent-bisector on a trace with a sharp corner', () => {
  const t: number[] = [], y: number[] = [];
  for (let k = 0; k <= 800; k++) { const tt = k / 100; t.push(tt); y.push(tt < 0.1 ? tt * 10 : tt < 5 ? 1 : Math.max(0, 1 - (tt - 5) * 2)); }
  const r = readTrace({ t, y });
  close(r.t0, 0.01, 1e-9, 'first 10% point');
  close(r.t1, 5.45, 1e-9, 'last 10% point');
  close(r.tWb, 5, 1e-6, 'a sharp corner is its own web burnout');
});

test('the synthetic firing reduces back to the c* and C_F that made it', () => {
  const s = syntheticFiring(EXAMPLE_FIRING);
  const r = reduceFiring(s.trace, { mp: s.mass, dPre: 45.65, dPost: s.dEnd, web: 100, de: 45.65 * Math.sqrt(8), g: 1.2, pa: 0.101325, thetaDeg: 15 });
  close(r.cStar / 1494, 1, 2e-3, 'c* from the mean throat area');
  close(r.etaCf, 0.935, 3e-3, 'C_F efficiency');
  close(r.check, 0, 1e-9, 'C_F·c*/g0 = Isp');
  assert.ok(r.read.burnTime < r.read.actionTime && r.read.burnTime > 0.9 * r.read.actionTime);
  close(r.burnRate / (4.05 * r.pBurn ** 0.35), 1, 0.02, 'the burn-rate law of the grain page, within the definition of burn time');
  assert.ok(s.dEnd > 45.65 && s.mass > 111 && s.mass < 120);
});

test('parsing a pasted trace', () => {
  const text = 't (s), p (MPa), F (kN)\n# comment\n' + Array.from({ length: 30 }, (_, k) => `${k * 0.1}\t${k < 25 ? 5 : 0}; ${k < 25 ? 10 : 0}`).join('\n');
  const p = parseTrace(text);
  assert.equal(p.trace.t.length, 30); assert.equal(p.skipped, 2); assert.ok(p.ok);
  assert.equal(parseTrace('0,1,1\n0,1,1\n' + '1,1,1\n'.repeat(30)).ok, false, 'time must increase');
});

test('the thrust stand and the uncertainty', () => {
  close(series(500, 300), 187.5, 1e-9);
  close(standFrequency(1, 1), 1e3 / (2 * Math.PI), 1e-9, '1 kN/mm and 1 kg');
  close(rampOvershoot(100, 0), 1, 1e-12, 'a step rings at its full size');
  close(rampOvershoot(100, 0.01), 0, 1e-9, 'a rise of exactly one period does not ring');
  assert.ok(rampOvershoot(160, 0.12) < 0.01);
  close(rss(0.3, 0.4), 0.5, 1e-12);
});
