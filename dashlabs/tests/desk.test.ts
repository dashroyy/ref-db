import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseOrderText, replyDraft } from '../src/lib/desk.ts';
import { buildOrder } from '../src/lib/order.ts';
import { orderRequestText } from '../src/lib/checkout.ts';
import { paidOrderMessage } from '../src/lib/stripe.ts';

test('desk reads the order request email the site writes', () => {
  const order = buildOrder(
    [
      { productId: 'orig-pen-launcher', options: { colour: 'silk' }, qty: 2 },
      { productId: 'mto-keychain', options: {}, qty: 1, note: 'DASH' },
    ],
    undefined,
    undefined,
    { giftWrap: true, giftNote: 'Happy birthday, Sam!' },
  );
  const o = parseOrderText(orderRequestText(order, { name: 'Ada', email: 'ada@example.com', notes: '' }));
  assert.equal(o.reference, order.reference);
  assert.equal(o.items.length, 2);
  assert.deepEqual(o.items[0], { qty: 2, name: 'Pen Launcher', detail: 'Filament colour: Silk rainbow' });
  assert.equal(o.items[1].name, 'Name keychain');
  assert.match(o.items[1].detail, /DASH/);
  assert.ok(o.items.every((i) => !/\$/.test(i.detail)), 'no prices on the slip');
  assert.equal(o.gift, true);
  assert.equal(o.giftNote, 'Happy birthday, Sam!');
  assert.equal(o.name, 'Ada');
});

test('desk reads the paid-order notice, with the shipping address', () => {
  const m = paidOrderMessage(
    {
      id: 'cs_1',
      amount_total: 2700,
      currency: 'usd',
      metadata: { reference: 'DL-261114-AB12', customer_name: 'Ada', gift_note: 'Enjoy!' },
      customer_details: { email: 'ada@example.com' },
      collected_information: { shipping_details: { name: 'Ada L', address: { line1: '1 Loop Rd', city: 'Austin', state: 'TX', postal_code: '78701', country: 'US' } } },
    },
    [{ description: 'Pen Launcher', quantity: 1, amount_total: 2700, price: { product: { description: 'Filament colour: Silk rainbow' } } }],
  );
  const o = parseOrderText(m.text);
  assert.equal(o.reference, 'DL-261114-AB12');
  assert.deepEqual(o.items, [{ qty: 1, name: 'Pen Launcher', detail: 'Filament colour: Silk rainbow' }]);
  assert.deepEqual(o.shipTo, ['Ada L', '1 Loop Rd', 'Austin TX 78701', 'US']);
  assert.equal(o.gift, true);
  assert.equal(o.giftNote, 'Enjoy!');
});

test('multi-line gift notes come through whole', () => {
  const order = buildOrder([{ productId: 'orig-pen-launcher', options: {}, qty: 1 }], undefined, undefined, { giftWrap: true, giftNote: 'Happy birthday Sam!\nAim for the bin, not the boss.' });
  const o = parseOrderText(orderRequestText(order, { name: 'Ada', email: 'a@b.co', notes: '' }));
  assert.equal(o.giftNote, 'Happy birthday Sam!\nAim for the bin, not the boss.');
  assert.equal(o.name, 'Ada');
});

test('desk copes with text that is not an order', () => {
  const o = parseOrderText('hello there');
  assert.deepEqual(o.items, []);
  assert.equal(o.gift, false);
});

test('reply drafts: order total adds shipping to the subtotal', () => {
  const order = buildOrder([{ productId: 'orig-pen-launcher', options: { colour: 'silk' }, qty: 2 }]);
  const o = parseOrderText(orderRequestText(order, { name: 'Ada Lovelace', email: 'ada@example.com', notes: '' }));
  assert.equal(o.email, 'ada@example.com');
  assert.equal(o.subtotal, 5400);
  const r = replyDraft('total', o, { shipping: 650, shipBy: 'Fri 21 Nov', signOff: 'Dash' });
  assert.equal(r.subject, `Your DashLabs order ${order.reference}`);
  assert.match(r.body, /^Hi Ada,/);
  assert.match(r.body, /- 2 × Pen Launcher \(Filament colour: Silk rainbow\)/);
  assert.match(r.body, /Subtotal: \$54\.00\n- Shipping: \$6\.50\n- Total: \$60\.50/);
  assert.match(r.body, /ship by Fri 21 Nov/);
  assert.match(r.body, /Dash, DashLabs$/);
});

test('reply drafts: blanks stay as [brackets] until filled', () => {
  const o = parseOrderText('Order request DL-261115-AAAA\n\n• 1 × Pen Launcher — $24.00\n\nSubtotal: $24.00\n\nName: Sam\nEmail: s@x.co');
  const r = replyDraft('total', o);
  assert.match(r.body, /Shipping: \$\[x\]/);
  assert.match(r.body, /\[your name\], DashLabs/);
  assert.match(replyDraft('shipped', o, { tracking: '1Z999' }).body, /The Pen Launcher is printed.*Tracking: 1Z999/);
  assert.match(replyDraft('review', o).body, /I hope the Pen Launcher arrived safely/);
});

test('reply drafts read naturally for several items', async () => {
  const order = buildOrder([
    { productId: 'orig-pen-launcher', options: {}, qty: 1 },
    { productId: 'mto-keychain', options: {}, qty: 1, note: 'A' },
  ]);
  const o = parseOrderText(orderRequestText(order, { name: 'Ada', email: 'a@b.co', notes: '' }));
  assert.match(replyDraft('shipped', o).body, /Your order is printed/);
  assert.match(replyDraft('review', o).body, /I hope your order arrived safely/);
});
