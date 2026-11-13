// End-to-end smoke test of the built site: the journeys a customer takes.
//   npm run build && npm run smoke
// Needs Playwright (`npx playwright install chromium`). Exits non-zero on any failure.
import { createServer } from 'node:http';
import { join } from 'node:path';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';

const { chromium, devices } = createRequire(import.meta.url)('playwright');
const PORT = 4392;
const B = `http://localhost:${PORT}`;
const TYPES = { html: 'text/html', js: 'text/javascript', css: 'text/css', json: 'application/json', svg: 'image/svg+xml', woff2: 'font/woff2', webp: 'image/webp', png: 'image/png', xml: 'application/xml', txt: 'text/plain', webmanifest: 'application/manifest+json' };
const server = createServer((req, res) => {
  let path = join('dist', decodeURIComponent(new URL(req.url, B).pathname));
  if (existsSync(path) && statSync(path).isDirectory()) path = join(path, 'index.html');
  if (!existsSync(path)) return res.writeHead(404, { 'Content-Type': 'text/html' }).end(existsSync('dist/404.html') ? readFileSync('dist/404.html') : 'not found');
  res.writeHead(200, { 'Content-Type': TYPES[path.split('.').pop()] ?? 'application/octet-stream' }).end(readFileSync(path));
}).listen(PORT);

let failed = 0;
const errors = [];
async function step(name, fn) {
  try {
    await fn();
    console.log(`  ok    ${name}`);
  } catch (e) {
    failed++;
    console.log(`  FAIL  ${name}\n        ${String(e.message).split('\n')[0]}`);
  }
}
const expect = (cond, msg) => {
  if (!cond) throw new Error(msg);
};

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
page.on('pageerror', (e) => {
  // The browser cancels a page cross-fade when the test navigates faster than a person could. Not a site error.
  if (/Transition was aborted/.test(e.message)) return;
  errors.push(`${page.url()}: ${e.message}`);
});

const PAGES = ['/', '/shop/', '/custom/', '/gifts/', '/lab/', '/learn/', '/faq/', '/policies/', '/about/', '/cart/', '/saved/'];
await step('every main page loads with a title and one h1', async () => {
  for (const p of PAGES) {
    const r = await page.goto(B + p);
    expect(r.status() === 200, `${p} → ${r.status()}`);
    expect((await page.locator('h1').count()) === 1, `${p} should have exactly one h1`);
    expect((await page.title()).includes('DashLabs'), `${p} title`);
  }
});

await step('every internal link on every page resolves', async () => {
  const seen = new Set();
  const queue = [...PAGES];
  while (queue.length) {
    const p = queue.shift();
    if (seen.has(p)) continue;
    seen.add(p);
    const r = await page.goto(B + p);
    expect(r.status() === 200, `broken link: ${p}`);
    const links = await page.evaluate(() => [...document.querySelectorAll('a[href^="/"]')].map((a) => new URL(a.href).pathname));
    for (const l of links) if (!seen.has(l) && !l.startsWith('/api/')) queue.push(l);
  }
  expect(seen.size > 20, `only crawled ${seen.size} pages`);
});

await step('shop: filter, sort and quick add', async () => {
  await page.goto(B + '/shop/?c=originals');
  expect((await page.locator('[data-grid] .card-wrap:visible').count()) === 2, 'originals filter');
  await page.goto(B + '/shop/');
  await page.selectOption('[data-sort]', 'low');
  const prices = await page.locator('[data-grid] .card-wrap').evaluateAll((e) => e.map((x) => Number(x.dataset.price)));
  expect(prices.every((v, i) => !i || prices[i - 1] <= v), 'sorted by price');
  await page.click('[data-quick-add="mto-vase"]');
  await page.waitForFunction(() => document.querySelector('[data-cart-count]').textContent === '1');
});

await step('product: options change the price; personalised item goes in the cart with its text', async () => {
  await page.goto(B + '/shop/printed-business-cards/');
  await page.click('label.choice:has-text("50 cards")');
  expect((await page.textContent('[data-price]')) === '$70.00', 'price with 50 cards');
  await page.goto(B + '/shop/name-keychain/');
  await page.fill('#note', 'DASH');
  await page.click('[data-buy] button[type="submit"]');
  await page.waitForFunction(() => document.querySelector('[data-cart-count]').textContent === '2');
  const cart = await page.evaluate(() => JSON.parse(localStorage.getItem('dashlabs.cart.v1')));
  expect(cart.some((l) => l.note === 'DASH'), 'note saved');
});

await step('cart: totals, gift wrap, remove + undo, order request dialog', async () => {
  await page.goto(B + '/cart/');
  expect((await page.textContent('[data-subtotal]')) === '$30.00', `subtotal ${await page.textContent('[data-subtotal]')}`);
  await page.click('.switch');
  expect((await page.textContent('[data-subtotal]')) === '$33.00', 'gift wrap adds $3');
  await page.click('.rm >> nth=0');
  expect((await page.locator('.line').count()) === 1, 'removed');
  await page.click('[data-undo-btn]');
  expect((await page.locator('.line').count()) === 2, 'undo');
  await page.fill('#name', 'Test');
  await page.fill('#email', 'test@example.com');
  await page.click('[data-checkout] button[type="submit"]');
  await page.waitForSelector('.dl-send[open]');
  const text = await page.inputValue('.dl-send textarea');
  expect(/Order request DL-\d{6}-[A-Z0-9]{4}/.test(text) && text.includes('Gift wrap') && text.includes('"DASH"'), 'order text');
  await page.click('.dl-send [data-sent]');
  await page.waitForSelector('.dl-send .s-done');
  expect((await page.textContent('[data-cart-count]')) === '0', 'cart cleared after sending');
});

