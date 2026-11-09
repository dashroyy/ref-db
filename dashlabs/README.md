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
src/components/       Header (menus), footer, product card, 3D hero and viewer, fallback artwork.
src/lib/three/        Three.js: printed-plastic material, procedural models, hero printer, viewer, thumbnails.
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

## Look and feel: the print chamber

DashLabs is designed as a dark 3D-printer build chamber, lit by a hot amber nozzle and UV violet.

- **Palette and type** (`src/styles/global.css`): ink `#08070d`, hot amber `#ffab2e`, UV violet `#9b6bff`, mint
  `#3dffc5`; Unbounded for display, Manrope for text, JetBrains Mono for labels.
- **Extruded everything**: headlines (`.x3d`), cards, buttons and panels carry stacked layers like a printed part.
- **Print-in**: anything with `data-print` builds up from the bottom in layers, with a hot nozzle line, as it scrolls
  into view. `data-tilt` makes a card tilt toward the pointer.
- **Real 3D (Three.js, `src/lib/three/`)**:
  - `hero.ts`: the home-page printer prints models layer by layer, then ejects them.
  - `viewer.ts`: the product viewer (drag to spin, recolours to the chosen filament, "Watch it print"), and
    `renderThumbs()` which renders every product card's 3D thumbnail in the browser with one WebGL context.
  - `print.ts`: the printed-plastic material (layer lines, hot fresh-layer glow, silk rainbow) and the procedural
    model for each product `art.shape`.
  Without WebGL, the drawn SVG artwork shows instead.
- **Menus** (`src/components/Header.astro`): the Shop mega-menu and the phone menu are built from `src/data/nav.ts`,
  so new products appear automatically. Each category's colour is set in `CATEGORIES` in `src/data/catalog.ts`.
- **Motion**: the pause button in the header (remembered per visitor) and the system "reduce motion" setting stop all
  animation; the hero then shows a finished print as a still.

## Learn guides and tools

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
