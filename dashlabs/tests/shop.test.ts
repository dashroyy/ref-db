import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PRODUCTS, CATEGORIES, priceFor, normaliseOptions, productById } from '../src/data/catalog.ts';
import { buildOrder, addLine, setQty, orderReference, lineKey, MAX_QTY } from '../src/lib/order.ts';

test('catalog: ids and slugs are unique and URL-safe', () => {
  const ids = PRODUCTS.map((p) => p.id);
  const slugs = PRODUCTS.map((p) => p.slug);
  assert.equal(new Set(ids).size, ids.length, 'duplicate product id');
  assert.equal(new Set(slugs).size, slugs.length, 'duplicate slug');
  for (const s of slugs) assert.match(s, /^[a-z0-9]+(-[a-z0-9]+)*$/, `bad slug ${s}`);
});

test('catalog: every price is a positive whole number of cents', () => {
  for (const p of PRODUCTS) {
    assert.ok(Number.isInteger(p.price) && p.price > 0, `${p.id} price`);
    for (const o of p.options) {
      assert.ok(o.choices.length > 0, `${p.id}.${o.id} has no choices`);
      for (const c of o.choices) assert.ok(Number.isInteger(c.priceDelta ?? 0), `${p.id}.${o.id}.${c.id}`);
    }
  }
});

test('catalog: every product is in a known category', () => {
  const known = new Set(CATEGORIES.map((c) => c.id));
  for (const p of PRODUCTS) assert.ok(known.has(p.category), `${p.id} category ${p.category}`);
});

test('catalog: licensed designs record designer, link and licence', () => {
  for (const p of PRODUCTS) {
    if (p.source.kind !== 'licensed') continue;
    assert.ok(p.source.designer.trim(), `${p.id} designer`);
    assert.match(p.source.url, /^https:\/\//, `${p.id} url`);
    assert.ok(p.source.licence.trim(), `${p.id} licence`);
  }
});

test('pricing: options add their price deltas', () => {
  const cards = productById('cards-standard')!;
  assert.equal(priceFor(cards), 2500);
  assert.equal(priceFor(cards, { qty: '50', style: 'nfc' }), 2500 + 4500 + 2000);
});

test('pricing: unknown options fall back to the first choice', () => {
  const cards = productById('cards-standard')!;
  assert.deepEqual(normaliseOptions(cards, { qty: 'hacked', bogus: 'x' }), { qty: '10', style: 'flat' });
  assert.equal(priceFor(cards, { qty: 'hacked' }), 2500);
});

test('cart: same product + options merges, different options stays separate', () => {
  let cart = addLine([], { productId: 'orig-pen-launcher', options: { colour: 'black' }, qty: 1 });
  cart = addLine(cart, { productId: 'orig-pen-launcher', options: { colour: 'black' }, qty: 2 });
  cart = addLine(cart, { productId: 'orig-pen-launcher', options: { colour: 'blue' }, qty: 1 });
  assert.equal(cart.length, 2);
  assert.equal(cart[0].qty, 3);
});

test('cart: quantity is clamped, and 0 removes the line', () => {
  let cart = addLine([], { productId: 'orig-pen-launcher', options: {}, qty: 999 });
  assert.equal(cart[0].qty, MAX_QTY);
  cart = setQty(cart, 0, 0);
  assert.equal(cart.length, 0);
});

test('cart: line key ignores option order', () => {
  assert.equal(
    lineKey({ productId: 'x', options: { a: '1', b: '2' } }),
    lineKey({ productId: 'x', options: { b: '2', a: '1' } }),
  );
});

test('order: priced from the catalog, ignoring unknown and quote-only products', () => {
  const order = buildOrder([
    { productId: 'orig-pen-launcher', options: { colour: 'silk' }, qty: 2 },
    { productId: 'cust-pet', options: {}, qty: 1 }, // quote-only
    { productId: 'does-not-exist', options: {}, qty: 1 },
  ]);
  assert.equal(order.lines.length, 1);
  assert.equal(order.lines[0].unitPrice, 2400 + 300);
  assert.equal(order.subtotal, 2 * 2700);
  assert.equal(order.itemCount, 2);
  assert.match(order.lines[0].optionsText, /Silk rainbow/);
});

test('order: reference looks like DL-YYMMDD-XXXX', () => {
  const ref = orderReference(new Date('2026-11-09T12:00:00Z'), () => 0);
  assert.equal(ref, 'DL-261109-2222');
  assert.match(orderReference(), /^DL-\d{6}-[2-9A-HJ-NP-Z]{4}$/);
});

test('catalog: product guide links point at real guides', async () => {
  const { GUIDES } = await import('../src/data/guides.ts');
  for (const p of PRODUCTS) if (p.guide) assert.ok(GUIDES.some((g) => g.slug === p.guide), `${p.id} guide ${p.guide}`);
});
