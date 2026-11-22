import { test } from 'node:test';
import assert from 'node:assert/strict';
import { atmosphere, sutherland, recoveryFactor, aeroHeating, caseHeating, tpsNeeded } from '../src/lib/aeroheating.ts';
import { solve } from '../src/lib/thermal.ts';

const close = (a: number, b: number, tol: number, msg?: string) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} ${a} vs ${b}`);

test('standard atmosphere (1976) at the tabulated altitudes', () => {
  const s = atmosphere(0);
  close(s.T, 288.15, 1e-9); close(s.p, 101325, 1e-6); close(s.rho, 1.225, 1e-3); close(s.a, 340.3, 0.1);
  close(atmosphere(11).p, 22632, 1); close(atmosphere(20).p, 5474.9, 0.5); close(atmosphere(30).p, 1171.9, 0.5);
  close(atmosphere(10).T, 223.15, 1e-9);
  close(sutherland(288.15), 1.789e-5, 2e-8, 'air at 15 °C');
});

test('recovery temperature and the heat transfer coefficient', () => {
  close(recoveryFactor(true), Math.sqrt(0.71), 1e-12); close(recoveryFactor(false), Math.cbrt(0.71), 1e-12);
  const e = aeroHeating({ mach: 3, hKm: 10, x: 1, Tw: 300 });
  close(e.Tr, 223.15 * (1 + Math.cbrt(0.71) * 0.2 * 9), 1e-6, 'T_r at Mach 3, 10 km');
  close(e.T0, 223.15 * 2.8, 1e-6, 'stagnation');
  close(e.h, 349, 2, 'h by hand: St 1.43e-3 × ρ* 0.271 × u 898 × c_p 1005');
  assert.ok(aeroHeating({ mach: 3, hKm: 10, x: 1, Tw: 300, laminar: true }).h < 0.15 * e.h, 'laminar is far lower at this Reynolds number');
  assert.ok(aeroHeating({ mach: 3, hKm: 10, x: 3, Tw: 300 }).h < e.h, 'h falls along the body');
  close(aeroHeating({ mach: 0, hKm: 0, x: 1, Tw: 288.15 }).Tr, 288.15, 1e-9, 'no speed, no heating');
});

test('the solver reports the temperature at the joint of two layers', () => {
  const m = { k: 1, rho: 1000, cp: 1000 };
  const two = solve({ geometry: 'slab', layers: [{ mat: m, thickness: 0.01 }, { mat: m, thickness: 0.01 }], t0: 20, phases: [{ duration: 60, h: 200, tEnv: 300 }], cellsPerLayer: 40, stepsPerPhase: 400 });
  const end = two.ifc[two.ifc.length - 1];
  assert.ok(end > two.back[two.back.length - 1] && end < two.surface[two.surface.length - 1], 'between the surface and the back face');
  const p = two.profiles.find((x) => x.label === 'end')!;
  const k = p.s.findIndex((s) => s > 0.01);
  close(end, (p.T[k - 1] + p.T[k]) / 2, 0.5, 'and between the cells beside it');
});

test('a bare carbon case overheats; the insulation that is needed holds it at the limit', () => {
  const cfrp = { k: 0.8, rho: 1570, cp: 1000 }, cork = { k: 0.09, rho: 470, cp: 1700 };
  const phases = [{ duration: 9, mach: 2.5, hKm: 6 }, { duration: 20, mach: 3, hKm: 12 }];
  const bare = caseHeating({ phases, x: 1.5, tps: null, wall: { mat: cfrp, thickness: 1.196e-3 }, t0: 20, limit: 120 });
  assert.ok(bare.maxCase > 250 && bare.tCross !== null && bare.tCross < 3);
  const t = tpsNeeded({ phases, x: 1.5, wall: { mat: cfrp, thickness: 1.196e-3 }, t0: 20, tpsMat: cork, limit: 120 })!;
  close(t * 1000, 1.62, 0.05, 'mm of cork phenolic');
  const w = caseHeating({ phases, x: 1.5, tps: { mat: cork, thickness: t }, wall: { mat: cfrp, thickness: 1.196e-3 }, t0: 20, limit: 120 });
  close(w.maxCase, 120, 0.5);
  assert.ok(tpsNeeded({ phases, x: 1.5, wall: { mat: cfrp, thickness: 1.196e-3 }, t0: 50, tpsMat: cork, limit: 120 })! > t, 'a hot start needs more');
});
