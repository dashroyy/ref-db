import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cardUnits, shearModulus, bulkModulus, poissonFromEG, poissonFromEK, neoHookean, orthotropic, plasticTable, rambergOsgoodStress, expansion, rereference } from '../src/lib/feacards.ts';

const close = (a: number, b: number, tol: number, msg?: string) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} ${a} vs ${b}`);

test('units: the same steel in four systems has the same wave speed; a kg/m³ density in an mm model does not', () => {
  const c = [cardUnits('mm-t', 205000, 7.85e-9), cardUnits('m-kg', 205e9, 7850), cardUnits('mm-kg-ms', 205, 7.85e-6), cardUnits('in-lbf', 29.733e6, 7.345e-4)];
  for (const x of c) close(x.wave, 5110, 5, 'wave speed');
  const bad = cardUnits('mm-t', 205000, 7850);
  assert.equal(bad.densityPlausible, false); close(bad.wave, 0.00511, 1e-5);
});

test('isotropic constants', () => {
  close(shearModulus(205000, 0.29), 79457, 1);
  close(poissonFromEG(205000, shearModulus(205000, 0.29)), 0.29, 1e-12);
  close(bulkModulus(205000, 0.29), 162698, 1);
});

test('worked example: propellant Poisson ratio from its bulk modulus, not a guess', () => {
  const nu = poissonFromEK(3.6, 3500);
  close(nu, 0.49983, 1e-5);
  close(bulkModulus(3.6, nu), 3500, 1e-6, 'round trip');
  close(bulkModulus(3.6, 0.49), 60, 1e-9, '58 times too soft');
  close(bulkModulus(3.6, 0.4999), 6000, 1e-6, 'too stiff');
  const nh = neoHookean(shearModulus(3.6, nu), 3500);
  close(nh.C10, 0.6001, 1e-4); close(nh.D1, 2 / 3500, 1e-12);
});

test('orthotropic: a good ply passes; swapped axes fail; symmetry gives the minor ratios', () => {
  const ply = { E1: 160000, E2: 9000, E3: 9000, n12: 0.32, n13: 0.32, n23: 0.45, G12: 5000, G13: 5000, G23: 3100 };
  const ok = orthotropic(ply);
  assert.equal(ok.stable, true); close(ok.n21, 0.018, 1e-12); close(ok.G23iso, 3103.4, 0.1); close(ok.det, 0.7808, 1e-4);
  const swapped = orthotropic({ ...ply, E1: 9000, E2: 160000 });
  assert.equal(swapped.stable, false); assert.ok(swapped.det < 0);
  // an isotropic material entered orthotropically reduces to 1 − 3ν² − 2ν³ > 0
  const iso = orthotropic({ E1: 1, E2: 1, E3: 1, n12: 0.3, n13: 0.3, n23: 0.3, G12: 1, G13: 1, G23: 1 });
  close(iso.det, 1 - 3 * 0.09 - 2 * 0.027, 1e-12);
  assert.equal(orthotropic({ E1: 1, E2: 1, E3: 1, n12: 0.5, n13: 0.5, n23: 0.5, G12: 1, G13: 1, G23: 1 }).stable, false, 'ν = 0.5 is incompressible');
});

test('plastic table: passes through yield and ultimate, true values, first row at zero plastic strain', () => {
  const p = plasticTable(205000, 1450, 1520, 0.05)!;
  close(p.n, 64.87, 0.01);
  const last = p.table[p.table.length - 1];
  close(last.eng, 1520, 1e-9); close(last.engStrain, 0.05, 1e-12);
  close(last.trueStress, 1520 * 1.05, 1e-9); close(last.truePlastic, Math.log(1.05) - 1596 / 205000, 1e-12);
  assert.equal(p.table[0].truePlastic, 0);
  for (let i = 1; i < p.table.length; i++) assert.ok(p.table[i].truePlastic > p.table[i - 1].truePlastic && p.table[i].trueStress > p.table[i - 1].trueStress, 'monotonic');
  // the fitted curve passes through the 0.2% offset yield
  close(rambergOsgoodStress(205000, 1450, p.n, 1450 / 205000 + 0.002), 1450, 0.01);
  assert.equal(plasticTable(205000, 1450, 1440, 0.05), null, 'ultimate below yield');
  assert.equal(plasticTable(205000, 1450, 1520, 0.008), null, 'less plastic strain than the offset');
});

test('thermal expansion: secant from instantaneous, and re-referencing', () => {
  const al = expansion(-50, 21e-6, 150, 25e-6);
  close(al.inst(20), 22.4e-6, 1e-12);
  close(al.secant(20, 150), 23.7e-6, 1e-12);
  close(al.strain(20, 150), 23.7e-6 * 130, 1e-12);
  close((al.inst(150) * 130) / al.strain(20, 150) - 1, 0.0549, 1e-4, 'instantaneous typed as secant');
  close(al.secant(20, 20), al.inst(20), 1e-15, 'limit at the reference');
  // re-referencing from 20 °C data to a −40 °C stress-free state gives the secant from −40 directly
  close(rereference((T) => al.secant(20, T), 20, -40, 150), al.secant(-40, 150), 1e-12);
});

import { estimatedSN } from '../src/lib/feacards.ts';
test('estimated S-N curve: through 0.9 Rm at 10³ and the Marin-corrected endurance at the knee', () => {
  const s = estimatedSN('steel', 1000, { surface: 'ground', load: 'bending', dMm: 7.62, reliability: '50' });
  assert.ok(Math.abs(s.S(1e3) - 900) < 1e-9);
  assert.ok(Math.abs(s.S(1e6) - s.se) < 1e-9);
  assert.ok(Math.abs(s.se - 500 * s.factors.ka * s.factors.kb) < 1e-9, 'Se = Se′ × ka × kb (kc, kd, ke = 1)');
  assert.equal(s.S(1e8), s.se, 'steel has an endurance limit');
  const al = estimatedSN('al', 570, { surface: 'machined', load: 'axial', dMm: 10, reliability: '99' });
  assert.equal(al.limit, false); assert.ok(al.S(1e9) < al.S(1e8), 'aluminium keeps falling');
  assert.ok(al.points.length >= 6);
});
