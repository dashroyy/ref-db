# DashLabs

The website for DashLabs 3D printing: custom figurines of people and pets, printed business cards, DashLabs
originals like the Pen Launcher, and licensed made-to-order prints. It's a portfolio, a shop and a set of
interactive guides, built with [Astro](https://astro.build) and [Three.js](https://threejs.org).

Orders currently arrive by email (you confirm and invoice). Online card payments with automatic invoices are built
and switched off; turning them on needs no code, see [docs/DEPLOY.md](docs/DEPLOY.md).

**Contents:** [Quick start](#quick-start) · [Everyday jobs](#everyday-jobs) · [Before you launch](#before-you-launch)
· [What's on the site](#whats-on-the-site) · [How it's built](#how-its-built) · [Commands](#commands)

---

## Quick start

Needs Node.js 22 or later.

```bash
cd dashlabs
npm install
npm run dev            # open http://localhost:4321
npm run launch-check   # what's still a placeholder?
```

## Everyday jobs

Almost everything you'll change lives in **`src/data/`**. Edit, save, and the dev server updates.

| I want to…                         | Edit                                   | Notes |
| ---------------------------------- | -------------------------------------- | ----- |
| Change a price                     | `src/data/catalog.ts`                  | Prices are in **cents**: `2400` is $24.00. |
| Add a product                      | `src/data/catalog.ts`                  | See [Adding a product](#adding-a-product). |
| Add product photos                 | `public/products/` + `images` in the catalog | The page opens on the photos; a "3D" button switches to the model. |
| Update the queue / printers        | `src/data/lab.ts`                      | Drives the header pill, home board and "ships by" dates. Change `updated` too. |
| Add a customer review              | `src/data/reviews.ts`                  | Real reviews only, with permission. Example inside. |
| Add a customer-print photo         | `public/gallery/` + `src/data/reviews.ts` | The gallery on /lab/ appears once there's one. |
| Change contact email, gift wrap, shipping countries | `src/data/site.ts`    | |
| Change your print rates            | `src/lib/estimate.ts` (`RATES`), `src/data/materials.ts` (spool prices) | Feeds the price estimator and STL quote. |
| Reply to a customer                | `docs/EMAIL-TEMPLATES.md`              | Order total, quote, preview, shipped, review request, licence refusal. |

After adding a product or changing a category colour, run **`npm run thumbs`** then **`npm run og`** to re-render the product images and link-preview cards
(it needs Playwright: `npx playwright install chromium`). If you forget, the site draws them live instead, so
nothing breaks.

### Adding a product

Copy an existing entry in `PRODUCTS` (`src/data/catalog.ts`) and change it:

- `id`: new and **permanent**; it ends up on orders and invoices.
- `slug`: the web address, `/shop/<slug>/`.
- `price` in cents, and `options` with optional `priceDelta`s (also cents).
- `purchase: 'quote'` for work that needs a quote first; `'cart'` for fixed-price items.
- `size` (real millimetres) for the Real size view; `personalise` for typed-in text (see the Name keychain).
- `art.shape` picks the 3D model; reuse one of the existing shapes.
- A community design? `source: { kind: 'licensed', designer, url, licence }`. Only list designs whose licence lets
  you sell prints. **Many MakerWorld models are personal-use only.**
- Add a line for it in `GIFT_TAGS` (`src/lib/gifts.ts`) so the gift finder knows who it suits.

Then `npm test`: it checks ids, slugs, prices, sizes, licences and gift tags.

## Before you launch

`npm run launch-check` lists what's left, from the site's own data. Today it reports:

- **Must fix:** contact email; the example MakerWorld listings (dragon, vase) and the cable dock's placeholder text;
  the example build log on /lab/; the maker's note on /about/; the "Draft" notice on /policies/ (review them
  first: they're commitments); the example printer names.
- **Check by hand:** every price, the estimator rates and spool prices, the gift-wrap price, the Pen Launcher spring
  numbers, and three approximate sizes (Pen Launcher, cable dock, keychain).
- **Nice to have:** product photos, social links, and (later) real reviews and customer photos.

Then follow [docs/DEPLOY.md](docs/DEPLOY.md) to go live on Netlify and, when ready, switch on Stripe payments.

## What's on the site

**Shop.** Catalog with category filters, sorting and quick add · product pages with an interactive 3D model
(drag to spin, recolours to the filament you pick, layer scrubber, "Watch it print", Real size ruler and bank card)
· live 3D text for personalised items · "ships by" dates from the real queue · "Good to know" (made to order,
materials, care, returns, licence) · shareable links that keep the chosen options · save for later · gift finder.

**Ordering.** Cart with gift wrap and a gift note, remove/undo, "ships" date · order requests and custom requests
open a "ready to send" dialog (email app, copy message, copy address) · custom orders page with a price guide,
instant **STL quote** (drop a 3D file, priced from its real volume; the file never leaves the device) · Stripe
Checkout with automatic invoices, ready to switch on.

**Learn.** Six guides, each with a tool and a worked example: materials, pricing (estimator with slicer preview),
Pen Launcher physics (launch lab), photos for figurines (checklist), designing for printing (printability check),
where prints can live (place picker).

**Brand.** The "print chamber" look: dark build chamber, hot amber and UV violet, extruded type and cards, sections
that print in as you scroll, a live 3D printer on the home page you can pick jobs for, a scroll story on /lab/, and
a light "Day shift" theme.

**Quality.** Accessibility audit (axe) clean in both themes · Lighthouse 100 for accessibility, best practices and
SEO · search-engine data for products, breadcrumbs and the FAQ · sitemap · share images · prints cleanly · respects
"reduce motion" and has a pause button · works without WebGL (drawn artwork instead) · tells you if JavaScript is off.

## How it's built

```
src/data/          the content: catalog, site settings, lab status, materials, guides, reviews
src/lib/           pure logic (tested): pricing, orders, checkout, Stripe, STL maths, ship dates, gifts, design rules
src/lib/three/     Three.js: printed-plastic material, models, hero printer, viewer, scale props, 3D text, STL
src/components/    header and menus, footer, product card, viewer, tools, search
src/pages/         every page; /learn/ holds the guides
src/server-routes/ Stripe checkout and webhook (added automatically on Netlify builds only)
public/            images, thumbnails (thumbs/), the hero still, fonts, icons
scripts/           thumbnail renderer, launch check, smoke test
tests/             unit tests
docs/              DEPLOY (go live), SHOP-ROADMAP (payments plan), EMAIL-TEMPLATES
```

Principles that keep it maintainable:

- **One source of truth.** Menus, search, sitemap, gift finder, price guide and thumbnails are all generated from
  the catalog, so a new product shows up everywhere.
- **Prices are never trusted from the browser.** Orders are re-priced from the catalog on the server (`buildOrder`).
- **Maths lives in `src/lib/` as pure functions with tests.** Each guide's worked example is its tool's default and
  is asserted in the tests.
- **Honest by default.** No invented reviews or photos; placeholders are marked and listed by the launch check;
  every estimate says where it stops.
- **Colours are tokens** in `src/styles/global.css` (dark by default, `[data-theme='light']` for Day shift).

## Commands

| Command                 | What it does |
| ----------------------- | ------------ |
| `npm run dev`           | Local site at http://localhost:4321 with live reload. |
| `npm test`              | Unit tests (catalog rules, pricing, cart, Stripe, STL, tools). |
| `npm run build`         | Build the static site into `dist/`. |
| `npm run smoke`         | Drive the built site like a customer: 14 journeys, every link, phone widths. Needs Playwright. |
| `npm run validate`      | Check every built page's HTML (run after `npm run build`; CI runs it too). |
| `npm run launch-check`  | List remaining placeholders. `-- --strict` fails while any must-fix item remains. |
| `npm run thumbs`        | Re-render product thumbnails and the home-page printer still. Needs Playwright. |
| `npm run og`            | Re-render each product's share card (the picture in iMessage/WhatsApp/Discord link previews). Run after `thumbs`, or after changing a name, summary, price or photo. |
| `npm run preview`       | Serve the built `dist/` locally. |

GitHub runs the tests, type check and build on every change to `dashlabs/` (`.github/workflows/dashlabs.yml`).
