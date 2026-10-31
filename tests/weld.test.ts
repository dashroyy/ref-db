import { test } from 'node:test';
import assert from 'node:assert/strict';
import { arcEnergy, heatInput, cet, cev, hydrogenScale, preheat, t85, heatForT85, joint, vGrooveArea, transverseShrinkage, kmAxial, thicknessFactor, cycles, rangeFor, fatigue } from '../src/lib/weld.ts';
import { shell } from '../src/lib/handcalc.ts';

const close = (a: number, b: number, tol: number, msg?: string) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} ${a} vs ${b}`);
const rel = (a: number, b: number, r: number, msg?: string) => assert.ok(Math.abs(a / b - 1) <= r, `${msg ?? ''} ${a} vs ${b}`);

// 15CDV6, typical heat values for the worked example
const steel = { C: 0.15, Mn: 1.0, Cr: 1.4, Mo: 0.9, V: 0.25, Ni: 0.1, Cu: 0.1 };
const Q = heatInput(12, 200, 1.3, 0.6);

test('heat input and carbon equivalents', () => {
  close(arcEnergy(12, 200, 1.3), 1.846, 0.001); close(Q, 1.108, 0.001, 'TIG, k = 0.6');
  close(cet(steel), 0.4175, 1e-9); close(cev(steel), 0.84, 1e-9);
  close(cet({ C: 0.46, Mn: 0.75, Cr: 1.05, Mo: 1.0, Ni: 0.55 }), 0.701, 0.001, 'D6AC is outside method B');
  assert.equal(hydrogenScale(5), 'D'); assert.equal(hydrogenScale(2), 'E'); assert.equal(hydrogenScale(12), 'B'); assert.equal(hydrogenScale(30), 'A');
});

test('worked example: preheat by EN 1011-2 method B', () => {
  const p = (hd: number, d = 12, q = Q) => preheat({ cet: cet(steel), d, hd, q });
  close(p(5).tp, 113.8, 0.1); close(p(3).tp, 95.9, 0.1); close(p(10).tp, 143.7, 0.1);
  close(p(5, 30).tp, 172.1, 0.1, 'thicker plate needs more');
  assert.ok(p(5).valid);
  // the four parts of the standard add up to the single equation
  const r = p(5), d = 12, hd = 5, C = cet(steel);
  close(r.tp, 697 * C + 160 * Math.tanh(d / 35) + 62 * hd ** 0.35 + (53 * C - 32) * Q - 328, 1e-9);
  close(preheat({ cet: C, d, hd, q: 1 }).parts.q, 0, 1e-12, 'the heat-input part is zero at 1 kJ/mm');
  assert.deepEqual(preheat({ cet: 0.70, d: 1.4, hd: 3, q: 0.3 }).outside, ['CET', 'thickness', 'heat input']);
});

test('worked example: cooling time and shrinkage', () => {
  const j = joint('butt');
  const fill = t85({ q: Q, d: 12, t0: 125, f2: j.f2, f3: j.f3 });
  assert.equal(fill.regime, '2D'); close(fill.t, 14.2, 0.05); close(fill.dt, 16.87, 0.01);
  close(t85({ q: 0.6, d: 12, t0: 125, f2: j.f2, f3: j.f3 }).t, 4.16, 0.01, 'root pass cools fast');
  // EN 1011-2 numbers: 1 kJ/mm, 20 °C, bead on plate
  close(t85({ q: 1, d: 100, t0: 20 }).t, 5.29, 0.01); close(t85({ q: 1, d: 10, t0: 20 }).t, 11.36, 0.01);
  for (const t of [8, 20]) rel(t85({ q: heatForT85(t, { d: 12, t0: 125, f2: 0.9, f3: 0.9 }), d: 12, t0: 125, f2: 0.9, f3: 0.9 }).t, t, 1e-9);
  rel(heatForT85(4, { d: 40, t0: 20 }), 4 / 5.2885, 1e-3, 'thick plate: 3D inverse');
  const A = vGrooveArea(12, 60, 2, 1.5);
  close(A, 87.65, 0.01); close(transverseShrinkage(A, 12, 2), 1.56, 0.005);
});

test('worked example: fatigue of the flange girth weld', () => {
  const s = shell(10, 156, 12, 205e3, 0.3);
  close(s.axial, 65, 1e-9); close(s.edgeBend, 200.6, 0.1); close(s.decayLength, 105.7, 0.1);
  close(s.innerAt(0), 265.6, 0.1, 'weld at the flange root'); close(s.outerAt(60), 105.1, 0.1, 'weld at the end of the hub');
  close(kmAxial(1, 12), 1.25, 1e-12); close(thicknessFactor(40, 0.2), 0.910, 0.001); close(thicknessFactor(12, 0.3), 1, 0);
  rel(cycles(80, 80), 2e6, 1e-12); rel(cycles(80, 80 * 0.2 ** (1 / 3)), 1e7, 1e-9); rel(rangeFor(71, cycles(71, 30)), 30, 1e-9);
  const hub = fatigue({ cls: 'root', ds: 105, e: 1, t: 12, gamma: 1.25, nReq: 1000 });
  close(hub.kmExtra, 1, 0, 'offset of 1 mm is inside the class'); rel(hub.life, 316600, 1e-3);
  const worst = fatigue({ cls: 'noroot', ds: 265.6, e: 1, t: 12, gamma: 1.25, nReq: 1000 });
  rel(worst.life, 2550, 1e-3); close(worst.damage, 0.392, 0.001); close(worst.margin, 0.366, 0.001);
  rel(hub.life / worst.life, 124, 0.01);
  const off = fatigue({ cls: 'noroot', ds: 265.6, e: 2, t: 12, gamma: 1.25, nReq: 1000 });
  close(off.km, 1.5, 1e-12); close(off.kmExtra, 1.5 / 1.3, 1e-12); rel(off.life, 1660, 1e-3);
  close(fatigue({ cls: 'attach', ds: 50, e: 5, t: 12, gamma: 1 }).kmExtra, 1, 0, 'offset does not apply to attachments');
});