await step('product: choices are kept in the address and restored from a shared link', async () => {
  await page.goto(B + '/shop/pen-launcher/');
  await page.click('label.choice:has-text("Signal blue")');
  expect(page.url().endsWith('?colour=blue'), `url ${page.url()}`);
  await page.goto(B + '/shop/printed-business-cards/?qty=50&style=nfc&text=Alex');
  expect((await page.textContent('[data-price]')) === '$90.00', 'price restored from link');
  expect((await page.inputValue('#note')) === 'Alex', 'text restored from link');
});

await step('forms remember the name and email typed earlier', async () => {
  await page.goto(B + '/custom/');
  expect((await page.inputValue('#rname')) === 'Test' && (await page.inputValue('#remail')) === 'test@example.com', 'prefilled from the cart form');
});

await step('custom: quote product pre-fills the request form', async () => {
  await page.goto(B + '/shop/custom-pet-figurine/');
  await page.click('label.choice:has-text("Medium")');
  await page.click('[data-buy] button[type="submit"]');
  await page.waitForURL(/\/custom\//);
  expect((await page.inputValue('#kind')) === 'cust-pet', 'kind');
  expect((await page.inputValue('[name="options"]')).includes('Medium'), 'options carried over');
});

await step('tools: estimator, launch lab, design check, place picker, gift finder', async () => {
  await page.goto(B + '/learn/pricing/');
  expect((await page.textContent('[data-total]')) === '$13', 'estimator default');
  await page.goto(B + '/learn/pen-launcher-physics/');
  expect((await page.textContent('[data-range]')) === '4.70 m', 'launch default');
  await page.goto(B + '/learn/design-for-printing/');
  expect((await page.textContent('[data-overall]')) === 'Prints cleanly', 'design default');
  await page.goto(B + '/learn/where-prints-live/');
  await page.click('label:has-text("In a car")');
  expect((await page.locator('[data-fits] li').first().textContent()).startsWith('ASA'), 'ASA first for a car');
  await page.goto(B + '/gifts/');
  expect((await page.locator('[data-gift-grid] .card-wrap:visible').count()) >= 1, 'gift picks');
});

await step('search, saved items and theme are remembered', async () => {
  await page.goto(B + '/');
  await page.keyboard.press('/');
  await page.keyboard.type('launch');
  expect((await page.locator('[data-search-results] li').first().textContent()).includes('Pen Launcher'), 'search result');
  await page.keyboard.press('Escape');
  await page.goto(B + '/shop/');
  await page.click('[data-save="orig-pen-launcher"]');
  await page.goto(B + '/saved/');
  expect((await page.locator('[data-saved-grid] .card-wrap:visible').count()) === 1, 'saved page');
  await page.click('.theme-btn');
  await page.reload();
  expect((await page.evaluate(() => document.documentElement.dataset.theme)) === 'light', 'theme remembered');
});

await step('keyboard: Shop menu and phone menu can be used without a mouse', async () => {
  await page.goto(B + '/');
  await page.focus('[data-mega-btn]');
  await page.keyboard.press('Enter');
  expect(await page.evaluate(() => !!document.activeElement.closest('[data-mega]')), 'focus moves into the Shop menu');
  await page.keyboard.press('Escape');
  expect(await page.evaluate(() => document.activeElement.matches('[data-mega-btn]')), 'Esc returns focus to Shop');
  const m = await browser.newPage({ ...devices['iPhone 13'] });
  await m.goto(B + '/');
  await m.focus('[data-burger]');
  await m.keyboard.press('Enter');
  await m.waitForTimeout(150);
  for (let i = 0; i < 30; i++) await m.keyboard.press('Tab');
  expect(await m.evaluate(() => !!document.activeElement.closest('[data-mobile-menu]') || document.activeElement.matches('[data-burger]')), 'Tab stays in the open menu');
  await m.keyboard.press('Escape');
  expect(await m.evaluate(() => document.activeElement.matches('[data-burger]')), 'Esc returns focus to the menu button');
  await m.close();
});

await step('phone: no page scrolls sideways', async () => {
  const m = await browser.newPage({ ...devices['iPhone 13'] });
  for (const p of [...PAGES, '/shop/pen-launcher/', '/learn/pricing/', '/learn/materials/']) {
    await m.goto(B + p);
    const over = await m.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    expect(over <= 0, `${p} is ${over}px too wide`);
  }
  await m.close();
});

await step('no JavaScript errors anywhere', async () => expect(errors.length === 0, errors.join(' | ')));

await browser.close();
server.close();
console.log(failed ? `\n${failed} check(s) failed` : '\nAll journeys pass');
process.exit(failed ? 1 : 0);
