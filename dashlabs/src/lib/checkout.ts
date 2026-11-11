// Checkout — one entry point, two modes (set CHECKOUT_MODE in src/data/site.ts).
//
// 'request' (today): builds an order request email with every line priced from
//   the catalog and an order reference. You confirm by replying and send an
//   invoice (Stripe Invoicing, PayPal, etc. — see docs/SHOP-ROADMAP.md).
//
// 'stripe' (later): POSTs the cart (ids, options and quantities only — never
//   prices) to /api/checkout, which re-prices it with buildOrder(), creates a
//   Stripe Checkout Session with invoice creation on, and returns its URL.

import { CHECKOUT_MODE, SITE } from '../data/site.ts';
import { buildOrder, type CartLine, type Order, type OrderExtras } from './order.ts';
import { money } from './money.ts';

export interface Customer {
  name: string;
  email: string;
  notes?: string;
}

export type CheckoutResult = { kind: 'redirect'; url: string } | { kind: 'error'; message: string };

export async function startCheckout(cart: CartLine[], customer: Customer, extras: OrderExtras = {}): Promise<CheckoutResult> {
  const order = buildOrder(cart, undefined, undefined, extras);
  if (order.lines.length === 0) return { kind: 'error', message: 'Your cart is empty.' };

  if (CHECKOUT_MODE === 'stripe') {
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          cart: cart.map(({ productId, options, qty, note }) => ({ productId, options, qty, note })),
          customer,
          extras: { giftWrap: !!extras.giftWrap, giftNote: extras.giftNote },
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) return { kind: 'error', message: data.error ?? 'Checkout is unavailable.' };
      return { kind: 'redirect', url: data.url };
    } catch {
      return { kind: 'error', message: 'Could not reach checkout. Please try again.' };
    }
  }

  return { kind: 'redirect', url: orderRequestMailto(order, customer) };
}

export function orderRequestText(order: Order, customer: Customer): string {
  const rows = order.lines.map(
    (l) =>
      `• ${l.qty} × ${l.name}${l.optionsText ? ` (${l.optionsText})` : ''}${l.note ? ` — "${l.note}"` : ''}` +
      ` — ${money(l.lineTotal)}`,
  );
  return [
    `Order request ${order.reference}`,
    '',
    ...rows,
    ...(order.gift.wrap ? [`• Gift wrap — ${money(order.gift.wrapPrice)}`] : []),
    ...(order.gift.note ? [`Gift note: "${order.gift.note}"`] : []),
    '',
    `Subtotal: ${money(order.subtotal)} (shipping and tax confirmed on your invoice)`,
    '',
    `Name: ${customer.name}`,
    `Email: ${customer.email}`,
    customer.notes ? `Notes: ${customer.notes}` : '',
  ]
    .filter((s) => s !== undefined)
    .join('\n');
}

export function orderRequestMailto(order: Order, customer: Customer): string {
  const subject = `${SITE.name} order request ${order.reference}`;
  return `mailto:${SITE.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(
    orderRequestText(order, customer),
  )}`;
}
