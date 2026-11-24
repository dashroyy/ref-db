import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MATERIALS, FAMILIES, DEFAULTS, material, withProps, grouped, slug } from '../src/lib/materials.ts';
import { cardInUnits, cardNumber, solverCard, plasticTable } from '../src/lib/feacards.ts';
import domains from '../src/data/domains.json' with { type: 'json' };

test('every material has a unique key and a known family', () => {
  const keys = new Set(MATERIALS.map((m) => m.key));
  assert.equal(keys.size, MATERIALS.length, 'two materials share a key: rename one');
  for (const m of MATERIALS) assert.ok(m.family in FAMILIES, `${m.name}: unknown family ${m.family}`);
});

test('the worked-example materials exist', () => {
  for (const [k, key] of Object.entries(DEFAULTS)) assert.ok(material(key), `DEFAULTS.${k} (${key}) is not in the library`);
});

test('properties are in SI-style units with no conversion noise', () => {
  const d6 = material(DEFAULTS.caseSteel)!;
  assert.equal(d6.rho, 7850); assert.equal(d6.E, 205000); assert.equal(d6.alpha, 1.23e-5);
  assert.equal(material('D6AC (AMS 6431)'), d6, 'a material can be found by name');
  for (const m of MATERIALS) {
    if (m.rho !== undefined) assert.ok(m.rho > 10 && m.rho < 25000, `${m.name}: density ${m.rho} kg/m³`);
    if (m.E !== undefined) assert.ok(m.E > 0.1 && m.E < 1.2e6, `${m.name}: E ${m.E} MPa`);
    if (m.nu !== undefined) assert.ok(m.nu > -1 && m.nu < 0.5, `${m.name}: ν ${m.nu}`);
    if (m.Fty !== undefined && m.Ftu !== undefined) assert.ok(m.Ftu >= m.Fty, `${m.name}: ultimate below yield`);
  }
});

test('family defaults are marked, and own values win', () => {
  const d6 = material(DEFAULTS.caseSteel)!;
  assert.ok(d6.defaults.includes('nu'));
  const cfrp = material(DEFAULTS.cfrpLaminate)!;
  assert.equal(cfrp.nu, 0.3); assert.ok(!cfrp.defaults.includes('nu'));
});

test('withProps and grouped give each tool the materials it can use', () => {
  const list = withProps(['E', 'nu', 'alpha'], ['metal']);
  assert.ok(list.length > 50);
  assert.ok(list.every((m) => m.kind === 'metal' && m.E && m.nu && m.alpha));
  assert.ok(!list.some((m) => m.key === DEFAULTS.propellant));
  const g = grouped(list);
  assert.equal(g.reduce((s, x) => s + x.items.length, 0), list.length);
  assert.equal(slug('4340 / EN24T'), '4340-en24t');
});

test('card units: the same material in four unit systems', () => {
  const d6 = material(DEFAULTS.caseSteel)!;
  const mm = cardInUnits(d6, 'mm-t'), si = cardInUnits(d6, 'm-kg'), ms = cardInUnits(d6, 'mm-kg-ms'), us = cardInUnits(d6, 'in-lbf');
  assert.equal(mm.E, 205000); assert.ok(Math.abs(mm.rho! - 7.85e-9) < 1e-20);
  assert.ok(Math.abs(si.E! - 205e9) < 1); assert.equal(si.rho, 7850);
  assert.ok(Math.abs(ms.E! - 205) < 1e-9); assert.ok(Math.abs(ms.rho! - 7.85e-6) < 1e-15);
  assert.ok(Math.abs(us.E! / 29.733e6 - 1) < 1e-3); assert.ok(Math.abs(us.rho! / 7.345e-4 - 1) < 1e-3);
  // heat: k in N/s·K is the same number as W/m·K in mm-t; cp in mJ/t·K is 1e6 times J/kg·K
  assert.equal(mm.k, 43); assert.equal(mm.cp, 480e6);
});

test('card numbers always carry a decimal point', () => {
  assert.deepEqual([205000, 0.29, 7.85e-9, 20, 1e-4, 0].map(cardNumber), ['205000.', '0.29', '7.85e-9', '20.', '1.e-4', '0.']);
});

test('solver cards: content, plastic table and missing values', () => {
  const d6 = material(DEFAULTS.caseSteel)!, pt = plasticTable(d6.E!, d6.Fty!, d6.Ftu!, 0.05, 5)!.table;
  const a = solverCard('abaqus', d6, 'mm-t', { id: 1, tref: 20, plastic: pt });
  assert.match(a.text, /\*MATERIAL, NAME=D6AC_AMS_6431\n\*ELASTIC\n205000\., 0\.29/);
  assert.match(a.text, /\*EXPANSION, ZERO=20\.\n1\.23e-5,/);
  assert.match(a.text, /\*PLASTIC\n[\d.]+, 0\.\n/);
  assert.match(a.text, /Poisson's ratio: family default/);
  const b = solverCard('ansys', d6, 'mm-t', { id: 3, tref: 20 });
  assert.match(b.text, /MP,EX,3,205000\.\nMP,PRXY,3,0\.29\nMP,DENS,3,7\.85e-9\nMP,ALPX,3,1\.23e-5\nMP,REFT,3,20\./);
  const c = solverCard('nastran', d6, 'mm-t', { id: 7, tref: 20 });
  assert.match(c.text, /^MAT1,7,205000\.,,0\.29,7\.85E-9,1\.23E-5,20\.$/m);
  const p = solverCard('abaqus', material(DEFAULTS.propellant)!, 'mm-t', { id: 1, tref: 20 });
  assert.deepEqual(p.missing, ['Poisson\'s ratio']);
  assert.doesNotMatch(p.text, /\*ELASTIC/);
});

test('domain notes: each names a library material and one of the four domains', () => {
  const names = new Set(MATERIALS.map((m) => m.name));
  const entries = Object.entries(domains.materials as Record<string, [string, string]>);
  assert.ok(entries.length >= 51);
  for (const [n, [d, note]] of entries) {
    assert.ok(names.has(n), `${n}: not in the material library`);
    assert.ok(d in domains.domains, `${n}: unknown domain ${d}`);
    assert.ok(note.length > 20 && !note.includes('—'), `${n}: note`);
  }
});
