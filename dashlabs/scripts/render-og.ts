// Renders a share card (1200×630) for every product to public/og/<slug>.jpg,
// and one for every Learn guide to public/og/learn-<slug>.jpg.
// That's the picture people see when a product link is pasted into iMessage,
// WhatsApp, Discord, Instagram DMs and so on.
//   npm run og
// Uses the product's first photo when it has one, otherwise its pre-rendered 3D
// thumbnail (run `npm run thumbs` first after adding a product). Run it again
// after changing a product's name, summary, price or photos.
import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { PRODUCTS, categoryById, type Product } from '../src/data/catalog.ts';
import { money } from '../src/lib/money.ts';
import { GUIDES } from '../src/data/guides.ts';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const b64 = (path: string) => readFileSync(path).toString('base64');
const font = (pkg: string, file: string) => `data:font/woff2;base64,${b64(`node_modules/@fontsource/${pkg}/files/${file}`)}`;
const FONTS = `
  @font-face { font-family: U; font-weight: 700; src: url(${font('unbounded', 'unbounded-latin-700-normal.woff2')}); }
  @font-face { font-family: M; font-weight: 500; src: url(${font('manrope', 'manrope-latin-500-normal.woff2')}); }
  @font-face { font-family: J; font-weight: 600; src: url(${font('jetbrains-mono', 'jetbrains-mono-latin-600-normal.woff2')}); }`;
