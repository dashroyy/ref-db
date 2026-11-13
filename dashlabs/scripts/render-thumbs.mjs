// Pre-renders the 3D product thumbnails to public/thumbs/*.webp.
//   npm run thumbs
// It builds the site with static thumbnails switched off, opens it in a
// headless browser (Playwright must be installed: `npx playwright install chromium`),
// lets the site's own 3D code draw every thumbnail, and saves the results.
// Run it after adding a product or changing a model or category colour.
import { execSync } from 'node:child_process';
import { createServer } from 'node:http';
import { join } from 'node:path';
import { writeFileSync, readFileSync, existsSync, statSync, mkdirSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const PORT = 4391;
const PAGES = ['/shop/', '/', '/learn/materials/'];

execSync('npx astro build --outDir dist-thumbs', { stdio: 'inherit', env: { ...process.env, THUMBS: 'off' } });
// a tiny static file server for the build
const TYPES = { html: 'text/html', js: 'text/javascript', css: 'text/css', json: 'application/json', svg: 'image/svg+xml', woff2: 'font/woff2', webp: 'image/webp', png: 'image/png' };
const server = createServer((req, res) => {
  let path = join('dist-thumbs', decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (existsSync(path) && statSync(path).isDirectory()) path = join(path, 'index.html');
  if (!existsSync(path)) return res.writeHead(404).end();
  res.writeHead(200, { 'Content-Type': TYPES[path.split('.').pop()] ?? 'application/octet-stream' }).end(readFileSync(path));
}).listen(PORT);
try {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  const found = new Map();
  for (const path of PAGES) {
    page.on('pageerror', (e) => console.log('page error on', path, e.message));
    page.on('requestfailed', (r) => console.log('failed', r.url()));
    page.on('response', (r) => r.status() >= 400 && console.log(r.status(), r.url()));
    await page.goto(`http://localhost:${PORT}${path}`);
    try {
      await page.waitForFunction(() => [...document.querySelectorAll('[data-thumb]')].every((e) => e.querySelector('.thumb-3d')), null, { timeout: 60000 });
    } catch (e) {
      console.log('STUCK on', path, await page.evaluate(() => [...document.querySelectorAll('[data-thumb]')].map((e) => `${e.className}:${e.dataset.shape}:${!!e.querySelector('.thumb-3d')}`)));
      throw e;
    }
    const items = await page.evaluate(() =>
      [...document.querySelectorAll('[data-thumb]')].map((e) => ({ key: `${e.dataset.shape}-${e.dataset.color.replace('#', '')}`, src: e.querySelector('.thumb-3d').src })),
    );
    for (const it of items) found.set(it.key, it.src);
  }
  // Hero poster: the home-page printer mid-print, shown instantly while the live 3D loads.
  const hp = await browser.newPage({ viewport: { width: 1400, height: 900 }, deviceScaleFactor: 2 });
  await hp.goto(`http://localhost:${PORT}/`);
  await hp.waitForFunction(() => Number(document.querySelector('[data-layer]')?.textContent) >= 52, null, { timeout: 120000 });
  await hp.evaluate(() => {
    document.querySelector('[data-hero-printer] .hud').style.visibility = 'hidden';
    for (const el of [document.documentElement, document.body, document.querySelector('.chamber'), document.querySelector('.hero-stage')]) if (el) el.style.background = 'transparent';
    document.querySelector('.chamber').style.display = 'none';
    const st = document.createElement('style');
    st.textContent = '.hero-stage::before{display:none!important}';
    document.head.appendChild(st);
  });
  const png = await hp.locator('[data-hero-printer] canvas').screenshot({ omitBackground: true });
  // PNG → WebP (keeping transparency) in the browser
  const webp = await hp.evaluate(async (b64) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.width;
    c.height = img.height;
    c.getContext('2d').drawImage(img, 0, 0);
    return c.toDataURL('image/webp', 0.82).split(',')[1];
  }, png.toString('base64'));
  writeFileSync('public/hero-poster.webp', Buffer.from(webp, 'base64'));
  await browser.close();
  rmSync('public/thumbs', { recursive: true, force: true });
  mkdirSync('public/thumbs', { recursive: true });
  for (const [key, src] of found) writeFileSync(`public/thumbs/${key}.webp`, Buffer.from(src.split(',')[1], 'base64'));
  writeFileSync('src/data/thumbs.json', JSON.stringify([...found.keys()].sort(), null, 2) + '\n');
  console.log(`Rendered ${found.size} thumbnails and the hero poster.`);
} finally {
  server.close();
  rmSync('dist-thumbs', { recursive: true, force: true });
}
