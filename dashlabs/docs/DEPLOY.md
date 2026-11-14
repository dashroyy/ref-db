# Going live: Netlify + Stripe

No code changes are needed. Everything is switched on from Netlify's settings.

## 1. Put the site online (about 10 minutes, free)

1. Create an account at [netlify.com](https://www.netlify.com) and choose **Add new site → Import an existing
   project**, then pick this GitHub repository.
2. Set **Base directory** to `dashlabs`. Leave the rest: the build command and publish folder come from
   `dashlabs/netlify.toml`.
3. Deploy. You get an address like `something.netlify.app`. The shop works straight away in **order request** mode
   (orders arrive by email, you invoice by hand).
4. Your own domain: **Domain management → Add a domain** and follow the DNS steps. Netlify adds HTTPS for free.

At this point, finish the launch checklist in the README (real email, prices, photos, sizes, licences).

## 1b. Receive requests without the customer's email app (recommended, free)

By default a customer sends their order or custom request from their own email (the site writes the message for
them). Some people close that window without pressing send. To have requests come straight from the site instead:

1. In Netlify: **Site configuration → Environment variables → Add a variable**: `PUBLIC_ORDER_DELIVERY` =
   `netlify-form`. Redeploy (**Deploys → Trigger deploy**).
2. **Forms** in the Netlify menu: enable form detection if asked. After the deploy you'll see two forms, `order`
   and `custom`.
3. **Forms → Form notifications → Add notification → Email notification**: your shop inbox, for **Any form**.
   Each request then arrives as an email; reply to the customer at the address in it.
4. Test it: place an order request on the live site and check it arrives (and isn't in spam).

Every request is also kept in Netlify's **Forms** page, so nothing depends on one email arriving. Customers send
photos or files by replying to your email. If a direct send ever fails, the customer sees the email option
instead, so no order is lost. The free plan covers 100 submissions a month; spam is filtered (a hidden honeypot
field plus Netlify's own filter).

To switch back, delete the variable and redeploy.

## 2. Take payments (Stripe test mode first)

1. Create a [Stripe](https://stripe.com) account. Stay in **test mode**.
2. In Stripe: **Developers → API keys**, copy the **Secret key** (`sk_test_…`).
3. In Netlify: **Site configuration → Environment variables**, add:
   - `STRIPE_SECRET_KEY` = the secret key (never put it in the repository)
   - `PUBLIC_CHECKOUT_MODE` = `stripe`
4. **Deploys → Trigger deploy**. The cart button now says "Checkout securely".
5. Buy something with the test card `4242 4242 4242 4242` (any future date, any CVC). Check that:
   - you land on "Your print is queued",
   - the payment shows in Stripe,
   - the receipt and invoice email arrive (in test mode Stripe only emails your own account address).
6. In Stripe: **Settings → Branding** (logo and colours appear on checkout and invoices) and **Settings → Emails**
   (turn on "Successful payments" so you hear about every order).

## 3. Order notifications (optional)

In Stripe: **Developers → Webhooks → Add endpoint**, URL `https://YOUR-DOMAIN/api/stripe-webhook`, event
`checkout.session.completed`. Copy the signing secret (`whsec_…`) into Netlify as `STRIPE_WEBHOOK_SECRET` and
redeploy. Paid orders are then written to the function log (Netlify → Logs → Functions), ready to be extended to a
spreadsheet or a chat message.

## 4. Go live

Complete Stripe's account activation, switch Stripe to **live mode**, replace `STRIPE_SECRET_KEY` (and the webhook
secret) with the live ones, redeploy, and place one small real order to be sure.

## To pause online payments

Delete `PUBLIC_CHECKOUT_MODE` (or set it to `request`) and redeploy. The shop goes back to order requests.

## Settings you may want to change first

In `src/data/site.ts`: `SHIP_TO` (countries Stripe may ship to, default US only), `GIFT_WRAP_PRICE`, currency.
