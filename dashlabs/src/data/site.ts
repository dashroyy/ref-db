// Site-wide settings. Edit these before going live.

export const SITE = {
  name: 'DashLabs',
  tagline: 'Printed to order. Built to be played with.',
  description:
    'Custom 3D-printed figurines of people and pets, business cards and original gadgets like the Pen Launcher. Designed and printed to order by DashLabs.',
  // TODO: replace with your real business inbox. Quote requests and orders go here
  // until online checkout is switched on.
  email: 'hello@dashlabs.example',
  currency: 'USD',
  locale: 'en-US',
  // Turnaround shown on product pages when a product doesn't set its own.
  defaultLeadTimeDays: [3, 7] as [number, number],
  social: {
    instagram: '', // e.g. 'https://instagram.com/dashlabs'
    tiktok: '',
    makerworld: '', // your MakerWorld profile, if you publish designs there
  },
};

// How checkout behaves right now.
//   'request' : the cart is sent as an order request (email). You confirm and invoice by hand.
//   'stripe'  : the cart is posted to /api/checkout, which creates a Stripe Checkout Session.
//               Needs a server and STRIPE_SECRET_KEY.
// Switched from the host's settings, no code edit: set the environment variable
// PUBLIC_CHECKOUT_MODE=stripe (see docs/DEPLOY.md). Anything else means 'request'.
const envMode = (import.meta as { env?: Record<string, string | undefined> }).env?.PUBLIC_CHECKOUT_MODE;
export const CHECKOUT_MODE: 'request' | 'stripe' = envMode === 'stripe' ? 'stripe' : 'request';

// How order and custom requests reach you (works with CHECKOUT_MODE 'request').
//   'email'        : the customer sends the prepared message from their own email (default).
//   'netlify-form' : the site sends it straight to you through Netlify Forms; Netlify
//                    emails it to you. Falls back to 'email' if sending fails.
// Switched from the host's settings: PUBLIC_ORDER_DELIVERY=netlify-form (see docs/DEPLOY.md).
const envDelivery = (import.meta as { env?: Record<string, string | undefined> }).env?.PUBLIC_ORDER_DELIVERY;
export const ORDER_DELIVERY: 'email' | 'netlify-form' = envDelivery === 'netlify-form' ? 'netlify-form' : 'email';

// Gift wrap, added per order (cents). Placeholder — set your own, or 0 to make it free.
export const GIFT_WRAP_PRICE = 300;
export const GIFT_NOTE_MAX = 240;

// Where Stripe may ship (ISO country codes), when online checkout is on.
export const SHIP_TO = ['US'];
