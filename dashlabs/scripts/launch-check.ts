// What still needs doing before launch?   npm run launch-check
// Reads the site's own data and pages and lists every placeholder left.
// Add --strict to exit with an error while "must fix" items remain (for CI).
import { readFileSync, existsSync } from 'node:fs';
import { SITE, GIFT_WRAP_PRICE } from '../src/data/site.ts';
import { PRODUCTS } from '../src/data/catalog.ts';
import { GUIDES } from '../src/data/guides.ts';
import { LAB_STATUS } from '../src/data/lab.ts';
import { REVIEWS, GALLERY } from '../src/data/reviews.ts';
import { RATES } from '../src/lib/estimate.ts';
import { DEFAULT_LAUNCH } from '../src/lib/launcher.ts';

const must: string[] = [];
const check: string[] = [];
const nice: string[] = [];
const page = (p: string) => readFileSync(new URL(`../src/pages/${p}`, import.meta.url), 'utf8');
const names = (list: { name: string }[]) => list.map((p) => p.name).join(', ');

// ── must fix: things a customer would see as wrong or fake ──
if (SITE.email.endsWith('.example')) must.push(`Contact email is still the placeholder (${SITE.email}). Orders go there. → src/data/site.ts`);
const exampleLicence = PRODUCTS.filter((p) => p.source.kind === 'licensed' && /EXAMPLE/i.test(`${p.source.designer}${p.source.licence}`));
if (exampleLicence.length) must.push(`Example licence details on: ${names(exampleLicence)}. Replace with designs you hold a commercial licence for, or remove them. → src/data/catalog.ts`);
const exampleText = PRODUCTS.filter((p) => /EXAMPLE LISTING|Placeholder product/i.test(p.description.join(' ')));
if (exampleText.length) must.push(`Placeholder descriptions on: ${names(exampleText)}. → src/data/catalog.ts`);
if (/example: true/.test(page('lab.astro'))) must.push('The build log on /lab/ still shows "Example" entries. → src/pages/lab.astro');
if (/maker's note to be written/i.test(page('about.astro'))) must.push('The About page still has the "maker\'s note to be written" block. → src/pages/about.astro');
if (/<strong>Draft\.<\/strong>/.test(page('policies.astro'))) must.push('Policies are still marked Draft. Review them, then remove the notice. → src/pages/policies.astro');
if (LAB_STATUS.printers.some((p) => /^Printer \d+$/.test(p.name))) must.push('Lab status shows example printers ("Printer 01"). → src/data/lab.ts');

// ── check by hand: I can't tell a placeholder number from a real one ──
check.push(`Prices: confirm every product price and option (currently ${PRODUCTS.map((p) => `${p.name} $${(p.price / 100).toFixed(0)}`).join(', ')}). → src/data/catalog.ts`);
check.push(`Estimator rates: $${RATES.machinePerHour}/h machine, $${RATES.handling} handling, ${RATES.margin * 100}% margin; and spool prices. → src/lib/estimate.ts, src/data/materials.ts`);
check.push(`Gift wrap price: $${(GIFT_WRAP_PRICE / 100).toFixed(2)}. → src/data/site.ts`);
check.push(`Pen Launcher physics defaults (${DEFAULT_LAUNCH.k} N/m spring, ${DEFAULT_LAUNCH.efficiency * 100}% efficiency) are illustrative. Measure yours. → src/lib/launcher.ts`);
const approx = PRODUCTS.filter((p) => p.size?.placeholder);
if (approx.length) check.push(`Approximate sizes (shown with "≈") on: ${names(approx)}. → src/data/catalog.ts`);
const age = Math.round((Date.now() - new Date(LAB_STATUS.updated).getTime()) / 864e5);
if (age > 14) check.push(`Lab status was last updated ${age} days ago (${LAB_STATUS.updated}). → src/data/lab.ts`);
if (!process.env.SITE_URL && !process.env.URL) check.push('Build with your real address (SITE_URL=https://your-domain) so share previews and the sitemap are right. Netlify sets this for you.');

// ── nice to have ──
const noPhotos = PRODUCTS.filter((p) => !p.images?.length);
if (noPhotos.length) nice.push(`${noPhotos.length} of ${PRODUCTS.length} products have no photos yet (they show the 3D model): ${names(noPhotos)}.`);
const noCard = [...PRODUCTS.filter((p) => !existsSync(`public/og/${p.slug}.jpg`)).map((p) => p.name), ...GUIDES.filter((g) => !existsSync(`public/og/learn-${g.slug}.jpg`)).map((g) => g.title)];
if (noCard.length) nice.push(`No share card for: ${noCard.join(', ')} (links show the generic card). Run npm run og.`);
nice.push('After changing a product or guide name, summary, price or photos, run npm run og so link previews match.');
if (!Object.values(SITE.social).some(Boolean)) nice.push('No social links set. → src/data/site.ts');
if (!REVIEWS.length) nice.push('No customer reviews yet (the site says so honestly). Add real ones as they come in. → src/data/reviews.ts');
if (!GALLERY.length) nice.push('No customer-print photos yet; the gallery on /lab/ stays hidden until there are. → src/data/reviews.ts');

const show = (title: string, items: string[], mark: string) => {
  console.log(`\n${title} (${items.length})`);
  for (const i of items) console.log(`  ${mark} ${i}`);
  if (!items.length) console.log('  none');
};
console.log('DashLabs launch check');
show('MUST FIX before launch', must, '✗');
show('CHECK BY HAND', check, '?');
show('NICE TO HAVE', nice, '·');
console.log(must.length ? `\n${must.length} thing(s) to fix before launch.` : '\nNothing blocking. Check the by-hand list, then launch.');
if (process.argv.includes('--strict') && must.length) process.exit(1);
