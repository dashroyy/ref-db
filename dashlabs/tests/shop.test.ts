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
  assert.deepEqual(normaliseOptions(cards, { qty: 'hacked', bogus: 'x' }), { qty: '10', style: 'flat', textColour: 'white' });
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

test('catalog: personalised products have a text colour option and a sane limit', () => {
  for (const p of PRODUCTS) {
    if (!p.personalise) continue;
    assert.ok(p.options.some((o) => o.id === 'textColour'), `${p.id} needs a textColour option`);
    assert.ok(p.personalise.max > 0 && p.personalise.max <= 40, `${p.id} max`);
  }
});

test('order: gift wrap is priced on the server side and counted once', async () => {
  const { GIFT_WRAP_PRICE } = await import('../src/data/site.ts');
  const cart = [{ productId: 'orig-pen-launcher', options: {}, qty: 2 }];
  const plain = buildOrder(cart);
  const gift = buildOrder(cart, undefined, undefined, { giftWrap: true, giftNote: '  Happy birthday!  ' });
  assert.equal(gift.subtotal, plain.subtotal + GIFT_WRAP_PRICE);
  assert.deepEqual(gift.gift, { wrap: true, wrapPrice: GIFT_WRAP_PRICE, note: 'Happy birthday!' });
  assert.equal(plain.gift.wrap, false);
  // no wrap charge on an empty order
  assert.equal(buildOrder([], undefined, undefined, { giftWrap: true }).subtotal, 0);
  // the note is capped
  assert.equal(buildOrder(cart, undefined, undefined, { giftNote: 'x'.repeat(999) }).gift.note!.length, 240);
});

test('order request email lists the gift wrap and note', async () => {
  const { orderRequestText } = await import('../src/lib/checkout.ts');
  const order = buildOrder([{ productId: 'orig-pen-launcher', options: {}, qty: 1 }], undefined, undefined, { giftWrap: true, giftNote: 'For Sam' });
  const text = orderRequestText(order, { name: 'A', email: 'a@example.com' });
  assert.match(text, /Gift wrap — \$3\.00/);
  assert.match(text, /Gift note: "For Sam"/);
  assert.match(text, /Subtotal: \$27\.00/);
});

test('catalog: every product has a size, and size options map every choice', () => {
  for (const p of PRODUCTS) {
    assert.ok(p.size && p.size.mm > 0, `${p.id} size`);
    const by = p.size!.byOption;
    if (!by) continue;
    const opt = p.options.find((o) => o.id === by.option);
    assert.ok(opt, `${p.id} size option ${by.option}`);
    for (const c of opt!.choices) assert.ok(by.mm[c.id] > 0, `${p.id} size for ${c.id}`);
  }
});

test('reviews: summary maths, per-product filter, and real data only', async () => {
  const { REVIEWS, GALLERY, reviewsFor, ratingSummary } = await import('../src/data/reviews.ts');
  const sample = [
    { productId: 'a', name: 'X', rating: 5 as const, date: '2026-01-02', text: 't' },
    { productId: 'a', name: 'Y', rating: 4 as const, date: '2026-03-01', text: 't' },
    { productId: 'b', name: 'Z', rating: 1 as const, date: '2026-02-01', text: 't' },
  ];
  assert.deepEqual(ratingSummary(reviewsFor('a', sample)), { average: 4.5, count: 2 });
  assert.equal(reviewsFor('a', sample)[0].name, 'Y'); // newest first
  assert.equal(ratingSummary([]), null);
  // whatever is published must point at real products and have alt text
  for (const r of REVIEWS) assert.ok(PRODUCTS.some((p) => p.id === r.productId) && r.text.trim() && r.name.trim(), `review for ${r.productId}`);
  for (const g of GALLERY) assert.ok(g.alt.trim() && g.src.startsWith('/gallery/'), `gallery ${g.src}`);
});
