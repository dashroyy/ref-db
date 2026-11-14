// @ts-check
import { defineConfig } from 'astro/config';
import netlify from '@astrojs/netlify';

// Two ways to build:
//  - Locally and on any static host: a plain static site (checkout sends order requests by email).
//  - On Netlify (it sets NETLIFY=true): the same static pages plus two server
//    routes, /api/checkout and /api/stripe-webhook, for Stripe payments.
// Nothing needs editing to go live: see docs/DEPLOY.md.
const onNetlify = !!process.env.NETLIFY;

/** Adds the payment routes only where there is a server to run them. */
const paymentRoutes = {
  name: 'dashlabs-payment-routes',
  hooks: {
    /** @param {{ injectRoute: (r: { pattern: string, entrypoint: string, prerender?: boolean }) => void }} o */
    'astro:config:setup': ({ injectRoute }) => {
      injectRoute({ pattern: '/api/checkout', entrypoint: './src/server-routes/api/checkout.ts', prerender: false });
      injectRoute({ pattern: '/api/stripe-webhook', entrypoint: './src/server-routes/api/stripe-webhook.ts', prerender: false });
    },
  },
};

export default defineConfig({
  // Netlify provides URL (the site's main address) at build time.
  site: process.env.SITE_URL || process.env.URL || 'http://localhost:4321',
  ...(onNetlify ? { adapter: netlify(), integrations: [paymentRoutes] } : {}),
  // Pin Vite to this project's tsconfig so it never walks up into the parent
  // repository's tsconfig while DashLabs lives in a subfolder of another project.
  vite: { tsconfig: './tsconfig.json' },
});
