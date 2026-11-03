import { test } from 'node:test';
import assert from 'node:assert/strict';
import { REGISTER, LIBRARY, CATS, FILLERS, toUnit, lbPerIn3, unitMistake, filled, volume, massKg } from '../src/lib/density.ts';

const near = (a: number, b: number, rel: number) => assert.ok(Math.abs(a - b) <= rel * Math.abs(b), `${a} vs ${b}`);

test('the register and the library', () => {
  assert.equal(REGISTER.length, 290);
  assert.ok(LIBRARY.length > 150);
  for (const r of [...REGISTER, ...LIBRARY]) {
    assert.ok(r.rho > 0.01 && r.rho < 25, r.name);
    assert.ok(CATS.some((c) => c.key === r.cat), `${r.name}: ${r.cat}`);
  }
  assert.equal(FILLERS.length, 9);
});

test('density in each unit system', () => {
  near(toUnit(7.85, 'si'), 7850, 1e-12);
  near(toUnit(7.85, 'mmt'), 7.85e-9, 1e-12);
  near(toUnit(7.85, 'mmkg'), 7.85e-6, 1e-12);
  near(lbPerIn3(7.85), 0.2836, 1e-3);
  near(toUnit(7.85, 'ips'), 7.346e-4, 1e-3);
  const m = unitMistake(7.85, 'mmkg', 'mmt'); // kg/mm³ typed into a tonne model
  near(m.factor, 1000, 1e-12);
  near(m.freq, 1 / Math.sqrt(1000), 1e-12);
});

test('filled polymers follow the rule of mixtures on specific volume', () => {
  const gf = filled(1.14, 2.55, 0.3); // PA6 + 30% glass by weight: datasheets give about 1.36
  near(gf.rho, 1.3667, 1e-3);
  near(gf.vf, 0.1608, 1e-3);
  assert.ok(gf.linear > gf.rho, 'a linear blend overstates the density');
  near(filled(1.3, 1.8, 0.3).rho, 1.418, 1e-3); // PEEK CF30
  assert.equal(filled(1.3, 1.8, 0).vf, 0);
});

test('volumes and masses', () => {
  near(volume('tube', 100, 90, 1000), 1_492_256, 1e-6);
  near(massKg(volume('tube', 100, 90, 1000), 7.85), 11.714, 1e-3);
  near(volume('shell', 100, 5, 0), (Math.PI / 6) * (100 ** 3 - 90 ** 3), 1e-12);
  near(volume('volume', 250, 0, 0), 250_000, 1e-12);
});
