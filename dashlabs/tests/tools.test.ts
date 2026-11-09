// The worked examples on the /learn/ pages are the tools' default inputs.
// These tests assert the same numbers the pages show, step by step.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { estimate, DEFAULT_INPUT, formatHours, RATES } from '../src/lib/estimate.ts';
import { launch, trajectory, bestAngle, DEFAULT_LAUNCH } from '../src/lib/launcher.ts';
import { MATERIALS } from '../src/data/materials.ts';
import { leadTimeDays } from '../src/data/lab.ts';

const near = (a: number, b: number, tol: number, msg?: string) =>
  assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} expected ${b} ± ${tol}, got ${a}`);

test('estimate worked example: 8×8×10 cm organic figurine in PLA, 15% infill, standard', () => {
  const r = estimate(DEFAULT_INPUT);
  near(r.volume, 224, 1e-9, 'volume = 8·8·10·0.35');
  near(r.shell, 26.56, 0.01, 'skin = 6·224^(2/3)·0.12');
  near(r.material, 56.17, 0.01, 'material = 26.56 + 0.15·(224 − 26.56)');
  near(r.grams, 69.65, 0.01, 'grams = 56.17 · 1.24');
  near(r.hours, 4.644, 0.001, 'hours = 69.65 / 15');
  assert.equal(formatHours(r.hours), '4 h 39 min');
  near(r.cost.filament, 1.39, 0.005);
  near(r.cost.machine, 4.64, 0.005);
  near(r.each, 12.65, 0.005);
  assert.equal(r.total, 13);
});

test('estimate: handling is charged once per job, not per part', () => {
  const one = estimate(DEFAULT_INPUT);
  const ten = estimate({ ...DEFAULT_INPUT, qty: 10 });
  const perExtra = one.each - RATES.handling * (1 + RATES.margin);
  near(ten.total, Math.ceil(one.each + 9 * perExtra), 0);
});

test('estimate: more infill, finer layers and TPU all cost more', () => {
  const base = estimate(DEFAULT_INPUT).total;
  assert.ok(estimate({ ...DEFAULT_INPUT, infill: 0.5 }).total > base);
  assert.ok(estimate({ ...DEFAULT_INPUT, quality: 'fine' }).hours > estimate(DEFAULT_INPUT).hours);
  assert.ok(estimate({ ...DEFAULT_INPUT, material: 'tpu' }).hours > estimate(DEFAULT_INPUT).hours);
});

test('estimate: tiny parts hit the minimum; skin never exceeds the part', () => {
  const r = estimate({ ...DEFAULT_INPUT, w: 1, d: 1, h: 1 });
  assert.equal(r.total, RATES.minimum);
  assert.ok(r.shell <= r.volume);
  assert.equal(estimate({ ...DEFAULT_INPUT, w: 0 }).grams, 0);
});

test('launcher worked example: 300 N/m spring, 40 mm draw, 50%, 6 g pen, 35°, desk height', () => {
  const r = launch(DEFAULT_LAUNCH);
  near(r.springJ, 0.24, 1e-12, 'E = ½·300·0.04²');
  near(r.penJ, 0.12, 1e-12);
  near(r.speed, 6.32, 0.005, 'v = √(2·0.12/0.006)');
  near(r.flightS, 0.908, 0.001);
  near(r.range, 4.70, 0.005);
  near(r.peak, 1.42, 0.005);
});

test('launcher: from desk height the best angle is below 45°', () => {
  const a = bestAngle(DEFAULT_LAUNCH);
  assert.ok(a < 45 && a > 30, `got ${a}`);
  assert.equal(bestAngle({ ...DEFAULT_LAUNCH, heightM: 0 }), 45);
});

test('launcher: trajectory starts at the desk and ends at the floor at the range', () => {
  const pts = trajectory(DEFAULT_LAUNCH);
  assert.deepEqual(pts[0], [0, DEFAULT_LAUNCH.heightM]);
  const [x, y] = pts.at(-1)!;
  near(x, launch(DEFAULT_LAUNCH).range, 1e-9);
  near(y, 0, 1e-9);
});

test('materials: ids unique, ratings 1–5, densities plausible for filament', () => {
  assert.equal(new Set(MATERIALS.map((m) => m.id)).size, MATERIALS.length);
  for (const m of MATERIALS) {
    assert.ok(m.density > 0.9 && m.density < 1.5, m.id);
    for (const v of Object.values(m.ratings)) assert.ok(v >= 1 && v <= 5 && Number.isInteger(v), m.id);
  }
});

test('lab: lead time grows with the queue and never drops below 2 days', () => {
  const two = [
    { name: 'a', state: 'idle' as const },
    { name: 'b', state: 'idle' as const },
  ];
  assert.deepEqual(leadTimeDays(0, two), [2, 5]);
  assert.deepEqual(leadTimeDays(3, two), [3, 6]);
  assert.ok(leadTimeDays(40, two)[0] > leadTimeDays(3, two)[0]);
});
