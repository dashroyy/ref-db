import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tolFactor, finishFactor, stockMass, partCost, unitCost, cumulativeCost, programme } from '../src/lib/cost.ts';

const close = (a: number, b: number, tol: number, msg?: string) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} ${a} vs ${b}`);

test('tolerance and finish factors', () => {
  assert.equal(tolFactor(0.2), 1); assert.equal(tolFactor(0.01), 1.8); assert.equal(tolFactor(0.0005), 4);
  close(tolFactor(Math.sqrt(0.05 * 0.025)), (1.15 + 1.35) / 2, 1e-9, 'log interpolation');
  assert.equal(finishFactor(6.3), 1); assert.equal(finishFactor(0.4), 1.6);
  assert.ok(tolFactor(0.03) > tolFactor(0.05) && tolFactor(0.03) < tolFactor(0.025));
});

test('stock mass', () => {
  close(stockMass({ shape: 'bar', d: 100, l: 100 }, 7850), (Math.PI / 4) * 0.001 * 7850, 1e-9);
  close(stockMass({ shape: 'block', l: 100, w: 100, h: 10 }, 2700), 0.27, 1e-12);
});

const closure = { stock: { shape: 'bar' as const, d: 320, l: 80 }, rho: 7850, pricePerKg: 12, qty: 20, cycleMin: 240, rate: 90, setupHours: 6, tol: 0.0315, ra: 0.4, complexity: 1, treatment: 150, inspection: 120, margin: 0.15 };

test('worked example: the aft closure from bar', () => {
  const r = partCost(closure);
  close(r.mass, 50.5, 0.1); close(r.material, 606, 1); close(r.setup, 27, 1e-9);
  close(r.machining, 4 * 90 * r.k, 1e-9); close(r.total, 1888.6, 1);
  close(r.total, (r.material + r.machining + r.setup + r.treatment + r.inspection) * 1.15, 1e-9);
  assert.ok(partCost({ ...closure, tol: 0.1, ra: 1.6 }).total < r.total, 'relaxing the tolerance and finish saves cost');
  assert.ok(partCost({ ...closure, qty: 1 }).total > r.total, 'one part carries the full setup');
});

test('learning curve and programme cost', () => {
  close(unitCost(100, 2, 0.85), 85, 1e-9); close(unitCost(100, 4, 0.85), 72.25, 1e-9);
  close(cumulativeCost(10, 3, 0.9), 10 * (1 + 0.9 + Math.pow(3, Math.log2(0.9))), 1e-9);
  close(cumulativeCost(1, 20000, 0.9) / cumulativeCost(1, 10000, 0.9), Math.pow(2, 1 + Math.log2(0.9)), 0.01, 'the integral approximation continues smoothly');
  const p = programme({ nre: 450000, t1: 12000, lr: 0.85, n: 50 });
  close(p.total, p.recurring + 450000, 1e-6); close(p.avgWithNre, p.total / 50, 1e-9);
  assert.ok(p.unitN < p.avgUnit && p.avgUnit < 12000);
});
