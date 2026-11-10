// THE CATALOG — single source of truth for the shop.
// Every page (home, shop, product pages, cart) reads from here, and when online
// checkout is switched on, the server re-prices the cart from this file too,
// so prices can never be changed from the browser.
//
// Money is stored in integer cents (1999 = $19.99) to avoid rounding errors.
// All prices below are PLACEHOLDERS — set your own before launch.

export type CategoryId = 'custom' | 'originals' | 'cards' | 'made-to-order';

export interface Category {
  id: CategoryId;
  label: string;
  short: string; // rail/station name, e.g. FIGURINES
  sub: string; // one line under the station name
  code: string; // SKU prefix: F01, O01, B01…
  glyph: string;
  color: string; // the category's filament colour, used across the site
  blurb: string;
}

// Each category has its own filament colour, used for its tiles, tags and menu entries.
export const CATEGORIES: Category[] = [
  {
    id: 'custom',
    label: 'Custom figurines',
    short: 'FIGURINES',
    sub: 'People & pets, from photos',
    code: 'F',
    glyph: '◎',
    color: '#ff6ec7',
    blurb: 'You send photos, I model and print a miniature of your person, pet or thing.',
  },
  {
    id: 'originals',
    label: 'DashLabs originals',
    short: 'ORIGINALS',
    sub: 'Designed in the lab',
    code: 'O',
    glyph: '▲',
    color: '#ffab2e',
    blurb: "Gadgets and toys I designed myself — you won't find these anywhere else.",
  },
  {
    id: 'cards',
    label: 'Business cards',
    short: 'CARDS',
    sub: 'Printed, QR & NFC',
    code: 'B',
    glyph: '⊞',
    color: '#3dffc5',
    blurb: 'Printed cards that people actually keep. Your logo, your colours.',
  },
  {
    id: 'made-to-order',
    label: 'Made to order',
    short: 'MADE TO ORDER',
    sub: 'Licensed community designs',
    code: 'M',
    glyph: '⚙',
    color: '#8f8cff',
    blurb: "Great community designs I'm licensed to print and sell, made in the colours you pick.",
  },
];

// How a product is bought:
//   'cart'  : fixed price, goes straight in the cart.
//   'quote' : priced per job (custom work). Shows "from" price; leads to the request form.
export type PurchaseMode = 'cart' | 'quote';

export interface OptionChoice {
  id: string;
  label: string;
  priceDelta?: number; // cents added to the base price
  hex?: string; // filament colour, used by the 3D viewer ('rainbow' for silk)
}

export interface ProductOption {
  id: string;
  label: string;
  choices: OptionChoice[];
}

// Where a design comes from. This matters legally: you may only SELL prints of
// a design you own or have a commercial licence for.
export type Source =
  | { kind: 'original' }
  | { kind: 'commission' }
  | {
      kind: 'licensed';
      designer: string;
      url: string; // the model's MakerWorld (or other) page
      licence: string; // the licence that permits selling prints, e.g. 'MakerWorld Commercial License'
    };

export interface Product {
  id: string; // stable id — used in carts, orders and invoices. Never change it once live.
  slug: string; // URL: /shop/<slug>
  name: string;
  category: CategoryId;
  summary: string; // one line, used on cards
  description: string[]; // paragraphs on the product page
  price: number; // cents. For 'quote' products this is the "from" price.
  purchase: PurchaseMode;
  options: ProductOption[];
  specs: { label: string; value: string }[];
  leadTimeDays?: [number, number];
  source: Source;
  featured?: boolean;
  art: { hue: number; shape: ArtShape }; // placeholder artwork until real photos exist
  images?: string[]; // later: paths under /public/products/
  stripePriceId?: string; // later: optional link to a Stripe Price
  tool?: 'launch-lab'; // an interactive tool shown on the product page
  guide?: string; // slug of a related /learn/ guide
}

export type ArtShape = 'bust' | 'paw' | 'card' | 'launcher' | 'dragon' | 'vase' | 'organizer' | 'keychain';

export const COLOURS: ProductOption = {
  id: 'colour',
  label: 'Filament colour',
  choices: [
    { id: 'black', label: 'Matte black', hex: '#2b2a33' },
    { id: 'white', label: 'Bone white', hex: '#ece6da' },
    { id: 'orange', label: 'Lab orange', hex: '#ff8a1f' },
    { id: 'blue', label: 'Signal blue', hex: '#2f7dff' },
    { id: 'silk', label: 'Silk rainbow', priceDelta: 300, hex: 'rainbow' },
  ],
};

