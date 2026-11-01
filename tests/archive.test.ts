import { test } from 'node:test';
import assert from 'node:assert/strict';
import { retainUntil, sha256Hex, manifestText, parseManifest, compareManifest, checkSend, type SendCheck } from '../src/lib/archive.ts';

test('retention and SHA-256 test vectors (FIPS 180-2)', async () => {
  assert.equal(retainUntil(2026, 15, 10), 2051);
  assert.ok(Number.isNaN(retainUntil(2026, NaN, 10)));
  assert.ok(Number.isNaN(retainUntil(2026, -1, 10)));
  assert.equal(await sha256Hex('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  assert.equal(await sha256Hex(''), 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  assert.equal(await sha256Hex(new TextEncoder().encode('abc')), await sha256Hex('abc'));
});

test('a manifest round-trips in the sha256sum format, and the comparison finds changes', async () => {
  const a = { name: 'closure.pdf', hash: await sha256Hex('rev H') };
  const b = { name: 'closure.stp', hash: await sha256Hex('model') };
  const text = manifestText([a, b], ['Aft closure, revision H']);
  assert.match(text, /^# Aft closure, revision H\n[0-9a-f]{64} {2}closure\.pdf\n/);
  const m = parseManifest(text + '\n' + `${'A'.repeat(64)} *other.csv`);
  assert.equal(m.size, 3); assert.equal(m.get('other.csv'), 'a'.repeat(64));
  const c = compareManifest(m, [a, { name: 'closure.stp', hash: await sha256Hex('model changed') }, { name: 'new.txt', hash: '0'.repeat(64) }]);
  assert.deepEqual(c.results.map((r) => r.verdict), ['match', 'changed', 'new']);
  assert.deepEqual(c.missing, ['other.csv']);
});

test('the send check stops until every decision is recorded', () => {
  const ok: SendCheck = { classified: 'yes', marked: 'yes', usOrigin: 'no', licence: 'identified', recipientChecked: 'yes', overseas: true };
  assert.equal(checkSend(ok).status, 'ready');
  assert.equal(checkSend({ ...ok, classified: 'unknown' }).status, 'stop');
  assert.equal(checkSend({ ...ok, licence: 'none' }).status, 'stop');
  assert.equal(checkSend({ ...ok, licence: 'none', overseas: false }).status, 'ready');
  assert.equal(checkSend({ ...ok, usOrigin: 'unknown' }).status, 'stop');
  assert.ok(checkSend({ ...ok, usOrigin: 'yes' }).checks.some((c) => /ITAR/.test(c)));
  assert.equal(checkSend({ ...ok, marked: 'no' }).status, 'stop');
});