const LOGO = `data:image/svg+xml;base64,${b64('public/favicon.svg')}`;

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const MIME: Record<string, string> = { webp: 'image/webp', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg' };

function picture(p: Product): { src: string; photo: boolean } | undefined {
  const photo = p.images?.[0];
  const file = photo ? `public${photo.startsWith('/') ? '' : '/'}${photo}` : `public/thumbs/${p.art.shape}-${categoryById(p.category).color.replace('#', '')}.webp`;
  if (!existsSync(file)) return undefined;
  return { src: `data:${MIME[file.split('.').pop()!.toLowerCase()] ?? 'image/png'};base64,${b64(file)}`, photo: Boolean(photo) };
}

function card(p: Product): string {
  const cat = categoryById(p.category);
  const pic = picture(p);
  const size = p.name.length > 18 ? 64 : 80;
  return `<!doctype html><html><head><meta charset="utf-8"><style>${FONTS}
  * { box-sizing: border-box; margin: 0; }
  body { width: 1200px; height: 630px; overflow: hidden; background: #08070d; color: #f1ece3; font-family: M; position: relative; }
  .bg { position: absolute; inset: 0;
    background:
      radial-gradient(circle at 76% 58%, ${cat.color}40, transparent 42%),
      radial-gradient(circle at 12% 0%, rgba(155,107,255,.28), transparent 45%),
      repeating-linear-gradient(0deg, rgba(196,168,255,.05) 0 1px, transparent 1px 6px),
      #0d0b15; }
  .bed { position: absolute; left: 600px; right: 40px; bottom: 54px; height: 70px; border-radius: 50%;
    background: radial-gradient(ellipse, ${cat.color}55, transparent 70%); filter: blur(6px); }
  .pic { position: absolute; right: 30px; top: 40px; width: 560px; height: 520px; object-fit: contain; filter: drop-shadow(0 30px 40px rgba(0,0,0,.6)); }
  .pic.photo { right: 60px; top: 70px; width: 480px; height: 490px; object-fit: cover; border-radius: 28px; border: 2px solid rgba(196,168,255,.24); }
  .copy { position: absolute; left: 72px; top: 64px; width: 600px; display: flex; flex-direction: column; height: 502px; }
  .kick { font: 600 20px J; letter-spacing: .18em; text-transform: uppercase; color: ${cat.color}; display: flex; align-items: center; gap: 14px; }
  .kick i { width: 14px; height: 14px; background: ${cat.color}; transform: rotate(45deg); box-shadow: 0 0 18px ${cat.color}; }
  h1 { font: 700 ${size}px/1.05 U; letter-spacing: -.02em; margin-top: 26px; color: #fbf8f2;
    text-shadow: 1px 1px 0 #7d55e6, 2px 2px 0 #6c47d6, 3px 3px 0 #7d55e6, 4px 4px 0 #5b39c2, 5px 5px 0 #6c47d6, 6px 6px 0 #4a2ca8, 7px 7px 0 #3b2290, 8px 8px 0 #3b2290, 10px 10px 24px rgba(155,107,255,.45); }
  p { font-size: 27px; line-height: 1.4; color: #c8c1d6; margin-top: 26px; max-width: 520px; }
  .foot { margin-top: auto; display: flex; align-items: center; gap: 22px; }
  .price { font: 700 34px U; color: #1d0f00; background: linear-gradient(#ffc766, #ffab2e); padding: 14px 26px 16px; border-radius: 18px; box-shadow: 0 6px 0 #c97606, 0 14px 40px rgba(255,140,30,.35); }
  .price small { font: 600 18px J; letter-spacing: .08em; text-transform: uppercase; margin-right: 8px; }
  .brand { display: flex; align-items: center; gap: 12px; font: 700 26px U; }
  .brand img { width: 44px; height: 44px; }
  .brand b { color: #ffab2e; }
  .note { position: absolute; right: 44px; bottom: 30px; font: 600 15px J; letter-spacing: .14em; text-transform: uppercase; color: #8e87a3; }
  </style></head><body>
  <div class="bg"></div><div class="bed"></div>
  ${pic ? `<img class="pic${pic.photo ? ' photo' : ''}" src="${pic.src}" alt="">` : ''}
  <div class="copy">
    <div class="kick"><i></i>${esc(cat.label)}</div>
    <h1>${esc(p.name)}</h1>
    <p>${esc(p.summary)}</p>
    <div class="foot">
      <span class="price">${p.purchase === 'quote' ? '<small>from</small>' : ''}${money(p.price)}</span>
      <span class="brand"><img src="${LOGO}" alt=""><span>Dash<b>Labs</b></span></span>
    </div>
  </div>
  <div class="note">Printed to order</div>
  </body></html>`;
}

type Guide = (typeof GUIDES)[number];
function guideCard(g: Guide, n: number): string {
  const num = String(n).padStart(2, '0');
  const size = g.title.length > 22 ? 58 : 70;
  return `<!doctype html><html><head><meta charset="utf-8"><style>${FONTS}
  * { box-sizing: border-box; margin: 0; }
  body { width: 1200px; height: 630px; overflow: hidden; background: #08070d; color: #f1ece3; font-family: M; position: relative; }
  .bg { position: absolute; inset: 0;
    background:
      radial-gradient(circle at 82% 40%, rgba(255,225,77,.16), transparent 40%),
      radial-gradient(circle at 10% 0%, rgba(155,107,255,.28), transparent 45%),
      repeating-linear-gradient(0deg, rgba(196,168,255,.05) 0 1px, transparent 1px 6px),
      #0d0b15; }
  .num { position: absolute; right: 50px; top: 56px; font: 700 250px/1 U; letter-spacing: -.06em; color: transparent;
    -webkit-text-stroke: 3px rgba(255,225,77,.55); }
  .tool { position: absolute; right: 70px; top: 370px; font: 600 18px J; letter-spacing: .14em; text-transform: uppercase;
    color: #ffe14d; border: 1.5px solid rgba(255,225,77,.5); border-radius: 999px; padding: 10px 18px; background: rgba(13,11,21,.7); }
  .copy { position: absolute; left: 72px; top: 64px; width: 640px; display: flex; flex-direction: column; height: 502px; }
  .kick { font: 600 20px J; letter-spacing: .18em; text-transform: uppercase; color: #c4a8ff; }
  h1 { font: 700 ${size}px/1.05 U; letter-spacing: -.02em; margin-top: 26px; color: #fbf8f2; max-width: 600px;
    text-shadow: 1px 1px 0 #7d55e6, 2px 2px 0 #6c47d6, 3px 3px 0 #7d55e6, 4px 4px 0 #5b39c2, 5px 5px 0 #6c47d6, 6px 6px 0 #4a2ca8, 7px 7px 0 #3b2290, 8px 8px 0 #3b2290, 10px 10px 24px rgba(155,107,255,.45); }
  p { font-size: 27px; line-height: 1.4; color: #c8c1d6; margin-top: 26px; max-width: 580px; }
  .foot { margin-top: auto; display: flex; align-items: center; gap: 12px; font: 700 26px U; }
  .foot img { width: 44px; height: 44px; }
  .foot b { color: #ffab2e; }
  .foot small { font: 600 16px J; letter-spacing: .14em; text-transform: uppercase; color: #8e87a3; margin-left: 14px; }
  </style></head><body>
  <div class="bg"></div>
  <div class="num">${num}</div>
  <div class="tool">Tool · ${esc(g.tool)}</div>
  <div class="copy">
    <div class="kick">Learn · ${g.minutes} min read</div>
    <h1>${esc(g.title)}</h1>
    <p>${esc(g.summary)}</p>
    <div class="foot"><img src="${LOGO}" alt=""><span>Dash<b>Labs</b></span><small>Guides</small></div>
  </div>
  </body></html>`;
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
rmSync('public/og', { recursive: true, force: true });
mkdirSync('public/og', { recursive: true });
const missing: string[] = [];
for (const p of PRODUCTS) {
  if (!picture(p)) missing.push(p.name);
  await page.setContent(card(p));
  await page.evaluate(() => document.fonts.ready);
  writeFileSync(`public/og/${p.slug}.jpg`, await page.screenshot({ type: 'jpeg', quality: 86 }));
}
for (const [i, g] of GUIDES.entries()) {
  await page.setContent(guideCard(g, i + 1));
  await page.evaluate(() => document.fonts.ready);
  writeFileSync(`public/og/learn-${g.slug}.jpg`, await page.screenshot({ type: 'jpeg', quality: 86 }));
}
await browser.close();
console.log(`Rendered ${PRODUCTS.length} product and ${GUIDES.length} guide share cards to public/og/.`);
if (missing.length) console.log(`No picture yet for: ${missing.join(', ')} (run npm run thumbs, or add photos).`);
