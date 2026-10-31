import { test } from 'node:test';
import assert from 'node:assert/strict';
import { a3Binary, acmBinary, slowCooled, ac1, ac3, ms, martensiteHrc, steelSummary, hjP, hjTime, hjTemp, tempering, erf, erfc, erfcInv, diffusant, diffusivity, diffusionDepth, diffusionTime, harrisCase } from '../src/lib/metallurgy.ts';

const close = (a: number, b: number, tol: number, msg?: string) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} ${a} vs ${b}`);
const rel = (a: number, b: number, r: number, msg?: string) => assert.ok(Math.abs(a / b - 1) <= r, `${msg ?? ''} ${a} vs ${b}`);

// D6AC, typical values inside AMS 6431
const d6ac = { C: 0.46, Mn: 0.75, Si: 0.22, Ni: 0.55, Cr: 1.05, Mo: 1.0, V: 0.08 };

test('iron–carbon diagram and lever rule', () => {
  close(a3Binary(0), 912, 0); close(a3Binary(0.77), 727, 0.1); close(a3Binary(0.4), 800, 0.1); close(acmBinary(2.11), 1148, 1e-9);
  close(slowCooled(0.46).pearlite, 0.586, 0.001); close(slowCooled(0.77).pearlite, 1, 1e-12); close(slowCooled(0.01).ferrite, 1, 0);
  const h = slowCooled(1.2); assert.equal(h.kind, 'hypereutectoid'); close(h.cementite, 0.0729, 0.0001);
});

test('worked example: D6AC transformation temperatures', () => {
  close(ac1(d6ac), 729.8, 0.1); close(ac3(d6ac), 813.6, 0.1); close(ms(d6ac), 291.7, 0.1); close(martensiteHrc(0.46), 58, 1e-9);
  const s = steelSummary(d6ac); assert.ok(s.valid); close(s.austenitise[0], 843.6, 0.1);
  close(ac3({ C: 0.4, Mn: 0.7, Si: 0.25, Ni: 1.8, Cr: 0.8, Mo: 0.25 }), 773.3, 0.1, '4340: nickel lowers Ac3');
  assert.ok(!steelSummary({ C: 0.8 }).valid);
});

test('worked example: tempering and later heat', () => {
  close(hjP(565, 4), 17267.6, 0.1); rel(hjTime(hjP(540, 2), 565), 0.496, 0.001); close(hjTemp(hjP(565, 4), 4), 565, 1e-9);
  const ok = tempering({ T: 565, t: 4, exposures: [{ T: 160, t: 6 }, { T: 540, t: 2 }], margin: 25 });
  assert.ok(ok.ex[0].tEq < 1e-9, 'a 160 °C cure does nothing to the temper');
  close(ok.dP, 42.6, 0.1); assert.ok(ok.worst < ok.limit);
  const bad = tempering({ T: 565, t: 4, exposures: [{ T: 160, t: 6 }, { T: 600, t: 2 }], margin: 25 });
  rel(bad.ex[1].tEq, 14.09, 0.001); close(bad.dP, 549.2, 0.1); assert.ok(bad.worst > bad.limit);
  close(hjTemp(bad.limit, 2), 552.1, 0.1, 'hottest 2 h exposure inside the margin');
});

test('worked example: diffusion', () => {
  close(erf(1), 0.8427007929, 1e-9); close(erf(0.5), 0.5204998778, 1e-9); close(erf(3), 0.9999779095, 1e-9); close(erfc(-1), 1.8427007929, 1e-9);
  close(erfcInv(0.1), 1.16309, 1e-5); close(erfcInv(0.5), 0.476936, 1e-6);
  const cg = diffusant('cg')!, D = diffusivity(cg.D0, cg.Q, 900);
  rel(D, 5.91e-12, 0.002);
  const r = diffusionDepth({ D, t: 3600, remain: 0.1 });
  close(r.depth * 1e3, 0.339, 0.001, 'decarburised 0.34 mm in 1 h of air at 900 °C'); rel(diffusionTime(0.08e-3, D, 0.1), 200, 0.001);
  close(harrisCase(927, 4), 1.27, 0.005, 'Harris: 0.025 in per root hour at 1700 °F');
  const h = diffusant('h')!; rel(diffusivity(h.D0, h.Q, 25), 7.28e-9, 0.002);
});
