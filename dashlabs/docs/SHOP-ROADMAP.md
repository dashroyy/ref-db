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
- `src/server-routes/api/checkout.ts` — `POST /api/checkout`: validates the cart, re-prices it, creates the session,
  returns Stripe's hosted payment URL.
- `src/server-routes/api/stripe-webhook.ts` — `POST /api/stripe-webhook`: verifies the signature and records
  `checkout.session.completed` (logs for now).
- `/order/success/` (clears the cart, shows the reference) and `/cart/?cancelled=1` (friendly "nothing was charged").

To switch it on:

1. Create a [Stripe](https://stripe.com) account. Stay in **test mode** to start.
2. Choose a host that runs server code and add its adapter: `npx astro add netlify` (or `vercel`, `cloudflare`,
   `node`). Pages stay static; only `/api/*` runs on the server.
3. Move the two files from `src/server-routes/api/` to `src/pages/api/`.
4. In the host's environment settings (never in the repo) set `STRIPE_SECRET_KEY` (`sk_test_…` first),
   `SITE_URL`, and later `STRIPE_WEBHOOK_SECRET`.
5. Set `CHECKOUT_MODE = 'stripe'` in `src/data/site.ts`. The cart button becomes "Checkout securely".
6. Pay with test card `4242 4242 4242 4242`, any future date, any CVC. Check the invoice email arrives.
7. In Stripe: add the webhook endpoint (event `checkout.session.completed`), turn on email notifications for
   successful payments, add your logo and colours under Branding (they appear on Checkout and invoices).
8. Switch to live keys when you're happy.

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
