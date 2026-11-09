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
src/lib/order.ts      Cart → priced order (pure; will also run on the server for checkout).
src/lib/cart-store.ts Cart saved in the visitor's browser.
src/lib/checkout.ts   Checkout entry point: 'request' (email) now, 'stripe' later.
src/components/       Header, footer, product card, placeholder product artwork.
src/pages/            Home, shop, product pages, custom orders, the lab, FAQ, cart.
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
- [ ] Read through the FAQ/policies (`src/pages/faq.astro`) and adapt the refund and shipping wording.

## Adding a product

Add an entry to `PRODUCTS` in `src/data/catalog.ts`. Give it a new, permanent `id` (it ends up on orders and
invoices), a URL `slug`, a price in **cents** (`2400` = $24.00) and options with optional `priceDelta`s. Use
`purchase: 'quote'` for custom work that needs a quote first. Run `npm test`: it checks ids, slugs, prices and
licence details.