export const PRODUCTS: Product[] = [
  {
    id: 'cust-person',
    slug: 'custom-person-figurine',
    name: 'Mini-Me figurine',
    category: 'custom',
    summary: 'A miniature of you, a friend or a family member, modelled from your photos.',
    description: [
      'Send a few clear photos (front, side and back if you can) and tell me the pose and outfit. ' +
        'I sculpt a stylised model, send you a preview render to approve, then print it.',
      'Great for birthdays, weddings, cake toppers, team gifts and desk buddies.',
    ],
    price: 4500,
    purchase: 'quote',
    options: [
      {
        id: 'size',
        label: 'Height',
        choices: [
          { id: '8cm', label: '8 cm' },
          { id: '12cm', label: '12 cm', priceDelta: 1500 },
          { id: '18cm', label: '18 cm', priceDelta: 3500 },
        ],
      },
      {
        id: 'finish',
        label: 'Finish',
        choices: [
          { id: 'mono', label: 'Single colour' },
          { id: 'multi', label: 'Multi-colour print', priceDelta: 2000 },
        ],
      },
    ],
    specs: [
      { label: 'Process', value: 'Photo → sculpt → preview → print' },
      { label: 'Revisions', value: '1 round of changes included' },
    ],
    leadTimeDays: [7, 14],
    source: { kind: 'commission' },
    featured: true,
    art: { hue: 24, shape: 'bust' },
  },
  {
    id: 'cust-pet',
    slug: 'custom-pet-figurine',
    name: 'Pet portrait figurine',
    category: 'custom',
    summary: 'Your dog, cat, lizard or chicken — immortalised in plastic.',
    description: [
      'Send photos of your pet from a few angles plus anything special about them — a collar, a favourite toy, the ' +
        'way they sit. You approve a preview before anything is printed.',
      'A lovely memorial piece, too.',
    ],
    price: 3500,
    purchase: 'quote',
    options: [
      {
        id: 'size',
        label: 'Size',
        choices: [
          { id: 'small', label: 'Small (≈6 cm)' },
          { id: 'medium', label: 'Medium (≈10 cm)', priceDelta: 1500 },
          { id: 'large', label: 'Large (≈15 cm)', priceDelta: 3000 },
        ],
      },
      {
        id: 'base',
        label: 'Base',
        choices: [
          { id: 'none', label: 'No base' },
          { id: 'name', label: 'Base with name', priceDelta: 500 },
        ],
      },
    ],
    specs: [
      { label: 'Process', value: 'Photos → sculpt → preview → print' },
      { label: 'Revisions', value: '1 round of changes included' },
    ],
    leadTimeDays: [7, 14],
    source: { kind: 'commission' },
    featured: true,
    art: { hue: 200, shape: 'paw' },
  },
  {
    id: 'orig-pen-launcher',
    slug: 'pen-launcher',
    name: 'Pen Launcher',
    category: 'originals',
    summary: 'My own design. Load a pen, pull back, and send it across the office.',
    description: [
      'The DashLabs Pen Launcher is an original design: a spring-powered desk launcher that takes a standard ' +
        'ballpoint pen. Designed, tested and iterated here in the lab.',
      'Not a toy for small children — aim at targets, never at people or pets.',
    ],
    price: 2400,
    purchase: 'cart',
    options: [COLOURS],
    specs: [
      { label: 'Fits', value: 'Standard ballpoint pens' },
      { label: 'Material', value: 'PLA+ / PETG' },
      { label: 'Assembly', value: 'Ships assembled' },
    ],
    source: { kind: 'original' },
    featured: true,
    art: { hue: 24, shape: 'launcher' },
    tool: 'launch-lab',
    guide: 'pen-launcher-physics',
  },
  {
    id: 'cards-standard',
    slug: 'printed-business-cards',
    name: 'Printed business cards',
    category: 'cards',
    summary: 'Card-sized prints with your name, logo and a QR code. Two-colour, crisp text.',
    description: [
      'Thin, rigid, two-colour cards printed with your logo and details. Add a QR code to your site, portfolio or ' +
        'socials. I send a proof before printing.',
      'Send your logo as SVG or a high-resolution PNG after ordering.',
    ],
    price: 2500,
    purchase: 'cart',
    options: [
      {
        id: 'qty',
        label: 'Quantity',
        choices: [
          { id: '10', label: '10 cards' },
          { id: '25', label: '25 cards', priceDelta: 2500 },
          { id: '50', label: '50 cards', priceDelta: 4500 },
        ],
      },
      {
        id: 'style',
        label: 'Style',
        choices: [
          { id: 'flat', label: 'Flat two-colour' },
          { id: 'raised', label: 'Raised (embossed) text', priceDelta: 1000 },
          { id: 'nfc', label: 'With NFC tag (tap to open link)', priceDelta: 2000 },
        ],
      },
    ],
    specs: [
      { label: 'Size', value: '85 × 55 mm' },
      { label: 'Proof', value: 'Digital proof before printing' },
    ],
    leadTimeDays: [4, 8],
    source: { kind: 'original' },
    featured: true,
    art: { hue: 160, shape: 'card' },
  },
  {
    id: 'orig-cable-organizer',
    slug: 'desk-cable-dock',
    name: 'Desk cable dock',
    category: 'originals',
    summary: 'A weighted dock that keeps your charging cables from falling behind the desk.',
    description: ['Five slots for USB-C, Lightning and micro-USB cables. Placeholder product — replace with your own.'],
    price: 1200,
    purchase: 'cart',
    options: [COLOURS],
    specs: [{ label: 'Slots', value: '5' }],
    source: { kind: 'original' },
    art: { hue: 260, shape: 'organizer' },
  },
  // ── Made to order ─────────────────────────────────────────────────────────
  // Only list a community model here once you hold a licence that lets you sell
  // prints of it (on MakerWorld: the designer's Commercial License, or a licence
  // the designer grants you directly). Fill in the real designer, URL and licence.
  // The catalog test refuses a 'licensed' product without them.
  {
    id: 'mto-flexi-dragon',
    slug: 'articulated-dragon',
    name: 'Articulated dragon',
    category: 'made-to-order',
    summary: 'Print-in-place flexi dragon. Wiggly, satisfying, fidget-friendly.',
    description: [
      'A print-in-place articulated dragon from the MakerWorld community, printed in the colour you choose.',
      'EXAMPLE LISTING — replace the designer, link and licence below with the real model you hold a licence for.',
    ],
    price: 1800,
    purchase: 'cart',
    options: [
      COLOURS,
      {
        id: 'size',
        label: 'Length',
        choices: [
          { id: '20', label: '20 cm' },
          { id: '35', label: '35 cm', priceDelta: 1000 },
        ],
      },
    ],
    specs: [{ label: 'Moving parts', value: 'Fully articulated' }],
    source: {
      kind: 'licensed',
      designer: 'EXAMPLE — designer name',
      url: 'https://makerworld.com/',
      licence: 'EXAMPLE — MakerWorld Commercial License',
    },
    art: { hue: 340, shape: 'dragon' },
  },
  {
    id: 'mto-vase',
    slug: 'spiral-vase',
    name: 'Spiral vase',
    category: 'made-to-order',
    summary: 'A tall twisted vase printed in a single continuous spiral.',
    description: [
      'Decorative (not watertight) vase for dried flowers. EXAMPLE LISTING — replace with a real licensed model.',
    ],
    price: 2200,
    purchase: 'cart',
    options: [COLOURS],
    specs: [{ label: 'Height', value: '≈20 cm' }],
    source: {
      kind: 'licensed',
      designer: 'EXAMPLE — designer name',
      url: 'https://makerworld.com/',
      licence: 'EXAMPLE — MakerWorld Commercial License',
    },
    art: { hue: 50, shape: 'vase' },
  },
  {
    id: 'mto-keychain',
    slug: 'name-keychain',
    name: 'Name keychain',
    category: 'made-to-order',
    summary: 'Your name or a short word, two-colour, on a sturdy ring.',
    description: ['Tell me the text at checkout (up to 12 characters).'],
    price: 800,
    purchase: 'cart',
    options: [COLOURS],
    specs: [{ label: 'Text', value: 'Up to 12 characters' }],
    source: { kind: 'original' },
    art: { hue: 120, shape: 'keychain' },
  },
];

