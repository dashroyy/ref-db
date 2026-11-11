// POST /api/stripe-webhook — Stripe tells us when an order is paid.
//
// Added to the site only on Netlify builds (see docs/DEPLOY.md).
// In the Stripe dashboard: Developers → Webhooks → add endpoint
//   https://your-domain/api/stripe-webhook   event: checkout.session.completed
// then set STRIPE_WEBHOOK_SECRET (whsec_…) in your host's environment.
//
// Stripe already emails the customer their receipt and invoice, and can email
// you on every payment (Settings → Email notifications). This hook is where to
// add your own record keeping later: a spreadsheet row, a database, a Discord
// ping to the print queue.
import type { APIRoute } from 'astro';
import { verifyStripeSignature } from '../../lib/stripe.ts';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const env = (k: string) => (import.meta.env[k] as string | undefined) ?? (globalThis as { process?: { env: Record<string, string> } }).process?.env[k];
  const raw = await request.text();
  const ok = await verifyStripeSignature(raw, request.headers.get('stripe-signature'), env('STRIPE_WEBHOOK_SECRET') ?? '');
  if (!ok) return new Response('Bad signature', { status: 400 });

  const event = JSON.parse(raw) as { type: string; data: { object: Record<string, unknown> } };
  if (event.type === 'checkout.session.completed') {
    const s = event.data.object as { id: string; amount_total?: number; metadata?: Record<string, string>; customer_details?: { email?: string } };
    // Record the paid order. For now it goes to the host's logs.
    console.log('PAID ORDER', s.metadata?.reference, s.id, s.amount_total, s.customer_details?.email, s.metadata?.gift_note ?? '');
  }
  return new Response('ok');
};
