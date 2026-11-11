// POST /api/checkout — creates a Stripe Checkout Session from the cart.
//
// Added to the site only on Netlify builds (astro.config.mjs). It answers 503
// until STRIPE_SECRET_KEY is set in the host's environment; the cart uses it
// once PUBLIC_CHECKOUT_MODE=stripe is set too. See docs/DEPLOY.md.
// The browser only sends ids, options and quantities;
// every price is recomputed here from the catalog.
import type { APIRoute } from 'astro';
import { buildOrder, type CartLine } from '../../lib/order.ts';
import { createCheckoutSession } from '../../lib/stripe.ts';
import { SITE, SHIP_TO, GIFT_NOTE_MAX } from '../../data/site.ts';

export const prerender = false;

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '');

export const POST: APIRoute = async ({ request, url }) => {
  const env = (k: string) => (import.meta.env[k] as string | undefined) ?? (globalThis as { process?: { env: Record<string, string> } }).process?.env[k];
  const key = env('STRIPE_SECRET_KEY');
  if (!key) return Response.json({ error: 'Online checkout is not configured yet.' }, { status: 503 });

  let body: { cart?: unknown; customer?: Record<string, unknown>; extras?: Record<string, unknown> };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Bad request.' }, { status: 400 });
  }
  const cart: CartLine[] = (Array.isArray(body.cart) ? body.cart : [])
    .slice(0, 50)
    .filter((l): l is CartLine => !!l && typeof (l as CartLine).productId === 'string')
    .map((l) => ({
      productId: l.productId,
      options: Object.fromEntries(Object.entries(l.options ?? {}).map(([k, v]) => [String(k), String(v)])),
      qty: Number(l.qty) || 1,
      note: str(l.note, 200) || undefined,
    }));
  const customer = {
    name: str(body.customer?.name, 200),
    email: str(body.customer?.email, 200),
    notes: str(body.customer?.notes, 500) || undefined,
  };
  const order = buildOrder(cart, undefined, undefined, {
    giftWrap: body.extras?.giftWrap === true,
    giftNote: str(body.extras?.giftNote, GIFT_NOTE_MAX),
  });
  if (!order.lines.length) return Response.json({ error: 'Your cart is empty.' }, { status: 400 });

  const base = env('SITE_URL') ?? url.origin;
  try {
    const session = await createCheckoutSession(order, customer, {
      secretKey: key,
      currency: SITE.currency,
      successUrl: `${base}/order/success/?ref=${order.reference}&session={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${base}/cart/?cancelled=1`,
      shipTo: SHIP_TO,
    });
    return Response.json({ url: session.url });
  } catch (e) {
    console.error('Stripe checkout failed', e);
    return Response.json({ error: 'Checkout is unavailable right now. Please try again, or email me.' }, { status: 502 });
  }
};
