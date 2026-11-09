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

## Phase 2: automated checkout (Stripe Checkout)

The code is already shaped for this. The steps:

1. **Pick a host with serverless functions** (Netlify, Vercel or Cloudflare) and add its Astro adapter, e.g.
   `npx astro add netlify`. Pages stay prerendered; only `/api/*` runs on the server.
2. **Add secrets** in the host's dashboard (never in the repo): `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`.
3. **Create `src/pages/api/checkout.ts`** (with `export const prerender = false`). It should:
   - read `{ cart, customer }` from the request,
   - call `buildOrder(cart)` from `src/lib/order.ts`. **This re-prices everything from the catalog on the server**;
     the browser only ever sends ids, options and quantities,
   - create a Stripe Checkout Session with one `price_data` line per order line (`unit_amount: line.unitPrice`,
     product name + `optionsText`), `customer_email`, `metadata.reference`, `shipping_address_collection`,
     `shipping_options`, `automatic_tax: { enabled: true }` if you register for tax, and
     **`invoice_creation: { enabled: true }`**, which makes Stripe generate a numbered PDF invoice for every paid
     order and email it to the customer automatically,
   - return `{ url: session.url }`.
4. **Add `src/pages/api/stripe-webhook.ts`** to receive `checkout.session.completed`. Verify the signature, then
   record the order: start simple (an email to yourself, or a row in a Google Sheet / Airtable), move to a database
   when volume justifies it.
5. **Add `/order/success` and `/order/cancelled` pages** for Stripe to redirect back to. The success page should
   clear the cart.
6. **Flip `CHECKOUT_MODE` to `'stripe'`** in `src/data/site.ts`. The cart page button and flow switch over; nothing
   else in the UI changes.

Test everything in Stripe **test mode** (card `4242 4242 4242 4242`) before switching to live keys.

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
