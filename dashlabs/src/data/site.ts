// Site-wide settings. Edit these before going live.

export const SITE = {
  name: 'DashLabs',
  tagline: 'Printed to order. Built to be played with.',
  description:
    'DashLabs is a one-person 3D printing lab: custom figurines of people and pets, printed business cards, ' +
    'made-to-order prints and original gadgets like the Pen Launcher.',
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
//               Needs a server adapter and STRIPE_SECRET_KEY — see docs/SHOP-ROADMAP.md.
export const CHECKOUT_MODE: 'request' | 'stripe' = 'request';

// Gift wrap, added per order (cents). Placeholder — set your own, or 0 to make it free.
export const GIFT_WRAP_PRICE = 300;
export const GIFT_NOTE_MAX = 240;

// Where Stripe may ship (ISO country codes), when online checkout is on.
export const SHIP_TO = ['US'];
