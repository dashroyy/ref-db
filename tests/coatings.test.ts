import { test } from 'node:test';
import assert from 'node:assert/strict';
import { finish, preCoat, preloadAt, torqueFor, frictionChange, zincLife } from '../src/lib/coatings.ts';
import { THREADS } from '../src/lib/bolts.ts';

const close = (a: number, b: number, tol: number, msg?: string) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} ${a} vs ${b}`);
const M10 = THREADS.find((t) => t.name === 'M10')!;

test('build-up and dimensions', () => {
  close(finish('a2')!.out, 1 / 3, 1e-12); close(finish('a3')!.out, 0.5, 0);
  // hard anodise 40–60 µm on a ⌀20 H8 bore: half grows inward, so machine it 60 to 73 µm larger
  const b = preCoat({ feature: 'id', out: 0.5, tMin: 40, tMax: 60, min: 20, max: 20.033 });
  close(b.min, 20.06, 1e-9); close(b.max, 20.073, 1e-9); close(b.used, 0.606, 0.001);
  // the same coating on a ⌀20 h7 shaft uses all of the 20 µm tolerance
  assert.ok(!preCoat({ feature: 'od', out: 0.5, tMin: 40, tMax: 60, min: 19.98, max: 20 }).ok);
});

test('worked example: the coated M10 thread', () => {
  // after coating: not above the basic pitch diameter (6h GO gauge), not below the 6g minimum
  const fin = { min: M10.d2 - 0.032 - 0.132, max: M10.d2 };
  const r = preCoat({ feature: 'te', out: 1, tMin: 8, tMax: 12, ...fin });
  close(r.gMin, 0.032, 1e-12, '8 µm uses all of the 6g allowance'); close(r.min, 8.830, 0.001); close(r.max, 8.978, 0.001); close(r.tol, 0.148, 1e-9);
  close(M10.d2 - 0.032, 8.994, 0.001, 'a 6g bolt can be 16 µm too large'); close(M10.d2 - 0.067, 8.959, 0.001, '6e fits below the window top');
});

test('worked example: friction of the coated bolts', () => {
  close(preloadAt(60, M10, 0.12, 15, 11), 36.5, 0.05, 'the bolted-joints design preload');
  const c = frictionChange({ T: 60, t: M10, dw: 15, dh: 11, mu0: 0.12, muMin: 0.09, muMax: 0.14 });
  close(c.Flo, 31.9, 0.05); close(c.Fhi, 46.4, 0.05); close(c.dHi, 0.272, 0.001); close(c.dLo, -0.125, 0.001);
  close(c.Tnew, 57.9, 0.05); close(preloadAt(c.Tnew, M10, 0.115, 15, 11), c.F0, 1e-9);
  close(torqueFor(36.5, M10, 0.12, 15, 11), 60, 0.1);
});

test('worked example: zinc life by corrosivity category', () => {
  const c3 = zincLife({ t: 10, cat: 'C3' }); close(c3.short, 4.76, 0.01); close(c3.long, 14.3, 0.05);
  const c2 = zincLife({ t: 10, cat: 'C2' }); close(c2.short, 14.3, 0.05); close(c2.long, 100, 1e-9);
  assert.equal(zincLife({ t: 10, cat: 'C1' }).long, Infinity);
  close(zincLife({ t: 10, cat: 'C3', rel: 0.5 }).short, 9.52, 0.01, 'a coating that corrodes at half the zinc rate');
});
