// THE NAV PLAN — like REF·DB's zone plan: one source for the mission rail, the
// home systems board, the page banners and the station colour of every page.
// Stations come from the catalog categories (plus Learn), so a new product
// appears in the menu automatically.

import { CATEGORIES, PRODUCTS, productCode, type CategoryId } from './catalog.ts';
import { GUIDES } from './guides.ts';

export interface RailItem {
  code: string; // F01, O01, L01…
  label: string;
  href: string;
  quote?: boolean; // custom-quote product
}

export interface Station {
  id: CategoryId | 'learn';
  short: string;
  sub: string;
  glyph: string;
  color: string;
  href: string; // where the station itself leads
  items: RailItem[];
}

export const BRIEF = [
  { label: 'Home', href: '/' },
  { label: 'Shop all', href: '/shop/' },
  { label: 'Custom order', href: '/custom/' },
  { label: 'The lab', href: '/lab/' },
  { label: 'FAQ', href: '/faq/' },
];

export const LEARN_COLOR = '#E0A94E';
export const ACCENT = '#ff5a3d';

export const STATIONS: Station[] = [
  ...CATEGORIES.map((c) => ({
    id: c.id,
    short: c.short,
    sub: c.sub,
    glyph: c.glyph,
    color: c.color,
    href: `/shop/?c=${c.id}`,
    items: PRODUCTS.filter((p) => p.category === c.id).map((p) => ({
      code: productCode(p),
      label: p.name,
      href: `/shop/${p.slug}/`,
      quote: p.purchase === 'quote',
    })),
  })),
  {
    id: 'learn',
    short: 'LEARN',
    sub: 'Guides & tools',
    glyph: '§',
    color: LEARN_COLOR,
    href: '/learn/',
    items: GUIDES.map((g, i) => ({ code: `L${String(i + 1).padStart(2, '0')}`, label: g.title, href: `/learn/${g.slug}/` })),
  },
];

const norm = (p: string) => (p.endsWith('/') ? p : p + '/');

/** The station and item a page belongs to, for the rail highlight and the page colour. */
export function locate(pathname: string): { station?: Station; item?: RailItem; index: number } {
  const path = norm(pathname);
  for (const s of STATIONS) {
    const index = s.items.findIndex((i) => i.href === path);
    if (index >= 0) return { station: s, item: s.items[index], index };
  }
  if (path.startsWith('/learn/')) return { station: STATIONS.find((s) => s.id === 'learn'), index: -1 };
  return { index: -1 };
}

/** Colour for the current page: its station's, else the accent. */
export const pageColor = (pathname: string) => locate(pathname).station?.color ?? ACCENT;
