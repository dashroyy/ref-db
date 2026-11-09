// Browser-side cart storage. The cart lives in the visitor's localStorage until
// checkout; it is a convenience, not the record of an order.

import { addLine, setQty, type CartLine } from './order.ts';

const KEY = 'dashlabs.cart.v1';
const EVENT = 'dashlabs:cart';

export function readCart(): CartLine[] {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((l) => l && typeof l.productId === 'string') : [];
  } catch {
    return [];
  }
}

function write(cart: CartLine[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(cart));
  } catch {
    /* storage blocked (private mode etc.) — the cart just won't persist */
  }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: cart }));
}

export const addToCart = (line: CartLine) => write(addLine(readCart(), line));
export const updateQty = (index: number, qty: number) => write(setQty(readCart(), index, qty));
export const clearCart = () => write([]);
export const cartCount = () => readCart().reduce((n, l) => n + l.qty, 0);

export function onCartChange(fn: (cart: CartLine[]) => void) {
  window.addEventListener(EVENT, (e) => fn((e as CustomEvent<CartLine[]>).detail));
  window.addEventListener('storage', (e) => e.key === KEY && fn(readCart()));
}
