// Builds the site in each setup you can switch on from Netlify's settings and
// checks each one works, so a change can't quietly break a setup that isn't
// switched on yet.   npm run check:modes   (CI runs it too)
//
//   email orders (default)         request mode, customer sends from their email
//   direct delivery                PUBLIC_ORDER_DELIVERY=netlify-form
//   card checkout                  PUBLIC_CHECKOUT_MODE=stripe
//   card checkout on Netlify       + NETLIFY=1: also compiles /api/checkout and the webhook
import { execSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync } from 'node:fs';

const OUT = '.modes';
const read = (dir, page) => readFileSync(`${OUT}/${dir}/${page}/index.html`, 'utf8');
const forms = (html) => [...html.matchAll(/<form name="([a-z-]+)" data-netlify/g)].map((m) => m[1]).sort().join(',');
const text = (html) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

const MODES = [
  {
    dir: 'email',
    env: {},
    expect: (r) => [
      [forms(r('')) === '', 'no hidden Netlify forms'],
      [/Send order request/.test(r('cart')), 'cart sends an order request'],
      [!/through Netlify/.test(text(r('policies'))), 'policy does not mention Netlify'],
    ],
  },
  {
    dir: 'direct',
    env: { PUBLIC_ORDER_DELIVERY: 'netlify-form' },
    expect: (r) => [
      [forms(r('')) === 'custom,order', `forms for order + custom requests (got "${forms(r(''))}")`],
      [/comes straight to me/.test(r('cart')), 'cart says the order comes straight to you'],
      [/requests you send from this site reach me through Netlify/.test(text(r('policies'))), 'policy names Netlify'],
    ],
  },
  {
    dir: 'stripe',
    env: { PUBLIC_CHECKOUT_MODE: 'stripe' },
    expect: (r) => [
      [forms(r('')) === 'paid-order', `form for paid-order notices (got "${forms(r(''))}")`],
      [/Checkout securely/.test(r('cart')), 'cart offers secure checkout'],
      [/By card, at checkout/.test(text(r('faq'))), 'FAQ describes card checkout'],
      [/handled by Stripe/.test(text(r('policies'))), 'policy says Stripe handles payments'],
    ],
  },
];

let failed = 0;
const ok = (pass, what) => {
  console.log(`  ${pass ? 'ok  ' : 'FAIL'}  ${what}`);
  if (!pass) failed++;
};

rmSync(OUT, { recursive: true, force: true });
try {
  for (const m of MODES) {
    console.log(`\n${m.dir}${Object.keys(m.env).length ? ` (${Object.entries(m.env).map(([k, v]) => `${k}=${v}`).join(' ')})` : ' (default)'}`);
    execSync(`npx astro build --outDir ${OUT}/${m.dir}`, { stdio: 'pipe', env: { ...process.env, ...m.env } });
    ok(true, 'builds');
    try {
      execSync(`npx html-validate "${OUT}/${m.dir}/**/*.html"`, { stdio: 'pipe' });
      ok(true, 'HTML valid');
    } catch (e) {
      ok(false, `HTML valid\n${String(e.stdout).slice(0, 800)}`);
    }
    for (const [pass, what] of m.expect((page) => read(m.dir, page))) ok(pass, what);
  }

  // The real Netlify build: the adapter compiles the server routes for payments.
  console.log('\nstripe on Netlify (NETLIFY=1)');
  rmSync('.netlify', { recursive: true, force: true });
  execSync('npx astro build', { stdio: 'pipe', env: { ...process.env, NETLIFY: '1', PUBLIC_CHECKOUT_MODE: 'stripe' } });
  const fn = '.netlify/v1/functions/ssr/ssr.mjs';
  ok(existsSync(fn), 'server function built');
  const chunks = existsSync('.netlify/build/chunks') ? execSync('ls .netlify/build/chunks').toString() : '';
  ok(/checkout/.test(chunks), '/api/checkout compiled');
  ok(/stripe-webhook/.test(chunks), '/api/stripe-webhook compiled');
} finally {
  rmSync('.netlify', { recursive: true, force: true });
  rmSync(OUT, { recursive: true, force: true });
  // leave dist/ as the default build, as other scripts expect
  execSync('npx astro build', { stdio: 'pipe' });
}

console.log(failed ? `\n${failed} check(s) failed` : '\nAll setups work');
process.exit(failed ? 1 : 0);
