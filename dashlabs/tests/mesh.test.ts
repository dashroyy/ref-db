import { test } from 'node:test';
import assert from 'node:assert/strict';
import { meshStats, fitsBed } from '../src/lib/mesh.ts';
import { estimate, estimateSolid, DEFAULT_INPUT } from '../src/lib/estimate.ts';

// A closed axis-aligned box from (0,0,0) to (a,b,c), 12 outward-facing triangles.
function box(a: number, b: number, c: number): number[] {
  const v = [
    [0, 0, 0], [a, 0, 0], [a, b, 0], [0, b, 0],
    [0, 0, c], [a, 0, c], [a, b, c], [0, b, c],
  ];
  const f = [
    [0, 2, 1], [0, 3, 2], [4, 5, 6], [4, 6, 7], [0, 1, 5], [0, 5, 4],
    [1, 2, 6], [1, 6, 5], [2, 3, 7], [2, 7, 6], [3, 0, 4], [3, 4, 7],
  ];
  return f.flatMap((t) => t.flatMap((i) => v[i]));
}

const near = (a: number, b: number, tol: number) => assert.ok(Math.abs(a - b) <= tol, `expected ${b} ± ${tol}, got ${a}`);

test('mesh: a 10 mm cube has 1000 mm³, 600 mm², and is closed', () => {
  const s = meshStats(box(10, 10, 10));
  assert.equal(s.triangles, 12);
  near(s.volumeMm3, 1000, 1e-9);
  near(s.areaMm2, 600, 1e-9);
  assert.deepEqual(s.size, { x: 10, y: 10, z: 10 });
  assert.equal(s.closed, true);
});

test('mesh: volume does not depend on where the part sits or on winding', () => {
  const moved = box(20, 30, 40).map((v, i) => v + [100, -50, 7][i % 3]);
  near(meshStats(moved).volumeMm3, 24000, 1e-6);
  const flipped: number[] = [];
  const b = box(20, 30, 40);
  for (let t = 0; t < b.length; t += 9) flipped.push(...b.slice(t, t + 3), ...b.slice(t + 6, t + 9), ...b.slice(t + 3, t + 6));
  near(meshStats(flipped).volumeMm3, 24000, 1e-6);
});

test('mesh: an open mesh is flagged as not closed', () => {
  assert.equal(meshStats(box(10, 10, 10).slice(0, 9 * 11)).closed, false);
  assert.equal(meshStats([]).closed, false);
});

test('mesh: fits the bed in any axis-aligned orientation', () => {
  assert.equal(fitsBed({ x: 300, y: 50, z: 50 }), false);
  assert.equal(fitsBed({ x: 250, y: 250, z: 20 }), true);
  assert.equal(fitsBed({ x: 20, y: 250, z: 250 }), true);
});

test('estimateSolid reproduces estimate() when given the same volume and area', () => {
  const a = estimate(DEFAULT_INPUT);
  const b = estimateSolid({ volume: 224, area: 6 * Math.pow(224, 2 / 3) }, DEFAULT_INPUT);
  near(b.each, a.each, 1e-9);
  assert.equal(b.total, a.total);
});

test('estimateSolid: a solid 20 mm cube at 100% infill weighs volume × density', () => {
  const s = meshStats(box(20, 20, 20));
  const r = estimateSolid({ volume: s.volumeMm3 / 1000, area: s.areaMm2 / 100 }, { material: 'pla', infill: 1, quality: 'standard', qty: 1 });
  near(r.grams, 8 * 1.24, 1e-9);
});
