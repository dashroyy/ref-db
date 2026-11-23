import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  combine, asPart, shellCylinder, tube, domeShell, discLessCircle, grainAt, webOf, throughBurn, trimAngle, weighTwo,
  flip180, filar, filarPeriod, compound, filarMotor, G0, type Part, type Grain,
} from '../src/lib/massprops.ts';

const close = (a: number, b: number, tol: number, msg?: string) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} ${a} vs ${b}`);

// the 300 mm motor of the worked example
const cylM = 2 * Math.PI * 150.69 * 1.377 * 1000 * 7.85e-6, domeM = (11.77 - cylM) / 2;
const dc = domeShell(150.69, 75), di = domeShell(146, 71);
const CASE = asPart('case and insulation', [
  { m: cylM, x: 575, ...shellCylinder(150.69, 1000) },
  { m: domeM, x: 75 - dc.c, kr: dc.kr, kp: dc.kp }, { m: domeM, x: 1075 + dc.c, kr: dc.kr, kp: dc.kp },
  { m: 2.07, x: 575, ...shellCylinder(149, 1000) },
  { m: 1.385, x: 75 - di.c, kr: di.kr, kp: di.kp }, { m: 1.385, x: 1075 + di.c, kr: di.kr, kp: di.kp },
]);
const INERT: Part[] = [CASE, { m: 6, x: 1170, kr: 45, kp: 70 }, { m: 2, x: 60, kr: 100, kp: 60 }, { m: 2, x: 1110, kr: 120, kp: 60 }];
const PAYLOAD: Part[] = [{ m: 50, x: -120, kr: 106, kp: 138 }];
const GRAIN: Grain = { kind: 'radial', R: 150, a0: 50, L: 1000, x0: 75, rho: 1770, e: 0.5 };

test('the table: moments of the masses and the parallel-axis theorem', () => {
  const c = combine([{ m: 1, x: 0, kr: 0, kp: 0 }, { m: 3, x: 1000, kr: 0, kp: 0 }]);
  close(c.m, 4, 0); close(c.x, 750, 1e-9);
  close(c.Ip, (1 * 750 ** 2 + 3 * 250 ** 2) * 1e-6, 1e-12, 'two point masses');
  const one = combine([{ m: 2, x: 100, kr: 50, kp: 80 }]);
  close(one.Ir, 2 * 50 * 50 * 1e-6, 1e-12); close(one.Ip, 2 * 80 * 80 * 1e-6, 1e-12);
  // a group as one line keeps the inertia about the group's own centre of gravity
  const parts: Part[] = [{ m: 1, x: 0, kr: 10, kp: 20 }, { m: 1, x: 200, kr: 10, kp: 20 }, { m: 5, x: 900, kr: 40, kp: 30 }];
  const g = asPart('g', parts.slice(0, 2));
  close(combine([g, parts[2]]).Ip, combine(parts).Ip, 1e-12);
});

test('shapes: a hemisphere, a flat dome, a shell and a tube', () => {
  const h = domeShell(100, 100);
  close(h.c, 50, 1e-3, 'the CG of a hemispherical shell is at R/2'); close(h.kr ** 2, (2 / 3) * 1e4, 0.5); close(h.kp ** 2, (5 / 12) * 1e4, 0.5);
  close(h.area, 2 * Math.PI * 1e4, 1);
  const flat = domeShell(100, 1e-6);
  close(flat.kr ** 2, 1e4 / 2, 0.5, 'a flat dome is a disc'); close(flat.kp ** 2, 1e4 / 4, 0.5);
  const e = domeShell(150, 75);
  assert.ok(e.c < 75 / 2 + 5 && e.c > 0, 'a 2:1 head: its CG is near its base');
  close(shellCylinder(100, 600).kp ** 2, 5000 + 30000, 1e-9);
  close(tube(50, 150, 1000).kr ** 2, (2500 + 22500) / 2, 1e-9); close(tube(0, 150, 0).kp ** 2, 22500 / 4, 1e-9);
});

test('a disc less an offset circle: exact against a fine grid, and continuous', () => {
  const R = 1, e = 0.3;
  for (const a of [0.5, 0.85, 1.0, 1.2]) {
    const s = discLessCircle(R, a, e), N = 1200, h = (2 * R) / N;
    let A = 0, M = 0;
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
      const x = -R + (i + 0.5) * h, y = -R + (j + 0.5) * h;
      if (x * x + y * y <= R * R && (x - e) ** 2 + y * y > a * a) { A += h * h; M += h * h * x; }
    }
    close(s.area, A, 0.003, `area at a = ${a}`); close(s.mom, M, 0.002, `moment at a = ${a}`);
  }
  // continuous where the circle first touches the disc (the arc falls away as a square root), and nothing left once it covers it
  const t = discLessCircle(150, 149.5, 0.5), u = discLessCircle(150, 149.5 + 1e-12, 0.5);
  close(t.area, u.area, 1e-4); close(t.mom, u.mom, 1e-3); close(t.arc, u.arc, 0.01);
  assert.equal(discLessCircle(150, 150.5, 0.5).area, 0);
  close(discLessCircle(150, 50, 0).area, Math.PI * (150 ** 2 - 50 ** 2), 1e-9);
  close(discLessCircle(150, 50, -0.5).mom, -discLessCircle(150, 50, 0.5).mom, 1e-9, 'the sign follows the offset');
});

test('the grain: radial and end burning', () => {
  const g0 = grainAt({ ...GRAIN, e: 0 }, 0);
  close(g0.m, Math.PI * (0.15 ** 2 - 0.05 ** 2) * 1.0 * 1770, 1e-9, '111.2 kg, as on the hardware page');
  close(g0.x, 575, 0); close(g0.y!, 0, 0);
  close(grainAt({ ...GRAIN, e: 0 }, 60).x, 575, 0, 'a tube with inhibited ends keeps its CG at its middle');
  assert.deepEqual(webOf(GRAIN), { web: 99.5, burnout: 100.5 });
  const end: Grain = { kind: 'end', R: 150, a0: 0, L: 1000, x0: 75, rho: 1770, e: 0 };
  close(grainAt(end, 400).x, 75 + 300, 1e-9, 'an end burner: the CG moves to the head end');
  close(grainAt(end, 1000).m, 0, 1e-12);
});

test('the worked example: the 300 mm motor and its payload through the burn', () => {
  const b = throughBurn(INERT, GRAIN, { payload: PAYLOAD });
  close(b.ignition.motor.m, 137.82, 0.01); close(b.ignition.motor.x, 601.2, 0.1);
  const v0 = b.ignition.vehicle!, v1 = b.end.vehicle!;
  close(1110 - v0.x, 700.8, 0.1, 'the 700 mm arm of the TVC and tolerance-stack pages');
  close(b.end.motor.m, 26.61, 0.01); close(b.end.motor.x, 710.7, 0.1, 'the motor CG moves aft');
  close(v1.x, 168.5, 0.1, 'the vehicle CG moves forward'); close(1110 - v1.x, 941.5, 0.1);
  close(v0.Ip, 35.63, 0.01); close(v1.Ip, 18.17, 0.01); close(b.ignition.motor.Ip, 15.59, 0.01); close(b.end.motor.Ip, 5.24, 0.01);
  // the bore 0.5 mm off the axis
  close(b.ignition.motor.y, -0.0504, 1e-4); close(b.webOut.motor.y, -2.264, 1e-3, 'at web burnout');
  close(b.webOut.vehicle!.y, -0.802, 1e-3); close(b.webOut.grain.m, 0.833, 1e-3); close(b.webOut.grain.y!, -74.63, 0.01);
  assert.equal(b.peak.y, b.webOut.y, 'the offset peaks when the web first burns through');
  close(b.end.motor.y, 0, 1e-12, 'and goes when the sliver has burned');
  close(trimAngle(0.45, v0.y, 1110 - v0.x), 0.0398, 1e-4); close(trimAngle(0.45, b.webOut.vehicle!.y, 1110 - b.webOut.vehicle!.x), 0.0766, 1e-4);
  // the angular acceleration for 1° of nozzle angle at 29.5 kN
  const alpha = (p: typeof v0) => (29500 * Math.sin(Math.PI / 180) * (1110 - p.x)) / 1000 / p.Ip;
  close(alpha(v0), 10.13, 0.01); close(alpha(v1), 26.68, 0.01);
});

test('measurement: two supports, the reversal, and the pendulums', () => {
  const w = weighTwo(68.706, 200, 69.117, 1000);
  close(w.m, 137.823, 1e-3); close(w.x, 601.2, 0.1);
  const fl = flip180(0.9, -0.3);
  close(fl.y, 0.6, 1e-12); close(fl.fixture, 0.3, 1e-12);
  // the filar pendulum and its period are inverse
  close(filar(150, 0.4, 2.5, filarPeriod(16.8, 150, 0.4, 2.5)), 16.8, 1e-9);
  // a compound pendulum: a uniform rod swung about its end gives m·l²/12 about its centre
  const m = 3, l = 1.2, T = 2 * Math.PI * Math.sqrt(((m * l * l) / 3) / (m * G0 * (l / 2)));
  close(compound(m, l / 2, T), (m * l * l) / 12, 1e-12);
  // the motor on its fixture: the inertia, and the uncertainty against a numerical derivative
  const run = { m: 137.82, mf: 20, r: 0.4, h: 2.5, T: 2.5871, Tf: 1.9427, uT: 0.002, uTf: 0.002, ur: 0.0005, uh: 0.002, um: 0.05 };
  const f = filarMotor(run);
  close(f.I, 15.59, 0.01); close(f.rel, 0.0031, 0.0002);
  const dI = filarMotor({ ...run, T: run.T + 1e-6 }).I - f.I;
  close(f.terms.T, (dI / 1e-6) * run.uT, 1e-6, 'the period term');
});
