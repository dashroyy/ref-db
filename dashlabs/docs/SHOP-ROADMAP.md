# Shop roadmap: from order requests to automated checkout and invoices

## Where it is now (phase 1: order requests)

- Full catalog, product pages with options and live prices, a cart that persists in the browser.
- **Fixed-price items**: the cart page sends an *order request* email with every line priced from the catalog and an
  order reference like `DL-261109-4K7Q`. You reply, confirm shipping, and send an invoice.
- **Custom work** (figurines, anything bespoke): the custom-order form emails a request; you quote and invoice.

Phase 1 needs no server, no payment account and no monthly cost. Host the `dist/` folder anywhere static (GitHub
Pages, Netlify, Cloudflare Pages).

**Tip:** you can already send professional invoices by hand. Create a free [Stripe](https://stripe.com) account and
use **Stripe Invoicing** from the dashboard. The customer gets an emailed invoice with a pay-by-card link, and Stripe
emails the receipt. Use the order reference as the invoice memo.

## Phase 2: automated checkout (Stripe Checkout) — code ready, switched off

All the code is written and tested; it is off until you have a Stripe account and a host that can run server code.

What's already there:

- `src/lib/stripe.ts` — builds the Checkout Session from the **server-priced** order (`buildOrder()`), with every line,
  its options and personalised text, gift wrap, the order reference, shipping countries (`SHIP_TO` in
  `src/data/site.ts`) and **`invoice_creation` on**, so Stripe emails a receipt and a numbered PDF invoice for every
  paid order. Also verifies webhook signatures. Tested in `tests/stripe.test.ts` (no network).
- `src/server-routes/api/checkout.ts` (served at `/api/checkout` on Netlify) — `POST /api/checkout`: validates the cart, re-prices it, creates the session,
  returns Stripe's hosted payment URL.
- `src/server-routes/api/stripe-webhook.ts` — `POST /api/stripe-webhook`: verifies the signature and records
  `checkout.session.completed` (logs for now).
- `/order/success/` (clears the cart, shows the reference) and `/cart/?cancelled=1` (friendly "nothing was charged").

To switch it on, follow **[DEPLOY.md](DEPLOY.md)**: deploy to Netlify, add two environment variables, test with
Stripe's test card. No code edits; the payment routes are added automatically on Netlify builds
(`astro.config.mjs`). On another host, add its Astro adapter there instead.

Optional later: Stripe Tax (`automaticTax: true` in the session options once registered), shipping rates.

## Phase 3: custom orders with deposits

For commissions: keep the request form, and when you send the quote, send a **Stripe invoice** for a deposit
(e.g. 50%) before sculpting, then a second invoice for the balance after the preview is approved. Later this can be
automated with a "quote accepted" link that creates the invoice via the API.

## Later ideas

- Order status page by reference + email.
- Photo upload on the custom-order form (needs file storage, e.g. Cloudflare R2 or S3, or a form service).
- Shipping rate calculation by weight/destination (Stripe shipping rates, or EasyPost/Shippo).
- Stock/"print queue" capacity limits so lead times stay honest.

## Things to keep true

- Prices live only in `src/data/catalog.ts` and are always re-computed on the server.
- Product `id`s never change once an order has used them.
- Only list licensed designs you have a commercial licence for. `npm test` enforces that the details are filled in.
