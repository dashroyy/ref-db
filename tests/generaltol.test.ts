import { test } from 'node:test';
import assert from 'node:assert/strict';
import { linear, edge, angular, flatness, perpendicularity, symmetry, RUNOUT, dms, note, lookup } from '../src/lib/generaltol.ts';
import { checkFrame, frameText, CHARS, type Frame } from '../src/lib/fcf.ts';

test('ISO 2768-1: linear, broken edges and angles', () => {
  assert.equal(linear(25, 'm').value, 0.2); assert.equal(linear(30, 'm').value, 0.2); assert.equal(linear(30.1, 'm').value, 0.3);
  assert.equal(linear(150, 'f').value, 0.2); assert.equal(linear(2, 'v').value, null, 'class v has no value below 3 mm');
  assert.equal(linear(0.3, 'm').value, null, 'below 0.5 mm the standard gives no value');
  assert.equal(linear(3000, 'f').value, null); assert.equal(linear(3000, 'c').value, 4);
  assert.equal(edge(2, 'm').value, 0.2); assert.equal(edge(10, 'c').value, 2);
  assert.equal(angular(5, 'm').value, 60); assert.equal(angular(200, 'c').value, 15);
  assert.equal(dms(90), '1°30′'); assert.equal(dms(5), '0°05′'); assert.equal(dms(60), '1°');
});

test('ISO 2768-2: geometry', () => {
  assert.equal(flatness(50, 'K').value, 0.2); assert.equal(flatness(300, 'H').value, 0.2); assert.equal(flatness(301, 'H').value, 0.3);
  assert.equal(perpendicularity(150, 'L').value, 1); assert.equal(symmetry(50, 'H').value, 0.5); assert.equal(RUNOUT.K, 0.2);
  assert.equal(note('m', 'K'), 'ISO 2768-mK'); assert.equal(note('f', 'H', true), 'ISO 2768-fH-E'); assert.equal(note('m', ''), 'ISO 2768-m');
  const l = lookup(150, 'm', 'K');
  assert.equal(l.linear.value, 0.5); assert.equal(l.linear.range, 'over 120 to 400'); assert.equal(l.runout, 0.2);
  assert.equal(lookup(150, 'm', '').flatness, null);
});

const f = (o: Partial<Frame>): Frame => ({ char: 'position', dia: true, value: 0.2, mod: 'M', datums: [{ letter: 'A', mod: '' }, { letter: 'B', mod: '' }, { letter: 'C', mod: '' }], featureOfSize: true, ...o });
const levels = (x: Frame) => checkFrame(x).map((m) => m.level);

test('feature control frames: valid frames pass', () => {
  assert.deepEqual(levels(f({})), ['ok']);
  assert.equal(frameText(f({ datums: [{ letter: 'A', mod: '' }, { letter: 'B', mod: 'M' }, { letter: 'C', mod: '' }] })), '⌖|⌀0.2Ⓜ|A|BⓂ|C');
  assert.deepEqual(levels(f({ char: 'flatness', dia: false, mod: '', datums: [], featureOfSize: false, value: 0.05 })), ['ok']);
  assert.equal(CHARS.length, 14);
});

test('feature control frames: the usual errors', () => {
  assert.ok(levels(f({ char: 'flatness', dia: false, mod: '', featureOfSize: false })).includes('bad'), 'flatness with datums');
  assert.ok(levels(f({ datums: [] })).includes('bad'), 'position without datums');
  assert.ok(levels(f({ char: 'runout', dia: true, mod: '' })).includes('bad'), 'runout with ⌀');
  assert.ok(levels(f({ char: 'runout', dia: false, mod: 'M' })).includes('bad'), 'runout at MMC');
  assert.ok(levels(f({ featureOfSize: false })).includes('bad'), 'MMC on a surface');
  assert.ok(levels(f({ datums: [{ letter: 'A', mod: '' }, { letter: 'A', mod: '' }] })).includes('bad'), 'duplicate datum');
  assert.ok(levels(f({ datums: [{ letter: 'O', mod: '' }] })).includes('bad'), 'letter O');
  assert.ok(levels(f({ value: 0 })).includes('bad'));
  assert.ok(levels(f({ char: 'concentricity', mod: '' })).includes('warn'), 'removed from ASME 2018');
  assert.ok(levels(f({ char: 'circularity', dia: false, mod: '', datums: [], projected: 10 })).includes('bad'), 'projected zone on circularity');
});
