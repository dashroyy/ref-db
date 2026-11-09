// Turns a cart into an order: priced lines, totals and a reference number.
//
// This is deliberately pure (no browser, no network) so the exact same code can
// run on the server when online checkout is switched on. The server must never
// trust prices from the browser — it receives only product ids, options and
// quantities, and prices them here from the catalog.

import { PRODUCTS, priceFor, normaliseOptions, describeOptions, type Product } from '../data/catalog.ts';

export interface CartLine {
  productId: string;
  options: Record<string, string>;
  qty: number;
  note?: string; // e.g. keychain text
}

export interface OrderLine {
  productId: string;
  name: string;
  optionsText: string;
  options: Record<string, string>;
  qty: number;
  unitPrice: number; // cents
  lineTotal: number; // cents
  note?: string;
}

export interface Order {
  reference: string;
  createdAt: string;
  lines: OrderLine[];
  subtotal: number; // cents. Shipping and tax are added at checkout.
  itemCount: number;
}

export const MAX_QTY = 20;

/** Same product + same options = same cart line. */
export const lineKey = (l: Pick<CartLine, 'productId' | 'options'>) =>
  l.productId +
  '|' +
  Object.keys(l.options)
    .sort()
    .map((k) => `${k}=${l.options[k]}`)
    .join('&');

export function addLine(cart: CartLine[], line: CartLine): CartLine[] {
  const key = lineKey(line);
  const existing = cart.find((l) => lineKey(l) === key && (l.note ?? '') === (line.note ?? ''));
  if (existing) {
    return cart.map((l) => (l === existing ? { ...l, qty: clampQty(l.qty + line.qty) } : l));
  }
  return [...cart, { ...line, qty: clampQty(line.qty) }];
}

export function setQty(cart: CartLine[], index: number, qty: number): CartLine[] {
  if (qty <= 0) return cart.filter((_, i) => i !== index);
  return cart.map((l, i) => (i === index ? { ...l, qty: clampQty(qty) } : l));
}

const clampQty = (n: number) => Math.max(1, Math.min(MAX_QTY, Math.floor(n) || 1));

/** Prices a cart from the catalog. Drops lines for unknown or quote-only products. */
export function buildOrder(cart: CartLine[], catalog: Product[] = PRODUCTS, now = new Date()): Order {
  const lines: OrderLine[] = [];
  for (const raw of cart) {
    const product = catalog.find((p) => p.id === raw.productId);
    if (!product || product.purchase !== 'cart') continue;
    const options = normaliseOptions(product, raw.options);
    const qty = clampQty(raw.qty);
    const unitPrice = priceFor(product, options);
    lines.push({
      productId: product.id,
      name: product.name,
      optionsText: describeOptions(product, options),
      options,
      qty,
      unitPrice,
      lineTotal: unitPrice * qty,
      note: raw.note?.slice(0, 200) || undefined,
    });
  }
  return {
    reference: orderReference(now),
    createdAt: now.toISOString(),
    lines,
    subtotal: lines.reduce((s, l) => s + l.lineTotal, 0),
    itemCount: lines.reduce((s, l) => s + l.qty, 0),
  };
}

/** Human-friendly order/invoice reference, e.g. DL-261109-4K7Q. */
export function orderReference(now = new Date(), rand: () => number = Math.random): string {
  const d = now.toISOString().slice(2, 10).replaceAll('-', '');
  const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // no 0/O/1/I confusion
  let tail = '';
  for (let i = 0; i < 4; i++) tail += alphabet[Math.floor(rand() * alphabet.length)];
  return `DL-${d}-${tail}`;
}
