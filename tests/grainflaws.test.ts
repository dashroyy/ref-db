import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  flawArea, reachesCase, burnWithFlaws, areaPressureRatio, strainAt, voidFreeDepth, goodier, voidConcentration,
  openingStress, crackG, criticalCrack, crackMargin, type Flaw,
} from '../src/lib/grainflaws.ts';

const close = (a: number, b: number, tol: number, msg?: string) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} ${a} vs ${b}`);
const TUBE = { a0: 50, b: 150, L: 1000 }; // the 300 mm grain
const PROP = { rhoP: 1770, a: 4.05, n: 0.35, cStar: 1540 };

test('Goodier: the spherical cavity, and the strain concentration of a void', () => {
  close(goodier(0.3).meridional, 2.0455, 1e-4, 'the classic 2.05 for ν = 0.3');
  close(goodier(0.5).meridional, 13 / 6, 1e-12); close(goodier(0.5).pole, -7 / 6, 1e-12);
  const c = voidConcentration(0.5);
  close(c.uniaxial, 23 / 12, 1e-12, 'incompressible, uniaxial'); close(c.shear, 5 / 3, 1e-12, 'incompressible, pure shear');
});

test('the burning area of a void: Huygens gives a bump with the area of the void', () => {
  // a plane front with a sphere burning ahead of it: cap 2πR(R + h) less the disc π(R² − h²) is π(R + h)², and R + h = d
  for (const [d, s] of [[10, 0.3], [10, 7], [4, 25]]) {
    const R = s + d / 2 - 0, h = d / 2 - s; // sphere grown by s past the void, front s past the near edge
    close(2 * Math.PI * R * (R + h) - Math.PI * (R * R - h * h), Math.PI * d * d, 1e-9);
  }
  const v: Flaw = { kind: 'void', d: 5, depth: 30, count: 10 };
  assert.equal(flawArea(v, TUBE, 27.4), 0, 'closed until the flame reaches its near edge');
  close(flawArea(v, TUBE, 27.5), 10 * Math.PI * 25, 1e-9); close(flawArea(v, TUBE, 90), 10 * Math.PI * 25, 1e-9);
  close(flawArea(v, TUBE, 97.5), 5 * Math.PI * 25, 1e-9, 'the case cuts the bump off over the last d');
  assert.equal(reachesCase(v, TUBE), 95);
});

test('a crack and an unbond', () => {
  const c: Flaw = { kind: 'crack', c: 5, l: 100 };
  close(flawArea(c, TUBE, 0), 1000, 1e-12); close(flawArea(c, TUBE, 97), 600, 1e-12, 'its tip has reached the case');
  close(flawArea({ kind: 'crack', c: 100, l: 100 }, TUBE, 40), 2 * 100 * 60, 1e-12, 'through the web');
  const u: Flaw = { kind: 'unbond', l: 50, arc: 360, open: true };
  close(flawArea(u, TUBE, 0), 2 * Math.PI * 150 * 50, 1e-9, 'the outer face of the slice');
  close(flawArea(u, TUBE, 60), -2 * Math.PI * 110 * 50, 1e-9, 'past half the web, the slice and its bore face are gone');
  close(flawArea({ ...u, arc: 90 }, TUBE, 10), 0.25 * 2 * Math.PI * 140 * 50, 1e-9);
  assert.equal(flawArea({ ...u, open: false }, TUBE, 10), 0, 'a closed unbond does nothing until web burnout');
  assert.equal(reachesCase(u, TUBE), 0); assert.equal(reachesCase({ ...u, open: false }, TUBE), 100);
});

test('the burn: the nominal tube, and the worked example', () => {
  const b0 = burnWithFlaws(TUBE, PROP, 8.8, []);
  close(b0.throat, 56.77, 0.01); close(b0.peak0, 8.8, 1e-9); close(b0.ign0, 8.8 * (1 / 3) ** (1 / 0.65), 1e-9);
  // the burn time in closed form: r = r_end·((a0 + y)/b)^m with m = n/(1 − n)
  const m = 0.35 / 0.65, rEnd = 4.05 * 8.8 ** 0.35;
  const tb = (150 ** m / rEnd) * ((150 ** (1 - m) - 50 ** (1 - m)) / (1 - m));
  close(b0.end, tb, 1e-3, 'the burn time');
  assert.deepEqual(b0.p, b0.p0);
  const u = burnWithFlaws(TUBE, PROP, 8.8, [{ kind: 'unbond', l: 50, arc: 360, open: true }]);
  close(u.ign, 2.013, 0.001); close(u.ign / u.ign0, areaPressureRatio(2 * Math.PI * 150 * 50, 2 * Math.PI * 50 * 1000, 0.35), 1e-9);
  close(u.peak, 8.132, 0.001, 'the slice has burned out: the final peak is lower');
  close(u.exposure[0], u.end, 1e-12, 'the insulation behind it sees the whole burn'); close(u.end, 14.70, 0.01);
  const v = burnWithFlaws(TUBE, PROP, 8.8, [{ kind: 'void', d: 5, depth: 30, count: 10 }, { kind: 'crack', c: 5, l: 100 }]);
  close(v.ign / v.ign0 - 1, 0.0049, 0.0001, 'the crack at ignition'); close(v.peak, 8.8, 1e-6);
  close(v.exposure[0], 0.58, 0.01); close(v.exposure[1], 0.58, 0.01);
});

test('where a flaw is acceptable', () => {
  close(strainAt(0.161, 50, 50), 0.161 / 4, 1e-12, 'a quarter of the bore strain one bore radius in');
  const y = voidFreeDepth(0.161, 50, 2.0, 1.5, 0.396);
  close(y, 5.22, 0.01); close(2.0 * 1.5 * strainAt(0.161, 50, y), 0.396, 1e-12, 'on the boundary the void is at its limit');
  assert.equal(voidFreeDepth(0.05, 50, 2.0, 1.5, 0.396), 0, 'a low bore strain: voids anywhere');
  const s = openingStress(3.6, 0.104, 40, 0.057);
  close(s, (4 / 3) * (3.6 * 0.104 + 40 * 0.057), 1e-12); close(s, 3.539, 0.001);
  const cc = criticalCrack(s, 40, 1000);
  close(cc, 1.078, 0.001); close(crackG(s, cc, 40), 1000, 1e-9, 'G reaches the fracture energy at the critical depth');
  close(crackMargin(cc / 2.25, cc, 1.5), 0, 1e-12); close(crackMargin(5, cc, 1.5), -0.691, 0.001);
});
