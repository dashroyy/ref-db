// @ts-check
import { defineConfig } from 'astro/config';

// Static for now. When checkout goes live, add a server adapter
// (e.g. @astrojs/netlify, @astrojs/vercel or @astrojs/cloudflare) and set
// `output: 'static'` pages to prerender while /api/* routes run on the server.
// See docs/SHOP-ROADMAP.md.
export default defineConfig({
  site: process.env.SITE_URL || 'http://localhost:4321',
  // Pin Vite to this project's tsconfig so it never walks up into the parent
  // REF·DB repo's tsconfig while DashLabs lives in a subfolder of it.
  vite: { tsconfig: './tsconfig.json' },
});
