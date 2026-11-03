import { test } from 'node:test';
import assert from 'node:assert/strict';
import { METAL_FAMILIES, members, classOf } from '../src/lib/metalfamilies.ts';

test('every library metal of a family falls into a named class', () => {
  for (const f of METAL_FAMILIES) {
    const other = members(f).filter((x) => x.cls === 'other').map((x) => x.m.name);
    assert.deepEqual(other, [], `${f.key}: ${other.join(', ')}`);
    assert.ok(members(f).length > 5, f.key);
  }
});

test('the rules put tricky names in the right class', () => {
  const ss = METAL_FAMILIES.find((f) => f.key === 'ss')!, al = METAL_FAMILIES.find((f) => f.key === 'al')!;
  assert.equal(classOf(ss, { name: 'Super duplex 2507 (1.4410)' }), 'dup');
  assert.equal(classOf(ss, { name: 'Stainless 410' }), 'mart');
  assert.equal(classOf(ss, { name: '431 stainless (S80)' }), 'mart');
  assert.equal(classOf(ss, { name: '17-4PH (H1025)' }), 'ph');
  assert.equal(classOf(al, { name: 'Al 2618A-T61 (RR58)' }), '2');
  assert.equal(classOf(al, { name: 'Beryllium (S-200F)' }), 'be');
});