export const productBySlug = (slug: string) => PRODUCTS.find((p) => p.slug === slug);
export const productById = (id: string) => PRODUCTS.find((p) => p.id === id);
export const categoryById = (id: CategoryId) => CATEGORIES.find((c) => c.id === id)!;
export const productsIn = (id: CategoryId) => PRODUCTS.filter((p) => p.category === id);

/** SKU code: F01, O02, B01… (by position in its category). */
export function productCode(p: Product): string {
  const c = categoryById(p.category);
  return c.code + String(productsIn(p.category).indexOf(p) + 1).padStart(2, '0');
}

// Price of a product with a set of chosen options (optionId → choiceId).
// Unknown or missing choices fall back to the first choice.
export function priceFor(product: Product, chosen: Record<string, string> = {}): number {
  let total = product.price;
  for (const opt of product.options) {
    const choice = opt.choices.find((c) => c.id === chosen[opt.id]) ?? opt.choices[0];
    total += choice?.priceDelta ?? 0;
  }
  return total;
}

// Normalise a choice map so it only has valid option/choice ids for this product.
export function normaliseOptions(product: Product, chosen: Record<string, string> = {}): Record<string, string> {
  const out: Record<string, string> = {};
  for (const opt of product.options) {
    const choice = opt.choices.find((c) => c.id === chosen[opt.id]) ?? opt.choices[0];
    if (choice) out[opt.id] = choice.id;
  }
  return out;
}

export function describeOptions(product: Product, chosen: Record<string, string>): string {
  return product.options
    .map((opt) => {
      const choice = opt.choices.find((c) => c.id === chosen[opt.id]);
      return choice ? `${opt.label}: ${choice.label}` : null;
    })
    .filter(Boolean)
    .join(' · ');
}
