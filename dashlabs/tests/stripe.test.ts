import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { sessionParams, createCheckoutSession, verifyStripeSignature } from '../src/lib/stripe.ts';
import { buildOrder } from '../src/lib/order.ts';

const OPTS = { currency: 'USD', successUrl: 'https://x.test/order/success/?s={CHECKOUT_SESSION_ID}', cancelUrl: 'https://x.test/cart/', shipTo: ['US', 'CA'] };
const customer = { name: 'Sam', email: 'sam@example.com', notes: 'Before Friday' };
const order = buildOrder(
  [
    { productId: 'orig-pen-launcher', options: { colour: 'silk' }, qty: 2 },
    { productId: 'mto-keychain', options: { textColour: 'orange' }, qty: 1, note: 'DASH' },
  ],
  undefined,
  new Date('2026-11-11T10:00:00Z'),
  { giftWrap: true, giftNote: 'Happy birthday' },
);

test('stripe: line items carry server-side prices, options and personalised text', () => {
  const p = sessionParams(order, customer, OPTS);
  assert.equal(p.get('mode'), 'payment');
  assert.equal(p.get('line_items[0][price_data][currency]'), 'usd');
  assert.equal(p.get('line_items[0][price_data][unit_amount]'), '2700'); // $24 + $3 silk
  assert.equal(p.get('line_items[0][quantity]'), '2');
  assert.match(p.get('line_items[0][price_data][product_data][description]')!, /Silk rainbow/);
  assert.match(p.get('line_items[1][price_data][product_data][description]')!, /Text: “DASH”/);
  assert.equal(p.get('line_items[2][price_data][product_data][name]'), 'Gift wrap');
  assert.equal(p.get('line_items[2][price_data][unit_amount]'), '300');
  assert.equal(p.get('line_items[3][quantity]'), null);
});

test('stripe: invoice creation, reference, shipping countries and notes are set', () => {
  const p = sessionParams(order, customer, OPTS);
  assert.equal(p.get('invoice_creation[enabled]'), 'true');
  assert.equal(p.get('client_reference_id'), order.reference);
  assert.equal(p.get('metadata[reference]'), order.reference);
  assert.equal(p.get('invoice_creation[invoice_data][metadata][gift_note]'), 'Happy birthday');
  assert.equal(p.get('metadata[notes]'), 'Before Friday');
  assert.equal(p.get('customer_email'), 'sam@example.com');
  assert.equal(p.get('shipping_address_collection[allowed_countries][1]'), 'CA');
  assert.equal(p.get('automatic_tax[enabled]'), null);
});

test('stripe: createCheckoutSession posts to Stripe and returns the hosted URL', async () => {
  let seen: { url: string; init: RequestInit } | null = null;
  const fake = (async (url: string, init: RequestInit) => {
    seen = { url, init };
    return new Response(JSON.stringify({ id: 'cs_test_1', url: 'https://checkout.stripe.com/c/pay/cs_test_1' }), { status: 200 });
  }) as unknown as typeof fetch;
  const r = await createCheckoutSession(order, customer, { ...OPTS, secretKey: 'sk_test_x', fetch: fake });
  assert.equal(r.url, 'https://checkout.stripe.com/c/pay/cs_test_1');
  assert.equal(seen!.url, 'https://api.stripe.com/v1/checkout/sessions');
  assert.equal((seen!.init.headers as Record<string, string>).Authorization, 'Bearer sk_test_x');
  assert.equal((seen!.init.headers as Record<string, string>)['Idempotency-Key'], order.reference);
});

test('stripe: Stripe errors surface their message', async () => {
  const fake = (async () => new Response(JSON.stringify({ error: { message: 'Invalid API Key provided' } }), { status: 401 })) as unknown as typeof fetch;
  await assert.rejects(createCheckoutSession(order, customer, { ...OPTS, secretKey: 'bad', fetch: fake }), /Invalid API Key/);
});

test('stripe: webhook signatures verify, and tampering, wrong secrets and replays fail', async () => {
  const secret = 'whsec_test';
  const body = JSON.stringify({ type: 'checkout.session.completed', data: { object: { id: 'cs_1' } } });
  const t = 1_800_000_000;
  const sig = createHmac('sha256', secret).update(`${t}.${body}`).digest('hex');
  const header = `t=${t},v1=${sig}`;
  assert.equal(await verifyStripeSignature(body, header, secret, t + 10), true);
  assert.equal(await verifyStripeSignature(body + ' ', header, secret, t + 10), false);
  assert.equal(await verifyStripeSignature(body, header, 'whsec_other', t + 10), false);
  assert.equal(await verifyStripeSignature(body, header, secret, t + 3600), false);
  assert.equal(await verifyStripeSignature(body, null, secret, t), false);
  // Stripe may send several v1 signatures (secret rotation): any match passes
  assert.equal(await verifyStripeSignature(body, `t=${t},v1=deadbeef,v1=${sig}`, secret, t), true);
});

test('stripe: paid-order notice has everything needed to make and ship it', async () => {
  const { paidOrderMessage, fetchLineItems } = await import('../src/lib/stripe.ts');
  const session = {
    id: 'cs_test_9',
    amount_total: 5700,
    currency: 'usd',
    metadata: { reference: 'DL-261114-AB12', customer_name: 'Ada', gift_note: 'Happy birthday!', notes: 'Before the 20th please' },
    customer_details: { email: 'ada@example.com', phone: '+1 555 0100' },
    collected_information: { shipping_details: { name: 'Ada L', address: { line1: '1 Loop Rd', city: 'Austin', state: 'TX', postal_code: '78701', country: 'US' } } },
  };
  let asked = '';
  const fake = (async (url: string) => {
    asked = url;
    return new Response(
      JSON.stringify({ data: [{ description: 'Name keychain', quantity: 2, amount_total: 1600, price: { product: { description: 'Filament colour: Matte black · Text: “DASH”' } } }] }),
      { status: 200 },
    );
  }) as unknown as typeof fetch;
  const items = await fetchLineItems('cs_test_9', 'sk_test_x', fake);
  assert.match(asked, /cs_test_9\/line_items.*expand/);
  const m = paidOrderMessage(session, items);
  assert.equal(m.reference, 'DL-261114-AB12');
  assert.match(m.subject, /PAID.*DL-261114-AB12.*\$57\.00/);
  assert.match(m.text, /2 × Name keychain \(Filament colour: Matte black · Text: “DASH”\) — \$16\.00/);
  assert.match(m.text, /Ship to:\nAda L\n1 Loop Rd\nAustin TX 78701\nUS/);
  assert.match(m.text, /GIFT: .*Happy birthday!/);
  assert.match(m.text, /Customer notes: Before the 20th/);
  assert.equal(m.email, 'ada@example.com');
});

test('stripe: paid-order notice still goes out if the items cannot be loaded', async () => {
  const { paidOrderMessage, fetchLineItems } = await import('../src/lib/stripe.ts');
  const failing = (async () => new Response('{}', { status: 500 })) as unknown as typeof fetch;
  const m = paidOrderMessage({ id: 'cs_1', amount_total: 2400, currency: 'usd', metadata: { reference: 'DL-1' } }, await fetchLineItems('cs_1', 'k', failing));
  assert.match(m.text, /Items could not be loaded/);
  assert.match(m.text, /Ship to: \(no address collected\)/);
});
