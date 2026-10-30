import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PROCESSES, process, screen, ROUTES, routeCost, breakEven, amChecks } from '../src/lib/process.ts';

const close = (a: number, b: number, tol: number, msg?: string) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} ${a} vs ${b}`);

test('the process table is consistent', () => {
  assert.equal(new Set(PROCESSES.map((p) => p.key)).size, PROCESSES.length);
  for (const p of PROCESSES) {
    assert.ok(p.tol[0] <= p.tol[1], p.name); assert.ok(p.ra[0] <= p.ra[1] && p.ra[1] <= p.ra[2], p.name);
    assert.ok(p.qty[0] <= p.qty[1]);
  }
});

test('screen: a seal bore needs a finishing process, an internal channel needs AM or casting', () => {
  const s = screen({ tol: 0.03, ra: 0.4, qty: 20, size: 310, internal: false });
  const fit = (k: string) => s.find((x) => x.p.key === k)!;
  assert.equal(fit('grind').asMade, 'usual'); assert.equal(fit('turn').asMade, 'care'); assert.equal(fit('sand').asMade, 'no');
  assert.equal(fit('forge').score, 1, 'a forging meets it only after machining');
  const ch = screen({ tol: 0.2, ra: 12.5, qty: 10, size: 150, internal: true });
  assert.deepEqual(ch.filter((x) => x.ok).map((x) => x.p.key).sort(), ['invest', 'lpbf', 'sand']);
  assert.equal(screen({ tol: 0.2, ra: 12.5, qty: 10, size: 600, internal: true }).find((x) => x.p.key === 'lpbf')!.ok, false, 'too large for a powder bed');
});

test('cost by route: tooling shared over the quantity, and the break-even quantity', () => {
  const o = { mass: 6, pricePerKg: 12, rate: 90 };
  const r = (k: string) => ROUTES.find((x) => x.key === k)!;
  const b = routeCost(r('billet'), { ...o, qty: 1 });
  close(b.material, 8 * 6 * 12, 1e-9); close(b.total, 576 + 900, 1e-9);
  const f10 = routeCost(r('forge'), { ...o, qty: 10 });
  close(f10.tooling, 2500, 1e-9); close(f10.total, 2500 + 180 + 400 + 360, 1e-9);
  const n = breakEven(r('billet'), r('forge'), o);
  close(n, 25000 / (1476 - 940), 1e-9);
  close(routeCost(r('billet'), { ...o, qty: n }).total, routeCost(r('forge'), { ...o, qty: n }).total, 1e-6, 'equal cost at the break-even');
  assert.equal(breakEven(r('billet'), r('am'), o), Infinity, 'AM never beats bar for this part');
  assert.ok(process('lpbf'));
});

test('LPBF design checks', () => {
  const good = amChecks({ overhang: 50, hole: 5, wall: 1, channel: 4, channelLength: 100, height: 200, machineHeight: 350 });
  assert.equal(good.worst, 'ok');
  const bad = amChecks({ overhang: 20, hole: 12, wall: 0.2, channel: 0.8, channelLength: 100, height: 500, machineHeight: 350 });
  assert.equal(bad.worst, 'bad'); assert.ok(bad.checks.every((c) => c.level === 'bad'));
  assert.equal(amChecks({ overhang: 40, hole: 7, wall: 0.4, channel: 2, channelLength: 200, height: 100, machineHeight: 350 }).worst, 'warn');
});
