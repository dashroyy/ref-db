// POST /api/stripe-webhook — Stripe tells us when an order is paid.
//
// Added to the site only on Netlify builds (see docs/DEPLOY.md).
// In the Stripe dashboard: Developers → Webhooks → add endpoint
//   https://your-domain/api/stripe-webhook   event: checkout.session.completed
// then set STRIPE_WEBHOOK_SECRET (whsec_…) in your host's environment.
//
// Stripe already emails the customer their receipt and invoice. This hook sends
// YOU the making details (items, options, personalised text, gift note, address)
// as a 'paid-order' Netlify Form submission, which Netlify emails to you (set up
// a form notification; see docs/DEPLOY.md). It's also where to add your own
// record keeping later: a spreadsheet row, a database, a Discord ping.
import type { APIRoute } from 'astro';
import { verifyStripeSignature, fetchLineItems, paidOrderMessage, type PaidSession } from '../../lib/stripe.ts';
import { encodeDelivery } from '../../lib/deliver.ts';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const env = (k: string) => (import.meta.env[k] as string | undefined) ?? (globalThis as { process?: { env: Record<string, string> } }).process?.env[k];
  const raw = await request.text();
  const ok = await verifyStripeSignature(raw, request.headers.get('stripe-signature'), env('STRIPE_WEBHOOK_SECRET') ?? '');
  if (!ok) return new Response('Bad signature', { status: 400 });

  const event = JSON.parse(raw) as { type: string; data: { object: Record<string, unknown> } };
  if (event.type === 'checkout.session.completed') {
    const s = event.data.object as unknown as PaidSession;
    const items = await fetchLineItems(s.id, env('STRIPE_SECRET_KEY') ?? '');
    const msg = paidOrderMessage(s, items);
    console.log('PAID ORDER', msg.reference, s.id, s.amount_total);
    // Netlify sets URL to the site's main address; the submission becomes an email to you
    const site = env('URL');
    if (site) {
      try {
        const res = await fetch(new URL('/', site), {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: encodeDelivery({ form: 'paid-order', name: msg.name, email: msg.email, subject: msg.subject, message: msg.text, reference: msg.reference }),
        });
        if (!res.ok) console.log('paid-order notice not stored', res.status, '\n' + msg.text);
      } catch (e) {
        // the payment is safe in Stripe either way; the log keeps the details
        console.log('paid-order notice failed', String(e), '\n' + msg.text);
      }
    } else console.log(msg.text);
  }
  return new Response('ok');
};
