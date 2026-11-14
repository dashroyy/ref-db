// sitemap.xml, built from the catalog and guides so it never goes stale.
import type { APIRoute } from 'astro';
import { PRODUCTS } from '../data/catalog.ts';
import { GUIDES } from '../data/guides.ts';

export const GET: APIRoute = ({ site }) => {
  const base = site ?? new URL('http://localhost:4321');
  const paths = [
    '/',
    '/shop/',
    '/custom/',
    '/lab/',
    '/learn/',
    '/faq/',
    '/policies/',
    '/about/',
    '/gifts/',
    ...PRODUCTS.map((p) => `/shop/${p.slug}/`),
    ...GUIDES.map((g) => `/learn/${g.slug}/`),
  ];
  const urls = paths.map((p) => `  <url><loc>${new URL(p, base).href}</loc></url>`).join('\n');
  return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`, {
    headers: { 'Content-Type': 'application/xml' },
  });
};
