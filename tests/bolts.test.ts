import { test } from 'node:test';
import assert from 'node:assert/strict';
import { THREADS, FRICTION, metricThread, torquePreload, boltStiffness, memberStiffness, loadFactor, jointState, thermalPreload, tighteningStress, boltMargins } from '../src/lib/bolts.ts';

const close = (a: number, b: number, tol: number, msg?: string) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} ${a} vs ${b}`);
const M10 = THREADS.find((t) => t.name === 'M10')!;

test('ISO metric stress areas match the standard tables', () => {
  close(M10.As, 58.0, 0.05);
  close(THREADS.find((t) => t.name === 'M8')!.As, 36.6, 0.05);
  close(THREADS.find((t) => t.name === 'M12')!.As, 84.3, 0.05);
  close(metricThread('M20', 20, 2.5).As, 245, 0.5);
});

test('torque divides between stretching the bolt and two friction surfaces', () => {
  const r = torquePreload(60000, M10, 0.12, 0.12, 15, 11);
  close(r.split.pitch + r.split.thread + r.split.head, 1, 1e-12);
  close(r.F, 36495, 1);
  close(r.K, 0.164, 0.001);
  assert.ok(r.split.pitch < 0.16, 'only about a seventh of the torque stretches the bolt');
  // short form check: T = K F d
  close(r.K * r.F * M10.d, 60000, 1e-6);
});

test('stiffness: an all-thread bolt is softer; the member cone matches Shigley’s closed form', () => {
  assert.ok(boltStiffness(M10, 205000, 24, 0) < boltStiffness(M10, 205000, 24, 16));
  // Shigley eq. 8-22 for two equal members, 30° cone, washer face 1.5d
  const l = 24, d = 10, E = 205000;
  const shigley = (0.5774 * Math.PI * E * d) / (2 * Math.log((5 * (0.5774 * l + 0.5 * d)) / (0.5774 * l + 2.5 * d)));
  close(memberStiffness(d, 15, l, E) / shigley, 1, 1e-3);
});

test('joint diagram: the bolt takes Φ of the load until the members separate, then all of it', () => {
  const phi = 0.15, F = 30000;
  const a = jointState(F, 10000, phi);
  close(a.bolt, 31500, 1e-9); close(a.clamp, 21500, 1e-9); assert.equal(a.separated, false);
  close(a.Psep, F / 0.85, 1e-9);
  const b = jointState(F, 40000, phi);
  assert.equal(b.separated, true); close(b.bolt, 40000, 1e-9); close(b.clamp, 0, 1e-12);
});

test('temperature: an aluminium flange on steel bolts loses preload when cold', () => {
  const kb = boltStiffness(M10, 205000, 24, 16), km = memberStiffness(10, 15, 24, 71700);
  close(thermalPreload(-60, 23.2e-6, 11.5e-6, 24, kb, km), -4081, 2);
  close(thermalPreload(40, 23.2e-6, 11.5e-6, 24, kb, km), 2721, 2);
  close(thermalPreload(-60, 11.5e-6, 11.5e-6, 24, kb, km), 0, 1e-9);
});

test('tightening: tension plus thread torsion', () => {
  const r = torquePreload(60000, M10, 0.12, 0.12, 15, 11);
  const s = tighteningStress(r.F, r.threadTorque, M10);
  close(s.sigma, 629.3, 0.1);
  close(s.vm / 1100, 0.697, 0.001);
});

test('worked example: 30 × M10 class 12.9 on the aft closure at MEOP', () => {
  const r = torquePreload(60000, M10, 0.12, 0.12, 15, 11);
  const kb = boltStiffness(M10, 205000, 24, 16), km = memberStiffness(10, 15, 24, 205000), phi = loadFactor(kb, km);
  close(phi, 0.147, 0.001);
  const P = (10.0 * Math.PI * 130 ** 2) / 30; // MEOP × seal area / bolts
  close(P, 17698, 1);
  const m = boltMargins({ Fmin: r.F * 0.75, Fmax: r.F * 1.25, P, phi, As: M10.As, Rp: 1100, Rm: 1220, fsSep: 1.2, fsYield: 1.1, fsUlt: 1.25, special: 1.15 });
  close(m.sep!, 0.511, 0.001);
  close(m.yield!.ms, 0.304, 0.001);
  close(m.ult!.ms, 0.433, 0.001);
  // the joint stays closed at ultimate, so the bolt sees only Φ of the extra load
  assert.equal(m.ult!.separated, false);
  close((phi * P) / (2 * M10.As), 22.4, 0.1); // alternating stress for a 0 → MEOP cycle
});

test('blank factors give no margin, and a weak preload separates first', () => {
  const m = boltMargins({ Fmin: 10000, Fmax: 12000, P: 20000, phi: 0.2, As: 58, Rp: 1100, Rm: 1220, fsSep: null, fsYield: null, fsUlt: 1.4, special: 1 });
  assert.equal(m.sep, null); assert.equal(m.yield, null);
  assert.equal(m.ult!.separated, true); close(m.ult!.load, 28000, 1e-9);
});

test('friction presets: unique, inside the input range, lubricated below dry', () => {
  assert.equal(new Set(FRICTION.map((p) => p.key)).size, FRICTION.length);
  for (const p of FRICTION) assert.ok(p.mu >= 0.02 && p.mu <= 0.5, p.name);
  const mu = (k: string) => FRICTION.find((p) => p.key === k)!.mu;
  assert.ok(mu('oiled') < mu('dry') && mu('mos2') < mu('oiled') && mu('ptfe') < mu('mos2'));
  assert.ok(mu('ssas') < mu('ssdry'), 'anti-seize lowers the friction of stainless');
  assert.equal(mu('oiled'), 0.12, 'the default preset matches the default inputs of the calculator');
});
