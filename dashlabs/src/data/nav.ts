// Site navigation, built from the catalog and guides so new products show up in
// the menus automatically.

import { CATEGORIES, PRODUCTS, productCode, type CategoryId } from './catalog.ts';
import { GUIDES } from './guides.ts';

export interface NavItem {
  sku: string; // F01, O01…
  label: string;
  href: string;
  price: number; // cents ("from" for quotes)
  quote: boolean;
  shape: string;
  color: string;
}

export interface NavGroup {
  id: CategoryId | 'learn';
  label: string;
  sub: string;
  color: string;
  href: string;
  items: NavItem[];
}

export const MAIN_LINKS = [
  { label: 'Custom', href: '/custom/' },
  { label: 'The lab', href: '/lab/' },
  { label: 'Learn', href: '/learn/' },
  { label: 'FAQ', href: '/faq/' },
];

export const LEARN_COLOR = '#ffe14d';
export const DEFAULT_COLOR = '#ffab2e';

export const SHOP_GROUPS: NavGroup[] = CATEGORIES.map((c) => ({
  id: c.id,
  label: c.label,
  sub: c.sub,
  color: c.color,
  href: `/shop/?c=${c.id}`,
  items: PRODUCTS.filter((p) => p.category === c.id).map((p) => ({
    sku: productCode(p),
    label: p.name,
    href: `/shop/${p.slug}/`,
    price: p.price,
    quote: p.purchase === 'quote',
    shape: p.art.shape,
    color: c.color,
  })),
}));

export const LEARN_GROUP = {
  label: 'Learn',
  color: LEARN_COLOR,
  items: GUIDES.map((g) => ({ label: g.title, href: `/learn/${g.slug}/`, tool: g.tool })),
};

const norm = (p: string) => (p.endsWith('/') ? p : p + '/');

/** The accent colour for a page: its category's, gold for Learn, else amber. */
export function pageColor(pathname: string): string {
  const path = norm(pathname);
  for (const g of SHOP_GROUPS) if (g.items.some((i) => i.href === path)) return g.color;
  if (path.startsWith('/learn/')) return LEARN_COLOR;
  return DEFAULT_COLOR;
}
