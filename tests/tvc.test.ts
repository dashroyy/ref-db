import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compressionModulus, blowOff, padStiffness, bearingGeometry, bearing, torqueBudget, authority } from '../src/lib/tvc.ts';

const close = (a: number, b: number, tol: number, msg?: string) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} ${a} vs ${b}`);
const RAD = Math.PI / 180;
const FIRST = { ri: 55, ro: 85, R: 130, n: 12, te: 1.4, ts: 1.0 };
const SECOND = { ri: 55, ro: 85, R: 130, n: 16, te: 1.05, ts: 0.8 };
const LOAD = { pc: 10, pa: 0.101, F: 31500, G: 0.6, K: 2000, delta: 5 };

test('compression modulus of a bonded pad: the long-strip limits', () => {
  close(compressionModulus(0.6, 0), 2.4, 1e-12, 'no bonding effect: 4G, the plane-strain modulus');
  close(compressionModulus(0.6, 10), 4 * 0.6 * 101, 1e-9, 'incompressible: 4G(1 + S²)');
  close(compressionModulus(0.6, 10, 2000), 1 / (1 / 242.4 + 1 / 2000), 1e-9, 'the bulk modulus in series');
});

test('blow-off load: the same momentum balance as the nozzle page', () => {
  close(blowOff(10, 0.101, 55, 31520) / 1000, 62.55, 0.01, 'the 110 mm nozzle seal of the nozzle example');
  close(blowOff(10, 0.101, 70, 0) / 1000, 152.38, 0.01, 'a pressure test has no thrust to relieve it');
});

test('pad stiffness: the closed form against a direct integration over the band', () => {
  const g = bearingGeometry(FIRST);
  const G = 0.6, R = 130, te = 1.4, N = 300;
  let sum = 0;
  for (let i = 0; i < N; i++) {
    const th = g.t1 + ((g.t2 - g.t1) * (i + 0.5)) / N;
    for (let j = 0; j < N; j++) {
      const ps = (2 * Math.PI * (j + 0.5)) / N;
      // shear stress G·R·φ·√(…)/t, times the moment arm R·√(…), over dA = R² sinθ dθ dψ, per unit φ
      sum += ((G * R * R) / te) * (1 - Math.sin(th) ** 2 * Math.cos(ps) ** 2) * R * R * Math.sin(th) * ((g.t2 - g.t1) / N) * ((2 * Math.PI) / N);
    }
  }
  close(padStiffness(G, R, te, g.c1, g.c2) / sum, 1, 1e-5);
  // a thin band: k ≈ G·A·R²·(1 + cos²θ)/(2t), with A the band area
  const c = Math.cos(0.5), dc = 1e-4, A = 2 * Math.PI * R * R * dc;
  close(padStiffness(G, R, te, c + dc / 2, c - dc / 2) / ((G * A * R * R * (1 + c * c)) / (2 * te)), 1, 1e-6);
});

test('geometry of the stack', () => {
  const g = bearingGeometry(FIRST);
  close(g.H, 12 * 1.4 + 11 * 1.0, 1e-12);
  close(g.radii[0], 130 - 27.8 / 2 + 0.7, 1e-9, 'the pad nearest the pivot');
  close(g.radii[11] - g.radii[0], 11 * 2.4, 1e-9);
  close(Math.sin(g.t1) * 130, 55, 1e-9); close(Math.sin(g.t2) * 130, 85, 1e-9);
  assert.equal(bearingGeometry({ ...FIRST, ro: 140 }).valid, false, 'the band must lie on the sphere');
  assert.equal(bearingGeometry({ ...FIRST, n: 60 }).valid, false, 'a stack taller than its radius');
});

test('the bearing pad by pad: hand values for the first try', () => {
  const b = bearing(FIRST, LOAD);
  close(b.Fax / 1000, 120.88, 0.01, 'blow-off in firing');
  close(b.Ftest / 1000, 152.38, 0.01, 'and in a pressure test');
  // the uniform normal pressure over the middle band gives back the axial load: σ·π(ro² − ri²)
  const mid = bearing({ ...FIRST, n: 1, ts: 0 }, LOAD);
  close(mid.pads[0].sigma * Math.PI * (85 ** 2 - 55 ** 2), mid.Fax, 1e-6);
  // the innermost pad works hardest
  const p0 = b.pads[0];
  assert.ok(b.pads.every((p) => p.sigma <= p0.sigma && p.gamma <= p0.gamma));
  close(p0.sigma, b.Fax / (Math.PI * (85 ** 2 - 55 ** 2) * (p0.R / 130) ** 2), 1e-9);
  close(p0.gammaC, (1.5 * p0.S * p0.sigma) / (0.6 * (1 + p0.S ** 2)), 1e-12, 'bulge strain 1.5Sσ/(G(1+S²))');
  close(b.gammaC, 2.432, 1e-3); close(b.gammaR, 0.894, 1e-3); close(b.gamma, 3.326, 1e-3);
  // the rotations of the pads add up to the vector angle
  close(b.pads.reduce((a, p) => a + p.phi, 0), 5 * RAD, 1e-12);
  // with every pad at the middle radius, the rotation strain is R·δ/(n·te)
  const flat = bearing({ ...FIRST, ts: 0, te: 1e-3, n: 1 }, LOAD);
  close(flat.gammaR, (130 * 5 * RAD) / 1e-3, 1e-6);
  close(b.Kdeg, 135.87, 0.01, 'N·m per degree');
  close(b.shimMax, 0.75 * (b.pads[0].sigma + b.pads[1].sigma) * 1.4, 1e-9, 'bulge of both faces');
});

test('thinner pads: the same rubber in more layers cuts the bulge strain, not the stiffness', () => {
  const a = bearing(FIRST, LOAD), b = bearing(SECOND, LOAD);
  assert.ok(b.Smin > a.Smin * 1.3, 'shape factor up by about 4/3');
  close(b.gamma, 2.769, 1e-3);
  assert.ok(b.gammaC < 0.8 * a.gammaC && b.axial < 0.7 * a.axial);
  close(b.Kdeg / a.Kdeg, 1, 0.01, 'the stiffness follows the total rubber thickness');
  // cold rubber: twice the modulus, twice the torque, half the bulge strain, the same rotation strain
  const c = bearing(SECOND, { ...LOAD, G: 1.2 });
  close(c.Kdeg / b.Kdeg, 2, 1e-9); close(c.gammaR, b.gammaR, 1e-12); close(c.gammaC / b.gammaC, 0.5, 1e-9);
});

test('torque budget and the actuator', () => {
  const b = bearing(SECOND, { ...LOAD, G: 1.2 });
  const t = torqueBudget({ K: b.K, delta: 5, Fax: bearing(SECOND, LOAD).Fax, e: 4, m: 9, d: 110, I: 0.16, acc: 10, amp: 1, freq: 6, friction: 50, arm: 150, slew: 30 });
  close(t.spring, b.K * 5 * RAD, 1e-9);
  close(t.offset, 120883.27 * 0.004 * Math.sin(5 * RAD), 0.01);
  close(t.accel, 9 * 9.80665 * 10 * 0.11 * Math.sin(5 * RAD), 1e-9);
  close(t.alpha, RAD * (12 * Math.PI) ** 2, 1e-9, '1° at 6 Hz');
  close(t.total, t.spring + t.offset + t.accel + 50 + t.inertia, 1e-9);
  close(t.force, t.total / 0.15, 1e-9); close(t.force, 9733, 1);
  close(t.stroke, 300 * Math.sin(5 * RAD), 1e-9); close(t.rate, 150 * 30 * RAD, 1e-9);
  close(t.power, (t.force * t.rate) / 1000, 1e-9);
  assert.ok(t.stable);
  // a centre of pressure far forward of the pivot pushes the nozzle out: the actuator must hold it
  const u = torqueBudget({ K: 100, delta: 5, Fax: 1e5, e: -20, m: 0, d: 0, I: 0, acc: 0, amp: 0, freq: 0, friction: 0, arm: 100, slew: 0 });
  assert.equal(u.stable, false);
  close(u.total, Math.abs(100 * 5 * RAD - 2000 * Math.sin(5 * RAD)), 1e-9);
});

test('steering authority and the trim for misalignment', () => {
  const a = authority({ F: 31500, delta: 5, L: 700, dm: 0.45, ycg: 1 });
  close(a.side, 31500 * Math.sin(5 * RAD), 1e-9);
  close(a.moment, a.side * 0.7, 1e-9);
  close(a.lossPct, 0.3805, 1e-4);
  close(a.trim, Math.asin(1.45 / 700) / RAD, 1e-12); close(a.trim, 0.1187, 1e-4);
  close(a.disturb, 31.5 * 1.45, 1e-9, 'N·m');
  assert.ok(Number.isNaN(authority({ F: 1, delta: 5, L: 10, dm: 20, ycg: 0 }).trim), 'an offset beyond the lever arm');
});
