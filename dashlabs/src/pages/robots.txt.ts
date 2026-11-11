import type { APIRoute } from 'astro';

export const GET: APIRoute = ({ site }) =>
  new Response(`User-agent: *\nAllow: /\nDisallow: /cart/\nDisallow: /order/\n\nSitemap: ${new URL('/sitemap.xml', site ?? 'http://localhost:4321').href}\n`, {
    headers: { 'Content-Type': 'text/plain' },
  });
