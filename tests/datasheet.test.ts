import { test } from 'node:test';
import assert from 'node:assert/strict';
import { alloyKeys, sameAlloy, galvanicFor, derived } from '../src/lib/datasheet.ts';
import { material, DEFAULTS } from '../src/lib/materials.ts';
import xref from '../src/data/xref.json' with { type: 'json' };
import specs from '../src/data/specs.json' with { type: 'json' };

const close = (a: number, b: number, tol: number, msg?: string) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} ${a} vs ${b}`);

test('alloy keys from library names', () => {
  assert.deepEqual(alloyKeys('Al 7075-T6'), ['7075t6', '7075']);
  assert.deepEqual(alloyKeys('Ti-6Al-4V (Gr 5)'), ['ti6al4v', '6al']);
  assert.deepEqual(alloyKeys('D6AC (AMS 6431)'), ['d6ac']);
  assert.deepEqual(alloyKeys('Carbon phenolic'), []);
});

test('library materials find their designations and spec-builder entries', () => {
  const find = (name: string) => (xref.rows as { name: string; family: string }[]).filter((r) => sameAlloy(material(name)!, r)).map((r) => r.name);
  assert.ok(find('Al 7075-T6').includes('Aluminium 7075'));
  assert.ok(find('Ti-6Al-4V (Gr 5)').includes('Ti-6Al-4V (Grade 5)'));
  assert.ok(find('D6AC (AMS 6431)').includes('D6AC'));
  assert.ok(find('Inconel 718').includes('Inconel 718'));
  assert.ok(!find('Al 7075-T6').some((n) => /6061|2024/.test(n)), 'no other aluminium alloys');
  assert.ok(!find('Ti-6Al-4V (Gr 5)').some((n) => /6Al-2Sn/.test(n)), 'not Ti-6242');
  const sp = (specs.specs as { name: string; family: string }[]).filter((s) => sameAlloy(material('Inconel 718')!, s));
  assert.equal(sp.length, 1);
});

test('galvanic index by family and alloy', () => {
  assert.equal(galvanicFor(material(DEFAULTS.caseSteel)!)!.index, 0.85);
  assert.equal(galvanicFor(material(DEFAULTS.aluminium)!)!.index, 0.9);
  assert.equal(galvanicFor({ name: 'Al 2024-T3', family: 'al' })!.index, 0.75);
  assert.equal(galvanicFor(material(DEFAULTS.titanium)!)!.index, 0.3);
  assert.equal(galvanicFor({ name: '440C stainless', family: 'ss' })!.key, 'ss12');
  assert.equal(galvanicFor({ name: 'EPDM', family: 'elast' }), null);
});

test('derived figures for D6AC', () => {
  const d = derived(material(DEFAULTS.caseSteel)!);
  close(d.specStrength!, 1450 / 7.85, 0.01);
  close(d.yieldRatio!, 1450 / 1520, 1e-9);
  close(d.thermalStress!, 205000 * 12.3e-6 * 100, 1e-6);
  close(d.critCrack!, (1 / Math.PI) * (70 / (1.12 * 870)) ** 2 * 1000, 1e-6);
  close(d.endurance!, 700, 1e-9, 'steels cap at 700 MPa above 1400 MPa UTS');
  assert.equal(derived(material(DEFAULTS.epdm)!).endurance, undefined);
});
