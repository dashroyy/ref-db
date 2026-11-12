# DashLabs

Portfolio and made-to-order shop for DashLabs 3D printing: custom figurines of people and pets, printed business
cards, DashLabs originals (like the Pen Launcher) and licensed made-to-order prints.

Built with [Astro](https://astro.build). Static today; designed so online checkout and automatic invoices can be
switched on later without rewriting the shop. To put it online and take payments, follow
[docs/DEPLOY.md](docs/DEPLOY.md); the bigger picture is in [docs/SHOP-ROADMAP.md](docs/SHOP-ROADMAP.md).

## Run it

Requires Node.js 22+.

```bash
cd dashlabs
npm install
npm run dev      # http://localhost:4321
npm test         # unit tests: catalog, pricing, cart, tools
npm run smoke    # end-to-end customer journeys on the built site (needs Playwright)
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
src/lib/mesh.ts       STL measurements: exact volume, surface area, size, watertight check, fits-the-bed.
src/lib/fly.ts        Fly-to-cart animation and toasts.
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
      product. The product page then opens on your photos, with thumbnails underneath and a
      "3D" button that switches to the interactive model.
- [ ] Replace the example MakerWorld listings (dragon, vase) with models you actually hold a commercial licence for,
      with the real designer, link and licence. Many MakerWorld models are personal-use only. Selling prints of those
      isn't allowed.
- [ ] Replace the example build-log entries on `/lab/` with real projects.
- [ ] Set your real rates in `src/lib/estimate.ts` (`RATES`) and spool prices in `src/data/materials.ts`.
- [ ] Update `src/data/lab.ts` with your real printers and queue (and keep it current, or remove the board).
- [ ] Measure your Pen Launcher's spring and range and set `DEFAULT_LAUNCH` in `src/lib/launcher.ts` to match
      (update the worked example in the guide and its test too).
- [ ] Build with your real address so links, the sitemap and share previews are correct:
      `SITE_URL=https://your-domain.com npm run build`.
- [ ] Set real sizes (`size` in `src/data/catalog.ts`) for the Pen Launcher, cable dock and keychain. They're marked
      `placeholder: true` and show as "≈" in the Real size view until you do.
- [ ] Review the draft policies (`src/pages/policies.astro`) and the FAQ, then remove the "Draft" notice.
- [ ] Write the maker's note on the About page (`src/pages/about.astro`).
- [ ] After changing products, models or category colours, run `npm run thumbs` to re-render the thumbnails.

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
  - `stl.ts`: parses an uploaded STL in the browser (never uploaded anywhere) for the **instant STL quote** on
    `/custom/`, which prices it from its real volume and surface area (`estimateSolid()`), with scale, infill,
    material and quality, and hands the numbers to the request form.
  - Extra models: filament spools (materials guide) and a failed "spaghetti" print (404 page).
  Without WebGL, the drawn SVG artwork shows instead.
- **Layer scrubber** on product viewers, a **scroll story** on `/lab/` (`src/components/PrintStory.astro`: design →
  slice → print → finish, driven by scroll through the viewer's `scrub()` API), and **pick the next print** chips
  under the home-page printer (`printNow()` in `hero.ts`).
- **Slicer preview** in the price estimator: a top-down layer with walls and grid infill that follows the slider.
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

## Shop extras

- **Personalised products**: give a product `personalise: { label, max, placeholder }` and a `TEXT_COLOURS` option
  (see the Name keychain and business cards). Customers type their text and see it as raised 3D letters on the model,
  in the text colour they pick; the text is saved on the cart line. Models mark where text goes with a `text-anchor`
  in `src/lib/three/print.ts`. The 3D font is Helvetiker Bold (`public/fonts/`, MgOpen licence included).
- **Real size view**: the "Real size" button on a product's 3D viewer adds a centimetre ruler and a bank card
  (85.6 × 54 mm) at true scale, following the size option (`size` in the catalog; `src/lib/three/scale.ts`).
- **Saved for later**: hearts on cards and product pages, a count in the header, and `/saved/`. Kept in the visitor's
  browser (`src/lib/saved-store.ts`); no account needed.
- **Day shift / Night shift**: the sun/moon button switches to a light theme (remembered). Colours are tokens in
  `src/styles/global.css` (`:root[data-theme='light']`); the 3D turntable follows the theme. Both themes pass an axe
  accessibility audit.
- **Reviews and gallery**: `src/data/reviews.ts` holds customer reviews and customer-print photos. Both start empty
  and must only contain real ones; products show "No reviews yet" with a link to send one, and the gallery on `/lab/`
  appears once it has photos. Star ratings reach search results only when real reviews exist.
- **Flow**: order and custom requests open a "ready to send" dialog (open email app, copy message, copy address);
  the cart has remove with undo and suggestions when empty; phones get a sticky buy bar on product pages; guides end
  with a next step; a "got an idea?" band sits above the footer; pages cross-fade.
- **Thumbnails**: product, category and spool images are pre-rendered 3D (`public/thumbs/`, listed in
  `src/data/thumbs.json`). `npm run thumbs` rebuilds them with the site's own 3D code (needs Playwright). A product
  without one is rendered in the visitor's browser, so nothing breaks if you forget.
- **Gift finder** (`/gifts/`, logic and tags in `src/lib/gifts.ts`), **policies** (`/policies/`) and **About**
  (`/about/`).
- **Product pages**: a "ships by" date range (working days from today, the slower of the product's lead time and
  the lab queue; `src/lib/shipdate.ts`), "Good to know" (made to order, materials, care, returns, licence) built from
  the catalog, quick add on cards for items that need no typing, and a multi-colour preview for the Mini-Me finish.
- **Checks**: `.github/workflows/dashlabs.yml` runs tests, type check and build when `dashlabs/` changes.
- **Running the shop**: `docs/EMAIL-TEMPLATES.md` has ready-to-send replies (order total, custom quote, preview,
  shipped, review request, licence refusal) that match what the site promises.
- **Small things done right**: product choices live in the address (shareable links, Share button); the cart and
  request form remember name and email on the device; pages print cleanly; security headers are set in
  `netlify.toml`; a notice shows if JavaScript is off.
- **Search**: press `/` or Ctrl/⌘ K anywhere. The index (products, guides, tools, pages) is built from the catalog in
  `src/components/Search.astro`, so new products are searchable automatically.
- **Discoverability**: every product page carries schema.org Product data (price, SKU, made to order); every page
  has a canonical link and share tags with `public/og.png`; `/sitemap.xml` and `/robots.txt` are generated from the
  catalog.

## Adding a product

Add an entry to `PRODUCTS` in `src/data/catalog.ts`. Give it a new, permanent `id` (it ends up on orders and
invoices), a URL `slug`, a price in **cents** (`2400` = $24.00) and options with optional `priceDelta`s. Use
`purchase: 'quote'` for custom work that needs a quote first. Run `npm test`: it checks ids, slugs, prices and
licence details.
