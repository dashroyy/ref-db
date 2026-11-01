import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CHANGES, classifyChange, isValidRev, nextRev, revIndex, revFromIndex, signoff } from '../src/lib/release.ts';

const type = (k: string) => CHANGES.find((c) => c.key === k)!;

test('revision letters skip I, O, Q, S, X and Z, and go to AA after Y', () => {
  assert.equal(nextRev(''), 'A'); assert.equal(nextRev('-'), 'A'); assert.equal(nextRev('NC'), 'A');
  assert.equal(nextRev('A'), 'B'); assert.equal(nextRev('H'), 'J'); assert.equal(nextRev('N'), 'P');
  assert.equal(nextRev('P'), 'R'); assert.equal(nextRev('R'), 'T'); assert.equal(nextRev('W'), 'Y');
  assert.equal(nextRev('Y'), 'AA'); assert.equal(nextRev('AY'), 'BA'); assert.equal(nextRev('o'), 'P');
  assert.equal(isValidRev('I'), false); assert.equal(isValidRev('AI'), false); assert.equal(isValidRev('B'), true); assert.equal(isValidRev('3'), false);
  assert.equal(revIndex('Y'), 20); assert.equal(revIndex('AA'), 21);
  for (let n = 1; n < 500; n++) assert.equal(revIndex(revFromIndex(n)), n);
});

test('interchangeable changes are revisions; the rest are new part numbers', () => {
  const c = classifyChange(type('clarify').a, type('clarify'));
  assert.equal(c.action, 'revision'); assert.equal(c.changeClass, 'II'); assert.equal(c.parent, undefined);
  const m = classifyChange({ ...type('mating').a, parentOk: 'yes' }, type('mating'));
  assert.equal(m.action, 'newPN'); assert.equal(m.changeClass, 'I'); assert.equal(m.parent, 'revise');
  assert.deepEqual(m.failed, ['Fit', 'Form', 'Two-way']);
  assert.ok(m.updates.some((u) => /where-used/.test(u)));
  const g = classifyChange(type('function').a, type('function'));
  assert.equal(g.action, 'newPN'); assert.equal(g.parent, 'ask');
});

test('unsure counts as not interchangeable', () => {
  const t = classifyChange({ fit: 'yes', func: 'unsure', form: 'yes', swap: 'yes', classI: 'no' });
  assert.equal(t.action, 'newPN'); assert.deepEqual(t.unsure, ['Function']); assert.deepEqual(t.failed, []);
});

test('sign-off route grows with criticality', () => {
  const none = signoff('none', false, false).map((s) => s.role);
  assert.deepEqual(none, ['Drawn', 'Checked', 'Quality', 'Design authority']);
  const crit = signoff('critical', false, false).map((s) => s.role);
  assert.ok(crit.includes('Independent stress check') && crit.includes('Manufacturing') && !crit.includes('Fracture control'));
  assert.ok(signoff('fracture', true, false).some((s) => s.role === 'Fracture control'));
  assert.ok(signoff('none', true, false).some((s) => s.role === 'Change board'));
  assert.ok(signoff('none', false, true).some((s) => s.role === 'Stress'));
});
