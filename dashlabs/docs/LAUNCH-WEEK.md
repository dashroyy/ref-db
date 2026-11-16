# Launch week: from placeholders to live

Everything the site still needs from you, in a sensible order. Each step says exactly where to make the change.
Run `npm run launch-check` at any point to see what's left; it reads the same files.

Start the preview with `npm run dev` and keep it open at http://localhost:4321 while you work: changes show as
soon as you save.

## 1. The essentials (about 30 minutes)

- [ ] **Your shop email.** `src/data/site.ts` → `email`. Use a separate shop inbox, not your personal one: it's
      shown publicly and every order goes there.
- [ ] **Prices.** `src/data/catalog.ts`. Prices are in **cents** (`2400` = $24.00), and option extras are
      `priceDelta` (`300` = +$3). Check every product and every option. Search results show the price range
      automatically.
- [ ] **Gift wrap price.** `src/data/site.ts` → `GIFT_WRAP_PRICE` (cents; `0` makes it free).
- [ ] **Your print rates.** `src/lib/estimate.ts` → `RATES` (machine $/hour, handling, margin) and
      `src/data/materials.ts` (spool prices). These drive the price estimator and the instant STL quote.

## 2. Make the catalogue real (1–2 hours)

- [ ] **Remove or replace the example MakerWorld items** (Articulated dragon, Spiral vase). Only list community
      designs whose licence allows selling prints, and fill in the designer, licence and link. If in doubt, delete
      the product: `src/data/catalog.ts`.
- [ ] **Rewrite placeholder descriptions** (Desk cable dock, and the two above if you keep them).
- [ ] **Real sizes.** In `src/data/catalog.ts`, each product's `size` drives the "Real size" ruler in the 3D viewer.
      Measure your prints and remove `placeholder: true` once a size is right (the ≈ sign then disappears).
- [ ] **Pen Launcher physics.** `src/lib/launcher.ts` → `DEFAULT_LAUNCH`: measure your spring and see how far a pen
      really flies, so the launch lab matches reality. The physics guide's worked example recalculates itself.

## 3. Photos (as many as you have)

Phone photos straight off the camera are fine: they're resized and compressed automatically. **JPG, not HEIC**
(iPhone: Settings → Camera → Formats → *Most Compatible*).

- [ ] **Product photos** → `src/photos/products/<product>/01-description.jpg` (folder names are listed in the
      README there). The first photo becomes the main image everywhere.
- [ ] **Workshop photo** (optional) → `src/photos/about/`, named in the maker's note (step 4).
- [ ] **Build-log photos** (optional) → `src/photos/build-log/`.
- [ ] Then run **`npm run og`** so link previews use your photos.

## 4. Your words

- [ ] **Maker's note** → `src/writing/maker-note.md`. A few short paragraphs: how DashLabs started, your first
      print, why the Pen Launcher exists. Set `draft: false`, add a `signature`.
- [ ] **Build log** → `src/writing/build-log/`. One file per project (see the README there). Delete the three
      example files.
- [ ] **Policies** → `src/pages/policies.astro`. Read them properly: they're promises to customers (returns,
      shipping, custom work, privacy). Adjust, then remove the "Draft" notice.
- [ ] **FAQ** → `src/data/faq.ts`. Check the answers still match the policies.
- [ ] **Printers** → `src/data/lab.ts`: your real printer names, the queue, and today's date in `updated`
      (after 3 weeks without an update the site quietly stops showing the queue as live).
- [ ] **Social links** (optional) → `src/data/site.ts` → `social`.

## 5. Check everything

- [ ] `npm run launch-check`: nothing left under "Must fix".
- [ ] `npm run verify`: tests, build, HTML checks and the customer journeys all pass.
- [ ] Click through the site on your phone: a product, add to cart, send a test order request to yourself.

## 6. Go live (about 10 minutes, free)

Follow **`docs/DEPLOY.md`**, step 1: connect the repository to Netlify (Base directory `dashlabs`). Then:

- [ ] **Recommended:** step 1b, so order requests arrive straight from the site (no customer email app needed).
- [ ] Your own domain (optional): Netlify → Domain management.
- [ ] Place a real test order on the live site and check it reaches your inbox (and not spam).
- [ ] Open `yoursite/desk/` and bookmark it: paste an order email there to print the packing slip and gift card and
      draft your reply.

## Later

- **Card payments:** `docs/DEPLOY.md` steps 2–4 (Stripe test mode first, then live). Paid orders email you the
  making details.
- **Reviews and customer photos:** add real ones, with permission, as they come in: `src/data/reviews.ts`, photos in
  `src/photos/gallery/`.
- **Keep the queue fresh:** update `src/data/lab.ts` when things change.
- **Now and then:** `npm audit` for dependency updates; `npm run verify` before publishing changes.
