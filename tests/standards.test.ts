import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STANDARDS, CATS, tokens, names, citedBy, accessFor, checkRefs } from '../src/lib/standards.ts';

test('the register: every standard has a category and a source', () => {
  assert.equal(STANDARDS.length, 133);
  for (const s of STANDARDS) {
    assert.ok(CATS.some((c) => c.key === s.cat), s.ref);
    assert.ok(s.title && s.why && !/—/.test(s.title + s.why), s.ref);
    assert.ok(accessFor(s.ref).length > 10, s.ref);
  }
  for (const out of ['STANAG 4147', 'STANAG 4170', 'DEF STAN 59-114', 'AOP-7']) assert.ok(!STANDARDS.some((s) => s.ref.startsWith(out)), `${out} is outside the scope`);
});

test('designations are found in text, and only whole numbers', () => {
  assert.deepEqual(tokens('ISO 4014 / 4017'), ['ISO 4014', 'ISO 4017']);
  assert.deepEqual(tokens('ISO 286-1/-2'), ['ISO 286']);
  assert.deepEqual(tokens('BS EN ISO 15614 / 15609'), ['ISO 15614', 'ISO 15609']);
  assert.deepEqual(tokens('AMS 2644 / ASTM E1417'), ['AMS 2644', 'ASTM E1417']);
  assert.deepEqual(tokens('ASTM E1444 / E1742'), ['ASTM E1444', 'ASTM E1742']);
  assert.deepEqual(tokens('DEF STAN 00-055 / 00-056'), ['DEF STAN 00-055', 'DEF STAN 00-056']);
  assert.deepEqual(tokens('NASA-STD-5019 / 5009'), ['NASA-STD-5019', 'NASA-STD-5009']);
  assert.deepEqual(tokens('BS EN 573 / 755 / 485'), ['EN 573', 'EN 755', 'EN 485']);
  assert.deepEqual(tokens('MMPDS'), ['MMPDS']);
  assert.deepEqual(tokens('NAS / MS / AN'), []);
  assert.ok(names('per ISO 2768-mK', 'ISO 2768'));
  assert.ok(!names('ISO 2860', 'ISO 286'));
  assert.ok(names('AS568-357 ring', 'AS568'));
  assert.ok(!names('MAS568', 'AS568'));
});

test('pages that cite a standard', () => {
  const docs = [{ path: 'a', title: 'A', text: 'Use ISO 965-2 table values and MJ to ISO 5855.' }, { path: 'b', title: 'B', text: 'Nothing here.' }];
  const s = STANDARDS.find((x) => x.ref === 'ISO 5855')!;
  assert.deepEqual(citedBy(s, docs), [{ path: 'a', title: 'A' }]);
});

test('the reference checker', () => {
  const r = checkRefs('BS 8888:2020\nISO 2768\nASME Y14.5\nMIL-HDBK-5\nBS 308\nISO 4287 Ra 1.6\nAS9102C\nWidget spec 12');
  assert.equal(r.mix, true, 'ISO GPS and ASME Y14.5 on one drawing');
  const by = (s: string) => r.lines.find((l) => l.line.startsWith(s))!;
  assert.ok(by('BS 8888').issues.every((i) => i.level === 'ok'), 'dated and known');
  assert.ok(by('ISO 2768').issues.some((i) => /class/.test(i.text)));
  assert.ok(by('ASME Y14.5').issues.some((i) => /Undated/.test(i.text)));
  assert.ok(by('MIL-HDBK-5').issues.some((i) => i.level === 'bad' && /MMPDS/.test(i.text)));
  assert.ok(by('BS 308').issues.some((i) => /BS 8888/.test(i.text)));
  assert.ok(by('ISO 4287').issues.some((i) => /21920-2/.test(i.text)));
  assert.ok(by('AS9102C').issues.every((i) => i.level === 'ok'), 'a revision letter dates it');
  assert.equal(by('Widget').issues[0].level, 'info');
  assert.ok(checkRefs('ISO 2768-mK:1989').lines[0].issues.every((i) => i.level === 'ok'));
});

test('the corrected list passes', () => {
  const r = checkRefs('BS 8888:2020\nISO 2768-mK:1989\nAMS 6431 rev K\nMMPDS-17\nISO 21920-2:2021 Ra 1.6\nBS EN 10204:2004 type 3.1\nASTM E1444/E1444M-22\nAS9102C');
  assert.equal(r.mix, false); assert.equal(r.bad, 0); assert.equal(r.warn, 0);
});
