import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encodeDelivery } from '../src/lib/deliver.ts';

test('requests are encoded the way Netlify Forms expects', () => {
  const body = new URLSearchParams(
    encodeDelivery({ form: 'order', name: 'Ada & Co', email: 'ada@example.com', subject: 'Order DL-1', message: 'Line 1\nLine 2 — $24.00', reference: 'DL-1' }),
  );
  assert.equal(body.get('form-name'), 'order');
  assert.equal(body.get('bot-field'), ''); // honeypot stays empty
  assert.equal(body.get('name'), 'Ada & Co');
  assert.equal(body.get('message'), 'Line 1\nLine 2 — $24.00');
  assert.equal(body.get('reference'), 'DL-1');
});

test('custom requests have no reference', () => {
  const body = new URLSearchParams(encodeDelivery({ form: 'custom', name: 'A', email: 'a@b.co', subject: 'S', message: 'M' }));
  assert.equal(body.get('form-name'), 'custom');
  assert.equal(body.get('reference'), '');
});
