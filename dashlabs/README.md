# DashLabs

Portfolio and made-to-order shop for DashLabs 3D printing: custom figurines of people and pets, printed business
cards, DashLabs originals (like the Pen Launcher) and licensed made-to-order prints.

Built with [Astro](https://astro.build). Static today; designed so online checkout and automatic invoices can be
switched on later without rewriting the shop. See [docs/SHOP-ROADMAP.md](docs/SHOP-ROADMAP.md).

## Run it

Requires Node.js 22+.

```bash
cd dashlabs
npm install
npm run dev      # http://localhost:4321
npm test         # catalog, pricing and cart tests
npm run build    # static site in dist/
```

## Where things live

```
src/data/catalog.ts   THE CATALOG — every product, price, option and category. Edit this to change the shop.
src/data/site.ts      Business name, contact email, currency, checkout mode.
src/data/materials.ts Filament library (typical data-sheet values + your spool prices).
src/data/lab.ts       Lab status board on the home page — update by hand.
src/data/guides.ts    The Learn section's guides, in order.
src/lib/estimate.ts   Print price estimator maths (and your shop rates — RATES).
src/lib/launcher.ts   Pen Launcher physics for the Launch lab.
src/lib/order.ts      Cart → priced order (pure; will also run on the server for checkout).
src/lib/cart-store.ts Cart saved in the visitor's browser.
src/lib/checkout.ts   Checkout entry point: 'request' (email) now, 'stripe' later.
src/components/       Header, footer, product card, placeholder product artwork.
src/pages/            Home, shop, product pages, custom orders, the lab, learn guides, FAQ, cart.
tests/                Catalog rules and pricing/cart tests.
```

## Before you launch

- [ ] Set your real email in `src/data/site.ts` (orders and requests go there).
- [ ] Set real prices in `src/data/catalog.ts`. All current prices are placeholders.
- [ ] Add product photos: put them in `public/products/` and add `images: ['/products/pen-launcher-1.jpg']` to the
      product. They replace the generated placeholder artwork automatically.
- [ ] Replace the example MakerWorld listings (dragon, vase) with models you actually hold a commercial licence for,
      with the real designer, link and licence. Many MakerWorld models are personal-use only. Selling prints of those
      isn't allowed.
- [ ] Replace the example build-log entries on `/lab/` with real projects.
- [ ] Set your real rates in `src/lib/estimate.ts` (`RATES`) and spool prices in `src/data/materials.ts`.
- [ ] Update `src/data/lab.ts` with your real printers and queue (and keep it current, or remove the board).
- [ ] Measure your Pen Launcher's spring and range and set `DEFAULT_LAUNCH` in `src/lib/launcher.ts` to match
      (update the worked example in the guide and its test too).
- [ ] Read through the FAQ/policies (`src/pages/faq.astro`) and adapt the refund and shipping wording.

## Look and menu (sister site to REF·DB)

DashLabs uses REF·DB's visual language: the deep-field starfield (`src/components/hud/SpaceSky.astro`, copied from
REF·DB with the black hole switched off), glass header and rail, IBM Plex Sans/Mono, the REF·DB palette
(`#03050b` space, `#ff5a3d` accent, `#4fb3c6` cyan, blue-grey text) and its rules: words always sit on a solid
plate, dark by default, PAUSE MOTION stops everything.

- **Stations** = shop categories (plus Learn), each with its own colour, glyph and item code (F01, O01, B01, M01, L01),
  like REF·DB's phases and zone numbers. Set in `CATEGORIES` in `src/data/catalog.ts`.
- **The mission rail** (`src/components/Rail.astro`) and the station banner, home systems board and footer are all
  built from `src/data/nav.ts`, so a new product appears everywhere automatically.
- The page colour `--pc` follows the station you're in: rail highlight, banner, ▸ headings, tool corner brackets.

## Learn guides and tools (borrowed from REF·DB)

Each guide in `src/pages/learn/` follows the same shape: **at a glance → why it matters → intuition (an analogy and a
diagram) → the tool → a worked example → where this stops → references**. The rules carried over:

- Maths lives in `src/lib/*.ts` as pure functions; components only do UI.
- The worked example on a page is the tool's default input, and `tests/tools.test.ts` asserts the same numbers.
- Every analogy says where it breaks down; every tool says where it stops.
- Typical values are labelled typical; illustrative values are labelled illustrative.

The estimator doubles as your own pricing tool: set `RATES` in `src/lib/estimate.ts` and `pricePerKg` in
`src/data/materials.ts` to your real costs.

## Adding a product

Add an entry to `PRODUCTS` in `src/data/catalog.ts`. Give it a new, permanent `id` (it ends up on orders and
invoices), a URL `slug`, a price in **cents** (`2400` = $24.00) and options with optional `priceDelta`s. Use
`purchase: 'quote'` for custom work that needs a quote first. Run `npm test`: it checks ids, slugs, prices and
licence details.
