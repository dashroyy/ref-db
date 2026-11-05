import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PRESETS, build, step, gaussian, mulberry32, kineticTemperature, rmsDisplacement, dewetting, bondStats,
  beginStretch, setStrain, endStretch, BEAD, PLAST, CRYST,
} from '../src/lib/sandbox.ts';
import { VISCO_PRESETS, pronyOf, wlfFromTg, lookAt, transitionTime, stateOf } from '../src/lib/visco.ts';

const preset = (k: string) => PRESETS.find((p) => p.key === k)!;
const run = (k: string, T: number, steps: number, seed = 1) => {
  const s = build(preset(k), seed), noise = gaussian(mulberry32(seed + 100));
  step(s, { T }, noise, steps);
  return { s, noise };
};

test('every material builds with its chains, links and particles, and holds together', () => {
  for (const p of PRESETS) {
    const s = build(p, 1);
    const beads = p.chains * (p.star ? 1 + 3 * p.len : p.len);
    assert.equal([...s.kind].filter((k) => k === BEAD).length, beads, `${p.key}: beads`);
    assert.equal([...s.kind].filter((k) => k === PLAST).length, p.plast, `${p.key}: plasticiser`);
    assert.ok(s.cross.length / 2 >= 0.8 * p.cross, `${p.key}: ${s.cross.length / 2} of ${p.cross} crosslinks`);
    if (p.filler || p.cryst) assert.ok(s.anchors.length > 0, `${p.key}: bonds to the particles`);
    step(s, { T: 0.6 }, gaussian(mulberry32(3)), 400);
    assert.ok(s.x.every(Number.isFinite), `${p.key}: finite`);
    const b = bondStats(s);
    assert.ok(Math.abs(b.mean - 1) < 0.05 && b.max < 1.4, `${p.key}: bond lengths ${b.mean.toFixed(3)}, ${b.max.toFixed(2)}`);
  }
});

test('the thermostat: the measured kinetic temperature is the one set', () => {
  for (const T of [0.3, 1.2]) {
    const { s, noise } = run('linear', T, 300);
    let sum = 0;
    for (let k = 0; k < 60; k++) { step(s, { T }, noise, 20); sum += kineticTemperature(s); }
    assert.ok(Math.abs(sum / 60 / T - 1) < 0.1, `T ${T}: measured ${(sum / 60).toFixed(3)}`);
  }
});

test('chains cannot pass through one another: no two beads overlap', () => {
  const { s } = run('entangled', 1.2, 1500);
  let min = Infinity;
  const bonded = new Set<string>();
  for (let k = 0; k < s.bonds.length; k += 2) bonded.add(`${s.bonds[k]}-${s.bonds[k + 1]}`);
  for (let i = 0; i < s.n; i++) for (let j = i + 1; j < s.n; j++) {
    if (bonded.has(`${i}-${j}`)) continue;
    min = Math.min(min, Math.hypot(s.x[3 * j] - s.x[3 * i], s.x[3 * j + 1] - s.x[3 * i + 1], s.x[3 * j + 2] - s.x[3 * i + 2]));
  }
  assert.ok(min > 0.6, `closest approach ${min.toFixed(2)} (contact 0.96)`);
});

test('mobility: plasticiser outruns the chains, and cold chains hardly move', () => {
  const { s, noise } = run('plasticised', 0.6, 300);
  const snap = s.x.slice();
  step(s, { T: 0.6 }, noise, 400);
  const chain = rmsDisplacement(s, snap, BEAD), plast = rmsDisplacement(s, snap, PLAST);
  assert.ok(plast > 2 * chain, `plasticiser ${plast.toFixed(2)} vs chains ${chain.toFixed(2)}`);
  const move = (T: number) => { const r = run('entangled', T, 200, 2); const sn = r.s.x.slice(); step(r.s, { T }, r.noise, 400); return rmsDisplacement(r.s, sn, BEAD); };
  assert.ok(move(0.08) < 0.5 * move(1.0), 'mobility rises with temperature');
});

test('crystalline blocks do not move', () => {
  const s = build(preset('semicryst'), 1), before = s.x.slice();
  step(s, { T: 1.2 }, gaussian(mulberry32(8)), 300);
  for (let i = 0; i < s.n; i++) if (s.kind[i] === CRYST) for (let d = 0; d < 3; d++) assert.equal(s.x[3 * i + d], before[3 * i + d]);
});

test('dewetting: a stretch breaks the binder off the particles at the poles, and heat alone does not', () => {
  const { s, noise } = run('filled', 0.6, 300);
  beginStretch(s);
  for (let k = 1; k <= 50; k++) { setStrain(s, (0.1 * k) / 50); step(s, { T: 0.6 }, noise, 1); }
  assert.equal(dewetting(s).broken, 0, 'nothing breaks at 10%');
  for (let k = 1; k <= 150; k++) { setStrain(s, 0.1 + (0.3 * k) / 150); step(s, { T: 0.6 }, noise, 1); }
  step(s, { T: 0.6 }, noise, 100);
  const d = dewetting(s);
  assert.ok(d.broken >= 5, `${d.broken} of ${d.total} broke at 40%`);
  assert.equal(d.poles, d.broken, 'every break is within 45° of the stretch');
  endStretch(s);
  step(s, { T: 0.6 }, noise, 200);
  assert.ok(dewetting(s).broken >= d.broken, 'broken bonds do not heal');
  const hot = run('filled', 2.6, 400, 4).s;
  assert.equal(dewetting(hot).broken, 0, 'no thermal dewetting');
});

test('the same seed gives the same material', () => {
  const a = build(preset('elastomer'), 5), b = build(preset('elastomer'), 5);
  assert.deepEqual([...a.x], [...b.x]);
});

test('two temperatures: the seal compound is glassy at −40 °C and rubbery at 20 °C for a 0.1 s look', () => {
  const pr = VISCO_PRESETS.seal, p = pronyOf(pr), w = { tRef: pr.tRef, ...wlfFromTg(pr.tg, pr.tRef) };
  assert.ok(Math.abs(transitionTime(p) / 2.378e-4 - 1) < 0.01);
  const cold = lookAt(p, w, -40, 0.1), warm = lookAt(p, w, 20, 0.1), mid = lookAt(p, w, 0, 0.1);
  assert.equal(stateOf(cold.mobility), 'glassy');
  assert.equal(stateOf(warm.mobility), 'rubbery');
  assert.equal(stateOf(mid.mobility), 'transition');
  assert.ok(Math.abs(warm.De / 2.38e-3 - 1) < 0.01, `De ${warm.De}`);
  assert.ok(Math.abs(warm.E - 17.3) < 0.1 && Math.abs(mid.E - 81.6) < 0.5, `${warm.E}, ${mid.E}`);
  assert.equal(lookAt(p, w, -80, 1).valid, false, 'no WLF far below Tg');
  const prop = VISCO_PRESETS.prop, pp = pronyOf(prop), wp = { tRef: prop.tRef, ...wlfFromTg(prop.tg, prop.tRef) };
  assert.equal(stateOf(lookAt(pp, wp, -40, 0.1).mobility), 'transition');
});
