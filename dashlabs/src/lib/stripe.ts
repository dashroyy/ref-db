// Stripe Checkout, server side. Plain fetch against Stripe's REST API (no SDK),
// so it runs on any host adapter (Netlify, Vercel, Cloudflare, Node).
// Pure parts are tested in tests/stripe.test.ts; no network in tests.
//
// Flow: the browser posts the cart (ids, options, quantities — never prices)
// to /api/checkout → buildOrder() re-prices it from the catalog → we create a
// Checkout Session with invoice creation on → the customer pays on Stripe's
// page → Stripe emails the receipt and a numbered PDF invoice automatically →
// the optional webhook (/api/stripe-webhook) records the paid order.

import type { Order } from './order.ts';
import type { Customer } from './checkout.ts';

export interface SessionOptions {
  currency: string; // e.g. 'USD'
  successUrl: string; // may include {CHECKOUT_SESSION_ID}
  cancelUrl: string;
  shipTo: string[]; // ISO country codes
  automaticTax?: boolean; // only once you've set up Stripe Tax
}

/** The form-encoded body for POST /v1/checkout/sessions. */
export function sessionParams(order: Order, customer: Customer, o: SessionOptions): URLSearchParams {
  const p = new URLSearchParams();
  const cur = o.currency.toLowerCase();
  p.set('mode', 'payment');
  p.set('success_url', o.successUrl);
  p.set('cancel_url', o.cancelUrl);
  p.set('client_reference_id', order.reference);
  if (customer.email) p.set('customer_email', customer.email);

  let i = 0;
  const line = (name: string, unit: number, qty: number, description?: string) => {
    p.set(`line_items[${i}][price_data][currency]`, cur);
    p.set(`line_items[${i}][price_data][unit_amount]`, String(unit));
    p.set(`line_items[${i}][price_data][product_data][name]`, name.slice(0, 250));
    if (description) p.set(`line_items[${i}][price_data][product_data][description]`, description.slice(0, 500));
    p.set(`line_items[${i}][quantity]`, String(qty));
    i++;
  };
  for (const l of order.lines) {
    const desc = [l.optionsText, l.note ? `Text: “${l.note}”` : ''].filter(Boolean).join(' · ');
    line(l.name, l.unitPrice, l.qty, desc || undefined);
  }
  if (order.gift.wrap) line('Gift wrap', order.gift.wrapPrice, 1);

  // what we need to make the order, kept on the session and its invoice
  const meta: Record<string, string> = { reference: order.reference, customer_name: customer.name.slice(0, 200) };
  if (order.gift.note) meta.gift_note = order.gift.note.slice(0, 500);
  if (customer.notes) meta.notes = customer.notes.slice(0, 500);
  for (const [k, v] of Object.entries(meta)) {
    p.set(`metadata[${k}]`, v);
    p.set(`invoice_creation[invoice_data][metadata][${k}]`, v);
  }

  // a numbered PDF invoice + receipt, emailed by Stripe after payment
  p.set('invoice_creation[enabled]', 'true');
  p.set('invoice_creation[invoice_data][description]', `DashLabs order ${order.reference}`);
  o.shipTo.forEach((c, k) => p.set(`shipping_address_collection[allowed_countries][${k}]`, c));
  p.set('phone_number_collection[enabled]', 'true');
  if (o.automaticTax) p.set('automatic_tax[enabled]', 'true');
  return p;
}

/** Create the session; returns Stripe's hosted checkout URL. */
export async function createCheckoutSession(
  order: Order,
  customer: Customer,
  o: SessionOptions & { secretKey: string; fetch?: typeof fetch },
): Promise<{ id: string; url: string }> {
  const res = await (o.fetch ?? fetch)('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${o.secretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Idempotency-Key': order.reference,
    },
    body: sessionParams(order, customer, o),
  });
  const data = (await res.json()) as { id?: string; url?: string; error?: { message?: string } };
  if (!res.ok || !data.url || !data.id) throw new Error(data.error?.message ?? `Stripe error ${res.status}`);
  return { id: data.id, url: data.url };
}

const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

/** Constant-time string compare. */
function same(a: string, b: string) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

/**
 * Verify a Stripe webhook (the `Stripe-Signature` header: t=…,v1=…). The signed
 * payload is `${t}.${rawBody}`, HMAC-SHA256 with the endpoint secret, and the
 * timestamp must be recent (default 5 minutes) to stop replays.
 */
export async function verifyStripeSignature(
  rawBody: string,
  header: string | null,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
  toleranceSeconds = 300,
): Promise<boolean> {
  if (!header || !secret) return false;
  const parts = header.split(',').map((kv) => kv.split('=') as [string, string]);
  const t = Number(parts.find(([k]) => k === 't')?.[1]);
  const sigs = parts.filter(([k]) => k === 'v1').map(([, v]) => v);
  if (!Number.isFinite(t) || !sigs.length || Math.abs(nowSeconds - t) > toleranceSeconds) return false;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const expected = hex(await crypto.subtle.sign('HMAC', key, enc.encode(`${t}.${rawBody}`)));
  return sigs.some((s) => same(s, expected));
}
